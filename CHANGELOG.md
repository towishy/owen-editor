# Changelog

All notable changes to Owen Editor are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses semantic versioning.

## [Unreleased]

## [0.6.4] - 2026-04-28

### Added

- Added favorite row display modes for always visible, hover reveal, or hidden toolbar favorites.
- Added adaptive toolbar downscaling for narrower Markdown panes.

### Changed

- Reduced the default toolbar scale and softened toolbar shadows, spacing, border radius, and category color emphasis.

## [0.6.3] - 2026-04-28

### Added

- Added a toolbar scale setting for resizing the floating toolbar and selection mini toolbar.

## [0.6.2] - 2026-04-28

### Fixed

- Removed the plugin ID from command IDs for Obsidian community validation.
- Reworked settings headings to use Obsidian setting headings.
- Added release checks for command ID and settings heading validation rules.

## [0.6.1] - 2026-04-27

### Changed

- Increased transparency of the floating and selection toolbar glass backgrounds.

## [0.6.0] - 2026-04-27

### Changed

- Improved selection mini toolbar placement so it stays inside the active Markdown pane and flips below selections when needed.
- Refined toolbar spacing, shadows, hover states, and press feedback to reduce document distraction.
- Improved palette hierarchy with recent-command framing, grouped command sections, and small output preview chips for Graphite and formatting commands.
- Grouped settings into scannable sections for toolbar, selection tools, shortcuts, Graphite helpers, and favorites.

### Added

- Design preview fixture showing the seven planned UI improvements together.

## [0.5.0] - 2026-04-27

### Added

- Selection mini toolbar for quick inline formatting near selected text.
- Setting to enable or disable the selection mini toolbar.

## [0.4.1] - 2026-04-27

### Added

- Changelog process and release validation for future updates.
- Release automation now reads GitHub release notes from `CHANGELOG.md`.

## [0.4.0] - 2026-04-27

### Added

- Recent commands section at the top of the Owen Editor palette.
- Favorite command order controls in settings.
- Toolbar workflow presets: Minimal, Writer, Report, Full, and Custom.
- CSV/TSV paste conversion in the table builder.
- Document templates for executive summaries, comparison reports, risk reviews, and meeting notes.
- Release automation scripts for preflight checks and GitHub release creation.

## [0.3.1] - 2026-04-27

### Fixed

- Centered the floating toolbar within the active Markdown document pane instead of the full window.
- Constrained toolbar width to the active document pane to avoid overlap with sidebars and split panes.

## [0.3.0] - 2026-04-27

### Added

- Toolbar position setting for top or bottom placement.
- Collapsible toolbar mode and command.
- Compact mobile toolbar behavior.
- Korean and English palette search aliases.
- Live preview in the table builder.
- Stronger release validation for package-lock versions, license, and README preview image.

## [0.2.3] - 2026-04-27

### Fixed

- Prevented the fixed glass toolbar from covering the top of newly opened Markdown documents.
- Added automatic toolbar clearance for reading and editing views.

## [0.2.2] - 2026-04-27

### Changed

- Applied transparent glass toolbar styling with stronger blur, saturation, highlights, and soft shadows.

## [0.2.1] - 2026-04-27

### Fixed

- Expanded command palette width and allowed long command labels to wrap.
- Moved favorite toolbar commands onto a second row to avoid horizontal overflow.

## [0.2.0] - 2026-04-27

### Added

- Owen Graphite theme notice for theme-specific helpers.
- Table builder for Markdown and Owen Graphite-styled HTML tables.
- Favorite command pinning from the palette.
- Release validation script.

## [0.1.0] - 2026-04-27

### Added

- Initial Owen Editor Obsidian plugin release.
- Floating glass toolbar for common Markdown editing commands.
- Category palettes for selection, links, blocks, tables, and Owen Graphite helpers.
- Highlight color picker.
- Owen Graphite table, report, callout, badge, blur, keyboard, and reference snippets.

[Unreleased]: https://github.com/towishy/owen-editor/compare/0.6.4...HEAD
[0.6.4]: https://github.com/towishy/owen-editor/compare/0.6.3...0.6.4
[0.6.3]: https://github.com/towishy/owen-editor/compare/0.6.2...0.6.3
[0.6.2]: https://github.com/towishy/owen-editor/compare/0.6.1...0.6.2
[0.6.1]: https://github.com/towishy/owen-editor/compare/0.6.0...0.6.1
[0.6.0]: https://github.com/towishy/owen-editor/compare/0.5.0...0.6.0
[0.5.0]: https://github.com/towishy/owen-editor/compare/0.4.1...0.5.0
[0.4.1]: https://github.com/towishy/owen-editor/compare/0.4.0...0.4.1
[0.4.0]: https://github.com/towishy/owen-editor/compare/0.3.1...0.4.0
[0.3.1]: https://github.com/towishy/owen-editor/compare/0.3.0...0.3.1
[0.3.0]: https://github.com/towishy/owen-editor/compare/0.2.3...0.3.0
[0.2.3]: https://github.com/towishy/owen-editor/compare/0.2.2...0.2.3
[0.2.2]: https://github.com/towishy/owen-editor/compare/0.2.1...0.2.2
[0.2.1]: https://github.com/towishy/owen-editor/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/towishy/owen-editor/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/towishy/owen-editor/releases/tag/0.1.0
