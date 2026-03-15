import { createUserCrudService } from "../application/userCrudService.js";
import { isAdminByLabels } from "../domain/security/adminPolicy.js";
import { getAllowedAdminLabels, getAppwriteConfig } from "../infrastructure/config/appwriteConfig.js";
import { createAppwriteUsersGateway } from "../infrastructure/appwrite/usersGateway.js";
import { createAppwriteFunctionHandler } from "../interfaces/http/appwriteFunctionHandler.js";

export const createApp = ({ log, error } = {}) => {
  const config = getAppwriteConfig(process.env);
  const allowedAdminLabels = getAllowedAdminLabels(process.env);

  const usersGateway = createAppwriteUsersGateway({ config });

  const userCrudService = createUserCrudService({
    usersGateway,
    allowedAdminLabels,
    isAdminByLabels,
  });

  return createAppwriteFunctionHandler({
    userCrudService,
    config,
    log,
    error,
  });
};

