/**
 * WiggleTangle page bootstrap.
 */

document.addEventListener('DOMContentLoaded', function() {
    PixLabApp.initializeSharedApp({
        palettePath: 'full_color_palette_wiggletangle.json',
        createGrid: function() {
            return new GemGrid('gemGrid', 64, 40);
        },
        bindExtraControls: function(appState) {
            document.getElementById('save64x40').addEventListener('click', function() {
                try {
                    const dataURL = appState.gemGrid.export64x40PNG();
                    const link = document.createElement('a');
                    link.href = dataURL;
                    link.download = 'bead_art_64x40_' + new Date().toISOString().slice(0, 10) + '.png';
                    link.click();
                } catch (error) {
                    alert('Error during Save 64x40: ' + error.message);
                }
            });
        }
    });
});
