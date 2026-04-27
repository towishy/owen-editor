import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, setIcon } from "obsidian";

interface OwenEditorSettings {
  showFloatingToolbar: boolean;
  showSelectionToolbar: boolean;
  showStatusBarButton: boolean;
  insertHtmlTables: boolean;
  showGraphiteThemeNotice: boolean;
  toolbarPosition: ToolbarPosition;
  toolbarPreset: ToolbarPreset;
  toolbarCollapsed: boolean;
  mobileCompactToolbar: boolean;
  favoriteCommandIds: string[];
  recentCommandIds: string[];
}

const DEFAULT_SETTINGS: OwenEditorSettings = {
  showFloatingToolbar: true,
  showSelectionToolbar: true,
  showStatusBarButton: true,
  insertHtmlTables: true,
  showGraphiteThemeNotice: true,
  toolbarPosition: "top",
  toolbarPreset: "full",
  toolbarCollapsed: false,
  mobileCompactToolbar: true,
  favoriteCommandIds: [],
  recentCommandIds: []
};

type CommandCategory = "Basic Markdown" | "Selection" | "Links" | "Blocks" | "Tables" | "Owen Graphite";
type ToolbarPosition = "top" | "bottom";
type ToolbarPreset = "minimal" | "writer" | "report" | "full" | "custom";

interface EditorCommand {
  id: string;
  name: string;
  icon: string;
  category: CommandCategory;
  group?: string;
  aliases?: string[];
  run: (editor: Editor) => void;
}

interface HighlightColorOption {
  name: string;
  description: string;
  background: string;
  foreground: string;
  format: "markdown" | "html";
}

type TableBuilderPreset = "markdown" | "wide" | "risk" | "numeric";

interface TableBuilderOptions {
  rows: number;
  columns: number;
  includeHeader: boolean;
  preset: TableBuilderPreset;
  useHtml: boolean;
  sourceText: string;
}

const HIGHLIGHT_COLOR_OPTIONS: HighlightColorOption[] = [
  { name: "Default Markdown", description: "Obsidian 기본 ==highlight==", background: "#fff3a3", foreground: "#1f2937", format: "markdown" },
  { name: "Soft yellow", description: "중요 문장", background: "#fef3c7", foreground: "#1f2937", format: "html" },
  { name: "Mint", description: "완료/긍정", background: "#d1fae5", foreground: "#064e3b", format: "html" },
  { name: "Sky", description: "정보/참고", background: "#dbeafe", foreground: "#1e3a8a", format: "html" },
  { name: "Rose", description: "위험/주의", background: "#ffe4e6", foreground: "#9f1239", format: "html" },
  { name: "Lavender", description: "아이디어/메모", background: "#ede9fe", foreground: "#4c1d95", format: "html" },
  { name: "Graphite", description: "중립 강조", background: "#e5e7eb", foreground: "#111827", format: "html" }
];

const CALLOUT_OPTIONS = [
  { id: "note", name: "Insert note callout", icon: "sticky-note", title: "공지", body: "공유할 내용을 입력합니다." },
  { id: "info", name: "Insert info callout", icon: "info", title: "정보", body: "참고 정보를 입력합니다." },
  { id: "tip", name: "Insert tip callout", icon: "lightbulb", title: "팁", body: "작업에 도움이 되는 힌트를 입력합니다." },
  { id: "important", name: "Insert important callout", icon: "badge-alert", title: "중요", body: "반드시 확인해야 할 내용을 입력합니다." },
  { id: "success", name: "Insert success callout", icon: "check-circle-2", title: "성공", body: "완료되었거나 긍정적인 내용을 입력합니다." },
  { id: "question", name: "Insert question callout", icon: "circle-help", title: "질문", body: "확인이 필요한 질문을 입력합니다." },
  { id: "warning", name: "Insert warning callout", icon: "triangle-alert", title: "주의", body: "확인이 필요한 내용을 입력합니다." },
  { id: "failure", name: "Insert failure callout", icon: "x-circle", title: "실패", body: "실패 원인과 후속 조치를 입력합니다." },
  { id: "danger", name: "Insert danger callout", icon: "octagon-alert", title: "위험", body: "높은 위험이나 차단 사항을 입력합니다." },
  { id: "bug", name: "Insert bug callout", icon: "bug", title: "버그", body: "문제 증상과 재현 조건을 입력합니다." },
  { id: "example", name: "Insert example callout", icon: "list-tree", title: "예시", body: "예시 내용을 입력합니다." },
  { id: "quote", name: "Insert quote callout", icon: "quote", title: "인용", body: "인용문이나 원문을 입력합니다." },
  { id: "abstract", name: "Insert abstract callout", icon: "file-text", title: "요약", body: "핵심 내용을 짧게 요약합니다." },
  { id: "todo", name: "Insert todo callout", icon: "list-checks", title: "할 일", body: "- 담당자:\n> - 기한:\n> - 다음 단계:" }
];

const GRAPHITE_REFERENCE_LIST = `<p class="ogd-reference-summary">주요 참고 자료를 출처, 문서명, 설명으로 분리합니다.</p>
<ol class="ogd-reference-list">
  <li>
    <span class="ogd-reference-source">Source</span>
    <div class="ogd-reference-main">
      <a class="ogd-reference-title" href="https://example.com/">Document title</a>
      <p>핵심 근거와 연결 맥락을 한 문장으로 정리합니다.</p>
    </div>
  </li>
</ol>`;

const GRAPHITE_WIDE_TABLE = `<table class="wide-table print-fit-table comparison-table wrap-table">
  <thead>
    <tr>
      <th>항목</th>
      <th>설명</th>
      <th>식별자</th>
      <th class="num">점수</th>
      <th>권장 조치</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Baseline</td>
      <td>핵심 기준을 요약합니다.</td>
      <td><code>policy-id</code></td>
      <td class="num">95.2%</td>
      <td>후속 조치를 기록합니다.</td>
    </tr>
  </tbody>
</table>

<p class="table-source">Source, 2026.</p>`;

const GRAPHITE_RISK_TABLE = `<table class="risk-table compact-table">
  <thead>
    <tr>
      <th>리스크</th>
      <th>영향</th>
      <th>완화책</th>
      <th>상태</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>예외 정책 누락</td>
      <td>추적성이 낮아질 수 있음</td>
      <td>예외 목록을 appendix로 분리</td>
      <td class="risk-high">High</td>
    </tr>
    <tr>
      <td>긴 URL overflow</td>
      <td>모바일과 PDF에서 폭이 밀릴 수 있음</td>
      <td><code>wrap-table</code> 적용</td>
      <td class="risk-medium">Medium</td>
    </tr>
    <tr>
      <td>숫자 컬럼 가독성</td>
      <td>비교가 어려워질 수 있음</td>
      <td><code>numeric-table</code> 적용</td>
      <td class="risk-ok">OK</td>
    </tr>
  </tbody>
</table>

<p class="table-note">상태 셀은 <code>.risk-high</code>, <code>.risk-medium</code>, <code>.risk-low</code>, <code>.risk-ok</code> 클래스로 표시합니다.</p>`;

const GRAPHITE_MATRIX_TABLE = `<table class="matrix-table compact-table">
  <thead>
    <tr>
      <th>영향도 \\ 가능성</th>
      <th>Low</th>
      <th>Medium</th>
      <th>High</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>High</td><td class="risk-medium">M</td><td class="risk-high">H</td><td class="risk-high">H</td></tr>
    <tr><td>Medium</td><td class="risk-low">L</td><td class="risk-medium">M</td><td class="risk-high">H</td></tr>
    <tr><td>Low</td><td class="risk-low">L</td><td class="risk-low">L</td><td class="risk-medium">M</td></tr>
  </tbody>
</table>`;

const GRAPHITE_NUMERIC_TABLE = `<table class="numeric-table print-fit-table">
  <thead>
    <tr>
      <th>월</th>
      <th>요청</th>
      <th>완료</th>
      <th>성공률</th>
      <th>평균 처리일</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>2026-01</td><td>1,204</td><td>1,178</td><td>97.84%</td><td>2.4</td></tr>
    <tr><td>2026-02</td><td>982</td><td>951</td><td>96.84%</td><td>2.8</td></tr>
  </tbody>
</table>`;

const GRAPHITE_WIDE_MARKDOWN_TABLE = `| 항목 | 설명 | 식별자 | 점수 | 권장 조치 |
|---|---|---|---:|---|
| Baseline | 핵심 기준을 요약합니다. | \`policy-id\` | 95.2% | 후속 조치를 기록합니다. |`;

