/**
 * Color Utilities for Bead Color Changer
 * Provides functions for color manipulation, conversion, and comparison
 */

const ColorUtils = {
    /**
     * Convert RGB values to a hex color string
     * @param {Number} r - Red value (0-255)
     * @param {Number} g - Green value (0-255)
     * @param {Number} b - Blue value (0-255)
     * @returns {String} Hex color string (e.g., "#FF5500")
     */
    rgbToHex: function(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    },
    
    /**
     * Convert a hex color string to RGB values
     * @param {String} hex - Hex color string (e.g., "#FF5500")
     * @returns {Object} Object with r, g, b properties
     */
    hexToRgb: function(hex) {
        // Remove # if present
        hex = hex.replace(/^#/, '');
        
        // Parse the hex values
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        
        return { r, g, b };
    },
    
    /**
     * Calculate the Euclidean distance between two colors in RGB space
     * @param {Object} color1 - First color as {r, g, b}
     * @param {Object} color2 - Second color as {r, g, b}
     * @returns {Number} Distance between the colors
     */
    colorDistance: function(color1, color2) {
        return Math.sqrt(
            Math.pow(color1.r - color2.r, 2) +
            Math.pow(color1.g - color2.g, 2) +
            Math.pow(color1.b - color2.b, 2)
        );
    },
    
    /**
     * Find the closest color from a palette to a target color
     * @param {String} targetHex - Target color in hex format
     * @param {Array} palette - Array of hex color strings
     * @returns {String} Closest matching color from the palette
     */
    findClosestColor: function(targetHex, palette) {
        const targetRgb = this.hexToRgb(targetHex);
        let closestColor = palette[0];
        let minDistance = Number.MAX_VALUE;
        
        for (const color of palette) {
            const colorRgb = this.hexToRgb(color);
            const distance = this.colorDistance(targetRgb, colorRgb);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestColor = color;
            }
        }
        
        return closestColor;
    },
    
    /**
     * Convert HSV to RGB
     * @param {Number} h - Hue (0-360)
     * @param {Number} s - Saturation (0-1)
     * @param {Number} v - Value (0-1)
     * @returns {Object} RGB values as {r, g, b}
     */
    hsvToRgb: function(h, s, v) {
        let r, g, b;
        
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    },
    
    /**
     * Convert RGB to HSV
     * @param {Number} r - Red (0-255)
     * @param {Number} g - Green (0-255)
     * @param {Number} b - Blue (0-255)
     * @returns {Object} HSV values as {h, s, v}
     */
    rgbToHsv: function(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max;
        
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        
        if (max === min) {
            h = 0; // achromatic
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        return { h, s, v };
    },
    
    /**
     * Validate a hex color string
     * @param {String} hex - Hex color string to validate
     * @returns {Boolean} True if valid, false otherwise
     */
    isValidHex: function(hex) {
        return /^#?([0-9A-F]{3}|[0-9A-F]{6})$/i.test(hex);
    },
    
    /**
     * Ensure a hex color string has a # prefix
     * @param {String} hex - Hex color string
     * @returns {String} Hex color with # prefix
     */
    normalizeHex: function(hex) {
        // Add # if missing
        if (!hex.startsWith('#')) {
            hex = '#' + hex;
        }
        
        // Convert short form (#RGB) to long form (#RRGGBB)
        if (hex.length === 4) {
            const r = hex[1];
            const g = hex[2];
            const b = hex[3];
            hex = `#${r}${r}${g}${g}${b}${b}`;
        }
        
        return hex.toUpperCase();
    },
    
    /**
     * Generate a palette of colors using k-means clustering
     * @param {Array} colors - Array of hex color strings
     * @param {Number} k - Number of colors to generate
     * @returns {Array} Array of k hex color strings
     */
    reduceColors: function(colors, k) {
        if (colors.length <= k) {
            return colors;
        }
        
        // Check if we already have a color palette (after first image load)
        if (window.colorPalette && window.colorPalette.colors && window.colorPalette.colors.length > 0) {
            console.log('Using existing color palette for reduction');
            
            // Get the current palette colors
            const paletteColors = window.colorPalette.colors.filter(color => color !== '#FFFFFF');
            console.log('Available palette colors:', paletteColors);
            
            // If we have palette colors, use them for mapping
            if (paletteColors.length > 0) {
                // Create a set of unique colors to reduce (up to k)
                const uniqueColors = new Set();
                
                // First try to map all colors to the closest palette color
                const colorMapping = {};
                
                for (const color of colors) {
                    // Find the closest palette color
                    const closestColor = this.findClosestColor(color, paletteColors);
                    colorMapping[color] = closestColor;
                    uniqueColors.add(closestColor);
                    
                    // If we've reached our target number of colors, stop adding new mappings
                    if (uniqueColors.size >= k) {
                        break;
                    }
                }
                
                // Get the resulting unique colors (up to k)
                const resultColors = Array.from(uniqueColors).slice(0, k);
                
                // If we still don't have enough colors, add some from the palette
                while (resultColors.length < k && resultColors.length < paletteColors.length) {
                    const nextColor = paletteColors[resultColors.length];
                    if (!resultColors.includes(nextColor)) {
                        resultColors.push(nextColor);
                    }
                }
                
                console.log('Reduced to these palette colors:', resultColors);
                return resultColors;
            }
        }
        
        // For the first image load, or if no palette is available, use the original k-means clustering
        console.log('No palette available or first image load - using k-means clustering');
        
        // Convert colors to RGB arrays for clustering
        const rgbColors = colors.map(hex => {
            const rgb = this.hexToRgb(hex);
            return [rgb.r, rgb.g, rgb.b];
        });
        
        // Simple k-means implementation
        // Initialize centroids using most frequent colors
        let centroids = [];
        
        // Count color frequency
        const colorFrequency = {};
        colors.forEach(color => {
            colorFrequency[color] = (colorFrequency[color] || 0) + 1;
        });
        
        // Sort colors by frequency (most frequent first)
        const sortedColors = Object.keys(colorFrequency).sort((a, b) => {
            return colorFrequency[b] - colorFrequency[a];
        });
        
        // Select the k most frequent colors as initial centroids
        for (let i = 0; i < Math.min(k, sortedColors.length); i++) {
            const rgb = this.hexToRgb(sortedColors[i]);
            centroids.push([rgb.r, rgb.g, rgb.b]);
        }
        
        // If we don't have enough distinct colors, add some colors from the original image
        console.log('Initial centroids:', centroids);
        console.log('RGB colors length:', rgbColors.length);
        
        if (centroids.length < k) {
            // Try to get original image colors from the ColorPalette instance
            let originalImageColors = [];
            
            // Check if we can access the ColorPalette instance
            if (window.colorPalette && window.colorPalette.originalImageColors) {
                // Get colors from the original image
                originalImageColors = Object.keys(window.colorPalette.originalImageColors);
                console.log('Original image colors available:', originalImageColors.length);
            }
            
            // If we have original image colors, use them
            if (originalImageColors.length > 0) {
                // Sort by frequency (most used first)
                originalImageColors.sort((a, b) => {
                    const countA = window.colorPalette.originalImageColors[a] || 0;
                    const countB = window.colorPalette.originalImageColors[b] || 0;
                    return countB - countA; // Most frequent first
                });
                
                console.log('Original image colors sorted by frequency:', originalImageColors.slice(0, 10));
                
                // Add colors from the original image until we have enough
                for (let i = 0; i < originalImageColors.length && centroids.length < k; i++) {
                    const color = originalImageColors[i];
                    const rgb = this.hexToRgb(color);
                    
                    // Check if this color is already in centroids
                    let isDuplicate = false;
                    for (const centroid of centroids) {
                        if (centroid[0] === rgb.r && centroid[1] === rgb.g && centroid[2] === rgb.b) {
                            isDuplicate = true;
                            break;
                        }
                    }
                    
                    if (!isDuplicate) {
                        centroids.push([rgb.r, rgb.g, rgb.b]);
                        console.log('Added color from original image:', color);
                    }
                }
            }
            
            // If we still don't have enough, use colors from the current image
            if (centroids.length < k) {
                console.log('Still need more colors, using colors from current image');
                const usedIndices = new Set();
                while (centroids.length < k) {
                    const idx = Math.floor(Math.random() * rgbColors.length);
                    if (!usedIndices.has(idx)) {
                        usedIndices.add(idx);
                        centroids.push([...rgbColors[idx]]);
                    }
                    
                    // Prevent infinite loop if we run out of colors
                    if (usedIndices.size >= rgbColors.length) {
                        break;
                    }
                }
            }
        }
        
        const MAX_ITERATIONS = 50;
        let iterations = 0;
        let changed = true;
        
        // Cluster assignments
        let clusters = new Array(rgbColors.length).fill(0);
        
        // Iterate until convergence or max iterations
        while (changed && iterations < MAX_ITERATIONS) {
            changed = false;
            iterations++;
            
            // Assign points to nearest centroid
            for (let i = 0; i < rgbColors.length; i++) {
                const point = rgbColors[i];
                let minDist = Infinity;
                let newCluster = 0;
                
                for (let j = 0; j < centroids.length; j++) {
                    const centroid = centroids[j];
                    const dist = Math.sqrt(
                        Math.pow(point[0] - centroid[0], 2) +
                        Math.pow(point[1] - centroid[1], 2) +
                        Math.pow(point[2] - centroid[2], 2)
                    );
                    
                    if (dist < minDist) {
                        minDist = dist;
                        newCluster = j;
                    }
                }
                
                if (clusters[i] !== newCluster) {
                    clusters[i] = newCluster;
                    changed = true;
                }
            }
            
            // Update centroids
            const counts = new Array(k).fill(0);
            const newCentroids = Array(k).fill().map(() => [0, 0, 0]);
            
            for (let i = 0; i < rgbColors.length; i++) {
                const cluster = clusters[i];
                const point = rgbColors[i];
                
                newCentroids[cluster][0] += point[0];
                newCentroids[cluster][1] += point[1];
                newCentroids[cluster][2] += point[2];
                counts[cluster]++;
            }
            
            for (let i = 0; i < k; i++) {
                if (counts[i] > 0) {
                    centroids[i][0] = Math.round(newCentroids[i][0] / counts[i]);
                    centroids[i][1] = Math.round(newCentroids[i][1] / counts[i]);
                    centroids[i][2] = Math.round(newCentroids[i][2] / counts[i]);
                }
            }
        }
        
        // Convert centroids back to hex colors
        return centroids.map(centroid => 
            this.rgbToHex(centroid[0], centroid[1], centroid[2])
        );
    }
};
