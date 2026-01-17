import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth.js';
import * as dashboardUserRepo from '../../auth/repositories/dashboardUser.repository.js';
import * as buyerRepo from '../../auth/repositories/buyer.repository.js';
import { hashPassword } from '../../../utils/password.js';
import { UserRole } from '../../auth/interfaces/auth.types.js';
import { generateAccessToken, generateRefreshToken } from '../../../utils/jwt.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function bootstrapSuperAdmin(req: Request, res: Response): Promise<void> {
  try {
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    const providedToken = req.get('x-bootstrap-token');

    if (process.env.NODE_ENV === 'production' && !expectedToken) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'ADMIN_BOOTSTRAP_TOKEN is not set',
      });
      return;
    }

    if (expectedToken && providedToken !== expectedToken) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid bootstrap token',
      });
      return;
    }

    const { username, password } = req.body ?? {};
    if (!username || !password) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password are required',
      });
      return;
    }

    const existingCount = await dashboardUserRepo.countDashboardUsers();
    if (existingCount > 0) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Bootstrap already completed',
      });
      return;
    }

    const existingUser = await dashboardUserRepo.findDashboardUserByUsername(username);
    if (existingUser) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Username already exists',
      });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await dashboardUserRepo.createDashboardUser({
      username,
      password: hashedPassword,
      role: 'super-admin',
    });

    const accessToken = await generateAccessToken({
      userId: newUser._id!,
      type: 'dashboard',
      role: 'super-admin',
    });

    const refreshToken = await generateRefreshToken({
      userId: newUser._id!,
      type: 'dashboard',
      role: 'super-admin',
    });

    res.cookie('accessToken', accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    const { password: _, ...userWithoutPassword } = newUser as any;

    res.status(201).json({
      success: true,
      message: 'Bootstrap super-admin created',
      data: {
        user: { ...userWithoutPassword, type: 'dashboard' },
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to bootstrap super-admin',
    });
  }
}

export async function getDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [totalUsers, totalBuyers] = await Promise.all([dashboardUserRepo.countDashboardUsers(), buyerRepo.countBuyers()]);

    res.status(200).json({
      message: 'Admin dashboard data',
      user: {
        id: req.user?.userId,
        type: req.user?.type,
        role: req.user?.role,
      },
      stats: {
        totalUsers,
        totalBuyers,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
    });
  }
}

export async function getAdmins(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const admins = await dashboardUserRepo.findAllDashboardUsers();
    const adminsWithoutPassword = admins.map(({ password, ...admin }) => ({
      ...admin,
      password: undefined,
    }));

    res.status(200).json({
      message: 'Admin users list',
      admins: adminsWithoutPassword,
      count: admins.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch admin users',
    });
  }
}

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { username, password, role } = req.body;
    const currentUserRole = req.user?.role;

    if (!username || !password || !role) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Username, password, and role are required',
      });
      return;
    }

    const validRoles: UserRole[] = ['super-admin', 'admin', 'staff', 'keuangan'];
    if (!validRoles.includes(role)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
      return;
    }

    // Only super-admin can create users
    if (currentUserRole !== 'super-admin') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Only super-admin can create users',
      });
      return;
    }

    const existingUser = await dashboardUserRepo.findDashboardUserByUsername(username);
    if (existingUser) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Username already exists',
      });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await dashboardUserRepo.createDashboardUser({
      username,
      password: hashedPassword,
      role: role as UserRole,
    });

    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'Admin user created successfully',
      user: userWithoutPassword,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to create admin user',
    });
  }
}
