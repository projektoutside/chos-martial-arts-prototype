# Cho's Two-App Client Testing Distribution Design

Date: 2026-07-11
Status: Approved design; implementation has not started

## Objective

Provide two independently installable private client-testing apps from one maintained codebase:

- **Cho's Martial Arts** is the stable launch candidate containing only features intended for the eventual public release.
- **Cho's Testing** is the experimental demonstration app for new features and ideas, using polished fake data only.

The initial delivery platform is Google Play closed testing. The same separation will later extend to Apple TestFlight after the Apple Developer account is available.

## Non-Goals

- Neither app will be publicly listed during this phase.
- Cho's Testing will not support real production messaging, payments, email, push delivery, or customer data.
- This phase will not create Apple certificates, App Store Connect records, or TestFlight builds.
- This design does not authorize production database, billing, legal, or public-release changes.

## Application Identities

| Purpose | Display name | Android application ID | Installation |
| --- | --- | --- | --- |
| Stable launch candidate | Cho's Martial Arts | `com.xatoridev.chosmartialarts` | Separate Google Play installation |
| Experimental demonstrations | Cho's Testing | `com.xatoridev.chosmartialarts.testing` | Separate Google Play installation |

The distinct application IDs allow both apps to be installed on the same Android device. Each app has its own Play record, closed-testing invitation link, version history, release notes, updates, and rollback controls.

Cho's Testing will use the existing Cho's brand icon with a clearly visible orange `TEST` badge. It will also display a persistent in-app `Demo Environment` indicator so screenshots and demonstrations cannot be mistaken for the stable app.

## Source-Control Workflow

One repository remains the source of truth.

- `main` represents the stable Cho's Martial Arts app.
- `testing` represents the current Cho's Testing app.
- Experimental work begins on a short-lived feature branch based on `testing`.
- Completed experimental work is reviewed, tested, and released through Cho's Testing.
- Client-approved work is transferred to `main` through its focused feature commits, followed by stable validation.
- Rejected experiments remain outside `main` and cannot affect the stable app.

Feature promotion must preserve a clear commit boundary. A release operator must not merge all unrelated experiments into `main` merely because one feature was approved. If an experiment cannot be promoted cleanly, it must first be separated into focused commits or rebuilt as a small stable-targeted change.

## Environment and Data Isolation

Cho's Martial Arts continues to use the approved Cho environment for the current stable client-testing phase. The exact stable backend target must be selected through protected build configuration and verified before each release.

Cho's Testing uses a demo-data adapter that supplies realistic fake examples for users, profiles, attendance, schedules, messages, update history, and other supported screens. Demo data must be deterministic enough for repeatable client demonstrations and resettable to a known starting state.

The testing build must fail closed:

- It must not contain or load stable Supabase credentials.
- It must not make requests to the stable Cho Supabase project.
- It must not send real SMS, email, push notifications, or payment requests.
- Production-only controls must be hidden, disabled, or handled by an explicit harmless demo action.
- Automated release checks must reject a testing artifact if stable hostnames, project references, or production secrets are detected.

The application should expose environment metadata in a testable form so build verification can prove whether an artifact is stable or demo before upload.

## Android Build Variants

The existing Capacitor Android project will be adapted to produce two explicit release variants from the same web source:

- A stable variant with the existing application ID, name, branding, and approved backend configuration.
- A testing variant with the `.testing` application ID suffix, Cho's Testing name, `TEST` icon badge, demo mode, and network safeguards.

Each variant will have independent Android version codes. Human-readable version names should remain understandable across both variants, while the Play-required version code must increase for every upload to that app's Play record.

Signed releases will be Android App Bundles (`.aab`). Google Play App Signing will protect the distribution signing key. Upload credentials and keystores must remain outside Git and be stored as protected release secrets.

## Google Play Closed Testing

Google Play Console will contain two private app records matching the application identities above. Both use closed testing and are available only to explicitly invited client Google accounts or an approved tester group.

Each record requires its own:

- App name and package identity.
- Store listing and branded graphics.
- Closed-testing tester list or group.
- Invitation/install link.
- App signing enrollment.
- Data safety, content rating, app access, target audience, and other required Play declarations.
- Release history and release notes.

