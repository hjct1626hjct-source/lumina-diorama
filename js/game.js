// ============================================================================
// LUMINA DIORAMA — Core Game Engine, Combat, Gimmicks, Bosses & Progression
// 製作者：駿 (Created by Shun)
// ============================================================================

import {
  GAME_META,
  JOBS,
  SPELLS,
  CORES,
  ORES,
  NPCS,
  ACHIEVEMENTS,
  getWeaponById,
  getArmorById,
  getSpellById,
  getAreaById,
} from './data.js';
import {
  TILE,
  buildAreaMap,
  getTile,
  isProjectileBlockingTile,
  setBossGateState,
  openSwitchGate,
  breakCrackedWall,
} from './map.js';
import { Player } from './player.js';
import { Enemy, rollEnemyDrops } from './enemy.js';
import { Boss } from './boss.js';
import { AudioEngine } from './audio.js';
import { NetworkManager } from './network.js';
import { Renderer } from './renderer.js';
import { UIManager } from './ui.js';
import { loadSettings, saveSettings, saveAuto } from './save.js';

export class Game {
  constructor(canvas, minimapCanvas) {
    this.mode = 'title'; // 'title' | 'playing'
    this.settings = loadSettings();

    this.audio = new AudioEngine();
    this.audio.setBgmVolume(this.settings.bgmVolume);
    this.audio.setSeVolume(this.settings.seVolume);
    this.audio.setMuted(this.settings.muted);

    this.renderer = new Renderer(canvas, minimapCanvas);
    this.player = new Player('シュン', 'knight', this.settings.bodyType || 'male');
    this.progress = this._createFreshProgress();

    this.currentAreaId = 'town';
    this.towerFloor = 1;
    this.towerScore = 0;
    this.towerFloorCleared = false;
    this.map = buildAreaMap('town', this.progress);

    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.drops = [];
    this.particles = [];
    this.slashes = [];
    this.afterimages = [];
    this.damageTexts = [];

    // Zelda-Style TPS Orbit Camera & Z-Targeting Lock-On State
    this.camera = {
      x: this.map.spawn.x,
      y: this.map.spawn.y,
      yaw: -Math.PI * 0.5, // Default looking North (-Y in 2D map, -Z in 3D)
      pitch: 0.34,         // Slightly elevated over-the-shoulder angle
      distance: 195,       // Standard TPS distance
      mode: this.settings.cameraMode || 'tps', // 'tps' | 'action' | 'fps'
    };
    this.lockTarget = null; // Active Z-Targeted enemy/boss/crystal

    this.shakePower = 0;
    this.shakeOffset = { x: 0, y: 0 };
    this.hitstopTimer = 0;
    this.slowMoTimer = 0;
    this.slowMoScale = 1.0;
    this.screenFlash = 0;
    this.screenFlashColor = '#38bdf8';

    this.hudSyncTimer = 0;
    this.portalCooldown = 0;
    this.interactHolding = false;

    this.network = new NetworkManager(this);
    this.ui = new UIManager(this);

    this.network.onStatusChange = (info) => this.ui.updateLobbyUI(info);
    this.ui.applySettingsToDOM(this.settings);
    this.ui.refreshTitleScreen();
  }

  _createFreshProgress() {
    return {
      visitedAreas: new Set(['town']),
      defeatedBosses: new Set(),
      openedChests: new Set(),
      brokenWalls: new Set(),
      activatedSwitches: new Set(),
      discoveredWeapons: new Set(),
      discoveredArmors: new Set(),
      discoveredSpells: new Set(),
      monsterKills: {},
      achievements: new Set(),
      gameCleared: false,
      ngPlus: 1,
      bestTowerFloor: 0,
      bestTowerScore: 0,
      stats: {
        playTime: 0,
        totalKills: 0,
        deaths: 0,
        maxCombo: 0,
      },
    };
  }

  persistSettings() {
    saveSettings(this.settings);
  }

  autoSave() {
    if (this.mode !== 'playing') return;
    saveAuto(this);
  }

  addToast(text) {
    this.ui.addToast(text);
  }

  unlockAchievement(achId) {
    if (this.progress.achievements.has(achId)) return;
    const ach = ACHIEVEMENTS.find((a) => a.id === achId);
    if (!ach) return;
    this.progress.achievements.add(achId);
    this.ui.showTrophyToast(ach);
    this.audio.playSe('trophy');
    this.autoSave();
  }

  // ==========================================================================
  // CAMERA CONTROLS, CAMERA-RELATIVE MOVEMENT & Z-TARGETING LOCK-ON
  // ==========================================================================
  cycleCameraMode() {
    const order = ['tps', 'action', 'fps'];
    const idx = order.indexOf(this.camera.mode);
    this.camera.mode = order[(idx + 1) % order.length];
    this.settings.cameraMode = this.camera.mode;
    this.persistSettings();
    const labels = {
      tps: '🎥 標準TPS視点（背中越し）',
      action: '🎥 近距離アクションTPS視点',
      fps: '🎥 一人称視点（FPSモード）',
    };
    this.audio.playSe('uiClick');
    this.addToast(labels[this.camera.mode] || labels.tps);
    return this.camera.mode;
  }

  rotateCamera(deltaYaw, deltaPitch) {
    this.camera.yaw += deltaYaw;
    const minPitch = this.camera.mode === 'fps' ? -0.55 : 0.12;
    const maxPitch = this.camera.mode === 'fps' ? 0.65 : 1.05;
    this.camera.pitch = Math.max(minPitch, Math.min(maxPitch, this.camera.pitch + deltaPitch));
  }

  zoomCamera(deltaDist) {
    this.camera.distance = Math.max(105, Math.min(340, this.camera.distance + deltaDist));
  }

  // Convert local stick/WASD vector (x: right, y: down/back, -y: forward) into world (X, Y) using Camera Yaw!
  inputToWorldMoveVector(inputVec) {
    const mag = Math.hypot(inputVec.x, inputVec.y);
    if (mag < 0.05) return { x: 0, y: 0 };
    // Camera looks along direction (cos(yaw), sin(yaw)) in world X/Y(Z) plane
    const fwdX = Math.cos(this.camera.yaw);
    const fwdY = Math.sin(this.camera.yaw);
    // Right vector is 90 degrees clockwise in screen/ground plane: (-fwdY, fwdX)
    const rightX = -fwdY;
    const rightY = fwdX;

    const forwardAmount = -inputVec.y; // W or Stick Up is negative y
    const rightAmount = inputVec.x;    // D or Stick Right is positive x

    return {
      x: fwdX * forwardAmount + rightX * rightAmount,
      y: fwdY * forwardAmount + rightY * rightAmount,
    };
  }

  toggleLockOn() {
    if (this.lockTarget && this.lockTarget.alive && (this.lockTarget.hp === undefined || this.lockTarget.hp > 0)) {
      this.lockTarget = null;
      this.audio.playSe('uiClick');
      this.addToast('🎯 ロックオン解除');
      return null;
    }
    const candidates = this._findNearestHostiles(this.player.x, this.player.y, 440, 1);
    if (candidates.length > 0) {
      this.lockTarget = candidates[0];
      this.player.facing = Math.atan2(this.lockTarget.y - this.player.y, this.lockTarget.x - this.player.x);
      this.audio.playSe('switch');
      this.addToast(`🎯 Z注目ロックオン：【${this.lockTarget.name || '守護結界石'}】`);
      return this.lockTarget;
    } else {
      // Snap camera behind player facing direction (classic Zelda Z-target camera reset!)
      this.camera.yaw = this.player.facing;
      this.audio.playSe('uiClick');
      return null;
    }
  }

