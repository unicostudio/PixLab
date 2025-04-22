/**
 * Gem Grid Implementation
 * Manages the gem grid display, selection, and coloring
 */

class GemGrid {
    /**
     * Initialize the gem grid
     * @param {String} canvasId - ID of the canvas element
     * @param {Number} cols - Number of columns in the grid
     * @param {Number} rows - Number of rows in the grid
     */
    constructor(canvasId, cols = 64, rows = 40) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.gemSize = 8; // Initial size, will be calculated dynamically
        
        // Initialize offset values
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Set initial cols and rows
        this.cols = cols;
        this.rows = rows;
        this.gemColors = {}; // Map of (col,row) to color
        this.selectedCells = new Set(); // Set of selected (col,row) coordinates
        this.isSelecting = false; // Flag for drag selection
        this.history = []; // For undo/redo
        this.historyIndex = -1;
        this.colorSelectedCallbacks = []; // Callbacks for color selection
        
        // Calculate grid dimensions
        this.calculateDimensions();
        
        // Initialize with default color
        this.defaultColor = '#FFFFFF';
        this.initializeGrid();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initial render
        this.render();
    }
    
    /**
     * Calculate dimensions based on gem size
     */
    calculateDimensions() {
        // Get the container dimensions
        const containerWidth = this.canvas.width;
        const containerHeight = this.canvas.height;
        
        // Calculate the optimal gem size to fill the container
        // with the desired number of gems (64x40)
        const targetCols = 64;
        const targetRows = 40;
        
        // Calculate the maximum gem size that would allow us to fit the target grid
        const maxWidthGemSize = containerWidth / targetCols;
        const maxHeightGemSize = containerHeight / targetRows;
        
        // Use the smaller of the two to ensure we can fit both dimensions
        const optimalGemSize = Math.min(maxWidthGemSize, maxHeightGemSize) * 1; // 95% to add some margin
        
        // Update gem size
        this.gemSize = optimalGemSize;
        
        // Gem dimensions
        this.gemWidth = this.gemSize;
        this.gemHeight = this.gemSize;
        
        // Horizontal distance between column centers
        this.colWidth = this.gemWidth;
        
        // Vertical distance between row centers
        this.rowHeight = this.gemHeight;
        
        // Use the target grid dimensions
        this.cols = targetCols;
        this.rows = targetRows;
        
        // Calculate the actual grid size
        this.gridWidth = this.colWidth * this.cols;
        this.gridHeight = this.rowHeight * this.rows;
        
        // Center the grid in the canvas
        this.offsetX = (containerWidth - this.gridWidth) / 2;
        this.offsetY = (containerHeight - this.gridHeight) / 2;
        
        // Calculate corner radius for gems (proportional to gem size)
        this.cornerRadius = this.gemSize * 0.27;
        
        console.log(`Using gem size: ${this.gemSize}, Grid: ${this.cols}x${this.rows}`);
    }
    
    /**
     * Initialize the grid with default colors
     */
    initializeGrid() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                this.gemColors[`${col},${row}`] = this.defaultColor;
            }
        }
    }
    
    /**
     * Set up mouse event listeners
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        
        // Track clicks for double-click detection
        this.lastClickTime = 0;
        this.lastClickCell = null;
    }
    
    /**
     * Handle mouse down event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseDown(event) {
        this.isSelecting = true;
        this.selectedCells.clear();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const cell = this.pixelToGem(x, y);
        if (cell && this.isValidCell(cell.col, cell.row)) {
            this.selectedCells.add(`${cell.col},${cell.row}`);
            this.render();
        }
    }
    
    /**
     * Handle mouse move event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        if (!this.isSelecting) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const cell = this.pixelToGem(x, y);
        if (cell && this.isValidCell(cell.col, cell.row)) {
            this.selectedCells.add(`${cell.col},${cell.row}`);
            this.render();
        }
    }
    
    /**
     * Handle mouse up event
     */
    handleMouseUp() {
        this.isSelecting = false;
    }
    
    /**
     * Handle double click event to select all cells of the same color
     * @param {MouseEvent} event - Mouse event
     */
    handleDoubleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const cell = this.pixelToGem(x, y);
        if (!cell || !this.isValidCell(cell.col, cell.row)) return;
        
        const key = `${cell.col},${cell.row}`;
        const targetColor = this.gemColors[key];
        
        // Clear current selection
        this.selectedCells.clear();
        
        // Select all cells with the same color
        for (const [cellKey, color] of Object.entries(this.gemColors)) {
            if (color === targetColor) {
                this.selectedCells.add(cellKey);
            }
        }
        
        // Notify any listeners about the selected color
        this.notifyColorSelected(targetColor);
        
        // Render to show the selection
        this.render();
    }
    
    /**
     * Convert pixel coordinates to gem grid coordinates
     * @param {Number} x - X coordinate in pixels
     * @param {Number} y - Y coordinate in pixels
     * @returns {Object|null} Object with col and row properties, or null if outside grid
     */
    pixelToGem(x, y) {
        // Adjust for grid offset
        const adjustedX = x - this.offsetX;
        const adjustedY = y - this.offsetY;
        
        // Get the column and row indexes
        const col = Math.floor(adjustedX / this.colWidth);
        const row = Math.floor(adjustedY / this.rowHeight);
        
        // Check if this is a valid cell
        if (this.isValidCell(col, row)) {
            return { col, row };
        }
        
        return null;
    }
    
    /**
     * Convert gem grid coordinates to pixel coordinates
     * @param {Number} col - Column in the gem grid
     * @param {Number} row - Row in the gem grid
     * @returns {Object} Object with x and y properties (center of the gem)
     */
    gemToPixel(col, row) {
        // Calculate x and y coordinates for the center of this gem
        const x = (col + 0.5) * this.colWidth + this.offsetX;
        const y = (row + 0.5) * this.rowHeight + this.offsetY;
        
        return { x, y };
    }
    
    /**
     * Check if cell coordinates are valid
     * @param {Number} col - Column in the gem grid
     * @param {Number} row - Row in the gem grid
     * @returns {Boolean} True if valid, false otherwise
     */
    isValidCell(col, row) {
        return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
    }
    
    /**
     * Draw a gem (rounded square) at the specified coordinates
     * @param {Number} x - X coordinate of gem center
     * @param {Number} y - Y coordinate of gem center
     * @param {String} fillColor - Fill color for the gem
     * @param {Boolean} isSelected - Whether the gem is selected
     */
    drawGem(x, y, fillColor, isSelected) {
        const ctx = this.ctx;
        const halfWidth = this.gemWidth / 2;
        const halfHeight = this.gemHeight / 2;
        const cornerRadius = this.cornerRadius;
        
        // Calculate the gem's bounding box
        const left = x - halfWidth;
        const top = y - halfHeight;
        const width = this.gemWidth;
        const height = this.gemHeight;


        // Border widths
        const outerBorderWidth = width * 0.08;
        const innerBorderWidth = width * 0.03;
        const innerPadding = outerBorderWidth / 3;
        
        // Draw the outer border (light gray)
        ctx.beginPath();
        ctx.moveTo(left + cornerRadius, top);
        ctx.lineTo(left + width - cornerRadius, top);
        ctx.arcTo(left + width, top, left + width, top + cornerRadius, cornerRadius);
        ctx.lineTo(left + width, top + height - cornerRadius);
        ctx.arcTo(left + width, top + height, left + width - cornerRadius, top + height, cornerRadius);
        ctx.lineTo(left + cornerRadius, top + height);
        ctx.arcTo(left, top + height, left, top + height - cornerRadius, cornerRadius);
        ctx.lineTo(left, top + cornerRadius);
        ctx.arcTo(left, top, left + cornerRadius, top, cornerRadius);
        ctx.closePath();
        
        // Fill the gem
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        // Draw the outer border
        ctx.lineWidth = outerBorderWidth;
        ctx.strokeStyle = isSelected ? '#000000' : '#CCCCCC'; // Dark blue if selected
        ctx.stroke();
        
        // Draw the inner border
        ctx.beginPath();
        ctx.moveTo(left + cornerRadius + innerPadding, top + innerPadding);
        ctx.lineTo(left + width - cornerRadius - innerPadding, top + innerPadding);
        ctx.arcTo(left + width - innerPadding, top + innerPadding, left + width - innerPadding, top + cornerRadius + innerPadding, cornerRadius - innerPadding);
        ctx.lineTo(left + width - innerPadding, top + height - cornerRadius - innerPadding);
        ctx.arcTo(left + width - innerPadding, top + height - innerPadding, left + width - cornerRadius - innerPadding, top + height - innerPadding, cornerRadius - innerPadding);
        ctx.lineTo(left + cornerRadius + innerPadding, top + height - innerPadding);
        ctx.arcTo(left + innerPadding, top + height - innerPadding, left + innerPadding, top + height - cornerRadius - innerPadding, cornerRadius - innerPadding);
        ctx.lineTo(left + innerPadding, top + cornerRadius + innerPadding);
        ctx.arcTo(left + innerPadding, top + innerPadding, left + cornerRadius + innerPadding, top + innerPadding, cornerRadius - innerPadding);
        ctx.closePath();
        
        // Draw the inner border
        ctx.lineWidth = innerBorderWidth;
        ctx.strokeStyle = '#888888';
        ctx.stroke();
    }
    
    /**
     * Render the entire grid
     */
    render() {
        // Fill background with grey
        this.ctx.fillStyle = '#00000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw each gem
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const center = this.gemToPixel(col, row);
                const key = `${col},${row}`;
                const color = this.gemColors[key] || this.defaultColor;
                const isSelected = this.selectedCells.has(key);
                
                this.drawGem(center.x, center.y, color, isSelected);
            }
        }
    }
    
    /**
     * Apply a color to the selected cells
     * @param {String} color - Hex color string
     */
    applyColorToSelection(color) {
        if (this.selectedCells.size === 0) return;
        
        // Save current state for undo
        this.saveState();
        
        // Apply color to selected cells
        for (const key of this.selectedCells) {
            this.gemColors[key] = color;
        }
        
        this.render();
    }
    
    /**
     * Save the current grid state for undo/redo
     */
    saveState() {
        // Remove any future states if we're in the middle of history
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Clone the current colors
        const colorsCopy = JSON.parse(JSON.stringify(this.gemColors));
        
        // Add to history
        this.history.push({
            gemColors: colorsCopy,
            timestamp: Date.now()
        });
        this.historyIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    /**
     * Undo the last action
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.gemColors = JSON.parse(JSON.stringify(this.history[this.historyIndex].gemColors));
            this.render();
        }
    }
    
    /**
     * Redo the last undone action
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.gemColors = JSON.parse(JSON.stringify(this.history[this.historyIndex].gemColors));
            this.render();
        }
    }
    
    /**
     * Clear the grid and reset to default color
     */
    clearGrid() {
        this.saveState();
        this.initializeGrid();
        this.selectedCells.clear();
        this.render();
    }
    
    /**
     * Get all colors currently used in the grid
     * @returns {Array} Array of hex color strings
     */
    getAllColors() {
        const colorSet = new Set(Object.values(this.gemColors));
        return Array.from(colorSet);
    }
    
    /**
     * Get color counts for all colors in the grid
     * @returns {Object} Map of colors to their counts
     */
    getColorCounts() {
        const counts = {};
        
        for (const color of Object.values(this.gemColors)) {
            counts[color] = (counts[color] || 0) + 1;
        }
        
        return counts;
    }
    
    /**
     * Export the grid as a PNG image
     * @returns {String} Data URL of the PNG image
     */
    exportToPNG() {
        // Save the current selection
        const prevSelection = new Set(this.selectedCells);
        // Clear selection
        this.selectedCells.clear();
        // Render without selection borders
        this.render();
        // Export PNG
        const dataURL = this.canvas.toDataURL('image/png');
        // Restore selection and re-render
        this.selectedCells = prevSelection;
        this.render();
        return dataURL;
    }

    /**
     * Export the grid as a PNG image with only the colors (no borders or lines)
     * @returns {String} Data URL of the PNG image
     */
    exportColorOnlyPNG() {
        // Create a temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const ctx = tempCanvas.getContext('2d');

        // Fill background with same color as main grid
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw only filled octagons (no borders, no selection)
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const center = this.gemToPixel(col, row);
                const key = `${col},${row}`;
                const color = this.gemColors[key] || this.defaultColor;
                // Draw filled octagon only
                this._drawColorOnlyGem(ctx, center.x, center.y, color);
            }
        }
        return tempCanvas.toDataURL('image/png');
    }

    /**
     * Draw only the filled octagon (no border, no selection)
     */
    _drawColorOnlyGem(ctx, centerX, centerY, fillColor) {
        const width = this.gemSize;
        const height = this.gemSize;
        const cornerRadius = this.cornerRadius;
        // Octagon geometry (same as in drawGem)
        function octagonPoints(cx, cy, size) {
            const c = size * 0.2929;
            const s = size / 2;
            return [
                [cx - s + c, cy - s],
                [cx + s - c, cy - s],
                [cx + s,     cy - s + c],
                [cx + s,     cy + s - c],
                [cx + s - c, cy + s],
                [cx - s + c, cy + s],
                [cx - s,     cy + s - c],
                [cx - s,     cy - s + c]
            ];
        }
        const pts = octagonPoints(centerX, centerY, Math.min(width, height) - 0.01); // -0.01 to avoid edge artifacts
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 8; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    
    /**
     * Export grid as a 64x40 pixel PNG (one pixel per cell) with no spacing and no background margin
     * @returns {String} Data URL of the PNG image
     */
    export64x40PNG() {
        const width = this.cols;
        const height = this.rows;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext('2d');
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const key = `${col},${row}`;
                const color = this.gemColors[key] || this.defaultColor;
                ctx.fillStyle = color;
                ctx.fillRect(col, row, 1, 1);
            }
        }
        return tempCanvas.toDataURL('image/png');
    }

    /**
     * Save the grid state to a JSON object
     * @returns {Object} Grid state as JSON
     */
    saveToJSON() {
        return {
            cols: this.cols,
            rows: this.rows,
            gemSize: this.gemSize,
            gemColors: this.gemColors,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Load grid state from a JSON object
     * @param {Object} data - Grid state as JSON
     */
    loadFromJSON(data) {
        if (!data || !data.gemColors) return;
        
        // Update grid properties if they exist
        if (data.cols && data.rows) {
            this.cols = data.cols;
            this.rows = data.rows;
            
            if (data.gemSize) {
                this.gemSize = data.gemSize;
            }
            
            this.calculateDimensions();
        }
        
        // Load colors
        this.gemColors = JSON.parse(JSON.stringify(data.gemColors));
        
        // Clear selection and render
        this.selectedCells.clear();
        this.render();
        
        // Save this state in history
        this.saveState();
    }
    
    /**
     * Apply a color mapping to the entire grid
     * @param {Object} colorMap - Map from old colors to new colors
     */
    applyColorMapping(colorMap) {
        this.saveState();
        
        for (const key in this.gemColors) {
            const oldColor = this.gemColors[key];
            if (colorMap[oldColor]) {
                this.gemColors[key] = colorMap[oldColor];
            }
        }
        
        this.render();
    }
    
    /**
     * Register a callback for when a color is selected
     * @param {Function} callback - Function to call when a color is selected
     */
    onColorSelected(callback) {
        if (typeof callback === 'function') {
            this.colorSelectedCallbacks.push(callback);
        }
    }
    
    /**
     * Notify all registered callbacks that a color has been selected
     * @param {String} color - The selected color in hex format
     */
    notifyColorSelected(color) {
        for (const callback of this.colorSelectedCallbacks) {
            callback(color);
        }
    }
}