/**
 * URL fetching and parsing utilities for the URL Import page.
 */
const UrlFetcher = (function() {

    /**
     * Extract slug from URL: last non-empty path segment, extension stripped.
     * e.g. "https://kandipatterns.com/patterns/misc/pretzel-62072" → "pretzel-62072"
     * e.g. "https://example.com/foo/bar.png" → "bar"
     * @param {string} url
     * @returns {string}
     */
    function extractSlug(url) {
        try {
            const pathname = new URL(url).pathname;
            const segments = pathname.split('/').filter(function(s) { return s.length > 0; });
            if (segments.length === 0) return 'pattern';
            const last = segments[segments.length - 1];
            const dotIndex = last.lastIndexOf('.');
            return dotIndex > 0 ? last.slice(0, dotIndex) : last;
        } catch (e) {
            return 'pattern';
        }
    }

    /**
     * Fetch page HTML via allorigins CORS proxy.
     * Rejects if the fetch fails or the response status is not ok.
     * @param {string} url
     * @returns {Promise<string>} page HTML
     */
    function fetchPageHtml(url) {
        const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
        return fetch(proxyUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Proxy request failed: ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                if (!data || typeof data.contents !== 'string') {
                    throw new Error('Unexpected proxy response format.');
                }
                return data.contents;
            });
    }

    /**
     * Parse cols and rows from HTML string.
     * Looks for "50 columns wide x 50 rows tall" pattern.
     * @param {string} html
     * @returns {{ cols: number, rows: number }|null}
     */
    function parsePatternSize(html) {
        const match = html.match(/(\d+)\s+columns?\s+wide\s+x\s+(\d+)\s+rows?\s+tall/i);
        if (!match) return null;
        const cols = parseInt(match[1], 10);
        const rows = parseInt(match[2], 10);
        if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) return null;
        return { cols: cols, rows: rows };
    }

    /**
     * Find main pattern image URL from HTML string.
     * Priority: first <img src> containing "/patterns/" in the path.
     * Fallback: first <img src> ending in .png, .jpg, .jpeg, or .gif.
     * Resolves relative URLs against baseUrl.
     * @param {string} html
     * @param {string} baseUrl
     * @returns {string|null}
     */
    function extractImageUrl(html, baseUrl) {
        const imgRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
        let match;
        const candidates = [];

        while ((match = imgRegex.exec(html)) !== null) {
            candidates.push(match[1]);
        }

        // Priority: src containing "/patterns/"
        let found = candidates.find(function(src) {
            return src.indexOf('/patterns/') !== -1;
        });

        // Fallback: first image ending in .png, .jpg, .jpeg, .gif
        if (!found) {
            found = candidates.find(function(src) {
                return /\.(png|jpg|jpeg|gif)(\?|$)/i.test(src);
            });
        }

        if (!found) return null;

        // Resolve relative URLs
        try {
            return new URL(found, baseUrl).href;
        } catch (e) {
            return found;
        }
    }

    /**
     * Return a proxied image URL safe for canvas use (avoids CORS taint).
     * @param {string} imageUrl
     * @returns {string}
     */
    function proxyImageUrl(imageUrl) {
        return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(imageUrl);
    }

    return {
        extractSlug: extractSlug,
        fetchPageHtml: fetchPageHtml,
        parsePatternSize: parsePatternSize,
        extractImageUrl: extractImageUrl,
        proxyImageUrl: proxyImageUrl
    };
})();
