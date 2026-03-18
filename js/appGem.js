/**
 * Main application script.
 * Keeps the active grid size in one place and recreates the grid when needed.
 */

const GRID_SIZE_OPTIONS = [40, 60, 80];
const DEFAULT_GRID_SIZE = 80;
const GRID_SIZE_STORAGE_KEY = 'pixlab-grid-size';

document.addEventListener('DOMContentLoaded', function() {
    const appState = {
        currentGridSize: getStoredGridSize(),
        gemGrid: createGemGrid(getStoredGridSize()),
        colorPalette: null
    };

    appState.currentGridSize = appState.gemGrid.cols;
    appState.colorPalette = new ColorPalette('colorPaletteContainer', appState.gemGrid);

    window.colorPalette = appState.colorPalette;
    document.getElementById('colorPaletteContainer').parentNode.colorPalette = appState.colorPalette;

    setupGridSizeControls(appState);
    setupGridControls(appState);
    setupKeyboardShortcuts(appState);
    syncGridSizeUI(appState);

    try {
        ColorPickerWheel.init();
    } catch (error) {
        console.error('Color picker initialization failed:', error);
    }
});

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

    gridSizeSelect.value = String(appState.currentGridSize);
    savePixelGridButton.textContent = `Save ${appState.currentGridSize}x${appState.currentGridSize}`;
}

function replaceGrid(appState, newSize) {
    if (appState.gemGrid) {
        appState.gemGrid.destroy();
    }

    appState.gemGrid = createGemGrid(newSize);
    appState.currentGridSize = newSize;
    persistGridSize(newSize);
    appState.colorPalette.setGrid(appState.gemGrid);
    appState.gemGrid.saveState();
    syncGridSizeUI(appState);
}

function setupGridSizeControls(appState) {
    document.getElementById('applyGridSize').addEventListener('click', function() {
        const requestedSize = parseInt(document.getElementById('gridSizeSelect').value, 10);

        if (!GRID_SIZE_OPTIONS.includes(requestedSize)) {
            alert('Unsupported grid size.');
            syncGridSizeUI(appState);
            return;
        }

        if (requestedSize === appState.currentGridSize) {
            return;
        }

        if (gridHasUserContent(appState.gemGrid) &&
            !confirm('Changing grid size will clear the current grid. Continue?')) {
            syncGridSizeUI(appState);
            return;
        }

        resetDerivedImageState(appState.colorPalette);
        replaceGrid(appState, requestedSize);
    });
}

function gridHasUserContent(gemGrid) {
    return Object.values(gemGrid.gemColors).some(color => color !== gemGrid.defaultColor);
}

function resetDerivedImageState(colorPalette) {
    if (colorPalette) {
        colorPalette.originalImageColors = {};
    }

    if (typeof window !== 'undefined') {
        window.originalImageColors = [];
        window.firstImagePalette = null;
        window.firstImagePaletteCounts = null;
    }
}

function getSupportedGridSizeFromData(gridData) {
    const cols = parseInt(gridData.cols, 10);
    const rows = parseInt(gridData.rows, 10);

    if (cols === rows && GRID_SIZE_OPTIONS.includes(cols)) {
        return cols;
    }

    return null;
}

/**
 * Set up event listeners for grid controls.
 * @param {Object} appState - Shared application state
 */
function setupGridControls(appState) {
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
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'bead_art_' + new Date().toISOString().slice(0, 10) + '.png';
        link.click();
    });

    document.getElementById('savePNG').addEventListener('click', function() {
        try {
            const dataURL = appState.gemGrid.exportColorOnlyPNG();
            if (!dataURL || !dataURL.startsWith('data:image/png')) {
                alert('PNG generation failed.');
                return;
            }

            const link = document.createElement('a');
            link.href = dataURL;
            link.download = 'bead_art_color_only_' + new Date().toISOString().slice(0, 10) + '.png';
            link.click();
        } catch (error) {
            alert('Error during Save PNG: ' + error.message);
        }
    });

    document.getElementById('savePixelGrid').addEventListener('click', function() {
        try {
            const dataURL = appState.gemGrid.exportPixelGridPNG();
            const sizeLabel = `${appState.gemGrid.cols}x${appState.gemGrid.rows}`;
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `bead_art_${sizeLabel}_` + new Date().toISOString().slice(0, 10) + '.png';
            link.click();
        } catch (error) {
            alert('Error during pixel export: ' + error.message);
        }
    });

    document.getElementById('saveGrid').addEventListener('click', function() {
        const gridData = appState.gemGrid.saveToJSON();
        gridData.palette = appState.colorPalette.getPaletteColors();

        const dataStr = JSON.stringify(gridData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportName = 'bead_grid_' + new Date().toISOString().slice(0, 10) + '.json';

        const link = document.createElement('a');
        link.href = dataUri;
        link.download = exportName;
        link.click();
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
                    const loadedGridSize = getSupportedGridSizeFromData(gridData);

                    if (!loadedGridSize) {
                        throw new Error('Only 40x40, 60x60, and 80x80 grid files are supported.');
                    }

                    resetDerivedImageState(appState.colorPalette);
                    replaceGrid(appState, loadedGridSize);
                    appState.gemGrid.loadFromJSON(gridData);

                    if (gridData.palette && Array.isArray(gridData.palette)) {
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
            .catch(() => appState.colorPalette.fullPalette)
            .then(() => ImageProcessor.loadImageToGrid(file, appState.gemGrid, appState.colorPalette))
            .then(() => {
                alert('Image loaded successfully.');
            })
            .catch(error => {
                alert('Error loading image: ' + error.message);
            });

        this.value = '';
    });
}

/**
 * Set up keyboard shortcuts.
 * @param {Object} appState - Shared application state
 */
function setupKeyboardShortcuts(appState) {
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
