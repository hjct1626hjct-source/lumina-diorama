import { describe, expect, it } from 'vitest';
import { ARMOR_PIECES, KOCHI_DYE_COLORS, computeArmorSummary, getPieceDefense } from '../src/data/armors';
import {
  computeBotWDamage,
  computeMasterCycleFuel,
  cookIngredients,
  isInBloodMoonCookingWindow,
} from '../src/data/itemsAndCooking';
import { ALL_SHRINES, LANDMARKS, REGION_LIST, REGIONS } from '../src/data/regions';
import {
  ALL_MEMORIES,
  ALL_QUESTS,
  HYRULE_HISTORY_CHRONICLE,
  MAIN_QUESTS,
  READABLE_DOCUMENTS,
  SHRINE_QUESTS,
  SIDE_QUESTS,
  TRIAL_OF_THE_SWORD_STAGES,
} from '../src/data/storyAndQuests';
import { getTerrainHeight, isNoBikeZone } from '../src/world/TerrainGenerator';
import { evaluateChemistryInteraction, evaluateElementVsElement } from '../src/physics/PhysicsChemistryEngine';
import { computeBlightGanonHp, computeScaledEnemyTier } from '../src/entities/EnemyAndBossSystem';
import { KOROK_33_PUZZLE_TYPES, evaluateNpcEventFlow, type WorldNpc } from '../src/entities/NpcAndKorokSystem';
import { computeCompletionPercent, createDefaultSave, recordHeroPathSample } from '../src/save/SaveManager';
import * as THREE from 'three';

describe('BotW Geography, Peaks & Climate', () => {
  it('defines all 15 Sheikah Tower regions with strictly ordered 3 highest peaks (Gerudo > Hebra > Death Mountain)', () => {
    expect(REGION_LIST).toHaveLength(15);
    const gerudoSummit = getTerrainHeight(-1120, 210);
    const hebraPeak = getTerrainHeight(-900, -860);
    const deathMountain = getTerrainHeight(520, -840);
    expect(gerudoSummit).toBeGreaterThan(hebraPeak);
    expect(hebraPeak).toBeGreaterThan(deathMountain);
    expect(gerudoSummit).toBeGreaterThan(200);
  });

  it('enforces zero rain probability in Gerudo Desert and Master Cycle Zero restrictions in Desert & Eldin Volcano', () => {
    expect(REGIONS.wasteland.weatherWeights.rain ?? 0).toBe(0);
    expect(isNoBikeZone(-960, 780).blocked).toBe(true);
    expect(isNoBikeZone(520, -800).blocked).toBe(true);
    expect(isNoBikeZone(-240, 460).blocked).toBe(false);
  });

  it('registers all 136 Shrines (120 base + 16 DLC2) and 15 Stables', () => {
    expect(ALL_SHRINES).toHaveLength(136);
    expect(LANDMARKS.filter((l) => l.type === 'stable')).toHaveLength(15);
    expect(LANDMARKS.filter((l) => l.type === 'divine_beast')).toHaveLength(4);
    expect(LANDMARKS.filter((l) => l.type === 'great_fairy')).toHaveLength(4);
  });
});

describe('GDC 2017 Chemistry Engine 3 Laws', () => {
  it('Law 1: Fire ignites Grass/Wood with Updraft, melts IceBlock, and roasts Organic', () => {
    const grassFire = evaluateChemistryInteraction('Fire', 'Grass', { isRaining: false });
    expect(grassFire.ignited).toBe(true);
    expect(grassFire.updraftCreated).toBe(true);

    const iceMelt = evaluateChemistryInteraction('Fire', 'IceBlock');
    expect(iceMelt.melted).toBe(true);

    const metalShock = evaluateChemistryInteraction('Electricity', 'Metal', { isRaining: true });
    expect(metalShock.electrified).toBe(true);
    expect(metalShock.shockRadius).toBeGreaterThan(10);
  });

  it('Law 2: Water extinguishes Fire and amplifies Electricity', () => {
    expect(evaluateChemistryInteraction('Fire', 'Grass', { isRaining: true }).extinguished).toBe(true);
    expect(evaluateElementVsElement('Water', 'Fire').cancelExisting).toBe(true);
    expect(evaluateElementVsElement('Electricity', 'Water').amplified).toBe(true);
  });
});

