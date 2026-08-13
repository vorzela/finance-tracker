/**
 * lib/mpesa/parse.ts
 *
 * Turns an M-Pesa confirmation SMS into a draft the entry / import screens can
 * save. Kenyan Safaricom formats vary slightly; we cover the common ones.
 */

export type MpesaKind = "expense" | "income";

export interface ParsedMpesa {
  kind: MpesaKind;
  /** Minor units (cents). */
  amount: number;
  feeAmount: number;
  /** Best-effort counterparty or till name. */
  counterparty: string | null;
  reference: string | null;
  note: string;
  /** ISO timestamp when the SMS says it happened, else null. */
  occurredAt: string | null;
  raw: string;
}

const AMOUNT_RE =
  /(?:Ksh|KES|KSH)\s*([\d,]+(?:\.\d{1,2})?)/i;
const FEE_RE =
  /(?:Transaction\s+cost|Fee|Charged)\s*(?:is\s*)?(?:Ksh|KES|KSH)?\s*([\d,]+(?:\.\d{1,2})?)/i;
const REF_RE = /\b([A-Z0-9]{8,12})\b\s+(?:Confirmed|confirmed)/;
const DATE_RE =
  /on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i;

function toMinor(value: string): number {
  const n = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function parseOccurredAt(body: string): string | null {
  const match = body.match(DATE_RE);
  if (!match) return null;
  const [, datePart, timePart] = match;
  const [d, m, yRaw] = datePart.split("/").map(Number);
  const year = yRaw < 100 ? 2000 + yRaw : yRaw;
  const time = timePart.trim().toUpperCase();
  const ampm = time.endsWith("AM") || time.endsWith("PM") ? time.slice(-2) : "AM";
  const [hhRaw, mmRaw] = time.replace(/\s*(AM|PM)/, "").split(":").map(Number);
  let hours = hhRaw;
  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  const date = new Date(year, m - 1, d, hours, mmRaw || 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function detectKind(body: string): MpesaKind {
  const lower = body.toLowerCase();
  if (
    lower.includes("you have received") ||
    lower.includes("received from") ||
    lower.includes("has been credited") ||
    lower.includes("deposit of")
  ) {
    return "income";
  }
  return "expense";
}

function detectCounterparty(body: string, kind: MpesaKind): string | null {
  if (kind === "income") {
    const from =
      body.match(/from\s+([A-Z0-9 *.\-']+?)\s+(?:on|New|\d|Account)/i) ??
      body.match(/from\s+([A-Z0-9 *.\-']+)/i);
    return from?.[1]?.trim() || null;
  }
  const to =
    body.match(/sent to\s+([A-Z0-9 *.\-']+?)\s+for/i) ??
    body.match(/paid to\s+([A-Z0-9 *.\-']+?)\s+(?:on|\.|New|Acc)/i) ??
    body.match(/to\s+([A-Z0-9 *.\-']+?)\s+(?:on|for|Acc|\.)/i);
  return to?.[1]?.trim() || null;
}

/** Returns null when the text does not look like an M-Pesa confirmation. */
export function parseMpesaSms(raw: string): ParsedMpesa | null {
  const body = raw.replace(/\s+/g, " ").trim();
  if (!body) return null;

  const looksLike =
    /m-?pesa|safaricom|confirmed\.|transaction cost|ksh/i.test(body);
  if (!looksLike) return null;

  const amountMatch = body.match(AMOUNT_RE);
  if (!amountMatch) return null;
  const amount = toMinor(amountMatch[1]);
  if (amount <= 0) return null;

  const feeMatch = body.match(FEE_RE);
  const feeAmount = feeMatch ? toMinor(feeMatch[1]) : 0;
  const kind = detectKind(body);
  const counterparty = detectCounterparty(body, kind);
  const reference = body.match(REF_RE)?.[1] ?? null;
  const occurredAt = parseOccurredAt(body);

  const noteParts = [
    counterparty ? `${kind === "income" ? "From" : "To"} ${counterparty}` : "M-Pesa",
    reference ? `Ref ${reference}` : null,
  ].filter(Boolean);

  return {
    kind,
    amount,
    feeAmount,
    counterparty,
    reference,
    note: noteParts.join(" · "),
    occurredAt,
    raw: body,
  };
}
