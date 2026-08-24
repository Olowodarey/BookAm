"use client";

import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID } from "@/lib/auth/api";

interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          theme: string;
          size: string;
          width?: number;
          text?: string;
          shape?: string;
        },
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

/**
 * "Sign in with Google" via Google Identity Services. Renders nothing when
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured, so the app works without
 * Google credentials and the button lights up once they're added.
 */
/** Google Identity Services renders at a fixed pixel width (it has no
 * width:100% mode), so to stay responsive we measure the container and clamp
 * to GSI's supported 200–400px range. */
const GSI_MIN_WIDTH = 200;
const GSI_MAX_WIDTH = 400;
/** The pill wrapper's chrome around the button: p-1.5 (6px) + border-2 (2px), both sides. */
const PILL_CHROME = 16;

export default function GoogleButton({
  onCredential,
}: {
  onCredential: (idToken: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !wrap.current) return;
    let initialized = false;
    let frame = 0;

    const render = () => {
      if (!window.google || !slot.current || !wrap.current) return;
      if (!initialized) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredential(response.credential),
        });
        initialized = true;
      }
      const available = wrap.current.clientWidth - PILL_CHROME;
      const width = Math.round(
        Math.min(GSI_MAX_WIDTH, Math.max(GSI_MIN_WIDTH, available)),
      );
      // Clear any button from a previous (differently sized) render.
      slot.current.replaceChildren();
      window.google.accounts.id.renderButton(slot.current, {
        theme: "outline",
        size: "large",
        width,
        text: "continue_with",
        shape: "pill",
      });
    };

    // Coalesce resize bursts into one render per frame.
    const scheduleRender = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    let script: HTMLScriptElement | null = null;
    if (window.google) {
      scheduleRender();
    } else {
      script = document.querySelector<HTMLScriptElement>(
        `script[src="${GSI_SRC}"]`,
      );
      if (!script) {
        script = document.createElement("script");
        script.src = GSI_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", scheduleRender);
      script.addEventListener("error", () => setFailed(true));
    }

    const observer = new ResizeObserver(scheduleRender);
    observer.observe(wrap.current);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      script?.removeEventListener("load", scheduleRender);
    };
  }, [onCredential]);

  if (!GOOGLE_CLIENT_ID || failed) return null;

  return (
    <div>
      <div className="my-4 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-muted">
          or
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
      {/* Thick, pill-shaped wrapper so the Google button reads as clearly
          clickable — the GSI-rendered button itself can't be restyled. The
          button width is measured from this container so it stays responsive. */}
      <div ref={wrap} className="flex w-full justify-center">
        <div
          ref={slot}
          className="flex w-full cursor-pointer justify-center overflow-hidden rounded-full border-2 border-line bg-white p-1.5 shadow-sm transition-all duration-150 hover:border-green hover:shadow-md active:scale-[0.98]"
        />
      </div>
    </div>
  );
}
