"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  authApi,
  homeFor,
  storeSession,
  type LoginResponse,
} from "@/lib/auth/api";
import AuthShell from "@/components/auth/AuthShell";
import GoogleButton from "@/components/auth/GoogleButton";
import OtpForm from "@/components/auth/OtpForm";
import { Button, ErrorNote, Field, inputClass } from "@/components/admin/ui";

type Step =
  | { kind: "details" }
  | { kind: "verify"; phone: string; devCode?: string; linkToken?: string }
  | { kind: "google-phone"; linkToken: string; name: string };

/**
 * Everyone joins BookAm as a contributor. Wanting to run circles comes
 * later — a collector application the platform admin reviews from /me.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "details" });
  const [name, setName] = useState("");
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

  const submitDetails = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const sent = await authApi.register(name, phone, password);
      setStep({ kind: "verify", phone: sent.phone, devCode: sent.devCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you up");
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
            Use the same phone number as your WhatsApp group — your circles
            will find you by it. Want to run circles yourself? Apply to be a
            collector after you join.
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

          <Field label="Phone number (WhatsApp)">
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
