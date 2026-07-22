"use client";

import { useState } from "react";
import { useCircle } from "../layout";
import { coordinatorApi, formatNaira } from "@/lib/dashboard/api";
import type { CompletePayoutResult } from "@/lib/dashboard/types";
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  inputClass,
} from "@/components/admin/ui";
import { ReceiptFileButton, Stat } from "@/components/dashboard/ui";
import { ReceiptLedger } from "@/components/circles/ReceiptLedger";

export default function PayoutPage() {
  const { detail, refresh } = useCircle();
  const { circle, cycle } = detail;

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<CompletePayoutResult | null>(null);

  if (!cycle) {
    return (
      <div>
        <PageHeader title="Payout" subtitle={circle.name} />
        <Card>
          <EmptyState
            title="Rotation complete"
            hint="Every member has collected their payout. Well done!"
          />
        </Card>
      </div>
    );
  }

  const payout = cycle.payout;
  const collector = cycle.collector;
  // Fee/net from the live pot (the payout row may not exist yet).
  const feeNaira = Math.round(
    (cycle.potNaira * circle.coordinatorFeePercent) / 100,
  );
  const netPayout = cycle.potNaira - feeNaira;

  const uploadReceipt = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const parsed = amount.trim() === "" ? undefined : Number(amount);
      await coordinatorApi.uploadPayoutReceipt(circle.id, file, parsed);
      setAmount("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload receipt");
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await coordinatorApi.completePayout(circle.id);
      setResult(res);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete payout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Payout"
        subtitle={`${circle.name} · round ${cycle.index}. Send the pot directly to the collector, then upload your transfer receipt as proof.`}
      />

      {error ? (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Collects this round"
          value={
            <span className="font-sans text-lg font-bold">
              {collector?.name ?? "—"}
            </span>
          }
          hint={
            collector ? `position ${collector.position}` : "Add members first"
          }
        />
        <Stat
          label="Pot total (recorded)"
          value={formatNaira(cycle.potNaira)}
          hint={`${circle.paidCount} of ${cycle.contributions.length} members paid`}
        />
        <Stat
          label={`Your fee (${circle.coordinatorFeePercent}%)`}
          value={formatNaira(feeNaira)}
          hint={
            circle.coordinatorFeePercent === 0 ? "no fee set" : "your cut"
          }
        />
        <Stat
          label="Collector receives"
          value={formatNaira(netPayout)}
          hint="pot minus your fee"
        />
      </div>

      <Card className="px-5 py-5">
        <h2 className="font-display text-lg font-bold">Payout proof</h2>
        <p className="mt-1 text-sm text-muted">
          BookAm never moves the money — you pay {collector?.name ?? "the collector"}{" "}
          directly (transfer or cash), then this receipt becomes the record.
        </p>

        {cycle.collectorAccount ? (
          <div className="mt-3 rounded-xl border border-gold bg-gold/10 px-4 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-green-deep">
              Send the pot to
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-ink">
              {cycle.collectorAccount.accountNumber}
              {cycle.collectorAccount.bankName
                ? ` · ${cycle.collectorAccount.bankName}`
                : ""}
            </p>
            <p className="text-sm text-ink/80">
              {cycle.collectorAccount.accountName}
              {cycle.collectorAccount.altPhone
                ? ` · alt: ${cycle.collectorAccount.altPhone}`
                : ""}
            </p>
          </div>
        ) : collector ? (
          <p className="mt-3 text-xs text-muted">
            {collector.name} hasn&apos;t added their bank details in Settings
            yet — confirm the account with them directly.
          </p>
        ) : null}

        {payout && payout.paidNaira > 0 ? (
          <p className="mt-3 text-sm text-ink/80">
            Paid to {collector?.name ?? "the collector"} so far:{" "}
            <span className="font-mono font-bold text-green">
              {formatNaira(payout.paidNaira)}
            </span>{" "}
            of {formatNaira(cycle.potNaira)} pot
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Field label="Amount sent (optional)">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Full pot"
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>
          <ReceiptFileButton
            label={
              payout && payout.receipts.length > 0
                ? "Add another receipt"
                : "Upload payout receipt"
            }
            busyLabel="Uploading…"
            busy={busy}
            onFile={(file) => void uploadReceipt(file)}
          />
          <div className="ml-auto">
            <Button
              onClick={() => void complete()}
              disabled={busy || !payout?.receiptFileUrl || circle.paidCount === 0}
            >
              {busy ? "Working…" : "Mark payout completed"}
            </Button>
          </div>
        </div>

        {payout && payout.receipts.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
              Payout receipts (visible to the whole circle)
            </p>
            <ReceiptLedger receipts={payout.receipts} />
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">
            Upload the receipt first — completing the payout closes round{" "}
            {cycle.index} and moves the circle to the next collector.
          </p>
        )}
      </Card>

      {result ? (
        <Modal title="Payout recorded ✓" onClose={() => setResult(null)}>
          <p className="text-sm text-ink/80">
            Round done! The payout of{" "}
            <span className="font-mono font-bold">
              {formatNaira(result.payout.amountNaira)}
            </span>{" "}
            is recorded as completed.
          </p>
          <p className="mt-2 text-sm text-ink/80">
            {result.nextCollectorName ? (
              <>
                Next round is open —{" "}
                <span className="font-semibold">{result.nextCollectorName}</span>{" "}
                collects next (round {result.nextCycleIndex}).
              </>
            ) : (
              "That was the final turn — the circle is now completed. 🎉"
            )}
          </p>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => setResult(null)}>Continue</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
