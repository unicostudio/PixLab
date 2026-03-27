/**
 * Website import page bootstrap.
 */

document.addEventListener('DOMContentLoaded', function() {
    const DEFAULT_COLS = 20;
    const DEFAULT_ROWS = 16;
    const WEBSITE_IMPORT_DEFAULT_COLOR = '#FFFFFE';
    const DEFAULT_IMAGE_XPATH = "//div[@id='pattern-container']/a[@class='fancybox-image']/img/@src";
    const DEFAULT_DIMENSIONS_XPATH = "//div[@id='main']/div[@class='main-layout row']/div[@class='col-sm-9 col-sm-push-3 parent-column test-col']/table[@class='table table-striped table-bordered']/tbody/tr[6]/td[2]";
    const websiteUrlInput = document.getElementById('websiteUrlInput');
    const websiteColsInput = document.getElementById('websiteColsInput');
    const websiteRowsInput = document.getElementById('websiteRowsInput');
    const websiteStatus = document.getElementById('websiteStatus');
    const kandiCaptureBookmarklet = document.getElementById('kandiCaptureBookmarklet');
    const exportPatternJsonButton = document.getElementById('exportPatternJson');
    const generateTempJsonButton = document.getElementById('generateTempJson');
    const downloadTempJsonButton = document.getElementById('downloadTempJson');
    const loadTempPatternButton = document.getElementById('loadTempPattern');
    const applyVoxelPaletteButton = document.getElementById('applyVoxelPalette');
    let tempPatternData = null;

    function getProxyUrl(pathname, targetUrl) {
        return pathname + '?url=' + encodeURIComponent(targetUrl);
    }

    function createGemGrid(cols, rows) {
        const grid = new GemGrid('gemGrid', cols, rows);
        grid.defaultColor = WEBSITE_IMPORT_DEFAULT_COLOR;
        Object.keys(grid.gemColors).forEach(function(key) {
            grid.gemColors[key] = WEBSITE_IMPORT_DEFAULT_COLOR;
        });
        grid.render();
        return grid;
    }

    function showTransientMessage(message, durationMs) {
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

    function resetDerivedImageState(colorPalette) {
        if (colorPalette) {
            colorPalette.originalImageColors = {};
            if (colorPalette.useTwoColumnPalette) {
                colorPalette.createPaletteUI({ skipGridSave: true });
            }
        }

        window.originalImageColors = [];
        window.firstImagePalette = null;
        window.firstImagePaletteCounts = null;
    }

    function buildBookmarkletHref(targetPageUrl) {
        const script = [
            '(function(){',
            'function fail(message){alert(message);}',
            'function findImage(){',
            'var selectors=["#pattern-container a.fancybox-image img","#pattern-container img","meta[property=\\"og:image\\"]","meta[name=\\"twitter:image\\"]"];',
            'for(var i=0;i<selectors.length;i+=1){',
            'var node=document.querySelector(selectors[i]);',
            'if(!node){continue;}',
            'var value=(node.getAttribute&&(',
            'node.getAttribute("src")||node.getAttribute("data-src")||node.getAttribute("data-original")||node.getAttribute("content")))||"";',
            'if(value){return new URL(value,location.href).href;}',
            '}',
            'var bodyText=document.body?document.body.innerText:"";',
            'var imageMatch=bodyText.match(/https?:\\/\\/\\S+\\.(?:png|jpg|jpeg|gif|webp)/i);',
            'if(imageMatch){return imageMatch[0];}',
            'throw new Error("Pattern image not found.");',
            '}',
            'function findDimensions(){',
            'var bodyText=document.body?document.body.innerText:"";',
            'var match=bodyText.match(/(\\d+)\\s*columns?\\s*wide\\s*x\\s*(\\d+)\\s*rows?\\s*tall/i);',
            'if(!match){throw new Error("Pattern dimensions not found.");}',
            'return {cols:parseInt(match[1],10),rows:parseInt(match[2],10)};',
            '}',
            'try{',
            'var dimensions=findDimensions();',
            'var payload={sourceUrl:location.href,imageUrl:findImage(),cols:dimensions.cols,rows:dimensions.rows};',
            'window.open(' + JSON.stringify(targetPageUrl) + '+ "#import=" + encodeURIComponent(JSON.stringify(payload)),"_blank");',
            '}catch(error){fail(error.message);}',
            '})();'
        ].join('');

        return 'javascript:' + script;
    }

    function applyImportedPayload(payload, appState, helpers) {
        if (!payload || !payload.imageUrl || !payload.cols || !payload.rows) {
            throw new Error('Imported payload is incomplete.');
        }

        websiteUrlInput.value = payload.sourceUrl || '';
        websiteColsInput.value = String(payload.cols);
        websiteRowsInput.value = String(payload.rows);
        setStatus('Loading captured KandiPatterns data...', false);

        helpers.resetDerivedImageState();
        replaceGrid(appState, parseInt(payload.cols, 10), parseInt(payload.rows, 10));

        return Promise.resolve(appState.colorPalette.paletteLoaded)
            .then(function() {
                return loadImageFromUrl(payload.imageUrl);
            })
            .then(function(image) {
                appState.emptyCells = loadImageToGridWithoutPalette(image, appState.gemGrid);
                appState.colorPalette.originalImageColors = appState.gemGrid.getColorCounts();
                appState.colorPalette.createPaletteUI({ skipGridSave: true });
                appState.colorPalette.updateColorCountDisplay();
                appState.sourceClusters = appState.colorPalette.buildConnectedColorClusters();
                appState.sourceColorCounts = buildSourceColorCounts(appState);
                tempPatternData = buildTempPatternFromGrid(appState);
                appState.sourceClusters = tempPatternData.sourceClusters;
                appState.sourceColorCounts = tempPatternData.sourceColorCounts;
                loadTempPatternIntoGrid(appState, tempPatternData);
                appState.colorPalette.quantizeGridToFullPalette({
                    sourceColorCounts: appState.sourceColorCounts || null,
                    sourceClusters: Array.isArray(appState.sourceClusters) && appState.sourceClusters.length > 0
                        ? appState.sourceClusters
                        : null
                });
                appState.colorPalette.originalImageColors = appState.gemGrid.getColorCounts();
                appState.colorPalette.createPaletteUI({ skipGridSave: true });
                appState.colorPalette.updateColorCountDisplay();
                setStatus(
                    'Loaded ' + payload.cols + 'x' + payload.rows + ' from captured page data with automatic temp pattern + Voxel palette applied.',
                    false
                );
            })
            .then(function() {
                showTransientMessage('Captured page loaded.', 1000);
            });
    }

    function readImportedPayloadFromHash() {
        const hash = window.location.hash || '';
        const prefix = '#import=';
        if (!hash.startsWith(prefix)) {
            return null;
        }

        try {
            return JSON.parse(decodeURIComponent(hash.slice(prefix.length)));
        } catch (error) {
            throw new Error('Imported page data could not be parsed.');
        }
    }

    function setStatus(message, isError) {
        websiteStatus.textContent = message;
        websiteStatus.classList.toggle('is-error', isError === true);
    }

    function loadImageToGridWithoutPalette(img, gemGrid) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const insetPercent = 22;
        const sampleCanvas = document.createElement('canvas');
        const sampleCtx = sampleCanvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        sampleCanvas.width = img.width;
        sampleCanvas.height = img.height;
        sampleCtx.drawImage(img, 0, 0);

        const cellWidth = sampleCanvas.width / gemGrid.cols;
        const cellHeight = sampleCanvas.height / gemGrid.rows;

        function averageRegionColor(startX, startY, width, height) {
            const safeX = Math.max(0, Math.floor(startX));
            const safeY = Math.max(0, Math.floor(startY));
            const safeWidth = Math.max(1, Math.min(sampleCanvas.width - safeX, Math.floor(width)));
            const safeHeight = Math.max(1, Math.min(sampleCanvas.height - safeY, Math.floor(height)));
            const imageData = sampleCtx.getImageData(safeX, safeY, safeWidth, safeHeight);
            const pixels = imageData.data;

            let totalR = 0;
            let totalG = 0;
            let totalB = 0;
            let count = 0;

            for (let index = 0; index < pixels.length; index += 4) {
                if (pixels[index + 3] === 0) {
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

        const sampledColors = {};
        const nearWhiteKeys = new Set();

        for (let row = 0; row < gemGrid.rows; row += 1) {
            for (let col = 0; col < gemGrid.cols; col += 1) {
                const insetX = cellWidth * (insetPercent / 100);
                const insetY = cellHeight * (insetPercent / 100);
                const sampleX = col * cellWidth + insetX;
                const sampleY = row * cellHeight + insetY;
                const sampleWidth = Math.max(1, cellWidth - insetX * 2);
                const sampleHeight = Math.max(1, cellHeight - insetY * 2);
                const color = averageRegionColor(sampleX, sampleY, sampleWidth, sampleHeight);
                const key = `${col},${row}`;
                sampledColors[key] = color;

                const rgb = ColorUtils.hexToRgb(color);
                if (rgb.r >= 245 && rgb.g >= 245 && rgb.b >= 245) {
                    nearWhiteKeys.add(key);
                }
            }
        }

        const emptyKeys = new Set();
        const queue = [];
        const enqueueIfNearWhite = (col, row) => {
            const key = `${col},${row}`;
            if (nearWhiteKeys.has(key) && !emptyKeys.has(key)) {
                emptyKeys.add(key);
                queue.push({ col: col, row: row });
            }
        };

        for (let col = 0; col < gemGrid.cols; col += 1) {
            enqueueIfNearWhite(col, 0);
            enqueueIfNearWhite(col, gemGrid.rows - 1);
        }

        for (let row = 0; row < gemGrid.rows; row += 1) {
            enqueueIfNearWhite(0, row);
            enqueueIfNearWhite(gemGrid.cols - 1, row);
        }

        while (queue.length > 0) {
            const current = queue.shift();
            [
                { col: current.col - 1, row: current.row },
                { col: current.col + 1, row: current.row },
                { col: current.col, row: current.row - 1 },
                { col: current.col, row: current.row + 1 }
            ].forEach((neighbor) => {
                if (!gemGrid.isValidCell(neighbor.col, neighbor.row)) {
                    return;
                }

                const neighborKey = `${neighbor.col},${neighbor.row}`;
                if (!nearWhiteKeys.has(neighborKey) || emptyKeys.has(neighborKey)) {
                    return;
                }

                emptyKeys.add(neighborKey);
                queue.push(neighbor);
            });
        }

        Object.keys(sampledColors).forEach((key) => {
            gemGrid.gemColors[key] = emptyKeys.has(key)
                ? gemGrid.defaultColor
                : sampledColors[key];
        });

        gemGrid.render();
        window.setTimeout(function() {
            gemGrid.saveState();
        }, 0);

        return Array.from(emptyKeys);
    }

    function getPositiveInteger(input, label) {
        const value = parseInt(input.value, 10);
        if (!Number.isInteger(value) || value <= 0) {
            throw new Error(label + ' must be a positive integer.');
        }
        return value;
    }

    function syncDimensionInputs(appState) {
        websiteColsInput.value = String(appState.gemGrid.cols);
        websiteRowsInput.value = String(appState.gemGrid.rows);
    }

    function buildPatternExport(appState) {
        const pixelData = [];
        const emptyCellSet = new Set(appState.emptyCells || []);
        for (let row = 0; row < appState.gemGrid.rows; row += 1) {
            for (let col = 0; col < appState.gemGrid.cols; col += 1) {
                const key = `${col},${row}`;
                if (emptyCellSet.has(key)) {
                    continue;
                }
                const color = ColorUtils.normalizeHex(appState.gemGrid.gemColors[`${col},${row}`]);
                pixelData.push({
                    x: col,
                    y: row,
                    color: color
                });
            }
        }

        const sourceUrl = websiteUrlInput.value.trim();
        const slug = sourceUrl.split('/').filter(Boolean).pop() || 'captured-pattern';

        return {
            name: slug,
            author: 'PixLab Website Import',
            grid: {
                x: appState.gemGrid.cols,
                y: appState.gemGrid.rows
            },
            pixelData: pixelData
        };
    }

    function buildSourceColorCounts(appState) {
        const counts = {};
        const emptyCellSet = new Set(appState.emptyCells || []);

        for (let row = 0; row < appState.gemGrid.rows; row += 1) {
            for (let col = 0; col < appState.gemGrid.cols; col += 1) {
                const key = `${col},${row}`;
                if (emptyCellSet.has(key)) {
                    continue;
                }
                const color = ColorUtils.normalizeHex(appState.gemGrid.gemColors[`${col},${row}`]);
                counts[color] = (counts[color] || 0) + 1;
            }
        }

        return counts;
    }

    function buildTempPatternFromGrid(appState) {
        const sourceClusters = appState.colorPalette.buildConnectedColorClusters();
        return {
            grid: {
                x: appState.gemGrid.cols,
                y: appState.gemGrid.rows
            },
            pixelData: buildPatternExport(appState).pixelData.map(function(pixel) {
                return {
                    x: pixel.x,
                    y: pixel.y,
                    color: pixel.color
                };
            }),
            sourceClusters: sourceClusters.map(function(cluster) {
                return {
                    color: cluster.color,
                    representativeColor: cluster.representativeColor,
                    pixels: cluster.pixels.map(function(pixel) {
                        return {
                            x: pixel.x,
                            y: pixel.y
                        };
                    })
                };
            }),
            sourceColorCounts: buildSourceColorCounts(appState),
            emptyCells: (appState.emptyCells || []).map(function(key) {
                const parts = key.split(',');
                return {
                    x: parseInt(parts[0], 10),
                    y: parseInt(parts[1], 10)
                };
            })
        };
    }

    function loadTempPatternIntoGrid(appState, patternData) {
        if (!patternData || !patternData.grid || !Array.isArray(patternData.pixelData)) {
            throw new Error('Temporary pattern data is not available.');
        }

        replaceGrid(appState, parseInt(patternData.grid.x, 10), parseInt(patternData.grid.y, 10));
        const emptyCellSet = new Set(
            Array.isArray(patternData.emptyCells)
                ? patternData.emptyCells.map(function(cell) {
                    return `${cell.x},${cell.y}`;
                })
                : []
        );

        Object.keys(appState.gemGrid.gemColors).forEach(function(key) {
            appState.gemGrid.gemColors[key] = appState.gemGrid.defaultColor;
        });

        patternData.pixelData.forEach(function(pixel) {
            if (!appState.gemGrid.isValidCell(pixel.x, pixel.y)) {
                return;
            }

            appState.gemGrid.gemColors[`${pixel.x},${pixel.y}`] = ColorUtils.normalizeHex(pixel.color);
        });

        appState.gemGrid.render();
        appState.gemGrid.saveState();
        appState.colorPalette.originalImageColors = appState.gemGrid.getColorCounts();
        appState.colorPalette.createPaletteUI({ skipGridSave: true });
        appState.colorPalette.updateColorCountDisplay();
        appState.sourceClusters = Array.isArray(patternData.sourceClusters) ? patternData.sourceClusters : null;
        appState.sourceColorCounts = patternData.sourceColorCounts || null;
        appState.emptyCells = Array.from(emptyCellSet);
    }

    function downloadJson(data, filename) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = filename;
        link.click();
    }

    function replaceGrid(appState, cols, rows) {
        if (appState.gemGrid) {
            appState.gemGrid.destroy();
        }

        appState.gemGrid = createGemGrid(cols, rows);
        appState.colorPalette.setGrid(appState.gemGrid);
        appState.gemGrid.saveState();
        syncDimensionInputs(appState);
    }

    function parseDimensionsText(text) {
        const normalizedText = text.trim();
        const explicitMatches = normalizedText.match(/(\d+)\s*columns?\s*wide\s*x\s*(\d+)\s*rows?\s*tall/i);
        const matches = explicitMatches || normalizedText.match(/(\d+)\D+(\d+)/);
        if (!matches) {
            throw new Error('Dimensions text must include two numbers, for example "50 columns wide x 50 rows tall".');
        }

        return {
            cols: parseInt(matches[1], 10),
            rows: parseInt(matches[2], 10)
        };
    }

    function evaluateXPath(doc, xpath) {
        const result = doc.evaluate(
            xpath,
            doc,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );

        return result.singleNodeValue;
    }

    function extractImageUrlFromHtml(doc, html, pageUrl) {
        const xpathNode = evaluateXPath(doc, DEFAULT_IMAGE_XPATH);
        if (xpathNode) {
            return extractImageUrlFromNode(xpathNode, pageUrl);
        }

        const selectorCandidates = [
            '#pattern-container a.fancybox-image img',
            '#pattern-container img',
            'meta[property="og:image"]',
            'meta[name="twitter:image"]'
        ];

        for (let index = 0; index < selectorCandidates.length; index += 1) {
            const node = doc.querySelector(selectorCandidates[index]);
            if (node) {
                try {
                    return extractImageUrlFromNode(node, pageUrl);
                } catch (error) {
                    // Keep trying fallbacks.
                }
            }
        }

        const imageRegex = /https?:\/\/[^"'\\s>]+(?:pattern|image)[^"'\\s>]*\.(?:png|jpg|jpeg|gif|webp)/i;
        const imageMatch = html.match(imageRegex);
        if (imageMatch) {
            return imageMatch[0];
        }

        throw new Error('Image could not be found in the fetched HTML.');
    }

    function extractDimensionsFromHtml(doc, html) {
        const xpathNode = evaluateXPath(doc, DEFAULT_DIMENSIONS_XPATH);
        if (xpathNode && xpathNode.textContent && xpathNode.textContent.trim()) {
            return parseDimensionsText(xpathNode.textContent);
        }

        const candidates = Array.from(doc.querySelectorAll('td, span, div, p, li, strong'));
        for (let index = 0; index < candidates.length; index += 1) {
            const text = candidates[index].textContent ? candidates[index].textContent.trim() : '';
            if (/columns?\s+wide\s+x\s+\d+\s+rows?\s+tall/i.test(text)) {
                return parseDimensionsText(text);
            }
        }

        const regexMatch = html.match(/(\d+)\s*columns?\s*wide\s*x\s*(\d+)\s*rows?\s*tall/i);
        if (regexMatch) {
            return {
                cols: parseInt(regexMatch[1], 10),
                rows: parseInt(regexMatch[2], 10)
            };
        }

        throw new Error('Dimensions could not be found in the fetched HTML.');
    }

    function extractImageUrlFromNode(node, pageUrl) {
        if (!node) {
            throw new Error('Image XPath did not match any node.');
        }

        if (node.nodeType === Node.ATTRIBUTE_NODE) {
            return new URL(node.nodeValue, pageUrl).href;
        }

        const rawValue = node.getAttribute && (
            node.getAttribute('src') ||
            node.getAttribute('data-src') ||
            node.getAttribute('data-original') ||
            node.getAttribute('content')
        );
        const fallbackValue = node.textContent ? node.textContent.trim() : '';
        const value = rawValue || fallbackValue;

        if (!value) {
            throw new Error('Image node did not include a usable URL.');
        }

        return new URL(value, pageUrl).href;
    }

    function extractDimensionsFromDocument(doc, xpath) {
        if (!xpath.trim()) {
            return null;
        }

        const node = evaluateXPath(doc, xpath);
        if (!node) {
            throw new Error('Dimensions XPath did not match any node.');
        }

        const value = node.textContent ? node.textContent.trim() : '';
        if (!value) {
            throw new Error('Dimensions XPath returned empty text.');
        }

        return parseDimensionsText(value);
    }

    function fetchHtmlDocument(url) {
        return fetch(getProxyUrl('/proxy/html', url))
            .then(function(response) {
                if (!response.ok) {
                    return response.json()
                        .catch(function() {
                            return { error: 'Website proxy request failed with status ' + response.status + '.' };
                        })
                        .then(function(payload) {
                            throw new Error(payload.error || ('Website proxy request failed with status ' + response.status + '.'));
                        });
                }
                return Promise.all([
                    response.text(),
                    Promise.resolve(response.headers.get('x-upstream-status') || '')
                ]);
            })
            .then(function(result) {
                return {
                    doc: new DOMParser().parseFromString(result[0], 'text/html'),
                    html: result[0],
                    upstreamStatus: result[1]
                };
            })
            .catch(function(error) {
                throw new Error(
                    'Website HTML could not be fetched through the local proxy. ' +
                    error.message
                );
            });
    }

    function loadImageFromUrl(imageUrl) {
        return fetch(getProxyUrl('/proxy/image', imageUrl))
            .then(function(response) {
                if (!response.ok) {
                    return response.json()
                        .catch(function() {
                            return { error: 'Image proxy request failed with status ' + response.status + '.' };
                        })
                        .then(function(payload) {
                            throw new Error(payload.error || ('Image proxy request failed with status ' + response.status + '.'));
                        });
                }
                return response.blob();
            })
            .then(function(blob) {
                return new Promise(function(resolve, reject) {
                    const objectUrl = URL.createObjectURL(blob);
                    const image = new Image();

                    image.onload = function() {
                        URL.revokeObjectURL(objectUrl);
                        resolve(image);
                    };

                    image.onerror = function() {
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error('Downloaded image could not be decoded.'));
                    };

                    image.src = objectUrl;
                });
            })
            .catch(function(error) {
                throw new Error(
                    'Image could not be downloaded through the local proxy. ' +
                    error.message
                );
            });
    }

    const appStateRef = {
        gemGrid: createGemGrid(DEFAULT_COLS, DEFAULT_ROWS),
        colorPalette: null,
        sourceClusters: null,
        sourceColorCounts: null,
        emptyCells: []
    };

    appStateRef.colorPalette = new ColorPalette('colorPaletteContainer', appStateRef.gemGrid, {
        palettePath: 'full_color_palette_voxelblastjam.json',
        allowColorPicker: false,
        allowHexEditing: false,
        useDetectedColorsAsPalette: false,
        useFullPaletteAsDisplay: true,
        allowLoadedPaletteOverride: false,
        useTwoColumnPalette: true
    });
    window.colorPalette = appStateRef.colorPalette;
    document.getElementById('colorPaletteContainer').parentNode.colorPalette = appStateRef.colorPalette;

    kandiCaptureBookmarklet.href = buildBookmarkletHref(window.location.origin + window.location.pathname);

    exportPatternJsonButton.addEventListener('click', function() {
        const exportData = buildPatternExport(appStateRef);
        const sourceUrl = websiteUrlInput.value.trim();
        const slug = sourceUrl.split('/').filter(Boolean).pop() || 'captured-pattern';
        const sizeSuffix = '_' + appStateRef.gemGrid.rows + 'x' + appStateRef.gemGrid.cols;
        downloadJson(exportData, slug + sizeSuffix + '.json');
        showTransientMessage('JSON exported.', 1000);
    });

    generateTempJsonButton.addEventListener('click', function() {
        tempPatternData = buildTempPatternFromGrid(appStateRef);
        appStateRef.sourceClusters = tempPatternData.sourceClusters;
        appStateRef.sourceColorCounts = tempPatternData.sourceColorCounts;
        setStatus(
            'Temporary pattern saved in memory with ' + tempPatternData.pixelData.length + ' colored cells.',
            false
        );
        showTransientMessage('Temp JSON generated.', 1000);
    });

    downloadTempJsonButton.addEventListener('click', function() {
        try {
            if (!tempPatternData) {
                throw new Error('Generate Temp JSON first.');
            }

            const sourceUrl = websiteUrlInput.value.trim();
            const slug = sourceUrl.split('/').filter(Boolean).pop() || 'captured-pattern';
            const sizeSuffix = '_' + tempPatternData.grid.y + 'x' + tempPatternData.grid.x;
            downloadJson(tempPatternData, slug + '_temp' + sizeSuffix + '.json');
            showTransientMessage('Temp JSON downloaded.', 1000);
        } catch (error) {
            setStatus(error.message, true);
            alert(error.message);
        }
    });

    loadTempPatternButton.addEventListener('click', function() {
        try {
            if (!tempPatternData) {
                throw new Error('Generate Temp JSON first.');
            }

            resetDerivedImageState(appStateRef.colorPalette);
            loadTempPatternIntoGrid(appStateRef, tempPatternData);
            setStatus('Temporary pattern loaded from memory.', false);
            showTransientMessage('Pattern loaded.', 1000);
        } catch (error) {
            setStatus(error.message, true);
            alert(error.message);
        }
    });

    applyVoxelPaletteButton.addEventListener('click', function() {
        Promise.resolve(appStateRef.colorPalette.paletteLoaded)
            .then(function() {
                appStateRef.colorPalette.quantizeGridToFullPalette({
                    emptyCells: appStateRef.emptyCells || [],
                    sourceColorCounts: appStateRef.sourceColorCounts || null,
                    sourceClusters: Array.isArray(appStateRef.sourceClusters) && appStateRef.sourceClusters.length > 0
                        ? appStateRef.sourceClusters
                        : null
                });
                appStateRef.colorPalette.originalImageColors = appStateRef.gemGrid.getColorCounts();
                appStateRef.colorPalette.createPaletteUI({ skipGridSave: true });
                appStateRef.colorPalette.updateColorCountDisplay();
                setStatus('Voxel palette applied to the current grid.', false);
                showTransientMessage('Voxel palette applied.', 1000);
            })
            .catch(function(error) {
                setStatus(error.message, true);
                alert(error.message);
            });
    });

    syncDimensionInputs(appStateRef);
    const importedPayload = readImportedPayloadFromHash();
    if (importedPayload) {
        history.replaceState(null, '', window.location.pathname);
        applyImportedPayload(importedPayload, appStateRef, {
            resetDerivedImageState: function() {
                resetDerivedImageState(appStateRef.colorPalette);
            }
        }).catch(function(error) {
            setStatus(error.message, true);
            alert(error.message);
        });
    }

    if (!appStateRef) {
        console.error('Website import app failed to initialize.');
        setStatus('App initialization failed.', true);
    }
});
