import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/theme/ThemeContext";

export default function Index() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.navy }}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }
  if (session?.token) return <Redirect href="/(tabs)/map" />;
  return <Redirect href="/(auth)/login" />;
}
