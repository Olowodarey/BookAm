"use client";

import { Card, PageHeader } from "@/components/admin/ui";

const PLANNED_SETTINGS = [
  {
    title: "Default plan",
    description:
      "Which subscription plan new coordinators land on after approval.",
  },
  {
    title: "Contact info",
    description:
      "Support WhatsApp number and email shown to coordinators in the app.",
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
        subtitle="Platform-wide configuration. These controls are coming soon."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
