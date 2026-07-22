"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi, homeFor, storeSession } from "@/lib/auth/api";
import AuthShell from "@/components/auth/AuthShell";
import {
  Button,
  ErrorNote,
  Field,
  Spinner,
  inputClass,
} from "@/components/admin/ui";

type Step =
  | { kind: "email" }
  | {
      kind: "reset";
      email: string;
      code?: string;
      devCode?: string;
      resendAfter: number;
    };

/**
 * Forgot password: the emailed code that proves email ownership also
 * authorizes the new password — and signs the user straight in afterwards.
 * (It's also how a Google-only user adds a password to their account.)
 * The reset email links here with ?email=&code=, jumping straight to the
 * "set a new password" step with the code pre-filled.
 */
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthShellFallback />}>
      <ForgotPasswordInner />
    </Suspense>
  );
}

function AuthShellFallback() {
  return (
    <AuthShell badge="Reset" footer={null}>
      <Spinner label="Loading…" />
    </AuthShell>
  );
}

function ForgotPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const linkEmail = params.get("email");
  const linkCode = params.get("code");
  const [step, setStep] = useState<Step>(
    linkEmail && linkCode
      ? { kind: "reset", email: linkEmail, code: linkCode, resendAfter: 0 }
      : { kind: "email" },
  );
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const sent = await authApi.forgotPassword(email);
      setStep({
        kind: "reset",
        email,
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
      {step.kind === "email" ? (
        <form onSubmit={(e) => void requestCode(e)} className="space-y-4">
          <h1 className="font-display text-lg font-bold">
            Forgot your password?
          </h1>
          <p className="text-sm text-muted">
            No wahala. Enter your email and we&apos;ll send a code so you can
            set a new one.
          </p>
          {error ? <ErrorNote message={error} /> : null}
          <Field label="Email address">
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Sending code…" : "Send reset code"}
          </Button>
        </form>
      ) : (
        <ResetStep
          email={step.email}
          initialCode={step.code}
          initialDevCode={step.devCode}
          resendAfter={step.resendAfter}
          onDone={(role) => router.replace(homeFor(role))}
        />
      )}
    </AuthShell>
  );
}

function ResetStep({
  email,
  initialCode,
  initialDevCode,
  resendAfter,
  onDone,
}: {
  email: string;
  initialCode?: string;
  initialDevCode?: string;
  resendAfter: number;
  onDone: (role: "MEMBER" | "COORDINATOR" | "ADMIN") => void;
}) {
  const [code, setCode] = useState(initialCode ?? "");
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
      const session = await authApi.resetPassword(email, code, password);
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
      const sent = await authApi.forgotPassword(email);
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
        <span className="font-mono font-bold">{email}</span>.
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
