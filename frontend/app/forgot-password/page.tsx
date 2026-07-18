"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  authApi,
  homeFor,
  storeSession,
} from "@/lib/auth/api";
import AuthShell from "@/components/auth/AuthShell";
import { Button, ErrorNote, Field, inputClass } from "@/components/admin/ui";

type Step =
  | { kind: "phone" }
  | { kind: "reset"; phone: string; devCode?: string; resendAfter: number };

/**
 * Forgot password: the OTP that proves phone ownership also authorizes the
 * new password — and signs the user straight in afterwards.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "phone" });
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const sent = await authApi.forgotPassword(phone);
      setStep({
        kind: "reset",
        phone: sent.phone,
        devCode: sent.devCode,
        resendAfter: sent.resendAfterSeconds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      badge="Reset"
      footer={
        <>
          Remembered it after all?{" "}
          <Link
            href="/login"
            className="font-semibold text-green underline underline-offset-2"
          >
            Sign in
          </Link>
        </>
      }
    >
      {step.kind === "phone" ? (
        <form onSubmit={(e) => void requestCode(e)} className="space-y-4">
          <h1 className="font-display text-lg font-bold">
            Forgot your password?
          </h1>
          <p className="text-sm text-muted">
            No wahala. Enter your phone number and we&apos;ll send a code so
            you can set a new one.
          </p>
          {error ? <ErrorNote message={error} /> : null}
          <Field label="Phone number">
            <input
              type="tel"
              required
              autoComplete="username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+2348012345678"
              className={inputClass}
            />
          </Field>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Sending code…" : "Send reset code"}
          </Button>
        </form>
      ) : (
        <ResetStep
          phone={step.phone}
          initialDevCode={step.devCode}
          resendAfter={step.resendAfter}
          onDone={(role) => router.replace(homeFor(role))}
        />
      )}
    </AuthShell>
  );
}

function ResetStep({
  phone,
  initialDevCode,
  resendAfter,
  onDone,
}: {
  phone: string;
  initialDevCode?: string;
  resendAfter: number;
  onDone: (role: "MEMBER" | "COORDINATOR" | "ADMIN") => void;
}) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [devCode, setDevCode] = useState(initialDevCode);
  const [cooldown, setCooldown] = useState(resendAfter);
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
      const session = await authApi.resetPassword(phone, code, password);
      storeSession(session);
      onDone(session.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const sent = await authApi.forgotPassword(phone);
      setDevCode(sent.devCode);
      setCooldown(sent.resendAfterSeconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <h1 className="font-display text-lg font-bold">Set a new password</h1>
      <p className="text-sm text-ink/80">
        We sent a 6-digit code to{" "}
        <span className="font-mono font-bold">{phone}</span>.
      </p>

      {devCode ? (
        <p className="rounded-xl border border-gold bg-gold/10 px-3.5 py-2.5 font-mono text-sm text-green-deep">
          Dev mode — your code is <span className="font-bold">{devCode}</span>
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

      <Field label="New password (at least 8 characters)">
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>

      <Button
        type="submit"
        disabled={submitting || code.length !== 6}
        className="w-full"
      >
        {submitting ? "Resetting…" : "Reset password & sign in"}
      </Button>

      <p className="text-center text-sm text-muted">
        No code yet?{" "}
        {cooldown > 0 ? (
          <span>
            Resend in <span className="font-mono font-bold">{cooldown}s</span>
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
