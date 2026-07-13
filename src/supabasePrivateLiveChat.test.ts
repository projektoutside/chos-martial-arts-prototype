import { describe, expect, it, vi } from "vitest";
import type { SupabaseStoredSession } from "./supabaseAccounts";
import {
  createPrivateChatRoom,
  fetchPrivateChatInvitees,
  fetchPrivateChatMessages,
  fetchPrivateChatRooms,
  leavePrivateChatRoom,
  sendPrivateChatMessage,
  subscribeToPrivateChatChanges,
  updatePrivateChatRoom,
  type PrivateChatClient
} from "./supabasePrivateLiveChat";

const session: SupabaseStoredSession = {
  accessToken: "token",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  userId: "creator-1"
};

function query(result: unknown[] = []) {
  const value: Record<string, ReturnType<typeof vi.fn>> = {};
  value.select = vi.fn(() => value);
  value.eq = vi.fn(() => value);
  value.order = vi.fn(() => value);
  value.limit = vi.fn(async () => ({ data: result, error: null }));
  value.insert = vi.fn(() => value);
  value.single = vi.fn(async () => ({ data: result[0] ?? null, error: null }));
  return value;
}

describe("Supabase private live chat adapter", () => {
  it("maps authorized rooms and active invitees", async () => {
    const rpc = vi.fn(async (name: string) => name === "list_private_chat_rooms"
      ? { data: [{
          id: "room-1", name: "Black Belt Team", tab_color: "#2ea66f", creator_id: "creator-1",
          created_at: "2026-07-13T16:00:00.000Z", updated_at: "2026-07-13T16:00:00.000Z",
          members: [{ profile_id: "member-1", display_name: "Talia Brooks", role: "student", joined_at: "2026-07-13T16:00:00.000Z" }]
        }], error: null }
      : { data: [{ id: "member-1", display_name: "Talia Brooks", role: "student" }], error: null });
    const client = { rpc, from: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() } as unknown as PrivateChatClient;

    await expect(fetchPrivateChatRooms({ client })).resolves.toMatchObject({
      status: "ok",
      data: [{ id: "room-1", name: "Black Belt Team", tabColor: "#2ea66f", creatorId: "creator-1", members: [{ profileId: "member-1", displayName: "Talia Brooks" }] }]
    });
    await expect(fetchPrivateChatInvitees({ client })).resolves.toEqual({
      status: "ok", data: [{ id: "member-1", displayName: "Talia Brooks", role: "student" }]
    });
  });

  it("validates room names and invitees before calling creation RPC", async () => {
    const rpc = vi.fn(async () => ({ data: "room-1", error: null }));
    const client = { rpc } as unknown as PrivateChatClient;

    await expect(createPrivateChatRoom({ name: " ", memberIds: ["member-1"], tabColor: "#8a63f2", client })).resolves.toMatchObject({ status: "error" });
    await expect(createPrivateChatRoom({ name: "Team", memberIds: [], tabColor: "#8a63f2", client })).resolves.toMatchObject({ status: "error" });
    await expect(createPrivateChatRoom({ name: "Team", memberIds: ["member-1"], tabColor: "#ffffff" as "#8a63f2", client })).resolves.toEqual({ status: "error", message: "Choose an approved room tab color." });
    expect(rpc).not.toHaveBeenCalled();

    await createPrivateChatRoom({ name: "  Team  ", memberIds: ["member-1", "member-1"], tabColor: "#2f80c9", client });
    expect(rpc).toHaveBeenCalledWith("create_private_chat_room", { room_name: "Team", invited_profile_ids: ["member-1"], room_tab_color: "#2f80c9" });
  });

  it("uses creator-only update RPC and self-leave RPC", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const client = { rpc } as unknown as PrivateChatClient;

    await updatePrivateChatRoom({ roomId: "room-1", name: "Leadership", memberIds: ["member-1"], tabColor: "#c94b62", client });
    await leavePrivateChatRoom({ roomId: "room-1", client });

    expect(rpc).toHaveBeenNthCalledWith(1, "update_private_chat_room", {
      room_id: "room-1", room_name: "Leadership", invited_profile_ids: ["member-1"], room_tab_color: "#c94b62"
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "leave_private_chat_room", { room_id: "room-1" });
  });

  it("fetches chronological private messages and sends as the authenticated profile", async () => {
    const messages = [
      { id: "m2", room_id: "room-1", sender_id: "creator-1", sender_name: "Coach", sender_role: "staff", sender_avatar_path: null, body: "Second", created_at: "2026-07-13T16:02:00.000Z" },
      { id: "m1", room_id: "room-1", sender_id: "member-1", sender_name: "Talia", sender_role: "student", sender_avatar_path: null, body: "First", created_at: "2026-07-13T16:01:00.000Z" }
    ];
    const fetchQuery = query(messages);
    const profileQuery = query([{ id: "creator-1", display_name: "Coach", role: "staff", status: "active" }]);
    profileQuery.maybeSingle = vi.fn(async () => ({ data: { id: "creator-1", display_name: "Coach", role: "staff", status: "active" }, error: null }));
    const insertQuery = query([{ ...messages[0], id: "m3", body: "Ready" }]);
    let privateMessageQueryCount = 0;
    const client = {
      rpc: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(),
      from: vi.fn((table: string) => {
        if (table === "profiles") return profileQuery;
        privateMessageQueryCount += 1;
        return privateMessageQueryCount === 1 ? fetchQuery : insertQuery;
      })
    } as unknown as PrivateChatClient;

    await expect(fetchPrivateChatMessages({ roomId: "room-1", client })).resolves.toMatchObject({
      status: "ok", data: [{ id: "m1", body: "First" }, { id: "m2", body: "Second" }]
    });
    await expect(sendPrivateChatMessage({ roomId: "room-1", body: " Ready ", client, session })).resolves.toMatchObject({ status: "ok", data: { body: "Ready" } });
  });

  it("subscribes with auth and removes the channel exactly once", async () => {
    const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
    const client = {
      rpc: vi.fn(), from: vi.fn(), channel: vi.fn(() => channel), removeChannel: vi.fn(),
      realtime: { setAuth: vi.fn(async () => undefined) }
    } as unknown as PrivateChatClient;
    const onChange = vi.fn();

    const subscription = subscribeToPrivateChatChanges({ client, session, onChange });
    await Promise.resolve(); await Promise.resolve();
    subscription.cleanup(); subscription.cleanup();

    expect(client.realtime?.setAuth).toHaveBeenCalledWith("token");
    expect(channel.on).toHaveBeenCalled();
    expect(client.removeChannel).toHaveBeenCalledTimes(1);
  });
});
