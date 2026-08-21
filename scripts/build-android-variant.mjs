import { spawnSync } from "node:child_process";

const variant = process.argv[2];
if (variant !== "stable" && variant !== "testing") {
  throw new Error("Android variant must be stable or testing.");
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const gradleCommand = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const env = { ...process.env, VITE_APP_VARIANT: variant };
delete env.GITHUB_REPOSITORY;
if (variant === "stable") {
  env.VITE_APPROVED_SUPABASE_HOST = "zfuwbbepsnmmlpgfkmhz.supabase.co";
  env.VITE_ENABLE_DEVELOPER_ACCOUNT = "true";
}
if (variant === "testing") {
  env.VITE_ENABLE_DEVELOPER_ACCOUNT = "true";
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_PUBLISHABLE_KEY;
  delete env.VITE_SUPABASE_ANON_KEY;
  delete env.VITE_APPROVED_SUPABASE_HOST;
}

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npmCommand, ["run", "build"]);
run(npxCommand, ["cap", "sync", "android"]);
const gradleVariant = variant === "testing" ? "Demo" : "Stable";
run(gradleCommand, [`bundle${gradleVariant}Release`], new URL("../android", import.meta.url));
