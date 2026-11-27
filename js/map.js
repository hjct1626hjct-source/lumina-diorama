// ============================================================================
// LUMINA DIORAMA — World & 3D Diorama Map Generator + Gimmicks + Collision
// Town + 5 Main Areas + Secret Boss Vault + Procedural Endless Trial Tower
// 製作者：駿 (Created by Shun)
// ============================================================================

import { GAME_META, getAreaById } from './data.js';

export const TILE = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  WATER: 3,
  ACCENT: 4,
  DAMAGE: 5,
  CRACKED: 6,
  GATE: 7,
  BOSS_FLOOR: 8,
  BOSS_GATE: 9,
};

const TS = GAME_META.tileSize;

function createGrid(w, h, fill = TILE.VOID) {
  const grid = new Uint8Array(w * h);
  grid.fill(fill);
  return grid;
}

function setTile(map, tx, ty, val) {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;
  map.tiles[ty * map.width + tx] = val;
}

export function getTile(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return TILE.VOID;
  return map.tiles[ty * map.width + tx];
}

function fillRect(map, x, y, w, h, val) {
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      setTile(map, tx, ty, val);
    }
  }
}

function borderRect(map, x, y, w, h, val) {
  for (let tx = x; tx < x + w; tx++) {
    setTile(map, tx, y, val);
    setTile(map, tx, y + h - 1, val);
  }
  for (let ty = y; ty < y + h; ty++) {
    setTile(map, x, ty, val);
    setTile(map, x + w - 1, ty, val);
  }
}

function tCenter(tx, ty) {
  return { x: (tx + 0.5) * TS, y: (ty + 0.5) * TS };
}

function createBaseMap(areaId, width, height) {
  const areaMeta = getAreaById(areaId);
  return {
    areaId,
    meta: areaMeta,
    width,
    height,
    tileSize: TS,
    pixelWidth: width * TS,
    pixelHeight: height * TS,
    tiles: createGrid(width, height, TILE.VOID),
    spawn: tCenter(5, Math.floor(height / 2)),
    npcs: [],        // { npcId, x, y, label }
    portals: [],     // { id, x, y, targetArea, label, color, requiresBoss?, requiresClear?, requiresSecret? }
    chests: [],      // { id, x, y, opened, rarity, reward }
    switches: [],    // { id, x, y, activated, gateTiles: [{tx,ty}], color }
    crackedWalls: [],// { id, tx, ty, hp, maxHp, broken }
    shrines: [],     // { id, x, y, used }
    traps: [],       // { id, x, y, x1, y1, x2, y2, speed, phase, radius, dmg }
    lights: [],      // { x, y, radius, color } (for Crystal Cave darkness + visual beacons)
    props: [],       // { type, x, y, color, scale } (trees, crystals, pillars, consoles)
    enemySpawns: [], // { enemyId, x, y }
    bossArena: null, // { bossId, triggerRect, center, gateTiles, active, triggered }
    towerFloor: 0,
    getTerrainHeight(x, z) {
      return getTerrainHeight(x, z, areaId);
    },
  };
}

function applyPersistentState(map, progress) {
  if (!progress) return;
  for (const ch of map.chests) {
    if (progress.openedChests.has(ch.id)) ch.opened = true;
  }
  for (const cw of map.crackedWalls) {
    if (progress.brokenWalls.has(cw.id)) {
      cw.broken = true;
      cw.hp = 0;
      setTile(map, cw.tx, cw.ty, TILE.FLOOR);
    }
  }
  for (const sw of map.switches) {
    if (progress.activatedSwitches.has(sw.id)) {
      sw.activated = true;
      for (const gt of sw.gateTiles) {
        setTile(map, gt.tx, gt.ty, TILE.ACCENT);
      }
    }
  }
}

// ============================================================================
// AREA 0: 王都ルミナリア城下町 (KINGDOM OF LUMINARIA)
// ============================================================================
function buildTown(progress) {
  const map = createBaseMap('town', 34, 26);
  // Floating miniature diorama platform
  fillRect(map, 2, 2, 30, 22, TILE.FLOOR);
  borderRect(map, 2, 2, 30, 22, TILE.WALL);

  // Decorative glowing water moats in corners
  fillRect(map, 4, 4, 4, 3, TILE.WATER);
  fillRect(map, 26, 4, 4, 3, TILE.WATER);
  fillRect(map, 4, 19, 4, 3, TILE.WATER);
  fillRect(map, 26, 19, 4, 3, TILE.WATER);

  // Central Star Crystal Plaza & Cross Walkways
  fillRect(map, 13, 9, 8, 8, TILE.ACCENT);
  fillRect(map, 16, 4, 2, 18, TILE.ACCENT);
  fillRect(map, 4, 12, 26, 2, TILE.ACCENT);

  // Open East Adventure Gate
  fillRect(map, 31, 11, 1, 4, TILE.ACCENT);

  // Architectural shop pavilions (visual pillars)
  const pillars = [
    [9, 5], [13, 5], [20, 5], [24, 5],
    [9, 20], [13, 20], [20, 20], [24, 20],
  ];
  for (const [px, py] of pillars) {
    setTile(map, px, py, TILE.WALL);
    map.props.push({ type: 'lamp', ...tCenter(px, py), color: '#38f8d4' });
  }

  // Center Star Crystal Monument slightly north in plaza
  map.props.push({ type: 'monument', ...tCenter(16.5, 11.4), color: '#38bdf8', scale: 1.4 });
  map.lights.push({ ...tCenter(16.5, 11.4), radius: 240, color: '#38bdf8' });

  // Scenic Hyrule trees framing Luminaria Town corners
  const townTrees = [
    [6, 9], [6, 16], [27, 9], [27, 16],
    [10, 10], [23, 10], [10, 15], [23, 15],
  ];
  for (const [tx, ty] of townTrees) {
    map.props.push({ type: 'tree', ...tCenter(tx, ty), color: '#4c943e', scale: 1.05 });
  }

  // Town NPCs cleanly spaced
  map.npcs.push(
    { npcId: 'town_guide', ...tCenter(16.5, 9.0), label: '巫女姫リア' },
    { npcId: 'town_glamour', ...tCenter(19.5, 12.5), label: '吟遊詩人カシム' },
    { npcId: 'town_warp', ...tCenter(13.8, 12.5), label: '古代シーカー転移石碑' },
    { npcId: 'town_gear', ...tCenter(11, 7), label: '王都武具店' },
    { npcId: 'town_magic', ...tCenter(22, 7), label: '古代魔導院' },
    { npcId: 'town_forge', ...tCenter(11, 18), label: '王立鍛冶工房' },
    { npcId: 'town_drone', ...tCenter(22, 18), label: '精霊オーブ工房' },
    { npcId: 'town_inn', ...tCenter(7.5, 12.5), label: '旅人の宿屋（全回復）' }
  );

  // Portals
  map.portals.push(
    {
      id: 'pt_town_forest',
      ...tCenter(30, 12.5),
      targetArea: 'forest',
      label: '1. 風薫るフィローネ樹海へ',
      color: '#34d399',
    },
    {
      id: 'pt_town_tower',
      ...tCenter(16.5, 4.2),
      targetArea: 'tower',
      label: '🗼 剣の試練・無限の塔',
      color: '#fbbf24',
      requiresClear: true,
    },
    {
      id: 'pt_town_secret',
      ...tCenter(16.5, 21.4),
      targetArea: 'secret',
      label: '🌌 封印の星核聖域 (裏ボス)',
      color: '#f472b6',
      requiresSecret: true,
    }
  );

  // Welcome Starter Chest in Town
  map.chests.push({
    id: 'ch_town_welcome',
    ...tCenter(5.5, 9),
    opened: false,
    rarity: 'rare',
    reward: { gold: 120, ore: { type: 'stardust', count: 2 }, label: '旅立ちの支度金 120G & 星屑鉱石×2' },
  });

  // Spawn south of the Star Crystal monument facing North so TPS camera frames hero + crystal + Princess Ria cleanly!
  map.spawn = tCenter(16.5, 14.5);
  applyPersistentState(map, progress);
  return map;
}

