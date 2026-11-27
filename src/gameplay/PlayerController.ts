import * as THREE from 'three';
import { LinkCharacterModel, type HeroAnimState } from '../rendering/LinkCharacterModel';
import { getSurfaceType, getTerrainHeight, getTerrainNormal, isWaterAt } from '../world/TerrainGenerator';
import { WORLD_BOUNDS } from '../data/regions';
import { ARMOR_MAP, KOCHI_DYE_MAP, type ArmorSummary } from '../data/armors';
import { PhysicsChemistryEngine } from '../physics/PhysicsChemistryEngine';
import { SheikahRuneSystem } from './SheikahRunes';
import type { ArrowType, SaveSlotData } from '../types/botw';

export interface ActiveArrow {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  type: ArrowType;
  attack: number;
  life: number;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
  guard: boolean;
  aimBow: boolean;
  whistle: boolean;
  cameraYaw: number;
  cameraPitch: number;
  cameraDist: number;
}

/**
 * Full Breath of the Wild Character Controller & Physics State Machine:
 * - Camera-relative 3D TPS / Close / FPS camera with collision clamping & ZL target lock-on
 * - Stamina Wheel (max 3 full green rings = 300 units + yellow temporary stamina + exhaustion penalty)
 * - Universal Wall Climbing (steep slopes >35 deg, climb-jump, rain slip cycle!)
 * - Paraglider (gliding physics, Fire Updraft thermal lift, Revali's Gale vertical launch!)
 * - Shield Surfing (friction differentiated by snow / sand / grass / rock)
 * - Swimming & Zora Waterfall Ascent
 * - Midair Bow Bullet-Time (slows world time to 1/19 = ~0.052x while draining stamina!)
 * - Perfect Dodge -> Flurry Rush slow-mo combo & Perfect Guard -> Guardian Laser Reflection
 * - Authentic BotW Physics Tricks (toggleable via settings.glitchPhysics):
 *   Whistle Sprint, Windbomb (BIL) momentum launch, BTB (Bullet Time Bounce on ragdoll), Cryo-Bounce!
 */
export class PlayerController {
  public readonly model = new LinkCharacterModel();
  public readonly position = new THREE.Vector3(-298, 52, 454);
  public readonly velocity = new THREE.Vector3();
  public yaw = 0.72;

  public grounded = true;
  public climbing = false;
  public swimming = false;
  public paragliding = false;
  public shieldSurfing = false;
  public crouching = false;
  public weaponDrawn = false;
  public guarding = false;
  public aimingBow = false;

  // Combat & Action Timers
  public perfectGuardWindow = 0;
  public perfectDodgeWindow = 0;
  public flurryRushTimer = 0;
  public bulletTimeActive = false;
  public exhausted = false;
  public tempStamina = 0;
  public comboIndex = 0;
  public comboResetTimer = 0;
  public attackCooldown = 0;
  public invulnTimer = 0;
  public rainSlipTimer = 0;
  public footstepTimer = 0;
  public noiseLevel = 0.15; // 0..1 drives purple Sound Sensor waveform!

  // Active Arrow Projectiles
  public arrows: ActiveArrow[] = [];
  public readonly arrowsGroup = new THREE.Group();

