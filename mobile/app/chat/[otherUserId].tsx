import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../../src/api/client";
import { Button } from "../../src/components/Button";
import { useAuth } from "../../src/context/AuthContext";
import type { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/ThemeContext";
import type { ChatMessage } from "../../src/types";

export default function ChatDetailScreen() {
  const { session } = useAuth();
  const { colors, darkMode } = useTheme();
  const styles = createStyles(colors);
  const { otherUserId, name } = useLocalSearchParams<{ otherUserId: string; name?: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session || !otherUserId) return;
    setError("");
    try {
      const res = await api.getChatMessages(session.userId, otherUserId);
      setMessages(res.messages);
    } catch (e) {
      setMessages([]);
      setError(e instanceof Error ? e.message : "Could not load conversation.");
    }
  }, [session, otherUserId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function send() {
    if (!session || !text.trim()) return;
    setSending(true);
    setError("");
    try {
      await api.sendMessage(session.userId, otherUserId, text.trim());
      setText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  function report() {
    if (!session) return;
    Alert.alert("Report user", "Submit a report for harassment or spam?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await api.reportUser(session.userId, otherUserId);
            setError(res.message);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not report user.");
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>{name ?? otherUserId}</Text>
        <Text style={styles.report} onPress={report}>
          Report / block
        </Text>
      </View>
      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
          <Pressable onPress={() => setError("")} hitSlop={10}>
            <Text style={styles.bannerClose}>X</Text>
          </Pressable>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.teal} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mine = item.fromUserId === session?.userId;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={mine ? styles.mineText : styles.theirsText}>{item.text}</Text>
              </View>
            );
          }}
        />
      )}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          keyboardAppearance={darkMode ? "dark" : "light"}
          multiline
        />
        <Button title="Send" onPress={send} loading={sending} disabled={!text.trim() || !!error} />
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.navy,
  },
  back: { color: colors.teal, marginBottom: 8, fontWeight: "700" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  report: { color: colors.teal, marginTop: 6, fontSize: 13 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#FEE2E2",
    borderBottomWidth: 1,
    borderBottomColor: "#FCA5A5",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerText: { color: colors.danger, flex: 1, lineHeight: 18 },
  bannerClose: { color: colors.danger, fontWeight: "800", padding: 4 },
  list: { padding: 16, flexGrow: 1 },
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  mine: { alignSelf: "flex-end", backgroundColor: colors.teal },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mineText: { color: "#fff" },
  theirsText: { color: colors.text },
  composer: { padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    maxHeight: 100,
    color: colors.text,
  },
  });
}
