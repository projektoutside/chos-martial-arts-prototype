import type { AccountRole, ManagedAccount, ManagerAccessKey } from "./types";
import { isDeveloperAccountEnabled, prototypeDeveloperLogin, prototypeManagerLogin } from "./utils";
import { resolveAppEnvironment } from "./appEnvironment";

type SupabasePasswordResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: {
    id: string;
    email?: string;
  };
};

type SupabaseProfileResponse = {
  id: string;
  username: string;
  contact_email: string | null;
  display_name: string;
  role: AccountRole;
  status: "active" | "inactive";
  phone: string | null;
  title: string | null;
  notes: string | null;
  access: ManagerAccessKey[] | null;
  student_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type SupabaseStoredSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
  projectRef?: string;
  authEmail?: string;
};

type SupabaseLoginResult =
  | { status: "not-configured" }
  | { status: "invalid" }
  | { status: "inactive" }
  | { status: "backend-inactive"; message: string }
  | { status: "error"; message: string }
  | { status: "authenticated"; sessionEmail: string; role: AccountRole; profile: SupabaseProfileResponse };

type SupabaseCreateAccountInput = {
  displayName: string;
  username: string;
  password: string;
  role: AccountRole;
  status?: ManagedAccount["status"];
  email: string;
  phone?: string;
  title?: string;
  notes?: string;
  access?: ManagerAccessKey[];
  studentId?: string;
};

type SupabaseCreateAccountResult =
  | { status: "not-configured" }
  | { status: "ok" }
  | { status: "error"; message: string };

export type SupabasePasswordChangeResult =
  | { status: "not-configured" }
  | { status: "session-expired"; message: string }
  | { status: "ok" }
  | { status: "error"; message: string };

export type SupabaseProfileOnboarding = {
  username: string;
  displayName: string;
  role: AccountRole;
  status: "active" | "inactive";
  isOwner: boolean;
  welcomeSeenAt: string | null;
};

type ProfileOnboardingResult =
  | { ok: true; profile: SupabaseProfileOnboarding }
  | { ok: false; reason: "session" | "profile" | "network"; message: string };

type AcknowledgeWelcomeResult =
  | { ok: true; welcomeSeenAt: string }
  | { ok: false; reason: "session" | "profile" | "network"; message: string };

const supabaseSessionStorageKey = "chos.supabase.auth.v1";
const managerUsername = prototypeManagerLogin.username.toLowerCase();
const supabaseAccountAuthDomain = "accounts.chosmartialarts.app";
const managerSessionRequiredMessage = "Sign into the Supabase Manager123 owner account before syncing created accounts.";
const mongTengSupabaseProjectRef = "jqvclzlvrhdcsfhhvekr";
const forbiddenSupabaseProjectRefs = new Set([mongTengSupabaseProjectRef]);
export const supabaseBackendInactiveMessage = "Cho staging Supabase is inactive or unreachable. Unpause the Supabase project, then try again.";
const supabaseBackendInactivePattern = /(?:inactive|paused|suspended|project\s+(?:is\s+)?not\s+(?:active|found)|project.*does\s+not\s+exist|no\s+such\s+host|failed\s+to\s+fetch|networkerror|dns)/i;
const supabaseUnavailableHttpStatuses = new Set([502, 503, 504, 521, 522, 523, 524]);

class SupabaseBackendInactiveError extends Error {
  constructor() {
    super(supabaseBackendInactiveMessage);
    this.name = "SupabaseBackendInactiveError";
  }
}

function supabaseUrl() {
  return resolveAppEnvironment(import.meta.env).supabaseUrl;
}

function supabasePublicKey() {
  return resolveAppEnvironment(import.meta.env).supabasePublicKey;
}

async function readSupabaseResponseText(response: Response) {
  try {
    return await response.clone().text();
  } catch {
    return "";
  }
}

export function isSupabaseBackendInactiveError(error: unknown) {
  if (error instanceof SupabaseBackendInactiveError) return true;
  const message = error instanceof Error ? error.message : supabaseErrorLikeText(error);
  return supabaseBackendInactivePattern.test(message);
}

