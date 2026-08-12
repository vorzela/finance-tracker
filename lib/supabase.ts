/**
 * lib/supabase.ts
 *
 * Owns the single Supabase client.
 *
 * Credentials are resolved in two steps:
 *   1. `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
 *      baked into the bundle at build time — the normal path for a shared APK.
 *      (Legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` is still accepted.)
 *   2. Values typed into the in-app connect screen and kept in AsyncStorage —
 *      the escape hatch for a build that shipped without them.
 *
 * Because the client only exists once credentials are known, it is created
 * lazily by `initSupabase()` and read through `supabase()`.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, type AppStateStatus } from "react-native";
import type { Database } from "@/types/database";

const CONFIG_KEY = "duo-wallet.supabase-config";

export interface SupabaseConfig {
  url: string;
  /** Publishable (`sb_publishable_…`) or legacy anon JWT. Never a secret key. */
  anonKey: string;
}

export type ConfigSource = "build" | "stored";

let client: SupabaseClient<Database> | null = null;
let source: ConfigSource | null = null;

/**
 * Rejects blanks, placeholders, and secret keys so a half-filled `.env` falls
 * through to the connect screen instead of failing at runtime — or worse,
 * shipping a key that bypasses RLS.
 */
function normalise(url?: string | null, key?: string | null): SupabaseConfig | null {
  const cleanUrl = url?.trim().replace(/\/+$/, "") ?? "";
  const cleanKey = key?.trim() ?? "";

  if (!/^https:\/\/[^\s]+\.[^\s]+$/.test(cleanUrl)) return null;
  if (cleanKey.length < 20) return null;
  if (cleanUrl.includes("your-project")) return null;
  if (cleanKey.startsWith("paste-") || cleanKey.includes("your-")) return null;
  // Secret keys must never live in the client — they bypass RLS.
  if (cleanKey.startsWith("sb_secret_")) return null;

  return { url: cleanUrl, anonKey: cleanKey };
}

function fromBuild(): SupabaseConfig | null {
  // Prefer the current publishable key name; fall back for older .env files.
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_KEY;

  return normalise(process.env.EXPO_PUBLIC_SUPABASE_URL, key);
}

async function fromStorage(): Promise<SupabaseConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
    return normalise(parsed.url, parsed.anonKey);
  } catch {
    return null;
  }
}

function create(config: SupabaseConfig): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      // There is no URL to read a session back from on native.
      detectSessionInUrl: false,
    },
  });
}

/**
 * Resolves credentials and builds the client. Returns where the credentials
 * came from, or `null` when there are none yet.
 */
export async function initSupabase(): Promise<ConfigSource | null> {
  if (client && source) return source;

  const build = fromBuild();
  const config = build ?? (await fromStorage());
  if (!config) return null;

  client = create(config);
  source = build ? "build" : "stored";
  return source;
}

/** Saves hand-entered credentials and swaps the client over to them. */
export async function connectSupabase(config: SupabaseConfig): Promise<void> {
  const valid = normalise(config.url, config.anonKey);
  if (!valid) {
    throw new Error("That does not look like a Supabase URL and publishable key.");
  }

  const candidate = create(valid);

  // Cheapest possible round trip that still proves the project answers and the
  // key is accepted: ask for a session-less user lookup.
  const { error } = await candidate.auth.getSession();
  if (error) throw new Error(error.message);

  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(valid));
  client = candidate;
  source = "stored";
}

export async function forgetStoredConfig(): Promise<void> {
  await AsyncStorage.removeItem(CONFIG_KEY);
  if (source === "stored") {
    client = null;
    source = null;
  }
}

export function isConfigured(): boolean {
  return client !== null;
}

export function configSource(): ConfigSource | null {
  return source;
}

/** Throws if called before `initSupabase()` has succeeded. */
export function supabase(): SupabaseClient<Database> {
  if (!client) {
    throw new Error("Supabase is not connected yet.");
  }
  return client;
}

/**
 * Supabase only refreshes tokens while the app is in the foreground; without
 * this a session can go stale while the phone sits in a pocket.
 */
export function startAutoRefresh(): () => void {
  const handle = (status: AppStateStatus) => {
    if (!client) return;
    if (status === "active") client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  };

  handle(AppState.currentState);
  const subscription = AppState.addEventListener("change", handle);
  return () => subscription.remove();
}
