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
  Modal,
  PageHeader,
} from "@/components/admin/ui";
import {
  ReceiptFileButton,
  ReceiptModal,
  Stat,
} from "@/components/dashboard/ui";

export default function PayoutPage() {
  const { detail, refresh } = useCircle();
  const { circle, cycle } = detail;

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(false);
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

  const uploadReceipt = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await coordinatorApi.uploadPayoutReceipt(circle.id, file);
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

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Collects this round"
          value={
            <span className="font-sans text-lg font-bold">
              {collector?.name ?? "—"}
            </span>
          }
          hint={collector ? `${collector.phone} · position ${collector.position}` : "Add members first"}
        />
        <Stat
          label="Pot total (recorded)"
          value={formatNaira(cycle.potNaira)}
          hint={`${circle.paidCount} of ${cycle.contributions.length} members paid`}
        />
        <Stat
          label="Expected full pot"
          value={formatNaira(cycle.expectedNaira)}
          hint="if every member pays"
        />
      </div>

      <Card className="px-5 py-5">
        <h2 className="font-display text-lg font-bold">Payout proof</h2>
        <p className="mt-1 text-sm text-muted">
          BookAm never moves the money — you pay {collector?.name ?? "the collector"}{" "}
          directly (transfer or cash), then this receipt becomes the record.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ReceiptFileButton
            label={payout?.receiptFileUrl ? "Replace payout receipt" : "Upload payout receipt"}
            busyLabel="Uploading…"
            busy={busy}
            onFile={(file) => void uploadReceipt(file)}
          />
          {payout?.receiptFileUrl ? (
            <button
              onClick={() => setViewingReceipt(true)}
              aria-label="View the uploaded payout receipt"
              className="rounded-lg border border-line px-2.5 py-1.5 font-mono text-xs font-bold text-green hover:border-green"
            >
              View receipt 📎
            </button>
          ) : null}
          <div className="ml-auto">
            <Button
              onClick={() => void complete()}
              disabled={busy || !payout?.receiptFileUrl || circle.paidCount === 0}
            >
              {busy ? "Working…" : "Mark payout completed"}
            </Button>
          </div>
        </div>
        {!payout?.receiptFileUrl ? (
          <p className="mt-3 text-xs text-muted">
            Upload the receipt first — completing the payout closes round{" "}
            {cycle.index} and moves the circle to the next collector.
          </p>
        ) : null}
      </Card>

      {viewingReceipt && payout?.receiptFileUrl ? (
        <ReceiptModal
          path={payout.receiptFileUrl}
          title={`Payout receipt — round ${cycle.index}, ${collector?.name ?? ""}`}
          onClose={() => setViewingReceipt(false)}
        />
      ) : null}

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
