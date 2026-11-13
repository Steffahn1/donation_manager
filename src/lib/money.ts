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

/** Parse a rand amount typed by a person ("150", "150.50", "R 1 000") into cents. */
export function parseRandToCents(input: string): number | null {
  const cleaned = input.replace(/[R\s,]/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** How many impact units (e.g. families fed) an amount pays for. */
export function impactUnits(amountCents: number, impactAmountCents: number): number {
  if (impactAmountCents <= 0) return 0;
  return Math.floor(amountCents / impactAmountCents);
}
