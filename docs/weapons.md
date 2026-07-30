# Weapons

All 16 weapons in MeatSlicer, with exact stats pulled from `js/weapons.js`.

Weapons have **no upgrade levels** — their stats are fixed. All scaling comes from [passive items](items.md) and [perks](perks.md).

---

## How weapons work

- You always carry the **Bone Popper** (infinite ammo sidearm) plus **one special weapon** in a holster slot.
- Press **R** to swap between them. Holstered weapons keep their remaining ammo.
- Picking up a new special weapon drops your current one (with its remaining ammo) so you can swap back.
- Picking up a weapon that matches either your active or holstered special acts like an ammo pickup for that matching weapon instead of replacing it. Refill uses the weapon's authored `refill`, respects the 150% cap, and converts overflow to score.
- When a special weapon runs dry, you automatically fall back to the Bone Popper.
- Most special weapons consume ammo per shot: `1 / ammoEff` units per shot (so Brass Magazine's additive `ammoEff` stretches every magazine).
- **Stream weapons** (Bile Blunderbuss, The Cauterizer, Red Right Hand) instead drain ammo per second while held: `drain / ammoEff` units per second. Their magazines are measured in seconds of fire.
- Each special has two ammo numbers: **`ammo`** (magazine size — how long a fresh weapon lasts) and **`refill`** (units returned per ammo pickup — tuned so one pickup funds roughly ten kills). Pickups can overfill up to 150% of the magazine; overflow converts to score.

### Where weapons come from

| Source | Roll |
|---|---|
| Boss kill (guaranteed) | Rolled at **floor + 2** — better tiers, earlier |
| Item room | 35% chance alongside the item, rolled at current floor |
| Starting loadout | Bone Popper only |

### Drop weights by tier

| Tier | Weight |
|---|---|
| 0 (Common) | `max(20, 60 − floor × 5)` |
| 1 (Uncommon) | `30 + floor × 2` |
| 2 (Rare) | `10 + floor × 3` |
| 3 (Legendary) | `min(4 + floor × 2, 22)` |

Higher floors shift weight toward higher tiers. Tier 3 caps at weight 22.

### Shared firing mechanics

- **Volley system:** items that grant `split`, `fan`, or `rear` shots add extra projectiles to *every* projectile weapon — parallel shots (±0.035 rad), angled shots (±0.16 rad per level), and backward shots respectively.
- **Damage:** `weapon dmg × dmgMul` (× `critMul` on crits — 5% base chance, ×2.0 base).
- **Projectile lifetime (range):** `weapon range × rangeMul`, in seconds.
- **Homing:** homing projectiles steer toward the nearest enemy within 320 px. Strength is `1.6 + homing × 0.7` for normal weapons with Homing Tumor; stronger bases for Eye Ballista and Swarm Jar (see below).

---

## Tier −1 — Starter

### Bone Popper

> *Trusty bone-shard sidearm*

| Stat | Value |
|---|---|
| Damage | 8 |
| Fire interval | 0.60 s |
| Projectile speed | 540 |
| Range (lifetime) | 0.45 s |
| Ammo | **Infinite** |
| Behavior | Single bullet |
| Recoil (punch) | 0.42 |

Your eternal fallback. Never runs dry, never holstered — swapping with R always brings it back.

---

## Tier 0 — Common

### Ribcage Repeater

> *Rattles off rib slivers*

| Stat | Value |
|---|---|
| Damage | 6 |
| Fire interval | 0.09 s (very fast) |
| Projectile speed | 560 |
| Spread | 0.10 rad |
| Range | 0.42 s |
| Ammo | 84 (refill 42 per pickup) |
| Recoil | 0.18 |

Rapid-fire bullet hose. Low per-shot damage, excellent proc-per-second carrier for on-hit item effects.

### Marrow Scatter

> *A devastating close blast of jagged bone*

| Stat | Value |
|---|---|
| Damage | 11 **per pellet** |
| Pellets | 6 |
| Fire interval | 0.58 s |
| Projectile speed | 500 |
| Spread | 0.55 rad (wide) |
| Range | 0.38 s (short) |
| Ammo | 20 (refill 6 per pickup) |
| Recoil | 0.92 (heavy) |

Shotgun. Up to 66 damage per trigger pull at point blank before multipliers, but the short lifetime makes it strictly close-range.

---

## Tier 1 — Uncommon

### Cleaver Cadence

> *It always comes back*

| Stat | Value |
|---|---|
| Damage | 15 |
| Fire interval | 0.38 s |
| Projectile speed | 400 (returns at up to 520) |
| Range | 1.10 s |
| Ammo | 26 (refill 10 per pickup) |
| Recoil | 0.42 |

Boomerang: flies out while decelerating for 0.45 s, then accelerates back to you (caught within 20 px). **Always pierces** — it can hit enemies on both the outbound and return trip.

### Sawblade Launcher

> *Bouncing, hungry steel*

| Stat | Value |
|---|---|
| Damage | 13 |
| Fire interval | 0.34 s |
| Projectile speed | 360 |
| Bounces | 5, shared between walls and enemies (plus bounces from Ricochet Ribs) |
| Range | 0.60 s |
| Ammo | 24 (refill 9 per pickup) |
| Recoil | 0.45 |

Spinning ricochet blades. Each enemy hit spends one bounce and the blade tears through; at zero bounces it dies on the next enemy (or wall). Deadly in cramped rooms where blades ping off walls into packs.

### Hemophage

> *Drinks what it touches*

| Stat | Value |
|---|---|
| Damage | 8 |
| Fire interval | 0.19 s |
| Projectile speed | 480 |
| Range | 0.45 s |
| Lifesteal | 12.5% chance per hit to heal 1 HP |
| Ammo | 70 (refill 42 per pickup) |
| Recoil | 0.35 |

The only weapon with built-in lifesteal. Healing only procs while you're below max HP.

### Eye Ballista

> *The eyes follow. They always follow*

| Stat | Value |
|---|---|
| Damage | 10 |
| Fire interval | 0.30 s |
| Projectile speed | 320 |
| Range | 0.62 s |
| Homing | 6 + homing × 0.7 (strongest base homing) |
| Ammo | 42 (refill 21 per pickup) |
| Recoil | 0.40 |

Aggressively seeking projectiles. Aim roughly, let the eyes do the rest.

---

## Tier 2 — Rare

### Bile Blunderbuss

> *A brutal corrosive torrent; pools linger*

| Stat | Value |
|---|---|
| Damage | 7 |
| Fire interval | 0.12 s (rapid, hold to spray) |
| Projectiles per shot | 2 |
| Projectile speed | 340 |
| Spread | 0.32 rad |
| Range | 0.36 s |
| Pierce | 2 (+ item pierce) |
| Ammo | 80 (refill 21 per pickup), **drains 8/sec while held** |
| Recoil | 0.34 |

Corrosive cone spray. On hit: **slows for 1.6 s** and 45% chance to leave an **acid pool** (radius 24 × sizeMul, 2.5 s life, DPS = bullet damage × 0.8). Projectiles that expire mid-flight have a separate 35% chance to drop a pool. Ammo is time-denominated: a full tank is 10 seconds of spray.

### Gut Hook

> *Impales and drags the catch*

| Stat | Value |
|---|---|
| Damage | 48 (+ 50% = 24 bonus when the drag ends) |
| Fire interval | 0.85 s (slow) |
| Projectile speed | 720 (fastest projectile) |
| Range | 0.60 s |
| Ammo | 11 (refill 5 per pickup) |
| Recoil | 0.95 |

Harpoon that pierces everything and **drags the first non-boss enemy it hits** along its flight path. When the projectile expires, the dragged enemy takes 50% of the bullet's damage again. Excellent for yanking a priority target out of a pack.

### Flesh Masher

> *Lobs ground-meat bombs*

| Stat | Value |
|---|---|
| Damage | 34 (area of effect) |
| Fire interval | 0.75 s |
| Behavior | Lobbed to cursor, explodes on arrival |
| Blast radius | 85 × rangeMul × √sizeMul |
| Ammo | 14 (refill 4 per pickup) |
| Recoil | 0.90 |

Grenade lobber. Flight time auto-computed from distance (clamped 0.12–0.8 s). The blast damages and knocks back everything in radius. Arcs over the chaos — no line of sight needed, and lobbed shots pass over enemies mid-flight to detonate at the target point.

### Trap Queen

> *Bear traps. For bears. And worse*

| Stat | Value |
|---|---|
| Damage | 10 per trap trigger |
| Fire interval | 0.55 s |
| Behavior | Lobbed; leaves a trap where it lands |
| Trap life | 12 s × rangeMul |
| Trap radius | 16 × sizeMul |
| Trap charges | 3 victims per trap |
| Ammo | 26 (refill 13 per pickup) |
| Recoil | 0.65 |

Area denial. Traps persist on the floor and snap shut on up to **three** victims each (damage + 2.2 s root per victim) before breaking — pre-lay them along doorways and kiting paths.

### Red Right Hand

> *A chainsaw that liquefies anything in reach*

| Stat | Value |
|---|---|
| Damage | 7 per tick (ticks scale with fire rate) |
| Damage interval | 0.10 s |
| Reach | 30 × rangeMul × √shotSpeedMul from player |
| Arc radius | 34 × √sizeMul |
| Ammo | 150 (refill 72 per pickup; drains 18/sec while held, ÷ ammoEff) |
| Recoil | 0.38 |

Continuous melee chainsaw — hold LMB and walk into things. Damage scales with `dmgMul × rateMul`, plus the same +6%-per-pierce/bounce/homing inert bonus as the Tenderizer. Sparks fly, ammo drains.

---

## Tier 3 — Legendary

### The Cauterizer

> *Incinerates anything brave enough to get close*

| Stat | Value |
|---|---|
| Damage | 4.5 per flame tick |
| Fire interval | 0.05 s (20 ticks/sec, hold to spray) |
| Projectiles per shot | 2 |
| Projectile speed | 310 |
| Spread | 0.34 rad |
| Range | 0.36 s (very short) |
| Pierce | 2 (+ item pierce) |
| Ammo | 110 (refill 21 per pickup), **drains 12/sec while held** |
| Recoil | 0.32 |

Flamethrower. Hits **ignite for 1.5 s** with burn DPS = bullet damage × 0.8 (3.6 DPS base). Melt hordes that get close; useless at range. Ammo is time-denominated: a full tank is ~9 seconds of flame.

### The Tenderizer

> *A room-shaking close-range meat paste*

| Stat | Value |
|---|---|
| Damage | 60 (instant area hit) |
| Fire interval | 0.58 s |
| Range | 46 × rangeMul × √shotSpeedMul from player |
| Blast radius | 70 × rangeMul × √sizeMul |
| Ammo | 10 (refill 5 per pickup) |
| Recoil | 1.00 (max), screen shake 5 |

Point-blank slam — no projectile, an instant circular blast in front of you. Bonus "inert" damage scaling: +6% per point of pierce + bounce + homing you own.

### Spinal Tap

> *Charge it. Delete a line of meat*

| Stat | Value |
|---|---|
| Damage | 95 (× 0.4–1.0 by charge) |
| Charge time | 0.85 s (minimum 40% charge = 0.34 s to fire) |
| Beam length | 900 × rangeMul |
| Beam width | 14 × √sizeMul |
| Ammo | 7 (refill 4 per pickup) |
| Recoil | 1.00, screen shake 8 |

**Hold LMB to charge, release to fire** an instant hitscan beam that deletes everything in a line. Damage scales `0.4 + 0.6 × charge fraction` — full charge is 2.5× a hasty snap shot. A ring around your character shows charge state (blue = full). Charge rate scales with `rateMul × √shotSpeedMul`.

### Swarm Jar

> *A jar of friends. They are hungry*

| Stat | Value |
|---|---|
| Damage | 9 per maggot |
| Fire interval | 0.80 s |
| Maggots per jar | 6 (+ split + fan bonuses) |
| Maggot speed / life | 260 / 2.2 s × rangeMul |
| Maggot homing | 8 + homing × 0.7 (strongest in game) |
| Ammo | 12 (refill 6 per pickup) |
| Recoil | 0.70 |

Lobs a jar that shatters into a pack of homing maggots where it lands. The jar arcs over enemies mid-flight, so aim at the pack — not through it. Maggots **inherit your pierce and bounce stats** and relentlessly chase enemies for their full lifetime. Throw and forget.

---

## Damage math reference

```
bullet damage  = weapon dmg × dmgMul × (critMul if crit)
fire interval  = weapon interval / (rateMul × frenzyMul)
proj speed     = weapon spd × shotSpeedMul
proj lifetime  = weapon range × rangeMul
ammo per shot  = 1 / ammoEff        (stream weapons: drain / ammoEff per second)
ammo refill    = weapon refill × ammoPickupMul per pickup (cap 150% of magazine)
knockback      = 90 × knockbackMul
```

- Crit: base 5% chance, ×2.0 damage. Raised by Bloodshot Eye / Hollow Needle (items) and Bone Splitter / Cold Precision (perks).
- Frenzy: from Dead Man's Switch — kills grant `1 + frenzy` fire rate for 3 s.
- Slam/saw/beam weapons (Tenderizer, Red Right Hand, Spinal Tap) get an extra `1 + (pierce + bounce + homing) × 0.06` multiplier instead of firing extra projectiles.
