import { prisma } from '../configs/db.js';

export function auditMiddleware(actionType, entity) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = async (body) => {
      if (res.statusCode < 400 && req.user) {
        try {
          await prisma.auditLog.create({
            data: {
              userId: req.user?.id,
              role: req.user?.role?.name,
              ipAddress: req.ip || req.socket.remoteAddress,
              deviceInfo: req.headers['user-agent'],
              actionType,
              entity,
              entityId: req.params?.id || body?.data?.id,
              afterData: body?.data ? JSON.parse(JSON.stringify(body.data)) : null,
            },
          });
        } catch (err) {
          // Don't block response on audit failure
          console.error('Audit log error:', err.message);
        }
      }
      return originalJson(body);
    };

    next();
  };
}
