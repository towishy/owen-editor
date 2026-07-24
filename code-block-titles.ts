import { MarkdownView, Notice, Plugin, TFile, type MarkdownPostProcessorContext } from "obsidian";

const FENCE_RE = /^(\s{0,3})(`{3,}|~{3,})([^\r\n]*)$/;
const TITLE_ATTRIBUTE_RE = /(?:^|\s)title=("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')(?=\s|$)/i;

const CODE_LANGUAGE_LABELS: Record<string, string> = {
  bash: "Shell",
  sh: "Shell",
  shell: "Shell",
  zsh: "Shell",
  powershell: "PowerShell",
  ps1: "PowerShell",
  pwsh: "PowerShell",
  py: "Python",
  python: "Python",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  md: "Markdown",
  markdown: "Markdown",
  txt: "Text",
  text: "Text",
  plain: "Text",
  plaintext: "Text",
  kql: "Kusto",
  "kql-query": "Kusto",
  kusto: "Kusto"
};

interface CodeBlockTitleLabels {
  edit: string;
  saveError: string;
}

interface FenceInfo {
  fence: string;
  hasTitle: boolean;
  language: string;
  title: string;
}

interface FenceBlock extends FenceInfo {
  code: string;
  line: number;
  source: string;
}

function decodeTitle(value: string) {
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

export function parseFenceLine(line: string): FenceInfo | undefined {
  const match = line.match(FENCE_RE);
  if (!match) return undefined;
  const info = match[3].trim();
  const titleMatch = info.match(TITLE_ATTRIBUTE_RE);
  const infoWithoutTitle = info.replace(TITLE_ATTRIBUTE_RE, " ").trim();
  return {
    fence: match[2],
    hasTitle: Boolean(titleMatch),
    language: infoWithoutTitle.split(/\s+/, 1)[0] || "",
    title: titleMatch ? decodeTitle(titleMatch[1]) : ""
  };
}

function codeLanguageLabel(language: string) {
  const normalized = language.toLowerCase();
  if (!normalized) return "";
  return CODE_LANGUAGE_LABELS[normalized] || normalized.replace(/(^|[-_])(\w)/g, (_match, _separator, letter: string) => letter.toUpperCase());
}

export function updateFenceTitle(line: string, title: string) {
  const match = line.match(FENCE_RE);
  if (!match) throw new Error("The target line is not a fenced code block opener.");
  const separator = match[3].match(/^\s*/)?.[0] ?? "";
  const info = match[3].trim().replace(TITLE_ATTRIBUTE_RE, " ").replace(/\s+/g, " ").trim();
  const normalizedTitle = title.replace(/[\r\n]+/g, " ");
  const updatedInfo = [info, `title=${JSON.stringify(normalizedTitle)}`].filter(Boolean).join(" ");
  return `${match[1]}${match[2]}${separator || (info ? "" : " ")}${updatedInfo}`;
}

function findFencedCodeBlocks(source: string) {
  const lines = source.split(/\r?\n/);
  const blocks: FenceBlock[] = [];
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const opener = parseFenceLine(lines[lineNumber]);
    if (!opener) continue;
    for (let closingLine = lineNumber + 1; closingLine < lines.length; closingLine += 1) {
      const trimmed = lines[closingLine].trim();
      const run = trimmed.match(/^(`+|~+)/)?.[0] || "";
      if (run[0] !== opener.fence[0] || run.length < opener.fence.length || trimmed.slice(run.length).trim() !== "") continue;
      blocks.push({ ...opener, code: lines.slice(lineNumber + 1, closingLine).join("\n"), line: lineNumber, source: lines[lineNumber] });
      lineNumber = closingLine;
      break;
    }
  }
  return blocks;
}

function normalizeCodeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\n+$/, "");
}

