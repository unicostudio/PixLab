/**
 * Hexagonal Grid Implementation
 * Manages the hexagonal grid display, selection, and coloring
 */

class HexGrid {
    /**
     * Initialize the hexagonal grid
     * @param {String} canvasId - ID of the canvas element
     * @param {Number} cols - Number of columns in the grid
     * @param {Number} rows - Number of rows in the grid
     */
    constructor(canvasId, cols = 64, rows = 40) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.hexSize = 8; // Initial size, will be calculated dynamically
        
        // Initialize offset values
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Set initial cols and rows
        this.cols = cols;
        this.rows = rows;
        this.hexColors = {}; // Map of (col,row) to color
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
     * Calculate dimensions based on hexagon size
     */
    calculateDimensions() {
        // Get the container dimensions
        const containerWidth = this.canvas.width;
        const containerHeight = this.canvas.height;
        
        // Calculate the optimal hexagon size to fill the container
        // with the desired number of hexagons (64x40)
        const targetCols = 64;
        const targetRows = 40;
        
        // Calculate the maximum hexagon size that would allow us to fit the target grid
        const maxWidthHexSize = containerWidth / (targetCols * 0.75 + 0.25) / 2;
        const maxHeightHexSize = containerHeight / (targetRows * Math.sqrt(3) + Math.sqrt(3) / 2);
        
        // Use the smaller of the two to ensure we can fit both dimensions
        const optimalHexSize = Math.min(maxWidthHexSize, maxHeightHexSize) * 0.95; // 95% to add some margin
        
        // Update hexagon size
        this.hexSize = optimalHexSize;
        
        // Hexagon dimensions
        this.hexWidth = this.hexSize * 2;
        this.hexHeight = Math.sqrt(3) * this.hexSize;
        
        // Horizontal distance between column centers
        this.colWidth = this.hexWidth * 0.75;
        
        // Vertical distance between row centers
        this.rowHeight = this.hexHeight;
        
        // Use the target grid dimensions
        this.cols = targetCols;
        this.rows = targetRows;
        
        // Calculate the actual grid size
        this.gridWidth = this.colWidth * (this.cols - 1) + this.hexWidth;
        this.gridHeight = this.rowHeight * this.rows + this.hexHeight / 2;
        
        // Center the grid in the canvas
        this.offsetX = (containerWidth - this.gridWidth) / 2;
        this.offsetY = (containerHeight - this.gridHeight) / 2;
        
        console.log(`Using hexagon size: ${this.hexSize}, Grid: ${this.cols}x${this.rows}`);
    }
    
    /**
     * Initialize the grid with default colors
     */
    initializeGrid() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                this.hexColors[`${col},${row}`] = this.defaultColor;
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
        
        const cell = this.pixelToHex(x, y);
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
        
        const cell = this.pixelToHex(x, y);
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
        
        const cell = this.pixelToHex(x, y);
        if (!cell || !this.isValidCell(cell.col, cell.row)) return;
        
        const key = `${cell.col},${cell.row}`;
        const targetColor = this.hexColors[key];
        
        // Clear current selection
        this.selectedCells.clear();
        
