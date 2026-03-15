export const getAppwriteConfig = (env) => {
  const endpoint =
    env.APPWRITE_FUNCTION_API_ENDPOINT ??
    env.APPWRITE_ENDPOINT ??
    env.APPWRITE_API_ENDPOINT;

  const projectId = env.APPWRITE_FUNCTION_PROJECT_ID ?? env.APPWRITE_PROJECT_ID;

  const apiKey = env.APPWRITE_FUNCTION_API_KEY ?? env.APPWRITE_API_KEY;

  return { endpoint, projectId, apiKey };
};

export const getAllowedAdminLabels = (env) => {
  const raw = env.ADMIN_LABELS ?? env.ADMIN_LABEL ?? "admin";
  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

