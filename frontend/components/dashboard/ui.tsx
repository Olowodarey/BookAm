"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Badge, Modal, type BadgeTone } from "@/components/admin/ui";
import { fileUrl } from "@/lib/dashboard/api";
import type { ContributionStatus } from "@/lib/dashboard/types";

/** Coordinator-facing labels — plain words, not system jargon. */
export const CONTRIBUTION_LABEL: Record<ContributionStatus, string> = {
  AWAITING: "Owing",
  PENDING_REVIEW: "Receipt in",
  PAID: "Paid",
  REJECTED: "Receipt rejected",
};

const CONTRIBUTION_TONE: Record<ContributionStatus, BadgeTone> = {
  // Owing is the member's outstanding to-do — flag it red so it can't be missed.
  AWAITING: "red",
  PENDING_REVIEW: "gold",
  PAID: "green",
  REJECTED: "red",
};

export function ContributionBadge({ status }: { status: ContributionStatus }) {
  return (
    <Badge tone={CONTRIBUTION_TONE[status]}>{CONTRIBUTION_LABEL[status]}</Badge>
  );
}

/**
 * Compact, member-count-independent view of a round's collection: a progress
 * bar plus a Paid / Receipt-in / Rejected / Owing breakdown. Used where the
 * full per-member grid would grow unwieldy (e.g. the coordinator overview).
 */
export function CollectionSummary({
  cycleIndex,
  contributions,
}: {
  cycleIndex: number;
  contributions: { status: ContributionStatus }[];
}) {
  const total = contributions.length;
  const count = (s: ContributionStatus) =>
    contributions.filter((c) => c.status === s).length;
  const paid = count("PAID");
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  const rows = [
    { label: "Paid", n: paid, dot: "bg-green" },
    {
      label: "Receipt in",
      n: count("PENDING_REVIEW"),
      dot: "border-2 border-gold bg-gold/15",
    },
    {
      label: "Rejected",
      n: count("REJECTED"),
      dot: "border-2 border-red-300 bg-red-50",
    },
    {
      label: "Owing",
      n: count("AWAITING"),
      dot: "border-2 border-dashed border-red-300 bg-red-50",
    },
  ];

  return (
    <div className="rounded-2xl border-2 border-green/35 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,90,64,0.12)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg font-bold">
          Round {cycleIndex} collection
        </p>
        <span className="shrink-0 rounded-md border-2 border-gold bg-gold/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-green-deep">
          {paid} / {total} paid
        </span>
      </div>

      <div
        className="mt-4 h-3 w-full overflow-hidden rounded-full bg-green/10"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Share of members paid this round"
      >
        <div
          className="h-full rounded-full bg-green transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-xs text-muted">
        {pct}% collected this round
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-2 rounded-xl border border-line bg-white/60 px-3 py-2"
          >
            <span
              className={`inline-block h-3.5 w-3.5 shrink-0 rounded-sm ${r.dot}`}
            />
            <span className="min-w-0">
              <span className="font-mono text-base font-bold text-ink">
                {r.n}
              </span>
              <span className="ml-1 text-xs text-muted">{r.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Image or PDF preview of an uploaded receipt, in a dialog.
 * Receipts are shown to every member of the circle for transparency.
 * // TODO: privacy — mask sensitive details (e.g. bank account numbers) on
 * // receipt previews before rendering, ideally server-side at upload time.
 */
export function ReceiptModal({
  path,
  title,
  onClose,
}: {
  /** Stored path like "/uploads/x.png" */
  path: string;
  title: string;
  onClose: () => void;
}) {
  const url = fileUrl(path);
  const isPdf = path.toLowerCase().endsWith(".pdf");
  return (
    <Modal title={title} onClose={onClose}>
      {isPdf ? (
        <iframe
          src={url}
          title={title}
          className="h-[60vh] w-full rounded-xl border border-line bg-white"
        />
      ) : (
        // Receipts live on the API host at runtime; next/image would need
        // static remote-host config, so a plain img is the right tool here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title}
          className="max-h-[60vh] w-full rounded-xl border border-line bg-white object-contain"
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block text-sm font-semibold text-green underline underline-offset-2"
      >
        Open original in new tab
      </a>
    </Modal>
  );
}

const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** Styled file picker for receipts; hands the chosen file to the parent. */
export function ReceiptFileButton({
  label,
  busyLabel,
  busy,
  onFile,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onFile(file);
  };
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={RECEIPT_ACCEPT}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onChange}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-green px-3.5 py-2 text-sm font-semibold text-paper shadow-sm transition-colors hover:bg-green-deep disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-green"
      >
        <span aria-hidden>⬆</span>
        {busy ? busyLabel : label}
      </button>
    </>
  );
}

/** Small stat block with a Space Mono figure, used across circle screens. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-green/15 bg-green/[0.05] px-4 py-3 transition-colors hover:border-green/30">
      <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-green">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-bold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Copy-to-clipboard button with a brief confirmation state. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white/60 px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-green hover:text-green"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
