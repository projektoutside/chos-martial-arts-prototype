import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateSupabaseAccount,
  clearSupabaseAuthSession,
  acknowledgeSupabaseWelcome,
  changeSupabaseAccountPassword,
  createSupabaseManagedAccount,
  getSupabaseBrowserConfig,
  fetchSupabaseProfileOnboarding,
  isSupabaseAuthConfigured,
  isChoSupabaseProjectUrlAllowed,
  isSupabaseBackendInactiveError,
  isSupabaseBackendInactiveResponse,
  isSupportedSupabaseLoginUsername,
  normalizeSupabaseUsername,
  requestSupabaseAccountActivation,
  readSupabaseInviteCallback,
  readSupabaseAuthSession,
  completeSupabaseInvitePassword,
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

  it("recognizes secure invite callbacks and stores their session", () => {
    window.history.replaceState({}, "", "/#access_token=invite-token&refresh_token=refresh-token&expires_in=3600&type=invite");
    expect(readSupabaseInviteCallback()).toEqual({ status: "ready", type: "invite" });
    expect(readSupabaseAuthSession()).toEqual(expect.objectContaining({ accessToken: "invite-token", refreshToken: "refresh-token" }));
    expect(window.location.hash).toBe("");
  });

  it("keeps a missing hosted account private when public signup is disabled", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      code: 422,
      error_code: "otp_disabled",
      msg: "Signups not allowed for otp"
    }, { status: 422 }));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(requestSupabaseAccountActivation(" Missing.User@Example.com ")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/v1/otp?redirect_to="),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "missing.user@example.com", create_user: false })
      })
    );
  });

  it("reports an unexpected hosted activation failure", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({
      code: 422,
      error_code: "unexpected_activation_failure",
      msg: "Activation failed"
    }, { status: 422 })) as typeof fetch;

    await expect(requestSupabaseAccountActivation("staff@example.com")).resolves.toEqual({
      status: "error",
      message: "Activation email is temporarily unavailable. Please wait and try again."
    });
  });

  it("recognizes existing-account magic links as password setup callbacks", () => {
    window.history.replaceState({}, "", "/#access_token=magic-token&expires_in=3600&type=magiclink");
    expect(readSupabaseInviteCallback()).toEqual({ status: "ready", type: "magiclink" });
    expect(readSupabaseAuthSession()).toEqual(expect.objectContaining({ accessToken: "magic-token" }));
    expect(window.location.hash).toBe("");
  });

  it("sets an invited user's password using the callback session", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({ accessToken: "invite-token", expiresAt: Date.now() + 60_000, userId: "invite-user", projectRef: "project" }));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "invite-user" }));
    globalThis.fetch = fetchMock;
    await expect(completeSupabaseInvitePassword("StrongPass123!")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith("https://project.supabase.co/auth/v1/user", expect.objectContaining({ method: "PUT", body: JSON.stringify({ password: "StrongPass123!" }) }));
    expect(window.localStorage.getItem(supabaseSessionStorageKey)).toBeNull();
  });

  it("signs in by real email when the profile keeps a friendly username", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token", expires_in: 3600, user: { id: "user-1", email: "jordan@example.com" } }))
      .mockResolvedValueOnce(jsonResponse([{ id: "user-1", username: "jordan.staff", contact_email: "jordan@example.com", display_name: "Jordan", role: "staff", status: "active", phone: null, title: null, notes: null, access: [], student_id: null, created_by: null, created_at: "2026-01-01" }]));
    globalThis.fetch = fetchMock;
    await expect(signInSupabaseAccount({ username: "jordan@example.com", password: "StrongPass123!" })).resolves.toEqual(expect.objectContaining({ status: "authenticated", sessionEmail: "jordan.staff" }));
    expect(readSupabaseAuthSession()).toEqual(expect.objectContaining({ authEmail: "jordan@example.com", profileUsername: "jordan.staff" }));
  });

  it("loads the signed-in user's authoritative first-login profile", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "manager-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "manager-user-id",
      projectRef: "project",
      authEmail: "manager1@accounts.chosmartialarts.app"
    }));
    const fetchMock = vi.fn(async () => jsonResponse([{
      username: "manager1",
      display_name: "Manager",
      role: "staff",
      status: "active",
      is_owner: true,
      welcome_seen_at: null
    }]));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(fetchSupabaseProfileOnboarding()).resolves.toEqual({
      ok: true,
      profile: {
        username: "manager1",
        displayName: "Manager",
        role: "staff",
        status: "active",
        isOwner: true,
        welcomeSeenAt: null
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/rpc/get_my_profile_onboarding",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer manager-access-token" }) })
    );
  });

  it("acknowledges welcome for only the bearer identity without sending secrets", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "staff-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "staff-user-id",
      projectRef: "project"
    }));
    const fetchMock = vi.fn(async () => jsonResponse([{ welcome_seen_at: "2026-07-13T20:20:00.000Z" }]));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(acknowledgeSupabaseWelcome()).resolves.toEqual({ ok: true, welcomeSeenAt: "2026-07-13T20:20:00.000Z" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init?.body ?? "")).not.toMatch(/password|user.?id/i);
    expect(init).toEqual(expect.objectContaining({ method: "POST", body: "{}" }));
  });

  it("normalizes local usernames and maps both manager names to the live Manager1 Auth email", () => {
    expect(normalizeSupabaseUsername(" Jordan Staff! ")).toBe("jordan.staff");
    expect(supabaseAuthEmailForUsername("Manager1")).toBe("manager1@accounts.chosmartialarts.app");
    expect(supabaseAuthEmailForUsername("Manager123")).toBe("manager1@accounts.chosmartialarts.app");
    expect(supabaseAuthEmailForUsername("Jordan Staff")).toBe("jordan.staff@accounts.chosmartialarts.app");
    expect(isSupportedSupabaseLoginUsername("Manager123")).toBe(true);
    expect(isSupportedSupabaseLoginUsername(" manager123 ")).toBe(true);
    expect(isSupportedSupabaseLoginUsername("Manager123!")).toBe(true);
    vi.stubEnv("VITE_ENABLE_DEVELOPER_ACCOUNT", "");
    expect(isSupportedSupabaseLoginUsername("Dev123")).toBe(false);
    vi.stubEnv("VITE_ENABLE_DEVELOPER_ACCOUNT", "true");
    expect(isSupportedSupabaseLoginUsername("Dev123")).toBe(true);
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
        body: JSON.stringify({ email: "manager1@accounts.chosmartialarts.app", password: "ManagerPass123!" })
      })
    );
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("manager-access-token");
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("\"projectRef\":\"project\"");
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("manager123@accounts.chosmartialarts.app");
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).not.toContain("manager-refresh-token");
  });

  it("signs Manager1 into the live Manager1 profile and scopes the saved session", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/auth/v1/token")) {
        return jsonResponse({
          access_token: "manager1-access-token",
          expires_in: 3600,
          user: { id: "manager1-user-id", email: "manager1@accounts.chosmartialarts.app" }
        });
      }
      if (requestUrl.includes("/rest/v1/profiles")) {
        return jsonResponse([{
          id: "manager1-user-id",
          username: "manager1",
          contact_email: "manager1@chos.prototype",
          display_name: "Cho's Manager",
          role: "staff",
          status: "active",
          phone: null,
          title: "Manager",
          notes: null,
          access: ["dashboard"],
          student_id: null,
          created_by: "manager1-user-id",
          created_at: "2026-07-13T00:00:00.000Z"
        }]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(signInSupabaseAccount({ username: "Manager1", password: "ManagerPass123!" })).resolves.toMatchObject({
      status: "authenticated",
      sessionEmail: "manager1@chos.prototype",
      role: "staff"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/token?grant_type=password",
      expect.objectContaining({ body: JSON.stringify({ email: "manager1@accounts.chosmartialarts.app", password: "ManagerPass123!" }) })
    );
    expect(readSupabaseAuthSession()).toEqual(expect.objectContaining({
      authEmail: "manager1@accounts.chosmartialarts.app",
      profileUsername: "manager1"
    }));
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

  it("signs in the gated developer username through Supabase Auth and keeps the developer session identity", async () => {
    vi.stubEnv("VITE_ENABLE_DEVELOPER_ACCOUNT", "true");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/auth/v1/token")) {
        return jsonResponse({
          access_token: "developer-access-token",
          refresh_token: "developer-refresh-token",
          expires_in: 3600,
          user: { id: "developer-user-id", email: "dev123@accounts.chosmartialarts.app" }
        });
      }
      if (requestUrl.includes("/rest/v1/profiles")) {
        return jsonResponse([
          {
            id: "developer-user-id",
            username: "dev123",
            contact_email: "dev123@chos.prototype",
            display_name: "Developer",
            role: "staff",
            status: "active",
            phone: null,
            title: "Developer",
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

    const result = await signInSupabaseAccount({ username: "Dev123", password: "Xatori#123" });

    expect(result).toMatchObject({
      status: "authenticated",
      sessionEmail: "dev123@chos.prototype",
      role: "staff"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/token?grant_type=password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "dev123@accounts.chosmartialarts.app", password: "Xatori#123" })
      })
    );
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("developer-access-token");
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("dev123@accounts.chosmartialarts.app");
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
      access: ["dashboard"]
    });

    expect(result).toEqual({ status: "ok", activationRequired: true, username: "jordan.staff", email: "jordan.staff@accounts.chosmartialarts.app" });
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
            role: "staff",
            status: "active",
            password: "StaffPass123!",
            access: ["dashboard"]
          })
      })
    );

    clearSupabaseAuthSession();
    expect(await createSupabaseManagedAccount({
      displayName: "No Session",
      username: "no.session",
      password: "StaffPass123!",
      role: "staff"
    })).toEqual({
      status: "error",
      message: "Sign into an authorized Supabase Developer or Manager account before syncing created accounts."
    });
  });

  it("requires activation before a newly provisioned account can enter the app", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/auth/v1/token")) {
        return jsonResponse({
          access_token: "staff-access-token",
          refresh_token: "staff-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: "staff-user-id",
            email: "jordan.staff@accounts.chosmartialarts.app",
            app_metadata: { role: "staff", requires_password_change: true },
            user_metadata: {
              username: "jordan.staff",
              display_name: "Jordan Lee",
              contact_email: "jordan@example.com"
            }
          }
        });
      }
      if (requestUrl.includes("/rest/v1/profiles")) {
        return jsonResponse([{
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
          created_at: "2026-07-16T00:00:00.000Z"
        }]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(signInSupabaseAccount({ username: "jordan.staff", password: "TemporaryPass123!" })).resolves.toMatchObject({
      status: "activation-required",
      sessionEmail: "jordan.staff",
      role: "staff"
    });
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("staff-access-token");
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
  });

  it("activates only the temporary authenticated Supabase account", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "staff-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "staff-user-id",
      projectRef: "project",
      authEmail: "jordan.staff@accounts.chosmartialarts.app",
      profileUsername: "jordan.staff"
    }));
    const fetchMock = vi.fn(async () => jsonResponse({ status: "ok" }));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(activateSupabaseAccount("PermanentPass456!", "TemporaryPass123!")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/activate-account",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer staff-access-token" }),
        body: JSON.stringify({
          newPassword: "PermanentPass456!",
          temporaryPassword: "TemporaryPass123!"
        })
      })
    );
  });

  it("rejects unsafe activation attempts before changing hosted state", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(activateSupabaseAccount("short", "TemporaryPass123!")).resolves.toEqual({
      status: "error",
      message: "Use at least 12 characters with uppercase, lowercase, a number, and a symbol."
    });
    await expect(activateSupabaseAccount("TemporaryPass123!", "TemporaryPass123!")).resolves.toEqual({
      status: "error",
      message: "Choose a new password that is different from your temporary password."
    });
    await expect(activateSupabaseAccount("PermanentPass456!", "TemporaryPass123!")).resolves.toEqual({
      status: "session-expired",
      message: "Your temporary sign-in has expired. Start account access again."
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the live Manager1 owner session reach server-side account authorization", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "manager1-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "manager1-user-id",
      projectRef: "project",
      authEmail: "manager1@accounts.chosmartialarts.app",
      profileUsername: "manager1"
    }));
    const fetchMock = vi.fn(async () => jsonResponse({
      email: "new.staff@example.com",
      username: "new.staff",
      activationRequired: true
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(createSupabaseManagedAccount({
      displayName: "New Staff",
      username: "new.staff",
      password: "StaffPass123!",
      role: "staff",
      email: "new.staff@example.com"
    })).resolves.toEqual({
      status: "ok",
      activationRequired: true,
      username: "new.staff",
      email: "new.staff@example.com"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/manager-create-account",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer manager1-access-token" })
      })
    );
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
      message: "Sign into an authorized Supabase Developer or Manager account before syncing created accounts."
    });
    expect(window.localStorage.getItem(supabaseSessionStorageKey)).toBeNull();
  });

  it("updates only the authenticated user's Supabase password with their session JWT", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "staff-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "staff-user-id",
      projectRef: "project",
      authEmail: "jordan.staff@accounts.chosmartialarts.app"
    }));
    const fetchMock = vi.fn(async () => jsonResponse({ id: "staff-user-id" }));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(changeSupabaseAccountPassword(" StrongPass123! ", "OldPass123!")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/user",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          apikey: "sb_publishable_test",
          Authorization: "Bearer staff-access-token"
        }),
        body: JSON.stringify({ password: "StrongPass123!", current_password: "OldPass123!" })
      })
    );
  });
});
