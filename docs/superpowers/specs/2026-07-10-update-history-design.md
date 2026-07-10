# Update History Design

## Purpose

Give every signed-in user a simple way to reopen and review all testing-phase app updates from Profile Settings, while keeping the existing one-time post-login notice.

## User experience

- Every profile settings dialog includes a **View App Updates** button.
- The button is available for manager, staff, student, and parent users.
- Clicking it opens an accessible update history dialog without leaving Profile Settings.
- Updates are ordered newest first.
- Each update shows a plain-language app version, date, title, and short change list.
- The history dialog can be closed with its close button, Escape, or click-away.
- The existing login notice shows the newest history entry and continues to remember acknowledgement per user.

## Data model

The dedicated update module becomes the single source of truth and exports:

- \`testingUpdateNotices\`: newest-first entries with \`id\`, \`version\`, \`date\`, \`title\`, and \`changes\`.
- \`testingUpdateNotice\`: compatibility alias for the newest entry used by the login notice.
- Existing acknowledgement helpers keyed by user email and notice ID.

Future releases add one new entry at the top and update the maintenance guide. Older entries remain available in the history dialog.

## Component boundaries

- \`src/testingUpdateNotice.ts\` owns update content, version labels, ordering, and acknowledgement storage.
- \`src/TestingUpdateHistoryDialog.tsx\` renders the reusable accessible history dialog.
- \`src/App.tsx\` uses the newest entry for the post-login notice.
- \`src/OperationsApp.tsx\` adds the same **View App Updates** trigger to each role's profile settings dialog.
- \`src/styles.css\` provides compact shared history styling.

## Accessibility and resilience

- Dialogs use \`role="dialog"\`, \`aria-modal="true"\`, and clear labels.
- Buttons have explicit labels and keyboard support.
- If update data is unavailable, the app remains usable and the history shows a simple empty state.
- No developer-only details appear in user-facing copy.

## Verification

Tests will confirm the newest entry drives the login notice, history entries render newest first with version/date labels, and each role's Profile Settings dialog exposes the update-history button.

## Maintenance

Future changes must add a new user-facing entry with a new version and date to \`src/testingUpdateNotice.ts\`. The old entries must remain in the list. The maintenance guide will explain the simple wording rules and verification steps.

