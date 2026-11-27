import type { ArmorPiece, DyeColorDef, SetBonusType } from '../types/botw';

/**
 * Hateno Village Kochi Dye Shop (コチ染色店) palette:
 * Default (original color) + all 15 authentic Breath of the Wild dye colors.
 */
export const KOCHI_DYE_COLORS: DyeColorDef[] = [
  { id: 'default', nameJa: '元の色', nameEn: 'Original', hex: '#a89f91' },
  { id: 'blue', nameJa: '青', nameEn: 'Blue', hex: '#2b5ea7' },
  { id: 'red', nameJa: '赤', nameEn: 'Red', hex: '#b92b27' },
  { id: 'yellow', nameJa: '黄', nameEn: 'Yellow', hex: '#d9b326' },
  { id: 'white', nameJa: '白', nameEn: 'White', hex: '#ece9e2' },
  { id: 'black', nameJa: '黒', nameEn: 'Black', hex: '#242428' },
  { id: 'purple', nameJa: '紫', nameEn: 'Purple', hex: '#6c3a8a' },
  { id: 'green', nameJa: '緑', nameEn: 'Green', hex: '#3b7a44' },
  { id: 'light_blue', nameJa: '水色', nameEn: 'Light Blue', hex: '#58a9d6' },
  { id: 'navy', nameJa: '紺', nameEn: 'Navy', hex: '#1c2e59' },
  { id: 'orange', nameJa: '橙', nameEn: 'Orange', hex: '#d96c27' },
  { id: 'peach', nameJa: '桃', nameEn: 'Peach', hex: '#e28799' },
  { id: 'crimson', nameJa: 'えんじ', nameEn: 'Crimson', hex: '#7d1924' },
  { id: 'light_yellow', nameJa: 'クリーム', nameEn: 'Light Yellow', hex: '#e8d98a' },
  { id: 'brown', nameJa: '茶', nameEn: 'Brown', hex: '#6e472b' },
  { id: 'gray', nameJa: '灰', nameEn: 'Gray', hex: '#7b7d82' },
];

export const KOCHI_DYE_MAP: Record<string, DyeColorDef> = Object.fromEntries(
  KOCHI_DYE_COLORS.map((color) => [color.id, color]),
);

const DEF_3_20: [number, number, number, number, number] = [3, 5, 8, 12, 20];
const DEF_4_28: [number, number, number, number, number] = [4, 7, 12, 18, 28];
const DEF_2_16: [number, number, number, number, number] = [2, 4, 6, 9, 16];
const DEF_3_18: [number, number, number, number, number] = [3, 5, 8, 12, 18];
const DEF_5_32: [number, number, number, number, number] = [5, 8, 14, 22, 32];

const fixedDef = (value: number): [number, number, number, number, number] => [
  value,
  value,
  value,
  value,
  value,
];

/**
 * Complete Breath of the Wild armor catalog (Base + DLC1 + DLC2 + Collab + Amiibo equivalents).
 */