// ============================================================================
// AREA 1: 風のフィローネ大草原＆聖樹の森 (VERDANT HIGHLANDS & GREAT WOODS)
// ============================================================================
function buildForest(progress) {
  const map = createBaseMap('forest', 46, 32);
  fillRect(map, 2, 2, 42, 28, TILE.FLOOR);
  borderRect(map, 2, 2, 42, 28, TILE.WALL);

  // Scenic glowing forest river cutting N-S with two bridges
  fillRect(map, 16, 3, 2, 26, TILE.WATER);
  fillRect(map, 16, 14, 2, 4, TILE.ACCENT);
  fillRect(map, 16, 23, 2, 3, TILE.ACCENT);

  // Main diorama wall separating mid-forest and East Boss Sector
  fillRect(map, 28, 3, 2, 26, TILE.WALL);
  // Gate opening controlled by switch
  const gateTiles = [
    { tx: 28, ty: 15 }, { tx: 29, ty: 15 },
    { tx: 28, ty: 16 }, { tx: 29, ty: 16 },
  ];
  for (const g of gateTiles) setTile(map, g.tx, g.ty, TILE.GATE);

  // Northern Secret Hidden Room behind a Cracked Wall!
  fillRect(map, 19, 3, 8, 6, TILE.WALL);
  fillRect(map, 20, 4, 6, 4, TILE.ACCENT);
  // Cracked wall entrance at bottom of hidden chamber
  setTile(map, 22, 8, TILE.CRACKED);
  setTile(map, 23, 8, TILE.CRACKED);
  map.crackedWalls.push(
    { id: 'wall_forest_1', tx: 22, ty: 8, hp: 3, maxHp: 3, broken: false },
    { id: 'wall_forest_1b', tx: 23, ty: 8, hp: 3, maxHp: 3, broken: false }
  );

  // Boss Chamber (East)
  fillRect(map, 32, 8, 10, 16, TILE.BOSS_FLOOR);
  const bossGateTiles = [
    { tx: 30, ty: 15 }, { tx: 30, ty: 16 },
  ];

  // Scenic trees & glowing mushrooms
  const treeSpots = [[7, 6], [12, 7], [8, 22], [13, 25], [21, 21], [25, 11], [25, 25]];
  for (const [tx, ty] of treeSpots) {
    setTile(map, tx, ty, TILE.WALL);
    map.props.push({ type: 'tree', ...tCenter(tx, ty), color: '#34d399', scale: 1.15 });
  }

  // NPC Scout
  map.npcs.push({ npcId: 'forest_scout', ...tCenter(11, 14.5), label: '偵察員カイト' });

  // Switch on south side opening the east gate
  map.switches.push({
    id: 'sw_forest_1',
    ...tCenter(22.5, 25.5),
    activated: false,
    gateTiles,
    color: '#34d399',
  });

  // Mystic Shrine
  map.shrines.push({ id: 'shrine_forest', ...tCenter(9, 10), used: false });

  // Chests (Normal + Secret Chamber)
  map.chests.push(
    {
      id: 'ch_forest_1',
      ...tCenter(6, 26),
      opened: false,
      rarity: 'rare',
      reward: { gold: 180, ore: { type: 'stardust', count: 3 }, weaponId: 'wp_verdant_saber' },
    },
    {
      id: 'ch_forest_secret',
      ...tCenter(22.5, 5.5),
      opened: false,
      rarity: 'epic',
      reward: { gold: 320, core: 'power', ore: { type: 'prism', count: 2 }, armorId: 'ar_lumina_mail' },
    }
  );

  // Enemies
  const spawns = [
    ['slime_lumina', 11, 9], ['slime_lumina', 13, 19], ['spore_wisp', 11, 24],
    ['slime_lumina', 20, 14], ['spore_wisp', 23, 13], ['moss_beetle', 24, 18],
    ['moss_beetle', 21, 23], ['spore_wisp', 25, 24], ['slime_lumina', 22, 16],
  ];
  for (const [enemyId, ex, ey] of spawns) {
    map.enemySpawns.push({ enemyId, ...tCenter(ex, ey) });
  }

  // Portals
  map.portals.push(
    { id: 'pt_forest_town', ...tCenter(4, 15.5), targetArea: 'town', label: '王都ルミナリア城下町へ', color: '#fbbf24' },
    { id: 'pt_forest_cave', ...tCenter(41, 15.5), targetArea: 'cave', label: '2. 暗闇の氷晶鍾乳洞へ', color: '#38bdf8', requiresBoss: 'boss_sylvarion' }
  );

  // Boss Arena
  map.bossArena = {
    bossId: 'boss_sylvarion',
    triggerRect: { x: 31 * TS, y: 7 * TS, w: 12 * TS, h: 18 * TS },
    center: tCenter(37, 15.5),
    gateTiles: bossGateTiles,
    active: false,
    triggered: false,
  };

  map.spawn = tCenter(6, 15.5);
  applyPersistentState(map, progress);
  return map;
}

