/**
 * Main Application Script
 * Initializes and coordinates all components of the Bead Color Changer
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the hex grid
    const gemGrid = new GemGrid('gemGrid', 64, 40); 
    
    // Initialize the color palette
    const colorPalette = new ColorPalette('colorPaletteContainer', gemGrid);
    
    // Make the color palette globally accessible
    window.colorPalette = colorPalette;
    
    // Store a reference to the color palette in its container for access from other components
    document.getElementById('colorPaletteContainer').parentNode.colorPalette = colorPalette;
    
    // Initialize the color picker
    ColorPickerWheel.init();
    
    // Set up event listeners for grid controls
    setupGridControls(gemGrid, colorPalette);
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts(gemGrid);
});

/**
 * Set up event listeners for grid controls
 * @param {gemGrid} gemGrid - The hex grid instance
 * @param {ColorPalette} colorPalette - The color palette instance
 */
function setupGridControls(gemGrid, colorPalette) {
    // Clear selection button
    document.getElementById('clearSelection').addEventListener('click', function() {
        gemGrid.selectedCells.clear();
        gemGrid.render();
    });
    
    // Undo button
    document.getElementById('undoButton').addEventListener('click', function() {
        if (gemGrid.historyIndex > 0) {
            gemGrid.historyIndex--;
            const historyState = gemGrid.history[gemGrid.historyIndex];
            gemGrid.hexColors = JSON.parse(JSON.stringify(historyState.hexColors));
            gemGrid.render();
        }
    });
    
    // Redo button
    document.getElementById('redoButton').addEventListener('click', function() {
        if (gemGrid.historyIndex < gemGrid.history.length - 1) {
            gemGrid.historyIndex++;
            const historyState = gemGrid.history[gemGrid.historyIndex];
            gemGrid.hexColors = JSON.parse(JSON.stringify(historyState.hexColors));
            gemGrid.render();
        }
    });
    // Clear grid button
    document.getElementById('clearGrid').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear the grid? This cannot be undone.')) {
            gemGrid.clearGrid();
            colorPalette.updateColorCountDisplay();
        }
    });
    
    // Export PNG button
    document.getElementById('exportPNG').addEventListener('click', function() {
        const dataURL = gemGrid.exportToPNG();
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'bead_art_' + new Date().toISOString().slice(0, 10) + '.png';
        link.click();
    });

    // Save PNG (Color Only) button
    document.getElementById('savePNG').addEventListener('click', function() {
        try {
            alert('Save PNG (Color Only) button clicked.');
            const dataURL = gemGrid.exportColorOnlyPNG();
            if (!dataURL || !dataURL.startsWith('data:image/png')) {
                alert('PNG generation failed.');
                return;
            }
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = 'bead_art_color_only_' + new Date().toISOString().slice(0, 10) + '.png';
            link.click();
        } catch (e) {
            alert('Error during Save PNG: ' + e.message);
        }
    });
    
    // Save 64x40 button
    document.getElementById('save64x40').addEventListener('click', function() {
        try {
            const dataURL = gemGrid.export64x40PNG();
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = 'bead_art_64x40_' + new Date().toISOString().slice(0, 10) + '.png';
            link.click();
        } catch (e) {
            alert('Error during Save 64x40: ' + e.message);
        }
    });
    
    // Save grid button
    document.getElementById('saveGrid').addEventListener('click', function() {
        const gridData = gemGrid.saveToJSON();
        
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
                    gemGrid.loadFromJSON(gridData);
                    
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
        ImageProcessor.loadImageToGrid(file, gemGrid, colorPalette)
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
 * @param {gemGrid} gemGrid - The hex grid instance
 */
function setupKeyboardShortcuts(gemGrid) {
    document.addEventListener('keydown', function(event) {
        // Ctrl+Z: Undo
        if (event.ctrlKey && event.key === 'z') {
            gemGrid.undo();
            event.preventDefault();
        }
        
        // Ctrl+Y: Redo
        if (event.ctrlKey && event.key === 'y') {
            gemGrid.redo();
            event.preventDefault();
        }
        
        // Escape: Clear selection
        if (event.key === 'Escape') {
            gemGrid.selectedCells.clear();
            gemGrid.render();
            event.preventDefault();
        }
    });
}
