import * as Location from "expo-location";
import { useCallback, useState } from "react";

/** Orange County default when permission denied (requirements: app runs in OC). */
const OC_DEFAULT = { lat: 33.6846, lon: -117.8265 };

export function useLocation() {
  const [coords, setCoords] = useState(OC_DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied. Using Orange County demo coordinates.");
        setCoords(OC_DEFAULT);
        return OC_DEFAULT;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setCoords(next);
      return next;
    } catch (e) {
      setError("Could not read GPS. Using demo coordinates.");
      setCoords(OC_DEFAULT);
      return OC_DEFAULT;
    } finally {
      setLoading(false);
    }
  }, []);

  return { coords, error, loading, refresh };
}
