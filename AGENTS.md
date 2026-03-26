# Repository Guidelines

## Project Structure & Module Organization
PixLab is a static browser app with two entry pages: [`index.html`](/Users/hasan/Documents/projects/github/PixLab/index.html) for WiggleTangle and [`voxelblastjam.html`](/Users/hasan/Documents/projects/github/PixLab/voxelblastjam.html) for VoxelBlastJam. Shared behavior lives in [`js/appShared.js`](/Users/hasan/Documents/projects/github/PixLab/js/appShared.js); page-specific bootstraps live in `js/appGem.js` and `js/appVoxel.js`. Core grid logic is in `js/gemGrid.js`, palette/UI logic is in `js/colorPalette.js`, and image mapping is in `js/imageProcessing.js`. Game-specific palette catalogs are stored in [`full_color_palette_wiggletangle.json`](/Users/hasan/Documents/projects/github/PixLab/full_color_palette_wiggletangle.json) and [`full_color_palette_voxelblastjam.json`](/Users/hasan/Documents/projects/github/PixLab/full_color_palette_voxelblastjam.json).

## Build, Test, and Development Commands
There is no build step or package manifest.

- `open index.html`: quick manual check for the WiggleTangle page.
- `open voxelblastjam.html`: quick manual check for the VoxelBlastJam page.
- `python3 -m http.server 8000`: preferred local server for file input, JSON loading, and image import.
- `node --check js/appShared.js`: syntax-check shared JS; use the same command for other edited JS files.
- `git diff --check`: catch whitespace or patch-format issues before finishing.

## Coding Style & Naming Conventions
Use 4-space indentation in HTML, CSS, and JS. Keep IDs stable because shared JS binds directly to DOM IDs such as `loadImage`, `saveGrid`, and `targetColorCount`. Prefer `camelCase` for functions/variables and `PascalCase` for constructor-style objects like `GemGrid` and `ColorPalette`. Match existing vanilla JS patterns; there is no formatter or linter configured.

## UI & Behavior Notes
Both pages now place action buttons in a left-side `Actions` card instead of a bottom canvas bar. VoxelBlastJam uses a fixed JSON palette, disables color picker and manual hex editing, and renders the palette in two columns. Before image/grid data is loaded, the full palette is split across both columns; afterward the left column shows used colors and the right column shows remaining colors. WiggleTangle keeps the editable palette flow.

## Testing Guidelines
Manual browser testing is required. Verify grid render, selection, undo/redo, save/load JSON, PNG export, and image import on both pages. On VoxelBlastJam, confirm fixed palette behavior, two-column grouping, and grid-size changes. Also check that the image-load success message appears as a short auto-dismissing toast rather than a blocking alert.

## Commit & Pull Request Guidelines
Use concise imperative commits; optional prefixes such as `feat:` and `chore:` are fine when helpful. PRs should include a short summary, manual test notes for both pages when shared code changes, and screenshots or recordings for visible layout or palette changes.
