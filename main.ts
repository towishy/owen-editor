import { App, Editor, MarkdownView, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting, moment, setIcon } from "obsidian";
import { registerCodeBlockTitleEditing } from "./code-block-titles";
import { registerFrostedScrollbars } from "./frosted-scrollbars";
import { isLanguagePreference, resolveLanguage, translate, translateCommandName, type Language, type LanguagePreference, type TranslationKey } from "./i18n";

interface OwenEditorSettings {
  language: LanguagePreference;
  showFloatingToolbar: boolean;
  showSelectionToolbar: boolean;
  showStatusBarButton: boolean;
  insertHtmlTables: boolean;
  showGraphiteThemeNotice: boolean;
  toolbarPosition: ToolbarPosition;
  toolbarPreset: ToolbarPreset;
  toolbarCollapsed: boolean;
  toolbarScale: number;
  toolbarDensity: ToolbarDensity;
  favoriteDisplay: FavoriteDisplayMode;
  mobileCompactToolbar: boolean;
  contextAwareToolbar: boolean;
  commandFeedback: boolean;
  favoriteCommandIds: string[];
  recentCommandIds: string[];
}

const DEFAULT_SETTINGS: OwenEditorSettings = {
  language: "auto",
  showFloatingToolbar: true,
  showSelectionToolbar: true,
  showStatusBarButton: true,
  insertHtmlTables: true,
  showGraphiteThemeNotice: true,
  toolbarPosition: "top",
  toolbarPreset: "full",
  toolbarCollapsed: false,
  toolbarScale: 90,
  toolbarDensity: "balanced",
  favoriteDisplay: "hover",
  mobileCompactToolbar: true,
  contextAwareToolbar: true,
  commandFeedback: true,
  favoriteCommandIds: ["insert-link", "mark-selection", "open-table-builder", "insert-graphite-summary-callout"],
  recentCommandIds: []
};

const LIQUID_GLASS_FILTER_ID = "owen-editor-liquid-glass-filter";
const LIQUID_GLASS_FILTER_SVG_ID = "owen-editor-liquid-glass-filter-svg";
const SVG_NS = "http://www.w3.org/2000/svg";

type CommandCategory = "Basic markdown" | "Selection" | "Links" | "Blocks" | "Tables" | "Owen graphite";
type ToolbarPosition = "top" | "bottom";
type ToolbarPreset = "minimal" | "writer" | "report" | "full" | "custom";
type FavoriteDisplayMode = "always" | "hover" | "hidden";
type ToolbarDensity = "compact" | "balanced" | "comfortable" | "custom";
type ToolbarContext = "default" | "selection" | "table" | "code" | "report";
type FavoritePreset = "writer" | "research" | "report" | "table-heavy";
type ReportStarterKind = "executive" | "comparison" | "risk" | "meeting";
type CommandCategoryFilter = CommandCategory | CommandCategory[];
type PointerAnchor = { x: number; y: number; timestamp: number };

const clampToolbarScale = (value: number) => Math.min(110, Math.max(80, Number.isFinite(value) ? value : 100));
const getAdaptiveToolbarScale = (scale: number, viewWidth?: number) => {
  const configuredScale = clampToolbarScale(scale);
  if (viewWidth === undefined) {
    return configuredScale;
  }
  if (viewWidth < 520) {
    return Math.min(configuredScale, 85);
  }
  if (viewWidth < 760) {
    return Math.min(configuredScale, 90);
  }
  return configuredScale;
};

const TOOLBAR_DENSITY_SETTINGS: Record<Exclude<ToolbarDensity, "custom">, Pick<OwenEditorSettings, "toolbarScale" | "favoriteDisplay" | "mobileCompactToolbar">> = {
  compact: { toolbarScale: 85, favoriteDisplay: "hidden", mobileCompactToolbar: true },
  balanced: { toolbarScale: 90, favoriteDisplay: "hover", mobileCompactToolbar: true },
  comfortable: { toolbarScale: 100, favoriteDisplay: "always", mobileCompactToolbar: false }
};

const FAVORITE_PRESETS: Record<FavoritePreset, { name: string; commandIds: string[] }> = {
  writer: { name: "Writer", commandIds: ["insert-link", "mark-selection", "insert-note-callout", "insert-footnote-reference"] },
  research: { name: "Research", commandIds: ["insert-wikilink", "insert-footnote-reference", "insert-graphite-reference-list", "insert-graphite-source-note"] },
  report: { name: "Report", commandIds: ["open-graphite-report-starter", "open-table-builder", "insert-graphite-wide-table", "insert-graphite-summary-callout"] },
  "table-heavy": { name: "Table-heavy", commandIds: ["open-table-builder", "convert-selection-to-graphite-table", "unwrap-selected-table", "insert-graphite-wide-table"] }
};

const REPORT_STARTER_OPTIONS: Record<ReportStarterKind, { name: string; template: "executiveSummary" | "comparisonReport" | "riskReview" | "meetingReview"; preset: TableBuilderPreset }> = {
  executive: { name: "Executive summary", template: "executiveSummary", preset: "wide" },
  comparison: { name: "Comparison report", template: "comparisonReport", preset: "wide" },
  risk: { name: "Risk review", template: "riskReview", preset: "risk" },
  meeting: { name: "Meeting review", template: "meetingReview", preset: "markdown" }
};

function setSafeIcon(element: HTMLElement, icon: string) {
  try {
    setIcon(element, icon);
  } catch {
    element.replaceChildren();
  }

  if (!element.querySelector("svg") && !element.textContent?.trim()) {
    element.setText("*");
    element.addClass("owen-editor-icon-fallback");
  }
}

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
  { name: "Default markdown", description: "Obsidian 기본 ==highlight==", background: "#fff3a3", foreground: "#1f2937", format: "markdown" },
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

const GRAPHITE_SOURCE_NOTE = `<p class="table-source">Source: Microsoft Learn, internal workshop notes, 2026.</p>`;

const GRAPHITE_METRIC_ROW = `<div class="ogd-metric-row">
  <div class="ogd-metric-card"><strong>95%</strong><span>Coverage</span></div>
  <div class="ogd-metric-card"><strong>12</strong><span>Open risks</span></div>
  <div class="ogd-metric-card"><strong>3</strong><span>Next actions</span></div>
</div>`;

const GRAPHITE_DECISION_MATRIX = `<table class="matrix-table compact-table print-fit-table">
  <thead>
    <tr><th>Option</th><th>Fit</th><th>Risk</th><th>Cost</th><th>Decision</th></tr>
  </thead>
  <tbody>
    <tr><td>Baseline</td><td>High</td><td class="risk-low">Low</td><td class="num">1x</td><td>Adopt</td></tr>
    <tr><td>Advanced</td><td>Medium</td><td class="risk-medium">Medium</td><td class="num">1.6x</td><td>Phase 2</td></tr>
  </tbody>
</table>`;
const DOCUMENT_TEMPLATES = {
  executiveSummary: `---
title: Executive summary
tags:
  - report
cssclasses:
  - ogd-report-mode
  - ogd-modern-tables
---

# Executive summary

> [!summary] 핵심 결론
> 의사결정자가 먼저 봐야 할 결론을 3문장 이내로 작성합니다.

## Key findings

- Finding 1:
- Finding 2:
- Finding 3:

## Recommendation

- Owner:
- Due date:
- Next step:
`,
  comparisonReport: `---
title: Comparison matrix
tags:
  - report
cssclasses:
  - ogd-report-mode
  - ogd-modern-tables
  - ogd-print-avoid-breaks
---

# Comparison matrix

${GRAPHITE_WIDE_TABLE}

## Notes

- 비교 기준:
- 예외 사항:
- 권장안:
`,
  riskReview: `---
title: Risk review
tags:
  - risk
cssclasses:
  - ogd-report-mode
  - ogd-modern-tables
---

# Risk review

${GRAPHITE_RISK_TABLE}

## Mitigation plan

- High:
- Medium:
- Follow-up:
`,
  meetingReview: `---
title: Meeting review
tags:
  - meeting
---

# Meeting review

## Agenda

-

## Decisions

-

## Action items

> [!action] Next steps
> - 담당자:
> - 기한:
> - 다음 단계:
`
};

function getToolbarCommandGroups(preset: ToolbarPreset, context: ToolbarContext = "default") {
  if (context === "selection") {
    return [
      ["undo-edit", "redo-edit"],
      ["bold-selection", "italic-selection", "mark-selection"],
      ["insert-link", "unwrap-selected-table", "unwrap-markdown-selection"]
    ];
  }

  if (context === "table") {
    return [
      ["undo-edit", "redo-edit"],
      ["open-table-builder", "unwrap-selected-table"],
      ["insert-markdown-table", "insert-graphite-wide-table"]
    ];
  }

  if (context === "report") {
    return [
      ["undo-edit", "redo-edit"],
      ["heading-1", "heading-2", "mark-selection"],
      ["open-table-builder", "insert-graphite-summary-callout"]
    ];
  }

  if (context === "code") {
    return [
      ["undo-edit", "redo-edit"],
      ["code-block-selection", "comment-selection"],
      ["insert-mermaid-block", "insert-horizontal-rule"]
    ];
  }

  if (preset === "minimal") {
    return [
      ["undo-edit", "redo-edit"],
      ["bold-selection", "italic-selection", "mark-selection"],
      ["insert-link", "toggle-task"]
    ];
  }

  if (preset === "writer") {
    return [
      ["undo-edit", "redo-edit"],
      ["heading-1", "heading-2", "bold-selection", "italic-selection", "mark-selection"],
      ["toggle-task"]
    ];
  }

  if (preset === "report") {
    return [
      ["undo-edit", "redo-edit"],
      ["heading-1", "heading-2", "mark-selection"],
      ["open-table-builder", "insert-graphite-summary-callout"]
    ];
  }

  return [
    ["undo-edit", "redo-edit"],
    ["heading-1", "heading-2", "bold-selection", "italic-selection", "mark-selection"],
    ["toggle-task"]
  ];
}

function getToolbarGroupLabel(plugin: OwenEditorPlugin, context: ToolbarContext, groupIndex: number) {
  if (groupIndex === 0) {
    return plugin.t("toolbar.history");
  }
  if (groupIndex === 1) {
    return context === "default" ? plugin.t("toolbar.formatting") : plugin.t("toolbar.contextActions", { context: getToolbarContextLabel(plugin, context) });
  }
  return context === "default" ? plugin.t("toolbar.documentActions") : plugin.t("toolbar.relatedActions");
}

function getToolbarContextLabel(plugin: OwenEditorPlugin, context: ToolbarContext) {
  const keys: Record<ToolbarContext, TranslationKey> = {
    default: "category.basic",
    selection: "category.selection",
    table: "category.tables",
    code: "group.documentBlocks",
    report: "settings.report"
  };
  return plugin.t(keys[context]);
}

export default class OwenEditorPlugin extends Plugin {
  settings: OwenEditorSettings;
  private commands: EditorCommand[] = [];
  private toolbarEl?: HTMLElement;
  private selectionToolbarEl?: HTMLElement;
  private liquidGlassFilterEl?: SVGSVGElement;
  private statusBarItem?: HTMLElement;
  private ribbonEl?: HTMLElement;
  private toolbarResizeObserver?: ResizeObserver;
  private selectionToolbarFrame?: number;
  private lastPointerAnchor?: PointerAnchor;
  private currentToolbarContext: ToolbarContext = "default";
  private graphiteNoticeShown = false;
  private optionalUiWarningShown = false;
  private settingTab?: OwenEditorSettingTab;

  get language(): Language {
    return resolveLanguage(this.settings.language, moment.locale());
  }

  t(key: TranslationKey, variables?: Record<string, string | number>) {
    return translate(this.language, key, variables);
  }

