"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useCircle } from "./layout";
import {
  coordinatorApi,
  formatDate,
  formatNaira,
  FREQUENCY_LABEL,
} from "@/lib/dashboard/api";
import type { ReminderInfo } from "@/lib/dashboard/types";
import type { AppealInfo } from "@/lib/member/types";
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

      <AppealsPanel />

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

const APPEAL_TONE: Record<AppealInfo["status"], BadgeTone> = {
  OPEN: "gold",
  APPROVED: "green",
  REJECTED: "red",
  WITHDRAWN: "muted",
};

/**
 * Member appeals ("consider me to collect next") with the advisory tally.
 * The coordinator decides here; approving moves the appellant to collect
 * right after the current turn.
 */
function AppealsPanel() {
  const { detail, refresh } = useCircle();
  const circleId = detail.circle.id;
  const [appeals, setAppeals] = useState<AppealInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{
    appeal: AppealInfo;
    approve: boolean;
  } | null>(null);

  const load = useCallback(() => {
    coordinatorApi.listAppeals(circleId).then(
      (list) => {
        setAppeals(list);
        setError(null);
      },
      (e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load appeals"),
    );
  }, [circleId]);

  useEffect(load, [load]);

  if (!appeals || appeals.length === 0) return null;

  return (
    <section aria-label="Appeals" className="mt-6">
      <h2 className="mb-3 font-display text-lg font-bold">
        Appeals — the circle has spoken, you decide
      </h2>
      {error ? (
        <div className="mb-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
      <ul className="space-y-3">
        {appeals.map((appeal) => (
          <li key={appeal.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {appeal.appellantName}
                  <span className="ml-2 font-mono text-xs font-normal text-muted">
                    position {appeal.appellantPosition} ·{" "}
                    {formatDate(appeal.createdAt)}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold">
                    <span className="text-green">
                      {appeal.supportCount} support
                    </span>{" "}
                    ·{" "}
                    <span className="text-red-600">
                      {appeal.opposeCount} oppose
                    </span>
                  </span>
                  <Badge tone={APPEAL_TONE[appeal.status]}>
                    {appeal.status}
                  </Badge>
                </div>
              </div>
              <p className="mt-1.5 text-sm text-ink/80">“{appeal.reason}”</p>
              {appeal.status === "OPEN" ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={() => setDeciding({ appeal, approve: true })}
                    aria-label={`Approve ${appeal.appellantName}'s appeal to collect next`}
                  >
                    Approve — collects next
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setDeciding({ appeal, approve: false })}
                    aria-label={`Reject ${appeal.appellantName}'s appeal`}
                  >
                    Reject
                  </Button>
                </div>
              ) : appeal.decidedByName ? (
                <p className="mt-2 text-xs text-muted">
                  Decided by {appeal.decidedByName} on{" "}
                  {formatDate(appeal.decidedAt)}
                  {appeal.outcomeNote ? <> — “{appeal.outcomeNote}”</> : null}
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      {deciding ? (
        <DecideAppealModal
          circleId={circleId}
          appeal={deciding.appeal}
          approve={deciding.approve}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            load();
            // Approval reorders the rotation — refresh the circle view too.
            void refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function DecideAppealModal({
  circleId,
  appeal,
  approve,
  onClose,
  onDone,
}: {
  circleId: string;
  appeal: AppealInfo;
  approve: boolean;
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
      if (approve) {
        await coordinatorApi.approveAppeal(circleId, appeal.id, note || undefined);
      } else {
        await coordinatorApi.rejectAppeal(circleId, appeal.id, note || undefined);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decide appeal");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        approve
          ? `Approve — ${appeal.appellantName} collects next`
          : `Reject ${appeal.appellantName}'s appeal`
      }
      onClose={onClose}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <p className="text-sm text-ink/80">
          {approve ? (
            <>
              The rotation will be reordered so{" "}
              <span className="font-semibold">{appeal.appellantName}</span>{" "}
              collects right after the current turn. The circle voted{" "}
              <span className="font-mono font-bold text-green">
                {appeal.supportCount} support
              </span>{" "}
              ·{" "}
              <span className="font-mono font-bold text-red-600">
                {appeal.opposeCount} oppose
              </span>
              .
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
            placeholder={
              approve
                ? "e.g. Emergency confirmed — she collects next, order continues after."
                : "e.g. Two members ahead have waited longer — let's keep the order."
            }
            className={inputClass}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={approve ? "primary" : "danger"}
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Working…"
              : approve
                ? "Approve appeal"
                : "Reject appeal"}
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
