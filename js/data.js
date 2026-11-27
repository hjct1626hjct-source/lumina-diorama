// ============================================================================
// LUMINA CHRONICLES — Hyrule-Style High Fantasy 3D Action RPG
// Master Game Data Registry (Jobs, Gear, Spells, Enemies, Bosses, Areas, Lore)
// 製作者：駿 (Created by Shun)
// ============================================================================

export const GAME_META = {
  title: 'LUMINA CHRONICLES',
  subtitle: '— BREATH OF THE STAR REALM — 〜星結晶と古代魔導王の伝説〜',
  creator: '製作者：駿 (Created by Shun)',
  version: '2.0.0',
  tileSize: 48,
};

export const BODY_TYPES = {
  male: {
    id: 'male',
    name: '男性型（標準ヒーロー）',
    short: '男性型',
    shoulderScale: 1.16,
    waistScale: 0.90,
    hipScale: 0.94,
    heightScale: 1.04,
    jawWidth: 1.05,
  },
  female: {
    id: 'female',
    name: '女性型（ヒロイン）',
    short: '女性型',
    shoulderScale: 0.94,
    waistScale: 0.78,
    hipScale: 1.08,
    heightScale: 0.98,
    jawWidth: 0.90,
  },
  slim: {
    id: 'slim',
    name: 'スリム / 中性型（エルフ風）',
    short: 'スリム/中性型',
    shoulderScale: 1.02,
    waistScale: 0.84,
    hipScale: 0.98,
    heightScale: 1.01,
    jawWidth: 0.94,
  },
};

export const RARITY_INFO = {
  common: { label: 'COMMON', color: '#d6d3c4', mult: 1.0, sellMult: 1.0 },
  rare: { label: 'RARE', color: '#38bdf8', mult: 1.24, sellMult: 1.8 },
  epic: { label: 'EPIC', color: '#c084fc', mult: 1.52, sellMult: 3.2 },
  legendary: { label: 'LEGENDARY', color: '#f59e0b', mult: 1.9, sellMult: 6.0 },
};

export const ELEMENT_INFO = {
  none: { name: '無属性', icon: '✦', color: '#e7e5e4' },
  fire: { name: '炎', icon: '🔥', color: '#f97316' },
  ice: { name: '氷', icon: '❄️', color: '#38bdf8' },
  lightning: { name: '雷', icon: '⚡', color: '#eab308' },
  holy: { name: '聖', icon: '✨', color: '#fde047' },
};

export const JOBS = {
  knight: {
    id: 'knight',
    name: 'ブレイドナイト',
    en: 'ROYAL BLADE KNIGHT',
    badge: 'KNIGHT',
    icon: '⚔️',
    color: '#2563eb',
    accent: '#f59e0b',
    tunicColor: '#1e4e8c',
    capeColor: '#991b1b',
    hairColor: '#e5b869',
    eyeColor: '#2563eb',
    skinTone: '#f6d5b8',
    outfitStyle: 'hyrule_knight',
    desc: '王国の紋章盾と聖剣を携えた近接の勇者。広範囲の3連剣技と回転斬り衝撃波、堅牢な盾パリィで魔物の群れを一掃する。',
    starterWeapon: 'wp_neon_blade',
    starterArmor: 'ar_aegis_plate',
    starterSpells: ['fire'],
    baseStats: { maxHp: 160, maxMp: 65, atk: 22, mag: 12, def: 12, spd: 220, crit: 0.14, goldMult: 1.0 },
    growth: { maxHp: 25, maxMp: 7, atk: 4.6, mag: 2.2, def: 2.3, crit: 0.005 },
    attackRange: 94,
    attackArc: Math.PI * 1.05,
    attackCooldown: 0.28,
    limitName: 'ハイリア・スカイテンペスト',
    limitDesc: '黄金の聖光を剣に宿し、大回転斬りと聖なる衝撃波で周囲の敵すべてを吹き飛ばす！',
  },
  mage: {
    id: 'mage',
    name: 'アークメイジ',
    en: 'ASTRAL ARCHMAGE',
    badge: 'MAGE',
    icon: '🔮',
    color: '#7c3aed',
    accent: '#38bdf8',
    tunicColor: '#3b2868',
    capeColor: '#1e3a8a',
    hairColor: '#e2e8f0',
    eyeColor: '#38bdf8',
    skinTone: '#f9dcc4',
    outfitStyle: 'scholar_mage',
    desc: '古代紋章の宝玉杖と肩マントを纏う星詠みの魔導士。誘導魔導弾と範囲氷結・治癒の秘術を自在に操る。',
    starterWeapon: 'wp_prism_wand',
    starterArmor: 'ar_astral_robe',
    starterSpells: ['ice', 'heal'],
    baseStats: { maxHp: 118, maxMp: 135, atk: 15, mag: 26, def: 7, spd: 214, crit: 0.15, goldMult: 1.0 },
    growth: { maxHp: 16, maxMp: 17, atk: 2.5, mag: 5.6, def: 1.5, crit: 0.006 },
    attackRange: 290,
    attackArc: Math.PI * 0.55,
    attackCooldown: 0.32,
    limitName: 'メテオ・スターフォール',
    limitDesc: '天空から7条の古代星隕石を呼び寄せ、戦場全体を凍結＆大爆発で殲滅する！',
  },
  rogue: {
    id: 'rogue',
    name: 'シャドウローグ',
    en: 'WINDRUNNER ROGUE',
    badge: 'ROGUE',
    icon: '🗡️',
    color: '#15803d',
    accent: '#eab308',
    tunicColor: '#1f4d36',
    capeColor: '#365314',
    hairColor: '#5c4033',
    eyeColor: '#10b981',
    skinTone: '#f3cfb2',
    outfitStyle: 'forest_ranger',
    desc: '深緑のフードと双短剣を操る疾風のレンジャー。圧倒的な機動力・高会心率に加え、獲得ゴールド+35%の財宝探索術を持つ。',
    starterWeapon: 'wp_plasma_daggers',
    starterArmor: 'ar_stealth_cloak',
    starterSpells: ['lightning'],
    baseStats: { maxHp: 130, maxMp: 85, atk: 20, mag: 16, def: 8, spd: 256, crit: 0.30, goldMult: 1.35 },
    growth: { maxHp: 19, maxMp: 9, atk: 4.2, mag: 2.8, def: 1.7, crit: 0.01 },
    attackRange: 80,
    attackArc: Math.PI * 0.88,
    attackCooldown: 0.20,
    limitName: 'ゲイル・ファントムラッシュ',
    limitDesc: '疾風のごとく空間を駆け抜け、周囲の敵へ8回連続の確定クリティカル乱舞を叩き込む！',
  },
};

