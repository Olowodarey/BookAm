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
export default function GoogleButton({
  onCredential,
}: {
  onCredential: (idToken: string) => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !slot.current) return;

    const render = () => {
      if (!window.google || !slot.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(slot.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
      });
    };

    if (window.google) {
      render();
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SRC}"]`,
    );
    if (!script) {
      script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    script.addEventListener("error", () => setFailed(true));
    return () => script?.removeEventListener("load", render);
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
      <div ref={slot} className="flex justify-center" />
    </div>
  );
}