export const ARMOR_PIECES: ArmorPiece[] = [
  // =========================================================================
  // UPGRADEABLE FULL SETS (19 sets, 57 pieces)
  // =========================================================================

  // 1. Hylian Set (3 -> 20)
  {
    id: 'hylian_hood',
    nameJa: 'ハイリアのフード',
    nameEn: 'Hylian Hood',
    slot: 'head',
    setId: 'hylian',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'none',
    baseColor: '#4e4137',
    accentColor: '#9e8869',
    dyeable: true,
    dlcTag: 'base',
    description: 'ハイラルに古くから伝わる旅人用のフード。雨風を防ぎやすい丈夫な布で仕立てられている。',
  },
  {
    id: 'hylian_tunic',
    nameJa: 'ハイリアの服',
    nameEn: 'Hylian Tunic',
    slot: 'body',
    setId: 'hylian',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'none',
    baseColor: '#7a2e2e',
    accentColor: '#c9b38c',
    dyeable: true,
    dlcTag: 'base',
    description: 'ハイラルで広く親しまれる冒険者用の服。軽くて動きやすく長旅に適している。',
  },
  {
    id: 'hylian_trousers',
    nameJa: 'ハイリアのズボン',
    nameEn: 'Hylian Trousers',
    slot: 'legs',
    setId: 'hylian',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'none',
    baseColor: '#b9ab92',
    accentColor: '#5c402c',
    dyeable: true,
    dlcTag: 'base',
    description: 'ハイラルで定番の丈夫なズボン。革ブーツと組み合わせて悪路でも歩きやすい。',
  },

  // 2. Soldier's Set (4 -> 28)
  {
    id: 'soldiers_helm',
    nameJa: 'ハイラル兵の兜',
    nameEn: "Soldier's Helm",
    slot: 'head',
    setId: 'soldier',
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'none',
    baseColor: '#8d9298',
    accentColor: '#b03030',
    dyeable: true,
    dlcTag: 'base',
    description: 'かつてハイラル城を守護した衛兵の鉄兜。優れた防御力を誇る。',
  },
  {
    id: 'soldiers_armor',
    nameJa: 'ハイラル兵の鎧',
    nameEn: "Soldier's Armor",
    slot: 'body',
    setId: 'soldier',
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'none',
    baseColor: '#7c828a',
    accentColor: '#c49f4b',
    dyeable: true,
    dlcTag: 'base',
    description: 'ハイラル兵士に支給された重厚な金属鎧。激戦にも耐える堅牢さを持つ。',
  },
  {
    id: 'soldiers_greaves',
    nameJa: 'ハイラル兵のすね当て',
    nameEn: "Soldier's Greaves",
    slot: 'legs',
    setId: 'soldier',
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'none',
    baseColor: '#727880',
    accentColor: '#4c3e32',
    dyeable: true,
    dlcTag: 'base',
    description: '鉄板で脚部を守るハイラル兵の具足。重量感に見合った高い防御力がある。',
  },

  // 3. Snowquill / Rito Set (3 -> 20, cold_resist, set: unfreezable)
  {
    id: 'snowquill_headdress',
    nameJa: 'リトの羽毛飾り',
    nameEn: 'Snowquill Headdress',
    slot: 'head',
    setId: 'snowquill',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'cold_resist',
    effectLevel: 1,
    setBonus: 'unfreezable',
    baseColor: '#b83c3c',
    accentColor: '#e8d8b5',
    dyeable: true,
    dlcTag: 'base',
    description: 'リト族の羽毛とルビーの装飾を組み合わせた防寒用の髪飾り。寒さへの耐性を高める。',
  },
  {
    id: 'snowquill_tunic',
    nameJa: 'リトの羽毛服',
    nameEn: 'Snowquill Tunic',
    slot: 'body',
    setId: 'snowquill',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'cold_resist',
    effectLevel: 1,
    setBonus: 'unfreezable',
    baseColor: '#2c5a6c',
    accentColor: '#d9c6a3',
    dyeable: true,
    dlcTag: 'base',
    description: 'リト族の抜け羽をたっぷり織り込んだ保温性の高い防寒服。雪山探索の必需品。',
  },
  {
    id: 'snowquill_trousers',
    nameJa: 'リトの羽毛ズボン',
    nameEn: 'Snowquill Trousers',
    slot: 'legs',
    setId: 'snowquill',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'cold_resist',
    effectLevel: 1,
    setBonus: 'unfreezable',
    baseColor: '#5c4636',
    accentColor: '#d8ccb8',
    dyeable: true,
    dlcTag: 'base',
    description: '内側にリトの羽毛を敷き詰めた暖かいズボン。吹雪の中でも体温を保ちやすい。',
  },

  // 4. Desert Voe Set (3 -> 20, heat_resist, set: shock_proof)
  {
    id: 'desert_voe_headband',
    nameJa: '熱砂の鉢金',
    nameEn: 'Desert Voe Headband',
    slot: 'head',
    setId: 'desert_voe',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'heat_resist',
    effectLevel: 1,
    setBonus: 'shock_proof',
    baseColor: '#3a78a8',
    accentColor: '#d8b458',
    dyeable: true,
    dlcTag: 'base',
    description: '冷気をもたらすサファイアをあしらったゲルドの男性用鉢金。砂漠の暑さを和らげる。',
  },
  {
    id: 'desert_voe_spaulder',
    nameJa: '熱砂の肩当て',
    nameEn: 'Desert Voe Spaulder',
    slot: 'body',
    setId: 'desert_voe',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'heat_resist',
    effectLevel: 1,
    setBonus: 'shock_proof',
    baseColor: '#4888b2',
    accentColor: '#dfc174',
    dyeable: true,
    dlcTag: 'base',
    description: '通気性と冷却効果に優れたゲルド砂漠用の肩当て。灼熱の日差しに耐える。',
  },
  {
    id: 'desert_voe_trousers',
    nameJa: '熱砂のズボン',
    nameEn: 'Desert Voe Trousers',
    slot: 'legs',
    setId: 'desert_voe',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'heat_resist',
    effectLevel: 1,
    setBonus: 'shock_proof',
    baseColor: '#3b6d8c',
    accentColor: '#d9b968',
    dyeable: true,
    dlcTag: 'base',
    description: '風通しの良い布地で作られたゲルドの男性用ズボン。厳しい暑さを軽減する。',
  },

  // 5. Flamebreaker Set (3 -> 20, flame_guard, set: fireproof)
  {
    id: 'flamebreaker_helm',
    nameJa: '耐火の石兜',
    nameEn: 'Flamebreaker Helm',
    slot: 'head',
    setId: 'flamebreaker',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'flame_guard',
    effectLevel: 1,
    setBonus: 'fireproof',
    baseColor: '#8d5b3e',
    accentColor: '#d98a4a',
    dyeable: true,
    dlcTag: 'base',
    description: 'ゴロン族が旅人のために造った耐熱石兜。デスマウンテンの灼熱環境から身を守る。',
  },
  {
    id: 'flamebreaker_armor',
    nameJa: '耐火の石鎧',
    nameEn: 'Flamebreaker Armor',
    slot: 'body',
    setId: 'flamebreaker',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'flame_guard',
    effectLevel: 1,
    setBonus: 'fireproof',
    baseColor: '#966143',
    accentColor: '#56473e',
    dyeable: true,
    dlcTag: 'base',
    description: '火を通さない特殊鉱石で組まれたゴロン製の耐火鎧。炎上を防ぐ。',
  },
  {
    id: 'flamebreaker_boots',
    nameJa: '耐火の石靴',
    nameEn: 'Flamebreaker Boots',
    slot: 'legs',
    setId: 'flamebreaker',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'flame_guard',
    effectLevel: 1,
    setBonus: 'fireproof',
    baseColor: '#7a4f38',
    accentColor: '#c97e46',
    dyeable: true,
    dlcTag: 'base',
    description: '溶岩地帯の熱気から足元を守る頑丈な石靴。火山登山に欠かせない。',
  },

  // 6. Zora Set (3 -> 20, swim_speed + helm spin_attack_swim + armor waterfall_climb, set: swim_dash_stamina)
  {
    id: 'zora_helm',
    nameJa: 'ゾーラの兜',
    nameEn: 'Zora Helm',
    slot: 'head',
    setId: 'zora',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'spin_attack_swim',
    effectLevel: 1,
    setBonus: 'swim_dash_stamina',
    baseColor: '#3a78b0',
    accentColor: '#c8d6e0',
    dyeable: true,
    dlcTag: 'base',
    description: 'ゾーラ族の伝統を受け継ぐ兜。泳ぎ速度が上がり、水中で回転アタックが可能になる。',
  },
  {
    id: 'zora_armor',
    nameJa: 'ゾーラの鎧',
    nameEn: 'Zora Armor',
    slot: 'body',
    setId: 'zora',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'waterfall_climb',
    effectLevel: 1,
    setBonus: 'swim_dash_stamina',
    baseColor: '#2d68a0',
    accentColor: '#d9c682',
    dyeable: true,
    dlcTag: 'base',
    description: 'ゾーラの王女ミファーがリンクのために仕立てた特別な鎧。滝登りが可能になる。',
  },
  {
    id: 'zora_greaves',
    nameJa: 'ゾーラのすね当て',
    nameEn: 'Zora Greaves',
    slot: 'legs',
    setId: 'zora',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'swim_speed',
    effectLevel: 1,
    setBonus: 'swim_dash_stamina',
    baseColor: '#346ea4',
    accentColor: '#c4d2dc',
    dyeable: true,
    dlcTag: 'base',
    description: '竜の鱗を用いて作られたゾーラの具足。水中での推進力を高める。',
  },

  // 7. Stealth / Sheikah Set (2 -> 16, stealth, set: night_speed)
  {
    id: 'stealth_mask',
    nameJa: '忍びマスク',
    nameEn: 'Stealth Mask',
    slot: 'head',
    setId: 'stealth',
    upgradeable: true,
    defenseByStar: DEF_2_16,
    effect: 'stealth',
    effectLevel: 1,
    setBonus: 'night_speed',
    baseColor: '#2e3850',
    accentColor: '#b5343c',
    dyeable: true,
    dlcTag: 'base',
    description: 'シーカー族の隠密技術が込められた覆面。足音や気配を消して獲物に近づける。',
  },
  {
    id: 'stealth_chest_guard',
    nameJa: '忍びスーツ',
    nameEn: 'Stealth Chest Guard',
    slot: 'body',
    setId: 'stealth',
    upgradeable: true,
    defenseByStar: DEF_2_16,
    effect: 'stealth',
    effectLevel: 1,
    setBonus: 'night_speed',
    baseColor: '#2a344c',
    accentColor: '#c29c5a',
    dyeable: true,
    dlcTag: 'base',
    description: '衣擦れの音を極限まで抑えたシーカー族の忍び装束。静粛性を高める。',
  },
  {
    id: 'stealth_tights',
    nameJa: '忍びタイツ',
    nameEn: 'Stealth Tights',
    slot: 'legs',
    setId: 'stealth',
    upgradeable: true,
    defenseByStar: DEF_2_16,
    effect: 'stealth',
    effectLevel: 1,
    setBonus: 'night_speed',
    baseColor: '#263046',
    accentColor: '#9c2d34',
    dyeable: true,
    dlcTag: 'base',
    description: '足音を吸収する特殊な草履とタイツ。虫捕りや不意打ちに効果抜群。',
  },

  // 8. Climbing Set (3 -> 20, climb_speed, set: climb_jump_stamina)
  {
    id: 'climbers_bandanna',
    nameJa: 'クライムバンダナ',
    nameEn: "Climber's Bandanna",
    slot: 'head',
    setId: 'climbing',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'climb_speed',
    effectLevel: 1,
    setBonus: 'climb_jump_stamina',
    baseColor: '#c44636',
    accentColor: '#e2d7c2',
    dyeable: true,
    dlcTag: 'base',
    description: '古代の知恵で体幹バランスを補助するバンダナ。壁登りの速度が上がる。',
  },
  {
    id: 'climbing_gear',
    nameJa: 'クライムグローブ',
    nameEn: 'Climbing Gear',
    slot: 'body',
    setId: 'climbing',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'climb_speed',
    effectLevel: 1,
    setBonus: 'climb_jump_stamina',
    baseColor: '#4a647a',
    accentColor: '#c87240',
    dyeable: true,
    dlcTag: 'base',
    description: '岩肌をしっかり掴む滑り止め加工が施された登攀装備。崖登りが素早くなる。',
  },
  {
    id: 'climbing_boots',
    nameJa: 'クライムシューズ',
    nameEn: 'Climbing Boots',
    slot: 'legs',
    setId: 'climbing',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'climb_speed',
    effectLevel: 1,
    setBonus: 'climb_jump_stamina',
    baseColor: '#5c4b3c',
    accentColor: '#c4503c',
    dyeable: true,
    dlcTag: 'base',
    description: 'わずかな凹凸にも足が掛かる登山靴。急峻な絶壁でも素早く登り切れる。',
  },

  // 9. Barbarian Set (3 -> 20, attack_up, set: charge_atk_stamina)
  {
    id: 'barbarian_helm',
    nameJa: '蛮族の兜',
    nameEn: 'Barbarian Helm',
    slot: 'head',
    setId: 'barbarian',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'attack_up',
    effectLevel: 1,
    setBonus: 'charge_atk_stamina',
    baseColor: '#d9cfb8',
    accentColor: '#9e2a24',
    dyeable: true,
    dlcTag: 'base',
    description: 'フィローネ地方の戦部族が用いた角付き兜。闘争心を高め攻撃力を強化する。',
  },
  {
    id: 'barbarian_armor',
    nameJa: '蛮族の服',
    nameEn: 'Barbarian Armor',
    slot: 'body',
    setId: 'barbarian',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'attack_up',
    effectLevel: 1,
    setBonus: 'charge_atk_stamina',
    baseColor: '#7a4e32',
    accentColor: '#c6362c',
    dyeable: true,
    dlcTag: 'base',
    description: '戦いの文様が刻まれた戦士の装束。装備者の攻撃力を引き上げる。',
  },
  {
    id: 'barbarian_leg_wraps',
    nameJa: '蛮族の腰巻き',
    nameEn: 'Barbarian Leg Wraps',
    slot: 'legs',
    setId: 'barbarian',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'attack_up',
    effectLevel: 1,
    setBonus: 'charge_atk_stamina',
    baseColor: '#6d442b',
    accentColor: '#d8cbb2',
    dyeable: true,
    dlcTag: 'base',
    description: '猛き戦士の気迫を宿す腰巻き。踏み込みが強くなり攻撃力が増す。',
  },

  // 10. Rubber Set (3 -> 20, shock_resist, set: lightning_proof)
  {
    id: 'rubber_helm',
    nameJa: 'ラバーキャップ',
    nameEn: 'Rubber Helm',
    slot: 'head',
    setId: 'rubber',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'shock_resist',
    effectLevel: 1,
    setBonus: 'lightning_proof',
    baseColor: '#4c5666',
    accentColor: '#d6a62c',
    dyeable: true,
    dlcTag: 'base',
    description: '電気を通さない希少素材ラバーで作られた兜。感電ダメージを軽減する。',
  },
  {
    id: 'rubber_armor',
    nameJa: 'ラバースーツ',
    nameEn: 'Rubber Armor',
    slot: 'body',
    setId: 'rubber',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'shock_resist',
    effectLevel: 1,
    setBonus: 'lightning_proof',
    baseColor: '#424c5c',
    accentColor: '#d6a62c',
    dyeable: true,
    dlcTag: 'base',
    description: '高い絶縁性を持つ古代技術由来のスーツ。雷や電撃攻撃に強い。',
  },
  {
    id: 'rubber_tights',
    nameJa: 'ラバータイツ',
    nameEn: 'Rubber Tights',
    slot: 'legs',
    setId: 'rubber',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'shock_resist',
    effectLevel: 1,
    setBonus: 'lightning_proof',
    baseColor: '#3a4252',
    accentColor: '#c49628',
    dyeable: true,
    dlcTag: 'base',
    description: '絶縁素材で脚部を覆うタイツ。全身を揃えて強化すると落雷すら無効化する。',
  },

  // 11. Radiant / Luminous Set (3 -> 20, night_glow, set: bone_proficiency_disguise, triggersNpcFear)
  {
    id: 'radiant_mask',
    nameJa: '夜光マスク',
    nameEn: 'Radiant Mask',
    slot: 'head',
    setId: 'radiant',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'night_glow',
    effectLevel: 1,
    setBonus: 'bone_proficiency_disguise',
    baseColor: '#1f2836',
    accentColor: '#46f2c8',
    dyeable: true,
    triggersNpcFear: true,
    dlcTag: 'base',
    description: '夜光石の粉末で骸骨模様を描いた怪しいマスク。暗闇で妖しく発光し人々を驚かせる。',
  },
  {
    id: 'radiant_shirt',
    nameJa: '夜光スーツ',
    nameEn: 'Radiant Shirt',
    slot: 'body',
    setId: 'radiant',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'night_glow',
    effectLevel: 1,
    setBonus: 'bone_proficiency_disguise',
    baseColor: '#1c2432',
    accentColor: '#46f2c8',
    dyeable: true,
    triggersNpcFear: true,
    dlcTag: 'base',
    description: '夜光石を塗り込んだ不気味なスーツ。セット強化で骨武器強化とスタル系偽装を得る。',
  },
  {
    id: 'radiant_tights',
    nameJa: '夜光タイツ',
    nameEn: 'Radiant Tights',
    slot: 'legs',
    setId: 'radiant',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'night_glow',
    effectLevel: 1,
    setBonus: 'bone_proficiency_disguise',
    baseColor: '#19202d',
    accentColor: '#46f2c8',
    dyeable: true,
    triggersNpcFear: true,
    dlcTag: 'base',
    description: '闇夜に骨の模様が浮かび上がる夜光タイツ。スタル系魔物の仲間と見做されやすい。',
  },

  // 12. Ancient Set (4 -> 28, ancient_resist, set: ancient_proficiency, ancientSetCompatible)
  {
    id: 'ancient_helm',
    nameJa: '古代兵装・兜',
    nameEn: 'Ancient Helm',
    slot: 'head',
    setId: 'ancient',
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'ancient_resist',
    effectLevel: 1,
    setBonus: 'ancient_proficiency',
    baseColor: '#4a433d',
    accentColor: '#36c9f5',
    dyeable: true,
    ancientSetCompatible: true,
    dlcTag: 'base',
    description: 'ロベリーの古代研究所で造られた対ガーディアン兜。古代兵器からのダメージを抑える。',
  },
  {
    id: 'ancient_cuirass',
    nameJa: '古代兵装・上鎧',
    nameEn: 'Ancient Cuirass',
    slot: 'body',
    setId: 'ancient',
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'ancient_resist',
    effectLevel: 1,
    setBonus: 'ancient_proficiency',
    baseColor: '#443d38',
    accentColor: '#36c9f5',
    dyeable: true,
    ancientSetCompatible: true,
    dlcTag: 'base',
    description: '古代シーカー技術で鍛えられた堅牢な胸甲。ガーディアンのビームにも高い耐性を示す。',
  },
  {
    id: 'ancient_greaves',
    nameJa: '古代兵装・下鎧',
    nameEn: 'Ancient Greaves',
    slot: 'legs',
    setId: 'ancient',
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'ancient_resist',
    effectLevel: 1,
    setBonus: 'ancient_proficiency',
    baseColor: '#3e3833',
    accentColor: '#36c9f5',
    dyeable: true,
    ancientSetCompatible: true,
    dlcTag: 'base',
    description: '古代パーツを応用した頑強な具足。古代兵装一式を★2以上にすると古代武器威力が1.8倍になる。',
  },

  // 13. Of the Wild Set (4 -> 28, set: master_sword_beam_up)
  {
    id: 'cap_of_the_wild',
    nameJa: '息吹の勇者帽子',
    nameEn: 'Cap of the Wild',
    slot: 'head',
    setId: 'wild',
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#3a7d3e',
    accentColor: '#d9c67a',
    dyeable: true,
    dlcTag: 'base',
    description: '全ての試練の祠を制覇した勇者へ贈られる緑の帽子。',
  },
  {
    id: 'tunic_of_the_wild',
    nameJa: '息吹の勇者服',
    nameEn: 'Tunic of the Wild',
    slot: 'body',
    setId: 'wild',
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#37773b',
    accentColor: '#9c7848',
    dyeable: true,
    dlcTag: 'base',
    description: '広大なハイラルを駆けた勇者のために仕立てられた伝統の緑衣。',
  },
  {
    id: 'trousers_of_the_wild',
    nameJa: '息吹の勇者ズボン',
    nameEn: 'Trousers of the Wild',
    slot: 'legs',
    setId: 'wild',
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#b89f76',
    accentColor: '#66482e',
    dyeable: true,
    dlcTag: 'base',
    description: '荒野を軽快に駆けるための勇者の短パンとブーツ。一式強化でマスターソードのビームが強化される。',
  },

  // 14a. Classic Hero Set — Of the Hero (3 -> 20, set: master_sword_beam_up)
  {
    id: 'cap_of_the_hero',
    nameJa: '始まりの勇者帽子',
    nameEn: 'Cap of the Hero',
    slot: 'head',
    setId: 'hero',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#3e8438',
    accentColor: '#d4a644',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '遥か古の初代勇者が被っていたと伝わる伝統的な緑の帽子。',
  },
  {
    id: 'tunic_of_the_hero',
    nameJa: '始まりの勇者服',
    nameEn: 'Tunic of the Hero',
    slot: 'body',
    setId: 'hero',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#3a7e35',
    accentColor: '#8c5d32',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '伝説の始まりの勇者が身に纏った簡素ながら気高い緑の服。',
  },
  {
    id: 'trousers_of_the_hero',
    nameJa: '始まりの勇者ズボン',
    nameEn: 'Trousers of the Hero',
    slot: 'legs',
    setId: 'hero',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#c4a678',
    accentColor: '#6e4526',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '古の勇者が愛用した動きやすいズボンと革靴。',
  },

  // 14b. Classic Hero Set — Of Time (3 -> 20, set: master_sword_beam_up)
  {
    id: 'cap_of_time',
    nameJa: '時の勇者帽子',
    nameEn: 'Cap of Time',
    slot: 'head',
    setId: 'time',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#2e7d3c',
    accentColor: '#d8c882',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '時を超えてハイラルを救った勇者が被っていたと伝わる帽子。',
  },
  {
    id: 'tunic_of_time',
    nameJa: '時の勇者服',
    nameEn: 'Tunic of Time',
    slot: 'body',
    setId: 'time',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#2a7438',
    accentColor: '#e4e0d2',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '時の勇者が着用した鮮やかな緑のチュニック。白い長袖の下着が特徴。',
  },
  {
    id: 'trousers_of_time',
    nameJa: '時の勇者ズボン',
    nameEn: 'Trousers of Time',
    slot: 'legs',
    setId: 'time',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#e2dfd4',
    accentColor: '#6b4528',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '時の勇者が大地を駆け抜けた白タイツと堅牢な革ブーツ。',
  },

  // 14c. Classic Hero Set — Of the Wind (3 -> 20, set: master_sword_beam_up)
  {
    id: 'cap_of_the_wind',
    nameJa: '風の勇者帽子',
    nameEn: 'Cap of the Wind',
    slot: 'head',
    setId: 'wind',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#48a038',
    accentColor: '#a8d85c',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '大海原を渡った風の勇者が被っていた鮮やかな緑の帽子。',
  },
  {
    id: 'tunic_of_the_wind',
    nameJa: '風の勇者服',
    nameEn: 'Tunic of the Wind',
    slot: 'body',
    setId: 'wind',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#449836',
    accentColor: '#98d058',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '海風をはらむ軽やかな風の勇者の服。若草色の袖が印象的。',
  },
  {
    id: 'trousers_of_the_wind',
    nameJa: '風の勇者ズボン',
    nameEn: 'Trousers of the Wind',
    slot: 'legs',
    setId: 'wind',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#ebe8dc',
    accentColor: '#7a4d2c',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '大海原を旅した勇者の白いズボンとブーツ。',
  },

  // 14d. Classic Hero Set — Of Twilight (3 -> 20, set: master_sword_beam_up)
  {
    id: 'cap_of_twilight',
    nameJa: '黄昏の勇者帽子',
    nameEn: 'Cap of Twilight',
    slot: 'head',
    setId: 'twilight',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#2d5c32',
    accentColor: '#8d8779',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '影の領域と戦った黄昏の勇者が被っていた深緑の帽子。',
  },
  {
    id: 'tunic_of_twilight',
    nameJa: '黄昏の勇者服',
    nameEn: 'Tunic of Twilight',
    slot: 'body',
    setId: 'twilight',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#2b5830',
    accentColor: '#787e84',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '鎖帷子を内側に仕込んだ黄昏の勇者の深緑のチュニック。',
  },
  {
    id: 'trousers_of_twilight',
    nameJa: '黄昏の勇者ズボン',
    nameEn: 'Trousers of Twilight',
    slot: 'legs',
    setId: 'twilight',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#c8bfa6',
    accentColor: '#563924',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '黄昏の勇者が愛用した実戦向きのズボンと長靴。',
  },

  // 14e. Classic Hero Set — Of the Sky (3 -> 20, set: master_sword_beam_up)
  {
    id: 'cap_of_the_sky',
    nameJa: '空の勇者帽子',
    nameEn: 'Cap of the Sky',
    slot: 'head',
    setId: 'sky',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#4c803c',
    accentColor: '#b59d6c',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '大空の鳥に乗り旅立った空の勇者が被っていたとされる帽子。',
  },
  {
    id: 'tunic_of_the_sky',
    nameJa: '空の勇者服',
    nameEn: 'Tunic of the Sky',
    slot: 'body',
    setId: 'sky',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#487938',
    accentColor: '#7a5234',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '空の騎士学校で授与された緑の制服が由来の勇者服。',
  },
  {
    id: 'trousers_of_the_sky',
    nameJa: '空の勇者ズボン',
    nameEn: 'Trousers of the Sky',
    slot: 'legs',
    setId: 'sky',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'master_sword_beam_up',
    baseColor: '#d9d2be',
    accentColor: '#6d472b',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '大空から大地へ降り立った空の勇者のゆったりしたズボンとブーツ。',
  },

  // 15. Fierce Deity Set (3 -> 20, attack_up, set: charge_atk_stamina)
  {
    id: 'fierce_deity_mask',
    nameJa: '鬼神の帽子',
    nameEn: 'Fierce Deity Mask',
    slot: 'head',
    setId: 'fierce_deity',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'attack_up',
    effectLevel: 1,
    setBonus: 'charge_atk_stamina',
    baseColor: '#dfe4ec',
    accentColor: '#3a7898',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '月が落ちる世界を救った鬼神の力を宿す帽子。身につけると荒ぶる攻撃力が目覚める。',
  },
  {
    id: 'fierce_deity_armor',
    nameJa: '鬼神の服',
    nameEn: 'Fierce Deity Armor',
    slot: 'body',
    setId: 'fierce_deity',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'attack_up',
    effectLevel: 1,
    setBonus: 'charge_atk_stamina',
    baseColor: '#305478',
    accentColor: '#d4dce6',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '三日月と太陽の紋様が刻まれた鬼神の胸当てと装束。攻撃力を大きく高める。',
  },
  {
    id: 'fierce_deity_boots',
    nameJa: '鬼神のブーツ',
    nameEn: 'Fierce Deity Boots',
    slot: 'legs',
    setId: 'fierce_deity',
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'attack_up',
    effectLevel: 1,
    setBonus: 'charge_atk_stamina',
    baseColor: '#3d4c5c',
    accentColor: '#c4cdd8',
    dyeable: false,
    dlcTag: 'amiibo',
    description: '鬼神の剛力を支えるブーツ。セット強化でタメ攻撃のスタミナ消費が軽減される。',
  },

  // =========================================================================
  // NON-UPGRADEABLE FULL SETS (7 sets, 21 pieces)
  // =========================================================================

  // 16. Gerudo Vai Set (1 fixed, set: gerudo_vai_heat, gerudoEntryPiece: true)
  {
    id: 'gerudo_veil',
    nameJa: '淑女のマスク',
    nameEn: 'Gerudo Veil',
    slot: 'head',
    setId: 'gerudo_vai',
    upgradeable: false,
    defenseByStar: fixedDef(1),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'gerudo_vai_heat',
    baseColor: '#48b2ba',
    accentColor: '#e2c268',
    dyeable: true,
    gerudoEntryPiece: true,
    dlcTag: 'base',
    description: 'ゲルドの街へ入るための淑女用ヴェール。全身を揃えれば男子禁制の門を通れる。',
  },
  {
    id: 'gerudo_top',
    nameJa: '淑女の服',
    nameEn: 'Gerudo Top',
    slot: 'body',
    setId: 'gerudo_vai',
    upgradeable: false,
    defenseByStar: fixedDef(1),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'gerudo_vai_heat',
    baseColor: '#42a6b0',
    accentColor: '#e2c268',
    dyeable: true,
    gerudoEntryPiece: true,
    dlcTag: 'base',
    description: '砂漠の風を通す軽やかなゲルドの女性服。一式揃えると暑さガード効果を発揮する。',
  },
  {
    id: 'gerudo_sirwal',
    nameJa: '淑女のズボン',
    nameEn: 'Gerudo Sirwal',
    slot: 'legs',
    setId: 'gerudo_vai',
    upgradeable: false,
    defenseByStar: fixedDef(1),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'gerudo_vai_heat',
    baseColor: '#3c9ca6',
    accentColor: '#e0be60',
    dyeable: true,
    gerudoEntryPiece: true,
    dlcTag: 'base',
    description: 'しなやかな絹織物で仕立てられたゲルドの女性用サルエルパンツ。',
  },

  // 17. Dark Link Set (3 fixed, set: night_speed, triggersNpcFear: true)
  {
    id: 'dark_hood',
    nameJa: 'ダークヘッド',
    nameEn: 'Dark Hood',
    slot: 'head',
    setId: 'dark',
    upgradeable: false,
    defenseByStar: fixedDef(3),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'night_speed',
    baseColor: '#1e2026',
    accentColor: '#d92828',
    dyeable: false,
    triggersNpcFear: true,
    dlcTag: 'base',
    description: 'キルトンが闇の魔物を模して作った漆黒の頭巾。紅く光る双眸が人々を怯えさせる。',
  },
  {
    id: 'dark_tunic',
    nameJa: 'ダークボディ',
    nameEn: 'Dark Tunic',
    slot: 'body',
    setId: 'dark',
    upgradeable: false,
    defenseByStar: fixedDef(3),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'night_speed',
    baseColor: '#1c1e24',
    accentColor: '#565a66',
    dyeable: false,
    triggersNpcFear: true,
    dlcTag: 'base',
    description: '闇の影そのものを纏うような漆黒の服。全身装備で夜間移動速度が上がる。',
  },
  {
    id: 'dark_trousers',
    nameJa: 'ダークレッグ',
    nameEn: 'Dark Trousers',
    slot: 'legs',
    setId: 'dark',
    upgradeable: false,
    defenseByStar: fixedDef(3),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'night_speed',
    baseColor: '#181a20',
    accentColor: '#484c56',
    dyeable: false,
    triggersNpcFear: true,
    dlcTag: 'base',
    description: '夜の闇に溶け込むダークリンク風の脚装備。見た者は思わず身構えてしまう。',
  },

  // 18. Tingle Set (2 fixed, set: night_speed, triggersNpcFear: true, dlcTag: 'dlc1')
  {
    id: 'tingles_hood',
    nameJa: 'チンクルの頭巾',
    nameEn: "Tingle's Hood",
    slot: 'head',
    setId: 'tingle',
    upgradeable: false,
    defenseByStar: fixedDef(2),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'night_speed',
    baseColor: '#4ea836',
    accentColor: '#d83830',
    dyeable: false,
    triggersNpcFear: true,
    dlcTag: 'dlc1',
    description: '妖精の生まれ変わりを名乗る奇妙な男の頭巾。道行く人々をひどく驚かせる。',
  },
  {
    id: 'tingles_shirt',
    nameJa: 'チンクルの服',
    nameEn: "Tingle's Shirt",
    slot: 'body',
    setId: 'tingle',
    upgradeable: false,
    defenseByStar: fixedDef(2),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'night_speed',
    baseColor: '#4ca234',
    accentColor: '#e23a32',
    dyeable: false,
    triggersNpcFear: true,
    dlcTag: 'dlc1',
    description: '鮮やかな緑色の全身タイツ上半身。一式揃えると夜間の移動が妙に速くなる。',
  },
  {
    id: 'tingles_tights',
    nameJa: 'チンクルのズボン',
    nameEn: "Tingle's Tights",
    slot: 'legs',
    setId: 'tingle',
    upgradeable: false,
    defenseByStar: fixedDef(2),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'night_speed',
    baseColor: '#489a32',
    accentColor: '#d83630',
    dyeable: false,
    triggersNpcFear: true,
    dlcTag: 'dlc1',
    description: '赤いパンツが眩しいチンクルのタイツ。見る者を困惑させる不思議なオーラがある。',
  },

  // 19. Phantom Set (8 fixed, attack_up, dlcTag: 'dlc1')
  {
    id: 'phantom_helmet',
    nameJa: 'ファントムの兜',
    nameEn: 'Phantom Helmet',
    slot: 'head',
    setId: 'phantom',
    upgradeable: false,
    defenseByStar: fixedDef(8),
    effect: 'attack_up',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#5c5266',
    accentColor: '#c9a648',
    dyeable: false,
    dlcTag: 'dlc1',
    description: '勇者すら恐れたというファントムの重兜。初期から高い防御力と攻撃力アップを兼ね備える。',
  },
  {
    id: 'phantom_armor',
    nameJa: 'ファントムの鎧',
    nameEn: 'Phantom Armor',
    slot: 'body',
    setId: 'phantom',
    upgradeable: false,
    defenseByStar: fixedDef(8),
    effect: 'attack_up',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#544a5e',
    accentColor: '#c9a648',
    dyeable: false,
    dlcTag: 'dlc1',
    description: '魂を宿した鎧兵士ファントムの重装甲。序盤から頼れる防御力と攻撃力強化を持つ。',
  },
  {
    id: 'phantom_greaves',
    nameJa: 'ファントムのすね当て',
    nameEn: 'Phantom Greaves',
    slot: 'legs',
    setId: 'phantom',
    upgradeable: false,
    defenseByStar: fixedDef(8),
    effect: 'attack_up',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#4c4256',
    accentColor: '#c09e44',
    dyeable: false,
    dlcTag: 'dlc1',
    description: 'ファントムの重厚な鉄脚。一式揃えれば防御24かつ攻撃アップLv3に達する。',
  },

  // 20. Phantom Ganon Set (4 fixed, stealth, set: stealth_bone_disguise, triggersNpcFear, dlcTag: 'dlc2')
  {
    id: 'phantom_ganon_skull',
    nameJa: 'ファントムガノン兜',
    nameEn: 'Phantom Ganon Skull',
    slot: 'head',
    setId: 'phantom_ganon',
    upgradeable: false,
    defenseByStar: fixedDef(4),
    effect: 'stealth',
    effectLevel: 1,
    setBonus: 'stealth_bone_disguise',
    baseColor: '#2a222c',
    accentColor: '#a82632',
    dyeable: false,
    triggersNpcFear: true,
    dlcTag: 'dlc2',
    description: '魔王の幻影を象った禍々しい兜。静粛性を高め、見た者に強い畏怖を与える。',
  },
  {
    id: 'phantom_ganon_armor',
    nameJa: 'ファントムガノン鎧',
    nameEn: 'Phantom Ganon Armor',
    slot: 'body',
    setId: 'phantom_ganon',
    upgradeable: false,
    defenseByStar: fixedDef(4),
    effect: 'stealth',
    effectLevel: 1,
    setBonus: 'stealth_bone_disguise',
    baseColor: '#241d26',
    accentColor: '#b02834',
    dyeable: false,
    triggersNpcFear: true,
    dlcTag: 'dlc2',
    description: '紅いマントを翻すファントムガノンの黒鎧。全身装備でスタル偽装と骨武器強化を得る。',
  },
  {
    id: 'phantom_ganon_greaves',
    nameJa: 'ファントムガノン具足',
    nameEn: 'Phantom Ganon Greaves',
    slot: 'legs',
    setId: 'phantom_ganon',
    upgradeable: false,
    defenseByStar: fixedDef(4),
    effect: 'stealth',
    effectLevel: 1,
    setBonus: 'stealth_bone_disguise',
    baseColor: '#201922',
    accentColor: '#94222c',
    dyeable: false,
    triggersNpcFear: true,
    dlcTag: 'dlc2',
    description: '怨念めいた気配を纏う黒鉄の具足。音もなく忍び寄る隠密性能を併せ持つ。',
  },

  // 21. Royal Guard Set (4 fixed, set: royal_guard_stamina, dlcTag: 'dlc2')
  {
    id: 'royal_guard_cap',
    nameJa: '近衛兵の帽子',
    nameEn: 'Royal Guard Cap',
    slot: 'head',
    setId: 'royal_guard',
    upgradeable: false,
    defenseByStar: fixedDef(4),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'royal_guard_stamina',
    baseColor: '#263452',
    accentColor: '#d9b856',
    dyeable: false,
    dlcTag: 'dlc2',
    description: 'ハイラル王家の直属近衛兵に許された格調高いベレー帽。',
  },
  {
    id: 'royal_guard_uniform',
    nameJa: '近衛兵の服',
    nameEn: 'Royal Guard Uniform',
    slot: 'body',
    setId: 'royal_guard',
    upgradeable: false,
    defenseByStar: fixedDef(4),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'royal_guard_stamina',
    baseColor: '#24304c',
    accentColor: '#c8343c',
    dyeable: false,
    dlcTag: 'dlc2',
    description: '王家紋章の刺繍が施された近衛兵の礼装。一式揃えるとタメ攻撃・壁ジャンプ・泳ぎダッシュのスタミナ消費が軽減される。',
  },
  {
    id: 'royal_guard_boots',
    nameJa: '近衛兵のブーツ',
    nameEn: 'Royal Guard Boots',
    slot: 'legs',
    setId: 'royal_guard',
    upgradeable: false,
    defenseByStar: fixedDef(4),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'royal_guard_stamina',
    baseColor: '#2b2420',
    accentColor: '#d9b856',
    dyeable: false,
    dlcTag: 'dlc2',
    description: '気品と機敏さを両立した近衛兵のブーツ。',
  },

  // 22. Salvager / Xenoblade Chronicles 2 Set (5 fixed, swim_speed, set: swim_dash_stamina, dlcTag: 'collab')
  {
    id: 'salvager_headwear',
    nameJa: 'サルベージャーメット',
    nameEn: 'Salvager Headwear',
    slot: 'head',
    setId: 'salvager',
    upgradeable: false,
    defenseByStar: fixedDef(5),
    effect: 'swim_speed',
    effectLevel: 1,
    setBonus: 'swim_dash_stamina',
    baseColor: '#2c5ca4',
    accentColor: '#d4a644',
    dyeable: false,
    dlcTag: 'collab',
    description: '【コラボ：ゼノブレイド2】雲海のお宝を追い求める少年の潜水ヘルメット。泳ぎ速度が上がる。',
  },
  {
    id: 'salvager_vest',
    nameJa: 'サルベージャーボディ',
    nameEn: 'Salvager Vest',
    slot: 'body',
    setId: 'salvager',
    upgradeable: false,
    defenseByStar: fixedDef(5),
    effect: 'swim_speed',
    effectLevel: 1,
    setBonus: 'swim_dash_stamina',
    baseColor: '#285496',
    accentColor: '#36c9a8',
    dyeable: false,
    dlcTag: 'collab',
    description: '【コラボ：ゼノブレイド2】潜水作業用のサルベージャースーツ。全身で泳ぎダッシュ消費を軽減する。',
  },
  {
    id: 'salvager_trousers',
    nameJa: 'サルベージャーレッグ',
    nameEn: 'Salvager Trousers',
    slot: 'legs',
    setId: 'salvager',
    upgradeable: false,
    defenseByStar: fixedDef(5),
    effect: 'swim_speed',
    effectLevel: 1,
    setBonus: 'swim_dash_stamina',
    baseColor: '#38465a',
    accentColor: '#d4a644',
    dyeable: false,
    dlcTag: 'collab',
    description: '【コラボ：ゼノブレイド2】堅牢な潜水用ボトムスとブーツ。水中移動を快適にする。',
  },

  // =========================================================================
  // INDIVIDUAL PIECES & ACCESSORIES (29 pieces)
  // =========================================================================

  // Champion's Tunic (5 -> 32, champion_hp_view, showsEnemyHp: true)
  {
    id: 'champions_tunic',
    nameJa: '英傑の服',
    nameEn: "Champion's Tunic",
    slot: 'body',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_5_32,
    effect: 'champion_hp_view',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#2c84c8',
    accentColor: '#e8e0cc',
    dyeable: false,
    showsEnemyHp: true,
    dlcTag: 'base',
    description: 'ハイラル王家から認められた英傑のみが纏うことを許された青衣。敵の残り体力を数値で見抜く。',
  },

  // Starter & Standalone Tops / Bottoms
  {
    id: 'well_worn_shirt',
    nameJa: '古びたシャツ',
    nameEn: 'Well-Worn Shirt',
    slot: 'body',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(1),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'none',
    baseColor: '#c2b398',
    accentColor: '#7a6852',
    dyeable: true,
    dlcTag: 'base',
    description: '回生の祠で見つかった年季の入ったシャツ。少し縮んでいるが冒険の第一歩を支える。',
  },
  {
    id: 'old_trousers',
    nameJa: '古びたパンツ',
    nameEn: 'Old Trousers',
    slot: 'legs',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(1),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'none',
    baseColor: '#8d7a62',
    accentColor: '#5c4c3a',
    dyeable: true,
    dlcTag: 'base',
    description: '回生の祠の宝箱に収められていた素朴なズボン。防御力は低いがないよりは安心。',
  },
  {
    id: 'warm_doublet',
    nameJa: '防寒着',
    nameEn: 'Warm Doublet',
    slot: 'body',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(1),
    effect: 'cold_resist',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#364e44',
    accentColor: '#c69a5c',
    dyeable: true,
    dlcTag: 'base',
    description: '始まりの台地の老人が手縫いした厚手の上着。雪山での冷気を防いでくれる。',
  },
  {
    id: 'island_lobster_shirt',
    nameJa: '青いエビシャツ',
    nameEn: 'Island Lobster Shirt',
    slot: 'body',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(1),
    effect: 'heat_resist',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#2c7ec8',
    accentColor: '#e88a3c',
    dyeable: false,
    dlcTag: 'dlc2',
    description: '南の島の伝統柄が描かれた涼しいシャツ。暑さガードに加えイカダの風推進力を高める。',
  },
  {
    id: 'nintendo_switch_shirt',
    nameJa: 'Nintendo Switchシャツ',
    nameEn: 'Nintendo Switch Shirt',
    slot: 'body',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(1),
    effect: 'none',
    effectLevel: 0,
    setBonus: 'none',
    baseColor: '#d92828',
    accentColor: '#f2f2f2',
    dyeable: false,
    dlcTag: 'dlc1',
    description: '異世界のロゴがあしらわれた真っ赤なシャツ。始まりの台地の宝箱に隠されている。',
  },

  // Gerudo Jewelry (6 upgradeable headpieces)
  {
    id: 'diamond_circlet',
    nameJa: 'ダイヤの頭飾り',
    nameEn: 'Diamond Circlet',
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'ancient_resist',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#d6a846',
    accentColor: '#d8f2ff',
    dyeable: false,
    dlcTag: 'base',
    description: '最高級のダイヤモンドを据えたゲルド宝飾品。古代兵器からのダメージを軽減する。',
  },
  {
    id: 'amber_earrings',
    nameJa: 'コハクの耳飾り',
    nameEn: 'Amber Earrings',
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'none',
    effectLevel: 0,
    setBonus: 'none',
    baseColor: '#c47c2c',
    accentColor: '#e2c064',
    dyeable: false,
    dlcTag: 'base',
    description: '大地の力を秘めたコハクの耳飾り。軽装のまま最大防御28という驚異の守りを誇る。',
  },
  {
    id: 'ruby_circlet',
    nameJa: 'ルビーの頭飾り',
    nameEn: 'Ruby Circlet',
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'cold_resist',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#d6a846',
    accentColor: '#e0343c',
    dyeable: false,
    dlcTag: 'base',
    description: '炎の力を宿すルビーの頭飾り。極寒の地でも身体を芯から温めてくれる。',
  },
  {
    id: 'sapphire_circlet',
    nameJa: 'サファイアの頭飾り',
    nameEn: 'Sapphire Circlet',
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'heat_resist',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#d6a846',
    accentColor: '#3088e6',
    dyeable: false,
    dlcTag: 'base',
    description: '氷の力を秘めたサファイアの頭飾り。灼熱の砂漠でも涼しく過ごせる。',
  },
  {
    id: 'opal_earrings',
    nameJa: 'オパールの耳飾り',
    nameEn: 'Opal Earrings',
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'swim_speed',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#c8b272',
    accentColor: '#66d6c8',
    dyeable: false,
    dlcTag: 'base',
    description: '水の加護を宿すオパールの耳飾り。装備すると泳ぎのスピードが向上する。',
  },
  {
    id: 'topaz_earrings',
    nameJa: 'トパーズの耳飾り',
    nameEn: 'Topaz Earrings',
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_3_18,
    effect: 'shock_resist',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#c8a842',
    accentColor: '#f2d43c',
    dyeable: false,
    dlcTag: 'base',
    description: '雷の力を閉じ込めたトパーズの耳飾り。電撃への耐性を高める。',
  },

  // Special Boots (upgradeable 3 -> 20, gerudoEntryCompatible: true)
  {
    id: 'sand_boots',
    nameJa: 'サンドブーツ',
    nameEn: 'Sand Boots',
    slot: 'legs',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'sand_speed',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#b8945e',
    accentColor: '#48a4ae',
    dyeable: true,
    gerudoEntryCompatible: true,
    dlcTag: 'base',
    description: '砂地で足が沈みにくい特製ブーツ。ゲルド砂漠を通常通り駆け抜けられ、淑女装束とも両立する。',
  },
  {
    id: 'snow_boots',
    nameJa: 'スノーブーツ',
    nameEn: 'Snow Boots',
    slot: 'legs',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_3_20,
    effect: 'snow_speed',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#785a46',
    accentColor: '#e4ddd2',
    dyeable: true,
    gerudoEntryCompatible: true,
    dlcTag: 'base',
    description: '深い雪原でも軽快に走れるゲルド特製ブーツ。淑女装束と合わせたままゲルドの街へ入れる。',
  },

  // Sheik's Mask (2 -> 16, stealth)
  {
    id: 'sheiks_mask',
    nameJa: 'シークのマスク',
    nameEn: "Sheik's Mask",
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_2_16,
    effect: 'stealth',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#2e4c86',
    accentColor: '#c8343c',
    dyeable: false,
    dlcTag: 'amiibo',
    description: 'シーカー族の生き残りを名乗った謎の青年シークの覆面。装備者の気配を消す。',
  },

  // 4 Divine Beast Helms (4 -> 28, ancient_resist, showsEnemyHp: true, ancientSetCompatible: true)
  {
    id: 'vah_ruta_divine_helm',
    nameJa: '神獣兵装・ルッタ',
    nameEn: 'Vah Ruta Divine Helm',
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'ancient_resist',
    effectLevel: 1,
    setBonus: 'ancient_proficiency',
    baseColor: '#426c8e',
    accentColor: '#36c9f5',
    dyeable: false,
    ancientSetCompatible: true,
    showsEnemyHp: true,
    dlcTag: 'amiibo',
    description: '水の神獣ヴァ・ルッタを模した古代兜。古代耐性・敵HP表示・泳ぎ速度アップを備え、古代兵装とセットボーナスが発動する。',
  },
  {
    id: 'vah_rudania_divine_helm',
    nameJa: '神獣兵装・ルーダニア',
    nameEn: 'Vah Rudania Divine Helm',
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'ancient_resist',
    effectLevel: 1,
    setBonus: 'ancient_proficiency',
    baseColor: '#8a4c32',
    accentColor: '#f27c36',
    dyeable: false,
    ancientSetCompatible: true,
    showsEnemyHp: true,
    dlcTag: 'amiibo',
    description: '炎の神獣ヴァ・ルーダニアを模した古代兜。古代耐性・敵HP表示・炎ガードを備え、古代兵装とセットボーナスが発動する。',
  },
  {
    id: 'vah_medoh_divine_helm',
    nameJa: '神獣兵装・メドー',
    nameEn: 'Vah Medoh Divine Helm',
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'ancient_resist',
    effectLevel: 1,
    setBonus: 'ancient_proficiency',
    baseColor: '#5c6e7a',
    accentColor: '#72dcf5',
    dyeable: false,
    ancientSetCompatible: true,
    showsEnemyHp: true,
    dlcTag: 'amiibo',
    description: '風の神獣ヴァ・メドーを模した古代兜。古代耐性・敵HP表示・寒さガードを備え、古代兵装とセットボーナスが発動する。',
  },
  {
    id: 'vah_naboris_divine_helm',
    nameJa: '神獣兵装・ナボリス',
    nameEn: 'Vah Naboris Divine Helm',
    slot: 'head',
    setId: null,
    upgradeable: true,
    defenseByStar: DEF_4_28,
    effect: 'ancient_resist',
    effectLevel: 1,
    setBonus: 'ancient_proficiency',
    baseColor: '#8d6e3e',
    accentColor: '#f2d44c',
    dyeable: false,
    ancientSetCompatible: true,
    showsEnemyHp: true,
    dlcTag: 'amiibo',
    description: '雷の神獣ヴァ・ナボリスを模した古代兜。古代耐性・敵HP表示・エレキガードを備え、古代兵装とセットボーナスが発動する。',
  },

  // Monster Masks & DLC Headpieces (non-upgradeable)
  {
    id: 'bokoblin_mask',
    nameJa: 'ボコブリンマスク',
    nameEn: 'Bokoblin Mask',
    slot: 'head',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(3),
    effect: 'bokoblin_disguise',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#b8463e',
    accentColor: '#d9b88a',
    dyeable: false,
    dlcTag: 'base',
    description: 'キルトンお手製の魔物マスク。被るとボコブリンに仲間だと思われやすくなる。',
  },
  {
    id: 'moblin_mask',
    nameJa: 'モリブリンマスク',
    nameEn: 'Moblin Mask',
    slot: 'head',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(3),
    effect: 'moblin_disguise',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#a65044',
    accentColor: '#d9c298',
    dyeable: false,
    dlcTag: 'base',
    description: 'キルトンが精巧に再現したモリブリン用マスク。モリブリンに気づかれにくくなる。',
  },
  {
    id: 'lizalfos_mask',
    nameJa: 'リザルフォスマスク',
    nameEn: 'Lizalfos Mask',
    slot: 'head',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(3),
    effect: 'lizalfos_disguise',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#4c8a56',
    accentColor: '#d4b848',
    dyeable: false,
    dlcTag: 'base',
    description: '大きな瞳と角を模したマスク。リザルフォスの群れに紛れ込むことができる。',
  },
  {
    id: 'lynel_mask',
    nameJa: 'ライネルマスク',
    nameEn: 'Lynel Mask',
    slot: 'head',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(3),
    effect: 'lynel_disguise',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#7a3c2c',
    accentColor: '#d9c69a',
    dyeable: false,
    dlcTag: 'base',
    description: '百獣の王ライネルを模した迫力のマスク。短時間ならライネルの警戒を欺ける。',
  },
  {
    id: 'thunder_helm',
    nameJa: '雷鳴の兜',
    nameEn: 'Thunder Helm',
    slot: 'head',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(3),
    effect: 'lightning_proof',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#d9b246',
    accentColor: '#36c9c2',
    dyeable: false,
    gerudoEntryCompatible: true,
    dlcTag: 'base',
    description: 'ゲルド族に代々受け継がれる秘宝。あらゆる落雷と電撃を完全に無効化し、淑女服と合わせて入城も認められる。',
  },
  {
    id: 'korok_mask',
    nameJa: 'コログのお面',
    nameEn: 'Korok Mask',
    slot: 'head',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(1),
    effect: 'korok_detect',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#5c9442',
    accentColor: '#a67642',
    dyeable: false,
    dlcTag: 'dlc1',
    description: '森の妖精コログの顔を模したお面。隠れたコログが近くにいると揺れて知らせてくれる。',
  },
  {
    id: 'majoras_mask',
    nameJa: 'ムジュラの仮面',
    nameEn: "Majora's Mask",
    slot: 'head',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(1),
    effect: 'majora_disguise',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#7a2c8a',
    accentColor: '#e8b62c',
    dyeable: false,
    dlcTag: 'dlc1',
    description: '古代の祭祀に使われた禍々しい仮面。様々な魔物から襲われにくくなる魔力を秘める。',
  },
  {
    id: 'midnas_helmet',
    nameJa: 'ミドナの冠',
    nameEn: "Midna's Helmet",
    slot: 'head',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(7),
    effect: 'ancient_resist',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#484a52',
    accentColor: '#36d9b8',
    dyeable: false,
    dlcTag: 'dlc1',
    description: '黄昏の姫が被っていたとされる冠。高い防御力と古代兵器耐性を発揮する。',
  },
  {
    id: 'ravios_hood',
    nameJa: 'ラヴィオの頭巾',
    nameEn: "Ravio's Hood",
    slot: 'head',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(2),
    effect: 'climb_lateral',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#6d3c8a',
    accentColor: '#d9b44a',
    dyeable: false,
    dlcTag: 'dlc2',
    description: 'ウサギ耳のついた旅商人の頭巾。壁に張り付いた際の横移動スピードが大きく向上する。',
  },
  {
    id: 'zants_helmet',
    nameJa: 'ザントの兜',
    nameEn: "Zant's Helmet",
    slot: 'head',
    setId: null,
    upgradeable: false,
    defenseByStar: fixedDef(3),
    effect: 'unfreezable',
    effectLevel: 1,
    setBonus: 'none',
    baseColor: '#3a3e48',
    accentColor: '#42c4b8',
    dyeable: false,
    dlcTag: 'dlc2',
    description: '影の世界の僭王が被った異形の兜。装備中は凍結状態を完全に無効化する。',
  },
];