        // Select all cells with the same color
        for (const [cellKey, color] of Object.entries(this.hexColors)) {
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
     * Convert pixel coordinates to hex grid coordinates
     * @param {Number} x - X coordinate in pixels
     * @param {Number} y - Y coordinate in pixels
     * @returns {Object|null} Object with col and row properties, or null if outside grid
     */
    pixelToHex(x, y) {
        // Adjust for grid offset
        const adjustedX = x - this.offsetX;
        const adjustedY = y - this.offsetY;
        
        // First approximation - find the column based on adjusted x
        const col = Math.round(adjustedX / this.colWidth);
        
        // Determine if we're in an even or odd column
        const isEvenCol = col % 2 === 0;
        
        // Adjust row calculation based on column parity
        const rowOffset = isEvenCol ? 0 : this.hexHeight / 2;
        const row = Math.floor((adjustedY - rowOffset) / this.rowHeight);
        
        // Check if the point is actually inside the hexagon
        const hexCenter = this.hexToPixel(col, row);
        const distance = Math.sqrt(Math.pow(x - hexCenter.x, 2) + Math.pow(y - hexCenter.y, 2));
        
        if (distance <= this.hexSize) {
            return { col, row };
        }
        
        // Check neighboring hexagons
        const neighbors = [
            { col: col-1, row: row },
            { col: col+1, row: row },
            { col: col-1, row: row-1 },
            { col: col+1, row: row-1 },
            { col: col-1, row: row+1 },
            { col: col+1, row: row+1 }
        ];
        
        for (const neighbor of neighbors) {
            if (this.isValidCell(neighbor.col, neighbor.row)) {
                const neighborCenter = this.hexToPixel(neighbor.col, neighbor.row);
                const neighborDistance = Math.sqrt(
                    Math.pow(x - neighborCenter.x, 2) + 
                    Math.pow(y - neighborCenter.y, 2)
                );
                
                if (neighborDistance <= this.hexSize) {
                    return neighbor;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Convert hex grid coordinates to pixel coordinates
     * @param {Number} col - Column in the hex grid
     * @param {Number} row - Row in the hex grid
     * @returns {Object} Object with x and y properties
     */
    hexToPixel(col, row) {
        // Determine if we're in an even or odd column
        const isEvenCol = col % 2 === 0;
        
        // Calculate x coordinate
        const x = col * this.colWidth + this.offsetX;
        
        // Calculate y coordinate (offset for odd columns)
        const rowOffset = isEvenCol ? 0 : this.hexHeight / 2;
        const y = row * this.rowHeight + rowOffset + this.offsetY;
        
        return { x, y };
    }
    
    /**
     * Check if cell coordinates are valid
     * @param {Number} col - Column in the hex grid
     * @param {Number} row - Row in the hex grid
     * @returns {Boolean} True if valid, false otherwise
     */
    isValidCell(col, row) {
        return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
    }
    
    /**
     * Draw a hexagon at the specified coordinates
     * @param {Number} x - X coordinate of hexagon center
     * @param {Number} y - Y coordinate of hexagon center
     * @param {String} fillColor - Fill color for the hexagon
     * @param {Boolean} isSelected - Whether the hexagon is selected
     */
    drawHexagon(x, y, fillColor, isSelected) {
        const ctx = this.ctx;
        const size = this.hexSize;
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const hx = x + size * Math.cos(angle);
            const hy = y + size * Math.sin(angle);
            
            if (i === 0) {
                ctx.moveTo(hx, hy);
            } else {
                ctx.lineTo(hx, hy);
            }
        }
        ctx.closePath();
        
        // Fill
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        // Stroke
        if (isSelected) {
            ctx.strokeStyle = '#00008B'; // Dark blue instead of light green
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
        }
        ctx.stroke();
    }
    
    /**
     * Render the entire grid
     */
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw each hexagon
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const center = this.hexToPixel(col, row);
                const key = `${col},${row}`;
                const color = this.hexColors[key] || this.defaultColor;
                const isSelected = this.selectedCells.has(key);
                
                this.drawHexagon(center.x, center.y, color, isSelected);
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
            this.hexColors[key] = color;
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
        const colorsCopy = JSON.parse(JSON.stringify(this.hexColors));
        
        // Add to history
        this.history.push({
            hexColors: colorsCopy,
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
            this.hexColors = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.render();
        }
    }
    
    /**
     * Redo the last undone action
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.hexColors = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
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
        const colorSet = new Set(Object.values(this.hexColors));
        return Array.from(colorSet);
    }
    
    /**
     * Get color counts for all colors in the grid
     * @returns {Object} Map of colors to their counts
     */
    getColorCounts() {
        const counts = {};
        
        for (const color of Object.values(this.hexColors)) {
            counts[color] = (counts[color] || 0) + 1;
        }
        
        return counts;
    }
    
    /**
     * Export the grid as a PNG image
     * @returns {String} Data URL of the PNG image
     */
    exportToPNG() {
        return this.canvas.toDataURL('image/png');
    }
    
    /**
     * Save the grid state to a JSON object
     * @returns {Object} Grid state as JSON
     */
    saveToJSON() {
        return {
            cols: this.cols,
            rows: this.rows,
            hexSize: this.hexSize,
            hexColors: this.hexColors,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Load grid state from a JSON object
     * @param {Object} data - Grid state as JSON
     */
    loadFromJSON(data) {
        if (!data || !data.hexColors) return;
        
        // Update grid properties if they exist
        if (data.cols && data.rows) {
            this.cols = data.cols;
            this.rows = data.rows;
            
            if (data.hexSize) {
                this.hexSize = data.hexSize;
            }
            
            this.calculateDimensions();
        }
        
        // Load colors
        this.hexColors = JSON.parse(JSON.stringify(data.hexColors));
        
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
        
        for (const key in this.hexColors) {
            const oldColor = this.hexColors[key];
            if (colorMap[oldColor]) {
                this.hexColors[key] = colorMap[oldColor];
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
