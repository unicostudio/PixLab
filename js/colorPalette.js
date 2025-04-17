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
    constructor(containerId, hexGrid) {
        this.container = document.getElementById(containerId);
        this.hexGrid = hexGrid;
        // Always maintain exactly 10 colors (all white by default)
        this.colors = Array(10).fill('#FFFFFF');
        this.fullPalette = []; // Will store all 120 colors from JSON
        this.selectedColorIndex = 0;
        this.originalImageColors = {}; // Track original image colors
        this.selectedHexColor = null; // Currently selected hex color for display
        
        // Load the full color palette from JSON
        this.loadFullColorPalette();
        
        // Create initial palette UI with just white
        this.createPaletteUI();
        
        // Set up event listeners for palette controls
        this.setupEventListeners();
    }
    
    /**
     * Create the color palette UI
     */
    createPaletteUI() {
        // Clear container
        this.container.innerHTML = '';
        
        // Ensure we have exactly 10 colors
        while (this.colors.length < 10) {
            this.colors.push('#FFFFFF');
        }
        if (this.colors.length > 10) {
            this.colors = this.colors.slice(0, 10);
        }
        
        // Create color items - always exactly 10
        this.colors.forEach((color, index) => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            
            // Color ball
            const colorBall = document.createElement('div');
            colorBall.className = 'color-ball';
            colorBall.style.backgroundColor = color;
            colorBall.dataset.index = index;
            colorBall.addEventListener('click', () => this.openColorPicker(index));
            
            // Hex input
            const hexInput = document.createElement('input');
            hexInput.type = 'text';
            hexInput.className = 'color-hex';
            hexInput.value = color;
            hexInput.dataset.index = index;
            hexInput.addEventListener('change', (e) => this.updateColorFromInput(e.target));
            
            // Apply button
            const applyButton = document.createElement('button');
            applyButton.className = 'apply-button';
            applyButton.textContent = 'Apply';
            applyButton.dataset.index = index;
            applyButton.addEventListener('click', () => this.applySelectedColor(index));
            
            // Add elements to color item
            colorItem.appendChild(colorBall);
            colorItem.appendChild(hexInput);
            colorItem.appendChild(applyButton);
            
            // Add to container
            this.container.appendChild(colorItem);
        });
        
        // Update color count display
        this.updateColorCountDisplay();
    }
    
    /**
     * Load colors from the full color palette JSON file
     */
    loadFullColorPalette() {
        fetch('full_color_palette.json')
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
                    console.log(`Loaded ${this.fullPalette.length} colors in full palette`);
                } else {
                    console.error('Invalid color palette format');
                    // Fall back to default colors for full palette
                    this.fullPalette = [
                        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
                        '#FFFFFF', '#000000', '#888888', '#FF8800', '#00FFAA', '#AA00FF'
                    ];
                }
            })
            .catch(error => {
                console.error('Error loading color palette:', error);
                // Fall back to default colors for full palette
                this.fullPalette = [
                    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
                    '#FFFFFF', '#000000', '#888888', '#FF8800', '#00FFAA', '#AA00FF'
                ];
            });
    }
    
    /**
     * Set up event listeners for palette controls
     */
    setupEventListeners() {
        // Export palette button
        document.getElementById('exportPalette').addEventListener('click', () => this.exportPalette());
        
        // Import palette button
        document.getElementById('importPalette').addEventListener('click', () => this.importPalette());
        
        // Import palette file input
        document.getElementById('paletteInput').addEventListener('change', (e) => this.handlePaletteFileSelect(e));
        
        // Apply color reduction button
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
     * Open the color picker for a specific color
     * @param {Number} index - Index of the color in the palette
     */
    openColorPicker(index) {
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
        const index = parseInt(input.dataset.index);
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
        this.updateColorCountDisplay();
    }
    
    /**
     * Update the color from the color picker
     * @param {String} color - New color in hex format
     */
    updateColorFromPicker(color) {
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
        document.getElementById('paletteInput').click();
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
        
        // Update the palette with the reduced colors
        this.colors = reducedColors;
        this.createPaletteUI();
        
        // Update color count display
        this.updateColorCountDisplay();
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
        
        // Extract the top 10 most used colors
        this.extractTopColors(colorCounts);
        
        // Update the color count display
        this.updateColorCountDisplay();
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
