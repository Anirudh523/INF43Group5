import React, { useEffect, useMemo, useRef } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import {
  GOOGLE_MAPS_API_KEY,
  loadGoogleMaps,
  type GoogleMapInstance,
  type GoogleMarkerInstance,
} from "../services/googleMaps";
import type { ThemeColors } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";
import type { Activity, NearbyUser } from "../types";

type Coords = {
  lat: number;
  lon: number;
};

type GoogleMapProps = {
  center: Coords;
  nearby: NearbyUser[];
  activities?: Activity[];
};

type MarkerPoint = {
  id: string;
  lat: number;
  lon: number;
  title: string;
  content: string;
  icon: string;
};

function spreadOverlappingPoints(points: MarkerPoint[]) {
  const groups = new Map<string, MarkerPoint[]>();
  for (const point of points) {
    const key = `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }

  const spreadMeters = 18;
  const latOffset = spreadMeters / 111000;
  return points.map((point) => {
    const key = `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
    const group = groups.get(key) ?? [point];
    if (group.length === 1) return point;
    const index = group.findIndex((item) => item.id === point.id);
    const angle = (2 * Math.PI * index) / group.length;
    const lonOffset = latOffset / Math.cos((point.lat * Math.PI) / 180);
    return {
      ...point,
      lat: point.lat + Math.sin(angle) * latOffset,
      lon: point.lon + Math.cos(angle) * lonOffset,
      content: `${point.content}<br><em>${group.length} markers at this location</em>`,
    };
  });
}

export function GoogleMap({ center, nearby, activities = [] }: GoogleMapProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <View style={[styles.map, styles.missingKey]}>
        <Text style={styles.missingTitle}>Google Maps API key required</Text>
        <Text style={styles.missingText}>
          Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY before starting Expo.
        </Text>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <InteractiveWebMap
        center={center}
        nearby={nearby}
        activities={activities}
        colors={colors}
      />
    );
  }

  return <StaticMap center={center} nearby={nearby} activities={activities} styles={styles} />;
}

function InteractiveWebMap({
  center,
  nearby,
  activities = [],
  colors,
}: GoogleMapProps & { colors: ThemeColors }) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMarkerInstance[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !divRef.current || !window.google) return;
      const map =
        mapRef.current ??
        new window.google.maps.Map(divRef.current, {
          center: { lat: center.lat, lng: center.lon },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

      mapRef.current = map;
      map.setCenter({ lat: center.lat, lng: center.lon });
      markersRef.current.forEach((marker) => marker.setMap(null));
      const markerPoints = spreadOverlappingPoints([
        ...nearby
          .filter((user) => user.lat != null && user.lon != null)
          .map((user) => ({
            id: `user-${user.userId}`,
            lat: user.lat as number,
            lon: user.lon as number,
            title: user.displayName,
            content: `${user.displayName}${user.distanceKm != null ? ` - ${user.distanceKm} km away` : ""}`,
            icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
          })),
        ...activities
          .filter((activity) => activity.lat != null && activity.lon != null)
          .map((activity) => ({
            id: `activity-${activity.id}`,
            lat: activity.lat as number,
            lon: activity.lon as number,
            title: activity.title,
            content: `${activity.title}<br>${activity.schedule}<br>${activity.locationName}<br>${activity.memberCount}/${activity.capacity} members`,
            icon: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
          })),
      ]);
      markersRef.current = [
        createMarker(
          map,
          { lat: center.lat, lon: center.lon },
          "You",
          "Your location",
          "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        ),
        ...markerPoints.map((point) =>
          createMarker(
            map,
            { lat: point.lat, lon: point.lon },
            point.title,
            point.content,
            point.icon,
          ),
        ),
      ];
    });

    return () => {
      cancelled = true;
    };
  }, [activities, center, nearby]);

  return React.createElement("div", {
    ref: divRef,
    style: {
      height: 300,
      width: "100%",
      borderRadius: 8,
      overflow: "hidden",
      marginBottom: 16,
      border: `1px solid ${colors.border}`,
    },
  });
}

function createMarker(
  map: GoogleMapInstance,
  coords: Coords,
  title: string,
  content: string,
  icon?: string,
) {
  const marker = new window.google!.maps.Marker({
    position: { lat: coords.lat, lng: coords.lon },
    map,
    title,
    icon,
  });
  const info = new window.google!.maps.InfoWindow({ content });
  marker.addListener("click", () => info.open({ anchor: marker, map }));
  return marker;
}

function StaticMap({
  center,
  nearby,
  activities = [],
  styles,
}: GoogleMapProps & { styles: ReturnType<typeof createStyles> }) {
  const imageUrl = useMemo(
    () => buildStaticMapUrl(center, nearby, activities),
    [activities, center, nearby],
  );

  return (
    <View style={styles.map}>
      <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      <Text style={styles.badge}>Google Maps</Text>
    </View>
  );
}

function buildStaticMapUrl(center: Coords, nearby: NearbyUser[], activities: Activity[]) {
  const params = new URLSearchParams({
    center: `${center.lat},${center.lon}`,
    zoom: "12",
    size: "640x360",
    scale: "2",
    maptype: "roadmap",
    key: GOOGLE_MAPS_API_KEY,
  });

  params.append("markers", `color:blue|label:Y|${center.lat},${center.lon}`);

  nearby.slice(0, 9).forEach((user, index) => {
    if (user.lat == null || user.lon == null) return;
    params.append("markers", `color:green|label:${index + 1}|${user.lat},${user.lon}`);
  });

  activities.slice(0, 9).forEach((activity, index) => {
    if (activity.lat == null || activity.lon == null) return;
    params.append("markers", `color:orange|label:${index + 1}|${activity.lat},${activity.lon}`);
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  map: {
    height: 220,
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#D4E4F7",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    fontSize: 10,
    backgroundColor: colors.navy,
    color: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  missingKey: {
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  missingTitle: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 6,
    textAlign: "center",
  },
  missingText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  });
}
