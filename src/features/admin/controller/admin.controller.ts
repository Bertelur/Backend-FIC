import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth.js';
import * as dashboardUserRepo from '../../auth/repositories/dashboardUser.repository.js';
import * as buyerRepo from '../../auth/repositories/buyer.repository.js';
import { hashPassword } from '../../../utils/password.js';
import { UserRole } from '../../auth/interfaces/auth.types.js';

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

    // Role-based restrictions
    if (currentUserRole === 'admin') {
      // Admin can only create staff and keuangan
      if (role !== 'staff' && role !== 'keuangan') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Admin can only create staff and keuangan roles',
        });
        return;
      }
    } else if (currentUserRole !== 'super-admin') {
      // Only super-admin and admin can create users (admin case handled above)
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions to create admin users',
      });
      return;
    }
    // super-admin can create any role (no restriction needed)

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
