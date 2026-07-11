# Apple TestFlight Next Phase

Status: planned only; no Apple account changes are authorized in the Android phase.

## Intended app separation

- Cho's Martial Arts: stable bundle ID proposed as `com.xatoridev.chosmartialarts`.
- Cho's Testing: demo bundle ID proposed as `com.xatoridev.chosmartialarts.testing`.
- Both apps remain independently installable through separate TestFlight app records.
- Cho's Testing reuses the orange `TEST` badge, persistent Demo Environment label, deterministic fake data, and disabled remote-service policy.

## Apple setup checklist

1. Confirm the Apple Developer organization/team and App Store Connect access.
2. Confirm both bundle IDs are available before registering them.
3. Create separate App Store Connect records and TestFlight groups.
4. Create platform-appropriate signing certificates and provisioning profiles without committing them to Git.
5. Add iOS targets/schemes that map to the existing stable/testing web policies.
6. Complete Apple privacy, encryption, age-rating, and reviewer-access declarations from actual build behavior.
7. Build and upload both signed archives.
8. Verify both apps install together on one iPhone and preserve the same stable/demo isolation proven on Android.
9. Record both TestFlight invitation links, versions, commits, and build evidence.

Apple execution starts only after the developer account is active and the owner separately approves account-facing changes.