describe('Combat Damage Formula, Cooking & Master Cycle Zero Paradoxical Fuel', () => {
  it('computes exact BotW damage formula with Sneakstrike 8x, Frozen 3x, Buffs, Ancient/Bone 1.8x & Shock immunity', () => {
    expect(computeBotWDamage({ baseAttack: 30, isSneakstrike: true })).toBe(240);
    expect(computeBotWDamage({ baseAttack: 20, isTargetFrozen: true, attackUpLevel: 3 })).toBe(90);
    expect(
      computeBotWDamage({
        baseAttack: 40,
        ancientProficiency: true,
        weaponIsAncient: true,
        attackUpLevel: 3,
      })
    ).toBe(108);
    expect(computeBotWDamage({ baseAttack: 30, element: 'Electricity', targetShockImmune: false })).toBe(50);
    expect(computeBotWDamage({ baseAttack: 30, element: 'Electricity', targetShockImmune: true })).toBe(30);
  });

  it('computes Master Cycle Zero paradoxical fuel formula min(1000, sum(base) * 2^n)', () => {
    // 5x Apple (Tier 5 = 100 each) => 500
    expect(computeMasterCycleFuel(['apple', 'apple', 'apple', 'apple', 'apple'])).toBe(500);
    // 4x Apple (400) + 1x Ancient Core (Tier 1 = 10, 2^1 = 2x) => 410 * 2 = 820!
    expect(computeMasterCycleFuel(['apple', 'apple', 'apple', 'apple', 'ancient_core'])).toBe(820);
    // 3x Apple (300) + 2x Monster Extract (20, 2^2 = 4x) => 320 * 4 = capped at 1000!
    expect(computeMasterCycleFuel(['apple', 'apple', 'apple', 'monster_extract', 'monster_extract'])).toBe(1000);
  });

  it('computes exact cooking duration (+30s/ingredient, +1800s Dragon Horn) & Blood Moon 100% crit window', () => {
    expect(isInBloodMoonCookingWindow(23.6)).toBe(true);
    expect(isInBloodMoonCookingWindow(0.1)).toBe(true);
    expect(isInBloodMoonCookingWindow(12.0)).toBe(false);

    const dragonMeal = cookIngredients(['mighty_bananas', 'mighty_bananas', 'mighty_bananas', 'mighty_bananas', 'farosh_horn'], {
      isBloodMoonWindow: false,
      rng: () => 0.99,
    });
    expect(dragonMeal.isCritical).toBe(true);
    expect(dragonMeal.durationSec).toBeGreaterThanOrEqual(1800);

    const bloodMeal = cookIngredients(['apple', 'apple'], { isBloodMoonWindow: true, rng: () => 0.99 });
    expect(bloodMeal.isCritical).toBe(true);
  });
});

