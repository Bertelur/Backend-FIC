import * as jose from "jose";
import {
  TokenPayload,
  UserRole,
  UserType,
} from "../features/auth/interfaces/auth.types";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

const ACCESS_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

export interface TokenGenerationPayload {
  userId: string;
  type: UserType;
  role?: UserRole;
}

export async function generateAccessToken(
  payload: TokenGenerationPayload
): Promise<string> {
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
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_EXPIRY)
    .sign(secret);

  return token;
}

export async function generateRefreshToken(
  payload: TokenGenerationPayload
): Promise<string> {
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
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TOKEN_EXPIRY)
    .sign(secret);

  return token;
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const secret = new TextEncoder().encode(JWT_SECRET);

  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  const secret = new TextEncoder().encode(JWT_REFRESH_SECRET);

  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
}