// ============================================================================
// AREA 2: 暗闇の氷晶鍾乳洞 (OBSIDIAN FROST CAVERN — Dynamic Cavern Lights!)
// ============================================================================
function buildCave(progress) {
  const map = createBaseMap('cave', 46, 32);
  fillRect(map, 2, 2, 42, 28, TILE.FLOOR);
  borderRect(map, 2, 2, 42, 28, TILE.WALL);

  // Crystal Cavern internal partition walls forming dramatic winding corridors
  fillRect(map, 13, 3, 2, 15, TILE.WALL);
  fillRect(map, 13, 22, 2, 7, TILE.WALL);
  fillRect(map, 27, 3, 2, 26, TILE.WALL);

  // Glowing crystal pools & icy hazard patches
  fillRect(map, 6, 4, 5, 4, TILE.WATER);
  fillRect(map, 17, 13, 6, 3, TILE.WATER);
  fillRect(map, 18, 22, 5, 2, TILE.DAMAGE);
  fillRect(map, 20, 9, 4, 2, TILE.DAMAGE);

  // Arcane Seal Gate to Boss Sector
  const gateTiles = [
    { tx: 27, ty: 15 }, { tx: 28, ty: 15 },
    { tx: 27, ty: 16 }, { tx: 28, ty: 16 },
  ];
  for (const g of gateTiles) setTile(map, g.tx, g.ty, TILE.GATE);

  // Secret Cracked Wall Room (South-West Cave Alcove)
  fillRect(map, 4, 23, 8, 6, TILE.WALL);
  fillRect(map, 5, 24, 6, 4, TILE.ACCENT);
  setTile(map, 8, 23, TILE.CRACKED);
  setTile(map, 9, 23, TILE.CRACKED);
  map.crackedWalls.push(
    { id: 'wall_cave_1', tx: 8, ty: 23, hp: 3, maxHp: 3, broken: false },
    { id: 'wall_cave_1b', tx: 9, ty: 23, hp: 3, maxHp: 3, broken: false }
  );

  // Boss Chamber
  fillRect(map, 31, 7, 11, 18, TILE.BOSS_FLOOR);
  const bossGateTiles = [{ tx: 29, ty: 15 }, { tx: 29, ty: 16 }];

  // Ambient Luminous Crystal Torches & Glowing Moss pools illuminating cavern cliffs!
  const crystalLights = [
    [6, 15], [11, 19], [10, 9], [18, 7], [24, 6], [19, 19], [24, 25], [25, 15], [35, 11], [35, 20], [40, 15],
  ];
  for (const [lx, ly] of crystalLights) {
    const pos = tCenter(lx, ly);
    map.lights.push({ x: pos.x, y: pos.y, radius: 220, color: '#7dd3fc' });
    map.props.push({ type: 'crystal', x: pos.x, y: pos.y, color: '#7dd3fc', scale: 1.15 });
  }

  // NPC Miner
  map.npcs.push({ npcId: 'cave_miner', ...tCenter(9, 14), label: '鉱夫ドイル' });

  // Switch in North-Mid Crystal Alcove
  map.switches.push({
    id: 'sw_cave_1',
    ...tCenter(21, 5.5),
    activated: false,
    gateTiles,
    color: '#38bdf8',
  });

  // Mystic Shrine
  map.shrines.push({ id: 'shrine_cave', ...tCenter(23, 26), used: false });

  // Moving Arcane Saw Trap
  map.traps.push({
    id: 'trap_cave_1',
    ...tCenter(17, 19),
    x1: 16.5 * TS, y1: 19.5 * TS,
    x2: 25.5 * TS, y2: 19.5 * TS,
    speed: 145, phase: 0, radius: 18, dmg: 22,
  });

  // Chests
  map.chests.push(
    {
      id: 'ch_cave_1',
      ...tCenter(24.5, 11),
      opened: false,
      rarity: 'rare',
      reward: { gold: 280, ore: { type: 'prism', count: 2 }, weaponId: 'wp_frost_scepter' },
    },
    {
      id: 'ch_cave_secret',
      ...tCenter(7.5, 25.5),
      opened: false,
      rarity: 'epic',
      reward: { gold: 450, core: 'vital', ore: { type: 'prism', count: 3 }, armorId: 'ar_crystal_barrier' },
    }
  );

  // Enemies
  const spawns = [
    ['crystal_bat', 9, 19], ['frost_golem', 11, 11], ['crystal_bat', 18, 10],
    ['shade_eye', 22, 8], ['frost_golem', 20, 17], ['shade_eye', 24, 18],
    ['crystal_bat', 18, 25], ['frost_golem', 22, 24], ['shade_eye', 25, 15],
  ];
  for (const [enemyId, ex, ey] of spawns) {
    map.enemySpawns.push({ enemyId, ...tCenter(ex, ey) });
  }

  // Portals
  map.portals.push(
    { id: 'pt_cave_forest', ...tCenter(4, 15.5), targetArea: 'forest', label: '1. 風のフィローネ樹海へ', color: '#34d399' },
    { id: 'pt_cave_ruins', ...tCenter(41, 15.5), targetArea: 'ruins', label: '3. 古代魔導遺跡・深部へ', color: '#f59e0b', requiresBoss: 'boss_crystalion' }
  );

  map.bossArena = {
    bossId: 'boss_crystalion',
    triggerRect: { x: 30 * TS, y: 6 * TS, w: 13 * TS, h: 20 * TS },
    center: tCenter(36.5, 15.5),
    gateTiles: bossGateTiles,
    active: false,
    triggered: false,
  };

  map.spawn = tCenter(6, 15.5);
  applyPersistentState(map, progress);
  return map;
}

