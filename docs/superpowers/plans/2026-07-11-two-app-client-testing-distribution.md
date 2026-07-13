# Cho's Two-App Client Testing Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver separately installable, privately distributed Android apps named Cho's Martial Arts and Cho's Testing, with stable-service isolation, deterministic fake demo data, signed Play bundles, and repeatable closed-testing releases.

**Architecture:** Add a typed build-environment policy at the web boundary, then route every Supabase and real-delivery capability through that fail-closed policy. Use Android Gradle product flavors for stable and testing identities, while GitHub Actions builds and validates each flavor independently before an explicit Play upload.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, Capacitor 8, Android Gradle, GitHub Actions, Google Play Android Publisher API.

## Global Constraints

- Stable Android application ID remains exactly `com.xatoridev.chosmartialarts`.
- Testing Android application ID is exactly `com.xatoridev.chosmartialarts.testing`.
- Testing display name is exactly `Cho's Testing` and must carry an orange `TEST` icon badge plus an in-app `Demo Environment` label.
- Testing builds must not contain or load stable Supabase credentials or send real SMS, email, push, or payment requests.
- Both apps use Google Play closed testing only; no public or production-track publishing is authorized.
- Keep one repository with `main` for stable and `testing` for experiments; promote focused approved commits only.
- Preserve unrelated dirty work and do not commit secrets, `.jks`, `android/key.properties`, or Play service-account JSON.
- Signed release outputs are Android App Bundles (`.aab`), and Android version codes are never reused.
- Apple/TestFlight work is documentation-only until separately authorized.

## File Structure

- `src/appEnvironment.ts`: typed source of truth for stable versus demo behavior and allowed capabilities.
- `src/appEnvironment.test.ts`: fail-closed environment-policy tests.
- `src/demoData.ts`: deterministic, fake-only demo records and reset seed.
- `src/demoData.test.ts`: fixture identity, repeatability, and no-real-contact tests.
- `src/DemoEnvironmentBadge.tsx`: persistent accessible demo label.
- `src/App.tsx`, `src/OperationsApp.tsx`, `src/state.tsx`: consume policy and demo state without embedding build rules.
- `src/supabase*.ts`, `src/twilioSupabaseMessaging.ts`, `src/webPushContract.ts`: reject remote behavior in demo mode.
- `android/app/build.gradle`: stable/testing product flavors, IDs, names, icons, version codes, and signing.
- `android/app/src/testing/res/**`: testing-only name and badged launcher assets.
- `scripts/verify-android-variant.mjs`: artifact/config identity and isolation verification.
- `scripts/verify-demo-artifact.mjs`: compiled-output scan for forbidden stable endpoints and capabilities.
- `.github/workflows/release-android-testing.yml`: explicit testing build and closed-track upload.
- `.github/workflows/release-android-stable.yml`: explicit stable build and closed-track upload.
- `docs/google-play-closed-testing-runbook.md`: owner steps, tester links, releases, promotion, and rollback.
- `docs/apple-testflight-next-phase.md`: non-executing Apple extension checklist.

---

### Task 1: Fail-Closed Application Environment Policy

**Files:**
- Create: `src/appEnvironment.ts`
- Create: `src/appEnvironment.test.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `AppEnvironment`, `appEnvironment`, `assertRemoteCapability(capability)`, and `isDemoEnvironment()`.

- [ ] **Step 1: Write failing policy tests**

Test `resolveAppEnvironment({ VITE_APP_VARIANT: "testing" })` returns `kind: "demo"`, all remote capabilities false, and no backend URL; test missing/unknown variants throw during production builds; test stable accepts only the Cho project host `zfuwbbepsnmmlpgfkmhz.supabase.co`.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npx vitest run src/appEnvironment.test.ts`
Expected: FAIL because `appEnvironment.ts` does not exist.

- [ ] **Step 3: Implement the typed policy**

```ts
export type AppVariant = "stable" | "testing";
export type RemoteCapability = "supabase" | "sms" | "email" | "push" | "payments";
export interface AppEnvironment {
  variant: AppVariant;
  kind: "stable" | "demo";
  displayName: "Cho's Martial Arts" | "Cho's Testing";
  demo: boolean;
  supabaseUrl: string;
  capabilities: Readonly<Record<RemoteCapability, boolean>>;
}
export function resolveAppEnvironment(env: ImportMetaEnv): AppEnvironment;
export const appEnvironment = resolveAppEnvironment(import.meta.env);
export function isDemoEnvironment(): boolean;
export function assertRemoteCapability(capability: RemoteCapability): void;
```

Testing must ignore Supabase variables and return an empty URL. Stable must reject any non-Cho Supabase hostname. `assertRemoteCapability` must throw `Remote capability <name> is disabled in the demo environment.`

