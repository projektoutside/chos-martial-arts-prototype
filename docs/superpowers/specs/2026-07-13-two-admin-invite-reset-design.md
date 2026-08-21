# Two-Administrator Invite-Only Reset Design

Date: 2026-07-13

## Objective

Reset the live Cho's Martial Arts application to a clean, invite-only starting point with exactly two fully privileged accounts: the Developer account (`Dev123`) and Manager account (`Manager1`). Remove all other authentication identities and all user-associated application data. Preserve the application schema, deployment configuration, migrations, and non-user infrastructure.

The supplied administrator passwords are operational secrets. They must be provisioned through a privileged server-side path and must never be committed, logged, added to reports, or exposed to the browser bundle.

## Current state

The live Supabase project currently contains 12 `public.profiles` rows and 12 matching `auth.users` rows. User-associated data also exists in account audit, saved app-state, live-chat, private-chat access, and message-log tables. The current profile schema enforces one owner and constrains that owner to the legacy `manager123` username. Several privileged server functions authorize an active staff profile with `is_owner = true`.

## Chosen approach

Use a controlled surgical reset:

1. Export a timestamped, private pre-reset snapshot of all public user-associated rows and non-secret Auth account metadata.
2. Preserve the existing Developer Auth identity where practical so known-good authentication wiring remains intact.
3. Provision the Manager identity as `Manager1` and set both supplied passwords through a privileged server-side operation.
4. Update the authorization schema to allow multiple active staff owners.
5. Mark both `Dev123` and `Manager1` as active staff owners with full application access.
6. Clear all user-associated data and remove all other Auth identities and profiles.
7. Enforce invite-only account creation and add database-backed first-login welcome state.

This is preferable to deleting and recreating every account because it keeps the working Developer identity while still delivering a clean two-account backend. Soft-deactivating old accounts was rejected because it would not produce the requested fresh state.

## Reset boundary

### Delete or clear

- All Auth users except the two approved administrators.
- All profiles except the two approved administrators.
- Account-creation audit rows from the old population.
- Saved user/app-state rows associated with the old population. Because the user requested a fresh start, the persisted shared operational state is also reset to the application's clean defaults where it contains old people, students, parents, schedules, or user-created records.
- Live-chat messages created during development/testing.
- Private rooms, memberships, messages, and access events.
- Direct messages, message logs, SMS consent rows, and Twilio relay-attempt rows associated with the old population.
- Auth sessions and refresh tokens for deleted identities through normal Auth-user deletion behavior. Existing sessions for the two retained administrators are invalidated after credential/authorization changes so new claims and first-login behavior are authoritative.

### Preserve

- Database schema, functions, RLS policies, extensions, migrations, and deployment configuration.
- Static application assets and source-controlled seed/default data.
- Supabase project configuration unrelated to the removed accounts.
- Cloudflare and Google Play release infrastructure.

## Administrator authorization model

Both administrators use the existing `staff` role and `is_owner = true` authorization contract. Remove the legacy single-owner unique index and username-specific owner check, replacing them with a constraint that an owner must be an active staff profile. This keeps existing privileged code paths compatible while allowing the two approved administrators to have identical full access.

All privileged Edge Functions and database functions must continue to require:

- an authenticated Supabase user;
- a matching active profile;
- `role = 'staff'`;
- `is_owner = true`.

No authorization decision may rely on user-editable Auth metadata.

## Invite-only account creation

Self-service registration is removed from the application interface. The login page does not show or expose a public Create Account workflow. Direct public signup must also be disabled in Supabase Auth configuration so hiding the button is not the security boundary.

The existing manager-created account workflow remains the only supported account-creation path. Both approved administrators can use it. New accounts may be staff, student, or guardian profiles, but they are never owners unless a future controlled administrative migration explicitly grants that status.

The server-side creation flow continues to validate uniqueness, role, status, student linkage, and requested access. It must reject unauthenticated, inactive, non-staff, and non-owner callers.

## First-login welcome popup

Add a nullable profile timestamp such as `welcome_seen_at`. Every newly invited account begins with this value unset.

After a successful login and authoritative profile load:

1. If `welcome_seen_at` is null, display a modal welcome message.
2. Dim the application behind the modal and block unrelated interaction while it is open.
3. Show the user's display name and a short role-appropriate message explaining that their account is ready.
4. When the user selects the primary acknowledgement action, persist `welcome_seen_at` using an owner-safe or self-service profile RPC/policy restricted to the signed-in user's own row.
5. Close the popup only after persistence succeeds. If persistence fails, keep it open and show a retryable error.
6. On later logins, the popup does not appear.

The two administrator accounts also begin with `welcome_seen_at` unset after the reset, so their next successful logins provide live proof of the one-time behavior.

The future spotlight coach-mark tutorial is explicitly out of scope. The schema should not prematurely mark tutorial completion; it may later add a separate onboarding-progress model.

## Reset execution and rollback safety

Before mutation, write a private local snapshot outside the Git repository containing:

- exported public user-associated rows;
- Auth user IDs, usernames/emails, timestamps, and status metadata;
- row counts for every reset table;
- the exact reset timestamp and Supabase project reference.

Do not export password hashes, access tokens, refresh tokens, API keys, or session secrets. Deleted users' original passwords cannot be recovered. The data snapshot permits record-level investigation and partial restoration, but deleted Auth credentials would require password resets if restoration were requested.

Run the reset in a transaction where database constraints permit. Order deletions around non-cascading private-chat foreign keys. Re-query exact counts immediately after completion.

## Error handling

- Abort before deletion if the snapshot cannot be created and verified.
- Abort if the target project reference does not exactly match the Cho production project.
- Abort if either approved administrator cannot be provisioned and verified before removing the remaining identities.
- Do not leave a state with zero working owner accounts.
- Treat account creation, password update, and welcome-state persistence failures as visible errors rather than falling back to local prototype authentication.
- Do not weaken RLS or expose service-role credentials to accomplish the reset.

## Verification

### Database

- Exactly two Auth users and exactly two profiles immediately after reset.
- No Auth users without profiles and no profiles without Auth users.
- Both usernames match case-insensitively to `Dev123` and `Manager1`.
- Both profiles are active staff owners with full access.
- All reset-target tables have the expected clean row counts.
- New profiles created by an administrator default to non-owner and `welcome_seen_at = null`.
- Security advisors show no new findings caused by the migration.

### Authentication and authorization

- `Dev123` signs in with the supplied credential and can access every administrative tool.
- `Manager1` signs in with the supplied credential and can access every administrative tool.
- Legacy and removed usernames cannot sign in.
- Public self-registration is rejected at both UI and backend boundaries.
- Each administrator can create an invited test account through the supported workflow.
- A non-owner invited account cannot call privileged account-creation functionality.

### Welcome behavior

- A newly invited user sees the welcome popup after the first successful login.
- The background is inert while the popup is open.
- A failed acknowledgement write leaves a clear retry state.
- Successful acknowledgement sets `welcome_seen_at`.
- Logout and a second successful login do not show the popup again.

### Application quality

- Focused Auth, account-management, and welcome-popup tests pass.
- Full unit/integration suite passes.
- Type check and production web build pass.
- Stable and testing Android variant checks pass.
- Live browser smoke tests pass for both approved administrators and one temporary invited user; the temporary test user is removed afterward so the final backend returns to exactly two profiles.

## Completion criteria

The task is complete only when the live backend contains exactly the two requested working administrators, all old user-associated data is cleared, self-registration is disabled, administrator-created accounts are the only onboarding route, the first-login welcome popup is verified once-only, all tests/builds pass, and the final live database is returned to exactly two profiles after test cleanup.
