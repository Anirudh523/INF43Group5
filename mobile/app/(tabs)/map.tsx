import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { api } from "../../src/api/client";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { GoogleMap } from "../../src/components/GoogleMap";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { useLocation } from "../../src/hooks/useLocation";
import type { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/ThemeContext";
import type { Activity, NearbyUser } from "../../src/types";

export default function MapScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { coords, refresh, loading: locLoading, error: locError } = useLocation();
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [emptyMessage, setEmptyMessage] = useState<string | undefined>();
  const [apiError, setApiError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setApiError(undefined);
    const c = await refresh();
    await api.postLocation(session.userId, c.lat, c.lon);
    const [nearbyRes, activitiesRes] = await Promise.all([
      api.getNearby(c.lat, c.lon, session.userId),
      api.getActivities(c.lat, c.lon),
    ]);
    setNearby(nearbyRes.nearby);
    setActivities(activitiesRes.activities);
    setEmptyMessage(nearbyRes.emptyMessage);
  }, [session, refresh]);

  useEffect(() => {
    load()
      .catch((e) => setApiError(e instanceof Error ? e.message : "Could not load discovery."))
      .finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load()
        .catch((e) => {
          if (active) setApiError(e instanceof Error ? e.message : "Could not refresh discovery.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      const interval = setInterval(() => {
        load().catch((e) =>
          setApiError(e instanceof Error ? e.message : "Could not refresh discovery."),
        );
      }, 60000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Could not refresh discovery.");
    } finally {
      setRefreshing(false);
    }
  }

  async function sendFriendRequest(otherUserId: string) {
    if (!session || requestingId) return;
    setRequestingId(otherUserId);
    try {
      const res = await api.sendFriendRequest(session.userId, otherUserId);
      setNearby((current) =>
        current.map((user) =>
          user.userId === otherUserId
            ? { ...user, friendshipStatus: res.status as NearbyUser["friendshipStatus"] }
            : user,
        ),
      );
      Alert.alert("Friend request", res.message ?? "Friend request sent.");
    } catch (e) {
      Alert.alert("Could not send request", e instanceof Error ? e.message : "Try again.");
    } finally {
      setRequestingId(null);
    }
  }

  function friendActionLabel(status: NearbyUser["friendshipStatus"], userId: string) {
    if (requestingId === userId) return "Sending...";
    if (status === "friends") return "Friends";
    if (status === "outgoing") return "Request sent";
    if (status === "incoming") return "Request received";
    return "Add friend";
  }

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {locError ? <Text style={styles.warn}>{locError}</Text> : null}
        {apiError ? <Text style={styles.warn}>{apiError}</Text> : null}
        {loading || locLoading ? (
          <ActivityIndicator color={colors.teal} style={{ marginVertical: 24 }} />
        ) : (
          <>
            <GoogleMap center={coords} nearby={nearby} activities={activities} />
            {nearby.length === 0 ? (
              <EmptyState
                title="No one nearby"
                message={
                  emptyMessage ?? "Try expanding discovery range or clearing filters in Settings."
                }
              />
            ) : (
              nearby.map((u) => (
                <Card key={u.userId}>
                  <Text style={styles.name}>{u.displayName}</Text>
                  <Text style={styles.meta}>
                    {u.distanceKm} km - {u.interests?.join(", ") || "No interests"}
                  </Text>
                  {u.bio ? <Text style={styles.bio}>{u.bio}</Text> : null}
                  {u.isPrivate ? <Text style={styles.private}>Private profile</Text> : null}
                  <Pressable
                    disabled={u.friendshipStatus !== "none" || requestingId === u.userId}
                    onPress={() => sendFriendRequest(u.userId)}
                  >
                    <Text
                      style={[
                        styles.friendLink,
                        u.friendshipStatus !== "none" && styles.disabledLink,
                      ]}
                    >
                      {friendActionLabel(u.friendshipStatus ?? "none", u.userId)}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/chat/[otherUserId]",
                        params: { otherUserId: u.userId, name: u.displayName },
                      })
                    }
                  >
                    <Text style={styles.chatLink}>Message</Text>
                  </Pressable>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  warn: { color: colors.warning, marginBottom: 8, fontSize: 13 },
  name: { fontSize: 17, fontWeight: "700", color: colors.text },
  meta: { color: colors.textMuted, marginTop: 4 },
  bio: { marginTop: 8, color: colors.text, lineHeight: 20 },
  private: { marginTop: 6, fontStyle: "italic", color: colors.textMuted },
  chatLink: { marginTop: 10, color: colors.tealDark, fontWeight: "600" },
  friendLink: { marginTop: 10, color: colors.navy, fontWeight: "700" },
  disabledLink: { color: colors.textMuted },
  });
}
