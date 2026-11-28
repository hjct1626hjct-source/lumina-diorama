import * as THREE from 'three';
import { createBotWToonMaterial } from '../rendering/BotWToonShader';
import { textureBank } from '../rendering/ProceduralTextures';
import { PhysicsChemistryEngine, type PhysicsBody } from '../physics/PhysicsChemistryEngine';
import { getTerrainHeight, isNoBikeZone, isWaterAt } from '../world/TerrainGenerator';
import { WORLD_BOUNDS } from '../data/regions';
import type { RuneId } from '../types/botw';

export interface ActiveBomb {
  id: string;
  shape: 'round' | 'square';
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  grounded: boolean;
}

export interface ActiveCryonisPillar {
  id: string;
  body: PhysicsBody;
  mesh: THREE.Group;
  targetHeight: number;
  currentHeight: number;
}

export interface RuneNotification {
  text: string;
  accent?: 'cyan' | 'amber' | 'red';
}

/**
 * Complete Sheikah Slate Rune Engine + DLC 2 Master Cycle Zero:
 * 1. Magnesis (20m metal scan red->yellow highlight, magnetic beam, inertia/pendulum, lightning rod, Flying Machine)
 * 2. Remote Bombs Round & Square (independent CD 6s->3s+, 12->24 dmg+, rolling vs stable, Windbomb BIL impulse!)
 * 3. Stasis / Stasis+ (10s CD, yellow glow, kinetic vector arrows, enemy freeze 5s/2s, Stasis Overflow)
 * 4. Cryonis (max 3 climbable ice pillars on water/waterfalls/bogs, land blocked, Cryo-Bounce impulse!)
 * 5. Camera & Hyrule Compendium (photo capture + entity auto-recognition + Sheikah Sensor+)
 * 6. Master Cycle Zero (1,000 fuel tank, 2.777/s burn rate = 360s max, Gerudo/Eldin no-bike check)
 */
export function isRuneUnlocked(
  rune: RuneId | null,
  unlockedRunes: readonly RuneId[],
  hasSheikahSlate = true
): boolean {
  if (!hasSheikahSlate || !rune) return false;
  return unlockedRunes.includes(rune);
}

export class SheikahRuneSystem {
  public readonly group = new THREE.Group();
  public activeRune: RuneId | null = null;

  // Magnesis state
  public magnesisActive = false;
  public magnesisTarget: PhysicsBody | null = null;
  public magnesisHoldDist = 7.5;
  public magnesisHoldHeight = 2.6;
  private magnesisBeam: THREE.Mesh;
  private magnesisGridRing: THREE.Mesh;

  // Remote Bombs (Round & Square with independent cooldowns!)
  public roundBomb: ActiveBomb | null = null;
  public squareBomb: ActiveBomb | null = null;
  public roundBombCd = 0;
  public squareBombCd = 0;

  // Stasis
  public stasisCd = 0;
  public stasisTarget: PhysicsBody | null = null;

  // Cryonis (max 3 pillars, 4th auto-shatters oldest)
  public cryonisPillars: ActiveCryonisPillar[] = [];

  // Master Cycle Zero (DLC 2)
  public bikeSpawned = false;
  public ridingBike = false;
  public bikePos = new THREE.Vector3();
  public bikeYaw = 0;
  public bikeSpeed = 0;
  public bikeFuel = 1000; // Max 1000 units, burns 2.777/sec = 360s continuous drive
  public readonly bikeGroup = new THREE.Group();
  private bikeWheels: THREE.Mesh[] = [];

  // Camera Mode
  public cameraModeActive = false;
  public selfiePose = false;

  // Blast flash VFX pool
  private blastFlashes: Array<{ mesh: THREE.Mesh; life: number; maxLife: number }> = [];

