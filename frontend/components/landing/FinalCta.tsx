import Link from "next/link";
import GetStartedCtas from "./GetStartedCtas";

export default function FinalCta() {
  return (
    <section id="get-started" className="scroll-mt-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-24">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Start your first circle today.
        </h2>
        <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink/75">
          Create your free account and turn your paper collection card into one
          screen — in minutes.
        </p>
        <GetStartedCtas className="mt-8 justify-center" />
        <p className="mt-6 text-sm text-ink/70">
          Already run an ajo?{" "}
          <Link
            href="/become-a-collector"
            className="font-semibold text-green underline underline-offset-2"
          >
            Apply to be a collector
          </Link>{" "}
          and bring your circle today.
        </p>
      </div>
    </section>
  );
}
