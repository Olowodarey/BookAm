import type {
  AppealInfo,
  LoginResponse,
  MemberCircleDetail,
  MyCircleCard,
  MyCollectorApplication,
  MyContribution,
  OtpSentResponse,
  ProfileInput,
  SafeUser,
  VoteValue,
} from "./types";

export { formatDate, formatNaira } from "../admin/api";
export { FREQUENCY_LABEL } from "../dashboard/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
// Separate from the admin/coordinator tokens so the same browser can hold
// several BookAm sessions side by side.
const TOKEN_KEY = "bookam.member.token";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

/** Absolute URL for a stored receipt path like "/uploads/x.png". */
export function fileUrl(path: string): string {
  return new URL(path, API_URL).toString();
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (data.message) {
      message = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message;
    }
  } catch {
    // keep default message
  }
  return new ApiError(response.status, message);
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(new URL(path, API_URL), init);
  } catch {
    throw new ApiError(
      0,
      "Could not reach the BookAm API — is the backend running?",
    );
  }
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}

function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken();
  return send<T>(path, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/** Multipart upload — the browser sets the Content-Type boundary itself. */
function upload<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const body = new FormData();
  body.append("file", file);
  return send<T>(path, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });
}

export const memberApi = {
  // Auth (same endpoints as the other consoles; any signed-in user may have
  // memberships — even coordinators save in other people's circles)
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  me: () => request<SafeUser>("/auth/me"),

  // My circles (read)
  // Settings (shared /auth endpoints, this dashboard's token)
  updateProfile: (input: ProfileInput) =>
    request<SafeUser>("/auth/profile", { method: "PATCH", body: input }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ changed: true }>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),

  // Optional in-app WhatsApp/phone verification — claims circle memberships a
  // coordinator added by that number. Returns the updated user.
  sendPhoneOtp: (phone: string) =>
    request<OtpSentResponse>("/auth/phone/send-otp", {
      method: "POST",
      body: { phone },
    }),
  verifyPhone: (phone: string, code: string) =>
    request<SafeUser>("/auth/phone/verify", {
      method: "POST",
      body: { phone, code },
    }),

  myCircles: () => request<MyCircleCard[]>("/member/circles"),
  circleDetail: (circleId: string) =>
    request<MemberCircleDetail>(`/member/circles/${circleId}`),

  // My one write action: my own receipt for the open round
  uploadMyReceipt: (circleId: string, file: File) =>
    upload<MyContribution>(`/member/circles/${circleId}/receipt`, file),

  // Become a collector (reviewed by the platform admin)
  myCollectorApplication: () =>
    request<MyCollectorApplication | null>("/member/collector-application"),
  applyCollector: (note: string) =>
    request<MyCollectorApplication>("/member/collector-application", {
      method: "POST",
      body: { note },
    }),

  // Appeals + advisory voting
  listAppeals: (circleId: string) =>
    request<AppealInfo[]>(`/member/circles/${circleId}/appeals`),
  createAppeal: (circleId: string, reason: string) =>
    request<AppealInfo>(`/member/circles/${circleId}/appeals`, {
      method: "POST",
      body: { reason },
    }),
  withdrawAppeal: (appealId: string) =>
    request<AppealInfo>(`/member/appeals/${appealId}/withdraw`, {
      method: "POST",
    }),
  vote: (appealId: string, value: VoteValue) =>
    request<AppealInfo>(`/member/appeals/${appealId}/vote`, {
      method: "PUT",
      body: { value },
    }),
};
