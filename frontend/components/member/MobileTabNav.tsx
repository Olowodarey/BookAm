"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal tab bar for small screens. The links inside can overflow the
 * viewport, but a plain overflow-x-auto gives no hint that there is more to
 * see. This wrapper adds two affordances so people know to swipe:
 *   1. A fading edge (with a chevron on the right) that appears only while
 *      there is more content off-screen in that direction.
 *   2. On every route change it scrolls the active tab into view, so the
 *      current section is always visible — and the motion itself teaches
 *      that the bar scrolls.
 *
 * Pass the current pathname as `activeKey` so the active tab is re-centered
 * whenever navigation happens.
 */
export function MobileTabNav({
  ariaLabel,
  activeKey,
  children,
}: {
  ariaLabel: string;
  activeKey: string;
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  };

  // Recompute the edges when the bar is first laid out and whenever its size
  // changes (e.g. tabs added/removed as circles load, orientation change).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Bring the active tab into view on navigation and re-check the edges once
  // the scroll settles.
  useEffect(() => {
    const active = scrollerRef.current?.querySelector('[aria-current="page"]');
    active?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
    const timer = window.setTimeout(updateEdges, 350);
    return () => window.clearTimeout(timer);
  }, [activeKey]);

  return (
    <div className="relative md:hidden">
      <nav
        ref={scrollerRef}
        aria-label={ariaLabel}
        onScroll={updateEdges}
        className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </nav>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-paper to-transparent transition-opacity duration-200 ${
          edges.left ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end pr-1.5 bg-gradient-to-l from-paper to-transparent transition-opacity duration-200 ${
          edges.right ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="animate-pulse text-lg leading-none text-ink/40">›</span>
      </div>
    </div>
  );
}
