import * as THREE from 'three';
import { getInteriorWaterLevelAt, getTerrainHeight, getTerrainNormal, isWaterAt } from '../world/TerrainGenerator';
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
  halfWidth?: number;
  halfDepth?: number;
  rotY?: number;
  halfHeight: number;
  material: ChemistryMaterial;
  isStatic: boolean;
  stasisInteractable?: boolean;
  isPlatform?: boolean;
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

export type StaticCollider =
  | {
      id: string;
      shape: 'cylinder';
      x: number;
      z: number;
      radius: number;
      minY: number;
      maxY: number;
      climbable?: boolean;
      walkableTop?: boolean;
    }
  | {
      id: string;
      shape: 'box';
      x: number;
      z: number;
      halfW: number;
      halfD: number;
      minY: number;
      maxY: number;
      rotY?: number;
      climbable?: boolean;
      walkableTop?: boolean;
    };

export interface CapsuleCollisionResult {
  collidedHorizontal: boolean;
  hitCeiling: boolean;
  hitClimbable: boolean;
  hitNormal: THREE.Vector3;
  supportY: number;
  wallTopY: number;
}

/**
 * Spatial Hash Grid supporting multi-cell footprint indexing for static architecture & foliage colliders.
 */
export class StaticColliderHashGrid {
  private cells = new Map<string, StaticCollider[]>();
  private all: StaticCollider[] = [];
  private cellSize: number;

  constructor(cellSize = 24) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
    this.all.length = 0;
  }

  get count(): number {
    return this.all.length;
  }

  private footprintHalfExtents(col: StaticCollider): { rx: number; rz: number } {
    if (col.shape === 'cylinder') {
      return { rx: col.radius, rz: col.radius };
    }
    const rot = col.rotY ?? 0;
    if (Math.abs(rot) < 1e-4) {
      return { rx: col.halfW, rz: col.halfD };
    }
    const c = Math.abs(Math.cos(rot));
    const s = Math.abs(Math.sin(rot));
    return {
      rx: c * col.halfW + s * col.halfD,
      rz: s * col.halfW + c * col.halfD,
    };
  }

  insert(col: StaticCollider): void {
    this.all.push(col);
    const { rx, rz } = this.footprintHalfExtents(col);
    const minCx = Math.floor((col.x - rx) / this.cellSize);
    const maxCx = Math.floor((col.x + rx) / this.cellSize);
    const minCz = Math.floor((col.z - rz) / this.cellSize);
    const maxCz = Math.floor((col.z + rz) / this.cellSize);
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = `${cx},${cz}`;
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        bucket.push(col);
      }
    }
  }

  queryAABB(minX: number, minZ: number, maxX: number, maxZ: number, out: Set<StaticCollider>): void {
    const minCx = Math.floor(minX / this.cellSize);
    const maxCx = Math.floor(maxX / this.cellSize);
    const minCz = Math.floor(minZ / this.cellSize);
    const maxCz = Math.floor(maxZ / this.cellSize);
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.cells.get(`${cx},${cz}`);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          out.add(bucket[i]);
        }
      }
    }
  }
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
 * Dual Havok-style Rigid Body Physics + Spatial-Hashed 3D Static Colliders + GDC 2017 Chemistry Engine.
 */
export class PhysicsChemistryEngine {
  public bodies: PhysicsBody[] = [];
  public fireZones: FireUpdraftZone[] = [];
  public staticColliders: StaticCollider[] = [];
  public propColliderCount = 0;
  public readonly staticGrid = new StaticColliderHashGrid(24);
  public readonly propGrid = new StaticColliderHashGrid(24);
  public readonly grid = new SpatialHashGrid<PhysicsBody>(32);
  public readonly effectsGroup = new THREE.Group();

