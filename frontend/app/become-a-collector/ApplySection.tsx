"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getToken, memberApi } from "@/lib/member/api";
import { setPostAuthRedirect } from "@/lib/auth/api";
import type { MyCollectorApplication, SafeUser } from "@/lib/member/types";
import {
  Button,
  ErrorNote,
  Field,
  Spinner,
  StatusBadge,
  inputClass,
} from "@/components/admin/ui";

type Viewer =
  | { kind: "checking" }
  | { kind: "signed-out" }
  | { kind: "member"; user: SafeUser; application: MyCollectorApplication | null }
  | { kind: "collector" };

/**
 * The call-to-action at the bottom of /become-a-collector. Visitors are sent
 * through sign-up (and brought back here); signed-in members apply on the
 * spot; existing collectors get pointed at their dashboard.
 */
export default function ApplySection() {
  const [viewer, setViewer] = useState<Viewer>({ kind: "checking" });
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    const check = async (): Promise<Viewer> => {
      if (!getToken()) return { kind: "signed-out" };
      try {
        const user = await memberApi.me();
        if (user.role !== "MEMBER") return { kind: "collector" };
        const application = await memberApi
          .myCollectorApplication()
          .catch(() => null);
        return { kind: "member", user, application };
      } catch {
        // Stale/expired token — treat as signed out.
        return { kind: "signed-out" };
      }
    };
    void check().then((next) => {
      if (!cancelled) setViewer(next);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="rounded-2xl bg-green-deep p-6 text-paper sm:p-8">
      {viewer.kind === "checking" ? (
        <Spinner label="One moment…" />
      ) : viewer.kind === "signed-out" ? (
        <SignedOutCta />
      ) : viewer.kind === "collector" ? (
        <div>
          <h2 className="font-display text-2xl font-bold text-gold">
            You&apos;re already a collector 🎉
          </h2>
          <p className="mt-2 text-paper/80">
            Your circles are waiting in the coordinator dashboard.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5"
          >
            Open my dashboard
          </Link>
        </div>
      ) : (
        <MemberApply
          name={viewer.user.name}
          application={viewer.application}
          onApplied={load}
        />
      )}
    </div>
  );
}

function SignedOutCta() {
  // Send them through auth and back to this page to finish applying.
  const remember = () => setPostAuthRedirect("/become-a-collector");
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-gold">
        Ready to move your book?
      </h2>
      <p className="mt-2 max-w-xl text-paper/80">
        Create your free account with your WhatsApp number, then apply right
        here — it takes two minutes.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/register"
          onClick={remember}
          className="rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5"
        >
          Create account &amp; apply
        </Link>
        <Link
          href="/login"
          onClick={remember}
          className="rounded-xl border border-paper/30 px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:border-gold hover:text-gold"
        >
          I already have an account
        </Link>
      </div>
    </div>
  );
}

function MemberApply({
  name,
  application,
  onApplied,
}: {
  name: string;
  application: MyCollectorApplication | null;
  onApplied: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await memberApi.applyCollector(note);
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply");
      setSubmitting(false);
    }
  };

  if (application?.status === "PENDING") {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-bold text-gold">
            Application received
          </h2>
          <StatusBadge status={application.status} />
        </div>
        <p className="mt-2 max-w-xl text-paper/80">
          Nice one, {name.split(" ")[0]} — your application is with the BookAm
          admin. You&apos;ll be upgraded the moment it&apos;s approved.
        </p>
      </div>
    );
  }

  if (application?.status === "APPROVED") {
    return (
      <div>
        <h2 className="font-display text-2xl font-bold text-gold">
          Approved! 🎉
        </h2>
        <p className="mt-2 text-paper/80">
          Sign out and back in to open your coordinator dashboard.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-xl">
      <h2 className="font-display text-2xl font-bold text-gold">
        Apply now, {name.split(" ")[0]}
      </h2>
      {application?.status === "REJECTED" ? (
        <p className="mt-2 text-sm text-paper/80">
          Your last application wasn&apos;t approved
          {application.reviewNote ? (
            <> — &ldquo;{application.reviewNote}&rdquo;</>
          ) : null}
          . You can apply again below.
        </p>
      ) : (
        <p className="mt-2 text-sm text-paper/80">
          Tell the BookAm admin about the ajo you run (or plan to run) — group
          size, how long, where.
        </p>
      )}

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <div className="mt-4 [&_span]:text-paper/60">
        <Field label="About your ajo (10–500 characters)">
          <textarea
            required
            minLength={10}
            maxLength={500}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. I coordinate a 12-person weekly ajo for traders in Balogun market, 3 years running…"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send my application"}
        </Button>
      </div>
    </form>
  );
}
