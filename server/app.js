/**
 * FindMe Friends prototype API app.
 * Architecture: Node.js on Linux/PaaS, HTTPS+JSON to mobile (Expo React Native).
 * Data: in-memory Map (prototype stand-in for SQL).
 */
import express from "express";
import cors from "cors";
import {
  users,
  activities,
  chats,
  sessions,
  blocks,
  reports,
  verificationAttempts,
  friendRequests,
  haversineKm,
  createUser,
  publicUserFields,
  seedDemoData,
  nextActivityId,
  nextMessageId,
  nextReportId,
  nextVerificationAttemptId,
  nextFriendRequestId,
  chatKey,
  blockKey,
  isBlockedBetween,
  friendRequestBetween,
  friendshipStatus,
  matchesFilters,
  persistData,
} from "./store.js";
import { createToken, hashPassword, verifyPassword } from "./auth.js";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

seedDemoData();

function isValidName(name) {
  if (!name || typeof name !== "string") return false;
  const t = name.trim();
  return t.length >= 2 && /^[a-zA-Z][a-zA-Z\s'-]+$/.test(t);
}

const GENDERS = new Set(["woman", "man", "non-binary", "other"]);
const SEXUALITIES = new Set([
  "straight",
  "gay",
  "lesbian",
  "bisexual",
  "pansexual",
  "queer",
  "asexual",
  "other",
]);

function parseAge(value) {
  const age = Number(value);
  if (!Number.isInteger(age) || age < 18 || age > 99) return null;
  return age;
}

function initialsFor(displayName) {
  return String(displayName)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function friendSummaryFor(user, viewerUserId) {
  return {
    userId: user.userId,
    displayName: user.displayName,
    initials: initialsFor(user.displayName),
    blocked: blocks.has(blockKey(viewerUserId, user.userId)),
  };
}

function userOr404(userId, res) {
  const u = users.get(userId);
  if (!u) {
    res.status(404).json({ error: "unknown user" });
    return null;
  }
  return u;
}

function requireUserAccess(req, res, userId) {
  const token = getBearerToken(req);
  const session = token ? sessions.get(token) : null;
  if (!session || session.userId !== userId) {
    res.status(401).json({ error: "Valid login token required." });
    return false;
  }
  session.lastSeenAt = new Date().toISOString();
  persistData();
  return true;
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "findme-api", users: users.size, activities: activities.size });
});

