"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/components/dashboard/DashboardShell";
import {
  coordinatorApi,
  formatNaira,
  FREQUENCY_LABEL,
  watInputToISO,
} from "@/lib/dashboard/api";
import type { CircleFrequency, CircleSummary } from "@/lib/dashboard/types";
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

export default function CirclesHomePage() {
  const { user, circles, refreshCircles } = useDashboard();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        subtitle="Every circle you coordinate, at a glance."
        action={
          <Button onClick={() => setCreating(true)}>+ New circle</Button>
        }
      />

      {circles.length === 0 ? (
        <Card>
          <EmptyState
            title="No circles yet"
            hint="Create your first circle to start recording contributions."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {circles.map((circle) => (
            <CircleCard key={circle.id} circle={circle} />
          ))}
        </div>
      )}

      {creating ? (
        <CreateCircleModal
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            void refreshCircles();
          }}
        />
      ) : null}
    </div>
  );
}

function CircleCard({ circle }: { circle: CircleSummary }) {
  const total = circle.paidCount + circle.owingCount;
  return (
    <Link
      href={`/dashboard/circles/${circle.id}`}
      className="block rounded-2xl border border-line bg-white/60 p-5 transition-colors hover:border-green"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-lg font-bold leading-tight">
          {circle.name}
        </h2>
        <StatusBadge status={circle.status} />
      </div>
      <p className="mt-1 font-mono text-sm font-bold text-green">
        {formatNaira(circle.amountNaira)} {FREQUENCY_LABEL[circle.frequency]}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Members</dt>
          <dd className="font-mono font-bold">
            {circle.activeMembers}
            <span className="text-muted"> / {circle.memberTarget}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Round</dt>
          <dd className="font-mono font-bold">
            {circle.currentCycleIndex ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Paid vs owing</dt>
          <dd className="font-mono font-bold">
            <span className="text-green">{circle.paidCount}</span>
            <span className="text-muted"> / {total}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Collects next</dt>
          <dd className="truncate font-semibold">
            {circle.nextCollectorName ?? "—"}
          </dd>
        </div>
      </dl>

      {total > 0 ? (
        <div
          aria-hidden="true"
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full bg-green"
            style={{ width: `${(circle.paidCount / total) * 100}%` }}
          />
        </div>
      ) : null}
    </Link>
  );
}

function CreateCircleModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<CircleFrequency>("WEEKLY");
  const [memberTarget, setMemberTarget] = useState("");
  const [feePercent, setFeePercent] = useState("");
  const [startDate, setStartDate] = useState("");
  const [firstDueAt, setFirstDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const deadlineHint =
    frequency === "DAILY"
      ? "Each round's deadline moves forward one day."
      : frequency === "WEEKLY"
        ? "Each round's deadline moves forward one week."
        : "Each round's deadline moves forward one month.";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await coordinatorApi.createCircle({
        name,
        amountNaira: Number(amount),
        frequency,
        memberTarget: Number(memberTarget),
        feePercent: feePercent.trim() === "" ? 0 : Number(feePercent),
        ...(startDate ? { startDate: watInputToISO(startDate) } : {}),
        ...(firstDueAt ? { firstDueAt: watInputToISO(firstDueAt) } : {}),
      });
      onDone();
      router.push(`/dashboard/circles/${created.id}/members`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create circle");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="New circle" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {error ? <ErrorNote message={error} /> : null}

        <Field label="Circle name">
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Balogun Traders Weekly"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Contribution (₦)">
            <input
              type="number"
              required
              min={1}
              step={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
              className={inputClass}
            />
          </Field>
          <Field label="Frequency">
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as CircleFrequency)}
              className={inputClass}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Number of members">
            <input
              type="number"
              required
              min={2}
              max={200}
              step={1}
              inputMode="numeric"
              value={memberTarget}
              onChange={(e) => setMemberTarget(e.target.value)}
              placeholder="10"
              className={inputClass}
            />
          </Field>
          <Field label="Your fee (% of pot)">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Start date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="First round deadline (WAT)">
            <input
              type="datetime-local"
              value={firstDueAt}
              onChange={(e) => setFirstDueAt(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <p className="text-xs text-muted">
          Times are West Africa Time (WAT). {deadlineHint} You can adjust any
          round&apos;s deadline later.
        </p>

        <p className="text-xs text-muted">
          Your fee is your cut of each payout — every member sees it, and the
          collector receives the pot minus your fee. BookAm only records who
          paid; the money keeps moving hand to hand or by direct transfer.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create circle"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
