import { spawnSync } from "node:child_process";
import { prepareIosVariant } from "./prepare-ios-variant.mjs";

const variant = process.argv[2] ?? "stable";
if (variant !== "stable" && variant !== "testing") {
  throw new Error("iOS variant must be stable or testing.");
}
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const env = {
  ...process.env,
  VITE_APP_VARIANT: variant,
  VITE_ENABLE_DEVELOPER_ACCOUNT: "true"
};
delete env.GITHUB_REPOSITORY;
if (variant === "stable") {
  env.VITE_APPROVED_SUPABASE_HOST = "zfuwbbepsnmmlpgfkmhz.supabase.co";
}
if (variant === "testing") {
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_PUBLISHABLE_KEY;
  delete env.VITE_SUPABASE_ANON_KEY;
  delete env.VITE_APPROVED_SUPABASE_HOST;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npmCommand, ["run", "build"]);
if (variant === "testing") run(npmCommand, ["run", "verify:demo-artifact"]);
run(npxCommand, ["cap", "sync", "ios"]);
prepareIosVariant(variant);
run(npmCommand, ["run", "verify:ios", "--", variant]);
