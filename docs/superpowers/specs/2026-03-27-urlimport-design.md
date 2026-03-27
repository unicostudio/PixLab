# Pattern Import Page — Design Spec

**Date:** 2026-03-27
**Status:** Approved

---

## Overview

A new PixLab page (`pattern-import.html`) that loads pixelated pattern images from a URL (e.g. kandipatterns.com), extracts size metadata from the source page, and provides all VoxelBlastJam editing capabilities. Replaces file-based image upload with URL-based import.

---

## New Files

| File | Purpose |
| --- | --- |
| `pattern-import.html` | New page HTML |
| `js/appPatternImport.js` | Page bootstrap (mirrors appVoxel.js pattern) |
| `js/urlFetcher.js` | URL fetch, HTML parse, CORS proxy logic |

## Modified Files

| File | Change |
| --- | --- |
| `index.html` | Nav link to `pattern-import.html` already added |
| `voxelblastjam.html` | Nav link to `pattern-import.html` already added |

## Unchanged Files

`js/appShared.js`, `js/gemGrid.js`, `js/imageProcessing.js`, `js/colorPalette.js`, `js/colorUtils.js`, `js/colorPicker.js` — no changes.

---

## Page Layout

Three-panel layout identical to VoxelBlastJam, with the following left panel differences.

### Left Panel

#### Total Colors (unchanged from VoxelBlast)

- Current color count display
- Target color count + Apply button (`id="applyColorReduction"`) — auto-bound by `ColorPalette` internals, same as VoxelBlast
- Clear Selection button (`id="clearSelection"`)

#### Size (new section, below Total Colors)

- Cols input (`id="gridCols"`) + Rows input (`id="gridRows"`) — auto-filled from URL metadata, user-editable
- Apply button (`id="applyGridSize"`) — bound in `bindExtraControls` callback (see below)

#### Actions

- Clear Grid (`id="clearGrid"`)
- Export PNG (`id="exportPNG"`)
- Save Grid PNG (`id="savePixelGrid"`) — label: `Save {cols}x{rows} PNG`, updates dynamically. Filename: `{slug}_{cols}x{rows}.png`
- Save Grid JSON (`id="saveGrid"`)
- Load Grid JSON (`id="loadGrid"`)
- URL input field (`id="urlInput"`, always visible, placeholder: `https://kandipatterns.com/...`)
- Load from URL button (`id="loadFromUrl"`)
- Error/status message area (`id="urlLoadStatus"`, initially empty — a `<div>` below the URL input)
- Direct image URL input (`id="directImageUrl"`, initially hidden via `style="display:none"`, revealed on CORS failure, hidden again on successful load)

### Required Hidden Stub Elements

`appShared.js:bindSharedControls` unconditionally queries several IDs. As of the current version of `appShared.js`:

- `loadImage` and `imageInput` — **null-guarded**, not required as stubs
- `savePNG` — **null-guarded**, not required as stub

The following IDs **must be present** in `pattern-import.html`. `appShared.js` calls `document.getElementById(...).addEventListener(...)` on all of them unconditionally — missing any one causes a `TypeError` crash at init time:

```html
<button id="undoButton" style="visibility:hidden"></button>
<button id="redoButton" style="visibility:hidden"></button>
<button id="clearSelection" ...>Clear Selection</button>
<button id="clearGrid" ...>Clear Grid</button>
<button id="exportPNG" ...>Export PNG</button>
<button id="saveGrid" ...>Save Grid</button>
<button id="loadGrid" ...>Load Grid</button>
```

`undoButton` and `redoButton` must be present but should remain visually hidden (matching VoxelBlast pattern).

### Script Load Order in `pattern-import.html`

```html
<script src="js/colorUtils.js"></script>
<script src="js/gemGrid.js"></script>
<script src="js/colorPalette.js"></script>
<script src="js/colorPicker.js"></script>
<script src="js/imageProcessing.js"></script>
<script src="js/urlFetcher.js"></script>
<script src="js/appShared.js"></script>
<script src="js/appPatternImport.js"></script>
```

### Middle Panel

Canvas grid — identical to VoxelBlast.

### Right Panel

Color Palette — identical to VoxelBlast (`full_color_palette_voxelblastjam.json`).

---

## appPatternImport.js Structure

`appPatternImport.js` defines its own local `replaceGrid(appState, cols, rows)` function — a new implementation that supports rectangular (non-square) grids. It must **not** reuse or import the `replaceGrid` from `appVoxel.js`, which only accepts a single `newSize` for square grids.

`appPatternImport.js` calls `PixLabApp.initializeSharedApp(options)` with the following options:

```js
{
  palettePath: 'full_color_palette_voxelblastjam.json',
  enableColorPicker: false,
  colorPaletteOptions: { ... },  // identical to appVoxel.js
  createGrid: function() { ... },
  bindExtraControls: function(appState, helpers) {
    // ALL of the following bindings happen here, inside bindExtraControls,
    // so that appState.gemGrid and appState.colorPalette are fully initialised:
    bindApplyGridSize(appState, helpers);
    bindSavePixelGrid(appState);
    bindLoadFromUrl(appState, helpers);
  },
  loadGridData: function(appState, gridData, helpers) { ... },
  afterInit: function(appState) { ... }
}
```

