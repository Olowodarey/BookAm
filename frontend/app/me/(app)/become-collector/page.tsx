"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memberApi } from "@/lib/member/api";
import type { MyCollectorApplication } from "@/lib/member/types";
import { useMember } from "@/components/member/MemberShell";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  PageHeader,
  Spinner,
  StatusBadge,
  inputClass,
} from "@/components/admin/ui";

/**
 * In-dashboard "become a collector" request. The request form sits at the top;
 * on submit the member goes straight back to their dashboard (/me) — they stay
 * a MEMBER until the admin approves, so no sign-out / sign-in is needed.
 */
export default function BecomeCollectorPage() {
  const { user } = useMember();
  const router = useRouter();
  // Members start in a loading state (fetch below); non-members never apply, so
  // they resolve immediately without an in-effect setState.
  const [application, setApplication] = useState<
    MyCollectorApplication | null | undefined
  >(user.role === "MEMBER" ? undefined : null);

  useEffect(() => {
    // Collectors/admins never apply; skip the fetch for them.
    if (user.role !== "MEMBER") return;
    let cancelled = false;
    memberApi
      .myCollectorApplication()
      .catch(() => null)
      .then((app) => {
        if (!cancelled) setApplication(app);
      });
    return () => {
      cancelled = true;
    };
  }, [user.role]);

  // Already a collector — point them at the coordinator dashboard.
  if (user.role === "COORDINATOR") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="You're already a collector 🎉"
          subtitle="Your circles live in the coordinator dashboard."
        />
        <Link
          href="/dashboard"
          className="inline-block rounded-xl bg-green px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-green-deep"
        >
          Open my coordinator dashboard ↗
        </Link>
      </div>
    );
  }

  if (application === undefined) {
    return <Spinner label="One moment…" />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Become a collector"
        subtitle="Run your own ajo circles on BookAm. Send a request and the BookAm admin will review it."
      />

      {/* The request form — at the top, per the flow. */}
      <RequestCard
        firstName={user.name.split(" ")[0]}
        application={application}
        onApplied={() => router.push("/me")}
      />

      {/* What being a collector means — supporting context, below the form. */}
      <Card className="mt-4 px-5 py-5">
        <h2 className="font-display text-base font-bold">
          What a collector can do
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted">
          <li>• Create and run circles, and set the contribution + schedule.</li>
          <li>• Invite members, verify their receipts, and manage payouts.</li>
          <li>
            • BookAm never holds the money — every amount is a record of a
            transfer that happens outside the app.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function RequestCard({
  firstName,
  application,
  onApplied,
}: {
  firstName: string;
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
      setError(err instanceof Error ? err.message : "Could not send your request");
      setSubmitting(false);
    }
  };

  // A request is already in review — no form, just the status.
  if (application?.status === "PENDING") {
    return (
      <Card className="px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Request received</h2>
          <StatusBadge status={application.status} />
        </div>
        <p className="mt-1.5 text-sm text-ink/80">
          Nice one, {firstName} — your request is with the BookAm admin.
          You&apos;ll be upgraded the moment it&apos;s approved, right here in
          this dashboard.
        </p>
        <Link
          href="/me"
          className="mt-4 inline-block rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink/80 transition-colors hover:border-green hover:text-green"
        >
          Back to my dashboard
        </Link>
      </Card>
    );
  }

  return (
    <Card className="px-5 py-5">
      <h2 className="font-display text-lg font-bold">
        Request to become a collector
      </h2>
      {application?.status === "REJECTED" ? (
        <p className="mt-1.5 text-sm text-ink/80">
          Your last request wasn&apos;t approved
          {application.reviewNote ? (
            <> — &ldquo;{application.reviewNote}&rdquo;</>
          ) : null}
          . You can send a new one below.
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-ink/80">
          Tell the BookAm admin about the ajo you run (or plan to run) — group
          size, how long, where.
        </p>
      )}

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <form onSubmit={(e) => void submit(e)} className="mt-4">
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
        <div className="mt-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send my request"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
