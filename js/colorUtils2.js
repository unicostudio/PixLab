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
    // Helper function to find the closest color in a palette
    findClosestColor: function(color, palette) {
        const rgb = this.hexToRgb(color);
        const colorRgb = [rgb.r, rgb.g, rgb.b];
        
        let closestColor = palette[0];
        let minDistance = Infinity;
        
        for (const paletteColor of palette) {
            const paletteRgb = this.hexToRgb(paletteColor);
            
            // Calculate Euclidean distance in RGB space
            const distance = Math.sqrt(
                Math.pow(colorRgb[0] - paletteRgb.r, 2) +
                Math.pow(colorRgb[1] - paletteRgb.g, 2) +
                Math.pow(colorRgb[2] - paletteRgb.b, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestColor = paletteColor;
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
        
        console.log('Using new color reduction method: pick least color and round to nearest');
        
        // Convert colors to RGB arrays for numerical comparison
        const rgbColors = colors.map(hex => {
            const rgb = this.hexToRgb(hex);
            return {
                hex: hex,
                rgb: [rgb.r, rgb.g, rgb.b],
                value: rgb.r + rgb.g + rgb.b // Numerical value of the color
            };
        });
        
        // Sort colors by their numerical value (sum of R+G+B)
        rgbColors.sort((a, b) => a.value - b.value);
        
        // Take the k lowest-value colors as our base palette
        const basePalette = rgbColors.slice(0, k);
        console.log('Base palette (lowest value colors):', basePalette.map(c => c.hex));
        
        // Create a set to hold our final unique colors
        const uniqueColors = new Set();
        
        // For each color, find its closest match in the base palette
        for (const color of colors) {
            const rgb = this.hexToRgb(color);
            const colorRgb = [rgb.r, rgb.g, rgb.b];
            
            // Find the closest color in our base palette
            let closestColor = basePalette[0].hex;
            let minDistance = Infinity;
            
            for (const paletteColor of basePalette) {
                const paletteRgb = paletteColor.rgb;
                
                // Calculate Euclidean distance in RGB space
                const distance = Math.sqrt(
                    Math.pow(colorRgb[0] - paletteRgb[0], 2) +
                    Math.pow(colorRgb[1] - paletteRgb[1], 2) +
                    Math.pow(colorRgb[2] - paletteRgb[2], 2)
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestColor = paletteColor.hex;
                }
            }
            
            // Add the closest base color to our result set
            uniqueColors.add(closestColor);
            
            // If we've reached our target number of colors, stop adding new mappings
            if (uniqueColors.size >= k) {
                break;
            }
        }
        
        // Get the resulting unique colors (up to k)
        let resultColors = Array.from(uniqueColors).slice(0, k);
        
        // If we don't have enough colors, add more from the base palette
        if (resultColors.length < k) {
            for (const baseColor of basePalette) {
                if (!resultColors.includes(baseColor.hex)) {
                    resultColors.push(baseColor.hex);
                    if (resultColors.length >= k) {
                        break;
                    }
                }
            }
        }
        
        console.log('Reduced to these colors:', resultColors);
        return resultColors;
    }
};
