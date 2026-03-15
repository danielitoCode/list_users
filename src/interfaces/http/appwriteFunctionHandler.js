import {
  getBodyJson,
  getPath,
  getQuery,
  normalizeHeaders,
  parseQueries,
} from "./requestParser.js";

const json = (res, code, payload) => res.json(payload, code);

export const createAppwriteFunctionHandler = ({
  userCrudService,
  config,
  log,
  error,
}) => {
  return async ({ req, res, log: ctxLog, error: ctxError }) => {
    const logger = ctxLog ?? log ?? (() => {});
    const errLogger = ctxError ?? error ?? (() => {});

    if (!config?.endpoint || !config?.projectId || !config?.apiKey) {
      const missing = [
        !config?.endpoint &&
          "APPWRITE_FUNCTION_API_ENDPOINT (o APPWRITE_ENDPOINT)",
        !config?.projectId &&
          "APPWRITE_FUNCTION_PROJECT_ID (o APPWRITE_PROJECT_ID)",
        !config?.apiKey && "APPWRITE_FUNCTION_API_KEY (o APPWRITE_API_KEY)",
      ]
        .filter(Boolean)
        .join(", ");

      errLogger(`Configuración incompleta: faltan variables: ${missing}`);
      return json(res, 500, {
        success: false,
        error: "Error de configuración del servidor.",
      });
    }

    const headers = normalizeHeaders(req?.headers);
    const body = getBodyJson(req);
    const query = getQuery(req);
    const path = getPath(req);
    const method = String(req?.method ?? "GET").toUpperCase();

    const requesterId = headers["x-appwrite-user-id"];
    const requesterJwt =
      headers["x-appwrite-user-jwt"] ?? headers["x-appwrite-jwt"];

    try {
      // Health / help
      if (method === "GET" && (path === "/" || path === "")) {
        return json(res, 200, {
          success: true,
          message:
            "Use /users (GET/POST) o /users/{userId} (GET/PATCH/DELETE). Para createExecution, POST / con body.action.",
        });
      }

      // Modo createExecution (sin path)
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
          const result = await userCrudService.listUsers({
            requesterId,
            requesterJwt,
            queries: parseQueries(body.queries),
            search: body.search,
          });
          return json(res, 200, {
            success: true,
            total: result.total,
            users: result.users,
          });
        }

        if (action === "get") {
          const user = await userCrudService.getUser({
            requesterId,
            requesterJwt,
            userId: body.userId ? String(body.userId) : null,
          });
          return json(res, 200, { success: true, user });
        }

        if (action === "create") {
          const user = await userCrudService.createUser({
            requesterId,
            requesterJwt,
            user: body,
          });
          return json(res, 201, { success: true, user });
        }

        if (action === "update") {
          const user = await userCrudService.updateUser({
            requesterId,
            requesterJwt,
            userId: body.userId ? String(body.userId) : null,
            patch: body,
          });
          return json(res, 200, { success: true, user });
        }

        if (action === "delete") {
          await userCrudService.deleteUser({
            requesterId,
            requesterJwt,
            userId: body.userId ? String(body.userId) : null,
          });
          return json(res, 200, { success: true });
        }

        return json(res, 400, {
          success: false,
          error: `action no soportada: ${action}`,
        });
      }

      // /users
      if (path === "/users") {
        if (method === "GET") {
          const result = await userCrudService.listUsers({
            requesterId,
            requesterJwt,
            queries: parseQueries(query.queries ?? body.queries),
            search: query.search ?? body.search,
          });
          return json(res, 200, {
            success: true,
            total: result.total,
            users: result.users,
          });
        }

        if (method === "POST") {
          const user = await userCrudService.createUser({
            requesterId,
            requesterJwt,
            user: body,
          });
          return json(res, 201, { success: true, user });
        }

        return json(res, 405, { success: false, error: "Método no permitido." });
      }

      // /users/{userId}
      const match = path.match(/^\/users\/([^/]+)$/);
      if (match) {
        const userId = decodeURIComponent(match[1]);

        if (method === "GET") {
          const user = await userCrudService.getUser({
            requesterId,
            requesterJwt,
            userId,
          });
          return json(res, 200, { success: true, user });
        }

        if (method === "PATCH") {
          const user = await userCrudService.updateUser({
            requesterId,
            requesterJwt,
            userId,
            patch: body,
          });
          return json(res, 200, { success: true, user });
        }

        if (method === "DELETE") {
          await userCrudService.deleteUser({
            requesterId,
            requesterJwt,
            userId,
          });
          return json(res, 200, { success: true });
        }

        return json(res, 405, { success: false, error: "Método no permitido." });
      }

      return json(res, 404, { success: false, error: "Ruta no encontrada." });
    } catch (err) {
      const code = err?.code ?? 500;
      const message = err?.message ? String(err.message) : String(err);
      errLogger(`Error: ${message}`);

      if (code === 401) {
        return json(res, 401, {
          success: false,
          error: message || "No autorizado.",
        });
      }

      if (/unauthorized/i.test(message)) {
        return json(res, 401, {
          success: false,
          error: "No autorizado (verifique API key / JWT).",
        });
      }

      if (code === 403) {
        return json(res, 403, { success: false, error: message });
      }

      if (code === 404) {
        return json(res, 404, { success: false, error: "Recurso no encontrado." });
      }

      if (code === 400) {
        return json(res, 400, { success: false, error: message });
      }

      return json(res, 500, {
        success: false,
        error: "Error interno al procesar la solicitud.",
        code,
      });
    } finally {
      logger(
        `Request: ${method} ${path} (requester: ${requesterId ?? "n/a"})`
      );
    }
  };
};
