/**
 * Color Palette Implementation
 * Manages the color palette display, selection, and manipulation
 */

class ColorPalette {
    /**
     * Initialize the color palette
     * @param {String} containerId - ID of the container element
     * @param {HexGrid} hexGrid - Reference to the hex grid
     */
    constructor(containerId, hexGrid, options = {}) {
        this.container = document.getElementById(containerId);
        this.hexGrid = hexGrid;
        this.palettePath = options.palettePath;
        this.allowColorPicker = options.allowColorPicker !== false;
        this.allowHexEditing = options.allowHexEditing !== false;
        this.useDetectedColorsAsPalette = options.useDetectedColorsAsPalette !== false;
        this.useFullPaletteAsDisplay = options.useFullPaletteAsDisplay === true;
        this.allowLoadedPaletteOverride = options.allowLoadedPaletteOverride !== false;
        this.useTwoColumnPalette = options.useTwoColumnPalette === true;
        this.colors = Array.isArray(options.initialColors)
            ? options.initialColors.map((color) => ColorUtils.normalizeHex(color))
            : Array(10).fill('#FFFFFF');
        // Always maintain exactly 10 colors (all white by default)
        this.fullPalette = []; // Will store all 120 colors from JSON
        this.selectedColorIndex = 0;
        this.originalImageColors = {}; // Track original image colors
        this.selectedHexColor = null; // Currently selected hex color for display
        
        // Load the full color palette from JSON
        this.paletteLoaded = this.loadFullColorPalette();
        
        // Create initial palette UI with just white
        this.createPaletteUI();
        
        // Set up event listeners for palette controls
        this.setupEventListeners();
    }
    
    /**
     * Create the color palette UI
     */
    createPaletteUI(options = {}) {
        const skipGridSave = options.skipGridSave === true;

        // Clear container
        this.container.innerHTML = '';
        
        if (this.useFullPaletteAsDisplay) {
            this.colors = this.colors.map(color => ColorUtils.normalizeHex(color));
        } else {
            // Ensure we have exactly 10 colors
            while (this.colors.length < 10) {
                this.colors.push('#FFFFFF');
            }
            if (this.colors.length > 10) {
                this.colors = this.colors.slice(0, 10);
            }
        }
        
        if (this.useTwoColumnPalette) {
            this.renderTwoColumnPalette();
        } else {
            this.colors.forEach((color, index) => {
                this.container.appendChild(this.buildColorItem(color, index));
            });
        }
        
        // Update color count display
        this.updateColorCountDisplay();
        if (!skipGridSave) {
            // Save grid state asynchronously after color reduction is complete
            setTimeout(() => {
                this.hexGrid.saveState();
            }, 0);
        }
    }

    buildColorItem(color, index) {
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';

        const colorBall = document.createElement('div');
        colorBall.className = 'color-ball';
        colorBall.style.backgroundColor = color;
        colorBall.dataset.index = index;
        if (this.allowColorPicker) {
            colorBall.addEventListener('click', () => this.openColorPicker(index));
        } else {
            colorBall.classList.add('is-locked');
        }

        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'color-hex';
        hexInput.value = color;
        hexInput.dataset.index = index;
        if (this.allowHexEditing) {
            hexInput.addEventListener('change', (e) => this.updateColorFromInput(e.target));
        } else {
            hexInput.readOnly = true;
            hexInput.classList.add('is-readonly');
            hexInput.setAttribute('aria-readonly', 'true');
        }

        const applyButton = document.createElement('button');
        applyButton.className = 'apply-button';
        applyButton.textContent = 'Apply';
        applyButton.dataset.index = index;
        applyButton.addEventListener('click', () => this.applySelectedColor(index));

        colorItem.appendChild(applyButton);
        colorItem.appendChild(hexInput);
        colorItem.appendChild(colorBall);

        return colorItem;
    }

    renderTwoColumnPalette() {
        const columnData = this.getTwoColumnPaletteData();
        const columnsWrapper = document.createElement('div');
        columnsWrapper.className = 'palette-columns';

        columnsWrapper.appendChild(this.buildPaletteColumn(columnData.leftTitle, columnData.leftColors));
        columnsWrapper.appendChild(this.buildPaletteColumn(columnData.rightTitle, columnData.rightColors));

        this.container.appendChild(columnsWrapper);
    }

    buildPaletteColumn(title, colors) {
        const column = document.createElement('div');
        column.className = 'palette-column';

        if (title) {
            const heading = document.createElement('div');
            heading.className = 'palette-column-title';
            heading.textContent = title;
            column.appendChild(heading);
        }

        const list = document.createElement('div');
        list.className = 'palette-column-list';

        if (colors.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'palette-empty';
            emptyState.textContent = 'No colors';
            list.appendChild(emptyState);
        } else {
            colors.forEach((color) => {
                const index = this.colors.indexOf(color);
                if (index >= 0) {
                    list.appendChild(this.buildColorItem(color, index));
                }
            });
        }

        column.appendChild(list);
        return column;
    }

