# Fixed-Palette Reduction Sync and Guidance Cleanup — Design Spec

**Date:** 2026-03-27
**Status:** Approved for planning

## Overview

Two pages currently use the fixed VoxelBlastJam palette model with two-column `Used / Remaining` display:

- `voxelblastjam.html`
- `website-import.html`

On these pages, using `Target` + `Apply` in the `Total Colors` card can leave the `Used` list stale or misleading. The reduction logic updates the grid, but the final grid colors and the palette UI can drift because the reduction step may temporarily produce colors outside the fixed VoxelBlastJam catalog before the page is visually re-synchronized.

The approved change is:

1. Keep the existing color reduction interaction.
2. After reduction, if the page is running in fixed full-palette two-column mode, immediately snap the reduced grid back to the VoxelBlastJam palette catalog.
3. Rebuild the `Used / Remaining` palette UI from the final snapped grid state.
4. Update the `Current` color count from that same final grid state.

In addition, repository guidance should be cleaned up so it no longer documents removed URL Import functionality and instead reflects the remaining Website Import workflow.

## Goals

- Make `Used / Remaining` update immediately and correctly after `Target` -> `Apply` on fixed-palette pages.
- Ensure the displayed `Used` colors always match the actual final grid colors.
- Keep the fix shared for both `VoxelBlastJam` and `Website Import`.
- Update `CLAUDE.md` and `AGENTS.md` so guidance matches the remaining Website Import-centric repository state.

## Non-Goals

- Change editable palette behavior on `index.html`, `pattern-import.html`, or `image-extractor.html`.
- Replace the existing reduction algorithm for non-fixed-palette pages.
- Redesign the VoxelBlastJam palette UI.
- Refactor `Website Import` or `VoxelBlastJam` bootstraps unless required for verification.
- Touch unrelated local changes in `website-import.html` or `js/appWebsiteImport.js` that are outside this bugfix.

## Existing Context

- `js/colorPalette.js` owns the `Target` -> `Apply` reduction flow via `applyColorReduction()`.
- Two-column palette behavior is driven by:
  - `useTwoColumnPalette: true`
  - `useFullPaletteAsDisplay: true`
- `getTwoColumnPaletteData()` derives `Used / Remaining` from:
  - the full palette catalog in `this.colors`
  - the current grid colors in `this.hexGrid.gemColors`
- `quantizeGridToFullPalette()` already exists and is the correct fixed-palette snap step used elsewhere in the app.
- `CLAUDE.md` still documents removed URL Import files and outdated local-server guidance.

## Root Cause

The bug is not just a missing UI refresh.

`applyColorReduction()` currently:

1. reduces colors from the current grid
2. applies the reduced mapping to the grid
3. refreshes the palette UI in two-column mode

But on fixed-palette pages, the reduced result is not guaranteed to stay inside the VoxelBlastJam palette catalog. That means the grid can temporarily contain colors that do not belong to the full displayed palette. The two-column UI computes `Used` by intersecting current grid colors with the displayed catalog, so those out-of-catalog colors can make the `Used` column incomplete, stale-looking, or inconsistent with the visible grid state.

The correct fix is to re-snap the reduced grid back into the fixed palette before rebuilding the two-column palette UI.

## Approved Approach

Apply the fix centrally in `js/colorPalette.js`.

After `applyColorReduction()` updates the grid:

- if the palette is **not** fixed two-column full-palette mode, keep current behavior
- if the palette **is** fixed two-column full-palette mode:
  - quantize the grid back into `full_color_palette_voxelblastjam.json`
  - update derived palette state from the final grid
  - rebuild the two-column UI
  - update the visible current color count

This keeps the change shared between `VoxelBlastJam` and `Website Import` without duplicating logic in `js/appVoxel.js` or `js/appWebsiteImport.js`.

## File Responsibilities

### `js/colorPalette.js`

This is the primary runtime file for the behavior fix.

Responsibilities for this change:

- detect the fixed-palette two-column mode
- re-quantize reduced grid colors into the full palette after reduction
- refresh palette state from the final snapped grid
- rebuild `Used / Remaining` from the final grid state
- update `Current` count from the final grid state

