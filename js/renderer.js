// ============================================================================
// LUMINA DIORAMA — Three.js 3D WebGL Diorama & Original Textured Character Engine
// Zero External Image Assets: 100% Procedural High-Res CanvasTextures + 3D Rigs
// 製作者：駿 (Created by Shun)
// ============================================================================

import * as THREE from './three.module.min.js';
import { GAME_META, JOBS, NPCS, ENEMIES, BOSSES, RARITY_INFO } from './data.js';
import { TILE, getTile } from './map.js';

const TS = GAME_META.tileSize;

// ============================================================================
// PROCEDURAL CANVAS TEXTURE FACTORY (ALL CHARACTERS, OUTFITS, MONSTERS, TILES)
// ============================================================================
export class ProceduralTextureBank {
  constructor() {
    this.cache = new Map();
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

  // 1. Original Anime / Cyber-Fantasy Equirectangular Face Texture for 3D Sphere Head
  getFaceTexture(opts) {
    const {
      id,
      skinTone = '#ffe4c8',
      eyeColor = '#22d3ee',
      hairColor = '#38bdf8',
      gender = 'female',
      lipColor = '#ff2e93',
    } = opts;
    return this.get(`face_${id}_${eyeColor}_${hairColor}_${gender}`, 512, 256, (ctx, w, h) => {
      // Equirectangular Sphere UV: u=0.5 (x=256) is the exact front center (+Z when rotated -PI/2)
      const skinGrad = ctx.createLinearGradient(0, 0, 0, h);
      skinGrad.addColorStop(0, skinTone);
      skinGrad.addColorStop(1, '#f5c29d');
      ctx.fillStyle = skinGrad;
      ctx.fillRect(0, 0, w, h);

      // Back & side hair wrap (u < 0.30 and u > 0.70)
      ctx.fillStyle = hairColor;
      ctx.fillRect(0, 0, w * 0.28, h);
      ctx.fillRect(w * 0.72, 0, w * 0.28, h);

      const isGlamour = gender === 'female_glamour' || gender === 'female';
      // Alluring cheek blush centered on front face (x=212, x=300)
      if (isGlamour) {
        for (const bx of [210, 302]) {
          const bg = ctx.createRadialGradient(bx, 152, 2, bx, 152, 26);
          bg.addColorStop(0, gender === 'female_glamour' ? 'rgba(255, 46, 147, 0.62)' : 'rgba(251, 113, 133, 0.42)');
          bg.addColorStop(1, 'rgba(255, 46, 147, 0)');
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.arc(bx, 152, 26, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Expressive anime eyes at front of sphere (x=220 and x=292, y=126)
      const drawEye = (cx, cy, isRight) => {
        ctx.save();
        ctx.translate(cx, cy);

        // Sclera
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, isGlamour ? 19 : 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rich Glowing Iris Gradient
        const ig = ctx.createRadialGradient(0, 3, 2, 0, 0, 14);
        ig.addColorStop(0, '#ffffff');
        ig.addColorStop(0.35, eyeColor);
        ig.addColorStop(1, '#090d16');
        ctx.fillStyle = ig;
        ctx.beginPath();
        ctx.ellipse(0, 1, 12.5, isGlamour ? 15.5 : 12.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dark pupil
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(0, 2, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Catchlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-4.5, -5, 4.2, 0, Math.PI * 2);
        ctx.arc(4.5, 4, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Heart highlight for Sexy Valkyrie / Succubus
        if (gender === 'female_glamour') {
          ctx.fillStyle = '#ff9be2';
          ctx.beginPath();
          ctx.arc(0, 4.5, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Thick winged upper eyelashes
        ctx.strokeStyle = '#1a1025';
        ctx.lineWidth = isGlamour ? 5.0 : 3.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 2, 17.5, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();

        if (isGlamour) {
          ctx.beginPath();
          const dir = isRight ? 1 : -1;
          ctx.moveTo(dir * 15, -5);
          ctx.lineTo(dir * 23, -12);
          ctx.stroke();
        }

        // Eyebrow
        ctx.strokeStyle = '#2d1936';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-14, -22);
        ctx.quadraticCurveTo(0, -28, 14, -21);
        ctx.stroke();

        ctx.restore();
      };

      drawEye(220, 126, false);
      drawEye(292, 126, true);

      // Nose highlight & shadow at x=256
      ctx.fillStyle = 'rgba(180, 110, 90, 0.42)';
      ctx.beginPath();
      ctx.arc(256, 152, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Glossy Lips / Mouth at x=256
      if (gender === 'female_glamour') {
        ctx.fillStyle = lipColor;
        ctx.beginPath();
        ctx.moveTo(240, 178);
        ctx.quadraticCurveTo(256, 171, 272, 178);
        ctx.quadraticCurveTo(256, 192, 240, 178);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(256, 181, 6, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Sexy beauty mark under eye
        ctx.fillStyle = '#2d122b';
        ctx.beginPath();
        ctx.arc(298, 156, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#c26d6d';
        ctx.lineWidth = 3.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(256, 174, 11, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }

      // Top hair bangs framing forehead across front face
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, 74);
      for (let x = w; x >= 0; x -= 24) {
        ctx.lineTo(x - 12, 98);
        ctx.lineTo(x - 24, 68);
      }
      ctx.closePath();
      ctx.fill();
    });
  }

  // 1b. Sculpted Bust Bikini Cup Texture (Upper cleavage skin + lower neon bikini cup & gold trim)
  getBustCupTexture(primary, accent, skinTone, isGlamour) {
    return this.get(`bust_${primary}_${accent}_${skinTone}_${isGlamour}`, 128, 128, (ctx, w, h) => {
      // Upper sphere is warm skin cleavage
      const sg = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      sg.addColorStop(0, skinTone);
      sg.addColorStop(1, '#f3bfa0');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);

      // Soft specular skin shine on upper bust
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.34, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bikini cup covering lower 56% of sphere with seductive V-trim
      const cupStart = isGlamour ? Math.floor(h * 0.46) : Math.floor(h * 0.25);
      ctx.fillStyle = isGlamour ? '#170d2b' : primary;
      ctx.fillRect(0, cupStart, w, h - cupStart);

      // Glowing neon cup rim & lace accent
      ctx.fillStyle = primary;
      ctx.fillRect(0, cupStart, w, 8);
      ctx.fillStyle = accent;
      ctx.fillRect(0, cupStart + 8, w, 4);
    });
  }

  // 2. Original Body / Outfit Texture (Armor, Bikini Armor, Succubus Corset, Robes)
  getOutfitTexture(opts) {
    const {
      id,
      style = 'cyber_knight',
      primary = '#22d3ee',
      accent = '#fbbf24',
      skinTone = '#ffe4c8',
    } = opts;
    return this.get(`outfit_${id}_${style}_${primary}_${accent}`, 256, 256, (ctx, w, h) => {
      if (style === 'sexy_bikini_armor' || style === 'succubus_bondage' || style === 'glamour_dress') {
        // Bare skin torso base with cleavage & midriff shading
        const sg = ctx.createLinearGradient(0, 0, 0, h);
        sg.addColorStop(0, skinTone);
        sg.addColorStop(0.5, '#fbd0b0');
        sg.addColorStop(1, skinTone);
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, w, h);

        // Cleavage & waist contour shading
        ctx.strokeStyle = 'rgba(195, 115, 95, 0.45)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(128, 42);
        ctx.lineTo(128, 112);
        ctx.stroke();

        // Navel detail on bare midriff
        ctx.fillStyle = 'rgba(185, 105, 85, 0.55)';
        ctx.beginPath();
        ctx.ellipse(128, 168, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bikini top / Bustier cups
        ctx.fillStyle = '#140c24';
        ctx.strokeStyle = primary;
        ctx.lineWidth = 6;

        // Left & Right Bust Cups with V-plunge
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(128, 96);
          ctx.quadraticCurveTo(128 + dir * 48, 36, 128 + dir * 95, 68);
          ctx.quadraticCurveTo(128 + dir * 85, 125, 128, 108);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Glowing center gem / heart clasp between bust
        ctx.fillStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(128, 82);
        ctx.lineTo(140, 96);
        ctx.lineTo(128, 110);
        ctx.lineTo(116, 96);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        if (style === 'succubus_bondage') {
          // Crisscross sheer corset straps & garter belt lines
          ctx.strokeStyle = '#1e1035';
          ctx.lineWidth = 5;
          for (let y = 115; y <= 175; y += 20) {
            ctx.beginPath();
            ctx.moveTo(88, y);
            ctx.lineTo(168, y + 12);
            ctx.moveTo(168, y);
            ctx.lineTo(88, y + 12);
            ctx.stroke();
          }
        }

        // Low-rise hip belt & sexy V-cut micro bottom
        ctx.fillStyle = '#140c24';
        ctx.beginPath();
        ctx.moveTo(0, 195);
        ctx.lineTo(128, 215);
        ctx.lineTo(w, 195);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = accent;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, 196);
        ctx.lineTo(128, 216);
        ctx.lineTo(w, 196);
        ctx.stroke();
      } else {
        // Cyber Armor / Astral Robe / Kunoichi Bodysuit
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, '#132238');
        bg.addColorStop(1, '#091120');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Glowing neon chest circuit lines
        ctx.strokeStyle = primary;
        ctx.shadowColor = primary;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 7;
        ctx.strokeRect(18, 18, w - 36, h - 36);

        ctx.beginPath();
        ctx.moveTo(40, 60);
        ctx.lineTo(128, 110);
        ctx.lineTo(216, 60);
        ctx.moveTo(128, 110);
        ctx.lineTo(128, 215);
        ctx.stroke();

        // Center Star Core Emblem
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(128, 95, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });
  }

  // 3. Stocking / Fishnet / Leg Texture
  getLegTexture(style, primary, skinTone = '#ffe4c8') {
    return this.get(`leg_${style}_${primary}_${skinTone}`, 128, 256, (ctx, w, h) => {
      // Top thigh skin (Zettai Ryoiki absolute territory!)
      ctx.fillStyle = skinTone;
      ctx.fillRect(0, 0, w, h * 0.36);

      // Garter strap ring
      ctx.fillStyle = '#180d2c';
      ctx.fillRect(0, h * 0.24, w, 12);
      ctx.fillStyle = primary;
      ctx.fillRect(0, h * 0.26, w, 4);

      // Thigh-high stocking base
      ctx.fillStyle = style === 'succubus_bondage' ? 'rgba(20, 10, 36, 0.82)' : '#121829';
      ctx.fillRect(0, h * 0.36, w, h * 0.64);

      if (style === 'succubus_bondage' || style === 'sexy_bikini_armor') {
        // Fishnet diamond mesh pattern + neon side seam
        ctx.strokeStyle = 'rgba(255, 73, 219, 0.38)';
        ctx.lineWidth = 2;
        for (let y = h * 0.36; y < h; y += 16) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y + 24);
          ctx.moveTo(w, y);
          ctx.lineTo(0, y + 24);
          ctx.stroke();
        }
      }

      // Glowing top stocking lace trim
      ctx.fillStyle = primary;
      ctx.fillRect(0, h * 0.36, w, 8);
    });
  }

  // 4. Monster / Boss Procedural Skin & Face Texture
  getMonsterTexture(id, color, accent, shape) {
    return this.get(`mon_${id}_${color}_${accent}`, 256, 256, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.4, 12, w * 0.5, h * 0.5, w * 0.65);
      g.addColorStop(0, accent);
      g.addColorStop(0.55, color);
      g.addColorStop(1, '#09101f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Cyber circuit / scales / runes pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        ctx.strokeRect(20 + i * 16, 20 + i * 16, w - 40 - i * 32, h - 40 - i * 32);
      }

      // Fierce glowing monster eyes / core visor on front
      ctx.fillStyle = '#070b14';
      ctx.beginPath();
      ctx.roundRect(44, 88, 168, 64, 24);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.stroke();

      if (shape === 'orb') {
        // Giant Cyclops Eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(128, 120, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff2e54';
        ctx.beginPath();
        ctx.arc(128, 120, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(128, 120, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Dual Cyber Fierce Eyes
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = accent;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(64, 108);
        ctx.lineTo(112, 122);
        ctx.lineTo(72, 134);
        ctx.closePath();
        ctx.moveTo(192, 108);
        ctx.lineTo(144, 122);
        ctx.lineTo(184, 134);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });
  }

  // 5. Diorama Floor & Wall Architectural Textures
  getTileTexture(areaId, kind, pal) {
    return this.get(`tile_${areaId}_${kind}`, 128, 128, (ctx, w, h) => {
      if (kind === 'floorA' || kind === 'floorB') {
        ctx.fillStyle = kind === 'floorA' ? pal.floorA : pal.floorB;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = 'rgba(56, 248, 212, 0.06)';
        ctx.fillRect(16, 16, w - 32, h - 32);
      } else if (kind === 'accent') {
        ctx.fillStyle = pal.floorAccent;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = pal.neon;
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, w - 16, h - 16);
      } else if (kind === 'boss') {
        ctx.fillStyle = '#25193d';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.35)';
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, w - 16, h - 16);
      } else if (kind === 'damage') {
        ctx.fillStyle = areaId === 'magma' ? '#7f1d1d' : '#0c4a6e';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = areaId === 'magma' ? '#fb923c' : '#38bdf8';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.beginPath();
        ctx.moveTo(24, 100);
        ctx.lineTo(64, 26);
        ctx.lineTo(104, 100);
        ctx.stroke();
      } else if (kind === 'wall') {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, pal.wallTop);
        g.addColorStop(1, pal.wallFront);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        // Neon stripe
        ctx.fillStyle = pal.neon;
        ctx.fillRect(10, h - 18, w - 20, 6);
      } else if (kind === 'cracked') {
        ctx.fillStyle = pal.wallTop;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(22, 12);
        ctx.lineTo(64, 58);
        ctx.lineTo(42, 92);
        ctx.lineTo(96, 118);
        ctx.moveTo(64, 58);
        ctx.lineTo(108, 34);
        ctx.stroke();
      }
    });
  }
}

// ============================================================================
// 3D HUMANOID & MONSTER RIG BUILDER (THREE.JS MESH HIERARCHIES)
// ============================================================================
export class CharacterRigFactory {
  constructor(texBank) {
    this.texBank = texBank;
    this.sharedGeos = {
      head: new THREE.SphereGeometry(7.2, 20, 18),
      hairCap: new THREE.SphereGeometry(7.7, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
      ponytail: new THREE.ConeGeometry(4.2, 16, 12),
      horn: new THREE.ConeGeometry(1.8, 7.5, 8),
      maleTorso: new THREE.CylinderGeometry(6.8, 5.6, 15, 16),
      femaleTorso: new THREE.CylinderGeometry(6.2, 4.3, 14, 18),
      hips: new THREE.CylinderGeometry(4.6, 6.4, 7, 16),
      glamourBust: new THREE.SphereGeometry(3.75, 16, 14),
      glamourGlute: new THREE.SphereGeometry(3.8, 14, 12),
      limb: new THREE.CylinderGeometry(2.1, 1.8, 12, 12),
      thigh: new THREE.CylinderGeometry(2.9, 2.1, 13, 14),
      wing: new THREE.PlaneGeometry(14, 20),
      shadow: new THREE.CircleGeometry(15, 24),
    };
  }

  createHumanoidRig(spec) {
    const {
      id = 'hero',
      gender = 'female_glamour',
      color = '#22d3ee',
      accent = '#38f8d4',
      hairColor = '#fde047',
      eyeColor = '#ff2e93',
      skinTone = '#ffe4c8',
      outfitStyle = 'sexy_bikini_armor',
      weaponType = 'blade',
      weaponColor = '#38f8d4',
    } = spec;

    const root = new THREE.Group();
    const isFemale = gender === 'female' || gender === 'female_glamour';
    const isGlamour = gender === 'female_glamour';

    // Ground soft shadow disc
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(this.sharedGeos.shadow, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.4;
    root.add(shadow);

    // Character articulated body container
    const body = new THREE.Group();
    body.position.y = 14;
    root.add(body);

    // Textures
    const faceTex = this.texBank.getFaceTexture({ id, skinTone, eyeColor, hairColor, gender });
    const outfitTex = this.texBank.getOutfitTexture({ id, style: outfitStyle, primary: color, accent, skinTone });
    const legTex = this.texBank.getLegTexture(outfitStyle, color, skinTone);

    const skinMat = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.45, metalness: 0.05 });
    const outfitMat = new THREE.MeshStandardMaterial({
      map: outfitTex,
      roughness: 0.35,
      metalness: 0.25,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.18,
    });
    const legMat = new THREE.MeshStandardMaterial({
      map: legTex,
      roughness: 0.38,
      metalness: 0.15,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.35,
      metalness: 0.15,
      emissive: new THREE.Color(hairColor),
      emissiveIntensity: 0.12,
    });

    // 1. Torso & Hourglass Hips
    const torsoMesh = new THREE.Mesh(
      isFemale ? this.sharedGeos.femaleTorso : this.sharedGeos.maleTorso,
      outfitMat
    );
    torsoMesh.position.y = 7;
    torsoMesh.rotation.y = -Math.PI / 2; // align texture front with +Z
    body.add(torsoMesh);

    const hipsMesh = new THREE.Mesh(this.sharedGeos.hips, outfitMat);
    hipsMesh.position.y = -1.5;
    if (isGlamour) hipsMesh.scale.set(1.22, 1.0, 1.18);
    body.add(hipsMesh);

    // 2. Sculpted Glamour Bust & Curves for Female Characters
    const bustGroup = new THREE.Group();
    bustGroup.position.set(0, 9.2, 4.2);
    body.add(bustGroup);

    if (isFemale) {
      const bustScale = isGlamour ? 0.98 : 0.72;
      const bustTex = this.texBank.getBustCupTexture(color, accent, skinTone, isGlamour);
      const bustMat = new THREE.MeshStandardMaterial({
        map: bustTex,
        roughness: 0.32,
        metalness: 0.15,
      });
      const cupMat = new THREE.MeshStandardMaterial({
        color: isGlamour ? '#160d29' : color,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.28,
        roughness: 0.28,
        metalness: 0.35,
      });

      const leftBust = new THREE.Mesh(this.sharedGeos.glamourBust, bustMat);
      leftBust.position.set(-2.7, 0.2, -0.4);
      leftBust.scale.set(bustScale, bustScale * 0.92, bustScale * 1.05);
      bustGroup.add(leftBust);

      const rightBust = new THREE.Mesh(this.sharedGeos.glamourBust, bustMat);
      rightBust.position.set(2.7, 0.2, -0.4);
      rightBust.scale.set(bustScale, bustScale * 0.92, bustScale * 1.05);
      bustGroup.add(rightBust);

      if (isGlamour) {
        // Sculpted Glutes
        for (const s of [-2.4, 2.4]) {
          const glute = new THREE.Mesh(this.sharedGeos.glamourGlute, cupMat);
          glute.position.set(s, -2.5, -3.5);
          glute.scale.set(0.95, 0.95, 0.9);
          body.add(glute);
        }
      }
    }

    // 3. Textured Head & Hair & Accessories (Succubus Horns / Valkyrie Wings)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 19.5, 0);
    body.add(headGroup);

    const headMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.4,
      metalness: 0.05,
    });
    const headMesh = new THREE.Mesh(this.sharedGeos.head, headMat);
    headMesh.rotation.y = -Math.PI / 2; // align face texture u=0.5 with +Z forward
    headGroup.add(headMesh);

    const hairCap = new THREE.Mesh(this.sharedGeos.hairCap, hairMat);
    hairCap.position.y = 0.8;
    hairCap.rotation.x = -0.46; // tilted back so front anime eyes & bangs show clearly!
    headGroup.add(hairCap);

    let hairTail = null;
    if (isFemale) {
      // Flowing twin-tails or long ponytail
      hairTail = new THREE.Group();
      hairTail.position.set(0, 2, -6);
      headGroup.add(hairTail);

      if (outfitStyle === 'succubus_bondage' || outfitStyle === 'sexy_bikini_armor') {
        // Voluminous Twin-tails
        for (const dir of [-1, 1]) {
          const tail = new THREE.Mesh(this.sharedGeos.ponytail, hairMat);
          tail.position.set(dir * 6.5, -4, -1);
          tail.rotation.x = Math.PI * 0.82;
          tail.rotation.z = dir * -0.28;
          hairTail.add(tail);
        }
      } else {
        const tail = new THREE.Mesh(this.sharedGeos.ponytail, hairMat);
        tail.position.set(0, -4, -2);
        tail.rotation.x = Math.PI * 0.78;
        hairTail.add(tail);
      }
    }

    // Succubus Horns / Valkyrie Halo & Glowing Neon Wings
    if (outfitStyle === 'succubus_bondage' || outfitStyle === 'sexy_bikini_armor') {
      const hornMat = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.6,
      });
      for (const dir of [-1, 1]) {
        const horn = new THREE.Mesh(this.sharedGeos.horn, hornMat);
        horn.position.set(dir * 5.2, 6.8, 1.5);
        horn.rotation.z = dir * -0.45;
        horn.rotation.x = -0.2;
        headGroup.add(horn);
      }

      // Holographic Neon Energy Wings on back
      const wingMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });
      for (const dir of [-1, 1]) {
        const wing = new THREE.Mesh(this.sharedGeos.wing, wingMat);
        wing.position.set(dir * 9, 10, -5);
        wing.rotation.y = dir * -0.45;
        wing.rotation.z = dir * 0.25;
        body.add(wing);
      }
    }

    // 4. Articulated Legs (Thigh-High Stockings / Boots) & Arms
    const leftLeg = new THREE.Mesh(this.sharedGeos.thigh, isFemale ? legMat : outfitMat);
    leftLeg.position.set(-3.4, -8.5, 0);
    body.add(leftLeg);

    const rightLeg = new THREE.Mesh(this.sharedGeos.thigh, isFemale ? legMat : outfitMat);
    rightLeg.position.set(3.4, -8.5, 0);
    body.add(rightLeg);

    const leftArm = new THREE.Mesh(this.sharedGeos.limb, isGlamour ? skinMat : outfitMat);
    leftArm.position.set(-8.2, 8.5, 1);
    leftArm.rotation.z = 0.22;
    body.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(8.2, 10.5, 2);
    body.add(rightArm);

    const rArmMesh = new THREE.Mesh(this.sharedGeos.limb, isGlamour ? skinMat : outfitMat);
    rArmMesh.position.y = -3;
    rArmMesh.rotation.x = Math.PI * 0.35;
    rightArm.add(rArmMesh);

    // 5. 3D Neon Weapon attached to Right Hand
    const weaponGroup = this._createWeaponMesh(weaponType, weaponColor);
    weaponGroup.position.set(0, -4, 8);
    rightArm.add(weaponGroup);

    // 6. Forge Aura Ring
    const auraGeo = new THREE.RingGeometry(16, 18.5, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    const auraRing = new THREE.Mesh(auraGeo, auraMat);
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 1.2;
    root.add(auraRing);

    root.userData = {
      body,
      bustGroup,
      headGroup,
      hairTail,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      weaponGroup,
      auraRing,
      outfitMat,
      spec,
    };
    return root;
  }

  _createWeaponMesh(type, color) {
    const group = new THREE.Group();
    const glowMat = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.8,
    });
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });

    if (type === 'wand') {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 22, 8), hiltMat);
      shaft.rotation.x = Math.PI / 2;
      group.add(shaft);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(4.2, 1), glowMat);
      orb.position.z = 12;
      group.add(orb);
    } else if (type === 'dagger') {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(2.0, 16, 6), glowMat);
      blade.rotation.x = Math.PI / 2;
      blade.position.z = 6;
      group.add(blade);
    } else {
      // Neon Blade / Rose Scythe
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 24), glowMat);
      blade.position.z = 10;
      group.add(blade);
    }
    return group;
  }

  createEnemyRig(enemy) {
    const def = enemy.def;
    const root = new THREE.Group();
    const r = enemy.radius;

    // Ground shadow
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.95, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.4;
    root.add(shadow);

    const tex = this.texBank.getMonsterTexture(def.id, def.color, def.accent, def.shape);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.32,
      metalness: 0.35,
      emissive: new THREE.Color(def.color),
      emissiveIntensity: 0.25,
    });

    // If Astral Valkyrie enemy, give her an armored female valkyrie figure!
    if (def.id === 'astral_knight') {
      const rig = this.createHumanoidRig({
        id: 'enemy_valkyrie',
        gender: 'female_glamour',
        color: def.color,
        accent: def.accent,
        hairColor: '#f472b6',
        eyeColor: '#38f8d4',
        skinTone: '#ffe4e6',
        outfitStyle: 'sexy_bikini_armor',
        weaponType: 'blade',
        weaponColor: def.accent,
      });
      root.add(rig);
      root.userData = { mainMesh: rig.userData.body, isHumanoid: true, humRig: rig, mat };
      return root;
    }

    let geo;
    if (def.shape === 'diamond') geo = new THREE.OctahedronGeometry(r * 0.95, 0);
    else if (def.shape === 'hex') geo = new THREE.CylinderGeometry(r * 0.85, r * 0.95, r * 1.4, 6);
    else if (def.shape === 'tri') geo = new THREE.ConeGeometry(r * 0.95, r * 1.7, 4);
    else if (def.shape === 'square') geo = new THREE.BoxGeometry(r * 1.45, r * 1.55, r * 1.45);
    else geo = new THREE.SphereGeometry(r * 0.95, 20, 16);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = r + 3;
    root.add(mesh);

    // Orbiting Neon Ring for elites
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.1, 1.3, 8, 24),
      new THREE.MeshBasicMaterial({ color: def.accent })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = r + 3;
    root.add(ring);

    root.userData = { mainMesh: mesh, ring, mat };
    return root;
  }

  createBossRig(boss) {
    const def = boss.def;
    const r = boss.radius;
    const root = new THREE.Group();

    const tex = this.texBank.getMonsterTexture(def.id, def.color, def.accent, 'hex');
    const coreMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.25,
      metalness: 0.65,
      emissive: new THREE.Color(def.color),
      emissiveIntensity: 0.38,
    });

    // Imposing 3D Mech Sovereign Core + Crown Horns + Rotating Halo Wings
    const coreMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.88, 1), coreMat);
    coreMesh.position.y = r + 8;
    root.add(coreMesh);

    const haloMat = new THREE.MeshBasicMaterial({ color: def.accent, wireframe: true });
    const haloMesh = new THREE.Mesh(new THREE.TorusGeometry(r * 1.25, 3.2, 10, 32), haloMat);
    haloMesh.rotation.x = Math.PI / 2;
    haloMesh.position.y = r + 8;
    root.add(haloMesh);

    // Invulnerable Hex Energy Shield Sphere
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.26,
      wireframe: true,
    });
    const shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.35, 1), shieldMat);
    shieldMesh.position.y = r + 8;
    root.add(shieldMesh);

    root.userData = { coreMesh, haloMesh, shieldMesh, coreMat };
    return root;
  }
}

