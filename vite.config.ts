import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isCloudflarePagesBuild = process.env.CLOUDFLARE_PAGES === "true";

export default defineConfig({
  base: repositoryName && !isCloudflarePagesBuild ? `/${repositoryName}/` : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      ".worktrees/**",
      "scripts/manager-create-account-contract.test.mjs",
      "scripts/validate-play-release-input.test.mjs",
      "scripts/verify-android-variant.test.mjs",
      "scripts/verify-demo-artifact.test.mjs"
    ]
  }
});
