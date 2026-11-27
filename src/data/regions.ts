import type { RegionDef, RegionId } from '../types/botw';

/**
 * Seamless 3200m x 2600m Hyrule World Coordinate System (X: -1600..1600, Z: -1300..1300).
 * North = -Z, South = +Z, West = -X, East = +X.
 * Displays authentic BotW altitude via 3.33x scale factor so peak hierarchy holds strictly:
 *   1. Gerudo Summit (~240m world = 800m displayed)
 *   2. Hebra Peak    (~225m world = 750m displayed)
 *   3. Death Mountain(~210m world = 700m displayed)
 */
export const WORLD_BOUNDS = {
  minX: -1600,
  maxX: 1600,
  minZ: -1300,
  maxZ: 1300,
  altitudeDisplayScale: 3.3333,
  waterLevel: 4.5,
} as const;

export const REGIONS: Record<RegionId, RegionDef> = {
  great_plateau: {
    id: 'great_plateau',
    nameJa: '始まりの台地',
    nameEn: 'Great Plateau',
    climate: 'temperate',
    center: { x: -240, z: 460 },
    radius: 260,
    towerPos: { x: -190, z: 380 },
    baseElevation: 38,
    peakElevation: 76,
    dayTempC: 18,
    nightTempC: 7,
    weatherWeights: { sunny: 0.56, cloudy: 0.22, rain: 0.14, thunderstorm: 0.04, sunshower: 0.04 },
    grassColor: '#69a844',
    cliffColor: '#8d8373',
    accentColor: '#d9c474',
    description: 'ハイラル王国発祥の聖地。回生の祠・時の神殿跡・マウントハイリアを擁する高台。',
  },
  central_hyrule: {
    id: 'central_hyrule',
    nameJa: '中央ハイラル',
    nameEn: 'Central Hyrule',
    climate: 'temperate',
    center: { x: -120, z: -40 },
    radius: 360,
    towerPos: { x: -340, z: 120 },
    baseElevation: 12,
    peakElevation: 62,
    dayTempC: 20,
    nightTempC: 10,
    weatherWeights: { sunny: 0.52, cloudy: 0.24, rain: 0.16, thunderstorm: 0.06, sunshower: 0.02 },
    grassColor: '#5c9c3d',
    cliffColor: '#7d776f',
    accentColor: '#c9b468',
    description: 'ハイラル城と城下町跡を囲む大平原。厄災の怨念とガーディアンが徘徊する。',
  },
  dueling_peaks: {
    id: 'dueling_peaks',
    nameJa: '双子山',
    nameEn: 'Dueling Peaks',
    climate: 'temperate',
    center: { x: 260, z: 440 },
    radius: 300,
    towerPos: { x: 220, z: 470 },
    baseElevation: 16,
    peakElevation: 145,
    dayTempC: 19,
    nightTempC: 8,
    weatherWeights: { sunny: 0.48, cloudy: 0.24, rain: 0.20, thunderstorm: 0.05, sunshower: 0.03 },
    grassColor: '#5a9b43',
    cliffColor: '#7a7266',
    accentColor: '#e2a85c',
    description: '龍が切り裂いたと伝わる双子山と、カカリコ村へ通じる街道。',
  },
  hateno: {
    id: 'hateno',
    nameJa: 'ハテール地方（ハテノ）',
    nameEn: 'Hateno',
    climate: 'temperate',
    center: { x: 900, z: 540 },
    radius: 360,
    towerPos: { x: 760, z: 450 },
    baseElevation: 20,
    peakElevation: 130,
    dayTempC: 21,
    nightTempC: 11,
    weatherWeights: { sunny: 0.52, cloudy: 0.24, rain: 0.18, thunderstorm: 0.04, sunshower: 0.02 },
    grassColor: '#66a449',
    cliffColor: '#877f74',
    accentColor: '#d49a52',
    description: '厄災の戦火を逃れたハテノ村・古代研究所・ハテノ砦・ウオトリー村が広がる東部の大地。',
  },
  lanayru: {
    id: 'lanayru',
    nameJa: 'ラネール地方',
    nameEn: 'Lanayru',
    climate: 'wetland',
    center: { x: 860, z: -20 },
    radius: 360,
    towerPos: { x: 700, z: -40 },
    baseElevation: 18,
    peakElevation: 175,
    dayTempC: 15,
    nightTempC: 6,
    weatherWeights: { sunny: 0.30, cloudy: 0.25, rain: 0.34, thunderstorm: 0.08, sunshower: 0.03 },
    grassColor: '#4c905c',
    cliffColor: '#667a8a',
    accentColor: '#52c8e8',
    description: 'ゾーラの里とラネール山・知恵の泉を抱く水の聖地。',
  },
  akkala: {
    id: 'akkala',
    nameJa: 'アッカレ地方',
    nameEn: 'Akkala',
    climate: 'autumn',
    center: { x: 1020, z: -640 },
    radius: 360,
    towerPos: { x: 920, z: -460 },
    baseElevation: 28,
    peakElevation: 120,
    dayTempC: 17,
    nightTempC: 8,
    weatherWeights: { sunny: 0.44, cloudy: 0.28, rain: 0.20, thunderstorm: 0.06, sunshower: 0.02 },
    grassColor: '#b36b32',
    cliffColor: '#7a685b',
    accentColor: '#d94d2b',
    description: '紅葉燃ゆる北東の高原。イチカラ村・アッカレ砦跡・アッカレ古代研究所・北東ローメイ迷宮がある。',
  },
  eldin: {
    id: 'eldin',
    nameJa: 'オルディン地方',
    nameEn: 'Eldin',
    climate: 'volcanic',
    center: { x: 520, z: -740 },
    radius: 360,
    towerPos: { x: 560, z: -500 },
    baseElevation: 55,
    peakElevation: 210, // 700m displayed (3rd highest peak)
    dayTempC: 68,
    nightTempC: 56,
    weatherWeights: { volcanic_ash: 0.65, sunny: 0.25, cloudy: 0.10 },
    grassColor: '#584a45',
    cliffColor: '#4c3e3b',
    accentColor: '#ff521b',
    description: '活火山デスマウンテンとゴロンシティを擁する灼熱の溶岩地帯。木製装備は自然発火する。',
  },
  woodland: {
    id: 'woodland',
    nameJa: '大森林',
    nameEn: 'Woodland',
    climate: 'temperate',
    center: { x: 40, z: -640 },
    radius: 320,
    towerPos: { x: 120, z: -430 },
    baseElevation: 24,
    peakElevation: 112,
    dayTempC: 16,
    nightTempC: 8,
    weatherWeights: { sunny: 0.42, cloudy: 0.34, rain: 0.18, thunderstorm: 0.04, sunshower: 0.02 },
    grassColor: '#3d7d3f',
    cliffColor: '#696c62',
    accentColor: '#90e072',
    description: '迷いの森とコログの森（デクの樹・マスターソードの台座）、ドイブラン遺跡が広がる神秘の森林。',
  },
  ridgeland: {
    id: 'ridgeland',
    nameJa: '丘陵地方',
    nameEn: 'Ridgeland',
    climate: 'temperate',
    center: { x: -640, z: -180 },
    radius: 310,
    towerPos: { x: -620, z: -140 },
    baseElevation: 22,
    peakElevation: 118,
    dayTempC: 18,
    nightTempC: 9,
    weatherWeights: { sunny: 0.40, cloudy: 0.24, rain: 0.22, thunderstorm: 0.12, sunshower: 0.02 },
    grassColor: '#649844',
    cliffColor: '#817768',
    accentColor: '#c9a954',
    description: 'サトリ山・雷の台地・タバンタ大橋へ続く起伏豊かな丘陵。',
  },
  tabantha: {
    id: 'tabantha',
    nameJa: 'タバンタ地方',
    nameEn: 'Tabantha',
    climate: 'highland_cold',
    center: { x: -1020, z: -340 },
    radius: 310,
    towerPos: { x: -940, z: -240 },
    baseElevation: 42,
    peakElevation: 138,
    dayTempC: 6,
    nightTempC: -6,
    weatherWeights: { sunny: 0.45, cloudy: 0.28, snow: 0.18, rain: 0.09 },
    grassColor: '#7b9956',
    cliffColor: '#8d7d6c',
    accentColor: '#e0ecf5',
    description: 'トトリ湖中央の岩柱に築かれたリトの村とタバンタ大雪原の入口。',
  },
  hebra: {
    id: 'hebra',
    nameJa: 'ヘブラ地方',
    nameEn: 'Hebra',
    climate: 'extreme_cold',
    center: { x: -860, z: -840 },
    radius: 420,
    towerPos: { x: -780, z: -690 },
    baseElevation: 82,
    peakElevation: 225, // 750m displayed (2nd highest peak)
    dayTempC: -14,
    nightTempC: -42,
    weatherWeights: { snow: 0.44, blizzard: 0.28, cloudy: 0.18, sunny: 0.10 },
    grassColor: '#d2e2f2',
    cliffColor: '#68758a',
    accentColor: '#a6dcff',
    description: '極寒の万年雪に覆われた北西の峻峰。忘れられた神殿と北ローメイ迷宮が眠る。',
  },
  gerudo_highlands: {
    id: 'gerudo_highlands',
    nameJa: 'ゲルド高地',
    nameEn: 'Gerudo Highlands',
    climate: 'extreme_cold',
    center: { x: -1060, z: 240 },
    radius: 340,
    towerPos: { x: -980, z: 260 },
    baseElevation: 88,
    peakElevation: 240, // 800m displayed (1st highest peak in Hyrule!)
    dayTempC: -18,
    nightTempC: -63,
    weatherWeights: { snow: 0.48, blizzard: 0.26, cloudy: 0.16, sunny: 0.10 },
    grassColor: '#d8e6f4',
    cliffColor: '#8f6b56',
    accentColor: '#b3deff',
    description: 'ハイラル最高峰ゲルド山頂（800m）とイーガ団のアジト・八人目の英雄像を擁する極寒の高地。',
  },
  wasteland: {
    id: 'wasteland',
    nameJa: 'ゲルド砂漠（荒野）',
    nameEn: 'Wasteland',
    climate: 'desert',
    center: { x: -960, z: 780 },
    radius: 420,
    towerPos: { x: -640, z: 660 },
    baseElevation: 14,
    peakElevation: 68,
    dayTempC: 48,
    nightTempC: -6,
    weatherWeights: { sunny: 0.72, sandstorm: 0.22, cloudy: 0.06 }, // 0% rainfall strictly per BotW spec!
    grassColor: '#d8b26e',
    cliffColor: '#b57b4a',
    accentColor: '#f5d284',
    description: '降雨ゼロの灼熱砂漠。昼は猛暑、夜は極寒。ゲルドの街・カラカラバザール・七人の英雄が佇む。',
  },
  lake: {
    id: 'lake',
    nameJa: '湖の塔周辺（ハイリア湖）',
    nameEn: 'Lake',
    climate: 'temperate',
    center: { x: -100, z: 860 },
    radius: 300,
    towerPos: { x: -20, z: 840 },
    baseElevation: 8,
    peakElevation: 72,
    dayTempC: 21,
    nightTempC: 11,
    weatherWeights: { sunny: 0.46, cloudy: 0.24, rain: 0.22, thunderstorm: 0.05, sunshower: 0.03 },
    grassColor: '#589c4a',
    cliffColor: '#7a756c',
    accentColor: '#48b0d8',
    description: 'ハイリア大橋が架かる広大なハイリア湖と高原の馬宿周辺。',
  },
  faron: {
    id: 'faron',
    nameJa: 'フィローネ地方',
    nameEn: 'Faron',
    climate: 'tropical',
    center: { x: 460, z: 900 },
    radius: 360,
    towerPos: { x: 440, z: 840 },
    baseElevation: 16,
    peakElevation: 105,
    dayTempC: 27,
    nightTempC: 20,
    weatherWeights: { sunny: 0.30, rain: 0.36, thunderstorm: 0.24, cloudy: 0.06, sunshower: 0.04 },
    grassColor: '#2f8a42',
    cliffColor: '#5d6b58',
    accentColor: '#54d474',
    description: '雷雨多発の熱帯ジャングルとゾナウ遺跡、勇気の泉、ウオトリー湾岸地帯。',
  },
};

