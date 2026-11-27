import * as THREE from 'three';
import {
  createBotWGrassMaterial,
  createBotWTerrainMaterial,
  createBotWToonMaterial,
  createBotWWaterMaterial,
} from '../rendering/BotWToonShader';
import { textureBank } from '../rendering/ProceduralTextures';
import { WORLD_BOUNDS } from '../data/regions';
import { getRegionAt, getTerrainHeight, getTerrainNormal, sampleBiomeAt } from './TerrainGenerator';

interface TerrainChunk {
  key: string;
  cx: number;
  cz: number;
  lod: 'high' | 'mid';
  mesh: THREE.Mesh;
}

const CHUNK_SIZE = 160;

/**
 * Chunk-based LOD Terrain Streaming Manager + Permanent Distant Hyrule Panorama +
 * Wind-Swaying Instanced Grass Blades (6,000 tufts) + Instanced Biome Trees & Rocks.
 * Sustains 60fps across all 15 seamless Hyrule regions.
 */
export class TerrainChunkManager {
  public readonly group = new THREE.Group();
  private chunks = new Map<string, TerrainChunk>();
  private terrainMat: THREE.ShaderMaterial;
  private lastCenterCx = Number.NaN;
  private lastCenterCz = Number.NaN;

  // Dynamic wind-swaying grass around player
  private grassMesh: THREE.InstancedMesh;
  private grassCount = 7200;
  private lastGrassCenter = new THREE.Vector2(1e9, 1e9);

  // Instanced biome trees & rocks around player
  private treeTrunkMesh: THREE.InstancedMesh;
  private treeCanopyMesh: THREE.InstancedMesh;
  private rockMesh: THREE.InstancedMesh;
  private lastPropCenter = new THREE.Vector2(1e9, 1e9);

  constructor() {
    this.group.name = 'HyruleTerrainSystem';

    this.terrainMat = createBotWTerrainMaterial({
      grassMap: textureBank.getGrassTexture().map,
      cliffMap: textureBank.getCliffTexture().map,
      sandMap: textureBank.getSandTexture().map,
      snowMap: textureBank.getSnowTexture().map,
      volcanicMap: textureBank.getVolcanicTexture().map,
    });

    // 1. Permanent Full-Hyrule Far Panorama Mesh (slightly lowered by 0.85m so near chunks sit cleanly on top!)
    const farMesh = this.buildRegionMesh(0, 0, 3400, 2800, 96, -0.85);
    farMesh.name = 'HyruleFarPanorama';
    this.group.add(farMesh);

    // 2. Shimmering Cel-Shaded Water Plane spanning Hyrule's lakes, rivers, castle moat & Faron sea
    const waterGeo = new THREE.PlaneGeometry(3400, 2800, 48, 48);
    waterGeo.rotateX(-Math.PI / 2);
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
    this.grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, this.grassCount);
    this.grassMesh.frustumCulled = false;
    this.grassMesh.name = 'WindSwayingGrass';
    this.group.add(this.grassMesh);

