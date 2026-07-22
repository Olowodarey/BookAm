"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  authApi,
  consumePostAuthRedirect,
  homeFor,
  storeSession,
} from "@/lib/auth/api";
import AuthShell from "@/components/auth/AuthShell";
import { ErrorNote, Spinner } from "@/components/admin/ui";

/**
 * Magic-link landing: the verification email links here with ?email=&code=.
 * We verify it, sign the person in, and send them to their dashboard — no
 * typing. (Entering the code by hand on /register still works too.)
 */
function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email");
  const code = params.get("code");
  const missing = !email || !code;
  const [failure, setFailure] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || missing) return; // guard strict-mode double-run
    ran.current = true;
    void (async () => {
      try {
        const session = await authApi.verifyEmail(email!, code!);
        storeSession(session);
        router.replace(consumePostAuthRedirect() ?? homeFor(session.user.role));
      } catch (e) {
        setFailure(
          e instanceof Error
            ? e.message
            : "We couldn't confirm this link — it may have expired.",
        );
      }
    })();
  }, [missing, email, code, router]);

  const error = missing
    ? "This link is missing its details — use the code from your email instead."
    : failure;

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-lg font-bold">Link didn&apos;t work</h1>
        <ErrorNote message={error} />
        <p className="text-sm text-muted">
          You can request a new code on the{" "}
          <Link
            href="/login"
            className="font-semibold text-green underline underline-offset-2"
          >
            sign-in page
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <Spinner label="Confirming your email…" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      badge="Confirm"
      footer={
        <>
          Trouble?{" "}
          <Link
            href="/login"
            className="font-semibold text-green underline underline-offset-2"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<Spinner label="Loading…" />}>
        <VerifyEmailInner />
      </Suspense>
    </AuthShell>
  );
}
