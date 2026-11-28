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
  /** Optional analog stick horizontal axis [-1..1] (+right, -left) */
  moveX?: number;
  /** Optional analog stick vertical axis [-1..1] (+forward, -backward) */
  moveY?: number;
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

const PLAYER_RADIUS = 0.44;
const PLAYER_HEIGHT = 1.62;
const CCD_MAX_STEP = 0.24;

/**
 * Full Breath of the Wild Character Controller & Physics State Machine:
 * - Camera-relative 3D TPS / Close / FPS camera with collision clamping & ZL target lock-on
 * - Substepped Continuous Collision Detection (CCD) against buildings, walls, pillars, trees & rocks
 * - Smooth wall sliding & Universal Wall Climbing (both steep terrain cliffs AND architectural walls/towers + ledge mantling!)
 * - Stamina Wheel (max 3 full green rings = 300 units + yellow temporary stamina + exhaustion penalty)
 * - Paraglider (gliding physics, Fire Updraft thermal lift, Revali's Gale vertical launch!)
 * - Shield Surfing, Swimming, Midair Bow Bullet-Time (1/19x), Perfect Dodge -> Flurry Rush, Perfect Guard -> Beam Parry
 */
export class PlayerController {
  public readonly model = new LinkCharacterModel();
  public readonly position = new THREE.Vector3(-298, 52, 454);
  public readonly velocity = new THREE.Vector3();
  public yaw = 0.72;

  public grounded = true;
  public climbing = false;
  public climbingWall = false;
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

