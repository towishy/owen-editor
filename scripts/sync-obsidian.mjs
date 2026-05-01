import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const vaultPath = process.argv[2] ?? process.env.OWEN_EDITOR_OBSIDIAN_VAULT ?? "/Users/owen/work/Obsidian";
const pluginDir = resolve(vaultPath, ".obsidian", "plugins", "owen-editor");
const assets = ["main.js", "manifest.json", "styles.css"];

mkdirSync(pluginDir, { recursive: true });

for (const asset of assets) {
  const source = resolve(root, asset);
  const target = resolve(pluginDir, asset);
  copyFileSync(source, target);
  if (!readFileSync(source).equals(readFileSync(target))) {
    throw new Error(`${asset} did not copy cleanly to ${pluginDir}`);
  }
}

console.log(`Synced Owen Editor assets to ${pluginDir}`);
