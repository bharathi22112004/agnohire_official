import { error } from '../utils/response.js';

export function rbac(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }

    const userRole = req.user.role?.name;
    if (!allowedRoles.includes(userRole)) {
      return error(res, 'Insufficient permissions', 403, 'FORBIDDEN');
    }

    next();
  };
}

export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  HR: 'hr',
  RECRUITER: 'recruiter',
  CANDIDATE: 'candidate',
};
