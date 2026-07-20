# New Account Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend-enforced **Access New Account** flow that requires every newly provisioned user to replace their temporary password before entering the Cho's workspace.

**Architecture:** Supabase Auth `app_metadata.requires_password_change` is the hosted source of truth. One shared pure activation contract is consumed by the browser adapter and both Edge Functions; the browser holds temporary credentials only in React memory, and a new authenticated `activate-account` function changes the password and clears the flag in one admin update. The local fallback mirrors the state machine with an optional `ManagedAccount.requiresPasswordChange` field while treating older records as already activated.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest/Testing Library, Supabase Auth/Edge Functions, CSS.

## Global Constraints

- Preserve the unrelated dirty files in the current workspace. Begin execution in an isolated worktree based on the latest `origin/main`, then bring in approved documentation commits `bfd1eb1` and the plan commit if they are not already present.
- Do not add dependencies or public self-registration.
- Keep Manager123, gated Dev123, and existing accounts without `requires_password_change: true` on their current login path.
- Require at least 12 characters with uppercase, lowercase, a number, and a symbol.
- Require the replacement password to differ from the temporary password.
- Never place a password in logs, URLs, error text, analytics, or any new browser-storage property.
- Do not create the Cho application session until activation succeeds.
- Preserve the launch animation, portrait positioning, subpath routing, light/dark themes, and phone/tablet/desktop behavior.
- Deployment order must avoid leaving newly flagged accounts with no activation endpoint or student lookup: deploy and verify `activate-account`, apply and verify `20260720010000_get_my_student_record.sql`, deploy and verify the updated `manager-create-account`, then deploy the frontend in the same release window.

## File Structure

- Create `supabase/functions/_shared/account-activation.ts`: pure password/metadata contract used by browser and Edge code.
- Create `src/accountActivationContract.test.ts`: Vitest coverage for the shared contract.
- Create `supabase/functions/activate-account/index.ts`: authenticated first-use password replacement endpoint.
- Modify `supabase/functions/manager-create-account/index.ts`: mark every newly provisioned user as activation-required.
- Modify `supabase/config.toml`: register the new function's explicit JWT configuration.
- Modify `src/supabaseAccounts.ts` and `src/supabaseAccounts.test.ts`: classify activation-required logins and call the activation function with the stored JWT.
- Modify `src/types.ts`, `src/state.tsx`, and `src/App.test.tsx`: mirror first-use activation in local mode without breaking older stored accounts.
- Create `src/ModalShell.tsx`: preserve the existing reusable accessible modal wrapper after extracting it from `App.tsx`.
- Create `src/NewAccountActivationModal.tsx`: focused two-step accessible activation UI.
- Modify `src/App.tsx`, `src/App.test.tsx`, and `src/styles.css`: wire both login entry points and responsive themed presentation.
- Modify `docs/supabase-auth-setup.md`, `docs/platform-inventory.md`, and `docs/live-qa-checklist.md`: document provisioning, deployment, and verification.

---

### Task 1: Shared activation contract and provisioning flag

**Files:**
- Create: `supabase/functions/_shared/account-activation.ts`
- Create: `src/accountActivationContract.test.ts`
- Modify: `supabase/functions/manager-create-account/index.ts:150-168`

**Interfaces:**
- Produces: `requiresPasswordChange(metadata: unknown): boolean`
- Produces: `activationRequiredAppMetadata(metadata?: unknown): Record<string, unknown>`
- Produces: `activatedAppMetadata(metadata?: unknown): Record<string, unknown>`
- Produces: `validateActivationPassword(newPassword: string, temporaryPassword: string): string | undefined`

- [ ] **Step 1: Write the failing shared-contract test**

