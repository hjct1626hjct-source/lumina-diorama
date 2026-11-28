export type RegionId =
  | 'great_plateau'
  | 'dueling_peaks'
  | 'hateno'
  | 'lanayru'
  | 'akkala'
  | 'eldin'
  | 'woodland'
  | 'central_hyrule'
  | 'ridgeland'
  | 'tabantha'
  | 'hebra'
  | 'gerudo_highlands'
  | 'wasteland'
  | 'lake'
  | 'faron';

export type WeatherType =
  | 'sunny'
  | 'cloudy'
  | 'rain'
  | 'thunderstorm'
  | 'snow'
  | 'blizzard'
  | 'sunshower'
  | 'volcanic_ash'
  | 'sandstorm';

export type ClimateZone =
  | 'temperate'
  | 'highland_cold'
  | 'extreme_cold'
  | 'desert'
  | 'volcanic'
  | 'tropical'
  | 'wetland'
  | 'autumn';

export type ChemistryElement = 'Fire' | 'Water' | 'Ice' | 'Wind' | 'Electricity';

export type ChemistryMaterial =
  | 'Wood'
  | 'Metal'
  | 'Grass'
  | 'Organic'
  | 'Stone'
  | 'WaterSurface'
  | 'IceBlock';

export type RuneId =
  | 'magnesis'
  | 'bomb_round'
  | 'bomb_square'
  | 'stasis'
  | 'cryonis'
  | 'camera'
  | 'master_cycle';

export type ArmorSlot = 'head' | 'body' | 'legs';

export type ArmorEffect =
  | 'none'
  | 'cold_resist'
  | 'heat_resist'
  | 'flame_guard'
  | 'swim_speed'
  | 'stealth'
  | 'climb_speed'
  | 'attack_up'
  | 'shock_resist'
  | 'ancient_resist'
  | 'guardian_resist'
  | 'sand_speed'
  | 'snow_speed'
  | 'champion_hp_view'
  | 'raft_speed'
  | 'korok_detect'
  | 'majora_disguise'
  | 'bokoblin_disguise'
  | 'moblin_disguise'
  | 'lizalfos_disguise'
  | 'lynel_disguise'
  | 'lightning_proof'
  | 'climb_lateral'
  | 'unfreezable'
  | 'spin_attack_swim'
  | 'waterfall_climb'
  | 'night_glow';

export type SetBonusType =
  | 'none'
  | 'unfreezable'
  | 'shock_proof'
  | 'fireproof'
  | 'swim_dash_stamina'
  | 'night_speed'
  | 'climb_jump_stamina'
  | 'charge_atk_stamina'
  | 'lightning_proof'
  | 'bone_proficiency_disguise'
  | 'ancient_proficiency'
  | 'master_sword_beam_up'
  | 'gerudo_vai_heat'
  | 'stealth_bone_disguise'
  | 'royal_guard_stamina';

export interface DyeColorDef {
  id: string;
  nameJa: string;
  nameEn: string;
  hex: string;
}

export interface ArmorPiece {
  id: string;
  nameJa: string;
  nameEn: string;
  slot: ArmorSlot;
  setId: string | null;
  upgradeable: boolean;
  defenseByStar: [number, number, number, number, number];
  effect: ArmorEffect;
  effectLevel: number;
  setBonus: SetBonusType;
  baseColor: string;
  accentColor: string;
  dyeable: boolean;
  triggersNpcFear?: boolean;
  gerudoEntryPiece?: boolean;
  gerudoEntryCompatible?: boolean;
  ancientSetCompatible?: boolean;
  showsEnemyHp?: boolean;
  dlcTag?: 'base' | 'dlc1' | 'dlc2' | 'collab' | 'amiibo';
  description: string;
}

export interface WeaponDef {
  id: string;
  nameJa: string;
  nameEn: string;
  category: 'sword' | 'claymore' | 'spear' | 'bow' | 'shield';
  attack: number;
  durability: number;
  material: ChemistryMaterial;
  element?: ChemistryElement;
  isAncient?: boolean;
  isBone?: boolean;
  isMasterSword?: boolean;
  isOneHitObliterator?: boolean;
  color: string;
  accentColor: string;
  modifier?: 'none' | 'attack_up_blue' | 'attack_up_yellow' | 'durability_up' | 'long_throw';
  modifierBonus?: number;
}

export type ArrowType = 'normal' | 'fire' | 'ice' | 'shock' | 'bomb' | 'ancient';

export type FuelTier = 1 | 2 | 3 | 4 | 5;

export interface MaterialDef {
  id: string;
  nameJa: string;
  nameEn: string;
  category: 'fruit' | 'mushroom' | 'herb' | 'meat' | 'fish' | 'bug' | 'monster' | 'mineral' | 'ancient' | 'dragon' | 'special';
  hearts: number;
  effectType?: 'none' | 'hearty' | 'energizing' | 'enduring' | 'mighty' | 'tough' | 'hasty' | 'sneaky' | 'chilly' | 'spicy' | 'electro' | 'fireproof';
  potency: number;
  durationBonusSec: number;
  fuelTier: FuelTier;
  price: number;
  color: string;
}

export interface CookedMeal {
  id: string;
  nameJa: string;
  hearts: number;
  tempHearts: number;
  staminaRestore: number;
  tempStamina: number;
  effectType: string;
  effectLevel: number;
  durationSec: number;
  isCritical: boolean;
  ingredients: string[];
}