  private normalTmp = new THREE.Vector3();
  private querySetTmp = new Set<StaticCollider>();
  private lastPropColliders: StaticCollider[] = [];
  private savedOverworld: {
    bodies: PhysicsBody[];
    staticColliders: StaticCollider[];
    propColliders: StaticCollider[];
    fireZones: FireUpdraftZone[];
  } | null = null;

  constructor(scene: THREE.Scene) {
    this.effectsGroup.name = 'ChemistryEffects';
    scene.add(this.effectsGroup);
  }

  enterInteriorContext(): void {
    if (this.savedOverworld) return;
    for (const f of this.fireZones) f.mesh.visible = false;
    for (const b of this.bodies) {
      if (b.stasisArrowMesh) b.stasisArrowMesh.visible = false;
    }
    this.savedOverworld = {
      bodies: this.bodies,
      staticColliders: this.staticColliders,
      propColliders: this.lastPropColliders,
      fireZones: this.fireZones,
    };
    this.bodies = [];
    this.staticColliders = [];
    this.lastPropColliders = [];
    this.propColliderCount = 0;
    this.fireZones = [];
    this.staticGrid.clear();
    this.propGrid.clear();
    this.grid.clear();
  }

  exitInteriorContext(): void {
    if (!this.savedOverworld) return;
    for (const f of this.fireZones) this.effectsGroup.remove(f.mesh);
    for (const b of this.bodies) {
      if (b.stasisArrowMesh) this.effectsGroup.remove(b.stasisArrowMesh);
    }
    this.bodies = this.savedOverworld.bodies;
    this.staticColliders = this.savedOverworld.staticColliders;
    this.lastPropColliders = this.savedOverworld.propColliders;
    this.fireZones = this.savedOverworld.fireZones;
    this.savedOverworld = null;

    for (const f of this.fireZones) f.mesh.visible = true;
    this.staticGrid.clear();
    for (const c of this.staticColliders) this.staticGrid.insert(c);
    this.propGrid.clear();
    this.propColliderCount = this.lastPropColliders.length;
    for (const c of this.lastPropColliders) this.propGrid.insert(c);
    this.grid.clear();
    for (const b of this.bodies) this.grid.insert(b);
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
    this.staticGrid.insert(col);
  }

  addBoxCollider(
    id: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    minY: number,
    maxY: number,
    opts: { rotY?: number; climbable?: boolean; walkableTop?: boolean } = {}
  ): void {
    this.addStaticCollider({
      id,
      shape: 'box',
      x,
      z,
      halfW: width * 0.5,
      halfD: depth * 0.5,
      minY,
      maxY,
      rotY: opts.rotY ?? 0,
      climbable: opts.climbable ?? true,
      walkableTop: opts.walkableTop ?? true,
    });
  }

  addCylinderCollider(
    id: string,
    x: number,
    z: number,
    radius: number,
    minY: number,
    maxY: number,
    opts: { climbable?: boolean; walkableTop?: boolean } = {}
  ): void {
    this.addStaticCollider({
      id,
      shape: 'cylinder',
      x,
      z,
      radius,
      minY,
      maxY,
      climbable: opts.climbable ?? true,
      walkableTop: opts.walkableTop ?? true,
    });
  }

  removeCollider(id: string): boolean {
    const idx = this.staticColliders.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    this.staticColliders.splice(idx, 1);
    this.staticGrid.clear();
    for (const c of this.staticColliders) {
      this.staticGrid.insert(c);
    }
    return true;
  }

  /**
   * Replaces dynamic foliage/tree/rock static colliders streamed around the player.
   */
  setTerrainPropColliders(colliders: StaticCollider[]): void {
    this.lastPropColliders = colliders;
    this.propGrid.clear();
    this.propColliderCount = colliders.length;
    for (let i = 0; i < colliders.length; i++) {
      this.propGrid.insert(colliders[i]);
    }
  }

