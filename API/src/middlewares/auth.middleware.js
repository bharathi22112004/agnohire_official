import { verifyAccessToken } from '../utils/jwt.js';
import { error } from '../utils/response.js';
import { prisma } from '../configs/db.js';

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return error(res, 'Access token required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Fetch user with role
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, deletedAt: null },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      return error(res, 'User not found or inactive', 401, 'UNAUTHORIZED');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Access token expired', 401, 'TOKEN_EXPIRED');
    }
    return error(res, 'Invalid access token', 401, 'INVALID_TOKEN');
  }
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  return authMiddleware(req, res, next);
}
