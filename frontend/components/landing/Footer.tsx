import { LogoMark } from "./Nav";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-lg font-bold tracking-tight">
            BookAm
          </span>
        </div>
        <p className="text-sm text-muted">
          A simpler way to run ajo, esusu &amp; adashe · © 2026
        </p>
      </div>
    </footer>
  );
}