const GRAPHITE_RISK_MARKDOWN_TABLE = `| 리스크 | 영향 | 완화책 | 상태 |
|---|---|---|---|
| 예외 정책 누락 | 추적성이 낮아질 수 있음 | 예외 목록을 appendix로 분리 | High |
| 긴 URL overflow | 모바일과 PDF에서 폭이 밀릴 수 있음 | \`wrap-table\` 적용 | Medium |
| 숫자 컬럼 가독성 | 비교가 어려워질 수 있음 | \`numeric-table\` 적용 | OK |`;

const GRAPHITE_NUMERIC_MARKDOWN_TABLE = `| 월 | 요청 | 완료 | 성공률 | 평균 처리일 |
|---|---:|---:|---:|---:|
| 2026-01 | 1,204 | 1,178 | 97.84% | 2.4 |
| 2026-02 | 982 | 951 | 96.84% | 2.8 |`;

const GRAPHITE_MATRIX_MARKDOWN_TABLE = `| 영향도 \\ 가능성 | Low | Medium | High |
|---|---|---|---|
| High | M | H | H |
| Medium | L | M | H |
| Low | L | L | M |`;
const DOCUMENT_TEMPLATES = {
  executiveSummary: `---
title: Executive Summary
tags:
  - report
cssclasses:
  - ogd-report-mode
  - ogd-modern-tables
---

# Executive Summary

> [!summary] 핵심 결론
> 의사결정자가 먼저 봐야 할 결론을 3문장 이내로 작성합니다.

## Key Findings

- Finding 1:
- Finding 2:
- Finding 3:

## Recommendation

- Owner:
- Due date:
- Next step:
`,
  comparisonReport: `---
title: Comparison Matrix
tags:
  - report
cssclasses:
  - ogd-report-mode
  - ogd-modern-tables
  - ogd-print-avoid-breaks
---

# Comparison Matrix

${GRAPHITE_WIDE_TABLE}

## Notes

- 비교 기준:
- 예외 사항:
- 권장안:
`,
  riskReview: `---
title: Risk Review
tags:
  - risk
cssclasses:
  - ogd-report-mode
  - ogd-modern-tables
---

# Risk Review

${GRAPHITE_RISK_TABLE}

## Mitigation Plan

- High:
- Medium:
- Follow-up:
`,
  meetingReview: `---
title: Meeting Review
tags:
  - meeting
---

# Meeting Review

## Agenda

-

## Decisions

-

## Action Items

> [!action] Next steps
> - 담당자:
> - 기한:
> - 다음 단계:
`
};

function getToolbarCommandGroups(preset: ToolbarPreset) {
  if (preset === "minimal") {
    return [
      ["undo-edit", "redo-edit"],
      ["bold-selection", "italic-selection", "mark-selection"],
      ["insert-link", "toggle-task"]
    ];
  }

  if (preset === "writer") {
    return [
      ["undo-edit", "redo-edit", "clear-formatting-selection"],
      ["heading-2", "heading-3", "bold-selection", "italic-selection", "mark-selection"],
      ["insert-link", "insert-wikilink", "toggle-task", "insert-bulleted-list", "insert-numbered-list"]
    ];
  }

  if (preset === "report") {
    return [
      ["undo-edit", "redo-edit", "clear-formatting-selection"],
      ["heading-2", "heading-3", "bold-selection", "mark-selection"],
      ["open-table-builder", "insert-markdown-table", "insert-note-callout", "insert-important-callout", "insert-graphite-summary-callout"]
    ];
  }

  return [
    ["undo-edit", "redo-edit", "clear-formatting-selection"],
    ["heading-2", "heading-3", "heading-4", "bold-selection", "italic-selection", "strikethrough-selection", "underline-selection"],
    ["mark-selection", "outdent-lines", "indent-lines", "toggle-task", "insert-bulleted-list", "insert-numbered-list"]
  ];
}

export default class OwenEditorPlugin extends Plugin {
  settings: OwenEditorSettings;
  private commands: EditorCommand[] = [];
  private toolbarEl?: HTMLElement;
  private selectionToolbarEl?: HTMLElement;
  private statusBarItem?: HTMLElement;
  private toolbarResizeObserver?: ResizeObserver;
  private graphiteNoticeShown = false;

