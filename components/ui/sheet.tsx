/**
 * components/ui/sheet.tsx
 *
 * Bottom sheet — clean grabber, grouped options, soft dimmer.
 *
 * Hand-rolled rather than built on a third-party bottom-sheet library.
 * @gorhom/bottom-sheet was tried first and hit a string of currently-open
 * upstream issues specific to Reanimated 4 + the New Architecture (a
 * rendering regression in 5.2.14, a dynamic-sizing/snapPoints conflict, a
 * mount-timing race) that couldn't be reliably fixed without a real device
 * to verify against. react-native-actions-sheet was considered next, but
 * its v10 rewrite also now depends on Reanimated, carrying the same risk
 * class. This instead uses Reanimated for the slide/gesture animation
 * (already used throughout the app, e.g. Input's floating label) and
 * react-native-gesture-handler's modern Gesture API for drag-to-dismiss —
 * both already proven working here, just not previously combined this way.
 *
 * Keyboard handling uses react-native-keyboard-controller's
 * KeyboardAwareScrollView (not KeyboardAvoidingView): on modern Android,
 * edge-to-edge is forced from Android 15 onward and the OS no longer
 * resizes the window for the keyboard, which breaks simple "push up by
 * keyboard height" approaches. KeyboardAwareScrollView instead tracks the
 * actually-focused input directly (position, focus changes, caret) and
 * scrolls it into view — the library's own recommended approach for
 * scrollable form content specifically, and the same component already
 * used successfully elsewhere in this app (ScreenScroll, connect.tsx).
 *
 * Crucially, this is NOT built on React Native's own <Modal>: Modal opens a
 * separate native Dialog window on Android, and keyboard-height events
 * don't reliably cross that window boundary — that mismatch was the root
 * cause of the very first version of this component's keyboard problems.
 * Rendering as a plain absolutely-positioned overlay within the same
 * screen's view tree (like every other sheet library actually does under
 * the hood) avoids that class of bug entirely.
 */

import { AppText } from "@/components/ui/app-text";
import { Portal } from "@/components/ui/portal";
import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import { CheckIcon } from "phosphor-react-native";
import React, { useEffect } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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

const OPEN_EASING = Easing.out(Easing.cubic);
const CLOSE_EASING = Easing.in(Easing.cubic);
const DISMISS_THRESHOLD = 100;
const DISMISS_VELOCITY = 800;
// A dim, not a solid screen — the whole point of a bottom sheet is that the
// person can still tell what screen they're on underneath it.
const BACKDROP_MAX_OPACITY = 0.5;

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
  const { height: windowHeight } = useWindowDimensions();
  const cardMaxHeight = windowHeight * maxHeightRatio;

  // Explicit measured heights rather than flexbox auto-sizing: the card is
  // position: absolute with only maxHeight (no definite height, since a
  // fixed height would make every sheet the same size regardless of how
  // little content it has). That makes Yoga's flex distribution for an
  // "auto-height parent + flex:1 child" ambiguous — overflow:hidden and
  // minHeight:0 clip the visual result, but the ScrollView itself never
  // reliably learns it has less room than its content, so it doesn't
  // scroll. Measuring the header/footer and doing the arithmetic ourselves
  // removes that ambiguity entirely.
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const [footerHeight, setFooterHeight] = React.useState(0);
  const scrollMaxHeight = Math.max(
    120,
    cardMaxHeight - headerHeight - footerHeight - insets.bottom - 10,
  );

  // Mounted for the fade/slide-out to finish playing before actually
  // unmounting — closing is animated out, not instant.
  const [mounted, setMounted] = React.useState(visible);
  const translateY = useSharedValue(windowHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withTiming(0, { duration: 280, easing: OPEN_EASING });
      backdropOpacity.value = withTiming(BACKDROP_MAX_OPACITY, { duration: 220, easing: OPEN_EASING });
    } else if (mounted) {
      translateY.value = withTiming(windowHeight, { duration: 220, easing: CLOSE_EASING });
      backdropOpacity.value = withTiming(0, { duration: 180, easing: CLOSE_EASING }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translateY/backdropOpacity are stable shared values
  }, [visible, windowHeight]);

  const close = () => onClose();

  const pan = Gesture.Pan()
    .onChange((event) => {
      // Only drag downward — the sheet has nowhere to go past fully open.
      translateY.value = Math.max(0, translateY.value + event.changeY);
    })
    .onEnd((event) => {
      const shouldDismiss =
        translateY.value > DISMISS_THRESHOLD || event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(windowHeight, { duration: 200, easing: CLOSE_EASING });
        backdropOpacity.value = withTiming(0, { duration: 180 }, (done) => {
          if (done) {
            runOnJS(setMounted)(false);
            runOnJS(close)();
          }
        });
      } else {
        translateY.value = withTiming(0, { duration: 180, easing: OPEN_EASING });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!mounted) return null;

  return (
    <Portal>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          elevation: 1000,
        }}
      >
        <Animated.View style={[{ flex: 1, backgroundColor: "#000" }, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: cardMaxHeight,
                // Belt-and-suspenders alongside the explicit scrollMaxHeight
                // above: clips anything that still overflows visually
                // (rounded corners) even though the real fix for scrolling
                // is giving KeyboardAwareScrollView a measured, explicit
                // maxHeight rather than relying on flexbox auto-sizing.
                overflow: "hidden",
                backgroundColor: colors.surface,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingBottom: insets.bottom + 10,
                shadowColor: colors.chrome,
                shadowOpacity: 0.18,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: -4 },
                elevation: 16,
              },
              sheetStyle,
            ]}
          >
            <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
              <View className="items-center pt-2.5">
                <View className="h-1 w-9 rounded-full" style={{ backgroundColor: colors.faint }} />
              </View>

              <View className="px-5 pb-3 pt-4">
                <AppText className="text-[22px] font-bold tracking-tight text-ink">{title}</AppText>
                {subtitle ? (
                  <AppText className="mt-1 text-[14px] leading-5 text-muted">{subtitle}</AppText>
                ) : null}
              </View>
            </View>

            <KeyboardAwareScrollView
              className="px-3"
              style={{ maxHeight: scrollMaxHeight }}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bottomOffset={24}
            >
              {children}
            </KeyboardAwareScrollView>

            {footer ? (
              <KeyboardStickyView
                style={{ backgroundColor: colors.surface }}
                onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
              >
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.hairline,
                    paddingHorizontal: 20,
                    paddingTop: 16,
                  }}
                >
                  {footer}
                </View>
              </KeyboardStickyView>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </View>
    </Portal>
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