export const WEAPONS = [
  // Starter Weapons
  { id: 'wp_neon_blade', name: '旅人の騎士剣', type: 'blade', rarity: 'common', atk: 13, mag: 4, crit: 0.02, element: 'none', price: 80, shopTier: 0, color: '#93c5fd', desc: '王国の騎士団で広く使われる鍛鉄の片手剣。紋章入りの盾と対をなす。' },
  { id: 'wp_prism_wand', name: '星紋の魔導杖', type: 'wand', rarity: 'common', atk: 8, mag: 15, crit: 0.03, element: 'ice', price: 80, shopTier: 0, color: '#7dd3fc', desc: '先端に蒼い星結晶の宝玉を宿した木彫りの魔導杖。誘導魔弾を放つ。' },
  { id: 'wp_plasma_daggers', name: '疾風の双短剣', type: 'dagger', rarity: 'common', atk: 12, mag: 6, crit: 0.08, element: 'lightning', price: 80, shopTier: 0, color: '#86efac', desc: '風切り羽の刻印が施された軽量な双短剣。素早い連撃と会心に優れる。' },

  // Shop / Mid Tier Weapons
  { id: 'wp_verdant_saber', name: '森精のエメラルド剣', type: 'blade', rarity: 'rare', atk: 25, mag: 10, crit: 0.05, element: 'fire', price: 320, shopTier: 1, color: '#34d399', desc: '古の樹海に眠る聖木と緑宝玉で鍛えられた長剣。' },
  { id: 'wp_frost_scepter', name: '氷晶の賢者杖', type: 'wand', rarity: 'rare', atk: 16, mag: 29, crit: 0.06, element: 'ice', price: 360, shopTier: 1, color: '#38bdf8', desc: '万年氷の洞窟から採掘された純氷晶を冠する魔導杖。' },
  { id: 'wp_volt_edge', name: '雷鳴のファルシオン', type: 'dagger', rarity: 'rare', atk: 23, mag: 16, crit: 0.14, element: 'lightning', price: 420, shopTier: 1, color: '#facc15', desc: '雷竜の鱗粉を焼き入れた双刃。古代ゴーレムに絶大な威力を発揮する。' },
  { id: 'wp_cyber_halberd', name: '古代遺物のガーディアン剣', type: 'blade', rarity: 'epic', atk: 44, mag: 22, crit: 0.10, element: 'lightning', price: 1050, shopTier: 2, color: '#38bdf8', desc: '砂漠の古代神殿で発掘された、青白いルーン光を放つ遺物剣。' },
  { id: 'wp_magma_katana', name: '紅蓮の竜騎士大剣', type: 'blade', rarity: 'epic', atk: 56, mag: 26, crit: 0.12, element: 'fire', price: 1650, shopTier: 3, color: '#f97316', desc: '火山の竜炉で鍛え上げられた灼熱のグレートソード。' },
  { id: 'wp_seraph_staff', name: '天空のセラフィム杖', type: 'wand', rarity: 'epic', atk: 30, mag: 58, crit: 0.12, element: 'holy', price: 1600, shopTier: 3, color: '#fde047', desc: '太陽と星の加護を宿す大賢者の黄金杖。' },
  { id: 'wp_phantom_fangs', name: '宵闇の月影双刃', type: 'dagger', rarity: 'epic', atk: 48, mag: 28, crit: 0.22, element: 'ice', price: 1550, shopTier: 3, color: '#c084fc', desc: '月光を反射して残像を描く暗殺騎士の秘剣。' },

  // Boss / Secret Legendary Weapons
  { id: 'wp_sylva_relic', name: '聖樹の宝剣・エメラルディア', type: 'blade', rarity: 'epic', atk: 38, mag: 20, crit: 0.12, element: 'holy', price: 900, shopTier: 99, color: '#6ee7b7', desc: '樹海の守護巨獣が護っていたエルフ王家の聖剣。' },
  { id: 'wp_crystal_emperor', name: '凍晶の竜杖・アブソリュート', type: 'wand', rarity: 'epic', atk: 26, mag: 50, crit: 0.14, element: 'ice', price: 1300, shopTier: 99, color: '#67e8f9', desc: '氷晶竜クリスタリオンの竜核を宿す極寒の覇杖。' },
  { id: 'wp_omega_caliber', name: '退魔の聖剣・マスターカリバー', type: 'blade', rarity: 'legendary', atk: 78, mag: 48, crit: 0.18, element: 'holy', price: 4200, shopTier: 99, color: '#fbbf24', desc: '厄災の魔王を封じるために女神が鍛えた伝説の退魔剣。' },
  { id: 'wp_astral_singularity', name: '創世の神剣・アストラルゼロ', type: 'blade', rarity: 'legendary', atk: 102, mag: 75, crit: 0.28, element: 'holy', price: 9999, shopTier: 99, color: '#fde047', desc: '星核神殿の試練を超えし真の勇者に授けられる創世の神剣。' },
];

export const ARMORS = [
  // Starter Armors
  { id: 'ar_aegis_plate', name: '王国騎士のチェインメイル', rarity: 'common', def: 11, maxHp: 35, maxMp: 5, spd: 0, price: 70, shopTier: 0, color: '#2563eb', desc: '青い騎士チュニックの上に鎖帷子と鉄の肩当てを重ねた旅装束。' },
  { id: 'ar_astral_robe', name: '星詠みの魔導チュニック', rarity: 'common', def: 7, maxHp: 15, maxMp: 38, spd: 6, price: 70, shopTier: 0, color: '#7c3aed', desc: '金糸の古代ルーン刺繍が施された魔力循環チュニック。' },
  { id: 'ar_stealth_cloak', name: '森人のレンジャー外套', rarity: 'common', def: 8, maxHp: 20, maxMp: 15, spd: 18, price: 70, shopTier: 0, color: '#15803d', desc: '草原や森の風に溶け込む深緑の旅マントと革鎧。' },

  // Shop / Mid Tier Armors
  { id: 'ar_lumina_mail', name: '翠緑のシルヴァンメイル', rarity: 'rare', def: 19, maxHp: 70, maxMp: 20, spd: 6, price: 300, shopTier: 1, color: '#10b981', desc: '大樹の祝福を受けた軽量なエルフ鋼の胸当て。' },
  { id: 'ar_crystal_barrier', name: '氷晶の銀騎士プレート', rarity: 'rare', def: 25, maxHp: 85, maxMp: 45, spd: 8, price: 540, shopTier: 1, color: '#38bdf8', desc: '冷気と魔力を弾く白銀のミスリルコート。' },
  { id: 'ar_cyber_exosuit', name: '古代紋章のガーディアン鎧', rarity: 'epic', def: 38, maxHp: 135, maxMp: 42, spd: 16, price: 1100, shopTier: 2, color: '#0284c7', desc: '古代王国の魔導鍛冶技術で作られた紋章入りの重装鎧。' },
  { id: 'ar_magma_aegis', name: '紅蓮の竜鱗アーマー', rarity: 'epic', def: 48, maxHp: 185, maxMp: 45, spd: 12, price: 1750, shopTier: 3, color: '#ea580c', desc: '火山の炎にもびくともしない火竜の鱗鎧。' },
  { id: 'ar_prism_mantle', name: '星天の賢者クローク', rarity: 'epic', def: 35, maxHp: 115, maxMp: 115, spd: 26, price: 1680, shopTier: 3, color: '#9333ea', desc: '魔力回復と身のこなしを飛躍的に高める星織りの聖マント。' },

  // Legendary Armors
  { id: 'ar_celestial_aegis', name: 'ハイリア王家の聖騎士鎧', rarity: 'legendary', def: 66, maxHp: 270, maxMp: 100, spd: 22, price: 4000, shopTier: 99, color: '#f59e0b', desc: '黄金の翼紋章が輝く伝説の聖騎士フルプレート。' },
  { id: 'ar_void_chronos', name: '創世神の天衣・アストラルギア', rarity: 'legendary', def: 85, maxHp: 360, maxMp: 160, spd: 32, price: 9500, shopTier: 99, color: '#eab308', desc: '星の加護そのものを鎧へと昇華させた至高の神装。' },
];