// ============================================================================
// AREA 3: 黄昏の古代石造神殿遺跡 (ANCIENT STONE TEMPLE RUINS)
// ============================================================================
function buildRuins(progress) {
  const map = createBaseMap('ruins', 48, 34);
  fillRect(map, 2, 2, 44, 30, TILE.FLOOR);
  borderRect(map, 2, 2, 44, 30, TILE.WALL);

  // Ancient Flagstone Temple Walkways
  fillRect(map, 4, 16, 26, 2, TILE.ACCENT);
  fillRect(map, 14, 5, 2, 24, TILE.ACCENT);
  fillRect(map, 23, 5, 2, 24, TILE.ACCENT);

  // Symmetric Tech Columns & Energy Channels
  fillRect(map, 10, 8, 2, 5, TILE.WALL);
  fillRect(map, 10, 21, 2, 5, TILE.WALL);
  fillRect(map, 18, 9, 3, 4, TILE.WATER);
  fillRect(map, 18, 21, 3, 4, TILE.WATER);
  fillRect(map, 29, 3, 2, 28, TILE.WALL);

  // Shock Damage Strips
  fillRect(map, 17, 15, 5, 1, TILE.DAMAGE);
  fillRect(map, 17, 18, 5, 1, TILE.DAMAGE);

  // Energy Gate
  const gateTiles = [
    { tx: 29, ty: 16 }, { tx: 30, ty: 16 },
    { tx: 29, ty: 17 }, { tx: 30, ty: 17 },
  ];
  for (const g of gateTiles) setTile(map, g.tx, g.ty, TILE.GATE);

  // Cracked Hidden Chamber (North-East Ruins Vault — hides Epic Gear + Secret Boss Portal!)
  fillRect(map, 20, 3, 8, 6, TILE.WALL);
  fillRect(map, 21, 4, 6, 4, TILE.ACCENT);
  setTile(map, 23, 8, TILE.CRACKED);
  setTile(map, 24, 8, TILE.CRACKED);
  map.crackedWalls.push(
    { id: 'wall_ruins_1', tx: 23, ty: 8, hp: 3, maxHp: 3, broken: false },
    { id: 'wall_ruins_1b', tx: 24, ty: 8, hp: 3, maxHp: 3, broken: false }
  );

  // Boss Chamber
  fillRect(map, 33, 8, 11, 18, TILE.BOSS_FLOOR);
  const bossGateTiles = [{ tx: 31, ty: 16 }, { tx: 31, ty: 17 }];

  // Moving Plasma Saw Traps
  map.traps.push(
    {
      id: 'trap_ruins_1',
      ...tCenter(15, 9),
      x1: 15.5 * TS, y1: 6.5 * TS,
      x2: 15.5 * TS, y2: 14.5 * TS,
      speed: 165, phase: 0, radius: 19, dmg: 30,
    },
    {
      id: 'trap_ruins_2',
      ...tCenter(24, 24),
      x1: 24.5 * TS, y1: 19.5 * TS,
      x2: 24.5 * TS, y2: 28.5 * TS,
      speed: 175, phase: Math.PI, radius: 19, dmg: 30,
    }
  );

  // NPC Scholar
  map.npcs.push({ npcId: 'ruins_scholar', ...tCenter(8, 14), label: '遺跡博士エリス' });

  // Switch in South Vault
  map.switches.push({
    id: 'sw_ruins_1',
    ...tCenter(19.5, 28.5),
    activated: false,
    gateTiles,
    color: '#22d3ee',
  });

  // Mystic Shrine
  map.shrines.push({ id: 'shrine_ruins', ...tCenter(7, 6), used: false });

  // Chests
  map.chests.push(
    {
      id: 'ch_ruins_1',
      ...tCenter(7, 28),
      opened: false,
      rarity: 'epic',
      reward: { gold: 480, ore: { type: 'prism', count: 3 }, weaponId: 'wp_cyber_halberd' },
    },
    {
      id: 'ch_ruins_secret',
      ...tCenter(22, 5.5),
      opened: false,
      rarity: 'epic',
      reward: { gold: 700, core: 'ether', ore: { type: 'void', count: 1 }, armorId: 'ar_cyber_exosuit' },
    }
  );

  // Enemies
  const spawns = [
    ['cyber_drone', 12, 10], ['blade_automaton', 13, 23], ['turret_core', 19, 16],
    ['cyber_drone', 22, 13], ['blade_automaton', 26, 12], ['turret_core', 26, 22],
    ['cyber_drone', 16, 27], ['blade_automaton', 22, 26], ['cyber_drone', 27, 17],
  ];
  for (const [enemyId, ex, ey] of spawns) {
    map.enemySpawns.push({ enemyId, ...tCenter(ex, ey) });
  }

  // Portals (including Secret Boss Portal hidden inside cracked wall vault!)
  map.portals.push(
    { id: 'pt_ruins_cave', ...tCenter(4, 16.5), targetArea: 'cave', label: '2. 暗闇の氷晶鍾乳洞へ', color: '#38bdf8' },
    { id: 'pt_ruins_magma', ...tCenter(43, 16.5), targetArea: 'magma', label: '4. 灼熱のオルディン竜火山へ', color: '#fb923c', requiresBoss: 'boss_chronos' },
    { id: 'pt_ruins_secret', ...tCenter(25.5, 5.5), targetArea: 'secret', label: '🌌 星核の創世大神殿 (裏ボス)', color: '#fbbf24' }
  );

  map.bossArena = {
    bossId: 'boss_chronos',
    triggerRect: { x: 32 * TS, y: 7 * TS, w: 13 * TS, h: 20 * TS },
    center: tCenter(38.5, 16.5),
    gateTiles: bossGateTiles,
    active: false,
    triggered: false,
  };

  map.spawn = tCenter(6, 16.5);
  applyPersistentState(map, progress);
  return map;
}

