/**
 * components/ui/portal.tsx
 *
 * Renders children at the app's true root instead of wherever they're
 * written in JSX.
 *
 * Sheet needs this: it positions its overlay with `position: absolute`
 * covering the screen, but nothing in React Native makes that mean "the
 * visible viewport" — it means "the bounds of the nearest parent". Sheets
 * are almost always triggered from inside a ScrollView (a screen's main
 * content), and absolute positioning inside a ScrollView is relative to
 * the scrollable *content* size, not what's actually on screen — a classic
 * React Native gotcha. In practice this showed up as a sheet rendering
 * pushed down and cut off, positioned somewhere inside the (much taller,
 * mostly offscreen) content area rather than pinned to the visible screen.
 *
 * PortalHost is mounted once, at the true root (app/_layout.tsx, alongside
 * GestureHandlerRootView — a sibling of the navigator, not nested inside
 * any screen's scroll content). Portal pushes its children there instead
 * of rendering them in place.
 */

import React, { createContext, useContext, useEffect, useId, useState } from "react";
import { View } from "react-native";

type PortalNode = React.ReactNode;

interface PortalContextValue {
  mount: (id: string, node: PortalNode) => void;
  unmount: (id: string) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalHost({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<Record<string, PortalNode>>({});

  const mount = React.useCallback((id: string, node: PortalNode) => {
    setNodes((prev) => ({ ...prev, [id]: node }));
  }, []);
  const unmount = React.useCallback((id: string) => {
    setNodes((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const value = React.useMemo(() => ({ mount, unmount }), [mount, unmount]);

  return (
    <PortalContext.Provider value={value}>
      {children}
      {Object.entries(nodes).map(([id, node]) => (
        <View
          key={id}
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {node}
        </View>
      ))}
    </PortalContext.Provider>
  );
}

/** Renders `children` at the PortalHost instead of in place. Renders
 * nothing locally — that's the point. */
export function Portal({ children }: { children: React.ReactNode }) {
  const ctx = useContext(PortalContext);
  const id = useId();

  useEffect(() => {
    if (!ctx) return;
    ctx.mount(id, children);
    return () => ctx.unmount(id);
  }, [ctx, id, children]);

  if (!ctx) {
    // No PortalHost above this in the tree — fail loud in dev rather than
    // silently rendering in place (which would reintroduce the exact
    // ScrollView-relative-positioning bug this exists to avoid).
    if (__DEV__) {
      console.warn(
        "[Portal] rendered without a PortalHost ancestor — content will not appear. " +
          "Make sure PortalHost wraps the app root.",
      );
    }
    return null;
  }

  return null;
}
