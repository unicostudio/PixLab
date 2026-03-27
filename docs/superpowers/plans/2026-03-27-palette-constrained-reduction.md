# Palette-Constrained Color Reduction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the k-means color reduction on Website Import with a greedy algorithm that only ever uses VoxelBlastJam palette colors present on the grid.

**Architecture:** Add a `paletteConstrainedReduction` boolean option to `ColorPalette`. When `true`, `applyColorReduction()` delegates to a new private method `_applyPaletteConstrainedReduction(targetN)` that implements a greedy iterative removal loop operating entirely on VBJ palette colors. All other pages remain unaffected because the option defaults to `false`.

**Tech Stack:** Vanilla JS, no build step. `node --check` for syntax validation. `node dev-server.js` for manual browser testing.

---

## Chunk 1: `colorPalette.js` — constructor flag + branch + new method

**Files:**
- Modify: `js/colorPalette.js`

### Task 1: Add `paletteConstrainedReduction` constructor option

- [ ] **Step 1: Add the option read in the constructor**

  In [js/colorPalette.js](js/colorPalette.js), find the constructor options block (lines 15–24). Add this line **after** the `this.useTwoColumnPalette` line (line 21):

  ```js
  this.paletteConstrainedReduction = options.paletteConstrainedReduction === true;
  ```

  The constructor block should now look like:
  ```js
  this.palettePath = options.palettePath;
  this.allowColorPicker = options.allowColorPicker !== false;
  this.allowHexEditing = options.allowHexEditing !== false;
  this.useDetectedColorsAsPalette = options.useDetectedColorsAsPalette !== false;
  this.useFullPaletteAsDisplay = options.useFullPaletteAsDisplay === true;
  this.allowLoadedPaletteOverride = options.allowLoadedPaletteOverride !== false;
  this.useTwoColumnPalette = options.useTwoColumnPalette === true;
  this.paletteConstrainedReduction = options.paletteConstrainedReduction === true;
  ```

- [ ] **Step 2: Syntax-check the file**

  ```bash
  node --check js/colorPalette.js
  ```

  Expected: no output (clean).

---

### Task 2: Add the branch in `applyColorReduction()`

- [ ] **Step 1: Locate the insertion point**

  In [js/colorPalette.js](js/colorPalette.js), find `applyColorReduction()` (~line 463). The block structure inside it is:

  ```js
  // ~lines 476-479: originalImageColors read block
  let originalImageColors = [];
  if (window.colorPalette && window.colorPalette.originalImageColors) {
      originalImageColors = Object.keys(window.colorPalette.originalImageColors);
  }

  // ~lines 481-484: early-exit guard
  if (gridColors.length <= targetCount) {
      alert(`The grid already uses ${gridColors.length} colors, ...`);
      return;
  }

  // ~line 487: k-means path starts here
  const reducedColors = ColorUtils.reduceColors(gridColors, targetCount);
  ```

- [ ] **Step 2: Insert the new branch between the early-exit guard and `const reducedColors`**

  Replace the single existing line:
  ```js
          const reducedColors = ColorUtils.reduceColors(gridColors, targetCount);
  ```

  With:
  ```js
          if (this.paletteConstrainedReduction) {
              this._applyPaletteConstrainedReduction(targetCount);
              return;
          }

          const reducedColors = ColorUtils.reduceColors(gridColors, targetCount);
  ```

- [ ] **Step 3: Syntax-check**

  ```bash
  node --check js/colorPalette.js
  ```

  Expected: no output.

---

### Task 3: Implement `_applyPaletteConstrainedReduction(targetN)`

- [ ] **Step 1: Add the method to the class**

  In [js/colorPalette.js](js/colorPalette.js), add this method **immediately after** the closing `}` of `applyColorReduction()` (before `updateColorCountDisplay()`):

  ```js
  _applyPaletteConstrainedReduction(targetN) {
      // Step 1 — Build normalized color counts and raw-key map
      const rawCounts = this.hexGrid.getColorCounts();
      const colorCounts = {};
      const rawToNorm = {};

      Object.keys(rawCounts).forEach(function(rawColor) {
          const norm = ColorUtils.normalizeHex(rawColor);
          rawToNorm[rawColor] = norm;
          colorCounts[norm] = (colorCounts[norm] || 0) + rawCounts[rawColor];
      });

      // Step 2 — Initialize active set
      let active = Object.keys(colorCounts);

      // Step 2a — Normalized early-exit guard
      if (active.length <= targetN) {
          alert('Already at or below target color count.');
          return;
      }

      // Step 3 — Greedy loop (operates purely in-memory; does not touch gemColors)
      while (active.length > targetN) {
          let minCost = Infinity;
          let minIndex = 0;
          let minAlternative = null;

          for (let i = 0; i < active.length; i++) {
              const c = active[i];
              const others = active.filter(function(x) { return x !== c; });
              const alternative = ColorUtils.findClosestColor(c, others);
              const removalCost = colorCounts[c] * ColorUtils.colorDistance(
                  ColorUtils.hexToRgb(c),
                  ColorUtils.hexToRgb(alternative)
              );
              if (removalCost < minCost) {
                  minCost = removalCost;
                  minIndex = i;
                  minAlternative = alternative;
              }
          }

          const removed = active[minIndex];
          active.splice(minIndex, 1);
          colorCounts[minAlternative] += colorCounts[removed];
          delete colorCounts[removed];
      }

      // Step 4 — Build colorMap keyed by raw gemColors values
      // colorMap values are always members of active (normalized uppercase hex)
      const activeSet = new Set(active);
      const colorMap = {};
      Object.keys(rawToNorm).forEach(function(rawColor) {
          const norm = rawToNorm[rawColor];
          if (!activeSet.has(norm)) {
              colorMap[rawColor] = ColorUtils.findClosestColor(norm, active);
          }
      });

      // Step 5 — Apply mapping (applyColorMapping calls render() internally)
      this.hexGrid.applyColorMapping(colorMap, { saveHistory: false });

      // Step 6 — Lean UI refresh (do NOT call syncFixedPaletteReductionResult)
      this.originalImageColors = Object.assign({}, this.hexGrid.getColorCounts());
      this.createPaletteUI({ skipGridSave: true });

      // Step 7 — Single synchronous undo entry
      this.hexGrid.saveState();
  }
  ```

