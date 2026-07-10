# Cho's Martial Arts Release QA Checklist

Date: 2026-07-10

## Release target and evidence

- [ ] Confirm `main`, remote, commit, dirty-worktree ownership, and release version.
- [ ] Confirm intended web, PWA, and Android targets and supported browsers/devices.
- [ ] Confirm Cloudflare Pages project, permanent URL, immutable deployment URL, and `app-version.json` commit.
- [ ] Confirm GitHub `Verify main web release` workflow succeeds for the final commit.
- [ ] Confirm Android package, SDK levels, version code/name, signing configuration, and release build.

## Architecture and configuration

- [ ] Inventory routes/screens, modules, roles, access keys, services, storage layers, and external integrations.
- [ ] Verify required environment variable names without exposing values.
- [ ] Verify production builds cannot silently fall back to prototype/local-only authority when Supabase is configured.
- [ ] Verify secrets and private credentials are excluded from source, public assets, logs, and release artifacts.
- [ ] Verify SPA deep-link fallback, service-worker registration, update behavior, and cache invalidation.

## Startup, navigation, and session lifecycle

- [ ] Cold start, refresh, back/forward, deep links, unknown routes, and repeated navigation.
- [ ] Guest/new/returning login flows, empty/invalid credentials, repeated submit, logout, and relogin.
- [ ] Remembered and non-remembered sessions survive or clear correctly after refresh/restart.
- [ ] Expired/invalid Supabase sessions fail closed and show understandable feedback.
- [ ] Loading, empty, offline, timeout, and backend-error states remain usable.

## Role and authorization coverage

- [ ] Manager owner paths and owner-only account creation.
- [ ] Developer diagnostic account restrictions.
- [ ] Staff access-key restrictions across direct URLs and UI navigation.
- [ ] Student access restricted to the linked active student.
- [ ] Guardian access restricted to linked child data.
- [ ] Unauthorized users cannot read, create, update, or delete other users' records through UI or direct API calls.

## Core operations workflows

- [ ] Dashboard and reports render accurate empty/populated states.
- [ ] Students: create, duplicate, invalid, long/special input, edit, deactivate/reactivate, delete, search, and refresh persistence.
- [ ] Classes/scheduling: create, edit, stale/invalid records, reminders, conflicts, and persistence.
- [ ] Check-ins: repeated taps, inactive students, milestones, and queued-message side effects.
- [ ] Events/calendar: create/edit/delete, reminders, `.ics` export, invalid dates, and refresh persistence.
- [ ] Merchandise/orders: CRUD, quantities, stock thresholds, duplicate submissions, and persistence.
- [ ] Backup/import/export: valid, invalid, oversized, corrupt, and stale snapshots; recovery and role/session safety.
- [ ] Settings/themes/update history: keyboard navigation, persistence, refresh, and role scoping.

## Messaging, notifications, and integrations

- [ ] Live chat and direct messages persist through Supabase and refresh/relogin.
- [ ] Cross-user isolation and active-profile membership are enforced by RLS/server checks.
- [ ] Message queue prevents duplicate sends and honors student/guardian/staff consent and opt-out state.
- [ ] Twilio relay health/send/inbound/status routes require valid auth, permissions, signatures, rate limits, and idempotency.
- [ ] Browser/Web Push contracts contain no private keys and fail safely when unsupported or denied.
- [ ] Offline/retry behavior does not report messages as sent when the backend/provider failed.

## Responsive UI, input, and accessibility

- [ ] Phone, tablet, desktop, portrait, landscape, narrow/short screens, and browser zoom.
- [ ] Touch, mouse, keyboard-only, rapid/repeated clicks, focus order, focus trap/return, and Escape behavior.
- [ ] All text inputs remain visible while the phone keyboard is open without shifting or clipping the app.
- [ ] Dialogs, drawers, menus, dropdowns, toasts, errors, and validation are readable and operable.
- [ ] Labels, roles, headings, alt text, contrast, reduced motion, touch targets, and screen-reader status feedback.
- [ ] Dark/light/custom themes do not hide, overlap, or truncate controls.

