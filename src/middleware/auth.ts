import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { TokenPayload } from '../features/auth/interfaces/auth.types.js';
import { UserRole } from '../features/auth/interfaces/auth.types.js';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : undefined;
    const token = bearerToken || req.cookies?.accessToken;

    if (!token) {
      res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
      return;
    }

    const payload = await verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Invalid token',
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
      return;
    }

    if (req.user.type !== 'dashboard') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Dashboard access required',
      });
      return;
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

export function requireUserType(...allowedTypes: Array<TokenPayload['type']>) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
      return;
    }

    if (!allowedTypes.includes(req.user.type)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access requires user type: ${allowedTypes.join(' or ')}`,
      });
      return;
    }

    next();
  };
}
