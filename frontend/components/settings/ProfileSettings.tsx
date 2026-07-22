"use client";

import { useEffect, useState, type FormEvent } from "react";
import type {
  OtpSentResponse,
  ProfileInput,
  SafeUser,
} from "@/lib/admin/types";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  PageHeader,
  inputClass,
} from "@/components/admin/ui";

/** API surface the form needs — both dashboards' clients provide it. */
export interface SettingsApi {
  updateProfile: (input: ProfileInput) => Promise<SafeUser>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ changed: true }>;
  /** Optional in-app WhatsApp/phone verification. */
  sendPhoneOtp: (phone: string) => Promise<OtpSentResponse>;
  verifyPhone: (phone: string, code: string) => Promise<SafeUser>;
}

/**
 * Shared settings form for the contributor (/me/settings) and collector
 * (/dashboard/settings) dashboards: name, second phone, payout account and
 * password. The bank details are a *record* shown to your circles so they
 * know where to send money — BookAm never touches the transfer itself.
 */
export default function ProfileSettings({
  user,
  api,
  onSaved,
}: {
  user: SafeUser;
  api: SettingsApi;
  onSaved: (user: SafeUser) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Your details, shown to your circles. Keep them current."
      />
      <div className="grid gap-4">
        <ProfileForm user={user} api={api} onSaved={onSaved} />
        <WhatsAppForm user={user} api={api} onSaved={onSaved} />
        <PasswordForm api={api} />
      </div>
    </div>
  );
}

function ProfileForm({
  user,
  api,
  onSaved,
}: {
  user: SafeUser;
  api: SettingsApi;
  onSaved: (user: SafeUser) => void;
}) {
  const [name, setName] = useState(user.name);
  const [altPhone, setAltPhone] = useState(user.altPhone ?? "");
  const [bankName, setBankName] = useState(user.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(
    user.bankAccountNumber ?? "",
  );
  const [accountName, setAccountName] = useState(user.bankAccountName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const updated = await api.updateProfile({
        name,
        altPhone,
        bankName,
        bankAccountNumber: accountNumber,
        bankAccountName: accountName,
      });
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="px-5 py-5">
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <h2 className="font-display text-lg font-bold">My details</h2>

        {error ? <ErrorNote message={error} /> : null}
        {saved ? (
          <p
            role="status"
            className="rounded-xl border border-green/30 bg-green/10 px-3.5 py-2.5 text-sm font-semibold text-green"
          >
            Saved ✓
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Email (login — not editable)">
            <input
              value={user.email}
              disabled
              aria-label="Primary email, your identity, not editable"
              className={`${inputClass} opacity-60`}
            />
          </Field>
          <Field label="Second phone number (optional)">
            <input
              type="tel"
              value={altPhone}
              onChange={(e) => setAltPhone(e.target.value)}
              placeholder="+2348098765432"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="border-t border-line pt-4">
          <h3 className="font-display text-base font-bold">
            Account to be paid to
          </h3>
          <p className="mt-1 text-sm text-muted">
            Shown to your circle when it&apos;s time to send you money — the
            transfer itself happens outside BookAm, bank to bank, as always.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Field label="Bank">
              <input
                maxLength={80}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. GTBank"
                className={inputClass}
              />
            </Field>
            <Field label="Account number (NUBAN)">
              <input
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                value={accountNumber}
                onChange={(e) =>
                  setAccountNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder="0123456789"
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field label="Account name">
              <input
                maxLength={80}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder={user.name}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save details"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * Optional in-app WhatsApp/phone verification. The phone isn't your identity
 * (email is) — but verifying it claims any circle memberships a coordinator
 * created for that number, so your circles find you.
 */
function WhatsAppForm({
  user,
  api,
  onSaved,
}: {
  user: SafeUser;
  api: SettingsApi;
  onSaved: (user: SafeUser) => void;
}) {
  const verified = Boolean(user.phoneVerifiedAt);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [stage, setStage] = useState<"idle" | "code">("idle");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const sent = await api.sendPhoneOtp(phone);
      setDevCode(sent.devCode);
      setCooldown(sent.resendAfterSeconds);
      setStage("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setSubmitting(false);
    }
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updated = await api.verifyPhone(phone, code);
      onSaved(updated);
      setStage("idle");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="px-5 py-5">
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold">
            WhatsApp number{" "}
            {verified ? (
              <span className="ml-1 rounded-md bg-green/15 px-1.5 py-0.5 align-middle font-mono text-[10px] font-bold uppercase tracking-wide text-green">
                Verified
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Optional. Verify the number your circles know you by (the one from
            the WhatsApp group) to claim any memberships added for it.
          </p>
        </div>

        {error ? <ErrorNote message={error} /> : null}

        {stage === "idle" ? (
          <form onSubmit={(e) => void sendCode(e)} className="space-y-4">
            <Field
              label={
                verified
                  ? "Verified number (send a code to change it)"
                  : "WhatsApp number"
              }
            >
              <input
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+2348012345678"
                className={inputClass}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Sending code…"
                  : verified
                    ? "Send code to update"
                    : "Send verification code"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => void confirm(e)} className="space-y-4">
            <p className="text-sm text-ink/80">
              We sent a 6-digit code to{" "}
              <span className="font-mono font-bold">{phone}</span>.
            </p>
            {devCode ? (
              <p className="rounded-xl border border-gold bg-gold/10 px-3.5 py-2.5 font-mono text-sm text-green-deep">
                Dev mode — your code is{" "}
                <span className="font-bold">{devCode}</span>
              </p>
            ) : null}
            <Field label="Verification code">
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className={`${inputClass} text-center font-mono text-xl tracking-[0.4em]`}
              />
            </Field>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setStage("idle");
                  setError(null);
                }}
                className="text-sm font-semibold text-muted underline underline-offset-2"
              >
                Change number
              </button>
              <Button type="submit" disabled={submitting || code.length !== 6}>
                {submitting ? "Checking…" : "Confirm number"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

function PasswordForm({ api }: { api: SettingsApi }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setChanged(false);
    setSubmitting(true);
    try {
      await api.changePassword(current, next);
      setChanged(true);
      setCurrent("");
      setNext("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="px-5 py-5">
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <h2 className="font-display text-lg font-bold">Change password</h2>

        {error ? <ErrorNote message={error} /> : null}
        {changed ? (
          <p
            role="status"
            className="rounded-xl border border-green/30 bg-green/10 px-3.5 py-2.5 text-sm font-semibold text-green"
          >
            Password changed ✓
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="New password (at least 8 characters)">
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Changing…" : "Change password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
