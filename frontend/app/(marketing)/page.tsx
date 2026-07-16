import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import Problem from "@/components/landing/Problem";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Trust from "@/components/landing/Trust";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: { absolute: "BookAm — Run your ajo without the notebook" },
  description:
    "Digital record-keeping for ajo, esusu and adashe coordinators. See who has paid, who is owing and who collects next — on one screen. BookAm never holds money; members pay each other directly.",
};

export default function LandingPage() {
  return (
    <div id="top" className="flex min-h-full flex-1 flex-col">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <Trust />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
