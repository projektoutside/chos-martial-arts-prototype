# Guided Onboarding Product and Engineering Contract

## Status

This contract is mandatory for every authenticated UI and feature change. Codex and human contributors must evaluate it before implementation, preserve it during refactors, and include its checks in release verification.

The product promise is simple: each user receives a clear spotlight explanation for an unfamiliar moderate-complexity feature exactly once, then never sees that same guide again.

## Required user experience

Every guided step must:

1. Start only after authentication. The starter route may send a user to `/profile` once after that user's first successful login for the current role; later logins must preserve the user's chosen landing behavior.
2. Dim the rest of the app and place the spotlight around the exact visible control the user must activate.
3. Show one short title and one short plain-language instruction that explains what the control does.
4. Keep only the highlighted control actionable and focusable. Block unrelated pointer, keyboard, focus, scroll, and background-modal actions while the step is active.
5. Advance only after the highlighted control is activated. Viewing the instruction, clicking the dimmed area, changing routes indirectly, or reloading must not falsely complete the step.
6. Record completion before the required control's normal action runs, so navigation or an immediate reload cannot replay the completed step.
7. Resume at the next unseen eligible step after interruption. It must never replay a completed feature for the same user.

There is no normal Back or Skip action. The user completes the small safe action shown by the guide.

## Which controls require a guide

Add a guide in the same change for any new authenticated control that does one or more of the following:

- opens a feature, tool, workspace, modal, editor, report, filter, or multi-step workflow;
- creates or edits accounts, students, classes, schedules, events, messages, merchandise, settings, rooms, or app content;
- changes a meaningful mode, view, panel, audience, status, or navigation destination;
- exposes manager, staff, developer, parent, or student capability that is not immediately obvious from its label;
- introduces a new feature button that an existing user has not previously encountered.

Simple self-explanatory controls such as Back, decorative toggles, ordinary form fields, and duplicate pagination controls usually do not need their own step. If a close/cancel control is the only safe way to finish a guided modal visit, guide that close/cancel control as the next step.

Never require the final activation of a destructive, financial, message-delivery, logout, permission-grant, or irreversible action. Guide the safe feature entry point and explain the consequence before the user reaches the real confirmation.

## Stable feature identity

Each guided concept has one durable, lowercase ID:

`<audience>.<surface>.<feature>.v<number>`

Examples:

- `staff.launcher.scheduling.v1`
- `parent.add-child.v1`
- `student.profile-settings.v1`
- `shared.live-chat.mentions.v1`

Rules:

- Treat an ID as permanent user-history data after release. Never rename or delete it merely because code, labels, routes, or components were renamed.
- Never reuse an old ID for a different action or meaning.
- Use the same ID for duplicate controls that open the same feature for the same audience. This is how identical guides are deduplicated.
- Use a new ID only for a genuinely new user concept. If the meaning changes enough that returning users need a new explanation, increment the version deliberately, for example `v2`, and document why in the change.
- IDs must match the validation in `src/onboardingProgress.ts`: lowercase letters, digits, dots, underscores, or hyphens; 3 to 120 characters.
- Do not clear, migrate away, or overwrite prior completed IDs during ordinary releases.

## Markup contract

Place the guide metadata on the exact interactive element the user must activate:

```tsx
<button
  type="button"
  data-guided-onboarding-id="staff.feature-name.v1"
  data-guided-onboarding-title="Short feature name"
  data-guided-onboarding-instruction="One sentence explaining exactly what this opens or changes."
  data-guided-onboarding-priority="200"
>
  Feature
</button>
```

All four attributes are required. Keep the instruction short, literal, and action-oriented. Do not use vague copy such as "Click here to continue." The title and instruction must be accurate for the current user's role and visible data.

Priorities determine the order among currently visible unseen controls. Reserve lower values for the primary entry control, then its safe modal continuation or close control, then secondary features. Do not rely on DOM order when a workflow requires a specific sequence.

Use `data-guided-onboarding-defer="true"` on a temporary app state that must finish before the next target can be chosen. Remove it as soon as the required target is stable. When an app modal is open, the guide must consider only eligible controls inside the topmost visible modal.

## Progress and once-only safety

