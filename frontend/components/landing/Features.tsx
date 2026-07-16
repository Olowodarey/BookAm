import type { ReactElement } from "react";

interface Feature {
  title: string;
  body: string;
  icon: ReactElement;
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-6 w-6",
  "aria-hidden": true,
} as const;

const FEATURES: readonly Feature[] = [
  {
    title: "Paid & owing at a glance",
    body: "Open one screen and see green ticks for who has paid and who is still owing. No page-flipping.",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
        <path d="M14.5 17.5l2 2 4-4.5" />
      </svg>
    ),
  },
  {
    title: "Know who collects next",
    body: "The rotation is set from day one. Everybody can see whose turn it is — no argument, no favouritism talk.",
    icon: (
      <svg {...iconProps}>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 3v4h-4" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
  },
  {
    title: "Remind on WhatsApp",
    body: "Send a ready-made reminder straight to a member's WhatsApp. One tap, no long story.",
    icon: (
      <svg {...iconProps}>
        <path d="M21 12a9 9 0 1 0-3.6 7.2L21 21l-1.2-3.6A8.96 8.96 0 0 0 21 12z" />
        <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth={2.4} />
      </svg>
    ),
  },
  {
    title: "Add members with a link",
    body: "Share one link on your group chat and members join your circle themselves. No typing names one by one.",
    icon: (
      <svg {...iconProps}>
        <path d="M10 14a5 5 0 0 0 7.07 0l2.5-2.5a5 5 0 0 0-7.07-7.07L11 5.93" />
        <path d="M14 10a5 5 0 0 0-7.07 0l-2.5 2.5a5 5 0 0 0 7.07 7.07L13 18.07" />
      </svg>
    ),
  },
  {
    title: "Run all your circles",
    body: "Daily, weekly, monthly — keep every circle you coordinate in one place, each with its own card.",
    icon: (
      <svg {...iconProps}>
        <circle cx="9" cy="9" r="5.5" />
        <path d="M15.5 8.6a5.5 5.5 0 1 1-6.9 6.9" />
      </svg>
    ),
  },
  {
    title: "Never lose a record",
    body: "Your records live safely in your account, not in a notebook that can tear, soak or walk away.",
    icon: (
      <svg {...iconProps}>
        <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4.5" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-green">
          Features
        </p>
        <h2 className="mt-4 max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Your whole circle, on one screen.
        </h2>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-line bg-white p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green/10 text-green">
                {feature.icon}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">
                {feature.title}
              </h3>
              <p className="mt-2 leading-relaxed text-ink/70">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
