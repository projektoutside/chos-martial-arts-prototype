# Testing Update Notices

Every testing-phase app change must add a new entry to `src/testingUpdateNotice.ts` before publishing.

For each release:

1. Prepend a new entry to `testingUpdateNotices`; keep older entries unchanged so the history remains complete.
2. Give the entry a new date-and-topic `id`, the new app version, a readable date, and a short title.
3. Add two to four simple, user-facing bullets describing what people can now do, find, or expect. Do not mention code, bugs, commits, APIs, databases, or internal implementation details.
4. Sign in as a fresh tester and confirm the newest popup appears with the new version.
5. Select **Got it**, sign in again, and confirm the same notice does not repeat.
6. Open **Profile Settings → View App Updates** and confirm the new entry is first while older entries are still present.
7. Include the notice file and these checks in the release review.
