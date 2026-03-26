# PixLab Spec

## Overview
PixLab is a static browser app with two separate entry pages:

- [`index.html`](/Users/hasan/Documents/projects/github/PixLab/index.html): WiggleTangle workflow
- [`voxelblastjam.html`](/Users/hasan/Documents/projects/github/PixLab/voxelblastjam.html): VoxelBlastJam workflow

Both pages share core grid, palette, and image-processing logic through [`js/appShared.js`](/Users/hasan/Documents/projects/github/PixLab/js/appShared.js), while page-specific behavior is defined in [`js/appGem.js`](/Users/hasan/Documents/projects/github/PixLab/js/appGem.js) and [`js/appVoxel.js`](/Users/hasan/Documents/projects/github/PixLab/js/appVoxel.js).

## Implemented Changes

### Multi-page structure
- Split the app into two directly accessible HTML pages.
- Added header navigation links between WiggleTangle and VoxelBlastJam.
- Kept shared modules reusable instead of duplicating the codebase.

### Game-specific palettes
- Removed the old shared `full_color_palette.json`.
- Added [`full_color_palette_wiggletangle.json`](/Users/hasan/Documents/projects/github/PixLab/full_color_palette_wiggletangle.json) and [`full_color_palette_voxelblastjam.json`](/Users/hasan/Documents/projects/github/PixLab/full_color_palette_voxelblastjam.json).
- `ColorPalette` now accepts a page-specific palette path.

### WiggleTangle behavior
- Preserves editable palette behavior.
- Keeps color picker and manual hex editing enabled.
- Keeps the `Save 64x40` export flow.

### VoxelBlastJam behavior
- Uses a fixed JSON-backed palette only.
- Disables color picker on palette swatches.
- Makes palette hex values read-only.
- Prevents loaded grid palette data from overriding the Voxel palette.
- Constrains loaded grid colors to the Voxel palette catalog.
- Supports `40x40`, `60x60`, and `80x80` grid sizes with persistence.
- Uses a two-column palette panel:
  - Before image/grid-derived state: palette colors are split across two columns.
  - After image load or grid load: left column shows used colors, right column shows remaining colors.

### Layout updates
- Moved the former bottom button bar into a left-side `Actions` panel on both pages.
- Removed the canvas-bottom overlay controls.
- Added responsive layout rules so controls stack cleanly on narrower screens.

### Feedback changes
- Replaced the blocking image-load success alert with a short auto-dismissing toast.
- Error alerts remain blocking.

## Shared Technical Rules
- DOM IDs for controls remain stable so shared event binding code continues to work.
- `GemGrid` supports grid recreation and cleanup through reusable instance methods.
- `ColorPalette` behavior is controlled by constructor options for page-specific modes.

## Validation Checklist
- Open both pages and confirm grid rendering and navigation.
- Verify image import, save/load JSON, PNG export, undo/redo, and selection controls.
- On VoxelBlastJam, verify fixed palette rules, two-column grouping, and grid-size switching.
- Confirm image-load success feedback disappears automatically after about 1 second.
