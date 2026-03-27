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

    // ── Status display ────────────────────────────────────────────────────────

    function setStatus(message, isError) {
        var el = document.getElementById('urlLoadStatus');
        el.textContent = message;
        el.style.color = isError ? '#c88' : '#8c8';
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
                    // Step 7 — Size validation
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
            bindLoadFromUrl(appState, helpers);
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
