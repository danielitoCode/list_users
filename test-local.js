import main from "./src/main.js";

/**
 * Prueba local (simula Appwrite Functions)
 *
 * Nota: Para probar contra un Appwrite real, configura:
 * - APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY
 *   (o las variables APPWRITE_FUNCTION_* equivalentes)
 */

process.env.APPWRITE_ENDPOINT =
  process.env.APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
process.env.APPWRITE_PROJECT_ID =
  process.env.APPWRITE_PROJECT_ID ?? "TU_PROJECT_ID";
process.env.APPWRITE_API_KEY = process.env.APPWRITE_API_KEY ?? "TU_API_KEY";

async function runTest({ name, method, path, userId, body }) {
  console.log(`\n--- ${name} ---`);

  const req = {
    method,
    path,
    headers: {
      ...(userId ? { "x-appwrite-user-id": userId } : {}),
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
    name: "Sin autenticación",
    method: "GET",
    path: "/users",
    userId: null,
  });

  if (process.env.APPWRITE_API_KEY === "TU_API_KEY") {
    console.log(
      "\nAVISO: Configura APPWRITE_* para ejecutar pruebas reales (requieren API KEY con permisos de Users)."
    );
    return;
  }

  await runTest({
    name: "Listar usuarios (requiere admin label)",
    method: "GET",
    path: "/users",
    userId: "ID_DE_UN_USER_REAL",
  });
}

startTests();
