#!/usr/bin/env python3
"""
MeatSlicer hand-crafted pixel-art sprite renderer.

Draws every game asset with Pillow at native pixel resolution (no
anti-aliasing, chunky 1px detail) in a consistent grimy meat-and-bone
palette. Overwrites assets/<name>.png.

Usage: python tools/draw_sprites.py [substr ...]   # optional name filters
"""
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"

# ---- palette ----
OUTL = (16, 6, 9, 255)          # near-black maroon outline
MEAT_D = (111, 20, 34, 255)
MEAT = (157, 31, 48, 255)
MEAT_L = (201, 66, 67, 255)
BLOOD_D = (84, 7, 18, 255)
BLOOD = (174, 15, 38, 255)
GORE = (239, 35, 67, 255)
BONE = (244, 232, 211, 255)
BONE_D = (190, 174, 145, 255)
GOLD = (218, 176, 54, 255)
STEEL = (201, 210, 218, 255)
STEEL_D = (99, 111, 123, 255)
SKIN = (221, 181, 143, 255)
GREEN = (123, 211, 55, 255)
GREEN_D = (67, 143, 31, 255)
PURPLE = (143, 82, 176, 255)
PURPLE_D = (82, 44, 111, 255)
TEAL = (66, 237, 208, 255)
BLUE = (66, 155, 239, 255)
YELLOW = (255, 228, 91, 255)
WHITE = (255, 247, 233, 255)
BLACK = (4, 1, 3, 255)
SHAMB = (116, 157, 60, 255)
SHAMB_D = (67, 98, 37, 255)
BROWN = (153, 108, 59, 255)
BROWN_D = (94, 62, 35, 255)


