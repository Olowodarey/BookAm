interface Step {
  number: string;
  title: string;
  body: string;
}

const STEPS: readonly Step[] = [
  {
    number: "01",
    title: "Create your circle",
    body: "Give it a name, set the amount and how often members pay — daily, weekly or monthly.",
  },
  {
    number: "02",
    title: "Add your members",
    body: "Add them yourself or share your circle link on WhatsApp and let them join.",
  },
  {
    number: "03",
    title: "Tick as they pay",
    body: "When a member pays you, tick their box. BookAm keeps the card — everybody sees the same record.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-green">
          How it works
        </p>
        <h2 className="mt-4 max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          From first member to full circle, in three steps.
        </h2>

        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map((step) => (
            <li key={step.number} className="relative">
              <span className="font-mono text-4xl font-bold text-gold">
                {step.number}
              </span>
              <h3 className="mt-3 font-display text-xl font-bold">
                {step.title}
              </h3>
              <p className="mt-2 leading-relaxed text-ink/70">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
