# URL Import JSON Pipeline — Design Spec

**Date:** 2026-03-27
**Status:** Approved for planning

## Overview

`url-import.html` currently fetches a pattern image from a source page and converts it through the shared sampler/import path. That fixed the wrong-source-image problem, but the page still does not match the intended VoxelBlastJam behavior after import because the imported colors remain in raw sampled form.

The approved behavior for URL Import is now:

1. Fetch the source page and read the pattern size from the page HTML.
2. Load the pattern image.
3. Sample the image into a pattern JSON structure first.
4. Apply that pattern data to the grid.
5. Immediately snap the imported grid colors to the nearest colors in [`full_color_palette_voxelblastjam.json`](/Users/ali/Documents/workplace/pixelart/PixLab/full_color_palette_voxelblastjam.json).
6. Show the snapped colors as the active `Used` palette state on the URL Import page.
7. Let the user download the edited result as a new external JSON format built from the current snapped or manually edited grid.

This behavior is specific to URL Import. `Image Extractor` and `Pattern Import` must keep their current non-snapped behavior.

## Goals

- Keep the existing JSON-backed URL import pipeline and add VoxelBlastJam-style palette snapping on top of it.
- Reuse the Image Extractor cell-sampling logic so URL imports produce the same corrected bead placement logic.
- Continue reading rows and columns from the source page HTML, not from image pixel dimensions.
- Snap imported colors on the URL Import page to the nearest colors in the VoxelBlastJam palette catalog immediately after import.
- Keep the VoxelBlastJam full-catalog palette behavior on the URL Import page after load, with `Used` derived from the snapped grid state.
- Add a dedicated pattern JSON download action whose output reflects the user’s latest snapped or manually edited grid state.

## Non-Goals

- Change `pattern-import.html` to accept a new external file format.
- Replace the existing `Save Grid` button or PixLab grid JSON format.
- Support URL import when the source page cannot be fetched or when source size cannot be parsed.
- Convert every internal PixLab import/export path to the new external JSON schema.
- Apply VoxelBlastJam palette snapping to `Image Extractor` or `Pattern Import`.

## Existing Context

