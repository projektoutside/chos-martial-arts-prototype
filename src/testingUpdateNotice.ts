export const testingUpdateNotice = {
  id: "2026-07-10-testing-update-notice",
  date: "July 10, 2026",
  title: "Testing updates are now easier to follow",
  changes: [
    "After you sign in, you will see a short summary when the app has new changes.",
    "You only need to read each update once."
  ]
} as const;

function testingUpdateStorageKey(email: string, noticeId: string) {
  return `chos.testingUpdateSeen.v1:${encodeURIComponent(email.trim().toLowerCase())}:${encodeURIComponent(noticeId)}`;
}

export function hasSeenTestingUpdate(email: string, noticeId = testingUpdateNotice.id) {
  if (!email.trim()) return true;

  try {
    return localStorage.getItem(testingUpdateStorageKey(email, noticeId)) === "seen";
  } catch {
    return false;
  }
}

export function markTestingUpdateSeen(email: string, noticeId = testingUpdateNotice.id) {
  if (!email.trim()) return;

  try {
    localStorage.setItem(testingUpdateStorageKey(email, noticeId), "seen");
  } catch {
    // Storage can be unavailable in private browsing or restrictive environments.
  }
}
