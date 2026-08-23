/**
 * lib/categories.ts
 *
 * The fixed category taxonomy. Categories are code-defined rather than user
 * data so that budgets, M-Pesa keyword rules and demo data can all reference
 * stable IDs.
 *
 * `icon` is a key resolved by `components/finance/category-icon.tsx`; `color`
 * is a hex value because NativeWind cannot compile class names that are only
 * known at runtime.
 */

import type { TransactionKind } from "@/types/finance";

export type CategoryIcon =
  | "basket"
  | "fork"
  | "bus"
  | "fuel"
  | "phone"
  | "bolt"
  | "drop"
  | "house"
  | "health"
  | "school"
  | "baby"
  | "film"
  | "bag"
  | "person"
  | "tools"
  | "piggy"
  | "receipt"
  | "gift"
  | "coins"
  | "briefcase"
  | "store"
  | "refund"
  | "transfer"
  | "cash"
  | "snack"
  | "tag"
  | "handshake"
  | "plant"
  | "chart"
  | "wrench"
  | "package";

export interface Category {
  id: string;
  label: string;
  icon: CategoryIcon;
  color: string;
  /** Which transaction kinds may use this category. */
  applies: TransactionKind;
}

export const CATEGORIES: Category[] = [
  // ── Expenses ──────────────────────────────────────────────────────────────
  { id: "groceries", label: "Groceries", icon: "basket", color: "#3db077", applies: "expense" },
  { id: "dining", label: "Eating out", icon: "fork", color: "#f59e0b", applies: "expense" },
  {
    id: "street_food",
    label: "Street food & snacks",
    icon: "snack",
    color: "#ea580c",
    applies: "expense",
  },
  { id: "transport", label: "Transport", icon: "bus", color: "#5480bf", applies: "expense" },
  { id: "fuel", label: "Fuel", icon: "fuel", color: "#1e3a5f", applies: "expense" },
  { id: "airtime", label: "Airtime & data", icon: "phone", color: "#22a06b", applies: "expense" },
  { id: "utilities", label: "Electricity", icon: "bolt", color: "#d97706", applies: "expense" },
  { id: "water", label: "Water", icon: "drop", color: "#0ea5e9", applies: "expense" },
  { id: "rent", label: "Rent & housing", icon: "house", color: "#7e9fd0", applies: "expense" },
  { id: "health", label: "Health", icon: "health", color: "#e02020", applies: "expense" },
  { id: "education", label: "School fees", icon: "school", color: "#6366f1", applies: "expense" },
  { id: "childcare", label: "Childcare", icon: "baby", color: "#ec4899", applies: "expense" },
  { id: "entertainment", label: "Entertainment", icon: "film", color: "#8b5cf6", applies: "expense" },
  { id: "shopping", label: "Shopping", icon: "bag", color: "#f472b6", applies: "expense" },
  { id: "personal", label: "Personal care", icon: "person", color: "#14b8a6", applies: "expense" },
  { id: "household", label: "Household goods", icon: "tools", color: "#a16207", applies: "expense" },
  { id: "materials", label: "Materials & supplies", icon: "package", color: "#0f766e", applies: "expense" },
  { id: "business_expense", label: "Business costs", icon: "store", color: "#1d4ed8", applies: "expense" },
  { id: "project", label: "Project / build", icon: "wrench", color: "#7c3aed", applies: "expense" },
  { id: "savings", label: "Savings & chama", icon: "piggy", color: "#166b3f", applies: "expense" },
  { id: "loan", label: "Loan / Fuliza", icon: "coins", color: "#9b0c0c", applies: "expense" },
  { id: "fees", label: "Transaction fees", icon: "receipt", color: "#6b7280", applies: "expense" },
  { id: "cash", label: "Cash withdrawal", icon: "cash", color: "#4b5563", applies: "expense" },
  { id: "gifts", label: "Gifts & giving", icon: "gift", color: "#fb7185", applies: "expense" },
  { id: "other", label: "Other (specify)", icon: "tag", color: "#9ca3af", applies: "expense" },

  // ── Income (why money was received) ───────────────────────────────────────
  { id: "salary", label: "Salary / wages", icon: "briefcase", color: "#1f9155", applies: "income" },
  { id: "job_done", label: "Job / gig done", icon: "wrench", color: "#15803d", applies: "income" },
  { id: "freelance", label: "Freelance / client", icon: "handshake", color: "#0f766e", applies: "income" },
  { id: "business", label: "Business / sales", icon: "store", color: "#2a5298", applies: "income" },
  { id: "commission", label: "Commission", icon: "chart", color: "#2563eb", applies: "income" },
  { id: "bonus", label: "Bonus / tip", icon: "coins", color: "#ca8a04", applies: "income" },
  { id: "transport_in", label: "Transport (received)", icon: "bus", color: "#5480bf", applies: "income" },
  { id: "groceries_in", label: "Groceries (received)", icon: "basket", color: "#3db077", applies: "income" },
  { id: "rent_in", label: "Rent contribution", icon: "house", color: "#7e9fd0", applies: "income" },
  { id: "allowance", label: "Allowance / upkeep", icon: "person", color: "#14b8a6", applies: "income" },
  { id: "farming", label: "Farming / produce", icon: "plant", color: "#65a30d", applies: "income" },
  { id: "investment", label: "Investment return", icon: "chart", color: "#4f46e5", applies: "income" },
  { id: "loan_in", label: "Loan received", icon: "coins", color: "#b45309", applies: "income" },
  { id: "refund", label: "Refund", icon: "refund", color: "#0d9488", applies: "income" },
  { id: "gift_in", label: "Gift / family send", icon: "gift", color: "#65a30d", applies: "income" },
  { id: "other_income", label: "Other income (specify)", icon: "tag", color: "#84cc16", applies: "income" },

  // ── Transfers ─────────────────────────────────────────────────────────────
  { id: "transfer", label: "Transfer", icon: "transfer", color: "#64748b", applies: "transfer" },
];

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

