// ============================================================================
// LUMINA CHRONICLES — Hyrule-Style Toon 3D Action RPG Renderer (Three.js)
// MeshToonMaterial + 4-Tone GradientMap + Rim Lighting + Painterly Textures
// 6.5-Head Stylized Heroes (Default Male), TPS Orbit Camera, Z-Target Reticle,
// Heightmap Terrain (100% Grounded), Instanced Wind-Swaying Grass & Sky Dome
// 製作者：駿 (Created by Shun)
// ============================================================================

import * as THREE from './three.module.min.js';
import { GAME_META, AREAS, JOBS, BODY_TYPES, NPCS, RARITY_INFO } from './data.js';
import { TILE, getTile, getTerrainHeight, sampleTileWeight } from './map.js';

const TS = GAME_META.tileSize;

// ============================================================================
// TOON GRADIENT MAP & PAINTERLY CANVAS TEXTURE BANK
// ============================================================================
export class ProceduralTextureBank {
  constructor() {
    this.cache = new Map();
    this.toonGradient = this._createToonGradientMap();
  }

  _createToonGradientMap() {
    // 4-step crisp Zelda BotW / Wind Waker style cel-shading ramp
    const data = new Uint8Array([
      95, 105, 130, 255,   // Deep warm-tinted shadow (never muddy gray!)
      155, 165, 180, 255,  // Mid-shadow transition
      225, 228, 232, 255,  // Lit surface
      255, 255, 255, 255,  // Crisp highlight band
    ]);
    const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  createToonMaterial(params = {}, rimColorHex = null) {
    const mat = new THREE.MeshToonMaterial({
      gradientMap: this.toonGradient,
      ...params,
    });
    // Optional safe Fresnel backlight rim shader with automatic fallback guard
    if (rimColorHex) {
      try {
        const rimCol = new THREE.Color(rimColorHex);
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uRimColor = { value: rimCol };
          shader.fragmentShader = `uniform vec3 uRimColor;\n` + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            #include <dithering_fragment>
            float rim = 1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.3, 0.95)), 0.0);
            gl_FragColor.rgb += uRimColor * pow(rim, 3.0) * 0.28;
            `
          );
        };
      } catch (_) {
        // Fallback cleanly to standard MeshToonMaterial
      }
    }
    return mat;
  }

  get(key, width, height, drawFn) {
    if (this.cache.has(key)) return this.cache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, width, height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this.cache.set(key, tex);
    return tex;
  }

  // 1. Stylized Anime Hero / Heroine Face Texture (Equirectangular u=0.5 front)
  getFaceTexture(opts) {
    const {
      id = 'hero',
      skinTone = '#f6d5b8',
      eyeColor = '#2563eb',
      hairColor = '#e5b869',
      bodyType = 'male',
    } = opts;
    return this.get(`face_v2_${id}_${eyeColor}_${hairColor}_${bodyType}`, 512, 256, (ctx, w, h) => {
      const sg = ctx.createLinearGradient(0, 0, 0, h);
      sg.addColorStop(0, skinTone);
      sg.addColorStop(1, '#e8bc97');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);

      // Back & side hair wrap
      ctx.fillStyle = hairColor;
      ctx.fillRect(0, 0, w * 0.27, h);
      ctx.fillRect(w * 0.73, 0, w * 0.27, h);

      const isFemale = bodyType === 'female';
      if (isFemale || bodyType === 'slim') {
        for (const bx of [212, 300]) {
          const bg = ctx.createRadialGradient(bx, 152, 2, bx, 152, 22);
          bg.addColorStop(0, 'rgba(244, 114, 182, 0.35)');
          bg.addColorStop(1, 'rgba(244, 114, 182, 0)');
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.arc(bx, 152, 22, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Sharp Heroic Anime Eyes (Male/Slim: determined fierce brow; Female: bright expressive)
      const drawEye = (cx, cy, isRight) => {
        ctx.save();
        ctx.translate(cx, cy);
        const dir = isRight ? 1 : -1;

        // Sclera
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-16, 2);
        ctx.quadraticCurveTo(0, isFemale ? -16 : -12, 16, 0);
        ctx.quadraticCurveTo(0, 14, -16, 2);
        ctx.fill();

        // Iris
        const ig = ctx.createLinearGradient(0, -10, 0, 12);
        ig.addColorStop(0, '#1e293b');
        ig.addColorStop(0.35, eyeColor);
        ig.addColorStop(1, '#bae6fd');
        ctx.fillStyle = ig;
        ctx.beginPath();
        ctx.ellipse(0, 1, 10.5, isFemale ? 12.5 : 10.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 1.5, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Crisp anime highlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-4, -4, 3.4, 0, Math.PI * 2);
        ctx.arc(4, 4, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Upper eyelid line
        ctx.strokeStyle = '#1e1b18';
        ctx.lineWidth = isFemale ? 4.4 : 3.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-16, 1);
        ctx.quadraticCurveTo(0, isFemale ? -15 : -11, 16, -1);
        ctx.stroke();

        // Determined Heroic Eyebrow
        ctx.strokeStyle = '#3b2a1a';
        ctx.lineWidth = bodyType === 'male' ? 4.5 : 3.2;
        ctx.beginPath();
        if (bodyType === 'male') {
          ctx.moveTo(-dir * 15, -14);
          ctx.lineTo(dir * 16, -22);
        } else {
          ctx.moveTo(-14, -20);
          ctx.quadraticCurveTo(0, -25, 14, -19);
        }
        ctx.stroke();

        ctx.restore();
      };

      drawEye(222, 124, false);
      drawEye(290, 124, true);

      // Sharp Nose bridge shadow
      ctx.fillStyle = 'rgba(160, 100, 70, 0.45)';
      ctx.beginPath();
      ctx.moveTo(256, 134);
      ctx.lineTo(252, 152);
      ctx.lineTo(258, 154);
      ctx.closePath();
      ctx.fill();

      // Mouth (Confident heroic line)
      ctx.strokeStyle = isFemale ? '#d97777' : '#9c5a49';
      ctx.lineWidth = 3.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(243, 174);
      ctx.quadraticCurveTo(256, 179, 269, 173);
      ctx.stroke();

      // Spiky bangs across top forehead
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, 64);
      for (let x = w; x >= 0; x -= 22) {
        ctx.lineTo(x - 11, 92);
        ctx.lineTo(x - 22, 60);
      }
      ctx.closePath();
      ctx.fill();
    });
  }

  // 2. Painterly Tunic, Leather Belt, Chainmail & Emblem Outfit Texture
  getOutfitTexture(opts) {
    const {
      id = 'knight',
      tunicColor = '#1e4e8c',
      accent = '#f59e0b',
    } = opts;
    return this.get(`tunic_v2_${id}_${tunicColor}_${accent}`, 256, 256, (ctx, w, h) => {
      // Painterly cloth base with subtle weave & vertical folds
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, tunicColor);
      bg.addColorStop(1, '#111c2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Painterly brush strokes for cloth texture
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 0; i < 45; i++) {
        ctx.fillRect((i * 37) % w, (i * 53) % h, 18, 5);
      }

      // Gold Hyrule-style Royal Crest & Trim on Chest
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.strokeRect(14, 10, w - 28, h - 20);

      // Winged Crest Emblem on Front Chest (center x=128)
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(128, 48);
      ctx.lineTo(148, 82);
      ctx.lineTo(108, 82);
      ctx.closePath();
      ctx.fill();

      // Left & Right Royal Wings
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(128 + dir * 24, 72);
        ctx.lineTo(128 + dir * 74, 52);
        ctx.lineTo(128 + dir * 58, 88);
        ctx.closePath();
        ctx.fill();
      }

      // Brown Leather Cross-Strap & Waist Belt with Gold Buckle
      ctx.strokeStyle = '#4a2c18';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(45, 10);
      ctx.lineTo(210, 185);
      ctx.stroke();

      // Waist Belt
      ctx.fillStyle = '#3b2212';
      ctx.fillRect(0, 176, w, 28);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.strokeRect(108, 174, 40, 32);
    });
  }

  // 3. Painterly Terrain & Architectural Textures (Grass, Cobblestone, Ancient Stone, Wood, Bark, Foliage)
  getTileTexture(areaId, kind, pal) {
    return this.get(`hyrule_tile_${areaId}_${kind}`, 256, 256, (ctx, w, h) => {
      if (kind === 'floorA' || kind === 'floorB') {
        // Lush Painterly Grass / Earth with organic brush strokes
        ctx.fillStyle = kind === 'floorA' ? pal.floorA : pal.floorB;
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < 120; i++) {
          const gx = (i * 73) % w;
          const gy = (i * 41) % h;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 220, 0.08)' : 'rgba(15, 45, 15, 0.10)';
          ctx.beginPath();
          ctx.ellipse(gx, gy, 16, 6, (i % 5) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        // Subtle grass blade tufts painted onto ground
        ctx.strokeStyle = 'rgba(190, 242, 100, 0.22)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 40; i++) {
          const bx = (i * 59) % (w - 16) + 8;
          const by = (i * 83) % (h - 16) + 12;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - 4, by - 10);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + 4, by - 9);
          ctx.stroke();
        }
      } else if (kind === 'accent') {
        // Warm Stone Cobblestone Path / Royal Plaza Road
        ctx.fillStyle = pal.floorAccent;
        ctx.fillRect(0, 0, w, h);

        // Mortar joints & individual stone slabs with moss in crevices
        const rows = 4;
        const cols = 4;
        const sw = w / cols;
        const sh = h / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const ox = (r % 2) * (sw * 0.5);
            const sx = ((c * sw + ox) % w);
            const sy = r * sh;
            ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
            ctx.beginPath();
            ctx.roundRect(sx + 4, sy + 4, sw - 8, sh - 8, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(55, 48, 38, 0.42)';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }
      } else if (kind === 'boss') {
        // Weathered Ancient Temple Flagstone (ZERO cyber grid lines!)
        ctx.fillStyle = '#5c5549';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 90; i++) {
          const rx = (i * 67) % w;
          const ry = (i * 53) % h;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 248, 220, 0.06)' : 'rgba(25, 22, 18, 0.09)';
          ctx.beginPath();
          ctx.ellipse(rx, ry, 24, 14, (i % 6) * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (kind === 'damage') {
        // Molten Lava / Ancient Frost Crust Hazard
        ctx.fillStyle = areaId === 'magma' ? '#6b1812' : '#1e3a5f';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = areaId === 'magma' ? '#f97316' : '#7dd3fc';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(20, 40);
        ctx.quadraticCurveTo(128, 110, 236, 60);
        ctx.moveTo(30, 180);
        ctx.quadraticCurveTo(140, 130, 220, 210);
        ctx.stroke();
      } else if (kind === 'wall') {
        // Layered Ashlar Stone Masonry with Moss & Weathering
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, pal.wallTop);
        g.addColorStop(1, pal.wallFront);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(30, 25, 20, 0.42)';
        ctx.lineWidth = 4;
        for (let y = 0; y < h; y += 64) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          const offset = (y / 64) % 2 === 0 ? 0 : 64;
          for (let x = offset; x < w; x += 128) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 64);
            ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(74, 124, 60, 0.32)';
        ctx.fillRect(0, h - 28, w, 28);
      } else if (kind === 'cracked') {
        // Bombable / Breakable Cracked Rock Wall with Golden Light Seeping Through
        ctx.fillStyle = pal.wallFront;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#fbbf24';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(36, 18);
        ctx.lineTo(128, 115);
        ctx.lineTo(84, 195);
        ctx.lineTo(188, 240);
        ctx.moveTo(128, 115);
        ctx.lineTo(222, 68);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });
  }

  // Seamless Painterly Detail Texture multiplied over Vertex-Colored Continuous Terrain (NO GRID!)
  getOrganicDetailTexture(areaId) {
    const tex = this.get(`organic_terrain_detail_${areaId}`, 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e8e8e2';
      ctx.fillRect(0, 0, w, h);

      // Soft painterly mottled brushstrokes (wraps cleanly without square borders)
      for (let i = 0; i < 160; i++) {
        const x = (i * 97 + 13) % w;
        const y = (i * 61 + 29) % h;
        const rx = 18 + (i % 22);
        const ry = 8 + (i % 12);
        const ang = (i % 7) * 0.45;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 255, 245, 0.065)' : 'rgba(20, 28, 18, 0.036)';
        for (const ox of [-w, 0, w]) {
          for (const oy of [-h, 0, h]) {
            if (x + ox < -45 || x + ox > w + 45 || y + oy < -45 || y + oy > h + 45) continue;
            ctx.beginPath();
            ctx.ellipse(x + ox, y + oy, rx, ry, ang, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Subtle grass tufts or stone flecks depending on biome
      if (areaId === 'town' || areaId === 'forest') {
        ctx.strokeStyle = 'rgba(255, 255, 215, 0.11)';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 65; i++) {
          const bx = (i * 53 + 17) % w;
          const by = (i * 89 + 11) % h;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - 3, by - 8);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + 3, by - 7);
          ctx.stroke();
        }
      } else {
        // Pebbles & natural rock strata grain
        for (let i = 0; i < 64; i++) {
          const px = (i * 71 + 7) % w;
          const py = (i * 43 + 19) % h;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.055)';
          ctx.beginPath();
          ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 12);
    return tex;
  }

  // Circular Ancient Carved Stone Sanctuary Medallion Texture for Boss Arenas
  getStoneMedallionTexture(areaId) {
    return this.get(`sanctuary_medallion_${areaId}`, 512, 512, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      ctx.clearRect(0, 0, w, h);

      const baseCol = areaId === 'cave' ? '#4f6d8c' : areaId === 'magma' ? '#57362c' : areaId === 'citadel' ? '#cbd5e1' : areaId === 'secret' ? '#4c3f6e' : '#857a66';
      const darkCol = areaId === 'cave' ? '#2c4159' : areaId === 'magma' ? '#331c16' : areaId === 'citadel' ? '#64748b' : '#4a4336';
      const runeCol = areaId === 'cave' ? 'rgba(125,211,252,0.45)' : areaId === 'magma' ? 'rgba(251,146,60,0.48)' : 'rgba(245,208,118,0.45)';

      const grad = ctx.createRadialGradient(cx, cy, 24, cx, cy, 248);
      grad.addColorStop(0, baseCol);
      grad.addColorStop(0.82, darkCol);
      grad.addColorStop(1, 'rgba(40,35,30,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 248, 0, Math.PI * 2);
      ctx.fill();

      // Concentric carved stone masonry rings & radial flagstone seams
      ctx.strokeStyle = 'rgba(20, 18, 15, 0.45)';
      ctx.lineWidth = 4;
      for (const r of [90, 165, 228]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 90, cy + Math.sin(a) * 90);
        ctx.lineTo(cx + Math.cos(a) * 228, cy + Math.sin(a) * 228);
        ctx.stroke();
      }

      // Subtle ancient gold/crystal carved sacred emblem (NOT cyber grid!)
      ctx.strokeStyle = runeCol;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, 130, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
        ctx.lineTo(cx + Math.cos(a) * 85, cy + Math.sin(a) * 85);
        ctx.stroke();
      }
    });
  }

  // Delicate Ancient Arcane Magic Circle Texture (replaces thick yellow boss torus!)
  getMagicCircleTexture(color = '#f5d076') {
    return this.get(`ancient_magic_circle_${color}`, 256, 256, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 114, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 98, 0, Math.PI * 2);
      ctx.stroke();
      // Inscribed ancient 8-point star crest
      for (let s = 0; s < 2; s++) {
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) {
          const a = (i / 4) * Math.PI * 2 + s * (Math.PI / 4);
          const px = cx + Math.cos(a) * 98;
          const py = cy + Math.sin(a) * 98;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    });
  }

  // 4. Monster & Boss Painterly Fantasy Scales / Armor / Fur Texture
  getMonsterTexture(id, color, accent) {
    return this.get(`fantasy_mon_${id}_${color}_${accent}`, 256, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, color);
      g.addColorStop(1, '#1c1917');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Ancient tribal warpaint / rune markings
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(128, 128, 76, 0, Math.PI * 2);
      ctx.stroke();

      // Fierce glowing monster eyes
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(68, 105);
      ctx.lineTo(112, 122);
      ctx.lineTo(76, 134);
      ctx.closePath();
      ctx.moveTo(188, 105);
      ctx.lineTo(144, 122);
      ctx.lineTo(180, 134);
      ctx.closePath();
      ctx.fill();
    });
  }
}

// ============================================================================
// 6.5-HEAD STYLIZED HERO & FANTASY MONSTER 3D RIG FACTORY (NO CLAY SPHERES!)
// ============================================================================
export class CharacterRigFactory {
  constructor(texBank) {
    this.texBank = texBank;
    this.sharedGeos = {
      // Sculpted stylized anime head (u=0.5 at +X -> rotateY(-PI/2) faces +Z!)
      head: new THREE.SphereGeometry(5.1, 16, 14),
      hairCrown: new THREE.SphereGeometry(5.35, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairSpike: new THREE.ConeGeometry(2.0, 6.8, 5),
      // 6.5-head stylized V-taper torso, waist, and tunic skirt (Cylinder u=0.5 at -Z -> rotateY(PI) faces +Z!)
      chest: new THREE.CylinderGeometry(6.6, 4.9, 13.5, 12),
      tunicSkirt: new THREE.CylinderGeometry(5.0, 7.2, 8.5, 12),
      pauldron: new THREE.SphereGeometry(3.4, 10, 8),
      upperLimb: new THREE.CylinderGeometry(2.0, 1.7, 10.5, 8),
      lowerLimb: new THREE.CylinderGeometry(2.0, 1.6, 11.5, 8),
      bootCuff: new THREE.CylinderGeometry(2.5, 2.2, 4.2, 8),
      cape: new THREE.PlaneGeometry(13, 21),
      shadow: new THREE.CircleGeometry(15, 20),
    };
  }

  createHumanoidRig(spec) {
    const {
      id = 'hero',
      jobId = 'knight',
      bodyType = 'male',
      color = '#2563eb',
      accent = '#f59e0b',
      tunicColor = '#1e4e8c',
      capeColor = '#991b1b',
      hairColor = '#e5b869',
      eyeColor = '#2563eb',
      skinTone = '#f6d5b8',
      weaponType = 'blade',
      weaponColor = '#93c5fd',
    } = spec;

    const bSpec = BODY_TYPES[bodyType] || BODY_TYPES.male;
    const root = new THREE.Group();

    // Ground soft shadow disc
    const shadow = new THREE.Mesh(
      this.sharedGeos.shadow,
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.36, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.35;
    root.add(shadow);

    // Articulated 6.5-head character root (Total height ~44 units)
    const body = new THREE.Group();
    body.position.y = 20;
    body.scale.set(1, bSpec.heightScale, 1);
    root.add(body);

    const faceTex = this.texBank.getFaceTexture({ id, skinTone, eyeColor, hairColor, bodyType });
    const tunicTex = this.texBank.getOutfitTexture({ id: jobId, tunicColor: tunicColor || color, accent });

    const skinMat = this.texBank.createToonMaterial({ color: skinTone }, '#fff7ed');
    const tunicMat = this.texBank.createToonMaterial({ map: tunicTex }, accent);
    const armorMat = this.texBank.createToonMaterial({ color: 0xd6d3c4 }, '#ffffff');
    const leatherMat = this.texBank.createToonMaterial({ color: 0x4a2c18 });
    const bootMat = this.texBank.createToonMaterial({ color: 0x2e1a0f });
    const hairMat = this.texBank.createToonMaterial({ color: hairColor }, '#fef08a');
    const capeMat = this.texBank.createToonMaterial({
      color: capeColor || color,
      side: THREE.DoubleSide,
    });

    // 1. V-Tapered Heroic Chest & Tunic Skirt (rotation.y = Math.PI puts u=0.5 crest on +Z front!)
    const chestMesh = new THREE.Mesh(this.sharedGeos.chest, tunicMat);
    chestMesh.position.y = 6.5;
    chestMesh.rotation.y = Math.PI;
    chestMesh.scale.set(bSpec.shoulderScale, 1, bSpec.waistScale * 0.92);
    chestMesh.castShadow = true;
    body.add(chestMesh);

    const skirtMesh = new THREE.Mesh(this.sharedGeos.tunicSkirt, tunicMat);
    skirtMesh.position.y = -2.8;
    skirtMesh.rotation.y = Math.PI;
    skirtMesh.scale.set(bSpec.hipScale, 1, bSpec.hipScale * 0.92);
    skirtMesh.castShadow = true;
    body.add(skirtMesh);

    // 2. Sculpted Rounded Shoulder Pauldrons & Flowing Hero Scarf / Half-Cape
    for (const dir of [-1, 1]) {
      const pauldron = new THREE.Mesh(this.sharedGeos.pauldron, jobId === 'knight' ? armorMat : leatherMat);
      pauldron.position.set(dir * 7.2 * bSpec.shoulderScale, 11.8, 0);
      pauldron.scale.set(1.15, 0.72, 1.12);
      pauldron.rotation.z = dir * -0.24;
      body.add(pauldron);
    }

    const capeMesh = new THREE.Mesh(this.sharedGeos.cape, capeMat);
    capeMesh.position.set(0, 3.2, -5.8);
    capeMesh.rotation.x = 0.16;
    body.add(capeMesh);

    // 3. Sculpted Anime Head & Swept Spiky Hair Tufts (Hidden in FPS camera mode!)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 18.2, 0);
    body.add(headGroup);

    const headMat = this.texBank.createToonMaterial({ map: faceTex }, '#fff7ed');
    const headMesh = new THREE.Mesh(this.sharedGeos.head, headMat);
    headMesh.rotation.y = -Math.PI / 2; // Sphere u=0.5 (+X) -> faces +Z front!
    headMesh.scale.set(0.92 * bSpec.jawWidth, 1.04, 0.95);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Pointed Hylian Ears
    const earGeo = new THREE.ConeGeometry(1.3, 4.4, 4);
    for (const dir of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(dir * 5.2, 0.1, -0.4);
      ear.rotation.z = dir * -1.25;
      ear.rotation.y = dir * 0.25;
      headGroup.add(ear);
    }

    // Spiky 3D Anime Hair Crown + Parted Forehead Bangs + Side Locks + Back Swept Spikes
    const hairGroup = new THREE.Group();
    headGroup.add(hairGroup);

    const crown = new THREE.Mesh(this.sharedGeos.hairCrown, hairMat);
    crown.position.set(0, 0.65, -0.35);
    crown.rotation.x = -0.18;
    crown.scale.set(1.04, 1.05, 1.06);
    hairGroup.add(crown);

    // Parted forehead bangs high above eyes so anime eyes & eyebrows are 100% clear!
    const bangSpecs = [
      { x: -2.4, y: 4.4, z: 4.1, rx: 1.9, rz: 0.42, s: 0.72 },
      { x: 2.4, y: 4.4, z: 4.1, rx: 1.9, rz: -0.42, s: 0.72 },
      { x: -4.2, y: 1.8, z: 2.3, rx: 2.6, rz: 0.35, s: 0.85 }, // Left cheek lock
      { x: 4.2, y: 1.8, z: 2.3, rx: 2.6, rz: -0.35, s: 0.85 }, // Right cheek lock
    ];
    for (const b of bangSpecs) {
      const sp = new THREE.Mesh(this.sharedGeos.hairSpike, hairMat);
      sp.position.set(b.x, b.y, b.z);
      sp.rotation.set(b.rx, 0, b.rz);
      sp.scale.setScalar(b.s);
      hairGroup.add(sp);
    }

    // Dynamic Swept-Back Hero Spikes & Top Ahoge
    const backAngles = [2.1, 2.55, Math.PI, -2.55, -2.1];
    for (const a of backAngles) {
      const sp = new THREE.Mesh(this.sharedGeos.hairSpike, hairMat);
      sp.position.set(Math.sin(a) * 4.5, 2.2, Math.cos(a) * 4.5);
      sp.rotation.x = -2.15;
      sp.rotation.z = -Math.sin(a) * 0.48;
      hairGroup.add(sp);
    }

    // Mage Pointed Hat or Rogue Crest
    if (jobId === 'mage') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 9.2, 1.1, 14), tunicMat);
      brim.position.set(0, 4.6, -0.3);
      const hatCone = new THREE.Mesh(new THREE.ConeGeometry(6.8, 12, 12), tunicMat);
      hatCone.position.set(0, 10.2, -1.2);
      hatCone.rotation.x = -0.25;
      hairGroup.add(brim, hatCone);
    }

    // 4. Articulated Legs (Thigh + Knee Joint + Calf + Folded Fantasy Boot)
    const kneeGeo = new THREE.SphereGeometry(2.0, 8, 8);
    const shinGeo = new THREE.CylinderGeometry(1.9, 1.5, 6.2, 8);
    const thighGeo = new THREE.CylinderGeometry(2.3, 1.9, 6.2, 8);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-3.3, -6.8, 0);
    body.add(leftLeg);
    const lThigh = new THREE.Mesh(thighGeo, leatherMat);
    lThigh.position.y = -3.0;
    const lKnee = new THREE.Mesh(kneeGeo, leatherMat);
    lKnee.position.y = -6.0;
    const lShin = new THREE.Group();
    lShin.position.y = -6.0;
    const lShinMesh = new THREE.Mesh(shinGeo, bootMat);
    lShinMesh.position.y = -3.0;
    const lBoot = new THREE.Mesh(this.sharedGeos.bootCuff, bootMat);
    lBoot.position.set(0, -5.6, 0.7);
    lShin.add(lShinMesh, lBoot);
    leftLeg.add(lThigh, lKnee, lShin);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(3.3, -6.8, 0);
    body.add(rightLeg);
    const rThigh = new THREE.Mesh(thighGeo, leatherMat);
    rThigh.position.y = -3.0;
    const rKnee = new THREE.Mesh(kneeGeo, leatherMat);
    rKnee.position.y = -6.0;
    const rShin = new THREE.Group();
    rShin.position.y = -6.0;
    const rShinMesh = new THREE.Mesh(shinGeo, bootMat);
    rShinMesh.position.y = -3.0;
    const rBoot = new THREE.Mesh(this.sharedGeos.bootCuff, bootMat);
    rBoot.position.set(0, -5.6, 0.7);
    rShin.add(rShinMesh, rBoot);
    rightLeg.add(rThigh, rKnee, rShin);

    // 5. Articulated Left Arm (Upper Arm + Elbow + Gauntlet Forearm + Heraldic Shield)
    const upperArmGeo = new THREE.CylinderGeometry(2.1, 1.75, 5.8, 8);
    const elbowGeo = new THREE.SphereGeometry(1.75, 8, 8);
    const foreArmGeo = new THREE.CylinderGeometry(1.7, 1.45, 5.6, 8);

    const leftArm = new THREE.Group();
    leftArm.position.set(-8.0 * bSpec.shoulderScale, 11.2, 0.4);
    body.add(leftArm);
    const lUpArm = new THREE.Mesh(upperArmGeo, tunicMat);
    lUpArm.position.y = -2.8;
    const lElbow = new THREE.Mesh(elbowGeo, tunicMat);
    lElbow.position.y = -5.6;
    const lForeArm = new THREE.Group();
    lForeArm.position.y = -5.6;
    lForeArm.rotation.x = -0.32;
    const lForeMesh = new THREE.Mesh(foreArmGeo, leatherMat);
    lForeMesh.position.y = -2.7;
    lForeArm.add(lForeMesh);
    leftArm.add(lUpArm, lElbow, lForeArm);

    const shieldHand = this._createHylianShieldMesh(color, accent);
    shieldHand.position.set(-1.6, -3.5, 2.8);
    shieldHand.rotation.y = -0.35;
    lForeArm.add(shieldHand);

    // 6. Articulated Right Arm (Upper Arm + Elbow + Gauntlet Forearm + Drawn Weapon)
    const rightArm = new THREE.Group();
    rightArm.position.set(8.0 * bSpec.shoulderScale, 11.2, 0.4);
    body.add(rightArm);
    const rUpArm = new THREE.Mesh(upperArmGeo, tunicMat);
    rUpArm.position.y = -2.8;
    const rElbow = new THREE.Mesh(elbowGeo, tunicMat);
    rElbow.position.y = -5.6;
    const rForeArm = new THREE.Group();
    rForeArm.position.y = -5.6;
    rForeArm.rotation.x = -0.45;
    const rForeMesh = new THREE.Mesh(foreArmGeo, leatherMat);
    rForeMesh.position.y = -2.7;
    rForeArm.add(rForeMesh);
    rightArm.add(rUpArm, rElbow, rForeArm);

    const weaponHand = this._createWeaponMesh(weaponType, weaponColor, accent);
    weaponHand.position.set(0, -4.6, 3.6);
    rForeArm.add(weaponHand);

    // Sheathed weapon & shield on back (visible when not actively attacking/guarding!)
    const backGear = new THREE.Group();
    backGear.position.set(0, 7.5, -6.8);
    const backWeapon = this._createWeaponMesh(weaponType, weaponColor, accent);
    backWeapon.rotation.z = -0.65;
    backWeapon.rotation.x = Math.PI * 0.5;
    const backShield = this._createHylianShieldMesh(color, accent);
    backShield.position.z = -1.2;
    backGear.add(backWeapon, backShield);
    body.add(backGear);

    // 7. Golden Rune Aura Ring (+4 / +7 Forge Evolution)
    const auraRing = new THREE.Mesh(
      new THREE.RingGeometry(16, 18.5, 28),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.8;
    root.add(auraRing);

    root.userData = {
      body,
      headGroup,
      capeMesh,
      leftLeg,
      rightLeg,
      lShin,
      rShin,
      leftArm,
      rightArm,
      lForeArm,
      rForeArm,
      weaponHand,
      shieldHand,
      backGear,
      auraRing,
      spec,
    };
    return root;
  }

  _createHylianShieldMesh(color, accent) {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 11.5, 1.6),
      this.texBank.createToonMaterial({ color })
    );
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 12.6, 1.2),
      this.texBank.createToonMaterial({ color: accent })
    );
    rim.position.z = -0.3;
    g.add(plate, rim);
    return g;
  }

  _createWeaponMesh(type, color, accent = '#f59e0b') {
    const group = new THREE.Group();
    const bladeMat = this.texBank.createToonMaterial({ color }, '#ffffff');
    const hiltMat = this.texBank.createToonMaterial({ color: accent });
    const gripMat = this.texBank.createToonMaterial({ color: 0x3b2212 });

    if (type === 'wand') {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 26, 8), gripMat);
      shaft.rotation.x = Math.PI / 2;
      group.add(shaft);
      const crown = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.8, 6, 14), hiltMat);
      crown.position.z = 13;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(2.8, 0), bladeMat);
      gem.position.z = 13;
      group.add(crown, gem);
    } else if (type === 'dagger') {
      const guard = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.4, 1.6), hiltMat);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(1.9, 17, 4), bladeMat);
      blade.rotation.x = Math.PI / 2;
      blade.position.z = 9;
      group.add(guard, blade);
    } else {
      // Master Sword / Royal Knight Broadsword with Winged Crossguard
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 6, 8), gripMat);
      grip.rotation.x = Math.PI / 2;
      grip.position.z = -2;
      const crossguard = new THREE.Mesh(new THREE.BoxGeometry(8.2, 2.0, 2.2), hiltMat);
      crossguard.position.z = 1.5;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(2.3, 25, 4), bladeMat);
      blade.rotation.x = Math.PI / 2;
      blade.scale.set(1.0, 1.0, 0.42);
      blade.position.z = 14;
      group.add(grip, crossguard, blade);
    }
    return group;
  }

  // Sculpted Floating Ancient Arcane Crystal Spire (replaces clunky guardian crystal boxes!)
  createArcaneCrystalSpire(color = '#38bdf8') {
    const g = new THREE.Group();
    const cryMat = this.texBank.createToonMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.55,
    }, '#fffbeb');
    const goldMat = this.texBank.createToonMaterial({ color: 0xd4af37 }, '#fef08a');

    const topSpire = new THREE.Mesh(new THREE.ConeGeometry(7.5, 22, 6), cryMat);
    topSpire.position.y = 11;
    const botSpire = new THREE.Mesh(new THREE.ConeGeometry(7.5, 16, 6), cryMat);
    botSpire.rotation.x = Math.PI;
    botSpire.position.y = -8;
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(11.5, 0.8, 6, 20), goldMat);
    ring1.rotation.x = Math.PI * 0.35;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(13.5, 0.65, 6, 20), goldMat);
    ring2.rotation.y = Math.PI * 0.35;
    ring2.rotation.x = -Math.PI * 0.25;

    g.add(topSpire, botSpire, ring1, ring2);
    g.userData = { ring1, ring2 };
    return g;
  }

  // Distinct High-Fantasy Monster Silhouettes (Goblin Warrior, Stone Golem, Winged Beast, Ancient Construct)
  createEnemyRig(enemy) {
    const def = enemy.def;
    const r = enemy.radius;
    const root = new THREE.Group();

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.95, 18),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.36, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.35;
    root.add(shadow);

    const tex = this.texBank.getMonsterTexture(def.id, def.color, def.accent);
    const mat = this.texBank.createToonMaterial({ map: tex }, def.accent);
    const accentMat = this.texBank.createToonMaterial({ color: def.accent });

    const body = new THREE.Group();
    root.add(body);

    if (def.shape === 'goblin' || def.shape === 'knight_mob') {
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.52, r * 0.4, r * 1.05, 10), mat);
      torso.position.y = r * 0.95;
      torso.rotation.y = Math.PI;
      const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 10, 10), mat);
      head.position.y = r * 1.72;
      for (const dir of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(2.2, 8, 5), accentMat);
        horn.position.set(dir * r * 0.34, r * 2.1, 0);
        horn.rotation.z = dir * -0.45;
        body.add(horn);
      }
      const weapon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, r * 1.4, 6), accentMat);
      weapon.rotation.x = Math.PI * 0.5;
      weapon.position.set(r * 0.65, r * 0.95, r * 0.55);
      body.add(torso, head, weapon);
    } else if (def.shape === 'golem' || def.shape === 'turret') {
      const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.85, 0), mat);
      torso.position.y = r * 1.15;
      const lArm = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.48, 0), mat);
      lArm.position.set(-r * 0.95, r * 1.0, 2);
      const rArm = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.48, 0), mat);
      rArm.position.set(r * 0.95, r * 1.0, 2);
      const weakOre = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.35, 0), accentMat);
      weakOre.position.set(0, r * 1.95, -2);
      body.add(torso, lArm, rArm, weakOre);
    } else if (def.shape === 'bat' || def.shape === 'beast') {
      const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 10, 8), mat);
      core.scale.set(0.85, 0.8, 1.35);
      core.position.y = r * 1.0;
      for (const dir of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, r * 1.3, 4), accentMat);
        wing.position.set(dir * r * 0.9, r * 1.1, 0);
        wing.rotation.z = dir * -1.35;
        wing.scale.set(0.25, 1, 0.85);
        body.add(wing);
      }
      body.add(core);
    } else {
      // Jelly Chuchu / Spirit Wizzrobe (Organic droplet + floating crystal shard, NO thick torus!)
      const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.72, 12, 10), mat);
      core.scale.set(1.05, 0.92, 1.05);
      core.position.y = r * 0.78;
      const topSpike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, r * 0.65, 7), accentMat);
      topSpike.position.y = r * 1.55;
      body.add(core, topSpike);
    }

    root.userData = { mainMesh: body, mat };
    return root;
  }

  // ==========================================================================
  // 6 BESPOKE SCULPTED 3D HIGH-FANTASY BOSS RIGS (ZERO CYLINDER/BLOCK ROBOTS!)
  // ==========================================================================
  createBossRig(boss) {
    const def = boss.def;
    const r = boss.radius;
    const root = new THREE.Group();

    const tex = this.texBank.getMonsterTexture(def.id, def.color, def.accent);
    const coreMat = this.texBank.createToonMaterial({ map: tex }, def.accent);
    const accentMat = this.texBank.createToonMaterial({ color: def.accent }, '#fffbeb');
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const body = new THREE.Group();
    root.add(body);

    const animParts = { wings: [], arms: [], tailSegs: [], neck: null, weaponArm: null };

    if (def.id === 'boss_sylvarion') {
      // AREA 01: 聖樹の守護巨獣・シルヴァリオン (Massive Ancient Mossy Treant & Forest Beast!)
      const barkMat = this.texBank.createToonMaterial({ color: 0x4b3621 }, '#a3e635');
      const mossMat = this.texBank.createToonMaterial({ color: 0x3b7a2c }, '#bef264');
      const rockMat = this.texBank.createToonMaterial({ color: 0x6b705c }, '#d9f99d');
      const gemMat = this.texBank.createToonMaterial({
        color: 0x34d399,
        emissive: new THREE.Color('#10b981'),
        emissiveIntensity: 0.75,
      });

      // 4 Splayed Gnarled Root Legs
      for (const [lx, lz, rx, rz] of [[-26, 20, 0.2, 0.2], [26, 20, 0.2, -0.2], [-28, -22, -0.22, 0.18], [28, -22, -0.22, -0.18]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 11.5, 32, 7), barkMat);
        leg.position.set(lx, 15, lz);
        leg.rotation.set(rx, 0, rz);
        leg.castShadow = true;
        body.add(leg);
      }

      // Broad Hunched Mossy Rock & Timber Carapace Back
      const mainHunch = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.88, 1), barkMat);
      mainHunch.scale.set(1.15, 0.92, 1.3);
      mainHunch.position.set(0, 44, -2);
      mainHunch.castShadow = true;
      body.add(mainHunch);

      const carapace = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.76, 0), rockMat);
      carapace.scale.set(1.2, 0.65, 1.15);
      carapace.position.set(0, 62, -10);
      body.add(carapace);

      // Lush Ancient Tree Canopy growing right off the beast's back!
      for (const [fx, fy, fz, fr] of [[0, 82, -14, 24], [-22, 74, -10, 17], [22, 74, -10, 17], [0, 76, -32, 18]]) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(fr, 1), mossMat);
        leaf.scale.set(1.15, 0.72, 1.05);
        leaf.position.set(fx, fy, fz);
        leaf.castShadow = true;
        body.add(leaf);
      }

      // Glowing Emerald Forest Heart Crystal embedded in chest
      const chestGem = new THREE.Mesh(new THREE.OctahedronGeometry(12, 0), gemMat);
      chestGem.position.set(0, 42, 34);
      body.add(chestGem);

      // Fierce Horned Stag/Treant Guardian Head with Branching Antlers!
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 56, 36);
      const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(17, 0), barkMat);
      skull.scale.set(1.0, 0.9, 1.25);
      headGroup.add(skull);
      for (const dir of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 8), eyeMat);
        eye.position.set(dir * 7.5, 2.5, 15.5);
        const antler1 = new THREE.Mesh(new THREE.ConeGeometry(3.2, 32, 5), accentMat);
        antler1.position.set(dir * 16, 20, -2);
        antler1.rotation.z = dir * -0.52;
        const antler2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 18, 5), accentMat);
        antler2.position.set(dir * 26, 26, 4);
        antler2.rotation.z = dir * -0.95;
        headGroup.add(eye, antler1, antler2);
      }
      body.add(headGroup);

      // 2 Massive Articulated Woody Slam Arms with Mossy Boulder Fists
      for (const dir of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(dir * 38, 48, 12);
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 6.2, 34, 7), barkMat);
        upper.position.y = -15;
        upper.rotation.z = dir * 0.22;
        const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(14, 0), rockMat);
        fist.position.set(dir * 4, -34, 6);
        fist.castShadow = true;
        arm.add(upper, fist);
        body.add(arm);
        animParts.arms.push({ mesh: arm, dir });
      }
    } else if (def.id === 'boss_crystalion' || def.id === 'boss_ignis') {
      // AREA 02 (白銀の水晶古竜・クリスタリオン) & AREA 04 (紅蓮の火竜王・イグニスレックス)
      // TRUE SCULPTED 3D ANCIENT DRAGON (Curved Neck, Horned Head, Huge Flapping Wings, 4 Claws & Sweeping Tail!)
      const isIce = def.id === 'boss_crystalion';
      const scaleMat = this.texBank.createToonMaterial({ color: isIce ? 0x1e5c8a : 0x7f1d1d }, isIce ? '#bae6fd' : '#fb923c');
      const bellyMat = this.texBank.createToonMaterial({ color: isIce ? 0xcbe9ff : 0xf97316 });
      const wingMat = this.texBank.createToonMaterial({
        color: isIce ? 0x7dd3fc : 0xfb923c,
        emissive: new THREE.Color(isIce ? '#0284c7' : '#ea580c'),
        emissiveIntensity: 0.42,
        transparent: true,
        opacity: isIce ? 0.82 : 0.92,
        side: THREE.DoubleSide,
      });

      // Horizontal Sinuous Dragon Chest & Hindquarters
      const chest = new THREE.Mesh(new THREE.SphereGeometry(26, 12, 10), scaleMat);
      chest.scale.set(1.05, 0.92, 1.45);
      chest.position.set(0, 42, 8);
      chest.castShadow = true;
      const belly = new THREE.Mesh(new THREE.SphereGeometry(21, 10, 8), bellyMat);
      belly.scale.set(0.95, 0.72, 1.3);
      belly.position.set(0, 34, 10);
      const hind = new THREE.Mesh(new THREE.SphereGeometry(21, 10, 8), scaleMat);
      hind.scale.set(0.95, 0.85, 1.3);
      hind.position.set(0, 36, -24);
      body.add(chest, belly, hind);

      // 4 Clawed Dragon Legs
      for (const [lx, lz] of [[-22, 16], [22, 16], [-20, -24], [20, -24]]) {
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 4.5, 28, 7), scaleMat);
        thigh.position.set(lx, 18, lz);
        const claw = new THREE.Mesh(new THREE.ConeGeometry(7.5, 10, 5), accentMat);
        claw.position.set(lx, 5, lz + 4);
        body.add(thigh, claw);
      }

      // Curved Multi-Segment Dragon Neck + Horned Dragon Head & Jaw!
      const neckGroup = new THREE.Group();
      neckGroup.position.set(0, 52, 28);
      const neck1 = new THREE.Mesh(new THREE.CylinderGeometry(11, 14, 24, 8), scaleMat);
      neck1.position.set(0, 10, 8);
      neck1.rotation.x = 0.42;
      const neck2 = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 11, 22, 8), scaleMat);
      neck2.position.set(0, 26, 16);
      neck2.rotation.x = 0.25;

      const dHead = new THREE.Group();
      dHead.position.set(0, 38, 22);
      const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(13.5, 0), scaleMat);
      cranium.scale.set(1.0, 0.85, 1.25);
      const snout = new THREE.Mesh(new THREE.ConeGeometry(8.5, 22, 6), scaleMat);
      snout.rotation.x = Math.PI * 0.5;
      snout.position.set(0, -1, 17);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 16), bellyMat);
      jaw.position.set(0, -6.5, 13);
      dHead.add(cranium, snout, jaw);

      for (const dir of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), eyeMat);
        eye.position.set(dir * 6.5, 3, 10);
        const horn = new THREE.Mesh(new THREE.ConeGeometry(3.2, 26, 5), accentMat);
        horn.position.set(dir * 8, 12, -8);
        horn.rotation.set(-0.85, 0, dir * -0.25);
        dHead.add(eye, horn);
      }
      neckGroup.add(neck1, neck2, dHead);
      body.add(neckGroup);
      animParts.neck = neckGroup;

      // HUGE Swept Articulated Crystal / Flame Dragon Wings (Flap gracefully!)
      for (const dir of [-1, 1]) {
        const wingPivot = new THREE.Group();
        wingPivot.position.set(dir * 18, 54, 6);
        const spar = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, 72, 6), scaleMat);
        spar.rotation.z = dir * -1.15;
        spar.position.set(dir * 32, 16, -6);
        // Sculpted swept triangular wing membrane facets
        const web1 = new THREE.Mesh(new THREE.ConeGeometry(28, 66, 3), wingMat);
        web1.rotation.z = dir * -1.3;
        web1.rotation.y = dir * 0.2;
        web1.scale.set(1.0, 1.0, 0.14);
        web1.position.set(dir * 38, 12, -16);
        const web2 = new THREE.Mesh(new THREE.ConeGeometry(22, 46, 3), wingMat);
        web2.rotation.z = dir * -1.55;
        web2.scale.set(1.0, 1.0, 0.12);
        web2.position.set(dir * 62, 14, -22);
        wingPivot.add(spar, web1, web2);
        body.add(wingPivot);
        animParts.wings.push({ mesh: wingPivot, dir });
      }

      // Multi-Segment Sweeping Dragon Tail with Crystal/Flame Tip
      for (let t = 0; t < 4; t++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(11 - t * 2.2, 13 - t * 2.2, 20, 7), scaleMat);
        seg.rotation.x = Math.PI * 0.48;
        seg.position.set(0, 30 - t * 3, -40 - t * 17);
        body.add(seg);
        animParts.tailSegs.push({ mesh: seg, idx: t });
      }
      const tailSpire = new THREE.Mesh(new THREE.OctahedronGeometry(9.5, 0), wingMat);
      tailSpire.position.set(0, 20, -108);
      body.add(tailSpire);
      animParts.tailSegs.push({ mesh: tailSpire, idx: 4 });
    } else if (def.id === 'boss_chronos') {
      // AREA 03: 古代神殿の巨神兵・クロノガーディアン (Ancient Carved Stone Sentinel Colossus!)
      const sandStone = this.texBank.createToonMaterial({ color: 0x8c7b60 }, '#fde68a');
      const bronzeMat = this.texBank.createToonMaterial({ color: 0xb45309 }, '#fef08a');
      const runeMat = this.texBank.createToonMaterial({ color: 0x38bdf8, emissive: new THREE.Color('#0284c7'), emissiveIntensity: 0.7 });

      // Tapered Carved Temple Pedestal Torso & Hovering Stone Pillars
      const chest = new THREE.Mesh(new THREE.CylinderGeometry(28, 14, 48, 6), sandStone);
      chest.position.y = 48;
      chest.castShadow = true;
      const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(13, 0), runeMat);
      coreGem.position.set(0, 50, 18);
      const maskHead = new THREE.Mesh(new THREE.ConeGeometry(16, 26, 6), bronzeMat);
      maskHead.position.y = 82;
      const eyeVisor = new THREE.Mesh(new THREE.BoxGeometry(16, 4.5, 6), eyeMat);
      eyeVisor.position.set(0, 79, 12);
      body.add(chest, coreGem, maskHead, eyeVisor);

      // Massive Floating Stone Gauntlets
      for (const dir of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(dir * 42, 54, 8);
        const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(14, 0), bronzeMat);
        const fist = new THREE.Mesh(new THREE.CylinderGeometry(11, 9, 28, 6), sandStone);
        fist.position.set(0, -24, 12);
        fist.rotation.x = Math.PI * 0.35;
        arm.add(shoulder, fist);
        body.add(arm);
        animParts.arms.push({ mesh: arm, dir });
      }
    } else {
      // AREA 05 FINAL BOSS (厄災の古代魔導王・オメガノヴァ) & SECRET VAULT (星穹の創世神将・アストラルゼロ)
      // MAJESTIC ARMORED HUMANOID SOVEREIGN / CELESTIAL GENERAL (Armor, Cape, Crowned Helm, 6 Blade Wings, Colossal Greatsword!)
      const isAstral = def.id === 'boss_astral_zero';
      const plateMat = this.texBank.createToonMaterial({ color: isAstral ? 0xe5e7eb : 0x2e1065 }, isAstral ? '#fde047' : '#c084fc');
      const goldTrim = this.texBank.createToonMaterial({ color: isAstral ? 0xf59e0b : 0xd97706 }, '#fef08a');
      const capeMat = this.texBank.createToonMaterial({ color: isAstral ? 0x1d4ed8 : 0x7f1d1d, side: THREE.DoubleSide });
      const bladeWingMat = new THREE.MeshBasicMaterial({
        color: isAstral ? 0x38bdf8 : 0xf43f5e,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });

      // Armored Legs & Royal Tassets
      for (const dir of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 5.2, 34, 8), plateMat);
        leg.position.set(dir * 12, 18, 0);
        const greave = new THREE.Mesh(new THREE.ConeGeometry(7.5, 16, 6), goldTrim);
        greave.position.set(dir * 12, 8, 2);
        body.add(leg, greave);
      }

      // Regal V-Tapered Breastplate & Sweeping Royal Cape
      const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(23, 14, 34, 10), plateMat);
      cuirass.position.y = 52;
      cuirass.castShadow = true;
      const tasset = new THREE.Mesh(new THREE.CylinderGeometry(15, 24, 18, 10), goldTrim);
      tasset.position.y = 32;
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(42, 62), capeMat);
      cape.position.set(0, 42, -16);
      cape.rotation.x = 0.24;
      body.add(cuirass, tasset, cape);

      // Crowned Demon / Winged Celestial Helm
      const helmGroup = new THREE.Group();
      helmGroup.position.set(0, 79, 0);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(12.5, 12, 10), plateMat);
      helm.scale.set(0.95, 1.15, 1.0);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(14, 3.8, 6), eyeMat);
      visor.position.set(0, 1, 10);
      helmGroup.add(helm, visor);
      for (const dir of [-1, 1]) {
        const crest = new THREE.Mesh(new THREE.ConeGeometry(3.8, 26, 5), goldTrim);
        crest.position.set(dir * 11, 14, -2);
        crest.rotation.z = dir * -0.45;
        helmGroup.add(crest);
      }
      body.add(helmGroup);

      // 6 Fanned Radiant Energy Blade Wings!
      for (const dir of [-1, 1]) {
        for (let w = 0; w < 3; w++) {
          const wingPivot = new THREE.Group();
          wingPivot.position.set(dir * 18, 64 - w * 7, -14);
          const feather = new THREE.Mesh(new THREE.ConeGeometry(7.5, 58 - w * 8, 4), bladeWingMat);
          feather.rotation.z = dir * -(0.85 + w * 0.32);
          feather.scale.set(1.0, 1.0, 0.16);
          feather.position.set(dir * (26 - w * 3), 14 - w * 8, -4);
          wingPivot.add(feather);
          body.add(wingPivot);
          animParts.wings.push({ mesh: wingPivot, dir, idx: w });
        }
      }

      // Broad Sculpted Pauldrons, Left Shield Arm & Right Colossal Greatsword Arm!
      for (const dir of [-1, 1]) {
        const pauldron = new THREE.Mesh(new THREE.SphereGeometry(11, 10, 8), goldTrim);
        pauldron.scale.set(1.2, 0.75, 1.15);
        pauldron.position.set(dir * 26, 66, 0);
        body.add(pauldron);
      }

      const leftArm = new THREE.Group();
      leftArm.position.set(-28, 62, 2);
      const lArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 4.5, 28, 8), plateMat);
      lArmMesh.position.y = -14;
      leftArm.add(lArmMesh);
      body.add(leftArm);
      animParts.arms.push({ mesh: leftArm, dir: -1 });

      const rightArm = new THREE.Group();
      rightArm.position.set(28, 62, 4);
      const rArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 4.5, 28, 8), plateMat);
      rArmMesh.position.y = -14;
      rArmMesh.rotation.x = 0.45;
      // Colossal Sovereign Greatsword!
      const sword = new THREE.Group();
      sword.position.set(0, -24, 14);
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(20, 4.5, 4.5), goldTrim);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(6.8, 86, 4), bladeWingMat);
      blade.rotation.x = Math.PI * 0.5;
      blade.scale.set(1.0, 1.0, 0.28);
      blade.position.z = 44;
      sword.add(hilt, blade);
      rightArm.add(rArmMesh, sword);
      body.add(rightArm);
      animParts.weaponArm = rightArm;
    }

    // Delicate Ancient Arcane Magic Circle at Boss Feet (replaces clunky yellow torus!)
    const circleTex = this.texBank.getMagicCircleTexture(def.accent || '#f5d076');
    const haloMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 2.8, r * 2.8),
      new THREE.MeshBasicMaterial({ map: circleTex, transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide })
    );
    haloMesh.rotation.x = -Math.PI / 2;
    haloMesh.position.y = 1.6;
    root.add(haloMesh);

    // Subtle Translucent Sacred Barrier Sphere when Guardian Crystals are alive
    const shieldMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r * 1.48, 2),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.16, wireframe: true })
    );
    shieldMesh.position.y = r * 1.15;
    root.add(shieldMesh);

    root.userData = { coreMesh: body, haloMesh, shieldMesh, coreMat, animParts, bossId: def.id };
    return root;
  }
}

// ============================================================================
// MAIN THREE.JS TPS / FPS ZELDA-STYLE 3D RENDERER
// ============================================================================
export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.mctx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    this.webglCanvas = document.createElement('canvas');
    this.webglCanvas.id = 'webgl-canvas';
    this.webglCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    this.canvas.style.position = 'relative';
    this.canvas.style.zIndex = '1';
    if (this.canvas.parentElement) {
      this.canvas.parentElement.insertBefore(this.webglCanvas, this.canvas);
    }

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.time = 0;

    this.texBank = new ProceduralTextureBank();
    this.rigFactory = new CharacterRigFactory(this.texBank);

    this.webglAvailable = false;
    this._initThree();

    this.lightCanvas = document.createElement('canvas');
    this.lctx = this.lightCanvas.getContext('2d');

    this.envParticles = [];
    this.envAreaId = null;

    this.resize();
  }

  _initThree() {
    try {
      this.webglRenderer = new THREE.WebGLRenderer({
        canvas: this.webglCanvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.webglRenderer.setPixelRatio(this.dpr);
      this.webglRenderer.setSize(this.width, this.height, false);
      this.webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
      this.webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.webglRenderer.toneMappingExposure = 1.12;
      this.webglRenderer.shadowMap.enabled = true;
      this.webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('#7ec0ee');
      this.scene.fog = new THREE.FogExp2('#b3d9f2', 0.00075);

      // Zelda-Style 58-degree FOV Perspective Camera
      this.camera3D = new THREE.PerspectiveCamera(58, this.width / Math.max(1, this.height), 4, 4200);

      // Color Lighting: Sky-Ground HemisphereLight + Warm Sunlight DirectionalLight
      this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x5e7a52, 1.35);
      this.hemiLight.position.set(0, 500, 0);
      this.scene.add(this.hemiLight);

      this.sunLight = new THREE.DirectionalLight(0xfff5dc, 1.95);
      this.sunLight.position.set(220, 480, 260);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 1024;
      this.sunLight.shadow.mapSize.height = 1024;
      this.sunLight.shadow.camera.near = 50;
      this.sunLight.shadow.camera.far = 1400;
      const d = 420;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.scene.add(this.sunLight);
      this.scene.add(this.sunLight.target);

      this.playerPointLight = new THREE.PointLight(0xffedd5, 1.8, 320);
      this.scene.add(this.playerPointLight);

      // Scene Groups
      this.skyGroup = new THREE.Group();
      this.mapGroup = new THREE.Group();
      this.entityGroup = new THREE.Group();
      this.vfxGroup = new THREE.Group();
      this.titleGroup = new THREE.Group();
      this.scene.add(this.skyGroup);
      this.scene.add(this.mapGroup);
      this.scene.add(this.entityGroup);
      this.scene.add(this.vfxGroup);
      this.scene.add(this.titleGroup);

      this._buildSkyDomeAndClouds();
      this._buildTitleDiorama3D();

      this.builtWallStateHash = '';
      this.grassInstancedMesh = null;
      this.grassDummy = new THREE.Object3D();
      this.grassPositions = [];

      // Dynamic Entity Mesh Pools
      this.playerRig = null;
      this.playerRigKey = '';
      this.droneMesh = this._createSpiritOrbMesh();
      this.entityGroup.add(this.droneMesh);

      this.npcMeshes = new Map();
      this.enemyMeshes = new Map();
      this.remoteMeshes = new Map();
      this.chestMeshes = new Map();
      this.portalMeshes = new Map();
      this.crystalMeshes = new Map();
      this.bossRig = null;
      this.bossRigId = '';

      this.webglAvailable = true;
    } catch (err) {
      console.warn('WebGL fallback to 2D Canvas:', err);
      this.webglAvailable = false;
    }
  }

  _buildSkyDomeAndClouds() {
    // Painted Hyrule Gradient Sky Dome + Distant Mountain Ridge Silhouettes!
    const skyTex = this.texBank.get('hyrule_sky_dome_v1', 512, 256, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0.0, '#1d4ed8');
      grad.addColorStop(0.28, '#3b82f6');
      grad.addColorStop(0.50, '#93c5fd');
      grad.addColorStop(0.58, '#e0f2fe');
      grad.addColorStop(0.64, '#d1fae5');
      grad.addColorStop(1.0, '#86efac');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Soft distant misty Hyrule mountain ridges along horizon (y ~ 50%-58%)
      ctx.fillStyle = 'rgba(71, 128, 175, 0.42)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.62);
      for (let x = 0; x <= w; x += 16) {
        const m = Math.sin(x * 0.025) * 14 + Math.cos(x * 0.068) * 8 + Math.sin(x * 0.012) * 10;
        ctx.lineTo(x, h * 0.54 - Math.abs(m) * 0.65);
      }
      ctx.lineTo(w, h * 0.62);
      ctx.closePath();
      ctx.fill();
    });
    this.skyDomeMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(2200, 24, 14), this.skyDomeMat);
    this.skyGroup.add(skyDome);

    // Sun Disc & Soft Corona in the High-Fantasy Sky
    const sunGeo = new THREE.SphereGeometry(62, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb, fog: false });
    this.sunDisc = new THREE.Mesh(sunGeo, sunMat);
    this.sunDisc.position.set(450, 620, -900);
    this.skyGroup.add(this.sunDisc);

    this.clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      fog: false,
    });
    const puffGeo = new THREE.DodecahedronGeometry(34, 1);
    for (let i = 0; i < 14; i++) {
      const cg = new THREE.Group();
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set((p - 1) * 32, (p % 2) * 8, 0);
        puff.scale.set(1.5, 0.55, 0.9);
        cg.add(puff);
      }
      const ang = (i / 14) * Math.PI * 2;
      const dist = 650 + (i % 3) * 180;
      cg.position.set(Math.cos(ang) * dist, 290 + (i % 4) * 45, Math.sin(ang) * dist);
      cg.lookAt(0, 290, 0);
      this.skyGroup.add(cg);
      this.clouds.push({ mesh: cg, angle: ang, dist, speed: 0.015 + (i % 3) * 0.006 });
    }
  }

  _buildTitleDiorama3D() {
    // Hyrule-Style Grassy Cliff Overlook + Pine Trees + Ancient Pedestal + Default Male Blade Knight Hero!
    const grassTex = this.texBank.getTileTexture('town', 'floorA', AREAS[0].palette);
    const cliffMat = this.texBank.createToonMaterial({ map: grassTex, color: 0x62b04b });
    const rockMat = this.texBank.createToonMaterial({ color: 0x78716c });
    const stoneMat = this.texBank.createToonMaterial({ color: 0x9ca3af });

    const cliffTop = new THREE.Mesh(new THREE.CylinderGeometry(142, 130, 12, 16), cliffMat);
    cliffTop.position.y = -8;
    const cliffRock = new THREE.Mesh(new THREE.CylinderGeometry(128, 76, 34, 12), rockMat);
    cliffRock.position.y = -30;
    this.titleGroup.add(cliffTop, cliffRock);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(38, 46, 10, 8), stoneMat);
    pedestal.position.y = 1;
    this.titleGroup.add(pedestal);

    // Scenic Hyrule Pine Trees framing the cliff overlook
    const barkMat = this.texBank.createToonMaterial({ color: 0x4a3525 });
    const leafMat = this.texBank.createToonMaterial({ color: 0x3b8232 }, '#bef264');
    for (const [tx, tz, sc] of [[-105, -45, 1.15], [105, -45, 1.1], [-88, -75, 0.9], [90, -78, 0.95]]) {
      const tg = new THREE.Group();
      tg.position.set(tx, -2, tz);
      tg.scale.setScalar(sc);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 5.2, 20, 7), barkMat);
      tr.position.y = 10;
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(18, 18, 7), leafMat);
      c1.position.y = 22;
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(13, 15, 7), leafMat);
      c2.position.y = 32;
      tg.add(tr, c1, c2);
      this.titleGroup.add(tg);
    }

    // Floating Star Crystal Relic above Pedestal
    const cryMat = this.texBank.createToonMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color('#0284c7'),
      emissiveIntensity: 0.45,
    }, '#fef08a');
    this.titleCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(24, 0), cryMat);
    this.titleCrystal.position.set(0, 48, -32);
    this.titleGroup.add(this.titleCrystal);

    // Default Male Hero (Royal Blade Knight) + Arc Mage + Windrunner Rogue on Title Overlook
    this.titleHero = this.rigFactory.createHumanoidRig({
      id: 'title_knight',
      jobId: 'knight',
      bodyType: 'male',
      ...JOBS.knight,
      weaponType: 'blade',
      weaponColor: '#93c5fd',
    });
    this.titleHero.scale.setScalar(1.38);
    this.titleHero.position.set(0, 6, 36);
    this.titleGroup.add(this.titleHero);

    this.titleMage = this.rigFactory.createHumanoidRig({
      id: 'title_mage',
      jobId: 'mage',
      bodyType: 'female',
      ...JOBS.mage,
      weaponType: 'wand',
      weaponColor: '#7dd3fc',
    });
    this.titleMage.scale.setScalar(1.24);
    this.titleMage.position.set(-64, -2, 18);
    this.titleMage.rotation.y = 0.35;
    this.titleGroup.add(this.titleMage);

    this.titleRogue = this.rigFactory.createHumanoidRig({
      id: 'title_rogue',
      jobId: 'rogue',
      bodyType: 'male',
      ...JOBS.rogue,
      weaponType: 'dagger',
      weaponColor: '#86efac',
    });
    this.titleRogue.scale.setScalar(1.24);
    this.titleRogue.position.set(64, -2, 18);
    this.titleRogue.rotation.y = -0.35;
    this.titleGroup.add(this.titleRogue);
  }

  _createSpiritOrbMesh() {
    // Ancient Fairy / Spirit Lantern Orb (Replaces sci-fi drone box!)
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(5.2, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(8.5, 0.9, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    );
    const wingGeo = new THREE.ConeGeometry(3.2, 9, 4);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.72 });
    const lWing = new THREE.Mesh(wingGeo, wingMat);
    lWing.position.set(-7, 2, 0);
    lWing.rotation.z = 1.1;
    const rWing = new THREE.Mesh(wingGeo, wingMat);
    rWing.position.set(7, 2, 0);
    rWing.rotation.z = -1.1;
    g.add(core, halo, lWing, rWing);
    return g;
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    if (this.webglAvailable && this.webglRenderer) {
      this.webglRenderer.setPixelRatio(this.dpr);
      this.webglRenderer.setSize(this.width, this.height, false);
      this.camera3D.aspect = this.width / Math.max(1, this.height);
      this.camera3D.updateProjectionMatrix();
    }

    this.lightCanvas.width = Math.max(2, Math.floor(this.width * 0.5));
    this.lightCanvas.height = Math.max(2, Math.floor(this.height * 0.5));
  }

  // Project 3D world coordinates (wx, heightY, wz) to 2D canvas overlay screen coordinates
  worldToScreen(wx, heightY, wz) {
    if (!this.webglAvailable || !this.camera3D) {
      return { x: wx, y: wz - heightY, behind: false };
    }
    const v = new THREE.Vector3(wx, heightY, wz);
    v.project(this.camera3D);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-v.y * 0.5 + 0.5) * this.height,
      behind: v.z > 1.0,
    };
  }

  // ==========================================================================
  // TITLE SCREEN — HYRULE HIGHLAND OVERLOOK & GOLDEN CREST LOGO
  // ==========================================================================
  renderTitle(dt) {
    this.time += dt;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    if (this.webglAvailable) {
      this.mapGroup.visible = false;
      this.entityGroup.visible = false;
      this.vfxGroup.visible = false;
      this.titleGroup.visible = true;
      this.skyGroup.visible = true;
      if (this.skyDomeMat) this.skyDomeMat.color.set('#ffffff');

      this.scene.background.set('#4a90d9');
      this.scene.fog.color.set('#bae6fd');
      this.scene.fog.density = 0.0005;

      this.titleGroup.rotation.y = Math.sin(this.time * 0.35) * 0.22;
      this.titleGroup.position.y = Math.sin(this.time * 1.4) * 2.5 + 8;
      if (this.titleCrystal) {
        this.titleCrystal.rotation.y = this.time * 1.4;
        this.titleCrystal.position.y = 48 + Math.sin(this.time * 2.4) * 4;
      }
      this._animateHumanoidRig(this.titleHero, this.time * 2.2, false, false, true, 0);
      this._animateHumanoidRig(this.titleMage, this.time * 2.0 + 1.2, false, false, true, 0);
      this._animateHumanoidRig(this.titleRogue, this.time * 2.4 + 2.4, false, false, true, 0);

      this.camera3D.position.set(0, 86, 240);
      this.camera3D.lookAt(0, 32, 0);
      this.webglRenderer.render(this.scene, this.camera3D);
    }

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    // Place royal golden logo cleanly near the upper sky so the 3 heroes stand unobstructed below!
    const logoY = Math.max(54, Math.min(135, h * 0.145));
    const titleSize = Math.min(54, Math.max(28, w * 0.056));

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `900 ${titleSize}px "Georgia", "Hiragino Mincho ProN", "Hiragino Kaku Gothic ProN", serif`;
    ctx.shadowColor = 'rgba(15, 23, 42, 0.78)';
    ctx.shadowBlur = 18;

    const grad = ctx.createLinearGradient(cx - 240, logoY - 28, cx + 240, logoY + 28);
    grad.addColorStop(0, '#fffbeb');
    grad.addColorStop(0.45, '#fde68a');
    grad.addColorStop(1, '#d97706');

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1e293b';
    ctx.strokeText(GAME_META.title, cx, logoY);
    ctx.fillStyle = grad;
    ctx.fillText(GAME_META.title, cx, logoY);

    ctx.shadowBlur = 10;
    ctx.font = `800 ${Math.min(16, Math.max(11, w * 0.017))}px "Hiragino Kaku Gothic ProN", sans-serif`;
    ctx.fillStyle = '#fffbeb';
    ctx.strokeText(GAME_META.subtitle, cx, logoY + titleSize * 0.68);
    ctx.fillText(GAME_META.subtitle, cx, logoY + titleSize * 0.68);
    ctx.restore();

    ctx.restore();
  }

  // ==========================================================================
  // BUILD & SYNC 3D HYRULE TERRAIN, ARCHITECTURE & INSTANCED WIND GRASS
  // ==========================================================================
  _ensure3DMap(game) {
    const map = game.map;
    const wallHash = `${map.areaId}_${map.towerFloor}_${game.progress.brokenWalls.size}_${game.progress.activatedSwitches.size}_${map.bossArena?.active ? 1 : 0}`;
    if (this.builtWallStateHash === wallHash) return;
    this.builtWallStateHash = wallHash;

    while (this.mapGroup.children.length > 0) {
      this.mapGroup.remove(this.mapGroup.children[0]);
    }
    this.chestMeshes.clear();
    this.portalMeshes.clear();
    this.npcMeshes.clear();
    this.grassInstancedMesh = null;
    this.grassPositions = [];
    this.waterMeshes = [];

    const pal = map.meta.palette;
    this.scene.background.set(pal.skyHorizon || pal.voidBg);
    if (this.skyDomeMat) {
      const tint = map.areaId === 'magma' ? '#fb923c' : map.areaId === 'ruins' ? '#fef3c7' : map.areaId === 'secret' ? '#c084fc' : '#ffffff';
      this.skyDomeMat.color.set(tint);
    }
    this.scene.fog.color.set(pal.fogColor || pal.voidBg);
    this.scene.fog.density = pal.fogDensity || 0.00075;
    this.hemiLight.color.set(pal.ambientSky || '#87ceeb');
    this.hemiLight.groundColor.set(pal.ambientGround || '#5e7a52');
    this.sunLight.color.set(pal.sunColor || '#fff5dc');
    this.hemiLight.intensity = map.areaId === 'cave' ? 1.05 : 1.38;
    this.sunLight.intensity = map.areaId === 'cave' ? 1.15 : 1.95;

    // ========================================================================
    // 1. CONTINUOUS SCULPTED HEIGHTMAP TERRAIN MESH (NO FLAT TILE CUBES!)
    //    High-res PlaneGeometry + Multi-Octave Hills + Carved Riverbeds +
    //    Smooth Vertex-Color Biome Blending + Organic Painterly Detail Map!
    // ========================================================================
    const worldW = map.pixelWidth;
    const worldH = map.pixelHeight;
    const segX = Math.min(110, map.width * 2);
    const segZ = Math.min(84, map.height * 2);
    const terrainGeo = new THREE.PlaneGeometry(worldW, worldH, segX, segZ);
    terrainGeo.rotateX(-Math.PI / 2);
    terrainGeo.translate(worldW * 0.5, 0, worldH * 0.5);

    const posAttr = terrainGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const cFloorA = new THREE.Color(pal.floorA);
    const cFloorB = new THREE.Color(pal.floorB);
    const cPath = new THREE.Color(pal.floorAccent);
    const cShore = new THREE.Color(map.areaId === 'magma' ? '#4a1d14' : map.areaId === 'cave' ? '#2c425e' : '#b8a57d');
    const cRiverBed = new THREE.Color(map.areaId === 'magma' ? '#7c2d12' : '#1b4965');
    const cCliffSoil = new THREE.Color(pal.wallFront);
    const cBossStone = new THREE.Color(map.areaId === 'cave' ? '#476282' : map.areaId === 'magma' ? '#4a2c24' : map.areaId === 'citadel' ? '#cbd5e1' : '#857a66');
    const cHazard = new THREE.Color(map.areaId === 'magma' ? '#ea580c' : '#2563eb');
    const tmpCol = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = getTerrainHeight(vx, vz, map.areaId, map);
      posAttr.setY(i, vy);

      // Smooth organic biome blending (eliminates all square grid edges!)
      const noise = (Math.sin(vx * 0.016 + vz * 0.011) * Math.cos(vz * 0.014 - vx * 0.009) + 1) * 0.5;
      tmpCol.copy(cFloorA).lerp(cFloorB, noise);

      const accentW = sampleTileWeight(map, vx, vz, TILE.ACCENT);
      const waterW = sampleTileWeight(map, vx, vz, TILE.WATER);
      const bossW = sampleTileWeight(map, vx, vz, TILE.BOSS_FLOOR);
      const dmgW = sampleTileWeight(map, vx, vz, TILE.DAMAGE);
      const wallW = sampleTileWeight(map, vx, vz, TILE.WALL);

      if (accentW > 0.01) tmpCol.lerp(cPath, Math.min(1, accentW * 1.15));
      if (bossW > 0.01) tmpCol.lerp(cBossStone, Math.min(1, bossW * 1.15));
      if (wallW > 0.05 && map.areaId !== 'town') tmpCol.lerp(cCliffSoil, Math.min(0.85, wallW));
      if (waterW > 0.01) {
        const bridgeMask = Math.max(0, 1 - accentW * 1.5);
        const wFactor = waterW * bridgeMask;
        if (wFactor > 0.02) {
          tmpCol.lerp(wFactor > 0.45 ? cRiverBed : cShore, Math.min(1, wFactor * 1.4));
        }
      }
      if (dmgW > 0.05) tmpCol.lerp(cHazard, Math.min(0.95, dmgW * 1.3));

      // Subtle sunlit hillcrest warmth / valley shading
      const elevTint = Math.max(-0.08, Math.min(0.1, vy * 0.008));
      colors[i * 3] = Math.max(0, Math.min(1, tmpCol.r + elevTint));
      colors[i * 3 + 1] = Math.max(0, Math.min(1, tmpCol.g + elevTint));
      colors[i * 3 + 2] = Math.max(0, Math.min(1, tmpCol.b + elevTint * 0.6));
    }

    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainDetailTex = this.texBank.getOrganicDetailTexture(map.areaId);
    const terrainMat = this.texBank.createToonMaterial({
      vertexColors: true,
      map: terrainDetailTex,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    this.mapGroup.add(terrainMesh);

    // Subtle Cobblestone Royal Plaza Overlay ONLY in Town's Central Square
    if (map.areaId === 'town') {
      const plazaTex = this.texBank.getTileTexture('town', 'accent', pal);
      plazaTex.wrapS = THREE.RepeatWrapping;
      plazaTex.wrapT = THREE.RepeatWrapping;
      plazaTex.repeat.set(8, 8);
      const plazaMesh = new THREE.Mesh(
        new THREE.CircleGeometry(TS * 5.2, 32),
        this.texBank.createToonMaterial({ map: plazaTex })
      );
      plazaMesh.rotation.x = -Math.PI / 2;
      plazaMesh.position.set(16.5 * TS, 2.75, 12.5 * TS);
      plazaMesh.receiveShadow = true;
      this.mapGroup.add(plazaMesh);
    }

    // ========================================================================
    // 2. REAL 3D TRANSLUCENT SHIMMERING WATER SURFACES + ARCHED BRIDGES
    // ========================================================================
    let hasWater = false;
    for (let i = 0; i < map.tiles.length; i++) {
      if (map.tiles[i] === TILE.WATER) { hasWater = true; break; }
    }
    if (hasWater) {
      const isLava = map.areaId === 'magma';
      const waterGeo = new THREE.PlaneGeometry(worldW, worldH, 32, 24);
      waterGeo.rotateX(-Math.PI / 2);
      const waterMat = isLava
        ? new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9 })
        : new THREE.MeshPhongMaterial({
            color: new THREE.Color(pal.water).lerp(new THREE.Color('#38bdf8'), 0.35),
            emissive: new THREE.Color(pal.water),
            emissiveIntensity: 0.22,
            specular: new THREE.Color('#e0f2fe'),
            shininess: 85,
            transparent: true,
            opacity: 0.78,
          });
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.position.set(worldW * 0.5, -4.6, worldH * 0.5);
      this.mapGroup.add(waterMesh);
      this.waterMeshes.push(waterMesh);
    }

    // ========================================================================
    // 3. SACRED CIRCULAR ANCIENT STONE BOSS SANCTUARY (NO CYBER GRID!)
    // ========================================================================
    if (map.bossArena && map.bossArena.center) {
      const bc = map.bossArena.center;
      const by = getTerrainHeight(bc.x, bc.y, map.areaId, map);
      const medTex = this.texBank.getStoneMedallionTexture(map.areaId);
      const sanctuaryDisc = new THREE.Mesh(
        new THREE.CircleGeometry(215, 36),
        new THREE.MeshBasicMaterial({ map: medTex, transparent: true, opacity: 0.95, depthWrite: false })
      );
      sanctuaryDisc.rotation.x = -Math.PI / 2;
      sanctuaryDisc.position.set(bc.x, by + 0.6, bc.y);
      this.mapGroup.add(sanctuaryDisc);

      // 6 Weathered Sanctuary Monolith Pillars surrounding the circular boss arena
      const monoMat = this.texBank.createToonMaterial({ map: this.texBank.getTileTexture(map.areaId, 'wall', pal) });
      const brazierMat = new THREE.MeshBasicMaterial({ color: map.areaId === 'cave' ? 0x7dd3fc : 0xfbbf24 });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + 0.35;
        const px = bc.x + Math.cos(ang) * 205;
        const pz = bc.y + Math.sin(ang) * 205;
        const py = getTerrainHeight(px, pz, map.areaId, map);
        const h = i % 2 === 0 ? 48 : 34;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 9.5, h, 8), monoMat);
        col.position.set(px, py + h * 0.5 - 2, pz);
        col.castShadow = true;
        this.mapGroup.add(col);
        if (i % 2 === 0) {
          const flame = new THREE.Mesh(new THREE.OctahedronGeometry(5.5, 0), brazierMat);
          flame.position.set(px, py + h + 5, pz);
          this.mapGroup.add(flame);
        }
      }
    }

    // ========================================================================
    // 4. NATURAL SCULPTED CLIFFS, RUINED STONE COLUMNS, BRIDGES & CASTLE WALLS
    //    (100% ABOLISHED SQUARE BLOCK WALLS!)
    // ========================================================================
    const matWallStone = this.texBank.createToonMaterial({ map: this.texBank.getTileTexture(map.areaId, 'wall', pal) });
    const matRockCliff = this.texBank.createToonMaterial({ color: pal.wallFront }, pal.wallTop);
    const matMossCap = this.texBank.createToonMaterial({ color: map.areaId === 'cave' ? '#5ea2d1' : map.areaId === 'magma' ? '#7c2d12' : '#4f8f3c' });
    const matCracked = this.texBank.createToonMaterial({
      map: this.texBank.getTileTexture(map.areaId, 'cracked', pal),
      emissive: new THREE.Color('#d97706'),
      emissiveIntensity: 0.3,
    });
    const matBridgeWood = this.texBank.createToonMaterial({ color: map.areaId === 'magma' ? 0x57534e : 0x7c4d25 });
    const matGateBar = this.texBank.createToonMaterial({ color: 0xb48636 }, '#fde68a');
    const matBossGateBar = this.texBank.createToonMaterial({ color: 0x3b151e }, '#f87171');
    const matGateVeil = new THREE.MeshBasicMaterial({
      color: '#f5d076',
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const matBossGateVeil = new THREE.MeshBasicMaterial({
      color: '#ef4444',
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const rockGeo = new THREE.DodecahedronGeometry(TS * 0.64, 0);
    const rockSubGeo = new THREE.DodecahedronGeometry(TS * 0.44, 0);
    const shoreRockGeo = new THREE.DodecahedronGeometry(7.5, 0);
    const pillarGeo = new THREE.CylinderGeometry(10.5, 12.5, 58, 10);
    const brokenPillarGeo = new THREE.CylinderGeometry(9.5, 12.5, 34, 10);
    const gateBarGeo = new THREE.CylinderGeometry(1.5, 1.8, 42, 6);
    const gateTipGeo = new THREE.ConeGeometry(2.6, 8.5, 6);
    const gateCrossGeo = new THREE.BoxGeometry(TS, 3.2, 3.2);
    const gateVeilGeo = new THREE.PlaneGeometry(TS, 40);
    const gatePlinthGeo = new THREE.CylinderGeometry(4.8, 6.2, 46, 8);

    const isRuinsStyle = map.areaId === 'ruins' || map.areaId === 'citadel' || map.areaId === 'secret' || map.areaId === 'tower';
    const isTown = map.areaId === 'town';
    const grassCandidates = [];

    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const t = getTile(map, tx, ty);
        if (t === TILE.VOID) continue;
        const wx = (tx + 0.5) * TS;
        const wz = (ty + 0.5) * TS;
        const groundY = getTerrainHeight(wx, wz, map.areaId, map);

        if (t === TILE.FLOOR && (map.areaId === 'town' || map.areaId === 'forest' || map.areaId === 'ruins')) {
          grassCandidates.push({ x: wx, z: wz, y: groundY });
        }

        // Shoreline pebbles & smooth rocks beside water edges
        if (t === TILE.FLOOR && hasWater && ((tx * 7 + ty * 13) % 3 === 0)) {
          const nearWater =
            getTile(map, tx + 1, ty) === TILE.WATER ||
            getTile(map, tx - 1, ty) === TILE.WATER ||
            getTile(map, tx, ty + 1) === TILE.WATER ||
            getTile(map, tx, ty - 1) === TILE.WATER;
          if (nearWater) {
            const sr = new THREE.Mesh(shoreRockGeo, matRockCliff);
            sr.position.set(wx + Math.sin(tx * 5) * 10, groundY + 1.5, wz + Math.cos(ty * 5) * 10);
            sr.scale.set(1.2, 0.55, 1.0);
            sr.rotation.y = tx + ty;
            this.mapGroup.add(sr);
          }
        }

        // Real 3D Arched Bridges spanning water channels!
        if (t === TILE.ACCENT && hasWater) {
          const waterNS = getTile(map, tx, ty - 1) === TILE.WATER || getTile(map, tx, ty + 1) === TILE.WATER;
          const waterEW = getTile(map, tx - 1, ty) === TILE.WATER || getTile(map, tx + 1, ty) === TILE.WATER;
          if (waterNS || waterEW) {
            const deck = new THREE.Mesh(new THREE.BoxGeometry(TS + 2, 4.5, TS + 2), matBridgeWood);
            deck.position.set(wx, groundY + 1.5, wz);
            deck.receiveShadow = true;
            this.mapGroup.add(deck);
            if (waterNS) {
              for (const dz of [-TS * 0.45, TS * 0.45]) {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 15, 6), matBridgeWood);
                post.position.set(wx, groundY + 8, wz + dz);
                this.mapGroup.add(post);
              }
            }
          }
        }

        if (t === TILE.WALL) {
          const hash = (tx * 37 + ty * 17) & 31;
          if (isTown) {
            // Hyrule Castle Town Masonry Curtain Wall with Crenellations!
            const wMesh = new THREE.Mesh(new THREE.BoxGeometry(TS + 1, 46, TS + 1), matWallStone);
            wMesh.position.set(wx, groundY + 21, wz);
            wMesh.castShadow = true;
            wMesh.receiveShadow = true;
            this.mapGroup.add(wMesh);
            if ((tx + ty) % 2 === 0) {
              const merlon = new THREE.Mesh(new THREE.BoxGeometry(TS * 0.55, 10, TS * 0.55), matWallStone);
              merlon.position.set(wx, groundY + 48, wz);
              this.mapGroup.add(merlon);
            }
          } else if (isRuinsStyle) {
            // Ancient Weathered Fluted Columns, Ruined Plinths & Crumbled Masonry (NO square wall bricks!)
            const isBorder = tx <= 3 || tx >= map.width - 4 || ty <= 3 || ty >= map.height - 4;
            if (!isBorder || (tx + ty) % 2 === 0) {
              const intact = hash % 3 !== 0;
              const col = new THREE.Mesh(intact ? pillarGeo : brokenPillarGeo, matWallStone);
              col.position.set(wx, groundY + (intact ? 26 : 14), wz);
              col.rotation.y = hash * 0.35;
              if (!intact) col.rotation.z = (hash % 2 === 0 ? 1 : -1) * 0.14;
              col.castShadow = true;
              col.receiveShadow = true;
              this.mapGroup.add(col);
              if (intact) {
                const cap = new THREE.Mesh(new THREE.BoxGeometry(28, 6, 28), matWallStone);
                cap.position.set(wx, groundY + 56, wz);
                this.mapGroup.add(cap);
              }
            } else {
              // Low weathered temple ruin wall slab
              const slab = new THREE.Mesh(new THREE.DodecahedronGeometry(TS * 0.56, 0), matWallStone);
              slab.scale.set(1.15, 0.85 + (hash % 5) * 0.14, 1.15);
              slab.position.set(wx, groundY + 14, wz);
              slab.rotation.y = hash * 0.5;
              this.mapGroup.add(slab);
            }
          } else {
            // Natural Sculpted Jagged Rock Cliffs & Moss-Capped Boulders (Forest / Cave / Magma!)
            const hScale = 1.15 + (hash % 7) * 0.14;
            const cliff = new THREE.Mesh(rockGeo, matRockCliff);
            cliff.position.set(wx + Math.sin(hash) * 4, groundY + 18 * hScale, wz + Math.cos(hash) * 4);
            cliff.scale.set(1.15 + (hash % 3) * 0.12, hScale * 1.25, 1.15 + ((hash + 1) % 3) * 0.12);
            cliff.rotation.set((hash % 5) * 0.08, hash * 0.7, ((hash + 2) % 5) * 0.08);
            cliff.castShadow = true;
            cliff.receiveShadow = true;
            this.mapGroup.add(cliff);

            if (hash % 2 === 0) {
              const cap = new THREE.Mesh(rockSubGeo, matMossCap);
              cap.position.set(wx, groundY + 34 * hScale, wz);
              cap.scale.set(1.2, 0.45, 1.2);
              cap.rotation.y = hash;
              this.mapGroup.add(cap);
            }
          }
        } else if (t === TILE.CRACKED) {
          // Natural Fissured Breakable Boulder glowing with golden cracks!
          const boulder = new THREE.Mesh(rockGeo, matCracked);
          boulder.position.set(wx, groundY + 22, wz);
          boulder.scale.set(1.08, 1.18, 1.08);
          boulder.rotation.y = tx * 0.9 + ty;
          boulder.castShadow = true;
          this.mapGroup.add(boulder);
        } else if (t === TILE.GATE || t === TILE.BOSS_GATE) {
          const isBoss = t === TILE.BOSS_GATE;
          const barMat = isBoss ? matBossGateBar : matGateBar;
          const veilMat = isBoss ? matBossGateVeil : matGateVeil;
          const sameN = getTile(map, tx, ty - 1) === t;
          const sameS = getTile(map, tx, ty + 1) === t;
          const sameW = getTile(map, tx - 1, ty) === t;
          const sameE = getTile(map, tx + 1, ty) === t;
          const wallNS = getTile(map, tx, ty - 1) === TILE.WALL || getTile(map, tx, ty + 1) === TILE.WALL;
          const runsNS = sameN || sameS || (!sameW && !sameE && wallNS);

          const gGroup = new THREE.Group();
          gGroup.position.set(wx, groundY, wz);
          if (runsNS) gGroup.rotation.y = Math.PI * 0.5;

          // 3 forged spear bars + pointed finials
          for (const bx of [-15, 0, 15]) {
            const bar = new THREE.Mesh(gateBarGeo, barMat);
            bar.position.set(bx, 21, 0);
            bar.castShadow = true;
            const tip = new THREE.Mesh(gateTipGeo, barMat);
            tip.position.set(bx, 45.5, 0);
            gGroup.add(bar, tip);
          }
          // Twin horizontal iron crossbars
          for (const by of [11, 32]) {
            const cross = new THREE.Mesh(gateCrossGeo, barMat);
            cross.position.set(0, by, 0);
            gGroup.add(cross);
          }
          // Delicate translucent arcane seal veil
          const veil = new THREE.Mesh(gateVeilGeo, veilMat);
          veil.position.set(0, 20, 0);
          gGroup.add(veil);

          // Weathered stone gateposts at doorway ends
          const hasLeftEdge = runsNS ? !sameN : !sameW;
          const hasRightEdge = runsNS ? !sameS : !sameE;
          if (hasLeftEdge) {
            const lp = new THREE.Mesh(gatePlinthGeo, matWallStone);
            lp.position.set(-TS * 0.48, 22, 0);
            lp.castShadow = true;
            gGroup.add(lp);
          }
          if (hasRightEdge) {
            const rp = new THREE.Mesh(gatePlinthGeo, matWallStone);
            rp.position.set(TS * 0.48, 22, 0);
            rp.castShadow = true;
            gGroup.add(rp);
          }

          this.mapGroup.add(gGroup);
        }
      }
    }

    // Castle Town Corner Watchtowers with Royal Blue Pitched Roofs!
    if (isTown) {
      const towerRoofMat = this.texBank.createToonMaterial({ color: 0x1d4ed8 }, '#fde68a');
      const towerPositions = [
        [2.5, 2.5], [31.5, 2.5], [2.5, 23.5], [31.5, 23.5],
      ];
      for (const [ttx, tty] of towerPositions) {
        const txW = ttx * TS;
        const tzW = tty * TS;
        const tyH = getTerrainHeight(txW, tzW, 'town', map);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(28, 32, 86, 10), matWallStone);
        body.position.set(txW, tyH + 40, tzW);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(38, 46, 10), towerRoofMat);
        roof.position.set(txW, tyH + 104, tzW);
        this.mapGroup.add(body, roof);
      }
    }

    // ========================================================================
    // 5. 360° DISTANT MOUNTAIN RANGE RING (BOTW HORIZON DEPTH!)
    // ========================================================================
    if (!map.meta.darkness) {
      const mtnColor = map.areaId === 'magma' ? '#5c2317' : map.areaId === 'ruins' ? '#9e8462' : map.areaId === 'secret' ? '#4338ca' : '#4b7b9e';
      const mtnMat = this.texBank.createToonMaterial({ color: mtnColor });
      const snowMat = this.texBank.createToonMaterial({ color: '#e2e8f0' });
      const cx = worldW * 0.5;
      const cz = worldH * 0.5;
      const baseDist = Math.max(worldW, worldH) * 0.72;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        const dist = baseDist + (i % 3) * 165;
        const mh = 220 + (i % 5) * 85;
        const mr = 175 + (i % 4) * 55;
        const mMesh = new THREE.Mesh(new THREE.ConeGeometry(mr, mh, 6), mtnMat);
        mMesh.position.set(cx + Math.cos(ang) * dist, mh * 0.36 - 35, cz + Math.sin(ang) * dist);
        mMesh.rotation.y = i * 1.1;
        this.mapGroup.add(mMesh);
        if (mh > 340 && (map.areaId === 'town' || map.areaId === 'forest' || map.areaId === 'citadel')) {
          const cap = new THREE.Mesh(new THREE.ConeGeometry(mr * 0.34, mh * 0.32, 6), snowMat);
          cap.position.set(mMesh.position.x, mMesh.position.y + mh * 0.35, mMesh.position.z);
          cap.rotation.y = mMesh.rotation.y;
          this.mapGroup.add(cap);
        }
      }
    }

    // ========================================================================
    // 6. WIND-SWAYING INSTANCED GRASS BLADES (UP TO 850 BLADES, 1 DRAW CALL!)
    // ========================================================================
    if (grassCandidates.length > 0) {
      const bladeCount = Math.min(850, grassCandidates.length * 2);
      const bladeGeo = new THREE.ConeGeometry(1.45, 8.2, 3);
      bladeGeo.translate(0, 4.1, 0);
      const bladeMat = this.texBank.createToonMaterial({ color: map.areaId === 'ruins' ? '#a89468' : '#58a63f' });
      this.grassInstancedMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount);
      for (let i = 0; i < bladeCount; i++) {
        const tile = grassCandidates[i % grassCandidates.length];
        const gx = tile.x + (Math.sin(i * 19.3) * 0.45) * TS;
        const gz = tile.z + (Math.cos(i * 27.7) * 0.45) * TS;
        const gy = getTerrainHeight(gx, gz, map.areaId, map);
        this.grassPositions.push({ x: gx, y: gy, z: gz, phase: (i % 17) * 0.4 });
        this.grassDummy.position.set(gx, gy, gz);
        this.grassDummy.scale.set(1, 0.8 + (i % 5) * 0.14, 1);
        this.grassDummy.updateMatrix();
        this.grassInstancedMesh.setMatrixAt(i, this.grassDummy.matrix);
      }
      this.mapGroup.add(this.grassInstancedMesh);
    }

    // ========================================================================
    // 7. ORGANIC TWISTED BRANCHING TREES, GLOWING CAVERN CRYSTALS & LANDMARKS
    // ========================================================================
    const barkMat = this.texBank.createToonMaterial({ color: 0x523620 });
    const stoneBaseMat = this.texBank.createToonMaterial({ color: 0x78716c });
    const leafMatA = this.texBank.createToonMaterial({ color: '#3b8232' }, '#bef264');
    const leafMatB = this.texBank.createToonMaterial({ color: '#2f6e28' }, '#86efac');
    let caveLightCount = 0;

    for (const pr of map.props) {
      const py = getTerrainHeight(pr.x, pr.y, map.areaId, map);
      if (pr.type === 'tree') {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(pr.x, py - 1, pr.y);
        const sc = pr.scale || 1.05;
        treeGroup.scale.setScalar(sc);

        // Flared Root Base + Curved Twisted Trunk + 2 Forking Woody Branches!
        const rootBase = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 9.5, 10, 7), barkMat);
        rootBase.position.y = 5;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 5.2, 26, 7), barkMat);
        trunk.position.set(1.2, 17, 0);
        trunk.rotation.z = -0.09;
        const b1 = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.8, 16, 6), barkMat);
        b1.position.set(-6.5, 29, 2);
        b1.rotation.z = 0.65;
        const b2 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.6, 15, 6), barkMat);
        b2.position.set(7.2, 30, -2);
        b2.rotation.z = -0.58;
        treeGroup.add(rootBase, trunk, b1, b2);

        // Soft Overlapping Organic Broadleaf Canopy Clusters (NO stiff stacked cones!)
        const clusters = [
          { x: 0, y: 40, z: 0, r: 16.5, sx: 1.25, sy: 0.78, mat: leafMatA },
          { x: -11, y: 34, z: 4, r: 12.5, sx: 1.15, sy: 0.75, mat: leafMatB },
          { x: 11, y: 35, z: -4, r: 13.0, sx: 1.15, sy: 0.78, mat: leafMatA },
          { x: 2, y: 36, z: 10, r: 11.5, sx: 1.1, sy: 0.72, mat: leafMatB },
          { x: -2, y: 47, z: -2, r: 10.5, sx: 1.1, sy: 0.82, mat: leafMatA },
        ];
        for (const cl of clusters) {
          const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(cl.r, 1), cl.mat);
          puff.position.set(cl.x, cl.y, cl.z);
          puff.scale.set(cl.sx, cl.sy, cl.sx);
          puff.castShadow = true;
          treeGroup.add(puff);
        }
        this.mapGroup.add(treeGroup);
      } else if (pr.type === 'crystal' || pr.type === 'lamp') {
        // Multi-Spire Luminous Cavern Crystal Cluster / Royal Town Street Lantern
        const cg = new THREE.Group();
        cg.position.set(pr.x, py, pr.y);
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 10, 6, 8), stoneBaseMat);
        plinth.position.y = 3;
        const cryMat = this.texBank.createToonMaterial({
          color: pr.color || '#fbbf24',
          emissive: new THREE.Color(pr.color || '#f59e0b'),
          emissiveIntensity: 0.65,
        }, '#fffbeb');
        const mainSpire = new THREE.Mesh(new THREE.ConeGeometry(6.5, 24, 6), cryMat);
        mainSpire.position.y = 16;
        const sideSpire = new THREE.Mesh(new THREE.ConeGeometry(4.2, 15, 5), cryMat);
        sideSpire.position.set(6.5, 10, 2);
        sideSpire.rotation.z = -0.35;
        cg.add(plinth, mainSpire, sideSpire);
        this.mapGroup.add(cg);

        // Add actual soft PointLight inside Cave so cavern walls & contours shine atmospherically!
        if (map.areaId === 'cave' && caveLightCount < 6) {
          const pl = new THREE.PointLight(pr.color || '#7dd3fc', 1.45, 340);
          pl.position.set(pr.x, py + 28, pr.y);
          this.mapGroup.add(pl);
          caveLightCount += 1;
        }
      } else if (pr.type === 'monument') {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(24, 29, 9, 8), stoneBaseMat);
        base.position.set(pr.x, py + 4, pr.y);
        const mon = this.rigFactory.createArcaneCrystalSpire('#38bdf8');
        mon.scale.setScalar(1.45);
        mon.position.set(pr.x, py + 36, pr.y);
        this.mapGroup.add(base, mon);
      }
    }

    // Fantasy Town Market Stalls behind Facility NPCs in Luminaria Town!
    if (isTown) {
      const roofColors = {
        town_gear: 0x1e40af,
        town_magic: 0x6b21a8,
        town_forge: 0x9a3412,
        town_drone: 0x065f46,
        town_inn: 0xb45309,
      };
      for (const n of map.npcs) {
        if (!roofColors[n.npcId]) continue;
        const by = getTerrainHeight(n.x, n.y, 'town', map);
        const pavilion = this._createFantasyPavilion(roofColors[n.npcId]);
        const offsetZ = n.y < 12 * TS ? -26 : 26;
        pavilion.position.set(n.x, by, n.y + offsetZ);
        this.mapGroup.add(pavilion);
      }
    }

    // 3D Treasure Chests grounded to terrain
    for (const ch of map.chests) {
      const cy = getTerrainHeight(ch.x, ch.y, map.areaId, map);
      const rar = RARITY_INFO[ch.rarity] || RARITY_INFO.rare;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(24, 16, 18),
        this.texBank.createToonMaterial({
          color: ch.opened ? 0x57534e : 0x78350f,
          emissive: new THREE.Color(ch.opened ? '#000000' : rar.color),
          emissiveIntensity: 0.3,
        })
      );
      box.position.set(ch.x, cy + 8, ch.y);
      box.castShadow = true;
      this.mapGroup.add(box);
      this.chestMeshes.set(ch.id, box);
    }

    // 3D Ancient Stone Waygate Portals grounded to terrain
    for (const pt of map.portals) {
      const py = getTerrainHeight(pt.x, pt.y, map.areaId, map);
      const portalGroup = new THREE.Group();
      portalGroup.position.set(pt.x, py, pt.y);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(24, 27, 4.5, 16), stoneBaseMat);
      base.position.y = 2.2;
      const runeTex = this.texBank.getMagicCircleTexture(pt.color || '#fbbf24');
      const runeDisc = new THREE.Mesh(
        new THREE.PlaneGeometry(46, 46),
        new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })
      );
      runeDisc.rotation.x = -Math.PI / 2;
      runeDisc.position.y = 5.2;
      portalGroup.add(base, runeDisc);
      this.mapGroup.add(portalGroup);
      this.portalMeshes.set(pt.id, portalGroup);
    }

    // 3D Living NPCs grounded to terrain with role-specific fantasy props!
    for (const n of map.npcs) {
      const def = NPCS[n.npcId];
      if (!def) continue;
      const ny = getTerrainHeight(n.x, n.y, map.areaId, map);
      let mesh;
      if (def.bodyType === 'device') {
        mesh = new THREE.Group();
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(12, 15, 10, 8), stoneBaseMat);
        ped.position.y = 5;
        const slate = this.rigFactory.createArcaneCrystalSpire('#38bdf8');
        slate.scale.setScalar(0.8);
        slate.position.y = 26;
        mesh.add(ped, slate);
        mesh.position.set(n.x, ny, n.y);
      } else {
        const npcWeapon = def.role === 'shop_gear' || def.role === 'talk' ? 'blade' : def.role === 'blacksmith' ? 'dagger' : 'wand';
        mesh = this.rigFactory.createHumanoidRig({
          id: def.id,
          jobId: def.role === 'shop_magic' ? 'mage' : 'knight',
          bodyType: def.bodyType || 'male',
          color: def.color,
          accent: '#f59e0b',
          tunicColor: def.outfitColor || def.color,
          capeColor: def.color,
          hairColor: def.hairColor || '#e5b869',
          eyeColor: def.color,
          skinTone: '#f6d5b8',
          weaponType: npcWeapon,
          weaponColor: def.color,
        });
        mesh.position.set(n.x, ny, n.y);
      }
      this.mapGroup.add(mesh);
      this.npcMeshes.set(n.npcId, mesh);
    }
  }

  _createFantasyPavilion(roofColor) {
    const g = new THREE.Group();
    const stoneMat = this.texBank.createToonMaterial({ color: 0x78716c });
    const woodMat = this.texBank.createToonMaterial({ color: 0x5c3a21 });
    const trimMat = this.texBank.createToonMaterial({ color: 0xf59e0b }, '#fef08a');
    const roofMat = this.texBank.createToonMaterial({ color: roofColor }, '#fffbeb');
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const foundation = new THREE.Mesh(new THREE.BoxGeometry(62, 6, 38), stoneMat);
    foundation.position.y = 3;
    foundation.receiveShadow = true;
    g.add(foundation);

    // Timber corner posts & top crossbeams
    for (const px of [-26, 26]) {
      for (const pz of [-14, 14]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 30, 7), woodMat);
        post.position.set(px, 18, pz);
        post.castShadow = true;
        g.add(post);
      }
    }
    const beamF = new THREE.Mesh(new THREE.BoxGeometry(58, 3.2, 3.2), woodMat);
    beamF.position.set(0, 32, 14);
    const beamB = new THREE.Mesh(new THREE.BoxGeometry(58, 3.2, 3.2), woodMat);
    beamB.position.set(0, 32, -14);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(42, 11, 8), woodMat);
    counter.position.set(0, 11.5, 4);
    g.add(beamF, beamB, counter);

    // Stepped Fantasy Tent / Tile Roof with Golden Finial
    const roof = new THREE.Mesh(new THREE.ConeGeometry(46, 22, 4), roofMat);
    roof.position.y = 43;
    roof.rotation.y = Math.PI * 0.25;
    roof.castShadow = true;
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(4.2, 0), trimMat);
    finial.position.y = 55.5;
    g.add(roof, finial);

    // Warm Hanging Lanterns
    for (const lx of [-18, 18]) {
      const lan = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), lanternMat);
      lan.position.set(lx, 27.5, 14);
      g.add(lan);
    }
    return g;
  }

  _animateHumanoidRig(rig, phase, isMoving, downed, weaponDrawn = false, zHeight = 0) {
    if (!rig || !rig.userData || !rig.userData.body) return;
    const u = rig.userData;
    if (downed) {
      rig.rotation.z = Math.PI * 0.45;
      u.body.position.y = 7;
      return;
    }
    rig.rotation.z = 0;
    const bob = isMoving ? Math.abs(Math.sin(phase)) * 2.5 : Math.sin(this.time * 2.8 + phase * 0.1) * 0.85;
    u.body.position.y = 20 + bob + zHeight;
    u.body.rotation.x = isMoving ? 0.16 : 0; // Forward heroic sprint lean!

    // Toggle weapon & shield between hand (combat) and back sheath (exploration)
    if (u.weaponHand && u.backGear) {
      u.weaponHand.visible = weaponDrawn;
      u.shieldHand.visible = weaponDrawn;
      u.backGear.visible = !weaponDrawn;
    }

    if (u.capeMesh) {
      u.capeMesh.rotation.x = (isMoving ? 0.48 : 0.16) + Math.sin(phase * 1.5 + this.time * 2.4) * 0.12;
    }

    if (isMoving) {
      const s = Math.sin(phase);
      u.leftLeg.rotation.x = s * 0.72;
      u.rightLeg.rotation.x = -s * 0.72;
      if (u.lShin && u.rShin) {
        u.lShin.rotation.x = Math.max(0, -s * 0.65);
        u.rShin.rotation.x = Math.max(0, s * 0.65);
      }
      u.leftArm.rotation.x = -s * 0.56;
      u.rightArm.rotation.x = s * 0.56;
      if (u.lForeArm && u.rForeArm) {
        u.lForeArm.rotation.x = -0.35 - Math.abs(s) * 0.35;
        u.rForeArm.rotation.x = -0.45 - Math.abs(s) * 0.35;
      }
    } else {
      const breath = Math.sin(this.time * 2.6 + phase * 0.15);
      u.leftLeg.rotation.x = 0;
      u.rightLeg.rotation.x = 0;
      if (u.lShin && u.rShin) {
        u.lShin.rotation.x = 0.06;
        u.rShin.rotation.x = 0.06;
      }
      u.leftArm.rotation.x = breath * 0.06;
      u.rightArm.rotation.x = -breath * 0.06;
      if (u.lForeArm && u.rForeArm) {
        u.lForeArm.rotation.x = -0.26 + breath * 0.05;
        u.rForeArm.rotation.x = weaponDrawn ? -0.52 : -0.26 - breath * 0.05;
      }
    }
  }

  // ==========================================================================
  // MAIN IN-GAME WORLD RENDERER (TPS / FPS 3D CAMERA + MINIMAL ZELDA HUD)
  // ==========================================================================
  renderGame(game, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const map = game.map;
    const pal = map.meta.palette;

    if (this.webglAvailable) {
      this.titleGroup.visible = false;
      this.mapGroup.visible = true;
      this.entityGroup.visible = true;
      this.vfxGroup.visible = true;
      this.skyGroup.visible = !map.meta.darkness;

      this._ensure3DMap(game);
      this._sync3DEntities(game);
      this._update3DCamera(game);

      this.webglRenderer.render(this.scene, this.camera3D);
    }

    // 2. Render Minimal Zelda-Style 2D Overlay (Proximity NPC Labels, Z-Target Reticle, Stamina Wheel, Sword Trails & Damage Popups)
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.width, this.height);

    if (!this.webglAvailable) {
      ctx.fillStyle = pal.voidBg;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    this._draw3DOverlayLabels(ctx, game);

    if (map.meta.darkness) {
      this._renderDarknessMask(ctx, game);
    }

    this._ensureEnvParticles(map.areaId, map.meta.particleType);
    this._updateAndDrawEnvParticles(ctx, dt, map.meta.particleType, pal);

    if (game.screenFlash > 0) {
      ctx.fillStyle = game.screenFlashColor || `rgba(56, 189, 248, ${game.screenFlash * 0.4})`;
      ctx.globalAlpha = Math.min(0.6, game.screenFlash);
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    this._renderMinimap(game);
  }

  _update3DCamera(game) {
    const p = game.player;
    const cam = game.camera;
    const areaId = game.currentAreaId;
    const playerGroundY = getTerrainHeight(p.x, p.y, areaId) + (p.zHeight || 0);

    // Move dynamic shadow frustum and sky dome with player
    this.sunLight.position.set(p.x + 180, playerGroundY + 460, p.y + 220);
    this.sunLight.target.position.set(p.x, playerGroundY, p.y);
    this.sunLight.target.updateMatrixWorld();
    this.skyGroup.position.set(p.x, 0, p.y);

    for (const c of this.clouds) {
      c.angle += 0.0005;
      c.mesh.position.x = Math.cos(c.angle) * c.dist;
      c.mesh.position.z = Math.sin(c.angle) * c.dist;
    }

    // Gentle shimmering water tide animation
    if (this.waterMeshes && this.waterMeshes.length > 0) {
      for (const wm of this.waterMeshes) {
        wm.position.y = -4.6 + Math.sin(this.time * 2.2) * 0.45;
      }
    }

    // Wind-swaying grass animation
    if (this.grassInstancedMesh && this.grassPositions.length > 0) {
      const len = this.grassPositions.length;
      for (let i = 0; i < len; i++) {
        const gp = this.grassPositions[i];
        this.grassDummy.position.set(gp.x, gp.y, gp.z);
        this.grassDummy.rotation.z = Math.sin(this.time * 2.6 + gp.phase) * 0.22;
        this.grassDummy.updateMatrix();
        this.grassInstancedMesh.setMatrixAt(i, this.grassDummy.matrix);
      }
      this.grassInstancedMesh.instanceMatrix.needsUpdate = true;
    }

    if (cam.mode === 'fps') {
      if (this.playerRig && this.playerRig.userData.headGroup) {
        this.playerRig.userData.headGroup.visible = false;
      }
      const eyeY = playerGroundY + 36;
      const lookYaw = cam.yaw;
      this.camera3D.position.set(
        p.x + Math.cos(lookYaw) * 4,
        eyeY,
        p.y + Math.sin(lookYaw) * 4
      );
      this.camera3D.lookAt(
        p.x + Math.cos(lookYaw) * 180,
        eyeY - Math.sin(cam.pitch) * 90,
        p.y + Math.sin(lookYaw) * 180
      );
    } else {
      if (this.playerRig && this.playerRig.userData.headGroup) {
        this.playerRig.userData.headGroup.visible = true;
      }
      const baseDist = cam.mode === 'action' ? cam.distance * 0.72 : cam.distance;
      const pitch = cam.pitch;
      const yaw = cam.yaw;

      let safeDist = baseDist;
      const backDirX = -Math.cos(yaw) * Math.cos(pitch);
      const backDirZ = -Math.sin(yaw) * Math.cos(pitch);
      for (let step = 32; step <= baseDist; step += 20) {
        const testX = cam.x + backDirX * step;
        const testZ = cam.y + backDirZ * step;
        const t = getTile(game.map, Math.floor(testX / TS), Math.floor(testZ / TS));
        if (t === TILE.WALL || t === TILE.CRACKED) {
          safeDist = Math.max(52, step - 18);
          break;
        }
      }

      const camWX = cam.x + backDirX * safeDist + game.shakeOffset.x;
      const camWZ = cam.y + backDirZ * safeDist + game.shakeOffset.y;
      const terrainUnderCam = getTerrainHeight(camWX, camWZ, areaId);
      const camWY = Math.max(terrainUnderCam + 24, playerGroundY + 34 + Math.sin(pitch) * safeDist);

      this.camera3D.position.set(camWX, camWY, camWZ);

      let lookX = cam.x + Math.cos(yaw) * 32;
      let lookZ = cam.y + Math.sin(yaw) * 32;
      let lookY = playerGroundY + 26;
      if (game.lockTarget && (game.lockTarget.alive || game.lockTarget.hp > 0)) {
        lookX = (p.x + game.lockTarget.x) * 0.5;
        lookZ = (p.y + game.lockTarget.y) * 0.5;
      }
      this.camera3D.lookAt(lookX, lookY, lookZ);
    }

    this.playerPointLight.position.set(p.x, playerGroundY + 44, p.y);
  }

  _sync3DEntities(game) {
    const p = game.player;
    const st = p.getStats();
    const job = p.getJob();
    const areaId = game.currentAreaId;

    // 1. Local Player 6.5-Head Stylized 3D Rig
    const rigKey = `${p.jobId}_${p.bodyType}_${p.equippedWeapon}_${p.equippedArmor}`;
    if (!this.playerRig || this.playerRigKey !== rigKey) {
      if (this.playerRig) this.entityGroup.remove(this.playerRig);
      const wpType = p.getWeaponData().type || 'blade';
      this.playerRig = this.rigFactory.createHumanoidRig({
        id: p.jobId,
        jobId: p.jobId,
        bodyType: p.bodyType || 'male',
        ...job,
        weaponType: wpType,
        weaponColor: st.weaponColor,
      });
      this.playerRigKey = rigKey;
      this.entityGroup.add(this.playerRig);
    }

    const pGroundY = getTerrainHeight(p.x, p.y, areaId);
    this.playerRig.position.set(p.x, pGroundY, p.y);
    this.playerRig.rotation.y = Math.PI * 0.5 - p.facing;

    // Visible Damage Invulnerability Frames (i-frames) blinking feedback!
    if (p.damageBlinkTimer > 0) {
      this.playerRig.visible = Math.floor(this.time * 18) % 2 === 0;
    } else {
      this.playerRig.visible = true;
    }

    const isMoving = Math.hypot(p.vx, p.vy) > 5;
    const weaponDrawn = p.weaponDrawnTimer > 0 || p.guarding || !game.map.meta.safe;
    this._animateHumanoidRig(this.playerRig, p.walkPhase, isMoving, p.downed, weaponDrawn, p.zHeight || 0);

    // Expressive 3-Step Combo Swing & Guard Pose Kinematics
    const u = this.playerRig.userData;
    if (p.guarding) {
      u.leftArm.rotation.x = -1.15;
      u.leftArm.rotation.y = 0.72;
      if (u.lForeArm) u.lForeArm.rotation.x = -0.65;
    } else {
      u.leftArm.rotation.y = 0;
    }
    if (p.attackAnimTimer > 0) {
      const prog = 1 - p.attackAnimTimer / 0.28;
      if (p.comboStep === 1) {
        // Step 1: Wide Right-to-Left Horizontal Sweep with Torso Twist!
        u.rightArm.rotation.x = -1.35;
        u.rightArm.rotation.z = -1.1 + prog * 2.2;
        if (u.rForeArm) u.rForeArm.rotation.x = -0.25;
        u.body.rotation.y = (0.5 - prog) * 0.95;
        u.body.rotation.x = 0.26;
      } else if (p.comboStep === 2) {
        // Step 2: Diagonal Left-to-Right Upward Rising Slash!
        u.rightArm.rotation.x = -0.25 - prog * 1.85;
        u.rightArm.rotation.z = 0.95 - prog * 1.9;
        if (u.rForeArm) u.rForeArm.rotation.x = -0.15;
        u.body.rotation.y = (prog - 0.5) * 0.95;
        u.body.rotation.x = 0.14 - prog * 0.22;
      } else {
        // Step 3: Leaping 360° Spin Cleave / Helm Breaker Finisher!
        u.rightArm.rotation.x = -1.55;
        u.rightArm.rotation.z = -0.45;
        u.body.rotation.y = prog * Math.PI * 2;
        u.body.rotation.x = 0.28;
      }
    } else {
      u.rightArm.rotation.z = 0;
      u.body.rotation.y = 0;
    }

    const aura = u.auraRing;
    if (st.weaponPlus >= 4 && !p.downed) {
      aura.material.opacity = 0.55;
      aura.material.color.set(st.weaponPlus >= 7 ? '#f59e0b' : st.weaponColor);
      aura.rotation.z = this.time * 3;
    } else {
      aura.material.opacity = 0;
    }

    // 2. Ancient Spirit Guardian Orb
    const dGroundY = getTerrainHeight(p.drone.x, p.drone.y, areaId);
    this.droneMesh.position.set(p.drone.x, dGroundY + 34 + Math.sin(this.time * 4) * 3.5, p.drone.y);
    this.droneMesh.rotation.y = this.time * 2.5;

    // 3. Living NPCs (Breathing, Gentle Arm Sway, Carried Props & Turning Gaze toward Hero!)
    for (const n of game.map.npcs) {
      const m = this.npcMeshes.get(n.npcId);
      if (m && m.userData && m.userData.body) {
        this._animateHumanoidRig(m, n.x * 0.15, false, false, true, 0);
        const distToHero = Math.hypot(p.x - n.x, p.y - n.y);
        if (distToHero < 210) {
          const targetRot = Math.PI * 0.5 - Math.atan2(p.y - n.y, p.x - n.x);
          let diff = targetRot - m.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          m.rotation.y += diff * 0.08;
        }
      } else if (m) {
        m.rotation.y = this.time * 1.4;
      }
    }

    // 4. Remote Co-op Players grounded to terrain
    const activeRemoteIds = new Set();
    for (const rp of game.network.remotePlayers.values()) {
      if (rp.areaId !== game.currentAreaId) continue;
      activeRemoteIds.add(rp.id);
      let rMesh = this.remoteMeshes.get(rp.id);
      const rKey = `${rp.jobId}_${rp.bodyType || 'male'}`;
      if (!rMesh || rMesh.userData.rKey !== rKey) {
        if (rMesh) this.entityGroup.remove(rMesh);
        const rJob = JOBS[rp.jobId] || JOBS.knight;
        rMesh = this.rigFactory.createHumanoidRig({
          id: `remote_${rp.id}`,
          jobId: rp.jobId,
          bodyType: rp.bodyType || 'male',
          ...rJob,
          weaponColor: rp.weaponColor || rJob.color,
        });
        rMesh.userData.rKey = rKey;
        this.remoteMeshes.set(rp.id, rMesh);
        this.entityGroup.add(rMesh);
      }
      const ry = getTerrainHeight(rp.x, rp.y, areaId);
      rMesh.position.set(rp.x, ry, rp.y);
      rMesh.rotation.y = Math.PI * 0.5 - rp.facing;
      this._animateHumanoidRig(rMesh, this.time * 6, true, rp.downed, true, rp.zHeight || 0);
    }
    for (const [id, mesh] of this.remoteMeshes.entries()) {
      if (!activeRemoteIds.has(id)) {
        this.entityGroup.remove(mesh);
        this.remoteMeshes.delete(id);
      }
    }

    // 5. Enemies grounded to terrain
    const aliveEnemyIds = new Set();
    for (const e of game.enemies) {
      if (!e.alive) continue;
      aliveEnemyIds.add(e.uid);
      let eMesh = this.enemyMeshes.get(e.uid);
      if (!eMesh) {
        eMesh = this.rigFactory.createEnemyRig(e);
        this.enemyMeshes.set(e.uid, eMesh);
        this.entityGroup.add(eMesh);
      }
      const ey = getTerrainHeight(e.x, e.y, areaId);
      eMesh.position.set(e.x, ey, e.y);
      eMesh.rotation.y = Math.PI * 0.5 - e.facing;
      eMesh.userData.mainMesh.position.y = Math.sin(e.animPhase) * 2.2;
      if (eMesh.userData.mat) {
        eMesh.userData.mat.emissive.set(
          e.hitFlash > 0 ? '#ffffff' : e.parryBreakTimer > 0 ? '#eab308' : e.statuses.freeze > 0 ? '#38bdf8' : '#000000'
        );
        eMesh.userData.mat.emissiveIntensity = e.hitFlash > 0 ? 0.9 : e.parryBreakTimer > 0 ? 0.5 : 0.15;
      }
    }
    for (const [uid, mesh] of this.enemyMeshes.entries()) {
      if (!aliveEnemyIds.has(uid)) {
        this.entityGroup.remove(mesh);
        this.enemyMeshes.delete(uid);
      }
    }

    // 6. Bespoke Sculpted 3D Bosses & Floating Arcane Crystal Spires
    if (game.boss && game.boss.alive) {
      const b = game.boss;
      if (!this.bossRig || this.bossRigId !== b.id) {
        if (this.bossRig) this.entityGroup.remove(this.bossRig);
        this.bossRig = this.rigFactory.createBossRig(b);
        this.bossRigId = b.id;
        this.entityGroup.add(this.bossRig);
      }
      const by = getTerrainHeight(b.x, b.y, areaId);
      this.bossRig.visible = true;
      this.bossRig.position.set(b.x, by, b.y);
      this.bossRig.rotation.y = Math.PI * 0.5 - b.facing;

      const bu = this.bossRig.userData;
      bu.haloMesh.rotation.z = this.time * (b.phase === 2 ? 1.8 : 0.85);
      bu.shieldMesh.visible = b.isShielded();
      bu.coreMat.emissive.set(b.hitFlash > 0 ? '#ffffff' : b.parryBreakTimer > 0 ? '#eab308' : b.phase === 2 ? '#991b1b' : '#000000');

      // Living Bespoke Boss Kinematics (Dragon Wing Flap, Tail Undulation, Treant Arms, Sovereign Greatsword!)
      const ap = bu.animParts;
      if (ap) {
        const beat = this.time * (b.phase === 2 ? 4.8 : 3.0);
        bu.coreMesh.position.y = Math.sin(beat) * 3.5;
        for (const w of ap.wings) {
          w.mesh.rotation.z = Math.sin(beat + (w.idx || 0) * 0.5) * 0.36 * w.dir;
        }
        for (const arm of ap.arms) {
          arm.mesh.rotation.x = Math.sin(beat * 0.9 + arm.dir) * 0.42;
        }
        for (const seg of ap.tailSegs) {
          seg.mesh.position.x = Math.sin(beat - seg.idx * 0.65) * (4 + seg.idx * 2.5);
        }
        if (ap.neck) {
          ap.neck.rotation.x = Math.sin(beat * 0.8) * 0.14;
        }
        if (ap.weaponArm) {
          ap.weaponArm.rotation.x = -0.35 + Math.sin(beat * 1.1) * 0.55;
        }
      }

      const liveCrystals = new Set();
      for (const c of b.crystals) {
        if (c.hp <= 0) continue;
        liveCrystals.add(c.id);
        let cMesh = this.crystalMeshes.get(c.id);
        if (!cMesh) {
          cMesh = this.rigFactory.createArcaneCrystalSpire(b.def.accent || '#38bdf8');
          this.crystalMeshes.set(c.id, cMesh);
          this.entityGroup.add(cMesh);
        }
        const cy = getTerrainHeight(c.x, c.y, areaId);
        cMesh.position.set(c.x, cy + 28 + Math.sin(this.time * 3.8 + c.orbitAngle) * 4.5, c.y);
        cMesh.rotation.y = this.time * 1.8;
        if (cMesh.userData.ring1) cMesh.userData.ring1.rotation.z = this.time * 2.6;
        if (cMesh.userData.ring2) cMesh.userData.ring2.rotation.x = -this.time * 2.1;
      }
      for (const [cid, mesh] of this.crystalMeshes.entries()) {
        if (!liveCrystals.has(cid)) {
          this.entityGroup.remove(mesh);
          this.crystalMeshes.delete(cid);
        }
      }
    } else {
      if (this.bossRig) this.bossRig.visible = false;
      for (const [cid, mesh] of this.crystalMeshes.entries()) {
        this.entityGroup.remove(mesh);
        this.crystalMeshes.delete(cid);
      }
    }

    // 7. Projectiles & Drops grounded to terrain
    while (this.vfxGroup.children.length > 0) {
      this.vfxGroup.remove(this.vfxGroup.children[0]);
    }
    const projGeo = new THREE.SphereGeometry(5.5, 10, 10);
    for (const pr of game.projectiles) {
      const py = getTerrainHeight(pr.x, pr.y, areaId);
      const pm = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: pr.color }));
      pm.scale.setScalar((pr.radius || 7) / 5.5);
      pm.position.set(pr.x, py + 18, pr.y);
      this.vfxGroup.add(pm);
    }

    const dropGeo = new THREE.OctahedronGeometry(6.5, 0);
    for (const d of game.drops) {
      if (d.collected) continue;
      const dy = getTerrainHeight(d.x, d.y, areaId);
      const dm = new THREE.Mesh(dropGeo, new THREE.MeshBasicMaterial({ color: d.color }));
      dm.position.set(d.x, dy + 10 + Math.sin(this.time * 5 + d.x) * 3, d.y);
      dm.rotation.y = this.time * 3;
      this.vfxGroup.add(dm);
    }
  }

  _draw3DOverlayLabels(ctx, game) {
    const map = game.map;
    const p = game.player;
    const areaId = game.currentAreaId;

    // 1. Boss Danger Telegraphs (Grounded to Terrain Height!)
    if (game.boss && game.boss.alive) {
      for (const tg of game.boss.telegraphs) {
        const progress = Math.min(1, tg.timer / tg.chargeTime);
        const firing = tg.timer >= tg.chargeTime;
        const ty = getTerrainHeight(tg.x, tg.y, areaId) + 2;
        const sc = this.worldToScreen(tg.x, ty, tg.y);
        if (sc.behind) continue;

        ctx.save();
        if (tg.type === 'circle') {
          const edge = this.worldToScreen(tg.x + tg.radius, ty, tg.y);
          const rx = Math.max(12, Math.abs(edge.x - sc.x));
          const ry = rx * 0.62;
          ctx.fillStyle = firing ? 'rgba(254, 243, 199, 0.82)' : `rgba(239, 68, 68, ${0.18 + progress * 0.25})`;
          ctx.beginPath();
          ctx.ellipse(sc.x, sc.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else if (tg.type === 'laser') {
          const ex = tg.x + Math.cos(tg.angle) * tg.length;
          const ey = tg.y + Math.sin(tg.angle) * tg.length;
          const se = this.worldToScreen(ex, ty + 10, ey);
          ctx.strokeStyle = firing ? '#ef4444' : `rgba(239, 68, 68, ${0.45 + progress * 0.5})`;
          ctx.lineWidth = firing ? tg.width * 0.75 : 4 + progress * 4;
          if (!firing) ctx.setLineDash([12, 8]);
          ctx.beginPath();
          ctx.moveTo(sc.x, sc.y);
          ctx.lineTo(se.x, se.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 2. Z-Targeting Lock-On Reticle (Zelda BotW / OoT Golden Rotating Triangles!)
    if (game.lockTarget && (game.lockTarget.alive || game.lockTarget.hp > 0)) {
      const lt = game.lockTarget;
      const ly = getTerrainHeight(lt.x, lt.y, areaId) + (lt.radius || 20) + 14;
      const sc = this.worldToScreen(lt.x, ly, lt.y);
      if (!sc.behind) {
        ctx.save();
        ctx.translate(sc.x, sc.y);
        ctx.rotate(this.time * 3.2);
        ctx.strokeStyle = '#fbbf24';
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.5;
        const r = 22 + Math.sin(this.time * 8) * 3;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 2);
          ctx.beginPath();
          ctx.moveTo(0, -r + 4);
          ctx.lineTo(-5, -r - 6);
          ctx.lineTo(5, -r - 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
    }

    // 3. Zelda-Style Circular Stamina Wheel (Ganbari Gauge) beside Player
    if (p.staminaDisplayAlpha > 0.02) {
      const py = getTerrainHeight(p.x, p.y, areaId) + (p.zHeight || 0) + 34;
      const sc = this.worldToScreen(p.x, py, p.y);
      if (!sc.behind) {
        const wx = sc.x + 36;
        const wy = sc.y - 10;
        const ratio = Math.max(0, Math.min(1, p.stamina / p.maxStamina));
        ctx.save();
        ctx.globalAlpha = p.staminaDisplayAlpha;
        ctx.beginPath();
        ctx.arc(wx, wy, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.fill();
        ctx.lineWidth = 5.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(wx, wy, 15, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
        ctx.strokeStyle = ratio < 0.25 ? '#ef4444' : '#22c55e';
        ctx.lineWidth = 5.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 4. Sweeping Sword Slash Trails (1st Right Sweep, 2nd Left Slash, 3rd 360 Spin)
    for (const s of game.slashes) {
      const ratio = s.life / s.maxLife;
      const sy = getTerrainHeight(s.x, s.y, areaId) + 20;
      const sc = this.worldToScreen(s.x, sy, s.y);
      if (sc.behind) continue;
      ctx.save();
      ctx.translate(sc.x, sc.y);
      ctx.scale(1, 0.65);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 18;
      ctx.globalAlpha = ratio;
      ctx.lineWidth = (16 + (s.weaponPlus || 0) * 1.5) * ratio;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 0.9, s.angle - s.arc * 0.5, s.angle + s.arc * 0.5);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5 * ratio;
      ctx.stroke();
      ctx.restore();
    }

    // 5. Particles & Lightning Chains
    for (const pt of game.particles) {
      const ratio = Math.max(0, pt.life / pt.maxLife);
      const py = getTerrainHeight(pt.x, pt.y, areaId) + 14;
      const sc = this.worldToScreen(pt.x, py, pt.y);
      if (sc.behind) continue;
      ctx.save();
      ctx.globalAlpha = ratio;
      if (pt.ring) {
        const r = (pt.size + (1 - ratio) * pt.expand) * 0.82;
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3 * ratio;
        ctx.beginPath();
        ctx.ellipse(sc.x, sc.y, r, r * 0.65, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (pt.lightning) {
        const te = this.worldToScreen(pt.tx, py, pt.ty);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3.2 * ratio;
        ctx.beginPath();
        ctx.moveTo(sc.x, sc.y);
        ctx.lineTo((sc.x + te.x) * 0.5 + (Math.random() - 0.5) * 22, (sc.y + te.y) * 0.5 + (Math.random() - 0.5) * 22);
        ctx.lineTo(te.x, te.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, pt.size * ratio, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. Proximity-Faded NPC & Portal Labels (Only visible within 260px (~12m) so 3D view stays clean!)
    const maxLabelDist = 260;
    for (const pt of map.portals) {
      const dist = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (dist > maxLabelDist) continue;
      const alpha = Math.min(1, (maxLabelDist - dist) / 80);
      const locked = game.isPortalLocked(pt);
      const py = getTerrainHeight(pt.x, pt.y, areaId) + 32;
      const sc = this.worldToScreen(pt.x, py, pt.y);
      if (sc.behind) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.lineWidth = 3.5;
      const txt = locked ? `🔒 ${pt.label}` : pt.label;
      ctx.strokeText(txt, sc.x, sc.y);
      ctx.fillStyle = locked ? '#cbd5e1' : '#fef08a';
      ctx.fillText(txt, sc.x, sc.y);
      ctx.restore();
    }

    for (const n of map.npcs) {
      const dist = Math.hypot(p.x - n.x, p.y - n.y);
      if (dist > maxLabelDist) continue;
      const alpha = Math.min(1, (maxLabelDist - dist) / 80);
      const def = NPCS[n.npcId];
      if (!def) continue;
      const ny = getTerrainHeight(n.x, n.y, areaId) + 46;
      const sc = this.worldToScreen(n.x, ny, n.y);
      if (sc.behind) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.lineWidth = 3.5;
      const label = `${def.icon} ${n.label || def.name}`;
      ctx.strokeText(label, sc.x, sc.y);
      ctx.fillStyle = '#fffbeb';
      ctx.fillText(label, sc.x, sc.y);

      if (dist < 78) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '800 11px sans-serif';
        ctx.strokeText('[話す / F]', sc.x, sc.y - 16);
        ctx.fillText('[話す / F]', sc.x, sc.y - 16);
      }
      ctx.restore();
    }

    // 7. Enemy HP Bars (When damaged or locked on)
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const isLocked = game.lockTarget === e;
      if (!isLocked && e.hp >= e.maxHp && e.parryBreakTimer <= 0) continue;
      const ey = getTerrainHeight(e.x, e.y, areaId) + e.radius * 2 + 16;
      const sc = this.worldToScreen(e.x, ey, e.y);
      if (sc.behind) continue;
      const bw = 42;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fillRect(sc.x - bw * 0.5, sc.y, bw, 5);
      ctx.fillStyle = e.parryBreakTimer > 0 ? '#fde047' : '#ef4444';
      ctx.fillRect(sc.x - bw * 0.5, sc.y, bw * (e.hp / e.maxHp), 5);
    }

    // 8. Speech Bubbles & Floating Damage Popups
    if (p.chatBubble) {
      const py = getTerrainHeight(p.x, p.y, areaId) + 52;
      const sc = this.worldToScreen(p.x, py, p.y);
      if (!sc.behind) this._drawBubbleAt(ctx, sc.x, sc.y, p.chatBubble.text);
    }

    for (const t of game.damageTexts) {
      const ratio = Math.max(0, t.life / t.maxLife);
      const ty = getTerrainHeight(t.x, t.y, areaId) + 46 + (1 - ratio) * 34;
      const sc = this.worldToScreen(t.x, ty, t.y);
      if (sc.behind) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, ratio * 1.4);
      const size = Math.min(20, Math.round(13.5 * (t.scale || 1)));
      ctx.font = `900 ${size}px ui-monospace, "Hiragino Kaku Gothic ProN", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.lineWidth = 3.5;
      ctx.strokeText(t.text, sc.x, sc.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, sc.x, sc.y);
      ctx.restore();
    }
  }

  _drawBubbleAt(ctx, sx, sy, text) {
    ctx.save();
    ctx.font = '800 12px "Hiragino Kaku Gothic ProN", sans-serif';
    const tw = ctx.measureText(text).width;
    const bw = tw + 20;
    const bh = 26;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(sx - bw * 0.5, sy - bh, bw, bh, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fffbeb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, sy - bh * 0.5);
    ctx.restore();
  }

  _renderDarknessMask(ctx, game) {
    const lc = this.lightCanvas;
    const lctx = this.lctx;
    const sx = lc.width / this.width;
    const sy = lc.height / this.height;

    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lc.width, lc.height);
    // Atmospheric blue-tinted cavern dusk so cliffs, ridges & stairs remain readable!
    lctx.fillStyle = 'rgba(10, 20, 42, 0.56)';
    lctx.fillRect(0, 0, lc.width, lc.height);

    lctx.globalCompositeOperation = 'destination-out';
    const punchLight = (wx, wy, radius) => {
      const sc = this.worldToScreen(wx, 18, wy);
      if (sc.behind) return;
      const lx = sc.x * sx;
      const ly = sc.y * sy;
      const lr = radius * sx * 1.15;
      const g = lctx.createRadialGradient(lx, ly, lr * 0.16, lx, ly, lr);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.65, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.arc(lx, ly, lr, 0, Math.PI * 2);
      lctx.fill();
    };

    punchLight(game.player.x, game.player.y, 320);
    punchLight(game.player.drone.x, game.player.drone.y, 170);
    for (const l of game.map.lights) punchLight(l.x, l.y, l.radius * 1.2);
    if (game.boss && game.boss.alive) punchLight(game.boss.x, game.boss.y, 290);

    ctx.drawImage(lc, 0, 0, this.width, this.height);
  }

  _ensureEnvParticles(areaId, type) {
    if (this.envAreaId === areaId && this.envParticles.length > 0) return;
    this.envAreaId = areaId;
    this.envParticles = [];
    for (let i = 0; i < 42; i++) {
      this.envParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 20,
        vy: type === 'embers' ? -(26 + Math.random() * 44) : (Math.random() - 0.5) * 16,
        size: 2 + Math.random() * 3.2,
        alpha: 0.22 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        hue: Math.random(),
      });
    }
  }

  _updateAndDrawEnvParticles(ctx, dt, type, pal) {
    const w = this.width;
    const h = this.height;
    ctx.save();
    for (const p of this.envParticles) {
      p.phase += dt * 2.2;
      p.x += (p.vx + Math.sin(p.phase) * 10) * dt;
      p.y += p.vy * dt;
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;
      ctx.globalAlpha = p.alpha * (0.65 + 0.35 * Math.sin(p.phase));
      ctx.fillStyle = p.hue > 0.5 ? pal.neon : pal.neonAlt;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================================================================
  // LIVE MINIMAP & COMPASS RENDERER (WITH CAMERA CONE & FACILITY ICONS)
  // ==========================================================================
  _renderMinimap(game) {
    const mctx = this.mctx;
    if (!mctx) return;
    const map = game.map;
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;

    mctx.fillStyle = '#0c1524';
    mctx.fillRect(0, 0, mw, mh);

    const sx = mw / map.width;
    const sy = mh / map.height;

    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const t = getTile(map, tx, ty);
        if (t === TILE.VOID) continue;
        if (t === TILE.WALL || t === TILE.CRACKED) {
          mctx.fillStyle = t === TILE.CRACKED ? '#d97706' : '#475569';
        } else if (t === TILE.WATER) {
          mctx.fillStyle = '#0284c7';
        } else if (t === TILE.GATE || t === TILE.BOSS_GATE) {
          mctx.fillStyle = '#ef4444';
        } else if (t === TILE.BOSS_FLOOR) {
          mctx.fillStyle = '#4c1d95';
        } else if (t === TILE.ACCENT) {
          mctx.fillStyle = '#78716c';
        } else {
          mctx.fillStyle = '#2d4f38';
        }
        mctx.fillRect(tx * sx, ty * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }

    const toM = (wx, wy) => ({ x: (wx / map.pixelWidth) * mw, y: (wy / map.pixelHeight) * mh });

    for (const pt of map.portals) {
      const p = toM(pt.x, pt.y);
      mctx.fillStyle = '#38bdf8';
      mctx.beginPath();
      mctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      mctx.fill();
    }
    for (const ch of map.chests) {
      if (ch.opened) continue;
      const p = toM(ch.x, ch.y);
      mctx.fillStyle = '#fbbf24';
      mctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    for (const n of map.npcs) {
      const p = toM(n.x, n.y);
      mctx.fillStyle = '#86efac';
      mctx.beginPath();
      mctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      mctx.fill();
    }
    if (map.bossArena && !game.progress.defeatedBosses.has(map.bossArena.bossId)) {
      const bPos = game.boss && game.boss.alive ? game.boss : map.bossArena.center;
      const p = toM(bPos.x, bPos.y);
      mctx.fillStyle = '#ef4444';
      mctx.beginPath();
      mctx.moveTo(p.x, p.y - 4.5);
      mctx.lineTo(p.x + 4.5, p.y);
      mctx.lineTo(p.x, p.y + 4.5);
      mctx.lineTo(p.x - 4.5, p.y);
      mctx.closePath();
      mctx.fill();
    }

    // Player Position + Camera View Cone on Minimap
    const lp = toM(game.player.x, game.player.y);
    mctx.save();
    mctx.translate(lp.x, lp.y);
    mctx.rotate(game.camera.yaw);
    mctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
    mctx.beginPath();
    mctx.moveTo(0, 0);
    mctx.arc(0, 0, 16, -0.5, 0.5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();

    mctx.fillStyle = '#fde047';
    mctx.strokeStyle = '#ffffff';
    mctx.lineWidth = 1.2;
    mctx.beginPath();
    mctx.arc(lp.x, lp.y, 3.6, 0, Math.PI * 2);
    mctx.fill();
    mctx.stroke();
  }
}
