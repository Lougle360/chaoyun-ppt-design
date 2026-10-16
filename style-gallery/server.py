"""Serve this self-contained gallery on the local computer only."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8880)
args = parser.parse_args()
root = str(Path(__file__).resolve().parent.parent)

class GalleryHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(302)
            self.send_header('Location', '/style-gallery/')
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

if __name__ == '__main__':
    with ThreadingHTTPServer(('127.0.0.1', args.port), partial(GalleryHandler, directory=root)) as server:
        print(f'Chaoyun Style Atlas: http://127.0.0.1:{args.port}/style-gallery/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