`currentSlug` is a module-level variable (initialised to `"pattern"`) in `appPatternImport.js`.

---

## URL Fetch Flow

Triggered when user clicks `loadFromUrl`. The button is disabled and label set to `"Loading..."` for the entire async sequence. On completion or error, button is re-enabled and label restored. Re-entrant clicks during an active load are ignored (flag: `isLoading`).

Error and status messages are written to `urlLoadStatus`. The element is cleared at the start of each load attempt.

### Step 1 — Validation

If `urlInput` value is empty or does not start with `http`, set `urlLoadStatus` to an error message and abort. `urlInput` must be non-empty on every load attempt (including CORS-fallback retries) to preserve a valid slug.

### Step 2 — Slug extraction

Extract the last non-empty path segment from `urlInput` value (split on `/`, take last non-empty item, strip any file extension).
Example: `https://kandipatterns.com/patterns/misc/pretzel-62072` → `pretzel-62072`.
Store in `currentSlug`. This step runs on **every** load click, including CORS-fallback retries — `currentSlug` is always re-derived from the current `urlInput` value.

### Step 3 — HTML fetch via CORS proxy

```text
GET https://api.allorigins.win/get?url={encodedUrl}
```

Response: JSON with `contents` field containing page HTML.

**On failure:** Set `urlLoadStatus` to error message. Reveal `directImageUrl` input. On the next load click, if `directImageUrl` has a value, skip Steps 3–5 and use that value as the resolved image URL, jumping to Step 6. Size inputs must be filled manually; Size Validation (Step 7) will catch empty/invalid values.

### Step 4 — Size parse

Search page HTML for:

```text
(\d+) columns wide x (\d+) rows tall
```

Extract cols and rows as integers. Auto-fill `gridCols` and `gridRows` inputs.

**On failure:** Set `urlLoadStatus` to warning "Size not found — enter manually". Leave size inputs unchanged for manual entry.

### Step 5 — Image URL extraction

Search fetched HTML for `<img>` tags whose `src` attribute contains `/patterns/` in the path. Use the first match. If no match, fall back to first `<img>` whose `src` ends with `.png`, `.jpg`, or `.gif`.

Resolve relative URLs against the origin of the source page URL.

**If no image URL found:** Set `urlLoadStatus` to error "Image not found on page". Abort.

### Step 6 — Image proxy

```text
https://api.allorigins.win/raw?url={encodedImageUrl}
```

Create an `HTMLImageElement`, set `crossOrigin = "anonymous"`, set `src` to the proxied URL. Wait for `onload`.

**On failure:** Set `urlLoadStatus` to error "Image could not be loaded". Abort.

### Step 7 — Size Validation

Read current values from `gridCols` and `gridRows` inputs. Validate:

- Both must be present (not empty)
- Both must parse as integers ≥ 1
- Both must be ≤ 500

**On failure:** Set `urlLoadStatus` to error "Invalid size — enter valid cols and rows". Abort.

### Step 8 — Grid preparation

Check `gridHasUserContent(appState.gemGrid)` using the same logic as `appVoxel.js`:

```js
function gridHasUserContent(gemGrid) {
  return Object.values(gemGrid.gemColors).some(color => color !== gemGrid.defaultColor);
}
```

If grid has user content: `confirm("Grid will be replaced. Continue?")`. If cancelled, abort.

Call `helpers.resetDerivedImageState()` (via the `helpers` object from `bindExtraControls`).

Call `replaceGrid(appState, cols, rows)`:

1. `if (appState.gemGrid) appState.gemGrid.destroy()`
2. `appState.gemGrid = new GemGrid('gemGrid', cols, rows)`
3. `appState.colorPalette.setGrid(appState.gemGrid)` — re-bind palette to new grid instance
4. `appState.gemGrid.saveState()`
5. Update `gridCols`, `gridRows` input values
6. Update `savePixelGrid` button label: `Save {cols}x{rows} PNG`

### Step 9 — Image processing

```js
Promise.resolve(appState.colorPalette.paletteLoaded)
  .catch(function() { return appState.colorPalette.fullPalette; })
  .then(function() {
    ImageProcessor.processImage(img, appState.gemGrid, appState.colorPalette);
    // processImage schedules gemGrid.saveState() via setTimeout(0) internally.
    // Our outer setTimeout(0) is queued AFTER that internal one.
    // JS event loop processes setTimeout(0) callbacks in FIFO order,
    // so saveState() is guaranteed to run before our post-processing:
    setTimeout(function() {
      appState.colorPalette.constrainGridToFullPalette();
      appState.colorPalette.originalImageColors = appState.gemGrid.getColorCounts();
      appState.colorPalette.createPaletteUI({ skipGridSave: true });
      appState.colorPalette.updateColorCountDisplay();
      PixLabApp.showTransientMessage('Pattern loaded.', 1200);
      document.getElementById('directImageUrl').style.display = 'none';
    }, 0);
  });
```