export const SPELLS = [
  {
    id: 'fire',
    name: 'ファイアボール',
    element: 'fire',
    icon: '🔥',
    color: '#f97316',
    mpCost: 14,
    cooldown: 0.75,
    basePower: 35,
    statusEffect: 'burn',
    learnCost: 120,
    desc: '紅蓮の火球を放ち、着弾地点を爆破して敵を【延焼】状態にする火炎魔法。',
  },
  {
    id: 'ice',
    name: 'アイシクルノヴァ',
    element: 'ice',
    icon: '❄️',
    color: '#38bdf8',
    mpCost: 18,
    cooldown: 1.1,
    basePower: 33,
    statusEffect: 'freeze',
    learnCost: 180,
    desc: '周囲に白銀の氷槍リングを展開し、敵を【凍結・鈍足】状態にする氷結魔法。',
  },
  {
    id: 'lightning',
    name: 'サンダーチェイン',
    element: 'lightning',
    icon: '⚡',
    color: '#eab308',
    mpCost: 20,
    cooldown: 1.15,
    basePower: 40,
    statusEffect: 'paralyze',
    learnCost: 240,
    desc: '最大4体の敵へ連鎖する天雷を落とし、敵を【感電スタン】で足止めする雷撃魔法。',
  },
  {
    id: 'heal',
    name: 'エリアヒール',
    element: 'holy',
    icon: '✨',
    color: '#10b981',
    mpCost: 24,
    cooldown: 2.2,
    basePower: 78,
    statusEffect: null,
    learnCost: 220,
    desc: '女神の祝福の光を広げ、自分と周囲の仲間全員のHPを大回復＆毒を浄化する聖魔法！',
  },
  {
    id: 'overclock',
    name: 'ブレイブオーラ',
    element: 'none',
    icon: '🛡️',
    color: '#f59e0b',
    mpCost: 26,
    cooldown: 5.0,
    basePower: 12,
    statusEffect: null,
    learnCost: 340,
    desc: '勇者の闘気を解き放ち、自分と周囲の味方の攻撃力+35%・移動速度+25%を強化する戦技魔法！',
  },
];

export const CORES = {
  vital: { id: 'vital', name: '生命の器（バイタルコア）', icon: '💚', color: '#10b981', stat: 'maxHp', bonus: 22, desc: '最大HPを永久に+22する古代の生命結晶。' },
  ether: { id: 'ether', name: '魔力の器（エーテルコア）', icon: '💙', color: '#38bdf8', stat: 'maxMp', bonus: 15, desc: '最大MPを永久に+15する古代の魔力結晶。' },
  power: { id: 'power', name: '剛力の器（パワーコア）', icon: '❤️', color: '#f97316', stat: 'atk', bonus: 5, desc: '攻撃力＆魔力を永久に+5する古代の闘気結晶。' },
  crit: { id: 'crit', name: '会心の器（クリティカルコア）', icon: '💛', color: '#eab308', stat: 'crit', bonus: 0.025, desc: '会心率を永久に+2.5%する古代の閃光結晶。' },
};

export const ORES = {
  stardust: { id: 'stardust', name: '星鉄の鉱石', icon: '🔹', color: '#38bdf8' },
  prism: { id: 'prism', name: 'ミスリル銀塊', icon: '🔸', color: '#c084fc' },
  void: { id: 'void', name: 'ヒヒイロカネ神結晶', icon: '💠', color: '#f59e0b' },
};

