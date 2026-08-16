"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  PageHeader,
  Spinner,
  inputClass,
} from "@/components/admin/ui";
import { adminApi } from "@/lib/admin/api";

const PLANNED_SETTINGS = [
  {
    title: "Default plan",
    description:
      "Which subscription plan new coordinators land on after approval.",
  },
  {
    title: "Payment collection",
    description:
      "Paystack keys and webhook for collecting BookAm's subscription fees. (Fees only — members' ajo money never passes through BookAm.)",
  },
] as const;

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Platform-wide configuration."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ContactInfoCard />
        {PLANNED_SETTINGS.map((setting) => (
          <Card key={setting.title} className="px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold">
                {setting.title}
              </h2>
              <span className="rounded-full bg-ink/5 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-ink/50">
                Coming soon
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted">{setting.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Support contact form — WhatsApp number + email that coordinators and members
 * see in their dashboards so they know how to reach BookAm for help. Leave a
 * field blank to hide it.
 */
function ContactInfoCard() {
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getSettings()
      .then((s) => {
        if (cancelled) return;
        setWhatsapp(s.supportWhatsapp ?? "");
        setEmail(s.supportEmail ?? "");
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load settings");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const updated = await adminApi.updateSettings({
        supportWhatsapp: whatsapp,
        supportEmail: email,
      });
      setWhatsapp(updated.supportWhatsapp ?? "");
      setEmail(updated.supportEmail ?? "");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="px-5 py-4">
      <h2 className="font-display text-base font-bold">Contact info</h2>
      <p className="mt-1.5 text-sm text-muted">
        Support WhatsApp number and email shown to coordinators and members in
        the app. Leave a field blank to hide it.
      </p>

      {loading ? (
        <div className="py-6">
          <Spinner label="Loading…" />
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3">
          {error ? <ErrorNote message={error} /> : null}
          <Field label="Support WhatsApp number">
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(e.target.value);
                setSaved(false);
              }}
              placeholder="+234 800 000 0000"
              className={inputClass}
            />
          </Field>
          <Field label="Support email">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSaved(false);
              }}
              placeholder="support@bookam.app"
              className={inputClass}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
            {saved ? (
              <span className="text-sm font-medium text-green">Saved ✓</span>
            ) : null}
          </div>
        </form>
      )}
    </Card>
  );
}
