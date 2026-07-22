"use client";

import { useState } from "react";
import { useMemberCircle } from "./layout";
import { formatNaira, FREQUENCY_LABEL, memberApi } from "@/lib/member/api";
import {
  Card,
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  inputClass,
} from "@/components/admin/ui";
import {
  ContributionBadge,
  CycleGrid,
  ReceiptFileButton,
  Stat,
} from "@/components/dashboard/ui";
import { ReceiptLedger } from "@/components/circles/ReceiptLedger";

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

          <CircleReceipts />
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
  const [amount, setAmount] = useState("");

  const remaining = Math.max(contribution.amountNaira - contribution.paidNaira, 0);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const parsed = amount.trim() === "" ? undefined : Number(amount);
      await memberApi.uploadMyReceipt(detail.circleId, file, parsed);
      setAmount("");
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

      {contribution.paidNaira > 0 && contribution.status !== "PAID" ? (
        <p className="mt-3 text-sm text-ink/80">
          Paid so far:{" "}
          <span className="font-mono font-bold text-green">
            {formatNaira(contribution.paidNaira)}
          </span>{" "}
          of {formatNaira(contribution.amountNaira)}
          {remaining > 0 ? (
            <>
              {" "}
              · <span className="font-bold">{formatNaira(remaining)}</span> to go
            </>
          ) : null}
        </p>
      ) : null}

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}

      {contribution.status !== "PAID" ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Field label="Amount paid (optional)">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={remaining > 0 ? String(remaining) : "Full amount"}
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>
          <ReceiptFileButton
            label={
              contribution.receipts.length > 0
                ? "Add another receipt"
                : "Upload my receipt"
            }
            busyLabel="Uploading…"
            busy={busy}
            onFile={(file) => void upload(file)}
          />
        </div>
      ) : null}

      {contribution.receipts.length > 0 ? (
        <div className="mt-4">
          <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
            My receipts this round
          </p>
          <ReceiptLedger receipts={contribution.receipts} />
        </div>
      ) : null}
    </Card>
  );
}

/**
 * Full transparency: every member's receipts for this round, plus proof the
 * collector was paid — all visible to the whole circle.
 */
function CircleReceipts() {
  const { detail } = useMemberCircle();
  const withReceipts = detail.members.filter((m) => m.receipts.length > 0);
  const payout = detail.payout;

  if (withReceipts.length === 0 && (!payout || payout.receipts.length === 0)) {
    return null;
  }

  return (
    <Card className="mt-6 px-5 py-5">
      <h2 className="font-display text-lg font-bold">This round&apos;s receipts</h2>
      <p className="mt-1 text-sm text-muted">
        Everyone&apos;s proof of payment for round {detail.cycleIndex} — kept as a
        shared record, including part-payments.
      </p>

      {payout && payout.receipts.length > 0 ? (
        <div className="mt-4 rounded-xl border border-green/30 bg-green/5 p-4">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-green-deep">
            Payout to {payout.collectorName ?? "the collector"} ·{" "}
            {formatNaira(payout.paidNaira)}
            {payout.amountNaira > 0 ? ` of ${formatNaira(payout.amountNaira)}` : ""}
          </p>
          <div className="mt-2">
            <ReceiptLedger receipts={payout.receipts} />
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {withReceipts.map((m) => (
          <div key={m.membershipId}>
            <p className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold">
                {m.isMe ? `${m.name} (you)` : m.name}
              </span>
              <span className="font-mono text-xs text-muted">
                {formatNaira(m.paidNaira)} of {formatNaira(detail.amountNaira)}
              </span>
            </p>
            <ReceiptLedger receipts={m.receipts} />
          </div>
        ))}
      </div>
    </Card>
  );
}
