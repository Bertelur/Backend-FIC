---
name: JWT Authentication Setup with Jose
overview: Implement JWT authentication system with jose library, supporting dashboard users (with roles) and buyer profiles, using HTTP-only cookies for token storage with 7-day expiration and refresh mechanism.
todos:
  - id: install-deps
    content: Install @types/bcrypt and cookie-parser (bcrypt and jose already installed)
    status: pending
  - id: create-auth-feature-structure
    content: Create src/features/auth/ directory structure (controller, interfaces, models, repositories, routes, schema, services)
    status: pending
  - id: create-auth-models
    content: Create MongoDB models for DashboardUser and Buyer in src/features/auth/models/
    status: pending
  - id: create-auth-interfaces
    content: Create TypeScript interfaces for auth types in src/features/auth/interfaces/
    status: pending
  - id: create-auth-schemas
    content: Create validation schemas for auth requests in src/features/auth/schema/
    status: pending
  - id: create-jwt-utils
    content: Create JWT utility functions in src/utils/jwt.ts
    status: pending
  - id: create-password-utils
    content: Create password hashing utilities in src/utils/password.ts
    status: pending
  - id: create-auth-repositories
    content: Create repository layer for database operations in src/features/auth/repositories/
    status: pending
    dependencies:
      - create-auth-models
  - id: create-auth-services
    content: Create service layer for business logic in src/features/auth/services/
    status: pending
    dependencies:
      - create-auth-repositories
      - create-jwt-utils
      - create-password-utils
  - id: create-auth-middleware
    content: Create authentication and authorization middleware in src/middleware/auth.ts
    status: pending
    dependencies:
      - create-jwt-utils
  - id: create-auth-controllers
    content: Create controllers for auth endpoints in src/features/auth/controller/
    status: pending
    dependencies:
      - create-auth-services
      - create-auth-schemas
  - id: create-auth-routes
    content: Create auth routes in src/features/auth/routes/
    status: pending
    dependencies:
      - create-auth-controllers
      - create-auth-middleware
  - id: update-server
    content: Add cookie-parser middleware and mount auth routes in src/server/index.ts
    status: pending
    dependencies:
      - create-auth-routes
  - id: update-env
    content: Add JWT secret keys to .env.example
    status: pending
---

# JWT Authentication Setup with Jose

## Overview

Set up a complete authentication system with two user types (dashboard users and buyers), JWT tokens stored in HTTP-only cookies, and role-based access control for dashboard users. Following the feature-based architecture pattern.

## Project Structure

The project uses a feature-based architecture:
- `src/features/{feature-name}/` - Feature modules with layered architecture
  - `controller/` - Request handlers
  - `interfaces/` - TypeScript type definitions
  - `models/` - MongoDB document models
  - `repositories/` - Database access layer
  - `routes/` - Express route definitions
  - `schema/` - Validation schemas
  - `services/` - Business logic layer
- `src/utils/` - Shared utility functions
- `src/middleware/` - Express middleware
- `src/config/` - Configuration files
- `src/server/index.ts` - Main server entry point

## Requirements

### User Types
1. **Dashboard Users**: Username + password authentication with roles (super-admin, admin, staff, keuangan)
2. **Buyer Profiles**: Email/username + password authentication

### Token Configuration
- **accessToken**: 7 days expiration
- **refreshToken**: 7 days expiration, refreshed every 7 days
- Both tokens stored in HTTP-only cookies
- Tokens include: exp, iat, and user information

## Implementation

### 1. Install Dependencies
- Install `@types/bcrypt` for TypeScript types (bcrypt already installed)
- Install `cookie-parser` and `@types/cookie-parser` for cookie handling
- `jose` is already installed

### 2. Create Auth Feature Structure
Create `src/features/auth/` with all required directories:
- `controller/` - Auth controllers
- `interfaces/` - Type definitions
- `models/` - MongoDB models
- `repositories/` - Database repositories
- `routes/` - Route definitions
- `schema/` - Validation schemas
- `services/` - Business logic

### 3. Auth Models (`src/features/auth/models/`)
- `DashboardUser.ts` - Dashboard user model with username, password, role
- `Buyer.ts` - Buyer model with email, username, password

### 4. Auth Interfaces (`src/features/auth/interfaces/`)
- `auth.types.ts` - Type definitions for:
  - User types (DashboardUser, Buyer)
  - Token payloads
  - Request/Response types
  - Role types

### 5. Auth Schemas (`src/features/auth/schema/`)
- `auth.schema.ts` - Validation schemas for:
  - Login request (username/email, password, type)
  - Register request (email, username, password)
  - Refresh token request

