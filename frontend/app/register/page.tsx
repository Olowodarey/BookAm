"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  authApi,
  consumePostAuthRedirect,
  homeFor,
  storeSession,
  type LoginResponse,
} from "@/lib/auth/api";
import AuthShell from "@/components/auth/AuthShell";
import GoogleButton from "@/components/auth/GoogleButton";
import EmailOtpForm from "@/components/auth/EmailOtpForm";
import { Button, ErrorNote, Field, inputClass } from "@/components/admin/ui";

type Step =
  | { kind: "details" }
  | { kind: "verify"; email: string; devCode?: string };

/**
 * Everyone joins BookAm as a contributor. Wanting to run circles comes
 * later — a collector application the platform admin reviews from /me.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "details" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const finish = useCallback(
    (session: LoginResponse) => {
      storeSession(session);
      router.replace(consumePostAuthRedirect() ?? homeFor(session.user.role));
    },
    [router],
  );

  const submitDetails = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const sent = await authApi.register(name, email, password);
      setStep({ kind: "verify", email, devCode: sent.devCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you up");
      setSubmitting(false);
    }
  };

  const onGoogleCredential = useCallback(
    (idToken: string) => {
      setError(null);
      authApi.google(idToken).then(finish, (err: unknown) =>
        setError(err instanceof Error ? err.message : "Google sign-in failed"),
      );
    },
    [finish],
  );

  return (
    <AuthShell
      badge="Join"
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-green underline underline-offset-2"
          >
            Sign in
          </Link>
        </>
      }
    >
      {step.kind === "details" ? (
        <form onSubmit={(e) => void submitDetails(e)} className="space-y-4">
          <h1 className="font-display text-lg font-bold">
            Join your circle on BookAm
          </h1>
          <p className="text-sm text-muted">
            Sign up with your Gmail — or continue with Google. Want to run
            circles yourself? Apply to be a collector after you join.
          </p>

          {error ? <ErrorNote message={error} /> : null}

          <Field label="Full name">
            <input
              required
              maxLength={80}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amina Yusuf"
              className={inputClass}
            />
          </Field>

          <Field label="Gmail address">
            <input
              type="email"
              required
              autoComplete="email"
              pattern="[^@\s]+@gmail\.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              className={inputClass}
            />
          </Field>

          <Field label="Password (at least 8 characters)">
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

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating account…" : "Create my account"}
          </Button>

          <GoogleButton onCredential={onGoogleCredential} />
        </form>
      ) : (
        <div className="space-y-4">
          <h1 className="font-display text-lg font-bold">Confirm your email</h1>
          <EmailOtpForm
            email={step.email}
            initialDevCode={step.devCode}
            onVerified={finish}
          />
        </div>
      )}
    </AuthShell>
  );
}
