"use client";

import { useEffect, useState } from "react";

export interface AjoCardProps {
  memberName: string;
  circleName: string;
  /** Display amount, e.g. "₦5,000 / week" */
  amount: string;
  /** Rotation position, e.g. "4th" */
  position: string;
  weeksPaid: number;
  totalWeeks: number;
}

export default function AjoCard({
  memberName,
  circleName,
  amount,
  position,
  weeksPaid,
  totalWeeks,
}: AjoCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Wait one frame so the server-rendered final state paints first,
    // then let the paid boxes tick in.
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const weeks = Array.from({ length: totalWeeks }, (_, i) => ({
    week: i + 1,
    paid: i < weeksPaid,
  }));

  return (
    <div className="relative" aria-label={`Example member card for ${memberName} in ${circleName}: ${amount}, collects ${position}, paid ${weeksPaid} of ${totalWeeks} weeks`}>
      {/* Floating "Paid" chip */}
      <div
        aria-hidden="true"
        className="absolute -top-4 -right-3 z-10 rotate-3 rounded-full bg-gold px-4 py-1.5 font-mono text-sm font-bold text-ink shadow-[0_4px_12px_rgba(20,35,28,0.25)] motion-safe:animate-chip-float sm:-right-5"
      >
        Paid ✓
      </div>

      <div className="-rotate-1 rounded-2xl border-2 border-ink bg-white p-6 shadow-[10px_10px_0_0_rgba(15,90,64,0.16)] sm:p-7">
        {/* Card header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {circleName}
            </p>
            <p className="mt-1 font-display text-2xl font-bold leading-none">
              {memberName}
            </p>
          </div>
          <span className="shrink-0 rounded-md border-2 border-gold bg-gold/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-green-deep">
            Collects {position}
          </span>
        </div>

        <p className="mt-4 font-mono text-lg font-bold text-green">{amount}</p>

        {/* Week grid */}
        <div className="mt-5 grid grid-cols-4 gap-2.5" aria-hidden="true">
          {weeks.map(({ week, paid }) =>
            paid ? (
              <div
                key={week}
                style={mounted ? { animationDelay: `${week * 90}ms` } : undefined}
                className={`flex aspect-square items-center justify-center rounded-lg bg-green ${
                  mounted ? "motion-safe:animate-tick-pop" : ""
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6 text-gold"
                  strokeWidth={3.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l5 5 10-11"
                  />
                </svg>
              </div>
            ) : (
              <div
                key={week}
                className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-line font-mono text-sm text-muted"
              >
                {week}
              </div>
            )
          )}
        </div>

        {/* Card footer */}
        <div className="mt-5 flex items-center justify-between border-t-2 border-line pt-4">
          <p className="text-sm text-muted">Paid this cycle</p>
          <p className="font-mono text-sm font-bold">
            {weeksPaid} / {totalWeeks} weeks
          </p>
        </div>
      </div>
    </div>
  );
}
