# Spec: Website Import — Palette-Constrained Color Reduction

**Date:** 2026-03-27
**Scope:** `website-import.html` only — no other pages affected

---

## Problem

On the Website Import page, the grid is always fully quantized to the VoxelBlastJam palette (32 colors). When the user sets a target color count and presses Apply, the current algorithm runs k-means clustering on arbitrary RGB centroids and then snaps the result back to the VBJ palette. This two-step process can produce unexpected color selections because the k-means step is palette-unaware.

**Requirement:** Apply on Website Import must reduce colors by selecting only from the VoxelBlastJam palette and must never produce an out-of-palette color at any point in the operation.

---

## Pre-condition

The algorithm assumes all grid cells hold valid VBJ colors at the time Apply is pressed. This is guaranteed by the KandiPatterns bookmarklet import path and the "Apply Voxel Palette" button, both of which call `quantizeGridToFullPalette` before returning control to the user.

**Known gap:** If the user loads a JSON grid via Load Grid without pressing "Apply Voxel Palette," the grid may contain non-VBJ colors. The greedy algorithm will still produce valid output — colorMap values always come from `active`, which is derived from the actual grid colors. Fixing the Load Grid path is out of scope.

---

## Algorithm: Greedy Palette-Constrained Reduction

Since the grid is quantized to VBJ colors, each cell holds one VBJ color. The problem is: given M currently-used VBJ colors, select N of them to keep and reassign dropped-color cells to the closest remaining kept color.

**Step 1 — Build normalized color counts and raw-key map:**

```js
const rawCounts = this.hexGrid.getColorCounts();
const colorCounts = {};  // normalized key -> cell count
const rawToNorm = {};    // raw gemColors value -> normalized key

Object.keys(rawCounts).forEach(function(rawColor) {
    const norm = ColorUtils.normalizeHex(rawColor);
    rawToNorm[rawColor] = norm;
    colorCounts[norm] = (colorCounts[norm] || 0) + rawCounts[rawColor];
});
```

The `rawToNorm` map is needed in step 4 so that `colorMap` keys match the raw values stored in `gemColors` (which is what `applyColorMapping` iterates). This is defense-in-depth: in practice, `quantizeGridToFullPalette` already normalizes all grid values, but the map guarantees correctness regardless.

The default color is included if present on the grid — treated like any other VBJ color; it can be dropped.

**Step 2 — Initialize active set:**

```js
let active = Object.keys(colorCounts); // normalized, insertion-order array
```

**Step 2a — Normalized early-exit guard:**

```js
if (active.length <= targetN) {
    alert('Already at or below target color count.');
    return;
}
```

This guard is required because the outer early-exit in `applyColorReduction()` compares `this.hexGrid.getAllColors().length` (raw, un-normalized) against `targetCount`. If the raw grid contains case variants of the same color (e.g., `#ffffff` and `#FFFFFF`), `getAllColors()` returns 2 but `active.length` after normalization is 1. Without this inner guard, the greedy loop would be entered with `active.length` already ≤ `targetN` and silently produce a no-op — no undo entry, no user feedback.

**Step 3 — Greedy loop:**

While `active.length > targetN`:

- For each candidate `c` in `active`:
  - `alternative = ColorUtils.findClosestColor(c, active.filter(function(x) { return x !== c; }))`
  - `removalCost = colorCounts[c] * ColorUtils.colorDistance(ColorUtils.hexToRgb(c), ColorUtils.hexToRgb(alternative))`
- Use a strict `<` scan to find the minimum-cost candidate. The **first** minimum encountered in array order wins. In a tie, the candidate appearing **earliest** in `active` is removed.
- Remove the chosen candidate from `active`.
- Merge counts: `colorCounts[alternative] += colorCounts[c]`; delete `colorCounts[c]`.

**Distance metric:** `ColorUtils.colorDistance` (Euclidean RGB), consistent with `ColorUtils.findClosestColor`. Acceptable because both candidate and alternative are VBJ palette members.

**Note on intermediate state:** The greedy loop operates entirely in-memory on `active` and `colorCounts`. It does not touch `gemColors`, call `render()`, or call `saveState()` during iteration. The single canvas update and the single undo entry happen in steps 5 and 7 respectively.

**Step 4 — Build colorMap keyed by raw gemColors values:**

```js
const activeSet = new Set(active);
const colorMap = {};
Object.keys(rawToNorm).forEach(function(rawColor) {
    const norm = rawToNorm[rawColor];
    if (!activeSet.has(norm)) {
        colorMap[rawColor] = ColorUtils.findClosestColor(norm, active);
    }
});
```

Using raw keys ensures `applyColorMapping`'s `colorMap[oldColor]` lookup matches the actual stored values in `gemColors`. Colors still in `active` have no entry in `colorMap`, so `applyColorMapping`'s truthiness check correctly skips them (they keep their color). All `colorMap` values are non-empty normalized hex strings drawn from `active`. `findClosestColor` returns its input strings unchanged; since `active` contains `normalizeHex` outputs (uppercase), all `colorMap` values are uppercase normalized hex.

**Step 5 — Apply mapping:**

```js
this.hexGrid.applyColorMapping(colorMap, { saveHistory: false });
```