  /**
   * Resolves a vertical character capsule against ALL nearby architecture, rocks, trees,
   * and solid dynamic physics props using O(1) spatial hash lookups.
   * Prevents tunneling/clipping, computes walkable plinth/roof supportY, and reports climbable wall normals.
   */
  resolveCapsuleCollision(
    pos: THREE.Vector3,
    radius: number,
    height: number,
    stepHeight = 0.52
  ): CapsuleCollisionResult {
    const res: CapsuleCollisionResult = {
      collidedHorizontal: false,
      hitCeiling: false,
      hitClimbable: false,
      hitNormal: new THREE.Vector3(),
      supportY: -Infinity,
      wallTopY: -Infinity,
    };

    const candidates = this.querySetTmp;
    candidates.clear();
    const pad = radius + 0.35;
    this.staticGrid.queryAABB(pos.x - pad, pos.z - pad, pos.x + pad, pos.z + pad, candidates);
    this.propGrid.queryAABB(pos.x - pad, pos.z - pad, pos.x + pad, pos.z + pad, candidates);

    // Run 2 relaxation passes to cleanly resolve corners between two perpendicular walls!
    for (let pass = 0; pass < 2; pass++) {
      for (const col of candidates) {
        const feetY = pos.y;
        const headY = pos.y + height;

        if (col.shape === 'cylinder') {
          const dx = pos.x - col.x;
          const dz = pos.z - col.z;
          const distSq = dx * dx + dz * dz;
          const combinedR = col.radius + radius;
          if (distSq >= combinedR * combinedR) continue;

          // Walkable top support (ledges, pedestals, stumps, boulders)
          if (col.walkableTop !== false && feetY >= col.maxY - stepHeight && feetY <= col.maxY + 0.42) {
            if (distSq <= (col.radius + radius * 0.72) * (col.radius + radius * 0.72)) {
              if (col.maxY > res.supportY) res.supportY = col.maxY;
            }
            continue;
          }

          // Vertical overlap check
          if (feetY >= col.maxY - 0.05 || headY <= col.minY + 0.05) continue;

          // Ceiling hit check (if feet well below minY)
          if (feetY < col.minY - 0.15 && headY > col.minY) {
            pos.y = col.minY - height;
            res.hitCeiling = true;
            continue;
          }

          const dist = Math.sqrt(distSq);
          const nx = dist > 1e-5 ? dx / dist : 1;
          const nz = dist > 1e-5 ? dz / dist : 0;
          const pen = combinedR - dist;
          pos.x += nx * pen;
          pos.z += nz * pen;
          res.collidedHorizontal = true;
          res.hitNormal.set(nx, 0, nz);
          if (col.climbable !== false && col.maxY - feetY > 0.85) {
            res.hitClimbable = true;
            res.wallTopY = Math.max(res.wallTopY, col.maxY);
          }
        } else {
          // Box / OBB in XZ plane
          const relX = pos.x - col.x;
          const relZ = pos.z - col.z;
          const rot = col.rotY ?? 0;
          const cosR = Math.cos(rot);
          const sinR = Math.sin(rot);
          // Transform world offset into box local space (inverse Y rotation)
          const lx = relX * cosR - relZ * sinR;
          const lz = relX * sinR + relZ * cosR;

          const clx = Math.max(-col.halfW, Math.min(col.halfW, lx));
          const clz = Math.max(-col.halfD, Math.min(col.halfD, lz));
          const dlx = lx - clx;
          const dlz = lz - clz;
          const distSq = dlx * dlx + dlz * dlz;
          if (distSq >= radius * radius) continue;

          // Walkable top support (plinths, castle bridges, flat roofs, stairs)
          if (col.walkableTop !== false && feetY >= col.maxY - stepHeight && feetY <= col.maxY + 0.42) {
            if (Math.abs(lx) <= col.halfW + radius * 0.65 && Math.abs(lz) <= col.halfD + radius * 0.65) {
              if (col.maxY > res.supportY) res.supportY = col.maxY;
            }
            continue;
          }

          if (feetY >= col.maxY - 0.05 || headY <= col.minY + 0.05) continue;

          if (feetY < col.minY - 0.15 && headY > col.minY) {
            pos.y = col.minY - height;
            res.hitCeiling = true;
            continue;
          }

          let lnx = 0;
          let lnz = 0;
          let pen = 0;
          if (distSq > 1e-8) {
            const dist = Math.sqrt(distSq);
            lnx = dlx / dist;
            lnz = dlz / dist;
            pen = radius - dist;
          } else {
            // Center penetrated inside box -> eject through nearest face
            const penX = col.halfW - Math.abs(lx) + radius;
            const penZ = col.halfD - Math.abs(lz) + radius;
            if (penX < penZ) {
              lnx = lx >= 0 ? 1 : -1;
              pen = penX;
            } else {
              lnz = lz >= 0 ? 1 : -1;
              pen = penZ;
            }
          }

          // Transform local normal back to world XZ
          const wnx = lnx * cosR + lnz * sinR;
          const wnz = -lnx * sinR + lnz * cosR;
          pos.x += wnx * pen;
          pos.z += wnz * pen;
          res.collidedHorizontal = true;
          res.hitNormal.set(wnx, 0, wnz);
          if (col.climbable !== false && col.maxY - feetY > 0.85) {
            res.hitClimbable = true;
            res.wallTopY = Math.max(res.wallTopY, col.maxY);
          }
        }
      }
    }

    // Also resolve solid horizontal collision & walkable top against dynamic PhysicsBodies (boulders, crates, Cryonis pillars, Magnesis bridges/platforms)
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.magnesisGrabbed) continue;
      const topY = b.position.y + b.halfHeight * 2;
      const minY = b.position.y;
      const feetY = pos.y;
      const headY = pos.y + height;

