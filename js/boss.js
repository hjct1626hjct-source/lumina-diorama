// ============================================================================
// LUMINA DIORAMA — Epic Boss Battles, Guardian Crystal Shields & Telegraphs
// Phase 1 -> Phase 2 Awakening (<=50% HP) with Red Danger Circles & Lasers
// 製作者：駿 (Created by Shun)
// ============================================================================

import { getBossById } from './data.js';
import { resolveMapCollision } from './map.js';

export class Boss {
  constructor(bossId, centerX, centerY, scaleMult = 1.0) {
    const def = getBossById(bossId);
    this.id = def.id;
    this.def = def;
    this.name = def.name;
    this.title = def.title;

    this.x = centerX;
    this.y = centerY;
    this.arenaX = centerX;
    this.arenaY = centerY;
    this.radius = def.radius;
    this.facing = Math.PI;

    this.maxHp = Math.round(def.hp * scaleMult);
    this.hp = this.maxHp;
    this.atk = Math.round(def.atk * Math.sqrt(scaleMult));
    this.defStat = Math.round(def.def * Math.sqrt(scaleMult));
    this.spd = def.spd;
    this.exp = Math.round(def.exp * scaleMult);
    this.gold = Math.round(def.gold * scaleMult);

    this.alive = true;
    this.phase = 1;
    this.phase2Triggered = false;
    this.animPhase = 0;
    this.hitFlash = 0;
    this.stunTimer = 0;
    this.contactCooldown = 0;

    // Attack Pattern State Machine
    this.attackTimer = 1.6;
    this.patternIndex = 0;
    this.dashTimer = 0;
    this.dashVec = { x: 0, y: 0 };

    // Status Effects
    this.statuses = { burn: 0, freeze: 0, paralyze: 0, poison: 0 };
    this.dotTimer = 0;

    // Guardian Crystals (Boss is shielded until all are destroyed!)
    this.crystals = [];
    this.spawnCrystals(def.crystalCount || 2, scaleMult);

    // Active Ground Danger Telegraphs (circles & beams)
    this.telegraphs = [];
  }

