"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-green text-paper hover:bg-green-deep disabled:hover:bg-green",
  secondary:
    "border border-line bg-white/60 text-ink hover:border-green hover:text-green",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:border-red-400",
  ghost: "text-ink/70 hover:bg-ink/5 hover:text-ink",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
    />
  );
}

const BADGE_TONES = {
  green: "bg-green/10 text-green",
  gold: "bg-gold/15 text-[#996414]",
  red: "bg-red-50 text-red-700",
  muted: "bg-ink/5 text-ink/60",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export const STATUS_TONES: Record<string, BadgeTone> = {
  PENDING: "gold",
  APPROVED: "green",
  ACTIVE: "green",
  REJECTED: "red",
  SUSPENDED: "red",
  EXPIRED: "red",
  CANCELLED: "muted",
  MEMBER: "muted",
  COORDINATOR: "green",
  ADMIN: "gold",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "muted"}>{status}</Badge>;
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-white/60 ${className}`}
    >
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-12 text-sm text-muted"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-green"
      />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="py-12 text-center">
      <p className="font-display text-base font-semibold text-ink/70">
        {title}
      </p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
    >
      {message}
    </p>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const unmounted = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    unmounted.current = false;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      unmounted.current = true;
      if (dialog?.open) dialog.close();
    };
  }, []);

  // dialog.close() in the cleanup above QUEUES a `close` event, which then
  // fires after a StrictMode effect replay (dialog already reopened) or
  // after unmount — calling onClose for those stale events closed modals
  // the instant they opened. Only forward genuine user closes (Esc).
  const handleClose = () => {
    if (unmounted.current || ref.current?.open) return;
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-full max-w-lg rounded-2xl border border-line bg-paper p-0 shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-lg p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white/80 px-3.5 py-2 text-sm text-ink placeholder:text-muted";

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="px-5 py-4">
      <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
