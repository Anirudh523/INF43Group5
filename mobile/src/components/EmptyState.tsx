import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";

export function EmptyState({ title, message }: { title: string; message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.box}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {message ? <Text style={[styles.msg, { color: colors.textMuted }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 24, alignItems: "center" },
  title: { fontSize: 17, fontWeight: "600", textAlign: "center" },
  msg: { fontSize: 14, marginTop: 8, textAlign: "center" },
});
