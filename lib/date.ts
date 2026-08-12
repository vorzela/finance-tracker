/**
 * lib/date.ts
 *
 * Calendar helpers built around two string keys:
 *   • a day key,   `YYYY-MM-DD`
 *   • a month key, `YYYY-MM`
 *
 * Strings sort chronologically and compare cheaply, which keeps grouping and
 * filtering simple. Everything below works in the device's local timezone —
 * `new Date("2026-08-15")` would be parsed as UTC and can shift the day, so we
 * always build dates from explicit parts.
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `Date` -> `"2026-08-15"` using local time. */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `"2026-08-15"` -> local `Date` at midnight. */
export function fromDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function todayKey(): string {
  return toDayKey(new Date());
}

/** `"2026-08-15"` -> `"2026-08"`. */
export function toMonthKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function currentMonthKey(): string {
  return toMonthKey(todayKey());
}

/** Shifts a month key by whole months, rolling the year over as needed. */
export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

/** `"2026-08"` -> `"August 2026"`. */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** `"2026-08"` -> `"Aug 2026"`. */
export function shortMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`;
}

export function isCurrentMonth(monthKey: string): boolean {
  return monthKey === currentMonthKey();
}

/**
 * How far through the month we are, used for pace projections. Past months
 * count as fully elapsed and future months as not started.
 */
export function monthProgress(monthKey: string): {
  dayOfMonth: number;
  totalDays: number;
  elapsedRatio: number;
  daysRemaining: number;
} {
  const totalDays = daysInMonth(monthKey);
  const current = currentMonthKey();

  let dayOfMonth: number;
  if (monthKey === current) dayOfMonth = new Date().getDate();
  else if (monthKey < current) dayOfMonth = totalDays;
  else dayOfMonth = 0;

  return {
    dayOfMonth,
    totalDays,
    elapsedRatio: totalDays === 0 ? 0 : dayOfMonth / totalDays,
    daysRemaining: Math.max(0, totalDays - dayOfMonth),
  };
}

/** `"2026-08-15"` -> `"Today"`, `"Yesterday"`, or `"Sat, 15 Aug"`. */
export function dayLabel(dayKey: string): string {
  const today = todayKey();
  if (dayKey === today) return "Today";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === toDayKey(yesterday)) return "Yesterday";

  const date = fromDayKey(dayKey);
  const name = DAY_NAMES[date.getDay()];
  const month = MONTH_NAMES[date.getMonth()].slice(0, 3);
  const suffix =
    date.getFullYear() === new Date().getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${name}, ${date.getDate()} ${month}${suffix}`;
}

/** `"2026-08-15"` -> `"15 Aug"`. */
export function shortDayLabel(dayKey: string): string {
  const date = fromDayKey(dayKey);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;
}

/** `"2026-08-15"` -> `15`. */
export function dayOfMonth(dayKey: string): number {
  return Number(dayKey.slice(8, 10));
}

/** Every day key in a month, chronologically — the x-axis of the trend chart. */
export function monthDayKeys(monthKey: string): string[] {
  const total = daysInMonth(monthKey);
  return Array.from({ length: total }, (_, index) => `${monthKey}-${pad(index + 1)}`);
}

/** Shifts a day key by whole days. */
export function addDays(dayKey: string, delta: number): string {
  const date = fromDayKey(dayKey);
  date.setDate(date.getDate() + delta);
  return toDayKey(date);
}

/** ISO timestamp -> the local day it falls on, `"2026-08-15"`. */
export function dayKeyOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? todayKey() : toDayKey(date);
}

/** ISO timestamp -> the local month it falls in, `"2026-08"`. */
export function monthKeyOf(iso: string): string {
  return toMonthKey(dayKeyOf(iso));
}

/**
 * The half-open ISO range covering a month in *local* time, for querying a
 * `timestamptz` column. Comparing the stored UTC instant against a local
 * boundary is the only way a month means the same thing on the phone and in
 * the database.
 */
export function monthRange(monthKey: string): { from: string; until: string } {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    from: new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString(),
    until: new Date(year, month, 1, 0, 0, 0, 0).toISOString(),
  };
}

/** A day key at a given wall-clock time, as an ISO timestamp. */
export function isoAt(dayKey: string, hours: number, minutes: number): string {
  const date = fromDayKey(dayKey);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/** Formats an ISO timestamp as `"9:12 AM"`. */
export function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

/** `"Today, 9:12 AM"` — the label rows use, since who spent when is the point. */
export function whenLabel(iso: string): string {
  return `${dayLabel(dayKeyOf(iso))}, ${timeLabel(iso)}`;
}

/** `"15 Aug, 9:12 AM"` — the compact form for dense lists. */
export function shortWhenLabel(iso: string): string {
  return `${shortDayLabel(dayKeyOf(iso))}, ${timeLabel(iso)}`;
}
