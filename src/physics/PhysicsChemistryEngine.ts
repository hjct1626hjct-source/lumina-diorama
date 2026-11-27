import * as THREE from 'three';
import { getTerrainHeight, getTerrainNormal, isWaterAt } from '../world/TerrainGenerator';
import { WORLD_BOUNDS } from '../data/regions';
import type { ChemistryElement, ChemistryMaterial } from '../types/botw';

export interface ChemistryReactionResult {
  ignited?: boolean;
  extinguished?: boolean;
  melted?: boolean;
  frozen?: boolean;
  electrified?: boolean;
  updraftCreated?: boolean;
  roastedFood?: boolean;
  shockRadius?: number;
  damage?: number;
  messageJa?: string;
}

/**
 * Pure GDC 2017 Chemistry Engine 3-Law Evaluator (exported for unit tests & live simulation!):
 * Law 1: Elements change Material states (Fire->Wood/Grass burn+updraft, Ice->Water/Organic freeze, Elec->Metal/Water conduct).
 * Law 2: Elements change other Elements (Water extinguishes Fire, Fire melts Ice, Water amplifies Electricity AoE).
 * Law 3: Materials NEVER directly change other Materials without an Element mediator.
 */
export function evaluateChemistryInteraction(
  element: ChemistryElement,
  material: ChemistryMaterial,
  env: { isRaining?: boolean; inWater?: boolean } = {}
): ChemistryReactionResult {
  const result: ChemistryReactionResult = {};

  // Law 1: Element -> Material
  if (element === 'Fire') {
    if (env.isRaining || env.inWater) {
      // Law 2: Water extinguishes Fire!
      result.extinguished = true;
      return result;
    }
    if (material === 'Grass' || material === 'Wood') {
      result.ignited = true;
      result.updraftCreated = true;
      result.damage = 10;
      result.messageJa = material === 'Grass' ? '草原が燃え上がり上昇気流が発生！' : '木製オブジェクトに着火！';
    } else if (material === 'IceBlock') {
      result.melted = true;
      result.messageJa = '氷塊が炎で融解した！';
    } else if (material === 'Organic') {
      result.ignited = true;
      result.roastedFood = true;
      result.damage = 10;
    } else if (material === 'WaterSurface') {
      result.extinguished = true;
    }
  } else if (element === 'Water') {
    if (material === 'Grass' || material === 'Wood' || material === 'Organic') {
      result.extinguished = true;
    }
  } else if (element === 'Ice') {
    if (material === 'WaterSurface') {
      result.frozen = true;
      result.messageJa = '水面が凍結した！';
    } else if (material === 'Organic') {
      result.frozen = true;
      result.damage = 10;
    }
  } else if (element === 'Electricity') {
    if (material === 'Metal') {
      result.electrified = true;
      result.shockRadius = env.isRaining || env.inWater ? 11.0 : 5.5;
      result.damage = 20;
      result.messageJa = '金属が帯電し周囲へ放電！';
    } else if (material === 'WaterSurface' || env.inWater || env.isRaining) {
      // Law 2: Water/Rain massively amplifies Electricity AoE!
      result.electrified = true;
      result.shockRadius = 12.0;
      result.damage = 20;
      result.messageJa = '水面の広域放電！';
    } else if (material === 'Organic') {
      result.electrified = true;
      result.shockRadius = 2.5;
      result.damage = 20;
    }
  } else if (element === 'Wind') {
    if (material === 'Grass' || material === 'Wood') {
      result.updraftCreated = true;
    }
  }

  return result;
}

/**
 * Pure Law 2 check: Element vs Element resolution.
 */
export function evaluateElementVsElement(incoming: ChemistryElement, existing: ChemistryElement): {
  cancelExisting: boolean;
  amplified: boolean;
  resultingElement: ChemistryElement | null;
} {
  if (incoming === 'Water' && existing === 'Fire') return { cancelExisting: true, amplified: false, resultingElement: null };
  if (incoming === 'Fire' && existing === 'Ice') return { cancelExisting: true, amplified: false, resultingElement: 'Water' };
  if (incoming === 'Ice' && existing === 'Water') return { cancelExisting: true, amplified: false, resultingElement: 'Ice' };
  if (incoming === 'Electricity' && existing === 'Water') return { cancelExisting: false, amplified: true, resultingElement: 'Electricity' };
  if (incoming === 'Wind' && existing === 'Fire') return { cancelExisting: false, amplified: true, resultingElement: 'Fire' };
  return { cancelExisting: false, amplified: false, resultingElement: incoming };
}