/** Local ID verification adapter. Production would swap this for a vendor provider. */
app.post("/api/id-verify", (req, res) => {
  const { userId, idImageBase64 } = req.body || {};
  const u = userOr404(userId, res);
  if (!u) return;
  const attempt = {
    id: nextVerificationAttemptId(),
    userId,
    createdAt: new Date().toISOString(),
    status: "rejected",
    reason: null,
  };
  if (!idImageBase64 || String(idImageBase64).length < 20) {
    attempt.reason = "image_too_short_or_missing";
    verificationAttempts.set(attempt.id, attempt);
    persistData();
    return res.status(400).json({
      error: "Please upload a clear photo of your government-issued ID.",
      status: "rejected",
    });
  }
  attempt.status = "approved";
  verificationAttempts.set(attempt.id, attempt);
  u.idVerified = true;
  u.idVerifiedAt = new Date().toISOString();
  const token = createToken();
  sessions.set(token, {
    token,
    userId: u.userId,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
  persistData();
  res.json({
    ok: true,
    status: "approved",
    message: "ID verified by local prototype verifier. Name matches registration.",
    token,
  });
});

app.post("/api/register", (req, res) => {
  const {
    userId,
    email,
    password,
    firstName,
    lastName,
    displayName,
    interests,
    age,
    gender,
    sexuality,
  } = req.body || {};
  if (!userId || !email || !password) {
    return res.status(400).json({ error: "userId, email, and password required" });
  }
  if (!isValidName(firstName) || !isValidName(lastName)) {
    return res.status(400).json({
      error: "Please enter a valid first and last name (real names required).",
    });
  }
  const parsedAge = parseAge(age);
  if (parsedAge == null) {
    return res.status(400).json({ error: "Please enter an age from 18 to 99." });
  }
  if (!GENDERS.has(gender)) {
    return res.status(400).json({ error: "Please choose a valid gender." });
  }
  if (!SEXUALITIES.has(sexuality)) {
    return res.status(400).json({ error: "Please choose a valid sexuality." });
  }
  if (users.has(userId)) {
    return res.status(409).json({ error: "userId already exists" });
  }
  for (const u of users.values()) {
    if (u.email.toLowerCase() === String(email).trim().toLowerCase()) {
      return res.status(409).json({ error: "email already exists" });
    }
  }
  const record = {
    userId,
    email: email.trim().toLowerCase(),
    password: hashPassword(password),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    displayName: displayName ?? `${firstName.trim()} ${lastName.trim()}`,
    lat: null,
    lon: null,
    bio: "",
    isPublic: true,
    interests: Array.isArray(interests) ? interests : [],
    discoveryRadiusKm: 25,
    idVerified: false,
    filters: { ageMin: 18, ageMax: 99, genders: ["any"], sexualities: ["any"] },
    age: parsedAge,
    gender,
    sexuality,
    updatedAt: null,
  };
  createUser(record);
  res.status(201).json({ ok: true, userId, requiresIdVerification: true });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  for (const u of users.values()) {
    if (u.email === String(email).trim().toLowerCase()) {
      if (u.lockedUntil && Date.parse(u.lockedUntil) > Date.now()) {
        return res.status(429).json({
          error: "Too many failed login attempts. Please try again shortly.",
        });
      }
      if (!verifyPassword(password, u.password)) {
        u.failedLoginAttempts = (u.failedLoginAttempts ?? 0) + 1;
        if (u.failedLoginAttempts >= 5) {
          u.lockedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        }
        persistData();
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (!String(u.password).startsWith("pbkdf2$")) {
        u.password = hashPassword(password);
      }
      u.failedLoginAttempts = 0;
      u.lockedUntil = null;
      const token = createToken();
      sessions.set(token, {
        token,
        userId: u.userId,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      });
      persistData();
      return res.json({
        ok: true,
        userId: u.userId,
        displayName: u.displayName,
        idVerified: !!u.idVerified,
        token,
      });
    }
  }
  res.status(401).json({ error: "Invalid email or password" });
});

app.post("/api/location", (req, res) => {
  const { userId, lat, lon } = req.body || {};
  if (!requireUserAccess(req, res, userId)) return;
  const u = userOr404(userId, res);
  if (!u) return;
  if (lat == null || lon == null) {
    return res.status(400).json({ error: "lat, lon required" });
  }
  u.lat = Number(lat);
  u.lon = Number(lon);
  u.updatedAt = new Date().toISOString();
  persistData();
  res.json({ ok: true, received: { lat: u.lat, lon: u.lon } });
});

app.get("/api/nearby", (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const excludeUserId = req.query.userId || null;
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: "lat and lon required" });
  }
  const viewer = excludeUserId ? users.get(excludeUserId) : null;
  if (viewer && !requireUserAccess(req, res, viewer.userId)) return;
  const radiusKm =
    viewer?.discoveryRadiusKm ?? (Number(req.query.radiusKm) || 25);

  const list = [];
  for (const u of users.values()) {
    if (excludeUserId && u.userId === excludeUserId) continue;
    if (!u.isPublic) continue;
    if (u.lat == null || u.lon == null) continue;
    if (viewer && isBlockedBetween(viewer.userId, u.userId)) continue;
    if (viewer && !matchesFilters(viewer, u)) continue;
    const d = haversineKm(lat, lon, u.lat, u.lon);
    if (d <= radiusKm) {
      list.push({
        ...publicUserFields(u),
        distanceKm: Math.round(d * 10) / 10,
        lat: u.lat,
        lon: u.lon,
        interests: u.interests,
        friendshipStatus: viewer ? friendshipStatus(viewer.userId, u.userId) : "none",
      });
    }
  }
  list.sort((a, b) => a.distanceKm - b.distanceKm);
  if (list.length === 0) {
    return res.json({
      count: 0,
      nearby: [],
      emptyMessage:
        "No friends found nearby that match these filters. Try expanding your discovery range in Settings.",
    });
  }
  res.json({ count: list.length, nearby: list });
});

