import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSupabaseAuthSession,
  createSupabaseManagedAccount,
  getSupabaseBrowserConfig,
  isSupabaseAuthConfigured,
  isChoSupabaseProjectUrlAllowed,
  isSupabaseBackendInactiveError,
  isSupabaseBackendInactiveResponse,
  isSupportedSupabaseLoginUsername,
  normalizeSupabaseUsername,
  readSupabaseAuthSession,
  signInSupabaseAccount,
  supabaseBackendInactiveMessage,
  supabaseProjectRefFromUrl,
  supabaseAuthEmailForUsername
} from "./supabaseAccounts";

const originalFetch = globalThis.fetch;
const supabaseSessionStorageKey = "chos.supabase.auth.v1";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

describe("supabase account adapter", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ENABLE_SUPABASE_IN_TESTS", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    window.localStorage.clear();
  });

  it("normalizes local usernames and maps Manager123 to the owner Auth email", () => {
    expect(normalizeSupabaseUsername(" Jordan Staff! ")).toBe("jordan.staff");
    expect(supabaseAuthEmailForUsername("Manager123")).toBe("manager123@accounts.chosmartialarts.app");
    expect(supabaseAuthEmailForUsername("Jordan Staff")).toBe("jordan.staff@accounts.chosmartialarts.app");
    expect(isSupportedSupabaseLoginUsername("Manager123")).toBe(true);
    expect(isSupportedSupabaseLoginUsername(" manager123 ")).toBe(true);
    expect(isSupportedSupabaseLoginUsername("Manager123!")).toBe(true);
    expect(isSupportedSupabaseLoginUsername("Dev123")).toBe(false);
    expect(isSupportedSupabaseLoginUsername("jordan.staff")).toBe(true);
    expect(isSupportedSupabaseLoginUsername("kai.child")).toBe(false);
  });

  it("reports not configured when no browser Supabase settings exist", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    expect(isSupabaseAuthConfigured()).toBe(false);
  });

  it("keeps Cho's Supabase configuration separated from the MongTeng project", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://jqvclzlvrhdcsfhhvekr.supabase.co");

    expect(supabaseProjectRefFromUrl("https://zfuwbbepsnmmlpgfkmhz.supabase.co")).toBe("zfuwbbepsnmmlpgfkmhz");
    expect(isChoSupabaseProjectUrlAllowed("https://zfuwbbepsnmmlpgfkmhz.supabase.co")).toBe(true);
    expect(isChoSupabaseProjectUrlAllowed("https://jqvclzlvrhdcsfhhvekr.supabase.co")).toBe(false);
    expect(getSupabaseBrowserConfig()).toEqual({ url: "", publicKey: "" });
    expect(isSupabaseAuthConfigured()).toBe(false);
    await expect(signInSupabaseAccount({ username: "Manager123", password: "ManagerPass123!" })).resolves.toEqual({ status: "not-configured" });
  });

  it("signs in with password, loads the profile, and stores the JWT for function calls", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/auth/v1/token")) {
        return jsonResponse({
          access_token: "manager-access-token",
          refresh_token: "manager-refresh-token",
          expires_in: 3600,
          user: { id: "manager-user-id", email: "manager123@accounts.chosmartialarts.app" }
        });
      }
      if (requestUrl.includes("/rest/v1/profiles")) {
        return jsonResponse([
          {
            id: "manager-user-id",
            username: "manager123",
            contact_email: "manager123@chos.prototype",
            display_name: "Cho's Manager",
            role: "staff",
            status: "active",
            phone: null,
            title: "Head Coach",
            notes: null,
            access: ["dashboard"],
            student_id: null,
            created_by: "manager-user-id",
            created_at: "2026-06-09T00:00:00.000Z"
          }
        ]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await signInSupabaseAccount({ username: "Manager123", password: "ManagerPass123!" });

    expect(result).toMatchObject({
      status: "authenticated",
      sessionEmail: "manager123@chos.prototype",
      role: "staff"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/token?grant_type=password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "manager123@accounts.chosmartialarts.app", password: "ManagerPass123!" })
      })
    );
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("manager-access-token");
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("\"projectRef\":\"project\"");
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("manager123@accounts.chosmartialarts.app");
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).not.toContain("manager-refresh-token");
  });

  it("signs in created staff usernames through Supabase Auth and stores the JWT", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/auth/v1/token")) {
        return jsonResponse({
          access_token: "staff-access-token",
          refresh_token: "staff-refresh-token",
          expires_in: 3600,
          user: { id: "staff-user-id", email: "jordan.staff@accounts.chosmartialarts.app" }
        });
      }
      if (requestUrl.includes("/rest/v1/profiles")) {
        return jsonResponse([
          {
            id: "staff-user-id",
            username: "jordan.staff",
            contact_email: "jordan@example.com",
            display_name: "Jordan Lee",
            role: "staff",
            status: "active",
            phone: null,
            title: "Instructor",
            notes: null,
            access: ["dashboard"],
            student_id: null,
            created_by: "manager-user-id",
            created_at: "2026-06-09T00:00:00.000Z"
          }
        ]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await signInSupabaseAccount({ username: "jordan.staff", password: "StaffPass123!" });

    expect(result).toMatchObject({
      status: "authenticated",
      sessionEmail: "jordan.staff",
      role: "staff"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/token?grant_type=password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "jordan.staff@accounts.chosmartialarts.app", password: "StaffPass123!" })
      })
    );
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("staff-access-token");
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("\"projectRef\":\"project\"");
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("jordan.staff@accounts.chosmartialarts.app");
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).not.toContain("staff-refresh-token");
  });

  it("clears unscoped or wrong-project stored sessions before they can be reused", () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "old-manager-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "manager-user-id"
    }));
    expect(readSupabaseAuthSession()).toBeUndefined();
    expect(window.localStorage.getItem(supabaseSessionStorageKey)).toBeNull();

    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "other-project-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "manager-user-id",
      projectRef: "other-project",
      authEmail: "manager123@accounts.chosmartialarts.app"
    }));
    expect(readSupabaseAuthSession()).toBeUndefined();
    expect(window.localStorage.getItem(supabaseSessionStorageKey)).toBeNull();
  });

  it("classifies paused or unreachable Supabase auth as backend-inactive instead of invalid credentials", async () => {
    expect(await isSupabaseBackendInactiveResponse(jsonResponse({ message: "Project is paused" }, { status: 404 }))).toBe(true);
    expect(isSupabaseBackendInactiveError({ message: "Project is inactive", status: 503 })).toBe(true);

    const pausedFetchMock = vi.fn(async () => jsonResponse({ message: "Project is paused" }, { status: 503 }));
    globalThis.fetch = pausedFetchMock as typeof fetch;

    await expect(signInSupabaseAccount({ username: "Manager123", password: "ManagerPass123!" })).resolves.toEqual({
      status: "backend-inactive",
      message: supabaseBackendInactiveMessage
    });
    expect(window.localStorage.getItem(supabaseSessionStorageKey)).toBeNull();

    const dnsFetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    globalThis.fetch = dnsFetchMock as typeof fetch;

    await expect(signInSupabaseAccount({ username: "jordan.staff", password: "StaffPass123!" })).resolves.toEqual({
      status: "backend-inactive",
      message: supabaseBackendInactiveMessage
    });
    expect(window.localStorage.getItem(supabaseSessionStorageKey)).toBeNull();
  });

  it("classifies paused profile fetches after Auth success as backend-inactive", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/auth/v1/token")) {
        return jsonResponse({
          access_token: "staff-access-token",
          expires_in: 3600,
          user: { id: "staff-user-id", email: "jordan.staff@accounts.chosmartialarts.app" }
        });
      }
      if (requestUrl.includes("/rest/v1/profiles")) {
        return jsonResponse({ message: "Project is inactive" }, { status: 503 });
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(signInSupabaseAccount({ username: "jordan.staff", password: "StaffPass123!" })).resolves.toEqual({
      status: "backend-inactive",
      message: supabaseBackendInactiveMessage
    });
    expect(window.localStorage.getItem(supabaseSessionStorageKey)).toBeNull();
  });

  it("returns the unpause message when live account creation reaches an inactive backend", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "manager-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "manager-user-id",
      projectRef: "project",
      authEmail: "manager123@accounts.chosmartialarts.app"
    }));
    const fetchMock = vi.fn(async () => jsonResponse({ message: "Project is inactive" }, { status: 503 }));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(createSupabaseManagedAccount({
      displayName: "Jordan Lee",
      username: "jordan.staff",
      password: "StaffPass123!",
      role: "staff",
      email: "jordan@example.com"
    })).resolves.toEqual({
      status: "error",
      message: supabaseBackendInactiveMessage
    });
  });

  it("creates managed accounts through the Edge Function with the stored owner JWT", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/auth/v1/token")) {
        return jsonResponse({
          access_token: "manager-access-token",
          expires_in: 3600,
          user: { id: "manager-user-id", email: "manager123@accounts.chosmartialarts.app" }
        });
      }
      if (requestUrl.includes("/rest/v1/profiles")) {
        return jsonResponse([
          {
            id: "manager-user-id",
            username: "manager123",
            contact_email: "manager123@chos.prototype",
            display_name: "Cho's Manager",
            role: "staff",
            status: "active",
            phone: null,
            title: null,
            notes: null,
            access: ["dashboard"],
            student_id: null,
            created_by: "manager-user-id",
            created_at: "2026-06-09T00:00:00.000Z"
          }
        ]);
      }
      if (requestUrl.includes("/functions/v1/manager-create-account")) {
        return jsonResponse({
          account: {
            id: "staff-user-id",
            username: "jordan.staff",
            role: "staff",
            status: "active"
          }
        });
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await signInSupabaseAccount({ username: "Manager123", password: "ManagerPass123!" });
    const result = await createSupabaseManagedAccount({
      displayName: "Jordan Lee",
      username: "jordan.staff",
      password: "StaffPass123!",
      role: "staff",
      email: "jordan@example.com",
      access: ["dashboard"]
    });

    expect(result).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/manager-create-account",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer manager-access-token"
        }),
        body: JSON.stringify({
          displayName: "Jordan Lee",
          username: "jordan.staff",
          password: "StaffPass123!",
          role: "staff",
          status: "active",
          email: "jordan@example.com",
          access: ["dashboard"]
        })
      })
    );

    clearSupabaseAuthSession();
    expect(await createSupabaseManagedAccount({
      displayName: "No Session",
      username: "no.session",
      password: "StaffPass123!",
      role: "staff",
      email: "no-session@example.com"
    })).toEqual({
      status: "error",
      message: "Sign into the Supabase Manager123 owner account before syncing created accounts."
    });
  });

  it("clears a rejected manager session when the Edge Function returns 401", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "stale-manager-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "manager-user-id",
      projectRef: "project",
      authEmail: "manager123@accounts.chosmartialarts.app"
    }));
    const fetchMock = vi.fn(async () => jsonResponse({ error: "Invalid manager session." }, { status: 401 }));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(createSupabaseManagedAccount({
      displayName: "Jordan Lee",
      username: "jordan.staff",
      password: "StaffPass123!",
      role: "staff",
      email: "jordan@example.com"
    })).resolves.toEqual({
      status: "error",
      message: "Sign into the Supabase Manager123 owner account before syncing created accounts."
    });
    expect(window.localStorage.getItem(supabaseSessionStorageKey)).toBeNull();
  });
});
