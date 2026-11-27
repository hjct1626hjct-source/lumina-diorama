import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { modelLoader } from '../rendering/ModelLoader';
import { TerrainChunkManager } from '../world/TerrainChunkManager';
import { WeatherClimateSystem, type ClimateStatus } from '../world/WeatherClimateSystem';
import { ArchitectureBuilder, type WorldChest, type WorldShrine, type WorldTower } from '../world/ArchitectureBuilder';
import { getRegionAt, getTerrainHeight } from '../world/TerrainGenerator';
import { PhysicsChemistryEngine } from '../physics/PhysicsChemistryEngine';
import { SheikahRuneSystem } from '../gameplay/SheikahRunes';
import { PlayerController, type InputState } from '../gameplay/PlayerController';
import { EnemyAndBossSystem, SPECIES_KILL_POINTS, type WorldEnemy } from '../entities/EnemyAndBossSystem';
import { NpcAndKorokSystem, evaluateNpcEventFlow, type WorldKorok, type WorldNpc } from '../entities/NpcAndKorokSystem';
import { BotWHudAndMenu } from '../ui/BotWHudAndMenu';
import { audioEngine } from '../audio/OpenAirAudioEngine';
import {
  createDefaultSave,
  getAutoSlotId,
  getManualSlotId,
  recordHeroPathSample,
  saveManager,
  type SaveSlotId,
} from '../save/SaveManager';
import { computeArmorSummary } from '../data/armors';
import {
  AUTO_PARRY_LASER_SHIELD_IDS,
  computeBotWDamage,
  computeMasterCycleFuel,
} from '../data/itemsAndCooking';
import { ALL_MEMORIES, COMPENDIUM_CATALOG } from '../data/storyAndQuests';
import { LANDMARKS } from '../data/regions';
import type { RuneId, SaveSlotData } from '../types/botw';

type NearbyInteractable =
  | { kind: 'npc'; npc: WorldNpc; label: string }
  | { kind: 'chest'; chest: WorldChest; label: string }
  | { kind: 'shrine'; shrine: WorldShrine; label: string }
  | { kind: 'tower'; tower: WorldTower; label: string }
  | { kind: 'pot'; label: string }
  | { kind: 'memory'; memoryId: string; label: string }
  | { kind: 'korok'; korok: WorldKorok; label: string };

/**
 * Master 60fps Three.js WebGL2 Open-Air Breath of the Wild Engine.
 */
export class BotWGameEngine {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;

  public terrain!: TerrainChunkManager;
  public weather!: WeatherClimateSystem;
  public physics!: PhysicsChemistryEngine;
  public architecture!: ArchitectureBuilder;
  public runes!: SheikahRuneSystem;
  public player!: PlayerController;
  public enemies!: EnemyAndBossSystem;
  public npcs!: NpcAndKorokSystem;
  public ui!: BotWHudAndMenu;

  public save: SaveSlotData;
  public climate!: ClimateStatus;

