export type AppThemeMode = "dark" | "light";

export const appThemeStorageKey = "chos.theme.v1";
export const defaultAppTheme: AppThemeMode = "dark";

export function isAppThemeMode(value: unknown): value is AppThemeMode {
  return value === "dark" || value === "light";
}

export function readStoredAppTheme(): AppThemeMode {
  if (typeof window === "undefined") return defaultAppTheme;
  try {
    const saved = window.localStorage.getItem(appThemeStorageKey);
    return isAppThemeMode(saved) ? saved : defaultAppTheme;
  } catch {
    return defaultAppTheme;
  }
}

export function applyAppTheme(theme: AppThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function writeStoredAppTheme(theme: AppThemeMode) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(appThemeStorageKey, theme);
    } catch {
      // Theme still applies for the current session when localStorage is blocked.
    }
  }
  applyAppTheme(theme);
}

export function initializeAppTheme() {
  applyAppTheme(readStoredAppTheme());
}