  async onload() {
    await this.loadSettings();
    this.commands = this.buildCommands();

    this.addRibbonIcon("pencil-line", "Owen Editor", () => this.openPalette());
    this.addCommand({
      id: "open-palette",
      name: "Open Owen Editor palette",
      callback: () => this.openPalette()
    });
    this.addCommand({
      id: "toggle-toolbar-collapse",
      name: "Toggle Owen Editor toolbar collapse",
      callback: () => this.toggleToolbarCollapsed()
    });

    for (const command of this.commands) {
      this.addCommand({
        id: command.id,
        name: command.name,
        editorCallback: (editor) => this.executeCommand(command, editor)
      });
    }

    this.addSettingTab(new OwenEditorSettingTab(this.app, this));
    this.refreshFloatingToolbar();
    this.refreshSelectionToolbar();
    this.refreshStatusBarButton();
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateToolbarContentOffset()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateSelectionToolbar()));
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      this.updateToolbarContentOffset();
      this.updateSelectionToolbar();
    }));
    this.registerDomEvent(window, "resize", () => {
      this.updateToolbarContentOffset();
      this.updateSelectionToolbar();
    });
    this.registerDomEvent(window, "scroll", () => this.updateSelectionToolbar(), true);
    this.registerDomEvent(document, "selectionchange", () => this.updateSelectionToolbar());
    this.registerDomEvent(document, "mouseup", () => this.updateSelectionToolbar());
    this.registerDomEvent(document, "keyup", () => this.updateSelectionToolbar());
    this.app.workspace.onLayoutReady(() => {
      this.updateToolbarContentOffset();
      this.updateSelectionToolbar();
    });
  }

  onunload() {
    this.clearToolbarContentOffset();
    this.selectionToolbarEl?.remove();
    this.toolbarEl?.remove();
    this.statusBarItem?.remove();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshFloatingToolbar();
    this.refreshSelectionToolbar();
    this.refreshStatusBarButton();
  }

  getCommands() {
    return this.commands;
  }

  isFavoriteCommand(commandId: string) {
    return this.settings.favoriteCommandIds.includes(commandId);
  }

  getRecentCommands() {
    return this.settings.recentCommandIds
      .map((id) => this.commands.find((command) => command.id === id))
      .filter((command): command is EditorCommand => Boolean(command));
  }

  async toggleFavoriteCommand(commandId: string) {
    const favoriteIds = new Set(this.settings.favoriteCommandIds);
    if (favoriteIds.has(commandId)) {
      favoriteIds.delete(commandId);
    } else {
      favoriteIds.add(commandId);
    }

    this.settings.favoriteCommandIds = [...favoriteIds];
    this.settings.toolbarPreset = "custom";
    await this.saveSettings();
  }

  async moveFavoriteCommand(commandId: string, direction: "up" | "down") {
    const ids = [...this.settings.favoriteCommandIds];
    const index = ids.indexOf(commandId);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) {
      return;
    }

    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    this.settings.favoriteCommandIds = ids;
    this.settings.toolbarPreset = "custom";
    await this.saveSettings();
  }

  async removeFavoriteCommand(commandId: string) {
    this.settings.favoriteCommandIds = this.settings.favoriteCommandIds.filter((id) => id !== commandId);
    this.settings.toolbarPreset = "custom";
    await this.saveSettings();
  }

  async applyToolbarPreset(preset: ToolbarPreset) {
    this.settings.toolbarPreset = preset;
    if (preset === "minimal") {
      this.settings.favoriteCommandIds = [];
    } else if (preset === "writer") {
      this.settings.favoriteCommandIds = ["insert-link", "mark-selection", "insert-note-callout", "insert-footnote-reference"];
    } else if (preset === "report") {
      this.settings.favoriteCommandIds = ["open-table-builder", "insert-graphite-wide-table", "insert-graphite-report-frontmatter", "insert-graphite-summary-callout"];
    } else if (preset === "full") {
      this.settings.favoriteCommandIds = [];
    }
    await this.saveSettings();
  }

  async toggleToolbarCollapsed() {
    this.settings.toolbarCollapsed = !this.settings.toolbarCollapsed;
    await this.saveSettings();
  }

  openPalette(category?: CommandCategory) {
    new OwenEditorPaletteModal(this.app, this, category).open();
  }

  openHighlightPalette(editor: Editor) {
    new OwenEditorHighlightModal(this.app, editor).open();
  }

  openTableBuilder(editor: Editor) {
    new OwenEditorTableBuilderModal(this.app, this, editor).open();
  }

  runCommand(command: EditorCommand) {
    const editor = this.getActiveEditor();
    if (!editor) {
      new Notice("Owen Editor: 활성 Markdown 편집기를 찾을 수 없습니다.");
      return;
    }
    this.executeCommand(command, editor);
  }

  private executeCommand(command: EditorCommand, editor: Editor) {
    command.run(editor);
    void this.recordRecentCommand(command.id);
  }

  private async recordRecentCommand(commandId: string) {
    this.settings.recentCommandIds = [commandId, ...this.settings.recentCommandIds.filter((id) => id !== commandId)].slice(0, 8);
    await this.saveData(this.settings);
  }

  private getActiveEditor(): Editor | null {
    return this.getActiveMarkdownView()?.editor ?? null;
  }

  private getActiveMarkdownView(): MarkdownView | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  private refreshStatusBarButton() {
    this.statusBarItem?.remove();
    this.statusBarItem = undefined;

    if (!this.settings.showStatusBarButton) {
      return;
    }

    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass("owen-editor-status-button");
    this.statusBarItem.setText("Owen Editor");
    this.statusBarItem.setAttr("aria-label", "Open Owen Editor palette");
    this.registerDomEvent(this.statusBarItem, "click", () => this.openPalette());
  }

  private refreshSelectionToolbar() {
    this.selectionToolbarEl?.remove();
    this.selectionToolbarEl = undefined;

    if (!this.settings.showSelectionToolbar) {
      return;
    }

    const toolbar = document.body.createDiv({ cls: "owen-editor-selection-toolbar" });
    toolbar.setAttr("aria-label", "Owen Editor selection toolbar");
    toolbar.addEventListener("mousedown", (event) => event.preventDefault());

    for (const id of ["bold-selection", "italic-selection", "mark-selection", "insert-link", "wrap-graphite-kbd", "wrap-graphite-blur"]) {
      const command = this.commands.find((candidate) => candidate.id === id);
      if (command) {
        this.createSelectionToolbarButton(toolbar, command);
      }
    }

    this.selectionToolbarEl = toolbar;
    this.updateSelectionToolbar();
  }

  private updateSelectionToolbar() {
    if (!this.settings.showSelectionToolbar || !this.selectionToolbarEl) {
      return;
    }

    const activeMarkdownView = this.getActiveMarkdownView();
    const editor = activeMarkdownView?.editor;
    if (!editor || !editor.getSelection()) {
      this.selectionToolbarEl.removeClass("is-visible");
      return;
    }

    const rect = this.getSelectionRect(activeMarkdownView.contentEl);
    if (!rect) {
      this.selectionToolbarEl.removeClass("is-visible");
      return;
    }

    const toolbarRect = this.selectionToolbarEl.getBoundingClientRect();
    const viewRect = activeMarkdownView.contentEl.getBoundingClientRect();
    const viewportLeft = Math.max(12, viewRect.left + 12);
    const viewportRight = Math.min(window.innerWidth - 12, viewRect.right - 12);
    const minTop = Math.max(12, viewRect.top + 8);
    const maxTop = Math.min(window.innerHeight - toolbarRect.height - 12, viewRect.bottom - toolbarRect.height - 8);
    const availableAbove = rect.top - minTop;
    const availableBelow = maxTop - rect.bottom;
    const showBelow = availableAbove < toolbarRect.height + 12 && availableBelow > availableAbove;
    const preferredTop = showBelow ? rect.bottom + 10 : rect.top - toolbarRect.height - 10;
    const preferredLeft = rect.left + rect.width / 2 - toolbarRect.width / 2;
    const left = Math.min(viewportRight - toolbarRect.width, Math.max(viewportLeft, preferredLeft));
    const top = Math.min(maxTop, Math.max(minTop, preferredTop));

    this.selectionToolbarEl.style.setProperty("left", `${Math.round(left)}px`);
    this.selectionToolbarEl.style.setProperty("top", `${Math.round(top)}px`);
    this.selectionToolbarEl.toggleClass("is-below", showBelow);
    this.selectionToolbarEl.toggleClass("is-above", !showBelow);
    this.selectionToolbarEl.addClass("is-visible");
  }

  private getSelectionRect(container: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      return null;
    }

    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    const rect = rects[0] ?? range.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  }

  private createSelectionToolbarButton(toolbar: HTMLElement, command: EditorCommand) {
    const button = toolbar.createEl("button", {
      cls: `owen-editor-selection-toolbar-button mod-${command.category.toLowerCase().replace(/\s+/g, "-")}`,
      attr: {
        type: "button",
        title: command.name,
        "aria-label": command.name
      }
    });
    setIcon(button.createSpan(), command.icon);
    this.registerDomEvent(button, "click", () => {
      this.runCommand(command);
      this.selectionToolbarEl?.removeClass("is-visible");
      window.setTimeout(() => this.updateSelectionToolbar(), 80);
    });
  }

  private refreshFloatingToolbar() {
    this.toolbarResizeObserver?.disconnect();
    this.toolbarResizeObserver = undefined;
    this.toolbarEl?.remove();
    this.toolbarEl = undefined;

    if (!this.settings.showFloatingToolbar) {
      this.clearToolbarContentOffset();
      return;
    }

    const toolbar = document.body.createDiv({
      cls: `owen-editor-glass-toolbar mod-${this.settings.toolbarPosition}${this.settings.toolbarCollapsed ? " is-collapsed" : ""}${this.settings.mobileCompactToolbar ? " is-mobile-compact" : ""}`
    });
    toolbar.setAttr("aria-label", "Owen Editor toolbar");

    if (this.settings.toolbarCollapsed) {
      this.createToolbarCollapseButton(toolbar, false);
      this.toolbarEl = toolbar;
      this.toolbarResizeObserver = new ResizeObserver(() => this.updateToolbarContentOffset());
      this.toolbarResizeObserver.observe(toolbar);
      this.updateToolbarContentOffset();
      return;
    }

    const primaryRow = toolbar.createDiv({ cls: "owen-editor-toolbar-row owen-editor-toolbar-primary-row" });

    const groups = getToolbarCommandGroups(this.settings.toolbarPreset);

    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        primaryRow.createDiv({ cls: "owen-editor-toolbar-separator" });
      }

      for (const id of group) {
        const command = this.commands.find((candidate) => candidate.id === id);
        if (command) {
          this.createToolbarButton(primaryRow, command);
        }
      }
    });

    const favoriteCommands = this.settings.favoriteCommandIds
      .map((id) => this.commands.find((command) => command.id === id))
      .filter((command): command is EditorCommand => Boolean(command));

    if (favoriteCommands.length > 0) {
      const favoriteRow = toolbar.createDiv({ cls: "owen-editor-toolbar-row owen-editor-toolbar-favorites-row" });
      for (const command of favoriteCommands.slice(0, 8)) {
        this.createToolbarButton(favoriteRow, command, true);
      }
    }

    primaryRow.createDiv({ cls: "owen-editor-toolbar-separator" });
    this.createToolbarGroupButton(primaryRow, "text-select", "Open selection tools", "Selection");
    this.createToolbarGroupButton(primaryRow, "link", "Open link tools", "Links");
    this.createToolbarGroupButton(primaryRow, "list-plus", "Open block tools", "Blocks");
    this.createToolbarGroupButton(primaryRow, "table-2", "Open table tools", "Tables");
    this.createToolbarGroupButton(primaryRow, "sparkles", "Open Owen Graphite tools", "Owen Graphite");

    const paletteButton = primaryRow.createEl("button", {
      cls: "owen-editor-toolbar-button owen-editor-toolbar-palette mod-all-commands",
      attr: {
        type: "button",
        title: "Open Owen Editor palette",
        "aria-label": "Open Owen Editor palette",
        "data-tooltip": "Open all Owen Editor commands"
      }
    });
    setIcon(paletteButton.createSpan(), "panel-top-open");
    this.registerDomEvent(paletteButton, "click", () => this.openPalette());
    this.createToolbarCollapseButton(primaryRow, true);

    this.toolbarEl = toolbar;
    this.toolbarResizeObserver = new ResizeObserver(() => this.updateToolbarContentOffset());
    this.toolbarResizeObserver.observe(toolbar);
    this.updateToolbarContentOffset();
  }

  private updateToolbarContentOffset() {
    if (!this.settings.showFloatingToolbar || !this.toolbarEl) {
      this.clearToolbarContentOffset();
      return;
    }

    const toolbarHeight = Math.ceil(this.toolbarEl.getBoundingClientRect().height);
    document.body.classList.add("owen-editor-toolbar-offset");
    document.body.classList.toggle("owen-editor-toolbar-top", this.settings.toolbarPosition === "top");
    document.body.classList.toggle("owen-editor-toolbar-bottom", this.settings.toolbarPosition === "bottom");
    document.body.style.setProperty("--owen-editor-toolbar-clearance", `${toolbarHeight + 28}px`);
    this.updateToolbarDocumentPlacement();
  }

  private updateToolbarDocumentPlacement() {
    const activeMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const viewEl = activeMarkdownView?.contentEl;

    if (!viewEl) {
      document.body.style.removeProperty("--owen-editor-toolbar-left");
      document.body.style.removeProperty("--owen-editor-toolbar-max-width");
      return;
    }

    const rect = viewEl.getBoundingClientRect();
    const horizontalInset = 32;
    const center = Math.round(rect.left + rect.width / 2);
    const maxWidth = Math.max(320, Math.floor(rect.width - horizontalInset));

    document.body.style.setProperty("--owen-editor-toolbar-left", `${center}px`);
    document.body.style.setProperty("--owen-editor-toolbar-max-width", `${maxWidth}px`);
  }

  private clearToolbarContentOffset() {
    this.toolbarResizeObserver?.disconnect();
    this.toolbarResizeObserver = undefined;
    document.body.classList.remove("owen-editor-toolbar-offset");
    document.body.classList.remove("owen-editor-toolbar-top");
    document.body.classList.remove("owen-editor-toolbar-bottom");
    document.body.style.removeProperty("--owen-editor-toolbar-clearance");
    document.body.style.removeProperty("--owen-editor-toolbar-left");
    document.body.style.removeProperty("--owen-editor-toolbar-max-width");
  }

  private createToolbarCollapseButton(container: HTMLElement, collapse: boolean) {
    const label = collapse ? "Collapse Owen Editor toolbar" : "Expand Owen Editor toolbar";
    const button = container.createEl("button", {
      cls: "owen-editor-toolbar-button owen-editor-toolbar-collapse",
      attr: {
        type: "button",
        title: label,
        "aria-label": label,
        "data-tooltip": label
      }
    });
    setIcon(button.createSpan(), collapse ? "chevrons-up-down" : "panel-top-open");
    this.registerDomEvent(button, "click", () => this.toggleToolbarCollapsed());
  }

  private createToolbarButton(toolbar: HTMLElement, command: EditorCommand, isFavorite = false) {
    const button = toolbar.createEl("button", {
      cls: `owen-editor-toolbar-button mod-${command.category.toLowerCase().replace(/\s+/g, "-")}${isFavorite ? " is-favorite" : ""}`,
      attr: {
        type: "button",
        title: command.name,
        "aria-label": command.name,
        "data-tooltip": command.name
      }
    });
    setIcon(button.createSpan(), command.icon);
    this.registerDomEvent(button, "click", () => this.runCommand(command));
  }

  private createToolbarGroupButton(toolbar: HTMLElement, icon: string, title: string, category: CommandCategory) {
    const button = toolbar.createEl("button", {
      cls: `owen-editor-toolbar-button owen-editor-toolbar-group-button mod-${category.toLowerCase().replace(/\s+/g, "-")}`,
      attr: {
        type: "button",
        title,
        "aria-label": title,
        "data-tooltip": title
      }
    });
    setIcon(button.createSpan(), icon);
    this.registerDomEvent(button, "click", () => this.openPalette(category));
  }

  private buildCommands(): EditorCommand[] {
    return [
      {
        id: "undo-edit",
        name: "Undo edit",
        icon: "undo-2",
        category: "Basic Markdown",
        run: (editor) => runEditorHistory(editor, "undo")
      },
      {
        id: "redo-edit",
        name: "Redo edit",
        icon: "redo-2",
        category: "Basic Markdown",
        run: (editor) => runEditorHistory(editor, "redo")
      },
      {
        id: "clear-formatting-selection",
        name: "Clear common Markdown formatting",
        icon: "eraser",
        category: "Basic Markdown",
        run: (editor) => clearCommonFormatting(editor)
      },
      {
        id: "bold-selection",
        name: "Bold selection",
        icon: "bold",
        category: "Selection",
        group: "Text styling",
        run: (editor) => wrapSelection(editor, "**", "**", "굵게")
      },
      {
        id: "italic-selection",
        name: "Italic selection",
        icon: "italic",
        category: "Selection",
        group: "Text styling",
        run: (editor) => wrapSelection(editor, "*", "*", "기울임")
      },
      {
        id: "strikethrough-selection",
        name: "Strikethrough selection",
        icon: "strikethrough",
        category: "Selection",
        group: "Text styling",
        run: (editor) => wrapSelection(editor, "~~", "~~", "취소선")
      },
      {
        id: "underline-selection",
        name: "Underline selection",
        icon: "underline",
        category: "Selection",
        group: "Text styling",
        run: (editor) => wrapSelection(editor, "<u>", "</u>", "밑줄")
      },
      {
        id: "inline-code-selection",
        name: "Inline code selection",
        icon: "code-2",
        category: "Selection",
        group: "Text styling",
        run: (editor) => wrapSelection(editor, "`", "`", "code")
      },
      {
        id: "mark-selection",
        name: "Highlight selection",
        icon: "highlighter",
        category: "Selection",
        group: "Text styling",
        run: (editor) => this.openHighlightPalette(editor)
      },
      {
        id: "insert-link",
        name: "Insert Markdown link",
        icon: "link",
        category: "Links",
        group: "Link inserts",
        run: (editor) => wrapSelection(editor, "[", "](https://)", "link text")
      },
      {
        id: "insert-attachment-link",
        name: "Insert attachment embed",
        icon: "paperclip",
        category: "Links",
        group: "Embeds",
        run: (editor) => wrapSelection(editor, "![[", "]]", "attachment.png")
      },
      {
        id: "outdent-lines",
        name: "Outdent line or selection",
        icon: "indent-decrease",
        category: "Basic Markdown",
        run: (editor) => adjustLineIndent(editor, "outdent")
      },
      {
        id: "indent-lines",
        name: "Indent line or selection",
        icon: "indent-increase",
        category: "Basic Markdown",
        run: (editor) => adjustLineIndent(editor, "indent")
      },
      {
        id: "insert-wikilink",
        name: "Insert wiki link",
        icon: "brackets",
        category: "Links",
        group: "Link inserts",
        run: (editor) => wrapSelection(editor, "[[", "]]", "Page")
      },
      {
        id: "insert-image-embed",
        name: "Insert image embed",
        icon: "image-plus",
        category: "Links",
        group: "Embeds",
        run: (editor) => wrapSelection(editor, "![](", ")", "image-url-or-path")
      },
      {
        id: "insert-footnote-reference",
        name: "Insert footnote reference",
        icon: "pilcrow",
        category: "Links",
        group: "References",
        run: (editor) => insertFootnote(editor)
      },
      {
        id: "heading-2",
        name: "Convert line to H2",
        icon: "heading-2",
        category: "Basic Markdown",
        run: (editor) => setCurrentLinePrefix(editor, "## ")
      },
      {
        id: "heading-3",
        name: "Convert line to H3",
        icon: "heading-3",
        category: "Basic Markdown",
        run: (editor) => setCurrentLinePrefix(editor, "### ")
      },
      {
        id: "heading-4",
        name: "Convert line to H4",
        icon: "heading-4",
        category: "Basic Markdown",
        run: (editor) => setCurrentLinePrefix(editor, "#### ")
      },
      {
        id: "toggle-task",
        name: "Toggle task line",
        icon: "list-todo",
        category: "Blocks",
        run: (editor) => setCurrentLinePrefix(editor, "- [ ] ")
      },
      {
        id: "insert-bulleted-list",
        name: "Convert line to bullet list",
        icon: "list",
        category: "Blocks",
        run: (editor) => setCurrentLinePrefix(editor, "- ")
      },
      {
        id: "insert-numbered-list",
        name: "Convert line to numbered list",
        icon: "list-ordered",
        category: "Blocks",
        run: (editor) => setCurrentLinePrefix(editor, "1. ")
      },
      {
        id: "insert-horizontal-rule",
        name: "Insert horizontal rule",
        icon: "minus",
        category: "Blocks",
        group: "Document blocks",
        run: (editor) => insertBlock(editor, "---")
      },
      {
        id: "insert-frontmatter-block",
        name: "Insert frontmatter block",
        icon: "file-json-2",
        category: "Blocks",
        group: "Document blocks",
        run: (editor) => insertBlock(editor, "---\ntitle: Untitled\ntags: []\n---")
      },
      {
        id: "insert-mermaid-block",
        name: "Insert Mermaid block",
        icon: "workflow",
        category: "Blocks",
        group: "Document blocks",
        run: (editor) => insertBlock(editor, "```mermaid\nflowchart TD\n  A[Start] --> B[Next]\n```")
      },
      {
        id: "insert-align-center-html",
        name: "Center align selection",
        icon: "align-center",
        category: "Blocks",
        run: (editor) => wrapSelection(editor, "<div style=\"text-align: center;\">\n", "\n</div>", "가운데 정렬")
      },
      {
        id: "insert-align-right-html",
        name: "Right align selection",
        icon: "align-right",
        category: "Blocks",
        run: (editor) => wrapSelection(editor, "<div style=\"text-align: right;\">\n", "\n</div>", "오른쪽 정렬")
      },
      {
        id: "blockquote-selection",
        name: "Blockquote selection",
        icon: "quote",
        category: "Selection",
        group: "Selection blocks",
        run: (editor) => prefixSelectionLines(editor, "> ")
      },
      {
        id: "code-block-selection",
        name: "Code block selection",
        icon: "file-code",
        category: "Selection",
        group: "Selection blocks",
        run: (editor) => wrapSelection(editor, "```\n", "\n```", "code")
      },
      {
        id: "comment-selection",
        name: "Comment selection",
        icon: "message-square-text",
        category: "Selection",
        group: "Comments and notices",
        run: (editor) => wrapSelection(editor, "<!-- ", " -->", "주석")
      },
      {
        id: "insert-markdown-table",
        name: "Insert Markdown table",
        icon: "table-2",
        category: "Tables",
        group: "Basic tables",
        run: (editor) => insertBlock(editor, "| 항목 | 설명 | 상태 |\n|---|---|---|\n| 예시 | 내용 | OK |")
      },
      {
        id: "open-table-builder",
        name: "Open table builder",
        icon: "table-properties",
        category: "Tables",
        group: "Basic tables",
        run: (editor) => this.openTableBuilder(editor)
      },
      ...CALLOUT_OPTIONS.map(createCalloutCommand),
      {
        id: "insert-graphite-wide-table",
        name: "Insert Owen Graphite wide comparison table",
        icon: "table-properties",
        category: "Tables",
        group: "Owen Graphite table presets",
        run: (editor) => insertGraphiteBlock(this, editor, GRAPHITE_WIDE_TABLE, GRAPHITE_WIDE_MARKDOWN_TABLE)
      },
      {
        id: "insert-graphite-risk-table",
        name: "Insert Owen Graphite risk table",
        icon: "shield-alert",
        category: "Tables",
        group: "Owen Graphite table presets",
        run: (editor) => insertGraphiteBlock(this, editor, GRAPHITE_RISK_TABLE, GRAPHITE_RISK_MARKDOWN_TABLE)
      },
      {
        id: "insert-graphite-numeric-table",
        name: "Insert Owen Graphite numeric table",
        icon: "chart-no-axes-column-increasing",
        category: "Tables",
        group: "Owen Graphite table presets",
        run: (editor) => insertGraphiteBlock(this, editor, GRAPHITE_NUMERIC_TABLE, GRAPHITE_NUMERIC_MARKDOWN_TABLE)
      },
      {
        id: "insert-graphite-matrix-table",
        name: "Insert Owen Graphite risk matrix",
        icon: "grid-3x3",
        category: "Tables",
        group: "Owen Graphite table presets",
        run: (editor) => insertGraphiteBlock(this, editor, GRAPHITE_MATRIX_TABLE, GRAPHITE_MATRIX_MARKDOWN_TABLE)
      },
      {
        id: "insert-graphite-reference-list",
        name: "Insert Owen Graphite reference list",
        icon: "library",
        category: "Owen Graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, GRAPHITE_REFERENCE_LIST);
        }
      },
      {
        id: "insert-template-executive-summary",
        name: "Insert executive summary document template",
        icon: "file-text",
        category: "Owen Graphite",
        group: "Document templates",
        aliases: ["template", "템플릿", "요약", "summary", "executive"],
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, DOCUMENT_TEMPLATES.executiveSummary);
        }
      },
      {
        id: "insert-template-comparison-report",
        name: "Insert comparison report template",
        icon: "columns-3",
        category: "Owen Graphite",
        group: "Document templates",
        aliases: ["template", "템플릿", "comparison", "비교", "matrix", "매트릭스"],
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, DOCUMENT_TEMPLATES.comparisonReport);
        }
      },
      {
        id: "insert-template-risk-review",
        name: "Insert risk review template",
        icon: "shield-alert",
        category: "Owen Graphite",
        group: "Document templates",
        aliases: ["template", "템플릿", "risk", "리스크", "review", "검토"],
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, DOCUMENT_TEMPLATES.riskReview);
        }
      },
      {
        id: "insert-template-meeting-review",
        name: "Insert meeting review template",
        icon: "calendar-check",
        category: "Blocks",
        group: "Document templates",
        aliases: ["template", "템플릿", "meeting", "회의", "review", "검토"],
        run: (editor) => insertBlock(editor, DOCUMENT_TEMPLATES.meetingReview)
      },
      {
        id: "insert-graphite-report-frontmatter",
        name: "Insert Owen Graphite report frontmatter",
        icon: "file-sliders",
        category: "Owen Graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, "---\ntitle: 보고서 제목\ndate: 2026-04-27\ntags:\n  - report\ncssclasses:\n  - ogd-report-mode\n  - ogd-page-a3-land\n  - ogd-modern-tables\n  - ogd-print-avoid-breaks\ncover: true\n---");
        }
      },
      {
        id: "wrap-graphite-kbd",
        name: "Wrap selection with Owen Graphite kbd",
        icon: "keyboard",
        category: "Owen Graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          wrapSelection(editor, "<kbd>", "</kbd>", "Cmd+K");
        }
      },
      {
        id: "wrap-graphite-blur",
        name: "Wrap selection with Owen Graphite blur",
        icon: "eye-off",
        category: "Owen Graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          wrapSelection(editor, "<span class=\"ogd-blur\">", "</span>", "비공개 내용");
        }
      },
      {
        id: "insert-graphite-secret-callout",
        name: "Insert Owen Graphite secret callout",
        icon: "lock-keyhole",
        category: "Owen Graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, "> [!secret] Restricted\n> hover 시 표시할 내용을 입력합니다.");
        }
      },
      {
        id: "insert-graphite-summary-callout",
        name: "Insert Owen Graphite executive summary",
        icon: "notebook-text",
        category: "Owen Graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, "> [!summary] Executive summary\n> 핵심 판단과 근거를 간결하게 정리합니다.");
        }
      },
      {
        id: "insert-graphite-action-callout",
        name: "Insert Owen Graphite action summary",
        icon: "list-checks",
        category: "Owen Graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, "> [!action] Action items\n> - 담당자: \n> - 기한: \n> - 다음 단계:");
        }
      },
      {
        id: "insert-graphite-status-badge",
        name: "Insert Owen Graphite status badge",
        icon: "badge-check",
        category: "Owen Graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, "<span class=\"ogd-status-badge is-e5\">E5</span> <span class=\"ogd-status-badge is-payg\">PAYG</span> <span class=\"ogd-status-badge is-addon\">Add-on</span>");
        }
      }
    ];
  }

  ensureGraphiteThemeNotice() {
    if (!this.settings.showGraphiteThemeNotice || this.graphiteNoticeShown || this.isOwenGraphiteThemeActive()) {
      return;
    }

    this.graphiteNoticeShown = true;
    new Notice("Owen Editor: Owen Graphite 테마가 활성화되어야 Graphite 전용 스타일이 적용됩니다.");
  }

  private isOwenGraphiteThemeActive() {
    const vaultWithConfig = this.app.vault as unknown as { getConfig?: (key: string) => unknown };
    const cssTheme = String(vaultWithConfig.getConfig?.("cssTheme") ?? "").toLowerCase();
    return cssTheme.includes("owen graphite") || cssTheme.includes("owen-graphite");
  }
}

