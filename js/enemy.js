// ============================================================================
// LUMINA DIORAMA — Enemy Entities, AI Patterns, Status Effects & Hack-n-Slash Loot
// Casual Musou Balance: Enemy stats stay at solo baseline in multiplayer!
// 製作者：駿 (Created by Shun)
// ============================================================================

import { getEnemyById, getWeaponById, getArmorById, CORES } from './data.js';
import { resolveMapCollision } from './map.js';

let enemyUidSeq = 1;

export class Enemy {
  constructor(enemyId, x, y, scaleMult = 1.0) {
    const def = getEnemyById(enemyId);
    this.uid = `en_${enemyUidSeq++}`;
    this.id = def.id;
    this.def = def;
    this.name = def.name;
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = def.radius;
    this.facing = Math.random() * Math.PI * 2;

    this.maxHp = Math.round(def.hp * scaleMult);
    this.hp = this.maxHp;
    this.atk = Math.round(def.atk * Math.sqrt(scaleMult));
    this.defStat = Math.round(def.def * Math.sqrt(scaleMult));
    this.spd = def.spd;
    this.exp = Math.round(def.exp * scaleMult);
    this.gold = Math.round(def.gold * scaleMult);

    this.alive = true;
    this.hitFlash = 0;
    this.knockX = 0;
    this.knockY = 0;
    this.aiTimer = 0.6 + Math.random() * 1.0;
    this.chargeDir = { x: 0, y: 0 };
    this.charging = 0;
    this.chargeWindup = 0;
    this.animPhase = Math.random() * Math.PI * 2;

    this.statuses = {
      burn: 0,
      freeze: 0,
      paralyze: 0,
      poison: 0,
    };
    this.dotTimer = 0;
    this.contactCooldown = 0;
  }

  applyStatus(statusName, duration = 4.0) {
    if (!statusName || !(statusName in this.statuses)) return;
    this.statuses[statusName] = Math.max(this.statuses[statusName], duration);
  }

  takeDamage(rawDamage, element, isCrit, knockDirX, knockDirY, game) {
    if (!this.alive) return { dmg: 0, killed: false, weak: false };
    const weak = element && element !== 'none' && element === this.def.weakness;
    let dmg = Math.max(2, rawDamage - this.defStat * 0.45);
    if (weak) dmg *= 1.55;
    if (isCrit) dmg *= 1.65;
    dmg = Math.max(1, Math.round(dmg * (0.93 + Math.random() * 0.14)));

    this.hp = Math.max(0, this.hp - dmg);
    this.hitFlash = 0.14;
    this.knockX = (knockDirX || 0) * (isCrit ? 240 : 150);
    this.knockY = (knockDirY || 0) * (isCrit ? 240 : 150);

    const color = isCrit ? '#fbbf24' : weak ? '#38f8d4' : '#f8fafc';
    const tag = isCrit ? `${dmg} CRIT!` : weak ? `${dmg} WEAK!` : `${dmg}`;
    game.spawnDamageText(this.x, this.y - this.radius - 10, tag, color, isCrit || weak ? 1.25 : 1.0);
    game.spawnBurst(this.x, this.y, weak ? '#38f8d4' : this.def.color, isCrit ? 14 : 7, isCrit ? 220 : 140);

    let killed = false;
    if (this.hp <= 0) {
      this.alive = false;
      killed = true;
      game.onEnemyKilled(this);
    }
    return { dmg, killed, weak };
  }

  update(dt, map, targetPlayer, game) {
    if (!this.alive) return;
    this.animPhase += dt * 4.5;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.contactCooldown > 0) this.contactCooldown -= dt;

    // Status Effects
    for (const k of Object.keys(this.statuses)) {
      if (this.statuses[k] > 0) this.statuses[k] = Math.max(0, this.statuses[k] - dt);
    }
    if (this.statuses.burn > 0 || this.statuses.poison > 0) {
      this.dotTimer += dt;
      if (this.dotTimer >= 0.9) {
        this.dotTimer = 0;
        const dot = Math.max(4, Math.round(this.maxHp * 0.045));
        this.hp = Math.max(0, this.hp - dot);
        game.spawnDamageText(this.x, this.y - this.radius, `-${dot}`, this.statuses.burn > 0 ? '#fb923c' : '#a3e635', 0.88);
        if (this.hp <= 0) {
          this.alive = false;
          game.onEnemyKilled(this);
          return;
        }
      }
    }

