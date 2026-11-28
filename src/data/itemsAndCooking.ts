import type {
  ChemistryElement,
  CookedMeal,
  FuelTier,
  MaterialDef,
  WeaponDef,
} from '../types/botw';

/**
 * Authentic Master Sword base vs. awakened (near Malice / Guardians / Trial of the Sword) parameters.
 */
export const MASTER_SWORD_STATS = {
  baseAttack: 30,
  awakenedAttack: 60,
  baseDurability: 40,
  awakenedDurability: 188,
} as const;

/**
 * Shield IDs that automatically reflect Guardian laser beams while blocking without manual parry timing.
 */
export const AUTO_PARRY_LASER_SHIELD_IDS = new Set<string>(['ancient_shield']);

// ===========================================================================
// WEAPONS (Melee: Swords, Claymores, Spears)
// ===========================================================================
export const WEAPONS: WeaponDef[] = [
  {
    id: 'tree_branch',
    nameJa: '木の枝',
    nameEn: 'Tree Branch',
    category: 'sword',
    attack: 2,
    durability: 4,
    material: 'Wood',
    color: '#7a5838',
    accentColor: '#5c4228',
  },
  {
    id: 'torch',
    nameJa: 'たいまつ',
    nameEn: 'Torch',
    category: 'sword',
    attack: 2,
    durability: 40,
    material: 'Wood',
    element: 'Fire',
    color: '#7c502c',
    accentColor: '#ff8a24',
  },
  {
    id: 'travelers_sword',
    nameJa: '旅人の剣',
    nameEn: "Traveler's Sword",
    category: 'sword',
    attack: 5,
    durability: 20,
    material: 'Metal',
    color: '#9ba2aa',
    accentColor: '#6d4c32',
  },
  {
    id: 'soldiers_broadsword',
    nameJa: '兵士の剣',
    nameEn: "Soldier's Broadsword",
    category: 'sword',
    attack: 14,
    durability: 23,
    material: 'Metal',
    color: '#a4abb4',
    accentColor: '#3a5d8a',
  },
  {
    id: 'knights_broadsword',
    nameJa: '騎士の剣',
    nameEn: "Knight's Broadsword",
    category: 'sword',
    attack: 26,
    durability: 27,
    material: 'Metal',
    color: '#bcc4ce',
    accentColor: '#2e5292',
  },
  {
    id: 'royal_broadsword',
    nameJa: '王家の剣',
    nameEn: 'Royal Broadsword',
    category: 'sword',
    attack: 36,
    durability: 36,
    material: 'Metal',
    color: '#d8b44c',
    accentColor: '#6d3c8a',
  },
  {
    id: 'royal_guard_sword',
    nameJa: '近衛の剣',
    nameEn: "Royal Guard's Sword",
    category: 'sword',
    attack: 48,
    durability: 14,
    material: 'Metal',
    color: '#343642',
    accentColor: '#c8a64c',
  },
  {
    id: 'master_sword',
    nameJa: 'マスターソード',
    nameEn: 'Master Sword',
    category: 'sword',
    attack: MASTER_SWORD_STATS.baseAttack,
    durability: MASTER_SWORD_STATS.baseDurability,
    material: 'Stone',
    isMasterSword: true,
    color: '#d6e4f2',
    accentColor: '#3d4ea8',
  },
  {
    id: 'one_hit_obliterator',
    nameJa: '一撃の剣',
    nameEn: 'One-Hit Obliterator',
    category: 'sword',
    attack: 9999,
    durability: 2,
    material: 'Stone',
    isAncient: true,
    isOneHitObliterator: true,
    color: '#3c3834',
    accentColor: '#36d6f5',
  },
  {
    id: 'guardian_sword_pp',
    nameJa: 'ガーディアンナイフ++',
    nameEn: 'Guardian Sword++',
    category: 'sword',
    attack: 40,
    durability: 32,
    material: 'Stone',
    isAncient: true,
    color: '#36c9f5',
    accentColor: '#5c524a',
  },
  {
    id: 'ancient_bladesaw',
    nameJa: '古代兵装・大剣',
    nameEn: 'Ancient Bladesaw',
    category: 'claymore',
    attack: 55,
    durability: 50,
    material: 'Stone',
    isAncient: true,
    color: '#4c443e',
    accentColor: '#36d2ff',
  },
  {
    id: 'dragonbone_moblin_club',
    nameJa: '竜骨モリブリンバット',
    nameEn: 'Dragonbone Moblin Club',
    category: 'claymore',
    attack: 45,
    durability: 24,
    material: 'Organic',
    isBone: true,
    color: '#dcd2be',
    accentColor: '#8d7c64',
  },
  {
    id: 'flameblade',
    nameJa: '火炎の剣',
    nameEn: 'Flameblade',
    category: 'sword',
    attack: 24,
    durability: 36,
    material: 'Metal',
    element: 'Fire',
    color: '#e65824',
    accentColor: '#f5b836',
  },
  {
    id: 'frostblade',
    nameJa: '氷雪の剣',
    nameEn: 'Frostblade',
    category: 'sword',
    attack: 20,
    durability: 30,
    material: 'Metal',
    element: 'Ice',
    color: '#64d2f5',
    accentColor: '#d8f6ff',
  },
  {
    id: 'thunderblade',
    nameJa: '雷電の剣',
    nameEn: 'Thunderblade',
    category: 'sword',
    attack: 22,
    durability: 36,
    material: 'Metal',
    element: 'Electricity',
    color: '#e8c42c',
    accentColor: '#fff08c',
  },
  {
    id: 'vicious_sickle',
    nameJa: '首刈り刀',
    nameEn: 'Vicious Sickle',
    category: 'sword',
    attack: 16,
    durability: 14,
    material: 'Metal',
    color: '#5c565e',
    accentColor: '#c42e34',
  },
  {
    id: 'demon_carver',
    nameJa: '鬼円刃',
    nameEn: 'Demon Carver',
    category: 'sword',
    attack: 40,
    durability: 25,
    material: 'Metal',
    color: '#4e4852',
    accentColor: '#d92c34',
  },
  {
    id: 'savage_lynel_crusher',
    nameJa: '獣神の大剣',
    nameEn: 'Savage Lynel Crusher',
    category: 'claymore',
    attack: 78,
    durability: 35,
    material: 'Metal',
    color: '#3e3a3c',
    accentColor: '#d6a43e',
  },
  {
    id: 'royal_claymore',
    nameJa: '王家の両手剣',
    nameEn: 'Royal Claymore',
    category: 'claymore',
    attack: 52,
    durability: 40,
    material: 'Metal',
    color: '#d9b84e',
    accentColor: '#663c8a',
  },
  {
    id: 'travelers_spear',
    nameJa: '旅人の槍',
    nameEn: "Traveler's Spear",
    category: 'spear',
    attack: 3,
    durability: 30,
    material: 'Wood',
    color: '#8c6a46',
    accentColor: '#a2aab2',
  },
  {
    id: 'lightscale_trident',
    nameJa: '光鱗の槍',
    nameEn: 'Lightscale Trident',
    category: 'spear',
    attack: 22,
    durability: 70,
    material: 'Metal',
    color: '#48a4d6',
    accentColor: '#e2c872',
  },
  {
    id: 'guardian_spear_pp',
    nameJa: 'ガーディアンランス++',
    nameEn: 'Guardian Spear++',
    category: 'spear',
    attack: 20,
    durability: 35,
    material: 'Stone',
    isAncient: true,
    color: '#36c9f5',
    accentColor: '#564e46',
  },
  {
    id: 'korok_leaf',
    nameJa: 'コログのうちわ',
    nameEn: 'Korok Leaf',
    category: 'claymore',
    attack: 1,
    durability: 25,
    material: 'Wood',
    element: 'Wind',
    color: '#4c9e44',
    accentColor: '#7ec858',
  },
  {
    id: 'woodcutters_axe',
    nameJa: '木こりのオノ',
    nameEn: "Woodcutter's Axe",
    category: 'claymore',
    attack: 3,
    durability: 42,
    material: 'Metal',
    color: '#8f9aa8',
    accentColor: '#6d4827',
  },
];

