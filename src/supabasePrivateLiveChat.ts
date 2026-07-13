import { getSupabaseLiveChatClient, validateLiveChatBody, type LiveChatResult } from "./supabaseLiveChat";
import {
  isSupabaseBackendInactiveError,
  readSupabaseAuthSession,
  supabaseBackendInactiveMessage,
  type SupabaseStoredSession
} from "./supabaseAccounts";
import type { AccountRole } from "./types";

export const privateChatRoomNameMaxLength = 80;
export const privateChatRoomColorOptions = [
  { name: "Purple", value: "#8a63f2" },
  { name: "Crimson", value: "#c94b62" },
  { name: "Emerald", value: "#2ea66f" },
  { name: "Ocean", value: "#2f80c9" },
  { name: "Amber", value: "#c58a2a" },
  { name: "Rose", value: "#c25b91" },
  { name: "Teal", value: "#218f91" },
  { name: "Slate", value: "#66758f" }
] as const;
export type PrivateChatRoomColor = typeof privateChatRoomColorOptions[number]["value"];
export const defaultPrivateChatRoomColor: PrivateChatRoomColor = "#8a63f2";

export type PrivateChatMember = {
  profileId: string;
  displayName: string;
  role: AccountRole;
  joinedAt: string;
};

export type PrivateChatRoom = {
  id: string;
  name: string;
  tabColor: PrivateChatRoomColor;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  members: PrivateChatMember[];
};

export type PrivateChatInvitee = { id: string; displayName: string; role: AccountRole };

export type PrivateChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: AccountRole;
  senderAvatarPath: string | null;
  body: string;
  createdAt: string;
};

type RoomRow = {
  id: string; name: string; tab_color: PrivateChatRoomColor; creator_id: string; created_at: string; updated_at: string;
  members: Array<{ profile_id: string; display_name: string; role: AccountRole; joined_at: string }>;
};
type InviteeRow = { id: string; display_name: string; role: AccountRole };
type MessageRow = {
  id: string; room_id: string; sender_id: string; sender_name: string; sender_role: AccountRole;
  sender_avatar_path: string | null; body: string; created_at: string;
};
type ProfileRow = { id: string; display_name: string; role: AccountRole; status: "active" | "inactive" };
type ErrorLike = { message: string };
type Result<T> = { data: T | null; error: ErrorLike | null };

type Query = {
  select: (columns: string) => Query;
  eq: (column: string, value: unknown) => Query;
  order: (column: string, options: { ascending: boolean }) => Query;
  limit: (count: number) => Promise<Result<MessageRow[]>>;
  insert: (value: Record<string, unknown>) => Query;
  single: () => Promise<Result<MessageRow>>;
  maybeSingle: () => Promise<Result<ProfileRow | null>>;
};

type Channel = {
  on: (type: "postgres_changes", filter: Record<string, string>, callback: (payload: unknown) => void) => Channel;
  subscribe: (callback?: (status: string, error?: ErrorLike) => void) => Channel;
};

export type PrivateChatClient = {
  rpc: <T = unknown>(name: string, params?: Record<string, unknown>) => Promise<Result<T>>;
  from: (table: string) => Query;
  channel: (name: string) => Channel;
  removeChannel: (channel: Channel) => unknown;
  realtime?: { setAuth: (token?: string | null) => Promise<unknown> | unknown };
};

function clientOrDefault(client?: PrivateChatClient) {
  return client ?? getSupabaseLiveChatClient() as unknown as PrivateChatClient | undefined;
}

function failure(error: unknown, fallback: string): LiveChatResult<never> {
  if (isSupabaseBackendInactiveError(error)) return { status: "unavailable", message: supabaseBackendInactiveMessage };
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : error instanceof Error ? error.message : fallback;
  return { status: "error", message };
}

function validateRoomInput(name: string, memberIds: string[], tabColor: PrivateChatRoomColor) {
  const normalizedName = name.trim();
  if (!normalizedName) return { ok: false as const, message: "Enter a room name." };
  if (normalizedName.length > privateChatRoomNameMaxLength) return { ok: false as const, message: `Room names must be ${privateChatRoomNameMaxLength} characters or fewer.` };
  const normalizedMemberIds = [...new Set(memberIds.filter(Boolean))];
  if (!normalizedMemberIds.length) return { ok: false as const, message: "Invite at least one person to the room." };
  if (!privateChatRoomColorOptions.some((option) => option.value === tabColor)) return { ok: false as const, message: "Choose an approved room tab color." };
  return { ok: true as const, name: normalizedName, memberIds: normalizedMemberIds, tabColor };
}

