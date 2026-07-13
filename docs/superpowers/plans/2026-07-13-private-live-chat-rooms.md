# Private Live Chat Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure, realtime private Live Chat rooms that any active Cho's account can create while reserving room management for the creator.

**Architecture:** Add normalized Supabase room, membership, and message tables protected by row-level security and narrowly scoped RPCs. A new typed client adapter will isolate private-room persistence and realtime behavior, while `LiveChatRoomFrame` will merge authorized private rooms with the existing Cho's Room and Mentions tabs and delegate creation/management to focused dialogs.

**Tech Stack:** React 19, TypeScript 6, Supabase Postgres/RLS/Realtime, Vitest, Testing Library, Vite, CSS.

## Global Constraints

- Preserve current Cho's Room and Mentions behavior.
- Any active staff, student, or guardian profile may create a room and invite active profiles of every supported role.
- Only the creator may rename a room, add/remove other members, or delete the room.
- Non-creator members may leave only by removing their own membership.
- Removing or leaving immediately revokes access to the full room history.
- Do not add dependencies or store private-room data in local storage or the shared app-state record.
- Keep unrelated Android, plan, and output worktree changes untouched.
- Follow strict red-green-refactor: each production behavior requires a test that was observed failing first.

## File map

- Create `supabase/migrations/20260713160000_private_live_chat_rooms.sql`: tables, indexes, grants, RLS helpers/policies, atomic RPCs, and realtime publication.
- Create `src/supabasePrivateLiveChat.ts`: typed private-room/member/message adapter and realtime subscriptions.
- Create `src/supabasePrivateLiveChat.test.ts`: adapter mapping, validation, RPC, message, and subscription tests.
- Create `src/PrivateLiveChatDialogs.tsx`: accessible create/manage/delete/leave dialogs and searchable member picker.
- Create `src/PrivateLiveChatDialogs.test.tsx`: focused dialog behavior and accessibility tests.
- Modify `src/OperationsApp.tsx`: integrate private-room state, tabs, messages, roster, Mentions, and management actions.
- Modify `src/App.test.tsx`: integrated Live Chat regression and end-user workflow tests.
- Modify `src/styles.css`: green Create Room action, private-room controls/dialogs, compact scrolling tabs, and responsive styles.
- Create `e2e/private-live-chat-rooms.spec.ts`: browser coverage for layout and modal keyboard behavior using a controlled adapter state.

---

### Task 1: Secure private-room database contract

**Files:**
- Create: `supabase/migrations/20260713160000_private_live_chat_rooms.sql`

**Interfaces:**
- Consumes: `public.profiles(id, display_name, role, status)` and `private.is_active_live_chat_profile()`.
- Produces: tables `private_chat_rooms`, `private_chat_room_members`, `private_chat_messages`; RPCs `list_private_chat_invitees()`, `create_private_chat_room(text, uuid[])`, `update_private_chat_room(uuid, text, uuid[])`, `delete_private_chat_room(uuid)`, `leave_private_chat_room(uuid)`; member-authorized table reads and message inserts.

- [ ] **Step 1: Write the migration assertions before schema code**

Start the migration in a transaction and add final `do` assertions that check the required relations and functions exist. Keep them at the bottom so the initial migration run fails before the objects exist:

```sql
do $$
begin
  assert to_regclass('public.private_chat_rooms') is not null;
  assert to_regclass('public.private_chat_room_members') is not null;
  assert to_regclass('public.private_chat_messages') is not null;
  assert to_regprocedure('public.create_private_chat_room(text,uuid[])') is not null;
  assert to_regprocedure('public.update_private_chat_room(uuid,text,uuid[])') is not null;
  assert to_regprocedure('public.delete_private_chat_room(uuid)') is not null;
  assert to_regprocedure('public.leave_private_chat_room(uuid)') is not null;
end $$;
```

- [ ] **Step 2: Run the assertion-only migration and verify RED**

Run: `npx supabase db reset --local`

