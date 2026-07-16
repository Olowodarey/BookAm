import type { Role, UserStatus } from '@prisma/client';

/** User shape safe to return to clients — never includes passwordHash. */
export interface SafeUser {
  id: string;
  phone: string;
  name: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
}

export interface JwtPayload {
  sub: string;
  phone: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: SafeUser;
}