```ts
import { describe, expect, it } from "vitest";
import {
  activatedAppMetadata,
  activationRequiredAppMetadata,
  requiresPasswordChange,
  validateActivationPassword
} from "../supabase/functions/_shared/account-activation";

describe("new-account activation contract", () => {
  it("treats only an explicit admin flag as activation-required", () => {
    expect(requiresPasswordChange(undefined)).toBe(false);
    expect(requiresPasswordChange({ requires_password_change: false })).toBe(false);
    expect(requiresPasswordChange({ requires_password_change: true })).toBe(true);
  });

  it("preserves metadata while setting and clearing the activation flag", () => {
    expect(activationRequiredAppMetadata({ role: "staff" })).toEqual({ role: "staff", requires_password_change: true });
    expect(activatedAppMetadata({ role: "staff", requires_password_change: true })).toEqual({ role: "staff", requires_password_change: false });
  });

  it("rejects weak or reused replacement passwords", () => {
    expect(validateActivationPassword("short", "TemporaryPass123!")).toMatch(/12 characters/i);
    expect(validateActivationPassword("TemporaryPass123!", "TemporaryPass123!")).toMatch(/different/i);
    expect(validateActivationPassword("PermanentPass456!", "TemporaryPass123!")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test -- src/accountActivationContract.test.ts`

Expected: FAIL because `supabase/functions/_shared/account-activation.ts` does not exist.

- [ ] **Step 3: Implement the pure shared contract**

```ts
export const accountPasswordPolicyText = "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.";

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
}

export function requiresPasswordChange(metadata: unknown) {
  return metadataRecord(metadata).requires_password_change === true;
}

export function activationRequiredAppMetadata(metadata?: unknown) {
  return { ...metadataRecord(metadata), requires_password_change: true };
}

export function activatedAppMetadata(metadata?: unknown) {
  return { ...metadataRecord(metadata), requires_password_change: false };
}

export function isStrongActivationPassword(password: string) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export function validateActivationPassword(newPassword: string, temporaryPassword: string) {
  const cleanedPassword = newPassword.trim();
  if (!isStrongActivationPassword(cleanedPassword)) return accountPasswordPolicyText;
  if (cleanedPassword === temporaryPassword.trim()) return "Choose a new password that is different from your temporary password.";
  return undefined;
}
```

- [ ] **Step 4: Mark newly created Supabase users as activation-required**

Import `activationRequiredAppMetadata` and change the existing `adminClient.auth.admin.createUser` call to:

```ts
const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
  email: authEmail,
  password,
  email_confirm: true,
  user_metadata: {
    username,
    role,
    display_name: displayName,
    contact_email: contactEmail
  },
  app_metadata: activationRequiredAppMetadata({ role })
});
```

- [ ] **Step 5: Run focused tests and type checking**