Expected: FAIL on the first missing `private_chat_rooms` assertion. If Docker/local Supabase is unavailable, record that exact blocker and use `npx supabase db lint --local` after completing the SQL; do not claim policy runtime proof.

- [ ] **Step 3: Add normalized tables and constraints**

Define UUID primary keys, trimmed room names of 1–80 characters, immutable creator IDs, membership uniqueness, creator membership protection, 1–500 character messages, timestamps, cascade deletion, and indexes on membership profile/room and message room/created time. Use a trigger to reject changing `creator_id` or deleting the creator's membership except during room cascade deletion.

```sql
create table public.private_chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  creator_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.private_chat_room_members (
  room_id uuid not null references public.private_chat_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  joined_at timestamptz not null default now(),
  primary key (room_id, profile_id)
);

create table public.private_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.private_chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
```

- [ ] **Step 4: Add secure helper functions, RLS, grants, and RPCs**

Use `security definer` functions with `set search_path = public, pg_temp`, revoke public execution, and grant only to `authenticated`/`service_role`. `list_private_chat_invitees()` returns only active profiles and exposes only `id`, `display_name`, and `role`. Creation validates the caller and every invitee as active, deduplicates invitee IDs, inserts the creator automatically, and requires at least one non-creator invitee. Update verifies `creator_id = auth.uid()`, replaces non-creator memberships atomically, and rejects zero invitees. Delete verifies creator identity before deleting the room. Leave rejects creators. Direct table policies must use non-recursive security-definer helpers such as `private.is_private_chat_member(room_uuid)` and `private.is_private_chat_creator(room_uuid)`.

Message insert policy must require `sender_id = auth.uid()`, active membership, and a body length of 1–500. Room/member/message selects require current membership. Direct room mutation and membership mutation grants remain revoked so RPCs are the only management path.

- [ ] **Step 5: Verify migration and adversarial RLS behavior GREEN**

Run: `npx supabase db reset --local`

Then use local authenticated JWT fixtures or SQL `set local role authenticated` plus request claims to prove: a member can select; a non-member cannot select room/messages; a member can insert a message only as self; a non-creator cannot call update/delete; a member can leave; a creator cannot leave; removal makes historical messages unreadable.

Expected: migration completes and every assertion/query matches the access matrix.

- [ ] **Step 6: Commit the database contract**

```powershell
git add supabase/migrations/20260713160000_private_live_chat_rooms.sql
git commit -m "feat: secure private live chat rooms"
```

### Task 2: Typed Supabase private-chat adapter

**Files:**
- Create: `src/supabasePrivateLiveChat.ts`
- Create: `src/supabasePrivateLiveChat.test.ts`

**Interfaces:**
- Consumes: Task 1 RPC/table names and existing `getSupabaseLiveChatClient()`, `readSupabaseAuthSession()`, `validateLiveChatBody()`.
- Produces: `PrivateChatRoom`, `PrivateChatMember`, `PrivateChatInvitee`, `PrivateChatMessage`; `fetchPrivateChatRooms`, `fetchPrivateChatInvitees`, `createPrivateChatRoom`, `updatePrivateChatRoom`, `deletePrivateChatRoom`, `leavePrivateChatRoom`, `fetchPrivateChatMessages`, `sendPrivateChatMessage`, and `subscribeToPrivateChatChanges`.

- [ ] **Step 1: Write failing mapping and validation tests**

```ts
it("maps authorized room rows with creator and members", async () => {
  const result = await fetchPrivateChatRooms({ client });
  expect(result).toEqual({ status: "ok", data: [{
    id: "room-1", name: "Black Belt Team", creatorId: "creator-1",
    createdAt: "2026-07-13T16:00:00.000Z", members: expect.arrayContaining([
      expect.objectContaining({ profileId: "member-1", displayName: "Talia Brooks", role: "student" })
    ])
  }] });
});

it("rejects blank names, rooms without invitees, and duplicate submissions", async () => {
  await expect(createPrivateChatRoom({ name: " ", memberIds: ["member-1"], client })).resolves.toMatchObject({ status: "error" });
  await expect(createPrivateChatRoom({ name: "Team", memberIds: [], client })).resolves.toMatchObject({ status: "error" });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/supabasePrivateLiveChat.test.ts`

