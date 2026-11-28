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
  rewardPreview?: THREE.Object3D;
}

export interface WorldTorch {
  id: string;
  nameJa: string;
  position: THREE.Vector3;
  lit: boolean;
  flameMesh: THREE.Mesh;
  outerFlame: THREE.Mesh;
  root: THREE.Group;
}

export interface WorldWeaponDrop {
  id: string;
  nameJa: string;
  weaponId: string;
  position: THREE.Vector3;
  collected: boolean;
  root: THREE.Group;
  spinTarget: THREE.Object3D;
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
 * Constructs ALL iconic Hyrule architecture & landmarks across the 15 seamless regions,
 * registers lightweight spatial-hashed 3D AABB/OBB/Cylinder colliders to prevent clipping,
 * and integrates ALL architectural & prop CC0/MIT .glb models (`pillar`, `wall_arched`, `rubble`, `torch`, `sword_shield`, `chest_wood`, `chest_gold`, `barrel`, `crates`).
 */
export class ArchitectureBuilder {
  public readonly group = new THREE.Group();
  public towers: WorldTower[] = [];
  public shrines: WorldShrine[] = [];
  public chests: WorldChest[] = [];
  public torches: WorldTorch[] = [];
  public weaponDrops: WorldWeaponDrop[] = [];
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
    this.buildWeaponDrops();
    this.buildInteractivePhysicsProps();
    this.buildMemoryBeams(opts.memoryLocations, opts.unlockedMemories);
  }