/** Never returns undefined so screens don't need null checks on stale IDs. */
export function getCategory(id: string): Category {
  return BY_ID.get(id) ?? FALLBACK_CATEGORY;
}

export const FALLBACK_CATEGORY: Category = {
  id: "other",
  label: "Uncategorised",
  icon: "tag",
  color: "#9ca3af",
  applies: "expense",
};

export function categoriesFor(kind: TransactionKind): Category[] {
  return CATEGORIES.filter((category) => category.applies === kind);
}

export const EXPENSE_CATEGORIES = categoriesFor("expense");
export const INCOME_CATEGORIES = categoriesFor("income");

export const TRANSFER_CATEGORY_ID = "transfer";
export const FEES_CATEGORY_ID = "fees";

/** Sensible default when a kind is chosen before a category. */
export function defaultCategoryFor(kind: TransactionKind): string {
  if (kind === "income") return "salary";
  if (kind === "transfer") return TRANSFER_CATEGORY_ID;
  return "groceries";
}

/** Categories that need a free-text “what / where” from the user. */
export function categoryNeedsDetail(categoryId: string): boolean {
  return (
    categoryId === "other" ||
    categoryId === "other_income" ||
    categoryId === "street_food" ||
    categoryId === "job_done" ||
    categoryId === "freelance" ||
    categoryId === "materials" ||
    categoryId === "project"
  );
}

export function categoryDetailLabel(categoryId: string): string {
  if (categoryId === "street_food") return "What / where?";
  return "What is it?";
}

export function categoryDetailPlaceholder(categoryId: string): string {
  if (categoryId === "street_food") {
    return "e.g. Smokies at stage, chapati CBD, boiled egg snacks";
  }
  if (categoryId === "job_done") return "e.g. Plumbing for Mama Njeri, wiring job";
  if (categoryId === "freelance") return "e.g. Logo design for…, consulting";
  if (categoryId === "other_income") return "e.g. Side hustle, refund from…";
  if (categoryId === "materials" || categoryId === "project") {
    return "e.g. Cement bags, timber, paint for…";
  }
  return "e.g. Church offering, chama, school trip";
}

/** Prefaces the ledger note with the user's detail text when needed. */
export function composeCategoryNote(
  categoryId: string,
  otherDetail: string,
  baseNote: string | null | undefined,
): string | null {
  const detail = otherDetail.trim();
  const base = baseNote?.trim() ?? "";
  if (categoryNeedsDetail(categoryId)) {
    if (!detail) return null;
    return base ? `${detail} · ${base}` : detail;
  }
  return base || null;
}

/** Categories a monthly budget can be set on — spending only. */
export const BUDGETABLE_CATEGORIES = EXPENSE_CATEGORIES.filter(
  (category) => category.id !== "fees" && category.id !== "cash",
);
