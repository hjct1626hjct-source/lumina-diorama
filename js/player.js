// ============================================================================
// LUMINA DIORAMA — Player Controller, Combat Stats, Gear, Spells & Support Drone
// 製作者：駿 (Created by Shun)
// ============================================================================

import {
  JOBS,
  SPELLS,
  CORES,
  calcWeaponStats,
  calcArmorStats,
  getSpellById,
} from './data.js';
import { resolveMapCollision } from './map.js';

export class Player {
  constructor(name = 'シュン', jobId = 'knight') {
    this.name = name || 'シュン';
    this.jobId = JOBS[jobId] ? jobId : 'knight';
    const job = JOBS[this.jobId];

    this.x = 400;
    this.y = 400;
    this.vx = 0;
    this.vy = 0;
    this.radius = 16;
    this.facing = 0; // radians

    this.level = 1;
    this.exp = 0;
    this.nextExp = 65;
    this.gold = 100;

    // Equipment & Inventory
    this.weapons = [{ id: job.starterWeapon, plus: 0 }];
    this.armors = [{ id: job.starterArmor, plus: 0 }];
    this.equippedWeapon = job.starterWeapon;
    this.equippedArmor = job.starterArmor;

    // Learned Spells { spellId: level (1..5) }
    this.spells = {};
    for (const spId of job.starterSpells) {
      this.spells[spId] = 1;
    }
    this.activeSpell = job.starterSpells[0] || 'fire';

    // Materials & Permanent Stat Cores
    this.ores = { stardust: 2, prism: 0, void: 0 };
    this.cores = { vital: 0, ether: 0, power: 0, crit: 0 };
    this.droneLevel = 1;

    // Hit Combo Counter & Status Effects (initialized before getStats)
    this.hitCombo = 0;
    this.hitComboTimer = 0;
    this.statuses = {
      burn: 0,
      poison: 0,
      freeze: 0,
      paralyze: 0,
      overclock: 0,
      shrineAtk: 0,
      shrineCurse: 0,
    };
    this.dotTickTimer = 0;
    this.hazardCooldown = 0;

    // Live Vitals
    const st = this.getStats();
    this.hp = st.maxHp;
    this.mp = st.maxMp;
    this.limit = 0; // 0..100

    // Combat & Movement Timers
    this.attackCooldown = 0;
    this.comboStep = 0;
    this.comboResetTimer = 0;

    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashMaxCooldown = 0.82;
    this.dashDirX = 1;
    this.dashDirY = 0;
    this.invulnTimer = 0;

    this.spellCooldown = 0;
    this.hitFlash = 0;
    this.stepTimer = 0;
    this.walkPhase = 0;

    // Co-op Downed / Rescue State
    this.downed = false;
    this.downedTimer = 30;
    this.reviveProgress = 0;

    // Overhead Chat Speech Bubble
    this.chatBubble = null; // { text, timer }

    // Autonomous Support Drone
    this.drone = {
      x: this.x - 30,
      y: this.y - 24,
      angle: 0,
      bobPhase: 0,
      fireCooldown: 0,
      beamTarget: null, // { x, y, timer }
    };
  }

  getJob() {
    return JOBS[this.jobId] || JOBS.knight;
  }

  getEquippedWeaponItem() {
    return this.weapons.find((w) => w.id === this.equippedWeapon) || this.weapons[0];
  }

  getEquippedArmorItem() {
    return this.armors.find((a) => a.id === this.equippedArmor) || this.armors[0];
  }

  getWeaponData() {
    const item = this.getEquippedWeaponItem();
    return calcWeaponStats(item.id, item.plus || 0);
  }

  getArmorData() {
    const item = this.getEquippedArmorItem();
    return calcArmorStats(item.id, item.plus || 0);
  }

  getComboBonus() {
    const atkMult = 1 + Math.min(0.5, Math.floor(this.hitCombo / 2) * 0.01);
    const dropBonus = Math.min(1.0, this.hitCombo * 0.02);
    return { atkMult, dropBonus };
  }

