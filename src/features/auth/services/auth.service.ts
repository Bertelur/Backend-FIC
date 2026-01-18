import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../../utils/jwt.js';
import { comparePassword, hashPassword } from '../../../utils/password.js';
import { LoginRequest, RegisterRequest, AuthResponse, Address } from '../interfaces/auth.types.js';
import * as dashboardUserRepo from '../repositories/dashboardUser.repository.js';
import * as buyerRepo from '../repositories/buyer.repository.js';

function nowNs(): bigint {
  return process.hrtime.bigint();
}

function nsToMs(ns: bigint): number {
  return Number(ns) / 1_000_000;
}

function shouldDebugTiming(): boolean {
  return process.env.AUTH_DEBUG_TIMING === '1' || process.env.AUTH_DEBUG_TIMING === 'true';
}

export async function loginDashboardUser(username: string, password: string): Promise<AuthResponse> {
  const debug = shouldDebugTiming();
  const t0 = debug ? nowNs() : 0n;
  const tDb0 = debug ? nowNs() : 0n;
  const user = await dashboardUserRepo.findDashboardUserByUsername(username);
  const tDb1 = debug ? nowNs() : 0n;

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const tBcrypt0 = debug ? nowNs() : 0n;
  const isPasswordValid = await comparePassword(password, user.password);
  const tBcrypt1 = debug ? nowNs() : 0n;
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  const tJwt0 = debug ? nowNs() : 0n;
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
  const tJwt1 = debug ? nowNs() : 0n;

  if (debug) {
    console.log('[AUTH_TIMING] dashboard login', {
      dbMs: nsToMs(tDb1 - tDb0).toFixed(2),
      bcryptMs: nsToMs(tBcrypt1 - tBcrypt0).toFixed(2),
      jwtMs: nsToMs(tJwt1 - tJwt0).toFixed(2),
      totalMs: nsToMs(tJwt1 - t0).toFixed(2),
    });
  }

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
  const debug = shouldDebugTiming();
  const t0 = debug ? nowNs() : 0n;
  const tDb0 = debug ? nowNs() : 0n;
  const buyer = await buyerRepo.findBuyerByEmailOrUsername(emailOrUsername);
  const tDb1 = debug ? nowNs() : 0n;

  if (!buyer) {
    throw new Error('Invalid credentials');
  }

  const tBcrypt0 = debug ? nowNs() : 0n;
  const isPasswordValid = await comparePassword(password, buyer.password);
  const tBcrypt1 = debug ? nowNs() : 0n;
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  const tJwt0 = debug ? nowNs() : 0n;
  const accessToken = await generateAccessToken({
    userId: buyer._id!,
    type: 'buyer',
  });

  const refreshToken = await generateRefreshToken({
    userId: buyer._id!,
    type: 'buyer',
  });
  const tJwt1 = debug ? nowNs() : 0n;

  if (debug) {
    console.log('[AUTH_TIMING] buyer login', {
      dbMs: nsToMs(tDb1 - tDb0).toFixed(2),
      bcryptMs: nsToMs(tBcrypt1 - tBcrypt0).toFixed(2),
      jwtMs: nsToMs(tJwt1 - tJwt0).toFixed(2),
      totalMs: nsToMs(tJwt1 - t0).toFixed(2),
    });
  }

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
  // Backward compatibility: if type is explicitly sent, honor it.
  if (loginData.type === 'dashboard') {
    if (!loginData.username) throw new Error('Username is required for dashboard login');
    return await loginDashboardUser(loginData.username, loginData.password);
  }
  if (loginData.type === 'buyer') {
    const emailOrUsername = loginData.email || loginData.username;
    if (!emailOrUsername) throw new Error('Email or username is required for buyer login');
    return await loginBuyer(emailOrUsername, loginData.password);
  }

  // New behavior: infer type automatically
  if (loginData.email) {
    return await loginBuyer(loginData.email, loginData.password);
  }

  const username = loginData.username;
  if (!username) {
    throw new Error('Email or username is required');
  }

  const dashboardUser = await dashboardUserRepo.findDashboardUserByUsername(username);
  if (dashboardUser) {
    // If a dashboard user exists for this username, do NOT fall back to buyer.
    // This prevents ambiguous logins when buyer+dashboard share a username.
    return await loginDashboardUser(username, loginData.password);
  }

  return await loginBuyer(username, loginData.password);
}

export async function registerBuyer(registerData: RegisterRequest): Promise<AuthResponse> {
  // Check if email already exists
  if (!registerData.email) {
    throw new Error('Email is required');
  }

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

export async function registerDashboardUser(input: {
  username: string;
  password: string;
  role: string;
}): Promise<AuthResponse> {
  const username = input.username.trim();
  if (!username) {
    throw new Error('Username is required');
  }

  const existingUser = await dashboardUserRepo.findDashboardUserByUsername(username);
  if (existingUser) {
    throw new Error('Username already exists');
  }

  const validRoles = ['super-admin', 'admin', 'staff', 'keuangan'] as const;
  if (!validRoles.includes(input.role as any)) {
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }
  const role = input.role as (typeof validRoles)[number];

  const hashedPassword = await hashPassword(input.password);

  const user = await dashboardUserRepo.createDashboardUser({
    username,
    password: hashedPassword,
    role,
  });

  const accessToken = await generateAccessToken({
    userId: user._id!,
    type: 'dashboard',
    role,
  });

  const refreshToken = await generateRefreshToken({
    userId: user._id!,
    type: 'dashboard',
    role,
  });

  return {
    user: {
      id: user._id!,
      username: user.username,
      role,
      type: 'dashboard',
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

export async function updateAddress(userId: string, address: Address): Promise<void> {
  await buyerRepo.updateBuyerAddress(userId, address);
}