// ===========================================================================
// BOWS
// ===========================================================================
export const BOWS: WeaponDef[] = [
  {
    id: 'travelers_bow',
    nameJa: '旅人の弓',
    nameEn: "Traveler's Bow",
    category: 'bow',
    attack: 5,
    durability: 22,
    material: 'Wood',
    color: '#8c6442',
    accentColor: '#d4c4a2',
  },
  {
    id: 'soldiers_bow',
    nameJa: '兵士の弓',
    nameEn: "Soldier's Bow",
    category: 'bow',
    attack: 14,
    durability: 36,
    material: 'Wood',
    color: '#7a5638',
    accentColor: '#9aa4b0',
  },
  {
    id: 'royal_bow',
    nameJa: '王家の弓',
    nameEn: 'Royal Bow',
    category: 'bow',
    attack: 38,
    durability: 60,
    material: 'Metal',
    color: '#d8b64c',
    accentColor: '#663c8a',
  },
  {
    id: 'ancient_bow',
    nameJa: '古代兵装・弓',
    nameEn: 'Ancient Bow',
    category: 'bow',
    attack: 44,
    durability: 120,
    material: 'Stone',
    isAncient: true,
    color: '#4c443e',
    accentColor: '#36d2ff',
  },
  {
    id: 'great_eagle_bow',
    nameJa: 'オオワシの弓',
    nameEn: 'Great Eagle Bow',
    category: 'bow',
    attack: 28,
    durability: 60,
    material: 'Wood',
    color: '#5a4434',
    accentColor: '#3698d6',
  },
  {
    id: 'savage_lynel_bow',
    nameJa: '獣神の弓',
    nameEn: 'Savage Lynel Bow',
    category: 'bow',
    attack: 32,
    durability: 45,
    material: 'Metal',
    color: '#3c383a',
    accentColor: '#d8a642',
  },
  {
    id: 'twilight_bow',
    nameJa: '黄昏の光弓',
    nameEn: 'Twilight Bow',
    category: 'bow',
    attack: 30,
    durability: 100,
    material: 'Stone',
    color: '#c8a64e',
    accentColor: '#fff2a6',
  },
];