Expected: FAIL because `supabasePrivateLiveChat` does not exist.

- [ ] **Step 3: Implement types, row mappers, validation, and fetch operations**

Use explicit snake_case row types and camelCase UI types. Return the existing discriminated result shape: `{status: "ok", data}`, `{status: "unavailable", message}`, or `{status: "error", message}`. Normalize names with `trim()`, enforce 80 characters, deduplicate member IDs, and share the existing backend-inactive classification.

- [ ] **Step 4: Run focused tests GREEN**

Run: `npx vitest run src/supabasePrivateLiveChat.test.ts -t "maps|rejects"`

Expected: PASS.

- [ ] **Step 5: Write failing RPC and message-operation tests**

Assert exact RPC names/arguments, `delete_private_chat_room` for creator deletion, `.insert({ room_id, sender_id, body })` for messages, chronological fetch ordering, and clean failure messages. Test that the adapter never supplies creator IDs from UI input.

- [ ] **Step 6: Implement RPC and message operations**

Keep creator authorization server-side. `createPrivateChatRoom` calls `create_private_chat_room` with `{ room_name, invited_profile_ids }`; update calls `update_private_chat_room`; delete calls `delete_private_chat_room`; leave calls `leave_private_chat_room`. Fetch/send messages use `private_chat_messages`, relying on RLS.

- [ ] **Step 7: Write failing subscription tests, then implement subscriptions**

Cover INSERT/UPDATE/DELETE on rooms/members and INSERT on messages. Use unique channel names, set realtime auth before subscribing, route payloads through typed callbacks, and guarantee idempotent cleanup through `removeChannel`.

- [ ] **Step 8: Run adapter suite and commit**

Run: `npx vitest run src/supabasePrivateLiveChat.test.ts src/supabaseLiveChat.test.ts`

Expected: PASS with existing shared chat tests unchanged.

```powershell
git add src/supabasePrivateLiveChat.ts src/supabasePrivateLiveChat.test.ts
git commit -m "feat: add private live chat adapter"
```

### Task 3: Accessible room creation and management dialogs

**Files:**
- Create: `src/PrivateLiveChatDialogs.tsx`
- Create: `src/PrivateLiveChatDialogs.test.tsx`
- Modify: `src/styles.css:7572-7695,8250-8285,23939-24070`

**Interfaces:**
- Consumes: `PrivateChatInvitee`, `PrivateChatRoom` from Task 2.
- Produces: `CreatePrivateRoomDialog` and `ManagePrivateRoomDialog` with controlled async callbacks.

- [ ] **Step 1: Write failing creation-dialog tests**

Render the controlled dialog and assert: dialog name `Create chat room`; required name input; searchable active accounts with role labels; selection by checkbox; disabled create for blank name/no invitee/pending state; input retained and alert shown on rejected save; Escape/cancel returns focus to the trigger.

- [ ] **Step 2: Run dialog tests RED**

Run: `npx vitest run src/PrivateLiveChatDialogs.test.tsx`

Expected: FAIL because the component file does not exist.

- [ ] **Step 3: Implement the creation dialog**

Expose:

```ts
type CreatePrivateRoomDialogProps = {
  open: boolean;
  invitees: PrivateChatInvitee[];
  isLoadingInvitees: boolean;
  error: string;
  onClose: () => void;
  onCreate: (input: { name: string; memberIds: string[] }) => Promise<void>;
};
```

Use the app's existing modal/focus conventions, case-insensitive filtering, semantic checkboxes, `aria-live`/`role="alert"`, and no local persistence.

- [ ] **Step 4: Run creation tests GREEN**

Run: `npx vitest run src/PrivateLiveChatDialogs.test.tsx -t "create"`

Expected: PASS.

- [ ] **Step 5: Write failing creator-management and member-leave tests**

