/**
 * CSV building and export date ranges (pure; tested in csv.test.ts).
 *
 * Safety: a cell that starts with = + - @ (or a tab / carriage return) is prefixed with an apostrophe,
 * so a donor name like "=HYPERLINK(...)" is shown as text instead of running as a formula when a funder
 * opens the file in Excel or Google Sheets ("CSV injection").
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A whole CSV file: UTF-8 byte-order mark (so Excel reads accents correctly), CRLF line endings. */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Cents as a plain rand number for spreadsheets: 25050 -> "250.50" (no currency symbol, dot decimal). */
export function centsToRand(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD HH:MM" in Johannesburg time. */
export function sastDateTime(d: Date): string {
  return new Date(d.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

function sastDay(d: Date): string {
  return new Date(d.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant a Johannesburg calendar day starts, or null if it isn't a real date. */
function sastDayStart(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const utcMidnight = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(utcMidnight.getTime()) || utcMidnight.toISOString().slice(0, 10) !== iso) return null;
  return new Date(utcMidnight.getTime() - SAST_OFFSET_MS);
}

export type DateRange = { from: string; to: string; start: Date; end: Date };

export const DEFAULT_RANGE_DAYS = 365;

/**
 * "from" and "to" are Johannesburg calendar days, both included. A missing "to" is today; a missing
 * "from" is 12 months before "to". Returns the instants [start, end) to filter paidAt with.
 */
export function parseDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
  now: Date,
): DateRange | { error: string } {
  const toDay = to || sastDay(now);
  const toStart = sastDayStart(toDay);
  if (!toStart) return { error: "'to' must be a real date (YYYY-MM-DD)." };
  const fromDay = from || sastDay(new Date(toStart.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS));
  const start = sastDayStart(fromDay);
  if (!start) return { error: "'from' must be a real date (YYYY-MM-DD)." };
  if (start > toStart) return { error: "'from' must be on or before 'to'." };
  return { from: fromDay, to: toDay, start, end: new Date(toStart.getTime() + DAY_MS) };
}

/** Default values for the date inputs on the export forms. */
export function defaultRangeInputs(now: Date): { from: string; to: string } {
  const r = parseDateRange(null, null, now) as DateRange;
  return { from: r.from, to: r.to };
}
