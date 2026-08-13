# Items

All **82 passive items** in MeatSlicer, with exact effects pulled from `js/items.js` and the proc logic in `js/enemies.js` / `js/player.js`.

---

## How items work

- Items are **passive and permanent** for the run. Pick one up and its effect applies immediately.
- **Duplicates upgrade the tier** (shown as Roman numerals on the pedestal and in your item tray). Each duplicate re-applies the item's effect — multiplicative stats compound, additive stats stack linearly.
- **Tier caps are per-item.** Simple stat items stack deep (up to VIII); build-defining and legendary items cap at III or I. Picking up a duplicate at cap instead grants +150 score and 5 XP gems with a "MAX" toast.
- **Every item has a rarity band** — Common, Uncommon, Rare, or Legendary — which drives both its drop weight and how much it inflates enemy scaling (see below).
- Item rolls use a "smart roll": a small chance to upgrade an item you already own (below cap), otherwise a weighted roll from the source's pool. Builds naturally specialize, but rares stay rare.

### Rarity bands

| Band | Base weight | Power/tier | Typical cap | Colour |
|---|---|---|---|---|
| Common | 100 | 0.5 | V–VIII | bone |
| Uncommon | 55 | 1.0 | IV–VI | teal |
| Rare | 25 | 1.5 | II–III | gold |
| Legendary | 8 | 3.0 | I | red |

**Power score** (drives enemy HP/speed scaling) = perks × 0.5 + Σ(item tier × band power). A deep stack of commons inflates difficulty far less than a few rares.

### Where items come from

| Source | Chance | Pool tilt |
|---|---|---|
| Item room pedestal | Guaranteed (1 per floor) | Favours Uncommon / Rare |
| Boss kill | Guaranteed (1 pedestal) | Favours Rare / **Legendary** (boss-only) |
| Elite enemy kill | 18% + luck × 10% | Favours Common |

Legendary items are **boss-exclusive** — they never roll from item rooms or elites. Items already at their tier cap are excluded from fresh rolls, so pedestals don't waste themselves.

---

## Damage & Fire Rate

| Item | Description | Exact effect per tier |
|---|---|---|
| **Hollow Points** | +25% damage | `dmgMul ×1.25` |
| **Marrow Glut** | +20% damage, −10% fire rate | `dmgMul ×1.20`, `rateMul ×0.90` |
| **Bloat Rounds** | +25% attack size, +10% damage | `sizeMul ×1.25`, `dmgMul ×1.10` |
| **Twitch Fibers** | +20% fire rate | `rateMul ×1.20` |
| **Grafted Trigger** | +18% fire rate, +6% shot speed | `rateMul ×1.18`, `shotSpeedMul ×1.06` |
| **Bonemeal Powder** | +15% damage, +15% shot speed | `dmgMul ×1.15`, `shotSpeedMul ×1.15` |
| **Marrow Piston** | +30% knockback, +12% attack size | `knockbackMul ×1.30`, `sizeMul ×1.12` |
| **Whipcord Tendon** | +20% range, +8% fire rate | `rangeMul ×1.20`, `rateMul ×1.08` |
| **Butcher's Twine** | +12% bleed, +8% fire rate | `bleed +0.12`, `rateMul ×1.08` |

Note: attack size (`sizeMul`) also enlarges melee arcs, blast radii, acid pools, and projectile hitboxes — Bloat Rounds is secretly an AoE item.

## Shot Modifiers

