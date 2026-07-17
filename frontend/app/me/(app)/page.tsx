"use client";

import Link from "next/link";
import { useMember } from "@/components/member/MemberShell";
import { formatNaira, FREQUENCY_LABEL } from "@/lib/member/api";
import type { MyCircleCard } from "@/lib/member/types";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
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
    </div>
  );
}