export interface PhysicsBody {
  id: string;
  labelJa: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  mass: number;
  radius: number;
  halfHeight: number;
  material: ChemistryMaterial;
  isStatic: boolean;
  isMinecart?: boolean;
  isMetalBox?: boolean;
  isRaft?: boolean;
  isCryonisPillar?: boolean;
  isBoulder?: boolean;
  isBurning: boolean;
  burnTimer: number;
  isElectrified: boolean;
  shockTimer: number;
  isFrozenStasis: boolean;
  stasisTimer: number;
  stasisHits: number;
  stasisAccumImpulse: THREE.Vector3;
  stasisArrowMesh?: THREE.Group;
  magnesisGrabbed: boolean;
  onMagnesisHighlight?: (state: number) => void;
  onStasisVisual?: (glow: number) => void;
  buoyant: boolean;
  grounded: boolean;
}

export interface FireUpdraftZone {
  id: string;
  position: THREE.Vector3;
  radius: number;
  height: number;
  remainingSec: number;
  mesh: THREE.Group;
}

export interface StaticCollider {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
}

/**
 * 32m Spatial Hash Grid for O(1) broad-phase collision, chemistry propagation, and AI queries.
 */
export class SpatialHashGrid<T extends { position: THREE.Vector3 }> {
  private cells = new Map<string, T[]>();
  private cellSize: number;

  constructor(cellSize = 32) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
  }

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  insert(item: T): void {
    const cx = Math.floor(item.position.x / this.cellSize);
    const cz = Math.floor(item.position.z / this.cellSize);
    const k = this.key(cx, cz);
    let arr = this.cells.get(k);
    if (!arr) {
      arr = [];
      this.cells.set(k, arr);
    }
    arr.push(item);
  }

  queryRadius(x: number, z: number, radius: number): T[] {
    const rCells = Math.ceil(radius / this.cellSize);
    const cx0 = Math.floor(x / this.cellSize);
    const cz0 = Math.floor(z / this.cellSize);
    const r2 = radius * radius;
    const out: T[] = [];
    for (let dz = -rCells; dz <= rCells; dz++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        const bucket = this.cells.get(this.key(cx0 + dx, cz0 + dz));
        if (!bucket) continue;
        for (const item of bucket) {
          const ddx = item.position.x - x;
          const ddz = item.position.z - z;
          if (ddx * ddx + ddz * ddz <= r2) out.push(item);
        }
      }
    }
    return out;
  }
}

/**
 * Dual Havok-style Rigid Body Physics + GDC 2017 Chemistry Engine.
 */
export class PhysicsChemistryEngine {
  public bodies: PhysicsBody[] = [];
  public fireZones: FireUpdraftZone[] = [];
  public staticColliders: StaticCollider[] = [];
  public readonly grid = new SpatialHashGrid<PhysicsBody>(32);
  public readonly effectsGroup = new THREE.Group();

