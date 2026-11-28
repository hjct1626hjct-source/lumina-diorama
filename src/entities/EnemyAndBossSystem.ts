import * as THREE from 'three';
import { createBotWToonMaterial } from '../rendering/BotWToonShader';
import { textureBank } from '../rendering/ProceduralTextures';
import { modelLoader, type NormalizedInstance } from '../rendering/ModelLoader';
import { getTerrainHeight } from '../world/TerrainGenerator';
import type { PhysicsChemistryEngine } from '../physics/PhysicsChemistryEngine';
import type { EnemySpecies, EnemyTier } from '../types/botw';

/**
 * Hidden BotW Difficulty Scaling (LevelSensor) pure calculator (exported for unit tests!).
 * Mirrors retail BotW points table: each species awards kill points up to 10 kills (bosses 1st kill only).
 */
export const SPECIES_KILL_POINTS: Partial<Record<EnemySpecies, number>> = {
  bokoblin: 15,
  moblin: 25,
  lizalfos: 30,
  stal_mage: 35,
  wizzrobe: 45,
  lynel: 120,
  guardian_stalker: 85,
  hinox: 70,
  stone_talus: 60,
  yiga_footsoldier: 25,
  yiga_blademaster: 60,
  waterblight: 300,
  fireblight: 300,
  windblight: 300,
  thunderblight: 300,
};

export function computeScaledEnemyTier(
  baseTier: EnemyTier,
  levelSensorPoints: number,
  masterMode: boolean
): EnemyTier {
  if (baseTier === 'boss') return 'boss';
  const order: EnemyTier[] = ['red', 'blue', 'black', 'silver', 'gold'];
  let idx = Math.max(0, order.indexOf(baseTier));
  if (levelSensorPoints >= 1800) idx = Math.max(idx, 3);
  else if (levelSensorPoints >= 900) idx = Math.max(idx, 2);
  else if (levelSensorPoints >= 320) idx = Math.max(idx, 1);

  // Master Mode promotes every normal enemy by +1 tier (up to Gold)!
  if (masterMode) idx = Math.min(order.length - 1, idx + 1);
  else idx = Math.min(3, idx); // Normal Mode caps at Silver

  return order[idx];
}

/**
 * Exact BotW Blight Ganon HP formula: 800 -> 1200 -> 1600 -> 2000 based on defeated Blight count!
 */
export function computeBlightGanonHp(defeatedBlightsCount: number): number {
  return 800 + 400 * Math.max(0, Math.min(3, defeatedBlightsCount));
}

export interface WorldEnemy {
  id: string;
  species: EnemySpecies;
  nameJa: string;
  baseTier: EnemyTier;
  tier: EnemyTier;
  position: THREE.Vector3;
  spawnPos: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  attack: number;
  radius: number;
  alive: boolean;
  alertState: 'idle' | 'patrol' | 'alert' | 'chase' | 'windup' | 'attack' | 'stagger' | 'stasis' | 'frozen';
  stateTimer: number;
  attackCooldown: number;
  lastDamagedTimer: number; // Master Mode regen kicks in after 6s!
  stasisTimer: number;
  frozenTimer: number;
  ragdollTimer: number;
  isBoss: boolean;
  isShockImmune: boolean;
  isGuardian: boolean;
  isHoverCaster?: boolean;
  casterElement?: 'fire' | 'ice' | 'shock';
  guardianCharge: number; // 0..1 aiming laser buildup
  guardianLaserMesh?: THREE.Mesh;
  root: THREE.Group;
  fallbackGroup?: THREE.Group | null;
  glbKey?: string;
  glbScale?: number;
  glbTint?: string;
  glbInstance?: NormalizedInstance | null;
  hitFlashTimer: number;
  yigaBlademaster?: boolean;
  mazCloneIndex?: number;
}

export interface ProjectileBeam {
  id: string;
  attacker: WorldEnemy;
  fromEnemy: boolean;
  isGuardianLaser: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  life: number;
  mesh: THREE.Mesh;
}

export interface SkyDragon {
  id: 'dinraal' | 'naydra' | 'farosh';
  nameJa: string;
  center: THREE.Vector3;
  radiusX: number;
  radiusZ: number;
  altitude: number;
  speed: number;
  phase: number;
  root: THREE.Group;
  segments: THREE.Mesh[];
}

const TIER_COLORS: Record<EnemyTier, string> = {
  red: '#c84238',
  blue: '#3b68c4',
  black: '#32353d',
  silver: '#d0d8e8',
  gold: '#f0c43b',
  boss: '#6c2458',
};

const TIER_HP_MULT: Record<EnemyTier, number> = {
  red: 1.0,
  blue: 2.2,
  black: 4.5,
  silver: 8.5,
  gold: 13.0,
  boss: 1.0,
};

/**
 * Manages all Hyrule Enemies, Bosses, Guardians, 3 Sacred Sky Dragons,
 * LevelSensor dynamic tier scaling, Master Mode HP regeneration, Guardian laser reflection,
 * and Blood Moon Revival!
 */
export class EnemyAndBossSystem {
  public readonly group = new THREE.Group();
  public enemies: WorldEnemy[] = [];
  public projectiles: ProjectileBeam[] = [];
  public dragons: SkyDragon[] = [];

  constructor(scene: THREE.Scene) {
    this.group.name = 'HyruleEnemiesAndBosses';
    scene.add(this.group);
  }

