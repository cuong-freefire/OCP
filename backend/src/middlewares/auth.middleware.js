import { AppError, authCodes } from '../utils/response.util.js';

export async function requireAuth(req, _res, next) {
  try {
    const config = req.app.locals.authConfig;
    const authService = req.app.locals.authService;
    const token = req.cookies?.[config.cookieAccessName];
    req.user = await authService.getAuthenticatedUserFromAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...allowedRoles) {
  return async (req, _res, next) => {
    try {
      if (!req.user?.id) {
        throw new AppError('Authentication required', authCodes.AUTH_REQUIRED, 401);
      }

      req.user = await req.app.locals.authService.requireRole(req.user.id, allowedRoles);
      next();
    } catch (error) {
      next(error);
    }
  };
}
