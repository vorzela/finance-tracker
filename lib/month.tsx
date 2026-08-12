/**
 * lib/month.tsx
 *
 * The month every screen is looking at. Shared rather than per-screen: stepping
 * back a month on the dashboard and then opening insights should show the same
 * month, not silently jump back to today.
 *
 * Reset to the current month whenever the app returns to the foreground on a
 * new day, so a phone left open overnight doesn't strand you in yesterday.
 */

import { currentMonthKey } from "@/lib/date";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

interface MonthValue {
  monthKey: string;
  setMonthKey: (monthKey: string) => void;
  /** True when viewing the live month. */
  isCurrent: boolean;
  reset: () => void;
}

const MonthContext = createContext<MonthValue | null>(null);

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [openedIn, setOpenedIn] = useState(currentMonthKey);

  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      if (status !== "active") return;
      const live = currentMonthKey();
      if (live === openedIn) return;
      setOpenedIn(live);
      setMonthKey(live);
    };

    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [openedIn]);

  const reset = useCallback(() => setMonthKey(currentMonthKey()), []);

  const value = useMemo<MonthValue>(
    () => ({
      monthKey,
      setMonthKey,
      isCurrent: monthKey === currentMonthKey(),
      reset,
    }),
    [monthKey, reset],
  );

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth(): MonthValue {
  const value = useContext(MonthContext);
  if (!value) throw new Error("useMonth must be used inside <MonthProvider>");
  return value;
}