Run: `npm run test -- src/accountActivationContract.test.ts && npx tsc -p tsconfig.app.json --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit the contract and provisioning change**

```powershell
git add src/accountActivationContract.test.ts supabase/functions/_shared/account-activation.ts supabase/functions/manager-create-account/index.ts
git commit -m "feat: mark new accounts for activation"
```

### Task 2: Hosted login classification and activation endpoint

**Files:**
- Create: `supabase/functions/activate-account/index.ts`
- Modify: `supabase/config.toml`
- Modify: `src/supabaseAccounts.ts:4-360`
- Modify: `src/supabaseAccounts.test.ts:1-480`

**Interfaces:**
- Consumes: `requiresPasswordChange`, `activatedAppMetadata`, and `validateActivationPassword` from Task 1.
- Produces: `SupabaseLoginResult` branch `{ status: "activation-required"; sessionEmail: string; role: AccountRole; profile: SupabaseProfileResponse }`
- Produces: `activateSupabaseAccount(newPassword: string, temporaryPassword: string): Promise<SupabaseActivationResult>`

- [ ] **Step 1: Write failing adapter tests**

Add tests that return `user.app_metadata.requires_password_change: true` from `/auth/v1/token` and assert:

```ts
await expect(signInSupabaseAccount({ username: "jordan.staff", password: "TemporaryPass123!" })).resolves.toMatchObject({
  status: "activation-required",
  sessionEmail: "jordan.staff",
  role: "staff"
});
expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
```

Add an activation-call test with a stored staff session:

```ts
await expect(activateSupabaseAccount("PermanentPass456!", "TemporaryPass123!")).resolves.toEqual({ status: "ok" });
expect(fetchMock).toHaveBeenCalledWith(
  "https://project.supabase.co/functions/v1/activate-account",
  expect.objectContaining({
    method: "POST",
    headers: expect.objectContaining({ Authorization: "Bearer staff-access-token" }),
    body: JSON.stringify({ newPassword: "PermanentPass456!", temporaryPassword: "TemporaryPass123!" })
  })
);
```

Also assert missing/expired sessions return `session-expired`, weak/reused passwords return `error` without a fetch, 401 clears temporary auth state, and backend-inactive responses preserve the existing explicit message.

- [ ] **Step 2: Run adapter tests and verify RED**

Run: `npm run test -- src/supabaseAccounts.test.ts -t "activation"`

Expected: FAIL because the new status and `activateSupabaseAccount` do not exist.

- [ ] **Step 3: Extend the browser adapter**

Extend `SupabasePasswordResponse.user` with `app_metadata?: Record<string, unknown>`, export the login-result type, and add the activation-required branch after active-profile validation:

```ts
saveSupabaseAuthSession(session);
const authenticatedResult = {
  sessionEmail: sessionEmailForProfile(profile),
  role: profile.role,
  profile
};
if (requiresPasswordChange(session.user.app_metadata)) {
  return { status: "activation-required", ...authenticatedResult };
}
return { status: "authenticated", ...authenticatedResult };
```

Implement the client call:

```ts
export async function activateSupabaseAccount(newPassword: string, temporaryPassword: string): Promise<SupabaseActivationResult> {
  const validationMessage = validateActivationPassword(newPassword, temporaryPassword);
  if (validationMessage) return { status: "error", message: validationMessage };
  const session = readSupabaseAuthSession();
  if (!session) return { status: "session-expired", message: "Your temporary sign-in has expired. Start account access again." };

  try {
    const response = await fetch(`${supabaseUrl().replace(/\/+$/, "")}/functions/v1/activate-account`, {
      method: "POST",
      headers: {
        apikey: supabasePublicKey(),
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ newPassword: newPassword.trim(), temporaryPassword: temporaryPassword.trim() })
    });
    if (response.ok) return { status: "ok" };
    if (await isSupabaseBackendInactiveResponse(response)) return { status: "error", message: supabaseBackendInactiveMessage };
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
    if (response.status === 401 || response.status === 403) clearSupabaseAuthSession();
    return response.status === 401
      ? { status: "session-expired", message: "Your temporary sign-in has expired. Start account access again." }
      : { status: "error", message: body?.error ?? "Account activation failed. Please try again." };
  } catch (error) {
    return { status: "error", message: isSupabaseBackendInactiveError(error) ? supabaseBackendInactiveMessage : "Account activation failed. Please try again." };
  }
}
```

- [ ] **Step 4: Create the authenticated Edge Function**

Create `supabase/functions/activate-account/index.ts` with this complete request flow:

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { activatedAppMetadata, requiresPasswordChange, validateActivationPassword } from "../_shared/account-activation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: "Supabase function secrets are not configured." }, 500);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ error: "Missing temporary session." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse({ error: "Invalid temporary session." }, 401);

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("id, status")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.status !== "active") return jsonResponse({ error: "This account cannot be activated." }, 403);
  if (!requiresPasswordChange(authData.user.app_metadata)) return jsonResponse({ error: "This account is already active. Use Sign In." }, 409);

  let body: { newPassword?: unknown; temporaryPassword?: unknown };
  try { body = await req.json() as { newPassword?: unknown; temporaryPassword?: unknown }; }
  catch { return jsonResponse({ error: "Invalid JSON body." }, 400); }
  const newPassword = typeof body.newPassword === "string" ? body.newPassword.trim() : "";
  const temporaryPassword = typeof body.temporaryPassword === "string" ? body.temporaryPassword.trim() : "";
  const validationMessage = validateActivationPassword(newPassword, temporaryPassword);
  if (validationMessage) return jsonResponse({ error: validationMessage }, 400);
  if (!authData.user.email) return jsonResponse({ error: "This account cannot be activated." }, 403);
  const { error: passwordError } = await userClient.auth.signInWithPassword({
    email: authData.user.email,
    password: temporaryPassword
  });
  if (passwordError) return jsonResponse({ error: "Check the account name and temporary password." }, 401);

  const { error: updateError } = await adminClient.auth.admin.updateUserById(authData.user.id, {
    password: newPassword,
    app_metadata: activatedAppMetadata(authData.user.app_metadata)
  });
  if (updateError) return jsonResponse({ error: updateError.message }, 400);
  return jsonResponse({ status: "ok" });
});
```

