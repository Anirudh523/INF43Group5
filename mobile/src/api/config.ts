import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * API base URL for Node.js server (HTTPS+JSON in production per architecture PDF).
 * - Expo Go device: infer the Metro host IP when available
 * - iOS simulator: localhost
 * - Android emulator: 10.0.2.2
 * - Physical device: set EXPO_PUBLIC_API_URL to your PC's LAN IP, e.g. http://192.168.1.5:3000
 */
function defaultHost(): string {
  const expoHostUri = (Constants.expoConfig as { hostUri?: string } | null)?.hostUri;
  const expoHost = expoHostUri?.split(":")[0];
  if (expoHost && expoHost !== "localhost" && expoHost !== "127.0.0.1") {
    return `http://${expoHost}:3000`;
  }

  if (Platform.OS === "web") return "http://localhost:3000";
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  defaultHost();