export interface RegionDef {
  id: RegionId;
  nameJa: string;
  nameEn: string;
  climate: ClimateZone;
  center: { x: number; z: number };
  radius: number;
  towerPos: { x: number; z: number };
  baseElevation: number;
  peakElevation: number;
  dayTempC: number;
  nightTempC: number;
  weatherWeights: Partial<Record<WeatherType, number>>;
  grassColor: string;
  cliffColor: string;
  accentColor: string;
  description: string;
}

export interface MemoryDef {
  id: string;
  orderIndex: number;
  code: string;
  titleEn: string;
  titleJa: string;
  isDlc: boolean;
  region: RegionId;
  pos: { x: number; z: number };
  locationJa: string;
  summaryJa: string;
  dialogueLines: Array<{ speaker: string; text: string }>;
}

export interface QuestDef {
  id: string;
  category: 'main' | 'shrine' | 'side';
  titleJa: string;
  region: RegionId;
  giverJa: string;
  objectiveJa: string;
  dlcTag: 'base' | 'dlc1' | 'dlc2' | 'collab';
  rewardJa: string;
  steps?: string[];
}

export interface ReadableDocument {
  id: string;
  titleJa: string;
  authorJa: string;
  region: RegionId;
  pos: { x: number; z: number };
  pages: string[];
}

export type EnemySpecies =
  | 'bokoblin'
  | 'moblin'
  | 'lizalfos'
  | 'lynel'
  | 'guardian_stalker'
  | 'guardian_decayed'
  | 'hinox'
  | 'stone_talus'
  | 'chuchu'
  | 'keese'
  | 'stal_bokoblin'
  | 'stal_moblin'
  | 'stal_mage'
  | 'wizzrobe'
  | 'yiga_footsoldier'
  | 'yiga_blademaster'
  | 'waterblight'
  | 'fireblight'
  | 'windblight'
  | 'thunderblight'
  | 'calamity_ganon'
  | 'dark_beast_ganon'
  | 'monk_maz_koshia';

export type EnemyTier = 'red' | 'blue' | 'black' | 'silver' | 'gold' | 'boss';

export interface CompendiumEntry {
  id: string;
  nameJa: string;
  category: 'creatures' | 'monsters' | 'materials' | 'equipment' | 'treasure';
  discovered: boolean;
  photoDataUrl?: string;
  description: string;
  regionHint: string;
}

export interface ChampionsState {
  mipha: { unlocked: boolean; enabled: boolean; charges: number; maxCharges: number; cooldown: number; upgraded: boolean };
  daruk: { unlocked: boolean; enabled: boolean; charges: number; maxCharges: number; cooldown: number; upgraded: boolean };
  revali: { unlocked: boolean; enabled: boolean; charges: number; maxCharges: number; cooldown: number; upgraded: boolean };
  urbosa: { unlocked: boolean; enabled: boolean; charges: number; maxCharges: number; cooldown: number; upgraded: boolean };
}

export interface HeroPathSample {
  x: number;
  z: number;
  y: number;
  t: number;
  death?: boolean;
}

export type TouchControlsMode = 'auto' | 'always' | 'hidden';
export type GraphicsQuality = 'high' | 'medium' | 'low';

export interface SaveSlotData {
  version: number;
  mode: 'normal' | 'master';
  savedAt: number;
  playTimeSec: number;
  inGameTimeHours: number;
  daysElapsed: number;
  bloodMoonTimerSec: number;
  playerPos: { x: number; y: number; z: number; yaw: number };
  hearts: number;
  maxHearts: number;
  tempHearts: number;
  stamina: number;
  maxStamina: number;
  rupees: number;
  spiritOrbs: number;
  korokSeeds: number;
  equippedWeaponId: string | null;
  equippedBowId: string | null;
  equippedShieldId: string | null;
  equippedArrow: ArrowType;
  equippedArmor: { head: string | null; body: string | null; legs: string | null };
  armorStars: Record<string, number>;
  armorDyes: Record<string, string>;
  ownedArmorIds: string[];
  weapons: Array<WeaponDef & { currentDurability: number }>;
  bows: Array<WeaponDef & { currentDurability: number }>;
  shields: Array<WeaponDef & { currentDurability: number }>;
  arrows: Record<ArrowType, number>;
  materials: Record<string, number>;
  meals: CookedMeal[];
  hasSheikahSlate: boolean;
  unlockedRunes: RuneId[];
  upgradedRunes: { bomb: boolean; stasis: boolean; sensor: boolean };
  hasParaglider: boolean;
  hasMasterSword: boolean;
  masterSwordAwakened: boolean;
  masterCycleFuel: number;
  champions: ChampionsState;
  activatedTowers: RegionId[];
  completedShrines: string[];
  discoveredShrines: string[];
  discoveredLocations: string[];
  foundKoroks: string[];
  unlockedMemories: string[];
  activeQuestId: string;
  completedQuests: string[];
  defeatedDivineBeasts: string[];
  storyFlags: Record<string, boolean>;
  levelSensorPoints: number;
  speciesKillCounts: Record<string, number>;
  openedChests: string[];
  travelMedallionPos: { x: number; y: number; z: number } | null;
  heroPath: HeroPathSample[];
  mapPins: Array<{ id: string; x: number; z: number; color: string; label: string }>;
  compendiumDiscovered: string[];
  sensorTargetId: string | null;
  tarreyTownStage: number;
  settings: {
    proHud: boolean;
    northFixedMinimap: boolean;
    glitchPhysics: boolean;
    cameraMode: 'tps' | 'close' | 'fps';
    muted: boolean;
    touchControlsMode: TouchControlsMode;
    graphicsQuality: GraphicsQuality;
  };
}
