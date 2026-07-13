import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  VITE_APP_VARIANT: "stable",
  VITE_APPROVED_SUPABASE_HOST: "zfuwbbepsnmmlpgfkmhz.supabase.co"
};

const result = spawnSync(npmCommand, ["run", "build"], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
