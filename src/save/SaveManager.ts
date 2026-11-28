import type {
  ArrowType,
  ChampionsState,
  HeroPathSample,
  RegionId,
  RuneId,
  SaveSlotData,
} from '../types/botw';
import { ALL_SHRINES } from '../data/regions';

export type SaveMode = 'normal' | 'master';

export type NormalSlotId =
  | 'botw_normal_auto'
  | 'botw_normal_manual_1'
  | 'botw_normal_manual_2'
  | 'botw_normal_manual_3';

export type MasterSlotId =
  | 'botw_master_auto'
  | 'botw_master_manual_1'
  | 'botw_master_manual_2'
  | 'botw_master_manual_3';

export type SaveSlotId = NormalSlotId | MasterSlotId;

export const NORMAL_SLOTS: readonly NormalSlotId[] = [
  'botw_normal_auto',
  'botw_normal_manual_1',
  'botw_normal_manual_2',
  'botw_normal_manual_3',
] as const;

export const MASTER_SLOTS: readonly MasterSlotId[] = [
  'botw_master_auto',
  'botw_master_manual_1',
  'botw_master_manual_2',
  'botw_master_manual_3',
] as const;

export const ALL_SAVE_SLOTS: readonly SaveSlotId[] = [
  ...NORMAL_SLOTS,
  ...MASTER_SLOTS,
] as const;

export const SAVE_VERSION = 1;
export const IDB_NAME = 'lumina_botw_db';
export const IDB_STORE_NAME = 'saves';
export const IDB_VERSION = 1;

export const HERO_PATH_MAX_SAMPLES = 2000;
export const HERO_PATH_MIN_DISTANCE_M = 8;

// Exact BotW Base 100.00% denominators (total = 1250 => 0.08% per entry)
export const BOTW_BASE_KOROKS = 900; // 72.00%
export const BOTW_BASE_LOCATIONS = 226; // 18.08%
export const BOTW_BASE_SHRINES = 120; // 9.60%
export const BOTW_BASE_DIVINE_BEASTS = 4; // 0.32%
export const BOTW_DLC2_EXTRA_SHRINES = 16; // 120 -> 136
export const BOTW_DLC2_EXTRA_LOCATIONS = 1; // 226 -> 227 (Final Trial)

const DLC2_SHRINE_ID_SET: ReadonlySet<string> = new Set(
  ALL_SHRINES.filter((shrine) => shrine.category === 'dlc2').map((shrine) => shrine.id)
);

const DLC2_SHRINE_PATTERN = /(?:dlc2|ballad|champions_ballad|one_hit|ex_shrine)/i;
const DLC2_LOCATION_PATTERN = /(?:dlc2|ballad|final_trial|divine_trial|maz_koshia|champions_ballad)/i;

export interface CompletionBreakdown {
  totalPercent: number;
  koroks: { count: number; max: number; percent: number };
  locations: { count: number; max: number; percent: number };
  shrines: { count: number; max: number; percent: number };
  divineBeasts: { count: number; max: number; percent: number };
  completedCount: number;
  denominator: number;
  isDlc2Scaled: boolean;
}

export interface SaveSlotSummary {
  slotId: SaveSlotId;
  mode: SaveMode;
  isAuto: boolean;
  exists: boolean;
  savedAt: number;
  playTimeSec: number;
  completionPercent: number;
  hearts: number;
  maxHearts: number;
  rupees: number;
  shrinesCompleted: number;
  koroksFound: number;
  data: SaveSlotData | null;
}

interface StoredSaveRecord {
  slotId: SaveSlotId;
  data: SaveSlotData;
}

function createDefaultChampions(): ChampionsState {
  return {
    mipha: { unlocked: false, enabled: true, charges: 0, maxCharges: 1, cooldown: 0, upgraded: false },
    daruk: { unlocked: false, enabled: true, charges: 0, maxCharges: 3, cooldown: 0, upgraded: false },
    revali: { unlocked: false, enabled: true, charges: 0, maxCharges: 3, cooldown: 0, upgraded: false },
    urbosa: { unlocked: false, enabled: true, charges: 0, maxCharges: 3, cooldown: 0, upgraded: false },
  };
}

