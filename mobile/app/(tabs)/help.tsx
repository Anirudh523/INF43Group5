import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import type { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/ThemeContext";

const FAQS = [
  {
    q: "How long will it take for my ID to be verified?",
    a: "5-7 business days in the full app. This prototype approves the mock upload immediately.",
  },
  {
    q: "How do I change my bio?",
    a: "Open Profile, edit the Bio field, then leave the field or press Save profile.",
  },
  {
    q: "How do I block a person?",
    a: "Open Friends, find the person, and check Block. You can uncheck it to unblock them.",
  },
  {
    q: "How do I create an activity?",
    a: "Open Activities, press Create activity, search a Google Maps place, then submit the form.",
  },
  {
    q: "Why are activities not on the map?",
    a: "Activities need saved coordinates. Use the Google Maps location search before creating one.",
  },
  {
    q: "How do I delete my account?",
    a: "Account deletion is outside this prototype scope, but this is where the help article would appear.",
  },
];

export default function HelpScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <Screen>
      <Text style={styles.title}>FAQ - Help and Documentation</Text>
      <ScrollView>
        {filtered.map((item, index) => (
          <Card key={item.q}>
            <Text style={styles.question}>
              {index + 1}. {item.q}
            </Text>
            <Text style={styles.answer}>- {item.a}</Text>
          </Card>
        ))}
        {filtered.length === 0 ? (
          <Text style={styles.empty}>No help articles match that search.</Text>
        ) : null}
      </ScrollView>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search help + documentation"
      />
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  question: { color: colors.text, fontWeight: "700", fontSize: 15 },
  answer: { color: colors.textMuted, marginTop: 8, lineHeight: 20 },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 24 },
  });
}