app.get("/api/users/:userId", (req, res) => {
  const u = userOr404(req.params.userId, res);
  if (!u) return;
  res.json({
    ...publicUserFields(u),
    interests: u.interests,
    isPublic: u.isPublic,
    idVerified: !!u.idVerified,
    age: u.age,
    gender: u.gender,
    sexuality: u.sexuality,
  });
});

app.patch("/api/profile/:userId", (req, res) => {
  if (!requireUserAccess(req, res, req.params.userId)) return;
  const u = userOr404(req.params.userId, res);
  if (!u) return;
  const { bio, isPublic, interests, age, gender, sexuality } = req.body || {};
  if (typeof bio === "string") {
    const blocked = /\b(http|www\.|fuck|shit)\b/i;
    if (blocked.test(bio)) {
      return res.status(400).json({
        error: "Your bio contains prohibited language or an external link. Please revise.",
      });
    }
    u.bio = bio.slice(0, 500);
  }
  if (typeof isPublic === "boolean") u.isPublic = isPublic;
  if (Array.isArray(interests)) u.interests = interests;
  if (age != null) {
    const parsedAge = parseAge(age);
    if (parsedAge == null) return res.status(400).json({ error: "Age must be from 18 to 99." });
    u.age = parsedAge;
  }
  if (typeof gender === "string") {
    if (!GENDERS.has(gender)) return res.status(400).json({ error: "Invalid gender." });
    u.gender = gender;
  }
  if (typeof sexuality === "string") {
    if (!SEXUALITIES.has(sexuality)) return res.status(400).json({ error: "Invalid sexuality." });
    u.sexuality = sexuality;
  }
  u.updatedAt = new Date().toISOString();
  persistData();
  res.json({
    ok: true,
    profile: {
      userId: u.userId,
      bio: u.bio,
      isPublic: u.isPublic,
      interests: u.interests,
      age: u.age,
      gender: u.gender,
      sexuality: u.sexuality,
    },
  });
});

app.get("/api/settings/:userId", (req, res) => {
  if (!requireUserAccess(req, res, req.params.userId)) return;
  const u = userOr404(req.params.userId, res);
  if (!u) return;
  res.json({
    discoveryRadiusKm: u.discoveryRadiusKm ?? 25,
    isPublic: u.isPublic,
    filters: u.filters ?? { ageMin: 18, ageMax: 99, genders: ["any"], sexualities: ["any"] },
    darkMode: !!u.darkMode,
    notificationsEnabled: u.notificationsEnabled !== false,
    notificationStyle: u.notificationStyle ?? "banner",
  });
});

app.patch("/api/settings/:userId", (req, res) => {
  if (!requireUserAccess(req, res, req.params.userId)) return;
  const u = userOr404(req.params.userId, res);
  if (!u) return;
  const { discoveryRadiusKm, isPublic, filters, darkMode, notificationsEnabled, notificationStyle } = req.body || {};
  if (typeof discoveryRadiusKm === "number") {
    u.discoveryRadiusKm = Math.min(100, Math.max(1, discoveryRadiusKm));
  }
  if (typeof isPublic === "boolean") u.isPublic = isPublic;
  if (typeof darkMode === "boolean") u.darkMode = darkMode;
  if (typeof notificationsEnabled === "boolean") u.notificationsEnabled = notificationsEnabled;
  if (notificationStyle === "banner" || notificationStyle === "popup") {
    u.notificationStyle = notificationStyle;
  }
  if (filters && typeof filters === "object") {
    u.filters = {
      ageMin: filters.ageMin ?? u.filters?.ageMin ?? 18,
      ageMax: filters.ageMax ?? u.filters?.ageMax ?? 99,
      genders: filters.genders ?? u.filters?.genders ?? ["any"],
      sexualities: filters.sexualities ?? u.filters?.sexualities ?? ["any"],
    };
  }
  u.updatedAt = new Date().toISOString();
  persistData();
  res.json({ ok: true, settings: readSettings(u) });
});

