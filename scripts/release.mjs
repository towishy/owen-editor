import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
const version = manifest.version;
const releaseZip = "owen-editor.zip";
const releaseStagingRoot = resolve(root, ".release");
const releaseZipPath = resolve(root, releaseZip);
const releaseAssets = ["main.js", "manifest.json", "styles.css"];

function getReleaseNotes(releaseVersion) {
  const changelog = readFileSync(resolve(root, "CHANGELOG.md"), "utf8");
  const heading = `## [${releaseVersion}]`;
  const start = changelog.indexOf(heading);
  if (start === -1) {
    throw new Error(`CHANGELOG.md does not include ${heading}`);
  }

  const next = changelog.indexOf("\n## [", start + heading.length);
  return changelog.slice(start, next === -1 ? undefined : next).trim();
}

function run(command, commandArgs, cwd = root) {
  const useShell = process.platform === "win32" && command === "npm";
  console.log(`$ ${command} ${commandArgs.join(" ")}`);
  execFileSync(command, commandArgs, { cwd, shell: useShell, stdio: "inherit" });
}

function quotePowerShellString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function zipReleaseAssets() {
  try {
    run("zip", ["-r", releaseZipPath, ...releaseAssets], releaseStagingRoot);
  } catch (error) {
    if (process.platform !== "win32" || error?.code !== "ENOENT") {
      throw error;
    }

    const literalPaths = releaseAssets.map(quotePowerShellString).join(", ");
    run("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Compress-Archive -LiteralPath @(${literalPaths}) -DestinationPath ${quotePowerShellString(releaseZipPath)} -Force`
    ], releaseStagingRoot);
  }
}

function createReleaseZip() {
  rmSync(releaseStagingRoot, { recursive: true, force: true });
  rmSync(releaseZipPath, { force: true });
  mkdirSync(releaseStagingRoot, { recursive: true });

  for (const asset of releaseAssets) {
    copyFileSync(resolve(root, asset), resolve(releaseStagingRoot, asset));
  }

  zipReleaseAssets();
}

run("npm", ["run", "build"]);
run("npm", ["run", "release:check"]);
run("git", ["diff", "--check"]);
createReleaseZip();

if (!args.has("--create")) {
  console.log(`Release preflight passed for Owen Editor ${version}. Use npm run release:create to create the GitHub release.`);
  process.exit(0);
}

run("git", ["tag", version]);
run("git", ["push", "origin", "main"]);
run("git", ["push", "origin", version]);
run("gh", [
  "release",
  "create",
  version,
  releaseZip,
  "main.js",
  "manifest.json",
  "styles.css",
  "--repo",
  "towishy/owen-editor",
  "--title",
  `Owen Editor ${version}`,
  "--notes",
  `${getReleaseNotes(version)}\n\nValidation:\n- npm run build\n- npm run release:check\n- git diff --check`
]);
