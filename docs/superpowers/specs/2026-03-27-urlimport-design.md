# URL Import JSON Pipeline — Design Spec

**Date:** 2026-03-27
**Status:** Approved for planning

## Overview

`url-import.html` currently fetches a pattern image from a source page and paints the grid directly from that image. That direct image-to-grid path is producing incorrect results for pre-pixelated pattern images.

The approved change is to make URL Import follow the same two-stage flow as Image Extractor plus Pattern Import:

1. Fetch the source page and read the pattern size from the page HTML.
2. Load the pattern image.
3. Sample the image into a pattern JSON structure first.
4. Apply that pattern data to the grid instead of painting the grid directly from the image.
5. Let the user download the edited result as a new external JSON format.

The page keeps the current VoxelBlastJam editing experience after load. The JSON pipeline is an internal correctness fix plus a new export option, not a UI redesign.

## Goals

- Replace the current direct image-to-grid import in `url-import.html` with a JSON-backed pipeline.
- Reuse the Image Extractor cell-sampling logic so URL imports produce the same corrected bead placement logic.
- Continue reading rows and columns from the source page HTML, not from image pixel dimensions.
- Keep the VoxelBlastJam full-catalog palette behavior on the URL Import page after load.
- Add a dedicated pattern JSON download action whose output reflects the user’s latest grid edits.

## Non-Goals

- Change `pattern-import.html` to accept a new external file format.
- Replace the existing `Save Grid` button or PixLab grid JSON format.
- Support URL import when the source page cannot be fetched or when source size cannot be parsed.
- Convert every internal PixLab import/export path to the new external JSON schema.

## Existing Context

- [`js/appUrlImport.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/appUrlImport.js) currently samples the fetched image and writes colors straight into `gemGrid`.
- [`js/imageExtractor.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/imageExtractor.js) already contains the cell-center sampling logic that works better for bead pattern images.
- [`js/appPattern.js`](/Users/ali/Documents/workplace/pixelart/PixLab/js/appPattern.js) already knows how to validate pattern JSON and apply it to the grid.
- The URL Import page must keep the VoxelBlastJam palette behavior, not switch to a pattern-scoped palette like Pattern Import does today.

## Approved Approach

URL Import becomes an orchestrator around shared pattern helpers:

- One shared sampler converts an image plus source size into internal pattern data.
- One shared importer applies that pattern data to the grid.
- One shared exporter converts the current grid into the new external JSON format.

This keeps the URL Import page on a single page, removes the inaccurate direct paint path, and avoids having URL Import, Image Extractor, and Pattern Import drift further apart.

## Module Boundaries

### `js/patternSampler.js` (new)

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

### `js/patternImport.js` (new)

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

### `js/patternExport.js` (new)

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

### 7. Apply the pattern to the grid

- Reset derived image state.
- Replace the grid with the imported dimensions.
- Apply the internal pattern through `PatternImport` with `usePatternPalette: false`.
- Recompute `originalImageColors` from the resulting grid so the two-column VoxelBlastJam palette UI remains accurate.

### 8. Store export metadata

On successful import, persist the latest successful source metadata in URL Import state:

- `currentSlug`
- `currentPatternName`
- `currentPatternAuthor`

This metadata is used later by `Download Pattern JSON`, even if the user edits colors after import.

### 9. Enable export and show success

- Enable `Download Pattern JSON`.
- Show the existing success toast.
- Clear any prior error status.

## Download Pattern JSON Behavior

The new button exports from the current grid state at click time. It must not blindly re-download the original imported pattern object.

Export rules:

- dimensions come from `appState.gemGrid.cols` and `appState.gemGrid.rows`
- metadata comes from the latest successful import state
- `pixelData` is rebuilt from the current grid contents
- only non-default-color cells are emitted
- colors are emitted directly as normalized hex codes

Example filename:

- `{currentSlug}_pattern.json`

This ensures user edits are reflected in the downloaded file.

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
- Pattern generation failure: show inline status error, do not enable export.
- Pattern apply failure: show inline status error, do not enable export.
- User cancels replacement confirmation: silently abort and leave existing grid untouched.

`Load from URL` still disables itself during the async flow and restores itself on every exit path.

## Manual Verification

Because shared logic is being extracted, manual testing must cover all affected entry points.

### URL Import

- Valid URL imports with the correct rows and columns taken from the source page.
- Imported pattern colors and placement match the corrected cell-sampled behavior.
- VoxelBlastJam full-palette UI still appears after import.
- `Download Pattern JSON` stays disabled until a successful import.
- After a successful import, downloaded JSON uses the new `grid/pixelData` schema.
- After editing colors on the grid, downloaded JSON reflects the edited state.
- If the grid is already populated, replacement confirmation still works.
- Invalid URL, fetch failure, missing size, missing image, and image-load failure all recover cleanly.

### Pattern Import

- Existing pattern JSON files still load correctly after importer logic is shared.

### Image Extractor

- Loading an image and generating JSON still behaves the same after sampler logic is shared.

## Planning Notes

The implementation plan should treat this as a refactor plus behavior change, not a page rewrite:

1. extract shared sampler/import/export helpers
2. wire URL Import to the new pipeline
3. update Image Extractor and Pattern Import to consume the shared helpers
4. run manual verification across all three pages