// ============================================================================
// AREA 4: 灼熱のオルディン竜火山 (DRAGONFIRE VOLCANO CALDERA)
// ============================================================================
function buildMagma(progress) {
  const map = createBaseMap('magma', 48, 34);
  fillRect(map, 2, 2, 44, 30, TILE.FLOOR);
  borderRect(map, 2, 2, 44, 30, TILE.WALL);

  // Molten Lava Channels with Ancient Stone Bridges
  fillRect(map, 11, 3, 3, 28, TILE.WATER);
  fillRect(map, 21, 3, 3, 28, TILE.WATER);
  fillRect(map, 11, 8, 3, 3, TILE.ACCENT);
  fillRect(map, 11, 22, 3, 3, TILE.ACCENT);
  fillRect(map, 21, 15, 3, 4, TILE.ACCENT);
  fillRect(map, 21, 25, 3, 3, TILE.ACCENT);

  // Superheated Magma Vent Damage Floors
  fillRect(map, 16, 7, 3, 3, TILE.DAMAGE);
  fillRect(map, 16, 16, 3, 3, TILE.DAMAGE);
  fillRect(map, 16, 25, 3, 2, TILE.DAMAGE);
  fillRect(map, 26, 11, 2, 3, TILE.DAMAGE);
  fillRect(map, 26, 20, 2, 3, TILE.DAMAGE);

  // Volcanic Basalt Wall + Switch Gate
  fillRect(map, 30, 3, 2, 28, TILE.WALL);
  const gateTiles = [
    { tx: 30, ty: 16 }, { tx: 31, ty: 16 },
    { tx: 30, ty: 17 }, { tx: 31, ty: 17 },
  ];
  for (const g of gateTiles) setTile(map, g.tx, g.ty, TILE.GATE);

  // Secret Cracked Wall Room (South-East of Mid Caldera)
  fillRect(map, 24, 26, 5, 5, TILE.WALL);
  fillRect(map, 25, 27, 3, 3, TILE.ACCENT);
  setTile(map, 26, 26, TILE.CRACKED);
  map.crackedWalls.push({ id: 'wall_magma_1', tx: 26, ty: 26, hp: 3, maxHp: 3, broken: false });

  // Boss Chamber
  fillRect(map, 34, 8, 10, 18, TILE.BOSS_FLOOR);
  const bossGateTiles = [{ tx: 32, ty: 16 }, { tx: 32, ty: 17 }];

  // Moving Traps
  map.traps.push(
    {
      id: 'trap_magma_1',
      ...tCenter(17, 13),
      x1: 15.2 * TS, y1: 13.5 * TS,
      x2: 19.8 * TS, y2: 13.5 * TS,
      speed: 175, phase: 0, radius: 19, dmg: 40,
    },
    {
      id: 'trap_magma_2',
      ...tCenter(27, 16),
      x1: 27.5 * TS, y1: 7.5 * TS,
      x2: 27.5 * TS, y2: 23.5 * TS,
      speed: 195, phase: 1.5, radius: 20, dmg: 42,
    }
  );

  // NPC Smith
  map.npcs.push({ npcId: 'magma_engineer', ...tCenter(7, 14), label: '火口鍛冶師ゴウ' });

  // Caldera Gate Switch
  map.switches.push({
    id: 'sw_magma_1',
    ...tCenter(26.5, 6),
    activated: false,
    gateTiles,
    color: '#fb923c',
  });

  // Mystic Shrine
  map.shrines.push({ id: 'shrine_magma', ...tCenter(7, 26), used: false });

  // Chests
  map.chests.push(
    {
      id: 'ch_magma_1',
      ...tCenter(7, 6),
      opened: false,
      rarity: 'epic',
      reward: { gold: 760, ore: { type: 'void', count: 1 }, weaponId: 'wp_magma_katana' },
    },
    {
      id: 'ch_magma_secret',
      ...tCenter(26.5, 28.5),
      opened: false,
      rarity: 'epic',
      reward: { gold: 1050, core: 'power', ore: { type: 'void', count: 2 }, weaponId: 'wp_phantom_fangs' },
    }
  );

  // Enemies
  const spawns = [
    ['magma_hound', 8, 10], ['ember_wraith', 8, 22], ['magma_hound', 17, 11],
    ['reactor_titan', 17, 21], ['ember_wraith', 18, 28], ['magma_hound', 26, 9],
    ['reactor_titan', 26, 16], ['ember_wraith', 28, 21], ['magma_hound', 28, 13],
  ];
  for (const [enemyId, ex, ey] of spawns) {
    map.enemySpawns.push({ enemyId, ...tCenter(ex, ey) });
  }

  // Portals
  map.portals.push(
    { id: 'pt_magma_ruins', ...tCenter(4, 16.5), targetArea: 'ruins', label: '3. 古代魔導遺跡・深部へ', color: '#f59e0b' },
    { id: 'pt_magma_citadel', ...tCenter(43, 16.5), targetArea: 'citadel', label: '5. 天空のハイリア聖城へ', color: '#fbbf24', requiresBoss: 'boss_ignis' }
  );

  map.bossArena = {
    bossId: 'boss_ignis',
    triggerRect: { x: 33 * TS, y: 7 * TS, w: 12 * TS, h: 20 * TS },
    center: tCenter(39, 16.5),
    gateTiles: bossGateTiles,
    active: false,
    triggered: false,
  };

  map.spawn = tCenter(6, 16.5);
  applyPersistentState(map, progress);
  return map;
}

