import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../../utils/jwt';
import { comparePassword, hashPassword } from '../../../utils/password';
import { LoginRequest, RegisterRequest, AuthResponse } from '../interfaces/auth.types';
import * as dashboardUserRepo from '../repositories/dashboardUser.repository';
import * as buyerRepo from '../repositories/buyer.repository';

export async function loginDashboardUser(username: string, password: string): Promise<AuthResponse> {
  const user = await dashboardUserRepo.findDashboardUserByUsername(username);

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  const accessToken = await generateAccessToken({
    userId: user._id!,
    type: 'dashboard',
    role: user.role,
  });

  const refreshToken = await generateRefreshToken({
    userId: user._id!,
    type: 'dashboard',
    role: user.role,
  });

  return {
    user: {
      id: user._id!,
      username: user.username,
      role: user.role,
      type: 'dashboard',
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

export async function loginBuyer(emailOrUsername: string, password: string): Promise<AuthResponse> {
  const buyer = await buyerRepo.findBuyerByEmailOrUsername(emailOrUsername);

  if (!buyer) {
    throw new Error('Invalid credentials');
  }

  const isPasswordValid = await comparePassword(password, buyer.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  const accessToken = await generateAccessToken({
    userId: buyer._id!,
    type: 'buyer',
  });

  const refreshToken = await generateRefreshToken({
    userId: buyer._id!,
    type: 'buyer',
  });

  return {
    user: {
      id: buyer._id!,
      username: buyer.username,
      email: buyer.email,
      type: 'buyer',
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

export async function login(loginData: LoginRequest): Promise<AuthResponse> {
  if (loginData.type === 'dashboard') {
    if (!loginData.username) {
      throw new Error('Username is required for dashboard login');
    }
    return await loginDashboardUser(loginData.username, loginData.password);
  } else {
    const emailOrUsername = loginData.email || loginData.username;
    if (!emailOrUsername) {
      throw new Error('Email or username is required for buyer login');
    }
    return await loginBuyer(emailOrUsername, loginData.password);
  }
}

export async function registerBuyer(registerData: RegisterRequest): Promise<AuthResponse> {
  // Check if email already exists
  const existingEmail = await buyerRepo.findBuyerByEmail(registerData.email);
  if (existingEmail) {
    throw new Error('Email already registered');
  }

  // Check if username already exists
  const existingUsername = await buyerRepo.findBuyerByUsername(registerData.username);
  if (existingUsername) {
    throw new Error('Username already taken');
  }

  // Hash password
  const hashedPassword = await hashPassword(registerData.password);

  // Create buyer
  const buyer = await buyerRepo.createBuyer({
    email: registerData.email,
    username: registerData.username,
    password: hashedPassword,
  });

  // Generate tokens
  const accessToken = await generateAccessToken({
    userId: buyer._id!,
    type: 'buyer',
  });

  const refreshToken = await generateRefreshToken({
    userId: buyer._id!,
    type: 'buyer',
  });

  return {
    user: {
      id: buyer._id!,
      username: buyer.username,
      email: buyer.email,
      type: 'buyer',
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

export async function refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = await verifyRefreshToken(refreshToken);

  // Generate new tokens
  const newAccessToken = await generateAccessToken({
    userId: payload.userId,
    type: payload.type,
    role: payload.role,
  });

  const newRefreshToken = await generateRefreshToken({
    userId: payload.userId,
    type: payload.type,
    role: payload.role,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}
