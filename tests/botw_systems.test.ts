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
import {
  PhysicsChemistryEngine,
  computePlatformSupportGroundY,
  evaluateChemistryInteraction,
  evaluateElementVsElement,
} from '../src/physics/PhysicsChemistryEngine';
import {
  DivineBeastInteriorManager,
  DIVINE_BEAST_BASE_Y,
  applyDivineBeastLiberationRewards,
  type DivineBeastId,
} from '../src/world/DivineBeastInteriorManager';
import {
  HyruleCastleInteriorManager,
  HYRULE_CASTLE_SANCTUM_Y,
  DARK_BEAST_ARENA_Y,
  applyGanonDefeatedEnding,
  computeCalamityGanonStartingHp,
} from '../src/world/HyruleCastleInteriorManager';
import {
  TrialOfSwordManager,
  TRIAL_OF_SWORD_BASE_Y,
  getMasterSwordAwakeningStats,
  pullMasterSword,
} from '../src/world/TrialOfSwordManager';
import {
  ALL_MODEL_KEYS,
  DEFERRED_CHARACTER_MODELS,
  ESSENTIAL_PLATEAU_MODELS,
} from '../src/rendering/ModelLoader';
import { computeBlightGanonHp, computeScaledEnemyTier } from '../src/entities/EnemyAndBossSystem';
import {
  KOROK_33_PUZZLE_TYPES,
  NpcAndKorokSystem,
  evaluateNpcEventFlow,
  type WorldNpc,
} from '../src/entities/NpcAndKorokSystem';
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

