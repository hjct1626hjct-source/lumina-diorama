import * as THREE from 'three';

export interface ProceduralTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

/**
 * Deterministic PRNG for repeatable painterly brushstroke textures.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthesizes a tangent-space NormalMap from any height/luminance Canvas using a Sobel kernel.
 */
function generateNormalMapFromCanvas(source: HTMLCanvasElement, strength = 2.4): THREE.CanvasTexture {
  const w = source.width;
  const h = source.height;
  const srcCtx = source.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const luma = (x: number, y: number): number => {
    const cx = ((x % w) + w) % w;
    const cy = ((y % h) + h) % h;
    const idx = (cy * w + cx) * 4;
    return (srcData[idx] * 0.299 + srcData[idx + 1] * 0.587 + srcData[idx + 2] * 0.114) / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = luma(x - 1, y - 1);
      const t = luma(x, y - 1);
      const tr = luma(x + 1, y - 1);
      const l = luma(x - 1, y);
      const r = luma(x + 1, y);
      const bl = luma(x - 1, y + 1);
      const b = luma(x, y + 1);
      const br = luma(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);

  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function finalizeTexture(canvas: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * High-resolution (512x512) watercolor/gouache procedural texture bank.
 * Eliminates flat solid colors everywhere by baking brushstroke noise, subtle hue jitter,
 * edge wear, Jomon Sheikah relief spirals, stonework mortar, wood grain, and anime faces.
 */
export class ProceduralTextureBank {
  private cache = new Map<string, ProceduralTextureSet>();
  private plainCache = new Map<string, THREE.CanvasTexture>();

  private getOrCreate(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, normalStrength = 2.2): ProceduralTextureSet {
    const existing = this.cache.get(key);
    if (existing) return existing;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    draw(ctx, size, size);
    const set: ProceduralTextureSet = {
      map: finalizeTexture(canvas, true),
      normalMap: generateNormalMapFromCanvas(canvas, normalStrength),
    };
    this.cache.set(key, set);
    return set;
  }

  getGrassTexture(): ProceduralTextureSet {
    return this.getOrCreate('grass', 512, (ctx, w, h) => {
      const rand = mulberry32(101);
      ctx.fillStyle = '#6da64a';
      ctx.fillRect(0, 0, w, h);

      // Soft watercolor pigment washes
      for (let i = 0; i < 180; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 24 + rand() * 68;
        const hue = 84 + rand() * 28;
        const light = 42 + rand() * 18;
        const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
        grad.addColorStop(0, `hsla(${hue}, 44%, ${light}%, 0.22)`);
        grad.addColorStop(1, `hsla(${hue}, 44%, ${light}%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Gouache painterly blade strokes
      for (let i = 0; i < 1800; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const len = 8 + rand() * 18;
        const ang = -Math.PI * 0.5 + (rand() - 0.5) * 0.7;
        const hue = 78 + rand() * 34;
        const light = 35 + rand() * 30;
        ctx.strokeStyle = `hsla(${hue}, 48%, ${light}%, ${0.35 + rand() * 0.45})`;
        ctx.lineWidth = 1.2 + rand() * 2.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        ctx.stroke();
      }

      // Scattered tiny Hyrule wildflower specks
      for (let i = 0; i < 65; i++) {
        const x = rand() * w;
        const y = rand() * h;
        ctx.fillStyle = rand() > 0.4 ? 'rgba(248, 240, 175, 0.72)' : 'rgba(185, 228, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + rand() * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 1.8);
  }

  getCliffTexture(): ProceduralTextureSet {
    return this.getOrCreate('cliff', 512, (ctx, w, h) => {
      const rand = mulberry32(202);
      ctx.fillStyle = '#7e776c';
      ctx.fillRect(0, 0, w, h);

      // Sedimentary strata bands
      for (let y = 0; y < h; y += 16) {
        const shade = 95 + Math.floor(rand() * 44);
        ctx.fillStyle = `rgb(${shade + 8}, ${shade + 2}, ${shade - 8})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) {
          ctx.lineTo(x, y + Math.sin(x * 0.03 + y * 0.1) * 5 + (rand() - 0.5) * 4);
        }
        ctx.lineTo(w, y + 20);
        ctx.lineTo(0, y + 20);
        ctx.closePath();
        ctx.fill();
      }

      // Gouache faceted rock planes & crevice lines
      for (let i = 0; i < 420; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const rw = 16 + rand() * 44;
        const rh = 8 + rand() * 22;
        const v = 80 + rand() * 75;
        ctx.fillStyle = `rgba(${v + 8}, ${v + 2}, ${v - 8}, 0.35)`;
        ctx.fillRect(x, y, rw, rh);
      }
      ctx.strokeStyle = 'rgba(42, 38, 36, 0.48)';
      for (let i = 0; i < 140; i++) {
        const x = rand() * w;
        const y = rand() * h;
        ctx.lineWidth = 1 + rand() * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 60, y + (rand() - 0.5) * 24);
        ctx.stroke();
      }
    }, 3.6);
  }

  getSandTexture(): ProceduralTextureSet {
    return this.getOrCreate('sand', 512, (ctx, w, h) => {
      const rand = mulberry32(303);
      ctx.fillStyle = '#d9b574';
      ctx.fillRect(0, 0, w, h);

      // Wind-swept Gerudo dune ripples
      for (let y = 0; y < h; y += 10) {
        ctx.strokeStyle = y % 20 === 0 ? 'rgba(255, 236, 185, 0.42)' : 'rgba(176, 130, 68, 0.34)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const yy = y + Math.sin(x * 0.045 + y * 0.06) * 4;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }

      for (let i = 0; i < 900; i++) {
        const x = rand() * w;
        const y = rand() * h;
        ctx.fillStyle = rand() > 0.5 ? 'rgba(255,244,210,0.32)' : 'rgba(165,118,58,0.28)';
        ctx.fillRect(x, y, 2 + rand() * 3, 2);
      }
    }, 1.5);
  }

  getSnowTexture(): ProceduralTextureSet {
    return this.getOrCreate('snow', 512, (ctx, w, h) => {
      const rand = mulberry32(404);
      ctx.fillStyle = '#e8f1fa';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 240; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 18 + rand() * 54;
        const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
        grad.addColorStop(0, rand() > 0.5 ? 'rgba(255,255,255,0.45)' : 'rgba(182,210,240,0.32)');
        grad.addColorStop(1, 'rgba(232,241,250,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Subtle crystalline sparkles
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(rand() * w, rand() * h, 2, 2);
      }
    }, 1.2);
  }

  getVolcanicTexture(): ProceduralTextureSet {
    return this.getOrCreate('volcanic', 512, (ctx, w, h) => {
      const rand = mulberry32(505);
      ctx.fillStyle = '#473e3d';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 480; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const v = 42 + rand() * 48;
        ctx.fillStyle = `rgba(${v + 16}, ${v + 4}, ${v}, 0.55)`;
        ctx.beginPath();
        ctx.arc(x, y, 6 + rand() * 20, 0, Math.PI * 2);
        ctx.fill();
      }
      // Warm iron-oxide streaks
      for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = 'rgba(130, 56, 36, 0.35)';
        ctx.lineWidth = 2 + rand() * 3;
        const x = rand() * w;
        const y = rand() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 70, y + (rand() - 0.5) * 40);
        ctx.stroke();
      }
    }, 3.5);
  }

  /**
   * Ancient Sheikah Jomon-inspired spiral relief + glowing constellation circuit texture!
   */
  getSheikahStoneTexture(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
    const base = this.getOrCreate('sheikah_stone', 512, (ctx, w, h) => {
      const rand = mulberry32(606);
      ctx.fillStyle = '#383d46';
      ctx.fillRect(0, 0, w, h);

      // Brushed dark basalt slate blocks
      for (let i = 0; i < 360; i++) {
        const v = 44 + rand() * 34;
        ctx.fillStyle = `rgba(${v}, ${v + 4}, ${v + 12}, 0.36)`;
        ctx.fillRect(rand() * w, rand() * h, 14 + rand() * 44, 10 + rand() * 28);
      }

      // Carved Jomon spiral reliefs & constellation channels
      ctx.strokeStyle = '#20242c';
      ctx.lineWidth = 6;
      for (let gy = 64; gy < h; gy += 128) {
        for (let gx = 64; gx < w; gx += 128) {
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 4.5; a += 0.25) {
            const rad = 6 + a * 3.1;
            const px = gx + Math.cos(a) * rad;
            const py = gy + Math.sin(a) * rad;
            if (a === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }

      // Horizontal carved trim bands
      ctx.strokeStyle = '#5c6370';
      ctx.lineWidth = 3;
      for (let y = 0; y < h; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }, 4.0);

    let emissiveMap = this.plainCache.get('sheikah_emissive');
    if (!emissiveMap) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 512, 512);

      // Glowing Jomon circuit lines & Sheikah eye constellation nodes
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 4;
      for (let gy = 64; gy < 512; gy += 128) {
        for (let gx = 64; gx < 512; gx += 128) {
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 4.0; a += 0.28) {
            const rad = 5 + a * 3.0;
            const px = gx + Math.cos(a) * rad;
            const py = gy + Math.sin(a) * rad;
            if (a === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          // Glowing node dot
          ctx.beginPath();
          ctx.arc(gx, gy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Vertical & horizontal circuit traces
      ctx.lineWidth = 3;
      for (let x = 0; x < 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x + 64, 0);
        ctx.lineTo(x + 64, 512);
        ctx.stroke();
      }
      emissiveMap = finalizeTexture(canvas, true);
      this.plainCache.set('sheikah_emissive', emissiveMap);
    }

    return { ...base, emissiveMap };
  }

  getStoneMasonryTexture(baseHex = '#9a968b', mossTint = '#5f7e46'): ProceduralTextureSet {
    return this.getOrCreate(`stone_${baseHex}_${mossTint}`, 512, (ctx, w, h) => {
      const rand = mulberry32(707 + baseHex.length * 13);
      ctx.fillStyle = '#534f49';
      ctx.fillRect(0, 0, w, h);

      const rows = 8;
      const rowH = h / rows;
      for (let r = 0; r < rows; r++) {
        const cols = 4 + (r % 2);
        const offset = (r % 2) * 32;
        const colW = w / cols;
        for (let c = -1; c <= cols; c++) {
          const bx = c * colW + offset;
          const by = r * rowH;
          const shade = 0.85 + rand() * 0.28;
          const col = new THREE.Color(baseHex).multiplyScalar(shade);
          ctx.fillStyle = `#${col.getHexString()}`;
          ctx.fillRect(bx + 3, by + 3, colW - 6, rowH - 6);
          // Edge highlight & wear
          ctx.strokeStyle = 'rgba(255,250,240,0.22)';
          ctx.lineWidth = 2;
          ctx.strokeRect(bx + 4, by + 4, colW - 8, rowH - 8);
        }
      }

      // Weathering & moss dabs
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = rand() > 0.65 ? `${mossTint}55` : 'rgba(38, 35, 32, 0.16)';
        ctx.beginPath();
        ctx.arc(rand() * w, rand() * h, 4 + rand() * 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 3.2);
  }

  getWoodPlankTexture(baseHex = '#7c5334'): ProceduralTextureSet {
    return this.getOrCreate(`wood_${baseHex}`, 512, (ctx, w, h) => {
      const rand = mulberry32(808);
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, w, h);

      // Wood grain fibers
      for (let y = 0; y < h; y += 3) {
        const alpha = 0.08 + rand() * 0.18;
        ctx.strokeStyle = rand() > 0.5 ? `rgba(38, 22, 10, ${alpha})` : `rgba(180, 132, 84, ${alpha})`;
        ctx.lineWidth = 1 + rand() * 2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 24) {
          const yy = y + Math.sin(x * 0.03 + y * 0.02) * 2.5;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }

      // Plank seams & iron nail studs
      ctx.strokeStyle = 'rgba(24, 14, 8, 0.65)';
      ctx.lineWidth = 3;
      for (let y = 0; y < h; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }, 2.4);
  }

  getFabricTexture(baseHex = '#2e88b8', accentHex = '#e6c87a', pattern: 'champion' | 'weave' | 'gerudo' | 'sheikah' = 'weave'): ProceduralTextureSet {
    const size = pattern === 'champion' ? 1024 : 512;
    return this.getOrCreate(`fabric_v2_${baseHex}_${accentHex}_${pattern}`, size, (ctx, w, h) => {
      const rand = mulberry32(909);
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, w, h);

      // Soft painterly cloth tonal variation (prevents plastic flatness)
      for (let i = 0; i < (pattern === 'champion' ? 120 : 60); i++) {
        const rx = rand() * w;
        const ry = rand() * h;
        const rad = 28 + rand() * (w * 0.14);
        const grad = ctx.createRadialGradient(rx, ry, 2, rx, ry, rad);
        grad.addColorStop(0, rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(12,24,42,0.08)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(rx, ry, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fine cross-hatched linen weave
      const threads = pattern === 'champion' ? 1400 : 650;
      for (let i = 0; i < threads; i++) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.065)' : 'rgba(0,0,0,0.085)';
        ctx.fillRect(rand() * w, rand() * h, 18 + rand() * 38, 2);
        ctx.fillRect(rand() * w, rand() * h, 2, 18 + rand() * 38);
      }

      if (pattern === 'champion') {
        // Authentic BotW Champion's Tunic (1024x1024): embroidered collar, bottom hem motif, and Master Sword chest crest!
        // Bottom cream & gold geometric Hylian embroidery band
        ctx.fillStyle = '#f5ecd6';
        ctx.fillRect(0, h - 76, w, 38);
        ctx.fillStyle = accentHex;
        ctx.fillRect(0, h - 88, w, 12);
        ctx.fillRect(0, h - 38, w, 10);
        // Collar gold & ivory trim band
        ctx.fillStyle = '#f5ecd6';
        ctx.fillRect(0, 18, w, 18);
        ctx.fillStyle = accentHex;
        ctx.fillRect(0, 36, w, 10);

        // Diamond + dot motifs along hem
        ctx.fillStyle = baseHex;
        for (let x = 24; x < w; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, h - 71);
          ctx.lineTo(x + 14, h - 57);
          ctx.lineTo(x, h - 43);
          ctx.lineTo(x - 14, h - 57);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = accentHex;
          ctx.beginPath();
          ctx.arc(x, h - 57, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = baseHex;
        }

        // Centered iconic BotW Master Sword embroidery on chest (aligned cleanly at u = 0.5!)
        const cx = w * 0.5;
        const cy = h * 0.42;

        // Flanking Hylian scroll curves
        ctx.strokeStyle = 'rgba(246, 249, 255, 0.88)';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + side * 26, cy - 115);
          ctx.bezierCurveTo(cx + side * 95, cy - 88, cx + side * 102, cy + 16, cx + side * 34, cy + 88);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(cx + side * 46, cy - 64);
          ctx.quadraticCurveTo(cx + side * 124, cy - 24, cx + side * 70, cy + 44);
          ctx.stroke();
        }

        // Embroidered Master Sword emblem (winged guard + tapered blade + diamond pommel)
        ctx.fillStyle = '#f7faff';
        ctx.strokeStyle = '#dce8f8';
        ctx.lineWidth = 4;
        // Blade
        ctx.beginPath();
        ctx.moveTo(cx, cy + 150);
        ctx.lineTo(cx + 15, cy - 26);
        ctx.lineTo(cx - 15, cy - 26);
        ctx.closePath();
        ctx.fill();
        // Winged crossguard
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + 66, cy - 52);
        ctx.lineTo(cx + 46, cy - 22);
        ctx.lineTo(cx, cy - 38);
        ctx.lineTo(cx - 46, cy - 22);
        ctx.lineTo(cx - 66, cy - 52);
        ctx.closePath();
        ctx.fill();
        // Grip & pommel
        ctx.fillRect(cx - 8, cy - 108, 16, 74);
        ctx.beginPath();
        ctx.moveTo(cx, cy - 134);
        ctx.lineTo(cx + 18, cy - 114);
        ctx.lineTo(cx, cy - 94);
        ctx.lineTo(cx - 18, cy - 114);
        ctx.closePath();
        ctx.fill();
        // Subtle inner blade fuller line
        ctx.strokeStyle = baseHex;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 16);
        ctx.lineTo(cx, cy + 110);
        ctx.stroke();
      } else if (pattern === 'gerudo') {
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 6;
        for (let y = 32; y < h; y += 64) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 32) {
            ctx.lineTo(x, y + (x % 64 === 0 ? -12 : 12));
          }
          ctx.stroke();
        }
      } else if (pattern === 'sheikah') {
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.45, 58, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.60);
        ctx.lineTo(w * 0.5, h * 0.78);
        ctx.stroke();
      }
    }, pattern === 'champion' ? 1.0 : 1.5);
  }

  /**
   * High-resolution Hylian Shield Crest Texture (Royal Blue field, Golden 3-triangle Triforce, Crimson Winged Loftwing, Silver trim).
   */
  getHylianShieldTexture(): THREE.CanvasTexture {
    const key = 'hylian_shield_crest';
    const existing = this.plainCache.get(key);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Deep Royal Hyrule Blue steel gradient
    const bg = ctx.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#1e4b9e');
    bg.addColorStop(1, '#153474');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 512);

    // Ornate Silver outer trim
    ctx.strokeStyle = '#d4dee8';
    ctx.lineWidth = 22;
    ctx.strokeRect(18, 18, 476, 476);

    // Golden 3-Triangle Triforce near top
    const drawTri = (cx: number, cy: number, sz: number) => {
      ctx.fillStyle = '#f6cf4c';
      ctx.beginPath();
      ctx.moveTo(cx, cy - sz * 0.85);
      ctx.lineTo(cx + sz, cy + sz * 0.85);
      ctx.lineTo(cx - sz, cy + sz * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#b8861e';
      ctx.lineWidth = 3;
      ctx.stroke();
    };
    drawTri(256, 128, 36);
    drawTri(220, 190, 36);
    drawTri(292, 190, 36);

    // Crimson Winged Loftwing Emblem across center!
    ctx.fillStyle = '#c82d32';
    ctx.beginPath();
    ctx.moveTo(256, 232);
    ctx.lineTo(278, 286);
    ctx.lineTo(426, 250);
    ctx.lineTo(394, 304);
    ctx.lineTo(314, 326);
    ctx.lineTo(276, 396);
    ctx.lineTo(256, 428);
    ctx.lineTo(236, 396);
    ctx.lineTo(198, 326);
    ctx.lineTo(118, 304);
    ctx.lineTo(86, 250);
    ctx.lineTo(234, 286);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e2a858';
    ctx.lineWidth = 4;
    ctx.stroke();

    const tex = finalizeTexture(canvas, false);
    this.plainCache.set(key, tex);
    return tex;
  }

  /**
   * 1024x1024 High-Definition BotW Anime Face Texture calibrated 1:1 to LinkCharacterModel's
   * distortion-free frontal orthographic-blended head UV projection (center = 512, 512).
   */
  getHeroFaceTexture(skinHex = '#f6d5b2', eyeHex = '#247ee0'): THREE.CanvasTexture {
    const key = `hero_face_hd1024_v3_${skinHex}_${eyeHex}`;
    const existing = this.plainCache.get(key);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // 1. Base warm porcelain-peach BotW skin tone + subtle vertical facial luminance gradient
    ctx.fillStyle = skinHex;
    ctx.fillRect(0, 0, 1024, 1024);

    const skinGrad = ctx.createRadialGradient(512, 490, 60, 512, 540, 420);
    skinGrad.addColorStop(0, 'rgba(255, 245, 232, 0.24)');
    skinGrad.addColorStop(0.55, 'rgba(246, 213, 178, 0.0)');
    skinGrad.addColorStop(1, 'rgba(196, 138, 104, 0.24)');
    ctx.fillStyle = skinGrad;
    ctx.fillRect(140, 140, 744, 780);

    // Subtle soft bangs shadow along upper forehead
    const browShad = ctx.createLinearGradient(0, 210, 0, 415);
    browShad.addColorStop(0, 'rgba(182, 126, 92, 0.28)');
    browShad.addColorStop(1, 'rgba(182, 126, 92, 0)');
    ctx.fillStyle = browShad;
    ctx.fillRect(220, 210, 584, 205);

    // Warm subtle jawline contour shadow near lower chin
    const chinShad = ctx.createRadialGradient(512, 835, 10, 512, 835, 165);
    chinShad.addColorStop(0, 'rgba(196, 134, 102, 0.22)');
    chinShad.addColorStop(1, 'rgba(196, 134, 102, 0)');
    ctx.fillStyle = chinShad;
    ctx.beginPath();
    ctx.arc(512, 835, 165, 0, Math.PI * 2);
    ctx.fill();

    // Soft anime peach-rose cheek blush
    for (const cx of [356, 668]) {
      const blush = ctx.createRadialGradient(cx, 602, 6, cx, 602, 74);
      blush.addColorStop(0, 'rgba(238, 136, 118, 0.34)');
      blush.addColorStop(0.6, 'rgba(238, 136, 118, 0.12)');
      blush.addColorStop(1, 'rgba(238, 136, 118, 0)');
      ctx.fillStyle = blush;
      ctx.beginPath();
      ctx.ellipse(cx, 602, 74, 46, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Crisp BotW Almond Hero Eyes (centered at x=410 & x=614, y=520)
    const drawBotWEye = (cx: number, flip: number) => {
      ctx.save();
      ctx.translate(cx, 520);
      ctx.scale(flip, 1);

      // Subtle warm eye-socket shading under upper eyelid
      const sock = ctx.createLinearGradient(0, -46, 0, 20);
      sock.addColorStop(0, 'rgba(170, 114, 84, 0.25)');
      sock.addColorStop(1, 'rgba(170, 114, 84, 0)');
      ctx.fillStyle = sock;
      ctx.beginPath();
      ctx.ellipse(0, -14, 62, 34, -0.06, 0, Math.PI * 2);
      ctx.fill();

      // Almond-shaped eye aperture clipping path (authentic BotW sharp hero eyes!)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-58, 2); // outer corner
      ctx.bezierCurveTo(-36, -38, 26, -38, 52, -4); // upper lid arch
      ctx.bezierCurveTo(26, 30, -32, 32, -58, 2); // lower lid curve
      ctx.closePath();
      ctx.clip();

      // Crisp warm-white sclera with delicate upper-lid cast shadow
      const sclGrad = ctx.createLinearGradient(0, -34, 0, 26);
      sclGrad.addColorStop(0, '#cfd8e4');
      sclGrad.addColorStop(0.28, '#f8fafc');
      sclGrad.addColorStop(1, '#ffffff');
      ctx.fillStyle = sclGrad;
      ctx.fillRect(-66, -42, 132, 84);

      // Multi-layered BotW Sapphire-Cerulean Iris
      const ix = 4;
      const iy = 1;
      const irisGrad = ctx.createLinearGradient(ix, -28, ix, 30);
      irisGrad.addColorStop(0, '#0a2658');
      irisGrad.addColorStop(0.35, '#1754a8');
      irisGrad.addColorStop(0.68, eyeHex);
      irisGrad.addColorStop(1, '#7cf0ff');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(ix, iy, 31, 32, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer dark limbal ring around iris for sharp anime definition
      ctx.strokeStyle = '#0c244a';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.ellipse(ix, iy, 30, 31, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle glowing lower-iris crescent reflection
      const crescent = ctx.createRadialGradient(ix, iy + 18, 2, ix, iy + 16, 22);
      crescent.addColorStop(0, 'rgba(170, 250, 255, 0.85)');
      crescent.addColorStop(1, 'rgba(110, 220, 255, 0)');
      ctx.fillStyle = crescent;
      ctx.beginPath();
      ctx.ellipse(ix, iy + 14, 21, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep crisp pupil
      ctx.fillStyle = '#0a1628';
      ctx.beginPath();
      ctx.ellipse(ix, iy - 1, 13.5, 15.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Primary sharp specular catchlight + tiny opposite glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ix - 12, iy - 13, 10.5, 8.5, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ix + 12, iy + 11, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Bold tapered espresso-brown upper lash line with crisp outer flick
      ctx.fillStyle = '#241812';
      ctx.beginPath();
      ctx.moveTo(-64, 1);
      ctx.bezierCurveTo(-40, -44, 24, -44, 54, -6);
      ctx.bezierCurveTo(26, -30, -34, -30, -56, 5);
      ctx.closePath();
      ctx.fill();

      // Fine warm-brown lower lash accent
      ctx.strokeStyle = 'rgba(72, 46, 34, 0.65)';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-42, 22);
      ctx.quadraticCurveTo(0, 32, 36, 18);
      ctx.stroke();

      // Delicate upper eyelid crease line
      ctx.strokeStyle = 'rgba(138, 88, 62, 0.58)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-46, -36);
      ctx.quadraticCurveTo(2, -52, 46, -30);
      ctx.stroke();

      // Sharp determined golden-brown BotW eyebrow (angled slightly inward)
      ctx.fillStyle = '#9e7430';
      ctx.beginPath();
      ctx.moveTo(-64, -56);
      ctx.quadraticCurveTo(-8, -76, 52, -52);
      ctx.lineTo(50, -40);
      ctx.quadraticCurveTo(-6, -62, -62, -48);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#6e4d1c';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      ctx.restore();
    };

    drawBotWEye(408, 1);
    drawBotWEye(616, -1);

    // 3. Sculpted Nose Bridge Highlight & Painterly Cel Nose Shadow
    const bridgeHi = ctx.createLinearGradient(504, 520, 522, 616);
    bridgeHi.addColorStop(0, 'rgba(255, 248, 236, 0.42)');
    bridgeHi.addColorStop(1, 'rgba(255, 248, 236, 0)');
    ctx.fillStyle = bridgeHi;
    ctx.beginPath();
    ctx.ellipse(514, 574, 10, 44, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iconic BotW anime angled nose-side shadow wedge
    ctx.fillStyle = 'rgba(182, 118, 86, 0.44)';
    ctx.beginPath();
    ctx.moveTo(509, 558);
    ctx.lineTo(494, 618);
    ctx.lineTo(516, 628);
    ctx.lineTo(512, 608);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(148, 88, 60, 0.62)';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(498, 618);
    ctx.quadraticCurveTo(512, 629, 522, 622);
    ctx.stroke();

    // 4. Serene Determined Hero Mouth + Subtle Lower-Lip Highlight & Shadow
    ctx.strokeStyle = '#9a5444';
    ctx.lineWidth = 4.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(466, 704);
    ctx.quadraticCurveTo(512, 718, 558, 704);
    ctx.stroke();

    // Soft rose lower lip tint + subtle cel lip shadow crescent
    ctx.fillStyle = 'rgba(226, 134, 118, 0.28)';
    ctx.beginPath();
    ctx.ellipse(512, 718, 34, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(170, 106, 80, 0.35)';
    ctx.beginPath();
    ctx.ellipse(512, 734, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const tex = finalizeTexture(canvas, false);
    this.plainCache.set(key, tex);
    return tex;
  }

  getFoliageBarkTexture(): ProceduralTextureSet {
    return this.getOrCreate('bark', 512, (ctx, w, h) => {
      const rand = mulberry32(1111);
      ctx.fillStyle = '#5c4330';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 6) {
        ctx.strokeStyle = rand() > 0.5 ? 'rgba(34, 22, 14, 0.45)' : 'rgba(130, 98, 70, 0.35)';
        ctx.lineWidth = 2 + rand() * 3;
        ctx.beginPath();
        for (let y = 0; y <= h; y += 24) {
          const xx = x + Math.sin(y * 0.04 + x * 0.1) * 4;
          if (y === 0) ctx.moveTo(xx, y);
          else ctx.lineTo(xx, y);
        }
        ctx.stroke();
      }
    }, 3.2);
  }
}

export const textureBank = new ProceduralTextureBank();
