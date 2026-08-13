/**
 * lib/mpesa/parse.ts
 *
 * Turns Safaricom wallet SMS into a draft. Messages are keyed by the M-Pesa
 * confirmation *code* — Fuliza often sends two SMS for one spend, both carrying
 * the same code, so we never create two ledger rows for one code.
 *
 * Products (research-backed):
 *   • Fuliza — overdraft / debt (not savings)
 *   • M-Shwari — savings (+ optional loan facility)
 *   • Ziidi — money-market / savings
 *   • Pochi la Biashara — business wallet for traders
 *
 * Category is only a *suggestion*. The user always confirms what the money was for.
 */

export type MpesaKind = "expense" | "income" | "transfer";

export type MpesaProduct = "mpesa" | "fuliza" | "mshwari" | "ziidi" | "pochi";

export interface ParsedMpesa {
  kind: MpesaKind;
  /** Minor units (cents). */
  amount: number;
  feeAmount: number;
  counterparty: string | null;
  /** Confirmation code — the durable id for this movement. */
  reference: string | null;
  product: MpesaProduct;
  /** Hint only — UI requires the user to pick the real category. */
  suggestedCategoryId: string | null;
  note: string;
  occurredAt: string | null;
  raw: string;
  /**
   * Higher = better primary message when Fuliza (or similar) doubles up.
   * Payment confirmations beat loan-notice SMS.
   */
  priority: number;
}

const AMOUNT_RE = /(?:Ksh|KES|KSH)\s*([\d,]+(?:\.\d{1,2})?)/gi;
const FEE_RE =
  /(?:Transaction\s+cost|Fee|Charged)\s*(?:is\s*)?[,:]?\s*(?:Ksh|KES|KSH)?\s*([\d,]+(?:\.\d{1,2})?)/i;
/** Codes look like THJ7K2L9MN — usually right before "Confirmed". */
const REF_RE =
  /\b([A-Z0-9]{10})\b(?:\s+Confirmed|\s+confirmed)|Confirmed\.\s*\b([A-Z0-9]{10})\b|code\s+([A-Z0-9]{10})\b/i;
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

export function extractMpesaCode(body: string): string | null {
  const normalised = body.replace(/\s+/g, " ").trim();
  const match = normalised.match(REF_RE);
  if (!match) {
    const loose = normalised.match(/\b([A-Z][A-Z0-9]{9})\b/);
    return loose?.[1]?.toUpperCase() ?? null;
  }
  return (match[1] ?? match[2] ?? match[3] ?? null)?.toUpperCase() ?? null;
}

export function productLabel(product: MpesaProduct): string {
  if (product === "mshwari") return "M-Shwari";
  if (product === "ziidi") return "Ziidi";
  if (product === "fuliza") return "Fuliza";
  if (product === "pochi") return "Pochi la Biashara";
  return "M-Pesa";
}

export function productHint(product: MpesaProduct): string {
  if (product === "fuliza") return "Overdraft / debt — usually Loan / Fuliza";
  if (product === "mshwari") return "Savings pocket — usually Savings";
  if (product === "ziidi") return "Money-market savings — usually Savings";
  if (product === "pochi") return "Business wallet — usually Business / Pochi";
  return "Pick what this money was for";
}

function detectProduct(body: string): MpesaProduct {
  const lower = body.toLowerCase();
  const isMoneyMove =
    lower.includes("sent to") ||
    lower.includes("paid to") ||
    lower.includes("you have received") ||
    lower.includes("received from") ||
    lower.includes("bought") ||
    lower.includes("withdraw");

  if (lower.includes("pochi") || lower.includes("la biashara")) {
    return "pochi";
  }

  // Fuliza loan-notice SMS only — ignore the common balance footer on payments.
  if (
    lower.includes("fuliza") &&
    (lower.includes("you have used") ||
      lower.includes("outstanding fuliza") ||
      lower.includes("fuliza limit") ||
      !isMoneyMove)
  ) {
    return "fuliza";
  }

  if (lower.includes("m-shwari") || lower.includes("mshwari")) {
    return "mshwari";
  }

  if (
    lower.includes("ziidi") ||
    lower.includes("zidii") ||
    lower.includes("zidisha") ||
    lower.includes("ziidí")
  ) {
    return "ziidi";
  }

  return "mpesa";
}

function detectKind(body: string, product: MpesaProduct): MpesaKind {
  const lower = body.toLowerCase();

  const toSavings =
    /transfer(?:red)?(?:\s+\S+){0,6}\s+to\s+(?:m-?shwari|ziidi|zidii)/i.test(body) ||
    lower.includes("deposited to") ||
    lower.includes("saved to");
  const fromSavings =
    /transfer(?:red)?(?:\s+\S+){0,6}\s+from\s+(?:m-?shwari|ziidi|zidii)/i.test(body) ||
    lower.includes("withdrawn from");

  if (product === "mshwari" || product === "ziidi" || toSavings || fromSavings) {
    if (toSavings || fromSavings) return "transfer";
  }

  if (
    lower.includes("you have received") ||
    lower.includes("received from") ||
    lower.includes("has been credited") ||
    lower.includes("deposit of") ||
    lower.includes("gave you") ||
    (product === "pochi" && lower.includes("received"))
  ) {
    return "income";
  }

  if (product === "fuliza" && lower.includes("you have used")) {
    return "expense";
  }

  return "expense";
}

/** Soft hint only — never auto-save without the user confirming. */
function suggestCategory(kind: MpesaKind, product: MpesaProduct): string | null {
  if (product === "fuliza") return "loan";
  if (product === "mshwari" || product === "ziidi") return "savings";
  if (product === "pochi") return kind === "income" ? "business" : "other";
  return null;
}

