# Private Room Tab Colors Design

## Goal

Allow the creator of a private live-chat room to choose an accessible tab color when creating the room and change that color later from Manage Room. The interaction must remain compact, obvious, responsive, and consistent with the existing Cho's Live Chat interface.

## User Experience

The Create Room and creator-only Manage Room dialogs add a **Tab color** field directly beneath **Room name**. It contains eight compact circular color swatches drawn from the existing Live Chat visual language. Every swatch has a readable color name, an accessible radio label, and a selected state with a checkmark and stronger outline.

The palette is:

- Purple `#8a63f2` (default)
- Crimson `#c94b62`
- Emerald `#2ea66f`
- Ocean `#2f80c9`
- Amber `#c58a2a`
- Rose `#c25b91`
- Teal `#218f91`
- Slate `#66758f`

Choosing a swatch updates a compact live preview reading **Room tab preview** with the current room name and selected color. The room is not persisted until the user chooses Create Room or Save Changes. Cancel and Escape discard unsaved color changes.

Existing private rooms receive Purple as their persisted default. Cho's Room and Mentions keep their current fixed colors.

## Authorization

Only the room creator can choose or change the room color. Members can see the resulting tab color but cannot edit it. The database update function validates creator ownership in the same transaction that updates the room name and membership.

## Data Model and API

Add a non-null `tab_color` column to `private_chat_rooms` with default `#8a63f2` and a database constraint limiting values to the approved eight-color palette.

The private-room listing RPC returns `tab_color`. The create and update RPC contracts accept `room_tab_color`, validate it against the same allowlist, and persist it. Existing security-invoker public wrappers continue delegating to private implementation functions; their signatures are expanded without weakening grants or row-level security.

The TypeScript adapter adds `tabColor` to `PrivateChatRoom`. Create and update input validation rejects values outside the exported approved palette before sending an RPC. UI callers pass the selected color with the room name and member IDs.

## Components

Create a focused `RoomTabColorPicker` component inside the existing private-room dialog module. It owns no persistence; it receives the selected color, room-name preview, and change callback. Both Create Room and Manage Room reuse it.

`OperationsApp` stops assigning private-room colors by array position and instead uses each room's persisted `tabColor`. This prevents colors from changing when rooms are added, removed, or reordered.

## Styling and Accessibility

The picker uses a semantic radiogroup with one radio per named color. Visual swatches remain large enough for touch input and wrap cleanly on narrow mobile screens. Selection is conveyed by checkmark, outline, text, and `aria-checked`, not color alone.

The preview reuses the existing room-tab shape, typography, gradients, and CSS custom property. White tab text must retain sufficient contrast over every approved color in dark and light themes. Focus-visible outlines remain distinct from the selected outline.

## Error Handling

- Invalid or missing client colors are rejected with a clear validation error.
- Invalid RPC colors raise a database validation exception.
- Existing rooms always load with the database default, so the UI never needs a random fallback.
- Failed saves keep the dialog open and preserve the user's current selection for retry.

## Verification

- Adapter tests cover color mapping, create/update parameters, default selection, and invalid-color rejection.
- Dialog tests cover eight named options, selection, preview updates, create submission, edit submission, and member read-only behavior.
- SQL checks cover the new column, allowlist constraint, listing output, creator-only updates, and wrapper grants.
- Full Vitest, production web build, Cloudflare build, stable Android build, testing Android build, dependency audit, and diff checks must pass.
- Browser QA covers create with a non-default color, persisted tab rendering, changing the color, reload persistence, creator management, mobile layout, and deletion cleanup.

## Release Scope

After verification, commit and push `main`, deploy the production Cloudflare Pages app, and publish the next private internal Google Play stable and testing updates using unused version codes. The testing Android variant remains fake-data-only and cannot contact stable Supabase services.
