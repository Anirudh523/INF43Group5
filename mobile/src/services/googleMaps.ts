import Constants from "expo-constants";
import { Platform } from "react-native";

export type GeocodedLocation = {
  name: string;
  lat: number;
  lon: number;
};

export type Coords = {
  lat: number;
  lon: number;
};

export type PlacePrediction = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  description: string;
  lat?: number;
  lon?: number;
};

const DEMO_LOCATIONS: GeocodedLocation[] = [
  { name: "UCI Student Center, Irvine, CA", lat: 33.6499, lon: -117.8427 },
  { name: "Aldrich Park, Irvine, CA", lat: 33.6461, lon: -117.8427 },
  { name: "Langson Library, Irvine, CA", lat: 33.6475, lon: -117.8418 },
  { name: "Anteater Recreation Center, Irvine, CA", lat: 33.6436, lon: -117.8262 },
  { name: "University Town Center, Irvine, CA", lat: 33.6492, lon: -117.8394 },
  { name: "Irvine Spectrum Center, Irvine, CA", lat: 33.6507, lon: -117.7435 },
  { name: "Mason Regional Park, Irvine, CA", lat: 33.6612, lon: -117.8304 },
  { name: "Diamond Jamboree, Irvine, CA", lat: 33.6899, lon: -117.8333 },
  { name: "Fashion Island, Newport Beach, CA", lat: 33.6151, lon: -117.8756 },
  { name: "South Coast Plaza, Costa Mesa, CA", lat: 33.6912, lon: -117.8894 },
];

function distanceKm(a: Coords, b: Coords) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function localLocationMatches(query: string, center?: Coords) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];
  const matches = DEMO_LOCATIONS.filter((location) =>
    location.name.toLowerCase().includes(normalized),
  );
  if (!center) return matches;
  return matches.sort((a, b) => distanceKm(center, a) - distanceKm(center, b));
}

type GoogleMapInstance = {
  setCenter: (center: { lat: number; lng: number }) => void;
};

type GoogleMarkerInstance = {
  addListener: (eventName: string, callback: () => void) => void;
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleInfoWindowInstance = {
  open: (options: { anchor: GoogleMarkerInstance; map: GoogleMapInstance }) => void;
};

type GoogleGeocoderResult = {
  formatted_address: string;
  geometry: { location: { lat: () => number; lng: () => number } };
};

type GoogleGeocoder = {
  geocode: (
    request: { address: string },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ) => void;
};

type GoogleAutocomplete = {
  addListener: (eventName: string, callback: () => void) => void;
  getPlace: () => GooglePlaceResult;
};

type GooglePlaceResult = {
  formatted_address?: string;
  name?: string;
  geometry?: { location?: { lat: () => number; lng: () => number } };
};

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
        Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
        InfoWindow: new (options: Record<string, unknown>) => GoogleInfoWindowInstance;
        Geocoder: new () => GoogleGeocoder;
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            options: Record<string, unknown>,
          ) => GoogleAutocomplete;
        };
      };
    };
    __findmeGoogleMapsLoading?: Promise<void>;
  }
}

export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
  Constants.expoConfig?.extra?.googleMapsApiKey ??
  "";

export function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires web."));
  if (window.google?.maps) return Promise.resolve();
  if (window.__findmeGoogleMapsLoading) return window.__findmeGoogleMapsLoading;

  window.__findmeGoogleMapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY,
    )}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps JavaScript API failed to load."));
    document.head.appendChild(script);
  });

  return window.__findmeGoogleMapsLoading;
}

export async function attachPlaceAutocomplete(
  input: HTMLInputElement,
  onSelect: (location: GeocodedLocation) => void,
  center?: Coords,
) {
  await loadGoogleMaps();
  const Autocomplete = window.google?.maps.places?.Autocomplete;
  if (!Autocomplete) throw new Error("Google Places API is not available.");
  const autocomplete = new Autocomplete(input, {
    fields: ["formatted_address", "geometry", "name"],
    ...(center
      ? {
          bounds: boundsAround(center, 30),
        }
      : {}),
    componentRestrictions: { country: "us" },
  });
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    const loc = place.geometry?.location;
    if (!loc) return;
    onSelect({
      name: place.formatted_address ?? place.name ?? input.value,
      lat: loc.lat(),
      lon: loc.lng(),
    });
  });
  return autocomplete;
}

export async function geocodeAddress(address: string): Promise<GeocodedLocation> {
  const query = address.trim();
  if (!query) throw new Error("Enter a location first.");
  const localMatch = localLocationMatches(query)[0];
  if (!GOOGLE_MAPS_API_KEY) {
    if (localMatch) return localMatch;
    throw new Error("Google Maps API key required.");
  }

  if (Platform.OS === "web") {
    await loadGoogleMaps();
    const geocoder = new window.google!.maps.Geocoder();
    const result = await new Promise<GoogleGeocoderResult>((resolve, reject) => {
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === "OK" && results?.[0]) resolve(results[0]);
        else reject(new Error("No matching location found."));
      });
    });
    return {
      name: result.formatted_address,
      lat: result.geometry.location.lat(),
      lon: result.geometry.location.lng(),
    };
  }

  const results = await fetchGeocodingResults(query);
  if (!results[0]) {
    if (localMatch) return localMatch;
    throw new Error("No matching location found.");
  }
  return resultToLocation(results[0]);
}

