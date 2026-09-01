/**
 * components/ui/sheet.tsx
 *
 * Bottom sheet — clean grabber, grouped options, soft dimmer.
 *
 * Built on @gorhom/bottom-sheet rather than React Native's own <Modal> +
 * KeyboardAvoidingView. That combination looks right on iOS but is
 * unreliable for keyboard avoidance on Android: Modal renders its content
 * in a separate native Dialog window, and KeyboardAvoidingView listens for
 * keyboard-height events reported against the *root* window — the two
 * don't talk to each other reliably, so inputs inside a Modal-based sheet
 * end up hidden behind the keyboard instead of the sheet shifting up.
 * @gorhom/bottom-sheet renders as an overlay within the same window as the
 * rest of the app (via a portal at the GestureHandlerRootView, see
 * BottomSheetModalProvider in app/_layout.tsx) and has first-class
 * keyboard handling built specifically for this problem — paired here with
 * react-native-keyboard-controller (already used app-wide via
 * KeyboardProvider in app/_layout.tsx), which is the setup gorhom's own
 * docs recommend for reliable Android behavior.
 */

import { AppText } from "@/components/ui/app-text";
import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { CheckIcon } from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightRatio?: number;
  footer?: React.ReactNode;
}

/** True for any component rendered inside a Sheet's content. Input reads
 * this to decide whether it needs BottomSheetTextInput instead of the
 * plain RN TextInput — per @gorhom/bottom-sheet's own troubleshooting
 * docs, a regular TextInput inside a bottom sheet doesn't integrate with
 * the sheet's keyboard/gesture handling properly and the keyboard ends up
 * fighting the sheet instead of the two working together. */
export const SheetInputContext = React.createContext(false);

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightRatio = 0.78,
  footer,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const ref = useRef<BottomSheetModal>(null);

  // Bridge the visible-boolean API every call site already uses onto
  // BottomSheetModal's imperative present()/dismiss() API, so nothing
  // outside this file needs to change.
  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  const snapPoints = useMemo(() => [`${maxHeightRatio * 100}%`], [maxHeightRatio]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.28}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      handleIndicatorStyle={{ backgroundColor: colors.faint, width: 36, height: 4 }}
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
      }}
      style={{
        shadowColor: colors.chrome,
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -4 },
        elevation: 16,
      }}
    >
      <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4 }}>
        <AppText className="text-[22px] font-bold tracking-tight text-ink">{title}</AppText>
        {subtitle ? (
          <AppText className="mt-1 text-[14px] leading-5 text-muted">{subtitle}</AppText>
        ) : null}
      </BottomSheetView>

      <BottomSheetScrollView
        style={{ paddingHorizontal: 12, flex: 1 }}
        contentContainerStyle={{ paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SheetInputContext.Provider value={true}>{children}</SheetInputContext.Provider>
      </BottomSheetScrollView>

      {footer ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: insets.bottom + 10,
          }}
        >
          <SheetInputContext.Provider value={true}>{footer}</SheetInputContext.Provider>
        </View>
      ) : null}
    </BottomSheetModal>
  );
}

export interface SheetOptionProps {
  label: string;
  description?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  selected?: boolean;
  onPress: () => void;
}

export function SheetOption({
  label,
  description,
  leading,
  trailing,
  selected = false,
  onPress,
}: SheetOptionProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      className="will-change-pressable mb-1 flex-row items-center gap-3 rounded-[14px] px-3 py-3"
      style={selected ? { backgroundColor: colors.brandSoft } : undefined}
    >
      {leading}

      <View className="flex-1">
        <AppText
          className={cn(
            "text-[16px] tracking-tight",
            selected ? "font-semibold" : "font-medium text-ink",
          )}
          style={selected ? { color: colors.brand } : undefined}
          numberOfLines={1}
        >
          {label}
        </AppText>
        {description ? (
          <AppText className="mt-0.5 text-[13px] text-muted" numberOfLines={2}>
            {description}
          </AppText>
        ) : null}
      </View>

      {trailing}
      {selected ? <CheckIcon size={18} color={colors.brand} weight="bold" /> : null}
    </Pressable>
  );
}

export function SheetGrid({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-2 px-2 pb-2">{children}</View>;
}
