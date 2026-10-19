import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";

const mainPath = fileURLToPath(new URL("../main.ts", import.meta.url));
const { outputFiles } = await build({
  stdin: {
    contents: readFileSync(mainPath, "utf8") + "\nexport { OwenEditorSettingTab, DEFAULT_SETTINGS };",
    resolveDir: dirname(mainPath),
    sourcefile: mainPath,
    loader: "ts"
  },
  bundle: true,
  external: ["obsidian"],
  platform: "node",
  format: "cjs",
  write: false
});

function createTab({ modern = true, favorites = [] } = {}) {
  let mutations = 0;
  const controls = new Map();
  class Element {
    classList = { add() {}, contains() { return false; } };
    closest() { return null; }
    addClass() { mutations += 1; }
    empty() { mutations += 1; }
    createDiv() { mutations += 1; return new Element(); }
    setAttr() { mutations += 1; }
    insertBefore() { mutations += 1; }
    querySelector(selector) { return selector === "svg" && this.icon ? new Element() : null; }
    dataset = {};
  }
  class Setting {
    settingEl = new Element();
    infoEl = new Element();
    nameEl = new Element();
    descEl = new Element();
    controlEl = new Element();
    setName(name) { this.name = name; return this; }
    setDesc() { return this; }
    setHeading() { return this; }
    addControl(configure) {
      const component = {
        sliderEl: new Element(),
        addOption() { return this; },
        setValue(value) { this.value = value; return this; },
        setLimits() { return this; },
        setButtonText() { return this; },
        onChange(callback) { this.change = callback; return this; },
        onClick(callback) { this.click = callback; return this; }
      };
      configure(component);
      controls.set(this.name, component);
      return this;
    }
    addDropdown(configure) { return this.addControl(configure); }
    addToggle(configure) { return this.addControl(configure); }
    addSlider(configure) { return this.addControl(configure); }
    addButton(configure) { return this.addControl(configure); }
    addTextArea(configure) { return this.addControl(configure); }
  }
  const container = new Element();
  class PluginSettingTab {
    containerEl = container;
    constructor() {
      if (modern) this.update = () => { this.settingItems = this.getSettingDefinitions(); };
    }
  }
  const module = { exports: {} };
  const host = {
    Plugin: class {},
    Modal: class {},
    PluginSettingTab,
    Setting,
    requireApiVersion: () => modern,
    setIcon(element) { element.icon = true; },
    setTooltip() {}
  };
  new Function("module", "exports", "require", outputFiles[0].text)(module, module.exports, (name) => {
    assert.equal(name, "obsidian");
    return host;
  });
  const plugin = {
    settings: { ...module.exports.DEFAULT_SETTINGS, favoriteCommandIds: favorites },
    t: (key) => key,
    getCommands: () => [{ id: "bold", name: "Bold" }],
    isFavoriteCommand: (id) => favorites.includes(id),
    saves: 0,
    async saveSettings() { this.saves += 1; }
  };
  const tab = new module.exports.OwenEditorSettingTab({}, plugin);
  return { tab, plugin, controls, mutations: () => mutations };
}

test("indexes each existing setting by its own localized name and description without rendering DOM", () => {
  const { tab, mutations } = createTab();
  const definitions = tab.getSettingDefinitions();
  const names = new Set(definitions.map((definition) => definition.name));
  for (const key of [
    "language.name", "showToolbar", "position", "preset", "density", "collapsed", "scale",
    "favoriteDisplay", "mobileCompact", "contextAware", "feedback", "showSelection",
    "showStatus", "htmlTables", "themeWarning", "favoritePresets", "addFavorite", "json", "importRefresh"
  ]) {
    assert.equal(names.has(`settings.${key}`), true, `Missing searchable setting: ${key}`);
  }
  assert.equal(definitions.find((definition) => definition.name === "settings.scale").desc, "settings.scaleDesc");
  assert.equal(definitions.every((definition) => typeof definition.render === "function"), true);
  assert.equal(mutations(), 0);
});

test("indexes favorite ordering and invalid favorite warnings without constructing their controls", () => {
  const { tab, mutations } = createTab({ favorites: ["missing-command"] });
  const names = tab.getSettingDefinitions().map((definition) => definition.name);
  assert.equal(names.includes("settings.favoriteOrder"), true);
  assert.equal(names.includes("settings.unknownIds"), true);
  assert.equal(mutations(), 0);
});

test("refreshes native search definitions without rendering legacy controls on supported hosts", () => {
  const { tab, controls, mutations } = createTab();
  tab.refresh();
  assert.equal(tab.settingItems.some((definition) => definition.name === "settings.showToolbar"), true);
  assert.equal(controls.size, 0);
  assert.equal(mutations(), 0);
});

test("renders usable legacy controls and persists changes on older supported hosts", async () => {
  const { tab, plugin, controls, mutations } = createTab({ modern: false });
  assert.equal(tab.update, undefined);
  tab.refresh();
  assert.ok(mutations() > 0);
  const toolbarToggle = controls.get("settings.showToolbar");
  assert.equal(toolbarToggle.value, true);
  await toolbarToggle.change(false);
  assert.equal(plugin.settings.showFloatingToolbar, false);
  assert.equal(plugin.saves, 1);
});