- [ ] **Step 4: Document exact build variables**

Add `VITE_APP_VARIANT=stable` to `.env.example` with allowed values `stable|testing`; add its type to `vite-env.d.ts`.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/appEnvironment.test.ts && npm run build`
Expected: PASS and a successful TypeScript/Vite build.

Commit: `git commit -m "feat: add fail-closed app environment policy"`

### Task 2: Deterministic Fake Demo Data

**Files:**
- Create: `src/demoData.ts`
- Create: `src/demoData.test.ts`
- Modify: `src/state.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `isDemoEnvironment()` from Task 1.
- Produces: `DEMO_DATA_VERSION`, `createDemoState()`, `resetDemoState(storage)`, and demo-only local-storage namespace `chos.testing.demo.v1`.

- [ ] **Step 1: Write failing fixture tests**

Assert two calls to `createDemoState()` are deeply equal; every email ends in `@example.com`; every phone uses reserved fictional `555-01xx` numbers; reset deletes only keys beginning `chos.testing.demo.`; no fixture contains the stable Supabase ref or real delivery endpoint.

- [ ] **Step 2: Confirm the tests fail**

Run: `npx vitest run src/demoData.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Create complete realistic fixtures**

Build typed fake students, guardians, staff, classes, attendance, schedules, conversations, events, merchandise, reports, and update history using existing contracts from `src/types.ts`. Use fixed IDs and dates so demonstrations and screenshots remain repeatable.

- [ ] **Step 4: Route testing state to the demo namespace**

In `state.tsx`, select `createDemoState()` only when `isDemoEnvironment()` is true. Keep stable storage keys and Supabase-backed behavior unchanged. Demo writes remain device-local and resettable.

- [ ] **Step 5: Add integration coverage**

Add an app test proving a testing-mode login renders named fake records without invoking `fetch`; add a reset test proving stable local-storage keys remain untouched.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run src/demoData.test.ts src/App.test.tsx`
Expected: PASS with zero unexpected network calls.

Commit: `git commit -m "feat: add deterministic Cho testing demo data"`

### Task 3: Demo Branding and Remote-Service Guards

**Files:**
- Create: `src/DemoEnvironmentBadge.tsx`
- Create: `src/DemoEnvironmentBadge.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/OperationsApp.tsx`
- Modify: `src/styles.css`
- Modify: `src/supabaseAccounts.ts`
- Modify: `src/supabaseAppStatePersistence.ts`
- Modify: `src/supabaseLiveChat.ts`
- Modify: `src/supabaseMessagePersistence.ts`
- Modify: `src/twilioSupabaseMessaging.ts`
- Modify: `src/webPushContract.ts`

**Interfaces:**
- Consumes: `appEnvironment` and `assertRemoteCapability` from Task 1.
- Produces: accessible `DemoEnvironmentBadge` and guarded service entrypoints.

- [ ] **Step 1: Write failing UI and guard tests**

Assert demo mode always renders `Demo Environment`; stable mode never renders it. For every remote module, assert its public request entrypoint rejects before calling `fetch` when the relevant capability is disabled.

- [ ] **Step 2: Confirm focused failures**

Run: `npx vitest run src/DemoEnvironmentBadge.test.tsx src/supabaseAccounts.test.ts src/supabaseAppStatePersistence.test.ts src/supabaseLiveChat.test.ts src/supabaseMessagePersistence.test.ts src/twilioSupabaseMessaging.test.ts src/webPushContract.test.ts`
Expected: FAIL on missing badge and missing demo guards.

- [ ] **Step 3: Implement the persistent badge**

Render `<aside className="demo-environment-badge" role="status">Demo Environment</aside>` at the authenticated shell level. Style it compactly with Cho theme variables and an orange accent in both light and dark themes.

- [ ] **Step 4: Guard every remote boundary**

Call `assertRemoteCapability(...)` before constructing clients, endpoints, subscriptions, notifications, or requests. Demo UI actions must return a clear harmless message such as `Demo only — no message was sent.` rather than silently pretending a real send succeeded.

- [ ] **Step 5: Run full verification and commit**

Run: `npm run test && npm run build`
Expected: all tests and build PASS.

Commit: `git commit -m "feat: isolate and label the demo environment"`

### Task 4: Android Stable and Testing Product Flavors