    // Apply Knockback Decay
    this.knockX *= Math.pow(0.02, dt);
    this.knockY *= Math.pow(0.02, dt);

    // Paralyze Stun freezes AI movement
    if (this.statuses.paralyze > 0) {
      const pos = resolveMapCollision(map, this.x + this.knockX * dt, this.y + this.knockY * dt, this.radius);
      this.x = pos.x;
      this.y = pos.y;
      return;
    }

    const speedMult = this.statuses.freeze > 0 ? 0.42 : 1.0;
    const dx = targetPlayer.x - this.x;
    const dy = targetPlayer.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    // Aggro Check
    const aggroRange = game.currentAreaId === 'tower' ? 950 : 390;
    if (dist > aggroRange || targetPlayer.downed) {
      // Gentle patrol near spawn
      const sdx = this.spawnX - this.x;
      const sdy = this.spawnY - this.y;
      const sdist = Math.hypot(sdx, sdy);
      if (sdist > 36) {
        this.vx = (sdx / sdist) * this.spd * 0.45 * speedMult;
        this.vy = (sdy / sdist) * this.spd * 0.45 * speedMult;
      } else {
        this.vx *= 0.85;
        this.vy *= 0.85;
      }
    } else {
      this.facing = Math.atan2(ny, nx);
      const ai = this.def.ai;

      if (ai === 'chase') {
        this.vx = nx * this.spd * speedMult;
        this.vy = ny * this.spd * speedMult;
      } else if (ai === 'charger') {
        if (this.charging > 0) {
          this.charging -= dt;
          this.vx = this.chargeDir.x * this.spd * 2.55 * speedMult;
          this.vy = this.chargeDir.y * this.spd * 2.55 * speedMult;
        } else if (this.chargeWindup > 0) {
          this.chargeWindup -= dt;
          this.vx *= 0.7;
          this.vy *= 0.7;
          if (this.chargeWindup <= 0) {
            this.charging = 0.42;
            this.chargeDir = { x: nx, y: ny };
          }
        } else {
          this.vx = nx * this.spd * 0.72 * speedMult;
          this.vy = ny * this.spd * 0.72 * speedMult;
          this.aiTimer -= dt;
          if (this.aiTimer <= 0 && dist < 240) {
            this.chargeWindup = 0.45;
            this.aiTimer = 2.4;
          }
        }
      } else if (ai === 'shooter') {
        if (dist < 140) {
          this.vx = -nx * this.spd * 0.75 * speedMult;
          this.vy = -ny * this.spd * 0.75 * speedMult;
        } else if (dist > 240) {
          this.vx = nx * this.spd * 0.8 * speedMult;
          this.vy = ny * this.spd * 0.8 * speedMult;
        } else {
          this.vx = -ny * this.spd * 0.55 * speedMult;
          this.vy = nx * this.spd * 0.55 * speedMult;
        }
        this.aiTimer -= dt * speedMult;
        if (this.aiTimer <= 0) {
          this.aiTimer = 1.9 + Math.random() * 0.5;
          game.spawnProjectile({
            owner: 'enemy',
            x: this.x,
            y: this.y,
            angle: this.facing,
            speed: 255,
            radius: 7,
            damage: this.atk,
            color: this.def.accent,
            statusOnHit: this.def.statusOnHit,
            life: 2.0,
          });
        }
      } else if (ai === 'bomber') {
        this.vx = nx * this.spd * 0.5 * speedMult;
        this.vy = ny * this.spd * 0.5 * speedMult;
        this.aiTimer -= dt * speedMult;
        if (this.aiTimer <= 0) {
          this.aiTimer = 2.5;
          const count = 6;
          for (let i = 0; i < count; i++) {
            const ang = this.animPhase + (i / count) * Math.PI * 2;
            game.spawnProjectile({
              owner: 'enemy',
              x: this.x,
              y: this.y,
              angle: ang,
              speed: 195,
              radius: 7,
              damage: this.atk,
              color: this.def.color,
              statusOnHit: this.def.statusOnHit,
              life: 1.85,
            });
          }
        }
      }
    }