// ===========================================================================
// SHIELDS
// ===========================================================================
export const SHIELDS: WeaponDef[] = [
  {
    id: 'pot_lid',
    nameJa: 'ナベのフタ',
    nameEn: 'Pot Lid',
    category: 'shield',
    attack: 1,
    durability: 10,
    material: 'Wood',
    color: '#9c7852',
    accentColor: '#6a4e32',
  },
  {
    id: 'wooden_shield',
    nameJa: '木の盾',
    nameEn: 'Wooden Shield',
    category: 'shield',
    attack: 2,
    durability: 12,
    material: 'Wood',
    color: '#88603c',
    accentColor: '#5c422a',
  },
  {
    id: 'travelers_shield',
    nameJa: '旅人の盾',
    nameEn: "Traveler's Shield",
    category: 'shield',
    attack: 4,
    durability: 12,
    material: 'Wood',
    color: '#926c46',
    accentColor: '#8d96a0',
  },
  {
    id: 'royal_shield',
    nameJa: '王家の盾',
    nameEn: 'Royal Shield',
    category: 'shield',
    attack: 55,
    durability: 29,
    material: 'Metal',
    color: '#d8b64c',
    accentColor: '#6c3e8e',
  },
  {
    id: 'hylian_shield',
    nameJa: 'ハイリアの盾',
    nameEn: 'Hylian Shield',
    category: 'shield',
    attack: 90,
    durability: 800,
    material: 'Metal',
    color: '#2e589c',
    accentColor: '#d8bc5c',
  },
  {
    id: 'ancient_shield',
    nameJa: '古代兵装・盾',
    nameEn: 'Ancient Shield',
    category: 'shield',
    attack: 70,
    durability: 32,
    material: 'Stone',
    isAncient: true,
    color: '#36c9f5',
    accentColor: '#4c443e',
  },
  {
    id: 'daybreaker',
    nameJa: '七宝の盾',
    nameEn: 'Daybreaker',
    category: 'shield',
    attack: 48,
    durability: 60,
    material: 'Metal',
    color: '#d8b448',
    accentColor: '#3aa4c8',
  },
  {
    id: 'radiant_shield',
    nameJa: '太陽の盾',
    nameEn: 'Radiant Shield',
    category: 'shield',
    attack: 35,
    durability: 26,
    material: 'Metal',
    color: '#d4a63c',
    accentColor: '#c43e36',
  },
];

export const WEAPON_MAP: Record<string, WeaponDef> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w]),
);
export const BOW_MAP: Record<string, WeaponDef> = Object.fromEntries(
  BOWS.map((b) => [b.id, b]),
);
export const SHIELD_MAP: Record<string, WeaponDef> = Object.fromEntries(
  SHIELDS.map((s) => [s.id, s]),
);
export const ALL_EQUIPMENT_MAP: Record<string, WeaponDef> = {
  ...WEAPON_MAP,
  ...BOW_MAP,
  ...SHIELD_MAP,
};

