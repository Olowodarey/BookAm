"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authApi, AuthApiError } from "@/lib/auth/api";
import type { LoginResponse } from "@/lib/auth/api";
import { Button, ErrorNote, Field, inputClass } from "@/components/admin/ui";

/**
 * The "enter the 6-digit code" step shared by registration, unverified
 * login, and Google phone-linking. In dev builds the backend returns the
 * code (devCode) so the flow is testable before the WhatsApp/SMS provider
 * is wired up.
 */
export default function OtpForm({
  phone,
  linkToken,
  initialDevCode,
  resendAfterSeconds = 60,
  onVerified,
}: {
  phone: string;
  /** Present when completing a Google sign-in. */
  linkToken?: string;
  initialDevCode?: string;
  resendAfterSeconds?: number;
  onVerified: (session: LoginResponse) => void;
}) {
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(initialDevCode);
  const [cooldown, setCooldown] = useState(resendAfterSeconds);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      onVerified(await authApi.verifyPhone(phone, code, linkToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const sent = await authApi.resendOtp(phone);
      setDevCode(sent.devCode);
      setCooldown(sent.resendAfterSeconds);
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 429) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not resend code");
      }
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <p className="text-sm text-ink/80">
        We sent a 6-digit code to{" "}
        <span className="font-mono font-bold">{phone}</span>. Enter it below to
        confirm this is your number.
      </p>

      {devCode ? (
        <p className="rounded-xl border border-gold bg-gold/10 px-3.5 py-2.5 font-mono text-sm text-green-deep">
          Dev mode — your code is <span className="font-bold">{devCode}</span>
          {/* TODO: WhatsApp/SMS delivery removes this hint (see OtpService). */}
        </p>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}

      <Field label="Verification code">
        <input
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className={`${inputClass} text-center font-mono text-xl tracking-[0.4em]`}
        />
      </Field>

      <Button type="submit" disabled={submitting || code.length !== 6} className="w-full">
        {submitting ? "Checking…" : "Confirm my number"}
      </Button>

      <p className="text-center text-sm text-muted">
        No code yet?{" "}
        {cooldown > 0 ? (
          <span>
            You can resend in{" "}
            <span className="font-mono font-bold">{cooldown}s</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void resend()}
            className="font-semibold text-green underline underline-offset-2"
          >
            Resend code
          </button>
        )}
      </p>
    </form>
  );
}