function supabaseErrorLikeText(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const errorLike = error as { code?: unknown; error?: unknown; message?: unknown; status?: unknown; statusText?: unknown };
    return [errorLike.status, errorLike.statusText, errorLike.code, errorLike.error, errorLike.message]
      .filter((value): value is number | string => typeof value === "number" || typeof value === "string")
      .join(" ");
  }
  return String(error ?? "");
}

export async function isSupabaseBackendInactiveResponse(response: Response) {
  const body = await readSupabaseResponseText(response);
  const responseText = `${response.status} ${response.statusText} ${body}`;
  return supabaseUnavailableHttpStatuses.has(response.status) || supabaseBackendInactivePattern.test(responseText);
}

export function supabaseProjectRefFromUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.endsWith(".supabase.co") ? hostname.split(".")[0] : undefined;
  } catch {
    return undefined;
  }
}

function supabaseSessionProjectScope() {
  const url = supabaseUrl().replace(/\/+$/, "");
  return supabaseProjectRefFromUrl(url) ?? url.toLowerCase();
}

export function isChoSupabaseProjectUrlAllowed(url: string) {
  const projectRef = supabaseProjectRefFromUrl(url);
  return !projectRef || !forbiddenSupabaseProjectRefs.has(projectRef);
}

export function getSupabaseBrowserConfig() {
  const url = supabaseUrl();
  if (!isChoSupabaseProjectUrlAllowed(url)) {
    return {
      url: "",
      publicKey: ""
    };
  }

  return {
    url,
    publicKey: supabasePublicKey()
  };
}

export function isSupabaseAuthConfigured() {
  if (import.meta.env.MODE === "test" && import.meta.env.VITE_ENABLE_SUPABASE_IN_TESTS !== "true") return false;
  const { url, publicKey } = getSupabaseBrowserConfig();
  return Boolean(url && publicKey);
}

export function normalizeSupabaseUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

export function supabaseAuthEmailForUsername(username: string) {
  const normalizedUsername = normalizeSupabaseUsername(username);
  if (normalizedUsername === managerUsername) return `manager123@${supabaseAccountAuthDomain}`;
  return `${normalizedUsername}@${supabaseAccountAuthDomain}`;
}

export function isSupportedSupabaseLoginUsername(username: string) {
  const normalizedUsername = normalizeSupabaseUsername(username);
  if (!normalizedUsername || normalizedUsername.endsWith(".child")) return false;
  if (normalizedUsername === prototypeDeveloperLogin.username.toLowerCase()) return isDeveloperAccountEnabled();
  return true;
}

function saveSupabaseAuthSession(response: SupabasePasswordResponse) {
  if (!response.access_token || !response.user?.id) return;
  const expiresAt = response.expires_at ? response.expires_at * 1000 : Date.now() + Math.max(1, response.expires_in ?? 3600) * 1000;
  const storedSession: SupabaseStoredSession = {
    accessToken: response.access_token,
    expiresAt,
    userId: response.user.id,
    projectRef: supabaseSessionProjectScope(),
    authEmail: response.user.email?.trim().toLowerCase()
  };
  window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify(storedSession));
}

export function clearSupabaseAuthSession() {
  window.localStorage.removeItem(supabaseSessionStorageKey);
}

export function readSupabaseAuthSession() {
  const rawSession = window.localStorage.getItem(supabaseSessionStorageKey);
  if (!rawSession) return undefined;
  try {
    const parsed = JSON.parse(rawSession) as SupabaseStoredSession;
    if (!parsed.accessToken || parsed.expiresAt <= Date.now() + 10000 || parsed.projectRef !== supabaseSessionProjectScope()) {
      clearSupabaseAuthSession();
      return undefined;
    }
    return parsed;
  } catch {
    clearSupabaseAuthSession();
    return undefined;
  }
}

