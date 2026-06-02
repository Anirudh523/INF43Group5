import { Link, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import type { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/ThemeContext";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [email, setEmail] = useState("alice@example.edu");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    setError("");
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      await signIn({
        userId: res.userId,
        displayName: res.displayName,
        idVerified: res.idVerified,
        token: res.token,
      });
      router.replace("/(tabs)/map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll style={styles.hero}>
      <View style={styles.header}>
        <Text style={styles.logo}>FindMe Friends</Text>
        <Text style={styles.tagline}>Connect by interests - Orange County</Text>
      </View>
      <View style={styles.form}>
        <Input
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={error}
        />
        <Button title="Sign in" onPress={onLogin} loading={loading} />
        <Text style={styles.demo}>Demo: alice@example.edu / demo123</Text>
        <Link href="/(auth)/register" asChild>
          <Text style={styles.link}>Create account</Text>
        </Link>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  hero: { flexGrow: 1, backgroundColor: colors.navy, padding: 24, justifyContent: "center" },
  header: { marginBottom: 32 },
  logo: { fontSize: 32, fontWeight: "800", color: "#fff" },
  tagline: { fontSize: 15, color: colors.teal, marginTop: 8 },
  form: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 20,
  },
  demo: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: 8 },
  link: { color: colors.tealDark, textAlign: "center", marginTop: 16, fontWeight: "600" },
  });
}