// ===========================================================================
// MATERIALS (Across ALL 5 Master Cycle Zero Fuel Tiers)
// ===========================================================================
export const MATERIALS: MaterialDef[] = [
  // ----- Tier 5 (baseFuel = 100) -----
  {
    id: 'apple',
    nameJa: 'リンゴ',
    nameEn: 'Apple',
    category: 'fruit',
    hearts: 0.5,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 30,
    fuelTier: 5,
    price: 3,
    color: '#d83834',
  },
  {
    id: 'baked_apple',
    nameJa: '焼きリンゴ',
    nameEn: 'Baked Apple',
    category: 'fruit',
    hearts: 0.75,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 0,
    fuelTier: 5,
    price: 5,
    color: '#b84f22',
  },
  {
    id: 'wood',
    nameJa: '薪の束',
    nameEn: 'Wood',
    category: 'special',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 0,
    fuelTier: 5,
    price: 2,
    color: '#7a5232',
  },
  {
    id: 'flint',
    nameJa: '火打石',
    nameEn: 'Flint',
    category: 'mineral',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 0,
    fuelTier: 5,
    price: 5,
    color: '#464a50',
  },
  {
    id: 'rock_salt',
    nameJa: '岩塩',
    nameEn: 'Rock Salt',
    category: 'mineral',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 60,
    fuelTier: 5,
    price: 2,
    color: '#e8d8d0',
  },
  {
    id: 'amber',
    nameJa: 'コハク',
    nameEn: 'Amber',
    category: 'mineral',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 0,
    fuelTier: 5,
    price: 30,
    color: '#d68224',
  },
  {
    id: 'bokoblin_horn',
    nameJa: 'ボコブリンの角',
    nameEn: 'Bokoblin Horn',
    category: 'monster',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 70,
    fuelTier: 5,
    price: 3,
    color: '#c8b48e',
  },
  {
    id: 'bokoblin_fang',
    nameJa: 'ボコブリンの牙',
    nameEn: 'Bokoblin Fang',
    category: 'monster',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 110,
    fuelTier: 5,
    price: 8,
    color: '#dfd4ba',
  },
  {
    id: 'ancient_screw',
    nameJa: '古代のネジ',
    nameEn: 'Ancient Screw',
    category: 'ancient',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 70,
    fuelTier: 5,
    price: 12,
    color: '#7a7268',
  },
  {
    id: 'ancient_spring',
    nameJa: '古代のバネ',
    nameEn: 'Ancient Spring',
    category: 'ancient',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 70,
    fuelTier: 5,
    price: 15,
    color: '#6e7278',
  },
  {
    id: 'ancient_gear',
    nameJa: '古代の歯車',
    nameEn: 'Ancient Gear',
    category: 'ancient',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 110,
    fuelTier: 5,
    price: 30,
    color: '#686058',
  },
  {
    id: 'ancient_shaft',
    nameJa: '古代のシャフト',
    nameEn: 'Ancient Shaft',
    category: 'ancient',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 110,
    fuelTier: 5,
    price: 40,
    color: '#5a6068',
  },

  // ----- Tier 4 (baseFuel = 75) -----
  {
    id: 'hyrule_herb',
    nameJa: 'ハイラル草',
    nameEn: 'Hyrule Herb',
    category: 'herb',
    hearts: 1,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 30,
    fuelTier: 4,
    price: 3,
    color: '#5ca446',
  },
  {
    id: 'hylian_shroom',
    nameJa: 'ハイラルダケ',
    nameEn: 'Hylian Shroom',
    category: 'mushroom',
    hearts: 0.5,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 30,
    fuelTier: 4,
    price: 3,
    color: '#b48a5c',
  },
  {
    id: 'spicy_pepper',
    nameJa: 'ポカポカ草の実',
    nameEn: 'Spicy Pepper',
    category: 'fruit',
    hearts: 0.5,
    effectType: 'spicy',
    potency: 15,
    durationBonusSec: 150,
    fuelTier: 4,
    price: 3,
    color: '#e23a28',
  },
  {
    id: 'hydromelon',
    nameJa: 'ヒンヤリメロン',
    nameEn: 'Hydromelon',
    category: 'fruit',
    hearts: 0.5,
    effectType: 'chilly',
    potency: 15,
    durationBonusSec: 150,
    fuelTier: 4,
    price: 4,
    color: '#58b4e2',
  },
  {
    id: 'raw_meat',
    nameJa: 'ケモノ肉',
    nameEn: 'Raw Meat',
    category: 'meat',
    hearts: 1,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 30,
    fuelTier: 4,
    price: 8,
    color: '#c84c4c',
  },
  {
    id: 'prime_meat',
    nameJa: '上ケモノ肉',
    nameEn: 'Raw Prime Meat',
    category: 'meat',
    hearts: 1.5,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 30,
    fuelTier: 4,
    price: 15,
    color: '#b83c42',
  },
  {
    id: 'hyrule_bass',
    nameJa: 'ハイラルバス',
    nameEn: 'Hyrule Bass',
    category: 'fish',
    hearts: 1,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 30,
    fuelTier: 4,
    price: 6,
    color: '#628ea6',
  },
  {
    id: 'opal',
    nameJa: 'オパール',
    nameEn: 'Opal',
    category: 'mineral',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 0,
    fuelTier: 4,
    price: 60,
    color: '#6cd8c8',
  },
  {
    id: 'ruby',
    nameJa: 'ルビー',
    nameEn: 'Ruby',
    category: 'mineral',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 0,
    fuelTier: 4,
    price: 210,
    color: '#e2323e',
  },
  {
    id: 'sapphire',
    nameJa: 'サファイア',
    nameEn: 'Sapphire',
    category: 'mineral',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 0,
    fuelTier: 4,
    price: 260,
    color: '#2c7ee6',
  },
  {
    id: 'silent_princess',
    nameJa: '姫しずか',
    nameEn: 'Silent Princess',
    category: 'herb',
    hearts: 1,
    effectType: 'sneaky',
    potency: 20,
    durationBonusSec: 120,
    fuelTier: 4,
    price: 10,
    color: '#7cd8f5',
  },
  {
    id: 'ironshroom',
    nameJa: 'ヨロイダケ',
    nameEn: 'Ironshroom',
    category: 'mushroom',
    hearts: 0.5,
    effectType: 'tough',
    potency: 15,
    durationBonusSec: 50,
    fuelTier: 4,
    price: 5,
    color: '#b89452',
  },
  {
    id: 'zapshroom',
    nameJa: 'ビリビリダケ',
    nameEn: 'Zapshroom',
    category: 'mushroom',
    hearts: 0.5,
    effectType: 'electro',
    potency: 15,
    durationBonusSec: 150,
    fuelTier: 4,
    price: 4,
    color: '#e8d03c',
  },
  {
    id: 'stamella_shroom',
    nameJa: 'ガンバリダケ',
    nameEn: 'Stamella Shroom',
    category: 'mushroom',
    hearts: 0.5,
    effectType: 'energizing',
    potency: 15,
    durationBonusSec: 0,
    fuelTier: 4,
    price: 5,
    color: '#46c468',
  },
  {
    id: 'fireproof_lizard',
    nameJa: 'ヒケシトカゲ',
    nameEn: 'Fireproof Lizard',
    category: 'bug',
    hearts: 0,
    effectType: 'fireproof',
    potency: 15,
    durationBonusSec: 150,
    fuelTier: 4,
    price: 5,
    color: '#6e5c52',
  },

  // ----- Tier 3 (baseFuel = 50) -----
  {
    id: 'hearty_durian',
    nameJa: 'マックスドリアン',
    nameEn: 'Hearty Durian',
    category: 'fruit',
    hearts: 3,
    effectType: 'hearty',
    potency: 16,
    durationBonusSec: 0,
    fuelTier: 3,
    price: 15,
    color: '#98a63c',
  },
  {
    id: 'hearty_radish',
    nameJa: 'マックスラディッシュ',
    nameEn: 'Hearty Radish',
    category: 'herb',
    hearts: 2.5,
    effectType: 'hearty',
    potency: 12,
    durationBonusSec: 0,
    fuelTier: 3,
    price: 8,
    color: '#e8d8c2',
  },
  {
    id: 'gourmet_meat',
    nameJa: '極上ケモノ肉',
    nameEn: 'Raw Gourmet Meat',
    category: 'meat',
    hearts: 3,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 30,
    fuelTier: 3,
    price: 35,
    color: '#a82c38',
  },
  {
    id: 'diamond',
    nameJa: 'ダイヤモンド',
    nameEn: 'Diamond',
    category: 'mineral',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 0,
    fuelTier: 3,
    price: 500,
    color: '#dcf4ff',
  },
  {
    id: 'lynel_guts',
    nameJa: 'ライネルの肝',
    nameEn: 'Lynel Guts',
    category: 'monster',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 190,
    fuelTier: 3,
    price: 200,
    color: '#6e2c3c',
  },
  {
    id: 'endura_carrot',
    nameJa: 'ガッツニンジン',
    nameEn: 'Endura Carrot',
    category: 'herb',
    hearts: 2,
    effectType: 'enduring',
    potency: 20,
    durationBonusSec: 0,
    fuelTier: 3,
    price: 30,
    color: '#e88e28',
  },
  {
    id: 'mighty_bananas',
    nameJa: 'ツルギバナナ',
    nameEn: 'Mighty Bananas',
    category: 'fruit',
    hearts: 0.5,
    effectType: 'mighty',
    potency: 15,
    durationBonusSec: 50,
    fuelTier: 3,
    price: 5,
    color: '#f0cc34',
  },
  {
    id: 'fleet_lotus_seeds',
    nameJa: 'ゴーゴーハスの実',
    nameEn: 'Fleet-Lotus Seeds',
    category: 'fruit',
    hearts: 0.5,
    effectType: 'hasty',
    potency: 15,
    durationBonusSec: 60,
    fuelTier: 3,
    price: 5,
    color: '#8868b8',
  },

  // ----- Tier 2 (baseFuel = 25) -----
  {
    id: 'dinraal_scale',
    nameJa: 'オルドラのウロコ',
    nameEn: "Dinraal's Scale",
    category: 'dragon',
    hearts: 0.5,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 90,
    fuelTier: 2,
    price: 150,
    color: '#e65c2c',
  },
  {
    id: 'naydra_scale',
    nameJa: 'ネルドラのウロコ',
    nameEn: "Naydra's Scale",
    category: 'dragon',
    hearts: 0.5,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 90,
    fuelTier: 2,
    price: 150,
    color: '#48b6e8',
  },
  {
    id: 'farosh_scale',
    nameJa: 'フロドラのウロコ',
    nameEn: "Farosh's Scale",
    category: 'dragon',
    hearts: 0.5,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 90,
    fuelTier: 2,
    price: 150,
    color: '#7cd848',
  },
  {
    id: 'farosh_horn',
    nameJa: 'フロドラの角のかけら',
    nameEn: "Shard of Farosh's Horn",
    category: 'dragon',
    hearts: 1.5,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 1800,
    fuelTier: 2,
    price: 300,
    color: '#d8e84c',
  },
  {
    id: 'energetic_rhino_beetle',
    nameJa: 'ガンバリカブト',
    nameEn: 'Energetic Rhino Beetle',
    category: 'bug',
    hearts: 0,
    effectType: 'energizing',
    potency: 30,
    durationBonusSec: 0,
    fuelTier: 2,
    price: 30,
    color: '#c8a63c',
  },

  // ----- Tier 1 (baseFuel = 10, 2x multiplier each!) -----
  {
    id: 'monster_extract',
    nameJa: 'マモノエキス',
    nameEn: 'Monster Extract',
    category: 'special',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 0,
    fuelTier: 1,
    price: 3,
    color: '#723892',
  },
  {
    id: 'star_fragment',
    nameJa: '星のかけら',
    nameEn: 'Star Fragment',
    category: 'special',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 60,
    fuelTier: 1,
    price: 300,
    color: '#fff288',
  },
  {
    id: 'fairy',
    nameJa: '妖精',
    nameEn: 'Fairy',
    category: 'special',
    hearts: 5,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 0,
    fuelTier: 1,
    price: 2,
    color: '#ff96d2',
  },
  {
    id: 'ancient_core',
    nameJa: '古代のコア',
    nameEn: 'Ancient Core',
    category: 'ancient',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 190,
    fuelTier: 1,
    price: 80,
    color: '#36c9f5',
  },
  {
    id: 'giant_ancient_core',
    nameJa: '古代の巨大なコア',
    nameEn: 'Giant Ancient Core',
    category: 'ancient',
    hearts: 0,
    effectType: 'none',
    potency: 0,
    durationBonusSec: 190,
    fuelTier: 1,
    price: 200,
    color: '#52e0ff',
  },
];

