# URL Import Page — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new `url-import.html` page that loads a pixel art pattern from a kandipatterns.com URL, extracts size metadata from the page HTML, and provides all VoxelBlastJam editing features.

**Architecture:** Three new files (`url-import.html`, `js/urlFetcher.js`, `js/appUrlImport.js`) follow the existing VoxelBlast page pattern exactly. URL fetching and HTML parsing are isolated in `urlFetcher.js`. Page logic in `appUrlImport.js` delegates to `PixLabApp.initializeSharedApp` (unchanged). All four existing nav HTML files get a new nav link.

**Tech Stack:** Vanilla JS, HTML5 Canvas, `api.allorigins.win` CORS proxy, existing `GemGrid` / `ColorPalette` / `ImageProcessor` infrastructure.

**Spec:** `docs/superpowers/specs/2026-03-27-urlimport-design.md`

> **Note on file names:** The spec was written with `pattern-import.html` / `appPatternImport.js` as placeholders. After brainstorming we discovered `pattern-import.html` already exists with different functionality (JSON pattern import). This plan therefore uses `url-import.html` / `appUrlImport.js` — same design, different file names.

---

## Chunk 1: urlFetcher.js — URL utilities

**Files:**
- Create: `js/urlFetcher.js`

---

### Task 1: Scaffold UrlFetcher and implement `extractSlug`

**Files:**
- Create: `js/urlFetcher.js`

- [ ] **Step 1: Create `js/urlFetcher.js` with the full module scaffold and `extractSlug`**

```js
/**
 * URL fetching and parsing utilities for the URL Import page.
 */
const UrlFetcher = (function() {

    /**
     * Extract slug from URL: last non-empty path segment, extension stripped.
     * e.g. "https://kandipatterns.com/patterns/misc/pretzel-62072" → "pretzel-62072"
     * e.g. "https://example.com/foo/bar.png" → "bar"
     * @param {string} url
     * @returns {string}
     */
    function extractSlug(url) {
        try {
            const pathname = new URL(url).pathname;
            const segments = pathname.split('/').filter(function(s) { return s.length > 0; });
            if (segments.length === 0) return 'pattern';
            const last = segments[segments.length - 1];
            const dotIndex = last.lastIndexOf('.');
            return dotIndex > 0 ? last.slice(0, dotIndex) : last;
        } catch (e) {
            return 'pattern';
        }
    }

    /**
     * Fetch page HTML via allorigins CORS proxy.
     * Rejects if the fetch fails or the response status is not ok.
     * @param {string} url
     * @returns {Promise<string>} page HTML
     */
    function fetchPageHtml(url) {
        const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
        return fetch(proxyUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Proxy request failed: ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                if (!data || typeof data.contents !== 'string') {
                    throw new Error('Unexpected proxy response format.');
                }
                return data.contents;
            });
    }

    /**
     * Parse cols and rows from HTML string.
     * Looks for "50 columns wide x 50 rows tall" pattern.
     * @param {string} html
     * @returns {{ cols: number, rows: number }|null}
     */
    function parsePatternSize(html) {
        const match = html.match(/(\d+)\s+columns?\s+wide\s+x\s+(\d+)\s+rows?\s+tall/i);
        if (!match) return null;
        const cols = parseInt(match[1], 10);
        const rows = parseInt(match[2], 10);
        if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) return null;
        return { cols: cols, rows: rows };
    }

    /**
     * Find main pattern image URL from HTML string.
     * Priority: first <img src> containing "/patterns/" in the path.
     * Fallback: first <img src> ending in .png, .jpg, or .gif.
     * Resolves relative URLs against baseUrl.
     * @param {string} html
     * @param {string} baseUrl
     * @returns {string|null}
     */
    function extractImageUrl(html, baseUrl) {
        const imgRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
        let match;
        const candidates = [];

        while ((match = imgRegex.exec(html)) !== null) {
            candidates.push(match[1]);
        }

        // Priority: src containing "/patterns/"
        let found = candidates.find(function(src) {
            return src.indexOf('/patterns/') !== -1;
        });

        // Fallback: first image ending in .png, .jpg, .gif
        if (!found) {
            found = candidates.find(function(src) {
                return /\.(png|jpg|jpeg|gif)(\?|$)/i.test(src);
            });
        }

        if (!found) return null;

        // Resolve relative URLs
        try {
            return new URL(found, baseUrl).href;
        } catch (e) {
            return found;
        }
    }

    /**
     * Return a proxied image URL safe for canvas use (avoids CORS taint).
     * @param {string} imageUrl
     * @returns {string}
     */
    function proxyImageUrl(imageUrl) {
        return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(imageUrl);
    }

    return {
        extractSlug: extractSlug,
        fetchPageHtml: fetchPageHtml,
        parsePatternSize: parsePatternSize,
        extractImageUrl: extractImageUrl,
        proxyImageUrl: proxyImageUrl
    };
})();
```

