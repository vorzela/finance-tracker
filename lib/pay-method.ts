/**
 * lib/pay-method.ts
 *
 * How money moved for an entry: cash has no fee/SMS; M-Pesa / bank / card
 * can paste a confirmation and record transaction cost.
 *
 * Each method maps to an account type that must exist with an opening balance
 * of at least 0. The live balance is opening + transactions and may go negative.
 */

import type { AccountType } from "@/types/database";
import type { Account } from "@/types/finance";

export type PayMethod = "cash" | "mpesa" | "bank" | "card";

export const PAY_METHOD_OPTIONS: {
  value: PayMethod;
  label: string;
  hint: string;
  accountType: AccountType;
  defaultName: string;
  usesSms: boolean;
  usesFee: boolean;
  color: string;
}[] = [
  {
    value: "cash",
    label: "Cash",
    hint: "Amount only — no transaction cost",
    accountType: "cash",
    defaultName: "Cash",
    usesSms: false,
    usesFee: false,
    color: "#4b5563",
  },
  {
    value: "mpesa",
    label: "M-Pesa",
    hint: "Paste SMS for amount, fee, code, time",
    accountType: "mobile",
    defaultName: "M-Pesa",
    usesSms: true,
    usesFee: true,
    color: "#22a06b",
  },
  {
    value: "bank",
    label: "Bank",
    hint: "Paste alert SMS or type amount + fee",
    accountType: "bank",
    defaultName: "Bank",
    usesSms: true,
    usesFee: true,
    color: "#2a5298",
  },
  {
    value: "card",
    label: "Card",
    hint: "Paste bank/card alert or type amount + fee",
    accountType: "card",
    defaultName: "Card",
    usesSms: true,
    usesFee: true,
    color: "#8b5cf6",
  },
];

export function getPayMethod(id: PayMethod) {
  return PAY_METHOD_OPTIONS.find((option) => option.value === id) ?? PAY_METHOD_OPTIONS[0];
}

export function payMethodFromAccountType(type: AccountType | null | undefined): PayMethod {
  if (type === "mobile") return "mpesa";
  if (type === "bank") return "bank";
  if (type === "card") return "card";
  if (type === "cash") return "cash";
  return "mpesa";
}

/** First active account for this pay method, if any. */
/**
 * The account to use for a payment method. On a shared household ledger,
 * more than one account can share the same type (each member's own M-Pesa,
 * say) — preferring the current user's own account here, rather than
 * whichever happened to be created first, matters: it was previously
 * always picking the earliest-created account of that type regardless of
 * owner, which in practice meant every transaction defaulted to the
 * household creator's account balance, no matter who was actually entering
 * the transaction.
 */
export function accountForPayMethod(
  accounts: Account[],
  method: PayMethod,
  userId?: string | null,
): Account | undefined {
  const type = getPayMethod(method).accountType;
  const candidates = accounts.filter((account) => account.type === type && !account.archived);
  if (candidates.length === 0) return undefined;
  const mine = userId ? candidates.find((account) => account.owner_id === userId) : undefined;
  return mine ?? candidates[0];
}

/**
 * Balance after applying this movement.
 * Expenses/fees leave the account; income arrives.
 */
export function projectedBalance(
  current: number,
  kind: "expense" | "income" | "transfer",
  amount: number,
  feeAmount: number,
): number {
  if (kind === "income") return current + amount - feeAmount;
  return current - amount - feeAmount;
}
