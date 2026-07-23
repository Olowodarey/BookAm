"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark } from "@/components/landing/Nav";
import { adminApi, setToken, ApiError } from "@/lib/admin/api";
import { clearSession } from "@/lib/auth/api";
import type { SafeUser } from "@/lib/admin/types";
import { Spinner } from "./ui";

const AdminUserContext = createContext<SafeUser | null>(null);

export function useAdminUser(): SafeUser {
  const user = useContext(AdminUserContext);
  if (!user) throw new Error("useAdminUser must be used inside AdminShell");
  return user;
}

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: "M3 3h6v8H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 13h6v4H3z" },
  { label: "Collector requests", href: "/admin/applications", icon: "M10 3a3 3 0 110 6 3 3 0 010-6zM4 17c0-3 2.7-5 6-5s6 2 6 5M14 6l2 2 3-3" },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: "M3 5h14v10H3zM3 8h14M6 12h4" },
  { label: "Users", href: "/admin/users", icon: "M7 4a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM13 5a2 2 0 110 4M2.5 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M12.5 12.5c2 .2 4 1.5 4 3.5" },
  { label: "Waitlist", href: "/admin/waitlist", icon: "M3 5h14v10H3zM3 5l7 5 7-5" },
  { label: "Settings", href: "/admin/settings", icon: "M10 7a3 3 0 110 6 3 3 0 010-6zM10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5L6 6M14 14l1.5 1.5M15.5 4.5L14 6M6 14l-1.5 1.5" },
] as const;

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .me()
      .then((me) => {
        if (cancelled) return;
        if (me.role !== "ADMIN") {
          // Signed in but not the platform admin — no access here.
          setToken(null);
          router.replace("/admin/login");
          return;
        }
        setUser(me);
        setChecking(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setToken(null);
        }
        router.replace("/admin/login");
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
    clearSession();
    router.replace("/");
  };

  return (
    <AdminUserContext.Provider value={user}>
      <div className="flex min-h-dvh bg-paper">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-green-deep text-paper md:flex">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 border-b border-paper/10 px-5 py-4.5"
          >
            <LogoMark />
            <span className="font-display text-lg font-bold tracking-tight">
              BookAm
            </span>
            <span className="ml-auto rounded-md bg-gold/20 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-gold">
              Admin
            </span>
          </Link>
          <nav aria-label="Admin" className="flex-1 space-y-1 px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-paper/10 text-gold"
                      : "text-paper/70 hover:bg-paper/5 hover:text-paper"
                  }`}
                >
                  <NavIcon d={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-paper/10 px-5 py-4 text-xs text-paper/50">
            Platform owner console
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col md:pl-60">
          <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2.5 md:hidden">
                <LogoMark />
                <span className="font-display text-base font-bold">
                  BookAm Admin
                </span>
              </div>
              <div className="hidden text-sm text-muted md:block">
                Signed in as{" "}
                <span className="font-semibold text-ink">{user.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted">
                  {user.email}
                </span>
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
              aria-label="Admin sections"
              className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 md:hidden"
            >
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                      active
                        ? "bg-green text-paper"
                        : "text-ink/70 hover:bg-ink/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </AdminUserContext.Provider>
  );
}
