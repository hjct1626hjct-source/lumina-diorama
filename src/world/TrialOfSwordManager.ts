import * as THREE from 'three';
import { createBotWToonMaterial } from '../rendering/BotWToonShader';
import { textureBank } from '../rendering/ProceduralTextures';
import { setInteriorEnvironmentOverride } from './TerrainGenerator';
import { PhysicsChemistryEngine } from '../physics/PhysicsChemistryEngine';
import { MASTER_SWORD_STATS, WEAPONS, BOWS, SHIELDS } from '../data/itemsAndCooking';
import type { ArrowType, CookedMeal, SaveSlotData, WeaponDef } from '../types/botw';

export type StoredWeapon = WeaponDef & { currentDurability: number };

export const TRIAL_OF_SWORD_BASE_Y = 1500;
export const MASTER_SWORD_REQUIRED_HEARTS = 13;

export type TrialTier = 'beginning' | 'middle' | 'final';

export interface TrialTierMeta {
  tier: TrialTier;
  nameJa: string;
  totalFloors: number;
  restFloor: number;
  rewardAttack: number;
  rewardLabelJa: string;
}

export const TRIAL_TIER_METAS: Record<TrialTier, TrialTierMeta> = {
  beginning: {
    tier: 'beginning',
    nameJa: '剣の試練・序位',
    totalFloors: 5,
    restFloor: 3,
    rewardAttack: 40,
    rewardLabelJa: 'マスターソード攻撃力 30 → 40 覚醒！',
  },
  middle: {
    tier: 'middle',
    nameJa: '剣の試練・中位',
    totalFloors: 6,
    restFloor: 4,
    rewardAttack: 50,
    rewardLabelJa: 'マスターソード攻撃力 40 → 50 覚醒！',
  },
  final: {
    tier: 'final',
    nameJa: '剣の試練・極位',
    totalFloors: 7,
    restFloor: 4,
    rewardAttack: 60,
    rewardLabelJa: 'マスターソード真の覚醒！攻撃力 60・耐久188・常時青い輝き！',
  },
};

export interface InventorySnapshot {
  weapons: StoredWeapon[];
  bows: StoredWeapon[];
  shields: StoredWeapon[];
  equippedWeaponId: string | null;
  equippedBowId: string | null;
  equippedShieldId: string | null;
  equippedArmor: { head: string | null; body: string | null; legs: string | null };
  meals: CookedMeal[];
  materials: Record<string, number>;
  arrows: Record<ArrowType, number>;
  equippedArrow: ArrowType;
}

export interface TrialEnemy {
  id: string;
  nameJa: string;
  kind: 'bokoblin' | 'moblin' | 'lizalfos' | 'guardian' | 'lynel';
  hp: number;
  maxHp: number;
  atk: number;
  position: THREE.Vector3;
  mesh: THREE.Group;
  attackTimer: number;
  dead: boolean;
}

export interface TrialPickup {
  id: string;
  kind: 'weapon' | 'bow' | 'shield' | 'fairy' | 'chest';
  defId?: string;
  labelJa: string;
  position: THREE.Vector3;
  mesh: THREE.Group;
  collected: boolean;
}

export interface TrialInteractPrompt {
  id: string;
  kind: 'pickup' | 'warp_next' | 'exit';
  label: string;
  distance: number;
}

/**
 * Pure helper: checks whether Link has >= 13 hearts to pull the Master Sword.
 */
export function canPullMasterSword(save: SaveSlotData): {
  ok: boolean;
  requiredHearts: number;
  currentHearts: number;
} {
  return {
    ok: save.maxHearts >= MASTER_SWORD_REQUIRED_HEARTS,
    requiredHearts: MASTER_SWORD_REQUIRED_HEARTS,
    currentHearts: save.maxHearts,
  };
}

/**
 * Pure helper: pulls Master Sword from Korok Forest pedestal if maxHearts >= 13.
 */