Account-facing declarations must reflect the actual behavior of each artifact. Legal declarations, billing changes, country availability, production-track access, and public publishing require explicit owner approval.

## Automated Release Workflows

Separate manually triggered release workflows will make the destination unambiguous:

### Release Cho's Testing

1. Confirm the source is the approved testing branch or release commit.
2. Install dependencies and run focused tests.
3. Build with demo mode enabled and stable services disabled.
4. Run isolation checks against the compiled artifact.
5. Validate the testing identity, `TEST` branding, version, and signing configuration.
6. Produce a signed testing `.aab`.
7. Upload only to the Cho's Testing closed-testing track.
8. Save the artifact, release notes, commit SHA, version, and Play release result.

### Release Cho's Martial Arts

1. Confirm the source is an approved `main` release commit.
2. Install dependencies and run the full stable validation suite.
3. Confirm the approved Cho backend target and reject foreign or demo configuration.
4. Validate the stable identity, branding, version, and signing configuration.
5. Produce a signed stable `.aab`.
6. Upload only to the Cho's Martial Arts closed-testing track.
7. Save the artifact, release notes, commit SHA, version, and Play release result.

The automation must not silently choose a destination based only on the current branch. App identity, expected track, artifact package ID, and workflow name must agree before upload.

## Approved-Feature Promotion

When a client approves a feature demonstrated in Cho's Testing:

1. Record the approved feature and its focused commits.
2. Transfer only those commits to a branch based on `main`.
3. Resolve any stable-environment differences without carrying demo-only configuration into stable.
4. Run stable tests and direct app checks.
5. Review the resulting stable diff.
6. Merge the approved feature into `main`.
7. Trigger the Cho's Martial Arts closed-testing release workflow.
8. Record the stable version, commit, Play release, and client-facing notes.

## Failure and Rollback Behavior

- Failed tests, identity checks, environment checks, signing checks, or uploads stop the release.
- A failed experimental build cannot affect the stable Play record.
- A bad closed-testing release is halted or replaced by a higher-version corrective build; Android version codes are never reused.
- Source rollback uses a known-good commit, while Play rollback follows the controls available for the selected testing track.
- Release records must make it possible to match every installed version to its Git commit and build workflow.

## Future Apple Extension

After the Apple Developer account is active, this design extends to two separately installable iOS apps distributed privately through TestFlight:

- Cho's Martial Arts uses the stable code and stable service configuration.
- Cho's Testing uses a distinct bundle ID, `TEST` icon badge, demo environment, and fake data only.

The shared environment model, demo-data safeguards, release notes, feature-promotion process, and validation rules should be reused. Apple-specific bundle identifiers, certificates, provisioning profiles, App Store Connect records, privacy declarations, and TestFlight groups will be designed and implemented as a separately authorized phase.

## Acceptance Criteria

The Android phase is complete when:

1. Both apps install simultaneously on one Android device with distinct names and icons.
2. Each app is downloadable through its own private Google Play closed-testing link.
3. Cho's Testing presents polished fake data and cannot reach stable Cho services.
4. Cho's Martial Arts continues to use only its explicitly approved Cho environment.
5. Release automation produces and uploads the correct signed `.aab` to the correct Play record.
6. A deliberately misconfigured testing build is rejected before upload.
7. An approved feature can be promoted without copying unrelated experiments into `main`.
8. Each release is traceable by app, version, Git commit, workflow run, artifact, and release notes.
9. The workflow and owner-required Play Console steps are documented in beginner-friendly language.

## Owner Inputs Required During Implementation

- Access to the correct Google Play Console developer account.
- Confirmation of the existing Cho's Martial Arts Play record and package ownership.
- The Google accounts or Google Group that will receive closed-testing access.
- Completion or confirmation of Play Console identity, legal, policy, and app-access declarations.
- Approval before any billing, public publishing, production-track, country-availability, or real-customer behavior change.

## Finish Criteria

Implementation is finished only after repository checks, signed local artifact checks, Play Console configuration, both closed-testing uploads, both invitation links, and real-device simultaneous-install proof are recorded. Repository configuration alone is not sufficient to claim completion.
