import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rules = [
  { name: "cho-stable-supabase-project", pattern: /zfuwbbepsnmmlpgfkmhz/i }
];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".txt", ".xml"]);

function filesBelow(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const absolute = path.join(root, entry);
    if (statSync(absolute).isDirectory()) files.push(...filesBelow(absolute));
    else if (textExtensions.has(path.extname(entry).toLowerCase())) files.push(absolute);
  }
  return files;
}

export function scanDemoArtifact(root) {
  if (!existsSync(root)) throw new Error(`Demo artifact directory does not exist: ${root}`);
  const findings = [];
  for (const file of filesBelow(root)) {
    const content = readFileSync(file, "utf8");
    for (const rule of rules) {
      if (rule.pattern.test(content)) findings.push({ file: path.relative(root, file).replaceAll("\\", "/"), rule: rule.name });
    }
  }
  return findings;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? "dist");
  const findings = scanDemoArtifact(root);
  if (findings.length) {
    for (const finding of findings) console.error(`${finding.rule}: ${finding.file}`);
    process.exit(1);
  }
  console.log("Testing artifact contains no stable-service references.");
}