export const ARMOR_MAP: Record<string, ArmorPiece> = Object.fromEntries(
  ARMOR_PIECES.map((piece) => [piece.id, piece]),
);

export interface GreatFairyUpgradeCost {
  targetStar: 1 | 2 | 3 | 4;
  fairiesRequired: 1 | 2 | 3 | 4;
  fountainUnlockRupees: number;
  rupees: number;
  materials: Array<{ materialId: string; count: number }>;
}

/**
 * Great Fairy Fountain upgrade requirements for enhancing upgradeable armor pieces from 0★ up to 4★.
 * Includes authentic fountain unlock rupee thresholds (100 / 500 / 1,000 / 10,000) and per-tier upgrade costs.
 */
export const GREAT_FAIRY_UPGRADE_COSTS: Record<1 | 2 | 3 | 4, GreatFairyUpgradeCost> = {
  1: {
    targetStar: 1,
    fairiesRequired: 1,
    fountainUnlockRupees: 100,
    rupees: 50,
    materials: [
      { materialId: 'bokoblin_horn', count: 3 },
      { materialId: 'amber', count: 1 },
    ],
  },
  2: {
    targetStar: 2,
    fairiesRequired: 2,
    fountainUnlockRupees: 500,
    rupees: 150,
    materials: [
      { materialId: 'bokoblin_fang', count: 5 },
      { materialId: 'opal', count: 2 },
    ],
  },
  3: {
    targetStar: 3,
    fairiesRequired: 3,
    fountainUnlockRupees: 1000,
    rupees: 400,
    materials: [
      { materialId: 'ancient_gear', count: 3 },
      { materialId: 'ruby', count: 2 },
      { materialId: 'sapphire', count: 2 },
    ],
  },
  4: {
    targetStar: 4,
    fairiesRequired: 4,
    fountainUnlockRupees: 10000,
    rupees: 1000,
    materials: [
      { materialId: 'lynel_guts', count: 2 },
      { materialId: 'diamond', count: 2 },
      { materialId: 'star_fragment', count: 1 },
    ],
  },
};

