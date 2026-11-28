import * as THREE from 'three';
import {
  ARMOR_MAP,
  ARMOR_PIECES,
  GREAT_FAIRY_UPGRADE_COSTS,
  KOCHI_DYE_COLORS,
  KOCHI_DYE_MAP,
  computeArmorSummary,
  getPieceDefense,
} from '../data/armors';
import {
  MATERIAL_MAP,
  MATERIALS,
  computeMasterCycleFuel,
  cookIngredients,
} from '../data/itemsAndCooking';
import { LANDMARKS, PHYSICAL_SHRINES, REGION_LIST, REGIONS, WORLD_BOUNDS } from '../data/regions';
import {
  ALL_MEMORIES,
  ALL_QUESTS,
  CHAMPIONS_BALLAD_TRIALS,
  COMPENDIUM_CATALOG,
  HYRULE_HISTORY_CHRONICLE,
  READABLE_DOCUMENTS,
  TRIAL_OF_THE_SWORD_STAGES,
  TRUE_ENDING_EPILOGUE,
} from '../data/storyAndQuests';
import { LinkCharacterModel } from '../rendering/LinkCharacterModel';
import {
  ALL_SAVE_SLOTS,
  canUseSheikahFeatures,
  computeCompletionBreakdown,
  exchangeSpiritOrbs,
  getManualSlotId,
  purchaseArmorDye,
  purchaseGreatFairyUpgrade,
  saveManager,
} from '../save/SaveManager';
import type { ClimateStatus } from '../world/WeatherClimateSystem';
import type { NpcDialoguePayload } from '../entities/NpcAndKorokSystem';
import type { ArrowType, MemoryDef, RegionId, RuneId, SaveSlotData } from '../types/botw';

export interface HudUpdateContext {
  save: SaveSlotData;
  climate: ClimateStatus;
  playerPos: THREE.Vector3;
  playerYaw: number;
  cameraYaw: number;
  screenStaminaPos: { x: number; y: number; visible: boolean };
  stamina: number;
  maxStamina: number;
  tempStamina: number;
  exhausted: boolean;
  noiseLevel: number;
  activeRune: RuneId | null;
  bulletTime: boolean;
  flurryRush: boolean;
  cameraModeActive: boolean;
  cameraTargetName: string | null;
  activeBoss: { nameJa: string; hp: number; maxHp: number } | null;
  interactLabel: string | null;
  korokMaskRattle: boolean;
  fps: number;
}

export interface UiCallbacks {
  onStartNewGame: (mode: 'normal' | 'master', skipIntro?: boolean) => void;
  onContinueGame: () => void;
  onSelectRune: (rune: RuneId) => void;
  onTriggerInteract: () => void;
  onFastTravel: (x: number, z: number, labelJa: string) => void;
  onSaveManual: (slotIdx: 1 | 2 | 3) => void;
  onLoadSlot: (slotId: string) => void;
  onSwitchMode: (mode: 'normal' | 'master') => void;
  onDialogueAction: (action: string) => void;
  onDialogueClose: () => void;
  onShopBuy: (itemId: string, price: number) => void;
  onEatMeal: (idx: number) => void;
  onRefuelBike: (materialIds: string[]) => void;
  onCookDone: (mealName: string, critical: boolean) => void;
  onWaitAtFire: (targetHour: number) => void;
  onTogglePause: (paused: boolean) => void;
  onSettingsChanged?: () => void;
  onNotify: (text: string, accent?: 'cyan' | 'amber' | 'red') => void;
}

const RUNE_LABELS: Record<RuneId, { icon: string; name: string }> = {
  magnesis: { icon: '🧲', name: 'マグネ' },
  bomb_round: { icon: '🔵', name: '丸爆弾' },
  bomb_square: { icon: '🔷', name: '角爆弾' },
  stasis: { icon: '⏱', name: 'ビタロック' },
  cryonis: { icon: '🧊', name: 'アイス' },
  camera: { icon: '📷', name: 'ウツシエ' },
  master_cycle: { icon: '🏍', name: 'バイク' },
};

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  rain: '🌧️',
  thunderstorm: '⛈️',
  snow: '❄️',
  blizzard: '🌨️',
  sunshower: '🌦️',
  volcanic_ash: '🌋',
  sandstorm: '🌪️',
};

/**
 * Complete Authentic Breath of the Wild UI & Sheikah Slate Interface Manager.
 */
export class BotWHudAndMenu {
  private cb: UiCallbacks;
  private save!: SaveSlotData;
  private currentTab: 'inventory' | 'map' | 'adventure' | 'compendium' | 'system' = 'inventory';
  private invSubTab: 'weapons' | 'bows' | 'shields' | 'armor' | 'materials' | 'meals' | 'key' = 'armor';
  private advSubTab: 'main' | 'shrine' | 'side' | 'memories' | 'chronicle' | 'docs' | 'dlc' = 'memories';
  private isSlateOpen = false;
  private isDialogueOpen = false;
  private isSubModalOpen = false;
  private lastRegionId: RegionId | null = null;
  private regionBannerTimer = 0;
  private toastTimer = 0;

  // Map view state
  private mapZoom = 1.0;
  private mapPanX = 0;
  private mapPanZ = 0;
  private heroPathPlaybackFrac = 1.0;
  private showHeroPath = true;
  private selectedPinColor = '#36e4ff';

  // Live 3D Link Dress-Up Preview Renderer inside Inventory!
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewCamera: THREE.PerspectiveCamera | null = null;
  private previewLink: LinkCharacterModel | null = null;
  private previewYaw = 0.25;

  // Active dialogue payload
  private activeDialogue: NpcDialoguePayload | null = null;
  private dialogueLineIndex = 0;

  // Cached DOM references
  private elTitle!: HTMLElement;
  private elAwakening!: HTMLElement;
  private elAwakeningText!: HTMLElement;
  private elPanoramaTitle!: HTMLElement;
  private elShrineFade!: HTMLElement;
  private elShrineFadeTitle!: HTMLElement;
  private elShrineFadeSub!: HTMLElement;
  private elHud!: HTMLElement;
  private elHearts!: HTMLElement;
  private elChamps!: HTMLElement;
  private elRupees!: HTMLElement;
  private elMasterBadge!: HTMLElement;
  private elRegionBanner!: HTMLElement;
  private elBossWrap!: HTMLElement;
  private elBossName!: HTMLElement;
  private elBossFill!: HTMLElement;
  private elToast!: HTMLElement;
  private elStaminaWrap!: HTMLElement;
  private elStaminaSvg!: SVGElement;
  private elRuneRow!: HTMLElement;
  private elInteractBtn!: HTMLElement;
  private elBottomRight!: HTMLElement;
  private elTemp!: HTMLElement;
  private elWeather!: HTMLElement;
  private elClock!: HTMLElement;
  private elSoundCanvas!: HTMLCanvasElement;
  private elMinimapWrap!: HTMLElement;
  private elMinimapCanvas!: HTMLCanvasElement;
  private elBtnHudSlate!: HTMLElement;
  private elBtnHudMap!: HTMLElement;
  private elBtnHudPro!: HTMLElement;
  private elSlateModal!: HTMLElement;
  private elSlateBody!: HTMLElement;
  private elDialogueBox!: HTMLElement;
  private elSubModal!: HTMLElement;
  private elQuickRibbon!: HTMLElement;
  private elCameraOverlay!: HTMLElement;
  private elCameraTag!: HTMLElement;
  private elBulletVig!: HTMLElement;
  private elBloodVig!: HTMLElement;

  constructor(callbacks: UiCallbacks) {
    this.cb = callbacks;
    this.mountDom();
  }

  public isTouchUi(): boolean {
    return document.body.classList.contains('touch-ui-active');
  }

  /**
   * Reliable iPad Safari + Desktop tap binder: handles pointerdown->pointerup within 18px slop
   * and suppresses duplicate synthetic click firing within 380ms, while preserving regular click & Enter.
   */
  private bindTap(el: Element | null | undefined, handler: (ev: Event) => void): void {
    if (!el) return;
    let activeId: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastHandledAt = 0;

    el.addEventListener('pointerdown', (ev) => {
      const pe = ev as PointerEvent;
      activeId = pe.pointerId;
      startX = pe.clientX;
      startY = pe.clientY;
    });

    el.addEventListener('pointerup', (ev) => {
      const pe = ev as PointerEvent;
      if (activeId !== pe.pointerId) return;
      activeId = null;
      if (Math.hypot(pe.clientX - startX, pe.clientY - startY) <= 18) {
        lastHandledAt = performance.now();
        ev.preventDefault();
        handler(ev);
      }
    });

    el.addEventListener('pointercancel', () => {
      activeId = null;
    });

    el.addEventListener('click', (ev) => {
      if (performance.now() - lastHandledAt < 380) return;
      lastHandledAt = performance.now();
      handler(ev);
    });
  }

