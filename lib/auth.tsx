/**
 * lib/auth.tsx
 *
 * Session state for the whole app.
 *
 * The provider mounts before credentials are known, so it first asks
 * `initSupabase()` for a client and only then subscribes to auth changes. Until
 * that settles, `status` is `"loading"` and the router shows the splash.
 */

import { onlineManager, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

/** Rejects if `promise` doesn't settle within `ms`, so a stalled auth/network
 * call can never leave the caller waiting forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Supabase's own getSession() already reads purely from local storage when
// the access token isn't near expiry — no network involved. The trouble is
// specifically the case where the token DOES need a refresh and there's no
// network to do it with: Supabase then (correctly, by its own logic) returns
// session: null, and our old code treated that exactly like "definitely
// signed out" and booted the user to the sign-in screen — even though their
// refresh token was probably still fine and they were simply offline. For
// an app built around an offline queue and a persisted query cache, that's
// wrong: it cuts the user off from their own local data for no reason other
// than a temporary lack of connectivity. We keep our own small record of the
// last session we know was valid, and fall back to it (rather than to
// signedOut) whenever we can't currently verify one AND we're offline.
const CACHED_SESSION_KEY = "duo-wallet.cached-session";

async function cacheSession(session: Session | null): Promise<void> {
  try {
    if (session) await AsyncStorage.setItem(CACHED_SESSION_KEY, JSON.stringify(session));
    else await AsyncStorage.removeItem(CACHED_SESSION_KEY);
  } catch {
    // Best-effort only — never let this block the real auth flow.
  }
}

async function readCachedSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

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
      try {
        const resolved = await initSupabase();
        if (cancelled) return;

        if (!resolved) {
          setSource(null);
          setStatus("unconfigured");
          return;
        }

        setSource(resolved);
        const client = supabase();

        // getSession() should resolve from local storage almost instantly, but
        // a bad network or a stalled first-run token refresh must never be
        // able to leave `status` stuck on "loading" forever — that freezes
        // the splash screen indefinitely. Race it against a timeout.
        const { data } = await withTimeout(
          client.auth.getSession(),
          8000,
          "getSession timed out",
        );
        if (cancelled) return;

        if (data.session) {
          setSession(data.session);
          setStatus("signedIn");
          void cacheSession(data.session);
        } else if (!onlineManager.isOnline()) {
          const cached = await readCachedSession();
          if (cached) {
            console.warn("[auth] offline and couldn't verify session — using last known one");
            setSession(cached);
            setStatus("signedIn");
          } else {
            setSession(null);
            setStatus("signedOut");
          }
        } else {
          setSession(null);
          setStatus("signedOut");
        }

        const listener = client.auth.onAuthStateChange((_event, next) => {
          setSession(next ?? null);
          setStatus(next ? "signedIn" : "signedOut");
          void cacheSession(next ?? null);
          // Cached rows belong to the previous user; never show them to the next.
          if (!next) queryClient.clear();
        });
        unsubscribe = () => listener.data.subscription.unsubscribe();
        stopRefresh = startAutoRefresh();
      } catch (err) {
        if (cancelled) return;
        // Any failure here (network error, bad/stale stored credentials,
        // timeout) must still unblock the splash screen — but offline is not
        // the same thing as signed out. Fall back to the last known session
        // if we're offline and have one; only actually sign out otherwise.
        console.warn("[auth] session init failed:", err);
        if (!onlineManager.isOnline()) {
          const cached = await readCachedSession();
          if (cached) {
            setSession(cached);
            setStatus("signedIn");
            return;
          }
        }
        setSession(null);
        setStatus("signedOut");
      }
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
