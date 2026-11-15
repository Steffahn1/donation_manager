import { describe, expect, it } from "vitest";
import { centsToRand, csvCell, parseDateRange, sastDateTime, toCsv, type DateRange } from "./csv";

describe("csvCell / toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it.each(["=HYPERLINK(\"http://evil\")", "+27 123", "-1+1", "@SUM(A1)", "\tx", "\rx"])(
    "neutralises a cell that could run as a spreadsheet formula: %j",
    (value) => {
      const cell = csvCell(value);
      expect(cell.startsWith('"\'')).toBe(true); // quoted and prefixed with an apostrophe
    },
  );

  it("leaves negative-looking numbers that are real numbers alone (amounts are passed as strings we build)", () => {
    expect(csvCell(-5)).toBe("-5");
  });

  it("starts with a byte-order mark and uses CRLF line endings", () => {
    const csv = toCsv(["Name", "Amount"], [["Café", "250.50"]]);
    expect(csv).toBe("﻿Name,Amount\r\nCafé,250.50\r\n");
  });
});

describe("centsToRand", () => {
  it("formats cents as a plain rand number for spreadsheets", () => {
    expect(centsToRand(25050)).toBe("250.50");
    expect(centsToRand(5)).toBe("0.05");
    expect(centsToRand(100_000_00)).toBe("100000.00");
  });
});

describe("sastDateTime", () => {
  it("shows Johannesburg time", () => {
    expect(sastDateTime(new Date("2026-11-12T22:30:00Z"))).toBe("2026-11-13 00:30");
  });
});

describe("parseDateRange", () => {
  const NOW = new Date("2026-11-15T10:00:00Z");

  it("includes both days, in Johannesburg time", () => {
    const r = parseDateRange("2026-11-01", "2026-11-14", NOW) as DateRange;
    expect(r.start.toISOString()).toBe("2026-10-31T22:00:00.000Z"); // 1 Nov 00:00 SAST
    expect(r.end.toISOString()).toBe("2026-11-14T22:00:00.000Z"); // 15 Nov 00:00 SAST (exclusive)
  });

  it("defaults to the last 12 months up to today", () => {
    const r = parseDateRange(null, "", NOW) as DateRange;
    expect(r.to).toBe("2026-11-15");
    expect(r.from).toBe("2025-11-16");
  });

  it("counts a missing 'from' back from the chosen 'to', not from today", () => {
    const r = parseDateRange(null, "2025-01-01", NOW) as DateRange;
    expect(r.from).toBe("2024-01-03");
    expect(r.to).toBe("2025-01-01");
  });

  it("allows a single day", () => {
    expect("error" in parseDateRange("2026-11-14", "2026-11-14", NOW)).toBe(false);
  });

  it.each([
    ["2026-02-31", "2026-03-01", "'from' must be a real date"],
    ["2026-11-01", "14/11/2026", "'to' must be a real date"],
    ["2026-11-14", "2026-11-01", "on or before"],
    ["'; DROP TABLE", "2026-11-01", "'from' must be a real date"],
  ])("rejects from=%j to=%j", (from, to, message) => {
    const r = parseDateRange(from, to, NOW);
    expect("error" in r && r.error).toContain(message);
  });
});
