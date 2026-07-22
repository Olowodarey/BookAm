import type {
  ApplicationStatus,
  CollectorApplication,
  LoginResponse,
  OverviewMetrics,
  Paginated,
  PlanInput,
  Role,
  SafeUser,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  UserDetail,
  UserStatus,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "bookam.admin.token";

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

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const url = new URL(path, API_URL);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const token = getToken();
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "Could not reach the BookAm API — is the backend running?",
    );
  }

  if (!response.ok) {
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
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

export const adminApi = {
  // Auth
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  me: () => request<SafeUser>("/auth/me"),

  // Overview
  overview: () => request<OverviewMetrics>("/admin/overview"),

  // Collector applications
  listApplications: (params: {
    status?: ApplicationStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  }) =>
    request<Paginated<CollectorApplication>>("/admin/applications", {
      query: params,
    }),
  approveApplication: (id: string, reviewNote?: string) =>
    request<CollectorApplication>(`/admin/applications/${id}/approve`, {
      method: "POST",
      body: reviewNote ? { reviewNote } : {},
    }),
  rejectApplication: (id: string, reviewNote?: string) =>
    request<CollectorApplication>(`/admin/applications/${id}/reject`, {
      method: "POST",
      body: reviewNote ? { reviewNote } : {},
    }),

  // Subscription plans
  listPlans: () => request<SubscriptionPlan[]>("/admin/plans"),
  createPlan: (input: PlanInput) =>
    request<SubscriptionPlan>("/admin/plans", { method: "POST", body: input }),
  updatePlan: (id: string, input: Partial<PlanInput>) =>
    request<SubscriptionPlan>(`/admin/plans/${id}`, {
      method: "PATCH",
      body: input,
    }),
  deletePlan: (id: string) =>
    request<{ deleted: boolean; plan: SubscriptionPlan }>(
      `/admin/plans/${id}`,
      { method: "DELETE" },
    ),

  // Subscriptions
  listSubscriptions: (params: {
    status?: SubscriptionStatus;
    page?: number;
    pageSize?: number;
  }) =>
    request<Paginated<Subscription>>("/admin/subscriptions", {
      query: params,
    }),
  updateSubscriptionStatus: (id: string, status: SubscriptionStatus) =>
    request<Subscription>(`/admin/subscriptions/${id}/status`, {
      method: "PATCH",
      body: { status },
    }),

  // Users
  listUsers: (params: {
    search?: string;
    status?: UserStatus;
    role?: Role;
    page?: number;
    pageSize?: number;
  }) => request<Paginated<SafeUser>>("/admin/users", { query: params }),
  getUser: (id: string) => request<UserDetail>(`/admin/users/${id}`),
  suspendUser: (id: string) =>
    request<SafeUser>(`/admin/users/${id}/suspend`, { method: "POST" }),
  reactivateUser: (id: string) =>
    request<SafeUser>(`/admin/users/${id}/reactivate`, { method: "POST" }),
};

export const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString("en-NG")}`;

export const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
