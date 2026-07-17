"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark } from "@/components/landing/Nav";
import { ApiError, coordinatorApi, setToken } from "@/lib/dashboard/api";
import type { CircleSummary, SafeUser } from "@/lib/dashboard/types";
import { Spinner } from "@/components/admin/ui";

interface DashboardContextValue {
  user: SafeUser;
  circles: CircleSummary[];
  refreshCircles: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside DashboardShell");
  return value;
}

const CIRCLE_NAV = [
  { label: "Overview", segment: "" },
  { label: "Members", segment: "members" },
  { label: "Contributions", segment: "contributions" },
  { label: "Payout", segment: "payout" },
] as const;

/** Extracts the circle id from /dashboard/circles/[id]/... paths. */
function circleIdFromPath(pathname: string): string | null {
  const match = /^\/dashboard\/circles\/([^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [checking, setChecking] = useState(true);

  const refreshCircles = useCallback(async () => {
    setCircles(await coordinatorApi.listCircles());
  }, []);

  useEffect(() => {
    let cancelled = false;
    coordinatorApi
      .me()
      .then(async (me) => {
        if (cancelled) return;
        if (me.role !== "COORDINATOR") {
          // Signed in but not an alajo — this workspace is not for them.
          setToken(null);
          router.replace("/login");
          return;
        }
        const list = await coordinatorApi.listCircles();
        if (cancelled) return;
        setUser(me);
        setCircles(list);
        setChecking(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setToken(null);
        }
        router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <Spinner label="Checking access…" />
      </div>
    );
  }

  const signOut = () => {
    setToken(null);
    router.replace("/login");
  };

  const activeCircleId = circleIdFromPath(pathname);
  const activeCircle = circles.find((c) => c.id === activeCircleId) ?? null;

  const switchCircle = (id: string) => {
    // Keep the current sub-screen (members/contributions/payout) if any.
    const segment = activeCircleId
      ? pathname.slice(`/dashboard/circles/${activeCircleId}`.length)
      : "";
    router.push(`/dashboard/circles/${id}${segment}`);
  };

  const circleNav = (mobile: boolean) =>
    activeCircleId ? (
      <>
        {CIRCLE_NAV.map((item) => {
          const href = `/dashboard/circles/${activeCircleId}${
            item.segment ? `/${item.segment}` : ""
          }`;
          const active = pathname === href;
          return (
            <Link
              key={item.segment}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                mobile
                  ? `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                      active ? "bg-green text-paper" : "text-ink/70 hover:bg-ink/5"
                    }`
                  : `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-paper/10 text-gold"
                        : "text-paper/70 hover:bg-paper/5 hover:text-paper"
                    }`
              }
            >
              {item.label}
            </Link>
          );
        })}
      </>
    ) : null;

  return (
    <DashboardContext.Provider value={{ user, circles, refreshCircles }}>
      <div className="flex min-h-dvh bg-paper">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-green-deep text-paper md:flex">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 border-b border-paper/10 px-5 py-4.5"
          >
            <LogoMark />
            <span className="font-display text-lg font-bold tracking-tight">
              BookAm
            </span>
            <span className="ml-auto rounded-md bg-gold/20 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-gold">
              Alajo
            </span>
          </Link>

          <nav aria-label="Coordinator" className="flex-1 space-y-1 px-3 py-4">
            <Link
              href="/dashboard"
              aria-current={pathname === "/dashboard" ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === "/dashboard"
                  ? "bg-paper/10 text-gold"
                  : "text-paper/70 hover:bg-paper/5 hover:text-paper"
              }`}
            >
              My circles
            </Link>

            {activeCircleId ? (
              <div className="pt-3">
                <label className="block px-3 pb-1 font-mono text-[10px] font-bold uppercase tracking-wide text-paper/50">
                  Circle
                  <select
                    value={activeCircleId}
                    onChange={(e) => switchCircle(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-paper/20 bg-green-deep px-2 py-1.5 font-sans text-sm font-medium normal-case tracking-normal text-paper"
                  >
                    {circles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-2 space-y-1">{circleNav(false)}</div>
              </div>
            ) : null}
          </nav>
          <div className="border-t border-paper/10 px-5 py-4 text-xs text-paper/50">
            Coordinator workspace
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col md:pl-60">
          <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2.5 md:hidden">
                <LogoMark />
                <span className="font-display text-base font-bold">
                  {activeCircle ? activeCircle.name : "BookAm"}
                </span>
              </div>
              <div className="hidden text-sm text-muted md:block">
                Signed in as{" "}
                <span className="font-semibold text-ink">{user.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted">{user.phone}</span>
                <button
                  onClick={signOut}
                  className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-ink/70 transition-colors hover:border-green hover:text-green"
                >
                  Sign out
                </button>
              </div>
            </div>
            {/* Mobile nav */}
            <nav
              aria-label="Circle sections"
              className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 md:hidden"
            >
              <Link
                href="/dashboard"
                aria-current={pathname === "/dashboard" ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  pathname === "/dashboard"
                    ? "bg-green text-paper"
                    : "text-ink/70 hover:bg-ink/5"
                }`}
              >
                My circles
              </Link>
              {circleNav(true)}
            </nav>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
