# Private Room Tab Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let private-room creators choose one of eight accessible tab colors during room creation and change it later, with the choice securely persisted and rendered consistently.

**Architecture:** Store a constrained `tab_color` value on `private_chat_rooms`, pass it through the existing creator-authorized RPC boundary, and expose it through the TypeScript private-chat adapter. Reuse one controlled React radiogroup in both dialogs and let `OperationsApp` render the persisted value through the existing `--live-chat-room-tab-color` CSS variable.

**Tech Stack:** PostgreSQL/Supabase migrations and RPCs, React 19, TypeScript, Vitest, Testing Library, CSS custom properties, Playwright CLI, Vite, Capacitor Android.

## Global Constraints

- Approved palette only: Purple `#8a63f2`, Crimson `#c94b62`, Emerald `#2ea66f`, Ocean `#2f80c9`, Amber `#c58a2a`, Rose `#c25b91`, Teal `#218f91`, Slate `#66758f`.
- Purple `#8a63f2` is the persisted default for existing and newly opened create dialogs.
- Only the private-room creator can change the room color.
- Cho's Room and Mentions retain their current fixed colors.
- Selection must be conveyed by checkmark, outline, named label, and radio semantics rather than color alone.
- Preserve the compact Live Chat tab row and existing dark/light theme behavior.
- Add no dependencies.
- Testing Android remains fake-data-only and must contain no stable-service references.

---

## File Structure

- Create `supabase/migrations/20260713210000_private_chat_room_tab_colors.sql`: persisted column, allowlist constraint, expanded private implementations, public wrappers, and grants.
- Modify `src/supabasePrivateLiveChat.ts`: palette contract, validation, room mapping, and RPC arguments.
- Modify `src/supabasePrivateLiveChat.test.ts`: adapter mapping and mutation coverage.
- Modify `src/PrivateLiveChatDialogs.tsx`: reusable color radiogroup and create/manage state.
- Modify `src/PrivateLiveChatDialogs.test.tsx`: accessible picker and submission behavior.
- Modify `src/OperationsApp.tsx`: pass color through mutations and render persisted room colors.
- Modify `src/App.test.tsx`: integrated tab-style and dialog contract coverage.
- Modify `src/styles.css`: compact swatches, preview, focus, responsive wrapping, and light-theme treatment.

---

### Task 1: Persist and Secure the Approved Room Color

**Files:**
- Create: `supabase/migrations/20260713210000_private_chat_room_tab_colors.sql`

**Interfaces:**
- Consumes: existing `private_chat_rooms`, `private.create_private_chat_room_impl`, `private.update_private_chat_room_impl`, and public security-invoker wrappers.
- Produces: `private_chat_rooms.tab_color text not null`, `public.create_private_chat_room(room_name text, invited_profile_ids uuid[], room_tab_color text)`, `public.update_private_chat_room(room_id uuid, room_name text, invited_profile_ids uuid[], room_tab_color text)`, and `list_private_chat_rooms.tab_color`.

- [ ] **Step 1: Write the migration contract checks first**

Add SQL comments and transactional verification queries to the migration that demonstrate the exact allowlist and wrapper signatures:

```sql
alter table public.private_chat_rooms
  add column if not exists tab_color text not null default '#8a63f2';

alter table public.private_chat_rooms
  add constraint private_chat_rooms_tab_color_allowed
  check (tab_color = any (array[
    '#8a63f2', '#c94b62', '#2ea66f', '#2f80c9',
    '#c58a2a', '#c25b91', '#218f91', '#66758f'
  ]));
```

- [ ] **Step 2: Apply against a disposable/local database and confirm the old RPC output lacks `tab_color` before replacement**

Run: `npx supabase db reset --local`

Expected before the new function definitions execute: the schema change exists, while the previous list function still returns its old declared table shape.

- [ ] **Step 3: Expand the private implementations and public wrappers**

Use one shared validation expression inside create/update implementations:

```sql
if room_tab_color is null or room_tab_color <> all (array[
  '#8a63f2', '#c94b62', '#2ea66f', '#2f80c9',
  '#c58a2a', '#c25b91', '#218f91', '#66758f'
]) then
  raise exception 'Choose an approved room tab color.';
end if;
```

Insert/update `tab_color` only after the existing authenticated-profile and creator checks. Recreate the public wrappers as `security invoker`, revoke execution from `public` and `anon`, and grant only to `authenticated`.

- [ ] **Step 4: Verify migration security and behavior**

Run: `npx supabase db reset --local && npx supabase db lint --local`

