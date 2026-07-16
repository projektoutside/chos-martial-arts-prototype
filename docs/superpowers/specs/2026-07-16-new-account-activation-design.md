# New Account Activation Design

## Goal

Make normal login reliable for existing Cho's accounts and add an **Access New Account** flow for first-time users. A user who receives a temporary account name and password must replace that password before entering the app. The requirement must be enforced by the hosted authentication system and mirrored by the local prototype fallback.

## Current Behavior

The login page has a shared username/password form, a **Sign In** button, and a **Create Account** button. **Create Account** correctly explains that a Manager, Staff member, or Developer provisions accounts; it does not create a public self-service account.

When Supabase is configured, the shared form can authenticate manager-created accounts against Supabase Auth and the `profiles` table. Without Supabase, it can authenticate locally managed prototype accounts. Neither path currently distinguishes a temporary first-use password from a permanent password, so the app cannot require activation before entry.

## User Experience

The existing login layout, launch animation, portrait treatment, and account-provisioning message remain intact. A third action, **Access New Account**, is added to the login panel using the established Cho's visual language.

### Dedicated Activation Flow

Selecting **Access New Account** opens an accessible modal with two steps:

1. **Verify account** — collect Account Name and Temporary Password.
2. **Secure account** — collect New Password and Confirm New Password after the temporary credentials are accepted.

The modal displays progress, disables repeat submission while a request is pending, and keeps the user in the current step when validation or a request fails. A successful password replacement signs the user in and routes them to the same role-appropriate landing surface used by normal login.

If the credentials belong to an account that is already activated, the dedicated flow does not create another activation. It tells the user that the account is already active and directs them to **Sign In**.

### Regular Sign In

Normal **Sign In** continues to authenticate existing activated accounts. If valid temporary credentials are entered there, the app does not create an application session or enter the workspace. It automatically opens the activation modal at the **Secure account** step with the verified temporary authentication session.

Manager123, the gated Dev123 diagnostic account, and existing accounts without an activation requirement retain their current login behavior.

## Hosted Authentication Design

### Authoritative State

New manager-created Supabase Auth users receive an admin-controlled app-metadata field:

```text
requires_password_change: true
```

The field is stored in `app_metadata`, not browser storage or editable user metadata. The existing `manager-create-account` Edge Function sets it when provisioning a new user. Existing users without the field are treated as already activated so this rollout does not unexpectedly lock out current accounts.

### Login Result

The Supabase password-grant response already returns the authenticated user. The app extends its typed response handling to inspect `user.app_metadata.requires_password_change` and return one of three successful credential outcomes:

- `authenticated` for an active profile with no password-change requirement.
- `activation-required` for an active profile whose app metadata requires a password change.
- `already-activated` is derived by the dedicated activation UI when it receives `authenticated`; it is a UI outcome, not a separate backend authentication state.

An inactive profile remains rejected before either application entry or activation.

The temporary Supabase session may be retained only in the existing project-scoped Supabase authentication storage long enough to call the activation endpoint. It must not create the Cho application session until activation succeeds.

### Activation Endpoint

A focused authenticated Edge Function completes activation. It:

1. Requires a bearer token from the just-verified password grant.
2. Resolves and validates the authenticated user and active Cho profile.
3. Confirms `requires_password_change` is true.
4. Validates the replacement password using the existing minimum policy.
5. Rejects a replacement equal to the supplied temporary password before the request is sent and rejects any backend policy failure.
6. Performs one admin Auth user update containing both the new password and `requires_password_change: false` app metadata.
7. Returns only the minimum account result required by the client.

The endpoint never accepts a target user ID from the browser and can update only the bearer token's authenticated user. It does not log, echo, audit, or persist either password.

After success, the client refreshes or reauthenticates as needed, creates the normal Cho application session, and navigates to the user's landing page. If the Auth update succeeds but a later client refresh fails, the user returns to Sign In; only the new password is valid and the activation requirement is already cleared.

## Local Prototype Design

New locally managed accounts receive `requiresPasswordChange: true`. Older records without the property are treated as activated for backward compatibility.

