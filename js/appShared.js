/**
 * Shared application bootstrap helpers for PixLab pages.
 */

(function() {
    function showTransientMessage(message, durationMs) {
        const existingToast = document.querySelector('.app-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'app-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        window.setTimeout(function() {
            toast.classList.add('is-visible');
        }, 10);

        window.setTimeout(function() {
            toast.classList.remove('is-visible');
            window.setTimeout(function() {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 220);
        }, durationMs);
    }

    function resetDerivedImageState(colorPalette) {
        if (colorPalette) {
            colorPalette.originalImageColors = {};
            if (colorPalette.useTwoColumnPalette) {
                colorPalette.createPaletteUI({ skipGridSave: true });
            }
        }

        if (typeof window !== 'undefined') {
            window.originalImageColors = [];
            window.firstImagePalette = null;
            window.firstImagePaletteCounts = null;
        }
    }

    function downloadDataUrl(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        link.click();
    }

    function createJsonDownload(data, filename) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        downloadDataUrl(dataUri, filename);
    }

    function initializeSharedApp(options) {
        const appState = {
            gemGrid: options.createGrid(),
            colorPalette: null
        };

        appState.colorPalette = new ColorPalette(
            'colorPaletteContainer',
            appState.gemGrid,
            Object.assign({}, options.colorPaletteOptions, {
                palettePath: options.palettePath
            })
        );
        window.colorPalette = appState.colorPalette;
        document.getElementById('colorPaletteContainer').parentNode.colorPalette = appState.colorPalette;

        bindSharedControls(appState, options);
        bindKeyboardShortcuts(appState);

        if (options.enableColorPicker !== false) {
            try {
                ColorPickerWheel.init();
            } catch (error) {
                console.error('Color picker initialization failed:', error);
            }
        }

        if (typeof options.afterInit === 'function') {
            options.afterInit(appState);
        }

        return appState;
    }

    function bindSharedControls(appState, options) {
        document.getElementById('clearSelection').addEventListener('click', function() {
            appState.gemGrid.selectedCells.clear();
            appState.gemGrid.render();
        });

        document.getElementById('undoButton').addEventListener('click', function() {
            appState.gemGrid.undo();
        });

        document.getElementById('redoButton').addEventListener('click', function() {
            appState.gemGrid.redo();
        });

        document.getElementById('clearGrid').addEventListener('click', function() {
            if (confirm('Are you sure you want to clear the grid? This cannot be undone.')) {
                resetDerivedImageState(appState.colorPalette);
                appState.gemGrid.clearGrid();
                appState.colorPalette.updateColorCountDisplay();
            }
        });

        document.getElementById('exportPNG').addEventListener('click', function() {
            const dataURL = appState.gemGrid.exportToPNG();
            downloadDataUrl(dataURL, 'bead_art_' + new Date().toISOString().slice(0, 10) + '.png');
        });

        const savePngButton = document.getElementById('savePNG');
        if (savePngButton) {
            savePngButton.addEventListener('click', function() {
                try {
                    const dataURL = appState.gemGrid.exportColorOnlyPNG();
                    if (!dataURL || !dataURL.startsWith('data:image/png')) {
                        alert('PNG generation failed.');
                        return;
                    }

                    downloadDataUrl(
                        dataURL,
                        'bead_art_color_only_' + new Date().toISOString().slice(0, 10) + '.png'
                    );
                } catch (error) {
                    alert('Error during Save PNG: ' + error.message);
                }
            });
        }

        if (typeof options.bindExtraControls === 'function') {
            options.bindExtraControls(appState, {
                resetDerivedImageState: function() {
                    resetDerivedImageState(appState.colorPalette);
                }
            });
        }

        document.getElementById('saveGrid').addEventListener('click', function() {
            const gridData = appState.gemGrid.saveToJSON();
            gridData.palette = appState.colorPalette.getPaletteColors();
            createJsonDownload(
                gridData,
                'bead_grid_' + new Date().toISOString().slice(0, 10) + '.json'
            );
        });

        document.getElementById('loadGrid').addEventListener('click', function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = function(event) {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function(loadEvent) {
                    try {
                        const gridData = JSON.parse(loadEvent.target.result);

                        if (typeof options.loadGridData === 'function') {
                            options.loadGridData(appState, gridData, {
                                resetDerivedImageState: function() {
                                    resetDerivedImageState(appState.colorPalette);
                                }
                            });
                        } else {
                            appState.gemGrid.loadFromJSON(gridData);
                        }

                        if (appState.colorPalette.allowLoadedPaletteOverride &&
                            gridData.palette &&
                            Array.isArray(gridData.palette)) {
                            appState.colorPalette.colors = gridData.palette.map(color => ColorUtils.normalizeHex(color));
                            appState.colorPalette.createPaletteUI();
                        } else {
                            appState.colorPalette.updateColorCountDisplay();
                        }

                        alert('Grid loaded successfully.');
                    } catch (error) {
                        alert('Error loading grid: ' + error.message);
                    }
                };

                reader.readAsText(file);
            };

            input.click();
        });

        document.getElementById('loadImage').addEventListener('click', function() {
            document.getElementById('imageInput').click();
        });

        document.getElementById('imageInput').addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (!file) return;

            if (!file.type.match('image.*')) {
                alert('Please select an image file.');
                return;
            }

            resetDerivedImageState(appState.colorPalette);

            Promise.resolve(appState.colorPalette.paletteLoaded)
                .catch(function() {
                    return appState.colorPalette.fullPalette;
                })
                .then(function() {
                    return ImageProcessor.loadImageToGrid(file, appState.gemGrid, appState.colorPalette);
                })
                .then(function() {
                    showTransientMessage('Image loaded successfully.', 1000);
                })
                .catch(function(error) {
                    alert('Error loading image: ' + error.message);
                });

            this.value = '';
        });
    }

    function bindKeyboardShortcuts(appState) {
        document.addEventListener('keydown', function(event) {
            if (event.ctrlKey && event.key === 'z') {
                appState.gemGrid.undo();
                event.preventDefault();
            }

            if (event.ctrlKey && event.key === 'y') {
                appState.gemGrid.redo();
                event.preventDefault();
            }

            if (event.key === 'Escape') {
                appState.gemGrid.selectedCells.clear();
                appState.gemGrid.render();
                event.preventDefault();
            }
        });
    }

    window.PixLabApp = {
        initializeSharedApp: initializeSharedApp
    };
})();
