const LOGO_CELLS: ReadonlyArray<"green" | "gold"> = [
  "green",
  "green",
  "gold",
  "green",
  "gold",
  "green",
  "green",
  "green",
  "green",
];

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-6 w-6 shrink-0 grid-cols-3 gap-[2px] ${className}`}
    >
      {LOGO_CELLS.map((cell, i) => (
        <span
          key={i}
          className={`rounded-[2px] ${cell === "gold" ? "bg-gold" : "bg-green"}`}
        />
      ))}
    </span>
  );
}

const NAV_LINKS = [
  { label: "Why BookAm", href: "#why" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
] as const;

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6"
      >
        <a href="#top" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-xl font-bold tracking-tight">
            BookAm
          </span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink/70 transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/login"
            className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink/80 transition-colors hover:border-green hover:text-green"
          >
            Sign in
          </a>
          <a
            href="#early-access"
            className="rounded-xl bg-green px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-green-deep"
          >
            Get early access
          </a>
        </div>
      </nav>
    </header>
  );
}
