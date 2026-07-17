"use client";

import { useState, type FormEvent } from "react";
import { useCircle } from "../layout";
import { coordinatorApi, formatNaira } from "@/lib/dashboard/api";
import type { ContributionInfo } from "@/lib/dashboard/types";
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
import {
  ContributionBadge,
  ReceiptFileButton,
  ReceiptModal,
} from "@/components/dashboard/ui";

export default function ContributionsPage() {
  const { detail, refresh } = useCircle();
  const { circle, cycle } = detail;

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ContributionInfo | null>(null);
  const [rejecting, setRejecting] = useState<ContributionInfo | null>(null);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  if (!cycle) {
    return (
      <div>
        <PageHeader title="Contributions" subtitle={circle.name} />
        <Card>
          <EmptyState
            title="No open round"
            hint="This circle has finished its rotation."
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Contributions"
        subtitle={`${circle.name} · round ${cycle.index} · verify receipts or record payments you received directly.`}
      />

      {error ? (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <Card className="overflow-x-auto">
        {cycle.contributions.length === 0 ? (
          <EmptyState
            title="No members yet"
            hint="Add members first — each one gets a slot on the collection card."
          />
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">
              Contribution status for every member in round {cycle.index} of{" "}
              {circle.name}
            </caption>
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wide text-ink/60">
                <th scope="col" className="px-5 py-3 font-bold">#</th>
                <th scope="col" className="px-5 py-3 font-bold">Member</th>
                <th scope="col" className="px-5 py-3 font-bold">Amount</th>
                <th scope="col" className="px-5 py-3 font-bold">Status</th>
                <th scope="col" className="px-5 py-3 font-bold">Receipt</th>
                <th scope="col" className="px-5 py-3 font-bold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cycle.contributions.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-line/60 last:border-0 hover:bg-white/60"
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-muted">
                    {c.position}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-semibold">{c.memberName}</p>
                    <p className="font-mono text-xs text-muted">
                      {c.memberPhone}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold">
                    {formatNaira(c.amountNaira)}
                  </td>
                  <td className="px-5 py-3.5">
                    <ContributionBadge status={c.status} />
                    {c.status === "REJECTED" && c.rejectionReason ? (
                      <p className="mt-1 max-w-[22ch] text-xs text-red-700">
                        {c.rejectionReason}
                      </p>
                    ) : null}
                    {c.status === "PAID" && c.reviewedByName ? (
                      <p className="mt-1 text-xs text-muted">
                        by {c.reviewedByName}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.receiptFileUrl ? (
                      <button
                        onClick={() => setViewing(c)}
                        aria-label={`View receipt from ${c.memberName}`}
                        className="rounded-lg border border-line px-2.5 py-1.5 font-mono text-xs font-bold text-green hover:border-green"
                      >
                        View 📎
                      </button>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap justify-end gap-2">
                      {c.status !== "PAID" ? (
                        <>
                          <ReceiptFileButton
                            label={c.receiptFileUrl ? "Replace receipt" : "Attach receipt"}
                            busyLabel="Uploading…"
                            busy={busyId === c.id}
                            onFile={(file) =>
                              void run(c.id, () =>
                                coordinatorApi.uploadContributionReceipt(
                                  circle.id,
                                  c.id,
                                  file,
                                ),
                              )
                            }
                          />
                          <Button
                            disabled={busyId === c.id}
                            onClick={() =>
                              void run(c.id, () =>
                                coordinatorApi.verifyContribution(
                                  circle.id,
                                  c.id,
                                ),
                              )
                            }
                            aria-label={
                              c.status === "PENDING_REVIEW"
                                ? `Verify receipt and mark ${c.memberName} paid`
                                : `Mark ${c.memberName} paid`
                            }
                          >
                            {c.status === "PENDING_REVIEW"
                              ? "Verify · mark paid"
                              : "Mark paid"}
                          </Button>
                        </>
                      ) : null}
                      {c.status === "PENDING_REVIEW" ? (
                        <Button
                          variant="danger"
                          disabled={busyId === c.id}
                          onClick={() => setRejecting(c)}
                          aria-label={`Reject receipt from ${c.memberName}`}
                        >
                          Reject
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {viewing?.receiptFileUrl ? (
        <ReceiptModal
          path={viewing.receiptFileUrl}
          title={`Receipt — ${viewing.memberName}, round ${cycle.index}`}
          onClose={() => setViewing(null)}
        />
      ) : null}

      {rejecting ? (
        <RejectModal
          circleId={circle.id}
          contribution={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function RejectModal({
  circleId,
  contribution,
  onClose,
  onDone,
}: {
  circleId: string;
  contribution: ContributionInfo;
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
      await coordinatorApi.rejectContribution(circleId, contribution.id, reason);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject receipt");
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Reject receipt — ${contribution.memberName}`} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {error ? <ErrorNote message={error} /> : null}
        <Field label="Reason (the member sees this)">
          <textarea
            required
            maxLength={300}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Transfer shows ₦3,000, not the full ₦5,000."
            className={inputClass}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" disabled={submitting}>
            {submitting ? "Rejecting…" : "Reject receipt"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
