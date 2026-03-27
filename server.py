#!/usr/bin/env python3
"""
PixLab local server — serves static files and proxies external URLs for CORS.

Usage:
    python3 server.py

Then open: http://localhost:8080
"""

import http.server
import urllib.request
import urllib.parse
import os

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path.startswith('/proxy?'):
            self.handle_proxy()
        else:
            super().do_GET()

    def handle_proxy(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if 'url' not in params:
            self.send_error(400, 'Missing url parameter')
            return

        target = params['url'][0]

        try:
            req = urllib.request.Request(
                target,
                headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
                ct = resp.headers.get('Content-Type', 'application/octet-stream')
                self.send_response(200)
                self.send_header('Content-Type', ct)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            self.send_error(502, str(e))

    def log_message(self, format, *args):
        print(f'  {args[0]} {args[1]}')


if __name__ == '__main__':
    with http.server.HTTPServer(('', PORT), Handler) as httpd:
        print(f'PixLab running at http://localhost:{PORT}')
        print(f'Proxy available at http://localhost:{PORT}/proxy?url=...')
        print('Press Ctrl+C to stop.')
        httpd.serve_forever()