def canvas(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def E(d, box, c):    d.ellipse(box, fill=c)
def R(d, box, c):    d.rectangle(box, fill=c)
def P(d, pts, c):    d.polygon(pts, fill=c)
def L(d, pts, c, w=1): d.line(pts, fill=c, width=w)


def oc(d, cx, cy, r, fill, ol=OUTL):
    """outlined circle"""
    E(d, [cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1], ol)
    E(d, [cx - r, cy - r, cx + r, cy + r], fill)


def speckle(d, size, n, cols, seed, box=None):
    rng = random.Random(seed)
    x0, y0, x1, y1 = box or (0, 0, size - 1, size - 1)
    for _ in range(n):
        x = rng.randint(x0, x1)
        y = rng.randint(y0, y1)
        d.point((x, y), fill=rng.choice(cols))


def finish_sprite(img, name):
    """Apply one shared finishing pass so the entire set reads as one atlas."""
    alpha = img.getchannel("A")
    rgb = ImageEnhance.Color(img.convert("RGB")).enhance(1.10)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.06)
    graded = rgb.convert("RGBA")
    graded.putalpha(alpha)

    # Transparent gameplay sprites get a consistent one-pixel wine-black rim.
    # Tiles and decals intentionally remain seamless/soft at their edges.
    if not name.startswith(("tile_", "decal_")):
        expanded = alpha.filter(ImageFilter.MaxFilter(3))
        rim = Image.new("RGBA", img.size, OUTL)
        rim.putalpha(expanded)
        rim.alpha_composite(graded)
        graded = rim

    # Production art is authored on a small logical grid, then finished on a
    # 2x canvas. The second-resolution texture pixels and highlights retain a
    # crisp 32-bit-era silhouette while avoiding the old 16/32px placeholder
    # look at gameplay scale.
    graded = graded.resize((graded.width * 2, graded.height * 2), Image.Resampling.NEAREST)

    # Passive items are presented as filthy relic medallions rather than
    # ungrounded clip-art silhouettes. The object remains unique; the shared
    # iron/bone mount makes the complete inventory read as one designed set.
    if name.startswith(("i_", "a_")):
        is_active = name.startswith("a_")
        plate = Image.new("RGBA", graded.size, (0, 0, 0, 0))
        pd = ImageDraw.Draw(plate)
        w, h = graded.size
        rim = [(w * 0.50, 1), (w * 0.80, h * 0.10), (w - 2, h * 0.38),
               (w * 0.91, h * 0.76), (w * 0.62, h - 2), (w * 0.25, h * 0.91),
               (2, h * 0.63), (w * 0.08, h * 0.24)]
        rim = [(round(x), round(y)) for x, y in rim]
        # actives get a teal-copper mount so they read as usable, not passive
        rim_outline = (45, 104, 98, 255) if is_active else (104, 55, 45, 255)
        plate_fill = (9, 24, 26, 235) if is_active else (31, 11, 19, 235)
        ring = (92, 202, 190, 255) if is_active else (150, 92, 57, 255)
        arc = (120, 240, 224, 210) if is_active else (225, 186, 113, 210)
        pd.polygon(rim, fill=(14, 5, 9, 248), outline=rim_outline, width=3)
        pd.ellipse([7, 7, w - 8, h - 8], fill=plate_fill, outline=ring, width=2)
        pd.arc([11, 11, w - 12, h - 12], 205, 330, fill=arc, width=2)
        for rx, ry in ((9, 16), (w - 11, 17), (13, h - 13), (w - 14, h - 12)):
            pd.ellipse([rx - 2, ry - 2, rx + 2, ry + 2], fill=(83, 91, 91, 255), outline=OUTL, width=1)
        plate.alpha_composite(graded)
        graded = plate

    px = graded.load()
    rng = random.Random(sum(ord(c) for c in name) * 97)
    area = graded.width * graded.height
    is_icon = name.startswith(("w_", "wt_", "i_", "a_"))
    is_tile = name.startswith(("tile_", "door_", "pedestal", "stairs"))
    grit = area // (82 if is_tile else (62 if is_icon else 150))
    for _ in range(max(10, grit)):
        x = rng.randrange(1, graded.width - 1)
        y = rng.randrange(1, graded.height - 1)
        r, g, b, a = px[x, y]
        if a > 220 and (r + g + b) > 90:
            lift = rng.choice((-28, -20, -14, -9, 10, 17))
            px[x, y] = (max(0, min(255, r + lift)), max(0, min(255, g + lift)),
                        max(0, min(255, b + lift)), a)
            if rng.random() < 0.22 and x + 1 < graded.width:
                px[x + 1, y] = px[x, y]

    # Masked scratches, dried blood, oxidisation and greasy edge wear. These
    # are painted at the final 64/128px resolution so they are true detail,
    # not enlarged low-resolution noise.
    scratch_count = 9 if is_tile else (10 if is_icon else 5)
    for _ in range(scratch_count):
        x = rng.randrange(3, graded.width - 3)
        y = rng.randrange(3, graded.height - 3)
        length = rng.randrange(3, max(5, min(graded.width // 6, 14)))
        dx, dy = rng.choice(((1, 0), (1, 1), (1, -1), (0, 1)))
        stain = rng.choice(((48, 18, 20), (72, 25, 22), (92, 12, 22), (112, 76, 48)))
        for n in range(length):
            sx, sy = x + dx * n, y + dy * n
            if not (0 <= sx < graded.width and 0 <= sy < graded.height):
                break
            r, g, b, a = px[sx, sy]
            if a > 180:
                mix = 0.34 if is_tile else 0.26
                px[sx, sy] = (round(r * (1 - mix) + stain[0] * mix),
                              round(g * (1 - mix) + stain[1] * mix),
                              round(b * (1 - mix) + stain[2] * mix), a)

    # Selective chipped highlights make steel, bone, and wet tissue catch the
    # light without smoothing the deliberately hard pixel edges.
    for _ in range(max(5, area // 550)):
        x = rng.randrange(1, graded.width - 1)
        y = rng.randrange(1, graded.height - 1)
        r, g, b, a = px[x, y]
        if a > 220 and r + g + b > 300 and rng.random() < 0.7:
            px[x, y] = (min(255, r + 34), min(255, g + 30), min(255, b + 24), a)

    # Weapon families get larger chips, rivets and congealed blood marks. Side
    # profiles stay readable in inventory; top-down versions stay distinct in
    # the butcher's hands.
    if name.startswith(("w_", "wt_")):
        d = ImageDraw.Draw(graded)
        rng = random.Random(sum(ord(c) for c in name) * 193)
        for _ in range(5 if name.startswith("w_") else 9):
            x, y = rng.randrange(4, graded.width - 4), rng.randrange(4, graded.height - 4)
            if graded.getpixel((x, y))[3] > 180:
                col = rng.choice((BLOOD, BLOOD_D, (81, 88, 91, 255), (219, 176, 79, 255)))
                d.rectangle([x, y, x + rng.randrange(1, 4), y + rng.randrange(1, 3)], fill=col)
    return graded


def save(img, name):
    finish_sprite(img, name).save(OUT / f"{name}.png", optimize=True)


# =====================================================================
# characters / enemies / bosses   (all face RIGHT, sprites rotate in game)
# =====================================================================

def a_player():
    img, d = canvas(64)
    # Ridiculously broad butcher silhouette: tiny head, barrel chest, huge arms.
    oc(d, 28, 34, 19, MEAT_D)
    E(d, [10, 20, 46, 48], (126, 25, 38, 255))                 # chest mass
    oc(d, 17, 25, 10, SKIN)                                    # rear shoulder
    oc(d, 39, 27, 11, SKIN)                                    # weapon shoulder
    E(d, [10, 24, 23, 40], (225, 180, 140, 255))               # rear bicep
    E(d, [34, 22, 50, 40], (230, 184, 142, 255))               # front bicep
    # muscle shadows, veins, and absurd definition
    L(d, [(13, 30), (18, 26), (21, 31)], (157, 79, 67, 255), 2)
    L(d, [(37, 32), (42, 26), (47, 31)], (157, 79, 67, 255), 2)
    L(d, [(42, 22), (45, 29), (49, 34)], BLOOD, 1)
    d.point([(16, 23), (20, 37), (39, 24), (46, 35)], fill=WHITE)
    # blood-stained apron stretched across the torso
    P(d, [(18, 24), (38, 24), (42, 53), (15, 53)], OUTL)
    P(d, [(19, 25), (37, 25), (40, 51), (17, 51)], (184, 133, 76, 255))
    P(d, [(20, 27), (35, 27), (37, 49), (18, 49)], (207, 154, 91, 255))
    L(d, [(17, 25), (39, 25)], (104, 70, 44, 255), 3)
    d.point([(24, 33), (31, 39), (21, 44), (34, 47)], fill=BLOOD)
    # deliberately undersized scowling head and chef crown
    oc(d, 39, 15, 7, SKIN)
    R(d, [33, 6, 47, 13], OUTL); R(d, [34, 7, 46, 12], WHITE)
    E(d, [34, 3, 46, 10], WHITE)
    d.point([(42, 14), (43, 14)], fill=BLACK)
    L(d, [(39, 19), (44, 18)], MEAT_D, 2)
    # thick weapon forearm and clenched fist
    R(d, [43, 30, 58, 38], OUTL); R(d, [44, 31, 56, 37], SKIN)
    oc(d, 58, 34, 4, SKIN)
    L(d, [(48, 31), (51, 37)], (157, 79, 67, 255), 1)
    return img


def _player_legs_frame(index=0, frame_size=96):
    """Eight-frame, distance-driven butcher stride authored facing right.

    Uses the generated single-leg production sprite when present, so the walk
    cycle has the same detail level as the AI-authored torso/weapon art. The
    procedural blocky fallback below only exists for source-only rebuilds.
    Runtime rendering rotates this forward-facing frame smoothly.
    """
    leg_path = OUT / "player_leg.png"
    if leg_path.exists():
        source = Image.open(leg_path).convert("RGBA")
        box = source.getbbox()
        if box:
            source = source.crop(box)
        # Legs are deliberately tucked under the waist: only boots/lower shins
        # should peek out from beneath the torso during the stride.
        scale = min(44 / source.width, 25 / source.height)
        source = source.resize((max(1, round(source.width * scale)), max(1, round(source.height * scale))), Image.Resampling.NEAREST)

        waist = None
        waist_path = OUT / "player_waist.png"
        if waist_path.exists():
            waist = Image.open(waist_path).convert("RGBA")
            waist_box = waist.getbbox()
            if waist_box:
                waist = waist.crop(waist_box)
            # Keep the attachment socket hidden under the freely aimed torso;
            # a larger waist reads as a second body when aim and travel diverge.
            waist_scale = min(38 / waist.width, 38 / waist.height)
            waist = waist.resize((max(1, round(waist.width * waist_scale)), max(1, round(waist.height * waist_scale))), Image.Resampling.NEAREST)

        phase = index / 8 * math.tau
        contact = math.cos(phase)      # frames 0/4 are full-contact extremes
        pass_k = math.sin(phase)
        frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
        cx, cy = frame_size // 2, frame_size // 2 + 3

        def paste_leg(extension, side, lift, mirrored=False):
            # Anchor both thighs beneath the waist and vary only their extension.
            # Translating the whole source would expose its cropped thigh behind
            # the hips; scaling keeps both boots unmistakably pointed forward.
            img = source.transpose(Image.Transpose.FLIP_TOP_BOTTOM) if mirrored else source
            lift_scale = 1 + lift * 0.08
            img = img.resize((round(extension * lift_scale), round(img.height * lift_scale)), Image.Resampling.NEAREST)
            x = round(cx - 8)
            y = round(cy + side * 11 - img.height / 2)
            frame.alpha_composite(img, (x, y))

        # Feet trade long/short extensions through contact and pass poses.
        # Mirroring one copy makes the generated art read as a left/right pair.
        left_extension = 34 + contact * 9
        right_extension = 34 - contact * 9
        paste_leg(right_extension, 1, max(0, -pass_k), True)
        paste_leg(left_extension, -1, max(0, pass_k))
        if waist is not None:
            frame.alpha_composite(waist, (round(cx - waist.width / 2), round(cy - waist.height / 2)))
        else:
            # Source-only fallback: cover the thigh joints with a compact hip block.
            d = ImageDraw.Draw(frame)
            d.polygon([(cx - 15, cy - 13), (cx + 12, cy - 12), (cx + 16, cy + 11), (cx - 17, cy + 12)], fill=OUTL)
            d.polygon([(cx - 13, cy - 11), (cx + 10, cy - 10), (cx + 13, cy + 9), (cx - 14, cy + 10)], fill=(116, 76, 45, 255))
            d.line([(cx - 11, cy - 9), (cx + 8, cy - 9)], fill=(201, 151, 88, 255), width=2)
        return frame

    logical = 48
    img, d = canvas(logical)
    phase = index / 8 * math.tau
    # Contact frames 0/4 plant opposite boots at full extension; the audio
    # clock also fires at those half-cycle boundaries.
    stride = math.cos(phase) * 10.0
    lift_l = max(0.0, math.sin(phase))
    lift_r = max(0.0, -math.sin(phase))
    sway = math.cos(phase) * 0.8
    bob = -round(abs(math.sin(phase)) * 1.5)

    # Hip/apron hem hides the leg joints beneath the independently aimed torso.
    P(d, [(15, 17 + bob), (32, 17 + bob), (34, 29 + bob), (14, 29 + bob)], OUTL)
    P(d, [(17, 18 + bob), (30, 18 + bob), (32, 27 + bob), (16, 27 + bob)], (116, 76, 45, 255))
    L(d, [(18, 19 + bob), (29, 19 + bob)], (201, 151, 88, 255), 2)

    def leg(y, travel, lift, rear=False):
        x = 24 + travel
        yy = y + sway * (-1 if rear else 1)
        P(d, [(18, yy - 4), (28, yy - 4), (31 + travel * .35, yy + 3),
              (19 + travel * .35, yy + 4)], OUTL)
        P(d, [(19, yy - 3), (27, yy - 3), (29 + travel * .35, yy + 2),
              (20 + travel * .35, yy + 3)], (73, 46, 37, 255))
        # Lifted feet grow slightly in top-down perspective.
        bw = 8 + round(lift * 1.5)
        bh = 6 + round(lift)
        bx = x + 4
        by = yy
        E(d, [bx - bw, by - bh / 2, bx + bw, by + bh / 2], OUTL)
        E(d, [bx - bw + 1, by - bh / 2 + 1, bx + bw - 1, by + bh / 2 - 1], (44, 39, 37, 255))
        R(d, [bx + bw - 4, by - bh / 2 + 1, bx + bw - 1, by + bh / 2 - 1], STEEL_D)
        if lift > .25:
            L(d, [(bx - 2, by - 2), (bx + 4, by - 2)], (151, 137, 112, 255), 1)

    # Rear foot first so crossing strides overlap naturally.
    leg(31, -stride, lift_r, True)
    leg(17, stride, lift_l, False)
    speckle(d, logical, 8, (BLOOD_D, BROWN_D), 700 + index, (12, 11, 44, 38))

    frame = finish_sprite(img, "player_legs")
    if frame.size != (frame_size, frame_size):
        frame = frame.resize((frame_size, frame_size), Image.Resampling.NEAREST)
    return frame


def a_player_legs():
    """Static planted stance used when the compact animation sheet is missing."""
    frame = _player_legs_frame(0, 96)
    return frame.resize((48, 48), Image.Resampling.NEAREST)


def a_player_torso(wid):
    """Procedural fallback and composition guide for a weapon-specific torso."""
    img, _d = canvas(64)
    body = a_player().resize((48, 48), Image.Resampling.NEAREST)
    weapon = a_weapon_top(wid).resize((44, 44), Image.Resampling.NEAREST)
    img.alpha_composite(body, (0, 8))
    img.alpha_composite(weapon, (24, 10))
    d = ImageDraw.Draw(img)
    # Repaint two fists over the rear grip so the guide unmistakably reads held.
    oc(d, 33, 28, 3, SKIN)
    oc(d, 38, 35, 3, SKIN)
    L(d, [(29, 27), (35, 29)], (157, 79, 67, 255), 2)
    L(d, [(31, 35), (40, 34)], (157, 79, 67, 255), 2)
    return img


def a_shambler():
    img, d = canvas(40)
    # reaching arms
    R(d, [24, 12, 33, 16], SHAMB_D)
    R(d, [24, 25, 33, 29], SHAMB_D)
    d.point([(32, 13), (33, 15), (32, 27)], fill=SHAMB)
    oc(d, 18, 20, 10, SHAMB)
    E(d, [10, 12, 22, 28], SHAMB_D)                            # belly shade
    # face
    d.point([(22, 16), (22, 22)], fill=BLACK)                  # eyes
    R(d, [20, 25, 25, 27], BLOOD_D)                            # mouth
    d.point([(21, 25), (23, 25)], fill=BONE)                   # teeth
    speckle(d, 40, 10, [BLOOD, SHAMB_D], 7, box=(10, 12, 26, 28))
    return img


def a_runner():
    img, d = canvas(40)
    # limbs sprinting right
    P(d, [(22, 12), (36, 8), (34, 13), (24, 16)], MEAT_L)
    P(d, [(22, 26), (36, 30), (34, 34), (24, 30)], MEAT_L)
    P(d, [(8, 14), (2, 10), (4, 16)], MEAT_D)
    P(d, [(8, 26), (2, 30), (4, 24)], MEAT_D)
    oc(d, 17, 20, 8, (163, 62, 46, 255))
    E(d, [20, 15, 29, 25], MEAT_L)                             # snout
    d.point([(25, 17), (26, 17)], fill=YELLOW)                 # eye
    d.point([(27, 22), (28, 22), (26, 23)], fill=BONE)         # teeth
    return img


def a_spitter():
    img, d = canvas(40)
    oc(d, 18, 20, 10, PURPLE)
    E(d, [9, 11, 20, 29], PURPLE_D)
    # big drooling maw
    oc(d, 22, 20, 6, (30, 10, 20, 255))
    for i, (tx, ty) in enumerate([(19, 15), (22, 14), (25, 15), (19, 25), (22, 26), (25, 25)]):
        d.point([(tx, ty)], fill=BONE)
    d.point([(24, 28), (25, 30), (23, 31)], fill=GREEN)        # drool
    d.point([(14, 13), (15, 13)], fill=YELLOW)                 # eye
    speckle(d, 40, 8, [PURPLE_D, GREEN_D], 11, box=(10, 10, 26, 30))
    return img


def a_splitter():
    img, d = canvas(44)
    oc(d, 20, 22, 12, BROWN)
    # surface growths
    oc(d, 13, 15, 4, BROWN_D)
    oc(d, 26, 13, 5, BROWN_D)
    oc(d, 30, 25, 4, BROWN_D)
    oc(d, 15, 29, 5, BROWN_D)
    d.point([(26, 12), (15, 14), (30, 24)], fill=MEAT_L)
    d.point([(24, 20), (24, 24)], fill=BLACK)                  # eyes
    R(d, [22, 27, 27, 29], BLOOD_D)
    return img


def a_mini():
    img, d = canvas(24)
    E(d, [4, 8, 20, 17], OUTL)
    E(d, [5, 9, 19, 16], MEAT_D)
    E(d, [13, 9, 19, 16], GORE)                                # head
    d.point([(15, 15), (17, 15), (16, 15)], fill=BONE)         # teeth
    d.point([(17, 11)], fill=BLACK)                            # eye
    d.point([(7, 10), (9, 13), (8, 14)], fill=BLOOD_D)         # gore speckle
    R(d, [7, 16, 9, 18], BLOOD_D)                              # tail nub
    return img


def a_exploder():
    img, d = canvas(40)
    oc(d, 19, 21, 10, (201, 59, 59, 255))
    E(d, [11, 13, 22, 29], MEAT_L)
    # glowing veins
    L(d, [(14, 16), (19, 20), (16, 25)], YELLOW)
    L(d, [(24, 14), (21, 20), (26, 26)], YELLOW)
    d.point([(19, 20), (17, 18), (23, 23)], fill=WHITE)        # hot spots
    d.point([(23, 17), (23, 18)], fill=BLACK)                  # eye
    return img


def _teeth_ring(d, cx, cy, r_out, r_in, n, c):
    for i in range(n):
        a0 = (i / n) * math.tau if hasattr(math, "tau") else (i / n) * 2 * math.pi
        a1 = ((i + 0.5) / n) * 2 * math.pi
        a2 = ((i + 1) / n) * 2 * math.pi
        p1 = (cx + math.cos(a0) * r_in, cy + math.sin(a0) * r_in)
        pm = (cx + math.cos(a1) * r_out, cy + math.sin(a1) * r_out)
        p2 = (cx + math.cos(a2) * r_in, cy + math.sin(a2) * r_in)
        P(d, [p1, pm, p2], c)


def a_boss_bonesaw():
    img, d = canvas(96)
    cx = cy = 48
    _teeth_ring(d, cx, cy, 45, 36, 18, STEEL_D)
    oc(d, cx, cy, 37, STEEL_D)
    E(d, [cx - 36, cy - 36, cx + 36, cy + 36], STEEL)
    E(d, [cx - 26, cy - 26, cx + 26, cy + 26], BONE_D)
    # bone segments
    for i in range(8):
        a = i * math.pi / 4
        x0 = cx + math.cos(a) * 8
        y0 = cy + math.sin(a) * 8
        x1 = cx + math.cos(a) * 24
        y1 = cy + math.sin(a) * 24
        L(d, [(x0, y0), (x1, y1)], BONE, 4)
    oc(d, cx, cy, 9, MEAT_D)                                   # hub
    E(d, [cx - 5, cy - 5, cx + 5, cy + 5], (40, 8, 12, 255))
    d.point([(cx + 2, cy - 2), (cx + 3, cy - 2)], fill=GORE)   # eye glint
    speckle(d, 96, 26, [BLOOD_D, BLOOD], 3, box=(cx - 30, cy - 30, cx + 30, cy + 30))
    return img


def a_boss_gorecrown():
    img, d = canvas(96)
    cx, cy = 48, 52
    # crown of bone shards
    for i in range(7):
        a = math.pi * (1.15 + 0.7 * i / 6)                     # top arc
        bx = cx + math.cos(a) * 30
        by = cy + math.sin(a) * 30
        tx = cx + math.cos(a) * 44
        ty = cy + math.sin(a) * 44
        P(d, [(bx - 4, by), (bx + 4, by), (tx, ty)], BONE)
    # pulsing body (two lobes + taper)
    oc(d, cx - 12, cy - 8, 18, MEAT)
    oc(d, cx + 12, cy - 8, 18, MEAT)
    P(d, [(cx - 28, cy), (cx + 28, cy), (cx, cy + 34)], MEAT)
    P(d, [(cx - 24, cy + 4), (cx + 24, cy + 4), (cx, cy + 30)], MEAT_D)
    # arteries
    L(d, [(cx - 16, cy - 14), (cx - 4, cy + 6), (cx - 8, cy + 22)], BLOOD, 3)
    L(d, [(cx + 14, cy - 16), (cx + 6, cy + 4), (cx + 10, cy + 24)], BLOOD, 3)
    # gold eyes
    oc(d, cx - 9, cy - 10, 4, GOLD)
    oc(d, cx + 9, cy - 10, 4, GOLD)
    d.point([(cx - 8, cy - 10), (cx + 10, cy - 10)], fill=BLACK)
    R(d, [cx - 8, cy + 8, cx + 8, cy + 12], BLOOD_D)           # maw
    for tx in range(cx - 6, cx + 8, 4):
        d.point([(tx, cy + 8)], fill=BONE)
    return img


def a_boss_knifecrawl():
    img, d = canvas(96)
    cx = cy = 48
    # 8 knife legs
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        x0 = cx + math.cos(a) * 14
        y0 = cy + math.sin(a) * 14
        x1 = cx + math.cos(a) * 42
        y1 = cy + math.sin(a) * 42
        L(d, [(x0, y0), (x1, y1)], STEEL_D, 7)
        L(d, [(x0, y0), (x1, y1)], STEEL, 4)
        tx = cx + math.cos(a) * 46
        ty = cy + math.sin(a) * 46
        d.point([(tx, ty)], fill=WHITE)                        # blade tip
        # blood near base
        d.point([(x0 + 1, y0), (x0, y0 + 1)], fill=BLOOD)
    # central fused mass
    oc(d, cx, cy, 17, (90, 107, 122, 255))
    E(d, [cx - 12, cy - 12, cx + 12, cy + 12], STEEL_D)
    # eye cluster
    for (ex, ey) in [(-6, -4), (5, -6), (0, 3), (-3, 7), (7, 5)]:
        oc(d, cx + ex, cy + ey, 3, (200, 30, 40, 255))
        d.point([(cx + ex, cy + ey)], fill=BLACK)
    return img


# =====================================================================
# tiles / doors
# =====================================================================

def _floor(base, dark, vein, seed):
    img, d = canvas(32)
    R(d, [0, 0, 31, 31], base)
    speckle(d, 32, 82, [dark, base, vein], seed)
    rng = random.Random(seed + 1)
    # layered tissue/rust veins with forks and pores
    for _ in range(4):
        x = rng.randint(2, 28)
        y = rng.randint(2, 28)
        ex, ey = x + rng.randint(-9, 9), y + rng.randint(-9, 9)
        L(d, [(x, y), (ex, ey)], dark, 2)
        L(d, [(x, y), (ex, ey)], vein)
        if rng.random() < 0.65:
            L(d, [((x + ex) // 2, (y + ey) // 2), (ex + rng.randint(-4, 4), ey + rng.randint(-4, 4))], vein)
    for _ in range(7):
        x, y = rng.randint(2, 29), rng.randint(2, 29)
        E(d, [x - 1, y - 1, x + 1, y + 1], dark)
        d.point([(x, y)], fill=(22, 8, 12, 255))
    # subtle slab edge and accumulated black grime
    L(d, [(0, 0), (31, 0)], tuple(min(255, c + 16) for c in base[:3]) + (255,))
    L(d, [(0, 31), (31, 31)], dark)
    L(d, [(31, 0), (31, 31)], dark)
    return img


def a_floor1():
    img = _floor((34, 17, 21, 255), (47, 22, 28, 255), (89, 29, 40, 255), 10)
    d = ImageDraw.Draw(img)
    # sutured butcher slab
    L(d, [(5, 18), (12, 15), (19, 18), (27, 14)], BLOOD_D, 2)
    for x, y in [(8, 17), (14, 16), (21, 17), (25, 15)]: L(d, [(x - 1, y - 2), (x + 1, y + 2)], BONE_D)
    return img


def a_floor2():
    img = _floor((40, 22, 23, 255), (52, 29, 27, 255), (88, 42, 28, 255), 20)
    d = ImageDraw.Draw(img)
    # corroded metal patch with sunken rivets
    L(d, [(2, 8), (29, 8)], (26, 14, 16, 255), 2)
    L(d, [(2, 24), (29, 24)], (72, 34, 29, 255))
    for x, y in [(4, 4), (27, 4), (4, 27), (27, 27)]:
        oc(d, x, y, 1, STEEL_D, OUTL)
    return img
def a_floor3():
    img = _floor((27, 15, 20, 255), (39, 22, 34, 255), (60, 27, 43, 255), 30)
    d = ImageDraw.Draw(img)
    # black organ membrane, bone chips, and wet pustules
    E(d, [4, 5, 13, 13], (48, 22, 38, 255)); E(d, [20, 18, 29, 27], (54, 23, 41, 255))
    d.point([(7, 22), (24, 9), (19, 27), (8, 8), (25, 22)], fill=BONE_D)
    d.point([(9, 7), (23, 20)], fill=MEAT_L)
    return img


def a_wall():
    img, d = canvas(32)
    R(d, [0, 0, 31, 31], (57, 27, 33, 255))
    R(d, [0, 0, 31, 5], (98, 43, 50, 255))                     # top highlight
    speckle(d, 32, 70, [(43, 19, 25, 255), (80, 35, 43, 255), BLOOD_D], 40)
    L(d, [(0, 3), (31, 3)], (107, 74, 58, 255))                # bone ridge
    d.point([(6, 2), (17, 2), (26, 2)], fill=BONE_D)
    # mortared meat blocks, cracks, hooks and old streaks
    L(d, [(0, 14), (31, 14)], (35, 15, 20, 255), 2)
    L(d, [(15, 5), (15, 14)], (38, 16, 20, 255))
    L(d, [(7, 16), (9, 23), (5, 29)], (28, 11, 15, 255))
    L(d, [(25, 5), (23, 11), (27, 15)], BLOOD_D, 2)
    P(d, [(27, 18), (30, 18), (29, 26), (27, 28)], STEEL_D)
    return img


def a_door_open():
    img, d = canvas(48)
    # black opening
    R(d, [8, 10, 39, 37], BLACK)
    R(d, [10, 12, 37, 35], (12, 6, 8, 255))
    # bone frame
    R(d, [4, 6, 9, 41], OUTL);  R(d, [5, 7, 8, 40], BONE)
    R(d, [38, 6, 43, 41], OUTL); R(d, [39, 7, 42, 40], BONE)
    R(d, [4, 6, 43, 10], OUTL); R(d, [5, 7, 42, 9], BONE_D)
    d.point([(7, 14), (7, 26), (40, 20), (40, 32)], fill=BONE_D)
    return img


def a_door_locked():
    img, d = canvas(48)
    R(d, [4, 6, 43, 41], OUTL)
    R(d, [5, 7, 42, 40], MEAT_D)                               # membrane
    L(d, [(6, 12), (42, 34)], MEAT, 2)
    L(d, [(6, 30), (42, 14)], MEAT, 2)
    # interlocking teeth
    for x in range(6, 42, 6):
        P(d, [(x, 22), (x + 3, 30), (x + 6, 22)], BONE)
        P(d, [(x, 24), (x + 3, 16), (x + 6, 24)], BONE_D)
    speckle(d, 48, 12, [BLOOD, BLOOD_D], 55, box=(6, 8, 41, 39))
    return img


# =====================================================================
# projectiles
# =====================================================================

def a_bullet_bone():
    img, d = canvas(16)
    P(d, [(2, 9), (9, 5), (14, 7), (9, 11)], OUTL)
    P(d, [(3, 9), (9, 6), (13, 7), (9, 10)], BONE)
    d.point([(5, 8), (10, 8)], fill=WHITE)
    return img


def a_bullet_saw():
    img, d = canvas(24)
    _teeth_ring(d, 12, 12, 11, 8, 8, STEEL_D)
    oc(d, 12, 12, 8, STEEL)
    E(d, [8, 8, 16, 16], STEEL_D)
    oc(d, 12, 12, 3, OUTL)
    d.point([(10, 10)], fill=WHITE)
    return img


def a_bullet_cleaver():
    img, d = canvas(20)
    R(d, [2, 8, 8, 12], OUTL); R(d, [3, 9, 7, 11], (120, 84, 50, 255))
    P(d, [(8, 5), (18, 5), (18, 15), (8, 15)], OUTL)
    P(d, [(9, 6), (17, 6), (17, 14), (9, 14)], STEEL)
    L(d, [(9, 13), (17, 13)], WHITE)
    d.point([(15, 8)], fill=BLOOD)
    return img


def a_bullet_harpoon():
    img, d = canvas(28)
    L(d, [(2, 14), (20, 14)], OUTL, 3)
    L(d, [(2, 14), (20, 14)], (176, 144, 112, 255), 1)
    P(d, [(18, 9), (27, 14), (18, 19)], OUTL)
    P(d, [(19, 11), (26, 14), (19, 17)], STEEL)
    P(d, [(20, 11), (16, 7), (22, 12)], STEEL_D)               # barb
    d.point([(4, 13), (8, 13)], fill=BLOOD)
    return img


def a_bullet_eye():
    img, d = canvas(18)
    oc(d, 9, 9, 7, WHITE)
    oc(d, 10, 9, 4, (192, 32, 32, 255))
    E(d, [8, 7, 12, 11], BLACK)
    d.point([(11, 7)], fill=WHITE)
    d.point([(4, 5), (3, 12), (5, 14), (14, 4)], fill=(200, 60, 60, 255))  # vessels
    return img


def a_bullet_syringe():
    img, d = canvas(20)
    L(d, [(16, 10), (19, 10)], STEEL)                          # needle
    R(d, [2, 6, 15, 14], OUTL)
    R(d, [3, 7, 14, 13], (190, 200, 210, 255))
    R(d, [4, 8, 12, 12], GREEN)                                # fluid
    R(d, [1, 8, 3, 12], STEEL_D)                               # plunger
    d.point([(6, 8)], fill=WHITE)
    return img


def a_bullet_gore():
    img, d = canvas(18)
    oc(d, 9, 10, 6, BLOOD)
    E(d, [4, 5, 8, 9], BLOOD)
    E(d, [12, 4, 15, 7], BLOOD)
    d.point([(7, 8), (11, 12)], fill=GORE)
    d.point([(6, 14)], fill=BLOOD_D)
    return img


# =====================================================================
# pickups / props
# =====================================================================

def _gem(c_light, c_dark, size, r):
    img, d = canvas(size)
    cx, cy = size // 2, size // 2
    P(d, [(cx, cy - r), (cx + r - 2, cy), (cx, cy + r), (cx - r + 2, cy)], OUTL)
    P(d, [(cx, cy - r + 1), (cx + r - 3, cy), (cx, cy + r - 1), (cx - r + 3, cy)], c_dark)
    P(d, [(cx, cy - r + 1), (cx + r - 3, cy), (cx, cy)], c_light)
    d.point([(cx - 1, cy - 2)], fill=WHITE)
    return img


def a_gem_small(): return _gem(BLUE, (30, 90, 160, 255), 16, 6)
def a_gem_big():   return _gem(TEAL, (25, 140, 125, 255), 20, 8)


def a_heart():
    img, d = canvas(20)
    E(d, [2, 3, 10, 12], OUTL); E(d, [9, 3, 17, 12], OUTL)
    P(d, [(2, 8), (18, 8), (10, 18)], OUTL)
    E(d, [3, 4, 9, 11], GORE); E(d, [10, 4, 16, 11], GORE)
    P(d, [(3, 8), (17, 8), (10, 17)], GORE)
    R(d, [8, 2, 12, 6], MEAT_D)                                # arteries
    d.point([(6, 6), (7, 6)], fill=WHITE)
    return img


def a_ammo():
    img, d = canvas(20)
    R(d, [2, 8, 17, 17], OUTL)
    R(d, [3, 9, 16, 16], (138, 111, 60, 255))
    R(d, [3, 7, 16, 10], (100, 72, 40, 255))                   # lid
    for i, x in enumerate([5, 9, 13]):
        R(d, [x, 10, x + 2, 15], BONE)
        d.point([(x, 10)], fill=GOLD)
    return img


def a_pedestal():
    img, d = canvas(40)
    E(d, [8, 4, 32, 14], OUTL); E(d, [9, 5, 31, 13], (122, 106, 114, 255))
    R(d, [12, 12, 28, 30], OUTL); R(d, [13, 12, 27, 30], (90, 74, 82, 255))
    R(d, [7, 28, 33, 35], OUTL); R(d, [8, 29, 32, 34], (122, 106, 114, 255))
    L(d, [(16, 6), (14, 12), (15, 18)], BLOOD)                 # drip
    d.point([(11, 7)], fill=WHITE)
    return img


def a_stairs():
    img, d = canvas(40)
    R(d, [4, 4, 35, 35], OUTL)
    R(d, [5, 5, 34, 34], (18, 10, 12, 255))
    for i in range(4):
        y = 9 + i * 6
        R(d, [8, y, 32, y + 3], (12 + i * 4, 8 + i * 2, 10 + i * 2, 255))
        L(d, [(8, y), (32, y)], (107, 74, 58, 255))
    return img


# =====================================================================
# blood decals
# =====================================================================

def _decal(seed, blobs):
    img, d = canvas(48)
    rng = random.Random(seed)
    for (bx, by, br) in blobs:
        E(d, [bx - br, by - br, bx + br, by + br], BLOOD_D)
        E(d, [bx - br + 2, by - br + 2, bx + br - 2, by + br - 2], (107, 14, 24, 255))
    for _ in range(14):                                        # droplets
        x = rng.randint(6, 42)
        y = rng.randint(6, 42)
        r = rng.randint(1, 2)
        E(d, [x - r, y - r, x + r, y + r], BLOOD_D)
    return img


def a_decal1(): return _decal(1, [(24, 24, 13)])
def a_decal2(): return _decal(2, [(16, 24, 8), (28, 22, 9), (36, 26, 6)])
def a_decal3(): return _decal(3, [(24, 24, 17), (14, 14, 7), (34, 34, 7)])
def a_decal4(): return _decal(4, [(12, 30, 5), (22, 22, 4), (30, 16, 5), (38, 10, 3)])


# =====================================================================
# weapon icons (32px)
# =====================================================================

def a_w_bonepopper():
    img, d = canvas(32)
    R(d, [6, 8, 27, 14], OUTL); R(d, [7, 9, 26, 13], BONE)     # barrel/slide
    R(d, [27, 10, 30, 13], OUTL); R(d, [28, 11, 29, 12], BLACK)  # muzzle
    R(d, [6, 14, 12, 27], OUTL); R(d, [7, 15, 11, 26], BONE_D) # rear grip
    P(d, [(13, 14), (18, 14), (16, 20)], OUTL)                 # trigger guard
    d.point([(16, 16)], fill=GOLD)                             # trigger
    d.point([(9, 10), (17, 10), (22, 11)], fill=WHITE)         # glint
    d.point([(8, 18), (8, 22)], fill=BONE)                     # grip joints
    return img


def a_w_repeater():
    img, d = canvas(32)
    for i in range(4):                                         # ribs
        x = 8 + i * 5
        d.arc([x - 4, 4, x + 6, 22], 270, 90, fill=BONE, width=2)
    R(d, [4, 13, 28, 17], OUTL); R(d, [5, 14, 27, 16], STEEL_D)
    R(d, [24, 11, 30, 14], STEEL)                              # muzzle
    return img


def a_w_marrow():
    img, d = canvas(32)
    R(d, [4, 9, 27, 13], OUTL); R(d, [5, 10, 26, 12], BONE)
    R(d, [4, 14, 27, 18], OUTL); R(d, [5, 15, 26, 17], BONE_D)
    R(d, [2, 10, 6, 18], (120, 84, 50, 255))                   # stock
    d.point([(26, 11), (26, 16)], fill=BLACK)
    return img


def a_w_cleaver():
    img, d = canvas(32)
    R(d, [5, 19, 13, 26], OUTL); R(d, [6, 20, 12, 25], (120, 84, 50, 255))
    P(d, [(10, 4), (27, 4), (27, 20), (10, 20)], OUTL)
    P(d, [(11, 5), (26, 5), (26, 19), (11, 19)], STEEL)
    L(d, [(11, 18), (26, 18)], WHITE)
    d.point([(21, 8), (23, 12), (19, 14)], fill=BLOOD)
    return img


def a_w_saw():
    img, d = canvas(32)
    _teeth_ring(d, 16, 13, 11, 8, 10, STEEL_D)
    oc(d, 16, 13, 8, STEEL)
    oc(d, 16, 13, 3, OUTL)
    R(d, [10, 22, 22, 27], OUTL); R(d, [11, 23, 21, 26], (120, 84, 50, 255))
    return img


def a_w_bile():
    img, d = canvas(32)
    P(d, [(6, 13), (20, 9), (26, 10), (26, 20), (20, 21), (6, 17)], OUTL)
    P(d, [(7, 14), (20, 10), (25, 11), (25, 19), (20, 20), (7, 16)], (176, 144, 90, 255))
    d.point([(23, 21), (24, 23), (22, 24)], fill=GREEN)        # drip
    d.point([(21, 12)], fill=GREEN_D)
    R(d, [3, 13, 7, 18], (120, 84, 50, 255))
    return img


def a_w_hemophage():
    img, d = canvas(32)
    R(d, [4, 10, 22, 18], OUTL); R(d, [5, 11, 21, 17], (190, 200, 210, 255))
    R(d, [6, 12, 16, 16], GORE)                                # blood vial
    L(d, [(22, 14), (29, 14)], STEEL)
    R(d, [3, 18, 8, 23], STEEL_D)
    d.point([(9, 12)], fill=WHITE)
    return img


def a_w_eye():
    img, d = canvas(32)
    d.arc([3, 5, 29, 27], 200, 340, fill=(120, 84, 50, 255), width=3)
    L(d, [(6, 23), (26, 8)], BONE_D, 1)                        # string
    oc(d, 16, 15, 6, WHITE)
    oc(d, 17, 15, 3, (192, 32, 32, 255))
    d.point([(17, 15)], fill=BLACK)
    return img


def a_w_guthook():
    img, d = canvas(32)
    L(d, [(3, 26), (24, 8)], OUTL, 4)
    L(d, [(3, 26), (24, 8)], (176, 144, 112, 255), 2)
    P(d, [(22, 4), (30, 7), (24, 12)], STEEL)                  # hook tip
    d.arc([22, 8, 30, 16], 90, 300, fill=STEEL_D, width=2)
    d.point([(8, 21), (12, 18)], fill=BLOOD)
    return img


def a_w_cauterizer():
    img, d = canvas(32)
    R(d, [4, 14, 14, 24], OUTL); R(d, [5, 15, 13, 23], STEEL_D)  # tank
    L(d, [(14, 17), (24, 12)], OUTL, 4)
    L(d, [(14, 17), (24, 12)], STEEL, 2)
    P(d, [(24, 8), (31, 11), (26, 14), (29, 17), (24, 15)], (255, 144, 48, 255))  # flame
    d.point([(25, 12)], fill=YELLOW)
    return img


def a_w_fleshmasher():
    img, d = canvas(32)
    R(d, [4, 12, 26, 20], OUTL); R(d, [5, 13, 25, 19], STEEL_D)
    E(d, [22, 10, 28, 22], OUTL); E(d, [23, 11, 27, 21], BLACK)  # muzzle
    oc(d, 12, 8, 5, MEAT_L)                                    # meat ball
    d.point([(11, 7), (14, 9)], fill=BLOOD_D)
    return img


def a_w_trapqueen():
    img, d = canvas(32)
    d.arc([5, 5, 27, 27], 180, 360, fill=STEEL_D, width=3)
    d.arc([5, 5, 27, 27], 0, 180, fill=STEEL, width=3)
    for i in range(6):                                         # teeth
        a = math.pi * (i / 5)
        x = 16 + math.cos(a) * 11
        y = 16 - math.sin(a) * 11
        d.point([(int(x), int(y))], fill=WHITE)
    E(d, [13, 13, 19, 19], OUTL); E(d, [14, 14, 18, 18], GOLD)
    d.point([(10, 20), (22, 19)], fill=BLOOD)
    return img


def a_w_tenderizer():
    img, d = canvas(32)
    R(d, [13, 13, 17, 28], OUTL); R(d, [14, 14, 16, 27], (120, 84, 50, 255))
    R(d, [6, 3, 24, 13], OUTL); R(d, [7, 4, 23, 12], STEEL_D)
    for x in range(8, 24, 4):
        d.point([(x, 3), (x + 1, 3)], fill=STEEL)              # spikes
        d.point([(x, 12)], fill=STEEL)
    d.point([(10, 6), (19, 9)], fill=BLOOD)
    return img


def a_w_redhand():
    img, d = canvas(32)
    R(d, [4, 12, 12, 21], OUTL); R(d, [5, 13, 11, 20], MEAT_D)  # body
    R(d, [12, 14, 28, 18], OUTL); R(d, [13, 15, 27, 17], STEEL_D)  # bar
    for x in range(13, 28, 3):
        d.point([(x, 14)], fill=STEEL)                         # chain teeth
    R(d, [6, 8, 10, 12], (120, 84, 50, 255))                   # handle
    d.point([(15, 16), (21, 16), (25, 17)], fill=BLOOD)
    return img


def a_w_spinaltap():
    img, d = canvas(32)
    L(d, [(3, 20), (28, 8)], OUTL, 4)
    for i in range(6):                                         # vertebrae
        t = i / 5
        x = 5 + t * 22
        y = 19 - t * 11
        E(d, [x - 2, y - 2, x + 2, y + 2], BONE)
    L(d, [(3, 20), (28, 8)], (96, 192, 255, 255), 1)           # energy
    d.point([(27, 7), (28, 9), (26, 6)], fill=(224, 240, 255, 255))
    return img


def a_w_swarmjar():
    img, d = canvas(32)
    R(d, [8, 8, 24, 27], OUTL)
    R(d, [9, 9, 23, 26], (200, 210, 215, 110))
    R(d, [7, 5, 25, 9], OUTL); R(d, [8, 6, 24, 8], STEEL_D)    # lid
    rng = random.Random(8)
    for _ in range(9):                                         # maggots
        x = rng.randint(11, 21)
        y = rng.randint(14, 24)
        E(d, [x - 1, y - 1, x + 2, y + 1], (208, 216, 176, 255))
    d.point([(12, 11)], fill=WHITE)
    return img


def a_weapon_top(wid):
    """Oversized top-down in-hand silhouette, authored separately from HUD art."""
    img, d = canvas(64)
    cy = 32

    def body(x0, y0, x1, y1, fill=STEEL_D):
        R(d, [x0 - 2, y0 - 2, x1 + 2, y1 + 2], OUTL)
        R(d, [x0, y0, x1, y1], fill)

    # Every weapon has a deliberately exaggerated, readable top silhouette.
    if wid == "bonepopper":
        body(8, 24, 43, 40, BONE_D); body(38, 27, 59, 37, BONE)
        P(d, [(13, 40), (27, 40), (22, 53), (14, 51)], OUTL)
        P(d, [(15, 40), (25, 40), (21, 50), (16, 49)], BROWN_D)
        L(d, [(42, 27), (57, 27)], WHITE, 2)
    elif wid == "repeater":
        body(6, 26, 58, 38, STEEL_D)
        for x in range(12, 48, 7):
            d.arc([x - 5, 18, x + 7, 46], 250, 110, fill=BONE, width=3)
        R(d, [52, 28, 63, 36], STEEL); d.point([(61, 30), (61, 34)], fill=BLACK)
    elif wid == "marrow":
        body(5, 19, 57, 29, BONE); body(5, 35, 57, 45, BONE_D)
        R(d, [53, 20, 63, 28], OUTL); R(d, [53, 36, 63, 44], OUTL)
        L(d, [(8, 24), (46, 24)], WHITE, 2)
    elif wid == "cleaver":
        body(3, 28, 20, 36, BROWN_D)
        P(d, [(18, 12), (61, 15), (61, 49), (18, 52)], OUTL)
        P(d, [(21, 15), (58, 18), (58, 46), (21, 49)], STEEL)
        L(d, [(23, 46), (56, 43)], WHITE, 2); d.point([(45, 23), (50, 36)], fill=BLOOD)
    elif wid == "saw":
        body(5, 26, 35, 38, BROWN_D)
        _teeth_ring(d, 47, cy, 17, 13, 14, STEEL_D)
        oc(d, 47, cy, 12, STEEL); oc(d, 47, cy, 4, OUTL)
    elif wid == "bile":
        body(4, 24, 39, 40, (161, 118, 68, 255))
        P(d, [(36, 19), (62, 25), (62, 39), (36, 45)], OUTL)
        P(d, [(38, 22), (59, 27), (59, 37), (38, 42)], GREEN_D)
        E(d, [45, 26, 56, 38], GREEN); d.point([(57, 39), (60, 43)], fill=GREEN)
    elif wid == "hemophage":
        body(4, 25, 45, 39, STEEL)
        R(d, [12, 28, 39, 36], GORE); L(d, [(44, 32), (63, 32)], WHITE, 2)
        R(d, [5, 22, 10, 42], STEEL_D); d.point([(17, 29), (20, 29)], fill=WHITE)
    elif wid == "eye":
        d.arc([3, 5, 58, 59], 205, 335, fill=BROWN_D, width=7)
        L(d, [(9, 48), (56, 15)], BONE, 2)
        oc(d, 36, cy, 15, WHITE); oc(d, 40, cy, 8, GORE); oc(d, 42, cy, 3, BLACK)
        d.point([(37, 26), (48, 29)], fill=(210, 70, 70, 255))
    elif wid == "guthook":
        L(d, [(3, cy), (52, cy)], OUTL, 8); L(d, [(4, cy), (52, cy)], BONE_D, 4)
        P(d, [(46, 14), (63, 26), (52, 34), (60, 45), (45, 39), (40, 28)], OUTL)
        P(d, [(47, 18), (59, 26), (49, 32), (56, 40), (46, 37), (43, 28)], STEEL)
        d.point([(18, 30), (29, 34), (49, 35)], fill=BLOOD)
    elif wid == "cauterizer":
        body(4, 20, 26, 44, STEEL_D); body(24, 27, 50, 37, STEEL)
        P(d, [(47, 20), (63, 27), (56, 32), (63, 38), (48, 44), (53, 32)], OUTL)
        P(d, [(50, 23), (61, 28), (54, 32), (61, 37), (50, 41), (55, 32)], (255, 126, 35, 255))
        d.point([(58, 31), (59, 32)], fill=YELLOW)
    elif wid == "fleshmasher":
        body(3, 19, 48, 45, STEEL_D); oc(d, 53, cy, 12, OUTL); E(d, [48, 25, 62, 39], BLACK)
        oc(d, 23, cy, 11, MEAT_L); d.point([(19, 29), (27, 36)], fill=BLOOD_D)
        R(d, [8, 23, 12, 41], GOLD)
    elif wid == "trapqueen":
        body(4, 25, 42, 39, STEEL_D)
        d.arc([35, 11, 65, 41], 185, 355, fill=STEEL, width=6)
        d.arc([35, 23, 65, 53], 5, 175, fill=STEEL_D, width=6)
        for y in (20, 44):
            for x in range(42, 62, 6): P(d, [(x, y), (x + 3, cy), (x + 5, y)], BONE)
    elif wid == "tenderizer":
        body(3, 28, 38, 36, BROWN_D)
        R(d, [34, 12, 62, 52], OUTL); R(d, [37, 15, 59, 49], STEEL_D)
        for y in range(17, 50, 8):
            d.point([(58, y), (59, y), (38, y + 2)], fill=STEEL)
        d.point([(46, 21), (52, 39)], fill=BLOOD)
    elif wid == "redhand":
        body(2, 20, 25, 44, MEAT_D); body(22, 25, 61, 39, STEEL_D)
        for x in range(25, 61, 5):
            P(d, [(x, 24), (x + 2, 19), (x + 4, 24)], STEEL)
            P(d, [(x, 40), (x + 2, 45), (x + 4, 40)], STEEL)
        R(d, [7, 13, 18, 22], BROWN_D); d.point([(31, 30), (42, 35), (55, 29)], fill=BLOOD)
    elif wid == "spinaltap":
        L(d, [(3, cy), (61, cy)], OUTL, 10)
        for x in range(7, 58, 8):
            oc(d, x, cy, 6, BONE); R(d, [x - 2, 23, x + 2, 41], BONE_D)
        L(d, [(5, cy), (62, cy)], (72, 205, 255, 255), 3)
        d.point([(61, 29), (62, 32), (61, 35)], fill=WHITE)
    elif wid == "swarmjar":
        body(2, 26, 24, 38, BROWN_D)
        R(d, [20, 13, 57, 51], OUTL); R(d, [23, 16, 54, 48], (175, 190, 180, 210))
        R(d, [53, 19, 62, 45], STEEL_D)
        rng = random.Random(81)
        for _ in range(15):
            x, y = rng.randint(27, 50), rng.randint(20, 44)
            E(d, [x - 2, y - 1, x + 3, y + 1], (216, 224, 177, 255))
        d.point([(27, 18), (30, 18)], fill=WHITE)
    return img


# =====================================================================
# item icons (32px)
# =====================================================================

def a_i_hollowpoints():
    img, d = canvas(32)
    P(d, [(16, 4), (21, 12), (21, 26), (11, 26), (11, 12)], OUTL)
    P(d, [(16, 5), (20, 12), (20, 25), (12, 25), (12, 12)], BONE)
    E(d, [14, 6, 18, 11], OUTL)                                # hollow tip
    d.point([(13, 18)], fill=GOLD)
    return img


def a_i_twitch():
    img, d = canvas(32)
    for i, pts in enumerate([[(6, 22), (14, 14), (22, 18), (26, 10)],
                             [(8, 26), (16, 18), (24, 22)],
                             [(10, 12), (18, 8), (24, 12)]]):
        L(d, [tuple(p) for p in pts], MEAT_L if i == 0 else MEAT_D, 3)
    d.point([(15, 15), (20, 19), (12, 20)], fill=GORE)
    d.point([(25, 9)], fill=YELLOW)                            # spark
    return img


def a_i_scalpel():
    img, d = canvas(32)
    # dark handle
    L(d, [(5, 27), (16, 16)], OUTL, 6)
    L(d, [(5, 27), (16, 16)], (70, 74, 82, 255), 3)
    d.point([(7, 25), (10, 22)], fill=STEEL)                   # grip ridges
    # bright triangular blade
    P(d, [(14, 17), (29, 3), (22, 17)], OUTL)
    P(d, [(15, 16), (27, 5), (21, 16)], STEEL)
    L(d, [(17, 14), (26, 6)], WHITE)
    d.point([(12, 19), (14, 21)], fill=BLOOD)
    return img


def a_i_leadmarrow():
    img, d = canvas(32)
    oc(d, 16, 16, 12, BONE)
    oc(d, 16, 16, 7, BONE_D)
    oc(d, 16, 16, 4, (60, 56, 64, 255))
    d.point([(12, 12), (21, 19)], fill=WHITE)
    return img


def a_i_piercegaze():
    img, d = canvas(32)
    oc(d, 15, 17, 10, WHITE)
    oc(d, 16, 17, 5, (60, 120, 200, 255))
    E(d, [14, 15, 18, 19], BLACK)
    L(d, [(8, 4), (26, 28)], STEEL_D, 2)                       # needle
    P(d, [(25, 27), (28, 30), (24, 29)], STEEL)
    d.point([(6, 3)], fill=WHITE)
    return img


def a_i_ricochet():
    img, d = canvas(32)
    L(d, [(6, 8), (16, 16), (8, 26)], BONE, 4)                 # bent ribs
    L(d, [(20, 6), (14, 16), (24, 24)], BONE_D, 3)
    oc(d, 24, 12, 3, GOLD)                                     # bullet
    L(d, [(24, 9), (24, 4)], WHITE, 1)
    return img


def a_i_splittongue():
    img, d = canvas(32)
    P(d, [(8, 28), (16, 14), (12, 6), (18, 10), (24, 4), (22, 14), (18, 28)], OUTL)
    P(d, [(10, 26), (16, 15), (14, 8), (18, 12), (22, 7), (20, 15), (17, 26)], GORE)
    L(d, [(15, 22), (17, 15)], MEAT_D)
    return img


def a_i_hydramaw():
    img, d = canvas(32)
    oc(d, 16, 18, 12, (40, 10, 16, 255))
    for a in range(0, 360, 30):
        r1 = math.radians(a)
        x = 16 + math.cos(r1) * 11
        y = 18 + math.sin(r1) * 11
        d.point([(int(x), int(y))], fill=BONE)
    for a in range(15, 360, 45):
        r1 = math.radians(a)
        x = 16 + math.cos(r1) * 6
        y = 18 + math.sin(r1) * 6
        d.point([(int(x), int(y))], fill=BONE_D)
    E(d, [13, 15, 19, 21], BLOOD_D)
    return img


def a_i_homingtumor():
    img, d = canvas(32)
    oc(d, 15, 17, 11, PURPLE)
    oc(d, 8, 10, 4, PURPLE_D)
    oc(d, 24, 9, 3, PURPLE_D)
    oc(d, 17, 17, 6, WHITE)                                    # eye
    oc(d, 18, 17, 3, (200, 40, 40, 255))
    d.point([(18, 17)], fill=BLACK)
    return img


def a_i_orbitalknives():
    img, d = canvas(32)
    d.arc([5, 5, 27, 27], 0, 360, fill=(90, 70, 80, 255), width=1)
    for i in range(3):
        a = i * 2 * math.pi / 3
        x = 16 + math.cos(a) * 11
        y = 16 + math.sin(a) * 11
        P(d, [(x - 2, y + 2), (x + 3, y - 4), (x + 2, y + 3)], STEEL)
        d.point([(int(x), int(y))], fill=OUTL)
    E(d, [14, 14, 18, 18], GOLD)
    return img


def a_i_dentures():
    img, d = canvas(32)
    d.arc([6, 6, 26, 22], 0, 180, fill=(220, 150, 160, 255), width=4)
    for x in range(9, 24, 4):
        R(d, [x, 15, x + 2, 20], BONE)
    P(d, [(10, 15), (13, 15), (11, 25)], BONE)                 # fangs
    P(d, [(19, 15), (22, 15), (21, 25)], BONE)
    d.point([(11, 24), (21, 24)], fill=BLOOD)
    return img


def a_i_volatilebile():
    img, d = canvas(32)
    oc(d, 16, 18, 11, GREEN_D)
    E(d, [8, 10, 20, 26], GREEN)
    d.point([(12, 13), (19, 15)], fill=(220, 255, 150, 255))
    oc(d, 22, 8, 3, YELLOW)                                    # bubble
    oc(d, 9, 6, 2, YELLOW)
    return img


def a_i_backstabber():
    img, d = canvas(32)
    oc(d, 12, 18, 9, (40, 30, 44, 255))                        # shadow back
    P(d, [(20, 6), (26, 8), (17, 20), (14, 17)], OUTL)
    P(d, [(21, 7), (24, 8), (16, 18), (15, 17)], STEEL)
    R(d, [12, 17, 17, 22], (120, 84, 50, 255))
    d.point([(10, 14), (13, 11)], fill=BLOOD)
    return img


def a_i_ironstomach():
    img, d = canvas(32)
    oc(d, 16, 17, 11, STEEL_D)
    E(d, [8, 9, 24, 25], STEEL)
    d.arc([8, 9, 24, 25], 0, 360, fill=OUTL, width=1)
    for a in range(0, 360, 60):
        r1 = math.radians(a)
        d.point([(int(16 + math.cos(r1) * 9), int(17 + math.sin(r1) * 9))], fill=OUTL)  # rivets
    R(d, [14, 3, 18, 8], OUTL); R(d, [15, 4, 17, 7], STEEL_D)  # pipe
    return img


def a_i_luckycoin():
    img, d = canvas(32)
    oc(d, 16, 16, 11, GOLD)
    E(d, [8, 8, 24, 24], (230, 195, 80, 255))
    # skull
    E(d, [12, 10, 20, 18], OUTL)
    d.point([(14, 13), (18, 13)], fill=(230, 195, 80, 255))
    R(d, [14, 18, 18, 21], OUTL)
    d.point([(10, 9), (22, 21), (20, 8)], fill=BLOOD)
    return img


def a_i_magnetmaw():
    img, d = canvas(32)
    d.arc([6, 6, 26, 26], 180, 360, fill=GORE, width=7)
    R(d, [5, 15, 12, 25], GORE); R(d, [20, 15, 27, 25], GORE)
    R(d, [5, 22, 12, 26], BONE); R(d, [20, 22, 27, 26], BONE)  # teeth tips
    d.point([(10, 8), (14, 6), (20, 9)], fill=YELLOW)          # sparks
    return img


def a_i_bloodlust():
    img, d = canvas(32)
    P(d, [(16, 4), (26, 18), (16, 29), (6, 18)], OUTL)
    P(d, [(16, 5), (25, 18), (16, 28), (7, 18)], GORE)
    d.point([(12, 15), (20, 15)], fill=BLACK)                  # screaming eyes
    E(d, [13, 20, 19, 25], BLACK)                              # mouth
    d.point([(11, 9)], fill=WHITE)
    return img


def a_i_splinterbone():
    img, d = canvas(32)
    # main bone shard with a crack
    P(d, [(5, 20), (18, 8), (22, 12), (12, 26)], OUTL)
    P(d, [(6, 20), (17, 10), (20, 12), (12, 24)], BONE)
    L(d, [(10, 18), (15, 16), (14, 21)], BONE_D)
    # splinters flying off
    P(d, [(21, 6), (27, 3), (24, 9)], BONE)
    P(d, [(24, 13), (30, 13), (26, 17)], BONE_D)
    P(d, [(19, 22), (24, 25), (18, 26)], BONE)
    d.point([(26, 5), (27, 14), (21, 24)], fill=WHITE)
    return img


def a_i_ghoulheart():
    img, d = canvas(32)
    E(d, [6, 7, 15, 16], OUTL); E(d, [16, 7, 25, 16], OUTL)
    P(d, [(6, 12), (26, 12), (16, 28)], OUTL)
    E(d, [7, 8, 14, 15], (140, 140, 130, 255))
    E(d, [17, 8, 24, 15], (140, 140, 130, 255))
    P(d, [(7, 12), (25, 12), (16, 27)], (140, 140, 130, 255))
    L(d, [(11, 10), (16, 14), (13, 18), (18, 22)], (90, 90, 85, 255), 1)  # stitches
    d.point([(16, 14), (13, 18)], fill=OUTL)
    return img


# =====================================================================

ASSETS = {
    "player": a_player,
    "player_legs": a_player_legs,
    "enemy_shambler": a_shambler, "enemy_runner": a_runner, "enemy_spitter": a_spitter,
    "enemy_splitter": a_splitter, "enemy_mini": a_mini, "enemy_exploder": a_exploder,
    "boss_bonesaw": a_boss_bonesaw, "boss_gorecrown": a_boss_gorecrown, "boss_knifecrawl": a_boss_knifecrawl,
    "tile_floor1": a_floor1, "tile_floor2": a_floor2, "tile_floor3": a_floor3, "tile_wall": a_wall,
    "door_open": a_door_open, "door_locked": a_door_locked,
    "bullet_bone": a_bullet_bone, "bullet_saw": a_bullet_saw, "bullet_cleaver": a_bullet_cleaver,
    "bullet_harpoon": a_bullet_harpoon, "bullet_eye": a_bullet_eye,
    "bullet_syringe": a_bullet_syringe, "bullet_gore": a_bullet_gore,
    "gem_small": a_gem_small, "gem_big": a_gem_big, "heart": a_heart, "ammo": a_ammo,
    "pedestal": a_pedestal, "stairs": a_stairs,
    "decal_blood1": a_decal1, "decal_blood2": a_decal2, "decal_blood3": a_decal3, "decal_blood4": a_decal4,
    "w_bonepopper": a_w_bonepopper, "w_repeater": a_w_repeater, "w_marrow": a_w_marrow,
    "w_cleaver": a_w_cleaver, "w_saw": a_w_saw, "w_bile": a_w_bile, "w_hemophage": a_w_hemophage,
    "w_eye": a_w_eye, "w_guthook": a_w_guthook, "w_cauterizer": a_w_cauterizer,
    "w_fleshmasher": a_w_fleshmasher, "w_trapqueen": a_w_trapqueen, "w_tenderizer": a_w_tenderizer,
    "w_redhand": a_w_redhand, "w_spinaltap": a_w_spinaltap, "w_swarmjar": a_w_swarmjar,
    "i_hollowpoints": a_i_hollowpoints, "i_twitch": a_i_twitch, "i_scalpel": a_i_scalpel,
    "i_leadmarrow": a_i_leadmarrow, "i_piercegaze": a_i_piercegaze, "i_ricochet": a_i_ricochet,
    "i_splittongue": a_i_splittongue, "i_hydramaw": a_i_hydramaw, "i_homingtumor": a_i_homingtumor,
    "i_orbitalknives": a_i_orbitalknives, "i_dentures": a_i_dentures, "i_volatilebile": a_i_volatilebile,
    "i_backstabber": a_i_backstabber, "i_splinterbone": a_i_splinterbone,
    "i_ironstomach": a_i_ironstomach, "i_luckycoin": a_i_luckycoin,
    "i_magnetmaw": a_i_magnetmaw, "i_bloodlust": a_i_bloodlust, "i_ghoulheart": a_i_ghoulheart,
}

WEAPON_IDS = [
    "bonepopper", "repeater", "marrow", "cleaver", "saw", "bile", "hemophage", "eye",
    "guthook", "cauterizer", "fleshmasher", "trapqueen", "tenderizer", "redhand", "spinaltap", "swarmjar",
]
for _weapon_id in WEAPON_IDS:
    ASSETS["wt_" + _weapon_id] = lambda wid=_weapon_id: a_weapon_top(wid)
    ASSETS["pt_" + _weapon_id] = lambda wid=_weapon_id: a_player_torso(wid)


# =====================================================================
# 64px / 128px eight-direction actor animation atlases
# =====================================================================

ANIM_ACTIONS = {
    "idle": (4, 5),
    "move": (8, 12),
    "attack": (6, 15),
    "hit": (3, 18),
    "death": (8, 12),
}

ACTORS = [
    "player",
    "enemy_shambler", "enemy_runner", "enemy_spitter", "enemy_splitter", "enemy_mini", "enemy_exploder",
    "enemy_censer", "enemy_bulwark", "enemy_choirmaster", "enemy_flenserling", "enemy_broodsac",
    "boss_bonesaw", "boss_gorecrown", "boss_knifecrawl",
    "boss_vealmother", "boss_flenser", "boss_hookchoir",
    "boss_platefather", "boss_augerprime", "boss_scald",
]


def _fit_actor(img, name, frame_size):
    box = img.getbbox()
    img = img.crop(box) if box else img
    if name.startswith("boss_"):
        target = 120
    elif name == "player":
        target = 88
    else:
        target = 58
    target = min(target, frame_size - 8)
    scale = min(target / img.width, target / img.height)
    return img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.Resampling.NEAREST)


def _tint(img, color, amount):
    tint = Image.new("RGBA", img.size, color)
    tint.putalpha(img.getchannel("A"))
    return Image.blend(img, tint, amount)


def _actor_frame(base, name, action, index, count, direction, frame_size):
    phase = index / count * math.tau
    work = base.copy()
    xscale = yscale = 1.0
    xoff = yoff = angle = 0

    if action == "idle":
        yscale = 1 + math.sin(phase) * 0.035
        xscale = 1 - math.sin(phase) * 0.018
        yoff = round(-abs(math.sin(phase)) * 1.5)
    elif action == "move":
        stride = math.sin(phase)
        xscale = 1 + abs(stride) * 0.06
        yscale = 1 - abs(stride) * 0.045
        yoff = round(-abs(stride) * 3)
        angle = stride * 4.5
        xoff = round(stride * 1.5)
    elif action == "attack":
        thrust = math.sin(min(index / max(count - 1, 1), 1) * math.pi)
        xscale = 1 + thrust * 0.10
        yscale = 1 - thrust * 0.04
        xoff = round(thrust * 5)
        angle = -thrust * 5
    elif action == "hit":
        xoff = (-2, 3, -1)[index % 3]
        angle = (-7, 5, -2)[index % 3]
        work = _tint(work, (255, 236, 218, 255), 0.58 - index * 0.16)
    elif action == "death":
        fall = index / max(count - 1, 1)
        angle = fall * 82
        xoff = round(fall * 8)
        yoff = round(fall * 13)
        yscale = max(0.28, 1 - fall * 0.68)
        work.putalpha(work.getchannel("A").point(lambda a: round(a * (1 - fall * 0.62))))

    w = max(1, round(work.width * xscale))
    h = max(1, round(work.height * yscale))
    work = work.resize((w, h), Image.Resampling.NEAREST)
    if angle:
        work = work.rotate(angle, Image.Resampling.NEAREST, expand=True)

    frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    frame.alpha_composite(work, ((frame_size - work.width) // 2 + xoff, (frame_size - work.height) // 2 + yoff))

    # Small frame-authored accents keep attacks and species readable in motion.
    d = ImageDraw.Draw(frame)
    cx = frame_size // 2
    cy = frame_size // 2
    if action == "attack" and index in (2, 3):
        accent = GORE if "spitter" not in name else GREEN
        d.line([(cx + frame_size // 5, cy - 3), (cx + frame_size // 2 - 3, cy)], fill=accent, width=max(1, frame_size // 32))
    if name == "enemy_exploder" and action != "death" and index % 2:
        d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=YELLOW)
    if name == "boss_gorecrown" and index % 2:
        d.point([(cx - 12, cy - 10), (cx + 12, cy - 10)], fill=WHITE)

    # The canonical actor faces right. Bake all eight compass directions into
    # the atlas so runtime rendering never rotates/softens character pixels.
    degrees = direction * 45
    if degrees:
        frame = frame.rotate(-degrees, Image.Resampling.NEAREST, expand=False)
    return frame


def render_actor_sheet(name, use_existing=False):
    frame_size = 128 if name.startswith("boss_") else (96 if name == "player" else 64)
    source_path = OUT / f"{name}.png"
    if use_existing and source_path.exists():
        source = Image.open(source_path).convert("RGBA")
    else:
        source = finish_sprite(ASSETS[name](), name)
    source = _fit_actor(source, name, frame_size)
    columns = 8
    cells = sum(count * 8 for count, _fps in ANIM_ACTIONS.values())
    rows = math.ceil(cells / columns)
    sheet = Image.new("RGBA", (columns * frame_size, rows * frame_size), (0, 0, 0, 0))
    cell = 0
    for action, (count, _fps) in ANIM_ACTIONS.items():
        for direction in range(8):
            for index in range(count):
                frame = _actor_frame(source, name, action, index, count, direction, frame_size)
                sheet.alpha_composite(frame, ((cell % columns) * frame_size, (cell // columns) * frame_size))
                cell += 1
    sheet.save(OUT / f"{name}_sheet.png", optimize=True)
    return sheet


def render_legs_sheet():
    """Render one forward-facing stride row; runtime rotates it smoothly."""
    frame_size = 96
    sheet = Image.new("RGBA", (frame_size * 8, frame_size), (0, 0, 0, 0))
    planted = None
    for index in range(8):
        frame = _player_legs_frame(index, frame_size)
        if index == 0:
            planted = frame.copy()
        sheet.alpha_composite(frame, (index * frame_size, 0))
    sheet.save(OUT / "player_legs_sheet.png", optimize=True)
    if planted is not None:
        planted.save(OUT / "player_legs.png", optimize=True)
    return sheet


def render_player_death_sheet():
    """Derive a gore burst from the shipped AI player still without redrawing it."""
    source_path = OUT / "player.png"
    if not source_path.exists():
        raise FileNotFoundError("assets/player.png is required for the derived death sheet")
    source = _fit_actor(Image.open(source_path).convert("RGBA"), "player", 128)
    frame_size, frame_count = 128, 12
    sheet = Image.new("RGBA", (frame_size * frame_count, frame_size), (0, 0, 0, 0))
    rng = random.Random(0x5A17CE)
    fragments = []
    cols = rows = 4
    for gy in range(rows):
        y0 = round(gy * source.height / rows)
        y1 = round((gy + 1) * source.height / rows)
        for gx in range(cols):
            x0 = round(gx * source.width / cols)
            x1 = round((gx + 1) * source.width / cols)
            piece = source.crop((x0, y0, x1, y1))
            if not piece.getbbox():
                continue
            relx = (x0 + x1) / 2 - source.width / 2
            rely = (y0 + y1) / 2 - source.height / 2
            a = math.atan2(rely, relx) + rng.uniform(-0.7, 0.7)
            fragments.append((piece, relx, rely, a, rng.uniform(30, 68), rng.uniform(-105, 105)))

    for index in range(frame_count):
        p = index / max(1, frame_count - 1)
        burst = p * p * (3 - 2 * p)
        frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
        d = ImageDraw.Draw(frame)
        if index in (1, 2, 3):
            flash = (1 - abs(index - 2) / 2) * 0.9
            rr = 8 + index * 9
            d.ellipse([64 - rr, 64 - rr, 64 + rr, 64 + rr], fill=(255, 223, 164, round(255 * flash)))
        for dot in range(20):
            da = (dot * 2.399963 + 0.37) % math.tau
            dr = burst * (18 + (dot * 17) % 47)
            rr = max(1, round((3 + dot % 4) * (1 - p * 0.55)))
            dx = round(64 + math.cos(da) * dr)
            dy = round(64 + math.sin(da) * dr)
            alpha = round(230 * max(0, 1 - p * 0.75))
            color = (174, 15 + (dot % 3) * 8, 38, alpha)
            d.ellipse([dx - rr, dy - rr, dx + rr, dy + rr], fill=color)

        origin_x = (frame_size - source.width) / 2
        origin_y = (frame_size - source.height) / 2
        for piece, relx, rely, ang, speed, spin in fragments:
            work = piece.copy()
            fade = 1 if p < 0.62 else max(0, 1 - (p - 0.62) / 0.38)
            if fade < 1:
                work.putalpha(work.getchannel("A").point(lambda alpha: round(alpha * fade)))
            rotation = spin * burst
            if rotation:
                work = work.rotate(rotation, Image.Resampling.NEAREST, expand=True)
            cx = origin_x + source.width / 2 + relx
            cy = origin_y + source.height / 2 + rely
            travel = speed * burst
            cx += math.cos(ang) * travel + relx * burst * 0.45
            cy += math.sin(ang) * travel + rely * burst * 0.45
            frame.alpha_composite(work, (round(cx - work.width / 2), round(cy - work.height / 2)))
        sheet.alpha_composite(frame, (index * frame_size, 0))
    sheet.save(OUT / "player_death_sheet.png", optimize=True)
    return sheet


def main():
    filters = [a for a in sys.argv[1:] if not a.startswith("--")]
    OUT.mkdir(exist_ok=True)
    names = [n for n in ASSETS if not filters or any(f in n for f in filters)]
    for name in names:
        img = ASSETS[name]()
        save(img, name)
        print(f"drew assets/{name}.png ({img.width}x{img.height})")
    actor_names = [n for n in ACTORS if not filters or any(f in n for f in filters)]
    for name in actor_names:
        sheet = render_actor_sheet(name)
        print(f"drew assets/{name}_sheet.png ({sheet.width}x{sheet.height})")
    if not filters or any("player_legs" in f or f == "player" for f in filters):
        sheet = render_legs_sheet()
        print(f"drew assets/player_legs_sheet.png ({sheet.width}x{sheet.height})")
    if any("player_death" in f for f in filters):
        sheet = render_player_death_sheet()
        print(f"drew assets/player_death_sheet.png ({sheet.width}x{sheet.height})")
    print(f"\n{len(names)} sprites and {len(actor_names)} animation sheets rendered.")


if __name__ == "__main__":
    main()