- [ ] **Step 2: Verify `extractSlug` in browser console**

Open any existing PixLab page in the browser and run in the console (after temporarily including the script):

```js
// Test cases — expected results shown in comments
UrlFetcher.extractSlug('https://kandipatterns.com/patterns/misc/pretzel-62072'); // "pretzel-62072"
UrlFetcher.extractSlug('https://example.com/foo/bar.png');                        // "bar"
UrlFetcher.extractSlug('https://example.com/');                                   // "pattern"
UrlFetcher.extractSlug('not-a-url');                                              // "pattern"
```

All four should return the expected values.

- [ ] **Step 3: Verify `parsePatternSize` in browser console**

```js
UrlFetcher.parsePatternSize('<td valign="center">50 columns wide x 50 rows tall</td>');
// Expected: { cols: 50, rows: 50 }

UrlFetcher.parsePatternSize('<td>72 columns wide x 40 rows tall</td>');
// Expected: { cols: 72, rows: 40 }

UrlFetcher.parsePatternSize('<td>no size here</td>');
// Expected: null
```

- [ ] **Step 4: Commit**

```bash
git add js/urlFetcher.js
git commit -m "feat: add UrlFetcher utility module for URL import page"
```

---

## Chunk 2: url-import.html — Page HTML

**Files:**
- Create: `url-import.html`
- Modify: `index.html` (nav link)
- Modify: `voxelblastjam.html` (nav link)
- Modify: `pattern-import.html` (nav link)
- Modify: `image-extractor.html` (nav link)

---

### Task 2: Create `url-import.html`