export function pullMasterSword(save: SaveSlotData): { pulled: boolean; messageJa: string } {
  const owned = save.hasMasterSword || save.weapons.some((w) => w.id === 'master_sword');
  if (owned) {
    return { pulled: false, messageJa: 'すでにマスターソードを所持しています。' };
  }
  const check = canPullMasterSword(save);
  if (!check.ok) {
    return {
      pulled: false,
      messageJa: `デクの樹サマ「まだその時ではない… 退魔の剣を抜くにはハートが${check.requiredHearts}個必要じゃ（現在 ${check.currentHearts}個）」`,
    };
  }
  const msDef = WEAPONS.find((w) => w.id === 'master_sword');
  if (msDef) {
    save.weapons.push({ ...msDef, currentDurability: MASTER_SWORD_STATS.baseDurability });
  }
  save.hasMasterSword = true;
  save.equippedWeaponId = 'master_sword';
  save.storyFlags.master_sword_pulled = true;
  return {
    pulled: true,
    messageJa: '✨ 退魔の剣【マスターソード】を引き抜いた！（攻撃力30・耐久40）\nもう一度台座を調べるとDLC「剣の試練」に挑戦できます！',
  };
}

/**
 * Pure helper: computes Master Sword's staged awakening stats from Trial of the Sword flags.
 */
export function getMasterSwordAwakeningStats(save: SaveSlotData): {
  stage: 0 | 1 | 2 | 3;
  attack: number;
  durability: number;
  awakened: boolean;
} {
  if (save.masterSwordAwakened || save.storyFlags.trial_final_cleared) {
    return {
      stage: 3,
      attack: MASTER_SWORD_STATS.awakenedAttack,
      durability: MASTER_SWORD_STATS.awakenedDurability,
      awakened: true,
    };
  }
  if (save.storyFlags.trial_middle_cleared) {
    return { stage: 2, attack: 50, durability: 120, awakened: false };
  }
  if (save.storyFlags.trial_beginning_cleared) {
    return { stage: 1, attack: 40, durability: 80, awakened: false };
  }
  return {
    stage: 0,
    attack: MASTER_SWORD_STATS.baseAttack,
    durability: MASTER_SWORD_STATS.baseDurability,
    awakened: false,
  };
}

/**
 * Pure helper: records Trial of the Sword clear flag and upgrades Master Sword in save.
 */
export function applyTrialClearAwakening(save: SaveSlotData, tier: TrialTier): {
  attack: number;
  durability: number;
  awakened: boolean;
  messageJa: string;
} {
  if (tier === 'beginning') save.storyFlags.trial_beginning_cleared = true;
  if (tier === 'middle') save.storyFlags.trial_middle_cleared = true;
  if (tier === 'final') {
    save.storyFlags.trial_final_cleared = true;
    save.masterSwordAwakened = true;
  }
  const stats = getMasterSwordAwakeningStats(save);
  const ms = save.weapons.find((w) => w.id === 'master_sword');
  if (ms) {
    ms.attack = stats.attack;
    ms.durability = stats.durability;
    ms.currentDurability = stats.durability;
  }
  return {
    attack: stats.attack,
    durability: stats.durability,
    awakened: stats.awakened,
    messageJa: `⚔️ ${TRIAL_TIER_METAS[tier].nameJa} 制覇！ ${TRIAL_TIER_METAS[tier].rewardLabelJa}`,
  };
}

function cloneSnapshot(save: SaveSlotData): InventorySnapshot {
  return {
    weapons: save.weapons.map((w) => ({ ...w })),
    bows: save.bows.map((b) => ({ ...b })),
    shields: save.shields.map((s) => ({ ...s })),
    equippedWeaponId: save.equippedWeaponId,
    equippedBowId: save.equippedBowId,
    equippedShieldId: save.equippedShieldId,
    equippedArmor: { ...save.equippedArmor },
    meals: save.meals.map((m) => ({ ...m })),
    materials: { ...save.materials },
    arrows: { ...save.arrows },
    equippedArrow: save.equippedArrow,
  };
}

function restoreSnapshot(save: SaveSlotData, snap: InventorySnapshot): void {
  save.weapons = snap.weapons.map((w) => ({ ...w }));
  save.bows = snap.bows.map((b) => ({ ...b }));
  save.shields = snap.shields.map((s) => ({ ...s }));
  save.equippedWeaponId = snap.equippedWeaponId;
  save.equippedBowId = snap.equippedBowId;
  save.equippedShieldId = snap.equippedShieldId;
  save.equippedArmor = { ...snap.equippedArmor };
  save.meals = snap.meals.map((m) => ({ ...m }));
  save.materials = { ...snap.materials };
  save.arrows = { ...snap.arrows };
  save.equippedArrow = snap.equippedArrow;
}