export const REGION_LIST: RegionDef[] = Object.values(REGIONS);

export interface LandmarkDef {
  id: string;
  nameJa: string;
  type:
    | 'castle'
    | 'settlement'
    | 'stable'
    | 'divine_beast'
    | 'great_fairy'
    | 'spring'
    | 'ruin'
    | 'labyrinth'
    | 'lab'
    | 'resurrection'
    | 'temple_of_time';
  region: RegionId;
  x: number;
  z: number;
  radius: number;
  style: string;
  description: string;
}

export const LANDMARKS: LandmarkDef[] = [
  // Great Plateau iconic start
  { id: 'shrine_of_resurrection', nameJa: '回生の祠', type: 'resurrection', region: 'great_plateau', x: -305, z: 455, radius: 18, style: 'sheikah', description: '100年の眠りからリンクが覚醒した古代シーカー施設。地下に英傑たちの詩・最終試練が眠る。' },
  { id: 'temple_of_time', nameJa: '時の神殿跡', type: 'temple_of_time', region: 'great_plateau', x: -245, z: 495, radius: 34, style: 'hylian_ruin', description: '始まりの台地中央の聖なる神殿跡。女神像とハイラル王ロームの霊が待つ。' },

  // Hyrule Castle
  { id: 'hyrule_castle', nameJa: 'ハイラル城', type: 'castle', region: 'central_hyrule', x: -80, z: -260, radius: 120, style: 'hyrule_castle', description: '西洋尖塔×日本城郭の5段階防衛縄張りと5本の怨念巨柱。本丸でゼルダが100年間厄災ガノンを抑え続けている。' },

  // All 9 Architectural Settlements
  { id: 'kakariko_village', nameJa: 'カカリコ村', type: 'settlement', region: 'dueling_peaks', x: 430, z: 260, radius: 75, style: 'kakariko', description: 'シーカー族の隠れ里。段々畑・千木鰹木・鳥居連作・インパ屋敷と大妖精クチューラの泉。' },
  { id: 'hateno_village', nameJa: 'ハテノ村', type: 'settlement', region: 'hateno', x: 960, z: 580, radius: 85, style: 'hateno', description: '南欧田園風の石積と布帆風車。マイホーム・染色屋東風屋・ハテノ古代研究所がある。' },
  { id: 'zoras_domain', nameJa: 'ゾーラの里', type: 'settlement', region: 'lanayru', x: 960, z: -130, radius: 85, style: 'zora', description: '夜光石×青石材×銀細工のアール・ヌーヴォー流線型宮殿と7連ダム。' },
  { id: 'goron_city', nameJa: 'ゴロンシティ', type: 'settlement', region: 'eldin', x: 450, z: -760, radius: 80, style: 'goron', description: '活溶岩上の2層火山岩ドームと重鉄骨梁・トロッコ軌道。' },
  { id: 'rito_village', nameJa: 'リトの村', type: 'settlement', region: 'tabantha', x: -1080, z: -420, radius: 72, style: 'rito', description: 'トトリ湖中央岩柱の垂直螺旋木道と鉄鎖懸架籠ハウス・離着陸台。' },
  { id: 'gerudo_town', nameJa: 'ゲルドの街', type: 'settlement', region: 'wasteland', x: -1060, z: 860, radius: 85, style: 'gerudo', description: '日干し煉瓦と屋上水路の気化冷却空調。男子禁制（淑女装備で入城可）。' },
  { id: 'lurelin_village', nameJa: 'ウオトリー村', type: 'settlement', region: 'faron', x: 840, z: 980, radius: 72, style: 'lurelin', description: '高床式＆生きたヤシ中心柱住宅と船型宿屋の南国漁村。' },
  { id: 'tarrey_town', nameJa: 'イチカラ村', type: 'settlement', region: 'akkala', x: 1090, z: -460, radius: 68, style: 'tarrey', description: 'サクラダ工務店の正六角形モジュラープレハブ建築とルピー型池の新開拓村。' },
  { id: 'korok_forest', nameJa: 'コログの森', type: 'settlement', region: 'woodland', x: 60, z: -690, radius: 78, style: 'korok', description: 'デクの樹サマとマスターソードの台座が鎮座する迷いの森の中心。' },

  // 4 Kinematic Divine Beasts
  { id: 'vah_ruta', nameJa: '神獣 ヴァ・ルッタ', type: 'divine_beast', region: 'lanayru', x: 1120, z: -180, radius: 48, style: 'vah_ruta', description: 'ゾーラの里東の東貯水湖に鎮座する象型神獣（鼻昇降＆水車可動）。' },
  { id: 'vah_rudania', nameJa: '神獣 ヴァ・ルーダニア', type: 'divine_beast', region: 'eldin', x: 560, z: -870, radius: 48, style: 'vah_rudania', description: 'デスマウンテン火口縁を這うトカゲ型神獣（胴体90度横倒し機構）。' },
  { id: 'vah_medoh', nameJa: '神獣 ヴァ・メドー', type: 'divine_beast', region: 'tabantha', x: -1080, z: -500, radius: 48, style: 'vah_medoh', description: 'リトの村上空を旋回する鳥型神獣（両翼シーソー傾斜＆気流）。' },
  { id: 'vah_naboris', nameJa: '神獣 ヴァ・ナボリス', type: 'divine_beast', region: 'wasteland', x: -890, z: 980, radius: 48, style: 'vah_naboris', description: 'ゲルド砂漠南方を闊歩するラクダ型神獣（中央3連円筒回転＆送電回路）。' },

  // 2 Ancient Tech Labs
  { id: 'hateno_tech_lab', nameJa: 'ハテノ古代研究所', type: 'lab', region: 'hateno', x: 1120, z: 540, radius: 26, style: 'tech_lab', description: 'プルアがシーカーストーン強化（バクダン＋・ビタロック＋・センサー＋）を行う研究所。' },
  { id: 'akkala_tech_lab', nameJa: 'アッカレ古代研究所', type: 'lab', region: 'akkala', x: 1290, z: -960, radius: 26, style: 'tech_lab', description: 'ロベリーとチェリーが古代兵装を製作する北東岬の研究所。' },

  // 4 Great Fairy Fountains
  { id: 'fairy_cotera', nameJa: '大妖精クチューラの泉', type: 'great_fairy', region: 'dueling_peaks', x: 510, z: 210, radius: 22, style: 'fairy_fountain', description: 'カカリコ村東の森に佇む大妖精の泉（防具強化★1〜★4解放）。' },
  { id: 'fairy_kaysa', nameJa: '大妖精シーザの泉', type: 'great_fairy', region: 'tabantha', x: -910, z: -170, radius: 22, style: 'fairy_fountain', description: 'タバンタの塔南の大妖精の泉。' },
  { id: 'fairy_mija', nameJa: '大妖精ミジャーの泉', type: 'great_fairy', region: 'akkala', x: 1160, z: -380, radius: 22, style: 'fairy_fountain', description: 'イチカラ村対岸の大妖精の泉。' },
  { id: 'fairy_tera', nameJa: '大妖精テーラの泉', type: 'great_fairy', region: 'wasteland', x: -1350, z: 1020, radius: 22, style: 'fairy_fountain', description: 'ゲルド大化石に眠る大妖精の泉。' },

  // 3 Goddess Springs
  { id: 'spring_of_wisdom', nameJa: '知恵の泉', type: 'spring', region: 'lanayru', x: 1110, z: 320, radius: 26, style: 'goddess_spring', description: 'ラネール山頂の氷結泉。ネルドラの解放とゼルダ17歳の記憶の地。' },
  { id: 'spring_of_power', nameJa: '力の泉', type: 'spring', region: 'akkala', x: 930, z: -720, radius: 26, style: 'goddess_spring', description: 'オルドラのウロコを捧げるアッカレの聖泉。' },
  { id: 'spring_of_courage', nameJa: '勇気の泉', type: 'spring', region: 'faron', x: 350, z: 760, radius: 26, style: 'goddess_spring', description: 'フロドラのウロコを捧げるゾナウ遺跡奥の龍頭泉。' },

  // Historical Ruins & 3 Lomei Labyrinths & Forgotten Temple
  { id: 'fort_hateno', nameJa: 'ハテノ砦 ＆ 灰の沼', type: 'ruin', region: 'hateno', x: 640, z: 550, radius: 42, style: 'fort_ruin', description: '100年前、ゼルダの封印の力が覚醒しガーディアン群を停止させた「ハテノ砦の奇跡」の舞台。' },
  { id: 'akkala_citadel', nameJa: 'アッカレ砦跡', type: 'ruin', region: 'akkala', x: 920, z: -420, radius: 50, style: 'fort_ruin', description: '大厄災でハイラル王国軍残党が最終抗戦を行った難攻不落の要塞跡。' },
  { id: 'forgotten_temple', nameJa: '忘れられた神殿', type: 'ruin', region: 'hebra', x: -490, z: -690, radius: 44, style: 'forgotten_temple', description: 'タバンタ谷底の巨大ハイリア女神像を祀る古代神殿（120祠全制覇報酬の場）。' },
  { id: 'lomei_north', nameJa: '北ローメイ城跡', type: 'labyrinth', region: 'hebra', x: -340, z: -1020, radius: 48, style: 'labyrinth', description: 'ヘブラ北東の巨大石造迷宮。' },
  { id: 'lomei_island', nameJa: 'ローメイ島', type: 'labyrinth', region: 'akkala', x: 1380, z: -1080, radius: 48, style: 'labyrinth', description: 'アッカレ北東沖の孤島迷宮。' },
  { id: 'lomei_south', nameJa: '南ローメイ城跡', type: 'labyrinth', region: 'wasteland', x: -560, z: 1040, radius: 48, style: 'labyrinth', description: 'ゲルド砂漠南東の砂嵐迷宮。' },
  { id: 'kara_kara_bazaar', nameJa: 'カラカラバザール', type: 'settlement', region: 'wasteland', x: -820, z: 720, radius: 36, style: 'bazaar', description: '砂漠入口のオアシス。100年前にイーガ団からゼルダを守った記憶の地。' },
  { id: 'yiga_hideout', nameJa: 'イーガ団のアジト', type: 'ruin', region: 'gerudo_highlands', x: -960, z: 460, radius: 40, style: 'yiga', description: 'カルサー谷奥のイーガ団本拠地。雷鳴の兜奪還の舞台。' },
  { id: 'eventide_island', nameJa: 'サイハテノ島', type: 'ruin', region: 'hateno', x: 1420, z: 1020, radius: 60, style: 'tropical_ruin', description: '装備をすべて預けて挑む野生の試練の孤島。' },

  // All 15 Stables (12-bay circus tent + horse-head roof finial)
  { id: 'stable_dueling_peaks', nameJa: '双子馬宿', type: 'stable', region: 'dueling_peaks', x: 460, z: 540, radius: 24, style: 'stable', description: '双子山東口の街道馬宿。' },
  { id: 'stable_riverside', nameJa: 'リバーサイド馬宿', type: 'stable', region: 'central_hyrule', x: 160, z: 240, radius: 24, style: 'stable', description: 'ハイリア川沿いの馬宿。' },
  { id: 'stable_outskirt', nameJa: '平原外れの馬宿', type: 'stable', region: 'central_hyrule', x: -460, z: 270, radius: 24, style: 'stable', description: '始まりの台地北西の平原馬宿。' },
  { id: 'stable_wetland', nameJa: '湿原の馬宿', type: 'stable', region: 'lanayru', x: 350, z: -20, radius: 24, style: 'stable', description: 'ラネール湿原の入口馬宿。' },
  { id: 'stable_woodland', nameJa: '森の馬宿', type: 'stable', region: 'woodland', x: 240, z: -430, radius: 24, style: 'stable', description: 'オルディンと大森林を結ぶ馬宿。' },
  { id: 'stable_foothill', nameJa: '山麓の馬宿', type: 'stable', region: 'eldin', x: 640, z: -380, radius: 24, style: 'stable', description: 'デスマウンテン登山口。燃えず薬が買える。' },
  { id: 'stable_south_akkala', nameJa: 'ミナッカレ馬宿', type: 'stable', region: 'akkala', x: 960, z: -270, radius: 24, style: 'stable', description: 'アッカレ南部の街道馬宿。' },
  { id: 'stable_east_akkala', nameJa: 'ヒガッカレ馬宿', type: 'stable', region: 'akkala', x: 1210, z: -820, radius: 24, style: 'stable', description: 'アッカレ古代研究所最寄りの馬宿。' },
  { id: 'stable_tabantha_bridge', nameJa: 'タバンタ大橋馬宿', type: 'stable', region: 'ridgeland', x: -820, z: -120, radius: 24, style: 'stable', description: 'タバンタ大橋の東詰馬宿。' },
  { id: 'stable_rito', nameJa: 'リトの馬宿', type: 'stable', region: 'tabantha', x: -970, z: -440, radius: 24, style: 'stable', description: 'リトの村対岸の馬宿。' },
  { id: 'stable_snowfield', nameJa: '雪原の馬宿', type: 'stable', region: 'hebra', x: -530, z: -830, radius: 24, style: 'stable', description: 'タバンタ大雪原の極寒馬宿。' },
  { id: 'stable_serenne', nameJa: 'マリッタ馬宿', type: 'stable', region: 'ridgeland', x: -490, z: -470, radius: 24, style: 'stable', description: 'ククジャ谷入口の馬宿。' },
  { id: 'stable_gerudo_canyon', nameJa: 'ゲルドキャニオン馬宿', type: 'stable', region: 'wasteland', x: -720, z: 540, radius: 24, style: 'stable', description: 'ゲルド砂漠手前の渓谷馬宿。' },
  { id: 'stable_highland', nameJa: '高原の馬宿', type: 'stable', region: 'lake', x: 180, z: 930, radius: 24, style: 'stable', description: 'フィローネ草原の馬宿。' },
  { id: 'stable_lakeside', nameJa: 'レイクサイド馬宿', type: 'stable', region: 'faron', x: 460, z: 980, radius: 24, style: 'stable', description: 'フロリア滝麓の熱帯馬宿。' },
];

