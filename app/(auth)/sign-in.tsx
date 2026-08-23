/**
 * app/(auth)/sign-in.tsx
 *
 * Email and password, deliberately: it is the only method that works on a
 * sideloaded APK without configuring deep links or an OAuth redirect.
 */

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/error";
import { Link } from "expo-router";
import { ArrowRightIcon, EnvelopeIcon } from "phosphor-react-native";
import React, { useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Alert, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SignIn() {
  const { signIn, sendPasswordReset } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.includes("@") && password.length >= 6;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      // The auth listener flips the route; nothing to do here.
    } catch (cause) {
      setError(getErrorMessage(cause, "Couldn't sign in"));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = () => {
    if (!email.includes("@")) {
      setError("Type your email address first, then tap reset.");
      return;
    }

    Alert.alert(
      "Reset password",
      `Send a password reset link to ${email.trim()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            try {
              await sendPasswordReset(email);
              Alert.alert("Check your inbox", "The reset link is on its way.");
            } catch (cause) {
              setError(getErrorMessage(cause, "Couldn't send the reset link"));
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      className="flex-1 bg-navy-800"
      contentContainerStyle={{
        paddingTop: insets.top + 48,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 24,
        flexGrow: 1,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center gap-5">
        <Logo size={80} />
        <View className="gap-2">
          <AppText className="text-center text-3xl font-bold tracking-tight text-white">
            Welcome back
          </AppText>
          <AppText className="text-center text-base text-navy-200">
            Pick up where the two of you left off.
          </AppText>
        </View>
      </View>

      <View className="mt-10 rounded-3xl bg-white p-5">
        <View className="gap-4">
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
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            autoComplete="current-password"
          />

          {error ? <ErrorNote message={error} /> : null}

          <Button
            size="lg"
            loading={busy}
            disabled={!canSubmit}
            onPress={submit}
            haptic="medium"
            trailingIcon={<ArrowRightIcon size={20} color="#fff" weight="bold" />}
          >
            Sign in
          </Button>

          <Pressable onPress={resetPassword} className="items-center py-1">
            <AppText className="text-sm font-semibold text-gray-500">
              Forgot your password?
            </AppText>
          </Pressable>
        </View>
      </View>

      <View className="mt-auto flex-row items-center justify-center gap-1.5 pt-8">
        <AppText className="text-base text-navy-200">New here?</AppText>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable hitSlop={8}>
            <AppText className="text-base font-bold text-white">Create an account</AppText>
          </Pressable>
        </Link>
      </View>
    </KeyboardAwareScrollView>
  );
}
