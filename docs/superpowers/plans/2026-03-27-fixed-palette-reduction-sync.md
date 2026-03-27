# Fixed-Palette Reduction Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `Target -> Apply` so `Used / Remaining` and `Current` stay synchronized on fixed-palette pages, and update repository guidance to reflect the post-URL-Import state.

**Architecture:** Add a focused regression test around `ColorPalette.applyColorReduction()` using a small fake grid and a minimal DOM stub. Implement the runtime fix centrally in `js/colorPalette.js`, with an optional narrow history-control hook in `js/gemGrid.js` only if needed to keep one `Apply` interaction logically atomic. Then update `CLAUDE.md` and `AGENTS.md` to remove stale URL Import guidance and point local-server guidance at `dev-server.js`.

**Tech Stack:** Vanilla JavaScript, Node.js built-in test runner (`node --test`), minimal DOM stubs, static HTML docs, existing `ColorPalette` / `GemGrid` / `ColorUtils` runtime.

**Spec:** `docs/superpowers/specs/2026-03-27-fixed-palette-reduction-sync-design.md`

**Local-Changes Warning:** `website-import.html` and `js/appWebsiteImport.js` already have unrelated local edits in the current worktree. Do not modify or stage them while implementing this plan.

---

## File Map

- `tests/fixed-palette-reduction-sync.test.js`
  Purpose: regression tests for fixed-palette reduction sync and undo behavior.
- `js/colorPalette.js`
  Purpose: shared reduction flow, fixed-palette post-processing, palette UI rebuild, count refresh.
- `js/gemGrid.js`
  Purpose: optional tiny history-control extension only if required for atomic undo.
- `CLAUDE.md`
  Purpose: update local working guidance to remove URL Import and point Website Import to `dev-server.js`.
- `AGENTS.md`
  Purpose: update repository guidance to match current page set and local-server workflow.

---

## Task 1: Add Regression Tests For Fixed-Palette Reduction Sync

**Files:**
- Create: `tests/fixed-palette-reduction-sync.test.js`
- Read for context: `js/colorUtils.js`
- Read for context: `js/colorPalette.js`

- [ ] **Step 1: Create the failing regression test file**

Add `tests/fixed-palette-reduction-sync.test.js` with a minimal harness based on `node:test`, `node:assert/strict`, `node:fs`, and `node:vm`.

Use this structure:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createDocumentStub() {
    const elements = {
        targetColorCount: { value: '2' },
        currentColorCount: { textContent: '' },
        applyColorReduction: { addEventListener() {} },
        selectedColorHex: { addEventListener() {} }
    };

    return {
        getElementById(id) {
            if (!elements[id]) {
                elements[id] = {
                    addEventListener() {},
                    value: '',
                    textContent: ''
                };
            }
            return elements[id];
        }
    };
}

function createFakeGrid(initialGemColors) {
    return {
        defaultColor: '#FFFFFF',
        gemColors: { ...initialGemColors },
        history: [{ gemColors: { ...initialGemColors } }],
        historyIndex: 0,
        renderCount: 0,
        saveState() {
            this.history = this.history.slice(0, this.historyIndex + 1);
            this.history.push({ gemColors: { ...this.gemColors } });
            this.historyIndex = this.history.length - 1;
        },
        undo() {
            if (this.historyIndex > 0) {
                this.historyIndex -= 1;
                this.gemColors = { ...this.history[this.historyIndex].gemColors };
            }
        },
        redo() {
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex += 1;
                this.gemColors = { ...this.history[this.historyIndex].gemColors };
            }
        },
        render() {
            this.renderCount += 1;
        },
        getAllColors() {
            return Array.from(new Set(Object.values(this.gemColors)));
        },
        getColorCounts() {
            const counts = {};
            Object.values(this.gemColors).forEach((color) => {
                counts[color] = (counts[color] || 0) + 1;
            });
            return counts;
        },
        applyColorMapping(colorMap, options = {}) {
            if (options.saveHistory !== false) {
                this.saveState();
            }
            Object.keys(this.gemColors).forEach((key) => {
                if (colorMap[this.gemColors[key]]) {
                    this.gemColors[key] = colorMap[this.gemColors[key]];
                }
            });
            this.render();
        }
    };
}

