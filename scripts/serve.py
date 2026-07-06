"""
Tiny static dev server that disables caching.

Plain `python -m http.server` lets the browser cache ES modules aggressively,
so edits to js/*.js may not show up on reload. This server sends
`Cache-Control: no-store` on every response so the browser always re-fetches.

Usage:
    python scripts/serve.py [port]   # default port 8765
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, test
from pathlib import Path

ROOT = Path(__file__).parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = partial(NoCacheHandler, directory=str(ROOT))
    test(HandlerClass=handler, port=port, bind="127.0.0.1")