  constructor(scene: THREE.Scene) {
    this.group.name = 'SheikahRuneEffects';

    // Magnesis Glowing Beam
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.18, 1, 8, 1, true);
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.translate(0, 0, 0.5);
    this.magnesisBeam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({ color: '#ff4270', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
    );
    this.magnesisBeam.visible = false;
    this.group.add(this.magnesisBeam);

    // Magnesis Red Scan Grid Ring around Link
    this.magnesisGridRing = new THREE.Mesh(
      new THREE.RingGeometry(19.4, 20.0, 48),
      new THREE.MeshBasicMaterial({ color: '#ff3656', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    );
    this.magnesisGridRing.rotation.x = -Math.PI / 2;
    this.magnesisGridRing.visible = false;
    this.group.add(this.magnesisGridRing);

    // Build Sculpted Master Cycle Zero (Ancient Sheikah Horse-Head Motorcycle!)
    this.buildMasterCycleZero();
    this.bikeGroup.visible = false;
    this.group.add(this.bikeGroup);

    scene.add(this.group);
  }

  private buildMasterCycleZero(): void {
    const shTex = textureBank.getSheikahStoneTexture();
    const darkMetal = createBotWToonMaterial({
      color: '#3a4250',
      map: shTex.map,
      emissive: '#22ddff',
      emissiveMap: shTex.emissiveMap,
      emissiveIntensity: 1.5,
      sheikahCircuit: true,
      sheikahActivated: 1.0,
      metalHighlight: true,
    });
    const goldMat = createBotWToonMaterial({ color: '#e6c05c', metalHighlight: true });
    const cyanGlow = createBotWToonMaterial({ color: '#42ecff', emissive: '#1ad8ff', emissiveIntensity: 1.8 });

    // Chassis spine
    const chassis = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.35, 8, 12), darkMetal);
    chassis.rotation.x = Math.PI / 2;
    chassis.position.set(0, 0.78, 0);
    this.bikeGroup.add(chassis);

    // Iconic Sheikah Horse-Head Front Cowling
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.72, 8), darkMetal);
    neck.position.set(0, 1.18, 0.65);
    neck.rotation.x = 0.35;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.56, 6), goldMat);
    head.position.set(0, 1.48, 0.88);
    head.rotation.x = Math.PI / 2 + 0.25;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.16), cyanGlow);
    visor.position.set(0, 1.45, 0.96);
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.92, 6), goldMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.24, 0.45);
    this.bikeGroup.add(neck, head, visor, handlebar);

    // Front & Rear Glowing Sheikah Wheels
    for (const wz of [0.95, -0.92]) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 10, 20), darkMetal);
      tire.rotation.y = Math.PI / 2;
      tire.position.set(0, 0.50, wz);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 16), cyanGlow);
      rim.rotation.y = Math.PI / 2;
      rim.position.set(0, 0.50, wz);
      this.bikeGroup.add(tire, rim);
      this.bikeWheels.push(tire);
    }

    // Saddle seat & rear glowing thruster
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.65), createBotWToonMaterial({ color: '#4c3220' }));
    seat.position.set(0, 1.04, -0.18);
    const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.20, 0.28, 10), cyanGlow);
    thruster.rotation.x = Math.PI / 2;
    thruster.position.set(0, 0.84, -1.05);
    this.bikeGroup.add(seat, thruster);
  }

  selectRune(rune: RuneId | null, unlockedRunes?: RuneId[]): void {
    if (rune && unlockedRunes && !unlockedRunes.includes(rune)) {
      return;
    }
    if (this.activeRune !== rune) {
      this.releaseMagnesis();
      this.cameraModeActive = rune === 'camera';
      this.activeRune = rune;
    }
  }

  releaseMagnesis(): void {
    if (this.magnesisTarget) {
      this.magnesisTarget.magnesisGrabbed = false;
      this.magnesisTarget.onMagnesisHighlight?.(0);
      this.magnesisTarget = null;
    }
    this.magnesisActive = false;
    this.magnesisBeam.visible = false;
    this.magnesisGridRing.visible = false;
  }

  /**
   * Executes the currently selected Sheikah Rune!
   */
  activateCurrentRune(params: {
    playerPos: THREE.Vector3;
    forwardDir: THREE.Vector3;
    physics: PhysicsChemistryEngine;
    upgradedBomb: boolean;
    upgradedStasis: boolean;
    unlockedRunes?: RuneId[];
    isRaining: boolean;
    isParagliding: boolean;
    onNotify: (n: RuneNotification) => void;
    onExplosionImpact: (pos: THREE.Vector3, radius: number, damage: number, impulse: number, isBomb: boolean) => void;
    onStasisEnemy?: (origin: THREE.Vector3, dir: THREE.Vector3, upgraded: boolean) => boolean;
    onCameraSnap?: () => void;
  }): boolean {
    const { playerPos, forwardDir, physics, upgradedBomb, upgradedStasis, unlockedRunes, isRaining, onNotify, onExplosionImpact } = params;

    if (!this.activeRune || (unlockedRunes && !unlockedRunes.includes(this.activeRune))) {
      onNotify({ text: 'シーカーアイテムがまだ解放されていません！', accent: 'amber' });
      return false;
    }

    if (this.activeRune === 'magnesis') {
      if (this.magnesisTarget) {
        this.releaseMagnesis();
        onNotify({ text: 'マグネキャッチ解除', accent: 'cyan' });
        return true;
      }
      this.magnesisActive = true;
      // Search nearest Metal body within 20m in front cone
      let best: PhysicsBody | null = null;
      let bestScore = Infinity;
      for (const b of physics.bodies) {
        if (b.material !== 'Metal') continue;
        const dist = b.position.distanceTo(playerPos);
        if (dist > 20.5) continue;
        const dir = b.position.clone().sub(playerPos).normalize();
        const align = dir.dot(forwardDir);
        if (align < 0.1) continue;
        const score = dist * (1.6 - align);
        if (score < bestScore) {
          bestScore = score;
          best = b;
        }
      }

      if (!best) {
        onNotify({ text: 'マグネキャッチ：周囲20m内の金属物をスキャン中…', accent: 'red' });
        return true;
      }

      // Authentic BotW rule: CANNOT lift metal directly underneath Link,
      // EXCEPT when an intermediate rigid body sits between Link and target (Flying Machine!)
      if (physics.isPlayerStandingDirectlyOn(playerPos, best)) {
        onNotify({ text: '直接乗っている金属物は持ち上げられません！（間に別剛体を挟むと飛行可能）', accent: 'amber' });
        return false;
      }

      this.magnesisTarget = best;
      best.magnesisGrabbed = true;
      best.onMagnesisHighlight?.(2); // Yellow locked highlight!
      this.magnesisHoldDist = Math.max(4.5, Math.min(14, best.position.distanceTo(playerPos)));
      this.magnesisHoldHeight = Math.max(2.0, best.position.y - playerPos.y + 1.5);
      onNotify({ text: `マグネキャッチ捕捉：${best.labelJa}`, accent: 'amber' });
      return true;
    }

    if (this.activeRune === 'bomb_round' || this.activeRune === 'bomb_square') {
      const shape = this.activeRune === 'bomb_round' ? 'round' : 'square';
      const existing = shape === 'round' ? this.roundBomb : this.squareBomb;
      if (existing) {
        // Detonate active bomb!
        this.detonateBomb(shape, physics, upgradedBomb, isRaining, onExplosionImpact, onNotify);
        return true;
      }
      const cd = shape === 'round' ? this.roundBombCd : this.squareBombCd;
      if (cd > 0) {
        onNotify({ text: `リモコンバクダン充電中 (${cd.toFixed(1)}s)`, accent: 'cyan' });
        return false;
      }
      this.spawnBomb(shape, playerPos, forwardDir, params.isParagliding);
      onNotify({
        text: shape === 'round' ? 'リモコンバクダン（丸）投下！再発動で起爆' : 'リモコンバクダン（四角）設置！再発動で起爆',
        accent: 'cyan',
      });
      return true;
    }

    if (this.activeRune === 'stasis') {
      if (this.stasisCd > 0) {
        onNotify({ text: `ビタロック充電中 (${this.stasisCd.toFixed(1)}s)`, accent: 'amber' });
        return false;
      }
      // First check rigid body objects within 18m
      let best: PhysicsBody | null = null;
      let bestDist = 18.5;
      for (const b of physics.bodies) {
        if (b.isStatic || b.isFrozenStasis) continue;
        const d = b.position.distanceTo(playerPos);
        if (d < bestDist) {
          const align = b.position.clone().sub(playerPos).normalize().dot(forwardDir);
          if (align > 0.25) {
            bestDist = d;
            best = b;
          }
        }
      }
      if (best) {
        best.isFrozenStasis = true;
        best.stasisTimer = 7.5;
        best.stasisHits = 0;
        best.stasisAccumImpulse.set(0, 0, 0);
        best.velocity.set(0, 0, 0);
        best.onStasisVisual?.(1.0);
        this.stasisTarget = best;
        this.stasisCd = 10.0; // Fixed 10s CD per BotW spec
        onNotify({ text: `ビタロック発動：${best.labelJa} を時間停止！攻撃で運動量を蓄積`, accent: 'amber' });
        return true;
      }
      // Stasis+ enemy time freeze!
      if (params.onStasisEnemy?.(playerPos, forwardDir, upgradedStasis)) {
        this.stasisCd = 10.0;
        onNotify({ text: 'ビタロック＋：魔物の時間を停止した！', accent: 'amber' });
        return true;
      }
      onNotify({ text: 'ビタロック対象が前方にありません', accent: 'amber' });
      return false;
    }

    if (this.activeRune === 'cryonis') {
      // Check water target in front of player (3..16m)
      let waterSpot: THREE.Vector3 | null = null;
      for (let dist = 3.5; dist <= 16; dist += 1.5) {
        const tx = playerPos.x + forwardDir.x * dist;
        const tz = playerPos.z + forwardDir.z * dist;
        if (isWaterAt(tx, tz)) {
          waterSpot = new THREE.Vector3(tx, WORLD_BOUNDS.waterLevel, tz);
          break;
        }
      }
      if (!waterSpot) {
        onNotify({ text: 'アイスメイカー：前方に水面がありません（陸地・温泉では生成不可）', accent: 'cyan' });
        return false;
      }
      // Max 3 Cryonis pillars; 4th automatically shatters the oldest!
      if (this.cryonisPillars.length >= 3) {
        const oldest = this.cryonisPillars.shift()!;
        this.group.remove(oldest.mesh);
        physics.removeBody(oldest.body.id);
      }
      this.spawnCryonisPillar(waterSpot, physics);
      onNotify({ text: `アイスメイカー：氷柱を生成 (${this.cryonisPillars.length}/3)`, accent: 'cyan' });
      return true;
    }

    if (this.activeRune === 'camera') {
      params.onCameraSnap?.();
      return true;
    }

    if (this.activeRune === 'master_cycle') {
      const check = isNoBikeZone(playerPos.x, playerPos.z);
      if (check.blocked) {
        onNotify({ text: check.reasonJa, accent: 'red' });
        return false;
      }
      if (this.ridingBike) {
        this.ridingBike = false;
        onNotify({ text: 'マスターバイク零式から降車', accent: 'cyan' });
        return true;
      }
      this.bikeSpawned = true;
      this.bikeGroup.visible = true;
      this.bikePos.set(playerPos.x + forwardDir.x * 2.8, getTerrainHeight(playerPos.x + forwardDir.x * 2.8, playerPos.z + forwardDir.z * 2.8), playerPos.z + forwardDir.z * 2.8);
      this.bikeYaw = Math.atan2(forwardDir.x, forwardDir.z);
      this.bikeGroup.position.copy(this.bikePos);
      this.bikeGroup.rotation.y = this.bikeYaw;
      this.ridingBike = true;
      onNotify({ text: `マスターバイク零式召喚！（残燃料 ${Math.round((this.bikeFuel / 1000) * 100)}%）`, accent: 'cyan' });
      return true;
    }

    return false;
  }

  private spawnBomb(shape: 'round' | 'square', playerPos: THREE.Vector3, forwardDir: THREE.Vector3, isParagliding: boolean): void {
    const grp = new THREE.Group();
    const shTex = textureBank.getSheikahStoneTexture();
    const bombMat = createBotWToonMaterial({
      color: '#20c8ff',
      map: shTex.map,
      emissive: '#18e0ff',
      emissiveMap: shTex.emissiveMap,
      emissiveIntensity: 2.0,
      sheikahCircuit: true,
      sheikahActivated: 1.0,
      sheikahHeight: 0.7,
    });
    const core = new THREE.Mesh(
      shape === 'round' ? new THREE.IcosahedronGeometry(0.42, 2) : new THREE.BoxGeometry(0.68, 0.68, 0.68),
      bombMat
    );
    grp.add(core);

    const pos = playerPos.clone().add(new THREE.Vector3(forwardDir.x * 1.1, isParagliding ? 0.2 : 1.45, forwardDir.z * 1.1));
    const vel = isParagliding
      ? new THREE.Vector3(0, -1.5, 0)
      : forwardDir.clone().multiplyScalar(11.5).add(new THREE.Vector3(0, 5.2, 0));

    grp.position.copy(pos);
    this.group.add(grp);

    const bomb: ActiveBomb = {
      id: `bomb_${shape}_${Date.now()}`,
      shape,
      mesh: grp,
      position: pos,
      velocity: vel,
      grounded: false,
    };
    if (shape === 'round') this.roundBomb = bomb;
    else this.squareBomb = bomb;
  }

  detonateBomb(
    shape: 'round' | 'square',
    physics: PhysicsChemistryEngine,
    upgraded: boolean,
    isRaining: boolean,
    onExplosionImpact: (pos: THREE.Vector3, radius: number, damage: number, impulse: number, isBomb: boolean) => void,
    onNotify?: (n: RuneNotification) => void
  ): void {
    const bomb = shape === 'round' ? this.roundBomb : this.squareBomb;
    if (!bomb) return;
    const pos = bomb.position.clone();
    this.group.remove(bomb.mesh);
    if (shape === 'round') {
      this.roundBomb = null;
      this.roundBombCd = upgraded ? 3.0 : 6.0;
    } else {
      this.squareBomb = null;
      this.squareBombCd = upgraded ? 3.0 : 6.0;
    }

    // Blast damage: 12 normal / 24 upgraded+, radius constant per BotW spec!
    const dmg = upgraded ? 24 : 12;
    const radius = 6.5;

    // Destroy Cryonis pillars within bomb radius (one of only 3 valid destroyers!)
    for (let i = this.cryonisPillars.length - 1; i >= 0; i--) {
      const p = this.cryonisPillars[i];
      if (p.body.position.distanceTo(pos) <= radius + 1.5) {
        this.group.remove(p.mesh);
        physics.removeBody(p.body.id);
        this.cryonisPillars.splice(i, 1);
      }
    }

    // Spawn cyan Sheikah explosion dome VFX
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 18, 12),
      new THREE.MeshBasicMaterial({ color: '#42ecff', transparent: true, opacity: 0.78, depthWrite: false })
    );
    flash.position.copy(pos);
    this.group.add(flash);
    this.blastFlashes.push({ mesh: flash, life: 0.42, maxLife: 0.42 });

    // Trigger simultaneous Physics radial impulse + Chemistry Fire/Updraft!
    physics.triggerExplosion(pos, radius, 22.0, isRaining);
    onExplosionImpact(pos, radius, dmg, 24.0, true);
    onNotify?.({ text: `バクダン起爆！ (威力${dmg})`, accent: 'cyan' });
  }

  private spawnCryonisPillar(spot: THREE.Vector3, physics: PhysicsChemistryEngine): void {
    const grp = new THREE.Group();
    const iceTex = textureBank.getSnowTexture();
    const iceMat = createBotWToonMaterial({
      color: '#a8ecff',
      map: iceTex.map,
      normalMap: iceTex.normalMap,
      emissive: '#22a8df',
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.88,
      rimStrength: 0.65,
      rimTint: '#ffffff',
    });
    const col = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.8, 2.6), iceMat);
    col.position.y = 1.9;
    col.castShadow = true;
    col.receiveShadow = true;
    grp.add(col);
    grp.position.set(spot.x, spot.y - 3.6, spot.z);
    this.group.add(grp);

    const body: PhysicsBody = {
      id: `cryonis_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      labelJa: 'アイスメイカー氷柱',
      mesh: grp,
      position: new THREE.Vector3(spot.x, spot.y, spot.z),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      mass: 999,
      radius: 1.5,
      halfHeight: 1.9,
      material: 'IceBlock',
      isStatic: true,
      isCryonisPillar: true,
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
    };
    physics.addBody(body);

    this.cryonisPillars.push({
      id: body.id,
      body,
      mesh: grp,
      targetHeight: spot.y,
      currentHeight: spot.y - 3.6,
    });
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    physics: PhysicsChemistryEngine,
    isThunderstorm: boolean,
    windStrength: number
  ): { bikeFuelEmpty?: boolean; magnesisShockedPlayer?: boolean } {
    const out: { bikeFuelEmpty?: boolean; magnesisShockedPlayer?: boolean } = {};
    this.roundBombCd = Math.max(0, this.roundBombCd - dt);
    this.squareBombCd = Math.max(0, this.squareBombCd - dt);
    this.stasisCd = Math.max(0, this.stasisCd - dt);

    // 1. Magnesis scanning & held metal body spring-pendulum tracking
    this.magnesisGridRing.visible = this.activeRune === 'magnesis' && (this.magnesisActive || !!this.magnesisTarget);
    if (this.magnesisGridRing.visible) {
      this.magnesisGridRing.position.set(playerPos.x, playerPos.y + 0.15, playerPos.z);
    }

    for (const b of physics.bodies) {
      if (b.material !== 'Metal') continue;
      if (this.magnesisTarget === b) {
        b.onMagnesisHighlight?.(2);
      } else if (this.activeRune === 'magnesis' && this.magnesisActive && b.position.distanceTo(playerPos) <= 20.5) {
        b.onMagnesisHighlight?.(1);
      } else {
        b.onMagnesisHighlight?.(0);
      }
    }

    if (this.magnesisTarget) {
      const targetPos = playerPos
        .clone()
        .addScaledVector(forwardDir, this.magnesisHoldDist)
        .add(new THREE.Vector3(0, this.magnesisHoldHeight, 0));
      const gY = getTerrainHeight(targetPos.x, targetPos.z) + 0.2;
      targetPos.y = Math.max(gY, targetPos.y);

      // Smooth inertial spring motion (gives weighty Havok pendulum feel!)
      const delta = targetPos.sub(this.magnesisTarget.position);
      this.magnesisTarget.velocity.lerp(delta.multiplyScalar(6.5), Math.min(1, dt * 8));
      this.magnesisTarget.position.addScaledVector(this.magnesisTarget.velocity, dt);
      this.magnesisTarget.mesh.position.copy(this.magnesisTarget.position);

      // Update glowing magnetic beam from Link's hand to metal object
      const beamOrigin = playerPos.clone().add(new THREE.Vector3(0, 1.35, 0));
      const dist = beamOrigin.distanceTo(this.magnesisTarget.position);
      this.magnesisBeam.visible = true;
      this.magnesisBeam.position.copy(beamOrigin);
      this.magnesisBeam.lookAt(this.magnesisTarget.position);
      this.magnesisBeam.scale.set(1, 1, dist);

      // Lightning rod conduction during thunderstorms!
      if (isThunderstorm && Math.random() < dt * 0.18) {
        this.magnesisTarget.isElectrified = true;
        this.magnesisTarget.shockTimer = 4.0;
        out.magnesisShockedPlayer = true;
      }
    } else {
      this.magnesisBeam.visible = false;
    }

    // 2. Remote Bombs physics (Round rolls & wind-affected; Square stays stable!)
    for (const bomb of [this.roundBomb, this.squareBomb]) {
      if (!bomb) continue;
      const inWater = isWaterAt(bomb.position.x, bomb.position.z) && bomb.position.y < WORLD_BOUNDS.waterLevel;
      if (inWater) {
        bomb.velocity.y += (WORLD_BOUNDS.waterLevel - bomb.position.y) * 18 * dt;
        bomb.velocity.multiplyScalar(Math.pow(0.25, dt));
      } else {
        bomb.velocity.y -= 22.0 * dt;
      }
      if (bomb.shape === 'round') {
        bomb.velocity.x += windStrength * 0.65 * dt;
      }
      bomb.position.addScaledVector(bomb.velocity, dt);
      const gy = getTerrainHeight(bomb.position.x, bomb.position.z) + 0.35;
      if (bomb.position.y <= gy) {
        bomb.position.y = gy;
        bomb.velocity.y = bomb.shape === 'round' && bomb.velocity.y < -3 ? -bomb.velocity.y * 0.35 : 0;
        const damp = bomb.shape === 'round' ? 0.55 : 0.02;
        bomb.velocity.x *= Math.pow(damp, dt);
        bomb.velocity.z *= Math.pow(damp, dt);
        bomb.grounded = true;
      }
      bomb.mesh.position.copy(bomb.position);
      if (bomb.shape === 'round') {
        bomb.mesh.rotation.x += bomb.velocity.z * dt * 1.4;
        bomb.mesh.rotation.z -= bomb.velocity.x * dt * 1.4;
      }
    }

    // 3. Cryonis Pillar rising animation
    for (const p of this.cryonisPillars) {
      if (p.currentHeight < p.targetHeight) {
        p.currentHeight = Math.min(p.targetHeight, p.currentHeight + 14.0 * dt);
        p.mesh.position.y = p.currentHeight;
      }
    }

    // 4. Master Cycle Zero fuel burn (2.777 units/sec = 360 sec full tank) & wheel spin
    if (this.ridingBike) {
      if (Math.abs(this.bikeSpeed) > 0.5) {
        this.bikeFuel = Math.max(0, this.bikeFuel - 2.777 * dt);
        if (this.bikeFuel <= 0) {
          out.bikeFuelEmpty = true;
        }
        for (const w of this.bikeWheels) {
          w.rotation.x += this.bikeSpeed * dt * 1.8;
        }
      }
      this.bikeGroup.position.copy(this.bikePos);
      this.bikeGroup.rotation.y = this.bikeYaw;
    }

    // 5. Blast VFX fade
    for (let i = this.blastFlashes.length - 1; i >= 0; i--) {
      const f = this.blastFlashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.group.remove(f.mesh);
        this.blastFlashes.splice(i, 1);
      } else {
        const t = 1 - f.life / f.maxLife;
        f.mesh.scale.setScalar(0.4 + t * 0.9);
        (f.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.72;
      }
    }

    return out;
  }
}
