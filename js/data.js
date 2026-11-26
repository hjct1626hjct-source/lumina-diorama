// ============================================================================
// LUMINA DIORAMA — Cyber Neon Chronicles
// Master Game Data Registry (Jobs, Gear, Spells, Enemies, Bosses, Areas, Lore)
// 製作者：駿 (Created by Shun)
// ============================================================================

export const GAME_META = {
  title: 'LUMINA DIORAMA',
  subtitle: '— CYBER NEON CHRONICLES — 〜星結晶と機械魔王の箱庭〜',
  creator: '製作者：駿 (Created by Shun)',
  version: '1.0.0',
  tileSize: 48,
};

export const RARITY_INFO = {
  common: { label: 'COMMON', color: '#cbd5e1', mult: 1.0, sellMult: 1.0 },
  rare: { label: 'RARE', color: '#38bdf8', mult: 1.24, sellMult: 1.8 },
  epic: { label: 'EPIC', color: '#f472b6', mult: 1.52, sellMult: 3.2 },
  legendary: { label: 'LEGENDARY', color: '#fbbf24', mult: 1.9, sellMult: 6.0 },
};

export const ELEMENT_INFO = {
  none: { name: '無属性', icon: '✦', color: '#e2e8f0' },
  fire: { name: '炎', icon: '🔥', color: '#fb923c' },
  ice: { name: '氷', icon: '❄️', color: '#7dd3fc' },
  lightning: { name: '雷', icon: '⚡', color: '#fde047' },
  holy: { name: '聖', icon: '✨', color: '#fef08a' },
};

export const JOBS = {
  knight: {
    id: 'knight',
    name: 'ブレイドナイト',
    en: 'BLADE KNIGHT',
    badge: 'KNIGHT',
    icon: '⚔️',
    color: '#22d3ee',
    accent: '#38f8d4',
    desc: '高いHPと堅牢な装甲を誇る近接の覇者。広範囲の3連ネオンスラッシュと3撃目の衝撃波で敵を一掃する。',
    starterWeapon: 'wp_neon_blade',
    starterArmor: 'ar_aegis_plate',
    starterSpells: ['fire'],
    baseStats: { maxHp: 150, maxMp: 65, atk: 20, mag: 12, def: 10, spd: 215, crit: 0.12, goldMult: 1.0 },
    growth: { maxHp: 24, maxMp: 7, atk: 4.5, mag: 2.2, def: 2.2, crit: 0.005 },
    attackRange: 88,
    attackArc: Math.PI * 0.92,
    attackCooldown: 0.30,
    limitName: 'アストラル・テンペスト',
    limitDesc: '周囲の敵すべてを蒼き星刃の竜巻で5連撃＆超衝撃波で吹き飛ばす！',
  },
  mage: {
    id: 'mage',
    name: 'アークメイジ',
    en: 'ARC MAGE',
    badge: 'MAGE',
    icon: '🔮',
    color: '#e879f9',
    accent: '#7dd3fc',
    desc: '膨大なMPと誘導魔弾を操る星結晶の魔導士。初期から範囲氷結と味方回復の魔法を使いこなす。',
    starterWeapon: 'wp_prism_wand',
    starterArmor: 'ar_astral_robe',
    starterSpells: ['ice', 'heal'],
    baseStats: { maxHp: 112, maxMp: 125, atk: 14, mag: 24, def: 6, spd: 210, crit: 0.14, goldMult: 1.0 },
    growth: { maxHp: 15, maxMp: 16, atk: 2.4, mag: 5.5, def: 1.4, crit: 0.006 },
    attackRange: 280,
    attackArc: Math.PI * 0.5,
    attackCooldown: 0.34,
    limitName: 'メテオ・プリズムノヴァ',
    limitDesc: '7条の極彩オービタルレーザーを降り注がせ、戦場全体を凍結＆殲滅する！',
  },
  rogue: {
    id: 'rogue',
    name: 'シャドウローグ',
    en: 'SHADOW ROGUE',
    badge: 'ROGUE',
    icon: '🗡️',
    color: '#34d399',
    accent: '#a3e635',
    desc: '圧倒的な機動力と高会心率を誇る双剣の影。さらに獲得ゴールド+35%のトレジャーハンター特性を持つ。',
    starterWeapon: 'wp_plasma_daggers',
    starterArmor: 'ar_stealth_cloak',
    starterSpells: ['lightning'],
    baseStats: { maxHp: 124, maxMp: 82, atk: 18, mag: 15, def: 7, spd: 252, crit: 0.30, goldMult: 1.35 },
    growth: { maxHp: 18, maxMp: 9, atk: 4.1, mag: 2.8, def: 1.6, crit: 0.01 },
    attackRange: 72,
    attackArc: Math.PI * 0.78,
    attackCooldown: 0.21,
    limitName: 'ファントム・オーバーロード',
    limitDesc: '時間を切り裂く超高速ミラージュ連撃で敵を8回連続の確定クリティカル斬撃！',
  },
};

