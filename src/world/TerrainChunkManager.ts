import * as THREE from 'three';
import {
  createBotWGrassMaterial,
  createBotWTerrainMaterial,
  createBotWToonMaterial,
  createBotWWaterMaterial,
} from '../rendering/BotWToonShader';
import { textureBank } from '../rendering/ProceduralTextures';
import { PHYSICAL_SHRINES, WORLD_BOUNDS } from '../data/regions';
import { getRegionAt, getTerrainHeight, getTerrainNormal, sampleBiomeAt } from './TerrainGenerator';
import type { PhysicsChemistryEngine, StaticCollider } from '../physics/PhysicsChemistryEngine';
import type { GraphicsQuality } from '../types/botw';

interface TerrainChunk {
  key: string;
  cx: number;
  cz: number;
  lod: 'high' | 'mid';
  mesh: THREE.Mesh;
}

const CHUNK_SIZE = 160;
const HIGH_LOD_SEGS = 64; // ~2.5m/vertex crisp ridges & cliffs
const MID_LOD_SEGS = 32;  // ~5.0m/vertex seamless mid-ground
const SKIRT_DEPTH = 6.0;  // 6m downward skirt eliminates all LOD T-junction gaps!

/**
 * Chunk-based LOD Terrain Streaming Manager + Permanent Distant Hyrule Panorama (zero Z-fighting cutout) +
 * Wind-Swaying Instanced Grass Blades + Instanced Biome Trees & Rocks with spatial-hashed 3D colliders.
 */
export class TerrainChunkManager {
  public readonly group = new THREE.Group();
  private chunks = new Map<string, TerrainChunk>();
  private terrainMat: THREE.ShaderMaterial;
  private farTerrainMat: THREE.ShaderMaterial;
  private farMesh: THREE.Mesh;
  private physics: PhysicsChemistryEngine | null = null;
  private lastCenterCx = Number.NaN;
  private lastCenterCz = Number.NaN;

  // Dynamic wind-swaying grass around player
  private grassMesh: THREE.InstancedMesh;
  private maxGrassCount = 7200;
  private activeGrassCap = 7200;
  private lastGrassCenter = new THREE.Vector2(1e9, 1e9);

  // Instanced biome trees & rocks around player
  private treeTrunkMesh: THREE.InstancedMesh;
  private treeCanopyMesh: THREE.InstancedMesh;
  private rockMesh: THREE.InstancedMesh;
  private lastPropCenter = new THREE.Vector2(1e9, 1e9);

  constructor(physics?: PhysicsChemistryEngine) {
    this.physics = physics ?? null;
    this.group.name = 'HyruleTerrainSystem';

    const grassSet = textureBank.getGrassTexture();
    const cliffSet = textureBank.getCliffTexture();
    const terrainTextures = {
      grassMap: grassSet.map,
      grassNormalMap: grassSet.normalMap,
      cliffMap: cliffSet.map,
      cliffNormalMap: cliffSet.normalMap,
      sandMap: textureBank.getSandTexture().map,
      snowMap: textureBank.getSnowTexture().map,
      volcanicMap: textureBank.getVolcanicTexture().map,
    };

    this.terrainMat = createBotWTerrainMaterial(terrainTextures, { isFarPanorama: false });
    this.farTerrainMat = createBotWTerrainMaterial(terrainTextures, { isFarPanorama: true });

    // 1. Permanent Full-Hyrule Far Panorama Mesh (sunk -4.5m AND fragment-discarded inside active chunk bounds -> ZERO Z-fighting!)
    this.farMesh = this.buildRegionMesh(0, 0, 3400, 2800, 112, -4.5, false, this.farTerrainMat);
    this.farMesh.name = 'HyruleFarPanorama';
    this.group.add(this.farMesh);

    // 2. Shimmering Cel-Shaded Water Plane with baked shoreline depth attribute for shallow turquoise gradient & foam!
    const waterGeo = new THREE.PlaneGeometry(3400, 2800, 128, 128);
    waterGeo.rotateX(-Math.PI / 2);
    const wPos = waterGeo.attributes.position;
    const waterDepths = new Float32Array(wPos.count);
    for (let i = 0; i < wPos.count; i++) {
      const wx = wPos.getX(i);
      const wz = wPos.getZ(i);
      const gy = getTerrainHeight(wx, wz);
      waterDepths[i] = Math.max(0, WORLD_BOUNDS.waterLevel - gy);
    }
    waterGeo.setAttribute('aWaterDepth', new THREE.BufferAttribute(waterDepths, 1));
    const waterMesh = new THREE.Mesh(waterGeo, createBotWWaterMaterial());
    waterMesh.position.y = WORLD_BOUNDS.waterLevel;
    waterMesh.name = 'HyruleWaterSurface';
    this.group.add(waterMesh);

    // 3. Eldin Glowing Lava Pool around Death Mountain Crater & Goron City
    const lavaGeo = new THREE.CircleGeometry(210, 36);
    lavaGeo.rotateX(-Math.PI / 2);
    const lavaMat = createBotWToonMaterial({
      color: '#ff4a14',
      emissive: '#ff3b08',
      emissiveIntensity: 1.55,
      map: textureBank.getVolcanicTexture().map,
    });
    const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
    lavaMesh.position.set(520, 62, -830);
    this.group.add(lavaMesh);

    // 4. Instanced Wind-Swaying Multi-Blade Grass Tuft Geometry
    const grassGeo = this.createGrassTuftGeometry();
    const grassMat = createBotWGrassMaterial();
    this.grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, this.maxGrassCount);
    this.grassMesh.frustumCulled = false;
    this.grassMesh.name = 'WindSwayingGrass';
    this.group.add(this.grassMesh);