export const MATERIAL_MAP: Record<string, MaterialDef> = Object.fromEntries(
  MATERIALS.map((m) => [m.id, m]),
);

// ===========================================================================
// MASTER CYCLE ZERO FUEL ENGINE
// ===========================================================================

/**
 * Base fuel points awarded per material tier in Master Cycle Zero's energy tank (max 1000).
 * Tier 1 materials grant 10 base fuel AND double (2x) the final sum for each Tier 1 item included.
 */
export const FUEL_BASE_BY_TIER: Record<FuelTier, number> = {
  5: 100,
  4: 75,
  3: 50,
  2: 25,
  1: 10,
};

/**
 * Computes exact Master Cycle Zero fuel yield for up to 5 materials:
 *   Math.min(1000, sumBase * Math.pow(2, tier1Count))
 */
export function computeMasterCycleFuel(materialIds: string[]): number {
  const batch = materialIds.slice(0, 5);
  let sumBase = 0;
  let tier1Count = 0;

  for (const id of batch) {
    const mat = MATERIAL_MAP[id];
    if (!mat) continue;
    sumBase += FUEL_BASE_BY_TIER[mat.fuelTier];
    if (mat.fuelTier === 1) {
      tier1Count += 1;
    }
  }

  return Math.min(1000, sumBase * Math.pow(2, tier1Count));
}