**Files:**
- Modify: `android/app/build.gradle`
- Modify: `capacitor.config.json`
- Create: `android/app/src/stable/res/values/strings.xml`
- Create: `android/app/src/testing/res/values/strings.xml`
- Create: `android/app/src/testing/res/mipmap-*/ic_launcher.png`
- Create: `android/app/src/testing/res/mipmap-*/ic_launcher_round.png`
- Create: `android/app/src/testing/res/mipmap-anydpi-v26/ic_launcher.xml`
- Create: `android/app/src/testing/res/mipmap-anydpi-v26/ic_launcher_round.xml`
- Create: `scripts/verify-android-variant.mjs`
- Create: `scripts/verify-android-variant.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces Gradle tasks `bundleStableRelease` and `bundleTestingRelease`, plus `npm run build:android:stable`, `npm run build:android:testing`, and `npm run verify:android:<variant>`.

- [ ] **Step 1: Write failing variant-contract tests**

Assert stable resolves to existing ID/name and testing resolves to `.testing`/`Cho's Testing`; assert separate integer version codes; assert testing launcher resources differ from stable and include the generated badged source hash.

- [ ] **Step 2: Confirm contract failure**

Run: `node --test scripts/verify-android-variant.test.mjs`
Expected: FAIL because flavors do not exist.

- [ ] **Step 3: Add Gradle flavors**

Use flavor dimension `environment`. Keep `applicationId "com.xatoridev.chosmartialarts"` in `defaultConfig`; define `stable` without a suffix and `testing` with `applicationIdSuffix ".testing"`. Supply names and version codes through flavor resources/properties while retaining the existing release signing config.

- [ ] **Step 4: Add testing-branded launcher assets**

Generate the orange `TEST` badge with the approved image-generation workflow, then create Android density resources from the approved source. Preserve the original stable assets byte-for-byte.

- [ ] **Step 5: Add scripts and verify both bundles locally**

Run: `npm run build:android:stable` and `npm run build:android:testing`.
Expected outputs:
`android/app/build/outputs/bundle/stableRelease/app-stable-release.aab`
and `android/app/build/outputs/bundle/testingRelease/app-testing-release.aab`.

Inspect each bundle with `bundletool dump manifest` and confirm the exact application ID and label.

- [ ] **Step 6: Commit**

Commit: `git commit -m "feat: add separate stable and testing Android apps"`

### Task 5: Compiled Demo-Artifact Isolation Gate

**Files:**
- Create: `scripts/verify-demo-artifact.mjs`
- Create: `scripts/verify-demo-artifact.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: built `dist` and testing `.aab` from Task 4.
- Produces: `npm run verify:demo-artifact` with nonzero exit on forbidden content.

- [ ] **Step 1: Write red/green scanner fixtures**

Create temporary fixture directories in the Node test containing a safe demo asset and deliberately forbidden strings: `zfuwbbepsnmmlpgfkmhz`, `supabase.co`, `functions/v1/twilio-messaging`, and stable-only environment metadata. Assert only the safe fixture passes.

- [ ] **Step 2: Run and confirm failure**

Run: `node --test scripts/verify-demo-artifact.test.mjs`
Expected: FAIL before the scanner exists.

- [ ] **Step 3: Implement recursive compiled-output scanning**

Scan text-bearing files in `dist`, unpack the testing AAB to a temporary project-local folder, and scan packaged web assets. Print the offending relative file and rule name without printing secrets.

- [ ] **Step 4: Verify real artifacts and commit**

Run: `npm run build:android:testing && npm run verify:demo-artifact`
Expected: PASS with `Testing artifact contains no stable-service references.`

Commit: `git commit -m "test: block stable services from demo artifacts"`

### Task 6: Independent GitHub Android Release Workflows

**Files:**
- Create: `.github/workflows/release-android-testing.yml`
- Create: `.github/workflows/release-android-stable.yml`
- Create: `scripts/validate-play-release-input.mjs`
- Create: `scripts/validate-play-release-input.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: build scripts and gates from Tasks 1-5.
- Produces: two `workflow_dispatch` workflows targeting only their matching Play package and closed track.

- [ ] **Step 1: Test the destination validator**

Assert `{variant: "testing", packageName: "com.xatoridev.chosmartialarts.testing", track: "closed"}` passes; mismatched package, stable/testing crossovers, `production`, `beta`, or blank release notes fail.

- [ ] **Step 2: Implement explicit workflow inputs and validation**

Each workflow accepts `version_name`, `version_code`, and `release_notes`. Validate integers and identity before dependency installation. Use protected environments `google-play-testing` and `google-play-stable`.

- [ ] **Step 3: Add build, test, signing, upload, and evidence steps**

Decode the upload keystore and Play service-account JSON only into runner temporary files; run tests, build the matching AAB, execute identity/isolation checks, upload to the configured closed-testing track, and upload the AAB plus a manifest containing commit SHA, version, package ID, workflow run, and release notes.

- [ ] **Step 4: Prove dry-run safety**