    // 5. Instanced Stylized Sculpted Trees & Faceted Rocks
    const barkTex = textureBank.getFoliageBarkTexture();
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.56, 4.8, 9);
    trunkGeo.translate(0, 2.4, 0);
    const trunkMat = createBotWToonMaterial({
      color: '#9c7352',
      map: barkTex.map,
      normalMap: barkTex.normalMap,
      rimStrength: 0.30,
    });
    this.treeTrunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, 260);
    this.treeTrunkMesh.castShadow = true;
    this.treeTrunkMesh.receiveShadow = true;
    this.treeTrunkMesh.frustumCulled = false;
    this.group.add(this.treeTrunkMesh);

    const canopyGeo = this.createStylizedCanopyGeometry();
    const canopyMat = createBotWToonMaterial({
      color: '#ffffff',
      map: grassSet.map,
      rimStrength: 0.48,
      rimTint: '#f2ffd0',
    });
    this.treeCanopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, 260);
    this.treeCanopyMesh.castShadow = true;
    this.treeCanopyMesh.receiveShadow = true;
    this.treeCanopyMesh.frustumCulled = false;
    this.group.add(this.treeCanopyMesh);

    const rockGeo = new THREE.DodecahedronGeometry(1.4, 1);
    const rockMat = createBotWToonMaterial({
      color: '#a8a094',
      map: cliffSet.map,
      normalMap: cliffSet.normalMap,
      rimStrength: 0.30,
    });
    this.rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, 220);
    this.rockMesh.castShadow = true;
    this.rockMesh.receiveShadow = true;
    this.rockMesh.frustumCulled = false;
    this.group.add(this.rockMesh);
  }

  public setPhysics(physics: PhysicsChemistryEngine): void {
    this.physics = physics;
    // Trigger collider registration on next update
    this.lastPropCenter.set(1e9, 1e9);
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.activeGrassCap = quality === 'high' ? 7200 : quality === 'medium' ? 4200 : 2000;
    this.lastGrassCenter.set(1e9, 1e9);
  }

  public getChunkDiagnostics(): {
    activeChunks: number;
    highLodSegs: number;
    midLodSegs: number;
    skirtDepth: number;
    farExcludeBounds: [number, number, number, number];
  } {
    const b = this.farTerrainMat.uniforms.uExcludeBounds.value as THREE.Vector4;
    return {
      activeChunks: this.chunks.size,
      highLodSegs: HIGH_LOD_SEGS,
      midLodSegs: MID_LOD_SEGS,
      skirtDepth: SKIRT_DEPTH,
      farExcludeBounds: [b.x, b.y, b.z, b.w],
    };
  }

  private createGrassTuftGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const indices: number[] = [];
    let vOff = 0;
    const angles = [0, 2.09, 4.19];
    for (const a of angles) {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const w0 = 0.15;
      const w1 = 0.08;
      const h1 = 0.44;
      const h2 = 0.88;
      const lean = 0.16;

      positions.push(
        -w0 * ca, 0, -w0 * sa,
        w0 * ca, 0, w0 * sa,
        -w1 * ca + lean * sa, h1, -w1 * sa - lean * ca,
        w1 * ca + lean * sa, h1, w1 * sa - lean * ca,
        lean * 2.1 * sa, h2, -lean * 2.1 * ca
      );
      indices.push(
        vOff, vOff + 1, vOff + 2,
        vOff + 1, vOff + 3, vOff + 2,
        vOff + 2, vOff + 3, vOff + 4
      );
      vOff += 5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private createStylizedCanopyGeometry(): THREE.BufferGeometry {
    const geo = new THREE.SphereGeometry(2.85, 18, 14);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const puff = 1.0 + 0.14 * Math.sin(x * 1.45 + 0.4) * Math.cos(z * 1.45) + 0.08 * Math.sin(y * 1.9);
      pos.setXYZ(i, x * puff * 1.12, y * puff * 0.82 + 5.75, z * puff * 1.12);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Builds a terrain grid mesh with exact analytic normals and optional 6m downward skirts along all 4 edges
   * so LOD transitions (64x64 <-> 32x32 <-> far panorama) never show a single hairline crack or T-junction!
   */
  private buildRegionMesh(
    centerX: number,
    centerZ: number,
    width: number,
    depth: number,
    segs: number,
    yOffset = 0,
    addSkirt = true,
    material: THREE.ShaderMaterial = this.terrainMat
  ): THREE.Mesh {
    const gridVerts = (segs + 1) * (segs + 1);
    const skirtEdgeVerts = addSkirt ? (segs + 1) * 4 : 0;
    const totalVerts = gridVerts + skirtEdgeVerts;

    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const biomeWeights = new Float32Array(totalVerts * 4);
    const biomeColors = new Float32Array(totalVerts * 3);
    const nVec = new THREE.Vector3();

    const halfW = width * 0.5;
    const halfD = depth * 0.5;
    const stride = segs + 1;

    // 1. Main surface vertex grid
    for (let r = 0; r <= segs; r++) {
      const tz = r / segs;
      const lz = -halfD + tz * depth;
      const wz = centerZ + lz;
      for (let c = 0; c <= segs; c++) {
        const tx = c / segs;
        const lx = -halfW + tx * width;
        const wx = centerX + lx;
        const wy = getTerrainHeight(wx, wz) + yOffset;
        const i = r * stride + c;

        positions[i * 3] = lx;
        positions[i * 3 + 1] = wy;
        positions[i * 3 + 2] = lz;

        getTerrainNormal(wx, wz, nVec);
        normals[i * 3] = nVec.x;
        normals[i * 3 + 1] = nVec.y;
        normals[i * 3 + 2] = nVec.z;

        const b = sampleBiomeAt(wx, wz, wy);
        biomeWeights[i * 4] = b.snow;
        biomeWeights[i * 4 + 1] = b.sand;
        biomeWeights[i * 4 + 2] = b.volcanic;
        biomeWeights[i * 4 + 3] = b.path;

        biomeColors[i * 3] = b.color.r;
        biomeColors[i * 3 + 1] = b.color.g;
        biomeColors[i * 3 + 2] = b.color.b;
      }
    }

    // Main surface triangle indices (CCW looking from +Y down)
    const gridIndicesCount = segs * segs * 6;
    const skirtIndicesCount = addSkirt ? segs * 4 * 6 : 0;
    const indices = new Uint32Array(gridIndicesCount + skirtIndicesCount);
    let idx = 0;
    for (let r = 0; r < segs; r++) {
      for (let c = 0; c < segs; c++) {
        const a = r * stride + c;
        const b = a + 1;
        const d = (r + 1) * stride + c;
        const e = d + 1;
        indices[idx++] = a;
        indices[idx++] = d;
        indices[idx++] = b;
        indices[idx++] = b;
        indices[idx++] = d;
        indices[idx++] = e;
      }
    }

    // 2. Append 6m downward skirts along North, South, West, East borders (outward-facing winding!)
    if (addSkirt) {
      let nextVert = gridVerts;
      const copySkirtVert = (srcIdx: number): number => {
        const dst = nextVert++;
        positions[dst * 3] = positions[srcIdx * 3];
        positions[dst * 3 + 1] = positions[srcIdx * 3 + 1] - SKIRT_DEPTH;
        positions[dst * 3 + 2] = positions[srcIdx * 3 + 2];

        normals[dst * 3] = normals[srcIdx * 3];
        normals[dst * 3 + 1] = normals[srcIdx * 3 + 1];
        normals[dst * 3 + 2] = normals[srcIdx * 3 + 2];

        biomeWeights[dst * 4] = biomeWeights[srcIdx * 4];
        biomeWeights[dst * 4 + 1] = biomeWeights[srcIdx * 4 + 1];
        biomeWeights[dst * 4 + 2] = biomeWeights[srcIdx * 4 + 2];
        biomeWeights[dst * 4 + 3] = biomeWeights[srcIdx * 4 + 3];

        biomeColors[dst * 3] = biomeColors[srcIdx * 3];
        biomeColors[dst * 3 + 1] = biomeColors[srcIdx * 3 + 1];
        biomeColors[dst * 3 + 2] = biomeColors[srcIdx * 3 + 2];
        return dst;
      };

      // North edge (r = 0, c = 0..segs, outward normal -Z)
      const northBotStart = nextVert;
      for (let c = 0; c <= segs; c++) copySkirtVert(c);
      for (let c = 0; c < segs; c++) {
        const t0 = c;
        const t1 = c + 1;
        const b0 = northBotStart + c;
        const b1 = northBotStart + c + 1;
        indices[idx++] = t0;
        indices[idx++] = t1;
        indices[idx++] = b0;
        indices[idx++] = t1;
        indices[idx++] = b1;
        indices[idx++] = b0;
      }

      // South edge (r = segs, c = 0..segs, outward normal +Z)
      const southBotStart = nextVert;
      const southRow = segs * stride;
      for (let c = 0; c <= segs; c++) copySkirtVert(southRow + c);
      for (let c = 0; c < segs; c++) {
        const t0 = southRow + c;
        const t1 = southRow + c + 1;
        const b0 = southBotStart + c;
        const b1 = southBotStart + c + 1;
        indices[idx++] = t0;
        indices[idx++] = b0;
        indices[idx++] = t1;
        indices[idx++] = t1;
        indices[idx++] = b0;
        indices[idx++] = b1;
      }

      // West edge (c = 0, r = 0..segs, outward normal -X)
      const westBotStart = nextVert;
      for (let r = 0; r <= segs; r++) copySkirtVert(r * stride);
      for (let r = 0; r < segs; r++) {
        const t0 = r * stride;
        const t1 = (r + 1) * stride;
        const b0 = westBotStart + r;
        const b1 = westBotStart + r + 1;
        indices[idx++] = t0;
        indices[idx++] = b0;
        indices[idx++] = t1;
        indices[idx++] = t1;
        indices[idx++] = b0;
        indices[idx++] = b1;
      }

      // East edge (c = segs, r = 0..segs, outward normal +X)
      const eastBotStart = nextVert;
      for (let r = 0; r <= segs; r++) copySkirtVert(r * stride + segs);
      for (let r = 0; r < segs; r++) {
        const t0 = r * stride + segs;
        const t1 = (r + 1) * stride + segs;
        const b0 = eastBotStart + r;
        const b1 = eastBotStart + r + 1;
        indices[idx++] = t0;
        indices[idx++] = t1;
        indices[idx++] = b0;
        indices[idx++] = t1;
        indices[idx++] = b1;
        indices[idx++] = b0;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('aBiomeWeights', new THREE.BufferAttribute(biomeWeights, 4));
    geo.setAttribute('aBiomeColor', new THREE.BufferAttribute(biomeColors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(centerX, 0, centerZ);
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Streams LOD terrain chunks + dynamically updates wind grass & biome trees/rocks around player.
   */
  update(playerX: number, playerZ: number): void {
    const cx = Math.floor(playerX / CHUNK_SIZE);
    const cz = Math.floor(playerZ / CHUNK_SIZE);

    if (cx !== this.lastCenterCx || cz !== this.lastCenterCz) {
      this.lastCenterCx = cx;
      this.lastCenterCz = cz;
      this.streamChunks(cx, cz);
    }

    if (Math.hypot(playerX - this.lastGrassCenter.x, playerZ - this.lastGrassCenter.y) > 22) {
      this.lastGrassCenter.set(playerX, playerZ);
      this.rebuildGrassAround(playerX, playerZ);
    }

    if (Math.hypot(playerX - this.lastPropCenter.x, playerZ - this.lastPropCenter.y) > 48) {
      this.lastPropCenter.set(playerX, playerZ);
      this.rebuildFoliageAndRocksAround(playerX, playerZ);
    }
  }

  private streamChunks(centerCx: number, centerCz: number): void {
    const wanted = new Map<string, { cx: number; cz: number; lod: 'high' | 'mid' }>();
    let minActiveX = Infinity;
    let minActiveZ = Infinity;
    let maxActiveX = -Infinity;
    let maxActiveZ = -Infinity;

    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        const wx = (cx + 0.5) * CHUNK_SIZE;
        const wz = (cz + 0.5) * CHUNK_SIZE;
        if (wx < WORLD_BOUNDS.minX - 160 || wx > WORLD_BOUNDS.maxX + 160 || wz < WORLD_BOUNDS.minZ - 160 || wz > WORLD_BOUNDS.maxZ + 160) {
          continue;
        }
        const lod: 'high' | 'mid' = Math.abs(dx) <= 1 && Math.abs(dz) <= 1 ? 'high' : 'mid';
        wanted.set(`${cx},${cz}`, { cx, cz, lod });
        minActiveX = Math.min(minActiveX, cx * CHUNK_SIZE);
        minActiveZ = Math.min(minActiveZ, cz * CHUNK_SIZE);
        maxActiveX = Math.max(maxActiveX, (cx + 1) * CHUNK_SIZE);
        maxActiveZ = Math.max(maxActiveZ, (cz + 1) * CHUNK_SIZE);
      }
    }

    // Evict stale or mismatched LOD chunks
    for (const [key, ch] of this.chunks) {
      const w = wanted.get(key);
      if (!w || w.lod !== ch.lod) {
        this.group.remove(ch.mesh);
        ch.mesh.geometry.dispose();
        this.chunks.delete(key);
      }
    }

    // Build missing chunks (High LOD = 64x64 + 6m skirt, Mid LOD = 32x32 + 6m skirt)
    for (const [key, w] of wanted) {
      if (this.chunks.has(key)) continue;
      const segs = w.lod === 'high' ? HIGH_LOD_SEGS : MID_LOD_SEGS;
      const mesh = this.buildRegionMesh(
        (w.cx + 0.5) * CHUNK_SIZE,
        (w.cz + 0.5) * CHUNK_SIZE,
        CHUNK_SIZE,
        CHUNK_SIZE,
        segs,
        0,
        true,
        this.terrainMat
      );
      this.group.add(mesh);
      this.chunks.set(key, { key, cx: w.cx, cz: w.cz, lod: w.lod, mesh });
    }

    // Update farMesh Z-fighting exclusion cutout bounds (inset 2m so outer 6m chunk skirts tuck cleanly over farMesh!)
    if (Number.isFinite(minActiveX)) {
      const inset = 2.0;
      (this.farTerrainMat.uniforms.uExcludeBounds.value as THREE.Vector4).set(
        minActiveX + inset,
        minActiveZ + inset,
        maxActiveX - inset,
        maxActiveZ - inset
      );
    }
  }

  private rebuildGrassAround(px: number, pz: number): void {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const nVec = new THREE.Vector3();
    const radius = this.activeGrassCap >= 6000 ? 86 : this.activeGrassCap >= 3500 ? 68 : 50;
    let placed = 0;

    // Deterministic world-snapped grid jitter so grass doesn't swim when moving!
    const step = this.activeGrassCap >= 6000 ? 1.72 : this.activeGrassCap >= 3500 ? 1.95 : 2.35;
    const minGx = Math.floor((px - radius) / step);
    const maxGx = Math.floor((px + radius) / step);
    const minGz = Math.floor((pz - radius) / step);
    const maxGz = Math.floor((pz + radius) / step);

    for (let gz = minGz; gz <= maxGz && placed < this.activeGrassCap; gz++) {
      for (let gx = minGx; gx <= maxGx && placed < this.activeGrassCap; gx++) {
        const h1 = Math.sin(gx * 127.1 + gz * 311.7) * 43758.5453;
        const r1 = h1 - Math.floor(h1);
        const h2 = Math.sin(gx * 269.5 + gz * 183.3) * 43758.5453;
        const r2 = h2 - Math.floor(h2);

        const wx = (gx + r1) * step;
        const wz = (gz + r2) * step;
        if ((wx - px) * (wx - px) + (wz - pz) * (wz - pz) > radius * radius) continue;

        // Exclude Shrine of Resurrection, Temple of Time, and all physical Shrine stone bases
        if (wx >= -329 && wx <= -298 && wz >= 447 && wz <= 463) continue;
        if (wx >= -258 && wx <= -232 && wz >= 478 && wz <= 512) continue;
        let nearShrine = false;
        for (let si = 0; si < PHYSICAL_SHRINES.length; si++) {
          const sh = PHYSICAL_SHRINES[si];
          if (Math.hypot(wx - sh.x, wz - sh.z) < 7.5) {
            nearShrine = true;
            break;
          }
        }
        if (nearShrine) continue;

        const wy = getTerrainHeight(wx, wz);
        if (wy < WORLD_BOUNDS.waterLevel + 0.8) continue;

        getTerrainNormal(wx, wz, nVec);
        if (nVec.y < 0.83) continue; // No grass on steep rock cliffs

        const bio = sampleBiomeAt(wx, wz, wy);
        if (bio.snow > 0.45 || bio.sand > 0.45 || bio.volcanic > 0.45 || bio.path > 0.45) continue;

        dummy.position.set(wx, wy - 0.04, wz);
        dummy.rotation.set(0, r1 * Math.PI * 2, 0);
        const s = 0.78 + r2 * 0.82;
        dummy.scale.set(s, s * (0.85 + r1 * 0.48), s);
        dummy.updateMatrix();
        this.grassMesh.setMatrixAt(placed, dummy.matrix);

        col.copy(bio.color).offsetHSL((r1 - 0.5) * 0.04, (r2 - 0.5) * 0.1, (r1 - 0.5) * 0.08);
        this.grassMesh.setColorAt(placed, col);
        placed++;
      }
    }

    // Hide unused instances cleanly
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = placed; i < this.maxGrassCount; i++) {
      this.grassMesh.setMatrixAt(i, dummy.matrix);
    }
    this.grassMesh.instanceMatrix.needsUpdate = true;
    if (this.grassMesh.instanceColor) this.grassMesh.instanceColor.needsUpdate = true;
  }

  private rebuildFoliageAndRocksAround(px: number, pz: number): void {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const nVec = new THREE.Vector3();
    const radius = 210;
    const step = 18;
    const minGx = Math.floor((px - radius) / step);
    const maxGx = Math.floor((px + radius) / step);
    const minGz = Math.floor((pz - radius) / step);
    const maxGz = Math.floor((pz + radius) / step);

    let trees = 0;
    let rocks = 0;
    const propColliders: StaticCollider[] = [];

    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const hash = Math.sin(gx * 91.7 + gz * 241.3) * 43758.5453;
        const r1 = hash - Math.floor(hash);
        const hash2 = Math.sin(gx * 313.1 + gz * 73.9) * 43758.5453;
        const r2 = hash2 - Math.floor(hash2);

        const wx = (gx + 0.15 + r1 * 0.7) * step;
        const wz = (gz + 0.15 + r2 * 0.7) * step;
        if ((wx - px) * (wx - px) + (wz - pz) * (wz - pz) > radius * radius) continue;

        // Keep immediate spawn overlook, 2-room Shrine of Resurrection, Temple of Time, Oman Au Shrine & Hyrule Castle grounds unobstructed!
        if (Math.hypot(wx - (-314), wz - 455) < 34) continue;
        if (Math.hypot(wx - (-300), wz - 455) < 26) continue;
        if (Math.hypot(wx - (-245), wz - 495) < 34) continue;
        if (Math.hypot(wx - (-220), wz - 425) < 24) continue;
        if (Math.hypot(wx - (-80), wz - (-260)) < 115) continue;

        const wy = getTerrainHeight(wx, wz);
        if (wy < WORLD_BOUNDS.waterLevel + 1.0) continue;
        getTerrainNormal(wx, wz, nVec);
        const bio = sampleBiomeAt(wx, wz, wy);
        const reg = getRegionAt(wx, wz);

        if (r1 < 0.42 && trees < 260 && nVec.y > 0.84 && bio.sand < 0.4 && bio.volcanic < 0.4 && bio.path < 0.3) {
          const sc = 0.85 + r2 * 0.75;
          dummy.position.set(wx, wy - 0.15, wz);
          dummy.rotation.set((r1 - 0.5) * 0.08, r2 * Math.PI * 2, (r2 - 0.5) * 0.08);
          let sx = sc * 1.08;
          let sy = sc * 1.05;
          if (reg.climate === 'extreme_cold' || reg.climate === 'highland_cold') {
            sx = sc * 0.78;
            sy = sc * 1.45;
            col.set(bio.snow > 0.5 ? '#c6dfec' : '#3e7c62');
          } else if (reg.climate === 'autumn') {
            sx = sc * 1.1;
            sy = sc * 1.05;
            col.set(r2 > 0.5 ? '#e0582a' : '#eca432');
          } else if (reg.climate === 'tropical') {
            sx = sc * 0.85;
            sy = sc * 1.5;
            col.set('#46b84e');
          } else {
            col.set('#62ad44').offsetHSL((r2 - 0.5) * 0.05, 0.06, (r1 - 0.5) * 0.07);
          }
          dummy.scale.set(sx, sy, sx);
          dummy.updateMatrix();
          this.treeTrunkMesh.setMatrixAt(trees, dummy.matrix);
          this.treeCanopyMesh.setMatrixAt(trees, dummy.matrix);
          this.treeCanopyMesh.setColorAt(trees, col);

          // Register climbable tree trunk cylinder collider!
          propColliders.push({
            id: `tree_${gx}_${gz}`,
            shape: 'cylinder',
            x: wx,
            z: wz,
            radius: Math.max(0.45, 0.52 * sx),
            minY: wy - 1.0,
            maxY: wy + 4.8 * sy,
            climbable: true,
            walkableTop: false,
          });
          trees++;
        } else if (r1 > 0.72 && rocks < 220 && bio.path < 0.3) {
          const sc = 0.6 + r2 * 1.8;
          dummy.position.set(wx, wy - sc * 0.3, wz);
          dummy.rotation.set(r1 * 3.1, r2 * 6.2, r1 * 1.7);
          dummy.scale.set(sc * 1.25, sc * 0.75, sc);
          dummy.updateMatrix();
          this.rockMesh.setMatrixAt(rocks, dummy.matrix);
          col.set(bio.volcanic > 0.4 ? '#4a3d3a' : bio.sand > 0.4 ? '#b88352' : '#8a857c');
          this.rockMesh.setColorAt(rocks, col);

          // Register solid rock boulder collider (climbable & walkable top!)
          propColliders.push({
            id: `rock_${gx}_${gz}`,
            shape: 'cylinder',
            x: wx,
            z: wz,
            radius: sc * 1.32,
            minY: wy - 1.2,
            maxY: wy + sc * 0.88,
            climbable: sc > 1.2,
            walkableTop: true,
          });
          rocks++;
        }
      }
    }

    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = trees; i < 260; i++) {
      this.treeTrunkMesh.setMatrixAt(i, dummy.matrix);
      this.treeCanopyMesh.setMatrixAt(i, dummy.matrix);
    }
    for (let i = rocks; i < 220; i++) {
      this.rockMesh.setMatrixAt(i, dummy.matrix);
    }

    this.treeTrunkMesh.instanceMatrix.needsUpdate = true;
    this.treeCanopyMesh.instanceMatrix.needsUpdate = true;
    if (this.treeCanopyMesh.instanceColor) this.treeCanopyMesh.instanceColor.needsUpdate = true;
    this.rockMesh.instanceMatrix.needsUpdate = true;
    if (this.rockMesh.instanceColor) this.rockMesh.instanceColor.needsUpdate = true;

    this.physics?.setTerrainPropColliders(propColliders);
  }
}