  private mountDom(): void {
    const root = document.getElementById('ui-root')!;
    root.innerHTML = `
      <!-- Title Overlay -->
      <section id="botw-title" class="botw-overlay">
        <div class="title-crest">
          <div class="title-kicker">OPEN-AIR HYRULE ENGINE • BASE + DLC 1 & 2</div>
          <h1 class="title-main">BREATH OF THE WILD</h1>
          <div class="title-sub">ゼルダの伝説 ブレス オブ ザ ワイルド — Web 3D 完全再現エディション</div>
          <div style="margin-top:8px;font-size:13px;letter-spacing:0.12em;color:#e4c465;">製作者:駿 (Created by Shun)</div>
          <div class="title-btn-group">
            <button id="btn-continue" class="botw-btn primary" type="button">▶ つづきから冒険する</button>
            <button id="btn-new-normal" class="botw-btn primary" type="button">✦ はじめから（通常モード）</button>
            <button id="btn-new-master" class="botw-btn master" type="button">▲ マスターモード（DLC1）</button>
          </div>
          <p style="margin-top:20px;font-size:12px;color:#b8cfe0;line-height:1.7;">
            PC: WASD移動 / Shiftダッシュ / Spaceジャンプ＆パラセール / 右ドラッグ視点 / 左クリック剣攻撃 / Qルーン発動 / C盾ガード / R弓照準 / E調べる<br />
            iPad・タッチ端末: 左下スティック移動 / 右・上部ドラッグ360°視点 / 右下ボタン同時操作（攻撃・長押し溜め・跳躍・ダッシュ/回避・盾・注目・ルーン・弓）
          </p>
        </div>
      </section>

      <!-- Live 3D Shrine of Resurrection Awakening Cut Overlay (non-blocking) -->
      <div id="awakening-overlay" class="awakening-overlay hidden">
        <div class="awakening-light"></div>
        <div id="awakening-subtitle" class="awakening-subtitle">目を開けて…リンク…</div>
      </div>

      <!-- Live 3D Cliff Overlook Panorama Title Logo Overlay (non-blocking) -->
      <div id="panorama-title-overlay" class="panorama-title-overlay hidden">
        <div class="panorama-kicker">THE LEGEND OF ZELDA</div>
        <div class="panorama-main">BREATH OF THE WILD</div>
        <div class="panorama-sub">ゼルダの伝説 ブレス オブ ザ ワイルド</div>
      </div>

      <!-- Shrine Interior Elevator Fade Transition -->
      <div id="shrine-fade-overlay" class="shrine-fade-overlay">
        <div id="shrine-fade-title"></div>
        <div id="shrine-fade-sub" style="font-size:13px;color:#bdeeff;"></div>
      </div>

      <!-- Vignettes & Camera Viewfinder -->
      <div id="bullettime-vig" class="bullettime-vignette"></div>
      <div id="bloodmoon-vig" class="bloodmoon-vignette"></div>
      <div id="camera-viewfinder" class="camera-viewfinder hidden">
        <div class="camera-reticle"></div>
        <div id="camera-tag" class="camera-tag">📷 ウツシエ待機中 — 撮影対象を捉えて発動</div>
      </div>

      <!-- In-Game Authentic BotW HUD -->
      <div id="botw-hud" class="hidden">
        <div class="hud-top-left">
          <div id="hud-hearts" class="hearts-row"></div>
          <div id="hud-champions" class="champions-strip"></div>
          <div id="hud-rupees" class="hud-rupee-pill"></div>
        </div>

        <div class="hud-top-center">
          <div id="hud-region-banner" class="region-banner"></div>
          <div id="hud-boss-wrap" class="boss-bar-wrap hidden">
            <div id="hud-boss-name" class="boss-name"></div>
            <div class="boss-hp-track"><div id="hud-boss-fill" class="boss-hp-fill" style="width:100%"></div></div>
          </div>
          <div id="hud-toast" class="hud-toast"></div>
        </div>

        <div class="hud-top-right">
          <button id="btn-hud-slate" class="hud-chip-btn" type="button">📱 ポーチ (Tab)</button>
          <button id="btn-hud-map" class="hud-chip-btn" type="button">🗺️ マップ (M)</button>
          <button id="btn-hud-adv" class="hud-chip-btn" type="button">📜 冒険手帳</button>
          <button id="btn-hud-pro" class="hud-chip-btn" type="button">👁️ プロHUD (H)</button>
        </div>

        <div id="stamina-wheel-wrap">
          <svg id="stamina-wheel-svg" viewBox="0 0 68 68" width="68" height="68"></svg>
        </div>

        <div class="hud-bottom-left">
          <button id="hud-interact-btn" class="interact-prompt hidden" type="button"></button>
          <div id="hud-rune-row" class="rune-pill-row hidden"></div>
        </div>

        <div id="hud-master-badge" class="master-triforce hidden">▲ MASTER MODE</div>

        <div id="hud-bottom-right" class="hud-bottom-right">
          <div class="sensor-cluster">
            <div class="sensor-row">
              <span style="color:#c878ff;font-size:11px;">♪</span>
              <canvas id="sound-wave-canvas" class="sound-wave-canvas" width="66" height="20"></canvas>
              <span id="hud-temp" class="temp-gauge">18°C</span>
            </div>
            <div class="sensor-row">
              <div id="hud-weather" class="weather-strip"></div>
              <span id="hud-clock" class="clock-readout">09:30</span>
            </div>
          </div>
          <div id="minimap-wrap" class="minimap-circle-wrap" title="シーカーマップを開く">
            <canvas id="minimap-canvas" width="146" height="146"></canvas>
            <div id="minimap-north" class="minimap-north">N</div>
          </div>
        </div>
      </div>

      <!-- Quick D-Pad Ribbon -->
      <div id="quick-ribbon" class="quick-ribbon hidden"></div>

      <!-- EventFlow Dialogue Box -->
      <div id="dialogue-box" class="dialogue-box hidden"></div>

      <!-- Cooking / Campfire / Goddess Statue / Dye Shop / Great Fairy / Document / Memory Sub-Modal -->
      <div id="sub-modal" class="slate-modal hidden"></div>

      <!-- Sheikah Slate Pause Menu -->
      <div id="slate-modal" class="slate-modal hidden">
        <div class="slate-shell">
          <div class="slate-tabs">
            <button class="slate-tab-btn active" data-tab="inventory" type="button">🎒 ポーチ (3D着せ替え)</button>
            <button class="slate-tab-btn" data-tab="map" type="button">🗺️ シーカーマップ ＆ 足跡</button>
            <button class="slate-tab-btn" data-tab="adventure" type="button">📜 冒険手帳 ＆ 全23記憶</button>
            <button class="slate-tab-btn" data-tab="compendium" type="button">📷 ハイラル図鑑</button>
            <button class="slate-tab-btn" data-tab="system" type="button">⚙️ システム ＆ セーブ</button>
            <div class="slate-spacer"></div>
            <button id="btn-slate-close" class="botw-btn small" type="button">✕ 閉じる</button>
          </div>
          <div id="slate-body" class="slate-body"></div>
        </div>
      </div>
    `;

    this.elTitle = document.getElementById('botw-title')!;
    this.elAwakening = document.getElementById('awakening-overlay')!;
    this.elAwakeningText = document.getElementById('awakening-subtitle')!;
    this.elPanoramaTitle = document.getElementById('panorama-title-overlay')!;
    this.elShrineFade = document.getElementById('shrine-fade-overlay')!;
    this.elShrineFadeTitle = document.getElementById('shrine-fade-title')!;
    this.elShrineFadeSub = document.getElementById('shrine-fade-sub')!;
    this.elHud = document.getElementById('botw-hud')!;
    this.elHearts = document.getElementById('hud-hearts')!;
    this.elChamps = document.getElementById('hud-champions')!;
    this.elRupees = document.getElementById('hud-rupees')!;
    this.elMasterBadge = document.getElementById('hud-master-badge')!;
    this.elRegionBanner = document.getElementById('hud-region-banner')!;
    this.elBossWrap = document.getElementById('hud-boss-wrap')!;
    this.elBossName = document.getElementById('hud-boss-name')!;
    this.elBossFill = document.getElementById('hud-boss-fill')!;
    this.elToast = document.getElementById('hud-toast')!;
    this.elStaminaWrap = document.getElementById('stamina-wheel-wrap')!;
    this.elStaminaSvg = document.getElementById('stamina-wheel-svg') as unknown as SVGElement;
    this.elRuneRow = document.getElementById('hud-rune-row')!;
    this.elInteractBtn = document.getElementById('hud-interact-btn')!;
    this.elBottomRight = document.getElementById('hud-bottom-right')!;
    this.elTemp = document.getElementById('hud-temp')!;
    this.elWeather = document.getElementById('hud-weather')!;
    this.elClock = document.getElementById('hud-clock')!;
    this.elSoundCanvas = document.getElementById('sound-wave-canvas') as HTMLCanvasElement;
    this.elMinimapWrap = document.getElementById('minimap-wrap')!;
    this.elMinimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.elBtnHudSlate = document.getElementById('btn-hud-slate')!;
    this.elBtnHudMap = document.getElementById('btn-hud-map')!;
    this.elBtnHudPro = document.getElementById('btn-hud-pro')!;
    this.elSlateModal = document.getElementById('slate-modal')!;
    this.elSlateBody = document.getElementById('slate-body')!;
    this.elDialogueBox = document.getElementById('dialogue-box')!;
    this.elSubModal = document.getElementById('sub-modal')!;
    this.elQuickRibbon = document.getElementById('quick-ribbon')!;
    this.elCameraOverlay = document.getElementById('camera-viewfinder')!;
    this.elCameraTag = document.getElementById('camera-tag')!;
    this.elBulletVig = document.getElementById('bullettime-vig')!;
    this.elBloodVig = document.getElementById('bloodmoon-vig')!;

    this.bindStaticEvents();
  }

  private bindStaticEvents(): void {
    this.bindTap(document.getElementById('btn-continue'), () => {
      this.elTitle.classList.add('hidden');
      this.elHud.classList.remove('hidden');
      this.cb.onContinueGame();
    });
    this.bindTap(document.getElementById('btn-new-normal'), () => {
      this.elTitle.classList.add('hidden');
      this.elHud.classList.remove('hidden');
      this.cb.onStartNewGame('normal', false);
    });
    this.bindTap(document.getElementById('btn-new-master'), () => {
      this.elTitle.classList.add('hidden');
      this.elHud.classList.remove('hidden');
      this.cb.onStartNewGame('master', false);
    });

    this.bindTap(document.getElementById('btn-hud-slate'), () => this.openSlate('inventory'));
    this.bindTap(document.getElementById('btn-hud-map'), () => this.openSlate('map'));
    this.bindTap(document.getElementById('btn-hud-adv'), () => this.openSlate('adventure'));
    this.bindTap(document.getElementById('btn-hud-pro'), () => {
      if (!this.save) return;
      this.save.settings.proHud = !this.save.settings.proHud;
      this.showToast(this.save.settings.proHud ? 'プロHUD ON（ミニマップ・センサー非表示）' : '通常HUD ON');
    });
    this.bindTap(this.elMinimapWrap, () => this.openSlate('map'));
    this.bindTap(this.elInteractBtn, () => this.cb.onTriggerInteract());

    this.bindTap(document.getElementById('btn-slate-close'), () => this.closeSlate());
    this.elSlateModal.querySelectorAll('.slate-tab-btn').forEach((btn) => {
      this.bindTap(btn, () => {
        const tab = (btn as HTMLElement).dataset.tab as typeof this.currentTab;
        if ((tab === 'map' || tab === 'compendium') && this.save && !canUseSheikahFeatures(this.save)) {
          this.showToast('シーカーストーンを取得するまで使用できません', 'amber');
          return;
        }
        this.currentTab = tab;
        this.renderSlateTab();
      });
    });
  }

  public bindSave(save: SaveSlotData): void {
    this.save = save;
  }

  public setShrineFade(active: boolean, titleJa = '', subtitleJa = ''): void {
    this.elShrineFadeTitle.textContent = titleJa;
    this.elShrineFadeSub.textContent = subtitleJa;
    this.elShrineFade.classList.toggle('active', active);
  }

  public dismissTitleDirectly(): void {
    this.elTitle.classList.add('hidden');
    this.elAwakening.classList.add('hidden');
    this.elPanoramaTitle.classList.add('hidden');
    this.elHud.classList.remove('hidden');
  }

  public setAwakeningOverlay(subtitleText: string | null): void {
    if (subtitleText) {
      this.elAwakeningText.textContent = subtitleText;
      this.elAwakening.classList.remove('hidden');
    } else {
      this.elAwakening.classList.add('hidden');
    }
  }

  public setPanoramaLogoVisible(visible: boolean): void {
    if (visible) {
      this.elAwakening.classList.add('hidden');
    }
    this.elPanoramaTitle.classList.toggle('hidden', !visible);
  }

  public isBlockingInput(): boolean {
    return (
      !this.elTitle.classList.contains('hidden') ||
      this.isSlateOpen ||
      this.isDialogueOpen ||
      this.isSubModalOpen
    );
  }

  public showRegionBanner(nameJa: string, subtitle?: string): void {
    this.elRegionBanner.innerHTML = `${nameJa}${subtitle ? `<div style="font-size:11px;letter-spacing:0.28em;color:#e4c465;margin-top:2px;">${subtitle}</div>` : ''}`;
    this.elRegionBanner.classList.add('visible');
    this.regionBannerTimer = 4.2;
  }

  public showToast(text: string, accent: 'cyan' | 'amber' | 'red' = 'cyan'): void {
    this.elToast.textContent = text;
    this.elToast.className = `hud-toast visible ${accent}`;
    this.toastTimer = 3.6;
  }

  // ==================== EVENTFLOW DIALOGUE BOX ====================
  public openDialogue(payload: NpcDialoguePayload): void {
    this.activeDialogue = payload;
    this.dialogueLineIndex = 0;
    this.isDialogueOpen = true;
    this.cb.onTogglePause(true);
    this.elDialogueBox.classList.remove('hidden');
    this.renderDialogue();
  }

  private renderDialogue(): void {
    if (!this.activeDialogue) return;
    const p = this.activeDialogue;
    const line = p.lines[this.dialogueLineIndex] ?? p.lines[p.lines.length - 1];
    const isLast = this.dialogueLineIndex >= p.lines.length - 1;

    let shopHtml = '';
    if (isLast && p.shopItems && p.shopItems.length > 0) {
      shopHtml = `<div class="dialogue-choices">${p.shopItems
        .map(
          (it) =>
            `<button class="botw-btn small" data-buy-id="${it.id}" data-buy-price="${it.price}" type="button">${it.nameJa} (${it.price}ルピー)</button>`
        )
        .join('')}</div>`;
    }

    let choicesHtml = '';
    if (isLast && p.choices && p.choices.length > 0) {
      choicesHtml = `<div class="dialogue-choices">${p.choices
        .map((c) => `<button class="botw-btn small primary" data-dlg-act="${c.action}" type="button">▸ ${c.label}</button>`)
        .join('')}</div>`;
    }

    this.elDialogueBox.innerHTML = `
      <div class="dialogue-header">
        <span class="dialogue-speaker">${p.speakerName}</span>
        <span class="dialogue-role">${p.roleTitle}</span>
      </div>
      <div class="dialogue-text">${line}</div>
      ${shopHtml}
      ${choicesHtml}
      <div class="dialogue-footer">
        ${
          !isLast
            ? `<button id="btn-dlg-next" class="botw-btn small primary" type="button">次へ ▶</button>`
            : `<button id="btn-dlg-close" class="botw-btn small primary" type="button">${p.isYigaAmbush ? '⚔️ 戦闘開始！' : '会話を終える'}</button>`
        }
      </div>
    `;

    this.bindTap(this.elDialogueBox.querySelector('#btn-dlg-next'), () => {
      this.dialogueLineIndex++;
      this.renderDialogue();
    });
    this.bindTap(this.elDialogueBox.querySelector('#btn-dlg-close'), () => this.closeDialogue());
    this.elDialogueBox.querySelectorAll('[data-dlg-act]').forEach((el) => {
      this.bindTap(el, () => {
        const act = (el as HTMLElement).dataset.dlgAct!;
        this.closeDialogue();
        this.cb.onDialogueAction(act);
      });
    });
    this.elDialogueBox.querySelectorAll('[data-buy-id]').forEach((el) => {
      this.bindTap(el, () => {
        const id = (el as HTMLElement).dataset.buyId!;
        const price = Number((el as HTMLElement).dataset.buyPrice!);
        this.cb.onShopBuy(id, price);
      });
    });
  }

