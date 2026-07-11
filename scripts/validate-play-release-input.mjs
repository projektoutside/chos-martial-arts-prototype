import { fileURLToPath } from "node:url";

const destinations = {
  stable: { packageName: "com.xatoridev.chosmartialarts", track: "client-stable" },
  testing: { packageName: "com.xatoridev.chosmartialarts.testing", track: "client-preview" }
};

export function validatePlayReleaseInput(input) {
  const errors = [];
  const destination = destinations[input.variant];
  if (!destination) errors.push("Variant must be stable or testing.");
  if (destination && input.packageName !== destination.packageName) errors.push("Package name does not match the selected variant.");
  if (destination && input.track !== destination.track) errors.push(`Track must be the private ${destination.track} closed-testing track.`);
  if (!/^\d+$/.test(input.versionCode) || Number(input.versionCode) < 1) errors.push("Version code must be a positive integer.");
  if (!input.versionName?.trim()) errors.push("Version name is required.");
  if (!input.releaseNotes?.trim()) errors.push("Release notes are required.");
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [variant, packageName, track, versionCode, versionName, releaseNotes] = process.argv.slice(2);
  const errors = validatePlayReleaseInput({ variant, packageName, track, versionCode, versionName, releaseNotes });
  if (errors.length) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log(`Validated ${variant} release ${packageName} -> ${track}.`);
}
