import { describe, expect, it } from "vitest";
import { formatZar, impactUnits, parseRandToCents } from "./money";

describe("parseRandToCents", () => {
  it.each([
    ["250", 25000],
    ["R250", 25000],
    ["r 250", 25000],
    ["250.50", 25050],
    ["250,50", 25050], // South African decimal comma
    ["250,5", 25050],
    ["0,5", 50],
    ["1 000", 100000],
    ["1 000,00", 100000],
    ["R 1 234,50", 123450],
    ["1,000", 100000],
    ["1,000.00", 100000],
    ["12,345,678.90", 1234567890],
    ["1.000", 100000],
    ["1.000,50", 100050],
    ["250,505", 25050500], // three digits after a comma = thousands, never 3 decimals
    ["007", 700],
    ["12 345 678,90", 1234567890],
    ["  250  ", 25000],
  ])("parses %j as %i cents", (input, cents) => {
    expect(parseRandToCents(input)).toBe(cents);
  });

  it("round-trips everything formatZar displays", () => {
    for (const cents of [50, 2000, 25050, 123450, 10_000_000, 99_999_999]) {
      expect(parseRandToCents(formatZar(cents))).toBe(cents);
    }
  });

  it.each(["", "R", "abc", "-50", "1,2345", "1.000.00", "250,5050", "1,00,000", "12e3", "1 000.000", "1234567890", "250 50", "1 00", "10 000 0", "1 000,000"])(
    "rejects %j",
    (input) => {
      expect(parseRandToCents(input)).toBeNull();
    },
  );
});

describe("impactUnits", () => {
  it("counts whole impact units only", () => {
    expect(impactUnits(125000, 50000)).toBe(2);
    expect(impactUnits(49999, 50000)).toBe(0);
  });

  it("returns 0 for a non-positive impact amount", () => {
    expect(impactUnits(100000, 0)).toBe(0);
  });
});