class OwenEditorPaletteModal extends Modal {
  private plugin: OwenEditorPlugin;
  private initialCategory?: CommandCategory;
  private query = "";

  constructor(app: App, plugin: OwenEditorPlugin, initialCategory?: CommandCategory) {
    super(app);
    this.plugin = plugin;
    this.initialCategory = initialCategory;
  }

  onOpen() {
    this.modalEl.addClass("owen-editor-palette-modal");
    this.titleEl.setText("Owen Editor");
    this.render();
  }

  private render() {
    this.contentEl.empty();
    this.contentEl.addClass("owen-editor-palette");

    const searchInput = this.contentEl.createEl("input", {
      cls: "owen-editor-search",
      attr: {
        type: "search",
        placeholder: "명령 검색"
      }
    });
    searchInput.value = this.query;
    searchInput.addEventListener("input", () => {
      this.query = searchInput.value.toLowerCase();
      this.render();
    });

    this.contentEl.createDiv({
      cls: "owen-editor-palette-context",
      text: this.initialCategory ? `${this.initialCategory} tools` : "Search results are prioritized above grouped browsing."
    });

    const commands = this.plugin.getCommands().filter((command) => {
      const haystack = getCommandSearchText(command);
      return (!this.initialCategory || command.category === this.initialCategory) && haystack.includes(this.query);
    });

    const recentCommands = this.plugin.getRecentCommands()
      .filter((command) => !this.initialCategory || command.category === this.initialCategory)
      .filter((command) => getCommandSearchText(command).includes(this.query));

    if (recentCommands.length > 0) {
      const recentSection = this.contentEl.createDiv({ cls: "owen-editor-command-section owen-editor-recent-section" });
      recentSection.createEl("h3", { text: "Recent", cls: "owen-editor-group-title" });
      this.renderCommandGrid(recentSection, recentCommands.slice(0, 6));
    }

    for (const category of ["Basic Markdown", "Selection", "Links", "Blocks", "Tables", "Owen Graphite"] as CommandCategory[]) {
      if (this.initialCategory && category !== this.initialCategory) {
        continue;
      }

      const groupCommands = commands.filter((command) => command.category === category);
      if (groupCommands.length === 0) {
        continue;
      }

      const section = this.contentEl.createDiv({ cls: `owen-editor-command-section mod-${category.toLowerCase().replace(/\s+/g, "-")}` });
      section.createEl("h3", { text: category, cls: "owen-editor-group-title" });
      const commandGroups = [...new Set(groupCommands.map((command) => command.group ?? category))];
      for (const commandGroup of commandGroups) {
        if (commandGroups.length > 1) {
          section.createEl("h4", { text: commandGroup, cls: "owen-editor-subgroup-title" });
        }
        this.renderCommandGrid(section, groupCommands.filter((candidate) => (candidate.group ?? category) === commandGroup));
      }
    }

    searchInput.focus();
  }

