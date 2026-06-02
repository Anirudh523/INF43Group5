import React from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";

type Props = TextInputProps & { label?: string; error?: string };

export function Input({ label, error, style, ...rest }: Props) {
  const { colors, darkMode } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.text }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        keyboardAppearance={darkMode ? "dark" : "light"}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.danger : colors.border,
            color: colors.text,
          },
          style,
        ]}
        {...rest}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  error: { fontSize: 12, marginTop: 4 },
});
