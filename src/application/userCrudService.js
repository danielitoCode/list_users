const badRequest = (message) => {
  const err = new Error(message);
  err.code = 400;
  return err;
};

const forbidden = (message) => {
  const err = new Error(message);
  err.code = 403;
  return err;
};

const unauthorized = (message) => {
  const err = new Error(message);
  err.code = 401;
  return err;
};

export const createUserCrudService = ({
  usersGateway,
  allowedAdminLabels,
  isAdminByLabels,
}) => {
  const ensureAdmin = async ({ requesterId, requesterJwt }) => {
    const { requester, requesterId: resolvedId } = await usersGateway.getRequester(
      { requesterId, requesterJwt }
    );

    if (!resolvedId) throw unauthorized("No autorizado. Inicie sesión.");
    if (!requester) {
      const err = new Error("Usuario solicitante no encontrado.");
      err.code = 404;
      throw err;
    }

    const isAdmin = isAdminByLabels(requester.labels, allowedAdminLabels);
    if (!isAdmin) throw forbidden("Acceso denegado: se requiere rol Admin.");

    return { requester, requesterId: resolvedId };
  };

  return {
    async listUsers({ requesterId, requesterJwt, queries, search }) {
      await ensureAdmin({ requesterId, requesterJwt });
      return usersGateway.list({ queries, search });
    },

    async getUser({ requesterId, requesterJwt, userId }) {
      await ensureAdmin({ requesterId, requesterJwt });
      if (!userId) throw badRequest("Falta `userId`.");
      return usersGateway.get(userId);
    },

    async createUser({ requesterId, requesterJwt, user }) {
      await ensureAdmin({ requesterId, requesterJwt });
      if (!user?.email && !user?.phone) {
        throw badRequest("Debe enviar `email` o `phone`.");
      }
      return usersGateway.create({
        userId: user.userId ?? "unique()",
        email: user.email,
        phone: user.phone,
        password: user.password,
        name: user.name,
        labels: user.labels,
      });
    },

    async updateUser({ requesterId, requesterJwt, userId, patch }) {
      await ensureAdmin({ requesterId, requesterJwt });
      if (!userId) throw badRequest("Falta `userId`.");
      return usersGateway.update(userId, patch ?? {});
    },

    async setUserPassword({ requesterId, requesterJwt, userId, password }) {
      await ensureAdmin({ requesterId, requesterJwt });
      if (!userId) throw badRequest("Falta `userId`.");
      if (typeof password !== "string" || !password.length) {
        throw badRequest("Falta `password`.");
      }
      return usersGateway.update(userId, { password });
    },

    async setUserStatus({ requesterId, requesterJwt, userId, status }) {
      await ensureAdmin({ requesterId, requesterJwt });
      if (!userId) throw badRequest("Falta `userId`.");
      if (typeof status !== "boolean") throw badRequest("Falta `status` boolean.");
      return usersGateway.update(userId, { status });
    },

    async setUserLabels({ requesterId, requesterJwt, userId, labels }) {
      await ensureAdmin({ requesterId, requesterJwt });
      if (!userId) throw badRequest("Falta `userId`.");
      if (!Array.isArray(labels)) throw badRequest("Falta `labels` (array).");
      return usersGateway.update(userId, { labels });
    },

    async setUserVerification({
      requesterId,
      requesterJwt,
      userId,
      emailVerification,
      phoneVerification,
    }) {
      await ensureAdmin({ requesterId, requesterJwt });
      if (!userId) throw badRequest("Falta `userId`.");
      const patch = {};
      if (typeof emailVerification === "boolean") patch.emailVerification = emailVerification;
      if (typeof phoneVerification === "boolean") patch.phoneVerification = phoneVerification;
      if (!Object.keys(patch).length) {
        throw badRequest(
          "Nada que actualizar. Envíe `emailVerification` y/o `phoneVerification` boolean."
        );
      }
      return usersGateway.update(userId, patch);
    },

    async deleteUser({ requesterId, requesterJwt, userId }) {
      await ensureAdmin({ requesterId, requesterJwt });
      if (!userId) throw badRequest("Falta `userId`.");
      await usersGateway.delete(userId);
      return { success: true };
    },
  };
};