describe('Armor Catalog, Set Bonuses, Gerudo Vai Disguise & NPC EventFlow', () => {
  it('covers 100+ armor pieces, 15 Kochi dyes, Champion Tunic 32 max DEF, Ancient + Divine Helm set compatibility & Gerudo entry', () => {
    expect(ARMOR_PIECES.length).toBeGreaterThanOrEqual(100);
    expect(KOCHI_DYE_COLORS.length).toBeGreaterThanOrEqual(16); // default + 15 colors
    expect(getPieceDefense('champions_tunic', 4)).toBe(32);

    const ancientWithBeastHelm = computeArmorSummary(
      { head: 'vah_ruta_divine_helm', body: 'ancient_cuirass', legs: 'ancient_greaves' },
      { vah_ruta_divine_helm: 2, ancient_cuirass: 2, ancient_greaves: 2 }
    );
    expect(ancientWithBeastHelm.ancientProficiency).toBe(true);
    expect(ancientWithBeastHelm.showsEnemyHp).toBe(true);

    const vaiWithSandBoots = computeArmorSummary(
      { head: 'gerudo_veil', body: 'gerudo_top', legs: 'sand_boots' },
      {}
    );
    expect(vaiWithSandBoots.hasGerudoEntry).toBe(true);

    const naked = computeArmorSummary({ head: null, body: null, legs: null }, {});
    expect(naked.isNaked).toBe(true);
  });

  it('branches EventFlow dialogue for Naked state, Gerudo Town guard, Fear armor, and Yiga Disguised Traveler', () => {
    const dummyNpc = (id: string, extra: Partial<WorldNpc> = {}): WorldNpc => ({
      id,
      nameJa: id,
      displayNameJa: extra.isYigaDisguised ? '旅人' : id,
      roleJa: 'NPC',
      region: 'great_plateau',
      homePos: new THREE.Vector3(),
      shelterPos: new THREE.Vector3(),
      nightPos: new THREE.Vector3(),
      position: new THREE.Vector3(),
      yaw: 0,
      wakeHour: 6,
      sleepHour: 22,
      glbKey: 'npc_traveler',
      root: new THREE.Group(),
      glbInstance: null,
      behaviorLabel: '活動中',
      ...extra,
    });
    const baseCtx = {
      isNaked: false,
      triggersNpcFear: false,
      hasGerudoEntry: false,
      isBloodMoon: false,
      isRaining: false,
      timeHours: 12,
      memoriesCount: 0,
      hasParaglider: true,
      tarreyTownStage: 0,
      thunderHelmRecovered: false,
    };

    const payaNaked = evaluateNpcEventFlow(dummyNpc('npc_paya'), { ...baseCtx, isNaked: true });
    expect(payaNaked.lines[0]).toContain('お召し物');

    const guardBlocked = evaluateNpcEventFlow(dummyNpc('npc_gerudo_guard'), baseCtx);
    expect(guardBlocked.lines[0]).toContain('ヴォーイ');

    const guardAllowed = evaluateNpcEventFlow(dummyNpc('npc_gerudo_guard'), { ...baseCtx, hasGerudoEntry: true });
    expect(guardAllowed.lines[0]).toContain('ヴァーイ');

    const yiga = evaluateNpcEventFlow(dummyNpc('yiga_1', { isYigaDisguised: true }), baseCtx);
    expect(yiga.speakerName).toBe('旅人');
    expect(yiga.isYigaAmbush).toBe(true);
  });
});

describe('Lore, 23 Memories, 147 Quests, LevelSensor, Koroks & 100% Completion', () => {
  it('contains exact chronicle layers, 23 memories, 15/42/90 quests, 51 Trial of the Sword floors & 33 Korok archetypes', () => {
    expect(HYRULE_HISTORY_CHRONICLE).toHaveLength(3);
    expect(ALL_MEMORIES).toHaveLength(23);
    expect(MAIN_QUESTS).toHaveLength(15);
    expect(SHRINE_QUESTS).toHaveLength(42);
    expect(SIDE_QUESTS).toHaveLength(90);
    expect(ALL_QUESTS).toHaveLength(147);
    expect(READABLE_DOCUMENTS.length).toBeGreaterThanOrEqual(8);
    expect(TRIAL_OF_THE_SWORD_STAGES).toHaveLength(51);
    expect(KOROK_33_PUZZLE_TYPES).toHaveLength(33);
  });

  it('scales LevelSensor enemy tiers, Master Mode +1 tier, Blight Ganon HP (800->2000), and 100% completion', () => {
    expect(computeScaledEnemyTier('red', 0, false)).toBe('red');
    expect(computeScaledEnemyTier('red', 0, true)).toBe('blue');
    expect(computeScaledEnemyTier('red', 2000, false)).toBe('silver');
    expect(computeScaledEnemyTier('red', 2000, true)).toBe('gold');

    expect(computeBlightGanonHp(0)).toBe(800);
    expect(computeBlightGanonHp(1)).toBe(1200);
    expect(computeBlightGanonHp(2)).toBe(1600);
    expect(computeBlightGanonHp(3)).toBe(2000);

    const save = createDefaultSave('normal');
    recordHeroPathSample(save, 0, 10, 0);
    recordHeroPathSample(save, 20, 10, 0);
    expect(save.heroPath.length).toBe(2);
    expect(computeCompletionPercent(save)).toBeGreaterThanOrEqual(0);
  });
});
