# Bead Color Changer - Web Version

A web-based implementation of the Bead Color Changer application that works entirely in the browser. Design bead art using a hexagonal grid with advanced color management.

## Features

- **Hexagonal Grid**: Interactive 64x40 hexagonal grid for precise bead art design
- **Advanced Color Management**: 10-color palette with dynamic color extraction from images
- **Selection Tools**: Select individual cells or all cells of the same color
- **History Management**: Undo/redo functionality for design changes
- **Import/Export**: Save and load designs, import images, export as PNG
- **Color Reduction**: Automatically reduce colors using k-means clustering
- **Color Picker**: Full 8-bit color selection with hex code input

## How to Use

1. **Color Selection**: Choose colors from the palette on the right panel
2. **Grid Editing**: Click on hexagons to apply the selected color
3. **Selection**: Double-click a hexagon to select all hexagons of the same color
4. **Clear Selection**: Use the clear selection button to deselect all cells
5. **Undo/Redo**: Navigate through your edit history with the undo and redo buttons
6. **Image Import**: Load an image to automatically map colors to the hexagonal grid
7. **Color Reduction**: Set a target number of colors and apply reduction

## Technical Details

- Built with vanilla JavaScript, HTML5, and CSS3
- Uses canvas for rendering the hexagonal grid
- Implements custom color management algorithms
- No external dependencies or libraries required
- Works completely locally - no data is sent to any server

## Installation

No installation required! Simply clone the repository and open `index.html` in your browser.

```bash
git clone https://github.com/yourusername/bead-color-changer.git
cd bead-color-changer/web
# Open index.html in your browser
```

## License

MIT License

## Usage Instructions

1. **Load an Image**: Click "Load Image" to import an image for editing
2. **Select Cells**: Click on a cell to select it, or drag to select multiple cells
3. **Apply Colors**: Choose a color from the palette and click "Apply" to color selected cells
4. **Modify Colors**: Click on a color ball to open the color picker and choose a new color
5. **Reduce/Expand Colors**: Enter a target number of colors and click "Apply" to reduce the palette
6. **Export/Import Palettes**: Use the "Exp Pal" and "Imp Pal" buttons to save and load color palettes
7. **Save/Load Grid**: Save your work and load it later using the Save/Load Grid buttons
8. **Export PNG**: Export your creation as a PNG image

## Keyboard Shortcuts

- **Ctrl+Z**: Undo
- **Ctrl+Y**: Redo
- **Escape**: Clear selection

## Browser Compatibility

This application works best in modern browsers:
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Local Development

To run a local development server:

```bash
# Using Python 3
python -m http.server

# Using Node.js
npx http-server
```

Then open http://localhost:8000 or http://localhost:8080 in your browser.

## License

This project is open source and available for personal and educational use.