  getStats() {
    const job = this.getJob();
    const lv = this.level - 1;
    const wp = this.getWeaponData();
    const ar = this.getArmorData();

    const coreHp = (this.cores.vital || 0) * CORES.vital.bonus;
    const coreMp = (this.cores.ether || 0) * CORES.ether.bonus;
    const coreAtk = (this.cores.power || 0) * CORES.power.bonus;
    const coreCrit = (this.cores.crit || 0) * CORES.crit.bonus;

    let maxHp = Math.round(job.baseStats.maxHp + lv * job.growth.maxHp + ar.maxHp + coreHp);
    let maxMp = Math.round(job.baseStats.maxMp + lv * job.growth.maxMp + ar.maxMp + coreMp);
    let atk = Math.round(job.baseStats.atk + lv * job.growth.atk + wp.atk + coreAtk);
    let mag = Math.round(job.baseStats.mag + lv * job.growth.mag + wp.mag + coreAtk);
    let def = Math.round(job.baseStats.def + lv * job.growth.def + ar.def);
    let spd = Math.round(job.baseStats.spd + ar.spd);
    let crit = Math.min(0.85, job.baseStats.crit + lv * job.growth.crit + wp.crit + coreCrit);

    // Buff & Debuff Modifiers
    if (this.statuses.overclock > 0) {
      atk = Math.round(atk * 1.35);
      mag = Math.round(mag * 1.35);
      spd = Math.round(spd * 1.25);
    }
    if (this.statuses.shrineAtk > 0) {
      atk = Math.round(atk * 1.85);
      mag = Math.round(mag * 1.85);
    }
    if (this.statuses.freeze > 0) spd = Math.round(spd * 0.58);
    if (this.statuses.shrineCurse > 0) spd = Math.round(spd * 0.82);

    const { atkMult } = this.getComboBonus();
    atk = Math.round(atk * atkMult);
    mag = Math.round(mag * atkMult);

    return {
      maxHp,
      maxMp,
      atk,
      mag,
      def,
      spd,
      crit,
      goldMult: job.baseStats.goldMult,
      element: wp.element,
      weaponPlus: wp.plus,
      weaponColor: wp.color,
    };
  }

  getDroneStats() {
    const lv = this.droneLevel;
    return {
      level: lv,
      damage: Math.round(9 + lv * 8 + this.level * 1.8),
      cooldown: Math.max(0.32, 0.95 - lv * 0.13),
      range: 215 + lv * 28,
      magnetRadius: 115 + lv * 36,
      twinBeam: lv >= 4,
    };
  }

  addWeapon(weaponId, plus = 0) {
    const existing = this.weapons.find((w) => w.id === weaponId);
    if (existing) {
      if (plus > existing.plus) existing.plus = plus;
      return { added: false, upgraded: plus > existing.plus, item: existing };
    }
    const item = { id: weaponId, plus };
    this.weapons.push(item);
    return { added: true, upgraded: false, item };
  }

  addArmor(armorId, plus = 0) {
    const existing = this.armors.find((a) => a.id === armorId);
    if (existing) {
      if (plus > existing.plus) existing.plus = plus;
      return { added: false, upgraded: plus > existing.plus, item: existing };
    }
    const item = { id: armorId, plus };
    this.armors.push(item);
    return { added: true, upgraded: false, item };
  }

  gainExp(amount) {
    let leveledUp = 0;
    this.exp += Math.max(1, Math.round(amount));
    while (this.exp >= this.nextExp) {
      this.exp -= this.nextExp;
      this.level += 1;
      this.nextExp = Math.round(65 * Math.pow(1.26, this.level - 1));
      const st = this.getStats();
      this.hp = st.maxHp;
      this.mp = st.maxMp;
      leveledUp += 1;
    }
    return leveledUp;
  }

  registerComboHit(amount = 1) {
    this.hitCombo += amount;
    this.hitComboTimer = 3.8;
    return this.hitCombo;
  }

  addLimit(amount) {
    this.limit = Math.min(100, this.limit + amount);
  }

  cycleSpell() {
    const learned = SPELLS.map((s) => s.id).filter((id) => this.spells[id] > 0);
    if (!learned.length) return null;
    const idx = learned.indexOf(this.activeSpell);
    this.activeSpell = learned[(idx + 1) % learned.length];
    return getSpellById(this.activeSpell);
  }

  selectSpellByIndex(slotIdx) {
    const sp = SPELLS[slotIdx];
    if (!sp || !this.spells[sp.id]) return null;
    this.activeSpell = sp.id;
    return sp;
  }

  fullRestore() {
    const st = this.getStats();
    this.hp = st.maxHp;
    this.mp = st.maxMp;
    this.downed = false;
    this.downedTimer = 30;
    this.reviveProgress = 0;
    this.statuses.burn = 0;
    this.statuses.poison = 0;
    this.statuses.freeze = 0;
    this.statuses.paralyze = 0;
    this.statuses.shrineCurse = 0;
  }

  setChatBubble(text) {
    this.chatBubble = { text, timer: 4.5 };
  }

