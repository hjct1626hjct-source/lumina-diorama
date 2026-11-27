import * as THREE from 'three';
import { BOTW_UNIFORMS, createBotWSkyMaterial } from '../rendering/BotWToonShader';
import { getRegionAt, isFreezingWaterAt } from './TerrainGenerator';
import { WORLD_BOUNDS } from '../data/regions';
import type { RegionId, WeatherType } from '../types/botw';

export interface ClimateStatus {
  timeHours: number; // 0..24 (1 in-game hour = 1 real minute -> 24 real min/day)
  daysElapsed: number;
  weather: WeatherType;
  forecast: [WeatherType, WeatherType, WeatherType];
  temperatureC: number;
  temperatureF: number;
  isVolcanicError: boolean;
  coldHazardLevel: 0 | 1 | 2;
  heatHazardLevel: 0 | 1 | 2;
  flameHazardLevel: 0 | 1 | 2;
  freezingWater: boolean;
  isBloodMoonRising: boolean;
  isBloodMoonCookWindow: boolean; // 23:30 - 00:15
  bloodMoonTimerSec: number; // Triggers at 168*60 = 10080 sec (7 in-game days)
  windStrength: number;
  lightningWarning: boolean;
}

/**
 * Manages BotW 24-real-minute day/night cycle, regional 3-hour weather forecast,
 * dynamic cel lighting & atmospheric scattering fog, real temperature thresholds,
 * Blood Moon cycle (168 real minutes / 7 in-game days), and precipitation particles.
 */
export class WeatherClimateSystem {
  public readonly group = new THREE.Group();
  public readonly skyMesh: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  public readonly sunLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  private precipPoints: THREE.Points;
  private precipPositions: Float32Array;
  private precipMat: THREE.PointsMaterial;

  public timeHours = 9.5; // Crisp bright Hyrule morning at Shrine of Resurrection awakening!
  public daysElapsed = 1;
  public bloodMoonTimerSec = 0;
  public bloodMoonPending = false;
  public bloodMoonActiveTimer = 0;

  private lastWeatherSlot = -1;
  private currentRegion: RegionId = 'great_plateau';
  public weather: WeatherType = 'sunny';
  public forecast: [WeatherType, WeatherType, WeatherType] = ['sunny', 'cloudy', 'sunny'];
  private lightningCooldown = 6;
  public lightningFlash = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = 'WeatherClimateSystem';

