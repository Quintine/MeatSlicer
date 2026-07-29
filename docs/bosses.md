# Bosses

All **9 bosses** in MeatSlicer, their rotation, scaling, and complete attack patterns. Pulled from `js/bosses.js`.

---

## Boss rotation

Bosses rotate in a fixed 9-boss cycle. The boss you fight depends only on the floor number: `boss index = (floor − 1) mod 9`.

| Floor | Boss | Cycle | Tier |
|---|---|---|---|
| 1 | Bone Saw | 0 | 0 |
| 2 | Gore Crown | 0 | 0 |
| 3 | Knife Floor Crawl | 0 | 0 |
| 4 | Veal Mother | 1 | 0 |
| 5 | The Flenser | 1 | 0 |
| 6 | Hook Choir | 1 | 0 |
| 7 | Plate Father | 2 | 0 |
| 8 | Auger Prime | 2 | 0 |
| 9 | The Scald | 2 | 0 |
| 10 | Bone Saw | 3 | 1 |
| 11 | Gore Crown | 3 | 1 |
| … | *(cycle repeats; tier rises every 3 floors)* | | |

- **Cycle** = `floor((floor − 1) / 3)` — how many 3-floor brackets deep you are.
- **Tier** = `cycle − debutCycle` (min 0) — the boss's personal difficulty level. Each boss debuts at tier 0 and gains a tier every time its bracket comes around again. Higher tiers unlock extra attacks noted in each entry.

### Shared boss rules

- **Contact damage:** 2 (never scales).
- **Enrage:** below 35% max HP — ×1.35 speed, faster attack cooldowns, and denser bullet patterns. One-time enrage howl.
- **HP scaling:** `base × (1 + 0.30 × (floor − 1)) × (1 + 0.05 × power score) × pressure`
- **Speed scaling:** `base × (1 + 0.10 × cycle + 0.01 × power score) × pressure`
- **Telegraphed attacks** (red zones, knife circles, sweep beams) deal 1 damage on their ticks, separate from contact damage.

### Boss rewards

Killing a boss grants **500 + floor × 100** score, clears all hostile bullets/telegraphs/minions, and spawns:

- **1 item pedestal** (left of room center)
- **1 weapon drop** rolled at **floor + 2** (right of center)
- **Stairs Down** (below center)

> *"[NAME] DESTROYED — take the meat, take the stairs"*

---

## 1. Bone Saw

**Debut:** Floor 1 · **Base HP:** 520 · **Base speed:** 60 · **Hitbox:** 45

The opener: a lumbering circular saw that chases at 3× its base speed and mixes projectile fans with a telegraphed charge.

**Attacks:**

- **Saw fling** (45% of attack choices): fan of 6 saws (10 when enraged), speed 240, damage 1, 3.2 s life, spread 0.28 rad around your direction.
- **Charge** (55%): aims for 0.6 s (locked direction), then dashes at **430 × speed mult** for 0.85 s, trailing blood. Slamming into a wall ends the charge with a screen shake. Cooldown ~3.2 s between attack rolls (2.2 s enraged).

**Tier scaling:** none beyond stats and enrage — the simplest boss. Strafe the charge, punish the recovery.

## 2. Gore Crown

**Debut:** Floor 2 · **Base HP:** 600 · **Base speed:** 42 · **Hitbox:** 48

Slow, relentless summoner-king with radial bullet patterns.

**Attacks:**

- **Gore volleys** (every 2nd attack, from cycle 1): aimed fan of `3 + min(cycle, 4)` bullets, speed 260, damage 1.
- **Ring attacks** (alternating): ring of `12 + cycle × 4` bullets (18 + cycle × 4 enraged; both cap at 40), speed 170, 4 s life. Tier 3+: rings rotate into spirals. Tier 2+: every 3rd attack is a **double ring** with an offset second ring.
- **Summon** (every `max(7 − cycle × 0.5, 3.5)` s, 5 s enraged): calls `min(2 + cycle, 5)` minions away from you — 60% Runners / 40% Minis, with Splitters (tier 1+, 30%) and Exploders (tier 2+, 25%) mixed in.

