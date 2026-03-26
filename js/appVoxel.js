/**
 * VoxelBlastJam page bootstrap.
 */

const GRID_SIZE_OPTIONS = [40, 60, 80];
const DEFAULT_GRID_SIZE = 80;
const GRID_SIZE_STORAGE_KEY = 'pixlab-grid-size';

document.addEventListener('DOMContentLoaded', function() {
    let appStateRef = null;

    function createGemGrid(size) {
        return new GemGrid('gemGrid', size, size);
    }

    function getStoredGridSize() {
        try {
            const storedSize = parseInt(localStorage.getItem(GRID_SIZE_STORAGE_KEY), 10);
            if (GRID_SIZE_OPTIONS.includes(storedSize)) {
                return storedSize;
            }
        } catch (error) {
            console.warn('Unable to read stored grid size:', error);
        }

        return DEFAULT_GRID_SIZE;
    }

    function persistGridSize(size) {
        try {
            localStorage.setItem(GRID_SIZE_STORAGE_KEY, String(size));
        } catch (error) {
            console.warn('Unable to persist grid size:', error);
        }
    }

    function syncGridSizeUI(appState) {
        const gridSizeSelect = document.getElementById('gridSizeSelect');
        const savePixelGridButton = document.getElementById('savePixelGrid');

        gridSizeSelect.value = String(appState.gemGrid.cols);
        savePixelGridButton.textContent = 'Save ' + appState.gemGrid.cols + 'x' + appState.gemGrid.rows;
    }

    function gridHasUserContent(gemGrid) {
        return Object.values(gemGrid.gemColors).some(color => color !== gemGrid.defaultColor);
    }

    function replaceGrid(appState, newSize) {
        if (appState.gemGrid) {
            appState.gemGrid.destroy();
        }

        appState.gemGrid = createGemGrid(newSize);
        persistGridSize(newSize);
        appState.colorPalette.setGrid(appState.gemGrid);
        appState.gemGrid.saveState();
        syncGridSizeUI(appState);
    }

    function getSupportedGridSizeFromData(gridData) {
        const cols = parseInt(gridData.cols, 10);
        const rows = parseInt(gridData.rows, 10);

        if (cols === rows && GRID_SIZE_OPTIONS.includes(cols)) {
            return cols;
        }

        return null;
    }

    function bindGridSizeControls(appState, helpers) {
        document.getElementById('applyGridSize').addEventListener('click', function() {
            const requestedSize = parseInt(document.getElementById('gridSizeSelect').value, 10);

            if (!GRID_SIZE_OPTIONS.includes(requestedSize)) {
                alert('Unsupported grid size.');
                syncGridSizeUI(appState);
                return;
            }

            if (requestedSize === appState.gemGrid.cols) {
                return;
            }

            if (gridHasUserContent(appState.gemGrid) &&
                !confirm('Changing grid size will clear the current grid. Continue?')) {
                syncGridSizeUI(appState);
                return;
            }

            helpers.resetDerivedImageState();
            replaceGrid(appState, requestedSize);
        });
    }

    appStateRef = PixLabApp.initializeSharedApp({
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
            return createGemGrid(getStoredGridSize());
        },
        bindExtraControls: function(appState, helpers) {
            bindGridSizeControls(appState, helpers);

            document.getElementById('savePixelGrid').addEventListener('click', function() {
                try {
                    const dataURL = appState.gemGrid.exportPixelGridPNG();
                    const sizeLabel = appState.gemGrid.cols + 'x' + appState.gemGrid.rows;
                    const link = document.createElement('a');
                    link.href = dataURL;
                    link.download = 'bead_art_' + sizeLabel + '_' + new Date().toISOString().slice(0, 10) + '.png';
                    link.click();
                } catch (error) {
                    alert('Error during pixel export: ' + error.message);
                }
            });
        },
        loadGridData: function(appState, gridData, helpers) {
            const loadedGridSize = getSupportedGridSizeFromData(gridData);

            if (!loadedGridSize) {
                throw new Error('Only 40x40, 60x60, and 80x80 grid files are supported.');
            }

            helpers.resetDerivedImageState();
            replaceGrid(appState, loadedGridSize);
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
            syncGridSizeUI(appState);
        }
    });

    if (!appStateRef) {
        console.error('VoxelBlastJam app failed to initialize.');
    }
});
