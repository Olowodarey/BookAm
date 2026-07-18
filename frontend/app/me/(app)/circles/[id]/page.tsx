"use client";

import { useState } from "react";
import { useMemberCircle } from "./layout";
import { formatNaira, FREQUENCY_LABEL, memberApi } from "@/lib/member/api";
import { Card, EmptyState, ErrorNote, PageHeader } from "@/components/admin/ui";
import {
  ContributionBadge,
  CycleGrid,
  ReceiptFileButton,
  ReceiptModal,
  Stat,
} from "@/components/dashboard/ui";

export default function MemberCircleOverviewPage() {
  const { detail } = useMemberCircle();

  return (
    <div>
      <PageHeader
        title={detail.circleName}
        subtitle={`${formatNaira(detail.amountNaira)} ${FREQUENCY_LABEL[detail.frequency]} · coordinated by ${detail.coordinatorName}`}
      />

      {detail.cycleIndex === null ? (
        <Card>
          <EmptyState
            title="This rotation is complete"
            hint="Everyone collected their payout. Well done, circle!"
          />
        </Card>
      ) : (
        <>
          <CollectorHero />
          <MyContributionCard />

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Round" value={detail.cycleIndex} />
            <Stat
              label="Members paid"
              value={
                <>
                  <span className="text-green">
                    {detail.members.filter((m) => m.status === "PAID").length}
                  </span>
                  <span className="text-muted"> / {detail.members.length}</span>
                </>
              }
            />
            <Stat
              label="Pot so far"
              value={formatNaira(detail.potNaira)}
              hint={`of ${formatNaira(detail.expectedNaira)} expected`}
            />
            <Stat
              label="My position"
              value={detail.me.position}
              hint={
                detail.me.hasCollected
                  ? "already collected 🎉"
                  : detail.me.turnsUntilCollect === 0
                    ? "collecting now!"
                    : detail.me.turnsUntilCollect !== null
                      ? `~${detail.me.turnsUntilCollect} turn${detail.me.turnsUntilCollect === 1 ? "" : "s"} to go`
                      : undefined
              }
            />
          </div>

          <CycleGrid
            circleName={detail.circleName}
            cycleIndex={detail.cycleIndex}
            contributions={detail.members.map((m) => ({
              id: m.membershipId,
              memberName: m.name,
              position: m.position,
              status: m.status ?? "AWAITING",
            }))}
          />
        </>
      )}
    </div>
  );
}

/** "Who collects next" — the trust centrepiece of the member view. */
function CollectorHero() {
  const { detail } = useMemberCircle();
  const collector = detail.collector;

  return (
    <div className="mb-6 rounded-2xl bg-green-deep p-5 text-paper sm:p-6">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-paper/60">
        Collecting this round
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display text-2xl font-bold text-gold">
          {collector
            ? collector.isMe
              ? `${collector.name} — that's you! 🎉`
              : collector.name
            : "Waiting for members"}
        </p>
        {collector ? (
          <span className="font-mono text-sm text-paper/70">
            position {collector.position}
          </span>
        ) : null}
      </div>
      {detail.upcoming.length > 0 ? (
        <div className="mt-4 border-t border-paper/10 pt-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-paper/50">
            Then, in order
          </p>
          <ol className="mt-1.5 flex flex-wrap gap-2">
            {detail.upcoming.map((slot, i) => (
              <li
                key={slot.position}
                className={`rounded-full px-3 py-1 text-sm ${
                  slot.isMe
                    ? "bg-gold font-bold text-ink"
                    : "bg-paper/10 text-paper/80"
                }`}
              >
                {i + 1}. {slot.isMe ? `${slot.name} (you)` : slot.name}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

/** The member's one write action: submit / re-submit their own receipt. */
function MyContributionCard() {
  const { detail, refresh } = useMemberCircle();
  const { contribution } = detail.me;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await memberApi.uploadMyReceipt(detail.circleId, file);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload receipt");
    } finally {
      setBusy(false);
    }
  };

  const copy = (() => {
    switch (contribution.status) {
      case "PAID":
        return "Verified — you're paid up for this round. Nothing else to do!";
      case "PENDING_REVIEW":
        return "Your receipt is with the coordinator for confirmation. You can replace it until it's verified.";
      case "REJECTED":
        return "Your coordinator asked for a corrected receipt — please upload a new one.";
      default:
        return `Paid your ${formatNaira(contribution.amountNaira)} already? Upload your transfer receipt and the coordinator will mark you paid.`;
    }
  })();

  return (
    <Card className="mb-6 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">My contribution</h2>
        {contribution.status ? (
          <ContributionBadge status={contribution.status} />
        ) : null}
      </div>
      <p className="mt-1.5 text-sm text-ink/80">{copy}</p>
      {contribution.status === "REJECTED" && contribution.rejectionReason ? (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          Coordinator&apos;s note: {contribution.rejectionReason}
        </p>
      ) : null}

      {contribution.status !== "PAID" && detail.coordinatorAccount ? (
        <div className="mt-3 rounded-xl border border-gold bg-gold/10 px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-green-deep">
            Pay your contribution to
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-ink">
            {detail.coordinatorAccount.accountNumber}
            {detail.coordinatorAccount.bankName
              ? ` · ${detail.coordinatorAccount.bankName}`
              : ""}
          </p>
          <p className="text-sm text-ink/80">
            {detail.coordinatorAccount.accountName ?? detail.coordinatorName}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {contribution.status !== "PAID" ? (
          <ReceiptFileButton
            label={
              contribution.receiptFileUrl
                ? "Replace my receipt"
                : "Upload my receipt"
            }
            busyLabel="Uploading…"
            busy={busy}
            onFile={(file) => void upload(file)}
          />
        ) : null}
        {contribution.receiptFileUrl ? (
          <button
            onClick={() => setViewing(true)}
            aria-label="View my uploaded receipt"
            className="rounded-lg border border-line px-2.5 py-1.5 font-mono text-xs font-bold text-green hover:border-green"
          >
            View my receipt 📎
          </button>
        ) : null}
      </div>

      {viewing && contribution.receiptFileUrl ? (
        <ReceiptModal
          path={contribution.receiptFileUrl}
          title="My contribution receipt"
          onClose={() => setViewing(false)}
        />
      ) : null}
    </Card>
  );
}