Expected: migration succeeds, lint reports no new errors, existing rows read `#8a63f2`, approved colors save, disallowed colors fail, a member cannot update color, and the creator can.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260713210000_private_chat_room_tab_colors.sql
git commit -m "feat: persist private room tab colors"
```

### Task 2: Extend the TypeScript Private-Room Contract

**Files:**
- Modify: `src/supabasePrivateLiveChat.ts`
- Test: `src/supabasePrivateLiveChat.test.ts`

**Interfaces:**
- Produces: `privateChatRoomColorOptions`, `PrivateChatRoomColor`, `defaultPrivateChatRoomColor`, `PrivateChatRoom.tabColor`, and color-aware create/update inputs.
- Consumes: Task 1 RPC parameters `room_tab_color` and result property `tab_color`.

- [ ] **Step 1: Write failing adapter tests**

Add tests asserting:

```ts
expect(result.data?.[0].tabColor).toBe("#2ea66f");
expect(client.rpc).toHaveBeenCalledWith("create_private_chat_room", {
  room_name: "Leadership",
  invited_profile_ids: ["member-1"],
  room_tab_color: "#2f80c9"
});
expect(client.rpc).toHaveBeenCalledWith("update_private_chat_room", {
  room_id: "room-1",
  room_name: "Leadership",
  invited_profile_ids: ["member-1"],
  room_tab_color: "#c94b62"
});
```

Also assert `#ffffff` returns `{ status: "error", message: "Choose an approved room tab color." }` without calling RPC.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/supabasePrivateLiveChat.test.ts`

Expected: FAIL because `tabColor` and `room_tab_color` do not exist yet.

- [ ] **Step 3: Add the typed palette and validation**

```ts
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
```

Add `tabColor` to mapped rooms and accept `{ name, memberIds, tabColor }` in create/update. Validate using `.some(({ value }) => value === tabColor)` and pass `room_tab_color` to RPC.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- src/supabasePrivateLiveChat.test.ts`

Expected: all private-chat adapter tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/supabasePrivateLiveChat.ts src/supabasePrivateLiveChat.test.ts
git commit -m "feat: add private room color contract"
```

### Task 3: Add the Accessible Color Picker to Both Dialogs

**Files:**
- Modify: `src/PrivateLiveChatDialogs.tsx`
- Test: `src/PrivateLiveChatDialogs.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `privateChatRoomColorOptions`, `PrivateChatRoomColor`, and `defaultPrivateChatRoomColor` from Task 2.
- Produces: create/update callbacks shaped as `{ name: string; memberIds: string[]; tabColor: PrivateChatRoomColor }`.

- [ ] **Step 1: Write failing dialog tests**

Assert the create dialog exposes a named radiogroup and eight radios:

```ts
expect(screen.getByRole("radiogroup", { name: "Tab color" })).toBeInTheDocument();
expect(screen.getAllByRole("radio")).toHaveLength(8);
expect(screen.getByRole("radio", { name: "Purple" })).toBeChecked();
await user.click(screen.getByRole("radio", { name: "Emerald" }));
expect(screen.getByText("Room tab preview").nextElementSibling).toHaveStyle({ "--live-chat-room-tab-color": "#2ea66f" });
```

Submit and assert `tabColor: "#2ea66f"`. Render Manage Room with `tabColor: "#2f80c9"`, select Crimson, save, and assert `tabColor: "#c94b62"`. Render as a non-creator and assert no Tab color radiogroup exists.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/PrivateLiveChatDialogs.test.tsx`

Expected: FAIL because the picker and callback field do not exist.

- [ ] **Step 3: Implement `RoomTabColorPicker` and dialog state**

Implement a controlled radiogroup:

```tsx
function RoomTabColorPicker({ value, roomName, onChange }: {
  value: PrivateChatRoomColor;
  roomName: string;
  onChange: (value: PrivateChatRoomColor) => void;
}) {
  return (
    <fieldset className="private-chat-color-picker">
      <legend>Tab color</legend>
      <div className="private-chat-color-options" role="radiogroup" aria-label="Tab color">
        {privateChatRoomColorOptions.map((option) => (
          <label key={option.value} className="private-chat-color-option" style={{ "--private-chat-swatch": option.value } as React.CSSProperties}>
            <input type="radio" name="private-room-tab-color" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span className="private-chat-color-swatch" aria-hidden="true">{value === option.value && <Check size={14} />}</span>
            <span>{option.name}</span>
          </label>
        ))}
      </div>
      <div className="private-chat-tab-preview"><span>Room tab preview</span><strong style={{ "--live-chat-room-tab-color": value } as React.CSSProperties}>{roomName.trim() || "Room name"}</strong></div>
    </fieldset>
  );
}
```

Initialize create state to `defaultPrivateChatRoomColor`; initialize manage state from `room.tabColor`; reset both when their dialog opens or room changes; include `tabColor` in submit payloads.

- [ ] **Step 4: Add compact accessible styles**

Style a wrapping eight-swatch grid with minimum 40px touch targets, visually hidden native radios that remain keyboard focusable, checkmark selection, distinct `:focus-within`, and a tab-shaped preview reusing the existing tab gradient. Add light-theme border/text overrides and a narrow-mobile two-row layout without horizontal overflow.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run: `npm test -- src/PrivateLiveChatDialogs.test.tsx`

Expected: all dialog tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/PrivateLiveChatDialogs.tsx src/PrivateLiveChatDialogs.test.tsx src/styles.css
git commit -m "feat: add private room color picker"
```

### Task 4: Wire Persisted Colors into Live Chat

**Files:**
- Modify: `src/OperationsApp.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: Task 2 `PrivateChatRoom.tabColor` and Task 3 color-aware callback inputs.
- Produces: private tabs whose `--live-chat-room-tab-color` always equals the persisted room color.