  // Wall-climbing state & temp vectors
  private climbWallNormal = new THREE.Vector3(0, 0, 1);
  private climbWallTopY = 0;
  private climbDetachCooldown = 0;
  private tmpNormal = new THREE.Vector3();
  private tmpForward = new THREE.Vector3();
  private tmpRight = new THREE.Vector3();
  private tmpMoveDir = new THREE.Vector3();

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
    this.climbingWall = false;
    this.paragliding = false;
    this.shieldSurfing = false;
    this.model.root.position.copy(this.position);
  }

  getForwardDirection(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  triggerJumpOrParaglider(save: SaveSlotData, onParagliderOpen?: () => void): void {
    if (this.climbing) {
      if (!this.exhausted && save.stamina > 12) {
        if (this.climbingWall) {
          // Climb-Jump straight upward along the building wall!
          this.position.y += 1.45;
          this.consumeStamina(save, 18);
          if (this.position.y >= this.climbWallTopY - 0.5) {
            this.mantleWallTop();
          }
        } else {
          this.velocity.y = 10.5;
          this.consumeStamina(save, 18);
        }
      }
      return;
    }

    if (this.grounded) {
      this.velocity.y = 10.4;
      this.grounded = false;
      this.shieldSurfing = false;
    } else if (!this.paragliding && save.hasParaglider && !this.exhausted && save.stamina > 4) {
      this.paragliding = true;
      this.velocity.y = Math.max(this.velocity.y, -1.2);
      onParagliderOpen?.();
    } else if (this.paragliding) {
      this.paragliding = false;
    }
  }

  private mantleWallTop(): void {
    this.position.y = this.climbWallTopY + 0.08;
    // Step smoothly forward onto the top of the ledge/plinth
    this.position.x -= this.climbWallNormal.x * 0.72;
    this.position.z -= this.climbWallNormal.z * 0.72;
    this.velocity.set(0, 0, 0);
    this.climbing = false;
    this.climbingWall = false;
    this.grounded = true;
    this.climbDetachCooldown = 0.35;
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
    this.climbing = false;
    this.climbingWall = false;
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
    if (input.left || (input.moveX ?? 0) < -0.35) dodgeDir.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    else if (input.right || (input.moveX ?? 0) > 0.35) dodgeDir.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
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
    this.climbDetachCooldown = Math.max(0, this.climbDetachCooldown - dt);
    this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
    if (this.comboResetTimer <= 0) this.comboIndex = 0;
    if (this.flurryRushTimer > 0) this.flurryRushTimer = Math.max(0, this.flurryRushTimer - dt);

    // Compute combined Keyboard + Analog Touch Stick input vector
    const keyFwd = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
    const keyRight = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const rawFwd = THREE.MathUtils.clamp(keyFwd + (input.moveY ?? 0), -1, 1);
    const rawRight = THREE.MathUtils.clamp(keyRight + (input.moveX ?? 0), -1, 1);
    const inputMag = Math.min(1, Math.hypot(rawFwd, rawRight));

    // Master Cycle Zero Riding Mode (with 3D building collision!)
    if (runes.ridingBike) {
      const accel = rawFwd > 0.08 ? rawFwd : rawFwd < -0.08 ? rawFwd * 0.6 : 0;
      const turn = -rawRight;
      if (runes.bikeFuel > 0) {
        runes.bikeSpeed = THREE.MathUtils.lerp(runes.bikeSpeed, accel * 23.0, Math.min(1, dt * 4.5));
      } else {
        runes.bikeSpeed = THREE.MathUtils.lerp(runes.bikeSpeed, 0, Math.min(1, dt * 3));
      }
      runes.bikeYaw += turn * 2.1 * dt * (runes.bikeSpeed >= -0.1 ? 1 : -1);
      const stepDist = Math.abs(runes.bikeSpeed * dt);
      const bikeSteps = Math.max(1, Math.min(6, Math.ceil(stepDist / 0.35)));
      const subDt = dt / bikeSteps;
      for (let s = 0; s < bikeSteps; s++) {
        runes.bikePos.x = THREE.MathUtils.clamp(
          runes.bikePos.x + Math.sin(runes.bikeYaw) * runes.bikeSpeed * subDt,
          WORLD_BOUNDS.minX + 30,
          WORLD_BOUNDS.maxX - 30
        );
        runes.bikePos.z = THREE.MathUtils.clamp(
          runes.bikePos.z + Math.cos(runes.bikeYaw) * runes.bikeSpeed * subDt,
          WORLD_BOUNDS.minZ + 30,
          WORLD_BOUNDS.maxZ - 30
        );
        runes.bikePos.y = getTerrainHeight(runes.bikePos.x, runes.bikePos.z);
        const col = physics.resolveCapsuleCollision(runes.bikePos, 0.85, 1.5, 0.45);
        if (col.collidedHorizontal) {
          runes.bikeSpeed *= 0.35;
        }
        if (col.supportY > runes.bikePos.y) runes.bikePos.y = col.supportY;
      }

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
    const moveDir = this.tmpMoveDir.set(0, 0, 0);
    if (Math.abs(rawFwd) > 0.01) moveDir.addScaledVector(this.tmpForward, rawFwd);
    if (Math.abs(rawRight) > 0.01) moveDir.addScaledVector(this.tmpRight, rawRight);
    const hasMove = inputMag > 0.08 && moveDir.lengthSq() > 0.001;
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
    if (this.swimming) {
      this.climbing = false;
      this.climbingWall = false;
    }

    // Terrain cliff climbing check (steep natural cliff >35 deg -> normal.y < 0.78)
    if (!this.climbingWall) {
      if (hasMove && this.tmpNormal.y < 0.78 && !this.swimming && !this.paragliding && !this.exhausted && Math.abs(this.position.y - groundY) < 2.2) {
        this.climbing = true;
        this.grounded = false;
        this.shieldSurfing = false;
      } else if (this.tmpNormal.y >= 0.82 || this.exhausted) {
        this.climbing = false;
      }
    } else if (this.exhausted) {
      this.climbing = false;
      this.climbingWall = false;
      this.climbDetachCooldown = 0.5;
    }

    let animState: HeroAnimState = 'idle';
    let horizSpeed = 0;

    if (this.climbing && this.climbingWall) {
      // Architectural wall / tower / shrine climbing!
      const climbSpeed = (3.4 + armor.climbSpeedLevel * 1.1) * (input.sprint ? 1.25 : 1.0);
      const wallTangentX = -this.climbWallNormal.z;
      const wallTangentZ = this.climbWallNormal.x;
      const lateralInput = rawRight;
      const vertInput = rawFwd;

      if (Math.abs(vertInput) > 0.08 || Math.abs(lateralInput) > 0.08) {
        this.position.y += vertInput * climbSpeed * dt;
        this.position.x += wallTangentX * lateralInput * climbSpeed * 0.75 * dt;
        this.position.z += wallTangentZ * lateralInput * climbSpeed * 0.75 * dt;
        this.consumeStamina(save, 13 * dt);

        this.rainSlipTimer += dt;
        if (opts.isRaining && this.rainSlipTimer > 2.4) {
          this.rainSlipTimer = 0;
          this.position.y = Math.max(groundY, this.position.y - 1.4);
          opts.onNotify?.('雨で壁が滑った！');
        }
      }

      // Probe slight push into wall to confirm we're still against a solid face (and get updated topY)
      const probePos = this.position.clone();
      probePos.x -= this.climbWallNormal.x * 0.25;
      probePos.z -= this.climbWallNormal.z * 0.25;
      const probeCol = physics.resolveCapsuleCollision(probePos, PLAYER_RADIUS, PLAYER_HEIGHT, 0.3);

      // Face the wall surface cleanly while climbing!
      this.yaw = Math.atan2(-this.climbWallNormal.x, -this.climbWallNormal.z);

      if (this.position.y >= this.climbWallTopY - 0.35 && vertInput > 0.1) {
        this.mantleWallTop();
      } else if (this.position.y <= groundY + 0.08 && vertInput < -0.1) {
        this.position.y = groundY;
        this.climbing = false;
        this.climbingWall = false;
        this.grounded = true;
        this.climbDetachCooldown = 0.3;
      } else if (!probeCol.collidedHorizontal) {
        // Climbed past lateral edge of wall -> release cleanly
        this.climbing = false;
        this.climbingWall = false;
      } else {
        // Keep snapped cleanly outside wall surface
        this.climbWallNormal.copy(probeCol.hitNormal);
        if (probeCol.wallTopY > -Infinity) this.climbWallTopY = probeCol.wallTopY;
        physics.resolveCapsuleCollision(this.position, PLAYER_RADIUS, PLAYER_HEIGHT, 0.3);
      }

      this.velocity.set(0, 0, 0);
      animState = 'climb';
      horizSpeed = inputMag > 0.08 ? climbSpeed : 0;
    } else if (this.climbing) {
      // Natural terrain cliff climbing + Rain Slip cycle + static wall collision!
      const climbSpeed = (3.4 + armor.climbSpeedLevel * 1.1) * (input.sprint ? 1.25 : 1.0);
      this.position.x += moveDir.x * climbSpeed * dt;
      this.position.z += moveDir.z * climbSpeed * dt;
      physics.resolveCapsuleCollision(this.position, PLAYER_RADIUS, PLAYER_HEIGHT, 0.45);
      const newGy = getTerrainHeight(this.position.x, this.position.z);
      this.position.y = Math.max(newGy, this.position.y + (rawFwd > 0.1 ? climbSpeed * 0.75 * dt : 0));
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
      this.paragliding = false;
      this.shieldSurfing = false;
      const swimSpd = (3.8 + armor.swimSpeedLevel * 1.1) * (input.sprint ? 1.55 : 1.0) * inputMag;
      this.velocity.x = moveDir.x * swimSpd;
      this.velocity.z = moveDir.z * swimSpd;
      this.velocity.y = 0;
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.position.y = WORLD_BOUNDS.waterLevel - 0.65;
      physics.resolveCapsuleCollision(this.position, PLAYER_RADIUS, PLAYER_HEIGHT, 0.45);
      if (hasMove) {
        const drain = input.sprint ? (armor.activeSetBonus === 'swim_dash_stamina' ? 10 : 20) : 6.5;
        this.consumeStamina(save, drain * dt);
      }
      animState = 'swim';
      horizSpeed = hasMove ? swimSpd : 0;
    } else {
      // Standard Run / Sprint / Whistle-Sprint / Shield-Surf / Paraglider Physics with Substepped CCD!
      const surface = getSurfaceType(this.position.x, this.position.z);

      const isWhistleSprint = save.settings.glitchPhysics && input.whistle && input.sprint && hasMove && this.grounded;
      const sprinting = input.sprint && hasMove && !this.exhausted && !this.crouching && !isWhistleSprint;

      let baseSpeed = this.crouching ? 3.2 : sprinting ? 9.8 : isWhistleSprint ? 8.8 : 6.4;
      if (opts.isNight && armor.nightSpeedUp) baseSpeed *= 1.25;
      if (surface === 'sand' && armor.sandSpeedUp) baseSpeed *= 1.32;
      if (surface === 'snow' && armor.snowSpeedUp) baseSpeed *= 1.32;
      const analogSpeed = baseSpeed * Math.max(0.35, inputMag);

      if (this.paragliding) {
        const glideSpeed = 10.6 * Math.max(0.4, inputMag);
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
        const friction = surface === 'snow' ? 0.992 : surface === 'sand' ? 0.985 : surface === 'grass' ? 0.975 : 0.94;
        if (this.grounded) {
          this.velocity.x += this.tmpNormal.x * 26.0 * dt + moveDir.x * 6.5 * dt;
          this.velocity.z += this.tmpNormal.z * 26.0 * dt + moveDir.z * 6.5 * dt;
          this.velocity.x *= Math.pow(friction, dt * 60);
          this.velocity.z *= Math.pow(friction, dt * 60);
        } else {
          this.velocity.y -= 24.0 * dt;
        }
        animState = 'shield_surf';
      } else {
        if (this.grounded) {
          const targetVx = hasMove ? moveDir.x * analogSpeed : 0;
          const targetVz = hasMove ? moveDir.z * analogSpeed : 0;
          this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVx, Math.min(1, dt * 14));
          this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVz, Math.min(1, dt * 14));
          if (sprinting) {
            this.consumeStamina(save, 18.0 * dt);
          } else {
            this.recoverStamina(save, 34.0 * dt);
          }
        } else {
          if (hasMove) {
            const airSpd = Math.max(analogSpeed, Math.hypot(this.velocity.x, this.velocity.z));
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveDir.x * airSpd, Math.min(1, dt * 2.2));
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveDir.z * airSpd, Math.min(1, dt * 2.2));
          }
          this.velocity.y -= (this.bulletTimeActive ? 4.2 : 25.5) * dt;
        }
      }

      // === SUBSTEPPED CONTINUOUS COLLISION DETECTION (CCD) ===
      // Guarantees zero tunneling/clipping through walls, buildings, pillars, shrines & trees at any speed!
      const totalDisp = Math.hypot(this.velocity.x * dt, this.velocity.y * dt, this.velocity.z * dt);
      const substeps = Math.max(1, Math.min(8, Math.ceil(totalDisp / CCD_MAX_STEP)));
      const subDt = dt / substeps;
      let highestSupportY = -Infinity;

      for (let step = 0; step < substeps; step++) {
        this.position.x = THREE.MathUtils.clamp(
          this.position.x + this.velocity.x * subDt,
          WORLD_BOUNDS.minX + 30,
          WORLD_BOUNDS.maxX - 30
        );
        this.position.z = THREE.MathUtils.clamp(
          this.position.z + this.velocity.z * subDt,
          WORLD_BOUNDS.minZ + 30,
          WORLD_BOUNDS.maxZ - 30
        );
        this.position.y += this.velocity.y * subDt;

        const col = physics.resolveCapsuleCollision(this.position, PLAYER_RADIUS, PLAYER_HEIGHT, 0.56);
        if (col.supportY > highestSupportY) {
          highestSupportY = col.supportY;
        }
        if (col.hitCeiling && this.velocity.y > 0) {
          this.velocity.y = 0;
        }
        if (col.collidedHorizontal) {
          // Smooth wall slide: remove only inward normal component of horizontal velocity!
          const vn = this.velocity.x * col.hitNormal.x + this.velocity.z * col.hitNormal.z;
          if (vn < 0) {
            this.velocity.x -= col.hitNormal.x * vn;
            this.velocity.z -= col.hitNormal.z * vn;
          }

          // Initiate authentic BotW Wall Climbing if pushing directly into a tall climbable wall!
          if (
            col.hitClimbable &&
            hasMove &&
            !this.exhausted &&
            !this.crouching &&
            !this.shieldSurfing &&
            this.climbDetachCooldown <= 0 &&
            save.stamina > 10
          ) {
            const pushIntoWall = -(moveDir.x * col.hitNormal.x + moveDir.z * col.hitNormal.z);
            if (pushIntoWall > 0.62 && col.wallTopY > this.position.y + 1.05) {
              this.climbing = true;
              this.climbingWall = true;
              this.grounded = false;
              this.paragliding = false;
              this.climbWallNormal.copy(col.hitNormal);
              this.climbWallTopY = col.wallTopY;
              this.velocity.set(0, 0, 0);
              break;
            }
          }
        }
      }

      // Ground & Walkable Architecture/Platform Landing Resolution
      if (!this.climbingWall) {
        const terrainY = getTerrainHeight(this.position.x, this.position.z);
        const newSupportY = Math.max(terrainY, highestSupportY);
        if (this.position.y <= newSupportY + 0.04 && this.velocity.y <= 0.6) {
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
      }

      horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (!this.paragliding && !this.shieldSurfing && !this.climbing) {
        if (this.aimingBow) animState = 'bow_aim';
        else if (this.guarding) animState = 'guard';
        else if (!this.grounded) animState = 'jump';
        else if (this.crouching) animState = 'crouch';
        else if (horizSpeed > 8.0) animState = 'sprint';
        else if (horizSpeed > 4.0) animState = 'run';
        else if (horizSpeed > 0.35) animState = 'walk';
        else animState = 'idle';
      } else if (this.climbing) {
        animState = 'climb';
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

    // Character Facing Yaw (faces wall while wall-climbing, ZL locked enemy, bow aim camera forward, or movement vector)
    if (!this.climbingWall) {
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
      weaponId: activeWep?.id ?? 'master_sword',
      shieldId: save.equippedShieldId,
      weaponColor: activeWep?.color ?? '#d8e4f0',
      shieldColor: '#244d9c',
      bowDrawn: this.aimingBow,
      paragliderOpen: this.paragliding,
      shieldSurfing: this.shieldSurfing,
      holdingTorchFire: activeWep?.id === 'torch',
    });
  }
}
