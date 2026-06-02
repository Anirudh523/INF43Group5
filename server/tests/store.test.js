import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, test } from "node:test";

process.env.FINDME_DATA_FILE = path.join(
  mkdtempSync(path.join(os.tmpdir(), "findme-store-test-")),
  "data.json",
);

const auth = await import("../auth.js");
const store = await import("../store.js");

const {
  activities,
  blocks,
  chatKey,
  chats,
  createUser,
  haversineKm,
  matchesFilters,
  publicUserFields,
  reports,
  friendRequests,
  seedDemoData,
  sessions,
  users,
  verificationAttempts,
} = store;

function resetStore() {
  users.clear();
  activities.clear();
  chats.clear();
  sessions.clear();
  blocks.clear();
  reports.clear();
  friendRequests.clear();
  verificationAttempts.clear();
}

beforeEach(resetStore);

describe("store and auth unit tests", () => {
  test("haversineKm returns zero for identical coordinates", () => {
    assert.equal(haversineKm(33.6846, -117.8265, 33.6846, -117.8265), 0);
  });

  test("haversineKm returns a realistic Orange County distance", () => {
    const km = haversineKm(33.6846, -117.8265, 33.69, -117.82);
    assert.ok(km > 0.7);
    assert.ok(km < 0.9);
  });

  test("publicUserFields exposes only public profile fields", () => {
    const fields = publicUserFields({
      userId: "user-public",
      displayName: "Public User",
      bio: "Open profile",
      interests: ["hiking"],
      email: "hidden@example.com",
      password: "hidden",
    });

    assert.deepEqual(fields, {
      userId: "user-public",
      displayName: "Public User",
      bio: "Open profile",
      interests: ["hiking"],
    });
  });

  test("matchesFilters rejects candidates outside the viewer age range", () => {
    const viewer = { filters: { ageMin: 21, ageMax: 25, genders: ["any"], sexualities: ["any"] } };
    const candidate = { age: 28, gender: "woman" };
    assert.equal(matchesFilters(viewer, candidate), false);
  });

  test("matchesFilters accepts candidates matching a specific gender filter", () => {
    const viewer = { filters: { ageMin: 18, ageMax: 35, genders: ["non-binary"], sexualities: ["any"] } };
    const candidate = { age: 24, gender: "non-binary" };
    assert.equal(matchesFilters(viewer, candidate), true);
  });

  test("matchesFilters treats any gender as unrestricted", () => {
    const viewer = { filters: { ageMin: 18, ageMax: 35, genders: ["any"], sexualities: ["any"] } };
    const candidate = { age: 30, gender: "man" };
    assert.equal(matchesFilters(viewer, candidate), true);
  });

  test("matchesFilters rejects candidates outside sexuality filter", () => {
    const viewer = {
      filters: { ageMin: 18, ageMax: 35, genders: ["any"], sexualities: ["queer"] },
    };
    const candidate = { age: 30, gender: "woman", sexuality: "straight" };
    assert.equal(matchesFilters(viewer, candidate), false);
  });

  test("chatKey is stable regardless of user order", () => {
    assert.equal(chatKey("seed-bob", "seed-alice"), "seed-alice|seed-bob");
    assert.equal(chatKey("seed-alice", "seed-bob"), "seed-alice|seed-bob");
  });

  test("seedDemoData creates the prototype demo dataset once", () => {
    seedDemoData();
    seedDemoData();

    assert.equal(users.size, 3);
    assert.equal(activities.size, 3);
    assert.equal(chats.size, 1);
    assert.equal(friendRequests.size, 1);
    assert.equal(users.get("seed-alice").email, "alice@example.edu");
  });

  test("createUser normalizes missing defaults", () => {
    const user = createUser({ userId: "new-user", displayName: "New User" });

    assert.equal(user.userId, "new-user");
    assert.equal(user.bio, "");
    assert.equal(user.isPublic, true);
    assert.deepEqual(user.filters, {
      ageMin: 18,
      ageMax: 99,
      genders: ["any"],
      sexualities: ["any"],
    });
  });

  test("hashPassword verifies the original password and rejects a different one", () => {
    const hash = auth.hashPassword("demo123");

    assert.equal(auth.verifyPassword("demo123", hash), true);
    assert.equal(auth.verifyPassword("wrong-password", hash), false);
  });

  test("verifyPassword supports legacy plaintext demo passwords", () => {
    assert.equal(auth.verifyPassword("demo123", "demo123"), true);
    assert.equal(auth.verifyPassword("not-demo", "demo123"), false);
  });
});