/**
 * DLC 1 "Trial of the Sword" 3D Arena Manager (Y=1500):
 * - Snapshots & isolates overworld inventory (naked & unarmed + Runes only)
 * - 100% restores overworld inventory on clear, exit, or game-over
 * - Protects auto-save persistence from ever overwriting real inventory
 * - Beginning (5F), Middle (6F), Final (7F incl. Guardian & Lynel) with Rest Floors
 */
export class TrialOfSwordManager {
  public readonly group = new THREE.Group();
  public activeTier: TrialTier | null = null;
  public currentFloor = 0;
  public overworldReturnPos = new THREE.Vector3();
  public overworldReturnYaw = 0;

  public enemies: TrialEnemy[] = [];
  public pickups: TrialPickup[] = [];
  public floorCleared = false;

  private arenaGroup = new THREE.Group();
  private physics: PhysicsChemistryEngine;
  private snapshot: InventorySnapshot | null = null;
  private warpPos = new THREE.Vector3(0, TRIAL_OF_SWORD_BASE_Y, -16.5);
  private warpMesh: THREE.Mesh | null = null;
  private exitPos = new THREE.Vector3(0, TRIAL_OF_SWORD_BASE_Y, 17.5);
  private arenaTime = 0;

  private stoneMat!: THREE.MeshToonMaterial;
  private darkMat!: THREE.MeshToonMaterial;
  private cyanMat!: THREE.MeshToonMaterial;
  private amberMat!: THREE.MeshToonMaterial;
  private enemyMat!: THREE.MeshToonMaterial;

  constructor(scene: THREE.Scene, physics: PhysicsChemistryEngine) {
    this.physics = physics;
    this.group.name = 'TrialOfSwordRoot';
    this.group.visible = false;
    this.group.add(this.arenaGroup);
    scene.add(this.group);
    this.initMaterials();
  }

  private initMaterials(): void {
    const hasDom = typeof document !== 'undefined';
    const shTex = hasDom ? textureBank.getSheikahStoneTexture() : null;
    this.stoneMat = createBotWToonMaterial({
      color: '#465260',
      map: shTex?.map,
      emissive: '#101824',
      emissiveIntensity: 0.28,
    });
    this.darkMat = createBotWToonMaterial({
      color: '#202630',
      emissive: '#0c1018',
      emissiveIntensity: 0.35,
    });
    this.cyanMat = createBotWToonMaterial({
      color: '#3ae6ff',
      emissive: '#18c8ff',
      emissiveIntensity: 1.4,
    });
    this.amberMat = createBotWToonMaterial({
      color: '#ff9824',
      emissive: '#ff6410',
      emissiveIntensity: 1.1,
    });
    this.enemyMat = createBotWToonMaterial({
      color: '#b83834',
      emissive: '#401010',
      emissiveIntensity: 0.3,
    });
  }

  public isActive(): boolean {
    return this.activeTier !== null;
  }

  public getFloorLabel(): string {
    if (!this.activeTier) return '';
    const meta = TRIAL_TIER_METAS[this.activeTier];
    const isRest = this.currentFloor === meta.restFloor;
    return `${meta.nameJa} 第${this.currentFloor}/${meta.totalFloors}層${isRest ? '（休憩の間）' : ''}`;
  }

  /**
   * Returns a save copy that preserves the player's real overworld inventory while inside the Trial.
   */
  public getSafeSaveForPersistence(liveSave: SaveSlotData): SaveSlotData {
    if (!this.snapshot) return liveSave;
    const copy: SaveSlotData = { ...liveSave };
    restoreSnapshot(copy, this.snapshot);
    return copy;
  }

