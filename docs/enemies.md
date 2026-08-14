# Enemies

All **11 enemy types** in MeatSlicer, plus elites, drops, and the exact difficulty-scaling formulas. Pulled from `js/enemies.js` and `js/rooms.js`.

---

## Enemy roster

### Shambler

| Stat | Value |
|---|---|
| Base HP | 26 |
| Base speed | 55 |
| Contact damage | 1 |
| Hitbox radius | 18 |
| XP | 1 |
| First appears | Floor 1 (spawn weight 40) |

The basic chaser. Shuffles toward you with a sinusoidal wobble. Individually harmless, dangerous in the packed waves of later floors.

### Runner

| Stat | Value |
|---|---|
| Base HP | 12 |
| Base speed | 236 |
| Contact damage | 1 |
| Hitbox radius | 15 |
| XP | 1 |
| First appears | Floor 1 (spawn weight 25) |

Extremely fast, fragile chaser — over 4× the Shambler's speed. They arrive first and force you to keep moving.

### Spitter

| Stat | Value |
|---|---|
| Base HP | 20 |
| Base speed | 60 |
| Contact damage | 1 |
| Hitbox radius | 18 |
| XP | 2 |
| First appears | Floor 2 (spawn weight 18) |

Ranged kiter. Holds 190–250 px away from you — approaches if you're farther than 250 px, retreats if you're closer than 190 px. Fires a gore bolt (speed 220, damage 1, 3 s life) when within 420 px, every **1.9 s**. Elite Spitters fire a 3-shot fan (0.25 rad spread) every **1.1 s**.

### Splitter

| Stat | Value |
|---|---|
| Base HP | 30 |
| Base speed | 70 |
| Contact damage | 1 |
| Hitbox radius | 21 |
| XP | 1 |
| First appears | Floor 2 (spawn weight 16) |

Chaser that **splits into 2 Minis on death** (elite and normal). Slightly tankier than a Shambler. Explosions and AoE that kill the Minis with the parent are valuable here.

### Mini

| Stat | Value |
|---|---|
| Base HP | 6 |
| Base speed | 120 |
| Contact damage | 1 |
| Hitbox radius | 14 |
| XP | 1 |
| First appears | Only from Splitter deaths and boss summons |

Small, vicious gore-red chaser. Never spawns directly from room waves. Splitter splits and boss summons appear instantly; room-wave enemies telegraph first (see below).

### Exploder

| Stat | Value |
|---|---|
| Base HP | 14 |
| Base speed | 110 |
| Contact damage | 2 |
| Hitbox radius | 16 |
| XP | 2 |
| First appears | Floor 3 (spawn weight 14) |

Suicide bomber. Charges at you; within 56 px its **0.5 s fuse** lights (it flashes). When the fuse ends — or when it's killed by anything — it detonates: radius 70 (fuse) / 60 (killed), **2 damage**. The blast only hurts *you*, not other enemies. Kill them at range or bait the fuse and back off.

### Censer

| Stat | Value |
|---|---|
| Base HP | 34 |
| Base speed | 45 |
| Contact damage | 1 |
| Hitbox radius | 19 |
| XP | 3 |
| First appears | Floor 4 (spawn weight 8) |

A zone caster that every ~3.3s predicts player movement and telegraphs a hostile acid pool (radius 38, 0.75s warning, ~4.2s life). Excluded from wave picks when the arena's minimum dimension is below 300px.

### Bulwark

| Stat | Value |
|---|---|
| Base HP | 60 |
| Base speed | 38 |
| Contact damage | 2 |
| Hitbox radius | 23 |
| XP | 3 |
| First appears | Floor 5 (spawn weight 8) |

Slowly faces the player; hits within ±70° of its front deal 20%, flank/rear hits full. Resists on-hit stun and cannot be elite.

### Flenserling

| Stat | Value |
|---|---|
| Base HP | 22 |
| Base speed | 150 |
| Contact damage | 2 |
| Hitbox radius | 16 |
| XP | 3 |
| First appears | Floor 5 (spawn weight 7) |

Periodically phases untargetable, appears behind the aim vector, and lunges.

### Choirmaster

| Stat | Value |
|---|---|
| Base HP | 40 |
| Base speed | 50 |
| Contact damage | 1 |
| Hitbox radius | 19 |
| XP | 4 |
| First appears | Floor 6 (spawn weight 6) |

