/**
 * The coordinator's cut and what the collector nets, given a pot and a whole-
 * percent fee. Rounded to the nearest naira. Records only — BookAm never holds
 * or moves either amount.
 */
export function feeBreakdown(
  potNaira: number,
  feePercent: number,
): { feeNaira: number; netPayoutNaira: number } {
  const feeNaira = Math.round((potNaira * feePercent) / 100);
  return { feeNaira, netPayoutNaira: potNaira - feeNaira };
}
