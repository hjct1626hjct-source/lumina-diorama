import * as THREE from 'three';
import { createBotWToonMaterial } from '../rendering/BotWToonShader';
import { textureBank } from '../rendering/ProceduralTextures';
import { setInteriorEnvironmentOverride } from './TerrainGenerator';
import { PhysicsChemistryEngine } from '../physics/PhysicsChemistryEngine';
import { BOWS } from '../data/itemsAndCooking';
import type { SaveSlotData } from '../types/botw';

export const HYRULE_CASTLE_SANCTUM_Y = 1200;
export const DARK_BEAST_ARENA_Y = 1350;
export const CALAMITY_GANON_BASE_HP = 4000;

export type CastleStage = 'sanctum' | 'dark_beast';

export interface CastleInteractPrompt {
  id: string;
  kind: 'exit';
  label: string;
  distance: number;
}

export interface CastleLaserBeam {
  mesh: THREE.Mesh;
  life: number;
}

export interface CalamityGanonState {
  nameJa: string;
  hp: number;
  maxHp: number;
  startingHp: number;
  phase2Threshold: number;
  phase: 1 | 2;
  state: 'intro_lasers' | 'idle' | 'attack' | 'downed' | 'dead';
  timer: number;
  downedTimer: number;
  goldenShieldActive: boolean;
  position: THREE.Vector3;
  mesh: THREE.Group;
  shieldMesh: THREE.Mesh;
  legs: THREE.Group[];
  freedBeastLasersFired: number;
}

export interface DarkBeastCrest {
  id: string;
  localOffset: THREE.Vector3;
  worldPos: THREE.Vector3;
  destroyed: boolean;
  active: boolean;
  mesh: THREE.Mesh;
}

export interface DarkBeastGanonState {
  nameJa: string;
  hp: number;
  maxHp: number;
  position: THREE.Vector3;
  mesh: THREE.Group;
  crests: DarkBeastCrest[];
  crestsDestroyed: number;
  finalEyeExposed: boolean;
  finalEyePos: THREE.Vector3;
  finalEyeMesh: THREE.Mesh;
  beamTimer: number;
  defeated: boolean;
}

export interface EndingSummary {
  playtimeSeconds: number;
  freedBeasts: number;
  clearedShrines: number;
  foundKoroks: number;
  creatorCredit: string;
}

/**
 * Pure helper: computes Calamity Ganon's starting HP after Divine Beast opening laser barrage.
 * Each freed Divine Beast reduces HP by 12.5% (4 beasts -> 50% reduction: 4000 -> 2000).
 */
export function computeCalamityGanonStartingHp(
  freedDivineBeastsCount: number,
  baseHp = CALAMITY_GANON_BASE_HP
): number {
  const clamped = Math.max(0, Math.min(4, Math.floor(freedDivineBeastsCount)));
  return Math.round(baseHp * (1 - clamped * 0.125));
}

/**
 * Pure helper: marks Hyrule saved in save.storyFlags.ganon_defeated and returns ending summary.
 */
export function applyGanonDefeatedEnding(save: SaveSlotData): EndingSummary {
  save.storyFlags.ganon_defeated = true;
  // Remove temporary Bow of Light after returning to overworld (authentic BotW behavior)
  save.bows = save.bows.filter((b) => b.id !== 'bow_of_light');
  if (save.equippedBowId === 'bow_of_light') {
    save.equippedBowId = save.bows[0]?.id ?? null;
  }
  return {
    playtimeSeconds: Math.round(save.playTimeSec),
    freedBeasts: save.defeatedDivineBeasts.length,
    clearedShrines: save.completedShrines.length,
    foundKoroks: save.foundKoroks.length,
    creatorCredit: '製作者:駿 (Created by Shun)',
  };
}

