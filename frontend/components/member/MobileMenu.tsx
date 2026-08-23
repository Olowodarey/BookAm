"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mobile-only account menu: a single tap target in the header that opens a
 * small popover of app-level links (My circles, Settings, Become a collector…)
 * plus Sign out. This keeps the horizontal tab bar reserved for the sections
 * *inside* a circle — which is where mobile users actually spend their time —
 * so the top of the screen never mixes account links with circle tabs.
 *
 * Pass the current pathname as `activeKey` so the menu auto-closes on
 * navigation. Any click inside the popover also closes it (links and the sign
 * out button bubble up), as do Escape and a tap outside.
 */
export function MobileMenu({
  activeKey,
  children,
}: {
  activeKey: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close whenever the route changes (a menu item was followed).
  useEffect(() => {
    setOpen(false);
  }, [activeKey]);

  // Close on Escape or a tap outside the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-green/30 bg-white/70 text-green transition-colors hover:bg-green hover:text-paper"
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          {open ? (
            <path d="M5 5l10 10M15 5L5 15" />
          ) : (
            <path d="M3 6h14M3 10h14M3 14h14" />
          )}
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-2xl border border-line bg-paper p-1.5 shadow-xl"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
