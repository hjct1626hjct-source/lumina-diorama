import * as THREE from 'three';
import { createBotWToonMaterial } from '../rendering/BotWToonShader';
import { textureBank } from '../rendering/ProceduralTextures';
import { modelLoader } from '../rendering/ModelLoader';
import { LANDMARKS, PHYSICAL_SHRINES, REGION_LIST } from '../data/regions';
import { getTerrainHeight } from './TerrainGenerator';
import { PhysicsChemistryEngine, type PhysicsBody } from '../physics/PhysicsChemistryEngine';
import type { RegionId } from '../types/botw';

export interface WorldTower {
  regionId: RegionId;
  nameJa: string;
  position: THREE.Vector3;
  activated: boolean;
  activationProgress: number; // 0 -> 1 orange to cyan propagation wave!
  materials: THREE.MeshToonMaterial[];
  beaconLight: THREE.Mesh;
}

export interface WorldShrine {
  id: string;
  nameJa: string;
  subtitleJa: string;
  regionId: RegionId;
  category: string;
  position: THREE.Vector3;
  completed: boolean;
  activationProgress: number;
  materials: THREE.MeshToonMaterial[];
  doorGlow: THREE.Mesh;
}

export interface WorldChest {
  id: string;
  type: 'wood' | 'iron' | 'ancient';
  labelJa: string;
  rewardTextJa: string;
  rewardType: 'weapon' | 'armor' | 'rupees' | 'material' | 'arrow';
  rewardId: string;
  rewardAmount: number;
  position: THREE.Vector3;
  opened: boolean;
  openAnim: number; // 0..1
  root: THREE.Group;
  lidPivot?: THREE.Group;
  glowBeam: THREE.Mesh;
}

export interface CookingPotSpot {
  id: string;
  nameJa: string;
  position: THREE.Vector3;
  flameMesh: THREE.Mesh;
}

export interface MemorySpot {
  memoryId: string;
  titleJa: string;
  position: THREE.Vector3;
  pillarMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  collected: boolean;
}

export interface KinematicDivineBeast {
  id: string;
  nameJa: string;
  position: THREE.Vector3;
  root: THREE.Group;
  movingPart: THREE.Object3D;
  laserBeam: THREE.Mesh;
  freed: boolean;
}

/**
 * Constructs ALL iconic Hyrule architecture & landmarks across the 15 seamless regions:
 * - Hyrule Castle (5 defensive gates, moat bridges, 7 watchtowers, 5 glowing Malice pillars, Sanctum spire, Library metal bookcase)
 * - Shrine of Resurrection & Temple of Time
 * - 15 Sheikah Towers (Jomon spiral relief + orange->cyan wave propagation)
 * - 24+ Physical Open-World Shrines (Jomon relief + orange->cyan glowing constellation circuits)
 * - 4 Kinematic Divine Beasts (Vah Ruta trunk, Vah Rudania tilt, Vah Medoh seesaw wings, Vah Naboris 3 rotating humps)
 * - 9 Distinct Architectural Settlements + 15 Stables + 4 Great Fairy Fountains + 3 Goddess Springs + 3 Lomei Labyrinths + Historical Ruins
 * - Treasure Chests (CC0 GLB wood/iron + sculpted Ancient Sheikah chest with arched lid, metal straps, rivets, keyhole & light burst)
 * - Interactive Physics/Chemistry Props (stacked minecarts for Flying Machine, metal boxes, boulders, crates, cooking pots)
 */
export class ArchitectureBuilder {
  public readonly group = new THREE.Group();
  public towers: WorldTower[] = [];
  public shrines: WorldShrine[] = [];
  public chests: WorldChest[] = [];
  public cookingPots: CookingPotSpot[] = [];
  public divineBeasts: KinematicDivineBeast[] = [];
  public memorySpots: MemorySpot[] = [];

  private malicePillars: THREE.Mesh[] = [];
  private windmillBlades: THREE.Object3D[] = [];
  private physics: PhysicsChemistryEngine;

  constructor(scene: THREE.Scene, physics: PhysicsChemistryEngine) {
    this.physics = physics;
    this.group.name = 'HyruleArchitecture';
    scene.add(this.group);
  }

  buildAll(opts: {
    activatedTowers: RegionId[];
    completedShrines: string[];
    openedChests: string[];
    defeatedDivineBeasts: string[];
    unlockedMemories: string[];
    memoryLocations: Array<{ id: string; titleJa: string; x: number; z: number }>;
  }): void {
    this.buildShrineOfResurrection();
    this.buildTempleOfTime();
    this.buildHyruleCastle();
    this.buildAll15SheikahTowers(opts.activatedTowers);
    this.buildPhysicalShrines(opts.completedShrines);
    this.buildDivineBeasts(opts.defeatedDivineBeasts);
    this.buildSettlementsAndLandmarks();
    this.buildTreasureChests(opts.openedChests);
    this.buildInteractivePhysicsProps();
    this.buildMemoryBeams(opts.memoryLocations, opts.unlockedMemories);
  }

