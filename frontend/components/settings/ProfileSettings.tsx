"use client";

import { useState, type FormEvent } from "react";
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
  /** Sets a first password for a Google-only account (no current one needed). */
  setPassword: (newPassword: string) => Promise<SafeUser>;
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
        <PasswordForm user={user} api={api} onSaved={onSaved} />
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
          <Field label="Phone number (so your circles can reach you)">
            <input
              type="tel"
              autoComplete="tel"
              value={altPhone}
              onChange={(e) => setAltPhone(e.target.value)}
              placeholder="+2348012345678"
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
 * Change password (accounts that have one) or set a first password (Google-only
 * accounts, which have none). The set path skips the current-password field —
 * the signed-in session already proves ownership — and both paths ask for a
 * confirmation so a typo can't lock anyone out.
 */
function PasswordForm({
  user,
  api,
  onSaved,
}: {
  user: SafeUser;
  api: SettingsApi;
  onSaved: (user: SafeUser) => void;
}) {
  const isSet = user.hasPassword;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError("The new passwords don't match");
      return;
    }
    setError(null);
    setDone(false);
    setSubmitting(true);
    try {
      if (isSet) {
        await api.changePassword(current, next);
      } else {
        onSaved(await api.setPassword(next));
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isSet
            ? "Could not change password"
            : "Could not set password",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="px-5 py-5">
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <h2 className="font-display text-lg font-bold">
          {isSet ? "Change password" : "Set a password"}
        </h2>
        {!isSet ? (
          <p className="text-sm text-muted">
            You signed in with Google. Set a password to also log in with your
            email and password.
          </p>
        ) : null}

        {error ? <ErrorNote message={error} /> : null}
        {done ? (
          <p
            role="status"
            className="rounded-xl border border-green/30 bg-green/10 px-3.5 py-2.5 text-sm font-semibold text-green"
          >
            {isSet ? "Password changed ✓" : "Password set ✓"}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {isSet ? (
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
          ) : null}
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
          <Field label="Confirm new password">
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? isSet
                ? "Changing…"
                : "Setting…"
              : isSet
                ? "Change password"
                : "Set password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
