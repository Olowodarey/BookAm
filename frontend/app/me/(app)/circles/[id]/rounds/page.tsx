"use client";

import { useEffect, useState } from "react";
import { useMemberCircle } from "../layout";
import { formatDate, formatDeadline, formatNaira, memberApi } from "@/lib/member/api";
import type { MemberRoundSummary } from "@/lib/member/types";
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
  Spinner,
} from "@/components/admin/ui";
import { ContributionBadge } from "@/components/dashboard/ui";
import { ReceiptLedger } from "@/components/circles/ReceiptLedger";

/**
 * Round history — every round the circle has run, newest first. Tap a round to
 * see who collected the pot ("who packs"), what each member paid that round,
 * and the round's date. Read-only; a shared record for the whole circle.
 */
export default function MemberCircleRoundsPage() {
  const { detail } = useMemberCircle();
  const [rounds, setRounds] = useState<MemberRoundSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    memberApi.circleRounds(detail.circleId).then(
      (list) => {
        if (cancelled) return;
        setRounds(list);
        // Open the most recent round by default so there's something to see.
        setOpenId(list[0]?.cycleId ?? null);
        setError(null);
      },
      (e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load the rounds");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [detail.circleId]);

  if (error) return <ErrorNote message={error} />;
  if (!rounds) return <Spinner label="Turning the pages…" />;

  return (
    <div>
      <PageHeader
        title="Rounds"
        subtitle={`${detail.circleName} · every round so far — tap one to see who collected and what everyone paid.`}
      />

      {rounds.length === 0 ? (
        <Card>
          <EmptyState
            title="No rounds yet"
            hint="This circle hasn't started its first round. Check back once it's underway."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <RoundCard
              key={round.cycleId}
              round={round}
              contributionNaira={detail.amountNaira}
              open={openId === round.cycleId}
              onToggle={() =>
                setOpenId((id) => (id === round.cycleId ? null : round.cycleId))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundCard({
  round,
  contributionNaira,
  open,
  onToggle,
}: {
  round: MemberRoundSummary;
  contributionNaira: number;
  open: boolean;
  onToggle: () => void;
}) {
  const collector =
    round.collectorName === null
      ? "Not collected yet"
      : round.isMyTurn
        ? `You collected — that's you! 🎉`
        : round.collectorName;

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-ink/[0.02] sm:px-5"
      >
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-green/10 font-mono text-green">
          <span className="text-[9px] font-bold uppercase leading-none tracking-wide">
            Rnd
          </span>
          <span className="text-lg font-bold leading-none">{round.index}</span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted">
              Collected by
            </p>
            {round.status === "OPEN" ? (
              <Badge tone="gold">Open</Badge>
            ) : (
              <Badge tone="green">Completed</Badge>
            )}
          </div>
          <p className="truncate font-display text-base font-bold text-ink">
            {collector}
            {round.collectorPosition ? (
              <span className="ml-1.5 font-mono text-xs font-normal text-muted">
                position {round.collectorPosition}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {round.dueAt
              ? `Due ${formatDeadline(round.dueAt)} (WAT)`
              : `Started ${formatDate(round.startedAt)}`}
            {round.completedAt ? ` · closed ${formatDate(round.completedAt)}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-base font-bold text-ink">
            {formatNaira(round.potNaira)}
          </p>
          <p className="text-xs text-muted">
            <span className="text-green">{round.paidCount}</span>/
            {round.memberCount} paid
          </p>
        </div>

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="border-t border-line/70 px-4 py-3 sm:px-5">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wide text-ink/60">
            What everyone paid this round
          </p>
          {round.members.length === 0 ? (
            <p className="py-2 text-sm text-muted">
              No contributions recorded for this round.
            </p>
          ) : (
            <ul className="divide-y divide-line/60">
              {round.members.map((m) => (
                <li
                  key={m.membershipId}
                  className={`py-2.5 ${
                    m.isMe ? "-mx-4 rounded-lg bg-gold/10 px-4 sm:-mx-5 sm:px-5" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green/10 font-mono text-xs font-bold text-green">
                      {m.position}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {m.name}
                      {m.isMe ? (
                        <span className="ml-1 text-muted">(you)</span>
                      ) : null}
                    </span>
                    {m.status ? <ContributionBadge status={m.status} /> : null}
                    <span
                      className={`w-24 shrink-0 text-right font-mono text-sm font-bold ${
                        m.paidNaira > 0 ? "text-ink" : "text-muted"
                      }`}
                    >
                      {formatNaira(m.paidNaira)}
                      {m.paidNaira > 0 && m.paidNaira < contributionNaira ? (
                        <span className="block text-[10px] font-normal text-muted">
                          of {formatNaira(contributionNaira)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {/* Proof of payment — tap a receipt to view it. */}
                  {m.receipts.length > 0 ? (
                    <div className="mt-2 pl-10">
                      <ReceiptLedger receipts={m.receipts} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {/* The pot's payout evidence — proof the collector was paid. */}
          {round.payoutReceipts.length > 0 ? (
            <div className="mt-4 border-t border-line/70 pt-3">
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wide text-ink/60">
                Payout to {round.collectorName ?? "the collector"} · proof
              </p>
              <ReceiptLedger receipts={round.payoutReceipts} />
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
