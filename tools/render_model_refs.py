#!/usr/bin/env python3
"""Render Meshy weapon GLBs to 2D magenta-backed stills via Blender."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLENDER_SCRIPT = Path(__file__).resolve().parent / "render_model_refs_blender.py"
IN_DIR = ROOT / "assets" / "raw" / "models"
OUT_DIR = ROOT / "assets" / "raw" / "guides" / "models"


def main() -> int:
    blender = shutil.which("blender")
    if not blender:
        print("blender: missing binary; skipping model reference renders")
        return 0
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cmd = [
        blender,
        "--background",
        "--python",
        str(BLENDER_SCRIPT),
        "--",
        "--in",
        str(IN_DIR),
        "--out",
        str(OUT_DIR),
    ]
    print(" ".join(cmd))
    return subprocess.call(cmd)


if __name__ == "__main__":
    sys.exit(main())
