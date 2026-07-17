import type { ReactNode } from "react";
import { LogoMark } from "@/components/landing/Nav";

/** Shared centered card layout for the /login and /register pages. */
export default function AuthShell({
  badge,
  footer,
  children,
}: {
  badge: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark />
          <span className="font-display text-xl font-bold tracking-tight">
            BookAm
          </span>
          <span className="rounded-md bg-gold/20 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#996414]">
            {badge}
          </span>
        </div>
        <div className="rounded-2xl border border-line bg-white/60 p-6">
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-muted">{footer}</p>
        <p className="mt-2 text-center text-xs text-muted">
          BookAm never holds your money — it only keeps the record straight.
        </p>
      </div>
    </div>
  );
}
