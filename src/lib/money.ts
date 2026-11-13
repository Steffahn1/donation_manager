// All money is ZAR, stored as integer cents.

export const CURRENCY = "ZAR";

/** Stripe's minimum charge is roughly R10; we require at least R20 to be safe. */
export const MIN_DONATION_CENTS = 2000;
export const MAX_DONATION_CENTS = 100_000_00; // R100 000

const formatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
});

export function formatZar(cents: number): string {
  return formatter.format(cents / 100);
}

/** Longest whole-rand part we accept (R999 999 999); keeps the result a safe integer. */
const MAX_WHOLE_DIGITS = 9;

/**
 * Parse a rand amount typed by a person into cents, or null if it is not clearly an amount.
 *
 * South Africa writes "R 1 234,50" (decimal comma, which is also what formatZar shows), but people
 * also type "1,234.50" or "1234.50". Rules:
 * - spaces (including the non-breaking ones Intl uses) are thousands separators, but only between
 *   groups of exactly 3 digits ("1 000" yes, "250 50" no: that would silently be R25 050)
 * - "," or "." followed by 1-2 digits at the end is the decimal separator
 * - "," or "." followed by groups of exactly 3 digits is a thousands separator
 * - anything else ("1,2345", "1.000.00", "R", "") is rejected rather than guessed
 */
export function parseRandToCents(input: string): number | null {
  const trimmed = input.trim().replace(/^R\s*/i, "");
  // Spaces must group thousands: "1 000", "12 345 678,90". Anything else with a space is rejected.
  if (/\s/.test(trimmed) && !/^\d{1,3}(?:\s\d{3})+(?:[.,]\d{1,2})?$/.test(trimmed)) return null;
  const s = trimmed.replace(/\s/g, "");

  let whole: string;
  let frac = "";
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+)(?:[.,](\d{1,2}))?$/))) {
    // "250", "250,5", "250.50"
    [, whole, frac = ""] = m;
  } else if ((m = s.match(/^(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/))) {
    // "1,000" or "1,000.50"
    whole = m[1].replace(/,/g, "");
    frac = m[2] ?? "";
  } else if ((m = s.match(/^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/))) {
    // "1.000" or "1.000,50"
    whole = m[1].replace(/\./g, "");
    frac = m[2] ?? "";
  } else {
    return null;
  }

  whole = whole.replace(/^0+(?=\d)/, "");
  if (whole.length > MAX_WHOLE_DIGITS) return null;
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** How many impact units (e.g. families fed) an amount pays for. */
export function impactUnits(amountCents: number, impactAmountCents: number): number {
  if (impactAmountCents <= 0) return 0;
  return Math.floor(amountCents / impactAmountCents);
}
