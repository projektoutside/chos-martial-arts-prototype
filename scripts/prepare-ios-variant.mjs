import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { releaseIdentity } from "./release-identities.mjs";

export function prepareIosVariant(variant, root = process.cwd()) {
  const identity = releaseIdentity(variant);
  const nativeConfigPath = resolve(root, "ios/App/App/capacitor.config.json");
  const nativeConfig = JSON.parse(readFileSync(nativeConfigPath, "utf8"));
  nativeConfig.appId = identity.appleBundleId;
  nativeConfig.appName = identity.appName;
  writeFileSync(nativeConfigPath, `${JSON.stringify(nativeConfig, null, 2)}\n`);
  return {
    variant,
    appName: identity.appName,
    bundleId: identity.appleBundleId,
    iconSet: identity.appleIconSet,
    nativeConfigPath
  };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const [variant] = process.argv.slice(2);
  const result = prepareIosVariant(variant);
  console.log(`Prepared native iOS ${result.variant} identity ${result.bundleId}.`);
}