export const AREAS = [
  {
    id: 'town',
    index: 0,
    code: 'HYRULE HUB',
    name: '王都ルミナリア城下町',
    en: 'KINGDOM OF LUMINARIA',
    bgm: 'town',
    safe: true,
    darkness: false,
    particleType: 'petals',
    recLevel: 1,
    palette: {
      skyTop: '#2b6cb0',
      skyHorizon: '#bee3f8',
      fogColor: '#b3d9f2',
      fogDensity: 0.00075,
      sunColor: '#fff7d6',
      ambientSky: '#90cdf4',
      ambientGround: '#688256',
      voidBg: '#9dc9e8',
      floorA: '#5f9e4c',
      floorB: '#538e42',
      floorAccent: '#c4b79c',
      wallTop: '#8c8577',
      wallFront: '#6e675b',
      neon: '#f59e0b',
      neonAlt: '#38bdf8',
      water: '#2b7a9b',
    },
  },
  {
    id: 'forest',
    index: 1,
    code: 'AREA 01',
    name: '風のフィローネ大草原＆聖樹の森',
    en: 'VERDANT HIGHLANDS & GREAT WOODS',
    bgm: 'field',
    safe: false,
    darkness: false,
    particleType: 'spores',
    recLevel: 1,
    bossId: 'boss_sylvarion',
    palette: {
      skyTop: '#2563eb',
      skyHorizon: '#bae6fd',
      fogColor: '#a7d8f0',
      fogDensity: 0.0008,
      sunColor: '#fff5cc',
      ambientSky: '#7dd3fc',
      ambientGround: '#4d7c43',
      voidBg: '#8ecae6',
      floorA: '#4c943e',
      floorB: '#428535',
      floorAccent: '#b09874',
      wallTop: '#5c6b53',
      wallFront: '#46543f',
      neon: '#fbbf24',
      neonAlt: '#6ee7b7',
      water: '#1d7898',
    },
  },
  {
    id: 'cave',
    index: 2,
    code: 'AREA 02',
    name: '暗闇の氷晶鍾乳洞',
    en: 'OBSIDIAN FROST CAVERN',
    bgm: 'cave',
    safe: false,
    darkness: true,
    particleType: 'mist',
    recLevel: 4,
    bossId: 'boss_crystalion',
    palette: {
      skyTop: '#162540',
      skyHorizon: '#2a466e',
      fogColor: '#1a2d4a',
      fogDensity: 0.00125,
      sunColor: '#e0f2fe',
      ambientSky: '#7dd3fc',
      ambientGround: '#334a6b',
      voidBg: '#132138',
      floorA: '#3d5475',
      floorB: '#324766',
      floorAccent: '#5f7fa6',
      wallTop: '#5c789e',
      wallFront: '#384e6e',
      neon: '#38bdf8',
      neonAlt: '#a78bfa',
      water: '#0e7490',
    },
  },
  {
    id: 'ruins',
    index: 3,
    code: 'AREA 03',
    name: '黄昏の古代石造神殿遺跡',
    en: 'ANCIENT STONE TEMPLE RUINS',
    bgm: 'field',
    safe: false,
    darkness: false,
    particleType: 'data',
    recLevel: 7,
    bossId: 'boss_chronos',
    palette: {
      skyTop: '#4c51bf',
      skyHorizon: '#fbd38d',
      fogColor: '#e2c299',
      fogDensity: 0.00085,
      sunColor: '#ffe4a0',
      ambientSky: '#f6ad55',
      ambientGround: '#74634d',
      voidBg: '#c9a981',
      floorA: '#b89f78',
      floorB: '#a89069',
      floorAccent: '#8c7a5b',
      wallTop: '#7d6e54',
      wallFront: '#5e523e',
      neon: '#38bdf8',
      neonAlt: '#f59e0b',
      water: '#2c7a7b',
    },
  },
  {
    id: 'magma',
    index: 4,
    code: 'AREA 04',
    name: '灼熱のオルディン竜火山',
    en: 'DRAGONFIRE VOLCANO CALDERA',
    bgm: 'field',
    safe: false,
    darkness: false,
    particleType: 'embers',
    recLevel: 10,
    bossId: 'boss_ignis',
    palette: {
      skyTop: '#450a0a',
      skyHorizon: '#c2410c',
      fogColor: '#7c2d12',
      fogDensity: 0.0011,
      sunColor: '#fdba74',
      ambientSky: '#fb923c',
      ambientGround: '#431407',
      voidBg: '#5c190c',
      floorA: '#4a322a',
      floorB: '#3d2821',
      floorAccent: '#69463a',
      wallTop: '#5c382c',
      wallFront: '#3b2119',
      neon: '#f97316',
      neonAlt: '#fde047',
      water: '#ea580c',
    },
  },
  {
    id: 'citadel',
    index: 5,
    code: 'FINAL AREA',
    name: '天空のハイリア聖城',
    en: 'CELESTIAL SANCTUARY CITADEL',
    bgm: 'cave',
    safe: false,
    darkness: false,
    particleType: 'aurora',
    recLevel: 13,
    bossId: 'boss_omega',
    palette: {
      skyTop: '#1e3a8a',
      skyHorizon: '#e0f2fe',
      fogColor: '#bfdbfe',
      fogDensity: 0.00075,
      sunColor: '#fef9c3',
      ambientSky: '#93c5fd',
      ambientGround: '#64748b',
      voidBg: '#93c5fd',
      floorA: '#cbd5e1',
      floorB: '#bac7d6',
      floorAccent: '#e2c784',
      wallTop: '#94a3b8',
      wallFront: '#64748b',
      neon: '#f59e0b',
      neonAlt: '#38bdf8',
      water: '#0284c7',
    },
  },
  {
    id: 'secret',
    index: 6,
    code: 'SECRET VAULT',
    name: '星核の創世大神殿',
    en: 'SANCTUM OF THE STAR CORE',
    bgm: 'cave',
    safe: false,
    darkness: false,
    particleType: 'stars',
    recLevel: 16,
    bossId: 'boss_astral_zero',
    palette: {
      skyTop: '#172554',
      skyHorizon: '#93c5fd',
      fogColor: '#60a5fa',
      fogDensity: 0.0008,
      sunColor: '#fef08a',
      ambientSky: '#93c5fd',
      ambientGround: '#475569',
      voidBg: '#1e3a8a',
      floorA: '#94a3b8',
      floorB: '#8294ab',
      floorAccent: '#eab308',
      wallTop: '#64748b',
      wallFront: '#475569',
      neon: '#fbbf24',
      neonAlt: '#38bdf8',
      water: '#0369a1',
    },
  },
  {
    id: 'tower',
    index: 7,
    code: 'ENDLESS MODE',
    name: '勇者の試練の古塔',
    en: 'TOWER OF HEROIC TRIALS',
    bgm: 'boss',
    safe: false,
    darkness: false,
    particleType: 'aurora',
    recLevel: 15,
    palette: {
      skyTop: '#1e293b',
      skyHorizon: '#94a3b8',
      fogColor: '#64748b',
      fogDensity: 0.0009,
      sunColor: '#fde68a',
      ambientSky: '#93c5fd',
      ambientGround: '#475569',
      voidBg: '#334155',
      floorA: '#78716c',
      floorB: '#68625d',
      floorAccent: '#a89f91',
      wallTop: '#57534e',
      wallFront: '#44403c',
      neon: '#f59e0b',
      neonAlt: '#38bdf8',
      water: '#0e7490',
    },
  },
];

