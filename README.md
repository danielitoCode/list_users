# Appwrite Function: CRUD de Usuarios (solo Admin) + Clean Architecture

Esta función sirve como endpoint de administración de usuarios en Appwrite, permitiendo CRUD **solo** si el solicitante tiene un label de admin.

## Estructura (Clean Architecture)

- `src/domain/` reglas puras (ej. política de admin por labels)
- `src/application/` casos de uso (CRUD + autorización)
- `src/interfaces/` adaptadores HTTP (Appwrite Function handler/router)
- `src/infrastructure/` SDK Appwrite + config desde env
- `src/startup/` composición/DI

## Requisitos

- Runtime Node.js (>= 18).
- La API key usada por la función debe tener permisos de **Users** (por ejemplo: leer/crear/actualizar/eliminar usuarios).
- El usuario que invoca la función debe tener el label `admin` (configurable).

## Configuración (Appwrite Functions)

Coloca tu API key como **variable de entorno** en la configuración de la Function (Settings → Variables). La función soporta las variables inyectadas por Appwrite:

- `APPWRITE_FUNCTION_API_ENDPOINT`
- `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_FUNCTION_API_KEY`

Para pruebas locales también acepta:

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`

Label(s) admin:

- `ADMIN_LABELS=admin` (por defecto). Puedes pasar varios separados por coma, por ejemplo: `ADMIN_LABELS=admin,Admin`.

## Autenticación del solicitante

La función intenta identificar al solicitante así:

1) Header `x-appwrite-user-jwt` o `x-appwrite-jwt` (recomendado)
2) Body `requesterJwt` / `jwt` / `appwriteJwt` (útil para `createExecution`)
3) Header `x-appwrite-user-id` **solo si** `ALLOW_UNVERIFIED_USER_ID=1` (solo recomendado para pruebas locales)

Si no puede identificar usuario, responde `401`.

### ¿Quién envía el ID/JWT?

- **Vía Appwrite SDK (frontend, con sesión):** normalmente el SDK ejecuta la Function usando la sesión del usuario. La Function puede recibir `x-appwrite-user-id` (si Appwrite lo inyecta) o, en su defecto, puedes enviar un JWT.
- **Vía dominio HTTP (Function URL):** las ejecuciones por dominio no están autenticadas por Appwrite; para identificar al usuario debes enviar un **JWT** en el header `x-appwrite-user-jwt` (recomendado) o `x-appwrite-jwt`.

## Endpoints (Function URL / HTTP)

- `GET /users` → lista usuarios (opcional: `?search=...` y `?queries=[...]` o `queries=a,b,c`)
- `POST /users` → crea usuario (body JSON: `email` o `phone`, `password`, `name`, opcional `userId`, `labels`)
- `GET /users/{userId}` → obtiene usuario
- `PATCH /users/{userId}` → actualiza campos (body JSON soportado: `name`, `email`, `phone`, `password`, `status`, `labels`, `emailVerification`, `phoneVerification`)
- `PATCH /users/{userId}/password` → cambia password (body: `{ "password": "..." }`)
- `PATCH /users/{userId}/status` → activa/desactiva (body: `{ "status": true|false }`)
- `PATCH /users/{userId}/labels` → reemplaza labels (body: `{ "labels": ["admin"] }`)
- `PATCH /users/{userId}/verification` → verificación (body: `{ "emailVerification": true|false, "phoneVerification": true|false }`)
- `DELETE /users/{userId}` → elimina usuario

### Uso vía HTTP (Function URL)

1) En la consola de Appwrite, en la Function, habilita **Execute access = Any** si vas a usar el dominio de la Function URL.
2) Obtén un JWT del usuario (desde tu frontend) y envíalo en `x-appwrite-user-jwt`.

Ejemplo (listar):

```bash
curl -X GET "https://<TU-FUNCTION-DOMAIN>/users" \
  -H "x-appwrite-user-jwt: <JWT_DEL_USUARIO>" \
  -H "Content-Type: application/json"
```

Ejemplo (cambiar status):

```bash
curl -X PATCH "https://<TU-FUNCTION-DOMAIN>/users/<USER_ID>/status" \
  -H "x-appwrite-user-jwt: <JWT_DEL_USUARIO>" \
  -H "Content-Type: application/json" \
  -d "{\"status\":false}"
```

## Modo `createExecution` (sin path)

Si ejecutas la función con `functions.createExecution(...)` y no hay `path`, usa `POST /` con body JSON que incluya:

- `action`: `list` | `get` | `create` | `update` | `delete`
- y los campos necesarios (`userId`, `email`, etc.)
- opcional: `requesterJwt` (recomendado si no hay contexto de usuario)

### Uso vía Appwrite SDK

#### Frontend (recomendado)

Opción A (si tu SDK soporta `path` + `method` en `createExecution`): aprovecha las rutas:

- `path: "/users"` + `method: "GET"` para listar
- `path: "/users/<USER_ID>/status"` + `method: "PATCH"` y `body: "{\"status\":false}"`

Opción B (compatible con cualquier SDK): usa el modo `action` en el body.

Ejemplo (JavaScript Web SDK):

```js
import { Client, Account, Functions } from "appwrite";

const client = new Client()
  .setEndpoint("https://<TU-ENDPOINT>/v1")
  .setProject("<TU_PROJECT_ID>");

const account = new Account(client);
const functions = new Functions(client);

// Si ya hay sesión, usualmente basta con ejecutar.
// Si necesitas forzar identidad, crea un JWT y pásalo como requesterJwt.
// const jwt = await account.createJWT(); // jwt.jwt

const payload = { action: "list" /*, requesterJwt: jwt.jwt */ };

const execution = await functions.createExecution(
  "<TU_FUNCTION_ID>",
  JSON.stringify(payload),
  false
);

console.log(JSON.parse(execution.responseBody));
```

Ejemplo (actualizar status con action):

```js
const payload = { action: "update", userId: "<USER_ID>", status: false };
await functions.createExecution("<TU_FUNCTION_ID>", JSON.stringify(payload), false);
```

#### Server SDK (Node)

Con el SDK de servidor puedes ejecutar una Function pasando `path`, `method`, `headers` y `body`.
Si el servidor no está actuando como un usuario logueado, envía `x-appwrite-user-jwt` (o `requesterJwt`) para que la Function pueda identificar al solicitante.

## Debug (solo local)

Si quieres que los errores 404/500 regresen detalles (para entender qué pasó), setea:

- `DEBUG_ERRORS=1`

## Pruebas locales

Ejecuta:

```bash
npm start
```

O:

```bash
node test-local.js
```

Ejemplo (PowerShell) para setear variables localmente:

```powershell
$env:APPWRITE_ENDPOINT="https://cloud.appwrite.io/v1"
$env:APPWRITE_PROJECT_ID="TU_PROJECT_ID"
$env:APPWRITE_API_KEY="TU_API_KEY"
node test-local.js
```