function mapRoom(row: RoomRow): PrivateChatRoom {
  return {
    id: row.id, name: row.name, tabColor: row.tab_color, creatorId: row.creator_id, createdAt: row.created_at, updatedAt: row.updated_at,
    members: (row.members ?? []).map((member) => ({
      profileId: member.profile_id, displayName: member.display_name, role: member.role, joinedAt: member.joined_at
    }))
  };
}

function mapMessage(row: MessageRow): PrivateChatMessage {
  return {
    id: row.id, roomId: row.room_id, senderId: row.sender_id, senderName: row.sender_name,
    senderRole: row.sender_role, senderAvatarPath: row.sender_avatar_path, body: row.body, createdAt: row.created_at
  };
}

export async function fetchPrivateChatRooms({ client }: { client?: PrivateChatClient } = {}): Promise<LiveChatResult<PrivateChatRoom[]>> {
  const activeClient = clientOrDefault(client);
  if (!activeClient) return { status: "unavailable", message: "Supabase sign-in required for private rooms." };
  try {
    const response = await activeClient.rpc<RoomRow[]>("list_private_chat_rooms");
    if (response.error) return failure(response.error, "Private rooms could not be loaded.");
    return { status: "ok", data: (response.data ?? []).map(mapRoom) };
  } catch (error) { return failure(error, "Private rooms could not be loaded."); }
}

export async function fetchPrivateChatInvitees({ client }: { client?: PrivateChatClient } = {}): Promise<LiveChatResult<PrivateChatInvitee[]>> {
  const activeClient = clientOrDefault(client);
  if (!activeClient) return { status: "unavailable", message: "Supabase sign-in required to load accounts." };
  try {
    const response = await activeClient.rpc<InviteeRow[]>("list_private_chat_invitees");
    if (response.error) return failure(response.error, "Available accounts could not be loaded.");
    return { status: "ok", data: (response.data ?? []).map((row) => ({ id: row.id, displayName: row.display_name, role: row.role })) };
  } catch (error) { return failure(error, "Available accounts could not be loaded."); }
}

async function roomMutation(name: string, params: Record<string, unknown>, client?: PrivateChatClient): Promise<LiveChatResult<null>> {
  const activeClient = clientOrDefault(client);
  if (!activeClient) return { status: "unavailable", message: "Supabase sign-in required to manage private rooms." };
  try {
    const response = await activeClient.rpc(name, params);
    if (response.error) return failure(response.error, "The private room could not be updated.");
    return { status: "ok", data: null };
  } catch (error) { return failure(error, "The private room could not be updated."); }
}

export async function createPrivateChatRoom({ name, memberIds, tabColor, client }: { name: string; memberIds: string[]; tabColor: PrivateChatRoomColor; client?: PrivateChatClient }): Promise<LiveChatResult<string>> {
  const validation = validateRoomInput(name, memberIds, tabColor);
  if (!validation.ok) return { status: "error", message: validation.message };
  const activeClient = clientOrDefault(client);
  if (!activeClient) return { status: "unavailable", message: "Supabase sign-in required to create private rooms." };
  try {
    const response = await activeClient.rpc<string>("create_private_chat_room", { room_name: validation.name, invited_profile_ids: validation.memberIds, room_tab_color: validation.tabColor });
    if (response.error) return failure(response.error, "The private room could not be created.");
    if (!response.data) return { status: "error", message: "The new private room was not returned." };
    return { status: "ok", data: response.data };
  } catch (error) { return failure(error, "The private room could not be created."); }
}

export async function updatePrivateChatRoom({ roomId, name, memberIds, tabColor, client }: { roomId: string; name: string; memberIds: string[]; tabColor: PrivateChatRoomColor; client?: PrivateChatClient }) {
  const validation = validateRoomInput(name, memberIds, tabColor);
  if (!validation.ok) return { status: "error" as const, message: validation.message };
  return roomMutation("update_private_chat_room", { room_id: roomId, room_name: validation.name, invited_profile_ids: validation.memberIds, room_tab_color: validation.tabColor }, client);
}

