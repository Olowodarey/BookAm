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
  AWAITING: "muted",
  PENDING_REVIEW: "gold",
  PAID: "green",
  REJECTED: "red",
};

export function ContributionBadge({ status }: { status: ContributionStatus }) {
  return (
    <Badge tone={CONTRIBUTION_TONE[status]}>{CONTRIBUTION_LABEL[status]}</Badge>
  );
}

function TickIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeWidth={3.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l5 5 10-11" />
    </svg>
  );
}

function ClockIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeWidth={2.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" d="M12 7.5V12l3 2" />
    </svg>
  );
}

function CrossIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeWidth={3}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Minimal slice of a contribution the grid needs — lets the member
 * dashboard reuse the same card with its leaner row shape. */
export interface CycleGridEntry {
  id: string;
  memberName: string;
  position: number;
  status: ContributionStatus;
}

/**
 * The digital collection card — same visual language as the landing page
 * AjoCard: green tick boxes for paid, dashed plain boxes for owing.
 */
export function CycleGrid({
  circleName,
  cycleIndex,
  contributions,
}: {
  circleName: string;
  cycleIndex: number;
  contributions: CycleGridEntry[];
}) {
  const paid = contributions.filter((c) => c.status === "PAID").length;
  return (
    <div className="rounded-2xl border-2 border-ink bg-white p-5 shadow-[8px_8px_0_0_rgba(15,90,64,0.16)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            {circleName}
          </p>
          <p className="mt-1 font-display text-xl font-bold leading-none">
            Round {cycleIndex} collection card
          </p>
        </div>
        <span className="shrink-0 rounded-md border-2 border-gold bg-gold/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-green-deep">
          {paid} / {contributions.length} paid
        </span>
      </div>

      <ul className="mt-5 grid list-none grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {contributions.map((c) => (
          <li key={c.id} className="min-w-0">
            <div
              role="img"
              aria-label={`${c.memberName}: ${CONTRIBUTION_LABEL[c.status]}`}
              className={`flex aspect-square items-center justify-center rounded-lg ${
                c.status === "PAID"
                  ? "bg-green"
                  : c.status === "PENDING_REVIEW"
                    ? "border-2 border-gold bg-gold/15 text-green-deep"
                    : c.status === "REJECTED"
                      ? "border-2 border-red-300 bg-red-50 text-red-500"
                      : "border-2 border-dashed border-line font-mono text-sm text-muted"
              }`}
            >
              {c.status === "PAID" ? (
                <TickIcon className="h-6 w-6 text-gold" />
              ) : c.status === "PENDING_REVIEW" ? (
                <ClockIcon className="h-5 w-5" />
              ) : c.status === "REJECTED" ? (
                <CrossIcon className="h-5 w-5" />
              ) : (
                c.position
              )}
            </div>
            <p className="mt-1 truncate text-center text-[11px] text-ink/70">
              {c.memberName}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-4 border-t-2 border-line pt-3 font-mono text-[10px] uppercase tracking-wide text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-green" /> Paid
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border-2 border-gold bg-gold/15" />{" "}
          Receipt in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border-2 border-red-300 bg-red-50" />{" "}
          Rejected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border-2 border-dashed border-line" />{" "}
          Owing
        </span>
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
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white/60 px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-50"
      >
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
    <div className="rounded-2xl border border-line bg-white/60 px-4 py-3">
      <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
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
