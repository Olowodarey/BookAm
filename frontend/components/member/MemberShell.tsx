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
import { ApiError, memberApi, setToken } from "@/lib/member/api";
import type { MyCircleCard, SafeUser } from "@/lib/member/types";
import { Spinner } from "@/components/admin/ui";

interface MemberContextValue {
  user: SafeUser;
  circles: MyCircleCard[];
  refreshCircles: () => Promise<void>;
}

const MemberContext = createContext<MemberContextValue | null>(null);

export function useMember(): MemberContextValue {
  const value = useContext(MemberContext);
  if (!value) throw new Error("useMember must be used inside MemberShell");
  return value;
}

const CIRCLE_NAV = [
  { label: "Overview", segment: "" },
  { label: "Members", segment: "members" },
  { label: "Appeals", segment: "appeals" },
] as const;

function circleIdFromPath(pathname: string): string | null {
  const match = /^\/me\/circles\/([^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

/**
 * The contributor's shell — deliberately simpler than the coordinator one:
 * My circles, then Overview / Members / Appeals inside a circle. Mobile-first
 * with a horizontal nav on small screens.
 */
export default function MemberShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [circles, setCircles] = useState<MyCircleCard[]>([]);
  const [checking, setChecking] = useState(true);

  const refreshCircles = useCallback(async () => {
    setCircles(await memberApi.myCircles());
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Any signed-in person can be a member — scoping happens server-side by
    // membership, so there is no role gate here.
    memberApi
      .me()
      .then(async (me) => {
        const list = await memberApi.myCircles();
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
        <Spinner label="Opening your circles…" />
      </div>
    );
  }

  const signOut = () => {
    setToken(null);
    router.replace("/login");
  };

  const activeCircleId = circleIdFromPath(pathname);
  const activeCircle = circles.find((c) => c.circleId === activeCircleId) ?? null;

  const navLink = (
    href: string,
    label: string,
    active: boolean,
    mobile: boolean,
  ) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        mobile
          ? `whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium ${
              active ? "bg-green text-paper" : "text-ink/70 hover:bg-ink/5"
            }`
          : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-paper/10 text-gold"
                : "text-paper/70 hover:bg-paper/5 hover:text-paper"
            }`
      }
    >
      {label}
    </Link>
  );

  const circleLinks = (mobile: boolean) =>
    activeCircleId
      ? CIRCLE_NAV.map((item) => {
          const href = `/me/circles/${activeCircleId}${
            item.segment ? `/${item.segment}` : ""
          }`;
          return navLink(href, item.label, pathname === href, mobile);
        })
      : null;

  return (
    <MemberContext.Provider value={{ user, circles, refreshCircles }}>
      <div className="flex min-h-dvh bg-paper">
        {/* Sidebar (desktop) */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-green-deep text-paper md:flex">
          <Link
            href="/me"
            className="flex items-center gap-2.5 border-b border-paper/10 px-5 py-4.5"
          >
            <LogoMark />
            <span className="font-display text-lg font-bold tracking-tight">
              BookAm
            </span>
            <span className="ml-auto rounded-md bg-gold/20 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-gold">
              Member
            </span>
          </Link>
          <nav aria-label="Member" className="flex-1 space-y-1 px-3 py-4">
            {navLink("/me", "My circles", pathname === "/me", false)}
            {activeCircleId ? (
              <div className="pt-3">
                <p className="px-3 pb-1 font-mono text-[10px] font-bold uppercase tracking-wide text-paper/50">
                  {activeCircle?.circleName ?? "Circle"}
                </p>
                <div className="space-y-1">{circleLinks(false)}</div>
              </div>
            ) : null}
          </nav>
          <div className="border-t border-paper/10 px-5 py-4 text-xs text-paper/50">
            Your book, always up to date
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col md:pl-60">
          <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2.5 md:hidden">
                <LogoMark />
                <span className="font-display text-base font-bold">
                  {activeCircle ? activeCircle.circleName : "BookAm"}
                </span>
              </div>
              <div className="hidden text-sm text-muted md:block">
                Hello,{" "}
                <span className="font-semibold text-ink">{user.name}</span> 👋
              </div>
              <button
                onClick={signOut}
                className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-ink/70 transition-colors hover:border-green hover:text-green"
              >
                Sign out
              </button>
            </div>
            {/* Mobile nav — big tap targets */}
            <nav
              aria-label="Sections"
              className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 md:hidden"
            >
              {navLink("/me", "My circles", pathname === "/me", true)}
              {circleLinks(true)}
            </nav>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </MemberContext.Provider>
  );
}
