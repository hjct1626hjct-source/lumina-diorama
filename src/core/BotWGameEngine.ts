import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import {
  ALL_MODEL_KEYS,
  DEFERRED_CHARACTER_MODELS,
  ESSENTIAL_PLATEAU_MODELS,
  modelLoader,
} from '../rendering/ModelLoader';
import { TerrainChunkManager } from '../world/TerrainChunkManager';
import { WeatherClimateSystem, type ClimateStatus } from '../world/WeatherClimateSystem';
import {
  ArchitectureBuilder,
  type WorldChest,
  type WorldShrine,
  type WorldTorch,
  type WorldTower,
  type WorldWeaponDrop,
} from '../world/ArchitectureBuilder';
import {
  ShrineInteriorManager,
  PLATEAU_SHRINE_RUNE_MAP as SHRINE_RUNE_INFO,
} from '../world/ShrineInteriorManager';
import {
  DivineBeastInteriorManager,
  DIVINE_BEAST_METAS,
  applyDivineBeastLiberationRewards,
  type DivineBeastId,
} from '../world/DivineBeastInteriorManager';
import { getRegionAt, getTerrainHeight } from '../world/TerrainGenerator';
import { PhysicsChemistryEngine } from '../physics/PhysicsChemistryEngine';
import { SheikahRuneSystem } from '../gameplay/SheikahRunes';
import { PlayerController, type InputState } from '../gameplay/PlayerController';
import { EnemyAndBossSystem, SPECIES_KILL_POINTS, type WorldEnemy } from '../entities/EnemyAndBossSystem';
import {
  NpcAndKorokSystem,
  evaluateNpcEventFlow,
  hasCompletedAllPlateauShrines,
  type WorldKorok,
  type WorldNpc,
} from '../entities/NpcAndKorokSystem';
import { BotWHudAndMenu } from '../ui/BotWHudAndMenu';
import { TouchControls, isTouchCapableDevice } from '../input/TouchControls';
import { audioEngine } from '../audio/OpenAirAudioEngine';
import {
  canPerformMeleeAttack,
  canUseSheikahFeatures,
  createDefaultSave,
  getAutoSlotId,
  getManualSlotId,
  recordHeroPathSample,
  saveManager,
  type SaveSlotId,
} from '../save/SaveManager';
import { ARMOR_MAP, computeArmorSummary } from '../data/armors';
import {
  AUTO_PARRY_LASER_SHIELD_IDS,
  MATERIAL_MAP,
  SHIELDS,
  WEAPONS,
  computeBotWDamage,
  computeMasterCycleFuel,
} from '../data/itemsAndCooking';
import { ALL_MEMORIES, COMPENDIUM_CATALOG } from '../data/storyAndQuests';
import { LANDMARKS, PHYSICAL_SHRINES } from '../data/regions';
import type { GraphicsQuality, RuneId, SaveSlotData } from '../types/botw';

type NearbyInteractable =
  | { kind: 'slatePedestal'; label: string }
  | { kind: 'sorTerminal'; label: string }
  | { kind: 'goddess'; label: string }
  | { kind: 'campfire'; position: THREE.Vector3; label: string }
  | { kind: 'npc'; npc: WorldNpc; label: string }
  | { kind: 'chest'; chest: WorldChest; label: string }
  | { kind: 'weaponDrop'; drop: WorldWeaponDrop; label: string }
  | { kind: 'torch'; torch: WorldTorch; label: string }
  | { kind: 'shrine'; shrine: WorldShrine; label: string }
  | { kind: 'tower'; tower: WorldTower; label: string }
  | { kind: 'pot'; label: string }
  | { kind: 'memory'; memoryId: string; label: string }
  | { kind: 'korok'; korok: WorldKorok; label: string }
  | { kind: 'shrineInteriorPedestal'; label: string }
  | { kind: 'shrineInteriorAltar'; label: string }
  | { kind: 'shrineInteriorChest'; id: string; label: string }
  | { kind: 'shrineInteriorExit'; label: string }
  | { kind: 'divineBeastBoard'; beastId: DivineBeastId; label: string }
  | { kind: 'beastTerminal'; id: string; label: string }
  | { kind: 'beastMainUnit'; label: string }
  | { kind: 'beastTorch'; id: string; label: string }
  | { kind: 'beastExit'; label: string };

/**
 * Master 60fps Three.js WebGL2 Open-Air Breath of the Wild Engine (PC & iPad Multi-Touch Ready).
 */
export class BotWGameEngine {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private useComposer = true;
  private activeQuality: GraphicsQuality = 'high';
  private lastCompendiumSnapshotUrl: string | null = null;
  private deferredPreloadPromise: Promise<void> = Promise.resolve();

  public terrain!: TerrainChunkManager;
  public weather!: WeatherClimateSystem;
  public physics!: PhysicsChemistryEngine;
  public architecture!: ArchitectureBuilder;
  public shrineInterior!: ShrineInteriorManager;
  public divineBeastInterior!: DivineBeastInteriorManager;
  public runes!: SheikahRuneSystem;
  public player!: PlayerController;
  public enemies!: EnemyAndBossSystem;
  public npcs!: NpcAndKorokSystem;
  public ui!: BotWHudAndMenu;
  public touchControls!: TouchControls;

  public save: SaveSlotData;
  public climate!: ClimateStatus;