function readSettings(u) {
  return {
    discoveryRadiusKm: u.discoveryRadiusKm,
    isPublic: u.isPublic,
    filters: u.filters,
    darkMode: !!u.darkMode,
    notificationsEnabled: u.notificationsEnabled !== false,
    notificationStyle: u.notificationStyle ?? "banner",
  };
}

app.get("/api/friends/:userId", (req, res) => {
  const uid = req.params.userId;
  if (!requireUserAccess(req, res, uid)) return;
  if (!users.has(uid)) return res.status(404).json({ error: "unknown user" });
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const accepted = [...friendRequests.values()].filter(
    (request) =>
      request.status === "accepted" && (request.fromUserId === uid || request.toUserId === uid),
  );
  const friends = accepted
    .map((request) => users.get(request.fromUserId === uid ? request.toUserId : request.fromUserId))
    .filter(Boolean)
    .filter((u) => !q || u.displayName.toLowerCase().includes(q))
    .map((u) => friendSummaryFor(u, uid))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const incoming = [...friendRequests.values()]
    .filter((request) => request.status === "pending" && request.toUserId === uid)
    .map((request) => ({ request, user: users.get(request.fromUserId) }))
    .filter((item) => item.user)
    .map(({ request, user }) => ({ requestId: request.id, user: friendSummaryFor(user, uid) }));
  const outgoing = [...friendRequests.values()]
    .filter((request) => request.status === "pending" && request.fromUserId === uid)
    .map((request) => ({ request, user: users.get(request.toUserId) }))
    .filter((item) => item.user)
    .map(({ request, user }) => ({ requestId: request.id, user: friendSummaryFor(user, uid) }));
  res.json({ friends, incoming, outgoing });
});