    getTwoColumnPaletteData() {
        const paletteColors = [...this.colors];
        const hasDerivedImageState = Object.keys(this.originalImageColors).length > 0;

        if (!hasDerivedImageState) {
            const midpoint = Math.ceil(paletteColors.length / 2);
            return {
                leftTitle: '',
                rightTitle: '',
                leftColors: paletteColors.slice(0, midpoint),
                rightColors: paletteColors.slice(midpoint)
            };
        }

        const usedColorSet = new Set(this.getNormalizedGridColors());
        return {
            leftTitle: 'Used',
            rightTitle: 'Remaining',
            leftColors: paletteColors.filter((color) => usedColorSet.has(color)),
            rightColors: paletteColors.filter((color) => !usedColorSet.has(color))
        };
    }

    getNormalizedGridColors() {
        if (!this.hexGrid || !this.hexGrid.gemColors) {
            return [];
        }

        return Array.from(
            new Set(
                Object.values(this.hexGrid.gemColors).map((color) => ColorUtils.normalizeHex(color))
            )
        );
    }
    
    /**
     * Load colors from the full color palette JSON file
     */
    loadFullColorPalette() {
        if (!this.palettePath) {
            this.fullPalette = [];
            return Promise.resolve(this.fullPalette);
        }

        return fetch(this.palettePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load color palette');
                }
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data.colors) && data.colors.length > 0) {
                    // Store the full palette separately
                    this.fullPalette = data.colors.map(color => ColorUtils.normalizeHex(color));
                    if (this.useFullPaletteAsDisplay) {
                        this.colors = [...this.fullPalette];
                        this.createPaletteUI({ skipGridSave: true });
                    }
                    console.log(`Loaded ${this.fullPalette.length} colors in full palette`);
                    return this.fullPalette;
                } else {
                    throw new Error('Invalid color palette format');
                }
            })
            .catch(error => {
                console.error('Error loading color palette:', error);
                this.fullPalette = [];
                return this.fullPalette;
            });
    }
    
    /**
     * Set up event listeners for palette controls
     */
    setupEventListeners() {
        const exportPaletteButton = document.getElementById('exportPalette');
        const importPaletteButton = document.getElementById('importPalette');
        const paletteInput = document.getElementById('paletteInput');

        if (exportPaletteButton) {
            exportPaletteButton.addEventListener('click', () => this.exportPalette());
        }

        if (importPaletteButton) {
            importPaletteButton.addEventListener('click', () => this.importPalette());
        }

        if (paletteInput) {
            paletteInput.addEventListener('change', (e) => this.handlePaletteFileSelect(e));
        }
        
        document.getElementById('applyColorReduction').addEventListener('click', () => this.applyColorReduction());
        
        // Set up click-to-copy for the selected color hex code
        const selectedColorHex = document.getElementById('selectedColorHex');
        selectedColorHex.addEventListener('click', () => this.copySelectedColorToClipboard());
        
        // Register callback for color selection from the grid
        if (this.hexGrid) {
            this.hexGrid.onColorSelected((color) => this.updateSelectedColorDisplay(color));
        }
    }

    /**
     * Point the palette to a new grid instance after the grid is recreated.
     * @param {GemGrid} hexGrid - Active grid instance
     */
    setGrid(hexGrid) {
        this.hexGrid = hexGrid;

        if (this.hexGrid) {
            this.hexGrid.onColorSelected((color) => this.updateSelectedColorDisplay(color));
        }

        if (this.useTwoColumnPalette) {
            this.createPaletteUI({ skipGridSave: true });
        }

        this.updateColorCountDisplay();
    }
    
    /**
     * Open the color picker for a specific color
     * @param {Number} index - Index of the color in the palette
     */
    openColorPicker(index) {
        if (!this.allowColorPicker) {
            return;
        }

        this.selectedColorIndex = index;
        const currentColor = this.colors[index];
        
        // Set the color picker's initial color
        const colorPicker = document.getElementById('colorPickerModal');
        const colorPreview = document.getElementById('colorPreview');
        const hexInput = document.getElementById('hexInput');
        
        colorPreview.style.backgroundColor = currentColor;
        hexInput.value = currentColor;
        
        // Draw the color wheel with the current color selected
        ColorPickerWheel.drawColorWheel(currentColor);
        
        // Show the modal
        colorPicker.style.display = 'block';
    }
    
    /**
     * Update a color from the hex input field
     * @param {HTMLInputElement} input - The hex input element
     */
    updateColorFromInput(input) {
        const index = parseInt(input.dataset.index, 10);
        if (!this.allowHexEditing) {
            input.value = this.colors[index];
            return;
        }

        let color = input.value.trim();
        
        // Validate and normalize the color
        if (ColorUtils.isValidHex(color)) {
            color = ColorUtils.normalizeHex(color);
            this.colors[index] = color;
            
            // Update the color ball
            const colorBalls = this.container.querySelectorAll('.color-ball');
            colorBalls[index].style.backgroundColor = color;
            
            input.value = color;
        } else {
            // Revert to the original color
            input.value = this.colors[index];
            alert('Invalid hex color code. Please use format #RRGGBB or #RGB.');
        }
    }
    
    /**
     * Apply the selected color to the grid selection
     * @param {Number} index - Index of the color in the palette
     */
    applySelectedColor(index) {
        const color = this.colors[index];
        this.hexGrid.applyColorToSelection(color);
        if (this.useTwoColumnPalette) {
            this.createPaletteUI({ skipGridSave: true });
        }
        this.updateColorCountDisplay();
        // Save grid state asynchronously after color reduction is complete
        setTimeout(() => {
            this.hexGrid.saveState();
        }, 0);
    }
    
    /**
     * Update the color from the color picker
     * @param {String} color - New color in hex format
     */
    updateColorFromPicker(color) {
        if (!this.allowColorPicker) {
            return;
        }

        if (this.selectedColorIndex >= 0 && this.selectedColorIndex < this.colors.length) {
            this.colors[this.selectedColorIndex] = color;
            this.createPaletteUI(); // Refresh the palette UI
        }
    }
    
    /**
     * Export the current palette to a JSON file
     */
    exportPalette() {
        const palette = {
            name: 'Custom Palette',
            description: 'Exported from Bead Color Changer',
            timestamp: new Date().toISOString(),
            colors: this.colors
        };
        
        const dataStr = JSON.stringify(palette, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportName = 'bead_palette_' + new Date().toISOString().slice(0, 10) + '.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportName);
        linkElement.click();
    }
    
    /**
     * Import a palette from a JSON file
     */
    importPalette() {
        const paletteInput = document.getElementById('paletteInput');
        if (paletteInput) {
            paletteInput.click();
        }
    }
    
    /**
     * Handle the palette file selection
     * @param {Event} event - File input change event
     */
    handlePaletteFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const palette = JSON.parse(e.target.result);
                
                if (Array.isArray(palette.colors) && palette.colors.length > 0) {
                    // Validate all colors
                    const validColors = palette.colors.filter(color => ColorUtils.isValidHex(color));
                    
                    if (validColors.length > 0) {
                        this.colors = validColors.map(color => ColorUtils.normalizeHex(color));
                        this.createPaletteUI();
                        
                        // Show success message
                        alert(`Palette imported successfully with ${this.colors.length} colors.`);
                    } else {
                        alert('No valid colors found in the palette file.');
                    }
                } else {
                    alert('Invalid palette format. No colors found.');
                }
            } catch (error) {
                alert('Error parsing palette file: ' + error.message);
            }
        };
        
        reader.readAsText(file);
        
        // Reset the file input
        event.target.value = '';
    }
    
    /**
     * Apply color reduction to the grid
     */
    applyColorReduction() {
        const targetCountInput = document.getElementById('targetColorCount');
        const targetCount = parseInt(targetCountInput.value);
        
        if (isNaN(targetCount) || targetCount < 1) {
            alert('Please enter a valid target color count (minimum 1).');
            return;
        }
        
        // Get all colors currently used in the grid
        const gridColors = this.hexGrid.getAllColors();
        
        // Get original image colors from the ColorPalette instance
        let originalImageColors = [];
        if (window.colorPalette && window.colorPalette.originalImageColors) {
            originalImageColors = Object.keys(window.colorPalette.originalImageColors);
        }
        
        if (gridColors.length <= targetCount) {
            alert(`The grid already uses ${gridColors.length} colors, which is less than or equal to the target of ${targetCount}.`);
            return;
        }
        
        // Reduce colors using k-means clustering
        const reducedColors = ColorUtils.reduceColors(gridColors, targetCount);
        
        // Create a mapping from old colors to new colors
        const colorMap = {};
        gridColors.forEach(oldColor => {
            const closestColor = ColorUtils.findClosestColor(oldColor, reducedColors);
            colorMap[oldColor] = closestColor;
        });
        
        // Apply the color mapping to the grid
        this.hexGrid.applyColorMapping(colorMap);
        
        if (this.useDetectedColorsAsPalette) {
            // Update the palette with the reduced colors
            this.colors = reducedColors;
            this.createPaletteUI();
        } else if (this.useTwoColumnPalette) {
            this.createPaletteUI({ skipGridSave: true });
        }
        
        // Update color count display
        this.updateColorCountDisplay();
        // Save grid state asynchronously after color reduction is complete
        setTimeout(() => {
            this.hexGrid.saveState();
        }, 0);
    }
    
    /**
     * Update the color count display
     */
    updateColorCountDisplay() {
        const colorCounts = this.hexGrid.getColorCounts();
        const uniqueColors = Object.keys(colorCounts).length;
        
        document.getElementById('currentColorCount').textContent = uniqueColors.toString();
    }
    
    /**
     * Set the original image colors and update the palette with top colors
     * @param {Object} colorCounts - Map of colors to their counts
     */
    setOriginalImageColors(colorCounts) {
        this.originalImageColors = {...colorCounts};

        if (this.useDetectedColorsAsPalette) {
            // Extract the top 10 most used colors
            this.extractTopColors(colorCounts);
        } else if (this.useTwoColumnPalette) {
            this.createPaletteUI({ skipGridSave: true });
        }
        
        // Update the color count display
        this.updateColorCountDisplay();
        // Save grid state asynchronously after color reduction is complete
        setTimeout(() => {
            this.hexGrid.saveState();
        }, 0);
    }
    
    /**
     * Extract the top 10 most used and most intense colors from the image
     * @param {Object} colorCounts - Map of colors to their counts
     */
    extractTopColors(colorCounts) {
        // Convert the color counts to an array of [color, count] pairs
        const colorPairs = Object.entries(colorCounts);
        
        // Sort by count (most used first)
        colorPairs.sort((a, b) => b[1] - a[1]);
        
        // Calculate color intensity for each color
        const colorIntensities = colorPairs.map(([color, count]) => {
            const rgb = ColorUtils.hexToRgb(color);
            // Simple intensity calculation (sum of RGB values)
            const intensity = rgb.r + rgb.g + rgb.b;
            return { color, count, intensity };
        });
        
        // Sort by count first, then by intensity for ties
        colorIntensities.sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count; // Most used first
            }
            return b.intensity - a.intensity; // Most intense first for ties
        });
        
        // Always take exactly 10 colors
        const topColors = [];
        
        // Add the most used colors first (up to 10)
        for (let i = 0; i < Math.min(10, colorIntensities.length); i++) {
            topColors.push(colorIntensities[i].color);
        }
        
        // If we have fewer than 10 colors, fill with white
        while (topColors.length < 10) {
            topColors.push('#FFFFFF');
        }
        
        // Ensure we have exactly 10 colors
        this.colors = topColors.slice(0, 10);
        
        // Refresh the palette UI
        this.createPaletteUI();
    }
    
    /**
     * Get the current palette colors
     * @returns {Array} Array of hex color strings
     */
    getPaletteColors() {
        return [...this.colors];
    }

    /**
     * Snap the active grid colors to the configured palette catalog.
     */
    constrainGridToFullPalette() {
        if (!this.hexGrid || !Array.isArray(this.fullPalette) || this.fullPalette.length === 0) {
            return;
        }

        let changed = false;

        Object.keys(this.hexGrid.gemColors).forEach((key) => {
            const currentColor = ColorUtils.normalizeHex(this.hexGrid.gemColors[key]);
            if (this.fullPalette.includes(currentColor)) {
                this.hexGrid.gemColors[key] = currentColor;
                return;
            }

            this.hexGrid.gemColors[key] = ColorUtils.findClosestColor(currentColor, this.fullPalette);
            changed = true;
        });

        if (changed) {
            this.hexGrid.render();
            this.hexGrid.saveState();
        }
    }
    
    /**
     * Update the selected color display
     * @param {String} color - The selected color in hex format
     */
    updateSelectedColorDisplay(color) {
        if (!color) return;
        
        // Store the selected color
        this.selectedHexColor = color;
        
        // Update the display
        const preview = document.getElementById('selectedColorPreview');
        const hexDisplay = document.getElementById('selectedColorHex');
        
        if (preview && hexDisplay) {
            preview.style.backgroundColor = color;
            hexDisplay.textContent = color.toUpperCase();
            hexDisplay.classList.remove('copied');
        }
    }
    
    /**
     * Copy the selected color hex code to clipboard
     */
    copySelectedColorToClipboard() {
        if (!this.selectedHexColor) return;
        
        const hexDisplay = document.getElementById('selectedColorHex');
        
        // Use the Clipboard API to copy the text
        navigator.clipboard.writeText(this.selectedHexColor)
            .then(() => {
                // Show feedback that it was copied
                hexDisplay.classList.add('copied');
                
                // Reset the copied state after a short delay
                setTimeout(() => {
                    hexDisplay.classList.remove('copied');
                }, 1500);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                alert('Failed to copy color code to clipboard');
            });
    }
}
