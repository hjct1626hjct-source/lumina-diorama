// ============================================================================
// LUMINA CHRONICLES — Hyrule-Style Toon 3D Action RPG Renderer (Three.js)
// MeshToonMaterial + 4-Tone GradientMap + Rim Lighting + Painterly Textures
// 6.5-Head Stylized Heroes (Default Male), TPS Orbit Camera, Z-Target Reticle,
// Heightmap Terrain (100% Grounded), Instanced Wind-Swaying Grass & Sky Dome
// 製作者：駿 (Created by Shun)
// ============================================================================

import * as THREE from './three.module.min.js';
import { GAME_META, AREAS, JOBS, BODY_TYPES, NPCS, RARITY_INFO } from './data.js';
import { TILE, getTile, getTerrainHeight } from './map.js';

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
        // Ancient Temple Arena Stone with Faint Blue-Gold Runes
        ctx.fillStyle = '#4a453d';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.5, 68, 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === 'damage') {
        // Molten Lava / Ancient Shock Hazard Tile
        ctx.fillStyle = areaId === 'magma' ? '#7f1d1d' : '#1e3a8a';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = areaId === 'magma' ? '#fb923c' : '#38bdf8';
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

        ctx.strokeStyle = 'rgba(30, 25, 20, 0.48)';
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
        // Subtle green moss near base
        ctx.fillStyle = 'rgba(74, 124, 60, 0.35)';
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

    // 4. Articulated Legs with Folded Fantasy Boots
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-3.4, -7.2, 0);
    body.add(leftLeg);
    const lThigh = new THREE.Mesh(this.sharedGeos.lowerLimb, leatherMat);
    lThigh.position.y = -5.5;
    const lBoot = new THREE.Mesh(this.sharedGeos.bootCuff, bootMat);
    lBoot.position.y = -9.5;
    leftLeg.add(lThigh, lBoot);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(3.4, -7.2, 0);
    body.add(rightLeg);
    const rThigh = new THREE.Mesh(this.sharedGeos.lowerLimb, leatherMat);
    rThigh.position.y = -5.5;
    const rBoot = new THREE.Mesh(this.sharedGeos.bootCuff, bootMat);
    rBoot.position.y = -9.5;
    rightLeg.add(rThigh, rBoot);

    // 5. Left Arm + Heraldic Shield (or Arcane Barrier Emitter)
    const leftArm = new THREE.Group();
    leftArm.position.set(-8.2 * bSpec.shoulderScale, 11.0, 0.5);
    body.add(leftArm);
    const lArmMesh = new THREE.Mesh(this.sharedGeos.upperLimb, tunicMat);
    lArmMesh.position.y = -4.5;
    leftArm.add(lArmMesh);

    const shieldHand = this._createHylianShieldMesh(color, accent);
    shieldHand.position.set(-2.2, -6.5, 3.5);
    shieldHand.rotation.y = -0.35;
    leftArm.add(shieldHand);

    // 6. Right Arm + Drawn Weapon in Hand + Sheathed Weapon & Shield on Back!
    const rightArm = new THREE.Group();
    rightArm.position.set(8.2 * bSpec.shoulderScale, 11.0, 1.0);
    body.add(rightArm);
    const rArmMesh = new THREE.Mesh(this.sharedGeos.upperLimb, tunicMat);
    rArmMesh.position.y = -4.5;
    rArmMesh.rotation.x = Math.PI * 0.25;
    rightArm.add(rArmMesh);

    const weaponHand = this._createWeaponMesh(weaponType, weaponColor, accent);
    weaponHand.position.set(0, -6.5, 7.5);
    rightArm.add(weaponHand);

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
      leftArm,
      rightArm,
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
      // Bokoblin / Darknut Armored Fantasy Warrior with Horns, Club/Spear & Shield
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.42, r * 1.1, 8), mat);
      torso.position.y = r * 0.95;
      torso.rotation.y = -Math.PI / 2;
      const head = new THREE.Mesh(new THREE.BoxGeometry(r * 0.72, r * 0.65, r * 0.72), mat);
      head.position.y = r * 1.78;
      // Horns
      for (const dir of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(2.2, 8, 5), accentMat);
        horn.position.set(dir * r * 0.36, r * 2.15, 0);
        horn.rotation.z = dir * -0.4;
        body.add(horn);
      }
      // Weapon in right hand
      const weapon = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.2, r * 1.45), accentMat);
      weapon.position.set(r * 0.68, r * 0.95, r * 0.55);
      body.add(torso, head, weapon);
    } else if (def.shape === 'golem' || def.shape === 'turret') {
      // Stone Talus / Ancient Guardian Golem with angular rock slabs & glowing rune core
      const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.85, 0), mat);
      torso.position.y = r * 1.15;
      torso.rotation.y = -Math.PI / 2;
      const lArm = new THREE.Mesh(new THREE.BoxGeometry(r * 0.55, r * 1.1, r * 0.55), mat);
      lArm.position.set(-r * 0.95, r * 1.0, 2);
      const rArm = new THREE.Mesh(new THREE.BoxGeometry(r * 0.55, r * 1.1, r * 0.55), mat);
      rArm.position.set(r * 0.95, r * 1.0, 2);
      const WeakOre = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.35, 0), accentMat);
      WeakOre.position.set(0, r * 1.95, -2);
      body.add(torso, lArm, rArm, WeakOre);
    } else if (def.shape === 'bat' || def.shape === 'beast') {
      // Winged Keese / Flame Wolf Beast
      const core = new THREE.Mesh(new THREE.ConeGeometry(r * 0.75, r * 1.5, 6), mat);
      core.rotation.x = Math.PI * 0.5;
      core.position.y = r * 0.9;
      for (const dir of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, 2.0, r * 0.65), accentMat);
        wing.position.set(dir * r * 0.8, r * 1.05, 0);
        wing.rotation.z = dir * 0.25;
        body.add(wing);
      }
      body.add(core);
    } else {
      // Chuchu / Wizzrobe / Construct with Orbiting Rune Ring
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.85, 1), mat);
      core.position.y = r * 0.95;
      core.rotation.y = -Math.PI / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, 1.4, 6, 18), accentMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = r * 0.95;
      body.add(core, ring);
    }

    root.userData = { mainMesh: body, mat };
    return root;
  }

  // Grand Ancient Colossus / Calamity Dragon Sovereign Boss Rig
  createBossRig(boss) {
    const def = boss.def;
    const r = boss.radius;
    const root = new THREE.Group();

    const tex = this.texBank.getMonsterTexture(def.id, def.color, def.accent);
    const coreMat = this.texBank.createToonMaterial({ map: tex }, def.accent);
    const goldMat = this.texBank.createToonMaterial({ color: def.accent });

    const body = new THREE.Group();
    root.add(body);

    // Towering Armored Torso + Crowned Head + Giant Pauldrons + Floating Ancient Halo
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.52, r * 1.35, 8), coreMat);
    torso.position.y = r * 0.95;
    torso.rotation.y = -Math.PI / 2;
    body.add(torso);

    const head = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.48, 0), coreMat);
    head.position.y = r * 1.85;
    body.add(head);

    for (const dir of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(r * 0.18, r * 0.85, 5), goldMat);
      horn.position.set(dir * r * 0.45, r * 2.25, 0);
      horn.rotation.z = dir * -0.45;
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(r * 0.55, r * 0.45, r * 0.65), goldMat);
      shoulder.position.set(dir * r * 0.92, r * 1.35, 0);
      body.add(horn, shoulder);
    }

    const haloMesh = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.25, 2.8, 8, 28),
      new THREE.MeshBasicMaterial({ color: def.accent })
    );
    haloMesh.rotation.x = Math.PI / 2;
    haloMesh.position.y = r * 1.1;
    root.add(haloMesh);

    const shieldMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r * 1.38, 1),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.24, wireframe: true })
    );
    shieldMesh.position.y = r * 1.05;
    root.add(shieldMesh);

    root.userData = { coreMesh: body, haloMesh, shieldMesh, coreMat };
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

    const pal = map.meta.palette;
    this.scene.background.set(pal.skyHorizon || pal.voidBg);
    if (this.skyDomeMat) {
      const tint = map.areaId === 'magma' ? '#fb923c' : map.areaId === 'ruins' ? '#fef3c7' : map.areaId === 'secret' ? '#c084fc' : '#ffffff';
      this.skyDomeMat.color.set(tint);
    }
    this.scene.fog.color.set(pal.fogColor || pal.voidBg);
    this.scene.fog.density = pal.fogDensity || 0.0008;
    this.hemiLight.color.set(pal.ambientSky || '#87ceeb');
    this.hemiLight.groundColor.set(pal.ambientGround || '#5e7a52');
    this.sunLight.color.set(pal.sunColor || '#fff5dc');

    const floorGeo = new THREE.BoxGeometry(TS, 18, TS);
    const wallGeo = new THREE.BoxGeometry(TS, 54, TS);
    const gateGeo = new THREE.BoxGeometry(TS, 44, TS);

    const matFloorA = this.texBank.createToonMaterial({ map: this.texBank.getTileTexture(map.areaId, 'floorA', pal) });
    const matFloorB = this.texBank.createToonMaterial({ map: this.texBank.getTileTexture(map.areaId, 'floorB', pal) });
    const matAccent = this.texBank.createToonMaterial({ map: this.texBank.getTileTexture(map.areaId, 'accent', pal) });
    const matBoss = this.texBank.createToonMaterial({ map: this.texBank.getTileTexture(map.areaId, 'boss', pal) });
    const matDamage = this.texBank.createToonMaterial({
      map: this.texBank.getTileTexture(map.areaId, 'damage', pal),
      emissive: new THREE.Color(map.areaId === 'magma' ? '#ea580c' : '#0284c7'),
      emissiveIntensity: 0.45,
    });
    const matWater = this.texBank.createToonMaterial({
      color: pal.water,
      emissive: new THREE.Color(pal.water),
      emissiveIntensity: 0.25,
    });
    const matWall = this.texBank.createToonMaterial({ map: this.texBank.getTileTexture(map.areaId, 'wall', pal) });
    const matCracked = this.texBank.createToonMaterial({
      map: this.texBank.getTileTexture(map.areaId, 'cracked', pal),
      emissive: new THREE.Color('#d97706'),
      emissiveIntensity: 0.25,
    });
    const matGate = new THREE.MeshBasicMaterial({ color: pal.neon, transparent: true, opacity: 0.55 });
    const matBossGate = new THREE.MeshBasicMaterial({ color: '#dc2626', transparent: true, opacity: 0.62 });

    const grassCandidates = [];

    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const t = getTile(map, tx, ty);
        if (t === TILE.VOID) continue;
        const wx = (tx + 0.5) * TS;
        const wz = (ty + 0.5) * TS;
        const groundY = getTerrainHeight(wx, wz, map.areaId);

        const alt = (tx + ty) % 2 === 0;
        let fMat = alt ? matFloorA : matFloorB;
        if (t === TILE.ACCENT) fMat = matAccent;
        else if (t === TILE.BOSS_FLOOR) fMat = matBoss;
        else if (t === TILE.DAMAGE) fMat = matDamage;
        else if (t === TILE.WATER) fMat = matWater;

        const fMesh = new THREE.Mesh(floorGeo, fMat);
        fMesh.position.set(wx, (t === TILE.WATER ? -11 : -9) + groundY, wz);
        fMesh.receiveShadow = true;
        this.mapGroup.add(fMesh);

        if (t === TILE.FLOOR && (map.areaId === 'town' || map.areaId === 'forest' || map.areaId === 'ruins')) {
          grassCandidates.push({ x: wx, z: wz, y: groundY });
        }

        if (t === TILE.WALL || t === TILE.CRACKED) {
          const wMesh = new THREE.Mesh(wallGeo, t === TILE.CRACKED ? matCracked : matWall);
          wMesh.position.set(wx, 24 + groundY, wz);
          wMesh.castShadow = true;
          wMesh.receiveShadow = true;
          this.mapGroup.add(wMesh);
        } else if (t === TILE.GATE || t === TILE.BOSS_GATE) {
          const gMesh = new THREE.Mesh(gateGeo, t === TILE.BOSS_GATE ? matBossGate : matGate);
          gMesh.position.set(wx, 22 + groundY, wz);
          this.mapGroup.add(gMesh);
        }
      }
    }

    // Wind-Swaying Instanced Grass Blades (Up to 750 blades in a single draw call!)
    if (grassCandidates.length > 0) {
      const bladeCount = Math.min(750, grassCandidates.length * 2);
      const bladeGeo = new THREE.ConeGeometry(1.4, 7.5, 3);
      bladeGeo.translate(0, 3.75, 0);
      const bladeMat = this.texBank.createToonMaterial({ color: map.areaId === 'ruins' ? '#a39068' : '#5da844' });
      this.grassInstancedMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount);
      for (let i = 0; i < bladeCount; i++) {
        const tile = grassCandidates[i % grassCandidates.length];
        const gx = tile.x + (Math.sin(i * 19.3) * 0.42) * TS;
        const gz = tile.z + (Math.cos(i * 27.7) * 0.42) * TS;
        const gy = getTerrainHeight(gx, gz, map.areaId);
        this.grassPositions.push({ x: gx, y: gy, z: gz, phase: (i % 17) * 0.4 });
        this.grassDummy.position.set(gx, gy, gz);
        this.grassDummy.scale.set(1, 0.85 + (i % 5) * 0.12, 1);
        this.grassDummy.updateMatrix();
        this.grassInstancedMesh.setMatrixAt(i, this.grassDummy.matrix);
      }
      this.mapGroup.add(this.grassInstancedMesh);
    }

    // 3D Props (Multi-Tiered Fantasy Trees with Roots, Warm Lantern Pillars & Star Monument)
    const barkMat = this.texBank.createToonMaterial({ color: 0x4a3525 });
    const stoneBaseMat = this.texBank.createToonMaterial({ color: 0x78716c });
    for (const pr of map.props) {
      const py = getTerrainHeight(pr.x, pr.y, map.areaId);
      if (pr.type === 'tree') {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(pr.x, py, pr.y);
        // Root flare base
        const rootBase = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 8.5, 8, 7), barkMat);
        rootBase.position.y = 4;
        // Angled trunk
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.8, 22, 7), barkMat);
        trunk.position.y = 14;
        trunk.rotation.z = 0.06;
        treeGroup.add(rootBase, trunk);

        // Layered non-spherical foliage clusters
        const leafMat = this.texBank.createToonMaterial({ color: '#3b8232' }, '#bef264');
        const tiers = [
          { y: 24, r: 18, h: 16, ox: 0, oz: 0 },
          { y: 33, r: 14, h: 15, ox: 2, oz: -1 },
          { y: 41, r: 9.5, h: 12, ox: -1, oz: 1 },
        ];
        for (const tr of tiers) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(tr.r, tr.h, 7), leafMat);
          cone.position.set(tr.ox, tr.y, tr.oz);
          cone.castShadow = true;
          treeGroup.add(cone);
        }
        this.mapGroup.add(treeGroup);
      } else if (pr.type === 'crystal' || pr.type === 'lamp') {
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 6, 8), stoneBaseMat);
        plinth.position.set(pr.x, py + 3, pr.y);
        const cry = new THREE.Mesh(
          new THREE.OctahedronGeometry(10, 0),
          this.texBank.createToonMaterial({
            color: pr.color || '#f59e0b',
            emissive: new THREE.Color(pr.color || '#f59e0b'),
            emissiveIntensity: 0.55,
          })
        );
        cry.position.set(pr.x, py + 20, pr.y);
        this.mapGroup.add(plinth, cry);
      } else if (pr.type === 'monument') {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(24, 28, 8, 8), stoneBaseMat);
        base.position.set(pr.x, py + 4, pr.y);
        const mon = new THREE.Mesh(
          new THREE.OctahedronGeometry(20, 0),
          this.texBank.createToonMaterial({
            color: 0x38bdf8,
            emissive: new THREE.Color('#0284c7'),
            emissiveIntensity: 0.55,
          }, '#fef08a')
        );
        mon.position.set(pr.x, py + 34, pr.y);
        this.mapGroup.add(base, mon);
      }
    }

    // Fantasy Town Buildings / Market Stalls behind Facility NPCs in Luminaria Town!
    if (map.areaId === 'town') {
      const roofColors = {
        town_gear: 0x1e40af,
        town_magic: 0x6b21a8,
        town_forge: 0x9a3412,
        town_drone: 0x065f46,
        town_inn: 0xb45309,
      };
      for (const n of map.npcs) {
        if (!roofColors[n.npcId]) continue;
        const by = getTerrainHeight(n.x, n.y, 'town');
        const pavilion = this._createFantasyPavilion(roofColors[n.npcId]);
        const offsetZ = n.y < 12 * TS ? -26 : 26;
        pavilion.position.set(n.x, by, n.y + offsetZ);
        this.mapGroup.add(pavilion);
      }
    }

    // 3D Treasure Chests grounded to terrain
    for (const ch of map.chests) {
      const cy = getTerrainHeight(ch.x, ch.y, map.areaId);
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

    // 3D Stone Arch Portals grounded to terrain
    for (const pt of map.portals) {
      const py = getTerrainHeight(pt.x, pt.y, map.areaId);
      const portalGroup = new THREE.Group();
      portalGroup.position.set(pt.x, py, pt.y);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(24, 26, 4, 16), stoneBaseMat);
      base.position.y = 2;
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(20, 2.2, 8, 24),
        new THREE.MeshBasicMaterial({ color: pt.color || '#38bdf8' })
      );
      torus.rotation.x = Math.PI / 2;
      torus.position.y = 4.5;
      portalGroup.add(base, torus);
      this.mapGroup.add(portalGroup);
      this.portalMeshes.set(pt.id, portalGroup);
    }

    // 3D NPCs grounded to terrain
    for (const n of map.npcs) {
      const def = NPCS[n.npcId];
      if (!def) continue;
      const ny = getTerrainHeight(n.x, n.y, map.areaId);
      let mesh;
      if (def.bodyType === 'device') {
        mesh = new THREE.Group();
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(12, 15, 10, 8), stoneBaseMat);
        ped.position.y = 5;
        const slate = new THREE.Mesh(
          new THREE.OctahedronGeometry(11, 0),
          this.texBank.createToonMaterial({ color: 0x38bdf8, emissive: new THREE.Color('#0284c7'), emissiveIntensity: 0.6 })
        );
        slate.position.y = 22;
        mesh.add(ped, slate);
        mesh.position.set(n.x, ny, n.y);
      } else {
        mesh = this.rigFactory.createHumanoidRig({
          id: def.id,
          jobId: 'knight',
          bodyType: def.bodyType || 'male',
          color: def.color,
          accent: '#f59e0b',
          tunicColor: def.outfitColor || def.color,
          capeColor: def.color,
          hairColor: def.hairColor || '#e5b869',
          eyeColor: def.color,
          skinTone: '#f6d5b8',
          weaponType: 'wand',
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
    const bob = isMoving ? Math.abs(Math.sin(phase)) * 2.4 : Math.sin(this.time * 3.0) * 0.8;
    u.body.position.y = 20 + bob + zHeight;
    u.body.rotation.x = isMoving ? 0.14 : 0; // Forward heroic sprint lean!

    // Toggle weapon & shield between hand (combat) and back sheath (exploration)
    if (u.weaponHand && u.backGear) {
      u.weaponHand.visible = weaponDrawn;
      u.shieldHand.visible = weaponDrawn;
      u.backGear.visible = !weaponDrawn;
    }

    if (u.capeMesh) {
      u.capeMesh.rotation.x = (isMoving ? 0.45 : 0.16) + Math.sin(phase * 1.5) * 0.12;
    }

    if (isMoving) {
      u.leftLeg.rotation.x = Math.sin(phase) * 0.72;
      u.rightLeg.rotation.x = -Math.sin(phase) * 0.72;
      u.leftArm.rotation.x = -Math.sin(phase) * 0.52;
      u.rightArm.rotation.x = Math.sin(phase) * 0.52;
    } else {
      u.leftLeg.rotation.x = 0;
      u.rightLeg.rotation.x = 0;
      u.leftArm.rotation.x = 0;
      u.rightArm.rotation.x = 0;
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
      // First-Person View: Hide player head, show weapon in hand, look forward along facing/yaw
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
      // Over-the-Shoulder TPS Orbit Camera ('tps' or 'action') with Terrain & Wall Collision Clamping!
      if (this.playerRig && this.playerRig.userData.headGroup) {
        this.playerRig.userData.headGroup.visible = true;
      }
      const baseDist = cam.mode === 'action' ? cam.distance * 0.72 : cam.distance;
      const pitch = cam.pitch;
      const yaw = cam.yaw;

      // Check wall collisions along ray from player to camera so camera never clips inside walls!
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

      // Look slightly ahead of player (or midpoint toward Z-Targeted enemy!)
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
    const isMoving = Math.hypot(p.vx, p.vy) > 5;
    const weaponDrawn = p.weaponDrawnTimer > 0 || p.guarding || !game.map.meta.safe;
    this._animateHumanoidRig(this.playerRig, p.walkPhase, isMoving, p.downed, weaponDrawn, p.zHeight || 0);

    // 3-Step Combo Swing & Guard Pose Animation
    const u = this.playerRig.userData;
    if (p.guarding) {
      u.leftArm.rotation.x = -1.1;
      u.leftArm.rotation.y = 0.65;
    } else {
      u.leftArm.rotation.y = 0;
    }
    if (p.attackAnimTimer > 0) {
      const prog = 1 - p.attackAnimTimer / 0.28;
      if (p.comboStep === 1) {
        u.rightArm.rotation.x = -1.2;
        u.rightArm.rotation.z = -0.9 + prog * 1.8;
        u.body.rotation.y = (0.5 - prog) * 0.6;
      } else if (p.comboStep === 2) {
        u.rightArm.rotation.x = -0.4 - prog * 1.4;
        u.rightArm.rotation.z = 0.8 - prog * 1.6;
        u.body.rotation.y = (prog - 0.5) * 0.6;
      } else {
        // 3rd Hit 360 Spin Slash!
        u.rightArm.rotation.x = -1.4;
        u.body.rotation.y = prog * Math.PI * 2;
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

    // 2. Ancient Spirit Guardian Orb (Support Drone)
    const dGroundY = getTerrainHeight(p.drone.x, p.drone.y, areaId);
    this.droneMesh.position.set(p.drone.x, dGroundY + 34 + Math.sin(this.time * 4) * 3.5, p.drone.y);
    this.droneMesh.rotation.y = this.time * 2.5;

    // 3. NPCs grounded idle animation
    for (const n of game.map.npcs) {
      const m = this.npcMeshes.get(n.npcId);
      if (m && m.userData && m.userData.body) {
        this._animateHumanoidRig(m, this.time * 2 + n.x, false, false, false, 0);
      } else if (m) {
        m.rotation.y = this.time * 1.5;
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

    // 6. Boss & Guardian Crystals grounded to terrain
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
      this.bossRig.userData.haloMesh.rotation.z = this.time * (b.phase === 2 ? 3.2 : 1.4);
      this.bossRig.userData.shieldMesh.visible = b.isShielded();
      this.bossRig.userData.coreMat.emissive.set(b.hitFlash > 0 ? '#ffffff' : b.phase === 2 ? '#dc2626' : '#000000');

      const liveCrystals = new Set();
      for (const c of b.crystals) {
        if (c.hp <= 0) continue;
        liveCrystals.add(c.id);
        let cMesh = this.crystalMeshes.get(c.id);
        if (!cMesh) {
          cMesh = new THREE.Mesh(
            new THREE.OctahedronGeometry(15, 0),
            this.texBank.createToonMaterial({ color: 0x38bdf8, emissive: new THREE.Color('#0284c7'), emissiveIntensity: 0.65 })
          );
          this.crystalMeshes.set(c.id, cMesh);
          this.entityGroup.add(cMesh);
        }
        const cy = getTerrainHeight(c.x, c.y, areaId);
        cMesh.position.set(c.x, cy + 22 + Math.sin(this.time * 4 + c.orbitAngle) * 4, c.y);
        cMesh.rotation.y = this.time * 2.4;
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
      const ty = getTerrainHeight(t.x, t.y, areaId) + 32 + (1 - ratio) * 28;
      const sc = this.worldToScreen(t.x, ty, t.y);
      if (sc.behind) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, ratio * 1.4);
      const size = Math.round(15 * (t.scale || 1));
      ctx.font = `900 ${size}px ui-monospace, "Hiragino Kaku Gothic ProN", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = 4;
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
    lctx.fillStyle = 'rgba(4, 9, 20, 0.85)';
    lctx.fillRect(0, 0, lc.width, lc.height);

    lctx.globalCompositeOperation = 'destination-out';
    const punchLight = (wx, wy, radius) => {
      const sc = this.worldToScreen(wx, 14, wy);
      if (sc.behind) return;
      const lx = sc.x * sx;
      const ly = sc.y * sy;
      const lr = radius * sx * 0.95;
      const g = lctx.createRadialGradient(lx, ly, lr * 0.14, lx, ly, lr);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.72)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.arc(lx, ly, lr, 0, Math.PI * 2);
      lctx.fill();
    };

    punchLight(game.player.x, game.player.y, 260);
    punchLight(game.player.drone.x, game.player.drone.y, 130);
    for (const l of game.map.lights) punchLight(l.x, l.y, l.radius);
    if (game.boss && game.boss.alive) punchLight(game.boss.x, game.boss.y, 230);

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
