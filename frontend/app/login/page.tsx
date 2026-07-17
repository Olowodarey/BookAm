"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  authApi,
  AuthApiError,
  homeFor,
  storeSession,
  type LoginResponse,
} from "@/lib/auth/api";
import AuthShell from "@/components/auth/AuthShell";
import GoogleButton from "@/components/auth/GoogleButton";
import OtpForm from "@/components/auth/OtpForm";
import { Button, ErrorNote, Field, inputClass } from "@/components/admin/ui";

type Step =
  | { kind: "credentials" }
  /** Password was right but the phone still needs its OTP. */
  | { kind: "verify"; phone: string; devCode?: string; linkToken?: string }
  /** Google account without a linked, verified phone. */
  | { kind: "google-phone"; linkToken: string; name: string };

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const finish = useCallback(
    (session: LoginResponse) => {
      storeSession(session);
      router.replace(homeFor(session.user.role));
    },
    [router],
  );

  const submitCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      finish(await authApi.login(phone, password));
    } catch (err) {
      if (err instanceof AuthApiError && err.code === "PHONE_NOT_VERIFIED") {
        setStep({
          kind: "verify",
          phone: err.phone ?? phone,
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
      authApi.google(idToken).then(
        (result) => {
          if (result.status === "SIGNED_IN") {
            finish(result.session);
          } else {
            setStep({
              kind: "google-phone",
              linkToken: result.linkToken,
              name: result.name,
            });
          }
        },
        (err: unknown) =>
          setError(
            err instanceof Error ? err.message : "Google sign-in failed",
          ),
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

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>

          <GoogleButton onCredential={onGoogleCredential} />
        </form>
      ) : step.kind === "verify" ? (
        <div className="space-y-4">
          <h1 className="font-display text-lg font-bold">
            Confirm your number
          </h1>
          <OtpForm
            phone={step.phone}
            linkToken={step.linkToken}
            initialDevCode={step.devCode}
            onVerified={finish}
          />
        </div>
      ) : (
        <GooglePhoneStep
          linkToken={step.linkToken}
          name={step.name}
          onOtpSent={(p, devCode) =>
            setStep({
              kind: "verify",
              phone: p,
              devCode,
              linkToken: step.linkToken,
            })
          }
        />
      )}
    </AuthShell>
  );
}

/** Google gave us who they are; BookAm still needs their WhatsApp number. */
function GooglePhoneStep({
  linkToken,
  name,
  onOtpSent,
}: {
  linkToken: string;
  name: string;
  onOtpSent: (phone: string, devCode?: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const sent = await authApi.googleLinkPhone(linkToken, phone);
      onOtpSent(sent.phone, sent.devCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <h1 className="font-display text-lg font-bold">
        Almost there, {name.split(" ")[0]}
      </h1>
      <p className="text-sm text-ink/80">
        Your circles know you by your phone number — the same one from the
        WhatsApp group. Add it and we&apos;ll send a code to confirm.
      </p>
      {error ? <ErrorNote message={error} /> : null}
      <Field label="Phone number">
        <input
          type="tel"
          required
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+2348012345678"
          className={inputClass}
        />
      </Field>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Sending code…" : "Send verification code"}
      </Button>
    </form>
  );
}
