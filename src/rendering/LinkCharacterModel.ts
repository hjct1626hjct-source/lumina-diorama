import * as THREE from 'three';
import { createBotWToonMaterial } from './BotWToonShader';
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
  weaponDrawn: boolean;
  isMasterSword: boolean;
  weaponColor: string;
  shieldColor: string;
  bowDrawn: boolean;
  paragliderOpen: boolean;
  shieldSurfing: boolean;
  holdingTorchFire: boolean;
}

/**
 * High-detail 6.5-head stylized sculpted Link model (1.60m tall, bottom strictly grounded at y = 0).
 * Uses LatheGeometry, tapered curved capsules, sculpted hair locks, pointed Hylian ears,
 * expressive painted anime face texture, dynamic armor/dye swapping (including naked/underwear state),
 * hip-mounted glowing Sheikah Slate, back-sheathed/hand-drawn Master Sword & Hylian Shield,
 * and deployable BotW Paraglider.
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
  private leftThighMesh!: THREE.Mesh;
  private rightThighMesh!: THREE.Mesh;
  private leftBootMesh!: THREE.Mesh;
  private rightBootMesh!: THREE.Mesh;
  private leftFootMesh!: THREE.Mesh;
  private rightFootMesh!: THREE.Mesh;
  private headArmorGroup = new THREE.Group();
  private capeMesh!: THREE.Mesh;
  private sheikahSlateMesh!: THREE.Mesh;
  private backGearGroup = new THREE.Group();
  private handSwordGroup = new THREE.Group();
  private handShieldGroup = new THREE.Group();
  private handBowGroup = new THREE.Group();
  private paragliderGroup = new THREE.Group();
  private surfShieldGroup = new THREE.Group();
  private swordSlashArc!: THREE.Mesh;
  private hairGroup = new THREE.Group();

  private skinMat: THREE.MeshToonMaterial;
  private hairMat: THREE.MeshToonMaterial;
  private tunicMat: THREE.MeshToonMaterial;
  private pantsMat: THREE.MeshToonMaterial;
  private bootMat: THREE.MeshToonMaterial;
  private headArmorMat: THREE.MeshToonMaterial;
  private capeMat: THREE.MeshToonMaterial;
  private swordBladeMat: THREE.MeshToonMaterial;

  private animPhase = 0;
  private attackSwingTimer = 0;
  private attackComboIndex = 0;
  private lastVisualSignature = '';

  constructor() {
    this.root.name = 'LinkHeroRig';

    const championFab = textureBank.getFabricTexture('#2a84b8', '#e6ca7a', 'champion');
    const leatherTex = textureBank.getWoodPlankTexture('#624028');
    const pantsFab = textureBank.getFabricTexture('#dcd2b8', '#b0a282', 'weave');

    this.skinMat = createBotWToonMaterial({ color: '#f6d5b2', rimStrength: 0.28, rimTint: '#fff0dc', warmSkinShadow: true });
    this.hairMat = createBotWToonMaterial({ color: '#dfb854', rimStrength: 0.42, rimTint: '#fff4bc', warmSkinShadow: true });
    this.tunicMat = createBotWToonMaterial({
      color: '#ffffff',
      map: championFab.map,
      normalMap: championFab.normalMap,
      rimStrength: 0.34,
    });
    this.pantsMat = createBotWToonMaterial({
      color: '#ffffff',
      map: pantsFab.map,
      normalMap: pantsFab.normalMap,
      rimStrength: 0.24,
    });
    this.bootMat = createBotWToonMaterial({
      color: '#6b452a',
      map: leatherTex.map,
      normalMap: leatherTex.normalMap,
      rimStrength: 0.26,
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

    this.buildBodyHierarchy();
    this.buildHeadAndHair();
    this.buildWeaponsAndParaglider();
    this.enableShadows();
  }

  private buildBodyHierarchy(): void {
    // Pelvis at hip height ~0.82m (total hero height = 1.60m, 6.5-head proportions!)
    this.pelvis.position.set(0, 0.82, 0);
    this.root.add(this.pelvis);

    const pelvisGeo = new THREE.CapsuleGeometry(0.122, 0.09, 8, 14);
    pelvisGeo.scale(1.16, 0.85, 0.90);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, this.pantsMat);
    this.pelvis.add(pelvisMesh);

    this.torso.position.set(0, 0.06, 0);
    this.pelvis.add(this.torso);

    // Fuller natural athletic hero torso via LatheGeometry
    const torsoPoints = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.122, 0.02),
      new THREE.Vector2(0.120, 0.14),
      new THREE.Vector2(0.152, 0.30),
      new THREE.Vector2(0.162, 0.40),
      new THREE.Vector2(0.102, 0.46),
      new THREE.Vector2(0.056, 0.48),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPoints, 18);
    torsoGeo.scale(1.06, 1.0, 0.84);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.tunicMat);
    this.torso.add(this.torsoMesh);

    // Flowing split tunic skirt hem
    const skirtPoints = [
      new THREE.Vector2(0.165, -0.25),
      new THREE.Vector2(0.148, -0.10),
      new THREE.Vector2(0.128, 0.04),
    ];
    const skirtGeo = new THREE.LatheGeometry(skirtPoints, 18);
    skirtGeo.scale(1.12, 1.0, 0.88);
    this.skirtMesh = new THREE.Mesh(skirtGeo, this.tunicMat);
    this.skirtMesh.position.y = 0.04;
    this.torso.add(this.skirtMesh);

    // Standing tunic collar
    const collarGeo = new THREE.TorusGeometry(0.088, 0.026, 8, 16);
    collarGeo.rotateX(Math.PI / 2);
    this.collarMesh = new THREE.Mesh(collarGeo, this.tunicMat);
    this.collarMesh.position.set(0, 0.46, 0.01);
    this.torso.add(this.collarMesh);

    // Heroic Leather Belt + Brass Buckle + Cross-Chest Baldric Strap
    const beltMat = createBotWToonMaterial({ color: '#5b3a22', rimStrength: 0.22 });
    const brassMat = createBotWToonMaterial({ color: '#e6c25a', metalHighlight: true });
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.022, 8, 18), beltMat);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1.10, 0.88, 1.0);
    belt.position.y = 0.05;
    this.torso.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.048, 0.026), brassMat);
    buckle.position.set(0, 0.05, 0.124);
    this.torso.add(buckle);

    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 8), beltMat);
    strap.position.set(0, 0.25, 0.118);
    strap.rotation.z = -0.58;
    strap.scale.set(1.6, 1, 0.45);
    this.torso.add(strap);

    // Hip-mounted glowing Sheikah Slate!
    const sheikahTex = textureBank.getSheikahStoneTexture();
    const slateMat = createBotWToonMaterial({
      color: '#465060',
      map: sheikahTex.map,
      emissive: '#22ddff',
      emissiveMap: sheikahTex.emissiveMap,
      emissiveIntensity: 1.4,
      sheikahCircuit: true,
      sheikahActivated: 1.0,
      sheikahHeight: 0.2,
    });
    this.sheikahSlateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.145, 0.026), slateMat);
    this.sheikahSlateMesh.position.set(-0.165, -0.02, 0.02);
    this.sheikahSlateMesh.rotation.set(0.1, 0.35, 0.15);
    this.torso.add(this.sheikahSlateMesh);

    // Optional Hood/Cloak Cape
    const capeGeo = new THREE.PlaneGeometry(0.44, 0.74, 6, 8);
    const cp = capeGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const y = cp.getY(i);
      const frac = 0.5 - y / 0.74;
      cp.setX(i, cp.getX(i) * (0.65 + frac * 0.65));
      cp.setZ(i, -frac * 0.14 - Math.sin(frac * Math.PI) * 0.04);
    }
    capeGeo.computeVertexNormals();
    this.capeMesh = new THREE.Mesh(capeGeo, this.capeMat);
    this.capeMesh.position.set(0, 0.12, -0.15);
    this.capeMesh.visible = false;
    this.torso.add(this.capeMesh);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.095, 10), this.skinMat);
    neck.position.set(0, 0.50, 0);
    this.torso.add(neck);

    // Seamless Arms (Shoulder -> Upper Arm -> Elbow -> Forearm Bracer -> Hand)
    const buildArm = (side: -1 | 1, armGrp: THREE.Group, forearmGrp: THREE.Group) => {
      armGrp.position.set(side * 0.205, 0.405, 0);
      this.torso.add(armGrp);

      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), this.tunicMat);
      armGrp.add(shoulder);

      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.18, 8, 12), this.tunicMat);
      upperArm.position.y = -0.12;
      armGrp.add(upperArm);

      forearmGrp.position.set(0, -0.23, 0);
      armGrp.add(forearmGrp);

      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.17, 8, 12), this.bootMat);
      forearm.position.y = -0.10;
      forearmGrp.add(forearm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), this.skinMat);
      hand.scale.set(0.92, 1.12, 0.78);
      hand.position.y = -0.22;
      forearmGrp.add(hand);

      return { upperArm, shoulder };
    };

    const lArmParts = buildArm(-1, this.leftArm, this.leftForearm);
    const rArmParts = buildArm(1, this.rightArm, this.rightForearm);
    this.leftSleeveMesh = lArmParts.upperArm;
    this.rightSleeveMesh = rArmParts.upperArm;
    this.leftShoulderMesh = lArmParts.shoulder;
    this.rightShoulderMesh = rArmParts.shoulder;

    // Seamless Legs (Hip -> Thigh -> Knee overlap -> Cuffed Leather Boot grounded at y = 0!)
    const buildLeg = (side: -1 | 1, legGrp: THREE.Group, shinGrp: THREE.Group) => {
      legGrp.position.set(side * 0.095, -0.01, 0);
      this.pelvis.add(legGrp);

      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.30, 8, 12), this.pantsMat);
      thigh.position.y = -0.18;
      legGrp.add(thigh);

      shinGrp.position.set(0, -0.36, 0);
      legGrp.add(shinGrp);

      // Sculpted overlapping cuffed leather boot (extends slightly above shin pivot so ZERO seam gap!)
      const bootPoints = [
        new THREE.Vector2(0.050, -0.45),
        new THREE.Vector2(0.056, -0.32),
        new THREE.Vector2(0.060, -0.14),
        new THREE.Vector2(0.078, -0.02),
        new THREE.Vector2(0.074, 0.04),
        new THREE.Vector2(0.056, 0.04),
      ];
      const bootGeo = new THREE.LatheGeometry(bootPoints, 14);
      const boot = new THREE.Mesh(bootGeo, this.bootMat);
      shinGrp.add(boot);

      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.105, 6, 10), this.bootMat);
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

    // Sculpted anime head with graceful chin taper + front-calibrated painted BotW eyes/brows/mouth!
    const headGeo = new THREE.SphereGeometry(0.130, 26, 22);
    const pos = headGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const chinTaper = y < 0 ? 1.0 + y * 1.35 : 1.0;
      const chinPull = y < -0.04 && z > 0 ? 0.016 : 0;
      pos.setXYZ(i, x * 0.93 * Math.max(0.70, chinTaper), y * 1.05, z * 0.97 + chinPull);
    }
    headGeo.computeVertexNormals();

    const faceMat = createBotWToonMaterial({
      color: '#ffffff',
      map: textureBank.getHeroFaceTexture('#f6d5b2', '#2a84e0'),
      rimStrength: 0.25,
      rimTint: '#fff2e0',
      warmSkinShadow: true,
    });
    const headMesh = new THREE.Mesh(headGeo, faceMat);
    // In Three.js SphereGeometry, u=0.5 sits at +X; rotation.y = -PI/2 brings +X cleanly to +Z (front)!
    headMesh.rotation.y = -Math.PI / 2;
    headMesh.position.y = 0.085;
    this.headGroup.add(headMesh);

    // Iconic Pointed Hylian Ears
    const earGeo = new THREE.ConeGeometry(0.022, 0.095, 7);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, this.skinMat);
      ear.position.set(side * 0.120, 0.075, -0.012);
      ear.rotation.set(-0.18, side * 0.35, -side * 1.28);
      this.headGroup.add(ear);
    }

    // Layered BotW Golden-Blond Hair (smooth curved crown + sweeping parted bangs framing eyes cleanly!)
    this.hairGroup.position.set(0, 0.085, 0);
    this.headGroup.add(this.hairGroup);

    // Full rounded top & back hair volume hugging the skull cleanly
    const hairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.142, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
      this.hairMat
    );
    hairCrown.position.set(0, 0.018, -0.012);
    hairCrown.rotation.x = -0.18;
    this.hairGroup.add(hairCrown);

    // Smooth side-parted bangs nested cleanly inside the hairline (smooth rounded silhouette!)
    const makeLock = (x: number, y: number, z: number, rx: number, ry: number, rz: number, r: number, len: number) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 8), this.hairMat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      this.hairGroup.add(m);
    };

    makeLock(-0.078, 0.056, 0.086, 0.14, -0.22, 0.45, 0.022, 0.075);
    makeLock(-0.036, 0.074, 0.098, 0.22, -0.08, 0.72, 0.020, 0.055);
    makeLock(0.038, 0.074, 0.098, 0.22, 0.10, -0.72, 0.020, 0.055);
    makeLock(0.080, 0.056, 0.086, 0.14, 0.22, -0.45, 0.022, 0.075);
    // Iconic BotW long sideburns draping cleanly in front of Hylian ears!
    makeLock(-0.114, -0.018, 0.042, 0.06, 0, 0.10, 0.022, 0.145);
    makeLock(0.114, -0.018, 0.042, 0.06, 0, -0.10, 0.022, 0.145);

    // Back tied BotW ponytail + blue ribbon
    const hairTie = new THREE.Mesh(
      new THREE.TorusGeometry(0.032, 0.01, 6, 10),
      createBotWToonMaterial({ color: '#2b5d9a' })
    );
    hairTie.position.set(0, -0.025, -0.132);
    hairTie.rotation.x = 0.65;
    this.hairGroup.add(hairTie);

    const pony = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.19, 10), this.hairMat);
    pony.position.set(0, -0.105, -0.155);
    pony.rotation.x = 2.72;
    this.hairGroup.add(pony);

    this.headArmorGroup.position.set(0, 0.085, 0);
    this.headGroup.add(this.headArmorGroup);
  }

  private buildWeaponsAndParaglider(): void {
    this.backGearGroup.position.set(0, 0.26, -0.155);
    this.torso.add(this.backGearGroup);

    const buildSwordMesh = (withScabbard = false): THREE.Group => {
      const g = new THREE.Group();
      const hiltMat = createBotWToonMaterial({ color: '#3b4ca8', metalHighlight: true });
      const goldMat = createBotWToonMaterial({ color: '#ecc85a', metalHighlight: true });
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.24, 8), hiltMat);
      g.add(grip);
      const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), goldMat);
      pommel.position.y = -0.13;
      g.add(pommel);
      // Winged Master Sword Crossguard
      const guardL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.032), hiltMat);
      guardL.position.set(-0.07, 0.14, 0);
      guardL.rotation.z = 0.35;
      const guardR = guardL.clone();
      guardR.position.x = 0.07;
      guardR.rotation.z = -0.35;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), goldMat);
      gem.position.set(0, 0.13, 0.018);
      g.add(guardL, guardR, gem);

      if (withScabbard) {
        // Ornate Royal Blue & Gold Master Sword Scabbard when sheathed on Link's back!
        const scabbardMat = createBotWToonMaterial({ color: '#21408a', metalHighlight: true });
        const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.78, 0.032), scabbardMat);
        scabbard.position.y = 0.54;
        const tipCap = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.14, 4), goldMat);
        tipCap.position.y = 0.96;
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.07, 0.038), goldMat);
        band.position.y = 0.24;
        g.add(scabbard, tipCap, band);
      } else {
        const bladeGeo = new THREE.ConeGeometry(0.046, 0.88, 4);
        bladeGeo.scale(1.0, 1.0, 0.28);
        const blade = new THREE.Mesh(bladeGeo, this.swordBladeMat);
        blade.position.y = 0.58;
        g.add(blade);
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

      // Shield kite silhouette via ExtrudeGeometry with properly normalized 0..1 UVs for the Triforce & Loftwing Crest!
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

    // Back-sheathed Master Sword inside Royal Scabbard tucked cleanly diagonally behind Hylian Shield!
    const backSword = buildSwordMesh(true);
    backSword.position.set(0.16, 0.28, -0.01);
    backSword.rotation.set(0.06, 0, 2.68);
    backSword.name = 'backSword';
    this.backGearGroup.add(backSword);

    const backShield = buildHylianShieldMesh();
    backShield.position.set(-0.01, 0.02, -0.048);
    backShield.rotation.y = Math.PI;
    backShield.name = 'backShield';
    this.backGearGroup.add(backShield);

    // Hand-drawn Sword (Right Hand)
    this.handSwordGroup.position.set(0, -0.24, 0.04);
    this.handSwordGroup.rotation.set(Math.PI / 2, 0, 0);
    this.handSwordGroup.add(buildSwordMesh());
    this.handSwordGroup.visible = false;
    this.rightForearm.add(this.handSwordGroup);

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
    const bowArch = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 6, 16, Math.PI * 1.15), bowWood);
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
    const wingGeo = new THREE.PlaneGeometry(2.35, 0.92, 8, 2);
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
      if ((obj as THREE.Mesh).isMesh && obj !== this.swordSlashArc) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

  /**
   * Synchronizes Link's 3D appearance with ALL equipped armor pieces, Kochi Dye colors,
   * naked/underwear state, weapons, shield, bow, and paraglider!
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
    ]);

    if (sig !== this.lastVisualSignature) {
      this.lastVisualSignature = sig;
      this.rebuildArmorAppearance(vis);
    }

    // Drawn vs Sheathed Weapon / Shield / Bow / Paraglider visibility
    const backSword = this.backGearGroup.getObjectByName('backSword');
    const backShield = this.backGearGroup.getObjectByName('backShield');
    if (backSword) backSword.visible = !vis.weaponDrawn;
    if (backShield) backShield.visible = !vis.weaponDrawn && !vis.shieldSurfing;

    this.handSwordGroup.visible = vis.weaponDrawn && !vis.bowDrawn && !vis.paragliderOpen;
    this.handShieldGroup.visible = vis.weaponDrawn && !vis.bowDrawn && !vis.paragliderOpen && !vis.shieldSurfing;
    this.handBowGroup.visible = vis.bowDrawn && !vis.paragliderOpen;
    this.paragliderGroup.visible = vis.paragliderOpen;
    this.surfShieldGroup.visible = vis.shieldSurfing;
  }

  private rebuildArmorAppearance(vis: HeroEquipmentVisuals): void {
    // 1. BODY ARMOR (or bare torso + bare shoulders if unequipped!)
    if (!vis.bodyPiece) {
      this.torsoMesh.material = this.skinMat;
      this.leftSleeveMesh.material = this.skinMat;
      this.rightSleeveMesh.material = this.skinMat;
      this.leftShoulderMesh.material = this.skinMat;
      this.rightShoulderMesh.material = this.skinMat;
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
      this.tunicMat.map = fab.map;
      this.tunicMat.normalMap = fab.normalMap;
      this.tunicMat.color.set('#ffffff');
      this.tunicMat.emissive.set(vis.bodyPiece.effect === 'night_glow' ? '#20f0b4' : '#000000');
      this.tunicMat.emissiveIntensity = vis.bodyPiece.effect === 'night_glow' ? 0.85 : 0;
      this.tunicMat.needsUpdate = true;

      this.torsoMesh.material = this.tunicMat;
      this.leftSleeveMesh.material = this.tunicMat;
      this.rightSleeveMesh.material = this.tunicMat;
      this.leftShoulderMesh.material = this.tunicMat;
      this.rightShoulderMesh.material = this.tunicMat;
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
      this.bootMat.color.set(vis.legsPiece.accentColor || '#5c3c24');
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
        // Sculpted Knight / Barbarian / Zora / Ancient / Thunder Helm
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
    this.animPhase += dt * (state === 'sprint' ? 12.5 : state === 'run' ? 9.5 : state === 'walk' ? 6.5 : 2.6);
    const p = this.animPhase;

    // Reset baseline rotations smoothly
    this.pelvis.position.y = 0.82;
    this.pelvis.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);
    this.leftArm.rotation.set(0, 0, 0.12);
    this.rightArm.rotation.set(0, 0, -0.12);
    this.leftForearm.rotation.set(-0.18, 0, 0);
    this.rightForearm.rotation.set(-0.18, 0, 0);
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);
    this.leftShin.rotation.set(0, 0, 0);
    this.rightShin.rotation.set(0, 0, 0);

    if (state === 'idle') {
      this.pelvis.position.y = 0.82 + Math.sin(p) * 0.012;
      this.torso.rotation.x = Math.sin(p * 0.5) * 0.025;
      this.leftArm.rotation.z = 0.14 + Math.sin(p) * 0.03;
      this.rightArm.rotation.z = -0.14 - Math.sin(p) * 0.03;
    } else if (state === 'walk' || state === 'run' || state === 'sprint') {
      const amp = state === 'sprint' ? 0.88 : state === 'run' ? 0.68 : 0.42;
      const lean = state === 'sprint' ? 0.24 : state === 'run' ? 0.14 : 0.05;
      this.pelvis.position.y = 0.80 + Math.abs(Math.sin(p)) * (state === 'sprint' ? 0.065 : 0.04);
      this.torso.rotation.x = lean;
      this.torso.rotation.y = Math.sin(p) * 0.12;
      this.leftLeg.rotation.x = Math.sin(p) * amp;
      this.rightLeg.rotation.x = -Math.sin(p) * amp;
      this.leftShin.rotation.x = Math.max(0, -Math.cos(p) * amp * 0.9);
      this.rightShin.rotation.x = Math.max(0, Math.cos(p) * amp * 0.9);
      this.leftArm.rotation.x = -Math.sin(p) * amp * 0.85;
      this.rightArm.rotation.x = Math.sin(p) * amp * 0.85;
      this.leftForearm.rotation.x = -0.55;
      this.rightForearm.rotation.x = -0.55;
    } else if (state === 'crouch') {
      this.pelvis.position.y = 0.60;
      this.torso.rotation.x = 0.36;
      this.leftLeg.rotation.x = -0.75 + Math.sin(p) * (moveSpeed > 0.2 ? 0.35 : 0);
      this.rightLeg.rotation.x = -0.75 - Math.sin(p) * (moveSpeed > 0.2 ? 0.35 : 0);
      this.leftShin.rotation.x = 1.25;
      this.rightShin.rotation.x = 1.25;
    } else if (state === 'jump') {
      this.pelvis.position.y = 0.88;
      this.leftLeg.rotation.x = -0.45;
      this.rightLeg.rotation.x = 0.35;
      this.leftShin.rotation.x = 0.85;
      this.leftArm.rotation.set(-0.5, 0, 0.65);
      this.rightArm.rotation.set(-0.5, 0, -0.65);
    } else if (state === 'paraglide') {
      this.pelvis.position.y = 0.78 + Math.sin(p * 1.4) * 0.03;
      this.torso.rotation.x = 0.14;
      this.leftArm.rotation.set(-2.65, 0, 0.25);
      this.rightArm.rotation.set(-2.65, 0, -0.25);
      this.leftLeg.rotation.x = 0.25 + Math.sin(p * 1.2) * 0.1;
      this.rightLeg.rotation.x = 0.32 - Math.sin(p * 1.2) * 0.1;
      this.paragliderGroup.rotation.z = Math.sin(p * 1.4) * 0.04;
    } else if (state === 'climb') {
      const cp = p * 1.2;
      this.torso.rotation.x = 0.08;
      this.leftArm.rotation.x = -1.9 + Math.sin(cp) * 0.6;
      this.rightArm.rotation.x = -1.9 - Math.sin(cp) * 0.6;
      this.leftLeg.rotation.x = -0.55 - Math.sin(cp) * 0.45;
      this.rightLeg.rotation.x = -0.55 + Math.sin(cp) * 0.45;
      this.leftShin.rotation.x = 0.9;
      this.rightShin.rotation.x = 0.9;
    } else if (state === 'swim') {
      this.pelvis.position.y = 0.55;
      this.torso.rotation.x = 1.15;
      this.leftArm.rotation.x = -1.6 + Math.sin(p * 1.6) * 0.9;
      this.rightArm.rotation.x = -1.6 - Math.sin(p * 1.6) * 0.9;
      this.leftLeg.rotation.x = Math.sin(p * 2.2) * 0.45;
      this.rightLeg.rotation.x = -Math.sin(p * 2.2) * 0.45;
    } else if (state === 'shield_surf') {
      this.pelvis.position.y = 0.72;
      this.pelvis.rotation.y = 0.72;
      this.torso.rotation.x = 0.2;
      this.leftLeg.rotation.x = -0.4;
      this.rightLeg.rotation.x = -0.2;
      this.leftShin.rotation.x = 0.7;
      this.rightShin.rotation.x = 0.5;
      this.leftArm.rotation.set(0, 0, 1.05);
      this.rightArm.rotation.set(0, 0, -1.05);
    } else if (state === 'bow_aim') {
      this.torso.rotation.y = -0.65;
      this.headGroup.rotation.y = 0.65;
      this.leftArm.rotation.set(-1.45, 0.65, 0);
      this.rightArm.rotation.set(-1.45, -0.25, -0.4);
      this.rightForearm.rotation.set(-0.4, 0, 0.8);
    } else if (state === 'guard') {
      this.torso.rotation.y = -0.28;
      this.leftArm.rotation.set(-1.15, 0.55, 0.25);
      this.rightArm.rotation.set(-0.55, -0.2, -0.3);
    } else if (state === 'ride') {
      this.pelvis.position.y = 0.74;
      this.torso.rotation.x = 0.18;
      this.leftLeg.rotation.set(-0.9, 0, 0.35);
      this.rightLeg.rotation.set(-0.9, 0, -0.35);
      this.leftShin.rotation.x = 1.1;
      this.rightShin.rotation.x = 1.1;
      this.leftArm.rotation.x = -0.95;
      this.rightArm.rotation.x = -0.95;
    }

    // Sword attack swing overlay + glowing slash arc
    if (this.attackSwingTimer > 0) {
      this.attackSwingTimer = Math.max(0, this.attackSwingTimer - dt);
      const t = 1 - this.attackSwingTimer / 0.32;
      const dir = this.attackComboIndex % 2 === 0 ? 1 : -1;
      if (isSpinAttack) {
        this.pelvis.rotation.y = t * Math.PI * 2;
        this.rightArm.rotation.set(-1.45, 0, -1.2);
      } else {
        this.torso.rotation.y = dir * (-0.9 + t * 1.9);
        this.rightArm.rotation.set(-1.35, dir * (-1.1 + t * 2.2), -0.45);
      }
      const slashMat = this.swordSlashArc.material as THREE.MeshBasicMaterial;
      slashMat.opacity = Math.sin(t * Math.PI) * 0.78;
      this.swordSlashArc.rotation.z = dir * (-1.2 + t * 2.8);
      this.swordSlashArc.scale.setScalar(isSpinAttack ? 1.55 : 1.05);
    } else {
      (this.swordSlashArc.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    // Dynamic cape flutter in wind
    if (this.capeMesh.visible) {
      this.capeMesh.rotation.x = 0.12 + Math.min(0.55, moveSpeed * 0.05) + Math.sin(p * 1.8) * 0.06;
    }
  }
}