  private normalTmp = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.effectsGroup.name = 'ChemistryEffects';
    scene.add(this.effectsGroup);
  }

  addBody(body: PhysicsBody): void {
    this.bodies.push(body);
  }

  removeBody(id: string): void {
    const idx = this.bodies.findIndex((b) => b.id === id);
    if (idx >= 0) {
      const b = this.bodies[idx];
      if (b.stasisArrowMesh) this.effectsGroup.remove(b.stasisArrowMesh);
      this.bodies.splice(idx, 1);
    }
  }

  addStaticCollider(col: StaticCollider): void {
    this.staticColliders.push(col);
  }

  /**
   * Triggers a simultaneous Physics Radial Impulse + Chemistry Fire/Heat Event (Explosion!).
   */
  triggerExplosion(
    origin: THREE.Vector3,
    radius: number,
    impulseStrength: number,
    isRaining: boolean,
    onImpactEntity?: (pos: THREE.Vector3, radius: number, impulse: number) => void
  ): void {
    // 1. Physics radial force impulse on nearby rigid bodies
    for (const b of this.bodies) {
      if (b.isStatic && !b.isCryonisPillar) continue;
      const dist = b.position.distanceTo(origin);
      if (dist > radius) continue;
      const dir = b.position.clone().sub(origin);
      if (dir.lengthSq() < 0.001) dir.set(0, 1, 0);
      dir.normalize();
      dir.y = Math.max(0.35, dir.y + 0.45);
      dir.normalize();
      const falloff = 1 - dist / radius;
      const dv = (impulseStrength * falloff) / Math.max(0.6, Math.sqrt(b.mass));
      if (b.isFrozenStasis) {
        this.applyStasisHit(b, dir.multiplyScalar(impulseStrength * falloff * 1.4));
      } else {
        b.velocity.addScaledVector(dir, dv);
        b.grounded = false;
      }
      // Chemistry Fire element propagation
      this.applyElementToBody(b, 'Fire', isRaining);
    }

    // 2. Chemistry Fire event ignites dry grass around blast -> spawns Fire + Paraglider Updraft!
    const groundY = getTerrainHeight(origin.x, origin.z);
    if (!isRaining && !isWaterAt(origin.x, origin.z) && Math.abs(origin.y - groundY) < 4.5) {
      this.spawnFireUpdraft(new THREE.Vector3(origin.x, groundY, origin.z), 4.6, 22.0, 26);
    }

    onImpactEntity?.(origin, radius, impulseStrength);
  }

  /**
   * Spawns a burning grass/wood patch with visible cel flames + rising updraft air ribbons
   * that lift Link when paragliding!
   */
  spawnFireUpdraft(pos: THREE.Vector3, radius = 4.5, height = 24.0, durationSec = 28): FireUpdraftZone {
    // Merge with existing nearby fire zone to prevent clutter
    for (const z of this.fireZones) {
      if (z.position.distanceTo(pos) < radius * 0.7) {
        z.remainingSec = Math.max(z.remainingSec, durationSec);
        z.radius = Math.min(8, z.radius + 0.6);
        return z;
      }
    }

    const grp = new THREE.Group();
    grp.position.copy(pos);

    // Scorched grass disc
    const scorch = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.78, 16),
      new THREE.MeshBasicMaterial({ color: '#241b16', transparent: true, opacity: 0.72, depthWrite: false })
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = 0.08;
    grp.add(scorch);

    // Stylized roaring cel flames
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const dist = i === 0 ? 0 : radius * 0.35;
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.45 + (i % 2) * 0.25, 1.8 + (i % 3) * 0.6, 6),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? '#ff6a14' : '#ffd230',
          transparent: true,
          opacity: 0.88,
        })
      );
      flame.position.set(Math.cos(a) * dist, 0.9, Math.sin(a) * dist);
      flame.userData.flamePhase = i * 1.1;
      grp.add(flame);
    }

    // Rising white BotW updraft wind ribbons!
    for (let i = 0; i < 4; i++) {
      const ribbon = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.52, 0.055, 5, 18, Math.PI * 1.15),
        new THREE.MeshBasicMaterial({ color: '#f0fbff', transparent: true, opacity: 0.55, depthWrite: false })
      );
      ribbon.rotation.x = Math.PI / 2;
      ribbon.position.y = 2.0 + i * 4.5;
      ribbon.userData.updraftRibbon = true;
      ribbon.userData.baseH = i * 4.5;
      grp.add(ribbon);
    }

    this.effectsGroup.add(grp);
    const zone: FireUpdraftZone = {
      id: `fire_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      position: pos.clone(),
      radius,
      height,
      remainingSec: durationSec,
      mesh: grp,
    };
    this.fireZones.push(zone);
    return zone;
  }

  /**
   * Checks if a world position is inside any active fire updraft column (lifts Paraglider!).
   */
  getUpdraftLiftAt(pos: THREE.Vector3): number {
    for (const z of this.fireZones) {
      const dx = pos.x - z.position.x;
      const dz = pos.z - z.position.z;
      const dy = pos.y - z.position.y;
      if (dx * dx + dz * dz <= (z.radius + 1.4) * (z.radius + 1.4) && dy >= -1 && dy <= z.height) {
        return 14.5; // Strong BotW thermal updraft lift!
      }
    }
    return 0;
  }

  isNearFire(pos: THREE.Vector3, maxDist = 7.5): boolean {
    for (const z of this.fireZones) {
      if (z.position.distanceTo(pos) <= maxDist) return true;
    }
    return false;
  }

  applyElementToBody(body: PhysicsBody, element: ChemistryElement, isRaining: boolean): ChemistryReactionResult {
    const inWater = isWaterAt(body.position.x, body.position.z) && body.position.y <= WORLD_BOUNDS.waterLevel + 0.5;
    const res = evaluateChemistryInteraction(element, body.material, { isRaining, inWater });
    if (res.ignited) {
      body.isBurning = true;
      body.burnTimer = 14;
    }
    if (res.extinguished) {
      body.isBurning = false;
      body.burnTimer = 0;
    }
    if (res.electrified) {
      body.isElectrified = true;
      body.shockTimer = 4.5;
      // Chain conduct to nearby Metal bodies
      if (res.shockRadius) {
        for (const other of this.bodies) {
          if (other.id !== body.id && other.material === 'Metal' && other.position.distanceTo(body.position) <= res.shockRadius) {
            other.isElectrified = true;
            other.shockTimer = 3.5;
          }
        }
      }
    }
    return res;
  }

  /**
   * Stasis kinetic hit accumulation implementing BotW's authentic Stasis Overflow behavior:
   * Hits 1..7 accumulate full momentum individually; hits 8+ merge into a clamped saturation vector!
   */
  applyStasisHit(body: PhysicsBody, impulseDirAndMag: THREE.Vector3): void {
    if (!body.isFrozenStasis) return;
    body.stasisHits += 1;
    if (body.stasisHits <= 7) {
      body.stasisAccumImpulse.add(impulseDirAndMag);
    } else {
      // Stasis Overflow: 8th+ hits merge into single directional impulse cap
      const dir = impulseDirAndMag.clone().normalize();
      const mag = Math.min(85, body.stasisAccumImpulse.length() + 4.5);
      body.stasisAccumImpulse.copy(dir.multiplyScalar(mag));
    }
    this.updateStasisArrow(body);
  }

  private updateStasisArrow(body: PhysicsBody): void {
    if (!body.stasisArrowMesh) {
      const grp = new THREE.Group();
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 1.8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffe629' })
      );
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = 0.9;
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, 0.85, 8),
        new THREE.MeshBasicMaterial({ color: '#ffe629' })
      );
      head.rotation.x = Math.PI / 2;
      head.position.z = 2.0;
      grp.add(shaft, head);
      this.effectsGroup.add(grp);
      body.stasisArrowMesh = grp;
    }
    const mag = body.stasisAccumImpulse.length();
    const arrow = body.stasisArrowMesh;
    arrow.visible = body.isFrozenStasis && mag > 0.1;
    arrow.position.copy(body.position).add(new THREE.Vector3(0, body.halfHeight + 0.6, 0));
    if (mag > 0.1) {
      const target = arrow.position.clone().add(body.stasisAccumImpulse);
      arrow.lookAt(target);
      const scaleLen = Math.min(2.6, 0.6 + body.stasisHits * 0.28);
      arrow.scale.set(1, 1, scaleLen);
      // Color shifts Yellow -> Orange -> Red with stored kinetic energy!
      const col = body.stasisHits >= 5 ? '#ff2c1a' : body.stasisHits >= 3 ? '#ff8e1a' : '#ffe629';
      arrow.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(col);
        }
      });
    }
  }

  /**
   * Determines whether Link is standing directly on a metal body (blocks Magnesis lift)
   * OR standing on a second intermediate rigid body stacked atop the metal body (enables Flying Machine!).
   */
  isPlayerStandingDirectlyOn(playerPos: THREE.Vector3, targetBody: PhysicsBody): boolean {
    const dx = playerPos.x - targetBody.position.x;
    const dz = playerPos.z - targetBody.position.z;
    const horiz = Math.hypot(dx, dz);
    const topY = targetBody.position.y + targetBody.halfHeight * 2;
    const verticalGap = Math.abs(playerPos.y - topY);
    if (horiz <= targetBody.radius + 0.55 && verticalGap < 0.7) {
      // Check if an intermediate body (e.g. second minecart or wooden crate) sits between player and target!
      for (const other of this.bodies) {
        if (other.id === targetBody.id) continue;
        const oh = Math.hypot(playerPos.x - other.position.x, playerPos.z - other.position.z);
        const otherTop = other.position.y + other.halfHeight * 2;
        if (oh <= other.radius + 0.5 && other.position.y > targetBody.position.y + 0.25 && Math.abs(playerPos.y - otherTop) < 0.65) {
          return false; // Intermediate body detected -> Flying Machine Magnesis lift ALLOWED!
        }
      }
      return true;
    }
    return false;
  }

  update(dt: number, timeSec: number, isRaining: boolean): void {
    const clampedDt = Math.min(dt, 0.05);
    this.grid.clear();

    for (const b of this.bodies) {
      this.grid.insert(b);

      // Stasis countdown & explosive kinetic launch release
      if (b.isFrozenStasis) {
        b.stasisTimer -= clampedDt;
        b.onStasisVisual?.(1.0);
        if (b.stasisTimer <= 0) {
          b.isFrozenStasis = false;
          b.onStasisVisual?.(0);
          if (b.stasisArrowMesh) b.stasisArrowMesh.visible = false;
          if (b.stasisAccumImpulse.lengthSq() > 0.05) {
            const launch = b.stasisAccumImpulse.clone().multiplyScalar(1.0 / Math.max(0.7, Math.sqrt(b.mass)));
            launch.y = Math.max(launch.y, 4.5);
            b.velocity.add(launch);
            b.grounded = false;
          }
          b.stasisHits = 0;
          b.stasisAccumImpulse.set(0, 0, 0);
        }
        continue;
      }

      if (b.isStatic || b.magnesisGrabbed) {
        b.mesh.position.copy(b.position);
        continue;
      }

      // Gravity & Water Buoyancy
      const inWater = isWaterAt(b.position.x, b.position.z) && b.position.y < WORLD_BOUNDS.waterLevel;
      if (inWater && b.buoyant) {
        const submerge = WORLD_BOUNDS.waterLevel - b.position.y;
        b.velocity.y += (submerge * 22.0 - b.velocity.y * 4.5) * clampedDt;
        b.velocity.x *= Math.pow(0.28, clampedDt);
        b.velocity.z *= Math.pow(0.28, clampedDt);
      } else {
        b.velocity.y -= 24.5 * clampedDt;
      }

      // Integrate velocity
      b.position.addScaledVector(b.velocity, clampedDt);

      // Terrain collision & slope rolling
      const groundY = getTerrainHeight(b.position.x, b.position.z);
      if (b.position.y <= groundY) {
        b.position.y = groundY;
        if (b.velocity.y < -3.5) {
          b.velocity.y = -b.velocity.y * 0.25;
        } else {
          b.velocity.y = 0;
          b.grounded = true;
        }
        // Friction & slope roll
        getTerrainNormal(b.position.x, b.position.z, this.normalTmp);
        if (this.normalTmp.y < 0.92 && b.isBoulder) {
          b.velocity.x += this.normalTmp.x * 16.0 * clampedDt;
          b.velocity.z += this.normalTmp.z * 16.0 * clampedDt;
        }
        const damp = b.isBoulder ? 0.65 : 0.08;
        b.velocity.x *= Math.pow(damp, clampedDt);
        b.velocity.z *= Math.pow(damp, clampedDt);
      } else {
        b.grounded = false;
      }

      // Simple body-body stacking / Flying Machine support
      for (const other of this.bodies) {
        if (other.id === b.id || other.isStatic) continue;
        const dx = b.position.x - other.position.x;
        const dz = b.position.z - other.position.z;
        const dist = Math.hypot(dx, dz);
        const minDist = (b.radius + other.radius) * 0.85;
        if (dist < minDist && dist > 0.001) {
          const otherTop = other.position.y + other.halfHeight * 2;
          if (b.position.y >= otherTop - 0.6 && b.velocity.y <= 0.5) {
            b.position.y = otherTop;
            b.velocity.y = Math.max(0, other.velocity.y);
            // Carry stacked body horizontally (enables Flying Machine 2-stack minecart!)
            b.position.x += other.velocity.x * clampedDt;
            b.position.z += other.velocity.z * clampedDt;
            b.grounded = true;
          }
        }
      }

      // Chemistry timers
      if (b.isBurning) {
        b.burnTimer -= clampedDt;
        if (isRaining || inWater || b.burnTimer <= 0) {
          b.isBurning = false;
          b.burnTimer = 0;
        }
      }
      if (b.isElectrified) {
        b.shockTimer -= clampedDt;
        if (b.shockTimer <= 0) b.isElectrified = false;
      }

      b.mesh.position.copy(b.position);
      if (b.isBoulder && b.velocity.lengthSq() > 0.1) {
        b.mesh.rotation.x += b.velocity.z * clampedDt * 0.4;
        b.mesh.rotation.z -= b.velocity.x * clampedDt * 0.4;
      }
    }

    // Animate Fire & Updraft Zones
    for (let i = this.fireZones.length - 1; i >= 0; i--) {
      const z = this.fireZones[i];
      z.remainingSec -= clampedDt * (isRaining ? 5.5 : 1.0);
      if (z.remainingSec <= 0) {
        this.effectsGroup.remove(z.mesh);
        this.fireZones.splice(i, 1);
        continue;
      }
      z.mesh.children.forEach((child) => {
        if (child.userData.flamePhase !== undefined) {
          const ph = child.userData.flamePhase as number;
          child.scale.y = 0.82 + 0.34 * Math.sin(timeSec * 14 + ph);
          child.rotation.y += clampedDt * 2.5;
        } else if (child.userData.updraftRibbon) {
          const baseH = child.userData.baseH as number;
          const h = ((baseH + timeSec * 8.5) % z.height) + 1.2;
          child.position.y = h;
          child.rotation.z += clampedDt * 3.8;
        }
      });
    }
  }
}