  spawnCrystals(count, scaleMult = 1.0) {
    this.crystals = [];
    const dist = 165;
    const baseHp = Math.round((65 + this.maxHp * 0.055) * Math.sqrt(scaleMult));
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.PI / 4;
      this.crystals.push({
        id: `cry_${i}_${Date.now()}`,
        x: this.arenaX + Math.cos(ang) * dist,
        y: this.arenaY + Math.sin(ang) * dist,
        orbitAngle: ang,
        orbitDist: dist,
        radius: 19,
        maxHp: baseHp,
        hp: baseHp,
        hitFlash: 0,
        color: this.def.accent,
      });
    }
  }

  isShielded() {
    return this.crystals.some((c) => c.hp > 0);
  }

  damageCrystal(crystal, rawDmg, game) {
    if (crystal.hp <= 0) return false;
    const dmg = Math.max(8, Math.round(rawDmg));
    crystal.hp = Math.max(0, crystal.hp - dmg);
    crystal.hitFlash = 0.14;
    game.spawnDamageText(crystal.x, crystal.y - 24, `${dmg}`, '#67e8f9', 1.05);
    game.spawnBurst(crystal.x, crystal.y, '#67e8f9', 8, 160);
    game.audio.playSe('hit');

    if (crystal.hp <= 0) {
      game.spawnBurst(crystal.x, crystal.y, '#ffffff', 22, 260);
      game.addShake(8);
      game.audio.playSe('crack');
      if (!this.isShielded()) {
        this.stunTimer = 1.65;
        game.spawnDamageText(this.x, this.y - this.radius - 26, 'SHIELD BREAK!!', '#fde047', 1.45);
        game.spawnBurst(this.x, this.y, '#38f8d4', 32, 300);
        game.addToast('✨ 守護クリスタル全破壊！ボスの無敵シールドが崩壊した！');
        game.audio.playSe('crit');
      }
      return true;
    }
    return false;
  }

  applyStatus(statusName, duration = 3.5) {
    if (!statusName || !(statusName in this.statuses)) return;
    if (this.isShielded()) return;
    this.statuses[statusName] = Math.max(this.statuses[statusName], statusName === 'paralyze' ? 1.1 : duration);
  }

  applyParryBreak(duration = 2.4) {
    this.stunTimer = Math.max(this.stunTimer, duration);
    this.dashTimer = 0;
  }

  takeDamage(rawDamage, element, isCrit, game) {
    if (!this.alive) return { dmg: 0, killed: false, shielded: false };
    if (this.isShielded()) {
      game.spawnDamageText(this.x, this.y - this.radius - 14, 'SHIELDED!', '#7dd3fc', 1.05);
      game.spawnBurst(this.x, this.y, '#38bdf8', 5, 110);
      return { dmg: 0, killed: false, shielded: true };
    }

    const weak = element && element !== 'none' && element === this.def.weakness;
    const isBroken = this.stunTimer > 0;
    let dmg = Math.max(4, rawDamage - this.defStat * 0.4);
    if (isBroken) dmg *= 1.5; // Bonus 1.5x punish damage during shield break / parry break!
    if (weak) dmg *= 1.5;
    if (isCrit) dmg *= 1.65;
    dmg = Math.max(2, Math.round(dmg * (0.94 + Math.random() * 0.12)));

    this.hp = Math.max(0, this.hp - dmg);
    this.hitFlash = 0.14;

    const color = isCrit ? '#fbbf24' : isBroken ? '#fde047' : weak ? '#38bdf8' : '#ffffff';
    const text = isCrit ? `${dmg} CRIT!` : isBroken ? `${dmg} BREAK!` : weak ? `${dmg} WEAK!` : `${dmg}`;
    game.spawnDamageText(this.x + (Math.random() - 0.5) * 28, this.y - this.radius - 14, text, color, isCrit || weak || isBroken ? 1.32 : 1.05);
    game.spawnBurst(this.x, this.y, weak ? '#38bdf8' : this.def.color, isCrit ? 16 : 8, 220);

    // Phase 2 Awakening Check (<= 50% HP! Prevents accidental one-shot phase skip)
    if (!this.phase2Triggered && this.hp <= this.maxHp * 0.5) {
      if (this.hp <= 0) this.hp = Math.max(1, Math.floor(this.maxHp * 0.45));
      this.enterPhase2(game);
    }

    if (this.hp <= 0) {
      this.alive = false;
      this.telegraphs = [];
      game.onBossDefeated(this);
      return { dmg, killed: true, shielded: false };
    }
    return { dmg, killed: false, shielded: false };
  }

  enterPhase2(game) {
    this.phase2Triggered = true;
    this.phase = 2;
    this.telegraphs = [];
    this.attackTimer = 1.25;

    // Dramatic Awakening Feedback!
    game.triggerHitstop(0.06);
    game.addShake(15);
    game.audio.playSe('warning');
    game.spawnBurst(this.x, this.y, '#ff2e54', 44, 340);
    game.spawnDamageText(this.x, this.y - this.radius - 30, '⚡ PHASE 2 覚醒!! ⚡', '#fb7185', 1.55);
    game.addToast(this.def.phase2Line || `${this.name} が第2形態に覚醒した！`);

    // Respawn fresh protective crystals on major bosses!
    const respawnCount = Math.max(2, Math.min(4, this.def.crystalCount || 2));
    this.spawnCrystals(respawnCount, 0.85);
  }

  update(dt, map, targetPlayer, game) {
    if (!this.alive) return;
    this.animPhase += dt * (this.phase === 2 ? 5.8 : 3.6);
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.contactCooldown > 0) this.contactCooldown -= dt;

    // Slowly orbit Guardian Crystals around arena
    for (const c of this.crystals) {
      if (c.hitFlash > 0) c.hitFlash -= dt;
      if (c.hp <= 0) continue;
      c.orbitAngle += dt * (this.phase === 2 ? 0.58 : 0.36);
      c.x = this.arenaX + Math.cos(c.orbitAngle) * c.orbitDist;
      c.y = this.arenaY + Math.sin(c.orbitAngle) * c.orbitDist;
    }

    // Update Status Effects
    for (const k of Object.keys(this.statuses)) {
      if (this.statuses[k] > 0) this.statuses[k] = Math.max(0, this.statuses[k] - dt);
    }
    if (!this.isShielded() && (this.statuses.burn > 0 || this.statuses.poison > 0)) {
      this.dotTimer += dt;
      if (this.dotTimer >= 1.0) {
        this.dotTimer = 0;
        const dot = Math.max(10, Math.round(this.maxHp * 0.014));
        this.hp = Math.max(1, this.hp - dot);
        game.spawnDamageText(this.x, this.y - this.radius, `-${dot}`, '#fb923c', 0.92);
      }
    }

    // Update Active Danger Telegraphs (Circles & Lasers)
    this._updateTelegraphs(dt, targetPlayer, game);

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }
    if (this.statuses.paralyze > 0) return;

    const speedMult = (this.statuses.freeze > 0 ? 0.55 : 1.0) * (this.phase === 2 ? 1.28 : 1.0);
    const dx = targetPlayer.x - this.x;
    const dy = targetPlayer.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    this.facing = Math.atan2(ny, nx);

    // Movement / Dash
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      const dSpd = this.spd * 2.9 * speedMult;
      const pos = resolveMapCollision(map, this.x + this.dashVec.x * dSpd * dt, this.y + this.dashVec.y * dSpd * dt, this.radius);
      this.x = pos.x;
      this.y = pos.y;
      if (Math.random() < 0.45) {
        game.spawnBurst(this.x, this.y, this.def.color, 2, 70);
      }
    } else {
      const desiredDist = 155;
      let moveX = 0;
      let moveY = 0;
      if (dist > desiredDist) {
        moveX = nx * this.spd * 0.72 * speedMult;
        moveY = ny * this.spd * 0.72 * speedMult;
      } else {
        // Orbit smoothly
        moveX = -ny * this.spd * 0.58 * speedMult;
        moveY = nx * this.spd * 0.58 * speedMult;
      }
      const pos = resolveMapCollision(map, this.x + moveX * dt, this.y + moveY * dt, this.radius);
      this.x = pos.x;
      this.y = pos.y;
    }

    // Contact Damage
    if (!targetPlayer.downed && this.contactCooldown <= 0) {
      const pDist = Math.hypot(targetPlayer.x - this.x, targetPlayer.y - this.y);
      if (pDist < this.radius + targetPlayer.radius - 4) {
        this.contactCooldown = 0.8;
        game.damageLocalPlayer(this.atk, null, this.x, this.y, this);
      }
    }

    // Execute Cycling Telegraph & Bullet Patterns
    this.attackTimer -= dt * (this.phase === 2 ? 1.35 : 1.0);
    if (this.attackTimer <= 0 && !targetPlayer.downed) {
      this._executePattern(targetPlayer, game);
    }
  }

  _executePattern(targetPlayer, game) {
    const p2 = this.phase === 2;
    const pat = this.patternIndex % 4;
    this.patternIndex += 1;

    if (pat === 0) {
      // Pattern 1: Red Danger Meteor Circles around player + arena!
      const count = p2 ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const offsetAng = Math.random() * Math.PI * 2;
        const offsetDist = i === 0 ? 0 : 75 + Math.random() * 110;
        this.telegraphs.push({
          type: 'circle',
          x: targetPlayer.x + Math.cos(offsetAng) * offsetDist,
          y: targetPlayer.y + Math.sin(offsetAng) * offsetDist,
          radius: p2 ? 78 : 66,
          timer: 0,
          chargeTime: p2 ? 0.92 : 1.12,
          activeTime: 0.28,
          damage: Math.round(this.atk * 1.25),
          hitApplied: false,
          color: this.def.color,
        });
      }
      this.attackTimer = p2 ? 2.1 : 2.7;
    } else if (pat === 1) {
      // Pattern 2: High-Energy Sweeping Laser Telegraph!
      const baseAngle = Math.atan2(targetPlayer.y - this.y, targetPlayer.x - this.x);
      const beamCount = p2 ? 3 : 1;
      for (let b = 0; b < beamCount; b++) {
        const spread = beamCount === 1 ? 0 : (b - 1) * 0.42;
        this.telegraphs.push({
          type: 'laser',
          x: this.x,
          y: this.y,
          angle: baseAngle + spread,
          length: 560,
          width: p2 ? 34 : 28,
          timer: 0,
          chargeTime: p2 ? 0.85 : 1.02,
          activeTime: 0.48,
          damage: Math.round(this.atk * 1.35),
          hitApplied: false,
          color: '#ff2e54',
        });
      }
      this.attackTimer = p2 ? 2.2 : 2.8;
    } else if (pat === 2) {
      // Pattern 3: Neon Spiral Bullet Nova
      const count = p2 ? 14 : 9;
      for (let i = 0; i < count; i++) {
        const ang = this.animPhase + (i / count) * Math.PI * 2;
        game.spawnProjectile({
          owner: 'enemy',
          x: this.x,
          y: this.y,
          angle: ang,
          speed: p2 ? 255 : 210,
          radius: 8,
          damage: this.atk,
          color: p2 ? '#fb7185' : this.def.accent,
          life: 2.6,
        });
      }
      if (p2) {
        // Secondary faster counter-ring
        for (let i = 0; i < 8; i++) {
          const ang = -this.animPhase + (i / 8) * Math.PI * 2;
          game.spawnProjectile({
            owner: 'enemy',
            x: this.x,
            y: this.y,
            angle: ang,
            speed: 310,
            radius: 6,
            damage: Math.round(this.atk * 0.9),
            color: '#38bdf8',
            life: 2.2,
          });
        }
      }
      game.audio.playSe('fire');
      this.attackTimer = p2 ? 1.8 : 2.3;
    } else {
      // Pattern 4: High-Speed Boss Dash Charge + Shock Ring
      const ang = Math.atan2(targetPlayer.y - this.y, targetPlayer.x - this.x);
      this.dashVec = { x: Math.cos(ang), y: Math.sin(ang) };
      this.dashTimer = 0.55;
      this.telegraphs.push({
        type: 'circle',
        x: this.x,
        y: this.y,
        radius: 105,
        timer: 0,
        chargeTime: 0.72,
        activeTime: 0.25,
        damage: Math.round(this.atk * 1.15),
        hitApplied: false,
        color: this.def.accent,
      });
      game.audio.playSe('dash');
      this.attackTimer = p2 ? 1.9 : 2.5;
    }
  }

  _updateTelegraphs(dt, player, game) {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i];
      tg.timer += dt;

      if (tg.type === 'laser') {
        tg.x = this.x;
        tg.y = this.y;
      }

      const firing = tg.timer >= tg.chargeTime;
      if (firing && !tg.burstSpawned) {
        tg.burstSpawned = true;
        game.addShake(tg.type === 'laser' ? 7 : 6);
        game.audio.playSe(tg.type === 'laser' ? 'lightning' : 'fire');
        if (tg.type === 'circle') {
          game.spawnBurst(tg.x, tg.y, tg.color || '#ff2e54', 18, 220);
        }
      }

      if (firing && !tg.hitApplied && !player.downed) {
        let hit = false;
        if (tg.type === 'circle') {
          const dist = Math.hypot(player.x - tg.x, player.y - tg.y);
          if (dist < tg.radius + player.radius * 0.65) hit = true;
        } else if (tg.type === 'laser') {
          const lx = Math.cos(tg.angle);
          const ly = Math.sin(tg.angle);
          const px = player.x - tg.x;
          const py = player.y - tg.y;
          const proj = px * lx + py * ly;
          if (proj > 0 && proj < tg.length) {
            const perp = Math.abs(px * -ly + py * lx);
            if (perp < tg.width * 0.5 + player.radius * 0.65) hit = true;
          }
        }
        if (hit) {
          tg.hitApplied = true;
          game.damageLocalPlayer(tg.damage, null, tg.x, tg.y, this);
        }
      }

      if (tg.timer >= tg.chargeTime + tg.activeTime) {
        this.telegraphs.splice(i, 1);
      }
    }
  }
}
