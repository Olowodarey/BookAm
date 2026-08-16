"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useCircle } from "./layout";
import {
  coordinatorApi,
  formatDate,
  formatDeadline,
  formatNaira,
  FREQUENCY_LABEL,
  isoToWatInput,
  watInputToISO,
} from "@/lib/dashboard/api";
import type { ReminderInfo } from "@/lib/dashboard/types";
import type { SwapRequestInfo } from "@/lib/member/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  StatusBadge,
  inputClass,
  type BadgeTone,
} from "@/components/admin/ui";
import { CopyButton, CycleGrid, Stat } from "@/components/dashboard/ui";

export default function CircleOverviewPage() {
  const { detail } = useCircle();
  const { circle, cycle } = detail;
  const [reminders, setReminders] = useState<ReminderInfo | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [loadingReminders, setLoadingReminders] = useState(false);

  const openReminders = async () => {
    setLoadingReminders(true);
    setReminderError(null);
    try {
      setReminders(await coordinatorApi.reminders(circle.id));
    } catch (e) {
      setReminderError(
        e instanceof Error ? e.message : "Could not load reminders",
      );
    } finally {
      setLoadingReminders(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={circle.name}
        subtitle={`${formatNaira(circle.amountNaira)} ${FREQUENCY_LABEL[circle.frequency]} · ${circle.activeMembers} members`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={circle.status} />
            {cycle ? (
              <Button
                variant="secondary"
                onClick={() => void openReminders()}
                disabled={loadingReminders || circle.owingCount === 0}
              >
                {loadingReminders ? "Preparing…" : "Remind those owing"}
              </Button>
            ) : null}
          </div>
        }
      />

      {reminderError ? (
        <div className="mb-4">
          <ErrorNote message={reminderError} />
        </div>
      ) : null}

      <CircleSettingsCard />

      {!cycle ? (
        <Card>
          <EmptyState
            title="This circle has finished its rotation"
            hint="Everyone has collected. Create a new circle to start another round."
          />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Round"
              value={cycle.index}
              hint={`of ${circle.activeMembers || circle.memberTarget}`}
            />
            <Stat
              label="Paid"
              value={
                <>
                  <span className="text-green">{circle.paidCount}</span>
                  <span className="text-muted"> / {cycle.contributions.length}</span>
                </>
              }
              hint={`${circle.owingCount} still owing`}
            />
            <Stat
              label="Pot so far"
              value={formatNaira(cycle.potNaira)}
              hint={`of ${formatNaira(cycle.expectedNaira)} expected`}
            />
            <Stat
              label="Collects this round"
              value={
                <span className="font-sans text-base font-bold">
                  {cycle.collector?.name ?? "—"}
                </span>
              }
              hint={cycle.collector ? `Position ${cycle.collector.position}` : undefined}
            />
          </div>

          {cycle.dueAt ? (
            <div className="mb-6 rounded-xl border border-gold bg-gold/10 px-4 py-3">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-green-deep">
                Round {cycle.index} deadline
              </span>
              <span className="ml-2 font-semibold text-ink">
                {formatDeadline(cycle.dueAt)}
              </span>
              <span className="ml-1 text-xs text-muted">(WAT)</span>
            </div>
          ) : null}

          {cycle.contributions.length === 0 ? (
            <Card>
              <EmptyState
                title="No members yet"
                hint="Add members to start this round's collection card."
              />
              <div className="pb-6 text-center">
                <Link
                  href={`/dashboard/circles/${circle.id}/members`}
                  className="font-semibold text-green underline underline-offset-2"
                >
                  Go to members
                </Link>
              </div>
            </Card>
          ) : (
            <CycleGrid
              circleName={circle.name}
              cycleIndex={cycle.index}
              contributions={cycle.contributions}
            />
          )}
        </>
      )}

      <SwapsPanel />

      {reminders ? (
        <RemindersModal
          reminders={reminders}
          onClose={() => setReminders(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Coordinator-only card: set your fee percent (all members see it and the
 * collector receives the pot minus it) and opt in/out of your own rotation.
 */
function CircleSettingsCard() {
  const { detail, refresh } = useCircle();
  const { circle } = detail;
  const [fee, setFee] = useState(String(circle.coordinatorFeePercent));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the field in sync when the server value changes (e.g. after refresh).
  const [seen, setSeen] = useState(circle.coordinatorFeePercent);
  if (seen !== circle.coordinatorFeePercent) {
    setSeen(circle.coordinatorFeePercent);
    setFee(String(circle.coordinatorFeePercent));
  }

  const feeChanged = Number(fee) !== circle.coordinatorFeePercent;

  const currentDue = detail.cycle?.dueAt ?? null;
  const [due, setDue] = useState(currentDue ? isoToWatInput(currentDue) : "");
  const [dueSaved, setDueSaved] = useState(false);
  const [seenDue, setSeenDue] = useState(currentDue);
  if (seenDue !== currentDue) {
    setSeenDue(currentDue);
    setDue(currentDue ? isoToWatInput(currentDue) : "");
  }
  const dueChanged =
    due !== "" && (!currentDue || watInputToISO(due) !== currentDue);

  const saveFee = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await coordinatorApi.updateCircle(circle.id, { feePercent: Number(fee) });
      setSaved(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save fee");
    } finally {
      setBusy(false);
    }
  };

  const saveDue = async () => {
    setBusy(true);
    setError(null);
    setDueSaved(false);
    try {
      await coordinatorApi.updateCircle(circle.id, {
        dueAt: watInputToISO(due),
      });
      setDueSaved(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save deadline");
    } finally {
      setBusy(false);
    }
  };

  const toggleSelf = async () => {
    setBusy(true);
    setError(null);
    try {
      if (detail.iAmMember) {
        await coordinatorApi.leaveSelf(circle.id);
      } else {
        await coordinatorApi.joinSelf(circle.id);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update membership");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6 px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
            Coordinator settings
          </p>
          <div className="mt-2 flex items-end gap-2">
            <Field label="Your fee (% of pot)">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={fee}
                onChange={(e) => {
                  setFee(e.target.value);
                  setSaved(false);
                }}
                className={`${inputClass} w-28`}
              />
            </Field>
            <Button onClick={() => void saveFee()} disabled={busy || !feeChanged}>
              {busy ? "Saving…" : "Save fee"}
            </Button>
            {saved && !feeChanged ? (
              <span className="pb-2 text-sm font-semibold text-green">
                Saved ✓
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            Every member sees this. The collector receives the pot minus your
            fee.
          </p>

          {detail.cycle ? (
            <div className="mt-4">
              <div className="flex items-end gap-2">
                <Field label={`Round ${detail.cycle.index} deadline (WAT)`}>
                  <input
                    type="datetime-local"
                    value={due}
                    onChange={(e) => {
                      setDue(e.target.value);
                      setDueSaved(false);
                    }}
                    className={inputClass}
                  />
                </Field>
                <Button
                  onClick={() => void saveDue()}
                  disabled={busy || !dueChanged}
                >
                  {busy ? "Saving…" : "Save deadline"}
                </Button>
                {dueSaved && !dueChanged ? (
                  <span className="pb-2 text-sm font-semibold text-green">
                    Saved ✓
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted">
                Adjusts this round only; later rounds keep advancing by the
                frequency.
              </p>
            </div>
          ) : null}
        </div>

        <div className="text-right">
          <p className="text-sm text-ink/80">
            {detail.iAmMember
              ? "You're contributing in this circle's rotation."
              : "You're running this circle but not contributing."}
          </p>
          <div className="mt-2">
            <Button
              variant={detail.iAmMember ? "danger" : "secondary"}
              onClick={() => void toggleSelf()}
              disabled={busy}
            >
              {detail.iAmMember ? "Leave the rotation" : "Join circle myself"}
            </Button>
          </div>
        </div>
      </div>
      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </Card>
  );
}

const SWAP_TONE: Record<SwapRequestInfo["status"], BadgeTone> = {
  PENDING: "gold",
  ACCEPTED: "gold",
  CONFIRMED: "green",
  DECLINED: "red",
  CANCELLED: "muted",
  REJECTED: "red",
};

const SWAP_LABEL: Record<SwapRequestInfo["status"], string> = {
  PENDING: "Awaiting member",
  ACCEPTED: "Ready to confirm",
  CONFIRMED: "Swapped",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  REJECTED: "Not approved",
};

/**
 * Members arrange position swaps between themselves; the coordinator confirms
 * the one both agreed to — which actually swaps their rotation positions.
 * Read-only otherwise, kept as a shared record.
 */
function SwapsPanel() {
  const { detail, refresh } = useCircle();
  const circleId = detail.circle.id;
  const [swaps, setSwaps] = useState<SwapRequestInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{
    swap: SwapRequestInfo;
    confirm: boolean;
  } | null>(null);

  const load = useCallback(() => {
    coordinatorApi.listSwaps(circleId).then(
      (list) => {
        setSwaps(list);
        setError(null);
      },
      (e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load swaps"),
    );
  }, [circleId]);

  useEffect(load, [load]);

  if (!swaps || swaps.length === 0) return null;

  return (
    <section aria-label="Position swaps" className="mt-6">
      <h2 className="mb-3 font-display text-lg font-bold">
        Position swaps — confirm the ones members agreed to
      </h2>
      {error ? (
        <div className="mb-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
      <ul className="space-y-3">
        {swaps.map((swap) => (
          <li key={swap.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {swap.requesterName}
                  <span className="mx-1 font-mono text-xs font-normal text-muted">
                    pos {swap.requesterPosition}
                  </span>
                  <span className="text-muted">↔</span> {swap.targetName}
                  <span className="ml-1 font-mono text-xs font-normal text-muted">
                    pos {swap.targetPosition}
                  </span>
                </p>
                <Badge tone={SWAP_TONE[swap.status]}>
                  {SWAP_LABEL[swap.status]}
                </Badge>
              </div>
              {swap.note ? (
                <p className="mt-1.5 text-sm text-ink/80">“{swap.note}”</p>
              ) : null}
              {swap.canDecide ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={() => setDeciding({ swap, confirm: true })}
                    aria-label={`Confirm the swap between ${swap.requesterName} and ${swap.targetName}`}
                  >
                    Confirm swap
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setDeciding({ swap, confirm: false })}
                  >
                    Reject
                  </Button>
                </div>
              ) : swap.status === "PENDING" ? (
                <p className="mt-2 text-xs text-muted">
                  Waiting for {swap.targetName} to accept before you can confirm.
                </p>
              ) : swap.decidedByName ? (
                <p className="mt-2 text-xs text-muted">
                  Decided by {swap.decidedByName} on {formatDate(swap.decidedAt)}
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      {deciding ? (
        <DecideSwapModal
          circleId={circleId}
          swap={deciding.swap}
          confirm={deciding.confirm}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            load();
            // Confirming reorders the rotation — refresh the circle view too.
            void refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function DecideSwapModal({
  circleId,
  swap,
  confirm,
  onClose,
  onDone,
}: {
  circleId: string;
  swap: SwapRequestInfo;
  confirm: boolean;
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
      if (confirm) {
        await coordinatorApi.confirmSwap(circleId, swap.id, note || undefined);
      } else {
        await coordinatorApi.rejectSwap(circleId, swap.id, note || undefined);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decide swap");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        confirm
          ? `Confirm swap — ${swap.requesterName} ↔ ${swap.targetName}`
          : `Reject swap — ${swap.requesterName} ↔ ${swap.targetName}`
      }
      onClose={onClose}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <p className="text-sm text-ink/80">
          {confirm ? (
            <>
              <span className="font-semibold">{swap.requesterName}</span>{" "}
              (position {swap.requesterPosition}) and{" "}
              <span className="font-semibold">{swap.targetName}</span> (position{" "}
              {swap.targetPosition}) will trade rotation positions. Everyone sees
              the change.
            </>
          ) : (
            <>
              The rotation stays as it is. Everyone in the circle will see the
              outcome and your note.
            </>
          )}
        </p>
        {error ? <ErrorNote message={error} /> : null}
        <Field label="Note to the circle (optional)">
          <textarea
            maxLength={300}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={confirm ? "primary" : "danger"}
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Working…"
              : confirm
                ? "Confirm swap"
                : "Reject swap"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RemindersModal({
  reminders,
  onClose,
}: {
  reminders: ReminderInfo;
  onClose: () => void;
}) {
  return (
    <Modal title="Nudge everyone still owing" onClose={onClose}>
      {reminders.recipients.length === 0 ? (
        <p className="text-sm text-ink/80">
          Nobody is owing right now — every member has paid or sent a receipt.
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">
            {/* TODO: WhatsApp/SMS integration — for now, copy and forward. */}
            Copy this message and forward it on WhatsApp to the members below.
          </p>
          <blockquote className="rounded-xl border border-line bg-white/80 p-3.5 text-sm text-ink">
            {reminders.message}
          </blockquote>
          <div className="mt-3">
            <CopyButton text={reminders.message} label="Copy message" />
          </div>

          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {reminders.recipients.map((r) => (
              <li
                key={r.membershipId}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
              >
                <span className="font-semibold">{r.name}</span>
                <span className="font-mono text-xs text-muted">{r.phone}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