- [ ] **Step 1: Write failing integration tests**

Mock a private room with `tabColor: "#218f91"`, render Live Chat, and assert:

```ts
expect(screen.getByRole("tab", { name: "Leadership" })).toHaveStyle({
  "--live-chat-room-tab-color": "#218f91"
});
```

Open Manage Room, choose Amber, save, and assert the adapter receives `tabColor: "#c58a2a"`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because `OperationsApp` still assigns colors by room index.

- [ ] **Step 3: Replace positional color assignment and pass mutation inputs through**

Change the mapping to:

```ts
...privateRooms.map((room) => ({
  id: room.id,
  name: room.name,
  color: room.tabColor,
  invitedMemberIds: room.members.map((member) => member.profileId)
}))
```

Update create/manage handler parameter types and forward `tabColor` unchanged to the adapter.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- src/App.test.tsx`

Expected: integrated Live Chat tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/OperationsApp.tsx src/App.test.tsx
git commit -m "feat: render persisted private room colors"
```

### Task 5: Apply the Hosted Migration and Verify End to End

**Files:**
- No new source files unless verification exposes a defect.

**Interfaces:**
- Consumes: Tasks 1-4 complete behavior.
- Produces: verified staging schema and release-ready application.

- [ ] **Step 1: Run all automated checks**

```bash
npm test
npm run build
npm run build:cloudflare
npm run verify:android:variants
npm run build:android:stable
npm run build:android:testing
npm run verify:demo-artifact
npm audit --audit-level=moderate
git diff --check
```

Expected: 39+ test files pass, both Android bundles build, the demo scan reports no stable-service references, audit reports zero vulnerabilities, and diff check is clean.

- [ ] **Step 2: Apply the migration to Cho staging**

Run the repository's established Supabase migration command against project `zfuwbbepsnmmlpgfkmhz`, then run database lint/advisor checks.

Expected: migration `20260713210000_private_chat_room_tab_colors.sql` is recorded once, RPC grants remain authenticated-only, and no new security findings appear.

- [ ] **Step 3: Deploy a Cloudflare preview and perform browser QA**

Use Playwright CLI against the preview with the existing developer account. Verify:

1. Create Room defaults to Purple and lists eight named colors.
2. Choose Emerald and create a room.
3. Confirm the selected tab is Emerald and remains Emerald after reload.
4. Manage the room, choose Ocean, and save.
5. Confirm the tab changes to Ocean and remains Ocean after reload.
6. Confirm a member view has no color editor.
7. Verify mobile and desktop layouts, keyboard focus, and dark/light themes.
8. Delete the QA room and confirm cleanup.

- [ ] **Step 4: Review for release blockers**

Review the final diff for authorization regression, invalid-color bypass, unreadable text, overflow, unstable color ordering, unrelated changes, and generated artifacts. Fix findings and rerun affected checks.

- [ ] **Step 5: Commit any verification fixes**

```bash
git add supabase/migrations/20260713210000_private_chat_room_tab_colors.sql src/supabasePrivateLiveChat.ts src/supabasePrivateLiveChat.test.ts src/PrivateLiveChatDialogs.tsx src/PrivateLiveChatDialogs.test.tsx src/OperationsApp.tsx src/App.test.tsx src/styles.css
git commit -m "fix: harden private room tab colors"
```

Skip this commit if verification required no code changes.

### Task 6: Publish Main, Cloudflare, and Both Private Play Apps

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: release-ready commit from Task 5.
- Produces: remote `main`, Cloudflare production, stable internal Play update, and testing internal Play update on the same commit.

- [ ] **Step 1: Push the verified HEAD to `origin/main`**

Run: `git push origin HEAD:main`

Expected: fast-forward succeeds and `git ls-remote origin refs/heads/main` equals local HEAD.

- [ ] **Step 2: Verify the main web workflow and deploy Cloudflare production**

Wait for **Verify main web release** to succeed. Build with `GITHUB_REF_NAME=main`, deploy `dist` to Cloudflare Pages branch `main`, and verify `https://chos-martial-arts-operations-app.pages.dev/app-version.json` reports the exact commit and branch `main`.

- [ ] **Step 3: Select unused Android version codes**

Read the latest successful stable/testing workflow inputs and choose the next codes. Based on the last verified release, expected next values are stable code `9` / version `0.1.8` and testing code `3` / version `0.1.2-testing`; increment if Play already contains either code.

- [ ] **Step 4: Dispatch and monitor both private internal releases**

Run `release-android-stable.yml` and `release-android-testing.yml` from `main` with concise room-color release notes. Confirm authentication, tests, signing, build, artifact upload, demo isolation, and **Upload to private Play internal testing** all succeed.

- [ ] **Step 5: Record exact release evidence**

Capture the commit SHA, Cloudflare immutable deployment URL, production version response, stable/testing GitHub run IDs, AAB artifact names, package IDs, version names/codes, and internal-track success. Confirm the worktree is clean.