  public closeDialogue(): void {
    this.isDialogueOpen = false;
    this.activeDialogue = null;
    this.elDialogueBox.classList.add('hidden');
    this.cb.onTogglePause(false);
    this.cb.onDialogueClose();
  }

  // ==================== QUICK SWITCH RIBBON (D-Pad Weapons/Bows/Shields/Arrows) ====================
  public openQuickRibbon(kind: 'weapon' | 'bow' | 'shield' | 'arrow'): void {
    this.elQuickRibbon.classList.remove('hidden');
    if (kind === 'weapon') {
      this.elQuickRibbon.innerHTML = this.save.weapons
        .map(
          (w) =>
            `<button class="quick-card ${w.id === this.save.equippedWeaponId ? 'selected' : ''}" data-qw="${w.id}" type="button">
              <div>${w.nameJa}</div><div style="color:#e4c465">ATK ${w.attack}</div>
            </button>`
        )
        .join('');
      this.elQuickRibbon.querySelectorAll('[data-qw]').forEach((b) => {
        this.bindTap(b, () => {
          this.save.equippedWeaponId = (b as HTMLElement).dataset.qw!;
          this.elQuickRibbon.classList.add('hidden');
          this.showToast(`武器装備：${this.save.weapons.find((x) => x.id === this.save.equippedWeaponId)?.nameJa}`);
        });
      });
    } else if (kind === 'arrow') {
      const types: Array<[ArrowType, string]> = [
        ['normal', '木の矢'],
        ['fire', '炎の矢'],
        ['ice', '氷の矢'],
        ['shock', '電気の矢'],
        ['bomb', 'バクダン矢'],
        ['ancient', '古代兵装・矢'],
      ];
      this.elQuickRibbon.innerHTML = types
        .map(
          ([t, label]) =>
            `<button class="quick-card ${t === this.save.equippedArrow ? 'selected' : ''}" data-qa="${t}" type="button">
              <div>${label}</div><div style="color:#36e4ff">×${this.save.arrows[t] ?? 0}</div>
            </button>`
        )
        .join('');
      this.elQuickRibbon.querySelectorAll('[data-qa]').forEach((b) => {
        this.bindTap(b, () => {
          this.save.equippedArrow = (b as HTMLElement).dataset.qa as ArrowType;
          this.elQuickRibbon.classList.add('hidden');
          this.showToast(`矢切替：${this.save.equippedArrow}`);
        });
      });
    } else if (kind === 'shield') {
      this.elQuickRibbon.innerHTML = this.save.shields
        .map(
          (s) =>
            `<button class="quick-card ${s.id === this.save.equippedShieldId ? 'selected' : ''}" data-qs="${s.id}" type="button">
              <div>${s.nameJa}</div><div style="color:#36e4ff">DEF ${s.attack}</div>
            </button>`
        )
        .join('');
      this.elQuickRibbon.querySelectorAll('[data-qs]').forEach((b) => {
        this.bindTap(b, () => {
          this.save.equippedShieldId = (b as HTMLElement).dataset.qs!;
          this.elQuickRibbon.classList.add('hidden');
        });
      });
    } else {
      this.elQuickRibbon.innerHTML = this.save.bows
        .map(
          (bw) =>
            `<button class="quick-card ${bw.id === this.save.equippedBowId ? 'selected' : ''}" data-qb="${bw.id}" type="button">
              <div>${bw.nameJa}</div><div style="color:#e4c465">ATK ${bw.attack}</div>
            </button>`
        )
        .join('');
      this.elQuickRibbon.querySelectorAll('[data-qb]').forEach((b) => {
        this.bindTap(b, () => {
          this.save.equippedBowId = (b as HTMLElement).dataset.qb!;
          this.elQuickRibbon.classList.add('hidden');
        });
      });
    }
  }

  public closeQuickRibbon(): void {
    this.elQuickRibbon.classList.add('hidden');
  }

  // ==================== SHEIKAH SLATE PAUSE MENU ====================
  public openSlate(tab: typeof this.currentTab = 'inventory'): void {
    if ((tab === 'map' || tab === 'compendium') && this.save && !canUseSheikahFeatures(this.save)) {
      this.showToast('シーカーストーンを手に入れるまでマップ・図鑑は使用できません', 'amber');
      return;
    }
    this.currentTab = tab;
    this.isSlateOpen = true;
    this.elSlateModal.classList.remove('hidden');
    this.cb.onTogglePause(true);
    this.renderSlateTab();
  }

  public closeSlate(): void {
    this.isSlateOpen = false;
    this.elSlateModal.classList.add('hidden');
    this.cb.onTogglePause(false);
  }

  public toggleSlate(tab: typeof this.currentTab = 'inventory'): void {
    if (this.isSlateOpen && this.currentTab === tab) this.closeSlate();
    else this.openSlate(tab);
  }

  private renderSlateTab(): void {
    this.elSlateModal.querySelectorAll('.slate-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === this.currentTab);
    });

