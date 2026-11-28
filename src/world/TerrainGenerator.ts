import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { LANDMARKS, PHYSICAL_SHRINES, REGION_LIST, REGIONS, WORLD_BOUNDS } from '../data/regions';
import type { RegionDef, RegionId } from '../types/botw';

export interface InteriorEnvironmentOverride {
  getFloorY: (x: number, z: number) => number;
  getWaterLevel: (x: number, z: number) => number | null;
}

let interiorEnvOverride: InteriorEnvironmentOverride | null = null;

export function setInteriorEnvironmentOverride(override: InteriorEnvironmentOverride | null): void {
  interiorEnvOverride = override;
}

export function getInteriorWaterLevelAt(x: number, z: number): number | null {
  return interiorEnvOverride ? interiorEnvOverride.getWaterLevel(x, z) : null;
}

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseA = createNoise2D(createSeededRng(20170303)); // BotW launch date seed!
const noiseB = createNoise2D(createSeededRng(10000100));

function fbm(x: number, z: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noiseA(x * freq, z * freq);
    freq *= 2.04;
    amp *= 0.5;
  }
  return sum;
}

function ridge(x: number, z: number): number {
  return 1.0 - Math.abs(noiseB(x, z));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function gaussian(dx: number, dz: number, radius: number): number {
  const d2 = (dx * dx + dz * dz) / (radius * radius);
  if (d2 > 9) return 0;
  return Math.exp(-d2);
}

function plateauBump(dx: number, dz: number, flatR: number, slopeR: number): number {
  const d = Math.hypot(dx, dz);
  if (d <= flatR) return 1;
  if (d >= slopeR) return 0;
  return 1 - smoothstep(flatR, slopeR, d);
}

/**
 * Determines which of the 15 Sheikah Tower regions owns world coordinate (x, z).
 */
export function getRegionAt(x: number, z: number): RegionDef {
  // Fast check: Great Plateau crisp boundary
  const gp = REGIONS.great_plateau;
  if (Math.hypot(x - gp.center.x, z - gp.center.z) < 225) {
    return gp;
  }
  let best = REGIONS.central_hyrule;
  let bestScore = Infinity;
  for (const r of REGION_LIST) {
    const d = Math.hypot(x - r.center.x, z - r.center.z) / r.radius;
    if (d < bestScore) {
      bestScore = d;
      best = r;
    }
  }
  return best;
}

/**
 * Continuous deterministic Hyrule Heightmap (CEDEC 2017 Triangle/Trapezoid/Gradual-Reveal design).
 * Strictly enforces peak hierarchy:
 *   1. Gerudo Summit (~240m world = 800m displayed)
 *   2. Hebra Peak    (~225m world = 750m displayed)
 *   3. Death Mountain(~210m world = 700m displayed)
 */
export function getTerrainHeight(x: number, z: number): number {
  if (interiorEnvOverride) {
    return interiorEnvOverride.getFloorY(x, z);
  }
  // Base gently rolling Hyrule Field hills + CEDEC triangular sightline ridges
  let h = 14.0 + fbm(x * 0.0014, z * 0.0014, 4) * 26.0 + ridge(x * 0.0022, z * 0.0022) * 14.0;

  // 1. GREAT PLATEAU (Raised mesa at y ~ 45m with steep cliff perimeter + Mount Hylia SW peak)
  const gpDist = Math.hypot(x - (-240), z - 465);
  if (gpDist < 260) {
    const mesa = 1 - smoothstep(182, 224, gpDist);
    const localUndul = fbm(x * 0.008, z * 0.008, 3) * 6.5;
    const plateauH = 44.0 + localUndul;
    h = h * (1 - mesa) + plateauH * mesa;

    // Shrine of Resurrection dramatic overlook ledge (-305, 455) facing NE over Temple of Time & Hyrule Castle!
    const sor = plateauBump(x - (-305), z - 455, 16, 44);
    h += sor * 11.0;

    // Mount Hylia snow ridge on SW Great Plateau
    h += gaussian(x - (-355), z - 555, 65) * 26.0;

    // Flat clear lawn around Temple of Time (-245, 495)
    const tot = plateauBump(x - (-245), z - 495, 24, 52);
    h = h * (1 - tot * 0.85) + 45.0 * (tot * 0.85);
  }

  // 2. THREE HIGHEST PEAKS (Strictly ordered: Gerudo 240 > Hebra 225 > Death Mountain 210)
  // #1 Gerudo Summit (-1120, 210) -> ~240m
  const gerudoPeak = gaussian(x - (-1120), z - 210, 245);
  h += gerudoPeak * 214.0;
  // Gerudo Highlands mesa backdrop
  h += plateauBump(x - (-1040), z - 240, 140, 320) * 58.0;

  // #2 Hebra Peak (-900, -860) -> ~225m
  const hebraPeak = gaussian(x - (-900), z - (-860), 270);
  h += hebraPeak * 198.0;
  h += gaussian(x - (-660), z - (-900), 210) * 105.0;

  // #3 Death Mountain (520, -840) -> ~210m with dramatic volcanic crater dip at summit!
  const dmDist = Math.hypot(x - 520, z - (-840));
  if (dmDist < 420) {
    const dmCone = gaussian(x - 520, z - (-840), 255) * 192.0;
    const craterDip = gaussian(x - 520, z - (-840), 58) * 34.0;
    h += Math.max(0, dmCone - craterDip);
  }

  // 3. DUELING PEAKS (260, 440) — Iconic split twin mountain with pass canyon down the middle!
  const dpNorth = gaussian(x - 255, z - 365, 92) * 124.0;
  const dpSouth = gaussian(x - 268, z - 518, 92) * 116.0;
  h += dpNorth + dpSouth;
  // Carve canyon pass between the twins along z = 442
  const canyon = Math.exp(-Math.pow((z - 442) / 26, 2)) * gaussian(x - 260, 0, 150);
  h = h * (1 - canyon * 0.88) + 12.0 * (canyon * 0.88);

  // 4. MOUNT LANAYRU & SPRING OF WISDOM (1110, 320)
  h += gaussian(x - 1110, z - 320, 190) * 142.0;

  // 5. HYRULE CASTLE MOUND & CIRCULAR WATER MOAT (-80, -260)
  const hcDist = Math.hypot(x - (-80), z - (-260));
  if (hcDist < 195) {
    if (hcDist < 102) {
      // Rising castle citadel tiers
      const mound = 1 - smoothstep(25, 102, hcDist);
      h = 16.0 + mound * 44.0;
    } else if (hcDist < 146) {
      // Deep water moat surrounding Hyrule Castle (water at 4.5m)
      const moatFactor = Math.sin(((hcDist - 102) / 44) * Math.PI);
      h = 14.0 - moatFactor * 16.0;
    }
    // South Main Gate stone causeway bridge across moat (x near -80, z > -160)
    if (Math.abs(x - (-80)) < 16 && z > -165 && z < -90) {
      h = Math.max(h, 13.5);
    }
  }

  // 6. LAKE HYLIA BASIN (-100, 860)
  const lakeHylia = gaussian(x - (-100), z - 860, 165);
  h -= lakeHylia * 34.0;

  // 7. LAKE TOTORI & RITO VILLAGE CENTRAL PILLAR (-1080, -420)
  const totoriDist = Math.hypot(x - (-1080), z - (-420));
  if (totoriDist < 140) {
    if (totoriDist < 42) {
      // Dramatic vertical stone spire of Rito Village
      h = 18.0 + (1 - smoothstep(12, 42, totoriDist)) * 58.0;
    } else {
      const lakeDip = Math.sin(((totoriDist - 42) / 98) * Math.PI);
      h -= lakeDip * 26.0;
    }
  }

  // 8. ZORA EAST RESERVOIR (1120, -180) & ZORA RIVER BASIN
  h -= gaussian(x - 1120, z - (-180), 110) * 28.0;

  // 9. GERUDO DESERT WIDE BASIN + WIND-RIPPLED DUNES (-960, 780)
  const desertBlend = plateauBump(x - (-960), z - 780, 260, 440);
  if (desertBlend > 0.01) {
    const duneH = 14.0 + Math.sin(x * 0.032 + z * 0.018) * 5.5 + fbm(x * 0.004, z * 0.004, 2) * 8.0;
    h = h * (1 - desertBlend * 0.85) + duneH * (desertBlend * 0.85);
  }

  // 10. FARON COAST / LURELIN BAY / EVENTIDE ISLAND (SE ocean border)
  if (x > 1150 && z > 780) {
    const oceanT = smoothstep(1150, 1360, x) * smoothstep(780, 960, z);
    h = h * (1 - oceanT) + (-6.0) * oceanT;
    // Eventide Island rises back out of sea at (1420, 1020)
    h += plateauBump(x - 1420, z - 1020, 45, 92) * 32.0;
  }

  // 11. SMALL FLAT PADS FOR MAJOR SETTLEMENTS, STABLES & PHYSICAL SHRINES (eliminates floating/clipping!)
  for (const lm of LANDMARKS) {
    if (lm.type === 'castle' || lm.type === 'divine_beast' || lm.type === 'resurrection' || lm.type === 'temple_of_time') continue;
    const d = Math.hypot(x - lm.x, z - lm.z);
    const padR = Math.min(lm.radius * 0.72, 46);
    if (d < padR * 1.65) {
      const t = 1 - smoothstep(padR * 0.65, padR * 1.65, d);
      const targetH = Math.max(WORLD_BOUNDS.waterLevel + 3.5, REGIONS[lm.region].baseElevation + (lm.type === 'settlement' ? 8 : 4));
      h = h * (1 - t * 0.82) + targetH * (t * 0.82);
    }
  }
  for (const sh of PHYSICAL_SHRINES) {
    const d = Math.hypot(x - sh.x, z - sh.z);
    if (d < 20) {
      const t = 1 - smoothstep(8, 20, d);
      // Sample nearby reference so shrine sits flush on local terrain
      const refH = Math.max(WORLD_BOUNDS.waterLevel + 2.5, h);
      h = h * (1 - t * 0.5) + refH * (t * 0.5);
    }
  }

  // Enforce strict global peak ceilings so Gerudo (240) > Hebra (225) > Death Mountain (210)
  return Math.max(-14, Math.min(244, h));
}

export function getTerrainNormal(x: number, z: number, target = new THREE.Vector3()): THREE.Vector3 {
  const eps = 1.2;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  target.set(hL - hR, 2 * eps, hD - hU).normalize();
  return target;
}

export interface BiomeSample {
  snow: number;
  sand: number;
  volcanic: number;
  path: number;
  color: THREE.Color;
}

const tmpColA = new THREE.Color();

/**
 * Computes biome shader blend weights & regional painterly grass tint for terrain vertex attributes.
 */
export function sampleBiomeAt(x: number, z: number, y: number): BiomeSample {
  const reg = getRegionAt(x, z);
  let snow = 0;
  let sand = 0;
  let volcanic = 0;
  let path = 0;

  // Extreme cold snow regions + Mount Hylia + Mount Lanayru + high altitude
  if (reg.climate === 'extreme_cold') snow = 0.92;
  else if (reg.climate === 'highland_cold' && y > 68) snow = smoothstep(68, 108, y);
  // Mount Hylia snow on SW Great Plateau
  const hyliaD = Math.hypot(x - (-355), z - 555);
  if (hyliaD < 92) snow = Math.max(snow, 1 - smoothstep(38, 92, hyliaD));
  // Mount Lanayru peak snow
  const lanPeak = Math.hypot(x - 1110, z - 320);
  if (lanPeak < 155) snow = Math.max(snow, 1 - smoothstep(70, 155, lanPeak));

  // Gerudo Desert sand + Faron coastal beaches
  if (reg.climate === 'desert') {
    sand = 0.95;
  } else {
    const desD = Math.hypot(x - (-960), z - 780);
    if (desD < 480) sand = Math.max(sand, 1 - smoothstep(330, 480, desD));
  }

  // Eldin Volcanic basalt
  if (reg.climate === 'volcanic') {
    volcanic = 0.92;
  } else {
    const eldD = Math.hypot(x - 520, z - (-740));
    if (eldD < 420) volcanic = Math.max(volcanic, 1 - smoothstep(260, 420, eldD));
  }

  // Winding dirt trails linking Great Plateau -> Dueling Peaks -> Kakariko -> Hateno -> Hyrule Castle
  const roadNoise = noiseA(x * 0.008, z * 0.008) * 18;
  const distCastleRoad = Math.abs(x - (-80) + roadNoise * 0.5);
  if (z > -160 && z < 340 && distCastleRoad < 9) {
    path = Math.max(path, 1 - smoothstep(4, 9, distCastleRoad));
  }
  const distPlateauTrail = Math.abs((z - 455) - (x - (-305)) * 0.35);
  if (x > -310 && x < -170 && distPlateauTrail < 8) {
    path = Math.max(path, 1 - smoothstep(3, 8, distPlateauTrail));
  }

  const color = tmpColA.set(reg.grassColor).clone();
  return { snow, sand, volcanic, path, color };
}

export function isWaterAt(x: number, z: number): boolean {
  if (interiorEnvOverride) {
    const wl = interiorEnvOverride.getWaterLevel(x, z);
    return wl !== null && interiorEnvOverride.getFloorY(x, z) < wl;
  }
  if (isLavaAt(x, z)) return false;
  return getTerrainHeight(x, z) < WORLD_BOUNDS.waterLevel;
}

export function isLavaAt(x: number, z: number): boolean {
  if (interiorEnvOverride) return false;
  const dmDist = Math.hypot(x - 520, z - (-840));
  if (dmDist < 220 && getTerrainHeight(x, z) < 76) return true;
  // Goron City lava moat
  const gcDist = Math.hypot(x - 450, z - (-760));
  return gcDist > 55 && gcDist < 105 && getRegionAt(x, z).id === 'eldin';
}

export function isFreezingWaterAt(x: number, z: number): boolean {
  if (interiorEnvOverride) return false;
  if (!isWaterAt(x, z)) return false;
  const reg = getRegionAt(x, z);
  return reg.climate === 'extreme_cold' || reg.climate === 'highland_cold';
}

/**
 * Per BotW DLC 2 spec: Master Cycle Zero cannot be summoned in most of Gerudo Desert or Eldin Volcano lava zones!
 */
export function isNoBikeZone(x: number, z: number): { blocked: boolean; reasonJa: string } {
  const reg = getRegionAt(x, z);
  if (reg.id === 'wasteland' && Math.hypot(x - (-960), z - 780) < 350) {
    return { blocked: true, reasonJa: 'ゲルド砂漠の深部ではマスターバイク零式を呼び出せません！' };
  }
  if (reg.id === 'eldin' && Math.hypot(x - 520, z - (-800)) < 310) {
    return { blocked: true, reasonJa: 'デスマウンテン灼熱溶岩地帯ではマスターバイク零式を呼び出せません！' };
  }
  return { blocked: false, reasonJa: '' };
}

export function getSurfaceType(x: number, z: number): 'grass' | 'stone' | 'snow' | 'sand' | 'water' {
  if (interiorEnvOverride) {
    const wl = interiorEnvOverride.getWaterLevel(x, z);
    if (wl !== null && interiorEnvOverride.getFloorY(x, z) < wl) return 'water';
    return 'stone';
  }
  const y = getTerrainHeight(x, z);
  if (y < WORLD_BOUNDS.waterLevel) return 'water';
  const n = getTerrainNormal(x, z);
  if (n.y < 0.78) return 'stone';
  const b = sampleBiomeAt(x, z, y);
  if (b.snow > 0.5) return 'snow';
  if (b.sand > 0.5) return 'sand';
  if (b.volcanic > 0.5) return 'stone';
  return 'grass';
}
