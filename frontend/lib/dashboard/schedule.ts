import type { CircleFrequency } from "./types";

export interface BufferOption {
  days: number;
  label: string;
}

/**
 * Frequency-aware "members pay by" suggestions. The recommended gap scales with
 * how far apart rounds are: none for daily (same-day), a couple of days for
 * weekly, a few for monthly — so coordinators get a sensible default they can
 * still override. `recommended` is always one of `options`.
 */
export function bufferSuggestion(freq: CircleFrequency): {
  recommended: number;
  options: BufferOption[];
} {
  switch (freq) {
    case "DAILY":
      // Rounds are only a day apart, so any days-based buffer would land on the
      // previous round — collect on the payout day itself.
      return { recommended: 0, options: [{ days: 0, label: "On payout day" }] };
    case "WEEKLY":
      return {
        recommended: 2,
        options: [
          { days: 0, label: "On payout day" },
          { days: 1, label: "1 day before" },
          { days: 2, label: "2 days before" },
          { days: 3, label: "3 days before" },
        ],
      };
    case "MONTHLY":
    default:
      return {
        recommended: 3,
        options: [
          { days: 2, label: "2 days before" },
          { days: 3, label: "3 days before" },
          { days: 4, label: "4 days before" },
          { days: 5, label: "5 days before" },
          { days: 7, label: "1 week before" },
        ],
      };
  }
}

/**
 * Advance a UTC instant by the circle frequency, `times` steps. Mirrors the
 * backend's advanceDeadline so previews match what members will actually see.
 */
export function advanceInstant(
  iso: string,
  freq: CircleFrequency,
  times: number,
): string {
  const d = new Date(iso);
  for (let i = 0; i < times; i += 1) {
    if (freq === "DAILY") d.setUTCDate(d.getUTCDate() + 1);
    else if (freq === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d.toISOString();
}

/** Subtract whole days from a UTC instant. */
export function minusDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export interface ScheduleRow {
  round: number;
  dueAt: string;
  payoutAt: string;
}

/**
 * The first `rounds` rounds as {deadline, payout} instants — used for the
 * create-form preview. Round N's payout advances by frequency; its deadline is
 * the payout minus the buffer, exactly the gap the backend keeps each round.
 */
export function schedulePreview(
  firstPayoutISO: string,
  bufferDays: number,
  freq: CircleFrequency,
  rounds = 3,
): ScheduleRow[] {
  return Array.from({ length: rounds }, (_, i) => {
    const payoutAt = advanceInstant(firstPayoutISO, freq, i);
    return { round: i + 1, dueAt: minusDays(payoutAt, bufferDays), payoutAt };
  });
}
