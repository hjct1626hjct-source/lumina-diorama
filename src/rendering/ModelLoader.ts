import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createBotWToonMaterial, type BotWToonOptions } from './BotWToonShader';

export interface LoadedModelAsset {
  key: string;
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  size: THREE.Vector3;
}

export interface NormalizedInstance {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  clips: Map<string, THREE.AnimationClip>;
  currentAction: THREE.AnimationAction | null;
  playClip: (category: 'idle' | 'walk' | 'run' | 'attack' | 'jump' | 'die' | 'interact', crossFade?: number) => void;
  setMagnesisState: (state: number) => void;
  setStasisGlow: (glow: number) => void;
  materials: THREE.MeshToonMaterial[];
}

export const MODEL_CATALOG: Record<string, { url: string; targetHeight: number; metal?: boolean }> = {
  chest_wood: { url: './models/chest_wood.glb', targetHeight: 1.0, metal: false },
  chest_gold: { url: './models/chest_gold.glb', targetHeight: 1.05, metal: true },
  barrel: { url: './models/barrel.glb', targetHeight: 1.15, metal: false },
  crates: { url: './models/crates.glb', targetHeight: 1.4, metal: false },
  pillar: { url: './models/pillar.glb', targetHeight: 4.5, metal: false },
  wall_arched: { url: './models/wall_arched.glb', targetHeight: 4.2, metal: false },
  rubble: { url: './models/rubble.glb', targetHeight: 1.6, metal: false },
  torch: { url: './models/torch.glb', targetHeight: 2.1, metal: false },
  sword_shield: { url: './models/sword_shield.glb', targetHeight: 1.35, metal: true },
  npc_knight: { url: './models/npc_knight.glb', targetHeight: 1.82, metal: true },
  npc_rogue: { url: './models/npc_rogue.glb', targetHeight: 1.72, metal: false },
  npc_traveler: { url: './models/npc_traveler.glb', targetHeight: 1.74, metal: false },
  npc_mage: { url: './models/npc_mage.glb', targetHeight: 2.18, metal: false },
  npc_barbarian: { url: './models/npc_barbarian.glb', targetHeight: 1.92, metal: false },
  stal_warrior: { url: './models/stal_warrior.glb', targetHeight: 1.78, metal: false },
  stal_minion: { url: './models/stal_minion.glb', targetHeight: 1.60, metal: false },
  stal_mage: { url: './models/stal_mage.glb', targetHeight: 1.70, metal: false },
  horse: { url: './models/horse.glb', targetHeight: 1.95, metal: false },
  bird_stork: { url: './models/bird_stork.glb', targetHeight: 1.1, metal: false },
  bird_parrot: { url: './models/bird_parrot.glb', targetHeight: 0.7, metal: false },
  fox: { url: './models/fox.glb', targetHeight: 0.72, metal: false },
};

const CLIP_MATCHERS: Record<string, RegExp[]> = {
  idle: [/^idle$/i, /idle/i, /survey/i],
  walk: [/walking_a/i, /walk/i],
  run: [/running_a/i, /run/i, /horse/i, /fly/i, /parrot/i],
  attack: [/1h_melee_attack_slice/i, /attack/i, /chop/i, /spellcast/i],
  jump: [/jump/i],
  die: [/death_a$/i, /death/i, /die/i],
  interact: [/interact/i, /cheer/i, /wave/i],
};

/**
 * Unified GLB ModelLoader pipeline:
 * 1. Loads CC0/MIT .glb models from public/models/
 * 2. Measures Box3, normalizes scale to exact target height, and strictly grounds bottom at y = 0
 * 3. Converts every mesh material to custom BotW 3-step Toon Shader while preserving original albedo & normal textures
 * 4. Clones SkinnedMesh cleanly via SkeletonUtils and auto-binds AnimationMixer clips
 * 5. Automatically falls back if any network/parse error occurs (zero crashes!)
 */
export class ModelLoader {
  private loader = new GLTFLoader();
  private cache = new Map<string, Promise<LoadedModelAsset | null>>();
  private resolved = new Map<string, LoadedModelAsset>();

  async preload(keys: string[]): Promise<void> {
    await Promise.allSettled(keys.map((k) => this.load(k)));
  }

  async load(key: string): Promise<LoadedModelAsset | null> {
    const def = MODEL_CATALOG[key];
    if (!def) return null;

    if (!this.cache.has(key)) {
      const p = new Promise<LoadedModelAsset | null>((resolve) => {
        this.loader.load(
          def.url,
          (gltf: GLTF) => {
            const asset = this.normalizeLoadedGltf(key, gltf, def.targetHeight);
            this.resolved.set(key, asset);
            resolve(asset);
          },
          undefined,
          () => {
            // Silent graceful fallback to procedural high-detail models
            resolve(null);
          }
        );
      });
      this.cache.set(key, p);
    }
    return this.cache.get(key)!;
  }

  getCached(key: string): LoadedModelAsset | null {
    return this.resolved.get(key) ?? null;
  }

