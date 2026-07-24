import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "..", "i18n.ts"), "utf8");
const pluginSource = readFileSync(resolve(import.meta.dirname, "..", "main.ts"), "utf8");
const languageMatch = source.match(/export const LANGUAGES = \[(?<languages>[^\]]+)\] as const;/);
if (!languageMatch) {
  throw new Error("i18n.ts must export LANGUAGES as a const tuple");
}

const languages = [...languageMatch.groups.languages.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
if (languages.join(",") !== "en,ko") {
  throw new Error(`Expected exactly en and ko languages, found: ${languages.join(", ")}`);
}

function readObjectKeys(name) {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) {
    throw new Error(`Missing ${name}`);
  }
  const open = source.indexOf("{", start);
  const nextExport = source.indexOf("\nexport ", open);
  const end = nextExport >= 0 ? nextExport : source.length;
  if (open < 0 || end < 0) {
    throw new Error(`Could not parse ${name}`);
  }
  return [...source.slice(open, end).matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]);
}

const englishKeys = readObjectKeys("EN_TRANSLATIONS");
const koreanOverrides = new Set(readObjectKeys("KO_TRANSLATIONS"));
const duplicateEnglishKeys = englishKeys.filter((key, index) => englishKeys.indexOf(key) !== index);
if (duplicateEnglishKeys.length > 0) {
  throw new Error(`Duplicate English translation keys: ${[...new Set(duplicateEnglishKeys)].join(", ")}`);
}

const unknownKoreanKeys = [...koreanOverrides].filter((key) => !englishKeys.includes(key));
if (unknownKoreanKeys.length > 0) {
  throw new Error(`Korean overrides contain unknown keys: ${unknownKoreanKeys.join(", ")}`);
}

if (!source.includes("TRANSLATIONS[language]?.[key] ?? EN_TRANSLATIONS[key]")) {
  throw new Error("translate() must fall back deterministically to English");
}

if (!pluginSource.match(/const DEFAULT_SETTINGS:[^{]+\{\s*language:\s*"auto",/s)) {
  throw new Error("Owen Editor must default to the Obsidian locale");
}

if (!source.includes('return typeof obsidianLocale === "string" && /^ko(?:[-_]|$)/i.test(obsidianLocale) ? "ko" : "en";')) {
  throw new Error("Automatic language must map Korean Obsidian locales to Korean and every other locale to English");
}

if (!source.includes("if (isLanguage(preference))")) {
  throw new Error("Explicit English or Korean language overrides must take precedence");
}

const commandBlockStart = source.indexOf("const KO_COMMAND_NAMES");
const commandBlockEnd = source.indexOf("\n};", commandBlockStart);
const translatedCommandIds = new Set([...source.slice(commandBlockStart, commandBlockEnd).matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]));
const sourceCommandIds = new Set([...pluginSource.matchAll(/^\s*id:\s*"([^"]+)",\s*$/gm)].map((match) => match[1]));
for (const calloutId of [...pluginSource.matchAll(/^\s*\{ id: "([^"]+)", name: "Insert [^"]+ callout"/gm)].map((match) => `insert-${match[1]}-callout`)) {
  sourceCommandIds.add(calloutId);
}
const missingCommandNames = [...sourceCommandIds].filter((id) => !translatedCommandIds.has(id));
if (missingCommandNames.length > 0) {
  throw new Error(`Missing Korean command names: ${missingCommandNames.join(", ")}`);
}

console.log(`i18n check passed: ${languages.length} languages, ${englishKeys.length} typed keys, ${sourceCommandIds.size} command names, English fallback enabled.`);