// ============================================================================
// AREA 5: 天空のハイリア聖城 (CELESTIAL SANCTUARY CITADEL)
// ============================================================================
function buildCitadel(progress) {
  const map = createBaseMap('citadel', 50, 36);
  fillRect(map, 2, 2, 46, 32, TILE.FLOOR);
  borderRect(map, 2, 2, 46, 32, TILE.WALL);

  // Grand Skywalk Carpets & Star Abyss Cutouts
  fillRect(map, 4, 17, 29, 2, TILE.ACCENT);
  fillRect(map, 11, 6, 4, 8, TILE.WATER);
  fillRect(map, 11, 22, 4, 8, TILE.WATER);
  fillRect(map, 21, 9, 3, 5, TILE.WATER);
  fillRect(map, 21, 22, 3, 5, TILE.WATER);

  // Arcane Floor Hazards
  fillRect(map, 16, 14, 4, 2, TILE.DAMAGE);
  fillRect(map, 16, 20, 4, 2, TILE.DAMAGE);

  // Grand Throne Bulkhead
  fillRect(map, 31, 3, 2, 30, TILE.WALL);
  const gateTiles = [
    { tx: 31, ty: 17 }, { tx: 32, ty: 17 },
    { tx: 31, ty: 18 }, { tx: 32, ty: 18 },
  ];
  for (const g of gateTiles) setTile(map, g.tx, g.ty, TILE.GATE);

  // Cracked Legendary Vault (North Citadel)
  fillRect(map, 24, 3, 6, 6, TILE.WALL);
  fillRect(map, 25, 4, 4, 4, TILE.ACCENT);
  setTile(map, 26, 8, TILE.CRACKED);
  setTile(map, 27, 8, TILE.CRACKED);
  map.crackedWalls.push(
    { id: 'wall_citadel_1', tx: 26, ty: 8, hp: 3, maxHp: 3, broken: false },
    { id: 'wall_citadel_1b', tx: 27, ty: 8, hp: 3, maxHp: 3, broken: false }
  );

  // Final Boss Throne Room
  fillRect(map, 35, 7, 11, 22, TILE.BOSS_FLOOR);
  const bossGateTiles = [{ tx: 33, ty: 17 }, { tx: 33, ty: 18 }];

  // Moving Traps
  map.traps.push(
    {
      id: 'trap_citadel_1',
      ...tCenter(18, 10),
      x1: 16.5 * TS, y1: 6.5 * TS,
      x2: 19.5 * TS, y2: 13.5 * TS,
      speed: 205, phase: 0, radius: 20, dmg: 52,
    },
    {
      id: 'trap_citadel_2',
      ...tCenter(27, 18),
      x1: 27.5 * TS, y1: 11.5 * TS,
      x2: 27.5 * TS, y2: 25.5 * TS,
      speed: 220, phase: 2.1, radius: 20, dmg: 52,
    }
  );

  // NPC Rebel Knight
  map.npcs.push({ npcId: 'citadel_knight', ...tCenter(8, 15.5), label: '反乱騎士アレン' });

  // Throne Seal Switch
  map.switches.push({
    id: 'sw_citadel_1',
    ...tCenter(27, 30),
    activated: false,
    gateTiles,
    color: '#fbbf24',
  });

  // Mystic Shrine
  map.shrines.push({ id: 'shrine_citadel', ...tCenter(7, 29), used: false });

  // Chests
  map.chests.push(
    {
      id: 'ch_citadel_1',
      ...tCenter(7, 6),
      opened: false,
      rarity: 'epic',
      reward: { gold: 1200, ore: { type: 'void', count: 2 }, weaponId: 'wp_seraph_staff' },
    },
    {
      id: 'ch_citadel_secret',
      ...tCenter(26.5, 5.5),
      opened: false,
      rarity: 'legendary',
      reward: { gold: 2000, core: 'crit', ore: { type: 'void', count: 3 }, armorId: 'ar_celestial_aegis' },
    }
  );

  // Enemies
  const spawns = [
    ['astral_knight', 9, 11], ['void_seraph', 9, 24], ['astral_knight', 18, 9],
    ['omega_sentinel', 18, 18], ['void_seraph', 18, 27], ['astral_knight', 26, 13],
    ['omega_sentinel', 26, 22], ['void_seraph', 29, 17], ['astral_knight', 28, 27],
  ];
  for (const [enemyId, ex, ey] of spawns) {
    map.enemySpawns.push({ enemyId, ...tCenter(ex, ey) });
  }

  // Portals
  map.portals.push(
    { id: 'pt_citadel_magma', ...tCenter(4, 17.5), targetArea: 'magma', label: '4. 灼熱のオルディン竜火山へ', color: '#fb923c' }
  );

  map.bossArena = {
    bossId: 'boss_omega',
    triggerRect: { x: 34 * TS, y: 6 * TS, w: 13 * TS, h: 24 * TS },
    center: tCenter(40.5, 17.5),
    gateTiles: bossGateTiles,
    active: false,
    triggered: false,
  };

  map.spawn = tCenter(6, 17.5);
  applyPersistentState(map, progress);
  return map;
}

// ============================================================================
// AREA 6: 星核の創世大神殿 (SANCTUM OF THE STAR CORE — SECRET SUPERBOSS)
// ============================================================================
function buildSecretVault(progress) {
  const map = createBaseMap('secret', 34, 28);
  fillRect(map, 3, 3, 28, 22, TILE.FLOOR);
  borderRect(map, 3, 3, 28, 22, TILE.WALL);
  fillRect(map, 11, 6, 16, 16, TILE.BOSS_FLOOR);
  fillRect(map, 5, 13, 6, 2, TILE.ACCENT);

  const bossGateTiles = [{ tx: 10, ty: 13 }, { tx: 10, ty: 14 }];

  map.shrines.push({ id: 'shrine_secret', ...tCenter(7, 8), used: false });
  map.chests.push({
    id: 'ch_secret_legend',
    ...tCenter(7, 20),
    opened: false,
    rarity: 'legendary',
    reward: { gold: 3000, core: 'vital', ore: { type: 'void', count: 4 }, armorId: 'ar_void_chronos' },
  });

  map.portals.push({
    id: 'pt_secret_town',
    ...tCenter(5, 13.5),
    targetArea: 'town',
    label: '王都ルミナリア城下町へ帰還',
    color: '#fbbf24',
  });

  map.bossArena = {
    bossId: 'boss_astral_zero',
    triggerRect: { x: 11 * TS, y: 5 * TS, w: 18 * TS, h: 18 * TS },
    center: tCenter(20, 13.5),
    gateTiles: bossGateTiles,
    active: false,
    triggered: false,
  };

  map.spawn = tCenter(7, 13.5);
  applyPersistentState(map, progress);
  return map;
}

