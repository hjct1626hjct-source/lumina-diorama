import * as THREE from 'three';
import { createBotWToonMaterial } from '../rendering/BotWToonShader';
import { textureBank } from '../rendering/ProceduralTextures';
import { setInteriorEnvironmentOverride } from './TerrainGenerator';
import { PhysicsChemistryEngine, type PhysicsBody } from '../physics/PhysicsChemistryEngine';
import { BOWS, MATERIALS, SHIELDS, WEAPONS } from '../data/itemsAndCooking';
import type { ShrineDef } from '../data/regions';
import type { RuneId, SaveSlotData } from '../types/botw';

export const SHRINE_INTERIOR_BASE_Y = 600;

export const PLATEAU_SHRINE_RUNE_MAP: Record<
  string,
  { runes: RuneId[]; labelJa: string; descJa: string }
> = {
  shrine_oman_au: {
    runes: ['magnesis'],
    labelJa: 'マグネキャッチ (Magnesis)',
    descJa: '金属製のオブジェクトを磁力で掴み、空間を自在に操作できるシーカーアイテム。',
  },
  shrine_ja_baij: {
    runes: ['bomb_round', 'bomb_square'],
    labelJa: 'リモコンバクダン（丸・四角）',
    descJa: '遠隔操作で起爆できる古代エネルギー爆弾。ひび割れた岩壁も粉砕できる。',
  },
  shrine_owa_daim: {
    runes: ['stasis'],
    labelJa: 'ビタロック (Stasis)',
    descJa: '物体の時間を停止し、与えた攻撃の運動エネルギーを蓄積して解き放つ。',
  },
  shrine_keh_namut: {
    runes: ['cryonis'],
    labelJa: 'アイスメイカー (Cryonis)',
    descJa: '水面から強固な氷柱を生成し、足場や仕掛けの押し上げに使える（最大3本）。',
  },
};

export interface ShrineInteractPrompt {
  id: string;
  kind: 'pedestal' | 'altar' | 'chest' | 'exit';
  label: string;
  distance: number;
}

export interface ShrineGuardianScout {
  id: string;
  nameJa: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  state: 'patrol' | 'charge' | 'cooldown' | 'dead';
  timer: number;
  stasisTimer: number;
  eyeMesh: THREE.Mesh;
  laserLine: THREE.Mesh;
  hitFlash: number;
}

interface DestructibleWall {
  id: string;
  colliderId: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  destroyed: boolean;
}

interface ShrineChestState {
  id: string;
  labelJa: string;
  rewardTextJa: string;
  rewardType: 'weapon' | 'bow' | 'shield' | 'material' | 'arrows';
  rewardId: string;
  rewardAmount: number;
  position: THREE.Vector3;
  opened: boolean;
  openAnim: number;
  root?: THREE.Group;
  lidPivot: THREE.Group;
  glowBeam: THREE.Mesh;
}

export interface ShrineEnterResult {
  shrine: ShrineDef;
  spawnPos: THREE.Vector3;
  spawnYaw: number;
}

/**
 * Realized 3D Shrine Interior Trial Engine:
 * - Dedicated chamber at Y=600 with isolated physics colliders, water basins, destructible walls,
 *   Magnesis bridges/doors, Stasis cogwheels & kinetic boulders, Cryonis gate-lifters, Guardian Scouts,
 *   Monk Rune Pedestal, hidden Treasure Chest, Monk Goal Altar (single-grant Spirit Orb), and Exit Pad.
 */
export class ShrineInteriorManager {
  public readonly group = new THREE.Group();
  public activeShrine: ShrineDef | null = null;
  public overworldReturnPos = new THREE.Vector3();
  public overworldReturnYaw = 0;

  private shrineGroup = new THREE.Group();
  private physics: PhysicsChemistryEngine;
  private pedestalPos: THREE.Vector3 | null = null;
  private pedestalCrystal: THREE.Mesh | null = null;
  private altarPos = new THREE.Vector3(0, SHRINE_INTERIOR_BASE_Y, -33.5);
  private exitPos = new THREE.Vector3(0, SHRINE_INTERIOR_BASE_Y, 18.5);
  private lastSafePos = new THREE.Vector3(0, SHRINE_INTERIOR_BASE_Y, 16.5);

  private chests: ShrineChestState[] = [];
  private destructibleWalls: DestructibleWall[] = [];
  public guardians: ShrineGuardianScout[] = [];

  // Interactive dynamic mechanisms
  private spinningGearBody: PhysicsBody | null = null;
  private gearAngle = 0;
  private kehGateMesh: THREE.Group | null = null;
  private kehGateLiftY = 0;
  private kehGateTargetLiftY = 0;
  private kehGateColliderId = 'shrine_keh_gate';
  private combatGateMesh: THREE.Group | null = null;
  private combatGateColliderId = 'shrine_combat_gate';
  private combatGateOpen = false;
  private switchPlatePos: THREE.Vector3 | null = null;
  private switchPlateMesh: THREE.Mesh | null = null;
  private switchCubeBody: PhysicsBody | null = null;
  private rollingBoulder: PhysicsBody | null = null;
  private blockerBoulder: PhysicsBody | null = null;
  private omanDoors: PhysicsBody[] = [];

