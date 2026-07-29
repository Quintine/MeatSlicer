#!/usr/bin/env python3
"""Serve the browser game without exposing tools, secrets, or raw assets."""

from __future__ import annotations

import argparse
import posixpath
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent
PUBLIC_FILES = {"/", "/index.html"}
PUBLIC_PREFIXES = ("/assets/", "/css/", "/js/", "/mp3-music/", "/test/")
PRIVATE_PREFIXES = ("/assets/raw", "/tools")


class GameRequestHandler(SimpleHTTPRequestHandler):
    def is_public(self) -> bool:
        raw_path = unquote(urlsplit(self.path).path)
        if "\\" in raw_path:
            return False
        path = posixpath.normpath(raw_path)
        segments = [segment for segment in path.split("/") if segment]
        if any(segment.startswith(".") for segment in segments):
            return False
        if path in PUBLIC_FILES:
            return True
        if path.startswith(PRIVATE_PREFIXES):
            return False
        return path.startswith(PUBLIC_PREFIXES)

    def list_directory(self, path: str):
        self.send_error(404)
        return None

    def do_GET(self) -> None:
        if not self.is_public():
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self) -> None:
        if not self.is_public():
            self.send_error(404)
            return
        super().do_HEAD()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8123)
    args = parser.parse_args()
    handler = partial(GameRequestHandler, directory=str(ROOT))
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(f"MeatSlicer running at http://{args.bind}:{args.port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
