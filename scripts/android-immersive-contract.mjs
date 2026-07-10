import assert from "node:assert/strict";

export function assertImmersiveMainActivity(source) {
  assert.match(source, /WindowCompat\.setDecorFitsSystemWindows\(getWindow\(\),\s*false\)/, "MainActivity must draw edge-to-edge");
  assert.match(source, /WindowInsetsControllerCompat\.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/, "MainActivity must use transient swipe system bars");
  assert.match(source, /controller\.hide\(WindowInsetsCompat\.Type\.systemBars\(\)\)/, "MainActivity must hide status and navigation bars");
  assert.match(source, /onWindowFocusChanged\s*\(/, "MainActivity must restore immersive mode when window focus returns");
  assert.match(source, /onResume\s*\(/, "MainActivity must restore immersive mode when the app resumes");
}

export function assertImmersiveTheme(source) {
  assert.match(source, /<item name="android:windowFullscreen">true<\/item>/, "Android theme must start fullscreen");
  assert.match(source, /<item name="android:statusBarColor">@android:color\/transparent<\/item>/, "Status bar must be transparent during transient reveals");
  assert.match(source, /<item name="android:navigationBarColor">@android:color\/transparent<\/item>/, "Navigation bar must be transparent during transient reveals");
}