  onload(): void {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      await this.loadSettings();
      this.commands = this.buildCommands();
      this.registerPluginCommands();
      registerFrostedScrollbars(this);
      registerCodeBlockTitleEditing(this, () => ({
        copied: this.t("codeTitle.copied"),
        copy: this.t("codeTitle.copy"),
        copyError: this.t("codeTitle.copyError"),
        edit: this.t("codeTitle.edit"),
        saveError: this.t("codeTitle.saveError")
      }));
      this.settingTab = new OwenEditorSettingTab(this.app, this);
      this.addSettingTab(this.settingTab);
      this.initializePluginUi();
    } catch (error) {
      console.error("Owen Editor failed to initialize", error);
      this.settings = Object.assign({}, DEFAULT_SETTINGS);
      this.commands = [];
      this.settingTab = new OwenEditorSettingTab(this.app, this);
      this.runOptionalUiSetup("settings tab", () => this.addSettingTab(this.settingTab!));
      this.showOptionalUiWarning("startup fallback");
    }
  }

  private registerPluginCommands() {
    this.runOptionalUiSetup("ribbon shortcut", () => {
      this.ribbonEl = this.addRibbonIcon("pencil-line", this.t("ribbon.openPalette"), () => this.openPalette());
    });
    this.addCommand({
      id: "open-palette",
      name: this.t("command.openPalette"),
      callback: () => this.openPalette()
    });
    this.addCommand({
      id: "toggle-toolbar-collapse",
      name: this.t("command.toggleToolbar"),
      callback: () => this.toggleToolbarCollapsed()
    });

    for (const command of this.commands) {
      this.addCommand({
        id: command.id,
        name: command.name,
        editorCallback: (editor) => this.executeCommand(command, editor)
      });
    }
  }

  private initializePluginUi() {
    this.runOptionalUiSetup("liquid glass filter", () => this.ensureLiquidGlassFilter());
    this.runOptionalUiSetup("toolbar scale", () => this.applyToolbarScale());
    this.runOptionalUiSetup("floating toolbar", () => this.refreshFloatingToolbar());
    this.runOptionalUiSetup("selection toolbar", () => this.refreshSelectionToolbar());
    this.runOptionalUiSetup("status bar button", () => this.refreshStatusBarButton());
    this.runOptionalUiSetup("toolbar events", () => {
      const recordPointerAnchor = (event: PointerEvent) => {
        this.lastPointerAnchor = { x: event.clientX, y: event.clientY, timestamp: Date.now() };
      };

      this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateToolbarContentOffset()));
      this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleSelectionToolbarUpdate()));
      this.registerEvent(this.app.workspace.on("layout-change", () => {
        this.updateToolbarContentOffset();
        this.scheduleSelectionToolbarUpdate();
      }));
      this.registerDomEvent(window, "resize", () => {
        this.updateToolbarContentOffset();
        this.scheduleSelectionToolbarUpdate();
      });
      this.registerDomEvent(window, "scroll", () => this.scheduleSelectionToolbarUpdate(), true);
      this.registerDomEvent(activeDocument, "selectionchange", () => {
        this.scheduleSelectionToolbarUpdate();
        this.refreshToolbarForContext();
      });
      this.registerDomEvent(activeDocument, "pointermove", recordPointerAnchor);
      this.registerDomEvent(activeDocument, "pointerup", (event) => {
        recordPointerAnchor(event);
        this.scheduleSelectionToolbarUpdate();
        this.refreshToolbarForContext();
      });
      this.registerDomEvent(activeDocument, "keyup", () => {
        this.scheduleSelectionToolbarUpdate();
        this.refreshToolbarForContext();
      });
      this.app.workspace.onLayoutReady(() => {
        this.updateToolbarContentOffset();
        this.scheduleSelectionToolbarUpdate();
      });
    });
  }

  private runOptionalUiSetup(label: string, setup: () => void) {
    try {
      setup();
    } catch {
      this.showOptionalUiWarning(label);
    }
  }

  private showOptionalUiWarning(label: string) {
    if (this.optionalUiWarningShown) {
      return;
    }

    this.optionalUiWarningShown = true;
    try {
      new Notice(this.t("notice.optionalUi"));
    } catch {
      console.warn(`Owen Editor: ${label} could not initialize.`);
    }
  }

  onunload() {
    if (this.selectionToolbarFrame !== undefined) {
      window.cancelAnimationFrame(this.selectionToolbarFrame);
      this.selectionToolbarFrame = undefined;
    }
    this.clearToolbarContentOffset();
    activeDocument.body.style.removeProperty("--owen-editor-toolbar-scale");
    this.selectionToolbarEl?.remove();
    this.toolbarEl?.remove();
    this.liquidGlassFilterEl?.remove();
    this.statusBarItem?.remove();
  }

  private ensureLiquidGlassFilter() {
    if (this.liquidGlassFilterEl?.isConnected) {
      return;
    }

    activeDocument.getElementById(LIQUID_GLASS_FILTER_SVG_ID)?.remove();

    const svg = activeDocument.createElementNS(SVG_NS, "svg");
    svg.id = LIQUID_GLASS_FILTER_SVG_ID;
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "owen-editor-liquid-glass-filter-svg");

    const filter = activeDocument.createElementNS(SVG_NS, "filter");
    filter.id = LIQUID_GLASS_FILTER_ID;
    filter.setAttribute("x", "0%");
    filter.setAttribute("y", "0%");
    filter.setAttribute("width", "100%");
    filter.setAttribute("height", "100%");
    filter.setAttribute("filterUnits", "objectBoundingBox");

    const componentTransfer = activeDocument.createElementNS(SVG_NS, "feComponentTransfer");
    componentTransfer.setAttribute("in", "SourceAlpha");
    componentTransfer.setAttribute("result", "alpha");

    const alpha = activeDocument.createElementNS(SVG_NS, "feFuncA");
    alpha.setAttribute("type", "identity");
    componentTransfer.appendChild(alpha);

    const blur = activeDocument.createElementNS(SVG_NS, "feGaussianBlur");
    blur.setAttribute("in", "alpha");
    blur.setAttribute("stdDeviation", "16");
    blur.setAttribute("result", "blur");

    const displacement = activeDocument.createElementNS(SVG_NS, "feDisplacementMap");
    displacement.setAttribute("in", "SourceGraphic");
    displacement.setAttribute("in2", "blur");
    displacement.setAttribute("scale", "16");
    displacement.setAttribute("xChannelSelector", "A");
    displacement.setAttribute("yChannelSelector", "A");

    filter.appendChild(componentTransfer);
    filter.appendChild(blur);
    filter.appendChild(displacement);
    svg.appendChild(filter);
    activeDocument.body.appendChild(svg);
    this.liquidGlassFilterEl = svg;
  }

  async loadSettings() {
    let loadedSettings: Partial<OwenEditorSettings> | null = null;
    try {
      const loadedData: unknown = await this.loadData();
      loadedSettings = typeof loadedData === "object" && loadedData !== null ? loadedData : null;
    } catch (error) {
      console.warn("Owen Editor could not load saved settings; using defaults.", error);
    }
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedSettings);
    if (!isLanguagePreference(this.settings.language)) {
      this.settings.language = DEFAULT_SETTINGS.language;
    }
    this.settings.toolbarScale = clampToolbarScale(this.settings.toolbarScale);
    if (!["compact", "balanced", "comfortable", "custom"].includes(this.settings.toolbarDensity)) {
      this.settings.toolbarDensity = DEFAULT_SETTINGS.toolbarDensity;
    }
    if (!["always", "hover", "hidden"].includes(this.settings.favoriteDisplay)) {
      this.settings.favoriteDisplay = DEFAULT_SETTINGS.favoriteDisplay;
    }
    if (!loadedSettings || !Array.isArray(loadedSettings.favoriteCommandIds)) {
      this.settings.favoriteCommandIds = [...DEFAULT_SETTINGS.favoriteCommandIds];
    }
  }

  async saveSettings() {
    this.settings.toolbarScale = clampToolbarScale(this.settings.toolbarScale);
    await this.saveData(this.settings);
    this.applyToolbarScale();
    this.refreshFloatingToolbar();
    this.refreshSelectionToolbar();
    this.refreshStatusBarButton();
  }

  async setLanguage(language: LanguagePreference) {
    if (language === this.settings.language) {
      return;
    }
    this.settings.language = language;
    this.commands = this.buildCommands();
    await this.saveData(this.settings);
    this.refreshRegisteredCommandNames();
    this.refreshRibbonLabel();
    this.refreshFloatingToolbar();
    this.refreshSelectionToolbar();
    this.refreshStatusBarButton();
    this.settingTab?.display();
  }

  private refreshRegisteredCommandNames() {
    const commandsApi = (this.app as App & { commands?: { commands?: Record<string, { name: string }> } }).commands;
    const registeredCommands = commandsApi?.commands;
    if (!registeredCommands) {
      return;
    }
    const names = new Map(this.commands.map((command) => [command.id, command.name]));
    names.set("open-palette", this.t("command.openPalette"));
    names.set("toggle-toolbar-collapse", this.t("command.toggleToolbar"));
    for (const [id, name] of names) {
      const registered = registeredCommands[`${this.manifest.id}:${id}`];
      if (registered) {
        registered.name = name;
      }
    }
  }

  private refreshRibbonLabel() {
    if (!this.ribbonEl) {
      return;
    }
    const label = this.t("ribbon.openPalette");
    this.ribbonEl.setAttr("aria-label", label);
    this.ribbonEl.setAttr("data-tooltip-position", "right");
    this.ribbonEl.setAttr("title", label);
  }

  private applyToolbarScale(viewWidth?: number) {
    activeDocument.body.style.setProperty("--owen-editor-toolbar-scale", `${getAdaptiveToolbarScale(this.settings.toolbarScale, viewWidth) / 100}`);
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

  async addFavoriteCommand(commandId: string) {
    if (this.settings.favoriteCommandIds.includes(commandId)) {
      return;
    }

    this.settings.favoriteCommandIds = [...this.settings.favoriteCommandIds, commandId];
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

  async applyToolbarDensity(density: ToolbarDensity) {
    this.settings.toolbarDensity = density;
    if (density !== "custom") {
      Object.assign(this.settings, TOOLBAR_DENSITY_SETTINGS[density]);
    }
    await this.saveSettings();
  }

  async applyFavoritePreset(preset: FavoritePreset) {
    this.settings.favoriteCommandIds = [...FAVORITE_PRESETS[preset].commandIds];
    this.settings.toolbarPreset = "custom";
    await this.saveSettings();
  }

  async replaceSettings(nextSettings: Partial<OwenEditorSettings>) {
    this.settings = Object.assign({}, this.settings, nextSettings);
    await this.saveSettings();
  }

  async toggleToolbarCollapsed() {
    this.settings.toolbarCollapsed = !this.settings.toolbarCollapsed;
    await this.saveSettings();
  }

  openPalette(category?: CommandCategoryFilter) {
    new OwenEditorPaletteModal(this.app, this, category).open();
  }

  openHighlightPalette(editor: Editor) {
    new OwenEditorHighlightModal(this.app, this, editor).open();
  }

  openTableBuilder(editor: Editor) {
    new OwenEditorTableBuilderModal(this.app, this, editor).open();
  }

  openReportStarter(editor: Editor) {
    new OwenEditorReportStarterModal(this.app, this, editor).open();
  }

  getRecommendedCommands(parsedQuery: ParsedCommandQuery, initialCategory?: CommandCategoryFilter) {
    if (parsedQuery.text) {
      return [];
    }

    const context = this.getToolbarContext();
    const idsByContext: Record<ToolbarContext, string[]> = {
      default: ["open-graphite-report-starter", "open-table-builder", "insert-link"],
      selection: ["mark-selection", "insert-link", "wrap-graphite-kbd", "comment-selection"],
      table: ["unwrap-selected-table", "open-table-builder", "convert-selection-to-graphite-table", "insert-graphite-source-note"],
      code: ["code-block-selection", "insert-mermaid-block", "comment-selection"],
      report: ["open-graphite-report-starter", "insert-graphite-summary-callout", "insert-graphite-action-callout", "insert-graphite-source-note"]
    };

    return idsByContext[context]
      .map((id) => this.commands.find((command) => command.id === id))
      .filter((command): command is EditorCommand => Boolean(command))
      .filter((command) => categoryMatchesFilter(command.category, initialCategory));
  }

  runCommand(command: EditorCommand) {
    const editor = this.getActiveEditor();
    if (!editor) {
      new Notice(this.t("notice.noEditor"));
      return;
    }
    this.executeCommand(command, editor);
  }

  private executeCommand(command: EditorCommand, editor: Editor) {
    command.run(editor);
    if (this.settings.commandFeedback) {
      this.flashCommand(command.id);
    }
    void this.recordRecentCommand(command.id);
  }

  private flashCommand(commandId: string) {
    const buttons = Array.from(activeDocument.querySelectorAll<HTMLElement>(`.owen-editor-toolbar-button[data-command-id="${commandId}"]`));
    for (const button of buttons) {
      button.addClass("is-command-success");
      window.setTimeout(() => button.removeClass("is-command-success"), 320);
    }
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
    this.statusBarItem.setText(this.t("status.editorPalette"));
    this.statusBarItem.setAttr("aria-label", this.t("toolbar.openPalette"));
    this.registerDomEvent(this.statusBarItem, "click", () => this.openPalette());
  }

  private refreshSelectionToolbar() {
    this.selectionToolbarEl?.remove();
    this.selectionToolbarEl = undefined;

    if (!this.settings.showSelectionToolbar) {
      return;
    }

    const toolbar = activeDocument.body.createDiv({ cls: "owen-editor-selection-toolbar" });
    toolbar.setAttr("aria-label", this.t("toolbar.selection"));
    toolbar.addEventListener("mousedown", (event) => event.preventDefault());

    for (const id of ["bold-selection", "italic-selection", "mark-selection", "insert-link", "unwrap-selected-table", "unwrap-markdown-selection", "wrap-graphite-kbd", "wrap-graphite-blur"]) {
      const command = this.commands.find((candidate) => candidate.id === id);
      if (command) {
        this.createSelectionToolbarButton(toolbar, command);
      }
    }

    this.selectionToolbarEl = toolbar;
    this.updateSelectionToolbar();
  }

  private scheduleSelectionToolbarUpdate() {
    if (this.selectionToolbarFrame !== undefined) {
      return;
    }

    this.selectionToolbarFrame = window.requestAnimationFrame(() => {
      this.selectionToolbarFrame = undefined;
      this.updateSelectionToolbar();
    });
  }

  private refreshToolbarForContext() {
    if (!this.settings.showFloatingToolbar || !this.settings.contextAwareToolbar || this.settings.toolbarCollapsed) {
      return;
    }

    const nextContext = this.getToolbarContext();
    if (nextContext !== this.currentToolbarContext) {
      this.currentToolbarContext = nextContext;
      this.refreshFloatingToolbar();
    }
  }

  private getToolbarContext(): ToolbarContext {
    const view = this.getActiveMarkdownView();
    const editor = view?.editor;
    if (!editor) {
      return "default";
    }
    const selection = editor.getSelection();
    if (selection && containsTableStructure(selection)) {
      return "table";
    }
    if (selection) {
      return "selection";
    }

    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    if (isInsideFence(editor, cursor.line)) {
      return "code";
    }
    if (/^\s*\|.*\|\s*$/.test(line) || isInsideHtmlTable(editor, cursor.line)) {
      return "table";
    }
    if (this.isReportDocument(editor)) {
      return "report";
    }
    return "default";
  }

  private isReportDocument(editor: Editor) {
    const firstLines = Array.from({ length: Math.min(editor.lineCount(), 24) }, (_, index) => editor.getLine(index)).join("\n").toLowerCase();
    return firstLines.includes("ogd-report-mode") || firstLines.includes("ogd-page-a3") || firstLines.includes("tags:") && firstLines.includes("report");
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
    const anchor = this.getRecentPointerAnchor(viewRect) ?? rect;
    const viewportLeft = Math.max(12, viewRect.left + 12);
    const viewportRight = Math.min(window.innerWidth - 12, viewRect.right - 12);
    const minTop = Math.max(12, viewRect.top + 8);
    const maxTop = Math.min(window.innerHeight - toolbarRect.height - 12, viewRect.bottom - toolbarRect.height - 8);
    const availableAbove = anchor.top - minTop;
    const availableBelow = maxTop - anchor.bottom;
    const showBelow = availableAbove < toolbarRect.height + 12 && availableBelow > availableAbove;
    const preferredTop = showBelow ? anchor.bottom + 10 : anchor.top - toolbarRect.height - 10;
    const preferredLeft = anchor.left + anchor.width / 2 - toolbarRect.width / 2;
    const left = Math.min(viewportRight - toolbarRect.width, Math.max(viewportLeft, preferredLeft));
    const top = Math.min(maxTop, Math.max(minTop, preferredTop));

    this.selectionToolbarEl.style.setProperty("left", `${Math.round(left)}px`);
    this.selectionToolbarEl.style.setProperty("top", `${Math.round(top)}px`);
    this.selectionToolbarEl.toggleClass("is-below", showBelow);
    this.selectionToolbarEl.toggleClass("is-above", !showBelow);
    this.selectionToolbarEl.addClass("is-visible");
  }

  private getRecentPointerAnchor(viewRect: DOMRect) {
    const anchor = this.lastPointerAnchor;
    if (!anchor || Date.now() - anchor.timestamp > 8000) {
      return null;
    }

    const margin = 8;
    if (anchor.x < viewRect.left - margin || anchor.x > viewRect.right + margin || anchor.y < viewRect.top - margin || anchor.y > viewRect.bottom + margin) {
      return null;
    }

    return {
      left: anchor.x,
      right: anchor.x,
      top: anchor.y,
      bottom: anchor.y,
      width: 0,
      height: 0
    };
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
    setSafeIcon(button.createSpan(), command.icon);
    this.registerDomEvent(button, "click", () => {
      this.runCommand(command);
      this.selectionToolbarEl?.removeClass("is-visible");
      window.setTimeout(() => this.scheduleSelectionToolbarUpdate(), 80);
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

    const toolbar = activeDocument.body.createDiv({
      cls: `owen-editor-glass-toolbar mod-${this.settings.toolbarPosition} is-favorites-${this.settings.favoriteDisplay}${this.settings.toolbarCollapsed ? " is-collapsed" : ""}${this.settings.mobileCompactToolbar ? " is-mobile-compact" : ""}`
    });
    toolbar.setAttr("aria-label", this.t("toolbar.editor"));

    if (this.settings.toolbarCollapsed) {
      this.createToolbarCollapseButton(toolbar, false);
      this.toolbarEl = toolbar;
      this.observeToolbarResize(toolbar);
      this.updateToolbarContentOffset();
      return;
    }

    const primaryRow = toolbar.createDiv({ cls: "owen-editor-toolbar-row owen-editor-toolbar-primary-row" });

    this.currentToolbarContext = this.settings.contextAwareToolbar ? this.getToolbarContext() : "default";
    const groups = getToolbarCommandGroups(this.settings.toolbarPreset, this.currentToolbarContext);
    const primaryCommandIds = new Set(groups.flat());

    groups.forEach((group, groupIndex) => {
      const commandGroup = this.createToolbarControlGroup(primaryRow, getToolbarGroupLabel(this, this.currentToolbarContext, groupIndex));
      for (const id of group) {
        const command = this.commands.find((candidate) => candidate.id === id);
        if (command) {
          this.createToolbarButton(commandGroup, command);
        }
      }
    });

    const favoriteCommands = this.settings.favoriteCommandIds
      .map((id) => this.commands.find((command) => command.id === id))
      .filter((command): command is EditorCommand => Boolean(command));
    const uniqueFavoriteCommands = favoriteCommands.filter((command) => !primaryCommandIds.has(command.id));

    if (uniqueFavoriteCommands.length > 0 && this.settings.favoriteDisplay !== "hidden") {
      const favoriteRow = toolbar.createDiv({ cls: "owen-editor-toolbar-row owen-editor-toolbar-favorites-row" });
      favoriteRow.setAttr("role", "group");
      favoriteRow.setAttr("aria-label", this.t("toolbar.favorites"));
      for (const command of uniqueFavoriteCommands.slice(0, 8)) {
        this.createToolbarButton(favoriteRow, command, true);
      }
    }

    const collectionGroup = this.createToolbarControlGroup(primaryRow, this.t("toolbar.collections"), "owen-editor-toolbar-collection-group");
    this.createToolbarCommandMenuButton(collectionGroup, "heading", this.t("toolbar.headingTools"), ["heading-1", "heading-2", "heading-3", "heading-4"], "headings");
    this.createToolbarGroupButton(collectionGroup, "link", this.t("toolbar.linkTools"), "Links");
    this.createToolbarGroupButton(collectionGroup, "list-plus", this.t("toolbar.blockTools"), "Blocks");
    this.createToolbarGroupButton(collectionGroup, "table-2", this.t("toolbar.tableTools"), "Tables");

    const utilityGroup = this.createToolbarControlGroup(primaryRow, this.t("toolbar.controls"), "owen-editor-toolbar-utility-group");
    this.createToolbarMoreButton(utilityGroup);
    this.createToolbarCollapseButton(utilityGroup, true);

    this.toolbarEl = toolbar;
    this.observeToolbarResize(toolbar);
    this.updateToolbarContentOffset();
  }

  private updateToolbarContentOffset() {
    if (!this.settings.showFloatingToolbar || !this.toolbarEl) {
      this.clearToolbarContentOffset();
      return;
    }

    const toolbarHeight = Math.ceil(this.toolbarEl.getBoundingClientRect().height);
    activeDocument.body.classList.add("owen-editor-toolbar-offset");
    activeDocument.body.classList.toggle("owen-editor-toolbar-top", this.settings.toolbarPosition === "top");
    activeDocument.body.classList.toggle("owen-editor-toolbar-bottom", this.settings.toolbarPosition === "bottom");
    activeDocument.body.style.setProperty("--owen-editor-toolbar-clearance", `${toolbarHeight + 28}px`);
    this.updateToolbarDocumentPlacement();
  }

  private updateToolbarDocumentPlacement() {
    const activeMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const viewEl = activeMarkdownView?.contentEl;

    if (!viewEl) {
      activeDocument.body.style.removeProperty("--owen-editor-toolbar-left");
      activeDocument.body.style.removeProperty("--owen-editor-toolbar-max-width");
      this.applyToolbarScale();
      return;
    }

    const rect = viewEl.getBoundingClientRect();
    const horizontalInset = 32;
    const center = Math.round(rect.left + rect.width / 2);
    const maxWidth = Math.max(320, Math.floor(rect.width - horizontalInset));

    activeDocument.body.style.setProperty("--owen-editor-toolbar-left", `${center}px`);
    activeDocument.body.style.setProperty("--owen-editor-toolbar-max-width", `${maxWidth}px`);
    this.applyToolbarScale(rect.width);
  }

  private clearToolbarContentOffset() {
    this.toolbarResizeObserver?.disconnect();
    this.toolbarResizeObserver = undefined;
    activeDocument.body.classList.remove("owen-editor-toolbar-offset");
    activeDocument.body.classList.remove("owen-editor-toolbar-top");
    activeDocument.body.classList.remove("owen-editor-toolbar-bottom");
    activeDocument.body.style.removeProperty("--owen-editor-toolbar-clearance");
    activeDocument.body.style.removeProperty("--owen-editor-toolbar-left");
    activeDocument.body.style.removeProperty("--owen-editor-toolbar-max-width");
  }

  private observeToolbarResize(toolbar: HTMLElement) {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    this.toolbarResizeObserver = new ResizeObserver(() => this.updateToolbarContentOffset());
    this.toolbarResizeObserver.observe(toolbar);
  }

  private createToolbarCollapseButton(container: HTMLElement, collapse: boolean) {
    const label = collapse ? this.t("toolbar.collapse") : this.t("toolbar.expand");
    const button = container.createEl("button", {
      cls: "owen-editor-toolbar-button owen-editor-toolbar-collapse",
      attr: {
        type: "button",
        title: label,
        "aria-label": label,
        "data-tooltip": label
      }
    });
    setSafeIcon(button.createSpan(), collapse ? "chevrons-up-down" : "panel-top-open");
    this.registerDomEvent(button, "click", () => this.toggleToolbarCollapsed());
  }

  private createToolbarButton(toolbar: HTMLElement, command: EditorCommand, isFavorite = false) {
    const button = toolbar.createEl("button", {
      cls: `owen-editor-toolbar-button mod-${command.category.toLowerCase().replace(/\s+/g, "-")}${isFavorite ? " is-favorite" : ""}`,
      attr: {
        type: "button",
        title: command.name,
        "aria-label": command.name,
        "data-command-id": command.id,
        "data-tooltip": command.name
      }
    });
    setSafeIcon(button.createSpan(), command.icon);
    this.registerDomEvent(button, "click", () => this.runCommand(command));
  }

  private createToolbarGroupButton(toolbar: HTMLElement, icon: string, title: string, category: CommandCategoryFilter) {
    const button = toolbar.createEl("button", {
      cls: `owen-editor-toolbar-button owen-editor-toolbar-group-button mod-${getCategoryFilterClass(category)}`,
      attr: {
        type: "button",
        title,
        "aria-label": title,
        "aria-haspopup": "dialog",
        "data-tooltip": title
      }
    });
    setSafeIcon(button.createSpan(), icon);
    this.registerDomEvent(button, "click", () => this.openPalette(category));
  }

  private createToolbarControlGroup(container: HTMLElement, label: string, extraClass = "") {
    const group = container.createDiv({ cls: `owen-editor-toolbar-control-group${extraClass ? ` ${extraClass}` : ""}` });
    group.setAttr("role", "group");
    group.setAttr("aria-label", label);
    return group;
  }

  private createToolbarCommandMenuButton(container: HTMLElement, icon: string, title: string, commandIds: string[], modifier: string) {
    const button = container.createEl("button", {
      cls: `owen-editor-toolbar-button owen-editor-toolbar-group-button mod-${modifier}`,
      attr: {
        type: "button",
        title,
        "aria-label": title,
        "aria-haspopup": "menu",
        "aria-expanded": "false",
        "data-tooltip": title
      }
    });
    setSafeIcon(button.createSpan(), icon);
    this.registerDomEvent(button, "click", () => this.showToolbarCommandMenu(button, commandIds));
  }

  private showToolbarCommandMenu(button: HTMLButtonElement, commandIds: string[]) {
    const menu = new Menu();
    for (const id of commandIds) {
      const command = this.commands.find((candidate) => candidate.id === id);
      if (command) {
        menu.addItem((item) => item
          .setTitle(command.name)
          .setIcon(command.icon)
          .onClick(() => this.runCommand(command)));
      }
    }
    this.showToolbarMenu(button, menu);
  }

  private createToolbarMoreButton(container: HTMLElement) {
    const title = this.t("toolbar.moreTools");
    const button = container.createEl("button", {
      cls: "owen-editor-toolbar-button owen-editor-toolbar-more mod-more",
      attr: {
        type: "button",
        title,
        "aria-label": title,
        "aria-haspopup": "menu",
        "aria-expanded": "false",
        "data-tooltip": title
      }
    });
    setSafeIcon(button.createSpan(), "ellipsis");
    this.registerDomEvent(button, "click", () => {
      const menu = new Menu();
      menu.addItem((item) => item.setTitle(this.t("toolbar.selectionTools")).setIcon("text-select").onClick(() => this.openPalette("Selection")));
      menu.addItem((item) => item.setTitle(this.t("toolbar.graphiteTools")).setIcon("gem").onClick(() => this.openPalette("Owen graphite")));
      menu.addSeparator();
      menu.addItem((item) => item.setTitle(this.t("toolbar.allCommands")).setIcon("panel-top-open").onClick(() => this.openPalette()));
      this.showToolbarMenu(button, menu);
    });
  }

  private showToolbarMenu(button: HTMLButtonElement, menu: Menu) {
    const rect = button.getBoundingClientRect();
    button.setAttr("aria-expanded", "true");
    menu.onHide(() => button.setAttr("aria-expanded", "false"));
    menu.showAtPosition({ x: rect.left, y: rect.bottom + 4, width: rect.width }, activeDocument);
  }

  private buildCommands(): EditorCommand[] {
    const commands: EditorCommand[] = [
      {
        id: "undo-edit",
        name: "Undo edit",
        icon: "undo-2",
        category: "Basic markdown",
        run: (editor) => runEditorHistory(editor, "undo")
      },
      {
        id: "redo-edit",
        name: "Redo edit",
        icon: "redo-2",
        category: "Basic markdown",
        run: (editor) => runEditorHistory(editor, "redo")
      },
      {
        id: "clear-formatting-selection",
        name: "Clear common markdown formatting",
        icon: "eraser",
        category: "Basic markdown",
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
        name: "Insert markdown link",
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
        category: "Basic markdown",
        run: (editor) => adjustLineIndent(editor, "outdent")
      },
      {
        id: "indent-lines",
        name: "Indent line or selection",
        icon: "indent-increase",
        category: "Basic markdown",
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
        id: "heading-1",
        name: "Convert line to heading 1",
        icon: "heading-1",
        category: "Basic markdown",
        run: (editor) => setCurrentLinePrefix(editor, "# ")
      },
      {
        id: "heading-2",
        name: "Convert line to heading 2",
        icon: "heading-2",
        category: "Basic markdown",
        run: (editor) => setCurrentLinePrefix(editor, "## ")
      },
      {
        id: "heading-3",
        name: "Convert line to heading 3",
        icon: "heading-3",
        category: "Basic markdown",
        run: (editor) => setCurrentLinePrefix(editor, "### ")
      },
      {
        id: "heading-4",
        name: "Convert line to heading 4",
        icon: "heading-4",
        category: "Basic markdown",
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
        name: "Insert mermaid block",
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
        name: "Insert markdown table",
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
      {
        id: "convert-selection-to-markdown-table",
        name: "Convert selection to markdown table",
        icon: "table-2",
        category: "Tables",
        group: "Table conversion",
        aliases: ["convert", "변환", "csv", "tsv", "selection"],
        run: (editor) => convertSelectionToTable(this, editor, "markdown")
      },
      {
        id: "convert-selection-to-graphite-table",
        name: "Convert selection to owen graphite table",
        icon: "table-properties",
        category: "Tables",
        group: "Table conversion",
        aliases: ["convert", "변환", "graphite", "html", "csv", "tsv", "selection"],
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          convertSelectionToTable(this, editor, "wide");
        }
      },
      {
        id: "unwrap-selected-table",
        name: "Unwrap table",
        icon: "ungroup",
        category: "Tables",
        group: "Table conversion",
        aliases: ["remove table", "strip table", "unwrap", "표 해제", "테이블 제거", "외부테이블"],
        run: (editor) => unwrapSelectedTable(this, editor)
      },
      {
        id: "unwrap-markdown-selection",
        name: "Unwrap markdown",
        icon: "remove-formatting",
        category: "Selection",
        group: "Selection cleanup",
        aliases: ["remove markdown", "strip markdown", "plain text", "서식 제거", "마크다운 해제", "마크다운 제거"],
        run: (editor) => unwrapMarkdownSelection(this, editor)
      },
      ...CALLOUT_OPTIONS.map(createCalloutCommand),
      {
        id: "insert-graphite-wide-table",
        name: "Insert owen graphite wide comparison table",
        icon: "table-properties",
        category: "Tables",
        group: "Owen graphite table presets",
        run: (editor) => insertGraphiteBlock(this, editor, GRAPHITE_WIDE_TABLE, GRAPHITE_WIDE_MARKDOWN_TABLE)
      },
      {
        id: "insert-graphite-risk-table",
        name: "Insert owen graphite risk table",
        icon: "shield-alert",
        category: "Tables",
        group: "Owen graphite table presets",
        run: (editor) => insertGraphiteBlock(this, editor, GRAPHITE_RISK_TABLE, GRAPHITE_RISK_MARKDOWN_TABLE)
      },
      {
        id: "insert-graphite-numeric-table",
        name: "Insert owen graphite numeric table",
        icon: "chart-no-axes-column-increasing",
        category: "Tables",
        group: "Owen graphite table presets",
        run: (editor) => insertGraphiteBlock(this, editor, GRAPHITE_NUMERIC_TABLE, GRAPHITE_NUMERIC_MARKDOWN_TABLE)
      },
      {
        id: "insert-graphite-matrix-table",
        name: "Insert owen graphite risk matrix",
        icon: "grid-3x3",
        category: "Tables",
        group: "Owen graphite table presets",
        run: (editor) => insertGraphiteBlock(this, editor, GRAPHITE_MATRIX_TABLE, GRAPHITE_MATRIX_MARKDOWN_TABLE)
      },
      {
        id: "insert-graphite-reference-list",
        name: "Insert owen graphite reference list",
        icon: "library",
        category: "Owen graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, GRAPHITE_REFERENCE_LIST);
        }
      },
      {
        id: "open-graphite-report-starter",
        name: "Open owen graphite report starter",
        icon: "file-plus-2",
        category: "Owen graphite",
        group: "Document templates",
        aliases: ["wizard", "starter", "report", "보고서", "template", "템플릿"],
        run: (editor) => this.openReportStarter(editor)
      },
      {
        id: "insert-template-executive-summary",
        name: "Insert executive summary document template",
        icon: "file-text",
        category: "Owen graphite",
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
        category: "Owen graphite",
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
        category: "Owen graphite",
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
        name: "Insert owen graphite report frontmatter",
        icon: "file-sliders",
        category: "Owen graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, "---\ntitle: 보고서 제목\ndate: 2026-04-27\ntags:\n  - report\ncssclasses:\n  - ogd-report-mode\n  - ogd-page-a3-land\n  - ogd-modern-tables\n  - ogd-print-avoid-breaks\ncover: true\n---");
        }
      },
      {
        id: "wrap-graphite-kbd",
        name: "Wrap selection with owen graphite keyboard tag",
        icon: "keyboard",
        category: "Owen graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          wrapSelection(editor, "<kbd>", "</kbd>", "Cmd+K");
        }
      },
      {
        id: "wrap-graphite-blur",
        name: "Wrap selection with owen graphite blur",
        icon: "eye-off",
        category: "Owen graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          wrapSelection(editor, "<span class=\"ogd-blur\">", "</span>", "비공개 내용");
        }
      },
      {
        id: "insert-graphite-secret-callout",
        name: "Insert owen graphite secret callout",
        icon: "lock-keyhole",
        category: "Owen graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, "> [!secret] Restricted\n> hover 시 표시할 내용을 입력합니다.");
        }
      },
      {
        id: "insert-graphite-summary-callout",
        name: "Insert owen graphite executive summary",
        icon: "notebook-text",
        category: "Owen graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, "> [!summary] Executive summary\n> 핵심 판단과 근거를 간결하게 정리합니다.");
        }
      },
      {
        id: "insert-graphite-action-callout",
        name: "Insert owen graphite action summary",
        icon: "list-checks",
        category: "Owen graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, "> [!action] Action items\n> - 담당자: \n> - 기한: \n> - 다음 단계:");
        }
      },
      {
        id: "insert-graphite-status-badge",
        name: "Insert owen graphite status badge",
        icon: "badge-check",
        category: "Owen graphite",
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, "<span class=\"ogd-status-badge is-e5\">E5</span> <span class=\"ogd-status-badge is-payg\">PAYG</span> <span class=\"ogd-status-badge is-addon\">Add-on</span>");
        }
      },
      {
        id: "insert-graphite-source-note",
        name: "Insert owen graphite source note",
        icon: "text-quote",
        category: "Owen graphite",
        group: "A3/PDF snippets",
        aliases: ["source", "출처", "pdf", "a3", "print"],
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, GRAPHITE_SOURCE_NOTE);
        }
      },
      {
        id: "insert-graphite-metric-row",
        name: "Insert owen graphite metric row",
        icon: "gauge",
        category: "Owen graphite",
        group: "A3/PDF snippets",
        aliases: ["metric", "지표", "kpi", "pdf", "a3", "print"],
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, GRAPHITE_METRIC_ROW);
        }
      },
      {
        id: "insert-graphite-decision-matrix",
        name: "Insert owen graphite decision matrix",
        icon: "git-branch-plus",
        category: "Owen graphite",
        group: "A3/PDF snippets",
        aliases: ["decision", "의사결정", "matrix", "매트릭스", "pdf", "a3", "print"],
        run: (editor) => {
          this.ensureGraphiteThemeNotice();
          insertBlock(editor, GRAPHITE_DECISION_MATRIX);
        }
      }
    ];
    return commands.map((command) => ({
      ...command,
      aliases: [...(command.aliases ?? []), command.name, translateCommandName("ko", command.id, command.name)],
      name: translateCommandName(this.language, command.id, command.name)
    }));
  }

  ensureGraphiteThemeNotice() {
    if (!this.settings.showGraphiteThemeNotice || this.graphiteNoticeShown || this.isOwenGraphiteThemeActive()) {
      return;
    }

    this.graphiteNoticeShown = true;
    new Notice(this.t("notice.graphiteTheme"));
  }

  private isOwenGraphiteThemeActive() {
    const vaultWithConfig = this.app.vault as unknown as { getConfig?: (key: string) => unknown };
    const cssThemeConfig = vaultWithConfig.getConfig?.("cssTheme");
    const cssTheme = typeof cssThemeConfig === "string" ? cssThemeConfig.toLowerCase() : "";
    return cssTheme.includes("owen graphite") || cssTheme.includes("owen-graphite");
  }
}