describe('3D Spatial-Hash Collision, Camera Clamping & 21-GLB Progressive Loading Catalog', () => {
  it('blocks player capsule from clipping through AABB/OBB walls and cylinders, supports walkable tops, and clamps camera', () => {
    const scene = new THREE.Scene();
    const physics = new PhysicsChemistryEngine(scene);

    // Temple wall box: x in [-2, 2], z in [9, 11], y in [0, 8]
    physics.addBoxCollider('temple_wall', 0, 10, 4, 2, 0, 8, { climbable: true, walkableTop: true });
    // Pillar cylinder at (12, 10), radius 1.2, height 6
    physics.addCylinderCollider('ruin_pillar', 12, 10, 1.2, 0, 6, { climbable: true });
    // Walkable plinth step at (-10, 10), height 1.0
    physics.addBoxCollider('temple_step', -10, 10, 4, 4, 0, 1.0, { walkableTop: true });

    // 1. Walking into front face of temple wall pushes player cleanly outside z <= 9 - radius (0.44)
    const p = new THREE.Vector3(0, 0.1, 9.25);
    const hit = physics.resolveCapsuleCollision(p, 0.44, 1.65);
    expect(hit.collidedHorizontal).toBe(true);
    expect(hit.hitClimbable).toBe(true);
    expect(p.z).toBeLessThanOrEqual(8.57);
    expect(hit.hitNormal.z).toBeLessThan(-0.9);

    // 2. Cylinder pillar push-out keeps player radius outside pillar radius (1.2 + 0.44 = 1.64)
    const p2 = new THREE.Vector3(12.6, 0.1, 10.0);
    const hitCyl = physics.resolveCapsuleCollision(p2, 0.44, 1.65);
    expect(hitCyl.collidedHorizontal).toBe(true);
    expect(Math.hypot(p2.x - 12, p2.z - 10)).toBeGreaterThanOrEqual(1.63);

    // 3. Standing above walkable plinth reports supportY = 1.0 without horizontal push
    const pTop = new THREE.Vector3(-10, 1.05, 10);
    const hitTop = physics.resolveCapsuleCollision(pTop, 0.44, 1.65);
    expect(hitTop.collidedHorizontal).toBe(false);
    expect(hitTop.supportY).toBeCloseTo(1.0, 2);

    // 4. Camera raycast behind wall clamps forward in front of wall
    const camOut = new THREE.Vector3();
    const clamped = physics.clampCameraPosition(
      new THREE.Vector3(0, 1.5, 6.0),
      new THREE.Vector3(0, 1.5, 14.0),
      camOut
    );
    expect(clamped).toBe(camOut);
    expect(camOut.z).toBeLessThan(9.0);
  });

  it('partitions all 21 GLB models cleanly into lightweight essential tier + deferred heavy tier without overlap', () => {
    const combined = [...ESSENTIAL_PLATEAU_MODELS, ...DEFERRED_CHARACTER_MODELS];
    const unique = new Set(combined);
    expect(ALL_MODEL_KEYS).toHaveLength(21);
    expect(unique.size).toBe(21);
    expect(unique.has('sword_shield')).toBe(true);
    expect(unique.has('torch')).toBe(true);
    expect(unique.has('wall_arched')).toBe(true);
    expect(unique.has('stal_mage')).toBe(true);

    const save = createDefaultSave('normal');
    expect(save.settings.touchControlsMode).toBe('auto');
    expect(['high', 'medium', 'low']).toContain(save.settings.graphicsQuality);
    expect(save.hearts).toBe(3);
    expect(save.maxHearts).toBe(3);
    expect(save.stamina).toBe(100);
    expect(save.rupees).toBe(0);
    expect(save.hasSheikahSlate).toBe(false);
    expect(save.unlockedRunes).toEqual([]);
    expect(save.hasParaglider).toBe(false);
    expect(save.hasMasterSword).toBe(false);
    expect(save.equippedWeaponId).toBeNull();
    expect(save.equippedBowId).toBeNull();
    expect(save.equippedShieldId).toBeNull();
    expect(save.equippedArmor).toEqual({ head: null, body: null, legs: null });
    expect(save.ownedArmorIds).toEqual([]);
    expect(save.weapons).toEqual([]);
  });

  it('enforces Old Man non-spoiler identity & 4-Shrine Plateau completion gate before Paraglider reveal', async () => {
    const {
      PLATEAU_RUNE_SHRINE_IDS,
      hasCompletedAllPlateauShrines,
    } = await import('../src/entities/NpcAndKorokSystem');
    const { isRuneUnlocked } = await import('../src/gameplay/SheikahRunes');

    expect(hasCompletedAllPlateauShrines([])).toBe(false);
    expect(hasCompletedAllPlateauShrines(PLATEAU_RUNE_SHRINE_IDS.slice(0, 3))).toBe(false);
    expect(hasCompletedAllPlateauShrines([...PLATEAU_RUNE_SHRINE_IDS])).toBe(true);

    const oldManNpc = {
      id: 'npc_old_man',
      nameJa: '謎の老人',
      displayNameJa: '謎の老人',
      roleJa: '始まりの台地',
      region: 'great_plateau' as const,
      homePos: new THREE.Vector3(),
      shelterPos: new THREE.Vector3(),
      nightPos: new THREE.Vector3(),
      position: new THREE.Vector3(),
      yaw: 0,
      wakeHour: 0,
      sleepHour: 24,
      glbKey: 'npc_mage',
      root: new THREE.Group(),
      glbInstance: null,
      behaviorLabel: '活動中',
    };

    const earlyTalk = evaluateNpcEventFlow(oldManNpc, {
      isNaked: true,
      triggersNpcFear: false,
      hasGerudoEntry: false,
      isBloodMoon: false,
      isRaining: false,
      timeHours: 9,
      memoriesCount: 0,
      hasParaglider: false,
      plateauShrinesDone: false,
      tarreyTownStage: 0,
      thunderHelmRecovered: false,
    });
    expect(earlyTalk.speakerName).toBe('謎の老人');
    expect(earlyTalk.speakerName).not.toContain('ローム');

    const kingReveal = evaluateNpcEventFlow(oldManNpc, {
      isNaked: false,
      triggersNpcFear: false,
      hasGerudoEntry: false,
      isBloodMoon: false,
      isRaining: false,
      timeHours: 9,
      memoriesCount: 0,
      hasParaglider: true,
      plateauShrinesDone: true,
      tarreyTownStage: 0,
      thunderHelmRecovered: false,
    });
    expect(kingReveal.speakerName).toContain('ローム');

    expect(isRuneUnlocked(null, [])).toBe(false);
    expect(isRuneUnlocked('magnesis', [], true)).toBe(false);
    expect(isRuneUnlocked('magnesis', ['magnesis'], false)).toBe(false);
    expect(isRuneUnlocked('magnesis', ['magnesis'], true)).toBe(true);
    expect(isRuneUnlocked('camera', ['magnesis'], true)).toBe(false);
  });

  it('validates v6 Phase A guards: weapon/shield/slate locks, Goddess Statue Orb exchange, and Dye/Fairy rupee deductions', async () => {
    const {
      canPerformMeleeAttack,
      canPerformShieldAction,
      canUseSheikahFeatures,
      createDefaultSave,
      exchangeSpiritOrbs,
      purchaseArmorDye,
      purchaseGreatFairyUpgrade,
    } = await import('../src/save/SaveManager');
    const { GREAT_FAIRY_UPGRADE_COSTS } = await import('../src/data/armors');
    const { PLATEAU_SHRINE_RUNE_MAP } = await import('../src/world/ShrineInteriorManager');

    const save = createDefaultSave('normal');

    // 1. Fresh Awakening in SoR room 1: no Slate, no weapon, no shield
    expect(save.playerPos.x).toBeLessThan(-320);
    expect(canUseSheikahFeatures(save)).toBe(false);
    expect(canPerformMeleeAttack(save)).toBe(false);
    expect(canPerformShieldAction(save)).toBe(false);

    // 2. Equipping valid items & picking up Slate unlocks guards cleanly
    save.hasSheikahSlate = true;
    save.weapons.push({
      id: 'travelers_sword',
      nameJa: '旅人の剣',
      nameEn: "Traveler's Sword",
      category: 'sword',
      attack: 5,
      durability: 20,
      currentDurability: 20,
      material: 'Metal',
      color: '#9ba2aa',
      accentColor: '#6d4c32',
    });
    save.equippedWeaponId = 'travelers_sword';
    save.shields.push({
      id: 'pot_lid',
      nameJa: 'ナベのフタ',
      nameEn: 'Pot Lid',
      category: 'shield',
      attack: 1,
      durability: 10,
      currentDurability: 10,
      material: 'Wood',
      color: '#9c7852',
      accentColor: '#6a4e32',
    });
    save.equippedShieldId = 'pot_lid';

    expect(canUseSheikahFeatures(save)).toBe(true);
    expect(canPerformMeleeAttack(save)).toBe(true);
    expect(canPerformShieldAction(save)).toBe(true);

    // 3. Goddess Statue Spirit Orb exchange (4 orbs -> +1 Heart or +20 Stamina, blocks if <4)
    save.spiritOrbs = 3;
    expect(exchangeSpiritOrbs(save, 'heart').ok).toBe(false);
    expect(save.maxHearts).toBe(3);

    save.spiritOrbs = 8;
    expect(exchangeSpiritOrbs(save, 'heart').ok).toBe(true);
    expect(save.maxHearts).toBe(4);
    expect(save.spiritOrbs).toBe(4);
    expect(exchangeSpiritOrbs(save, 'stamina').ok).toBe(true);
    expect(save.maxStamina).toBe(120);
    expect(save.spiritOrbs).toBe(0);

    // 4. Dye Shop (20 rupees) & Great Fairy Upgrade rupee deduction & insufficient-rupee rejection
    save.rupees = 10;
    const dyeFail = purchaseArmorDye(save, 'crimson', [{ id: 'hylian_tunic', dyeable: true }], 20);
    expect(dyeFail.ok).toBe(false);
    expect(save.rupees).toBe(10);

    save.rupees = 100;
    const dyeOk = purchaseArmorDye(save, 'crimson', [{ id: 'hylian_tunic', dyeable: true }], 20);
    expect(dyeOk.ok).toBe(true);
    expect(save.rupees).toBe(80);
    expect(save.armorDyes['hylian_tunic']).toBe('crimson');

    const fairyOk = purchaseGreatFairyUpgrade(save, 'hylian_tunic', true, GREAT_FAIRY_UPGRADE_COSTS[1].rupees);
    expect(fairyOk.ok).toBe(true);
    expect(save.armorStars['hylian_tunic']).toBe(1);
    expect(save.rupees).toBe(30); // 80 - 50 for ★1!

    // ★2 costs 150 rupees -> must reject with 30 rupees left
    const fairyFail = purchaseGreatFairyUpgrade(save, 'hylian_tunic', true, GREAT_FAIRY_UPGRADE_COSTS[2].rupees);
    expect(fairyFail.ok).toBe(false);
    expect(save.armorStars['hylian_tunic']).toBe(1);

    // 5. All 4 Great Plateau Shrine rune pedestal assignments exist
    expect(PLATEAU_SHRINE_RUNE_MAP['shrine_oman_au'].runes).toEqual(['magnesis']);
    expect(PLATEAU_SHRINE_RUNE_MAP['shrine_ja_baij'].runes).toEqual(['bomb_round', 'bomb_square']);
    expect(PLATEAU_SHRINE_RUNE_MAP['shrine_owa_daim'].runes).toEqual(['stasis']);
    expect(PLATEAU_SHRINE_RUNE_MAP['shrine_keh_namut'].runes).toEqual(['cryonis']);
  });
});

