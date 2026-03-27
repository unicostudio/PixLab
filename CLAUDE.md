# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Preferred local server — serves static files and the Website Import proxy endpoints
node dev-server.js
# Opens at http://localhost:8000

# Static-only fallback when you do not need Website Import proxy routes
python3 -m http.server 8000

# Syntax-check any edited JS file (no build step or package manager exists)
node --check js/appShared.js

# Check for whitespace/patch issues before finishing
git diff --check
```

`dev-server.js` is required when working on `website-import.html`, because it provides the `/proxy/html?url=...` and `/proxy/image?url=...` endpoints used to bypass CORS for third-party pages and images.

## Architecture

PixLab is a **static, no-build vanilla JS app** with multiple HTML entry pages. All JS is loaded via `<script>` tags in each HTML file.

### Entry Pages

| Page | File | Purpose |
|------|------|---------|
| WiggleTangle | `index.html` | Editable hex-grid bead art (64×40) |
| VoxelBlastJam | `voxelblastjam.html` | Fixed-palette voxel art (40/60/80 square) |
| Pattern Import | `pattern-import.html` | Import patterns directly |
| Image Extractor | `image-extractor.html` | Extract colors from images |
| Website Import | `website-import.html` | Capture/import pattern images from websites through the local proxy |

### JS Module Roles

- **`js/appShared.js`** — `PixLabApp.initializeSharedApp()` bootstrap: shared event bindings (load image, save/load grid, PNG export, undo/redo, color reduction). All shared DOM IDs are bound here.
- **`js/appGem.js`** — WiggleTangle bootstrap: calls `initializeSharedApp`, binds `save64x40`.
- **`js/appVoxel.js`** — VoxelBlastJam bootstrap: calls `initializeSharedApp`, manages grid-size switching (40/60/80), persists size in `localStorage`.
- **`js/appPattern.js`** — Pattern Import bootstrap: parses imported pattern JSON and applies it to the shared grid/palette runtime.
- **`js/imageExtractor.js`** — Image Extractor bootstrap: samples uploaded images and exports pattern JSON.
- **`js/appWebsiteImport.js`** — Website Import bootstrap: fetches page HTML/image through the local proxy, loads the captured image into the grid, and exports/imports temporary pattern JSON.
- **`js/gemGrid.js`** — `GemGrid` class: canvas rendering, hex cell hit-testing, selection, undo/redo history, PNG export.
- **`js/colorPalette.js`** — `ColorPalette` class: palette UI, fixed-palette `Used / Remaining` rendering, color reduction, palette JSON loading.
- **`js/imageProcessing.js`** — `ImageProcessor` singleton: loads image files, maps pixels to grid via k-means.
- **`js/colorUtils.js`** / **`js/colorUtils2.js`** — `ColorUtils` singleton: hex↔RGB conversion, color math, normalization.
- **`dev-server.js`** — local development server: serves the static app plus `/proxy/html` and `/proxy/image` endpoints for Website Import.

### Key Design Constraints

- **DOM IDs are stable contracts.** `appShared.js` binds directly to IDs like `loadImage`, `saveGrid`, `targetColorCount`. Do not rename them without updating all binding code.
- **`ColorPalette` behavior is options-driven.** Constructor options (`allowColorPicker`, `allowHexEditing`, `useDetectedColorsAsPalette`, `useTwoColumnPalette`, `allowLoadedPaletteOverride`) control per-page differences. VoxelBlastJam sets `allowColorPicker: false`, `allowHexEditing: false`, `useTwoColumnPalette: true`.
- **Website Import shares the VoxelBlastJam palette model.** Both `voxelblastjam.html` and `website-import.html` use the fixed VoxelBlastJam catalog with two-column `Used / Remaining` palette rendering.
- **Palette JSON files** (`full_color_palette_wiggletangle.json`, `full_color_palette_voxelblastjam.json`) are 120-color catalogs loaded at runtime.

## Code Style

- 4-space indentation in HTML, CSS, and JS.
- `camelCase` for functions/variables; `PascalCase` for class-style objects (`GemGrid`, `ColorPalette`, `ImageProcessor`, `ColorUtils`).
- No formatter or linter — match the existing vanilla JS style.

## Testing

Manual browser testing only. After any change, verify:
- Grid rendering and navigation links on affected pages.
- Image import, save/load JSON, PNG export, undo/redo, selection.
- On VoxelBlastJam: fixed palette rules, two-column grouping, `Target -> Apply` syncing `Used / Remaining`, grid-size switching.
- On Website Import: proxy fetch, captured image import, fixed palette application, `Target -> Apply` syncing `Used / Remaining`.
- Image-load success feedback shows as an auto-dismissing toast (not a blocking alert).

## Commit Guidelines

Concise imperative commits; `feat:` / `fix:` / `chore:` prefixes are optional but welcome. PRs should include manual test notes for both main pages when shared code changes, and screenshots for visible UI changes.