## Security and data safety

- [ ] RLS/table grants/function authorization match intended roles and ownership.
- [ ] Direct URL/API access, manipulated IDs, stale sessions, and role escalation attempts fail closed.
- [ ] Injection-like text, dangerous HTML/URLs, oversized inputs, and upload/import abuse are handled safely.
- [ ] Sensitive fields are not exposed in client bundles, logs, errors, exports, localStorage, or service-worker caches.
- [ ] Rate limiting, replay/idempotency, webhook signatures, and audit trails are present where provider actions exist.
- [ ] Dependency audit has no unresolved moderate-or-higher release blocker.

## Performance and reliability

- [ ] Production bundle builds cleanly; large chunks/assets are measured and reviewed.
- [ ] Startup and key interactions remain responsive under CPU/network throttling and repeated use.
- [ ] Large lists/data sets do not cause major layout, memory, or interaction failures.
- [ ] Offline start/recovery, service-worker update, multi-tab behavior, and stale-cache recovery work.
- [ ] No critical console, network, unhandled rejection, React, or service-worker errors on live production.

## Final release gate

- [ ] Focused regression tests pass for every fix.
- [ ] Full unit/integration tests pass.
- [ ] Browser E2E passes on phone, iPhone, and desktop projects.
- [ ] TypeScript and production web build pass.
- [ ] Android release verification/build passes when Android is in release scope.
- [ ] Live production commit, key flows, deep links, and backend persistence are verified.
- [ ] Test data is cleaned up when safe, and remaining external blockers are documented precisely.

## 2026-07-10 execution record

### Passed

- [x] Architecture, routes, roles, access keys, Supabase services, environment names, storage paths, release commands, and deployment workflow inventoried.
- [x] Mobile keyboard editor now uses the true visible-viewport midpoint, including nonzero browser-chrome offsets; focused regression test passes.
- [x] Limited staff access is enforced both in launcher visibility and direct operation routes; focused regression test passes.
- [x] Hosted Supabase RLS blocks student-role access to sensitive order, contact, student-directory, and campaign state while retaining member content and staff access.
- [x] Hosted migration `20260710121652_restrict_app_state_read_access` applied; post-change security advisor reports no RLS warning.
- [x] Dependency audit: zero known vulnerabilities at moderate-or-higher severity.
- [x] Full Vitest suite: 33 files, 614 passed, 52 skipped.
- [x] Keyboard browser E2E: 14 passed across Chromium phone, WebKit iPhone, and desktop; 10 intentional project-inapplicable skips.
- [x] Login portrait browser E2E: 6 passed across Chromium phone, WebKit iPhone, and desktop.
- [x] TypeScript and Cloudflare production build pass.
- [x] Android release configuration verified: `com.xatoridev.chosmartialarts`, version `0.1.5` (6), target SDK 36.

### Open findings / follow-up

- [ ] Twilio production sending remains externally blocked and requires durable server-side rate limits, atomic idempotency, and retry-safe inbound/status persistence before enabling live SMS.
- [ ] Supabase leaked-password protection is disabled at the account level; enable it in Auth settings before broad public onboarding.
- [ ] Large uploads are stored as base64 shared state without a hard size cap; migrate media to object storage before allowing untrusted uploads.
- [ ] Add full authenticated browser E2E for login, role CRUD, refresh/relogin persistence, offline recovery, modal focus trapping, and 200%/400% zoom.
- [ ] Reduce the authenticated bundle (`OperationsApp` about 581 kB, CSS about 525 kB) and optimize remaining large PNG assets.
- [ ] Review and deliberately re-enable or replace the 52 skipped unit scenarios; current passing coverage is strong but not exhaustive.
