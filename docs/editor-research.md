# Markdown UI Editor Feature Notes

This note captures the first feature set to study and fold into Owen Editor. The goal is not to copy one editor, but to extract the patterns that make Markdown editing fast, predictable, and pleasant in Obsidian.

## Editors To Review

| Editor | Useful Pattern | Owen Editor Direction |
|---|---|---|
| Typora | WYSIWYG-like inline Markdown with low visual friction | Keep commands immediate and selection-aware |
| MarkText | Clean toolbar, tables, task lists, diagram-friendly editing | Add richer block insertion without hiding Markdown |
| StackEdit | Practical Markdown shortcuts and export-oriented writing | Prioritize report/PDF workflows |
| HackMD / HedgeDoc | Collaboration-friendly Markdown blocks and previews | Keep snippets portable and plain-text first |
| TOAST UI Editor | Split Markdown/WYSIWYG modes, table tooling | Consider future table builder modal |
| Milkdown | Command-driven Markdown editor architecture | Keep command registry structured by feature groups |
| Tiptap / ProseMirror editors | Extensible slash commands and block menus | Consider future slash command palette inside editor |
| EasyMDE / SimpleMDE | Familiar formatting toolbar buttons | Cover the expected baseline Markdown toolbar actions |

## Recommended Baseline Features

| Priority | Feature | Reason |
|---|---|---|
| P0 | Selection-aware bold, italic, strike, code, link | Users expect these from any Markdown UI editor |
| P0 | Headings, task list, quote, code block, callout | Common Obsidian editing flow |
| P0 | Owen Graphite report/table snippets | Makes theme-specific value accessible from UI |
| P1 | Searchable command palette modal | Scales better than a crowded fixed toolbar |
| P1 | Table helper modal | Owen Graphite table classes are powerful but easy to mistype |
| P1 | Callout picker | Obsidian callouts benefit from icon/color presets |
| P2 | Slash-command style block menu | Fast keyboard-first editing without leaving the editor |
| P2 | Snippet favorites | Lets users pin their own report/table patterns |
| P2 | Markdown cleanup commands | Normalize headings, list spacing, table alignment |

## Owen Graphite-Specific Candidates

| Feature | Initial Implementation |
|---|---|
| Wide comparison table | Insert HTML table with `wide-table print-fit-table comparison-table wrap-table` |
| Risk table | Insert `risk-table compact-table` with risk status classes |
| Numeric table | Insert `numeric-table print-fit-table` for report metrics |
| Risk matrix | Insert `matrix-table compact-table` |
| Reference list | Insert `.ogd-reference-list` structure |
| Report frontmatter | Insert report-oriented YAML starter |
| Secret/summary/action blocks | Insert Owen Graphite callout patterns |
| Keyboard/blur/status inline UI | Wrap selection with `<kbd>`, `.ogd-blur`, and `.ogd-status-badge` snippets |
| PDF/report mode helpers | Future: frontmatter/class picker and Style Settings bridge guidance |

## Later Recommendation List

When the feature set stabilizes, produce a ranked recommendation list comparing: Typora, MarkText, StackEdit, HackMD/HedgeDoc, TOAST UI Editor, Milkdown, Tiptap, EasyMDE/SimpleMDE, and the Obsidian Editing Toolbar plugin.