    // Sky Dome
    this.skyMat = createBotWSkyMaterial();
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 20), this.skyMat);
    this.skyMesh.frustumCulled = false;
    this.group.add(this.skyMesh);

    // Directional Sunlight with shadow map
    this.sunLight = new THREE.DirectionalLight('#fff5dc', 1.85);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 360;
    const d = 95;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0008;
    this.group.add(this.sunLight);
    this.group.add(this.sunLight.target);

    // Painterly Hemisphere bounce light (sky blue overhead, lush earth bounce below)
    this.hemiLight = new THREE.HemisphereLight('#9ed8ff', '#5e7d4a', 0.95);
    this.group.add(this.hemiLight);

    // Rain / Snow / Volcanic Ash / Blood Moon Embers particle field
    const count = 900;
    this.precipPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.precipPositions[i * 3] = (Math.random() - 0.5) * 90;
      this.precipPositions[i * 3 + 1] = Math.random() * 48;
      this.precipPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.precipPositions, 3));
    this.precipMat = new THREE.PointsMaterial({
      color: '#d8eeff',
      size: 0.42,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.precipPoints = new THREE.Points(pGeo, this.precipMat);
    this.precipPoints.frustumCulled = false;
    this.group.add(this.precipPoints);

    scene.add(this.group);
  }

  private rollWeatherForRegion(regionId: RegionId, seedVal: number): WeatherType {
    const reg = getRegionAt(
      regionId === 'great_plateau' ? -240 : 0,
      regionId === 'great_plateau' ? 460 : 0
    );
    // Direct lookup via region weights
    const weights = this.getWeightsFor(regionId);
    const entries = Object.entries(weights) as Array<[WeatherType, number]>;
    const total = entries.reduce((acc, [, w]) => acc + (w ?? 0), 0);
    const r = ((Math.sin(seedVal * 91.31) * 43758.5453) % 1 + 1) % 1 * total;
    let accum = 0;
    for (const [wType, w] of entries) {
      accum += w ?? 0;
      if (r <= accum) return wType;
    }
    void reg;
    return 'sunny';
  }

  private getWeightsFor(regionId: RegionId): Partial<Record<WeatherType, number>> {
    // Use region definition weather tables (Gerudo desert strictly 0% rain!)
    if (regionId === 'wasteland') return { sunny: 0.72, sandstorm: 0.22, cloudy: 0.06 };
    if (regionId === 'eldin') return { volcanic_ash: 0.65, sunny: 0.25, cloudy: 0.10 };
    if (regionId === 'hebra' || regionId === 'gerudo_highlands') return { snow: 0.46, blizzard: 0.26, cloudy: 0.18, sunny: 0.10 };
    if (regionId === 'faron') return { sunny: 0.30, rain: 0.36, thunderstorm: 0.24, cloudy: 0.06, sunshower: 0.04 };
    if (regionId === 'lanayru') return { sunny: 0.32, cloudy: 0.24, rain: 0.34, thunderstorm: 0.07, sunshower: 0.03 };
    if (regionId === 'tabantha') return { sunny: 0.45, cloudy: 0.28, snow: 0.18, rain: 0.09 };
    return { sunny: 0.56, cloudy: 0.22, rain: 0.14, thunderstorm: 0.04, sunshower: 0.04 };
  }

  /**
   * Triggers a Blood Moon immediately (manual / panic / scheduled 168-min cycle).
   */
  triggerBloodMoon(): void {
    this.timeHours = 23.85;
    this.bloodMoonPending = true;
    this.bloodMoonActiveTimer = 24;
  }

  advanceTimeHours(deltaHours: number): void {
    this.timeHours += deltaHours;
    while (this.timeHours >= 24) {
      this.timeHours -= 24;
      this.daysElapsed += 1;
    }
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    opts: { nearFire: boolean; holdingIceWeapon: boolean; wearingMetal: boolean; onBloodMoonMidnight?: () => void }
  ): ClimateStatus {
    // 1 real minute = 1 in-game hour (24 real minutes = 1 full Hyrule day!)
    const prevHour = this.timeHours;
    this.timeHours += dt / 60;
    if (this.timeHours >= 24) {
      this.timeHours -= 24;
      this.daysElapsed += 1;
    }

    // Blood Moon cycle: 168 real minutes (7 in-game days = 10,080 real seconds)
    this.bloodMoonTimerSec += dt;
    if (this.bloodMoonTimerSec >= 10080) {
      this.bloodMoonPending = true;
    }

    const isBloodMoonRising = this.bloodMoonPending && (this.timeHours >= 21.0 || this.timeHours < 0.5);
    if (this.bloodMoonPending && prevHour > 23.0 && this.timeHours < 1.0) {
      // Midnight Blood Moon trigger!
      this.bloodMoonPending = false;
      this.bloodMoonTimerSec = 0;
      this.bloodMoonActiveTimer = 18;
      opts.onBloodMoonMidnight?.();
    }
    if (this.bloodMoonActiveTimer > 0) {
      this.bloodMoonActiveTimer = Math.max(0, this.bloodMoonActiveTimer - dt);
    }

    const bloodMoonFactor = this.bloodMoonActiveTimer > 0
      ? Math.min(1, this.bloodMoonActiveTimer / 4)
      : isBloodMoonRising
      ? Math.min(1, Math.max(0, (this.timeHours - 21) / 3))
      : 0;

    // 3-hour weather forecast slot transition
    const reg = getRegionAt(playerPos.x, playerPos.z);
    const slot = Math.floor((this.daysElapsed * 24 + this.timeHours) / 3);
    if (slot !== this.lastWeatherSlot || reg.id !== this.currentRegion) {
      this.lastWeatherSlot = slot;
      this.currentRegion = reg.id;
      // Keep initial Great Plateau morning sunny for crisp first impression!
      if (this.daysElapsed === 1 && slot <= 4 && reg.id === 'great_plateau') {
        this.weather = 'sunny';
      } else {
        this.weather = this.rollWeatherForRegion(reg.id, slot + reg.center.x * 0.01);
      }
      this.forecast = [
        this.rollWeatherForRegion(reg.id, slot + 1 + reg.center.x * 0.01),
        this.rollWeatherForRegion(reg.id, slot + 2 + reg.center.x * 0.01),
        this.rollWeatherForRegion(reg.id, slot + 3 + reg.center.x * 0.01),
      ];
    }

    // Dynamic Sun / Moon Orbital Geometry
    const sunAngle = ((this.timeHours - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * 0.88;
    const sunZ = 0.42;
    const sunDir = new THREE.Vector3(sunX, sunY, sunZ).normalize();
    const moonDir = sunDir.clone().negate();

    // Update sky dome position around camera/player
    this.skyMesh.position.copy(playerPos);

    // Smooth Time-of-Day Painterly Lighting & Shadow Tint Palette
    const dayFactor = THREE.MathUtils.smoothstep(sunY, -0.15, 0.25);
    const sunsetFactor = Math.exp(-Math.pow((sunY - 0.06) / 0.14, 2));
    const overcast = this.weather === 'rain' || this.weather === 'thunderstorm' || this.weather === 'cloudy' || this.weather === 'blizzard' ? 0.45 : 0;

    const sunColor = new THREE.Color('#283a68')
      .lerp(new THREE.Color('#fff4d8'), dayFactor)
      .lerp(new THREE.Color('#ff9d5c'), sunsetFactor * 0.72);
    if (overcast > 0) sunColor.lerp(new THREE.Color('#b8cad8'), overcast * 0.5);

    const shadowTint = new THREE.Color('#222e58') // Deep indigo night shadow
      .lerp(new THREE.Color('#4a6298'), dayFactor) // Crisp Hyrule blue-violet shadow
      .lerp(new THREE.Color('#6a4576'), sunsetFactor * 0.55);

    const fogHorizon = new THREE.Color('#16223e')
      .lerp(new THREE.Color('#b7dff6'), dayFactor)
      .lerp(new THREE.Color('#f4ae78'), sunsetFactor * 0.75);
    if (overcast > 0) fogHorizon.lerp(new THREE.Color('#8ba3b5'), overcast * 0.65);

    const fogZenith = new THREE.Color('#0c152c')
      .lerp(new THREE.Color('#2a78d8'), dayFactor)
      .lerp(new THREE.Color('#4c5c9c'), sunsetFactor * 0.55);

    const rimColor = new THREE.Color('#6a88cc')
      .lerp(new THREE.Color('#dff4ff'), dayFactor)
      .lerp(new THREE.Color('#ffd096'), sunsetFactor * 0.7);

    // Update Global BotW Shader Uniforms
    BOTW_UNIFORMS.uTime.value += dt;
    BOTW_UNIFORMS.uSunDir.value.copy(sunY >= -0.05 ? sunDir : moonDir);
    BOTW_UNIFORMS.uSunColor.value.copy(sunColor);
    BOTW_UNIFORMS.uShadowTint.value.copy(shadowTint);
    BOTW_UNIFORMS.uRimColor.value.copy(rimColor);
    BOTW_UNIFORMS.uFogHorizonColor.value.copy(fogHorizon);
    BOTW_UNIFORMS.uFogZenithColor.value.copy(fogZenith);
    BOTW_UNIFORMS.uBloodMoon.value = bloodMoonFactor;
    BOTW_UNIFORMS.uRainWetness.value =
      this.weather === 'rain' || this.weather === 'thunderstorm' || this.weather === 'sunshower' ? 0.85 : 0.0;

    const windStrength =
      this.weather === 'blizzard' || this.weather === 'sandstorm' || this.weather === 'thunderstorm'
        ? 2.2
        : this.weather === 'rain' || this.weather === 'snow'
        ? 1.45
        : 0.95;
    BOTW_UNIFORMS.uWindStrength.value = windStrength;
    BOTW_UNIFORMS.uPlayerPos.value.copy(playerPos);

    // Update Sky uniforms
    this.skyMat.uniforms.uSkyTopColor.value.copy(fogZenith);
    this.skyMat.uniforms.uSkyMidColor.value.copy(fogZenith).lerp(fogHorizon, 0.52);
    this.skyMat.uniforms.uSkyHorizonColor.value.copy(fogHorizon);
    this.skyMat.uniforms.uMoonDir.value.copy(moonDir);

    // Update Three.js Lights following player for crisp shadows
    const activeLightDir = sunY >= -0.05 ? sunDir : moonDir;
    this.sunLight.position.copy(playerPos).addScaledVector(activeLightDir, 120);
    this.sunLight.target.position.copy(playerPos);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.color.copy(sunColor);
    this.sunLight.intensity = THREE.MathUtils.lerp(0.65, 1.9, dayFactor) * (1 - overcast * 0.25) + this.lightningFlash * 2.5;

    this.hemiLight.color.copy(fogHorizon);
    this.hemiLight.groundColor.set(reg.grassColor).multiplyScalar(0.55);
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.45, 1.0, dayFactor);

    // Thunderstorm lightning flashes + metal attraction warning
    let lightningWarning = false;
    if (this.weather === 'thunderstorm') {
      lightningWarning = opts.wearingMetal;
      this.lightningCooldown -= dt;
      if (this.lightningCooldown <= 0) {
        this.lightningFlash = 1.0;
        this.lightningCooldown = 5 + Math.random() * 8;
      }
    }
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 4.5);

    // Update Precipitation / Embers Particle Field
    this.updatePrecipitation(dt, playerPos, bloodMoonFactor);

    // Real BotW Temperature Calculation (Celsius & Fahrenheit + Volcanic ERROR)
    const diurnal = Math.sin(((this.timeHours - 8) / 24) * Math.PI * 2) * 0.5 + 0.5;
    let tempC = THREE.MathUtils.lerp(reg.nightTempC, reg.dayTempC, diurnal);
    // Altitude cooling lapse rate (except Eldin volcano which gets hotter higher up!)
    if (reg.climate === 'volcanic') {
      tempC += Math.max(0, playerPos.y - 50) * 0.25;
    } else {
      tempC -= Math.max(0, playerPos.y - 45) * 0.14;
    }
    if (this.weather === 'rain' || this.weather === 'thunderstorm') tempC -= 4;
    if (this.weather === 'snow' || this.weather === 'blizzard') tempC -= 10;
    if (opts.nearFire) tempC += 18;
    if (opts.holdingIceWeapon) tempC -= 10;

    // Clamp to BotW's authentic coldest extreme (-63C on Gerudo Summit night)
    tempC = Math.max(-63, Math.round(tempC));
    const tempF = Math.round((tempC * 9) / 5 + 32);

    const isVolcanicError = reg.climate === 'volcanic' && playerPos.y > 70;
    const flameHazardLevel: 0 | 1 | 2 = isVolcanicError ? (playerPos.y > 120 ? 2 : 1) : 0;
    const coldHazardLevel: 0 | 1 | 2 = tempC < -10 ? 2 : tempC < 0 ? 1 : 0;
    const heatHazardLevel: 0 | 1 | 2 = !isVolcanicError && tempC > 50 ? 2 : !isVolcanicError && tempC > 40 ? 1 : 0;

    const freezingWater = isFreezingWaterAt(playerPos.x, playerPos.z);
    const isBloodMoonCookWindow =
      (this.bloodMoonPending || this.bloodMoonActiveTimer > 0) &&
      (this.timeHours >= 23.5 || this.timeHours <= 0.25);

    return {
      timeHours: this.timeHours,
      daysElapsed: this.daysElapsed,
      weather: this.weather,
      forecast: this.forecast,
      temperatureC: tempC,
      temperatureF: tempF,
      isVolcanicError,
      coldHazardLevel,
      heatHazardLevel,
      flameHazardLevel,
      freezingWater,
      isBloodMoonRising: isBloodMoonRising || this.bloodMoonActiveTimer > 0,
      isBloodMoonCookWindow,
      bloodMoonTimerSec: this.bloodMoonTimerSec,
      windStrength,
      lightningWarning,
    };
  }

  private updatePrecipitation(dt: number, playerPos: THREE.Vector3, bloodMoonFactor: number): void {
    const isRain = this.weather === 'rain' || this.weather === 'thunderstorm' || this.weather === 'sunshower';
    const isSnow = this.weather === 'snow' || this.weather === 'blizzard';
    const isAsh = this.weather === 'volcanic_ash';
    const isSand = this.weather === 'sandstorm';
    const isBlood = bloodMoonFactor > 0.25;

    const active = isRain || isSnow || isAsh || isSand || isBlood;
    this.precipMat.opacity = active ? (isRain ? 0.58 : isSnow ? 0.78 : isBlood ? 0.72 : 0.45) : 0;
    if (!active) return;

    if (isBlood) {
      this.precipMat.color.set('#ff2a3c');
      this.precipMat.size = 0.58;
    } else if (isRain) {
      this.precipMat.color.set('#c4e4ff');
      this.precipMat.size = 0.26;
    } else if (isSnow) {
      this.precipMat.color.set('#f4fbff');
      this.precipMat.size = 0.52;
    } else if (isAsh) {
      this.precipMat.color.set('#ff7a28');
      this.precipMat.size = 0.44;
    } else {
      this.precipMat.color.set('#e5c384');
      this.precipMat.size = 0.46;
    }

    const pos = this.precipPositions;
    const count = pos.length / 3;
    const vy = isBlood ? 4.5 : isRain ? -32.0 : isSnow ? -4.8 : isAsh ? 2.2 : -1.5;
    const vx = isSand ? 22.0 : isRain ? 4.5 : 2.5;

    this.precipPoints.position.set(playerPos.x, playerPos.y - 8, playerPos.z);
    for (let i = 0; i < count; i++) {
      let x = pos[i * 3] + vx * dt;
      let y = pos[i * 3 + 1] + vy * dt;
      let z = pos[i * 3 + 2] + 1.2 * dt;

      if (y < 0) y += 48;
      if (y > 48) y -= 48;
      if (x > 45) x -= 90;
      if (x < -45) x += 90;
      if (z > 45) z -= 90;
      if (z < -45) z += 90;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    this.precipPoints.geometry.attributes.position.needsUpdate = true;
    void WORLD_BOUNDS;
  }
}
