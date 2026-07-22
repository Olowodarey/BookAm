import { BadRequestException } from '@nestjs/common';

/**
 * Validates an installment amount from an upload. When omitted, defaults to the
 * full expected amount (a single, in-full payment). Otherwise it must be a
 * positive whole number of naira.
 */
export function resolveReceiptAmount(
  amountNaira: number | undefined,
  fallback: number,
): number {
  if (amountNaira === undefined) return fallback;
  if (!Number.isInteger(amountNaira) || amountNaira <= 0) {
    throw new BadRequestException(
      'Amount must be a positive whole number of naira',
    );
  }
  return amountNaira;
}

/** Parses the optional `amount` field from a multipart upload (a string). */
export function parseAmountField(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  return Number(raw);
}
