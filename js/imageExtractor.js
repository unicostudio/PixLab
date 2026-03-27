/**
 * Image to pattern JSON extractor.
 */

document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('extractorImageInput');
    const loadImageButton = document.getElementById('loadExtractorImage');
    const generateJsonButton = document.getElementById('generateJson');
    const copyJsonButton = document.getElementById('copyJson');
    const downloadJsonButton = document.getElementById('downloadJson');
    const rowsInput = document.getElementById('rowsInput');
    const colsInput = document.getElementById('colsInput');
    const toleranceInput = document.getElementById('toleranceInput');
    const sampleInsetInput = document.getElementById('sampleInsetInput');
    const omitBackgroundInput = document.getElementById('omitBackgroundInput');
    const patternNameInput = document.getElementById('patternNameInput');
    const patternAuthorInput = document.getElementById('patternAuthorInput');
    const sourcePreview = document.getElementById('sourcePreview');
    const patternPreview = document.getElementById('patternPreview');
    const jsonOutput = document.getElementById('jsonOutput');

    const sourceCtx = sourcePreview.getContext('2d');
    const patternCtx = patternPreview.getContext('2d');
    let loadedImage = null;
    let loadedImageUrl = '';

    function showToast(message, durationMs) {
        const existingToast = document.querySelector('.app-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'app-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        window.setTimeout(function() {
            toast.classList.add('is-visible');
        }, 10);

        window.setTimeout(function() {
            toast.classList.remove('is-visible');
            window.setTimeout(function() {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 220);
        }, durationMs);
    }

    function setPreviewCanvasSize(canvas, maxWidth, aspectRatio) {
        const width = maxWidth;
        const height = Math.max(1, Math.round(width / aspectRatio));
        canvas.width = width;
        canvas.height = height;
    }

    function drawSourcePreview() {
        if (!loadedImage) return;

        const aspectRatio = loadedImage.width / loadedImage.height;
        setPreviewCanvasSize(sourcePreview, 720, aspectRatio);
        sourceCtx.clearRect(0, 0, sourcePreview.width, sourcePreview.height);
        sourceCtx.drawImage(loadedImage, 0, 0, sourcePreview.width, sourcePreview.height);
    }

    function getNumericInputValue(input, label) {
        const value = parseInt(input.value, 10);
        if (!Number.isInteger(value) || value <= 0) {
            throw new Error(label + ' must be a positive integer.');
        }
        return value;
    }

    function colorToCode(index) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (index < alphabet.length) {
            return alphabet[index];
        }
        return 'C' + (index + 1);
    }

    function averageRegionColor(ctx, startX, startY, width, height) {
        const safeWidth = Math.max(1, Math.floor(width));
        const safeHeight = Math.max(1, Math.floor(height));
        const imageData = ctx.getImageData(Math.floor(startX), Math.floor(startY), safeWidth, safeHeight);
        const pixels = imageData.data;

        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let count = 0;

        for (let index = 0; index < pixels.length; index += 4) {
            const alpha = pixels[index + 3];
            if (alpha === 0) {
                continue;
            }

            totalR += pixels[index];
            totalG += pixels[index + 1];
            totalB += pixels[index + 2];
            count += 1;
        }

        if (count === 0) {
            return '#FFFFFF';
        }

        return ColorUtils.rgbToHex(
            Math.round(totalR / count),
            Math.round(totalG / count),
            Math.round(totalB / count)
        );
    }

    function createSampleCanvas() {
        if (!loadedImage) {
            throw new Error('Load an image first.');
        }

        const canvas = document.createElement('canvas');
        canvas.width = loadedImage.width;
        canvas.height = loadedImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(loadedImage, 0, 0);
        return { canvas: canvas, ctx: ctx };
    }

    function findMatchingPaletteColor(color, palette, tolerance) {
        for (let index = 0; index < palette.length; index += 1) {
            const paletteColor = palette[index];
            const distance = ColorUtils.colorDistance(
                ColorUtils.hexToRgb(color),
                ColorUtils.hexToRgb(paletteColor)
            );
            if (distance <= tolerance) {
                return paletteColor;
            }
        }
        return null;
    }

    function samplePattern() {
        const rows = getNumericInputValue(rowsInput, 'Rows');
        const cols = getNumericInputValue(colsInput, 'Columns');
        const tolerance = Math.max(0, parseInt(toleranceInput.value, 10) || 0);
        const insetPercent = Math.min(45, Math.max(0, parseInt(sampleInsetInput.value, 10) || 0));
        const omitBackground = omitBackgroundInput.checked;
        const sampleData = createSampleCanvas();
        const cellWidth = sampleData.canvas.width / cols;
        const cellHeight = sampleData.canvas.height / rows;

        const sampledCells = [];
        const palette = [];
        const counts = {};

        for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
                const insetX = cellWidth * (insetPercent / 100);
                const insetY = cellHeight * (insetPercent / 100);
                const sampleX = col * cellWidth + insetX;
                const sampleY = row * cellHeight + insetY;
                const sampleWidth = Math.max(1, cellWidth - insetX * 2);
                const sampleHeight = Math.max(1, cellHeight - insetY * 2);

                let color = averageRegionColor(
                    sampleData.ctx,
                    sampleX,
                    sampleY,
                    sampleWidth,
                    sampleHeight
                );

                const matchingColor = findMatchingPaletteColor(color, palette, tolerance);
                if (matchingColor) {
                    color = matchingColor;
                } else {
                    palette.push(color);
                }

                sampledCells.push({
                    x: col,
                    y: row,
                    color: color
                });
                counts[color] = (counts[color] || 0) + 1;
            }
        }

        let omittedBackgroundColor = null;
        if (omitBackground && Object.keys(counts).length > 0) {
            omittedBackgroundColor = Object.keys(counts).sort(function(a, b) {
                return counts[b] - counts[a];
            })[0];
        }

        const filteredPalette = palette.filter(function(color) {
            return color !== omittedBackgroundColor;
        });

        return {
            rows: rows,
            cols: cols,
            palette: filteredPalette,
            sampledCells: sampledCells.filter(function(cell) {
                return cell.color !== omittedBackgroundColor;
            }),
            previewCells: sampledCells,
            omittedBackgroundColor: omittedBackgroundColor
        };
    }

    function renderPatternPreview(patternData) {
        const scale = Math.max(8, Math.floor(320 / Math.max(patternData.cols, patternData.rows)));
        patternPreview.width = patternData.cols;
        patternPreview.height = patternData.rows;

        const imageData = patternCtx.createImageData(patternData.cols, patternData.rows);
        const pixels = imageData.data;
        const previewMap = {};
        patternData.previewCells.forEach(function(cell) {
            previewMap[cell.x + ',' + cell.y] = cell.color;
        });

        for (let row = 0; row < patternData.rows; row += 1) {
            for (let col = 0; col < patternData.cols; col += 1) {
                const hex = previewMap[col + ',' + row] || '#FFFFFF';
                const rgb = ColorUtils.hexToRgb(hex);
                const pixelIndex = (row * patternData.cols + col) * 4;
                pixels[pixelIndex] = rgb.r;
                pixels[pixelIndex + 1] = rgb.g;
                pixels[pixelIndex + 2] = rgb.b;
                pixels[pixelIndex + 3] = 255;
            }
        }

        patternCtx.putImageData(imageData, 0, 0);
        patternPreview.style.height = String(patternData.rows * scale) + 'px';
    }

    function buildPatternJson(patternData) {
        const paletteObject = {};
        const colorCodeMap = {};

        patternData.palette.forEach(function(color, index) {
            const code = colorToCode(index);
            colorCodeMap[color] = code;
            paletteObject[code] = {
                name: code,
                hex: color
            };
        });

        const beads = patternData.sampledCells.map(function(cell) {
            return {
                x: cell.x,
                y: cell.y,
                color: colorCodeMap[cell.color]
            };
        });

        return {
            name: patternNameInput.value.trim() || 'Imported Pattern',
            author: patternAuthorInput.value.trim() || 'PixLab',
            dimensions: {
                width: patternData.cols,
                height: patternData.rows
            },
            palette: paletteObject,
            beads: beads
        };
    }

    function generateOutput() {
        const patternData = samplePattern();
        renderPatternPreview(patternData);
        const output = buildPatternJson(patternData);
        jsonOutput.value = JSON.stringify(output, null, 2);
    }

    function loadImageFile(file) {
        if (!file.type.match('image.*')) {
            throw new Error('Please select an image file.');
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const image = new Image();
            image.onload = function() {
                loadedImage = image;
                loadedImageUrl = event.target.result;
                drawSourcePreview();
                showToast('Image loaded successfully.', 1000);
            };
            image.onerror = function() {
                alert('Failed to load image.');
            };
            image.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    loadImageButton.addEventListener('click', function() {
        imageInput.click();
    });

    imageInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            loadImageFile(file);
        } catch (error) {
            alert(error.message);
        }

        event.target.value = '';
    });

    generateJsonButton.addEventListener('click', function() {
        try {
            generateOutput();
            showToast('JSON generated.', 1000);
        } catch (error) {
            alert(error.message);
        }
    });

    copyJsonButton.addEventListener('click', function() {
        if (!jsonOutput.value.trim()) {
            alert('Generate JSON first.');
            return;
        }

        navigator.clipboard.writeText(jsonOutput.value)
            .then(function() {
                showToast('JSON copied.', 1000);
            })
            .catch(function() {
                alert('Failed to copy JSON.');
            });
    });

    downloadJsonButton.addEventListener('click', function() {
        if (!jsonOutput.value.trim()) {
            alert('Generate JSON first.');
            return;
        }

        const filenameBase = (patternNameInput.value.trim() || 'pattern')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const link = document.createElement('a');
        link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonOutput.value);
        link.download = (filenameBase || 'pattern') + '.json';
        link.click();
    });
});