class OwenEditorPaletteModal extends Modal {
  private plugin: OwenEditorPlugin;
  private activeCategory?: CommandCategoryFilter;
  private query = "";
  private selectedCommandId?: string;
  private renderAbortController?: AbortController;
  private tooltipSequence = 0;

  constructor(app: App, plugin: OwenEditorPlugin, initialCategory?: CommandCategoryFilter) {
    super(app);
    this.plugin = plugin;
    this.activeCategory = initialCategory;
  }

  onOpen() {
    this.modalEl.addClass("owen-editor-palette-modal");
    this.titleEl.setText(this.plugin.t("palette.title"));
    this.render();
  }

  onClose() {
    this.renderAbortController?.abort();
    this.renderAbortController = undefined;
  }

  private render() {
    this.renderAbortController?.abort();
    this.renderAbortController = new AbortController();
    this.contentEl.empty();
    this.contentEl.addClass("owen-editor-palette");
    this.tooltipSequence = 0;

    const layout = this.contentEl.createDiv({ cls: "owen-editor-palette-layout" });
    const searchPanel = layout.createDiv({ cls: "owen-editor-palette-search-panel" });
    const searchField = searchPanel.createDiv({ cls: "owen-editor-palette-search-field" });
    setSafeIcon(searchField.createSpan({ cls: "owen-editor-palette-search-icon" }), "search");
    const searchInput = searchField.createEl("input", {
      cls: "owen-editor-search",
      attr: {
        type: "search",
        placeholder: this.plugin.t("palette.searchPlaceholder"),
        "aria-label": this.plugin.t("palette.searchAria"),
        autocomplete: "off",
        spellcheck: "false"
      }
    });
    searchInput.value = this.query;

    const keyHints = searchField.createDiv({ cls: "owen-editor-palette-key-hints" });
    keyHints.setAttr("aria-hidden", "true");
    keyHints.createEl("kbd", { text: "↑↓" });
    keyHints.createEl("kbd", { text: "Enter" });

    const rail = layout.createEl("nav", {
      cls: "owen-editor-palette-rail",
      attr: { "aria-label": this.plugin.t("palette.categories") }
    });
    const railBrand = rail.createDiv({ cls: "owen-editor-palette-rail-brand" });
    setSafeIcon(railBrand.createSpan({ cls: "owen-editor-palette-rail-brand-icon" }), "pencil-line");
    railBrand.createSpan({ text: "Owen Editor", cls: "owen-editor-palette-rail-brand-label" });
    const railItems = rail.createDiv({ cls: "owen-editor-palette-rail-items" });

    for (const item of getPaletteCategoryRailItems(this.plugin)) {
      const isActive = categoryFiltersEqual(this.activeCategory, item.filter);
      const railButton = railItems.createEl("button", {
        cls: `owen-editor-palette-rail-button${isActive ? " is-active" : ""}`,
        attr: {
          type: "button",
          title: item.label,
          "aria-label": item.label,
          "aria-pressed": String(isActive)
        }
      });
      setSafeIcon(railButton.createSpan({ cls: "owen-editor-palette-rail-icon" }), item.icon);
      railButton.createSpan({ text: item.shortLabel, cls: "owen-editor-palette-rail-label" });
      this.registerRenderEvent(railButton, "click", () => {
        this.activeCategory = item.filter;
        this.selectedCommandId = undefined;
        this.render();
      });
    }

    const content = layout.createDiv({ cls: "owen-editor-palette-content" });
    content.setAttr("aria-label", this.plugin.t("palette.commands"));
    const contextEl = searchPanel.createDiv({
      cls: "owen-editor-palette-context"
    });

    const parsedQuery = parseCommandQuery(this.query);
    const commands = this.plugin.getCommands().filter((command) => commandMatchesQuery(command, parsedQuery, this.activeCategory));
    const navigableCommands: EditorCommand[] = [];
    const addNavigableCommands = (items: EditorCommand[]) => {
      for (const command of items) {
        if (!navigableCommands.some((candidate) => candidate.id === command.id)) {
          navigableCommands.push(command);
        }
      }
    };
    const recommendedCommands = this.plugin.getRecommendedCommands(parsedQuery, this.activeCategory)
      .filter((command) => commands.includes(command));
    const recentCommands = this.plugin.getRecentCommands()
      .filter((command) => categoryMatchesFilter(command.category, this.activeCategory))
      .filter((command) => commandMatchesQuery(command, parsedQuery, this.activeCategory));
    const recommendedCommandIds = new Set(recommendedCommands.slice(0, 4).map((command) => command.id));
    const recentCommandIds = new Set(recentCommands.slice(0, 6).map((command) => command.id));

    const contextLabel = this.activeCategory
      ? this.plugin.t("palette.contextTools", { category: getCategoryFilterLabel(this.plugin, this.activeCategory) })
      : this.plugin.t("palette.groupedBrowsing");
    contextEl.setText(this.plugin.t("palette.contextSummary", { count: commands.length, context: contextLabel }));

    for (const category of ["Basic markdown", "Selection", "Links", "Blocks", "Tables", "Owen graphite"] as CommandCategory[]) {
      if (!categoryMatchesFilter(category, this.activeCategory)) {
        continue;
      }

      const groupCommands = commands.filter((command) => command.category === category);
      if (groupCommands.length === 0) {
        continue;
      }

      const section = content.createDiv({ cls: `owen-editor-command-section mod-${category.toLowerCase().replace(/\s+/g, "-")}` });
      this.createSectionTitle(
        section,
        getCategoryLabel(this.plugin, category),
        groupCommands.length,
        getCategoryIcon(category),
        category === "Owen graphite" ? this.plugin.t("palette.graphiteThemeRequired") : undefined
      );
      const commandGroups = [...new Set(groupCommands.map((command) => command.group ?? category))];
      for (const commandGroup of commandGroups) {
        if (commandGroups.length > 1) {
          section.createEl("h4", { text: getCommandGroupLabel(this.plugin, commandGroup), cls: "owen-editor-subgroup-title" });
        }
        const shownGroupCommands = groupCommands.filter((candidate) => (candidate.group ?? category) === commandGroup);
        addNavigableCommands(shownGroupCommands);
        this.renderCommandGrid(section, shownGroupCommands, recommendedCommandIds, recentCommandIds);
      }
    }

    this.ensureSelectedCommand(navigableCommands);
    this.registerRenderEvent(searchInput, "input", () => {
      this.query = searchInput.value.toLowerCase();
      this.selectedCommandId = undefined;
      this.render();
    });
    this.registerRenderEvent(searchInput, "keydown", (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.moveSelectedCommand(navigableCommands, 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.moveSelectedCommand(navigableCommands, -1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        this.runSelectedCommand(navigableCommands);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    });
    this.updatePaletteSelection(false);
    window.requestAnimationFrame(() => {
      if (!searchInput.isConnected) {
        return;
      }
      searchInput.focus();
      const caret = searchInput.value.length;
      searchInput.setSelectionRange(caret, caret);
    });
  }

  private createSectionTitle(container: HTMLElement, label: string, count: number, icon: string, infoText?: string) {
    const title = container.createEl("h3", { cls: "owen-editor-group-title" });
    const titleLabel = title.createSpan({ cls: "owen-editor-group-title-label" });
    setSafeIcon(titleLabel.createSpan({ cls: "owen-editor-group-title-icon" }), icon);
    titleLabel.createSpan({ text: label });
    const titleActions = title.createSpan({ cls: "owen-editor-group-title-actions" });
    if (infoText) {
      const infoId = ++this.tooltipSequence;
      const labelId = `owen-editor-group-info-label-${infoId}`;
      const tooltipId = `owen-editor-group-info-${infoId}`;
      const infoControl = titleActions.createSpan({ cls: "owen-editor-group-title-info-control" });
      const infoButton = infoControl.createEl("button", {
        cls: "owen-editor-group-title-info-button",
        attr: {
          type: "button",
          "aria-labelledby": labelId,
          "aria-describedby": tooltipId
        }
      });
      setSafeIcon(infoButton, "info");
      infoButton.createSpan({
        text: infoText,
        cls: "owen-editor-visually-hidden",
        attr: { id: labelId }
      });
      infoControl.createSpan({
        text: infoText,
        cls: "owen-editor-command-status-tooltip owen-editor-group-title-info-tooltip",
        attr: { id: tooltipId, role: "tooltip" }
      });
    }
    titleActions.createSpan({
      text: String(count),
      cls: "owen-editor-group-count",
      attr: { "aria-label": this.plugin.t("palette.commandCount", { count }) }
    });
  }

  private registerRenderEvent<K extends keyof HTMLElementEventMap>(element: HTMLElement, type: K, listener: (event: HTMLElementEventMap[K]) => void) {
    element.addEventListener(type, listener, { signal: this.renderAbortController?.signal });
  }

  private ensureSelectedCommand(commands: EditorCommand[]) {
    if (commands.length === 0) {
      this.selectedCommandId = undefined;
      return;
    }

    if (!this.selectedCommandId || !commands.some((command) => command.id === this.selectedCommandId)) {
      this.selectedCommandId = commands[0].id;
    }
  }

  private moveSelectedCommand(commands: EditorCommand[], offset: number) {
    this.ensureSelectedCommand(commands);
    if (!this.selectedCommandId || commands.length === 0) {
      return;
    }

    const currentIndex = Math.max(0, commands.findIndex((command) => command.id === this.selectedCommandId));
    const nextIndex = (currentIndex + offset + commands.length) % commands.length;
    this.selectedCommandId = commands[nextIndex].id;
    this.updatePaletteSelection(true);
  }

  private runSelectedCommand(commands: EditorCommand[]) {
    this.ensureSelectedCommand(commands);
    const command = commands.find((candidate) => candidate.id === this.selectedCommandId);
    if (!command) {
      return;
    }

    this.plugin.runCommand(command);
    this.close();
  }

  private updatePaletteSelection(scrollIntoView: boolean) {
    const buttons = Array.from(this.contentEl.querySelectorAll<HTMLElement>(".owen-editor-command-button[data-command-id]"));
    let selectedButton: HTMLElement | undefined;
    for (const button of buttons) {
      const isSelected = !selectedButton && button.getAttribute("data-command-id") === this.selectedCommandId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", String(isSelected));
      if (isSelected) {
        selectedButton = button;
      }
    }

    if (scrollIntoView) {
      selectedButton?.scrollIntoView({ block: "nearest" });
    }
  }

  private renderCommandGrid(container: HTMLElement, commands: EditorCommand[], recommendedCommandIds: Set<string>, recentCommandIds: Set<string>) {
    const grid = container.createDiv({ cls: "owen-editor-command-grid" });
    for (const command of commands) {
      const itemClasses = ["owen-editor-command-item"];
      const isRecommended = recommendedCommandIds.has(command.id);
      const isRecent = recentCommandIds.has(command.id);
      if (command.group === "Owen graphite table presets") {
        itemClasses.push("is-graphite-table-preset");
      }
      const item = grid.createDiv({ cls: itemClasses.join(" ") });
      const button = item.createEl("button", {
        cls: "owen-editor-command-button",
        attr: {
          type: "button",
          "aria-selected": "false",
          "data-command-id": command.id
        }
      });
      const icon = button.createSpan({ cls: "owen-editor-command-icon" });
      setSafeIcon(icon, command.icon);
      const copy = button.createDiv({ cls: "owen-editor-command-copy" });
      copy.createSpan({ text: command.name, cls: "owen-editor-command-label" });
      const preview = getCommandPreview(this.plugin, command);
      const detail = getCommandPreviewDetail(this.plugin, command);
      this.registerRenderEvent(button, "click", () => {
        this.plugin.runCommand(command);
        this.close();
      });

      const actions = item.createDiv({ cls: "owen-editor-command-actions" });
      if (preview || detail) {
        const infoId = ++this.tooltipSequence;
        const labelId = `owen-editor-command-info-label-${infoId}`;
        const tooltipId = `owen-editor-command-info-${infoId}`;
        const infoControl = actions.createDiv({ cls: "owen-editor-command-info-control" });
        const infoButton = infoControl.createEl("button", {
          cls: "owen-editor-command-info-button",
          attr: {
            type: "button",
            "aria-labelledby": labelId,
            "aria-describedby": tooltipId
          }
        });
        setSafeIcon(infoButton, "info");
        infoButton.createSpan({
          text: this.plugin.t("palette.commandInfoAria", { command: command.name }),
          cls: "owen-editor-visually-hidden",
          attr: { id: labelId }
        });
        const tooltip = infoControl.createDiv({
          cls: "owen-editor-command-info-tooltip",
          attr: { id: tooltipId, role: "tooltip" }
        });
        if (preview) {
          tooltip.createSpan({ text: preview, cls: "owen-editor-command-info-summary" });
        }
        if (detail) {
          tooltip.createEl("code", { text: detail, cls: "owen-editor-command-info-detail" });
        }
      }

      if (isRecommended) {
        const statusId = ++this.tooltipSequence;
        const labelId = `owen-editor-command-recommended-label-${statusId}`;
        const tooltipId = `owen-editor-command-recommended-${statusId}`;
        const recommendedIndicator = actions.createSpan({
          cls: "owen-editor-command-status-indicator is-recommended",
          attr: {
            tabindex: "0",
            role: "img",
            "aria-labelledby": labelId,
            "aria-describedby": tooltipId
          }
        });
        setSafeIcon(recommendedIndicator.createSpan({ cls: "owen-editor-command-status-icon" }), "sparkles");
        recommendedIndicator.createSpan({
          text: this.plugin.t("palette.recommendedCommand"),
          cls: "owen-editor-visually-hidden",
          attr: { id: labelId }
        });
        recommendedIndicator.createSpan({
          text: this.plugin.t("palette.recommendedCommand"),
          cls: "owen-editor-command-status-tooltip",
          attr: { id: tooltipId, role: "tooltip" }
        });
      }

      if (isRecent) {
        const statusId = ++this.tooltipSequence;
        const labelId = `owen-editor-command-recent-label-${statusId}`;
        const tooltipId = `owen-editor-command-recent-${statusId}`;
        const recentIndicator = actions.createSpan({
          cls: "owen-editor-command-status-indicator is-recent",
          attr: {
            tabindex: "0",
            role: "img",
            "aria-labelledby": labelId,
            "aria-describedby": tooltipId
          }
        });
        setSafeIcon(recentIndicator.createSpan({ cls: "owen-editor-command-status-icon" }), "circle-chevron-right");
        recentIndicator.createSpan({
          text: this.plugin.t("palette.recentCommand"),
          cls: "owen-editor-visually-hidden",
          attr: { id: labelId }
        });
        recentIndicator.createSpan({
          text: this.plugin.t("palette.recentCommand"),
          cls: "owen-editor-command-status-tooltip",
          attr: { id: tooltipId, role: "tooltip" }
        });
      }

      const isFavorite = this.plugin.isFavoriteCommand(command.id);
      const favoriteId = ++this.tooltipSequence;
      const favoriteLabelId = `owen-editor-command-favorite-label-${favoriteId}`;
      const favoriteTooltipId = `owen-editor-command-favorite-${favoriteId}`;
      const favoriteLabel = isFavorite
        ? this.plugin.t("palette.removeFavoriteAria", { command: command.name })
        : this.plugin.t("palette.addFavoriteAria", { command: command.name });
      const favoriteTooltip = isFavorite ? this.plugin.t("palette.removeFavorite") : this.plugin.t("palette.addFavorite");
      const favoriteControl = actions.createDiv({ cls: "owen-editor-favorite-control" });
      const favoriteButton = favoriteControl.createEl("button", {
        cls: `owen-editor-favorite-button${isFavorite ? " is-active" : ""}`,
        attr: {
          type: "button",
          "aria-labelledby": favoriteLabelId,
          "aria-describedby": favoriteTooltipId
        }
      });
      setSafeIcon(favoriteButton, isFavorite ? "star" : "star-off");
      favoriteButton.createSpan({
        text: favoriteLabel,
        cls: "owen-editor-visually-hidden",
        attr: { id: favoriteLabelId }
      });
      favoriteControl.createSpan({
        text: favoriteTooltip,
        cls: "owen-editor-command-status-tooltip owen-editor-favorite-tooltip",
        attr: { id: favoriteTooltipId, role: "tooltip" }
      });
      this.registerRenderEvent(favoriteButton, "click", () => {
        favoriteButton.disabled = true;
        void this.plugin.toggleFavoriteCommand(command.id)
          .then(() => {
            if (this.modalEl.isConnected) {
              this.render();
            }
          })
          .catch((error) => {
            favoriteButton.disabled = false;
            new Notice(this.plugin.t("palette.favoriteFailed", { detail: error instanceof Error ? error.message : this.plugin.t("error.unknown") }));
          });
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

interface ParsedCommandQuery {
  text: string;
  category?: CommandCategory;
}

function parseCommandQuery(query: string): ParsedCommandQuery {
  const normalized = query.trim().toLowerCase();
  const match = normalized.match(/^(table|tables|표|graphite|ogd|owen|link|links|block|blocks|selection|select|basic|markdown|md):\s*(.*)$/);
  if (!match) {
    return { text: normalized };
  }

  const categoryMap: Record<string, CommandCategory> = {
    table: "Tables",
    tables: "Tables",
    "표": "Tables",
    graphite: "Owen graphite",
    ogd: "Owen graphite",
    owen: "Owen graphite",
    link: "Links",
    links: "Links",
    block: "Blocks",
    blocks: "Blocks",
    selection: "Selection",
    select: "Selection",
    basic: "Basic markdown",
    markdown: "Basic markdown",
    md: "Basic markdown"
  };
  return { category: categoryMap[match[1]], text: match[2] };
}

function getPaletteCategoryRailItems(plugin: OwenEditorPlugin): Array<{ label: string; shortLabel: string; icon: string; filter?: CommandCategoryFilter }> {
  return [
    { label: plugin.t("palette.category.all"), shortLabel: plugin.t("palette.category.allShort"), icon: "panel-top-open" },
    { label: plugin.t("palette.category.create"), shortLabel: plugin.t("palette.category.createShort"), icon: "wand-sparkles", filter: ["Selection", "Owen graphite"] },
    { label: plugin.t("palette.category.tables"), shortLabel: plugin.t("palette.category.tablesShort"), icon: "table-2", filter: "Tables" },
    { label: plugin.t("palette.category.links"), shortLabel: plugin.t("palette.category.linksShort"), icon: "link", filter: "Links" },
    { label: plugin.t("palette.category.blocks"), shortLabel: plugin.t("palette.category.blocksShort"), icon: "list-plus", filter: "Blocks" },
    { label: plugin.t("palette.category.markdown"), shortLabel: plugin.t("palette.category.markdownShort"), icon: "heading", filter: "Basic markdown" }
  ];
}

function getCategoryIcon(category: CommandCategory) {
  const icons: Record<CommandCategory, string> = {
    "Basic markdown": "heading",
    Selection: "text-select",
    Links: "link",
    Blocks: "list-plus",
    Tables: "table-2",
    "Owen graphite": "gem"
  };
  return icons[category];
}

function getCategoryFilterCategories(category?: CommandCategoryFilter) {
  return Array.isArray(category) ? category : category ? [category] : [];
}

function categoryFiltersEqual(left?: CommandCategoryFilter, right?: CommandCategoryFilter) {
  const leftCategories = getCategoryFilterCategories(left);
  const rightCategories = getCategoryFilterCategories(right);
  return leftCategories.length === rightCategories.length && leftCategories.every((category, index) => category === rightCategories[index]);
}

function categoryMatchesFilter(category: CommandCategory, filter?: CommandCategoryFilter) {
  const categories = getCategoryFilterCategories(filter);
  return categories.length === 0 || categories.includes(category);
}

function getCategoryFilterLabel(plugin: OwenEditorPlugin, category: CommandCategoryFilter) {
  return getCategoryFilterCategories(category).map((item) => getCategoryLabel(plugin, item)).join(" + ");
}

function getCategoryLabel(plugin: OwenEditorPlugin, category: CommandCategory) {
  const keys: Record<CommandCategory, TranslationKey> = {
    "Basic markdown": "category.basic",
    Selection: "category.selection",
    Links: "category.links",
    Blocks: "category.blocks",
    Tables: "category.tables",
    "Owen graphite": "category.graphite"
  };
  return plugin.t(keys[category]);
}

function getCommandGroupLabel(plugin: OwenEditorPlugin, group: string) {
  const keys: Record<string, TranslationKey> = {
    "Text styling": "group.textStyling",
    "Link inserts": "group.linkInserts",
    Embeds: "group.embeds",
    References: "group.references",
    "Document blocks": "group.documentBlocks",
    "Selection blocks": "group.selectionBlocks",
    "Comments and notices": "group.comments",
    "Basic tables": "group.basicTables",
    "Table conversion": "group.tableConversion",
    "Owen graphite table presets": "group.graphiteTables",
    "Document templates": "group.documentTemplates",
    "A3/PDF snippets": "group.a3Pdf"
  };
  return keys[group] ? plugin.t(keys[group]) : group;
}

function getCategoryFilterClass(category: CommandCategoryFilter) {
  return getCategoryFilterCategories(category).join("-").toLowerCase().replace(/\s+/g, "-");
}

function commandMatchesQuery(command: EditorCommand, query: ParsedCommandQuery, initialCategory?: CommandCategoryFilter) {
  if (!categoryMatchesFilter(command.category, initialCategory)) {
    return false;
  }
  if (query.category && command.category !== query.category) {
    return false;
  }
  if (!query.text) {
    return true;
  }

  const haystack = getCommandSearchText(command);
  return haystack.includes(query.text) || fuzzyIncludes(haystack, query.text);
}

function fuzzyIncludes(haystack: string, needle: string) {
  const compactHaystack = haystack.replace(/[^a-z0-9가-힣]/gi, "");
  const compactNeedle = needle.replace(/[^a-z0-9가-힣]/gi, "");
  if (!compactNeedle) {
    return true;
  }

  let cursor = 0;
  for (const char of compactNeedle) {
    cursor = compactHaystack.indexOf(char, cursor);
    if (cursor === -1) {
      return false;
    }
    cursor += 1;
  }
  return true;
}

function getCommandSearchAliases(command: EditorCommand) {
  const aliases = [...(command.aliases ?? [])];
  const categoryAliases: Record<CommandCategory, string[]> = {
    "Basic markdown": ["markdown", "md", "마크다운", "기본", "서식", "format"],
    Selection: ["selection", "select", "선택", "감싸기", "wrap", "quote", "인용", "comment", "주석"],
    Links: ["link", "links", "링크", "위키", "wiki", "embed", "임베드", "attachment", "첨부", "image", "이미지", "footnote", "각주"],
    Blocks: ["block", "blocks", "블록", "문서", "frontmatter", "프론트매터", "mermaid", "머메이드", "align", "정렬", "callout", "콜아웃"],
    Tables: ["table", "tables", "표", "테이블", "matrix", "매트릭스", "risk", "리스크", "numeric", "숫자", "wide", "넓은표"],
    "Owen graphite": ["owen", "graphite", "그래파이트", "오웬", "theme", "테마", "report", "보고서", "badge", "배지", "blur", "숨김", "secret", "비밀"]
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

function getCommandPreview(plugin: OwenEditorPlugin, command: EditorCommand) {
  if (command.id === "unwrap-markdown-selection") {
    return plugin.t("preview.keepLinks");
  }
  if (command.id === "wrap-graphite-kbd") {
    return "kbd · Cmd+K";
  }
  if (command.id === "wrap-graphite-blur") {
    return plugin.t("preview.blur");
  }
  if (command.id.includes("graphite") && command.id.includes("table")) {
    return plugin.t("preview.graphiteTable");
  }
  if (command.id.includes("callout")) {
    return command.category === "Owen graphite" ? plugin.t("preview.graphiteCallout") : plugin.t("preview.obsidianCallout");
  }
  if (command.id.includes("template")) {
    return plugin.t("preview.documentTemplate");
  }
  if (command.id.includes("highlight") || command.id.includes("mark")) {
    return "==highlight==";
  }
  return "";
}

function getCommandPreviewDetail(plugin: OwenEditorPlugin, command: EditorCommand) {
  if (command.id === "open-graphite-report-starter") {
    return plugin.t("preview.reportStarterDetail");
  }
  if (command.id === "unwrap-selected-table") {
    return plugin.t("preview.unwrapTableDetail");
  }
  if (command.id === "unwrap-markdown-selection") {
    return plugin.t("preview.unwrapMarkdownDetail");
  }
  if (command.id === "convert-selection-to-graphite-table") {
    return plugin.t("preview.toGraphiteDetail");
  }
  if (command.id === "convert-selection-to-markdown-table") {
    return plugin.t("preview.toMarkdownDetail");
  }
  if (command.id === "insert-graphite-summary-callout") {
    return "> [!summary] Executive summary";
  }
  if (command.id === "insert-graphite-action-callout") {
    return "> [!action] Action items";
  }
  if (command.id === "insert-graphite-status-badge") {
    return "<span class=\"ogd-status-badge\">E5</span>";
  }
  if (command.id === "insert-graphite-reference-list") {
    return "<ol class=\"ogd-reference-list\">";
  }
  if (command.id === "insert-graphite-source-note") {
    return "<p class=\"table-source\">Source...</p>";
  }
  if (command.id === "insert-graphite-metric-row") {
    return "<div class=\"ogd-metric-row\">";
  }
  if (command.id === "insert-graphite-decision-matrix") {
    return "<table class=\"matrix-table compact-table\">";
  }
  if (command.id === "insert-graphite-wide-table") {
    return "<table class=\"wide-table print-fit-table\">";
  }
  if (command.id === "insert-graphite-risk-table") {
    return "<table class=\"risk-table compact-table\">";
  }
  if (command.id.includes("template")) {
    return "---\ncssclasses:\n  - ogd-report-mode\n---";
  }
  return "";
}

class OwenEditorReportStarterModal extends Modal {
  private plugin: OwenEditorPlugin;
  private editor: Editor;
  private kind: ReportStarterKind = "executive";
  private title: string;
  private includeMetrics = true;
  private includeSourceNote = true;

  constructor(app: App, plugin: OwenEditorPlugin, editor: Editor) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
    this.title = plugin.t("report.defaultTitle");
  }

  onOpen() {
    this.titleEl.setText(this.plugin.t("report.title"));
    this.render();
  }

  private render() {
    this.contentEl.empty();
    this.contentEl.addClass("owen-editor-report-starter");

    let previewCode: HTMLElement;
    const refreshPreview = () => previewCode.setText(buildReportStarterDocument(this.kind, this.title, this.includeMetrics, this.includeSourceNote));

    new Setting(this.contentEl)
      .setName(this.plugin.t("report.type"))
      .addDropdown((dropdown) => dropdown
        .addOption("executive", this.plugin.t("report.executive"))
        .addOption("comparison", this.plugin.t("report.comparison"))
        .addOption("risk", this.plugin.t("report.risk"))
        .addOption("meeting", this.plugin.t("report.meeting"))
        .setValue(this.kind)
        .onChange((value) => {
          this.kind = value as ReportStarterKind;
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName(this.plugin.t("report.documentTitle"))
      .addText((text) => text
        .setValue(this.title)
        .onChange((value) => {
          this.title = value.trim() || this.plugin.t("report.defaultTitle");
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName(this.plugin.t("report.includeMetrics"))
      .addToggle((toggle) => toggle
        .setValue(this.includeMetrics)
        .onChange((value) => {
          this.includeMetrics = value;
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName(this.plugin.t("report.includeSource"))
      .addToggle((toggle) => toggle
        .setValue(this.includeSourceNote)
        .onChange((value) => {
          this.includeSourceNote = value;
          refreshPreview();
        }));

    this.contentEl.createEl("h3", { text: this.plugin.t("report.preview"), cls: "owen-editor-table-builder-preview-title" });
    const preview = this.contentEl.createEl("pre", { cls: "owen-editor-table-builder-preview" });
    previewCode = preview.createEl("code");
    refreshPreview();

    const actions = this.contentEl.createDiv({ cls: "owen-editor-table-builder-actions" });
    const insertButton = actions.createEl("button", { text: this.plugin.t("report.insert"), cls: "mod-cta", attr: { type: "button" } });
    insertButton.addEventListener("click", () => {
      this.plugin.ensureGraphiteThemeNotice();
      insertBlock(this.editor, buildReportStarterDocument(this.kind, this.title, this.includeMetrics, this.includeSourceNote));
      this.close();
    });
  }
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
    this.titleEl.setText(this.plugin.t("table.title"));
    this.render();
  }

  private render() {
    this.contentEl.empty();
    this.contentEl.addClass("owen-editor-table-builder");

    let previewCode: HTMLElement;
    let sourceInsight: HTMLElement;
    const refreshPreview = () => {
      previewCode.setText(buildTableFromOptions(this.options));
      sourceInsight.setText(getDelimitedTableInsight(this.plugin, this.options.sourceText, this.options.includeHeader));
    };

    new Setting(this.contentEl)
      .setName(this.plugin.t("table.rows"))
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "20";
        text.inputEl.step = "1";
        return text
          .setValue(String(this.options.rows))
          .onChange((value) => {
            this.options.rows = clampInteger(value, 1, 20, 3);
            refreshPreview();
          });
      });

    new Setting(this.contentEl)
      .setName(this.plugin.t("table.columns"))
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "12";
        text.inputEl.step = "1";
        return text
          .setValue(String(this.options.columns))
          .onChange((value) => {
            this.options.columns = clampInteger(value, 1, 12, 3);
            refreshPreview();
          });
      });

    new Setting(this.contentEl)
      .setName(this.plugin.t("table.header"))
      .addToggle((toggle) => toggle
        .setValue(this.options.includeHeader)
        .onChange((value) => {
          this.options.includeHeader = value;
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName(this.plugin.t("table.preset"))
      .addDropdown((dropdown) => dropdown
        .addOption("markdown", this.plugin.t("table.presetMarkdown"))
        .addOption("wide", this.plugin.t("table.presetWide"))
        .addOption("risk", this.plugin.t("table.presetRisk"))
        .addOption("numeric", this.plugin.t("table.presetNumeric"))
        .setValue(this.options.preset)
        .onChange((value) => {
          this.options.preset = value as TableBuilderPreset;
          this.options.useHtml = this.options.preset !== "markdown" || this.options.useHtml;
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName(this.plugin.t("table.useHtml"))
      .setDesc(this.plugin.t("table.useHtmlDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.options.useHtml)
        .onChange((value) => {
          this.options.useHtml = value;
          refreshPreview();
        }));

    new Setting(this.contentEl)
      .setName(this.plugin.t("table.source"))
      .setDesc(this.plugin.t("table.sourceDesc"))
      .addTextArea((text) => text
        .setPlaceholder(this.plugin.t("table.sourcePlaceholder"))
        .setValue(this.options.sourceText)
        .onChange((value) => {
          this.options.sourceText = value;
          const sourceRows = parseDelimitedTable(value);
          if (sourceRows.length > 0) {
            this.options.includeHeader = inferHeaderRow(sourceRows);
            this.options.rows = Math.max(1, sourceRows.length - (this.options.includeHeader ? 1 : 0));
            this.options.columns = Math.max(...sourceRows.map((row) => row.length));
          }
          refreshPreview();
        }))
      .addButton((button) => button
        .setButtonText(this.plugin.t("table.clearSource"))
        .onClick(() => {
          this.options.sourceText = "";
          this.render();
        }));

    sourceInsight = this.contentEl.createDiv({ cls: "owen-editor-table-builder-insight" });

    this.contentEl.createEl("h3", { text: this.plugin.t("table.preview"), cls: "owen-editor-table-builder-preview-title" });
    const preview = this.contentEl.createEl("pre", { cls: "owen-editor-table-builder-preview" });
    previewCode = preview.createEl("code");
    refreshPreview();

    const actions = this.contentEl.createDiv({ cls: "owen-editor-table-builder-actions" });
    const insertButton = actions.createEl("button", { text: this.plugin.t("table.insert"), cls: "mod-cta", attr: { type: "button" } });
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
  private plugin: OwenEditorPlugin;
  private editor: Editor;

  constructor(app: App, plugin: OwenEditorPlugin, editor: Editor) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
  }

  onOpen() {
    this.titleEl.setText(this.plugin.t("highlight.title"));
    this.contentEl.empty();
    this.contentEl.addClass("owen-editor-highlight-palette");

    this.contentEl.createEl("p", {
      text: this.plugin.t("highlight.recommended"),
      cls: "owen-editor-highlight-label"
    });

    const grid = this.contentEl.createDiv({ cls: "owen-editor-highlight-grid" });
    for (const [index, option] of HIGHLIGHT_COLOR_OPTIONS.entries()) {
      const button = grid.createEl("button", {
        cls: "owen-editor-highlight-option",
        attr: { type: "button" }
      });
      button.createSpan({
        cls: "owen-editor-highlight-swatch",
        attr: { style: `background: ${option.background}; color: ${option.foreground};` }
      }).setText("Aa");
      const text = button.createDiv({ cls: "owen-editor-highlight-copy" });
      const nameKeys: TranslationKey[] = ["highlight.defaultName", "highlight.yellowName", "highlight.mintDesc", "highlight.skyDesc", "highlight.roseDesc", "highlight.lavenderDesc", "highlight.graphiteDesc"];
      const descriptionKeys: TranslationKey[] = ["highlight.defaultDesc", "highlight.yellowDesc", "highlight.mintDesc", "highlight.skyDesc", "highlight.roseDesc", "highlight.lavenderDesc", "highlight.graphiteDesc"];
      text.createSpan({ text: index < 2 ? this.plugin.t(nameKeys[index]) : option.name, cls: "owen-editor-highlight-name" });
      text.createSpan({ text: this.plugin.t(descriptionKeys[index]), cls: "owen-editor-highlight-description" });
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
    const t = (key: TranslationKey, variables?: Record<string, string | number>) => this.plugin.t(key, variables);
    containerEl.empty();
    containerEl.addClass("owen-editor-settings-tab");
    this.createSettingsSection(t("settings.section.interface"), t("settings.section.interfaceDesc"), "interface", "languages");

    new Setting(containerEl)
      .setName(t("settings.language.name"))
      .setDesc(t("settings.language.desc"))
      .addDropdown((dropdown) => dropdown
        .addOption("auto", t("language.auto"))
        .addOption("en", t("language.en"))
        .addOption("ko", t("language.ko"))
        .setValue(this.plugin.settings.language)
        .onChange(async (value) => this.plugin.setLanguage(value as LanguagePreference)));

    this.createSettingsSection(t("settings.section.toolbar"), t("settings.section.toolbarDesc"), "toolbar", "panel-top");

    new Setting(containerEl)
      .setName(t("settings.showToolbar"))
      .setDesc(t("settings.showToolbarDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showFloatingToolbar)
        .onChange(async (value) => {
          this.plugin.settings.showFloatingToolbar = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t("settings.position"))
      .setDesc(t("settings.positionDesc"))
      .addDropdown((dropdown) => dropdown
        .addOption("top", t("settings.top"))
        .addOption("bottom", t("settings.bottom"))
        .setValue(this.plugin.settings.toolbarPosition)
        .onChange(async (value) => {
          this.plugin.settings.toolbarPosition = value as ToolbarPosition;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t("settings.preset"))
      .setDesc(t("settings.presetDesc"))
      .addDropdown((dropdown) => dropdown
        .addOption("minimal", t("settings.minimal"))
        .addOption("writer", t("settings.writer"))
        .addOption("report", t("settings.report"))
        .addOption("full", t("settings.full"))
        .addOption("custom", t("settings.custom"))
        .setValue(this.plugin.settings.toolbarPreset)
        .onChange(async (value) => {
          await this.plugin.applyToolbarPreset(value as ToolbarPreset);
          this.display();
        }));

    new Setting(containerEl)
      .setName(t("settings.density"))
      .setDesc(t("settings.densityDesc"))
      .addDropdown((dropdown) => dropdown
        .addOption("compact", t("settings.compact"))
        .addOption("balanced", t("settings.balanced"))
        .addOption("comfortable", t("settings.comfortable"))
        .addOption("custom", t("settings.custom"))
        .setValue(this.plugin.settings.toolbarDensity)
        .onChange(async (value) => {
          await this.plugin.applyToolbarDensity(value as ToolbarDensity);
          this.display();
        }));

    new Setting(containerEl)
      .setName(t("settings.collapsed"))
      .setDesc(t("settings.collapsedDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.toolbarCollapsed)
        .onChange(async (value) => {
          this.plugin.settings.toolbarCollapsed = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t("settings.scale"))
      .setDesc(t("settings.scaleDesc"))
      .addSlider((slider) => slider
        .setLimits(80, 110, 5)
        .setValue(this.plugin.settings.toolbarScale)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.toolbarScale = value;
          this.plugin.settings.toolbarDensity = "custom";
          await this.plugin.saveSettings();
          this.display();
        }));

    new Setting(containerEl)
      .setName(t("settings.favoriteDisplay"))
      .setDesc(t("settings.favoriteDisplayDesc"))
      .addDropdown((dropdown) => dropdown
        .addOption("always", t("settings.always"))
        .addOption("hover", t("settings.onHover"))
        .addOption("hidden", t("settings.hidden"))
        .setValue(this.plugin.settings.favoriteDisplay)
        .onChange(async (value) => {
          this.plugin.settings.favoriteDisplay = value as FavoriteDisplayMode;
          this.plugin.settings.toolbarDensity = "custom";
          await this.plugin.saveSettings();
          this.display();
        }));

    new Setting(containerEl)
      .setName(t("settings.mobileCompact"))
      .setDesc(t("settings.mobileCompactDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.mobileCompactToolbar)
        .onChange(async (value) => {
          this.plugin.settings.mobileCompactToolbar = value;
          this.plugin.settings.toolbarDensity = "custom";
          await this.plugin.saveSettings();
          this.display();
        }));

    new Setting(containerEl)
      .setName(t("settings.contextAware"))
      .setDesc(t("settings.contextAwareDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.contextAwareToolbar)
        .onChange(async (value) => {
          this.plugin.settings.contextAwareToolbar = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t("settings.feedback"))
      .setDesc(t("settings.feedbackDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.commandFeedback)
        .onChange(async (value) => {
          this.plugin.settings.commandFeedback = value;
          await this.plugin.saveSettings();
        }));

    this.createSettingsSection(t("settings.section.selection"), t("settings.section.selectionDesc"), "selection", "mouse-pointer-2");

    new Setting(containerEl)
      .setName(t("settings.showSelection"))
      .setDesc(t("settings.showSelectionDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showSelectionToolbar)
        .onChange(async (value) => {
          this.plugin.settings.showSelectionToolbar = value;
          await this.plugin.saveSettings();
        }));

    this.createSettingsSection(t("settings.section.shortcuts"), t("settings.section.shortcutsDesc"), "shortcuts", "keyboard");

    new Setting(containerEl)
      .setName(t("settings.showStatus"))
      .setDesc(t("settings.showStatusDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showStatusBarButton)
        .onChange(async (value) => {
          this.plugin.settings.showStatusBarButton = value;
          await this.plugin.saveSettings();
        }));

    this.createSettingsSection(t("settings.section.graphite"), t("settings.section.graphiteDesc"), "graphite", "sparkles");

    new Setting(containerEl)
      .setName(t("settings.htmlTables"))
      .setDesc(t("settings.htmlTablesDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.insertHtmlTables)
        .onChange(async (value) => {
          this.plugin.settings.insertHtmlTables = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t("settings.themeWarning"))
      .setDesc(t("settings.themeWarningDesc"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showGraphiteThemeNotice)
        .onChange(async (value) => {
          this.plugin.settings.showGraphiteThemeNotice = value;
          await this.plugin.saveSettings();
        }));

    this.createSettingsSection(t("settings.section.favorites"), t("settings.section.favoritesDesc"), "favorites", "star");

    new Setting(containerEl)
      .setName(t("settings.favoritePresets"))
      .setDesc(t("settings.favoritePresetsDesc"))
      .addButton((button) => button
        .setButtonText(t("settings.writer"))
        .onClick(async () => {
          await this.plugin.applyFavoritePreset("writer");
          this.display();
        }))
      .addButton((button) => button
        .setButtonText(t("settings.research"))
        .onClick(async () => {
          await this.plugin.applyFavoritePreset("research");
          this.display();
        }))
      .addButton((button) => button
        .setButtonText(t("settings.report"))
        .onClick(async () => {
          await this.plugin.applyFavoritePreset("report");
          this.display();
        }))
      .addButton((button) => button
        .setButtonText(t("settings.tableHeavy"))
        .onClick(async () => {
          await this.plugin.applyFavoritePreset("table-heavy");
          this.display();
        }));

    const availableFavoriteCommands = this.plugin.getCommands().filter((command) => !this.plugin.isFavoriteCommand(command.id));
    if (availableFavoriteCommands.length > 0) {
      let selectedFavoriteCommandId = availableFavoriteCommands[0].id;
      new Setting(containerEl)
        .setName(t("settings.addFavorite"))
        .setDesc(t("settings.addFavoriteDesc"))
        .addDropdown((dropdown) => {
          for (const command of availableFavoriteCommands) {
            dropdown.addOption(command.id, command.name);
          }
          dropdown.setValue(selectedFavoriteCommandId);
          dropdown.onChange((value) => {
            selectedFavoriteCommandId = value;
          });
        })
        .addButton((button) => button
          .setButtonText(t("settings.add"))
          .onClick(async () => {
            await this.plugin.addFavoriteCommand(selectedFavoriteCommandId);
            this.display();
          }));
    } else {
      new Setting(containerEl)
        .setName(t("settings.addFavorite"))
        .setDesc(t("settings.allFavorites"));
    }

    const favoriteCommands = this.plugin.settings.favoriteCommandIds.map((id) => ({
      id,
      command: this.plugin.getCommands().find((candidate) => candidate.id === id)
    }));
    const invalidFavoriteIds = favoriteCommands.filter((favorite) => !favorite.command).map((favorite) => favorite.id);
    if (invalidFavoriteIds.length > 0) {
      containerEl.createDiv({
        cls: "owen-editor-favorite-settings-warning",
        text: t("settings.unknownIds", { ids: invalidFavoriteIds.join(", ") })
      });
    }

    if (favoriteCommands.length > 0) {
      new Setting(containerEl)
        .setName(t("settings.favoriteOrder"))
        .setHeading();
      const favoriteList = containerEl.createDiv({ cls: "owen-editor-favorite-settings-list" });
      for (const [index, favorite] of favoriteCommands.entries()) {
        const label = favorite.command?.name ?? favorite.id;
        const row = favoriteList.createDiv({ cls: `owen-editor-favorite-settings-row${favorite.command ? "" : " is-invalid"}` });
        row.createSpan({ text: label, cls: "owen-editor-favorite-settings-label" });

        const createActionButton = (labelText: string, icon: string, disabled: boolean, action: () => void) => {
          const actionButton = row.createEl("button", {
            cls: "owen-editor-favorite-action-button",
            attr: {
              type: "button",
              title: labelText,
              "aria-label": labelText
            }
          });
          actionButton.disabled = disabled;
          setSafeIcon(actionButton.createSpan(), icon);
          if (!disabled) {
            actionButton.addEventListener("click", action);
          }
        };

        createActionButton(t("settings.moveUp"), "arrow-up", index === 0, () => {
          void this.plugin.moveFavoriteCommand(favorite.id, "up").then(() => this.display());
        });
        createActionButton(t("settings.moveDown"), "arrow-down", index === favoriteCommands.length - 1, () => {
          void this.plugin.moveFavoriteCommand(favorite.id, "down").then(() => this.display());
        });
        createActionButton(t("settings.remove"), "x", false, () => {
          void this.plugin.removeFavoriteCommand(favorite.id).then(() => this.display());
        });
      }
    }

    this.createSettingsSection(t("settings.section.portability"), t("settings.section.portabilityDesc"), "portability", "folder-sync");

    let settingsJson = JSON.stringify(getPortableSettings(this.plugin.settings), null, 2);
    new Setting(containerEl)
      .setName(t("settings.json"))
      .setDesc(t("settings.jsonDesc"))
      .addTextArea((text) => text
        .setValue(settingsJson)
        .onChange((value) => {
          settingsJson = value;
        }));

    new Setting(containerEl)
      .setName(t("settings.importRefresh"))
      .addButton((button) => button
        .setButtonText(t("settings.import"))
        .onClick(async () => {
          try {
            await this.plugin.replaceSettings(parsePortableSettings(settingsJson));
            new Notice(t("notice.settingsImported"));
            this.display();
          } catch (error) {
            new Notice(t("notice.importFailed", { detail: error instanceof Error ? error.message : t("error.invalidJson") }));
          }
        }))
      .addButton((button) => button
        .setButtonText(t("settings.refresh"))
        .onClick(() => this.display()));
  }

  private createSettingsSection(title: string, description: string, section: string, icon: string) {
    const heading = new Setting(this.containerEl)
      .setName(title)
      .setDesc(description)
      .setHeading();
    heading.settingEl.dataset.owenSection = section;
    const glyph = heading.settingEl.createDiv({ cls: "owen-editor-settings-section-glyph" });
    glyph.setAttr("aria-hidden", "true");
    setSafeIcon(glyph, icon);
    heading.settingEl.insertBefore(glyph, heading.infoEl);
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

function unwrapMarkdownSelection(plugin: OwenEditorPlugin, editor: Editor) {
  const selection = editor.getSelection();
  if (!selection.trim()) {
    new Notice(plugin.t("notice.selectFormatting"));
    return;
  }

  editor.replaceSelection(stripMarkdownFormattingPreservingLinks(selection));
}

function stripMarkdownFormattingPreservingLinks(sourceText: string) {
  const preserved: string[] = [];
  const protectedText = sourceText.replace(/!\[[^\]\n]*\]\([^\n)]+\)|\[[^\]\n]+\]\([^\n)]+\)|!?\[\[[^\]\n]+\]\]|<https?:\/\/[^>\s]+>|https?:\/\/[^\s<>)]+/gi, (match) => {
    const placeholder = `OWENLINKTOKEN${preserved.length}TOKEN`;
    preserved.push(cleanPreservedLinkText(match));
    return placeholder;
  });

  const cleaned = protectedText
    .replace(/^\s*(```+|~~~+).*$/gm, "")
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\s+#{1,6}\s*$/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-+*]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s*[-+*]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*\[![^\]]+\]\s*/gm, "")
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "")
    .replace(/^\s*\|(.+)\|\s*$/gm, (_match: string, cells: string) => splitMarkdownTableLine(cells).join("\n"))
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/(^|[^A-Za-z0-9_])==(?=\S)([\s\S]*?\S)==(?=$|[^A-Za-z0-9_])/g, "$1$2")
    .replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, "$1")
    .replace(/<([A-Za-z][\w:-]*)\b[^>]*(?:style=["'][^"']*background(?:-color)?\s*:[^"']*["']|class=["'][^"']*(?:highlight|hltr|mark)[^"']*["'])[^>]*>([\s\S]*?)<\/\1>/gi, "$2")
    .replace(/<span\b[^>]*class="ogd-blur"[^>]*>([\s\S]*?)<\/span>/gi, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:u|strong|em|b|i)>/gi, "")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/\[\^\w[\w-]*\]/g, "")
    .replace(/^\s*\[\^\w[\w-]*\]:\s*/gm, "");

  return preserved.reduce((text, value, index) => text.split(`OWENLINKTOKEN${index}TOKEN`).join(value), cleaned);
}

function cleanPreservedLinkText(linkText: string) {
  if (linkText.startsWith("![")) {
    return linkText;
  }

  const markdownLink = linkText.match(/^\[([^\]\n]+)\]\(([\s\S]+)\)$/);
  if (markdownLink) {
    return `[${stripMarkdownInlineFormatting(markdownLink[1])}](${markdownLink[2]})`;
  }

  const wikiLink = linkText.match(/^(!?)\[\[([^\]\n]+)\]\]$/);
  if (wikiLink && !wikiLink[1]) {
    const separator = wikiLink[2].includes("|") ? "|" : "";
    if (separator) {
      const [target, alias] = wikiLink[2].split("|");
      return `[[${target}|${stripMarkdownInlineFormatting(alias)}]]`;
    }
  }

  return linkText;
}

function stripMarkdownInlineFormatting(sourceText: string) {
  return sourceText
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/(^|[^A-Za-z0-9_])==(?=\S)([\s\S]*?\S)==(?=$|[^A-Za-z0-9_])/g, "$1$2")
    .replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, "$1")
    .replace(/<([A-Za-z][\w:-]*)\b[^>]*(?:style=["'][^"']*background(?:-color)?\s*:[^"']*["']|class=["'][^"']*(?:highlight|hltr|mark)[^"']*["'])[^>]*>([\s\S]*?)<\/\1>/gi, "$2")
    .replace(/<span\b[^>]*class="ogd-blur"[^>]*>([\s\S]*?)<\/span>/gi, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(?:u|strong|em|b|i)>/gi, "")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1");
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

function buildReportStarterDocument(kind: ReportStarterKind, title: string, includeMetrics: boolean, includeSourceNote: boolean) {
  const option = REPORT_STARTER_OPTIONS[kind];
  const template = DOCUMENT_TEMPLATES[option.template].replace(/^title: .+$/m, `title: ${title}`).replace(/^# .+$/m, `# ${title}`);
  const additions = [
    includeMetrics ? `\n## Metrics\n\n${GRAPHITE_METRIC_ROW}` : "",
    includeSourceNote ? `\n## Sources\n\n${GRAPHITE_SOURCE_NOTE}` : ""
  ].filter(Boolean);

  return [template.trimEnd(), ...additions].join("\n\n");
}

function convertSelectionToTable(plugin: OwenEditorPlugin, editor: Editor, preset: TableBuilderPreset) {
  const selection = editor.getSelection();
  if (!selection.trim()) {
    new Notice(plugin.t("notice.selectTable"));
    return;
  }

  const rows = parseTableSelection(selection);
  if (rows.length === 0) {
    new Notice(plugin.t("notice.noTableData"));
    return;
  }

  const includeHeader = inferHeaderRow(rows) || isMarkdownTable(selection);
  const options: TableBuilderOptions = {
    rows: Math.max(1, rows.length - (includeHeader ? 1 : 0)),
    columns: Math.max(...rows.map((row) => row.length)),
    includeHeader,
    preset,
    useHtml: preset !== "markdown",
    sourceText: ""
  };

  editor.replaceSelection(preset === "markdown" ? buildMarkdownTableFromRows(rows, includeHeader) : buildHtmlTableFromRows(options, rows));
}

function unwrapSelectedTable(plugin: OwenEditorPlugin, editor: Editor) {
  const selection = editor.getSelection();
  if (selection.trim() && containsTableStructure(selection)) {
    editor.replaceSelection(unwrapTableMarkup(selection));
    return;
  }

  const tableRange = findEnclosingTableRange(editor);
  if (!tableRange) {
    new Notice(plugin.t("notice.noTableStructure"));
    return;
  }

  editor.replaceRange(
    unwrapTableMarkup(getEditorRangeText(editor, tableRange.startLine, tableRange.endLine)),
    { line: tableRange.startLine, ch: 0 },
    getEditorRangeEndPosition(editor, tableRange.endLine)
  );
}

function containsTableStructure(sourceText: string) {
  return /<\/?(?:table|thead|tbody|tfoot|tr|td|th|caption|colgroup|col)\b/i.test(sourceText) || isMarkdownTable(sourceText);
}

function unwrapTableMarkup(sourceText: string) {
  if (/<\/?(?:table|thead|tbody|tfoot|tr|td|th|caption|colgroup|col)\b/i.test(sourceText)) {
    return normalizeUnwrappedTableText(sourceText
      .replace(/<colgroup\b[^>]*>[\s\S]*?<\/colgroup>/gi, "\n")
      .replace(/<col\b[^>]*\/?\s*>/gi, "\n")
      .replace(/<\/?(?:table|thead|tbody|tfoot)\b[^>]*>/gi, "\n")
      .replace(/<\/?tr\b[^>]*>/gi, "\n")
      .replace(/<\/?(?:td|th|caption)\b[^>]*>/gi, "\n"));
  }

  return unwrapMarkdownTable(sourceText);
}

function findEnclosingTableRange(editor: Editor) {
  const cursor = editor.getCursor("from");
  return findHtmlTableRange(editor, cursor.line) ?? findMarkdownTableRange(editor, cursor.line);
}

function findHtmlTableRange(editor: Editor, lineNumber: number) {
  let startLine = -1;
  for (let line = lineNumber; line >= 0; line -= 1) {
    const text = editor.getLine(line);
    if (/<\/table\s*>/i.test(text) && line < lineNumber) {
      break;
    }
    if (/<table\b/i.test(text)) {
      startLine = line;
      break;
    }
  }

  if (startLine === -1) {
    return null;
  }

  for (let line = Math.max(startLine, lineNumber); line < editor.lineCount(); line += 1) {
    if (/<\/table\s*>/i.test(editor.getLine(line))) {
      return { startLine, endLine: line + 1 };
    }
  }

  return null;
}

function findMarkdownTableRange(editor: Editor, lineNumber: number) {
  if (!/^\s*\|.*\|\s*$/.test(editor.getLine(lineNumber))) {
    return null;
  }

  let startLine = lineNumber;
  while (startLine > 0 && /^\s*\|.*\|\s*$/.test(editor.getLine(startLine - 1))) {
    startLine -= 1;
  }

  let endLine = lineNumber + 1;
  while (endLine < editor.lineCount() && /^\s*\|.*\|\s*$/.test(editor.getLine(endLine))) {
    endLine += 1;
  }

  return { startLine, endLine };
}

function isInsideHtmlTable(editor: Editor, lineNumber: number) {
  return Boolean(findHtmlTableRange(editor, lineNumber));
}

function getEditorRangeText(editor: Editor, startLine: number, endLine: number) {
  return Array.from({ length: endLine - startLine }, (_, index) => editor.getLine(startLine + index)).join("\n");
}

function getEditorRangeEndPosition(editor: Editor, endLine: number) {
  if (endLine < editor.lineCount()) {
    return { line: endLine, ch: 0 };
  }

  const lastLine = Math.max(0, editor.lineCount() - 1);
  return { line: lastLine, ch: editor.getLine(lastLine).length };
}

function unwrapMarkdownTable(sourceText: string) {
  return sourceText
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\|.*\|$/.test(line))
    .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(line))
    .map((line) => splitMarkdownTableLine(line).join("\n"))
    .join("\n\n")
    .trim();
}

function splitMarkdownTableLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "|" && trimmed[index - 1] !== "\\") {
      cells.push(cell.trim().replace(/\\\|/g, "|"));
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim().replace(/\\\|/g, "|"));
  return cells.filter((value) => value.length > 0);
}

function normalizeUnwrappedTableText(sourceText: string) {
  return sourceText
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n[ \t]*\n[ \t]*\n+/g, "\n\n")
    .trim();
}

function parseTableSelection(sourceText: string) {
  if (isMarkdownTable(sourceText)) {
    return parseMarkdownTable(sourceText);
  }
  return parseDelimitedTable(sourceText);
}

function isMarkdownTable(sourceText: string) {
  return sourceText.trim().split(/\r?\n/).some((line) => /^\s*\|.*\|\s*$/.test(line));
}

function parseMarkdownTable(sourceText: string) {
  return sourceText
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\|.*\|$/.test(line))
    .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(line))
    .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
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
    .map((line) => splitDelimitedLine(line, delimiter).map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
}

function splitDelimitedLine(line: string, delimiter: string) {
  if (delimiter === "\t") {
    return line.split(delimiter);
  }

  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"' && quoted) {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function buildMarkdownTableFromRows(rows: string[][], includeHeader: boolean) {
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => normalizeTableRow(row, width));
  const headers = includeHeader ? normalizedRows[0] : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
  const bodyRows = includeHeader ? normalizedRows.slice(1) : normalizedRows;
  const headerLine = `| ${headers.join(" | ")} |`;
  const dividerLine = `| ${headers.map((_, index) => getMarkdownDivider(bodyRows, index)).join(" | ")} |`;
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

function inferHeaderRow(rows: string[][]) {
  if (rows.length < 2) {
    return true;
  }
  const first = rows[0];
  const rest = rows.slice(1);
  return first.some((cell) => cell.trim()) && first.every((cell) => !isNumericCell(cell)) && rest.some((row) => row.some(isNumericCell));
}

function getDelimitedTableInsight(plugin: OwenEditorPlugin, sourceText: string, includeHeader: boolean) {
  const rows = parseDelimitedTable(sourceText);
  if (rows.length === 0) {
    return "";
  }

  const width = Math.max(...rows.map((row) => row.length));
  const ragged = rows.some((row) => row.length !== width);
  const bodyRows = includeHeader ? rows.slice(1) : rows;
  const numericColumns = Array.from({ length: width }, (_, index) => index + 1).filter((column) => isNumericColumn(bodyRows, column - 1));
  const messages = [
    plugin.t("table.sourceMode", { rows: rows.length, columns: width }),
    includeHeader ? plugin.t("table.headerDetected") : plugin.t("table.noHeader")
  ];
  if (numericColumns.length > 0) {
    messages.push(plugin.t("table.numericColumns", { columns: numericColumns.join(", ") }));
  }
  if (ragged) {
    messages.push(plugin.t("table.unevenRows"));
  }
  return messages.join(" · ");
}

function getMarkdownDivider(rows: string[][], columnIndex: number) {
  return isNumericColumn(rows, columnIndex) ? "---:" : "---";
}

function isNumericColumn(rows: string[][], columnIndex: number) {
  const values = rows.map((row) => row[columnIndex] ?? "").filter((cell) => cell.trim());
  return values.length > 0 && values.every(isNumericCell);
}

function isNumericCell(value: string) {
  return /^[-+]?\$?\d[\d,]*(\.\d+)?%?$/.test(value.trim());
}

function isInsideFence(editor: Editor, lineNumber: number) {
  let fenceCount = 0;
  for (let index = 0; index <= lineNumber; index += 1) {
    if (/^\s*```/.test(editor.getLine(index))) {
      fenceCount += 1;
    }
  }
  return fenceCount % 2 === 1;
}

function getPortableSettings(settings: OwenEditorSettings) {
  return {
    language: settings.language,
    showFloatingToolbar: settings.showFloatingToolbar,
    showSelectionToolbar: settings.showSelectionToolbar,
    showStatusBarButton: settings.showStatusBarButton,
    toolbarPosition: settings.toolbarPosition,
    toolbarPreset: settings.toolbarPreset,
    toolbarCollapsed: settings.toolbarCollapsed,
    toolbarScale: settings.toolbarScale,
    toolbarDensity: settings.toolbarDensity,
    favoriteDisplay: settings.favoriteDisplay,
    mobileCompactToolbar: settings.mobileCompactToolbar,
    contextAwareToolbar: settings.contextAwareToolbar,
    commandFeedback: settings.commandFeedback,
    insertHtmlTables: settings.insertHtmlTables,
    showGraphiteThemeNotice: settings.showGraphiteThemeNotice,
    favoriteCommandIds: settings.favoriteCommandIds
  };
}

function parsePortableSettings(value: string): Partial<OwenEditorSettings> {
  const parsed = JSON.parse(value) as Partial<OwenEditorSettings>;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object");
  }
  return parsed;
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
