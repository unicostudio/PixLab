const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class FakeElement {
    constructor(tagName = 'div', id = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.children = [];
        this.style = {};
        this.dataset = {};
        this.attributes = {};
        this.className = '';
        this.textContent = '';
        this.value = '';
        this.readOnly = false;
        this.eventListeners = {};
        this._innerHTML = '';
        this._classSet = new Set();
        this.classList = {
            add: (...classes) => {
                classes.forEach((className) => {
                    if (className) {
                        this._classSet.add(className);
                    }
                });
                this.className = Array.from(this._classSet).join(' ');
            },
            contains: (className) => {
                return this._classSet.has(className);
            }
        };
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    addEventListener(type, handler) {
        if (!this.eventListeners[type]) {
            this.eventListeners[type] = [];
        }
        this.eventListeners[type].push(handler);
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(value) {
        this._innerHTML = String(value);
        this.children = [];
    }

    querySelectorAll(selector) {
        const matches = [];
        const visit = (node) => {
            for (const child of node.children) {
                if (selector.startsWith('.')) {
                    const className = selector.slice(1);
                    const classes = String(child.className || '').split(/\s+/).filter(Boolean);
                    if (classes.includes(className)) {
                        matches.push(child);
                    }
                } else if (child.tagName === selector.toUpperCase()) {
                    matches.push(child);
                }

                if (child.children && child.children.length > 0) {
                    visit(child);
                }
            }
        };

        visit(this);
        return matches;
    }

    click() {
        const handlers = this.eventListeners.click || [];
        handlers.forEach((handler) => handler({ target: this }));
    }
}

function createFakeDocument() {
    const elements = new Map();

    const ensureElement = (id, tagName = 'div') => {
        if (!elements.has(id)) {
            elements.set(id, new FakeElement(tagName, id));
        }

        return elements.get(id);
    };

    const document = {
        createElement(tagName) {
            return new FakeElement(tagName);
        },
        getElementById(id) {
            return ensureElement(id);
        }
    };

    ensureElement('paletteContainer');
    ensureElement('targetColorCount', 'input').value = '2';
    ensureElement('currentColorCount');
    ensureElement('applyColorReduction', 'button');
    ensureElement('selectedColorHex');
    ensureElement('exportPalette', 'button');
    ensureElement('importPalette', 'button');
    ensureElement('paletteInput', 'input');
    ensureElement('colorPickerModal');
    ensureElement('colorPreview');
    ensureElement('hexInput', 'input');

    return { document, elements };
}

function createFakeGrid(initialGemColors) {
    const gemColors = { ...initialGemColors };
    const history = [];
    let colorSelectedCallback = null;

    return {
        defaultColor: '#000000',
        gemColors,
        history,
        historyIndex: -1,
        renderCount: 0,
        lastColorMapping: null,
        saveState() {
            const snapshot = JSON.parse(JSON.stringify(this.gemColors));
            this.history.push(snapshot);
            this.historyIndex = this.history.length - 1;
        },
        undo() {
            if (this.historyIndex <= 0) {
                return;
            }

            this.historyIndex -= 1;
            this.gemColors = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        },
        redo() {
            if (this.historyIndex >= this.history.length - 1) {
                return;
            }

            this.historyIndex += 1;
            this.gemColors = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        },
        render() {
            this.renderCount += 1;
        },
        getAllColors() {
            return Array.from(new Set(Object.values(this.gemColors).map((color) => {
                return this.normalizeColor(color);
            })));
        },
        getColorCounts() {
            const counts = {};
            Object.values(this.gemColors).forEach((color) => {
                const normalized = this.normalizeColor(color);
                counts[normalized] = (counts[normalized] || 0) + 1;
            });
            return counts;
        },
        applyColorMapping(colorMap, options = {}) {
            if (options.saveHistory !== false) {
                this.saveState();
            }

            this.lastColorMapping = { ...colorMap };
            Object.keys(this.gemColors).forEach((key) => {
                const current = this.normalizeColor(this.gemColors[key]);
                this.gemColors[key] = colorMap[current] || current;
            });
        },
        onColorSelected(callback) {
            colorSelectedCallback = callback;
        },
        emitColorSelected(color) {
            if (colorSelectedCallback) {
                colorSelectedCallback(color);
            }
        },
        normalizeColor(color) {
            return String(color).toUpperCase();
        }
    };
}

function loadClassIntoContext(context, filePath, exportName) {
    const source = fs.readFileSync(filePath, 'utf8');
    const script = new vm.Script(`${source}\n;globalThis.${exportName} = ${exportName};`, {
        filename: filePath
    });
    script.runInContext(context);
    return context[exportName];
}

function createHarness({
    initialGemColors,
    targetColorCount = 2,
    paletteOptions = {}
} = {}) {
    const { document } = createFakeDocument();
    const grid = createFakeGrid(initialGemColors || {
        '0,0': '#AA0000',
        '1,0': '#BB0000',
        '0,1': '#00AA00',
        '1,1': '#00BB00'
    });

    const context = vm.createContext({
        console,
        document,
        window: {},
        self: null,
        globalThis: null,
        setTimeout: (fn) => fn(),
        clearTimeout,
        alert: (message) => {
            throw new Error(`Unexpected alert: ${message}`);
        }
    });

    context.window = context;
    context.self = context;
    context.globalThis = context;
    context.window.document = document;
    context.window.window = context;
    context.window.self = context;
    context.window.setTimeout = context.setTimeout;
    context.window.clearTimeout = clearTimeout;
    context.window.alert = context.alert;

    const colorUtilsPath = path.join(__dirname, '..', 'js', 'colorUtils.js');
    const colorPalettePath = path.join(__dirname, '..', 'js', 'colorPalette.js');
    const ColorUtils = loadClassIntoContext(context, colorUtilsPath, 'ColorUtils');
    const ColorPalette = loadClassIntoContext(context, colorPalettePath, 'ColorPalette');

    document.getElementById('targetColorCount').value = String(targetColorCount);

    const palette = new ColorPalette('paletteContainer', grid, {
        allowColorPicker: false,
        allowHexEditing: false,
        ...paletteOptions
    });

    context.window.colorPalette = palette;
    context.colorPalette = palette;

    return { context, document, ColorUtils, ColorPalette, grid, palette };
}

function normalizeCounts(counts) {
    const normalized = {};
    Object.keys(counts).forEach((key) => {
        normalized[key.toUpperCase()] = counts[key];
    });
    return normalized;
}

test('fixed-palette reduction re-quantizes and refreshes derived state', () => {
    const fullPalette = ['#123456'];
    const initialGemColors = {
        '0,0': '#AA0000',
        '1,0': '#BB0000',
        '0,1': '#00AA00',
        '1,1': '#00BB00'
    };
    const { document, ColorUtils, palette, grid } = createHarness({
        initialGemColors,
        targetColorCount: 2,
        paletteOptions: {
            useTwoColumnPalette: true,
            useFullPaletteAsDisplay: true,
            useDetectedColorsAsPalette: false,
            initialColors: fullPalette
        }
    });

    palette.fullPalette = [...fullPalette];
    palette.colors = [...fullPalette];
    palette.originalImageColors = normalizeCounts(grid.getColorCounts());
    palette.createPaletteUI({ skipGridSave: true });

    palette.applyColorReduction();

    const finalGridColors = grid.getAllColors();
    const finalCounts = normalizeCounts(grid.getColorCounts());
    const currentCount = Number(document.getElementById('currentColorCount').textContent);

    assert.ok(
        finalGridColors.every((color) => fullPalette.includes(color)),
        'final snapped grid colors should be restricted to the fixed full palette'
    );
    assert.deepStrictEqual(
        normalizeCounts(palette.originalImageColors),
        finalCounts,
        'derived image counts should refresh to match the final snapped grid'
    );
    assert.equal(
        currentCount,
        Object.keys(finalCounts).length,
        'currentColorCount should reflect the final snapped palette size'
    );
});

test('fixed-palette reduction records one logical Apply action', () => {
    const fullPalette = ['#123456'];
    const initialGemColors = {
        '0,0': '#AA0000',
        '1,0': '#BB0000',
        '0,1': '#00AA00',
        '1,1': '#00BB00'
    };
    const { palette, grid } = createHarness({
        initialGemColors,
        targetColorCount: 2,
        paletteOptions: {
            useTwoColumnPalette: true,
            useFullPaletteAsDisplay: true,
            useDetectedColorsAsPalette: false,
            initialColors: fullPalette
        }
    });

    palette.fullPalette = [...fullPalette];
    palette.colors = [...fullPalette];
    palette.originalImageColors = normalizeCounts(grid.getColorCounts());
    palette.createPaletteUI({ skipGridSave: true });

    grid.saveState();
    const beforeApply = JSON.parse(JSON.stringify(grid.gemColors));
    const historyLengthBeforeApply = grid.history.length;

    palette.applyColorReduction();

    const afterApply = JSON.parse(JSON.stringify(grid.gemColors));
    assert.notDeepStrictEqual(afterApply, beforeApply);
    assert.equal(
        grid.history.length,
        historyLengthBeforeApply + 1,
        'fixed-palette reduction should add one final history state'
    );

    grid.undo();
    assert.deepStrictEqual(grid.gemColors, beforeApply, 'one undo should restore the pre-Apply grid');

    grid.redo();
    assert.deepStrictEqual(grid.gemColors, afterApply, 'one redo should restore the snapped post-Apply grid');
});

test('non-fixed palette reduction stays on the regular detected-color path', () => {
    const initialGemColors = {
        '0,0': '#AA0000',
        '1,0': '#BB0000',
        '0,1': '#00AA00',
        '1,1': '#00BB00',
        '2,0': '#110000',
        '2,1': '#220000',
        '3,0': '#330000',
        '3,1': '#440000',
        '4,0': '#550000',
        '4,1': '#660000',
        '5,0': '#770000'
    };
    const { document, ColorUtils, palette, grid } = createHarness({
        initialGemColors,
        targetColorCount: 10,
        paletteOptions: {
            useTwoColumnPalette: false,
            useFullPaletteAsDisplay: false,
            useDetectedColorsAsPalette: true
        }
    });

    const expectedReducedColors = ColorUtils.reduceColors(grid.getAllColors(), 10).map((color) => {
        return ColorUtils.normalizeHex(color);
    });

    let quantizeCalled = false;
    palette.quantizeGridToFullPalette = () => {
        quantizeCalled = true;
        throw new Error('quantizeGridToFullPalette should not be used for the regular detected-color path');
    };

    palette.applyColorReduction();

    assert.equal(quantizeCalled, false);
    assert.deepStrictEqual(
        palette.colors.map((color) => ColorUtils.normalizeHex(color)),
        expectedReducedColors
    );
    assert.equal(
        Number(document.getElementById('currentColorCount').textContent),
        Object.keys(grid.getColorCounts()).length
    );
});