  /**
   * Places a grounded CC0 `torch.glb` brazier/torch stand with fire-element ignition state.
   */
  public addTorchStand(x: number, z: number, nameJa: string, initiallyLit = true): WorldTorch {
    const y = getTerrainHeight(x, z);
    const root = new THREE.Group();
    root.position.set(x, y, z);

    const glb = modelLoader.instantiate('torch', { scaleMultiplier: 1.0 });
    if (glb) {
      root.add(glb.root);
    } else {
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.22, 1.85, 8),
        createBotWToonMaterial({ color: '#4c4844', metalHighlight: true })
      );
      stand.position.y = 0.92;
      root.add(stand);
    }

    const flameMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.68, 7),
      new THREE.MeshBasicMaterial({ color: '#ffd944', transparent: true, opacity: 0.94 })
    );
    flameMesh.position.y = 2.08;
    flameMesh.visible = initiallyLit;

    const outerFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.36, 0.92, 7),
      new THREE.MeshBasicMaterial({ color: '#ff5e12', transparent: true, opacity: 0.62 })
    );
    outerFlame.position.y = 2.12;
    outerFlame.visible = initiallyLit;

    root.add(outerFlame, flameMesh);
    this.group.add(root);

    this.physics.addCylinderCollider(`torch_col_${this.torches.length}`, x, z, 0.42, y - 0.5, y + 1.9, {
      climbable: false,
      walkableTop: false,
    });

    const torch: WorldTorch = {
      id: `torch_${this.torches.length}_${Math.round(x)}_${Math.round(z)}`,
      nameJa,
      position: new THREE.Vector3(x, y, z),
      lit: initiallyLit,
      flameMesh,
      outerFlame,
      root,
    };
    this.torches.push(torch);
    return torch;
  }

  public igniteTorch(torch: WorldTorch): boolean {
    if (torch.lit) return false;
    torch.lit = true;
    torch.flameMesh.visible = true;
    torch.outerFlame.visible = true;
    return true;
  }

  public igniteTorchesNear(pos: THREE.Vector3, radius: number): number {
    let count = 0;
    for (const t of this.torches) {
      if (!t.lit && t.position.distanceTo(pos) <= radius) {
        this.igniteTorch(t);
        count++;
      }
    }
    return count;
  }

  public isNearLitTorch(pos: THREE.Vector3, maxDist = 7.0): boolean {
    for (const t of this.torches) {
      if (t.lit && t.position.distanceTo(pos) <= maxDist) return true;
    }
    return false;
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

    // Solid arch left/right pier colliders (leaving the center portal archway open to walk through!)
    const archYaw = Math.PI * 0.28;
    for (const side of [-1, 1]) {
      const px = x + Math.cos(archYaw) * side * 4.2;
      const pz = z - Math.sin(archYaw) * side * 4.2;
      this.physics.addCylinderCollider(`sor_arch_pier_${side}`, px, pz, 1.4, y - 2, y + 5.5, { climbable: true });
    }

    // Ancient Sheikah Resurrection Pedestal inside entrance
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.9, 8), stoneMat);
    pedestal.position.set(-2.5, 0.45, 2.2);
    grp.add(pedestal);
    this.physics.addCylinderCollider('sor_pedestal', x - 2.5, z + 2.2, 1.35, y - 0.5, y + 0.9, { walkableTop: true, climbable: false });

    // Flank glowing Sheikah lantern pillars grounded strictly to local hillside height + colliders!
    for (const side of [-1, 1]) {
      const glbPillar = modelLoader.instantiate('pillar', { scaleMultiplier: 1.0 });
      const px = side * 4.4;
      const pz = side * -1.8;
      const wy = getTerrainHeight(x + px, z + pz);
      if (glbPillar) {
        glbPillar.root.position.set(px, wy - y - 0.55, pz);
        grp.add(glbPillar.root);
      }
      this.physics.addCylinderCollider(`sor_pillar_${side}`, x + px, z + pz, 1.05, wy - 1.5, wy + 4.0, { climbable: true });
    }

    // Guiding torches flanking the Shrine of Resurrection overlook!
    this.addTorchStand(x + 6.5, z - 3.0, '回生の祠の篝火（北）', true);
    this.addTorchStand(x + 2.5, z + 5.5, '回生の祠の篝火（南）', false);

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

    // Raised stone sanctuary foundation steps (walkable!) + step-up front apron so Link walks smoothly inside
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(22, 2.2, 30), stoneMat);
    plinth.position.y = 1.1;
    plinth.receiveShadow = true;
    grp.add(plinth);
    // Split low entry steps in front so Link climbs cleanly onto the Temple floor
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.7, 2.4), stoneMat);
    step1.position.set(0, 0.35, -16.1);
    const step2 = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 2.0), stoneMat);
    step2.position.set(0, 0.7, -15.0);
    grp.add(step1, step2);
    this.physics.addBoxCollider('tot_step1', x, z - 16.1, 10, 2.4, y - 1, y + 0.7, { walkableTop: true, climbable: false });
    this.physics.addBoxCollider('tot_step2', x, z - 15.0, 10, 2.0, y - 1, y + 1.4, { walkableTop: true, climbable: false });
    this.physics.addBoxCollider('tot_plinth', x, z, 22, 30, y - 2, y + 2.2, { walkableTop: true, climbable: true });

    // Iconic weathered nave side walls, columns & CC0 `wall_arched.glb` gothic nave bays!
    for (const sx of [-9.2, 9.2]) {
      for (let i = -2; i <= 2; i++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 11.5, 10), stoneMat);
        col.position.set(sx, 6.8, i * 5.2);
        col.castShadow = true;
        grp.add(col);
        this.physics.addCylinderCollider(`tot_col_${sx}_${i}`, x + sx, z + i * 5.2, 1.15, y + 1.0, y + 12.6, { climbable: true });
      }
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6.5, 25), stoneMat);
      wall.position.set(sx, 5.2, 0);
      wall.castShadow = true;
      grp.add(wall);
      this.physics.addBoxCollider(`tot_wall_${sx}`, x + sx, z, 1.6, 25, y + 1.5, y + 8.5, { climbable: true });

      // Deploy `wall_arched.glb` bays along the iconic ruined nave aisles!
      for (const az of [-7.8, 0, 7.8]) {
        const archWall = modelLoader.instantiate('wall_arched', { scaleMultiplier: 1.25 });
        if (archWall) {
          archWall.root.position.set(sx * 0.96, 2.15, az);
          archWall.root.rotation.y = Math.PI / 2;
          grp.add(archWall.root);
        }
      }
    }

    // Grand Front Facade with open central doorway (left pier + right pier + lintel) & Bell Tower Spire!
    const facadeL = new THREE.Mesh(new THREE.BoxGeometry(7.0, 12.5, 2.6), stoneMat);
    facadeL.position.set(-6.5, 7.6, -13.2);
    facadeL.castShadow = true;
    const facadeR = facadeL.clone();
    facadeR.position.x = 6.5;
    const facadeTop = new THREE.Mesh(new THREE.BoxGeometry(6.4, 6.2, 2.6), stoneMat);
    facadeTop.position.set(0, 10.75, -13.2);
    facadeTop.castShadow = true;
    grp.add(facadeL, facadeR, facadeTop);

    // Register front facade colliders leaving the 6m wide central doorway completely walkable!
    this.physics.addBoxCollider('tot_facade_l', x - 6.5, z - 13.2, 7.0, 2.6, y + 1.5, y + 14.0, { climbable: true });
    this.physics.addBoxCollider('tot_facade_r', x + 6.5, z - 13.2, 7.0, 2.6, y + 1.5, y + 14.0, { climbable: true });
    this.physics.addBoxCollider('tot_facade_lintel', x, z - 13.2, 6.4, 2.6, y + 7.65, y + 14.0, { climbable: true });

    // Rear sanctuary back wall behind Goddess Hylia statue
    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(19.5, 10.0, 2.0), stoneMat);
    rearWall.position.set(0, 7.0, 13.8);
    rearWall.castShadow = true;
    grp.add(rearWall);
    this.physics.addBoxCollider('tot_rear_wall', x, z + 13.8, 19.5, 2.0, y + 1.5, y + 12.0, { climbable: true });

    const gable = new THREE.Mesh(new THREE.ConeGeometry(13.5, 8.5, 4), roofMat);
    gable.rotation.y = Math.PI / 4;
    gable.position.set(0, 17.5, -12.5);
    gable.scale.set(1.05, 1, 0.38);
    grp.add(gable);

    const bellTower = new THREE.Mesh(new THREE.BoxGeometry(7.2, 16, 7.2), stoneMat);
    bellTower.position.set(0, 18.5, -8.2);
    bellTower.castShadow = true;
    grp.add(bellTower);
    this.physics.addBoxCollider('tot_belltower', x, z - 8.2, 7.2, 7.2, y + 10.5, y + 26.5, { climbable: true });

    const spire = new THREE.Mesh(new THREE.ConeGeometry(5.6, 13.5, 4), roofMat);
    spire.rotation.y = Math.PI / 4;
    spire.position.set(0, 32.5, -8.2);
    spire.castShadow = true;
    grp.add(spire);

    // Goddess Hylia Statue at inner altar + collider!
    const goddessBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.2, 8), stoneMat);
    goddessBase.position.set(0, 2.8, 9.5);
    const goddessBody = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.1, 3.6, 10), stoneMat);
    goddessBody.position.set(0, 5.1, 9.5);
    const goddessWings = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 0.3), goldMat);
    goddessWings.position.set(0, 5.6, 10.1);
    const goddessHead = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), stoneMat);
    goddessHead.position.set(0, 7.2, 9.5);
    grp.add(goddessBase, goddessBody, goddessWings, goddessHead);
    this.physics.addCylinderCollider('tot_goddess', x, z + 9.5, 1.8, y + 2.0, y + 7.8, { climbable: true });

    // Add CC0 GLB rubble & arched ruin fragments around Temple ruins + colliders
    for (const [idx, [rx, rz, ry]] of ([[-12, -16, 0.3], [13, -14, -0.5], [12, 10, 1.2]] as Array<[number, number, number]>).entries()) {
      const rub = modelLoader.instantiate('rubble', { scaleMultiplier: 1.5 });
      const wy = getTerrainHeight(x + rx, z + rz);
      if (rub) {
        rub.root.position.set(rx, wy - y - 0.15, rz);
        rub.root.rotation.y = ry;
        grp.add(rub.root);
      }
      this.physics.addCylinderCollider(`tot_rubble_${idx}`, x + rx, z + rz, 1.65, wy - 1, wy + 1.9, { walkableTop: true });
    }

    // Temple of Time sanctuary braziers (`torch.glb`) + Old Man's classic campfire!
    this.addTorchStand(x - 5.5, z - 16.5, '時の神殿の松明（西）', true);
    this.addTorchStand(x + 5.5, z - 16.5, '時の神殿の松明（東）', false);
    this.addCookingPot(x + 19, z - 16, '時の神殿跡の焚き火');

    this.group.add(grp);
  }

  /**
   * Hyrule Castle: Western Gothic Spires x Japanese Castle 5-Stage Defensive Layout +
   * 7 Watchtowers + 5 Giant Glowing Sheikah/Malice Pillars + CC0 `wall_arched.glb` outer colonnades + Full Colliders!
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

    // Central Sanctum Citadel Keep + Collider
    const sanctumBase = new THREE.Mesh(new THREE.CylinderGeometry(24, 34, 38, 12), wallMat);
    sanctumBase.position.y = baseY + 14;
    sanctumBase.castShadow = true;
    grp.add(sanctumBase);
    this.physics.addCylinderCollider('hc_sanctum_base', cx, cz, 29, baseY - 10, baseY + 33, { climbable: true });

    const mainKeep = new THREE.Mesh(new THREE.CylinderGeometry(14, 19, 44, 10), wallMat);
    mainKeep.position.y = baseY + 50;
    mainKeep.castShadow = true;
    grp.add(mainKeep);
    this.physics.addCylinderCollider('hc_main_keep', cx, cz, 16.5, baseY + 28, baseY + 72, { climbable: true });

    const centralSpire = new THREE.Mesh(new THREE.ConeGeometry(16, 48, 8), spireMat);
    centralSpire.position.y = baseY + 95;
    centralSpire.castShadow = true;
    grp.add(centralSpire);

    // 4 Flanking Gothic Turrets + Colliders
    const turrets = [
      { dx: -28, dz: -8, h: 52, r: 7.5 },
      { dx: 28, dz: -8, h: 48, r: 7.5 },
      { dx: -20, dz: 24, h: 42, r: 6.5 },
      { dx: 20, dz: 24, h: 42, r: 6.5 },
    ];
    turrets.forEach((t, idx) => {
      const ty = getTerrainHeight(cx + t.dx, cz + t.dz);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.85, t.r, t.h, 8), wallMat);
      body.position.set(t.dx, ty + t.h * 0.5 - 4, t.dz);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(t.r * 1.15, 22, 8), spireMat);
      roof.position.set(t.dx, ty + t.h + 6, t.dz);
      grp.add(body, roof);
      this.physics.addCylinderCollider(`hc_turret_${idx}`, cx + t.dx, cz + t.dz, t.r, ty - 6, ty + t.h - 4, { climbable: true });
    });

    // 7 Outer Perimeter Watchtowers + Colliders
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
      this.physics.addCylinderCollider(`hc_watchtower_${i}`, cx + wx, cz + wz, 5.2, wy - 4, wy + 25, { climbable: true });
    }

    // South Main Gatehouse Bridge Entrance (Stage 1) with battlements + CC0 `wall_arched.glb` curtain colonnades!
    const gateY = getTerrainHeight(cx, cz + 112) - 2.0;
    const gateL = new THREE.Mesh(new THREE.BoxGeometry(7.2, 24, 10), wallMat);
    gateL.position.set(-10, gateY + 12, 112);
    const gateR = gateL.clone();
    gateR.position.x = 10;
    const gateArch = new THREE.Mesh(new THREE.BoxGeometry(27.5, 7.5, 10.4), wallMat);
    gateArch.position.set(0, gateY + 21.5, 112);
    grp.add(gateL, gateR, gateArch);

    // Colliders for gatehouse piers & lintel (center 12.8m archway stays wide open!)
    this.physics.addBoxCollider('hc_gate_l', cx - 10, cz + 112, 7.2, 10, gateY - 2, gateY + 24, { climbable: true });
    this.physics.addBoxCollider('hc_gate_r', cx + 10, cz + 112, 7.2, 10, gateY - 2, gateY + 24, { climbable: true });
    this.physics.addBoxCollider('hc_gate_arch', cx, cz + 112, 27.5, 10.4, gateY + 17.75, gateY + 25.25, { climbable: true });

    // Flanking `wall_arched.glb` castle curtain walls & torches!
    for (const side of [-1, 1]) {
      for (let b = 0; b < 3; b++) {
        const ax = side * (19 + b * 7.8);
        const az = 112 - b * 1.4;
        const ay = getTerrainHeight(cx + ax, cz + az);
        const archBay = modelLoader.instantiate('wall_arched', { scaleMultiplier: 1.85 });
        if (archBay) {
          archBay.root.position.set(ax, ay - 0.5, az);
          archBay.root.rotation.y = side * -0.18;
          grp.add(archBay.root);
        }
        this.physics.addBoxCollider(`hc_curtain_${side}_${b}`, cx + ax, cz + az, 7.4, 2.0, ay - 2, ay + 8.5, {
          rotY: side * -0.18,
          climbable: true,
        });
      }
      this.addTorchStand(cx + side * 6.2, cz + 118.5, `ハイラル城正門の篝火（${side < 0 ? '西' : '東'}）`, true);
    }

    // Stone crenellation merlons atop gatehouse parapet
    for (let mx = -12; mx <= 12; mx += 4) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 2.0), wallMat);
      merlon.position.set(mx, gateY + 26.4, 116.2);
      grp.add(merlon);
    }

    // 5 Iconic Giant Sheikah/Malice Pillars angled dramatically around Hyrule Castle + colliders
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
      this.physics.addCylinderCollider(`hc_malice_pillar_${i}`, cx + px, cz + pz, 6.2, py - 8, py + 40, { climbable: true });
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
   * Builds ALL 15 Sheikah Towers across Hyrule with authentic Jomon spiral filigree,
   * climbable shaft colliders, walkable mid-tower resting ledges, and summit crown platform!
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

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 4.6, 52, 10), towerMat);
      shaft.position.y = 26;
      shaft.castShadow = true;
      grp.add(shaft);
      this.physics.addCylinderCollider(`tower_shaft_${reg.id}`, tx, tz, 3.9, ty - 4, ty + 49.8, { climbable: true, walkableTop: false });

      // 4 Mid-tower resting platforms (walkable ledges for authentic climbing breathers!)
      for (let lvl = 1; lvl <= 4; lvl++) {
        const ledge = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 4.2, 1.1, 8), towerMat);
        ledge.position.y = lvl * 10.5;
        grp.add(ledge);
        const ly = ty - 2.2 + lvl * 10.5;
        this.physics.addCylinderCollider(`tower_ledge_${reg.id}_${lvl}`, tx, tz, 5.1, ly - 0.55, ly + 0.55, {
          climbable: true,
          walkableTop: true,
        });
      }

      // Summit Observatory Crown & Glowing Sheikah Eye Beacon
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 3.8, 4.5, 10), towerMat);
      crown.position.y = 53;
      grp.add(crown);
      this.physics.addCylinderCollider(`tower_crown_${reg.id}`, tx, tz, 7.6, ty + 48.5, ty + 53.05, {
        climbable: true,
        walkableTop: true,
      });

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
   * Builds detailed Ancient Sheikah Shrines with Jomon sculpted crown reliefs + solid climbable colliders!
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

      const base = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.6, 1.5, 8), mat);
      base.position.y = 0.75;
      base.receiveShadow = true;
      grp.add(base);
      this.physics.addCylinderCollider(`shrine_base_${sh.id}`, sh.x, sh.z, 6.2, sy - 1.5, sy + 0.85, {
        walkableTop: true,
        climbable: true,
      });

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
      this.physics.addCylinderCollider(`shrine_body_${sh.id}`, sh.x, sh.z, 4.3, sy + 0.3, sy + 10.6, {
        climbable: true,
        walkableTop: true,
      });

      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const horn = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.32, 8, 12, Math.PI * 1.35), mat);
        horn.position.set(Math.cos(a) * 3.1, 8.8, Math.sin(a) * 3.1);
        horn.rotation.y = -a;
        horn.rotation.z = 0.45;
        grp.add(horn);
      }

      const portico = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.3, 1.9), mat);
      portico.position.set(0, 2.95, 3.6);
      portico.castShadow = true;
      grp.add(portico);
      this.physics.addBoxCollider(`shrine_portico_${sh.id}`, sh.x, sh.z + 3.6, 3.2, 1.9, sy + 0.3, sy + 4.5, {
        climbable: true,
      });

      const doorMat = new THREE.MeshBasicMaterial({ color: isComp ? '#28ecff' : '#ff8620' });
      const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.3, 0.25), doorMat);
      doorGlow.position.set(0, 2.75, 4.50);
      grp.add(doorGlow);

      const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.4, 6), mat);
      terminal.position.set(0, 1.4, 5.55);
      grp.add(terminal);
      this.physics.addCylinderCollider(`shrine_term_${sh.id}`, sh.x, sh.z + 5.55, 0.6, sy, sy + 1.5, {
        climbable: false,
        walkableTop: false,
      });

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
        const horseHead = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.2, 6), roofMat);
        horseHead.position.set(0, 14.5, 1.5);
        horseHead.rotation.x = 0.72;
        grp.add(baseWall, tent, horseHead);
        this.physics.addCylinderCollider(`stable_${lm.id}`, lm.x, lm.z, 9.0, ly - 2, ly + 8.5, { climbable: true });
        this.addCookingPot(lm.x + 11, lm.z + 6, `${lm.nameJa}の料理鍋`);
        this.addTorchStand(lm.x - 10.5, lm.z + 7.5, `${lm.nameJa}の松明`, true);
      } else if (lm.type === 'great_fairy') {
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
        this.physics.addCylinderCollider(`fairy_bud_${lm.id}`, lm.x, lm.z, 4.6, ly - 1, ly + 6.5, { climbable: false });
      } else if (lm.type === 'spring') {
        const sMat = createBotWToonMaterial({ color: '#9ab0be', map: stoneTex.map });
        const basin = new THREE.Mesh(new THREE.TorusGeometry(10, 1.8, 8, 20), sMat);
        basin.rotation.x = Math.PI / 2;
        basin.position.y = 1.2;
        const statue = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.6, 6.0, 8), sMat);
        statue.position.set(0, 3.5, -5);
        grp.add(basin, statue);
        this.physics.addCylinderCollider(`spring_statue_${lm.id}`, lm.x, lm.z - 5, 1.6, ly - 1, ly + 6.5, { climbable: true });
      } else if (lm.type === 'labyrinth') {
        const lMat = createBotWToonMaterial({ color: '#5c5952', map: stoneTex.map, normalMap: stoneTex.normalMap });
        const walls: Array<[number, number, number, number]> = [
          [0, -28, 56, 3], [0, 28, 56, 3], [-28, 0, 3, 56], [28, 0, 3, 56],
          [-12, -12, 26, 3], [12, 12, 26, 3], [-12, 14, 3, 24], [14, -12, 3, 24],
        ];
        walls.forEach(([wx, wz, sx, sz], wi) => {
          const w = new THREE.Mesh(new THREE.BoxGeometry(sx, 14, sz), lMat);
          w.position.set(wx, 7, wz);
          w.castShadow = true;
          grp.add(w);
          this.physics.addBoxCollider(`lab_wall_${lm.id}_${wi}`, lm.x + wx, lm.z + wz, sx, sz, ly - 2, ly + 14, { climbable: true });
        });
      } else if (lm.type === 'lab') {
        const labMat = createBotWToonMaterial({ color: '#c8b896', map: stoneTex.map });
        const blueFlame = createBotWToonMaterial({ color: '#2ae8ff', emissive: '#1ad0ff', emissiveIntensity: 1.8 });
        const hall = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.5, 8.5, 10), labMat);
        hall.position.y = 4.25;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(8.6, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), createBotWToonMaterial({ color: '#4a5568' }));
        dome.position.y = 8.4;
        const furnace = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.8, 3.2, 8), blueFlame);
        furnace.position.set(11, 1.6, 4);
        grp.add(hall, dome, furnace);
        this.physics.addCylinderCollider(`lab_hall_${lm.id}`, lm.x, lm.z, 9.2, ly - 2, ly + 9.0, { climbable: true });
        this.physics.addCylinderCollider(`lab_furnace_${lm.id}`, lm.x + 11, lm.z + 4, 1.8, ly - 1, ly + 3.2, { climbable: false });
      } else if (lm.style === 'kakariko') {
        const roofMat = createBotWToonMaterial({ color: '#586246', map: woodTex.map });
        const wallMat = createBotWToonMaterial({ color: '#e8e0cc', map: stoneTex.map });
        const toriiMat = createBotWToonMaterial({ color: '#c43628' });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const r = i === 0 ? 0 : 28;
          const hx = Math.cos(a) * r;
          const hz = Math.sin(a) * r;
          const scale = i === 0 ? 1.55 : 0.95;
          const w = 7.5 * scale;
          const h = 4.5 * scale;
          const d = 6.5 * scale;
          const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
          house.position.set(hx, h * 0.5, hz);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(6.5 * scale, 4.6 * scale, 4), roofMat);
          roof.rotation.y = Math.PI / 4;
          roof.position.set(hx, 6.2 * scale, hz);
          grp.add(house, roof);
          this.physics.addBoxCollider(`kak_house_${i}`, lm.x + hx, lm.z + hz, w, d, ly - 2, ly + h + 0.5, { climbable: true });
        }
        for (let t = 0; t < 3; t++) {
          const tz = 18 + t * 9;
          const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 6.2, 8), toriiMat);
          pL.position.set(-3.2, 3.1, tz);
          const pR = pL.clone();
          pR.position.x = 3.2;
          const bar = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.65, 0.7), toriiMat);
          bar.position.set(0, 5.9, tz);
          grp.add(pL, pR, bar);
          this.physics.addCylinderCollider(`kak_torii_l_${t}`, lm.x - 3.2, lm.z + tz, 0.48, ly - 1, ly + 6.2, { climbable: true });
          this.physics.addCylinderCollider(`kak_torii_r_${t}`, lm.x + 3.2, lm.z + tz, 0.48, ly - 1, ly + 6.2, { climbable: true });
        }
        this.addTorchStand(lm.x - 5.2, lm.z + 17, 'カカリコ村の篝火（西）', true);
        this.addTorchStand(lm.x + 5.2, lm.z + 17, 'カカリコ村の篝火（東）', true);
        this.addCookingPot(lm.x + 12, lm.z + 10, 'カカリコ村の料理鍋');
      } else if (lm.style === 'hateno') {
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
          this.physics.addBoxCollider(`hateno_house_${i}`, lm.x + hx, lm.z + hz, 8.5, 7.2, ly - 2, ly + 6.0, { climbable: true });
        }
        const millTower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, 16, 10), stucco);
        millTower.position.set(0, 8, -10);
        this.physics.addCylinderCollider('hateno_windmill', lm.x, lm.z - 10, 3.5, ly - 2, ly + 16, { climbable: true });
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
        this.addTorchStand(lm.x + 5, lm.z + 4, 'ハテノ村の街灯松明', true);
        this.addCookingPot(lm.x + 8, lm.z + 8, 'ハテノ村の料理鍋');
      } else if (lm.style === 'zora') {
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
        this.physics.addCylinderCollider('zora_palace', lm.x, lm.z, 19, ly - 2, ly + 12, { climbable: true, walkableTop: true });
        this.addCookingPot(lm.x + 15, lm.z + 18, 'ゾーラの里の料理鍋');
      } else if (lm.style === 'gerudo') {
        const adobe = createBotWToonMaterial({ color: '#d8ab72', map: stoneTex.map });
        const teal = createBotWToonMaterial({ color: '#2ea8a4', emissive: '#126468', emissiveIntensity: 0.25 });
        const palace = new THREE.Mesh(new THREE.BoxGeometry(24, 13, 18), adobe);
        palace.position.set(0, 6.5, -18);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), teal);
        dome.position.set(0, 13, -18);
        this.physics.addBoxCollider('gerudo_palace', lm.x, lm.z - 18, 24, 18, ly - 2, ly + 13, { climbable: true });
        const gWalls: Array<[number, number, number, number]> = [[-32, 0, 4, 60], [32, 0, 4, 60], [0, -32, 68, 4]];
        gWalls.forEach(([wx, wz, sx, sz], gi) => {
          const w = new THREE.Mesh(new THREE.BoxGeometry(sx, 11, sz), adobe);
          w.position.set(wx, 5.5, wz);
          grp.add(w);
          this.physics.addBoxCollider(`gerudo_wall_${gi}`, lm.x + wx, lm.z + wz, sx, sz, ly - 2, ly + 11, { climbable: true });
        });
        grp.add(palace, dome);
        this.addTorchStand(lm.x - 6, lm.z + 28, 'ゲルド門の松明（西）', true);
        this.addTorchStand(lm.x + 6, lm.z + 28, 'ゲルド門の松明（東）', true);
        this.addCookingPot(lm.x + 12, lm.z + 14, 'ゲルドの街の料理鍋');
      } else if (lm.style === 'rito') {
        const woodMat = createBotWToonMaterial({ color: '#8a603e', map: woodTex.map });
        const clothMat = createBotWToonMaterial({ color: '#3b82a6', map: textureBank.getFabricTexture('#3b82a6', '#e6c05a', 'weave').map });
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05;
          const h = 4 + i * 5.2;
          const hx = Math.cos(a) * 18;
          const hz = Math.sin(a) * 18;
          const hut = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.0, 4.5, 8), woodMat);
          hut.position.set(hx, h, hz);
          const cap = new THREE.Mesh(new THREE.ConeGeometry(5.0, 3.5, 8), clothMat);
          cap.position.set(hx, h + 3.8, hz);
          grp.add(hut, cap);
          this.physics.addCylinderCollider(`rito_hut_${i}`, lm.x + hx, lm.z + hz, 3.8, ly + h - 2.25, ly + h + 2.25, { climbable: true });
        }
        this.addCookingPot(lm.x + 14, lm.z + 10, 'リトの村の料理鍋');
      } else if (lm.style === 'goron') {
        const basalt = createBotWToonMaterial({ color: '#5a4a44', map: textureBank.getVolcanicTexture().map });
        const iron = createBotWToonMaterial({ color: '#646e78', metalHighlight: true });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const hx = Math.cos(a) * 24;
          const hz = Math.sin(a) * 24;
          const dome = new THREE.Mesh(new THREE.SphereGeometry(7.2, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), basalt);
          dome.position.set(hx, 0, hz);
          const arch = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.7, 6, 12, Math.PI), iron);
          arch.position.set(hx, 0, hz);
          grp.add(dome, arch);
          this.physics.addCylinderCollider(`goron_dome_${i}`, lm.x + hx, lm.z + hz, 6.8, ly - 2, ly + 6.2, { climbable: true });
        }
        this.addCookingPot(lm.x + 6, lm.z + 12, 'ゴロンシティの料理鍋');
      } else if (lm.style === 'tarrey') {
        const hexColors = ['#e05848', '#48a4d8', '#e8b842', '#5cb85c', '#c868d4', '#f08a42'];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const hx = Math.cos(a) * 22;
          const hz = Math.sin(a) * 22;
          const mod = new THREE.Mesh(
            new THREE.CylinderGeometry(4.6, 4.6, 4.6, 6),
            createBotWToonMaterial({ color: hexColors[i], map: woodTex.map })
          );
          mod.position.set(hx, 2.3, hz);
          grp.add(mod);
          this.physics.addCylinderCollider(`tarrey_house_${i}`, lm.x + hx, lm.z + hz, 4.4, ly - 2, ly + 4.6, { climbable: true });
        }
        const pond = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.4, 6), createBotWToonMaterial({ color: '#3bc4e8' }));
        pond.position.y = 0.2;
        grp.add(pond);
      } else if (lm.style === 'korok') {
        const bark = createBotWToonMaterial({ color: '#6b4d34', map: textureBank.getFoliageBarkTexture().map });
        const leaves = createBotWToonMaterial({ color: '#4cb848', map: textureBank.getGrassTexture().map, rimStrength: 0.45 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(12, 18, 34, 12), bark);
        trunk.position.set(0, 17, -20);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(26, 2), leaves);
        crown.position.set(0, 44, -20);
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 1.2, 8), createBotWToonMaterial({ color: '#9ca8b0', map: stoneTex.map }));
        pedestal.position.set(0, 0.6, 8);
        const swordBlade = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 2.2, 0.06),
          createBotWToonMaterial({ color: '#b8f2ff', emissive: '#22d4ff', emissiveIntensity: 1.2, metalHighlight: true })
        );
        swordBlade.position.set(0, 2.0, 8);
        grp.add(trunk, crown, pedestal, swordBlade);
        this.physics.addCylinderCollider('deku_tree_trunk', lm.x, lm.z - 20, 15.5, ly - 4, ly + 34, { climbable: true });
        this.physics.addCylinderCollider('master_sword_pedestal', lm.x, lm.z + 8, 3.8, ly - 1, ly + 1.2, { walkableTop: true, climbable: false });
      } else {
        // Historical Ruins (Akkala Citadel, Fort Hateno, Forgotten Temple, etc.) -> real `wall_arched.glb` + `torch.glb` + colliders!
        const ruinMat = createBotWToonMaterial({ color: '#8e887e', map: stoneTex.map, normalMap: stoneTex.normalMap });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const rx = Math.cos(a) * 14;
          const rz = Math.sin(a) * 14;
          const arch = modelLoader.instantiate('wall_arched', { scaleMultiplier: 1.55 });
          if (arch) {
            arch.root.position.set(rx, 0, rz);
            arch.root.rotation.y = a + Math.PI / 2;
            grp.add(arch.root);
          } else {
            const col = new THREE.Mesh(new THREE.BoxGeometry(5.5, 8 + (i % 2) * 4, 2.2), ruinMat);
            col.position.set(rx, 4, rz);
            col.rotation.y = a;
            grp.add(col);
          }
          this.physics.addBoxCollider(`ruin_arch_${lm.id}_${i}`, lm.x + rx, lm.z + rz, 6.2, 1.8, ly - 2, ly + 7.2, {
            rotY: a + Math.PI / 2,
            climbable: true,
          });
        }
        this.addTorchStand(lm.x + 8, lm.z + 8, `${lm.nameJa}の遺跡松明`, false);
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

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.24, 6, 10), createBotWToonMaterial({ color: '#7a756c' }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.72, 0.65, 14), ironMat);
    pot.position.y = 1.05;
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

    this.physics.addCylinderCollider(`pot_col_${x}_${z}`, x, z, 1.15, y - 0.5, y + 1.35, {
      climbable: false,
      walkableTop: true,
    });

    this.cookingPots.push({
      id: `pot_${x}_${z}`,
      nameJa,
      position: new THREE.Vector3(x, y, z),
      flameMesh: flame,
    });
  }

  /**
   * Builds detailed Treasure Chests across Hyrule + solid colliders + floating `sword_shield.glb` reward preview on open!
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
        lidPivot = this.buildSculptedFallbackChest(root, 'ancient');
      }

      // Opening Golden Light Burst Beam + floating `sword_shield.glb` treasure reward preview!
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

      let rewardPreview: THREE.Object3D | undefined;
      const glbReward = modelLoader.instantiate('sword_shield', { scaleMultiplier: 0.55 });
      if (glbReward) {
        glbReward.root.position.set(0, 1.45, 0);
        glbReward.root.visible = false;
        root.add(glbReward.root);
        rewardPreview = glbReward.root;
      }

      if (isOpened && lidPivot) {
        lidPivot.rotation.x = -1.35;
      }

      this.group.add(root);
      this.physics.addBoxCollider(`chest_col_${spec.id}`, spec.x, spec.z, 1.45, 0.95, cy - 0.5, cy + 1.05, {
        climbable: false,
        walkableTop: true,
      });

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
        rewardPreview,
      });
    }
  }

  /**
   * Places gleaming world Weapon & Shield Drop stands using CC0 `sword_shield.glb`!
   */
  private buildWeaponDrops(): void {
    const dropSpecs = [
      { id: 'drop_plateau_armory', nameJa: '旅人の剣＆盾セット', weaponId: 'travelers_sword', x: -290, z: 458 },
      { id: 'drop_temple_royal', nameJa: '王家の剣＆盾セット', weaponId: 'royal_broadsword', x: -252, z: 479 },
      { id: 'drop_castle_knight', nameJa: '騎士の剣＆盾セット', weaponId: 'knights_broadsword', x: -86, z: -145 },
      { id: 'drop_kakariko_guard', nameJa: '兵士の剣＆盾セット', weaponId: 'soldiers_broadsword', x: 425, z: 278 },
    ];

    for (const sp of dropSpecs) {
      const y = getTerrainHeight(sp.x, sp.z);
      const root = new THREE.Group();
      root.position.set(sp.x, y, sp.z);

      // Carved stone weapon plinth
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.8, 0.35, 8),
        createBotWToonMaterial({ color: '#78756e', map: textureBank.getStoneMasonryTexture().map })
      );
      plinth.position.y = 0.175;
      root.add(plinth);

      // Floating rotating `sword_shield.glb` pickup!
      const spinHolder = new THREE.Group();
      spinHolder.position.y = 0.55;
      const glb = modelLoader.instantiate('sword_shield', { scaleMultiplier: 0.72 });
      if (glb) {
        spinHolder.add(glb.root);
      } else {
        const fallback = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 1.0, 0.08),
          createBotWToonMaterial({ color: '#e4c465', metalHighlight: true })
        );
        fallback.position.y = 0.5;
        spinHolder.add(fallback);
      }
      root.add(spinHolder);

      // Subtle golden ground shimmer ring
      const glintRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.035, 6, 18),
        new THREE.MeshBasicMaterial({ color: '#ffe87a', transparent: true, opacity: 0.72 })
      );
      glintRing.rotation.x = Math.PI / 2;
      glintRing.position.y = 0.38;
      root.add(glintRing);

      this.group.add(root);
      this.weaponDrops.push({
        id: sp.id,
        nameJa: sp.nameJa,
        weaponId: sp.weaponId,
        position: new THREE.Vector3(sp.x, y, sp.z),
        collected: false,
        root,
        spinTarget: spinHolder,
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

    const lockPlate = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), emblemMat);
    lockPlate.scale.set(1.0, 1.25, 0.35);
    lockPlate.position.set(0, 0.58, 0.46);
    parent.add(lockPlate);

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

    for (const sx of [-0.52, 0, 0.52]) {
      const lidStrap = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.045, 6, 14, Math.PI), bandMat);
      lidStrap.rotation.y = Math.PI / 2;
      lidStrap.position.set(sx, 0, 0.44);
      lidPivot.add(lidStrap);
    }

    parent.add(lidPivot);
    return lidPivot;
  }

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

    spawnMetalBox('metal_box_1', '鉄の箱', -288, 444);
    spawnMetalBox('metal_box_2', '鉄の箱', -222, 428);
    spawnMetalBox('minecart_lower', 'トロッコ（下段・マグネ対応）', -266, 466, 0, true);
    spawnMetalBox('minecart_upper', 'トロッコ（上段・フライングマシン用）', -266, 466, 0.92, true);
    spawnMetalBox('minecart_eldin_1', 'デスマウンテントロッコ', 462, -748, 0, true);

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
    if (chest.rewardPreview) {
      chest.rewardPreview.visible = true;
    }
  }

  collectWeaponDrop(drop: WorldWeaponDrop): void {
    drop.collected = true;
    drop.spinTarget.visible = false;
  }

  update(dt: number, timeSec: number): void {
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

    for (const db of this.divineBeasts) {
      if (db.id === 'vah_ruta') {
        db.movingPart.rotation.x = Math.sin(timeSec * 0.4) * 0.35;
      } else if (db.id === 'vah_rudania') {
        db.movingPart.rotation.z = Math.sin(timeSec * 0.35) * 0.38;
      } else if (db.id === 'vah_medoh') {
        const a = timeSec * 0.08;
        db.root.position.x = -1080 + Math.cos(a) * 65;
        db.root.position.z = -500 + Math.sin(a) * 65;
        db.root.rotation.y = -a;
        db.movingPart.rotation.z = Math.sin(timeSec * 0.8) * 0.22;
      } else if (db.id === 'vah_naboris') {
        db.movingPart.rotation.z += dt * 0.35;
      }
    }

    for (const wm of this.windmillBlades) {
      wm.rotation.z -= dt * 0.9;
    }
    for (const p of this.cookingPots) {
      p.flameMesh.scale.y = 0.85 + 0.25 * Math.sin(timeSec * 12 + p.position.x);
    }
    for (const t of this.torches) {
      if (!t.lit) continue;
      const flicker = 0.86 + 0.26 * Math.sin(timeSec * 14 + t.position.x * 1.7);
      t.flameMesh.scale.set(0.95 + 0.1 * Math.cos(timeSec * 11), flicker, 0.95);
      t.outerFlame.scale.set(1.0, 0.9 + 0.22 * Math.sin(timeSec * 9.5 + t.position.z), 1.0);
      t.flameMesh.rotation.y += dt * 3.0;
    }
    for (const wd of this.weaponDrops) {
      if (wd.collected) continue;
      wd.spinTarget.rotation.y = timeSec * 1.15;
      wd.spinTarget.position.y = 0.56 + Math.sin(timeSec * 2.6 + wd.position.x) * 0.08;
    }
    for (const c of this.chests) {
      if (c.opened && c.openAnim < 1) {
        c.openAnim = Math.min(1, c.openAnim + dt * 2.2);
        if (c.lidPivot) c.lidPivot.rotation.x = -c.openAnim * 1.4;
        const beamMat = c.glowBeam.material as THREE.MeshBasicMaterial;
        beamMat.opacity = Math.sin(c.openAnim * Math.PI) * 0.78;
        if (c.rewardPreview) {
          c.rewardPreview.position.y = 1.05 + c.openAnim * 0.95;
          c.rewardPreview.rotation.y += dt * 4.5;
          if (c.openAnim >= 0.99) c.rewardPreview.visible = false;
        }
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
