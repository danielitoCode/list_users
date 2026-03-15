import main from "./src/main.js";

/**
 * Prueba local (simula Appwrite Functions)
 *
 * Configura estas variables de entorno antes de correr:
 * - APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY
 *   (o las variables APPWRITE_FUNCTION_* equivalentes)
 *
 * Para simular al solicitante:
 * - REQUESTER_JWT (recomendado, se envía como x-appwrite-jwt)
 * - REQUESTER_ID  (solo local; requiere ALLOW_UNVERIFIED_USER_ID=1)
 */

const env = process.env;

const endpoint =
  env.APPWRITE_FUNCTION_API_ENDPOINT ??
  env.APPWRITE_ENDPOINT ??
  env.APPWRITE_API_ENDPOINT ??
  "https://cloud.appwrite.io/v1";

const projectId =
  env.APPWRITE_FUNCTION_PROJECT_ID ??
  env.APPWRITE_PROJECT_ID ??
  "TU_PROJECT_ID";

const apiKey =
  env.APPWRITE_FUNCTION_API_KEY ??
  env.APPWRITE_API_KEY ??
  "TU_API_KEY";

process.env.APPWRITE_ENDPOINT = endpoint;
process.env.APPWRITE_PROJECT_ID = projectId;
process.env.APPWRITE_API_KEY = apiKey;

const REQUESTER_ID = env.REQUESTER_ID ?? null;
const REQUESTER_JWT = env.REQUESTER_JWT ?? null;

// Solo para pruebas locales: habilita aceptar x-appwrite-user-id sin JWT.
process.env.ALLOW_UNVERIFIED_USER_ID =
  env.ALLOW_UNVERIFIED_USER_ID ?? (REQUESTER_ID && !REQUESTER_JWT ? "1" : "0");

async function runTest({ name, method, path, userId, body }) {
  console.log(`\n--- ${name} ---`);

  const req = {
    method,
    path,
    headers: {
      ...(userId ? { "x-appwrite-user-id": userId } : {}),
      ...(REQUESTER_JWT ? { "x-appwrite-jwt": REQUESTER_JWT } : {}),
    },
    body: body ?? {},
  };

  const res = {
    json: (data, code = 200) => {
      console.log(`[Respuesta ${code}]:`, JSON.stringify(data, null, 2));
      return data;
    },
  };

  const log = (msg) => console.log(`[LOG]: ${msg}`);
  const error = (msg) => console.error(`[ERROR]: ${msg}`);

  try {
    await main({ req, res, log, error });
  } catch (err) {
    console.error("Fallo crítico en la prueba:", err);
  }
}

async function startTests() {
  console.log("Iniciando pruebas locales...");

  await runTest({
    name: "Sin autenticación (esperado 401)",
    method: "GET",
    path: "/users",
    userId: null,
  });

  const configured =
    apiKey &&
    apiKey !== "TU_API_KEY" &&
    projectId &&
    projectId !== "TU_PROJECT_ID" &&
    endpoint;

  if (!configured) {
    console.log(
      "\nAVISO: Configura APPWRITE_* o APPWRITE_FUNCTION_* para ejecutar pruebas reales (requieren API KEY con permisos de Users)."
    );
    console.log(
      `Detectado: endpoint=${endpoint} projectId=${projectId} apiKey=${
        apiKey === "TU_API_KEY" ? "(no configurada)" : "(configurada)"
      }`
    );
    return;
  }

  if (!REQUESTER_ID && !REQUESTER_JWT) {
    console.log(
      "\nAVISO: Define `REQUESTER_JWT` (recomendado) o `REQUESTER_ID` (solo local) para ejecutar pruebas reales."
    );
    return;
  }

  await runTest({
    name: "Listar usuarios (requiere admin label)",
    method: "GET",
    path: "/users",
    userId: REQUESTER_ID,
  });
}

startTests();

