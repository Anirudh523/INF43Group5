import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";

process.env.FINDME_DATA_FILE = path.join(
  mkdtempSync(path.join(os.tmpdir(), "findme-api-test-")),
  "data.json",
);

const store = await import("../store.js");
const { app } = await import("../app.js");

const {
  activities,
  blocks,
  chats,
  reports,
  friendRequests,
  seedDemoData,
  sessions,
  users,
  verificationAttempts,
} = store;

let baseUrl;
let server;

function resetStore() {
  users.clear();
  activities.clear();
  chats.clear();
  sessions.clear();
  blocks.clear();
  reports.clear();
  friendRequests.clear();
  verificationAttempts.clear();
  seedDemoData();
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function login(email = "alice@example.edu", password = "demo123") {
  const { response, body } = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return body;
}

before(async () => {
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(resetStore);

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("API integration tests", () => {
  test("health endpoint reports freshly seeded prototype data", async () => {
    const { response, body } = await request("/health");

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, "findme-api");
    assert.equal(body.users, 3);
    assert.equal(body.activities, 3);
  });

  test("registration rejects duplicate user IDs and duplicate emails", async () => {
    const created = await request("/api/register", {
      method: "POST",
      body: JSON.stringify({
        userId: "new-user",
        email: "new@example.edu",
        password: "demo123",
        firstName: "New",
        lastName: "User",
        age: 21,
        gender: "woman",
        sexuality: "bisexual",
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.requiresIdVerification, true);

    const duplicateId = await request("/api/register", {
      method: "POST",
      body: JSON.stringify({
        userId: "new-user",
        email: "other@example.edu",
        password: "demo123",
        firstName: "Other",
        lastName: "User",
        age: 22,
        gender: "man",
        sexuality: "straight",
      }),
    });
    assert.equal(duplicateId.response.status, 409);
    assert.match(duplicateId.body.error, /userId/i);

    const duplicateEmail = await request("/api/register", {
      method: "POST",
      body: JSON.stringify({
        userId: "other-user",
        email: "new@example.edu",
        password: "demo123",
        firstName: "Other",
        lastName: "User",
        age: 22,
        gender: "man",
        sexuality: "straight",
      }),
    });
    assert.equal(duplicateEmail.response.status, 409);
    assert.match(duplicateEmail.body.error, /email/i);
  });

  test("registration requires usable demographics for discovery filters", async () => {
    const missingAge = await request("/api/register", {
      method: "POST",
      body: JSON.stringify({
        userId: "missing-age",
        email: "missing-age@example.edu",
        password: "demo123",
        firstName: "Missing",
        lastName: "Age",
        gender: "woman",
        sexuality: "queer",
      }),
    });
    assert.equal(missingAge.response.status, 400);
    assert.match(missingAge.body.error, /age/i);

    const invalidGender = await request("/api/register", {
      method: "POST",
      body: JSON.stringify({
        userId: "bad-gender",
        email: "bad-gender@example.edu",
        password: "demo123",
        firstName: "Bad",
        lastName: "Gender",
        age: 21,
        gender: "invalid",
        sexuality: "queer",
      }),
    });
    assert.equal(invalidGender.response.status, 400);
    assert.match(invalidGender.body.error, /gender/i);
  });

  test("mock ID verification rejects bad uploads and approves plausible uploads", async () => {
    await request("/api/register", {
      method: "POST",
      body: JSON.stringify({
        userId: "verify-user",
        email: "verify@example.edu",
        password: "demo123",
        firstName: "Verify",
        lastName: "User",
        age: 25,
        gender: "non-binary",
        sexuality: "queer",
      }),
    });

    const rejected = await request("/api/id-verify", {
      method: "POST",
      body: JSON.stringify({ userId: "verify-user", idImageBase64: "too-short" }),
    });
    assert.equal(rejected.response.status, 400);
    assert.match(rejected.body.error, /clear photo/i);

    const approved = await request("/api/id-verify", {
      method: "POST",
      body: JSON.stringify({
        userId: "verify-user",
        idImageBase64: "data:image/jpeg;base64,this-is-a-long-enough-mock-id",
      }),
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.status, "approved");
    assert.ok(approved.body.token);
  });

  test("wrong passwords are rejected and repeated failures lock the account", async () => {
    for (let i = 0; i < 5; i += 1) {
      const failed = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ email: "alice@example.edu", password: "wrong" }),
      });
      assert.equal(failed.response.status, 401);
      assert.match(failed.body.error, /Invalid email or password/);
    }

    const locked = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: "alice@example.edu", password: "demo123" }),
    });
    assert.equal(locked.response.status, 429);
    assert.match(locked.body.error, /Too many failed login attempts/);
  });

  test("protected location update requires a valid login token", async () => {
    const unauthorized = await request("/api/location", {
      method: "POST",
      body: JSON.stringify({ userId: "seed-alice", lat: 33.7, lon: -117.8 }),
    });
    assert.equal(unauthorized.response.status, 401);

    const alice = await login();
    const authorized = await request("/api/location", {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({ userId: "seed-alice", lat: 33.7, lon: -117.8 }),
    });
    assert.equal(authorized.response.status, 200);
    assert.deepEqual(authorized.body.received, { lat: 33.7, lon: -117.8 });
  });

  test("nearby discovery hides private profiles and blocked users", async () => {
    const alice = await login();
    const nearbyBefore = await request(
      "/api/nearby?lat=33.6846&lon=-117.8265&userId=seed-alice",
      { token: alice.token },
    );

    assert.equal(nearbyBefore.response.status, 200);
    assert.deepEqual(
      nearbyBefore.body.nearby.map((user) => user.userId),
      ["seed-bob"],
    );

    const blocked = await request("/api/users/seed-alice/block/seed-bob", {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({}),
    });
    assert.equal(blocked.response.status, 200);

    const nearbyAfter = await request(
      "/api/nearby?lat=33.6846&lon=-117.8265&userId=seed-alice",
      { token: alice.token },
    );
    assert.equal(nearbyAfter.response.status, 200);
    assert.equal(nearbyAfter.body.count, 0);
    assert.match(nearbyAfter.body.emptyMessage, /No friends found nearby/);
  });

  test("profile moderation rejects external links and saves valid profile changes", async () => {
    const alice = await login();
    const rejected = await request("/api/profile/seed-alice", {
      method: "PATCH",
      token: alice.token,
      body: JSON.stringify({ bio: "Find me at http://example.com" }),
    });
    assert.equal(rejected.response.status, 400);
    assert.match(rejected.body.error, /external link/i);

    const saved = await request("/api/profile/seed-alice", {
      method: "PATCH",
      token: alice.token,
      body: JSON.stringify({
        bio: "Coffee and hiking on weekends.",
        isPublic: false,
        interests: ["coffee", "hiking"],
      }),
    });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.profile.bio, "Coffee and hiking on weekends.");
    assert.equal(saved.body.profile.isPublic, false);
    assert.deepEqual(saved.body.profile.interests, ["coffee", "hiking"]);
  });

  test("settings enforce one gender filter choice and save notification preferences", async () => {
    const alice = await login();
    const saved = await request("/api/settings/seed-alice", {
      method: "PATCH",
      token: alice.token,
      body: JSON.stringify({
        discoveryRadiusKm: 250,
        darkMode: true,
        notificationsEnabled: false,
        notificationStyle: "popup",
        filters: { ageMin: 18, ageMax: 28, genders: ["woman"], sexualities: ["bisexual"] },
      }),
    });

    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.settings.discoveryRadiusKm, 100);
    assert.equal(saved.body.settings.darkMode, true);
    assert.equal(saved.body.settings.notificationsEnabled, false);
    assert.equal(saved.body.settings.notificationStyle, "popup");
    assert.deepEqual(saved.body.settings.filters.genders, ["woman"]);
    assert.deepEqual(saved.body.settings.filters.sexualities, ["bisexual"]);
  });

  test("activity creation stores firm coordinates and exposes members/details", async () => {
    const alice = await login();
    const created = await request("/api/activities", {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({
        userId: "seed-alice",
        title: "Coffee Test Meetup",
        interest: "coffee",
        schedule: "Friday 3:00 PM",
        locationName: "UCI Student Center",
        lat: 33.649,
        lon: -117.842,
        capacity: 4,
        recurring: true,
      }),
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.body.activity.lat, 33.649);
    assert.equal(created.body.activity.lon, -117.842);

    const listed = await request("/api/activities?lat=33.6846&lon=-117.8265");
    const found = listed.body.activities.find((activity) => activity.id === created.body.activity.id);
    assert.equal(found.title, "Coffee Test Meetup");
    assert.equal(found.memberCount, 1);
    assert.deepEqual(found.members, [{ userId: "seed-alice", displayName: "Alice Chen" }]);
  });

  test("activity capacity prevents over-joining", async () => {
    const alice = await login();
    const created = await request("/api/activities", {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({
        userId: "seed-alice",
        title: "Tiny Group",
        interest: "study",
        schedule: "Tonight",
        locationName: "Library",
        lat: 33.64,
        lon: -117.84,
        capacity: 2,
        recurring: true,
      }),
    });
    const bob = await login("bob@example.edu");
    const joined = await request(`/api/activities/${created.body.activity.id}/join`, {
      method: "POST",
      token: bob.token,
      body: JSON.stringify({ userId: "seed-bob" }),
    });
    assert.equal(joined.response.status, 200);

    const casey = await login("casey@example.edu");
    const full = await request(`/api/activities/${created.body.activity.id}/join`, {
      method: "POST",
      token: casey.token,
      body: JSON.stringify({ userId: "seed-casey" }),
    });
    assert.equal(full.response.status, 409);
    assert.match(full.body.error, /capacity|reached/i);
  });

  test("leaving as the only activity member deletes the activity", async () => {
    const alice = await login();
    const created = await request("/api/activities", {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({
        userId: "seed-alice",
        title: "Solo Delete Group",
        interest: "drawing",
        schedule: "Tomorrow",
        locationName: "Art Room",
        lat: 33.65,
        lon: -117.84,
        capacity: 3,
        recurring: false,
      }),
    });

    const left = await request(`/api/activities/${created.body.activity.id}/leave`, {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({ userId: "seed-alice" }),
    });
    assert.equal(left.response.status, 200);
    assert.equal(left.body.deleted, true);

    const listed = await request("/api/activities?lat=33.6846&lon=-117.8265");
    assert.equal(
      listed.body.activities.some((activity) => activity.id === created.body.activity.id),
      false,
    );
  });

  test("chat persists messages and report/block prevents further messages", async () => {
    const alice = await login();
    const sent = await request("/api/chat/seed-alice/seed-bob", {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({ text: "See you at the hiking group." }),
    });
    assert.equal(sent.response.status, 201);

    const listed = await request("/api/chat/seed-alice/seed-bob", { token: alice.token });
    assert.equal(listed.response.status, 200);
    assert.ok(listed.body.messages.some((message) => message.text === "See you at the hiking group."));

    const reported = await request("/api/chat/seed-alice/seed-bob/report", {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({ reason: "spam" }),
    });
    assert.equal(reported.response.status, 200);

    const blocked = await request("/api/chat/seed-alice/seed-bob", {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({ text: "Blocked message" }),
    });
    assert.equal(blocked.response.status, 403);
    assert.match(blocked.body.error, /blocked/i);
  });

  test("friends endpoint reflects accepted friends, requests, and block state", async () => {
    const alice = await login();
    const initial = await request("/api/friends/seed-alice", { token: alice.token });
    assert.equal(initial.response.status, 200);
    assert.equal(initial.body.friends.find((friend) => friend.userId === "seed-bob").blocked, false);
    assert.equal(initial.body.friends.some((friend) => friend.userId === "seed-casey"), false);

    await request("/api/users/seed-alice/block/seed-bob", {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({}),
    });
    const afterBlock = await request("/api/friends/seed-alice", { token: alice.token });
    assert.equal(afterBlock.body.friends.find((friend) => friend.userId === "seed-bob").blocked, true);

    await request("/api/users/seed-alice/block/seed-bob", {
      method: "DELETE",
      token: alice.token,
    });
    const afterUnblock = await request("/api/friends/seed-alice", { token: alice.token });
    assert.equal(afterUnblock.body.friends.find((friend) => friend.userId === "seed-bob").blocked, false);

    const sent = await request("/api/friends/seed-alice/requests/seed-casey", {
      method: "POST",
      token: alice.token,
      body: JSON.stringify({}),
    });
    assert.equal(sent.response.status, 201);
    assert.equal(sent.body.status, "outgoing");

    const alicePending = await request("/api/friends/seed-alice", { token: alice.token });
    assert.equal(alicePending.body.outgoing[0].user.userId, "seed-casey");

    const casey = await login("casey@example.edu");
    const caseyPending = await request("/api/friends/seed-casey", { token: casey.token });
    assert.equal(caseyPending.body.incoming[0].user.userId, "seed-alice");

    const accepted = await request(
      `/api/friends/seed-casey/requests/${caseyPending.body.incoming[0].requestId}/accept`,
      { method: "POST", token: casey.token, body: JSON.stringify({}) },
    );
    assert.equal(accepted.body.status, "friends");

    const aliceFriends = await request("/api/friends/seed-alice", { token: alice.token });
    assert.equal(aliceFriends.body.friends.some((friend) => friend.userId === "seed-casey"), true);
  });

  test("friend requests can be declined before becoming friends", async () => {
    const bob = await login("bob@example.edu");
    const sent = await request("/api/friends/seed-bob/requests/seed-casey", {
      method: "POST",
      token: bob.token,
      body: JSON.stringify({}),
    });
    assert.equal(sent.response.status, 201);

    const casey = await login("casey@example.edu");
    const pending = await request("/api/friends/seed-casey", { token: casey.token });
    assert.equal(pending.body.incoming[0].user.userId, "seed-bob");

    const declined = await request(
      `/api/friends/seed-casey/requests/${pending.body.incoming[0].requestId}/decline`,
      { method: "POST", token: casey.token, body: JSON.stringify({}) },
    );
    assert.equal(declined.body.status, "declined");

    const after = await request("/api/friends/seed-bob", { token: bob.token });
    assert.equal(after.body.friends.some((friend) => friend.userId === "seed-casey"), false);
    assert.equal(after.body.outgoing.length, 0);
  });
});
