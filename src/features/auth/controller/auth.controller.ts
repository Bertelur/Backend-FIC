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

    if (!loginData.password || !loginData.type) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Password and type are required',
      });
      return;
    }

    if (loginData.type === 'dashboard' && !loginData.username) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Username is required for dashboard login',
      });
      return;
    }

    if (loginData.type === 'buyer' && !loginData.email && !loginData.username) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email or username is required for buyer login',
      });
      return;
    }

    const result = await authService.login(loginData);

    res.cookie('accessToken', result.tokens.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      user: result.user,
    });
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Login failed',
    });
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const registerData: RegisterRequest = req.body;

    if (!registerData.email || !registerData.username || !registerData.password) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email, username, and password are required',
      });
      return;
    }

    const result = await authService.registerBuyer(registerData);

    res.cookie('accessToken', result.tokens.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS);

    res.status(201).json({
      user: result.user,
    });
  } catch (error) {
    res.status(400).json({
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
        error: 'Unauthorized',
        message: 'Refresh token not provided',
      });
      return;
    }

    const tokens = await authService.refreshTokens(refreshToken);

    res.cookie('accessToken', tokens.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      message: 'Tokens refreshed successfully',
    });
  } catch (error) {
    res.status(401).json({
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
    message: 'Logged out successfully',
  });
}