export interface ShrineDef {
  id: string;
  nameJa: string;
  region: RegionId;
  x: number;
  z: number;
  category: 'puzzle' | 'blessing' | 'combat_minor' | 'combat_modest' | 'combat_major' | 'dlc2';
  runeTrial?: 'magnesis' | 'bomb' | 'stasis' | 'cryonis' | 'gyro' | 'ballad';
  subtitleJa: string;
}

/**
 * Core physical Shrines rendered in the open world + full 136-shrine registry
 * (71 Puzzle [incl. 5 Gyro], 29 Blessing, 20 Tests of Strength [5 Minor / 6 Modest / 9 Major], 16 DLC 2 Ballad)
 */
const FEATURED_SHRINES: ShrineDef[] = [
  // Great Plateau 4 Rune Shrines
  { id: 'shrine_oman_au', nameJa: 'マ・オーヌの祠', region: 'great_plateau', x: -215, z: 420, category: 'puzzle', runeTrial: 'magnesis', subtitleJa: '磁力の試練（マグネキャッチ）' },
  { id: 'shrine_ja_baij', nameJa: 'ジャ・バシフの祠', region: 'great_plateau', x: -150, z: 490, category: 'puzzle', runeTrial: 'bomb', subtitleJa: '破壊の試練（リモコンバクダン）' },
  { id: 'shrine_owa_daim', nameJa: 'ワ・モダイの祠', region: 'great_plateau', x: -275, z: 555, category: 'puzzle', runeTrial: 'stasis', subtitleJa: '時よ止まれ（ビタロック）' },
  { id: 'shrine_keh_namut', nameJa: 'トゥミ・ンケの祠', region: 'great_plateau', x: -345, z: 525, category: 'puzzle', runeTrial: 'cryonis', subtitleJa: '氷柱の試練（アイスメイカー）' },
  // Iconic Shrines across all 15 Regions
  { id: 'shrine_talo_naeg', nameJa: 'タロ・ニヒの祠', region: 'dueling_peaks', x: 455, z: 235, category: 'combat_minor', subtitleJa: 'タロ・ニヒの教え（回避＆パリィ）' },
  { id: 'shrine_myahm_agana', nameJa: 'ミャマ・ガナの祠', region: 'hateno', x: 930, z: 610, category: 'puzzle', runeTrial: 'gyro', subtitleJa: 'ミャマ・ガナのからくり（ジャイロ迷路）' },
  { id: 'shrine_neez_yohma', nameJa: 'ネヅ・ヨマの祠', region: 'lanayru', x: 945, z: -115, category: 'puzzle', subtitleJa: '押し出す力' },
  { id: 'shrine_shora_hah', nameJa: 'シモ・イトセの祠', region: 'eldin', x: 470, z: -740, category: 'puzzle', subtitleJa: '揺れる炎' },
  { id: 'shrine_akh_vaquot', nameJa: 'アコ・ヴァータの祠', region: 'tabantha', x: -1060, z: -415, category: 'puzzle', subtitleJa: '風車' },
  { id: 'shrine_daqo_chisay', nameJa: 'グコ・チセの祠', region: 'wasteland', x: -1025, z: 840, category: 'puzzle', subtitleJa: '電気の通り道' },
  { id: 'shrine_saasu_kosa', nameJa: 'サス・コサの祠', region: 'central_hyrule', x: -85, z: -340, category: 'combat_major', subtitleJa: '力の試練 極位（ハイラル城船着き場）' },
  { id: 'shrine_dah_hesho', nameJa: 'ダヒ・シーノの祠', region: 'akkala', x: 1050, z: -450, category: 'combat_minor', subtitleJa: '力の試練 序位' },
  { id: 'shrine_keo_ruug', nameJa: 'キヨ・ウーの祠', region: 'woodland', x: 55, z: -675, category: 'puzzle', subtitleJa: '運命の星の数' },
  { id: 'shrine_rona_kachta', nameJa: 'ロナ・カータの祠', region: 'hebra', x: -490, z: -705, category: 'blessing', subtitleJa: 'ロナ・カータの祝福（忘れられた神殿）' },
  { id: 'shrine_mijah_rokee', nameJa: 'ミッダ・ロキの祠', region: 'ridgeland', x: -660, z: -170, category: 'combat_modest', subtitleJa: '力の試練 中位（赤い月の夜）' },
  { id: 'shrine_korgu_chideh', nameJa: 'クグ・チデの祠', region: 'hateno', x: 1435, z: 1030, category: 'blessing', subtitleJa: 'クグ・チデの祝福（サイハテノ島）' },
  { id: 'shrine_yah_rin', nameJa: 'ヤオ・マーヨの祠', region: 'faron', x: 825, z: 965, category: 'puzzle', subtitleJa: '力の重み' },
  { id: 'shrine_kaam_yatak', nameJa: 'カマ・ラヒの祠', region: 'central_hyrule', x: -240, z: 80, category: 'puzzle', subtitleJa: '心の準備' },
  { id: 'shrine_pumaag_nitae', nameJa: 'プマ・ニットの祠', region: 'lake', x: 15, z: 880, category: 'combat_minor', subtitleJa: '力の試練 序位' },
  { id: 'shrine_kema_kosassa', nameJa: 'キハ・ウの祠', region: 'gerudo_highlands', x: -1040, z: 220, category: 'combat_major', subtitleJa: '力の試練 極位' },
  // DLC 2 Champions' Ballad Plateau Shrines
  { id: 'shrine_yowaka_ita', nameJa: 'ヨワカ・イルタの祠', region: 'great_plateau', x: -315, z: 420, category: 'dlc2', runeTrial: 'ballad', subtitleJa: 'EX 一撃の試練・収集' },
  { id: 'shrine_rohta_chigah', nameJa: 'ロヒタ・チグの祠', region: 'great_plateau', x: -280, z: 485, category: 'dlc2', runeTrial: 'ballad', subtitleJa: 'EX 一撃の試練・停止の先に' },
  { id: 'shrine_ruvo_korbah', nameJa: 'ルネ・コリバの祠', region: 'great_plateau', x: -175, z: 455, category: 'dlc2', runeTrial: 'ballad', subtitleJa: 'EX 一撃の試練・極位' },
  { id: 'shrine_etu_kima', nameJa: 'エツ・コリマの祠', region: 'great_plateau', x: -240, z: 545, category: 'dlc2', runeTrial: 'ballad', subtitleJa: 'EX 一撃の試練・光を運ぶ者' },
];

