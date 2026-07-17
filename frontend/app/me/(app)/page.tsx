"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMember } from "@/components/member/MemberShell";
import { formatNaira, FREQUENCY_LABEL, memberApi } from "@/lib/member/api";
import type { MyCircleCard, MyCollectorApplication } from "@/lib/member/types";
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  StatusBadge,
  inputClass,
} from "@/components/admin/ui";
import { ContributionBadge } from "@/components/dashboard/ui";

/** The reassurance line: where am I in the queue, in plain words. */
function turnLine(circle: MyCircleCard): string {
  if (circle.hasCollected) return "You have collected your payout this rotation 🎉";
  if (circle.iCollectNow) return "It's your turn to collect — the pot is coming to you!";
  if (circle.turnsUntilCollect === 1) return "You collect next — just one turn to go.";
  if (circle.turnsUntilCollect !== null)
    return `You collect in about ${circle.turnsUntilCollect} turns.`;
  return "Your turn will show here once the rotation starts.";
}

function myStatusLine(circle: MyCircleCard): string {
  switch (circle.myStatus) {
    case "PAID":
      return "You're paid up for this round ✓";
    case "PENDING_REVIEW":
      return "Receipt sent — waiting for your coordinator to confirm.";
    case "REJECTED":
      return "Your receipt needs another look — please re-upload.";
    case "AWAITING":
      return "This round's contribution is still open.";
    default:
      return "No round is open right now.";
  }
}

export default function MyCirclesPage() {
  const { user, circles } = useMember();

  return (
    <div>
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        subtitle="Everything your circles have recorded — open for you to see, any time."
      />

      {circles.length === 0 ? (
        <Card>
          <EmptyState
            title="You're not in any circle yet"
            hint="Ask your coordinator for an invite link — you'll appear here the moment you join."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {circles.map((circle) => (
            <Link
              key={circle.circleId}
              href={`/me/circles/${circle.circleId}`}
              className="block rounded-2xl border-2 border-ink bg-white p-5 shadow-[6px_6px_0_0_rgba(15,90,64,0.14)] transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                    {circle.cycleIndex ? `Round ${circle.cycleIndex}` : "Finished"}
                  </p>
                  <h2 className="mt-0.5 font-display text-lg font-bold leading-tight">
                    {circle.circleName}
                  </h2>
                </div>
                {circle.myStatus ? (
                  <ContributionBadge status={circle.myStatus} />
                ) : null}
              </div>

              <p className="mt-2 font-mono text-sm font-bold text-green">
                {formatNaira(circle.amountNaira)}{" "}
                {FREQUENCY_LABEL[circle.frequency]}
              </p>

              <p className="mt-3 text-sm text-ink/80">{myStatusLine(circle)}</p>
              <p className="mt-1.5 rounded-xl bg-gold/10 px-3 py-2 text-sm font-semibold text-green-deep">
                {turnLine(circle)}
              </p>

              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>
                  Position{" "}
                  <span className="font-mono font-bold text-ink">
                    {circle.myPosition}
                  </span>{" "}
                  of {circle.memberCount}
                </span>
                <span>
                  <span className="font-mono font-bold text-green">
                    {circle.paidCount}
                  </span>{" "}
                  / {circle.memberCount} paid
                </span>
                {circle.openAppeals > 0 ? (
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono font-bold text-[#996414]">
                    {circle.openAppeals} appeal{circle.openAppeals > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}

      <BecomeCollectorCard />
    </div>
  );
}

/**
 * Contributor → collector: apply with a note; the platform admin reviews.
 * Everyone starts as a member — this is the only way up.
 */
function BecomeCollectorCard() {
  const { user } = useMember();
  const [application, setApplication] = useState<
    MyCollectorApplication | null | undefined
  >(undefined);
  const [applying, setApplying] = useState(false);

  const load = useCallback(() => {
    memberApi.myCollectorApplication().then(setApplication, () =>
      setApplication(null),
    );
  }, []);

  useEffect(load, [load]);

  if (user.role !== "MEMBER") {
    return (
      <Card className="mt-6 px-5 py-4">
        <p className="text-sm text-ink/80">
          You&apos;re a collector — run your circles from the{" "}
          <Link
            href="/dashboard"
            className="font-semibold text-green underline underline-offset-2"
          >
            coordinator dashboard
          </Link>
          .
        </p>
      </Card>
    );
  }
  if (application === undefined) return null;

  return (
    <Card className="mt-6 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Run your own circle?</h2>
        {application ? <StatusBadge status={application.status} /> : null}
      </div>

      {!application || application.status === "REJECTED" ? (
        <>
          <p className="mt-1.5 text-sm text-ink/80">
            {application?.status === "REJECTED" ? (
              <>
                Your last application wasn&apos;t approved
                {application.reviewNote ? (
                  <> — &ldquo;{application.reviewNote}&rdquo;</>
                ) : null}
                . You can apply again.
              </>
            ) : (
              "Already the alajo of a WhatsApp group? Apply to become a collector and move your collection card into BookAm."
            )}
          </p>
          <div className="mt-3">
            <Button onClick={() => setApplying(true)}>
              Apply to be a collector
            </Button>
          </div>
        </>
      ) : application.status === "PENDING" ? (
        <p className="mt-1.5 text-sm text-ink/80">
          Your application is with the BookAm admin — you&apos;ll be upgraded
          as soon as it&apos;s approved.
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-ink/80">
          Approved! Sign out and back in to open your coordinator dashboard.
        </p>
      )}

      {applying ? (
        <ApplyCollectorModal
          onClose={() => setApplying(false)}
          onDone={() => {
            setApplying(false);
            load();
          }}
        />
      ) : null}
    </Card>
  );
}

function ApplyCollectorModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
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
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Apply to be a collector" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <p className="text-sm text-ink/80">
          Tell the BookAm admin about the ajo you run (or plan to run) — group
          size, how long, where. It helps them approve you faster.
        </p>
        {error ? <ErrorNote message={error} /> : null}
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
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send application"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
