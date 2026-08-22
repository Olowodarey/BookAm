"use client";

import { useEffect, useState } from "react";
import type { SupportContact as SupportContactData } from "@/lib/support";

/**
 * "Need help?" footer shown to coordinators and members. Loads the admin-set
 * support contact and renders whichever of WhatsApp / email is configured.
 * Renders nothing while loading, on error, or when neither field is set — it
 * must never get in the way of the dashboard.
 *
 * `load` should be a stable reference (e.g. a module-level api method).
 */
export function SupportContactFooter({
  load,
  className = "",
}: {
  load: () => Promise<SupportContactData>;
  className?: string;
}) {
  const [contact, setContact] = useState<SupportContactData | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((c) => {
        if (!cancelled) setContact(c);
      })
      .catch(() => {
        // Support contact is non-critical — stay silent on failure.
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!contact || (!contact.supportWhatsapp && !contact.supportEmail)) {
    return null;
  }

  // wa.me needs a bare international number (digits only, no + or spaces).
  const waNumber = contact.supportWhatsapp?.replace(/[^0-9]/g, "") ?? "";

  return (
    <div className={`border-t border-line px-5 py-4 ${className}`}>
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wide text-green">
        Need help?
      </p>
      <div className="flex flex-wrap gap-2">
        {contact.supportWhatsapp && waNumber ? (
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1da851]"
          >
            <WhatsAppIcon />
            WhatsApp support
          </a>
        ) : null}
        {contact.supportEmail ? (
          <a
            href={`mailto:${contact.supportEmail}`}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-green hover:text-green"
          >
            <GmailIcon />
            {contact.supportEmail}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** Real WhatsApp glyph (white on the button's brand-green background). */
function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.67c2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.42 5.82c0 4.54-3.7 8.24-8.25 8.24-1.52 0-3.01-.41-4.3-1.19l-.31-.18-3.12.82.83-3.04-.2-.32a8.18 8.18 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24zm-4.53 4.4c-.19 0-.5.07-.77.36-.27.29-1.02.99-1.02 2.42s1.04 2.81 1.18 3c.14.19 2.04 3.11 4.94 4.36.69.3 1.23.48 1.65.61.69.21 1.32.18 1.82.11.54-.08 1.7-.7 1.94-1.38.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.34-.29-.15-1.73-.86-2-.96-.27-.1-.47-.15-.66.14-.19.29-.75.95-.92 1.14-.17.19-.34.22-.63.07-.29-.15-1.23-.46-2.35-1.46-.87-.78-1.46-1.74-1.63-2.03-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.65-1.59-.89-2.18-.24-.57-.48-.49-.66-.5-.16-.01-.36-.01-.55-.01z" />
    </svg>
  );
}

/** Real multi-colour Gmail envelope logo. */
function GmailIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fill="#4caf50"
        d="M45 16.2l-5 4.5V38h3c1.104 0 2-.896 2-2V16.2z"
      />
      <path fill="#1e88e5" d="M3 16.2l5 4.5V38H5c-1.104 0-2-.896-2-2V16.2z" />
      <polygon
        fill="#e53935"
        points="35,11.2 24,19.45 13,11.2 12,17 13,26.5 24,34 35,26.5 36,17"
      />
      <path
        fill="#c62828"
        d="M3 12.298V16.2l5 3.6V11.2L6.5 10C4.921 8.858 3 9.982 3 12.298z"
      />
      <path
        fill="#fbc02d"
        d="M45 12.298V16.2l-5 3.6V11.2L41.5 10C43.079 8.858 45 9.982 45 12.298z"
      />
    </svg>
  );
}