Run local YAML/schema checks and validator tests. Trigger each workflow with upload disabled through an explicit repository variable `PLAY_UPLOAD_ENABLED=false`; confirm both build artifacts but neither contacts Google Play.

- [ ] **Step 5: Commit**

Commit: `git commit -m "ci: add isolated Google Play closed releases"`

### Task 7: Play Console Configuration and First Closed Releases

**Files:**
- Create: `docs/google-play-closed-testing-runbook.md`
- Create locally only: `docs/release-evidence/google-play/<date>-first-release.md` (do not include secrets or tester emails)

**Interfaces:**
- Consumes: signed AABs and workflows from Task 6.
- Produces: two verified closed-testing install links and traceable first releases.

- [ ] **Step 1: Inventory the existing Play record without mutation**

Confirm the active developer account, existing Cho's Martial Arts app name, exact package ID, app-signing status, policy/declaration status, and available testing tracks. Stop on package mismatch or wrong account.

- [ ] **Step 2: Document owner-required declarations**

Write beginner-friendly exact steps for app access, ads, content rating, target audience, data safety, privacy policy, countries, tester Google Group/list, and Play App Signing. Mark legal answers as owner-confirmed rather than inferred.

- [ ] **Step 3: Configure stable closed testing**

Create or verify the closed tester group, add the owner-provided Google accounts, upload the verified stable AAB, add release notes, and obtain the stable invitation link. Do not enable production access.

- [ ] **Step 4: Create Cho's Testing and configure closed testing**

Create the Play record using `com.xatoridev.chosmartialarts.testing`, upload the testing listing/icon and verified testing AAB, enroll in Play App Signing, apply accurate demo-app declarations, attach the same approved tester group, and obtain the separate invitation link.

- [ ] **Step 5: Record exact evidence**

Record both package IDs, version names/codes, Git SHA, workflow run IDs, Play release state, and invitation URLs. Tester email addresses and credentials must not be committed.

- [ ] **Step 6: Commit the runbook only**

Commit: `git commit -m "docs: add Google Play closed testing runbook"`

### Task 8: Real-Device Proof, Promotion Drill, and Apple Handoff

**Files:**
- Create: `docs/apple-testflight-next-phase.md`
- Modify: `docs/google-play-closed-testing-runbook.md`
- Create locally only: `docs/release-evidence/google-play/<date>-device-proof.md`

**Interfaces:**
- Consumes: both Play invitation links from Task 7.
- Produces: observable acceptance proof and a bounded Apple next-phase brief.

- [ ] **Step 1: Install both apps from Google Play on one Android device**

Confirm two launcher entries, exact names, distinct icons, independent app-info package IDs, and independent update records.

- [ ] **Step 2: Exercise demo isolation**

Open Cho's Testing, verify the persistent badge and fake records, attempt each available messaging/notification action, and confirm no stable Supabase request or real delivery occurs. Reset demo data and confirm the deterministic starting state returns.

- [ ] **Step 3: Exercise stable behavior**

Open Cho's Martial Arts, confirm no demo badge, authenticate through the currently approved Cho environment, and smoke-test the stable manager/profile path without changing real customer or payment behavior.

- [ ] **Step 4: Run a no-op promotion drill**

Create a disposable focused commit on a branch based on `testing`, transfer only that commit to a branch based on `main`, compare diffs, and delete the disposable branches after proving no unrelated testing commits moved. Do not publish this drill.

- [ ] **Step 5: Document the Apple extension**

Record the proposed stable/testing bundle IDs, two TestFlight app records, separate icons, fake-data reuse, certificates/profiles, App Store Connect privacy declarations, tester groups, and required Apple-account access. State clearly that execution waits for separate approval.

- [ ] **Step 6: Run final quality gate and commit**

Run: `npm run test && npm run build:android:stable && npm run build:android:testing && npm run verify:demo-artifact && git diff --check`
Expected: all PASS; two signed AABs have distinct package IDs and install together through Play.

Commit: `git commit -m "docs: verify two-app client testing releases"`

## Final Release Checklist

- [ ] Stable package is `com.xatoridev.chosmartialarts`.
- [ ] Testing package is `com.xatoridev.chosmartialarts.testing`.
- [ ] Cho's Testing has the orange `TEST` launcher badge and persistent demo label.
- [ ] Compiled testing assets contain no stable Supabase project reference.
- [ ] Real-delivery operations fail closed in testing.
- [ ] Both Play releases remain closed/private.
- [ ] Both invitation URLs install independently on the same device.
- [ ] Release evidence includes versions, commits, workflow runs, and Play states.
- [ ] Unrelated experiments do not move into `main` during the promotion drill.
- [ ] Apple work remains unexecuted and separately authorized.