| Item | Description | Exact effect per tier |
|---|---|---|
| **Scalpel** | +25% shot speed | `shotSpeedMul ×1.25` |
| **Lead Marrow** | +25% range | `rangeMul ×1.25` |
| **Piercing Gaze** | Shots pierce +1 enemy | `pierce +1` |
| **Ricochet Ribs** | Shots bounce +1 time | `bounce +1` (wall bounces) |
| **Gyroscopic Ribs** | +2 bounce, +10% range | `bounce +2`, `rangeMul ×1.10` |
| **Split Cortex** | +1 pierce, +1 chain | `pierce +1`, `chain +1` — Rare hybrid projectile modifier |
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
| **Chill Gland** | 18% chance to chill | `+0.18` chance — slows enemies (activates the previously unused `slowOnHit` stat) |
| **Cinder Sump** | +12% ignite, +12% acid | `igniteChance +0.12`, `acidOnHit +0.12` — dual-element hybrid |
| **Dead Weight** | +40% damage to enemies under 30% HP | `executeBonus +0.40` — checked in `damageEnemy` |
| **Cauterized Veins** | +15% ignite, +25% damage to burning enemies | `igniteChance +0.15`, `burnDamageBonus +0.25` |
| **Hollow Choir** | Every 4th shot fires a free extra volley | `choirEvery +1` — fires a second `fireWeapon` every 4th trigger pull |
| **Sawbone Coil** | Expiring bullets split into 2 shards | `sawboneCoil +1` — on bullet expiry, spawns 2 shards at 40% damage |
| **Glutton's Gut** | Hearts heal +1 extra; overheal becomes score | `gluttonGut +1` — heart heal `2 + tier`, full-HP score `25 + tier × 10` |
| **Slaughter Rhythm** | +4% fire rate per recent kill (cap +40%) | `slaughterRhythm +0.04` — kills stamp `killStamps`; rate bonus decays after 3 s |
| **Pain Engine** | +30% damage for 4s after being hit | `painEngine +0.30` — `dmgLiveMul` rises while `painEngineT` is active |
| **Thresher Plate** | Passive contact-damage aura | `thresherPlate +1` — ticks `6 × tier × dmgMul` on nearby enemies every 0.4 s |
| **Blood Moat** | Kills leave an acid pool | `bloodMoat +1` — on kill, spawns an acid hazard at the corpse |
| **Iron Lung** | The first hit each room is blocked | `ironLung +1` — re-armed by `enterRoom`; blocks one hit with a 0.5 s i-frame |
| **Meat Hook** | Kills yank nearby enemies to the corpse | `meatHook +1` — on kill, nearby enemies are pulled toward the body |
| **Blood Debt** | +35% damage, −½ heart container | `dmgMul ×1.35`, `maxHp −1` — the Rare trade-off item |
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
| **Ghoul Heart** | +4 max HP, heal 4 | `maxHp +4`, heal 4 — a full 2 hearts |
| **Twin Hearts** | +1 max heart, heal to full | `maxHp +2`, `hp = maxHp` — the premium Rare HP item |
| **Rendered Fat** | +½ heart, +4% armor | `maxHp +1`, `armor +0.04`, heal 1 — clean hybrid HP/armor |
| **Gristle Cord** | +0.12s hurt immunity, +4% armor | `invBonus +0.12`, `armor +0.04` |
| **Bone Plate** | +½ shield heart each floor | `shieldPerk +1`, `shieldHp +1` — shields refill every floor (1 shield HP = ½ heart, renders as half a cyan pip) |
| **Second Stomach** | +½ heart and excess healing shields | `maxHp +1`, heal 1, `overShield +1` — overflow healing becomes shield HP |
| **Tanned Hide** | +8% chance to ignore damage | `armor +0.08` — literal dodge chance, cap 75% |
| **Dead Man's Clock** | +0.25s hurt immunity | `invBonus +0.25` — post-hit invulnerability 0.9 s → 1.15 s at tier I |
| **Worm Gut** | Heal ½ heart after combat rooms | `roomHeal +1` — guaranteed 1 HP heal after each combat room clear |
| **Spine Cage** | Contact attackers take damage | `thorns +8` — melee attackers take `8 × dmgMul` when they hurt you |
| **Spite Well** | Taking damage releases a blood nova | `retaliate +10` — on hit taken: nova radius 85 × √sizeMul, damage `10 × dmgMul` |

## Criticals

| Item | Description | Exact effect per tier |
|---|---|---|
| **Bloodshot Eye** | +6% critical chance | `crit +0.06` (base 5%) |
| **Hollow Needle** | +50% critical damage | `critMul +0.50` (base ×2.0) |

## Utility