export const ENEMIES = {
  // Area 1: Forest / Grasslands
  slime_lumina: {
    id: 'slime_lumina', name: 'フォレストチュチュ', area: 'forest', shape: 'slime',
    color: '#22c55e', accent: '#bbf7d0', radius: 17,
    hp: 46, atk: 10, def: 2, spd: 86, exp: 20, gold: 18,
    weakness: 'fire', ai: 'chase', statusOnHit: null,
    dropTable: ['wp_verdant_saber', 'ar_lumina_mail'],
    lore: '草原や森に棲む自然魔力のゼリー生命体。炎の魔法に極端に弱い。',
  },
  spore_wisp: {
    id: 'spore_wisp', name: 'ポイズンデクババ霊', area: 'forest', shape: 'wisp',
    color: '#84cc16', accent: '#fde047', radius: 16,
    hp: 40, atk: 12, def: 1, spd: 95, exp: 24, gold: 22,
    weakness: 'fire', ai: 'shooter', statusOnHit: 'poison',
    dropTable: ['wp_verdant_saber'],
    lore: '毒の種弾を吐き出す森の魔精霊。遠距離から狙い撃ってくるため盾ガードや回避が有効。',
  },
  moss_beetle: {
    id: 'moss_beetle', name: 'ボコブリン突撃兵', area: 'forest', shape: 'goblin',
    color: '#b45309', accent: '#fbbf24', radius: 21,
    hp: 78, atk: 15, def: 5, spd: 112, exp: 34, gold: 32,
    weakness: 'ice', ai: 'charger', statusOnHit: null,
    dropTable: ['wp_verdant_saber', 'ar_lumina_mail'],
    lore: '棍棒と木盾を構えて突撃してくる草原の魔物。突進の予備動作にジャスト回避やパリィを合わせよう！',
  },

  // Area 2: Crystal Cave
  crystal_bat: {
    id: 'crystal_bat', name: 'アイスキース（氷蝙蝠）', area: 'cave', shape: 'bat',
    color: '#38bdf8', accent: '#e0f2fe', radius: 16,
    hp: 82, atk: 20, def: 4, spd: 138, exp: 48, gold: 44,
    weakness: 'lightning', ai: 'chase', statusOnHit: null,
    dropTable: ['wp_frost_scepter', 'ar_crystal_barrier'],
    lore: '暗闇の氷晶洞窟を飛び回る氷翼の魔蝙蝠。雷の連鎖で一網打尽にできる。',
  },
  frost_golem: {
    id: 'frost_golem', name: 'フロストタロス（氷岩巨兵）', area: 'cave', shape: 'golem',
    color: '#60a5fa', accent: '#bae6fd', radius: 23,
    hp: 155, atk: 26, def: 10, spd: 72, exp: 68, gold: 64,
    weakness: 'fire', ai: 'charger', statusOnHit: 'freeze',
    dropTable: ['ar_crystal_barrier', 'wp_frost_scepter'],
    lore: '巨大な青氷岩が立ち上がった岩石巨兵。接触すると凍結する冷気を纏う。',
  },
  shade_eye: {
    id: 'shade_eye', name: 'ウィズローブ魔道士', area: 'cave', shape: 'mage_wraith',
    color: '#9333ea', accent: '#f472b6', radius: 17,
    hp: 95, atk: 24, def: 5, spd: 90, exp: 58, gold: 55,
    weakness: 'holy', ai: 'shooter', statusOnHit: 'poison',
    dropTable: ['wp_frost_scepter', 'wp_volt_edge'],
    lore: '闇の中から呪詛弾を放つ浮遊魔道士。聖光や炎で撃ち落とせ。',
  },

  // Area 3: Ancient Stone Temple Ruins
  cyber_drone: {
    id: 'cyber_drone', name: '古代守護スカウト', area: 'ruins', shape: 'construct',
    color: '#0284c7', accent: '#f59e0b', radius: 17,
    hp: 150, atk: 32, def: 9, spd: 122, exp: 92, gold: 88,
    weakness: 'lightning', ai: 'shooter', statusOnHit: 'paralyze',
    dropTable: ['wp_cyber_halberd', 'ar_cyber_exosuit'],
    lore: '古代石造神殿を巡回する小型ガーディアン。雷撃魔法で魔導回路を麻痺させやすい。',
  },
  blade_automaton: {
    id: 'blade_automaton', name: 'リザルフォス槍騎士', area: 'ruins', shape: 'knight_mob',
    color: '#0d9488', accent: '#fbbf24', radius: 20,
    hp: 210, atk: 38, def: 13, spd: 130, exp: 118, gold: 108,
    weakness: 'lightning', ai: 'charger', statusOnHit: null,
    dropTable: ['wp_cyber_halberd', 'ar_cyber_exosuit', 'wp_volt_edge'],
    lore: '素早い踏み込みから長槍を突き出す遺跡の精鋭戦士。パリィやジャスト回避ラッシュの好敵手。',
  },
  turret_core: {
    id: 'turret_core', name: '古代ガーディアン砲台', area: 'ruins', shape: 'turret',
    color: '#b45309', accent: '#38bdf8', radius: 20,
    hp: 195, atk: 36, def: 14, spd: 55, exp: 112, gold: 100,
    weakness: 'ice', ai: 'bomber', statusOnHit: null,
    dropTable: ['ar_cyber_exosuit', 'wp_cyber_halberd'],
    lore: '全方位へ古代光弾を放つ石造防衛塔。氷結で動きを封じよう。',
  },

  // Area 4: Magma Volcano
  magma_hound: {
    id: 'magma_hound', name: 'フレイムウルフ（炎狼）', area: 'magma', shape: 'beast',
    color: '#ea580c', accent: '#fde047', radius: 19,
    hp: 265, atk: 46, def: 14, spd: 152, exp: 155, gold: 148,
    weakness: 'ice', ai: 'chase', statusOnHit: 'burn',
    dropTable: ['wp_magma_katana', 'ar_magma_aegis'],
    lore: '溶岩のたてがみを靡かせて疾駆する火山の魔狼。氷の魔法が抜群に効く。',
  },
  reactor_titan: {
    id: 'reactor_titan', name: 'マグマロック巨神', area: 'magma', shape: 'golem',
    color: '#dc2626', accent: '#fb923c', radius: 25,
    hp: 380, atk: 54, def: 20, spd: 86, exp: 205, gold: 195,
    weakness: 'ice', ai: 'bomber', statusOnHit: 'burn',
    dropTable: ['ar_magma_aegis', 'wp_magma_katana', 'wp_seraph_staff'],
    lore: '灼熱の溶岩岩で構成された巨神。周囲に火球を撒き散らす。',
  },
  ember_wraith: {
    id: 'ember_wraith', name: 'メテオウィズローブ', area: 'magma', shape: 'mage_wraith',
    color: '#f97316', accent: '#fef08a', radius: 18,
    hp: 245, atk: 50, def: 12, spd: 118, exp: 168, gold: 162,
    weakness: 'ice', ai: 'shooter', statusOnHit: 'burn',
    dropTable: ['wp_phantom_fangs', 'ar_prism_mantle'],
    lore: '火山の火口に棲む上位炎魔道士。高火力だが氷結で一気に砕ける。',
  },

  // Area 5: Celestial Citadel
  astral_knight: {
    id: 'astral_knight', name: 'タートナック重装騎士', area: 'citadel', shape: 'knight_mob',
    color: '#4f46e5', accent: '#f59e0b', radius: 21,
    hp: 420, atk: 62, def: 22, spd: 148, exp: 265, gold: 250,
    weakness: 'holy', ai: 'charger', statusOnHit: 'paralyze',
    dropTable: ['wp_omega_caliber', 'ar_celestial_aegis', 'wp_phantom_fangs'],
    lore: '天空聖城を護る魔王直属の暗黒重装騎士。剣撃の踏み込みにジャスト回避を合わせてラッシュを叩き込め！',
  },
  void_seraph: {
    id: 'void_seraph', name: 'ガーディアン・スカイ', area: 'citadel', shape: 'construct',
    color: '#7c3aed', accent: '#fbbf24', radius: 22,
    hp: 390, atk: 66, def: 20, spd: 115, exp: 280, gold: 265,
    weakness: 'lightning', ai: 'bomber', statusOnHit: 'poison',
    dropTable: ['wp_seraph_staff', 'ar_prism_mantle', 'ar_celestial_aegis'],
    lore: '天空を舞いながら古代光弾を放つ飛行型ガーディアン。',
  },
  omega_sentinel: {
    id: 'omega_sentinel', name: 'ライネル黄金魔獣騎士', area: 'citadel', shape: 'golem',
    color: '#b91c1c', accent: '#fbbf24', radius: 25,
    hp: 540, atk: 70, def: 28, spd: 96, exp: 330, gold: 310,
    weakness: 'fire', ai: 'shooter', statusOnHit: 'burn',
    dropTable: ['wp_omega_caliber', 'ar_celestial_aegis'],
    lore: '天空聖城最強の魔獣騎士。圧倒的な攻撃力を誇るが、倒せば最高峰の武具を落とす。',
  },
};

