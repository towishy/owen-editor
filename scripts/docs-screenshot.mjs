import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const screenshots = [
  {
    fixture: resolve(root, "docs/ui-preview.html"),
    output: resolve(root, "screenshots/owen-editor-ui-preview.png"),
    viewport: "1240,820"
  },
  {
    fixture: resolve(root, "docs/fixtures/v0.6.6-palette-overflow-sample.html"),
    output: resolve(root, "screenshots/owen-editor-v0.6.6-palette-overflow.png"),
    viewport: "1100,760"
  }
];

for (const screenshot of screenshots) {
  if (!existsSync(screenshot.fixture)) {
    throw new Error(`Missing screenshot fixture: ${screenshot.fixture}`);
  }
}

const useShell = process.platform === "win32";
execFileSync("npx", ["--yes", "playwright", "install", "chromium"], { cwd: root, shell: useShell, stdio: "inherit" });
for (const screenshot of screenshots) {
  execFileSync("npx", [
    "--yes",
    "playwright",
    "screenshot",
    `--viewport-size=${screenshot.viewport}`,
    `file:///${screenshot.fixture.replace(/\\/g, "/")}`,
    screenshot.output
  ], { cwd: root, shell: useShell, stdio: "inherit" });

  console.log(`Updated ${screenshot.output}`);
}
