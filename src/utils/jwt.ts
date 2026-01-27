import * as jose from 'jose';
import { TokenPayload, UserRole, UserType } from '../features/auth/interfaces/auth.types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

const ACCESS_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

const VALID_USER_TYPES: UserType[] = ['dashboard', 'buyer'];
const VALID_USER_ROLES: UserRole[] = ['super-admin', 'staff'];

/**
 * Normalize and validate JWT payload structure at runtime.
 * Accepts some legacy/common claim names to reduce false negatives.
 */
function coerceNumericDate(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Some systems store exp/iat in ms; convert if it looks like ms.
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed > 10_000_000_000 ? Math.floor(parsed / 1000) : Math.floor(parsed);
    }
  }

  return undefined;
}

function normalizeUserIdClaim(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return undefined;
  }

  // Handle legacy/accidental serialization of Mongo ObjectId-like shapes into JWT.
  // Example seen in the wild: { buffer: { '0': 105, ..., '11': 142 } }
  const maybeBuffer = (value as any).buffer;
  if (maybeBuffer) {
    let bytes: number[] = [];

    if (maybeBuffer instanceof Uint8Array) {
      bytes = Array.from(maybeBuffer);
    } else if (Array.isArray(maybeBuffer)) {
      bytes = maybeBuffer.map((n) => Number(n));
    } else if (typeof maybeBuffer === 'object') {
      const numericKeys = Object.keys(maybeBuffer)
        .filter((k) => /^\d+$/.test(k))
        .sort((a, b) => Number(a) - Number(b));

      bytes = numericKeys.map((k) => Number((maybeBuffer as any)[k]));
    }

    if (
      bytes.length === 12 &&
      bytes.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    ) {
      return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  }

  // Fallback: try toString (covers real ObjectId instances, etc.)
  if (typeof (value as any).toString === 'function') {
    const asString = String((value as any).toString());
    const trimmed = asString.trim();
    // Avoid accepting default object stringification
    if (trimmed.length > 0 && trimmed !== '[object Object]') {
      return trimmed;
    }
  }

  return undefined;
}

function normalizeTokenPayload(payload: jose.JWTPayload): TokenPayload | null {
  const anyPayload = payload as any;

  const userId =
    normalizeUserIdClaim(anyPayload.userId) ||
    normalizeUserIdClaim(payload.sub) ||
    normalizeUserIdClaim(anyPayload.id);

  const typeCandidate =
    typeof anyPayload.type === 'string'
      ? anyPayload.type
      : typeof anyPayload.userType === 'string'
        ? anyPayload.userType
        : undefined;

  const type = VALID_USER_TYPES.includes(typeCandidate as UserType) ? (typeCandidate as UserType) : undefined;

  const roleCandidate =
    typeof anyPayload.role === 'string'
      ? anyPayload.role
      : typeof anyPayload.userRole === 'string'
        ? anyPayload.userRole
        : undefined;
  const role = roleCandidate && VALID_USER_ROLES.includes(roleCandidate as UserRole) ? (roleCandidate as UserRole) : undefined;

  const iat = coerceNumericDate(payload.iat);
  const exp = coerceNumericDate(payload.exp);

  if (!userId || !type || !exp) {
    return null;
  }

  // Keep iat required in our app contract, but tolerate missing iat in legacy tokens.
  const normalizedIat = iat ?? Math.floor(Date.now() / 1000);

  // If a role is present but invalid, treat payload as invalid.
  if (roleCandidate !== undefined && role === undefined) {
    return null;
  }

  return {
    userId,
    type,
    role,
    iat: normalizedIat,
    exp,
  };
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
    userId: normalizeUserIdClaim(payload.userId) ?? String(payload.userId),
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
    userId: normalizeUserIdClaim(payload.userId) ?? String(payload.userId),
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

    const normalized = normalizeTokenPayload(payload);
    if (!normalized) {
      throw new Error('Invalid token: payload structure is invalid');
    }

    return normalized;
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

    const normalized = normalizeTokenPayload(payload);
    if (!normalized) {
      throw new Error('Invalid refresh token: payload structure is invalid');
    }

    return normalized;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid or expired refresh token: ${error.message}`);
    }
    throw new Error('Invalid or expired refresh token');
  }
}