async function callProfileRpc(path: string) {
  const session = readSupabaseAuthSession();
  if (!session) return { response: undefined, reason: "session" as const };
  try {
    const response = await fetch(`${supabaseUrl().replace(/\/+$/, "")}/rest/v1/rpc/${path}`, {
      method: "POST",
      headers: {
        apikey: supabasePublicKey(),
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    return { response };
  } catch {
    return { response: undefined, reason: "network" as const };
  }
}

export async function fetchSupabaseProfileOnboarding(): Promise<ProfileOnboardingResult> {
  const result = await callProfileRpc("get_my_profile_onboarding");
  if (!result.response) {
    return { ok: false, reason: result.reason ?? "network", message: result.reason === "session" ? "Your session has expired." : "Could not load your account." };
  }
  if (!result.response.ok) return { ok: false, reason: "profile", message: "Could not load your account." };
  const rows = await result.response.json() as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row || typeof row.username !== "string" || typeof row.display_name !== "string" || !["staff", "student", "guardian"].includes(String(row.role)) || !["active", "inactive"].includes(String(row.status)) || typeof row.is_owner !== "boolean" || !(row.welcome_seen_at === null || typeof row.welcome_seen_at === "string")) {
    return { ok: false, reason: "profile", message: "Your account profile is incomplete." };
  }
  return { ok: true, profile: { username: row.username, displayName: row.display_name, role: row.role as AccountRole, status: row.status as "active" | "inactive", isOwner: row.is_owner, welcomeSeenAt: row.welcome_seen_at as string | null } };
}

export async function acknowledgeSupabaseWelcome(): Promise<AcknowledgeWelcomeResult> {
  const result = await callProfileRpc("acknowledge_my_welcome");
  if (!result.response) return { ok: false, reason: result.reason ?? "network", message: "Could not save your welcome progress." };
  if (!result.response.ok) return { ok: false, reason: "profile", message: "Could not save your welcome progress." };
  const rows = await result.response.json() as Array<{ welcome_seen_at?: unknown }>;
  const timestamp = rows[0]?.welcome_seen_at;
  return typeof timestamp === "string"
    ? { ok: true, welcomeSeenAt: timestamp }
    : { ok: false, reason: "profile", message: "Could not save your welcome progress." };
}

async function fetchSupabaseProfile(userId: string, accessToken: string) {
  const url = new URL(`${supabaseUrl().replace(/\/+$/, "")}/rest/v1/profiles`);
  url.searchParams.set("select", "id,username,contact_email,display_name,role,status,phone,title,notes,access,student_id,created_by,created_at");
  url.searchParams.set("id", `eq.${userId}`);

  const response = await fetch(url, {
    headers: {
      apikey: supabasePublicKey(),
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    if (await isSupabaseBackendInactiveResponse(response)) throw new SupabaseBackendInactiveError();
    return undefined;
  }
  const profiles = (await response.json()) as SupabaseProfileResponse[];
  return profiles[0];
}

function sessionEmailForProfile(profile: SupabaseProfileResponse) {
  const normalizedUsername = normalizeSupabaseUsername(profile.username);
  if (normalizedUsername === managerUsername) return prototypeManagerLogin.email;
  if (normalizedUsername === prototypeDeveloperLogin.username.toLowerCase()) return prototypeDeveloperLogin.email;
  return profile.username;
}

export async function signInSupabaseAccount(credentials: { username: string; password: string }): Promise<SupabaseLoginResult> {
  if (!isSupabaseAuthConfigured()) return { status: "not-configured" };

  const cleanedInput = credentials.username.trim();
  const username = normalizeSupabaseUsername(cleanedInput);
  const password = credentials.password.trim();
  if (!username || !password) return { status: "invalid" };
  if (!isSupportedSupabaseLoginUsername(cleanedInput)) return { status: "invalid" };

  const authEmail = cleanedInput.includes("@") ? cleanedInput.toLowerCase() : supabaseAuthEmailForUsername(username);
  const tokenUrl = `${supabaseUrl().replace(/\/+$/, "")}/auth/v1/token?grant_type=password`;

  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        apikey: supabasePublicKey(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: authEmail, password })
    });

    if (!tokenResponse.ok) {
      if (await isSupabaseBackendInactiveResponse(tokenResponse)) return { status: "backend-inactive", message: supabaseBackendInactiveMessage };
      return { status: "invalid" };
    }

    const session = (await tokenResponse.json()) as SupabasePasswordResponse;
    if (!session.access_token || !session.user?.id) return { status: "invalid" };

    const profile = await fetchSupabaseProfile(session.user.id, session.access_token);
    if (!profile) return { status: "invalid" };
    if (profile.status !== "active") return { status: "inactive" };
    if (normalizeSupabaseUsername(profile.username) !== username) return { status: "invalid" };

    saveSupabaseAuthSession(session);
    return {
      status: "authenticated",
      sessionEmail: sessionEmailForProfile(profile),
      role: profile.role,
      profile
    };
  } catch (error) {
    if (isSupabaseBackendInactiveError(error)) return { status: "backend-inactive", message: supabaseBackendInactiveMessage };
    return { status: "error", message: error instanceof Error ? error.message : "Supabase sign-in failed." };
  }
}

