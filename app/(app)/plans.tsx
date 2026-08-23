/**
 * app/(app)/plans.tsx
 *
 * Lightweight project / shopping / business plans for the active ledger.
 * Personal and household stay separate via scope. Helps couples and solo
 * users plan items and estimates before spending.
 */

import { Button } from "@/components/ui/button";
import { Card, IconTile, Section } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  ErrorNote,
  Header,
  Screen,
  ScreenScroll,
} from "@/components/ui/screen";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { formatMoney, parseAmount } from "@/lib/currency";
import {
  PLAN_KIND_OPTIONS,
  deletePlan,
  emptyItem,
  emptyPlan,
  loadPlans,
  upsertPlan,
  type Plan,
  type PlanItem,
  type PlanKind,
} from "@/lib/plans";
import { useCurrency } from "@/lib/queries";
import { useScope, useScopeLabel } from "@/lib/scope";
import { useThemeColors } from "@/lib/theme";
import {
  BriefcaseIcon,
  CheckCircleIcon,
  CircleIcon,
  ListChecksIcon,
  PlusIcon,
  TrashIcon,
} from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Alert, Pressable, View } from "react-native";

export default function Plans() {
  const { scope } = useScope();
  const ledger = useScopeLabel();
  const currency = useCurrency();
  const colors = useThemeColors();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kindOpen, setKindOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<PlanKind>("project");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [itemLabel, setItemLabel] = useState("");
  const [itemEstimate, setItemEstimate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPlans(await loadPlans(scope));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openNew = () => {
    const draft = emptyPlan("project");
    setEditing(draft);
    setTitle("");
    setKind("project");
    setNote("");
    setItems([]);
    setItemLabel("");
    setItemEstimate("");
    setFormError(null);
    setSheetOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setTitle(plan.title);
    setKind(plan.kind);
    setNote(plan.note);
    setItems(plan.items.map((item) => ({ ...item })));
    setItemLabel("");
    setItemEstimate("");
    setFormError(null);
    setSheetOpen(true);
  };

  const addItem = () => {
    const label = itemLabel.trim();
    if (!label) return;
    const estimate = parseAmount(itemEstimate, currency) ?? 0;
    setItems((prev) => [...prev, { ...emptyItem(label), estimate }]);
    setItemLabel("");
    setItemEstimate("");
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const submit = async () => {
    if (!editing) return;
    const cleaned = title.trim();
    if (!cleaned) {
      setFormError("Give the plan a name");
      return;
    }
    setFormError(null);
    const plan: Plan = {
      ...editing,
      title: cleaned,
      kind,
      note: note.trim(),
      items,
      updatedAt: Date.now(),
    };
    const next = await upsertPlan(scope, plan);
    setPlans(next);
    setSheetOpen(false);
  };

  const confirmDelete = (plan: Plan) => {
    Alert.alert("Delete plan?", `"${plan.title}" will be removed from this ledger.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setPlans(await deletePlan(scope, plan.id));
            setSheetOpen(false);
          })();
        },
      },
    ]);
  };

  const kindLabel = useMemo(
    () => PLAN_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? "Project",
    [kind],
  );

  const estimateTotal = (plan: Plan) =>
    plan.items.reduce((sum, item) => sum + (item.estimate || 0), 0);

  return (
    <Screen>
      <Header
        title="Plans"
        subtitle={`${ledger} · projects, shopping, business`}
        back
        right={
          <Pressable
            onPress={openNew}
            className="will-change-pressable h-9 w-9 items-center justify-center rounded-full active:opacity-70"
            style={{ backgroundColor: colors.brandSoft }}
            accessibilityLabel="New plan"
          >
            <PlusIcon size={18} color={colors.brand} weight="bold" />
          </Pressable>
        }
      />

      <ScreenScroll>
        {loading ? (
          <AppText className="px-1 text-[14px] text-muted">Loading plans…</AppText>
        ) : plans.length === 0 ? (
          <Card>
            <EmptyState
              icon={
                <IconTile color={colors.brand} size={48}>
                  <ListChecksIcon size={24} color={colors.brand} weight="duotone" />
                </IconTile>
              }
              title="Plan before you spend"
              message="Track project materials, business stock, shopping lists, or event needs — separate for personal and household ledgers."
              action={
                <Button
                  onPress={openNew}
                  icon={<PlusIcon size={20} color="#fff" weight="bold" />}
                >
                  New plan
                </Button>
              }
            />
          </Card>
        ) : (
          <Section title="Active plans">
            <View className="gap-3">
              {plans.map((plan) => {
                const done = plan.items.filter((item) => item.done).length;
                const total = plan.items.length;
                const estimate = estimateTotal(plan);
                return (
                  <Pressable key={plan.id} onPress={() => openEdit(plan)}>
                    <Card>
                      <View className="flex-row items-center gap-3">
                        <IconTile color={colors.brand}>
                          <BriefcaseIcon size={20} color={colors.brand} weight="duotone" />
                        </IconTile>
                        <View className="flex-1">
                          <AppText className="text-[16px] font-semibold tracking-tight text-ink">
                            {plan.title}
                          </AppText>
                          <AppText className="mt-0.5 text-[13px] text-muted">
                            {PLAN_KIND_OPTIONS.find((o) => o.value === plan.kind)?.label ??
                              plan.kind}
                            {total > 0 ? ` · ${done}/${total} done` : ""}
                            {estimate > 0
                              ? ` · ~${formatMoney(estimate, currency)}`
                              : ""}
                          </AppText>
                        </View>
                      </View>
                      {plan.note ? (
                        <AppText className="mt-2 text-[13px] text-faint" numberOfLines={2}>
                          {plan.note}
                        </AppText>
                      ) : null}
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        )}
      </ScreenScroll>

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing?.title ? "Edit plan" : "New plan"}
        subtitle="Items stay on this ledger only"
        footer={
          <View className="gap-2">
            <Button size="lg" onPress={() => void submit()}>
              Save plan
            </Button>
            {editing && plans.some((plan) => plan.id === editing.id) ? (
              <Button
                variant="danger"
                outline
                icon={<TrashIcon size={18} color={colors.negative} />}
                onPress={() => confirmDelete(editing)}
              >
                Delete plan
              </Button>
            ) : null}
          </View>
        }
      >
        <View className="gap-4 px-2 pb-2">
          <Input
            label="Name"
            placeholder="Kitchen remodel, client order…"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
            autoFocus
          />

          <Pressable
            onPress={() => setKindOpen(true)}
            className="will-change-pressable flex-row items-center justify-between rounded-2xl px-4 py-4 active:opacity-80"
            style={{ backgroundColor: colors.subtle }}
          >
            <View>
              <AppText
                className="text-[11px] font-semibold tracking-wide"
                style={{ color: colors.muted }}
              >
                Type
              </AppText>
              <AppText className="mt-1 text-[16px] font-semibold" style={{ color: colors.ink }}>
                {kindLabel}
              </AppText>
            </View>
            <AppText className="text-[13px] font-semibold" style={{ color: colors.brand }}>
              Change
            </AppText>
          </Pressable>

          <Input
            label="Note"
            placeholder="Optional context"
            value={note}
            onChangeText={setNote}
          />

          <View className="gap-2">
            <AppText className="px-1 text-[13px] font-semibold text-muted">Items needed</AppText>
            {items.map((item) => (
              <View
                key={item.id}
                className="flex-row items-center gap-2 rounded-2xl px-3 py-2.5"
                style={{ backgroundColor: colors.subtle }}
              >
                <Pressable onPress={() => toggleItem(item.id)} hitSlop={8}>
                  {item.done ? (
                    <CheckCircleIcon size={22} color={colors.positive} weight="fill" />
                  ) : (
                    <CircleIcon size={22} color={colors.faint} />
                  )}
                </Pressable>
                <AppText
                  className="flex-1 text-[15px]"
                  style={{
                    color: colors.ink,
                    textDecorationLine: item.done ? "line-through" : "none",
                    opacity: item.done ? 0.55 : 1,
                  }}
                >
                  {item.label}
                  {item.estimate > 0 ? ` · ${formatMoney(item.estimate, currency)}` : ""}
                </AppText>
                <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                  <TrashIcon size={18} color={colors.faint} />
                </Pressable>
              </View>
            ))}

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  label="Add item"
                  placeholder="Cement, milk, stock…"
                  value={itemLabel}
                  onChangeText={setItemLabel}
                  onSubmitEditing={addItem}
                  returnKeyType="done"
                />
              </View>
              <View className="w-[100px]">
                <Input
                  label="Est."
                  placeholder="0"
                  value={itemEstimate}
                  onChangeText={setItemEstimate}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Button
              variant="secondary"
              onPress={addItem}
              disabled={!itemLabel.trim()}
            >
              Add item
            </Button>
          </View>

          {formError ? <ErrorNote message={formError} /> : null}
        </View>
      </Sheet>

      <Sheet visible={kindOpen} onClose={() => setKindOpen(false)} title="Plan type">
        {PLAN_KIND_OPTIONS.map((option) => (
          <SheetOption
            key={option.value}
            label={option.label}
            description={option.hint}
            selected={kind === option.value}
            onPress={() => {
              setKind(option.value);
              setKindOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