`applyColorMapping` calls `this.render()` internally, so the canvas is updated immediately. No additional `render()` call is needed in subsequent steps. After this call all `gemColors` values are normalized uppercase hex strings (colorMap values come from `active`, which holds `normalizeHex` outputs), so `getColorCounts()` key count correctly equals the post-reduction color count shown in the UI.

**Step 6 — Lean UI refresh:**

```js
this.originalImageColors = Object.assign({}, this.hexGrid.getColorCounts());
this.createPaletteUI({ skipGridSave: true });
```

Do **not** call `syncFixedPaletteReductionResult` — that method calls `quantizeGridToFullPalette` first (using a perceptual/HSV metric), which would overwrite the greedy assignments with a different algorithm. The lean refresh skips this.

`createPaletteUI` calls `updateColorCountDisplay()` internally; no separate call needed. Do **not** add a standalone `updateColorCountDisplay()` call at the end of `_applyPaletteConstrainedReduction` — `applyColorReduction()` has a trailing `updateColorCountDisplay()` call that is only reached by the original path (the new branch returns before it). `this.colors` remains the full VBJ palette (`useFullPaletteAsDisplay: true`); the Used/Remaining two-column split is driven by `getNormalizedGridColors()` against the live grid, not by `this.colors`.

**Step 7 — Save undo state:**

```js
this.hexGrid.saveState(); // synchronous, not deferred — produces exactly one undo step
```

`createPaletteUI` was called with `skipGridSave: true`, suppressing any deferred `saveState` it would otherwise schedule. This step 7 call is the only history entry produced.

---

## Implementation

### `colorPalette.js`

**1. New constructor option (default `false`):**

```js
this.paletteConstrainedReduction = options.paletteConstrainedReduction === true;
```

**2. New branch in `applyColorReduction()` — insert after the `window.colorPalette.originalImageColors` block and immediately before the `const reducedColors = ColorUtils.reduceColors(...)` line. The surrounding context looks like:**

```js
// ... existing early-exit guard (gridColors.length <= targetCount) ...
// ... existing originalImageColors assignment block ...
if (this.paletteConstrainedReduction) {
    this._applyPaletteConstrainedReduction(targetCount);
    return;
}
const reducedColors = ColorUtils.reduceColors(gridColors, targetCount);  // immediately after
```

`_applyPaletteConstrainedReduction` returns before the `const reducedColors` line and before the trailing `updateColorCountDisplay()` call at the end of `applyColorReduction()`. Neither the k-means path nor the `isFixedPaletteMode` path (VoxelBlastJam) is reached for Website Import.

**3. New private method `_applyPaletteConstrainedReduction(targetN)`:** implements steps 1–7 above. Uses only `ColorUtils.normalizeHex`, `ColorUtils.findClosestColor`, `ColorUtils.colorDistance`, `ColorUtils.hexToRgb`, `this.hexGrid.getColorCounts()`, `this.hexGrid.applyColorMapping()`, `this.hexGrid.saveState()`, `this.createPaletteUI()`. Does not call `quantizeGridToFullPalette` or `syncFixedPaletteReductionResult`.

### `appWebsiteImport.js`

Add `paletteConstrainedReduction: true` to the `ColorPalette` constructor options.

---

## Isolation

| Page | `paletteConstrainedReduction` | Controlling path |
|------|-------------------------------|-----------------|
| WiggleTangle (`index.html`) | `false` (default) | existing `useDetectedColorsAsPalette` k-means path — unchanged |
| VoxelBlastJam | `false` (default) | existing `isFixedPaletteMode` path — unchanged |
| Website Import | `true` | new greedy path — returns before `isFixedPaletteMode` check |

---

## Edge Cases

| Situation | Behaviour |
| --- | --- |
| `targetN < 1` or NaN | Outer guard in `applyColorReduction()` fires before `_applyPaletteConstrainedReduction` is called; alert shown. |
| `targetN >= active.length` (after normalization) | Step 2a guard fires: alert shown, method returns without side effects. |
| Raw count > targetN but normalized count ≤ targetN | Outer early-exit does not fire (raw count > targetN); Step 2a guard catches it and shows alert. |
| `targetN = 1` | Greedy loop runs to completion; all cells map to one VBJ color. |
| Default color on grid | Included in `active`; can be dropped if it has minimum removal cost. |
| Tie in removal cost | Earliest candidate in `active` array order is removed (strict `<` keeps first minimum found). |
| Raw gemColors value not in colorMap | `applyColorMapping` skips it silently — cell keeps its color, which is correct for colors still in `active`. |

---

## Testing

Manual verification — `node dev-server.js` required:

1. Use the KandiPatterns bookmarklet on a pattern page to capture an image into Website Import. Confirm **Current** = N; every color in the Used column is a member of `full_color_palette_voxelblastjam.json`. (N includes the default white if white pixels appear in the pattern.)
2. Set **Target** = N − k, press **Apply**. Confirm:
   - **Current** drops to N − k.
   - Every color in the grid and in the Used column is a member of `full_color_palette_voxelblastjam.json`.
   - Used / Remaining palette columns update correctly.
   - Ctrl+Z reverts the grid (exactly one undo step).
3. Set **Target** = 1, press **Apply**. Confirm the entire grid fills with one VBJ color.
4. Open `voxelblastjam.html`, load an image, run Apply — confirm behavior is unchanged.
5. Open `index.html` (WiggleTangle), run Apply — confirm behavior is unchanged.