export const WEAPONS = [
  // Starter Weapons
  { id: 'wp_neon_blade', name: 'ネオンブレード', type: 'blade', rarity: 'common', atk: 12, mag: 4, crit: 0.02, element: 'none', price: 80, shopTier: 0, color: '#38f8d4', desc: '拠点の標準規格で作られた蒼光のネオン剣。' },
  { id: 'wp_prism_wand', name: 'プリズムワンド', type: 'wand', rarity: 'common', atk: 8, mag: 14, crit: 0.03, element: 'ice', price: 80, shopTier: 0, color: '#e879f9', desc: '星結晶の欠片を宿す魔導杖。誘導魔弾を放つ。' },
  { id: 'wp_plasma_daggers', name: 'ツインプラズマダガー', type: 'dagger', rarity: 'common', atk: 11, mag: 6, crit: 0.08, element: 'lightning', price: 80, shopTier: 0, color: '#4ade80', desc: '超高速連撃と会心に特化した双プラズマ短剣。' },

  // Shop / Mid Tier Weapons
  { id: 'wp_verdant_saber', name: '翠光のフォレストセイバー', type: 'blade', rarity: 'rare', atk: 24, mag: 10, crit: 0.05, element: 'fire', price: 320, shopTier: 1, color: '#34d399', desc: '樹海の光胞子エネルギーを結晶化させた鋭利な光剣。' },
  { id: 'wp_frost_scepter', name: 'クリスタル・フロストセプター', type: 'wand', rarity: 'rare', atk: 16, mag: 28, crit: 0.06, element: 'ice', price: 360, shopTier: 1, color: '#38bdf8', desc: '洞窟の純氷晶から削り出された高出力魔導杖。' },
  { id: 'wp_volt_edge', name: 'サンダー・ボルトエッジ', type: 'dagger', rarity: 'rare', atk: 22, mag: 16, crit: 0.14, element: 'lightning', price: 420, shopTier: 1, color: '#facc15', desc: '雷撃を帯びたサイバー双刃。機械系の敵に絶大な威力。' },
  { id: 'wp_cyber_halberd', name: 'クロノ・サイバーブレイド', type: 'blade', rarity: 'epic', atk: 42, mag: 22, crit: 0.10, element: 'lightning', price: 1050, shopTier: 2, color: '#22d3ee', desc: '古代機工遺跡の時空技術で鍛造された重光刃。' },
  { id: 'wp_magma_katana', name: '紅蓮のマグマブレイザー', type: 'blade', rarity: 'epic', atk: 54, mag: 26, crit: 0.12, element: 'fire', price: 1650, shopTier: 3, color: '#fb7185', desc: 'マグマリアクターの炉心熱を封じた灼熱の大光剣。' },
  { id: 'wp_seraph_staff', name: 'セラフィム・アークスタッフ', type: 'wand', rarity: 'epic', atk: 30, mag: 56, crit: 0.12, element: 'holy', price: 1600, shopTier: 3, color: '#fde047', desc: '聖光と星力を極限まで増幅する大魔導士の秘杖。' },
  { id: 'wp_phantom_fangs', name: 'ファントム・ゼロファング', type: 'dagger', rarity: 'epic', atk: 46, mag: 28, crit: 0.22, element: 'ice', price: 1550, shopTier: 3, color: '#c084fc', desc: '残像すら斬り裂く光学迷彩ブレード。' },

  // Hack & Slash Boss / Secret Legendary Weapons
  { id: 'wp_sylva_relic', name: '星樹の聖剣・エメラルディア', type: 'blade', rarity: 'epic', atk: 36, mag: 20, crit: 0.12, element: 'holy', price: 900, shopTier: 99, color: '#6ee7b7', desc: '樹海の守護機獣が護っていた古代ジオラマの聖剣。' },
  { id: 'wp_crystal_emperor', name: '凍晶の竜杖・アブソリュート', type: 'wand', rarity: 'epic', atk: 26, mag: 48, crit: 0.14, element: 'ice', price: 1300, shopTier: 99, color: '#67e8f9', desc: '幽竜クリスタリオンの核を宿す極寒の覇杖。' },
  { id: 'wp_omega_caliber', name: '神剣・ルミナカリバー', type: 'blade', rarity: 'legendary', atk: 76, mag: 46, crit: 0.18, element: 'holy', price: 4200, shopTier: 99, color: '#fbbf24', desc: '機械魔王を打ち倒すために設計された究極の星結晶剣。' },
  { id: 'wp_astral_singularity', name: '虚空星刃・アストラルゼロ', type: 'blade', rarity: 'legendary', atk: 98, mag: 72, crit: 0.28, element: 'holy', price: 9999, shopTier: 99, color: '#38f8d4', desc: '裏ボスを制した者のみが手にする次元超越の最強武装。' },
];

