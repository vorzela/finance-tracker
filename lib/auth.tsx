/**
 * lib/auth.tsx
 *
 * Session state for the whole app.
 *
 * The provider mounts before credentials are known, so it first asks
 * `initSupabase()` for a client and only then subscribes to auth changes. Until
 * that settles, `status` is `"loading"` and the router shows the splash.
 */

import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  configSource,
  initSupabase,
  startAutoRefresh,
  supabase,
  type ConfigSource,
} from "@/lib/supabase";

export type AuthStatus = "loading" | "unconfigured" | "signedOut" | "signedIn";

export interface SignUpResult {
  /** False when Supabase is set to confirm addresses before first sign-in. */
  sessionStarted: boolean;
}

interface AuthValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Where the Supabase credentials came from, for the settings screen. */
  source: ConfigSource | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    displayName: string;
    email: string;
    password: string;
    currencyCode: string;
  }) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  /** Re-runs credential resolution after the connect screen saves new ones. */
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [source, setSource] = useState<ConfigSource | null>(null);
  const [configEpoch, setConfigEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let stopRefresh: (() => void) | undefined;

    (async () => {
      const resolved = await initSupabase();
      if (cancelled) return;

      if (!resolved) {
        setSource(null);
        setStatus("unconfigured");
        return;
      }

      setSource(resolved);
      const client = supabase();

      const { data } = await client.auth.getSession();
      if (cancelled) return;

      setSession(data.session ?? null);
      setStatus(data.session ? "signedIn" : "signedOut");

      const listener = client.auth.onAuthStateChange((_event, next) => {
        setSession(next ?? null);
        setStatus(next ? "signedIn" : "signedOut");
        // Cached rows belong to the previous user; never show them to the next.
        if (!next) queryClient.clear();
      });
      unsubscribe = () => listener.data.subscription.unsubscribe();
      stopRefresh = startAutoRefresh();
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      stopRefresh?.();
    };
  }, [configEpoch, queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(friendly(error.message));
  }, []);

  const signUp = useCallback<AuthValue["signUp"]>(
    async ({ displayName, email, password, currencyCode }) => {
      const { data, error } = await supabase().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            currency_code: currencyCode,
          },
        },
      });
      if (error) throw new Error(friendly(error.message));
      return { sessionStarted: Boolean(data.session) };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase().auth.signOut();
    if (error) throw new Error(friendly(error.message));
    queryClient.clear();
  }, [queryClient]);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase().auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
    );
    if (error) throw new Error(friendly(error.message));
  }, []);

  const reload = useCallback(async () => {
    setStatus("loading");
    setSource(configSource());
    setConfigEpoch((epoch) => epoch + 1);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      source,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      reload,
    }),
    [status, session, source, signIn, signUp, signOut, sendPasswordReset, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** The signed-in user's id. Only call this from inside the signed-in stack. */
export function useUserId(): string {
  const { user } = useAuth();
  if (!user) throw new Error("useUserId called while signed out");
  return user.id;
}

/** Turns Supabase's terse auth errors into something worth showing a person. */
function friendly(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "That email and password combination doesn't match an account.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email address first — check your inbox for the link.";
  }
  if (lower.includes("user already registered")) {
    return "There's already an account with that email. Try signing in instead.";
  }
  if (lower.includes("password should be at least")) {
    return "Pick a password with at least 6 characters.";
  }
  if (lower.includes("network request failed") || lower.includes("fetch")) {
    return "Can't reach Supabase. Check your connection and try again.";
  }
  return message;
}
