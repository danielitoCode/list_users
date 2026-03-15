# Appwrite Function: CRUD de Usuarios (solo Admin)

Esta función sirve como endpoint de administración de usuarios en Appwrite, permitiendo CRUD **solo** si el solicitante tiene un label de admin.

## Requisitos

- Runtime Node.js (>= 18).
- La API key usada por la función debe tener permisos de **Users** (por ejemplo: leer/crear/actualizar/eliminar usuarios).
- El usuario que invoca la función debe tener el label `admin` (configurable).

## Configuración (Appwrite Functions)

La función soporta las variables inyectadas por Appwrite:

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

1) Header `x-appwrite-user-id` (inyectado por Appwrite cuando hay sesión)
2) Header `x-appwrite-user-jwt` o `x-appwrite-jwt` (si lo envías tú)

Si no puede identificar usuario, responde `401`.

## Endpoints (Function URL / HTTP)

- `GET /users` → lista usuarios (opcional: `?search=...` y `?queries=[...]` o `queries=a,b,c`)
- `POST /users` → crea usuario (body JSON: `email` o `phone`, `password`, `name`, opcional `userId`, `labels`)
- `GET /users/{userId}` → obtiene usuario
- `PATCH /users/{userId}` → actualiza campos (body JSON soportado: `name`, `email`, `phone`, `password`, `status`, `labels`, `emailVerification`, `phoneVerification`)
- `DELETE /users/{userId}` → elimina usuario

## Modo `createExecution` (sin path)

Si ejecutas la función con `functions.createExecution(...)` y no hay `path`, usa `POST /` con body JSON que incluya:

- `action`: `list` | `get` | `create` | `update` | `delete`
- y los campos necesarios (`userId`, `email`, etc.)

## Pruebas locales

Ejecuta:

```bash
npm start
```

O:

```bash
node test-local.js
```