export const ARMORS = [
  // Starter Armors
  { id: 'ar_aegis_plate', name: 'イージス装甲', rarity: 'common', def: 10, maxHp: 30, maxMp: 5, spd: 0, price: 70, shopTier: 0, color: '#38bdf8', desc: '軽量ネオン合金製の高耐久チェストプレート。' },
  { id: 'ar_astral_robe', name: 'アストラルローブ', rarity: 'common', def: 6, maxHp: 12, maxMp: 35, spd: 6, price: 70, shopTier: 0, color: '#e879f9', desc: '星結晶繊維を織り込んだ魔力循環ローブ。' },
  { id: 'ar_stealth_cloak', name: 'ステルス外套', rarity: 'common', def: 7, maxHp: 18, maxMp: 14, spd: 18, price: 70, shopTier: 0, color: '#34d399', desc: '空気抵抗を極限まで減らす光学迷彩クローク。' },

  // Shop / Mid Tier Armors
  { id: 'ar_lumina_mail', name: '翠光ルミナメイル', rarity: 'rare', def: 18, maxHp: 65, maxMp: 20, spd: 6, price: 300, shopTier: 1, color: '#34d399', desc: '樹海の光エネルギーで自動修復する中装鎧。' },
  { id: 'ar_crystal_barrier', name: 'クリスタル・イージスコート', rarity: 'rare', def: 24, maxHp: 80, maxMp: 45, spd: 8, price: 540, shopTier: 1, color: '#7dd3fc', desc: '結晶シールドを常時展開する高防御コート。' },
  { id: 'ar_cyber_exosuit', name: '機工エグゾフレーム', rarity: 'epic', def: 36, maxHp: 130, maxMp: 40, spd: 16, price: 1100, shopTier: 2, color: '#22d3ee', desc: '古代遺跡のサーボ機構を搭載した次世代強化外骨格。' },
  { id: 'ar_magma_aegis', name: '熔核ドラグーンアーマー', rarity: 'epic', def: 46, maxHp: 180, maxMp: 45, spd: 12, price: 1750, shopTier: 3, color: '#fb7185', desc: '超高温リアクターにも耐え抜く紅蓮の竜装甲。' },
  { id: 'ar_prism_mantle', name: '星穹プリズムマント', rarity: 'epic', def: 34, maxHp: 110, maxMp: 110, spd: 26, price: 1680, shopTier: 3, color: '#f472b6', desc: '魔力回復と移動速度を飛躍的に高める星織マント。' },

  // Legendary Armors
  { id: 'ar_celestial_aegis', name: '天空神装・セラフィムギア', rarity: 'legendary', def: 64, maxHp: 260, maxMp: 95, spd: 22, price: 4000, shopTier: 99, color: '#fbbf24', desc: '天空城の秘宝。圧倒的な防御と星光の加護を授ける。' },
  { id: 'ar_void_chronos', name: '星核神鎧・クロノインフィニティ', rarity: 'legendary', def: 82, maxHp: 350, maxMp: 150, spd: 32, price: 9500, shopTier: 99, color: '#38f8d4', desc: '虚空の星核から生まれた究極無欠のオーバーテクノロジー装甲。' },
];

export const SPELLS = [
  {
    id: 'fire',
    name: 'ファイアボール',
    element: 'fire',
    icon: '🔥',
    color: '#fb923c',
    mpCost: 14,
    cooldown: 0.75,
    basePower: 34,
    statusEffect: 'burn',
    learnCost: 120,
    desc: '爆発する貫通火球を放ち、敵を【延焼】状態にして継続ダメージを与える。',
  },
  {
    id: 'ice',
    name: 'アイシクルノヴァ',
    element: 'ice',
    icon: '❄️',
    color: '#7dd3fc',
    mpCost: 18,
    cooldown: 1.1,
    basePower: 32,
    statusEffect: 'freeze',
    learnCost: 180,
    desc: '周囲に極寒の星晶リングを展開し、敵を【凍結・鈍足】状態にする範囲魔法。',
  },
  {
    id: 'lightning',
    name: 'サンダーチェイン',
    element: 'lightning',
    icon: '⚡',
    color: '#fde047',
    mpCost: 20,
    cooldown: 1.15,
    basePower: 38,
    statusEffect: 'paralyze',
    learnCost: 240,
    desc: '最大4体の敵へ連鎖する高圧プラズマ雷撃。敵を【麻痺スタン】で止める。',
  },
  {
    id: 'heal',
    name: 'エリアヒール',
    element: 'holy',
    icon: '✨',
    color: '#34d399',
    mpCost: 24,
    cooldown: 2.2,
    basePower: 75,
    statusEffect: null,
    learnCost: 220,
    desc: '聖光のドームを展開し、自分と周囲の協力パーティー全員のHPを大回復＆毒を浄化！',
  },
  {
    id: 'overclock',
    name: 'オーバークロック',
    element: 'none',
    icon: '⚙️',
    color: '#38f8d4',
    mpCost: 26,
    cooldown: 5.0,
    basePower: 12, // seconds duration base
    statusEffect: null,
    learnCost: 340,
    desc: '自分と周囲の味方全員の攻撃力+35%・移動速度+25%を一定時間ブーストする補助魔法！',
  },
];

export const CORES = {
  vital: { id: 'vital', name: 'バイタルコア', icon: '💚', color: '#34d399', stat: 'maxHp', bonus: 20, desc: '最大HPを永久に+20する星結晶コア。' },
  ether: { id: 'ether', name: 'エーテルコア', icon: '💙', color: '#38bdf8', stat: 'maxMp', bonus: 14, desc: '最大MPを永久に+14する星結晶コア。' },
  power: { id: 'power', name: 'パワーコア', icon: '❤️', color: '#fb7185', stat: 'atk', bonus: 5, desc: '攻撃力＆魔力を永久に+5する星結晶コア。' },
  crit: { id: 'crit', name: 'クリティカルコア', icon: '💛', color: '#fbbf24', stat: 'crit', bonus: 0.025, desc: '会心率を永久に+2.5%する星結晶コア。' },
};

export const ORES = {
  stardust: { id: 'stardust', name: '星屑鉱石', icon: '🔹', color: '#38bdf8' },
  prism: { id: 'prism', name: '輝晶インゴット', icon: '🔸', color: '#f472b6' },
  void: { id: 'void', name: '虚空クリスタル', icon: '💠', color: '#fbbf24' },
};

