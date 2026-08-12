/**
 * app/(auth)/sign-up.tsx
 *
 * Name, email, password and a currency. The name matters more than it looks:
 * on a shared ledger it is how each row is attributed, so it is asked for up
 * front rather than left as a settings chore.
 */

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/screen";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY, currencySymbol } from "@/lib/currency";
import { getErrorMessage } from "@/lib/error";
import { Link } from "expo-router";
import { ArrowRightIcon, EnvelopeIcon, UserIcon } from "phosphor-react-native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SignUp() {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_CURRENCY);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit =
    displayName.trim().length >= 2 && email.includes("@") && password.length >= 6;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      const { sessionStarted } = await signUp({
        displayName,
        email,
        password,
        currencyCode,
      });
      if (!sessionStarted) setConfirmSent(true);
    } catch (cause) {
      setError(getErrorMessage(cause, "Couldn't create your account"));
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <View
        className="flex-1 items-center justify-center gap-5 bg-navy-800 px-8"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <EnvelopeIcon size={56} color="#a9bfe0" weight="duotone" />
        <Text className="text-center text-2xl font-bold tracking-tight text-white">
          Confirm your email
        </Text>
        <Text className="text-center text-base leading-6 text-navy-200">
          We sent a link to {email.trim()}. Tap it, then come back and sign in.
        </Text>
        <Link href="/(auth)/sign-in" asChild>
          <Button variant="secondary" size="lg" className="mt-2 w-full">
            Back to sign in
          </Button>
        </Link>
      </View>
    );
  }

  return (
    <>
      <KeyboardAwareScrollView
        bottomOffset={24}
        className="flex-1 bg-navy-800"
        contentContainerStyle={{
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-5">
          <Logo size={72} />
          <View className="gap-2">
            <Text className="text-center text-3xl font-bold tracking-tight text-white">
              Create your account
            </Text>
            <Text className="text-center text-base text-navy-200">
              Track your own spending, then share a ledger when you&apos;re ready.
            </Text>
          </View>
        </View>

        <View className="mt-8 rounded-3xl bg-white p-5">
          <View className="gap-4">
            <Input
              label="Your name"
              placeholder="Joseph"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              leadingNode={<UserIcon size={20} color="#9ca3af" />}
              hint="Shown next to everything you add on a shared ledger."
            />

            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              leadingNode={<EnvelopeIcon size={20} color="#9ca3af" />}
            />

            <PasswordInput
              label="Password"
              placeholder="At least 6 characters"
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              error={
                password.length > 0 && password.length < 6
                  ? "Use at least 6 characters."
                  : undefined
              }
            />

            <Pressable
              onPress={() => setCurrencyOpen(true)}
              className="flex-row items-center justify-between rounded-2xl border border-gray-200/60 bg-gray-50 px-4 py-4 active:bg-gray-100"
            >
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Currency
                </Text>
                <Text className="mt-1 text-base text-gray-900">
                  {currencyCode} · {currencySymbol(currencyCode)}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-navy-500">Change</Text>
            </Pressable>

            {error ? <ErrorNote message={error} /> : null}

            <Button
              size="lg"
              loading={busy}
              disabled={!canSubmit}
              onPress={submit}
              haptic="medium"
              trailingIcon={<ArrowRightIcon size={20} color="#fff" weight="bold" />}
            >
              Create account
            </Button>
          </View>
        </View>

        <View className="mt-auto flex-row items-center justify-center gap-1.5 pt-8">
          <Text className="text-base text-navy-200">Already have one?</Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable hitSlop={8}>
              <Text className="text-base font-bold text-white">Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAwareScrollView>

      <Sheet
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        title="Currency"
        subtitle="You can change this later in settings."
      >
        {CURRENCY_OPTIONS.map((code) => (
          <SheetOption
            key={code}
            label={code}
            description={currencySymbol(code)}
            selected={code === currencyCode}
            onPress={() => {
              setCurrencyCode(code);
              setCurrencyOpen(false);
            }}
          />
        ))}
      </Sheet>
    </>
  );
}
