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
    <div
      className={`border-t border-line px-5 py-4 text-xs text-muted ${className}`}
    >
      <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-ink/50">
        Need help?
      </p>
      <div className="flex flex-col gap-1.5">
        {contact.supportWhatsapp && waNumber ? (
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-green hover:underline"
          >
            <span aria-hidden>💬</span>
            WhatsApp support
          </a>
        ) : null}
        {contact.supportEmail ? (
          <a
            href={`mailto:${contact.supportEmail}`}
            className="inline-flex items-center gap-1.5 font-medium text-green hover:underline"
          >
            <span aria-hidden>✉️</span>
            {contact.supportEmail}
          </a>
        ) : null}
      </div>
    </div>
  );
}