export const AREAS = [
  {
    id: 'town',
    index: 0,
    code: 'HUB',
    name: '拠点ネオンタウン',
    en: 'NEON LUMINA TOWN',
    bgm: 'town',
    safe: true,
    darkness: false,
    particleType: 'lantern',
    recLevel: 1,
    palette: {
      voidBg: '#06101f',
      floorA: '#13243b',
      floorB: '#162b47',
      floorAccent: '#1f3b5c',
      wallTop: '#24476e',
      wallFront: '#132945',
      neon: '#38f8d4',
      neonAlt: '#fbbf24',
      water: '#0c4a6e',
    },
  },
  {
    id: 'forest',
    index: 1,
    code: 'AREA 01',
    name: '翠光のジオラマ樹海',
    en: 'VERDANT LUMINA FOREST',
    bgm: 'field',
    safe: false,
    darkness: false,
    particleType: 'spores',
    recLevel: 1,
    bossId: 'boss_sylvarion',
    palette: {
      voidBg: '#041214',
      floorA: '#10312c',
      floorB: '#133b35',
      floorAccent: '#1b4d44',
      wallTop: '#206352',
      wallFront: '#0f3830',
      neon: '#34d399',
      neonAlt: '#a7f3d0',
      water: '#0e7490',
    },
  },
  {
    id: 'cave',
    index: 2,
    code: 'AREA 02',
    name: '暗闇のクリスタル洞窟',
    en: 'OBSIDIAN CRYSTAL CAVERN',
    bgm: 'cave',
    safe: false,
    darkness: true,
    particleType: 'mist',
    recLevel: 4,
    bossId: 'boss_crystalion',
    palette: {
      voidBg: '#040712',
      floorA: '#11192e',
      floorB: '#15203b',
      floorAccent: '#1d2d52',
      wallTop: '#263c6e',
      wallFront: '#131f3b',
      neon: '#38bdf8',
      neonAlt: '#c084fc',
      water: '#1e3a8a',
    },
  },
  {
    id: 'ruins',
    index: 3,
    code: 'AREA 03',
    name: '古代サイバー機工遺跡',
    en: 'ANCIENT CYBER RUINS',
    bgm: 'field',
    safe: false,
    darkness: false,
    particleType: 'data',
    recLevel: 7,
    bossId: 'boss_chronos',
    palette: {
      voidBg: '#070e1c',
      floorA: '#162238',
      floorB: '#1b2944',
      floorAccent: '#25385c',
      wallTop: '#334e7d',
      wallFront: '#182845',
      neon: '#22d3ee',
      neonAlt: '#fbbf24',
      water: '#0f3b5c',
    },
  },
  {
    id: 'magma',
    index: 4,
    code: 'AREA 04',
    name: '灼熱のマグマリアクター',
    en: 'MAGMA CORE REACTOR',
    bgm: 'field',
    safe: false,
    darkness: false,
    particleType: 'embers',
    recLevel: 10,
    bossId: 'boss_ignis',
    palette: {
      voidBg: '#140608',
      floorA: '#2b161b',
      floorB: '#351c22',
      floorAccent: '#47252d',
      wallTop: '#633039',
      wallFront: '#33151b',
      neon: '#fb923c',
      neonAlt: '#fde047',
      water: '#ea580c',
    },
  },
  {
    id: 'citadel',
    index: 5,
    code: 'FINAL AREA',
    name: '機械魔王の天空城',
    en: 'ASTRAL CITADEL OF OMEGA',
    bgm: 'cave',
    safe: false,
    darkness: false,
    particleType: 'aurora',
    recLevel: 13,
    bossId: 'boss_omega',
    palette: {
      voidBg: '#07071a',
      floorA: '#171733',
      floorB: '#1d1d40',
      floorAccent: '#292857',
      wallTop: '#3c397a',
      wallFront: '#1c1a40',
      neon: '#f472b6',
      neonAlt: '#38f8d4',
      water: '#312e81',
    },
  },
  {
    id: 'secret',
    index: 6,
    code: 'SECRET VAULT',
    name: '虚空の星核神殿',
    en: 'ASTRAL SINGULARITY VAULT',
    bgm: 'cave',
    safe: false,
    darkness: false,
    particleType: 'stars',
    recLevel: 16,
    bossId: 'boss_astral_zero',
    palette: {
      voidBg: '#040611',
      floorA: '#101b30',
      floorB: '#14233d',
      floorAccent: '#1f3459',
      wallTop: '#2c4c7d',
      wallFront: '#12223d',
      neon: '#fbbf24',
      neonAlt: '#38f8d4',
      water: '#0c4a6e',
    },
  },
  {
    id: 'tower',
    index: 7,
    code: 'ENDLESS MODE',
    name: 'エンドレス試練の塔',
    en: 'ENDLESS TRIAL TOWER',
    bgm: 'boss',
    safe: false,
    darkness: false,
    particleType: 'aurora',
    recLevel: 15,
    palette: {
      voidBg: '#050b18',
      floorA: '#142038',
      floorB: '#192845',
      floorAccent: '#233860',
      wallTop: '#314f85',
      wallFront: '#162645',
      neon: '#38f8d4',
      neonAlt: '#fb7185',
      water: '#0e7490',
    },
  },
];

