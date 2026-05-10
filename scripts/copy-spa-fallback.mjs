import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const indexPath = resolve(distDir, "index.html");
const fallbackPath = resolve(distDir, "404.html");

if (!existsSync(indexPath)) {
  throw new Error("Cannot create GitHub Pages SPA fallback because dist/index.html does not exist.");
}

copyFileSync(indexPath, fallbackPath);
console.log("Created dist/404.html for GitHub Pages SPA fallback.");
