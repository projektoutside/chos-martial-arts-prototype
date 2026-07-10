# Testing Update Notices

Every testing-phase app change must update `src/testingUpdateNotice.ts` before publishing.

1. Change the notice `id` to a new date-and-topic value.
2. Update the date, short title, and two to four user-facing bullets.
3. Say what users can now do, find, or expect. Do not mention code, bugs, commits, APIs, databases, or internal version numbers.
4. Sign in as a fresh tester and confirm the popup appears.
5. Select **Got it**, sign in again, and confirm it does not repeat.
6. Include the notice file and this check in the release review.
