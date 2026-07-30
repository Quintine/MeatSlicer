# Gameplay Guide

Everything about how a run of **MeatSlicer: A Butcher's Descent** works: the loop, controls, player mechanics, drops, scoring, and difficulty scaling.

See also: [Weapons](weapons.md) · [Items](items.md) · [Perks](perks.md) · [Enemies](enemies.md) · [Bosses](bosses.md)

---

## Core Game Loop

MeatSlicer is an **endless arena roguelite**. There is no final floor and no victory screen — the goal is to descend as deep as you can and maximize your score before you die. Death is permanent (permadeath); only your high score persists.

A run looks like this:

1. **Enter a floor.** Each floor is a small map of rooms (see *Floor Generation*).
2. **Clear combat rooms.** Doors lock until every wave of enemies in the room is dead.
3. **Find the item room.** A free passive item (plus a 35% chance of a weapon).
4. **Kill the floor boss.** The boss room is always the farthest room from the start.
5. **Take the loot, take the stairs.** Bosses drop an item pedestal, a weapon, guaranteed ammo, and the stairs down. Walk onto the stairs to descend.
6. Repeat, deeper and harder, until you are butchered.

### Score

Score is display-only (it buys nothing) and determines your saved best:

| Source | Score |
|---|---|
| Normal enemy kill | +10 |
| Elite enemy kill | +40 |
| Boss kill | +500 (plus drop bonus below) |
| Boss defeated bonus | 500 + floor × 100 |
| Combat room cleared | +50 |
| Descending to next floor | +250 |
| XP gained | +1 per XP (rounded) |
| Heart picked up at full HP | +25 |
| Ammo picked up with nothing to refill | +15 (+2 per wasted unit otherwise) |
| Duplicate item at tier cap (IX) | +150 |

Your best score is saved in `localStorage` as `meatslicer_best` and shown on the title screen and game-over screen ("NEW BEST CUT" when beaten).

---

## Controls

### In-game

| Input | Action |
|---|---|
| **W / A / S / D** or **Arrow keys** | Move |
| **Mouse** | Aim |
| **Left mouse button (hold)** | Fire |
| **Left mouse release** | Fire charged beam (Spinal Tap only) |
| **R** | Swap between Bone Popper and holstered special weapon |
| **P / Escape** | Pause / resume |
| **T** | Toggle Auto-Draft (auto-pick random perk on level-up) |
| **M** | Mute / unmute |
| **N** | Next music track |

### Perk draft screen (level-up)

| Input | Action |
|---|---|
| **1 / 2 / 3** | Choose perk 1, 2, or 3 |
| **Click a card** | Choose that perk |
| **4 / Space** | Random Cut — pick a random perk of the three |
| **R** | Reroll the three choices (costs 1 reroll token) |
| **T** | Enable Auto-Draft |

### Pause screen (jukebox)

| Input | Action |
|---|---|
| **- / =** | SFX volume down / up |
| **, / .** | Music volume down / up |
| **; / '** | HUD opacity down / up (25%–100%) |
| **[ / ]** or **Left / Right arrows** | Previous / next music track |
| **Click arrows** | Cycle music tracks |
| **Drag sliders** | SFX / Music / HUD opacity bars are click-and-drag |
| **H / [?] button** | Open the 12-page Field Manual |

### Menus

| Input | Action |
|---|---|
| **Enter / Space / Click** | Start run (title), restart after death |

The desktop app title screen has **[X] Exit to Desktop**. Pause has **[Q] Main Menu** and **[X] Exit**.
The first matching press arms a 3-second confirmation; press it again to confirm. `P` or
`Escape` resumes. In a web browser, desktop-exit controls are greyed out and non-interactive.

Right-click is disabled (context menu suppressed). There is **no dash, no interact key** — pickups are collected by walking over them.

---

## The Player

### Base stats

| Stat | Value |
|---|---|
| Max HP | 6 (shown as 3 hearts, 2 HP per heart) |
| Hitbox radius | 20 px |
| Move speed | 178 px/s |
| Crit chance | 5% |
| Crit damage | ×2.0 |
| Post-hit invulnerability | 0.9 s |
| Room-entry protection | 1.0 s of invulnerability on entering any room |
| Starting weapon | Bone Popper (infinite ammo sidearm) |
| Starting level | 1 (0 XP) |

### Damage, armor, and shields

- Every hit taken deals a **minimum of 1 damage** (`max(1, round(dmg))`).
- **Armor** gives a chance to completely ignore a hit: block chance = `armor / (1 + armor)`, capped at 75%. A blocked hit shows "BLOCKED" and grants only 0.2 s of invulnerability.
- **Shield hearts** (cyan) absorb damage before real HP. They come from the Bone Plate item and Shield Heart perk, and are refilled to full at the start of each floor. Losing your last shield triggers a "SHIELD DOWN" warning. On the HUD they render at half-heart granularity — **2 shield HP = one full cyan heart**, matching red hearts (2 HP = 1 heart).
- Getting hit knocks you back 14 px, shakes the screen, and flashes a red vignette.

