import type { Role, UserStatus } from '@prisma/client';

/** User shape safe to return to clients — never includes passwordHash. */
export interface SafeUser {
  id: string;
  /** Primary identity — always present, always unique. */
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  /** Optional WhatsApp/phone number, verified in-app to claim circles. */
  phone: string | null;
  phoneVerifiedAt: Date | null;
  /** Second phone number (e.g. the one the circle also knows). */
  altPhone: string | null;
  // Where money should be sent to this person OUTSIDE BookAm — a record
  // shown to their circles, never an in-app payment destination.
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  createdAt: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: SafeUser;
}

/** A one-time code is on its way (dev builds surface it as devCode). */
export interface OtpSentResponse {
  requiresVerification: true;
  resendAfterSeconds: number;
  devCode?: string;
}