Assert creators can edit name/member selection, cannot deselect themselves, see delete with a second confirmation, and submit one atomic update. Assert non-creators see member list plus Leave Room only. Confirm all destructive actions require explicit confirmation and disable during pending requests.

- [ ] **Step 6: Implement management dialog and confirmation states**

Expose creator status explicitly and do not infer authorization from role:

```ts
type ManagePrivateRoomDialogProps = {
  open: boolean;
  room: PrivateChatRoom;
  currentProfileId: string;
  invitees: PrivateChatInvitee[];
  error: string;
  onClose: () => void;
  onUpdate: (input: { name: string; memberIds: string[] }) => Promise<void>;
  onDelete: () => Promise<void>;
  onLeave: () => Promise<void>;
};
```

- [ ] **Step 7: Style compact responsive dialogs and Create Room action**

Add `.live-chat-create-room-button` with the existing app green token/gradient, clear hover/focus/disabled states, and a non-shrinking position after the scrollable tab region. Add member-picker rows, role badges, confirmation panel, and mobile rules without changing shared tab dimensions.

- [ ] **Step 8: Run tests, build, and commit**

Run: `npx vitest run src/PrivateLiveChatDialogs.test.tsx && npm run build`

Expected: PASS; build exits 0.

```powershell
git add src/PrivateLiveChatDialogs.tsx src/PrivateLiveChatDialogs.test.tsx src/styles.css
git commit -m "feat: add private room dialogs"
```

### Task 4: Integrate rooms, membership, and private messages into Live Chat

**Files:**
- Modify: `src/OperationsApp.tsx:4390-5350`
- Modify: `src/App.test.tsx:4357-4715`

**Interfaces:**
- Consumes: Task 2 adapter and Task 3 dialogs.
- Produces: complete private-room workflow inside `LiveChatRoomFrame` for page and profile-embedded variants.

- [ ] **Step 1: Replace the obsolete no-room test with failing Create Room placement tests**

Replace `does not expose local-only custom live chat room creation` with assertions that the green `Create Room` button is the final control after Cho's Room and Mentions, opens `Create chat room`, and does not alter the selected room until server success.

- [ ] **Step 2: Run the focused App test RED**

Run: `npx vitest run src/App.test.tsx -t "Create Room"`

Expected: FAIL because no button exists.

- [ ] **Step 3: Integrate room loading and creation**

Add state for private rooms, active private messages, invitees, pending/error states, and dialogs. Fetch rooms only when authenticated live chat is available. On successful create, append/deduplicate the returned room, select it, clear the dialog, load messages, and subscribe. Place Create Room outside the horizontally scrolling tab list but inside `.live-chat-controls`.

- [ ] **Step 4: Run Create Room test GREEN**

Run: `npx vitest run src/App.test.tsx -t "Create Room"`

Expected: PASS.

- [ ] **Step 5: Write failing room selection, sending, and realtime tests**

Assert selecting a private tab loads only that room's messages, the composer calls `sendPrivateChatMessage`, Cho's Room still calls `sendLiveChatMessage`, duplicate realtime messages are ignored, and removed/deleted rooms immediately fall back to Cho's Room.

- [ ] **Step 6: Implement active-room message routing and subscriptions**

Derive `isPrivateRoom`, route fetch/send by room kind, keep Mentions read-only targeting behavior intact, replace the obsolete `Only Cho's Room is available` branch, and subscribe/clean up when room or session changes. Render the private room's real members in the roster and its name/member count in the header.

- [ ] **Step 7: Write failing manage, leave, delete, and Mentions tests**

Test creator-only Manage Room visibility; update/add/remove success; non-creator Leave Room; delete confirmation; server errors preserving dialog state; and Mentions containing private messages only while the current profile belongs to their room.

- [ ] **Step 8: Implement management actions and authorized Mentions merge**

On successful update replace the room atomically. On removal/leave/delete events, clear private messages, close dialogs, and select `chos-room`. Merge private mention messages with shared mentions by timestamp and never retain messages for rooms no longer present in the authorized room list.

- [ ] **Step 9: Run integration and regression tests**