- [ ] **Step 2: Syntax-check**

  ```bash
  node --check js/colorPalette.js
  ```

  Expected: no output.

- [ ] **Step 3: Commit Chunk 1**

  ```bash
  git add js/colorPalette.js
  git commit -m "feat: add paletteConstrainedReduction greedy reduction to ColorPalette"
  ```

---

## Chunk 2: `appWebsiteImport.js` — wire option + manual tests

**Files:**
- Modify: `js/appWebsiteImport.js`

### Task 4: Enable the option on Website Import

- [ ] **Step 1: Add `paletteConstrainedReduction: true` to the ColorPalette constructor call**

  In [js/appWebsiteImport.js](js/appWebsiteImport.js), find the `new ColorPalette(...)` call (~line 630). Change:

  ```js
  appStateRef.colorPalette = new ColorPalette('colorPaletteContainer', appStateRef.gemGrid, {
      palettePath: 'full_color_palette_voxelblastjam.json',
      allowColorPicker: false,
      allowHexEditing: false,
      useDetectedColorsAsPalette: false,
      useFullPaletteAsDisplay: true,
      allowLoadedPaletteOverride: false,
      useTwoColumnPalette: true
  });
  ```

  To:

  ```js
  appStateRef.colorPalette = new ColorPalette('colorPaletteContainer', appStateRef.gemGrid, {
      palettePath: 'full_color_palette_voxelblastjam.json',
      allowColorPicker: false,
      allowHexEditing: false,
      useDetectedColorsAsPalette: false,
      useFullPaletteAsDisplay: true,
      allowLoadedPaletteOverride: false,
      useTwoColumnPalette: true,
      paletteConstrainedReduction: true
  });
  ```

- [ ] **Step 2: Syntax-check both modified files**

  ```bash
  node --check js/colorPalette.js && node --check js/appWebsiteImport.js
  ```

  Expected: no output.

---

### Task 5: Manual browser verification

Start the dev server:

```bash
node dev-server.js
```

Then open `http://localhost:3000/website-import.html` in a browser and follow these checks:

- [ ] **Check A — Baseline after import**

  Use the KandiPatterns bookmarklet on a KandiPatterns pattern page (e.g., `https://kandipatterns.com/patterns/misc/pretzel-62072`). After the pattern loads and the VBJ palette is auto-applied:
  - **Current** color count = N (some number > 1).
  - Every color swatch in the Used column is a recognizable VBJ color (cross-check a few against `full_color_palette_voxelblastjam.json`).

- [ ] **Check B — Reduction stays in-palette**

  Set **Target** = N − 1, press **Apply**.
  - **Current** drops to N − 1.
  - Every remaining color in the Used column is still a VBJ palette member (no arbitrary RGB values).
  - The grid visually updates with correct color assignments.
  - The Used column shows exactly N − 1 colors; the Remaining column shows the rest of the VBJ palette. No dropped colors appear in the Used column.

- [ ] **Check C — Undo produces exactly one step**

  Press Ctrl+Z (or Cmd+Z on Mac).
  - The grid reverts to its N-color state.
  - Press Ctrl+Z again — nothing changes (only one undo entry was produced).

- [ ] **Check D — Reduce to 1**

  Press Ctrl+Y (redo or re-apply) to get back to N − 1 colors, then set **Target** = 1, press **Apply**.
  - The entire grid fills with a single VBJ color.
  - **Current** = 1.

- [ ] **Check E — VoxelBlastJam page is unaffected**

  Open `http://localhost:3000/voxelblastjam.html`, load an image, set a target, press **Apply**.
  - Color reduction still works as before (k-means → snap to VBJ).
  - No regressions in behavior.

- [ ] **Check F — WiggleTangle page is unaffected**

  Open `http://localhost:3000/index.html`, load an image, set a target, press **Apply**.
  - Color reduction works as before (k-means with detected colors).
  - No regressions.

---

### Task 6: Commit and finish

- [ ] **Step 1: Commit Chunk 2**

  ```bash
  git add js/appWebsiteImport.js
  git commit -m "feat: enable palette-constrained reduction on website-import"
  ```

- [ ] **Step 2: Verify clean working tree**

  ```bash
  git diff --check && git status
  ```

  Expected: clean.