describe('v7 Hotfixes & Phase B: 4 Divine Beasts 3D Interiors & Blight Ganon Battles', () => {
  it('supports Oman Au 10.2m metal bridge spanning an 8m chasm via 9-point rotated footprint max height', () => {
    // Chasm between z=-3.5 and z=4.5 drops to Y=593; North & South ledges sit at Y=600
    const sampleOmanChasm = (_x: number, z: number) => (z > -3.5 && z < 4.5 ? 593 : 600);

    // Bridge centered directly over chasm (z = 0.5) with halfDepth = 5.1 reaches z=-4.6 and z=5.6 (both on Y=600!)
    const bridgeGroundY = computePlatformSupportGroundY(0, 0.5, 2.2, 5.1, 0, sampleOmanChasm);
    expect(bridgeGroundY).toBe(600);

    // Rotated 90° so length lies along X (both ends still over chasm z=0.5 ± 2.2 => z=-1.7..2.7) -> drops into chasm (593)
    const rotatedGroundY = computePlatformSupportGroundY(0, 0.5, 2.2, 5.1, Math.PI / 2, sampleOmanChasm);
    expect(rotatedGroundY).toBe(593);
  });

  it('supports entering all 4 Divine Beasts, 5 control terminals, mid-dungeon exit persistence, and real-time pose controls', () => {
    const scene = new THREE.Scene();
    const physics = new PhysicsChemistryEngine(scene);
    const manager = new DivineBeastInteriorManager(scene, physics);
    const save = createDefaultSave('normal');
    save.hasSheikahSlate = true;

    // 1. Vah Ruta: enter -> activate 2 terminals -> exit -> re-enter -> verify 2/5 preserved -> switch Trunk pose 0/1/2
    const r1 = manager.enterBeast('vah_ruta', save, new THREE.Vector3(1120, 20, -180), 0);
    expect(r1.spawnPos.y).toBe(DIVINE_BEAST_BASE_Y);
    expect(manager.getTerminalProgress()).toEqual({ activated: 0, total: 5 });
    expect(manager.activateTerminal('t1', save).ok).toBe(true);
    expect(manager.activateTerminal('t2', save).ok).toBe(true);
    expect(save.divineBeastTerminals['vah_ruta']).toEqual(['t1', 't2']);
    manager.applyPoseAction(2);
    expect(manager.poseIndex).toBe(2);
    manager.exitBeast();
    expect(manager.isActive()).toBe(false);

    // Re-enter Vah Ruta -> 2 terminals must remain activated!
    manager.enterBeast('vah_ruta', save, new THREE.Vector3(1120, 20, -180), 0);
    expect(manager.getTerminalProgress()).toEqual({ activated: 2, total: 5 });
    // t3 is sealed behind the Cryonis sluice gate until lifted!
    expect(manager.activateTerminal('t3', save).ok).toBe(false);
    expect(manager.onCryonisCreated(new THREE.Vector3(0, DIVINE_BEAST_BASE_Y, -5.8)).liftedGate).toBe(true);
    expect(manager.activateTerminal('t3', save).ok).toBe(true);
    expect(manager.activateTerminal('t4', save).ok).toBe(true);
    const r5 = manager.activateTerminal('t5', save);
    expect(r5.ok).toBe(true);
    expect(r5.allActivated).toBe(true);
    manager.exitBeast();

    // 2. Vah Rudania: 90° sideways tilt toggle + torch lighting
    manager.enterBeast('vah_rudania', save, new THREE.Vector3(560, 180, -870), 0);
    expect(manager.poseIndex).toBe(0);
    manager.applyPoseAction(1);
    expect(manager.poseIndex).toBe(1);
    expect(manager.igniteTorch('rud_t1')).toBe(true);
    expect(manager.rudaniaTorchesLit).toBe(1);
    manager.exitBeast();

    // 3. Vah Medoh: 3-stage Wing Seesaw Tilt (Left 0 / Level 1 / Right 2)
    manager.enterBeast('vah_medoh', save, new THREE.Vector3(-1080, 120, -500), 0);
    expect(manager.poseIndex).toBe(1);
    manager.applyPoseAction(0);
    expect(manager.poseIndex).toBe(0);
    manager.applyPoseAction(2);
    expect(manager.poseIndex).toBe(2);
    manager.exitBeast();

    // 4. Vah Naboris: 3 cylindrical drums [90, 180, 270] -> rotate to [0, 0, 0] to connect power circuit and unlock t5!
    manager.enterBeast('vah_naboris', save, new THREE.Vector3(-890, 20, 980), 0);
    expect(manager.naborisCircuitConnected).toBe(false);
    expect(manager.activateTerminal('t5', save).ok).toBe(false); // Blocked until circuit connected!
    // Front: 90 -> 180 -> 270 -> 0 (3 rotations); Mid: 180 -> 270 -> 0 (2); Rear: 270 -> 0 (1)
    manager.applyPoseAction(0);
    manager.applyPoseAction(0);
    manager.applyPoseAction(0);
    manager.applyPoseAction(1);
    manager.applyPoseAction(1);
    manager.applyPoseAction(2);
    expect(manager.naborisDrumAngles).toEqual([0, 0, 0]);
    expect(manager.naborisCircuitConnected).toBe(true);
    expect(manager.activateTerminal('t5', save).ok).toBe(true);
    manager.exitBeast();
  });

  it('scales Blight Ganon HP (800->1200->1600->2000), grants Heart Container +1, unlocks Champion Abilities, and unlocks DLC2 shrines after all 4 beasts', () => {
    const scene = new THREE.Scene();
    const physics = new PhysicsChemistryEngine(scene);
    const manager = new DivineBeastInteriorManager(scene, physics);
    const save = createDefaultSave('normal');
    save.hasSheikahSlate = true;

    const beasts: Array<{ id: DivineBeastId; expectedHp: number; champ: keyof typeof save.champions }> = [
      { id: 'vah_ruta', expectedHp: 800, champ: 'mipha' },
      { id: 'vah_rudania', expectedHp: 1200, champ: 'daruk' },
      { id: 'vah_medoh', expectedHp: 1600, champ: 'revali' },
      { id: 'vah_naboris', expectedHp: 2000, champ: 'urbosa' },
    ];

    let expectedHearts = 3;
    for (let i = 0; i < beasts.length; i++) {
      const b = beasts[i];
      expect(computeBlightGanonHp(save.defeatedDivineBeasts.length)).toBe(b.expectedHp);

      manager.enterBeast(b.id, save, new THREE.Vector3(0, 10, 0), 0);
      const boss = manager.startBlightBossBattle(save);
      expect(boss).not.toBeNull();
      expect(boss!.maxHp).toBe(b.expectedHp);

      // Defeat boss and claim liberation rewards
      const reward = applyDivineBeastLiberationRewards(save, b.id);
      expectedHearts += 1;
      expect(reward.newlyFreed).toBe(true);
      expect(reward.newMaxHearts).toBe(expectedHearts);
      expect(save.maxHearts).toBe(expectedHearts);
      expect(save.champions[b.champ].unlocked).toBe(true);
      expect(save.champions[b.champ].charges).toBe(save.champions[b.champ].maxCharges);
      expect(reward.allFourFreed).toBe(i === 3);

      manager.exitBeast();
    }

    expect(save.defeatedDivineBeasts).toEqual(['vah_ruta', 'vah_rudania', 'vah_medoh', 'vah_naboris']);
    expect(save.maxHearts).toBe(7); // 3 base + 4 Heart Containers!
  });
});