export const BOSSES = {
  boss_sylvarion: {
    id: 'boss_sylvarion',
    name: '聖樹の守護巨獣・シルヴァリオン',
    title: 'GUARDIAN BEAST OF THE GREAT WOODS',
    area: 'forest',
    color: '#16a34a',
    accent: '#eab308',
    radius: 42,
    hp: 820,
    atk: 24,
    def: 7,
    spd: 108,
    exp: 260,
    gold: 420,
    weakness: 'fire',
    crystalCount: 2,
    guaranteedDrop: 'wp_sylva_relic',
    lore: '古より聖樹の森と星結晶を護っていた巨獣。魔王の瘴気に侵され暴走している。',
    introDialogue: [
      '【シルヴァリオン】グルルル……聖樹の社に踏み入る人の子ヨ……！',
      '【シルヴァリオン】周囲の守護結界石が輝く限り、我が巨躯は傷つかぬ！',
    ],
    phase2Line: '【シルヴァリオン】森の怒りよ荒れ狂え！翠嵐の咆哮！！',
    defeatLine: '【シルヴァリオン】……瘴気が、晴れた……。勇者よ、氷晶の洞窟への道を開こう……！',
  },
  boss_crystalion: {
    id: 'boss_crystalion',
    name: '白銀の氷晶古竜・クリスタリオン',
    title: 'ANCIENT WYRM OF THE FROST CAVERN',
    area: 'cave',
    color: '#0284c7',
    accent: '#7dd3fc',
    radius: 46,
    hp: 1550,
    atk: 36,
    def: 12,
    spd: 118,
    exp: 520,
    gold: 780,
    weakness: 'fire',
    crystalCount: 3,
    guaranteedDrop: 'wp_crystal_emperor',
    lore: '暗闇の鍾乳洞最奥に棲む氷晶の古竜。闇を切り裂く吹雪ブレスと氷柱を放つ。',
    introDialogue: [
      '【クリスタリオン】暗闇の氷淵へようこそ、小さな灯火よ……。',
      '【クリスタリオン】永遠の氷棺に封じてくれよう！',
    ],
    phase2Line: '【クリスタリオン】見事な剣筋だ……だが我が絶対零度の吹雪を耐えられるかな！',
    defeatLine: '【クリスタリオン】あたたかき光よ……古代石造神殿の封印は今、解かれた……。',
  },
  boss_chronos: {
    id: 'boss_chronos',
    name: '古代神殿の巨神兵・クロノガーディアン',
    title: 'ANCIENT TEMPLE COLOSSUS',
    area: 'ruins',
    color: '#0369a1',
    accent: '#f59e0b',
    radius: 46,
    hp: 2450,
    atk: 48,
    def: 18,
    spd: 128,
    exp: 860,
    gold: 1250,
    weakness: 'lightning',
    crystalCount: 3,
    guaranteedDrop: 'ar_cyber_exosuit',
    lore: '古代王国が神殿の守護者として建造した魔導巨神兵。古代光線と落雷陣を操る。',
    introDialogue: [
      '【クロノガーディアン】試練ノ神殿ニ侵入者ヲ確認。古代防衛機構、起動。',
      '【クロノガーディアン】汝ニ勇者ノ資格ガアルカ、我ガ審判ノ光デ試サン！',
    ],
    phase2Line: '【クロノガーディアン】勇気アル者ヨ……神殿紋章力、最大解放！！',
    defeatLine: '【クロノガーディアン】試練達成ヲ承認……灼熱ノ竜火山ヘノ門ヲ開放スル……。',
  },
  boss_ignis: {
    id: 'boss_ignis',
    name: '紅蓮の火竜王・イグニスレックス',
    title: 'LORD OF THE VOLCANO CALDERA',
    area: 'magma',
    color: '#dc2626',
    accent: '#fbbf24',
    radius: 50,
    hp: 3600,
    atk: 62,
    def: 22,
    spd: 134,
    exp: 1350,
    gold: 1950,
    weakness: 'ice',
    crystalCount: 4,
    guaranteedDrop: 'ar_magma_aegis',
    lore: 'オルディン竜火山の頂に君臨する炎の古竜王。灼熱のブレスと隕石落下の猛攻を仕掛ける。',
    introDialogue: [
      '【イグニスレックス】グオオオッ！よくぞこの灼熱の火口まで登り詰めたな！',
      '【イグニスレックス】天空の聖城へ昇る力があるか、我が業火で試してやる！',
    ],
    phase2Line: '【イグニスレックス】燃え滾るぞ！！火山噴火・紅蓮の覇王覚醒！！',
    defeatLine: '【イグニスレックス】見事な勇気だ……天空聖城に巣食う厄災魔王を討つのは貴様らだ！',
  },
  boss_omega: {
    id: 'boss_omega',
    name: '厄災の古代魔導王・オメガノヴァ',
    title: 'CALAMITY SOVEREIGN OF THE STAR REALM',
    area: 'citadel',
    color: '#7c3aed',
    accent: '#f59e0b',
    radius: 54,
    hp: 5400,
    atk: 76,
    def: 26,
    spd: 146,
    exp: 2600,
    gold: 4000,
    weakness: 'holy',
    crystalCount: 4,
    guaranteedDrop: 'wp_omega_caliber',
    isFinalBoss: true,
    lore: '王国の5つの星結晶を奪い、世界を闇で覆おうと目論む天空聖城の厄災魔導王。',
    introDialogue: [
      '【厄災魔導王オメガノヴァ】フハハハハ！我が天空の玉座まで辿り着くとは褒めてやろう。',
      '【厄災魔導王オメガノヴァ】星結晶の力は既に我が手の中。この大地は我が闇の王国となるのだ！',
      '【厄災魔導王オメガノヴァ】さあ、終焉の剣舞を始めようぞ！！',
    ],
    phase2Line: '【厄災魔導王オメガノヴァ】おのれ勇者よ！？ならば星核の闇を全開放する！真・魔王覚醒！！',
    defeatLine: '【厄災魔導王オメガノヴァ】ぐあああっ……！勇者の剣と絆の光が、我が厄災を打ち砕くというのか……！',
  },
  boss_astral_zero: {
    id: 'boss_astral_zero',
    name: '星穹の創世神将・アストラルゼロ',
    title: 'SECRET SUPERBOSS — CELESTIAL ARBITER',
    area: 'secret',
    color: '#eab308',
    accent: '#38bdf8',
    radius: 56,
    hp: 8200,
    atk: 94,
    def: 32,
    spd: 158,
    exp: 5000,
    gold: 8888,
    weakness: 'holy',
    crystalCount: 4,
    guaranteedDrop: 'wp_astral_singularity',
    isSecretBoss: true,
    lore: '世界を創りし星核神殿の最奥で、真の勇者を試すために待つ創世の神将。',
    introDialogue: [
      '【アストラルゼロ】……創世ノ聖域ニ至リシ剣ノ勇者ヨ。',
      '【アストラルゼロ】我ハ星核ノ記憶ニシテ究極ノ試練。ソノ刃と盾、神話ヲ超エテミセヨ！',
    ],
    phase2Line: '【アストラルゼロ】星々ヨ、輝きヲ束ネヨ！！創世神威・フルバースト！！',
    defeatLine: '【アストラルゼロ】実ニ見事ナリ……汝コソ「ルミナ・クロニクル」真ノ伝説ノ勇者ナリ！',
  },
};