export const ENEMIES = {
  // Area 1: Forest
  slime_lumina: {
    id: 'slime_lumina', name: 'ルミナスライム', area: 'forest', shape: 'orb',
    color: '#34d399', accent: '#a7f3d0', radius: 17,
    hp: 46, atk: 10, def: 2, spd: 86, exp: 20, gold: 18,
    weakness: 'fire', ai: 'chase', statusOnHit: null,
    dropTable: ['wp_verdant_saber', 'ar_lumina_mail'],
    lore: '樹海の光胞子が凝縮して生まれたゼリー状の精霊。炎の魔法に極端に弱い。',
  },
  spore_wisp: {
    id: 'spore_wisp', name: 'ポイズンウィスプ', area: 'forest', shape: 'diamond',
    color: '#a3e635', accent: '#fde047', radius: 16,
    hp: 40, atk: 12, def: 1, spd: 95, exp: 24, gold: 22,
    weakness: 'fire', ai: 'shooter', statusOnHit: 'poison',
    dropTable: ['wp_verdant_saber'],
    lore: '毒胞子弾を放つ浮遊体。遠距離から狙い撃ってくるため回避ダッシュが有効。',
  },
  moss_beetle: {
    id: 'moss_beetle', name: 'ネオンスタッグ', area: 'forest', shape: 'hex',
    color: '#10b981', accent: '#38f8d4', radius: 21,
    hp: 78, atk: 15, def: 5, spd: 112, exp: 34, gold: 32,
    weakness: 'ice', ai: 'charger', statusOnHit: null,
    dropTable: ['wp_verdant_saber', 'ar_lumina_mail'],
    lore: '翠光の甲殻を持つ大型甲虫。一直線に突進する予備動作を見極めてかわそう。',
  },

  // Area 2: Crystal Cave
  crystal_bat: {
    id: 'crystal_bat', name: 'プリズムバット', area: 'cave', shape: 'tri',
    color: '#38bdf8', accent: '#e0f2fe', radius: 16,
    hp: 82, atk: 20, def: 4, spd: 138, exp: 48, gold: 44,
    weakness: 'lightning', ai: 'chase', statusOnHit: null,
    dropTable: ['wp_frost_scepter', 'ar_crystal_barrier'],
    lore: '暗闇の洞窟を高速で飛び回る結晶翼のコウモリ。雷の連鎖で動きを止められる。',
  },
  frost_golem: {
    id: 'frost_golem', name: 'クリスタルゴーレム', area: 'cave', shape: 'square',
    color: '#60a5fa', accent: '#93c5fd', radius: 23,
    hp: 155, atk: 26, def: 10, spd: 72, exp: 68, gold: 64,
    weakness: 'fire', ai: 'charger', statusOnHit: 'freeze',
    dropTable: ['ar_crystal_barrier', 'wp_frost_scepter'],
    lore: '硬質な青水晶が組み上がった巨兵。接触すると凍結する冷気を纏う。',
  },
  shade_eye: {
    id: 'shade_eye', name: 'アビスアイ', area: 'cave', shape: 'orb',
    color: '#c084fc', accent: '#f472b6', radius: 17,
    hp: 95, atk: 24, def: 5, spd: 90, exp: 58, gold: 55,
    weakness: 'holy', ai: 'shooter', statusOnHit: 'poison',
    dropTable: ['wp_frost_scepter', 'wp_volt_edge'],
    lore: '闇の中から紫光を放つ単眼の魔晶。聖光や炎で撃ち落とせ。',
  },

  // Area 3: Cyber Ruins
  cyber_drone: {
    id: 'cyber_drone', name: 'センチネル・ドローン', area: 'ruins', shape: 'hex',
    color: '#22d3ee', accent: '#fbbf24', radius: 17,
    hp: 150, atk: 32, def: 9, spd: 122, exp: 92, gold: 88,
    weakness: 'lightning', ai: 'shooter', statusOnHit: 'paralyze',
    dropTable: ['wp_cyber_halberd', 'ar_cyber_exosuit'],
    lore: '古代遺跡を巡回する自律防衛機。電撃魔法で回路をショートさせやすい。',
  },
  blade_automaton: {
    id: 'blade_automaton', name: 'クロノ・ランサー', area: 'ruins', shape: 'diamond',
    color: '#38bdf8', accent: '#38f8d4', radius: 20,
    hp: 210, atk: 38, def: 13, spd: 130, exp: 118, gold: 108,
    weakness: 'lightning', ai: 'charger', statusOnHit: null,
    dropTable: ['wp_cyber_halberd', 'ar_cyber_exosuit', 'wp_volt_edge'],
    lore: '高速プラズマ槍を構えた人型機工騎士。電撃に弱い。',
  },
  turret_core: {
    id: 'turret_core', name: 'プリズムタレット', area: 'ruins', shape: 'square',
    color: '#fbbf24', accent: '#fef08a', radius: 20,
    hp: 195, atk: 36, def: 14, spd: 55, exp: 112, gold: 100,
    weakness: 'ice', ai: 'bomber', statusOnHit: null,
    dropTable: ['ar_cyber_exosuit', 'wp_cyber_halberd'],
    lore: '全方位パルス弾幕を撒く防衛コア。氷結で発射間隔を鈍らせよう。',
  },

  // Area 4: Magma Reactor
  magma_hound: {
    id: 'magma_hound', name: 'フレアハウンド', area: 'magma', shape: 'tri',
    color: '#fb923c', accent: '#fde047', radius: 19,
    hp: 265, atk: 46, def: 14, spd: 152, exp: 155, gold: 148,
    weakness: 'ice', ai: 'chase', statusOnHit: 'burn',
    dropTable: ['wp_magma_katana', 'ar_magma_aegis'],
    lore: '溶岩エネルギーを纏って疾駆する炎獣。氷の魔法が抜群に効く。',
  },
  reactor_titan: {
    id: 'reactor_titan', name: 'マグマタイタン', area: 'magma', shape: 'square',
    color: '#ef4444', accent: '#fb923c', radius: 25,
    hp: 380, atk: 54, def: 20, spd: 86, exp: 205, gold: 195,
    weakness: 'ice', ai: 'bomber', statusOnHit: 'burn',
    dropTable: ['ar_magma_aegis', 'wp_magma_katana', 'wp_seraph_staff'],
    lore: 'リアクター炉心の熱で稼働する巨神機。火炎放射弾に注意。',
  },
  ember_wraith: {
    id: 'ember_wraith', name: 'インフェルノレイス', area: 'magma', shape: 'diamond',
    color: '#f97316', accent: '#fff7ed', radius: 18,
    hp: 245, atk: 50, def: 12, spd: 118, exp: 168, gold: 162,
    weakness: 'ice', ai: 'shooter', statusOnHit: 'burn',
    dropTable: ['wp_phantom_fangs', 'ar_prism_mantle'],
    lore: '炉心から溢れ出た炎の亡霊。高火力だが氷結で一気に砕ける。',
  },

  // Area 5: Astral Citadel
  astral_knight: {
    id: 'astral_knight', name: 'アストラル・ヴァルキリー', area: 'citadel', shape: 'diamond',
    color: '#f472b6', accent: '#38f8d4', radius: 21,
    hp: 420, atk: 62, def: 22, spd: 148, exp: 265, gold: 250,
    weakness: 'holy', ai: 'charger', statusOnHit: 'paralyze',
    dropTable: ['wp_omega_caliber', 'ar_celestial_aegis', 'wp_phantom_fangs'],
    lore: '天空城を護る魔王直属の親衛機。聖光属性やリミット技で押し切れ。',
  },
  void_seraph: {
    id: 'void_seraph', name: 'ネオ・セラフ機兵', area: 'citadel', shape: 'hex',
    color: '#c084fc', accent: '#fbbf24', radius: 22,
    hp: 390, atk: 66, def: 20, spd: 115, exp: 280, gold: 265,
    weakness: 'lightning', ai: 'bomber', statusOnHit: 'poison',
    dropTable: ['wp_seraph_staff', 'ar_prism_mantle', 'ar_celestial_aegis'],
    lore: '星結晶を逆流させて空間弾を撃つ翼機兵。',
  },
  omega_sentinel: {
    id: 'omega_sentinel', name: 'オメガ・イージス', area: 'citadel', shape: 'square',
    color: '#fb7185', accent: '#38f8d4', radius: 25,
    hp: 540, atk: 70, def: 28, spd: 96, exp: 330, gold: 310,
    weakness: 'fire', ai: 'shooter', statusOnHit: 'burn',
    dropTable: ['wp_omega_caliber', 'ar_celestial_aegis'],
    lore: '天空城最強の重装機兵。高い報酬とレジェンダリー装備のドロップを狙える。',
  },
};

