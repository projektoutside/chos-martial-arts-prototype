import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const indexPath = resolve(distDir, "index.html");
const redirectsPath = resolve(distDir, "_redirects");
const fallbackPath = resolve(distDir, "404.html");

if (!existsSync(indexPath)) {
  throw new Error("Cannot prepare Cloudflare Pages upload because dist/index.html does not exist.");
}

if (!existsSync(redirectsPath)) {
  throw new Error("Cannot prepare Cloudflare Pages upload because dist/_redirects does not exist.");
}

rmSync(fallbackPath, { force: true });
console.log("Prepared dist for Cloudflare Pages Direct Upload with _redirects SPA fallback.");
