"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  authApi,
  AuthApiError,
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
  | { kind: "credentials" }
  /** Password was right but the email still needs verifying. */
  | { kind: "verify"; email: string; devCode?: string };

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "credentials" });
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

  const submitCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      finish(await authApi.login(email, password));
    } catch (err) {
      if (err instanceof AuthApiError && err.code === "EMAIL_NOT_VERIFIED") {
        setStep({
          kind: "verify",
          email: err.email ?? email,
          devCode: err.devCode,
        });
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
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
      badge="Sign in"
      footer={
        <>
          New to BookAm?{" "}
          <Link
            href="/register"
            className="font-semibold text-green underline underline-offset-2"
          >
            Create your account
          </Link>{" "}
          — everyone starts as a contributor.
        </>
      }
    >
      {step.kind === "credentials" ? (
        <form onSubmit={(e) => void submitCredentials(e)} className="space-y-4">
          <h1 className="font-display text-lg font-bold">Welcome back</h1>
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

          <Field label="Password">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </Field>

          <p className="text-right text-sm">
            <Link
              href="/forgot-password"
              className="font-semibold text-green underline underline-offset-2"
            >
              Forgot password?
            </Link>
          </p>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign in"}
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