  private normalizeLoadedGltf(key: string, gltf: GLTF, targetHeight: number): LoadedModelAsset {
    const raw = gltf.scene;
    raw.updateMatrixWorld(true);

    // Measure bounding box before scaling
    const box = new THREE.Box3().setFromObject(raw);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const safeHeight = Math.max(size.y, 0.001);
    const scaleFactor = targetHeight / safeHeight;

    const wrapper = new THREE.Group();
    wrapper.name = `glb_${key}`;
    raw.scale.setScalar(scaleFactor);

    // Strictly ground bottom to y = 0 and center X/Z on pivot
    raw.position.set(
      -center.x * scaleFactor,
      -box.min.y * scaleFactor,
      -center.z * scaleFactor
    );
    wrapper.add(raw);
    wrapper.updateMatrixWorld(true);

    const normalizedBox = new THREE.Box3().setFromObject(wrapper);
    const normalizedSize = new THREE.Vector3();
    normalizedBox.getSize(normalizedSize);

    return {
      key,
      scene: wrapper,
      animations: gltf.animations ?? [],
      size: normalizedSize,
    };
  }

  /**
   * Instantiates a normalized GLB asset with BotW cel-shading applied to every mesh
   * and an auto-connected AnimationMixer for embedded AnimationClips.
   */
  instantiate(key: string, overrides: Partial<BotWToonOptions> & { scaleMultiplier?: number; tintColor?: THREE.ColorRepresentation } = {}): NormalizedInstance | null {
    const asset = this.resolved.get(key);
    if (!asset) return null;

    const def = MODEL_CATALOG[key];
    const cloned = SkeletonUtils.clone(asset.scene) as THREE.Group;
    if (overrides.scaleMultiplier && overrides.scaleMultiplier !== 1) {
      cloned.scale.multiplyScalar(overrides.scaleMultiplier);
    }

    const materials: THREE.MeshToonMaterial[] = [];
    const tint = overrides.tintColor ? new THREE.Color(overrides.tintColor) : null;

    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const convertOne = (origMat: THREE.Material): THREE.MeshToonMaterial => {
          const std = origMat as THREE.MeshStandardMaterial;
          const baseColor = std.color ? std.color.clone() : new THREE.Color(0xffffff);
          if (tint) baseColor.multiply(tint);

          const toonMat = createBotWToonMaterial({
            color: baseColor,
            map: std.map ?? null,
            normalMap: std.normalMap ?? null,
            emissive: std.emissive ? std.emissive.clone() : 0x000000,
            emissiveMap: std.emissiveMap ?? null,
            emissiveIntensity: std.emissiveIntensity ?? 1.0,
            transparent: std.transparent ?? false,
            opacity: std.opacity ?? 1.0,
            alphaTest: std.alphaTest ?? 0,
            vertexColors: !!mesh.geometry.attributes.color,
            metalHighlight: overrides.metalHighlight ?? def?.metal ?? false,
            rimStrength: overrides.rimStrength ?? 0.34,
            ...overrides,
          });
          materials.push(toonMat);
          return toonMat;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(convertOne);
        } else if (mesh.material) {
          mesh.material = convertOne(mesh.material);
        }
      }
    });

    const clips = new Map<string, THREE.AnimationClip>();
    for (const clip of asset.animations) {
      clips.set(clip.name, clip);
    }

    const mixer = asset.animations.length > 0 ? new THREE.AnimationMixer(cloned) : null;
    let currentAction: THREE.AnimationAction | null = null;

    const findBestClip = (category: string): THREE.AnimationClip | null => {
      const patterns = CLIP_MATCHERS[category] ?? [];
      for (const re of patterns) {
        for (const clip of asset.animations) {
          if (re.test(clip.name)) return clip;
        }
      }
      return asset.animations[0] ?? null;
    };

    const inst: NormalizedInstance = {
      root: cloned,
      mixer,
      clips,
      currentAction,
      materials,
      playClip(category, crossFade = 0.22) {
        if (!mixer || asset.animations.length === 0) return;
        const clip = findBestClip(category);
        if (!clip) return;
        const nextAction = mixer.clipAction(clip);
        if (inst.currentAction === nextAction) return;
        nextAction.reset();
        if (category === 'die') {
          nextAction.setLoop(THREE.LoopOnce, 1);
          nextAction.clampWhenFinished = true;
        } else {
          nextAction.setLoop(THREE.LoopRepeat, Infinity);
        }
        nextAction.play();
        if (inst.currentAction) {
          inst.currentAction.crossFadeTo(nextAction, crossFade, false);
        }
        inst.currentAction = nextAction;
      },
      setMagnesisState(state: number) {
        for (const m of materials) {
          if (m.userData.botwUniforms) {
            m.userData.botwUniforms.uMagnesisState.value = state;
          }
        }
      },
      setStasisGlow(glow: number) {
        for (const m of materials) {
          if (m.userData.botwUniforms) {
            m.userData.botwUniforms.uStasisGlow.value = glow;
          }
        }
      },
    };

    if (mixer) {
      inst.playClip('idle', 0);
    }

    return inst;
  }
}

export const modelLoader = new ModelLoader();