  populateWorld(levelSensorPoints: number, masterMode: boolean, defeatedBlights: number): void {
    // Clear previous
    while (this.group.children.length > 0) this.group.remove(this.group.children[0]);
    this.enemies = [];
    this.projectiles = [];
    this.dragons = [];

    // Curated iconic open-world encounters across the Great Plateau & all 15 Regions
    const spawns: Array<{
      id: string;
      species: EnemySpecies;
      nameJa: string;
      tier: EnemyTier;
      x: number;
      z: number;
      baseHp: number;
      atk: number;
      isBoss?: boolean;
      casterElement?: 'fire' | 'ice' | 'shock';
    }> = [
      // Great Plateau encounters (spaced cleanly for exploration & fights!)
      { id: 'boko_gp_1', species: 'bokoblin', nameJa: 'ボコブリン', tier: 'red', x: -255, z: 422, baseHp: 40, atk: 8 },
      { id: 'boko_gp_2', species: 'bokoblin', nameJa: 'ボコブリン', tier: 'red', x: -200, z: 455, baseHp: 40, atk: 8 },
      { id: 'boko_gp_3', species: 'bokoblin', nameJa: 'ボコブリン', tier: 'blue', x: -165, z: 470, baseHp: 55, atk: 12 },
      { id: 'stal_gp_1', species: 'stal_bokoblin', nameJa: 'スタルボコブリン', tier: 'red', x: -292, z: 515, baseHp: 35, atk: 10 },
      { id: 'wizzrobe_gp_fire', species: 'wizzrobe', nameJa: 'ファイアウィズローブ', tier: 'red', x: -178, z: 438, baseHp: 150, atk: 18, casterElement: 'fire' },
      { id: 'stal_mage_gp', species: 'stal_mage', nameJa: 'スタル魔導士', tier: 'blue', x: -268, z: 505, baseHp: 90, atk: 16, casterElement: 'shock' },
      { id: 'talus_gp', species: 'stone_talus', nameJa: 'イワロック', tier: 'boss', x: -225, z: 365, baseHp: 300, atk: 24, isBoss: true },
      { id: 'guard_gp', species: 'guardian_decayed', nameJa: '朽ちたガーディアン', tier: 'boss', x: -158, z: 486, baseHp: 500, atk: 32 },
      // Central Hyrule & Hyrule Castle
      { id: 'guard_hc_1', species: 'guardian_stalker', nameJa: 'ガーディアン（歩行型）', tier: 'boss', x: -110, z: 120, baseHp: 1500, atk: 38, isBoss: true },
      { id: 'guard_hc_2', species: 'guardian_stalker', nameJa: 'ガーディアン（歩行型）', tier: 'boss', x: -80, z: -120, baseHp: 1500, atk: 38, isBoss: true },
      { id: 'moblin_ch_1', species: 'moblin', nameJa: 'モリブリン', tier: 'blue', x: -140, z: 220, baseHp: 75, atk: 16 },
      { id: 'calamity_ganon', species: 'calamity_ganon', nameJa: '厄災ガノン', tier: 'boss', x: -80, z: -200, baseHp: 4000, atk: 44, isBoss: true },
      // Regional signature monsters, Wizzrobes, Lynels & Hinoxes
      { id: 'lizal_lan', species: 'lizalfos', nameJa: 'リザルフォス', tier: 'blue', x: 820, z: -60, baseHp: 70, atk: 18 },
      { id: 'wizzrobe_lan_elec', species: 'wizzrobe', nameJa: 'ボルトウィズローブ', tier: 'blue', x: 780, z: -110, baseHp: 180, atk: 22, casterElement: 'shock' },
      { id: 'wizzrobe_hebra_ice', species: 'wizzrobe', nameJa: 'アイスウィズローブ', tier: 'blue', x: -690, z: -690, baseHp: 180, atk: 22, casterElement: 'ice' },
      { id: 'lynel_pl', species: 'lynel', nameJa: 'ライネル', tier: 'red', x: 990, z: -170, baseHp: 2000, atk: 36, isBoss: true },
      { id: 'hinox_dp', species: 'hinox', nameJa: 'ヒノックス', tier: 'boss', x: 310, z: 440, baseHp: 600, atk: 26, isBoss: true },
      { id: 'stal_ak', species: 'stal_moblin', nameJa: 'スタルモリブリン', tier: 'blue', x: 980, z: -420, baseHp: 65, atk: 18 },
      // DLC 2 Final Trial Boss: Monk Maz Koshia (in dedicated west plateau Trial Chamber arena!)
      { id: 'boss_maz_koshia', species: 'monk_maz_koshia', nameJa: '導師 ミィズ・キョシア', tier: 'boss', x: -395, z: 412, baseHp: 4000, atk: 34, isBoss: true },
    ];

    for (const sp of spawns) {
      const tier = computeScaledEnemyTier(sp.tier, levelSensorPoints, masterMode);
      const hp = sp.isBoss ? sp.baseHp : Math.round(sp.baseHp * TIER_HP_MULT[tier]);
      this.spawnEnemy({ ...sp, tier, maxHp: hp });
    }

    // Build all 3 Sacred Sky Dragons soaring majestically above Hyrule!
    this.buildSkyDragons();
  }

