# Spec: Website Import — Palette-Constrained Color Reduction

**Date:** 2026-03-27
**Scope:** `website-import.html` only — no other pages affected

---

## Problem

On the Website Import page, the grid is always fully quantized to the VoxelBlastJam palette (32 colors). When the user sets a target color count and presses Apply, the current reduction algorithm runs k-means clustering on arbitrary RGB centroids and then snaps the result back to the VBJ palette. This two-step process can produce unexpected color selections because the k-means step is palette-unaware.

**Requirement:** The Apply button on Website Import must reduce colors by selecting only from the VoxelBlastJam palette and must never produce a color outside that palette at any point in the operation.

---

## Approach: Greedy Palette-Constrained Reduction

### Algorithm

Since the grid is already fully quantized to VBJ colors before any reduction, each cell holds exactly one VBJ color. The reduction problem is therefore:

> Given M currently-used VBJ colors, select N ≤ M of them to keep, and reassign every cell whose color was dropped to the closest remaining kept color.

**Greedy iterative removal** (one color dropped per iteration):

1. Build `colorCounts: { vbjColor → cellCount }` from the current grid.
2. Let `active` = set of all VBJ colors currently in `colorCounts`.
3. While `active.size > targetN`:
   - For each candidate color `c` in `active`:
     - `alternative = findClosestColor(c, active \ {c})`
     - `removalCost = colorCounts[c] × colorDistance(c, alternative)`
   - Remove the candidate with the minimum `removalCost` from `active`.
   - Merge its cells: `colorCounts[alternative] += colorCounts[c]`; delete `colorCounts[c]`.
4. Build `colorMap: { droppedColor → closestActiveColor }` for all dropped colors.
5. Apply `colorMap` to the grid via `hexGrid.applyColorMapping(colorMap, { saveHistory: false })`.
6. Call `syncFixedPaletteReductionResult()` to refresh the palette UI and color count display.

**Correctness guarantee:** Every color ever written to the grid during this operation is a member of `fullPalette`. No intermediate step produces an out-of-palette color.

**Performance:** The palette has at most 32 colors. Each outer iteration evaluates at most 32 candidates. With at most 31 iterations, the worst case is ~1000 distance calculations — negligible for this grid size.

---

## Implementation

### `colorPalette.js`

**1. New constructor option:**
```js
this.paletteConstrainedReduction = options.paletteConstrainedReduction === true;
```

**2. Branch in `applyColorReduction()` — before k-means path:**
```js
if (this.paletteConstrainedReduction) {
    this._applyPaletteConstrainedReduction(targetCount);
    return;
}
```

**3. New private method `_applyPaletteConstrainedReduction(targetN)`:**
- Reads `this.hexGrid.getColorCounts()` to build `colorCounts`.
- Runs the greedy loop described above using `ColorUtils.findClosestColor` and `ColorUtils.colorDistance`.
- Applies the final color map via `this.hexGrid.applyColorMapping`.
- Calls `this.syncFixedPaletteReductionResult()`.

### `appWebsiteImport.js`

Add `paletteConstrainedReduction: true` to the `ColorPalette` constructor options.

---

## Isolation Guarantee

- `paletteConstrainedReduction` defaults to `false`. No existing page sets it to `true`.
- `WiggleTangle`: unaffected (no fixed palette, option not set).
- `VoxelBlastJam`: unaffected (option not set — existing k-means + snap path continues).
- `Website Import`: new greedy path, VBJ palette enforced end-to-end.

---

## Edge Cases

| Situation | Behaviour |
|-----------|-----------|
| `targetN ≥ activeColors.size` | Existing early-exit alert fires before new path is reached — no change. |
| `targetN = 1` | Loop runs until one color remains; all cells map to that single VBJ color. |
| Grid has a VBJ color not in `fullPalette` | Cannot happen: `quantizeGridToFullPalette` is always called before any user interaction. |
| `findClosestColor` tie between alternatives | Tie broken by array order of `fullPalette` — deterministic. |

---

## Testing

Manual verification on `website-import.html`:

1. Capture and load a KandiPatterns page. Confirm Current count shows N VBJ colors.
2. Set Target to `N - k` and press Apply. Confirm:
   - Current count decreases to `N - k`.
   - Every color visible in the grid and palette is a member of `full_color_palette_voxelblastjam.json`.
   - Used / Remaining columns update correctly.
3. Set Target to `1`. Confirm the entire grid becomes a single VBJ color.
4. Open `voxelblastjam.html` and run Apply with any target — confirm behavior is unchanged from before this change.
5. Open `index.html` (WiggleTangle) and run Apply — confirm behavior is unchanged.