      if (b.halfWidth && b.halfDepth) {
        const relX = pos.x - b.position.x;
        const relZ = pos.z - b.position.z;
        const rot = b.rotY ?? b.mesh.rotation.y ?? 0;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const lx = relX * cosR - relZ * sinR;
        const lz = relX * sinR + relZ * cosR;

        const clx = Math.max(-b.halfWidth, Math.min(b.halfWidth, lx));
        const clz = Math.max(-b.halfDepth, Math.min(b.halfDepth, lz));
        const dlx = lx - clx;
        const dlz = lz - clz;
        const distSq = dlx * dlx + dlz * dlz;
        if (distSq >= radius * radius) continue;

        if (feetY >= topY - stepHeight && feetY <= topY + 0.52) {
          if (Math.abs(lx) <= b.halfWidth + radius * 0.65 && Math.abs(lz) <= b.halfDepth + radius * 0.65) {
            if (topY > res.supportY) res.supportY = topY;
          }
          continue;
        }
        if (feetY >= topY - 0.04 || headY <= minY + 0.04) continue;
        if (feetY < minY - 0.14 && headY > minY) {
          pos.y = minY - height;
          res.hitCeiling = true;
          continue;
        }

        let lnx = 0;
        let lnz = 0;
        let pen = 0;
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          lnx = dlx / dist;
          lnz = dlz / dist;
          pen = radius - dist;
        } else {
          const penX = b.halfWidth - Math.abs(lx) + radius;
          const penZ = b.halfDepth - Math.abs(lz) + radius;
          if (penX < penZ) {
            lnx = lx >= 0 ? 1 : -1;
            pen = penX;
          } else {
            lnz = lz >= 0 ? 1 : -1;
            pen = penZ;
          }
        }
        const wnx = lnx * cosR + lnz * sinR;
        const wnz = -lnx * sinR + lnz * cosR;
        pos.x += wnx * pen;
        pos.z += wnz * pen;
        res.collidedHorizontal = true;
        res.hitNormal.set(wnx, 0, wnz);
        if (b.isCryonisPillar && topY - pos.y > 0.85) {
          res.hitClimbable = true;
          res.wallTopY = Math.max(res.wallTopY, topY);
        }
        continue;
      }

      const dx = pos.x - b.position.x;
      const dz = pos.z - b.position.z;
      const combinedR = b.radius + radius;
      const distSq = dx * dx + dz * dz;
      if (distSq >= combinedR * combinedR) continue;
      if (feetY >= topY - stepHeight && feetY <= topY + 0.45) {
        if (topY > res.supportY) res.supportY = topY;
        continue;
      }
      if (feetY < topY - stepHeight && headY > minY + 0.08) {
        const dist = Math.sqrt(distSq);
        const nx = dist > 1e-5 ? dx / dist : 1;
        const nz = dist > 1e-5 ? dz / dist : 0;
        const pen = combinedR - dist;
        pos.x += nx * pen;
        pos.z += nz * pen;
        res.collidedHorizontal = true;
        res.hitNormal.set(nx, 0, nz);
        if (b.isCryonisPillar && topY - pos.y > 0.85) {
          res.hitClimbable = true;
          res.wallTopY = Math.max(res.wallTopY, topY);
        }
      }
    }

    return res;
  }

  /**
   * Keeps third-person camera outside solid building walls by marching from target toward desired camera position.
   */
  clampCameraPosition(target: THREE.Vector3, desired: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
    out.copy(desired);
    const minX = Math.min(target.x, desired.x) - 0.6;
    const maxX = Math.max(target.x, desired.x) + 0.6;
    const minZ = Math.min(target.z, desired.z) - 0.6;
    const maxZ = Math.max(target.z, desired.z) + 0.6;
    const candidates = this.querySetTmp;
    candidates.clear();
    this.staticGrid.queryAABB(minX, minZ, maxX, maxZ, candidates);
    if (candidates.size === 0) return out;

    const steps = 10;
    const probe = new THREE.Vector3();
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      probe.lerpVectors(target, desired, t);
      let blocked = false;
      for (const col of candidates) {
        if (probe.y < col.minY + 0.15 || probe.y > col.maxY - 0.15) continue;
        if (col.shape === 'cylinder') {
          const d2 = (probe.x - col.x) ** 2 + (probe.z - col.z) ** 2;
          if (d2 < (col.radius + 0.35) ** 2) {
            blocked = true;
            break;
          }
        } else {
          const rx = probe.x - col.x;
          const rz = probe.z - col.z;
          const rot = col.rotY ?? 0;
          const c = Math.cos(rot);
          const si = Math.sin(rot);
          const lx = rx * c - rz * si;
          const lz = rx * si + rz * c;
          if (Math.abs(lx) < col.halfW + 0.35 && Math.abs(lz) < col.halfD + 0.35) {
            blocked = true;
            break;
          }
        }
      }
      if (blocked) {
        const safeT = Math.max(0.22, (s - 1) / steps);
        out.lerpVectors(target, desired, safeT);
        return out;
      }
    }
    return out;
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
    const wl = getInteriorWaterLevelAt(body.position.x, body.position.z) ?? WORLD_BOUNDS.waterLevel;
    const inWater = isWaterAt(body.position.x, body.position.z) && body.position.y <= wl + 0.5;
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
    const topY = targetBody.position.y + targetBody.halfHeight * 2;
    const verticalGap = Math.abs(playerPos.y - topY);
    let insideHoriz = false;
    if (targetBody.halfWidth && targetBody.halfDepth) {
      const rot = targetBody.rotY ?? targetBody.mesh.rotation.y ?? 0;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const lx = dx * cosR - dz * sinR;
      const lz = dx * sinR + dz * cosR;
      insideHoriz = Math.abs(lx) <= targetBody.halfWidth + 0.55 && Math.abs(lz) <= targetBody.halfDepth + 0.55;
    } else {
      insideHoriz = Math.hypot(dx, dz) <= targetBody.radius + 0.55;
    }
    if (insideHoriz && verticalGap < 0.7) {
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

      // Gravity & Water Buoyancy (supports shrine interior pools!)
      const wl = getInteriorWaterLevelAt(b.position.x, b.position.z) ?? WORLD_BOUNDS.waterLevel;
      const inWater = isWaterAt(b.position.x, b.position.z) && b.position.y < wl;
      if (inWater && b.buoyant) {
        const submerge = wl - b.position.y;
        b.velocity.y += (submerge * 22.0 - b.velocity.y * 4.5) * clampedDt;
        b.velocity.x *= Math.pow(0.28, clampedDt);
        b.velocity.z *= Math.pow(0.28, clampedDt);
      } else {
        b.velocity.y -= 24.5 * clampedDt;
      }

      // Integrate velocity
      b.position.addScaledVector(b.velocity, clampedDt);

      // Keep rolling boulders & metal boxes outside solid static walls/pilasters
      if (b.isBoulder || b.isMetalBox) {
        const staticHits = this.querySetTmp;
        staticHits.clear();
        const pad = b.radius + 0.35;
        this.staticGrid.queryAABB(b.position.x - pad, b.position.z - pad, b.position.x + pad, b.position.z + pad, staticHits);
        for (const col of staticHits) {
          if (b.position.y >= col.maxY - 0.1 || b.position.y + b.halfHeight * 2 <= col.minY + 0.1) continue;
          if (col.shape === 'box' && (col.rotY ?? 0) === 0) {
            const clx = Math.max(col.x - col.halfW, Math.min(col.x + col.halfW, b.position.x));
            const clz = Math.max(col.z - col.halfD, Math.min(col.z + col.halfD, b.position.z));
            const dx = b.position.x - clx;
            const dz = b.position.z - clz;
            const d2 = dx * dx + dz * dz;
            if (d2 < b.radius * b.radius && d2 > 1e-6) {
              const d = Math.sqrt(d2);
              const nx = dx / d;
              const nz = dz / d;
              b.position.x += nx * (b.radius - d);
              b.position.z += nz * (b.radius - d);
              const vn = b.velocity.x * nx + b.velocity.z * nz;
              if (vn < 0) {
                b.velocity.x -= 1.35 * vn * nx;
                b.velocity.z -= 1.35 * vn * nz;
              }
            }
          }
        }
      }

      // Terrain collision & slope rolling (9-point footprint max height for bridges/platforms spanning chasms!)
      const groundY =
        b.isPlatform && b.halfWidth && b.halfDepth
          ? computePlatformSupportGroundY(
              b.position.x,
              b.position.z,
              b.halfWidth,
              b.halfDepth,
              b.rotY ?? b.mesh.rotation.y ?? 0
            )
          : getTerrainHeight(b.position.x, b.position.z);
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

/**
 * Computes maximum supporting terrain height across 9 rotated footprint points
 * (center, 4 corners, 4 edge midpoints) so Magnesis bridges spanning chasms rest firmly on both ledges.
 */
export function computePlatformSupportGroundY(
  cx: number,
  cz: number,
  halfWidth: number,
  halfDepth: number,
  rotY = 0,
  sampleHeight: (x: number, z: number) => number = getTerrainHeight
): number {
  const cosR = Math.cos(rotY);
  const sinR = Math.sin(rotY);
  let maxY = -Infinity;
  const offsets: Array<[number, number]> = [
    [0, 0],
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [-halfWidth, halfDepth],
    [halfWidth, halfDepth],
    [0, -halfDepth],
    [0, halfDepth],
    [-halfWidth, 0],
    [halfWidth, 0],
  ];
  for (let i = 0; i < offsets.length; i++) {
    const lx = offsets[i][0];
    const lz = offsets[i][1];
    const wx = cx + lx * cosR + lz * sinR;
    const wz = cz - lx * sinR + lz * cosR;
    const h = sampleHeight(wx, wz);
    if (h > maxY) maxY = h;
  }
  return maxY;
}

