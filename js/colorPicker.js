/**
 * Color Picker Implementation
 * Provides a circular color wheel and hex input for color selection
 */

const ColorPickerWheel = {
    canvas: null,
    ctx: null,
    centerX: 0,
    centerY: 0,
    radius: 0,
    isDragging: false,
    selectedColor: '#FF0000',
    
    /**
     * Initialize the color picker
     */
    init: function() {
        this.canvas = document.getElementById('colorWheel');
        this.ctx = this.canvas.getContext('2d');
        
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.radius = Math.min(this.centerX, this.centerY) - 5;
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initial draw
        this.drawColorWheel();
    },
    
    /**
     * Set up event listeners for the color wheel
     */
    setupEventListeners: function() {
        // Color wheel events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
        
        // Hex input events
        const hexInput = document.getElementById('hexInput');
        hexInput.addEventListener('change', this.handleHexInput.bind(this));
        
        // Button events
        document.getElementById('saveColor').addEventListener('click', this.saveColor.bind(this));
        document.getElementById('cancelColor').addEventListener('click', this.cancelColor.bind(this));
        
        // Modal close button
        const closeButton = document.querySelector('.close-button');
        closeButton.addEventListener('click', this.cancelColor.bind(this));
        
        // Close modal when clicking outside
        const modal = document.getElementById('colorPickerModal');
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.cancelColor();
            }
        });
    },
    
    /**
     * Draw the color wheel with the current selected color
     * @param {String} initialColor - Optional initial color
     */
    drawColorWheel: function(initialColor) {
        if (initialColor) {
            this.selectedColor = initialColor;
        }
        
        const ctx = this.ctx;
        const centerX = this.centerX;
        const centerY = this.centerY;
        const radius = this.radius;
        
        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw color wheel
        for (let angle = 0; angle < 360; angle += 1) {
            const startAngle = (angle - 0.5) * Math.PI / 180;
            const endAngle = (angle + 0.5) * Math.PI / 180;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            
            // Calculate color based on angle (hue)
            const hue = angle / 360;
            const rgb = ColorUtils.hsvToRgb(hue, 1, 1);
            ctx.fillStyle = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
            ctx.fill();
        }
        
        // Draw inner brightness/saturation circle
        const innerRadius = radius * 0.7;
        for (let y = centerY - innerRadius; y <= centerY + innerRadius; y++) {
            for (let x = centerX - innerRadius; x <= centerX + innerRadius; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= innerRadius) {
                    // Calculate saturation and value based on position
                    const saturation = Math.min(1, Math.max(0, dx / innerRadius + 0.5));
                    const value = Math.min(1, Math.max(0, 1 - (dy / innerRadius + 0.5)));
                    
                    // Get the base hue from the selected color
                    const rgb = ColorUtils.hexToRgb(this.selectedColor);
                    const hsv = ColorUtils.rgbToHsv(rgb.r, rgb.g, rgb.b);
                    
                    // Create color with the same hue but different saturation/value
                    const newRgb = ColorUtils.hsvToRgb(hsv.h, saturation, value);
                    const color = ColorUtils.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        
        // Draw selected color marker
        const rgb = ColorUtils.hexToRgb(this.selectedColor);
        const hsv = ColorUtils.rgbToHsv(rgb.r, rgb.g, rgb.b);
        
        // Calculate position based on HSV
        const hueAngle = hsv.h * 2 * Math.PI;
        const hueX = centerX + Math.cos(hueAngle) * radius;
        const hueY = centerY + Math.sin(hueAngle) * radius;
        
        // Draw hue marker
        ctx.beginPath();
        ctx.arc(hueX, hueY, 5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Calculate saturation/value position
        const svX = centerX + (hsv.s - 0.5) * innerRadius;
        const svY = centerY + (0.5 - hsv.v) * innerRadius;
        
        // Draw saturation/value marker
        ctx.beginPath();
        ctx.arc(svX, svY, 5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Update the preview and hex input
        this.updateColorDisplay();
    },
    
    /**
     * Handle mouse down event on the color wheel
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseDown: function(event) {
        this.isDragging = true;
        this.handleColorSelection(event);
    },
    
    /**
     * Handle mouse move event on the color wheel
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove: function(event) {
        if (this.isDragging) {
            this.handleColorSelection(event);
        }
    },
    
    /**
     * Handle mouse up event
     */
    handleMouseUp: function() {
        this.isDragging = false;
    },
    
    /**
     * Handle color selection from the wheel
     * @param {MouseEvent} event - Mouse event
     */
    handleColorSelection: function(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= this.radius) {
            // Calculate the angle (hue)
            let angle = Math.atan2(dy, dx);
            if (angle < 0) angle += 2 * Math.PI;
            
            const hue = angle / (2 * Math.PI);
            
            // Check if we're in the inner circle (saturation/value)
            const innerRadius = this.radius * 0.7;
            if (distance <= innerRadius) {
                // Calculate saturation and value
                const saturation = Math.min(1, Math.max(0, dx / innerRadius + 0.5));
                const value = Math.min(1, Math.max(0, 1 - (dy / innerRadius + 0.5)));
                
                // Get current hue from selected color
                const rgb = ColorUtils.hexToRgb(this.selectedColor);
                const hsv = ColorUtils.rgbToHsv(rgb.r, rgb.g, rgb.b);
                
                // Create new color with same hue but new saturation/value
                const newRgb = ColorUtils.hsvToRgb(hsv.h, saturation, value);
                this.selectedColor = ColorUtils.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
            } else {
                // Just changing the hue, keep saturation and value
                const rgb = ColorUtils.hexToRgb(this.selectedColor);
                const hsv = ColorUtils.rgbToHsv(rgb.r, rgb.g, rgb.b);
                
                const newRgb = ColorUtils.hsvToRgb(hue, hsv.s, hsv.v);
                this.selectedColor = ColorUtils.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
            }
            
            // Redraw the wheel with the new selected color
            this.drawColorWheel();
        }
    },
    
    /**
     * Handle hex input change
     * @param {Event} event - Input change event
     */
    handleHexInput: function(event) {
        const input = event.target;
        let color = input.value.trim();
        
        // Validate and normalize the color
        if (ColorUtils.isValidHex(color)) {
            color = ColorUtils.normalizeHex(color);
            this.selectedColor = color;
            this.drawColorWheel();
        } else {
            // Revert to the current color
            input.value = this.selectedColor;
            alert('Invalid hex color code. Please use format #RRGGBB or #RGB.');
        }
    },
    
    /**
     * Update the color display (preview and hex input)
     */
    updateColorDisplay: function() {
        const colorPreview = document.getElementById('colorPreview');
        const hexInput = document.getElementById('hexInput');
        
        colorPreview.style.backgroundColor = this.selectedColor;
        hexInput.value = this.selectedColor;
    },
    
    /**
     * Save the selected color and close the modal
     */
    saveColor: function() {
        // Update the palette with the new color
        const colorPalette = document.getElementById('colorPaletteContainer').parentNode.colorPalette;
        if (colorPalette) {
            colorPalette.updateColorFromPicker(this.selectedColor);
        }
        
        // Close the modal
        document.getElementById('colorPickerModal').style.display = 'none';
    },
    
    /**
     * Cancel color selection and close the modal
     */
    cancelColor: function() {
        document.getElementById('colorPickerModal').style.display = 'none';
    }
};
