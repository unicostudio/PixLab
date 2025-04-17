/**
 * Image Processing Implementation
 * Handles loading, processing, and mapping images to the hex grid
 */

const ImageProcessor = {
    /**
     * Load an image and map it to the hex grid
     * @param {File} imageFile - The image file to load
     * @param {HexGrid} hexGrid - The hex grid to map the image to
     * @param {ColorPalette} colorPalette - The color palette to use
     */
    loadImageToGrid: function(imageFile, hexGrid, colorPalette) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        this.processImage(img, hexGrid, colorPalette);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                
                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };
                
                img.src = event.target.result;
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read image file'));
            };
            
            reader.readAsDataURL(imageFile);
        });
    },
    
    /**
     * Process the image and map it to the hex grid
     * @param {HTMLImageElement} img - The image element
     * @param {HexGrid} hexGrid - The hex grid to map the image to
     * @param {ColorPalette} colorPalette - The color palette to use
     */
    processImage: function(img, hexGrid, colorPalette) {
        // Create a temporary canvas to process the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Resize the image to match the grid dimensions
        const gridWidth = hexGrid.cols * hexGrid.colWidth;
        const gridHeight = hexGrid.rows * hexGrid.rowHeight;
        
        canvas.width = hexGrid.cols;
        canvas.height = hexGrid.rows;
        
        // Calculate scaling to maintain aspect ratio
        const imgAspect = img.width / img.height;
        const gridAspect = gridWidth / gridHeight;
        
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
        
        if (imgAspect > gridAspect) {
            // Image is wider than grid
            drawHeight = canvas.height;
            drawWidth = img.width * (drawHeight / img.height);
            offsetX = (canvas.width - drawWidth) / 2;
        } else {
            // Image is taller than grid
            drawWidth = canvas.width;
            drawHeight = img.height * (drawWidth / img.width);
            offsetY = (canvas.height - drawHeight) / 2;
        }
        
        // Draw the image to the canvas
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        // Get the image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Track color frequencies
        const colorCounts = {};
        
        // Save current grid state for undo
        hexGrid.saveState();
        
        // Map pixels to hex grid
        for (let row = 0; row < hexGrid.rows; row++) {
            for (let col = 0; col < hexGrid.cols; col++) {
                // Get pixel color at this position
                const x = Math.min(col, canvas.width - 1);
                const y = Math.min(row, canvas.height - 1);
                const pixelIndex = (y * canvas.width + x) * 4;
                
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                // Convert to hex
                const hexColor = ColorUtils.rgbToHex(r, g, b);
                
                // Find closest color in the full palette
                // We use the full palette loaded from full_color_palette.json
                const closestColor = ColorUtils.findClosestColor(hexColor, colorPalette.fullPalette);
                
                // Set the color in the grid
                hexGrid.hexColors[`${col},${row}`] = closestColor;
                
                // Track color frequency
                colorCounts[closestColor] = (colorCounts[closestColor] || 0) + 1;
            }
        }
        
        // Update the color palette with the image colors
        colorPalette.setOriginalImageColors(colorCounts);
        
        // Render the grid
        hexGrid.render();
    },
    
    /**
     * Resize an image while maintaining aspect ratio
     * @param {HTMLImageElement} img - The image element
     * @param {Number} maxWidth - Maximum width
     * @param {Number} maxHeight - Maximum height
     * @returns {Object} Object with width and height properties
     */
    calculateAspectRatioFit: function(img, maxWidth, maxHeight) {
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
        return {
            width: img.width * ratio,
            height: img.height * ratio
        };
    }
};