- [ ] **Step 1: Create `url-import.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PixLab - URL Import</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <div class="app-container">
        <header>
            <h1>PixLab</h1>
            <nav class="page-nav">
                <a class="page-link" href="index.html">WiggleTangle</a>
                <a class="page-link" href="voxelblastjam.html">VoxelBlastJam</a>
                <a class="page-link" href="pattern-import.html">Pattern Import</a>
                <a class="page-link" href="image-extractor.html">Image Extractor</a>
                <a class="page-link is-active" href="url-import.html">URL Import</a>
            </nav>
        </header>

        <div class="main-content">
            <div class="left-panel">
                <div class="color-count-controls">
                    <h3>Total Colors</h3>
                    <div class="control-group">
                        <label for="currentColorCount">Current:</label>
                        <span id="currentColorCount" class="color-count">0</span>
                    </div>
                    <div class="control-group">
                        <label for="targetColorCount">Target:</label>
                        <input type="number" id="targetColorCount" min="1" max="120" value="10">
                        <button id="applyColorReduction" type="button">Apply</button>
                    </div>
                    <div class="control-group">
                        <button id="clearSelection" class="action-button" type="button">Clear Selection</button>
                    </div>
                    <div class="history-controls">
                        <div class="history-buttons" style="visibility: hidden;">
                            <button id="undoButton" class="action-button" type="button">← Undo</button>
                            <button id="redoButton" class="action-button" type="button">Redo →</button>
                        </div>
                    </div>
                </div>

                <div class="color-count-controls">
                    <h3>Size</h3>
                    <div class="control-group">
                        <label for="gridCols">Cols:</label>
                        <input type="number" id="gridCols" min="1" max="500" value="50" style="width:52px">
                        <label for="gridRows">Rows:</label>
                        <input type="number" id="gridRows" min="1" max="500" value="50" style="width:52px">
                    </div>
                    <div class="control-group">
                        <button id="applyGridSize" type="button">Apply Size</button>
                    </div>
                </div>

                <div class="action-panel">
                    <h3>Actions</h3>
                    <div class="grid-controls">
                        <button id="clearGrid" type="button">Clear Grid</button>
                        <button id="exportPNG" type="button">Export PNG</button>
                        <button style="display: none;" id="savePNG" type="button">Save PNG</button>
                        <button id="savePixelGrid" type="button">Save 50x50 PNG</button>
                        <button id="saveGrid" type="button">Save Grid</button>
                        <button id="loadGrid" type="button">Load Grid</button>
                    </div>
                    <div class="control-group" style="margin-top: 8px;">
                        <input
                            type="text"
                            id="urlInput"
                            placeholder="https://kandipatterns.com/..."
                            style="width: 100%; box-sizing: border-box;"
                        >
                    </div>
                    <div class="control-group">
                        <button id="loadFromUrl" type="button" style="width: 100%;">Load from URL</button>
                    </div>
                    <div id="urlLoadStatus" style="font-size: 11px; color: #c88; margin-top: 4px; min-height: 16px;"></div>
                    <div class="control-group" style="display: none;" id="directImageUrlGroup">
                        <label for="directImageUrl" style="font-size: 11px;">Direct image URL:</label>
                        <input
                            type="text"
                            id="directImageUrl"
                            placeholder="https://example.com/image.png"
                            style="width: 100%; box-sizing: border-box; font-size: 11px;"
                        >
                    </div>
                </div>
            </div>

            <div class="middle-panel">
                <div class="grid-container">
                    <canvas id="gemGrid" width="800" height="600"></canvas>
                </div>
            </div>

            <div class="right-panel">
                <div class="color-palette">
                    <h3>Color Palette</h3>
                    <div class="selected-color-display">
                        <div class="selected-color-preview" id="selectedColorPreview"></div>
                        <div class="selected-color-hex" id="selectedColorHex" title="Click to copy">#FFFFFF</div>
                    </div>
                    <div id="colorPaletteContainer"></div>
                </div>
            </div>
        </div>

        <div id="colorPickerModal" class="modal">
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h3>Color Picker</h3>
                <div class="color-wheel-container">
                    <canvas id="colorWheel" width="300" height="300"></canvas>
                </div>
                <div class="color-preview">
                    <div class="preview-group">
                        <label>Selected Color:</label>
                        <div id="colorPreview"></div>
                    </div>
                    <div class="preview-group">
                        <label>Hex Code:</label>
                        <input type="text" id="hexInput" maxlength="7">
                    </div>
                </div>
                <div class="modal-buttons">
                    <button id="saveColor" type="button">Save Color</button>
                    <button id="cancelColor" type="button">Cancel</button>
                </div>
            </div>
        </div>
    </div>

    <script src="js/colorUtils.js"></script>
    <script src="js/gemGrid.js"></script>
    <script src="js/colorPalette.js"></script>
    <script src="js/colorPicker.js"></script>
    <script src="js/imageProcessing.js"></script>
    <script src="js/urlFetcher.js"></script>
    <script src="js/appShared.js"></script>
    <script src="js/appUrlImport.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add "URL Import" nav link to all four existing pages**

In `index.html`, add after the last `<a class="page-link"...>` in `<nav class="page-nav">`:
```html
<a class="page-link" href="url-import.html">URL Import</a>
```

In `voxelblastjam.html`, same addition.

In `pattern-import.html`, same addition.

In `image-extractor.html`, same addition.

- [ ] **Step 3: Verify page loads without JS errors**

Open `url-import.html` in the browser. Because `js/appUrlImport.js` doesn't exist yet, the page will show a network error for that script — that is expected at this stage. All other scripts should load. Verify in DevTools Network tab that `colorUtils.js`, `gemGrid.js`, `colorPalette.js`, `colorPicker.js`, `imageProcessing.js`, `urlFetcher.js`, `appShared.js` all return 200.

- [ ] **Step 4: Commit**

```bash
git add url-import.html index.html voxelblastjam.html pattern-import.html image-extractor.html
git commit -m "feat: add URL Import page HTML and update nav links"
```

---

## Chunk 3: appUrlImport.js — Page logic

**Files:**
- Create: `js/appUrlImport.js`

---

### Task 3: Core scaffold — replaceGrid, size controls, savePixelGrid

- [ ] **Step 1: Create `js/appUrlImport.js` with scaffold, `replaceGrid`, size controls**

```js
/**
 * URL Import page bootstrap.
 */