  private renderCommandGrid(container: HTMLElement, commands: EditorCommand[]) {
    const grid = container.createDiv({ cls: "owen-editor-command-grid" });
    for (const command of commands) {
      const item = grid.createDiv({ cls: "owen-editor-command-item" });
      const button = item.createEl("button", {
        cls: "owen-editor-command-button",
        attr: { type: "button" }
      });
      const icon = button.createSpan({ cls: "owen-editor-command-icon" });
      setIcon(icon, command.icon);
      const copy = button.createDiv({ cls: "owen-editor-command-copy" });
      copy.createSpan({ text: command.name, cls: "owen-editor-command-label" });
      const preview = getCommandPreview(command);
      if (preview) {
        copy.createSpan({ text: preview, cls: "owen-editor-command-preview" });
      }
      button.addEventListener("click", () => {
        this.plugin.runCommand(command);
        this.close();
      });

      const favoriteButton = item.createEl("button", {
        cls: `owen-editor-favorite-button${this.plugin.isFavoriteCommand(command.id) ? " is-active" : ""}`,
        attr: {
          type: "button",
          "aria-label": this.plugin.isFavoriteCommand(command.id) ? `Remove ${command.name} from toolbar favorites` : `Add ${command.name} to toolbar favorites`,
          title: this.plugin.isFavoriteCommand(command.id) ? "Remove from toolbar favorites" : "Add to toolbar favorites"
        }
      });
      setIcon(favoriteButton, this.plugin.isFavoriteCommand(command.id) ? "star" : "star-off");
      favoriteButton.addEventListener("click", async () => {
        await this.plugin.toggleFavoriteCommand(command.id);
        this.render();
      });
    }
  }
}