// ============================================================================
// MAIN HYBRID THREE.JS WebGL + 2D HUD LABEL RENDERER
// ============================================================================
export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.mctx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    // Create dedicated Three.js WebGL Canvas behind the 2D HUD/Label overlay canvas
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

    // Offscreen darkness mask
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

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('#06101f');

      // Diorama Tilt-Shift Perspective Camera (Angled top-down 3D view matching 2D world coordinates!)
      this.camera3D = new THREE.PerspectiveCamera(42, this.width / Math.max(1, this.height), 10, 3500);

      // Lights
      this.ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
      this.scene.add(this.ambientLight);

      this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
      this.dirLight.position.set(180, 520, 260);
      this.scene.add(this.dirLight);

      this.playerPointLight = new THREE.PointLight(0x38f8d4, 2.2, 340);
      this.scene.add(this.playerPointLight);

      // Scene Groups
      this.mapGroup = new THREE.Group();
      this.entityGroup = new THREE.Group();
      this.vfxGroup = new THREE.Group();
      this.titleGroup = new THREE.Group();
      this.scene.add(this.mapGroup);
      this.scene.add(this.entityGroup);
      this.scene.add(this.vfxGroup);
      this.scene.add(this.titleGroup);

      this._buildTitleDiorama3D();

      this.builtAreaId = null;
      this.builtTowerFloor = -1;
      this.builtWallStateHash = '';

      // Dynamic Entity Mesh Pools
      this.playerRig = null;
      this.playerRigJobKey = '';
      this.droneMesh = this._createDroneMesh();
      this.entityGroup.add(this.droneMesh);

      this.npcMeshes = new Map();
      this.enemyMeshes = new Map();
      this.remoteMeshes = new Map();
      this.chestMeshes = new Map();
      this.portalMeshes = new Map();
      this.trapMeshes = new Map();
      this.dropMeshes = new Map();
      this.projectileMeshes = new Map();
      this.crystalMeshes = new Map();
      this.bossRig = null;
      this.bossRigId = '';

      this.webglAvailable = true;
    } catch (err) {
      console.warn('WebGL fallback to 2D Canvas:', err);
      this.webglAvailable = false;
    }
  }

  _buildTitleDiorama3D() {
    // Showcase Floating 3D Island + Star Crystal + Rotating Sexy Neon Valkyrie & Succubus Figurines!
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0e7490,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0x083344,
    });
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(135, 105, 36, 8), baseMat);
    slab.position.y = -24;
    this.titleGroup.add(slab);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(136, 3, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0x38f8d4 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -6;
    this.titleGroup.add(rim);

    // Center Floating Star Crystal
    const cryMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x38f8d4,
      emissiveIntensity: 0.65,
      roughness: 0.1,
      metalness: 0.8,
    });
    this.titleCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(38, 0), cryMat);
    this.titleCrystal.position.y = 48;
    this.titleGroup.add(this.titleCrystal);

    // Showcase 3D Heroines on Title Island!
    const valkSpec = JOBS.valkyrie;
    this.titleValkyrie = this.rigFactory.createHumanoidRig({
      id: 'title_valk',
      ...valkSpec,
      weaponType: 'blade',
      weaponColor: valkSpec.color,
    });
    this.titleValkyrie.scale.set(1.55, 1.55, 1.55);
    this.titleValkyrie.position.set(-68, -5, 42);
    this.titleValkyrie.rotation.y = 0.45;
    this.titleGroup.add(this.titleValkyrie);

    const sucSpec = JOBS.seraphina;
    this.titleSuccubus = this.rigFactory.createHumanoidRig({
      id: 'title_suc',
      ...sucSpec,
      weaponType: 'wand',
      weaponColor: sucSpec.color,
    });
    this.titleSuccubus.scale.set(1.55, 1.55, 1.55);
    this.titleSuccubus.position.set(68, -5, 42);
    this.titleSuccubus.rotation.y = -0.45;
    this.titleGroup.add(this.titleSuccubus);
  }

  _createDroneMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.OctahedronGeometry(7, 0),
      new THREE.MeshStandardMaterial({ color: 0x38f8d4, emissive: 0x22d3ee, emissiveIntensity: 0.7 })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(10, 1.2, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    );
    ring.rotation.x = Math.PI / 2;
    g.add(body);
    g.add(ring);
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

  // Convert 3D world position (wx, heightY, wz) to 2D canvas overlay screen coordinates
  worldToScreen(wx, heightY, wz) {
    if (!this.webglAvailable || !this.camera3D) {
      return { x: wx, y: wz - heightY };
    }
    const v = new THREE.Vector3(wx, heightY, wz);
    v.project(this.camera3D);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-v.y * 0.5 + 0.5) * this.height,
    };
  }

  // ==========================================================================
  // TITLE SCREEN — 3D DIORAMA SHOWCASE + GLOWING NEON LOGO
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
      this.scene.background.set('#050d1d');

      this.titleGroup.rotation.y = Math.sin(this.time * 0.45) * 0.32;
      this.titleGroup.position.y = Math.sin(this.time * 1.8) * 6 + 35;
      if (this.titleCrystal) {
        this.titleCrystal.rotation.y = this.time * 1.6;
        this.titleCrystal.position.y = 48 + Math.sin(this.time * 2.8) * 6;
      }
      this._animateHumanoidRig(this.titleValkyrie, this.time * 2.5, false, false);
      this._animateHumanoidRig(this.titleSuccubus, this.time * 2.5 + 1.5, false, false);

      this.camera3D.position.set(0, 175, 420);
      this.camera3D.lookAt(0, 20, 0);
      this.webglRenderer.render(this.scene, this.camera3D);
    }

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, w, h);

    if (!this.webglAvailable) {
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.32, 30, w * 0.5, h * 0.45, Math.max(w, h) * 0.85);
      bg.addColorStop(0, '#10294d');
      bg.addColorStop(1, '#030813');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    // Glowing Animated Neon Title Logo
    const cx = w * 0.5;
    const cy = Math.min(h * 0.28, h - 372);
    const scale = Math.min(1.06, Math.max(0.66, Math.min(w, h) / 720));
    const logoY = cy + 168 * scale;
    const titleSize = Math.min(60, Math.max(30, w * 0.064));

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pulse = 18 + Math.sin(this.time * 3.1) * 10;
    ctx.font = `900 ${titleSize}px "Hiragino Kaku Gothic ProN", "Segoe UI", sans-serif`;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = pulse + 12;

    const grad = ctx.createLinearGradient(cx - 240, logoY - 26, cx + 240, logoY + 26);
    const shift = (Math.sin(this.time * 1.4) + 1) * 0.5;
    grad.addColorStop(0, '#ecfeff');
    grad.addColorStop(0.35 + shift * 0.15, '#38f8d4');
    grad.addColorStop(0.7, '#ff2e93');
    grad.addColorStop(1, '#fef08a');

    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(4, 14, 30, 0.85)';
    ctx.strokeText(GAME_META.title, cx, logoY);
    ctx.fillStyle = grad;
    ctx.fillText(GAME_META.title, cx, logoY);

    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fbbf24';
    ctx.font = `800 ${Math.min(16, Math.max(11, w * 0.018))}px "Hiragino Kaku Gothic ProN", sans-serif`;
    ctx.fillStyle = '#e0f2fe';
    ctx.fillText(`${GAME_META.subtitle} [3D THREE.JS EDITION]`, cx, logoY + titleSize * 0.68);
    ctx.restore();

    ctx.restore();
  }

  // ==========================================================================
  // BUILD & SYNC 3D DIORAMA MAP GEOMETRY
  // ==========================================================================
  _ensure3DMap(game) {
    const map = game.map;
    const wallHash = `${map.areaId}_${map.towerFloor}_${game.progress.brokenWalls.size}_${game.progress.activatedSwitches.size}_${map.bossArena?.active ? 1 : 0}`;
    if (this.builtWallStateHash === wallHash) return;
    this.builtWallStateHash = wallHash;

    // Clear previous map meshes
    while (this.mapGroup.children.length > 0) {
      this.mapGroup.remove(this.mapGroup.children[0]);
    }
    this.chestMeshes.clear();
    this.portalMeshes.clear();
    this.trapMeshes.clear();
    this.npcMeshes.clear();

    const pal = map.meta.palette;
    this.scene.background.set(pal.voidBg);

    const floorGeo = new THREE.BoxGeometry(TS, 10, TS);
    const wallGeo = new THREE.BoxGeometry(TS, 44, TS);
    const gateGeo = new THREE.BoxGeometry(TS, 36, TS);

    const matFloorA = new THREE.MeshStandardMaterial({ map: this.texBank.getTileTexture(map.areaId, 'floorA', pal), roughness: 0.65 });
    const matFloorB = new THREE.MeshStandardMaterial({ map: this.texBank.getTileTexture(map.areaId, 'floorB', pal), roughness: 0.65 });
    const matAccent = new THREE.MeshStandardMaterial({ map: this.texBank.getTileTexture(map.areaId, 'accent', pal), roughness: 0.4, emissive: new THREE.Color(pal.neon), emissiveIntensity: 0.12 });
    const matBoss = new THREE.MeshStandardMaterial({ map: this.texBank.getTileTexture(map.areaId, 'boss', pal), roughness: 0.45 });
    const matDamage = new THREE.MeshStandardMaterial({ map: this.texBank.getTileTexture(map.areaId, 'damage', pal), emissive: new THREE.Color(map.areaId === 'magma' ? '#ef4444' : '#38bdf8'), emissiveIntensity: 0.45 });
    const matWater = new THREE.MeshStandardMaterial({ color: pal.water, roughness: 0.15, metalness: 0.6, emissive: new THREE.Color(pal.water), emissiveIntensity: 0.35 });
    const matWall = new THREE.MeshStandardMaterial({ map: this.texBank.getTileTexture(map.areaId, 'wall', pal), roughness: 0.45, metalness: 0.2 });
    const matCracked = new THREE.MeshStandardMaterial({ map: this.texBank.getTileTexture(map.areaId, 'cracked', pal), emissive: new THREE.Color('#fbbf24'), emissiveIntensity: 0.35 });
    const matGate = new THREE.MeshBasicMaterial({ color: pal.neon, transparent: true, opacity: 0.55, wireframe: false });
    const matBossGate = new THREE.MeshBasicMaterial({ color: '#ff2e54', transparent: true, opacity: 0.62 });

    // Instanced or grouped tile building
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const t = getTile(map, tx, ty);
        if (t === TILE.VOID) continue;
        const wx = (tx + 0.5) * TS;
        const wz = (ty + 0.5) * TS;

        const alt = (tx + ty) % 2 === 0;
        let fMat = alt ? matFloorA : matFloorB;
        if (t === TILE.ACCENT) fMat = matAccent;
        else if (t === TILE.BOSS_FLOOR) fMat = matBoss;
        else if (t === TILE.DAMAGE) fMat = matDamage;
        else if (t === TILE.WATER) fMat = matWater;

        const fMesh = new THREE.Mesh(floorGeo, fMat);
        fMesh.position.set(wx, t === TILE.WATER ? -7 : -5, wz);
        this.mapGroup.add(fMesh);

        if (t === TILE.WALL || t === TILE.CRACKED) {
          const wMesh = new THREE.Mesh(wallGeo, t === TILE.CRACKED ? matCracked : matWall);
          wMesh.position.set(wx, 22, wz);
          this.mapGroup.add(wMesh);
        } else if (t === TILE.GATE || t === TILE.BOSS_GATE) {
          const gMesh = new THREE.Mesh(gateGeo, t === TILE.BOSS_GATE ? matBossGate : matGate);
          gMesh.position.set(wx, 18, wz);
          this.mapGroup.add(gMesh);
        }
      }
    }

    // 3D Props (Trees, Crystals, Star Monument)
    for (const pr of map.props) {
      if (pr.type === 'tree') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 18, 8), new THREE.MeshStandardMaterial({ color: 0x3f2e21 }));
        trunk.position.set(pr.x, 9, pr.y);
        const foliage = new THREE.Mesh(
          new THREE.ConeGeometry(20, 38, 8),
          new THREE.MeshStandardMaterial({ color: pr.color, emissive: new THREE.Color(pr.color), emissiveIntensity: 0.28 })
        );
        foliage.position.set(pr.x, 30, pr.y);
        this.mapGroup.add(trunk, foliage);
      } else if (pr.type === 'crystal' || pr.type === 'lamp') {
        const cry = new THREE.Mesh(
          new THREE.OctahedronGeometry(11, 0),
          new THREE.MeshStandardMaterial({ color: pr.color, emissive: new THREE.Color(pr.color), emissiveIntensity: 0.75 })
        );
        cry.position.set(pr.x, 22, pr.y);
        this.mapGroup.add(cry);
      } else if (pr.type === 'monument') {
        const mon = new THREE.Mesh(
          new THREE.OctahedronGeometry(24, 0),
          new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x38f8d4, emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.1 })
        );
        mon.position.set(pr.x, 38, pr.y);
        this.mapGroup.add(mon);
      }
    }

    // 3D Chests
    for (const ch of map.chests) {
      const rar = RARITY_INFO[ch.rarity] || RARITY_INFO.rare;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(26, 18, 20),
        new THREE.MeshStandardMaterial({
          color: ch.opened ? 0x334155 : 0x1e293b,
          emissive: new THREE.Color(ch.opened ? '#000000' : rar.color),
          emissiveIntensity: 0.45,
        })
      );
      box.position.set(ch.x, 9, ch.y);
      this.mapGroup.add(box);
      this.chestMeshes.set(ch.id, box);
    }

    // 3D Portals
    for (const pt of map.portals) {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(22, 2.5, 10, 28),
        new THREE.MeshBasicMaterial({ color: pt.color || '#38f8d4' })
      );
      torus.rotation.x = Math.PI / 2;
      torus.position.set(pt.x, 3, pt.y);
      this.mapGroup.add(torus);
      this.portalMeshes.set(pt.id, torus);
    }

    // 3D NPCs with Original Textured 3D Bodies!
    for (const n of map.npcs) {
      const def = NPCS[n.npcId];
      if (!def) continue;
      let mesh;
      if (def.gender === 'device') {
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(14, 1),
          new THREE.MeshStandardMaterial({ color: def.color, emissive: new THREE.Color(def.color), emissiveIntensity: 0.65 })
        );
        mesh.position.set(n.x, 20, n.y);
      } else {
        mesh = this.rigFactory.createHumanoidRig({
          id: def.id,
          gender: def.gender || 'female_glamour',
          color: def.color,
          accent: def.outfitColor || def.color,
          hairColor: def.hairColor || def.color,
          eyeColor: def.color,
          skinTone: '#ffe8d6',
          outfitStyle: def.gender === 'female_glamour' ? 'sexy_bikini_armor' : 'cyber_knight',
          weaponType: 'wand',
          weaponColor: def.color,
        });
        mesh.position.set(n.x, 0, n.y);
      }
      this.mapGroup.add(mesh);
      this.npcMeshes.set(n.npcId, mesh);
    }
  }

  _animateHumanoidRig(rig, phase, isMoving, downed) {
    if (!rig || !rig.userData || !rig.userData.body) return;
    const u = rig.userData;
    if (downed) {
      rig.rotation.z = Math.PI * 0.45;
      u.body.position.y = 6;
      return;
    }
    rig.rotation.z = 0;
    const bob = isMoving ? Math.abs(Math.sin(phase)) * 2.8 : Math.sin(this.time * 3.2) * 1.1;
    u.body.position.y = 14 + bob;

    // Glamorous natural bounce & sway animation
    if (u.bustGroup) {
      u.bustGroup.position.y = 9.2 + Math.sin(phase * 2 + 0.6) * (isMoving ? 0.85 : 0.28);
    }
    if (u.hairTail) {
      u.hairTail.rotation.z = Math.sin(phase) * 0.18;
    }
    if (isMoving) {
      u.leftLeg.rotation.x = Math.sin(phase) * 0.65;
      u.rightLeg.rotation.x = -Math.sin(phase) * 0.65;
      u.leftArm.rotation.x = -Math.sin(phase) * 0.45;
      u.rightArm.rotation.x = Math.sin(phase) * 0.45;
    } else {
      u.leftLeg.rotation.x = 0;
      u.rightLeg.rotation.x = 0;
      u.leftArm.rotation.x = 0;
      u.rightArm.rotation.x = 0;
    }
  }

  // ==========================================================================
  // MAIN IN-GAME WORLD RENDERER (THREE.JS 3D SCENE + 2D HUD LABELS)
  // ==========================================================================
  renderGame(game, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const map = game.map;
    const pal = map.meta.palette;

    const camX = game.camera.x + game.shakeOffset.x;
    const camY = game.camera.y + game.shakeOffset.y;

    if (this.webglAvailable) {
      this.titleGroup.visible = false;
      this.mapGroup.visible = true;
      this.entityGroup.visible = true;
      this.vfxGroup.visible = true;

      this._ensure3DMap(game);
      this._sync3DEntities(game);

      // Position Diorama 3D Camera (tilted isometric perspective looking at player)
      const camHeight = 460;
      const camZOffset = 350;
      this.camera3D.position.set(camX, camHeight, camY + camZOffset);
      this.camera3D.lookAt(camX, 0, camY - 10);

      this.playerPointLight.position.set(game.player.x, 48, game.player.y);
      this.webglRenderer.render(this.scene, this.camera3D);
    }

    // 2. Render Crisp 2D Overlay (Floating Names, HP Bars, Speech Bubbles, Damage Numbers, Slashes & Cave Darkness Mask)
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.width, this.height);

    if (!this.webglAvailable) {
      // Fallback 2D background if WebGL context unavailable
      ctx.fillStyle = pal.voidBg;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Screen-projected 2D combat telegraph overlays & floating UI labels
    this._draw3DOverlayLabels(ctx, game);

    // Darkness Fog-of-War Lighting Mask (Area 2: Obsidian Crystal Cavern)
    if (map.meta.darkness) {
      this._renderDarknessMask(ctx, game);
    }

    // Screen-Space Zone Environmental Particles
    this._ensureEnvParticles(map.areaId, map.meta.particleType);
    this._updateAndDrawEnvParticles(ctx, dt, map.meta.particleType, pal);

    // Limit Break / Slow-Mo Chromatic Vignette Flash
    if (game.screenFlash > 0) {
      ctx.fillStyle = game.screenFlashColor || `rgba(56, 248, 212, ${game.screenFlash * 0.4})`;
      ctx.globalAlpha = Math.min(0.6, game.screenFlash);
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Live Minimap
    this._renderMinimap(game);
  }

  _sync3DEntities(game) {
    const p = game.player;
    const st = p.getStats();
    const job = p.getJob();

    // 1. Local Player 3D Rig
    const jobKey = `${p.jobId}_${p.equippedWeapon}_${p.equippedArmor}`;
    if (!this.playerRig || this.playerRigJobKey !== jobKey) {
      if (this.playerRig) this.entityGroup.remove(this.playerRig);
      const wpType = p.getWeaponData().type || 'blade';
      this.playerRig = this.rigFactory.createHumanoidRig({
        id: p.jobId,
        ...job,
        weaponType: wpType,
        weaponColor: st.weaponColor,
      });
      this.playerRigJobKey = jobKey;
      this.entityGroup.add(this.playerRig);
    }

    this.playerRig.position.set(p.x, 0, p.y);
    // In 2D (x, y), angle 0 is +X, PI/2 is +Y (+Z in 3D). In Three.js +Z is rotation.y = 0, +X is rotation.y = PI/2
    this.playerRig.rotation.y = Math.PI * 0.5 - p.facing;
    const isMoving = Math.hypot(p.vx, p.vy) > 5;
    this._animateHumanoidRig(this.playerRig, p.walkPhase, isMoving, p.downed);

    // Attack swing animation on right arm
    if (p.attackCooldown > 0) {
      this.playerRig.userData.rightArm.rotation.x = -Math.sin(p.attackCooldown * 18) * 1.3;
    }

    // Weapon Forge Aura Ring (+4 / +7)
    const aura = this.playerRig.userData.auraRing;
    if (st.weaponPlus >= 4 && !p.downed) {
      aura.material.opacity = 0.55;
      aura.material.color.set(st.weaponPlus >= 7 ? '#fbbf24' : st.weaponColor);
      aura.rotation.z = this.time * 3;
    } else {
      aura.material.opacity = 0;
    }

    // 2. Support Drone 3D
    this.droneMesh.position.set(p.drone.x, 30 + Math.sin(this.time * 4) * 4, p.drone.y);
    this.droneMesh.rotation.y = this.time * 2.5;

    // 3. NPCs idle animation
    for (const n of game.map.npcs) {
      const m = this.npcMeshes.get(n.npcId);
      if (m && m.userData && m.userData.body) {
        this._animateHumanoidRig(m, this.time * 2 + n.x, false, false);
      } else if (m) {
        m.rotation.y = this.time * 1.8;
      }
    }

    // 4. Remote Co-op Players
    const activeRemoteIds = new Set();
    for (const rp of game.network.remotePlayers.values()) {
      if (rp.areaId !== game.currentAreaId) continue;
      activeRemoteIds.add(rp.id);
      let rMesh = this.remoteMeshes.get(rp.id);
      if (!rMesh || rMesh.userData.jobId !== rp.jobId) {
        if (rMesh) this.entityGroup.remove(rMesh);
        const rJob = JOBS[rp.jobId] || JOBS.knight;
        rMesh = this.rigFactory.createHumanoidRig({
          id: `remote_${rp.jobId}`,
          ...rJob,
          weaponColor: rp.weaponColor || rJob.color,
        });
        rMesh.userData.jobId = rp.jobId;
        this.remoteMeshes.set(rp.id, rMesh);
        this.entityGroup.add(rMesh);
      }
      rMesh.position.set(rp.x, 0, rp.y);
      rMesh.rotation.y = Math.PI * 0.5 - rp.facing;
      this._animateHumanoidRig(rMesh, this.time * 6, true, rp.downed);
    }
    for (const [id, mesh] of this.remoteMeshes.entries()) {
      if (!activeRemoteIds.has(id)) {
        this.entityGroup.remove(mesh);
        this.remoteMeshes.delete(id);
      }
    }

    // 5. Enemies 3D Rigs
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
      eMesh.position.set(e.x, 0, e.y);
      eMesh.rotation.y = Math.PI * 0.5 - e.facing;
      if (eMesh.userData.isHumanoid) {
        this._animateHumanoidRig(eMesh.userData.humRig, e.animPhase, true, false);
      } else {
        eMesh.userData.mainMesh.position.y = e.radius + 3 + Math.sin(e.animPhase) * 3;
        if (eMesh.userData.ring) eMesh.userData.ring.rotation.z = this.time * 2;
      }
      if (eMesh.userData.mat) {
        eMesh.userData.mat.emissive.set(e.hitFlash > 0 ? '#ffffff' : e.statuses.freeze > 0 ? '#7dd3fc' : e.def.color);
        eMesh.userData.mat.emissiveIntensity = e.hitFlash > 0 ? 1.0 : 0.28;
      }
    }
    for (const [uid, mesh] of this.enemyMeshes.entries()) {
      if (!aliveEnemyIds.has(uid)) {
        this.entityGroup.remove(mesh);
        this.enemyMeshes.delete(uid);
      }
    }

    // 6. Boss & Guardian Crystals 3D
    if (game.boss && game.boss.alive) {
      const b = game.boss;
      if (!this.bossRig || this.bossRigId !== b.id) {
        if (this.bossRig) this.entityGroup.remove(this.bossRig);
        this.bossRig = this.rigFactory.createBossRig(b);
        this.bossRigId = b.id;
        this.entityGroup.add(this.bossRig);
      }
      this.bossRig.visible = true;
      this.bossRig.position.set(b.x, 0, b.y);
      this.bossRig.rotation.y = Math.PI * 0.5 - b.facing;
      this.bossRig.userData.haloMesh.rotation.z = this.time * (b.phase === 2 ? 3.2 : 1.4);
      this.bossRig.userData.shieldMesh.visible = b.isShielded();
      this.bossRig.userData.coreMat.emissive.set(b.hitFlash > 0 ? '#ffffff' : b.phase === 2 ? '#ff2e54' : b.def.color);

      // Guardian Crystals
      const liveCrystals = new Set();
      for (const c of b.crystals) {
        if (c.hp <= 0) continue;
        liveCrystals.add(c.id);
        let cMesh = this.crystalMeshes.get(c.id);
        if (!cMesh) {
          cMesh = new THREE.Mesh(
            new THREE.OctahedronGeometry(16, 0),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x22d3ee, emissiveIntensity: 0.7 })
          );
          this.crystalMeshes.set(c.id, cMesh);
          this.entityGroup.add(cMesh);
        }
        cMesh.position.set(c.x, 22 + Math.sin(this.time * 4 + c.orbitAngle) * 4, c.y);
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

    // 7. Projectiles & Drops 3D Spheres/Gems
    while (this.vfxGroup.children.length > 0) {
      this.vfxGroup.remove(this.vfxGroup.children[0]);
    }
    const projGeo = new THREE.SphereGeometry(6, 10, 10);
    for (const pr of game.projectiles) {
      const pm = new THREE.Mesh(
        projGeo,
        new THREE.MeshBasicMaterial({ color: pr.color })
      );
      pm.scale.setScalar((pr.radius || 7) / 6);
      pm.position.set(pr.x, 16, pr.y);
      this.vfxGroup.add(pm);
    }

    const dropGeo = new THREE.OctahedronGeometry(7, 0);
    for (const d of game.drops) {
      if (d.collected) continue;
      const dm = new THREE.Mesh(
        dropGeo,
        new THREE.MeshBasicMaterial({ color: d.color })
      );
      dm.position.set(d.x, 10 + Math.sin(this.time * 5 + d.x) * 3, d.y);
      dm.rotation.y = this.time * 3;
      this.vfxGroup.add(dm);
    }
  }

  _draw3DOverlayLabels(ctx, game) {
    const map = game.map;

    // 1. Boss Red Danger Telegraphs (Projected onto 3D floor)
    if (game.boss && game.boss.alive) {
      for (const tg of game.boss.telegraphs) {
        const progress = Math.min(1, tg.timer / tg.chargeTime);
        const firing = tg.timer >= tg.chargeTime;
        const sc = this.worldToScreen(tg.x, 2, tg.y);

        ctx.save();
        if (tg.type === 'circle') {
          const edge = this.worldToScreen(tg.x + tg.radius, 2, tg.y);
          const rx = Math.max(12, Math.abs(edge.x - sc.x));
          const ry = rx * 0.72;
          ctx.fillStyle = firing ? 'rgba(255, 237, 213, 0.8)' : `rgba(239, 68, 68, ${0.18 + progress * 0.25})`;
          ctx.beginPath();
          ctx.ellipse(sc.x, sc.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ff2e54';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else if (tg.type === 'laser') {
          const ex = tg.x + Math.cos(tg.angle) * tg.length;
          const ey = tg.y + Math.sin(tg.angle) * tg.length;
          const se = this.worldToScreen(ex, 12, ey);
          ctx.strokeStyle = firing ? '#ff2e54' : `rgba(255, 46, 84, ${0.45 + progress * 0.5})`;
          ctx.lineWidth = firing ? tg.width * 0.75 : 4 + progress * 4;
          if (!firing) ctx.setLineDash([12, 8]);
          ctx.beginPath();
          ctx.moveTo(sc.x, sc.y);
          ctx.lineTo(se.x, se.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Guardian Crystal Tether Lines & HP Bars
      const bossSc = this.worldToScreen(game.boss.x, 28, game.boss.y);
      for (const c of game.boss.crystals) {
        if (c.hp <= 0) continue;
        const cSc = this.worldToScreen(c.x, 24, c.y);
        ctx.save();
        ctx.strokeStyle = 'rgba(103, 232, 249, 0.65)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(cSc.x, cSc.y);
        ctx.lineTo(bossSc.x, bossSc.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(cSc.x - 20, cSc.y - 24, 40, 5);
        ctx.fillStyle = '#38f8d4';
        ctx.fillRect(cSc.x - 20, cSc.y - 24, 40 * (c.hp / c.maxHp), 5);
        ctx.restore();
      }
    }

    // 2. Melee Neon Slash Arcs & Lightning Chains
    for (const s of game.slashes) {
      const ratio = s.life / s.maxLife;
      const sc = this.worldToScreen(s.x, 18, s.y);
      ctx.save();
      ctx.translate(sc.x, sc.y);
      ctx.scale(1, 0.75);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 18;
      ctx.globalAlpha = ratio;
      ctx.lineWidth = (14 + (s.weaponPlus || 0) * 1.5) * ratio;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 0.85, s.angle - s.arc * 0.5, s.angle + s.arc * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    for (const pt of game.particles) {
      const ratio = Math.max(0, pt.life / pt.maxLife);
      const sc = this.worldToScreen(pt.x, 14, pt.y);
      ctx.save();
      ctx.globalAlpha = ratio;
      if (pt.ring) {
        const r = (pt.size + (1 - ratio) * pt.expand) * 0.82;
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3 * ratio;
        ctx.beginPath();
        ctx.ellipse(sc.x, sc.y, r, r * 0.72, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (pt.lightning) {
        const te = this.worldToScreen(pt.tx, 14, pt.ty);
        ctx.strokeStyle = pt.color;
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3.2 * ratio;
        ctx.beginPath();
        ctx.moveTo(sc.x, sc.y);
        ctx.lineTo((sc.x + te.x) * 0.5 + (Math.random() - 0.5) * 24, (sc.y + te.y) * 0.5 + (Math.random() - 0.5) * 24);
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

    // 3. Portal & NPC & Shrine Labels
    for (const pt of map.portals) {
      const locked = game.isPortalLocked(pt);
      const sc = this.worldToScreen(pt.x, 26, pt.y);
      ctx.save();
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = locked ? '#94a3b8' : '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      const txt = locked ? `🔒 ${pt.label}` : pt.label;
      ctx.strokeText(txt, sc.x, sc.y);
      ctx.fillText(txt, sc.x, sc.y);
      ctx.restore();
    }

    for (const n of map.npcs) {
      const def = NPCS[n.npcId];
      if (!def) continue;
      const sc = this.worldToScreen(n.x, 38, n.y);
      ctx.save();
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 3;
      const label = `${def.icon} ${n.label || def.name}`;
      ctx.strokeText(label, sc.x, sc.y);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(label, sc.x, sc.y);

      if (Math.hypot(game.player.x - n.x, game.player.y - n.y) < 78) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '800 10px sans-serif';
        ctx.fillText('[話す / F]', sc.x, sc.y - 15);
      }
      ctx.restore();
    }

    // 4. Enemy Mini HP Bars & Status Icons
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (e.hp < e.maxHp || e.statuses.burn > 0 || e.statuses.freeze > 0 || e.statuses.paralyze > 0) {
        const sc = this.worldToScreen(e.x, e.radius * 2 + 12, e.y);
        const bw = 38;
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(sc.x - bw * 0.5, sc.y, bw, 5);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(sc.x - bw * 0.5, sc.y, bw * (e.hp / e.maxHp), 5);
      }
    }

    // 5. Remote Players Nameplate & Rescue Ring
    for (const rp of game.network.remotePlayers.values()) {
      if (rp.areaId !== game.currentAreaId) continue;
      const sc = this.worldToScreen(rp.x, 42, rp.y);
      const job = JOBS[rp.jobId] || JOBS.knight;
      ctx.save();
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText(`${rp.name} [Lv.${rp.level} ${job.badge}]`, sc.x, sc.y);
      ctx.restore();
    }

    // 6. Speech Bubbles & Floating Damage Texts
    if (game.player.chatBubble) {
      const sc = this.worldToScreen(game.player.x, 48, game.player.y);
      this._drawBubbleAt(ctx, sc.x, sc.y, game.player.chatBubble.text);
    }
    for (const rp of game.network.remotePlayers.values()) {
      if (rp.areaId === game.currentAreaId && rp.chatBubble) {
        const sc = this.worldToScreen(rp.x, 52, rp.y);
        this._drawBubbleAt(ctx, sc.x, sc.y, rp.chatBubble.text);
      }
    }

    for (const t of game.damageTexts) {
      const ratio = Math.max(0, t.life / t.maxLife);
      const sc = this.worldToScreen(t.x, 28 + (1 - ratio) * 28, t.y);
      ctx.save();
      ctx.globalAlpha = Math.min(1, ratio * 1.4);
      const size = Math.round(15 * (t.scale || 1));
      ctx.font = `900 ${size}px ui-monospace, "Hiragino Kaku Gothic ProN", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
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
    ctx.fillStyle = 'rgba(7, 17, 34, 0.92)';
    ctx.strokeStyle = '#38f8d4';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(sx - bw * 0.5, sy - bh, bw, bh, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, sy - bh * 0.5);
    ctx.restore();
  }

  // ==========================================================================
  // DYNAMIC DARKNESS MASK (AREA 2: OBSIDIAN CRYSTAL CAVERN)
  // ==========================================================================
  _renderDarknessMask(ctx, game) {
    const lc = this.lightCanvas;
    const lctx = this.lctx;
    const sx = lc.width / this.width;
    const sy = lc.height / this.height;

    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lc.width, lc.height);
    lctx.fillStyle = 'rgba(2, 6, 16, 0.88)';
    lctx.fillRect(0, 0, lc.width, lc.height);

    lctx.globalCompositeOperation = 'destination-out';
    const punchLight = (wx, wy, radius) => {
      const sc = this.worldToScreen(wx, 12, wy);
      const lx = sc.x * sx;
      const ly = sc.y * sy;
      const lr = radius * sx * 0.85;
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

    punchLight(game.player.x, game.player.y, 250);
    punchLight(game.player.drone.x, game.player.drone.y, 120);
    for (const l of game.map.lights) punchLight(l.x, l.y, l.radius);
    if (game.boss && game.boss.alive) punchLight(game.boss.x, game.boss.y, 220);

    ctx.drawImage(lc, 0, 0, this.width, this.height);
  }

  _ensureEnvParticles(areaId, type) {
    if (this.envAreaId === areaId && this.envParticles.length > 0) return;
    this.envAreaId = areaId;
    this.envParticles = [];
    for (let i = 0; i < 48; i++) {
      this.envParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 22,
        vy: type === 'embers' || type === 'data' ? -(28 + Math.random() * 48) : (Math.random() - 0.5) * 18,
        size: 2 + Math.random() * 3.5,
        alpha: 0.25 + Math.random() * 0.5,
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
      p.phase += dt * 2.4;
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

    for (const pt of map.portals) {
      const p = toM(pt.x, pt.y);
      mctx.fillStyle = '#22d3ee';
      mctx.beginPath();
      mctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
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
      mctx.fillStyle = '#a7f3d0';
      mctx.beginPath();
      mctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
      mctx.fill();
    }
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
    for (const rp of game.network.remotePlayers.values()) {
      if (rp.areaId !== game.currentAreaId) continue;
      const p = toM(rp.x, rp.y);
      mctx.fillStyle = rp.downed ? '#ff2e54' : '#38bdf8';
      mctx.beginPath();
      mctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      mctx.fill();
    }
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
