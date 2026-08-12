/**
 * app/connect.tsx
 *
 * Shown only when the build shipped without Supabase credentials. Pasting them
 * here stores them on the device, which means one APK can be pointed at a
 * project after the fact instead of needing a rebuild.
 *
 * The publishable key is safe to hold on the device: it is the public key, and
 * row level security is what actually protects the data.
 */

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth";
import { connectSupabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/error";
import { Redirect, useRouter } from "expo-router";
import { ArrowRightIcon, DatabaseIcon, KeyIcon, LinkIcon } from "phosphor-react-native";
import React, { useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Connect() {
  const { status, reload } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status !== "unconfigured" && status !== "loading") {
    return <Redirect href="/" />;
  }

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await connectSupabase({ url, anonKey });
      await reload();
      router.replace("/");
    } catch (cause) {
      setError(getErrorMessage(cause, "Couldn't connect"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-navy-800">
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-4">
          <Logo size={72} />
          <Text className="text-center text-3xl font-bold tracking-tight text-white">
            Connect your database
          </Text>
          <Text className="text-center text-base leading-6 text-navy-200">
            This copy of Duo Wallet doesn&apos;t have a Supabase project baked in
            yet. Paste yours below — it&apos;s stored on this phone only.
          </Text>
        </View>

        <View className="mt-8 rounded-3xl bg-white p-5">
          <View className="gap-4">
            <Input
              label="Project URL"
              placeholder="https://abcdefgh.supabase.co"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              leadingNode={<LinkIcon size={20} color="#9ca3af" />}
              required
            />

            <Input
              label="Publishable key"
              placeholder="sb_publishable_…"
              value={anonKey}
              onChangeText={setAnonKey}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              leadingNode={<KeyIcon size={20} color="#9ca3af" />}
              hint="Project Settings → API Keys → Publishable"
              required
            />

            {error ? <ErrorNote message={error} /> : null}

            <Button
              size="lg"
              loading={busy}
              disabled={!url || !anonKey}
              onPress={submit}
              trailingIcon={<ArrowRightIcon size={20} color="#fff" weight="bold" />}
            >
              Connect
            </Button>
          </View>
        </View>

        <View className="mt-6 gap-3 rounded-3xl border border-white/10 bg-white/5 p-5">
          <View className="flex-row items-center gap-2">
            <DatabaseIcon size={18} color="#a9bfe0" weight="duotone" />
            <Text className="text-sm font-bold text-navy-100">First time setup</Text>
          </View>
          <Text className="text-sm leading-6 text-navy-200">
            1. Create a free project at supabase.com{"\n"}
            2. Open the SQL editor and run{" "}
            <Text className="font-bold text-white">supabase/schema.sql</Text>
            {"\n"}
            3. Turn off &quot;Confirm email&quot; under Authentication → Sign In /
            Providers so sign-up works instantly{"\n"}
            4. Copy the project URL and publishable key from Project Settings →
            API Keys
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
