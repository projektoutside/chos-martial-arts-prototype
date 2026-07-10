export interface TestingUpdateNotice {
  id: string;
  version: string;
  date: string;
  title: string;
  changes: readonly string[];
}

export const testingUpdateNotices: readonly TestingUpdateNotice[] = [
  {
    id: "2026-07-10-locked-intro-keyboard-anchor",
    version: "0.1.5",
    date: "July 10, 2026",
    title: "A smoother start and better phone typing",
    changes: [
      "The opening animation now ignores accidental taps until the login controls are completely ready.",
      "The phone typing box now follows the real keyboard edge instead of floating near the middle of the screen.",
      "Long typing boxes grow upward while preserving a comfortable gap above the keyboard."
    ]
  },
  {
    id: "2026-07-10-immersive-mobile-typing",
    version: "0.1.4",
    date: "July 10, 2026",
    title: "A cleaner full-screen phone experience",
    changes: [
      "The Android app now uses the full display and hides the status and navigation bars during normal use.",
      "Typing now opens on a calm, focused background so the logo and login screen do not crowd the text box.",
      "You can temporarily reveal Android system controls with an edge swipe whenever you need them."
    ]
  },
  {
    id: "2026-07-10-android-keyboard-first-tap",
    version: "0.1.3",
    date: "July 10, 2026",
    title: "Phone typing now opens more reliably",
    changes: [
      "Username, password, and other text fields now activate the phone keyboard more reliably on the first tap.",
      "Long messages can be scrolled inside the typing box while the rest of the app stays still.",
      "The floating typing box now closes cleanly when the phone keyboard is dismissed."
    ]
  },
  {
    id: "2026-07-10-stable-mobile-keyboard",
    version: "0.1.2",
    date: "July 10, 2026",
    title: "Typing on phones now stays steady",
    changes: [
      "The app now stays in place when your phone keyboard opens.",
      "A matching text box appears directly above the keyboard so you can always see what you are typing.",
      "The new typing experience works throughout the app without moving menus, pages, or other controls."
    ]
  },
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
