#!/usr/bin/env python3
"""Generate 4x HD WebP asset tier from raw AI source art.

Reads ``assets/raw/<name>.png`` (1024x1024 magenta-keyed originals), applies
the same crop/composition as the SD pipeline but at 4x the shipped size,
without palette quantization, and saves as WebP (q90, method=4).

Sheets are rendered at 4x via draw_sprites renderers, bridged through a
temp dir of PNG stills, then converted to WebP.

Usage::
  python tools/hd_assets.py                          # full generation pass
  python tools/hd_assets.py boss player              # substring filter
  python tools/hd_assets.py --force                  # overwrite existing
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path
from shutil import rmtree

from PIL import Image

from gen_assets import SPECS, flood_key_magenta
from draw_sprites import (
    ACTORS,
    render_actor_sheet,
    render_legs_sheet,
    render_player_death_sheet,
)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
SHIPPED = ROOT / "assets"
HD = ROOT / "assets" / "hd"

# Composition-source stills that exist in assets/raw/ but are not in SPECS.
EXTRA_STILLS = {"player_leg", "player_waist"}

STILL_NAMES: set[str] = set(SPECS) | EXTRA_STILLS

WEBP_KWARGS = {"quality": 90, "method": 4}


# ── helpers ──────────────────────────────────────────────────────────


def _shipped_size(name: str) -> int:
    """Return the HD target side length = 4 x shipped image side."""
    with Image.open(SHIPPED / f"{name}.png") as im:
        w, h = im.size
    return max(w, h) * 4


def _process_sprite(raw_path: Path, target_size: int) -> Image.Image | None:
    """Replicate ``gen_assets.process_sprite`` minus palette quantization."""
    image = flood_key_magenta(Image.open(raw_path))
    box = image.getbbox()
    if not box:
        return None
    image = image.crop(box)
    margin = max(1, target_size // 16)
    inner = target_size - margin * 2
    scale = min(inner / image.width, inner / image.height)
    dims = (
        max(1, round(image.width * scale)),
        max(1, round(image.height * scale)),
    )
    image = image.resize(dims, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    canvas.alpha_composite(
        image,
        ((target_size - dims[0]) // 2, (target_size - dims[1]) // 2),
    )
    return canvas


def _process_tile(raw_path: Path, target_size: int) -> Image.Image:
    """Replicate ``gen_assets.process_tile`` minus palette quantization."""
    image = Image.open(raw_path).convert("RGB")
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    return image.resize((target_size, target_size), Image.Resampling.LANCZOS)


def _save_webp(image: Image.Image, path: Path) -> None:
    """Save image as WebP preserving alpha transparently."""
    image.save(str(path), **WEBP_KWARGS)


def _convert_png_to_webp(src: Path, dst: Path) -> None:
    """Open a PNG and re-save as WebP."""
    _save_webp(Image.open(src), dst)


def _hd_total_size() -> int:
    """Total bytes of all files under ``assets/hd/``."""
    if not HD.is_dir():
        return 0
    return sum(f.stat().st_size for f in HD.rglob("*") if f.is_file())


# ── CLI ──────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "filters",
        nargs="*",
        help="asset-name substrings (match any → process; no filters = all)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="overwrite existing WebP outputs",
    )
    return parser.parse_args()


# ── main ─────────────────────────────────────────────────────────────


def main() -> None:
    args = parse_args()
    filters = args.filters
    force = args.force

    HD.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="hd_assets_"))
    print(f"Using temp dir: {tmp}\n")

    # Filter stills.
    stills_to_process = [
        n for n in STILL_NAMES
        if not filters or any(f in n for f in filters)
    ]

    missing_raw: list[str] = []
    processed_stills = 0
    processed_sheets = 0
    skip_stills = 0

    # ── Pass 1 – stills ──────────────────────────────────────────

    for name in stills_to_process:
        raw_path = RAW / f"{name}.png"
        if not raw_path.is_file():
            missing_raw.append(name)
            continue

        try:
            target_size = _shipped_size(name)
        except FileNotFoundError:
            # Shipped asset missing.
            continue

        spec = SPECS.get(name)
        is_tile = spec is not None and spec.kind == "tile"

        if is_tile:
            result = _process_tile(raw_path, target_size)
        else:
            result = _process_sprite(raw_path, target_size)
            if result is None:
                print(f"  ERROR {name}: magenta-key emptied image, skipping")
                missing_raw.append(name)
                continue

        # Always save PNG to temp dir for sheet compositing.
        result.save(str(tmp / f"{name}.png"))

        webp_path = HD / f"{name}.webp"
        if not force and webp_path.is_file():
            print(f"  SKIP  {name}.webp  (exists)")
            skip_stills += 1
        else:
            _save_webp(result, webp_path)
            print(f"  STILL {name}.webp  ({target_size}x{target_size})")
            processed_stills += 1

    # Ensure every still that sheet compositing needs is present as
    # HD PNG in the temp dir.  For items excluded by filters, or items
    # whose raw was missing (no bbox etc.), read back the already-made
    # WebP and convert to PNG, or fall back to re-processing from raw.
    for name in STILL_NAMES:
        png_in_tmp = tmp / f"{name}.png"
        if png_in_tmp.is_file():
            continue
        # Try reading back from already-existing WebP.
        webp_path = HD / f"{name}.webp"
        if webp_path.is_file():
            Image.open(webp_path).save(str(png_in_tmp))
            continue
        # Last chance: process from raw.
        raw_path = RAW / f"{name}.png"
        if not raw_path.is_file():
            continue
        try:
            target_size = _shipped_size(name)
        except FileNotFoundError:
            continue
        spec = SPECS.get(name)
        is_tile = spec is not None and spec.kind == "tile"
        if is_tile:
            result = _process_tile(raw_path, target_size)
        else:
            result = _process_sprite(raw_path, target_size)
        if result is not None:
            result.save(str(png_in_tmp))
            webp_path = HD / f"{name}.webp"
            if force or not webp_path.is_file():
                _save_webp(result, webp_path)
                processed_stills += 1

    # ── Pass 2 – sheets ──────────────────────────────────────────

    # Determine which actor sheets to render.
    sheet_actors = [
        a for a in ACTORS
        if not filters or any(f in a for f in filters)
        or any(f in f"{a}_sheet" for f in filters)
    ]

    do_legs = (
        not filters
        or any(f in "player_legs" for f in filters)
        or any(f in "player" for f in filters)
    )
    do_death = (
        not filters
        or any(f in "player_death" for f in filters)
        or any(f in "player" for f in filters)
    )

    def _maybe_sheet(
        png_name: str,
        render_fn,
        *render_args,
        **render_kwargs,
    ) -> None:
        """Render a single sheet if its WebP does not yet exist."""
        nonlocal processed_sheets
        webp_name = png_name.rsplit(".", 1)[0] + ".webp"
        webp_path = HD / webp_name
        if not force and webp_path.is_file():
            print(f"  SKIP  {webp_name}  (exists)")
            return
        try:
            render_fn(*render_args, **render_kwargs)
        except Exception as exc:
            print(f"  ERROR {webp_name}: {exc}")
            return
        png_path = tmp / png_name
        if png_path.is_file():
            _convert_png_to_webp(png_path, webp_path)
            print(f"  SHEET {webp_name}  ({png_path.stat().st_size} bytes)")
            processed_sheets += 1
            png_path.unlink(missing_ok=True)

    for actor in sheet_actors:
        _maybe_sheet(
            f"{actor}_sheet.png",
            render_actor_sheet,
            actor,
            use_existing=True,
            scale=4,
            smooth=True,
            src_dir=tmp,
            out_dir=tmp,
        )

    if do_legs:
        _maybe_sheet(
            "player_legs_sheet.png",
            render_legs_sheet,
            scale=4,
            smooth=True,
            src_dir=tmp,
            out_dir=tmp,
        )
        _maybe_sheet(
            "player_legs.png",
            render_legs_sheet,
            scale=4,
            smooth=True,
            src_dir=tmp,
            out_dir=tmp,
        )

    if do_death:
        _maybe_sheet(
            "player_death_sheet.png",
            render_player_death_sheet,
            scale=4,
            smooth=True,
            src_dir=tmp,
            out_dir=tmp,
        )

    # Clean up temp dir.
    rmtree(tmp, ignore_errors=True)

    # ── Report ──────────────────────────────────────────────────
    total_size = _hd_total_size()
    print()
    print(f"  Still images processed: {processed_stills}")
    print(f"  Sheets processed:       {processed_sheets}")
    print(f"  Skipped (already exist): {skip_stills}")
    if missing_raw:
        print(f"  Missing raw sources:    {len(missing_raw)}")
        for n in missing_raw:
            print(f"    - {n}")
        print("  (runtime per-sprite SD fallback when raw is absent)")
    print(f"  assets/hd/ total size:  {total_size} bytes")
    if missing_raw:
        print("  Note: missing-raw assets fall back to SD at runtime")


if __name__ == "__main__":
    main()
