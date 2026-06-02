import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { api } from "../../src/api/client";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { useLocation } from "../../src/hooks/useLocation";
import {
  getPlaceDetails,
  geocodeAddress,
  searchPlacePredictions,
  type GeocodedLocation,
  type PlacePrediction,
} from "../../src/services/googleMaps";
import type { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/ThemeContext";
import type { Activity } from "../../src/types";

export default function ActivitiesScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { refresh } = useLocation();
  const [list, setList] = useState<Activity[]>([]);
  const [coords, setCoords] = useState({ lat: 33.6846, lon: -117.8265 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeocodedLocation | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"distance" | "relevance" | "capacity">("distance");
  const [showFilters, setShowFilters] = useState(false);
  const [groupSize, setGroupSize] = useState("");
  const [genderFilter, setGenderFilter] = useState("any");
  const [form, setForm] = useState({
    title: "",
    interest: "",
    schedule: "",
    locationName: "",
    capacity: "8",
    recurring: true,
  });

  const load = useCallback(async () => {
    const c = await refresh();
    setCoords(c);
    const res = await api.getActivities(c.lat, c.lon);
    setList(res.activities);
  }, [refresh]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function join(id: string) {
    if (!session) return;
    setJoining(id);
    try {
      const res = await api.joinActivity(id, session.userId);
      Alert.alert("Joined", res.message);
      await load();
    } catch (e) {
      Alert.alert("Could not join", e instanceof Error ? e.message : "Error");
    } finally {
      setJoining(null);
    }
  }

  async function leave(id: string) {
    if (!session) return;
    setLeaving(id);
    try {
      const res = await api.leaveActivity(id, session.userId);
      Alert.alert("Left activity", res.message);
      await load();
    } catch (e) {
      Alert.alert("Could not leave", e instanceof Error ? e.message : "Error");
    } finally {
      setLeaving(null);
    }
  }

  async function createActivity() {
    if (!session) return;
    setCreating(true);
    try {
      const location = selectedLocation ?? (await geocodeAddress(form.locationName));
      await api.createActivity({
        userId: session.userId,
        title: form.title,
        interest: form.interest,
        schedule: form.schedule,
        locationName: location.name,
        lat: location.lat,
        lon: location.lon,
        capacity: Number(form.capacity),
        recurring: form.recurring,
      });
      setForm({
        title: "",
        interest: "",
        schedule: "",
        locationName: "",
        capacity: "8",
        recurring: true,
      });
      setSelectedLocation(null);
      setShowCreate(false);
      Alert.alert("Created", "Activity created at the selected location.");
      await load();
    } catch (e) {
      Alert.alert("Could not create activity", e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  async function findLocation() {
    setLocating(true);
    try {
      const location = await geocodeAddress(form.locationName);
      setSelectedLocation(location);
      setForm((f) => ({ ...f, locationName: location.name }));
    } catch (e) {
      setSelectedLocation(null);
      Alert.alert("Location not found", e instanceof Error ? e.message : "Try a more specific address.");
    } finally {
      setLocating(false);
    }
  }

  const visibleActivities = useMemo(() => {
    const q = query.trim().toLowerCase();
    const targetSize = Number(groupSize);
    return [...list]
      .filter((a) => !q || `${a.title} ${a.interest} ${a.locationName}`.toLowerCase().includes(q))
      .filter((a) => !targetSize || a.capacity >= targetSize)
      .sort((a, b) => {
        if (sortBy === "capacity") return a.capacity - b.capacity;
        if (sortBy === "relevance") {
          const aMatch = q && a.interest.toLowerCase().includes(q) ? 0 : 1;
          const bMatch = q && b.interest.toLowerCase().includes(q) ? 0 : 1;
          return aMatch - bMatch;
        }
        return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
      });
  }, [groupSize, list, query, sortBy]);

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
      >
        <Text style={styles.sub}>Recurring group activities near you</Text>
        <Button
          title={showCreate ? "Cancel new activity" : "Create activity"}
          variant="secondary"
          onPress={() => setShowCreate((v) => !v)}
        />
        {showCreate ? (
          <Card>
            <Input
              label="Title"
              value={form.title}
              onChangeText={(title) => setForm((f) => ({ ...f, title }))}
              placeholder="Friday Coffee Meetup"
            />
            <Input
              label="Interest"
              value={form.interest}
              onChangeText={(interest) => setForm((f) => ({ ...f, interest }))}
              placeholder="coffee"
            />
            <Input
              label="Schedule"
              value={form.schedule}
              onChangeText={(schedule) => setForm((f) => ({ ...f, schedule }))}
              placeholder="Fridays 3:00 PM"
            />
            <PlaceInput
              center={coords}
              value={form.locationName}
              onChange={(locationName) => {
                setSelectedLocation(null);
                setForm((f) => ({ ...f, locationName }));
              }}
              onSelect={(location) => {
                setSelectedLocation(location);
                setForm((f) => ({ ...f, locationName: location.name }));
              }}
            />
            <Button
              title={locating ? "Finding location..." : "Find location"}
              variant="secondary"
              onPress={findLocation}
              loading={locating}
            />
            {selectedLocation ? (
              <Text style={styles.locationFound}>
                Location set: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lon.toFixed(4)}
              </Text>
            ) : null}
            <Input
              label="Capacity"
              keyboardType="number-pad"
              value={form.capacity}
              onChangeText={(capacity) => setForm((f) => ({ ...f, capacity }))}
            />
            <View style={styles.switchRow}>
              <Text style={styles.label}>Recurring</Text>
              <Switch
                value={form.recurring}
                onValueChange={(recurring) => setForm((f) => ({ ...f, recurring }))}
                trackColor={{ true: colors.teal }}
              />
            </View>
            <Text style={styles.meta}>
              Search and set a location before creating so the activity appears on the map.
            </Text>
            <Button title="Create" onPress={createActivity} loading={creating} />
          </Card>
        ) : null}
        <Input
          label="Search activities"
          value={query}
          onChangeText={setQuery}
          placeholder="Search by keyword"
        />
        <View style={styles.row}>
          {(["distance", "relevance", "capacity"] as const).map((option) => (
            <Text
              key={option}
              style={[styles.chip, sortBy === option && styles.chipOn]}
              onPress={() => setSortBy(option)}
            >
              {option}
            </Text>
          ))}
          <Text
            style={[styles.chip, showFilters && styles.chipOn]}
            onPress={() => setShowFilters((v) => !v)}
          >
            Filter
          </Text>
        </View>
        {showFilters ? (
          <Card>
            <Text style={styles.label}>Gender preference (prototype filter)</Text>
            <View style={styles.row}>
              {["any", "women", "men"].map((g) => (
                <Text
                  key={g}
                  style={[styles.chip, genderFilter === g && styles.chipOn]}
                  onPress={() => setGenderFilter(g)}
                >
                  {g}
                </Text>
              ))}
            </View>
            <Input
              label="Minimum group capacity"
              value={groupSize}
              onChangeText={setGroupSize}
              keyboardType="number-pad"
              placeholder="8"
            />
          </Card>
        ) : null}
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : visibleActivities.length === 0 ? (
          <EmptyState title="No activities" message="Check back later for new groups." />
        ) : (
          visibleActivities.map((a) => {
            const joined = !!session && a.memberIds.includes(session.userId);
            const members = a.members.map((m) => m.displayName).join(", ");

            return (
              <Card key={a.id}>
                <Text style={styles.title}>{a.title}</Text>
                <Text style={styles.meta}>{a.schedule}</Text>
                <Text style={styles.meta}>{a.locationName}</Text>
                <Text style={styles.meta}>
                  {a.interest} - {a.memberCount}/{a.capacity} members
                  {a.distanceKm != null ? ` - ${a.distanceKm} km` : ""}
                </Text>
                <Text style={styles.members}>Joined: {members || "No members yet"}</Text>
                {joined ? (
                  <Button
                    title={leaving === a.id ? "Leaving..." : "Leave activity"}
                    variant="danger"
                    onPress={() => leave(a.id)}
                    loading={leaving === a.id}
                    disabled={!!joining || !!leaving}
                  />
                ) : a.full ? (
                  <Text style={styles.full}>Group is full</Text>
                ) : (
                  <Button
                    title={joining === a.id ? "Joining..." : "Join activity"}
                    onPress={() => join(a.id)}
                    loading={joining === a.id}
                    disabled={!!joining || !!leaving}
                  />
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function PlaceInput({
  center,
  value,
  onChange,
  onSelect,
}: {
  center: { lat: number; lon: number };
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: GeocodedLocation) => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedNameRef = useRef("");
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const query = value.trim();
    setSearchError(null);
    if (query.length < 3 || query === selectedNameRef.current) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    const timeout = setTimeout(() => {
      searchPlacePredictions(query, center)
        .then((predictions) => {
          if (active) setSuggestions(predictions);
        })
        .catch((error) => {
          if (!active) return;
          setSuggestions([]);
          setSearchError(error instanceof Error ? error.message : "Could not search locations.");
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 450);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [center, value]);

  return (
    <View style={styles.placeWrap}>
      {Platform.OS === "web" ? (
        <>
          <Text style={styles.label}>Location name</Text>
          {React.createElement("input", {
            ref: inputRef,
            value,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              selectedNameRef.current = "";
              onChange(event.target.value);
            },
            placeholder: "Search Google Maps places",
            style: createWebPlaceInputStyle(colors),
          })}
        </>
      ) : (
        <Input
          label="Location name"
          value={value}
          onChangeText={(next) => {
            selectedNameRef.current = "";
            onChange(next);
          }}
          placeholder="UCI Student Center, Irvine, CA"
        />
      )}
      {searching ? <Text style={styles.locationHint}>Searching locations...</Text> : null}
      {searchError ? <Text style={styles.locationError}>{searchError}</Text> : null}
      {suggestions.length > 0 ? (
        <View style={styles.suggestionList}>
          {suggestions.map((prediction) => (
            <PlaceSuggestion
              key={prediction.placeId}
              prediction={prediction}
              styles={styles}
              onSelect={(location) => {
                selectedNameRef.current = location.name;
                setSuggestions([]);
                setSearchError(null);
                onSelect(location);
              }}
              onError={(message) => {
                setSearchError(message);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PlaceSuggestion({
  prediction,
  styles,
  onSelect,
  onError,
}: {
  prediction: PlacePrediction;
  styles: ReturnType<typeof createStyles>;
  onSelect: (location: GeocodedLocation) => void;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function selectPlace() {
    setLoading(true);
    try {
      const location = await getPlaceDetails(prediction);
      onSelect(location);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not load place details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Pressable style={styles.suggestion} onPress={selectPlace} disabled={loading}>
      <Text style={styles.suggestionText}>{prediction.primaryText}</Text>
      {prediction.secondaryText ? (
        <Text style={styles.suggestionMeta}>{prediction.secondaryText}</Text>
      ) : null}
      {loading ? <Text style={styles.locationHint}>Loading place...</Text> : null}
    </Pressable>
  );
}

function createWebPlaceInputStyle(colors: ThemeColors): React.CSSProperties {
  return {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    width: "100%",
    boxSizing: "border-box",
  };
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  scrollContent: { paddingBottom: 32 },
  sub: { color: colors.textMuted, marginBottom: 12, paddingHorizontal: 4 },
  label: { fontWeight: "600", color: colors.text, fontSize: 15 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: {
    color: colors.text,
    backgroundColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
    textTransform: "capitalize",
  },
  chipOn: { color: "#fff", backgroundColor: colors.teal },
  placeWrap: { marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  meta: { color: colors.textMuted, marginTop: 4 },
  members: { color: colors.text, marginTop: 8, lineHeight: 20 },
  full: { color: colors.danger, marginTop: 8, fontWeight: "600" },
  locationFound: { color: colors.tealDark, fontWeight: "600", marginBottom: 8 },
  locationHint: { color: colors.textMuted, fontSize: 13, marginTop: -4, marginBottom: 8 },
  locationError: { color: colors.warning, fontSize: 13, marginTop: -4, marginBottom: 8 },
  suggestionList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginTop: -4,
    marginBottom: 12,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionText: { color: colors.text, fontSize: 14, lineHeight: 19 },
  suggestionMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  });
}
