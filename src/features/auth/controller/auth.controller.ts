import { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { LoginRequest, RegisterRequest } from '../interfaces/auth.types.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const loginData: LoginRequest = req.body;

    if (!loginData.password) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Password is required',
      });
      return;
    }

    if (!loginData.email && !loginData.username) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email or username is required',
      });
      return;
    }

    const result = await authService.login(loginData);

    res.cookie('accessToken', result.tokens.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        tokens: result.tokens,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Login failed',
    });
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const registerData: RegisterRequest = req.body;

    const roleValues = ['super-admin', 'admin', 'staff', 'keuangan'] as const;
    const rawType = (req.body as any)?.type;
    const rawRole = (req.body as any)?.role;
    const rawEmail = (req.body as any)?.email;

    const roleFromType =
      typeof rawType === 'string' && (roleValues as readonly string[]).includes(rawType)
        ? (rawType as (typeof roleValues)[number])
        : undefined;

    const roleFromRoleField =
      typeof rawRole === 'string' && (roleValues as readonly string[]).includes(rawRole)
        ? (rawRole as (typeof roleValues)[number])
        : undefined;

    const hasBootstrapHeader = Boolean(req.get('x-bootstrap-token'));

    // Dashboard registration heuristics:
    // - type='dashboard'
    // - OR type is one of role values (legacy shortcut)
    // - OR role is provided
    // - OR bootstrap header is present and email is not provided
    const isDashboardRegister =
      registerData.type === 'dashboard' ||
      roleFromType !== undefined ||
      roleFromRoleField !== undefined ||
      (hasBootstrapHeader && (rawEmail === undefined || rawEmail === null || String(rawEmail).trim() === ''));

    // Dashboard registration (protected by x-bootstrap-token)
    // ONLY super-admin can be registered via this endpoint
    // Other roles must be created via POST /admin with super-admin authentication
    if (isDashboardRegister) {
      const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
      const providedToken = req.get('x-bootstrap-token');

      // ALWAYS require bootstrap token for dashboard registration (security fix)
      if (!expectedToken) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Dashboard registration is disabled. Use POST /admin endpoint with super-admin authentication to create users.',
        });
        return;
      }

      if (providedToken !== expectedToken) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid bootstrap token',
        });
        return;
      }

      const resolvedRole = roleFromType ?? roleFromRoleField ?? registerData.role;

      if (!registerData.username || !registerData.password || !resolvedRole) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Username, password, and role are required for dashboard registration',
        });
        return;
      }

      // ONLY allow super-admin registration via bootstrap endpoint
      if (resolvedRole !== 'super-admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Only super-admin can be registered via this endpoint. Use POST /admin with super-admin authentication to create other roles.',
        });
        return;
      }

      const result = await authService.registerDashboardUser({
        username: registerData.username,
        password: registerData.password,
        role: resolvedRole,
      });

      res.cookie('accessToken', result.tokens.accessToken, COOKIE_OPTIONS);
      res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS);

      res.status(201).json({
        success: true,
        message: 'Dashboard registration successful',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      });

      return;
    }

    // Default: Buyer registration
    if (!registerData.email || !registerData.username || !registerData.password) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email, username, and password are required',
      });
      return;
    }

    const result = await authService.registerBuyer({
      email: registerData.email,
      username: registerData.username,
      password: registerData.password,
    });

    res.cookie('accessToken', result.tokens.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: result.user,
        tokens: result.tokens,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Registration failed',
    });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Refresh token not provided',
      });
      return;
    }

    const tokens = await authService.refreshTokens(refreshToken);

    res.cookie('accessToken', tokens.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        tokens,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Token refresh failed',
    });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}
