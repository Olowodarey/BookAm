import type { CircleFrequency } from '@prisma/client';

/**
 * The next round's deadline: advance the previous one by the circle's
 * frequency — daily +1 day, weekly +7 days, monthly +1 calendar month.
 * Works on absolute instants (stored UTC); WAT display is a formatting concern.
 */
export function advanceDeadline(from: Date, frequency: CircleFrequency): Date {
  const next = new Date(from);
  switch (frequency) {
    case 'DAILY':
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }
  return next;
}
