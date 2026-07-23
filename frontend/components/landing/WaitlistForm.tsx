"use client";

import { useId, useState, type FormEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function WaitlistForm({ source }: { source?: string }) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, ...(source ? { source } : {}) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        const msg = data?.message;
        throw new Error(
          Array.isArray(msg)
            ? msg.join(", ")
            : msg ?? "Something went wrong — please try again.",
        );
      }
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not reach us — please try again.",
      );
      setSubmitting(false);
    }
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
        You&apos;re on the list — we&apos;ll reach out by email.
      </p>
    );
  }

  return (
    <div className="w-full max-w-md">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-2.5 sm:flex-row"
      >
        <label htmlFor={inputId} className="sr-only">
          Your email address
        </label>
        <input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Your Gmail address"
          className="w-full flex-1 rounded-xl border-2 border-ink/20 bg-white px-4 py-3 text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={submitting}
          className="shrink-0 rounded-xl bg-green px-5 py-3 font-semibold text-paper transition-colors hover:bg-green-deep disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Get early access"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
