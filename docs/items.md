# Items

All **46 passive items** in MeatSlicer, with exact effects pulled from `js/items.js` and the proc logic in `js/enemies.js` / `js/player.js`.

---

## How items work

- Items are **passive and permanent** for the run. Pick one up and its effect applies immediately.
- **Duplicates upgrade the tier** (shown as Roman numerals **I–IX** on the pedestal and in your item tray). Each duplicate re-applies the item's effect — multiplicative stats compound, additive stats stack linearly.
- **Tier cap is 9.** Picking up a duplicate at tier IX instead grants +150 score and 5 XP gems with a "MAX" toast.
- There is **no rarity system**. Item rolls use a "smart roll": 50% chance to upgrade an item you already own (below cap), 50% chance of any item from the full pool — so builds naturally specialize over a run.

### Where items come from

| Source | Chance |
|---|---|
| Item room pedestal | Guaranteed (1 per floor) |
| Boss kill | Guaranteed (1 pedestal) |
| Elite enemy kill | 18% + luck × 10% |

---

## Damage & Fire Rate

| Item | Description | Effect per tier |
|---|---|---|
| **Hollow Points** | +25% damage | `dmgMul ×1.25` |
| **Marrow Glut** | +20% damage, −10% fire rate | `dmgMul ×1.20`, `rateMul ×0.90` |
| **Bloat Rounds** | +25% attack size, +10% damage | `sizeMul ×1.25`, `dmgMul ×1.10` |
| **Twitch Fibers** | +20% fire rate | `rateMul ×1.20` |
| **Grafted Trigger** | +18% fire rate | `rateMul ×1.18` |

Note: attack size (`sizeMul`) also enlarges melee arcs, blast radii, acid pools, and projectile hitboxes — Bloat Rounds is secretly an AoE item.

## Shot Modifiers

| Item | Description | Effect per tier |
|---|---|---|
| **Scalpel** | +25% shot speed | `shotSpeedMul ×1.25` |
| **Lead Marrow** | +25% range | `rangeMul ×1.25` |
| **Piercing Gaze** | Shots pierce +1 enemy | `pierce +1` |
| **Ricochet Ribs** | Shots bounce +1 time | `bounce +1` (wall bounces) |
| **Split Tongue** | Twin parallel shot | `split +1` — extra parallel shots per volley |
| **Hydra Maw** | Fires 2 extra angled shots | `fan +1` — extra angled shots (±0.16 rad per level) |
| **Homing Tumor** | Shots seek flesh (stronger per tier) | `homing +1` — homing strength `1.6 + homing × 0.7` |
| **Backstabber** | +1 rear shot | `rear +1` — fires backward too |
| **Splinter Bone** | Shots shatter into +2 shards on hit | `splinter +2` — on-hit shards dealing 40% of the hit's damage each |

## On-Hit Procs

All of these trigger from your weapon hits (orbital knives proc at half chance). Chances stack additively across tiers and are rolled per hit.

| Item | Description | Exact effect per tier |
|---|---|---|
| **Flayer Kiss** | Hits inflict heavy bleeding | `bleed +0.20` — every hit applies 2.2 s bleed at `hit damage × bleed × 0.45` DPS |
| **Ember Jar** | 20% chance to ignite | `+0.20` chance — burn for 1.8 s at `5 × dmgMul` DPS |
| **Acid Gland** | Hits may leave acid pools | `+0.12` chance (cap 65%) — pool radius 18 × sizeMul, 2.5 s, `5 × dmgMul` DPS |
| **Hook Rounds** | Hits pull enemies toward you | `+0.18` chance (cap 80%) — yanks the enemy toward you at speed 170 |
| **Sledge Rounds** | More knockback, hits may stun | `knockbackMul ×1.35`, `+0.08` stun chance (cap 75%) — 0.35 s stun, non-bosses only |
| **Chain Sinew** | Hits arc to +1 nearby enemy | `chain +1` — arcs to up to 6 nearby enemies within 180 px for 35% of the hit's damage each |
| **Mortar Bone** | Every sixth hit erupts | `mortar +1` — every `max(2, 7 − mortar)` hits, AoE blast: radius `42 + mortar × 5`, 55% of the hit's damage |

## On-Kill Effects

| Item | Description | Exact effect per tier |
|---|---|---|
| **Vampire Dentures** | Kills may heal you | `lifestealChance +0.04` — on kill, `chance × 3` (cap 90%) to heal 1 HP (2 for elites, 4 for bosses) |
| **Volatile Bile** | Kills explode (bigger per tier) | `explodeOnKill +1` — kill explosions: radius `60 + 15/tier`, damage `(10 + 8/tier) × dmgMul` |
| **Bloodlust** | Kills may drop bonus XP | `+0.12` chance per kill to drop bonus XP equal to the enemy's XP value |
| **Dead Man's Switch** | Kills trigger a fire-rate frenzy | `frenzy +0.12` — any kill grants `1 + frenzy` fire rate for 3 s |

## Survivability

