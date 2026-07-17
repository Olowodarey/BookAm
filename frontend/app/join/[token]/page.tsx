"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/landing/Nav";
import {
  coordinatorApi,
  formatNaira,
  FREQUENCY_LABEL,
} from "@/lib/dashboard/api";
import type { InvitePreview } from "@/lib/dashboard/types";
import {
  Button,
  ErrorNote,
  Field,
  Spinner,
  inputClass,
} from "@/components/admin/ui";

/**
 * Public invite page: a prospective member opens the shareable link, sees the
 * circle, and joins with their name and phone. No account needed (yet).
 */
export default function JoinCirclePage() {
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    coordinatorApi
      .invitePreview(token)
      .then(setPreview)
      .catch((e: unknown) =>
        setLoadError(
          e instanceof Error ? e.message : "This invite link is not valid",
        ),
      );
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await coordinatorApi.joinCircle(token, { name, phone });
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join circle");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark />
          <span className="font-display text-xl font-bold tracking-tight">
            BookAm
          </span>
        </div>

        {loadError ? (
          <ErrorNote message={loadError} />
        ) : !preview ? (
          <Spinner label="Opening your invite…" />
        ) : joined ? (
          <div className="rounded-2xl border-2 border-ink bg-white p-6 text-center shadow-[8px_8px_0_0_rgba(15,90,64,0.16)]">
            <p className="font-display text-2xl font-bold">You&apos;re in! 🎉</p>
            <p className="mt-2 text-sm text-ink/80">
              Welcome to <span className="font-semibold">{preview.circleName}</span>.
              The coordinator will confirm your position in the rotation.
              Contributions stay exactly as before — you pay directly and send
              your receipt; BookAm just keeps the record straight.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-ink bg-white p-6 shadow-[8px_8px_0_0_rgba(15,90,64,0.16)]">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              You are invited to join
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight">
              {preview.circleName}
            </h1>
            <p className="mt-2 font-mono text-lg font-bold text-green">
              {formatNaira(preview.amountNaira)}{" "}
              {FREQUENCY_LABEL[preview.frequency]}
            </p>
            <p className="mt-1 text-sm text-muted">
              Coordinated by {preview.coordinatorName} ·{" "}
              {preview.activeMembers} of {preview.memberTarget} members in
            </p>

            <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-4">
              {error ? <ErrorNote message={error} /> : null}
              <Field label="Your full name">
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amina Yusuf"
                  className={inputClass}
                />
              </Field>
              <Field label="Your phone number">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+2348012345678"
                  className={inputClass}
                />
              </Field>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Joining…" : "Join this circle"}
              </Button>
            </form>

            <p className="mt-4 text-xs text-muted">
              BookAm never holds the money — it only records who has paid and
              whose turn it is to collect.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
