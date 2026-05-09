/**
 * FindMe Friends — HW2 prototype API (stub).
 * Runs on your machine (or any Linux host / PaaS) as a plain Node.js HTTP server.
 */
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

/** In-memory stand-in for SQL tables (users, last known location). */
const users = new Map();

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "findme-api-stub" });
});

/**
 * Stub registration — real app would hash passwords and store ID verification state.
 * Body: { userId, displayName?, email? }
 */
app.post("/api/register", (req, res) => {
  const { userId, displayName, email } = req.body || {};
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId required" });
  }
  users.set(userId, {
    userId,
    displayName: displayName ?? userId,
    email: email ?? null,
    lat: null,
    lon: null,
    bio: "",
    isPublic: true,
    updatedAt: null,
  });
  res.status(201).json({ ok: true, userId });
});

/**
 * Periodic location ping from the mobile app (PDF: longitude/latitude).
 * Body: { userId, lat, lon }
 */
app.post("/api/location", (req, res) => {
  const { userId, lat, lon } = req.body || {};
  if (!userId || lat == null || lon == null) {
    return res.status(400).json({ error: "userId, lat, lon required" });
  }
  const u = users.get(userId);
  if (!u) {
    return res.status(404).json({ error: "unknown userId; call POST /api/register first" });
  }
  u.lat = Number(lat);
  u.lon = Number(lon);
  u.updatedAt = new Date().toISOString();
  res.json({ ok: true, received: { lat: u.lat, lon: u.lon } });
});

/**
 * Nearby users within radiusKm (default 25). Orange County-ish demo coords work fine.
 * Query: lat, lon, radiusKm?, userId? — when userId is set, that user is omitted from results.
 */
app.get("/api/nearby", (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radiusKm = Number(req.query.radiusKm) || 25;
  const excludeUserId =
    typeof req.query.userId === "string" && req.query.userId.length > 0
      ? req.query.userId
      : null;
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: "lat and lon query params required" });
  }
  const list = [];
  for (const u of users.values()) {
    if (excludeUserId !== null && u.userId === excludeUserId) continue;
    if (u.lat == null || u.lon == null) continue;
    const d = haversineKm(lat, lon, u.lat, u.lon);
    if (d <= radiusKm) {
      list.push({
        userId: u.userId,
        displayName: u.displayName,
        distanceKm: Math.round(d * 10) / 10,
        ...(u.isPublic ? { bio: u.bio } : {}),
      });
    }
  }
  res.json({ count: list.length, nearby: list });
});

/** Profile update stub (PDF: bio, public/private). */
app.patch("/api/profile/:userId", (req, res) => {
  const u = users.get(req.params.userId);
  if (!u) return res.status(404).json({ error: "unknown user" });
  const { bio, isPublic } = req.body || {};
  if (typeof bio === "string") u.bio = bio;
  if (typeof isPublic === "boolean") u.isPublic = isPublic;
  res.json({ ok: true, profile: { userId: u.userId, bio: u.bio, isPublic: u.isPublic } });
});

app.listen(PORT, () => {
  console.log(`FindMe API stub listening on http://localhost:${PORT}`);
});