describe('v8 PART 1: Divine Beast Bug Fixes (Stasis Ice Reflection, Bulkheads, Electrodes, Ball Switch)', () => {
  it('reflects Waterblight Phase 2 ice_block via Stasis release and downs Waterblight on impact', () => {
    const scene = new THREE.Scene();
    const physics = new PhysicsChemistryEngine(scene);
    const manager = new DivineBeastInteriorManager(scene, physics);
    const save = createDefaultSave('normal');
    save.hasSheikahSlate = true;

    manager.enterBeast('vah_ruta', save, new THREE.Vector3(0, 10, 0), 0);
    const boss = manager.startBlightBossBattle(save)!;
    const startHp = boss.hp;
    const playerPos = new THREE.Vector3(0, DIVINE_BEAST_BASE_Y, 4);

    // Spawn an ice_block projectile and freeze it with Stasis
    const proj = manager.spawnBossProjectile('ice_block', boss.position, playerPos, 10);
    expect(proj.physicsBody).toBeDefined();
    proj.physicsBody!.isFrozenStasis = true;
    manager.update(0.05, playerPos, true);
    expect(proj.wasFrozenStasis).toBe(true);

    // Release Stasis with launched velocity from melee hits -> must flip reflected = true and hit boss!
    proj.physicsBody!.isFrozenStasis = false;
    proj.physicsBody!.velocity.set(0, 0, -24);
    let downedMsg: string | undefined;
    for (let step = 0; step < 30; step++) {
      const out = manager.update(0.05, playerPos, true);
      if (out.bossDownedByGimmick) {
        downedMsg = out.bossDownedByGimmick;
        break;
      }
    }
    expect(downedMsg).toBeDefined();
    expect(boss.state).toBe('downed');
    expect(boss.hp).toBeLessThan(startHp);
    manager.exitBeast();
  });

  it('enforces Vah Ruta bulkheads, Vah Naboris electrode socket for t4, and Vah Medoh ball switch for t5', () => {
    const scene = new THREE.Scene();
    const physics = new PhysicsChemistryEngine(scene);
    const manager = new DivineBeastInteriorManager(scene, physics);
    const save = createDefaultSave('normal');
    save.hasSheikahSlate = true;

    // 1. Vah Ruta bulkhead colliders exist around sluice gate
    manager.enterBeast('vah_ruta', save, new THREE.Vector3(0, 10, 0), 0);
    const colliderIds = physics.staticColliders.map((c) => c.id);
    expect(colliderIds).toContain('ruta_sluice_wall_w');
    expect(colliderIds).toContain('ruta_sluice_wall_e');
    expect(manager.activateTerminal('t3', save).ok).toBe(false);
    manager.exitBeast();

    // 2. Vah Naboris conductor placed in 2-pole electrode socket unlocks t4 independently of t5 drum circuit
    manager.enterBeast('vah_naboris', save, new THREE.Vector3(0, 10, 0), 0);
    expect(manager.naborisConductorConnected).toBe(false);
    expect(manager.activateTerminal('t4', save).ok).toBe(false);
    const cond = physics.bodies.find((b) => b.id === 'naboris_conductor')!;
    cond.position.set(11.0, DIVINE_BEAST_BASE_Y, -4.0);
    manager.update(0.05, new THREE.Vector3(0, DIVINE_BEAST_BASE_Y, 10), true);
    expect(manager.naborisConductorConnected).toBe(true);
    expect(manager.activateTerminal('t4', save).ok).toBe(true);
    expect(manager.activateTerminal('t5', save).ok).toBe(false); // 3-drum circuit still independently required!
    manager.exitBeast();

    // 3. Vah Medoh Wing Tilt rolls metal ball into pressure switch unlocking t5
    manager.enterBeast('vah_medoh', save, new THREE.Vector3(0, 10, 0), 0);
    expect(manager.medohSwitchUnlocked).toBe(false);
    expect(manager.activateTerminal('t5', save).ok).toBe(false);
    manager.applyPoseAction(2); // Tilt Right (+18°)
    for (let i = 0; i < 25; i++) {
      manager.update(0.1, new THREE.Vector3(0, DIVINE_BEAST_BASE_Y, 10), true);
    }
    expect(manager.medohSwitchUnlocked).toBe(true);
    expect(manager.activateTerminal('t5', save).ok).toBe(true);
    manager.exitBeast();
  });
});

