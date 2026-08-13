/**
 * app/(app)/profile.tsx
 *
 * Name, photo, colour and currency.
 */

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorNote, Header, Screen } from "@/components/ui/screen";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { CURRENCY_OPTIONS, currencySymbol } from "@/lib/currency";
import { getErrorMessage } from "@/lib/error";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/lib/queries";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { CameraIcon, CheckIcon } from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

const MEMBER_COLORS = [
  "#2a5298",
  "#1f9155",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
  "#e02020",
  "#14b8a6",
  "#a16207",
  "#4b5563",
];

export default function Profile() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState(MEMBER_COLORS[0]);
  const [currencyCode, setCurrencyCode] = useState("KES");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !profile) return;
    setDisplayName(profile.display_name);
    setColor(profile.color);
    setCurrencyCode(profile.currency_code);
    setAvatarUrl(profile.avatar_url);
    setHydrated(true);
  }, [profile, hydrated]);

  const dirty =
    profile !== undefined &&
    (displayName.trim() !== profile.display_name ||
      color !== profile.color ||
      currencyCode !== profile.currency_code);

  const pickPhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission is needed to set a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]) return;

    try {
      const url = await uploadAvatar.mutateAsync(result.assets[0].uri);
      setAvatarUrl(url);
    } catch (cause) {
      setError(getErrorMessage(cause, "Couldn't upload photo"));
    }
  };

  const submit = async () => {
    if (displayName.trim().length < 2) {
      setError("Names need at least two characters.");
      return;
    }
    setError(null);

    try {
      await update.mutateAsync({
        display_name: displayName.trim(),
        color,
        currency_code: currencyCode,
      });
      router.back();
    } catch (cause) {
      setError(getErrorMessage(cause, "Couldn't save your profile"));
    }
  };

  return (
    <Screen>
      <Header title="Your profile" back />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card className="items-center gap-3 py-6">
          <Pressable onPress={pickPhoto} className="items-center gap-2">
            <Avatar
              name={displayName || "Me"}
              color={color}
              uri={avatarUrl}
              size="xl"
            />
            <View className="flex-row items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5">
              <CameraIcon size={14} color="#1e3a5f" weight="bold" />
              <Text className="text-xs font-semibold text-brand">
                {uploadAvatar.isPending ? "Uploading…" : "Change photo"}
              </Text>
            </View>
          </Pressable>
          <View className="items-center">
            <Text className="text-lg font-bold tracking-tight text-ink">
              {displayName || "Your name"}
            </Text>
            <Text className="text-sm text-muted">{user?.email}</Text>
          </View>
        </Card>

        <Card className="gap-4">
          <Input
            label="Display name"
            placeholder="Joseph"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            hint="Shown on every entry you add to a shared ledger."
          />

          <Pressable
            onPress={() => setCurrencyOpen(true)}
            className="flex-row items-center justify-between rounded-2xl border border-hairline bg-subtle px-4 py-4 active:bg-subtle"
          >
            <View>
              <Text className="text-xs font-bold uppercase tracking-wider text-faint">
                Currency
              </Text>
              <Text className="mt-1 text-base text-ink">
                {currencyCode} · {currencySymbol(currencyCode)}
              </Text>
            </View>
            <Text className="text-sm font-semibold text-brand">Change</Text>
          </Pressable>
        </Card>

        <Section title="Your colour">
          <Card>
            <View className="flex-row flex-wrap gap-3">
              {MEMBER_COLORS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setColor(option)}
                  className={cn(
                    "h-11 w-11 items-center justify-center rounded-full",
                    color === option && "border-[3px] border-ink",
                  )}
                  style={{ backgroundColor: option }}
                >
                  {color === option ? (
                    <CheckIcon size={18} color="#ffffff" weight="bold" />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Card>
        </Section>

        {error ? <ErrorNote message={error} /> : null}

        <Button
          size="lg"
          loading={update.isPending || isLoading}
          disabled={!dirty}
          onPress={submit}
          haptic="medium"
        >
          {dirty ? "Save changes" : "Nothing to save"}
        </Button>
      </ScrollView>

      <Sheet
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        title="Currency"
        subtitle="Applies to your personal ledger."
      >
        {CURRENCY_OPTIONS.map((option) => (
          <SheetOption
            key={option}
            label={option}
            description={currencySymbol(option)}
            selected={option === currencyCode}
            onPress={() => {
              setCurrencyCode(option);
              setCurrencyOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
