/**
 * Image Processing Implementation
 * Handles loading, processing, and mapping images to the hex grid
 */

const ImageProcessor = {
    /**
     * Load an image and map it to the hex grid
     * @param {File} imageFile - The image file to load
     * @param {GemGrid} gemGrid - The hex grid to map the image to
     * @param {ColorPalette} colorPalette - The color palette to use
     */
    loadImageToGrid: function(imageFile, gemGrid, colorPalette) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        this.processImage(img, gemGrid, colorPalette);
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
     * @param {GemGrid} gemGrid - The hex grid to map the image to
     * @param {ColorPalette} colorPalette - The color palette to use
     */
    processImage: function(img, gemGrid, colorPalette) {
        // Create a temporary canvas to process the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Resize the image to match the grid dimensions
        const gridWidth = gemGrid.cols * gemGrid.colWidth;
        const gridHeight = gemGrid.rows * gemGrid.rowHeight;
        
        canvas.width = gemGrid.cols;
        canvas.height = gemGrid.rows;
        
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
        
        // Save state will be done asynchronously after rendering, not here
        
        // Debug: Log gemGrid and gemGrid.gemColors before processing
        if (!gemGrid || typeof gemGrid !== 'object') {
            console.error('gemGrid is not a valid object:', gemGrid);
        } else if (typeof gemGrid.gemColors === 'undefined') {
            console.error('gemGrid.gemColors is undefined at start of processing:', gemGrid);
        } else if (typeof gemGrid.gemColors !== 'object') {
            console.error('gemGrid.gemColors is not an object:', gemGrid.gemColors);
        }
        // Map pixels to hex grid
        for (let row = 0; row < gemGrid.rows; row++) {
            for (let col = 0; col < gemGrid.cols; col++) {
                // Get pixel color at this position
                const x = Math.min(col, canvas.width - 1);
                const y = Math.min(row, canvas.height - 1);
                const pixelIndex = (y * canvas.width + x) * 4;
                
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                // Convert to hex
                const gemColor = ColorUtils.rgbToHex(r, g, b);
                
                // Find closest color in the full palette
                // We use the full palette loaded from full_color_palette.json
                const closestColor = ColorUtils.findClosestColor(gemColor, colorPalette.fullPalette);
                
                // Set the color in the grid (support both GemGrid and GemGrid)
                if (gemGrid.gemColors !== undefined) {
                    gemGrid.gemColors[`${col},${row}`] = closestColor;
                }else{
                    console.error('gemGrid.gemColors is undefined');
                }
                // Track color frequency
                colorCounts[closestColor] = (colorCounts[closestColor] || 0) + 1;
            }
        }
        
        // Save all unique hex colors from the image for future color reduction
        if (typeof window !== 'undefined') {
            window.originalImageColors = Object.keys(colorCounts);
            if (!window.firstImagePaletteCounts) {
                window.firstImagePaletteCounts = { ...colorCounts };
            }
            if (!window.firstImagePalette) {
                window.firstImagePalette = Object.keys(colorCounts);
                console.log('First image color palette:', window.firstImagePalette);
            }
        }
        // Update the color palette with the image colors
        colorPalette.setOriginalImageColors(colorCounts);
        
        // Render the grid
        gemGrid.render();
        // Save state asynchronously after rendering is complete
        setTimeout(() => {
            gemGrid.saveState();
        }, 0);
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