describe('v8 PART 2.1: Hyrule Castle Sanctum (Y=1200) & Dark Beast Ganon (Y=1350)', () => {
  it('reduces Calamity Ganon HP by 12.5% per freed Divine Beast (50% for all 4)', () => {
    expect(computeCalamityGanonStartingHp(0)).toBe(4000);
    expect(computeCalamityGanonStartingHp(1)).toBe(3500);
    expect(computeCalamityGanonStartingHp(2)).toBe(3000);
    expect(computeCalamityGanonStartingHp(3)).toBe(2500);
    expect(computeCalamityGanonStartingHp(4)).toBe(2000);
  });

  it('activates Phase 2 Golden Shield blocking normal attacks and shattering only on Perfect Guard / Flurry Rush / Urbosa, then defeats Dark Beast Ganon for Ending', () => {
    const scene = new THREE.Scene();
    const physics = new PhysicsChemistryEngine(scene);
    const castle = new HyruleCastleInteriorManager(scene, physics);
    const save = createDefaultSave('normal');
    save.defeatedDivineBeasts = ['vah_ruta', 'vah_rudania', 'vah_medoh', 'vah_naboris'];

    const entered = castle.enterSanctum(save, new THREE.Vector3(-80, 10, -260), 0);
    expect(entered.spawnPos.y).toBe(HYRULE_CASTLE_SANCTUM_Y);
    expect(entered.startingHp).toBe(2000);
    expect(castle.calamityBoss!.hp).toBe(2000);

    // Damage down to Phase 2 threshold (<= 1000) -> Golden Shield activates!
    const atkOrigin = castle.calamityBoss!.position.clone().add(new THREE.Vector3(0, 1, 3));
    const atkDir = new THREE.Vector3(0, 0, -1);
    castle.onPlayerAttack(atkOrigin, atkDir, 5, 1100, false, false);
    expect(castle.calamityBoss!.phase).toBe(2);
    expect(castle.calamityBoss!.goldenShieldActive).toBe(true);

    // Normal attack is blocked by Golden Shield (0 damage!)
    const hpBeforeBlocked = castle.calamityBoss!.hp;
    const blocked = castle.onPlayerAttack(atkOrigin, atkDir, 5, 100, false, false);
    expect(blocked.blockedByShield).toBe(true);
    expect(castle.calamityBoss!.hp).toBe(hpBeforeBlocked);

    // Perfect Guard / Flurry Rush / Urbosa breaks Golden Shield into downed state!
    const br = castle.breakGoldenShield('perfect_guard');
    expect(br.broken).toBe(true);
    expect(castle.calamityBoss!.goldenShieldActive).toBe(false);
    expect(castle.calamityBoss!.state).toBe('downed');

    // Transition to Dark Beast Ganon (Y=1350) -> grants Bow of Light (ATK 100)
    const dbEnter = castle.enterDarkBeastArena(save);
    expect(dbEnter.spawnPos.y).toBe(DARK_BEAST_ARENA_Y);
    expect(save.equippedBowId).toBe('bow_of_light');
    expect(save.bows.some((b) => b.id === 'bow_of_light' && b.attack === 100)).toBe(true);

    // Shoot all 6 glowing crests sequentially -> exposes final top Malice Eye
    const db = castle.darkBeastBoss!;
    for (let i = 0; i < 6; i++) {
      const active = db.crests.find((c) => c.active)!;
      const res = castle.onPlayerAttack(active.worldPos, new THREE.Vector3(0, 0, -1), 3, 100, true, true);
      expect(res.crestDestroyed).toBe(true);
    }
    expect(db.finalEyeExposed).toBe(true);

    // Shoot final Malice Eye -> Dark Beast Ganon defeated -> Ending summary & ganon_defeated flag!
    const finalRes = castle.onPlayerAttack(db.finalEyePos, new THREE.Vector3(0, 0, -1), 3, 100, true, true);
    expect(finalRes.darkBeastDefeated).toBe(true);
    const summary = applyGanonDefeatedEnding(save);
    expect(save.storyFlags.ganon_defeated).toBe(true);
    expect(summary.creatorCredit).toBe('製作者:駿 (Created by Shun)');
    castle.exitCastle();
  });
});

