import { Client, Users, Account } from "node-appwrite";

const json = (res, code, payload) => res.json(payload, code);

const normalizeHeaders = (headers) => {
  if (!headers) return {};

  if (typeof headers.get === "function") {
    return new Proxy(
      {},
      {
        get: (_, key) => {
          if (typeof key !== "string") return undefined;
          return headers.get(key) ?? headers.get(key.toLowerCase());
        },
      }
    );
  }

  const normalized = {};
  for (const [k, v] of Object.entries(headers)) {
    normalized[String(k).toLowerCase()] = v;
  }
  return normalized;
};

const getBodyJson = (req) => {
  if (!req) return {};
  if (req.bodyJson && typeof req.bodyJson === "object") return req.bodyJson;
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim().length) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
};

const getPath = (req) => {
  const raw = req?.path ?? req?.url ?? "/";
  const base = String(raw).split("?")[0];
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.length ? trimmed : "/";
};

const getQuery = (req) => {
  if (req?.query && typeof req.query === "object") return req.query;
  const url = String(req?.url ?? "");
  const idx = url.indexOf("?");
  if (idx === -1) return {};
  const qs = url.slice(idx + 1);
  const params = new URLSearchParams(qs);
  const obj = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
};

const parseQueries = (value) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String) : undefined;
    } catch {
      return undefined;
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const getAppwriteConfig = () => {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT ??
    process.env.APPWRITE_ENDPOINT ??
    process.env.APPWRITE_API_ENDPOINT;

  const projectId =
    process.env.APPWRITE_FUNCTION_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;

  const apiKey =
    process.env.APPWRITE_FUNCTION_API_KEY ?? process.env.APPWRITE_API_KEY;

  return { endpoint, projectId, apiKey };
};

const getAllowedAdminLabels = () => {
  const raw =
    process.env.ADMIN_LABELS ?? process.env.ADMIN_LABEL ?? "admin";

  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

const hasAdminLabel = (labels, allowedLower) => {
  const list = Array.isArray(labels) ? labels : [];
  const lower = list.map((l) => String(l).toLowerCase());
  return lower.some((l) => allowedLower.includes(l));
};

/**
 * Appwrite Function: CRUD de usuarios (solo Admin)
 *
 * Auth del solicitante (en orden):
 * - `x-appwrite-user-id` (inyectado por Appwrite cuando hay sesión)
 * - `x-appwrite-user-jwt` / `x-appwrite-jwt` (si el cliente lo envía)
 *
 * Config esperada (Appwrite Functions):
 * - `APPWRITE_FUNCTION_API_ENDPOINT`, `APPWRITE_FUNCTION_PROJECT_ID`, `APPWRITE_FUNCTION_API_KEY`
 *
 * Fallback local/legacy:
 * - `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`
 */
export default async ({ req, res, log, error }) => {
  const { endpoint, projectId, apiKey } = getAppwriteConfig();

  if (!endpoint || !projectId || !apiKey) {
    const missing = [
      !endpoint && "APPWRITE_FUNCTION_API_ENDPOINT (o APPWRITE_ENDPOINT)",
      !projectId && "APPWRITE_FUNCTION_PROJECT_ID (o APPWRITE_PROJECT_ID)",
      !apiKey && "APPWRITE_FUNCTION_API_KEY (o APPWRITE_API_KEY)",
    ]
      .filter(Boolean)
      .join(", ");

    error(`Configuración incompleta: faltan variables: ${missing}`);
    return json(res, 500, {
      success: false,
      error: "Error de configuración del servidor.",
    });
  }

  const headers = normalizeHeaders(req?.headers);
  const allowedAdminLabels = getAllowedAdminLabels();

  const adminClient = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const users = new Users(adminClient);

  const method = String(req?.method ?? "GET").toUpperCase();
  const path = getPath(req);
  const query = getQuery(req);
  const body = getBodyJson(req);

  try {
    let requesterId = headers["x-appwrite-user-id"];
    const requesterJwt =
      headers["x-appwrite-user-jwt"] ?? headers["x-appwrite-jwt"];

    let requester = null;

    if (!requesterId && requesterJwt) {
      const userClient = new Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setJWT(requesterJwt);

      const account = new Account(userClient);
      requester = await account.get();
      requesterId = requester?.$id;
    }

    if (!requesterId) {
      log(
        "Acceso denegado: no se detectó usuario (falta `x-appwrite-user-id` y/o JWT)."
      );
      return json(res, 401, {
        success: false,
        error: "No autorizado. Inicie sesión.",
      });
    }

    if (!requester) {
      requester = await users.get(requesterId);
    }

    if (!requester) {
      return json(res, 404, {
        success: false,
        error: "Usuario solicitante no encontrado.",
      });
    }

    const isAdmin = hasAdminLabel(requester.labels, allowedAdminLabels);
    if (!isAdmin) {
      log(
        `Acceso denegado: usuario ${requesterId} sin admin. Labels: ${(requester.labels ?? [])
          .map(String)
          .join(", ")}`
      );
      return json(res, 403, {
        success: false,
        error: "Acceso denegado: se requiere rol Admin.",
      });
    }

    // Router CRUD
    if (method === "GET" && (path === "/" || path === "")) {
      return json(res, 200, {
        success: true,
        message: "Use /users (GET/POST) o /users/{userId} (GET/PATCH/DELETE).",
      });
    }

    // Compatibilidad con `functions.createExecution(...)` (sin path): body.action
    if (method === "POST" && (path === "/" || path === "")) {
      const action = String(body.action ?? "").trim().toLowerCase();

      if (!action) {
        return json(res, 400, {
          success: false,
          error:
            "Falta `action`. Use rutas HTTP (/users, /users/{userId}) o envíe `action` en el body (list|get|create|update|delete).",
        });
      }

      if (action === "list") {
        const queries = parseQueries(body.queries);
        const search = body.search;
        const response = await users.list(queries, search);
        return json(res, 200, {
          success: true,
          total: response.total,
          users: response.users,
        });
      }

      if (action === "get") {
        if (!body.userId) {
          return json(res, 400, { success: false, error: "Falta `userId`." });
        }
        const user = await users.get(String(body.userId));
        return json(res, 200, { success: true, user });
      }

      if (action === "create") {
        const userId = body.userId ?? "unique()";
        const email = body.email;
        const phone = body.phone;
        const password = body.password;
        const name = body.name;

        if (!email && !phone) {
          return json(res, 400, { success: false, error: "Debe enviar `email` o `phone`." });
        }

        const created = await users.create(userId, email, phone, password, name);
        if (Array.isArray(body.labels)) {
          await users.updateLabels(created.$id, body.labels);
        }
        const finalUser = await users.get(created.$id);
        return json(res, 201, { success: true, user: finalUser });
      }

      if (action === "update") {
        if (!body.userId) {
          return json(res, 400, { success: false, error: "Falta `userId`." });
        }
        const userId = String(body.userId);
        const updates = [];

        if (typeof body.name === "string")
          updates.push(() => users.updateName(userId, body.name));
        if (typeof body.email === "string")
          updates.push(() => users.updateEmail(userId, body.email));
        if (typeof body.phone === "string")
          updates.push(() => users.updatePhone(userId, body.phone));
        if (typeof body.password === "string")
          updates.push(() => users.updatePassword(userId, body.password));
        if (typeof body.status === "boolean")
          updates.push(() => users.updateStatus(userId, body.status));
        if (Array.isArray(body.labels))
          updates.push(() => users.updateLabels(userId, body.labels));
        if (typeof body.emailVerification === "boolean") {
          updates.push(() =>
            users.updateEmailVerification(userId, body.emailVerification)
          );
        }
        if (typeof body.phoneVerification === "boolean") {
          updates.push(() =>
            users.updatePhoneVerification(userId, body.phoneVerification)
          );
        }

        if (!updates.length) {
          return json(res, 400, {
            success: false,
            error:
              "Nada que actualizar. Campos soportados: name, email, phone, password, status, labels, emailVerification, phoneVerification.",
          });
        }

        for (const fn of updates) await fn();
        const user = await users.get(userId);
        return json(res, 200, { success: true, user });
      }

      if (action === "delete") {
        if (!body.userId) {
          return json(res, 400, { success: false, error: "Falta `userId`." });
        }
        await users.delete(String(body.userId));
        return json(res, 200, { success: true });
      }

      return json(res, 400, { success: false, error: `action no soportada: ${action}` });
    }

    // /users
    if (path === "/users") {
      if (method === "GET") {
        const queries = parseQueries(query.queries ?? body.queries);
        const search = query.search ?? body.search;
        const response = await users.list(queries, search);
        return json(res, 200, {
          success: true,
          total: response.total,
          users: response.users,
        });
      }

      if (method === "POST") {
        const userId = body.userId ?? "unique()";
        const email = body.email;
        const phone = body.phone;
        const password = body.password;
        const name = body.name;

        if (!email && !phone) {
          return json(res, 400, {
            success: false,
            error: "Debe enviar `email` o `phone`.",
          });
        }

        const created = await users.create(userId, email, phone, password, name);

        if (Array.isArray(body.labels)) {
          await users.updateLabels(created.$id, body.labels);
        }

        const finalUser = await users.get(created.$id);
        return json(res, 201, { success: true, user: finalUser });
      }

      return json(res, 405, { success: false, error: "Método no permitido." });
    }

    // /users/{userId}
    const match = path.match(/^\/users\/([^/]+)$/);
    if (match) {
      const userId = decodeURIComponent(match[1]);

      if (method === "GET") {
        const user = await users.get(userId);
        return json(res, 200, { success: true, user });
      }

      if (method === "DELETE") {
        await users.delete(userId);
        return json(res, 200, { success: true });
      }

      if (method === "PATCH") {
        const updates = [];

        if (typeof body.name === "string")
          updates.push(() => users.updateName(userId, body.name));
        if (typeof body.email === "string")
          updates.push(() => users.updateEmail(userId, body.email));
        if (typeof body.phone === "string")
          updates.push(() => users.updatePhone(userId, body.phone));
        if (typeof body.password === "string")
          updates.push(() => users.updatePassword(userId, body.password));
        if (typeof body.status === "boolean")
          updates.push(() => users.updateStatus(userId, body.status));
        if (Array.isArray(body.labels))
          updates.push(() => users.updateLabels(userId, body.labels));
        if (typeof body.emailVerification === "boolean") {
          updates.push(() =>
            users.updateEmailVerification(userId, body.emailVerification)
          );
        }
        if (typeof body.phoneVerification === "boolean") {
          updates.push(() =>
            users.updatePhoneVerification(userId, body.phoneVerification)
          );
        }

        if (!updates.length) {
          return json(res, 400, {
            success: false,
            error:
              "Nada que actualizar. Campos soportados: name, email, phone, password, status, labels, emailVerification, phoneVerification.",
          });
        }

        for (const fn of updates) await fn();

        const user = await users.get(userId);
        return json(res, 200, { success: true, user });
      }

      return json(res, 405, { success: false, error: "Método no permitido." });
    }

    return json(res, 404, { success: false, error: "Ruta no encontrada." });
  } catch (err) {
    const code = err?.code ?? 500;
    const message = err?.message ? String(err.message) : String(err);

    error(`Error: ${message}`);
    if (err?.response) {
      try {
        error(`Detalles: ${JSON.stringify(err.response)}`);
      } catch {
        // ignore
      }
    }

    if (code === 401 || /unauthorized/i.test(message)) {
      return json(res, 401, {
        success: false,
        error: "No autorizado (verifique API key / JWT).",
      });
    }

    if (code === 404) {
      return json(res, 404, { success: false, error: "Recurso no encontrado." });
    }

    return json(res, 500, {
      success: false,
      error: "Error interno al procesar la solicitud.",
      code,
    });
  }
};
