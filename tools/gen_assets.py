#!/usr/bin/env python3
"""Generate MeatSlicer assets through OpenRouter's GPT Image 2 endpoint.

The attached ``example_image_style.jfif`` is sent with every request as a
rendering-style reference. GPT Image 2 currently emits opaque images, so
isolated sprites are requested on #FF00FF and border-flood keyed to alpha.

Usage:
  python tools/gen_assets.py player tile_floor1 w_redhand i_scalpel --force
  python tools/gen_assets.py --force                  # full production pass
  python tools/gen_assets.py tile                     # all matching names
  python tools/gen_assets.py --list
  python tools/gen_assets.py --reprocess              # re-key raw sources, no API

Authentication: ``OPENROUTER_API_KEY`` in the process environment or in the
user-only ``~/.config/MeatSlicer/.env`` file, which remains outside the served
game directory.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
ASSETS = ROOT / "assets"
RAW = ASSETS / "raw"
REFERENCE = RAW / "guides" / "style_reference.png"
MANIFEST = RAW / "openrouter_manifest.json"
USER_ENV = Path.home() / ".config" / "MeatSlicer" / ".env"

ENDPOINT = "https://openrouter.ai/api/v1/images"
MODEL = "openai/gpt-image-2"
PROVIDER = "openai"


STYLE = (
    "Use the attached image strictly as the rendering-style guide. Create authentic "
    "hand-crafted late-1990s 32-bit pixel art for a top-down industrial horror game: "
    "crisp square pixel clusters, no vector shapes, no smooth digital painting, no 3D "
    "render, no text. Use strong top-left directional lighting, dark crevices instead "
    "of uniform black outlines, chunky bevels, selective specular highlights, and large "
    "deliberate grime features rather than random noise. Palette: desaturated concrete, "
    "gunmetal, oxidized teal copper, rust brown and dirty bone; reserve saturated blood "
    "red, toxic green and spark gold for accents. Industrial abattoir mood. "
)
SPRITE_BG = (
    "Single isolated asset, centered, fully visible, no cropping, no cast shadow, no "
    "ground plane, on one perfectly flat solid #FF00FF magenta background covering every "
    "background pixel. No border, frame, label, letters, numbers, UI, or extra objects. "
)
TILE_RULES = (
    "One seamless square top-down game tile, full bleed edge-to-edge. No outer border, "
    "no text, no surrounding sheet, no perspective plane. Use only a few large readable "
    "features so it remains clear when repeated across a room. Opposite edges must tile. "
)


@dataclass(frozen=True)
class Spec:
    prompt: str
    size: int
    kind: str = "sprite"  # sprite | tile | decal


def _weapon_prompts() -> dict[str, str]:
    return {
        "bonepopper": "a crude oversized pistol assembled from carved femur, iron bands and bone teeth",
        "repeater": "a ridiculous rapid-fire gun built from a ribcage, brass feed mechanism and many barrels",
        "marrow": "a brutal double-barrel bone shotgun with exposed red marrow and a rusted stock",
        "cleaver": "an enormous heavy butcher cleaver with chipped steel, wood handle and old blood",
        "saw": "a grotesque sawblade launcher with a loaded serrated disc, oily motor and sparks",
        "bile": "a brass blunderbuss with a swollen toxic-green bile chamber and corroded nozzle",
        "hemophage": "a surgical syringe rifle with glass blood vials, needles and steel tubing",
        "eye": "a biomechanical ballista built around a huge bloodshot tracking eyeball",
        "guthook": "a massive rusted harpoon cannon ending in a barbed slaughterhouse meat hook",
        "cauterizer": "an absurd industrial flamethrower with gas tank and scorched medical cautery nozzle",
        "fleshmasher": "a heavy grenade cannon loaded with compacted meat, steel grinder drum and crank",
        "trapqueen": "a bear-trap launcher with huge interlocking bloody teeth and spring mechanisms",
        "tenderizer": "a comically enormous spiked meat-tenderizer war hammer with hydraulic fittings",
        "redhand": "a giant filthy chainsaw with a red motor housing, long toothed bar and blood spray",
        "spinaltap": "a massive energy railgun built around a glowing human spine and electrical coils",
        "swarmjar": "a grotesque jar launcher with a huge glass maggot tank, steel cap and feeding tubes",
    }


WEAPONS = _weapon_prompts()

SPECS: dict[str, Spec] = {
    # Actors: true top-down, facing right. Animation sheets are derived afterward.
    "player": Spec(
        "a highly stylised, ridiculously muscular hulking butcher hero seen from directly above, "
        "huge shoulders and arms, tiny bald head under a white butcher cap, dark leather harness, "
        "short blood-stained apron that does not hide the body silhouette, empty clenched hands ready "
        "to hold a separate weapon, facing right; iconic readable protagonist silhouette", 96),
    "player_leg": Spec(
        "one single hulking butcher leg matching the attached player hero, seen in strict orthographic "
        "plan view from directly above, extending horizontally from a cropped upper-thigh joint at the "
        "left to a heavy black industrial leather boot with a steel toe at the right. Thick brown "
        "blood-stained work trousers, grime, creases and worn straps, facing RIGHT. One leg only, no "
        "second leg, no torso, no loose body parts; a straight readable silhouette designed to be "
        "mirrored for the opposite leg and animated around a hip pivot", 64),
    "player_waist": Spec(
        "the attached hulking butcher hero's isolated lower-torso attachment piece in strict "
        "orthographic plan view directly from above, unmistakably facing RIGHT: a broad compact waist "
        "and hip mass wrapped in a thick dark leather butcher belt, stained short apron hem trailing "
        "toward the RIGHT, buckles and straps. The left-right body axis must match the attached player "
        "whose face and hands point right. In the exact center is a deep near-black circular recessed "
        "socket where the missing upper torso attaches. Waist and hips only: no upper torso, chest, "
        "head, arms, legs or boots. Compact and readable as the base the torso sits upon", 64),
    "enemy_shambler": Spec("stitched cadaver worker made of pale grey flesh, butcher hooks in its back, reaching arms, facing right, directly top-down", 64),
    "enemy_runner": Spec("lean feral abattoir ghoul sprinting on four long limbs, exposed spine and jaw, facing right, directly top-down", 64),
    "enemy_spitter": Spec("bloated infected slaughterhouse mutant with huge toxic bile maw, swollen sacs and drool, facing right, directly top-down", 64),
    "enemy_splitter": Spec("round tumour beast made of fused meat nodules and industrial staples, splitting seams, facing right, directly top-down", 64),
    "enemy_mini": Spec("small vicious blood-red meat grub, glistening raw gore-red flesh, wet crimson skin, tiny hooked bone legs and an oversized ring of teeth, dripping blood, facing right, directly top-down", 64),
    "enemy_exploder": Spec("swollen explosive cyst mutant with taut pale skin, glowing red-yellow cracks and embedded blasting cap, facing right, directly top-down", 64),
    "enemy_censer": Spec("floating plague censer creature, rusted brass incense cage fused to a wet lung and dangling butcher chains, leaking toxic green vapor, clear radial silhouette, facing right, directly top-down", 64),
    "enemy_bulwark": Spec("hulking slaughterhouse shield mutant, enormous riveted iron carapace covering its front and exposed red muscle at the rear, broad asymmetric silhouette, facing right, directly top-down", 64),
    "enemy_choirmaster": Spec("gaunt support horror with a circular throat organ, several horn-like bone tubes and glowing crimson vocal sacs, commanding pose, facing right, directly top-down", 64),
    "enemy_flenserling": Spec("lean flayed ambusher with hooked scalpel forelimbs, stretched sinew and a long low stalking silhouette, no skin, facing right, directly top-down", 64),
    "enemy_broodsac": Spec("rooted translucent meat womb swollen with small red larvae, stapled birth seams and short umbilical tendrils, heavy stationary silhouette, facing right, directly top-down", 64),
    "boss_bonesaw": Spec("colossal radial bone-saw machine monster, multiple concentric serrated rusted discs, bone hub, one hateful red lens, directly top-down", 128),
    "boss_gorecrown": Spec("colossal pulsing heart monarch fused to an iron crown of bone spikes and chains, radial silhouette, directly top-down", 128),
    "boss_knifecrawl": Spec("colossal spider horror made from fused butcher knives, scalpels and pale flesh, radial blade legs, directly top-down", 128),
    "boss_vealmother": Spec("colossal bloated brood sac of translucent veal flesh, ring of pulsing birth orifices, tangled umbilical roots, radial silhouette, directly top-down", 128),
    "boss_flenser": Spec("colossal flayed acrobat horror, radial crown of cleaver flails on flensed sinew, no skin, directly top-down", 128),
    "boss_hookchoir": Spec("colossal ceiling-rail carousel hub of rusted meat hooks on taut chains, radial spokes, directly top-down", 128),
    "boss_platefather": Spec("colossal armored slaughter engine plated in four riveted iron shields over raw muscle, radial silhouette, directly top-down", 128),
    "boss_augerprime": Spec("colossal industrial auger drill monster, radial spiral boring arms, oxidized copper gearbox hub, directly top-down", 128),
    "boss_scald": Spec("colossal rendering vat boiler creature, ring of brass scald vents venting steam, tallow crust, radial silhouette, directly top-down", 128),

    # Environment — large low-frequency features, not wallpaper noise.
    "tile_floor1": Spec("heavy square cracked concrete abattoir slab, broad bevel, one dark fracture and faint old blood stain", 64, "tile"),
    "tile_floor2": Spec("large riveted gunmetal floor plate, six chunky rivets, scratched steel and restrained rust", 64, "tile"),
    "tile_floor3": Spec("large oxidized copper floor plate with broad teal patina streak and worn rust edge", 64, "tile"),
    "tile_floor4": Spec("broken concrete floor slab with one large impact crater and radiating cracks", 64, "tile"),
    "tile_floor5": Spec("industrial steel drainage grate set into dirty concrete, deep black slots and rust", 64, "tile"),
    "tile_floor6": Spec("plain worn abattoir ceramic floor slab, cold grey-green glaze, chipped corners and sparse blood", 64, "tile"),
    "tile_floor7": Spec("steel floor hatch with recessed panel, bolts and a faded yellow-black hazard stripe", 64, "tile"),
    "tile_floor8": Spec("concrete slab invaded by one cluster of dark fleshy veins and bone growth", 64, "tile"),
    "tile_wall": Spec("thick industrial abattoir wall panel, dark gunmetal, rusted beams, pipes and top bevel", 64, "tile"),
    "tile_wall2": Spec("reinforced concrete wall panel with steel edge columns, cracks and old blood run", 64, "tile"),
    "tile_wall3": Spec("oxidized copper wall panel with teal patina, rivets and a recessed conduit", 64, "tile"),
    "tile_wall4": Spec("slaughterhouse wall panel with steel braces, hanging hook and dirty bone deposits", 64, "tile"),
    "door_open": Spec("very wide open industrial slaughterhouse doorway viewed top-down, a huge clear empty pitch-black rectangular passage in the center that you can walk straight through, thick riveted rusted steel frame and pillars only on the outer left and right edges, glowing crimson accent lamps on the frame, hanging chains and hooks at the sides, worn blood-stained metal threshold, the center opening is completely empty and unobstructed, no teeth, no jaws, evil but clearly an open entrance", 128),
    "door_locked": Spec("massive menacing sealed industrial slaughterhouse doorway viewed top-down, interlocking rusted steel jaws clamped over jagged bone teeth, glowing red warning lamps, heavy chains and padlocks, dried blood and gore along the threshold, evil and foreboding", 128),

    # Projectiles and pickups.
    "bullet_bone": Spec("sharp dirty bone shard projectile pointing right", 16),
    "bullet_saw": Spec("small spinning industrial circular saw projectile with bright steel teeth", 24),
    "bullet_cleaver": Spec("small chipped bloodied meat cleaver projectile pointing right", 24),
    "bullet_harpoon": Spec("long barbed rusted slaughterhouse harpoon pointing right", 32),
    "bullet_eye": Spec("small bloodshot tracking eyeball with torn optic nerve", 24),
    "bullet_syringe": Spec("small glass syringe projectile filled with toxic green fluid pointing right", 24),
    "bullet_gore": Spec("small wet glob of dark crimson gore", 24),
    "bullet_steam": Spec("small pale white curling steam cloud projectile, translucent hot vapor with a golden edge, no container, no metal", 24),
    "gem_small": Spec("small bright cyan-blue data crystal shard with hard specular edge", 24),
    "gem_big": Spec("large bright toxic-teal data crystal cluster with hard specular edges", 32),
    "heart": Spec("glossy anatomical heart pickup with cut arteries and metal staples", 32),
    "ammo": Spec("small open rusted ammunition box holding bone-white rounds", 32),
    "pedestal": Spec("short industrial steel reward pedestal with hydraulic column, top-down, blood and warning stripe", 64),
    "stairs": Spec("square industrial stairwell descending into blackness, concrete lip, steel steps, top-down", 64),
    "decal_blood1": Spec("irregular dark blood pool and droplets viewed directly above", 64, "decal"),
    "decal_blood2": Spec("long dragged blood smear with finger trails viewed directly above", 64, "decal"),
    "decal_blood3": Spec("wide glossy blood splatter with radial spray viewed directly above", 64, "decal"),
    "decal_blood4": Spec("sparse arc of blood droplets and one bone chip viewed directly above", 64, "decal"),

    # Level-up draft icons.
    "perk_adrenal": Spec("swollen crimson adrenal gland fused to a steel injector, tense veins and one electric spark", 64),
    "perk_sharpen": Spec("chipped butcher cleaver blade dragged across a blood-stained industrial whetstone with one gold spark", 64),
    "perk_quick": Spec("severed muscular butcher foot and ankle with leather straps and stretched sprinting tendons", 64),
    "perk_longbone": Spec("unnaturally elongated sharpened femur reinforced with two rusted steel extension collars", 64),
    "perk_bigheart": Spec("absurdly oversized glossy anatomical heart reinforced with steel staples and thick arteries", 64),
    "perk_magnetb": Spec("corroded horseshoe electromagnet pulling three toxic-green bile droplets toward its poles", 64),
    "perk_shieldheart": Spec("cyan anatomical heart protected behind a compact riveted butcher-steel shield", 64),
    "perk_scavenge": Spec("snarling pale rat skull with a scrap-metal pack clutching one cartridge and one blue crystal", 64),
    "perk_bloodrush": Spec("pressurized crimson artery loop bursting through a cracked steel valve with a blue crystal in the flow", 64),
    "perk_deadeye": Spec("huge bloodshot tracking eyeball pierced in perfect alignment by a fast bone projectile", 64),
    "perk_critbone": Spec("a split skull target struck exactly through its glowing weak point by a bone round", 64),
    "perk_critmeat": Spec("a frozen anatomical brain held in a precise surgical caliper", 64),
    "perk_flensing": Spec("a curved flensing knife peeling one clean strip from bloody hide", 64),
    "perk_ember": Spec("a charred butcher hand clutching a bright industrial ember", 64),
    "perk_frostbile": Spec("a toxic bile sac crusted with cyan frost and steel staples", 64),
    "perk_heavyhand": Spec("an enormous clenched butcher fist reinforced with iron knuckles", 64),
    "perk_thickhide": Spec("a layered square of scarred hide reinforced with rivets", 64),
    "perk_secondwind": Spec("a pair of punctured lungs inflating around a steel air valve", 64),
    "perk_scrapfeed": Spec("a compact ammunition feeder chewing rusted scrap into cartridges", 64),
    "perk_boneknit": Spec("two broken bones knitting together with red sinew and staples", 64),
    "perk_spiteflesh": Spec("a bleeding slab of flesh bristling with outward-pointing bone spikes", 64),
    "perk_carrion": Spec("a hooked vulture skull sniffing a trail of blue crystals", 64),
    "perk_sinew": Spec("a woven braid of taut red tendon reinforced by tiny steel rings", 64),
}

for wid, subject in WEAPONS.items():
    SPECS["w_" + wid] = Spec(subject + ", clean readable side-profile inventory view, pointing right", 32)
    SPECS["wt_" + wid] = Spec(
        subject + ", strict orthographic plan view from a camera at the zenith exactly 90 degrees "
        "above the weapon, lying flat and pointing right; show the top surfaces and bilateral width, "
        "not a side elevation, not a profile, no visible vertical side face; exaggerated broad readable "
        "top-down silhouette for a twin-stick shooter", 64)
    SPECS["pt_" + wid] = Spec(
        "the same hulking butcher hero's upper body seen directly from above: enormous shoulders, "
        "both muscular arms in an alert combat-ready firing stance, tiny head in a white butcher cap, "
        "blood-stained apron straps, gripping " + subject + " with both hands, weapon pointing right. "
        "Preserve the attached weapon reference's exact weapon silhouette, materials and colors. Turn "
        "the butcher's face unmistakably to the RIGHT along the weapon: visible brow, nose, eye line "
        "and chin all aim toward its barrel or blade. Brace or shoulder the weapon where appropriate, "
        "with bent elbows, trigger hand on the rear grip and support hand under the foregrip. This is a "
        "ready-to-fire pose, not a neutral display pose. Upper body only: no legs, no hips, no feet. "
        "Center the shoulders while the weapon extends right", 128)

ITEMS = {
    "hollowpoints": "a carved bone hollow-point round with metal jacket",
    "twitch": "a bundle of twitching exposed muscle fibres wired to electrodes",
    "scalpel": "a chipped surgical scalpel with wrapped handle and dried blood",
    "leadmarrow": "a sawn bone cross-section packed with dark metallic marrow",
    "piercegaze": "a bloodshot eye pierced by a long surgical needle",
    "ricochet": "a bent rib deflecting a bright bullet with one spark",
    "splittongue": "a severed forked tongue with staples and blood",
    "hydramaw": "a round fleshy maw with three concentric rows of teeth",
    "homingtumor": "an irregular purple tumour with one tracking eye and wires",
    "orbitalknives": "three small butcher knives orbiting a bloody steel hub",
    "dentures": "rusted surgical dentures with long bloody fangs",
    "volatilebile": "a swollen toxic-green bile sac in a steel restraint cage",
    "backstabber": "a long knife embedded in a shadowed butcher back silhouette",
    "splinterbone": "a cracked bone exploding into three sharp splinters",
    "ironstomach": "an anatomical stomach replaced with riveted iron plating and pipes",
    "luckycoin": "a tarnished brass coin stamped with a skull and blood smear",
    "magnetmaw": "a corroded horseshoe magnet whose ends are toothed jaws",
    "bloodlust": "a crimson blood drop containing a small screaming face",
    "ghoulheart": "a grey undead heart repaired with stitches, staples and wire",
    "chainsinew": "a loop of red sinew carrying a bright electric arc between steel hooks",
    "mortarbone": "a hollow femur packed as a tiny explosive mortar shell",
    "bloatrounds": "three grotesquely swollen bone bullets pressing against steel bands",
    "marrowglut": "an overfilled bowl of dark metallic marrow with a cartridge submerged in it",
    "hollowneedle": "an impossibly fine hollow surgical needle with a jeweled crimson tip",
    "bloodshoteye": "a huge bloodshot eyeball with a brass crosshair bolted around its iris",
    "flayerkiss": "two crossed skinning blades wrapped in a strip of fresh hide",
    "emberjar": "a cracked specimen jar holding a living orange coal and black smoke",
    "acidgland": "a luminous green acid gland restrained by a corroded steel cage",
    "hookrounds": "a cluster of small barbed hook-shaped cartridges joined by wire",
    "sledgerounds": "one massive blunt iron cartridge with a dented hammer face",
    "graftedtrigger": "a gun trigger grafted into a twitching severed finger",
    "deadmanswitch": "a red industrial dead-man switch gripped by a skeletal hand",
    "orbitcrown": "a rusted crown whose points are tiny orbiting butcher knives",
    "tannedhide": "a folded sheet of thick scarred leather hide with riveted corners",
    "deadmansclock": "a cracked brass stopwatch containing a tiny skull",
    "hollowbones": "a lightweight birdlike hollow bone cut open to reveal air chambers",
    "boneplate": "a broad overlapping plate made from polished rib bones and iron rivets",
    "wormgut": "a pale medicinal worm coiled inside a stitched length of intestine",
    "spinecage": "a compact rib cage turned outward into defensive bloody spikes",
    "secondstomach": "two anatomical stomachs joined by surgical tubes and clamps",
    "spitewell": "a deep iron cup overflowing upward with angry crimson blood",
    "twinhearts": "two small anatomical hearts stitched together side by side",
    "brassmagazine": "an oversized brass ammunition magazine packed with bone rounds",
    "crowbait": "a black feather bundle tied around a shining skull coin",
    "gorgingleech": "a fat crimson leech engorged around a glowing blue crystal",
    "rerollrib": "a curved rib carved with dice pips and a circular arrow",
    "chillgland": "a pale frost-rimed gland with blue ice crystals and a steel staple",
    "hookedsinew": "a taut red sinew cord pulled around a rusted butcher hook",
    "gyroscopicribs": "a rib cage spun into a gyroscope ring around a spinning bone core",
    "marrowpiston": "a hydraulic steel piston packed with dark marrow and bone seals",
    "splitcortex": "a bisected brain with a clean mirrored split and two wired halves",
    "gristlecord": "a thick braided gristle cord with steel clasps and dried blood",
    "renderedfat": "a folded slab of rendered tallow fat with a crackled browned edge",
    "whipcordtendon": "a long whip-like tendon cord coiled with a barbed tip",
    "rusteddiadem": "a corroded iron diadem crown with orbital notches and rust flaking",
    "gorgedtick": "a swollen blood-engorged tick clutching a tiny blue crystal",
    "bonemealpowder": "a small burlap pouch spilling white bone-meal powder and bone chips",
    "rimedfang": "a long predatory fang crusted with white frost and a steel collar",
    "butcherstwine": "a spool of blood-stained butcher twine with a frayed loose end",
    "cindersump": "a smouldering iron sump grate with orange cinders and green acid drips",
    "deadweight": "a heavy iron butcher weight crushing a pale bone",
    "cauterizedveins": "a forearm cross-section with glowing cauterized orange veins",
    "hollowchoir": "a hollow bone pipe organ with three small singing mouths",
    "sawbonecoil": "a coiled spring made of interlocking bone saw teeth",
    "gluttonsgut": "a distended stomach with a second mouth and spilled half-digested hearts",
    "slaughterrhythm": "a metronome with a pendulum made of a bloody cleaver",
    "painengine": "a small iron engine with a pressure gauge and a screaming flesh piston",
    "thresherplate": "a spiked iron threshing plate bristling with rotating barbs",
    "bloodmoat": "a ring-shaped moat of dark blood with a bone drawbridge",
    "ironlung": "a riveted iron lung with bellows and a steel windpipe",
    "meathook": "a huge rusted slaughterhouse meat hook on a taut chain",
    "blooddebt": "a parchment contract signed in blood with a heart seal",
    "butchersoath": "a blood-soaked butcher cleaver crossed with a black oath scroll",
    "secondskin": "a pale translucent second skin peeling away to reveal muscle",
    "twinsidearm": "two crossed bone pistols fused at the grip with sinew",
    "crimsonmetronome": "a crimson metronome with a heart-shaped pendulum and blood drips",
    "abattoirengine": "a roaring industrial abattoir engine with pressure gauges and meat grinders",
    "gorecrown": "a jagged crown of congealed blood and bone spikes radiating a red aura",
    "thousandteeth": "a gaping maw with hundreds of tiny sharp teeth in concentric rings",
    "hollowfather": "a gaunt hollow patriarch figure with three orbiting bone halos",
    "thelastcut": "a single gleaming cleaver edge with a desperate red gleam",
    "meatgrinder": "an industrial meat grinder with spinning blades and gore pouring through",
}
for iid, subject in ITEMS.items():
    SPECS["i_" + iid] = Spec(subject + ", isolated inventory object, strong top-left light, no medallion, no icon background", 32)

ACTIVES = {
    "bonenova": "a radial burst of sharp bone shards erupting from a central skull",
    "offalbomb": "a fused bomb made of packed offal with a lit intestine fuse",
    "bloodtransfusion": "a blood bag on a steel hook with a transfusion tube and needle",
    "cleaverstorm": "a whirlwind spiral of twelve small orbiting meat cleavers",
    "butchersbell": "a huge rusted slaughterhouse dinner bell with a bone clapper",
    "marrowdraught": "a frothing tankard of dark marrow with a bone straw",
    "slaughtertime": "a cracked hourglass with blood instead of sand, frozen mid-drop",
    "panicroom": "a small riveted iron bunker door with a spinning lock wheel",
    "skinnerscoin": "a gleaming gold coin stamped with a skinning knife",
    "gutreroll": "a loop of intestine twisted into a circular arrow with dice pips",
}
for aid, subject in ACTIVES.items():
    SPECS["a_" + aid] = Spec(subject + ", isolated inventory object, strong top-left light, no medallion, no icon background", 32)


# Reference-derived industrial ramps. All generated images are mapped onto this
# palette so independent API calls remain visually coherent.
PALETTE = [
    (5, 7, 8), (10, 13, 14), (16, 20, 20), (23, 28, 28), (31, 37, 36),
    (42, 47, 44), (55, 59, 54), (72, 73, 65), (92, 88, 76), (119, 109, 91),
    (151, 137, 112), (187, 172, 142), (222, 209, 176),
    (18, 28, 28), (25, 43, 41), (36, 60, 55), (48, 82, 73), (65, 104, 89),
    (82, 124, 105), (105, 145, 121),
    (35, 20, 17), (55, 29, 22), (77, 39, 27), (105, 52, 32), (136, 70, 39),
    (164, 91, 53), (190, 120, 72),
    (53, 10, 15), (82, 11, 19), (117, 15, 24), (155, 20, 31), (199, 31, 42),
    (231, 55, 58), (250, 99, 76),
    (47, 31, 31), (72, 46, 43), (103, 66, 57), (138, 92, 75), (181, 130, 104),
    (219, 176, 140), (239, 213, 180),
    (44, 67, 28), (66, 99, 37), (91, 137, 47), (126, 181, 58), (168, 220, 76),
    (178, 126, 34), (222, 173, 44), (251, 221, 101),
    (29, 70, 86), (40, 107, 126), (56, 151, 166), (92, 202, 202),
]


def load_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    if key:
        return key
    if USER_ENV.exists():
        for line in USER_ENV.read_text(encoding="utf-8").splitlines():
            if line.startswith("OPENROUTER_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit(f"No OPENROUTER_API_KEY found in the environment or {USER_ENV}")


def data_url(path: Path) -> str:
    mime = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg", ".jfif"} else "image/png"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def shape_guide(name: str) -> Path | None:
    if name in {"player_leg", "player_waist"}:
        player = ASSETS / "player.png"
        return player if player.exists() else None
    if not name.startswith(("wt_", "pt_")):
        return None
    # Existing production torsos are the strongest possible edit reference:
    # preserve their weapon while refining head direction and firing posture.
    current = ASSETS / f"{name}.png"
    if name.startswith("pt_") and current.exists():
        return current
    guide_dir = RAW / "guides"
    guide_dir.mkdir(parents=True, exist_ok=True)
    path = guide_dir / f"{name}.png"
    if not path.exists():
        from draw_sprites import a_player_torso, a_weapon_top
        source = a_player_torso(name[3:]) if name.startswith("pt_") else a_weapon_top(name[3:])
        image = source.resize((512, 512), Image.Resampling.NEAREST)
        image.save(path, optimize=True)
    return path


def reference_payload(name: str) -> list[dict]:
    if not REFERENCE.exists():
        raise SystemExit(f"Missing style reference: {REFERENCE}")
    references = [{"type": "image_url", "image_url": {"url": data_url(REFERENCE)}}]
    if name.startswith(("w_", "wt_", "pt_")):
        mid = name[3:] if name.startswith(("wt_", "pt_")) else name[2:]
        prefix = "wt_" if name.startswith(("wt_", "pt_")) else "w_"
        model = RAW / "guides" / "models" / f"{prefix}{mid}.png"
        if model.exists():
            references.append({"type": "image_url", "image_url": {"url": data_url(model)}})
    guide = shape_guide(name)
    if guide:
        references.append({"type": "image_url", "image_url": {"url": data_url(guide)}})
    return references


def request_image(name: str, prompt: str, key: str, quality: str, attempts: int = 5) -> tuple[bytes, dict]:
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "quality": quality,
        "aspect_ratio": "1:1",
        "output_format": "png",
        "background": "opaque",
        "n": 1,
        "input_references": reference_payload(name),
        "provider": {"only": [PROVIDER], "allow_fallbacks": False},
    }
    encoded = json.dumps(payload).encode("utf-8")
    for attempt in range(attempts):
        request = urllib.request.Request(
            ENDPOINT,
            data=encoded,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8123",
                "X-Title": "MeatSlicer asset pipeline",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                result = json.loads(response.read())
            image_data = result.get("data") or []
            if image_data and image_data[0].get("b64_json"):
                return base64.b64decode(image_data[0]["b64_json"]), result.get("usage") or {}
            if attempt == attempts - 1:
                raise RuntimeError("OpenRouter returned no image data")
            wait = min(45, 4 * (2**attempt))
            print(f"    Empty image response; retrying in {wait}s")
            time.sleep(wait)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            if exc.code not in {408, 429, 500, 502, 503, 504, 520} or attempt == attempts - 1:
                raise RuntimeError(f"OpenRouter HTTP {exc.code}: {detail}") from exc
            wait = min(45, 4 * (2**attempt))
            print(f"    HTTP {exc.code}; retrying in {wait}s")
            time.sleep(wait)
        except (OSError, TimeoutError) as exc:
            if attempt == attempts - 1:
                raise
            wait = min(45, 4 * (2**attempt))
            print(f"    {type(exc).__name__}; retrying in {wait}s")
            time.sleep(wait)
    raise RuntimeError("generation exhausted retries")


def is_magenta(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, _a = pixel
    return r > 145 and b > 145 and g < 175 and r + b > g * 2.15


def flood_key_magenta(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    # Stage 1: border flood — key every magenta region connected to the frame.
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.append((x, 0)); queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y)); queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if x < 0 or y < 0 or x >= width or y >= height or seen[index]:
            continue
        seen[index] = 1
        if not is_magenta(pixels[x, y]):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        if x: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))

    buf = np.array(image)
    # Stage 2: interior pockets — enclosed key pools the border flood cannot
    # reach. Strict predicate so intentional art pinks survive.
    pockets = (
        (buf[..., 3] > 0)
        & (buf[..., 0] > 200)
        & (buf[..., 1] < 80)
        & (buf[..., 2] > 200)
    )
    buf[pockets] = 0

    def near_transparent() -> np.ndarray:
        transparent = buf[..., 3] == 0
        near = np.zeros_like(transparent)
        near[:-1, :] |= transparent[1:, :]
        near[1:, :] |= transparent[:-1, :]
        near[:, :-1] |= transparent[:, 1:]
        near[:, 1:] |= transparent[:, :-1]
        return near

    # Stage 3: fringe erosion — eat the anti-aliased key halo hugging
    # silhouettes and pocket rims (arithmetic mirrors is_magenta).
    for _pass in range(4):
        r, g, b = buf[..., 0], buf[..., 1], buf[..., 2]
        key = (
            (buf[..., 3] > 0)
            & (r > 145)
            & (b > 145)
            & (g < 175)
            & (r.astype(np.int32) + b.astype(np.int32) > 2.15 * g)
        )
        doomed = key & near_transparent()
        if not doomed.any():
            break
        buf[doomed] = 0
    # Stage 4: despill — soften the remaining pink rim without punching holes.
    fringe = (buf[..., 3] > 0) & near_transparent()
    if fringe.any():
        excess = np.minimum(buf[..., 0], buf[..., 2]).astype(np.int32) - buf[..., 1].astype(np.int32)
        strong = fringe & (excess > 50)
        if strong.any():
            cut = np.round(excess * 0.6).astype(np.int32)
            buf[..., 0] = np.where(strong, np.clip(buf[..., 0].astype(np.int32) - cut, 0, 255), buf[..., 0]).astype(np.uint8)
            buf[..., 2] = np.where(strong, np.clip(buf[..., 2].astype(np.int32) - cut, 0, 255), buf[..., 2]).astype(np.uint8)
    return Image.fromarray(buf, "RGBA")


def palette_image() -> Image.Image:
    palette = []
    for color in PALETTE:
        palette.extend(color)
    palette.extend([0] * (768 - len(palette)))
    image = Image.new("P", (1, 1))
    image.putpalette(palette)
    return image


def quantize_shared(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A") if image.mode == "RGBA" else None
    rgb = image.convert("RGB").quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    if alpha is None:
        return rgb
    output = rgb.convert("RGBA")
    output.putalpha(alpha.point(lambda value: 255 if value >= 80 else 0))
    return output


def process_sprite(raw: bytes, size: int) -> Image.Image:
    image = flood_key_magenta(Image.open(BytesIO(raw)))
    box = image.getbbox()
    if not box:
        raise RuntimeError("magenta key removed the entire image")
    image = image.crop(box)
    margin = max(1, size // 16)
    inner = size - margin * 2
    scale = min(inner / image.width, inner / image.height)
    dimensions = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    image = image.resize(dimensions, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((size - dimensions[0]) // 2, (size - dimensions[1]) // 2))
    return quantize_shared(canvas)


def process_tile(raw: bytes, size: int) -> Image.Image:
    image = Image.open(BytesIO(raw)).convert("RGB")
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    return quantize_shared(image)


def build_prompt(name: str, spec: Spec) -> str:
    if spec.kind == "tile":
        return STYLE + TILE_RULES + spec.prompt
    if spec.kind == "decal":
        return STYLE + SPRITE_BG + spec.prompt + ". Thin irregular edges; no floor tile beneath it."
    return STYLE + SPRITE_BG + spec.prompt + "."


def read_manifest() -> dict:
    if MANIFEST.exists():
        try:
            return json.loads(MANIFEST.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
    return {"model": MODEL, "reference": REFERENCE.name, "assets": {}}


def write_manifest(manifest: dict) -> None:
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")


def render_sheets(actor_names: list[str]) -> None:
    from draw_sprites import render_actor_sheet, render_legs_sheet
    for name in actor_names:
        if name in SPECS and (ASSETS / f"{name}.png").exists():
            sheet = render_actor_sheet(name, use_existing=True)
            print(f"    sheet {name}: {sheet.width}x{sheet.height}")
    if "player" in actor_names:
        sheet = render_legs_sheet()
        print(f"    sheet player_legs: {sheet.width}x{sheet.height}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("filters", nargs="*", help="asset-name substrings")
    parser.add_argument("--force", action="store_true", help="overwrite generated assets")
    parser.add_argument("--quality", choices=("low", "medium", "high"), default="medium")
    parser.add_argument("--list", action="store_true", help="list asset names and exit")
    parser.add_argument("--no-sheets", action="store_true", help="do not rebuild actor sheets")
    parser.add_argument("--reprocess", action="store_true", help="re-key existing assets/raw sources without API calls")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    names = [name for name in SPECS if not args.filters or any(value in name for value in args.filters)]
    if args.list:
        print("\n".join(names))
        return
    if not names:
        raise SystemExit("No asset names matched")

    if args.reprocess:
        reprocessed = 0
        for index, name in enumerate(names, 1):
            spec = SPECS[name]
            if spec.kind == "tile":
                print(f"[{index}/{len(names)}] {name}: tile, skipped")
                continue
            raw_path = RAW / f"{name}.png"
            if not raw_path.exists():
                print(f"[{index}/{len(names)}] {name}: no raw source, skipped")
                continue
            image = process_sprite(raw_path.read_bytes(), spec.size)
            image.save(ASSETS / f"{name}.png", optimize=True)
            reprocessed += 1
            print(f"[{index}/{len(names)}] {name}: re-keyed -> assets/{name}.png")
        if not args.no_sheets:
            actor_names = [name for name in names if name == "player" or name.startswith(("enemy_", "boss_"))]
            render_sheets(actor_names)
            from draw_sprites import render_legs_sheet, render_player_death_sheet
            sheet = render_legs_sheet()
            print(f"    sheet player_legs: {sheet.width}x{sheet.height}")
            sheet = render_player_death_sheet()
            print(f"    sheet player_death: {sheet.width}x{sheet.height}")
        print(f"\nRe-keyed {reprocessed} assets (no API calls, manifest untouched)")
        return

    key = load_key()
    ASSETS.mkdir(exist_ok=True)
    RAW.mkdir(exist_ok=True)
    manifest = read_manifest()
    total_cost = 0.0
    generated = []
    failed = []

    for index, name in enumerate(names, 1):
        spec = SPECS[name]
        output = ASSETS / f"{name}.png"
        if output.exists() and name in manifest.get("assets", {}) and not args.force:
            print(f"[{index}/{len(names)}] {name}: already generated")
            continue
        prompt = build_prompt(name, spec)
        print(f"[{index}/{len(names)}] {name} ({spec.size}px {spec.kind})")
        try:
            raw, usage = request_image(name, prompt, key, args.quality)
            raw_path = RAW / f"{name}.png"
            raw_path.write_bytes(raw)
            image = process_tile(raw, spec.size) if spec.kind == "tile" else process_sprite(raw, spec.size)
            image.save(output, optimize=True)
            cost = float(usage.get("cost") or 0)
            total_cost += cost
            manifest["assets"][name] = {
                "prompt": prompt,
                "quality": args.quality,
                "size": spec.size,
                "kind": spec.kind,
                "cost": cost,
                "generated_at": int(time.time()),
            }
            write_manifest(manifest)
            generated.append(name)
            print(f"    -> assets/{name}.png ({image.width}x{image.height}) cost=${cost:.4f}")
        except Exception as exc:  # keep a long batch moving and report all failures
            failed.append(name)
            print(f"    FAILED: {exc}")

    if not args.no_sheets:
        actor_names = [name for name in names if name == "player" or name.startswith(("enemy_", "boss_"))]
        render_sheets(actor_names)
        if ("player_leg" in names or "player_waist" in names) and "player" not in actor_names:
            from draw_sprites import render_legs_sheet
            sheet = render_legs_sheet()
            print(f"    sheet player_legs: {sheet.width}x{sheet.height}")

    print(f"\nGenerated {len(generated)}, failed {len(failed)}, reported cost ${total_cost:.4f}")
    if failed:
        print("Failed:", ", ".join(failed))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