describe('v8 PART 2.2: Trial of the Sword (Y=1500) Inventory Isolation & Master Sword Awakening', () => {
  it('enforces 13-heart Master Sword pull, isolates inventory during Trial, restores 100% on exit/clear, and awakens Master Sword to ATK 60', () => {
    const scene = new THREE.Scene();
    const physics = new PhysicsChemistryEngine(scene);
    const trial = new TrialOfSwordManager(scene, physics);
    const save = createDefaultSave('normal');

    // Blocked at 3 hearts
    expect(pullMasterSword(save).pulled).toBe(false);
    // Pull succeeds at 13 hearts
    save.maxHearts = 13;
    save.hearts = 13;
    expect(pullMasterSword(save).pulled).toBe(true);
    expect(save.hasMasterSword).toBe(true);
    expect(getMasterSwordAwakeningStats(save).attack).toBe(30);

    // Give player custom overworld items to verify 100% snapshot & restore!
    save.materials.apple = 17;
    save.equippedArmor = { head: 'hylian_hood', body: 'champions_tunic', legs: 'hylian_trousers' };
    const origWeaponCount = save.weapons.length;

    // Enter Final Trials -> stripped naked & unarmed
    const entered = trial.enterTrial('final', save, new THREE.Vector3(60, 15, -682), 0);
    expect(entered.spawnPos.y).toBe(TRIAL_OF_SWORD_BASE_Y);
    expect(save.weapons).toHaveLength(0);
    expect(save.equippedArmor.body).toBeNull();
    expect(save.materials.apple).toBeUndefined();

    // Auto-save persistence protection MUST keep real overworld inventory intact!
    const persisted = trial.getSafeSaveForPersistence(save);
    expect(persisted.weapons).toHaveLength(origWeaponCount);
    expect(persisted.materials.apple).toBe(17);
    expect(persisted.equippedArmor.body).toBe('champions_tunic');

    // Exit with cleared=true -> restores 100% overworld inventory + awakens Master Sword to ATK 60 / dur 188!
    trial.exitTrial(save, true);
    expect(save.weapons).toHaveLength(origWeaponCount);
    expect(save.materials.apple).toBe(17);
    expect(save.equippedArmor.body).toBe('champions_tunic');
    expect(save.masterSwordAwakened).toBe(true);
    const awakened = getMasterSwordAwakeningStats(save);
    expect(awakened.attack).toBe(60);
    expect(awakened.durability).toBe(188);
  });
});

