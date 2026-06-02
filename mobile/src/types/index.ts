export type UserSession = {
  userId: string;
  displayName: string;
  idVerified: boolean;
  token?: string;
};

export type NearbyUser = {
  userId: string;
  displayName: string;
  distanceKm: number;
  bio?: string | null;
  interests?: string[];
  lat?: number;
  lon?: number;
  isPrivate?: boolean;
  friendshipStatus?: "none" | "outgoing" | "incoming" | "friends";
};

export type Activity = {
  id: string;
  title: string;
  interest: string;
  schedule: string;
  locationName: string;
  lat?: number;
  lon?: number;
  capacity: number;
  memberCount: number;
  spotsLeft: number;
  full: boolean;
  recurring: boolean;
  distanceKm: number | null;
  memberIds: string[];
  members: Array<{
    userId: string;
    displayName: string;
  }>;
  createdByUserId?: string;
};

export type ChatThread = {
  otherUserId: string;
  displayName: string;
  lastMessage: string;
  lastAt?: string;
};

export type FriendSummary = {
  userId: string;
  displayName: string;
  initials: string;
  blocked: boolean;
};

export type FriendRequestSummary = {
  requestId: string;
  user: FriendSummary;
};

export type ChatMessage = {
  id: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  createdAt: string;
};

export type Settings = {
  discoveryRadiusKm: number;
  isPublic: boolean;
  darkMode: boolean;
  notificationsEnabled: boolean;
  notificationStyle: "banner" | "popup";
  filters: {
    ageMin: number;
    ageMax: number;
    genders: string[];
    sexualities: string[];
  };
};