/**
 * Creates an authentic BotW starting SaveSlotData inside the Shrine of Resurrection:
 * 3 Hearts, 1 Stamina ring (100), 0 Rupees, naked, unarmed, no Sheikah Slate / Runes / Paraglider.
 */
export function createDefaultSave(mode: SaveMode): SaveSlotData {
  const arrows: Record<ArrowType, number> = {
    normal: 0,
    fire: 0,
    ice: 0,
    shock: 0,
    bomb: 0,
    ancient: 0,
  };

  return {
    version: SAVE_VERSION,
    mode,
    savedAt: Date.now(),
    playTimeSec: 0,
    inGameTimeHours: 7.5,
    daysElapsed: 1,
    bloodMoonTimerSec: 0,
    playerPos: { x: -323.5, y: 52, z: 455, yaw: Math.PI / 2 },
    hearts: 3,
    maxHearts: 3,
    tempHearts: 0,
    stamina: 100,
    maxStamina: 100,
    rupees: 0,
    spiritOrbs: 0,
    korokSeeds: 0,
    equippedWeaponId: null,
    equippedBowId: null,
    equippedShieldId: null,
    equippedArrow: 'normal',
    equippedArmor: {
      head: null,
      body: null,
      legs: null,
    },
    armorStars: {},
    armorDyes: {},
    ownedArmorIds: [],
    weapons: [],
    bows: [],
    shields: [],
    arrows,
    materials: {},
    meals: [],
    hasSheikahSlate: false,
    unlockedRunes: [],
    upgradedRunes: { bomb: false, stasis: false, sensor: false },
    hasParaglider: false,
    hasMasterSword: false,
    masterSwordAwakened: false,
    masterCycleFuel: 0,
    champions: createDefaultChampions(),
    activatedTowers: [] as RegionId[],
    completedShrines: [],
    discoveredShrines: [],
    discoveredLocations: ['shrine_of_resurrection'],
    foundKoroks: [],
    unlockedMemories: [],
    activeQuestId: 'main_follow_sheikah_slate',
    completedQuests: [],
    defeatedDivineBeasts: [],
    divineBeastTerminals: {},
    storyFlags: mode === 'master' ? { master_mode_active: true } : {},
    levelSensorPoints: 0,
    speciesKillCounts: {},
    openedChests: [],
    travelMedallionPos: null,
    heroPath: [],
    mapPins: [],
    compendiumDiscovered: [],
    sensorTargetId: null,
    tarreyTownStage: 0,
    settings: {
      proHud: false,
      northFixedMinimap: false,
      glitchPhysics: true,
      cameraMode: 'tps',
      muted: false,
      touchControlsMode: 'auto',
      graphicsQuality:
        typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || /iPad|iPhone|iPod|Android/i.test(navigator.userAgent))
          ? 'medium'
          : 'high',
    },
  };
}

function isDlc2ShrineId(id: string): boolean {
  return DLC2_SHRINE_ID_SET.has(id) || DLC2_SHRINE_PATTERN.test(id);
}

function isDlc2LocationId(id: string): boolean {
  return DLC2_LOCATION_PATTERN.test(id);
}

/**
 * Computes the full BotW map completion breakdown with authentic Base + DLC2 scaling.
 *
 * Base Game (1250 total entries => 0.08% each):
 * - Koroks:        900 / 1250 = 72.00%
 * - Locations:     226 / 1250 = 18.08%
 * - Shrines:       120 / 1250 =  9.60%
 * - Divine Beasts:   4 / 1250 =  0.32%
 *
 * When DLC2 shrines (up to +16 -> 136) or DLC2 locations (e.g. Final Trial -> 227)
 * are discovered, the denominator dynamically scales so total completion stays exact at 100.00%.
 */