Local credential verification returns an activation-required result without creating an application session. A focused state action validates the current temporary password, replaces it with the new password, clears the requirement, persists the account through the existing tolerant local-storage path, and then creates the normal session. Existing local-storage failure handling remains in force; the app must not claim activation succeeded if the account update cannot be persisted.

This mirrors hosted behavior for development and tests without introducing a second public account-creation system.

## Validation and Error Handling

- Account Name and Temporary Password are required.
- New Password and Confirm New Password are required and must match.
- The new password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.
- The new password must differ from the temporary password.
- Incorrect credentials return a neutral message that does not reveal whether an account name exists.
- Inactive accounts cannot activate or sign in.
- An unavailable Supabase backend keeps the user logged out and displays the existing explicit backend-inactive message.
- Pending controls prevent duplicate authentication and activation requests.
- Closing or cancelling activation clears password fields, modal error state, and temporary Supabase authentication state.
- Failed activation never creates a Cho application session and leaves the backend activation requirement intact.
- No password appears in application logs, error details, toast text, analytics, URL state, or new browser-storage fields.

## Accessibility and Responsive Behavior

The activation modal uses the existing `ModalShell` behavior and adds correctly associated labels, `autocomplete="username"`, `autocomplete="current-password"`, and `autocomplete="new-password"` values. Focus moves to the first field for each step, errors are announced, Escape and the close action safely cancel, and keyboard submission follows the visible step.

The added button and modal must remain compact and usable in portrait phone, short-height phone, tablet, and desktop layouts. Controls must not overlap the portrait, logo, launch handoff, or soft keyboard. Styling must use existing theme-aware login and modal variables and remain readable in dark and light themes.

## Testing

### Unit and Contract Tests

Cover:

- New hosted accounts are provisioned with admin-controlled activation metadata.
- Hosted login distinguishes activated and activation-required users.
- Inactive and invalid profiles cannot activate.
- The activation endpoint binds updates to the bearer-token user.
- Weak, mismatched, reused, or missing passwords are rejected.
- Successful activation replaces the password and clears the flag in one Auth update.
- Local accounts mirror activation-required, password replacement, persistence, and login behavior.
- Existing records without the new field remain activated.

### Component Tests

Cover:

- **Access New Account** opens the verification step.
- Valid temporary credentials advance to the secure-account step.
- Regular **Sign In** with temporary credentials opens the same secure-account step.
- Existing activated credentials still sign in normally.
- Already activated credentials entered through the dedicated flow direct the user back to normal Sign In.
- Incorrect credentials, inactive accounts, backend inactivity, weak passwords, mismatches, and activation failures keep the user logged out with useful messages.
- Pending submissions cannot be repeated.
- Closing the modal clears sensitive fields and temporary authentication state.
- Successful activation enters the correct role surface with only the new password accepted afterward.
- Modal focus, keyboard controls, accessible names, and autocomplete attributes are correct.

### Rendered QA

Verify the real login and activation paths against the configured Cho staging Supabase project, using a newly provisioned non-owner test account that can be removed after evidence is captured. Exercise desktop, tablet, phone, short-height/soft-keyboard, dark theme, and light theme. Confirm no relevant console errors, no leaked password values, correct responsive layout, a durable password replacement, rejection of the old temporary password, and successful relogin with the new password.

## Scope

This work changes login routing, first-use password activation, manager-created account metadata, the focused activation backend, the equivalent local fallback, login/activation UI, and directly related documentation and tests. It does not add public self-registration, email-based recovery, invitation emails, broader account administration, or a redesign of the launch/login experience.

## Acceptance Criteria

- The login page visibly offers **Access New Account** without degrading the current launch or login presentation.
- Every newly provisioned account must replace its temporary password before workspace access.
- Temporary credentials entered through normal **Sign In** cannot bypass activation.
- Activated accounts continue to sign in normally.
- Incorrect, inactive, weak-password, duplicate-submit, cancellation, and backend-failure paths keep the app secure and understandable.
- Hosted and local fallback behavior agree.
- The old temporary password fails after activation and the new password succeeds on a fresh login.
- Focused tests, the full relevant suite, strict TypeScript/build checks, responsive browser QA, and real staging verification pass.