// ============================================================================
// AREA 7: エンドレス試練の塔 (ENDLESS TRIAL TOWER — PROCEDURAL PER FLOOR)
// ============================================================================
function buildTowerFloor(floor = 1) {
  const map = createBaseMap('tower', 34, 26);
  map.towerFloor = floor;
  fillRect(map, 3, 3, 28, 20, TILE.FLOOR);
  borderRect(map, 3, 3, 28, 20, TILE.WALL);
  fillRect(map, 7, 6, 20, 14, TILE.BOSS_FLOOR);

  // Rotating symmetric pillars depending on floor
  const layout = floor % 3;
  if (layout === 1) {
    setTile(map, 11, 9, TILE.WALL);
    setTile(map, 22, 9, TILE.WALL);
    setTile(map, 11, 16, TILE.WALL);
    setTile(map, 22, 16, TILE.WALL);
  } else if (layout === 2) {
    fillRect(map, 15, 12, 4, 2, TILE.WATER);
  }

  // Traps on even floors
  if (floor % 2 === 0) {
    map.traps.push({
      id: `trap_tower_${floor}`,
      ...tCenter(16.5, 8),
      x1: 9.5 * TS, y1: 8.5 * TS,
      x2: 24.5 * TS, y2: 8.5 * TS,
      speed: 165 + Math.min(120, floor * 6),
      phase: 0,
      radius: 18,
      dmg: 24 + floor * 5,
    });
  }

  // Shrine every 3 floors
  if (floor % 3 === 0) {
    map.shrines.push({ id: `shrine_tower_${floor}`, ...tCenter(6, 13), used: false });
  }

  // Return to Town portal on West side
  map.portals.push({
    id: 'pt_tower_town',
    ...tCenter(5, 13),
    targetArea: 'town',
    label: '拠点へ帰還する',
    color: '#38f8d4',
  });

  const isBossFloor = floor % 5 === 0;
  if (isBossFloor) {
    const bossCycle = ['boss_sylvarion', 'boss_crystalion', 'boss_chronos', 'boss_ignis', 'boss_omega', 'boss_astral_zero'];
    const bossId = bossCycle[(Math.floor(floor / 5) - 1) % bossCycle.length];
    map.bossArena = {
      bossId,
      triggerRect: { x: 8 * TS, y: 4 * TS, w: 22 * TS, h: 18 * TS },
      center: tCenter(21, 13),
      gateTiles: [],
      active: false,
      triggered: false,
      towerScale: 1 + floor * 0.14,
    };
  } else {
    const pool = [
      'moss_beetle', 'frost_golem', 'shade_eye', 'cyber_drone', 'blade_automaton',
      'turret_core', 'magma_hound', 'reactor_titan', 'ember_wraith',
      'astral_knight', 'void_seraph', 'omega_sentinel',
    ];
    const count = Math.min(12, 5 + Math.floor(floor * 0.7));
    for (let i = 0; i < count; i++) {
      const idx = (floor * 2 + i) % pool.length;
      const ex = 12 + (i % 4) * 4;
      const ey = 7 + Math.floor(i / 4) * 4.5;
      map.enemySpawns.push({
        enemyId: pool[idx],
        ...tCenter(ex, ey),
        towerScale: 1 + (floor - 1) * 0.16,
      });
    }
  }

  map.spawn = tCenter(7.5, 13);
  return map;
}

let _activeTerrainMap = null;

export function buildAreaMap(areaId, progress, towerFloor = 1) {
  let map;
  switch (areaId) {
    case 'town': map = buildTown(progress); break;
    case 'forest': map = buildForest(progress); break;
    case 'cave': map = buildCave(progress); break;
    case 'ruins': map = buildRuins(progress); break;
    case 'magma': map = buildMagma(progress); break;
    case 'citadel': map = buildCitadel(progress); break;
    case 'secret': map = buildSecretVault(progress); break;
    case 'tower': map = buildTowerFloor(towerFloor); break;
    default: map = buildTown(progress); break;
  }
  _activeTerrainMap = map;
  return map;
}

// ============================================================================
// COLLISION & WALKABILITY HELPERS
// ============================================================================
export function isSolidTile(tileVal) {
  return (
    tileVal === TILE.VOID ||
    tileVal === TILE.WALL ||
    tileVal === TILE.WATER ||
    tileVal === TILE.CRACKED ||
    tileVal === TILE.GATE ||
    tileVal === TILE.BOSS_GATE
  );
}

export function isProjectileBlockingTile(tileVal) {
  return (
    tileVal === TILE.VOID ||
    tileVal === TILE.WALL ||
    tileVal === TILE.CRACKED ||
    tileVal === TILE.GATE ||
    tileVal === TILE.BOSS_GATE
  );
}

