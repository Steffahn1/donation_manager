import { describe, expect, it } from "vitest";
import { attemptIdSchema, parseDonationDetails, valuesFromForm, type DonateValues } from "./donations";
import { MAX_DONATION_CENTS, MIN_DONATION_CENTS } from "./money";

const valid: DonateValues = { name: "Test Donor", email: "Donor@Example.test", amount: "250", anonymous: false };

describe("parseDonationDetails", () => {
  it("accepts valid details and normalises email and amount", () => {
    const r = parseDonationDetails({ ...valid, amount: "250,50" });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ name: "Test Donor", email: "donor@example.test", amountCents: 25050, anonymous: false });
  });

  it("enforces the minimum and maximum donation", () => {
    const at = (cents: number) => parseDonationDetails({ ...valid, amount: (cents / 100).toFixed(2) }).success;
    expect(at(MIN_DONATION_CENTS)).toBe(true);
    expect(at(MIN_DONATION_CENTS - 1)).toBe(false);
    expect(at(MAX_DONATION_CENTS)).toBe(true);
    expect(at(MAX_DONATION_CENTS + 1)).toBe(false);
  });

  it("reads a decimal comma as decimals, not as a 100x larger amount", () => {
    // "1000,01" is R1 000,01 (100001 cents). The old parser read it as R100 001.
    const r = parseDonationDetails({ ...valid, amount: "1000,01" });
    expect(r.success && r.data.amountCents).toBe(100001);
  });

  it.each([
    [{ amount: "abc" }, "Enter an amount"],
    [{ amount: "" }, "Enter an amount"],
    [{ name: " " }, "Enter your name"],
    [{ email: "not-an-email" }, "valid email"],
  ])("rejects %j", (override, message) => {
    const r = parseDonationDetails({ ...valid, ...override });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain(message);
  });
});

describe("valuesFromForm", () => {
  it("reads the anonymous checkbox ('on') and the hidden confirm field ('true')", () => {
    const fd = (anon?: string) => {
      const f = new FormData();
      f.set("name", "A");
      if (anon !== undefined) f.set("anonymous", anon);
      return f;
    };
    expect(valuesFromForm(fd("on")).anonymous).toBe(true);
    expect(valuesFromForm(fd("true")).anonymous).toBe(true);
    expect(valuesFromForm(fd("false")).anonymous).toBe(false);
    expect(valuesFromForm(fd()).anonymous).toBe(false);
  });
});

describe("attemptIdSchema", () => {
  it("accepts a generated token and rejects anything else", () => {
    expect(attemptIdSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(attemptIdSchema.safeParse("short").success).toBe(false);
    expect(attemptIdSchema.safeParse("x".repeat(40) + "'; DROP").success).toBe(false);
    expect(attemptIdSchema.safeParse(null).success).toBe(false);
  });
});
