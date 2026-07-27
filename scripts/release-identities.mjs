export const APPLE_TEAM_ID = "9R42C8LZ43";

export const RELEASE_IDENTITIES = Object.freeze({
  stable: Object.freeze({
    variant: "stable",
    appName: "Cho's Martial Arts",
    androidPackageName: "com.xatoridev.chosmartialarts",
    appleBundleId: "com.xatoridev.chosmartialarts",
    appleIconSet: "AppIcon",
    environmentKind: "stable"
  }),
  testing: Object.freeze({
    variant: "testing",
    appName: "Cho's Testing",
    androidPackageName: "com.xatoridev.chosmartialarts.testing",
    appleBundleId: "com.xatoridev.chosmartialarts.testing",
    appleIconSet: "AppIconTesting",
    environmentKind: "demo"
  })
});

export function releaseIdentity(variant) {
  const identity = RELEASE_IDENTITIES[variant];
  if (!identity) throw new Error("Variant must be stable or testing.");
  return identity;
}
