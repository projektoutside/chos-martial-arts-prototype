import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  VITE_APP_VARIANT: "testing",
  VITE_ENABLE_DEVELOPER_ACCOUNT: "true"
};

delete env.GITHUB_REPOSITORY;
delete env.VITE_SUPABASE_URL;
delete env.VITE_SUPABASE_PUBLISHABLE_KEY;
delete env.VITE_SUPABASE_ANON_KEY;
delete env.VITE_APPROVED_SUPABASE_HOST;

const result = spawnSync(npmCommand, ["run", "build"], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