export const NPCS = {
  town_guide: {
    id: 'town_guide', name: '巫女姫リア', role: 'guide', icon: '🌟', color: '#38bdf8',
    bodyType: 'female', hairColor: '#fcd34d', outfitColor: '#2563eb',
    lines: [
      'ようこそ『王都ルミナリア城下町』へ！私は星結晶の巫女リアです。',
      '厄災魔導王オメガノヴァに奪われた5つの星結晶を取り戻すため、まずは東の城門から【1. 風のフィローネ大草原】へ向かいましょう！',
      '敵の近くで「🎯 ロックオン（Z注目）」すると敵を見据えて戦えます。敵の攻撃タイミングに合わせて「🛡️ ガード（パリィ）」や「⚡ 回避（ジャスト回避ラッシュ）」を決めると一気に大逆転できますよ！',
      'また、画面右側のドラッグで360度カメラ回転、「🎥 視点」ボタン（またはVキー）でTPSと一人称視点（FPS）も自由に切り替えられます！',
    ],
  },
  town_glamour: {
    id: 'town_glamour', name: '吟遊詩人カシム', role: 'talk', icon: '🪕', color: '#10b981',
    bodyType: 'slim', hairColor: '#cbd5e1', outfitColor: '#15803d',
    lines: [
      'やあ旅の勇者よ！風の噂で聞いたかい？この大地にはヒビ割れた岩壁の奥に隠された秘密の宝物庫があるそうだ。',
      'メニューの「設定」からは、いつでも自分の体型スタイル（男性型・女性型・スリム型）やカメラ感度を変更できるぞ！',
      '仲間と協力したい時は、右上の「🌐 協力」から合言葉ルームを作れば最大4人のパーティーで冒険できるさ！',
    ],
  },
  town_gear: {
    id: 'town_gear', name: '王都武具商ゼクス', role: 'shop_gear', icon: '🛡️', color: '#2563eb',
    bodyType: 'male', hairColor: '#78350f', outfitColor: '#1e40af',
    lines: ['いらっしゃい！王国騎士団御用達の剣や盾、旅の鎧を取り揃えてるぜ！'],
  },
  town_magic: {
    id: 'town_magic', name: '宮廷魔導師ルナ', role: 'shop_magic', icon: '🔮', color: '#9333ea',
    bodyType: 'female', hairColor: '#e2e8f0', outfitColor: '#6b21a8',
    lines: ['古代属性魔法の習得と強化なら任せて！魔物の弱点属性を突けば大ダメージを与えられるわ！'],
  },
  town_forge: {
    id: 'town_forge', name: '親方鍛冶師バルカン', role: 'blacksmith', icon: '⚒️', color: '#ea580c',
    bodyType: 'male', hairColor: '#b45309', outfitColor: '#9a3412',
    lines: ['おう！鉱石とゴールドがあれば武具を +10 まで鍛え上げてやる！+4以上になると刀身に聖なるルーンの輝きが宿るぜ！'],
  },
  town_inn: {
    id: 'town_inn', name: '宿屋の女将ミア', role: 'inn', icon: '🌙', color: '#eab308',
    bodyType: 'female', hairColor: '#d97706', outfitColor: '#b45309',
    lines: ['旅のお疲れさま！うちの暖炉とふかふかのベッドで休めば、HPもMPも全回復＆自動セーブされるわよ♪'],
  },
  town_drone: {
    id: 'town_drone', name: '古代遺物技師チップ', role: 'drone', icon: '🧚', color: '#10b981',
    bodyType: 'slim', hairColor: '#6ee7b7', outfitColor: '#047857',
    lines: ['キミの肩の後ろを飛んでる「古代精霊オーブ」を強化できるよ！自動聖光弾の援護やアイテム吸引範囲をパワーアップしよう！'],
  },
  town_warp: {
    id: 'town_warp', name: '古代シーカー転移石碑', role: 'warp', icon: '🌀', color: '#38bdf8',
    bodyType: 'device', hairColor: '#38bdf8', outfitColor: '#0284c7',
    lines: ['青白く輝く古代の転移石碑だ。到達済みの地域へ瞬時にワープできます。'],
  },

  // Field NPCs
  forest_scout: {
    id: 'forest_scout', name: '王国斥候カイト', role: 'talk', icon: '🌿', color: '#16a34a',
    bodyType: 'male', hairColor: '#3f6212', outfitColor: '#15803d',
    lines: [
      'やあ勇者！この先の守護巨獣【シルヴァリオン】は【炎属性（ファイアボール）】が弱点だぞ！',
      'ボスが【守護結界石（クリスタル）】を展開している間は無敵バリアが張られている。まずは周囲の結界石をすべて砕くんだ！',
      'また、ボスの攻撃が当たる直前に回避ボタンを押すと【ジャスト回避ラッシュ】が発動して超高速連撃を叩き込めるぞ！',
    ],
  },
  cave_miner: {
    id: 'cave_miner', name: '採掘師ドイル', role: 'talk', icon: '⛏️', color: '#38bdf8',
    bodyType: 'male', hairColor: '#475569', outfitColor: '#0369a1',
    lines: [
      'ここは暗闇の氷晶鍾乳洞だ！自分のランタンと発光クリスタルの周囲を頼りに進むんだぜ。',
      '奥の氷晶古竜【クリスタリオン】は【炎属性】に弱い。地面に赤い予兆が出たら、タイミングよく回避してラッシュを狙うんだ！',
      '青い古代スイッチを踏むと封印された格子門が開く仕組みだぞ。',
    ],
  },
  ruins_scholar: {
    id: 'ruins_scholar', name: '考古学者エリス', role: 'talk', icon: '📜', color: '#f59e0b',
    bodyType: 'female', hairColor: '#d97706', outfitColor: '#b45309',
    lines: [
      'ここは古代王国の石造神殿よ！動く回転刃の罠には気をつけて。',
      '神殿の巨神兵【クロノガーディアン】には【雷属性（サンダーチェイン）】が超有効よ！',
      'そうそう、北東のヒビ割れた石壁の奥に【星核の創世大神殿（裏ボス）】へ繋がる古代転移門が眠っているという伝承があるわ……！',
    ],
  },
  magma_engineer: {
    id: 'magma_engineer', name: '竜火山調査員ゴウ', role: 'talk', icon: '🔥', color: '#ea580c',
    bodyType: 'male', hairColor: '#7c2d12', outfitColor: '#c2410c',
    lines: [
      'うおお熱いぜ！赤く煮えたぎる溶岩床は踏むと火傷ダメージを受けるからジャンプや回避ダッシュで飛び越えろ！',
      '最奥の火竜王【イグニスレックス】は【氷属性（アイシクルノヴァ）】が弱点だ。鍛冶屋で武器を+4以上に鍛えておけば心強いぜ！',
    ],
  },
  citadel_knight: {
    id: 'citadel_knight', name: '近衛隊長アレン', role: 'talk', icon: '⚔️', color: '#2563eb',
    bodyType: 'male', hairColor: '#fbbf24', outfitColor: '#1d4ed8',
    lines: [
      'ついにここまで来たか……この大聖堂の奥が【厄災魔導王オメガノヴァ】の玉座だ。',
      '魔王はHPが半分を切ると第2形態に覚醒し、猛攻が激化する。Z注目ロックオン・パリィ・ジャスト回避ラッシュ・リミット必殺技のすべてをぶつけて世界に光を取り戻してくれ！',
    ],
  },
};