export const BOSSES = {
  boss_sylvarion: {
    id: 'boss_sylvarion',
    name: '森の守護機獣・シルヴァリオン',
    title: 'FOREST GUARDIAN MECH',
    area: 'forest',
    color: '#34d399',
    accent: '#fef08a',
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
    lore: 'かつて樹海の星結晶を護っていた獣型ガーディアン。魔王の侵食で暴走している。',
    introDialogue: [
      '【シルヴァリオン】グルルル……星樹の領域に踏み入る者ヨ……！',
      '【シルヴァリオン】守護クリスタルが輝く限り、我が装甲は砕けぬ！',
    ],
    phase2Line: '【シルヴァリオン】覚醒プロトコル起動！翠光の嵐に呑まれよ！！',
    defeatLine: '【シルヴァリオン】……光が、戻った……。次の洞窟への道を開こう……！',
  },
  boss_crystalion: {
    id: 'boss_crystalion',
    name: '晶核の幽竜・クリスタリオン',
    title: 'PHANTOM CRYSTAL WYRM',
    area: 'cave',
    color: '#38bdf8',
    accent: '#c084fc',
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
    lore: '洞窟最奥に棲む氷晶の機械竜。闇を切り裂くレーザーと凍結リングを放つ。',
    introDialogue: [
      '【クリスタリオン】暗闇の深淵へようこそ、小さな光よ……。',
      '【クリスタリオン】永遠の氷晶に閉じ込めてやろう！',
    ],
    phase2Line: '【クリスタリオン】見事だ……だが我が晶核は極低温オーバーロードへ突入する！',
    defeatLine: '【クリスタリオン】眩き光よ……古代機工遺跡の封印は今、解かれた……。',
  },
  boss_chronos: {
    id: 'boss_chronos',
    name: '時空番人・クロノセンチネル',
    title: 'CHRONO OVERSEER UNIT',
    area: 'ruins',
    color: '#22d3ee',
    accent: '#fbbf24',
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
    lore: '古代サイバー文明が遺した時間観測機。精密なレーザー照射と爆撃陣を操る。',
    introDialogue: [
      '【クロノセンチネル】侵入者確認。確率演算：キミの生存率は0.04%ダ。',
      '【クロノセンチネル】時空防衛システム、全砲門展開！',
    ],
    phase2Line: '【クロノセンチネル】計算外ノ戦闘力……クロック周波数200%解放！！',
    defeatLine: '【クロノセンチネル】未来ノ確率ガ書キ換ワッタ……灼熱ノ炉心ヘ進メ……。',
  },
  boss_ignis: {
    id: 'boss_ignis',
    name: '熔核の覇龍・イグニスレックス',
    title: 'MAGMA CORE EMPEROR',
    area: 'magma',
    color: '#fb923c',
    accent: '#ef4444',
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
    lore: 'マグマリアクターの絶対支配者。凄まじい熱線レーザーとメテオ爆撃を連発する。',
    introDialogue: [
      '【イグニスレックス】グオオオッ！よくぞこの灼熱地獄まで辿り着いたな！',
      '【イグニスレックス】天空城へ行く資格があるか、我が業火で試してやる！',
    ],
    phase2Line: '【イグニスレックス】燃え滾るぞ！！炉心臨界・スーパーノヴァ形態！！',
    defeatLine: '【イグニスレックス】見事な力だ……機械魔王オメガノヴァを討つのはお前たちだ！',
  },
  boss_omega: {
    id: 'boss_omega',
    name: '機械魔王・オメガノヴァ',
    title: 'FINAL SOVEREIGN OF THE DIORAMA',
    area: 'citadel',
    color: '#f472b6',
    accent: '#38f8d4',
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
    lore: '箱庭世界の星結晶を奪い、すべてを機械化しようと目論む天空城の魔王。',
    introDialogue: [
      '【機械魔王オメガノヴァ】フハハハハ！我が天空城へ辿り着くとは褒めてやろう。',
      '【機械魔王オメガノヴァ】星結晶の力は既に我が手の中。この箱庭世界は完全なる機械帝国となるのだ！',
      '【機械魔王オメガノヴァ】さあ、絶望のシンフォニーを始めようぞ！！',
    ],
    phase2Line: '【機械魔王オメガノヴァ】バカな！？ならば星核エネルギーを全開放する！真・オメガ覚醒！！',
    defeatLine: '【機械魔王オメガノヴァ】ぐあああっ……！人の絆と光の意志が、我が演算を超えたというのか……！',
  },
  boss_astral_zero: {
    id: 'boss_astral_zero',
    name: '星穹の虚神・アストラルゼロ',
    title: 'SECRET SUPERBOSS — THE SINGULARITY',
    area: 'secret',
    color: '#fbbf24',
    accent: '#38f8d4',
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
    lore: '箱庭世界を創造した星核の記憶が生み出した究極の試練。最強の冒険者だけが挑める裏ボス。',
    introDialogue: [
      '【アストラルゼロ】……次元ノ狭間ニ至リシ光ノ旅人ヨ。',
      '【アストラルゼロ】我ハ星核ノ記憶ニシテ究極ノ試練。ソノ刃、星ヲ超エテミセヨ！',
    ],
    phase2Line: '【アストラルゼロ】星々ヨ、収束セヨ！！虚空特異点・フルバースト！！',
    defeatLine: '【アストラルゼロ】実ニ見事ナリ……キミコソ「ルミナ・ジオラマ」真ノ覇者ナリ！',
  },
};

