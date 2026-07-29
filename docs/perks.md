# Perks

All **23 perks** in MeatSlicer, with exact effects pulled from `js/perks.js`. Perks are chosen through the **Mutation Draft** each time you level up, and last for the rest of the run.

---

## The Mutation Draft

- Gaining a level queues a draft. When it opens, you're offered **3 random perks** from the full pool — all 23 perks are equally weighted; there is no rarity system.
- Choose with **1 / 2 / 3**, by **clicking a card**, or press **4 / Space** for a "Random Cut".
- Press **R** to **reroll** all three choices (costs 1 reroll token). Rerolls come from the **Reroll Rib** item, which also grants +1 reroll every level-up.
- Press **T** to toggle **Auto-Draft**: future level-ups instantly pick a random perk without pausing the game. The setting persists between sessions.
- Level-ups queue: gain two levels at once and two drafts resolve back-to-back.

### XP curve

XP needed for the next level: **`8 + level × 4`**

| Level-up | XP needed | Cumulative |
|---|---|---|
| 1 → 2 | 12 | 12 |
| 2 → 3 | 16 | 28 |
| 3 → 4 | 20 | 48 |
| 4 → 5 | 24 | 72 |
| 5 → 6 | 28 | 100 |
| 10 → 11 | 48 | 300 |

XP comes from gems dropped by kills, room clears, and bosses, scaled by your `xpMul` (Gorging Leech item, Bloodrush perk).

---

## Offensive perks

| Perk | Description | Exact effect |
|---|---|---|
| **Sharpened** | +4% damage | `dmgMul ×1.04` |
| **Adrenal Surge** | +3.5% fire rate | `rateMul ×1.035` |
| **Deadeye** | +5% shot speed | `shotSpeedMul ×1.05` |
| **Long Bone** | +5% range | `rangeMul ×1.05` |
| **Bone Splitter** | +2% critical chance | `crit +0.02` (base 5%) |
| **Cold Precision** | +15% critical damage | `critMul +0.15` (base ×2.0) |
| **Heavy Hand** | +20% knockback | `knockbackMul ×1.20` |

## On-hit status perks

| Perk | Description | Exact effect |
|---|---|---|
| **Flensing Edge** | Hits inflict light bleeding | `bleed +0.08` — 2.2 s bleed at `hit damage × bleed × 0.45` DPS |
| **Ember Hands** | 8% chance to ignite | `igniteChance +0.08` — 1.8 s burn at `5 × dmgMul` DPS |
| **Chill Bile** | 10% chance to slow | `slowOnHit +0.10` — 1.5 s slow (halved move speed) |

## Defensive perks

| Perk | Description | Exact effect |
|---|---|---|
| **Big Heart** | +½ max heart, heal ½ heart | `maxHp +1`, heal 1 |
| **Shield Heart** | +½ shield heart at the start of each floor | `shieldPerk +1`, `shieldHp +1` — refills every floor transition |
| **Thick Hide** | +4% chance to ignore damage | `armor +1/24 (≈0.0417)` — block chance `armor / (1 + armor)`, cap 75% |
| **Second Wind** | +0.15s hurt immunity | `invBonus +0.15` — post-hit invulnerability 0.9 s → 1.05 s |
| **Spite Flesh** | Contact attackers take damage | `thorns +4` — melee attackers take `4 × dmgMul` |
| **Bone Knit** | 3% chance to heal ½ heart after combat rooms | `roomHealChance +0.03` (cap 90%) |

## Mobility & utility perks

| Perk | Description | Exact effect |
|---|---|---|
| **Quickening** | +3% move speed | `speedMul ×1.03` |
| **Sinew Weave** | +3% move speed and range | `speedMul ×1.03`, `rangeMul ×1.03` |
| **Magnet Bile** | +10% pickup radius | `magnet ×1.10` |
| **Carrion Sense** | +8% pickup radius and pull speed | `magnet ×1.08`, `magnetPull ×1.08` *(note: pull speed is not currently wired into pickup movement — the radius half works)* |
| **Scavenger** | +4% drop luck | `luck +0.04` |
| **Bloodrush** | +5% XP gain, bonus crystal chance | `xpMul ×1.05` |
| **Scrap Feed** | 5% less ammo consumed | `ammoEff ×1.05` |

---

## Complete perk index (A–Z)

| # | Perk | Category |
|---|---|---|
| 1 | Adrenal Surge | Offensive |
| 2 | Big Heart | Defensive |
| 3 | Bloodrush | Utility |
| 4 | Bone Knit | Defensive |
| 5 | Bone Splitter | Offensive |
| 6 | Carrion Sense | Utility |
| 7 | Chill Bile | On-hit |
| 8 | Cold Precision | Offensive |
| 9 | Deadeye | Offensive |
| 10 | Ember Hands | On-hit |
| 11 | Flensing Edge | On-hit |
| 12 | Heavy Hand | Offensive |
| 13 | Long Bone | Offensive |
| 14 | Magnet Bile | Utility |
| 15 | Quickening | Mobility |
| 16 | Scavenger | Utility |
| 17 | Scrap Feed | Utility |
| 18 | Second Wind | Defensive |
| 19 | Sharpened | Offensive |
| 20 | Shield Heart | Defensive |
| 21 | Sinew Weave | Mobility |
| 22 | Spite Flesh | Defensive |
| 23 | Thick Hide | Defensive |

## Drafting advice

- **Perks are small, items are big.** A perk is worth ~0.5 power score; an item tier is worth 1.0. Perks smooth out a build; items define it.
- **Shield Heart** is one of the strongest defensive picks — it's a free refilling shield pip every floor, and it stacks with Bone Plate.
- **Scavenger / Bloodrush / Magnet Bile** early compound over a long run; **Sharpened / Adrenal Surge** scale whatever your weapon already does well.
- With **Auto-Draft** on, perks become a no-attention background bonus — good for speedrunning floors, bad if you're fishing for a specific build.