- [`js/appUrlImport.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/appUrlImport.js) already imports through `PatternSampler` and `PatternImport`, but it does not yet snap imported colors to the VoxelBlastJam full palette.
- [`js/imageExtractor.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/imageExtractor.js) already contains the cell-center sampling logic that works better for bead pattern images.
- [`js/appPattern.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/appPattern.js) already knows how to validate pattern JSON and apply it to the grid.
- The URL Import page must keep the VoxelBlastJam palette behavior, not switch to a pattern-scoped palette like Pattern Import does today.
- The VoxelBlastJam page already has the desired palette constraint model: full catalog display, nearest-color snapping, and `Used/Remaining` derived from the current grid.

## Approved Approach

URL Import remains an orchestrator around shared pattern helpers, but adds one URL-import-only post-processing step:

- One shared sampler converts an image plus source size into internal pattern data.
- One shared importer applies that pattern data to the grid.
- The URL Import page immediately constrains the resulting grid to the nearest colors in the VoxelBlastJam full palette catalog.
- One shared exporter converts the current grid into the new external JSON format.

This keeps the URL Import page on a single page, keeps shared sampler/import logic generic, and applies VoxelBlastJam-specific palette behavior only where it is actually required.

## Module Boundaries

### `js/patternSampler.js`

Purpose: shared image-to-pattern conversion.

Responsibilities:

- Accept an `HTMLImageElement` plus explicit `rows` and `cols`.
- Sample each cell from the center region instead of downscaling the whole image.
- Reuse the Image Extractor defaults that are already working for these assets:
  - merge tolerance: `16`
  - sample inset: `22%`
  - omit dominant background color: `true`
- Return internal pattern data in the current legacy pattern structure used by Pattern Import:
  - `name`
  - `author`
  - `dimensions`
  - `palette`
  - `beads`

Notes:

- `pixelData` is not the internal working format.
- Omitting dominant background color preserves the current sparse bead semantics from the existing extractor flow.

### `js/patternImport.js`

Purpose: shared pattern parsing and grid application.

Responsibilities:

- Validate and normalize the current legacy pattern structure.
- Replace the active grid with the imported dimensions.
- Apply bead colors to the new grid.
- Support a palette mode option:
  - `usePatternPalette: true` for [`js/appPattern.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/appPattern.js)
  - `usePatternPalette: false` for [`js/appUrlImport.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/appUrlImport.js)

Rationale:

- Pattern Import must keep its current pattern-scoped palette behavior.
- URL Import must keep its current VoxelBlastJam full palette behavior even though it now imports through pattern data.
- VoxelBlastJam palette snapping is not moved into `PatternImport`; that decision stays in the URL Import page orchestration layer.

### `js/patternExport.js`

Purpose: shared export of the new external JSON contract.

Responsibilities:

- Read the current grid state from `gemGrid`.
- Build the new external JSON schema:

```json
{
  "name": "Imported Pattern",
  "author": "PixLab",
  "grid": {
    "x": 50,
    "y": 50
  },
  "pixelData": [
    {
      "x": 1,
      "y": 0,
      "colorCode": "#123456"
    }
  ]
}
```

- Export sparse pixel data only, matching the old `beads` meaning:
  - include cells whose color is not the grid default color
  - do not emit a palette block
  - do not emit color names
  - emit hex colors directly via `colorCode`

## Internal vs External Data Contracts

### Internal Working Format

The implementation may keep using the current Pattern Import structure internally:

```json
{
  "name": "Imported Pattern",
  "author": "PixLab",
  "dimensions": {
    "width": 50,
    "height": 50
  },
  "palette": {
    "A": {
      "name": "A",
      "hex": "#123456"
    }
  },
  "beads": [
    {
      "x": 1,
      "y": 0,
      "color": "A"
    }
  ]
}
```

This format stays internal so the existing Pattern Import code path can be reused instead of rewriting every importer now.

### External Download Format

The file the user downloads from URL Import must use the new contract:

```json
{
  "name": "Imported Pattern",
  "author": "PixLab",
  "grid": {
    "x": 50,
    "y": 50
  },
  "pixelData": [
    {
      "x": 1,
      "y": 0,
      "colorCode": "#123456"
    }
  ]
}
```

Field mapping from the old structure:

- `dimensions.width` -> `grid.x`
- `dimensions.height` -> `grid.y`
- `beads` -> `pixelData`
- bead `color` code lookup -> direct `colorCode` hex string
- `palette` removed entirely

## URL Import Page Changes

### UI Changes

[`url-import.html`](/Users/ali/Documents/workplace/pixelart/PixLab/url-import.html) keeps its current structure with one action change:

- Add `Download Pattern JSON` button to the Actions panel.
- Keep `Save Grid` unchanged for existing PixLab grid JSON export.
- Keep size inputs visible so users can still manually resize the grid after import.

Button state:

- `Download Pattern JSON` is disabled until the first successful URL import.
- After a successful import it stays enabled for the rest of the session and always exports the current grid state.

### Removed URL Fallback Behavior

The current direct image URL fallback is no longer part of the approved flow.

Reason:

- The corrected import path depends on source-page HTML for reliable rows and columns.
- If the source page cannot be fetched or if size metadata cannot be parsed, URL Import should stop and show a clear error instead of trying to continue with a partially defined import.

That means `directImageUrlGroup` and its related retry path can be removed or left unwired, but it should not remain part of the active import flow.

## URL Import Runtime Flow

Triggered by `Load from URL` on [`url-import.html`](/Users/ali/Documents/workplace/pixelart/PixLab/url-import.html).

### 1. Validate the source URL

- Require a non-empty URL starting with `http`.
- Derive `currentSlug` from the URL path for filenames and default pattern name.

### 2. Fetch source HTML

- Use [`js/urlFetcher.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/urlFetcher.js) proxy logic.
- If HTML fetch fails, stop the flow and show an error in `urlLoadStatus`.

### 3. Extract source metadata

From the fetched HTML:

- parse pattern size using the existing source-page text pattern
- extract the pattern image URL
- derive metadata for later export:
  - `name`: `currentSlug` if present, otherwise `Imported Pattern`
  - `author`: source hostname if available, otherwise `PixLab`

If size parsing fails or image URL extraction fails:

- stop the flow
- do not modify the grid
- keep the download button disabled

### 4. Load the image

- Resolve and proxy the image URL through the current `UrlFetcher` image proxy chain.
- Abort with a clear status message if the image cannot be loaded.

### 5. Generate internal pattern data