  spawnFootDust(x, y) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 24,
      vy: (Math.random() - 0.5) * 24,
      size: 4.5,
      color: 'rgba(214, 211, 196, 0.65)',
      life: 0.28,
      maxLife: 0.28,
    });
  }

  // ==========================================================================
  // GAME LIFECYCLE: NEW GAME, LOAD, NG+, TOWER, TITLE
  // ==========================================================================
  startNewGame(name, jobId, skipIntro = false, bodyType = null) {
    const chosenBody = bodyType || this.settings.bodyType || 'male';
    this.settings.bodyType = chosenBody;
    this.persistSettings();

    this.player = new Player(name, jobId, chosenBody);
    this.progress = this._createFreshProgress();
    this._syncDiscoveryFromPlayer();

    this.mode = 'playing';
    this.changeArea('town', true);
    this.autoSave();

    if (skipIntro) {
      this.ui.showInGameHud();
      this.ui.showAreaBanner(this.map.meta);
    } else {
      this.ui.showIntroStory();
    }
  }

  loadDataOnly(saved) {
    const bType = saved.player?.bodyType || this.settings.bodyType || 'male';
    this.player = new Player(saved.player.name, saved.player.jobId, bType);
    this.player.loadFromSave(saved.player);
    this._applySavedProgress(saved.progress);
    this._syncDiscoveryFromPlayer();
  }

  startFromSave(saved, skipBanner = false) {
    this.loadDataOnly(saved);
    this.mode = 'playing';
    this.ui.showInGameHud();
    this.changeArea(saved.areaId || 'town', skipBanner);
    this.addToast(`💾 ${this.player.name} (Lv.${this.player.level}) で冒険を再開！`);
  }

  _applySavedProgress(sp) {
    const p = this._createFreshProgress();
    if (sp) {
      p.visitedAreas = new Set(sp.visitedAreas || ['town']);
      p.defeatedBosses = new Set(sp.defeatedBosses || []);
      p.openedChests = new Set(sp.openedChests || []);
      p.brokenWalls = new Set(sp.brokenWalls || []);
      p.activatedSwitches = new Set(sp.activatedSwitches || []);
      p.discoveredWeapons = new Set(sp.discoveredWeapons || []);
      p.discoveredArmors = new Set(sp.discoveredArmors || []);
      p.discoveredSpells = new Set(sp.discoveredSpells || []);
      p.monsterKills = { ...(sp.monsterKills || {}) };
      p.achievements = new Set(sp.achievements || []);
      p.gameCleared = Boolean(sp.gameCleared);
      p.ngPlus = sp.ngPlus || 1;
      p.bestTowerFloor = sp.bestTowerFloor || 0;
      p.bestTowerScore = sp.bestTowerScore || 0;
      p.stats = { playTime: 0, totalKills: 0, deaths: 0, maxCombo: 0, ...(sp.stats || {}) };
    }
    this.progress = p;
  }

  _syncDiscoveryFromPlayer() {
    for (const w of this.player.weapons) this.progress.discoveredWeapons.add(w.id);
    for (const a of this.player.armors) this.progress.discoveredArmors.add(a.id);
    for (const spId of Object.keys(this.player.spells)) {
      if (this.player.spells[spId] > 0) this.progress.discoveredSpells.add(spId);
    }
  }

  startNewGamePlus() {
    this.progress.ngPlus = (this.progress.ngPlus || 1) + 1;
    this.progress.defeatedBosses.clear();
    this.progress.openedChests.clear();
    this.progress.activatedSwitches.clear();
    this.player.fullRestore();
    this.changeArea('town');
    this.autoSave();
    this.addToast(`✦ 強くてニューゲーム（${this.progress.ngPlus}周目）開始！敵と報酬が強化されました！`);
  }

  enterEndlessTower(floor = 1) {
    this.towerFloor = floor;
    if (floor === 1) this.towerScore = 0;
    this.towerFloorCleared = false;
    this.changeArea('tower', false);
    this.addToast(`🗼 勇者の試練の古塔 第${floor}階層 スタート！`);
  }

  returnToTitle() {
    this.network.disconnect(true);
    this.mode = 'title';
    this.boss = null;
    this.lockTarget = null;
    this.audio.playBgm('title');
    this.ui.refreshTitleScreen();
  }

  // ==========================================================================
  // AREA TRANSITION & ENTITY SPAWNING
  // ==========================================================================
  changeArea(areaId, silentBanner = false) {
    this.currentAreaId = areaId;
    if (areaId !== 'tower') {
      this.progress.visitedAreas.add(areaId);
    }
    this.map = buildAreaMap(areaId, this.progress, this.towerFloor);
    this.player.x = this.map.spawn.x;
    this.player.y = this.map.spawn.y;
    this.player.zHeight = 0;
    this.player.vz = 0;
    this.player.facing = areaId === 'town' ? -Math.PI * 0.5 : 0;
    this.player.drone.x = this.player.x - 28;
    this.player.drone.y = this.player.y - 20;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.camera.yaw = this.player.facing;
    this.lockTarget = null;

    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.drops = [];
    this.slashes = [];
    this.afterimages = [];
    this.particles = [];
    this.portalCooldown = 0.85;
    this.towerFloorCleared = false;

    const ngScale = 1 + ((this.progress.ngPlus || 1) - 1) * 0.6;
    for (const sp of this.map.enemySpawns) {
      const mult = (sp.towerScale || 1.0) * ngScale;
      this.enemies.push(new Enemy(sp.enemyId, sp.x, sp.y, mult));
    }

    this.audio.playBgm(this.map.meta.bgm);
    if (!silentBanner) {
      this.ui.showAreaBanner(this.map.meta);
    }
    this.autoSave();
    this.ui.updateHud();
  }

  isPortalLocked(pt) {
    if (pt.requiresBoss && !this.progress.defeatedBosses.has(pt.requiresBoss)) return true;
    if (pt.requiresClear && !this.progress.gameCleared) return true;
    if (pt.requiresSecret) {
      const ok = this.progress.visitedAreas.has('secret') ||
        this.progress.defeatedBosses.size >= 3 ||
        this.progress.brokenWalls.size >= 2;
      if (!ok) return true;
    }
    return false;
  }

  // ==========================================================================
  // GAME JUICE FX HELPERS
  // ==========================================================================
  triggerHitstop(sec = 0.05) {
    this.hitstopTimer = Math.max(this.hitstopTimer, sec);
  }

  triggerSlowMo(sec = 1.0, scale = 0.25) {
    this.slowMoTimer = Math.max(this.slowMoTimer, sec);
    this.slowMoScale = scale;
  }

  addShake(power) {
    this.shakePower = Math.min(22, Math.max(this.shakePower, power));
  }

  triggerFlash(color = '#38f8d4', intensity = 0.45) {
    this.screenFlash = Math.max(this.screenFlash, intensity);
    this.screenFlashColor = color;
  }

  spawnBurst(x, y, color, count = 10, speed = 150) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.85);
      const life = 0.24 + Math.random() * 0.34;
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        size: 2.5 + Math.random() * 4.5,
        color,
        life,
        maxLife: life,
      });
    }
  }

  spawnRing(x, y, color, startSize = 14, expand = 110, dur = 0.32) {
    this.particles.push({
      x, y, vx: 0, vy: 0,
      size: startSize,
      expand,
      ring: true,
      color,
      life: dur,
      maxLife: dur,
    });
  }

  spawnLightningArc(x1, y1, x2, y2, color = '#fde047') {
    this.particles.push({
      x: x1, y: y1, tx: x2, ty: y2,
      vx: 0, vy: 0,
      lightning: true,
      color,
      life: 0.22,
      maxLife: 0.22,
    });
  }

  spawnAfterimage(x, y, facing, color, jobId) {
    this.afterimages.push({ x, y, facing, color, jobId, alpha: 0.85 });
  }

  spawnDamageText(x, y, text, color = '#ffffff', scale = 1.0) {
    this.damageTexts.push({
      x: x + (Math.random() - 0.5) * 14,
      y,
      vy: -56,
      text: String(text),
      color,
      scale,
      life: 0.85,
      maxLife: 0.85,
    });
  }

  spawnProjectile(cfg) {
    this.projectiles.push({
      owner: cfg.owner || 'player',
      x: cfg.x,
      y: cfg.y,
      vx: Math.cos(cfg.angle) * cfg.speed,
      vy: Math.sin(cfg.angle) * cfg.speed,
      speed: cfg.speed,
      radius: cfg.radius || 7,
      damage: cfg.damage || 15,
      element: cfg.element || 'none',
      color: cfg.color || '#38f8d4',
      statusOnHit: cfg.statusOnHit || null,
      piercing: Boolean(cfg.piercing),
      explosive: Boolean(cfg.explosive),
      homing: Boolean(cfg.homing),
      fromDrone: Boolean(cfg.fromDrone),
      hitIds: new Set(),
      life: cfg.life || 1.4,
    });
  }

  // ==========================================================================
  // COMBAT ACTIONS: ATTACK, FLURRY RUSH, PARRY, MAGIC, LIMIT BREAK, INTERACT
  // ==========================================================================
  checkPerfectDodgeFlurryRush() {
    const p = this.player;
    let triggerEnemy = null;

    // 1. Check Boss active telegraphs (near charge completion) or Boss dash
    if (this.boss && this.boss.alive) {
      if (this.boss.dashTimer > 0 && Math.hypot(this.boss.x - p.x, this.boss.y - p.y) < this.boss.radius + 115) {
        triggerEnemy = this.boss;
      }
      if (!triggerEnemy) {
        for (const tg of this.boss.telegraphs) {
          const prog = tg.timer / tg.chargeTime;
          if (prog >= 0.45 && prog <= 1.15) {
            if (tg.type === 'circle' && Math.hypot(p.x - tg.x, p.y - tg.y) < tg.radius + 55) {
              triggerEnemy = this.boss;
              break;
            } else if (tg.type === 'laser') {
              triggerEnemy = this.boss;
              break;
            }
          }
        }
      }
    }

    // 2. Check Elite / Charger Enemies during windup or charge or incoming projectiles
    if (!triggerEnemy) {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if ((e.chargeWindup > 0 || e.charging > 0) && d < e.radius + 125) {
          triggerEnemy = e;
          break;
        }
      }
    }
    if (!triggerEnemy) {
      for (const pr of this.projectiles) {
        if (pr.owner === 'enemy' && Math.hypot(pr.x - p.x, pr.y - p.y) < pr.radius + 68) {
          const nearest = this._findNearestHostiles(p.x, p.y, 320, 1);
          if (nearest.length > 0) triggerEnemy = nearest[0];
          break;
        }
      }
    }

    if (triggerEnemy) {
      p.flurryRushTimer = 2.6;
      p.flurryTarget = triggerEnemy;
      this.lockTarget = triggerEnemy;
      this.triggerSlowMo(1.1, 0.28);
      this.triggerFlash('#38bdf8', 0.38);
      this.audio.playSe('limit');
      this.spawnRing(p.x, p.y, '#38bdf8', 16, 140, 0.45);
      this.spawnDamageText(p.x, p.y - 38, '⚡ JUST DODGE! ラッシュ発動!! ⚡', '#67e8f9', 1.38);
      this.addToast('⚡ ジャスト回避成功！【ラッシュ（攻撃連打で超高速連撃）】発動！');
    }
  }

  performAttack(aimAngle = null) {
    if (this.mode !== 'playing' || this.ui.isModalOpen) return;
    const p = this.player;
    if (p.downed || p.attackCooldown > 0 || p.statuses.paralyze > 0) return;

    p.weaponDrawnTimer = 5.5;
    p.attackAnimTimer = 0.28;

    // Auto-face Z-Targeted enemy or Flurry Rush target
    if (p.flurryRushTimer > 0 && p.flurryTarget && (p.flurryTarget.alive || p.flurryTarget.hp > 0)) {
      const t = p.flurryTarget;
      const dist = Math.hypot(t.x - p.x, t.y - p.y);
      const ang = Math.atan2(t.y - p.y, t.x - p.x);
      p.facing = ang;
      if (dist > (t.radius || 22) + 36) {
        // High-speed dash-step right up to the target with pale blue afterimages!
        this.spawnAfterimage(p.x, p.y, p.facing, '#38bdf8', p.jobId);
        p.x = t.x - Math.cos(ang) * ((t.radius || 22) + 28);
        p.y = t.y - Math.sin(ang) * ((t.radius || 22) + 28);
        this.spawnAfterimage(p.x, p.y, p.facing, '#67e8f9', p.jobId);
      }
    } else if (this.lockTarget && (this.lockTarget.alive || this.lockTarget.hp > 0)) {
      p.facing = Math.atan2(this.lockTarget.y - p.y, this.lockTarget.x - p.x);
    } else if (aimAngle !== null) {
      p.facing = aimAngle;
    }

    const job = p.getJob();
    const st = p.getStats();
    const isFlurry = p.flurryRushTimer > 0;

    p.comboStep = (p.comboStep % 3) + 1;
    p.comboResetTimer = 0.85;
    p.attackCooldown = job.attackCooldown * (isFlurry ? 0.45 : p.statuses.overclock > 0 ? 0.8 : 1.0);

    const isFinisher = p.comboStep === 3;
    const comboMult = (isFinisher ? 1.45 : p.comboStep === 2 ? 1.15 : 1.0) * (isFlurry ? 1.35 : 1.0);

    // Subtle forward lunge on melee swing
    if (p.jobId !== 'mage') {
      const lunge = isFinisher ? 12 : 6;
      p.vx += Math.cos(p.facing) * lunge * 14;
      p.vy += Math.sin(p.facing) * lunge * 14;
    }

    if (p.jobId === 'mage') {
      this.audio.playSe(isFinisher ? 'slashHeavy' : 'slash');
      const count = isFinisher ? 3 : isFlurry ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const spread = count === 1 ? 0 : (i - (count - 1) * 0.5) * 0.22;
        this.spawnProjectile({
          owner: 'player',
          x: p.x + Math.cos(p.facing) * 18,
          y: p.y + Math.sin(p.facing) * 18,
          angle: p.facing + spread,
          speed: 490,
          radius: isFinisher ? 10 : 7.5,
          damage: Math.round(st.mag * 0.95 * comboMult),
          element: st.element === 'none' ? 'ice' : st.element,
          color: st.weaponColor,
          homing: true,
          life: 1.05,
        });
      }
      this._checkCrackedWallHits(p.x + Math.cos(p.facing) * 56, p.y + Math.sin(p.facing) * 56, 48);
    } else {
      // Wide Musou Sword Slash Trail (1: Right Sweep -> 2: Left Upward Slash -> 3: 360 Spin / Smash!)
      const range = job.attackRange + (isFinisher ? 22 : 0) + Math.min(20, st.weaponPlus * 2);
      const arc = isFinisher ? Math.PI * 1.85 : job.attackArc;
      this.audio.playSe(isFinisher ? 'slashHeavy' : 'slash');

      this.slashes.push({
        x: p.x,
        y: p.y,
        angle: p.facing,
        radius: range * 0.84,
        arc,
        comboStep: p.comboStep,
        swingDir: p.comboStep === 2 ? -1 : 1,
        spinAttack: isFinisher,
        color: isFlurry ? '#38bdf8' : isFinisher ? '#fbbf24' : st.weaponColor,
        weaponPlus: st.weaponPlus,
        life: isFinisher ? 0.25 : 0.19,
        maxLife: isFinisher ? 0.25 : 0.19,
      });

      this.network.broadcast({
        type: 'vfx',
        kind: 'slash',
        areaId: this.currentAreaId,
        x: p.x, y: p.y, angle: p.facing, radius: range * 0.84, arc, color: st.weaponColor,
      });

      // Blade Knight 3rd hit emits piercing sword beam shockwave!
      if (p.jobId === 'knight' && isFinisher) {
        this.spawnProjectile({
          owner: 'player',
          x: p.x + Math.cos(p.facing) * 24,
          y: p.y + Math.sin(p.facing) * 24,
          angle: p.facing,
          speed: 480,
          radius: 14,
          damage: Math.round(st.atk * 1.25),
          element: st.element,
          color: '#fbbf24',
          piercing: true,
          life: 0.65,
        });
      }

      const dmgBase = Math.round(st.atk * comboMult);
      this._applyMeleeHits(p.x, p.y, p.facing, range, arc, dmgBase, st.element, st.crit || (isFlurry ? 0.65 : 0.15));
    }
  }

  _applyMeleeHits(ox, oy, facing, range, arc, dmgBase, element, critRate) {
    const halfArc = arc * 0.55;
    let landedAny = false;

    const inArc = (tx, ty, targetRadius) => {
      const dx = tx - ox;
      const dy = ty - oy;
      const dist = Math.hypot(dx, dy);
      if (dist > range + targetRadius) return false;
      if (dist < targetRadius + 18) return true;
      let diff = Math.atan2(dy, dx) - facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return Math.abs(diff) <= halfArc;
    };

    // Hit Enemies
    for (const e of this.enemies) {
      if (!e.alive || !inArc(e.x, e.y, e.radius)) continue;
      const isCrit = Math.random() < critRate;
      const ang = Math.atan2(e.y - oy, e.x - ox);
      e.takeDamage(dmgBase, element, isCrit, Math.cos(ang), Math.sin(ang), this);
      this._onPlayerHitLanded(isCrit);
      landedAny = true;
    }

    // Hit Boss & Guardian Crystals
    if (this.boss && this.boss.alive) {
      for (const c of this.boss.crystals) {
        if (c.hp <= 0 || !inArc(c.x, c.y, c.radius)) continue;
        this.boss.damageCrystal(c, dmgBase, this);
        this._onPlayerHitLanded(false);
        landedAny = true;
      }
      if (inArc(this.boss.x, this.boss.y, this.boss.radius)) {
        const isCrit = Math.random() < critRate;
        const res = this.boss.takeDamage(dmgBase, element, isCrit, this);
        if (res.dmg > 0) {
          this._onPlayerHitLanded(isCrit);
          this.network.broadcast({ type: 'boss_hit', areaId: this.currentAreaId, dmg: res.dmg, element, isCrit });
        }
        landedAny = true;
      }
    }

    // Hit Switches & Cracked Secret Walls!
    const hx = ox + Math.cos(facing) * (range * 0.65);
    const hy = oy + Math.sin(facing) * (range * 0.65);
    this._checkCrackedWallHits(hx, hy, 54);
    for (const sw of this.map.switches) {
      if (!sw.activated && Math.hypot(sw.x - hx, sw.y - hy) < 54) {
        this._activateSwitch(sw);
      }
    }

    if (landedAny) {
      this.addShake(3.2);
    }
  }

  _onPlayerHitLanded(isCrit) {
    const combo = this.player.registerComboHit(1);
    if (combo > (this.progress.stats.maxCombo || 0)) {
      this.progress.stats.maxCombo = combo;
    }
    if (combo >= 30) this.unlockAchievement('combo_30');
    if (combo >= 80) this.unlockAchievement('combo_80');
    this.player.addLimit(isCrit ? 6.5 : 3.5);
    // Sexy Neon Valkyrie Charm Drain: restores HP on hit!
    if (this.player.jobId === 'valkyrie' && !this.player.downed) {
      const st = this.player.getStats();
      const drain = isCrit ? 6 : 3;
      this.player.hp = Math.min(st.maxHp, this.player.hp + drain);
    }
    if (isCrit) {
      this.triggerHitstop(0.05);
      this.addShake(6.5);
      this.audio.playSe('crit');
    } else {
      this.audio.playSe('hit');
    }
  }

  _checkCrackedWallHits(x, y, radius) {
    const TS = GAME_META.tileSize;
    for (const cw of this.map.crackedWalls) {
      if (cw.broken) continue;
      const wx = (cw.tx + 0.5) * TS;
      const wy = (cw.ty + 0.5) * TS;
      if (Math.hypot(wx - x, wy - y) <= radius + TS * 0.5) {
        cw.hp -= 1;
        this.spawnBurst(wx, wy, '#fbbf24', 10, 170);
        this.addShake(4.5);
        this.audio.playSe('crack');
        if (cw.hp <= 0) {
          this._shatterCrackedWall(cw, true);
        } else {
          this.spawnDamageText(wx, wy - 20, `ヒビ割れ！残り${cw.hp}`, '#fde047', 0.95);
        }
      }
    }
  }

  _shatterCrackedWall(cw, broadcast = false) {
    if (cw.broken) return;
    const TS = GAME_META.tileSize;
    const wx = (cw.tx + 0.5) * TS;
    const wy = (cw.ty + 0.5) * TS;
    breakCrackedWall(this.map, cw);
    this.progress.brokenWalls.add(cw.id);
    this.spawnBurst(wx, wy, '#fbbf24', 26, 260);
    this.spawnRing(wx, wy, '#38f8d4', 14, 90, 0.35);
    this.addShake(9);
    this.audio.playSe('chest');
    this.addToast('💎 ヒビ割れた隠し壁を破壊！秘密の部屋を発見した！');
    this.unlockAchievement('secret_wall');
    if (broadcast) {
      this.network.broadcast({ type: 'world_event', kind: 'wall_break', areaId: this.currentAreaId, wallId: cw.id });
    }
  }

  _activateSwitch(sw, broadcast = true) {
    if (sw.activated) return;
    openSwitchGate(this.map, sw);
    this.progress.activatedSwitches.add(sw.id);
    this.spawnRing(sw.x, sw.y, sw.color || '#38f8d4', 14, 100, 0.4);
    this.audio.playSe('switch');
    this.addShake(5);
    this.addToast('🔓 エネルギーゲートが開放されました！');
    if (broadcast) {
      this.network.broadcast({ type: 'world_event', kind: 'switch', areaId: this.currentAreaId, switchId: sw.id });
    }
  }

  // ==========================================================================
  // 5 SWITCHABLE SPELLS
  // ==========================================================================
  performMagic() {
    if (this.mode !== 'playing' || this.ui.isModalOpen) return;
    const p = this.player;
    if (p.downed || p.spellCooldown > 0 || p.statuses.paralyze > 0) return;

    const sp = getSpellById(p.activeSpell);
    const lv = p.spells[sp.id] || 0;
    if (lv <= 0) {
      this.addToast('魔法を習得していません！拠点の魔法屋へ行こう。');
      return;
    }
    if (p.mp < sp.mpCost) {
      this.spawnDamageText(p.x, p.y - 26, 'MP不足!', '#7dd3fc', 0.9);
      return;
    }

    p.mp -= sp.mpCost;
    p.spellCooldown = sp.cooldown;
    const st = p.getStats();
    const power = Math.round((sp.basePower + st.mag * 1.45) * (1 + (lv - 1) * 0.28));

    if (sp.id === 'fire') {
      this.audio.playSe('fire');
      this.spawnProjectile({
        owner: 'player',
        x: p.x + Math.cos(p.facing) * 20,
        y: p.y + Math.sin(p.facing) * 20,
        angle: p.facing,
        speed: 420,
        radius: 13,
        damage: power,
        element: 'fire',
        color: '#fb923c',
        statusOnHit: 'burn',
        explosive: true,
        life: 1.25,
      });
    } else if (sp.id === 'ice') {
      this.audio.playSe('ice');
      const novaR = 165 + lv * 14;
      this.spawnRing(p.x, p.y, '#7dd3fc', 18, novaR, 0.42);
      this.spawnBurst(p.x, p.y, '#bae6fd', 22, 220);
      this._damageEnemiesInRadius(p.x, p.y, novaR, power, 'ice', 'freeze', st.crit);
    } else if (sp.id === 'lightning') {
      this.audio.playSe('lightning');
      const targets = this._findNearestHostiles(p.x, p.y, 290, 4);
      let prevX = p.x;
      let prevY = p.y;
      if (targets.length === 0) {
        this.spawnLightningArc(p.x, p.y, p.x + Math.cos(p.facing) * 140, p.y + Math.sin(p.facing) * 140, '#fde047');
      }
      for (const t of targets) {
        this.spawnLightningArc(prevX, prevY, t.x, t.y, '#fde047');
        prevX = t.x;
        prevY = t.y;
        const isCrit = Math.random() < st.crit;
        if (t._isCrystal && this.boss) {
          this.boss.damageCrystal(t, power, this);
        } else if (t._isBoss && this.boss) {
          this.boss.takeDamage(power, 'lightning', isCrit, this);
          this.boss.applyStatus('paralyze', 1.4);
        } else {
          t.takeDamage(power, 'lightning', isCrit, 0, 0, this);
          t.applyStatus('paralyze', 2.4);
        }
        this._onPlayerHitLanded(isCrit);
      }
    } else if (sp.id === 'heal') {
      this.audio.playSe('heal');
      const healAmt = Math.round(sp.basePower * (1 + (lv - 1) * 0.32) + st.mag * 1.4);
      p.hp = Math.min(st.maxHp, p.hp + healAmt);
      p.statuses.poison = 0;
      this.spawnDamageText(p.x, p.y - 26, `+${healAmt} HP`, '#34d399', 1.25);
      this.spawnRing(p.x, p.y, '#34d399', 20, 210, 0.5);
      this.spawnBurst(p.x, p.y, '#6ee7b7', 18, 160);
      // Broadcast Co-op AoE Heal to nearby teammates!
      this.network.broadcast({ type: 'aoe_heal', areaId: this.currentAreaId, x: p.x, y: p.y, amount: healAmt });
    } else if (sp.id === 'overclock') {
      this.audio.playSe('buff');
      const dur = sp.basePower + (lv - 1) * 3;
      p.statuses.overclock = Math.max(p.statuses.overclock, dur);
      this.spawnDamageText(p.x, p.y - 28, 'OVERCLOCK!', '#38f8d4', 1.25);
      this.spawnRing(p.x, p.y, '#38f8d4', 18, 220, 0.45);
      this.spawnBurst(p.x, p.y, '#38f8d4', 20, 180);
      this.network.broadcast({ type: 'aoe_buff', areaId: this.currentAreaId, x: p.x, y: p.y, duration: dur });
    }
  }

  // ==========================================================================
  // ULTIMATE LIMIT BREAK (100% GAUGE)
  // ==========================================================================
  performLimitBreak() {
    if (this.mode !== 'playing' || this.ui.isModalOpen) return;
    const p = this.player;
    if (p.downed || p.limit < 100) {
      if (!p.downed) this.addToast(`リミットゲージがまだ ${Math.floor(p.limit)}% です！`);
      return;
    }

    p.limit = 0;
    p.invulnTimer = 1.6;
    const job = p.getJob();
    const st = p.getStats();

    this.triggerHitstop(0.06);
    this.triggerSlowMo(0.45, 0.38);
    this.addShake(16);
    this.triggerFlash(job.color, 0.55);
    this.audio.playSe('limit');
    this.addToast(`★ 究極必殺技発動！【${job.limitName}】★`);
    this.spawnDamageText(p.x, p.y - 42, `★ ${job.limitName} ★`, '#fef08a', 1.4);

    const ultDmg = Math.round((st.atk + st.mag) * 3.1);

    if (p.jobId === 'knight') {
      // Astral Tempest: huge 360 plasma shockwaves!
      for (let i = 0; i < 4; i++) {
        this.spawnRing(p.x, p.y, i % 2 === 0 ? '#38f8d4' : '#fbbf24', 20 + i * 18, 270, 0.55 + i * 0.08);
      }
      this.spawnBurst(p.x, p.y, '#38f8d4', 45, 340);
      this._damageEnemiesInRadius(p.x, p.y, 285, ultDmg, 'holy', 'burn', 1.0);
    } else if (p.jobId === 'mage') {
      // Meteor Prism Nova: 7 cascading orbital blasts across enemies!
      const targets = this._findNearestHostiles(p.x, p.y, 380, 7);
      for (let i = 0; i < 7; i++) {
        const tx = targets[i] ? targets[i].x : p.x + Math.cos((i / 7) * Math.PI * 2) * 140;
        const ty = targets[i] ? targets[i].y : p.y + Math.sin((i / 7) * Math.PI * 2) * 140;
        this.spawnRing(tx, ty, '#e879f9', 14, 125, 0.5);
        this.spawnBurst(tx, ty, '#7dd3fc', 18, 240);
        this._damageEnemiesInRadius(tx, ty, 125, Math.round(ultDmg * 0.62), 'ice', 'freeze', 1.0);
      }
    } else if (p.jobId === 'valkyrie') {
      // Valkyrie Ecstasy: Rose-gold charm shockwaves + massive self heal!
      for (let i = 0; i < 5; i++) {
        this.spawnRing(p.x, p.y, i % 2 === 0 ? '#ff2e93' : '#fbbf24', 22 + i * 16, 300, 0.55 + i * 0.07);
      }
      this.spawnBurst(p.x, p.y, '#ff2e93', 50, 360);
      const healAmt = Math.round(st.maxHp * 0.55);
      p.hp = Math.min(st.maxHp, p.hp + healAmt);
      this.spawnDamageText(p.x, p.y - 60, `💋 CHARM HEAL +${healAmt}!`, '#ff2e93', 1.3);
      this._damageEnemiesInRadius(p.x, p.y, 310, Math.round(ultDmg * 1.18), 'holy', 'burn', 1.0);
    } else if (p.jobId === 'seraphina') {
      // Midnight Temptation: 9 purple-rose lightning chains + paralysis nova!
      const targets = this._findNearestHostiles(p.x, p.y, 400, 9);
      let prevX = p.x;
      let prevY = p.y;
      for (let i = 0; i < 9; i++) {
        const tx = targets[i] ? targets[i].x : p.x + Math.cos((i / 9) * Math.PI * 2) * 160;
        const ty = targets[i] ? targets[i].y : p.y + Math.sin((i / 9) * Math.PI * 2) * 160;
        this.spawnLightningArc(prevX, prevY, tx, ty, '#ff49db');
        this.spawnRing(tx, ty, '#c084fc', 14, 130, 0.48);
        prevX = tx;
        prevY = ty;
      }
      this.spawnBurst(p.x, p.y, '#ff49db', 48, 350);
      this._damageEnemiesInRadius(p.x, p.y, 340, Math.round(ultDmg * 1.22), 'lightning', 'paralyze', 1.0);
    } else {
      // Phantom Overload: 8 guaranteed critical blitz slashes!
      const targets = this._findNearestHostiles(p.x, p.y, 340, 8);
      let prevX = p.x;
      let prevY = p.y;
      for (const t of targets) {
        this.spawnLightningArc(prevX, prevY, t.x, t.y, '#34d399');
        this.spawnAfterimage(t.x, t.y, p.facing, '#34d399', 'rogue');
        prevX = t.x;
        prevY = t.y;
      }
      this.spawnBurst(p.x, p.y, '#a3e635', 40, 320);
      this._damageEnemiesInRadius(p.x, p.y, 320, Math.round(ultDmg * 1.15), 'lightning', 'paralyze', 1.0);
    }

    this.network.broadcast({ type: 'vfx', kind: 'limit', areaId: this.currentAreaId, x: p.x, y: p.y, color: job.color });
  }

  _damageEnemiesInRadius(cx, cy, radius, dmg, element, statusEffect, critRate) {
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.x - cx, e.y - cy) > radius + e.radius) continue;
      const isCrit = Math.random() < critRate;
      const ang = Math.atan2(e.y - cy, e.x - cx);
      e.takeDamage(dmg, element, isCrit, Math.cos(ang), Math.sin(ang), this);
      if (statusEffect) e.applyStatus(statusEffect, 4.5);
      this._onPlayerHitLanded(isCrit);
    }
    if (this.boss && this.boss.alive) {
      for (const c of this.boss.crystals) {
        if (c.hp > 0 && Math.hypot(c.x - cx, c.y - cy) <= radius + c.radius) {
          this.boss.damageCrystal(c, dmg, this);
        }
      }
      if (Math.hypot(this.boss.x - cx, this.boss.y - cy) <= radius + this.boss.radius) {
        const isCrit = Math.random() < critRate;
        const res = this.boss.takeDamage(dmg, element, isCrit, this);
        if (res.dmg > 0) {
          if (statusEffect) this.boss.applyStatus(statusEffect, 3.5);
          this._onPlayerHitLanded(isCrit);
          this.network.broadcast({ type: 'boss_hit', areaId: this.currentAreaId, dmg: res.dmg, element, isCrit });
        }
      }
    }
    this._checkCrackedWallHits(cx, cy, radius * 0.75);
  }

  _findNearestHostiles(cx, cy, maxDist, limit) {
    const list = [];
    if (this.boss && this.boss.alive) {
      for (const c of this.boss.crystals) {
        if (c.hp <= 0) continue;
        const d = Math.hypot(c.x - cx, c.y - cy);
        if (d <= maxDist) list.push({ dist: d, obj: Object.assign(c, { _isCrystal: true }) });
      }
      if (!this.boss.isShielded()) {
        const d = Math.hypot(this.boss.x - cx, this.boss.y - cy);
        if (d <= maxDist + 40) list.push({ dist: d, obj: Object.assign(this.boss, { _isBoss: true }) });
      }
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - cx, e.y - cy);
      if (d <= maxDist) list.push({ dist: d, obj: e });
    }
    list.sort((a, b) => a.dist - b.dist);
    return list.slice(0, limit).map((x) => x.obj);
  }

  // ==========================================================================
  // CONTEXTUAL INTERACTION: NPCS, CHESTS, SHRINES, PORTALS, CO-OP RESCUE
  // ==========================================================================
  getNearestInteractable() {
    const p = this.player;
    if (p.downed) return null;

    // 1. Downed Co-op Ally Rescue (Highest Priority!)
    for (const rp of this.network.remotePlayers.values()) {
      if (rp.areaId === this.currentAreaId && rp.downed && Math.hypot(rp.x - p.x, rp.y - p.y) < 82) {
        return { type: 'rescue', ref: rp, shortLabel: '長押し蘇生' };
      }
    }
    // 2. NPC
    for (const n of this.map.npcs) {
      if (Math.hypot(n.x - p.x, n.y - p.y) < 74) {
        return { type: 'npc', ref: n, shortLabel: '話す' };
      }
    }
    // 3. Chest
    for (const ch of this.map.chests) {
      if (!ch.opened && Math.hypot(ch.x - p.x, ch.y - p.y) < 68) {
        return { type: 'chest', ref: ch, shortLabel: '宝箱' };
      }
    }
    // 4. Mystic Shrine
    for (const sh of this.map.shrines) {
      if (!sh.used && Math.hypot(sh.x - p.x, sh.y - p.y) < 72) {
        return { type: 'shrine', ref: sh, shortLabel: '祭壇' };
      }
    }
    // 5. Switch
    for (const sw of this.map.switches) {
      if (!sw.activated && Math.hypot(sw.x - p.x, sw.y - p.y) < 62) {
        return { type: 'switch', ref: sw, shortLabel: 'スイッチ' };
      }
    }
    // 6. Portal
    for (const pt of this.map.portals) {
      if (Math.hypot(pt.x - p.x, pt.y - p.y) < 62) {
        return { type: 'portal', ref: pt, shortLabel: '移動' };
      }
    }
    return null;
  }

  performInteract() {
    if (this.mode !== 'playing') return;
    if (this.ui.isModalOpen) {
      if (!this.ui.el.dialogueBox.classList.contains('hidden')) {
        this.ui.advanceDialogue();
      }
      return;
    }

    const target = this.getNearestInteractable();
    if (!target) return;

    if (target.type === 'npc') {
      const def = NPCS[target.ref.npcId];
      if (!def) return;
      this.audio.playSe('uiClick');
      if (def.role === 'talk' || def.role === 'guide') {
        this.ui.openDialogue(def.name, def.icon, def.lines);
      } else if (def.role === 'warp') {
        this.ui.openWarpModal();
      } else {
        this.ui.openFacility(def.role);
      }
    } else if (target.type === 'chest') {
      this._openChest(target.ref);
    } else if (target.type === 'shrine') {
      this._activateShrine(target.ref);
    } else if (target.type === 'switch') {
      this._activateSwitch(target.ref);
    } else if (target.type === 'portal') {
      this._tryEnterPortal(target.ref);
    }
  }

  _openChest(ch) {
    if (ch.opened) return;
    ch.opened = true;
    this.progress.openedChests.add(ch.id);
    this.audio.playSe('chest');
    this.spawnBurst(ch.x, ch.y, '#fbbf24', 24, 220);

    const rw = ch.reward || {};
    const msgParts = [];
    if (rw.gold) {
      this.player.gold += rw.gold;
      msgParts.push(`${rw.gold}G`);
    }
    if (rw.ore) {
      this.player.ores[rw.ore.type] = (this.player.ores[rw.ore.type] || 0) + rw.ore.count;
      msgParts.push(`${ORES[rw.ore.type].name}×${rw.ore.count}`);
    }
    if (rw.core) {
      this.player.cores[rw.core] = (this.player.cores[rw.core] || 0) + 1;
      msgParts.push(`${CORES[rw.core].name}`);
    }
    if (rw.weaponId) {
      const w = getWeaponById(rw.weaponId);
      this.player.addWeapon(w.id, 1);
      this.progress.discoveredWeapons.add(w.id);
      msgParts.push(`⚔${w.name}+1`);
    }
    if (rw.armorId) {
      const a = getArmorById(rw.armorId);
      this.player.addArmor(a.id, 1);
      this.progress.discoveredArmors.add(a.id);
      msgParts.push(`🛡${a.name}+1`);
    }

    this.addToast(`🎁 宝箱を開封！ ${msgParts.join(' / ')}`);
    this.autoSave();

    // Share celebratory bonus with co-op party!
    this.network.broadcast({
      type: 'shared_reward',
      areaId: this.currentAreaId,
      source: '宝箱シェア',
      exp: 25,
      gold: rw.gold || 100,
    });
  }

  _activateShrine(sh) {
    if (sh.used) return;
    sh.used = true;
    this.unlockAchievement('shrine_visit');
    this.spawnRing(sh.x, sh.y, '#e879f9', 16, 140, 0.5);
    this.spawnBurst(sh.x, sh.y, '#fef08a', 24, 210);

    const roll = Math.random();
    if (roll < 0.34) {
      // Full Blessing
      this.player.fullRestore();
      this.player.addLimit(50);
      this.audio.playSe('heal');
      this.addToast('⛩ 神秘の祭壇：【星結晶の祝福】HP・MP全回復＆リミット+50%！');
    } else if (roll < 0.68) {
      // 2x Attack Overdrive
      this.player.statuses.shrineAtk = 30;
      this.audio.playSe('buff');
      this.addToast('⛩ 神秘の祭壇：【戦神の降臨】30秒間、攻撃力＆魔力が約2倍に激増！');
    } else if (roll < 0.86) {
      // Gold & Ore Fountain
      const bonus = 160 + this.player.level * 35;
      this.player.gold += bonus;
      this.player.ores.prism += 1;
      this.audio.playSe('coin');
      this.addToast(`⛩ 神秘の祭壇：【黄金の泉】${bonus}G ＆ 輝晶インゴットを獲得！`);
    } else {
      // Temporary Curse + Risk-Reward Core!
      this.player.statuses.shrineCurse = 15;
      this.player.addLimit(45);
      this.player.cores.power += 1;
      this.audio.playSe('warning');
      this.addToast('⛩ 神秘の祭壇：【虚空の試練】15秒の呪いを受けたが、パワーコア＆リミット+45%を得た！');
    }
  }

  _tryEnterPortal(pt) {
    if (this.portalCooldown > 0) return;
    if (this.isPortalLocked(pt)) {
      this.audio.playSe('hurt');
      if (pt.requiresBoss) {
        this.addToast('🔒 このエリアのボスを撃破すると次のゲートが開きます！');
      } else if (pt.requiresClear) {
        this.addToast('🔒 機械魔王オメガノヴァ撃破後に「エンドレス試練の塔」が解放されます！');
      } else if (pt.requiresSecret) {
        this.addToast('🔒 ボス3体撃破 または 隠し壁2箇所破壊で裏ボス神殿が解放されます！');
      }
      return;
    }

    this.audio.playSe('revive');
    if (pt.targetArea === 'tower_next') {
      this.enterEndlessTower(this.towerFloor + 1);
    } else if (pt.targetArea === 'tower') {
      this.enterEndlessTower(1);
    } else {
      this.changeArea(pt.targetArea);
    }
  }

  // ==========================================================================
  // PLAYER DAMAGE, GUARD / PERFECT PARRY, DOWNED RESCUE & DEATH PENALTY
  // ==========================================================================
  damageLocalPlayer(rawAtk, statusOnHit, srcX, srcY, sourceEntity = null) {
    const p = this.player;
    if (p.downed || p.invulnTimer > 0) return;

    // 1. Check Perfect Parry (Zelda-style Just Guard within 280ms window!)
    if (p.parryWindow > 0) {
      p.parryWindow = 0;
      p.parryFlashTimer = 0.45;
      p.invulnTimer = 0.85;
      p.addLimit(18);
      this.triggerHitstop(0.06);
      this.triggerSlowMo(0.42, 0.3);
      this.addShake(11);
      this.triggerFlash('#fbbf24', 0.42);
      this.audio.playSe('forge');
      this.spawnRing(p.x, p.y, '#fbbf24', 18, 130, 0.4);
      this.spawnBurst(p.x, p.y, '#fef08a', 24, 240);
      this.spawnDamageText(p.x, p.y - 36, '🛡 PARRY!! (ジャストガード!)', '#fde047', 1.38);
      this.addToast('🛡 パリィ成功！敵の体勢を崩した（被ダメージ1.5倍ブレイク状態）！');

      if (sourceEntity && typeof sourceEntity.applyParryBreak === 'function') {
        sourceEntity.applyParryBreak(3.5);
        this.spawnDamageText(sourceEntity.x, sourceEntity.y - 30, '⚡ BREAK!! (被ダメ1.5倍)', '#fde047', 1.25);
      } else {
        // Stagger any nearby enemies within 130px
        for (const e of this.enemies) {
          if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 140) {
            e.applyParryBreak(3.5);
          }
        }
        if (this.boss && this.boss.alive && Math.hypot(this.boss.x - p.x, this.boss.y - p.y) < 170) {
          this.boss.applyParryBreak(2.4);
        }
      }
      return;
    }

    // 2. Check Standard Shield / Magic Barrier Guard
    const st = p.getStats();
    if (p.guarding && p.stamina >= 12) {
      p.stamina = Math.max(0, p.stamina - 16);
      p.staminaDisplayAlpha = 1;
      const blockedDmg = Math.max(1, Math.round((rawAtk - st.def * 0.65) * 0.22));
      p.hp = Math.max(1, p.hp - blockedDmg);
      p.invulnTimer = 0.38;
      this.audio.playSe('hit');
      this.spawnRing(p.x, p.y, '#38bdf8', 12, 46, 0.22);
      this.spawnDamageText(p.x, p.y - 26, `🛡 GUARD -${blockedDmg}`, '#93c5fd', 0.98);
      return;
    }

    const dmg = Math.max(2, Math.round(rawAtk - st.def * 0.55));
    p.hp = Math.max(0, p.hp - dmg);
    p.invulnTimer = 0.62;
    p.hitFlash = 0.16;
    p.addLimit(7);

    this.spawnDamageText(p.x, p.y - 26, `-${dmg}`, '#fb7185', 1.15);
    this.spawnBurst(p.x, p.y, '#fb7185', 8, 150);
    this.addShake(6);
    this.triggerFlash('#ef4444', 0.25);
    this.audio.playSe('hurt');

    if (statusOnHit && Math.random() < 0.45) {
      p.statuses[statusOnHit] = Math.max(p.statuses[statusOnHit] || 0, statusOnHit === 'paralyze' ? 1.1 : 4.5);
    }

    if (p.hp <= 0) {
      if (this.network.isMultiplayer() && this._hasLivingTeammateInArea()) {
        p.downed = true;
        p.downedTimer = 30;
        this.addToast('🆘 戦闘不能！味方が近づいて長押しすると蘇生できます！');
        this.network.sendChat('🆘 助けて！蘇生お願いします！', true);
      } else {
        this._triggerDefeatPenalty();
      }
    }
  }

  _hasLivingTeammateInArea() {
    for (const rp of this.network.remotePlayers.values()) {
      if (rp.areaId === this.currentAreaId && !rp.downed) return true;
    }
    return false;
  }

  reviveLocalPlayer(rescuerName) {
    const st = this.player.getStats();
    this.player.downed = false;
    this.player.hp = Math.round(st.maxHp * 0.55);
    this.player.invulnTimer = 2.0;
    this.spawnRing(this.player.x, this.player.y, '#34d399', 16, 130, 0.5);
    this.spawnBurst(this.player.x, this.player.y, '#fef08a', 26, 220);
    this.audio.playSe('revive');
    this.addToast(`✨ ${rescuerName} に蘇生されました！`);
  }

  _triggerDefeatPenalty() {
    const goldLoss = Math.floor(this.player.gold / 2);
    this.player.gold -= goldLoss;
    this.progress.stats.deaths = (this.progress.stats.deaths || 0) + 1;
    this.boss = null;
    this.autoSave();
    this.ui.showDefeat(goldLoss);
  }

  recoverFromDefeat() {
    this.player.fullRestore();
    this.changeArea('town');
  }

  // ==========================================================================
  // ENEMY / BOSS KILL REWARDS & CO-OP SHARING
  // ==========================================================================
  onEnemyKilled(enemy) {
    this.progress.monsterKills[enemy.id] = (this.progress.monsterKills[enemy.id] || 0) + 1;
    this.progress.stats.totalKills = (this.progress.stats.totalKills || 0) + 1;
    this.unlockAchievement('first_blood');

    this.spawnBurst(enemy.x, enemy.y, enemy.def.color, 18, 210);
    this.spawnRing(enemy.x, enemy.y, enemy.def.accent, 10, 62, 0.28);

    const ngMult = 1 + ((this.progress.ngPlus || 1) - 1) * 0.8;
    const expGain = Math.round(enemy.exp * ngMult);
    const levels = this.player.gainExp(expGain);
    if (levels > 0) this._onLevelUp();

    if (this.currentAreaId === 'tower') {
      this.towerScore += 100 * this.towerFloor;
    }

    // Roll Hack-and-Slash Drops!
    const { dropBonus } = this.player.getComboBonus();
    const rolled = rollEnemyDrops(enemy, dropBonus);
    for (const d of rolled) {
      if (d.type === 'gold') d.amount = Math.round(d.amount * ngMult * this.player.getStats().goldMult);
      this.drops.push({ ...d, collected: false, life: 45 });
    }

    // Share EXP & Gold generously with all Co-op Party Members!
    this.network.broadcast({
      type: 'shared_reward',
      areaId: this.currentAreaId,
      source: enemy.name,
      exp: expGain,
      gold: Math.round(enemy.gold * ngMult),
      dropTable: enemy.def.dropTable,
    });
  }

  onBossDefeated(boss) {
    this.progress.monsterKills[boss.id] = (this.progress.monsterKills[boss.id] || 0) + 1;
    this.progress.defeatedBosses.add(boss.id);
    setBossGateState(this.map, false);

    // Grand Slow-Motion Boss Defeat Climax!
    this.triggerHitstop(0.06);
    this.triggerSlowMo(1.25, 0.24);
    this.addShake(20);
    this.triggerFlash('#fef08a', 0.65);
    this.audio.playSe('bossDefeat');
    this.spawnBurst(boss.x, boss.y, '#fbbf24', 55, 360);
    this.spawnRing(boss.x, boss.y, '#38f8d4', 24, 300, 0.7);

    // Achievements
    const bossAchMap = {
      boss_sylvarion: 'boss_forest',
      boss_crystalion: 'boss_cave',
      boss_chronos: 'boss_ruins',
      boss_ignis: 'boss_magma',
      boss_omega: 'game_clear',
      boss_astral_zero: 'secret_boss',
    };
    if (bossAchMap[boss.id]) this.unlockAchievement(bossAchMap[boss.id]);

    // Rewards
    const ngMult = 1 + ((this.progress.ngPlus || 1) - 1) * 0.85;
    const expGain = Math.round(boss.exp * ngMult);
    const goldGain = Math.round(boss.gold * ngMult * this.player.getStats().goldMult);
    const levels = this.player.gainExp(expGain);
    this.player.gold += goldGain;
    this.player.ores.prism += 3;
    this.player.ores.void += boss.def.isFinalBoss || boss.def.isSecretBoss ? 4 : 1;
    if (levels > 0) this._onLevelUp();

    // Guaranteed Boss Drop Weapon / Armor + Stat Core!
    if (boss.def.guaranteedDrop) {
      const gid = boss.def.guaranteedDrop;
      if (gid.startsWith('wp_')) {
        this.player.addWeapon(gid, 2);
        this.progress.discoveredWeapons.add(gid);
        this.addToast(`👑 ボス撃破報酬：⚔ ${getWeaponById(gid).name} +2 を獲得！`);
      } else {
        this.player.addArmor(gid, 2);
        this.progress.discoveredArmors.add(gid);
        this.addToast(`👑 ボス撃破報酬：🛡 ${getArmorById(gid).name} +2 を獲得！`);
      }
    }

    if (this.currentAreaId === 'tower') {
      this.towerScore += 1000 * this.towerFloor;
    }

    this.network.broadcast({
      type: 'shared_reward',
      areaId: this.currentAreaId,
      source: boss.name,
      exp: expGain,
      gold: goldGain,
      guaranteedDrop: boss.def.guaranteedDrop,
    });

    this.audio.playBgm(this.map.meta.bgm);
    this.autoSave();

    // Defeat Dialogue -> Ending (if Final Boss Omega Nova!)
    setTimeout(() => {
      if (boss.def.isFinalBoss && this.currentAreaId === 'citadel') {
        this.progress.gameCleared = true;
        this.autoSave();
        this.ui.openDialogue(boss.name, '👑', [boss.def.defeatLine], () => {
          this.audio.playBgm('title');
          this.ui.showEnding();
        });
      } else if (boss.def.defeatLine) {
        this.ui.openDialogue(boss.name, '✨', [boss.def.defeatLine]);
      }
    }, 950);
  }

  receiveSharedPartyReward(msg) {
    const exp = msg.exp || 0;
    const gold = Math.round((msg.gold || 0) * this.player.getStats().goldMult);
    if (exp > 0) {
      const lv = this.player.gainExp(exp);
      if (lv > 0) this._onLevelUp();
    }
    if (gold > 0) {
      this.player.gold += gold;
    }
    if (msg.guaranteedDrop) {
      const gid = msg.guaranteedDrop;
      if (gid.startsWith('wp_')) {
        this.player.addWeapon(gid, 2);
        this.progress.discoveredWeapons.add(gid);
      } else {
        this.player.addArmor(gid, 2);
        this.progress.discoveredArmors.add(gid);
      }
    } else if (msg.dropTable && msg.dropTable.length && Math.random() < 0.14) {
      const id = msg.dropTable[Math.floor(Math.random() * msg.dropTable.length)];
      if (id.startsWith('wp_')) {
        this.player.addWeapon(id, 0);
        this.progress.discoveredWeapons.add(id);
      } else {
        this.player.addArmor(id, 0);
        this.progress.discoveredArmors.add(id);
      }
    }
    this.spawnDamageText(this.player.x, this.player.y - 34, `+${exp}EXP +${gold}G`, '#fde047', 0.92);
  }

  _onLevelUp() {
    this.audio.playSe('levelup');
    this.spawnRing(this.player.x, this.player.y, '#fbbf24', 14, 130, 0.5);
    this.spawnBurst(this.player.x, this.player.y, '#fef08a', 26, 220);
    this.spawnDamageText(this.player.x, this.player.y - 40, `LEVEL UP! Lv.${this.player.level}`, '#fef08a', 1.38);
    this.addToast(`🌟 レベルアップ！ Lv.${this.player.level} に到達（HP/MP全回復！）`);
  }

  playRemoteVfx(msg) {
    if (msg.kind === 'slash') {
      this.slashes.push({
        x: msg.x, y: msg.y, angle: msg.angle, radius: msg.radius, arc: msg.arc,
        color: msg.color || '#38bdf8', life: 0.18, maxLife: 0.18,
      });
    } else if (msg.kind === 'limit') {
      this.spawnRing(msg.x, msg.y, msg.color || '#fbbf24', 24, 260, 0.55);
      this.spawnBurst(msg.x, msg.y, msg.color || '#38f8d4', 32, 300);
    }
  }

  applyRemoteWorldEvent(msg) {
    if (msg.kind === 'switch') {
      const sw = this.map.switches.find((s) => s.id === msg.switchId);
      if (sw && !sw.activated) this._activateSwitch(sw, false);
    } else if (msg.kind === 'wall_break') {
      const cw = this.map.crackedWalls.find((c) => c.id === msg.wallId);
      if (cw && !cw.broken) this._shatterCrackedWall(cw, false);
    }
  }

  // ==========================================================================
  // MAIN FRAME UPDATE LOOP
  // ==========================================================================
  update(rawDt, inputVec) {
    const clampedDt = Math.min(0.05, rawDt);

    if (this.mode === 'title') {
      this.renderer.renderTitle(clampedDt);
      return;
    }

    // Always keep network interpolation & packets alive
    this.network.update(clampedDt);

    // Hitstop Freeze (0.05s crisp impact pause!)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= clampedDt;
      this.renderer.renderGame(this, 0);
      return;
    }

    // Slow-Motion Time Scaling
    let dt = clampedDt;
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= clampedDt;
      dt = clampedDt * this.slowMoScale;
      if (this.slowMoTimer <= 0) this.slowMoScale = 1.0;
    }

    // Pause simulation during modal overlays (Shops/Menu/Dialogue)
    if (!this.ui.isModalOpen) {
      this.progress.stats.playTime = (this.progress.stats.playTime || 0) + clampedDt;
      if (this.portalCooldown > 0) this.portalCooldown -= dt;

      // Validate Z-Target Lock-On target still alive and in range
      if (this.lockTarget) {
        const isDead = (this.lockTarget.alive === false) || (this.lockTarget.hp !== undefined && this.lockTarget.hp <= 0);
        const dist = Math.hypot(this.lockTarget.x - this.player.x, this.lockTarget.y - this.player.y);
        if (isDead || dist > 560) {
          this.lockTarget = null;
        }
      }

      // Convert stick/WASD input into Camera-Relative World Move Vector!
      const worldMoveVec = this.inputToWorldMoveVector(inputVec);

      // Update Player & Spirit Orb Drone
      this.player.update(dt, worldMoveVec, this.map, this);

      // Co-op Downed Timeout Check
      if (this.player.downed && this.player.downedTimer <= 0) {
        this._triggerDefeatPenalty();
      }

      // Hold-to-Rescue Downed Co-op Teammate
      this._updateCoopRescue(dt);

      // Floor Hazards, Switches, Moving Traps, Portals
      this._updateMapGimmicks(dt);

      // Check Boss Arena Entry Trigger
      this._checkBossTrigger();

      // Update Enemies & Boss
      for (const e of this.enemies) {
        if (e.alive) e.update(dt, this.map, this.player, this);
      }
      if (this.boss && this.boss.alive) {
        this.boss.update(dt, this.map, this.player, this);
      }

      // Endless Trial Tower Floor Clear Check
      this._checkTowerFloorClear();

      // Projectiles & Loot Drops
      this._updateProjectiles(dt);
      this._updateDrops(dt);
    }

    // Update Visual FX & Camera
    this._updateVfx(dt);
    this._updateCamera(clampedDt);

    // Render World
    this.renderer.renderGame(this, dt);

    // Throttle DOM HUD Updates (~15Hz for zero DOM layout overhead on iPad!)
    this.hudSyncTimer += clampedDt;
    if (this.hudSyncTimer >= 0.066) {
      this.hudSyncTimer = 0;
      this.ui.updateHud();
    }
  }

  _updateCoopRescue(dt) {
    for (const rp of this.network.remotePlayers.values()) {
      if (rp.areaId !== this.currentAreaId || !rp.downed) {
        rp.reviveProgress = 0;
        continue;
      }
      const near = Math.hypot(rp.x - this.player.x, rp.y - this.player.y) < 82;
      if (near && this.interactHolding && !this.player.downed) {
        rp.reviveProgress = Math.min(1, (rp.reviveProgress || 0) + dt / 2.0);
        if (rp.reviveProgress >= 1) {
          rp.reviveProgress = 0;
          rp.downed = false;
          this.network.broadcast({ type: 'revive_done', targetId: rp.id, rescuerName: this.player.name });
          this.audio.playSe('revive');
          this.spawnRing(rp.x, rp.y, '#34d399', 18, 120, 0.45);
          this.addToast(`🤝 ${rp.name} を蘇生（レスキュー）しました！`);
          this.unlockAchievement('coop_hero');
        }
      } else {
        rp.reviveProgress = Math.max(0, (rp.reviveProgress || 0) - dt * 1.5);
      }
    }
  }

  _updateMapGimmicks(dt) {
    const p = this.player;
    const TS = GAME_META.tileSize;

    // 1. Damage Floors (Magma Vents / Shock Tiles — can be jumped over!)
    const ptx = Math.floor(p.x / TS);
    const pty = Math.floor(p.y / TS);
    if (p.zHeight < 4 && getTile(this.map, ptx, pty) === TILE.DAMAGE && p.hazardCooldown <= 0 && !p.downed && p.invulnTimer <= 0) {
      p.hazardCooldown = 0.7;
      const hazDmg = Math.max(8, Math.round(p.getStats().maxHp * 0.07));
      this.damageLocalPlayer(hazDmg, this.currentAreaId === 'magma' ? 'burn' : 'paralyze', p.x, p.y);
    }

    // 2. Step-On Switch Activation
    for (const sw of this.map.switches) {
      if (!sw.activated && Math.hypot(sw.x - p.x, sw.y - p.y) < 30) {
        this._activateSwitch(sw);
      }
    }

    // 3. Moving Plasma Saw Traps
    for (const tr of this.map.traps) {
      tr.phase += dt * (tr.speed / 120);
      const t = (Math.sin(tr.phase) + 1) * 0.5;
      tr.x = tr.x1 + (tr.x2 - tr.x1) * t;
      tr.y = tr.y1 + (tr.y2 - tr.y1) * t;
      if (!p.downed && p.zHeight < 12 && Math.hypot(tr.x - p.x, tr.y - p.y) < tr.radius + p.radius - 2) {
        this.damageLocalPlayer(tr.dmg, null, tr.x, tr.y);
      }
    }

    // 4. Auto-Enter Portal when stepping right on its center
    if (this.portalCooldown <= 0 && !p.downed) {
      for (const pt of this.map.portals) {
        if (Math.hypot(pt.x - p.x, pt.y - p.y) < 26) {
          this._tryEnterPortal(pt);
          break;
        }
      }
    }
  }

  _checkBossTrigger() {
    const ba = this.map.bossArena;
    if (!ba || ba.triggered) return;
    if (this.currentAreaId !== 'tower' && this.progress.defeatedBosses.has(ba.bossId)) return;

    const p = this.player;
    const r = ba.triggerRect;
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      ba.triggered = true;
      ba.active = true;
      setBossGateState(this.map, true);

      const ngScale = 1 + ((this.progress.ngPlus || 1) - 1) * 0.6;
      const scale = (ba.towerScale || 1.0) * ngScale;
      const boss = new Boss(ba.bossId, ba.center.x, ba.center.y, scale);

      const bgmTrack = boss.def.isFinalBoss || boss.def.isSecretBoss ? 'finalboss' : 'boss';
      this.audio.playBgm(bgmTrack);

      this.ui.showBossWarning(boss.name, () => {
        this.boss = boss;
        this.lockTarget = boss;
        if (boss.def.introDialogue && boss.def.introDialogue.length) {
          this.ui.openDialogue(boss.name, '⚠️', boss.def.introDialogue);
        }
      });
    }
  }

  _checkTowerFloorClear() {
    if (this.currentAreaId !== 'tower' || this.towerFloorCleared) return;
    const anyEnemy = this.enemies.some((e) => e.alive);
    const bossPending = this.map.bossArena && (!this.map.bossArena.triggered || (this.boss && this.boss.alive));
    if (!anyEnemy && !bossPending) {
      this.towerFloorCleared = true;
      this.towerScore += 250 * this.towerFloor;
      if (this.towerFloor > this.progress.bestTowerFloor) {
        this.progress.bestTowerFloor = this.towerFloor;
      }
      if (this.towerScore > this.progress.bestTowerScore) {
        this.progress.bestTowerScore = this.towerScore;
      }
      if (this.towerFloor >= 5) this.unlockAchievement('tower_5');

      const cx = this.map.pixelWidth * 0.5;
      const cy = this.map.pixelHeight * 0.36;
      this.map.portals.push({
        id: `pt_tower_next_${this.towerFloor}`,
        x: cx,
        y: cy,
        targetArea: 'tower_next',
        label: `第${this.towerFloor + 1}階層へ進む ▶`,
        color: '#fbbf24',
      });
      this.map.chests.push({
        id: `ch_tower_${this.towerFloor}_${Date.now()}`,
        x: cx,
        y: cy + 88,
        opened: false,
        rarity: this.towerFloor % 5 === 0 ? 'legendary' : 'epic',
        reward: {
          gold: 200 + this.towerFloor * 90,
          ore: { type: this.towerFloor >= 5 ? 'void' : 'prism', count: 2 },
          core: this.towerFloor % 3 === 0 ? 'power' : null,
        },
      });
      this.audio.playSe('levelup');
      this.addToast(`✨ 第${this.towerFloor}階層クリア！次の階層ゲートが出現しました！`);
      this.autoSave();
    }
  }

  _updateProjectiles(dt) {
    const TS = GAME_META.tileSize;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.homing && pr.owner === 'player') {
        const targets = this._findNearestHostiles(pr.x, pr.y, 260, 1);
        if (targets.length) {
          const t = targets[0];
          const desired = Math.atan2(t.y - pr.y, t.x - pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          let diff = desired - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const nextAng = cur + Math.max(-7 * dt, Math.min(7 * dt, diff));
          pr.vx = Math.cos(nextAng) * pr.speed;
          pr.vy = Math.sin(nextAng) * pr.speed;
        }
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      const tx = Math.floor(pr.x / TS);
      const ty = Math.floor(pr.y / TS);
      const tile = getTile(this.map, tx, ty);
      if (isProjectileBlockingTile(tile)) {
        if (pr.owner === 'player' && tile === TILE.CRACKED) {
          this._checkCrackedWallHits(pr.x, pr.y, 26);
        }
        this.spawnBurst(pr.x, pr.y, pr.color, 6, 110);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.owner === 'player') {
        let consumed = false;
        const st = this.player.getStats();

        for (const e of this.enemies) {
          if (!e.alive || pr.hitIds.has(e.uid)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.radius + pr.radius) {
            pr.hitIds.add(e.uid);
            const isCrit = Math.random() < st.crit;
            const ang = Math.atan2(pr.vy, pr.vx);
            e.takeDamage(pr.damage, pr.element, isCrit, Math.cos(ang), Math.sin(ang), this);
            if (pr.statusOnHit) e.applyStatus(pr.statusOnHit, 4.5);
            if (!pr.fromDrone) this._onPlayerHitLanded(isCrit);

            if (pr.explosive) {
              this.spawnRing(pr.x, pr.y, '#fb923c', 12, 86, 0.28);
              this._damageEnemiesInRadius(pr.x, pr.y, 82, Math.round(pr.damage * 0.55), pr.element, pr.statusOnHit, 0);
            }
            if (!pr.piercing) { consumed = true; break; }
          }
        }

        if (!consumed && this.boss && this.boss.alive) {
          for (const c of this.boss.crystals) {
            if (c.hp <= 0 || pr.hitIds.has(c.id)) continue;
            if (Math.hypot(c.x - pr.x, c.y - pr.y) < c.radius + pr.radius) {
              pr.hitIds.add(c.id);
              this.boss.damageCrystal(c, pr.damage, this);
              if (!pr.piercing) { consumed = true; break; }
            }
          }
          if (!consumed && !pr.hitIds.has(this.boss.id) && Math.hypot(this.boss.x - pr.x, this.boss.y - pr.y) < this.boss.radius + pr.radius) {
            pr.hitIds.add(this.boss.id);
            const isCrit = Math.random() < st.crit;
            const res = this.boss.takeDamage(pr.damage, pr.element, isCrit, this);
            if (res.dmg > 0) {
              if (pr.statusOnHit) this.boss.applyStatus(pr.statusOnHit, 3.5);
              if (!pr.fromDrone) this._onPlayerHitLanded(isCrit);
              this.network.broadcast({ type: 'boss_hit', areaId: this.currentAreaId, dmg: res.dmg, element: pr.element, isCrit });
            }
            if (!pr.piercing) consumed = true;
          }
        }

        if (consumed) this.projectiles.splice(i, 1);
      } else {
        // Enemy Projectile hitting local player (or Perfect Parried back at the enemy!)
        if (!this.player.downed && Math.hypot(this.player.x - pr.x, this.player.y - pr.y) < this.player.radius + pr.radius) {
          if (this.player.parryWindow > 0) {
            // Reflect projectile back at high speed with 3x damage (Zelda Guardian beam parry!)
            this.player.parryWindow = 0;
            this.player.parryFlashTimer = 0.45;
            pr.owner = 'player';
            pr.vx = -pr.vx * 2.1;
            pr.vy = -pr.vy * 2.1;
            pr.speed *= 2.1;
            pr.damage = Math.max(45, pr.damage * 3);
            pr.color = '#fbbf24';
            pr.homing = true;
            pr.life = 1.5;
            this.triggerHitstop(0.06);
            this.addShake(10);
            this.audio.playSe('forge');
            this.spawnRing(this.player.x, this.player.y, '#fbbf24', 16, 110, 0.35);
            this.spawnDamageText(this.player.x, this.player.y - 36, '🛡 BEAM PARRY!!', '#fde047', 1.38);
            this.addToast('🛡 ジャストガード成功！敵の魔弾を跳ね返した！');
            continue;
          }
          this.damageLocalPlayer(pr.damage, pr.statusOnHit, pr.x, pr.y);
          this.spawnBurst(pr.x, pr.y, pr.color, 6, 120);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  _updateDrops(dt) {
    const p = this.player;
    const st = p.getStats();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      if (d.life <= 0 || d.collected) {
        this.drops.splice(i, 1);
        continue;
      }
      if (Math.hypot(p.x - d.x, p.y - d.y) < 30) {
        d.collected = true;
        if (d.type === 'gold') {
          p.gold += d.amount;
          this.audio.playSe('coin');
          this.spawnDamageText(p.x, p.y - 24, `+${d.amount}G`, '#fbbf24', 0.88);
        } else if (d.type === 'hp_orb') {
          const heal = Math.round(st.maxHp * 0.22);
          p.hp = Math.min(st.maxHp, p.hp + heal);
          this.audio.playSe('coin');
          this.spawnDamageText(p.x, p.y - 24, `+${heal}HP`, '#34d399', 0.92);
        } else if (d.type === 'mp_orb') {
          const mp = Math.round(st.maxMp * 0.25);
          p.mp = Math.min(st.maxMp, p.mp + mp);
          this.audio.playSe('coin');
          this.spawnDamageText(p.x, p.y - 24, `+${mp}MP`, '#7dd3fc', 0.92);
        } else if (d.type === 'ore') {
          p.ores[d.oreType] = (p.ores[d.oreType] || 0) + (d.amount || 1);
          this.audio.playSe('coin');
          this.addToast(`⛏ ${ORES[d.oreType].name} を獲得！`);
        } else if (d.type === 'core') {
          p.cores[d.coreId] = (p.cores[d.coreId] || 0) + 1;
          this.audio.playSe('levelup');
          this.addToast(`💎 ${CORES[d.coreId].name} を吸収！永久ステータスUP！`);
        } else if (d.type === 'weapon') {
          const w = getWeaponById(d.itemId);
          const res = p.addWeapon(w.id, d.plus || 0);
          this.progress.discoveredWeapons.add(w.id);
          this.audio.playSe('chest');
          if (res.added) {
            this.addToast(`⚔ レアドロップ！ ${w.name}${d.plus ? `+${d.plus}` : ''} を入手！`);
          } else {
            const bonusG = Math.round(w.price * 0.35);
            p.gold += bonusG;
            this.addToast(`⚔ ${w.name} 重複変換 → +${bonusG}G！`);
          }
        } else if (d.type === 'armor') {
          const a = getArmorById(d.itemId);
          const res = p.addArmor(a.id, d.plus || 0);
          this.progress.discoveredArmors.add(a.id);
          this.audio.playSe('chest');
          if (res.added) {
            this.addToast(`🛡 レアドロップ！ ${a.name}${d.plus ? `+${d.plus}` : ''} を入手！`);
          } else {
            const bonusG = Math.round(a.price * 0.35);
            p.gold += bonusG;
            this.addToast(`🛡 ${a.name} 重複変換 → +${bonusG}G！`);
          }
        }
        this.drops.splice(i, 1);
      }
    }
  }

  _updateVfx(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.08, dt);
      pt.vy *= Math.pow(0.08, dt);
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].alpha -= dt * 3.8;
      if (this.afterimages[i].alpha <= 0) this.afterimages.splice(i, 1);
    }
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const t = this.damageTexts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.18, dt);
      if (t.life <= 0) this.damageTexts.splice(i, 1);
    }
    if (this.screenFlash > 0) {
      this.screenFlash = Math.max(0, this.screenFlash - dt * 1.45);
    }
  }

  _updateCamera(dt) {
    const smooth = Math.min(1, dt * 10);
    this.camera.x += (this.player.x - this.camera.x) * smooth;
    this.camera.y += (this.player.y - this.camera.y) * smooth;

    // When Z-Targeting (locked onto enemy/boss), smoothly steer camera yaw to frame both player and target!
    if (this.lockTarget && (this.lockTarget.alive || this.lockTarget.hp > 0)) {
      const desiredYaw = Math.atan2(this.lockTarget.y - this.player.y, this.lockTarget.x - this.player.x);
      let diff = desiredYaw - this.camera.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camera.yaw += diff * Math.min(1, dt * 7.5);
    }

    if (this.shakePower > 0.2) {
      this.shakeOffset.x = (Math.random() - 0.5) * 2 * this.shakePower;
      this.shakeOffset.y = (Math.random() - 0.5) * 2 * this.shakePower;
      this.shakePower *= Math.pow(0.0012, dt);
    } else {
      this.shakePower = 0;
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }
  }
}