Register it explicitly:

```toml
[functions.activate-account]
verify_jwt = false
```

The function still validates the bearer token itself, matching the existing manager function pattern and avoiding gateway/JWT incompatibility with publishable keys.

- [ ] **Step 5: Run the focused adapter and contract suites**

Run: `npm run test -- src/accountActivationContract.test.ts src/supabaseAccounts.test.ts`

Expected: PASS with no network calls for locally rejected input and no password content in error assertions.

- [ ] **Step 6: Commit hosted activation**

```powershell
git add src/supabaseAccounts.ts src/supabaseAccounts.test.ts supabase/config.toml supabase/functions/activate-account/index.ts
git commit -m "feat: add hosted account activation"
```

### Task 3: Local fallback activation state machine

**Files:**
- Modify: `src/types.ts:201-218`
- Modify: `src/state.tsx:219-245,420-435,2654-2695,2724-2762`
- Modify: `src/App.test.tsx:1740-1885,4965-5070`

**Interfaces:**
- Produces: `ManagedAccount.requiresPasswordChange?: boolean` and local `AccountRecord.requiresPasswordChange?: boolean`
- Changes: `loginCreatedAccount(credentials)` returns `{ status: "authenticated" | "activation-required"; account: CreatedAccountLoginResult } | undefined`
- Produces: `activateCreatedAccount(credentials: { username: string; temporaryPassword: string; newPassword: string }): Promise<{ status: "ok"; account: ManagedAccount | AccountRecord } | { status: "error"; message: string }>`

- [ ] **Step 1: Write failing local-state tests**

Extend the state harness and assert:

```ts
expect(createdAccount).toEqual(expect.objectContaining({ requiresPasswordChange: true }));
expect(loginCreatedAccount({ username: "jordan.staff", password: "TemporaryPass123!" })).toMatchObject({
  status: "activation-required",
  account: { username: "jordan.staff" }
});
expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
```

Then call `activateCreatedAccount` and assert the stored record has the new password, `requiresPasswordChange: false`, a session exists, the old password fails, and the new password returns `authenticated`. Repeat the activation assertion for a manager-created guardian in `chos.accounts.v1`. Add compatibility tests proving stored staff and guardian accounts with no new property sign in normally.

- [ ] **Step 2: Run the local tests and verify RED**

Run: `npm run test -- src/App.test.tsx -t "managed account activation|created-account login"`

Expected: FAIL because new accounts do not carry an activation flag and login still creates a session immediately.

- [ ] **Step 3: Add the optional type and activation-aware login result**

Add to `ManagedAccount` and the local `AccountRecord` interface:

```ts
requiresPasswordChange?: boolean;
```

Set `requiresPasswordChange: true` in `createManagedAccount`. Change successful managed-account login to return `activation-required` without `saveRoleForEmail` or `setSession` when the property is exactly `true`; return `authenticated` and preserve existing session behavior otherwise. Wrap registered and child-account success in the same `authenticated` result without changing their behavior.

Use this discriminated result shape:

```ts
type CreatedAccountRecord = ManagedAccount | AccountRecord | ChildAccount;
type CreatedAccountLoginResult =
  | { status: "authenticated"; account: CreatedAccountRecord }
  | { status: "activation-required"; account: ManagedAccount | AccountRecord };

if (managedAccount) {
  if (managedAccount.requiresPasswordChange === true) {
    return { status: "activation-required", account: managedAccount };
  }
  saveRoleForEmail(managedAccount.username, managedAccount.role);
  setSession({ email: managedAccount.username, remembered: true, createdAt: new Date().toISOString() });
  return { status: "authenticated", account: managedAccount };
}
```

