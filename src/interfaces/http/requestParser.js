export const normalizeHeaders = (headers) => {
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

export const getBodyJson = (req) => {
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

export const getPath = (req) => {
  const raw = req?.path ?? req?.url ?? "/";
  const base = String(raw).split("?")[0];
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.length ? trimmed : "/";
};

export const getQuery = (req) => {
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

export const parseQueries = (value) => {
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