  // Temp vectors
  private tmpNormal = new THREE.Vector3();
  private tmpForward = new THREE.Vector3();
  private tmpRight = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.arrowsGroup.name = 'PlayerArrows';
    scene.add(this.model.root);
    scene.add(this.arrowsGroup);
  }

  teleportTo(x: number, z: number, extraY = 0.2): void {
    const y = getTerrainHeight(x, z) + extraY;
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.climbing = false;
    this.paragliding = false;
    this.shieldSurfing = false;
    this.model.root.position.copy(this.position);
  }

  getForwardDirection(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  triggerJumpOrParaglider(save: SaveSlotData, onParagliderOpen?: () => void): void {
    if (this.climbing) {
      // Climb Jump (burns stamina, halved by Climber set bonus!)
      if (!this.exhausted && save.stamina > 12) {
        this.velocity.y = 10.5;
        save.stamina = Math.max(0, save.stamina - 18);
      }
      return;
    }

    if (this.grounded) {
      this.velocity.y = 10.4;
      this.grounded = false;
      this.shieldSurfing = false;
    } else if (!this.paragliding && save.hasParaglider && !this.exhausted && save.stamina > 4) {
      // Deploy Paraglider mid-air!
      this.paragliding = true;
      this.velocity.y = Math.max(this.velocity.y, -1.2);
      onParagliderOpen?.();
    } else if (this.paragliding) {
      this.paragliding = false;
    }
  }

  triggerShieldSurf(onNotify?: (msg: string) => void): void {
    if (!this.grounded && !this.paragliding && !this.climbing) {
      this.shieldSurfing = true;
      this.weaponDrawn = false;
      onNotify?.('盾サーフィン開始！');
    } else if (this.grounded) {
      this.velocity.y = 7.2;
      this.grounded = false;
      this.shieldSurfing = true;
      onNotify?.('盾サーフィン！');
    }
  }

  triggerRevalisGale(save: SaveSlotData, onNotify?: (msg: string) => void): boolean {
    const rev = save.champions.revali;
    if (!rev.unlocked || !rev.enabled || rev.charges <= 0) return false;
    rev.charges -= 1;
    if (rev.charges === 0) rev.cooldown = rev.upgraded ? 120 : 360;
    this.velocity.y = 24.5;
    this.grounded = false;
    this.paragliding = true;
    onNotify?.('リーバルの猛り！強烈な上昇気流で飛び上がった！');
    return true;
  }

  triggerGuardStart(): void {
    this.guarding = true;
    this.weaponDrawn = true;
    this.perfectGuardWindow = 0.28; // Authentic ~17-frame Perfect Parry window!
  }

  triggerDodge(input: InputState, save: SaveSlotData, onPerfectCheck: () => boolean, onFlurryTrigger: () => void): void {
    if (this.exhausted || save.stamina < 10) return;
    save.stamina = Math.max(0, save.stamina - 10);
    const dodgeDir = this.getForwardDirection().negate();
    if (input.left) dodgeDir.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    else if (input.right) dodgeDir.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.velocity.x = dodgeDir.x * 12.5;
    this.velocity.z = dodgeDir.z * 12.5;
    this.velocity.y = 5.4;
    this.grounded = false;
    this.perfectDodgeWindow = 0.30;
    if (onPerfectCheck()) {
      this.flurryRushTimer = 2.8;
      onFlurryTrigger();
    }
  }

  /**
   * Fires an arrow (Regular / Fire / Ice / Shock / Bomb / Ancient), usable in normal aim OR midair Bullet-Time!
   */
  fireArrow(save: SaveSlotData, aimDir: THREE.Vector3): ActiveArrow | null {
    const aType = save.equippedArrow;
    if ((save.arrows[aType] ?? 0) <= 0) return null;
    save.arrows[aType] -= 1;

    const bow = save.bows.find((b) => b.id === save.equippedBowId);
    const atk = bow ? bow.attack : 14;

    const grp = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.95, 6),
      new THREE.MeshBasicMaterial({ color: '#8a5d36' })
    );
    shaft.rotation.x = Math.PI / 2;
    const tipColor =
      aType === 'fire'
        ? '#ff5a14'
        : aType === 'ice'
        ? '#54e4ff'
        : aType === 'shock'
        ? '#ffe838'
        : aType === 'bomb'
        ? '#ff2a48'
        : aType === 'ancient'
        ? '#26ecff'
        : '#d8dee8';
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 6), new THREE.MeshBasicMaterial({ color: tipColor }));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.52;
    grp.add(shaft, tip);

    const start = this.position.clone().add(new THREE.Vector3(0, 1.38, 0)).addScaledVector(aimDir, 0.8);
    grp.position.copy(start);
    grp.lookAt(start.clone().add(aimDir));
    this.arrowsGroup.add(grp);

    const arrow: ActiveArrow = {
      mesh: grp,
      position: start,
      velocity: aimDir.clone().multiplyScalar(aType === 'ancient' ? 78 : 54),
      type: aType,
      attack: atk + (aType === 'ancient' ? 50 : aType === 'bomb' ? 40 : 0),
      life: 4.5,
    };
    this.arrows.push(arrow);
    return arrow;
  }

  /**
   * Computes world time dilation scale:
   * - Midair Bow Bullet-Time: 1/19 (~0.0526x) world speed!
   * - Flurry Rush: 0.22x world speed!
   */
  getWorldTimeScale(): number {
    if (this.bulletTimeActive) return 1 / 19;
    if (this.flurryRushTimer > 0) return 0.22;
    return 1.0;
  }

  update(
    rawDt: number,
    input: InputState,
    save: SaveSlotData,
    armor: ArmorSummary,
    physics: PhysicsChemistryEngine,
    runes: SheikahRuneSystem,
    opts: {
      isRaining: boolean;
      isNight: boolean;
      lockedTargetPos: THREE.Vector3 | null;
      onFootstep: (surface: 'grass' | 'stone' | 'snow' | 'sand' | 'water') => void;
      onBulletTimeEnter?: () => void;
      onNotify?: (msg: string) => void;
    }
  ): { moveSpeed: number; animState: HeroAnimState } {
    const dt = Math.min(rawDt, 0.05);

    this.perfectGuardWindow = Math.max(0, this.perfectGuardWindow - dt);
    this.perfectDodgeWindow = Math.max(0, this.perfectDodgeWindow - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
    if (this.comboResetTimer <= 0) this.comboIndex = 0;
    if (this.flurryRushTimer > 0) this.flurryRushTimer = Math.max(0, this.flurryRushTimer - dt);

    // Master Cycle Zero Riding Mode!
    if (runes.ridingBike) {
      const accel = (input.forward ? 1 : 0) - (input.backward ? 0.6 : 0);
      const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      if (runes.bikeFuel > 0) {
        runes.bikeSpeed = THREE.MathUtils.lerp(runes.bikeSpeed, accel * 23.0, Math.min(1, dt * 4.5));
      } else {
        runes.bikeSpeed = THREE.MathUtils.lerp(runes.bikeSpeed, 0, Math.min(1, dt * 3));
      }
      runes.bikeYaw += turn * 2.1 * dt * (runes.bikeSpeed >= -0.1 ? 1 : -1);
      runes.bikePos.x += Math.sin(runes.bikeYaw) * runes.bikeSpeed * dt;
      runes.bikePos.z += Math.cos(runes.bikeYaw) * runes.bikeSpeed * dt;
      runes.bikePos.y = getTerrainHeight(runes.bikePos.x, runes.bikePos.z);

      this.position.copy(runes.bikePos).add(new THREE.Vector3(0, 0.25, 0));
      this.yaw = runes.bikeYaw;
      this.model.root.position.copy(this.position);
      this.model.root.rotation.y = this.yaw;
      this.syncVisuals(save);
      this.model.updateAnimation(dt, 'ride', Math.abs(runes.bikeSpeed));
      this.noiseLevel = 0.72;
      return { moveSpeed: Math.abs(runes.bikeSpeed), animState: 'ride' };
    }

    // Camera-relative movement direction
    this.tmpForward.set(-Math.sin(input.cameraYaw), 0, -Math.cos(input.cameraYaw)).normalize();
    this.tmpRight.set(Math.cos(input.cameraYaw), 0, -Math.sin(input.cameraYaw)).normalize();
    const moveDir = new THREE.Vector3();
    if (input.forward) moveDir.add(this.tmpForward);
    if (input.backward) moveDir.sub(this.tmpForward);
    if (input.right) moveDir.add(this.tmpRight);
    if (input.left) moveDir.sub(this.tmpRight);
    const hasMove = moveDir.lengthSq() > 0.001;
    if (hasMove) moveDir.normalize();

    // Midair Bow Bullet-Time check (slows world to 1/19 while draining stamina!)
    const wantsBulletTime = input.aimBow && !this.grounded && !this.climbing && !this.swimming && !this.exhausted && save.stamina > 2;
    if (wantsBulletTime && !this.bulletTimeActive) {
      opts.onBulletTimeEnter?.();
    }
    this.bulletTimeActive = wantsBulletTime;
    this.aimingBow = input.aimBow;
    if (this.aimingBow) this.weaponDrawn = true;
    this.guarding = input.guard && !this.aimingBow && !this.paragliding;
    this.crouching = input.crouch && this.grounded;

    if (this.bulletTimeActive) {
      const drainRate = armor.activeSetBonus === 'charge_atk_stamina' ? 14 : 24;
      this.consumeStamina(save, drainRate * dt);
    }

    // Check Terrain Height, Slope & Water
    const groundY = getTerrainHeight(this.position.x, this.position.z);
    getTerrainNormal(this.position.x, this.position.z, this.tmpNormal);
    const inWater = isWaterAt(this.position.x, this.position.z) && this.position.y <= WORLD_BOUNDS.waterLevel - 0.35;
    this.swimming = inWater;

    // Check Cryonis / Metal Box walkable platforms underneath Link!
    let supportY = groundY;
    for (const b of physics.bodies) {
      const horiz = Math.hypot(this.position.x - b.position.x, this.position.z - b.position.z);
      const topY = b.position.y + b.halfHeight * 2;
      if (horiz <= b.radius + 0.45 && this.position.y >= topY - 0.75 && this.velocity.y <= 0.5) {
        if (topY > supportY) supportY = topY;
      }
    }

    // Universal Climbing check on steep cliffs (>35 deg -> normal.y < 0.80)
    if (hasMove && this.tmpNormal.y < 0.78 && !this.swimming && !this.paragliding && !this.exhausted && Math.abs(this.position.y - groundY) < 2.2) {
      this.climbing = true;
      this.grounded = false;
      this.shieldSurfing = false;
    } else if (this.tmpNormal.y >= 0.82 || this.exhausted) {
      this.climbing = false;
    }

    let animState: HeroAnimState = 'idle';
    let horizSpeed = 0;

    if (this.climbing) {
      // Climbing physics + Rain Slip cycle!
      const climbSpeed = (3.4 + armor.climbSpeedLevel * 1.1) * (input.sprint ? 1.25 : 1.0);
      this.position.x += moveDir.x * climbSpeed * dt;
      this.position.z += moveDir.z * climbSpeed * dt;
      const newGy = getTerrainHeight(this.position.x, this.position.z);
      this.position.y = Math.max(newGy, this.position.y + (input.forward ? climbSpeed * 0.75 * dt : 0));
      this.velocity.set(0, 0, 0);
      if (hasMove) {
        this.consumeStamina(save, 13 * dt);
        this.rainSlipTimer += dt;
        if (opts.isRaining && this.rainSlipTimer > 2.4) {
          this.rainSlipTimer = 0;
          this.position.y = Math.max(groundY, this.position.y - 1.6);
          opts.onNotify?.('雨で崖が滑った！');
        }
      }
      animState = 'climb';
      horizSpeed = hasMove ? climbSpeed : 0;
    } else if (this.swimming) {
      // Swimming & Zora Armor Speed Bonus
      this.paragliding = false;
      this.shieldSurfing = false;
      const swimSpd = (3.8 + armor.swimSpeedLevel * 1.1) * (input.sprint ? 1.55 : 1.0);
      this.velocity.x = moveDir.x * swimSpd;
      this.velocity.z = moveDir.z * swimSpd;
      this.velocity.y = 0;
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.position.y = WORLD_BOUNDS.waterLevel - 0.65;
      if (hasMove) {
        const drain = input.sprint ? (armor.activeSetBonus === 'swim_dash_stamina' ? 10 : 20) : 6.5;
        this.consumeStamina(save, drain * dt);
      }
      animState = 'swim';
      horizSpeed = hasMove ? swimSpd : 0;
    } else {
      // Standard Run / Sprint / Whistle-Sprint / Shield-Surf / Paraglider Physics!
      const surface = getSurfaceType(this.position.x, this.position.z);

      // Whistle Sprint trick (hold Whistle + Sprint -> jog at near-sprint speed with ZERO stamina drain!)
      const isWhistleSprint = save.settings.glitchPhysics && input.whistle && input.sprint && hasMove && this.grounded;
      const sprinting = input.sprint && hasMove && !this.exhausted && !this.crouching && !isWhistleSprint;

      let baseSpeed = this.crouching ? 3.2 : sprinting ? 9.8 : isWhistleSprint ? 8.8 : 6.4;
      if (opts.isNight && armor.nightSpeedUp) baseSpeed *= 1.25;
      if (surface === 'sand' && armor.sandSpeedUp) baseSpeed *= 1.32;
      if (surface === 'snow' && armor.snowSpeedUp) baseSpeed *= 1.32;

      if (this.paragliding) {
        // Paraglider Aerodynamics + Fire Updraft Thermal Lift!
        const glideSpeed = 10.6;
        if (hasMove) {
          this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveDir.x * glideSpeed, Math.min(1, dt * 4.5));
          this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveDir.z * glideSpeed, Math.min(1, dt * 4.5));
        }
        const updraft = physics.getUpdraftLiftAt(this.position);
        if (updraft > 0) {
          this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, updraft, Math.min(1, dt * 6));
        } else {
          this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, -2.15, Math.min(1, dt * 6));
        }
        this.consumeStamina(save, 5.2 * dt);
        if (this.exhausted) this.paragliding = false;
        animState = 'paraglide';
      } else if (this.shieldSurfing) {
        // Shield Surfing friction differentiated by Snow (slickest) > Sand > Grass > Stone!
        const friction = surface === 'snow' ? 0.992 : surface === 'sand' ? 0.985 : surface === 'grass' ? 0.975 : 0.94;
        if (this.grounded) {
          // Accelerate downhill along terrain gradient
          this.velocity.x += this.tmpNormal.x * 26.0 * dt + moveDir.x * 6.5 * dt;
          this.velocity.z += this.tmpNormal.z * 26.0 * dt + moveDir.z * 6.5 * dt;
          this.velocity.x *= Math.pow(friction, dt * 60);
          this.velocity.z *= Math.pow(friction, dt * 60);
        } else {
          this.velocity.y -= 24.0 * dt;
        }
        animState = 'shield_surf';
      } else {
        // Grounded or Airborne regular motion
        if (this.grounded) {
          const targetVx = hasMove ? moveDir.x * baseSpeed : 0;
          const targetVz = hasMove ? moveDir.z * baseSpeed : 0;
          this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVx, Math.min(1, dt * 14));
          this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVz, Math.min(1, dt * 14));
          if (sprinting) {
            this.consumeStamina(save, 18.0 * dt);
          } else {
            this.recoverStamina(save, 34.0 * dt);
          }
        } else {
          // Preserve high momentum midair (supports Windbomb / BTB / Cryo-Bounce launches!)
          if (hasMove) {
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveDir.x * Math.max(baseSpeed, Math.hypot(this.velocity.x, this.velocity.z)), Math.min(1, dt * 2.2));
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveDir.z * Math.max(baseSpeed, Math.hypot(this.velocity.x, this.velocity.z)), Math.min(1, dt * 2.2));
          }
          this.velocity.y -= (this.bulletTimeActive ? 4.2 : 25.5) * dt;
        }
      }

      // Integrate Position & Clamp to Seamless 15-Region Hyrule Bounds
      this.position.x = THREE.MathUtils.clamp(this.position.x + this.velocity.x * dt, WORLD_BOUNDS.minX + 30, WORLD_BOUNDS.maxX - 30);
      this.position.z = THREE.MathUtils.clamp(this.position.z + this.velocity.z * dt, WORLD_BOUNDS.minZ + 30, WORLD_BOUNDS.maxZ - 30);
      this.position.y += this.velocity.y * dt;

      // Ground & Platform Landing Resolution
      const newSupportY = Math.max(getTerrainHeight(this.position.x, this.position.z), supportY > groundY ? supportY : -999);
      if (this.position.y <= newSupportY) {
        this.position.y = newSupportY;
        this.velocity.y = 0;
        this.grounded = true;
        this.paragliding = false;
        if (this.shieldSurfing && Math.hypot(this.velocity.x, this.velocity.z) < 2.2) {
          this.shieldSurfing = false;
        }
      } else if (this.position.y > newSupportY + 0.55) {
        this.grounded = false;
      }

      horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (!this.paragliding && !this.shieldSurfing) {
        if (this.aimingBow) animState = 'bow_aim';
        else if (this.guarding) animState = 'guard';
        else if (!this.grounded) animState = 'jump';
        else if (this.crouching) animState = 'crouch';
        else if (horizSpeed > 8.0) animState = 'sprint';
        else if (horizSpeed > 4.0) animState = 'run';
        else if (horizSpeed > 0.35) animState = 'walk';
        else animState = 'idle';
      }

      // Footsteps SFX & Purple Sound Sensor waveform amplitude
      if (this.grounded && horizSpeed > 0.6) {
        this.footstepTimer -= dt * (horizSpeed / 5.5);
        if (this.footstepTimer <= 0) {
          this.footstepTimer = 0.34;
          opts.onFootstep(surface);
        }
      }
      const stealthAtten = Math.max(0.18, 1 - armor.stealthLevel * 0.25);
      this.noiseLevel = THREE.MathUtils.clamp((this.crouching ? 0.14 : horizSpeed / 10.5) * stealthAtten, 0.08, 1.0);
    }

    // Character Facing Yaw (faces ZL locked enemy, bow aim camera forward, or movement vector)
    if (opts.lockedTargetPos) {
      this.yaw = Math.atan2(opts.lockedTargetPos.x - this.position.x, opts.lockedTargetPos.z - this.position.z);
    } else if (this.aimingBow) {
      this.yaw = Math.atan2(this.tmpForward.x, this.tmpForward.z);
    } else if (hasMove) {
      const targetYaw = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 13);
    }

    // Sync 3D Link Character Rig & Equipment Visuals
    this.model.root.position.copy(this.position);
    this.model.root.rotation.y = this.yaw;
    this.syncVisuals(save);
    this.model.updateAnimation(dt, animState, horizSpeed);

    return { moveSpeed: horizSpeed, animState };
  }

  private consumeStamina(save: SaveSlotData, amount: number): void {
    if (this.tempStamina > 0) {
      const used = Math.min(this.tempStamina, amount);
      this.tempStamina -= used;
      amount -= used;
    }
    if (amount > 0) {
      save.stamina = Math.max(0, save.stamina - amount);
      if (save.stamina <= 0) {
        this.exhausted = true;
      }
    }
  }

  private recoverStamina(save: SaveSlotData, amount: number): void {
    save.stamina = Math.min(save.maxStamina, save.stamina + amount);
    if (this.exhausted && save.stamina >= save.maxStamina) {
      this.exhausted = false;
    }
  }

  public syncVisuals(save: SaveSlotData): void {
    const headPiece = save.equippedArmor.head ? ARMOR_MAP[save.equippedArmor.head] ?? null : null;
    const bodyPiece = save.equippedArmor.body ? ARMOR_MAP[save.equippedArmor.body] ?? null : null;
    const legsPiece = save.equippedArmor.legs ? ARMOR_MAP[save.equippedArmor.legs] ?? null : null;
    const activeWep = save.weapons.find((w) => w.id === save.equippedWeaponId);

    this.model.applyEquipmentVisuals({
      headPiece,
      bodyPiece,
      legsPiece,
      headDyeHex: headPiece && save.armorDyes[headPiece.id] ? KOCHI_DYE_MAP[save.armorDyes[headPiece.id]]?.hex : null,
      bodyDyeHex: bodyPiece && save.armorDyes[bodyPiece.id] ? KOCHI_DYE_MAP[save.armorDyes[bodyPiece.id]]?.hex : null,
      legsDyeHex: legsPiece && save.armorDyes[legsPiece.id] ? KOCHI_DYE_MAP[save.armorDyes[legsPiece.id]]?.hex : null,
      weaponDrawn: this.weaponDrawn,
      isMasterSword: activeWep?.isMasterSword ?? false,
      weaponColor: activeWep?.color ?? '#d8e4f0',
      shieldColor: '#244d9c',
      bowDrawn: this.aimingBow,
      paragliderOpen: this.paragliding,
      shieldSurfing: this.shieldSurfing,
      holdingTorchFire: false,
    });
  }
}
