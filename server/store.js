/**
 * Local JSON-backed prototype data store.
 * Production direction: replace this module with PostgreSQL repositories.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword } from "./auth.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(serverDir, "data");
const dataFile = process.env.FINDME_DATA_FILE || path.join(dataDir, "findme-data.json");

export const users = new Map();
export const activities = new Map();
export const chats = new Map();
export const sessions = new Map();
export const blocks = new Map();
export const reports = new Map();
export const verificationAttempts = new Map();
export const friendRequests = new Map();

let activityIdSeq = 1;
let messageIdSeq = 1;
let reportIdSeq = 1;
let verificationAttemptIdSeq = 1;
let friendRequestIdSeq = 1;

loadData();

export function persistData() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(
    dataFile,
    JSON.stringify(
      {
        meta: {
          activityIdSeq,
          messageIdSeq,
        reportIdSeq,
        verificationAttemptIdSeq,
        friendRequestIdSeq,
        savedAt: new Date().toISOString(),
        },
        users: [...users.values()],
        activities: [...activities.values()],
        chats: Object.fromEntries(chats),
        sessions: [...sessions.values()],
        blocks: [...blocks.values()],
        reports: [...reports.values()],
        verificationAttempts: [...verificationAttempts.values()],
        friendRequests: [...friendRequests.values()],
      },
      null,
      2,
    ),
  );
}

export function loadData() {
  if (!fs.existsSync(dataFile)) return;
  const raw = JSON.parse(fs.readFileSync(dataFile, "utf8"));

  users.clear();
  activities.clear();
  chats.clear();
  sessions.clear();
  blocks.clear();
  reports.clear();
  verificationAttempts.clear();
  friendRequests.clear();

  for (const user of raw.users ?? []) users.set(user.userId, normalizeUser(user));
  for (const activity of raw.activities ?? []) activities.set(activity.id, activity);
  for (const [key, messages] of Object.entries(raw.chats ?? {})) chats.set(key, messages);
  for (const session of raw.sessions ?? []) sessions.set(session.token, session);
  for (const block of raw.blocks ?? []) blocks.set(blockKey(block.blockerUserId, block.blockedUserId), block);
  for (const report of raw.reports ?? []) reports.set(report.id, report);
  for (const attempt of raw.verificationAttempts ?? []) verificationAttempts.set(attempt.id, attempt);
  for (const request of raw.friendRequests ?? []) friendRequests.set(request.id, request);

  activityIdSeq = raw.meta?.activityIdSeq ?? nextSeqFromIds(activities.keys(), "act-");
  messageIdSeq = raw.meta?.messageIdSeq ?? nextSeqFromChatMessages();
  reportIdSeq = raw.meta?.reportIdSeq ?? nextSeqFromIds(reports.keys(), "report-");
  verificationAttemptIdSeq =
    raw.meta?.verificationAttemptIdSeq ?? nextSeqFromIds(verificationAttempts.keys(), "verify-");
  friendRequestIdSeq = raw.meta?.friendRequestIdSeq ?? nextSeqFromIds(friendRequests.keys(), "friend-");
  ensureDemoFriendship();
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function createUser(record) {
  users.set(record.userId, normalizeUser(record));
  persistData();
  return users.get(record.userId);
}

export function publicUserFields(u) {
  return {
    userId: u.userId,
    displayName: u.displayName,
    bio: u.bio,
    interests: u.interests ?? [],
  };
}

export function seedDemoData() {
  if (users.size > 0) return;

  const demoUsers = [
    {
      userId: "seed-alice",
      displayName: "Alice Chen",
      firstName: "Alice",
      lastName: "Chen",
      email: "alice@example.edu",
      password: hashPassword("demo123"),
      lat: 33.6846,
      lon: -117.8265,
      bio: "UCI student - hiking & coffee",
      isPublic: true,
      interests: ["hiking", "study"],
      discoveryRadiusKm: 25,
      idVerified: true,
      filters: { ageMin: 18, ageMax: 35, genders: ["any"] },
      darkMode: false,
      notificationsEnabled: true,
      notificationStyle: "banner",
      age: 22,
      gender: "woman",
      sexuality: "straight",
    },
    {
      userId: "seed-bob",
      displayName: "Bob Martinez",
      firstName: "Bob",
      lastName: "Martinez",
      email: "bob@example.edu",
      password: hashPassword("demo123"),
      lat: 33.69,
      lon: -117.82,
      bio: "Weekend skier - new to OC",
      isPublic: true,
      interests: ["skiing", "hiking"],
      discoveryRadiusKm: 30,
      idVerified: true,
      filters: { ageMin: 20, ageMax: 40, genders: ["any"] },
      darkMode: false,
      notificationsEnabled: true,
      notificationStyle: "banner",
      age: 28,
      gender: "man",
      sexuality: "straight",
    },
    {
      userId: "seed-casey",
      displayName: "Casey Lee",
      firstName: "Casey",
      lastName: "Lee",
      email: "casey@example.edu",
      password: hashPassword("demo123"),
      lat: 33.75,
      lon: -117.87,
      bio: "Private profile - connect via activities",
      isPublic: false,
      interests: ["language"],
      discoveryRadiusKm: 15,
      idVerified: true,
      filters: { ageMin: 18, ageMax: 50, genders: ["any"] },
      darkMode: false,
      notificationsEnabled: false,
      notificationStyle: "popup",
      age: 24,
      gender: "non-binary",
      sexuality: "queer",
    },
  ];

  for (const u of demoUsers) {
    users.set(u.userId, {
      ...u,
      failedLoginAttempts: 0,
      updatedAt: new Date().toISOString(),
    });
  }

  const demoActivities = [
    {
      title: "Sunday Irvine Hiking Group",
      interest: "hiking",
      schedule: "Every Sunday 8:00 AM",
      locationName: "Bommer Canyon Trailhead",
      lat: 33.63,
      lon: -117.79,
      capacity: 12,
      memberIds: ["seed-alice"],
      recurring: true,
    },
    {
      title: "UCI Study Session (INF43)",
      interest: "study",
      schedule: "Wednesdays 4:00 PM",
      locationName: "UCI Science Library",
      lat: 33.64,
      lon: -117.84,
      capacity: 8,
      memberIds: [],
      recurring: true,
    },
    {
      title: "Beach Volleyball Pickup",
      interest: "sports",
      schedule: "Saturdays 10:00 AM",
      locationName: "Huntington Beach Pier",
      lat: 33.655,
      lon: -117.999,
      capacity: 10,
      memberIds: ["seed-bob"],
      recurring: true,
    },
  ];

  for (const a of demoActivities) {
    const id = `act-${activityIdSeq++}`;
    activities.set(id, { id, ...a });
  }

  chats.set("seed-alice|seed-bob", [
    {
      id: `msg-${messageIdSeq++}`,
      fromUserId: "seed-alice",
      toUserId: "seed-bob",
      text: "Want to join the hiking group this Sunday?",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ]);

  ensureDemoFriendship();

  persistData();
}

function ensureDemoFriendship() {
  if (!users.has("seed-alice") || !users.has("seed-bob")) return;
  const existing = friendRequestBetween("seed-alice", "seed-bob");
  if (existing?.status === "accepted") return;
  const id = nextFriendRequestId();
  friendRequests.set(id, {
    id,
    fromUserId: "seed-alice",
    toUserId: "seed-bob",
    status: "accepted",
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 90 * 60000).toISOString(),
  });
}

export function nextActivityId() {
  return `act-${activityIdSeq++}`;
}

export function nextMessageId() {
  return `msg-${messageIdSeq++}`;
}

export function nextReportId() {
  return `report-${reportIdSeq++}`;
}

export function nextVerificationAttemptId() {
  return `verify-${verificationAttemptIdSeq++}`;
}

export function nextFriendRequestId() {
  return `friend-${friendRequestIdSeq++}`;
}

export function chatKey(a, b) {
  return [a, b].sort().join("|");
}

export function blockKey(blockerUserId, blockedUserId) {
  return `${blockerUserId}|${blockedUserId}`;
}

export function isBlockedBetween(a, b) {
  return blocks.has(blockKey(a, b)) || blocks.has(blockKey(b, a));
}

export function friendRequestBetween(a, b) {
  for (const request of friendRequests.values()) {
    if (
      (request.fromUserId === a && request.toUserId === b) ||
      (request.fromUserId === b && request.toUserId === a)
    ) {
      return request;
    }
  }
  return null;
}

export function friendshipStatus(a, b) {
  const request = friendRequestBetween(a, b);
  if (!request) return "none";
  if (request.status === "accepted") return "friends";
  if (request.status === "pending") {
    return request.fromUserId === a ? "outgoing" : "incoming";
  }
  return "none";
}

export function matchesFilters(viewer, candidate) {
  const f = viewer.filters ?? {};
  const ageMin = f.ageMin ?? 0;
  const ageMax = f.ageMax ?? 120;
  if (candidate.age != null && (candidate.age < ageMin || candidate.age > ageMax)) {
    return false;
  }
  const genders = f.genders ?? ["any"];
  if (!genders.includes("any") && !genders.includes(candidate.gender)) {
    return false;
  }
  const sexualities = f.sexualities ?? ["any"];
  if (!sexualities.includes("any") && !sexualities.includes(candidate.sexuality)) {
    return false;
  }
  return true;
}

function normalizeUser(user) {
  return {
    bio: "",
    isPublic: true,
    interests: [],
    discoveryRadiusKm: 25,
    idVerified: false,
    filters: { ageMin: 18, ageMax: 99, genders: ["any"], sexualities: ["any"] },
    darkMode: false,
    notificationsEnabled: true,
    notificationStyle: "banner",
    age: null,
    gender: null,
    sexuality: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    updatedAt: null,
    ...user,
    filters: {
      ageMin: user.filters?.ageMin ?? 18,
      ageMax: user.filters?.ageMax ?? 99,
      genders: user.filters?.genders ?? ["any"],
      sexualities: user.filters?.sexualities ?? ["any"],
    },
  };
}

function nextSeqFromIds(ids, prefix) {
  let max = 0;
  for (const id of ids) {
    if (String(id).startsWith(prefix)) {
      max = Math.max(max, Number(String(id).slice(prefix.length)) || 0);
    }
  }
  return max + 1;
}

function nextSeqFromChatMessages() {
  let max = 0;
  for (const messages of chats.values()) {
    for (const message of messages) {
      if (String(message.id).startsWith("msg-")) {
        max = Math.max(max, Number(String(message.id).slice(4)) || 0);
      }
    }
  }
  return max + 1;
}
