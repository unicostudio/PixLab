const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '8000', 10);
const ROOT_DIR = process.cwd();

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const BROWSER_LIKE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1'
};

async function readUpstreamErrorText(upstream) {
    try {
        const text = await upstream.text();
        return text.slice(0, 240);
    } catch (error) {
        return '';
    }
}

function sendError(response, statusCode, message) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify({ error: message }));
}

function isAllowedProtocol(targetUrl) {
    return targetUrl.protocol === 'http:' || targetUrl.protocol === 'https:';
}

async function handleProxyHtml(requestUrl, response) {
    const target = requestUrl.searchParams.get('url');
    if (!target) {
        sendError(response, 400, 'Missing url parameter.');
        return;
    }

    let targetUrl;
    try {
        targetUrl = new URL(target);
    } catch (error) {
        sendError(response, 400, 'Invalid target URL.');
        return;
    }

    if (!isAllowedProtocol(targetUrl)) {
        sendError(response, 400, 'Only http and https URLs are supported.');
        return;
    }

    try {
        const upstream = await fetch(targetUrl, {
            headers: {
                ...BROWSER_LIKE_HEADERS,
                'Referer': targetUrl.origin + '/'
            }
        });

        const html = await upstream.text();
        const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';

        if (!contentType.includes('html')) {
            sendError(
                response,
                upstream.status || 502,
                'Upstream HTML request did not return HTML content.'
            );
            return;
        }

        response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Upstream-Status': String(upstream.status)
        });
        response.end(html);
    } catch (error) {
        sendError(response, 502, 'Failed to fetch upstream HTML.');
    }
}

async function handleProxyImage(requestUrl, response) {
    const target = requestUrl.searchParams.get('url');
    if (!target) {
        sendError(response, 400, 'Missing url parameter.');
        return;
    }

    let targetUrl;
    try {
        targetUrl = new URL(target);
    } catch (error) {
        sendError(response, 400, 'Invalid target URL.');
        return;
    }

    if (!isAllowedProtocol(targetUrl)) {
        sendError(response, 400, 'Only http and https URLs are supported.');
        return;
    }

    try {
        const upstream = await fetch(targetUrl, {
            headers: {
                ...BROWSER_LIKE_HEADERS,
                'Referer': targetUrl.origin + '/'
            }
        });

        if (!upstream.ok) {
            const errorPreview = await readUpstreamErrorText(upstream);
            sendError(
                response,
                upstream.status,
                'Upstream image request failed.' + (errorPreview ? ' Response preview: ' + errorPreview : '')
            );
            return;
        }

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        const arrayBuffer = await upstream.arrayBuffer();
        response.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store'
        });
        response.end(Buffer.from(arrayBuffer));
    } catch (error) {
        sendError(response, 502, 'Failed to fetch upstream image.');
    }
}

function handleStaticFile(requestUrl, response) {
    const rawPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    const safePath = path.normalize(rawPath).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(ROOT_DIR, safePath);

    if (!filePath.startsWith(ROOT_DIR)) {
        sendError(response, 403, 'Forbidden.');
        return;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            if (error.code === 'ENOENT') {
                sendError(response, 404, 'File not found.');
                return;
            }
            sendError(response, 500, 'Failed to read file.');
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        response.end(data);
    });
}

const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (requestUrl.pathname === '/proxy/html') {
        handleProxyHtml(requestUrl, response);
        return;
    }

    if (requestUrl.pathname === '/proxy/image') {
        handleProxyImage(requestUrl, response);
        return;
    }

    handleStaticFile(requestUrl, response);
});

server.listen(PORT, () => {
    console.log(`PixLab dev server running at http://localhost:${PORT}`);
});
