import * as jose from 'jose';
import { TokenPayload, UserRole, UserType } from '../features/auth/interfaces/auth.types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

const ACCESS_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

const VALID_USER_TYPES: UserType[] = ['dashboard', 'buyer'];
const VALID_USER_ROLES: UserRole[] = ['super-admin', 'admin', 'staff', 'keuangan'];

/**
 * Type guard function to validate JWT payload structure at runtime
 * Prevents security vulnerabilities from malformed or malicious tokens
 */
function isTokenPayload(payload: any): payload is TokenPayload {
  // Check required fields exist and have correct types
  if (typeof payload.userId !== 'string' || payload.userId.length === 0 || typeof payload.type !== 'string' || typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
    return false;
  }

  // Validate user type
  if (!VALID_USER_TYPES.includes(payload.type as UserType)) {
    return false;
  }

  // Validate role if present (required for dashboard users)
  if (payload.role !== undefined) {
    if (typeof payload.role !== 'string' || !VALID_USER_ROLES.includes(payload.role as UserRole)) {
      return false;
    }
  }

  // Validate numeric fields are valid numbers
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
    return false;
  }

  return true;
}

export interface TokenGenerationPayload {
  userId: string;
  type: UserType;
  role?: UserRole;
}

export async function generateAccessToken(payload: TokenGenerationPayload): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);

  const jwtPayload: jose.JWTPayload = {
    userId: payload.userId,
    type: payload.type,
    role: payload.role,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY,
  };

  const token = await new jose.SignJWT(jwtPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_EXPIRY)
    .sign(secret);

  return token;
}

export async function generateRefreshToken(payload: TokenGenerationPayload): Promise<string> {
  const secret = new TextEncoder().encode(JWT_REFRESH_SECRET);
  const now = Math.floor(Date.now() / 1000);

  const jwtPayload: jose.JWTPayload = {
    userId: payload.userId,
    type: payload.type,
    role: payload.role,
    iat: now,
    exp: now + REFRESH_TOKEN_EXPIRY,
  };

  const token = await new jose.SignJWT(jwtPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TOKEN_EXPIRY)
    .sign(secret);

  return token;
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  // Validate token string
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Invalid token: token is required');
  }

  const secret = new TextEncoder().encode(JWT_SECRET);

  try {
    const { payload } = await jose.jwtVerify(token, secret);

    // Validate payload structure using type guard
    if (!isTokenPayload(payload)) {
      throw new Error('Invalid token: payload structure is invalid');
    }

    return payload;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid or expired token: ${error.message}`);
    }
    throw new Error('Invalid or expired token');
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  // Validate token string
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Invalid refresh token: token is required');
  }

  const secret = new TextEncoder().encode(JWT_REFRESH_SECRET);

  try {
    const { payload } = await jose.jwtVerify(token, secret);

    // Validate payload structure using type guard
    if (!isTokenPayload(payload)) {
      throw new Error('Invalid refresh token: payload structure is invalid');
    }

    return payload;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid or expired refresh token: ${error.message}`);
    }
    throw new Error('Invalid or expired refresh token');
  }
}
