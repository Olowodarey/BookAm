"use client";

import { useId, useState, type FormEvent } from "react";

export default function WaitlistForm() {
  const inputId = useId();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappNumber.trim()) return;
    // TODO: POST the number to a route handler / backend (e.g. app/api/waitlist/route.ts)
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-xl border-2 border-green bg-green/5 px-4 py-3.5 font-medium text-green"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5 shrink-0 text-gold"
          strokeWidth={3}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l5 5 10-11" />
        </svg>
        Thank you — we&apos;ll reach out on WhatsApp.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-2.5 sm:flex-row"
    >
      <label htmlFor={inputId} className="sr-only">
        Your WhatsApp number
      </label>
      <input
        id={inputId}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        value={whatsappNumber}
        onChange={(event) => setWhatsappNumber(event.target.value)}
        placeholder="Your WhatsApp number"
        className="w-full flex-1 rounded-xl border-2 border-ink/20 bg-white px-4 py-3 text-ink placeholder:text-muted"
      />
      <button
        type="submit"
        className="shrink-0 rounded-xl bg-green px-5 py-3 font-semibold text-paper transition-colors hover:bg-green-deep"
      >
        Get early access
      </button>
    </form>
  );
}