Attack cooldown: `max(2.4 − cycle × 0.15, 1.2)` s (1.6 s base enraged). Kill summons before the arena clogs.

## 3. Knife Floor Crawl

**Debut:** Floor 3 · **Base HP:** 560 · **Base speed:** 75 · **Hitbox:** 45

Fast hunter that litters the floor with knife telegraphs and chains dashes.

**Attacks:**

- **Knife telegraphs:** places `min(3 + cycle, 6)` circle traps; the first is centered on you (tier 1+: it *tracks* you at 140 px/s for 0.4 s before locking). Warning time `max(0.7 − cycle × 0.05, 0.45)` s. On expiry they hit for 1 damage, then **linger for 1.1 s**, ticking every 0.4 s for 1 damage each.
- **Cleaver volley** (tier 2+): fan of `3 + min(cycle − 1, 3)` cleavers, speed 300, 2.5 s life.
- **Dash** (chance `min(0.3 + cycle × 0.08, 0.6)` per attack): dashes at 320 × speed mult for 0.5 s, leaving a knife telegraph at the endpoint (tier 1+). Tier 4+: chains a second dash.

Attack cooldown: `max(2.6 − cycle × 0.15, 1.3)` s. Keep moving diagonally; never backtrack across lingering knives.

## 4. Veal Mother

**Debut:** Floor 4 · **Base HP:** 640 · **Base speed:** 34 · **Hitbox:** 52

Broodmother with a one-time damage shield and steady summons.

**Brood Shield (key mechanic):** the first time she drops below 50% HP, she spawns **2 elite Splitter escorts**. While any escort lives, she takes only **35% damage** and moves at half speed. Kill the escorts — "BROOD SHIELD BROKEN / the mother is exposed" — then burn her down.

**Attacks:**

- **Escorts alive:** ring of `10 + min(tier, 3) × 2` syringes, speed 175, every 1.6 s.
- **Escorts dead:** aimed fan of 5 homing syringes (9 at tier 3+), speed 190, homing 1.2, every 3.4 s (2.4 s enraged).
- **Summon** (every 5.5 s, 3.8 s enraged): `min(3 + tier, 6)` Minis, plus Splitters (tier 1+, 30%) and Exploders (tier 2+, 20%).

## 5. The Flenser

**Debut:** Floor 5 · **Base HP:** 460 · **Base speed:** 96 · **Hitbox:** 40

The fastest boss — a blink assassin that teleports behind you.

**Attack loop** (every 2.4 s, 1.5 s enraged):

1. **Fade:** turns invulnerable and invisible over 0.35 s.
2. **Gone:** repositions *behind you* (90–140 px away) for 0.5 s (0.3 s enraged). Drops a knife telegraph at its new position (radius 38); tier 1+: also one at its old position (radius 30).
3. **Strike:** reappears firing a 7-cleaver volley at you (speed 330, spread 0.16 rad; tier 2+: a second offset wave at speed 295), then dashes *away* at 380 × speed mult.

Tier 3+: blinks **twice** per loop. Never stand still during its fade — the strike always comes from behind your current aim direction.

## 6. Hook Choir

**Debut:** Floor 6 · **Base HP:** 580 · **Base speed:** 46 · **Hitbox:** 50

Slow chanter surrounded by orbiting harpoon hooks that periodically fling outward.

**Attacks:**

- **Orbiting hooks:** inner ring of `4 + min(tier, 3)` hooks (radius 70, spin 1.9; 2.65 enraged). Tier 1+: outer ring of `4 + min(tier, 2)` hooks (radius 110, counter-spin −1.6). Hooks damage on contact (damage 1) and live 20 s; rings respawn 1.2 s after being released.
- **Wind & release** (every 4 s, 2.8 s enraged): 0.7 s wind-up expands all hooks to radius 170 spinning 1.75× faster, then releases them **tangentially at speed 300**. Tier 3+: released hooks home (0.8).
- **Volley** (every 2.8 s): 3 aimed harpoons, speed 260.

