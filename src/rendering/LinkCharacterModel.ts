import * as THREE from 'three';
import { createBotWToonMaterial } from './BotWToonShader';
import { modelLoader } from './ModelLoader';
import { textureBank } from './ProceduralTextures';
import type { ArmorPiece } from '../types/botw';

export type HeroAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'crouch'
  | 'jump'
  | 'climb'
  | 'swim'
  | 'paraglide'
  | 'shield_surf'
  | 'attack'
  | 'spin_attack'
  | 'bow_aim'
  | 'guard'
  | 'flurry_rush'
  | 'ride';

export interface HeroEquipmentVisuals {
  headPiece: ArmorPiece | null;
  bodyPiece: ArmorPiece | null;
  legsPiece: ArmorPiece | null;
  headDyeHex?: string | null;
  bodyDyeHex?: string | null;
  legsDyeHex?: string | null;
  weaponId?: string | null;
  shieldId?: string | null;
  bowId?: string | null;
  weaponDrawn: boolean;
  isMasterSword: boolean;
  weaponColor: string;
  shieldColor: string;
  bowDrawn: boolean;
  paragliderOpen: boolean;
  shieldSurfing: boolean;
  holdingTorchFire: boolean;
  hasSheikahSlate?: boolean;
}

interface PoseTargets {
  pelvisY: number;
  pelvisRot: THREE.Euler;
  torsoRot: THREE.Euler;
  headRot: THREE.Euler;
  leftArm: THREE.Euler;
  rightArm: THREE.Euler;
  leftForearm: THREE.Euler;
  rightForearm: THREE.Euler;
  leftLeg: THREE.Euler;
  rightLeg: THREE.Euler;
  leftShin: THREE.Euler;
  rightShin: THREE.Euler;
}

function lerpEuler(target: THREE.Euler, goal: THREE.Euler, alpha: number): void {
  target.x = THREE.MathUtils.lerp(target.x, goal.x, alpha);
  target.y = THREE.MathUtils.lerp(target.y, goal.y, alpha);
  target.z = THREE.MathUtils.lerp(target.z, goal.z, alpha);
}

/**
 * High-detail 6.5-head stylized sculpted BotW Link model (1.60m tall, bottom strictly grounded at y = 0).
 * Features:
 * - Distortion-free frontal orthographic-blended UV head + 1024x1024 painted BotW anime face
 * - Layered TubeGeometry sculpted bangs, sideburns, ponytail & flowing blue ribbon tails
 * - 1024x1024 Champion's Tunic Master Sword chest embroidery + separate matching sleeve weave
 * - Hip-mounted glowing Sheikah Slate with handle loop, belt pouches & cuffed boots
 * - Sculpted Master Sword & Hylian Shield + integrated `sword_shield.glb` & `torch.glb` gear
 * - Smooth exponential joint interpolation (zero pose snapping across all 17 HeroAnimStates)
 */
export class LinkCharacterModel {
  public readonly root = new THREE.Group();
  public readonly pelvis = new THREE.Group();
  public readonly torso = new THREE.Group();
  public readonly headGroup = new THREE.Group();
  public readonly leftArm = new THREE.Group();
  public readonly rightArm = new THREE.Group();
  public readonly leftForearm = new THREE.Group();
  public readonly rightForearm = new THREE.Group();
  public readonly leftLeg = new THREE.Group();
  public readonly rightLeg = new THREE.Group();
  public readonly leftShin = new THREE.Group();
  public readonly rightShin = new THREE.Group();

  // Dynamic equipment & armor visual anchors
  private torsoMesh!: THREE.Mesh;
  private skirtMesh!: THREE.Mesh;
  private collarMesh!: THREE.Mesh;
  private leftSleeveMesh!: THREE.Mesh;
  private rightSleeveMesh!: THREE.Mesh;
  private leftShoulderMesh!: THREE.Mesh;
  private rightShoulderMesh!: THREE.Mesh;
  private leftCuffMesh!: THREE.Mesh;
  private rightCuffMesh!: THREE.Mesh;
  private leftThighMesh!: THREE.Mesh;
  private rightThighMesh!: THREE.Mesh;
  private leftBootMesh!: THREE.Mesh;
  private rightBootMesh!: THREE.Mesh;
  private leftFootMesh!: THREE.Mesh;
  private rightFootMesh!: THREE.Mesh;
  private headArmorGroup = new THREE.Group();
  private capeMesh!: THREE.Mesh;
  private ponytailGroup = new THREE.Group();
  private sheikahSlateGroup = new THREE.Group();
  private backGearGroup = new THREE.Group();
  private backSwordGroup!: THREE.Group;
  private backShieldGroup!: THREE.Group;
  private backGlbCrestGroup = new THREE.Group();
  private handSwordGroup = new THREE.Group();
  private handTorchGroup = new THREE.Group();
  private torchFlameMesh!: THREE.Mesh;
  private torchLight!: THREE.PointLight;
  private handShieldGroup = new THREE.Group();
  private handBowGroup = new THREE.Group();
  private paragliderGroup = new THREE.Group();
  private surfShieldGroup = new THREE.Group();
  private swordSlashArc!: THREE.Mesh;
  private hairGroup = new THREE.Group();

  private skinMat: THREE.MeshToonMaterial;
  private hairMat: THREE.MeshToonMaterial;
  private tunicMat: THREE.MeshToonMaterial;
  private sleeveMat: THREE.MeshToonMaterial;
  private pantsMat: THREE.MeshToonMaterial;
  private bootMat: THREE.MeshToonMaterial;
  private headArmorMat: THREE.MeshToonMaterial;
  private capeMat: THREE.MeshToonMaterial;
  private swordBladeMat: THREE.MeshToonMaterial;

  private animPhase = 0;
  private attackSwingTimer = 0;
  private attackComboIndex = 0;
  private lastVisualSignature = '';
  private poseGoal: PoseTargets;

  constructor() {
    this.root.name = 'LinkHeroRig';

    const championFab = textureBank.getFabricTexture('#2a84b8', '#e6ca7a', 'champion');
    const sleeveFab = textureBank.getFabricTexture('#2a84b8', '#e6ca7a', 'weave');
    const leatherTex = textureBank.getWoodPlankTexture('#8c5d3c');
    const pantsFab = textureBank.getFabricTexture('#dcd2b8', '#b0a282', 'weave');

    this.skinMat = createBotWToonMaterial({ color: '#f6d5b2', rimStrength: 0.26, rimTint: '#fff0dc', warmSkinShadow: true });
    this.hairMat = createBotWToonMaterial({ color: '#dfb854', rimStrength: 0.42, rimTint: '#fff4bc', warmSkinShadow: true });
    this.tunicMat = createBotWToonMaterial({
      color: '#ffffff',
      map: championFab.map,
      normalMap: championFab.normalMap,
      rimStrength: 0.32,
    });
    this.sleeveMat = createBotWToonMaterial({
      color: '#ffffff',
      map: sleeveFab.map,
      normalMap: sleeveFab.normalMap,
      rimStrength: 0.30,
    });
    this.pantsMat = createBotWToonMaterial({
      color: '#ffffff',
      map: pantsFab.map,
      normalMap: pantsFab.normalMap,
      rimStrength: 0.24,
    });
    this.bootMat = createBotWToonMaterial({
      color: '#b88b68',
      map: leatherTex.map,
      normalMap: leatherTex.normalMap,
      rimStrength: 0.28,
    });
    this.headArmorMat = createBotWToonMaterial({
      color: '#345e3d',
      map: pantsFab.map,
      rimStrength: 0.35,
    });
    this.capeMat = createBotWToonMaterial({
      color: '#2c5438',
      map: pantsFab.map,
      side: THREE.DoubleSide,
      rimStrength: 0.32,
    });
    this.swordBladeMat = createBotWToonMaterial({
      color: '#d8e6f8',
      metalHighlight: true,
      rimStrength: 0.55,
      rimTint: '#9ce6ff',
    });

    this.poseGoal = {
      pelvisY: 0.82,
      pelvisRot: new THREE.Euler(),
      torsoRot: new THREE.Euler(),
      headRot: new THREE.Euler(),
      leftArm: new THREE.Euler(0, 0, 0.14),
      rightArm: new THREE.Euler(0, 0, -0.14),
      leftForearm: new THREE.Euler(-0.18, 0, 0),
      rightForearm: new THREE.Euler(-0.18, 0, 0),
      leftLeg: new THREE.Euler(),
      rightLeg: new THREE.Euler(),
      leftShin: new THREE.Euler(),
      rightShin: new THREE.Euler(),
    };

    this.buildBodyHierarchy();
    this.buildHeadAndHair();
    this.buildWeaponsAndParaglider();
    this.enableShadows();
  }

