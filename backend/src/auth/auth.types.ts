import type { Role, UserStatus } from '@prisma/client';

/** User shape safe to return to clients — never includes passwordHash. */
export interface SafeUser {
  id: string;
  phone: string;
  name: string;
  role: Role;
  status: UserStatus;
  email: string | null;
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
  phone: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: SafeUser;
}

/** An OTP is on its way (WhatsApp/SMS TODO; devCode surfaces it in dev). */
export interface OtpSentResponse {
  phone: string;
  requiresVerification: true;
  resendAfterSeconds: number;
  devCode?: string;
}

export type GoogleSignInResponse =
  | { status: 'SIGNED_IN'; session: LoginResponse }
  /** New Google account (or one without a verified phone): the client must
   *  collect a phone number and finish via link-phone + verify-phone. */
  | { status: 'NEEDS_PHONE'; linkToken: string; name: string; email: string };

/** Claims carried through the Google → phone-linking handshake. */
export interface GoogleLinkPayload {
  purpose: 'google-link';
  googleId: string;
  email: string;
  name: string;
}