`src/onboardingProgress.ts` is the canonical progress layer.

- Device-local progress is namespaced per normalized signed-in identity.
- Authenticated stable-app progress is also stored as immutable `(user_id, feature_id)` rows in `public.user_onboarding_progress` with owner-only row-level security.
- Loading merges local and remote history. The union is written locally and any missing immutable rows are inserted remotely without deleting old history.
- If authenticated remote history cannot be verified, the guide fails closed and stays hidden. Replaying a possibly completed tutorial is worse than temporarily withholding it.
- The testing/demo variant has no stable backend access and therefore keeps its fake user's progress only in the testing app's isolated local storage.
- Storage failures must not crash the app. An active in-memory step may continue, but code must not intentionally reset history.

Any schema change must preserve existing `(user_id, feature_id)` completion facts, maintain owner-only RLS, and keep clients unable to update or delete completed history.

## Roles, authorization, and state

- Evaluate Manager1, Manager2, and Developer1 as the full manager cohort unless a feature is intentionally narrower.
- Also evaluate staff, parent, and student routes and any shared live-chat, profile, notification, or settings surfaces.
- The guide may target only rendered, visible, enabled, authorized controls. Never reveal or describe a hidden capability through tutorial copy.
- A user sees a shared feature once for that user, even if the same feature appears on multiple routes.
- Route changes, modal transitions, conditional data, responsive navigation, and role-specific launchers must not leave a spotlight pointing at a removed or hidden element.
- Existing specialized tutorials, including first-child parent setup, must use the same one-step, exact-target, no-skip, unrelated-action-locking principles and must not conflict with the global guide.

## Accessibility and responsive behavior

- Move focus to the required interactive target and restore its previous `aria-describedby` value after the step.
- Associate the short instruction with the target, keep the target's accessible name intact, and support Enter or Space when the control normally supports them.
- Keep a minimum 44-by-44-pixel spotlight, readable contrast in dark and light themes, reduced-motion support, and no viewport overflow.
- Verify phone, short-height phone, tablet, and desktop positioning. The coach card must remain on-screen while the spotlight remains aligned during resize, scrolling, keyboard appearance, or layout changes.
- The overlay itself must not steal the required target's action or create an invisible tappable area.

## Required tests for every guided feature change

At minimum, preserve or add coverage proving:

1. the first authenticated session starts on the intended post-login surface only once;
2. the exact target is spotlighted and unrelated pointer and keyboard actions are blocked;
3. the required activation is recorded before its normal handler or navigation runs;
4. remount, reload, route return, and later login do not replay a completed feature;
5. two different users do not share progress;
6. remote history merges with local history and remote read failure fails closed;
7. duplicate controls with one feature ID produce only one completed guide;
8. modal and conditional-target transitions select the correct next visible control;
9. dark/light and mobile/desktop layouts keep the coach card and target usable.

Run focused onboarding tests, the full test suite, the production build, and the applicable Android testing build before publishing. For stable authenticated changes, verify the migration and RLS behavior against the configured Supabase project. For Play testing releases, follow `docs/google-play-closed-testing-runbook.md` and never change the package or private track.

## Canonical implementation map

- `src/GuidedOnboarding.tsx` - target discovery, spotlight, focus/action lock, ordering, and first-login start.
- `src/onboardingProgress.ts` - stable ID validation and local/remote once-only persistence.
- `src/GuidedOnboarding.test.tsx` - interaction, first-start, and no-replay behavior.
- `src/onboardingProgress.test.ts` - identity and feature-ID invariants.
- `src/onboardingProgress.remote.test.ts` - remote merge, immutable insert, and failure behavior.
- `src/OperationsApp.tsx` - authenticated controls and their guide metadata.
- `src/styles.css` - spotlight and coach-mark presentation.
- `supabase/migrations/*user_onboarding_progress*.sql` - immutable remote completion history and RLS.

## Definition of done

A UI or feature change is not complete until its onboarding impact is explicitly handled: the new control is correctly guided, deliberately exempt under this rubric, or reuses the same permanent feature ID because it is truly the same user concept. The final review must confirm that no completed guide can replay for the same user and that no guide can force an unsafe action.