  /**
   * Enters the Trial of the Sword: snapshots real inventory, strips equipment (naked & unarmed),
   * and builds Floor 1 at Y=1500.
   */
  public enterTrial(
    tier: TrialTier,
    save: SaveSlotData,
    overworldPos: THREE.Vector3,
    overworldYaw: number
  ): { spawnPos: THREE.Vector3; spawnYaw: number; meta: TrialTierMeta } {
    this.snapshot = cloneSnapshot(save);
    // Strip to naked & unarmed (Sheikah Runes remain active!)
    save.weapons = [];
    save.bows = [];
    save.shields = [];
    save.equippedWeaponId = null;
    save.equippedBowId = null;
    save.equippedShieldId = null;
    save.equippedArmor = { head: null, body: null, legs: null };
    save.meals = [];
    save.materials = {};
    save.arrows = { normal: 5, fire: 0, ice: 0, shock: 0, bomb: 0, ancient: 0 };
    save.equippedArrow = 'normal';

    this.activeTier = tier;
    this.currentFloor = 1;
    this.overworldReturnPos.copy(overworldPos);
    this.overworldReturnYaw = overworldYaw;
    this.arenaTime = 0;

    this.physics.enterInteriorContext();
    setInteriorEnvironmentOverride({
      getFloorY: () => TRIAL_OF_SWORD_BASE_Y,
      getWaterLevel: () => null,
    });

    this.buildFloor(tier, 1);
    this.group.visible = true;
    return {
      spawnPos: new THREE.Vector3(0, TRIAL_OF_SWORD_BASE_Y, 14.0),
      spawnYaw: Math.PI,
      meta: TRIAL_TIER_METAS[tier],
    };
  }

  /**
   * Advances to the next floor, or completes the Trial if already on the final floor!
   */
  public advanceFloor(save: SaveSlotData): {
    completed: boolean;
    nextFloor: number;
    spawnPos: THREE.Vector3;
    awakeningMessage?: string;
    returnPos?: THREE.Vector3;
    returnYaw?: number;
  } {
    if (!this.activeTier) {
      return { completed: false, nextFloor: 0, spawnPos: new THREE.Vector3() };
    }
    const meta = TRIAL_TIER_METAS[this.activeTier];
    if (this.currentFloor >= meta.totalFloors) {
      const res = this.exitTrial(save, true);
      return {
        completed: true,
        nextFloor: 0,
        spawnPos: res.returnPos,
        awakeningMessage: res.awakeningMessage,
        returnPos: res.returnPos,
        returnYaw: res.returnYaw,
      };
    }

    this.currentFloor += 1;
    this.buildFloor(this.activeTier, this.currentFloor);
    return {
      completed: false,
      nextFloor: this.currentFloor,
      spawnPos: new THREE.Vector3(0, TRIAL_OF_SWORD_BASE_Y, 14.0),
    };
  }

  /**
   * Exits Trial of the Sword (on clear, voluntary retreat, or game-over),
   * 100% restoring the snapshotted overworld inventory.
   */
  public exitTrial(
    save: SaveSlotData,
    cleared: boolean
  ): { returnPos: THREE.Vector3; returnYaw: number; awakeningMessage?: string } {
    const tier = this.activeTier;
    if (this.snapshot) {
      restoreSnapshot(save, this.snapshot);
      this.snapshot = null;
    }

    let awakeningMessage: string | undefined;
    if (cleared && tier) {
      const aw = applyTrialClearAwakening(save, tier);
      awakeningMessage = aw.messageJa;
    }

    this.clearFloorGeometry();
    this.physics.exitInteriorContext();
    setInteriorEnvironmentOverride(null);
    this.group.visible = false;
    this.activeTier = null;
    this.currentFloor = 0;

    return {
      returnPos: this.overworldReturnPos.clone(),
      returnYaw: this.overworldReturnYaw,
      awakeningMessage,
    };
  }

  private clearFloorGeometry(): void {
    while (this.arenaGroup.children.length > 0) {
      this.arenaGroup.remove(this.arenaGroup.children[0]);
    }
    this.enemies = [];
    this.pickups = [];
    this.warpMesh = null;
    this.floorCleared = false;
  }

