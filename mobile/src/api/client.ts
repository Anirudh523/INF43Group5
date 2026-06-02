import { API_BASE_URL } from "./config";
import type {
  Activity,
  ChatMessage,
  ChatThread,
  FriendRequestSummary,
  FriendSummary,
  NearbyUser,
  Settings,
} from "../types";

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setApiAuthToken(token?: string | null) {
  authToken = token ?? null;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler?.();
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),

  login: (email: string, password: string) =>
    request<{ ok: boolean; userId: string; displayName: string; idVerified: boolean; token: string }>(
      "/api/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  register: (body: {
    userId: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
    sexuality: string;
    interests?: string[];
  }) =>
    request<{ ok: boolean; userId: string; requiresIdVerification: boolean }>("/api/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  verifyId: (userId: string, idImageBase64: string) =>
    request<{ ok: boolean; status: string; message: string; token: string }>("/api/id-verify", {
      method: "POST",
      body: JSON.stringify({ userId, idImageBase64 }),
    }),

  postLocation: (userId: string, lat: number, lon: number) =>
    request<{ ok: boolean }>("/api/location", {
      method: "POST",
      body: JSON.stringify({ userId, lat, lon }),
    }),

  getNearby: (lat: number, lon: number, userId: string) =>
    request<{ count: number; nearby: NearbyUser[]; emptyMessage?: string }>(
      `/api/nearby?${new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        userId,
      })}`
    ),

  getProfile: (userId: string) =>
    request<{
      userId: string;
      displayName: string;
      bio?: string;
      interests: string[];
      isPublic: boolean;
      age?: number | null;
      gender?: string | null;
      sexuality?: string | null;
    }>(
      `/api/users/${userId}`
    ),

  patchProfile: (
    userId: string,
    body: {
      bio?: string;
      isPublic?: boolean;
      interests?: string[];
      age?: number;
      gender?: string;
      sexuality?: string;
    }
  ) =>
    request<{ ok: boolean; profile: Record<string, unknown> }>(`/api/profile/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  getSettings: (userId: string) => request<Settings>(`/api/settings/${userId}`),

  patchSettings: (userId: string, body: Partial<Settings>) =>
    request<{ ok: boolean; settings: Settings }>(`/api/settings/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  getActivities: (lat?: number, lon?: number, interest?: string) => {
    const q = new URLSearchParams();
    if (lat != null) q.set("lat", String(lat));
    if (lon != null) q.set("lon", String(lon));
    if (interest) q.set("interest", interest);
    return request<{ activities: Activity[] }>(`/api/activities?${q}`);
  },

  createActivity: (body: {
    userId: string;
    title: string;
    interest: string;
    schedule: string;
    locationName: string;
    lat: number;
    lon: number;
    capacity: number;
    recurring: boolean;
  }) =>
    request<{ ok: boolean; activity: Activity }>("/api/activities", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getFriends: (userId: string, q?: string) =>
    request<{
      friends: FriendSummary[];
      incoming: FriendRequestSummary[];
      outgoing: FriendRequestSummary[];
    }>(
      `/api/friends/${userId}?${new URLSearchParams(q ? { q } : {})}`
    ),

  sendFriendRequest: (userId: string, otherUserId: string) =>
    request<{ ok: boolean; status: string; message?: string }>(
      `/api/friends/${userId}/requests/${otherUserId}`,
      { method: "POST", body: JSON.stringify({}) },
    ),

  acceptFriendRequest: (userId: string, requestId: string) =>
    request<{ ok: boolean; status: string }>(`/api/friends/${userId}/requests/${requestId}/accept`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  declineFriendRequest: (userId: string, requestId: string) =>
    request<{ ok: boolean; status: string }>(`/api/friends/${userId}/requests/${requestId}/decline`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  blockUser: (userId: string, otherUserId: string) =>
    request<{ ok: boolean; blockedUserId: string }>(`/api/users/${userId}/block/${otherUserId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  unblockUser: (userId: string, otherUserId: string) =>
    request<{ ok: boolean; blockedUserId: string }>(`/api/users/${userId}/block/${otherUserId}`, {
      method: "DELETE",
    }),

  joinActivity: (activityId: string, userId: string) =>
    request<{ ok: boolean; message: string; full?: boolean }>(`/api/activities/${activityId}/join`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  leaveActivity: (activityId: string, userId: string) =>
    request<{ ok: boolean; message: string; deleted?: boolean }>(`/api/activities/${activityId}/leave`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  getChatThreads: (userId: string) =>
    request<{ threads: ChatThread[] }>(`/api/chat/threads/${userId}`),

  getChatMessages: (userId: string, otherUserId: string) =>
    request<{ messages: ChatMessage[] }>(`/api/chat/${userId}/${otherUserId}`),

  sendMessage: (userId: string, otherUserId: string, text: string) =>
    request<{ ok: boolean; message: ChatMessage }>(`/api/chat/${userId}/${otherUserId}`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  reportUser: (userId: string, otherUserId: string) =>
    request<{ ok: boolean; message: string }>(`/api/chat/${userId}/${otherUserId}/report`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