Set `requiresPasswordChange: true` in both `createManagedAccount` and `createGuardianAccount`; child accounts remain on their existing parent-managed credential path.

- [ ] **Step 4: Implement strict local activation persistence**

Implement `activateCreatedAccount` so it validates through `validateActivationPassword`, locates either an active linked managed account or guardian `AccountRecord` with matching temporary credentials and `requiresPasswordChange === true`, builds the relevant updated account array, and performs guarded persistence to `chos.managedAccounts.v1` or `chos.accounts.v1` before changing React state:

```ts
try {
  window.localStorage.setItem(keys.managedAccounts, JSON.stringify(updatedAccounts));
} catch {
  return { status: "error", message: "Account activation could not be saved on this device. Check storage access and try again." };
}
updateManagedAccountsState(updatedAccounts);
saveRoleForEmail(updatedAccount.username, updatedAccount.role);
setSession({ email: updatedAccount.username, remembered: true, createdAt: new Date().toISOString() });
return { status: "ok", account: updatedAccount };
```

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- src/App.test.tsx -t "managed account activation|created-account login"`

Expected: PASS, including the blocked-storage failure that leaves the session empty.

- [ ] **Step 6: Commit local activation**

```powershell
git add src/types.ts src/state.tsx src/App.test.tsx
git commit -m "feat: enforce local first-login activation"
```

### Task 4: Access New Account modal and login routing

**Files:**
- Create: `src/ModalShell.tsx`
- Create: `src/NewAccountActivationModal.tsx`
- Modify: `src/App.tsx:1-25,328-570`
- Modify: `src/App.test.tsx:2650-3040`
- Modify: `src/styles.css:2832-3050`

**Interfaces:**
- Consumes: activation-required results from Tasks 2 and 3.
- Produces: `NewAccountActivationModal` props `{ open, pendingActivation?, busy, error, onVerify, onActivate, onCancel }`.

- [ ] **Step 1: Write failing component tests**

Add focused tests for these visible behaviors:

```ts
expect(screen.getByRole("button", { name: "Access New Account" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "Access New Account" }));
expect(screen.getByRole("dialog", { name: "Access new account" })).toBeInTheDocument();
expect(screen.getByLabelText("Account name")).toHaveAttribute("autocomplete", "username");
expect(screen.getByLabelText("Temporary password")).toHaveAttribute("autocomplete", "current-password");
```

Mock an activation-required Supabase response and assert both dedicated verification and ordinary **Sign In** reach a second step containing `New password` and `Confirm new password`, with no `chos.session.v1`. Assert mismatches, weak passwords, duplicate clicks, cancellation cleanup, already-activated guidance, inactive accounts, backend inactivity, successful role landing, and old-password rejection/new-password relogin.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm run test -- src/App.test.tsx -t "Access New Account|activation-required|temporary credentials"`

Expected: FAIL because the new button and modal are absent.

- [ ] **Step 3: Create the focused modal component**

Implement a two-step controlled form. The verify step renders labeled account-name and temporary-password inputs; the secure step renders labeled new-password and confirmation inputs, the policy text, `role="status"` feedback, and a submit button whose text changes to `Activating...`. Use `useRef`/`useEffect` to focus the first field after each step. On cancel, reset every field before calling `onCancel`. Do not put credentials in component props after cancellation or outside React state.

Use this public component contract and structure:

