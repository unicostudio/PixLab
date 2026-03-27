# Repository Guidelines

## Project Structure & Module Organization
PixLab is a static browser app with five entry pages: `index.html` for WiggleTangle, `voxelblastjam.html` for the fixed VoxelBlastJam workflow, `pattern-import.html`, `image-extractor.html`, and `website-import.html`. Shared behavior lives in `js/appShared.js`; page-specific bootstraps live in `js/appGem.js`, `js/appVoxel.js`, `js/appPattern.js`, `js/imageExtractor.js`, and `js/appWebsiteImport.js`. Core grid logic is in `js/gemGrid.js`, palette/UI logic is in `js/colorPalette.js`, and image mapping is in `js/imageProcessing.js`. Palette catalogs are stored in `full_color_palette_wiggletangle.json` and `full_color_palette_voxelblastjam.json`.

## Build, Test, and Development Commands
There is no build step or package manifest.

- `node dev-server.js`: preferred local server for all pages; required for `website-import.html` because it serves `/proxy/html` and `/proxy/image`.
- `python3 -m http.server 8000`: static-only fallback when you do not need Website Import proxy routes.
- `open http://localhost:8000/index.html`: quick manual check for WiggleTangle.
- `open http://localhost:8000/voxelblastjam.html`: quick manual check for VoxelBlastJam.
- `open http://localhost:8000/website-import.html`: quick manual check for Website Import.
- `node --check js/appShared.js`: syntax-check shared JS; use the same command for other edited JS files.
- `git diff --check`: catch whitespace or patch-format issues before finishing.

## Coding Style & Naming Conventions
Use 4-space indentation in HTML, CSS, and JS. Keep IDs stable because shared JS binds directly to DOM IDs such as `loadImage`, `saveGrid`, and `targetColorCount`. Prefer `camelCase` for functions/variables and `PascalCase` for constructor-style objects like `GemGrid` and `ColorPalette`. Match existing vanilla JS patterns; there is no formatter or linter configured.

## UI & Behavior Notes
The main editing pages place action buttons in a left-side `Actions` card instead of a bottom canvas bar. VoxelBlastJam and Website Import both use the fixed VoxelBlastJam JSON palette, disable color picker and manual hex editing, and render the palette in two columns. Before image/grid data is loaded, the full palette is split across both columns; afterward the left column shows used colors and the right column shows remaining colors. WiggleTangle keeps the editable palette flow.

## Testing Guidelines
Manual browser testing is required. Verify grid render, selection, undo/redo, save/load JSON, PNG export, and image import on the affected pages. On VoxelBlastJam and Website Import, confirm fixed palette behavior, two-column `Used / Remaining` grouping, and that `Target -> Apply` refreshes both the used-color list and the current count from the final snapped grid. Also check that image-load success feedback appears as a short auto-dismissing toast rather than a blocking alert.

## Commit & Pull Request Guidelines
Use concise imperative commits; optional prefixes such as `feat:` and `chore:` are fine when helpful. PRs should include a short summary, manual test notes for both pages when shared code changes, and screenshots or recordings for visible layout or palette changes.