- Pass the loaded image plus parsed `rows` and `cols` into `PatternSampler`.
- `PatternSampler` produces internal legacy pattern JSON using the extracted metadata.
- This is the step that replaces the current `processPatternImage` direct-write behavior in [`js/appUrlImport.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/appUrlImport.js).

### 6. Confirm replacement if needed

- If the current grid contains user content, show the existing replacement confirmation.
- If the user cancels, abort without changing grid or export state.

### 7. Ensure palette readiness before grid mutation

- Confirm that the VoxelBlastJam full palette catalog has loaded successfully before replacing or mutating the grid.
- If [`full_color_palette_voxelblastjam.json`](/Users/ali/Documents/workplace/pixelart/PixLab/full_color_palette_voxelblastjam.json) is unavailable or empty, abort the import and show an inline error.
- Do not allow URL Import to succeed with unsnapped raw sampled colors.

### 8. Apply the pattern to the grid

- Reset derived image state.
- Replace the grid with the imported dimensions.
- Apply the internal pattern through `PatternImport` with `usePatternPalette: false`.

### 9. Snap imported colors to the VoxelBlastJam catalog

- Call `appState.colorPalette.constrainGridToFullPalette()` after the imported pattern has been applied.
- This is required only on `url-import.html`.
- The snapped grid becomes the authoritative working state for all later editing and export.

### 10. Refresh URL Import palette state

- Recompute `originalImageColors` from the snapped grid, not from the pre-snap sampled pattern.
- Rebuild the two-column palette UI so `Used` reflects only colors present in the snapped grid.
- Keep `Remaining` as the rest of the VoxelBlastJam full catalog.

### 11. Store export metadata

On successful import, persist the latest successful source metadata in URL Import state:

- `currentSlug`
- `currentPatternName`
- `currentPatternAuthor`

This metadata is used later by `Download Pattern JSON`, even if the user edits colors after import.

### 12. Enable export and show success

- Enable `Download Pattern JSON`.
- Show the existing success toast.
- Clear any prior error status.

## Download Pattern JSON Behavior

The new button exports from the current grid state at click time. It must not blindly re-download the original imported pattern object or the pre-snap sampled pattern.

Export rules:

- dimensions come from `appState.gemGrid.cols` and `appState.gemGrid.rows`
- metadata comes from the latest successful import state
- `pixelData` is rebuilt from the current grid contents
- only non-default-color cells are emitted
- colors are emitted directly as normalized hex codes
- if the user made manual color edits after the initial snap, those edits are what get exported

Example filename:

- `{currentSlug}_pattern.json`

This ensures the downloaded file always represents the final visible state on the URL Import page.

## Changes to Existing Pages

### `image-extractor.html` / `js/imageExtractor.js`

Behavior stays the same for the user, but the page should stop owning its own sampling implementation and call `PatternSampler` instead.

This keeps URL Import and Image Extractor aligned on the actual cell sampling logic.

### `pattern-import.html` / `js/appPattern.js`

Behavior stays the same for the user.

The page should delegate validation and application logic to `PatternImport` so URL Import and Pattern Import no longer maintain separate copies of the same import path.

`pattern-import.html` does not need to read the new external `grid/pixelData` format in this task.

## Script Load Order

### `image-extractor.html`

Load the shared sampler before [`js/imageExtractor.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/imageExtractor.js).

### `pattern-import.html`

Load the shared importer before [`js/appPattern.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/appPattern.js).

### `url-import.html`

Load:

1. existing shared dependencies
2. `js/urlFetcher.js`
3. `js/patternSampler.js`
4. `js/patternImport.js`
5. `js/patternExport.js`
6. `js/appShared.js`
7. `js/appUrlImport.js`

The important constraint is that `appUrlImport.js` must execute after all three pattern helpers are available.

## Error Handling

- Invalid source URL: show inline status error, do nothing else.
- Source HTML fetch failure: show inline status error, do not attempt partial import.
- Source size missing: show inline status error, do not attempt partial import.
- Source image missing: show inline status error, do not attempt partial import.
- Image load failure: show inline status error, do not attempt partial import.
- VoxelBlastJam palette load failure: show inline status error, do not replace the grid, and do not enable export.
- Pattern generation failure: show inline status error, do not enable export.
- Pattern apply failure: show inline status error, do not enable export.
- User cancels replacement confirmation: silently abort and leave existing grid untouched.

`Load from URL` still disables itself during the async flow and restores itself on every exit path.

## Manual Verification

Because shared logic is being extracted, manual testing must cover all affected entry points.

### URL Import

- Valid URL imports with the correct rows and columns taken from the source page.
- Imported pattern colors and placement match the corrected cell-sampled behavior.
- Imported colors are immediately snapped to the nearest VoxelBlastJam palette colors.
- VoxelBlastJam full-palette UI still appears after import.
- `Used` colors come from the snapped grid state, not the raw sampled colors.
- `Download Pattern JSON` stays disabled until a successful import.
- After a successful import, downloaded JSON uses the new `grid/pixelData` schema and reflects the snapped colors.
- After editing colors on the grid, downloaded JSON reflects the edited final state.
- If the grid is already populated, replacement confirmation still works.
- Invalid URL, fetch failure, missing size, missing image, and image-load failure all recover cleanly.

### Pattern Import

- Existing pattern JSON files still load correctly after importer logic is shared.

### Image Extractor

- Loading an image and generating JSON still behaves the same after sampler logic is shared.

## Planning Notes

The implementation plan should treat this as a focused URL Import behavior change, not a page rewrite:

1. add URL-import-only VoxelBlastJam palette snapping after apply
2. update palette/export state so `Used/Remaining` and downloaded JSON reflect the snapped or edited final grid
3. verify `Image Extractor` and `Pattern Import` are unchanged
4. run manual verification on the affected URL Import flows