| Item | Description | Exact effect per tier |
|---|---|---|
| **Iron Stomach** | +½ heart container, heal ½ heart | `maxHp +1`, heal 1 |
| **Ghoul Heart** | +2 max HP, heal 2 | `maxHp +2`, heal 2 |
| **Twin Hearts** | +1 max heart, heal 1 heart | `maxHp +2`, heal 2 (identical to Ghoul Heart) |
| **Bone Plate** | +½ shield heart each floor | `shieldPerk +1`, `shieldHp +1` — shields refill every floor (1 shield HP = ½ heart, renders as half a cyan pip) |
| **Second Stomach** | +½ heart and excess healing shields | `maxHp +1`, heal 1, `overShield +1` — overflow healing becomes shield HP |
| **Tanned Hide** | +8% chance to ignore damage | `armor +0.087` — block chance `armor / (1 + armor)`, cap 75% |
| **Dead Man's Clock** | +0.25s hurt immunity | `invBonus +0.25` — post-hit invulnerability 0.9 s → 1.15 s at tier I |
| **Worm Gut** | Heal ½ heart after combat rooms | `roomHeal +1` — guaranteed 1 HP heal after each combat room clear |
| **Spine Cage** | Contact attackers take damage | `thorns +8` — melee attackers take `8 × dmgMul` when they hurt you |
| **Spite Well** | Taking damage releases a blood nova | `retaliate +10` — on hit taken: nova radius 85 × √sizeMul, damage `10 × dmgMul` |

## Criticals

| Item | Description | Effect per tier |
|---|---|---|
| **Bloodshot Eye** | +6% critical chance | `crit +0.06` (base 5%) |
| **Hollow Needle** | +50% critical damage | `critMul +0.50` (base ×2.0) |

## Utility

| Item | Description | Exact effect per tier |
|---|---|---|
| **Orbital Knives** | +1 circling knife | `orbitals +1` — each knife orbits you, dealing `12 × dmgMul × orbDmgMul` on contact (0.35 s cooldown per enemy, half proc chance) |
| **Orbit Crown** | +25% orbital speed and damage | `orbSpeedMul ×1.25`, `orbDmgMul ×1.25` |
| **Lucky Coin** | Better drops | `luck +0.2` |
| **Crow Bait** | +25% drop luck | `luck +0.25` |
| **Magnet Maw** | +60% pickup radius | `magnet ×1.6` — magnet radius 46 × magnet px |
| **Gorging Leech** | +20% XP gained | `xpMul ×1.20` |
| **Reroll Rib** | +1 perk reroll each level | `rerollPerLevel +1` and +1 reroll immediately |
| **Brass Magazine** | 15% less ammo use, +20% ammo found | `ammoEff ×1.15`, `ammoPickupMul ×1.20` (the ×1.15 stays multiplicative; the **Scrap Feed** perk's additive stacks sit underneath it) |
| **Hollow Bones** | +12% move speed | `speedMul ×1.12` (178 → ~199 px/s at tier I) |

---

## Complete item index (A–Z)

| # | Item | Category |
|---|---|---|
| 1 | Acid Gland | On-hit proc |
| 2 | Backstabber | Shot modifier |
| 3 | Bloodlust | On-kill |
| 4 | Bloodshot Eye | Criticals |
| 5 | Bloat Rounds | Damage |
| 6 | Bone Plate | Survivability |
| 7 | Brass Magazine | Utility |
| 8 | Chain Sinew | On-hit proc |
| 9 | Crow Bait | Utility |
| 10 | Dead Man's Clock | Survivability |
| 11 | Dead Man's Switch | On-kill |
| 12 | Ember Jar | On-hit proc |
| 13 | Flayer Kiss | On-hit proc |
| 14 | Ghoul Heart | Survivability |
| 15 | Gorging Leech | Utility |
| 16 | Grafted Trigger | Fire rate |
| 17 | Hollow Bones | Utility |
| 18 | Hollow Needle | Criticals |
| 19 | Hollow Points | Damage |
| 20 | Homing Tumor | Shot modifier |
| 21 | Hook Rounds | On-hit proc |
| 22 | Hydra Maw | Shot modifier |
| 23 | Iron Stomach | Survivability |
| 24 | Lead Marrow | Shot modifier |
| 25 | Lucky Coin | Utility |
| 26 | Magnet Maw | Utility |
| 27 | Marrow Glut | Damage |
| 28 | Mortar Bone | On-hit proc |
| 29 | Orbit Crown | Utility |
| 30 | Orbital Knives | Utility |
| 31 | Piercing Gaze | Shot modifier |
| 32 | Reroll Rib | Utility |
| 33 | Ricochet Ribs | Shot modifier |
| 34 | Scalpel | Shot modifier |
| 35 | Second Stomach | Survivability |
| 36 | Sledge Rounds | On-hit proc |
| 37 | Spine Cage | Survivability |
| 38 | Spite Well | Survivability |
| 39 | Splinter Bone | Shot modifier |
| 40 | Split Tongue | Shot modifier |
| 41 | Tanned Hide | Survivability |
| 42 | Twin Hearts | Survivability |
| 43 | Twitch Fibers | Fire rate |
| 44 | Vampire Dentures | On-kill |
| 45 | Volatile Bile | On-kill |
| 46 | Worm Gut | Survivability |

## Synergy notes

- **Second Stomach** turns *every* healing source into shield generation: Worm Gut, Bone Knit, Vampire Dentures, Hemophage, and hearts at full HP.
- **On-hit procs scale with hit frequency** — pair Flayer Kiss / Ember Jar / Chain Sinew with the Ribcage Repeater, Bile Blunderbuss, or Cauterizer.
- **Split Tongue / Hydra Maw / Backstabber** multiply projectile count, which multiplies proc rolls per second — the core of most broken builds.
- **Piercing Gaze + Ricochet Ribs** feed the slam/saw/beam "inert" bonus (+6% each) on The Tenderizer, Red Right Hand, and Spinal Tap, while also powering Swarm Jar maggots.
- **Volatile Bile** chains: explosions can kill, which triggers more explosions (and frenzy, and lifesteal procs).
- **Bone Plate + Shield Heart** (perk) stack into a large shield that refills free every floor.