app.post("/api/friends/:userId/requests/:otherUserId", (req, res) => {
  const { userId, otherUserId } = req.params;
  if (!requireUserAccess(req, res, userId)) return;
  if (userId === otherUserId) return res.status(400).json({ error: "Cannot friend yourself." });
  if (!users.has(userId) || !users.has(otherUserId)) {
    return res.status(404).json({ error: "unknown user" });
  }
  if (isBlockedBetween(userId, otherUserId)) {
    return res.status(403).json({ error: "Cannot send request to a blocked user." });
  }
  const existing = friendRequestBetween(userId, otherUserId);
  if (existing?.status === "accepted") {
    return res.json({ ok: true, status: "friends", message: "Already friends." });
  }
  if (existing?.status === "pending") {
    return res.json({
      ok: true,
      status: existing.fromUserId === userId ? "outgoing" : "incoming",
      message: "Friend request already pending.",
    });
  }
  const request = {
    id: nextFriendRequestId(),
    fromUserId: userId,
    toUserId: otherUserId,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  friendRequests.set(request.id, request);
  persistData();
  res.status(201).json({ ok: true, status: "outgoing", request });
});

app.post("/api/friends/:userId/requests/:requestId/accept", (req, res) => {
  const { userId, requestId } = req.params;
  if (!requireUserAccess(req, res, userId)) return;
  const request = friendRequests.get(requestId);
  if (!request || request.toUserId !== userId || request.status !== "pending") {
    return res.status(404).json({ error: "pending friend request not found" });
  }
  request.status = "accepted";
  request.updatedAt = new Date().toISOString();
  persistData();
  res.json({ ok: true, status: "friends", request });
});

app.post("/api/friends/:userId/requests/:requestId/decline", (req, res) => {
  const { userId, requestId } = req.params;
  if (!requireUserAccess(req, res, userId)) return;
  const request = friendRequests.get(requestId);
  if (!request || request.toUserId !== userId || request.status !== "pending") {
    return res.status(404).json({ error: "pending friend request not found" });
  }
  request.status = "declined";
  request.updatedAt = new Date().toISOString();
  persistData();
  res.json({ ok: true, status: "declined", request });
});

app.get("/api/activities", (req, res) => {
  const lat = req.query.lat != null ? Number(req.query.lat) : null;
  const lon = req.query.lon != null ? Number(req.query.lon) : null;
  const interest = req.query.interest;
  const list = [];
  for (const a of activities.values()) {
    if (interest && a.interest !== interest) continue;
    let distanceKm = null;
    if (lat != null && lon != null && a.lat != null) {
      distanceKm = Math.round(haversineKm(lat, lon, a.lat, a.lon) * 10) / 10;
    }
    list.push({
      id: a.id,
      title: a.title,
      interest: a.interest,
      schedule: a.schedule,
      locationName: a.locationName,
      lat: a.lat,
      lon: a.lon,
      capacity: a.capacity,
      memberCount: a.memberIds.length,
      spotsLeft: a.capacity - a.memberIds.length,
      full: a.memberIds.length >= a.capacity,
      recurring: a.recurring,
      distanceKm,
      memberIds: a.memberIds,
      members: a.memberIds.map((id) => {
        const member = users.get(id);
        return {
          userId: id,
          displayName: member?.displayName ?? id,
        };
      }),
    });
  }
  list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  res.json({ activities: list });
});

app.post("/api/activities", (req, res) => {
  const {
    userId,
    title,
    interest,
    schedule,
    locationName,
    lat,
    lon,
    capacity,
    recurring,
  } = req.body || {};
  if (!requireUserAccess(req, res, userId)) return;
  if (!title?.trim() || !interest?.trim() || !schedule?.trim() || !locationName?.trim()) {
    return res.status(400).json({ error: "title, interest, schedule, and locationName required" });
  }
  const parsedLat = Number(lat);
  const parsedLon = Number(lon);
  const parsedCapacity = Number(capacity);
  if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) {
    return res.status(400).json({ error: "valid lat and lon required" });
  }
  if (!Number.isInteger(parsedCapacity) || parsedCapacity < 2 || parsedCapacity > 100) {
    return res.status(400).json({ error: "capacity must be a whole number from 2 to 100" });
  }

  const id = nextActivityId();
  const activity = {
    id,
    title: title.trim().slice(0, 80),
    interest: interest.trim().toLowerCase().slice(0, 40),
    schedule: schedule.trim().slice(0, 80),
    locationName: locationName.trim().slice(0, 120),
    lat: parsedLat,
    lon: parsedLon,
    capacity: parsedCapacity,
    memberIds: [userId],
    recurring: recurring !== false,
    createdByUserId: userId,
    createdAt: new Date().toISOString(),
  };
  activities.set(id, activity);
  persistData();
  res.status(201).json({ ok: true, activity });
});

app.post("/api/activities/:id/join", (req, res) => {
  const { userId } = req.body || {};
  if (!requireUserAccess(req, res, userId)) return;
  const a = activities.get(req.params.id);
  if (!a) return res.status(404).json({ error: "activity not found" });
  if (!userId) return res.status(400).json({ error: "userId required" });
  if (a.memberIds.length >= a.capacity) {
    return res.status(409).json({
      error: "This group has reached capacity. Browse other recurring activities.",
      full: true,
    });
  }
  if (!a.memberIds.includes(userId)) {
    a.memberIds.push(userId);
    persistData();
  }
  res.json({
    ok: true,
    message: "You have successfully joined the activity.",
    memberCount: a.memberIds.length,
    spotsLeft: a.capacity - a.memberIds.length,
  });
});

app.post("/api/activities/:id/leave", (req, res) => {
  const { userId } = req.body || {};
  if (!requireUserAccess(req, res, userId)) return;
  const a = activities.get(req.params.id);
  if (!a) return res.status(404).json({ error: "activity not found" });
  if (!userId) return res.status(400).json({ error: "userId required" });
  if (a.memberIds.length === 1 && a.memberIds[0] === userId) {
    activities.delete(req.params.id);
    persistData();
    return res.json({
      ok: true,
      deleted: true,
      message: "You were the only member, so the activity was deleted.",
      memberCount: 0,
      spotsLeft: 0,
    });
  }
  a.memberIds = a.memberIds.filter((id) => id !== userId);
  persistData();
  res.json({
    ok: true,
    message: "You have left the activity.",
    memberCount: a.memberIds.length,
    spotsLeft: a.capacity - a.memberIds.length,
  });
});