export function computeCompletionBreakdown(save: SaveSlotData): CompletionBreakdown {
  const uniqueKoroks = new Set(save.foundKoroks ?? []);
  const uniqueLocations = new Set(save.discoveredLocations ?? []);
  const uniqueShrines = new Set(save.completedShrines ?? []);
  const uniqueBeasts = new Set(save.defeatedDivineBeasts ?? []);

  const hasDlc2Shrines =
    uniqueShrines.size > BOTW_BASE_SHRINES ||
    Array.from(uniqueShrines).some(isDlc2ShrineId);

  const hasDlc2Locations =
    uniqueLocations.size > BOTW_BASE_LOCATIONS ||
    Array.from(uniqueLocations).some(isDlc2LocationId);

  const hasDlc2Beast =
    uniqueBeasts.size > BOTW_BASE_DIVINE_BEASTS ||
    Array.from(uniqueBeasts).some(isDlc2LocationId);

  const maxKoroks = BOTW_BASE_KOROKS;
  const maxShrines = hasDlc2Shrines
    ? Math.max(BOTW_BASE_SHRINES + BOTW_DLC2_EXTRA_SHRINES, uniqueShrines.size)
    : BOTW_BASE_SHRINES;
  const maxLocations = hasDlc2Locations
    ? Math.max(BOTW_BASE_LOCATIONS + BOTW_DLC2_EXTRA_LOCATIONS, uniqueLocations.size)
    : BOTW_BASE_LOCATIONS;
  const maxBeasts = hasDlc2Beast
    ? Math.max(BOTW_BASE_DIVINE_BEASTS + 1, uniqueBeasts.size)
    : BOTW_BASE_DIVINE_BEASTS;

  const korokCount = Math.min(maxKoroks, uniqueKoroks.size);
  const locationCount = Math.min(maxLocations, uniqueLocations.size);
  const shrineCount = Math.min(maxShrines, uniqueShrines.size);
  const beastCount = Math.min(maxBeasts, uniqueBeasts.size);

  const denominator = maxKoroks + maxLocations + maxShrines + maxBeasts;
  const completedCount = korokCount + locationCount + shrineCount + beastCount;

  const round2 = (v: number): number => Math.round(v * 100) / 100;
  const totalPercent = Math.min(100, round2((completedCount / denominator) * 100));

  return {
    totalPercent,
    koroks: {
      count: korokCount,
      max: maxKoroks,
      percent: round2((korokCount / denominator) * 100),
    },
    locations: {
      count: locationCount,
      max: maxLocations,
      percent: round2((locationCount / denominator) * 100),
    },
    shrines: {
      count: shrineCount,
      max: maxShrines,
      percent: round2((shrineCount / denominator) * 100),
    },
    divineBeasts: {
      count: beastCount,
      max: maxBeasts,
      percent: round2((beastCount / denominator) * 100),
    },
    completedCount,
    denominator,
    isDlc2Scaled: hasDlc2Shrines || hasDlc2Locations || hasDlc2Beast,
  };
}

/**
 * Exact BotW 100.00% map completion formula:
 * - Koroks: 72.00% (0.08% * 900)
 * - Locations: 18.08% (0.08% * 226)
 * - Shrines: 9.60% (0.08% * 120)
 * - Divine Beasts: 0.32% (0.08% * 4)
 * - Scales denominator automatically when DLC2 shrines/locations are discovered.
 */
export function computeCompletionPercent(save: SaveSlotData): number {
  return computeCompletionBreakdown(save).totalPercent;
}

/**
 * Records a Hero's Path breadcrumb on `save.heroPath`, keeping up to 2,000 samples.
 * Throttles movement samples unless distance from the last breadcrumb is >= 8m or `death` is true.
 * Returns `true` if a sample was appended, `false` if throttled.
 */
export function recordHeroPathSample(
  save: SaveSlotData,
  x: number,
  y: number,
  z: number,
  death = false
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return false;
  }

  if (!Array.isArray(save.heroPath)) {
    save.heroPath = [];
  }

  const minDistSq = HERO_PATH_MIN_DISTANCE_M * HERO_PATH_MIN_DISTANCE_M;
  const len = save.heroPath.length;
  if (len > 0 && !death) {
    const prev = save.heroPath[len - 1];
    const dx = x - prev.x;
    const dy = y - prev.y;
    const dz = z - prev.z;
    if (dx * dx + dy * dy + dz * dz < minDistSq) {
      return false;
    }
  }

  const sample: HeroPathSample = {
    x,
    y,
    z,
    t: Number.isFinite(save.playTimeSec) ? save.playTimeSec : 0,
  };
  if (death) {
    sample.death = true;
  }

  save.heroPath.push(sample);

  if (save.heroPath.length > HERO_PATH_MAX_SAMPLES) {
    save.heroPath.splice(0, save.heroPath.length - HERO_PATH_MAX_SAMPLES);
  }

  return true;
}