  private buildFloor(tier: TrialTier, floorNum: number): void {
    this.clearFloorGeometry();
    const y0 = TRIAL_OF_SWORD_BASE_Y;
    const meta = TRIAL_TIER_METAS[tier];
    const isRest = floorNum === meta.restFloor;

    const amb = new THREE.AmbientLight(isRest ? '#a8e4ff' : '#88a8c8', 0.9);
    const key = new THREE.DirectionalLight('#fff0d8', 0.95);
    key.position.set(14, y0 + 26, 16);
    this.arenaGroup.add(amb, key);

    // Arena floor slab (42m x 42m)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(42, 2.0, 42), this.stoneMat);
    floor.position.set(0, y0 - 1.0, 0);
    floor.receiveShadow = true;
    this.arenaGroup.add(floor);

    // Perimeter containment walls
    this.physics.addBoxCollider('tos_w_n', 0, -21, 44, 1.5, y0, y0 + 18);
    this.physics.addBoxCollider('tos_w_s', 0, 21, 44, 1.5, y0, y0 + 18);
    this.physics.addBoxCollider('tos_w_w', -21, 0, 1.5, 44, y0, y0 + 18);
    this.physics.addBoxCollider('tos_w_e', 21, 0, 1.5, 44, y0, y0 + 18);

    // 4 Corner Pillars
    for (const [px, pz] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 14, 2.4), this.darkMat);
      pillar.position.set(px, y0 + 7, pz);
      this.arenaGroup.add(pillar);
    }

    // Warp Pad to next floor (lights up cyan when floorCleared)
    const warp = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.5, 0.35, 18),
      (isRest ? this.cyanMat : this.amberMat).clone()
    );
    warp.position.set(this.warpPos.x, y0 + 0.18, this.warpPos.z);
    this.arenaGroup.add(warp);
    this.warpMesh = warp;

    if (isRest) {
      this.floorCleared = true;
      this.spawnPickup('fairy_rest', 'fairy', undefined, '大妖精の泉の妖精（ハート全回復）', -4.5, 0);
      this.spawnPickup(
        'chest_rest',
        'chest',
        tier === 'final' ? 'royal_broadsword' : tier === 'middle' ? 'knights_broadsword' : 'soldiers_broadsword',
        '休憩の間の宝箱（強力な武器＆弓＆矢）',
        4.5,
        0
      );
      return;
    }

    // Combat floor pickups
    const weaponId =
      tier === 'final'
        ? floorNum >= 5
          ? 'royal_broadsword'
          : 'knights_broadsword'
        : tier === 'middle'
          ? 'knights_broadsword'
          : floorNum >= 2
            ? 'soldiers_broadsword'
            : 'travelers_sword';
    this.spawnPickup(`wpn_${floorNum}`, 'weapon', weaponId, `床の武器を拾う（${WEAPONS.find((w) => w.id === weaponId)?.nameJa ?? '剣'}）`, -5.5, 8.5);
    this.spawnPickup(`bow_${floorNum}`, 'bow', tier === 'final' ? 'savage_lynel_bow' : 'travelers_bow', '試練の弓＆矢10本を拾う', 5.5, 8.5);
    if (floorNum === 1 || floorNum === 5) {
      this.spawnPickup(`shd_${floorNum}`, 'shield', tier === 'final' ? 'royal_shield' : 'travelers_shield', '試練の盾を拾う', 0, 10.5);
    }

    // Spawn floor enemies
    if (tier === 'final' && floorNum === 6) {
      this.spawnEnemy('tos_guard', 'ガーディアン（歩行型）', 'guardian', 500, 16, 0, -7);
    } else if (tier === 'final' && floorNum === 7) {
      this.spawnEnemy('tos_lynel', '白銀ライネル（試練極位）', 'lynel', 680, 18, 0, -8);
      this.spawnEnemy('tos_boko_s', 'ボコブリン（援護）', 'bokoblin', 60, 8, -8, -4);
    } else {
      const count = Math.min(4, 2 + Math.floor(floorNum / 2));
      const baseHp = tier === 'final' ? 110 : tier === 'middle' ? 75 : 45;
      const baseAtk = tier === 'final' ? 12 : tier === 'middle' ? 9 : 6;
      for (let i = 0; i < count; i++) {
        const ex = (i - (count - 1) / 2) * 6.5;
        const ez = -5.5 - (i % 2) * 4.0;
        const kind: TrialEnemy['kind'] = i === 0 && floorNum >= 3 ? 'moblin' : i === count - 1 && floorNum >= 2 ? 'lizalfos' : 'bokoblin';
        const nameJa = kind === 'moblin' ? 'モリブリン' : kind === 'lizalfos' ? 'リザルフォス' : 'ボコブリン';
        this.spawnEnemy(`tos_e_${floorNum}_${i}`, nameJa, kind, baseHp + floorNum * 12, baseAtk, ex, ez);
      }
    }
  }

  private spawnEnemy(
    id: string,
    nameJa: string,
    kind: TrialEnemy['kind'],
    maxHp: number,
    atk: number,
    x: number,
    z: number
  ): void {
    const y0 = TRIAL_OF_SWORD_BASE_Y;
    const grp = new THREE.Group();
    const scale = kind === 'lynel' || kind === 'guardian' ? 1.65 : kind === 'moblin' ? 1.25 : 1.0;
    const body = new THREE.Mesh(
      kind === 'guardian' ? new THREE.ConeGeometry(1.5, 2.4, 8) : new THREE.CapsuleGeometry(0.65 * scale, 1.1 * scale, 6, 10),
      kind === 'guardian' ? this.darkMat : this.enemyMat
    );
    body.position.y = 1.2 * scale;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale, 8, 8), this.amberMat);
    eye.position.set(0, 1.7 * scale, 0.65 * scale);
    grp.add(body, eye);
    grp.position.set(x, y0, z);
    this.arenaGroup.add(grp);

    this.enemies.push({
      id,
      nameJa,
      kind,
      hp: maxHp,
      maxHp,
      atk,
      position: new THREE.Vector3(x, y0, z),
      mesh: grp,
      attackTimer: 1.8 + Math.random() * 1.2,
      dead: false,
    });
  }

  private spawnPickup(
    id: string,
    kind: TrialPickup['kind'],
    defId: string | undefined,
    labelJa: string,
    x: number,
    z: number
  ): void {
    const y0 = TRIAL_OF_SWORD_BASE_Y;
    const grp = new THREE.Group();
    const mat = kind === 'fairy' ? this.cyanMat : this.amberMat;
    const mesh = new THREE.Mesh(
      kind === 'chest' ? new THREE.BoxGeometry(1.4, 1.0, 0.9) : new THREE.OctahedronGeometry(0.55, 1),
      mat
    );
    mesh.position.y = kind === 'chest' ? 0.5 : 0.9;
    grp.add(mesh);
    grp.position.set(x, y0, z);
    this.arenaGroup.add(grp);

    this.pickups.push({
      id,
      kind,
      defId,
      labelJa,
      position: new THREE.Vector3(x, y0, z),
      mesh: grp,
      collected: false,
    });
  }

  public collectPickup(pickupId: string, save: SaveSlotData): string {
    const p = this.pickups.find((x) => x.id === pickupId && !x.collected);
    if (!p) return '';
    p.collected = true;
    p.mesh.visible = false;

    if (p.kind === 'fairy') {
      save.hearts = save.maxHearts;
      return '🧚 妖精の癒しでハートが全回復した！';
    }
    if (p.kind === 'weapon' && p.defId) {
      const def = WEAPONS.find((w) => w.id === p.defId);
      if (def) {
        save.weapons.push({ ...def, currentDurability: def.durability });
        save.equippedWeaponId = def.id;
      }
      return `⚔️ ${def?.nameJa ?? '武器'} を拾って装備した！`;
    }
    if (p.kind === 'bow' && p.defId) {
      const def = BOWS.find((b) => b.id === p.defId);
      if (def) {
        save.bows.push({ ...def, currentDurability: def.durability });
        save.equippedBowId = def.id;
      }
      save.arrows.normal += 10;
      return `🏹 ${def?.nameJa ?? '弓'} と木の矢×10を手に入れた！`;
    }
    if (p.kind === 'shield' && p.defId) {
      const def = SHIELDS.find((s) => s.id === p.defId);
      if (def) {
        save.shields.push({ ...def, currentDurability: def.durability });
        save.equippedShieldId = def.id;
      }
      return `🛡️ ${def?.nameJa ?? '盾'} を拾って装備した！`;
    }
    if (p.kind === 'chest' && p.defId) {
      const def = WEAPONS.find((w) => w.id === p.defId);
      if (def) {
        save.weapons.push({ ...def, currentDurability: def.durability });
        save.equippedWeaponId = def.id;
      }
      save.arrows.normal += 15;
      save.hearts = save.maxHearts;
      return `🎁 宝箱から ${def?.nameJa ?? '試練の剣'}・矢×15を入手しハートが回復した！`;
    }
    return '';
  }

  public onPlayerAttack(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    reach: number,
    damage: number,
    isArrow: boolean
  ): { hit: boolean; enemyNameJa?: string; killed?: boolean; floorClearedNow?: boolean } {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const to = e.position.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(origin);
      if (to.length() > reach + 1.8) continue;
      if (!isArrow && to.normalize().dot(dir) < 0.2) continue;

      e.hp = Math.max(0, e.hp - Math.max(8, damage));
      let killed = false;
      if (e.hp <= 0) {
        e.dead = true;
        e.mesh.visible = false;
        killed = true;
      }
      const allDead = this.enemies.every((x) => x.dead);
      let floorClearedNow = false;
      if (allDead && !this.floorCleared) {
        this.floorCleared = true;
        floorClearedNow = true;
        if (this.warpMesh) {
          const mat = this.warpMesh.material as THREE.MeshToonMaterial;
          mat.color.set('#3ae6ff');
          mat.emissive.set('#18c8ff');
        }
      }
      return { hit: true, enemyNameJa: e.nameJa, killed, floorClearedNow };
    }
    return { hit: false };
  }

  public getNearestInteractable(playerPos: THREE.Vector3): TrialInteractPrompt | null {
    if (!this.activeTier) return null;
    const candidates: TrialInteractPrompt[] = [];

    for (const p of this.pickups) {
      if (p.collected) continue;
      const d = playerPos.distanceTo(p.position);
      if (d <= 3.2) {
        candidates.push({ id: p.id, kind: 'pickup', label: p.labelJa, distance: d });
      }
    }

    const dWarp = playerPos.distanceTo(this.warpPos);
    if (dWarp <= 3.6 && this.floorCleared) {
      const meta = TRIAL_TIER_METAS[this.activeTier];
      candidates.push({
        id: 'tos_warp_next',
        kind: 'warp_next',
        label: this.currentFloor >= meta.totalFloors ? '祭壇へ進み、マスターソードを覚醒させる！' : `第${this.currentFloor + 1}層へワープする`,
        distance: dWarp,
      });
    }

    const dExit = playerPos.distanceTo(this.exitPos);
    if (dExit <= 3.2) {
      candidates.push({
        id: 'tos_exit',
        kind: 'exit',
        label: '剣の試練を中断してコログの森へ戻る（所持品を全復元）',
        distance: dExit,
      });
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] ?? null;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3
  ): { enemyHitPlayer?: { damage: number; isLaser: boolean; labelJa: string } } {
    if (!this.activeTier) return {};
    this.arenaTime += dt;

    for (const p of this.pickups) {
      if (!p.collected) p.mesh.rotation.y += dt * 1.8;
    }

    let enemyHitPlayer: { damage: number; isLaser: boolean; labelJa: string } | undefined;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const toPlayer = playerPos.clone().sub(e.position);
      const dist = Math.hypot(toPlayer.x, toPlayer.z);
      e.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      if (dist > 3.2 && e.kind !== 'guardian') {
        const speed = e.kind === 'lynel' ? 5.2 : 3.6;
        e.position.x += (toPlayer.x / dist) * speed * dt;
        e.position.z += (toPlayer.z / dist) * speed * dt;
        e.mesh.position.copy(e.position);
      }
      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && (dist < 4.5 || e.kind === 'guardian')) {
        enemyHitPlayer = {
          damage: e.atk,
          isLaser: e.kind === 'guardian',
          labelJa: `${e.nameJa}の攻撃！`,
        };
        e.attackTimer = e.kind === 'guardian' ? 3.4 : 2.3;
      }
    }
    return { enemyHitPlayer };
  }
}
