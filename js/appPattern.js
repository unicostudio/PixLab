/**
 * Pattern import page bootstrap.
 */

const DEFAULT_PATTERN_WIDTH = 20;
const DEFAULT_PATTERN_HEIGHT = 16;

document.addEventListener('DOMContentLoaded', function() {
    function createGemGrid(cols, rows) {
        return new GemGrid('gemGrid', cols, rows);
    }

    function replaceGrid(appState, cols, rows) {
        if (appState.gemGrid) {
            appState.gemGrid.destroy();
        }

        appState.gemGrid = createGemGrid(cols, rows);
        appState.colorPalette.setGrid(appState.gemGrid);
        appState.gemGrid.saveState();
    }

    function updatePatternInfo(pattern) {
        document.getElementById('patternName').textContent = pattern.name || 'Untitled';
        document.getElementById('patternAuthor').textContent = pattern.author || '-';
        document.getElementById('patternSize').textContent =
            pattern.dimensions.width + ' x ' + pattern.dimensions.height;
    }

    function setPatternPalette(appState, paletteEntries) {
        const paletteColors = paletteEntries.map(function(entry) {
            return entry.hex;
        });

        appState.colorPalette.fullPalette = [...paletteColors];
        appState.colorPalette.colors = [...paletteColors];
        appState.colorPalette.createPaletteUI({ skipGridSave: true });

        if (paletteColors.length > 0) {
            appState.colorPalette.updateSelectedColorDisplay(paletteColors[0]);
        }
    }

    function parsePatternData(rawData) {
        if (!rawData || typeof rawData !== 'object') {
            throw new Error('Pattern JSON must be an object.');
        }

        if (!rawData.dimensions || typeof rawData.dimensions !== 'object') {
            throw new Error('Missing dimensions block.');
        }

        const width = parseInt(rawData.dimensions.width, 10);
        const height = parseInt(rawData.dimensions.height, 10);

        if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
            throw new Error('Pattern dimensions must be positive integers.');
        }

        if (!rawData.palette || typeof rawData.palette !== 'object') {
            throw new Error('Missing palette block.');
        }

        const paletteEntries = Object.entries(rawData.palette).map(function(entry) {
            const code = entry[0];
            const colorDef = entry[1];
            if (!colorDef || typeof colorDef.hex !== 'string' || !ColorUtils.isValidHex(colorDef.hex)) {
                throw new Error('Palette color "' + code + '" is missing a valid hex value.');
            }

            return {
                code: code,
                name: colorDef.name || code,
                hex: ColorUtils.normalizeHex(colorDef.hex)
            };
        });

        if (paletteEntries.length === 0) {
            throw new Error('Palette must contain at least one color.');
        }

        const paletteByCode = {};
        paletteEntries.forEach(function(entry) {
            paletteByCode[entry.code] = entry;
        });

        const beads = Array.isArray(rawData.beads) ? rawData.beads : [];
        const normalizedBeads = beads.map(function(bead, index) {
            const x = parseInt(bead.x, 10);
            const y = parseInt(bead.y, 10);
            const colorCode = bead.color;

            if (!Number.isInteger(x) || !Number.isInteger(y)) {
                throw new Error('Bead at index ' + index + ' has invalid coordinates.');
            }
            if (x < 0 || x >= width || y < 0 || y >= height) {
                throw new Error('Bead at index ' + index + ' is outside the pattern bounds.');
            }
            if (!paletteByCode[colorCode]) {
                throw new Error('Bead at index ' + index + ' references unknown palette code "' + colorCode + '".');
            }

            return {
                x: x,
                y: y,
                color: paletteByCode[colorCode].hex
            };
        });

        return {
            name: rawData.name || 'Untitled',
            author: rawData.author || '',
            dimensions: {
                width: width,
                height: height
            },
            paletteEntries: paletteEntries,
            beads: normalizedBeads
        };
    }

    function applyPattern(appState, pattern, helpers) {
        helpers.resetDerivedImageState();
        replaceGrid(appState, pattern.dimensions.width, pattern.dimensions.height);
        setPatternPalette(appState, pattern.paletteEntries);
        updatePatternInfo(pattern);

        appState.gemGrid.initializeGrid();
        pattern.beads.forEach(function(bead) {
            appState.gemGrid.gemColors[bead.x + ',' + bead.y] = bead.color;
        });

        appState.gemGrid.selectedCells.clear();
        appState.gemGrid.render();
        appState.gemGrid.saveState();
        appState.colorPalette.updateColorCountDisplay();
    }

    function bindPatternControls(appState, helpers) {
        const patternInput = document.getElementById('patternInput');
        document.getElementById('loadPattern').addEventListener('click', function() {
            patternInput.click();
        });

        patternInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(loadEvent) {
                try {
                    const patternData = JSON.parse(loadEvent.target.result);
                    const parsedPattern = parsePatternData(patternData);
                    applyPattern(appState, parsedPattern, helpers);
                    PixLabApp.showTransientMessage('Pattern loaded successfully.', 1000);
                } catch (error) {
                    alert('Error loading pattern: ' + error.message);
                }
            };

            reader.readAsText(file);
            event.target.value = '';
        });
    }

    PixLabApp.initializeSharedApp({
        createGrid: function() {
            return createGemGrid(DEFAULT_PATTERN_WIDTH, DEFAULT_PATTERN_HEIGHT);
        },
        colorPaletteOptions: {
            allowColorPicker: false,
            allowHexEditing: false,
            useDetectedColorsAsPalette: false,
            useFullPaletteAsDisplay: true,
            initialColors: []
        },
        enableColorPicker: false,
        bindExtraControls: function(appState, helpers) {
            bindPatternControls(appState, helpers);
        },
        afterInit: function(appState) {
            appState.colorPalette.createPaletteUI({ skipGridSave: true });
        }
    });
});
