import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../../src/api/client";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import type { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/ThemeContext";
import type { FriendRequestSummary, FriendSummary } from "../../src/types";

export default function FriendsScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestSummary[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const res = await api.getFriends(session.userId, query);
    setFriends(res.friends);
    setIncoming(res.incoming);
    setOutgoing(res.outgoing);
  }, [session, query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load().finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [load]);

  const sorted = useMemo(
    () => [...friends].sort((a, b) => Number(a.blocked) - Number(b.blocked)),
    [friends],
  );

  async function toggleBlock(friend: FriendSummary) {
    if (!session || updatingId) return;
    setUpdatingId(friend.userId);
    setFriends((current) =>
      current.map((item) =>
        item.userId === friend.userId ? { ...item, blocked: !item.blocked } : item,
      ),
    );

    try {
      if (friend.blocked) {
        await api.unblockUser(session.userId, friend.userId);
      } else {
        await api.blockUser(session.userId, friend.userId);
      }
      await load();
    } catch (e) {
      setFriends((current) =>
        current.map((item) =>
          item.userId === friend.userId ? { ...item, blocked: friend.blocked } : item,
        ),
      );
      Alert.alert("Could not update block", e instanceof Error ? e.message : "Try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function answerRequest(requestId: string, action: "accept" | "decline") {
    if (!session || updatingId) return;
    setUpdatingId(requestId);
    try {
      if (action === "accept") {
        await api.acceptFriendRequest(session.userId, requestId);
      } else {
        await api.declineFriendRequest(session.userId, requestId);
      }
      await load();
    } catch (e) {
      Alert.alert("Could not update request", e instanceof Error ? e.message : "Try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Screen>
      <Input
        label="Search people"
        value={query}
        onChangeText={setQuery}
        placeholder="Search people"
      />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : sorted.length === 0 && incoming.length === 0 && outgoing.length === 0 ? (
          <Text style={styles.empty}>No friends yet. Add people from Discover.</Text>
        ) : (
          <>
            {incoming.length > 0 ? <Text style={styles.section}>Friend requests</Text> : null}
            {incoming.map((request) => (
              <Card key={request.requestId}>
                <View style={styles.requestRow}>
                  <PersonSummary friend={request.user} styles={styles} />
                  <View style={styles.actions}>
                    <Text
                      style={styles.accept}
                      onPress={() => answerRequest(request.requestId, "accept")}
                    >
                      Accept
                    </Text>
                    <Text
                      style={styles.decline}
                      onPress={() => answerRequest(request.requestId, "decline")}
                    >
                      Decline
                    </Text>
                  </View>
                </View>
              </Card>
            ))}

            {outgoing.length > 0 ? <Text style={styles.section}>Sent requests</Text> : null}
            {outgoing.map((request) => (
              <Card key={request.requestId}>
                <View style={styles.requestRow}>
                  <PersonSummary friend={request.user} styles={styles} />
                  <Text style={styles.pending}>Pending</Text>
                </View>
              </Card>
            ))}

            {sorted.length > 0 ? <Text style={styles.section}>Friends</Text> : null}
            {sorted.map((friend) => (
              <Card key={friend.userId}>
                <View style={styles.row}>
                  <Pressable
                    style={styles.person}
                    onPress={() =>
                      router.push({
                        pathname: "/chat/[otherUserId]",
                        params: { otherUserId: friend.userId, name: friend.displayName },
                      })
                    }
                  >
                    <PersonSummary friend={friend} styles={styles} />
                  </Pressable>
                  <Pressable
                    style={[styles.block, updatingId === friend.userId && styles.blockDisabled]}
                    onPress={() => toggleBlock(friend)}
                    disabled={updatingId === friend.userId}
                    hitSlop={12}
                  >
                    <Text style={styles.blockText}>Block</Text>
                    <View style={[styles.box, friend.blocked && styles.boxOn]}>
                      <Text style={styles.boxText}>{friend.blocked ? "X" : ""}</Text>
                    </View>
                  </Pressable>
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PersonSummary({
  friend,
  styles,
}: {
  friend: FriendSummary;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.person}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{friend.initials}</Text>
      </View>
      <Text style={styles.name}>{friend.displayName}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  person: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  requestRow: { gap: 12 },
  section: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal,
  },
  avatarText: { color: "#fff", fontWeight: "800" },
  name: { color: colors.text, fontWeight: "700", fontSize: 16 },
  block: { flexDirection: "row", alignItems: "center", gap: 8, padding: 6 },
  blockDisabled: { opacity: 0.55 },
  blockText: { color: colors.textMuted, fontWeight: "600" },
  box: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  boxOn: { backgroundColor: colors.danger, borderColor: colors.danger },
  boxText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 24 },
  actions: { flexDirection: "row", gap: 16 },
  accept: { color: colors.tealDark, fontWeight: "800" },
  decline: { color: colors.danger, fontWeight: "800" },
  pending: { color: colors.textMuted, fontWeight: "700" },
  });
}
