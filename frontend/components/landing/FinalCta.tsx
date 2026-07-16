import WaitlistForm from "./WaitlistForm";

export default function FinalCta() {
  return (
    <section id="early-access" className="scroll-mt-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-24">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Be the first coordinator on BookAm.
        </h2>
        <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink/75">
          Drop your WhatsApp number and we&apos;ll reach out when early access
          opens for your area.
        </p>
        <div className="mt-8 flex w-full justify-center">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
