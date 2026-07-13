# Private Live Chat Rooms Design

**Date:** 2026-07-13

## Goal

Add secure private group rooms to the existing Live Chat panel. Any active Cho's account can create a room and invite active managers, staff, students, or parents/guardians. Only the room creator can manage the room. Existing Cho's Room and Mentions behavior must remain unchanged.

## User experience

- Place a green `Create Room` button at the far right of the room-tab row containing `Cho's Room` and `Mentions`.
- Opening the button shows a dialog with a required room name and a searchable account picker. Results show each active account's display name and role.
- The creator selects at least one invitee. The creator is added automatically and cannot be removed.
- After a successful save, the new room appears in the room tabs and opens immediately.
- A private-room header shows its name and member count.
- Only the creator sees room-management controls. These allow renaming the room, adding members, removing members, and permanently deleting the room.
- Deletion requires explicit confirmation and removes the room for every member.
- Invited members can leave after confirmation but cannot rename the room, manage other members, or delete it.
- Removed and departed members immediately lose access to the room and its complete message history.
- Cho's Room and Mentions cannot be renamed, left, or deleted.
- Room tabs scroll horizontally on narrow screens while the Create Room action remains reachable. Dialogs and controls support keyboard operation, visible focus, appropriate labels, and touch-friendly sizing.

## Architecture

Use dedicated normalized Supabase tables for private rooms, room memberships, and private-room messages. Do not store private rooms in the shared application-state record and do not model them as direct messages.

The application adds a focused private-room data adapter beside the existing live-chat adapter. It owns room discovery, creation, membership changes, room updates, deletion, message loading/sending, and realtime subscriptions. The Live Chat component consumes this adapter and combines authorized private rooms with the two existing built-in tabs.

## Data model

### Private rooms

Each room stores an immutable ID, normalized non-empty name, creator profile ID, and created/updated timestamps. The creator must reference an active Cho's profile.

### Memberships

Each membership links one room to one active profile and records its creation time. The room/profile pair is unique. Room creation inserts the creator membership automatically in the same transaction. The creator membership cannot be removed.

### Messages

Each message links to a private room and active sender profile and stores the message body and timestamp. Messages are deleted with their room. Existing Cho's Room messages remain in their current storage path.

Database functions or transactional RPCs will be used where a multi-step operation must be atomic, especially room creation and creator-authorized membership changes.

## Authorization and privacy

Supabase row-level security is the authoritative access boundary:

- Active members can discover and read only rooms where they have a membership.
- Active members can read and send messages only within those rooms.
- Only the recorded creator can rename a room, add members, remove non-creator members, or delete the room.
- A non-creator member can remove only their own membership to leave.
- Removed members cannot read historical messages through direct API calls.
- Inactive or missing profiles cannot be invited or send messages.
- Policies prevent duplicate memberships and any attempt to remove the creator membership.

UI visibility is a convenience and must not substitute for database enforcement.

## Realtime and notifications

Subscribe only to rooms and messages visible to the signed-in profile. Room creation, membership changes, departures, deletion, and new messages update without requiring a page refresh.

Private-room messages follow the existing Live Chat notification preference. A private-room `@mention` is eligible for the existing Mentions experience only when the viewing user is currently a member of that room. Notification text identifies the sender and private room without exposing message content to non-members.

## Error handling

- Disable duplicate submissions while an operation is pending.
- Keep dialog input intact when a save fails and show a plain-language error near the failed action.
- Change the visible room or membership state only after confirmed server success, or roll back an optimistic update on failure.
- If the active user loses membership, move them safely to Cho's Room and remove the private room from the interface.
- If a selected invitee becomes inactive before submission, reject that invite cleanly and refresh the available account list.
- Empty names, whitespace-only messages, duplicate members, unauthorized changes, and stale room operations fail safely.

## Testing and verification

Use test-driven development for each behavior. Coverage includes:

- Create Room placement, styling, dialog semantics, validation, search, and role labels.
- Successful creation and immediate room selection.
- Creator-only rename, add, remove, and delete controls.
- Member leave behavior and confirmation flows.
- Database policy tests proving non-members cannot discover rooms or read/send messages.
- Creator protection, duplicate membership prevention, inactive-profile rejection, and atomic creation.
- Realtime room, membership, deletion, and message updates.
- Private-room message rendering, sending, and authorized Mentions filtering.
- Safe fallback to Cho's Room after removal, departure, or deletion.
- Responsive tab behavior, keyboard navigation, focus handling, and accessible labels.
- Regression coverage for Cho's Room, Mentions, existing notifications, and profile-embedded Live Chat.

Run focused tests during development, then the complete relevant test suite, lint/format checks where configured, TypeScript checking, a production build, migration validation, and an end-to-end browser pass. If a connected staging Supabase project is available and safe, apply and verify the migration and feature there before any deployment claim.

## Release safety

Preserve unrelated worktree changes. Review the final diff for privacy leaks, authorization gaps, destructive cascades, notification exposure, accessibility regressions, and mobile layout issues. Do not ship if policy verification or the production build fails. Production deployment must follow the repository's existing verified release path and include a post-deploy health check.

## Acceptance criteria

1. Every active Cho's account can create a named private room with one or more active invitees.
2. Only current members can discover, open, read, or send messages in that room.
3. Only the creator can rename the room, add or remove members, or permanently delete it.
4. Members can leave but cannot manage the room.
5. Access disappears immediately after removal, departure, or deletion.
6. Private-room messages and authorized mentions update in realtime and respect notification preferences.
7. Cho's Room and Mentions continue working exactly as before.
8. The feature is accessible, responsive, fully tested, and verified against the available backend environment.