function findFencedCodeBlockForCode(source: string, expectedCode: string, expectedLanguage = "") {
  const normalizedCode = normalizeCodeText(expectedCode);
  const normalizedLanguage = expectedLanguage.toLowerCase();
  const matches = findFencedCodeBlocks(source).filter(
    (block) => normalizeCodeText(block.code) === normalizedCode
      && (!normalizedLanguage || block.language.toLowerCase() === normalizedLanguage)
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function replaceFenceTitleAtLine(source: string, lineNumber: number, title: string, expectedLine: string) {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  if (!Number.isInteger(lineNumber) || lineNumber < 0 || lineNumber >= lines.length || lines[lineNumber] !== expectedLine) {
    throw new Error("The code block changed before its title could be saved.");
  }
  lines[lineNumber] = updateFenceTitle(lines[lineNumber], title);
  return lines.join(eol);
}

function replaceFenceTitleForCode(source: string, expectedCode: string, title: string, expectedLanguage = "") {
  const block = findFencedCodeBlockForCode(source, expectedCode, expectedLanguage);
  if (!block) throw new Error("The code block changed or is not unique.");
  return replaceFenceTitleAtLine(source, block.line, title, block.source);
}

function markdownViewForElement(plugin: Plugin, element: Element) {
  return plugin.app.workspace
    .getLeavesOfType("markdown")
    .map((leaf) => leaf.view)
    .find((view): view is MarkdownView => view instanceof MarkdownView && view.containerEl.contains(element));
}

function livePreviewLineInfo(plugin: Plugin, lineElement: Element) {
  const view = markdownViewForElement(plugin, lineElement);
  if (!view) return undefined;
  const editorView = (view.editor as typeof view.editor & { cm?: { posAtDOM(node: Node, offset?: number): number } }).cm;
  if (typeof editorView?.posAtDOM !== "function") return undefined;
  try {
    const position = view.editor.offsetToPos(editorView.posAtDOM(lineElement, 0));
    return { lineNumber: position.line, view };
  } catch {
    return undefined;
  }
}

function createTitleInput(container: HTMLElement, value: string, labels: () => CodeBlockTitleLabels, onSave: (title: string) => Promise<void>, onCancel?: () => void) {
  const input = document.createElement("input");
  input.className = "owen-editor-codeblock-title-input";
  input.type = "text";
  input.value = value;
  input.setAttribute("aria-label", labels().edit);
  container.appendChild(input);
  let finished = false;
  const cancel = () => {
    if (finished) return;
    finished = true;
    input.remove();
    onCancel?.();
  };
  const save = async () => {
    if (finished) return;
    finished = true;
    input.disabled = true;
    try {
      await onSave(input.value.trim());
      input.remove();
    } catch (error) {
      input.remove();
      onCancel?.();
      console.error("Owen Editor code block title save failed", error);
      new Notice(labels().saveError);
    }
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  });
  input.addEventListener("blur", () => void save(), { once: true });
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

async function enhanceReadingCodeBlocks(plugin: Plugin, root: HTMLElement, context: MarkdownPostProcessorContext, labels: () => CodeBlockTitleLabels, overrides: Map<string, string>) {
  const codeBlocks = root.matches("pre") ? [root] : Array.from(root.querySelectorAll("pre"));
  const file = plugin.app.vault.getAbstractFileByPath(context.sourcePath);
  if (!(file instanceof TFile)) return;
  const source = await plugin.app.vault.read(file);
  for (const pre of codeBlocks) {
    if (pre.classList.contains("owen-editor-codeblock-title-ready")) continue;
    const codeText = pre.querySelector("code")?.textContent ?? pre.textContent;
    const renderedLanguage = Array.from(pre.classList).find((className) => className.startsWith("language-"))?.slice("language-".length) ?? "";
    const opener = findFencedCodeBlockForCode(source, codeText, renderedLanguage);
    if (!opener) continue;
    const titleKey = `${context.sourcePath}\u0000${opener.language.toLowerCase()}\u0000${normalizeCodeText(codeText)}`;
    const trigger = document.createElement("button");
    trigger.className = "owen-editor-codeblock-title";
    trigger.type = "button";
    const override = overrides.get(titleKey);
    trigger.textContent = override ?? (opener.hasTitle ? opener.title : codeLanguageLabel(opener.language));
    if (override !== undefined && opener.hasTitle && opener.title === override) overrides.delete(titleKey);
    trigger.setAttribute("aria-label", labels().edit);
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (pre.querySelector(".owen-editor-codeblock-title-input")) return;
      trigger.hidden = true;
      createTitleInput(pre, trigger.textContent ?? "", labels, async (title) => {
        const currentFile = plugin.app.vault.getAbstractFileByPath(context.sourcePath);
        if (!(currentFile instanceof TFile)) throw new Error("Markdown file not found.");
        const previousOverride = overrides.get(titleKey);
        overrides.set(titleKey, title);
        try {
          await plugin.app.vault.process(currentFile, (currentSource) => replaceFenceTitleForCode(currentSource, codeText, title, opener.language));
        } catch (error) {
          if (previousOverride === undefined) overrides.delete(titleKey);
          else overrides.set(titleKey, previousOverride);
          throw error;
        }
        trigger.textContent = title;
        trigger.hidden = false;
      }, () => {
        trigger.hidden = false;
      });
    });
    pre.classList.add("owen-editor-codeblock-title-ready");
    pre.appendChild(trigger);
  }
}