function createHarness() {
    const document = createDocumentStub();
    const context = vm.createContext({
        console,
        document,
        window: {},
        alert() {},
        setTimeout(fn) { fn(); },
        clearTimeout() {}
    });

    ['js/colorUtils.js', 'js/colorPalette.js'].forEach((relativePath) => {
        const absolutePath = path.join(process.cwd(), relativePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        vm.runInContext(source, context, { filename: absolutePath });
    });

    return {
        context,
        document,
        ColorUtils: vm.runInContext('ColorUtils', context),
        ColorPalette: vm.runInContext('ColorPalette', context)
    };
}
```

- [ ] **Step 2: Add the fixed-palette failing test**

Add a first test that proves the bug:

```js
test('fixed-palette reduction re-quantizes and refreshes derived state', () => {
    const { document, ColorUtils, ColorPalette } = createHarness();
    const palette = Object.create(ColorPalette.prototype);
    palette.hexGrid = createFakeGrid({
        '0,0': '#101010',
        '1,0': '#202020',
        '0,1': '#202020',
        '1,1': '#303030'
    });
    palette.useTwoColumnPalette = true;
    palette.useFullPaletteAsDisplay = true;
    palette.useDetectedColorsAsPalette = false;
    palette.fullPalette = ['#111111', '#222222', '#333333'];
    palette.colors = [...palette.fullPalette];
    palette.originalImageColors = { '#101010': 1, '#202020': 2, '#303030': 1 };
    palette.createPaletteUI = function() {};
    palette.updateColorCountDisplay = ColorPalette.prototype.updateColorCountDisplay;
    palette.quantizeGridToFullPalette = ColorPalette.prototype.quantizeGridToFullPalette;

    const originalReduceColors = ColorUtils.reduceColors;
    ColorUtils.reduceColors = function() {
        return ['#101010', '#202020'];
    };

    try {
        ColorPalette.prototype.applyColorReduction.call(palette);

        const finalColors = Object.values(palette.hexGrid.gemColors);
        assert.ok(finalColors.every((color) => palette.fullPalette.includes(color)));
        assert.deepEqual(palette.originalImageColors, palette.hexGrid.getColorCounts());
        assert.equal(document.getElementById('currentColorCount').textContent, '2');
    } finally {
        ColorUtils.reduceColors = originalReduceColors;
    }
});
```

The current implementation should fail because it does not refresh the final snapped state for fixed-palette reduction.

- [ ] **Step 3: Add the non-fixed-palette safety test**

Add a second test that proves other pages keep their current behavior:

```js
test('non-fixed palette reduction does not force full-palette quantization', () => {
    const { document, ColorUtils, ColorPalette, context } = createHarness();
    const palette = Object.create(ColorPalette.prototype);
    palette.hexGrid = createFakeGrid({
        '0,0': '#101010',
        '1,0': '#202020',
        '0,1': '#202020',
        '1,1': '#303030'
    });
    palette.useTwoColumnPalette = false;
    palette.useFullPaletteAsDisplay = false;
    palette.useDetectedColorsAsPalette = true;
    palette.fullPalette = ['#111111', '#222222', '#333333'];
    palette.colors = ['#AAAAAA', '#BBBBBB', '#CCCCCC'];
    palette.originalImageColors = {};
    palette.createPaletteUI = function() {};
    palette.updateColorCountDisplay = ColorPalette.prototype.updateColorCountDisplay;
    palette.quantizeGridToFullPalette = function() {
        throw new Error('fixed-palette sync path should not run');
    };
    context.window.colorPalette = palette;

    const originalReduceColors = ColorUtils.reduceColors;
    ColorUtils.reduceColors = function() {
        return ['#101010', '#202020'];
    };

    try {
        ColorPalette.prototype.applyColorReduction.call(palette);
        assert.deepEqual(palette.colors, ['#101010', '#202020']);
    } finally {
        ColorUtils.reduceColors = originalReduceColors;
    }
});
```

- [ ] **Step 4: Run the new tests to verify they fail for the right reason**

Run:

```bash
node --test tests/fixed-palette-reduction-sync.test.js
```

Expected:
- at least the fixed-palette sync test fails
- the failures point to missing post-reduction sync / history control, not a broken harness

- [ ] **Step 5: Commit the failing regression tests**

```bash
git add tests/fixed-palette-reduction-sync.test.js
git commit -m "test: add fixed palette reduction sync regression coverage"
```

---

## Task 2: Implement Fixed-Palette Post-Reduction Sync

**Files:**
- Modify: `js/colorPalette.js`
- Modify only if needed: `js/gemGrid.js`
- Test: `tests/fixed-palette-reduction-sync.test.js`

- [ ] **Step 1: Add a mode predicate and post-reduction sync helper in `js/colorPalette.js`**

Add two focused helpers near `applyColorReduction()`:

```js
usesFixedTwoColumnFullPalette() {
    return this.useTwoColumnPalette === true &&
        this.useFullPaletteAsDisplay === true &&
        Array.isArray(this.fullPalette) &&
        this.fullPalette.length > 0;
}

syncFixedPaletteReductionResult() {
    this.quantizeGridToFullPalette({ saveHistory: false });
    this.originalImageColors = { ...this.hexGrid.getColorCounts() };
    this.createPaletteUI({ skipGridSave: true });
    this.updateColorCountDisplay();
}
```

Do not touch non-fixed-palette flows in this step.

- [ ] **Step 2: Add narrow history-control options where needed**

If the tests require it, make the smallest possible history-control change:

In `js/gemGrid.js`:

```js
applyColorMapping(colorMap, options = {}) {
    if (options.saveHistory !== false) {
        this.saveState();
    }
    // existing mapping loop...
}
```

In `js/colorPalette.js`, extend `quantizeGridToFullPalette()` similarly:

```js
quantizeGridToFullPalette(options = {}) {
    const saveHistory = options.saveHistory !== false;
    // existing quantize logic...
    if (changed) {
        this.hexGrid.render();
        if (saveHistory) {
            this.hexGrid.saveState();
        }
    }
}
```

Do not widen `js/gemGrid.js` beyond this option hook unless a test proves it is necessary.

- [ ] **Step 3: Update `applyColorReduction()` to use the fixed-palette sync path**

Refactor `applyColorReduction()` so the fixed-palette branch:

1. computes `reducedColors`
2. builds `colorMap`
3. applies the mapping without creating an extra pre-history save
4. re-quantizes into the full VoxelBlastJam palette
5. refreshes `originalImageColors`, `Used / Remaining`, and `Current`
6. records one final post-Apply history state

Target shape:

```js
const isFixedPaletteMode = this.usesFixedTwoColumnFullPalette();

this.hexGrid.applyColorMapping(colorMap, {
    saveHistory: !isFixedPaletteMode
});

if (this.useDetectedColorsAsPalette) {
    this.colors = reducedColors;
    this.createPaletteUI();
} else if (isFixedPaletteMode) {
    this.syncFixedPaletteReductionResult();
} else if (this.useTwoColumnPalette) {
    this.createPaletteUI({ skipGridSave: true });
    this.updateColorCountDisplay();
}

if (isFixedPaletteMode) {
    this.hexGrid.saveState();
} else {
    setTimeout(() => {
        this.hexGrid.saveState();
    }, 0);
}
```

Important:
- keep the non-fixed-palette path behavior unchanged
- do not touch `website-import.html` or `js/appWebsiteImport.js`

- [ ] **Step 4: Run the regression tests and make them pass**

Run:

```bash
node --test tests/fixed-palette-reduction-sync.test.js
```

Expected:
- all tests in the file pass

- [ ] **Step 5: Run syntax checks for touched runtime files**

Run:

```bash
node --check js/colorPalette.js
node --check js/gemGrid.js
```

Expected: both exit successfully

- [ ] **Step 6: Commit the runtime fix**

```bash
git add tests/fixed-palette-reduction-sync.test.js js/colorPalette.js js/gemGrid.js
git commit -m "fix: sync fixed palette reduction state"
```

If `js/gemGrid.js` was not touched, omit it from `git add`.

---

## Task 3: Add History Regression Coverage If The New Sync Path Creates Extra History States

**Files:**
- Modify: `tests/fixed-palette-reduction-sync.test.js`
- Modify only if needed: `js/colorPalette.js`
- Modify only if needed: `js/gemGrid.js`

- [ ] **Step 1: Check whether the new fixed-palette sync path introduced duplicate history states**

Use the now-passing Task 1 harness to inspect actual post-implementation history behavior.

Add a focused failing test only if needed:

```js
test('fixed-palette reduction records one logical Apply action', () => {
    // same harness as earlier tests
    // after applyColorReduction(), assert one undo restores the exact pre-Apply state
    // and one redo restores the exact post-Apply state
});
```

This task exists because the current pre-fix behavior may already satisfy the simple undo assertion. Do not force an artificial failing test before proving the new sync path actually creates a history problem.

- [ ] **Step 2: If the new test fails, add the smallest history fix**

Allowed scope:
- `js/colorPalette.js`
- `js/gemGrid.js` only for the narrow option hook already defined in Task 2

Goal:
- one `Apply` should behave like one logical action from undo/redo
- avoid duplicate post-Apply history states introduced by the new fixed-palette sync flow

- [ ] **Step 3: Re-run the targeted regression test**

Run:

```bash
node --test tests/fixed-palette-reduction-sync.test.js
```

Expected:
- all tests pass

- [ ] **Step 4: Commit only if a history fix was actually needed**

```bash
git add tests/fixed-palette-reduction-sync.test.js js/colorPalette.js js/gemGrid.js
git commit -m "fix: preserve atomic undo for fixed palette reduction"
```

If no history change was needed, skip this commit.

---

## Task 4: Update Repository Guidance

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update `CLAUDE.md` to remove URL Import guidance**

Replace outdated guidance with the current state:

- local server guidance should point to `node dev-server.js`
- Website Import should mention `/proxy/html` and `/proxy/image`
- remove the URL Import entry page row
- remove `js/appUrlImport.js` and `js/urlFetcher.js` from module descriptions
- update testing guidance to mention `Website Import` instead of `URL Import`

Expected command/documentation examples:

```md
node dev-server.js
# Opens at http://localhost:8000

`dev-server.js` is required when working on Website Import because it provides
the `/proxy/html` and `/proxy/image` endpoints.
```

- [ ] **Step 2: Update `AGENTS.md` to match the remaining app structure**

Update:

- project structure to reflect the current entry pages:
  - `index.html`
  - `voxelblastjam.html`
  - `pattern-import.html`
  - `image-extractor.html`
  - `website-import.html`
- page-specific bootstraps to reflect the remaining runtime files:
  - `js/appGem.js`
  - `js/appVoxel.js`
  - `js/appPattern.js`
  - `js/imageExtractor.js`
  - `js/appWebsiteImport.js`
- build/test command guidance to use `node dev-server.js` for Website Import
- testing guidance to remove any stale URL Import expectations
- stale absolute `/Users/hasan/...` file links should be replaced with current-repo-relative guidance

Do not broaden these files beyond the spec scope.

- [ ] **Step 3: Run a focused reference search on the updated guidance**

Run:

```bash
rg -n 'URL Import|url-import|appUrlImport|urlFetcher|/proxy\\?url' CLAUDE.md AGENTS.md || :
```

Expected:
- no stale URL Import/runtime references remain in these two files

- [ ] **Step 4: Commit the guidance cleanup**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: update guidance for website import workflow"
```

---

## Task 5: Final Verification

**Files:**
- Verify: `tests/fixed-palette-reduction-sync.test.js`
- Verify: `js/colorPalette.js`
- Verify: `js/gemGrid.js`
- Verify: `CLAUDE.md`
- Verify: `AGENTS.md`
- Verify only, do not edit: `website-import.html`
- Verify only, do not edit: `js/appWebsiteImport.js`

- [ ] **Step 1: Run the automated verification set**

Run:

```bash
node --test tests/fixed-palette-reduction-sync.test.js
node --check js/colorPalette.js
node --check js/gemGrid.js
git diff --check
```

Expected:
- test file passes
- syntax checks pass
- `git diff --check` prints nothing

- [ ] **Step 2: Manual smoke-test VoxelBlastJam**

Start the correct dev server:

```bash
PORT=8765 node dev-server.js
```

Open:

```text
http://localhost:8765/voxelblastjam.html
```

Manual flow:
- load any small multicolor image or grid so `Used / Remaining` is active
- note the current `Used` colors and `Current` count
- lower `Target`
- click `Apply`
- confirm the `Used` column updates immediately
- confirm `Current` matches the final visible grid colors
- click `Undo` once
- confirm the grid returns to the pre-Apply state

- [ ] **Step 3: Manual smoke-test Website Import**

Open:

```text
http://localhost:8765/website-import.html
```

Manual flow:
- complete one successful Website Import capture/import so `Used / Remaining` is active
- lower `Target`
- click `Apply`
- confirm the `Used` column updates immediately
- confirm `Current` matches the final visible grid colors
- click `Undo` once
- confirm the grid returns to the pre-Apply state

Do not modify or overwrite the unrelated local edits already present in `website-import.html` and `js/appWebsiteImport.js`.

- [ ] **Step 4: Check the final tracked working tree state**

Run:

```bash
git status --short --branch --untracked-files=no
git log --oneline --decorate -n 5
```

Expected:
- the commits from this plan are present as new work
- `website-import.html` and `js/appWebsiteImport.js` may still appear as unrelated pre-existing tracked edits and must remain untouched by this plan
- no additional unexpected tracked file changes remain beyond those known local edits

- [ ] **Step 5: Commit any final verification-only adjustments if required**

Only if verification surfaced a legitimate fix:

```bash
git add <touched-files>
git commit -m "fix: polish fixed palette reduction sync"
```

Otherwise skip this step.