export function getSlotMode(slotId: SaveSlotId): SaveMode {
  return slotId.startsWith('botw_master_') ? 'master' : 'normal';
}

export function getAutoSlotId(mode: SaveMode): SaveSlotId {
  return mode === 'master' ? 'botw_master_auto' : 'botw_normal_auto';
}

export function getManualSlotId(mode: SaveMode, index: 1 | 2 | 3): SaveSlotId {
  if (mode === 'master') {
    return `botw_master_manual_${index}` as MasterSlotId;
  }
  return `botw_normal_manual_${index}` as NormalSlotId;
}

export function getSlotsForMode(mode: SaveMode): readonly SaveSlotId[] {
  return mode === 'master' ? MASTER_SLOTS : NORMAL_SLOTS;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSaveData(raw: unknown, mode: SaveMode): SaveSlotData | null {
  if (!raw || typeof raw !== 'object') return null;
  const partial = raw as Partial<SaveSlotData>;
  const defaults = createDefaultSave(mode);

  const merged: SaveSlotData = {
    ...defaults,
    ...partial,
    version: typeof partial.version === 'number' ? partial.version : SAVE_VERSION,
    mode,
    savedAt: typeof partial.savedAt === 'number' ? partial.savedAt : defaults.savedAt,
    playerPos: {
      ...defaults.playerPos,
      ...(partial.playerPos ?? {}),
    },
    equippedArmor: {
      ...defaults.equippedArmor,
      ...(partial.equippedArmor ?? {}),
    },
    arrows: {
      ...defaults.arrows,
      ...(partial.arrows ?? {}),
    },
    upgradedRunes: {
      ...defaults.upgradedRunes,
      ...(partial.upgradedRunes ?? {}),
    },
    champions: {
      mipha: { ...defaults.champions.mipha, ...(partial.champions?.mipha ?? {}) },
      daruk: { ...defaults.champions.daruk, ...(partial.champions?.daruk ?? {}) },
      revali: { ...defaults.champions.revali, ...(partial.champions?.revali ?? {}) },
      urbosa: { ...defaults.champions.urbosa, ...(partial.champions?.urbosa ?? {}) },
    },
    settings: {
      ...defaults.settings,
      ...(partial.settings ?? {}),
    },
    armorStars: { ...(partial.armorStars ?? {}) },
    armorDyes: { ...(partial.armorDyes ?? {}) },
    materials: partial.materials ? { ...partial.materials } : defaults.materials,
    storyFlags: partial.storyFlags ? { ...partial.storyFlags } : defaults.storyFlags,
    speciesKillCounts: { ...(partial.speciesKillCounts ?? {}) },
    ownedArmorIds: Array.isArray(partial.ownedArmorIds) ? [...partial.ownedArmorIds] : defaults.ownedArmorIds,
    weapons: Array.isArray(partial.weapons) ? deepClone(partial.weapons) : defaults.weapons,
    bows: Array.isArray(partial.bows) ? deepClone(partial.bows) : defaults.bows,
    shields: Array.isArray(partial.shields) ? deepClone(partial.shields) : defaults.shields,
    meals: Array.isArray(partial.meals) ? deepClone(partial.meals) : defaults.meals,
    unlockedRunes: Array.isArray(partial.unlockedRunes) ? [...partial.unlockedRunes] : defaults.unlockedRunes,
    activatedTowers: Array.isArray(partial.activatedTowers) ? [...partial.activatedTowers] : [],
    completedShrines: Array.isArray(partial.completedShrines) ? [...partial.completedShrines] : [],
    discoveredShrines: Array.isArray(partial.discoveredShrines)
      ? [...partial.discoveredShrines]
      : Array.isArray(partial.completedShrines)
      ? [...partial.completedShrines]
      : [],
    discoveredLocations: Array.isArray(partial.discoveredLocations) ? [...partial.discoveredLocations] : [],
    foundKoroks: Array.isArray(partial.foundKoroks) ? [...partial.foundKoroks] : [],
    unlockedMemories: Array.isArray(partial.unlockedMemories) ? [...partial.unlockedMemories] : [],
    completedQuests: Array.isArray(partial.completedQuests) ? [...partial.completedQuests] : [],
    defeatedDivineBeasts: Array.isArray(partial.defeatedDivineBeasts) ? [...partial.defeatedDivineBeasts] : [],
    divineBeastTerminals:
      partial.divineBeastTerminals && typeof partial.divineBeastTerminals === 'object'
        ? Object.fromEntries(
            Object.entries(partial.divineBeastTerminals).map(([k, v]) => [k, Array.isArray(v) ? [...v] : []])
          )
        : {},
    openedChests: Array.isArray(partial.openedChests) ? [...partial.openedChests] : [],
    heroPath: Array.isArray(partial.heroPath)
      ? deepClone(partial.heroPath).slice(-HERO_PATH_MAX_SAMPLES)
      : [],
    mapPins: Array.isArray(partial.mapPins) ? deepClone(partial.mapPins) : [],
    compendiumDiscovered: Array.isArray(partial.compendiumDiscovered) ? [...partial.compendiumDiscovered] : [],
    equippedWeaponId: partial.equippedWeaponId !== undefined ? partial.equippedWeaponId : defaults.equippedWeaponId,
    equippedBowId: partial.equippedBowId !== undefined ? partial.equippedBowId : defaults.equippedBowId,
    equippedShieldId: partial.equippedShieldId !== undefined ? partial.equippedShieldId : defaults.equippedShieldId,
    hasSheikahSlate:
      typeof partial.hasSheikahSlate === 'boolean'
        ? partial.hasSheikahSlate
        : (Array.isArray(partial.unlockedRunes) && partial.unlockedRunes.length > 0) || defaults.hasSheikahSlate,
  };

  return merged;
}

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // Restricted storage (e.g., opaque origin / private mode)
  }
  return null;
}

