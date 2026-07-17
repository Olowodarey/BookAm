import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import ApplySection from "./ApplySection";

export const metadata: Metadata = {
  title: "Become a collector · BookAm",
  description:
    "You're the alajo? Move your paper collection card to BookAm — record contributions, verify receipts, and let your whole circle see the same book.",
};

const STEPS = [
  {
    title: "Create your account",
    body: "Sign up with the same phone number your WhatsApp group knows you by. Everyone starts as a contributor.",
  },
  {
    title: "Tell us about your ajo",
    body: "Apply as a collector with a short note — group size, how long you've run it, where. The BookAm admin reviews it.",
  },
  {
    title: "Open your dashboard",
    body: "Once approved, create your circle, add your members (or share an invite link), and your digital collection card is live.",
  },
] as const;

const BENEFITS = [
  {
    title: "Your card, digital",
    body: "The same collection card you keep on paper — green ticks for paid, plain boxes for owing — visible to you and every member.",
  },
  {
    title: "Receipts, not stories",
    body: "Members attach transfer receipts; you verify or reject with one tap. No more \"I sent it that day\" arguments.",
  },
  {
    title: "Everybody sees the same book",
    body: "Who has paid, whose turn is next, what the pot is — one record, open to the whole circle. Trust, kept simple.",
  },
  {
    title: "Your money stays yours",
    body: "BookAm never holds or moves the contributions. Members keep paying you directly, exactly as they do today.",
  },
] as const;

export default function BecomeCollectorPage() {
  return (
    <div className="bg-paper text-ink">
      <Nav />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:px-6 sm:pt-20">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-green">
              For alajos, esusu &amp; adashe coordinators
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              You keep the circle.
              <br />
              <span className="text-green">BookAm keeps the book.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink/80">
              You already run the ajo — collecting, recording, settling
              &ldquo;who paid?&rdquo; questions on WhatsApp. Move your
              collection card to BookAm and let the record speak for itself.
            </p>
          </div>
        </section>

        {/* Benefits */}
        <section aria-label="Why collectors use BookAm" className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {BENEFITS.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-2xl border-2 border-ink bg-white p-5 shadow-[6px_6px_0_0_rgba(15,90,64,0.14)]"
              >
                <h2 className="font-display text-lg font-bold">
                  {benefit.title}
                </h2>
                <p className="mt-1.5 text-sm text-ink/80">{benefit.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section
          aria-label="How to become a collector"
          className="mx-auto max-w-6xl px-4 py-12 sm:px-6"
        >
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Three steps, no wahala
          </h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="rounded-2xl border border-line bg-white/60 p-5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green font-mono text-sm font-bold text-gold">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-display text-base font-bold">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-ink/80">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Apply — adapts to whether the visitor is signed in */}
        <section
          aria-label="Apply"
          className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"
        >
          <ApplySection />
        </section>
      </main>

      <Footer />
    </div>
  );
}