export const ACHIEVEMENTS = [
  { id: 'first_blood', icon: '⚔️', title: '旅立ちの初陣', desc: '魔物を初めて討伐した' },
  { id: 'combo_30', icon: '🔥', title: '剣閃の連舞', desc: '30ヒット以上のコンボを達成した' },
  { id: 'combo_80', icon: '⚡', title: '無双の勇者', desc: '80ヒット以上のコンボを達成した' },
  { id: 'secret_wall', icon: '💎', title: '秘宝の探求者', desc: 'ヒビ割れた隠し岩壁を破壊して秘密の部屋を発見した' },
  { id: 'shrine_visit', icon: '⛩️', title: '女神の祝福', desc: '古代の祝福祭壇を起動した' },
  { id: 'forge_3', icon: '⚒️', title: '熟練の鍛冶魂', desc: '装備を +3 以上に強化した' },
  { id: 'forge_7', icon: '🌟', title: '伝説の名工', desc: '装備を +7 以上に強化した' },
  { id: 'drone_max', icon: '🧚', title: '精霊オーブの極致', desc: '古代精霊オーブをLv.5（MAX）に強化した' },
  { id: 'boss_forest', icon: '🌿', title: '聖樹の森の解放者', desc: 'シルヴァリオンを討伐した' },
  { id: 'boss_cave', icon: '❄️', title: '氷晶古竜を屠る者', desc: 'クリスタリオンを討伐した' },
  { id: 'boss_ruins', icon: '🏛️', title: '古代試練の超越者', desc: 'クロノガーディアンを討伐した' },
  { id: 'boss_magma', icon: '🌋', title: '竜火山の覇者', desc: 'イグニスレックスを討伐した' },
  { id: 'game_clear', icon: '👑', title: '星結晶の伝説勇者', desc: '厄災魔導王オメガノヴァを討伐し王国を救った' },
  { id: 'secret_boss', icon: '🌌', title: '創世の神話を超える者', desc: '裏ボス「星穹の創世神将アストラルゼロ」を討伐した' },
  { id: 'tower_5', icon: '🗼', title: '試練の古塔の挑戦者', desc: '勇者の試練の古塔で5階層を突破した' },
  { id: 'coop_hero', icon: '🤝', title: '誓いの絆', desc: 'オンライン協力プレイまたは仲間の蘇生を達成した' },
];

export const QUICK_STAMPS = [
  { id: 'hello', text: 'よろしく！', icon: '✨' },
  { id: 'nice', text: 'ナイス！', icon: '🔥' },
  { id: 'heal', text: '回復たすかる！', icon: '💚' },
  { id: 'secret', text: '隠し部屋あった！', icon: '💎' },
  { id: 'boss', text: 'ボス行くぞ！', icon: '⚔️' },
  { id: 'thanks', text: 'ありがとう！', icon: '🌟' },
  { id: 'help', text: '助けて！', icon: '🆘' },
  { id: 'musou', text: 'ラッシュ決まった！', icon: '⚡' },
];

export const INTRO_STORY = [
  '蒼き空と風に揺れる緑の大地、古の石造神殿が息づく幻想の王国——『ルミナリア』。',
  '大草原、氷晶の鍾乳洞、黄昏の古代遺跡、灼熱の竜火山……5つの大地は王都の「星結晶」によって平和を保っていた。',
  'しかしある日、天空聖城に現れた【厄災の古代魔導王・オメガノヴァ】が星結晶を奪い去り、各地の守護巨獣たちを暴走させてしまう！',
  '最後の希望が残る『王都ルミナリア城下町』から、守護精霊オーブと共に今、若き勇者の壮大な冒険が始まる——！',
];

// ============================================================================
// DATA LOOKUP & STAT CALCULATION HELPERS
// ============================================================================
export function getWeaponById(id) {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}

export function getArmorById(id) {
  return ARMORS.find((a) => a.id === id) || ARMORS[0];
}

export function getSpellById(id) {
  return SPELLS.find((s) => s.id === id) || SPELLS[0];
}

export function getAreaById(id) {
  return AREAS.find((a) => a.id === id) || AREAS[0];
}

export function getEnemyById(id) {
  return ENEMIES[id] || ENEMIES.slime_lumina;
}

export function getBossById(id) {
  return BOSSES[id] || BOSSES.boss_sylvarion;
}

export function calcWeaponStats(weaponId, plus = 0) {
  const base = getWeaponById(weaponId);
  const scale = 1 + plus * 0.16;
  return {
    ...base,
    plus,
    atk: Math.round(base.atk * scale + plus * 3),
    mag: Math.round(base.mag * scale + plus * 2),
    crit: base.crit + plus * 0.008,
  };
}

export function calcArmorStats(armorId, plus = 0) {
  const base = getArmorById(armorId);
  const scale = 1 + plus * 0.15;
  return {
    ...base,
    plus,
    def: Math.round(base.def * scale + plus * 2),
    maxHp: Math.round(base.maxHp * scale + plus * 14),
    maxMp: Math.round(base.maxMp * scale + plus * 5),
    spd: base.spd + Math.floor(plus / 2) * 2,
  };
}

export function getForgeCost(currentPlus) {
  const next = currentPlus + 1;
  const gold = Math.round(90 * Math.pow(1.48, currentPlus));
  let oreType = 'stardust';
  let oreCount = Math.min(4, 1 + Math.floor(currentPlus / 2));
  if (next >= 5 && next <= 7) {
    oreType = 'prism';
    oreCount = next - 3;
  } else if (next >= 8) {
    oreType = 'void';
    oreCount = next - 6;
  }
  return { gold, oreType, oreCount, maxReached: currentPlus >= 10 };
}

export function getDroneUpgradeCost(level) {
  return {
    gold: Math.round(180 * Math.pow(2.05, level - 1)),
    oreType: level >= 4 ? 'void' : level >= 2 ? 'prism' : 'stardust',
    oreCount: level,
    maxReached: level >= 5,
  };
}