function getCommandSearchText(command: EditorCommand) {
  return [
    command.id,
    command.category,
    command.group ?? "",
    command.name,
    ...getCommandSearchAliases(command)
  ].join(" ").toLowerCase();
}

function getCommandSearchAliases(command: EditorCommand) {
  const aliases = [...(command.aliases ?? [])];
  const categoryAliases: Record<CommandCategory, string[]> = {
    "Basic Markdown": ["markdown", "md", "마크다운", "기본", "서식", "format"],
    Selection: ["selection", "select", "선택", "감싸기", "wrap", "quote", "인용", "comment", "주석"],
    Links: ["link", "links", "링크", "위키", "wiki", "embed", "임베드", "attachment", "첨부", "image", "이미지", "footnote", "각주"],
    Blocks: ["block", "blocks", "블록", "문서", "frontmatter", "프론트매터", "mermaid", "머메이드", "align", "정렬", "callout", "콜아웃"],
    Tables: ["table", "tables", "표", "테이블", "matrix", "매트릭스", "risk", "리스크", "numeric", "숫자", "wide", "넓은표"],
    "Owen Graphite": ["owen", "graphite", "그래파이트", "오웬", "theme", "테마", "report", "보고서", "badge", "배지", "blur", "숨김", "secret", "비밀"]
  };

  aliases.push(...categoryAliases[command.category]);

  if (command.id.includes("table")) {
    aliases.push("표", "테이블", "grid", "그리드");
  }
  if (command.id.includes("highlight") || command.id.includes("mark")) {
    aliases.push("highlight", "강조", "하이라이트", "mark", "형광펜");
  }
  if (command.id.includes("graphite")) {
    aliases.push("owen graphite", "그래파이트", "테마", "보고서", "ogd");
  }
  if (command.id.includes("callout")) {
    aliases.push("callout", "콜아웃", "알림", "notice");
  }
  if (command.id.includes("link")) {
    aliases.push("link", "링크", "url", "주소");
  }
  if (command.id.includes("list")) {
    aliases.push("list", "목록", "리스트", "bullet", "번호");
  }

  return aliases;
}

function getCommandPreview(command: EditorCommand) {
  if (command.id === "wrap-graphite-kbd") {
    return "kbd · Cmd+K";
  }
  if (command.id === "wrap-graphite-blur") {
    return "blur · hidden text";
  }
  if (command.id.includes("graphite") && command.id.includes("table")) {
    return "Graphite table preset";
  }
  if (command.id.includes("callout")) {
    return command.category === "Owen Graphite" ? "Graphite callout sample" : "Obsidian callout";
  }
  if (command.id.includes("template")) {
    return "document template";
  }
  if (command.id.includes("highlight") || command.id.includes("mark")) {
    return "==highlight==";
  }
  return "";
}

class OwenEditorTableBuilderModal extends Modal {
  private plugin: OwenEditorPlugin;
  private editor: Editor;
  private options: TableBuilderOptions = {
    rows: 3,
    columns: 3,
    includeHeader: true,
    preset: "markdown",
    useHtml: false,
    sourceText: ""
  };

