import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredAssets = ["main.js", "manifest.json", "styles.css"];

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");
const readme = readText("README.md");
const license = readText("LICENSE");
const changelog = readText("CHANGELOG.md");
const source = readText("main.ts");

assert(packageJson.version === manifest.version, `Version mismatch: package.json ${packageJson.version}, manifest.json ${manifest.version}`);
assert(packageLock.version === packageJson.version, `package-lock.json root version must be ${packageJson.version}`);
assert(packageLock.packages?.[""]?.version === packageJson.version, `package-lock.json package version must be ${packageJson.version}`);
assert(versions[manifest.version] === manifest.minAppVersion, `versions.json is missing ${manifest.version}: ${manifest.minAppVersion}`);
assert(manifest.id === "owen-editor", "manifest id must be owen-editor");
assert(manifest.name === "Owen Editor", "manifest name must be Owen Editor");
assert(license.includes("MIT License"), "LICENSE must contain the MIT License text");
assert(readme.includes("screenshots/owen-editor-ui-preview.png"), "README.md must include the UI preview image");
assert(existsSync(resolve(root, "screenshots/owen-editor-ui-preview.png")), "README preview image must exist");
assert(changelog.includes("## [Unreleased]"), "CHANGELOG.md must include an Unreleased section");
assert(changelog.includes(`## [${manifest.version}]`), `CHANGELOG.md must include an entry for ${manifest.version}`);
assert(changelog.includes(`[${manifest.version}]:`), `CHANGELOG.md must include a compare link for ${manifest.version}`);
assert(!source.match(/id:\s*["'][^"']*owen-editor[^"']*["']/), "Command IDs must not include the plugin ID; Obsidian prefixes them automatically");
assert(!source.match(/name:\s*["'][^"']*Owen Editor[^"']*["']/), "Command names must not include the plugin name; Obsidian shows it separately");
assert(!source.match(/createEl\(["']h[12]["']/), "Settings headings should use Setting#setHeading instead of direct h1/h2 elements");
assert(!source.includes('String(vaultWithConfig.getConfig?.("cssTheme") ?? "")'), "cssTheme config must be type-checked before string methods are used");
assert(!source.match(/addEventListener\([^\n]+async\s*\(/), "DOM event listeners must not return promises; wrap async work with void");

for (const asset of requiredAssets) {
  const stats = statSync(resolve(root, asset));
  assert(stats.isFile(), `${asset} must be a file`);
  assert(stats.size > 0, `${asset} must not be empty`);
}

console.log(`Release check passed for Owen Editor ${manifest.version}.`);
