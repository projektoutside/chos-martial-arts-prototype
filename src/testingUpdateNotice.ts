export interface TestingUpdateNotice {
  id: string;
  version: string;
  date: string;
  title: string;
  changes: readonly string[];
}

export const testingUpdateNotices: readonly TestingUpdateNotice[] = [
  {
    id: "2026-07-10-testing-update-notice",
    version: "0.1.1",
    date: "July 10, 2026",
    title: "Testing updates are now easier to follow",
    changes: [
      "After you sign in, you will see a short summary when the app has new changes.",
      "You only need to read each update once.",
      "Profile Settings now has a View App Updates button so you can reopen this update list later."
    ]
  }
];

export const testingUpdateNotice = testingUpdateNotices[0];

function testingUpdateStorageKey(email: string, noticeId: string) {
  return `chos.testingUpdateSeen.v1:${encodeURIComponent(email.trim().toLowerCase())}:${encodeURIComponent(noticeId)}`;
}

export function hasSeenTestingUpdate(email: string, noticeId: string = testingUpdateNotice.id) {
  if (!email.trim()) return true;

  try {
    return localStorage.getItem(testingUpdateStorageKey(email, noticeId)) === "seen";
  } catch {
    return false;
  }
}

export function markTestingUpdateSeen(email: string, noticeId: string = testingUpdateNotice.id) {
  if (!email.trim()) return;

  try {
    localStorage.setItem(testingUpdateStorageKey(email, noticeId), "seen");
  } catch {
    // Storage can be unavailable in private browsing or restrictive environments.
  }
}
