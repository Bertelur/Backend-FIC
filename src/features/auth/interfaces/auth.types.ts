export type UserRole = "super-admin" | "admin" | "staff" | "keuangan";
export type UserType = "dashboard" | "buyer";

export interface DashboardUser {
  _id?: string;
  username: string;
  password: string;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Address {
  street: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
}

export interface Buyer {
  _id?: string;
  email: string;
  username: string;
  password: string;
  address?: Address;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TokenPayload {
  userId: string;
  type: UserType;
  role?: UserRole;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  username?: string;
  email?: string;
  password: string;
  type?: UserType;
}

export interface RegisterRequest {
  type?: UserType;
  email?: string;
  username: string;
  password: string;
  role?: UserRole;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email?: string;
    role?: UserRole;
    type: UserType;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}