Uses `.catch()` — intentionally matches the image-load path in `appShared.js` (not the `.finally()` in `appVoxel.js`'s `loadGridData`). Hides `directImageUrl` on successful load.

---

## Size Apply Button (Manual Resize)

Bound inside `bindExtraControls`. When user clicks `applyGridSize`:

1. Read cols and rows from `gridCols`/`gridRows` inputs
2. Run Size Validation. On failure show `alert()` and abort.
3. If new cols === current `appState.gemGrid.cols` and rows === current `appState.gemGrid.rows`, return (no-op)
4. If `gridHasUserContent(appState.gemGrid)`: `confirm("Changing grid size will clear the current grid. Continue?")`. If cancelled, abort.
5. Call `helpers.resetDerivedImageState()`
6. Call `replaceGrid(appState, cols, rows)`

---

## Load Grid JSON — Free-form Dimensions

`loadGridData` in `appPatternImport.js`:

1. Parse `gridData.cols` and `gridData.rows` as integers
2. Run Size Validation. On failure throw an `Error` with a descriptive message.
3. Show `confirm("Loading this grid will replace the current grid. Continue?")` if grid has user content. If cancelled, return without changes.
4. Reset `currentSlug` to `"pattern"` (JSON load has no URL slug)
5. Call `helpers.resetDerivedImageState()`
6. Call `replaceGrid(appState, cols, rows)`
7. Call `appState.gemGrid.loadFromJSON(gridData)`
8. Use `.finally()` pattern (matching `appVoxel.js`) for post-palette-load processing:

```js
Promise.resolve(appState.colorPalette.paletteLoaded)
  .finally(function() {
    appState.colorPalette.constrainGridToFullPalette();
    appState.colorPalette.originalImageColors = appState.gemGrid.getColorCounts();
    appState.colorPalette.createPaletteUI({ skipGridSave: true });
    appState.colorPalette.updateColorCountDisplay();
  });
```

Accepts any positive-integer dimensions — not constrained to 40/60/80.

---

## Download Filename

- `savePixelGrid` button: downloads `{currentSlug}_{cols}x{rows}.png`
- `currentSlug` defaults to `"pattern"` until a URL is successfully loaded

---

## Color Palette

Uses `full_color_palette_voxelblastjam.json` — same as VoxelBlastJam.

```js
{
  allowColorPicker: false,
  allowHexEditing: false,
  useDetectedColorsAsPalette: false,
  useFullPaletteAsDisplay: true,
  allowLoadedPaletteOverride: false,
  useTwoColumnPalette: true
}
```

---

## All Inherited VoxelBlast Features

- Color reduction (target color count + Apply) — auto-bound by ColorPalette
- Clear selection
- Undo / Redo (Ctrl+Z / Ctrl+Y)
- Clear Grid
- Export PNG (full grid with gem borders)
- Save Grid PNG (pixel-only export, dynamic filename)
- Save / Load Grid JSON (free-form dimensions)
- Color palette display with two-column layout
- Color mapping: grid colors snapped to full VoxelBlast palette
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Escape)

---

## urlFetcher.js Interface

```js
const UrlFetcher = {
  // Extract slug from URL: last non-empty path segment, extension stripped.
  // e.g. "https://kandipatterns.com/patterns/misc/pretzel-62072" → "pretzel-62072"
  // e.g. "https://example.com/foo/bar.png" → "bar"
  extractSlug(url): string,

  // Fetch page HTML via allorigins proxy. Rejects on network/CORS failure.
  fetchPageHtml(url): Promise<string>,

  // Parse cols and rows from HTML string. Returns null if not found.
  parsePatternSize(html): { cols: number, rows: number } | null,

  // Find main pattern image URL from HTML string.
  // Priority: first <img src> containing "/patterns/".
  // Fallback: first <img src> ending in .png/.jpg/.gif.
  // Resolves relative URLs against baseUrl.
  // Returns absolute URL string or null.
  extractImageUrl(html, baseUrl): string | null,

  // Return proxied image URL safe for canvas use.
  proxyImageUrl(imageUrl): string
};
```

---

## Error Handling Summary

| Scenario | Behavior |
| --- | --- |
| Empty / invalid URL | Error in `urlLoadStatus`, abort |
| CORS proxy unreachable | Error in `urlLoadStatus`, reveal `directImageUrl` |
| Size not found in HTML | Warning in `urlLoadStatus`, leave size inputs for manual entry |
| Image URL not found in HTML | Error in `urlLoadStatus`, abort |
| Image load fails | Error in `urlLoadStatus`, abort |
| Invalid cols/rows (zero, NaN, >500) | Error in `urlLoadStatus` (or `alert()` for manual resize), abort |
| Grid has user content before load/resize | `confirm()` dialog |
| Re-entrant load click | Ignored — button disabled during active load |
| Successful load | Hide `directImageUrl`, show success toast |
