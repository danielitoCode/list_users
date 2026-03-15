import { createApp } from "./startup/createApp.js";

/**
 * Appwrite Functions entrypoint.
 *
 * Appwrite ejecuta el `default export` con el objeto:
 * `{ req, res, log, error }`
 */
export default async (ctx) => {
  const app = createApp({ log: ctx?.log, error: ctx?.error });
  return app(ctx);
};