| Item | Description | Exact effect per tier |
|---|---|---|
| **Orbital Knives** | +1 circling knife | `orbitals +1` — each knife orbits you, dealing `12 × dmgMul × orbDmgMul` on contact (0.35 s cooldown per enemy, half proc chance) |
| **Orbit Crown** | +25% orbital speed and damage | `orbSpeedMul ×1.25`, `orbDmgMul ×1.25` |
| **Lucky Coin** | Better drops | `luck +0.2` |
| **Crow Bait** | +15% drop luck, +25% pickup radius | `luck +0.15`, `magnet ×1.25` |
| **Magnet Maw** | +60% pickup radius | `magnet ×1.6` — magnet radius 46 × magnet px |
| **Gorging Leech** | +20% XP gained | `xpMul ×1.20` |
| **Reroll Rib** | +1 perk reroll each level | `rerollPerLevel +1` and +1 reroll immediately |
| **Brass Magazine** | +10% ammo efficiency, +20% ammo found | `ammoEff +0.10` (same diminishing additive formula as **Scrap Feed**, so the saving never reaches 50%), `ammoPickupMul ×1.20` |
| **Hollow Bones** | +14% move speed | `speedMul ×1.14` (178 → ~203 px/s at tier I) |
| **Gorged Tick** | +15% XP, +10% luck | `xpMul ×1.15`, `luck +0.10` |
| **Hooked Sinew** | +30% pickup pull speed, +10% radius | `magnetPull ×1.30`, `magnet ×1.10` (activates the `magnetPull` stat) |
| **Rusted Diadem** | +40% orbital speed | `orbSpeedMul ×1.40` |
| **Rimed Fang** | +4% crit chance, +25% crit damage | `crit +0.04`, `critMul +0.25` |

---

## Complete item index (A–Z)

| # | Item | Rarity | Cap | Category |
|---|---|---|---|---|
| 1 | Acid Gland | Uncommon | VI | On-hit proc |
| 2 | Backstabber | Rare | III | Shot modifier |
| 3 | Bloodlust | Common | V | On-kill |
| 4 | Bloodshot Eye | Common | VIII | Criticals |
| 5 | Bloat Rounds | Uncommon | V | Damage |
| 6 | Bone Plate | Rare | III | Survivability |
| 7 | Bonemeal Powder | Common | VI | Damage |
| 8 | Brass Magazine | Common | V | Utility |
| 9 | Butcher's Twine | Uncommon | V | Fire rate |
| 10 | Chain Sinew | Uncommon | VI | On-hit proc |
| 11 | Chill Gland | Uncommon | V | On-hit proc |
| 12 | Cinder Sump | Uncommon | V | On-hit proc |
| 13 | Crow Bait | Common | V | Utility |
| 14 | Dead Man's Clock | Rare | III | Survivability |
| 15 | Dead Man's Switch | Rare | III | On-kill |
| 16 | Ember Jar | Uncommon | V | On-hit proc |
| 17 | Flayer Kiss | Uncommon | V | On-hit proc |
| 18 | Ghoul Heart | Uncommon | V | Survivability |
| 19 | Gorged Tick | Common | V | Utility |
| 20 | Gorging Leech | Common | IV | Utility |
| 21 | Grafted Trigger | Common | VI | Fire rate |
| 22 | Gristle Cord | Uncommon | IV | Survivability |
| 23 | Gyroscopic Ribs | Uncommon | IV | Shot modifier |
| 24 | Hollow Bones | Common | VI | Utility |
| 25 | Hollow Needle | Common | VI | Criticals |
| 26 | Hollow Points | Common | VI | Damage |
| 27 | Homing Tumor | Uncommon | IV | Shot modifier |
| 28 | Hook Rounds | Uncommon | V | On-hit proc |
| 29 | Hooked Sinew | Common | V | Utility |
| 30 | Hydra Maw | Rare | III | Shot modifier |
| 31 | Iron Stomach | Common | VIII | Survivability |
| 32 | Lead Marrow | Common | VIII | Shot modifier |
| 33 | Lucky Coin | Common | V | Utility |
| 34 | Magnet Maw | Common | III | Utility |
| 35 | Marrow Glut | Uncommon | VI | Damage |
| 36 | Marrow Piston | Common | V | Damage |
| 37 | Mortar Bone | Uncommon | V | On-hit proc |
| 38 | Orbit Crown | Uncommon | V | Utility |
| 39 | Orbital Knives | Rare | III | Utility |
| 40 | Piercing Gaze | Uncommon | V | Shot modifier |
| 41 | Rendered Fat | Common | VI | Survivability |
| 42 | Reroll Rib | Rare | II | Utility |
| 43 | Ricochet Ribs | Uncommon | V | Shot modifier |
| 44 | Rimed Fang | Common | VI | Criticals |
| 45 | Rusted Diadem | Uncommon | V | Utility |
| 46 | Scalpel | Common | VIII | Shot modifier |
| 47 | Second Stomach | Rare | III | Survivability |
| 48 | Sledge Rounds | Uncommon | V | On-hit proc |
| 49 | Spine Cage | Uncommon | V | Survivability |
| 50 | Spite Well | Uncommon | V | Survivability |
| 51 | Split Cortex | Rare | III | Shot modifier |
| 52 | Splinter Bone | Rare | III | Shot modifier |
| 53 | Split Tongue | Rare | III | Shot modifier |
| 54 | Tanned Hide | Common | VI | Survivability |
| 55 | Twin Hearts | Rare | III | Survivability |
| 56 | Twitch Fibers | Common | VI | Fire rate |
| 57 | Vampire Dentures | Uncommon | V | On-kill |
| 58 | Volatile Bile | Rare | III | On-kill |
| 59 | Whipcord Tendon | Uncommon | V | Damage |
| 60 | Worm Gut | Rare | III | Survivability |
| 61 | Blood Debt | Rare | III | Damage |
| 62 | Blood Moat | Uncommon | IV | On-kill |
| 63 | Cauterized Veins | Uncommon | V | On-hit proc |
| 64 | Dead Weight | Uncommon | V | Damage |
| 65 | Glutton's Gut | Common | V | Survivability |
| 66 | Hollow Choir | Rare | III | Shot modifier |
| 67 | Iron Lung | Rare | III | Survivability |
| 68 | Meat Hook | Uncommon | IV | On-kill |
| 69 | Pain Engine | Rare | III | Damage |
| 70 | Sawbone Coil | Uncommon | V | Shot modifier |
| 71 | Slaughter Rhythm | Rare | III | Fire rate |
| 72 | Thresher Plate | Uncommon | V | Survivability |
| 73 | Abattoir Engine | Legendary | I | Utility |
| 74 | Butcher's Oath | Legendary | I | Damage |
| 75 | Crimson Metronome | Legendary | I | Fire rate |
| 76 | Gore Crown | Legendary | I | On-kill |
| 77 | Hollow Father | Legendary | I | Utility |
| 78 | Meat Grinder | Legendary | I | Survivability |
| 79 | Second Skin | Legendary | I | Survivability |
| 80 | The Last Cut | Legendary | I | Damage |
| 81 | Thousand Teeth | Legendary | I | Shot modifier |
| 82 | Twin Sidearm | Legendary | I | Shot modifier |

