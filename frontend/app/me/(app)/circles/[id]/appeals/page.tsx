"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { memberApi, formatDate } from "@/lib/member/api";
import type { AppealInfo, VoteValue } from "@/lib/member/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  Spinner,
  inputClass,
  type BadgeTone,
} from "@/components/admin/ui";

const APPEAL_TONE: Record<AppealInfo["status"], BadgeTone> = {
  OPEN: "gold",
  APPROVED: "green",
  REJECTED: "red",
  WITHDRAWN: "muted",
};

const APPEAL_LABEL: Record<AppealInfo["status"], string> = {
  OPEN: "Voting open",
  APPROVED: "Approved",
  REJECTED: "Not this time",
  WITHDRAWN: "Withdrawn",
};

/**
 * Community appeals: anyone can ask to collect next, everyone sees the
 * reason and the live tally, every member (except the appellant) gets one
 * changeable advisory vote — and the coordinator's final decision is shown
 * to all.
 */
export default function AppealsPage() {
  const { id: circleId } = useParams<{ id: string }>();
  const [appeals, setAppeals] = useState<AppealInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    memberApi.listAppeals(circleId).then(
      (list) => {
        setAppeals(list);
        setError(null);
      },
      (e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load appeals"),
    );
  }, [circleId]);

  useEffect(load, [load]);

  const act = async (appealId: string, action: () => Promise<AppealInfo>) => {
    setBusyId(appealId);
    setError(null);
    try {
      const updated = await action();
      setAppeals(
        (prev) => prev?.map((a) => (a.id === updated.id ? updated : a)) ?? null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const myOpenAppeal = appeals?.find((a) => a.isMine && a.status === "OPEN");

  return (
    <div>
      <PageHeader
        title="Appeals"
        subtitle="Need the pot early? Ask the circle — everyone sees the reason, the votes, and the coordinator's final call."
        action={
          !myOpenAppeal ? (
            <Button onClick={() => setCreating(true)}>
              Request to be considered next
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      {!appeals ? (
        <Spinner label="Loading appeals…" />
      ) : appeals.length === 0 ? (
        <Card>
          <EmptyState
            title="No appeals yet"
            hint="If you ever need your turn early — school fees, emergency — this is where you ask, openly."
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {appeals.map((appeal) => (
            <li key={appeal.id}>
              <AppealCard
                appeal={appeal}
                busy={busyId === appeal.id}
                onVote={(value) =>
                  void act(appeal.id, () => memberApi.vote(appeal.id, value))
                }
                onWithdraw={() =>
                  void act(appeal.id, () => memberApi.withdrawAppeal(appeal.id))
                }
              />
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <CreateAppealModal
          circleId={circleId}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function TallyBar({ appeal }: { appeal: AppealInfo }) {
  const total = appeal.supportCount + appeal.opposeCount;
  const pct = total === 0 ? 0 : (appeal.supportCount / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-xs font-bold">
        <span className="text-green">{appeal.supportCount} support</span>
        <span className="text-red-600">{appeal.opposeCount} oppose</span>
      </div>
      <div
        role="img"
        aria-label={`Tally: ${appeal.supportCount} support, ${appeal.opposeCount} oppose`}
        className="mt-1 h-2 overflow-hidden rounded-full bg-red-100"
      >
        <div
          className="h-full rounded-full bg-green"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AppealCard({
  appeal,
  busy,
  onVote,
  onWithdraw,
}: {
  appeal: AppealInfo;
  busy: boolean;
  onVote: (value: VoteValue) => void;
  onWithdraw: () => void;
}) {
  const voteButton = (value: VoteValue, label: string) => {
    const active = appeal.myVote === value;
    return (
      <button
        onClick={() => onVote(value)}
        disabled={busy || active}
        aria-pressed={active}
        aria-label={`${label} ${appeal.appellantName}'s appeal`}
        className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed ${
          value === "SUPPORT"
            ? active
              ? "bg-green text-paper"
              : "border-2 border-green text-green hover:bg-green/10"
            : active
              ? "bg-red-600 text-white"
              : "border-2 border-red-300 text-red-600 hover:bg-red-50"
        }`}
      >
        {label}
        {active ? " ✓" : ""}
      </button>
    );
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">
            {appeal.isMine ? "Your appeal" : appeal.appellantName}
            <span className="ml-2 font-mono text-xs font-normal text-muted">
              position {appeal.appellantPosition} · {formatDate(appeal.createdAt)}
            </span>
          </p>
        </div>
        <Badge tone={APPEAL_TONE[appeal.status]}>
          {APPEAL_LABEL[appeal.status]}
        </Badge>
      </div>

      <blockquote className="mt-2 rounded-xl bg-paper px-4 py-3 text-sm text-ink/90">
        “{appeal.reason}”
      </blockquote>

      <div className="mt-4">
        <TallyBar appeal={appeal} />
      </div>

      {appeal.status === "OPEN" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {appeal.canVote ? (
            <>
              {voteButton("SUPPORT", "Support")}
              {voteButton("OPPOSE", "Oppose")}
              {appeal.myVote ? (
                <span className="text-xs text-muted">
                  You voted — tap the other button to change your mind.
                </span>
              ) : (
                <span className="text-xs text-muted">
                  Your vote helps the coordinator decide.
                </span>
              )}
            </>
          ) : appeal.isMine ? (
            <>
              <Button variant="secondary" onClick={onWithdraw} disabled={busy}>
                {busy ? "Withdrawing…" : "Withdraw my appeal"}
              </Button>
              <span className="text-xs text-muted">
                The circle is voting; your coordinator makes the final call.
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink/70">
          {appeal.status === "WITHDRAWN" ? (
            <>Withdrawn by {appeal.isMine ? "you" : appeal.appellantName}.</>
          ) : (
            <>
              Decided by{" "}
              <span className="font-semibold">
                {appeal.decidedByName ?? "the coordinator"}
              </span>{" "}
              on {formatDate(appeal.decidedAt)}
              {appeal.outcomeNote ? <> — “{appeal.outcomeNote}”</> : null}
            </>
          )}
        </p>
      )}
    </Card>
  );
}

function CreateAppealModal({
  circleId,
  onClose,
  onDone,
}: {
  circleId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await memberApi.createAppeal(circleId, reason);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create appeal");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Request to be considered next" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <p className="text-sm text-ink/80">
          Tell the circle why you&apos;d like to collect early. Everyone will
          see your reason and can support or oppose; your coordinator makes the
          final decision.
        </p>
        {error ? <ErrorNote message={error} /> : null}
        <Field label="Your reason (10–300 characters)">
          <textarea
            required
            minLength={10}
            maxLength={300}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. School fees are due before month end and my turn is far away…"
            className={inputClass}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send my appeal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