function decorateLivePreviewCodeTitles(plugin: Plugin, labels: () => CodeBlockTitleLabels) {
  document.querySelectorAll<HTMLElement>(".markdown-source-view.mod-cm6 .cm-line.HyperMD-codeblock-begin").forEach((lineElement) => {
    const trigger = lineElement.querySelector<HTMLElement>(".code-block-flair");
    const lineInfo = trigger ? livePreviewLineInfo(plugin, lineElement) : undefined;
    if (!trigger || !lineInfo) return;
    const opener = parseFenceLine(lineInfo.view.editor.getLine(lineInfo.lineNumber));
    if (!opener) return;
    const title = opener.hasTitle ? opener.title : codeLanguageLabel(opener.language);
    if (trigger.textContent !== title) trigger.textContent = title;
    trigger.classList.add("owen-editor-codeblock-title-trigger");
    trigger.setAttribute("aria-label", labels().edit);
    trigger.setAttribute("role", "button");
    trigger.tabIndex = 0;
  });
}

function editLivePreviewTitle(plugin: Plugin, trigger: HTMLElement, labels: () => CodeBlockTitleLabels) {
  const lineElement = trigger.closest<HTMLElement>(".cm-line.HyperMD-codeblock-begin");
  const lineInfo = lineElement ? livePreviewLineInfo(plugin, lineElement) : undefined;
  if (!lineElement || !lineInfo || lineElement.querySelector(".owen-editor-codeblock-title-input")) return;
  const expectedLine = lineInfo.view.editor.getLine(lineInfo.lineNumber);
  if (!parseFenceLine(expectedLine)) return;
  lineElement.classList.add("owen-editor-codeblock-title-editing");
  createTitleInput(lineElement, trigger.textContent ?? "", labels, async (title) => {
    if (lineInfo.view.editor.getLine(lineInfo.lineNumber) !== expectedLine) throw new Error("Code block changed.");
    lineInfo.view.editor.setLine(lineInfo.lineNumber, updateFenceTitle(expectedLine, title));
    lineElement.classList.remove("owen-editor-codeblock-title-editing");
  }, () => lineElement.classList.remove("owen-editor-codeblock-title-editing"));
}

export function registerCodeBlockTitleEditing(plugin: Plugin, labels: () => CodeBlockTitleLabels) {
  const overrides = new Map<string, string>();
  let queued = false;
  const update = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorateLivePreviewCodeTitles(plugin, labels);
    });
  };
  const observer = new MutationObserver(update);
  observer.observe(document.body, { subtree: true, childList: true });
  plugin.register(() => observer.disconnect());
  plugin.registerMarkdownPostProcessor((root, context) => {
    void enhanceReadingCodeBlocks(plugin, root, context, labels, overrides);
  });
  plugin.registerDomEvent(document, "click", (event) => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest<HTMLElement>(".markdown-source-view.mod-cm6 .owen-editor-codeblock-title-trigger");
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    editLivePreviewTitle(plugin, trigger, labels);
  }, true);
  plugin.registerDomEvent(document, "keydown", (event) => {
    if (!(event.target instanceof Element) || !["Enter", "F2"].includes(event.key)) return;
    const trigger = event.target.closest<HTMLElement>(".markdown-source-view.mod-cm6 .owen-editor-codeblock-title-trigger");
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    editLivePreviewTitle(plugin, trigger, labels);
  }, true);
  plugin.registerEvent(plugin.app.workspace.on("css-change", update));
  plugin.app.workspace.onLayoutReady(update);
}