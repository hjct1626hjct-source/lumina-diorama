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
    return this.getOrCreate(`fabric_${baseHex}_${accentHex}_${pattern}`, 512, (ctx, w, h) => {
      const rand = mulberry32(909);
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, w, h);

      // Painterly cloth weave
      for (let i = 0; i < 650; i++) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(rand() * w, rand() * h, 18 + rand() * 34, 2);
        ctx.fillRect(rand() * w, rand() * h, 2, 18 + rand() * 34);
      }

      if (pattern === 'champion') {
        // Authentic BotW Champion's Tunic: horizontal creamy-white embroidered bottom hem + collar trim + centered Master Sword diamond!
        ctx.fillStyle = '#f4ebd4';
        ctx.fillRect(0, h - 36, w, 18);
        ctx.fillStyle = accentHex;
        ctx.fillRect(0, h - 42, w, 6);
        ctx.fillRect(0, h - 18, w, 5);
        ctx.fillRect(0, 14, w, 8);

        // Subtle diamond border motifs along hem
        ctx.fillStyle = '#2a84b8';
        for (let x = 16; x < w; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, h - 34);
          ctx.lineTo(x + 7, h - 27);
          ctx.lineTo(x, h - 20);
          ctx.lineTo(x - 7, h - 27);
          ctx.closePath();
          ctx.fill();
        }

        // Centered Master Sword embroidery on chest (u = 0.5)
        ctx.strokeStyle = '#f4f8ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.24);
        ctx.lineTo(w * 0.57, h * 0.40);
        ctx.lineTo(w * 0.5, h * 0.58);
        ctx.lineTo(w * 0.43, h * 0.40);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#f4f8ff';
        ctx.fillRect(w * 0.494, h * 0.28, w * 0.012, h * 0.25);
        ctx.fillRect(w * 0.46, h * 0.36, w * 0.08, h * 0.018);
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
    }, 1.4);
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
   * Expressive anime-style painterly face texture calibrated strictly to SphereGeometry front hemisphere (u = 0.5 center!).
   */
  getHeroFaceTexture(skinHex = '#f6d5b2', eyeHex = '#2a84e0'): THREE.CanvasTexture {
    const key = `hero_face_v2_${skinHex}_${eyeHex}`;
    const existing = this.plainCache.get(key);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = skinHex;
    ctx.fillRect(0, 0, 512, 512);

    // Soft rosy cheek blush near center front
    for (const cx of [214, 298]) {
      const blush = ctx.createRadialGradient(cx, 298, 2, cx, 298, 24);
      blush.addColorStop(0, 'rgba(236, 134, 114, 0.38)');
      blush.addColorStop(1, 'rgba(236, 134, 114, 0)');
      ctx.fillStyle = blush;
      ctx.beginPath();
      ctx.arc(cx, 298, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expressive BotW Anime Eyes positioned tightly around u=0.5 (x=226 & x=286) so BOTH eyes face straight ahead!
    const drawEye = (cx: number, flip: number) => {
      ctx.save();
      ctx.translate(cx, 270);
      ctx.scale(flip, 1);

      // Crisp white sclera
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 15, -0.05, 0, Math.PI * 2);
      ctx.fill();

      // Vibrant BotW sapphire iris gradient
      const irisGrad = ctx.createLinearGradient(0, -14, 0, 14);
      irisGrad.addColorStop(0, '#103c7e');
      irisGrad.addColorStop(0.55, eyeHex);
      irisGrad.addColorStop(1, '#7ce6ff');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(2, 1, 10.5, 13, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep pupil
      ctx.fillStyle = '#0c1830';
      ctx.beginPath();
      ctx.ellipse(2, 1, 4.8, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bright anime catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-3, -5, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5, 5, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Crisp upper lash line
      ctx.strokeStyle = '#2a1e14';
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-18, -3);
      ctx.quadraticCurveTo(0, -20, 18, -5);
      ctx.stroke();

      // Expressive golden-brown eyebrow
      ctx.strokeStyle = '#926c30';
      ctx.lineWidth = 4.0;
      ctx.beginPath();
      ctx.moveTo(-19, -24);
      ctx.quadraticCurveTo(0, -32, 18, -22);
      ctx.stroke();

      ctx.restore();
    };

    drawEye(226, 1);
    drawEye(286, -1);

    // Subtle nose shading & serene determined mouth
    ctx.strokeStyle = 'rgba(168, 108, 76, 0.62)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(256, 286);
    ctx.lineTo(253, 304);
    ctx.lineTo(259, 307);
    ctx.stroke();

    ctx.strokeStyle = '#a86452';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(243, 328);
    ctx.quadraticCurveTo(256, 334, 269, 328);
    ctx.stroke();

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
