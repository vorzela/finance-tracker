/**
 * lib/plans.ts
 *
 * Lightweight project / shopping plans per ledger (personal or household).
 * Stored locally and keyed by scope so couples and personal stay separate.
 * Sync to Supabase can replace this later without changing the UI shape.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { scopeKey, type Scope } from "@/types/finance";
import { uuid } from "@/lib/uuid";

export type PlanKind = "project" | "shopping" | "event" | "business" | "other";

export interface PlanItem {
  id: string;
  label: string;
  /** Minor units estimate; 0 when unknown. */
  estimate: number;
  done: boolean;
}

export interface Plan {
  id: string;
  title: string;
  kind: PlanKind;
  note: string;
  /** Minor units — the target/cap the person set for this whole plan.
   * 0 means "not set", distinct from the sum of item estimates below,
   * which is what it'll actually cost based on what's been itemized. */
  budget: number;
  items: PlanItem[];
  createdAt: number;
  updatedAt: number;
}

const PREFIX = "duo-wallet.plans.";

function storageKey(scope: Scope): string {
  return PREFIX + scopeKey(scope);
}

export async function loadPlans(scope: Scope): Promise<Plan[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Plan[];
    if (!Array.isArray(parsed)) return [];
    // Plans saved before the budget field existed won't have it — default
    // to 0 ("not set") rather than leaving it undefined, which would turn
    // any arithmetic on it into NaN.
    return parsed.map((plan) => ({ ...plan, budget: plan.budget || 0 }));
  } catch {
    return [];
  }
}

async function savePlans(scope: Scope, plans: Plan[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(scope), JSON.stringify(plans));
}

export async function upsertPlan(scope: Scope, plan: Plan): Promise<Plan[]> {
  const plans = await loadPlans(scope);
  const index = plans.findIndex((item) => item.id === plan.id);
  const next = [...plans];
  if (index >= 0) next[index] = plan;
  else next.unshift(plan);
  await savePlans(scope, next);
  return next;
}

export async function deletePlan(scope: Scope, id: string): Promise<Plan[]> {
  const next = (await loadPlans(scope)).filter((plan) => plan.id !== id);
  await savePlans(scope, next);
  return next;
}

export function emptyPlan(kind: PlanKind = "project"): Plan {
  const now = Date.now();
  return {
    id: uuid(),
    title: "",
    kind,
    note: "",
    budget: 0,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function emptyItem(label = ""): PlanItem {
  return { id: uuid(), label, estimate: 0, done: false };
}

export const PLAN_KIND_OPTIONS: { value: PlanKind; label: string; hint: string }[] = [
  { value: "project", label: "Project", hint: "Build, launch, or finish something" },
  { value: "business", label: "Business", hint: "Stock, supplies, client work" },
  { value: "shopping", label: "Shopping list", hint: "Items to buy" },
  { value: "event", label: "Event", hint: "Wedding, trip, party" },
  { value: "other", label: "Other", hint: "Anything else to track" },
];