### 6. JWT Utilities (`src/utils/jwt.ts`)
- `generateAccessToken()` - Generate access token with user info and 7-day expiry
- `generateRefreshToken()` - Generate refresh token with 7-day expiry
- `verifyToken()` - Verify and decode JWT tokens
- `verifyRefreshToken()` - Verify refresh tokens
- Token payload structure: { userId, type (dashboard/buyer), role (for dashboard), exp, iat }

### 7. Password Utilities (`src/utils/password.ts`)
- `hashPassword()` - Hash passwords using bcrypt (salt rounds: 10-12)
- `comparePassword()` - Compare plain password with hash

### 8. Auth Repositories (`src/features/auth/repositories/`)
- `dashboardUser.repository.ts` - Database operations for dashboard users
- `buyer.repository.ts` - Database operations for buyers
- Methods: create, findByUsername, findByEmail, findById

### 9. Auth Services (`src/features/auth/services/`)
- `auth.service.ts` - Business logic for:
  - Login (dashboard and buyer)
  - Register (buyer only)
  - Token refresh
  - Logout
- Handles password validation, user lookup, token generation

### 10. Authentication Middleware (`src/middleware/auth.ts`)
- `authenticateToken()` - Verify access token from HTTP-only cookie
- `requireRole()` - Role-based authorization middleware (for dashboard routes)
- Extract token from HTTP-only cookie
- Add user info to request object

### 11. Auth Controllers (`src/features/auth/controller/`)
- `auth.controller.ts` - Request handlers:
  - `login()` - Handle login requests
  - `register()` - Handle buyer registration
  - `refresh()` - Handle token refresh
  - `logout()` - Handle logout

### 12. Auth Routes (`src/features/auth/routes/`)
- `auth.routes.ts` - Express routes:
  - **POST /auth/login** - Login endpoint
  - **POST /auth/register** - Register endpoint (buyer only)
  - **POST /auth/refresh** - Refresh token endpoint
  - **POST /auth/logout** - Logout endpoint

### 13. Cookie Configuration
- HTTP-only cookies
- Secure flag (HTTPS in production)
- SameSite: 'strict' or 'lax'
- Path: '/'
- 7-day maxAge (604800 seconds)

### 14. Update Server (`src/server/index.ts`)
- Add `cookie-parser` middleware
- Mount auth routes at `/auth`
- Import from `src/features/auth/routes/auth.routes`

## Files to Create/Modify

### New Files
- `src/features/auth/models/DashboardUser.ts`
- `src/features/auth/models/Buyer.ts`
- `src/features/auth/interfaces/auth.types.ts`
- `src/features/auth/schema/auth.schema.ts`
- `src/features/auth/repositories/dashboardUser.repository.ts`
- `src/features/auth/repositories/buyer.repository.ts`
- `src/features/auth/services/auth.service.ts`
- `src/features/auth/controller/auth.controller.ts`
- `src/features/auth/routes/auth.routes.ts`
- `src/utils/jwt.ts`
- `src/utils/password.ts`
- `src/middleware/auth.ts`

### Modified Files
- `src/server/index.ts` - Add cookie-parser, mount auth routes
- `package.json` - Add @types/bcrypt, cookie-parser, @types/cookie-parser
- `.env.example` - Add JWT secret keys

## Environment Variables

Add to `.env.example`:
- `JWT_SECRET` - Secret key for signing access tokens
- `JWT_REFRESH_SECRET` - Secret key for refresh tokens (can use same as JWT_SECRET)

## Security Considerations
- Passwords hashed with bcrypt (salt rounds: 10-12)
- HTTP-only cookies prevent XSS attacks
- Secure flag for HTTPS in production
- Token expiration handling (7 days)
- Refresh token rotation on each refresh
- Role-based access control for dashboard routes

## API Endpoints

### POST /auth/login
- Body: `{ username?: string, email?: string, password: string, type: 'dashboard' | 'buyer' }`
- Response: Sets HTTP-only cookies (accessToken, refreshToken), returns user info
- Supports: Dashboard users (username) and buyers (email or username)

### POST /auth/register
- Body: `{ email: string, username: string, password: string }`
- Response: Sets HTTP-only cookies (accessToken, refreshToken), returns user info
- Only for buyers

### POST /auth/refresh
- No body required (uses refreshToken from cookie)
- Response: Sets new HTTP-only cookies (accessToken, refreshToken)

### POST /auth/logout
- No body required
- Response: Clears HTTP-only cookies
