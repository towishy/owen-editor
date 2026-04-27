import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fixture = resolve(root, "docs/fixtures/v0.6.6-palette-overflow-sample.html");
const output = resolve(root, "screenshots/owen-editor-v0.6.6-palette-overflow.png");

if (!existsSync(fixture)) {
  throw new Error(`Missing screenshot fixture: ${fixture}`);
}

const useShell = process.platform === "win32";
execFileSync("npx", ["--yes", "playwright", "install", "chromium"], { cwd: root, shell: useShell, stdio: "inherit" });
execFileSync("npx", [
  "--yes",
  "playwright",
  "screenshot",
  "--viewport-size=1100,760",
  `file:///${fixture.replace(/\\/g, "/")}`,
  output
], { cwd: root, shell: useShell, stdio: "inherit" });

console.log(`Updated ${output}`);