// ===========================================================================
// COOKING ENGINE
// ===========================================================================

type MealEffectType = NonNullable<MaterialDef['effectType']>;

const TIMED_EFFECT_MAX_LEVEL: Partial<Record<MealEffectType, number>> = {
  mighty: 3,
  tough: 3,
  hasty: 3,
  sneaky: 3,
  electro: 3,
  spicy: 2,
  chilly: 2,
  fireproof: 2,
};

const EFFECT_PREFIX_JA: Record<MealEffectType, string> = {
  none: '',
  hearty: 'マックス',
  energizing: 'ガンバリ',
  enduring: 'ガッツ',
  mighty: 'チカラ',
  tough: 'カチコチ',
  hasty: 'ゴーゴー',
  sneaky: 'シノビ',
  chilly: 'ヒンヤリ',
  spicy: 'ピリ辛',
  electro: 'エレキ',
  fireproof: '燃えず',
};

const ROCK_HARD_IDS = new Set<string>([
  'wood',
  'flint',
  'amber',
  'opal',
  'ruby',
  'sapphire',
  'diamond',
]);

let mealSeq = 1;

/**
 * Returns true if the current in-game hour (0..24) falls within the Blood Moon
 * guaranteed critical cooking window (23:30 - 0:15).
 */
export function isInBloodMoonCookingWindow(inGameTimeHours: number): boolean {
  const normalized = ((inGameTimeHours % 24) + 24) % 24;
  return normalized >= 23.5 || normalized <= 0.25;
}

function buildMealNameJa(mats: MaterialDef[], effectType: MealEffectType): string {
  const prefix = EFFECT_PREFIX_JA[effectType];
  if (mats.every((m) => m.id === 'fairy')) {
    return '妖精の力水';
  }
  const hasBug = mats.some((m) => m.category === 'bug');
  if (hasBug) {
    return `${prefix || '不思議な'}薬`;
  }
  const hasMeat = mats.some((m) => m.category === 'meat');
  const hasFish = mats.some((m) => m.category === 'fish');
  const hasFruit = mats.some((m) => m.category === 'fruit');
  const hasMushroom = mats.some((m) => m.category === 'mushroom');
  const hasHerb = mats.some((m) => m.category === 'herb');

  let baseDish = 'ごった煮';
  if (hasMeat && hasFish) {
    baseDish = '山海焼き';
  } else if (hasMeat) {
    baseDish = mats.some((m) => m.id === 'gourmet_meat') ? '極上串焼き肉' : '串焼き肉';
  } else if (hasFish) {
    baseDish = '串焼き魚';
  } else if (hasFruit && hasMushroom) {
    baseDish = 'キノコと果実の煮込み';
  } else if (hasFruit) {
    baseDish = '煮込み果実';
  } else if (hasMushroom) {
    baseDish = '串焼きキノコ';
  } else if (hasHerb) {
    baseDish = '山菜焼き';
  }

  return `${prefix}${baseDish}`;
}

