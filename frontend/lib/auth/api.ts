/**
 * Unified auth client for the shared /login and /register pages.
 * Mirrors backend/src/auth/* response shapes by hand (independent packages).
 *
 * Everyone registers as a contributor (MEMBER); collector comes later via an
 * application the platform admin approves. Phones are OTP-verified because
 * the phone number is what ties an account to WhatsApp-group memberships.
 */

import type { LoginResponse, Role, SafeUser } from "../admin/types";

export type { LoginResponse, SafeUser };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** An OTP is on its way (dev builds surface the code as devCode). */
export interface OtpSentResponse {
  phone: string;
  requiresVerification: true;
  resendAfterSeconds: number;
  devCode?: string;
}

export type GoogleSignInResponse =
  | { status: "SIGNED_IN"; session: LoginResponse }
  | { status: "NEEDS_PHONE"; linkToken: string; name: string; email: string };

export class AuthApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Machine-readable code, e.g. "PHONE_NOT_VERIFIED". */
    public readonly code?: string,
    public readonly phone?: string,
    public readonly devCode?: string,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(new URL(path, API_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthApiError(
      0,
      "Could not reach the BookAm API — is the backend running?",
    );
  }
  const data = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
    code?: string;
    phone?: string;
    devCode?: string;
  };
  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : (data.message ?? `Request failed (${response.status})`);
    throw new AuthApiError(
      response.status,
      message,
      data.code,
      data.phone,
      data.devCode,
    );
  }
  return data as T;
}

export const authApi = {
  login: (phone: string, password: string) =>
    post<LoginResponse>("/auth/login", { phone, password }),
  register: (name: string, phone: string, password: string) =>
    post<OtpSentResponse>("/auth/register", { name, phone, password }),
  verifyPhone: (phone: string, code: string, linkToken?: string) =>
    post<LoginResponse>("/auth/verify-phone", {
      phone,
      code,
      ...(linkToken ? { linkToken } : {}),
    }),
  resendOtp: (phone: string) =>
    post<OtpSentResponse>("/auth/resend-otp", { phone }),
  google: (idToken: string) =>
    post<GoogleSignInResponse>("/auth/google", { idToken }),
  googleLinkPhone: (linkToken: string, phone: string) =>
    post<OtpSentResponse>("/auth/google/link-phone", { linkToken, phone }),
};

// Token keys used by each console's own API client — the unified login
// stores the session under every key the signed-in role can use, so the
// existing shells keep working untouched.
const MEMBER_TOKEN_KEY = "bookam.member.token";
const COORDINATOR_TOKEN_KEY = "bookam.coordinator.token";
const ADMIN_TOKEN_KEY = "bookam.admin.token";

export function storeSession(session: LoginResponse): void {
  if (typeof window === "undefined") return;
  const { accessToken, user } = session;
  // Everyone is (at least) a contributor.
  window.localStorage.setItem(MEMBER_TOKEN_KEY, accessToken);
  if (user.role === "COORDINATOR") {
    window.localStorage.setItem(COORDINATOR_TOKEN_KEY, accessToken);
  }
  if (user.role === "ADMIN") {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, accessToken);
  }
}

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "COORDINATOR":
      return "/dashboard";
    default:
      return "/me";
  }
}
