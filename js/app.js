/**
 * Main Application Script
 * Initializes and coordinates all components of the Bead Color Changer
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the hex grid
    const hexGrid = new HexGrid('hexGrid', 64, 40);
    
    // Initialize the color palette
    const colorPalette = new ColorPalette('colorPaletteContainer', hexGrid);
    
    // Make the color palette globally accessible
    window.colorPalette = colorPalette;
    
    // Store a reference to the color palette in its container for access from other components
    document.getElementById('colorPaletteContainer').parentNode.colorPalette = colorPalette;
    
    // Initialize the color picker
    ColorPickerWheel.init();
    
    // Set up event listeners for grid controls
    setupGridControls(hexGrid, colorPalette);
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts(hexGrid);
});

/**
 * Set up event listeners for grid controls
 * @param {HexGrid} hexGrid - The hex grid instance
 * @param {ColorPalette} colorPalette - The color palette instance
 */
function setupGridControls(hexGrid, colorPalette) {
    // Clear selection button
    document.getElementById('clearSelection').addEventListener('click', function() {
        hexGrid.selectedCells.clear();
        hexGrid.render();
    });
    
    // Undo button
    document.getElementById('undoButton').addEventListener('click', function() {
        if (hexGrid.historyIndex > 0) {
            hexGrid.historyIndex--;
            const historyState = hexGrid.history[hexGrid.historyIndex];
            hexGrid.hexColors = JSON.parse(JSON.stringify(historyState.hexColors));
            hexGrid.render();
        }
    });
    
    // Redo button
    document.getElementById('redoButton').addEventListener('click', function() {
        if (hexGrid.historyIndex < hexGrid.history.length - 1) {
            hexGrid.historyIndex++;
            const historyState = hexGrid.history[hexGrid.historyIndex];
            hexGrid.hexColors = JSON.parse(JSON.stringify(historyState.hexColors));
            hexGrid.render();
        }
    });
    // Clear grid button
    document.getElementById('clearGrid').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear the grid? This cannot be undone.')) {
            hexGrid.clearGrid();
            colorPalette.updateColorCountDisplay();
        }
    });
    
    // Export PNG button
    document.getElementById('exportPNG').addEventListener('click', function() {
        const dataURL = hexGrid.exportToPNG();
        
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'bead_art_' + new Date().toISOString().slice(0, 10) + '.png';
        link.click();
    });
    
    // Save grid button
    document.getElementById('saveGrid').addEventListener('click', function() {
        const gridData = hexGrid.saveToJSON();
        
        // Add palette colors to the saved data
        gridData.palette = colorPalette.getPaletteColors();
        
        const dataStr = JSON.stringify(gridData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportName = 'bead_grid_' + new Date().toISOString().slice(0, 10) + '.json';
        
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = exportName;
        link.click();
    });
    
    // Load grid button
    document.getElementById('loadGrid').addEventListener('click', function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const gridData = JSON.parse(e.target.result);
                    
                    // Load the grid data
                    hexGrid.loadFromJSON(gridData);
                    
                    // Load the palette if it exists
                    if (gridData.palette && Array.isArray(gridData.palette)) {
                        colorPalette.colors = gridData.palette.map(color => ColorUtils.normalizeHex(color));
                        colorPalette.createPaletteUI();
                    }
                    
                    colorPalette.updateColorCountDisplay();
                    
                    alert('Grid loaded successfully.');
                } catch (error) {
                    alert('Error loading grid: ' + error.message);
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    });
    
    // Load image button
    document.getElementById('loadImage').addEventListener('click', function() {
        document.getElementById('imageInput').click();
    });
    
    // Image input change
    document.getElementById('imageInput').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Check if it's an image
        if (!file.type.match('image.*')) {
            alert('Please select an image file.');
            return;
        }
        
        // Process the image
        ImageProcessor.loadImageToGrid(file, hexGrid, colorPalette)
            .then(() => {
                alert('Image loaded successfully.');
            })
            .catch(error => {
                alert('Error loading image: ' + error.message);
            });
        
        // Reset the file input
        this.value = '';
    });
}

/**
 * Set up keyboard shortcuts
 * @param {HexGrid} hexGrid - The hex grid instance
 */
function setupKeyboardShortcuts(hexGrid) {
    document.addEventListener('keydown', function(event) {
        // Ctrl+Z: Undo
        if (event.ctrlKey && event.key === 'z') {
            hexGrid.undo();
            event.preventDefault();
        }
        
        // Ctrl+Y: Redo
        if (event.ctrlKey && event.key === 'y') {
            hexGrid.redo();
            event.preventDefault();
        }
        
        // Escape: Clear selection
        if (event.key === 'Escape') {
            hexGrid.selectedCells.clear();
            hexGrid.render();
            event.preventDefault();
        }
    });
}