## Active items

Actives live in their own slot (separate from the passive tray) and are **charged by clearing rooms**: **+1 charge per combat room, +2 per boss**. Using an active spends all charges. Picking up a new active drops the old one with its remaining charges. Sources: 30% chance of a bonus pedestal on boss kills, 15% in item rooms. Use with **SPACE**.

| Active | Cost | Effect |
|---|---|---|
| Bone Nova | 2 | Damage ring + hard knockback around you |
| Offal Bomb | 1 | Lobs a gore bomb at the cursor |
| Blood Transfusion | 2 | Heal 2 hearts, lose 25% of current XP |
| Cleaver Storm | 2 | 12 orbiting cleavers shred on contact for 6 s |
| Butcher's Bell | 2 | Pull every enemy in and stun for 1 s |
| Marrow Draught | 3 | +100% fire rate and free ammo for 5 s |
| Slaughter Time | 3 | All enemies slowed to 25% speed for 5 s |
| Panic Room | 3 | 2.5 s invulnerable — but you can't fire |
| Skinner's Coin | 3 | Clear every enemy bullet into XP gems |
| Gut Reroll | 1 | Reroll the item pedestal you're standing on |

Holding an active contributes a flat **+2** to power score.

## Synergy notes

- **Second Stomach** turns *every* healing source into shield generation: Worm Gut, Bone Knit, Vampire Dentures, Hemophage, and hearts at full HP.
- **On-hit procs scale with hit frequency** — pair Flayer Kiss / Ember Jar / Chain Sinew with the Ribcage Repeater, Bile Blunderbuss, or Cauterizer.
- **Split Tongue / Hydra Maw / Backstabber** multiply projectile count, which multiplies proc rolls per second — the core of most broken builds.
- **Piercing Gaze + Ricochet Ribs** feed the slam/saw/beam "inert" bonus (+6% each) on The Tenderizer, Red Right Hand, and Spinal Tap, while also powering Swarm Jar maggots.
- **Volatile Bile** chains: explosions can kill, which triggers more explosions (and frenzy, and lifesteal procs).
- **Bone Plate + Shield Heart** (perk) stack into a large shield that refills free every floor.