  private input: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    moveX: 0,
    moveY: 0,
    sprint: false,
    jump: false,
    crouch: false,
    guard: false,
    aimBow: false,
    whistle: false,
    cameraYaw: -Math.PI * 0.5, // Looks East inside 2-room Shrine of Resurrection toward Sheikah Slate Pedestal
    cameraPitch: 0.08,
    cameraDist: 5.2,
  };

  private paused = false;
  private initialized = false;
  private isShrineTransitioning = false;
  private savedOverworldBg: THREE.Color | THREE.Texture | null = null;
  private savedOverworldFog: THREE.Fog | THREE.FogExp2 | null = null;
  private lastFrameMs = 0;
  private elapsedSec = 0;
  private fps = 60;
  private autoSaveTimer = 0;
  private hazardTickTimer = 0;
  private revivalRandomTimer = 0;
  private lockedEnemy: WorldEnemy | null = null;
  private activeDialogueNpc: WorldNpc | null = null;
  private nearestInteract: NearbyInteractable | null = null;
  private isDraggingCamera = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private cameraOverride: { pos: THREE.Vector3; lookAt: THREE.Vector3 } | null = null;
  private awakeningCutTimer = 0;
  private panoramaCutTimer = 0;
  private readonly panoramaDuration = 4.6;
  private readonly camLookScratch = new THREE.Vector3();
  private readonly camDesiredScratch = new THREE.Vector3();
  private readonly camClampedScratch = new THREE.Vector3();

  // ZL Lock-on Golden Reticle
  private lockReticle: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement) {
    const isTouch = isTouchCapableDevice();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isTouch,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false, // Always false for optimal iPad/mobile GPU bandwidth; Camera Rune uses 1-frame synchronous capture!
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#8ec8ec');

    this.camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.25, 2900);

    // Painterly Post-Processing Pipeline (enabled on High quality; bypassed on Medium/Low for steady iPad framerate!)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.22,
      0.45,
      0.86
    );
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    // Golden ZL Targeting Reticle
    this.lockReticle = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.06, 6, 16),
      new THREE.MeshBasicMaterial({ color: '#ffe44c' })
    );
    this.lockReticle.visible = false;
    this.scene.add(this.lockReticle);

    this.save = createDefaultSave('normal');
  }

  async init(): Promise<void> {
    // 1. Progressive Tier-1 Preload: lightweight ~1.16MB plateau props/wildlife/equipment GLBs so Title opens instantly on iPad!
    await modelLoader.preload(ESSENTIAL_PLATEAU_MODELS);

    // 2. Load existing auto-save if present (filling in new iPad settings defaults for older saves)
    const saved = await saveManager.load('botw_normal_auto');
    if (saved) {
      this.save = saved;
    }
    this.ensureSettingsDefaults();

    // 3. Instantiate World, Physics/Chemistry, Terrain (linked to Physics for prop colliders!), Architecture, Runes, Player, Enemies, NPCs, UI & TouchControls
    this.weather = new WeatherClimateSystem(this.scene);
    this.weather.timeHours = this.save.inGameTimeHours;
    this.weather.daysElapsed = this.save.daysElapsed;
    this.weather.bloodMoonTimerSec = this.save.bloodMoonTimerSec;

    this.physics = new PhysicsChemistryEngine(this.scene);
    this.terrain = new TerrainChunkManager(this.physics);
    this.scene.add(this.terrain.group);

    this.architecture = new ArchitectureBuilder(this.scene, this.physics);
    this.shrineInterior = new ShrineInteriorManager(this.scene, this.physics);
    this.divineBeastInterior = new DivineBeastInteriorManager(this.scene, this.physics);
    this.runes = new SheikahRuneSystem(this.scene);
    this.player = new PlayerController(this.scene);
    this.enemies = new EnemyAndBossSystem(this.scene);
    this.npcs = new NpcAndKorokSystem(this.scene);

    // Seamless async hot-swap whenever heavy Tier-2 character/skeleton GLBs finish streaming in background
    modelLoader.onAnyModelLoaded((key) => {
      this.npcs.hotSwapModel(key);
      this.enemies.hotSwapModel(key);
    });

    this.ui = new BotWHudAndMenu({
      onStartNewGame: (mode, skipIntro) => {
        if (this.shrineInterior.isActive()) this.exitShrineImmediate();
        if (this.divineBeastInterior.isActive()) this.exitDivineBeastImmediate();
        this.save = createDefaultSave(mode);
        this.ensureSettingsDefaults();
        this.runes.selectRune(null);
        this.applyLoadedSave();
        if (!skipIntro) {
          this.startAwakeningSequence();
        }
      },
      onContinueGame: () => {
        this.applyLoadedSave();
      },
      onSelectRune: (r) => {
        this.runes.selectRune(r, this.save.unlockedRunes);
        audioEngine.playUiSelect();
      },
      onTriggerInteract: () => this.performInteract(),
      onFastTravel: (x, z, labelJa) => {
        if (this.shrineInterior.isActive()) {
          this.exitShrineImmediate();
        }
        if (this.divineBeastInterior.isActive()) {
          this.exitDivineBeastImmediate();
        }
        this.player.teleportTo(x, z, 0.5);
        this.terrain.update(x, z);
        this.ui.showToast(`🌀 ワープ完了：${labelJa}`, 'cyan');
        audioEngine.playShrineChime();
      },
      onSaveManual: (idx) => {
        this.syncSaveFromRuntime();
        void saveManager.save(getManualSlotId(this.save.mode, idx), this.save);
      },
      onLoadSlot: async (slotId) => {
        const loaded = await saveManager.load(slotId as SaveSlotId);
        if (loaded) {
          if (this.shrineInterior.isActive()) this.exitShrineImmediate();
          if (this.divineBeastInterior.isActive()) this.exitDivineBeastImmediate();
          this.save = loaded;
          this.ensureSettingsDefaults();
          this.applyLoadedSave();
          this.ui.showToast(`セーブデータ ${slotId} を読み込みました！`, 'cyan');
        }
      },
      onSwitchMode: (mode) => {
        this.save.mode = mode;
        this.enemies.populateWorld(this.save.levelSensorPoints, mode === 'master', this.save.defeatedDivineBeasts.length);
        this.ui.showToast(mode === 'master' ? '▲ マスターモード起動！（全敵1ランク昇格・HP自動回復）' : '通常モードへ切替', mode === 'master' ? 'red' : 'cyan');
      },
      onDialogueAction: (act) => this.handleDialogueAction(act),
      onDialogueClose: () => {
        if (this.activeDialogueNpc?.isYigaDisguised && !this.activeDialogueNpc.yigaTriggered) {
          this.activeDialogueNpc.yigaTriggered = true;
          this.activeDialogueNpc.root.visible = false;
          this.enemies.spawnYigaAmbush(this.activeDialogueNpc.position, !!this.save.storyFlags['Electric_Relic_GetBack']);
          this.ui.showToast('⚔ イーガ団の刺客が正体を現した！！', 'red');
        }
        this.activeDialogueNpc = null;
      },
      onShopBuy: (itemId, price) => {
        if (this.save.rupees < price) {
          this.ui.showToast('ルピーが足りません！', 'red');
          return;
        }
        this.save.rupees -= price;
        if (itemId === 'arrow_bundle') {
          this.save.arrows.normal = (this.save.arrows.normal ?? 0) + 10;
        } else {
          this.save.materials[itemId] = (this.save.materials[itemId] ?? 0) + 1;
        }
        audioEngine.playUiConfirm();
        this.ui.showToast(`購入しました！（残 ${this.save.rupees} ルピー）`, 'cyan');
      },
      onEatMeal: (idx) => {
        const meal = this.save.meals.splice(idx, 1)[0];
        if (!meal) return;
        this.save.hearts = Math.min(this.save.maxHearts, this.save.hearts + meal.hearts);
        if (meal.tempHearts > 0) this.save.tempHearts = Math.max(this.save.tempHearts, meal.tempHearts);
        if (meal.staminaRestore > 0) this.save.stamina = Math.min(this.save.maxStamina, this.save.stamina + meal.staminaRestore);
        if (meal.tempStamina > 0) this.player.tempStamina = Math.max(this.player.tempStamina, meal.tempStamina);
        audioEngine.playUiConfirm();
        this.ui.showToast(`${meal.nameJa} を食べた！`, 'amber');
      },
      onRefuelBike: (matIds) => {
        const gained = computeMasterCycleFuel(matIds);
        this.runes.bikeFuel = Math.min(1000, this.runes.bikeFuel + gained);
        this.save.masterCycleFuel = this.runes.bikeFuel;
        audioEngine.playMasterCycleRev();
        this.ui.showToast(`マスターバイク零式 給油 +${gained} ユニット！（残 ${Math.round(this.runes.bikeFuel)}/1000）`, 'cyan');
      },
      onCookDone: (mealName, critical) => {
        audioEngine.playCookingJingle(critical);
        this.ui.showToast(`🍲 料理完成：${mealName}${critical ? ' ✨大成功！' : ''}`, critical ? 'amber' : 'cyan');
      },
      onWaitAtFire: (targetHour) => {
        const diff = ((targetHour - this.weather.timeHours) + 24) % 24 || 24;
        this.weather.advanceTimeHours(diff);
        audioEngine.playUiConfirm();
        this.ui.showToast(`🔥 焚き火で休んで ${String(targetHour).padStart(2, '0')}:00 まで進めました`, 'amber');
      },
      onTogglePause: (p) => {
        this.paused = p;
      },
      onOpenBeastControl: () => this.openDivineBeastControl(),
      onSettingsChanged: () => this.applyUserSettings(),
      onNotify: (t, a) => this.ui.showToast(t, a),
    });

    this.touchControls = new TouchControls({
      onCameraLook: (dx, dy) => {
        this.input.cameraYaw -= dx * 0.0062;
        this.input.cameraPitch = THREE.MathUtils.clamp(this.input.cameraPitch + dy * 0.0048, -0.35, 1.05);
      },
      onAttack: (isChargedSpin) => {
        if (this.runes.cameraModeActive) {
          this.activateRune();
        } else {
          this.performMeleeAttack(isChargedSpin);
        }
      },
      onJumpOrGlide: () => {
        this.player.triggerJumpOrParaglider(this.save, () => audioEngine.playParagliderOpen());
      },
      onDodge: () => this.triggerPlayerDodge(),
      onGuardStart: () => {
        this.player.triggerGuardStart(this.save, (m) => this.ui.showToast(m, 'amber'));
      },
      onToggleZL: () => this.toggleZLTarget(),
      onActivateRune: () => this.activateRune(),
      onBowRelease: () => this.firePlayerArrow(),
      onInteract: () => this.performInteract(),
      onFirstGesture: () => audioEngine.unlock(),
    });

    this.applyLoadedSave();
    this.bindInputListeners();
    this.exposeAutomationBridge();

    // 4. Progressive Tier-2 Background Preload: stream heavy animated NPC & Skeleton GLBs sequentially without blocking boot!
    this.deferredPreloadPromise = modelLoader.preloadInBackground(DEFERRED_CHARACTER_MODELS, 1);

    this.initialized = true;
    this.lastFrameMs = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private ensureSettingsDefaults(): void {
    const isTouch = isTouchCapableDevice();
    if (!this.save.settings.touchControlsMode) {
      this.save.settings.touchControlsMode = 'auto';
    }
    if (!this.save.settings.graphicsQuality) {
      this.save.settings.graphicsQuality = isTouch ? 'medium' : 'high';
    }
  }

  private applyUserSettings(): void {
    this.ensureSettingsDefaults();
    this.touchControls.setMode(this.save.settings.touchControlsMode);
    this.applyGraphicsQuality(this.save.settings.graphicsQuality);
  }

  private applyGraphicsQuality(quality: GraphicsQuality): void {
    this.activeQuality = quality;
    const isTouch = isTouchCapableDevice();
    const maxDpr = quality === 'low' ? 1.0 : isTouch ? 1.5 : quality === 'medium' ? 1.5 : 2.0;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(window.innerWidth, window.innerHeight);

    // High uses full EffectComposer + Bloom; Medium (iPad default) & Low bypass Bloom for smooth frame pacing!
    this.useComposer = quality === 'high';
    this.renderer.shadowMap.enabled = quality !== 'low';
    if (this.weather?.sunLight) {
      this.weather.sunLight.castShadow = quality !== 'low';
      const targetSize = quality === 'high' ? 2048 : 1024;
      if (this.weather.sunLight.shadow.mapSize.width !== targetSize) {
        this.weather.sunLight.shadow.mapSize.set(targetSize, targetSize);
        if (this.weather.sunLight.shadow.map) {
          this.weather.sunLight.shadow.map.dispose();
          this.weather.sunLight.shadow.map = null;
        }
      }
    }
    this.terrain?.setGraphicsQuality(quality);
  }

  private renderFrame(): void {
    if (this.useComposer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private triggerPlayerDodge(): void {
    if (!this.player.grounded || this.player.climbing) return;
    const yaw = this.player.yaw;
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const dirSign = this.touchControls.state.moveX < -0.25 ? -1 : this.touchControls.state.moveX > 0.25 ? 1 : 0;
    if (dirSign !== 0) {
      this.player.velocity.x = rightX * dirSign * 11.5;
      this.player.velocity.z = rightZ * dirSign * 11.5;
    } else {
      this.player.velocity.x = -Math.sin(yaw) * 10.5;
      this.player.velocity.z = -Math.cos(yaw) * 10.5;
    }
    this.player.velocity.y = 6.2;
    this.player.grounded = false;
    this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.42);
    // Perfect Dodge Flurry Rush window if an enemy is striking nearby!
    const nearThreat = this.enemies.enemies.some(
      (e) => e.alive && e.position.distanceTo(this.player.position) < 5.5 && e.attackCooldown > 1.3
    );
    if (nearThreat) {
      this.player.flurryRushTimer = 2.6;
      audioEngine.playBulletTimeEnter();
      this.ui.showToast('⚡ ジャスト回避！ラッシュ攻撃発動！！', 'cyan');
    }
  }

  private applyLoadedSave(): void {
    this.ui.bindSave(this.save);
    this.applyUserSettings();

    // Build architecture FIRST so Shrine of Resurrection floor & door colliders are ready before teleporting!
    this.terrain.update(this.save.playerPos.x, this.save.playerPos.z);
    if (this.architecture.towers.length === 0) {
      this.architecture.buildAll({
        activatedTowers: this.save.activatedTowers,
        completedShrines: this.save.completedShrines,
        openedChests: this.save.openedChests,
        defeatedDivineBeasts: this.save.defeatedDivineBeasts,
        unlockedMemories: this.save.unlockedMemories,
        memoryLocations: ALL_MEMORIES.map((m) => ({ id: m.id, titleJa: m.titleJa, x: m.pos.x, z: m.pos.z })),
        hasSheikahSlate: this.save.hasSheikahSlate,
        sorDoorOpened: !!this.save.storyFlags['sor_door_opened'],
      });
    } else {
      this.architecture.syncShrineState(this.save.hasSheikahSlate, !!this.save.storyFlags['sor_door_opened']);
    }

    this.player.teleportTo(this.save.playerPos.x, this.save.playerPos.z, 0.25);
    const insideSor =
      this.save.playerPos.x <= -303.5 &&
      this.save.playerPos.x >= -326.5 &&
      this.save.playerPos.z >= 449.0 &&
      this.save.playerPos.z <= 461.0;
    if (insideSor) {
      this.player.position.y = Math.max(this.player.position.y, this.architecture.shrineFloorY);
      this.input.cameraYaw = -Math.PI * 0.5;
      this.input.cameraPitch = 0.08;
    }
    this.player.yaw = this.save.playerPos.yaw;
    this.player.resetSafeLandPos(this.player.position);
    this.runes.bikeFuel = this.save.masterCycleFuel;
    this.runes.selectRune(this.save.unlockedRunes[0] ?? null, this.save.unlockedRunes);
    this.touchControls.setRunesVisible(this.save.unlockedRunes.length > 0);

    this.enemies.populateWorld(this.save.levelSensorPoints, this.save.mode === 'master', this.save.defeatedDivineBeasts.length);
    this.npcs.populateAll(this.save.foundKoroks);
  }

  private startAwakeningSequence(): void {
    this.awakeningCutTimer = 3.6;
    this.panoramaCutTimer = 0;
    this.ui.setPanoramaLogoVisible(false);
    this.ui.setAwakeningOverlay('目を開けて…リンク…');
    audioEngine.playAwakeningChime();
  }

  private syncSaveFromRuntime(): void {
    if (this.shrineInterior.isActive()) {
      this.save.playerPos = {
        x: this.shrineInterior.overworldReturnPos.x,
        y: this.shrineInterior.overworldReturnPos.y,
        z: this.shrineInterior.overworldReturnPos.z,
        yaw: this.shrineInterior.overworldReturnYaw,
      };
    } else if (this.divineBeastInterior.isActive()) {
      this.save.playerPos = {
        x: this.divineBeastInterior.overworldReturnPos.x,
        y: this.divineBeastInterior.overworldReturnPos.y,
        z: this.divineBeastInterior.overworldReturnPos.z,
        yaw: this.divineBeastInterior.overworldReturnYaw,
      };
    } else {
      this.save.playerPos = {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
        yaw: this.player.yaw,
      };
    }
    this.save.inGameTimeHours = this.weather.timeHours;
    this.save.daysElapsed = this.weather.daysElapsed;
    this.save.bloodMoonTimerSec = this.weather.bloodMoonTimerSec;
    this.save.masterCycleFuel = this.runes.bikeFuel;
    this.save.savedAt = Date.now();
  }

  private handleDialogueAction(act: string): void {
    if (act === 'grant_paraglider') {
      if (!hasCompletedAllPlateauShrines(this.save.completedShrines)) {
        this.ui.showToast('まずは始まりの台地の4つの試練の祠をすべてクリアしてくるのじゃ！', 'amber');
        return;
      }
      this.save.hasParaglider = true;
      this.save.storyFlags['plateau_king_revealed'] = true;
      this.ui.showToast(
        this.ui.isTouchUi()
          ? 'パラセールを授かった！空中で「跳/滑空」ボタンで滑空できます'
          : 'パラセールを授かった！空中でSpaceキーで滑空できます',
        'amber'
      );
      audioEngine.playChestFanfare();
    } else if (act === 'grant_champions_tunic') {
      if (this.save.unlockedMemories.length < 1) {
        this.ui.showToast('まずはウツシエの記憶を1つ取り戻そう', 'amber');
        return;
      }
      if (!this.save.ownedArmorIds.includes('champions_tunic')) {
        this.save.ownedArmorIds.push('champions_tunic');
      }
      this.save.equippedArmor.body = 'champions_tunic';
      this.player.syncVisuals(this.save);
      audioEngine.playChestFanfare();
      this.ui.showToast('👕 インパから『英傑の服』を授かった！', 'amber');
    } else if (act === 'unlock_camera_rune') {
      if (!this.save.hasSheikahSlate) {
        this.ui.showToast('シーカーストーンを取得してから来てください', 'amber');
        return;
      }
      if (!this.save.unlockedRunes.includes('camera')) {
        this.save.unlockedRunes.push('camera');
      }
      this.save.upgradedRunes.sensor = true;
      this.runes.selectRune('camera', this.save.unlockedRunes);
      audioEngine.playShrineChime();
      this.ui.showToast('📷 ウツシエ ＆ シーカーセンサー＋ が解放された！', 'cyan');
    } else if (act === 'read_king_journal') {
      this.ui.openDocumentModal('doc_king_rhoam_journal');
    } else if (act === 'read_zelda_diary') {
      this.ui.openDocumentModal('doc_zelda_diary');
    } else if (act === 'read_paya_diary') {
      this.ui.openDocumentModal('doc_paya_diary');
    } else if (act === 'open_adventure_log') {
      this.ui.openSlate('adventure');
    } else if (act === 'open_dye_shop') {
      this.ui.openDyeShopModal();
    } else if (act === 'open_fairy_upgrade') {
      this.ui.openGreatFairyModal();
    } else if (act === 'advance_tarrey_town') {
      this.save.tarreyTownStage = Math.min(5, this.save.tarreyTownStage + 1);
      this.ui.showToast(
        this.save.tarreyTownStage >= 5
          ? '🎉 イチカラ村が完成し、エノキダ＆パウダの結婚式が執り行われた！'
          : `イチカラ村建設がステージ ${this.save.tarreyTownStage}/5 へ進行！`,
        'amber'
      );
      audioEngine.playChestFanfare();
    }
  }

  private bindInputListeners(): void {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = Math.max(1, window.innerHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.applyGraphicsQuality(this.activeQuality);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => window.setTimeout(handleResize, 120));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.ui.closeQuickRibbon();
        if (this.ui.isBlockingInput()) {
          this.ui.closeDialogue();
          this.ui.closeSubModal();
          this.ui.closeSlate();
        } else {
          this.ui.openSlate('inventory');
        }
        return;
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        this.ui.toggleSlate('inventory');
        return;
      }
      if (e.code === 'KeyM') {
        if (!canUseSheikahFeatures(this.save)) {
          this.ui.showToast('シーカーストーンを取得するまでマップは使用できません', 'amber');
          return;
        }
        this.ui.toggleSlate('map');
        return;
      }
      if (e.code === 'KeyH') {
        this.save.settings.proHud = !this.save.settings.proHud;
        return;
      }
      if (this.ui.isBlockingInput()) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.sprint = true;
          break;
        case 'ControlLeft':
          this.input.crouch = !this.input.crouch;
          break;
        case 'Space':
          e.preventDefault();
          this.player.triggerJumpOrParaglider(this.save, () => audioEngine.playParagliderOpen());
          break;
        case 'KeyC':
          if (this.player.triggerGuardStart(this.save, (m) => this.ui.showToast(m, 'amber'))) {
            this.input.guard = true;
          }
          break;
        case 'KeyR':
          this.input.aimBow = true;
          break;
        case 'KeyV':
          this.input.whistle = true;
          break;
        case 'KeyX':
          this.player.triggerShieldSurf(this.save, (m) => this.ui.showToast(m, 'cyan'));
          break;
        case 'KeyG':
          if (this.player.triggerRevalisGale(this.save, (m) => this.ui.showToast(m, 'cyan'))) {
            audioEngine.playParagliderOpen();
          }
          break;
        case 'KeyZ':
          this.toggleZLTarget();
          break;
        case 'KeyQ':
          this.activateRune();
          break;
        case 'KeyE':
          this.performInteract();
          break;
        case 'KeyF':
          if (this.runes.cameraModeActive) {
            this.runes.selfiePose = !this.runes.selfiePose;
            this.ui.showToast(this.runes.selfiePose ? '自撮りモード ON' : '自撮りモード OFF');
          } else {
            this.performMeleeAttack(false);
          }
          break;
        case 'KeyU':
          this.performMeleeAttack(true); // Charged Spin Attack + Urbosa's Fury!
          break;
        case 'KeyT':
          if (this.divineBeastInterior.isActive()) {
            this.openDivineBeastControl();
          }
          break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
        case 'Digit7': {
          if (!this.save.hasSheikahSlate || this.save.unlockedRunes.length === 0) break;
          const idx = Number(e.code.replace('Digit', '')) - 1;
          const r = this.save.unlockedRunes[idx];
          if (r) {
            this.runes.selectRune(r, this.save.unlockedRunes);
            audioEngine.playUiSelect();
          }
          break;
        }
        case 'BracketLeft':
          this.ui.openQuickRibbon('weapon');
          break;
        case 'BracketRight':
          this.ui.openQuickRibbon('arrow');
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.sprint = false;
          break;
        case 'KeyC':
          this.input.guard = false;
          break;
        case 'KeyR':
          if (this.input.aimBow) {
            this.firePlayerArrow();
          }
          this.input.aimBow = false;
          break;
        case 'KeyV':
          this.input.whistle = false;
          break;
      }
    });

    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (this.ui.isBlockingInput()) return;
      if (e.button === 2) {
        this.isDraggingCamera = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      } else if (e.button === 0) {
        if (this.runes.cameraModeActive) {
          this.activateRune();
        } else if (this.input.aimBow) {
          this.firePlayerArrow();
        } else {
          this.performMeleeAttack(false);
        }
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.isDraggingCamera) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.input.cameraYaw -= dx * 0.0055;
      this.input.cameraPitch = THREE.MathUtils.clamp(this.input.cameraPitch + dy * 0.0045, -0.35, 1.05);
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.isDraggingCamera = false;
    });
    canvas.addEventListener('wheel', (e) => {
      this.input.cameraDist = THREE.MathUtils.clamp(this.input.cameraDist + e.deltaY * 0.004, 2.5, 12.0);
    }, { passive: true });
  }

  private toggleZLTarget(): void {
    if (this.lockedEnemy) {
      this.lockedEnemy = null;
      this.lockReticle.visible = false;
      return;
    }
    let best: WorldEnemy | null = null;
    let bestD = 26;
    for (const e of this.enemies.enemies) {
      if (!e.alive) continue;
      const d = e.position.distanceTo(this.player.position);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    this.lockedEnemy = best;
    if (best) this.ui.showToast(`🎯 ZL注目：${best.nameJa}`, 'amber');
  }

  private activateRune(): void {
    if (!this.save.hasSheikahSlate || !this.runes.activeRune || !this.save.unlockedRunes.includes(this.runes.activeRune)) {
      this.ui.showToast('シーカーアイテムがまだ解放されていません！', 'amber');
      return;
    }

    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();

    const isRaining =
      !this.shrineInterior.isActive() &&
      !this.divineBeastInterior.isActive() &&
      (this.climate?.weather === 'rain' || this.climate?.weather === 'thunderstorm');
    audioEngine.playRuneActivate(this.runes.activeRune);

    this.runes.activateCurrentRune({
      playerPos: this.player.position,
      forwardDir: fwd,
      physics: this.physics,
      upgradedBomb: this.save.upgradedRunes.bomb,
      upgradedStasis: this.save.upgradedRunes.stasis,
      unlockedRunes: this.save.unlockedRunes,
      isRaining,
      isParagliding: this.player.paragliding,
      onNotify: (n) => this.ui.showToast(n.text, n.accent),
      onExplosionImpact: (pos, radius, damage, impulse, isBomb) => {
        audioEngine.playBombExplode();
        if (this.shrineInterior.isActive()) {
          const ex = this.shrineInterior.onExplosion(pos, radius, damage);
          if (ex.destroyedWalls > 0) {
            this.ui.showToast('💥 ひび割れた岩壁を粉砕した！', 'amber');
          }
          return;
        }
        if (this.divineBeastInterior.isActive()) {
          const ex = this.divineBeastInterior.onBombExploded(pos, radius);
          if (ex.brokeFireShield) {
            this.ui.showToast('💥 バクダンを吸い込ませて炎のバリアを破壊！炎のカースガノンがダウン！', 'amber');
          } else if (ex.damagedBoss) {
            this.ui.showToast('💥 バクダンがカースガノンに命中！', 'amber');
          }
          return;
        }
        // Damage nearby enemies + ragdoll
        for (const e of this.enemies.enemies) {
          if (!e.alive) continue;
          const d = e.position.distanceTo(pos);
          if (d <= radius + e.radius) {
            const kb = e.position.clone().sub(pos).normalize();
            this.enemies.damageEnemy(e, damage, kb, { ragdoll: true, onDeath: (dead) => this.onEnemyKilled(dead) });
          }
        }
        // Authentic BotW Windbomb (BIL) launch if bomb detonates behind airborne Link!
        if (isBomb && this.save.settings.glitchPhysics && !this.player.grounded) {
          const distP = this.player.position.distanceTo(pos);
          if (distP < radius + 1.5) {
            const launch = this.player.position.clone().sub(pos).normalize();
            this.player.velocity.addScaledVector(launch, impulse * 1.45);
            this.player.velocity.y = Math.max(this.player.velocity.y, 14.0);
            this.ui.showToast('💨 ウインドボム（BIL）超加速！！', 'cyan');
          }
        }
      },
      onStasisEnemy: (origin, dir, upgraded) => {
        if (this.shrineInterior.isActive()) {
          if (!upgraded) return false;
          for (const g of this.shrineInterior.guardians) {
            if (g.state === 'dead') continue;
            if (g.position.distanceTo(origin) < 18 && g.position.clone().sub(origin).normalize().dot(dir) > 0.35) {
              g.stasisTimer = 4.5;
              return true;
            }
          }
          return false;
        }
        return !!this.enemies.tryStasisEnemy(origin, dir, upgraded);
      },
      onCryonisCreated: (pillar) => {
        if (this.shrineInterior.isActive()) {
          const res = this.shrineInterior.onCryonisCreated(pillar.body.position);
          if (res.gateLifted) {
            this.ui.showToast('🧊 氷柱で巨大鉄格子を押し上げた！', 'cyan');
          }
        } else if (this.divineBeastInterior.isActive()) {
          const res = this.divineBeastInterior.onCryonisCreated(pillar.body.position);
          if (res.liftedGate) {
            this.ui.showToast('🧊 ヴァ・ルッタの水門をアイスメイカーで押し上げた！', 'cyan');
          }
          if (res.shatteredIceBlock) {
            this.ui.showToast('🧊 氷塊ブロックをアイスメイカーで粉砕した！', 'cyan');
          }
        }
      },
      onCameraSnap: () => this.captureCompendiumPhoto(),
    });
  }

  private captureCompendiumPhoto(): void {
    // 1-frame synchronous render capture works cleanly with preserveDrawingBuffer: false (saves GPU bandwidth on iPad!)
    this.renderFrame();
    try {
      this.lastCompendiumSnapshotUrl = this.renderer.domElement.toDataURL('image/jpeg', 0.82);
    } catch {
      this.lastCompendiumSnapshotUrl = null;
    }
    const target = this.detectCameraTarget();
    audioEngine.playUiConfirm();
    if (target) {
      if (!this.save.compendiumDiscovered.includes(target.id)) {
        this.save.compendiumDiscovered.push(target.id);
      }
      this.ui.showToast(`📷 ハイラル図鑑へ新規登録：【${target.nameJa}】！`, 'cyan');
    } else {
      this.ui.showToast('📷 ウツシエを撮影しました！', 'cyan');
    }
  }

  private detectCameraTarget(): { id: string; nameJa: string } | null {
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    for (const e of this.enemies.enemies) {
      if (!e.alive) continue;
      const to = e.position.clone().sub(this.camera.position);
      if (to.length() < 45 && to.normalize().dot(camDir) > 0.88) {
        const entry = COMPENDIUM_CATALOG.find((c) => c.id.includes(e.species)) ?? COMPENDIUM_CATALOG[12];
        return { id: entry?.id ?? e.species, nameJa: e.nameJa };
      }
    }
    for (const c of this.architecture.chests) {
      const to = c.position.clone().sub(this.camera.position);
      if (to.length() < 25 && to.normalize().dot(camDir) > 0.88) {
        return { id: 'chest_wood', nameJa: c.labelJa };
      }
    }
    return null;
  }

  private firePlayerArrow(): void {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir).normalize();
    const arrow = this.player.fireArrow(this.save, dir);
    if (arrow) {
      audioEngine.playBowRelease();
      if (this.player.bulletTimeActive) {
        this.ui.showToast(`🏹 バレットタイム射撃 (${this.save.equippedArrow})！`, 'cyan');
      }
    }
  }

  private performMeleeAttack(isSpin: boolean): void {
    if (!canPerformMeleeAttack(this.save)) {
      this.ui.showToast('武器を装備していません！木の枝や剣を拾って装備しよう', 'amber');
      return;
    }
    if (this.player.attackCooldown > 0) return;
    const wep = this.save.weapons.find((w) => w.id === this.save.equippedWeaponId);
    if (!wep) return;

    this.player.weaponDrawn = true;
    this.player.attackCooldown = this.player.flurryRushTimer > 0 ? 0.14 : 0.34;
    this.player.comboIndex = (this.player.comboIndex + 1) % 4;
    this.player.comboResetTimer = 1.1;
    this.player.model.triggerAttackSwing(this.player.comboIndex);
    audioEngine.playSwordSwing();

    const armor = computeArmorSummary(this.save.equippedArmor, this.save.armorStars);
    const baseAtk = wep.isMasterSword && this.save.masterSwordAwakened ? 60 : wep.attack;
    const fwd = this.player.getForwardDirection();

    // Check Stasis frozen rigid bodies -> add kinetic energy impulse!
    for (const b of this.physics.bodies) {
      if (b.isFrozenStasis && b.position.distanceTo(this.player.position) < 4.5) {
        this.physics.applyStasisHit(b, fwd.clone().multiplyScalar(14));
        audioEngine.playStasisTick(b.stasisHits);
        this.ui.showToast(`⏱ ビタロック打撃蓄積 (${b.stasisHits} HIT)`, 'amber');
      }
    }

    if (this.shrineInterior.isActive()) {
      const reach = isSpin ? 4.4 : 3.4;
      const shrineHit = this.shrineInterior.onPlayerMeleeOrArrowHit(this.player.position, fwd, reach, baseAtk);
      if (shrineHit.hitGuardian) {
        audioEngine.playHitImpact(false);
        if (shrineHit.hitGuardian.state === 'dead') {
          this.ui.showToast(`⚔ ${shrineHit.hitGuardian.nameJa} を撃破！`, 'amber');
        }
      }
      return;
    }

    if (this.divineBeastInterior.isActive()) {
      const reach = isSpin ? 5.0 : 3.8;
      const hit = this.divineBeastInterior.onPlayerAttackBoss(this.player.position, fwd, reach, baseAtk, false);
      if (hit.blockedByShield) {
        audioEngine.playParryClang();
        this.ui.showToast('🔥 炎のバリアに弾かれた！リモコンバクダンを吸い込ませて破壊しよう！', 'amber');
      } else if (hit.hit) {
        audioEngine.playHitImpact(!!hit.weakpoint);
        if (hit.defeated) {
          audioEngine.playChestFanfare();
          this.ui.showToast('✨ カースガノン撃破！中央のメイン制御端末を起動して神獣を解放しよう！', 'amber');
        }
      }
      return;
    }

    // Flameblade / Torch / Fire weapon ignites world torches & dry grass right in front of Link -> Fire Updraft!
    if (wep.element === 'Fire') {
      const igniteSpot = this.player.position.clone().addScaledVector(fwd, 2.2);
      igniteSpot.y = getTerrainHeight(igniteSpot.x, igniteSpot.z);
      const isRaining = this.climate?.weather === 'rain' || this.climate?.weather === 'thunderstorm';
      const litTorches = this.architecture.igniteTorchesNear(igniteSpot, 4.2);
      if (litTorches > 0) {
        this.ui.showToast('🔥 燭台に火を灯した！', 'amber');
      }
      if (!isRaining) {
        this.physics.spawnFireUpdraft(igniteSpot, 4.4, 24, 26);
        if (litTorches === 0) {
          this.ui.showToast('🔥 炎の武器で草原に着火！上昇気流が発生！', 'amber');
        }
      }
    }

    // Urbosa's Fury on Charged Spin Attack!
    let urbosaTriggered = false;
    if (isSpin && this.save.champions.urbosa.unlocked && this.save.champions.urbosa.enabled && this.save.champions.urbosa.charges > 0) {
      this.save.champions.urbosa.charges -= 1;
      if (this.save.champions.urbosa.charges === 0) {
        this.save.champions.urbosa.cooldown = this.save.champions.urbosa.upgraded ? 240 : 720;
      }
      urbosaTriggered = true;
      this.ui.showToast('⚡ ウルボザの怒り！周囲一帯へ広域落雷！！', 'amber');
    }

    // Hit Enemies using exact BotW Damage Formula!
    const reach = urbosaTriggered ? 16.0 : isSpin ? 4.4 : 3.2;
    for (const e of this.enemies.enemies) {
      if (!e.alive) continue;
      const dist = e.position.distanceTo(this.player.position);
      if (dist > reach + e.radius) continue;
      const toE = e.position.clone().sub(this.player.position).normalize();
      if (!isSpin && toE.dot(fwd) < 0.15) continue;

      // Sneakstrike (8.0x) if crouching behind unaware enemy!
      const enemyFwd = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
      const isSneakstrike = this.player.crouching && toE.dot(enemyFwd) > 0.4 && e.alertState === 'idle';

      const dmg =
        computeBotWDamage({
          baseAttack: baseAtk,
          isSneakstrike,
          isHeadshotOrCrit: this.player.comboIndex === 0,
          isTargetFrozen: e.frozenTimer > 0,
          attackUpLevel: armor.attackUpLevel,
          ancientProficiency: armor.ancientProficiency,
          boneProficiency: armor.boneProficiency,
          weaponIsAncient: wep.isAncient,
          weaponIsBone: wep.isBone,
          element: urbosaTriggered ? 'Electricity' : wep.element,
          targetShockImmune: e.isShockImmune,
        }) + (urbosaTriggered ? 150 : 0);

      audioEngine.playHitImpact(isSneakstrike || this.player.comboIndex === 0);
      this.enemies.damageEnemy(e, dmg, toE, {
        freeze: wep.element === 'Ice',
        ragdoll: this.player.comboIndex === 0 || isSpin,
        onDeath: (dead) => this.onEnemyKilled(dead),
      });
      if (isSneakstrike) {
        this.ui.showToast(`🗡 ふいうち 8.0倍クリティカル！ (${dmg} DMG)`, 'amber');
      } else if (armor.showsEnemyHp) {
        this.ui.showToast(`${e.nameJa} に ${dmg} ダメージ！（残HP ${Math.ceil(e.hp)}/${e.maxHp}）`, 'cyan');
      }
    }
  }

  private onEnemyKilled(e: WorldEnemy): void {
    // Hidden LevelSensor kill point tracking (max 10 per normal species, 1st kill only for bosses!)
    const prev = this.save.speciesKillCounts[e.species] ?? 0;
    const cap = e.isBoss ? 1 : 10;
    if (prev < cap) {
      this.save.speciesKillCounts[e.species] = prev + 1;
      this.save.levelSensorPoints += SPECIES_KILL_POINTS[e.species] ?? 15;
    }
    this.save.rupees += e.isBoss ? 120 : 25;
    if (e.species.endsWith('blight') && !this.save.defeatedDivineBeasts.includes(e.species)) {
      this.save.defeatedDivineBeasts.push(e.species);
      const champMap: Record<string, keyof SaveSlotData['champions']> = {
        waterblight: 'mipha',
        fireblight: 'daruk',
        windblight: 'revali',
        thunderblight: 'urbosa',
      };
      const ck = champMap[e.species];
      if (ck) {
        this.save.champions[ck].unlocked = true;
        this.save.champions[ck].charges = this.save.champions[ck].maxCharges;
      }
      this.ui.showToast(`✨ ${e.nameJa} 撃破！神獣解放 ＆ 英傑の加護を授かった！`, 'amber');
      audioEngine.playChestFanfare();
      if (this.save.defeatedDivineBeasts.length >= 4) {
        this.architecture.syncDlc2ShrinesVisibility(true);
        this.ui.showToast('🏛 4体の神獣解放により、始まりの台地に『英傑たちの詩』の試練が出現した！', 'amber');
      }
    } else if (e.species === 'monk_maz_koshia') {
      if (!this.save.unlockedRunes.includes('master_cycle')) {
        this.save.unlockedRunes.push('master_cycle');
      }
      this.runes.bikeFuel = 1000;
      this.save.masterCycleFuel = 1000;
      this.ui.showToast('🏍 導師ミィズ・キョシア撃破！マスターバイク零式が解放された！', 'amber');
      audioEngine.playChestFanfare();
    }
    if (this.lockedEnemy === e) {
      this.lockedEnemy = null;
      this.lockReticle.visible = false;
    }
  }

  private handleEnemyAttackPlayer(enemy: WorldEnemy, rawDamage: number, isLaser: boolean): void {
    if (this.player.invulnTimer > 0) return;

    // 1. Perfect Guard -> Beam Parry Reflection!
    const hasAncientShield = this.save.equippedShieldId ? AUTO_PARRY_LASER_SHIELD_IDS.has(this.save.equippedShieldId) : false;
    if (this.player.guarding && (this.player.perfectGuardWindow > 0 || (isLaser && hasAncientShield))) {
      audioEngine.playParryClang();
      if (isLaser) {
        this.enemies.reflectNearestBeam(this.player.position);
        this.ui.showToast('🛡 ジャストガード！ガーディアンビームを完全反射！！', 'amber');
      } else {
        enemy.attackCooldown = 3.2;
        this.ui.showToast('🛡 ジャストガード！敵の体勢を崩した！', 'amber');
      }
      return;
    }

    // 2. Daruk's Protection automatic full shield deflection!
    if (this.player.guarding && this.save.champions.daruk.unlocked && this.save.champions.daruk.enabled && this.save.champions.daruk.charges > 0) {
      this.save.champions.daruk.charges -= 1;
      if (this.save.champions.daruk.charges === 0) {
        this.save.champions.daruk.cooldown = this.save.champions.daruk.upgraded ? 360 : 1080;
      }
      audioEngine.playParryClang();
      this.ui.showToast('🛡 ダルケルの護り！攻撃を完全防御！', 'amber');
      return;
    }

    // 3. Regular damage mitigated by total armor defense (quarter-heart resolution!)
    const armor = computeArmorSummary(this.save.equippedArmor, this.save.armorStars);
    const dmgHearts = Math.max(0.25, (rawDamage - armor.totalDefense * 0.55) / 4);
    this.applyPlayerDamage(dmgHearts);
  }

  private applyPlayerDamage(heartsLoss: number): void {
    this.player.invulnTimer = 0.85;
    if (this.save.tempHearts > 0) {
      const abs = Math.min(this.save.tempHearts, heartsLoss);
      this.save.tempHearts -= abs;
      heartsLoss -= abs;
    }
    this.save.hearts = Math.max(0, this.save.hearts - heartsLoss);

    // Mipha's Grace Auto-Revive on lethal damage!
    if (this.save.hearts <= 0) {
      const m = this.save.champions.mipha;
      if (m.unlocked && m.enabled && m.charges > 0) {
        m.charges -= 1;
        m.cooldown = m.upgraded ? 480 : 1440;
        this.save.hearts = this.save.maxHearts;
        this.save.tempHearts = 5;
        this.ui.showToast('💧 ミファーの祈り発動！体力全快＋一時ハート＋5！', 'cyan');
        audioEngine.playChestFanfare();
      } else {
        // Record Hero's Path death marker & revive safely
        recordHeroPathSample(this.save, this.player.position.x, this.player.position.y, this.player.position.z, true);
        this.save.hearts = this.save.maxHearts;
        if (this.shrineInterior.isActive()) {
          const sp = this.shrineInterior.getSpawnPos();
          this.player.setExactPosition(sp.x, sp.y + 0.05, sp.z);
          this.ui.showToast('祠の入り口へ戻されました', 'red');
        } else if (this.divineBeastInterior.isActive()) {
          const sp = this.divineBeastInterior.getSpawnPos();
          this.player.setExactPosition(sp.x, sp.y + 0.05, sp.z);
          this.ui.showToast('神獣の入り口へ戻されました', 'red');
        } else if (this.architecture.sorDoorOpened) {
          this.player.teleportTo(-298, 454, 0.5);
          this.ui.showToast('回生の祠で復活しました', 'red');
        } else {
          this.player.teleportTo(-323.5, 455, 0.25);
          this.player.position.y = Math.max(this.player.position.y, this.architecture.shrineFloorY);
          this.ui.showToast('回生の祠で復活しました', 'red');
        }
      }
    }
  }

  private findNearestInteractable(): NearbyInteractable | null {
    const p = this.player.position;

    if (this.shrineInterior.isActive()) {
      const hit = this.shrineInterior.getNearestInteractable(p, this.save);
      if (!hit) return null;
      if (hit.kind === 'pedestal') return { kind: 'shrineInteriorPedestal', label: hit.label };
      if (hit.kind === 'altar') return { kind: 'shrineInteriorAltar', label: hit.label };
      if (hit.kind === 'chest') return { kind: 'shrineInteriorChest', id: hit.id, label: hit.label };
      return { kind: 'shrineInteriorExit', label: hit.label };
    }

    if (this.divineBeastInterior.isActive()) {
      const hit = this.divineBeastInterior.getNearestInteractable(p);
      if (!hit) return null;
      if (hit.kind === 'terminal') return { kind: 'beastTerminal', id: hit.id, label: hit.label };
      if (hit.kind === 'mainUnit') return { kind: 'beastMainUnit', label: hit.label };
      if (hit.kind === 'torch') return { kind: 'beastTorch', id: hit.id, label: hit.label };
      return { kind: 'beastExit', label: hit.label };
    }

    if (!this.architecture.sheikahSlateCollected && this.architecture.sheikahPedestalPos.distanceTo(p) < 3.4) {
      return { kind: 'slatePedestal', label: 'シーカーストーンを調べる' };
    }
    if (!this.architecture.sorDoorOpened && this.architecture.sorExitTerminalPos.distanceTo(p) < 3.6) {
      return { kind: 'sorTerminal', label: '端末にシーカーストーンをかざす' };
    }
    // Temple of Time Goddess Statue (-245, 504.5) Spirit Orb exchange!
    if (Math.hypot(p.x - (-245), p.z - 504.5) < 4.5) {
      return { kind: 'goddess', label: '女神像に祈る（克服の証を交換）' };
    }
    for (const npc of this.npcs.npcs) {
      if (!npc.root.visible) continue;
      if (npc.position.distanceTo(p) < 4.5) {
        return { kind: 'npc', npc, label: `${npc.displayNameJa} と話す` };
      }
    }
    for (const chest of this.architecture.chests) {
      if (!chest.opened && chest.position.distanceTo(p) < 3.6) {
        return { kind: 'chest', chest, label: `${chest.labelJa} を開ける` };
      }
    }
    for (const drop of this.architecture.weaponDrops) {
      if (!drop.collected && drop.position.distanceTo(p) < 3.4) {
        return { kind: 'weaponDrop', drop, label: `${drop.nameJa} を拾う` };
      }
    }
    for (const pot of this.architecture.cookingPots) {
      if (pot.position.distanceTo(p) < 3.8) {
        return { kind: 'pot', label: `${pot.nameJa} で料理・休息する` };
      }
    }
    for (const torch of this.architecture.torches) {
      if (!torch.lit && torch.position.distanceTo(p) < 3.5) {
        return { kind: 'torch', torch, label: `${torch.nameJa} に火を灯す` };
      }
      if (torch.lit && (torch.nameJa.includes('焚き火') || torch.nameJa.includes('篝火')) && torch.position.distanceTo(p) < 3.4) {
        return { kind: 'campfire', position: torch.position.clone(), label: `${torch.nameJa} で暇をつぶす` };
      }
    }
    for (const k of this.npcs.koroks) {
      if (!k.found && k.position.distanceTo(p) < 4.0) {
        return { kind: 'korok', korok: k, label: `調べる（${k.puzzleNameJa}）` };
      }
    }
    for (const m of this.architecture.memorySpots) {
      if (m.position.distanceTo(p) < 5.5) {
        return { kind: 'memory', memoryId: m.memoryId, label: `ウツシエの記憶「${m.titleJa}」を思い出す` };
      }
    }
    for (const sh of this.architecture.shrines) {
      if (!sh.root.visible) continue;
      if (sh.position.distanceTo(p) < 7.5) {
        return { kind: 'shrine', shrine: sh, label: `${sh.nameJa}（${sh.subtitleJa}）に入る` };
      }
    }
    for (const db of this.architecture.divineBeasts) {
      if (db.freed) continue;
      if (Math.hypot(db.position.x - p.x, db.position.z - p.z) < 35) {
        return { kind: 'divineBeastBoard', beastId: db.id as DivineBeastId, label: `${db.nameJa} の内部へ乗り込む` };
      }
    }
    for (const tw of this.architecture.towers) {
      if (!tw.activated && tw.position.distanceTo(p) < 10.0) {
        return { kind: 'tower', tower: tw, label: `${tw.nameJa} の端末を起動する` };
      }
    }
    return null;
  }

  public performInteract(): void {
    const target = this.findNearestInteractable() ?? this.nearestInteract;
    this.nearestInteract = target;
    if (!target) return;

    if (target.kind === 'shrineInteriorPedestal') {
      const sh = this.shrineInterior.activeShrine;
      if (!sh) return;
      const info = SHRINE_RUNE_INFO[sh.id];
      if (!info) return;
      const newlyAdded: RuneId[] = [];
      for (const r of info.runes) {
        if (!this.save.unlockedRunes.includes(r)) {
          this.save.unlockedRunes.push(r);
          newlyAdded.push(r);
        }
      }
      if (newlyAdded.length > 0) {
        this.runes.selectRune(newlyAdded[0], this.save.unlockedRunes);
        this.touchControls.setRunesVisible(true);
        audioEngine.playChestFanfare();
        this.ui.showToast(`📱 新しいシーカーアイテム解放：【${info.labelJa}】！`, 'cyan');
      } else {
        this.ui.showToast('シーカーアイテムはすでに抽出されています', 'cyan');
      }
      return;
    }

    if (target.kind === 'shrineInteriorAltar') {
      const sh = this.shrineInterior.activeShrine;
      if (!sh) return;
      if (this.save.completedShrines.includes(sh.id)) {
        this.ui.showToast('導師はすでに祝福を授け、光となって消えている（克服の証 取得済み）', 'cyan');
        this.exitShrineWithFade();
        return;
      }
      this.save.completedShrines.push(sh.id);
      this.save.spiritOrbs += 1;
      this.architecture.completeShrine(sh.id);
      audioEngine.playChestFanfare();
      this.ui.showToast(`🔷 ${sh.nameJa} 試練達成！『克服の証』を手に入れた！（計 ${this.save.spiritOrbs}個）`, 'amber');
      this.exitShrineWithFade();
      return;
    }

    if (target.kind === 'shrineInteriorChest') {
      const chest = this.shrineInterior.openChest(target.id, this.save);
      if (chest) {
        this.player.syncVisuals(this.save);
        audioEngine.playChestFanfare();
        this.ui.showToast(`🎁 試練の宝箱を開けた！ ${chest.rewardTextJa} を手に入れた！`, 'amber');
      }
      return;
    }

    if (target.kind === 'shrineInteriorExit') {
      this.exitShrineWithFade();
      return;
    }

    if (target.kind === 'divineBeastBoard') {
      if (!canUseSheikahFeatures(this.save)) {
        this.ui.showToast('シーカーストーンを持っていないため神獣内部へ侵入できません！', 'amber');
        return;
      }
      this.enterDivineBeastWithFade(target.beastId);
      return;
    }

    if (target.kind === 'beastTerminal') {
      const res = this.divineBeastInterior.activateTerminal(target.id, this.save);
      if (res.ok) {
        audioEngine.playShrineChime();
        this.ui.showToast(res.messageJa, res.allActivated ? 'amber' : 'cyan');
      } else if (res.messageJa) {
        this.ui.showToast(res.messageJa, 'amber');
      }
      return;
    }

    if (target.kind === 'beastTorch') {
      if (this.divineBeastInterior.igniteTorch(target.id)) {
        audioEngine.playUiConfirm();
        this.ui.showToast('🔥 青い炎が灯り、神獣内部が明るくなった！', 'cyan');
      }
      return;
    }

    if (target.kind === 'beastMainUnit') {
      const beastId = this.divineBeastInterior.activeBeastId;
      if (!beastId) return;
      if (this.divineBeastInterior.bossDefeatedInSession) {
        const reward = applyDivineBeastLiberationRewards(this.save, beastId);
        this.architecture.setDivineBeastFreed(beastId);
        audioEngine.playChestFanfare();
        this.ui.showToast(
          `✨ ${DIVINE_BEAST_METAS[beastId].nameJa} 解放！ハートの器(+1) ＆ ${reward.championAbilityJa} を授かった！`,
          'amber'
        );
        if (reward.allFourFreed) {
          this.architecture.syncDlc2ShrinesVisibility(true);
          this.ui.showToast('🏛 4体の神獣解放！始まりの台地に『英傑たちの詩』4祠が出現した！', 'amber');
        }
        this.exitDivineBeastWithFade();
        return;
      }
      if (!this.divineBeastInterior.areAllTerminalsActivated()) {
        const prog = this.divineBeastInterior.getTerminalProgress();
        this.ui.showToast(`まだ制御端末が足りません（現在 ${prog.activated}/${prog.total} 起動済み）`, 'amber');
        return;
      }
      const boss = this.divineBeastInterior.startBlightBossBattle(this.save);
      if (boss) {
        audioEngine.playShrineChime();
        this.ui.showToast(`⚔️ ${boss.nameJa}（HP ${boss.maxHp}）が出現した！！`, 'red');
      }
      return;
    }

    if (target.kind === 'beastExit') {
      this.exitDivineBeastWithFade();
      return;
    }

    if (target.kind === 'slatePedestal') {
      this.architecture.collectSheikahSlate();
      this.save.hasSheikahSlate = true;
      this.player.syncVisuals(this.save);
      audioEngine.playShrineChime();
      this.ui.showToast('📱 シーカーストーンを手に入れた！奥の部屋の扉が開いた！', 'cyan');
    } else if (target.kind === 'sorTerminal') {
      if (!this.save.hasSheikahSlate) {
        this.ui.showToast('シーカーストーンが反応しない…まずは台座からシーカーストーンを入手しよう', 'amber');
        return;
      }
      this.architecture.openShrineDoor();
      this.save.storyFlags['sor_door_opened'] = true;
      audioEngine.playShrineChime();
      this.ui.showToast('🚪 封印の石扉が開かれた！台地の崖へ向かおう', 'cyan');
    } else if (target.kind === 'goddess') {
      this.ui.openGoddessStatueModal();
    } else if (target.kind === 'campfire') {
      this.ui.openCampfireModal();
    } else if (target.kind === 'npc') {
      const armor = computeArmorSummary(this.save.equippedArmor, this.save.armorStars);
      const dlg = evaluateNpcEventFlow(target.npc, {
        isNaked: armor.isNaked,
        triggersNpcFear: armor.triggersNpcFear,
        hasGerudoEntry: armor.hasGerudoEntry,
        isBloodMoon: this.climate.isBloodMoonRising,
        isRaining: this.climate.weather === 'rain' || this.climate.weather === 'thunderstorm',
        timeHours: this.climate.timeHours,
        memoriesCount: this.save.unlockedMemories.length,
        hasParaglider: this.save.hasParaglider,
        plateauShrinesDone: hasCompletedAllPlateauShrines(this.save.completedShrines),
        hasCameraRune: this.save.unlockedRunes.includes('camera'),
        hasChampionsTunic: this.save.ownedArmorIds.includes('champions_tunic'),
        tarreyTownStage: this.save.tarreyTownStage,
        thunderHelmRecovered: !!this.save.storyFlags['Electric_Relic_GetBack'],
      });
      this.activeDialogueNpc = target.npc;
      this.ui.openDialogue(dlg);
    } else if (target.kind === 'chest') {
      this.architecture.openChest(target.chest);
      if (!this.save.openedChests.includes(target.chest.id)) this.save.openedChests.push(target.chest.id);
      if (target.chest.id === 'chest_plateau_wood') {
        const sw = WEAPONS.find((w) => w.id === 'travelers_sword');
        if (sw && !this.save.weapons.some((w) => w.id === sw.id)) {
          this.save.weapons.push({ ...sw, currentDurability: sw.durability });
          if (!this.save.equippedWeaponId) {
            this.save.equippedWeaponId = sw.id;
            this.player.syncVisuals(this.save);
          }
        }
      } else if (target.chest.id === 'chest_hyrule_castle') {
        const hs = SHIELDS.find((s) => s.id === 'hylian_shield');
        if (hs && !this.save.shields.some((s) => s.id === hs.id)) {
          this.save.shields.push({ ...hs, currentDurability: hs.durability });
          if (!this.save.equippedShieldId) {
            this.save.equippedShieldId = hs.id;
            this.player.syncVisuals(this.save);
          }
        }
      }
      if (target.chest.rewardType === 'rupees') {
        this.save.rupees += target.chest.rewardAmount;
      } else if (target.chest.rewardType === 'arrow') {
        this.save.arrows.normal += target.chest.rewardAmount;
      } else if (target.chest.rewardType === 'armor') {
        if (!this.save.ownedArmorIds.includes(target.chest.rewardId)) {
          this.save.ownedArmorIds.push(target.chest.rewardId);
        }
        const piece = ARMOR_MAP[target.chest.rewardId];
        if (piece && !this.save.equippedArmor[piece.slot]) {
          this.save.equippedArmor[piece.slot] = piece.id;
          this.player.syncVisuals(this.save);
        }
      } else {
        this.save.materials[target.chest.rewardId] = (this.save.materials[target.chest.rewardId] ?? 0) + target.chest.rewardAmount;
      }
      audioEngine.playChestFanfare();
      this.ui.showToast(`🎁 宝箱を開けた！ ${target.chest.rewardTextJa} を手に入れた！`, 'amber');
    } else if (target.kind === 'weaponDrop') {
      this.architecture.collectWeaponDrop(target.drop);
      if (target.drop.dropKind === 'material') {
        const amt = target.drop.materialAmount ?? 1;
        this.save.materials[target.drop.weaponId] = (this.save.materials[target.drop.weaponId] ?? 0) + amt;
        const matName = MATERIAL_MAP[target.drop.weaponId]?.nameJa ?? target.drop.nameJa;
        audioEngine.playUiConfirm();
        this.ui.showToast(`🍎 ${matName} ×${amt} を手に入れた！`, 'amber');
      } else {
        const template = WEAPONS.find((w) => w.id === target.drop.weaponId);
        if (template && !this.save.weapons.some((w) => w.id === template.id)) {
          this.save.weapons.push({ ...template, currentDurability: template.durability });
        }
        if (template) {
          this.save.equippedWeaponId = template.id;
          this.player.syncVisuals(this.save);
        }
        audioEngine.playChestFanfare();
        this.ui.showToast(`⚔ ${target.drop.nameJa} を手に入れた！`, 'amber');
      }
    } else if (target.kind === 'torch') {
      this.architecture.igniteTorch(target.torch);
      audioEngine.playUiConfirm();
      this.ui.showToast(`🔥 ${target.torch.nameJa} に火を灯した！（周囲が暖かくなった）`, 'amber');
    } else if (target.kind === 'pot') {
      this.ui.openCookingModal(this.climate.isBloodMoonCookWindow);
    } else if (target.kind === 'korok') {
      target.korok.found = true;
      target.korok.korokMesh.visible = true;
      if (!this.save.foundKoroks.includes(target.korok.id)) {
        this.save.foundKoroks.push(target.korok.id);
        this.save.korokSeeds += 1;
      }
      audioEngine.playKorokYahaha();
      this.ui.showToast(`🌿 ヤハハ！見つかっちゃった！コログのミ獲得（${target.korok.puzzleNameJa}）`, 'amber');
    } else if (target.kind === 'memory') {
      const mem = ALL_MEMORIES.find((m) => m.id === target.memoryId);
      if (mem) {
        audioEngine.playMemoryChime();
        this.ui.openMemoryModal(mem);
      }
    } else if (target.kind === 'shrine') {
      if (!canUseSheikahFeatures(this.save)) {
        this.ui.showToast('シーカーストーンを持っていないため台座が反応しません！', 'amber');
        return;
      }
      if (!this.save.discoveredShrines.includes(target.shrine.id)) {
        this.save.discoveredShrines.push(target.shrine.id);
      }
      this.enterShrineWithFade(target.shrine);
    } else if (target.kind === 'tower') {
      if (!canUseSheikahFeatures(this.save)) {
        this.ui.showToast('シーカーストーンがないためタワーを起動できません！', 'amber');
        return;
      }
      this.architecture.activateTower(target.tower.regionId);
      if (!this.save.activatedTowers.includes(target.tower.regionId)) {
        this.save.activatedTowers.push(target.tower.regionId);
      }
      audioEngine.playShrineChime();
      this.ui.showToast(`📡 ${target.tower.nameJa} 起動！周辺エリアのシーカーマップ情報を入手！`, 'cyan');
    }
  }

  public enterShrineWithFade(shrine: WorldShrine): void {
    const def = PHYSICAL_SHRINES.find((s) => s.id === shrine.id);
    if (!def || this.isShrineTransitioning) return;
    this.isShrineTransitioning = true;
    this.paused = true;
    this.ui.setShrineFade(true, shrine.nameJa, shrine.subtitleJa);
    audioEngine.playShrineChime();

    window.setTimeout(() => {
      this.savedOverworldBg = this.scene.background;
      this.savedOverworldFog = this.scene.fog;
      this.terrain.group.visible = false;
      this.architecture.group.visible = false;
      this.npcs.group.visible = false;
      this.enemies.group.visible = false;
      this.weather.sunLight.visible = false;
      this.scene.background = new THREE.Color('#07131e');
      this.scene.fog = new THREE.FogExp2('#07131e', 0.011);

      this.runes.clearTransientRunes(this.physics);
      const returnSpot = new THREE.Vector3(shrine.position.x, shrine.position.y + 0.25, shrine.position.z + 7.2);
      const res = this.shrineInterior.enterShrine(def, this.save, returnSpot, 0);
      this.player.setExactPosition(res.spawnPos.x, res.spawnPos.y + 0.05, res.spawnPos.z);
      this.player.yaw = Math.PI;
      this.input.cameraYaw = 0;
      this.input.cameraPitch = 0.1;

      window.setTimeout(() => {
        this.ui.setShrineFade(false);
        this.paused = false;
        this.isShrineTransitioning = false;
      }, 220);
    }, 320);
  }

  public exitShrineWithFade(): void {
    if (!this.shrineInterior.isActive() || this.isShrineTransitioning) return;
    this.isShrineTransitioning = true;
    this.paused = true;
    this.ui.setShrineFade(true, '地上へ戻る', 'RETURNING TO HYRULE');
    audioEngine.playShrineChime();

    window.setTimeout(() => {
      this.exitShrineImmediate();
      window.setTimeout(() => {
        this.ui.setShrineFade(false);
        this.paused = false;
        this.isShrineTransitioning = false;
      }, 220);
    }, 320);
  }

  private exitShrineImmediate(): void {
    this.runes.clearTransientRunes(this.physics);
    const out = this.shrineInterior.exitShrine();
    this.terrain.group.visible = true;
    this.architecture.group.visible = true;
    this.npcs.group.visible = true;
    this.enemies.group.visible = true;
    this.weather.sunLight.visible = true;
    this.scene.background = this.savedOverworldBg ?? new THREE.Color('#8ec8ec');
    this.scene.fog = this.savedOverworldFog;
    this.terrain.update(out.returnPos.x, out.returnPos.z);
    this.player.teleportTo(out.returnPos.x, out.returnPos.z, 0.25);
    this.player.yaw = out.returnYaw;
  }

  public enterDivineBeastWithFade(beastId: DivineBeastId): void {
    if (this.isShrineTransitioning || this.divineBeastInterior.isActive()) return;
    if (this.shrineInterior.isActive()) this.exitShrineImmediate();
    const meta = DIVINE_BEAST_METAS[beastId];
    this.isShrineTransitioning = true;
    this.paused = true;
    this.ui.setShrineFade(true, meta.nameJa, meta.nameEn);
    audioEngine.playShrineChime();

    window.setTimeout(() => {
      this.runes.clearTransientRunes(this.physics);
      this.savedOverworldBg = this.scene.background;
      this.savedOverworldFog = this.scene.fog;

      this.terrain.group.visible = false;
      this.architecture.group.visible = false;
      this.npcs.group.visible = false;
      this.enemies.group.visible = false;
      this.weather.sunLight.visible = false;
      this.scene.background = new THREE.Color(beastId === 'vah_rudania' ? '#120a08' : '#0b1824');
      this.scene.fog = new THREE.Fog('#0c1824', 28, 120);

      const entered = this.divineBeastInterior.enterBeast(beastId, this.save, this.player.position, this.player.yaw);
      this.player.setExactPosition(entered.spawnPos.x, entered.spawnPos.y + 0.05, entered.spawnPos.z);
      this.player.yaw = entered.spawnYaw;
      this.input.cameraYaw = 0;
      this.input.cameraPitch = 0.14;
      this.ui.setDivineBeastHudVisible(true);

      const prog = this.divineBeastInterior.getTerminalProgress();
      this.ui.showRegionBanner(meta.nameJa, meta.nameEn);
      this.ui.showToast(`⚙️ ${meta.nameJa} 内部へ突入！（制御端末 ${prog.activated}/${prog.total} • Tキー/画面右上から神獣操作可能）`, 'cyan');

      window.setTimeout(() => {
        this.ui.setShrineFade(false);
        this.paused = false;
        this.isShrineTransitioning = false;
      }, 220);
    }, 320);
  }

  public exitDivineBeastWithFade(): void {
    if (!this.divineBeastInterior.isActive() || this.isShrineTransitioning) return;
    this.isShrineTransitioning = true;
    this.paused = true;
    this.ui.setShrineFade(true, 'ハイラルへ帰還', 'RETURNING TO HYRULE');
    audioEngine.playShrineChime();

    window.setTimeout(() => {
      this.exitDivineBeastImmediate();
      window.setTimeout(() => {
        this.ui.setShrineFade(false);
        this.paused = false;
        this.isShrineTransitioning = false;
      }, 220);
    }, 320);
  }

  private exitDivineBeastImmediate(): void {
    this.runes.clearTransientRunes(this.physics);
    const out = this.divineBeastInterior.exitBeast();
    this.ui.setDivineBeastHudVisible(false);
    this.terrain.group.visible = true;
    this.architecture.group.visible = true;
    this.npcs.group.visible = true;
    this.enemies.group.visible = true;
    this.weather.sunLight.visible = true;
    this.scene.background = this.savedOverworldBg ?? new THREE.Color('#8ec8ec');
    this.scene.fog = this.savedOverworldFog;
    this.terrain.update(out.returnPos.x, out.returnPos.z);
    this.player.teleportTo(out.returnPos.x, out.returnPos.z, 0.25);
    this.player.yaw = out.returnYaw;
  }

  public openDivineBeastControl(): void {
    const meta = this.divineBeastInterior.getMeta();
    const pose = this.divineBeastInterior.getPoseSummary();
    if (!meta || !pose) return;
    const prog = this.divineBeastInterior.getTerminalProgress();
    this.ui.openDivineBeastControlModal({
      beastNameJa: meta.nameJa,
      poseTitleJa: pose.titleJa,
      currentLabel: pose.currentLabel,
      options: pose.options,
      activatedTerminals: prog.activated,
      totalTerminals: prog.total,
      onApplyOption: (idx) => {
        audioEngine.playShrineChime();
        return this.divineBeastInterior.applyPoseAction(idx);
      },
    });
  }

  private updateArrows(dt: number, isRaining: boolean): void {
    for (let i = this.player.arrows.length - 1; i >= 0; i--) {
      const a = this.player.arrows[i];
      a.life -= dt;
      a.velocity.y -= 9.5 * dt;
      a.position.addScaledVector(a.velocity, dt);
      a.mesh.position.copy(a.position);
      a.mesh.lookAt(a.position.clone().add(a.velocity));

      const gy = getTerrainHeight(a.position.x, a.position.z);
      let hit = a.position.y <= gy;

      if (this.shrineInterior.isActive()) {
        const shHit = this.shrineInterior.onPlayerMeleeOrArrowHit(a.position, a.velocity.clone().normalize(), 1.25, a.attack);
        if (shHit.hitGuardian || shHit.hitStasisBody) {
          audioEngine.playHitImpact(false);
          hit = true;
        }
      } else if (this.divineBeastInterior.isActive()) {
        const bHit = this.divineBeastInterior.onPlayerAttackBoss(a.position, a.velocity.clone().normalize(), 1.6, a.attack, true);
        if (bHit.blockedByShield) {
          audioEngine.playParryClang();
          hit = true;
        } else if (bHit.hit) {
          audioEngine.playHitImpact(!!bHit.weakpoint);
          if (bHit.weakpoint) {
            this.ui.showToast('🎯 弱点の目に命中！風のカースガノンがダウンした！', 'cyan');
          }
          if (bHit.defeated) {
            audioEngine.playChestFanfare();
            this.ui.showToast('✨ カースガノン撃破！中央のメイン制御端末を起動して神獣を解放しよう！', 'amber');
          }
          hit = true;
        }
      } else {
        // Check Enemy Hit (Headshot / Elemental Bonus!)
        for (const e of this.enemies.enemies) {
          if (!e.alive) continue;
          if (a.position.distanceTo(e.position.clone().add(new THREE.Vector3(0, 1.3, 0))) < e.radius + 0.65) {
            const isHeadshot = a.position.y > e.position.y + 1.45;
            const dmg = computeBotWDamage({
              baseAttack: a.attack,
              isHeadshotOrCrit: isHeadshot,
              element: a.type === 'fire' ? 'Fire' : a.type === 'ice' ? 'Ice' : a.type === 'shock' ? 'Electricity' : undefined,
              targetShockImmune: e.isShockImmune,
            });
            this.enemies.damageEnemy(e, dmg, a.velocity.clone().normalize(), {
              freeze: a.type === 'ice',
              ragdoll: isHeadshot || a.type === 'bomb',
              onDeath: (dead) => this.onEnemyKilled(dead),
            });
            audioEngine.playHitImpact(isHeadshot);
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        if (a.type === 'fire' && !this.shrineInterior.isActive()) {
          this.architecture.igniteTorchesNear(a.position, 4.5);
          if (!isRaining) {
            this.physics.spawnFireUpdraft(new THREE.Vector3(a.position.x, gy, a.position.z), 4.6, 25, 28);
            this.ui.showToast('🔥 炎の矢が草原に着火！上昇気流が発生！', 'amber');
          }
        } else if (a.type === 'bomb') {
          this.physics.triggerExplosion(a.position, 6.5, 22, isRaining);
          if (this.shrineInterior.isActive()) {
            this.shrineInterior.onExplosion(a.position, 6.5, 40);
          }
          audioEngine.playBombExplode();
        }
        this.player.arrowsGroup.remove(a.mesh);
        this.player.arrows.splice(i, 1);
      } else if (a.life <= 0) {
        this.player.arrowsGroup.remove(a.mesh);
        this.player.arrows.splice(i, 1);
      }
    }
  }

  private updateCamera(): void {
    if (this.cameraOverride) {
      this.camera.position.copy(this.cameraOverride.pos);
      this.camera.lookAt(this.cameraOverride.lookAt);
      return;
    }

    const p = this.player.position;
    if (this.runes.cameraModeActive) {
      if (this.runes.selfiePose) {
        const fwd = this.player.getForwardDirection();
        this.camera.position.copy(p).addScaledVector(fwd, 2.6).add(new THREE.Vector3(0, 1.45, 0));
        this.camera.lookAt(p.x, p.y + 1.25, p.z);
      } else {
        this.camera.position.set(p.x, p.y + 1.52, p.z);
        const look = new THREE.Vector3(
          p.x - Math.sin(this.input.cameraYaw) * 10,
          p.y + 1.52 - Math.sin(this.input.cameraPitch) * 10,
          p.z - Math.cos(this.input.cameraYaw) * 10
        );
        this.camera.lookAt(look);
      }
      return;
    }

    const camMode = this.save.settings.cameraMode;
    const dist = this.player.aimingBow ? 2.4 : camMode === 'close' ? 3.4 : camMode === 'fps' ? 0.15 : this.input.cameraDist;
    const targetY = p.y + (this.player.aimingBow ? 1.55 : 1.42);
    const camX = p.x + Math.sin(this.input.cameraYaw) * Math.cos(this.input.cameraPitch) * dist;
    const camZ = p.z + Math.cos(this.input.cameraYaw) * Math.cos(this.input.cameraPitch) * dist;
    let camY = targetY + Math.sin(this.input.cameraPitch) * dist + 0.55;

    // Ground clip prevention
    const groundCam = getTerrainHeight(camX, camZ) + 0.85;
    if (camY < groundCam) camY = groundCam;

    // Architectural 3D wall-clip prevention (glides camera forward when backing up near Temple/Castle walls!)
    this.camLookScratch.set(p.x, targetY, p.z);
    this.camDesiredScratch.set(camX, camY, camZ);
    this.physics.clampCameraPosition(this.camLookScratch, this.camDesiredScratch, this.camClampedScratch);
    const clampedGround = getTerrainHeight(this.camClampedScratch.x, this.camClampedScratch.z) + 0.72;
    if (this.camClampedScratch.y < clampedGround) this.camClampedScratch.y = clampedGround;

    this.camera.position.copy(this.camClampedScratch);
    const lookTarget = this.lockedEnemy
      ? this.lockedEnemy.position.clone().add(new THREE.Vector3(0, 1.3, 0))
      : this.camLookScratch;
    this.camera.lookAt(lookTarget);
  }

  private loop(nowMs: number): void {
    requestAnimationFrame((t) => this.loop(t));
    if (!this.initialized) return;

    const rawDt = Math.min(0.05, Math.max(0.001, (nowMs - this.lastFrameMs) / 1000));
    this.lastFrameMs = nowMs;
    this.fps = THREE.MathUtils.lerp(this.fps, 1 / rawDt, 0.08);

    // Synchronize TouchControls visibility with Title / Sheikah Slate / Dialogue modal blocking state
    this.touchControls.setBlocked(this.ui.isBlockingInput());
    this.touchControls.setRunesVisible(this.save.unlockedRunes.length > 0);

    // 3D Awakening Cutscene Overlay Fadeout
    if (this.awakeningCutTimer > 0) {
      this.awakeningCutTimer = Math.max(0, this.awakeningCutTimer - rawDt);
      if (this.awakeningCutTimer <= 1.2 && this.awakeningCutTimer > 0.01) {
        this.ui.setAwakeningOverlay('台座のシーカーストーンを手にして……');
      } else if (this.awakeningCutTimer === 0) {
        this.ui.setAwakeningOverlay(null);
      }
    }

    // Overlook Cliff Trigger -> Live 3D Panorama Title Logo Sweep
    const px = this.player.position.x;
    const pz = this.player.position.z;
    if (
      !this.paused &&
      !this.save.storyFlags['intro_panorama_done'] &&
      this.architecture.sorDoorOpened &&
      px > -296.5 &&
      px < -286.0 &&
      Math.hypot(pz - 455) < 8.0
    ) {
      this.save.storyFlags['intro_panorama_done'] = true;
      this.awakeningCutTimer = 0;
      this.panoramaCutTimer = this.panoramaDuration;
      this.ui.setPanoramaLogoVisible(true);
      this.ui.showRegionBanner('始まりの台地', 'GREAT PLATEAU');
      audioEngine.playTitlePanoramaChord();
    }

    if (this.panoramaCutTimer > 0) {
      this.panoramaCutTimer = Math.max(0, this.panoramaCutTimer - rawDt);
      const t = 1 - this.panoramaCutTimer / this.panoramaDuration;
      const sweepPos = new THREE.Vector3(
        THREE.MathUtils.lerp(px - 2.6, px - 1.2, t),
        this.player.position.y + THREE.MathUtils.lerp(2.5, 4.9, t),
        THREE.MathUtils.lerp(pz + 3.0, pz + 5.6, t)
      );
      const sweepLook = new THREE.Vector3(
        THREE.MathUtils.lerp(-245, -140, t),
        THREE.MathUtils.lerp(this.player.position.y + 1.2, 58, t),
        THREE.MathUtils.lerp(470, 120, t)
      );
      this.cameraOverride = { pos: sweepPos, lookAt: sweepLook };
      if (this.panoramaCutTimer === 0) {
        this.cameraOverride = null;
        this.ui.setPanoramaLogoVisible(false);
      }
    }

    const armor = computeArmorSummary(this.save.equippedArmor, this.save.armorStars);

    if (!this.paused) {
      const timeScale = this.player.getWorldTimeScale();
      const worldDt = rawDt * timeScale;
      this.elapsedSec += worldDt;
      this.save.playTimeSec += rawDt;

      const inShrine = this.shrineInterior.isActive();
      const inBeast = this.divineBeastInterior.isActive();
      const inInterior = inShrine || inBeast;

      // 1. Weather, Climate, Sky Dome & Blood Moon
      const activeWep = this.save.weapons.find((w) => w.id === this.save.equippedWeaponId);
      if (!inInterior || !this.climate) {
        const nearFire =
          this.physics.isNearFire(this.player.position) ||
          this.architecture.isNearLitTorch(this.player.position) ||
          (activeWep?.element === 'Fire' && this.player.weaponDrawn);
        this.climate = this.weather.update(worldDt, this.player.position, {
          nearFire,
          holdingIceWeapon: activeWep?.element === 'Ice',
          wearingMetal: activeWep?.material === 'Metal',
          onBloodMoonMidnight: () => {
            const revived = this.enemies.triggerBloodMoonRevival(this.save.levelSensorPoints, this.save.mode === 'master');
            this.ui.showToast(`🌕 赤い月が満ちた……ハイラルの魔物 ${revived} 体が復活した！`, 'red');
          },
        });
      }
      if (inInterior) {
        this.climate = {
          ...this.climate,
          weather: 'sunny',
          temperatureC: 19,
          temperatureF: 66,
          isVolcanicError: false,
          coldHazardLevel: 0,
          heatHazardLevel: 0,
          flameHazardLevel: 0,
          freezingWater: false,
          windStrength: 0,
          lightningWarning: false,
        };
      }

      const isRaining = !inInterior && (this.climate.weather === 'rain' || this.climate.weather === 'thunderstorm');
      const isNight = this.climate.timeHours >= 20 || this.climate.timeHours < 5;

      // 2. Terrain LOD Streaming + Wind Grass + Trees/Rocks + Prop Colliders (overworld only)
      if (!inInterior) {
        this.terrain.update(this.player.position.x, this.player.position.z);
      }

      // 3. Player Controller & Substepped CCD Movement Physics (merges keyboard + multi-touch analog stick & holds!)
      const tc = this.touchControls.state;
      const effectiveInput: InputState = {
        ...this.input,
        moveX: tc.moveX,
        moveY: tc.moveY,
        sprint: this.input.sprint || tc.sprint,
        guard: this.input.guard || tc.guard,
        aimBow: this.input.aimBow || tc.aimBow,
      };
      const { moveSpeed } = this.player.update(rawDt, effectiveInput, this.save, armor, this.physics, this.runes, {
        isRaining,
        isNight,
        lockedTargetPos: this.lockedEnemy?.alive ? this.lockedEnemy.position : null,
        onFootstep: (s) => audioEngine.playFootstep(s),
        onBulletTimeEnter: () => audioEngine.playBulletTimeEnter(),
        onNotify: (m) => this.ui.showToast(m, 'amber'),
        onFallDamage: (hearts) => {
          this.applyPlayerDamage(hearts);
          audioEngine.playHitImpact(false);
          this.ui.showToast(`💥 高所からの落下ダメージ！ (-${hearts} ハート)`, 'red');
        },
        onDrown: (safePos) => {
          this.applyPlayerDamage(1.0);
          this.player.setExactPosition(safePos.x, safePos.y + 0.15, safePos.z);
          this.ui.showToast('🌊 スタミナ切れで溺れてしまった！陸地へ戻された (-1 ハート)', 'red');
        },
      });

      // Pre-Paraglider Great Plateau mist boundary guard: prevent leaving plateau before receiving Paraglider
      if (
        !inInterior &&
        !this.save.hasParaglider &&
        this.player.position.y < 28 &&
        Math.hypot(this.player.position.x - (-245), this.player.position.z - 480) > 195
      ) {
        this.applyPlayerDamage(1.0);
        this.player.teleportTo(-252, 488, 0.3);
        this.ui.showToast('🌫 深い霧が立ち込めている……パラセールなしでは台地から降りられない！', 'amber');
      }

      // 4. BTB (Bullet Time Bounce): Landing on a ragdolled enemy with Shield Surfing triggers massive 19x velocity bounce!
      if (!inInterior && this.save.settings.glitchPhysics && this.player.shieldSurfing && !this.player.grounded) {
        for (const e of this.enemies.enemies) {
          if (e.alive && e.ragdollTimer > 0 && e.position.distanceTo(this.player.position) < 2.4) {
            const launch = this.player.getForwardDirection().multiplyScalar(58);
            this.player.velocity.set(launch.x, 32, launch.z);
            this.ui.showToast('🚀 BTB（バレットタイムバウンス）発動！！', 'cyan');
            break;
          }
        }
      }

      // 5. Physics & Chemistry Engine + Sheikah Runes + Arrows + Architecture / Shrine / Divine Beast Interior
      this.physics.update(worldDt, this.elapsedSec, isRaining);
      const fwd = this.player.getForwardDirection();
      const runeOut = this.runes.update(
        worldDt,
        this.player.position,
        fwd,
        this.physics,
        !inInterior && this.climate.weather === 'thunderstorm',
        this.climate.windStrength
      );
      if (runeOut.magnesisShockedPlayer && !armor.lightningProof) {
        this.applyPlayerDamage(2);
        this.ui.showToast('⚡ 雷雨のマグネキャッチに落雷！感電した！', 'red');
      }
      if (runeOut.bikeFuelEmpty) {
        this.ui.showToast('⛽ マスターバイク零式の燃料が切れました！ポーチから素材を給油してください', 'amber');
      }

      this.updateArrows(rawDt, isRaining);

      let combatStatus: { inCombat: boolean; guardianLocked: boolean; activeBoss: WorldEnemy | null } = {
        inCombat: false,
        guardianLocked: false,
        activeBoss: null,
      };
      let npcOut: { nearbyKorokDistance: number } = { nearbyKorokDistance: Infinity };

      if (inShrine) {
        const shOut = this.shrineInterior.update(worldDt, this.player.position, this.player.grounded);
        if (shOut.fellInPit) {
          this.applyPlayerDamage(1.0);
          this.player.velocity.set(0, 0, 0);
          this.ui.showToast('⚠️ 奈落に落ちた！足場へ戻された (-1 ハート)', 'amber');
        }
        if (shOut.switchUnlocked) {
          audioEngine.playChestFanfare();
          this.ui.showToast('⚙️ 試練の扉が開いた！', 'cyan');
        }
        if (shOut.boulderHit && this.player.invulnTimer <= 0) {
          this.applyPlayerDamage(shOut.boulderHit.hearts);
          this.player.velocity.copy(shOut.boulderHit.knockback);
          this.player.grounded = false;
          audioEngine.playHitImpact(false);
          this.ui.showToast('🪨 転がる大岩に弾き飛ばされた！ (-1 ハート)', 'red');
        }
        if (shOut.playerHit && this.player.invulnTimer <= 0) {
          const hit = shOut.playerHit;
          if (this.player.guarding && this.player.perfectGuardWindow > 0) {
            audioEngine.playParryClang();
            this.ui.showToast('🛡 ジャストガード！ガーディアンの攻撃を弾いた！', 'amber');
          } else {
            const dmgHearts = Math.max(0.25, (hit.damage - armor.totalDefense * 0.55) / 4);
            this.applyPlayerDamage(dmgHearts);
          }
        }
      } else if (inBeast) {
        const dbOut = this.divineBeastInterior.update(worldDt, this.player.position, this.player.grounded);
        if (dbOut.fellInPit) {
          this.applyPlayerDamage(1.0);
          this.player.velocity.set(0, 0, 0);
          this.ui.showToast('⚠️ 神獣内部の奈落へ落下！足場へ戻された (-1 ハート)', 'amber');
        }
        if (dbOut.bossDownedByGimmick) {
          audioEngine.playHitImpact(true);
          this.ui.showToast(dbOut.bossDownedByGimmick, 'cyan');
        }
        if (dbOut.bossHitPlayer && this.player.invulnTimer <= 0) {
          const hit = dbOut.bossHitPlayer;
          if (this.player.guarding && this.player.perfectGuardWindow > 0) {
            audioEngine.playParryClang();
            this.divineBeastInterior.onPlayerPerfectCounterBoss();
            this.ui.showToast('🛡 ジャストガード成功！カースガノンの体勢を崩した！！', 'amber');
          } else {
            const dmgHearts = Math.max(0.25, (hit.damage - armor.totalDefense * 0.55) / 4);
            this.applyPlayerDamage(dmgHearts);
            this.ui.showToast(`💥 ${hit.labelJa}`, 'red');
          }
        }
        if (this.divineBeastInterior.activeBoss && this.divineBeastInterior.activeBoss.state !== 'dead') {
          combatStatus.inCombat = true;
        }
      } else {
        this.architecture.update(worldDt, this.elapsedSec);

        // 6. Enemies, Bosses, Guardians & 3 Sky Dragons
        combatStatus = this.enemies.update(worldDt, this.elapsedSec, this.player.position, {
          masterMode: this.save.mode === 'master',
          stealthLevel: armor.stealthLevel,
          disguises: armor.disguises,
          physics: this.physics,
          onEnemyAttackPlayer: (en, dmg, isLaser) => this.handleEnemyAttackPlayer(en, dmg, isLaser),
          onReflectBeamHitEnemy: (en, dmg) => {
            this.enemies.damageEnemy(en, dmg, new THREE.Vector3(0, 1, 0), { onDeath: (dead) => this.onEnemyKilled(dead) });
            this.ui.showToast(`💥 反射ビーム命中！${en.nameJa} に ${dmg} ダメージ！`, 'amber');
          },
        });

        // 7. NPCs (24h/Rain AI), Koroks & Wildlife
        npcOut = this.npcs.update(worldDt, this.elapsedSec, this.climate.timeHours, this.climate.weather, this.player.position);

        // 8. Climate Hazards (Cold / Heat / Volcanic Flame / Freezing Water!)
        this.hazardTickTimer += rawDt;
        if (this.hazardTickTimer >= 3.2) {
          this.hazardTickTimer = 0;
          if (this.climate.freezingWater) {
            this.applyPlayerDamage(1.0);
            this.ui.showToast('❄️ 極寒水域！防具・薬では防げない急激な冷気ダメージ！', 'red');
          } else if (this.climate.flameHazardLevel > armor.flameGuard && !armor.fireproof) {
            this.applyPlayerDamage(0.5);
            this.ui.showToast('🔥 灼熱火山圏！耐火装備（耐火シリーズ/燃えず薬）が必要！', 'red');
          } else if (this.climate.coldHazardLevel > armor.coldResist) {
            this.applyPlayerDamage(0.5);
            this.ui.showToast('❄️ 極寒地帯！防寒装備（リトの羽毛/防寒着）が必要！', 'cyan');
          } else if (this.climate.heatHazardLevel > armor.heatResist) {
            this.applyPlayerDamage(0.5);
            this.ui.showToast('☀️ 猛暑地帯！耐暑装備（熱砂/淑女シリーズ）が必要！', 'amber');
          }
        }
      }

      // 9. Champions' Ability Cooldowns & RevivalRandom (60s 1% grid check) & Hero's Path + Auto-save
      for (const k of ['mipha', 'daruk', 'revali', 'urbosa'] as const) {
        const ch = this.save.champions[k];
        if (ch.cooldown > 0) {
          ch.cooldown = Math.max(0, ch.cooldown - rawDt);
          if (ch.cooldown === 0) ch.charges = ch.maxCharges;
        }
      }
      recordHeroPathSample(this.save, this.player.position.x, this.player.position.y, this.player.position.z);

      this.revivalRandomTimer += rawDt;
      if (this.revivalRandomTimer >= 60) {
        this.revivalRandomTimer = 0;
        if (Math.random() < 0.01) {
          this.save.materials.apple = (this.save.materials.apple ?? 0) + 1;
        }
      }

      this.autoSaveTimer += rawDt;
      if (this.autoSaveTimer >= 45) {
        this.autoSaveTimer = 0;
        this.syncSaveFromRuntime();
        void saveManager.save(getAutoSlotId(this.save.mode), this.save);
      }

      const beastBoss =
        inBeast && this.divineBeastInterior.activeBoss && this.divineBeastInterior.activeBoss.state !== 'dead'
          ? this.divineBeastInterior.activeBoss
          : null;

      // 10. Open-Air Web Audio Update (CEDEC 2017 spatial wind, insects, birds, 3-layer dynamic BGM!)
      const reg = getRegionAt(this.player.position.x, this.player.position.z);
      const nearSettlement = !inInterior
        ? LANDMARKS.find(
            (l) =>
              (l.type === 'settlement' || l.type === 'stable') &&
              Math.hypot(l.x - this.player.position.x, l.z - this.player.position.z) < l.radius + 25
          )
        : undefined;
      audioEngine.update(rawDt, {
        regionId: reg.id,
        timeHours: this.climate.timeHours,
        weather: this.climate.weather,
        altitude: inInterior ? 50 : this.player.position.y,
        speed: moveSpeed,
        isParagliding: this.player.paragliding,
        inSettlement: nearSettlement?.id ?? null,
        inCombat: combatStatus.inCombat || !!beastBoss,
        guardianLocked: combatStatus.guardianLocked,
        bloodMoon: !inInterior && this.climate.isBloodMoonRising,
        inHyruleCastle: !inInterior && Math.hypot(this.player.position.x - (-80), this.player.position.z - (-260)) < 140,
        windStrength: this.climate.windStrength,
        inBossFight: !!combatStatus.activeBoss || !!beastBoss,
      });

      // 11. Nearest Interactable + ZL Reticle + Touch Interact Sync + HUD Projection
      this.nearestInteract = this.findNearestInteractable();
      this.touchControls.setInteractLabel(this.nearestInteract?.label ?? null);
      this.touchControls.setZLLocked(!!this.lockedEnemy?.alive);
      if (this.lockedEnemy?.alive) {
        this.lockReticle.visible = true;
        this.lockReticle.position.copy(this.lockedEnemy.position).add(new THREE.Vector3(0, 1.8, 0));
        this.lockReticle.lookAt(this.camera.position);
      } else {
        this.lockReticle.visible = false;
      }

      this.updateCamera();

      // Project Link's torso position to screen for Stamina Wheel positioning
      const proj = this.player.position.clone().add(new THREE.Vector3(0, 1.15, 0)).project(this.camera);
      const sx = (proj.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-proj.y * 0.5 + 0.5) * window.innerHeight;

      const hudActiveBoss = beastBoss
        ? { nameJa: beastBoss.nameJa, hp: beastBoss.hp, maxHp: beastBoss.maxHp }
        : combatStatus.activeBoss && this.awakeningCutTimer <= 0 && this.panoramaCutTimer <= 0
          ? { nameJa: combatStatus.activeBoss.nameJa, hp: combatStatus.activeBoss.hp, maxHp: combatStatus.activeBoss.maxHp }
          : null;

      this.ui.updateHud(rawDt, {
        save: this.save,
        climate: this.climate,
        playerPos: this.player.position,
        playerYaw: this.player.yaw,
        cameraYaw: this.input.cameraYaw,
        screenStaminaPos: { x: sx, y: sy, visible: proj.z < 1 },
        stamina: this.save.stamina,
        maxStamina: this.save.maxStamina,
        tempStamina: this.player.tempStamina,
        exhausted: this.player.exhausted,
        noiseLevel: this.player.noiseLevel,
        activeRune: this.runes.activeRune,
        bulletTime: this.player.bulletTimeActive,
        flurryRush: this.player.flurryRushTimer > 0,
        cameraModeActive: this.runes.cameraModeActive,
        cameraTargetName: this.runes.cameraModeActive ? this.detectCameraTarget()?.nameJa ?? null : null,
        activeBoss: hudActiveBoss,
        interactLabel: this.nearestInteract?.label ?? null,
        korokMaskRattle: armor.korokDetect && npcOut.nearbyKorokDistance < 28,
        fps: this.fps,
      });
    } else {
      this.updateCamera();
      // Keep Inventory 3D preview smoothly spinning while paused
      if (this.climate) {
        this.ui.updateHud(rawDt, {
          save: this.save,
          climate: this.climate,
          playerPos: this.player.position,
          playerYaw: this.player.yaw,
          cameraYaw: this.input.cameraYaw,
          screenStaminaPos: { x: 0, y: 0, visible: false },
          stamina: this.save.stamina,
          maxStamina: this.save.maxStamina,
          tempStamina: this.player.tempStamina,
          exhausted: this.player.exhausted,
          noiseLevel: 0.1,
          activeRune: this.runes.activeRune,
          bulletTime: false,
          flurryRush: false,
          cameraModeActive: false,
          cameraTargetName: null,
          activeBoss: null,
          interactLabel: null,
          korokMaskRattle: false,
          fps: this.fps,
        });
      }
    }

    this.renderFrame();
  }

  /**
   * Clean programmatic test & visual inspection bridge (`window.__BOTW__`).
   */
  private exposeAutomationBridge(): void {
    (window as unknown as Record<string, unknown>).__BOTW__ = {
      engine: this,
      startPlayDirectly: () => {
        this.ui.dismissTitleDirectly();
        this.paused = false;
        this.touchControls.setBlocked(false);
      },
      waitForAllModels: async () => {
        await this.deferredPreloadPromise;
        return {
          allKeys: ALL_MODEL_KEYS,
          loadedKeys: modelLoader.getLoadedKeys(),
          instantiatedKeys: modelLoader.getInstantiatedKeys(),
        };
      },
      getModelStats: () => ({
        allKeys: ALL_MODEL_KEYS,
        loadedKeys: modelLoader.getLoadedKeys(),
        instantiatedKeys: modelLoader.getInstantiatedKeys(),
      }),
      getPhysicsStats: () => ({
        staticColliders: this.physics.staticColliders.length,
        propColliders: this.physics.propColliderCount,
        climbing: this.player.climbing,
        climbingWall: this.player.climbingWall,
      }),
      getTerrainDiagnostics: () => this.terrain.getChunkDiagnostics(),
      getGraphicsState: () => ({
        quality: this.activeQuality,
        useComposer: this.useComposer,
        dpr: this.renderer.getPixelRatio(),
        preserveDrawingBuffer: this.renderer.getContextAttributes()?.preserveDrawingBuffer ?? false,
        lastCompendiumSnapshotLength: this.lastCompendiumSnapshotUrl?.length ?? 0,
      }),
      getTouchState: () => ({
        visible: this.touchControls.isVisible(),
        mode: this.touchControls.getMode(),
        moveX: this.touchControls.state.moveX,
        moveY: this.touchControls.state.moveY,
        sprint: this.touchControls.state.sprint,
        guard: this.touchControls.state.guard,
        aimBow: this.touchControls.state.aimBow,
        cameraYaw: this.input.cameraYaw,
        cameraPitch: this.input.cameraPitch,
      }),
      setTouchMode: (m: 'auto' | 'always' | 'hidden') => {
        this.save.settings.touchControlsMode = m;
        this.applyUserSettings();
      },
      setGraphicsQuality: (q: GraphicsQuality) => {
        this.save.settings.graphicsQuality = q;
        this.applyUserSettings();
      },
      setCameraOverride: (pos: [number, number, number], lookAt: [number, number, number]) => {
        this.cameraOverride = { pos: new THREE.Vector3(...pos), lookAt: new THREE.Vector3(...lookAt) };
      },
      clearCameraOverride: () => {
        this.cameraOverride = null;
      },
      teleport: (x: number, z: number, yaw?: number) => {
        this.player.teleportTo(x, z, 0.15);
        if (yaw !== undefined) this.player.yaw = yaw;
        this.terrain.update(x, z);
      },
      selectRune: (r: RuneId) => this.runes.selectRune(r),
      activateRune: () => this.activateRune(),
      igniteGrassAndGlide: () => {
        const p = this.player.position;
        const gy = getTerrainHeight(p.x, p.z);
        this.physics.spawnFireUpdraft(new THREE.Vector3(p.x, gy, p.z), 5.0, 26, 25);
        this.player.position.y = gy + 2.5;
        this.player.grounded = false;
        this.player.paragliding = true;
        this.player.velocity.y = 12.0;
        return { fireZones: this.physics.fireZones.length, paragliding: this.player.paragliding };
      },
      triggerBulletTimeShot: () => {
        this.player.position.y += 4.5;
        this.player.grounded = false;
        this.input.aimBow = true;
        this.player.bulletTimeActive = true;
        const arrow = this.player.fireArrow(this.save, this.player.getForwardDirection());
        const scale = this.player.getWorldTimeScale();
        this.input.aimBow = false;
        return { fired: !!arrow, timeScale: scale };
      },
      equipArmor: (head: string | null, body: string | null, legs: string | null) => {
        this.save.equippedArmor = { head, body, legs };
        this.player.syncVisuals(this.save);
        return computeArmorSummary(this.save.equippedArmor, this.save.armorStars);
      },
      equipWeapon: (weaponId: string, drawn = true) => {
        this.save.equippedWeaponId = weaponId;
        this.player.weaponDrawn = drawn;
        this.player.syncVisuals(this.save);
      },
      interactNearest: () => this.performInteract(),
      openSlate: (tab: 'inventory' | 'map' | 'adventure' | 'compendium' | 'system') => this.ui.openSlate(tab),
      closeAllModals: () => {
        this.ui.closeDialogue();
        this.ui.closeSubModal();
        this.ui.closeSlate();
      },
      getState: () => ({
        pos: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        region: getRegionAt(this.player.position.x, this.player.position.z).id,
        fps: Math.round(this.fps),
        activeRune: this.runes.activeRune,
        paragliding: this.player.paragliding,
        fireZones: this.physics.fireZones.length,
        cryonisCount: this.runes.cryonisPillars.length,
        armorSummary: computeArmorSummary(this.save.equippedArmor, this.save.armorStars),
        mealsCount: this.save.meals.length,
        towersCount: this.architecture.towers.length,
        shrinesCount: this.architecture.shrines.length,
        chestsCount: this.architecture.chests.length,
        torchesCount: this.architecture.torches.length,
        weaponDropsCount: this.architecture.weaponDrops.length,
        npcsCount: this.npcs.npcs.length,
        enemiesCount: this.enemies.enemies.length,
        koroksCount: this.npcs.koroks.length,
      }),
    };
  }
}