Implementation constraint:

- do not change behavior for non-two-column editable palette pages

### `js/gemGrid.js`

This file is out of scope for general behavior changes.

It may only be touched if the implementation needs a very small history-control adjustment so that one `Apply` action still behaves like one logical undo step after the new fixed-palette post-processing path is added.

### `CLAUDE.md` and `AGENTS.md`

These guidance files should be updated to match the post-cleanup repository state.

Required updates:

- remove URL Import references
- remove references to `js/appUrlImport.js`, `js/urlFetcher.js`, and `url-import.html`
- document that `website-import.html` is now the only web import page
- clarify that `dev-server.js` is the correct local server for Website Import because it provides `/proxy/html` and `/proxy/image`
- keep broader repository guidance aligned with the current entry-page set and proxy/server workflow

Scope note:

- guidance cleanup in this task is intentionally limited to `CLAUDE.md` and `AGENTS.md`

## Runtime Behavior

### Before the Change

On fixed-palette pages:

1. user enters a smaller `Target`
2. clicks `Apply`
3. grid colors are reduced
4. `Used` may not match the final visible result because the grid can contain non-catalog intermediate colors

### After the Change

On fixed-palette pages:

1. user enters a smaller `Target`
2. clicks `Apply`
3. grid colors are reduced
4. grid is immediately quantized back into the full VoxelBlastJam palette
5. `originalImageColors` / derived palette state is refreshed from the final grid
6. `Used / Remaining` is rebuilt from the final snapped grid
7. `Current` count reflects the final snapped grid
8. the whole interaction still behaves like one user action from an undo/redo perspective

## Decision Boundary

The extra post-reduction quantize step applies only when all of the following are true:

- `useTwoColumnPalette === true`
- `useFullPaletteAsDisplay === true`
- `fullPalette` is loaded and non-empty

All other palette modes keep the current reduction flow.

## Verification

The implementation is complete when all of the following are true:

1. On `voxelblastjam.html`, changing `Target` and clicking `Apply` updates `Used` immediately.
2. On `website-import.html`, changing `Target` and clicking `Apply` updates `Used` immediately.
3. `Current` color count matches the final grid colors after reduction.
4. `Used` contains only colors that exist in the fixed VoxelBlastJam palette catalog.
5. Non-fixed-palette pages still keep their previous reduction behavior.
6. `CLAUDE.md` no longer references removed URL Import functionality.
7. `AGENTS.md` is aligned with the remaining repository structure and local server guidance where relevant.
8. One `Apply` action does not create unintended duplicate undo history entries.
9. `node --check js/colorPalette.js` passes.
10. `git diff --check` passes.

Manual verification setup for items 1-4:

- start from a grid state where `Used / Remaining` is already active
- for `voxelblastjam.html`, this can be a loaded grid file or imported image/grid with multiple colors present
- for `website-import.html`, this should be a successfully captured/imported pattern with the fixed palette already applied
- then lower `Target`, click `Apply`, and compare the visible grid against the `Used` column and `Current` count

## Risks

- Re-quantizing after reduction may produce a final color count that reflects the fixed palette constraint rather than the raw intermediate k-means output. This is acceptable and more correct for fixed-palette pages.
- `website-import.html` and `js/appWebsiteImport.js` currently have local modifications unrelated to this bugfix. Implementation must not revert or overwrite those unrelated changes.
- `applyColorReduction()`, `applyColorMapping()`, and `quantizeGridToFullPalette()` all interact with grid history today. Implementation must preserve sane undo/redo behavior and avoid making one `Apply` click feel like multiple history steps.

## Implementation Notes

- Prefer a small shared helper inside `ColorPalette` rather than duplicating post-reduction refresh logic inline.
- Treat the final snapped grid as the source of truth for both `Used` and `Current`.
- Keep the fix local to shared palette logic unless implementation proves that a page-specific hook is unavoidable.
- If needed, part of the implementation may be reducing duplicate history writes inside the fixed-palette reduction path, but only to the extent required to keep one `Apply` interaction logically atomic.