  private resolveEnemyGlbSpec(
    species: EnemySpecies,
    tier: EnemyTier,
    yigaBlademaster?: boolean,
    casterElement?: 'fire' | 'ice' | 'shock'
  ): { key: string; scale: number; tint?: string } | null {
    const tierCol = TIER_COLORS[tier];
    switch (species) {
      case 'bokoblin':
        return { key: 'npc_barbarian', scale: 0.80, tint: tierCol };
      case 'moblin':
        return { key: 'npc_barbarian', scale: 1.38, tint: tierCol };
      case 'lizalfos':
        return { key: 'npc_rogue', scale: 1.05, tint: tierCol };
      case 'stal_bokoblin':
        return { key: 'stal_minion', scale: 0.96 };
      case 'stal_moblin':
        return { key: 'stal_warrior', scale: 1.26 };
      case 'stal_mage':
        return { key: 'stal_mage', scale: 1.05, tint: '#8e6ce8' };
      case 'wizzrobe':
        return {
          key: 'stal_mage',
          scale: 1.08,
          tint: casterElement === 'ice' ? '#58c8f8' : casterElement === 'shock' ? '#f2d044' : '#e65432',
        };
      case 'monk_maz_koshia':
        return { key: 'stal_mage', scale: 1.48, tint: '#c8ae74' };
      case 'yiga_footsoldier':
      case 'yiga_blademaster':
        return {
          key: yigaBlademaster ? 'npc_barbarian' : 'npc_rogue',
          scale: yigaBlademaster ? 1.28 : 1.0,
          tint: '#b8242e',
        };
      default:
        return null;
    }
  }

