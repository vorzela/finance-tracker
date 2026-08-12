/**
 * lib/currency.ts
 *
 * Converts between minor units (how money is stored) and the strings people
 * read or type.
 */

const SYMBOLS: Record<string, string> = {
  KES: "KSh",
  USD: "$",
  EUR: "€",
  GBP: "£",
  UGX: "USh",
  TZS: "TSh",
  NGN: "₦",
  ZAR: "R",
  GHS: "GH₵",
  INR: "₹",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
};

/** Currencies with no fractional unit, where one major unit is one minor unit. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "UGX", "TZS", "VND", "CLP", "ISK"]);

export const CURRENCY_OPTIONS = Object.keys(SYMBOLS);

export const DEFAULT_CURRENCY = "KES";

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? code;
}

export function fractionDigits(code: string): number {
  return ZERO_DECIMAL.has(code) ? 0 : 2;
}

function minorPerMajor(code: string): number {
  return fractionDigits(code) === 0 ? 1 : 100;
}

/**
 * `"1,234.50"` -> `123450`. Returns `null` when the text is not a positive
 * number, which is what the forms use to decide whether to show an error.
 */
export function parseAmount(input: string, code: string): number | null {
  const cleaned = input.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  if (!cleaned || cleaned === ".") return null;

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;

  return Math.round(value * minorPerMajor(code));
}

/** `123450` -> `"1234.50"`, digits only so it can seed a numeric TextInput. */
export function toAmountInput(minor: number, code: string): string {
  return (minor / minorPerMajor(code)).toFixed(fractionDigits(code));
}

/** Whole major units, for compact chart axis labels. */
export function toMajor(minor: number, code: string): number {
  return minor / minorPerMajor(code);
}

export interface FormatMoneyOptions {
  /** Prefix positive values with `+`. Negatives always get `-`. */
  showSign?: boolean;
  /** Drop the decimals — used in tight spots like chart labels. */
  compact?: boolean;
  /** Omit the currency symbol. */
  bare?: boolean;
}

/**
 * `123450` -> `"KSh1,234.50"`. Falls back to manual digit grouping when the JS
 * engine was built without full-ICU `Intl` data.
 */
export function formatMoney(
  minor: number,
  code: string,
  options: FormatMoneyOptions = {},
): string {
  const { showSign = false, compact = false, bare = false } = options;
  const digits = compact ? 0 : fractionDigits(code);
  const value = Math.abs(minor) / minorPerMajor(code);

  let body: string;
  try {
    body = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    body = groupDigits(value.toFixed(digits));
  }

  const sign = minor < 0 ? "-" : showSign && minor > 0 ? "+" : "";
  return `${sign}${bare ? "" : currencySymbol(code)}${body}`;
}

/** `1234567` -> `"1.2M"`, for axis ticks where every character counts. */
export function formatCompactNumber(minor: number, code: string): string {
  const value = Math.abs(minor) / minorPerMajor(code);
  if (value >= 1_000_000) return `${trimZero(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trimZero(value / 1_000)}k`;
  return String(Math.round(value));
}

function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function groupDigits(fixed: string): string {
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** `0.734` -> `"73%"`. */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${Math.round(ratio * 100)}%`;
}
