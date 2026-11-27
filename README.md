# THE LEGEND OF ZELDA: BREATH OF THE WILD — Web Open-Air 3D Edition

*The Legend of Zelda: Breath of the Wild* (Base Game + DLC Pack 1 *The Master Trials* + DLC Pack 2 *The Champions' Ballad*) recreated as a painterly cel-shaded 3D open-air WebGL2 web game built with **TypeScript + Vite + Three.js + Custom GLSL BotW Shaders + CC0/MIT GLB Assets + Web Audio API**.

---

## Key Architecture & Implemented Systems

### 1. Painterly BotW Custom Toon Visual Pipeline (`src/rendering/`)
- **Custom 3-Step Cel-Shaded BotW Toon Shader (`BotWToonShader.ts`)**: Quantized 3-step lighting (Highlight / Midtone / Cool Blue-Violet Shadow Tint), directional Fresnel backlight rim lighting, height-and-distance atmospheric scattering aerial perspective fog, cloud shadow dapple, animated orange → cyan Sheikah Jomon constellation circuits, and Magnesis/Stasis rune highlight overlays.
- **Triplanar Slope/Height/Biome Terrain Shader**: Zero UV stretching on sheer cliffs (>35° triplanar rock strata), multi-scale watercolor grass, snow peaks, rippled Gerudo desert sand, volcanic basalt & glowing lava cracks, wet shoreline sand, shimmering cel water, and 5,200+ wind-swaying InstancedMesh grass blades with player trample parting.
- **High-Resolution Procedural Watercolor Textures (`ProceduralTextures.ts`)**: 512×512 CanvasTextures + Sobel-derived NormalMaps for grass, cliffs, sand, snow, volcanic rock, Sheikah Jomon spiral relief + emissive circuits, stone masonry, wood planks, Champion's Tunic / Sheikah / Gerudo fabrics, and expressive anime hero face.
- **Unified GLB Model Pipeline (`ModelLoader.ts`)**: 21 CC0/MIT `.glb` models in `public/models/` (chests, barrels, crates, ruins, rigged & animated NPCs/travelers/warriors, Stal-skeletons, horses, foxes, birds) auto-normalized via `Box3`, strictly grounded at `y = 0`, auto-converted to the BotW 3-step toon shader with preserved textures, and auto-connected to `AnimationMixer` (see `CREDITS.md`).
- **Sculpted 6.5-Head Hero Rig (`LinkCharacterModel.ts`)**: Curved LatheGeometry torso/tunic/boots, Hylian pointed ears, layered swept golden hair, painted anime face, live armor swapping across 107 armor pieces + 15 Kochi Dye colors + naked/underwear state, hip Sheikah Slate, Master Sword, Hylian Shield, and deployable Paraglider.

### 2. Seamless 15-Region Hyrule Geography, Climate & Open-Air Audio (`src/world/`, `src/audio/`)
- **All 15 Sheikah Tower Regions** seamlessly streamed via LOD terrain chunks + permanent distant panorama skirt with strictly ordered highest peaks: **Gerudo Summit (800m) > Hebra Peak (750m) > Death Mountain (700m)**.
- **24-Real-Minute Day/Night Cycle & Regional Climate**: 3-hour weather forecast, zero rainfall in Gerudo Desert, real temperature calculation (`°C`/`°F`, cold/heat hazard tiers, extreme cold down to `-63°C`, freezing water, Eldin volcanic `ERROR`), precipitation/ash/Blood Moon embers, and 168-real-minute **Blood Moon** cycle.
- **CEDEC 2017 Open-Air Audio Engine (`OpenAirAudioEngine.ts`)**: 3-band wind, 6-cell hex spatialized insects, canopy birds, rain/thunder, volcanic rumble, sparse impressionistic solo piano field BGM, settlement/stable melodies, Guardian targeting frantic piano alarm, Blood Moon drone, and 20 procedural SFX.

### 3. Havok-Style Physics × GDC 2017 Chemistry Engine & Sheikah Runes (`src/physics/`, `src/gameplay/`)
- **3-Law Chemistry Engine**: 5 Elements (`Fire`, `Water`, `Ice`, `Wind`, `Electricity`) × 7 Materials (`Wood`, `Metal`, `Grass`, `Organic`, `Stone`, `WaterSurface`, `IceBlock`) — igniting dry grass spawns visible flames & rising **thermal updrafts** that lift Link's Paraglider!
- **All Sheikah Runes & Master Cycle Zero**: Magnesis (20m metal scan, beam, pendulum inertia, thunderstorm lightning rod, 2-stack Minecart Flying Machine), Remote Bombs Round & Square (`+` upgraded independent CDs, Windbomb BIL impulse), Stasis / Stasis+ (kinetic arrows, Stasis Overflow, enemy freeze), Cryonis (max 3 climbable ice pillars on water), Camera + Hyrule Compendium + Sheikah Sensor+, and **Master Cycle Zero** (1,000 unit tank, 2.777/s burn, exact paradoxical `min(1000, sum(base) * 2^n)` fuel math, Desert/Volcano summon ban).
- **Combat & Movement Physics**: Universal wall climbing (with rain slip), Paraglider, Shield Surfing (snow/sand/grass/rock friction), Swimming, midair Bow **Bullet-Time** (`1/19` world speed), Perfect Guard → Guardian Beam Reflection, Perfect Dodge → Flurry Rush, Sneakstrike (`8x`), exact BotW damage formula, Whistle Sprint, BTB, and all 4 Champions' Abilities.

### 4. Complete Lore, 23 Memories, 147 Quests, 107 Armors, Architecture, Enemies & NPC EventFlow (`src/data/`, `src/entities/`, `src/ui/`)
- **3-Layer Hyrule History Chronicle**, **All 23 Memories** (Base #1–#18 + DLC EX#1–#5), **15 Main / 42 Shrine / 90 Side Quests** (incl. Tarrey Town 110 wood + wedding, Zora Monuments 1–10, Koko's Kitchen 1–4, Kass's 8 songs, Stolen Heirloom), **8 Readable In-World Journals**, **DLC 1 Trial of the Sword (51 stages)** & **Master Mode**, and **DLC 2 Champions' Ballad** (16 shrines + Final Trial + Monk Maz Koshia).
- **107 Armor Pieces** (all base + DLC1 + DLC2 + Collab + Amiibo sets), 4-star Great Fairy upgrades, 15 Kochi Dye Shop colors, Gerudo Vai entry compatibility, and authentic BotW cooking (`+30s`/ingredient, Dragon Horn `+1800s`, Blood Moon 23:30–0:15 100% critical).
- **Hyrule Castle**, 15 Sheikah Towers, 136-Shrine Registry, 4 Kinematic Divine Beasts, 9 Architectural Settlements, 15 Circus-Tent Stables, 4 Great Fairy Fountains, 3 Goddess Springs, 3 Lomei Labyrinths, and 33 Korok Puzzle Archetypes.
- **LevelSensor** hidden enemy scaling, Blight Ganon HP formula (`800 → 1200 → 1600 → 2000`), 3 Sky Dragons (Dinraal, Naydra, Farosh), 24h/Rain autonomous NPC AI, 15 Traveling Merchants, 16 Roadside Disguised Yiga Travelers, and full EventFlow conditional dialogue (naked, fear armors, Gerudo gate, Blood Moon, rain).
- **Authentic BotW HUD & Sheikah Slate**: Quarter-hearts, circular green stamina wheel, circular minimap, purple sound waveform, thermometer, weather forecast, 3D rotating Link dress-up inventory preview, contour Sheikah Map with 5-color pins, Fast Travel, Hero's Path playback, and 100.00% Completion Tracker.

---

## Controls

| Key / Input | Action |
| --- | --- |
| `W A S D` / Arrow Keys | Camera-relative Movement / Climb / Swim / Ride |
| `Shift` | Sprint (Hold `V` + `Shift` for Whistle Sprint) |
| `Space` | Jump / Deploy Paraglider mid-air / Climb Jump |
| `Right Mouse Drag` / `Wheel` | Orbit 360° Camera / Zoom |
| `Left Click` / `F` | 4-Hit Sword Combo (or Snap Camera Photo) |
| `U` | Charged Spin Attack / Urbosa's Fury |
| `C` | Shield Guard / Perfect Guard (Guardian Beam Parry) |
| `R` (Hold & Release) | Bow Aim & Shoot (Mid-air enters 1/19 Bullet-Time!) |
| `Z` | ZL Target Lock-On |
| `X` | Shield Surfing |
| `G` | Revali's Gale (Vertical Updraft Launch) |
| `1` – `7` / `Q` | Select Sheikah Rune / Activate Rune |
| `[` / `]` | Quick Switch Weapon / Arrow Type Ribbon |
| `E` | Talk (NPC EventFlow) / Open Chest / Activate Tower / Shrine / Cook / Korok |
| `Tab` / `Esc` | Open Sheikah Slate Menu (Inventory 3D Preview, Map, Adventure Log, Compendium, Save) |
| `M` / `H` | Open Sheikah Map / Toggle Pro HUD |

---

## Development & Verification

```bash
npm install
npm run dev       # Start local Vite dev server
npm run build     # TypeScript strict check + Vite production build
npm test          # Run Vitest automated systems test suite
python3 tests/e2e_verify.py  # Run headless Chrome WebGL E2E & visual inspection capture
```