function getSafeIndexedDB(): IDBFactory | null {
  try {
    if (typeof globalThis !== 'undefined' && 'indexedDB' in globalThis && globalThis.indexedDB) {
      return globalThis.indexedDB;
    }
  } catch {
    // IndexedDB unavailable or blocked
  }
  return null;
}

/**
 * Dual LocalStorage + IndexedDB persistence manager for Normal and Master Mode saves.
 * Safely degrades to an in-memory store when running in Node unit tests or restricted contexts.
 */
export class SaveManager {
  public static readonly DB_NAME = IDB_NAME;
  public static readonly STORE_NAME = IDB_STORE_NAME;
  public static readonly DB_VERSION = IDB_VERSION;

  private readonly memoryStore = new Map<SaveSlotId, SaveSlotData>();
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private openDatabase(): Promise<IDBDatabase | null> {
    const idb = getSafeIndexedDB();
    if (!idb) return Promise.resolve(null);

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const request = idb.open(SaveManager.DB_NAME, SaveManager.DB_VERSION);

        request.onupgradeneeded = () => {
          try {
            const db = request.result;
            if (!db.objectStoreNames.contains(SaveManager.STORE_NAME)) {
              db.createObjectStore(SaveManager.STORE_NAME, { keyPath: 'slotId' });
            }
          } catch {
            // Ignore schema upgrade race
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.dbPromise = null;
          };
          db.onclose = () => {
            this.dbPromise = null;
          };
          resolve(db);
        };

        request.onerror = () => {
          this.dbPromise = null;
          resolve(null);
        };

        request.onblocked = () => {
          resolve(null);
        };
      } catch {
        this.dbPromise = null;
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private writeLocalStorage(slotId: SaveSlotId, data: SaveSlotData): boolean {
    const ls = getSafeLocalStorage();
    if (!ls) return false;
    try {
      ls.setItem(slotId, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  private readLocalStorage(slotId: SaveSlotId): SaveSlotData | null {
    const ls = getSafeLocalStorage();
    if (!ls) return null;
    try {
      const raw = ls.getItem(slotId);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return normalizeSaveData(parsed, getSlotMode(slotId));
    } catch {
      return null;
    }
  }

  private removeLocalStorage(slotId: SaveSlotId): void {
    const ls = getSafeLocalStorage();
    if (!ls) return;
    try {
      ls.removeItem(slotId);
    } catch {
      // Ignore storage errors
    }
  }

  private async writeIndexedDB(slotId: SaveSlotId, data: SaveSlotData): Promise<boolean> {
    const db = await this.openDatabase();
    if (!db) return false;
    return new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(SaveManager.STORE_NAME, 'readwrite');
        const store = tx.objectStore(SaveManager.STORE_NAME);
        const record: StoredSaveRecord = { slotId, data };
        store.put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  private async readIndexedDB(slotId: SaveSlotId): Promise<SaveSlotData | null> {
    const db = await this.openDatabase();
    if (!db) return null;
    return new Promise<SaveSlotData | null>((resolve) => {
      try {
        const tx = db.transaction(SaveManager.STORE_NAME, 'readonly');
        const store = tx.objectStore(SaveManager.STORE_NAME);
        const req = store.get(slotId);
        req.onsuccess = () => {
          const result = req.result as StoredSaveRecord | SaveSlotData | undefined;
          if (!result) {
            resolve(null);
            return;
          }
          const payload =
            typeof result === 'object' && 'data' in result && result.data
              ? result.data
              : result;
          resolve(normalizeSaveData(payload, getSlotMode(slotId)));
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async deleteIndexedDB(slotId: SaveSlotId): Promise<void> {
    const db = await this.openDatabase();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(SaveManager.STORE_NAME, 'readwrite');
        tx.objectStore(SaveManager.STORE_NAME).delete(slotId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private prepareSnapshot(slotId: SaveSlotId, data: SaveSlotData): SaveSlotData {
    const slotMode = getSlotMode(slotId);
    const normalized = normalizeSaveData(data, slotMode) ?? createDefaultSave(slotMode);
    normalized.savedAt = Date.now();
    normalized.mode = slotMode;
    normalized.version = SAVE_VERSION;
    return deepClone(normalized);
  }

  /**
   * Persists a save snapshot to memory, LocalStorage (sync), and IndexedDB (async).
   */
  public async save(slotId: SaveSlotId, data: SaveSlotData): Promise<SaveSlotData> {
    const snapshot = this.prepareSnapshot(slotId, data);
    this.memoryStore.set(slotId, deepClone(snapshot));
    this.writeLocalStorage(slotId, snapshot);
    await this.writeIndexedDB(slotId, snapshot);
    return deepClone(snapshot);
  }

  /**
   * Synchronous write to memory + LocalStorage with fire-and-forget IndexedDB sync
   * (ideal for pagehide / beforeunload autosaves).
   */
  public saveSync(slotId: SaveSlotId, data: SaveSlotData): SaveSlotData {
    const snapshot = this.prepareSnapshot(slotId, data);
    this.memoryStore.set(slotId, deepClone(snapshot));
    this.writeLocalStorage(slotId, snapshot);
    void this.writeIndexedDB(slotId, snapshot);
    return deepClone(snapshot);
  }

  /**
   * Saves to the active mode's dedicated auto-save slot (`botw_normal_auto` or `botw_master_auto`).
   */
  public async autoSave(data: SaveSlotData): Promise<SaveSlotData> {
    return this.save(getAutoSlotId(data.mode), data);
  }

  /**
   * Saves to one of the active mode's 3 manual slots (`botw_{mode}_manual_1..3`).
   */
  public async manualSave(
    mode: SaveMode,
    manualIndex: 1 | 2 | 3,
    data: SaveSlotData
  ): Promise<SaveSlotData> {
    return this.save(getManualSlotId(mode, manualIndex), data);
  }

  /**
   * Loads a save slot, reconciling IndexedDB and LocalStorage by newest `savedAt` timestamp,
   * and falling back to the in-memory store in headless/Node environments.
   */
  public async load(slotId: SaveSlotId): Promise<SaveSlotData | null> {
    const [idbData, lsData] = await Promise.all([
      this.readIndexedDB(slotId),
      Promise.resolve(this.readLocalStorage(slotId)),
    ]);
    const memData = this.memoryStore.get(slotId) ?? null;

    const candidates = [idbData, lsData, memData].filter(
      (item): item is SaveSlotData => item !== null
    );
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
    const newest = deepClone(candidates[0]);
    this.memoryStore.set(slotId, deepClone(newest));

    // Keep LocalStorage & IndexedDB reconciled if one lagged behind
    if (!lsData || (lsData.savedAt ?? 0) < (newest.savedAt ?? 0)) {
      this.writeLocalStorage(slotId, newest);
    }
    if (!idbData || (idbData.savedAt ?? 0) < (newest.savedAt ?? 0)) {
      void this.writeIndexedDB(slotId, newest);
    }

    return newest;
  }

  /**
   * Synchronous load from LocalStorage or in-memory cache.
   */
  public loadSync(slotId: SaveSlotId): SaveSlotData | null {
    const lsData = this.readLocalStorage(slotId);
    const memData = this.memoryStore.get(slotId) ?? null;
    if (lsData && memData) {
      const winner = (lsData.savedAt ?? 0) >= (memData.savedAt ?? 0) ? lsData : memData;
      return deepClone(winner);
    }
    const chosen = lsData ?? memData;
    return chosen ? deepClone(chosen) : null;
  }

  public async deleteSlot(slotId: SaveSlotId): Promise<void> {
    this.memoryStore.delete(slotId);
    this.removeLocalStorage(slotId);
    await this.deleteIndexedDB(slotId);
  }

  public async listSlots(mode?: SaveMode): Promise<SaveSlotSummary[]> {
    const slots = mode ? getSlotsForMode(mode) : ALL_SAVE_SLOTS;
    const loaded = await Promise.all(slots.map((slotId) => this.load(slotId)));

    return slots.map((slotId, idx) => {
      const data = loaded[idx];
      const slotMode = getSlotMode(slotId);
      const isAuto = slotId.endsWith('_auto');
      if (!data) {
        return {
          slotId,
          mode: slotMode,
          isAuto,
          exists: false,
          savedAt: 0,
          playTimeSec: 0,
          completionPercent: 0,
          hearts: 0,
          maxHearts: 0,
          rupees: 0,
          shrinesCompleted: 0,
          koroksFound: 0,
          data: null,
        };
      }
      return {
        slotId,
        mode: slotMode,
        isAuto,
        exists: true,
        savedAt: data.savedAt,
        playTimeSec: data.playTimeSec,
        completionPercent: computeCompletionPercent(data),
        hearts: data.hearts,
        maxHearts: data.maxHearts,
        rupees: data.rupees,
        shrinesCompleted: data.completedShrines.length,
        koroksFound: data.foundKoroks.length,
        data,
      };
    });
  }

  public async getLatestSlot(
    mode: SaveMode
  ): Promise<{ slotId: SaveSlotId; data: SaveSlotData } | null> {
    const summaries = await this.listSlots(mode);
    const existing = summaries
      .filter((s): s is SaveSlotSummary & { data: SaveSlotData } => s.exists && s.data !== null)
      .sort((a, b) => b.savedAt - a.savedAt);
    if (existing.length === 0) return null;
    return { slotId: existing[0].slotId, data: existing[0].data };
  }

  public async hasAnySave(mode?: SaveMode): Promise<boolean> {
    const summaries = await this.listSlots(mode);
    return summaries.some((s) => s.exists);
  }

  public async clearMode(mode: SaveMode): Promise<void> {
    const slots = getSlotsForMode(mode);
    await Promise.all(slots.map((slotId) => this.deleteSlot(slotId)));
  }

  public async clearAll(): Promise<void> {
    await Promise.all(ALL_SAVE_SLOTS.map((slotId) => this.deleteSlot(slotId)));
  }

  public async exportSlotJson(slotId: SaveSlotId): Promise<string | null> {
    const data = await this.load(slotId);
    return data ? JSON.stringify(data, null, 2) : null;
  }

  public async importSlotJson(slotId: SaveSlotId, json: string): Promise<SaveSlotData | null> {
    try {
      const parsed: unknown = JSON.parse(json);
      const normalized = normalizeSaveData(parsed, getSlotMode(slotId));
      if (!normalized) return null;
      return this.save(slotId, normalized);
    } catch {
      return null;
    }
  }
}

export const saveManager = new SaveManager();

export function canPerformMeleeAttack(save: SaveSlotData): boolean {
  if (!save.equippedWeaponId) return false;
  return save.weapons.some((w) => w.id === save.equippedWeaponId);
}

export function canPerformShieldAction(save: SaveSlotData): boolean {
  if (!save.equippedShieldId) return false;
  return save.shields.some((s) => s.id === save.equippedShieldId);
}

export function canUseSheikahFeatures(save: SaveSlotData): boolean {
  return !!save.hasSheikahSlate;
}

export function exchangeSpiritOrbs(
  save: SaveSlotData,
  vessel: 'heart' | 'stamina'
): { ok: boolean; messageJa: string } {
  if (save.spiritOrbs < 4) {
    return { ok: false, messageJa: `克服の証が足りません（現在 ${save.spiritOrbs} / 必要 4個）` };
  }
  if (vessel === 'heart') {
    if (save.maxHearts >= 30) {
      return { ok: false, messageJa: 'ハートの器はすでに最大（30）に達しています！' };
    }
    save.spiritOrbs -= 4;
    save.maxHearts = Math.min(30, save.maxHearts + 1);
    save.hearts = save.maxHearts;
    return { ok: true, messageJa: `❤️ ハートの器を授かった！（最大ハート ${save.maxHearts}）` };
  }
  if (save.maxStamina >= 300) {
    return { ok: false, messageJa: 'がんばりの器はすでに最大（3周 / 300）に達しています！' };
  }
  save.spiritOrbs -= 4;
  save.maxStamina = Math.min(300, save.maxStamina + 20);
  save.stamina = save.maxStamina;
  return { ok: true, messageJa: `💚 がんばりの器を授かった！（最大がんばり ${save.maxStamina}）` };
}

export function purchaseArmorDye(
  save: SaveSlotData,
  dyeId: string,
  equippedTargets: Array<{ id: string; dyeable: boolean }>,
  costRupees = 20
): { ok: boolean; dyedCount: number; messageJa: string } {
  const dyeableTargets = equippedTargets.filter((t) => t.dyeable);
  if (dyeableTargets.length === 0) {
    return { ok: false, dyedCount: 0, messageJa: '染色可能な防具を装備していません' };
  }
  if (save.rupees < costRupees) {
    return { ok: false, dyedCount: 0, messageJa: `ルピーが足りません（必要 ${costRupees} / 所持 ${save.rupees} ルピー）` };
  }
  save.rupees -= costRupees;
  for (const t of dyeableTargets) {
    if (dyeId === 'default') delete save.armorDyes[t.id];
    else save.armorDyes[t.id] = dyeId;
  }
  return { ok: true, dyedCount: dyeableTargets.length, messageJa: `${costRupees}ルピーで防具を染色しました！` };
}

export function purchaseGreatFairyUpgrade(
  save: SaveSlotData,
  armorId: string,
  upgradeable: boolean,
  costRupees: number
): { ok: boolean; newStar: number; messageJa: string } {
  const cur = save.armorStars[armorId] ?? 0;
  if (!upgradeable) {
    return { ok: false, newStar: cur, messageJa: 'この防具は強化できません' };
  }
  if (cur >= 4) {
    return { ok: false, newStar: cur, messageJa: 'すでに最大強化（★4）されています' };
  }
  if (save.rupees < costRupees) {
    return { ok: false, newStar: cur, messageJa: `ルピーが足りません（必要 ${costRupees} / 所持 ${save.rupees} ルピー）` };
  }
  save.rupees -= costRupees;
  const next = cur + 1;
  save.armorStars[armorId] = next;
  return { ok: true, newStar: next, messageJa: `${costRupees}ルピーで ★${next} へ強化した！` };
}