### Healing

- Hearts restore 2 HP (1 heart) each.
- Healing past max HP normally goes to waste (converted to +25 score for heart pickups) — unless you have the **Second Stomach** item, which converts overflow healing into shield HP.
- Other healing sources: Vampire Dentures (kill procs), Hemophage (hit procs), Worm Gut / Bone Knit (post-combat heals).

---

## Floors & Rooms

### Floor generation

- Room count: `min(5 + floor, 9)` — Floor 1 has 6 rooms, Floor 4 onward always has 9.
- Layout is a random walk from a start room, with ~50% branch chance per step.
- The **farthest room** from the start becomes the **boss room**.
- The **second-farthest room** (distance ≥ 2) becomes the **item room**.
- Everything else is a combat room. Adjacent rooms are connected by doors.

### Room types

| Room | Contents | Cleared when… |
|---|---|---|
| **Start** | Nothing | Always cleared |
| **Combat** | 1–3 waves of enemies | All waves dead |
| **Item** | 1 item pedestal + 35% chance of a weapon | Immediately (no fight) |
| **Boss** | Floor boss | Boss dies |

Doors in combat and boss rooms **lock** until the room is cleared. Re-entering an uncleared room restarts its remaining waves.

The canvas is fixed at **960 × 640**. Playable bounds are inset into five room shapes: full
hall, wide horizontal hall (224px playable height), tall vertical hall (224px playable width),
compact chamber, and inset pit. Start and boss rooms force full halls; item rooms force
chambers; combat rooms mix the shapes. There is no camera or larger-than-screen room. Visual
tiles recombine into four themes: **abattoir**, **plant**, **oxide**, and **flesh**.

### Waves per combat room

```
base = 3 + ceil(floor × 1.4)      wave 1: always
floor ≥ 2:  + wave 2 of ceil(base × 0.7)
floor ≥ 4:  + wave 3 of ceil(base × 0.5)
```

Waves spawn 0.9 s apart, up to a hard cap of 72 simultaneous enemies.

| Floor | Wave sizes |
|---|---|
| 1 | 5 |
| 2 | 6 / 5 |
| 3 | 8 / 6 |
| 4 | 9 / 7 / 5 |
| 6 | 12 / 9 / 6 |
| 9 | 16 / 12 / 8 |

### Combat room rewards

Clearing a combat room drops:

- **XP gems** worth `irand(3, 5 + floor)` total
- **Ammo** at `24% + luck × 30%` chance
- **Heart** at `10% + luck × 30%` chance

---

## Pickups

| Pickup | Effect |
|---|---|
| **XP Gem** (small, value 1 / big, value 5) | Grants XP × your `xpMul`. Fills the level bar; each level-up opens the Mutation Draft. |
| **Heart** | Heals 2 HP. At full HP: +25 score instead. |
| **Ammo** | Refills carried special weapons (current + holstered) by their authored `refill` × `ammoPickupMul`, up to 150% of magazine size. Overflow becomes score. |
| **Weapon** | Equips on walk-over. Your old special weapon drops with its remaining ammo (Bone Popper is never dropped). |
| **Item** (on pedestal) | Grants/upgrades a passive item. Hovering near a pedestal shows its name. |
| **Stairs Down** | Appears after every boss kill. Walk over to descend. |

### Pickup behavior

- **Magnet radius:** `46 × magnet` px (46 px base) — gems, hearts, and ammo fly to you.
- **Pickups land 0.6 s after spawning** before they can be collected.
- Only gems, hearts, and ammo are magnetized; weapons, items, and stairs require walking over them.

### Kill drops

