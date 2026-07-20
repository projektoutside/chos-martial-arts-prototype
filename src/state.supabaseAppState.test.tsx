import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildOperationsBackupSnapshot, type OperationsBackupInput } from "./operationsBackup";
import { AppStateProvider, useAppState } from "./state";
import type { StudentRecord } from "./types";

const originalFetch = globalThis.fetch;
const supabaseSessionStorageKey = "chos.supabase.auth.v1";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

function emptyResponse(init?: ResponseInit) {
  return new Response(null, { status: 204, ...init });
}

function storeSupabaseSession() {
  window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
    accessToken: "manager-access-token",
    expiresAt: Date.now() + 60 * 60 * 1000,
    userId: "manager-user-id",
    projectRef: "project",
    authEmail: "manager123@accounts.chosmartialarts.app"
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function Harness() {
  const { accountRole, accounts, addOperationsStudent, managedAccounts, studentAccessVerification, students } = useAppState();
  return (
    <div>
      <p data-testid="students">{students.map((student) => student.id).join(",")}</p>
      <p data-testid="account-role">{accountRole ?? "unknown"}</p>
      <p data-testid="student-access-status">{studentAccessVerification.status}</p>
      <p data-testid="credential-counts">{accounts.length}:{managedAccounts.length}</p>
      <button
        type="button"
        onClick={() => addOperationsStudent({
          fullName: "New Student",
          studentEmail: "new.student@example.test",
          guardianName: "New Parent",
          guardianPhone: "(262) 555-0199",
          guardianEmail: "new.parent@example.test",
          beltRank: "White",
          program: "Youth Taekwondo"
        })}
      >
        Add Student
      </button>
    </div>
  );
}

function MessageHydrationRaceHarness() {
  const { messageLogs, sendMissedClassFollowUps, students } = useAppState();
  return (
    <div>
      <p data-testid="student-count">{students.length}</p>
      <p data-testid="message-log-count">{messageLogs.length}</p>
      <button type="button" onClick={() => sendMissedClassFollowUps()}>
        Queue missed-class reports
      </button>
    </div>
  );
}

function makeBackupInput(overrides: Partial<OperationsBackupInput> = {}): OperationsBackupInput {
  return {
    accounts: [],
    accountRoles: [],
    managedAccounts: [],
    childAccounts: [],
    students: [],
    studioClasses: [],
    scheduledClasses: [],
    messageCampaigns: [],
    scheduledTextCampaigns: [],
    messageLogs: [],
    automationRuns: [],
    directMessages: [],
    messagingSetup: [],
    studioEvents: [],
    merchandiseItems: [],
    checkIns: [],
    trainingVideoFolders: [],
    trainingVideos: [],
    studyGuideFolders: [],
    studyGuideMaterials: [],
    orders: [],
    bookings: [],
    contacts: [],
    leadReviews: [],
    ...overrides
  };
}

function RestoreMessagingSetupHarness({ rawBackup }: { rawBackup: string }) {
  const { restoreOperationsBackup } = useAppState();
  return (
    <button type="button" onClick={() => restoreOperationsBackup(rawBackup)}>
      Restore messaging setup
    </button>
  );
}

describe("Supabase-backed app state provider", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ENABLE_SUPABASE_IN_TESTS", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    window.localStorage.clear();
    window.sessionStorage.clear();
    storeSupabaseSession();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("hydrates business state from Supabase, removes stale local credentials, and persists updates remotely", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([{ id: "local-student" }]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([{ username: "stale.staff", password: "LocalPass123!" }]));
    window.localStorage.setItem("chos.accounts.v1", JSON.stringify([{ email: "stale.parent", password: "LocalPass123!" }]));
    const remoteStudent = {
      id: "student-remote",
      firstName: "Remote",
      lastName: "Student",
      phone: "(262) 555-0100",
      email: "remote.student@example.test",
      guardianPhone: "(262) 555-0100",
      enrollmentDate: "2026-06-17",
      program: "Youth Taekwondo",
      status: "Active",
      beltRank: "White",
      profileUpdatedAt: "2026-06-17",
      joinedAt: "2026-06-17",
      classesAttended: 0,
      missedClassCount: 0
    };
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/rest/v1/app_state_items") {
        if (init?.method === "POST") return emptyResponse();
        const requestedKey = requestUrl.searchParams.get("key")?.replace(/^eq\./, "");
        if (requestedKey === "chos.operations.students.v1") {
          return jsonResponse([{ key: requestedKey, value: [remoteStudent] }]);
        }
        return jsonResponse([]);
      }
      if (requestUrl.pathname === "/rest/v1/rpc/mutate_student_roster") return jsonResponse([]);
      if (requestUrl.pathname === "/rest/v1/direct_messages" || requestUrl.pathname === "/rest/v1/message_logs") {
        return jsonResponse([]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(
      <AppStateProvider>
        <Harness />
      </AppStateProvider>
    );

    expect((await screen.findByTestId("students")).textContent).toContain("student-remote");
    expect(screen.getByTestId("credential-counts").textContent).toBe("0:0");
    await waitFor(() => expect(window.localStorage.getItem("chos.operations.students.v1")).toBeNull());
    expect(window.localStorage.getItem("chos.managedAccounts.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.accounts.v1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add Student" }));

    await waitFor(() => {
      const studentUpserts = fetchMock.mock.calls
        .filter(([url, init]) => new URL(String(url)).pathname === "/rest/v1/rpc/mutate_student_roster" && init?.method === "POST")
        .map(([, init]) => init as RequestInit);
      expect(studentUpserts.length).toBeGreaterThan(0);
      const latestBody = JSON.parse(String(studentUpserts.at(-1)?.body));
      expect(latestBody.p_upserts).toEqual([expect.objectContaining({ firstName: "New", lastName: "Student" })]);
      expect(latestBody.p_upserts).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: "student-remote" })]));
      expect(latestBody.p_delete_ids).toEqual([]);
    });
    expect(window.localStorage.getItem("chos.operations.students.v1")).toBeNull();
  });

  it("initializes a missing hosted roster through the merge RPC without a whole-array fallback write", async () => {
    const initializedStudent = {
      id: "student-created-during-initialization",
      firstName: "Concurrent",
      lastName: "Student",
      phone: "",
      email: "",
      program: "Youth Taekwondo",
      status: "Active",
      beltRank: "White",
      classesAttended: 0,
      missedClassCount: 0,
      joinedAt: "2026-07-20"
    };
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/rest/v1/app_state_items") {
        if (init?.method === "POST") return emptyResponse();
        return jsonResponse([]);
      }
      if (requestUrl.pathname === "/rest/v1/rpc/mutate_student_roster") return jsonResponse([initializedStudent]);
      if (requestUrl.pathname === "/rest/v1/direct_messages" || requestUrl.pathname === "/rest/v1/message_logs") return jsonResponse([]);
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<AppStateProvider><Harness /></AppStateProvider>);

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname === "/rest/v1/rpc/mutate_student_roster")).toBe(true));
    await waitFor(() => expect(screen.getByTestId("students")).toHaveTextContent("student-created-during-initialization"));
    const wholeRosterWrites = fetchMock.mock.calls.filter(([url, init]) => {
      const requestUrl = new URL(String(url));
      return requestUrl.pathname === "/rest/v1/app_state_items"
        && init?.method === "POST"
        && String(init.body).includes("\"key\":\"chos.operations.students.v1\"");
    });
    expect(wholeRosterWrites).toHaveLength(0);
  });

  it("rehydrates the hosted role and loads only the signed-in student's RPC-filtered record", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "student-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "student-user-id",
      projectRef: "project",
      authEmail: "hosted.student@accounts.chosmartialarts.app",
      profileUsername: "hosted.student",
      role: "student",
      studentId: "student-own"
    }));
    const appSession = { email: "hosted.student", remembered: true, createdAt: "2026-07-19T00:00:00.000Z" };
    window.localStorage.setItem("chos.session.v1", JSON.stringify(appSession));
    window.sessionStorage.setItem("chos.session.v1", JSON.stringify(appSession));
    const ownStudent = { id: "student-own", firstName: "Own", lastName: "Student", email: "", phone: "", status: "Active", beltRank: "Blue", classesAttended: 20, missedClassCount: 0, joinedAt: "2026-01-01" };
    const otherStudent = { ...ownStudent, id: "student-other", firstName: "Other" };
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/rest/v1/rpc/get_my_student_record") return jsonResponse(ownStudent);
      if (requestUrl.pathname === "/rest/v1/app_state_items") {
        const requestedKey = requestUrl.searchParams.get("key")?.replace(/^eq\./, "");
        if (requestedKey === "chos.operations.students.v1") return jsonResponse([{ key: requestedKey, value: [ownStudent, otherStudent] }]);
        return jsonResponse([]);
      }
      if (requestUrl.pathname === "/rest/v1/direct_messages" || requestUrl.pathname === "/rest/v1/message_logs") return jsonResponse([]);
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(
      <AppStateProvider>
        <Harness />
      </AppStateProvider>
    );

    expect(await screen.findByTestId("account-role")).toHaveTextContent("student");
    await waitFor(() => expect(screen.getByTestId("students")).toHaveTextContent("student-own"));
    expect(screen.getByTestId("student-access-status")).toHaveTextContent("ready");
    expect(screen.getByTestId("students")).not.toHaveTextContent("student-other");
    expect(fetchMock.mock.calls.some(([url]) => {
      const requestUrl = new URL(String(url));
      return requestUrl.pathname === "/rest/v1/app_state_items" && requestUrl.searchParams.get("key") === "eq.chos.operations.students.v1";
    })).toBe(false);
    expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toEqual(expect.objectContaining({
      role: "student",
      studentId: "student-own"
    }));
  });

  it("denies hosted student workspace access when no active linked roster record exists", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "student-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "student-user-id",
      projectRef: "project",
      authEmail: "hosted.student@accounts.chosmartialarts.app",
      profileUsername: "hosted.student",
      role: "student",
      studentId: "student-missing"
    }));
    const appSession = { email: "hosted.student", remembered: true, createdAt: "2026-07-19T00:00:00.000Z", role: "student", studentId: "student-missing" };
    window.localStorage.setItem("chos.session.v1", JSON.stringify(appSession));
    window.sessionStorage.setItem("chos.session.v1", JSON.stringify(appSession));
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/rest/v1/rpc/get_my_student_record") return jsonResponse(null);
      if (requestUrl.pathname === "/rest/v1/direct_messages" || requestUrl.pathname === "/rest/v1/message_logs") return jsonResponse([]);
      return jsonResponse([]);
    }) as typeof fetch;

    render(<AppStateProvider><Harness /></AppStateProvider>);

    await waitFor(() => expect(screen.getByTestId("student-access-status")).toHaveTextContent("denied"));
    expect(screen.getByTestId("students")).toHaveTextContent("");
  });

  it("keeps retryable student hydration failures separate from eligibility denial", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "student-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "student-user-id",
      projectRef: "project",
      authEmail: "hosted.student@accounts.chosmartialarts.app",
      profileUsername: "hosted.student",
      role: "student",
      studentId: "student-own"
    }));
    const appSession = { email: "hosted.student", remembered: true, createdAt: "2026-07-19T00:00:00.000Z", role: "student", studentId: "student-own" };
    window.localStorage.setItem("chos.session.v1", JSON.stringify(appSession));
    window.sessionStorage.setItem("chos.session.v1", JSON.stringify(appSession));
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/rest/v1/rpc/get_my_student_record") return jsonResponse({ error: "temporary" }, { status: 500 });
      return jsonResponse([]);
    }) as typeof fetch;

    render(<AppStateProvider><Harness /></AppStateProvider>);

    await waitFor(() => expect(screen.getByTestId("student-access-status")).toHaveTextContent("error"));
    expect(window.localStorage.getItem("chos.session.v1")).not.toBeNull();
  });

  it("does not request the shared roster when a student token has no app session", async () => {
    window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
      accessToken: "student-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      userId: "student-user-id",
      projectRef: "project",
      authEmail: "hosted.student@accounts.chosmartialarts.app",
      profileUsername: "hosted.student",
      role: "student",
      studentId: "student-own"
    }));
    const fetchMock = vi.fn(async (_url: string | URL | Request) => jsonResponse([]));
    globalThis.fetch = fetchMock as typeof fetch;

    render(<AppStateProvider><Harness /></AppStateProvider>);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.some(([url]) => {
      const requestUrl = new URL(String(url));
      return requestUrl.pathname === "/rest/v1/app_state_items" && requestUrl.searchParams.get("key") === "eq.chos.operations.students.v1";
    })).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname === "/rest/v1/rpc/get_my_student_record")).toBe(false);
  });

  it("does not overwrite a local app-state mutation when remote hydration returns late", async () => {
    const studentHydration = deferred<Response>();
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/rest/v1/app_state_items") {
        if (init?.method === "POST") return emptyResponse();
        const requestedKey = requestUrl.searchParams.get("key")?.replace(/^eq\./, "");
        if (requestedKey === "chos.operations.students.v1") return studentHydration.promise;
        return jsonResponse([]);
      }
      if (requestUrl.pathname === "/rest/v1/rpc/mutate_student_roster") return jsonResponse([]);
      if (requestUrl.pathname === "/rest/v1/direct_messages" || requestUrl.pathname === "/rest/v1/message_logs") {
        return jsonResponse([]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(
      <AppStateProvider>
        <Harness />
      </AppStateProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Student" }));
    await waitFor(() => expect(screen.getByTestId("students")).not.toHaveTextContent(""));

    studentHydration.resolve(jsonResponse([{ key: "chos.operations.students.v1", value: [] }]));

    await waitFor(() => expect(screen.getByTestId("students")).not.toHaveTextContent(""));
    expect(screen.getByTestId("students")).toHaveTextContent("student-");
  });

  it("keeps report-queued message logs when Supabase message hydration returns late", async () => {
    const remoteStudent: StudentRecord = {
      id: "student-remote-risk",
      firstName: "Remote",
      lastName: "Risk",
      phone: "(262) 555-0100",
      email: "remote.risk@example.test",
      dateOfBirth: "2014-09-01",
      guardianName: "Remote Guardian",
      guardianPhone: "(262) 555-0100",
      guardianEmail: "remote.guardian@example.test",
      emergencyContactName: "Remote Emergency",
      emergencyContactRelationship: "Parent",
      emergencyContactPhone: "(262) 555-0200",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 3,
      joinedAt: "2026-01-01",
      smsConsentUpdatedAt: "2026-05-01T10:00:00.000Z"
    };
    const messageHydration = deferred<Response>();
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/rest/v1/app_state_items") {
        if (init?.method === "POST") return emptyResponse();
        const requestedKey = requestUrl.searchParams.get("key")?.replace(/^eq\./, "");
        if (requestedKey === "chos.operations.students.v1") {
          return jsonResponse([{ key: requestedKey, value: [remoteStudent] }]);
        }
        return jsonResponse([]);
      }
      if (requestUrl.pathname === "/rest/v1/direct_messages") {
        return jsonResponse([]);
      }
      if (requestUrl.pathname === "/rest/v1/message_logs") {
        if (init?.method === "POST") return emptyResponse();
        if (init?.method === "DELETE") return emptyResponse();
        return messageHydration.promise;
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(
      <AppStateProvider>
        <MessageHydrationRaceHarness />
      </AppStateProvider>
    );

    await waitFor(() => expect(screen.getByTestId("student-count")).toHaveTextContent("1"));
    fireEvent.click(screen.getByRole("button", { name: "Queue missed-class reports" }));
    await waitFor(() => expect(screen.getByTestId("message-log-count")).toHaveTextContent("1"));

    messageHydration.resolve(jsonResponse([]));

    await waitFor(() => expect(screen.getByTestId("message-log-count")).toHaveTextContent("1"));
    const messageLogPosts = fetchMock.mock.calls
      .filter(([url, init]) => new URL(String(url)).pathname === "/rest/v1/message_logs" && init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)) as Array<Record<string, unknown>>);
    expect(messageLogPosts.flat()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipient_name: "Remote Risk",
        delivery_status: "queued",
        status: "queued",
        body: expect.stringMatching(/missed you in class/i)
      })
    ]));
    expect(window.localStorage.getItem("chos.operations.messages.v1")).toBeNull();
  });

  it("does not fall back to local operations storage when Supabase is configured without a session", async () => {
    window.localStorage.removeItem(supabaseSessionStorageKey);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([{ id: "stale-local-student" }]));
    const fetchMock = vi.fn(async () => jsonResponse({ error: "Unexpected Supabase request" }, { status: 500 }));
    globalThis.fetch = fetchMock as typeof fetch;

    render(
      <AppStateProvider>
        <Harness />
      </AppStateProvider>
    );

    expect((await screen.findByTestId("students")).textContent).not.toContain("stale-local-student");
    await waitFor(() => expect(window.localStorage.getItem("chos.operations.students.v1")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Add Student" }));

    await waitFor(() => expect(screen.getByTestId("students").textContent).toContain("student-"));
    expect(window.localStorage.getItem("chos.operations.students.v1")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("restores production messaging setup into Supabase app state instead of local storage", async () => {
    window.localStorage.setItem("chos.operations.twilioRelayEndpoint.v1", "https://local.example.test/relay");
    window.localStorage.setItem("chos.operations.pushServerEndpoint.v1", "https://local.example.test/push");
    window.localStorage.setItem("chos.operations.twilioLaunchProfile.v1", JSON.stringify({ messagingServiceSid: "MG_LOCAL" }));
    const backup = buildOperationsBackupSnapshot(
      makeBackupInput({
        messagingSetup: [
          {
            id: "production-messaging",
            twilioRelayEndpoint: "https://relay.example.test/api/messages/twilio",
            pushServerEndpoint: "https://push.example.test/api/push/subscriptions",
            webPushPublicKey: "BO_PUBLIC_WEB_PUSH_KEY",
            twilioLaunchProfile: {
              messagingServiceSid: "MG1234567890abcdef",
              smsSender: "+12625550100",
              inboundWebhookUrl: "https://relay.example.test/api/messages/inbound",
              statusCallbackBaseUrl: "https://relay.example.test/api/messages/status",
              relayHealthCheckUrl: "https://relay.example.test/api/messages/health",
              managerAuthMode: "server-session",
              senderType: "10dlc",
              a2pBrandStatus: "approved",
              a2pCampaignStatus: "approved",
              tollFreeVerificationStatus: "not-used",
              complianceNotes: "A2P approved for studio outreach.",
              savedAt: "2026-06-03T10:15:00.000Z"
            }
          }
        ]
      }),
      "2026-06-03T12:00:00.000Z"
    );
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/rest/v1/app_state_items") {
        if (init?.method === "POST" || init?.method === "DELETE") return emptyResponse();
        return jsonResponse([]);
      }
      if (requestUrl.pathname === "/rest/v1/direct_messages" || requestUrl.pathname === "/rest/v1/message_logs") {
        return jsonResponse([]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(
      <AppStateProvider>
        <RestoreMessagingSetupHarness rawBackup={JSON.stringify(backup)} />
      </AppStateProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Restore messaging setup" }));

    await waitFor(() => {
      const upsertBodies = fetchMock.mock.calls
        .map(([, init]) => init)
        .filter((init): init is RequestInit => init?.method === "POST")
        .map((init) => JSON.parse(String(init.body))) as Array<{ key: string; value: unknown }>;
      expect(upsertBodies).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: "chos.operations.twilioRelayEndpoint.v1",
          value: "https://relay.example.test/api/messages/twilio"
        }),
        expect.objectContaining({
          key: "chos.operations.pushServerEndpoint.v1",
          value: "https://push.example.test/api/push/subscriptions"
        }),
        expect.objectContaining({
          key: "chos.operations.twilioLaunchProfile.v1",
          value: expect.objectContaining({
            messagingServiceSid: "MG1234567890abcdef",
            managerAuthMode: "server-session",
            senderType: "10dlc"
          })
        })
      ]));
    });
    expect(window.localStorage.getItem("chos.operations.twilioRelayEndpoint.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.operations.pushServerEndpoint.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.operations.twilioLaunchProfile.v1")).toBeNull();
  });
});