  private waterZones: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; floorY: number; waterY: number }> = [];
  private floorPatches: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; floorY: (x: number, z: number) => number }> = [];

  private shrineTime = 0;
  private stoneMat!: THREE.MeshToonMaterial;
  private darkWallMat!: THREE.MeshToonMaterial;
  private trimCyanMat!: THREE.MeshToonMaterial;
  private trimAmberMat!: THREE.MeshToonMaterial;
  private metalMagMat!: THREE.MeshToonMaterial;

  constructor(scene: THREE.Scene, physics: PhysicsChemistryEngine) {
    this.physics = physics;
    this.group.name = 'ShrineInteriorRoot';
    this.group.visible = false;
    this.group.add(this.shrineGroup);
    scene.add(this.group);
    this.initMaterials();
  }

  private initMaterials(): void {
    const shTex = textureBank.getSheikahStoneTexture();
    const stoneTex = textureBank.getStoneMasonryTexture('#5c6670', '#313a42');
    this.stoneMat = createBotWToonMaterial({
      color: '#46525c',
      map: stoneTex.map,
      normalMap: stoneTex.normalMap,
      rimStrength: 0.25,
    });
    this.darkWallMat = createBotWToonMaterial({
      color: '#28323c',
      map: shTex.map,
      emissive: '#1078a8',
      emissiveMap: shTex.emissiveMap,
      emissiveIntensity: 0.55,
      sheikahCircuit: true,
      sheikahActivated: 1.0,
      rimStrength: 0.35,
    });
    this.trimCyanMat = createBotWToonMaterial({
      color: '#3ce6ff',
      emissive: '#1cc8ff',
      emissiveIntensity: 1.45,
      sheikahCircuit: true,
      sheikahActivated: 1.0,
    });
    this.trimAmberMat = createBotWToonMaterial({
      color: '#ffb03a',
      emissive: '#ff7d14',
      emissiveIntensity: 1.25,
    });
    this.metalMagMat = createBotWToonMaterial({
      color: '#5b6672',
      map: shTex.map,
      emissive: '#22aadd',
      emissiveMap: shTex.emissiveMap,
      emissiveIntensity: 0.45,
      metalHighlight: true,
    });
  }

  isActive(): boolean {
    return this.activeShrine !== null;
  }

  getSpawnPos(): THREE.Vector3 {
    return new THREE.Vector3(0, SHRINE_INTERIOR_BASE_Y, 16.5);
  }

  enterShrine(
    shrine: ShrineDef,
    save: SaveSlotData,
    returnPos: THREE.Vector3,
    returnYaw: number
  ): ShrineEnterResult {
    this.overworldReturnPos.copy(returnPos);
    this.overworldReturnYaw = returnYaw;
    this.activeShrine = shrine;
    this.shrineTime = 0;

    // Reset state
    this.clearChamberGeometry();
    this.physics.enterInteriorContext();

    // Register isolated floor/water heightfield for TerrainGenerator consumers
    setInteriorEnvironmentOverride({
      getFloorY: (x, z) => this.sampleInteriorFloorY(x, z),
      getWaterLevel: (x, z) => this.sampleInteriorWaterY(x, z),
    });

    this.buildBaseChamber(shrine);
    this.buildTrialForShrine(shrine, save);

    this.group.visible = true;
    const spawnPos = this.getSpawnPos();
    this.lastSafePos.copy(spawnPos);
    return { shrine, spawnPos, spawnYaw: 0 };
  }

  exitShrine(): { returnPos: THREE.Vector3; returnYaw: number } {
    this.clearChamberGeometry();
    this.physics.exitInteriorContext();
    setInteriorEnvironmentOverride(null);
    this.group.visible = false;
    this.activeShrine = null;
    return {
      returnPos: this.overworldReturnPos.clone(),
      returnYaw: this.overworldReturnYaw,
    };
  }

  private clearChamberGeometry(): void {
    while (this.shrineGroup.children.length > 0) {
      const child = this.shrineGroup.children[0];
      this.shrineGroup.remove(child);
    }
    this.chests = [];
    this.destructibleWalls = [];
    this.guardians = [];
    this.spinningGearBody = null;
    this.kehGateMesh = null;
    this.kehGateLiftY = 0;
    this.kehGateTargetLiftY = 0;
    this.combatGateMesh = null;
    this.combatGateOpen = false;
    this.switchPlatePos = null;
    this.switchPlateMesh = null;
    this.switchCubeBody = null;
    this.rollingBoulder = null;
    this.blockerBoulder = null;
    this.omanDoors = [];
    this.pedestalPos = null;
    this.pedestalCrystal = null;
    this.waterZones = [];
    this.floorPatches = [];
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
    return SHRINE_INTERIOR_BASE_Y;
  }

  private sampleInteriorWaterY(x: number, z: number): number | null {
    for (const w of this.waterZones) {
      if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ) {
        return w.waterY;
      }
    }
    return null;
  }

  private buildBaseChamber(shrine: ShrineDef): void {
    const y0 = SHRINE_INTERIOR_BASE_Y;

    // Atmosphere lighting inside shrine
    const amb = new THREE.AmbientLight('#4d8ab5', 0.92);
    const key = new THREE.DirectionalLight('#b4eaff', 0.85);
    key.position.set(6, y0 + 18, 12);
    const monkLight = new THREE.PointLight('#36e4ff', 2.4, 24);
    monkLight.position.set(0, y0 + 5.5, -33.5);
    const entLight = new THREE.PointLight('#44ccff', 1.8, 18);
    entLight.position.set(0, y0 + 4.5, 17);
    this.shrineGroup.add(amb, key, monkLight, entLight);

    // Outer perimeter enclosure walls (x in [-13.5..13.5], z in [-40..23], height 15m)
    this.addStaticRoomBox('shrine_wall_w', -14.2, -8.5, 1.8, 65, y0 - 8, y0 + 16, this.darkWallMat);
    this.addStaticRoomBox('shrine_wall_e', 14.2, -8.5, 1.8, 65, y0 - 8, y0 + 16, this.darkWallMat);
    this.addStaticRoomBox('shrine_wall_n', 0, -40.8, 30, 1.8, y0 - 8, y0 + 16, this.darkWallMat);
    this.addStaticRoomBox('shrine_wall_s', 0, 23.8, 30, 1.8, y0 - 8, y0 + 16, this.darkWallMat);

    // Vaulted dark ancient ceiling slab
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 66), this.darkWallMat);
    ceiling.position.set(0, y0 + 15.8, -8.5);
    this.shrineGroup.add(ceiling);

    // Repeating luminous Sheikah side pilasters along walls
    for (let pz = -34; pz <= 16; pz += 10) {
      for (const px of [-12.6, 12.6]) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(1.4, 14, 1.4), this.stoneMat);
        pil.position.set(px, y0 + 7, pz);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 12, 0.28), this.trimCyanMat);
        strip.position.set(px > 0 ? -0.72 : 0.72, 0, 0);
        pil.add(strip);
        this.shrineGroup.add(pil);
      }
    }

    // Entrance elevator pad (z = 18.5)
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 0.25, 24), this.stoneMat);
    pad.position.set(this.exitPos.x, y0 + 0.08, this.exitPos.z);
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.09, 8, 32), this.trimCyanMat);
    padRing.rotation.x = Math.PI / 2;
    padRing.position.set(this.exitPos.x, y0 + 0.22, this.exitPos.z);
    this.shrineGroup.add(pad, padRing);

    // Plateau rune pedestal (or guidance stone) near entrance
    if (PLATEAU_SHRINE_RUNE_MAP[shrine.id]) {
      this.pedestalPos = new THREE.Vector3(3.4, y0, 12.5);
      const pedGrp = new THREE.Group();
      pedGrp.position.copy(this.pedestalPos);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 1.45, 8), this.darkWallMat);
      base.position.y = 0.725;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.65, 0.35, 8), this.stoneMat);
      bowl.position.y = 1.55;
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.36, 0),
        this.trimCyanMat.clone()
      );
      crystal.position.y = 2.28;
      pedGrp.add(base, bowl, crystal);
      this.shrineGroup.add(pedGrp);
      this.pedestalCrystal = crystal;
      this.physics.addCylinderCollider('shrine_pedestal', this.pedestalPos.x, this.pedestalPos.z, 0.95, y0, y0 + 1.8);
    }

    // Monk Altar floor Y matches final altar zone (owa_daim=603.4, keh_namut=602.6, others=600)
    const altarY =
      shrine.id === 'shrine_owa_daim'
        ? y0 + 3.4
        : shrine.id === 'shrine_keh_namut'
          ? y0 + 2.6
          : y0;
    this.altarPos.set(0, altarY, -33.5);
    this.buildMonkAltar(this.altarPos);
  }

  private buildMonkAltar(pos: THREE.Vector3): void {
    const grp = new THREE.Group();
    grp.position.copy(pos);

    const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.3, 0.5, 8), this.stoneMat);
    dais.position.y = 0.25;
    const cageFloor = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.08, 6, 8), this.trimCyanMat);
    cageFloor.rotation.x = Math.PI / 2;
    cageFloor.position.y = 0.52;

    // Ancient Sheikah Monk translucent forcefield arch & seated Monk silhouette
    const barrier = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.75, 3.6, 8, 1, true),
      createBotWToonMaterial({
        color: '#46ecff',
        emissive: '#1cb4e8',
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.24,
      })
    );
    barrier.position.y = 2.3;
    const monkTorso = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.55, 8), this.darkWallMat);
    monkTorso.position.y = 1.45;
    const monkHead = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), this.stoneMat);
    monkHead.position.y = 2.35;
    const monkHat = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.42, 6), this.trimAmberMat);
    monkHat.position.y = 2.65;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 6, 20), this.trimCyanMat);
    halo.position.set(0, 2.2, -0.45);
    grp.add(dais, cageFloor, barrier, monkTorso, monkHead, monkHat, halo);

    this.shrineGroup.add(grp);
    this.physics.addCylinderCollider('shrine_monk_altar', pos.x, pos.z, 1.85, pos.y, pos.y + 4.0);
  }

  private addStaticRoomBox(
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
    this.shrineGroup.add(mesh);
    this.physics.addBoxCollider(id, x, z, width, depth, minY, maxY, { climbable: true, walkableTop: true });
    return mesh;
  }

  private addShrineChest(
    shrineId: string,
    suffix: string,
    x: number,
    y: number,
    z: number,
    rewardType: ShrineChestState['rewardType'],
    rewardId: string,
    rewardAmount: number,
    labelJa: string,
    rewardTextJa: string,
    save: SaveSlotData,
    isMetal = true
  ): void {
    const id = `shrine_chest_${shrineId}_${suffix}`;
    const alreadyOpened = save.openedChests.includes(id);

    const root = new THREE.Group();
    root.position.set(x, y, z);
    const chestMat = isMetal ? this.metalMagMat : createBotWToonMaterial({ color: '#7a5430' });
    const trim = isMetal ? this.trimCyanMat : this.trimAmberMat;

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.58, 0.88), chestMat);
    base.position.y = 0.29;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.39, 0.1, 0.92), trim);
    band.position.y = 0.56;
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.58, -0.44);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.34, 0.88), chestMat);
    lid.position.set(0, 0.17, 0.44);
    lidPivot.add(lid);
    if (alreadyOpened) lidPivot.rotation.x = -1.7;

    const glowBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.45, 2.2, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: '#42ecff', transparent: true, opacity: alreadyOpened ? 0 : 0.36, depthWrite: false })
    );
    glowBeam.position.y = 1.5;
    glowBeam.visible = !alreadyOpened;

    root.add(base, band, lidPivot, glowBeam);
    this.shrineGroup.add(root);

    this.physics.addBoxCollider(`col_${id}`, x, z, 1.38, 0.92, y, y + 0.95);
    this.chests.push({
      id,
      labelJa,
      rewardTextJa,
      rewardType,
      rewardId,
      rewardAmount,
      position: new THREE.Vector3(x, y, z),
      opened: alreadyOpened,
      openAnim: alreadyOpened ? 1 : 0,
      root: undefined as never,
      lidPivot,
      glowBeam,
    });
  }

  private addDestructibleWall(id: string, x: number, y: number, z: number, width: number, depth: number, height: number): void {
    const colliderId = `col_${id}`;
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    const crackMat = createBotWToonMaterial({
      color: '#5c4d44',
      emissive: '#ff7020',
      emissiveIntensity: 0.48,
      rimStrength: 0.5,
      rimTint: '#ff9644',
    });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), crackMat);
    wall.position.y = height * 0.5;
    grp.add(wall);
    // Glowing orange crack fissures across face so player clearly recognizes Bomb target
    for (let i = 0; i < 4; i++) {
      const fissure = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.55, 0.14, depth + 0.12),
        this.trimAmberMat
      );
      fissure.position.set((i % 2 === 0 ? -0.35 : 0.35) * (width * 0.2), 0.7 + i * (height * 0.18), 0);
      fissure.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.42;
      grp.add(fissure);
    }

    this.shrineGroup.add(grp);
    this.physics.addBoxCollider(colliderId, x, z, width, depth, y, y + height, { climbable: false, walkableTop: false });
    this.destructibleWalls.push({
      id,
      colliderId,
      mesh: grp,
      position: new THREE.Vector3(x, y, z),
      destroyed: false,
    });
  }

  private spawnGuardianScout(id: string, nameJa: string, x: number, y: number, z: number, hp: number, attack: number): void {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    const bodyMat = createBotWToonMaterial({
      color: '#3c454f',
      emissive: '#22d8ff',
      emissiveIntensity: 0.5,
      metalHighlight: true,
    });
    const base = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.5, 6), bodyMat);
    base.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), bodyMat);
    head.position.y = 2.0;
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff3664' });
    const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), eyeMat);
    eyeMesh.position.set(0, 2.0, 0.56);

    const shieldArm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.15, 0.18), this.trimCyanMat);
    shieldArm.position.set(-1.05, 1.35, 0.35);
    const swordArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.45, 0.14), this.trimCyanMat);
    swordArm.position.set(1.05, 1.35, 0.45);
    swordArm.rotation.x = 0.65;

    for (let li = 0; li < 4; li++) {
      const a = (li / 4) * Math.PI * 2 + 0.4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 1.1, 6), bodyMat);
      leg.position.set(Math.cos(a) * 0.85, 0.52, Math.sin(a) * 0.85);
      leg.rotation.z = -Math.cos(a) * 0.32;
      leg.rotation.x = Math.sin(a) * 0.32;
      grp.add(leg);
    }

    const laserGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6);
    laserGeo.rotateX(Math.PI / 2);
    laserGeo.translate(0, 0, 0.5);
    const laserLine = new THREE.Mesh(
      laserGeo,
      new THREE.MeshBasicMaterial({ color: '#ff3260', transparent: true, opacity: 0.8 })
    );
    laserLine.position.set(0, 2.0, 0.55);
    laserLine.visible = false;

    grp.add(base, head, eyeMesh, shieldArm, swordArm, laserLine);
    this.shrineGroup.add(grp);

    this.guardians.push({
      id,
      nameJa,
      mesh: grp,
      position: new THREE.Vector3(x, y, z),
      hp,
      maxHp: hp,
      attack,
      speed: 3.4,
      state: 'patrol',
      timer: 1.8,
      stasisTimer: 0,
      eyeMesh,
      laserLine,
      hitFlash: 0,
    });
  }

  private buildFloorAndWalkways(y0: number, segments: Array<{ minZ: number; maxZ: number; minX?: number; maxX?: number }>): void {
    for (const s of segments) {
      const minX = s.minX ?? -13.2;
      const maxX = s.maxX ?? 13.2;
      const w = maxX - minX;
      const d = s.maxZ - s.minZ;
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 2.0, d), this.stoneMat);
      floor.position.set((minX + maxX) * 0.5, y0 - 1.0, (s.minZ + s.maxZ) * 0.5);
      floor.receiveShadow = true;
      this.shrineGroup.add(floor);
    }
  }

  private buildTrialForShrine(shrine: ShrineDef, save: SaveSlotData): void {
    const y0 = SHRINE_INTERIOR_BASE_Y;

    // ------------------------------------------------------------------
    // 1. Oman Au Shrine — Magnesis: Metal Slab Bridge + High Ledge Cube + Twin Metal Doors
    // ------------------------------------------------------------------
    if (shrine.id === 'shrine_oman_au') {
      // Landing South (z: 4.5..22.8), North Trial & Altar Terrace (z: -39.5..-3.5) separated by 8m Chasm
      this.buildFloorAndWalkways(y0, [
        { minZ: 4.5, maxZ: 22.8 },
        { minZ: -39.5, maxZ: -3.5 },
      ]);

      // Deep chasm floor at Y=593
      this.floorPatches.push(
        { minX: -13.5, maxX: 13.5, minZ: -3.5, maxZ: 4.5, floorY: () => y0 - 7.0 }
      );
      const pitGlow1 = new THREE.Mesh(new THREE.PlaneGeometry(26, 8), new THREE.MeshBasicMaterial({ color: '#071420' }));
      pitGlow1.rotation.x = -Math.PI / 2;
      pitGlow1.position.set(0, y0 - 6.95, 0.5);
      this.shrineGroup.add(pitGlow1);

      // Movable Magnesis Metal Bridge Slab placed on South Terrace left side (ready to grab & span chasm!)
      const bridgeGrp = new THREE.Group();
      const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.45, 7.2), this.metalMagMat.clone());
      slabMesh.position.y = 0.225;
      const slabTrim = new THREE.Mesh(new THREE.BoxGeometry(4.46, 0.14, 7.26), this.trimCyanMat);
      slabTrim.position.y = 0.225;
      bridgeGrp.add(slabMesh, slabTrim);
      bridgeGrp.position.set(-4.6, y0, 9.2);
      this.shrineGroup.add(bridgeGrp);
      const slabBody = this.createDynamicBody(
        'oman_metal_bridge',
        'マグネキャッチ金属橋',
        bridgeGrp,
        new THREE.Vector3(-4.6, y0, 9.2),
        {
          mass: 6.5,
          radius: 3.6,
          halfWidth: 2.2,
          halfDepth: 3.6,
          halfHeight: 0.225,
          material: 'Metal',
          isStatic: false,
          isPlatform: true,
          isMetalBox: true,
          highlightMesh: slabMesh,
        }
      );
      this.physics.addBody(slabBody);

      // Movable Magnesis Metal Cube on central terrace (climb onto high ledge for bonus bow chest!)
      const cubeGrp = new THREE.Group();
      const cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 2.0), this.metalMagMat.clone());
      cubeMesh.position.y = 1.0;
      cubeGrp.add(cubeMesh);
      cubeGrp.position.set(5.5, y0, -8.5);
      this.shrineGroup.add(cubeGrp);
      this.physics.addBody(
        this.createDynamicBody('oman_metal_cube', '金属の立方体', cubeGrp, new THREE.Vector3(5.5, y0, -8.5), {
          mass: 4.0,
          radius: 1.3,
          halfWidth: 1.0,
          halfDepth: 1.0,
          halfHeight: 1.0,
          material: 'Metal',
          isStatic: false,
          isMetalBox: true,
          highlightMesh: cubeMesh,
        })
      );

      // High stone platform on west side holding secret Traveler's Bow chest
      this.addStaticRoomBox('oman_chest_ledge', -8.8, -11.0, 5.2, 5.2, y0, y0 + 2.8, this.stoneMat);
      this.addShrineChest(
        shrine.id,
        'bonus',
        -8.8,
        y0 + 2.8,
        -11.0,
        'bow',
        'travelers_bow',
        1,
        '試練の宝箱（旅人の弓）',
        '旅人の弓',
        save
      );

      // Double Giant Magnesis Iron Doors guarding Altar terrace (z = -20.2)
      // Side framing walls so you must swing/lift at least one iron door open with Magnesis!
      this.addStaticRoomBox('oman_door_frame_w', -8.2, -20.2, 8.8, 1.5, y0, y0 + 8.0, this.darkWallMat);
      this.addStaticRoomBox('oman_door_frame_e', 8.2, -20.2, 8.8, 1.5, y0, y0 + 8.0, this.darkWallMat);
      for (const [did, dx] of [
        ['oman_door_l', -1.95],
        ['oman_door_r', 1.95],
      ] as const) {
        const dGrp = new THREE.Group();
        const dMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.0, 0.75), this.metalMagMat.clone());
        dMesh.position.y = 2.5;
        dGrp.add(dMesh);
        dGrp.position.set(dx, y0, -20.2);
        this.shrineGroup.add(dGrp);
        const dBody = this.createDynamicBody(did, '巨大鉄扉', dGrp, new THREE.Vector3(dx, y0, -20.2), {
          mass: 8.0,
          radius: 2.0,
          halfWidth: 1.8,
          halfDepth: 0.38,
          halfHeight: 2.5,
          material: 'Metal',
          isStatic: false,
          isMetalBox: true,
          isPlatform: true,
          highlightMesh: dMesh,
        });
        this.omanDoors.push(dBody);
        this.physics.addBody(dBody);
      }

      // Guardian Scout I guarding center room
      this.spawnGuardianScout('oman_scout_1', '小型ガーディアン', 0, y0, -13.5, 45, 0.5);
      return;
    }

    // ------------------------------------------------------------------
    // 2. Ja Baij Shrine — Remote Bombs: 3 Cracked Walls + Hidden Chest Alcove + Scout
    // ------------------------------------------------------------------
    if (shrine.id === 'shrine_ja_baij') {
      this.buildFloorAndWalkways(y0, [{ minZ: -39.5, maxZ: 22.8 }]);

      // Wall partition 1 with Cracked center door (z = 5.5)
      this.addStaticRoomBox('ja_part1_w', -8.0, 5.5, 9.6, 1.6, y0, y0 + 7.5, this.darkWallMat);
      this.addStaticRoomBox('ja_part1_e', 8.0, 5.5, 9.6, 1.6, y0, y0 + 7.5, this.darkWallMat);
      this.addDestructibleWall('ja_cracked_1', 0, y0, 5.5, 6.4, 1.5, 4.8);

      // Secret treasure alcove on left (x = -8.5, z = -6.0) sealed by Cracked Wall 2
      this.addStaticRoomBox('ja_alcove_n', -8.8, -9.8, 7.6, 1.4, y0, y0 + 6.0, this.darkWallMat);
      this.addStaticRoomBox('ja_alcove_s', -8.8, -2.2, 7.6, 1.4, y0, y0 + 6.0, this.darkWallMat);
      this.addDestructibleWall('ja_cracked_2', -5.2, y0, -6.0, 1.4, 6.2, 4.4);
      this.addShrineChest(
        shrine.id,
        'bonus',
        -9.6,
        y0,
        -6.0,
        'material',
        'amber',
        3,
        '隠し部屋の宝箱（コハク ×3）',
        'コハク ×3',
        save
      );

      // Partition 2 before Altar with Cracked Wall 3 (z = -20.5)
      this.addStaticRoomBox('ja_part2_w', -8.0, -20.5, 9.6, 1.6, y0, y0 + 8.0, this.darkWallMat);
      this.addStaticRoomBox('ja_part2_e', 8.0, -20.5, 9.6, 1.6, y0, y0 + 8.0, this.darkWallMat);
      this.addDestructibleWall('ja_cracked_3', 0, y0, -20.5, 6.4, 1.5, 5.0);

      // Guarding Scout in central arena
      this.spawnGuardianScout('ja_scout_1', '小型ガーディアン（試練の間）', 3.5, y0, -7.5, 60, 0.75);
      return;
    }

    // ------------------------------------------------------------------
    // 3. Owa Daim Shrine — Stasis: Cogwheel Bridge + Rolling Boulder Slope + Kinetic Blocker
    // ------------------------------------------------------------------
    if (shrine.id === 'shrine_owa_daim') {
      // South Landing (y0, z: 5..22.8), Sloped Boulder Ramp (z: -18.5..-4.5 rises 0->3.4), North Altar Plateau (y0+3.4, z: -39.5..-18.5)
      this.buildFloorAndWalkways(y0, [{ minZ: 5.0, maxZ: 22.8 }]);
      this.floorPatches.push(
        { minX: -13.5, maxX: 13.5, minZ: -4.5, maxZ: 5.0, floorY: () => y0 - 7.0 },
        {
          minX: -13.5,
          maxX: 13.5,
          minZ: -18.5,
          maxZ: -4.5,
          floorY: (_x, z) => y0 + ((Math.max(-18.5, Math.min(-4.5, z)) - -4.5) / -14.0) * 3.4,
        },
        { minX: -13.5, maxX: 13.5, minZ: -39.5, maxZ: -18.5, floorY: () => y0 + 3.4 }
      );

      // Visual ramp + north plateau slabs (floor colliders omitted because TerrainGenerator override computes exact slope!)
      const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(26.4, 1.0, 14.5), this.stoneMat);
      rampMesh.position.set(0, y0 + 1.2, -11.5);
      rampMesh.rotation.x = Math.atan2(3.4, 14.0);
      const northFloor = new THREE.Mesh(new THREE.BoxGeometry(26.4, 2.0, 21.0), this.stoneMat);
      northFloor.position.set(0, y0 + 2.4, -29.0);
      this.shrineGroup.add(rampMesh, northFloor);

      // Spinning Stasis Cogwheel Bridge over chasm (z = 0.25)
      const gearGrp = new THREE.Group();
      const gearBeam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 9.6), this.stoneMat.clone());
      gearBeam.position.y = 0.25;
      const gearRing = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.55, 12), this.darkWallMat);
      gearRing.position.y = 0.27;
      const gearGlow = new THREE.Mesh(new THREE.BoxGeometry(3.46, 0.14, 9.64), this.trimAmberMat.clone());
      gearGlow.position.y = 0.26;
      gearGrp.add(gearBeam, gearRing, gearGlow);
      gearGrp.position.set(0, y0 - 0.45, 0.25);
      this.shrineGroup.add(gearGrp);
      this.spinningGearBody = this.createDynamicBody(
        'owa_gear_bridge',
        '歯車の回転橋',
        gearGrp,
        new THREE.Vector3(0, y0 - 0.45, 0.25),
        {
          mass: 999,
          radius: 4.8,
          halfWidth: 1.7,
          halfDepth: 4.8,
          halfHeight: 0.25,
          material: 'Stone',
          isStatic: true,
          stasisInteractable: true,
          isPlatform: true,
          highlightMesh: gearBeam,
        }
      );
      this.physics.addBody(this.spinningGearBody);

      // Rolling Stone Boulder rolling down slope ramp (respawns at top if falls into chasm!)
      const rollGrp = new THREE.Group();
      const rollMat = createBotWToonMaterial({ color: '#6b675f', rimStrength: 0.35 });
      const rollMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 1), rollMat);
      rollMesh.position.y = 1.55;
      rollGrp.add(rollMesh);
      rollGrp.position.set(-1.2, y0 + 3.4, -18.0);
      this.shrineGroup.add(rollGrp);
      this.rollingBoulder = this.createDynamicBody(
        'owa_rolling_boulder',
        '転がる大岩',
        rollGrp,
        new THREE.Vector3(-1.2, y0 + 3.4, -18.0),
        {
          mass: 4.5,
          radius: 1.55,
          halfHeight: 1.55,
          material: 'Stone',
          isStatic: false,
          isBoulder: true,
          highlightMesh: rollMesh,
        }
      );
      this.physics.addBody(this.rollingBoulder);

      // Altar Corridor Partition + Giant Blocker Boulder (Stasis + Melee Strikes blast it away!)
      this.addStaticRoomBox('owa_block_w', -8.0, -23.0, 9.6, 2.0, y0 + 3.4, y0 + 10.5, this.darkWallMat);
      this.addStaticRoomBox('owa_block_e', 8.0, -23.0, 9.6, 2.0, y0 + 3.4, y0 + 10.5, this.darkWallMat);
      const blkGrp = new THREE.Group();
      const blkMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(2.15, 0), rollMat.clone());
      blkMesh.position.y = 2.0;
      blkGrp.add(blkMesh);
      blkGrp.position.set(0, y0 + 3.4, -22.2);
      this.shrineGroup.add(blkGrp);
      this.blockerBoulder = this.createDynamicBody(
        'owa_blocker_boulder',
        '扉を塞ぐ巨岩（ビタロック＋攻撃で吹き飛ばす）',
        blkGrp,
        new THREE.Vector3(0, y0 + 3.4, -22.2),
        {
          mass: 5.5,
          radius: 2.1,
          halfHeight: 2.0,
          material: 'Stone',
          isStatic: false,
          isBoulder: true,
          highlightMesh: blkMesh,
        }
      );
      this.physics.addBody(this.blockerBoulder);

      // Side high chest on upper-east balcony (Iron Sledgehammer / Royal Broadsword starter alt: Soldiers Broadsword!)
      this.addShrineChest(
        shrine.id,
        'bonus',
        8.5,
        y0 + 3.4,
        -19.5,
        'weapon',
        'soldiers_broadsword',
        1,
        '台座の宝箱（兵士の剣）',
        '兵士の剣',
        save
      );
      return;
    }

    // ------------------------------------------------------------------
    // 4. Keh Namut Shrine — Cryonis: Water Basin Step + Gate-Lifting Water Pool
    // ------------------------------------------------------------------
    if (shrine.id === 'shrine_keh_namut') {
      // South Landing (z: 6..22.8, y0), Basin 1 (z: -3.5..6, water=600.15), Mid Terrace (z: -11.5..-3.5, y0+2.6), Basin 2 (z: -21..-11.5, water=602.5), Altar Landing (z: -39.5..-21, y0+2.6)
      this.buildFloorAndWalkways(y0, [{ minZ: 6.0, maxZ: 22.8 }]);
      const midTerrace = new THREE.Mesh(new THREE.BoxGeometry(26.4, 4.6, 8.0), this.stoneMat);
      midTerrace.position.set(0, y0 + 0.3, -7.5);
      const altarFloor = new THREE.Mesh(new THREE.BoxGeometry(26.4, 4.6, 18.5), this.stoneMat);
      altarFloor.position.set(0, y0 + 0.3, -30.25);
      this.shrineGroup.add(midTerrace, altarFloor);

      // Luminous Cryonis Water Basin 1 & Basin 2 meshes + height overrides
      this.waterZones.push(
        { minX: -13.0, maxX: 13.0, minZ: -3.5, maxZ: 6.0, floorY: y0 - 0.85, waterY: y0 + 0.15 },
        { minX: -13.0, maxX: 13.0, minZ: -21.0, maxZ: -11.5, floorY: y0 + 1.5, waterY: y0 + 2.45 }
      );
      this.floorPatches.push(
        { minX: -13.5, maxX: 13.5, minZ: -11.5, maxZ: -3.5, floorY: () => y0 + 2.6 },
        { minX: -13.5, maxX: 13.5, minZ: -39.5, maxZ: -21.0, floorY: () => y0 + 2.6 }
      );

      const waterMat = createBotWToonMaterial({
        color: '#2eb8e8',
        emissive: '#0c6888',
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.72,
      });
      const wPlane1 = new THREE.Mesh(new THREE.PlaneGeometry(26.2, 9.6), waterMat);
      wPlane1.rotation.x = -Math.PI / 2;
      wPlane1.position.set(0, y0 + 0.15, 1.25);
      const wPlane2 = new THREE.Mesh(new THREE.PlaneGeometry(26.2, 9.6), waterMat);
      wPlane2.rotation.x = -Math.PI / 2;
      wPlane2.position.set(0, y0 + 2.45, -16.25);
      this.shrineGroup.add(wPlane1, wPlane2);

      // Gate Wall over Basin 2 (z = -15.5): Cryonis spawned below/near lifts keh_gate upward!
      this.addStaticRoomBox('keh_gate_w', -8.0, -15.5, 9.6, 1.4, y0 + 2.4, y0 + 10.5, this.darkWallMat);
      this.addStaticRoomBox('keh_gate_e', 8.0, -15.5, 9.6, 1.4, y0 + 2.4, y0 + 10.5, this.darkWallMat);

      this.kehGateMesh = new THREE.Group();
      const gateSlab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.4, 0.9), this.stoneMat);
      gateSlab.position.y = 2.2;
      const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.25, 1.0), this.trimCyanMat);
      gateFrame.position.y = 0.2;
      this.kehGateMesh.add(gateSlab, gateFrame);
      this.kehGateMesh.position.set(0, y0 + 2.45, -15.5);
      this.shrineGroup.add(this.kehGateMesh);
      this.physics.addBoxCollider(this.kehGateColliderId, 0, -15.5, 6.4, 1.0, y0 + 2.45, y0 + 6.85);

      // Cryonis-only high shelf on west wall of Basin 2
      this.addStaticRoomBox('keh_chest_ledge', -8.8, -15.5, 4.6, 4.6, y0 + 1.5, y0 + 5.6, this.stoneMat);
      this.addShrineChest(
        shrine.id,
        'bonus',
        -8.8,
        y0 + 5.6,
        -15.5,
        'material',
        'opal',
        2,
        '氷上の宝箱（オパール ×2）',
        'オパール ×2',
        save
      );
      return;
    }

    // ------------------------------------------------------------------
    // 5. Blessing Shrines — Serene Conduit Hall + High-Tier Chest + Altar
    // ------------------------------------------------------------------
    if (shrine.category === 'blessing') {
      this.buildFloorAndWalkways(y0, [{ minZ: -39.5, maxZ: 22.8 }]);
      const reward =
        shrine.id === 'shrine_korgu_chideh'
          ? ({ type: 'weapon', id: 'royal_claymore', label: '王家の両手剣' } as const)
          : ({ type: 'weapon', id: 'flameblade', label: '火炎の剣' } as const);
      this.addShrineChest(
        shrine.id,
        'blessing',
        0,
        y0,
        -14.0,
        reward.type,
        reward.id,
        1,
        `導師の宝箱（${reward.label}）`,
        reward.label,
        save
      );
      return;
    }

    // ------------------------------------------------------------------
    // 6. Combat Shrines (Minor / Modest / Major Test of Strength)
    // ------------------------------------------------------------------
    if (shrine.category.startsWith('combat_')) {
      this.buildFloorAndWalkways(y0, [{ minZ: -39.5, maxZ: 22.8 }]);
      for (const [px, pz] of [
        [-6.5, -2.0],
        [6.5, -2.0],
        [-6.5, -13.0],
        [6.5, -13.0],
      ]) {
        this.addStaticRoomBox(`comb_pil_${px}_${pz}`, px, pz, 2.2, 2.2, y0, y0 + 6.5, this.darkWallMat);
      }

      const tier = shrine.category === 'combat_major' ? 3 : shrine.category === 'combat_modest' ? 2 : 1;
      const hp = tier === 3 ? 280 : tier === 2 ? 150 : 75;
      const atk = tier === 3 ? 2.5 : tier === 2 ? 1.5 : 0.75;
      const rankJa = tier === 3 ? '極位' : tier === 2 ? '中位' : '序位';
      this.spawnGuardianScout('comb_scout', `小型ガーディアン（${rankJa}）`, 0, y0, -8.0, hp, atk);

      // Seal Altar gate until Guardian Scout defeated
      this.addStaticRoomBox('comb_gate_w', -8.0, -23.0, 9.6, 1.5, y0, y0 + 8.5, this.darkWallMat);
      this.addStaticRoomBox('comb_gate_e', 8.0, -23.0, 9.6, 1.5, y0, y0 + 8.5, this.darkWallMat);
      this.combatGateMesh = new THREE.Group();
      const gSlab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.5, 0.8), this.trimAmberMat.clone());
      gSlab.position.y = 2.75;
      this.combatGateMesh.add(gSlab);
      this.combatGateMesh.position.set(0, y0, -23.0);
      this.shrineGroup.add(this.combatGateMesh);
      this.physics.addBoxCollider(this.combatGateColliderId, 0, -23.0, 6.4, 1.0, y0, y0 + 6.0);

      const weaponDrop = tier === 3 ? 'guardian_sword_pp' : tier === 2 ? 'knights_broadsword' : 'frostblade';
      const weaponName = tier === 3 ? 'ガーディアンナイフ++' : tier === 2 ? '騎士の剣' : '氷雪の剣';
      this.addShrineChest(shrine.id, 'reward', 4.5, y0, -27.0, 'weapon', weaponDrop, 1, `試練の戦利品（${weaponName}）`, weaponName, save);
      return;
    }

    // ------------------------------------------------------------------
    // 7. Generic Puzzle / DLC 2 Shrines (Magnesis Switch + Cryonis Pool + Bomb Alcove)
    // ------------------------------------------------------------------
    this.buildFloorAndWalkways(y0, [{ minZ: -39.5, maxZ: 22.8 }]);
    this.waterZones.push({ minX: -12.5, maxX: -4.5, minZ: -13.0, maxZ: -3.0, floorY: y0 - 0.8, waterY: y0 + 0.15 });
    const pWater = new THREE.Mesh(
      new THREE.PlaneGeometry(8.0, 10.0),
      createBotWToonMaterial({ color: '#2eb8e8', transparent: true, opacity: 0.72 })
    );
    pWater.rotation.x = -Math.PI / 2;
    pWater.position.set(-8.5, y0 + 0.15, -8.0);
    this.shrineGroup.add(pWater);

    // Recessed floor switch plate at (5.5, y0, -8.0) -> placing Metal Cube opens Altar Gate!
    this.switchPlatePos = new THREE.Vector3(5.5, y0, -8.0);
    this.switchPlateMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.7, 0.22, 8),
      this.trimAmberMat.clone()
    );
    this.switchPlateMesh.position.set(5.5, y0 + 0.11, -8.0);
    this.shrineGroup.add(this.switchPlateMesh);

    const pCubeGrp = new THREE.Group();
    const pCubeMesh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 1.9), this.metalMagMat.clone());
    pCubeMesh.position.y = 0.95;
    pCubeGrp.add(pCubeMesh);
    pCubeGrp.position.set(-1.5, y0, 3.0);
    this.shrineGroup.add(pCubeGrp);
    this.switchCubeBody = this.createDynamicBody(
      'puz_metal_cube',
      '仕掛けの金属ブロック',
      pCubeGrp,
      new THREE.Vector3(-1.5, y0, 3.0),
      {
        mass: 4.0,
        radius: 1.25,
        halfWidth: 0.95,
        halfDepth: 0.95,
        halfHeight: 0.95,
        material: 'Metal',
        isStatic: false,
        isMetalBox: true,
        highlightMesh: pCubeMesh,
      }
    );
    this.physics.addBody(this.switchCubeBody);

    // Bombable chest alcove on east side
    this.addDestructibleWall('puz_crack_e', 8.5, y0, -14.5, 4.0, 1.4, 4.2);
    this.addShrineChest(
      shrine.id,
      'dlc_chest',
      9.2,
      y0,
      -17.5,
      shrine.category === 'dlc2' ? 'bow' : 'weapon',
      shrine.category === 'dlc2' ? 'royal_bow' : 'thunderblade',
      1,
      shrine.category === 'dlc2' ? 'EX 秘宝（王家の弓）' : '試練の宝箱（雷電の剣）',
      shrine.category === 'dlc2' ? '王家の弓' : '雷電の剣',
      save
    );

    // Altar Gate locked until metal block sits on floor switch
    this.addStaticRoomBox('puz_gate_w', -8.0, -22.5, 9.6, 1.5, y0, y0 + 8.5, this.darkWallMat);
    this.addStaticRoomBox('puz_gate_e', 8.0, -22.5, 9.6, 1.5, y0, y0 + 8.5, this.darkWallMat);
    this.combatGateMesh = new THREE.Group();
    const pgSlab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.2, 0.8), this.trimAmberMat.clone());
    pgSlab.position.y = 2.6;
    this.combatGateMesh.add(pgSlab);
    this.combatGateMesh.position.set(0, y0, -22.5);
    this.shrineGroup.add(this.combatGateMesh);
    this.physics.addBoxCollider(this.combatGateColliderId, 0, -22.5, 6.4, 1.0, y0, y0 + 5.8);
  }

  private createDynamicBody(
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
      isBoulder?: boolean;
      highlightMesh?: THREE.Mesh;
    }
  ): PhysicsBody {
    const baseMat = opts.highlightMesh?.material as THREE.MeshToonMaterial | undefined;
    const baseEmissive = baseMat ? baseMat.emissive.clone() : new THREE.Color('#000000');
    const baseIntensity = baseMat ? baseMat.emissiveIntensity : 0;

    return {
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
      material: opts.material,
      isStatic: opts.isStatic,
      stasisInteractable: opts.stasisInteractable,
      isPlatform: opts.isPlatform,
      isMetalBox: opts.isMetalBox,
      isBoulder: opts.isBoulder,
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
      onMagnesisHighlight: baseMat
        ? (state: number) => {
            if (state === 2) {
              baseMat.emissive.set('#ffe228');
              baseMat.emissiveIntensity = 1.45;
            } else if (state === 1) {
              baseMat.emissive.set('#ff3636');
              baseMat.emissiveIntensity = 0.95;
            } else {
              baseMat.emissive.copy(baseEmissive);
              baseMat.emissiveIntensity = baseIntensity;
            }
          }
        : undefined,
      onStasisVisual: baseMat
        ? (glow: number) => {
            if (glow > 0) {
              baseMat.emissive.set('#ffd924');
              baseMat.emissiveIntensity = 1.5;
            } else {
              baseMat.emissive.copy(baseEmissive);
              baseMat.emissiveIntensity = baseIntensity;
            }
          }
        : undefined,
    };
  }

  onCryonisCreated(spot: THREE.Vector3): { gateLifted: boolean } {
    if (this.activeShrine?.id === 'shrine_keh_namut' && this.kehGateMesh) {
      if (Math.abs(spot.z - (-15.5)) <= 4.5 && Math.abs(spot.x) <= 4.2) {
        this.kehGateTargetLiftY = 3.85;
        return { gateLifted: true };
      }
    }
    return { gateLifted: false };
  }

  onExplosion(pos: THREE.Vector3, radius: number, damage: number): { destroyedWalls: number } {
    let destroyedWalls = 0;
    for (const wall of this.destructibleWalls) {
      if (wall.destroyed) continue;
      if (wall.position.distanceTo(pos) <= radius + 2.4) {
        wall.destroyed = true;
        wall.mesh.visible = false;
        this.physics.removeCollider(wall.colliderId);
        destroyedWalls++;
      }
    }
    for (const g of this.guardians) {
      if (g.state === 'dead') continue;
      if (g.position.distanceTo(pos) <= radius + 1.8) {
        this.damageGuardian(g, damage);
      }
    }
    return { destroyedWalls };
  }

  onPlayerMeleeOrArrowHit(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    range: number,
    damage: number
  ): { hitGuardian?: ShrineGuardianScout; hitStasisBody?: PhysicsBody } {
    // 1. Check Guardian Scouts
    let hitG: ShrineGuardianScout | undefined;
    let bestGD = range + 1.2;
    for (const g of this.guardians) {
      if (g.state === 'dead') continue;
      const d = g.position.distanceTo(origin);
      if (d <= bestGD) {
        const align = g.position.clone().sub(origin).normalize().dot(dir);
        if (align > 0.2 || d < 2.2) {
          bestGD = d;
          hitG = g;
        }
      }
    }
    if (hitG) {
      this.damageGuardian(hitG, damage);
      return { hitGuardian: hitG };
    }

    // 2. Check frozen Stasis objects (for kinetic launch momentum!)
    let bestB: PhysicsBody | undefined;
    let bestBD = range + 1.8;
    for (const b of this.physics.bodies) {
      if (!b.isFrozenStasis) continue;
      const d = b.position.distanceTo(origin);
      if (d <= bestBD) {
        const align = b.position.clone().sub(origin).normalize().dot(dir);
        if (align > 0.15 || d < 2.8) {
          bestBD = d;
          bestB = b;
        }
      }
    }
    if (bestB) {
      const imp = dir.clone().multiplyScalar(Math.max(12, damage * 1.4));
      imp.y += 4.5;
      this.physics.applyStasisHit(bestB, imp);
      return { hitStasisBody: bestB };
    }

    return {};
  }

  private damageGuardian(g: ShrineGuardianScout, dmg: number): void {
    g.hp = Math.max(0, g.hp - dmg);
    g.hitFlash = 0.25;
    if (g.hp <= 0) {
      g.state = 'dead';
      g.laserLine.visible = false;
      g.mesh.visible = false;
      this.checkCombatGateUnlock();
    }
  }

  private checkCombatGateUnlock(): void {
    if (!this.combatGateMesh || this.combatGateOpen) return;
    const anyAlive = this.guardians.some((g) => g.state !== 'dead');
    if (!anyAlive && this.guardians.length > 0) {
      this.combatGateOpen = true;
      this.combatGateMesh.visible = false;
      this.physics.removeCollider(this.combatGateColliderId);
    }
  }

  getNearestInteractable(playerPos: THREE.Vector3, save: SaveSlotData): ShrineInteractPrompt | null {
    if (!this.activeShrine) return null;
    const candidates: ShrineInteractPrompt[] = [];

    if (this.pedestalPos) {
      const d = playerPos.distanceTo(this.pedestalPos);
      if (d <= 3.3) {
        const pInfo = PLATEAU_SHRINE_RUNE_MAP[this.activeShrine.id];
        const unlocked = pInfo && pInfo.runes.every((r) => save.unlockedRunes.includes(r));
        candidates.push({
          id: 'shrine_pedestal',
          kind: 'pedestal',
          label: unlocked ? 'シーカーストーンを起動済み' : `シーカーアイテムを抽出（${pInfo?.labelJa ?? 'ルーン'}）`,
          distance: d,
        });
      }
    }

    const dAltar = playerPos.distanceTo(this.altarPos);
    if (dAltar <= 4.2) {
      const cleared = save.completedShrines.includes(this.activeShrine.id);
      candidates.push({
        id: 'shrine_altar',
        kind: 'altar',
        label: cleared ? '導師に話しかける（克服の証 取得済み）' : '導師から「克服の証」を受け取る',
        distance: dAltar,
      });
    }

    for (const c of this.chests) {
      if (c.opened) continue;
      const d = playerPos.distanceTo(c.position);
      if (d <= 2.9) {
        candidates.push({
          id: c.id,
          kind: 'chest',
          label: `宝箱を開ける：${c.labelJa}`,
          distance: d,
        });
      }
    }

    const dExit = playerPos.distanceTo(this.exitPos);
    if (dExit <= 3.2) {
      candidates.push({
        id: 'shrine_exit',
        kind: 'exit',
        label: '試練の祠から外へ出る',
        distance: dExit,
      });
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] ?? null;
  }

  openChest(chestId: string, save: SaveSlotData): ShrineChestState | null {
    const chest = this.chests.find((c) => c.id === chestId && !c.opened);
    if (!chest) return null;
    chest.opened = true;
    chest.glowBeam.visible = false;
    if (!save.openedChests.includes(chest.id)) {
      save.openedChests.push(chest.id);
    }

    if (chest.rewardType === 'weapon') {
      const def = WEAPONS.find((w) => w.id === chest.rewardId);
      if (def) {
        save.weapons.push({ ...def, currentDurability: def.durability });
        if (!save.equippedWeaponId) save.equippedWeaponId = def.id;
      }
    } else if (chest.rewardType === 'bow') {
      const def = BOWS.find((b) => b.id === chest.rewardId);
      if (def) {
        save.bows.push({ ...def, currentDurability: def.durability });
        if (!save.equippedBowId) save.equippedBowId = def.id;
      }
    } else if (chest.rewardType === 'shield') {
      const def = SHIELDS.find((s) => s.id === chest.rewardId);
      if (def) {
        save.shields.push({ ...def, currentDurability: def.durability });
        if (!save.equippedShieldId) save.equippedShieldId = def.id;
      }
    } else if (chest.rewardType === 'material') {
      if (MATERIALS.some((m) => m.id === chest.rewardId)) {
        save.materials[chest.rewardId] = (save.materials[chest.rewardId] ?? 0) + chest.rewardAmount;
      }
    } else if (chest.rewardType === 'arrows') {
      save.arrows.normal += chest.rewardAmount;
    }

    return chest;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    isGrounded: boolean
  ): {
    fellInPit: boolean;
    playerHit?: { damage: number; fromPos: THREE.Vector3; isLaser: boolean };
    switchUnlocked?: boolean;
  } {
    if (!this.activeShrine) return { fellInPit: false };
    this.shrineTime += dt;

    // Track last safe dry position above pit floor
    const safeMinY = SHRINE_INTERIOR_BASE_Y - 1.2;
    if (isGrounded && playerPos.y >= safeMinY) {
      this.lastSafePos.copy(playerPos);
    }

    // Check chasm fall respawn inside puzzle shrines
    if (playerPos.y < SHRINE_INTERIOR_BASE_Y - 4.5) {
      playerPos.copy(this.lastSafePos);
      playerPos.y += 0.35;
      return { fellInPit: true };
    }

    // Animate Pedestal crystal bobbing
    if (this.pedestalCrystal) {
      this.pedestalCrystal.rotation.y += dt * 1.4;
      this.pedestalCrystal.position.y = 2.28 + Math.sin(this.shrineTime * 2.5) * 0.1;
    }

    // Animate Chest lids
    for (const c of this.chests) {
      if (c.opened && c.openAnim < 1) {
        c.openAnim = Math.min(1, c.openAnim + dt * 3.5);
        c.lidPivot.rotation.x = -1.7 * c.openAnim;
      }
    }

    // Owa Daim: Rotating Stasis cogwheel bridge
    if (this.spinningGearBody) {
      if (!this.spinningGearBody.isFrozenStasis) {
        this.gearAngle += dt * 1.05;
        this.spinningGearBody.rotY = this.gearAngle;
        this.spinningGearBody.mesh.rotation.y = this.gearAngle;
      }
    }

    // Owa Daim: Respawn rolling boulder at top of slope if it rolls into pit
    if (this.rollingBoulder) {
      if (!this.rollingBoulder.isFrozenStasis) {
        this.rollingBoulder.mesh.rotation.x += this.rollingBoulder.velocity.z * dt * 0.65;
      }
      if (this.rollingBoulder.position.z > -3.8 || this.rollingBoulder.position.y < SHRINE_INTERIOR_BASE_Y - 3.0) {
        this.rollingBoulder.position.set(-1.2 + Math.sin(this.shrineTime) * 1.6, SHRINE_INTERIOR_BASE_Y + 3.45, -18.0);
        this.rollingBoulder.velocity.set(0, 0, 2.2);
      }
    }

    // Keh Namut: Smooth Cryonis gate lift + collider update
    if (this.kehGateMesh && Math.abs(this.kehGateLiftY - this.kehGateTargetLiftY) > 0.02) {
      this.kehGateLiftY += (this.kehGateTargetLiftY - this.kehGateLiftY) * Math.min(1, dt * 5.0);
      const baseGateY = SHRINE_INTERIOR_BASE_Y + 2.45 + this.kehGateLiftY;
      this.kehGateMesh.position.y = baseGateY;
      this.physics.removeCollider(this.kehGateColliderId);
      this.physics.addBoxCollider(this.kehGateColliderId, 0, -15.5, 6.4, 1.0, baseGateY, baseGateY + 4.4);
    }

    // Generic Puzzle: Check Magnesis cube on pressure switch
    let switchUnlocked = false;
    if (this.switchPlatePos && this.switchCubeBody && !this.combatGateOpen && this.combatGateMesh) {
      const dist = Math.hypot(
        this.switchCubeBody.position.x - this.switchPlatePos.x,
        this.switchCubeBody.position.z - this.switchPlatePos.z
      );
      if (dist <= 2.35 && Math.abs(this.switchCubeBody.position.y - this.switchPlatePos.y) <= 1.2) {
        this.combatGateOpen = true;
        this.combatGateMesh.visible = false;
        this.physics.removeCollider(this.combatGateColliderId);
        if (this.switchPlateMesh) {
          (this.switchPlateMesh.material as THREE.MeshToonMaterial).emissive.set('#22d8ff');
          (this.switchPlateMesh.material as THREE.MeshToonMaterial).color.set('#42ecff');
        }
        switchUnlocked = true;
      }
    }

    // Guardian Scout AI inside shrine combat chambers
    let playerHit: { damage: number; fromPos: THREE.Vector3; isLaser: boolean } | undefined;
    for (const g of this.guardians) {
      if (g.state === 'dead') continue;
      if (g.hitFlash > 0) g.hitFlash -= dt;
      if (g.stasisTimer > 0) {
        g.stasisTimer -= dt;
        g.laserLine.visible = false;
        continue;
      }

      const toPlayer = playerPos.clone().sub(g.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      if (dist > 0.05) {
        g.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      }

      if (dist > 4.2 && dist < 24) {
        toPlayer.normalize();
        g.position.addScaledVector(toPlayer, g.speed * dt);
        this.physics.resolveCapsuleCollision(g.position, 0.95, 2.2, 0.5);
      }
      g.mesh.position.copy(g.position);

      g.timer -= dt;
      if (dist < 18) {
        if (g.state === 'patrol' && g.timer <= 0) {
          g.state = 'charge';
          g.timer = 1.6;
        } else if (g.state === 'charge') {
          g.laserLine.visible = true;
          g.laserLine.scale.set(1, 1, Math.min(dist, 22));
          if (g.timer <= 0) {
            g.laserLine.visible = false;
            g.state = 'cooldown';
            g.timer = 2.4;
            if (dist < 16.5 && !playerHit) {
              playerHit = { damage: g.attack, fromPos: g.position.clone(), isLaser: true };
            }
          }
        } else if (g.state === 'cooldown' && g.timer <= 0) {
          g.state = 'patrol';
          g.timer = 1.6;
        }
      } else {
        g.laserLine.visible = false;
      }
    }

    return { fellInPit: false, playerHit, switchUnlocked };
  }
}