    if (this.currentTab === 'inventory') this.renderInventoryTab();
    else if (this.currentTab === 'map') this.renderMapTab();
    else if (this.currentTab === 'adventure') this.renderAdventureTab();
    else if (this.currentTab === 'compendium') this.renderCompendiumTab();
    else this.renderSystemTab();
  }

  private renderInventoryTab(): void {
    const summary = computeArmorSummary(this.save.equippedArmor, this.save.armorStars);
    const ownedArmors = ARMOR_PIECES.filter((p) => this.save.ownedArmorIds.includes(p.id));
    const subTabs: Array<[typeof this.invSubTab, string]> = [
      ['armor', `🛡 防具 (${ownedArmors.length})`],
      ['weapons', `⚔ 武器 (${this.save.weapons.length})`],
      ['bows', `🏹 弓・矢`],
      ['shields', `🛡 盾 (${this.save.shields.length})`],
      ['materials', `🍎 素材`],
      ['meals', `🍲 料理 (${this.save.meals.length})`],
      ['key', `✦ 大事なもの`],
    ];

    let gridHtml = '';
    if (this.invSubTab === 'armor') {
      const hasAnyEquipped = Boolean(
        this.save.equippedArmor.head || this.save.equippedArmor.body || this.save.equippedArmor.legs
      );
      const canVai =
        this.save.ownedArmorIds.includes('gerudo_veil') &&
        this.save.ownedArmorIds.includes('gerudo_top') &&
        this.save.ownedArmorIds.includes('gerudo_sirwal');
      const canChamp =
        this.save.ownedArmorIds.includes('champions_tunic') &&
        this.save.ownedArmorIds.includes('hylian_trousers');
      gridHtml = `
        <div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap;">
          ${hasAnyEquipped ? `<button id="btn-strip-naked" class="botw-btn small" type="button">🩳 装備を外す</button>` : ''}
          ${canVai ? `<button id="btn-equip-vai" class="botw-btn small" type="button">💃 淑女セット</button>` : ''}
          ${canChamp ? `<button id="btn-equip-champ" class="botw-btn small" type="button">⚔ 英傑の服セット</button>` : ''}
        </div>
        ${
          ownedArmors.length === 0
            ? `<p style="color:#aac2d8;line-height:1.7;">まだ防具を所持していません。回生の祠内の宝箱や各地のショップ・宝箱で防具を手に入れよう！</p>`
            : `<div class="inv-grid">
          ${ownedArmors
            .map((p) => {
              const isEq =
                this.save.equippedArmor.head === p.id ||
                this.save.equippedArmor.body === p.id ||
                this.save.equippedArmor.legs === p.id;
              const stars = this.save.armorStars[p.id] ?? 0;
              const def = getPieceDefense(p.id, stars);
              const dyeId = this.save.armorDyes[p.id];
              const dyeBadge = dyeId && KOCHI_DYE_MAP[dyeId] ? ` • 🎨${KOCHI_DYE_MAP[dyeId].nameJa}` : '';
              return `
              <div class="inv-item ${isEq ? 'equipped' : ''}" data-armor-id="${p.id}">
                <div class="inv-item-title">${p.nameJa}</div>
                <div class="inv-item-meta">${p.slot.toUpperCase()} • DEF ${def} ${p.upgradeable ? '★'.repeat(stars) : '(強化不可)'}${dyeBadge}</div>
                <div class="inv-item-meta" style="color:#e4c465;">${p.effect !== 'none' ? p.effect : p.setBonus !== 'none' ? `Set: ${p.setBonus}` : p.dlcTag ?? 'base'}</div>
              </div>`;
            })
            .join('')}
        </div>`
        }`;
    } else if (this.invSubTab === 'weapons') {
      gridHtml =
        this.save.weapons.length === 0
          ? `<p style="color:#aac2d8;line-height:1.7;">武器を所持していません。台地の焚き火そばの「たいまつ・木の枝・木こりのオノ」や石台から拾おう！</p>`
          : `<div class="inv-grid">${this.save.weapons
              .map(
                (w) => `<div class="inv-item ${w.id === this.save.equippedWeaponId ? 'equipped' : ''}" data-wep-id="${w.id}">
            <div class="inv-item-title">${w.nameJa}</div>
            <div class="inv-item-meta">ATK ${w.isMasterSword && this.save.masterSwordAwakened ? 60 : w.attack} • 耐久 ${w.currentDurability}/${w.durability}</div>
            <div class="inv-item-meta">${w.element ? `属性: ${w.element}` : w.material}</div>
          </div>`
              )
              .join('')}</div>`;
    } else if (this.invSubTab === 'bows') {
      gridHtml = `
        ${
          this.save.bows.length === 0
            ? `<p style="color:#aac2d8;margin-bottom:10px;">まだ弓を所持していません。</p>`
            : `<div class="inv-grid">${this.save.bows
                .map(
                  (b) => `<div class="inv-item ${b.id === this.save.equippedBowId ? 'equipped' : ''}" data-bow-id="${b.id}">
            <div class="inv-item-title">${b.nameJa}</div>
            <div class="inv-item-meta">ATK ${b.attack} • 耐久 ${b.currentDurability}</div>
          </div>`
                )
                .join('')}</div>`
        }
        <h4 style="margin:12px 0 6px;color:#e4c465;">矢の種類選択</h4>
        <div class="inv-subtabs">
          ${(['normal', 'fire', 'ice', 'shock', 'bomb', 'ancient'] as ArrowType[])
            .map(
              (a) =>
                `<button class="botw-btn small ${this.save.equippedArrow === a ? 'primary' : ''}" data-arrow-sel="${a}" type="button">${a.toUpperCase()} (×${this.save.arrows[a] ?? 0})</button>`
            )
            .join('')}
        </div>`;
    } else if (this.invSubTab === 'shields') {
      gridHtml =
        this.save.shields.length === 0
          ? `<p style="color:#aac2d8;line-height:1.7;">まだ盾を所持していません。</p>`
          : `<div class="inv-grid">${this.save.shields
              .map(
                (s) => `<div class="inv-item ${s.id === this.save.equippedShieldId ? 'equipped' : ''}" data-shd-id="${s.id}">
            <div class="inv-item-title">${s.nameJa}</div>
            <div class="inv-item-meta">DEF ${s.attack} • 耐久 ${s.currentDurability}</div>
          </div>`
              )
              .join('')}</div>`;
    } else if (this.invSubTab === 'materials') {
      const ownedMats = MATERIALS.filter((m) => (this.save.materials[m.id] ?? 0) > 0);
      gridHtml =
        ownedMats.length === 0
          ? `<p style="color:#aac2d8;line-height:1.7;">素材を所持していません。焼きリンゴやキノコを集めよう！</p>`
          : `<div class="inv-grid">${ownedMats
              .map(
                (m) => `<div class="inv-item">
            <div class="inv-item-title">${m.nameJa} ×${this.save.materials[m.id]}</div>
            <div class="inv-item-meta">バイク燃料 Tier${m.fuelTier} • 効果:${m.effectType ?? 'none'}</div>
          </div>`
              )
              .join('')}</div>`;
    } else if (this.invSubTab === 'meals') {
      gridHtml =
        this.save.meals.length === 0
          ? `<p style="color:#aac2d8;">まだ料理がありません。料理鍋に近づいて「調べる」から最大5素材を調理できます！</p>`
          : `<div class="inv-grid">${this.save.meals
              .map(
                (ml, idx) => `<div class="inv-item" data-eat-idx="${idx}">
                  <div class="inv-item-title">${ml.nameJa}${ml.isCritical ? ' ✨大成功' : ''}</div>
                  <div class="inv-item-meta">♥+${ml.hearts}${ml.tempHearts > 0 ? ` (+黄${ml.tempHearts})` : ''} • ${ml.effectType} Lv${ml.effectLevel} (${Math.round(ml.durationSec / 60)}分)</div>
                </div>`
              )
              .join('')}</div>`;
    } else {
      const unlockedChamps = (['mipha', 'daruk', 'revali', 'urbosa'] as const).filter((k) => this.save.champions[k].unlocked);
      gridHtml = `
        <div class="list-card"><h4>シーカーストーン</h4><p>${this.save.hasSheikahSlate ? `所持済（解放ルーン: ${this.save.unlockedRunes.length}個）` : '未取得（回生の祠の台座を調べよう）'}</p></div>
        <div class="list-card"><h4>パラセール</h4><p>${this.save.hasParaglider ? '所持済（空中で滑空・上昇気流で上昇）' : '未取得（始まりの台地の4つの試練の祠をクリアしよう）'}</p></div>
        <div class="list-card"><h4>克服の証</h4><p>${this.save.spiritOrbs} 個</p></div>
        <div class="list-card"><h4>コログのミ</h4><p>${this.save.korokSeeds} 個発見</p></div>
        ${
          this.save.unlockedRunes.includes('master_cycle')
            ? `<div class="list-card"><h4>マスターバイク零式 (DLC2)</h4><p>残燃料 ${Math.round(this.save.masterCycleFuel)} / 1000 ユニット <button id="btn-refuel-bike" class="botw-btn small" type="button">⛽ リンゴ×5で給油 (+500)</button></p></div>`
            : ''
        }
        ${
          unlockedChamps.length > 0
            ? `<div class="list-card">
                <h4>英傑の加護（ON/OFF切替可）</h4>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
                  ${unlockedChamps
                    .map(
                      (k) =>
                        `<button class="botw-btn small ${this.save.champions[k].enabled ? 'primary' : ''}" data-champ-toggle="${k}" type="button">${k.toUpperCase()}: ${this.save.champions[k].enabled ? 'ON' : 'OFF'} (${this.save.champions[k].charges}/${this.save.champions[k].maxCharges})</button>`
                    )
                    .join('')}
                </div>
              </div>`
            : ''
        }`;
    }

    this.elSlateBody.innerHTML = `
      <div class="inventory-layout">
        <div>
          <div class="inv-subtabs">
            ${subTabs
              .map(
                ([k, label]) =>
                  `<button class="botw-btn small ${this.invSubTab === k ? 'primary' : ''}" data-inv-sub="${k}" type="button">${label}</button>`
              )
              .join('')}
          </div>
          ${gridHtml}
        </div>
        <div class="preview-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-family:var(--botw-font-serif);color:#e4c465;">リンク 3D着せ替えプレビュー</strong>
            <span style="font-size:12px;color:#36e4ff;">総防御力 ${summary.totalDefense}</span>
          </div>
          <canvas id="link-preview-canvas" width="360" height="290"></canvas>
          <div class="stat-badges">
            <span class="stat-tag">セット効果: ${summary.activeSetBonus}</span>
            ${summary.isNaked ? '<span class="stat-tag" style="border-color:#ff7878;">裸状態</span>' : ''}
            ${summary.hasGerudoEntry ? '<span class="stat-tag" style="border-color:#44e664;">ゲルドの街 入城許可</span>' : ''}
            ${summary.triggersNpcFear ? '<span class="stat-tag" style="border-color:#c868ff;">NPC怯え反応</span>' : ''}
            ${summary.coldResist > 0 ? `<span class="stat-tag">耐寒 Lv${summary.coldResist}</span>` : ''}
            ${summary.heatResist > 0 ? `<span class="stat-tag">耐暑 Lv${summary.heatResist}</span>` : ''}
            ${summary.flameGuard > 0 ? `<span class="stat-tag">耐火 Lv${summary.flameGuard}</span>` : ''}
            ${summary.attackUpLevel > 0 ? `<span class="stat-tag">攻撃UP Lv${summary.attackUpLevel}</span>` : ''}
            ${summary.stealthLevel > 0 ? `<span class="stat-tag">静かさ Lv${summary.stealthLevel}</span>` : ''}
          </div>
        </div>
      </div>
    `;

    // Bind Inventory Interactions with iPad-safe bindTap
    this.elSlateBody.querySelectorAll('[data-inv-sub]').forEach((b) =>
      this.bindTap(b, () => {
        this.invSubTab = (b as HTMLElement).dataset.invSub as typeof this.invSubTab;
        this.renderInventoryTab();
      })
    );
    this.elSlateBody.querySelectorAll('[data-armor-id]').forEach((card) =>
      this.bindTap(card, () => {
        const id = (card as HTMLElement).dataset.armorId!;
        const piece = ARMOR_MAP[id];
        if (!piece || !this.save.ownedArmorIds.includes(id)) return;
        this.save.equippedArmor[piece.slot] = this.save.equippedArmor[piece.slot] === id ? null : id;
        this.renderInventoryTab();
      })
    );
    this.bindTap(this.elSlateBody.querySelector('#btn-strip-naked'), () => {
      this.save.equippedArmor = { head: null, body: null, legs: null };
      this.showToast('防具をすべて外した', 'amber');
      this.renderInventoryTab();
    });
    this.bindTap(this.elSlateBody.querySelector('#btn-equip-vai'), () => {
      this.save.equippedArmor = { head: 'gerudo_veil', body: 'gerudo_top', legs: 'gerudo_sirwal' };
      this.showToast('淑女シリーズ装備（ゲルドの街入城OK！）', 'cyan');
      this.renderInventoryTab();
    });
    this.bindTap(this.elSlateBody.querySelector('#btn-equip-champ'), () => {
      this.save.equippedArmor = { head: null, body: 'champions_tunic', legs: 'hylian_trousers' };
      this.renderInventoryTab();
    });
    this.elSlateBody.querySelectorAll('[data-wep-id]').forEach((el) =>
      this.bindTap(el, () => {
        this.save.equippedWeaponId = (el as HTMLElement).dataset.wepId!;
        this.renderInventoryTab();
      })
    );
    this.elSlateBody.querySelectorAll('[data-bow-id]').forEach((el) =>
      this.bindTap(el, () => {
        this.save.equippedBowId = (el as HTMLElement).dataset.bowId!;
        this.renderInventoryTab();
      })
    );
    this.elSlateBody.querySelectorAll('[data-arrow-sel]').forEach((el) =>
      this.bindTap(el, () => {
        this.save.equippedArrow = (el as HTMLElement).dataset.arrowSel as ArrowType;
        this.renderInventoryTab();
      })
    );
    this.elSlateBody.querySelectorAll('[data-shd-id]').forEach((el) =>
      this.bindTap(el, () => {
        this.save.equippedShieldId = (el as HTMLElement).dataset.shdId!;
        this.renderInventoryTab();
      })
    );
    this.elSlateBody.querySelectorAll('[data-eat-idx]').forEach((el) =>
      this.bindTap(el, () => {
        this.cb.onEatMeal(Number((el as HTMLElement).dataset.eatIdx!));
        this.renderInventoryTab();
      })
    );
    this.bindTap(this.elSlateBody.querySelector('#btn-refuel-bike'), () => {
      this.cb.onRefuelBike(['apple', 'apple', 'apple', 'apple', 'apple']);
      this.renderInventoryTab();
    });
    this.elSlateBody.querySelectorAll('[data-champ-toggle]').forEach((el) =>
      this.bindTap(el, () => {
        const k = (el as HTMLElement).dataset.champToggle as keyof SaveSlotData['champions'];
        this.save.champions[k].enabled = !this.save.champions[k].enabled;
        this.renderInventoryTab();
      })
    );

    this.render3DLinkPreview();
  }

  private render3DLinkPreview(): void {
    const canvas = document.getElementById('link-preview-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    if (!this.previewScene) {
      this.previewScene = new THREE.Scene();
      this.previewCamera = new THREE.PerspectiveCamera(34, canvas.width / canvas.height, 0.1, 20);
      this.previewCamera.position.set(0, 1.02, 2.75);
      this.previewCamera.lookAt(0, 0.85, 0);
      const sun = new THREE.DirectionalLight('#fff5dc', 1.9);
      sun.position.set(2, 3, 2);
      this.previewScene.add(sun, new THREE.HemisphereLight('#b8e2ff', '#4b6b4a', 1.1));
      this.previewLink = new LinkCharacterModel();
      this.previewScene.add(this.previewLink.root);
    }
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
    }
    try {
      this.previewRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.previewRenderer.setSize(canvas.width, canvas.height, false);
      this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.update3DPreviewFrame();
    } catch {
      // Graceful fallback if WebGL context limit reached
    }
  }

  private update3DPreviewFrame(): void {
    if (!this.previewRenderer || !this.previewScene || !this.previewCamera || !this.previewLink) return;
    const headPiece = this.save.equippedArmor.head ? ARMOR_MAP[this.save.equippedArmor.head] ?? null : null;
    const bodyPiece = this.save.equippedArmor.body ? ARMOR_MAP[this.save.equippedArmor.body] ?? null : null;
    const legsPiece = this.save.equippedArmor.legs ? ARMOR_MAP[this.save.equippedArmor.legs] ?? null : null;
    const activeWep = this.save.weapons.find((w) => w.id === this.save.equippedWeaponId);
    const activeShd = this.save.shields.find((s) => s.id === this.save.equippedShieldId);
    this.previewLink.applyEquipmentVisuals({
      headPiece,
      bodyPiece,
      legsPiece,
      headDyeHex: headPiece && this.save.armorDyes[headPiece.id] ? KOCHI_DYE_MAP[this.save.armorDyes[headPiece.id]]?.hex : null,
      bodyDyeHex: bodyPiece && this.save.armorDyes[bodyPiece.id] ? KOCHI_DYE_MAP[this.save.armorDyes[bodyPiece.id]]?.hex : null,
      legsDyeHex: legsPiece && this.save.armorDyes[legsPiece.id] ? KOCHI_DYE_MAP[this.save.armorDyes[legsPiece.id]]?.hex : null,
      weaponId: activeWep?.id ?? null,
      shieldId: activeShd?.id ?? null,
      weaponDrawn: activeWep?.id === 'torch',
      isMasterSword: this.save.equippedWeaponId === 'master_sword',
      weaponColor: activeWep?.color ?? '#d8e6f8',
      shieldColor: activeShd?.color ?? '#244d9c',
      bowDrawn: false,
      paragliderOpen: false,
      shieldSurfing: false,
      holdingTorchFire: activeWep?.id === 'torch',
      hasSheikahSlate: this.save.hasSheikahSlate,
    });
    this.previewLink.root.rotation.y = this.previewYaw;
    this.previewLink.updateAnimation(0.016, 'idle', 0);
    this.previewRenderer.render(this.previewScene, this.previewCamera);
  }

  // ==================== INTERACTIVE CONTOUR SHEIKAH MAP + HERO'S PATH ====================
  private renderMapTab(): void {
    const comp = computeCompletionBreakdown(this.save);
    const unlockedWarps: Array<{ name: string; x: number; z: number }> = [];
    if (this.save.storyFlags['sor_door_opened']) {
      unlockedWarps.push({ name: '回生の祠', x: -298, z: 455 });
    }
    for (const rId of this.save.activatedTowers) {
      const reg = REGIONS[rId];
      if (reg) {
        unlockedWarps.push({ name: `${reg.nameJa} シーカータワー`, x: reg.towerPos.x, z: reg.towerPos.z });
      }
    }
    const unlockedShrineIds = new Set([...this.save.discoveredShrines, ...this.save.completedShrines]);
    for (const sh of PHYSICAL_SHRINES) {
      if (unlockedShrineIds.has(sh.id)) {
        unlockedWarps.push({ name: sh.nameJa, x: sh.x, z: sh.z + 7.2 });
      }
    }

    this.elSlateBody.innerHTML = `
      <div class="map-layout">
        <div>
          <canvas id="sheikah-map-canvas" width="680" height="560"></canvas>
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;font-size:12px;">
            <button id="btn-map-zin" class="botw-btn small" type="button">＋ズーム</button>
            <button id="btn-map-zout" class="botw-btn small" type="button">－ズーム</button>
            <button id="btn-map-reset" class="botw-btn small" type="button">全体表示</button>
            <button id="btn-heropath-toggle" class="botw-btn small ${this.showHeroPath ? 'primary' : ''}" type="button">👣 足跡モード (${this.save.heroPath.length})</button>
            <input id="heropath-slider" type="range" min="0.05" max="1" step="0.05" value="${this.heroPathPlaybackFrac}" style="width:110px;" />
            <button id="btn-place-medallion" class="botw-btn small" type="button">📍 ワープマーカー設置</button>
            ${
              this.save.travelMedallionPos
                ? `<button id="btn-warp-medallion" class="botw-btn small primary" type="button">🌀 マーカーへワープ</button>`
                : ''
            }
          </div>
        </div>
        <div class="map-sidebar">
          <div class="list-card">
            <h4>ハイラル達成率：${comp.totalPercent.toFixed(2)}%</h4>
            <p>コログ: ${comp.koroks.count}/${comp.koroks.max} (72.0%) • 地名: ${comp.locations.count}/${comp.locations.max} (18.08%)<br>試練の祠: ${comp.shrines.count}/${comp.shrines.max} (9.60%) • 神獣: ${comp.divineBeasts.count}/${comp.divineBeasts.max} (0.32%)</p>
          </div>
          <div class="list-card">
            <h4>5色ピン配置（マップをクリック）</h4>
            <div style="display:flex;gap:6px;margin-top:6px;">
              ${['#36e4ff', '#ff5468', '#ffe44c', '#5ce668', '#d474ff']
                .map(
                  (hex) =>
                    `<button class="botw-btn small" data-pin-col="${hex}" style="background:${hex};color:#0d1420;font-weight:800;border:${this.selectedPinColor === hex ? '2px solid #fff' : 'none'};" type="button">●</button>`
                )
                .join('')}
            </div>
          </div>
          <div class="list-card">
            <h4>ファストトラベル（解放済の塔・試練の祠）</h4>
            <div style="display:flex;flex-direction:column;gap:5px;margin-top:6px;">
              ${
                unlockedWarps.length === 0
                  ? `<p style="font-size:12px;color:#9ab8ce;">回生の祠を出てシーカータワーや試練の祠を起動するとワープ先が登録されます。</p>`
                  : unlockedWarps
                      .map(
                        (w) =>
                          `<button class="botw-btn small" data-warp-x="${w.x}" data-warp-z="${w.z}" data-warp-name="${w.name}" type="button">🌀 ${w.name}</button>`
                      )
                      .join('')
              }
            </div>
          </div>
        </div>
      </div>
    `;

    this.drawSheikahMapCanvas();

    const canvas = document.getElementById('sheikah-map-canvas') as HTMLCanvasElement;
    canvas?.addEventListener('click', (ev) => {
      const rect = canvas.getBoundingClientRect();
      const nx = (ev.clientX - rect.left) / rect.width;
      const nz = (ev.clientY - rect.top) / rect.height;
      const wx = WORLD_BOUNDS.minX + nx * (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
      const wz = WORLD_BOUNDS.minZ + nz * (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
      this.save.mapPins.push({ id: `pin_${Date.now()}`, x: wx, z: wz, color: this.selectedPinColor, label: 'ピン' });
      this.drawSheikahMapCanvas();
      this.showToast(`シーカーピンを設置しました (${Math.round(wx)}, ${Math.round(wz)})`);
    });

    this.bindTap(this.elSlateBody.querySelector('#btn-map-zin'), () => {
      this.mapZoom = Math.min(3, this.mapZoom * 1.25);
      this.drawSheikahMapCanvas();
    });
    this.bindTap(this.elSlateBody.querySelector('#btn-map-zout'), () => {
      this.mapZoom = Math.max(1, this.mapZoom / 1.25);
      this.drawSheikahMapCanvas();
    });
    this.bindTap(this.elSlateBody.querySelector('#btn-map-reset'), () => {
      this.mapZoom = 1;
      this.mapPanX = 0;
      this.mapPanZ = 0;
      this.drawSheikahMapCanvas();
    });
    this.bindTap(this.elSlateBody.querySelector('#btn-heropath-toggle'), () => {
      this.showHeroPath = !this.showHeroPath;
      this.renderMapTab();
    });
    this.elSlateBody.querySelector('#heropath-slider')?.addEventListener('input', (ev) => {
      this.heroPathPlaybackFrac = Number((ev.target as HTMLInputElement).value);
      this.drawSheikahMapCanvas();
    });
    this.bindTap(this.elSlateBody.querySelector('#btn-place-medallion'), () => {
      this.save.travelMedallionPos = { ...this.save.playerPos };
      this.showToast('現在地へワープマーカーを設置しました！', 'cyan');
      this.renderMapTab();
    });
    this.bindTap(this.elSlateBody.querySelector('#btn-warp-medallion'), () => {
      if (!this.save.travelMedallionPos) return;
      this.closeSlate();
      this.cb.onFastTravel(this.save.travelMedallionPos.x, this.save.travelMedallionPos.z, 'ワープマーカー');
    });
    this.elSlateBody.querySelectorAll('[data-pin-col]').forEach((b) =>
      this.bindTap(b, () => {
        this.selectedPinColor = (b as HTMLElement).dataset.pinCol!;
        this.renderMapTab();
      })
    );
    this.elSlateBody.querySelectorAll('[data-warp-x]').forEach((b) =>
      this.bindTap(b, () => {
        const el = b as HTMLElement;
        this.closeSlate();
        this.cb.onFastTravel(Number(el.dataset.warpX), Number(el.dataset.warpZ), el.dataset.warpName!);
      })
    );
  }

  private drawSheikahMapCanvas(): void {
    const canvas = document.getElementById('sheikah-map-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#091522';
    ctx.fillRect(0, 0, W, H);

    const toX = (wx: number) =>
      ((wx - this.mapPanX - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) - 0.5) * W * this.mapZoom + W * 0.5;
    const toY = (wz: number) =>
      ((wz - this.mapPanZ - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) - 0.5) * H * this.mapZoom + H * 0.5;

    // Stylized Sheikah Contour Rings for all 15 Regions
    for (const reg of REGION_LIST) {
      const rx = toX(reg.center.x);
      const ry = toY(reg.center.z);
      const rad = (reg.radius / 3200) * W * this.mapZoom;
      const unlocked = this.save.activatedTowers.includes(reg.id);
      ctx.strokeStyle = unlocked ? 'rgba(54, 228, 255, 0.35)' : 'rgba(218, 174, 96, 0.20)';
      ctx.lineWidth = 1.2;
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.arc(rx, ry, rad * (ring / 3), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = unlocked ? '#b8ecff' : '#b2a68a';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(reg.nameJa, rx, ry - 4);
    }

    // 15 Sheikah Towers (Cyan when activated, Orange when unactivated!)
    for (const reg of REGION_LIST) {
      const tx = toX(reg.towerPos.x);
      const ty = toY(reg.towerPos.z);
      const act = this.save.activatedTowers.includes(reg.id);
      ctx.fillStyle = act ? '#36e4ff' : '#ff8c24';
      ctx.beginPath();
      ctx.moveTo(tx, ty - 7);
      ctx.lineTo(tx + 5, ty + 5);
      ctx.lineTo(tx - 5, ty + 5);
      ctx.closePath();
      ctx.fill();
    }

    // Physical Shrines (Diamonds)
    for (const sh of PHYSICAL_SHRINES) {
      if (sh.category === 'dlc2' && this.save.defeatedDivineBeasts.length < 4) continue;
      const sx = toX(sh.x);
      const sy = toY(sh.z);
      const done = this.save.completedShrines.includes(sh.id);
      ctx.fillStyle = done ? '#36e4ff' : '#ff9824';
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }

    // Major Landmarks (Castle, Settlements, Divine Beasts)
    for (const lm of LANDMARKS) {
      if (lm.type !== 'castle' && lm.type !== 'divine_beast' && lm.type !== 'settlement') continue;
      const lx = toX(lm.x);
      const ly = toY(lm.z);
      ctx.fillStyle = lm.type === 'castle' ? '#ff385c' : lm.type === 'divine_beast' ? '#ff9642' : '#e4c465';
      ctx.beginPath();
      ctx.arc(lx, ly, lm.type === 'castle' ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hero's Path Mode (DLC 1 Green glowing trail + Death X markers!)
    if (this.showHeroPath && this.save.heroPath.length > 1) {
      const count = Math.max(2, Math.floor(this.save.heroPath.length * this.heroPathPlaybackFrac));
      ctx.strokeStyle = '#52ff78';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const pt = this.save.heroPath[i];
        const px = toX(pt.x);
        const py = toY(pt.z);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // 5-Color User Pins & Travel Medallion
    for (const pin of this.save.mapPins) {
      ctx.fillStyle = pin.color;
      ctx.beginPath();
      ctx.arc(toX(pin.x), toY(pin.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.save.travelMedallionPos) {
      ctx.strokeStyle = '#36e4ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(toX(this.save.travelMedallionPos.x), toY(this.save.travelMedallionPos.z), 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Link Current Arrow Marker
    const px = toX(this.save.playerPos.x);
    const py = toY(this.save.playerPos.z);
    ctx.fillStyle = '#fff5a8';
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#182436';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ==================== ADVENTURE LOG (ALL 23 MEMORIES, 147 QUESTS, 3-LAYER HISTORY, JOURNALS, DLC) ====================
  private renderAdventureTab(): void {
    const tabs: Array<[typeof this.advSubTab, string]> = [
      ['memories', `📷 ウツシエの記憶 (${this.save.unlockedMemories.length}/23)`],
      ['main', '⚔ メインチャレンジ (15)'],
      ['shrine', '🔷 ほこらチャレンジ (42)'],
      ['side', '🌿 ミニチャレンジ (90)'],
      ['chronicle', '⏳ 三層歴史年表'],
      ['docs', '📖 手記・石碑 (8冊)'],
      ['dlc', '👑 DLC1 剣の試練 / DLC2 英傑たちの詩'],
    ];

    let content = '';
    if (this.advSubTab === 'memories') {
      const baseUnlocked = ALL_MEMORIES.filter((m) => !m.isDlc && this.save.unlockedMemories.includes(m.id)).length;
      content = `
        <div class="list-card" style="border-color:#e4c465;">
          <h4>真エンディング進捗：本編記憶 ${baseUnlocked} / 18 ${baseUnlocked >= 18 ? '— ✨ 真エンディング解放済！' : ''}</h4>
          <p>各地で光の思い出に触れると記憶が解放され、「▶ 記憶を再生」でいつでも振り返れます。</p>
          ${baseUnlocked >= 18 ? `<button id="btn-play-true-end" class="botw-btn small primary" style="margin-top:6px;" type="button">✨ 真エンディング・エピローグを再生</button>` : ''}
        </div>
        ${ALL_MEMORIES.map((m) => {
          const got = this.save.unlockedMemories.includes(m.id);
          return `<div class="list-card">
            <h4>${m.code} ${got ? m.titleJa : '？？？'} <span style="font-size:11px;color:#36e4ff;">(${got ? m.titleEn : 'Uncollected'})</span> ${got ? '✅ 回収済' : '🔒 未回収'}</h4>
            <p>${got ? `${m.locationJa} — ${m.summaryJa}` : `手がかり：${m.locationJa}付近に現れる黄金の光を調べよう`}</p>
            ${
              got
                ? `<div style="margin-top:6px;display:flex;gap:6px;">
                    <button class="botw-btn small primary" data-mem-play="${m.id}" type="button">▶ 記憶を再生</button>
                  </div>`
                : ''
            }
          </div>`;
        }).join('')}`;
    } else if (this.advSubTab === 'main' || this.advSubTab === 'shrine' || this.advSubTab === 'side') {
      const list = ALL_QUESTS.filter((q) => q.category === this.advSubTab);
      content = list
        .map(
          (q, idx) => `<div class="list-card">
            <h4>#${idx + 1} ${q.titleJa} <span style="font-size:11px;color:#36e4ff;">[${q.dlcTag.toUpperCase()} / ${REGIONS[q.region].nameJa}]</span></h4>
            <p>依頼者: ${q.giverJa} • 目標: ${q.objectiveJa} • 報酬: ${q.rewardJa}</p>
          </div>`
        )
        .join('');
    } else if (this.advSubTab === 'chronicle') {
      content = HYRULE_HISTORY_CHRONICLE.map(
        (era) => `<div class="list-card">
          <h4>第${era.layerIndex}層：${era.periodJa} — ${era.titleJa}</h4>
          <p style="margin-bottom:8px;">${era.overviewJa}</p>
          ${era.beats.map((b) => `<p style="margin:4px 0;padding-left:10px;border-left:2px solid #36e4ff;"><strong>${b.titleJa}</strong>：${b.summaryJa}</p>`).join('')}
        </div>`
      ).join('');
    } else if (this.advSubTab === 'docs') {
      content = READABLE_DOCUMENTS.map(
        (doc) => `<div class="list-card">
          <h4>📖 ${doc.titleJa}（著：${doc.authorJa}）</h4>
          <p>${doc.pages[0].slice(0, 120)}…</p>
          <button class="botw-btn small primary" data-doc-read="${doc.id}" style="margin-top:6px;" type="button">全${doc.pages.length}ページを読む</button>
        </div>`
      ).join('');
    } else {
      content = `
        <div class="list-card">
          <h4>DLC第1弾『試練の覇者』剣の試練（全${TRIAL_OF_THE_SWORD_STAGES.length}層：序位12 / 中位16 / 極位23）</h4>
          <p>コログの森（中央北西）の台座へマスターソードを手に入れて戻ると試練が開放されます。現在状態: ${this.save.masterSwordAwakened ? '✨ 覚醒済 (攻撃力60 / 耐久188)' : '未覚醒'}</p>
        </div>
        <div class="list-card">
          <h4>DLC第2弾『英傑たちの詩』— 一撃の剣 ＆ 4英傑16祠 ＆ 導師ミィズ・キョシア</h4>
          <p>${CHAMPIONS_BALLAD_TRIALS.finalTrial.titleJa}（現在 神獣解放: ${this.save.defeatedDivineBeasts.length}/4）— 4体の神獣をすべて解放すると、始まりの台地に4つの新たなEX試練の祠と導師の試練が出現します。</p>
        </div>`;
    }

    this.elSlateBody.innerHTML = `
      <div class="inv-subtabs">
        ${tabs.map(([k, l]) => `<button class="botw-btn small ${this.advSubTab === k ? 'primary' : ''}" data-adv-sub="${k}" type="button">${l}</button>`).join('')}
      </div>
      ${content}
    `;

    this.elSlateBody.querySelectorAll('[data-adv-sub]').forEach((b) =>
      this.bindTap(b, () => {
        this.advSubTab = (b as HTMLElement).dataset.advSub as typeof this.advSubTab;
        this.renderAdventureTab();
      })
    );
    this.elSlateBody.querySelectorAll('[data-mem-play]').forEach((b) =>
      this.bindTap(b, () => {
        const mem = ALL_MEMORIES.find((m) => m.id === (b as HTMLElement).dataset.memPlay);
        if (mem && this.save.unlockedMemories.includes(mem.id)) {
          this.openMemoryModal(mem);
        }
      })
    );
    this.elSlateBody.querySelectorAll('[data-doc-read]').forEach((b) =>
      this.bindTap(b, () => {
        const id = (b as HTMLElement).dataset.docRead!;
        this.closeSlate();
        this.openDocumentModal(id);
      })
    );
    this.bindTap(this.elSlateBody.querySelector('#btn-play-true-end'), () => {
      this.closeSlate();
      this.openSubModalHtml(
        `✨ ${TRUE_ENDING_EPILOGUE.titleJa}`,
        `<p style="line-height:1.85;margin-bottom:12px;">${TRUE_ENDING_EPILOGUE.epilogueNarrationJa}</p>
        ${TRUE_ENDING_EPILOGUE.dialogueLines.map((l) => `<p><strong>${l.speaker}：</strong>${l.text}</p>`).join('')}`
      );
    });
  }

  private renderCompendiumTab(): void {
    this.elSlateBody.innerHTML = `
      <div class="list-card">
        <h4>ハイラル図鑑 ＆ シーカーセンサー＋</h4>
        <p>登録済: ${this.save.compendiumDiscovered.length} / ${COMPENDIUM_CATALOG.length} • 現在のセンサー対象: <strong>${this.save.sensorTargetId ?? '試練の祠'}</strong></p>
      </div>
      <div class="inv-grid">
        ${COMPENDIUM_CATALOG.map((c) => {
          const got = this.save.compendiumDiscovered.includes(c.id);
          return `<div class="inv-item ${this.save.sensorTargetId === c.id ? 'equipped' : ''}" data-comp-id="${c.id}">
            <div class="inv-item-title">${got ? '📷 ' : '❓ '}${c.nameJa}</div>
            <div class="inv-item-meta">${c.category} • ${c.regionHint}</div>
            <div class="inv-item-meta">${c.description.slice(0, 48)}…</div>
          </div>`;
        }).join('')}
      </div>
    `;
    this.elSlateBody.querySelectorAll('[data-comp-id]').forEach((el) =>
      this.bindTap(el, () => {
        const id = (el as HTMLElement).dataset.compId!;
        this.save.sensorTargetId = id;
        this.showToast(`シーカーセンサー＋の探知対象を「${COMPENDIUM_CATALOG.find((x) => x.id === id)?.nameJa}」に設定！`, 'cyan');
        this.renderCompendiumTab();
      })
    );
  }

  private async renderSystemTab(): Promise<void> {
    const summaries = await saveManager.listSlots();
    const touchMode = this.save.settings.touchControlsMode ?? 'auto';
    const quality = this.save.settings.graphicsQuality ?? 'high';
    const touchLabels: Record<'auto' | 'always' | 'hidden', string> = {
      auto: '自動（タッチ端末で表示）',
      always: '常時表示',
      hidden: '非表示',
    };
    const qualityLabels: Record<'high' | 'medium' | 'low', string> = {
      high: '高（Bloom有効・最高品質）',
      medium: '中（iPad推奨・軽量描画）',
      low: '低（省電力・高FPS優先）',
    };

    this.elSlateBody.innerHTML = `
      <div class="list-card">
        <h4>操作・グラフィック設定（iPad / PC対応）</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <button id="sys-touch-toggle" class="botw-btn small primary" type="button">📱 タッチ操作UI: ${touchLabels[touchMode]}</button>
          <button id="sys-quality-toggle" class="botw-btn small primary" type="button">🎨 画質プリセット: ${qualityLabels[quality]}</button>
          <button id="sys-cam-toggle" class="botw-btn small" type="button">カメラ視点: ${this.save.settings.cameraMode.toUpperCase()}</button>
          <button id="sys-minimap-toggle" class="botw-btn small" type="button">ミニマップ: ${this.save.settings.northFixedMinimap ? '北固定' : '回転追従'}</button>
        </div>
      </div>
      <div class="list-card">
        <h4>モード・物理テクニック設定</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <button id="sys-mode-toggle" class="botw-btn small ${this.save.mode === 'master' ? 'master' : 'primary'}" type="button">モード切替（現在: ${this.save.mode === 'master' ? 'マスターモード' : '通常モード'}）</button>
          <button id="sys-glitch-toggle" class="botw-btn small ${this.save.settings.glitchPhysics ? 'primary' : ''}" type="button">高度物理技 (ウインドボム/BTB/口笛): ${this.save.settings.glitchPhysics ? 'ON' : 'OFF'}</button>
        </div>
      </div>
      <div class="list-card">
        <h4>手動セーブ（LocalStorage ＋ IndexedDB 二重永続化）</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <button class="botw-btn small primary" data-save-idx="1" type="button">💾 スロット1へ保存</button>
          <button class="botw-btn small primary" data-save-idx="2" type="button">💾 スロット2へ保存</button>
          <button class="botw-btn small primary" data-save-idx="3" type="button">💾 スロット3へ保存</button>
        </div>
      </div>
      <div class="list-card">
        <h4>セーブデータ一覧（ロード）</h4>
        ${ALL_SAVE_SLOTS.map((slotId) => {
          const sum = summaries.find((s) => s.slotId === slotId);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:12px;">
            <span>${slotId} ${sum?.exists ? `(${sum.mode} • ♥${sum.hearts}/${sum.maxHearts} • ${sum.completionPercent.toFixed(1)}%)` : '(空)'}</span>
            ${sum?.exists ? `<button class="botw-btn small" data-load-slot="${slotId}" type="button">読込</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <div class="list-card">
        <h4>クレジット</h4>
        <p style="font-size:13px;color:#e4c465;">製作者:駿 (Created by Shun) — Breath of the Wild Web3D Engine</p>
      </div>
    `;

    this.bindTap(this.elSlateBody.querySelector('#sys-touch-toggle'), () => {
      const order: Array<'auto' | 'always' | 'hidden'> = ['auto', 'always', 'hidden'];
      const cur = this.save.settings.touchControlsMode ?? 'auto';
      this.save.settings.touchControlsMode = order[(order.indexOf(cur) + 1) % order.length];
      this.cb.onSettingsChanged?.();
      this.renderSystemTab();
    });
    this.bindTap(this.elSlateBody.querySelector('#sys-quality-toggle'), () => {
      const order: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
      const cur = this.save.settings.graphicsQuality ?? 'high';
      this.save.settings.graphicsQuality = order[(order.indexOf(cur) + 1) % order.length];
      this.cb.onSettingsChanged?.();
      this.renderSystemTab();
    });
    this.bindTap(this.elSlateBody.querySelector('#sys-mode-toggle'), () => {
      this.cb.onSwitchMode(this.save.mode === 'normal' ? 'master' : 'normal');
      this.renderSystemTab();
    });
    this.bindTap(this.elSlateBody.querySelector('#sys-glitch-toggle'), () => {
      this.save.settings.glitchPhysics = !this.save.settings.glitchPhysics;
      this.renderSystemTab();
    });
    this.bindTap(this.elSlateBody.querySelector('#sys-cam-toggle'), () => {
      const order: Array<'tps' | 'close' | 'fps'> = ['tps', 'close', 'fps'];
      this.save.settings.cameraMode = order[(order.indexOf(this.save.settings.cameraMode) + 1) % order.length];
      this.renderSystemTab();
    });
    this.bindTap(this.elSlateBody.querySelector('#sys-minimap-toggle'), () => {
      this.save.settings.northFixedMinimap = !this.save.settings.northFixedMinimap;
      this.renderSystemTab();
    });
    this.elSlateBody.querySelectorAll('[data-save-idx]').forEach((b) =>
      this.bindTap(b, () => {
        const idx = Number((b as HTMLElement).dataset.saveIdx) as 1 | 2 | 3;
        this.cb.onSaveManual(idx);
        this.showToast(`スロット ${getManualSlotId(this.save.mode, idx)} にセーブしました！`);
        this.renderSystemTab();
      })
    );
    this.elSlateBody.querySelectorAll('[data-load-slot]').forEach((b) =>
      this.bindTap(b, () => {
        this.cb.onLoadSlot((b as HTMLElement).dataset.loadSlot!);
        this.closeSlate();
      })
    );
  }

  // ==================== INTERACTIVE MODALS (COOKING, CAMPFIRE WAIT, GODDESS STATUE, DYE SHOP, GREAT FAIRY, MEMORIES, JOURNALS) ====================
  public openCookingModal(isBloodMoonWindow: boolean): void {
    const selected: string[] = [];
    const render = () => {
      const avail = MATERIALS.filter((m) => (this.save.materials[m.id] ?? 0) > 0);
      this.openSubModalHtml(
        `🍲 料理鍋（最大5素材）${isBloodMoonWindow ? ' — 🌕 赤い月100%大成功ボーナス中！' : ''}`,
        `
          <p style="font-size:12px;color:#b8d4e8;margin-bottom:10px;">投入中 (${selected.length}/5): ${selected.map((id) => MATERIAL_MAP[id]?.nameJa).join(' ＋ ') || 'なし'}</p>
          <div class="inv-grid" style="max-height:280px;">
            ${avail
              .map(
                (m) =>
                  `<div class="inv-item" data-cook-add="${m.id}">
                    <div class="inv-item-title">${m.nameJa} ×${this.save.materials[m.id]}</div>
                    <div class="inv-item-meta">${m.effectType ?? 'none'} (強度${m.potency}) • ♥${m.hearts}</div>
                  </div>`
              )
              .join('')}
          </div>
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <button id="btn-do-cook" class="botw-btn primary" ${selected.length === 0 ? 'disabled' : ''} type="button">🔥 調理する！</button>
            <button id="btn-cook-clear" class="botw-btn small" type="button">リセット</button>
          </div>
          <div class="list-card" style="margin-top:14px;">
            <h4>🔥 焚き火で暇をつぶす（時間を進める）</h4>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
              <button class="botw-btn small" data-wait-hour="5" type="button">🌅 朝まで (05:00)</button>
              <button class="botw-btn small" data-wait-hour="12" type="button">☀️ 昼まで (12:00)</button>
              <button class="botw-btn small" data-wait-hour="21" type="button">🌙 夜まで (21:00)</button>
            </div>
          </div>
        `
      );
      this.elSubModal.querySelectorAll('[data-cook-add]').forEach((el) =>
        this.bindTap(el, () => {
          if (selected.length >= 5) return;
          const id = (el as HTMLElement).dataset.cookAdd!;
          if ((this.save.materials[id] ?? 0) > selected.filter((x) => x === id).length) {
            selected.push(id);
            render();
          }
        })
      );
      this.bindTap(this.elSubModal.querySelector('#btn-cook-clear'), () => {
        selected.length = 0;
        render();
      });
      this.elSubModal.querySelectorAll('[data-wait-hour]').forEach((el) =>
        this.bindTap(el, () => {
          const hour = Number((el as HTMLElement).dataset.waitHour!);
          this.closeSubModal();
          this.cb.onWaitAtFire(hour);
        })
      );
      this.bindTap(this.elSubModal.querySelector('#btn-do-cook'), () => {
        if (selected.length === 0) return;
        for (const id of selected) {
          this.save.materials[id] = Math.max(0, (this.save.materials[id] ?? 0) - 1);
        }
        const meal = cookIngredients(selected, { isBloodMoonWindow });
        this.save.meals.unshift(meal);
        this.closeSubModal();
        this.cb.onCookDone(meal.nameJa, meal.isCritical);
      });
    };
    render();
  }

  public openCampfireModal(): void {
    this.openSubModalHtml(
      '🔥 焚き火 — 暇をつぶす',
      `
        <p style="font-size:13px;color:#d6e6f4;margin-bottom:12px;">焚き火にあたって時間を進めますか？</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="botw-btn primary" data-wait-hour="5" type="button">🌅 朝まで暇をつぶす (05:00)</button>
          <button class="botw-btn primary" data-wait-hour="12" type="button">☀️ 昼まで暇をつぶす (12:00)</button>
          <button class="botw-btn primary" data-wait-hour="21" type="button">🌙 夜まで暇をつぶす (21:00)</button>
        </div>
      `
    );
    this.elSubModal.querySelectorAll('[data-wait-hour]').forEach((el) =>
      this.bindTap(el, () => {
        const hour = Number((el as HTMLElement).dataset.waitHour!);
        this.closeSubModal();
        this.cb.onWaitAtFire(hour);
      })
    );
  }

  public openGoddessStatueModal(): void {
    this.openSubModalHtml(
      '🕊️ 女神像 — 克服の証と器の交換',
      `
        <div class="list-card">
          <h4>「多くの試練を乗り越えし者よ……」</h4>
          <p>所持している<strong>克服の証：${this.save.spiritOrbs} 個</strong>（4個につき1つ器を授けます）</p>
          <p style="margin-top:4px;color:#b8d4e8;">現在の最大ハート：${this.save.maxHearts} / 30 • 最大がんばり：${this.save.maxStamina} / 300</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
          <button id="btn-orb-heart" class="botw-btn primary" ${this.save.spiritOrbs < 4 || this.save.maxHearts >= 30 ? 'disabled' : ''} type="button">❤️ ハートの器をもらう (証4個)</button>
          <button id="btn-orb-stamina" class="botw-btn primary" ${this.save.spiritOrbs < 4 || this.save.maxStamina >= 300 ? 'disabled' : ''} type="button">💚 がんばりの器をもらう (証4個)</button>
        </div>
      `
    );
    this.bindTap(this.elSubModal.querySelector('#btn-orb-heart'), () => {
      const res = exchangeSpiritOrbs(this.save, 'heart');
      this.showToast(res.messageJa, res.ok ? 'amber' : 'red');
      if (res.ok) this.openGoddessStatueModal();
    });
    this.bindTap(this.elSubModal.querySelector('#btn-orb-stamina'), () => {
      const res = exchangeSpiritOrbs(this.save, 'stamina');
      this.showToast(res.messageJa, res.ok ? 'cyan' : 'red');
      if (res.ok) this.openGoddessStatueModal();
    });
  }

  public openDyeShopModal(): void {
    const equippedIds = [this.save.equippedArmor.head, this.save.equippedArmor.body, this.save.equippedArmor.legs].filter(Boolean) as string[];
    this.openSubModalHtml(
      '🎨 ハテノ村 染色屋「東風屋」— 全15色染色',
      `
        <p style="font-size:13px;margin-bottom:10px;">現在装備中の染色可能防具を一括で染色します（費用 20ルピー • 所持 ${this.save.rupees}ルピー）</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${KOCHI_DYE_COLORS.map(
            (d) =>
              `<button class="botw-btn small" data-dye-pick="${d.id}" style="border-left:10px solid ${d.hex};" type="button">${d.nameJa}</button>`
          ).join('')}
        </div>
      `
    );
    this.elSubModal.querySelectorAll('[data-dye-pick]').forEach((b) =>
      this.bindTap(b, () => {
        const dyeId = (b as HTMLElement).dataset.dyePick!;
        const targets = equippedIds.map((id) => ({ id, dyeable: !!ARMOR_MAP[id]?.dyeable }));
        const res = purchaseArmorDye(this.save, dyeId, targets, 20);
        if (!res.ok) {
          this.showToast(res.messageJa, 'red');
          return;
        }
        this.showToast(`防具を「${KOCHI_DYE_MAP[dyeId]?.nameJa}」に染色しました！（-20ルピー）`, 'cyan');
        this.closeSubModal();
      })
    );
  }

  public openGreatFairyModal(): void {
    const equippedIds = [this.save.equippedArmor.head, this.save.equippedArmor.body, this.save.equippedArmor.legs].filter(Boolean) as string[];
    this.openSubModalHtml(
      '✨ 大妖精の泉 — 防具4段階強化 (★1〜★4)',
      `
        <p style="font-size:12px;color:#b8d4e8;margin-bottom:10px;">全3部位を★2以上に強化するとセットボーナスが発動します！（所持 ${this.save.rupees}ルピー）</p>
        ${equippedIds
          .map((id) => {
            const p = ARMOR_MAP[id];
            if (!p) return '';
            const cur = this.save.armorStars[id] ?? 0;
            const next = Math.min(4, cur + 1) as 1 | 2 | 3 | 4;
            const cost = GREAT_FAIRY_UPGRADE_COSTS[next];
            return `<div class="list-card">
              <h4>${p.nameJa} (${p.upgradeable ? '★'.repeat(cur) || '未強化' : '強化不可'}) — 現在DEF ${getPieceDefense(id, cur)}</h4>
              ${
                p.upgradeable && cur < 4
                  ? `<button class="botw-btn small primary" data-upg-id="${id}" type="button">★${next}へ強化 (DEF ${getPieceDefense(id, next)} / ${cost.rupees}ルピー)</button>`
                  : `<p style="color:#44e664;">最大強化済または強化不可</p>`
              }
            </div>`;
          })
          .join('')}
      `
    );
    this.elSubModal.querySelectorAll('[data-upg-id]').forEach((b) =>
      this.bindTap(b, () => {
        const id = (b as HTMLElement).dataset.upgId!;
        const piece = ARMOR_MAP[id];
        if (!piece?.upgradeable) return;
        const cur = this.save.armorStars[id] ?? 0;
        const next = Math.min(4, cur + 1) as 1 | 2 | 3 | 4;
        const costRupees = GREAT_FAIRY_UPGRADE_COSTS[next].rupees;
        const res = purchaseGreatFairyUpgrade(this.save, id, piece.upgradeable, costRupees);
        if (!res.ok) {
          this.showToast(res.messageJa, 'red');
          return;
        }
        this.showToast(`${piece.nameJa} を ★${res.newStar} へ強化した！（-${costRupees}ルピー）`, 'amber');
        this.openGreatFairyModal();
      })
    );
  }

  public openMemoryModal(mem: MemoryDef): void {
    if (!this.save.unlockedMemories.includes(mem.id)) {
      this.save.unlockedMemories.push(mem.id);
    }
    this.openSubModalHtml(
      `📷 ウツシエの記憶 ${mem.code}：${mem.titleJa} (${mem.titleEn})`,
      `
        <p style="color:#e4c465;font-size:13px;margin-bottom:10px;">場所：${mem.locationJa} — ${mem.summaryJa}</p>
        ${mem.dialogueLines.map((l) => `<div class="list-card"><h4>${l.speaker}</h4><p>${l.text}</p></div>`).join('')}
      `
    );
  }

  public openDocumentModal(docId: string): void {
    const doc = READABLE_DOCUMENTS.find((d) => d.id === docId) ?? READABLE_DOCUMENTS[0];
    this.openSubModalHtml(
      `📖 ${doc.titleJa}（著：${doc.authorJa}）`,
      doc.pages.map((pg, i) => `<div class="list-card"><h4>第 ${i + 1} 頁</h4><p style="white-space:pre-line;">${pg}</p></div>`).join('')
    );
  }

  private openSubModalHtml(title: string, innerHtml: string): void {
    this.isSubModalOpen = true;
    this.cb.onTogglePause(true);
    this.elSubModal.classList.remove('hidden');
    this.elSubModal.innerHTML = `
      <div class="slate-shell" style="max-width:780px;height:auto;max-height:84vh;">
        <div class="slate-tabs">
          <strong style="font-family:var(--botw-font-serif);color:#e4c465;font-size:16px;">${title}</strong>
          <div class="slate-spacer"></div>
          <button id="btn-sub-close" class="botw-btn small" type="button">✕ 閉じる</button>
        </div>
        <div class="slate-body">${innerHtml}</div>
      </div>
    `;
    this.bindTap(this.elSubModal.querySelector('#btn-sub-close'), () => this.closeSubModal());
  }

  public closeSubModal(): void {
    this.isSubModalOpen = false;
    this.elSubModal.classList.add('hidden');
    if (!this.isSlateOpen && !this.isDialogueOpen) {
      this.cb.onTogglePause(false);
    }
  }

  // ==================== FRAME-BY-FRAME LIVE HUD UPDATE ====================
  public updateHud(dt: number, ctx: HudUpdateContext): void {
    this.save = ctx.save;
    const isTouch = this.isTouchUi();

    const slateTxt = isTouch ? '📱 ポーチ' : '📱 ポーチ (Tab)';
    if (this.elBtnHudSlate.textContent !== slateTxt) this.elBtnHudSlate.textContent = slateTxt;
    const mapTxt = isTouch ? '🗺️ マップ' : '🗺️ マップ (M)';
    if (this.elBtnHudMap.textContent !== mapTxt) this.elBtnHudMap.textContent = mapTxt;
    const proTxt = isTouch ? '👁️ プロHUD' : '👁️ プロHUD (H)';
    if (this.elBtnHudPro.textContent !== proTxt) this.elBtnHudPro.textContent = proTxt;

    if (this.isSlateOpen && this.currentTab === 'inventory') {
      this.previewYaw += dt * 0.65;
      this.update3DPreviewFrame();
    }

    // Region arrival banner detection
    const reg = REGION_LIST.reduce((best, r) => {
      const d = Math.hypot(ctx.playerPos.x - r.center.x, ctx.playerPos.z - r.center.z) / r.radius;
      const bd = Math.hypot(ctx.playerPos.x - best.center.x, ctx.playerPos.z - best.center.z) / best.radius;
      return d < bd ? r : best;
    }, REGIONS.great_plateau);
    if (this.lastRegionId !== reg.id) {
      this.lastRegionId = reg.id;
      this.showRegionBanner(reg.nameJa, reg.nameEn.toUpperCase());
    }

    if (this.regionBannerTimer > 0) {
      this.regionBannerTimer -= dt;
      if (this.regionBannerTimer <= 0) this.elRegionBanner.classList.remove('visible');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.elToast.classList.remove('visible');
    }

    // 1. Top-Left Hearts (Quarter-Heart SVG precision + yellow temp hearts!)
    const heartsSig = `${ctx.save.hearts}:${ctx.save.maxHearts}:${ctx.save.tempHearts}`;
    if (this.elHearts.dataset.sig !== heartsSig) {
      this.elHearts.dataset.sig = heartsSig;
      this.renderHearts(ctx.save.hearts, ctx.save.maxHearts, ctx.save.tempHearts);
    }

    // 2. Champions' Abilities badges (shown only once unlocked!)
    const ch = ctx.save.champions;
    const unlockedChamps = (
      [
        ['💧 ミファー', ch.mipha],
        ['🛡 ダルケル', ch.daruk],
        [isTouch ? '🌪 リーバル' : '🌪 リーバル(G)', ch.revali],
        ['⚡ ウルボザ', ch.urbosa],
      ] as Array<[string, SaveSlotData['champions']['mipha']]>
    ).filter(([, st]) => st.unlocked);
    const champSig = unlockedChamps.map(([lbl, s]) => `${lbl}:${s.enabled}:${s.charges}`).join('|');
    if (this.elChamps.dataset.sig !== champSig) {
      this.elChamps.dataset.sig = champSig;
      this.elChamps.innerHTML = unlockedChamps
        .map(
          ([lbl, s]) =>
            `<span class="champ-badge ${!s.enabled || s.charges === 0 ? 'off' : ''}">${lbl} ×${s.charges}</span>`
        )
        .join('');
    }

    const rupeeHtml = `💎 ${ctx.save.rupees} ルピー &nbsp;|&nbsp; 🌿 ${ctx.save.korokSeeds} &nbsp;|&nbsp; ✦ 証 ${ctx.save.spiritOrbs} ${ctx.korokMaskRattle ? '<span style="color:#66ff7a;">🍃コログ反応！</span>' : ''}`;
    if (this.elRupees.dataset.sig !== rupeeHtml) {
      this.elRupees.dataset.sig = rupeeHtml;
      this.elRupees.innerHTML = rupeeHtml;
    }
    this.elMasterBadge.classList.toggle('hidden', ctx.save.mode !== 'master');

    // 3. Boss HP Bar
    if (ctx.activeBoss) {
      this.elBossWrap.classList.remove('hidden');
      this.elBossName.innerHTML = `<span>${ctx.activeBoss.nameJa}</span><span>${Math.ceil(ctx.activeBoss.hp)} / ${ctx.activeBoss.maxHp}</span>`;
      this.elBossFill.style.width = `${Math.max(0, (ctx.activeBoss.hp / ctx.activeBoss.maxHp) * 100)}%`;
    } else {
      this.elBossWrap.classList.add('hidden');
    }

    // 4. Circular Green Stamina Wheel next to Link (fades in only while draining/recharging!)
    const showStamina = ctx.stamina < ctx.maxStamina - 0.5 || ctx.tempStamina > 0 || ctx.exhausted;
    this.elStaminaWrap.classList.toggle('visible', showStamina && ctx.screenStaminaPos.visible);
    if (showStamina) {
      this.elStaminaWrap.style.left = `${ctx.screenStaminaPos.x + 54}px`;
      this.elStaminaWrap.style.top = `${ctx.screenStaminaPos.y - 38}px`;
      this.renderStaminaWheel(ctx.stamina, ctx.maxStamina, ctx.tempStamina, ctx.exhausted);
    }

    // 5. Active Runes Strip (hidden until plateau runes unlocked; re-renders only on state change so taps never drop!)
    if (ctx.save.unlockedRunes.length === 0) {
      this.elRuneRow.classList.add('hidden');
      if (this.elRuneRow.dataset.sig !== 'empty') {
        this.elRuneRow.dataset.sig = 'empty';
        this.elRuneRow.innerHTML = '';
      }
    } else {
      this.elRuneRow.classList.remove('hidden');
      const runeSig = `${ctx.save.unlockedRunes.join(',')}:${ctx.activeRune ?? 'none'}:${isTouch}`;
      if (this.elRuneRow.dataset.sig !== runeSig) {
        this.elRuneRow.dataset.sig = runeSig;
        this.elRuneRow.innerHTML = ctx.save.unlockedRunes
          .map((r, i) => {
            const info = RUNE_LABELS[r];
            return `<button class="rune-slot ${ctx.activeRune === r ? 'active' : ''}" data-rune-pick="${r}" type="button">
              <span>${info.icon}</span><span>${isTouch ? info.name : `${i + 1}:${info.name}`}</span>
            </button>`;
          })
          .join('');
        this.elRuneRow.querySelectorAll('[data-rune-pick]').forEach((b) =>
          this.bindTap(b, () => this.cb.onSelectRune((b as HTMLElement).dataset.runePick as RuneId))
        );
      }
    }

    // 6. Interact Prompt (PC vs Touch dynamic text, cached by signature so element isn't replaced mid-tap)
    if (ctx.interactLabel) {
      this.elInteractBtn.classList.remove('hidden');
      const interactSig = `${isTouch}:${ctx.interactLabel}`;
      if (this.elInteractBtn.dataset.sig !== interactSig) {
        this.elInteractBtn.dataset.sig = interactSig;
        this.elInteractBtn.innerHTML = isTouch
          ? `<span>✋ ${ctx.interactLabel}</span>`
          : `<span class="key-cap">E</span><span>${ctx.interactLabel}</span>`;
      }
    } else {
      this.elInteractBtn.classList.add('hidden');
    }

    // 7. Bottom-Right Pro HUD Toggle + Sound Sensor + Thermometer + Weather Forecast + Clock + Circular Minimap
    this.elBottomRight.classList.toggle('pro-hidden', ctx.save.settings.proHud);
    this.elMinimapWrap.classList.toggle('slate-locked', !ctx.save.hasSheikahSlate);
    if (!ctx.save.settings.proHud) {
      this.drawSoundWaveform(ctx.noiseLevel);
      if (ctx.climate.isVolcanicError) {
        this.elTemp.className = 'temp-gauge error';
        this.elTemp.textContent = '🔥 ERROR';
      } else {
        this.elTemp.className = `temp-gauge ${ctx.climate.coldHazardLevel > 0 ? 'cold' : ctx.climate.heatHazardLevel > 0 ? 'hot' : ''}`;
        this.elTemp.textContent = `${ctx.climate.temperatureC}°C (${ctx.climate.temperatureF}°F)`;
      }
      this.elWeather.innerHTML = `<span class="weather-now">${WEATHER_ICONS[ctx.climate.weather] ?? '☀️'}</span>${ctx.climate.forecast
        .map((f) => `<span>${WEATHER_ICONS[f] ?? '☀️'}</span>`)
        .join('')}`;
      const hh = Math.floor(ctx.climate.timeHours);
      const mm = Math.floor((ctx.climate.timeHours - hh) * 60);
      this.elClock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      this.drawCircularMinimap(ctx.playerPos, ctx.playerYaw, ctx.cameraYaw, ctx.save.settings.northFixedMinimap);
    }

    // 8. Bullet-Time / Blood Moon / Camera Viewfinder Overlays
    this.elBulletVig.classList.toggle('active', ctx.bulletTime || ctx.flurryRush);
    this.elBloodVig.classList.toggle('active', ctx.climate.isBloodMoonRising);
    this.elCameraOverlay.classList.toggle('hidden', !ctx.cameraModeActive);
    if (ctx.cameraModeActive) {
      this.elCameraTag.textContent = ctx.cameraTargetName
        ? isTouch
          ? `📷 認識対象：【${ctx.cameraTargetName}】 — ルーンボタンで撮影＆図鑑登録！`
          : `📷 認識対象：【${ctx.cameraTargetName}】 — Qで撮影＆図鑑登録！`
        : isTouch
        ? '📷 ウツシエ — 対象を枠に収めてルーンボタンで撮影'
        : '📷 ウツシエ — 対象を枠に収めて Q で撮影（Fで自撮り）';
    }
  }

  private renderHearts(hearts: number, maxHearts: number, tempHearts: number): void {
    const total = Math.min(30, maxHearts + Math.ceil(tempHearts));
    let html = '';
    for (let i = 0; i < total; i++) {
      const isTemp = i >= maxHearts;
      const fill = isTemp ? Math.max(0, Math.min(1, tempHearts - (i - maxHearts))) : Math.max(0, Math.min(1, hearts - i));
      const color = isTemp ? '#ffe042' : '#f23842';
      const pct = Math.round(fill * 4) * 25;
      html += `<svg class="heart-icon" viewBox="0 0 24 24">
        <defs><clipPath id="hc_${i}"><rect x="0" y="0" width="${(24 * pct) / 100}" height="24"/></clipPath></defs>
        <path d="M12 21s-7.5-4.7-9.6-9.2C.9 8.5 3.1 4.5 6.8 4.5c2.1 0 3.9 1.2 5.2 2.9 1.3-1.7 3.1-2.9 5.2-2.9 3.7 0 5.9 4 4.4 7.3C19.5 16.3 12 21 12 21z" fill="rgba(22,26,34,0.72)" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>
        <path clip-path="url(#hc_${i})" d="M12 21s-7.5-4.7-9.6-9.2C.9 8.5 3.1 4.5 6.8 4.5c2.1 0 3.9 1.2 5.2 2.9 1.3-1.7 3.1-2.9 5.2-2.9 3.7 0 5.9 4 4.4 7.3C19.5 16.3 12 21 12 21z" fill="${color}"/>
      </svg>`;
    }
    this.elHearts.innerHTML = html;
  }

  private renderStaminaWheel(stamina: number, maxStamina: number, tempStamina: number, exhausted: boolean): void {
    const ring1 = Math.min(1, stamina / 100);
    const ring2 = Math.max(0, Math.min(1, (stamina - 100) / 100));
    const ring3 = Math.max(0, Math.min(1, (stamina - 200) / 100));
    const c1 = 2 * Math.PI * 16;
    const c2 = 2 * Math.PI * 24;
    const col = exhausted ? '#ff464c' : '#44eb66';
    this.elStaminaSvg.innerHTML = `
      <circle cx="34" cy="34" r="16" fill="none" stroke="rgba(16,28,22,0.72)" stroke-width="8"/>
      <circle cx="34" cy="34" r="16" fill="none" stroke="${col}" stroke-width="7.5" stroke-dasharray="${c1}" stroke-dashoffset="${c1 * (1 - ring1)}" transform="rotate(-90 34 34)"/>
      ${
        maxStamina > 100
          ? `<circle cx="34" cy="34" r="24" fill="none" stroke="rgba(16,28,22,0.55)" stroke-width="4.5"/>
             <circle cx="34" cy="34" r="24" fill="none" stroke="${ring3 > 0 ? '#78ff92' : col}" stroke-width="4" stroke-dasharray="${c2}" stroke-dashoffset="${c2 * (1 - Math.max(ring2, ring3))}" transform="rotate(-90 34 34)"/>`
          : ''
      }
      ${
        tempStamina > 0
          ? `<circle cx="34" cy="34" r="29" fill="none" stroke="#ffe44c" stroke-width="3.2" stroke-dasharray="${2 * Math.PI * 29}" stroke-dashoffset="${2 * Math.PI * 29 * (1 - Math.min(1, tempStamina / 100))}" transform="rotate(-90 34 34)"/>`
          : ''
      }
    `;
  }

  private drawSoundWaveform(noiseLevel: number): void {
    const ctx = this.elSoundCanvas.getContext('2d')!;
    const w = this.elSoundCanvas.width;
    const h = this.elSoundCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#c872ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const t = performance.now() * 0.012;
    for (let x = 0; x <= w; x += 3) {
      const env = Math.sin((x / w) * Math.PI);
      const y = h * 0.5 + Math.sin(x * 0.45 + t) * env * noiseLevel * (h * 0.44);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private drawCircularMinimap(playerPos: THREE.Vector3, playerYaw: number, cameraYaw: number, northFixed: boolean): void {
    const ctx = this.elMinimapCanvas.getContext('2d')!;
    const w = this.elMinimapCanvas.width;
    const h = this.elMinimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0e1b29';
    ctx.fillRect(0, 0, w, h);

    if (!this.save.hasSheikahSlate) {
      ctx.strokeStyle = 'rgba(228, 196, 101, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(228, 196, 101, 0.65)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NO SLATE', cx, cy + 4);
      return;
    }

    const hasTowerMapData = this.save.activatedTowers.length > 0;

    ctx.save();
    ctx.translate(cx, cy);
    const rot = northFixed ? 0 : cameraYaw;
    ctx.rotate(rot);

    const scale = 0.26; // 1m = 0.26px (~280m view radius)
    // Subtle contour rings
    ctx.strokeStyle = hasTowerMapData ? 'rgba(54, 228, 255, 0.14)' : 'rgba(54, 228, 255, 0.08)';
    ctx.lineWidth = 1;
    for (const r of [24, 48, 68]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (hasTowerMapData) {
      // Draw nearby Towers & Shrines & Landmarks once Great Plateau / Regional tower unlocked
      for (const reg of REGION_LIST) {
        const dx = (reg.towerPos.x - playerPos.x) * scale;
        const dz = (reg.towerPos.z - playerPos.z) * scale;
        if (dx * dx + dz * dz < 68 * 68) {
          ctx.fillStyle = this.save.activatedTowers.includes(reg.id) ? '#36e4ff' : '#ff8c24';
          ctx.fillRect(dx - 3, dz - 3, 6, 6);
        }
      }
      for (const sh of PHYSICAL_SHRINES) {
        if (sh.category === 'dlc2' && this.save.defeatedDivineBeasts.length < 4) continue;
        const dx = (sh.x - playerPos.x) * scale;
        const dz = (sh.z - playerPos.z) * scale;
        if (dx * dx + dz * dz < 68 * 68) {
          ctx.fillStyle = this.save.completedShrines.includes(sh.id) ? '#36e4ff' : '#ff9c38';
          ctx.beginPath();
          ctx.arc(dx, dz, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const lm of LANDMARKS) {
        const dx = (lm.x - playerPos.x) * scale;
        const dz = (lm.z - playerPos.z) * scale;
        if (dx * dx + dz * dz < 68 * 68) {
          ctx.fillStyle = lm.type === 'castle' ? '#ff3858' : '#e4c465';
          ctx.beginPath();
          ctx.arc(dx, dz, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();

    if (!hasTowerMapData) {
      ctx.fillStyle = 'rgba(130, 195, 225, 0.55)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('未登録エリア', cx, cy + 44);
    }

    // Player golden directional arrow at center
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(northFixed ? Math.PI - playerYaw : Math.PI - (playerYaw - cameraYaw));
    ctx.fillStyle = '#ffe96a';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
