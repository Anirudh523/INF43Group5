import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../../src/api/client";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import type { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/ThemeContext";
import type { ChatThread, FriendSummary } from "../../src/types";

export default function ChatListScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [query, setQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const res = await api.getChatThreads(session.userId);
    setThreads(res.threads);
    const friendsRes = await api.getFriends(session.userId);
    setFriends(friendsRes.friends.filter((f) => !f.blocked));
  }, [session]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  return (
    <Screen>
      <View style={styles.searchRow}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search chat"
          style={styles.searchInput}
        />
        <Pressable style={styles.plus} onPress={() => setShowNewChat((v) => !v)}>
          <Text style={styles.plusText}>+</Text>
        </Pressable>
      </View>
      {showNewChat ? (
        <Card>
          <Text style={styles.section}>Start a new chat</Text>
          {friends.map((friend) => (
            <Text
              key={friend.userId}
              style={styles.friend}
              onPress={() =>
                router.push({
                  pathname: "/chat/[otherUserId]",
                  params: { otherUserId: friend.userId, name: friend.displayName },
                })
              }
            >
              {friend.initials}  {friend.displayName}
            </Text>
          ))}
        </Card>
      ) : null}
      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : threads.length === 0 ? (
          <EmptyState
            title="No conversations yet"
            message="Message someone from the Discover tab."
          />
        ) : (
          threads
            .filter((t) => `${t.displayName} ${t.lastMessage}`.toLowerCase().includes(query.toLowerCase()))
            .map((t) => (
            <Pressable
              key={t.otherUserId}
              onPress={() =>
                router.push({
                  pathname: "/chat/[otherUserId]",
                  params: { otherUserId: t.otherUserId, name: t.displayName },
                })
              }
            >
              <Card>
                <Text style={styles.name}>{t.displayName}</Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {t.lastMessage}
                </Text>
              </Card>
            </Pressable>
            ))
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  searchInput: { minWidth: 0 },
  plus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal,
    marginTop: 0,
  },
  plusText: { color: "#fff", fontSize: 28, lineHeight: 30, fontWeight: "700" },
  section: { color: colors.text, fontWeight: "700", marginBottom: 8 },
  friend: { color: colors.tealDark, paddingVertical: 8, fontWeight: "600" },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  preview: { color: colors.textMuted, marginTop: 4 },
  });
}