/**
 * Realized 3D Hyrule Castle Sanctum (Y=1200) & Dark Beast Ganon Open Plain (Y=1350):
 * - Sanctum circular gothic stone hall with stained-glass slits, malice pools & pillars
 * - Opening Divine Beast red laser barrage (12.5% HP reduction per freed beast)
 * - Calamity Ganon (6-legged mechanical spider): Phase 1 -> Phase 2 Golden Invulnerable Shield
 *   (broken ONLY by Perfect Guard / Flurry Rush / Urbosa's Fury)
 * - Dark Beast Ganon (Y=1350): auto-grants Bow of Light (ATK 100, infinite straight light arrows),
 *   6 glowing crests sequentially exposed -> final top Malice Eye -> Ending Credits!
 */
export class HyruleCastleInteriorManager {
  public readonly group = new THREE.Group();
  public activeStage: CastleStage | null = null;
  public overworldReturnPos = new THREE.Vector3();
  public overworldReturnYaw = 0;

  public calamityBoss: CalamityGanonState | null = null;
  public darkBeastBoss: DarkBeastGanonState | null = null;

  private arenaGroup = new THREE.Group();
  private physics: PhysicsChemistryEngine;
  private arenaTime = 0;
  private introLasers: CastleLaserBeam[] = [];
  private exitPos = new THREE.Vector3(0, HYRULE_CASTLE_SANCTUM_Y, 24);
  private lastSafePos = new THREE.Vector3(0, HYRULE_CASTLE_SANCTUM_Y, 18);

  private stoneMat!: THREE.MeshToonMaterial;
  private darkMat!: THREE.MeshToonMaterial;
  private maliceMat!: THREE.MeshToonMaterial;
  private goldMat!: THREE.MeshToonMaterial;
  private glassMat!: THREE.MeshToonMaterial;
  private grassMat!: THREE.MeshToonMaterial;

  constructor(scene: THREE.Scene, physics: PhysicsChemistryEngine) {
    this.physics = physics;
    this.group.name = 'HyruleCastleInteriorRoot';
    this.group.visible = false;
    this.group.add(this.arenaGroup);
    scene.add(this.group);
    this.initMaterials();
  }

  private initMaterials(): void {
    const hasDom = typeof document !== 'undefined';
    const stoneTex = hasDom ? textureBank.getSheikahStoneTexture().map : null;
    this.stoneMat = createBotWToonMaterial({
      color: '#4f4a52',
      map: stoneTex ?? undefined,
      emissive: '#18101c',
      emissiveIntensity: 0.25,
    });
    this.darkMat = createBotWToonMaterial({
      color: '#221c26',
      emissive: '#100814',
      emissiveIntensity: 0.35,
    });
    this.maliceMat = createBotWToonMaterial({
      color: '#400c24',
      emissive: '#d61858',
      emissiveIntensity: 1.1,
    });
    this.goldMat = createBotWToonMaterial({
      color: '#ffd84c',
      emissive: '#ffaa18',
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.52,
    });
    this.glassMat = createBotWToonMaterial({
      color: '#ff3c6e',
      emissive: '#ff285c',
      emissiveIntensity: 1.35,
    });
    this.grassMat = createBotWToonMaterial({
      color: '#4e7a3c',
      emissive: '#1a2a14',
      emissiveIntensity: 0.15,
    });
  }

  public isActive(): boolean {
    return this.activeStage !== null;
  }

  public getActiveBossHud(): { nameJa: string; hp: number; maxHp: number; shieldActive?: boolean } | null {
    if (this.activeStage === 'sanctum' && this.calamityBoss && this.calamityBoss.state !== 'dead') {
      return {
        nameJa: this.calamityBoss.goldenShieldActive
          ? `${this.calamityBoss.nameJa}（黄金の無敵障壁）`
          : this.calamityBoss.nameJa,
        hp: this.calamityBoss.hp,
        maxHp: this.calamityBoss.maxHp,
        shieldActive: this.calamityBoss.goldenShieldActive,
      };
    }
    if (this.activeStage === 'dark_beast' && this.darkBeastBoss && !this.darkBeastBoss.defeated) {
      return {
        nameJa: this.darkBeastBoss.finalEyeExposed
          ? `${this.darkBeastBoss.nameJa}（頭頂の怨念の目 露出！）`
          : `${this.darkBeastBoss.nameJa}（光の紋章 ${this.darkBeastBoss.crestsDestroyed}/6）`,
        hp: this.darkBeastBoss.hp,
        maxHp: this.darkBeastBoss.maxHp,
      };
    }
    return null;
  }