  private buildShrineOfResurrection(): void {
    const x = -305;
    const z = 455;
    const y = getTerrainHeight(x, z);
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    const shTex = textureBank.getSheikahStoneTexture();
    const stoneMat = createBotWToonMaterial({
      color: '#505868',
      map: shTex.map,
      normalMap: shTex.normalMap,
      emissive: '#22ddff',
      emissiveMap: shTex.emissiveMap,
      emissiveIntensity: 1.4,
      sheikahCircuit: true,
      sheikahActivated: 1.0,
      sheikahHeight: 8.0,
    });

    // Cave arch portal opening out onto the iconic Great Plateau cliff vista!
    const arch = new THREE.Mesh(new THREE.TorusGeometry(4.2, 1.35, 10, 20, Math.PI), stoneMat);
    arch.position.set(0, 0.2, 0);
    arch.rotation.y = Math.PI * 0.28;
    arch.castShadow = true;
    arch.receiveShadow = true;
    grp.add(arch);

    // Ancient Sheikah Resurrection Pedestal inside entrance
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.9, 8), stoneMat);
    pedestal.position.set(-2.5, 0.45, 2.2);
    grp.add(pedestal);

    // Flank glowing Sheikah lantern pillars grounded strictly to local hillside height!
    for (const side of [-1, 1]) {
      const glbPillar = modelLoader.instantiate('pillar', { scaleMultiplier: 1.0 });
      if (glbPillar) {
        const px = side * 4.4;
        const pz = side * -1.8;
        const localY = getTerrainHeight(x + px, z + pz) - y - 0.55;
        glbPillar.root.position.set(px, localY, pz);
        grp.add(glbPillar.root);
      }
    }

    this.group.add(grp);
  }

  private buildTempleOfTime(): void {
    const x = -245;
    const z = 495;
    const y = getTerrainHeight(x, z);
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    const masonry = textureBank.getStoneMasonryTexture('#b8b09c', '#5b7e44');
    const stoneMat = createBotWToonMaterial({
      color: '#ffffff',
      map: masonry.map,
      normalMap: masonry.normalMap,
      rimStrength: 0.34,
    });
    const roofMat = createBotWToonMaterial({
      color: '#4e6c78',
      map: textureBank.getStoneMasonryTexture('#5c7b88', '#466844').map,
      rimStrength: 0.38,
    });
    const goldMat = createBotWToonMaterial({ color: '#e8c45e', metalHighlight: true });

    // Raised stone sanctuary foundation steps
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(22, 2.2, 30), stoneMat);
    plinth.position.y = 1.1;
    plinth.receiveShadow = true;
    grp.add(plinth);

    // Iconic weathered nave side walls & broken gothic arches
    for (const sx of [-9.2, 9.2]) {
      for (let i = -2; i <= 2; i++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 11.5, 10), stoneMat);
        col.position.set(sx, 6.8, i * 5.2);
        col.castShadow = true;
        grp.add(col);
      }
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6.5, 25), stoneMat);
      wall.position.set(sx, 5.2, 0);
      wall.castShadow = true;
      grp.add(wall);
    }

    // Grand Front Facade & Bell Tower Spire (iconic Great Plateau silhouette!)
    const facade = new THREE.Mesh(new THREE.BoxGeometry(20, 12.5, 2.6), stoneMat);
    facade.position.set(0, 7.6, -13.2);
    facade.castShadow = true;
    grp.add(facade);

    const gable = new THREE.Mesh(new THREE.ConeGeometry(13.5, 8.5, 4), roofMat);
    gable.rotation.y = Math.PI / 4;
    gable.position.set(0, 17.5, -12.5);
    gable.scale.set(1.05, 1, 0.38);
    grp.add(gable);

    const bellTower = new THREE.Mesh(new THREE.BoxGeometry(7.2, 16, 7.2), stoneMat);
    bellTower.position.set(0, 18.5, -8.2);
    bellTower.castShadow = true;
    grp.add(bellTower);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(5.6, 13.5, 4), roofMat);
    spire.rotation.y = Math.PI / 4;
    spire.position.set(0, 32.5, -8.2);
    spire.castShadow = true;
    grp.add(spire);

    // Goddess Hylia Statue at inner altar (pray to exchange 4 Spirit Orbs for Heart/Stamina!)
    const goddessBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.2, 8), stoneMat);
    goddessBase.position.set(0, 2.8, 9.5);
    const goddessBody = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.1, 3.6, 10), stoneMat);
    goddessBody.position.set(0, 5.1, 9.5);
    const goddessWings = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 0.3), goldMat);
    goddessWings.position.set(0, 5.6, 10.1);
    const goddessHead = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), stoneMat);
    goddessHead.position.set(0, 7.2, 9.5);
    grp.add(goddessBase, goddessBody, goddessWings, goddessHead);

    // Add CC0 GLB arches & rubble around Temple ruins for extra architectural richness
    for (const [rx, rz, ry] of [[-12, -16, 0.3], [13, -14, -0.5], [12, 10, 1.2]]) {
      const rub = modelLoader.instantiate('rubble', { scaleMultiplier: 1.5 });
      if (rub) {
        rub.root.position.set(rx, 0, rz);
        rub.root.rotation.y = ry;
        grp.add(rub.root);
      }
    }

    // Campfire & Cooking Pot outside Temple of Time (Old Man's classic camp!)
    this.addCookingPot(x + 19, z - 16, '時の神殿跡の焚き火');

    this.group.add(grp);
  }

  /**
   * Hyrule Castle: Western Gothic Spires x Japanese Castle 5-Stage Defensive Layout +
   * 7 Watchtowers + 5 Giant Glowing Sheikah/Malice Pillars + Library Metal Bookcase!
   */
  private buildHyruleCastle(): void {
    const cx = -80;
    const cz = -260;
    const baseY = getTerrainHeight(cx, cz);
    const grp = new THREE.Group();
    grp.position.set(cx, 0, cz);

    const castleStone = textureBank.getStoneMasonryTexture('#8d8b92', '#4a5c44');
    const wallMat = createBotWToonMaterial({
      color: '#ffffff',
      map: castleStone.map,
      normalMap: castleStone.normalMap,
      rimStrength: 0.36,
    });
    const spireMat = createBotWToonMaterial({
      color: '#2e456e',
      map: castleStone.map,
      rimStrength: 0.48,
      rimTint: '#9ac6ff',
    });
    const maliceMat = createBotWToonMaterial({
      color: '#2e0b1e',
      emissive: '#e8185a',
      emissiveIntensity: 1.45,
      rimStrength: 0.65,
      rimTint: '#ff427a',
    });

    // Central Sanctum Citadel Keep (visible across ALL 15 Hyrule regions!)
    const sanctumBase = new THREE.Mesh(new THREE.CylinderGeometry(24, 34, 38, 12), wallMat);
    sanctumBase.position.y = baseY + 14;
    sanctumBase.castShadow = true;
    grp.add(sanctumBase);

    const mainKeep = new THREE.Mesh(new THREE.CylinderGeometry(14, 19, 44, 10), wallMat);
    mainKeep.position.y = baseY + 50;
    mainKeep.castShadow = true;
    grp.add(mainKeep);

    const centralSpire = new THREE.Mesh(new THREE.ConeGeometry(16, 48, 8), spireMat);
    centralSpire.position.y = baseY + 95;
    centralSpire.castShadow = true;
    grp.add(centralSpire);

    // 4 Flanking Gothic Turrets (West Wing = Zelda's Study & Tower, North = Docks, East = Guard's Chamber)
    const turrets = [
      { dx: -28, dz: -8, h: 52, r: 7.5 }, // Zelda's Study Tower (West Wing)
      { dx: 28, dz: -8, h: 48, r: 7.5 },
      { dx: -20, dz: 24, h: 42, r: 6.5 },
      { dx: 20, dz: 24, h: 42, r: 6.5 },
    ];
    for (const t of turrets) {
      const ty = getTerrainHeight(cx + t.dx, cz + t.dz);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.85, t.r, t.h, 8), wallMat);
      body.position.set(t.dx, ty + t.h * 0.5 - 4, t.dz);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(t.r * 1.15, 22, 8), spireMat);
      roof.position.set(t.dx, ty + t.h + 6, t.dz);
      grp.add(body, roof);
    }

    // 7 Outer Perimeter Watchtowers + 5-Stage Defensive Gatehouse Wall Ring
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.35;
      const wx = Math.cos(a) * 92;
      const wz = Math.sin(a) * 92;
      const wy = getTerrainHeight(cx + wx, cz + wz);
      const wt = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.6, 26, 8), wallMat);
      wt.position.set(wx, wy + 12, wz);
      const wr = new THREE.Mesh(new THREE.ConeGeometry(6.2, 11, 8), spireMat);
      wr.position.set(wx, wy + 29, wz);
      grp.add(wt, wr);
    }

    // South Main Gatehouse Bridge Entrance (Stage 1 of 5-stage Japanese castle defense) with battlements!
    const gateY = getTerrainHeight(cx, cz + 112) - 2.0;
    const gateL = new THREE.Mesh(new THREE.BoxGeometry(7.2, 24, 10), wallMat);
    gateL.position.set(-10, gateY + 12, 112);
    const gateR = gateL.clone();
    gateR.position.x = 10;
    const gateArch = new THREE.Mesh(new THREE.BoxGeometry(27.5, 7.5, 10.4), wallMat);
    gateArch.position.set(0, gateY + 21.5, 112);
    grp.add(gateL, gateR, gateArch);
    // Stone crenellation merlons atop gatehouse parapet
    for (let mx = -12; mx <= 12; mx += 4) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 2.0), wallMat);
      merlon.position.set(mx, gateY + 26.4, 116.2);
      grp.add(merlon);
    }

    // 5 Iconic Giant Sheikah/Malice Pillars angled dramatically around Hyrule Castle (sunk deep -22m so zero ground gap!)
    const shTex = textureBank.getSheikahStoneTexture();
    const pillarMat = createBotWToonMaterial({
      color: '#423b4a',
      map: shTex.map,
      emissive: '#e61858',
      emissiveMap: shTex.emissiveMap,
      emissiveIntensity: 1.7,
      rimStrength: 0.55,
      rimTint: '#ff427a',
    });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.25;
      const px = Math.cos(a) * 68;
      const pz = Math.sin(a) * 68;
      const py = getTerrainHeight(cx + px, cz + pz);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 6.8, 162, 10), pillarMat);
      pillar.position.set(px, py + 48, pz);
      pillar.rotation.z = Math.cos(a) * 0.24;
      pillar.rotation.x = -Math.sin(a) * 0.24;
      grp.add(pillar);
      this.malicePillars.push(pillar);
    }

    // Swirling Calamity Ganon Malice Halo orbiting Sanctum spire!
    const maliceHalo = new THREE.Mesh(new THREE.TorusGeometry(28, 3.2, 10, 28), maliceMat);
    maliceHalo.rotation.x = Math.PI / 2 + 0.2;
    maliceHalo.position.set(0, baseY + 86, 0);
    grp.add(maliceHalo);
    this.malicePillars.push(maliceHalo);

    this.group.add(grp);
  }

  /**
   * Builds ALL 15 Sheikah Towers across Hyrule with authentic Jomon spiral filigree
   * and orange (unactivated) -> cyan (activated) glowing circuit wave propagation!
   */
  private buildAll15SheikahTowers(activatedIds: RegionId[]): void {
    const shTex = textureBank.getSheikahStoneTexture();

    for (const reg of REGION_LIST) {
      const tx = reg.towerPos.x;
      const tz = reg.towerPos.z;
      const ty = getTerrainHeight(tx, tz);
      const isAct = activatedIds.includes(reg.id);

      const grp = new THREE.Group();
      grp.position.set(tx, ty - 2.2, tz);

      const towerMat = createBotWToonMaterial({
        color: '#566072',
        map: shTex.map,
        normalMap: shTex.normalMap,
        emissive: '#ffffff',
        emissiveMap: shTex.emissiveMap,
        emissiveIntensity: 1.65,
        sheikahCircuit: true,
        sheikahActivated: isAct ? 1.0 : 0.0,
        sheikahHeight: 54.0,
        rimStrength: 0.45,
      });

      // Flared base -> fluted column -> iconic flared Jomon top crown platform!
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 4.6, 52, 10), towerMat);
      shaft.position.y = 26;
      shaft.castShadow = true;
      grp.add(shaft);

      // 4 Mid-tower resting platforms (for authentic climbing breathers!)
      for (let lvl = 1; lvl <= 4; lvl++) {
        const ledge = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 4.2, 1.1, 8), towerMat);
        ledge.position.y = lvl * 10.5;
        grp.add(ledge);
      }

      // Summit Observatory Crown & Glowing Sheikah Eye Beacon
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 3.8, 4.5, 10), towerMat);
      crown.position.y = 53;
      grp.add(crown);

      const beaconMat = new THREE.MeshBasicMaterial({ color: isAct ? '#2ce8ff' : '#ff841a' });
      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 1), beaconMat);
      beacon.position.y = 59.5;
      grp.add(beacon);

      this.group.add(grp);
      this.towers.push({
        regionId: reg.id,
        nameJa: `${reg.nameJa}の塔`,
        position: new THREE.Vector3(tx, ty, tz),
        activated: isAct,
        activationProgress: isAct ? 1 : 0,
        materials: [towerMat],
        beaconLight: beacon,
      });
    }
  }

  /**
   * Builds detailed Ancient Sheikah Shrines with Jomon sculpted crown reliefs,
   * glowing orange->cyan constellation circuits, and recessed stone entry portico!
   */
  private buildPhysicalShrines(completedIds: string[]): void {
    const shTex = textureBank.getSheikahStoneTexture();

    for (const sh of PHYSICAL_SHRINES) {
      const sy = getTerrainHeight(sh.x, sh.z);
      const isComp = completedIds.includes(sh.id);

      const grp = new THREE.Group();
      grp.position.set(sh.x, sy - 0.65, sh.z);

      const mat = createBotWToonMaterial({
        color: '#586274',
        map: shTex.map,
        normalMap: shTex.normalMap,
        emissive: '#ffffff',
        emissiveMap: shTex.emissiveMap,
        emissiveIntensity: 1.75,
        sheikahCircuit: true,
        sheikahActivated: isComp ? 1.0 : 0.0,
        sheikahHeight: 11.0,
        rimStrength: 0.48,
      });

      // Stepped octagonal foundation plinth
      const base = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.6, 1.5, 8), mat);
      base.position.y = 0.75;
      base.receiveShadow = true;
      grp.add(base);

      // Iconic curved tapered Sheikah Shrine monolithic body (LatheGeometry!)
      const pts = [
        new THREE.Vector2(4.6, 1.0),
        new THREE.Vector2(4.2, 3.6),
        new THREE.Vector2(3.2, 6.8),
        new THREE.Vector2(3.8, 8.6),
        new THREE.Vector2(2.6, 10.6),
        new THREE.Vector2(0.4, 11.4),
      ];
      const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), mat);
      body.castShadow = true;
      body.receiveShadow = true;
      grp.add(body);

      // 4 Sculpted Jomon spiral crown horns protruding around upper rim!
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const horn = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.32, 8, 12, Math.PI * 1.35), mat);
        horn.position.set(Math.cos(a) * 3.1, 8.8, Math.sin(a) * 3.1);
        horn.rotation.y = -a;
        horn.rotation.z = 0.45;
        grp.add(horn);
      }

      // Carved stone entry portico framing the recessed glowing Sheikah Door (ZERO protruding box!)
      const portico = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.3, 1.9), mat);
      portico.position.set(0, 2.95, 3.6);
      portico.castShadow = true;
      grp.add(portico);

      const doorMat = new THREE.MeshBasicMaterial({ color: isComp ? '#28ecff' : '#ff8620' });
      const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.3, 0.25), doorMat);
      doorGlow.position.set(0, 2.75, 4.50);
      grp.add(doorGlow);

      const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.4, 6), mat);
      terminal.position.set(0, 1.4, 5.55);
      grp.add(terminal);

      this.group.add(grp);
      this.shrines.push({
        id: sh.id,
        nameJa: sh.nameJa,
        subtitleJa: sh.subtitleJa,
        regionId: sh.region,
        category: sh.category,
        position: new THREE.Vector3(sh.x, sy, sh.z),
        completed: isComp,
        activationProgress: isComp ? 1 : 0,
        materials: [mat],
        doorGlow,
      });
    }
  }

  /**
   * Builds all 4 Kinematic Movable Divine Beasts visible from miles away!
   * - Vah Ruta: Elephant with articulated water-spouting trunk
   * - Vah Rudania: Lizard perched on Death Mountain crater with tilting body
   * - Vah Medoh: Colossal gliding Eagle circling Rito Village sky with seesaw wings
   * - Vah Naboris: Giant Camel striding across Gerudo Desert with 3 rotating cylindrical humps
   */
  private buildDivineBeasts(defeatedIds: string[]): void {
    const shTex = textureBank.getSheikahStoneTexture();

    for (const lm of LANDMARKS.filter((l) => l.type === 'divine_beast')) {
      const freed = defeatedIds.includes(lm.id);
      const by = getTerrainHeight(lm.x, lm.z);
      const grp = new THREE.Group();
      grp.position.set(lm.x, lm.id === 'vah_medoh' ? by + 95 : by + 6, lm.z);

      const mat = createBotWToonMaterial({
        color: '#4a4f5a',
        map: shTex.map,
        normalMap: shTex.normalMap,
        emissive: freed ? '#20e8ff' : '#ff2255',
        emissiveMap: shTex.emissiveMap,
        emissiveIntensity: 1.5,
        rimStrength: 0.48,
      });

      const movingPart = new THREE.Group();

      if (lm.id === 'vah_ruta') {
        const torso = new THREE.Mesh(new THREE.BoxGeometry(24, 18, 32), mat);
        torso.position.y = 14;
        grp.add(torso);
        for (const [lx, lz] of [[-9, -11], [9, -11], [-9, 11], [9, 11]]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.0, 18, 8), mat);
          leg.position.set(lx, 5, lz);
          grp.add(leg);
        }
        // Articulated Trunk
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.6, 26, 8), mat);
        trunk.position.set(0, 12, 10);
        trunk.rotation.x = 0.65;
        movingPart.position.set(0, 18, 14);
        movingPart.add(trunk);
        grp.add(movingPart);
      } else if (lm.id === 'vah_rudania') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 40), mat);
        body.position.y = 10;
        const tail = new THREE.Mesh(new THREE.ConeGeometry(5, 24, 6), mat);
        tail.rotation.x = -Math.PI / 2;
        tail.position.set(0, 10, -30);
        movingPart.add(body, tail);
        grp.add(movingPart);
      } else if (lm.id === 'vah_medoh') {
        const fuselage = new THREE.Mesh(new THREE.ConeGeometry(8, 38, 6), mat);
        fuselage.rotation.x = Math.PI / 2;
        const wings = new THREE.Mesh(new THREE.BoxGeometry(68, 3.2, 16), mat);
        movingPart.add(fuselage, wings);
        grp.add(movingPart);
      } else {
        // Vah Naboris with 3 rotating cylindrical central humps!
        const body = new THREE.Mesh(new THREE.BoxGeometry(16, 14, 38), mat);
        body.position.y = 22;
        grp.add(body);
        for (const [lx, lz] of [[-7, -14], [7, -14], [-7, 14], [7, 14]]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 28, 8), mat);
          leg.position.set(lx, 10, lz);
          grp.add(leg);
        }
        for (let h = -1; h <= 1; h++) {
          const cyl = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 8.5, 12), mat);
          cyl.rotation.x = Math.PI / 2;
          cyl.position.set(0, 22, h * 9.5);
          movingPart.add(cyl);
        }
        grp.add(movingPart);
      }

      // Red Aiming Laser pointing straight at Hyrule Castle Sanctum once freed!
      const castleTarget = new THREE.Vector3(-80, 145, -260);
      const beamDist = grp.position.distanceTo(castleTarget);
      const laserGeo = new THREE.CylinderGeometry(0.45, 0.45, beamDist, 6);
      laserGeo.rotateX(Math.PI / 2);
      laserGeo.translate(0, 0, beamDist * 0.5);
      const laserBeam = new THREE.Mesh(
        laserGeo,
        new THREE.MeshBasicMaterial({ color: '#ff3458', transparent: true, opacity: freed ? 0.65 : 0 })
      );
      laserBeam.position.y = 24;
      laserBeam.lookAt(castleTarget);
      grp.add(laserBeam);

      this.group.add(grp);
      this.divineBeasts.push({
        id: lm.id,
        nameJa: lm.nameJa,
        position: grp.position.clone(),
        root: grp,
        movingPart,
        laserBeam,
        freed,
      });
    }
  }

  /**
   * Builds all 9 Architectural Settlements (each with its authentic BotW architectural language!),
   * 15 Stables (12-bay circus tents + horse-head roof), 4 Great Fairy Fountains, 3 Goddess Springs,
   * 3 Lomei Labyrinths, Ancient Labs, and Historical Ruins!
   */
  private buildSettlementsAndLandmarks(): void {
    const woodTex = textureBank.getWoodPlankTexture('#7b5234');
    const stoneTex = textureBank.getStoneMasonryTexture('#a89e8c', '#5c7c48');

    for (const lm of LANDMARKS) {
      if (lm.type === 'castle' || lm.type === 'divine_beast' || lm.type === 'resurrection' || lm.type === 'temple_of_time') {
        continue;
      }
      const ly = getTerrainHeight(lm.x, lm.z);
      const grp = new THREE.Group();
      grp.position.set(lm.x, ly, lm.z);

      if (lm.type === 'stable') {
        // Iconic BotW Stable: 12-bay striped circus tent + giant wooden horse-head roof finial + cooking pot!
        const tentMat = createBotWToonMaterial({
          color: '#d9c598',
          map: textureBank.getFabricTexture('#e2cca0', '#2b7a48', 'weave').map,
          rimStrength: 0.35,
        });
        const roofMat = createBotWToonMaterial({ color: '#2b6f45', map: woodTex.map });
        const tent = new THREE.Mesh(new THREE.ConeGeometry(10.5, 11, 12), tentMat);
        tent.position.y = 7.5;
        tent.castShadow = true;
        const baseWall = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 9.2, 4.2, 12), createBotWToonMaterial({ color: '#7a5234', map: woodTex.map }));
        baseWall.position.y = 2.1;
        // Horse-head finial silhouette at tent summit
        const horseHead = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.2, 6), roofMat);
        horseHead.position.set(0, 14.5, 1.5);
        horseHead.rotation.x = 0.72;
        grp.add(baseWall, tent, horseHead);
        this.addCookingPot(lm.x + 11, lm.z + 6, `${lm.nameJa}の料理鍋`);
      } else if (lm.type === 'great_fairy') {
        // Giant Giant-Lotus Great Fairy Bud emerging from shimmering sacred spring!
        const budMat = createBotWToonMaterial({ color: '#e85a9c', emissive: '#a82268', emissiveIntensity: 0.35, rimStrength: 0.55 });
        const poolMat = createBotWToonMaterial({ color: '#4ee6f5', emissive: '#18b8d8', emissiveIntensity: 0.5 });
        const pool = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.0, 0.5, 18), poolMat);
        pool.position.y = 0.25;
        grp.add(pool);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7.2, 6), budMat);
          petal.position.set(Math.cos(a) * 3.0, 3.6, Math.sin(a) * 3.0);
          petal.rotation.z = -Math.cos(a) * 0.42;
          petal.rotation.x = Math.sin(a) * 0.42;
          grp.add(petal);
        }
      } else if (lm.type === 'spring') {
        // 3 Goddess Springs (Wisdom / Power / Courage)
        const sMat = createBotWToonMaterial({ color: '#9ab0be', map: stoneTex.map });
        const basin = new THREE.Mesh(new THREE.TorusGeometry(10, 1.8, 8, 20), sMat);
        basin.rotation.x = Math.PI / 2;
        basin.position.y = 1.2;
        const statue = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.6, 6.0, 8), sMat);
        statue.position.set(0, 3.5, -5);
        grp.add(basin, statue);
      } else if (lm.type === 'labyrinth') {
        // Monumental Stone Lomei Labyrinth outer & inner concentric maze walls
        const lMat = createBotWToonMaterial({ color: '#5c5952', map: stoneTex.map, normalMap: stoneTex.normalMap });
        for (const [wx, wz, sx, sz] of [
          [0, -28, 56, 3], [0, 28, 56, 3], [-28, 0, 3, 56], [28, 0, 3, 56],
          [-12, -12, 26, 3], [12, 12, 26, 3], [-12, 14, 3, 24], [14, -12, 3, 24],
        ]) {
          const w = new THREE.Mesh(new THREE.BoxGeometry(sx, 14, sz), lMat);
          w.position.set(wx, 7, wz);
          w.castShadow = true;
          grp.add(w);
        }
      } else if (lm.type === 'lab') {
        // Ancient Tech Lab with glowing blue furnace & rooftop telescope!
        const labMat = createBotWToonMaterial({ color: '#c8b896', map: stoneTex.map });
        const blueFlame = createBotWToonMaterial({ color: '#2ae8ff', emissive: '#1ad0ff', emissiveIntensity: 1.8 });
        const hall = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.5, 8.5, 10), labMat);
        hall.position.y = 4.25;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(8.6, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), createBotWToonMaterial({ color: '#4a5568' }));
        dome.position.y = 8.4;
        const furnace = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.8, 3.2, 8), blueFlame);
        furnace.position.set(11, 1.6, 4);
        grp.add(hall, dome, furnace);
      } else if (lm.style === 'kakariko') {
        // Kakariko Village: Japanese chigi thatched gables, consecutive red torii gates, Impa's manor!
        const roofMat = createBotWToonMaterial({ color: '#586246', map: woodTex.map });
        const wallMat = createBotWToonMaterial({ color: '#e8e0cc', map: stoneTex.map });
        const toriiMat = createBotWToonMaterial({ color: '#c43628' });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const r = i === 0 ? 0 : 28;
          const hx = Math.cos(a) * r;
          const hz = Math.sin(a) * r;
          const scale = i === 0 ? 1.55 : 0.95;
          const house = new THREE.Mesh(new THREE.BoxGeometry(7.5 * scale, 4.5 * scale, 6.5 * scale), wallMat);
          house.position.set(hx, 2.25 * scale, hz);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(6.5 * scale, 4.6 * scale, 4), roofMat);
          roof.rotation.y = Math.PI / 4;
          roof.position.set(hx, 6.2 * scale, hz);
          grp.add(house, roof);
        }
        // Consecutive Shinto Torii Gates along village approach
        for (let t = 0; t < 3; t++) {
          const tz = 18 + t * 9;
          const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 6.2, 8), toriiMat);
          pL.position.set(-3.2, 3.1, tz);
          const pR = pL.clone();
          pR.position.x = 3.2;
          const bar = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.65, 0.7), toriiMat);
          bar.position.set(0, 5.9, tz);
          grp.add(pL, pR, bar);
        }
        this.addCookingPot(lm.x + 12, lm.z + 10, 'カカリコ村の料理鍋');
      } else if (lm.style === 'hateno') {
        // Hateno Village: European stucco + masonry + cloth-sail windmills + Link's House + Kochi Dye Shop!
        const stucco = createBotWToonMaterial({ color: '#e8dfce', map: stoneTex.map });
        const tileRoof = createBotWToonMaterial({ color: '#9c4c36', map: woodTex.map });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const hx = Math.cos(a) * 32;
          const hz = Math.sin(a) * 32;
          const h = new THREE.Mesh(new THREE.BoxGeometry(8.5, 5.5, 7.2), stucco);
          h.position.set(hx, 2.75, hz);
          const r = new THREE.Mesh(new THREE.ConeGeometry(6.6, 4.0, 4), i === 1 ? createBotWToonMaterial({ color: '#3b82c4' }) : tileRoof);
          r.rotation.y = Math.PI / 4;
          r.position.set(hx, 7.2, hz);
          grp.add(h, r);
        }
        // Iconic Hateno Cloth-Sail Windmill!
        const millTower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, 16, 10), stucco);
        millTower.position.set(0, 8, -10);
        const hub = new THREE.Group();
        hub.position.set(0, 13.5, -7.0);
        const sailMat = createBotWToonMaterial({ color: '#f2e8d0', side: THREE.DoubleSide });
        for (let s = 0; s < 4; s++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 7.5, 0.12), sailMat);
          blade.rotation.z = (s * Math.PI) / 2;
          blade.position.set(Math.sin((s * Math.PI) / 2) * 3.8, Math.cos((s * Math.PI) / 2) * 3.8, 0);
          hub.add(blade);
        }
        this.windmillBlades.push(hub);
        grp.add(millTower, hub);
        this.addCookingPot(lm.x + 8, lm.z + 8, 'ハテノ村の料理鍋');
      } else if (lm.style === 'zora') {
        // Zora's Domain: Art Nouveau luminous cyan-silver sculpted curving spires!
        const zoraMat = createBotWToonMaterial({
          color: '#7cc4de',
          emissive: '#1e88b0',
          emissiveIntensity: 0.45,
          metalHighlight: true,
          rimStrength: 0.6,
        });
        const palace = new THREE.Mesh(new THREE.CylinderGeometry(16, 22, 12, 14), zoraMat);
        palace.position.y = 6;
        const whaleArch = new THREE.Mesh(new THREE.TorusGeometry(20, 2.4, 10, 24, Math.PI), zoraMat);
        whaleArch.position.y = 14;
        const miphaStatue = new THREE.Mesh(new THREE.ConeGeometry(2.8, 10, 8), createBotWToonMaterial({ color: '#d8e8f5', metalHighlight: true }));
        miphaStatue.position.set(0, 16, 0);
        grp.add(palace, whaleArch, miphaStatue);
        this.addCookingPot(lm.x + 15, lm.z + 18, 'ゾーラの里の料理鍋');
      } else if (lm.style === 'gerudo') {
        // Gerudo Town: Warm sandstone adobe walls + palace dome + rooftop evaporative cooling channels!
        const adobe = createBotWToonMaterial({ color: '#d8ab72', map: stoneTex.map });
        const teal = createBotWToonMaterial({ color: '#2ea8a4', emissive: '#126468', emissiveIntensity: 0.25 });
        const palace = new THREE.Mesh(new THREE.BoxGeometry(24, 13, 18), adobe);
        palace.position.set(0, 6.5, -18);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), teal);
        dome.position.set(0, 13, -18);
        // Perimeter desert sandstone fortification walls
        for (const [wx, wz, sx, sz] of [[-32, 0, 4, 60], [32, 0, 4, 60], [0, -32, 68, 4]]) {
          const w = new THREE.Mesh(new THREE.BoxGeometry(sx, 11, sz), adobe);
          w.position.set(wx, 5.5, wz);
          grp.add(w);
        }
        grp.add(palace, dome);
        this.addCookingPot(lm.x + 12, lm.z + 14, 'ゲルドの街の料理鍋');
      } else if (lm.style === 'rito') {
        // Rito Village: Spiral wooden boardwalk & suspended basket houses around central Totori spire!
        const woodMat = createBotWToonMaterial({ color: '#8a603e', map: woodTex.map });
        const clothMat = createBotWToonMaterial({ color: '#3b82a6', map: textureBank.getFabricTexture('#3b82a6', '#e6c05a', 'weave').map });
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05;
          const h = 4 + i * 5.2;
          const hut = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.0, 4.5, 8), woodMat);
          hut.position.set(Math.cos(a) * 18, h, Math.sin(a) * 18);
          const cap = new THREE.Mesh(new THREE.ConeGeometry(5.0, 3.5, 8), clothMat);
          cap.position.set(Math.cos(a) * 18, h + 3.8, Math.sin(a) * 18);
          grp.add(hut, cap);
        }
        this.addCookingPot(lm.x + 14, lm.z + 10, 'リトの村の料理鍋');
      } else if (lm.style === 'goron') {
        // Goron City: Volcanic basalt domes + heavy steel girders!
        const basalt = createBotWToonMaterial({ color: '#5a4a44', map: textureBank.getVolcanicTexture().map });
        const iron = createBotWToonMaterial({ color: '#646e78', metalHighlight: true });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const dome = new THREE.Mesh(new THREE.SphereGeometry(7.2, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), basalt);
          dome.position.set(Math.cos(a) * 24, 0, Math.sin(a) * 24);
          const arch = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.7, 6, 12, Math.PI), iron);
          arch.position.set(Math.cos(a) * 24, 0, Math.sin(a) * 24);
          grp.add(dome, arch);
        }
        this.addCookingPot(lm.x + 6, lm.z + 12, 'ゴロンシティの料理鍋');
      } else if (lm.style === 'tarrey') {
        // Tarrey Town: Bolson Construction colorful hexagonal modular prefab homes + central Rupee pond!
        const hexColors = ['#e05848', '#48a4d8', '#e8b842', '#5cb85c', '#c868d4', '#f08a42'];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const mod = new THREE.Mesh(
            new THREE.CylinderGeometry(4.6, 4.6, 4.6, 6),
            createBotWToonMaterial({ color: hexColors[i], map: woodTex.map })
          );
          mod.position.set(Math.cos(a) * 22, 2.3, Math.sin(a) * 22);
          grp.add(mod);
        }
        const pond = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.4, 6), createBotWToonMaterial({ color: '#3bc4e8' }));
        pond.position.y = 0.2;
        grp.add(pond);
      } else if (lm.style === 'korok') {
        // Korok Forest: Colossal Great Deku Tree + Master Sword Pedestal!
        const bark = createBotWToonMaterial({ color: '#6b4d34', map: textureBank.getFoliageBarkTexture().map });
        const leaves = createBotWToonMaterial({ color: '#4cb848', map: textureBank.getGrassTexture().map, rimStrength: 0.45 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(12, 18, 34, 12), bark);
        trunk.position.set(0, 17, -20);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(26, 2), leaves);
        crown.position.set(0, 44, -20);
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 1.2, 8), createBotWToonMaterial({ color: '#9ca8b0', map: stoneTex.map }));
        pedestal.position.set(0, 0.6, 8);
        // Glowing Master Sword waiting in the stone pedestal!
        const swordBlade = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 2.2, 0.06),
          createBotWToonMaterial({ color: '#b8f2ff', emissive: '#22d4ff', emissiveIntensity: 1.2, metalHighlight: true })
        );
        swordBlade.position.set(0, 2.0, 8);
        grp.add(trunk, crown, pedestal, swordBlade);
      } else {
        // Lurelin Stilt Huts / Bazaar / Historical Ruins (Fort Hateno, Akkala Citadel, Forgotten Temple)
        const ruinMat = createBotWToonMaterial({ color: '#8e887e', map: stoneTex.map, normalMap: stoneTex.normalMap });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const col = new THREE.Mesh(new THREE.BoxGeometry(5.5, 8 + (i % 2) * 4, 2.2), ruinMat);
          col.position.set(Math.cos(a) * 14, 4, Math.sin(a) * 14);
          col.rotation.y = a;
          grp.add(col);
        }
      }

      this.group.add(grp);
    }
  }

  private addCookingPot(x: number, z: number, nameJa: string): void {
    const y = getTerrainHeight(x, z);
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    const ironMat = createBotWToonMaterial({ color: '#383d46', metalHighlight: true });
    const woodMat = createBotWToonMaterial({ color: '#6b4528', map: textureBank.getWoodPlankTexture().map });

    // Wide shallow BotW iron cooking wok + stone fire ring + glowing embers
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.24, 6, 10), createBotWToonMaterial({ color: '#7a756c' }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.72, 0.65, 14), ironMat);
    pot.position.y = 1.05;
    // Wooden tripod posts
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 2.1, 6), woodMat);
      leg.position.set(Math.cos(a) * 0.95, 0.95, Math.sin(a) * 0.95);
      leg.rotation.z = Math.cos(a) * 0.25;
      leg.rotation.x = -Math.sin(a) * 0.25;
      grp.add(leg);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 0.95, 7),
      new THREE.MeshBasicMaterial({ color: '#ff7b1c', transparent: true, opacity: 0.92 })
    );
    flame.position.y = 0.48;
    grp.add(ring, pot, flame);
    this.group.add(grp);

    this.cookingPots.push({
      id: `pot_${x}_${z}`,
      nameJa,
      position: new THREE.Vector3(x, y, z),
      flameMesh: flame,
    });
  }

  /**
   * Builds detailed Treasure Chests across Hyrule:
   * - Wooden & Royal/Iron chests use downloaded CC0 GLBs (`chest_wood.glb`, `chest_gold.glb`)
   *   normalized via ModelLoader + BotW toon shader
   * - Ancient Sheikah Chests feature arched opening lids, metal bands, corner rivets, glowing keyhole emblem & light burst!
   */
  private buildTreasureChests(openedIds: string[]): void {
    const chestSpecs: Array<{
      id: string;
      type: 'wood' | 'iron' | 'ancient';
      x: number;
      z: number;
      rewardTextJa: string;
      rewardType: WorldChest['rewardType'];
      rewardId: string;
      rewardAmount: number;
    }> = [
      // Right near Great Plateau start & Shrine of Resurrection -> Oman Au Shrine path (great for visual inspection!)
      { id: 'chest_plateau_ancient', type: 'ancient', x: -232, z: 432, rewardTextJa: '英傑の服 (Champion\'s Tunic) / コハク ×3', rewardType: 'material', rewardId: 'amber', rewardAmount: 3 },
      { id: 'chest_plateau_wood', type: 'wood', x: -292, z: 452, rewardTextJa: '旅人の剣 ＆ 木の矢 ×10', rewardType: 'arrow', rewardId: 'normal', rewardAmount: 10 },
      { id: 'chest_temple_gold', type: 'iron', x: -242, z: 486, rewardTextJa: '銀ルピー (100ルピー)', rewardType: 'rupees', rewardId: 'rupee', rewardAmount: 100 },
      { id: 'chest_kakariko', type: 'wood', x: 438, z: 274, rewardTextJa: '古代のコア ×2', rewardType: 'material', rewardId: 'ancient_core', rewardAmount: 2 },
      { id: 'chest_hyrule_castle', type: 'iron', x: -72, z: -158, rewardTextJa: 'ハイリアの盾 ＆ 金ルピー (300ルピー)', rewardType: 'rupees', rewardId: 'rupee', rewardAmount: 300 },
      { id: 'chest_hateno', type: 'wood', x: 966, z: 590, rewardTextJa: '星のかけら ×1', rewardType: 'material', rewardId: 'star_fragment', rewardAmount: 1 },
      { id: 'chest_zora', type: 'ancient', x: 952, z: -120, rewardTextJa: 'オパール ×3', rewardType: 'material', rewardId: 'opal', rewardAmount: 3 },
      { id: 'chest_gerudo', type: 'iron', x: -1045, z: 855, rewardTextJa: 'トパーズ ×2', rewardType: 'material', rewardId: 'topaz', rewardAmount: 2 },
    ];

    for (const spec of chestSpecs) {
      const cy = getTerrainHeight(spec.x, spec.z);
      const root = new THREE.Group();
      root.position.set(spec.x, cy, spec.z);
      const isOpened = openedIds.includes(spec.id);
      let lidPivot: THREE.Group | undefined;

      if (spec.type === 'wood' || spec.type === 'iron') {
        const glbKey = spec.type === 'iron' ? 'chest_gold' : 'chest_wood';
        const glb = modelLoader.instantiate(glbKey, { scaleMultiplier: 1.05 });
        if (glb) {
          root.add(glb.root);
        } else {
          lidPivot = this.buildSculptedFallbackChest(root, spec.type);
        }
      } else {
        // Sculpted Ancient Sheikah Chest: Arched lid + dark stone + glowing cyan straps + rivets + keyhole emblem!
        lidPivot = this.buildSculptedFallbackChest(root, 'ancient');
      }

      // Opening Golden Light Burst Beam inside chest
      const glowBeam = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 3.6, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: spec.type === 'ancient' ? '#3ae8ff' : '#ffe474',
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      glowBeam.position.y = 2.0;
      glowBeam.rotation.x = Math.PI;
      root.add(glowBeam);

      if (isOpened && lidPivot) {
        lidPivot.rotation.x = -1.35;
      }

      this.group.add(root);
      this.chests.push({
        id: spec.id,
        type: spec.type,
        labelJa: spec.type === 'ancient' ? '古代シーカー宝箱' : spec.type === 'iron' ? '鉄製宝箱（マグネ対応）' : '木製宝箱',
        rewardTextJa: spec.rewardTextJa,
        rewardType: spec.rewardType,
        rewardId: spec.rewardId,
        rewardAmount: spec.rewardAmount,
        position: new THREE.Vector3(spec.x, cy, spec.z),
        opened: isOpened,
        openAnim: isOpened ? 1 : 0,
        root,
        lidPivot,
        glowBeam,
      });
    }
  }

  private buildSculptedFallbackChest(parent: THREE.Group, style: 'wood' | 'iron' | 'ancient'): THREE.Group {
    const shTex = textureBank.getSheikahStoneTexture();
    const woodTex = textureBank.getWoodPlankTexture('#7b5030');
    const bodyMat =
      style === 'ancient'
        ? createBotWToonMaterial({
            color: '#464d5c',
            map: shTex.map,
            normalMap: shTex.normalMap,
            emissive: '#22e4ff',
            emissiveMap: shTex.emissiveMap,
            emissiveIntensity: 1.5,
            sheikahCircuit: true,
            sheikahActivated: 1.0,
            sheikahHeight: 1.1,
          })
        : createBotWToonMaterial({
            color: style === 'iron' ? '#6a7482' : '#855834',
            map: woodTex.map,
            normalMap: woodTex.normalMap,
            metalHighlight: style === 'iron',
          });
    const bandMat = createBotWToonMaterial({
      color: style === 'ancient' ? '#d8b45c' : style === 'iron' ? '#d2ba62' : '#4a4e58',
      metalHighlight: true,
    });
    const emblemMat = createBotWToonMaterial({
      color: style === 'ancient' ? '#36ecff' : '#f2c84b',
      emissive: style === 'ancient' ? '#24dcff' : '#a87c10',
      emissiveIntensity: style === 'ancient' ? 1.4 : 0.35,
      metalHighlight: true,
    });

    // Lower chest body + 4 corner reinforcing brackets + metal bands + rivets!
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.64, 0.88), bodyMat);
    base.position.y = 0.32;
    base.castShadow = true;
    parent.add(base);

    for (const sx of [-0.52, 0.52]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.68, 0.93), bandMat);
      strap.position.set(sx, 0.33, 0);
      parent.add(strap);
      for (const sz of [-0.47, 0.47]) {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), bandMat);
        rivet.position.set(sx, 0.16, sz);
        parent.add(rivet);
      }
    }

    // Front keyhole plate & glowing emblem!
    const lockPlate = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), emblemMat);
    lockPlate.scale.set(1.0, 1.25, 0.35);
    lockPlate.position.set(0, 0.58, 0.46);
    parent.add(lockPlate);

    // Articulated Arched Lid pivoting cleanly at rear hinge!
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.64, -0.44);
    const lidArch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 1.36, 12, 1, false, 0, Math.PI),
      bodyMat
    );
    lidArch.rotation.z = Math.PI / 2;
    lidArch.position.set(0, 0, 0.44);
    lidArch.castShadow = true;
    lidPivot.add(lidArch);

    // Arched metal bands wrapping lid
    for (const sx of [-0.52, 0, 0.52]) {
      const lidStrap = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.045, 6, 14, Math.PI), bandMat);
      lidStrap.rotation.y = Math.PI / 2;
      lidStrap.position.set(sx, 0, 0.44);
      lidPivot.add(lidStrap);
    }

    parent.add(lidPivot);
    return lidPivot;
  }

  /**
   * Spawns interactive Havok/Chemistry physics props across the Great Plateau & Hyrule:
   * - Metal Crates & 2-stack Minecarts (demonstrates Magnesis & Flying Machine!)
   * - Rolling Boulders (for Stasis kinetic launch!)
   * - Wooden Barrels & Crates (GLB models, burnable by Fire!)
   */
  private buildInteractivePhysicsProps(): void {
    const metalTex = textureBank.getStoneMasonryTexture('#646d7a', '#4a5568');
    const spawnMetalBox = (id: string, labelJa: string, x: number, z: number, extraY = 0, isMinecart = false) => {
      const y = getTerrainHeight(x, z) + extraY;
      const mat = createBotWToonMaterial({
        color: isMinecart ? '#56647a' : '#707b8c',
        map: metalTex.map,
        normalMap: metalTex.normalMap,
        metalHighlight: true,
        rimStrength: 0.4,
      });
      const frameMat = createBotWToonMaterial({ color: '#9ba8bc', metalHighlight: true, rimStrength: 0.45 });
      const grp = new THREE.Group();
      const w = isMinecart ? 2.1 : 1.48;
      const h = isMinecart ? 0.85 : 1.48;
      const d = isMinecart ? 1.5 : 1.48;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.y = h * 0.5;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      grp.add(mesh);
      // Reinforced riveted metal edge trim bars
      for (const sx of [-w * 0.48, w * 0.48]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, h + 0.06, d + 0.06), frameMat);
        post.position.set(sx, h * 0.5, 0);
        grp.add(post);
      }
      for (const sy of [0.1, h - 0.08]) {
        const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.14, d + 0.06), frameMat);
        rim.position.set(0, sy, 0);
        grp.add(rim);
      }
      grp.position.set(x, y, z);
      this.group.add(grp);

      const body: PhysicsBody = {
        id,
        labelJa,
        mesh: grp,
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        mass: 3.5,
        radius: isMinecart ? 1.15 : 0.9,
        halfHeight: isMinecart ? 0.425 : 0.75,
        material: 'Metal',
        isStatic: false,
        isMinecart,
        isMetalBox: !isMinecart,
        isBurning: false,
        burnTimer: 0,
        isElectrified: false,
        shockTimer: 0,
        isFrozenStasis: false,
        stasisTimer: 0,
        stasisHits: 0,
        stasisAccumImpulse: new THREE.Vector3(),
        magnesisGrabbed: false,
        onMagnesisHighlight: (state) => {
          if (mat.userData.botwUniforms) mat.userData.botwUniforms.uMagnesisState.value = state;
        },
        onStasisVisual: (glow) => {
          if (mat.userData.botwUniforms) mat.userData.botwUniforms.uStasisGlow.value = glow;
        },
        buoyant: false,
        grounded: true,
      };
      this.physics.addBody(body);
    };

    // Great Plateau Rune Playground near Shrine of Resurrection & Oman Au Shrine
    spawnMetalBox('metal_box_1', '鉄の箱', -288, 444);
    spawnMetalBox('metal_box_2', '鉄の箱', -222, 428);
    // Stacked Minecart pair on Great Plateau & Death Mountain for authentic BotW Flying Machine!
    spawnMetalBox('minecart_lower', 'トロッコ（下段・マグネ対応）', -266, 466, 0, true);
    spawnMetalBox('minecart_upper', 'トロッコ（上段・フライングマシン用）', -266, 466, 0.92, true);
    spawnMetalBox('minecart_eldin_1', 'デスマウンテントロッコ', 462, -748, 0, true);

    // Rolling Stasis Boulders
    const cliffTex = textureBank.getCliffTexture();
    for (const [id, x, z] of [
      ['boulder_plateau_1', -276, 456] as const,
      ['boulder_plateau_2', -262, 535] as const,
      ['boulder_dueling', 255, 442] as const,
    ]) {
      const y = getTerrainHeight(x, z);
      const bMat = createBotWToonMaterial({ color: '#8f887d', map: cliffTex.map, normalMap: cliffTex.normalMap });
      const bMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), bMat);
      bMesh.position.y = 1.0;
      bMesh.castShadow = true;
      const grp = new THREE.Group();
      grp.add(bMesh);
      grp.position.set(x, y, z);
      this.group.add(grp);

      this.physics.addBody({
        id,
        labelJa: '大岩（ビタロック対応）',
        mesh: grp,
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        mass: 4.5,
        radius: 1.15,
        halfHeight: 1.0,
        material: 'Stone',
        isStatic: false,
        isBoulder: true,
        isBurning: false,
        burnTimer: 0,
        isElectrified: false,
        shockTimer: 0,
        isFrozenStasis: false,
        stasisTimer: 0,
        stasisHits: 0,
        stasisAccumImpulse: new THREE.Vector3(),
        magnesisGrabbed: false,
        onStasisVisual: (glow) => {
          if (bMat.userData.botwUniforms) bMat.userData.botwUniforms.uStasisGlow.value = glow;
        },
        buoyant: false,
        grounded: true,
      });
    }

    // CC0 GLB Wooden Barrels & Stacked Crates (Wood material — ignitable by Fire!)
    for (const [id, key, x, z] of [
      ['barrel_1', 'barrel', -295, 460] as const,
      ['crates_1', 'crates', -236, 482] as const,
      ['barrel_2', 'barrel', 435, 250] as const,
    ]) {
      const y = getTerrainHeight(x, z);
      const glb = modelLoader.instantiate(key);
      const grp = new THREE.Group();
      if (glb) grp.add(glb.root);
      else {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.48, 1.0, 10), createBotWToonMaterial({ color: '#7a5230', map: textureBank.getWoodPlankTexture().map }));
        m.position.y = 0.5;
        grp.add(m);
      }
      grp.position.set(x, y, z);
      this.group.add(grp);

      this.physics.addBody({
        id,
        labelJa: key === 'barrel' ? '木樽' : '木箱',
        mesh: grp,
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        mass: 1.2,
        radius: 0.7,
        halfHeight: 0.6,
        material: 'Wood',
        isStatic: false,
        isBurning: false,
        burnTimer: 0,
        isElectrified: false,
        shockTimer: 0,
        isFrozenStasis: false,
        stasisTimer: 0,
        stasisHits: 0,
        stasisAccumImpulse: new THREE.Vector3(),
        magnesisGrabbed: false,
        onStasisVisual: (glow) => glb?.setStasisGlow(glow),
        buoyant: true,
        grounded: true,
      });
    }
  }

  private buildMemoryBeams(locations: Array<{ id: string; titleJa: string; x: number; z: number }>, unlockedIds: string[]): void {
    for (const loc of locations) {
      const y = getTerrainHeight(loc.x, loc.z);
      const collected = unlockedIds.includes(loc.id);
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 1.2, 22, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#ffe88a',
          transparent: true,
          opacity: collected ? 0.14 : 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      pillar.position.set(loc.x, y + 11, loc.z);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.08, 8, 24),
        new THREE.MeshBasicMaterial({ color: '#fff2a6', transparent: true, opacity: collected ? 0.2 : 0.85 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(loc.x, y + 0.35, loc.z);
      this.group.add(pillar, ring);

      this.memorySpots.push({
        memoryId: loc.id,
        titleJa: loc.titleJa,
        position: new THREE.Vector3(loc.x, y, loc.z),
        pillarMesh: pillar,
        ringMesh: ring,
        collected,
      });
    }
  }

  activateTower(regionId: RegionId): WorldTower | null {
    const t = this.towers.find((tw) => tw.regionId === regionId);
    if (!t) return null;
    t.activated = true;
    (t.beaconLight.material as THREE.MeshBasicMaterial).color.set('#2ce8ff');
    return t;
  }

  completeShrine(shrineId: string): WorldShrine | null {
    const sh = this.shrines.find((s) => s.id === shrineId);
    if (!sh) return null;
    sh.completed = true;
    (sh.doorGlow.material as THREE.MeshBasicMaterial).color.set('#28ecff');
    return sh;
  }

  openChest(chest: WorldChest): void {
    chest.opened = true;
  }

  update(dt: number, timeSec: number): void {
    // 1. Animate Orange -> Cyan Sheikah circuit propagation wave on activated Towers & Shrines!
    for (const tw of this.towers) {
      if (tw.activated && tw.activationProgress < 1) {
        tw.activationProgress = Math.min(1, tw.activationProgress + dt * 0.45);
        for (const m of tw.materials) {
          if (m.userData.botwUniforms) m.userData.botwUniforms.uSheikahActivated.value = tw.activationProgress;
        }
      }
      tw.beaconLight.rotation.y += dt * 1.4;
    }

    for (const sh of this.shrines) {
      if (sh.completed && sh.activationProgress < 1) {
        sh.activationProgress = Math.min(1, sh.activationProgress + dt * 0.6);
        for (const m of sh.materials) {
          if (m.userData.botwUniforms) m.userData.botwUniforms.uSheikahActivated.value = sh.activationProgress;
        }
      }
    }

    // 2. Kinematic Divine Beast live motion!
    for (const db of this.divineBeasts) {
      if (db.id === 'vah_ruta') {
        db.movingPart.rotation.x = Math.sin(timeSec * 0.4) * 0.35;
      } else if (db.id === 'vah_rudania') {
        db.movingPart.rotation.z = Math.sin(timeSec * 0.35) * 0.38;
      } else if (db.id === 'vah_medoh') {
        // Circle gracefully above Rito Village!
        const a = timeSec * 0.08;
        db.root.position.x = -1080 + Math.cos(a) * 65;
        db.root.position.z = -500 + Math.sin(a) * 65;
        db.root.rotation.y = -a;
        db.movingPart.rotation.z = Math.sin(timeSec * 0.8) * 0.22;
      } else if (db.id === 'vah_naboris') {
        db.movingPart.rotation.z += dt * 0.35;
      }
    }

    // 3. Windmills, Cooking flames, Chest open animations, Memory rings
    for (const wm of this.windmillBlades) {
      wm.rotation.z -= dt * 0.9;
    }
    for (const p of this.cookingPots) {
      p.flameMesh.scale.y = 0.85 + 0.25 * Math.sin(timeSec * 12 + p.position.x);
    }
    for (const c of this.chests) {
      if (c.opened && c.openAnim < 1) {
        c.openAnim = Math.min(1, c.openAnim + dt * 2.2);
        if (c.lidPivot) c.lidPivot.rotation.x = -c.openAnim * 1.4;
        const beamMat = c.glowBeam.material as THREE.MeshBasicMaterial;
        beamMat.opacity = Math.sin(c.openAnim * Math.PI) * 0.78;
      }
    }
    for (const ms of this.memorySpots) {
      ms.ringMesh.rotation.z += dt * 1.1;
      ms.pillarMesh.scale.x = 0.92 + 0.12 * Math.sin(timeSec * 3.0);
      ms.pillarMesh.scale.z = ms.pillarMesh.scale.x;
    }
    if (this.malicePillars.length > 0) {
      const halo = this.malicePillars[this.malicePillars.length - 1];
      halo.rotation.z += dt * 0.25;
    }
  }
}