/**
 * Cooks up to 5 ingredients following Breath of the Wild cooking rules:
 * - Conflicting status effects cancel each other out to `'none'`.
 * - Duration = baseDuration + count * 30 sec (+1800 sec if any dragon horn `farosh_horn` is included).
 * - Intensity tiers: total potency < 30 -> Lv1, >= 30 -> Lv2, >= 45 -> Lv3 (clamped to effect max).
 * - 100% critical success during Blood Moon window (23:30-0:15) or with Star Fragment / Dragon Part (else 10%).
 * - Critical bonuses: +3 hearts / +5 min (300s) duration / +1 level (up to max) / +1 temp heart / +40% stamina.
 */
export function cookIngredients(
  materialIds: string[],
  opts: { isBloodMoonWindow: boolean; rng?: () => number },
): CookedMeal {
  const slicedIds = materialIds.slice(0, 5);
  const mats: MaterialDef[] = slicedIds
    .map((id) => MATERIAL_MAP[id])
    .filter((mat): mat is MaterialDef => mat !== undefined);

  const mealId = `meal_${mealSeq++}`;

  if (mats.length === 0) {
    return {
      id: mealId,
      nameJa: '微妙な料理',
      hearts: 0,
      tempHearts: 0,
      staminaRestore: 0,
      tempStamina: 0,
      effectType: 'none',
      effectLevel: 0,
      durationSec: 0,
      isCritical: false,
      ingredients: [],
    };
  }

  const usedIds = mats.map((m) => m.id);

  // Rock-Hard Food: only wood / non-salt minerals
  if (mats.every((m) => ROCK_HARD_IDS.has(m.id))) {
    return {
      id: mealId,
      nameJa: '硬すぎ料理',
      hearts: 0.25,
      tempHearts: 0,
      staminaRestore: 0,
      tempStamina: 0,
      effectType: 'none',
      effectLevel: 0,
      durationSec: 0,
      isCritical: false,
      ingredients: usedIds,
    };
  }

  // Pure Monster / Ancient Parts with no food, bug, or special healing ingredient -> Dubious Food
  if (mats.every((m) => m.category === 'monster' || m.category === 'ancient')) {
    return {
      id: mealId,
      nameJa: '微妙な料理',
      hearts: 1,
      tempHearts: 0,
      staminaRestore: 0,
      tempStamina: 0,
      effectType: 'none',
      effectLevel: 0,
      durationSec: 0,
      isCritical: false,
      ingredients: usedIds,
    };
  }

  // Effect mixing: conflicting non-'none' status effects cancel out to 'none'
  const activeEffects = new Set<MealEffectType>();
  for (const mat of mats) {
    if (mat.effectType && mat.effectType !== 'none') {
      activeEffects.add(mat.effectType);
    }
  }

  const effectType: MealEffectType =
    activeEffects.size === 1 ? Array.from(activeEffects)[0] : 'none';

  // Critical success determination (100% in Blood Moon window or with Star Fragment / Dragon Part, else 10%)
  const hasGuaranteedCrit = mats.some(
    (m) => m.id === 'star_fragment' || m.category === 'dragon',
  );
  const rng = opts.rng ?? Math.random;
  const isCritical = opts.isBloodMoonWindow || hasGuaranteedCrit || rng() < 0.1;

  // Base hearts (cooking doubles raw edible heart recovery, capped at 30)
  const rawHearts = mats.reduce((sum, m) => sum + m.hearts, 0);
  let hearts = Math.min(30, rawHearts * 2);
  let tempHearts = 0;
  let staminaRestore = 0;
  let tempStamina = 0;
  let effectLevel = 0;
  let durationSec = 0;

  const totalPotency =
    effectType === 'none'
      ? 0
      : mats.reduce(
          (sum, m) => sum + (m.effectType === effectType ? m.potency : 0),
          0,
        );

  const timedMaxLevel = TIMED_EFFECT_MAX_LEVEL[effectType];

  if (timedMaxLevel !== undefined) {
    // Intensity tier thresholds: < 30 -> Lv1, >= 30 -> Lv2, >= 45 -> Lv3 (clamped to effect max)
    const rawLevel = totalPotency >= 45 ? 3 : totalPotency >= 30 ? 2 : 1;
    effectLevel = Math.min(timedMaxLevel, rawLevel);

    // Duration = baseDuration + count * 30 (+1800 sec if any dragon horn is included)
    const hasDragonHorn = mats.some((m) => m.id === 'farosh_horn');
    const baseDuration = mats.reduce(
      (sum, m) => sum + (m.id === 'farosh_horn' ? 0 : m.durationBonusSec),
      0,
    );
    durationSec = baseDuration + mats.length * 30 + (hasDragonHorn ? 1800 : 0);
  } else if (effectType === 'hearty') {
    hearts = 30;
    tempHearts = Math.min(20, Math.max(1, Math.round(totalPotency / 4)));
    effectLevel = 1;
  } else if (effectType === 'energizing') {
    staminaRestore = Math.min(300, Math.max(20, Math.round((totalPotency / 15) * 40)));
    effectLevel = 1;
  } else if (effectType === 'enduring') {
    staminaRestore = 300;
    tempStamina = Math.min(200, Math.max(20, Math.round((totalPotency / 20) * 40)));
    effectLevel = 1;
  }

  // Apply critical bonuses: +3 hearts / +5 min duration / +1 level (up to max) / +1 temp heart / +40% stamina
  if (isCritical) {
    if (effectType === 'hearty') {
      tempHearts = Math.min(20, tempHearts + 1);
    } else if (effectType === 'energizing') {
      staminaRestore = Math.min(300, staminaRestore + 40);
      if (hearts > 0) {
        hearts = Math.min(30, hearts + 3);
      }
    } else if (effectType === 'enduring') {
      tempStamina = Math.min(200, tempStamina + 40);
      hearts = Math.min(30, hearts + 3);
    } else if (timedMaxLevel !== undefined) {
      hearts = Math.min(30, hearts + 3);
      durationSec += 300;
      effectLevel = Math.min(timedMaxLevel, effectLevel + 1);
    } else {
      hearts = Math.min(30, hearts + 3);
    }
  }

  return {
    id: mealId,
    nameJa: buildMealNameJa(mats, effectType),
    hearts,
    tempHearts,
    staminaRestore,
    tempStamina,
    effectType,
    effectLevel,
    durationSec,
    isCritical,
    ingredients: usedIds,
  };
}

