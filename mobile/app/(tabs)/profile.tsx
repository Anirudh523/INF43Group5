import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import type { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/ThemeContext";

const PROMPTS = [
  "My favorite weekend activity is ___",
  "I'm looking for friends who enjoy ___",
  "A fun fact about me: ___",
];
const GENDER_OPTIONS = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "non-binary", label: "Non-binary" },
  { id: "other", label: "Other" },
];
const SEXUALITY_OPTIONS = [
  { id: "straight", label: "Straight" },
  { id: "gay", label: "Gay" },
  { id: "lesbian", label: "Lesbian" },
  { id: "bisexual", label: "Bisexual" },
  { id: "pansexual", label: "Pansexual" },
  { id: "queer", label: "Queer" },
  { id: "asexual", label: "Asexual" },
  { id: "other", label: "Other" },
];

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function ProfileScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [interests, setInterests] = useState<string[]>([]);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [sexuality, setSexuality] = useState("");
  const [photoMocked, setPhotoMocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    const p = await api.getProfile(session.userId);
    setBio(p.bio ?? "");
    setIsPublic(p.isPublic);
    setInterests(p.interests ?? []);
    setAge(p.age != null ? String(p.age) : "");
    setGender(p.gender ?? "");
    setSexuality(p.sexuality ?? "");
  }, [session]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function save() {
    if (!session) return;
    setError("");
    if (wordCount(bio) > 350) {
      setError("Bio must be 350 words or fewer.");
      return;
    }
    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 99) {
      setError("Age must be from 18 to 99.");
      return;
    }
    if (!gender || !sexuality) {
      setError("Choose your gender and sexuality.");
      return;
    }
    setSaving(true);
    try {
      await api.patchProfile(session.userId, {
        bio,
        isPublic,
        interests,
        age: parsedAge,
        gender,
        sexuality,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Card>
        <Pressable
          style={styles.avatar}
          onPress={() => {
            setPhotoMocked(true);
            Alert.alert("Profile picture", "Upload, crop, and zoom are mocked in this prototype.");
          }}
        >
          <Text style={styles.avatarText}>
            {photoMocked ? "OK" : session?.displayName?.slice(0, 1) ?? "?"}
          </Text>
        </Pressable>
        <Text style={styles.addPhoto} onPress={() => setPhotoMocked(true)}>
          Add profile picture
        </Text>
        <Text style={styles.name}>{session?.displayName}</Text>
        <Text style={styles.meta}>
          ID verified: {session?.idVerified ? "Yes (mock)" : "Pending"}
        </Text>
        <Text style={styles.meta}>Visibility: {isPublic ? "Public" : "Private"}</Text>
        <Text style={styles.meta}>
          Age: {age || "Not set"} - Gender: {gender || "Not set"} - Sexuality:{" "}
          {sexuality || "Not set"}
        </Text>
      </Card>

      <Text style={styles.section}>Edit bio</Text>
      <Input
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={6}
        error={error}
        placeholder="Hobbies, goals, boundaries..."
        onBlur={save}
      />
      <Text style={styles.count}>{wordCount(bio)}/350 words</Text>

      <Text style={styles.section}>Discovery profile</Text>
      <Input
        label="Age"
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        placeholder="22"
      />
      <Text style={styles.label}>Gender</Text>
      <View style={styles.chips}>
        {GENDER_OPTIONS.map((option) => (
          <Text
            key={option.id}
            onPress={() => setGender(option.id)}
            style={[styles.chip, gender === option.id && styles.chipOn]}
          >
            {option.label}
          </Text>
        ))}
      </View>
      <Text style={styles.label}>Sexuality</Text>
      <View style={styles.chips}>
        {SEXUALITY_OPTIONS.map((option) => (
          <Text
            key={option.id}
            onPress={() => setSexuality(option.id)}
            style={[styles.chip, sexuality === option.id && styles.chipOn]}
          >
            {option.label}
          </Text>
        ))}
      </View>

      <Text style={styles.section}>Bio prompts</Text>
      {PROMPTS.map((p) => (
        <Text key={p} style={styles.prompt} onPress={() => setBio(p)}>
          {p}
        </Text>
      ))}

      <View style={styles.row}>
        <Button
          title={isPublic ? "Switch to private" : "Switch to public"}
          variant="secondary"
          onPress={() => setIsPublic(!isPublic)}
        />
      </View>
      <Button title="Save profile" onPress={save} loading={saving} />
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  addPhoto: { color: colors.tealDark, fontWeight: "600", marginBottom: 12 },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  meta: { color: colors.textMuted, marginTop: 4 },
  section: { fontWeight: "600", marginTop: 8, marginBottom: 8, color: colors.text },
  label: { fontWeight: "600", marginBottom: 8, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.border,
    color: colors.text,
    overflow: "hidden",
  },
  chipOn: { backgroundColor: colors.teal, color: "#fff" },
  count: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  prompt: {
    color: colors.tealDark,
    marginBottom: 8,
    paddingVertical: 6,
  },
  row: { marginVertical: 8 },
  });
}
