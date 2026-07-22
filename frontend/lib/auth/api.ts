/**
 * Unified auth client for the shared /login and /register pages.
 * Mirrors backend/src/auth/* response shapes by hand (independent packages).
 *
 * Email is BookAm's primary identity — one email, one account. Everyone
 * registers as a contributor (MEMBER) with email+password (verified by an
 * emailed code) or with Google, which links on the same email. A phone/
 * WhatsApp number is optional and verified in-app later (see the settings
 * pages), which is what claims coordinator-created circle memberships.
 */

import type {
  LoginResponse,
  OtpSentResponse,
  Role,
  SafeUser,
} from "../admin/types";

export type { LoginResponse, OtpSentResponse, SafeUser };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export class AuthApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Machine-readable code, e.g. "EMAIL_NOT_VERIFIED". */
    public readonly code?: string,
    public readonly email?: string,
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
    email?: string;
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
      data.email,
      data.devCode,
    );
  }
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    post<LoginResponse>("/auth/login", { email, password }),
  register: (name: string, email: string, password: string) =>
    post<OtpSentResponse>("/auth/register", { name, email, password }),
  verifyEmail: (email: string, code: string) =>
    post<LoginResponse>("/auth/verify-email", { email, code }),
  resendOtp: (email: string) =>
    post<OtpSentResponse>("/auth/resend-otp", { email }),
  /** Google signs in directly, creating or linking a same-email account. */
  google: (idToken: string) =>
    post<LoginResponse>("/auth/google", { idToken }),
  forgotPassword: (email: string) =>
    post<OtpSentResponse>("/auth/forgot-password", { email }),
  /** Code-verified reset; signs the user in with the new password. */
  resetPassword: (email: string, code: string, newPassword: string) =>
    post<LoginResponse>("/auth/reset-password", { email, code, newPassword }),
};

// Token keys used by each console's own API client — the unified login
// stores the session under every key the signed-in role can use, so the
// existing shells keep working untouched.
const MEMBER_TOKEN_KEY = "bookam.member.token";
const COORDINATOR_TOKEN_KEY = "bookam.coordinator.token";
const ADMIN_TOKEN_KEY = "bookam.admin.token";

/** True when this browser holds any signed-in BookAm session. */
export function isSignedIn(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MEMBER_TOKEN_KEY) !== null;
}

/** Signs out of every BookAm console in this browser. */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  for (const key of [
    MEMBER_TOKEN_KEY,
    COORDINATOR_TOKEN_KEY,
    ADMIN_TOKEN_KEY,
  ]) {
    window.localStorage.removeItem(key);
  }
}

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

// Lets a page (e.g. /become-a-collector) send visitors through /register or
// /login and get them back afterwards, instead of the role's default home.
const POST_AUTH_REDIRECT_KEY = "bookam.postAuthRedirect";

export function setPostAuthRedirect(path: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, path);
}

/** Reads and clears the stored redirect (one use only). */
export function consumePostAuthRedirect(): string | null {
  if (typeof window === "undefined") return null;
  const path = window.sessionStorage.getItem(POST_AUTH_REDIRECT_KEY);
  window.sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
  // Only same-app paths — never an absolute URL someone planted.
  return path && path.startsWith("/") && !path.startsWith("//") ? path : null;
}