document.addEventListener('DOMContentLoaded', function() {
    var currentSlug = 'pattern';
    var isLoading = false;

    // ── Grid helpers ──────────────────────────────────────────────────────────

    function createGemGrid(cols, rows) {
        return new GemGrid('gemGrid', cols, rows);
    }

    /**
     * Replace the current grid with a new one of the given dimensions.
     * Distinct from appVoxel.js's replaceGrid — supports rectangular grids.
     */
    function replaceGrid(appState, cols, rows) {
        if (appState.gemGrid) {
            appState.gemGrid.destroy();
        }
        appState.gemGrid = createGemGrid(cols, rows);
        appState.colorPalette.setGrid(appState.gemGrid);
        appState.gemGrid.saveState();
        syncSizeUI(appState.gemGrid);
    }

    function syncSizeUI(gemGrid) {
        document.getElementById('gridCols').value = String(gemGrid.cols);
        document.getElementById('gridRows').value = String(gemGrid.rows);
        document.getElementById('savePixelGrid').textContent =
            'Save ' + gemGrid.cols + 'x' + gemGrid.rows + ' PNG';
    }

    function gridHasUserContent(gemGrid) {
        return Object.values(gemGrid.gemColors).some(function(color) {
            return color !== gemGrid.defaultColor;
        });
    }

    // ── Size validation ───────────────────────────────────────────────────────

    function validateSize(colsStr, rowsStr) {
        var cols = parseInt(colsStr, 10);
        var rows = parseInt(rowsStr, 10);
        if (!Number.isInteger(cols) || cols < 1 || cols > 500) return null;
        if (!Number.isInteger(rows) || rows < 1 || rows > 500) return null;
        return { cols: cols, rows: rows };
    }

    // ── bindExtraControls ─────────────────────────────────────────────────────

    function bindApplyGridSize(appState, helpers) {
        document.getElementById('applyGridSize').addEventListener('click', function() {
            var size = validateSize(
                document.getElementById('gridCols').value,
                document.getElementById('gridRows').value
            );
            if (!size) {
                alert('Invalid size — enter cols and rows between 1 and 500.');
                syncSizeUI(appState.gemGrid);
                return;
            }
            if (size.cols === appState.gemGrid.cols && size.rows === appState.gemGrid.rows) {
                return;
            }
            if (gridHasUserContent(appState.gemGrid) &&
                !confirm('Changing grid size will clear the current grid. Continue?')) {
                syncSizeUI(appState.gemGrid);
                return;
            }
            helpers.resetDerivedImageState();
            replaceGrid(appState, size.cols, size.rows);
        });
    }

    function bindSavePixelGrid(appState) {
        document.getElementById('savePixelGrid').addEventListener('click', function() {
            try {
                var dataURL = appState.gemGrid.exportPixelGridPNG();
                var filename = currentSlug + '_' +
                    appState.gemGrid.cols + 'x' + appState.gemGrid.rows + '.png';
                var link = document.createElement('a');
                link.href = dataURL;
                link.download = filename;
                link.click();
            } catch (error) {
                alert('Export error: ' + error.message);
            }
        });
    }

    // ── App init ──────────────────────────────────────────────────────────────

    PixLabApp.initializeSharedApp({
        palettePath: 'full_color_palette_voxelblastjam.json',
        enableColorPicker: false,
        colorPaletteOptions: {
            allowColorPicker: false,
            allowHexEditing: false,
            useDetectedColorsAsPalette: false,
            useFullPaletteAsDisplay: true,
            allowLoadedPaletteOverride: false,
            useTwoColumnPalette: true
        },
        createGrid: function() {
            return createGemGrid(50, 50);
        },
        bindExtraControls: function(appState, helpers) {
            bindApplyGridSize(appState, helpers);
            bindSavePixelGrid(appState);
            // URL load binding added in Task 4
        },
        loadGridData: function(appState, gridData, helpers) {
            var cols = parseInt(gridData.cols, 10);
            var rows = parseInt(gridData.rows, 10);
            var size = validateSize(String(cols), String(rows));
            if (!size) {
                throw new Error('Invalid grid dimensions in JSON file.');
            }
            if (gridHasUserContent(appState.gemGrid) &&
                !confirm('Loading this grid will replace the current grid. Continue?')) {
                return;
            }
            currentSlug = 'pattern';
            helpers.resetDerivedImageState();
            replaceGrid(appState, size.cols, size.rows);
            appState.gemGrid.loadFromJSON(gridData);
            Promise.resolve(appState.colorPalette.paletteLoaded)
                .finally(function() {
                    appState.colorPalette.constrainGridToFullPalette();
                    appState.colorPalette.originalImageColors = appState.gemGrid.getColorCounts();
                    appState.colorPalette.createPaletteUI({ skipGridSave: true });
                    appState.colorPalette.updateColorCountDisplay();
                });
        },
        afterInit: function(appState) {
            syncSizeUI(appState.gemGrid);
        }
    });
});
```

- [ ] **Step 2: Open `url-import.html` in browser, verify no JS errors**

Check DevTools Console. Expected: no errors. Grid renders at 50×50. "Save 50x50 PNG" button label is visible. Color palette loads (VoxelBlast colors shown on right).

- [ ] **Step 3: Test size Apply button**

Enter cols=30, rows=20 in the Size inputs, click "Apply Size". Expected:
- Grid redraws at 30×20
- Button label changes to "Save 30x20 PNG"
- Inputs show 30 and 20

- [ ] **Step 4: Commit**

```bash
git add js/appUrlImport.js
git commit -m "feat: add URL Import page core — grid, size controls, save PNG"
```

---

### Task 4: URL load flow

- [ ] **Step 1: Add `bindLoadFromUrl` function to `js/appUrlImport.js`**

Inside `document.addEventListener('DOMContentLoaded', ...)`, add the following function before the `PixLabApp.initializeSharedApp` call, then call it inside `bindExtraControls` by replacing the `// URL load binding added in Task 4` comment.

