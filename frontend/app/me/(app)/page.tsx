"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMember } from "@/components/member/MemberShell";
import { formatNaira, FREQUENCY_LABEL, memberApi } from "@/lib/member/api";
import type { MyCircleCard, MyCollectorApplication } from "@/lib/member/types";
import {
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
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

      <CollectorApplicationStatus />
    </div>
  );
}

/**
 * Status-only view of the member's collector application. Applying happens
 * exclusively on /become-a-collector (it will be subscription-gated later);
 * this card only appears once an application exists.
 */
function CollectorApplicationStatus() {
  const { user } = useMember();
  const [application, setApplication] = useState<
    MyCollectorApplication | null | undefined
  >(undefined);

  useEffect(() => {
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

  if (user.role !== "MEMBER" || !application) return null;

  return (
    <Card className="mt-6 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          Your collector application
        </h2>
        <StatusBadge status={application.status} />
      </div>

      {application.status === "PENDING" ? (
        <p className="mt-1.5 text-sm text-ink/80">
          Your application is with the BookAm admin — you&apos;ll be upgraded
          as soon as it&apos;s approved.
        </p>
      ) : application.status === "REJECTED" ? (
        <p className="mt-1.5 text-sm text-ink/80">
          Your last application wasn&apos;t approved
          {application.reviewNote ? (
            <> — &ldquo;{application.reviewNote}&rdquo;</>
          ) : null}
          . You can apply again on the{" "}
          <Link
            href="/become-a-collector"
            className="font-semibold text-green underline underline-offset-2"
          >
            collector page
          </Link>
          .
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-ink/80">
          Approved! Sign out and back in to open your coordinator dashboard.
        </p>
      )}
    </Card>
  );
}