export interface EquippedArmorSlots {
  head: string | null;
  body: string | null;
  legs: string | null;
}

export interface ArmorSummary {
  totalDefense: number;
  activeSetBonus: SetBonusType;
  isNaked: boolean;
  hasGerudoEntry: boolean;
  triggersNpcFear: boolean;
  showsEnemyHp: boolean;
  coldResist: number;
  heatResist: number;
  flameGuard: number;
  shockResist: number;
  lightningProof: boolean;
  fireproof: boolean;
  unfreezable: boolean;
  attackUpLevel: 0 | 1 | 2 | 3;
  stealthLevel: 0 | 1 | 2 | 3;
  climbSpeedLevel: number;
  swimSpeedLevel: number;
  ancientProficiency: boolean;
  boneProficiency: boolean;
  masterSwordBeamUp: boolean;
  korokDetect: boolean;
  disguises: string[];
  nightSpeedUp: boolean;
  sandSpeedUp: boolean;
  snowSpeedUp: boolean;
  // Additional mechanical flags derived from equipped pieces
  ancientResistLevel: number;
  canSpinAttackSwim: boolean;
  canWaterfallClimb: boolean;
  climbLateralSpeedUp: boolean;
  raftSpeedUp: boolean;
  nightGlow: boolean;
  shockProof: boolean;
}