export const NPCS = {
  town_guide: {
    id: 'town_guide', name: '星導師リア', role: 'guide', icon: '🌟', color: '#38f8d4',
    lines: [
      'ようこそ『拠点ネオンタウン』へ！私は星導師リアよ。',
      '機械魔王オメガノヴァに奪われた5つの星結晶を取り戻すため、まずは東のゲートから【1. 翠光のジオラマ樹海】へ向かって！',
      'ダンジョンの壁に【光るヒビ】があったら攻撃で壊せるわ。レア宝箱が隠されているから探してみてね！',
      '強敵に挑むときは、右上の「🌐 協力」から合言葉ルームを作って最大4人で無双するのも最高よ！',
    ],
  },
  town_gear: {
    id: 'town_gear', name: '武装商人ゼクス', role: 'shop_gear', icon: '🛡️', color: '#38bdf8',
    lines: ['いらっしゃい！最強のネオン武装を取り揃えてるぜ！'],
  },
  town_magic: {
    id: 'town_magic', name: '魔導研究員ルナ', role: 'shop_magic', icon: '🔮', color: '#e879f9',
    lines: ['属性魔法の習得とレベルアップなら任せて！弱点を突くとダメージが大跳ね上がりするよ！'],
  },
  town_forge: {
    id: 'town_forge', name: '鍛冶師バルカン', role: 'blacksmith', icon: '⚒️', color: '#fb923c',
    lines: ['おう！鉱石とゴールドがあれば装備を +10 まで叩き上げてやる！強化するほど武器のオーラがド派手になるぜ！'],
  },
  town_inn: {
    id: 'town_inn', name: '宿屋オーナー・ミア', role: 'inn', icon: '🌙', color: '#fde047',
    lines: ['お疲れさま！ここで休めばHPもMPも全回復＆自動セーブされるわよ♪'],
  },
  town_drone: {
    id: 'town_drone', name: 'ドローン技師チップ', role: 'drone', icon: '🤖', color: '#34d399',
    lines: ['キミの後ろを飛んでる相棒ドローンを強化できるよ！レーザー連射やアイテム自動吸引をパワーアップしよう！'],
  },
  town_warp: {
    id: 'town_warp', name: '次元ワープ端末', role: 'warp', icon: '🌀', color: '#22d3ee',
    lines: ['到達済みのエリアへ瞬時にファストトラベルできます。'],
  },

  // Field NPCs with tips & lore!
  forest_scout: {
    id: 'forest_scout', name: '偵察員カイト', role: 'talk', icon: '🌿', color: '#6ee7b7',
    lines: [
      'やあ冒険者！この先のボス【シルヴァリオン】は【炎属性】が弱点だぞ！',
      'それと重要情報！ボスが【守護クリスタル】を出している間はバリアでダメージが通らない。まず周囲のクリスタルを全部壊すんだ！',
      'あ、北側の壁にヒビ割れた隠し部屋があるって噂も聞いたぜ。攻撃して確かめてみな！',
    ],
  },
  cave_miner: {
    id: 'cave_miner', name: '鉱夫ドイル', role: 'talk', icon: '⛏️', color: '#7dd3fc',
    lines: [
      'うわっ、暗い洞窟だな！プレイヤーや光るクリスタルの周りしか見えないぜ。',
      '奥の【クリスタリオン】は【炎属性】に弱い。床に赤い警告サークルやレーザー線が出たら、すぐ回避ダッシュで避けるんだ！',
      '青い床スイッチを踏むと閉ざされたエネルギーゲートが開く仕組みだぞ。',
    ],
  },
  ruins_scholar: {
    id: 'ruins_scholar', name: '遺跡博士エリス', role: 'talk', icon: '📡', color: '#fbbf24',
    lines: [
      '素晴らしい古代サイバー遺跡ね！動くプラズマ回転刃には気をつけて。',
      'この遺跡の番人【クロノセンチネル】は機械系だから【雷属性（サンダーチェイン）】が超有効よ！',
      'そうそう、どこかに【虚空の星核神殿（裏ボス部屋）】へ繋がる伝説の隠しワープもあるって文献に書いてあったわ……！',
    ],
  },
  magma_engineer: {
    id: 'magma_engineer', name: '炉心技師ゴウ', role: 'talk', icon: '🔥', color: '#fb923c',
    lines: [
      'アチチッ！光る溶岩パネルは踏むと延焼ダメージを受けるからダッシュで駆け抜けろ！',
      '最奥の覇龍【イグニスレックス】は【氷属性（アイシクルノヴァ）】が弱点だ。鍛冶屋で武器を+4以上に強化しておくと楽勝だぜ！',
    ],
  },
  citadel_knight: {
    id: 'citadel_knight', name: '反乱騎士アレン', role: 'talk', icon: '⚔️', color: '#f472b6',
    lines: [
      'ついにここまで来たか……この先が【機械魔王オメガノヴァ】の玉座だ。',
      '魔王はHPが半分を切ると第2形態に覚醒し、弾幕とレーザーが激化する。リミット必殺技と【聖光武器】【オーバークロック】を駆使して決着をつけてくれ！',
      '……頼んだぞ、星結晶の英雄よ！',
    ],
  },
};