describe('v8 PART 2.3: 33 Real Korok Puzzles & Wild Horse Taming', () => {
  it('blocks solving non-interact Korok puzzles with E alone and solves each puzzle family via its real mechanic', () => {
    const scene = new THREE.Scene();
    const npcs = new NpcAndKorokSystem(scene);
    npcs.populateAll([]);

    expect(npcs.koroks).toHaveLength(33);
    const liftK = npcs.koroks.find((k) => k.puzzleFamily === 'lift_rock')!;
    const magK = npcs.koroks.find((k) => k.puzzleFamily === 'magnesis_block')!;
    const shootK = npcs.koroks.find((k) => k.puzzleFamily === 'shoot_target')!;
    const diveK = npcs.koroks.find((k) => k.puzzleFamily === 'dive_ring')!;
    const offerK = npcs.koroks.find((k) => k.puzzleFamily === 'offering_or_boulder')!;

    // Pressing E alone MUST NOT solve magnesis_block, shoot_target, or dive_ring!
    expect(npcs.tryInteractKorok(magK.id).solved).toBe(false);
    expect(npcs.tryInteractKorok(shootK.id).solved).toBe(false);
    expect(npcs.tryInteractKorok(diveK.id).solved).toBe(false);
    expect(magK.found).toBe(false);
    expect(shootK.found).toBe(false);
    expect(diveK.found).toBe(false);

    // Solving each family via its real mechanic sets found = true!
    expect(npcs.tryInteractKorok(liftK.id).solved).toBe(true);
    expect(npcs.tryInteractKorok(offerK.id).solved).toBe(true);
    expect(npcs.tryMagnesisSolveKorok(magK.targetPos)).toBe(magK);
    expect(npcs.tryShootKorokTarget(shootK.targetPos)).toBe(shootK);
    expect(npcs.checkDiveRingKoroks(diveK.targetPos, -4.5, false)).toBe(diveK);
    expect([liftK, magK, shootK, diveK, offerK].every((k) => k.found)).toBe(true);
  });

  it('transitions wild horse through wild -> bucking -> tamed -> registered at Stable', () => {
    const scene = new THREE.Scene();
    const npcs = new NpcAndKorokSystem(scene);
    npcs.populateAll([]);

    const horse = npcs.wildlife.find((w) => w.type === 'horse')!;
    expect(horse.tameState).toBe('wild');
    expect(horse.tamed).toBe(false);

    // Mount wild horse -> bucking
    expect(npcs.mountHorse(horse).state).toBe('bucking');
    expect(horse.tameState).toBe('bucking');

    // Soothe 3 times -> tamed!
    npcs.sootheHorse(horse);
    npcs.sootheHorse(horse);
    const finalSoothe = npcs.sootheHorse(horse);
    expect(finalSoothe.tamedNow).toBe(true);
    expect(horse.tamed).toBe(true);
    expect(horse.tameState).toBe('tamed');

    // Register at Stable -> registered!
    expect(npcs.registerHorseAtStable(horse).registered).toBe(true);
    expect(horse.tameState).toBe('registered');
  });
});