// ===========================================================================
// BOTW COMBAT DAMAGE FORMULA
// ===========================================================================

export interface BotWDamageParams {
  baseAttack: number;
  isSneakstrike?: boolean;
  isHeadshotOrCrit?: boolean;
  isWeaponBreak?: boolean;
  isThrow?: boolean;
  isMountedMelee?: boolean;
  isTargetFrozen?: boolean;
  attackUpLevel?: 0 | 1 | 2 | 3;
  ancientProficiency?: boolean;
  boneProficiency?: boolean;
  weaponIsAncient?: boolean;
  weaponIsBone?: boolean;
  element?: ChemistryElement;
  targetElementalWeakness?: boolean;
  targetShockImmune?: boolean;
}

const ATTACK_UP_MULT: Record<0 | 1 | 2 | 3, number> = {
  0: 1.0,
  1: 1.2,
  2: 1.3,
  3: 1.5,
};

/**
 * Exact Breath of the Wild damage calculation:
 *   Math.floor(baseAttack * situationMult * buffMult) + elementBonus
 *
 * - Situational multipliers: Sneakstrike 8x, Frozen 3x, Headshot/Crit/Break/Throw/Mounted 2x.
 * - Buff multipliers: Attack Up Lv1 1.2x / Lv2 1.3x / Lv3 1.5x; Ancient Proficiency 1.8x; Bone Proficiency 1.8x.
 * - Elemental bonuses: Fire/Ice +10 (or 9999 one-shot if targetElementalWeakness), Shock +20 (unless targetShockImmune).
 */
export function computeBotWDamage(params: BotWDamageParams): number {
  const {
    baseAttack,
    isSneakstrike = false,
    isHeadshotOrCrit = false,
    isWeaponBreak = false,
    isThrow = false,
    isMountedMelee = false,
    isTargetFrozen = false,
    attackUpLevel = 0,
    ancientProficiency = false,
    boneProficiency = false,
    weaponIsAncient = false,
    weaponIsBone = false,
    element,
    targetElementalWeakness = false,
    targetShockImmune = false,
  } = params;

  if ((element === 'Fire' || element === 'Ice') && targetElementalWeakness) {
    return 9999;
  }

  let situationMult = 1;
  if (isSneakstrike) {
    situationMult = 8;
  } else if (isTargetFrozen) {
    situationMult = 3;
  } else if (isHeadshotOrCrit || isWeaponBreak || isThrow || isMountedMelee) {
    situationMult = 2;
  }

  let buffMult = ATTACK_UP_MULT[attackUpLevel];
  if (ancientProficiency && weaponIsAncient) {
    buffMult *= 1.8;
  } else if (boneProficiency && weaponIsBone) {
    buffMult *= 1.8;
  }

  let elementBonus = 0;
  if (element === 'Fire' || element === 'Ice') {
    elementBonus = 10;
  } else if (element === 'Electricity') {
    elementBonus = targetShockImmune ? 0 : 20;
  }

  const physicalDamage = Math.max(
    0,
    Math.floor(baseAttack * situationMult * buffMult + 1e-9),
  );
  return physicalDamage + elementBonus;
}
