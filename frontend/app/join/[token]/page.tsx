"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LogoMark } from "@/components/landing/Nav";
import { memberApi, formatNaira, FREQUENCY_LABEL } from "@/lib/member/api";
import type { InvitePreview } from "@/lib/member/types";
import { isSignedIn, setPostAuthRedirect } from "@/lib/auth/api";
import { Button, ErrorNote, Spinner } from "@/components/admin/ui";

/**
 * Invite link: anyone can preview the circle, but joining requires a signed-in
 * BookAm account and only sends a *request* — the coordinator approves it, so
 * nobody joins just by having the link. (Every member needs an account so they
 * can upload their own receipts.)
 */
export default function JoinCirclePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const p = await memberApi.invitePreview(token);
        if (!active) return;
        setPreview(p);
        setSignedIn(isSignedIn());
      } catch (e) {
        if (active)
          setLoadError(
            e instanceof Error ? e.message : "This invite link is not valid",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const goSignIn = () => {
    // Come back to this invite after signing in.
    setPostAuthRedirect(`/join/${token}`);
    router.push("/login");
  };

  const request = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await memberApi.requestJoinCircle(token);
      setRequested(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark />
          <span className="font-display text-xl font-bold tracking-tight">
            BookAm
          </span>
        </div>

        {loadError ? (
          <ErrorNote message={loadError} />
        ) : !preview ? (
          <Spinner label="Opening your invite…" />
        ) : requested ? (
          <div className="rounded-2xl border-2 border-ink bg-white p-6 text-center shadow-[8px_8px_0_0_rgba(15,90,64,0.16)]">
            <p className="font-display text-2xl font-bold">Request sent! 🎉</p>
            <p className="mt-2 text-sm text-ink/80">
              We&apos;ve asked the coordinator of{" "}
              <span className="font-semibold">{preview.circleName}</span> to add
              you. Once they approve, the circle shows up on your dashboard.
            </p>
            <div className="mt-5">
              <Button onClick={() => router.push("/me")} className="w-full">
                Go to my dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-ink bg-white p-6 shadow-[8px_8px_0_0_rgba(15,90,64,0.16)]">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              You are invited to join
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight">
              {preview.circleName}
            </h1>
            <p className="mt-2 font-mono text-lg font-bold text-green">
              {formatNaira(preview.amountNaira)}{" "}
              {FREQUENCY_LABEL[preview.frequency]}
            </p>
            <p className="mt-1 text-sm text-muted">
              Coordinated by {preview.coordinatorName} · {preview.activeMembers}{" "}
              of {preview.memberTarget} members in
            </p>

            {error ? (
              <div className="mt-4">
                <ErrorNote message={error} />
              </div>
            ) : null}

            {signedIn ? (
              <div className="mt-5">
                <Button
                  onClick={() => void request()}
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? "Sending request…" : "Request to join"}
                </Button>
                <p className="mt-3 text-xs text-muted">
                  The coordinator approves each request — this keeps out anyone
                  who just stumbled on the link.
                </p>
              </div>
            ) : (
              <div className="mt-5">
                <Button onClick={goSignIn} className="w-full">
                  Sign in to request to join
                </Button>
                <p className="mt-3 text-xs text-muted">
                  You need a BookAm account to join a circle — it&apos;s how you
                  upload your own payment receipts. We&apos;ll bring you right
                  back here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
