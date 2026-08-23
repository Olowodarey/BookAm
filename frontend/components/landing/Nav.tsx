"use client";

import { useState } from "react";
import Link from "next/link";

const LOGO_CELLS: ReadonlyArray<"green" | "gold"> = [
  "green",
  "green",
  "gold",
  "green",
  "gold",
  "green",
  "green",
  "green",
  "green",
];

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-6 w-6 shrink-0 grid-cols-3 gap-[2px] ${className}`}
    >
      {LOGO_CELLS.map((cell, i) => (
        <span
          key={i}
          className={`rounded-[2px] ${cell === "gold" ? "bg-gold" : "bg-green"}`}
        />
      ))}
    </span>
  );
}

// "/#section" (not "#section") so the links also work from other pages
// that reuse this nav, e.g. /become-a-collector.
const NAV_LINKS = [
  { label: "Why BookAm", href: "/#why" },
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how" },
  { label: "For collectors", href: "/become-a-collector" },
] as const;

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6"
      >
        <a href="#top" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-xl font-bold tracking-tight">
            BookAm
          </span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink/70 transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink/80 transition-colors hover:border-green hover:text-green sm:inline-block"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="hidden rounded-xl bg-green px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-green-deep sm:inline-block"
          >
            Get started
          </Link>

          {/* Mobile menu toggle — the nav links are hidden below md, so phones
              need this to reach "For collectors" (where to apply) etc. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink/80 transition-colors hover:border-green hover:text-green md:hidden"
          >
            {open ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {open ? (
        <div
          id="mobile-menu"
          className="border-t border-line bg-paper md:hidden"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-ink/80 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-line px-4 py-2.5 text-center text-sm font-semibold text-ink/80 transition-colors hover:border-green hover:text-green"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-green px-4 py-2.5 text-center text-sm font-semibold text-paper transition-colors hover:bg-green-deep"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
