import * as THREE from 'three';
import { createBotWToonMaterial } from '../rendering/BotWToonShader';
import { textureBank } from '../rendering/ProceduralTextures';
import { setInteriorEnvironmentOverride } from './TerrainGenerator';
import { PhysicsChemistryEngine, type PhysicsBody } from '../physics/PhysicsChemistryEngine';
import { computeBlightGanonHp } from '../entities/EnemyAndBossSystem';
import type { SaveSlotData } from '../types/botw';

export const DIVINE_BEAST_BASE_Y = 900;

export type DivineBeastId = 'vah_ruta' | 'vah_rudania' | 'vah_medoh' | 'vah_naboris';

export interface DivineBeastMeta {
  id: DivineBeastId;
  nameJa: string;
  nameEn: string;
  regionJa: string;
  blightSpecies: 'waterblight' | 'fireblight' | 'windblight' | 'thunderblight';
  blightNameJa: string;
  championKey: 'mipha' | 'daruk' | 'revali' | 'urbosa';
  championAbilityJa: string;
  poseTitleJa: string;
  poseOptions: string[];
  accentHex: string;
}

export const DIVINE_BEAST_METAS: Record<DivineBeastId, DivineBeastMeta> = {
  vah_ruta: {
    id: 'vah_ruta',
    nameJa: '水の神獣 ヴァ・ルッタ',
    nameEn: 'DIVINE BEAST VAH RUTA',
    regionJa: 'ラネール・東貯水湖',
    blightSpecies: 'waterblight',
    blightNameJa: '水のカースガノン',
    championKey: 'mipha',
    championAbilityJa: '英傑ミファーの祈り',
    poseTitleJa: '鼻の角度（水流制御）',
    poseOptions: ['低（水門開放）', '中（大水車駆動）', '高（上層放水）'],
    accentHex: '#2ee2ff',
  },
  vah_rudania: {
    id: 'vah_rudania',
    nameJa: '炎の神獣 ヴァ・ルーダニア',
    nameEn: 'DIVINE BEAST VAH RUDANIA',
    regionJa: 'オルディン・デスマウンテン',
    blightSpecies: 'fireblight',
    blightNameJa: '炎のカースガノン',
    championKey: 'daruk',
    championAbilityJa: '英傑ダルケルの護り',
    poseTitleJa: '胴体傾斜（90°横倒し）',
    poseOptions: ['水平（通常体勢）', '90°横倒し（側面回廊）'],
    accentHex: '#ff6c24',
  },
  vah_medoh: {
    id: 'vah_medoh',
    nameJa: '風の神獣 ヴァ・メドー',
    nameEn: 'DIVINE BEAST VAH MEDOH',
    regionJa: 'タバンタ・リト上空',
    blightSpecies: 'windblight',
    blightNameJa: '風のカースガノン',
    championKey: 'revali',
    championAbilityJa: '英傑リーバルの猛り',
    poseTitleJa: '両翼シーソー傾斜',
    poseOptions: ['左翼傾斜 (-18°)', '水平 (0°)', '右翼傾斜 (+18°)'],
    accentHex: '#7ce8ff',
  },
  vah_naboris: {
    id: 'vah_naboris',
    nameJa: '雷の神獣 ヴァ・ナボリス',
    nameEn: 'DIVINE BEAST VAH NABORIS',
    regionJa: 'ゲルド砂漠',
    blightSpecies: 'thunderblight',
    blightNameJa: '雷のカースガノン',
    championKey: 'urbosa',
    championAbilityJa: '英傑ウルボザの怒り',
    poseTitleJa: '3連円筒ドラム回転（送電回路接続）',
    poseOptions: ['前胴 +90°回転', '中胴 +90°回転', '後胴 +90°回転'],
    accentHex: '#ffe144',
  },
};

export interface DivineBeastInteractPrompt {
  id: string;
  kind: 'terminal' | 'mainUnit' | 'torch' | 'exit';
  label: string;
  distance: number;
}

interface BeastTerminal {
  id: string;
  labelJa: string;
  position: THREE.Vector3;
  activated: boolean;
  beaconMesh: THREE.Mesh;
  requiresPower?: boolean;
}

interface BeastTorch {
  id: string;
  position: THREE.Vector3;
  lit: boolean;
  flameMesh: THREE.Mesh;
}

interface BlightProjectile {
  id: string;
  kind: 'ice_block' | 'fireball' | 'laser' | 'tornado';
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  life: number;
  reflected?: boolean;
  physicsBody?: PhysicsBody;
}

export interface ActiveBlightBoss {
  beastId: DivineBeastId;
  species: DivineBeastMeta['blightSpecies'];
  nameJa: string;
  hp: number;
  maxHp: number;
  phase: 1 | 2;
  state: 'idle' | 'telegraph' | 'attack' | 'downed' | 'dead';
  timer: number;
  downedTimer: number;
  position: THREE.Vector3;
  mesh: THREE.Group;
  shieldActive: boolean;
  shieldMesh?: THREE.Mesh;
  bits: THREE.Mesh[];
  lightningRods: PhysicsBody[];
  phase2Triggered: boolean;
  teleportSteps: number;
}

export interface DivineBeastEnterResult {
  meta: DivineBeastMeta;
  spawnPos: THREE.Vector3;
  spawnYaw: number;
}

/**
 * Pure helper: grants canonical BotW rewards upon liberating a Divine Beast:
 * - Marks beastId in save.defeatedDivineBeasts
 * - Grants Heart Container (+1 maxHearts, full heal)
 * - Unlocks corresponding Champion's Ability with full charges
 * - Reports whether all 4 Divine Beasts are now freed (unlocking DLC 2 Plateau shrines)
 */
export function applyDivineBeastLiberationRewards(
  save: SaveSlotData,
  beastId: DivineBeastId
): {
  newlyFreed: boolean;
  allFourFreed: boolean;
  championAbilityJa: string;
  newMaxHearts: number;
} {
  const meta = DIVINE_BEAST_METAS[beastId];
  const already = save.defeatedDivineBeasts.includes(beastId) || save.defeatedDivineBeasts.includes(meta.blightSpecies);
  if (!already) {
    save.defeatedDivineBeasts.push(beastId);
    save.maxHearts = Math.min(30, save.maxHearts + 1);
    save.hearts = save.maxHearts;
  }
  const champ = save.champions[meta.championKey];
  champ.unlocked = true;
  champ.enabled = true;
  champ.charges = champ.maxCharges;
  champ.cooldown = 0;

  return {
    newlyFreed: !already,
    allFourFreed: save.defeatedDivineBeasts.length >= 4,
    championAbilityJa: meta.championAbilityJa,
    newMaxHearts: save.maxHearts,
  };
}

/**
 * Realized 3D Divine Beast Interior Dungeons & Unique Blight Ganon Boss Battle Engine:
 * - Isolated interior space at Y=900 with dedicated physics & terrain overrides
 * - 4 distinct dungeon structures & real-time Divine Beast pose controls (Trunk / 90° Tilt / Seesaw Wings / 3 Drums)
 * - 5 persistent control terminals per beast + Central Main Control Unit
 * - 4 bespoke Blight Ganon bosses with Phase 1 + Phase 2 (HP <= 50%) mechanics & Rune counterplay
 */
export class DivineBeastInteriorManager {
  public readonly group = new THREE.Group();
  public activeBeastId: DivineBeastId | null = null;
  public overworldReturnPos = new THREE.Vector3();
  public overworldReturnYaw = 0;

  // Pose state (unit-testable & UI-readable)
  public poseIndex = 0;
  public naborisDrumAngles: [number, number, number] = [90, 180, 270];
  public naborisCircuitConnected = false;
  public rudaniaTorchesLit = 0;

  public activeBoss: ActiveBlightBoss | null = null;
  public bossDefeatedInSession = false;

  private dungeonGroup = new THREE.Group();
  private physics: PhysicsChemistryEngine;
  private terminals: BeastTerminal[] = [];
  private torches: BeastTorch[] = [];
  private projectiles: BlightProjectile[] = [];
  private mainUnitPos = new THREE.Vector3(0, DIVINE_BEAST_BASE_Y, -26);
  private mainUnitBeacon: THREE.Mesh | null = null;
  private exitPos = new THREE.Vector3(0, DIVINE_BEAST_BASE_Y, 22);
  private lastSafePos = new THREE.Vector3(0, DIVINE_BEAST_BASE_Y, 19);