export async function deletePrivateChatRoom({ roomId, client }: { roomId: string; client?: PrivateChatClient }) {
  return roomMutation("delete_private_chat_room", { room_id: roomId }, client);
}

export async function leavePrivateChatRoom({ roomId, client }: { roomId: string; client?: PrivateChatClient }) {
  return roomMutation("leave_private_chat_room", { room_id: roomId }, client);
}

const messageColumns = "id,room_id,sender_id,sender_name,sender_role,sender_avatar_path,body,created_at";

export async function fetchPrivateChatMessages({ roomId, client, limit = 80 }: { roomId: string; client?: PrivateChatClient; limit?: number }): Promise<LiveChatResult<PrivateChatMessage[]>> {
  const activeClient = clientOrDefault(client);
  if (!activeClient) return { status: "unavailable", message: "Supabase sign-in required for private messages." };
  try {
    const response = await activeClient.from("private_chat_messages").select(messageColumns).eq("room_id", roomId).order("created_at", { ascending: false }).limit(limit);
    if (response.error) return failure(response.error, "Private messages could not be loaded.");
    return { status: "ok", data: [...(response.data ?? [])].reverse().map(mapMessage) };
  } catch (error) { return failure(error, "Private messages could not be loaded."); }
}

export async function sendPrivateChatMessage({ roomId, body, senderAvatarPath, client, session = readSupabaseAuthSession() }: { roomId: string; body: string; senderAvatarPath?: string; client?: PrivateChatClient; session?: SupabaseStoredSession }): Promise<LiveChatResult<PrivateChatMessage>> {
  const validation = validateLiveChatBody(body);
  if (!validation.ok) return { status: "error", message: validation.message };
  const activeClient = clientOrDefault(client);
  if (!activeClient || !session) return { status: "unavailable", message: "Supabase sign-in required to send private messages." };
  try {
    const profileResponse = await activeClient.from("profiles").select("id,display_name,role,status").eq("id", session.userId).maybeSingle();
    if (profileResponse.error) return failure(profileResponse.error, "Your profile could not be verified.");
    const profile = profileResponse.data;
    if (!profile || profile.status !== "active") return { status: "error", message: "Only active Cho's accounts can send private messages." };
    const response = await activeClient.from("private_chat_messages").insert({
      room_id: roomId, sender_id: session.userId, sender_name: profile.display_name, sender_role: profile.role,
      sender_avatar_path: senderAvatarPath ?? null, body: validation.body
    }).select(messageColumns).single();
    if (response.error) return failure(response.error, "The private message could not be sent.");
    if (!response.data) return { status: "error", message: "The sent private message was not returned." };
    return { status: "ok", data: mapMessage(response.data) };
  } catch (error) { return failure(error, "The private message could not be sent."); }
}

let channelSequence = 0;
export function subscribeToPrivateChatChanges({ onChange, onMessage, onStatus, client, session = readSupabaseAuthSession(), roomId }: {
  onChange: () => void; onMessage?: (message: PrivateChatMessage) => void; onStatus?: (status: string, message?: string) => void;
  client?: PrivateChatClient; session?: SupabaseStoredSession; roomId?: string;
}) {
  const activeClient = clientOrDefault(client);
  if (!activeClient) return { status: "unavailable" as const, cleanup: () => undefined };
  let channel: Channel | undefined;
  let cleaned = false;
  void (async () => {
    try {
      await activeClient.realtime?.setAuth(session?.accessToken ?? null);
      if (cleaned) return;
      channelSequence += 1;
      channel = activeClient.channel(`private-chat:${channelSequence}`);
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "private_chat_access_events" }, onChange);
      if (onMessage) channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "private_chat_messages", ...(roomId ? { filter: `room_id=eq.${roomId}` } : {}) },
        (payload) => onMessage(mapMessage((payload as { new: MessageRow }).new))
      );
      channel.subscribe((status, error) => onStatus?.(status, error?.message));
      if (cleaned && channel) void activeClient.removeChannel(channel);
    } catch (error) { if (!cleaned) onStatus?.("CHANNEL_ERROR", error instanceof Error ? error.message : "Private chat subscription failed."); }
  })();
  return {
    status: "subscribed" as const,
    cleanup: () => {
      if (cleaned) return;
      cleaned = true;
      if (channel) { const current = channel; channel = undefined; void activeClient.removeChannel(current); }
    }
  };
}