```js
    function setStatus(message, isError) {
        var el = document.getElementById('urlLoadStatus');
        el.textContent = message;
        el.style.color = isError ? '#c88' : '#8c8';
    }

    function bindLoadFromUrl(appState, helpers) {
        document.getElementById('loadFromUrl').addEventListener('click', function() {
            if (isLoading) return;

            var urlValue = document.getElementById('urlInput').value.trim();
            setStatus('', false);

            // Step 1 — Validation
            if (!urlValue || !urlValue.startsWith('http')) {
                setStatus('Enter a valid URL starting with http.', true);
                return;
            }

            // Step 2 — Slug extraction (runs on every click, including retries)
            currentSlug = UrlFetcher.extractSlug(urlValue);

            var directImageUrlInput = document.getElementById('directImageUrl');
            var directUrl = directImageUrlInput.value.trim();

            isLoading = true;
            var btn = document.getElementById('loadFromUrl');
            var originalLabel = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Loading...';

            function restoreButton() {
                isLoading = false;
                btn.disabled = false;
                btn.textContent = originalLabel;
            }

            function loadImageFromUrl(resolvedImageUrl) {
                var proxiedUrl = UrlFetcher.proxyImageUrl(resolvedImageUrl);
                var img = new Image();
                img.crossOrigin = 'anonymous';

                img.onload = function() {
                    // Step 7 — Size Validation
                    var size = validateSize(
                        document.getElementById('gridCols').value,
                        document.getElementById('gridRows').value
                    );
                    if (!size) {
                        setStatus('Invalid size — enter valid cols and rows.', true);
                        restoreButton();
                        return;
                    }

                    // Step 8 — Grid preparation
                    if (gridHasUserContent(appState.gemGrid) &&
                        !confirm('Grid will be replaced. Continue?')) {
                        restoreButton();
                        return;
                    }

                    helpers.resetDerivedImageState();
                    replaceGrid(appState, size.cols, size.rows);

                    // Step 9 — Image processing
                    Promise.resolve(appState.colorPalette.paletteLoaded)
                        .catch(function() { return appState.colorPalette.fullPalette; })
                        .then(function() {
                            ImageProcessor.processImage(img, appState.gemGrid, appState.colorPalette);
                            setTimeout(function() {
                                appState.colorPalette.constrainGridToFullPalette();
                                appState.colorPalette.originalImageColors = appState.gemGrid.getColorCounts();
                                appState.colorPalette.createPaletteUI({ skipGridSave: true });
                                appState.colorPalette.updateColorCountDisplay();
                                PixLabApp.showTransientMessage('Pattern loaded.', 1200);
                                setStatus('', false);
                                // Hide the entire group (label + input) on success.
                                // Do NOT clear directImageUrl value — user may want to re-use it.
                                document.getElementById('directImageUrlGroup').style.display = 'none';
                                restoreButton();
                            }, 0);
                        });
                };

                img.onerror = function() {
                    setStatus('Image could not be loaded. Try a direct image URL below.', true);
                    document.getElementById('directImageUrlGroup').style.display = 'block';
                    restoreButton();
                };

                img.src = proxiedUrl;
            }

            // CORS-fallback: if directUrl is filled, skip HTML fetch
            if (directUrl) {
                var size = validateSize(
                    document.getElementById('gridCols').value,
                    document.getElementById('gridRows').value
                );
                if (!size) {
                    setStatus('Enter valid cols and rows before loading.', true);
                    restoreButton();
                    return;
                }
                loadImageFromUrl(directUrl);
                return;
            }

            // Step 3 — HTML fetch via CORS proxy
            UrlFetcher.fetchPageHtml(urlValue)
                .then(function(html) {
                    // Step 4 — Size parse
                    var sizeData = UrlFetcher.parsePatternSize(html);
                    if (sizeData) {
                        document.getElementById('gridCols').value = String(sizeData.cols);
                        document.getElementById('gridRows').value = String(sizeData.rows);
                        // syncSizeUI reads .cols/.rows — pass a plain object since grid
                        // hasn't been replaced yet; replaceGrid will call it again after.
                        document.getElementById('savePixelGrid').textContent =
                            'Save ' + sizeData.cols + 'x' + sizeData.rows + ' PNG';
                    } else {
                        setStatus('Size not found — enter cols/rows manually.', true);
                    }

                    // Step 5 — Image URL extraction
                    var imageUrl = UrlFetcher.extractImageUrl(html, urlValue);
                    if (!imageUrl) {
                        setStatus('Image not found on page.', true);
                        restoreButton();
                        return;
                    }

                    // Step 6 — Load image
                    loadImageFromUrl(imageUrl);
                })
                .catch(function() {
                    setStatus('Could not fetch page. Enter a direct image URL below.', true);
                    document.getElementById('directImageUrlGroup').style.display = 'block';
                    restoreButton();
                });
        });
    }
```