  private floorPatches: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; floorY: (x: number, z: number) => number }> = [];
  private waterZones: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; floorY: number; waterY: number }> = [];

  // Beast-specific animated refs
  private ambientLight: THREE.AmbientLight | null = null;
  private rutaBigWheel: PhysicsBody | null = null;
  private rutaSmallWheel: THREE.Group | null = null;
  private rutaTrunkStream: THREE.Mesh | null = null;
  private rutaSluiceGate: THREE.Group | null = null;
  private rutaSluiceOpen = false;
  private rutaWaterMesh: THREE.Mesh | null = null;

  private rudaniaTiltPivot: THREE.Group | null = null;
  private rudaniaTiltAngle = 0;
  private rudaniaMagBox: PhysicsBody | null = null;

  private medohWingPivot: THREE.Group | null = null;
  private medohWingAngle = 0;
  private medohGondola: PhysicsBody | null = null;
  private medohMetalBall: PhysicsBody | null = null;

  private naborisDrums: THREE.Group[] = [];
  private naborisCircuitStrip: THREE.Mesh | null = null;
  private naborisConductor: PhysicsBody | null = null;
  private naborisGateMesh: THREE.Mesh | null = null;
  private naborisGateOpen = false;

  private bossWaterMesh: THREE.Mesh | null = null;
  private dungeonTime = 0;

  private stoneMat!: THREE.MeshToonMaterial;
  private darkWallMat!: THREE.MeshToonMaterial;
  private cyanMat!: THREE.MeshToonMaterial;
  private amberMat!: THREE.MeshToonMaterial;
  private maliceMat!: THREE.MeshToonMaterial;
  private metalMat!: THREE.MeshToonMaterial;

  constructor(scene: THREE.Scene, physics: PhysicsChemistryEngine) {
    this.physics = physics;
    this.group.name = 'DivineBeastInteriorRoot';
    this.group.visible = false;
    this.group.add(this.dungeonGroup);
    scene.add(this.group);
    this.initMaterials();
  }

  private initMaterials(): void {
    const hasDom = typeof document !== 'undefined';
    const shTex = hasDom ? textureBank.getSheikahStoneTexture() : null;
    const stoneTex = hasDom ? textureBank.getStoneMasonryTexture('#5c524a', '#302a26') : null;
    this.stoneMat = createBotWToonMaterial({
      color: '#5a5046',
      map: stoneTex?.map,
      normalMap: stoneTex?.normalMap,
      rimStrength: 0.28,
    });
    this.darkWallMat = createBotWToonMaterial({
      color: '#2e2a2c',
      map: shTex?.map,
      emissive: '#382018',
      emissiveMap: shTex?.emissiveMap,
      emissiveIntensity: 0.45,
      rimStrength: 0.32,
    });
    this.cyanMat = createBotWToonMaterial({
      color: '#3ce6ff',
      emissive: '#1cc8ff',
      emissiveIntensity: 1.45,
    });
    this.amberMat = createBotWToonMaterial({
      color: '#ff9c2c',
      emissive: '#ff7018',
      emissiveIntensity: 1.35,
    });
    this.maliceMat = createBotWToonMaterial({
      color: '#340b1e',
      emissive: '#e8185a',
      emissiveIntensity: 1.35,
    });
    this.metalMat = createBotWToonMaterial({
      color: '#886c48',
      emissive: '#3a2210',
      emissiveIntensity: 0.35,
      metalHighlight: true,
    });
  }

  public isActive(): boolean {
    return this.activeBeastId !== null;
  }

  public getMeta(): DivineBeastMeta | null {
    return this.activeBeastId ? DIVINE_BEAST_METAS[this.activeBeastId] : null;
  }

  public getTerminalProgress(): { activated: number; total: number } {
    const activated = this.terminals.filter((t) => t.activated).length;
    return { activated, total: this.terminals.length || 5 };
  }

  public getPoseSummary(): { titleJa: string; currentLabel: string; options: string[]; poseIndex: number } | null {
    const meta = this.getMeta();
    if (!meta) return null;
    if (this.activeBeastId === 'vah_naboris') {
      const aligned = this.naborisCircuitConnected ? '全通電完了！' : `前${this.naborisDrumAngles[0]}° / 中${this.naborisDrumAngles[1]}° / 後${this.naborisDrumAngles[2]}°`;
      return {
        titleJa: meta.poseTitleJa,
        currentLabel: aligned,
        options: meta.poseOptions,
        poseIndex: this.poseIndex,
      };
    }
    return {
      titleJa: meta.poseTitleJa,
      currentLabel: meta.poseOptions[this.poseIndex] ?? meta.poseOptions[0],
      options: meta.poseOptions,
      poseIndex: this.poseIndex,
    };
  }

  public getSpawnPos(): THREE.Vector3 {
    return new THREE.Vector3(0, DIVINE_BEAST_BASE_Y, 19.0);
  }

  public enterBeast(
    beastId: DivineBeastId,
    save: SaveSlotData,
    overworldPos: THREE.Vector3,
    overworldYaw: number
  ): DivineBeastEnterResult {
    this.clearDungeonGeometry();
    this.activeBeastId = beastId;
    this.overworldReturnPos.copy(overworldPos);
    this.overworldReturnYaw = overworldYaw;
    this.dungeonTime = 0;
    this.poseIndex = beastId === 'vah_medoh' ? 1 : 0;
    this.naborisDrumAngles = [90, 180, 270];
    this.naborisCircuitConnected = false;
    this.rudaniaTorchesLit = 0;
    this.activeBoss = null;
    this.bossDefeatedInSession = false;

    this.physics.enterInteriorContext();
    setInteriorEnvironmentOverride({
      getFloorY: (x: number, z: number) => this.sampleInteriorFloorY(x, z),
      getWaterLevel: (x: number, z: number) => this.sampleInteriorWaterY(x, z),
    });

    const meta = DIVINE_BEAST_METAS[beastId];
    const savedTerms = save.divineBeastTerminals[beastId] ?? [];
    this.buildBaseHull(meta);
    this.buildBeastDungeon(beastId, savedTerms);
    this.syncMainUnitVisual();

    this.group.visible = true;
    const spawnPos = this.getSpawnPos();
    this.lastSafePos.copy(spawnPos);
    return { meta, spawnPos, spawnYaw: Math.PI };
  }

  public exitBeast(): { returnPos: THREE.Vector3; returnYaw: number } {
    this.clearDungeonGeometry();
    this.physics.exitInteriorContext();
    setInteriorEnvironmentOverride(null);
    this.group.visible = false;
    this.activeBeastId = null;
    return {
      returnPos: this.overworldReturnPos.clone(),
      returnYaw: this.overworldReturnYaw,
    };
  }

  private clearDungeonGeometry(): void {
    while (this.dungeonGroup.children.length > 0) {
      this.dungeonGroup.remove(this.dungeonGroup.children[0]);
    }
    this.terminals = [];
    this.torches = [];
    this.projectiles = [];
    this.floorPatches = [];
    this.waterZones = [];
    this.ambientLight = null;
    this.mainUnitBeacon = null;
    this.rutaBigWheel = null;
    this.rutaSmallWheel = null;
    this.rutaTrunkStream = null;
    this.rutaSluiceGate = null;
    this.rutaSluiceOpen = false;
    this.rutaWaterMesh = null;
    this.rudaniaTiltPivot = null;
    this.rudaniaTiltAngle = 0;
    this.rudaniaMagBox = null;
    this.medohWingPivot = null;
    this.medohWingAngle = 0;
    this.medohGondola = null;
    this.medohMetalBall = null;
    this.naborisDrums = [];
    this.naborisCircuitStrip = null;
    this.naborisConductor = null;
    this.naborisGateMesh = null;
    this.naborisGateOpen = false;
    this.bossWaterMesh = null;
    this.activeBoss = null;
  }

  private sampleInteriorFloorY(x: number, z: number): number {
    for (const p of this.floorPatches) {
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
        return p.floorY(x, z);
      }
    }
    for (const w of this.waterZones) {
      if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ) {
        return w.floorY;
      }
    }
    return DIVINE_BEAST_BASE_Y;
  }

  private sampleInteriorWaterY(x: number, z: number): number | null {
    for (const w of this.waterZones) {
      if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ) {
        return w.waterY;
      }
    }
    return null;
  }

  private addStaticBox(
    id: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    minY: number,
    maxY: number,
    mat: THREE.Material
  ): THREE.Mesh {
    const h = maxY - minY;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, h, depth), mat);
    mesh.position.set(x, minY + h * 0.5, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.dungeonGroup.add(mesh);
    this.physics.addBoxCollider(id, x, z, width, depth, minY, maxY, { climbable: true, walkableTop: true });
    return mesh;
  }

  private buildBaseHull(meta: DivineBeastMeta): void {
    const y0 = DIVINE_BEAST_BASE_Y;

    // Atmosphere lighting (Vah Rudania starts darkened until torches are lit!)
    const amb = new THREE.AmbientLight('#82a8c4', meta.id === 'vah_rudania' ? 0.22 : 0.88);
    this.ambientLight = amb;
    const key = new THREE.DirectionalLight('#ffe4b8', meta.id === 'vah_rudania' ? 0.35 : 0.85);
    key.position.set(10, y0 + 24, 14);
    const coreLight = new THREE.PointLight(meta.accentHex, 2.5, 36);
    coreLight.position.set(0, y0 + 7, -24);
    this.dungeonGroup.add(amb, key, coreLight);

    // Main base floor slab (56m wide x 64m long)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(56, 2.0, 66), this.stoneMat);
    floor.position.set(0, y0 - 1.0, -4);
    floor.receiveShadow = true;
    this.dungeonGroup.add(floor);

    // Perimeter hull walls (x: -28..28, z: -37..29)
    this.addStaticBox('db_wall_w', -28.5, -4, 1.8, 66, y0 - 4, y0 + 22, this.darkWallMat);
    this.addStaticBox('db_wall_e', 28.5, -4, 1.8, 66, y0 - 4, y0 + 22, this.darkWallMat);
    this.addStaticBox('db_wall_n', 0, -37.5, 58, 1.8, y0 - 4, y0 + 22, this.darkWallMat);
    this.addStaticBox('db_wall_s', 0, 29.5, 58, 1.8, y0 - 4, y0 + 22, this.darkWallMat);

    // Ancient ribs overhead
    for (let rz = -30; rz <= 22; rz += 13) {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(56, 1.5, 1.6), this.darkWallMat);
      arch.position.set(0, y0 + 21.5, rz);
      this.dungeonGroup.add(arch);
    }

    // Exit Warp Pad at (0, y0, 22)
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 0.24, 24), this.stoneMat);
    pad.position.set(this.exitPos.x, y0 + 0.1, this.exitPos.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.1, 8, 28), this.cyanMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(this.exitPos.x, y0 + 0.24, this.exitPos.z);
    this.dungeonGroup.add(pad, ring);

    // Central Main Control Unit at (0, y0, -26)
    const unitGrp = new THREE.Group();
    unitGrp.position.copy(this.mainUnitPos);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.0, 0.6, 10), this.darkWallMat);
    base.position.y = 0.3;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 2.2, 8), this.stoneMat);
    pillar.position.y = 1.4;
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), this.amberMat.clone());
    beacon.position.y = 3.2;
    unitGrp.add(base, pillar, beacon);
    this.dungeonGroup.add(unitGrp);
    this.mainUnitBeacon = beacon;
    this.physics.addCylinderCollider('db_main_unit', this.mainUnitPos.x, this.mainUnitPos.z, 1.5, y0, y0 + 3.2);
  }

  private addControlTerminal(
    id: string,
    labelJa: string,
    x: number,
    y: number,
    z: number,
    alreadyActivated: boolean,
    requiresPower = false
  ): void {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.35, 8), this.darkWallMat);
    ped.position.y = 0.675;
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.36, 0),
      (alreadyActivated ? this.cyanMat : this.amberMat).clone()
    );
    beacon.position.y = 1.95;
    grp.add(ped, beacon);
    this.dungeonGroup.add(grp);
    this.physics.addCylinderCollider(`db_term_${id}`, x, z, 0.95, y, y + 1.6);

    this.terminals.push({
      id,
      labelJa,
      position: new THREE.Vector3(x, y, z),
      activated: alreadyActivated,
      beaconMesh: beacon,
      requiresPower,
    });
  }

  private addDynamicBody(
    id: string,
    labelJa: string,
    mesh: THREE.Group,
    pos: THREE.Vector3,
    opts: {
      mass: number;
      radius: number;
      halfWidth?: number;
      halfDepth?: number;
      halfHeight: number;
      material: PhysicsBody['material'];
      isStatic: boolean;
      stasisInteractable?: boolean;
      isPlatform?: boolean;
      isMetalBox?: boolean;
      highlightMesh?: THREE.Mesh;
    }
  ): PhysicsBody {
    const body: PhysicsBody = {
      id,
      labelJa,
      mesh,
      position: pos.clone(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      mass: opts.mass,
      radius: opts.radius,
      halfWidth: opts.halfWidth,
      halfDepth: opts.halfDepth,
      halfHeight: opts.halfHeight,
      rotY: 0,
      material: opts.material,
      isStatic: opts.isStatic,
      stasisInteractable: opts.stasisInteractable,
      isPlatform: opts.isPlatform,
      isMetalBox: opts.isMetalBox,
      isBurning: false,
      burnTimer: 0,
      isElectrified: false,
      shockTimer: 0,
      isFrozenStasis: false,
      stasisTimer: 0,
      stasisHits: 0,
      stasisAccumImpulse: new THREE.Vector3(),
      magnesisGrabbed: false,
      buoyant: false,
      grounded: true,
      onStasisVisual: (glow) => {
        if (opts.highlightMesh) {
          const mat = opts.highlightMesh.material as THREE.MeshToonMaterial;
          if (mat.emissive) {
            mat.emissive.set(glow > 0 ? '#ffe030' : '#2a1a10');
            mat.emissiveIntensity = glow > 0 ? 1.2 : 0.35;
          }
        }
      },
      onMagnesisHighlight: (state) => {
        if (opts.highlightMesh) {
          const mat = opts.highlightMesh.material as THREE.MeshToonMaterial;
          if (mat.emissive) {
            if (state === 2) {
              mat.emissive.set('#ffdf38');
              mat.emissiveIntensity = 1.4;
            } else if (state === 1) {
              mat.emissive.set('#ff3b48');
              mat.emissiveIntensity = 0.9;
            } else {
              mat.emissive.set('#3a2210');
              mat.emissiveIntensity = 0.35;
            }
          }
        }
      },
    };
    this.physics.addBody(body);
    return body;
  }

  private buildBeastDungeon(beastId: DivineBeastId, savedTerms: string[]): void {
    const y0 = DIVINE_BEAST_BASE_Y;
    const has = (id: string) => savedTerms.includes(id);

    if (beastId === 'vah_ruta') {
      // Water Basin across lower hall + Upper Deck on North/East
      this.waterZones.push({ minX: -14, maxX: 14, minZ: -6, maxZ: 14, floorY: y0 - 0.6, waterY: y0 + 0.3 });
      const waterMat = createBotWToonMaterial({ color: '#1ea6d8', emissive: '#0c527a', emissiveIntensity: 0.45, transparent: true, opacity: 0.72 });
      const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(28, 20), waterMat);
      waterMesh.rotation.x = -Math.PI / 2;
      waterMesh.position.set(0, y0 + 0.3, 4);
      this.dungeonGroup.add(waterMesh);
      this.rutaWaterMesh = waterMesh;

      // Upper Deck + Stairs on East & West
      this.addStaticBox('ruta_deck_e', 19, -4, 14, 34, y0, y0 + 4.5, this.stoneMat);
      this.addStaticBox('ruta_deck_w', -19, -4, 14, 34, y0, y0 + 4.5, this.stoneMat);
      this.addStaticBox('ruta_ramp_e', 16, 15.5, 6, 6, y0, y0 + 2.2, this.stoneMat);
      this.addStaticBox('ruta_ramp_w', -16, 15.5, 6, 6, y0, y0 + 2.2, this.stoneMat);

      // Large Rotating Waterwheel (Stasis-freezable!)
      const bigWheelGrp = new THREE.Group();
      const bigRim = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.55, 8, 20), this.stoneMat.clone());
      bigWheelGrp.add(bigRim);
      for (let i = 0; i < 6; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.0, 1.4), this.metalMat);
        spoke.rotation.z = (i * Math.PI) / 3;
        bigWheelGrp.add(spoke);
      }
      bigWheelGrp.position.set(0, y0 + 5.2, 4.0);
      this.dungeonGroup.add(bigWheelGrp);
      this.rutaBigWheel = this.addDynamicBody('ruta_big_wheel', '大水車（ビタロックで停止可能）', bigWheelGrp, new THREE.Vector3(0, y0 + 5.2, 4.0), {
        mass: 999,
        radius: 4.8,
        halfHeight: 4.8,
        material: 'Stone',
        isStatic: true,
        stasisInteractable: true,
        highlightMesh: bigRim,
      });

      // Small Waterwheel on West Side
      const smallWheelGrp = new THREE.Group();
      smallWheelGrp.add(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.35, 8, 16), this.cyanMat));
      smallWheelGrp.position.set(-12.5, y0 + 3.4, -2.0);
      this.dungeonGroup.add(smallWheelGrp);
      this.rutaSmallWheel = smallWheelGrp;

      // Trunk Water Jet Stream (shifts Z/Y with Pose 0/1/2!)
      const stream = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 1.1, 12, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: '#58e8ff', transparent: true, opacity: 0.55, depthWrite: false })
      );
      stream.position.set(0, y0 + 9.5, 4.0);
      this.dungeonGroup.add(stream);
      this.rutaTrunkStream = stream;

      // Cryonis-liftable Sluice Gate guarding Terminal t3 at (x=-19, z=-15)
      const gateGrp = new THREE.Group();
      const gateMesh = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.2, 0.8), this.metalMat);
      gateMesh.position.y = 2.1;
      gateGrp.add(gateMesh);
      gateGrp.position.set(0, y0 + 0.3, -5.8);
      this.dungeonGroup.add(gateGrp);
      this.rutaSluiceGate = gateGrp;
      this.physics.addBoxCollider('ruta_sluice_gate', 0, -5.8, 5.6, 0.9, y0, y0 + 4.4);

      this.addControlTerminal('t1', '制御端末 1（下層貯水ホール）', 8.5, y0, 11.5, has('t1'));
      this.addControlTerminal('t2', '制御端末 2（西側・小水車横）', -18.5, y0 + 4.5, 4.0, has('t2'));
      this.addControlTerminal('t3', '制御端末 3（水門奥・アイスメイカー）', 0, y0, -10.5, has('t3'));
      this.addControlTerminal('t4', '制御端末 4（東側・大水車上層デッキ）', 18.5, y0 + 4.5, -6.0, has('t4'));
      this.addControlTerminal('t5', '制御端末 5（鼻先端・放水デッキ）', 18.5, y0 + 4.5, -18.0, has('t5'));
      return;
    }

    if (beastId === 'vah_rudania') {
      // Darkened interior with Blue Flame Torches + 90-degree Tiltable Interior Corridor
      const pivot = new THREE.Group();
      pivot.position.set(0, y0 + 6, -4);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(34, 1.2, 46), this.darkWallMat);
      rib.position.set(0, 8, 0);
      pivot.add(rib);
      this.dungeonGroup.add(pivot);
      this.rudaniaTiltPivot = pivot;

      // Elevated side galleries (accessible cleanly when Pose 1 tilts Rudania 90°!)
      this.addStaticBox('rud_gallery_e', 17, -4, 12, 36, y0, y0 + 3.6, this.stoneMat);
      this.addStaticBox('rud_gallery_w', -17, -4, 12, 36, y0, y0 + 3.6, this.stoneMat);
      this.addStaticBox('rud_ramp_center', 0, 6, 8, 12, y0, y0 + 1.8, this.stoneMat);

      // 3 Interior Blue-Flame Torches (lighting them brightens the darkened hall!)
      for (const [tid, tx, tz] of [
        ['rud_t1', -6.5, 14.0] as const,
        ['rud_t2', 6.5, 14.0] as const,
        ['rud_t3', 0, -4.0] as const,
      ]) {
        const tGrp = new THREE.Group();
        tGrp.position.set(tx, y0, tz);
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 1.6, 8), this.darkWallMat);
        stand.position.y = 0.8;
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.9, 8), this.cyanMat);
        flame.position.y = 2.05;
        flame.visible = false;
        tGrp.add(stand, flame);
        this.dungeonGroup.add(tGrp);
        this.torches.push({ id: tid, position: new THREE.Vector3(tx, y0, tz), lit: false, flameMesh: flame });
      }

      // Magnesis Iron Cube on central corridor
      const boxGrp = new THREE.Group();
      const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), this.metalMat.clone());
      boxMesh.position.y = 1.1;
      boxGrp.add(boxMesh);
      boxGrp.position.set(-4.5, y0, -2.0);
      this.dungeonGroup.add(boxGrp);
      this.rudaniaMagBox = this.addDynamicBody('rudania_mag_box', '鉄のブロック（マグネキャッチ）', boxGrp, new THREE.Vector3(-4.5, y0, -2.0), {
        mass: 4.5,
        radius: 1.4,
        halfWidth: 1.1,
        halfDepth: 1.1,
        halfHeight: 1.1,
        material: 'Metal',
        isStatic: false,
        isMetalBox: true,
        isPlatform: true,
        highlightMesh: boxMesh,
      });

      this.addControlTerminal('t1', '制御端末 1（暗闇の入口ホール）', -9.0, y0, 12.0, has('t1'));
      this.addControlTerminal('t2', '制御端末 2（青い炎の祭壇）', 9.0, y0, 4.0, has('t2'));
      this.addControlTerminal('t3', '制御端末 3（西側面・90°傾斜回廊）', -17.0, y0 + 3.6, -4.0, has('t3'));
      this.addControlTerminal('t4', '制御端末 4（東側面・鉄箱の奥）', 17.0, y0 + 3.6, -10.0, has('t4'));
      this.addControlTerminal('t5', '制御端末 5（背びれ最奥デッキ）', 0, y0, -16.0, has('t5'));
      return;
    }

    if (beastId === 'vah_medoh') {
      // Central Hall + Seesaw Left & Right Wing Decks + Wind Updraft Columns
      const wingPivot = new THREE.Group();
      wingPivot.position.set(0, y0 + 2.5, -4);
      const wingBar = new THREE.Mesh(new THREE.BoxGeometry(46, 0.8, 12), this.stoneMat);
      wingPivot.add(wingBar);
      this.dungeonGroup.add(wingPivot);
      this.medohWingPivot = wingPivot;

      // Left & Right Wing Walkable Decks
      this.addStaticBox('medoh_wing_l', -18.5, -4, 15, 24, y0, y0 + 4.2, this.stoneMat);
      this.addStaticBox('medoh_wing_r', 18.5, -4, 15, 24, y0, y0 + 4.2, this.stoneMat);

      // Persistent Wind Updraft Ducts so Link can Paraglide onto both Wings!
      this.physics.spawnFireUpdraft(new THREE.Vector3(-8.5, y0, 6.0), 4.2, 22, 9999);
      this.physics.spawnFireUpdraft(new THREE.Vector3(8.5, y0, 6.0), 4.2, 22, 9999);
      this.physics.spawnFireUpdraft(new THREE.Vector3(0, y0, -8.0), 4.8, 24, 9999);

      // Sliding Gondola + Heavy Metal Ball driven by Wing Seesaw Tilt
      const gonGrp = new THREE.Group();
      const gonMesh = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 4.2), this.metalMat.clone());
      gonMesh.position.y = 0.25;
      gonGrp.add(gonMesh);
      gonGrp.position.set(0, y0 + 0.1, -1.0);
      this.dungeonGroup.add(gonGrp);
      this.medohGondola = this.addDynamicBody('medoh_gondola', '傾斜ゴンドラ', gonGrp, new THREE.Vector3(0, y0 + 0.1, -1.0), {
        mass: 8,
        radius: 2.2,
        halfWidth: 2.1,
        halfDepth: 2.1,
        halfHeight: 0.25,
        material: 'Metal',
        isStatic: false,
        isPlatform: true,
        isMetalBox: true,
        highlightMesh: gonMesh,
      });

      const ballGrp = new THREE.Group();
      const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), this.metalMat.clone());
      ballMesh.position.y = 1.1;
      ballGrp.add(ballMesh);
      ballGrp.position.set(0, y0, -11.0);
      this.dungeonGroup.add(ballGrp);
      this.medohMetalBall = this.addDynamicBody('medoh_ball', '鉄球（翼傾斜でスライド）', ballGrp, new THREE.Vector3(0, y0, -11.0), {
        mass: 5,
        radius: 1.1,
        halfHeight: 1.1,
        material: 'Metal',
        isStatic: false,
        isMetalBox: true,
        highlightMesh: ballMesh,
      });

      this.addControlTerminal('t1', '制御端末 1（中央気流ホール）', 0, y0, 10.0, has('t1'));
      this.addControlTerminal('t2', '制御端末 2（左翼・ゴンドラ先）', -18.5, y0 + 4.2, 4.0, has('t2'));
      this.addControlTerminal('t3', '制御端末 3（左翼先端デッキ）', -18.5, y0 + 4.2, -12.0, has('t3'));
      this.addControlTerminal('t4', '制御端末 4（右翼・気流ダクト上）', 18.5, y0 + 4.2, 4.0, has('t4'));
      this.addControlTerminal('t5', '制御端末 5（右翼最奥デッキ）', 18.5, y0 + 4.2, -12.0, has('t5'));
      return;
    }

    // 4. Vah Naboris — 3 Rotating Cylindrical Drums + Green Power Circuit + Magnesis Conductor Block
    const drumZs = [7.0, -3.5, -14.0];
    this.naborisDrums = [];
    for (let i = 0; i < 3; i++) {
      const dGrp = new THREE.Group();
      dGrp.position.set(0, y0 + 6.5, drumZs[i]);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(6.8, 0.65, 8, 24), this.darkWallMat);
      const wire = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.4, 8.2),
        createBotWToonMaterial({ color: '#42ff88', emissive: '#22e068', emissiveIntensity: 1.4 })
      );
      wire.position.set(0, 6.8, 0);
      dGrp.add(ring, wire);
      dGrp.rotation.z = THREE.MathUtils.degToRad(this.naborisDrumAngles[i]);
      this.dungeonGroup.add(dGrp);
      this.naborisDrums.push(dGrp);
    }

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.14, 34),
      createBotWToonMaterial({ color: '#2b3a30', emissive: '#102218', emissiveIntensity: 0.4 })
    );
    strip.position.set(0, y0 + 0.08, -4.0);
    this.dungeonGroup.add(strip);
    this.naborisCircuitStrip = strip;

    // Magnesis Metal Conductor Block to bridge side electrodes
    const condGrp = new THREE.Group();
    const condMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 2.0), this.metalMat.clone());
    condMesh.position.y = 1.0;
    condGrp.add(condMesh);
    condGrp.position.set(11.0, y0, 4.0);
    this.dungeonGroup.add(condGrp);
    this.naborisConductor = this.addDynamicBody('naboris_conductor', '金属の通電ブロック（マグネキャッチ）', condGrp, new THREE.Vector3(11.0, y0, 4.0), {
      mass: 4.0,
      radius: 1.3,
      halfWidth: 1.0,
      halfDepth: 1.0,
      halfHeight: 1.0,
      material: 'Metal',
      isStatic: false,
      isMetalBox: true,
      highlightMesh: condMesh,
    });

    // Rear sanctum gate unlocked when all 3 drums align to 0°!
    const nGate = new THREE.Mesh(new THREE.BoxGeometry(10.0, 5.0, 0.8), this.amberMat.clone());
    nGate.position.set(0, y0 + 2.5, -18.5);
    this.dungeonGroup.add(nGate);
    this.naborisGateMesh = nGate;
    this.physics.addBoxCollider('naboris_power_gate', 0, -18.5, 10.0, 0.9, y0, y0 + 5.0);

    this.addStaticBox('nab_side_w', -18, -4, 10, 32, y0, y0 + 3.2, this.stoneMat);
    this.addStaticBox('nab_side_e', 18, -4, 10, 32, y0, y0 + 3.2, this.stoneMat);

    this.addControlTerminal('t1', '制御端末 1（前胴ドラム入口）', -8.5, y0, 12.0, has('t1'));
    this.addControlTerminal('t2', '制御端末 2（西側・前胴デッキ）', -18.0, y0 + 3.2, 5.0, has('t2'));
    this.addControlTerminal('t3', '制御端末 3（中胴ドラム上部）', -18.0, y0 + 3.2, -10.0, has('t3'));
    this.addControlTerminal('t4', '制御端末 4（東側・通電電極室）', 18.0, y0 + 3.2, -4.0, has('t4'));
    this.addControlTerminal('t5', '制御端末 5（後胴・送電完了ゲート奥）', 0, y0, -21.5, has('t5'), true);
  }

  /**
   * Real-time Divine Beast Pose Control (Trunk / 90° Tilt / Seesaw Wings / 3 Cylindrical Drums).
   */
  public applyPoseAction(optionIndex: number): string {
    const meta = this.getMeta();
    if (!meta || !this.activeBeastId) return '';

    if (this.activeBeastId === 'vah_ruta') {
      this.poseIndex = ((optionIndex % 3) + 3) % 3;
      const y0 = DIVINE_BEAST_BASE_Y;
      if (this.rutaTrunkStream) {
        this.rutaTrunkStream.position.z = this.poseIndex === 0 ? -5.0 : this.poseIndex === 1 ? 4.0 : 10.5;
      }
      if (this.waterZones[0] && this.rutaWaterMesh) {
        const targetWaterY = this.poseIndex === 0 ? y0 + 0.65 : this.poseIndex === 1 ? y0 + 0.3 : y0 + 0.1;
        this.waterZones[0].waterY = targetWaterY;
        this.rutaWaterMesh.position.y = targetWaterY;
      }
      return `🐘 ヴァ・ルッタの鼻を【${meta.poseOptions[this.poseIndex]}】へ動かした！`;
    }

    if (this.activeBeastId === 'vah_rudania') {
      this.poseIndex = optionIndex % 2;
      if (this.rudaniaMagBox && !this.rudaniaMagBox.magnesisGrabbed) {
        this.rudaniaMagBox.velocity.x += this.poseIndex === 1 ? 10.5 : -10.5;
      }
      return `🦎 ヴァ・ルーダニアの胴体を【${meta.poseOptions[this.poseIndex]}】へ傾けた！`;
    }

    if (this.activeBeastId === 'vah_medoh') {
      this.poseIndex = Math.max(0, Math.min(2, optionIndex));
      const tiltDir = this.poseIndex === 0 ? -1 : this.poseIndex === 2 ? 1 : 0;
      if (this.medohGondola && !this.medohGondola.magnesisGrabbed) {
        this.medohGondola.velocity.x = tiltDir * 9.5;
      }
      if (this.medohMetalBall && !this.medohMetalBall.magnesisGrabbed) {
        this.medohMetalBall.velocity.x = tiltDir * 12.0;
      }
      return `🦅 ヴァ・メドーの両翼を【${meta.poseOptions[this.poseIndex]}】へ傾けた！`;
    }

    // Vah Naboris: rotate drum 0 / 1 / 2 by +90°
    const drumIdx = ((optionIndex % 3) + 3) % 3;
    this.poseIndex = drumIdx;
    this.naborisDrumAngles[drumIdx] = (this.naborisDrumAngles[drumIdx] + 90) % 360;
    const drum = this.naborisDrums[drumIdx];
    if (drum) {
      drum.rotation.z = THREE.MathUtils.degToRad(this.naborisDrumAngles[drumIdx]);
    }
    this.checkNaborisCircuit();
    return `🐪 ヴァ・ナボリス【${meta.poseOptions[drumIdx]}】実行（角度: ${this.naborisDrumAngles.join('° / ')}°）${
      this.naborisCircuitConnected ? ' ⚡ 送電回路が完全に繋がった！' : ''
    }`;
  }

  public cyclePose(): string {
    if (!this.activeBeastId) return '';
    const meta = DIVINE_BEAST_METAS[this.activeBeastId];
    return this.applyPoseAction((this.poseIndex + 1) % meta.poseOptions.length);
  }

  private checkNaborisCircuit(): void {
    const aligned =
      this.naborisDrumAngles[0] === 0 &&
      this.naborisDrumAngles[1] === 0 &&
      this.naborisDrumAngles[2] === 0;
    this.naborisCircuitConnected = aligned;
    if (this.naborisCircuitStrip) {
      const mat = this.naborisCircuitStrip.material as THREE.MeshToonMaterial;
      mat.color.set(aligned ? '#42ff88' : '#2b3a30');
      mat.emissive.set(aligned ? '#22e86c' : '#102218');
      mat.emissiveIntensity = aligned ? 1.5 : 0.4;
    }
    if (aligned && !this.naborisGateOpen && this.naborisGateMesh) {
      this.naborisGateOpen = true;
      this.naborisGateMesh.visible = false;
      this.physics.removeCollider('naboris_power_gate');
    }
  }

  public activateTerminal(termId: string, save: SaveSlotData): { ok: boolean; allActivated: boolean; messageJa: string } {
    if (!this.activeBeastId) return { ok: false, allActivated: false, messageJa: '' };
    const term = this.terminals.find((t) => t.id === termId);
    if (!term) return { ok: false, allActivated: false, messageJa: '' };
    if (term.activated) return { ok: false, allActivated: this.areAllTerminalsActivated(), messageJa: 'この制御端末はすでに起動済みです' };
    if (term.requiresPower && !this.naborisCircuitConnected) {
      return { ok: false, allActivated: false, messageJa: '送電回路が繋がっていません！神獣操作で3連ドラムを揃えよう' };
    }
    term.activated = true;
    (term.beaconMesh.material as THREE.MeshToonMaterial).color.set('#3ce6ff');
    (term.beaconMesh.material as THREE.MeshToonMaterial).emissive.set('#1cc8ff');

    if (!save.divineBeastTerminals[this.activeBeastId]) {
      save.divineBeastTerminals[this.activeBeastId] = [];
    }
    if (!save.divineBeastTerminals[this.activeBeastId].includes(term.id)) {
      save.divineBeastTerminals[this.activeBeastId].push(term.id);
    }

    this.syncMainUnitVisual();
    const prog = this.getTerminalProgress();
    const allDone = prog.activated >= prog.total;
    return {
      ok: true,
      allActivated: allDone,
      messageJa: allDone
        ? `🔷 制御端末 ${prog.activated}/${prog.total} 起動完了！中央のメイン制御端末を起動できる！`
        : `🔷 ${term.labelJa} を起動した！（残り ${prog.total - prog.activated} 個）`,
    };
  }

  public areAllTerminalsActivated(): boolean {
    return this.terminals.length > 0 && this.terminals.every((t) => t.activated);
  }

  private syncMainUnitVisual(): void {
    if (!this.mainUnitBeacon) return;
    const mat = this.mainUnitBeacon.material as THREE.MeshToonMaterial;
    if (this.bossDefeatedInSession) {
      mat.color.set('#3ce6ff');
      mat.emissive.set('#22e4ff');
    } else if (this.areAllTerminalsActivated()) {
      mat.color.set('#ff3264');
      mat.emissive.set('#ff1848');
    } else {
      mat.color.set('#ff9c2c');
      mat.emissive.set('#ff7018');
    }
  }

  public igniteTorch(torchId: string): boolean {
    const t = this.torches.find((x) => x.id === torchId && !x.lit);
    if (!t) return false;
    t.lit = true;
    t.flameMesh.visible = true;
    this.rudaniaTorchesLit += 1;
    if (this.ambientLight) {
      this.ambientLight.intensity = Math.min(0.95, 0.22 + this.rudaniaTorchesLit * 0.26);
    }
    return true;
  }

  /**
   * Starts the unique Blight Ganon Boss Battle inside the Divine Beast!
   * HP follows authentic BotW scaling: 800 -> 1200 -> 1600 -> 2000 based on previously defeated Divine Beasts.
   */
  public startBlightBossBattle(save: SaveSlotData): ActiveBlightBoss | null {
    if (!this.activeBeastId || this.activeBoss || this.bossDefeatedInSession) return null;
    const meta = DIVINE_BEAST_METAS[this.activeBeastId];
    const maxHp = computeBlightGanonHp(save.defeatedDivineBeasts.length);
    const y0 = DIVINE_BEAST_BASE_Y;

    const grp = new THREE.Group();
    const spawnPos = new THREE.Vector3(0, meta.blightSpecies === 'windblight' ? y0 + 5.2 : y0 + 0.4, -14.0);
    grp.position.copy(spawnPos);

    const accentMat = createBotWToonMaterial({
      color: meta.accentHex,
      emissive: meta.accentHex,
      emissiveIntensity: 1.15,
    });
    const torso = new THREE.Mesh(new THREE.ConeGeometry(1.65, 3.6, 8), this.maliceMat);
    torso.position.y = 2.4;
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 1), this.darkWallMat);
    head.position.y = 4.6;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), accentMat);
    eye.position.set(0, 4.6, 0.78);
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.4, 0.35), accentMat);
    weapon.position.set(1.9, 2.8, 0.5);
    weapon.rotation.z = -0.35;
    grp.add(torso, head, eye, weapon);

    // Fireblight Flame Barrier visual sphere (hidden until Phase 2!)
    let shieldMesh: THREE.Mesh | undefined;
    if (meta.blightSpecies === 'fireblight') {
      shieldMesh = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 16, 12),
        new THREE.MeshBasicMaterial({ color: '#ff6418', transparent: true, opacity: 0.36, wireframe: false })
      );
      shieldMesh.position.y = 2.6;
      shieldMesh.visible = false;
      grp.add(shieldMesh);
    }

    this.dungeonGroup.add(grp);

    this.activeBoss = {
      beastId: this.activeBeastId,
      species: meta.blightSpecies,
      nameJa: meta.blightNameJa,
      hp: maxHp,
      maxHp,
      phase: 1,
      state: 'idle',
      timer: 1.8,
      downedTimer: 0,
      position: spawnPos,
      mesh: grp,
      shieldActive: false,
      shieldMesh,
      bits: [],
      lightningRods: [],
      phase2Triggered: false,
      teleportSteps: 0,
    };
    return this.activeBoss;
  }

  public onCryonisCreated(pillarPos: THREE.Vector3): { liftedGate: boolean; shatteredIceBlock: boolean } {
    let liftedGate = false;
    let shatteredIceBlock = false;

    if (this.activeBeastId === 'vah_ruta' && this.rutaSluiceGate && !this.rutaSluiceOpen) {
      if (Math.hypot(pillarPos.x, pillarPos.z - -5.8) < 5.5) {
        this.rutaSluiceOpen = true;
        this.rutaSluiceGate.position.y += 4.2;
        this.physics.removeCollider('ruta_sluice_gate');
        liftedGate = true;
      }
    }

    // Waterblight Phase 2 Ice Block destruction via Cryonis!
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.kind === 'ice_block' && p.position.distanceTo(pillarPos) < 5.5) {
        this.dungeonGroup.remove(p.mesh);
        if (p.physicsBody) this.physics.removeBody(p.physicsBody.id);
        this.projectiles.splice(i, 1);
        shatteredIceBlock = true;
      }
    }
    return { liftedGate, shatteredIceBlock };
  }

  public onBombExploded(pos: THREE.Vector3, radius: number): { brokeFireShield: boolean; damagedBoss: boolean } {
    let brokeFireShield = false;
    let damagedBoss = false;
    const boss = this.activeBoss;
    if (boss && boss.state !== 'dead' && boss.position.distanceTo(pos) <= radius + 4.2) {
      if (boss.species === 'fireblight' && boss.shieldActive) {
        boss.shieldActive = false;
        if (boss.shieldMesh) boss.shieldMesh.visible = false;
        boss.state = 'downed';
        boss.downedTimer = 5.5;
        this.damageBoss(boss, 140, false);
        brokeFireShield = true;
        damagedBoss = true;
      } else {
        this.damageBoss(boss, 65, false);
        damagedBoss = true;
      }
    }
    return { brokeFireShield, damagedBoss };
  }

  public onPlayerAttackBoss(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    reach: number,
    damage: number,
    isArrow: boolean
  ): { hit: boolean; blockedByShield?: boolean; defeated?: boolean; weakpoint?: boolean } {
    const boss = this.activeBoss;
    if (!boss || boss.state === 'dead') return { hit: false };

    const targetCenter = boss.position.clone().add(new THREE.Vector3(0, 2.4, 0));
    const to = targetCenter.clone().sub(origin);
    const dist = to.length();
    if (dist > reach + 2.4) return { hit: false };
    if (!isArrow && to.normalize().dot(dir) < 0.25) return { hit: false };

    if (boss.shieldActive) {
      return { hit: true, blockedByShield: true };
    }

    const weakpoint = isArrow && boss.species === 'windblight';
    const mult = boss.state === 'downed' ? 1.6 : weakpoint ? 1.75 : 1.0;
    const finalDmg = Math.round(damage * mult);
    const defeated = this.damageBoss(boss, finalDmg, weakpoint);
    return { hit: true, defeated, weakpoint };
  }

  public onPlayerPerfectCounterBoss(): boolean {
    const boss = this.activeBoss;
    if (!boss || boss.state === 'dead') return false;
    boss.state = 'downed';
    boss.downedTimer = 4.5;
    return true;
  }

  private damageBoss(boss: ActiveBlightBoss, dmg: number, triggerDownOnWeakpoint: boolean): boolean {
    boss.hp = Math.max(0, boss.hp - dmg);
    if (triggerDownOnWeakpoint && boss.state !== 'downed') {
      boss.state = 'downed';
      boss.downedTimer = 4.2;
    }
    if (!boss.phase2Triggered && boss.hp > 0 && boss.hp <= boss.maxHp * 0.5) {
      this.enterBossPhase2(boss);
    }
    if (boss.hp <= 0) {
      boss.state = 'dead';
      boss.mesh.visible = false;
      this.bossDefeatedInSession = true;
      this.cleanupBossHazards(boss);
      this.syncMainUnitVisual();
      return true;
    }
    return false;
  }

  private enterBossPhase2(boss: ActiveBlightBoss): void {
    boss.phase = 2;
    boss.phase2Triggered = true;
    const y0 = DIVINE_BEAST_BASE_Y;

    if (boss.species === 'waterblight') {
      // Raise arena water level with 4 dry stone corner platforms
      this.waterZones.push({ minX: -24, maxX: 24, minZ: -32, maxZ: 14, floorY: y0 - 1.2, waterY: y0 + 1.1 });
      const wm = new THREE.Mesh(
        new THREE.PlaneGeometry(48, 46),
        createBotWToonMaterial({ color: '#1b9ad0', transparent: true, opacity: 0.7 })
      );
      wm.rotation.x = -Math.PI / 2;
      wm.position.set(0, y0 + 1.1, -9);
      this.dungeonGroup.add(wm);
      this.bossWaterMesh = wm;
      for (const [px, pz] of [[-12, -4], [12, -4], [-12, -20], [12, -20]]) {
        this.addStaticBox(`wb_plat_${px}_${pz}`, px, pz, 6.5, 6.5, y0 - 1.2, y0 + 1.45, this.stoneMat);
      }
    } else if (boss.species === 'fireblight') {
      boss.shieldActive = true;
      if (boss.shieldMesh) boss.shieldMesh.visible = true;
    } else if (boss.species === 'windblight') {
      // Spawn 4 orbiting Energy Bits + fresh updrafts
      for (let i = 0; i < 4; i++) {
        const bit = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), this.cyanMat);
        this.dungeonGroup.add(bit);
        boss.bits.push(bit);
      }
      this.physics.spawnFireUpdraft(new THREE.Vector3(-10, y0, -14), 4.5, 22, 180);
      this.physics.spawnFireUpdraft(new THREE.Vector3(10, y0, -14), 4.5, 22, 180);
    } else if (boss.species === 'thunderblight') {
      // Drop 4 Metal Lightning Rod Pillars for Magnesis counterplay!
      for (let i = 0; i < 4; i++) {
        const rx = (i % 2 === 0 ? -7.5 : 7.5);
        const rz = i < 2 ? -8.0 : -19.0;
        const rodGrp = new THREE.Group();
        const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 3.8, 8), this.metalMat.clone());
        rodMesh.position.y = 1.9;
        rodGrp.add(rodMesh);
        rodGrp.position.set(rx, y0, rz);
        this.dungeonGroup.add(rodGrp);
        const body = this.addDynamicBody(`tb_rod_${i}`, '金属の避雷針（マグネキャッチで敵へ近づける）', rodGrp, new THREE.Vector3(rx, y0, rz), {
          mass: 2.8,
          radius: 0.65,
          halfHeight: 1.9,
          material: 'Metal',
          isStatic: false,
          isMetalBox: true,
          highlightMesh: rodMesh,
        });
        boss.lightningRods.push(body);
      }
    }
  }

  private cleanupBossHazards(boss: ActiveBlightBoss): void {
    for (const p of this.projectiles) {
      this.dungeonGroup.remove(p.mesh);
      if (p.physicsBody) this.physics.removeBody(p.physicsBody.id);
    }
    this.projectiles = [];
    for (const bit of boss.bits) this.dungeonGroup.remove(bit);
    boss.bits = [];
    for (const rod of boss.lightningRods) {
      this.dungeonGroup.remove(rod.mesh);
      this.physics.removeBody(rod.id);
    }
    boss.lightningRods = [];
    if (this.bossWaterMesh) {
      this.dungeonGroup.remove(this.bossWaterMesh);
      this.bossWaterMesh = null;
    }
  }

  public getNearestInteractable(playerPos: THREE.Vector3): DivineBeastInteractPrompt | null {
    if (!this.activeBeastId) return null;
    const candidates: DivineBeastInteractPrompt[] = [];

    for (const t of this.terminals) {
      if (t.activated) continue;
      const d = playerPos.distanceTo(t.position);
      if (d <= 3.4) {
        candidates.push({
          id: t.id,
          kind: 'terminal',
          label: `${t.labelJa} を起動する`,
          distance: d,
        });
      }
    }

    for (const torch of this.torches) {
      if (torch.lit) continue;
      const d = playerPos.distanceTo(torch.position);
      if (d <= 3.2) {
        candidates.push({
          id: torch.id,
          kind: 'torch',
          label: '青い炎の燭台に火を灯す',
          distance: d,
        });
      }
    }

    const dMain = playerPos.distanceTo(this.mainUnitPos);
    if (dMain <= 4.5 && !this.activeBoss) {
      const prog = this.getTerminalProgress();
      const label = this.bossDefeatedInSession
        ? 'メイン制御端末を起動して神獣を解放する（ハートの器＆英傑の加護）'
        : prog.activated >= prog.total
          ? 'メイン制御端末を起動する（カースガノン戦開始！）'
          : `メイン制御端末（制御端末 ${prog.activated}/${prog.total} 起動済み）`;
      candidates.push({
        id: 'main_unit',
        kind: 'mainUnit',
        label,
        distance: dMain,
      });
    }

    const dExit = playerPos.distanceTo(this.exitPos);
    if (dExit <= 3.4) {
      candidates.push({
        id: 'db_exit',
        kind: 'exit',
        label: '神獣から地上へ脱出する（起動済み端末は保存）',
        distance: dExit,
      });
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] ?? null;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    isGrounded: boolean
  ): {
    fellInPit: boolean;
    bossHitPlayer?: { damage: number; isLaser: boolean; labelJa: string };
    bossDownedByGimmick?: string;
    phase2Message?: string;
  } {
    if (!this.activeBeastId) return { fellInPit: false };
    this.dungeonTime += dt;

    if (isGrounded && playerPos.y >= DIVINE_BEAST_BASE_Y - 1.5) {
      this.lastSafePos.copy(playerPos);
    }
    if (playerPos.y < DIVINE_BEAST_BASE_Y - 7.5) {
      playerPos.copy(this.lastSafePos);
      playerPos.y += 0.35;
      return { fellInPit: true };
    }

    // Animate terminal crystals
    for (const t of this.terminals) {
      t.beaconMesh.rotation.y += dt * 1.6;
    }
    if (this.mainUnitBeacon) {
      this.mainUnitBeacon.rotation.y += dt * 1.3;
    }

    // Beast-specific animations
    if (this.activeBeastId === 'vah_ruta') {
      const dir = this.poseIndex === 2 ? -1 : 1;
      if (this.rutaBigWheel && !this.rutaBigWheel.isFrozenStasis) {
        this.rutaBigWheel.mesh.rotation.z += dt * (this.poseIndex === 1 ? 1.15 : 0.45) * dir;
      }
      if (this.rutaSmallWheel) {
        this.rutaSmallWheel.rotation.z -= dt * 1.4 * dir;
      }
    } else if (this.activeBeastId === 'vah_rudania' && this.rudaniaTiltPivot) {
      const targetAngle = this.poseIndex === 1 ? Math.PI * 0.5 : 0;
      this.rudaniaTiltAngle += (targetAngle - this.rudaniaTiltAngle) * Math.min(1, dt * 3.5);
      this.rudaniaTiltPivot.rotation.z = this.rudaniaTiltAngle;
    } else if (this.activeBeastId === 'vah_medoh' && this.medohWingPivot) {
      const targetAngle = this.poseIndex === 0 ? 0.31 : this.poseIndex === 2 ? -0.31 : 0;
      this.medohWingAngle += (targetAngle - this.medohWingAngle) * Math.min(1, dt * 3.5);
      this.medohWingPivot.rotation.z = this.medohWingAngle;
    }

    // Boss AI Update (Phase 1 + Phase 2 bespoke patterns!)
    let bossHitPlayer: { damage: number; isLaser: boolean; labelJa: string } | undefined;
    let bossDownedByGimmick: string | undefined;

    const boss = this.activeBoss;
    if (boss && boss.state !== 'dead') {
      const toPlayer = playerPos.clone().sub(boss.position);
      const dist = Math.hypot(toPlayer.x, toPlayer.z);
      boss.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

      // Thunderblight Phase 2: Check if player holds a Magnesis Metal Lightning Rod near Thunderblight!
      if (boss.species === 'thunderblight' && boss.phase === 2 && boss.state !== 'downed') {
        for (const rod of boss.lightningRods) {
          if (rod.magnesisGrabbed && rod.position.distanceTo(boss.position) < 5.8) {
            boss.state = 'downed';
            boss.downedTimer = 5.5;
            this.damageBoss(boss, 160, false);
            bossDownedByGimmick = '⚡ マグネキャッチの避雷針へ落雷！雷のカースガノンが感電ダウン！！';
            break;
          }
        }
      }

      if (boss.state === 'downed') {
        boss.downedTimer -= dt;
        boss.mesh.position.set(boss.position.x, DIVINE_BEAST_BASE_Y + 0.15, boss.position.z);
        boss.mesh.rotation.x = 0.38;
        if (boss.downedTimer <= 0) {
          boss.state = 'idle';
          boss.timer = 1.4;
          boss.mesh.rotation.x = 0;
        }
      } else {
        boss.mesh.rotation.x = 0;
        const hoverY =
          boss.species === 'windblight'
            ? DIVINE_BEAST_BASE_Y + 5.2 + Math.sin(this.dungeonTime * 2.2) * 0.6
            : DIVINE_BEAST_BASE_Y + 0.4 + Math.sin(this.dungeonTime * 2.8) * 0.25;
        boss.position.y = hoverY;
        boss.mesh.position.copy(boss.position);

        // Orbiting bits for Windblight Phase 2
        boss.bits.forEach((bit, idx) => {
          const a = this.dungeonTime * 1.9 + (idx * Math.PI) / 2;
          bit.position.set(boss.position.x + Math.cos(a) * 4.8, boss.position.y + 1.2, boss.position.z + Math.sin(a) * 4.8);
        });

        boss.timer -= dt;
        if (boss.timer <= 0) {
          if (boss.species === 'waterblight') {
            if (boss.phase === 2 && dist > 6.5) {
              this.spawnBossProjectile('ice_block', boss.position, playerPos, 10);
              boss.timer = 3.1;
            } else if (dist < 7.2) {
              bossHitPlayer = { damage: 12, isLaser: false, labelJa: '水のカースガノンの長槍なぎ払い！' };
              boss.timer = 2.4;
            } else {
              // Advance toward player
              const step = toPlayer.clone().setY(0).normalize().multiplyScalar(5.5);
              boss.position.add(step);
              boss.timer = 1.6;
            }
          } else if (boss.species === 'fireblight') {
            if (dist < 6.8) {
              bossHitPlayer = { damage: 14, isLaser: false, labelJa: '炎のカースガノンの巨大火炎剣！' };
              boss.timer = 2.5;
            } else {
              this.spawnBossProjectile('fireball', boss.position, playerPos, 12);
              boss.timer = 2.8;
            }
          } else if (boss.species === 'windblight') {
            this.spawnBossProjectile(boss.phase === 2 ? 'laser' : 'tornado', boss.position, playerPos, 10);
            boss.timer = boss.phase === 2 ? 2.2 : 2.9;
          } else if (boss.species === 'thunderblight') {
            // Ultra-fast zigzag teleport slash!
            const angle = Math.atan2(toPlayer.x, toPlayer.z) + (boss.teleportSteps % 2 === 0 ? 0.55 : -0.55);
            boss.teleportSteps += 1;
            boss.position.set(
              THREE.MathUtils.clamp(playerPos.x - Math.sin(angle) * 3.4, -22, 22),
              hoverY,
              THREE.MathUtils.clamp(playerPos.z - Math.cos(angle) * 3.4, -28, 12)
            );
            boss.mesh.position.copy(boss.position);
            bossHitPlayer = { damage: 14, isLaser: false, labelJa: '雷のカースガノンの超高速瞬間移動斬り！' };
            boss.timer = 2.6;
          }
        }
      }
    }

    // Update Boss Projectiles (Ice Blocks, Fireballs, Lasers, Tornadoes)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.physicsBody?.isFrozenStasis) continue;
      p.position.addScaledVector(p.velocity, dt);
      p.mesh.position.copy(p.position);
      if (p.physicsBody) p.physicsBody.position.copy(p.position);

      if (p.reflected && boss && boss.state !== 'dead' && p.position.distanceTo(boss.position) < 3.5) {
        boss.state = 'downed';
        boss.downedTimer = 5.0;
        this.damageBoss(boss, 130, false);
        bossDownedByGimmick = '❄️ 氷塊を跳ね返して命中！水のカースガノンがダウンした！！';
        this.dungeonGroup.remove(p.mesh);
        if (p.physicsBody) this.physics.removeBody(p.physicsBody.id);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (!p.reflected && p.position.distanceTo(playerPos.clone().add(new THREE.Vector3(0, 1.0, 0))) < 1.85) {
        bossHitPlayer = { damage: p.damage, isLaser: p.kind === 'laser', labelJa: `${boss?.nameJa ?? 'カースガノン'}の攻撃！` };
        this.dungeonGroup.remove(p.mesh);
        if (p.physicsBody) this.physics.removeBody(p.physicsBody.id);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.life <= 0) {
        this.dungeonGroup.remove(p.mesh);
        if (p.physicsBody) this.physics.removeBody(p.physicsBody.id);
        this.projectiles.splice(i, 1);
      }
    }

    return { fellInPit: false, bossHitPlayer, bossDownedByGimmick };
  }

  private spawnBossProjectile(kind: BlightProjectile['kind'], from: THREE.Vector3, target: THREE.Vector3, damage: number): void {
    const start = from.clone().add(new THREE.Vector3(0, 2.2, 0));
    const dir = target.clone().add(new THREE.Vector3(0, 1.0, 0)).sub(start).normalize();
    const grp = new THREE.Group();
    grp.position.copy(start);

    const mesh =
      kind === 'ice_block'
        ? new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), this.cyanMat)
        : kind === 'fireball'
          ? new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), this.amberMat)
          : kind === 'laser'
            ? new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 8), this.cyanMat)
            : new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.8, 8), this.cyanMat);
    grp.add(mesh);
    this.dungeonGroup.add(grp);

    const speed = kind === 'laser' ? 24 : kind === 'ice_block' ? 11.5 : 14.5;
    let body: PhysicsBody | undefined;
    if (kind === 'ice_block') {
      body = this.addDynamicBody(`wb_ice_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, '氷塊ブロック（ビタロック／アイスメイカー対応）', grp, start, {
        mass: 2.0,
        radius: 1.0,
        halfHeight: 0.8,
        material: 'Stone',
        isStatic: false,
        stasisInteractable: true,
        highlightMesh: mesh,
      });
    }

    this.projectiles.push({
      id: `bp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      kind,
      mesh: grp,
      position: start,
      velocity: dir.multiplyScalar(speed),
      damage,
      life: 4.5,
      physicsBody: body,
    });
  }
}