```tsx
type ActivationCredentials = { username: string; temporaryPassword: string };

type NewAccountActivationModalProps = {
  step: "verify" | "secure";
  busy: boolean;
  error: string;
  onVerify: (credentials: ActivationCredentials) => Promise<void>;
  onActivate: (password: string, confirmation: string) => Promise<void>;
  onCancel: () => void;
};

export function NewAccountActivationModal({ step, busy, error, onVerify, onActivate, onCancel }: NewAccountActivationModalProps) {
  const [username, setUsername] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstFieldRef.current?.focus(); }, [step]);

  const cancel = () => {
    setUsername("");
    setTemporaryPassword("");
    setPassword("");
    setConfirmation("");
    onCancel();
  };

  return (
    <ModalShell label="Access new account" onClose={cancel} panelClass="modal-card login-activation-modal">
      <form
        className="login-activation-content"
        onSubmit={(event) => {
          event.preventDefault();
          void (step === "verify"
            ? onVerify({ username, temporaryPassword })
            : onActivate(password, confirmation));
        }}
      >
        <h2>{step === "verify" ? "Access New Account" : "Secure Your Account"}</h2>
        {step === "verify" ? (
          <div className="login-activation-fields">
            <label>Account name<input ref={firstFieldRef} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
            <label>Temporary password<input autoComplete="current-password" type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} /></label>
          </div>
        ) : (
          <div className="login-activation-fields">
            <p>{accountPasswordPolicyText}</p>
            <label>New password<input ref={firstFieldRef} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>Confirm new password<input autoComplete="new-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          </div>
        )}
        {error && <p className="login-activation-error" role="status">{error}</p>}
        <button className="btn btn-red" type="submit" disabled={busy}>{busy ? (step === "verify" ? "Checking..." : "Activating...") : (step === "verify" ? "Continue" : "Activate Account")}</button>
        <button className="btn btn-ghost" type="button" onClick={cancel} disabled={busy}>Cancel</button>
      </form>
    </ModalShell>
  );
}
```

Move `ModalShell` from `App.tsx` into `src/ModalShell.tsx` and export it without changing its existing focus, Escape, backdrop-click, role, label, or close behavior; import the same component in `App.tsx` and `NewAccountActivationModal.tsx` rather than duplicating it.

- [ ] **Step 4: Wire both login entry points in `App.tsx`**

Add a `PendingActivation` React state containing source, username, temporary password, session email, and role. The dedicated verify handler calls the same Supabase/local credential adapters as normal Sign In, but an `authenticated` result clears the temporary Supabase auth session and reports `This account is already active. Use Sign In.` instead of entering the app. Normal Sign In enters only for `authenticated`; `activation-required` stores the in-memory pending activation and opens the secure step.

On activation success, call `login(sessionEmail, true, role)` only for Supabase; the local state action already creates the matching session. Clear all modal and pending state, then `navigate("/")`. On cancel, call `clearSupabaseAuthSession()`, clear the pending object, and close the modal.

Render the new action:

```tsx
<div className="login-secondary-actions">
  <button className="login-create" type="button" onClick={() => setNewAccountOpen(true)}>Create Account</button>
  <button className="login-access" type="button" onClick={openActivation}>Access New Account</button>
</div>
```

- [ ] **Step 5: Add scoped responsive and theme-aware styling**

Include `.login-access` in the existing shared button sizing/focus selectors, give it the existing steel/ice panel treatment, keep `.login-secondary-actions` at two equal columns on normal widths, and switch it to one column under the existing narrow/short-height login breakpoint. Add `.login-activation-modal`, `.login-activation-content`, `.login-activation-fields`, and `.login-activation-error` styles using current login variables. Do not add fixed heights.

- [ ] **Step 6: Run focused UI tests and keyboard E2E**

Run: `npm run test -- src/App.test.tsx -t "Access New Account|activation-required|temporary credentials"`

Run: `npm run test:e2e:keyboard`

Expected: PASS; no overlap or horizontal scrolling in the soft-keyboard cases.

- [ ] **Step 7: Commit the activation UI**

```powershell
git add src/ModalShell.tsx src/NewAccountActivationModal.tsx src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add access new account flow"
```

### Task 5: Documentation, full verification, and security review

**Files:**
- Modify: `docs/supabase-auth-setup.md`
- Modify: `docs/platform-inventory.md`
- Modify: `docs/live-qa-checklist.md`

**Interfaces:**
- Consumes: complete hosted/local/UI flow from Tasks 1-4.
- Produces: operator deployment and QA instructions with no credentials.

- [ ] **Step 1: Update operator documentation**

Document that `manager-create-account` sets `requires_password_change`, `activate-account` validates its own bearer token and active profile, the two functions must be deployed in the specified order, existing unflagged accounts remain activated, and test credentials belong only in the approved secret store.