/**
 * Returns the defense value of an armor piece at a given upgrade star rank (0..4).
 */
export function getPieceDefense(pieceId: string, stars: number): number {
  const piece = ARMOR_MAP[pieceId];
  if (!piece) return 0;
  if (!piece.upgradeable) return piece.defenseByStar[0];
  const clamped = Math.max(0, Math.min(4, Math.floor(Number.isFinite(stars) ? stars : 0)));
  return piece.defenseByStar[clamped];
}

function getStarRank(piece: ArmorPiece, armorStars: Record<string, number>): number {
  if (!piece.upgradeable) return 0;
  const raw = armorStars[piece.id] ?? 0;
  return Math.max(0, Math.min(4, Math.floor(Number.isFinite(raw) ? raw : 0)));
}

function clampLevel3(value: number): 0 | 1 | 2 | 3 {
  if (value <= 0) return 0;
  if (value === 1) return 1;
  if (value === 2) return 2;
  return 3;
}

/**
 * Computes full defensive, elemental, stealth, disguise, Gerudo entry, and set bonus effects
 * for the currently equipped head/body/legs armor slots.
 */
export function computeArmorSummary(
  equipped: EquippedArmorSlots,
  armorStars: Record<string, number> = {},
): ArmorSummary {
  const headPiece = equipped.head ? ARMOR_MAP[equipped.head] ?? null : null;
  const bodyPiece = equipped.body ? ARMOR_MAP[equipped.body] ?? null : null;
  const legsPiece = equipped.legs ? ARMOR_MAP[equipped.legs] ?? null : null;

  const pieces: ArmorPiece[] = [headPiece, bodyPiece, legsPiece].filter(
    (piece): piece is ArmorPiece => piece !== null,
  );

  const isNaked = pieces.length === 0;
  const totalDefense = pieces.reduce(
    (sum, piece) => sum + getPieceDefense(piece.id, armorStars[piece.id] ?? 0),
    0,
  );

  // Determine active set bonus
  let activeSetBonus: SetBonusType = 'none';
  if (headPiece && bodyPiece && legsPiece) {
    const allAncientCompatible =
      Boolean(headPiece.ancientSetCompatible) &&
      Boolean(bodyPiece.ancientSetCompatible) &&
      Boolean(legsPiece.ancientSetCompatible);

    if (allAncientCompatible) {
      if (
        getStarRank(headPiece, armorStars) >= 2 &&
        getStarRank(bodyPiece, armorStars) >= 2 &&
        getStarRank(legsPiece, armorStars) >= 2
      ) {
        activeSetBonus = 'ancient_proficiency';
      }
    } else if (
      headPiece.setId !== null &&
      headPiece.setId === bodyPiece.setId &&
      bodyPiece.setId === legsPiece.setId &&
      headPiece.setBonus !== 'none'
    ) {
      const requiresUpgrade =
        headPiece.upgradeable || bodyPiece.upgradeable || legsPiece.upgradeable;
      if (!requiresUpgrade) {
        activeSetBonus = headPiece.setBonus;
      } else if (
        getStarRank(headPiece, armorStars) >= 2 &&
        getStarRank(bodyPiece, armorStars) >= 2 &&
        getStarRank(legsPiece, armorStars) >= 2
      ) {
        activeSetBonus = headPiece.setBonus;
      }
    }
  }

  // Gerudo Town entry check:
  // Full Gerudo Vai set, OR Gerudo Veil + Top + Sand/Snow Boots, OR Thunder Helm + Gerudo Top + Gerudo Sirwal (or Sand/Snow Boots)
  const hasGerudoEntry = Boolean(
    headPiece &&
      bodyPiece &&
      legsPiece &&
      (headPiece.gerudoEntryPiece || headPiece.gerudoEntryCompatible) &&
      bodyPiece.gerudoEntryPiece &&
      (legsPiece.gerudoEntryPiece || legsPiece.gerudoEntryCompatible),
  );

  const triggersNpcFear = pieces.some((piece) => Boolean(piece.triggersNpcFear));
  const showsEnemyHp = pieces.some(
    (piece) => Boolean(piece.showsEnemyHp) || piece.effect === 'champion_hp_view',
  );

  let coldResist = 0;
  let heatResist = 0;
  let flameGuard = 0;
  let shockResist = 0;
  let attackUpRaw = 0;
  let stealthRaw = 0;
  let climbSpeedLevel = 0;
  let swimSpeedLevel = 0;
  let ancientResistLevel = 0;

  let lightningProof = activeSetBonus === 'lightning_proof';
  const fireproof = activeSetBonus === 'fireproof';
  let unfreezable = activeSetBonus === 'unfreezable';
  let korokDetect = false;
  let sandSpeedUp = false;
  let snowSpeedUp = false;
  let canSpinAttackSwim = false;
  let canWaterfallClimb = false;
  let climbLateralSpeedUp = false;
  let raftSpeedUp = false;
  let nightGlow = false;

  const disguiseSet = new Set<string>();

  for (const piece of pieces) {
    switch (piece.effect) {
      case 'cold_resist':
        coldResist += piece.effectLevel;
        break;
      case 'heat_resist':
        heatResist += piece.effectLevel;
        break;
      case 'flame_guard':
        flameGuard += piece.effectLevel;
        break;
      case 'shock_resist':
        shockResist += piece.effectLevel;
        break;
      case 'attack_up':
        attackUpRaw += piece.effectLevel;
        break;
      case 'stealth':
        stealthRaw += piece.effectLevel;
        break;
      case 'climb_speed':
        climbSpeedLevel += piece.effectLevel;
        break;
      case 'swim_speed':
        swimSpeedLevel += piece.effectLevel;
        break;
      case 'spin_attack_swim':
        canSpinAttackSwim = true;
        swimSpeedLevel += piece.effectLevel;
        break;
      case 'waterfall_climb':
        canWaterfallClimb = true;
        swimSpeedLevel += piece.effectLevel;
        break;
      case 'ancient_resist':
      case 'guardian_resist':
        ancientResistLevel += piece.effectLevel;
        break;
      case 'lightning_proof':
        lightningProof = true;
        break;
      case 'unfreezable':
        unfreezable = true;
        break;
      case 'korok_detect':
        korokDetect = true;
        break;
      case 'sand_speed':
        sandSpeedUp = true;
        break;
      case 'snow_speed':
        snowSpeedUp = true;
        break;
      case 'climb_lateral':
        climbLateralSpeedUp = true;
        break;
      case 'raft_speed':
        raftSpeedUp = true;
        break;
      case 'night_glow':
        nightGlow = true;
        break;
      case 'bokoblin_disguise':
        disguiseSet.add('bokoblin');
        break;
      case 'moblin_disguise':
        disguiseSet.add('moblin');
        break;
      case 'lizalfos_disguise':
        disguiseSet.add('lizalfos');
        break;
      case 'lynel_disguise':
        disguiseSet.add('lynel');
        break;
      case 'majora_disguise':
        disguiseSet.add('bokoblin');
        disguiseSet.add('moblin');
        disguiseSet.add('lizalfos');
        disguiseSet.add('lynel');
        disguiseSet.add('stal');
        break;
      case 'champion_hp_view':
      case 'none':
        break;
    }

    // Authentic secondary perks for Divine Beast Helms and Island Lobster Shirt
    if (piece.id === 'vah_ruta_divine_helm') {
      swimSpeedLevel += 1;
    } else if (piece.id === 'vah_rudania_divine_helm') {
      flameGuard += 1;
    } else if (piece.id === 'vah_medoh_divine_helm') {
      coldResist += 1;
    } else if (piece.id === 'vah_naboris_divine_helm') {
      shockResist += 1;
    } else if (piece.id === 'island_lobster_shirt') {
      raftSpeedUp = true;
    }
  }

  // Apply set-bonus derived resistances and disguises
  if (activeSetBonus === 'gerudo_vai_heat') {
    heatResist += 1;
  }
  const shockProof = activeSetBonus === 'shock_proof';
  if (shockProof) {
    shockResist += 1;
  }

  const ancientProficiency = activeSetBonus === 'ancient_proficiency';
  const boneProficiency =
    activeSetBonus === 'bone_proficiency_disguise' ||
    activeSetBonus === 'stealth_bone_disguise';
  const masterSwordBeamUp = activeSetBonus === 'master_sword_beam_up';
  const nightSpeedUp = activeSetBonus === 'night_speed';

  if (boneProficiency) {
    disguiseSet.add('stal');
  }

  return {
    totalDefense,
    activeSetBonus,
    isNaked,
    hasGerudoEntry,
    triggersNpcFear,
    showsEnemyHp,
    coldResist: Math.min(2, coldResist),
    heatResist: Math.min(2, heatResist),
    flameGuard: Math.min(2, flameGuard),
    shockResist: Math.min(3, shockResist),
    lightningProof,
    fireproof,
    unfreezable,
    attackUpLevel: clampLevel3(attackUpRaw),
    stealthLevel: clampLevel3(stealthRaw),
    climbSpeedLevel: Math.min(3, climbSpeedLevel),
    swimSpeedLevel: Math.min(3, swimSpeedLevel),
    ancientProficiency,
    boneProficiency,
    masterSwordBeamUp,
    korokDetect,
    disguises: Array.from(disguiseSet),
    nightSpeedUp,
    sandSpeedUp,
    snowSpeedUp,
    ancientResistLevel: Math.min(3, ancientResistLevel),
    canSpinAttackSwim,
    canWaterfallClimb,
    climbLateralSpeedUp,
    raftSpeedUp,
    nightGlow,
    shockProof,
  };
}
