import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  canSendChatMessage,
  filterAndSortActivities,
  isBioWithinLimit,
  nextBlockedState,
  sortFriendsForDisplay,
  wordCount,
} from "../src/utils/prototypeLogic.mjs";

const activities = [
  {
    id: "act-1",
    title: "Coffee Meetup",
    interest: "coffee",
    locationName: "UCI Student Center",
    capacity: 8,
    distanceKm: 4.2,
  },
  {
    id: "act-2",
    title: "Study Group",
    interest: "study",
    locationName: "Science Library",
    capacity: 3,
    distanceKm: 1.1,
  },
  {
    id: "act-3",
    title: "Coffee and Drawing",
    interest: "drawing",
    locationName: "Arts Plaza",
    capacity: 12,
    distanceKm: null,
  },
];

describe("mobile prototype logic tests", () => {
  test("wordCount handles blank and multi-space bios", () => {
    assert.equal(wordCount(""), 0);
    assert.equal(wordCount("coffee   hiking\nstudy"), 3);
  });

  test("isBioWithinLimit accepts 350 words and rejects 351 words", () => {
    assert.equal(isBioWithinLimit(Array(350).fill("word").join(" ")), true);
    assert.equal(isBioWithinLimit(Array(351).fill("word").join(" ")), false);
  });

  test("filterAndSortActivities filters by keyword across title, interest, and location", () => {
    const result = filterAndSortActivities(activities, { query: "coffee" });
    assert.deepEqual(
      result.map((activity) => activity.id),
      ["act-1", "act-3"],
    );
  });

  test("filterAndSortActivities applies minimum group capacity", () => {
    const result = filterAndSortActivities(activities, { groupSize: "8", sortBy: "capacity" });
    assert.deepEqual(
      result.map((activity) => activity.id),
      ["act-1", "act-3"],
    );
  });

  test("filterAndSortActivities sorts by distance with unknown distance last", () => {
    const result = filterAndSortActivities(activities, { sortBy: "distance" });
    assert.deepEqual(
      result.map((activity) => activity.id),
      ["act-2", "act-1", "act-3"],
    );
  });

  test("sortFriendsForDisplay keeps blocked people lower in the list", () => {
    const result = sortFriendsForDisplay([
      { userId: "ryan", blocked: true },
      { userId: "allie", blocked: false },
    ]);
    assert.deepEqual(
      result.map((friend) => friend.userId),
      ["allie", "ryan"],
    );
  });

  test("canSendChatMessage blocks empty or errored conversations", () => {
    assert.equal(canSendChatMessage({ text: "hello", error: "" }), true);
    assert.equal(canSendChatMessage({ text: "   ", error: "" }), false);
    assert.equal(canSendChatMessage({ text: "hello", error: "This conversation is blocked." }), false);
  });

  test("nextBlockedState toggles the block checkbox state", () => {
    assert.deepEqual(nextBlockedState({ userId: "bob", blocked: false }), {
      userId: "bob",
      blocked: true,
    });
  });
});