    // 5. Instanced Stylized Sculpted Trees (warm cedar trunks + smooth sunlit painted BotW canopies!) & Faceted Rocks
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
      map: textureBank.getGrassTexture().map,
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
      map: textureBank.getCliffTexture().map,
      normalMap: textureBank.getCliffTexture().normalMap,
      rimStrength: 0.30,
    });
    this.rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, 220);
    this.rockMesh.castShadow = true;
    this.rockMesh.receiveShadow = true;
    this.rockMesh.frustumCulled = false;
    this.group.add(this.rockMesh);
  }

  private createGrassTuftGeometry(): THREE.BufferGeometry {
    // 3 crossed curved tapered blades per tuft for lush full-volume BotW grass!
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
    // Smooth painterly Studio Ghibli / BotW cloud-puff canopy (zero harsh low-poly facets!)
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

  private buildRegionMesh(centerX: number, centerZ: number, width: number, depth: number, segs: number, yOffset = 0): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(width, depth, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const count = pos.count;
    const biomeWeights = new Float32Array(count * 4);
    const biomeColors = new Float32Array(count * 3);
    const nVec = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wx = centerX + lx;
      const wz = centerZ + lz;
      const wy = getTerrainHeight(wx, wz) + yOffset;
      pos.setY(i, wy);

      const b = sampleBiomeAt(wx, wz, wy);
      biomeWeights[i * 4] = b.snow;
      biomeWeights[i * 4 + 1] = b.sand;
      biomeWeights[i * 4 + 2] = b.volcanic;
      biomeWeights[i * 4 + 3] = b.path;

      biomeColors[i * 3] = b.color.r;
      biomeColors[i * 3 + 1] = b.color.g;
      biomeColors[i * 3 + 2] = b.color.b;
    }

    geo.setAttribute('aBiomeWeights', new THREE.BufferAttribute(biomeWeights, 4));
    geo.setAttribute('aBiomeColor', new THREE.BufferAttribute(biomeColors, 3));
    geo.computeVertexNormals();

    // Refine normals using exact analytic terrain normal to eliminate chunk seam lines!
    const normAttr = geo.attributes.normal;
    for (let i = 0; i < count; i++) {
      const wx = centerX + pos.getX(i);
      const wz = centerZ + pos.getZ(i);
      getTerrainNormal(wx, wz, nVec);
      normAttr.setXYZ(i, nVec.x, nVec.y, nVec.z);
    }
    normAttr.needsUpdate = true;

    const mesh = new THREE.Mesh(geo, this.terrainMat);
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

    // Build missing chunks
    for (const [key, w] of wanted) {
      if (this.chunks.has(key)) continue;
      const segs = w.lod === 'high' ? 36 : 16;
      const mesh = this.buildRegionMesh((w.cx + 0.5) * CHUNK_SIZE, (w.cz + 0.5) * CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE, segs, 0);
      this.group.add(mesh);
      this.chunks.set(key, { key, cx: w.cx, cz: w.cz, lod: w.lod, mesh });
    }
  }

  private rebuildGrassAround(px: number, pz: number): void {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const nVec = new THREE.Vector3();
    const radius = 86;
    let placed = 0;

    // Deterministic world-snapped grid jitter so grass doesn't swim when moving!
    const step = 1.72;
    const minGx = Math.floor((px - radius) / step);
    const maxGx = Math.floor((px + radius) / step);
    const minGz = Math.floor((pz - radius) / step);
    const maxGz = Math.floor((pz + radius) / step);

    for (let gz = minGz; gz <= maxGz && placed < this.grassCount; gz++) {
      for (let gx = minGx; gx <= maxGx && placed < this.grassCount; gx++) {
        const h1 = Math.sin(gx * 127.1 + gz * 311.7) * 43758.5453;
        const r1 = h1 - Math.floor(h1);
        const h2 = Math.sin(gx * 269.5 + gz * 183.3) * 43758.5453;
        const r2 = h2 - Math.floor(h2);

        const wx = (gx + r1) * step;
        const wz = (gz + r2) * step;
        if ((wx - px) * (wx - px) + (wz - pz) * (wz - pz) > radius * radius) continue;

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
    for (let i = placed; i < this.grassCount; i++) {
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

    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const hash = Math.sin(gx * 91.7 + gz * 241.3) * 43758.5453;
        const r1 = hash - Math.floor(hash);
        const hash2 = Math.sin(gx * 313.1 + gz * 73.9) * 43758.5453;
        const r2 = hash2 - Math.floor(hash2);

        const wx = (gx + 0.15 + r1 * 0.7) * step;
        const wz = (gz + 0.15 + r2 * 0.7) * step;
        if ((wx - px) * (wx - px) + (wz - pz) * (wz - pz) > radius * radius) continue;

        // Keep immediate spawn overlook, Temple of Time, Oman Au Shrine & Hyrule Castle grounds unobstructed!
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
          if (reg.climate === 'extreme_cold' || reg.climate === 'highland_cold') {
            dummy.scale.set(sc * 0.78, sc * 1.45, sc * 0.78);
            col.set(bio.snow > 0.5 ? '#c6dfec' : '#3e7c62');
          } else if (reg.climate === 'autumn') {
            dummy.scale.set(sc * 1.1, sc * 1.05, sc * 1.1);
            col.set(r2 > 0.5 ? '#e0582a' : '#eca432');
          } else if (reg.climate === 'tropical') {
            dummy.scale.set(sc * 0.85, sc * 1.5, sc * 0.85);
            col.set('#46b84e');
          } else {
            dummy.scale.set(sc * 1.08, sc * 1.05, sc * 1.08);
            col.set('#62ad44').offsetHSL((r2 - 0.5) * 0.05, 0.06, (r1 - 0.5) * 0.07);
          }
          dummy.updateMatrix();
          this.treeTrunkMesh.setMatrixAt(trees, dummy.matrix);
          this.treeCanopyMesh.setMatrixAt(trees, dummy.matrix);
          this.treeCanopyMesh.setColorAt(trees, col);
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
  }
}