  /**
   * Enters Hyrule Castle Sanctum at Y=1200 and starts Calamity Ganon battle!
   */
  public enterSanctum(
    save: SaveSlotData,
    overworldPos: THREE.Vector3,
    overworldYaw: number
  ): { spawnPos: THREE.Vector3; spawnYaw: number; freedBeasts: number; startingHp: number } {
    this.clearArena();
    this.activeStage = 'sanctum';
    this.overworldReturnPos.copy(overworldPos);
    this.overworldReturnYaw = overworldYaw;
    this.arenaTime = 0;

    this.physics.enterInteriorContext();
    setInteriorEnvironmentOverride({
      getFloorY: () => HYRULE_CASTLE_SANCTUM_Y,
      getWaterLevel: () => null,
    });

    const freedCount = Math.min(4, save.defeatedDivineBeasts.length);
    const startingHp = computeCalamityGanonStartingHp(freedCount);
    this.buildSanctumArena(freedCount, startingHp);

    this.group.visible = true;
    const spawnPos = new THREE.Vector3(0, HYRULE_CASTLE_SANCTUM_Y, 18.0);
    this.lastSafePos.copy(spawnPos);
    return { spawnPos, spawnYaw: Math.PI, freedBeasts: freedCount, startingHp };
  }

  /**
   * Transitions from Sanctum (Y=1200) to Dark Beast Ganon Open Plain (Y=1350),
   * automatically granting and equipping Bow of Light (ATK 100, infinite straight light arrows).
   */
  public enterDarkBeastArena(save: SaveSlotData): { spawnPos: THREE.Vector3; spawnYaw: number } {
    this.clearArena();
    this.activeStage = 'dark_beast';
    this.arenaTime = 0;

    // Grant & equip Bow of Light
    if (!save.bows.some((b) => b.id === 'bow_of_light')) {
      const bowDef = BOWS.find((b) => b.id === 'bow_of_light');
      if (bowDef) {
        save.bows.push({ ...bowDef, currentDurability: 9999 });
      }
    }
    save.equippedBowId = 'bow_of_light';

    setInteriorEnvironmentOverride({
      getFloorY: () => DARK_BEAST_ARENA_Y,
      getWaterLevel: () => null,
    });

    this.buildDarkBeastArena();
    this.group.visible = true;
    const spawnPos = new THREE.Vector3(0, DARK_BEAST_ARENA_Y, 34.0);
    this.lastSafePos.copy(spawnPos);
    return { spawnPos, spawnYaw: Math.PI };
  }

  public exitCastle(): { returnPos: THREE.Vector3; returnYaw: number } {
    this.clearArena();
    this.physics.exitInteriorContext();
    setInteriorEnvironmentOverride(null);
    this.group.visible = false;
    this.activeStage = null;
    return {
      returnPos: this.overworldReturnPos.clone(),
      returnYaw: this.overworldReturnYaw,
    };
  }

  private clearArena(): void {
    while (this.arenaGroup.children.length > 0) {
      this.arenaGroup.remove(this.arenaGroup.children[0]);
    }
    this.calamityBoss = null;
    this.darkBeastBoss = null;
    this.introLasers = [];
  }

  private buildSanctumArena(freedBeasts: number, startingHp: number): void {
    const y0 = HYRULE_CASTLE_SANCTUM_Y;

    const amb = new THREE.AmbientLight('#8e6880', 0.85);
    const key = new THREE.DirectionalLight('#ff9c88', 0.95);
    key.position.set(12, y0 + 26, 14);
    const coreLight = new THREE.PointLight('#ff2a64', 3.0, 48);
    coreLight.position.set(0, y0 + 8, -10);
    this.arenaGroup.add(amb, key, coreLight);

    // Circular Gothic Stone Floor (radius 30m)
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(30, 31, 2.0, 28), this.stoneMat);
    floor.position.set(0, y0 - 1.0, 0);
    floor.receiveShadow = true;
    this.arenaGroup.add(floor);

