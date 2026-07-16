interface PainPoint {
  title: string;
  body: string;
}

const PAIN_POINTS: readonly PainPoint[] = [
  {
    title: "“Who has paid this week?”",
    body: "Flipping pages, counting ticks one by one, calling members to cross-check. Every week, same story.",
  },
  {
    title: "Torn cards, missing pages",
    body: "One card enters water or one page tears, and the whole circle starts arguing about who paid what.",
  },
  {
    title: "Chasing everybody",
    body: "Reminders na by mouth and by leg. If you no call, dem no remember — and market day no dey wait.",
  },
];

export default function Problem() {
  return (
    <section id="why" className="scroll-mt-20 bg-green-deep text-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-gold">
          The notebook problem
        </p>
        <h2 className="mt-4 max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          You know this wahala.
        </h2>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PAIN_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-2xl border border-paper/15 bg-paper/5 p-6"
            >
              <h3 className="font-display text-xl font-bold text-gold">
                {point.title}
              </h3>
              <p className="mt-3 leading-relaxed text-paper/80">{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