  private buildBodyHierarchy(): void {
    // Pelvis at hip height ~0.82m (total hero height = 1.60m, authentic 6.5-head BotW proportions)
    this.pelvis.position.set(0, 0.82, 0);
    this.root.add(this.pelvis);

    const pelvisGeo = new THREE.CapsuleGeometry(0.122, 0.09, 8, 16);
    pelvisGeo.scale(1.16, 0.85, 0.90);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, this.pantsMat);
    this.pelvis.add(pelvisMesh);

    this.torso.position.set(0, 0.06, 0);
    this.pelvis.add(this.torso);

    // Fuller athletic hero torso via LatheGeometry with phiStart = PI so u=0.5 faces +Z (front chest!)
    const torsoPoints = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.122, 0.02),
      new THREE.Vector2(0.118, 0.14),
      new THREE.Vector2(0.150, 0.28),
      new THREE.Vector2(0.164, 0.39),
      new THREE.Vector2(0.118, 0.45),
      new THREE.Vector2(0.064, 0.48),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPoints, 24, Math.PI, Math.PI * 2);
    torsoGeo.scale(1.06, 1.0, 0.84);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.tunicMat);
    this.torso.add(this.torsoMesh);

    // Flowing split tunic skirt hem (remap V to [0.0, 0.22] so bottom diamond trim appears cleanly without repeating chest emblem!)
    const skirtPoints = [
      new THREE.Vector2(0.172, -0.26),
      new THREE.Vector2(0.156, -0.14),
      new THREE.Vector2(0.140, -0.04),
      new THREE.Vector2(0.126, 0.04),
    ];
    const skirtGeo = new THREE.LatheGeometry(skirtPoints, 24, Math.PI, Math.PI * 2);
    skirtGeo.scale(1.12, 1.0, 0.88);
    const skirtUv = skirtGeo.attributes.uv;
    for (let i = 0; i < skirtUv.count; i++) {
      skirtUv.setY(i, skirtUv.getY(i) * 0.22);
    }
    skirtUv.needsUpdate = true;
    this.skirtMesh = new THREE.Mesh(skirtGeo, this.tunicMat);
    this.skirtMesh.position.y = 0.04;
    this.torso.add(this.skirtMesh);

    // Standing tunic collar + undershirt ivory V-neck trim
    const collarGeo = new THREE.TorusGeometry(0.088, 0.024, 10, 20);
    collarGeo.rotateX(Math.PI / 2);
    this.collarMesh = new THREE.Mesh(collarGeo, this.sleeveMat);
    this.collarMesh.position.set(0, 0.462, 0.008);
    this.torso.add(this.collarMesh);

    const innerShirtMat = createBotWToonMaterial({ color: '#ede4cc', rimStrength: 0.2 });
    const vNeck = new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.08, 4), innerShirtMat);
    vNeck.rotation.z = Math.PI;
    vNeck.position.set(0, 0.445, 0.095);
    vNeck.scale.set(1.0, 1.0, 0.35);
    this.torso.add(vNeck);

    // Heroic Double-Strapped Leather Belt + Brass Buckle + Hip Pouch + Cross-Chest Baldric Strap
    const beltMat = createBotWToonMaterial({ color: '#b48258', map: textureBank.getWoodPlankTexture('#8c5d3c').map, rimStrength: 0.28 });
    const brassMat = createBotWToonMaterial({ color: '#ecc85c', metalHighlight: true, rimStrength: 0.4 });
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.022, 8, 22), beltMat);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1.10, 0.88, 1.0);
    belt.position.y = 0.052;
    this.torso.add(belt);

    const subBelt = new THREE.Mesh(new THREE.TorusGeometry(0.136, 0.013, 6, 20), beltMat);
    subBelt.rotation.set(Math.PI / 2 + 0.14, 0, 0.10);
    subBelt.scale.set(1.11, 0.89, 1.0);
    subBelt.position.y = 0.018;
    this.torso.add(subBelt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.048, 0.028), brassMat);
    buckle.position.set(0, 0.052, 0.124);
    this.torso.add(buckle);

    const hipPouch = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.082, 0.042), beltMat);
    hipPouch.position.set(0.142, -0.01, 0.058);
    hipPouch.rotation.set(0.08, -0.45, -0.1);
    const pouchClasp = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.016), brassMat);
    pouchClasp.position.set(0, 0.006, 0.022);
    hipPouch.add(pouchClasp);
    this.torso.add(hipPouch);

    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.46, 10), beltMat);
    strap.position.set(0, 0.25, 0.118);
    strap.rotation.z = -0.58;
    strap.scale.set(1.6, 1, 0.45);
    const strapBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.036, 0.022), brassMat);
    strapBuckle.position.set(0.072, 0.34, 0.125);
    strapBuckle.rotation.z = -0.58;
    this.torso.add(strap, strapBuckle);

    // Hip-mounted glowing Sheikah Slate with authentic frame, eye lens & top handle ring!
    const sheikahTex = textureBank.getSheikahStoneTexture();
    const slateMat = createBotWToonMaterial({
      color: '#465060',
      map: sheikahTex.map,
      emissive: '#22ddff',
      emissiveMap: sheikahTex.emissiveMap,
      emissiveIntensity: 1.5,
      sheikahCircuit: true,
      sheikahActivated: 1.0,
      sheikahHeight: 0.2,
    });
    const slateBody = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.142, 0.024), slateMat);
    const slateHandle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 12, Math.PI), brassMat);
    slateHandle.position.set(0, 0.072, 0);
    const slateEye = new THREE.Mesh(
      new THREE.CircleGeometry(0.022, 12),
      new THREE.MeshBasicMaterial({ color: '#42ecff' })
    );
    slateEye.position.set(0, 0.008, 0.014);
    this.sheikahSlateGroup.add(slateBody, slateHandle, slateEye);
    this.sheikahSlateGroup.position.set(-0.165, -0.025, 0.025);
    this.sheikahSlateGroup.rotation.set(0.1, 0.38, 0.15);
    this.torso.add(this.sheikahSlateGroup);

    // Optional Hood/Cloak Cape
    const capeGeo = new THREE.PlaneGeometry(0.46, 0.78, 8, 10);
    const cp = capeGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const y = cp.getY(i);
      const frac = 0.5 - y / 0.78;
      cp.setX(i, cp.getX(i) * (0.65 + frac * 0.68));
      cp.setZ(i, -frac * 0.14 - Math.sin(frac * Math.PI) * 0.045);
    }
    capeGeo.computeVertexNormals();
    this.capeMesh = new THREE.Mesh(capeGeo, this.capeMat);
    this.capeMesh.position.set(0, 0.12, -0.155);
    this.capeMesh.visible = false;
    this.torso.add(this.capeMesh);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.056, 0.095, 12), this.skinMat);
    neck.position.set(0, 0.50, 0);
    this.torso.add(neck);

    // Seamless Arms (Shoulder -> Upper Arm Sleeve -> Elbow Cuff -> Leather Bracer -> Hand)
    const buildArm = (side: -1 | 1, armGrp: THREE.Group, forearmGrp: THREE.Group) => {
      armGrp.position.set(side * 0.205, 0.405, 0);
      this.torso.add(armGrp);

      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), this.sleeveMat);
      shoulder.scale.set(1.06, 0.96, 1.0);
      armGrp.add(shoulder);

      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.18, 8, 14), this.sleeveMat);
      upperArm.position.y = -0.12;
      armGrp.add(upperArm);

      // Folded sleeve cuff ring above elbow
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.012, 8, 14), innerShirtMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.21;
      armGrp.add(cuff);

      forearmGrp.position.set(0, -0.23, 0);
      armGrp.add(forearmGrp);

      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.17, 8, 14), this.bootMat);
      forearm.position.y = -0.10;
      forearmGrp.add(forearm);

      // Leather bracer strap & brass stud
      const bracerRing = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.008, 6, 12), beltMat);
      bracerRing.rotation.x = Math.PI / 2;
      bracerRing.position.y = -0.165;
      forearmGrp.add(bracerRing);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.041, 12, 10), this.skinMat);
      hand.scale.set(0.92, 1.14, 0.76);
      hand.position.y = -0.22;
      forearmGrp.add(hand);

      return { upperArm, shoulder, cuff };
    };

    const lArmParts = buildArm(-1, this.leftArm, this.leftForearm);
    const rArmParts = buildArm(1, this.rightArm, this.rightForearm);
    this.leftSleeveMesh = lArmParts.upperArm;
    this.rightSleeveMesh = rArmParts.upperArm;
    this.leftShoulderMesh = lArmParts.shoulder;
    this.rightShoulderMesh = rArmParts.shoulder;
    this.leftCuffMesh = lArmParts.cuff;
    this.rightCuffMesh = rArmParts.cuff;

    // Seamless Legs (Hip -> Thigh -> Knee overlap -> Sculpted Cuffed Leather Boot grounded at y = 0!)
    const buildLeg = (side: -1 | 1, legGrp: THREE.Group, shinGrp: THREE.Group) => {
      legGrp.position.set(side * 0.095, -0.01, 0);
      this.pelvis.add(legGrp);

      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.30, 8, 14), this.pantsMat);
      thigh.position.y = -0.18;
      legGrp.add(thigh);

      shinGrp.position.set(0, -0.36, 0);
      legGrp.add(shinGrp);

      // Sculpted overlapping cuffed leather boot with folded cuff & boot strap
      const bootPoints = [
        new THREE.Vector2(0.050, -0.45),
        new THREE.Vector2(0.056, -0.32),
        new THREE.Vector2(0.060, -0.14),
        new THREE.Vector2(0.080, -0.02),
        new THREE.Vector2(0.076, 0.045),
        new THREE.Vector2(0.056, 0.045),
      ];
      const bootGeo = new THREE.LatheGeometry(bootPoints, 16);
      const boot = new THREE.Mesh(bootGeo, this.bootMat);
      shinGrp.add(boot);

      const bootStrap = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.009, 6, 14), beltMat);
      bootStrap.rotation.x = Math.PI / 2;
      bootStrap.position.y = -0.12;
      shinGrp.add(bootStrap);

      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.105, 8, 12), this.bootMat);
      foot.rotation.x = Math.PI / 2;
      foot.position.set(0, -0.405, 0.058);
      shinGrp.add(foot);

      return { thigh, boot, foot };
    };

    const lLegParts = buildLeg(-1, this.leftLeg, this.leftShin);
    const rLegParts = buildLeg(1, this.rightLeg, this.rightShin);
    this.leftThighMesh = lLegParts.thigh;
    this.rightThighMesh = rLegParts.thigh;
    this.leftBootMesh = lLegParts.boot;
    this.rightBootMesh = rLegParts.boot;
    this.leftFootMesh = lLegParts.foot;
    this.rightFootMesh = rLegParts.foot;
  }

  private buildHeadAndHair(): void {
    this.headGroup.position.set(0, 0.56, 0.01);
    this.torso.add(this.headGroup);

    // High-resolution sculpted anime head with phiStart = -PI/2 so native seam sits at -Z (back of head)
    // and u=0.5 sits cleanly at +Z (front center of face)!
    const headGeo = new THREE.SphereGeometry(0.130, 34, 28, -Math.PI / 2, Math.PI * 2);
    const pos = headGeo.attributes.position;
    const uv = headGeo.attributes.uv;

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Refined BotW anime jawline, cheekbone taper & subtle nose/chin profile
      const chinTaper = y < 0 ? 1.0 + y * 1.48 : 1.0;
      const cheekSoft = y < 0.02 && y > -0.06 && z > 0.03 ? 1.025 : 1.0;
      x = x * 0.93 * Math.max(0.68, chinTaper) * cheekSoft;
      y = y * 1.055;
      const chinPull = y < -0.045 && z > 0.02 ? 0.014 * Math.min(1, (-y - 0.045) / 0.07) : 0;
      const noseSubtle = Math.abs(x) < 0.022 && y < 0.01 && y > -0.045 && z > 0.095 ? 0.007 * (1 - Math.abs(x) / 0.022) : 0;
      z = z * 0.97 + chinPull + noseSubtle;
      pos.setXYZ(i, x, y, z);

      // Distortion-free frontal orthographic-blended UV mapping calibrated 1:1 to 1024x1024 getHeroFaceTexture()!
      const frontW = THREE.MathUtils.smoothstep(z, 0.0, 0.042);
      if (frontW > 0) {
        const uOrtho = THREE.MathUtils.clamp(0.5 + x / 0.34, 0.04, 0.96);
        const vOrtho = THREE.MathUtils.clamp(0.495 + y / 0.31, 0.04, 0.96);
        uv.setXY(
          i,
          THREE.MathUtils.lerp(uv.getX(i), uOrtho, frontW),
          THREE.MathUtils.lerp(uv.getY(i), vOrtho, frontW)
        );
      }
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    headGeo.computeVertexNormals();

    const faceMat = createBotWToonMaterial({
      color: '#ffffff',
      map: textureBank.getHeroFaceTexture('#f6d5b2', '#2686e8'),
      rimStrength: 0.24,
      rimTint: '#fff2e0',
      warmSkinShadow: true,
    });
    const headMesh = new THREE.Mesh(headGeo, faceMat);
    headMesh.position.y = 0.085;
    this.headGroup.add(headMesh);

    // Iconic Pointed Hylian Ears + small blue BotW earring studs
    const earGeo = new THREE.ConeGeometry(0.022, 0.098, 8);
    const earringMat = createBotWToonMaterial({ color: '#3896e8', metalHighlight: true });
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, this.skinMat);
      ear.position.set(side * 0.118, 0.072, -0.010);
      ear.rotation.set(-0.16, side * 0.35, -side * 1.26);
      this.headGroup.add(ear);

      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), earringMat);
      stud.position.set(side * 0.114, 0.048, -0.004);
      this.headGroup.add(stud);
    }

    // Layered Sculpted BotW Golden-Blond Hair (TubeGeometry flowing curved locks + crown + long sideburns + ponytail!)
    this.hairGroup.position.set(0, 0.085, 0);
    this.headGroup.add(this.hairGroup);

    const hairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.142, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.58),
      this.hairMat
    );
    hairCrown.position.set(0, 0.020, -0.012);
    hairCrown.rotation.x = -0.18;
    this.hairGroup.add(hairCrown);

    // Sculpted back hair volume hugging the occipital curve
    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.136, 20, 14, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.45),
      this.hairMat
    );
    hairBack.position.set(0, -0.005, -0.025);
    hairBack.rotation.x = 0.15;
    this.hairGroup.add(hairBack);

    // Helper: creates a tapered curved hair lock via TubeGeometry + radial tip taper
    const addCurvedLock = (pts: [number, number, number][], baseRadius: number, parent: THREE.Object3D = this.hairGroup) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      const tubularSegs = 10;
      const radialSegs = 7;
      const geo = new THREE.TubeGeometry(curve, tubularSegs, baseRadius, radialSegs, false);
      const pAttr = geo.attributes.position;
      const tmp = new THREE.Vector3();
      const center = new THREE.Vector3();
      for (let i = 0; i <= tubularSegs; i++) {
        const t = i / tubularSegs;
        curve.getPointAt(t, center);
        // Smooth taper: fuller near root/mid, crisp pointed anime lock tip!
        const taper = t < 0.2 ? 0.72 + t * 1.4 : Math.max(0.08, 1.0 - Math.pow((t - 0.2) / 0.8, 1.45));
        for (let j = 0; j <= radialSegs; j++) {
          const idx = i * (radialSegs + 1) + j;
          tmp.fromBufferAttribute(pAttr, idx).sub(center).multiplyScalar(taper).add(center);
          pAttr.setXYZ(idx, tmp.x, tmp.y, tmp.z);
        }
      }
      pAttr.needsUpdate = true;
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this.hairMat);
      parent.add(mesh);
    };

    // Sweeping center-parted BotW bangs framing the forehead cleanly ABOVE Link's eyebrows & eyes!
    addCurvedLock([[0.0, 0.142, 0.042], [-0.042, 0.122, 0.104], [-0.080, 0.082, 0.114], [-0.104, 0.036, 0.098]], 0.025);
    addCurvedLock([[0.0, 0.142, 0.042], [0.044, 0.122, 0.104], [0.082, 0.082, 0.114], [0.106, 0.036, 0.098]], 0.025);
    addCurvedLock([[-0.012, 0.144, 0.056], [-0.038, 0.116, 0.120], [-0.064, 0.086, 0.122]], 0.019);
    addCurvedLock([[0.014, 0.144, 0.056], [0.040, 0.116, 0.120], [0.066, 0.086, 0.122]], 0.019);
    // Crown windswept ahoge/tuft strands for lively silhouette
    addCurvedLock([[0.0, 0.146, 0.01], [-0.035, 0.168, -0.025], [-0.075, 0.148, -0.055]], 0.018);
    addCurvedLock([[0.008, 0.148, 0.005], [0.045, 0.170, -0.022], [0.082, 0.146, -0.052]], 0.017);

    // Iconic BotW long sideburns draping cleanly in front of Hylian ears!
    addCurvedLock([[-0.088, 0.085, 0.072], [-0.116, 0.015, 0.068], [-0.112, -0.055, 0.055], [-0.095, -0.112, 0.040]], 0.024);
    addCurvedLock([[0.088, 0.085, 0.072], [0.116, 0.015, 0.068], [0.112, -0.055, 0.055], [0.095, -0.112, 0.040]], 0.024);
    // Secondary temple strands tucked behind ears
    addCurvedLock([[-0.102, 0.065, 0.015], [-0.122, -0.008, -0.015], [-0.108, -0.075, -0.042]], 0.022);
    addCurvedLock([[0.102, 0.065, 0.015], [0.122, -0.008, -0.015], [0.108, -0.075, -0.042]], 0.022);

    // Back tied BotW ponytail + flowing royal-blue hair ribbon (animated in updateAnimation!)
    this.ponytailGroup.position.set(0, -0.022, -0.132);
    this.hairGroup.add(this.ponytailGroup);

    const ribbonMat = createBotWToonMaterial({ color: '#2b5d9a', rimStrength: 0.35 });
    const hairTie = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.010, 8, 14), ribbonMat);
    hairTie.rotation.x = 0.65;
    this.ponytailGroup.add(hairTie);

    addCurvedLock([[0, 0, 0], [0, -0.055, -0.036], [0, -0.125, -0.052], [0, -0.185, -0.035]], 0.038, this.ponytailGroup);
    addCurvedLock([[-0.014, -0.005, -0.005], [-0.032, -0.068, -0.038], [-0.038, -0.138, -0.045]], 0.022, this.ponytailGroup);
    addCurvedLock([[0.014, -0.005, -0.005], [0.032, -0.068, -0.038], [0.038, -0.138, -0.045]], 0.022, this.ponytailGroup);

    for (const s of [-1, 1]) {
      const tailRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.11, 0.005), ribbonMat);
      tailRibbon.position.set(s * 0.022, -0.058, -0.018);
      tailRibbon.rotation.set(0.35, 0, s * 0.24);
      this.ponytailGroup.add(tailRibbon);
    }

    this.headArmorGroup.position.set(0, 0.085, 0);
    this.headGroup.add(this.headArmorGroup);
  }

  private buildWeaponsAndParaglider(): void {
    this.backGearGroup.position.set(0, 0.26, -0.158);
    this.torso.add(this.backGearGroup);

    const buildSwordMesh = (withScabbard = false): THREE.Group => {
      const g = new THREE.Group();
      const hiltMat = createBotWToonMaterial({ color: '#3b4ca8', metalHighlight: true });
      const gripWrapMat = createBotWToonMaterial({ color: '#274f38', rimStrength: 0.25 });
      const goldMat = createBotWToonMaterial({ color: '#ecc85a', metalHighlight: true });
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.021, 0.24, 10), gripWrapMat);
      g.add(grip);
      const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.030, 0), goldMat);
      pommel.position.y = -0.132;
      g.add(pommel);
      // Sculpted Winged Master Sword Crossguard
      const guardCore = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.052, 0.034), hiltMat);
      guardCore.position.y = 0.132;
      const guardL = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.032, 0.028), hiltMat);
      guardL.position.set(-0.075, 0.142, 0);
      guardL.rotation.z = 0.36;
      const guardR = guardL.clone();
      guardR.position.x = 0.075;
      guardR.rotation.z = -0.36;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.026, 0), goldMat);
      gem.position.set(0, 0.132, 0.020);
      g.add(guardCore, guardL, guardR, gem);

      if (withScabbard) {
        const scabbardMat = createBotWToonMaterial({ color: '#21408a', metalHighlight: true });
        const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.78, 0.032), scabbardMat);
        scabbard.position.y = 0.54;
        const tipCap = new THREE.Mesh(new THREE.ConeGeometry(0.046, 0.14, 4), goldMat);
        tipCap.position.y = 0.96;
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.068, 0.038), goldMat);
        band.position.y = 0.24;
        const midBand = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.042, 0.036), goldMat);
        midBand.position.y = 0.62;
        g.add(scabbard, tipCap, band, midBand);
      } else {
        // Tapered diamond-section Master Sword blade with Triforce fuller accent
        const bladeGeo = new THREE.ConeGeometry(0.048, 0.90, 4);
        bladeGeo.scale(1.0, 1.0, 0.28);
        const blade = new THREE.Mesh(bladeGeo, this.swordBladeMat);
        blade.position.y = 0.59;
        const ricasso = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.12, 0.022), this.swordBladeMat);
        ricasso.position.y = 0.20;
        g.add(ricasso, blade);
      }
      return g;
    };

    const buildHylianShieldMesh = (): THREE.Group => {
      const g = new THREE.Group();
      const silverMat = createBotWToonMaterial({ color: '#d0dae6', metalHighlight: true });
      const shieldCrestMat = createBotWToonMaterial({
        color: '#ffffff',
        map: textureBank.getHylianShieldTexture(),
        metalHighlight: true,
        rimStrength: 0.42,
      });

      const shape = new THREE.Shape();
      shape.moveTo(0, 0.30);
      shape.lineTo(0.22, 0.24);
      shape.quadraticCurveTo(0.24, -0.04, 0, -0.32);
      shape.quadraticCurveTo(-0.24, -0.04, -0.22, 0.24);
      shape.closePath();

      const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
      const uv = bodyGeo.attributes.uv;
      const posAttr = bodyGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        uv.setXY(i, (posAttr.getX(i) + 0.24) / 0.48, (posAttr.getY(i) + 0.32) / 0.62);
      }
      uv.needsUpdate = true;

      const rim = new THREE.Mesh(bodyGeo, silverMat);
      rim.scale.set(1.07, 1.05, 0.85);
      const plate = new THREE.Mesh(bodyGeo, shieldCrestMat);
      plate.position.z = 0.009;
      g.add(rim, plate);
      return g;
    };

    // Back-sheathed Master Sword inside Royal Scabbard + Hylian Shield
    this.backSwordGroup = buildSwordMesh(true);
    this.backSwordGroup.position.set(0.16, 0.28, -0.01);
    this.backSwordGroup.rotation.set(0.06, 0, 2.68);
    this.backSwordGroup.name = 'backSword';
    this.backGearGroup.add(this.backSwordGroup);

    this.backShieldGroup = buildHylianShieldMesh();
    this.backShieldGroup.position.set(-0.01, 0.02, -0.048);
    this.backShieldGroup.rotation.y = Math.PI;
    this.backShieldGroup.name = 'backShield';
    this.backGearGroup.add(this.backShieldGroup);

    // Optional `sword_shield.glb` Golden Crest Back Gear (shown when wielding Royal / Traveler / non-Master-Sword gear!)
    this.backGlbCrestGroup.position.set(0, -0.24, -0.062);
    this.backGlbCrestGroup.rotation.y = Math.PI;
    this.backGlbCrestGroup.visible = false;
    this.backGearGroup.add(this.backGlbCrestGroup);
    const mountBackGlbCrest = () => {
      if (this.backGlbCrestGroup.children.length > 0) return;
      const inst = modelLoader.instantiate('sword_shield', { scaleMultiplier: 0.78 });
      if (inst) this.backGlbCrestGroup.add(inst.root);
    };
    mountBackGlbCrest();
    modelLoader.onModelLoaded('sword_shield', mountBackGlbCrest);

    // Hand-drawn Sword (Right Hand)
    this.handSwordGroup.position.set(0, -0.24, 0.04);
    this.handSwordGroup.rotation.set(Math.PI / 2, 0, 0);
    this.handSwordGroup.add(buildSwordMesh());
    this.handSwordGroup.visible = false;
    this.rightForearm.add(this.handSwordGroup);

    // Hand-drawn Torch (`torch.glb` + dynamic flickering flame!)
    this.handTorchGroup.position.set(0, -0.22, 0.05);
    this.handTorchGroup.rotation.set(Math.PI * 0.44, 0, 0);
    this.handTorchGroup.visible = false;
    const mountHandTorch = () => {
      if (this.handTorchGroup.getObjectByName('torchGlb')) return;
      const inst = modelLoader.instantiate('torch', { scaleMultiplier: 0.56 });
      if (inst) {
        inst.root.name = 'torchGlb';
        inst.root.position.set(0, -0.08, 0);
        this.handTorchGroup.add(inst.root);
      } else {
        const stick = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.018, 0.65, 8),
          createBotWToonMaterial({ color: '#6b4528' })
        );
        stick.name = 'torchFallback';
        stick.position.y = 0.24;
        this.handTorchGroup.add(stick);
      }
    };
    mountHandTorch();
    modelLoader.onModelLoaded('torch', () => {
      const fb = this.handTorchGroup.getObjectByName('torchFallback');
      if (fb) this.handTorchGroup.remove(fb);
      mountHandTorch();
    });
    this.torchFlameMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.22, 7),
      new THREE.MeshBasicMaterial({ color: '#ff8e24', transparent: true, opacity: 0.92 })
    );
    this.torchFlameMesh.position.set(0, 0.52, 0);
    this.torchLight = new THREE.PointLight('#ff9428', 2.4, 9.0);
    this.torchLight.position.set(0, 0.56, 0);
    this.handTorchGroup.add(this.torchFlameMesh, this.torchLight);
    this.rightForearm.add(this.handTorchGroup);

    // Dynamic Slash Ribbon Arc
    const slashGeo = new THREE.RingGeometry(0.7, 1.45, 18, 1, -Math.PI * 0.65, Math.PI * 1.3);
    const slashMat = new THREE.MeshBasicMaterial({
      color: '#a8ecff',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.swordSlashArc = new THREE.Mesh(slashGeo, slashMat);
    this.swordSlashArc.rotation.x = Math.PI / 2;
    this.swordSlashArc.position.set(0, 1.05, 0.35);
    this.root.add(this.swordSlashArc);

    // Hand-drawn Shield (Left Forearm)
    this.handShieldGroup.position.set(-0.06, -0.14, 0.04);
    this.handShieldGroup.rotation.set(0, -Math.PI / 2, 0);
    this.handShieldGroup.add(buildHylianShieldMesh());
    this.handShieldGroup.visible = false;
    this.leftForearm.add(this.handShieldGroup);

    // Hand-drawn Bow (Left Hand)
    const bowWood = createBotWToonMaterial({ color: '#7a5230', map: textureBank.getWoodPlankTexture().map });
    const bowArch = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 8, 18, Math.PI * 1.15), bowWood);
    bowArch.rotation.z = -Math.PI * 0.58;
    const bowString = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.80, 4),
      new THREE.MeshBasicMaterial({ color: '#f2ead8' })
    );
    bowString.position.x = -0.08;
    this.handBowGroup.add(bowArch, bowString);
    this.handBowGroup.position.set(0, -0.22, 0.14);
    this.handBowGroup.rotation.y = Math.PI / 2;
    this.handBowGroup.visible = false;
    this.leftForearm.add(this.handBowGroup);

    // Shield Surfing board under feet
    this.surfShieldGroup.add(buildHylianShieldMesh());
    this.surfShieldGroup.rotation.x = -Math.PI / 2;
    this.surfShieldGroup.position.set(0, 0.06, 0);
    this.surfShieldGroup.visible = false;
    this.root.add(this.surfShieldGroup);

    // Iconic BotW Paraglider!
    const gliderWood = createBotWToonMaterial({ color: '#6b472a', map: textureBank.getWoodPlankTexture().map });
    const gliderCloth = createBotWToonMaterial({
      color: '#f2e8d2',
      map: textureBank.getFabricTexture('#f2e8d2', '#c88b3a', 'weave').map,
      side: THREE.DoubleSide,
      rimStrength: 0.45,
    });
    const sparL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.35, 6), gliderWood);
    sparL.rotation.z = 1.28;
    sparL.position.set(-0.56, 0.18, 0);
    const sparR = sparL.clone();
    sparR.rotation.z = -1.28;
    sparR.position.x = 0.56;
    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 6), gliderWood);
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, -0.18, 0);
    const wingGeo = new THREE.PlaneGeometry(2.35, 0.92, 10, 3);
    wingGeo.rotateX(-Math.PI / 2);
    const wp = wingGeo.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      const x = wp.getX(i);
      wp.setY(i, 0.24 - Math.abs(x) * 0.16);
      wp.setZ(i, wp.getZ(i) + Math.abs(x) * 0.18);
    }
    wingGeo.computeVertexNormals();
    const wingMesh = new THREE.Mesh(wingGeo, gliderCloth);
    wingMesh.position.y = 0.12;
    this.paragliderGroup.add(sparL, sparR, handleBar, wingMesh);
    this.paragliderGroup.position.set(0, 1.88, 0.08);
    this.paragliderGroup.visible = false;
    this.root.add(this.paragliderGroup);
  }

  private enableShadows(): void {
    this.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj !== this.swordSlashArc && obj !== this.torchFlameMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

  /**
   * Synchronizes Link's 3D appearance with ALL equipped armor pieces, Kochi Dye colors,
   * naked/underwear state, Master Sword / Torch / `sword_shield.glb` gear, shield, bow, and paraglider!
   */
  applyEquipmentVisuals(vis: HeroEquipmentVisuals): void {
    const sig = JSON.stringify([
      vis.headPiece?.id,
      vis.bodyPiece?.id,
      vis.legsPiece?.id,
      vis.headDyeHex,
      vis.bodyDyeHex,
      vis.legsDyeHex,
      vis.isMasterSword,
      vis.weaponColor,
      vis.weaponId,
      vis.shieldId,
    ]);

    if (sig !== this.lastVisualSignature) {
      this.lastVisualSignature = sig;
      this.rebuildArmorAppearance(vis);
    }

    const hasWeapon = !!vis.weaponId;
    const hasShield = !!vis.shieldId;
    const useTorch = hasWeapon && (vis.holdingTorchFire || vis.weaponId === 'torch');
    const useGlbCrestBack =
      hasWeapon && hasShield && !vis.isMasterSword && vis.shieldId !== 'hylian_shield' && this.backGlbCrestGroup.children.length > 0;

    this.backSwordGroup.visible = hasWeapon && !vis.weaponDrawn && !useGlbCrestBack;
    this.backShieldGroup.visible = hasShield && !vis.weaponDrawn && !vis.shieldSurfing && !useGlbCrestBack;
    this.backGlbCrestGroup.visible = !vis.weaponDrawn && !vis.shieldSurfing && useGlbCrestBack;

    this.handSwordGroup.visible = hasWeapon && vis.weaponDrawn && !useTorch && !vis.bowDrawn && !vis.paragliderOpen;
    this.handTorchGroup.visible = hasWeapon && vis.weaponDrawn && useTorch && !vis.bowDrawn && !vis.paragliderOpen;
    this.handShieldGroup.visible = hasShield && vis.weaponDrawn && !vis.bowDrawn && !vis.paragliderOpen && !vis.shieldSurfing;
    this.handBowGroup.visible = !!vis.bowId && vis.bowDrawn && !vis.paragliderOpen;
    this.paragliderGroup.visible = vis.paragliderOpen;
    this.surfShieldGroup.visible = hasShield && vis.shieldSurfing;
    this.sheikahSlateGroup.visible = vis.hasSheikahSlate !== false;
  }

  private rebuildArmorAppearance(vis: HeroEquipmentVisuals): void {
    // 1. BODY ARMOR (or bare torso + bare shoulders if unequipped!)
    if (!vis.bodyPiece) {
      this.torsoMesh.material = this.skinMat;
      this.leftSleeveMesh.material = this.skinMat;
      this.rightSleeveMesh.material = this.skinMat;
      this.leftShoulderMesh.material = this.skinMat;
      this.rightShoulderMesh.material = this.skinMat;
      this.leftCuffMesh.visible = false;
      this.rightCuffMesh.visible = false;
      this.skirtMesh.visible = false;
      this.collarMesh.visible = false;
      this.capeMesh.visible = false;
    } else {
      const baseHex = vis.bodyDyeHex ?? vis.bodyPiece.baseColor;
      const pattern =
        vis.bodyPiece.id === 'champions_tunic'
          ? 'champion'
          : vis.bodyPiece.setId === 'gerudo_vai' || vis.bodyPiece.setId === 'desert_voe'
          ? 'gerudo'
          : vis.bodyPiece.setId === 'stealth'
          ? 'sheikah'
          : 'weave';
      const fab = textureBank.getFabricTexture(baseHex, vis.bodyPiece.accentColor, pattern);
      const sleeveFab = textureBank.getFabricTexture(baseHex, vis.bodyPiece.accentColor, 'weave');

      this.tunicMat.map = fab.map;
      this.tunicMat.normalMap = fab.normalMap;
      this.tunicMat.color.set('#ffffff');
      this.tunicMat.emissive.set(vis.bodyPiece.effect === 'night_glow' ? '#20f0b4' : '#000000');
      this.tunicMat.emissiveIntensity = vis.bodyPiece.effect === 'night_glow' ? 0.85 : 0;
      this.tunicMat.needsUpdate = true;

      this.sleeveMat.map = sleeveFab.map;
      this.sleeveMat.normalMap = sleeveFab.normalMap;
      this.sleeveMat.color.set('#ffffff');
      this.sleeveMat.emissive.set(vis.bodyPiece.effect === 'night_glow' ? '#20f0b4' : '#000000');
      this.sleeveMat.emissiveIntensity = vis.bodyPiece.effect === 'night_glow' ? 0.85 : 0;
      this.sleeveMat.needsUpdate = true;

      this.torsoMesh.material = this.tunicMat;
      this.leftSleeveMesh.material = this.sleeveMat;
      this.rightSleeveMesh.material = this.sleeveMat;
      this.leftShoulderMesh.material = this.sleeveMat;
      this.rightShoulderMesh.material = this.sleeveMat;
      this.leftCuffMesh.visible = true;
      this.rightCuffMesh.visible = true;
      this.skirtMesh.visible = true;
      this.collarMesh.visible = true;

      const showCape =
        vis.headPiece?.id === 'hylian_hood' ||
        vis.bodyPiece.setId === 'phantom_ganon' ||
        vis.bodyPiece.setId === 'dark' ||
        vis.bodyPiece.setId === 'royal_guard';
      this.capeMesh.visible = showCape;
      if (showCape) {
        this.capeMat.color.set(vis.headDyeHex ?? vis.bodyDyeHex ?? vis.bodyPiece.baseColor);
      }
    }

    // 2. LEGS ARMOR (or authentic BotW blue boxer shorts + bare feet if unequipped!)
    if (!vis.legsPiece) {
      const shortsFab = textureBank.getFabricTexture('#3a618f', '#89b4e2', 'weave');
      this.pantsMat.map = shortsFab.map;
      this.pantsMat.color.set('#ffffff');
      this.leftThighMesh.material = this.skinMat;
      this.rightThighMesh.material = this.skinMat;
      this.leftBootMesh.material = this.skinMat;
      this.rightBootMesh.material = this.skinMat;
      this.leftFootMesh.material = this.skinMat;
      this.rightFootMesh.material = this.skinMat;
    } else {
      const legHex = vis.legsDyeHex ?? vis.legsPiece.baseColor;
      const fab = textureBank.getFabricTexture(legHex, vis.legsPiece.accentColor, 'weave');
      this.pantsMat.map = fab.map;
      this.pantsMat.color.set('#ffffff');
      this.leftThighMesh.material = this.pantsMat;
      this.rightThighMesh.material = this.pantsMat;
      this.leftBootMesh.material = this.bootMat;
      this.rightBootMesh.material = this.bootMat;
      this.leftFootMesh.material = this.bootMat;
      this.rightFootMesh.material = this.bootMat;
      this.bootMat.color.set(vis.legsPiece.accentColor || '#8c5d3c').lerp(new THREE.Color('#e6cbb0'), 0.52);
    }

    // 3. HEADGEAR GEOMETRY (dynamic sculpted hood/helm/circlet/mask!)
    while (this.headArmorGroup.children.length > 0) {
      this.headArmorGroup.remove(this.headArmorGroup.children[0]);
    }
    this.hairGroup.visible = true;
    if (vis.headPiece) {
      const hCol = vis.headDyeHex ?? vis.headPiece.baseColor;
      this.headArmorMat.color.set(hCol);
      this.headArmorMat.emissive.set(vis.headPiece.effect === 'night_glow' ? '#24f0c0' : '#000000');
      this.headArmorMat.emissiveIntensity = vis.headPiece.effect === 'night_glow' ? 0.9 : 0;

      if (vis.headPiece.id.includes('hood') || vis.headPiece.id.includes('cap') || vis.headPiece.setId === 'dark' || vis.headPiece.setId === 'tingle') {
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.148, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), this.headArmorMat);
        hood.position.set(0, 0.015, -0.015);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 8), this.headArmorMat);
        tail.position.set(0, 0.04, -0.17);
        tail.rotation.x = -1.15;
        this.headArmorGroup.add(hood, tail);
      } else if (vis.headPiece.id.includes('circlet') || vis.headPiece.id.includes('earrings')) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.012, 6, 18), createBotWToonMaterial({ color: '#e6c65e', metalHighlight: true }));
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.06;
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), createBotWToonMaterial({ color: vis.headPiece.accentColor, emissive: vis.headPiece.accentColor, emissiveIntensity: 0.4 }));
        gem.position.set(0, 0.065, 0.136);
        this.headArmorGroup.add(band, gem);
      } else if (vis.headPiece.id === 'gerudo_veil') {
        const veil = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.11, 0.095, 14, 1, true, -Math.PI * 0.5, Math.PI), this.headArmorMat);
        veil.position.set(0, -0.03, 0.02);
        const crown = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.014, 6, 16), createBotWToonMaterial({ color: '#f0c850', metalHighlight: true }));
        crown.rotation.x = Math.PI / 2;
        crown.position.y = 0.06;
        this.headArmorGroup.add(veil, crown);
      } else if (vis.headPiece.id === 'korok_mask') {
        const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.03, 7), createBotWToonMaterial({ color: '#78b848' }));
        leaf.rotation.x = Math.PI / 2;
        leaf.position.set(0, 0.02, 0.135);
        this.headArmorGroup.add(leaf);
      } else if (vis.headPiece.id === 'majoras_mask') {
        const mask = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 1), createBotWToonMaterial({ color: '#6b2c91', emissive: '#ffaa14', emissiveIntensity: 0.35 }));
        mask.scale.set(1.0, 1.15, 0.35);
        mask.position.set(0, 0.02, 0.13);
        this.headArmorGroup.add(mask);
      } else {
        const helm = new THREE.Mesh(new THREE.SphereGeometry(0.152, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68), this.headArmorMat);
        helm.position.set(0, 0.02, 0);
        this.headArmorGroup.add(helm);
        if (vis.headPiece.setId === 'barbarian' || vis.headPiece.setId === 'phantom_ganon') {
          const hornMat = createBotWToonMaterial({ color: '#efe6d0' });
          for (const s of [-1, 1]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 7), hornMat);
            horn.position.set(s * 0.14, 0.12, 0.02);
            horn.rotation.z = -s * 0.65;
            this.headArmorGroup.add(horn);
          }
        } else if (vis.headPiece.id === 'thunder_helm') {
          const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 6), createBotWToonMaterial({ color: '#f5cb42', metalHighlight: true }));
          fin.position.set(0, 0.20, 0);
          this.headArmorGroup.add(fin);
        }
      }
    }

    // 4. Sword glow (Master Sword glows celestial cyan!)
    this.swordBladeMat.color.set(vis.isMasterSword ? '#b8f2ff' : vis.weaponColor || '#d8e4f0');
    this.swordBladeMat.emissive.set(vis.isMasterSword ? '#1ec8ff' : '#000000');
    this.swordBladeMat.emissiveIntensity = vis.isMasterSword ? 0.65 : 0;
  }

  triggerAttackSwing(comboIdx: number): void {
    this.attackSwingTimer = 0.32;
    this.attackComboIndex = comboIdx;
  }

  updateAnimation(dt: number, state: HeroAnimState, moveSpeed: number, isSpinAttack = false): void {
    this.animPhase += dt * (state === 'sprint' ? 12.2 : state === 'run' ? 9.2 : state === 'walk' ? 6.4 : 2.5);
    const p = this.animPhase;
    const g = this.poseGoal;

    // Reset pose goals cleanly before computing state target pose
    g.pelvisY = 0.82;
    g.pelvisRot.set(0, 0, 0);
    g.torsoRot.set(0, 0, 0);
    g.headRot.set(0, 0, 0);
    g.leftArm.set(0, 0, 0.13);
    g.rightArm.set(0, 0, -0.13);
    g.leftForearm.set(-0.18, 0, 0);
    g.rightForearm.set(-0.18, 0, 0);
    g.leftLeg.set(0, 0, 0);
    g.rightLeg.set(0, 0, 0);
    g.leftShin.set(0, 0, 0);
    g.rightShin.set(0, 0, 0);

    if (state === 'idle') {
      g.pelvisY = 0.82 + Math.sin(p) * 0.011;
      g.torsoRot.x = Math.sin(p * 0.5) * 0.024;
      g.headRot.y = Math.sin(p * 0.35) * 0.06;
      g.leftArm.set(0.04, 0, 0.15 + Math.sin(p) * 0.025);
      g.rightArm.set(0.04, 0, -0.15 - Math.sin(p) * 0.025);
      if (this.handTorchGroup.visible) {
        g.rightArm.set(-0.78, -0.1, -0.18);
        g.rightForearm.set(-0.48, 0, 0);
      }
    } else if (state === 'walk' || state === 'run' || state === 'sprint') {
      const amp = state === 'sprint' ? 0.88 : state === 'run' ? 0.68 : 0.42;
      const lean = state === 'sprint' ? 0.24 : state === 'run' ? 0.14 : 0.05;
      g.pelvisY = 0.80 + Math.abs(Math.sin(p)) * (state === 'sprint' ? 0.065 : 0.04);
      g.torsoRot.set(lean, Math.sin(p) * 0.13, -Math.sin(p) * 0.03);
      g.headRot.set(-lean * 0.45, -Math.sin(p) * 0.06, 0);
      g.leftLeg.set(Math.sin(p) * amp, 0, 0);
      g.rightLeg.set(-Math.sin(p) * amp, 0, 0);
      g.leftShin.set(Math.max(0, -Math.cos(p) * amp * 0.92), 0, 0);
      g.rightShin.set(Math.max(0, Math.cos(p) * amp * 0.92), 0, 0);
      g.leftArm.set(-Math.sin(p) * amp * 0.85, 0, 0.12);
      g.rightArm.set(this.handTorchGroup.visible ? -0.82 : Math.sin(p) * amp * 0.85, 0, -0.12);
      g.leftForearm.set(-0.52, 0, 0);
      g.rightForearm.set(this.handTorchGroup.visible ? -0.45 : -0.52, 0, 0);
    } else if (state === 'crouch') {
      g.pelvisY = 0.60;
      g.torsoRot.set(0.36, 0, 0);
      g.headRot.set(-0.26, 0, 0);
      g.leftLeg.set(-0.75 + Math.sin(p) * (moveSpeed > 0.2 ? 0.35 : 0), 0, 0);
      g.rightLeg.set(-0.75 - Math.sin(p) * (moveSpeed > 0.2 ? 0.35 : 0), 0, 0);
      g.leftShin.set(1.25, 0, 0);
      g.rightShin.set(1.25, 0, 0);
      g.leftArm.set(-0.22, 0, 0.22);
      g.rightArm.set(-0.22, 0, -0.22);
    } else if (state === 'jump') {
      g.pelvisY = 0.88;
      g.torsoRot.set(0.08, 0, 0);
      g.leftLeg.set(-0.45, 0, 0);
      g.rightLeg.set(0.32, 0, 0);
      g.leftShin.set(0.85, 0, 0);
      g.rightShin.set(0.25, 0, 0);
      g.leftArm.set(-0.5, 0, 0.65);
      g.rightArm.set(-0.5, 0, -0.65);
    } else if (state === 'paraglide') {
      g.pelvisY = 0.78 + Math.sin(p * 1.4) * 0.03;
      g.torsoRot.set(0.14, 0, Math.sin(p * 1.1) * 0.04);
      g.leftArm.set(-2.65, 0, 0.25);
      g.rightArm.set(-2.65, 0, -0.25);
      g.leftLeg.set(0.25 + Math.sin(p * 1.2) * 0.1, 0, 0);
      g.rightLeg.set(0.32 - Math.sin(p * 1.2) * 0.1, 0, 0);
      this.paragliderGroup.rotation.z = THREE.MathUtils.lerp(
        this.paragliderGroup.rotation.z,
        Math.sin(p * 1.4) * 0.045,
        1 - Math.exp(-8 * dt)
      );
    } else if (state === 'climb') {
      const cp = p * (moveSpeed > 0.2 ? 1.35 : 0.25);
      g.torsoRot.set(0.10, 0, 0);
      g.headRot.set(-0.22, 0, 0);
      g.leftArm.set(-1.95 + Math.sin(cp) * 0.55, 0, 0.25);
      g.rightArm.set(-1.95 - Math.sin(cp) * 0.55, 0, -0.25);
      g.leftForearm.set(-0.55, 0, 0);
      g.rightForearm.set(-0.55, 0, 0);
      g.leftLeg.set(-0.58 - Math.sin(cp) * 0.42, 0, 0.14);
      g.rightLeg.set(-0.58 + Math.sin(cp) * 0.42, 0, -0.14);
      g.leftShin.set(0.92, 0, 0);
      g.rightShin.set(0.92, 0, 0);
    } else if (state === 'swim') {
      g.pelvisY = 0.55;
      g.torsoRot.set(1.15, 0, 0);
      g.headRot.set(-0.85, 0, 0);
      g.leftArm.set(-1.6 + Math.sin(p * 1.6) * 0.9, 0, 0.3);
      g.rightArm.set(-1.6 - Math.sin(p * 1.6) * 0.9, 0, -0.3);
      g.leftLeg.set(Math.sin(p * 2.2) * 0.45, 0, 0);
      g.rightLeg.set(-Math.sin(p * 2.2) * 0.45, 0, 0);
    } else if (state === 'shield_surf') {
      g.pelvisY = 0.72;
      g.pelvisRot.set(0, 0.72, 0);
      g.torsoRot.set(0.2, 0, 0);
      g.leftLeg.set(-0.4, 0, 0);
      g.rightLeg.set(-0.2, 0, 0);
      g.leftShin.set(0.7, 0, 0);
      g.rightShin.set(0.5, 0, 0);
      g.leftArm.set(0, 0, 1.05);
      g.rightArm.set(0, 0, -1.05);
    } else if (state === 'bow_aim') {
      g.torsoRot.set(0, -0.65, 0);
      g.headRot.set(0, 0.65, 0);
      g.leftArm.set(-1.45, 0.65, 0);
      g.rightArm.set(-1.45, -0.25, -0.4);
      g.rightForearm.set(-0.4, 0, 0.8);
    } else if (state === 'guard') {
      g.torsoRot.set(0.05, -0.28, 0);
      g.leftArm.set(-1.15, 0.55, 0.25);
      g.rightArm.set(-0.55, -0.2, -0.3);
    } else if (state === 'ride') {
      g.pelvisY = 0.74;
      g.torsoRot.set(0.18, 0, 0);
      g.leftLeg.set(-0.9, 0, 0.35);
      g.rightLeg.set(-0.9, 0, -0.35);
      g.leftShin.set(1.1, 0, 0);
      g.rightShin.set(1.1, 0, 0);
      g.leftArm.set(-0.95, 0, 0.14);
      g.rightArm.set(-0.95, 0, -0.14);
    }

    // Sword attack swing overlay + glowing slash arc
    const isAttacking = this.attackSwingTimer > 0;
    if (isAttacking) {
      this.attackSwingTimer = Math.max(0, this.attackSwingTimer - dt);
      const t = 1 - this.attackSwingTimer / 0.32;
      const dir = this.attackComboIndex % 2 === 0 ? 1 : -1;
      if (isSpinAttack) {
        g.pelvisRot.y = t * Math.PI * 2;
        g.rightArm.set(-1.45, 0, -1.2);
      } else {
        g.torsoRot.y = dir * (-0.9 + t * 1.9);
        g.rightArm.set(-1.35, dir * (-1.1 + t * 2.2), -0.45);
      }
      const slashMat = this.swordSlashArc.material as THREE.MeshBasicMaterial;
      slashMat.opacity = Math.sin(t * Math.PI) * 0.78;
      this.swordSlashArc.rotation.z = dir * (-1.2 + t * 2.8);
      this.swordSlashArc.scale.setScalar(isSpinAttack ? 1.55 : 1.05);
    } else {
      (this.swordSlashArc.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    // Smooth exponential joint interpolation (fluid transitions with zero pose snapping!)
    const blendSpeed = isAttacking ? 34.0 : 15.5;
    const alpha = 1 - Math.exp(-blendSpeed * Math.max(0.001, dt));
    this.pelvis.position.y = THREE.MathUtils.lerp(this.pelvis.position.y, g.pelvisY, alpha);
    lerpEuler(this.pelvis.rotation, g.pelvisRot, alpha);
    lerpEuler(this.torso.rotation, g.torsoRot, alpha);
    lerpEuler(this.headGroup.rotation, g.headRot, alpha);
    lerpEuler(this.leftArm.rotation, g.leftArm, alpha);
    lerpEuler(this.rightArm.rotation, g.rightArm, alpha);
    lerpEuler(this.leftForearm.rotation, g.leftForearm, alpha);
    lerpEuler(this.rightForearm.rotation, g.rightForearm, alpha);
    lerpEuler(this.leftLeg.rotation, g.leftLeg, alpha);
    lerpEuler(this.rightLeg.rotation, g.rightLeg, alpha);
    lerpEuler(this.leftShin.rotation, g.leftShin, alpha);
    lerpEuler(this.rightShin.rotation, g.rightShin, alpha);

    // Secondary physics: Ponytail wind sway & cape flutter
    const sway = Math.min(0.45, moveSpeed * 0.045);
    this.ponytailGroup.rotation.x = THREE.MathUtils.lerp(
      this.ponytailGroup.rotation.x,
      sway + Math.sin(p * 1.6) * 0.08,
      1 - Math.exp(-10 * dt)
    );
    this.ponytailGroup.rotation.z = THREE.MathUtils.lerp(
      this.ponytailGroup.rotation.z,
      Math.cos(p * 1.1) * (0.04 + sway * 0.25),
      1 - Math.exp(-10 * dt)
    );

    if (this.capeMesh.visible) {
      this.capeMesh.rotation.x = THREE.MathUtils.lerp(
        this.capeMesh.rotation.x,
        0.12 + Math.min(0.55, moveSpeed * 0.05) + Math.sin(p * 1.8) * 0.06,
        1 - Math.exp(-10 * dt)
      );
    }

    // Dynamic Torch Flame flicker
    if (this.handTorchGroup.visible) {
      const f = 0.85 + Math.sin(p * 5.2) * 0.18 + Math.cos(p * 8.4) * 0.08;
      this.torchFlameMesh.scale.set(0.95 + Math.sin(p * 6.0) * 0.12, f, 0.95 + Math.cos(p * 6.0) * 0.12);
      this.torchLight.intensity = 2.0 + Math.sin(p * 7.1) * 0.55;
    }
  }
}