    // 12 Gothic Columns + Stained-glass glow slits around perimeter
    const wallR = 28.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const cx = Math.cos(a) * wallR;
      const cz = Math.sin(a) * wallR;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 22, 8), this.darkMat);
      col.position.set(cx, y0 + 11, cz);
      this.arenaGroup.add(col);
      this.physics.addBoxCollider(`hc_col_${i}`, cx, cz, 2.4, 2.4, y0, y0 + 22);

      // Glowing stained-glass lancet slit between columns
      const aMid = a + Math.PI / 12;
      const slit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 12.0, 0.5), this.glassMat);
      slit.position.set(Math.cos(aMid) * (wallR + 0.4), y0 + 9.5, Math.sin(aMid) * (wallR + 0.4));
      slit.rotation.y = -aMid + Math.PI * 0.5;
      this.arenaGroup.add(slit);
    }

    // Perimeter containment walls (square outer bounds)
    this.physics.addBoxCollider('hc_wall_n', 0, -29.5, 60, 2, y0, y0 + 24);
    this.physics.addBoxCollider('hc_wall_s', 0, 29.5, 60, 2, y0, y0 + 24);
    this.physics.addBoxCollider('hc_wall_w', -29.5, 0, 2, 60, y0, y0 + 24);
    this.physics.addBoxCollider('hc_wall_e', 29.5, 0, 2, 60, y0, y0 + 24);

    // Malice Pools (decorative hazards around outer ring)
    for (const [mx, mz] of [[-14, -12], [14, -12], [-15, 10], [15, 10]]) {
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.16, 12), this.maliceMat);
      pool.position.set(mx, y0 + 0.08, mz);
      this.arenaGroup.add(pool);
    }

    // Build Calamity Ganon (6-legged mechanical Guardian-spider silhouette)
    const bossPos = new THREE.Vector3(0, y0 + 0.5, -10.0);
    const bossGrp = new THREE.Group();
    bossGrp.position.copy(bossPos);

    const carapace = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 12), this.darkMat);
    carapace.scale.set(1.2, 0.9, 1.35);
    carapace.position.y = 3.2;
    const maliceCore = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 1), this.maliceMat);
    maliceCore.position.set(0, 3.4, 2.2);
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.4, 7), this.darkMat);
    head.rotation.x = Math.PI * 0.45;
    head.position.set(0, 4.4, 2.5);
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 10, 8),
      createBotWToonMaterial({ color: '#ff3a6e', emissive: '#ff1048', emissiveIntensity: 2.0 })
    );
    eye.position.set(0, 4.5, 3.2);
    bossGrp.add(carapace, maliceCore, head, eye);

    const legs: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const idx = i % 3;
      const legGrp = new THREE.Group();
      legGrp.position.set(side * 2.2, 2.8, (idx - 1) * 1.9);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.48, 0.48), this.maliceMat);
      upper.position.set(side * 1.2, 0.4, 0);
      upper.rotation.z = side * 0.35;
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.6, 0.42), this.darkMat);
      lower.position.set(side * 2.4, -1.3, 0);
      legGrp.add(upper, lower);
      bossGrp.add(legGrp);
      legs.push(legGrp);
    }

    // Golden Invulnerable Shield sphere (Phase 2)
    const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(4.6, 18, 14), this.goldMat);
    shieldMesh.position.y = 3.2;
    shieldMesh.visible = false;
    bossGrp.add(shieldMesh);

    this.arenaGroup.add(bossGrp);

    // Fire opening Divine Beast Red Lasers (one beam per freed beast!)
    const laserOrigins = [
      new THREE.Vector3(-24, y0 + 16, -22),
      new THREE.Vector3(24, y0 + 16, -22),
      new THREE.Vector3(-24, y0 + 16, 14),
      new THREE.Vector3(24, y0 + 16, 14),
    ];
    const laserMat = new THREE.MeshBasicMaterial({ color: '#ff1c44', transparent: true, opacity: 0.9 });
    for (let i = 0; i < freedBeasts; i++) {
      const from = laserOrigins[i];
      const to = bossPos.clone().add(new THREE.Vector3(0, 3.4, 0));
      const dist = from.distanceTo(to);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, dist, 8), laserMat);
      beam.position.copy(from).lerp(to, 0.5);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      this.arenaGroup.add(beam);
      this.introLasers.push({ mesh: beam, life: 2.6 });
    }

    // Phase 2 triggers at <= 50% of startingHp (so even with 4 beasts freed at 2000 HP, Phase 2 triggers at <= 1000 HP)
    const phase2Threshold = Math.min(2000, Math.round(startingHp * 0.5));
    this.calamityBoss = {
      nameJa: '厄災ガノン',
      hp: startingHp,
      maxHp: CALAMITY_GANON_BASE_HP,
      startingHp,
      phase2Threshold,
      phase: 1,
      state: freedBeasts > 0 ? 'intro_lasers' : 'idle',
      timer: freedBeasts > 0 ? 2.2 : 1.8,
      downedTimer: 0,
      goldenShieldActive: false,
      position: bossPos,
      mesh: bossGrp,
      shieldMesh,
      legs,
      freedBeastLasersFired: freedBeasts,
    };
  }

  private buildDarkBeastArena(): void {
    const y0 = DARK_BEAST_ARENA_Y;

    const amb = new THREE.AmbientLight('#c89c82', 0.95);
    const sun = new THREE.DirectionalLight('#ffd4a8', 1.15);
    sun.position.set(24, y0 + 38, 28);
    this.arenaGroup.add(amb, sun);

    // Wide Hyrule Field plain (150m x 150m)
    const plain = new THREE.Mesh(new THREE.CylinderGeometry(76, 78, 2.0, 32), this.grassMat);
    plain.position.set(0, y0 - 1.0, 0);
    plain.receiveShadow = true;
    this.arenaGroup.add(plain);

    // Fiery golden-crimson barrier ring enclosing the plain
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(68, 1.2, 8, 40),
      createBotWToonMaterial({ color: '#ff6420', emissive: '#ff3c08', emissiveIntensity: 1.4 })
    );
    ring.rotation.x = Math.PI * 0.5;
    ring.position.set(0, y0 + 1.2, 0);
    this.arenaGroup.add(ring);

    this.physics.addBoxCollider('dbg_wall_n', 0, -68, 140, 2, y0, y0 + 30);
    this.physics.addBoxCollider('dbg_wall_s', 0, 68, 140, 2, y0, y0 + 30);
    this.physics.addBoxCollider('dbg_wall_w', -68, 0, 2, 140, y0, y0 + 30);
    this.physics.addBoxCollider('dbg_wall_e', 68, 0, 2, 140, y0, y0 + 30);

    // Permanent updraft columns around Dark Beast Ganon so Link can Paraglide to shoot the top Malice Eye!
    this.physics.spawnFireUpdraft(new THREE.Vector3(-18, y0, 4), 5.5, 28, 9999);
    this.physics.spawnFireUpdraft(new THREE.Vector3(18, y0, 4), 5.5, 28, 9999);
    this.physics.spawnFireUpdraft(new THREE.Vector3(0, y0, -24), 5.5, 28, 9999);

    // Build colossal Dark Beast Ganon boar silhouette
    const beastPos = new THREE.Vector3(0, y0, -10.0);
    const beastGrp = new THREE.Group();
    beastGrp.position.copy(beastPos);

    const body = new THREE.Mesh(new THREE.BoxGeometry(11.5, 9.0, 18.0), this.maliceMat);
    body.position.set(0, 7.2, 0);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(6.8, 5.2, 6.2), this.darkMat);
    snout.position.set(0, 6.2, 11.0);
    const tuskL = new THREE.Mesh(new THREE.ConeGeometry(0.95, 5.8, 8), this.goldMat);
    tuskL.position.set(-3.4, 5.8, 13.8);
    tuskL.rotation.x = Math.PI * 0.38;
    const tuskR = tuskL.clone();
    tuskR.position.x = 3.4;
    beastGrp.add(body, snout, tuskL, tuskR);

    for (const [lx, lz] of [[-4.8, 6.2], [4.8, 6.2], [-4.8, -6.2], [4.8, -6.2]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2.6, 5.2, 2.8), this.darkMat);
      leg.position.set(lx, 2.6, lz);
      beastGrp.add(leg);
    }

    // 6 Glowing Golden Crests (3 left flank, 3 right flank/back) exposed sequentially
    const crestOffsets: THREE.Vector3[] = [
      new THREE.Vector3(-6.1, 6.6, 4.5),
      new THREE.Vector3(6.1, 6.6, 4.5),
      new THREE.Vector3(-6.1, 7.4, -1.5),
      new THREE.Vector3(6.1, 7.4, -1.5),
      new THREE.Vector3(-6.1, 6.8, -6.8),
      new THREE.Vector3(6.1, 6.8, -6.8),
    ];
    const crests: DarkBeastCrest[] = crestOffsets.map((offset, idx) => {
      const cm = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.55, 1),
        createBotWToonMaterial({ color: '#fff078', emissive: '#ffce28', emissiveIntensity: 1.8 })
      );
      cm.position.copy(offset);
      cm.visible = idx === 0;
      beastGrp.add(cm);
      return {
        id: `dbg_crest_${idx}`,
        localOffset: offset.clone(),
        worldPos: beastPos.clone().add(offset),
        destroyed: false,
        active: idx === 0,
        mesh: cm,
      };
    });

    // Final Top Malice Eye (exposed after all 6 crests are destroyed)
    const eyeLocal = new THREE.Vector3(0, 12.8, 6.5);
    const finalEyeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 14, 12),
      createBotWToonMaterial({ color: '#ff2864', emissive: '#ff1048', emissiveIntensity: 2.2 })
    );
    finalEyeMesh.position.copy(eyeLocal);
    finalEyeMesh.visible = false;
    beastGrp.add(finalEyeMesh);

    this.arenaGroup.add(beastGrp);

    this.darkBeastBoss = {
      nameJa: '魔獣ガノン',
      hp: 700,
      maxHp: 700,
      position: beastPos,
      mesh: beastGrp,
      crests,
      crestsDestroyed: 0,
      finalEyeExposed: false,
      finalEyePos: beastPos.clone().add(eyeLocal),
      finalEyeMesh,
      beamTimer: 4.0,
      defeated: false,
    };
  }

  /**
   * Handles melee or arrow attacks against Calamity Ganon (Sanctum) or Dark Beast Ganon (Plain).
   */
  public onPlayerAttack(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    reach: number,
    damage: number,
    isArrow: boolean,
    isLightArrow = false
  ): {
    hit: boolean;
    blockedByShield?: boolean;
    calamityDefeated?: boolean;
    crestDestroyed?: boolean;
    finalEyeExposed?: boolean;
    darkBeastDefeated?: boolean;
  } {
    if (this.activeStage === 'sanctum' && this.calamityBoss && this.calamityBoss.state !== 'dead') {
      const boss = this.calamityBoss;
      const targetCenter = boss.position.clone().add(new THREE.Vector3(0, 3.2, 0));
      const to = targetCenter.clone().sub(origin);
      if (to.length() > reach + 3.4) return { hit: false };
      if (!isArrow && to.normalize().dot(dir) < 0.2) return { hit: false };

      if (boss.goldenShieldActive) {
        return { hit: true, blockedByShield: true };
      }

      const mult = boss.state === 'downed' ? 1.5 : 1.0;
      const finalDmg = Math.round(damage * mult);
      return { hit: true, calamityDefeated: this.damageCalamity(finalDmg) };
    }

    if (this.activeStage === 'dark_beast' && this.darkBeastBoss && !this.darkBeastBoss.defeated) {
      if (!isArrow) return { hit: false };
      const db = this.darkBeastBoss;
      const hitRadius = isLightArrow ? 4.4 : 3.2;

      if (!db.finalEyeExposed) {
        const activeCrest = db.crests.find((c) => c.active && !c.destroyed);
        if (activeCrest && origin.distanceTo(activeCrest.worldPos) <= reach + hitRadius) {
          activeCrest.destroyed = true;
          activeCrest.active = false;
          activeCrest.mesh.visible = false;
          db.crestsDestroyed += 1;
          db.hp = Math.max(100, db.hp - 100);

          const nextCrest = db.crests.find((c) => !c.destroyed);
          if (nextCrest) {
            nextCrest.active = true;
            nextCrest.mesh.visible = true;
            return { hit: true, crestDestroyed: true };
          } else {
            db.finalEyeExposed = true;
            db.finalEyeMesh.visible = true;
            return { hit: true, crestDestroyed: true, finalEyeExposed: true };
          }
        }
      } else if (origin.distanceTo(db.finalEyePos) <= reach + hitRadius + 1.5) {
        db.hp = 0;
        db.defeated = true;
        db.finalEyeMesh.visible = false;
        return { hit: true, darkBeastDefeated: true };
      }
    }

    return { hit: false };
  }

  /**
   * Breaks Calamity Ganon's Phase 2 Golden Invulnerable Shield via Perfect Guard, Flurry Rush, or Urbosa's Fury!
   */
  public breakGoldenShield(
    method: 'perfect_guard' | 'flurry_rush' | 'urbosa'
  ): { broken: boolean; calamityDefeated?: boolean; messageJa: string } {
    const boss = this.calamityBoss;
    if (!boss || boss.state === 'dead') return { broken: false, messageJa: '' };
    if (!boss.goldenShieldActive) {
      if (method === 'urbosa') {
        const defeated = this.damageCalamity(280);
        boss.state = 'downed';
        boss.downedTimer = 4.5;
        return { broken: true, calamityDefeated: defeated, messageJa: '⚡ ウルボザの怒りが厄災ガノンを貫いた！' };
      }
      return { broken: false, messageJa: '' };
    }

    boss.goldenShieldActive = false;
    boss.shieldMesh.visible = false;
    boss.state = 'downed';
    boss.downedTimer = 5.5;
    const bonusDmg = method === 'perfect_guard' ? 240 : method === 'urbosa' ? 260 : 180;
    const defeated = this.damageCalamity(bonusDmg);
    const label =
      method === 'perfect_guard'
        ? '🛡️ ガードジャストでビーム跳ね返し！厄災ガノンの黄金障壁が砕け散った！！'
        : method === 'urbosa'
          ? '⚡ ウルボザの怒りで厄災ガノンの黄金障壁を破壊した！！'
          : '⚔️ ラッシュ攻撃で厄災ガノンの黄金障壁を打ち砕いた！！';
    return { broken: true, calamityDefeated: defeated, messageJa: label };
  }

  private damageCalamity(dmg: number): boolean {
    const boss = this.calamityBoss;
    if (!boss || boss.state === 'dead') return false;
    boss.hp = Math.max(0, boss.hp - dmg);
    if (boss.phase === 1 && boss.hp > 0 && boss.hp <= boss.phase2Threshold) {
      boss.phase = 2;
      boss.goldenShieldActive = true;
      boss.shieldMesh.visible = true;
    }
    if (boss.hp <= 0) {
      boss.state = 'dead';
      boss.goldenShieldActive = false;
      boss.shieldMesh.visible = false;
      boss.mesh.visible = false;
      return true;
    }
    return false;
  }

  public getNearestInteractable(playerPos: THREE.Vector3): CastleInteractPrompt | null {
    if (this.activeStage !== 'sanctum') return null;
    const dExit = playerPos.distanceTo(this.exitPos);
    if (dExit <= 3.6) {
      return {
        id: 'hc_exit',
        kind: 'exit',
        label: 'ハイラル城・本丸から撤退する',
        distance: dExit,
      };
    }
    return null;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3
  ): {
    bossHitPlayer?: { damage: number; isLaser: boolean; labelJa: string };
    phase2Triggered?: boolean;
  } {
    if (!this.activeStage) return {};
    this.arenaTime += dt;

    // Fade out opening Divine Beast laser beams
    for (let i = this.introLasers.length - 1; i >= 0; i--) {
      this.introLasers[i].life -= dt;
      if (this.introLasers[i].life <= 0) {
        this.arenaGroup.remove(this.introLasers[i].mesh);
        this.introLasers.splice(i, 1);
      }
    }

    let bossHitPlayer: { damage: number; isLaser: boolean; labelJa: string } | undefined;

    if (this.activeStage === 'sanctum' && this.calamityBoss && this.calamityBoss.state !== 'dead') {
      const boss = this.calamityBoss;
      const toPlayer = playerPos.clone().sub(boss.position);
      const dist = Math.hypot(toPlayer.x, toPlayer.z);
      boss.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

      // Animate spider legs
      boss.legs.forEach((leg, i) => {
        leg.rotation.x = Math.sin(this.arenaTime * 4.0 + i * 1.1) * 0.25;
      });

      if (boss.state === 'downed') {
        boss.downedTimer -= dt;
        boss.mesh.position.set(boss.position.x, HYRULE_CASTLE_SANCTUM_Y + 0.1, boss.position.z);
        if (boss.downedTimer <= 0) {
          boss.state = 'idle';
          boss.timer = 1.6;
          if (boss.phase === 2) {
            boss.goldenShieldActive = true;
            boss.shieldMesh.visible = true;
          }
        }
      } else {
        boss.mesh.position.copy(boss.position);
        boss.timer -= dt;
        if (boss.timer <= 0) {
          if (boss.state === 'intro_lasers') {
            boss.state = 'idle';
            boss.timer = 1.8;
          } else if (dist > 8.5) {
            // Guardian Laser Attack (can be Perfect Guarded to break Phase 2 Golden Shield!)
            bossHitPlayer = {
              damage: 16,
              isLaser: true,
              labelJa: '厄災ガノンのガーディアンビーム！（ガードジャストで跳ね返せ！）',
            };
            boss.timer = boss.phase === 2 ? 2.8 : 3.2;
          } else {
            // Flame Sword Slash / Spider Charge
            bossHitPlayer = {
              damage: 14,
              isLaser: false,
              labelJa: '厄災ガノンの火炎大剣なぎ払い！（回避ジャストでラッシュ！）',
            };
            boss.timer = 2.5;
          }
        }
      }
    } else if (this.activeStage === 'dark_beast' && this.darkBeastBoss && !this.darkBeastBoss.defeated) {
      const db = this.darkBeastBoss;
      db.beamTimer -= dt;
      // Pulse active crest or final eye
      for (const c of db.crests) {
        if (c.active) {
          const s = 1 + Math.sin(this.arenaTime * 5.0) * 0.16;
          c.mesh.scale.setScalar(s);
        }
      }
      if (db.finalEyeExposed) {
        const s = 1 + Math.sin(this.arenaTime * 6.0) * 0.18;
        db.finalEyeMesh.scale.setScalar(s);
      }
      if (db.beamTimer <= 0) {
        db.beamTimer = 5.5;
        if (playerPos.z > db.position.z + 10 && Math.abs(playerPos.x - db.position.x) < 7.5) {
          bossHitPlayer = {
            damage: 12,
            isLaser: true,
            labelJa: '魔獣ガノンの極太怨念レーザー！左右へ回り込もう！',
          };
        }
      }
    }

    return { bossHitPlayer };
  }
}
