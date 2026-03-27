/**
 * URL Import page bootstrap.
 */

document.addEventListener('DOMContentLoaded', function() {
    var currentSlug = 'pattern';
    var currentPatternName = 'Imported Pattern';
    var currentPatternAuthor = 'PixLab';
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
        syncSizeUIValues(gemGrid.cols, gemGrid.rows);
    }

    function syncSizeUIValues(cols, rows) {
        document.getElementById('gridCols').value = String(cols);
        document.getElementById('gridRows').value = String(rows);
        document.getElementById('savePixelGrid').textContent =
            'Save ' + cols + 'x' + rows + ' PNG';
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

    function drawFetchedImagePreview(img) {
        var canvas = document.getElementById('fetchedImagePreview');
        var section = document.getElementById('fetchedImageSection');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        section.style.display = 'block';
    }

    function clearFetchedImagePreview() {
        document.getElementById('fetchedImageSection').style.display = 'none';
    }

    function buildSourceMetadata(urlValue) {
        var safeSlug = UrlFetcher.extractSlug(urlValue) || 'pattern';
        var name = 'Imported Pattern';
        var author = 'PixLab';

        try {
            var parsedUrl = new URL(urlValue);
            var segments = parsedUrl.pathname.split('/').filter(function(segment) {
                return segment.length > 0;
            });
            author = parsedUrl.hostname.replace(/^www\./, '') || 'PixLab';
            if (segments.length > 0) {
                name = safeSlug;
            }
        } catch (error) {
            author = 'PixLab';
        }

        return {
            slug: safeSlug,
            name: name,
            author: author
        };
    }

    function getImportErrorMessage(error) {
        if (error && typeof error.message === 'string') {
            if (error.message === 'All proxies failed.' ||
                error.message.indexOf('Proxy returned ') === 0) {
                return 'Could not fetch the source page.';
            }
            return error.message;
        }

        return 'Could not fetch the source page.';
    }

    function loadImageThroughProxyChain(imageUrl) {
        return new Promise(function(resolve, reject) {
            var proxiedUrls = UrlFetcher.proxyImageUrls(imageUrl);

            function tryUrl(index) {
                if (index >= proxiedUrls.length) {
                    reject(new Error('Pattern image could not be loaded.'));
                    return;
                }

                var img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    resolve(img);
                };
                img.onerror = function() {
                    tryUrl(index + 1);
                };
                img.src = proxiedUrls[index];
            }

            tryUrl(0);
        });
    }

    function downloadJsonData(data, filename) {
        var link = document.createElement('a');
        link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        link.download = filename;
        link.click();
    }

    function finalizeImportedPattern(appState, metadata) {
        currentSlug = metadata.slug;
        currentPatternName = metadata.name;
        currentPatternAuthor = metadata.author;
        appState.colorPalette.originalImageColors = appState.gemGrid.getColorCounts();
        appState.colorPalette.createPaletteUI({ skipGridSave: true });
        appState.colorPalette.updateColorCountDisplay();
        document.getElementById('downloadPatternJson').disabled = false;
    }

    function importPatternFromUrl(appState, helpers, urlValue) {
        var metadata = buildSourceMetadata(urlValue);

        return UrlFetcher.fetchPageHtml(urlValue)
            .then(function(html) {
                var sizeData = UrlFetcher.parsePatternSize(html);
                if (!sizeData) {
                    throw new Error('Pattern size could not be parsed from the page.');
                }

                syncSizeUIValues(sizeData.cols, sizeData.rows);

                var imageUrl = UrlFetcher.extractImageUrl(html, urlValue);
                if (!imageUrl) {
                    throw new Error('Pattern image not found on the page.');
                }

                return loadImageThroughProxyChain(imageUrl)
                    .then(function(image) {
                        return {
                            image: image,
                            sizeData: sizeData,
                            metadata: metadata
                        };
                    });
            })
            .then(function(importData) {
                return Promise.resolve(appState.colorPalette.paletteLoaded)
                    .catch(function() {
                        return appState.colorPalette.fullPalette;
                    })
                    .then(function() {
                        drawFetchedImagePreview(importData.image);
                        var sampleResult = PatternSampler.buildLegacyPatternFromImage({
                            image: importData.image,
                            rows: importData.sizeData.rows,
                            cols: importData.sizeData.cols,
                            name: importData.metadata.name,
                            author: importData.metadata.author
                        });
                        var parsedPattern = PatternImport.parseLegacyPatternData(sampleResult);

                        if (gridHasUserContent(appState.gemGrid) &&
                            !confirm('Grid will be replaced. Continue?')) {
                            return { cancelled: true };
                        }

                        helpers.resetDerivedImageState();
                        PatternImport.applyPatternToApp(appState, parsedPattern, null, {
                            usePatternPalette: false,
                            replaceGrid: function(cols, rows) {
                                replaceGrid(appState, cols, rows);
                            }
                        });
                        finalizeImportedPattern(appState, importData.metadata);
                        setStatus('', false);
                        PixLabApp.showTransientMessage('Pattern loaded.', 1200);

                        return { cancelled: false };
                    });
            });
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

    function bindDownloadPatternJson(appState) {
        document.getElementById('downloadPatternJson').addEventListener('click', function() {
            if (this.disabled) {
                return;
            }

            try {
                downloadJsonData(
                    PatternExport.buildExternalPatternJson({
                        gemGrid: appState.gemGrid,
                        name: currentPatternName,
                        author: currentPatternAuthor
                    }),
                    currentSlug + '_pattern.json'
                );
            } catch (error) {
                alert('Export error: ' + error.message);
            }
        });
    }

    function bindLoadFromUrl(appState, helpers) {
        var loadBtn = document.getElementById('loadFromUrl');

        document.getElementById('urlInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { loadBtn.click(); }
        });

        loadBtn.addEventListener('click', function() {
            if (isLoading) return;

            var urlValue = document.getElementById('urlInput').value.trim();
            setStatus('', false);
            clearFetchedImagePreview();

            // Step 1 — Validation
            if (!urlValue || !urlValue.startsWith('http')) {
                setStatus('Enter a valid URL starting with http.', true);
                return;
            }

            isLoading = true;
            var btn = loadBtn;
            var originalLabel = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Loading...';

            function restoreButton() {
                isLoading = false;
                btn.disabled = false;
                btn.textContent = originalLabel;
            }

            importPatternFromUrl(appState, helpers, urlValue)
                .then(function(result) {
                    restoreButton();
                    if (result && result.cancelled) {
                        return;
                    }
                })
                .catch(function(error) {
                    setStatus(getImportErrorMessage(error), true);
                    clearFetchedImagePreview();
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
            bindDownloadPatternJson(appState);
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