Then update `bindExtraControls` to call it:

```js
        bindExtraControls: function(appState, helpers) {
            bindApplyGridSize(appState, helpers);
            bindSavePixelGrid(appState);
            bindLoadFromUrl(appState, helpers);
        },
```

- [ ] **Step 2: Open `url-import.html` in browser, verify no JS errors**

Check DevTools Console. Page should load cleanly with no errors.

- [ ] **Step 3: Test URL load with a kandipatterns.com URL**

Enter `https://kandipatterns.com/patterns/misc/pretzel-62072` in the URL input. Click "Load from URL".

Expected sequence:
1. Button changes to "Loading..."
2. Size inputs auto-fill with detected values (e.g. 50×50)
3. Grid redraws at 50×50 with pattern colors
4. A transient "Pattern loaded." toast appears briefly
5. Palette on the right shows VoxelBlast colors
6. Button label reads `Save 50x50 PNG` (slug is in the downloaded filename, not the label)

- [ ] **Step 4: Test CORS failure fallback**

With no network or a blocked URL, status should show the error and the direct image URL input should appear below.

- [ ] **Step 5: Test Save PNG**

After loading a pattern, click "Save 50x50 PNG". Expected: file downloads as `pretzel-62072_50x50.png`.

- [ ] **Step 6: Test size Apply after load**

Change cols to 40, click "Apply Size". Expected: confirm dialog appears, then grid redraws at 40×50, button label updates.

- [ ] **Step 7: Commit**

```bash
git add js/appUrlImport.js
git commit -m "feat: add URL load flow to URL Import page"
```

---

### Task 5: Nav links and final polish

- [ ] **Step 1: Verify all nav links work in browser**

Navigate to each page: WiggleTangle, VoxelBlastJam, Pattern Import, Image Extractor, URL Import. Each should have "URL Import" in the nav and clicking it should navigate to `url-import.html` with the active state highlighted.

- [ ] **Step 2: Test Load Grid / Save Grid round-trip**

On URL Import page:
1. Load a pattern from URL
2. Click "Save Grid" — downloads JSON file
3. Click "Load Grid" — load the saved JSON
4. Expected: confirm dialog, then pattern reloads correctly, `currentSlug` resets to "pattern"
5. Click "Save {cols}x{rows} PNG" — downloaded file should be named `pattern_{cols}x{rows}.png` (slug resets to "pattern" after JSON load)

- [ ] **Step 3: Test color palette features**

1. Load a pattern from URL
2. Verify Total Colors → Current count updates
3. Enter Target = 5, click Apply — colors reduce to 5
4. Click a color in the palette — selected color preview updates

- [ ] **Step 4: Test undo/redo shortcuts**

Click a grid cell to paint it, press Ctrl+Z — change undoes. Press Ctrl+Y — change redoes.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete URL Import page — nav links, end-to-end verified"
```
