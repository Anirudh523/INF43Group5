export function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

export function isBioWithinLimit(text, limit = 350) {
  return wordCount(text) <= limit;
}

export function filterAndSortActivities(activities, { query = "", groupSize = "", sortBy = "distance" } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const minimumCapacity = Number(groupSize);
  return [...activities]
    .filter((activity) => {
      const haystack = `${activity.title} ${activity.interest} ${activity.locationName}`.toLowerCase();
      return !normalizedQuery || haystack.includes(normalizedQuery);
    })
    .filter((activity) => !minimumCapacity || activity.capacity >= minimumCapacity)
    .sort((a, b) => {
      if (sortBy === "capacity") return a.capacity - b.capacity;
      if (sortBy === "relevance") {
        const aMatch = normalizedQuery && a.interest.toLowerCase().includes(normalizedQuery) ? 0 : 1;
        const bMatch = normalizedQuery && b.interest.toLowerCase().includes(normalizedQuery) ? 0 : 1;
        return aMatch - bMatch;
      }
      return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
    });
}

export function sortFriendsForDisplay(friends) {
  return [...friends].sort((a, b) => Number(a.blocked) - Number(b.blocked));
}

export function canSendChatMessage({ text, error }) {
  return String(text).trim().length > 0 && !error;
}

export function nextBlockedState(friend) {
  return { ...friend, blocked: !friend.blocked };
}