  private attachSpeciesAccents(
    parent: THREE.Group,
    species: EnemySpecies,
    scale: number,
    yigaBlademaster?: boolean,
    casterElement?: 'fire' | 'ice' | 'shock'
  ): void {
    const boneMat = createBotWToonMaterial({ color: '#efe5cc', rimStrength: 0.35 });
    if (species === 'bokoblin' || species === 'moblin') {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11 * scale, 0.52 * scale, 7), boneMat);
      horn.position.set(0, 1.88 * scale, 0.08 * scale);
      horn.rotation.x = 0.28;
      parent.add(horn);
    } else if (species === 'lizalfos') {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.10 * scale, 0.48 * scale, 5), boneMat);
      fin.position.set(0, 1.76 * scale, -0.10 * scale);
      fin.rotation.x = -0.55;
      parent.add(fin);
    } else if (species === 'yiga_footsoldier' || species === 'yiga_blademaster') {
      const mask = new THREE.Mesh(
        new THREE.CircleGeometry(0.22, 10),
        createBotWToonMaterial({ color: '#f5f0e2', emissive: '#e02828', emissiveIntensity: 0.25 })
      );
      mask.position.set(0, yigaBlademaster ? 1.85 : 1.48, 0.24);
      parent.add(mask);
    } else if (species === 'monk_maz_koshia') {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.08, 8, 22),
        createBotWToonMaterial({ color: '#f2ce58', emissive: '#2ce8ff', emissiveIntensity: 1.5 })
      );
      halo.position.set(0, 2.35, -0.25);
      parent.add(halo);
    } else if (species === 'wizzrobe' || species === 'stal_mage') {
      const orbCol = casterElement === 'ice' ? '#62e8ff' : casterElement === 'fire' ? '#ff6424' : '#c868ff';
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22, 1),
        new THREE.MeshBasicMaterial({ color: orbCol })
      );
      orb.position.set(0.45, 1.75, 0.35);
      parent.add(orb);
    }
  }

  /**
   * Seamlessly hot-swaps any enemy waiting on a deferred heavy GLB while preserving HP, position, and combat AI!
   */
  public hotSwapModel(key: string): number {
    let swapped = 0;
    for (const e of this.enemies) {
      if (!e.glbKey || e.glbKey !== key || e.glbInstance) continue;
      const inst = modelLoader.instantiate(key, {
        scaleMultiplier: e.glbScale ?? 1.0,
        tintColor: e.glbTint,
      });
      if (!inst) continue;
      if (e.fallbackGroup) {
        e.root.remove(e.fallbackGroup);
        e.fallbackGroup = null;
      }
      e.root.add(inst.root);
      this.attachSpeciesAccents(e.root, e.species, e.glbScale ?? 1.0, e.yigaBlademaster, e.casterElement);
      inst.playClip(e.alertState === 'chase' ? 'run' : 'idle');
      e.glbInstance = inst;
      swapped++;
    }
    return swapped;
  }

  spawnEnemy(spec: {
    id: string;
    species: EnemySpecies;
    nameJa: string;
    tier: EnemyTier;
    x: number;
    z: number;
    maxHp: number;
    atk: number;
    isBoss?: boolean;
    yigaBlademaster?: boolean;
    casterElement?: 'fire' | 'ice' | 'shock';
  }): WorldEnemy {
    const y = getTerrainHeight(spec.x, spec.z);
    const root = new THREE.Group();
    root.position.set(spec.x, y, spec.z);

    let glbInstance: NormalizedInstance | null = null;
    let fallbackGroup: THREE.Group | null = null;
    let guardianLaserMesh: THREE.Mesh | undefined;
    const tierCol = TIER_COLORS[spec.tier];

    const glbSpec = this.resolveEnemyGlbSpec(spec.species, spec.tier, spec.yigaBlademaster, spec.casterElement);
    if (glbSpec) {
      glbInstance = modelLoader.instantiate(glbSpec.key, {
        scaleMultiplier: glbSpec.scale,
        tintColor: glbSpec.tint,
      });
      if (glbInstance) {
        root.add(glbInstance.root);
        this.attachSpeciesAccents(root, spec.species, glbSpec.scale, spec.yigaBlademaster, spec.casterElement);
      }
    }

    if (!glbInstance) {
      fallbackGroup = new THREE.Group();
      guardianLaserMesh = this.buildSculptedMonsterMesh(fallbackGroup, spec.species, tierCol, spec.casterElement);
      root.add(fallbackGroup);
    }

    this.group.add(root);
    const showTierPrefix =
      spec.tier !== 'boss' &&
      spec.tier !== 'red' &&
      spec.species !== 'wizzrobe' &&
      spec.species !== 'stal_mage';
    const tierPrefix: Partial<Record<EnemyTier, string>> = { blue: '青', black: '黒', silver: '白銀', gold: '黄金' };
    const enemy: WorldEnemy = {
      id: spec.id,
      species: spec.species,
      nameJa: `${showTierPrefix ? tierPrefix[spec.tier] ?? '' : ''}${spec.nameJa}`,
      baseTier: spec.tier,
      tier: spec.tier,
      position: new THREE.Vector3(spec.x, y, spec.z),
      spawnPos: new THREE.Vector3(spec.x, y, spec.z),
      velocity: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      attack: spec.atk,
      radius: spec.species === 'guardian_stalker' || spec.species === 'stone_talus' || spec.species === 'calamity_ganon' ? 2.6 : spec.species === 'hinox' || spec.species === 'lynel' ? 2.1 : 1.05,
      alive: true,
      alertState: 'idle',
      stateTimer: 1 + Math.random() * 2,
      attackCooldown: 1.5,
      lastDamagedTimer: 99,
      stasisTimer: 0,
      frozenTimer: 0,
      ragdollTimer: 0,
      isBoss: !!spec.isBoss,
      isShockImmune: spec.species === 'lynel' || spec.species === 'thunderblight',
      isGuardian: spec.species === 'guardian_stalker' || spec.species === 'guardian_decayed',
      isHoverCaster: spec.species === 'wizzrobe' || spec.species === 'stal_mage',
      casterElement: spec.casterElement,
      guardianCharge: 0,
      guardianLaserMesh,
      root,
      fallbackGroup,
      glbKey: glbSpec?.key,
      glbScale: glbSpec?.scale,
      glbTint: glbSpec?.tint,
      glbInstance,
      hitFlashTimer: 0,
      yigaBlademaster: spec.yigaBlademaster,
    };

    this.enemies.push(enemy);
    return enemy;
  }

  private buildSculptedMonsterMesh(
    parent: THREE.Group,
    species: EnemySpecies,
    tierHex: string,
    casterElement?: 'fire' | 'ice' | 'shock'
  ): THREE.Mesh | undefined {
    const shTex = textureBank.getSheikahStoneTexture();
    const skinMat = createBotWToonMaterial({ color: tierHex, rimStrength: 0.42 });
    const boneMat = createBotWToonMaterial({ color: '#ede3cc' });
    const eyeMat = createBotWToonMaterial({ color: '#ffd838', emissive: '#ffaa14', emissiveIntensity: 0.9 });

    if (species === 'wizzrobe' || species === 'stal_mage') {
      const robeHex =
        species === 'stal_mage'
          ? '#4b3b78'
          : casterElement === 'ice'
          ? '#3aa8e8'
          : casterElement === 'shock'
          ? '#d9b42e'
          : '#c93a2b';
      const orbHex =
        casterElement === 'ice' ? '#70eeff' : casterElement === 'fire' ? '#ff6a24' : '#d278ff';
      const robeMat = createBotWToonMaterial({ color: robeHex, rimStrength: 0.48 });
      const robe = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.85, 10), robeMat);
      robe.position.y = 1.05;
      robe.castShadow = true;
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), robeMat);
      hood.position.y = 2.02;
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), boneMat);
      face.position.set(0, 1.98, 0.14);
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 1.9, 6), createBotWToonMaterial({ color: '#5c3c22' }));
      staff.position.set(0.54, 1.25, 0.22);
      staff.rotation.z = -0.18;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 1), new THREE.MeshBasicMaterial({ color: orbHex }));
      orb.position.set(0.68, 2.22, 0.24);
      parent.add(robe, hood, face, staff, orb);
      return undefined;
    }

    if (species === 'guardian_stalker' || species === 'guardian_decayed') {
      // Iconic Sheikah Guardian Stalker with Jomon dome, rotating eye turret, 6 segmented spider legs & red targeting laser!
      const gMat = createBotWToonMaterial({
        color: '#464d5c',
        map: shTex.map,
        normalMap: shTex.normalMap,
        emissive: '#ff285a',
        emissiveMap: shTex.emissiveMap,
        emissiveIntensity: 1.6,
        metalHighlight: true,
      });
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 2.1, 2.6, 10), gMat);
      dome.position.y = species === 'guardian_stalker' ? 2.8 : 1.25;
      dome.castShadow = true;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 1.05, 10), gMat);
      head.position.y = species === 'guardian_stalker' ? 4.4 : 2.8;
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 12, 10),
        new THREE.MeshBasicMaterial({ color: '#ff2a55' })
      );
      eye.position.set(0, species === 'guardian_stalker' ? 4.4 : 2.8, 0.95);
      parent.add(dome, head, eye);

      if (species === 'guardian_stalker') {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 3.8, 7), gMat);
          leg.position.set(Math.cos(a) * 2.2, 1.5, Math.sin(a) * 2.2);
          leg.rotation.z = -Math.cos(a) * 0.55;
          leg.rotation.x = Math.sin(a) * 0.55;
          parent.add(leg);
        }
      }

      // Red Lock-on Sightline Beam
      const lGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
      lGeo.rotateX(Math.PI / 2);
      lGeo.translate(0, 0, 0.5);
      const laser = new THREE.Mesh(lGeo, new THREE.MeshBasicMaterial({ color: '#ff2244', transparent: true, opacity: 0.78 }));
      laser.position.set(0, species === 'guardian_stalker' ? 4.4 : 2.8, 0.95);
      laser.visible = false;
      parent.add(laser);
      return laser;
    }

    if (species === 'stone_talus') {
      const rockMat = createBotWToonMaterial({
        color: '#7c786e',
        map: textureBank.getCliffTexture().map,
        normalMap: textureBank.getCliffTexture().normalMap,
      });
      const body = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 1), rockMat);
      body.position.y = 2.6;
      body.castShadow = true;
      // Glowing black-gold Ore Deposit weakpoint on top!
      const ore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.75, 0),
        createBotWToonMaterial({ color: '#242830', emissive: '#f5b82e', emissiveIntensity: 0.85, metalHighlight: true })
      );
      ore.position.set(0, 5.1, -0.3);
      for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), rockMat);
        arm.position.set(s * 2.9, 1.8, 0.6);
        parent.add(arm);
      }
      parent.add(body, ore);
      return undefined;
    }

    if (species === 'lynel') {
      // Sculpted Centaur Lynel with lion mane & crusher!
      const horseBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 1.6, 8, 12), skinMat);
      horseBody.rotation.x = Math.PI / 2;
      horseBody.position.set(0, 1.55, -0.35);
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.68, 1.1, 8, 12), skinMat);
      torso.position.set(0, 2.75, 0.55);
      const mane = new THREE.Mesh(new THREE.DodecahedronGeometry(0.88, 1), createBotWToonMaterial({ color: '#422218' }));
      mane.position.set(0, 3.6, 0.62);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), skinMat);
      head.position.set(0, 3.65, 0.85);
      for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.85, 6), boneMat);
        horn.position.set(s * 0.52, 4.15, 0.72);
        horn.rotation.z = -s * 0.55;
        parent.add(horn);
      }
      parent.add(horseBody, torso, mane, head);
      return undefined;
    }

    if (species === 'calamity_ganon' || species === 'waterblight' || species === 'fireblight' || species === 'windblight' || species === 'thunderblight' || species === 'monk_maz_koshia') {
      const isMonk = species === 'monk_maz_koshia';
      const bossMat = createBotWToonMaterial({
        color: isMonk ? '#b49a6c' : '#301424',
        map: shTex.map,
        emissive: isMonk ? '#2ce8ff' : '#ff1e56',
        emissiveMap: shTex.emissiveMap,
        emissiveIntensity: 1.85,
        rimStrength: 0.7,
      });
      const sc = species === 'calamity_ganon' ? 2.2 : 1.45;
      const robe = new THREE.Mesh(new THREE.ConeGeometry(1.4 * sc, 3.8 * sc, 10), bossMat);
      robe.position.y = 2.0 * sc;
      const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.85 * sc, 1), bossMat);
      head.position.y = 4.2 * sc;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.7 * sc, 0.16 * sc, 8, 18), createBotWToonMaterial({ color: isMonk ? '#f2ce58' : '#ff2455', emissive: isMonk ? '#2ce8ff' : '#ff1848', emissiveIntensity: 1.4 }));
      halo.position.y = 4.1 * sc;
      parent.add(robe, head, halo);
      return undefined;
    }

    // Sculpted Bokoblin / Moblin / Lizalfos / Hinox organic multi-part rig!
    const scale = species === 'hinox' ? 2.75 : species === 'moblin' ? 1.55 : species === 'lizalfos' ? 1.15 : 0.95;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42 * scale, 0.58 * scale, 8, 12), skinMat);
    body.position.y = 0.95 * scale;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36 * scale, 14, 12), skinMat);
    head.position.set(0, 1.56 * scale, 0.08 * scale);
    head.castShadow = true;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.10 * scale, 0.48 * scale, 7), boneMat);
    horn.position.set(0, 1.92 * scale, 0.12 * scale);
    horn.rotation.x = 0.25;
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.45 * scale, 6), skinMat);
      ear.position.set(s * 0.40 * scale, 1.55 * scale, 0);
      ear.rotation.z = -s * 1.15;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085 * scale, 8, 8), eyeMat);
      eye.position.set(s * 0.14 * scale, 1.60 * scale, 0.32 * scale);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14 * scale, 0.35 * scale, 6, 8), skinMat);
      leg.position.set(s * 0.22 * scale, 0.35 * scale, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12 * scale, 0.42 * scale, 6, 8), skinMat);
      arm.position.set(s * 0.52 * scale, 1.05 * scale, 0.12 * scale);
      arm.rotation.x = -0.35;
      parent.add(ear, eye, leg, arm);
    }
    // Boko Club in right hand
    const club = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14 * scale, 0.06 * scale, 1.1 * scale, 7),
      createBotWToonMaterial({ color: '#6b4426', map: textureBank.getWoodPlankTexture().map })
    );
    club.position.set(0.58 * scale, 1.18 * scale, 0.52 * scale);
    club.rotation.x = Math.PI / 3;
    parent.add(body, head, horn, club);
    return undefined;
  }

  /**
   * Builds the 3 Sacred Sky Dragons (Dinraal, Naydra, Farosh) soaring gracefully across Hyrule!
   */
  private buildSkyDragons(): void {
    const specs: Array<{ id: SkyDragon['id']; nameJa: string; cx: number; cz: number; rx: number; rz: number; alt: number; color: string; glow: string }> = [
      { id: 'dinraal', nameJa: 'オルドラ (Dinraal)', cx: 420, cz: -700, rx: 320, rz: 220, alt: 165, color: '#d85428', glow: '#ff8a24' },
      { id: 'naydra', nameJa: 'ネルドラ (Naydra)', cx: 1020, cz: 190, rx: 250, rz: 240, alt: 155, color: '#42a8e8', glow: '#78e8ff' },
      { id: 'farosh', nameJa: 'フロドラ (Farosh)', cx: 180, cz: 860, rx: 340, rz: 210, alt: 135, color: '#64c842', glow: '#e8ff54' },
    ];
    for (const sp of specs) {
      const root = new THREE.Group();
      const mat = createBotWToonMaterial({
        color: sp.color,
        emissive: sp.glow,
        emissiveIntensity: 0.72,
        rimStrength: 0.65,
      });
      const segments: THREE.Mesh[] = [];
      for (let i = 0; i < 14; i++) {
        const rad = i === 0 ? 3.2 : Math.max(0.8, 2.8 - i * 0.16);
        const seg = new THREE.Mesh(new THREE.SphereGeometry(rad, 10, 8), mat);
        seg.scale.set(1, 0.85, 1.5);
        root.add(seg);
        segments.push(seg);
      }
      this.group.add(root);
      this.dragons.push({
        id: sp.id,
        nameJa: sp.nameJa,
        center: new THREE.Vector3(sp.cx, sp.alt, sp.cz),
        radiusX: sp.rx,
        radiusZ: sp.rz,
        altitude: sp.alt,
        speed: 0.14,
        phase: Math.random() * Math.PI * 2,
        root,
        segments,
      });
    }
  }

  /**
   * Triggers Blood Moon Revival (`RevivalBloodyMoon`): resurrects all slain non-story enemies with updated LevelSensor tiers!
   */
  triggerBloodMoonRevival(levelSensorPoints: number, masterMode: boolean): number {
    let revived = 0;
    for (const e of this.enemies) {
      if (e.species === 'calamity_ganon' || e.species === 'monk_maz_koshia' || e.species.endsWith('blight')) continue;
      if (!e.alive) {
        e.alive = true;
        e.tier = computeScaledEnemyTier(e.baseTier, levelSensorPoints, masterMode);
        e.hp = e.maxHp;
        e.position.copy(e.spawnPos);
        e.root.position.copy(e.spawnPos);
        e.root.visible = true;
        e.alertState = 'idle';
        e.glbInstance?.playClip('idle');
        revived++;
      }
    }
    return revived;
  }

  /**
   * Applies damage + knockback + optional elemental freeze/ragdoll (enabling BTB ragdoll bounce!).
   */
  damageEnemy(
    enemy: WorldEnemy,
    damage: number,
    knockbackDir: THREE.Vector3,
    opts: { freeze?: boolean; ragdoll?: boolean; onDeath?: (e: WorldEnemy) => void } = {}
  ): void {
    if (!enemy.alive) return;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.lastDamagedTimer = 0;
    enemy.hitFlashTimer = 0.18;
    enemy.alertState = 'chase';
    if (opts.freeze) {
      enemy.frozenTimer = 6.0;
      enemy.alertState = 'frozen';
    }
    if (opts.ragdoll && !enemy.isBoss) {
      enemy.ragdollTimer = 2.4;
      enemy.velocity.copy(knockbackDir).multiplyScalar(11.5);
      enemy.velocity.y = 6.5;
    } else {
      enemy.velocity.addScaledVector(knockbackDir, 5.5);
    }

    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.glbInstance?.playClip('die');
      enemy.root.visible = false;
      if (enemy.guardianLaserMesh) enemy.guardianLaserMesh.visible = false;
      opts.onDeath?.(enemy);
    }
  }

  /**
   * Stasis+ freezes an enemy in front of Link (5s Red/Blue, 2s Black/Silver/Boss per spec!).
   */
  tryStasisEnemy(origin: THREE.Vector3, forward: THREE.Vector3, upgraded: boolean): WorldEnemy | null {
    if (!upgraded) return null;
    let best: WorldEnemy | null = null;
    let bestD = 20;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = e.position.distanceTo(origin);
      if (d < bestD && e.position.clone().sub(origin).normalize().dot(forward) > 0.35) {
        bestD = d;
        best = e;
      }
    }
    if (best) {
      best.stasisTimer = best.tier === 'red' || best.tier === 'blue' ? 5.0 : 2.0;
      best.alertState = 'stasis';
      best.glbInstance?.setStasisGlow(1.0);
    }
    return best;
  }

  /**
   * Spawns a Yiga Clan ambush attacker on the road!
   */
  spawnYigaAmbush(pos: THREE.Vector3, thunderHelmRecovered: boolean): WorldEnemy {
    const isBlademaster = thunderHelmRecovered && Math.random() < 0.35;
    return this.spawnEnemy({
      id: `yiga_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      species: isBlademaster ? 'yiga_blademaster' : 'yiga_footsoldier',
      nameJa: isBlademaster ? 'イーガ団 幹部' : 'イーガ団 構成員',
      tier: isBlademaster ? 'black' : 'red',
      x: pos.x,
      z: pos.z,
      maxHp: isBlademaster ? 400 : 72,
      atk: isBlademaster ? 28 : 16,
      yigaBlademaster: isBlademaster,
    });
  }

  update(
    dt: number,
    timeSec: number,
    playerPos: THREE.Vector3,
    opts: {
      masterMode: boolean;
      stealthLevel: number;
      disguises: string[];
      physics?: PhysicsChemistryEngine;
      onEnemyAttackPlayer: (enemy: WorldEnemy, damage: number, isLaser: boolean) => void;
      onReflectBeamHitEnemy: (enemy: WorldEnemy, damage: number) => void;
    }
  ): { inCombat: boolean; guardianLocked: boolean; activeBoss: WorldEnemy | null } {
    let inCombat = false;
    let guardianLocked = false;
    let activeBoss: WorldEnemy | null = null;

    // 1. Update Enemies (culled beyond 130m for steady 60fps!)
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dist = e.position.distanceTo(playerPos);
      if (dist > 135) continue;

      if (e.isBoss && dist < 52) {
        activeBoss = e;
      }

      // Master Mode HP Regeneration after 6 seconds undamaged!
      e.lastDamagedTimer += dt;
      if (opts.masterMode && e.lastDamagedTimer > 6.0 && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
      }

      // Stasis+ / Ice Freeze pause
      if (e.stasisTimer > 0) {
        e.stasisTimer -= dt;
        if (e.stasisTimer <= 0) {
          e.alertState = 'chase';
          e.glbInstance?.setStasisGlow(0);
        }
        continue;
      }
      if (e.frozenTimer > 0) {
        e.frozenTimer -= dt;
        if (e.frozenTimer <= 0) e.alertState = 'chase';
        continue;
      }

      e.glbInstance?.mixer?.update(dt);
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.ragdollTimer = Math.max(0, e.ragdollTimer - dt);

      // Physics knockback & gravity integration
      if (e.velocity.lengthSq() > 0.01) {
        e.velocity.y -= 22 * dt;
        e.position.addScaledVector(e.velocity, dt);
        const gy = getTerrainHeight(e.position.x, e.position.z);
        if (e.position.y <= gy) {
          e.position.y = gy;
          e.velocity.y = 0;
          e.velocity.x *= Math.pow(0.05, dt);
          e.velocity.z *= Math.pow(0.05, dt);
        }
      } else {
        e.position.y = getTerrainHeight(e.position.x, e.position.z);
      }
      if (e.isHoverCaster && e.ragdollTimer <= 0) {
        const hoverBase = e.species === 'wizzrobe' ? 1.15 : 0.35;
        e.position.y = getTerrainHeight(e.position.x, e.position.z) + hoverBase + Math.sin(timeSec * 2.8 + e.spawnPos.x) * 0.28;
      }

      // Monster Mask / Majora's Mask Disguise & Stealth detection radius!
      const isDisguised =
        opts.disguises.includes('majora') ||
        opts.disguises.includes(e.species) ||
        (opts.disguises.includes('stal') && (e.species === 'stal_bokoblin' || e.species === 'stal_moblin' || e.species === 'stal_mage'));
      const detectRadius = isDisguised ? 4.5 : Math.max(9, (e.isGuardian ? 38 : e.isHoverCaster ? 26 : 22) - opts.stealthLevel * 4.5);

      if (dist < detectRadius && !isDisguised) {
        inCombat = true;
        const toPlayer = playerPos.clone().sub(e.position);
        e.yaw = Math.atan2(toPlayer.x, toPlayer.z);

        if (e.isGuardian) {
          guardianLocked = true;
          e.guardianCharge += dt * 0.42;
          if (e.guardianLaserMesh) {
            e.guardianLaserMesh.visible = true;
            const eyeW = e.position.clone().add(new THREE.Vector3(0, e.species === 'guardian_stalker' ? 4.4 : 2.8, 0));
            const targetW = playerPos.clone().add(new THREE.Vector3(0, 1.1, 0));
            e.guardianLaserMesh.lookAt(targetW);
            e.guardianLaserMesh.scale.set(1, 1, eyeW.distanceTo(targetW));
          }
          if (e.guardianCharge >= 1.0) {
            e.guardianCharge = 0;
            this.fireGuardianBeam(e, playerPos);
          }
          if (e.species === 'guardian_stalker' && dist > 16) {
            e.position.x += Math.sin(e.yaw) * 4.4 * dt;
            e.position.z += Math.cos(e.yaw) * 4.4 * dt;
          }
        } else if (e.isHoverCaster) {
          // Strafe gracefully while maintaining casting range & firing elemental magic orbs!
          const orbitDir = e.yaw + Math.PI * 0.42;
          const moveSpd = dist < 8 ? -2.4 : dist > 16 ? 3.2 : 2.0;
          e.position.x += (dist > 16 ? Math.sin(e.yaw) : Math.sin(orbitDir)) * moveSpd * dt;
          e.position.z += (dist > 16 ? Math.cos(e.yaw) : Math.cos(orbitDir)) * moveSpd * dt;
          if (e.attackCooldown <= 0) {
            e.attackCooldown = 3.0;
            e.glbInstance?.playClip('attack');
            this.fireWizzrobeOrb(e, playerPos);
          } else {
            e.glbInstance?.playClip('walk');
          }
        } else if (dist > e.radius + 1.55) {
          const speed = e.species === 'lynel' || e.species === 'lizalfos' ? 6.2 : e.species === 'hinox' ? 3.2 : 4.2;
          e.position.x += Math.sin(e.yaw) * speed * dt;
          e.position.z += Math.cos(e.yaw) * speed * dt;
          e.glbInstance?.playClip('run');
        } else if (e.attackCooldown <= 0) {
          e.attackCooldown = 2.1;
          e.glbInstance?.playClip('attack');
          opts.onEnemyAttackPlayer(e, e.attack, false);
        }

        // Prevent non-flying ground enemies from clipping through shrine/castle/village walls
        if (opts.physics && !e.isHoverCaster && e.species !== 'windblight' && e.species !== 'calamity_ganon') {
          opts.physics.resolveCapsuleCollision(e.position, Math.min(1.6, Math.max(0.55, e.radius)), 2.2, 0.55);
        }
      } else {
        if (e.guardianLaserMesh) e.guardianLaserMesh.visible = false;
        e.guardianCharge = Math.max(0, e.guardianCharge - dt * 0.8);
        e.glbInstance?.playClip('idle');
      }

      e.root.position.copy(e.position);
      e.root.rotation.y = e.yaw;
      if (e.ragdollTimer > 0) {
        e.root.rotation.x = Math.PI * 0.45;
      } else {
        e.root.rotation.x = 0;
      }
    }

    // 2. Update Projectiles & Guardian Beams (reflectable via Perfect Guard!)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.position.addScaledVector(p.velocity, dt);
      p.mesh.position.copy(p.position);

      if (p.fromEnemy) {
        if (p.position.distanceTo(playerPos.clone().add(new THREE.Vector3(0, 1.0, 0))) < 1.35) {
          opts.onEnemyAttackPlayer(p.attacker, p.damage, p.isGuardianLaser);
          this.group.remove(p.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        // Reflected Guardian Laser Beam slamming back into Guardians/Enemies!
        let hit = false;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (p.position.distanceTo(e.position.clone().add(new THREE.Vector3(0, 1.5, 0))) < e.radius + 1.4) {
            opts.onReflectBeamHitEnemy(e, p.damage);
            hit = true;
            break;
          }
        }
        if (hit) {
          this.group.remove(p.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      if (p.life <= 0) {
        this.group.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 3. Animate the 3 Sacred Sky Dragons along sweeping aerial arcs!
    for (const d of this.dragons) {
      d.phase += dt * d.speed;
      for (let i = 0; i < d.segments.length; i++) {
        const t = d.phase - i * 0.055;
        const sx = d.center.x + Math.cos(t) * d.radiusX;
        const sz = d.center.z + Math.sin(t) * d.radiusZ;
        const sy = d.altitude + Math.sin(t * 3.0) * 14.0;
        d.segments[i].position.set(sx, sy, sz);
      }
    }

    return { inCombat, guardianLocked, activeBoss };
  }

  private fireWizzrobeOrb(caster: WorldEnemy, playerPos: THREE.Vector3): void {
    const start = caster.position.clone().add(new THREE.Vector3(0, 1.65, 0));
    const dir = playerPos.clone().add(new THREE.Vector3(0, 1.0, 0)).sub(start).normalize();
    const col =
      caster.casterElement === 'ice'
        ? '#68ecff'
        : caster.casterElement === 'fire'
        ? '#ff6a22'
        : '#d678ff';
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.36, 1),
      new THREE.MeshBasicMaterial({ color: col })
    );
    mesh.position.copy(start);
    this.group.add(mesh);

    this.projectiles.push({
      id: `orb_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      attacker: caster,
      fromEnemy: true,
      isGuardianLaser: false,
      position: start,
      velocity: dir.multiplyScalar(15.5),
      damage: caster.attack,
      life: 3.2,
      mesh,
    });
  }

  private fireGuardianBeam(guardian: WorldEnemy, playerPos: THREE.Vector3): void {
    const start = guardian.position.clone().add(new THREE.Vector3(0, guardian.species === 'guardian_stalker' ? 4.4 : 2.8, 0));
    const dir = playerPos.clone().add(new THREE.Vector3(0, 1.0, 0)).sub(start).normalize();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#42ecff' })
    );
    mesh.position.copy(start);
    this.group.add(mesh);

    this.projectiles.push({
      id: `beam_${Date.now()}`,
      attacker: guardian,
      fromEnemy: true,
      isGuardianLaser: true,
      position: start,
      velocity: dir.multiplyScalar(32.0),
      damage: 44,
      life: 3.5,
      mesh,
    });
  }

  /**
   * Reflects an incoming Guardian laser right back at the shooter on Perfect Guard!
   */
  reflectNearestBeam(playerPos: THREE.Vector3): boolean {
    for (const p of this.projectiles) {
      if (p.fromEnemy && p.position.distanceTo(playerPos.clone().add(new THREE.Vector3(0, 1.0, 0))) < 5.5) {
        p.fromEnemy = false;
        p.velocity.negate().multiplyScalar(1.35);
        p.damage = 500; // Authentic BotW beam parry deals 500 dmg (one-shots Decayed, 3-shots Stalker!)
        p.life = 4.0;
        (p.mesh.material as THREE.MeshBasicMaterial).color.set('#ffe64d');
        return true;
      }
    }
    return false;
  }
}
