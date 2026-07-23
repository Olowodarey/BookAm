import AjoCard from "./AjoCard";
import WaitlistForm from "./WaitlistForm";

export default function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:pb-28 lg:pt-24">
      {/* Card first on mobile, right column on desktop */}
      <div className="mx-auto w-full max-w-sm lg:order-2 lg:max-w-md">
        <AjoCard
          memberName="Chidinma A."
          circleName="Owerri Market Circle"
          amount="₦5,000 / week"
          position="4th"
          weeksPaid={8}
          totalWeeks={12}
        />
      </div>

      <div className="lg:order-1">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-green">
          For ajo · esusu · adashe coordinators
        </p>

        <h1 className="mt-4 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
          Run your ajo without the{" "}
          <span className="relative inline-block">
            notebook
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-1 -z-10 h-3 -rotate-1 rounded-sm bg-gold/70"
            />
          </span>
          .
        </h1>

        <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/75">
          BookAm turns your paper collection card into one screen — who has
          paid, who is owing, and who collects next. No more counting ticks by
          torchlight.
        </p>

        <div className="mt-8">
          <WaitlistForm source="hero" />
        </div>

        <p className="mt-4 text-sm text-muted">
          Free to start · No bank details · Money moves between members, never
          through us
        </p>
      </div>
    </section>
  );
}