Its 180px aura grants +35% speed and heals nearby non-boss monsters ~1.8% max HP per second (minimum 0.5). At most one is selected by a normal wave.

### Brood Sac

| Stat | Value |
|---|---|
| Base HP | 45 |
| Base speed | 20 |
| Contact damage | 1 |
| Hitbox radius | 22 |
| XP | 4 |
| First appears | Floor 7 (spawn weight 6) |

Spawns 2 Minis every 4s (elite: 4–6 every 3s) and 4 on death. At most two are wave-selected; the brood population cap is 40. Excluded from normal wave elite rolls and thin halls; an elite sac (debug or other spawn paths) still uses the elite summon count.

---

## Spawn weights

| Enemy | First floor | Weight |
|---|---|---|
| Shambler | 1 | 30 |
| Runner | 1 | 22 |
| Spitter | 2 | 14 |
| Splitter | 2 | 12 |
| Exploder | 3 | 10 |
| Censer | 4 | 8 |
| Bulwark | 5 | 8 |
| Flenserling | 5 | 7 |
| Choirmaster | 6 | 6 |
| Brood Sac | 7 | 6 |

Weights stay flat once unlocked; floors get harder through stat scaling and wave size, not new mixes.

## Elites

Any wave-spawned enemy can roll as an **elite** (gold ring, HP bar pip):

- Chance: `min(0.03 + floor × 0.02, 0.20)` — 5% on floor 1, capping at 20% from floor 9.
- **HP ×2.6**, speed ×0.9, contact damage **+1**, radius ×1.45, XP ×3.
- Bulwark and Brood Sac are excluded from elite rolls.
- Drops: 3× XP plus 3–5 bonus gems, **18% + luck×10% chance of an item pedestal drop**, otherwise 60% + luck×20% chance of ammo.

## Drops

| Kill | XP | Other drops |
|---|---|---|
| Normal enemy | Its XP value | Ammo: 7% + luck×4% · Heart: 2.2% + luck×3% |
| Elite | 3× XP + 3–5 bonus | Item: 18% + luck×10% · else ammo: 60% + luck×20% |

Your on-kill items (Volatile Bile, Bloodlust, Vampire Dentures, Dead Man's Switch) trigger off every kill — see [items.md](items.md).

---

## Difficulty scaling

Every enemy's stats are computed at **spawn time** from three factors: floor, your power score, and pressure.

**Power score** = `(your level − 1) × 0.5 + (sum of all your item tiers)`

**HP:**
```
base HP × (1 + 0.22 × (floor − 1)) × (1 + 0.05 × power) × (elite ? 2.6 : 1) × pressure
```

**Speed:**
```
base speed × (1 + 0.04 × (floor − 1) + 0.01 × power) × (elite ? 0.9 : 1) × rand(0.9, 1.1) × pressure
```

**Contact damage:** flat per type (elites +1) — it **never scales with floor**. What kills you late-game is volume, speed, and HP pools, not bigger hit numbers.

**Pressure** (see [gameplay.md](gameplay.md#pressure-dynamic-difficulty)) ranges 0.60–2.00 and multiplies both HP and speed. Playing flawlessly pushes it up; getting hit pulls it down. The title-screen **Pressure Dial** (−10…+10) tunes how fast it rises per clean room and how much relief each hit grants — and every point of score is multiplied by the live pressure value.

### Wave spawn telegraph

When a combat-room wave spawns, each enemy first appears as a **pulsing red sigil** for 0.5 s — frozen, harmless, but targetable. After the telegraph it materializes and becomes dangerous. Splitter splits and boss-summoned minions appear instantly (no telegraph).

### Example: Floor 10 Shambler

Level 8 player (3.5 power) with 8 item tiers (8 power) → power 11.5, pressure 1.2:

```
HP:  26 × (1 + 0.22×9) × (1 + 0.05×11.5) × 1.2  =  26 × 2.98 × 1.575 × 1.2  ≈ 146
Spd: 55 × (1 + 0.04×9 + 0.01×11.5) × 1.2          ≈ 55 × 1.475 × 1.2          ≈ 97
```

vs. 26 HP / 55 speed on floor 1. Build damage accordingly.

## Wave sizes

Combat rooms spawn `3 + ceil(floor × 1.4)` enemies in wave 1, plus a second wave (×0.7) from floor 2 and a third (×0.5) from floor 4. Full table in [gameplay.md](gameplay.md#waves-per-combat-room). Hard cap: 72 enemies alive at once.
