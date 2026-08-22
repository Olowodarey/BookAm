"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal tab bar for small screens. The links inside can overflow the
 * viewport, but a plain overflow-x-auto gives no hint that there is more to
 * see. This wrapper adds clear affordances so people know to move along:
 *   1. Tappable ‹ / › arrow buttons on each edge that scroll the bar; they
 *      only appear while there is more content that way.
 *   2. A fading edge under each arrow to reinforce that tabs continue offscreen.
 *   3. On every route change it scrolls the active tab into view, so the
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

  // Scroll by most of the visible width so a tap reveals the next set of tabs.
  const scrollByDir = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
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
    <div className="relative border-t-2 border-green/40 md:hidden">
      <nav
        ref={scrollerRef}
        aria-label={ariaLabel}
        onScroll={updateEdges}
        className="flex gap-1 overflow-x-auto px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </nav>

      {/* Left arrow + fade */}
      <div
        aria-hidden={!edges.left}
        className={`pointer-events-none absolute inset-y-0 left-0 flex items-center bg-gradient-to-r from-paper via-paper/90 to-transparent pl-1 pr-6 transition-opacity duration-200 ${
          edges.left ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => scrollByDir(-1)}
          tabIndex={edges.left ? 0 : -1}
          aria-label="Scroll tabs left"
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-green text-paper shadow-sm active:scale-95"
        >
          <span aria-hidden className="text-base leading-none">
            ‹
          </span>
        </button>
      </div>

      {/* Right arrow + fade */}
      <div
        aria-hidden={!edges.right}
        className={`pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end bg-gradient-to-l from-paper via-paper/90 to-transparent pr-1 pl-6 transition-opacity duration-200 ${
          edges.right ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => scrollByDir(1)}
          tabIndex={edges.right ? 0 : -1}
          aria-label="Scroll tabs right"
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-green text-paper shadow-sm active:scale-95"
        >
          <span aria-hidden className="text-base leading-none">
            ›
          </span>
        </button>
      </div>
    </div>
  );
}
