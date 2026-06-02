import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { api } from "../../src/api/client";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { useTheme } from "../../src/theme/ThemeContext";
import type { Settings } from "../../src/types";

const GENDER_OPTIONS = [
  { id: "any", label: "Any" },
  { id: "woman", label: "Women" },
  { id: "man", label: "Men" },
  { id: "non-binary", label: "Non-binary" },
  { id: "other", label: "Other" },
];

const SEXUALITY_OPTIONS = [
  { id: "any", label: "Any" },
  { id: "straight", label: "Straight" },
  { id: "gay", label: "Gay" },
  { id: "lesbian", label: "Lesbian" },
  { id: "bisexual", label: "Bisexual" },
  { id: "pansexual", label: "Pansexual" },
  { id: "queer", label: "Queer" },
  { id: "asexual", label: "Asexual" },
  { id: "other", label: "Other" },
];

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { colors, setDarkMode } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setSettings(await api.getSettings(session.userId));
  }, [session]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function save(patch: Partial<Settings>) {
    if (!session || !settings) return;
    setSaving(true);
    try {
      const res = await api.patchSettings(session.userId, patch);
      setSettings(res.settings);
      if (typeof patch.darkMode === "boolean") {
        setDarkMode(patch.darkMode);
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function expandSearch() {
    if (!settings) return;
    save({
      filters: {
        ...settings.filters,
        ageMin: 18,
        ageMax: 99,
        genders: ["any"],
        sexualities: ["any"],
      },
      discoveryRadiusKm: Math.min(100, settings.discoveryRadiusKm + 10),
    });
  }

  if (loading || !settings) {
    return (
      <Screen>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Card>
        <Text style={[styles.label, { color: colors.text }]}>Discovery range</Text>
        <Text style={[styles.value, { color: colors.textMuted }]}>
          {settings.discoveryRadiusKm} km
        </Text>
        <View style={styles.row}>
          <Button
            title="- 1 km"
            variant="secondary"
            onPress={() =>
              save({ discoveryRadiusKm: Math.max(1, settings.discoveryRadiusKm - 1) })
            }
          />
          <Button
            title="+ 1 km"
            variant="secondary"
            onPress={() =>
              save({ discoveryRadiusKm: Math.min(100, settings.discoveryRadiusKm + 1) })
            }
          />
        </View>
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.text }]}>Public profile</Text>
          <Switch
            value={settings.isPublic}
            onValueChange={(v) => save({ isPublic: v })}
            trackColor={{ true: colors.teal }}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.label, { color: colors.text }]}>Dark mode</Text>
            <Text style={[styles.value, { color: colors.textMuted }]}>
              {settings.darkMode ? "Using the dark app theme" : "Using the light app theme"}
            </Text>
          </View>
          <Switch
            value={settings.darkMode}
            onValueChange={(v) => save({ darkMode: v })}
            trackColor={{ true: colors.teal }}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.label, { color: colors.text }]}>Notifications</Text>
            <Text style={[styles.value, { color: colors.textMuted }]}>
              {settings.notificationsEnabled ? "Enabled" : "Disabled"}
            </Text>
          </View>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={(v) => save({ notificationsEnabled: v })}
            trackColor={{ true: colors.teal }}
          />
        </View>
        <Text style={[styles.label, { color: colors.text }]}>Notification style</Text>
        <View style={styles.row}>
          {(["banner", "popup"] as const).map((style) => (
            <Text
              key={style}
              style={[
                styles.chip,
                { backgroundColor: colors.border, color: colors.text },
                settings.notificationStyle === style &&
                  settings.notificationsEnabled && {
                    ...styles.chipOn,
                    backgroundColor: colors.teal,
                  },
                !settings.notificationsEnabled && styles.disabledChip,
              ]}
              onPress={() =>
                settings.notificationsEnabled ? save({ notificationStyle: style }) : undefined
              }
            >
              {style === "banner" ? "Banner" : "Pop-up"}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={[styles.label, { color: colors.text }]}>Filters (age)</Text>
        <Text style={[styles.value, { color: colors.textMuted }]}>
          Ages {settings.filters.ageMin}-{settings.filters.ageMax}
        </Text>
        <View style={styles.row}>
          <Button
            title="Younger range"
            variant="secondary"
            onPress={() =>
              save({
                filters: {
                  ...settings.filters,
                  ageMin: 18,
                  ageMax: 28,
                },
              })
            }
          />
          <Button
            title="Expand search"
            onPress={expandSearch}
          />
        </View>
        <Text style={[styles.label, { color: colors.text }]}>Gender filter</Text>
        {GENDER_OPTIONS.map((g) => {
          const active = settings.filters.genders.includes(g.id);
          return (
            <Text
              key={g.id}
              style={[
                styles.chip,
                { backgroundColor: colors.border, color: colors.text },
                active && { ...styles.chipOn, backgroundColor: colors.teal },
              ]}
              onPress={() =>
                save({
                  filters: {
                    ...settings.filters,
                    genders: g.id === "any" ? ["any"] : [g.id],
                  },
                })
              }
            >
              {g.label}
            </Text>
          );
        })}
        <Text style={[styles.label, { color: colors.text }]}>Sexuality filter</Text>
        {SEXUALITY_OPTIONS.map((s) => {
          const active = (settings.filters.sexualities ?? ["any"]).includes(s.id);
          return (
            <Text
              key={s.id}
              style={[
                styles.chip,
                { backgroundColor: colors.border, color: colors.text },
                active && { ...styles.chipOn, backgroundColor: colors.teal },
              ]}
              onPress={() =>
                save({
                  filters: {
                    ...settings.filters,
                    sexualities: s.id === "any" ? ["any"] : [s.id],
                  },
                })
              }
            >
              {s.label}
            </Text>
          );
        })}
      </Card>

      <Button title="Save all" onPress={() => save(settings)} loading={saving} />
      <Button
        title="Sign out"
        variant="danger"
        onPress={async () => {
          await signOut();
          router.replace("/(auth)/login");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: "600", fontSize: 15 },
  value: { marginTop: 4, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chip: {
    padding: 10,
    marginTop: 6,
    borderRadius: 8,
    overflow: "hidden",
  },
  chipOn: { color: "#fff" },
  disabledChip: { opacity: 0.45 },
});
