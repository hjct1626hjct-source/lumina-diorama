# Asset Credits & Open Licenses

All external 3D models (`.glb`) integrated into this project are open-license assets (`CC0 1.0 Universal` or `MIT`) loaded through `src/rendering/ModelLoader.ts`, automatically scale/ground normalized via `Box3`, and stylized uniformly with the custom BotW 3-step cel-shading shader (`src/rendering/BotWToonShader.ts`).

## 3D Models (`public/models/`)

### KayKit Dungeon Remastered 1.0 — CC0 1.0 Universal
- **Author**: Kay Lousberg ([KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0](https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0))
- **License**: Creative Commons Zero v1.0 Universal (CC0)
- **Files**:
  - `public/models/chest_wood.glb` (`chest.glb`)
  - `public/models/chest_gold.glb` (`chest_gold.glb`)
  - `public/models/barrel.glb` (`barrel_large_decorated.gltf.glb`)
  - `public/models/crates.glb` (`crates_stacked.gltf.glb`)
  - `public/models/pillar.glb` (`pillar_decorated.gltf.glb`)
  - `public/models/wall_arched.glb` (`wall_arched.gltf.glb`)
  - `public/models/rubble.glb` (`rubble_large.gltf.glb`)
  - `public/models/torch.glb` (`torch_lit.gltf.glb`)
  - `public/models/sword_shield.glb` (`sword_shield_gold.gltf.glb`)

### KayKit Character Pack: Adventurers 1.0 — CC0 1.0 Universal
- **Author**: Kay Lousberg ([KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0))
- **License**: Creative Commons Zero v1.0 Universal (CC0)
- **Files** (76 embedded skeletal animations each):
  - `public/models/npc_knight.glb` (`Knight.glb`)
  - `public/models/npc_rogue.glb` (`Rogue.glb`)
  - `public/models/npc_traveler.glb` (`Rogue_Hooded.glb`)
  - `public/models/npc_mage.glb` (`Mage.glb`)
  - `public/models/npc_barbarian.glb` (`Barbarian.glb`)

### KayKit Character Pack: Skeletons 1.0 — CC0 1.0 Universal
- **Author**: Kay Lousberg ([KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0))
- **License**: Creative Commons Zero v1.0 Universal (CC0)
- **Files** (95 embedded skeletal animations each):
  - `public/models/stal_warrior.glb` (`Skeleton_Warrior.glb`)
  - `public/models/stal_minion.glb` (`Skeleton_Minion.glb`)
  - `public/models/stal_mage.glb` (`Skeleton_Mage.glb`)

### Three.js Example Models — MIT / Public Domain (mirada / Rome)
- **Source**: [mrdoob/three.js](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf)
- **License**: MIT License
- **Files**:
  - `public/models/horse.glb` (`Horse.glb` — animated mount)
  - `public/models/bird_stork.glb` (`Stork.glb` — ambient Hyrule bird)
  - `public/models/bird_parrot.glb` (`Parrot.glb` — ambient tropical Faron bird)

### Khronos glTF Sample Assets — CC0 / CC-BY 4.0
- **Source**: [KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox)
- **Author**: PixelMannen (Tom) — CC0 / CC-BY 4.0
- **Files**:
  - `public/models/fox.glb` (`Fox.glb` — animated Hyrule wildlife with Survey/Walk/Run clips)

## Procedural Art, Textures & Audio
- All painterly watercolor/gouache terrain, architectural, Jomon Sheikah relief, armor, character face, and normal/roughness maps are procedurally synthesized at runtime via `CanvasRenderingContext2D` (`src/rendering/ProceduralTextures.ts`).
- All Open-Air ambient soundscapes, spatialized fauna/wind, dynamic piano/orchestral motifs, and combat/rune sound effects are synthesized via Web Audio API (`src/audio/OpenAirAudioEngine.ts`).

## Inspiration & Reference Note
This non-commercial web technical demonstration is inspired by *The Legend of Zelda: Breath of the Wild* (Nintendo) and references public technical talks (GDC 2017, CEDEC 2017) for physics/chemistry, level design, open-air audio, and cel-shaded rendering techniques.