  update(dt, inputVec, map, game) {
    const st = this.getStats();
    this.hp = Math.min(this.hp, st.maxHp);
    this.mp = Math.min(this.mp, st.maxMp);

    // Passive MP Regeneration
    if (!this.downed) {
      const mpRegen = (3.4 + (this.jobId === 'mage' ? 3.2 : 0) + this.level * 0.25) * dt;
      this.mp = Math.min(st.maxMp, this.mp + mpRegen);
    }

    // Cooldowns & Visual Timers
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 0;
    }
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.spellCooldown > 0) this.spellCooldown -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.hazardCooldown > 0) this.hazardCooldown -= dt;
    if (this.chatBubble) {
      this.chatBubble.timer -= dt;
      if (this.chatBubble.timer <= 0) this.chatBubble = null;
    }

    if (this.hitCombo > 0) {
      this.hitComboTimer -= dt;
      if (this.hitComboTimer <= 0) this.hitCombo = 0;
    }

    // Status Effect Timers & DoT Ticks
    for (const key of Object.keys(this.statuses)) {
      if (this.statuses[key] > 0) {
        this.statuses[key] = Math.max(0, this.statuses[key] - dt);
      }
    }
    if (!this.downed && (this.statuses.burn > 0 || this.statuses.poison > 0 || this.statuses.shrineCurse > 0)) {
      this.dotTickTimer += dt;
      if (this.dotTickTimer >= 1.0) {
        this.dotTickTimer = 0;
        let dot = 0;
        if (this.statuses.burn > 0) dot += Math.max(3, Math.round(st.maxHp * 0.025));
        if (this.statuses.poison > 0) dot += Math.max(2, Math.round(st.maxHp * 0.02));
        if (this.statuses.shrineCurse > 0) dot += Math.max(1, Math.round(st.maxHp * 0.01));
        if (dot > 0) {
          this.hp = Math.max(1, this.hp - dot);
          game.spawnDamageText(this.x, this.y - 24, `-${dot}`, '#c084fc');
        }
      }
    } else {
      this.dotTickTimer = 0;
    }

    // Downed State (Co-op Rescue Countdown)
    if (this.downed) {
      this.vx = 0;
      this.vy = 0;
      this.downedTimer -= dt;
      this._updateDrone(dt, game, false);
      return;
    }

    // Movement / Dash
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      const dashSpeed = st.spd * 2.85;
      this.vx = this.dashDirX * dashSpeed;
      this.vy = this.dashDirY * dashSpeed;
      game.spawnAfterimage(this.x, this.y, this.facing, this.getJob().color, this.jobId);
    } else if (this.statuses.paralyze > 0) {
      this.vx *= 0.7;
      this.vy *= 0.7;
    } else {
      const mag = Math.hypot(inputVec.x, inputVec.y);
      if (mag > 0.08) {
        const nx = inputVec.x / Math.max(1, mag);
        const ny = inputVec.y / Math.max(1, mag);
        const factor = Math.min(1, mag);
        this.vx = nx * st.spd * factor;
        this.vy = ny * st.spd * factor;
        this.facing = Math.atan2(ny, nx);
        this.walkPhase += dt * 11 * factor;
        this.stepTimer += dt;
        if (this.stepTimer >= 0.34) {
          this.stepTimer = 0;
          game.audio.playSe('step');
        }
      } else {
        this.vx = 0;
        this.vy = 0;
      }
    }

    // Resolve Map Collisions
    const nextPos = resolveMapCollision(map, this.x + this.vx * dt, this.y + this.vy * dt, this.radius);
    this.x = nextPos.x;
    this.y = nextPos.y;

    // Update Autonomous Support Drone
    this._updateDrone(dt, game, true);
  }

  _updateDrone(dt, game, canAttack) {
    const d = this.drone;
    d.bobPhase += dt * 4.2;
    const behindX = this.x - Math.cos(this.facing) * 34 + Math.cos(d.bobPhase * 0.5) * 6;
    const behindY = this.y - Math.sin(this.facing) * 34 - 12 + Math.sin(d.bobPhase) * 6;

    const lerp = Math.min(1, dt * 6.5);
    d.x += (behindX - d.x) * lerp;
    d.y += (behindY - d.y) * lerp;
    d.angle += dt * 2.4;

    if (d.beamTarget) {
      d.beamTarget.timer -= dt;
      if (d.beamTarget.timer <= 0) d.beamTarget = null;
    }

    const ds = this.getDroneStats();

    // Auto-Attract nearby drops
    for (const drop of game.drops) {
      if (drop.collected) continue;
      const dist = Math.hypot(this.x - drop.x, this.y - drop.y);
      if (dist < ds.magnetRadius) {
        const pull = 360 * dt;
        const ang = Math.atan2(this.y - drop.y, this.x - drop.x);
        drop.x += Math.cos(ang) * pull;
        drop.y += Math.sin(ang) * pull;
      }
    }

    if (!canAttack || game.map.meta.safe) return;

    if (d.fireCooldown > 0) {
      d.fireCooldown -= dt;
      return;
    }

    // Find closest valid target (Guardian Crystals first, then Enemies, then Boss)
    let bestTarget = null;
    let bestDist = ds.range;

    if (game.boss && game.boss.alive) {
      for (const c of game.boss.crystals) {
        if (c.hp <= 0) continue;
        const dist = Math.hypot(c.x - d.x, c.y - d.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestTarget = { type: 'crystal', ref: c };
        }
      }
      if (!bestTarget && !game.boss.isShielded()) {
        const dist = Math.hypot(game.boss.x - d.x, game.boss.y - d.y);
        if (dist < bestDist + 40) {
          bestDist = dist;
          bestTarget = { type: 'boss', ref: game.boss };
        }
      }
    }

    if (!bestTarget) {
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const dist = Math.hypot(e.x - d.x, e.y - d.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestTarget = { type: 'enemy', ref: e };
        }
      }
    }

    if (bestTarget) {
      d.fireCooldown = ds.cooldown;
      const t = bestTarget.ref;
      d.beamTarget = { x: t.x, y: t.y, timer: 0.14 };
      const shots = ds.twinBeam ? 2 : 1;
      for (let s = 0; s < shots; s++) {
        game.spawnProjectile({
          owner: 'player',
          x: d.x + (s === 0 ? -4 : 4),
          y: d.y,
          angle: Math.atan2(t.y - d.y, t.x - d.x),
          speed: 560,
          radius: 5,
          damage: ds.damage,
          element: 'lightning',
          color: '#38f8d4',
          life: 0.65,
          homing: true,
          fromDrone: true,
        });
      }
    }
  }

  tryDash(inputVec, game) {
    if (this.downed || this.dashCooldown > 0 || this.statuses.paralyze > 0) return false;
    const mag = Math.hypot(inputVec.x, inputVec.y);
    if (mag > 0.1) {
      this.dashDirX = inputVec.x / mag;
      this.dashDirY = inputVec.y / mag;
      this.facing = Math.atan2(this.dashDirY, this.dashDirX);
    } else {
      this.dashDirX = Math.cos(this.facing);
      this.dashDirY = Math.sin(this.facing);
    }
    this.dashTimer = 0.21;
    this.invulnTimer = 0.34;
    this.dashCooldown = this.dashMaxCooldown;
    game.audio.playSe('dash');
    game.spawnBurst(this.x, this.y, this.getJob().accent, 10, 140);
    return true;
  }

  loadFromSave(savedPlayer) {
    this.name = savedPlayer.name || 'シュン';
    this.jobId = JOBS[savedPlayer.jobId] ? savedPlayer.jobId : 'knight';
    this.level = savedPlayer.level || 1;
    this.exp = savedPlayer.exp || 0;
    this.nextExp = savedPlayer.nextExp || Math.round(65 * Math.pow(1.26, this.level - 1));
    this.gold = savedPlayer.gold ?? 100;
    this.weapons = Array.isArray(savedPlayer.weapons) && savedPlayer.weapons.length
      ? savedPlayer.weapons.map((w) => ({ id: w.id, plus: w.plus || 0 }))
      : [{ id: this.getJob().starterWeapon, plus: 0 }];
    this.armors = Array.isArray(savedPlayer.armors) && savedPlayer.armors.length
      ? savedPlayer.armors.map((a) => ({ id: a.id, plus: a.plus || 0 }))
      : [{ id: this.getJob().starterArmor, plus: 0 }];
    this.equippedWeapon = savedPlayer.equippedWeapon || this.weapons[0].id;
    this.equippedArmor = savedPlayer.equippedArmor || this.armors[0].id;
    this.spells = savedPlayer.spells && Object.keys(savedPlayer.spells).length
      ? { ...savedPlayer.spells }
      : { [this.getJob().starterSpells[0]]: 1 };
    this.activeSpell = savedPlayer.activeSpell || Object.keys(this.spells)[0];
    this.ores = { stardust: 0, prism: 0, void: 0, ...(savedPlayer.ores || {}) };
    this.cores = { vital: 0, ether: 0, power: 0, crit: 0, ...(savedPlayer.cores || {}) };
    this.droneLevel = Math.max(1, Math.min(5, savedPlayer.droneLevel || 1));

    const st = this.getStats();
    this.hp = Math.min(st.maxHp, Math.max(1, savedPlayer.hp || st.maxHp));
    this.mp = Math.min(st.maxMp, Math.max(0, savedPlayer.mp ?? st.maxMp));
    this.limit = Math.min(100, Math.max(0, savedPlayer.limit || 0));
    this.downed = false;
  }
}
