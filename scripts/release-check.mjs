import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredAssets = ["main.js", "manifest.json", "styles.css"];

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const packageJson = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");

assert(packageJson.version === manifest.version, `Version mismatch: package.json ${packageJson.version}, manifest.json ${manifest.version}`);
assert(versions[manifest.version] === manifest.minAppVersion, `versions.json is missing ${manifest.version}: ${manifest.minAppVersion}`);
assert(manifest.id === "owen-editor", "manifest id must be owen-editor");
assert(manifest.name === "Owen Editor", "manifest name must be Owen Editor");

for (const asset of requiredAssets) {
  const stats = statSync(resolve(root, asset));
  assert(stats.isFile(), `${asset} must be a file`);
  assert(stats.size > 0, `${asset} must not be empty`);
}

console.log(`Release check passed for Owen Editor ${manifest.version}.`);
