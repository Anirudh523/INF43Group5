import { Stack } from "expo-router";
import { useTheme } from "../../src/theme/ThemeContext";

export default function ChatStackLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: "#fff",
      }}
    />
  );
}
