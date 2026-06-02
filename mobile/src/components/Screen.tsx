import React from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";

export function Screen({
  children,
  scroll,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const content = scroll ? (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, style]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.inner, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: { flex: 1, padding: 16 },
  scroll: { padding: 16, paddingBottom: 32 },
});