/**
 * Generates the complete deterministic 136-Shrine catalog (120 Base + 16 DLC2)
 * matching exact category proportions: 71 Puzzle, 29 Blessing, 20 Test of Strength (5/6/9), 16 DLC2.
 */
function buildComplete136Shrines(): ShrineDef[] {
  const list: ShrineDef[] = [...FEATURED_SHRINES];
  const regions = Object.keys(REGIONS) as RegionId[];
  const counts = {
    puzzle: 71 - list.filter((s) => s.category === 'puzzle').length,
    blessing: 29 - list.filter((s) => s.category === 'blessing').length,
    combat_minor: 5 - list.filter((s) => s.category === 'combat_minor').length,
    combat_modest: 6 - list.filter((s) => s.category === 'combat_modest').length,
    combat_major: 9 - list.filter((s) => s.category === 'combat_major').length,
    dlc2: 16 - list.filter((s) => s.category === 'dlc2').length,
  };

  const syllablesA = ['カ', 'シ', 'タ', 'ナ', 'ハ', 'マ', 'ヤ', 'ラ', 'ワ', 'キ', 'ミ', 'リ', 'ト', 'ノ', 'モ'];
  const syllablesB = ['オ', 'ク', 'サ', 'テ', 'ニ', 'フ', 'メ', 'ロ', 'バ', 'ダ', 'ガ', 'ゼ', 'プ', 'ヂ'];

  let idx = 0;
  const pushMany = (cat: ShrineDef['category'], n: number, sub: string) => {
    for (let i = 0; i < n; i++) {
      idx++;
      const regId = regions[(idx * 7) % regions.length];
      const reg = REGIONS[regId];
      const angle = (idx * 2.39996) % (Math.PI * 2);
      const dist = 45 + ((idx * 53) % Math.max(80, Math.floor(reg.radius * 0.72)));
      const x = Math.round(Math.max(WORLD_BOUNDS.minX + 90, Math.min(WORLD_BOUNDS.maxX - 90, reg.center.x + Math.cos(angle) * dist)));
      const z = Math.round(Math.max(WORLD_BOUNDS.minZ + 90, Math.min(WORLD_BOUNDS.maxZ - 90, reg.center.z + Math.sin(angle) * dist)));
      const name = `${syllablesA[idx % syllablesA.length]}${syllablesB[(idx * 3) % syllablesB.length]}・${syllablesA[(idx * 5) % syllablesA.length]}${syllablesB[(idx * 2) % syllablesB.length]}の祠`;
      list.push({
        id: `shrine_gen_${idx}`,
        nameJa: name,
        region: regId,
        x,
        z,
        category: cat,
        runeTrial: cat === 'puzzle' && i < 4 ? 'gyro' : undefined,
        subtitleJa: sub,
      });
    }
  };

  pushMany('puzzle', Math.max(0, counts.puzzle), '古代シーカーの知恵の試練');
  pushMany('blessing', Math.max(0, counts.blessing), '導師の祝福');
  pushMany('combat_minor', Math.max(0, counts.combat_minor), '力の試練 序位');
  pushMany('combat_modest', Math.max(0, counts.combat_modest), '力の試練 中位');
  pushMany('combat_major', Math.max(0, counts.combat_major), '力の試練 極位');
  pushMany('dlc2', Math.max(0, counts.dlc2), 'EX 英傑たちの詩・試練の祠');

  return list;
}

export const ALL_SHRINES: ShrineDef[] = buildComplete136Shrines();
export const PHYSICAL_SHRINES: ShrineDef[] = FEATURED_SHRINES;
