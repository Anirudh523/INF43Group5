import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
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
  description: string;
  pinColor: string;
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
      description: `${point.description} - ${group.length} markers at this location`,
    };
  });
}

export function GoogleMap({ center, nearby, activities = [] }: GoogleMapProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const mapRef = useRef<MapView | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const region = useMemo(
    () => ({
      latitude: center.lat,
      longitude: center.lon,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }),
    [center.lat, center.lon],
  );

  useEffect(() => {
    mapRef.current?.animateToRegion(region, 400);
  }, [region]);

  const markerPoints = useMemo(
    () =>
      spreadOverlappingPoints([
        ...nearby
          .filter((user) => user.lat != null && user.lon != null)
          .map((user) => ({
            id: `user-${user.userId}`,
            lat: user.lat as number,
            lon: user.lon as number,
            title: user.displayName,
            description:
              user.distanceKm != null ? `${user.distanceKm} km away` : "Nearby friend",
            pinColor: "#10B981",
          })),
        ...activities
          .filter((activity) => activity.lat != null && activity.lon != null)
          .map((activity) => ({
            id: `activity-${activity.id}`,
            lat: activity.lat as number,
            lon: activity.lon as number,
            title: activity.title,
            description: `${activity.schedule} - ${activity.memberCount}/${activity.capacity} members`,
            pinColor: "#F97316",
          })),
      ]),
    [activities, nearby],
  );

  const renderMap = () => (
    <MapView
      ref={mapRef}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      showsUserLocation
      showsMyLocationButton
      zoomControlEnabled
      scrollEnabled
      zoomEnabled
      rotateEnabled
      pitchEnabled
    >
      <Marker
        coordinate={{ latitude: center.lat, longitude: center.lon }}
        title="You"
        description="Your location"
        pinColor="#2563EB"
      />
      {markerPoints.map((point) => (
        <Marker
          key={point.id}
          coordinate={{ latitude: point.lat, longitude: point.lon }}
          title={point.title}
          description={point.description}
          pinColor={point.pinColor}
        />
      ))}
    </MapView>
  );

  return (
    <>
      <View style={styles.map}>
        {renderMap()}
        <Pressable style={styles.fullscreenButton} onPress={() => setFullscreen(true)}>
          <Text style={styles.buttonText}>Fullscreen</Text>
        </Pressable>
      </View>
      <Modal visible={fullscreen} animationType="slide" onRequestClose={() => setFullscreen(false)}>
        <View style={styles.fullscreenMap}>
          {renderMap()}
          <Pressable style={styles.closeButton} onPress={() => setFullscreen(false)}>
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  map: {
    height: 260,
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#D4E4F7",
  },
  fullscreenMap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullscreenButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: colors.navy,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  closeButton: {
    position: "absolute",
    top: 48,
    right: 16,
    backgroundColor: colors.navy,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  });
}