function detectCounterparty(body: string, kind: MpesaKind, product: MpesaProduct): string | null {
  if (product === "mshwari") return "M-Shwari";
  if (product === "ziidi") return "Ziidi";
  if (product === "pochi") return "Pochi la Biashara";
  if (product === "fuliza" && body.toLowerCase().includes("you have used")) {
    return "Fuliza";
  }

  if (kind === "income") {
    const from =
      body.match(/from\s+([A-Z0-9 *.\-']+?)\s+(?:on|New|\d|Account|Fuliza)/i) ??
      body.match(/from\s+([A-Z0-9 *.\-']+)/i);
    return from?.[1]?.trim() || null;
  }

  const to =
    body.match(/sent to\s+([A-Z0-9 *.\-']+?)\s+(?:for|on)/i) ??
    body.match(/paid to\s+([A-Z0-9 *.\-']+?)\s+(?:on|\.|New|Acc|Fuliza)/i) ??
    body.match(/to\s+([A-Z0-9 *.\-']+?)\s+(?:on|for|Acc|\.|Fuliza)/i);
  return to?.[1]?.trim() || null;
}

function scorePriority(body: string, product: MpesaProduct): number {
  const lower = body.toLowerCase();
  let score = 10;
  if (/\bconfirmed\b/i.test(body)) score += 20;
  if (lower.includes("sent to") || lower.includes("paid to") || lower.includes("received")) {
    score += 15;
  }
  if (lower.includes("transaction cost")) score += 5;
  if (product === "fuliza" && lower.includes("you have used") && !lower.includes("paid to")) {
    score -= 25;
  }
  if (product === "mshwari" || product === "ziidi" || product === "pochi") score += 5;
  return score;
}

function firstMoneyAmount(body: string): number {
  AMOUNT_RE.lastIndex = 0;
  const match = AMOUNT_RE.exec(body);
  return match ? toMinor(match[1]) : 0;
}

/** Returns null when the text does not look like a Safaricom wallet SMS. */
export function parseMpesaSms(raw: string): ParsedMpesa | null {
  const body = raw.replace(/\s+/g, " ").trim();
  if (!body) return null;

  const looksLike =
    /m-?pesa|safaricom|fuliza|m-?shwari|ziidi|zidii|zidisha|pochi|biashara|confirmed\.|transaction cost|ksh/i.test(
      body,
    );
  if (!looksLike) return null;

  const amount = firstMoneyAmount(body);
  if (amount <= 0) return null;

  const feeMatch = body.match(FEE_RE);
  const feeAmount = feeMatch ? toMinor(feeMatch[1]) : 0;
  const product = detectProduct(body);
  const kind = detectKind(body, product);
  const reference = extractMpesaCode(body);
  const counterparty = detectCounterparty(body, kind, product);
  const suggestedCategoryId = suggestCategory(kind, product);
  const occurredAt = parseOccurredAt(body);
  const priority = scorePriority(body, product);
  const label = productLabel(product);

  const noteParts = [
    counterparty
      ? kind === "income"
        ? `From ${counterparty}`
        : kind === "transfer"
          ? counterparty
          : `To ${counterparty}`
      : label,
    reference ? `Ref ${reference}` : null,
  ].filter(Boolean);

  return {
    kind,
    amount,
    feeAmount,
    counterparty,
    reference,
    product,
    suggestedCategoryId,
    note: [...new Set(noteParts)].join(" · "),
    occurredAt,
    raw: body,
    priority,
  };
}

/**
 * Collapse Fuliza (and any other) doubles: one ledger row per confirmation code.
 * Prefer the highest-priority SMS; take the larger fee if the other message has it.
 */
export function dedupeByMpesaCode(items: ParsedMpesa[]): ParsedMpesa[] {
  const byCode = new Map<string, ParsedMpesa>();
  const withoutCode: ParsedMpesa[] = [];

  for (const item of items) {
    if (!item.reference) {
      withoutCode.push(item);
      continue;
    }

    const existing = byCode.get(item.reference);
    if (!existing) {
      byCode.set(item.reference, item);
      continue;
    }

    const winner = item.priority >= existing.priority ? item : existing;
    const loser = winner === item ? existing : item;
    const counterparty =
      winner.counterparty && winner.counterparty !== "Fuliza"
        ? winner.counterparty
        : (loser.counterparty ?? winner.counterparty);
    const feeAmount = Math.max(winner.feeAmount, loser.feeAmount);
    const product =
      winner.product === "fuliza" && loser.product !== "fuliza"
        ? loser.product
        : winner.product;
    const kind = winner.kind;
    const merged: ParsedMpesa = {
      ...winner,
      product,
      kind,
      feeAmount,
      counterparty,
      suggestedCategoryId: suggestCategory(kind, product),
      raw: winner.raw,
      note: [
        counterparty
          ? kind === "income"
            ? `From ${counterparty}`
            : kind === "transfer"
              ? counterparty
              : `To ${counterparty}`
          : productLabel(product),
        `Ref ${item.reference}`,
      ].join(" · "),
    };
    byCode.set(item.reference, merged);
  }

  return [...byCode.values(), ...withoutCode].sort((a, b) => {
    const aTime = a.occurredAt ?? "";
    const bTime = b.occurredAt ?? "";
    return aTime < bTime ? 1 : aTime > bTime ? -1 : 0;
  });
}

/** True when a saved note already carries this confirmation code. */
export function noteHasMpesaCode(note: string | null | undefined, code: string): boolean {
  if (!note || !code) return false;
  return note.toUpperCase().includes(code.toUpperCase());
}
