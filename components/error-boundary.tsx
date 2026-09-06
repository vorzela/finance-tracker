/**
 * components/error-boundary.tsx
 *
 * Without this, any unhandled error thrown while rendering — a null
 * reference, a bad array index, anything — takes the whole app down. In a
 * release build (no dev tools attached, no red screen) that shows up to the
 * person using the app as "Duo Wallet keeps stopping", with no way back in
 * short of clearing app storage.
 *
 * This catches render errors anywhere below it and shows a recoverable
 * screen with a retry button instead. It can't catch errors in event
 * handlers or async code (React doesn't route those through error
 * boundaries) — those still need their own try/catch, same as before.
 */

import React from "react";
import { Pressable, Text, View } from "react-native";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] caught a render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backgroundColor: "#12151c",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: "#a3aab8", fontSize: 14, textAlign: "center", marginBottom: 20 }}>
            {this.state.error.message || "The app hit an unexpected error."}
          </Text>
          <Pressable
            onPress={this.reset}
            style={{
              backgroundColor: "#3d6bff",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
