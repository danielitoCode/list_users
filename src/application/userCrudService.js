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

    async deleteUser({ requesterId, requesterJwt, userId }) {
      await ensureAdmin({ requesterId, requesterJwt });
      if (!userId) throw badRequest("Falta `userId`.");
      await usersGateway.delete(userId);
      return { success: true };
    },
  };
};