  private input: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    crouch: false,
    guard: false,
    aimBow: false,
    whistle: false,
    cameraYaw: -2.42, // Looks NE from Shrine of Resurrection across Great Plateau, Temple of Time, Tower, Dueling Peaks & Hyrule Castle!
    cameraPitch: 0.08,
    cameraDist: 5.2,
  };

  private paused = false;
  private initialized = false;
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

  // ZL Lock-on Golden Reticle
  private lockReticle: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Enables crisp Camera Rune snapshots!
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#8ec8ec');

    this.camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.25, 2900);

    // Painterly Post-Processing Pipeline (RenderPass -> Subtle BotW Bloom -> ACES OutputPass)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.24, // Subtle glow on Sheikah cyan/orange runes, flames & sun highlights (zero blowout!)
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
    // 1. Preload all downloaded CC0/MIT .glb models via ModelLoader (normalizes Box3 + y=0 + BotW Toon Shader!)
    await modelLoader.preload([
      'chest_wood',
      'chest_gold',
      'barrel',
      'crates',
      'pillar',
      'rubble',
      'npc_knight',
      'npc_rogue',
      'npc_traveler',
      'npc_mage',
      'npc_barbarian',
      'stal_warrior',
      'stal_minion',
      'horse',
      'fox',
      'bird_stork',
      'bird_parrot',
    ]);

    // 2. Load existing auto-save if present
    const saved = await saveManager.load('botw_normal_auto');
    if (saved) {
      this.save = saved;
    }

    // 3. Instantiate World, Physics/Chemistry, Architecture, Runes, Player, Enemies, NPCs, UI
    this.weather = new WeatherClimateSystem(this.scene);
    this.weather.timeHours = this.save.inGameTimeHours;
    this.weather.daysElapsed = this.save.daysElapsed;
    this.weather.bloodMoonTimerSec = this.save.bloodMoonTimerSec;

    this.terrain = new TerrainChunkManager();
    this.scene.add(this.terrain.group);

    this.physics = new PhysicsChemistryEngine(this.scene);
    this.architecture = new ArchitectureBuilder(this.scene, this.physics);
    this.runes = new SheikahRuneSystem(this.scene);
    this.player = new PlayerController(this.scene);
    this.enemies = new EnemyAndBossSystem(this.scene);
    this.npcs = new NpcAndKorokSystem(this.scene);

    this.ui = new BotWHudAndMenu({
      onStartNewGame: (mode) => {
        this.save = createDefaultSave(mode);
        this.applyLoadedSave();
      },
      onContinueGame: () => {
        this.applyLoadedSave();
      },
      onSelectRune: (r) => {
        this.runes.selectRune(r);
        audioEngine.playUiSelect();
      },
      onTriggerInteract: () => this.performInteract(),
      onFastTravel: (x, z, labelJa) => {
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
          this.save = loaded;
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
      onTriggerBloodMoon: () => {
        this.weather.triggerBloodMoon();
        const revived = this.enemies.triggerBloodMoonRevival(this.save.levelSensorPoints, this.save.mode === 'master');
        this.ui.showToast(`🌕 赤い月が昇る……魔物 ${revived} 体が復活した！（料理100%大成功時間）`, 'red');
      },
      onAdvanceTime: (hours) => {
        this.weather.advanceTimeHours(hours);
        this.ui.showToast(`時間を +${hours} 時間進めました`, 'cyan');
      },
      onEnterTrialOfSword: (tier) => {
        this.save.masterSwordAwakened = true;
        this.ui.showToast(`⚔ 剣の試練（${tier.toUpperCase()}）制覇シミュレーション完了！マスターソード攻撃力60・耐久188へ常時覚醒！`, 'amber');
        audioEngine.playChestFanfare();
      },
      onTogglePause: (p) => {
        this.paused = p;
      },
      onNotify: (t, a) => this.ui.showToast(t, a),
    });

    this.applyLoadedSave();
    this.bindInputListeners();
    this.exposeAutomationBridge();

    this.initialized = true;
    this.lastFrameMs = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private applyLoadedSave(): void {
    this.ui.bindSave(this.save);
    this.player.teleportTo(this.save.playerPos.x, this.save.playerPos.z, 0.25);
    this.player.yaw = this.save.playerPos.yaw;
    this.runes.bikeFuel = this.save.masterCycleFuel;

    // Build all architecture, shrines, towers, chests, memories, enemies, NPCs & Koroks!
    this.terrain.update(this.player.position.x, this.player.position.z);
    if (this.architecture.towers.length === 0) {
      this.architecture.buildAll({
        activatedTowers: this.save.activatedTowers,
        completedShrines: this.save.completedShrines,
        openedChests: this.save.openedChests,
        defeatedDivineBeasts: this.save.defeatedDivineBeasts,
        unlockedMemories: this.save.unlockedMemories,
        memoryLocations: ALL_MEMORIES.map((m) => ({ id: m.id, titleJa: m.titleJa, x: m.pos.x, z: m.pos.z })),
      });
    }
    this.enemies.populateWorld(this.save.levelSensorPoints, this.save.mode === 'master', this.save.defeatedDivineBeasts.length);
    this.npcs.populateAll(this.save.foundKoroks);
  }

  private syncSaveFromRuntime(): void {
    this.save.playerPos = {
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
      yaw: this.player.yaw,
    };
    this.save.inGameTimeHours = this.weather.timeHours;
    this.save.daysElapsed = this.weather.daysElapsed;
    this.save.bloodMoonTimerSec = this.weather.bloodMoonTimerSec;
    this.save.masterCycleFuel = this.runes.bikeFuel;
    this.save.savedAt = Date.now();
  }

  private handleDialogueAction(act: string): void {
    if (act === 'grant_paraglider') {
      this.save.hasParaglider = true;
      this.ui.showToast('パラセールを授かった！空中でSpaceキーで滑空できます', 'amber');
      audioEngine.playChestFanfare();
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
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
    });

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
          this.input.guard = true;
          this.player.triggerGuardStart();
          break;
        case 'KeyR':
          this.input.aimBow = true;
          break;
        case 'KeyV':
          this.input.whistle = true;
          break;
        case 'KeyX':
          this.player.triggerShieldSurf((m) => this.ui.showToast(m, 'cyan'));
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
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
        case 'Digit7': {
          const idx = Number(e.code.replace('Digit', '')) - 1;
          const r = this.save.unlockedRunes[idx];
          if (r) {
            this.runes.selectRune(r);
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
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();

    const isRaining = this.climate?.weather === 'rain' || this.climate?.weather === 'thunderstorm';
    audioEngine.playRuneActivate(this.runes.activeRune);

    this.runes.activateCurrentRune({
      playerPos: this.player.position,
      forwardDir: fwd,
      physics: this.physics,
      upgradedBomb: this.save.upgradedRunes.bomb,
      upgradedStasis: this.save.upgradedRunes.stasis,
      isRaining,
      isParagliding: this.player.paragliding,
      onNotify: (n) => this.ui.showToast(n.text, n.accent),
      onExplosionImpact: (pos, radius, damage, impulse, isBomb) => {
        audioEngine.playBombExplode();
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
      onStasisEnemy: (origin, dir, upgraded) => !!this.enemies.tryStasisEnemy(origin, dir, upgraded),
      onCameraSnap: () => this.captureCompendiumPhoto(),
    });
  }

  private captureCompendiumPhoto(): void {
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
    if (this.player.attackCooldown > 0) return;
    this.player.weaponDrawn = true;
    this.player.attackCooldown = this.player.flurryRushTimer > 0 ? 0.14 : 0.34;
    this.player.comboIndex = (this.player.comboIndex + 1) % 4;
    this.player.comboResetTimer = 1.1;
    this.player.model.triggerAttackSwing(this.player.comboIndex);
    audioEngine.playSwordSwing();

    const armor = computeArmorSummary(this.save.equippedArmor, this.save.armorStars);
    const wep = this.save.weapons.find((w) => w.id === this.save.equippedWeaponId);
    const baseAtk = wep ? (wep.isMasterSword && this.save.masterSwordAwakened ? 60 : wep.attack) : 10;
    const fwd = this.player.getForwardDirection();

    // Flameblade / Fire weapon ignites dry grass right in front of Link -> Fire Updraft!
    if (wep?.element === 'Fire') {
      const igniteSpot = this.player.position.clone().addScaledVector(fwd, 2.2);
      igniteSpot.y = getTerrainHeight(igniteSpot.x, igniteSpot.z);
      const isRaining = this.climate?.weather === 'rain' || this.climate?.weather === 'thunderstorm';
      if (!isRaining) {
        this.physics.spawnFireUpdraft(igniteSpot, 4.4, 24, 26);
        this.ui.showToast('🔥 炎の剣で草原に着火！上昇気流が発生！', 'amber');
      }
    }

    // Check Stasis frozen rigid bodies -> add kinetic energy impulse!
    for (const b of this.physics.bodies) {
      if (b.isFrozenStasis && b.position.distanceTo(this.player.position) < 4.5) {
        this.physics.applyStasisHit(b, fwd.clone().multiplyScalar(14));
        audioEngine.playStasisTick(b.stasisHits);
        this.ui.showToast(`⏱ ビタロック打撃蓄積 (${b.stasisHits} HIT)`, 'amber');
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
          weaponIsAncient: wep?.isAncient,
          weaponIsBone: wep?.isBone,
          element: urbosaTriggered ? 'Electricity' : wep?.element,
          targetShockImmune: e.isShockImmune,
        }) + (urbosaTriggered ? 150 : 0);

      audioEngine.playHitImpact(isSneakstrike || this.player.comboIndex === 0);
      this.enemies.damageEnemy(e, dmg, toE, {
        freeze: wep?.element === 'Ice',
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
      this.ui.showToast(`✨ ${e.nameJa} 撃破！神獣解放！`, 'amber');
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
    const hasAncientShield = AUTO_PARRY_LASER_SHIELD_IDS.has(this.save.equippedShieldId);
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
        // Record Hero's Path death marker & revive safely at Shrine of Resurrection
        recordHeroPathSample(this.save, this.player.position.x, this.player.position.y, this.player.position.z, true);
        this.save.hearts = this.save.maxHearts;
        this.player.teleportTo(-298, 454, 0.5);
        this.ui.showToast('回生の祠で復活しました', 'red');
      }
    }
  }

  private findNearestInteractable(): NearbyInteractable | null {
    const p = this.player.position;

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
    for (const pot of this.architecture.cookingPots) {
      if (pot.position.distanceTo(p) < 3.8) {
        return { kind: 'pot', label: `${pot.nameJa} で料理する` };
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
      if (sh.position.distanceTo(p) < 7.5) {
        return { kind: 'shrine', shrine: sh, label: `${sh.nameJa}（${sh.subtitleJa}）に挑む` };
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
    const target = this.nearestInteract ?? this.findNearestInteractable();
    if (!target) return;

    if (target.kind === 'npc') {
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
        tarreyTownStage: this.save.tarreyTownStage,
        thunderHelmRecovered: !!this.save.storyFlags['Electric_Relic_GetBack'],
      });
      this.activeDialogueNpc = target.npc;
      this.ui.openDialogue(dlg);
    } else if (target.kind === 'chest') {
      this.architecture.openChest(target.chest);
      if (!this.save.openedChests.includes(target.chest.id)) this.save.openedChests.push(target.chest.id);
      if (target.chest.rewardType === 'rupees') this.save.rupees += target.chest.rewardAmount;
      else if (target.chest.rewardType === 'arrow') this.save.arrows.normal += target.chest.rewardAmount;
      else this.save.materials[target.chest.rewardId] = (this.save.materials[target.chest.rewardId] ?? 0) + target.chest.rewardAmount;
      audioEngine.playChestFanfare();
      this.ui.showToast(`🎁 宝箱を開けた！ ${target.chest.rewardTextJa} を手に入れた！`, 'amber');
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
      this.architecture.completeShrine(target.shrine.id);
      if (!this.save.completedShrines.includes(target.shrine.id)) {
        this.save.completedShrines.push(target.shrine.id);
        this.save.spiritOrbs += 1;
      }
      audioEngine.playShrineChime();
      this.ui.showToast(`🔷 ${target.shrine.nameJa} クリア！克服の証を手に入れた（シーカー回路がシアン発光！）`, 'cyan');
    } else if (target.kind === 'tower') {
      this.architecture.activateTower(target.tower.regionId);
      if (!this.save.activatedTowers.includes(target.tower.regionId)) {
        this.save.activatedTowers.push(target.tower.regionId);
      }
      audioEngine.playShrineChime();
      this.ui.showToast(`📡 ${target.tower.nameJa} 起動！周辺エリアのシーカーマップ情報を入手！`, 'cyan');
    }
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

      if (hit) {
        if (a.type === 'fire' && !isRaining) {
          this.physics.spawnFireUpdraft(new THREE.Vector3(a.position.x, gy, a.position.z), 4.6, 25, 28);
          this.ui.showToast('🔥 炎の矢が草原に着火！上昇気流が発生！', 'amber');
        } else if (a.type === 'bomb') {
          this.physics.triggerExplosion(a.position, 6.5, 22, isRaining);
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

    this.camera.position.set(camX, camY, camZ);
    const lookTarget = this.lockedEnemy
      ? this.lockedEnemy.position.clone().add(new THREE.Vector3(0, 1.3, 0))
      : new THREE.Vector3(p.x, targetY, p.z);
    this.camera.lookAt(lookTarget);
  }

  private loop(nowMs: number): void {
    requestAnimationFrame((t) => this.loop(t));
    if (!this.initialized) return;

    const rawDt = Math.min(0.05, Math.max(0.001, (nowMs - this.lastFrameMs) / 1000));
    this.lastFrameMs = nowMs;
    this.fps = THREE.MathUtils.lerp(this.fps, 1 / rawDt, 0.08);

    const armor = computeArmorSummary(this.save.equippedArmor, this.save.armorStars);

    if (!this.paused) {
      const timeScale = this.player.getWorldTimeScale();
      const worldDt = rawDt * timeScale;
      this.elapsedSec += worldDt;
      this.save.playTimeSec += rawDt;

      // 1. Weather, Climate, Sky Dome & Blood Moon
      const activeWep = this.save.weapons.find((w) => w.id === this.save.equippedWeaponId);
      this.climate = this.weather.update(worldDt, this.player.position, {
        nearFire: this.physics.isNearFire(this.player.position),
        holdingIceWeapon: activeWep?.element === 'Ice',
        wearingMetal: activeWep?.material === 'Metal',
        onBloodMoonMidnight: () => {
          const revived = this.enemies.triggerBloodMoonRevival(this.save.levelSensorPoints, this.save.mode === 'master');
          this.ui.showToast(`🌕 赤い月が満ちた……ハイラルの魔物 ${revived} 体が復活した！`, 'red');
        },
      });

      const isRaining = this.climate.weather === 'rain' || this.climate.weather === 'thunderstorm';
      const isNight = this.climate.timeHours >= 20 || this.climate.timeHours < 5;

      // 2. Terrain LOD Streaming + Wind Grass + Trees/Rocks
      this.terrain.update(this.player.position.x, this.player.position.z);

      // 3. Player Controller & Movement Physics (runs at responsive real-time even in Bullet-Time!)
      const { moveSpeed } = this.player.update(rawDt, this.input, this.save, armor, this.physics, this.runes, {
        isRaining,
        isNight,
        lockedTargetPos: this.lockedEnemy?.alive ? this.lockedEnemy.position : null,
        onFootstep: (s) => audioEngine.playFootstep(s),
        onBulletTimeEnter: () => audioEngine.playBulletTimeEnter(),
        onNotify: (m) => this.ui.showToast(m, 'amber'),
      });

      // 4. BTB (Bullet Time Bounce): Landing on a ragdolled enemy with Shield Surfing triggers massive 19x velocity bounce!
      if (this.save.settings.glitchPhysics && this.player.shieldSurfing && !this.player.grounded) {
        for (const e of this.enemies.enemies) {
          if (e.alive && e.ragdollTimer > 0 && e.position.distanceTo(this.player.position) < 2.4) {
            const launch = this.player.getForwardDirection().multiplyScalar(58);
            this.player.velocity.set(launch.x, 32, launch.z);
            this.ui.showToast('🚀 BTB（バレットタイムバウンス）発動！！', 'cyan');
            break;
          }
        }
      }

      // 5. Physics & Chemistry Engine + Sheikah Runes + Arrows + Architecture
      this.physics.update(worldDt, this.elapsedSec, isRaining);
      const fwd = this.player.getForwardDirection();
      const runeOut = this.runes.update(
        worldDt,
        this.player.position,
        fwd,
        this.physics,
        this.climate.weather === 'thunderstorm',
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
      this.architecture.update(worldDt, this.elapsedSec);

      // 6. Enemies, Bosses, Guardians & 3 Sky Dragons
      const combatStatus = this.enemies.update(worldDt, this.elapsedSec, this.player.position, {
        masterMode: this.save.mode === 'master',
        stealthLevel: armor.stealthLevel,
        disguises: armor.disguises,
        onEnemyAttackPlayer: (en, dmg, isLaser) => this.handleEnemyAttackPlayer(en, dmg, isLaser),
        onReflectBeamHitEnemy: (en, dmg) => {
          this.enemies.damageEnemy(en, dmg, new THREE.Vector3(0, 1, 0), { onDeath: (dead) => this.onEnemyKilled(dead) });
          this.ui.showToast(`💥 反射ビーム命中！${en.nameJa} に ${dmg} ダメージ！`, 'amber');
        },
      });

      // 7. NPCs (24h/Rain AI), Koroks & Wildlife
      const npcOut = this.npcs.update(worldDt, this.elapsedSec, this.climate.timeHours, this.climate.weather, this.player.position);

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
        // 10x8 1000m grid RevivalRandom check + Midnight Shop Restock (<50 arrows rule)
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

      // 10. Open-Air Web Audio Update (CEDEC 2017 spatial wind, insects, birds, 3-layer dynamic BGM!)
      const reg = getRegionAt(this.player.position.x, this.player.position.z);
      const nearSettlement = LANDMARKS.find(
        (l) => (l.type === 'settlement' || l.type === 'stable') && Math.hypot(l.x - this.player.position.x, l.z - this.player.position.z) < l.radius + 25
      );
      audioEngine.update(rawDt, {
        regionId: reg.id,
        timeHours: this.climate.timeHours,
        weather: this.climate.weather,
        altitude: this.player.position.y,
        speed: moveSpeed,
        isParagliding: this.player.paragliding,
        inSettlement: nearSettlement?.id ?? null,
        inCombat: combatStatus.inCombat,
        guardianLocked: combatStatus.guardianLocked,
        bloodMoon: this.climate.isBloodMoonRising,
        inHyruleCastle: Math.hypot(this.player.position.x - (-80), this.player.position.z - (-260)) < 140,
        windStrength: this.climate.windStrength,
        inBossFight: !!combatStatus.activeBoss,
      });

      // 11. Nearest Interactable + ZL Reticle + HUD Projection
      this.nearestInteract = this.findNearestInteractable();
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
        activeBoss: combatStatus.activeBoss
          ? { nameJa: combatStatus.activeBoss.nameJa, hp: combatStatus.activeBoss.hp, maxHp: combatStatus.activeBoss.maxHp }
          : null,
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

    this.composer.render();
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
        npcsCount: this.npcs.npcs.length,
        enemiesCount: this.enemies.enemies.length,
        koroksCount: this.npcs.koroks.length,
      }),
    };
  }
}
