import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const env = {
  ...process.env,
  VITE_APP_VARIANT: "stable",
  VITE_APPROVED_SUPABASE_HOST: "zfuwbbepsnmmlpgfkmhz.supabase.co",
  VITE_ENABLE_DEVELOPER_ACCOUNT: "true"
};
delete env.GITHUB_REPOSITORY;

function run(command, args) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npmCommand, ["run", "build"]);
run(npxCommand, ["cap", "sync", "ios"]);
run(npmCommand, ["run", "verify:ios"]);
