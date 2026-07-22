"use client";

import { useState } from "react";
import { formatDate, formatNaira } from "@/lib/admin/api";
import { ReceiptModal } from "@/components/dashboard/ui";

/** Shared shape of a receipt across the member and coordinator views. */
export interface LedgerReceipt {
  id: string;
  amountNaira: number;
  receiptFileUrl: string;
  uploadedByName: string | null;
  note: string | null;
  createdAt: string;
}

/**
 * The installment ledger for a contribution or payout — one row per receipt,
 * each opening its proof image. Visible to the whole circle for transparency.
 */
export function ReceiptLedger({
  receipts,
  emptyHint,
}: {
  receipts: LedgerReceipt[];
  emptyHint?: string;
}) {
  const [viewing, setViewing] = useState<LedgerReceipt | null>(null);

  if (receipts.length === 0) {
    return emptyHint ? (
      <p className="text-sm text-muted">{emptyHint}</p>
    ) : null;
  }

  return (
    <>
      <ul className="space-y-1.5">
        {receipts.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
          >
            <div className="min-w-0">
              <span className="font-mono text-sm font-bold text-ink">
                {formatNaira(r.amountNaira)}
              </span>
              <span className="ml-2 text-xs text-muted">
                {formatDate(r.createdAt)}
                {r.uploadedByName ? ` · ${r.uploadedByName}` : ""}
              </span>
              {r.note ? (
                <p className="truncate text-xs text-muted">{r.note}</p>
              ) : null}
            </div>
            <button
              onClick={() => setViewing(r)}
              aria-label={`View ${formatNaira(r.amountNaira)} receipt`}
              className="shrink-0 rounded-lg border border-line px-2.5 py-1 font-mono text-xs font-bold text-green hover:border-green"
            >
              View 📎
            </button>
          </li>
        ))}
      </ul>
      {viewing ? (
        <ReceiptModal
          path={viewing.receiptFileUrl}
          title={`Receipt · ${formatNaira(viewing.amountNaira)}`}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </>
  );
}