  constructor(app: App, plugin: OwenEditorPlugin, editor: Editor) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
  }

  onOpen() {
    this.titleEl.setText("Table builder");
    this.render();
  }

  private render() {
    this.contentEl.empty();
    this.contentEl.addClass("owen-editor-table-builder");

    let previewCode: HTMLElement;
    const refreshPreview = () => {
      previewCode.setText(buildTableFromOptions(this.options));
    };

    new Setting(this.contentEl)
      .setName("Rows")
      .addText((text) => text
        .setValue(String(this.options.rows))
        .onChange((value) => {
          this.options.rows = clampInteger(value, 1, 20, 3);
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName("Columns")
      .addText((text) => text
        .setValue(String(this.options.columns))
        .onChange((value) => {
          this.options.columns = clampInteger(value, 1, 12, 3);
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName("Header row")
      .addToggle((toggle) => toggle
        .setValue(this.options.includeHeader)
        .onChange((value) => {
          this.options.includeHeader = value;
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName("Preset")
      .addDropdown((dropdown) => dropdown
        .addOption("markdown", "Markdown")
        .addOption("wide", "Owen Graphite wide")
        .addOption("risk", "Owen Graphite risk")
        .addOption("numeric", "Owen Graphite numeric")
        .setValue(this.options.preset)
        .onChange((value) => {
          this.options.preset = value as TableBuilderPreset;
          this.options.useHtml = this.options.preset !== "markdown" || this.options.useHtml;
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName("Use HTML table")
      .setDesc("HTML tables can carry Owen Graphite CSS classes.")
      .addToggle((toggle) => toggle
        .setValue(this.options.useHtml)
        .onChange((value) => {
          this.options.useHtml = value;
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName("CSV or TSV source")
      .setDesc("붙여넣은 표 데이터가 있으면 rows/columns 대신 이 값을 사용합니다.")
      .addTextArea((text) => text
        .setPlaceholder("Name\tStatus\tOwner\nItem A\tReady\tOwen")
        .setValue(this.options.sourceText)
        .onChange((value) => {
          this.options.sourceText = value;
          refreshPreview();
        }));

    this.contentEl.createEl("h3", { text: "Preview", cls: "owen-editor-table-builder-preview-title" });
    const preview = this.contentEl.createEl("pre", { cls: "owen-editor-table-builder-preview" });
    previewCode = preview.createEl("code");
    refreshPreview();

    const actions = this.contentEl.createDiv({ cls: "owen-editor-table-builder-actions" });
    const insertButton = actions.createEl("button", { text: "Insert table", cls: "mod-cta", attr: { type: "button" } });
    insertButton.addEventListener("click", () => {
      if (this.options.preset !== "markdown" || this.options.useHtml) {
        this.plugin.ensureGraphiteThemeNotice();
      }
      insertBlock(this.editor, buildTableFromOptions(this.options));
      this.close();
    });
  }
}

class OwenEditorHighlightModal extends Modal {
  private editor: Editor;

  constructor(app: App, editor: Editor) {
    super(app);
    this.editor = editor;
  }

  onOpen() {
    this.titleEl.setText("Highlight selection");
    this.contentEl.empty();
    this.contentEl.addClass("owen-editor-highlight-palette");

    this.contentEl.createEl("p", {
      text: "권장 색상",
      cls: "owen-editor-highlight-label"
    });

    const grid = this.contentEl.createDiv({ cls: "owen-editor-highlight-grid" });
    for (const option of HIGHLIGHT_COLOR_OPTIONS) {
      const button = grid.createEl("button", {
        cls: "owen-editor-highlight-option",
        attr: { type: "button" }
      });
      button.createSpan({
        cls: "owen-editor-highlight-swatch",
        attr: { style: `background: ${option.background}; color: ${option.foreground};` }
      }).setText("Aa");
      const text = button.createDiv({ cls: "owen-editor-highlight-copy" });
      text.createSpan({ text: option.name, cls: "owen-editor-highlight-name" });
      text.createSpan({ text: option.description, cls: "owen-editor-highlight-description" });
      button.addEventListener("click", () => {
        applyHighlightSelection(this.editor, option);
        this.close();
      });
    }
  }
}

class OwenEditorSettingTab extends PluginSettingTab {
  private plugin: OwenEditorPlugin;

  constructor(app: App, plugin: OwenEditorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("owen-editor-settings-tab");
    this.createSettingsSection("Toolbar", "위치, 접기, 프리셋, 즐겨찾기 행을 관리합니다.");

    new Setting(containerEl)
      .setName("Show floating glass toolbar")
      .setDesc("편집 화면 위에 가로형 투명 유리 아이콘 툴바를 표시합니다.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showFloatingToolbar)
        .onChange(async (value) => {
          this.plugin.settings.showFloatingToolbar = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Toolbar position")
      .setDesc("상단 또는 하단에 툴바를 고정합니다. 하단은 문서 제목 영역을 더 넓게 쓰고 싶을 때 좋습니다.")
      .addDropdown((dropdown) => dropdown
        .addOption("top", "Top")
        .addOption("bottom", "Bottom")
        .setValue(this.plugin.settings.toolbarPosition)
        .onChange(async (value) => {
          this.plugin.settings.toolbarPosition = value as ToolbarPosition;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Toolbar preset")
      .setDesc("작업 방식에 맞는 기본 툴바 구성을 빠르게 적용합니다.")
      .addDropdown((dropdown) => dropdown
        .addOption("minimal", "Minimal")
        .addOption("writer", "Writer")
        .addOption("report", "Report")
        .addOption("full", "Full")
        .addOption("custom", "Custom")
        .setValue(this.plugin.settings.toolbarPreset)
        .onChange(async (value) => {
          await this.plugin.applyToolbarPreset(value as ToolbarPreset);
          this.display();
        }));

    new Setting(containerEl)
      .setName("Start with toolbar collapsed")
      .setDesc("툴바를 작은 버튼 하나로 접어두고 필요할 때 펼칩니다.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.toolbarCollapsed)
        .onChange(async (value) => {
          this.plugin.settings.toolbarCollapsed = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Compact toolbar on mobile")
      .setDesc("모바일에서는 툴바 버튼을 더 작게 표시하고 줄바꿈을 허용합니다.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.mobileCompactToolbar)
        .onChange(async (value) => {
          this.plugin.settings.mobileCompactToolbar = value;
          await this.plugin.saveSettings();
        }));

    this.createSettingsSection("Selection tools", "선택한 텍스트 바로 옆에서 쓰는 인라인 작업입니다.");

    new Setting(containerEl)
      .setName("Show selection mini toolbar")
      .setDesc("텍스트 선택 시 굵게, 기울임, 강조, 링크, kbd, blur 도구를 선택 영역 근처에 표시합니다.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showSelectionToolbar)
        .onChange(async (value) => {
          this.plugin.settings.showSelectionToolbar = value;
          await this.plugin.saveSettings();
        }));

    this.createSettingsSection("Shortcuts", "상태바와 빠른 실행 진입점을 설정합니다.");

    new Setting(containerEl)
      .setName("Show status bar button")
      .setDesc("상태바에서 Owen Editor 팔레트를 빠르게 엽니다.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showStatusBarButton)
        .onChange(async (value) => {
          this.plugin.settings.showStatusBarButton = value;
          await this.plugin.saveSettings();
        }));

    this.createSettingsSection("Graphite helpers", "Owen Graphite 전용 삽입물의 출력과 안내를 설정합니다.");

    new Setting(containerEl)
      .setName("Prefer Owen Graphite HTML tables")
      .setDesc("보고서형 표 명령에서 Owen Graphite CSS 클래스를 포함한 HTML 표를 사용합니다.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.insertHtmlTables)
        .onChange(async (value) => {
          this.plugin.settings.insertHtmlTables = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Warn when Owen Graphite is not active")
      .setDesc("Owen Graphite 전용 스니펫을 사용할 때 테마가 활성화되어 있지 않으면 한 번 안내합니다.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showGraphiteThemeNotice)
        .onChange(async (value) => {
          this.plugin.settings.showGraphiteThemeNotice = value;
          await this.plugin.saveSettings();
        }));

    this.createSettingsSection("Favorites", "팔레트의 별 버튼으로 고정한 명령을 정리합니다.");

    new Setting(containerEl)
      .setName("Toolbar favorites")
      .setDesc("툴바에 고정할 명령 ID를 쉼표로 구분해 입력합니다. 팔레트의 별 버튼으로도 관리할 수 있습니다.")
      .addTextArea((text) => text
        .setPlaceholder("insert-graphite-wide-table, open-table-builder")
        .setValue(this.plugin.settings.favoriteCommandIds.join(", "))
        .onChange(async (value) => {
          this.plugin.settings.favoriteCommandIds = value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
          this.plugin.settings.toolbarPreset = "custom";
          await this.plugin.saveSettings();
        }));

    const favoriteCommands = this.plugin.settings.favoriteCommandIds
      .map((id) => this.plugin.getCommands().find((command) => command.id === id) ?? id)
      .filter(Boolean);

    if (favoriteCommands.length > 0) {
      new Setting(containerEl)
        .setName("Favorite order")
        .setHeading();
      const favoriteList = containerEl.createDiv({ cls: "owen-editor-favorite-settings-list" });
      for (const favorite of favoriteCommands) {
        const commandId = typeof favorite === "string" ? favorite : favorite.id;
        const label = typeof favorite === "string" ? favorite : favorite.name;
        const row = favoriteList.createDiv({ cls: "owen-editor-favorite-settings-row" });
        row.createSpan({ text: label, cls: "owen-editor-favorite-settings-label" });

        const moveUp = row.createEl("button", { text: "Up", attr: { type: "button" } });
        moveUp.addEventListener("click", async () => {
          await this.plugin.moveFavoriteCommand(commandId, "up");
          this.display();
        });

        const moveDown = row.createEl("button", { text: "Down", attr: { type: "button" } });
        moveDown.addEventListener("click", async () => {
          await this.plugin.moveFavoriteCommand(commandId, "down");
          this.display();
        });

        const remove = row.createEl("button", { text: "Remove", attr: { type: "button" } });
        remove.addEventListener("click", async () => {
          await this.plugin.removeFavoriteCommand(commandId);
          this.display();
        });
      }
    }
  }

  private createSettingsSection(title: string, description: string) {
    new Setting(this.containerEl)
      .setName(title)
      .setDesc(description)
      .setHeading();
  }
}

function wrapSelection(editor: Editor, before: string, after: string, placeholder: string) {
  const selection = editor.getSelection() || placeholder;
  editor.replaceSelection(`${before}${selection}${after}`);
}

function applyHighlightSelection(editor: Editor, option: HighlightColorOption) {
  const selection = editor.getSelection() || "강조";
  if (option.format === "markdown") {
    editor.replaceSelection(`==${selection}==`);
    return;
  }

  editor.replaceSelection(`<mark style="background-color: ${option.background}; color: ${option.foreground};">${selection}</mark>`);
}

function createCalloutCommand(option: typeof CALLOUT_OPTIONS[number]): EditorCommand {
  return {
    id: `insert-${option.id}-callout`,
    name: option.name,
    icon: option.icon,
    category: "Selection",
    group: "Comments and notices",
    run: (editor) => insertBlock(editor, `> [!${option.id}] ${option.title}\n> ${option.body}`)
  };
}

function runEditorHistory(editor: Editor, action: "undo" | "redo") {
  const editorWithHistory = editor as Editor & { undo?: () => void; redo?: () => void };
  editorWithHistory[action]?.();
}

function clearCommonFormatting(editor: Editor) {
  const selection = editor.getSelection();
  if (!selection) {
    return;
  }

  const cleaned = selection
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<\/?u>/g, "")
    .replace(/<span class="ogd-blur">([^<]+)<\/span>/g, "$1");

  editor.replaceSelection(cleaned);
}

function adjustLineIndent(editor: Editor, direction: "indent" | "outdent") {
  const selection = editor.getSelection();
  const transform = (line: string) => direction === "indent" ? `  ${line}` : line.replace(/^( {1,2}|\t)/, "");

  if (selection) {
    editor.replaceSelection(selection.split("\n").map(transform).join("\n"));
    return;
  }

  const cursor = editor.getCursor();
  editor.setLine(cursor.line, transform(editor.getLine(cursor.line)));
}

function insertBlock(editor: Editor, text: string) {
  const cursor = editor.getCursor();
  const prefix = cursor.ch === 0 ? "" : "\n";
  editor.replaceRange(`${prefix}${text}\n`, cursor);
}

function insertFootnote(editor: Editor) {
  const selection = editor.getSelection() || "참고 내용";
  const cursor = editor.getCursor();
  editor.replaceSelection(`${selection}[^1]`);
  editor.replaceRange(`\n\n[^1]: ${selection}\n`, { line: cursor.line + 1, ch: 0 });
}

function insertGraphiteBlock(plugin: OwenEditorPlugin, editor: Editor, htmlText: string, markdownText: string) {
  plugin.ensureGraphiteThemeNotice();
  insertBlock(editor, plugin.settings.insertHtmlTables ? htmlText : markdownText);
}

function clampInteger(value: string, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function buildTableFromOptions(options: TableBuilderOptions) {
  const sourceRows = parseDelimitedTable(options.sourceText);
  if (sourceRows.length > 0) {
    return options.useHtml || options.preset !== "markdown" ? buildHtmlTableFromRows(options, sourceRows) : buildMarkdownTableFromRows(sourceRows, options.includeHeader);
  }

  if (options.useHtml || options.preset !== "markdown") {
    return buildHtmlTable(options);
  }
  return buildMarkdownTable(options);
}

function parseDelimitedTable(sourceText: string) {
  const trimmed = sourceText.trim();
  if (!trimmed) {
    return [];
  }

  const delimiter = trimmed.includes("\t") ? "\t" : ",";
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.split(delimiter).map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
}

function buildMarkdownTableFromRows(rows: string[][], includeHeader: boolean) {
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => normalizeTableRow(row, width));
  const headers = includeHeader ? normalizedRows[0] : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
  const bodyRows = includeHeader ? normalizedRows.slice(1) : normalizedRows;
  const headerLine = `| ${headers.join(" | ")} |`;
  const dividerLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = bodyRows.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, dividerLine, ...bodyLines].join("\n");
}

function buildHtmlTableFromRows(options: TableBuilderOptions, rows: string[][]) {
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => normalizeTableRow(row, width));
  const headers = options.includeHeader ? normalizedRows[0] : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
  const bodyRows = options.includeHeader ? normalizedRows.slice(1) : normalizedRows;
  const headerHtml = `\n  <thead>\n    <tr>\n${headers.map((header) => `      <th>${escapeHtml(header)}</th>`).join("\n")}\n    </tr>\n  </thead>`;
  const bodyHtml = `\n  <tbody>\n${bodyRows.map((row) => `    <tr>\n${row.map((cell, index) => `      <td${getCellClass(options.preset, index)}>${escapeHtml(cell)}</td>`).join("\n")}\n    </tr>`).join("\n")}\n  </tbody>`;
  const classes = getTablePresetClasses(options.preset);
  return `<table${classes ? ` class="${classes}"` : ""}>${headerHtml}${bodyHtml}\n</table>`;
}

function normalizeTableRow(row: string[], width: number) {
  return Array.from({ length: width }, (_, index) => row[index] ?? "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMarkdownTable(options: TableBuilderOptions) {
  const headers = Array.from({ length: options.columns }, (_, index) => `Column ${index + 1}`);
  const rows = Array.from({ length: options.rows }, (_, rowIndex) => Array.from({ length: options.columns }, (_, columnIndex) => `Cell ${rowIndex + 1}-${columnIndex + 1}`));
  const headerLine = `| ${headers.join(" | ")} |`;
  const dividerLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = rows.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, dividerLine, ...bodyLines].join("\n");
}

function buildHtmlTable(options: TableBuilderOptions) {
  const classes = getTablePresetClasses(options.preset);
  const headers = Array.from({ length: options.columns }, (_, index) => `Column ${index + 1}`);
  const rows = Array.from({ length: options.rows }, (_, rowIndex) => Array.from({ length: options.columns }, (_, columnIndex) => getTableCellText(options.preset, rowIndex, columnIndex)));
  const headerHtml = options.includeHeader ? `\n  <thead>\n    <tr>\n${headers.map((header) => `      <th>${header}</th>`).join("\n")}\n    </tr>\n  </thead>` : "";
  const bodyHtml = `\n  <tbody>\n${rows.map((row) => `    <tr>\n${row.map((cell, index) => `      <td${getCellClass(options.preset, index)}>${cell}</td>`).join("\n")}\n    </tr>`).join("\n")}\n  </tbody>`;
  return `<table${classes ? ` class="${classes}"` : ""}>${headerHtml}${bodyHtml}\n</table>`;
}

function getTablePresetClasses(preset: TableBuilderPreset) {
  if (preset === "wide") {
    return "wide-table print-fit-table comparison-table wrap-table";
  }
  if (preset === "risk") {
    return "risk-table compact-table";
  }
  if (preset === "numeric") {
    return "numeric-table print-fit-table";
  }
  return "";
}

function getTableCellText(preset: TableBuilderPreset, rowIndex: number, columnIndex: number) {
  if (preset === "risk" && columnIndex === 0) {
    return `Risk ${rowIndex + 1}`;
  }
  if (preset === "risk" && columnIndex === 1) {
    return "Impact";
  }
  if (preset === "numeric" && columnIndex > 0) {
    return String((rowIndex + 1) * (columnIndex + 1) * 10);
  }
  return `Cell ${rowIndex + 1}-${columnIndex + 1}`;
}

function getCellClass(preset: TableBuilderPreset, columnIndex: number) {
  if (preset === "numeric" && columnIndex > 0) {
    return " class=\"num\"";
  }
  if (preset === "risk" && columnIndex === 0) {
    return " class=\"risk-medium\"";
  }
  return "";
}

function setCurrentLinePrefix(editor: Editor, prefix: string) {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const cleaned = line.replace(/^(#{1,6}\s+|[-*+]\s+|>\s+|- \[[ xX]\]\s+)/, "");
  editor.setLine(cursor.line, `${prefix}${cleaned}`);
}

function prefixSelectionLines(editor: Editor, prefix: string) {
  const selection = editor.getSelection();
  if (!selection) {
    setCurrentLinePrefix(editor, prefix);
    return;
  }
  editor.replaceSelection(selection.split("\n").map((line) => `${prefix}${line}`).join("\n"));
}