export async function changeSupabaseAccountPassword(password: string, currentPassword: string): Promise<SupabasePasswordChangeResult> {
  if (!isSupabaseAuthConfigured()) return { status: "not-configured" };
  const session = readSupabaseAuthSession();
  if (!session) return { status: "session-expired", message: "Your sign-in session has expired. Sign in again, then change your password." };

  try {
    const response = await fetch(`${supabaseUrl().replace(/\/+$/, "")}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: supabasePublicKey(),
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password: password.trim(), current_password: currentPassword.trim() })
    });

    if (response.ok) return { status: "ok" };
    if (await isSupabaseBackendInactiveResponse(response)) return { status: "error", message: supabaseBackendInactiveMessage };
    if (response.status === 401 || response.status === 403) {
      clearSupabaseAuthSession();
      return { status: "session-expired", message: "Your sign-in session has expired. Sign in again, then change your password." };
    }
    const body = await response.json().catch(() => undefined) as { message?: string; error?: string } | undefined;
    return { status: "error", message: body?.message ?? body?.error ?? "Your password could not be updated. Please try again." };
  } catch (error) {
    if (isSupabaseBackendInactiveError(error)) return { status: "error", message: supabaseBackendInactiveMessage };
    return { status: "error", message: error instanceof Error ? error.message : "Your password could not be updated. Please try again." };
  }
}

export async function createSupabaseManagedAccount(account: SupabaseCreateAccountInput): Promise<SupabaseCreateAccountResult> {
  if (!isSupabaseAuthConfigured()) return { status: "not-configured" };
  const session = readSupabaseAuthSession();
  if (!session || session.authEmail !== supabaseAuthEmailForUsername(managerUsername)) {
    if (session) clearSupabaseAuthSession();
    return { status: "error", message: managerSessionRequiredMessage };
  }

  const username = normalizeSupabaseUsername(account.username);
  const password = account.password.trim();
  const displayName = account.displayName.trim();
  const role = account.role === "staff" || account.role === "student" || account.role === "guardian" ? account.role : "staff";
  if (!username || !password || !displayName) return { status: "error", message: "Enter a display name, username, and password before syncing." };

  const createUrl = `${supabaseUrl().replace(/\/+$/, "")}/functions/v1/manager-create-account`;
  const payload = {
    displayName,
    username,
    password,
    role,
    status: account.status ?? "active",
    email: account.email.trim(),
    ...(account.phone?.trim() ? { phone: account.phone.trim() } : {}),
    ...(account.title?.trim() ? { title: account.title.trim() } : {}),
    ...(account.notes?.trim() ? { notes: account.notes.trim() } : {}),
    ...(account.access?.length ? { access: account.access } : {}),
    ...(account.studentId?.trim() ? { studentId: account.studentId.trim() } : {})
  };

  try {
    const response = await fetch(createUrl, {
      method: "POST",
      headers: {
        apikey: supabasePublicKey(),
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) return { status: "ok" };
    if (await isSupabaseBackendInactiveResponse(response)) return { status: "error", message: supabaseBackendInactiveMessage };
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
    if (response.status === 401 && /manager session/i.test(body?.error ?? "")) {
      clearSupabaseAuthSession();
      return { status: "error", message: managerSessionRequiredMessage };
    }
    return { status: "error", message: body?.error ?? "Supabase account creation failed." };
  } catch (error) {
    if (isSupabaseBackendInactiveError(error)) return { status: "error", message: supabaseBackendInactiveMessage };
    return { status: "error", message: error instanceof Error ? error.message : "Supabase account creation failed." };
  }
}