export function resolveMapCollision(map, x, y, radius) {
  let nx = Math.max(radius, Math.min(map.pixelWidth - radius, x));
  let ny = Math.max(radius, Math.min(map.pixelHeight - radius, y));

  const minTx = Math.floor((nx - radius) / TS) - 1;
  const maxTx = Math.floor((nx + radius) / TS) + 1;
  const minTy = Math.floor((ny - radius) / TS) - 1;
  const maxTy = Math.floor((ny + radius) / TS) + 1;

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const t = getTile(map, tx, ty);
      if (!isSolidTile(t)) continue;

      const rx = tx * TS;
      const ry = ty * TS;
      const closestX = Math.max(rx, Math.min(nx, rx + TS));
      const closestY = Math.max(ry, Math.min(ny, ry + TS));
      const dx = nx - closestX;
      const dy = ny - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          nx += (dx / dist) * push;
          ny += (dy / dist) * push;
        } else {
          // Inside tile center fallback
          const cx = rx + TS * 0.5;
          const cy = ry + TS * 0.5;
          if (Math.abs(nx - cx) > Math.abs(ny - cy)) {
            nx = nx < cx ? rx - radius : rx + TS + radius;
          } else {
            ny = ny < cy ? ry - radius : ry + TS + radius;
          }
        }
      }
    }
  }
  return { x: nx, y: ny };
}

export function setBossGateState(map, locked) {
  if (!map.bossArena || !map.bossArena.gateTiles) return;
  for (const gt of map.bossArena.gateTiles) {
    setTile(map, gt.tx, gt.ty, locked ? TILE.BOSS_GATE : TILE.ACCENT);
  }
}

export function openSwitchGate(map, sw) {
  sw.activated = true;
  for (const gt of sw.gateTiles) {
    setTile(map, gt.tx, gt.ty, TILE.ACCENT);
  }
}

export function breakCrackedWall(map, cw) {
  cw.broken = true;
  cw.hp = 0;
  setTile(map, cw.tx, cw.ty, TILE.FLOOR);
}

// ============================================================================
// CONTINUOUS NATURAL TERRAIN HEIGHTMAP (Multi-Octave Hills + Carved Riverbeds)
// 100% EXACT GROUNDING SHARED BY TERRAIN MESH & ALL 3D ENTITIES
// ============================================================================
export function sampleTileWeight(map, x, z, targetTile) {
  if (!map) return 0;
  const fx = x / TS - 0.5;
  const fz = z / TS - 0.5;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const ux = Math.max(0, Math.min(1, fx - x0));
  const uz = Math.max(0, Math.min(1, fz - z0));
  const sx = ux * ux * (3 - 2 * ux);
  const sz = uz * uz * (3 - 2 * uz);
  const w00 = getTile(map, x0, z0) === targetTile ? 1 : 0;
  const w10 = getTile(map, x0 + 1, z0) === targetTile ? 1 : 0;
  const w01 = getTile(map, x0, z0 + 1) === targetTile ? 1 : 0;
  const w11 = getTile(map, x0 + 1, z0 + 1) === targetTile ? 1 : 0;
  const a = w00 + (w10 - w00) * sx;
  const b = w01 + (w11 - w01) * sx;
  return a + (b - a) * sz;
}

export function getTerrainHeight(x, z, areaId = 'town', mapOverride = null) {
  const map = mapOverride || (_activeTerrainMap && _activeTerrainMap.areaId === areaId ? _activeTerrainMap : null);

  // Multi-octave organic Hyrule hills & micro-undulations (no flat grid feel!)
  const fbm =
    Math.sin(x * 0.0055 + z * 0.0022) * Math.cos(z * 0.0062 - x * 0.0018) * 1.0 +
    Math.sin(x * 0.0135 - z * 0.0115) * 0.42 +
    Math.cos(x * 0.024 + z * 0.027) * 0.16;

  let baseH = 0;
  if (areaId === 'town') {
    const dx = (x - 16.5 * TS) / (10 * TS);
    const dz = (z - 12.5 * TS) / (8 * TS);
    const dist = Math.hypot(dx, dz);
    if (dist < 0.72) baseH = 2.6;
    else if (dist < 1.28) baseH = 2.6 * (1 - (dist - 0.72) / 0.56);
    else baseH = fbm * 2.2;
  } else if (areaId === 'forest') {
    const bossFlatten = x > 29 * TS ? Math.max(0, 1 - (x - 29 * TS) / (3 * TS)) : 1.0;
    baseH = (fbm * 8.5 + 1.5) * bossFlatten;
  } else if (areaId === 'cave') {
    const bossFlatten = x > 29 * TS ? Math.max(0, 1 - (x - 29 * TS) / (3 * TS)) : 1.0;
    baseH = (fbm * 6.5) * bossFlatten;
  } else if (areaId === 'ruins') {
    const bossFlatten = x > 31 * TS ? Math.max(0, 1 - (x - 31 * TS) / (3 * TS)) : 1.0;
    baseH = (fbm * 5.2) * bossFlatten;
  } else if (areaId === 'magma') {
    const bossFlatten = x > 32 * TS ? Math.max(0, 1 - (x - 32 * TS) / (3 * TS)) : 1.0;
    baseH = (fbm * 7.8) * bossFlatten;
  } else {
    baseH = fbm * 2.4;
  }

  if (map) {
    // 1. Carve real depressed riverbeds & moats where TILE.WATER exists!
    const waterW = sampleTileWeight(map, x, z, TILE.WATER);
    const accentW = sampleTileWeight(map, x, z, TILE.ACCENT);
    const bossW = sampleTileWeight(map, x, z, TILE.BOSS_FLOOR);
    const wallW = sampleTileWeight(map, x, z, TILE.WALL);

    // Smoothly flatten sacred boss sanctuary
    if (bossW > 0.01) {
      baseH = baseH * (1 - bossW) + 1.2 * bossW;
    }
    // Smooth riverbed depression (bridges on TILE.ACCENT stay above water!)
    if (waterW > 0.01) {
      const bridgeMask = Math.max(0, 1 - accentW * 1.4);
      baseH -= waterW * bridgeMask * 16.5;
    }
    // Natural rocky embankment rise under walls/cliffs
    if (wallW > 0.05 && areaId !== 'town') {
      baseH += wallW * 6.0;
    }
    // Subtle worn dirt path dip on field roadways (keeps paths natural!)
    if (accentW > 0.1 && areaId === 'forest') {
      baseH -= accentW * 1.1;
    }
  }

  return baseH;
}