| Source | Drops |
|---|---|
| Normal enemy | XP gems (enemy's XP value) · 5.25% + luck×3% ammo · 2.2% + luck×3% heart |
| Elite enemy | 3× XP + 3–5 bonus gems · 18% + luck×10% **item** · else 45% + luck×15% ammo |
| Boss | 1 item pedestal + 1 weapon (rolled at floor + 2) + 1 guaranteed ammo + stairs · the boss room also stocks 1 ammo when you enter · the stair hatch stays sealed for 3 seconds after the kill |

**Luck** is a player stat (Lucky Coin, Crow Bait, Scavenger perk) that scales most drop chances as shown above.

---

## Leveling & Mutation Draft

- XP needed for the next level: `8 + level × 4` (level 1→2 needs 12 XP, then 16, 20, 24…).
- Each level-up queues a **Mutation Draft**: choose 1 of 3 random perks. Multiple queued drafts resolve one after another.
- **Rerolls** (from the Reroll Rib item) let you re-draw the three choices with R.
- **Auto-Draft** (T) skips the screen and picks randomly — the setting persists between sessions.

---

## Pressure (Dynamic Difficulty)

The **PRESSURE** meter on the HUD is a run-long adaptive difficulty multiplier applied to enemy and boss **HP and speed at spawn time**. It also **multiplies every point of score you earn** — the higher the pressure, the more each kill, room, and floor is worth.

- Range: **0.60 – 2.00** (starts at 1.00).
- Gains for rooms cleared **without taking damage** (flawless streak).
- Taking damage **relieves** pressure, scaled by how big the hit was, how low your HP is, and how many recent hits you've taken.
- Decays passively while below 35% HP, or if you stall in a room for 90+ seconds.
- Only affects enemies spawned *after* the change — living enemies keep their stats.

### The Pressure Dial

The title screen has a **PRESSURE DIAL** (−10 … +10) that tunes how pressure responds. It sets two curves — how fast pressure **rises** per clean room, and how much **relief** each hit grants (which also scales the passive decay). The midpoint (0) is the standard tuning; the dial persists between sessions.

| Dial | Rise / clean room | Relief on hit (base) | Behaviour |
|---|---|---|---|
| **−10** | −0.020 | 0.080 | Strong mercy; negative rise respects the 0.60 floor |
| **−5** | 0 | 0.050 | Mercy — pressure does not rise from clean rooms |
| **0** | +0.010 | 0.030 | Standard — today's balance |
| **+5** | +0.050 | 0 (none) | Ratchet — pressure can only ever rise; score floored at 1.00× |
| **+10** | +0.100 | 0 | Maximum ratchet; pressure respects the 2.00 ceiling |

Values between the anchors interpolate linearly. Negative rise respects the 0.60 floor and positive rise respects the 2.00 ceiling. **Cranking the dial up is how you chase the BEST CUT.**

### Streak

The HUD also tracks your **streak** of consecutive rooms cleared without damage. It is purely cosmetic bragging rights — its only mechanical effect is feeding the pressure gain above.

---

## Difficulty Scaling (summary)

Enemy stats scale with floor number, your **power score**, and pressure:

- **Power score** = `(level − 1) × 0.5 + (sum of all item tiers)`.
- Enemy HP: `base × (1 + 0.22 × (floor−1)) × (1 + 0.05 × power) × pressure` (elites ×2.6 more).
- Enemy speed: `base × (1 + 0.04 × (floor−1) + 0.01 × power) × pressure` (±10% random).
- Enemy **contact damage does not scale** with floor — only elites get +1.
- Bosses scale the same way but with 30% HP per floor instead of 22%.

Full formulas are in [enemies.md](enemies.md) and [bosses.md](bosses.md).

---

## HUD Reference

- **Top-left — BUTCHER // VITALS:** level, hearts (red, 2 HP per heart; half containers render as half outlines) and shield hearts (cyan, 2 shield HP per heart), shown on up to two rows, XP bar, active weapon + ammo (red when below 25%), holstered weapon with `[R]` swap hint.
- **Item tray** (below vitals): up to 24 item icons with tier numerals I–IX.
- **Top-right — SECTOR MAP:** minimap. White = current room, red = boss, gold = item, gray = cleared, maroon = uncleared. Includes floor number.
- **Bottom-right — RUN DATA:** floor, kills, score (with the live pressure multiplier), PRESSURE % (with the dial setting), STREAK, pressure bar.
- **HUD opacity** is adjustable from the pause menu (`;` / `'` or the HUD slider, 25%–100%). The boss HP bar and toast notifications always stay fully opaque.
- **Bottom-center:** boss HP bar (during boss fights).
- **Top-center:** toast notifications (pickups, floor intros, boss events).

### Screens

| Screen | What it offers |
|---|---|
| **Title** | INITIATE DESCENT, PRESSURE DIAL (−10…+10), control reference, best score, confirmed desktop exit |
| **Pause** | Jukebox (track cycling), SFX/music volume + HUD opacity sliders, resume/swap/auto/mute hints, Field Manual (`H` / `?` button) |
| **Mutation Draft** | 3 perk cards, random cut, reroll, auto-draft |
| **Game Over ("BUTCHERED")** | Floor, kills, score, NEW BEST CUT tag, restart |

---

## Persistence

Stored in `localStorage` between sessions:

- `meatslicer_best` — high score
- `meatslicer_sfx_volume` (default 0.45)
- `meatslicer_music_volume` (default 0.55)
- `meatslicer_autoperk` — auto-draft toggle
- `meatslicer_pressure_dial` — Pressure Dial setting (−10…+10, default 0)
- `meatslicer_hud_alpha` — HUD opacity (default 1.0)

Nothing else carries over: no unlocks, no meta-currency, no saved runs. Every descent starts fresh with a Bone Popper and 6 HP.

### Death and restart

When HP reaches zero, simulation freezes. Input is locked for 3 seconds, then **R**, **Enter**,
or a click restarts the run. During the lock the player plays a derived gore animation with
particles. Normal damaged monsters show mini HP pips for 2.5 seconds; elite and boss bars stay
persistent.
