// ============================================================================
// LUMINA DIORAMA — Save & Load Persistence Manager (Auto + 3 Slots + Backup)
// 製作者：駿 (Created by Shun)
// ============================================================================

const KEYS = {
  auto: 'lumina_diorama_autosave_v1',
  slotPrefix: 'lumina_diorama_slot_v1_',
  settings: 'lumina_diorama_settings_v1',
};

export const DEFAULT_SETTINGS = {
  bgmVolume: 0.42,
  seVolume: 0.65,
  muted: false,
  buttonSize: 'standard', // 'standard' | 'large'
  handedness: 'right',    // 'right' | 'left'
  touchMode: 'auto',      // 'auto' | 'always' | 'hide'
  bodyType: 'male',       // 'male' | 'female' | 'slim'
  cameraMode: 'tps',      // 'tps' | 'action' | 'fps'
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEYS.settings, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
  } catch (_) {}
}

export function serializeGameState(game) {
  const p = game.player;
  return {
    version: 1,
    savedAt: Date.now(),
    areaId: game.currentAreaId === 'tower' ? 'town' : game.currentAreaId,
    player: {
      name: p.name,
      jobId: p.jobId,
      bodyType: p.bodyType || 'male',
      level: p.level,
      exp: p.exp,
      nextExp: p.nextExp,
      hp: Math.max(1, Math.round(p.hp)),
      mp: Math.max(0, Math.round(p.mp)),
      limit: Math.round(p.limit),
      gold: p.gold,
      equippedWeapon: p.equippedWeapon,
      equippedArmor: p.equippedArmor,
      weapons: p.weapons,     // [{ id, plus }]
      armors: p.armors,       // [{ id, plus }]
      spells: p.spells,       // { fire: 1, ice: 1, ... }
      activeSpell: p.activeSpell,
      ores: { ...p.ores },
      cores: { ...p.cores },
      droneLevel: p.droneLevel,
    },
    progress: {
      visitedAreas: Array.from(game.progress.visitedAreas),
      defeatedBosses: Array.from(game.progress.defeatedBosses),
      openedChests: Array.from(game.progress.openedChests),
      brokenWalls: Array.from(game.progress.brokenWalls),
      activatedSwitches: Array.from(game.progress.activatedSwitches),
      discoveredWeapons: Array.from(game.progress.discoveredWeapons),
      discoveredArmors: Array.from(game.progress.discoveredArmors),
      discoveredSpells: Array.from(game.progress.discoveredSpells),
      monsterKills: { ...game.progress.monsterKills },
      achievements: Array.from(game.progress.achievements),
      gameCleared: Boolean(game.progress.gameCleared),
      ngPlus: game.progress.ngPlus || 1,
      bestTowerFloor: game.progress.bestTowerFloor || 0,
      bestTowerScore: game.progress.bestTowerScore || 0,
      stats: { ...game.progress.stats },
    },
  };
}

export function validateSaveData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!data.player || typeof data.player.jobId !== 'string') return false;
  if (!data.progress || typeof data.progress !== 'object') return false;
  return true;
}

export function saveAuto(game) {
  try {
    const payload = serializeGameState(game);
    localStorage.setItem(KEYS.auto, JSON.stringify(payload));
    return true;
  } catch (_) {
    return false;
  }
}

export function loadAuto() {
  try {
    const raw = localStorage.getItem(KEYS.auto);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateSaveData(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function saveSlot(slotIndex, game) {
  try {
    const payload = serializeGameState(game);
    localStorage.setItem(`${KEYS.slotPrefix}${slotIndex}`, JSON.stringify(payload));
    return true;
  } catch (_) {
    return false;
  }
}

export function loadSlot(slotIndex) {
  try {
    const raw = localStorage.getItem(`${KEYS.slotPrefix}${slotIndex}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateSaveData(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function deleteSlot(slotIndex) {
  try {
    if (slotIndex === 'auto') {
      localStorage.removeItem(KEYS.auto);
    } else {
      localStorage.removeItem(`${KEYS.slotPrefix}${slotIndex}`);
    }
  } catch (_) {}
}

export function listAllSaves() {
  return {
    auto: loadAuto(),
    slots: [1, 2, 3].map((idx) => ({ index: idx, data: loadSlot(idx) })),
  };
}

export function getLatestSave() {
  const all = listAllSaves();
  const candidates = [];
  if (all.auto) candidates.push(all.auto);
  for (const s of all.slots) {
    if (s.data) candidates.push(s.data);
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return candidates[0];
}

export function exportSaveJson(game) {
  return JSON.stringify(serializeGameState(game), null, 2);
}

export function parseImportedSave(jsonText) {
  try {
    const parsed = JSON.parse(jsonText);
    if (!validateSaveData(parsed)) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function formatPlayTime(sec = 0) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