Run: `npx vitest run src/App.test.tsx -t "live chat|Live Chat|private room|Create Room|Mentions"`

Expected: PASS including existing Cho's Room, student, guardian, profile panel, timestamp, composer, and notification tests.

- [ ] **Step 10: Commit integrated UI**

```powershell
git add src/OperationsApp.tsx src/App.test.tsx
git commit -m "feat: integrate private rooms into live chat"
```

### Task 5: Browser accessibility and responsive verification

**Files:**
- Create: `e2e/private-live-chat-rooms.spec.ts`
- Modify: `src/styles.css` only if browser evidence exposes a layout/accessibility defect.

**Interfaces:**
- Consumes: integrated UI from Task 4.
- Produces: repeatable browser proof for desktop, portrait mobile, keyboard, overflow, and focus restoration.

- [ ] **Step 1: Write the failing browser test**

Test desktop and 390x844 viewports. Verify Create Room stays visible at the far right, tabs scroll without overlapping the action, dialog fields are reachable by Tab, Escape closes, focus returns to Create Room, validation is announced, and a long member list scrolls inside the dialog without hiding actions.

- [ ] **Step 2: Run browser test RED**

Run: `npx playwright test e2e/private-live-chat-rooms.spec.ts`

Expected: FAIL on the first missing or incorrect layout/focus expectation.

- [ ] **Step 3: Make the smallest CSS/component fixes required by browser evidence**

Do not redesign existing Live Chat. Correct only overflow, fixed-action reachability, focus restoration, dialog max-height, and touch target defects demonstrated by the test.

- [ ] **Step 4: Run browser test GREEN and inspect screenshots/traces**

Run: `npx playwright test e2e/private-live-chat-rooms.spec.ts --trace on`

Expected: PASS at both viewports with no clipped Create Room or confirmation controls.

- [ ] **Step 5: Commit browser coverage**

```powershell
git add e2e/private-live-chat-rooms.spec.ts src/styles.css src/PrivateLiveChatDialogs.tsx
git commit -m "test: cover private live chat room UX"
```

### Task 6: Full security, quality, and release verification

**Files:**
- Modify only files implicated by a reproduced failure.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a verified, review-ready feature with exact backend/deployment evidence or an explicit blocker.

- [ ] **Step 1: Run complete automated verification**

```powershell
npx vitest run
npm run build
npx playwright test e2e/private-live-chat-rooms.spec.ts
npx supabase db lint --local
git diff --check
```

Expected: all commands exit 0. If Supabase local runtime is unavailable, preserve the exact error and do not classify policy runtime checks as passed.

- [ ] **Step 2: Review the final diff against the approved spec**

Check creator-only enforcement, non-member history denial, inactive invite rejection, destructive confirmation, notification privacy, realtime cleanup, error-state honesty, keyboard behavior, responsive overflow, and unchanged Cho's Room/Mentions behavior. Reproduce every finding with a failing test before fixing it.

- [ ] **Step 3: Re-run every affected check after fixes**

Expected: focused reproducer and full suite return green; production build remains successful.

- [ ] **Step 4: Verify staging only when the configured project is active and safe**

Inspect the linked project with `npx supabase status` and `npx supabase migration list`. If this repository's Cho staging project is connected and active, run the repository's established migration deployment flow, verify the new migration appears remotely, then use two authorized test accounts plus one non-member account to prove create/invite/message/remove/history denial/delete in the real app. Capture the exact project ref, migration version, deployed commit, URL, and observed access results.

- [ ] **Step 5: Complete the release path if all gates pass**

Commit any verification fixes, push the verified branch according to the repository release workflow, watch CI/deployment to completion, and health-check the live `app-version.json` plus the private-room flow. Stop and report the exact blocker if migration, CI, deployment, or live authorization verification fails.

- [ ] **Step 6: Final status**

Report using the repository-required headings: `Done`, `What changed`, `What I checked`, `Risk`, and `Learning note`. Include exact commands, commit, migration, staging/live URL, and any remaining blocker without claiming unverified success.
