import type {
  CircleDetail,
  CircleSummary,
  CompletePayoutResult,
  ContributionInfo,
  CreateCircleInput,
  InviteLinkResponse,
  InvitePreview,
  LoginResponse,
  MemberInfo,
  OtpSentResponse,
  PayoutInfo,
  ProfileInput,
  ReminderInfo,
  SafeUser,
} from "./types";
// Type-only import; appeals are shared domain between member + coordinator.
import type { AppealInfo } from "../member/types";

export { formatDate, formatNaira } from "../admin/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
// Separate from the admin token so an alajo and the platform owner can be
// signed in side by side in the same browser.
const TOKEN_KEY = "bookam.coordinator.token";

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

export const coordinatorApi = {
  // Auth (same endpoints as the admin console; role must be COORDINATOR)
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  me: () => request<SafeUser>("/auth/me"),

  // Settings (shared /auth endpoints, this dashboard's token)
  updateProfile: (input: ProfileInput) =>
    request<SafeUser>("/auth/profile", { method: "PATCH", body: input }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ changed: true }>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),

  // Optional in-app WhatsApp/phone verification (claims memberships by number).
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

  // Circles
  listCircles: () => request<CircleSummary[]>("/circles"),
  createCircle: (input: CreateCircleInput) =>
    request<CircleSummary>("/circles", { method: "POST", body: input }),
  circleDetail: (id: string) => request<CircleDetail>(`/circles/${id}`),

  // Members
  addMember: (circleId: string, input: { name: string; phone: string }) =>
    request<MemberInfo>(`/circles/${circleId}/members`, {
      method: "POST",
      body: input,
    }),
  removeMember: (circleId: string, membershipId: string) =>
    request<{ removed: true }>(
      `/circles/${circleId}/members/${membershipId}`,
      { method: "DELETE" },
    ),
  reorderMembers: (circleId: string, orderedMembershipIds: string[]) =>
    request<MemberInfo[]>(`/circles/${circleId}/members/order`, {
      method: "PATCH",
      body: { orderedMembershipIds },
    }),

  // Invite link
  generateInvite: (circleId: string) =>
    request<InviteLinkResponse>(`/circles/${circleId}/invite`, {
      method: "POST",
    }),
  disableInvite: (circleId: string) =>
    request<{ disabled: true }>(`/circles/${circleId}/invite`, {
      method: "DELETE",
    }),

  // Contribution receipts
  uploadContributionReceipt: (
    circleId: string,
    contributionId: string,
    file: File,
  ) =>
    upload<ContributionInfo>(
      `/circles/${circleId}/contributions/${contributionId}/receipt`,
      file,
    ),
  verifyContribution: (circleId: string, contributionId: string) =>
    request<ContributionInfo>(
      `/circles/${circleId}/contributions/${contributionId}/verify`,
      { method: "POST" },
    ),
  rejectContribution: (
    circleId: string,
    contributionId: string,
    reason: string,
  ) =>
    request<ContributionInfo>(
      `/circles/${circleId}/contributions/${contributionId}/reject`,
      { method: "POST", body: { reason } },
    ),

  // Payout
  uploadPayoutReceipt: (circleId: string, file: File) =>
    upload<PayoutInfo>(`/circles/${circleId}/payout/receipt`, file),
  completePayout: (circleId: string) =>
    request<CompletePayoutResult>(`/circles/${circleId}/payout/complete`, {
      method: "POST",
    }),

  // Reminders
  reminders: (circleId: string) =>
    request<ReminderInfo>(`/circles/${circleId}/reminders`),

  // Appeals (members vote; the coordinator decides)
  listAppeals: (circleId: string) =>
    request<AppealInfo[]>(`/circles/${circleId}/appeals`),
  approveAppeal: (circleId: string, appealId: string, outcomeNote?: string) =>
    request<AppealInfo>(`/circles/${circleId}/appeals/${appealId}/approve`, {
      method: "POST",
      body: outcomeNote ? { outcomeNote } : {},
    }),
  rejectAppeal: (circleId: string, appealId: string, outcomeNote?: string) =>
    request<AppealInfo>(`/circles/${circleId}/appeals/${appealId}/reject`, {
      method: "POST",
      body: outcomeNote ? { outcomeNote } : {},
    }),

  // Public invite flow (no token needed)
  invitePreview: (token: string) =>
    request<InvitePreview>(`/invite/${token}`),
  joinCircle: (token: string, input: { name: string; phone: string }) =>
    request<{ joined: true; circleName: string }>(`/invite/${token}/join`, {
      method: "POST",
      body: input,
    }),
};

export const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};
