/**
 * components/ui/form-sheet.tsx
 *
 * Bottom sheet for content that includes a real text input (Input/
 * TextArea) — new/edit forms for accounts, income entries, debts, plans,
 * budgets, households, and the M-Pesa categorize sheet.
 *
 * Deliberately a separate component from sheet.tsx, not one component
 * branching on a prop: this component's scroll view needs to track the
 * focused input and react to the keyboard; sheet.tsx's never does. Keeping
 * them fully independent means nothing about one's keyboard handling,
 * gesture setup, or styling can leak into or affect the other — see
 * sheet.tsx's header comment for a gesture-conflict bug that motivated
 * being this careful.
 *
 * Hand-rolled rather than built on a third-party bottom-sheet library.
 * @gorhom/bottom-sheet was tried first and hit a string of currently-open
 * upstream issues specific to Reanimated 4 + the New Architecture (a
 * rendering regression in 5.2.14, a dynamic-sizing/snapPoints conflict, a
 * mount-timing race) that couldn't be reliably fixed without a real device
 * to verify against. react-native-actions-sheet was considered next, but
 * its v10 rewrite also now depends on Reanimated, carrying the same risk
 * class.
 *
 * Keyboard handling uses react-native-keyboard-controller's
 * KeyboardAwareScrollView (not KeyboardAvoidingView): on modern Android,
 * edge-to-edge is forced from Android 15 onward and the OS no longer
 * resizes the window for the keyboard, which breaks simple "push up by
 * keyboard height" approaches. KeyboardAwareScrollView instead tracks the
 * actually-focused input directly (position, focus changes, caret) and
 * scrolls it into view — the library's own recommended approach for
 * scrollable form content, and the same component already used
 * successfully elsewhere in this app (ScreenScroll, connect.tsx).
 *
 * Not built on React Native's own <Modal>: Modal opens a separate native
 * Dialog window on Android, and keyboard-height events don't reliably
 * cross that window boundary. Rendering as a plain absolutely-positioned
 * overlay within the same screen's view tree (like every sheet library
 * actually does under the hood) avoids that class of bug entirely.
 *
 * The drag-to-dismiss gesture is scoped to just the grabber/header, not
 * the whole card — wrapping a ScrollView (or KeyboardAwareScrollView) in a
 * Gesture.Pan() lets the outer gesture capture vertical drags meant for
 * the scroll view's own internal scrolling, before they ever reach it.
 */

import { AppText } from "@/components/ui/app-text";
import { Portal } from "@/components/ui/portal";
import { useThemeColors } from "@/lib/theme";
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

export interface FormSheetProps {
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
const BACKDROP_MAX_OPACITY = 0.5;

export function FormSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightRatio = 0.78,
  footer,
}: FormSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { height: windowHeight } = useWindowDimensions();
  const cardMaxHeight = windowHeight * maxHeightRatio;

  const [headerHeight, setHeaderHeight] = React.useState(0);
  const [footerHeight, setFooterHeight] = React.useState(0);
  const scrollMaxHeight = Math.max(
    120,
    cardMaxHeight - headerHeight - footerHeight - insets.bottom - 10,
  );

  const [mounted, setMounted] = React.useState(visible);
  const translateY = useSharedValue(windowHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withTiming(0, { duration: 280, easing: OPEN_EASING });
      backdropOpacity.value = withTiming(BACKDROP_MAX_OPACITY, {
        duration: 220,
        easing: OPEN_EASING,
      });
    } else if (mounted) {
      translateY.value = withTiming(windowHeight, { duration: 220, easing: CLOSE_EASING });
      backdropOpacity.value = withTiming(0, { duration: 180, easing: CLOSE_EASING }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translateY/backdropOpacity are stable shared values
  }, [visible, windowHeight]);

  const close = () => onClose();

  // Scoped to the grabber/header only — see the file header comment.
  const pan = Gesture.Pan()
    .onChange((event) => {
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

        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: cardMaxHeight,
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
          <GestureDetector gesture={pan}>
            <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
              <View className="items-center pt-2.5">
                <View className="h-1 w-9 rounded-full" style={{ backgroundColor: colors.faint }} />
              </View>

              <View className="px-5 pb-3 pt-4">
                <AppText className="text-[22px] font-bold tracking-tight text-ink">
                  {title}
                </AppText>
                {subtitle ? (
                  <AppText className="mt-1 text-[14px] leading-5 text-muted">{subtitle}</AppText>
                ) : null}
              </View>
            </View>
          </GestureDetector>

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
      </View>
    </Portal>
  );
}
