"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Index of the tab marked as the current page, or -1 if none is active. */
function activeIndex(links: HTMLAnchorElement[]): number {
  return links.findIndex((a) => a.getAttribute("aria-current") === "page");
}

/**
 * Horizontal tab bar for small screens. The links inside can overflow the
 * viewport, but a plain overflow-x-auto gives no hint that there is more to
 * see. This wrapper adds clear affordances so people can move through it:
 *   1. Tappable ‹ / › arrow buttons on each edge that jump to the previous /
 *      next tab (real navigation), so people can page through without
 *      needing to swipe. They only appear when there is an adjacent tab.
 *   2. A fading edge under each arrow to reinforce that tabs continue offscreen.
 *   3. On every route change it scrolls the active tab into view, so the
 *      current section is always visible.
 *
 * Navigation is driven off the rendered <a> elements: the active tab carries
 * aria-current="page", and the arrows click its previous/next sibling. That
 * keeps this component generic — it doesn't need to know the routes.
 *
 * Pass the current pathname as `activeKey` so the active tab is re-centered
 * and the arrows re-evaluate whenever navigation happens.
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
  const [nav, setNav] = useState({ hasPrev: false, hasNext: false });

  const updateNav = useCallback(() => {
    const links = Array.from(
      scrollerRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [],
    );
    const idx = activeIndex(links);
    const hasPrev = idx > 0;
    const hasNext = idx >= 0 && idx < links.length - 1;
    setNav((prev) =>
      prev.hasPrev === hasPrev && prev.hasNext === hasNext
        ? prev
        : { hasPrev, hasNext },
    );
  }, []);

  // Scroll so the active tab sits in the middle of the bar. scrollTo clamps
  // at the ends, so the first/last tabs go as centered as they can.
  const centerActive = useCallback(() => {
    const el = scrollerRef.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !active) return;
    const elRect = el.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    const delta = aRect.left - elRect.left - (el.clientWidth - aRect.width) / 2;
    el.scrollTo({ left: el.scrollLeft + delta, behavior: "smooth" });
  }, []);

  // Navigate to the tab before/after the active one. Clicking the <a> lets
  // Next.js handle the client-side navigation.
  const goToAdjacent = (dir: 1 | -1) => {
    const links = Array.from(
      scrollerRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [],
    );
    const idx = activeIndex(links);
    const target =
      idx === -1 ? (dir === 1 ? links[0] : links[links.length - 1]) : links[idx + dir];
    target?.click();
  };

  // Recompute whenever the bar's size changes (e.g. tabs added/removed as
  // circles load, orientation change). Observing also fires once immediately,
  // which handles the initial layout.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateNav);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateNav]);

  // Center the active tab on navigation (and on first mount) and re-evaluate
  // the arrows once the scroll settles. A rAF ensures the new active tab has
  // its aria-current applied and the bar is laid out before we measure.
  useEffect(() => {
    const raf = requestAnimationFrame(centerActive);
    const timer = window.setTimeout(updateNav, 350);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [activeKey, centerActive, updateNav]);

  return (
    <div className="relative border-y-2 border-y-green md:hidden">
      <nav
        ref={scrollerRef}
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </nav>

      {/* Previous-tab arrow + fade */}
      <div
        aria-hidden={!nav.hasPrev}
        className={`pointer-events-none absolute inset-y-0 left-0 flex items-center bg-gradient-to-r from-paper via-paper/90 to-transparent pl-1 pr-6 transition-opacity duration-200 ${
          nav.hasPrev ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => goToAdjacent(-1)}
          tabIndex={nav.hasPrev ? 0 : -1}
          aria-label="Previous tab"
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-green text-paper shadow-sm active:scale-95"
        >
          <span aria-hidden className="text-base leading-none">
            ‹
          </span>
        </button>
      </div>

      {/* Next-tab arrow + fade */}
      <div
        aria-hidden={!nav.hasNext}
        className={`pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end bg-gradient-to-l from-paper via-paper/90 to-transparent pr-1 pl-6 transition-opacity duration-200 ${
          nav.hasNext ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => goToAdjacent(1)}
          tabIndex={nav.hasNext ? 0 : -1}
          aria-label="Next tab"
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
