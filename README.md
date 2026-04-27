# Owen Editor

Owen Editor is an Obsidian plugin that brings a practical Markdown editing toolbar together with quick helpers for the Owen Graphite theme.

![Owen Editor glass toolbar preview](screenshots/owen-editor-ui-preview.png)

## Features

- Floating glass toolbar for common Markdown editing actions.
- Toolbar position controls for top or bottom placement, with a collapsible compact state.
- Direct buttons for undo, redo, headings, bold, italic, strikethrough, underline, highlight, indent, outdent, tasks, and lists.
- Category palettes for selection tools, links, blocks, tables, Owen Graphite helpers, and all commands, including Korean and English search aliases.
- Highlight color picker with recommended soft colors for selected text.
- Favorites that pin frequently used commands directly onto the floating toolbar.
- Expanded Obsidian callout support, including note, info, tip, important, success, question, warning, failure, danger, bug, example, quote, abstract, and todo.
- Table builder with live preview for quick Markdown tables and Owen Graphite-styled HTML table layouts.
- Table helpers for basic Markdown tables and Owen Graphite report table presets.
- Owen Graphite snippets for report frontmatter, wide comparison tables, risk tables, numeric tables, risk matrices, reference lists, keyboard tags, blur spans, status badges, and theme callouts.

## Owen Graphite Theme Notice

The standard Markdown editing commands work in any Obsidian vault. Owen Graphite-specific helpers insert Markdown or HTML snippets designed for the Owen Graphite theme, so their visual styling requires the Owen Graphite theme to be installed and enabled in Obsidian.

Without Owen Graphite, those snippets are still inserted as readable Markdown or HTML, but theme-specific classes such as `wide-table`, `risk-table`, `ogd-status-badge`, and `ogd-reference-list` will not receive the intended visual treatment.

## Usage

Enable Owen Editor from Obsidian's Community Plugins settings, then open a Markdown note. The floating toolbar appears near the top of the editor when the plugin setting is enabled. You can move it to the bottom or collapse it into a single button from the settings tab.

Use the left side of the toolbar for frequent edits such as headings, formatting, highlights, indentation, tasks, and lists. Use the colored category icons on the right side to open focused palettes:

| Icon Group | Palette |
|---|---|
| Selection | Text styling, comments, notices, quotes, code blocks, and selection wrappers |
| Links | Markdown links, wiki links, embeds, attachments, images, and footnotes |
| Blocks | Horizontal rules, frontmatter, Mermaid blocks, alignment helpers, and document blocks |
| Tables | Markdown tables and Owen Graphite table presets |
| Owen Graphite | Theme-specific report, table, callout, badge, blur, keyboard, and reference helpers |
| All Commands | Full Owen Editor command palette |

Most commands are also available from Obsidian's command palette under `Owen Editor`. Palette search accepts common English and Korean terms such as `table`, `표`, `링크`, `highlight`, `강조`, `graphite`, and `보고서`.

Open the all-commands palette and use the star buttons to pin frequent actions to the glass toolbar. Pinned commands appear between the common Markdown controls and the category icons.

Use the table builder from the Tables palette when you need a custom number of rows and columns. The builder shows the generated Markdown or HTML before insertion. Markdown output works in any vault; Owen Graphite presets insert theme-classed HTML for report-ready tables.

## Settings

- Show floating glass toolbar: toggles the horizontal editor toolbar.
- Show status bar button: adds an `Owen Editor` status bar shortcut.
- Toolbar position: pins the toolbar to the top or bottom of the editor.
- Start with toolbar collapsed: keeps the toolbar as a compact single-button launcher until expanded.
- Compact toolbar on mobile: reduces button size and allows wrapping on mobile devices.
- Prefer Owen Graphite HTML tables: inserts HTML tables with Owen Graphite classes instead of plain Markdown table fallbacks for supported table presets.
- Warn when Owen Graphite is not active: shows a one-time notice before inserting theme-specific snippets if the Owen Graphite theme is not active.
- Toolbar favorites: stores command IDs pinned to the floating toolbar. This is usually managed with the star buttons in the palette.

## Installation

After the plugin is accepted into Obsidian Community Plugins, install it from Obsidian's Community Plugins browser.

For manual installation, download the release assets and copy these files into `.obsidian/plugins/owen-editor/` in your vault:

- `main.js`
- `manifest.json`
- `styles.css`

Restart Obsidian or reload plugins, then enable `Owen Editor`.

## Development

```bash
npm install
npm run build
npm run release:check
```

For live rebuilds during plugin development:

```bash
npm run dev
```

## Repository

https://github.com/towishy/owen-editor