export async function searchLocations(queryText: string, center?: Coords): Promise<GeocodedLocation[]> {
  const query = queryText.trim();
  if (query.length < 3) return [];
  const localMatches = localLocationMatches(query, center);
  if (!GOOGLE_MAPS_API_KEY) return localMatches;

  if (Platform.OS === "web") {
    const result = await geocodeAddress(query);
    return [result];
  }

  try {
    const results = await fetchGeocodingResults(query);
    const googleMatches = results.slice(0, 5).map(resultToLocation);
    const merged = [...localMatches, ...googleMatches].filter(
      (location, index, all) => all.findIndex((item) => item.name === location.name) === index,
    );
    return merged.slice(0, 5);
  } catch (error) {
    if (localMatches.length > 0) return localMatches;
    throw error;
  }
}

export async function searchPlacePredictions(
  queryText: string,
  center?: Coords,
): Promise<PlacePrediction[]> {
  const query = queryText.trim();
  if (query.length < 3) return [];
  if (!GOOGLE_MAPS_API_KEY) {
    return localLocationMatches(query, center).map((location) => ({
      placeId: `local:${location.name}`,
      primaryText: location.name.split(",")[0],
      secondaryText: location.name.split(",").slice(1).join(",").trim(),
      description: location.name,
      lat: location.lat,
      lon: location.lon,
    }));
  }

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${new URLSearchParams({
    query,
    key: GOOGLE_MAPS_API_KEY,
    location: `${center?.lat ?? 33.6846},${center?.lon ?? -117.8265}`,
    radius: "30000",
  })}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
  if (!res.ok) throw new Error(`Google Places lookup failed (${res.status}).`);
  const data = await res.json();
  if (data.status === "ZERO_RESULTS") return [];
  if (data.status !== "OK" || !Array.isArray(data.results)) {
    const detail = data.error_message ? ` ${data.error_message}` : "";
    throw new Error(`Google Places lookup failed: ${data.status}.${detail}`);
  }

  return data.results
    .map((result: {
      place_id: string;
      name: string;
      formatted_address?: string;
      geometry?: { location?: { lat: number; lng: number } };
    }) => ({
      placeId: result.place_id,
      primaryText: result.name,
      secondaryText: result.formatted_address ?? "",
      description: result.formatted_address ? `${result.name}, ${result.formatted_address}` : result.name,
      lat: result.geometry?.location?.lat,
      lon: result.geometry?.location?.lng,
    }))
    .sort((a: PlacePrediction, b: PlacePrediction) =>
      placePredictionScore(b, query, center) - placePredictionScore(a, query, center),
    )
    .slice(0, 6);
}

function boundsAround(center: Coords, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lon + lonDelta,
    west: center.lon - lonDelta,
  };
}

export async function getPlaceDetails(prediction: PlacePrediction): Promise<GeocodedLocation> {
  if (prediction.lat != null && prediction.lon != null) {
    return {
      name: prediction.secondaryText ? `${prediction.primaryText}, ${prediction.secondaryText}` : prediction.primaryText,
      lat: prediction.lat,
      lon: prediction.lon,
    };
  }

  if (prediction.placeId.startsWith("local:")) {
    const localMatch = DEMO_LOCATIONS.find((location) => location.name === prediction.description);
    if (localMatch) return localMatch;
  }
  if (!GOOGLE_MAPS_API_KEY) throw new Error("Google Maps API key required.");

  const url = `https://maps.googleapis.com/maps/api/place/details/json?${new URLSearchParams({
    place_id: prediction.placeId,
    fields: "formatted_address,name,geometry",
    key: GOOGLE_MAPS_API_KEY,
  })}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
  if (!res.ok) throw new Error(`Google Place Details failed (${res.status}).`);
  const data = await res.json();
  if (data.status !== "OK" || !data.result?.geometry?.location) {
    const detail = data.error_message ? ` ${data.error_message}` : "";
    throw new Error(`Google Place Details failed: ${data.status}.${detail}`);
  }
  return {
    name: data.result.formatted_address ?? data.result.name ?? prediction.description,
    lat: data.result.geometry.location.lat,
    lon: data.result.geometry.location.lng,
  };
}

function placePredictionScore(prediction: PlacePrediction, query: string, center?: Coords) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  const primary = prediction.primaryText.toLowerCase();
  const secondary = prediction.secondaryText.toLowerCase();
  const description = prediction.description.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (primary === term) score += 80;
    else if (primary.startsWith(term)) score += 60;
    else if (primary.includes(term)) score += 45;
    else if (description.includes(term)) score += 12;
    else if (secondary.includes(term)) score += 6;
  }

  if (terms.every((term) => primary.includes(term))) score += 90;
  if (terms.some((term) => primary.includes(term))) score += 35;
  if (center && prediction.lat != null && prediction.lon != null) {
    const km = distanceKm(center, { lat: prediction.lat, lon: prediction.lon });
    score += Math.max(0, 35 - km);
  }

  return score;
}

type GoogleGeocodingApiResult = {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
};

function resultToLocation(result: GoogleGeocodingApiResult): GeocodedLocation {
  return {
    name: result.formatted_address,
    lat: result.geometry.location.lat,
    lon: result.geometry.location.lng,
  };
}

async function fetchGeocodingResults(query: string): Promise<GoogleGeocodingApiResult[]> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${new URLSearchParams({
    address: query,
    key: GOOGLE_MAPS_API_KEY,
  })}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
  if (!res.ok) throw new Error(`Google location lookup failed (${res.status}).`);
  const data = await res.json();
  if (data.status === "ZERO_RESULTS") return [];
  if (data.status !== "OK" || !Array.isArray(data.results)) {
    const detail = data.error_message ? ` ${data.error_message}` : "";
    throw new Error(`Google location lookup failed: ${data.status}.${detail}`);
  }

  return data.results;
}

export type {
  GoogleAutocomplete,
  GoogleInfoWindowInstance,
  GoogleMapInstance,
  GoogleMarkerInstance,
};
