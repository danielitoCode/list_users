import { Account, Client, Users } from "node-appwrite";

const createAdminClient = (config) =>
  new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

const createUserClientFromJwt = (config, jwt) =>
  new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setJWT(jwt);

export const createAppwriteUsersGateway = ({ config }) => {
  const adminClient = createAdminClient(config);
  const users = new Users(adminClient);

  return {
    async getRequester({ requesterId, requesterJwt }) {
      if (!requesterId && requesterJwt) {
        const userClient = createUserClientFromJwt(config, requesterJwt);
        const account = new Account(userClient);
        const requester = await account.get();
        return { requesterId: requester?.$id, requester };
      }

      if (!requesterId) return { requesterId: null, requester: null };

      const requester = await users.get(requesterId);
      return { requesterId, requester };
    },

    async list({ queries, search }) {
      return users.list(queries, search);
    },

    async get(userId) {
      return users.get(userId);
    },

    async create({ userId, email, phone, password, name, labels }) {
      const created = await users.create(userId, email, phone, password, name);
      if (Array.isArray(labels)) {
        await users.updateLabels(created.$id, labels);
      }
      return users.get(created.$id);
    },

    async delete(userId) {
      return users.delete(userId);
    },

    async update(userId, patch) {
      const updates = [];

      if (typeof patch.name === "string")
        updates.push(() => users.updateName(userId, patch.name));
      if (typeof patch.email === "string")
        updates.push(() => users.updateEmail(userId, patch.email));
      if (typeof patch.phone === "string")
        updates.push(() => users.updatePhone(userId, patch.phone));
      if (typeof patch.password === "string")
        updates.push(() => users.updatePassword(userId, patch.password));
      if (typeof patch.status === "boolean")
        updates.push(() => users.updateStatus(userId, patch.status));
      if (Array.isArray(patch.labels))
        updates.push(() => users.updateLabels(userId, patch.labels));
      if (typeof patch.emailVerification === "boolean") {
        updates.push(() =>
          users.updateEmailVerification(userId, patch.emailVerification)
        );
      }
      if (typeof patch.phoneVerification === "boolean") {
        updates.push(() =>
          users.updatePhoneVerification(userId, patch.phoneVerification)
        );
      }

      if (!updates.length) {
        const err = new Error(
          "Nada que actualizar. Campos soportados: name, email, phone, password, status, labels, emailVerification, phoneVerification."
        );
        err.code = 400;
        throw err;
      }

      for (const fn of updates) await fn();
      return users.get(userId);
    },
  };
};