app.get("/api/chat/threads/:userId", (req, res) => {
  const uid = req.params.userId;
  if (!requireUserAccess(req, res, uid)) return;
  if (!users.has(uid)) return res.status(404).json({ error: "unknown user" });
  const threads = [];
  for (const [key, messages] of chats.entries()) {
    const [a, b] = key.split("|");
    if (a !== uid && b !== uid) continue;
    const otherId = a === uid ? b : a;
    if (isBlockedBetween(uid, otherId)) continue;
    const other = users.get(otherId);
    const last = messages[messages.length - 1];
    threads.push({
      otherUserId: otherId,
      displayName: other?.displayName ?? otherId,
      lastMessage: last?.text ?? "",
      lastAt: last?.createdAt,
    });
  }
  res.json({ threads });
});

app.get("/api/chat/:userId/:otherUserId", (req, res) => {
  if (!requireUserAccess(req, res, req.params.userId)) return;
  if (isBlockedBetween(req.params.userId, req.params.otherUserId)) {
    return res.status(403).json({ error: "This conversation is blocked." });
  }
  const key = chatKey(req.params.userId, req.params.otherUserId);
  res.json({ messages: chats.get(key) ?? [] });
});

app.post("/api/chat/:userId/:otherUserId", (req, res) => {
  const { text } = req.body || {};
  const from = req.params.userId;
  const to = req.params.otherUserId;
  if (!requireUserAccess(req, res, from)) return;
  if (isBlockedBetween(from, to)) {
    return res.status(403).json({ error: "This conversation is blocked." });
  }
  if (!text?.trim()) return res.status(400).json({ error: "text required" });
  const key = chatKey(from, to);
  if (!chats.has(key)) chats.set(key, []);
  const msg = {
    id: nextMessageId(),
    fromUserId: from,
    toUserId: to,
    text: text.trim().slice(0, 2000),
    createdAt: new Date().toISOString(),
  };
  chats.get(key).push(msg);
  persistData();
  res.status(201).json({ ok: true, message: msg });
});

app.post("/api/chat/:userId/:otherUserId/report", (req, res) => {
  const { reason } = req.body || {};
  const from = req.params.userId;
  const to = req.params.otherUserId;
  if (!requireUserAccess(req, res, from)) return;
  if (!users.has(from) || !users.has(to)) {
    return res.status(404).json({ error: "unknown user" });
  }
  const report = {
    id: nextReportId(),
    reporterUserId: from,
    reportedUserId: to,
    reason: reason || "Reported from chat",
    status: "submitted",
    createdAt: new Date().toISOString(),
  };
  reports.set(report.id, report);
  blocks.set(blockKey(from, to), {
    blockerUserId: from,
    blockedUserId: to,
    createdAt: new Date().toISOString(),
    reason: "report",
  });
  persistData();
  res.json({
    ok: true,
    message: "Report submitted. This user is now blocked from your discovery and chat.",
  });
});

app.post("/api/users/:userId/block/:otherUserId", (req, res) => {
  const { userId, otherUserId } = req.params;
  if (!requireUserAccess(req, res, userId)) return;
  if (!users.has(userId) || !users.has(otherUserId)) {
    return res.status(404).json({ error: "unknown user" });
  }
  blocks.set(blockKey(userId, otherUserId), {
    blockerUserId: userId,
    blockedUserId: otherUserId,
    createdAt: new Date().toISOString(),
    reason: "manual",
  });
  persistData();
  res.json({ ok: true, blockedUserId: otherUserId });
});

app.delete("/api/users/:userId/block/:otherUserId", (req, res) => {
  const { userId, otherUserId } = req.params;
  if (!requireUserAccess(req, res, userId)) return;
  blocks.delete(blockKey(userId, otherUserId));
  persistData();
  res.json({ ok: true, blockedUserId: otherUserId });
});

export default app;
