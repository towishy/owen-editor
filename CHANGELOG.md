# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to Owen Editor are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses semantic versioning.

## [Unreleased]

## [0.6.21] - 2026-05-02

### Changed

- Refined the floating toolbar liquid glass styling to reduce individual button card weight and align with the shared glass-panel reference.
- Improved toolbar tooltip placement, palette density, favorite command management, mobile selection context updates, and table builder source controls.
- Updated README UI preview screenshots and docs screenshot automation to keep visual samples aligned with the current UI.

## [0.6.20] - 2026-05-02

### Changed

- Refreshed the README knowledge-work stack image with brighter modern UI mockups for Owen WIKI, Owen Graphite, and Owen Editor.

## [0.6.19] - 2026-05-02

### Fixed

- Kept floating toolbar tooltips above the second-row favorite buttons while hovering or focusing primary toolbar icons.

## [0.6.18] - 2026-05-02

### Changed

- Rewrote README in Korean with current installation, usage, settings, validation, and release guidance.
- Updated UI copy to follow Obsidian community plugin sentence-case expectations.
- Added local Obsidian ReviewBot-style linting with `eslint-plugin-obsidianmd` and `npm run lint:obsidian`.
- Added a Windows `Compress-Archive` fallback to release automation when the `zip` executable is unavailable.

### Fixed

- Moved static SVG filter styling from direct `element.style` assignments into CSS.
- Switched editor UI document access to `activeDocument` for better Obsidian popout compatibility.
- Hardened saved settings loading against non-object data.

## [0.6.17] - 2026-05-01

### Added

- Added a reusable Obsidian vault sync script and CI workflow for build and release checks.
- Added keyboard navigation to the command palette with arrow-key selection and Enter execution.

### Changed

- Batched selection toolbar positioning updates with `requestAnimationFrame` to reduce layout work during scroll and selection changes.
- Added reduced-motion handling, dark-mode mini-toolbar contrast, and lightweight rendering hints for the glass toolbars.
- Extended release checks to catch stale README release badges.

## [0.6.16] - 2026-05-01

### Changed

- Reworked the floating and selection toolbar glass styling with SVG lens displacement, stronger specular highlights, and light/dark liquid glass layers.

## [0.6.15] - 2026-04-29

### Changed

- Floating toolbar now sits slightly lower from the top edge and uses a stronger layered shadow for a clearer floating feel.

## [0.6.14] - 2026-04-28

### Fixed

- Added direct download link and prominent warning in README to prevent downloading GitHub's auto-generated Source code archive instead of the plugin zip.

## [0.6.13] - 2026-04-28

### Fixed

- Renamed the manual install release asset to `owen-editor.zip` so extracted folders are named `owen-editor`.

## [0.6.12] - 2026-04-28

### Fixed

- Prevented startup errors from disabling the plugin toggle during core initialization.
- Fell back to default settings when saved plugin data cannot be loaded.
- Packaged the manual install zip with a top-level `owen-editor` folder.

## [0.6.11] - 2026-04-28

### Fixed

- Kept plugin activation from failing when optional toolbar UI or unavailable icons cannot initialize.

## [0.6.10] - 2026-04-28

### Fixed

- Guarded toolbar resize observation so Owen Editor can still load when `ResizeObserver` is unavailable.
- Clarified manual zip installation steps before the feature overview.
- Added a versioned release zip asset for manual installation.

## [0.6.9] - 2026-04-28

### Fixed

- Updated UI labels to satisfy Obsidian community sentence-case validation.
- Removed plugin-name wording from command names shown in Obsidian's command palette.
- Avoided unsafe config stringification and promise-returning DOM event handlers flagged by ReviewBot.

## [0.6.8] - 2026-04-28

### Added

- Added context-aware command recommendations to the Owen Editor palette.
- Added a Graphite report starter workflow for report scaffolds with metrics and source notes.
- Added selection table conversion commands for Markdown and Owen Graphite HTML tables.
- Added favorite presets for writer, research, report, and table-heavy workflows.
- Added a docs screenshot script for regenerating the README palette sample image.

## [0.6.7] - 2026-04-28

### Added

- Added a README sample image showing the v0.6.6 command palette overflow fix.

## [0.6.6] - 2026-04-28

### Fixed

- Kept command palette labels and preview snippets inside their panels on narrow or dense layouts.

## [0.6.5] - 2026-04-28

### Added

- Added toolbar density presets for compact, balanced, comfortable, and custom layouts.
- Added context-aware toolbar command groups for selections, tables, code blocks, and Owen Graphite reports.
- Added command execution feedback on toolbar buttons.
- Added recommended default favorites for first-run toolbar onboarding.
- Added settings JSON export/import for portable toolbar configuration.
- Added richer palette search with category prefixes, fuzzy matching, and expanded Graphite previews.
- Added table builder inference for pasted data, including header detection, uneven row normalization, and numeric alignment.
- Added A3/PDF-friendly Graphite snippets for source notes, metric rows, and decision matrices.

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

[Unreleased]: https://github.com/towishy/owen-editor/compare/0.6.21...HEAD
[0.6.21]: https://github.com/towishy/owen-editor/compare/0.6.20...0.6.21
[0.6.20]: https://github.com/towishy/owen-editor/compare/0.6.19...0.6.20
[0.6.19]: https://github.com/towishy/owen-editor/compare/0.6.18...0.6.19
[0.6.18]: https://github.com/towishy/owen-editor/compare/0.6.17...0.6.18
[0.6.17]: https://github.com/towishy/owen-editor/compare/0.6.16...0.6.17
[0.6.16]: https://github.com/towishy/owen-editor/compare/0.6.15...0.6.16
[0.6.15]: https://github.com/towishy/owen-editor/compare/0.6.14...0.6.15
[0.6.14]: https://github.com/towishy/owen-editor/compare/0.6.13...0.6.14
[0.6.13]: https://github.com/towishy/owen-editor/compare/0.6.12...0.6.13
[0.6.12]: https://github.com/towishy/owen-editor/compare/0.6.11...0.6.12
[0.6.11]: https://github.com/towishy/owen-editor/compare/0.6.10...0.6.11
[0.6.10]: https://github.com/towishy/owen-editor/compare/0.6.9...0.6.10
[0.6.9]: https://github.com/towishy/owen-editor/compare/0.6.8...0.6.9
[0.6.8]: https://github.com/towishy/owen-editor/compare/0.6.7...0.6.8
[0.6.7]: https://github.com/towishy/owen-editor/compare/0.6.6...0.6.7
[0.6.6]: https://github.com/towishy/owen-editor/compare/0.6.5...0.6.6
[0.6.5]: https://github.com/towishy/owen-editor/compare/0.6.4...0.6.5
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
