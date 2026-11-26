// ============================================================================
// LUMINA DIORAMA — High-DPI 3D Miniature Diorama × Cyber-Neon Canvas Renderer
// ZERO pixel art: Pure layered vector geometry, shadows, bloom, lighting & VFX
// 製作者：駿 (Created by Shun)
// ============================================================================

import { GAME_META, JOBS, NPCS, RARITY_INFO } from './data.js';
import { TILE, getTile } from './map.js';

const TS = GAME_META.tileSize;

export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.minimapCanvas = minimapCanvas;
    this.mctx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    // Dedicated offscreen canvas for Crystal Cave dynamic darkness lighting
    this.lightCanvas = document.createElement('canvas');
    this.lctx = this.lightCanvas.getContext('2d');

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.time = 0;
    this.envParticles = [];
    this.envAreaId = null;

    this.resize();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Offscreen darkness mask at half resolution for ultra-smooth 60fps on iPad
    this.lightCanvas.width = Math.max(2, Math.floor(this.width * 0.5));
    this.lightCanvas.height = Math.max(2, Math.floor(this.height * 0.5));
  }

  _ensureEnvParticles(areaId, type) {
    if (this.envAreaId === areaId && this.envParticles.length > 0) return;
    this.envAreaId = areaId;
    this.envParticles = [];
    const count = type === 'mist' ? 52 : 64;
    for (let i = 0; i < count; i++) {
      this.envParticles.push(this._makeEnvParticle(type, true));
    }
  }

  _makeEnvParticle(type, randomY = false) {
    const w = this.width;
    const h = this.height;
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : (type === 'embers' || type === 'data' || type === 'lantern' ? h + 15 : -15),
      vx: (Math.random() - 0.5) * (type === 'mist' ? 28 : 22),
      vy: type === 'embers' ? -(35 + Math.random() * 65)
        : type === 'data' ? -(28 + Math.random() * 48)
        : type === 'lantern' ? -(14 + Math.random() * 24)
        : type === 'mist' ? (16 + Math.random() * 34)
        : (Math.random() - 0.5) * 18,
      size: type === 'mist' ? (Math.random() < 0.35 ? 2.5 : 18 + Math.random() * 26)
        : (2 + Math.random() * 4.5),
      alpha: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      isDrop: type === 'mist' && Math.random() < 0.32,
      hue: Math.random(),
    };
  }

  // ==========================================================================
  // TITLE SCREEN — ANIMATED 3D DIORAMA & GLOWING NEON LOGO
  // ==========================================================================
  renderTitle(dt) {
    this.time += dt;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const w = this.width;
    const h = this.height;

    // Deep cosmic gradient sky
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.32, 30, w * 0.5, h * 0.45, Math.max(w, h) * 0.85);
    bg.addColorStop(0, '#10294d');
    bg.addColorStop(0.45, '#071429');
    bg.addColorStop(1, '#030813');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle perspective cyber horizon lines
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 248, 212, 0.11)';
    ctx.lineWidth = 1;
    const horizonY = h * 0.52;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + i * 32, horizonY);
      ctx.lineTo(w * 0.5 + i * 210, h + 40);
      ctx.stroke();
    }
    for (let r = 0; r < 9; r++) {
      const t = ((r / 9) + (this.time * 0.08) % (1 / 9));
      const py = horizonY + Math.pow(t, 1.8) * (h - horizonY + 30);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }
    ctx.restore();

    // Floating twinkling stars & neon motes
    for (let i = 0; i < 48; i++) {
      const sx = ((i * 197.3) % w);
      const sy = ((i * 113.7 + Math.sin(this.time + i) * 8) % (h * 0.65));
      const pulse = 0.35 + 0.65 * Math.sin(this.time * 2.1 + i);
      ctx.fillStyle = i % 3 === 0 ? `rgba(56,248,212,${pulse * 0.8})` : i % 3 === 1 ? `rgba(251,191,36,${pulse * 0.75})` : `rgba(224,242,254,${pulse * 0.7})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2 + (i % 3) * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center Floating 3D Miniature Isometric Diorama Cube + Star Crystal
    const cx = w * 0.5;
    const cy = Math.min(h * 0.28, h - 372);
    const floatY = Math.sin(this.time * 1.8) * 10;
    const scale = Math.min(1.06, Math.max(0.66, Math.min(w, h) / 720));

    ctx.save();
    ctx.translate(cx, cy + floatY);
    ctx.scale(scale, scale);

    // Ambient diorama aura
    const aura = ctx.createRadialGradient(0, -20, 12, 0, -10, 210);
    aura.addColorStop(0, 'rgba(56, 248, 212, 0.32)');
    aura.addColorStop(0.5, 'rgba(34, 211, 238, 0.12)');
    aura.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -10, 210, 0, Math.PI * 2);
    ctx.fill();

    // Isometric Diorama Slab
    const topG = ctx.createLinearGradient(-150, 10, 150, 95);
    topG.addColorStop(0, '#10b981');
    topG.addColorStop(0.5, '#0891b2');
    topG.addColorStop(1, '#1d4ed8');

    // Left vertical face
    ctx.fillStyle = '#0c2e48';
    ctx.beginPath();
    ctx.moveTo(-148, 42);
    ctx.lineTo(0, 112);
    ctx.lineTo(0, 158);
    ctx.lineTo(-148, 88);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 248, 212, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right vertical face
    ctx.fillStyle = '#132145';
    ctx.beginPath();
    ctx.moveTo(148, 42);
    ctx.lineTo(0, 112);
    ctx.lineTo(0, 158);
    ctx.lineTo(148, 88);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Top diamond surface
    ctx.fillStyle = topG;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(148, 42);
    ctx.lineTo(0, 112);
    ctx.lineTo(-148, 42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Miniature glowing trees / spires on diorama corners
    this._drawMiniDioramaSpire(ctx, -64, 34, '#34d399', 26);
    this._drawMiniDioramaSpire(ctx, 68, 36, '#38bdf8', 30);
    this._drawMiniDioramaSpire(ctx, -20, 68, '#fb923c', 22);
    this._drawMiniDioramaSpire(ctx, 32, 16, '#f472b6', 24);

    // Floating Star Crystal Centerpiece
    const cBob = Math.sin(this.time * 2.8) * 6;
    ctx.save();
    ctx.translate(0, -34 + cBob);
    ctx.shadowColor = '#38f8d4';
    ctx.shadowBlur = 28;
    const cg = ctx.createLinearGradient(0, -76, 0, 48);
    cg.addColorStop(0, '#fffbeb');
    cg.addColorStop(0.4, '#67e8f9');
    cg.addColorStop(1, '#f472b6');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(0, -78);
    ctx.lineTo(38, -8);
    ctx.lineTo(0, 46);
    ctx.lineTo(-38, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.beginPath();
    ctx.moveTo(0, -78);
    ctx.lineTo(18, -8);
    ctx.lineTo(0, 46);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Orbiting Neon Ring
    ctx.save();
    ctx.rotate(-0.22);
    ctx.strokeStyle = '#38f8d4';
    ctx.shadowColor = '#38f8d4';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, -14, 126, 30, 0, 0, Math.PI * 2);
    ctx.stroke();

    const orbAng = this.time * 1.9;
    const ox = Math.cos(orbAng) * 126;
    const oy = -14 + Math.sin(orbAng) * 30;
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(ox, oy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // ======================================================================
    // GLOWING ANIMATED NEON TITLE LOGO
    // ======================================================================
    const logoY = cy + 168 * scale;
    const titleSize = Math.min(60, Math.max(30, w * 0.064));

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Animated glow pulse behind title
    const pulse = 18 + Math.sin(this.time * 3.1) * 10;
    ctx.font = `900 ${titleSize}px "Hiragino Kaku Gothic ProN", "Segoe UI", sans-serif`;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = pulse + 12;

    const grad = ctx.createLinearGradient(cx - 240, logoY - 26, cx + 240, logoY + 26);
    const shift = (Math.sin(this.time * 1.4) + 1) * 0.5;
    grad.addColorStop(0, '#ecfeff');
    grad.addColorStop(0.35 + shift * 0.15, '#38f8d4');
    grad.addColorStop(0.7, '#38bdf8');
    grad.addColorStop(1, '#fef08a');

    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(4, 14, 30, 0.85)';
    ctx.strokeText(GAME_META.title, cx, logoY);
    ctx.fillStyle = grad;
    ctx.fillText(GAME_META.title, cx, logoY);

    // Subtitle with subtle neon rule
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fbbf24';
    ctx.font = `800 ${Math.min(16, Math.max(11, w * 0.018))}px "Hiragino Kaku Gothic ProN", sans-serif`;
    ctx.fillStyle = '#e0f2fe';
    ctx.fillText(GAME_META.subtitle, cx, logoY + titleSize * 0.68);
    ctx.restore();

    ctx.restore();
  }

  _drawMiniDioramaSpire(ctx, x, y, color, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + 11, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 11, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ==========================================================================
  // MAIN IN-GAME WORLD RENDERER
  // ==========================================================================
  renderGame(game, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const map = game.map;
    const pal = map.meta.palette;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Deep Diorama Void Backdrop
    ctx.fillStyle = pal.voidBg;
    ctx.fillRect(0, 0, this.width, this.height);
    this._drawVoidGrid(ctx, game.camera, pal);

    // Camera Transform + Screen Shake
    const camX = game.camera.x + game.shakeOffset.x;
    const camY = game.camera.y + game.shakeOffset.y;

    ctx.save();
    ctx.translate(Math.round(this.width * 0.5 - camX), Math.round(this.height * 0.5 - camY));

    // 2. Tile Layers (Visible Viewport Culled for Silk 60FPS!)
    const startTx = Math.max(0, Math.floor((camX - this.width * 0.5) / TS) - 2);
    const endTx = Math.min(map.width - 1, Math.ceil((camX + this.width * 0.5) / TS) + 2);
    const startTy = Math.max(0, Math.floor((camY - this.height * 0.5) / TS) - 2);
    const endTy = Math.min(map.height - 1, Math.ceil((camY + this.height * 0.5) / TS) + 2);

    this._drawFloorTiles(ctx, map, pal, startTx, endTx, startTy, endTy);
    this._drawWallShadows(ctx, map, startTx, endTx, startTy, endTy);
    this._drawInteractiveFloorObjects(ctx, game, map);
    this._drawTelegraphs(ctx, game);

    // 3. Y-Sorted World Entities + Extruded 3D Walls & Props
    this._drawWallsAndGates(ctx, map, pal, startTx, endTx, startTy, endTy);
    this._drawProps(ctx, map);
    this._drawDrops(ctx, game.drops);
    this._drawAfterimages(ctx, game.afterimages);
    this._drawNpcs(ctx, game, map);
    this._drawRemotePlayers(ctx, game);
    this._drawEnemies(ctx, game.enemies);
    if (game.boss && game.boss.alive) {
      this._drawBoss(ctx, game.boss);
    }
    this._drawPlayer(ctx, game.player);
    this._drawDrone(ctx, game.player.drone, game.player.droneLevel);
    this._drawSlashes(ctx, game.slashes);
    this._drawProjectiles(ctx, game.projectiles);
    this._drawParticles(ctx, game.particles);
    this._drawSpeechBubbles(ctx, game);
    this._drawDamageTexts(ctx, game.damageTexts);

    ctx.restore(); // End world camera space

    // 4. Darkness Fog-of-War Lighting Mask (Area 2: Obsidian Crystal Cavern!)
    if (map.meta.darkness) {
      this._renderDarknessMask(ctx, game, camX, camY);
    }

    // 5. Screen-Space Zone Environmental Particles
    this._ensureEnvParticles(map.areaId, map.meta.particleType);
    this._updateAndDrawEnvParticles(ctx, dt, map.meta.particleType, pal);

    // 6. Limit Break / Slow-Mo Chromatic Vignette Flash
    if (game.screenFlash > 0) {
      ctx.fillStyle = game.screenFlashColor || `rgba(56, 248, 212, ${game.screenFlash * 0.4})`;
      ctx.globalAlpha = Math.min(0.6, game.screenFlash);
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // 7. Live Minimap
    this._renderMinimap(game);
  }

  _drawVoidGrid(ctx, cam, pal) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 248, 212, 0.05)';
    ctx.lineWidth = 1;
    const step = 64;
    const ox = ((-cam.x * 0.35) % step + step) % step;
    const oy = ((-cam.y * 0.35) % step + step) % step;
    for (let x = ox; x < this.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = oy; y < this.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawFloorTiles(ctx, map, pal, x0, x1, y0, y1) {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4.2);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = getTile(map, tx, ty);
        if (t === TILE.VOID) continue;
        const px = tx * TS;
        const py = ty * TS;

        if (t === TILE.WATER) {
          ctx.fillStyle = pal.water;
          ctx.fillRect(px, py, TS, TS);
          // Animated glowing ripples / molten waves
          ctx.fillStyle = map.areaId === 'magma'
            ? `rgba(253, 224, 71, ${0.18 + 0.14 * Math.sin(this.time * 3 + tx + ty)})`
            : `rgba(103, 232, 249, ${0.14 + 0.1 * Math.sin(this.time * 2.6 + tx * 0.8 + ty)})`;
          const wy = py + ((this.time * 18 + tx * 11) % TS);
          ctx.fillRect(px + 6, wy, TS - 12, 3);
          continue;
        }

        // Base beveled miniature floor tile
        const alt = (tx + ty) % 2 === 0;
        if (t === TILE.ACCENT) {
          ctx.fillStyle = pal.floorAccent;
        } else if (t === TILE.BOSS_FLOOR) {
          ctx.fillStyle = alt ? '#23193b' : '#2a1d47';
        } else {
          ctx.fillStyle = alt ? pal.floorA : pal.floorB;
        }
        ctx.fillRect(px, py, TS, TS);

        // Subtle beveled tile seam
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);

        if (t === TILE.ACCENT) {
          ctx.fillStyle = 'rgba(56, 248, 212, 0.08)';
          ctx.fillRect(px + 4, py + 4, TS - 8, TS - 8);
        } else if (t === TILE.BOSS_FLOOR) {
          ctx.strokeStyle = `rgba(244, 114, 182, ${0.12 + pulse * 0.08})`;
          ctx.strokeRect(px + 5, py + 5, TS - 10, TS - 10);
        } else if (t === TILE.DAMAGE) {
          // Pulsing Hazard Floor (Magma Vent / Shock Panel)
          const hColor = map.areaId === 'magma' ? `rgba(239, 68, 68, ${0.35 + pulse * 0.35})` : `rgba(56, 189, 248, ${0.3 + pulse * 0.35})`;
          ctx.fillStyle = hColor;
          ctx.fillRect(px + 3, py + 3, TS - 6, TS - 6);
          ctx.strokeStyle = map.areaId === 'magma' ? '#fde047' : '#67e8f9';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(px + 10, py + TS - 10);
          ctx.lineTo(px + TS * 0.5, py + 10);
          ctx.lineTo(px + TS - 10, py + TS - 10);
          ctx.stroke();
        }
      }
    }
  }

  _drawWallShadows(ctx, map, x0, x1, y0, y1) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = getTile(map, tx, ty);
        if (t !== TILE.WALL && t !== TILE.CRACKED) continue;
        const px = tx * TS;
        const py = ty * TS;
        // Soft drop shadow cast down-right
        ctx.fillRect(px + 8, py + TS, TS, 12);
        ctx.fillRect(px + TS, py + 6, 10, TS);
      }
    }
  }

  _drawWallsAndGates(ctx, map, pal, x0, x1, y0, y1) {
    const elev = 14;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5.2);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = getTile(map, tx, ty);
        const px = tx * TS;
        const py = ty * TS;

        if (t === TILE.WALL || t === TILE.CRACKED) {
          // 3D Miniature Extruded Front Facade
          ctx.fillStyle = pal.wallFront;
          ctx.fillRect(px, py + TS - elev, TS, elev);
          // Elevated Top Cap
          ctx.fillStyle = pal.wallTop;
          ctx.fillRect(px, py - elev, TS, TS);
          // Crisp top rim highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(px, py - elev, TS, 3);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py - elev + 0.5, TS - 1, TS - 1);

          // Neon architectural stripe on southern wall edges
          if (getTile(map, tx, ty + 1) !== TILE.WALL && getTile(map, tx, ty + 1) !== TILE.CRACKED) {
            ctx.fillStyle = pal.neon;
            ctx.globalAlpha = 0.55;
            ctx.fillRect(px + 3, py + TS - elev - 2, TS - 6, 2.5);
            ctx.globalAlpha = 1;
          }

          // Glowing Fracture Lines on Breakable Cracked Secret Walls!
          if (t === TILE.CRACKED) {
            ctx.save();
            ctx.strokeStyle = `rgba(251, 191, 36, ${0.65 + pulse * 0.35})`;
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 10;
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.moveTo(px + 10, py - elev + 8);
            ctx.lineTo(px + 22, py - elev + 22);
            ctx.lineTo(px + 16, py - elev + 36);
            ctx.lineTo(px + 32, py + TS - 4);
            ctx.moveTo(px + 22, py - elev + 22);
            ctx.lineTo(px + 38, py - elev + 16);
            ctx.stroke();
            ctx.restore();
          }
        } else if (t === TILE.GATE || t === TILE.BOSS_GATE) {
          // Glowing Laser Barrier Gate
          const gColor = t === TILE.BOSS_GATE ? '#ff2e54' : pal.neon;
          ctx.save();
          ctx.fillStyle = t === TILE.BOSS_GATE ? 'rgba(255, 46, 84, 0.25)' : 'rgba(56, 248, 212, 0.22)';
          ctx.fillRect(px, py, TS, TS);
          ctx.strokeStyle = gColor;
          ctx.shadowColor = gColor;
          ctx.shadowBlur = 12;
          ctx.lineWidth = 3;
          for (let b = 0; b < 3; b++) {
            const by = py + 10 + b * 14 + Math.sin(this.time * 8 + b) * 1.5;
            ctx.beginPath();
            ctx.moveTo(px + 3, by);
            ctx.lineTo(px + TS - 3, by);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
  }

  _drawInteractiveFloorObjects(ctx, game, map) {
    // Switches & Energy Conduits
    for (const sw of map.switches) {
      ctx.save();
      const glow = sw.activated ? '#34d399' : '#fbbf24';
      ctx.shadowColor = glow;
      ctx.shadowBlur = sw.activated ? 18 : 12;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = glow;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = sw.activated ? '#34d399' : `rgba(251,191,36,${0.45 + 0.45 * Math.sin(this.time * 5)})`;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e2f1ff';
      ctx.fillText(sw.activated ? 'OPEN' : 'SWITCH', sw.x, sw.y - 24);
      ctx.restore();
    }

    // Mystic Shrines
    for (const sh of map.shrines) {
      ctx.save();
      const col = sh.used ? '#64748b' : '#e879f9';
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = sh.used ? 0 : 18;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, 26 + Math.sin(this.time * 3) * 3, 0, Math.PI * 2);
      ctx.stroke();

      // Floating obelisk crystal
      const bob = sh.used ? 0 : Math.sin(this.time * 3.5) * 4;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y - 24 + bob);
      ctx.lineTo(sh.x + 12, sh.y + bob);
      ctx.lineTo(sh.x, sh.y + 12 + bob);
      ctx.lineTo(sh.x - 12, sh.y + bob);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = sh.used ? '#94a3b8' : '#f5d0fe';
      ctx.fillText(sh.used ? '祈祷済' : '⛩ 神秘の祭壇', sh.x, sh.y - 32);
      ctx.restore();
    }

    // Treasure Chests
    for (const ch of map.chests) {
      ctx.save();
      const rar = RARITY_INFO[ch.rarity] || RARITY_INFO.rare;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(ch.x, ch.y + 12, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = ch.opened ? '#334155' : '#1e293b';
      ctx.strokeStyle = ch.opened ? '#64748b' : rar.color;
      ctx.lineWidth = 2.4;
      if (!ch.opened) {
        ctx.shadowColor = rar.color;
        ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      ctx.roundRect(ch.x - 16, ch.y - 12, 32, 22, 6);
      ctx.fill();
      ctx.stroke();

      // Glowing lock core
      if (!ch.opened) {
        ctx.fillStyle = rar.color;
        ctx.beginPath();
        ctx.arc(ch.x, ch.y - 1, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Portals
    for (const pt of map.portals) {
      const locked = game.isPortalLocked(pt);
      ctx.save();
      const col = locked ? '#64748b' : (pt.color || '#38f8d4');
      ctx.shadowColor = col;
      ctx.shadowBlur = locked ? 4 : 20;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 24, this.time * 2, this.time * 2 + Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 16, -this.time * 3, -this.time * 3 + Math.PI * 1.4);
      ctx.stroke();

      ctx.fillStyle = locked ? 'rgba(100,116,139,0.2)' : `${col}33`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = locked ? '#94a3b8' : '#ffffff';
      ctx.fillText(locked ? `🔒 ${pt.label}` : pt.label, pt.x, pt.y - 31);
      ctx.restore();
    }

    // Moving Plasma Saw Traps
    for (const tr of map.traps) {
      ctx.save();
      // Rail track
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.28)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tr.x1, tr.y1);
      ctx.lineTo(tr.x2, tr.y2);
      ctx.stroke();

      // Spinning Saw Blade
      ctx.translate(tr.x, tr.y);
      ctx.rotate(this.time * 9);
      ctx.shadowColor = '#ff2e54';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) {
        const ang = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? tr.radius : tr.radius * 0.56;
        if (i === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
        else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff1f2';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawProps(ctx, map) {
    for (const pr of map.props) {
      ctx.save();
      if (pr.type === 'tree') {
        // Miniature glowing layered diorama tree
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y + 8, 22, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.arc(pr.x, pr.y - 16, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pr.color;
        ctx.shadowColor = pr.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(pr.x - 4, pr.y - 22, 15, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.type === 'crystal' || pr.type === 'lamp') {
        const glow = pr.color || '#38bdf8';
        ctx.shadowColor = glow;
        ctx.shadowBlur = 16;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y - 28);
        ctx.lineTo(pr.x + 10, pr.y - 8);
        ctx.lineTo(pr.x, pr.y + 4);
        ctx.lineTo(pr.x - 10, pr.y - 8);
        ctx.closePath();
        ctx.fill();
      } else if (pr.type === 'monument') {
        const bob = Math.sin(this.time * 2.5) * 6;
        ctx.strokeStyle = 'rgba(56, 248, 212, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 44, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowColor = '#38f8d4';
        ctx.shadowBlur = 24;
        const g = ctx.createLinearGradient(pr.x, pr.y - 54, pr.x, pr.y + 10);
        g.addColorStop(0, '#fef08a');
        g.addColorStop(0.5, '#38f8d4');
        g.addColorStop(1, '#0284c7');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y - 52 + bob);
        ctx.lineTo(pr.x + 18, pr.y - 18 + bob);
        ctx.lineTo(pr.x, pr.y + 6 + bob);
        ctx.lineTo(pr.x - 18, pr.y - 18 + bob);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawNpcs(ctx, game, map) {
    for (const n of map.npcs) {
      const def = NPCS[n.npcId];
      if (!def) continue;
      const bob = Math.sin(this.time * 3 + n.x) * 2.5;

      ctx.save();
      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 13, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stylized diorama figurine body
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y + bob, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, n.x, n.y + bob + 1);

      // Nameplate
      ctx.font = '800 11px sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(n.label || def.name, n.x, n.y - 24);

      // Nearby Interact Hint
      const dist = Math.hypot(game.player.x - n.x, game.player.y - n.y);
      if (dist < 78) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '800 10px sans-serif';
        ctx.fillText('[話す / F]', n.x, n.y - 38);
      }
      ctx.restore();
    }
  }

  _drawCharacterFigurine(ctx, opts) {
    const {
      x, y, facing, jobId, weaponColor, weaponPlus = 0,
      hitFlash = 0, downed = false, overclock = false, walkPhase = 0,
    } = opts;
    const job = JOBS[jobId] || JOBS.knight;
    const bob = downed ? 0 : Math.abs(Math.sin(walkPhase)) * 3.5;

    ctx.save();
    // Soft Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 16, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Overclock / Buff Ring
    if (overclock && !downed) {
      ctx.strokeStyle = '#38f8d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y + 4, 24 + Math.sin(this.time * 10) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Weapon Forge Aura Evolution (+1/+4/+7/+10)
    if (weaponPlus >= 4 && !downed) {
      ctx.save();
      const auraCol = weaponPlus >= 7 ? '#fbbf24' : weaponColor;
      ctx.strokeStyle = auraCol;
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin(this.time * 8);
      ctx.lineWidth = weaponPlus >= 7 ? 3 : 1.8;
      ctx.beginPath();
      ctx.arc(x, y - bob, 22, this.time * 4, this.time * 4 + Math.PI * 1.3);
      ctx.stroke();
      if (weaponPlus >= 7) {
        for (let k = 0; k < 3; k++) {
          const oa = this.time * 5 + (k / 3) * Math.PI * 2;
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(x + Math.cos(oa) * 25, y - bob + Math.sin(oa) * 14, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.translate(x, y - bob);
    if (downed) {
      ctx.rotate(Math.PI * 0.45);
      ctx.globalAlpha = 0.72;
    }

    // Adventurer Cloak / Armor Silhouette
    ctx.fillStyle = hitFlash > 0 ? '#ffffff' : '#0b182e';
    ctx.strokeStyle = hitFlash > 0 ? '#ffffff' : job.color;
    ctx.shadowColor = job.color;
    ctx.shadowBlur = weaponPlus >= 1 ? 14 : 8;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, 15.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner Neon Core & Visor pointing in facing direction
    ctx.fillStyle = job.accent;
    ctx.beginPath();
    ctx.arc(Math.cos(facing) * 6, Math.sin(facing) * 6, 5.2, 0, Math.PI * 2);
    ctx.fill();

    // Dynamic Held Neon Weapon with Forge Glow
    if (!downed) {
      ctx.save();
      ctx.rotate(facing);
      ctx.shadowColor = weaponColor;
      ctx.shadowBlur = 8 + weaponPlus * 2.4;
      ctx.strokeStyle = weaponColor;
      ctx.lineWidth = 3.2 + Math.min(2.5, weaponPlus * 0.25);
      ctx.lineCap = 'round';
      if (jobId === 'mage') {
        // Prism Wand Staff + Glowing Orb
        ctx.beginPath();
        ctx.moveTo(8, 10);
        ctx.lineTo(28, 8);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(30, 8, 5 + Math.min(2, weaponPlus * 0.2), 0, Math.PI * 2);
        ctx.fill();
      } else if (jobId === 'rogue') {
        // Twin Plasma Daggers
        ctx.beginPath();
        ctx.moveTo(8, -10);
        ctx.lineTo(26, -13);
        ctx.moveTo(8, 10);
        ctx.lineTo(26, 13);
        ctx.stroke();
      } else {
        // Sweeping Neon Blade
        ctx.beginPath();
        ctx.moveTo(8, 10);
        ctx.lineTo(34, 4);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(12, 9);
        ctx.lineTo(32, 4.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  _drawPlayer(ctx, player) {
    const st = player.getStats();
    this._drawCharacterFigurine(ctx, {
      x: player.x,
      y: player.y,
      facing: player.facing,
      jobId: player.jobId,
      weaponColor: st.weaponColor,
      weaponPlus: st.weaponPlus,
      hitFlash: player.hitFlash,
      downed: player.downed,
      overclock: player.statuses.overclock > 0 || player.statuses.shrineAtk > 0,
      walkPhase: player.walkPhase,
    });

    if (player.downed) {
      ctx.save();
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 26 + Math.sin(this.time * 8) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '900 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fecdd3';
      ctx.fillText(`🆘 SOS (${Math.ceil(player.downedTimer)}s)`, player.x, player.y - 30);
      ctx.restore();
    }
  }

  _drawDrone(ctx, drone, level = 1) {
    ctx.save();
    // Firing Laser Line
    if (drone.beamTarget) {
      ctx.strokeStyle = '#38f8d4';
      ctx.shadowColor = '#38f8d4';
      ctx.shadowBlur = 12;
      ctx.lineWidth = level >= 4 ? 3.2 : 2;
      ctx.beginPath();
      ctx.moveTo(drone.x, drone.y);
      ctx.lineTo(drone.beamTarget.x, drone.beamTarget.y);
      ctx.stroke();
    }

    // Floating Octagonal Support Drone Body
    ctx.translate(drone.x, drone.y);
    ctx.rotate(drone.angle);
    const col = level >= 5 ? '#fbbf24' : '#38f8d4';
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = 9;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawRemotePlayers(ctx, game) {
    for (const rp of game.network.remotePlayers.values()) {
      if (rp.areaId !== game.currentAreaId) continue;

      this._drawCharacterFigurine(ctx, {
        x: rp.x,
        y: rp.y,
        facing: rp.facing,
        jobId: rp.jobId,
        weaponColor: rp.weaponColor,
        weaponPlus: rp.weaponPlus,
        downed: rp.downed,
      });

      // Remote Drone
      this._drawDrone(ctx, { x: rp.droneX, y: rp.droneY, angle: this.time * 2.2 }, 2);

      // Name, Job & HP Bar above remote player
      ctx.save();
      const job = JOBS[rp.jobId] || JOBS.knight;
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText(`${rp.name} [Lv.${rp.level} ${job.badge}]`, rp.x, rp.y - 32);

      const bw = 46;
      const ratio = Math.max(0, Math.min(1, rp.hp / Math.max(1, rp.maxHp)));
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(rp.x - bw * 0.5, rp.y - 26, bw, 5);
      ctx.fillStyle = rp.downed ? '#ef4444' : '#38bdf8';
      ctx.fillRect(rp.x - bw * 0.5, rp.y - 26, bw * ratio, 5);

      // Downed Rescue Ring!
      if (rp.downed) {
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 28, 0, Math.PI * 2);
        ctx.stroke();

        if (rp.reviveProgress > 0) {
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, 33, -Math.PI / 2, -Math.PI / 2 + rp.reviveProgress * Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#fde047';
        ctx.font = '900 11px sans-serif';
        ctx.fillText('🆘 長押しで蘇生！', rp.x, rp.y - 44);
      }
      ctx.restore();
    }
  }

  _drawEnemies(ctx, enemies) {
    for (const e of enemies) {
      if (!e.alive) continue;
      ctx.save();
      const bob = Math.sin(e.animPhase) * 3;

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.radius * 0.72, e.radius * 0.9, e.radius * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();

      // Charge Windup Indicator
      if (e.chargeWindup > 0) {
        ctx.strokeStyle = '#ff2e54';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.translate(e.x, e.y + bob);
      const fillCol = e.hitFlash > 0 ? '#ffffff' : e.statuses.freeze > 0 ? '#7dd3fc' : e.def.color;
      ctx.fillStyle = fillCol;
      ctx.strokeStyle = e.def.accent;
      ctx.shadowColor = fillCol;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.4;

      const r = e.radius;
      ctx.beginPath();
      if (e.def.shape === 'diamond') {
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.9, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.9, 0);
      } else if (e.def.shape === 'hex') {
        for (let i = 0; i < 6; i++) {
          const a = e.animPhase * 0.25 + (i / 6) * Math.PI * 2;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
      } else if (e.def.shape === 'tri') {
        ctx.rotate(e.facing);
        ctx.moveTo(r * 1.15, 0);
        ctx.lineTo(-r * 0.85, -r * 0.85);
        ctx.lineTo(-r * 0.85, r * 0.85);
      } else if (e.def.shape === 'square') {
        ctx.roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, 6);
      } else {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing Eye Core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#09101d';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(2, -1, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Status Badges & Mini HP Bar
      if (e.hp < e.maxHp || e.statuses.burn > 0 || e.statuses.freeze > 0 || e.statuses.paralyze > 0) {
        const bw = 38;
        ctx.fillStyle = 'rgba(0,0,0,0.68)';
        ctx.fillRect(e.x - bw * 0.5, e.y - e.radius - 14, bw, 5);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(e.x - bw * 0.5, e.y - e.radius - 14, bw * (e.hp / e.maxHp), 5);
      }
      if (e.statuses.burn > 0) this._drawMiniIcon(ctx, e.x - 12, e.y - e.radius - 22, '🔥');
      if (e.statuses.freeze > 0) this._drawMiniIcon(ctx, e.x, e.y - e.radius - 22, '❄️');
      if (e.statuses.paralyze > 0) this._drawMiniIcon(ctx, e.x + 12, e.y - e.radius - 22, '⚡');
    }
  }

  _drawMiniIcon(ctx, x, y, txt) {
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(txt, x, y);
  }

  _drawTelegraphs(ctx, game) {
    if (!game.boss || !game.boss.alive) return;
    for (const tg of game.boss.telegraphs) {
      const progress = Math.min(1, tg.timer / tg.chargeTime);
      const firing = tg.timer >= tg.chargeTime;

      ctx.save();
      if (tg.type === 'circle') {
        if (!firing) {
          ctx.fillStyle = `rgba(239, 68, 68, ${0.14 + progress * 0.24})`;
          ctx.beginPath();
          ctx.arc(tg.x, tg.y, tg.radius, 0, Math.PI * 2);
          ctx.fill();

          // Expanding inner charge circle
          ctx.fillStyle = 'rgba(255, 46, 84, 0.34)';
          ctx.beginPath();
          ctx.arc(tg.x, tg.y, tg.radius * progress, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ff2e54';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.arc(tg.x, tg.y, tg.radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Blazing Impact Eruption!
          ctx.fillStyle = 'rgba(255, 237, 213, 0.82)';
          ctx.shadowColor = '#ff2e54';
          ctx.shadowBlur = 28;
          ctx.beginPath();
          ctx.arc(tg.x, tg.y, tg.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (tg.type === 'laser') {
        const ex = tg.x + Math.cos(tg.angle) * tg.length;
        const ey = tg.y + Math.sin(tg.angle) * tg.length;
        if (!firing) {
          ctx.strokeStyle = `rgba(255, 46, 84, ${0.4 + progress * 0.6})`;
          ctx.setLineDash([12, 8]);
          ctx.lineWidth = 3 + progress * 4;
          ctx.beginPath();
          ctx.moveTo(tg.x, tg.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#ff2e54';
          ctx.shadowColor = '#ff2e54';
          ctx.shadowBlur = 26;
          ctx.lineWidth = tg.width;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tg.x, tg.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = tg.width * 0.42;
          ctx.beginPath();
          ctx.moveTo(tg.x, tg.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  _drawBoss(ctx, boss) {
    ctx.save();

    // 1. Guardian Crystals + Tether Beams to Boss Shield
    for (const c of boss.crystals) {
      if (c.hp <= 0) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.65)';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(boss.x, boss.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Crystal Geometry
      const bob = Math.sin(this.time * 4 + c.orbitAngle) * 4;
      ctx.fillStyle = c.hitFlash > 0 ? '#ffffff' : '#38bdf8';
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 22 + bob);
      ctx.lineTo(c.x + 15, c.y + bob);
      ctx.lineTo(c.x, c.y + 22 + bob);
      ctx.lineTo(c.x - 15, c.y + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Crystal HP Bar
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(c.x - 20, c.y - 30, 40, 5);
      ctx.fillStyle = '#38f8d4';
      ctx.fillRect(c.x - 20, c.y - 30, 40 * (c.hp / c.maxHp), 5);
      ctx.restore();
    }

    // 2. Boss Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(boss.x, boss.y + boss.radius * 0.85, boss.radius * 1.1, boss.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Phase 2 Overdrive Crimson-Gold Aura
    if (boss.phase === 2) {
      ctx.save();
      ctx.strokeStyle = '#ff2e54';
      ctx.shadowColor = '#ff2e54';
      ctx.shadowBlur = 26;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, boss.radius + 18 + Math.sin(this.time * 12) * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Boss Main Mechanical Vector Rig
    const bob = Math.sin(boss.animPhase) * 5;
    ctx.translate(boss.x, boss.y + bob);

    // Outer rotating cyber wings / halo ring
    ctx.save();
    ctx.rotate(this.time * (boss.phase === 2 ? 2.4 : 1.1));
    ctx.strokeStyle = boss.def.accent;
    ctx.shadowColor = boss.def.color;
    ctx.shadowBlur = 22;
    ctx.lineWidth = 3.5;
    const r = boss.radius;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r * 0.72), Math.sin(a) * (r * 0.72));
      ctx.lineTo(Math.cos(a) * (r * 1.24), Math.sin(a) * (r * 1.24));
      ctx.stroke();
    }
    ctx.restore();

    // Armored Core Octagon
    ctx.fillStyle = boss.hitFlash > 0 ? '#ffffff' : '#111827';
    ctx.strokeStyle = boss.phase === 2 ? '#ff2e54' : boss.def.color;
    ctx.shadowColor = boss.phase === 2 ? '#ff2e54' : boss.def.color;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Reactor Eye
    ctx.fillStyle = boss.stunTimer > 0 ? '#fde047' : boss.def.color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.cos(boss.facing) * 6, Math.sin(boss.facing) * 6, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Invulnerable Hex Shield Overlay
    if (boss.isShielded()) {
      ctx.strokeStyle = '#67e8f9';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawDrops(ctx, drops) {
    for (const d of drops) {
      if (d.collected) continue;
      const bob = Math.sin(this.time * 5 + d.x) * 4;
      ctx.save();

      // Epic / Legendary Loot Light Pillar Beam!
      if (d.type === 'weapon' || d.type === 'armor' || d.type === 'core') {
        const beamCol = d.rarity ? (RARITY_INFO[d.rarity]?.color || d.color) : d.color;
        const g = ctx.createLinearGradient(d.x, d.y, d.x, d.y - 78);
        g.addColorStop(0, `${beamCol}cc`);
        g.addColorStop(1, `${beamCol}00`);
        ctx.fillStyle = g;
        ctx.fillRect(d.x - 7, d.y - 78, 14, 78);
      }

      ctx.shadowColor = d.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      if (d.type === 'gold') {
        ctx.arc(d.x, d.y + bob, 6.5, 0, Math.PI * 2);
      } else {
        ctx.moveTo(d.x, d.y - 10 + bob);
        ctx.lineTo(d.x + 8, d.y + bob);
        ctx.lineTo(d.x, d.y + 10 + bob);
        ctx.lineTo(d.x - 8, d.y + bob);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
  }

  _drawAfterimages(ctx, afterimages) {
    for (const a of afterimages) {
      ctx.save();
      ctx.globalAlpha = a.alpha * 0.45;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawSlashes(ctx, slashes) {
    for (const s of slashes) {
      const ratio = s.life / s.maxLife;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 18;
      ctx.globalAlpha = ratio;
      ctx.lineWidth = (12 + (s.weaponPlus || 0) * 1.4) * ratio;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, s.angle - s.arc * 0.5, s.angle + s.arc * 0.5);
      ctx.stroke();

      // White hot inner slash edge
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4 * ratio;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, s.angle - s.arc * 0.46, s.angle + s.arc * 0.46);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawProjectiles(ctx, projectiles) {
    for (const pr of projectiles) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = pr.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawParticles(ctx, particles) {
    for (const pt of particles) {
      const ratio = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = ratio;
      if (pt.ring) {
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3 * ratio;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size + (1 - ratio) * pt.expand, 0, Math.PI * 2);
        ctx.stroke();
      } else if (pt.lightning) {
        ctx.strokeStyle = pt.color;
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3 * ratio;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        const mx = (pt.x + pt.tx) * 0.5 + (Math.random() - 0.5) * 26;
        const my = (pt.y + pt.ty) * 0.5 + (Math.random() - 0.5) * 26;
        ctx.lineTo(mx, my);
        ctx.lineTo(pt.tx, pt.ty);
        ctx.stroke();
      } else {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * ratio, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawSpeechBubbles(ctx, game) {
    const drawBubble = (x, y, text) => {
      ctx.save();
      ctx.font = '800 12px "Hiragino Kaku Gothic ProN", sans-serif';
      const tw = ctx.measureText(text).width;
      const bw = tw + 20;
      const bh = 26;
      const bx = x - bw * 0.5;
      const by = y - 58;

      ctx.fillStyle = 'rgba(7, 17, 34, 0.92)';
      ctx.strokeStyle = '#38f8d4';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, by + bh * 0.5);
      ctx.restore();
    };

    if (game.player.chatBubble) {
      drawBubble(game.player.x, game.player.y, game.player.chatBubble.text);
    }
    for (const rp of game.network.remotePlayers.values()) {
      if (rp.areaId === game.currentAreaId && rp.chatBubble) {
        drawBubble(rp.x, rp.y - 12, rp.chatBubble.text);
      }
    }
  }

  _drawDamageTexts(ctx, texts) {
    for (const t of texts) {
      const ratio = Math.max(0, t.life / t.maxLife);
      ctx.save();
      ctx.globalAlpha = Math.min(1, ratio * 1.4);
      const size = Math.round(15 * (t.scale || 1));
      ctx.font = `900 ${size}px ui-monospace, "Hiragino Kaku Gothic ProN", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  // ==========================================================================
  // DYNAMIC DARKNESS MASK (AREA 2: OBSIDIAN CRYSTAL CAVERN)
  // ==========================================================================
  _renderDarknessMask(ctx, game, camX, camY) {
    const lc = this.lightCanvas;
    const lctx = this.lctx;
    const sx = lc.width / this.width;
    const sy = lc.height / this.height;
    const ox = this.width * 0.5 - camX;
    const oy = this.height * 0.5 - camY;

    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lc.width, lc.height);
    lctx.fillStyle = 'rgba(2, 6, 16, 0.90)';
    lctx.fillRect(0, 0, lc.width, lc.height);

    lctx.globalCompositeOperation = 'destination-out';
    const punchLight = (wx, wy, radius) => {
      const lx = (wx + ox) * sx;
      const ly = (wy + oy) * sy;
      const lr = radius * sx;
      if (lx + lr < 0 || ly + lr < 0 || lx - lr > lc.width || ly - lr > lc.height) return;
      const g = lctx.createRadialGradient(lx, ly, lr * 0.14, lx, ly, lr);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.72)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.arc(lx, ly, lr, 0, Math.PI * 2);
      lctx.fill();
    };

    // Player & Support Drone vision halo
    punchLight(game.player.x, game.player.y, 240);
    punchLight(game.player.drone.x, game.player.drone.y, 120);

    // Co-op Teammates illuminate cave too!
    for (const rp of game.network.remotePlayers.values()) {
      if (rp.areaId === game.currentAreaId) {
        punchLight(rp.x, rp.y, 210);
      }
    }
    // Map Ambient Crystal Torches
    for (const l of game.map.lights) {
      punchLight(l.x, l.y, l.radius);
    }
    // Glowing Projectiles & Boss
    for (const pr of game.projectiles) {
      punchLight(pr.x, pr.y, 85);
    }
    if (game.boss && game.boss.alive) {
      punchLight(game.boss.x, game.boss.y, 210);
      for (const c of game.boss.crystals) {
        if (c.hp > 0) punchLight(c.x, c.y, 120);
      }
    }

    ctx.drawImage(lc, 0, 0, this.width, this.height);
  }

  // ==========================================================================
  // ZONE ENVIRONMENTAL PARTICLES
  // ==========================================================================
  _updateAndDrawEnvParticles(ctx, dt, type, pal) {
    const w = this.width;
    const h = this.height;
    ctx.save();
    for (const p of this.envParticles) {
      p.phase += dt * 2.4;
      p.x += (p.vx + Math.sin(p.phase) * 10) * dt;
      p.y += p.vy * dt;

      if (p.x < -40) p.x = w + 30;
      if (p.x > w + 40) p.x = -30;
      if (p.y < -40) p.y = h + 30;
      if (p.y > h + 40) p.y = -30;

      ctx.globalAlpha = p.alpha * (0.65 + 0.35 * Math.sin(p.phase));

      if (type === 'spores') {
        ctx.fillStyle = p.hue > 0.5 ? '#6ee7b7' : '#fef08a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'mist') {
        if (p.isDrop) {
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + 10);
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(148, 197, 255, 0.10)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'data') {
        ctx.fillStyle = p.hue > 0.4 ? '#22d3ee' : '#fbbf24';
        ctx.fillRect(p.x, p.y, p.size * 0.9, p.size * 2.2);
      } else if (type === 'embers') {
        ctx.fillStyle = p.hue > 0.45 ? '#fb923c' : '#fde047';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.85, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'aurora' || type === 'stars') {
        ctx.fillStyle = p.hue > 0.5 ? '#f472b6' : '#38f8d4';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size);
        ctx.lineTo(p.x + p.size * 0.7, p.y);
        ctx.lineTo(p.x, p.y + p.size);
        ctx.lineTo(p.x - p.size * 0.7, p.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = p.hue > 0.5 ? pal.neon : pal.neonAlt;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ==========================================================================
  // LIVE MINIMAP RENDERER
  // ==========================================================================
  _renderMinimap(game) {
    const mctx = this.mctx;
    if (!mctx) return;
    const map = game.map;
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;

    mctx.fillStyle = '#040a16';
    mctx.fillRect(0, 0, mw, mh);

    const sx = mw / map.width;
    const sy = mh / map.height;

    // Terrain Tiles
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const t = getTile(map, tx, ty);
        if (t === TILE.VOID) continue;
        if (t === TILE.WALL || t === TILE.CRACKED) {
          mctx.fillStyle = t === TILE.CRACKED ? '#b45309' : '#263c5e';
        } else if (t === TILE.WATER) {
          mctx.fillStyle = '#0c4a6e';
        } else if (t === TILE.GATE || t === TILE.BOSS_GATE) {
          mctx.fillStyle = '#ef4444';
        } else if (t === TILE.BOSS_FLOOR) {
          mctx.fillStyle = '#3b1d52';
        } else {
          mctx.fillStyle = '#152a45';
        }
        mctx.fillRect(tx * sx, ty * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }

    const toM = (wx, wy) => ({ x: (wx / map.pixelWidth) * mw, y: (wy / map.pixelHeight) * mh });

    // Portals (Cyan Rings)
    for (const pt of map.portals) {
      const p = toM(pt.x, pt.y);
      mctx.fillStyle = '#22d3ee';
      mctx.beginPath();
      mctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      mctx.fill();
    }

    // Unopened Chests (Gold Dots)
    for (const ch of map.chests) {
      if (ch.opened) continue;
      const p = toM(ch.x, ch.y);
      mctx.fillStyle = '#fbbf24';
      mctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }

    // NPCs (Emerald Dots)
    for (const n of map.npcs) {
      const p = toM(n.x, n.y);
      mctx.fillStyle = '#a7f3d0';
      mctx.beginPath();
      mctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
      mctx.fill();
    }

    // Boss Indicator (Crimson Diamond)
    if (map.bossArena && !game.progress.defeatedBosses.has(map.bossArena.bossId)) {
      const bPos = game.boss && game.boss.alive ? game.boss : map.bossArena.center;
      const p = toM(bPos.x, bPos.y);
      mctx.fillStyle = '#fb7185';
      mctx.beginPath();
      mctx.moveTo(p.x, p.y - 4.5);
      mctx.lineTo(p.x + 4.5, p.y);
      mctx.lineTo(p.x, p.y + 4.5);
      mctx.lineTo(p.x - 4.5, p.y);
      mctx.closePath();
      mctx.fill();
    }

    // Remote Co-op Allies (Sky Blue Dots)
    for (const rp of game.network.remotePlayers.values()) {
      if (rp.areaId !== game.currentAreaId) continue;
      const p = toM(rp.x, rp.y);
      mctx.fillStyle = rp.downed ? '#ff2e54' : '#38bdf8';
      mctx.beginPath();
      mctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      mctx.fill();
    }

    // Local Player (Bright Mint Dot w/ White Ring)
    const lp = toM(game.player.x, game.player.y);
    mctx.fillStyle = '#38f8d4';
    mctx.strokeStyle = '#ffffff';
    mctx.lineWidth = 1.2;
    mctx.beginPath();
    mctx.arc(lp.x, lp.y, 3.6, 0, Math.PI * 2);
    mctx.fill();
    mctx.stroke();
  }
}