    const pos = resolveMapCollision(
      map,
      this.x + (this.vx + this.knockX) * dt,
      this.y + (this.vy + this.knockY) * dt,
      this.radius
    );
    this.x = pos.x;
    this.y = pos.y;

    // Contact Damage against local player
    if (!targetPlayer.downed && this.contactCooldown <= 0) {
      const pDist = Math.hypot(targetPlayer.x - this.x, targetPlayer.y - this.y);
      if (pDist < this.radius + targetPlayer.radius - 2) {
        this.contactCooldown = 0.72;
        game.damageLocalPlayer(this.atk, this.def.statusOnHit, this.x, this.y);
      }
    }
  }
}

// ============================================================================
// HACK-AND-SLASH LOOT GENERATOR
// ============================================================================
export function rollEnemyDrops(enemy, dropBonus = 0) {
  const drops = [];
  const x = enemy.x;
  const y = enemy.y;

  // Always drop glowing Gold Orb
  drops.push({
    type: 'gold',
    amount: enemy.gold,
    x: x + (Math.random() - 0.5) * 28,
    y: y + (Math.random() - 0.5) * 28,
    color: '#fbbf24',
  });

  // HP/MP Mini Recovery Orb chance
  if (Math.random() < 0.28) {
    drops.push({
      type: Math.random() < 0.65 ? 'hp_orb' : 'mp_orb',
      amount: 25,
      x: x + (Math.random() - 0.5) * 32,
      y: y + (Math.random() - 0.5) * 32,
      color: '#34d399',
    });
  }

  // Enhancement Ore Drop (32% base + combo bonus)
  if (Math.random() < 0.32 + dropBonus * 0.25) {
    const area = enemy.def.area;
    let oreType = 'stardust';
    if (area === 'cave' || area === 'ruins') oreType = Math.random() < 0.55 ? 'prism' : 'stardust';
    if (area === 'magma' || area === 'citadel') oreType = Math.random() < 0.45 ? 'void' : 'prism';
    drops.push({
      type: 'ore',
      oreType,
      amount: 1,
      x: x + (Math.random() - 0.5) * 34,
      y: y + (Math.random() - 0.5) * 34,
      color: oreType === 'void' ? '#fbbf24' : oreType === 'prism' ? '#f472b6' : '#38bdf8',
    });
  }

  // Permanent Status Core Drop (7% + combo bonus)
  if (Math.random() < 0.075 + dropBonus * 0.08) {
    const coreKeys = Object.keys(CORES);
    const coreId = coreKeys[Math.floor(Math.random() * coreKeys.length)];
    drops.push({
      type: 'core',
      coreId,
      x: x + (Math.random() - 0.5) * 34,
      y: y + (Math.random() - 0.5) * 34,
      color: CORES[coreId].color,
    });
  }

  // Hack-and-Slash Rare Weapon / Armor Drop (14% base + combo bonus!)
  if (enemy.def.dropTable && enemy.def.dropTable.length && Math.random() < 0.14 + dropBonus * 0.14) {
    const itemId = enemy.def.dropTable[Math.floor(Math.random() * enemy.def.dropTable.length)];
    const isWeapon = itemId.startsWith('wp_');
    const itemData = isWeapon ? getWeaponById(itemId) : getArmorById(itemId);
    const bonusPlus = Math.random() < 0.28 ? 1 + Math.floor(Math.random() * 2) : 0;
    drops.push({
      type: isWeapon ? 'weapon' : 'armor',
      itemId,
      plus: bonusPlus,
      rarity: itemData.rarity,
      x: x + (Math.random() - 0.5) * 36,
      y: y + (Math.random() - 0.5) * 36,
      color: itemData.color,
    });
  }

  return drops;
}