The release is the dangerous moment — the hooks leave along the tangent, so sidestep radially (toward/away from the boss), not along the ring.

## 7. Plate Father

**Debut:** Floor 7 · **Base HP:** 700 · **Base speed:** 38 · **Hitbox:** 54

Armored juggernaut with breakable plating.

**Armor plates (key mechanic):** starts with **4 plates** and takes only **25% damage**. Every 6% of max HP in damage taken breaks one plate (0.45 s stun, "PLATE BROKEN"). With all 4 gone: "ARMOR BREACHED" — full damage. Effectively ~24% of his HP is spent under 75% reduction.

**Attacks** (alternating, every 3 s / 2 s enraged):

- **Projectile walls:** ring of 20 gore bullets, speed 150, with a `3`-bullet gap (tier 1+: gap of 2). Tier 2+: a second, slower ring (speed 125) with its own offset gap. Slip through the gap.
- **Tallow Stomp:** winds up 0.7 s, then erupts a ring of 6 fire hazards at radius 120 (tier 3+: a second ring at 200). Hazards: 3.5 s life, 1 damage per 0.45 s tick.

## 8. Auger Prime

**Debut:** Floor 8 · **Base HP:** 600 · **Base speed:** 52 · **Hitbox:** 48

Drill titan whose signature is a rotating beam sweep.

**Attack loop** (every 3.6 s, 2.4 s enraged):

1. Locks onto your position and **spools** for 0.8 s (0.5 s enraged), stationary.
2. **Sweep:** fires `1` rotating beam (tier 1+: 2 arms, tier 3+: 3 arms), length 420, width 26, sweeping for 2.2 s at 1.15 rad/s (tier 2+: 1.65 rad/s) in a random direction. Beam ticks check every 0.5 s — touching the line deals 1 damage.
3. Also launches 3 aimed saws (speed 150, accelerating +260, **bounce once** off walls, 2.6 s life).

Stay outside the beam's radius or circle against the spin direction; the boss is stationary and punishable during the whole 2.2 s sweep.

## 9. The Scald

**Debut:** Floor 9 · **Base HP:** 620 · **Base speed:** 40 · **Hitbox:** 50

Area-denial boiler that floods the arena with acid.

**Attacks** (every 2.8 s, 1.9 s enraged):

- **Acid pools:** telegraphs `3 + min(tier, 2)` pools (tier 2+: 7), radius 46 (tier 1+: 58), one always centered on you. After a 0.6 s warning they become acid hazards for 5 s (7 s enraged), ticking 1 damage every 0.4 s. Up to 14 active at once — floor space is the real resource in this fight.
- **Steam burst** (every 3rd attack): ring of 16 steam bolts, speed 220 decelerating (−60), 3.4 s life. Tier 3+: a second, slower ring (speed 155, 4.2 s life).

Keep to the edges, rotate with the room, and never let pools cut off your only escape lane.

---

## Boss cheat sheet

| Boss | Core threat | Counter |
|---|---|---|
| Bone Saw | Telegraphed charge | Sidestep, punish wall crashes |
| Gore Crown | Rings + summons | Kill adds fast; weave ring gaps |
| Knife Floor Crawl | Lingering knife zones | Never retrace your steps |
| Veal Mother | 65% damage reduction shield | Focus the Splitter escorts first |
| The Flenser | Backstab blink | Move when it fades; watch your six |
| Hook Choir | Orbital hook release | Dodge radially on release |
| Plate Father | 75% damage reduction | Grind plates; use wall-ring gaps |
| Auger Prime | Rotating beam sweep | Circle the spin; punish the stationary sweep |
| The Scald | Acid floor denial | Rotate along edges; keep lanes open |
