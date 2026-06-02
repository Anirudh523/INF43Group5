import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import type { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/ThemeContext";

const INTERESTS = ["hiking", "study", "skiing", "sports", "language", "coffee"];
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

export default function RegisterScreen() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [sexuality, setSexuality] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [idUploaded, setIdUploaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleInterest(i: string) {
    setPicked((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  function updateEmail(next: string) {
    setEmail(next);
    setEmailVerified(false);
  }

  function verifyEmailMock() {
    setError("");
    const normalized = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Enter a valid email before verifying.");
      return;
    }
    setEmailVerified(true);
    Alert.alert("Email verified", "Mock email verification completed.");
  }

  async function submitNames() {
    setError("");
    if (!firstName.trim() || !lastName.trim()) {
      setError("Real first and last name required.");
      return;
    }
    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 99) {
      setError("Enter an age from 18 to 99.");
      return;
    }
    if (!gender) {
      setError("Choose your gender.");
      return;
    }
    if (!sexuality) {
      setError("Choose your sexuality.");
      return;
    }
    setStep(2);
  }

  async function submitAccount() {
    setError("");
    if (!emailVerified) {
      setError("Verify your email before creating an account.");
      return;
    }
    const id = userId.trim() || email.split("@")[0];
    setLoading(true);
    try {
      await api.register({
        userId: id,
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        age: Number(age),
        gender,
        sexuality,
        interests: picked,
      });
      setUserId(id);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitIdMock() {
    if (!idUploaded) {
      setIdUploaded(true);
      Alert.alert("Uploaded", "ID photo selected (mock). Verification is now pending.");
      return;
    }
    setLoading(true);
    try {
      const mockImage = "data:image/jpeg;base64,mock-government-id-verification-stub";
      const res = await api.verifyId(userId, mockImage);
      await signIn({
        userId,
        displayName: `${firstName} ${lastName}`,
        idVerified: true,
        token: res.token,
      });
      Alert.alert("Verified", "ID approved (mock verification service).");
      router.replace("/(tabs)/map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ID verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.step}>Step {step} of 3</Text>

      {step === 1 && (
        <>
          <Text style={styles.info}>
            Government-issued ID is required for safety (mocked in this prototype).
          </Text>
          <Input label="First name" value={firstName} onChangeText={setFirstName} />
          <Input label="Last name" value={lastName} onChangeText={setLastName} />
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
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Button title="Continue" onPress={submitNames} />
        </>
      )}

      {step === 2 && (
        <>
          <Input label="Email" autoCapitalize="none" value={email} onChangeText={updateEmail} />
          <Button
            title={emailVerified ? "Email verified" : "Verify email (mock)"}
            variant="secondary"
            onPress={verifyEmailMock}
            disabled={emailVerified}
          />
          {emailVerified ? (
            <Text style={styles.pending}>Email address verified for this prototype.</Text>
          ) : null}
          <Input label="Password" secureTextEntry value={password} onChangeText={setPassword} />
          <Input
            label="Username (optional)"
            value={userId}
            onChangeText={setUserId}
            placeholder="Defaults to email prefix"
          />
          <Text style={styles.label}>Subscribe to interests</Text>
          <View style={styles.chips}>
            {INTERESTS.map((i) => (
              <Text
                key={i}
                onPress={() => toggleInterest(i)}
                style={[styles.chip, picked.includes(i) && styles.chipOn]}
              >
                {i}
              </Text>
            ))}
          </View>
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Button title="Create account" onPress={submitAccount} loading={loading} />
        </>
      )}

      {step === 3 && (
        <>
          <Text style={styles.info}>
            Upload a clear photo of your driver&apos;s license, passport, or state ID. This
            prototype simulates scanning without storing real images.
          </Text>
          {idUploaded ? (
            <Text style={styles.pending}>
              Thank you for signing up. Verification pending, check back later.
            </Text>
          ) : null}
          <Button
            title={idUploaded ? "Approve ID (mock)" : "Upload ID (mock)"}
            onPress={submitIdMock}
            loading={loading}
          />
          {error ? <Text style={styles.err}>{error}</Text> : null}
        </>
      )}
      <Text style={styles.back} onPress={() => router.replace("/(auth)/login")}>
        Back to Sign-in
      </Text>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  title: { fontSize: 26, fontWeight: "700", color: colors.text },
  step: { color: colors.textMuted, marginBottom: 16 },
  info: { color: colors.textMuted, marginBottom: 16, lineHeight: 20 },
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
  err: { color: colors.danger, marginBottom: 8 },
  pending: { color: colors.tealDark, fontWeight: "700", marginBottom: 12, lineHeight: 20 },
  back: { color: colors.tealDark, textAlign: "center", marginTop: 16, fontWeight: "600" },
  });
}