- [ ] **Step 2: Run the complete automated verification ladder**

Run:

```powershell
npm run test
npx tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters
npm run build:pages
npm audit --audit-level=moderate
git diff --check
```

Expected: all tests and type checks pass; `dist/404.html` exists; audit reports no moderate-or-higher vulnerability introduced by this work; diff check is clean.

- [ ] **Step 3: Review the complete diff and search for secret leakage**

Run:

```powershell
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- src supabase docs
rg -n -S "TemporaryPass123|PermanentPass456|newPassword|temporaryPassword" src supabase docs --glob '!*.test.ts' --glob '!*.test.tsx'
```

Expected: only variable/property names appear in runtime code; no literal test passwords, logs, URLs, or persisted-password additions appear outside existing local fallback storage.

- [ ] **Step 4: Run rendered local QA**

Start with `npm.cmd run dev -- --host 127.0.0.1 --port 5173`, verify `http://127.0.0.1:5173/` returns 200, and exercise dark/light themes at 390x844, 768x1024, 1440x900, and a short-height soft-keyboard viewport. Verify launch handoff, both modal steps, focus, Escape/cancel cleanup, no overlap, and existing activated login.

- [ ] **Step 5: Commit docs and verification updates**

```powershell
git add docs/supabase-auth-setup.md docs/platform-inventory.md docs/live-qa-checklist.md
git commit -m "docs: document account activation operations"
```

### Task 6: Staging deployment and live proof

**Files:**
- No new source files; use the release artifacts and runbooks from Tasks 1-5.

**Interfaces:**
- Consumes: passing main-ready commits and Cho staging project `zfuwbbepsnmmlpgfkmhz`.
- Produces: deployed functions, published frontend, immutable run/commit proof, and a cleaned-up staging test account.

- [ ] **Step 1: Confirm identities and current hosted state**

Run `gh auth status`, `npx supabase projects list`, `git status -sb`, and fetch `https://xatori-dev.github.io/chos-martial-arts-operations-app/app-version.json`. Confirm the GitHub and Supabase identities are authorized for Xatori/Cho before changing hosted state.

- [ ] **Step 2: Deploy and probe the activation endpoint first**

Run:

```powershell
npx supabase functions deploy activate-account --project-ref zfuwbbepsnmmlpgfkmhz --no-verify-jwt
```

Send an unauthenticated POST with a non-secret sample body and confirm HTTP 401 with `Missing temporary session.` This proves the endpoint is reachable but not open.

- [ ] **Step 3: Publish the verified frontend and updated provisioning function in one release window**

Push the reviewed commits through the repository's normal `main` integration path, confirm `.github/workflows/deploy-pages.yml` succeeds, then immediately run:

```powershell
npx supabase functions deploy manager-create-account --project-ref zfuwbbepsnmmlpgfkmhz --no-verify-jwt
```

If either half fails, stop new test-account provisioning, preserve exact logs, and restore the last compatible function/frontend pair before continuing.

- [ ] **Step 4: Exercise a disposable real staging account**

Using the approved Manager123 secret-store credential, create one non-owner staging test account through the real manager UI. Verify:

1. **Access New Account** accepts the temporary credentials and requires a new password.
2. Regular **Sign In** with those same temporary credentials reaches the same secure-account step.
3. Weak, reused, and mismatched passwords are rejected.
4. Successful activation enters the correct role surface.
5. Logout/relogin rejects the temporary password and accepts the new password.
6. The browser console and network payloads expose no password outside the required Auth/function request bodies.

Delete the disposable Auth user/profile/audit row through the approved admin path after evidence is captured; do not delete or alter any real user.

- [ ] **Step 5: Record final proof and risk**

Record the final commit SHA, GitHub Pages workflow run ID, live `app-version.json` value, function deployment success, disposable account identifier, old-password rejection, new-password login success, tested viewport/theme matrix, and any exact remaining blocker. End only when there is no known in-scope risk or report `Blocked - Not Complete` with the concrete blocker.