export const ACHIEVEMENTS = [
  { id: 'first_blood', icon: '⚔️', title: '初陣の閃光', desc: 'モンスターを初めて撃破した' },
  { id: 'combo_30', icon: '🔥', title: 'ネオンコンボマスター', desc: '30ヒット以上のコンボを達成した' },
  { id: 'combo_80', icon: '⚡', title: '無双の舞踏', desc: '80ヒット以上のコンボを達成した' },
  { id: 'secret_wall', icon: '💎', title: '隠し部屋の発見者', desc: 'ヒビ割れた隠し壁を破壊して秘密の部屋を発見した' },
  { id: 'shrine_visit', icon: '⛩️', title: '神秘の導き', desc: '神秘の祭壇を起動した' },
  { id: 'forge_3', icon: '⚒️', title: '熟練の鍛冶魂', desc: '装備を +3 以上に強化した' },
  { id: 'forge_7', icon: '🌟', title: '伝説の星結晶鍛冶', desc: '装備を +7 以上に強化した' },
  { id: 'drone_max', icon: '🤖', title: '最強の相棒ドローン', desc: 'サポートドローンをLv.5（MAX）に強化した' },
  { id: 'boss_forest', icon: '🌿', title: '樹海の解放者', desc: 'シルヴァリオンを撃破した' },
  { id: 'boss_cave', icon: '❄️', title: '暗闇の晶竜殺し', desc: 'クリスタリオンを撃破した' },
  { id: 'boss_ruins', icon: '⏱️', title: '時空の超越者', desc: 'クロノセンチネルを撃破した' },
  { id: 'boss_magma', icon: '🌋', title: '灼熱炉心の覇者', desc: 'イグニスレックスを撃破した' },
  { id: 'game_clear', icon: '👑', title: '星結晶の英雄', desc: '機械魔王オメガノヴァを撃破し世界を救った' },
  { id: 'secret_boss', icon: '🌌', title: '虚空を超える者', desc: '裏ボス「星穹の虚神アストラルゼロ」を撃破した' },
  { id: 'tower_5', icon: '🗼', title: '試練の塔の挑戦者', desc: 'エンドレス試練の塔で5階層を突破した' },
  { id: 'coop_hero', icon: '🤝', title: '絆のレスキュー', desc: 'オンライン協力プレイまたは味方の蘇生を達成した' },
];

export const QUICK_STAMPS = [
  { id: 'hello', text: 'よろしく！', icon: '✨' },
  { id: 'nice', text: 'ナイス！', icon: '🔥' },
  { id: 'heal', text: '回復たすかる！', icon: '💚' },
  { id: 'secret', text: '隠し部屋あった！', icon: '💎' },
  { id: 'boss', text: 'ボス行くぞ！', icon: '⚔️' },
  { id: 'thanks', text: 'ありがとう！', icon: '🌟' },
  { id: 'help', text: '助けて！', icon: '🆘' },
  { id: 'musou', text: '最強無双！', icon: '⚡' },
];

export const INTRO_STORY = [
  'はるか宇宙の片隅に浮かぶ、光り輝く立体ジオラマの世界——『ルミナ・ジオラマ』。',
  '緑の樹海、神秘のクリスタル洞窟、古代サイバー遺跡、灼熱の炉心……5つの箱庭は中央の「星結晶」によって調和を保っていた。',
  'しかしある日、天空城に降臨した【機械魔王・オメガノヴァ】が星結晶を奪い去り、箱庭の守護機獣たちを暴走させてしまう！',
  '残された最後の光『拠点ネオンタウン』から、相棒ドローンと共に今、君の冒険が始まる——！',
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
