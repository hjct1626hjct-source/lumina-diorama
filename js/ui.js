// ============================================================================
// LUMINA DIORAMA — Complete UI Controller (HUD, Shops, Forge, Dex, Lobby, Chat)
// 製作者：駿 (Created by Shun)
// ============================================================================

import {
  JOBS,
  WEAPONS,
  ARMORS,
  SPELLS,
  CORES,
  ORES,
  AREAS,
  ENEMIES,
  BOSSES,
  ACHIEVEMENTS,
  QUICK_STAMPS,
  ELEMENT_INFO,
  RARITY_INFO,
  INTRO_STORY,
  calcWeaponStats,
  calcArmorStats,
  getForgeCost,
  getDroneUpgradeCost,
  getAreaById,
  getWeaponById,
  getArmorById,
  getSpellById,
} from './data.js';
import {
  listAllSaves,
  getLatestSave,
  saveSlot,
  loadSlot,
  loadAuto,
  deleteSlot,
  exportSaveJson,
  parseImportedSave,
  formatPlayTime,
} from './save.js';
import { generateRoomCode } from './network.js';

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class UIManager {
  constructor(game) {
    this.game = game;
    this.selectedJobId = 'knight';
    this.introIndex = 0;
    this.dialogueQueue = [];
    this.dialogueCallback = null;
    this.activeMenuTab = 'equip';
    this.isModalOpen = false;
    this.chatOpen = false;
    this.trophyTimeout = null;
    this.areaBannerTimeout = null;
    this.warningTimeout = null;

    this._cacheElements();
    this._bindStaticEvents();
    this._renderStampBar();
    this._renderJobCards();
  }

  _cacheElements() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      app: $('app'),
      screenTitle: $('screen-title'),
      btnTitleContinue: $('btn-title-continue'),
      continueSummary: $('continue-summary'),
      btnTitleNew: $('btn-title-new'),
      btnTitleMulti: $('btn-title-multi'),
      btnTitleLoad: $('btn-title-load'),
      btnTitleControls: $('btn-title-controls'),
      btnTitleMute: $('btn-title-mute'),

      screenJob: $('screen-job'),
      inputPlayerName: $('input-player-name'),
      jobCards: $('job-cards'),
      btnJobBack: $('btn-job-back'),
      btnJobStart: $('btn-job-start'),

      screenLobby: $('screen-lobby'),
      btnLobbyClose: $('btn-lobby-close'),
      inputHostCode: $('input-host-code'),
      btnGenCode: $('btn-gen-code'),
      btnHostRoom: $('btn-host-room'),
      inputJoinCode: $('input-join-code'),
      btnJoinRoom: $('btn-join-room'),
      lobbyStatusBox: $('lobby-status-box'),
      lobbyStatusText: $('lobby-status-text'),
      lobbyRoomDisplay: $('lobby-room-display'),
      lobbyRoomCode: $('lobby-room-code'),
      btnCopyRoom: $('btn-copy-room'),
      lobbyPartyList: $('lobby-party-list'),
      btnLobbyResume: $('btn-lobby-resume'),
      btnLobbyDisconnect: $('btn-lobby-disconnect'),

      screenIntro: $('screen-intro'),
      introText: $('intro-text'),
      btnIntroSkip: $('btn-intro-skip'),
      btnIntroNext: $('btn-intro-next'),

      hudLayer: $('hud-layer'),
      hudJobBadge: $('hud-job-badge'),
      hudPlayerName: $('hud-player-name'),
      hudLevel: $('hud-level'),
      hudNgBadge: $('hud-ng-badge'),
      hudHpFill: $('hud-hp-fill'),
      hudHpText: $('hud-hp-text'),
      hudMpFill: $('hud-mp-fill'),
      hudMpText: $('hud-mp-text'),
      hudExpFill: $('hud-exp-fill'),
      hudGoldText: $('hud-gold-text'),
      hudLimitFill: $('hud-limit-fill'),
      hudLimitText: $('hud-limit-text'),
      hudStatusIcons: $('hud-status-icons'),
      hudPartyList: $('hud-party-list'),
      hudAreaName: $('hud-area-name'),
      hudTowerFloor: $('hud-tower-floor'),
      hudRoomPill: $('hud-room-pill'),
      hudSpellStrip: $('hud-spell-strip'),

      bossHud: $('boss-hud'),
      bossHudTitle: $('boss-hud-title'),
      bossHudPhase: $('boss-hud-phase'),
      bossHudShield: $('boss-hud-shield'),
      bossHpFill: $('boss-hp-fill'),
      bossHpNum: $('boss-hp-num'),

      comboHud: $('combo-hud'),
      comboCount: $('combo-count'),
      comboBonus: $('combo-bonus'),

      btnHudWarp: $('btn-hud-warp'),
      btnHudMulti: $('btn-hud-multi'),
      btnHudMenu: $('btn-hud-menu'),
      btnHudMute: $('btn-hud-mute'),

      chatContainer: $('chat-container'),
      btnChatToggle: $('btn-chat-toggle'),
      chatUnreadDot: $('chat-unread-dot'),
      chatMessages: $('chat-messages'),
      stampBar: $('stamp-bar'),
      chatForm: $('chat-form'),
      chatInput: $('chat-input'),

      downedBanner: $('downed-banner'),
      downedTimer: $('downed-timer'),

      touchLayer: $('touch-layer'),
      tbtnMagicIco: $('tbtn-magic-ico'),
      tbtnMagicTxt: $('tbtn-magic-txt'),
      tbtnLimit: $('tbtn-limit'),
      tbtnDash: $('tbtn-dash'),
      tbtnInteract: $('tbtn-interact'),
      tbtnInteractLabel: $('tbtn-interact-label'),

      areaBanner: $('area-banner'),
      areaBannerSub: $('area-banner-sub'),
      areaBannerTitle: $('area-banner-title'),

      warningCutin: $('warning-cutin'),
      warningBossName: $('warning-boss-name'),

      toastStack: $('toast-stack'),
      trophyToast: $('trophy-toast'),
      trophyTitle: $('trophy-title'),

      dialogueBox: $('dialogue-box'),
      dialogueAvatar: $('dialogue-avatar'),
      dialogueSpeaker: $('dialogue-speaker'),
      dialogueText: $('dialogue-text'),
      btnDialogueNext: $('btn-dialogue-next'),

      modalMenu: $('modal-menu'),
      btnMenuClose: $('btn-menu-close'),
      menuTabs: $('menu-tabs'),
      menuTabContent: $('menu-tab-content'),
      btnMenuReturnTown: $('btn-menu-return-town'),
      btnMenuTitle: $('btn-menu-title'),

      modalFacility: $('modal-facility'),
      facilityEyebrow: $('facility-eyebrow'),
      facilityTitle: $('facility-title'),
      facilityGold: $('facility-gold'),
      facilityBody: $('facility-body'),
      btnFacilityClose: $('btn-facility-close'),

      screenDefeat: $('screen-defeat'),
      defeatGoldLoss: $('defeat-gold-loss'),
      btnDefeatRevive: $('btn-defeat-revive'),

      screenEnding: $('screen-ending'),
      endingRankLetter: $('ending-rank-letter'),
      endingStats: $('ending-stats'),
      btnEndingTower: $('btn-ending-tower'),
      btnEndingNgplus: $('btn-ending-ngplus'),
      btnEndingContinue: $('btn-ending-continue'),
    };
  }

  _bindStaticEvents() {
    const g = this.game;

    // Title Screen Buttons
    this.el.btnTitleContinue.addEventListener('click', () => {
      g.audio.unlock();
      g.audio.playSe('uiClick');
      const latest = getLatestSave();
      if (latest) g.startFromSave(latest);
    });

    this.el.btnTitleNew.addEventListener('click', () => {
      g.audio.unlock();
      g.audio.playSe('uiClick');
      this.openJobSelect();
    });

    this.el.btnTitleMulti.addEventListener('click', () => {
      g.audio.unlock();
      g.audio.playSe('uiClick');
      // If save exists, load character silently into memory for lobby, else prepare default
      const latest = getLatestSave();
      if (latest && g.mode === 'title') {
        g.loadDataOnly(latest);
      }
      this.openLobby();
    });

    this.el.btnTitleLoad.addEventListener('click', () => {
      g.audio.unlock();
      g.audio.playSe('uiClick');
      this.openSaveModalFromTitle();
    });

    this.el.btnTitleControls.addEventListener('click', () => {
      g.audio.unlock();
      g.audio.playSe('uiClick');
      this.openControlsGuide();
    });

    const onMuteToggle = () => {
      g.audio.unlock();
      const muted = g.audio.toggleMute();
      g.settings.muted = muted;
      g.persistSettings();
      this.syncAudioButtons();
    };
    this.el.btnTitleMute.addEventListener('click', onMuteToggle);
    this.el.btnHudMute.addEventListener('click', onMuteToggle);

    // Job Selection
    this.el.btnJobBack.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.el.screenJob.classList.add('hidden');
      this.el.screenTitle.classList.remove('hidden');
    });
    this.el.btnJobStart.addEventListener('click', () => {
      g.audio.unlock();
      g.audio.playSe('levelup');
      const name = (this.el.inputPlayerName.value || 'シュン').trim().slice(0, 12) || 'シュン';
      this.el.screenJob.classList.add('hidden');
      g.startNewGame(name, this.selectedJobId);
    });

    // Intro Story
    this.el.btnIntroSkip.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.finishIntro();
    });
    this.el.btnIntroNext.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.introIndex += 1;
      if (this.introIndex >= INTRO_STORY.length) {
        this.finishIntro();
      } else {
        this.el.introText.textContent = INTRO_STORY[this.introIndex];
      }
    });

    // Multiplayer Lobby
    this.el.btnLobbyClose.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.closeLobby();
    });
    this.el.btnGenCode.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.el.inputHostCode.value = generateRoomCode();
    });
    this.el.btnHostRoom.addEventListener('click', () => {
      g.audio.unlock();
      g.audio.playSe('uiClick');
      if (g.mode === 'title') {
        const latest = getLatestSave();
        if (latest) g.startFromSave(latest, true);
        else g.startNewGame('シュン', 'knight', true);
      }
      g.network.hostRoom(this.el.inputHostCode.value);
    });
    this.el.btnJoinRoom.addEventListener('click', () => {
      g.audio.unlock();
      g.audio.playSe('uiClick');
      if (g.mode === 'title') {
        const latest = getLatestSave();
        if (latest) g.startFromSave(latest, true);
        else g.startNewGame('シュン', 'knight', true);
      }
      g.network.joinRoom(this.el.inputJoinCode.value);
    });
    this.el.btnCopyRoom.addEventListener('click', () => {
      const code = this.el.lobbyRoomCode.textContent;
      if (navigator.clipboard && code) {
        navigator.clipboard.writeText(code).catch(() => {});
      }
      g.addToast(`合言葉 [${code}] をコピーしました！`);
    });
    this.el.btnLobbyResume.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.closeLobby();
    });
    this.el.btnLobbyDisconnect.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      g.network.disconnect();
    });

    // HUD Quick Buttons
    this.el.btnHudWarp.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.openWarpModal();
    });
    this.el.btnHudMulti.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.openLobby();
    });
    this.el.btnHudMenu.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.openMenu('equip');
    });

    // Chat Drawer
    this.el.btnChatToggle.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.chatOpen = !this.chatOpen;
      this.el.chatContainer.classList.toggle('collapsed', !this.chatOpen);
      if (this.chatOpen) this.el.chatUnreadDot.classList.add('hidden');
    });
    this.el.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.el.chatInput.value.trim();
      if (!text) return;
      this.el.chatInput.value = '';
      g.network.sendChat(text, false);
    });

    // Dialogue Box
    this.el.btnDialogueNext.addEventListener('click', () => this.advanceDialogue());
    this.el.dialogueBox.addEventListener('click', (e) => {
      if (e.target !== this.el.btnDialogueNext) this.advanceDialogue();
    });

    // Menu Modal
    this.el.btnMenuClose.addEventListener('click', () => this.closeModals());
    this.el.menuTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      g.audio.playSe('uiClick');
      this.activeMenuTab = btn.dataset.tab;
      this.renderMenuTab();
    });
    this.el.btnMenuReturnTown.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.closeModals();
      g.changeArea('town');
      g.addToast('🌀 拠点ネオンタウンへ帰還しました');
    });
    this.el.btnMenuTitle.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      g.autoSave();
      this.closeModals();
      g.returnToTitle();
    });

    // Facility Modal
    this.el.btnFacilityClose.addEventListener('click', () => this.closeModals());

    // Defeat Overlay
    this.el.btnDefeatRevive.addEventListener('click', () => {
      g.audio.playSe('revive');
      this.el.screenDefeat.classList.add('hidden');
      this.isModalOpen = false;
      g.recoverFromDefeat();
    });

    // Ending Buttons
    this.el.btnEndingContinue.addEventListener('click', () => {
      g.audio.playSe('uiClick');
      this.el.screenEnding.classList.add('hidden');
      this.isModalOpen = false;
      g.changeArea('town');
    });
    this.el.btnEndingTower.addEventListener('click', () => {
      g.audio.playSe('levelup');
      this.el.screenEnding.classList.add('hidden');
      this.isModalOpen = false;
      g.enterEndlessTower(1);
    });
    this.el.btnEndingNgplus.addEventListener('click', () => {
      g.audio.playSe('levelup');
      this.el.screenEnding.classList.add('hidden');
      this.isModalOpen = false;
      g.startNewGamePlus();
    });
  }

  _renderStampBar() {
    this.el.stampBar.innerHTML = QUICK_STAMPS.map(
      (s) => `<button type="button" class="stamp-btn" data-stamp="${escHtml(s.icon + ' ' + s.text)}">${s.icon} ${escHtml(s.text)}</button>`
    ).join('');
    this.el.stampBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.stamp-btn');
      if (!btn) return;
      this.game.network.sendChat(btn.dataset.stamp, true);
    });
  }

  _renderJobCards() {
    const jobs = Object.values(JOBS);
    this.el.jobCards.innerHTML = jobs
      .map((j) => {
        const wp = getWeaponById(j.starterWeapon);
        const ar = getArmorById(j.starterArmor);
        const sel = j.id === this.selectedJobId ? 'selected' : '';
        return `
          <div class="job-card ${sel}" data-job="${j.id}">
            <div class="job-card-top">
              <canvas class="job-avatar-canvas" data-job-avatar="${j.id}" width="64" height="64" style="width:54px;height:54px;border-radius:14px;border:2px solid ${j.color};background:#091326;flex-shrink:0;"></canvas>
              <div>
                <div class="job-en">${j.icon} ${j.en}</div>
                <h3 class="job-title">${j.name}</h3>
              </div>
            </div>
            <p class="job-desc">${j.desc}</p>
            <div class="job-gear-box">
              <div>⚔ 初期武器：<strong>${wp.name}</strong></div>
              <div>🛡 初期防具：<strong>${ar.name}</strong></div>
              <div>★ 必殺技：<strong>${j.limitName}</strong></div>
            </div>
            <div class="job-stats">
              <span>HP ${j.baseStats.maxHp}</span>
              <span>MP ${j.baseStats.maxMp}</span>
              <span>ATK ${j.baseStats.atk}</span>
              <span>MAG ${j.baseStats.mag}</span>
              <span>SPD ${j.baseStats.spd}</span>
              <span>CRIT ${Math.round(j.baseStats.crit * 100)}%</span>
            </div>
          </div>
        `;
      })
      .join('');

    // Paint procedural original character face & outfit preview on each Job card!
    if (this.game && this.game.renderer && this.game.renderer.texBank) {
      const tb = this.game.renderer.texBank;
      this.el.jobCards.querySelectorAll('[data-job-avatar]').forEach((cv) => {
        const j = JOBS[cv.dataset.jobAvatar];
        if (!j) return;
        const ctx = cv.getContext('2d');
        const faceTex = tb.getFaceTexture({
          id: j.id,
          skinTone: j.skinTone,
          eyeColor: j.eyeColor,
          hairColor: j.hairColor,
          gender: j.gender,
        });
        const outfitTex = tb.getOutfitTexture({
          id: j.id,
          style: j.outfitStyle,
          primary: j.color,
          accent: j.accent,
          skinTone: j.skinTone,
        });
        ctx.clearRect(0, 0, 64, 64);
        if (faceTex?.image) ctx.drawImage(faceTex.image, 176, 10, 160, 210, 10, 2, 44, 38);
        if (outfitTex?.image) ctx.drawImage(outfitTex.image, 14, 38, 36, 24);
      });
    }

    this.el.jobCards.onclick = (e) => {
      const card = e.target.closest('.job-card');
      if (!card) return;
      this.game.audio.playSe('uiClick');
      this.selectedJobId = card.dataset.job;
      this._renderJobCards();
    };
  }

  refreshTitleScreen() {
    this.el.screenTitle.classList.remove('hidden');
    this.el.hudLayer.classList.add('hidden');
    const latest = getLatestSave();
    if (latest) {
      const area = getAreaById(latest.areaId);
      const job = JOBS[latest.player.jobId] || JOBS.knight;
      this.el.btnTitleContinue.classList.remove('hidden');
      this.el.continueSummary.textContent = `${latest.player.name} (${job.name} Lv.${latest.player.level}) — ${area.name}`;
    } else {
      this.el.btnTitleContinue.classList.add('hidden');
    }
    this.syncAudioButtons();
  }

  syncAudioButtons() {
    const muted = this.game.audio.muted;
    this.el.btnTitleMute.textContent = muted ? '🔇 音声 OFF' : '🔊 音声 ON';
    this.el.btnHudMute.textContent = muted ? '🔇' : '🔊';
  }

  applySettingsToDOM(settings) {
    this.el.app.classList.toggle('ui-large', settings.buttonSize === 'large');
    this.el.app.classList.toggle('ui-left-handed', settings.handedness === 'left');

    const isTouchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    let showTouch = isTouchCapable;
    if (settings.touchMode === 'always') showTouch = true;
    if (settings.touchMode === 'hide') showTouch = false;
    this.el.touchLayer.classList.toggle('touch-hidden', !showTouch);
  }

  openJobSelect() {
    this.el.screenTitle.classList.add('hidden');
    this.el.screenJob.classList.remove('hidden');
    this._renderJobCards();
  }

  showIntroStory() {
    this.introIndex = 0;
    this.el.screenTitle.classList.add('hidden');
    this.el.screenJob.classList.add('hidden');
    this.el.screenIntro.classList.remove('hidden');
    this.el.introText.textContent = INTRO_STORY[0];
    this.isModalOpen = true;
  }

  finishIntro() {
    this.el.screenIntro.classList.add('hidden');
    this.el.hudLayer.classList.remove('hidden');
    this.isModalOpen = false;
    this.showAreaBanner(this.game.map.meta);
  }

  showInGameHud() {
    this.el.screenTitle.classList.add('hidden');
    this.el.screenJob.classList.add('hidden');
    this.el.screenIntro.classList.add('hidden');
    this.el.hudLayer.classList.remove('hidden');
  }

  // ==========================================================================
  // MULTIPLAYER LOBBY
  // ==========================================================================
  openLobby() {
    this.isModalOpen = true;
    this.el.screenLobby.classList.remove('hidden');
    if (!this.el.inputHostCode.value) {
      this.el.inputHostCode.value = generateRoomCode();
    }
    this.updateLobbyUI(this.game.network.getStatusInfo());
  }

  closeLobby() {
    this.el.screenLobby.classList.add('hidden');
    this.isModalOpen = false;
  }

  updateLobbyUI(info) {
    const active = info.role !== 'solo' || info.roomCode;
    this.el.lobbyStatusBox.classList.toggle('hidden', !active && info.statusText === 'ソロプレイ中');
    this.el.lobbyStatusText.textContent = info.statusText;
    this.el.lobbyRoomDisplay.classList.toggle('hidden', !info.roomCode);
    this.el.lobbyRoomCode.textContent = info.roomCode || '----';
    this.el.btnLobbyResume.classList.toggle('hidden', !info.connected);
    this.el.btnLobbyDisconnect.classList.toggle('hidden', info.role === 'solo');

    this.el.lobbyPartyList.innerHTML = info.members
      .map((m) => {
        const job = JOBS[m.jobId] || JOBS.knight;
        return `<span class="party-chip">${job.icon} ${escHtml(m.name)} Lv.${m.level}${m.isHost ? ' 👑HOST' : ''}</span>`;
      })
      .join('');

    // Sync HUD room indicator
    if (info.connected && info.roomCode) {
      this.el.hudRoomPill.classList.remove('hidden');
      this.el.hudRoomPill.textContent = `ROOM: ${info.roomCode} (${info.partyCount}/4)`;
    } else {
      this.el.hudRoomPill.classList.add('hidden');
    }
  }

  // ==========================================================================
  // REAL-TIME HUD UPDATE
  // ==========================================================================
  updateHud() {
    const g = this.game;
    const p = g.player;
    const st = p.getStats();
    const job = p.getJob();

    this.el.hudJobBadge.textContent = job.badge;
    this.el.hudJobBadge.style.color = job.accent;
    this.el.hudPlayerName.textContent = p.name;
    this.el.hudLevel.textContent = `Lv.${p.level}`;

    if (g.progress.ngPlus > 1) {
      this.el.hudNgBadge.classList.remove('hidden');
      this.el.hudNgBadge.textContent = `NG+${g.progress.ngPlus}`;
    } else {
      this.el.hudNgBadge.classList.add('hidden');
    }

    this.el.hudHpFill.style.width = `${Math.max(0, Math.min(100, (p.hp / st.maxHp) * 100))}%`;
    this.el.hudHpText.textContent = `${Math.ceil(p.hp)}/${st.maxHp}`;

    this.el.hudMpFill.style.width = `${Math.max(0, Math.min(100, (p.mp / st.maxMp) * 100))}%`;
    this.el.hudMpText.textContent = `${Math.floor(p.mp)}/${st.maxMp}`;

    this.el.hudExpFill.style.width = `${Math.min(100, (p.exp / p.nextExp) * 100)}%`;
    this.el.hudGoldText.textContent = `${p.gold.toLocaleString()} G`;

    this.el.hudLimitFill.style.width = `${Math.min(100, p.limit)}%`;
    this.el.hudLimitFill.classList.toggle('ready', p.limit >= 100);
    this.el.hudLimitText.textContent = p.limit >= 100 ? 'MAX!' : `${Math.floor(p.limit)}%`;

    // Active Status Pills
    const pills = [];
    if (p.statuses.overclock > 0) pills.push(`<span class="status-pill" style="color:#38f8d4">⚙️OC ${Math.ceil(p.statuses.overclock)}s</span>`);
    if (p.statuses.shrineAtk > 0) pills.push(`<span class="status-pill" style="color:#fbbf24">⛩ATK×2 ${Math.ceil(p.statuses.shrineAtk)}s</span>`);
    if (p.statuses.burn > 0) pills.push(`<span class="status-pill" style="color:#fb923c">🔥延焼</span>`);
    if (p.statuses.poison > 0) pills.push(`<span class="status-pill" style="color:#a3e635">☠毒</span>`);
    if (p.statuses.freeze > 0) pills.push(`<span class="status-pill" style="color:#7dd3fc">❄️鈍足</span>`);
    if (p.statuses.shrineCurse > 0) pills.push(`<span class="status-pill" style="color:#c084fc">👁呪い ${Math.ceil(p.statuses.shrineCurse)}s</span>`);
    this.el.hudStatusIcons.innerHTML = pills.join('');

    // Area & Tower Floor
    this.el.hudAreaName.textContent = g.map.meta.name;
    if (g.currentAreaId === 'tower') {
      this.el.hudTowerFloor.classList.remove('hidden');
      this.el.hudTowerFloor.textContent = `FLOOR ${g.towerFloor} | SCORE ${g.towerScore}`;
    } else {
      this.el.hudTowerFloor.classList.add('hidden');
    }

    // Combo Counter
    if (p.hitCombo >= 2) {
      const cb = p.getComboBonus();
      this.el.comboHud.classList.remove('hidden');
      this.el.comboCount.textContent = `${p.hitCombo} HIT!`;
      this.el.comboBonus.textContent = `ATK +${Math.round((cb.atkMult - 1) * 100)}% / DROP +${Math.round(cb.dropBonus * 100)}%`;
    } else {
      this.el.comboHud.classList.add('hidden');
    }

    // Boss HP Bar
    if (g.boss && g.boss.alive) {
      this.el.bossHud.classList.remove('hidden');
      this.el.bossHudTitle.textContent = g.boss.name;
      this.el.bossHudPhase.textContent = g.boss.phase === 2 ? 'PHASE 2 覚醒' : 'PHASE 1';
      this.el.bossHudShield.classList.toggle('hidden', !g.boss.isShielded());
      this.el.bossHpFill.style.width = `${Math.max(0, (g.boss.hp / g.boss.maxHp) * 100)}%`;
      this.el.bossHpFill.classList.toggle('phase2', g.boss.phase === 2);
      this.el.bossHpNum.textContent = `${Math.ceil(g.boss.hp)} / ${g.boss.maxHp}`;
    } else {
      this.el.bossHud.classList.add('hidden');
    }

    // Active Spell Button & Bottom Spell Strip
    const curSp = getSpellById(p.activeSpell);
    this.el.tbtnMagicIco.textContent = curSp.icon;
    this.el.tbtnMagicTxt.textContent = `${curSp.mpCost}MP`;
    this.el.tbtnLimit.classList.toggle('ready', p.limit >= 100);

    // SVG Ring progress on Touch Dash & Limit & Interact
    const dashCircle = this.el.tbtnDash.querySelector('circle');
    if (dashCircle) {
      const dashReady = Math.max(0, 1 - p.dashCooldown / p.dashMaxCooldown);
      dashCircle.style.strokeDashoffset = `${176 * (1 - dashReady)}`;
    }
    const limCircle = this.el.tbtnLimit.querySelector('circle');
    if (limCircle) {
      limCircle.style.strokeDashoffset = `${176 * (1 - p.limit / 100)}`;
    }

    // Contextual Interact / Rescue highlight
    const ctxHint = g.getNearestInteractable();
    this.el.tbtnInteract.classList.toggle('highlight', Boolean(ctxHint));
    this.el.tbtnInteractLabel.textContent = ctxHint ? ctxHint.shortLabel : '調べる';

    // Downed Alert
    this.el.downedBanner.classList.toggle('hidden', !p.downed);
    if (p.downed) {
      this.el.downedTimer.textContent = `${Math.max(0, Math.ceil(p.downedTimer))}`;
    }

    // Co-op Party Mini Cards
    const peers = Array.from(g.network.remotePlayers.values());
    if (peers.length > 0) {
      this.el.hudPartyList.innerHTML = peers
        .map((rp) => {
          const j = JOBS[rp.jobId] || JOBS.knight;
          const pct = Math.max(0, Math.min(100, (rp.hp / Math.max(1, rp.maxHp)) * 100));
          const areaLabel = rp.areaId === g.currentAreaId ? '' : ` [${getAreaById(rp.areaId).code}]`;
          return `
            <div class="party-mini-card ${rp.downed ? 'downed' : ''}">
              <div class="party-mini-head">
                <span>${j.icon} ${escHtml(rp.name)} Lv.${rp.level}${areaLabel}</span>
                <span>${rp.downed ? '🆘SOS' : `${rp.hp}/${rp.maxHp}`}</span>
              </div>
              <div class="party-mini-track"><div class="party-mini-fill" style="width:${pct}%"></div></div>
            </div>
          `;
        })
        .join('');
    } else {
      this.el.hudPartyList.innerHTML = '';
    }

    // Bottom Spell Strip
    this.el.hudSpellStrip.innerHTML = SPELLS.map((sp, idx) => {
      const lv = p.spells[sp.id] || 0;
      const cls = `spell-slot ${p.activeSpell === sp.id ? 'active' : ''} ${lv === 0 ? 'locked' : ''}`;
      return `
        <button type="button" class="${cls}" data-spell-idx="${idx}" title="${sp.name} (${idx + 1})">
          <span class="spell-slot-key">${idx + 1}</span>
          <span class="spell-slot-ico">${sp.icon}</span>
          <span class="spell-slot-mp">${lv > 0 ? `Lv${lv}` : '未'}</span>
        </button>
      `;
    }).join('');
    this.el.hudSpellStrip.onclick = (e) => {
      const slot = e.target.closest('.spell-slot');
      if (!slot) return;
      const idx = Number(slot.dataset.spellIdx);
      const selected = p.selectSpellByIndex(idx);
      if (selected) {
        g.audio.playSe('uiClick');
        g.addToast(`${selected.icon} ${selected.name} に切替`);
      }
    };
  }

  // ==========================================================================
  // CINEMATICS, DIALOGUE, TOASTS & CHAT
  // ==========================================================================
  showAreaBanner(areaMeta) {
    this.el.areaBannerSub.textContent = `${areaMeta.code} — ${areaMeta.en}`;
    this.el.areaBannerTitle.textContent = areaMeta.name;
    this.el.areaBanner.classList.remove('hidden');
    // Restart animation cleanly
    this.el.areaBanner.style.animation = 'none';
    void this.el.areaBanner.offsetWidth;
    this.el.areaBanner.style.animation = '';

    clearTimeout(this.areaBannerTimeout);
    this.areaBannerTimeout = setTimeout(() => {
      this.el.areaBanner.classList.add('hidden');
    }, 2650);
  }

  showBossWarning(bossName, onDone) {
    this.el.warningBossName.textContent = bossName;
    this.el.warningCutin.classList.remove('hidden');
    this.game.audio.playSe('warning');
    clearTimeout(this.warningTimeout);
    this.warningTimeout = setTimeout(() => {
      this.el.warningCutin.classList.add('hidden');
      if (onDone) onDone();
    }, 1850);
  }

  addToast(text) {
    const div = document.createElement('div');
    div.className = 'toast-item';
    div.textContent = text;
    this.el.toastStack.appendChild(div);
    while (this.el.toastStack.children.length > 4) {
      this.el.toastStack.removeChild(this.el.toastStack.firstChild);
    }
    setTimeout(() => {
      div.style.opacity = '0';
      div.style.transition = 'opacity 0.3s ease';
      setTimeout(() => div.remove(), 320);
    }, 2900);
  }

  showTrophyToast(ach) {
    this.el.trophyTitle.textContent = `${ach.icon} ${ach.title}`;
    this.el.trophyToast.classList.remove('hidden');
    clearTimeout(this.trophyTimeout);
    this.trophyTimeout = setTimeout(() => {
      this.el.trophyToast.classList.add('hidden');
    }, 3600);
  }

  addChatMessage(sender, text, isSystem = false) {
    const div = document.createElement('div');
    div.className = `chat-msg ${isSystem ? 'system' : ''}`;
    div.innerHTML = isSystem
      ? `[SYSTEM] ${escHtml(text)}`
      : `<span class="sender">${escHtml(sender)}:</span>${escHtml(text)}`;
    this.el.chatMessages.appendChild(div);
    while (this.el.chatMessages.children.length > 40) {
      this.el.chatMessages.removeChild(this.el.chatMessages.firstChild);
    }
    this.el.chatMessages.scrollTop = this.el.chatMessages.scrollHeight;
    if (!this.chatOpen) {
      this.el.chatUnreadDot.classList.remove('hidden');
    }
  }

  openDialogue(speaker, icon, lines, onComplete = null) {
    this.dialogueQueue = Array.isArray(lines) ? [...lines] : [String(lines)];
    this.dialogueCallback = onComplete;
    this.el.dialogueSpeaker.textContent = speaker;
    this.el.dialogueAvatar.textContent = icon || '◈';
    this.el.dialogueBox.classList.remove('hidden');
    this.isModalOpen = true;
    this.advanceDialogue(true);
  }

  advanceDialogue(first = false) {
    if (!first) this.game.audio.playSe('uiClick');
    if (this.dialogueQueue.length === 0) {
      this.el.dialogueBox.classList.add('hidden');
      this.isModalOpen = false;
      const cb = this.dialogueCallback;
      this.dialogueCallback = null;
      if (cb) cb();
      return;
    }
    this.el.dialogueText.textContent = this.dialogueQueue.shift();
    this.el.btnDialogueNext.textContent = this.dialogueQueue.length > 0 ? '次へ ▶' : '閉じる ✓';
  }

  closeModals() {
    this.el.modalMenu.classList.add('hidden');
    this.el.modalFacility.classList.add('hidden');
    this.el.screenLobby.classList.add('hidden');
    this.isModalOpen = false;
  }

  // ==========================================================================
  // TOWN FACILITIES: GEAR SHOP, MAGIC LAB, BLACKSMITH, INN, DRONE, WARP
  // ==========================================================================
  openFacility(type) {
    this.isModalOpen = true;
    this.el.modalFacility.classList.remove('hidden');
    this._currentFacilityType = type;
    this.renderFacility(type);
  }

  renderFacility(type) {
    const g = this.game;
    const p = g.player;
    this.el.facilityGold.textContent = `${p.gold.toLocaleString()} G`;

    if (type === 'shop_gear') {
      this.el.facilityEyebrow.textContent = 'NEON TOWN ARMORY';
      this.el.facilityTitle.textContent = '🛡️ 武器・防具屋（購入 ＆ 売却）';
      const shopWeapons = WEAPONS.filter((w) => w.shopTier <= 3);
      const shopArmors = ARMORS.filter((a) => a.shopTier <= 3);

      this.el.facilityBody.innerHTML = `
        <div class="section-heading"><span>⚔ 武器ラインナップ</span></div>
        <div class="card-grid">
          ${shopWeapons.map((w) => {
            const owned = p.weapons.some((ow) => ow.id === w.id);
            const el = ELEMENT_INFO[w.element] || ELEMENT_INFO.none;
            return `
              <div class="item-card rarity-${w.rarity}">
                <div class="item-head">
                  <span class="item-name">${w.name}</span>
                  <span class="rarity-tag ${w.rarity}">${RARITY_INFO[w.rarity].label}</span>
                </div>
                <div class="item-meta">ATK +${w.atk} / MAG +${w.mag} / CRIT +${Math.round(w.crit * 100)}% / 属性:${el.icon}${el.name}<br/>${w.desc}</div>
                <div class="item-actions">
                  ${owned
                    ? `<button class="btn-ghost btn-sm" disabled>所持済</button>`
                    : `<button class="btn-neon btn-primary btn-sm" data-buy-weapon="${w.id}">${w.price} G で購入</button>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="section-heading"><span>🛡 防具ラインナップ</span></div>
        <div class="card-grid">
          ${shopArmors.map((a) => {
            const owned = p.armors.some((oa) => oa.id === a.id);
            return `
              <div class="item-card rarity-${a.rarity}">
                <div class="item-head">
                  <span class="item-name">${a.name}</span>
                  <span class="rarity-tag ${a.rarity}">${RARITY_INFO[a.rarity].label}</span>
                </div>
                <div class="item-meta">DEF +${a.def} / HP +${a.maxHp} / MP +${a.maxMp} / SPD +${a.spd}<br/>${a.desc}</div>
                <div class="item-actions">
                  ${owned
                    ? `<button class="btn-ghost btn-sm" disabled>所持済</button>`
                    : `<button class="btn-neon btn-primary btn-sm" data-buy-armor="${a.id}">${a.price} G で購入</button>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      this.el.facilityBody.onclick = (e) => {
        const bw = e.target.closest('[data-buy-weapon]');
        const ba = e.target.closest('[data-buy-armor]');
        if (bw) {
          const w = getWeaponById(bw.dataset.buyWeapon);
          if (p.gold < w.price) { g.addToast('ゴールドが足りません！'); return; }
          p.gold -= w.price;
          p.addWeapon(w.id, 0);
          p.equippedWeapon = w.id;
          g.progress.discoveredWeapons.add(w.id);
          g.audio.playSe('coin');
          g.addToast(`⚔ ${w.name} を購入＆装備しました！`);
          g.autoSave();
          this.renderFacility('shop_gear');
        } else if (ba) {
          const a = getArmorById(ba.dataset.buyArmor);
          if (p.gold < a.price) { g.addToast('ゴールドが足りません！'); return; }
          p.gold -= a.price;
          p.addArmor(a.id, 0);
          p.equippedArmor = a.id;
          g.progress.discoveredArmors.add(a.id);
          g.audio.playSe('coin');
          g.addToast(`🛡 ${a.name} を購入＆装備しました！`);
          g.autoSave();
          this.renderFacility('shop_gear');
        }
      };
    } else if (type === 'shop_magic') {
      this.el.facilityEyebrow.textContent = 'ARCANE RESEARCH LAB';
      this.el.facilityTitle.textContent = '🔮 魔法屋（習得 ＆ レベルアップ）';
      this.el.facilityBody.innerHTML = `
        <div class="card-grid">
          ${SPELLS.map((sp) => {
            const lv = p.spells[sp.id] || 0;
            const cost = lv === 0 ? sp.learnCost : Math.round(sp.learnCost * (1.2 + lv * 0.75));
            const maxed = lv >= 5;
            return `
              <div class="item-card ${lv > 0 ? 'equipped' : ''}">
                <div class="item-head">
                  <span class="item-name">${sp.icon} ${sp.name}</span>
                  <span class="rarity-tag ${lv > 0 ? 'rare' : 'common'}">${lv > 0 ? `Lv.${lv}/5` : '未習得'}</span>
                </div>
                <div class="item-meta">消費MP: ${sp.mpCost} / 属性: ${ELEMENT_INFO[sp.element].name}<br/>${sp.desc}</div>
                <div class="item-actions">
                  ${maxed
                    ? `<button class="btn-ghost btn-sm" disabled>MAX LEVEL</button>`
                    : `<button class="btn-neon btn-cyber btn-sm" data-upgrade-spell="${sp.id}">${lv === 0 ? '習得' : `Lv.${lv + 1}へ強化`} (${cost} G)</button>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      this.el.facilityBody.onclick = (e) => {
        const btn = e.target.closest('[data-upgrade-spell]');
        if (!btn) return;
        const sp = getSpellById(btn.dataset.upgradeSpell);
        const lv = p.spells[sp.id] || 0;
        if (lv >= 5) return;
        const cost = lv === 0 ? sp.learnCost : Math.round(sp.learnCost * (1.2 + lv * 0.75));
        if (p.gold < cost) { g.addToast('ゴールドが足りません！'); return; }
        p.gold -= cost;
        p.spells[sp.id] = lv + 1;
        p.activeSpell = sp.id;
        g.progress.discoveredSpells.add(sp.id);
        g.audio.playSe('levelup');
        g.addToast(`🔮 ${sp.name} が Lv.${lv + 1} になった！`);
        g.autoSave();
        this.renderFacility('shop_magic');
      };
    } else if (type === 'blacksmith') {
      this.el.facilityEyebrow.textContent = 'CYBER FORGE BLACKSMITH';
      this.el.facilityTitle.textContent = '⚒️ 鍛冶屋（装備強化 +1 〜 +10）';
      this.el.facilityBody.innerHTML = `
        <div class="stat-summary-grid">
          <div class="stat-box"><div class="stat-box-label">🔹 星屑鉱石 (+1〜+4)</div><div class="stat-box-val">${p.ores.stardust} 個</div></div>
          <div class="stat-box"><div class="stat-box-label">🔸 輝晶インゴット (+5〜+7)</div><div class="stat-box-val">${p.ores.prism} 個</div></div>
          <div class="stat-box"><div class="stat-box-label">💠 虚空クリスタル (+8〜+10)</div><div class="stat-box-val">${p.ores.void} 個</div></div>
        </div>
        <p class="muted">強化値 +1 / +4 / +7 に達すると武器の発光オーラ＆斬撃エフェクトが段階的に進化します！</p>
        <div class="section-heading"><span>⚔ 所持武器を鍛える</span></div>
        <div class="card-grid">
          ${p.weapons.map((item) => {
            const st = calcWeaponStats(item.id, item.plus);
            const cost = getForgeCost(item.plus);
            const oreMeta = ORES[cost.oreType];
            const canAfford = !cost.maxReached && p.gold >= cost.gold && (p.ores[cost.oreType] || 0) >= cost.oreCount;
            return `
              <div class="item-card rarity-${st.rarity} ${p.equippedWeapon === item.id ? 'equipped' : ''}">
                <div class="item-head">
                  <span class="item-name">${st.name} ${item.plus > 0 ? `<strong style="color:#fbbf24">+${item.plus}</strong>` : ''}</span>
                  <span class="rarity-tag ${st.rarity}">${RARITY_INFO[st.rarity].label}</span>
                </div>
                <div class="item-meta">現在 ATK ${st.atk} / MAG ${st.mag} / CRIT +${Math.round(st.crit * 100)}%</div>
                <div class="item-actions">
                  ${cost.maxReached
                    ? `<button class="btn-ghost btn-sm" disabled>★ MAX (+10)</button>`
                    : `<button class="btn-neon ${canAfford ? 'btn-accent' : 'btn-ghost'} btn-sm" data-forge-w="${item.id}">+${item.plus + 1} 強化 (${cost.gold}G / ${oreMeta.icon}${cost.oreCount})</button>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="section-heading"><span>🛡 所持防具を鍛える</span></div>
        <div class="card-grid">
          ${p.armors.map((item) => {
            const st = calcArmorStats(item.id, item.plus);
            const cost = getForgeCost(item.plus);
            const oreMeta = ORES[cost.oreType];
            const canAfford = !cost.maxReached && p.gold >= cost.gold && (p.ores[cost.oreType] || 0) >= cost.oreCount;
            return `
              <div class="item-card rarity-${st.rarity} ${p.equippedArmor === item.id ? 'equipped' : ''}">
                <div class="item-head">
                  <span class="item-name">${st.name} ${item.plus > 0 ? `<strong style="color:#fbbf24">+${item.plus}</strong>` : ''}</span>
                  <span class="rarity-tag ${st.rarity}">${RARITY_INFO[st.rarity].label}</span>
                </div>
                <div class="item-meta">現在 DEF ${st.def} / HP +${st.maxHp} / MP +${st.maxMp}</div>
                <div class="item-actions">
                  ${cost.maxReached
                    ? `<button class="btn-ghost btn-sm" disabled>★ MAX (+10)</button>`
                    : `<button class="btn-neon ${canAfford ? 'btn-accent' : 'btn-ghost'} btn-sm" data-forge-a="${item.id}">+${item.plus + 1} 強化 (${cost.gold}G / ${oreMeta.icon}${cost.oreCount})</button>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      this.el.facilityBody.onclick = (e) => {
        const fw = e.target.closest('[data-forge-w]');
        const fa = e.target.closest('[data-forge-a]');
        if (!fw && !fa) return;
        const list = fw ? p.weapons : p.armors;
        const targetId = fw ? fw.dataset.forgeW : fa.dataset.forgeA;
        const item = list.find((x) => x.id === targetId);
        if (!item) return;
        const cost = getForgeCost(item.plus);
        if (cost.maxReached) return;
        if (p.gold < cost.gold || (p.ores[cost.oreType] || 0) < cost.oreCount) {
          g.addToast('ゴールドまたは鉱石が足りません！');
          return;
        }
        p.gold -= cost.gold;
        p.ores[cost.oreType] -= cost.oreCount;
        item.plus += 1;
        g.audio.playSe('forge');
        g.addToast(`⚒ 鍛冶成功！ +${item.plus} に強化されました！`);
        if (item.plus >= 3) g.unlockAchievement('forge_3');
        if (item.plus >= 7) g.unlockAchievement('forge_7');
        g.autoSave();
        this.renderFacility('blacksmith');
      };
    } else if (type === 'inn') {
      const fee = p.level <= 3 ? 0 : Math.min(120, p.level * 12);
      this.el.facilityEyebrow.textContent = 'LUMINA REST INN';
      this.el.facilityTitle.textContent = '🌙 宿屋（HP/MP全回復＆セーブ）';
      this.el.facilityBody.innerHTML = `
        <div class="item-card">
          <p class="muted">ふかふかのネオンベッドでゆっくり休んで、HP・MP・状態異常を完全回復します。（オートセーブも実行されます）</p>
          <p><strong>宿泊料金：${fee === 0 ? '無料（初心者応援！）' : `${fee} G`}</strong></p>
          <button id="btn-inn-rest" class="btn-neon btn-primary" type="button">🌙 休んで完全回復する</button>
        </div>
      `;
      document.getElementById('btn-inn-rest').onclick = () => {
        if (p.gold < fee) { g.addToast('ゴールドが足りません！'); return; }
        p.gold -= fee;
        p.fullRestore();
        g.audio.playSe('heal');
        g.autoSave();
        g.addToast('✨ HP・MPが全回復しました！（オートセーブ完了）');
        this.closeModals();
      };
    } else if (type === 'drone') {
      const ds = p.getDroneStats();
      const cost = getDroneUpgradeCost(p.droneLevel);
      const oreMeta = ORES[cost.oreType];
      this.el.facilityEyebrow.textContent = 'AUTONOMOUS BUDDY LAB';
      this.el.facilityTitle.textContent = '🤖 ドローン工房（相棒強化）';
      this.el.facilityBody.innerHTML = `
        <div class="stat-summary-grid">
          <div class="stat-box"><div class="stat-box-label">現在レベル</div><div class="stat-box-val">Lv.${ds.level} / 5</div></div>
          <div class="stat-box"><div class="stat-box-label">援護レーザー威力</div><div class="stat-box-val">${ds.damage}</div></div>
          <div class="stat-box"><div class="stat-box-label">射撃間隔</div><div class="stat-box-val">${ds.cooldown.toFixed(2)}秒</div></div>
          <div class="stat-box"><div class="stat-box-label">アイテム自動吸引範囲</div><div class="stat-box-val">${ds.magnetRadius}px</div></div>
        </div>
        <div class="item-card">
          <div class="item-meta">
            Lv.4以上で<strong>ツインレーザー砲</strong>が解放され、Lv.5で黄金の究極ドローンへ進化します！<br/>
            所持鉱石：🔹${p.ores.stardust} / 🔸${p.ores.prism} / 💠${p.ores.void}
          </div>
          <div class="item-actions">
            ${cost.maxReached
              ? `<button class="btn-ghost" disabled>★ ドローン性能 MAX！</button>`
              : `<button id="btn-drone-up" class="btn-neon btn-primary" type="button">Lv.${p.droneLevel + 1} へ強化 (${cost.gold}G / ${oreMeta.icon}${cost.oreCount})</button>`}
          </div>
        </div>
      `;
      const btn = document.getElementById('btn-drone-up');
      if (btn) {
        btn.onclick = () => {
          if (p.gold < cost.gold || (p.ores[cost.oreType] || 0) < cost.oreCount) {
            g.addToast('ゴールドまたは鉱石が足りません！');
            return;
          }
          p.gold -= cost.gold;
          p.ores[cost.oreType] -= cost.oreCount;
          p.droneLevel += 1;
          g.audio.playSe('levelup');
          g.addToast(`🤖 相棒ドローンが Lv.${p.droneLevel} に進化しました！`);
          if (p.droneLevel >= 5) g.unlockAchievement('drone_max');
          g.autoSave();
          this.renderFacility('drone');
        };
      }
    }
  }

  // ==========================================================================
  // FAST TRAVEL WARP MODAL
  // ==========================================================================
  openWarpModal() {
    this.isModalOpen = true;
    this.el.modalFacility.classList.remove('hidden');
    this.el.facilityEyebrow.textContent = 'FAST TRAVEL GATE';
    this.el.facilityTitle.textContent = '🌀 次元ワープ（ファストトラベル）';
    this.el.facilityGold.textContent = 'FREE WARP';

    const g = this.game;
    const cards = AREAS.map((a) => {
      let unlocked = a.id === 'town' || g.progress.visitedAreas.has(a.id);
      let lockMsg = '未到達エリア';
      if (a.id === 'tower') {
        unlocked = g.progress.gameCleared;
        lockMsg = 'ラスボス撃破後に解放';
      } else if (a.id === 'secret') {
        unlocked = g.progress.visitedAreas.has('secret') || g.progress.defeatedBosses.size >= 3 || g.progress.brokenWalls.size >= 2;
        lockMsg = 'ボス3体撃破 or 隠し壁2箇所破壊で解放';
      }
      const isHere = g.currentAreaId === a.id;
      return `
        <div class="item-card ${isHere ? 'equipped' : ''}">
          <div class="item-head">
            <span class="item-name">${a.name}</span>
            <span class="rarity-tag ${unlocked ? 'rare' : 'common'}">${a.code}</span>
          </div>
          <div class="item-meta">推奨Lv.${a.recLevel} ${a.darkness ? ' / 🔦暗闇ダンジョン' : ''}${a.id === 'tower' ? ` / 最高到達: ${g.progress.bestTowerFloor}F` : ''}</div>
          <div class="item-actions">
            ${unlocked
              ? `<button class="btn-neon ${isHere ? 'btn-ghost' : 'btn-cyber'} btn-sm" data-warp-area="${a.id}">${a.id === 'tower' ? '1階から挑戦！' : isHere ? '入口へ再転送' : 'ここへワープ'}</button>`
              : `<button class="btn-ghost btn-sm" disabled>🔒 ${lockMsg}</button>`}
          </div>
        </div>
      `;
    }).join('');

    this.el.facilityBody.innerHTML = `<div class="card-grid">${cards}</div>`;
    this.el.facilityBody.onclick = (e) => {
      const btn = e.target.closest('[data-warp-area]');
      if (!btn) return;
      const areaId = btn.dataset.warpArea;
      g.audio.playSe('revive');
      this.closeModals();
      if (areaId === 'tower') {
        g.enterEndlessTower(1);
      } else {
        g.changeArea(areaId);
      }
    };
  }

  // ==========================================================================
  // CONTROLS GUIDE MODAL (from Title Screen)
  // ==========================================================================
  openControlsGuide() {
    this.isModalOpen = true;
    this.el.modalFacility.classList.remove('hidden');
    this.el.facilityEyebrow.textContent = 'HOW TO PLAY — LUMINA DIORAMA';
    this.el.facilityTitle.textContent = '🎮 操作ガイド ＆ 冒険のヒント';
    this.el.facilityGold.textContent = '製作者：駿';
    this.el.facilityBody.innerHTML = `
      <div class="card-grid">
        <div class="item-card">
          <div class="item-head"><span class="item-name">📱 iPad / タッチ操作</span></div>
          <div class="item-meta">
            ・画面左側（左利き設定時は右側）のどこでも触ると<strong>フローティングスティック</strong>が出現！<br/>
            ・<strong>攻撃</strong>：連打で3連コンボ！<br/>
            ・<strong>回避</strong>：無敵フレーム付き高速ダッシュ<br/>
            ・<strong>魔法 / 切替</strong>：5種の属性・補助魔法を自在に発動<br/>
            ・<strong>必殺</strong>：ゲージ100%でジョブ究極奥義！<br/>
            ・<strong>調べる</strong>：NPC会話 / 宝箱 / 祭壇 / 味方の長押し蘇生！
          </div>
        </div>
        <div class="item-card">
          <div class="item-head"><span class="item-name">⌨️ PC キーボード＆マウス</span></div>
          <div class="item-meta">
            ・<strong>WASD / 矢印</strong>：移動<br/>
            ・<strong>Space / J / 左クリック</strong>：攻撃コンボ<br/>
            ・<strong>Shift / K / 右クリック</strong>：無敵ダッシュ回避<br/>
            ・<strong>E / L</strong>：魔法発動（<strong>Q / 1〜5</strong>で切替）<br/>
            ・<strong>R / U</strong>：リミット必殺技<br/>
            ・<strong>F / Enter</strong>：調べる・会話・長押し蘇生<br/>
            ・<strong>M</strong>：ワープ / <strong>Esc</strong>：メニュー
          </div>
        </div>
        <div class="item-card">
          <div class="item-head"><span class="item-name">🌐 4人オンライン協力プレイ</span></div>
          <div class="item-meta">
            ・「🌐 協力」から合言葉（4〜6文字）を発行または入力するだけで最大4人リアルタイム協力！<br/>
            ・敵の強さはソロ基準のまま無双バランス！<br/>
            ・回復・バフは味方全員に効果あり。戦闘不能の味方は近づいて<strong>長押し蘇生（レスキュー）</strong>！
          </div>
        </div>
        <div class="item-card">
          <div class="item-head"><span class="item-name">💎 探索＆ボス攻略のコツ</span></div>
          <div class="item-meta">
            ・光るヒビが入った壁は3回攻撃で壊せる<strong>隠し部屋</strong>！<br/>
            ・ボス戦は周囲の<strong>守護クリスタル</strong>を全て壊すと無敵シールドが崩壊します。<br/>
            ・HP50%以下でボスが<strong>第2形態</strong>へ覚醒！赤い予兆円＆レーザーを回避しよう！
          </div>
        </div>
      </div>
    `;
    this.el.facilityBody.onclick = null;
  }

  openSaveModalFromTitle() {
    this.isModalOpen = true;
    this.el.modalFacility.classList.remove('hidden');
    this.el.facilityEyebrow.textContent = 'SAVE DATA MANAGER';
    this.el.facilityTitle.textContent = '💾 セーブデータのロード ＆ バックアップ';
    this.el.facilityGold.textContent = 'LOCAL STORAGE';
    this.el.facilityBody.innerHTML = this._buildSaveManagerHtml(true);
    this._bindSaveManagerEvents(this.el.facilityBody, true);
  }

  // ==========================================================================
  // MAIN IN-GAME MENU (7 FULL TABS)
  // ==========================================================================
  openMenu(tab = 'equip') {
    this.isModalOpen = true;
    this.activeMenuTab = tab;
    this.el.modalMenu.classList.remove('hidden');
    this.renderMenuTab();
  }

  renderMenuTab() {
    const btns = this.el.menuTabs.querySelectorAll('.tab-btn');
    btns.forEach((b) => b.classList.toggle('active', b.dataset.tab === this.activeMenuTab));

    const g = this.game;
    const p = g.player;
    const st = p.getStats();
    const out = this.el.menuTabContent;

    if (this.activeMenuTab === 'equip') {
      out.innerHTML = `
        <div class="stat-summary-grid">
          <div class="stat-box"><div class="stat-box-label">ジョブ / Lv</div><div class="stat-box-val">${p.getJob().name} Lv.${p.level}</div></div>
          <div class="stat-box"><div class="stat-box-label">最大HP / MP</div><div class="stat-box-val">${st.maxHp} / ${st.maxMp}</div></div>
          <div class="stat-box"><div class="stat-box-label">攻撃力 / 魔力</div><div class="stat-box-val">${st.atk} / ${st.mag}</div></div>
          <div class="stat-box"><div class="stat-box-label">防御 / 速度 / 会心</div><div class="stat-box-val">${st.def} / ${st.spd} / ${Math.round(st.crit * 100)}%</div></div>
          <div class="stat-box"><div class="stat-box-label">鉱石 (星/輝/虚)</div><div class="stat-box-val">${p.ores.stardust} / ${p.ores.prism} / ${p.ores.void}</div></div>
          <div class="stat-box"><div class="stat-box-label">ステータスコア</div><div class="stat-box-val">💚${p.cores.vital} 💙${p.cores.ether} ❤️${p.cores.power} 💛${p.cores.crit}</div></div>
        </div>
        <div class="section-heading"><span>⚔ 所持武器（タップで装備切替）</span></div>
        <div class="card-grid">
          ${p.weapons.map((w) => {
            const ws = calcWeaponStats(w.id, w.plus);
            const eq = p.equippedWeapon === w.id;
            const sellVal = Math.round(ws.price * 0.45 * (1 + w.plus * 0.2));
            return `
              <div class="item-card rarity-${ws.rarity} ${eq ? 'equipped' : ''}">
                <div class="item-head">
                  <span class="item-name">${ws.name} ${w.plus > 0 ? `<strong style="color:#fbbf24">+${w.plus}</strong>` : ''}</span>
                  <span class="rarity-tag ${ws.rarity}">${RARITY_INFO[ws.rarity].label}</span>
                </div>
                <div class="item-meta">ATK +${ws.atk} / MAG +${ws.mag} / CRIT +${Math.round(ws.crit * 100)}% / 属性:${ELEMENT_INFO[ws.element].icon}${ELEMENT_INFO[ws.element].name}</div>
                <div class="item-actions">
                  ${eq
                    ? `<button class="btn-ghost btn-sm" disabled>✓ 装備中</button>`
                    : `<button class="btn-neon btn-primary btn-sm" data-eq-w="${w.id}">装備する</button>
                       <button class="btn-danger btn-sm" data-sell-w="${w.id}">売却 (+${sellVal}G)</button>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="section-heading"><span>🛡 所持防具</span></div>
        <div class="card-grid">
          ${p.armors.map((a) => {
            const as = calcArmorStats(a.id, a.plus);
            const eq = p.equippedArmor === a.id;
            const sellVal = Math.round(as.price * 0.45 * (1 + a.plus * 0.2));
            return `
              <div class="item-card rarity-${as.rarity} ${eq ? 'equipped' : ''}">
                <div class="item-head">
                  <span class="item-name">${as.name} ${a.plus > 0 ? `<strong style="color:#fbbf24">+${a.plus}</strong>` : ''}</span>
                  <span class="rarity-tag ${as.rarity}">${RARITY_INFO[as.rarity].label}</span>
                </div>
                <div class="item-meta">DEF +${as.def} / HP +${as.maxHp} / MP +${as.maxMp} / SPD +${as.spd}</div>
                <div class="item-actions">
                  ${eq
                    ? `<button class="btn-ghost btn-sm" disabled>✓ 装備中</button>`
                    : `<button class="btn-neon btn-primary btn-sm" data-eq-a="${a.id}">装備する</button>
                       <button class="btn-danger btn-sm" data-sell-a="${a.id}">売却 (+${sellVal}G)</button>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      out.onclick = (e) => {
        const ew = e.target.closest('[data-eq-w]');
        const ea = e.target.closest('[data-eq-a]');
        const sw = e.target.closest('[data-sell-w]');
        const sa = e.target.closest('[data-sell-a]');
        if (ew) {
          p.equippedWeapon = ew.dataset.eqW;
          g.audio.playSe('uiClick');
          this.renderMenuTab();
        } else if (ea) {
          p.equippedArmor = ea.dataset.eqA;
          g.audio.playSe('uiClick');
          this.renderMenuTab();
        } else if (sw) {
          const idx = p.weapons.findIndex((x) => x.id === sw.dataset.sellW);
          if (idx >= 0 && p.weapons[idx].id !== p.equippedWeapon) {
            const ws = calcWeaponStats(p.weapons[idx].id, p.weapons[idx].plus);
            const val = Math.round(ws.price * 0.45 * (1 + p.weapons[idx].plus * 0.2));
            p.weapons.splice(idx, 1);
            p.gold += val;
            g.audio.playSe('coin');
            g.addToast(`💰 ${ws.name} を ${val}G で売却しました`);
            this.renderMenuTab();
          }
        } else if (sa) {
          const idx = p.armors.findIndex((x) => x.id === sa.dataset.sellA);
          if (idx >= 0 && p.armors[idx].id !== p.equippedArmor) {
            const as = calcArmorStats(p.armors[idx].id, p.armors[idx].plus);
            const val = Math.round(as.price * 0.45 * (1 + p.armors[idx].plus * 0.2));
            p.armors.splice(idx, 1);
            p.gold += val;
            g.audio.playSe('coin');
            g.addToast(`💰 ${as.name} を ${val}G で売却しました`);
            this.renderMenuTab();
          }
        }
      };
    } else if (this.activeMenuTab === 'magic') {
      const ds = p.getDroneStats();
      out.innerHTML = `
        <div class="section-heading"><span>🔮 習得済み魔法（タップでセット）</span></div>
        <div class="card-grid">
          ${SPELLS.map((sp) => {
            const lv = p.spells[sp.id] || 0;
            const active = p.activeSpell === sp.id;
            return `
              <div class="item-card ${active ? 'equipped' : ''}">
                <div class="item-head">
                  <span class="item-name">${sp.icon} ${sp.name}</span>
                  <span class="rarity-tag ${lv > 0 ? 'rare' : 'common'}">${lv > 0 ? `Lv.${lv}` : '未習得'}</span>
                </div>
                <div class="item-meta">消費MP: ${sp.mpCost} / 属性: ${ELEMENT_INFO[sp.element].name}<br/>${sp.desc}</div>
                <div class="item-actions">
                  ${lv > 0
                    ? `<button class="btn-neon ${active ? 'btn-ghost' : 'btn-cyber'} btn-sm" data-set-spell="${sp.id}">${active ? '✓ セット中' : 'この魔法を使う'}</button>`
                    : `<span class="muted">拠点の「魔法屋」で習得できます</span>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="section-heading"><span>🤖 自律型サポートドローン</span></div>
        <div class="item-card">
          <div class="item-head"><span class="item-name">相棒ドローン Lv.${ds.level} / 5</span><span class="rarity-tag epic">${ds.twinBeam ? 'TWIN LASER' : 'PULSE LASER'}</span></div>
          <div class="item-meta">自動で周囲の敵にレーザー援護射撃（威力 ${ds.damage}）を行い、半径 ${ds.magnetRadius}px 以内のゴールド・鉱石・装備ドロップを自動吸引回収します。拠点の「ドローン工房」でさらに強化可能！</div>
        </div>
      `;
      out.onclick = (e) => {
        const btn = e.target.closest('[data-set-spell]');
        if (!btn) return;
        p.activeSpell = btn.dataset.setSpell;
        g.audio.playSe('uiClick');
        this.renderMenuTab();
      };
    } else if (this.activeMenuTab === 'monsters') {
      const allEntries = [...Object.values(ENEMIES), ...Object.values(BOSSES)];
      const seenCount = allEntries.filter((m) => (g.progress.monsterKills[m.id] || 0) > 0).length;
      out.innerHTML = `
        <div class="section-heading"><span>📖 モンスター図鑑（登録率：${Math.round((seenCount / allEntries.length) * 100)}% — ${seenCount}/${allEntries.length}）</span></div>
        <div class="card-grid">
          ${allEntries.map((m) => {
            const kills = g.progress.monsterKills[m.id] || 0;
            const isBoss = m.id.startsWith('boss_');
            const weak = ELEMENT_INFO[m.weakness] || ELEMENT_INFO.none;
            return `
              <div class="item-card ${isBoss ? 'rarity-legendary' : ''}">
                <div class="item-head">
                  <span class="item-name" style="color:${kills > 0 ? m.color : '#64748b'}">${kills > 0 ? m.name : '？？？'}</span>
                  <span class="rarity-tag ${isBoss ? 'legendary' : 'rare'}">${isBoss ? 'BOSS' : `撃破 ${kills}`}</span>
                </div>
                <div class="item-meta">
                  ${kills > 0
                    ? `撃破数: <strong>${kills}</strong> / 弱点: <strong>${weak.icon}${weak.name}</strong> / HP ${m.hp}<br/>${m.lore}`
                    : `未発見の${isBoss ? 'ボス' : 'モンスター'}。各エリアを探索して撃破しよう！`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      out.onclick = null;
    } else if (this.activeMenuTab === 'collection') {
      const total = WEAPONS.length + ARMORS.length + SPELLS.length;
      const got = g.progress.discoveredWeapons.size + g.progress.discoveredArmors.size + g.progress.discoveredSpells.size;
      out.innerHTML = `
        <div class="section-heading"><span>✨ 武器・防具・魔法コレクション率：${Math.round((got / total) * 100)}% (${got}/${total})</span></div>
        <div class="section-heading"><span>⚔ 武器図鑑 (${g.progress.discoveredWeapons.size}/${WEAPONS.length})</span></div>
        <div class="card-grid">
          ${WEAPONS.map((w) => {
            const has = g.progress.discoveredWeapons.has(w.id);
            return `
              <div class="item-card ${has ? `rarity-${w.rarity}` : ''}">
                <div class="item-head">
                  <span class="item-name">${has ? w.name : '？？？（未入手）'}</span>
                  <span class="rarity-tag ${w.rarity}">${RARITY_INFO[w.rarity].label}</span>
                </div>
                <div class="item-meta">${has ? `ATK +${w.atk} / MAG +${w.mag} / ${w.desc}` : 'ショップ・宝箱・ハクスラドロップで発見しよう！'}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="section-heading"><span>🛡 防具図鑑 (${g.progress.discoveredArmors.size}/${ARMORS.length})</span></div>
        <div class="card-grid">
          ${ARMORS.map((a) => {
            const has = g.progress.discoveredArmors.has(a.id);
            return `
              <div class="item-card ${has ? `rarity-${a.rarity}` : ''}">
                <div class="item-head">
                  <span class="item-name">${has ? a.name : '？？？（未入手）'}</span>
                  <span class="rarity-tag ${a.rarity}">${RARITY_INFO[a.rarity].label}</span>
                </div>
                <div class="item-meta">${has ? `DEF +${a.def} / HP +${a.maxHp} / ${a.desc}` : 'ショップ・宝箱・ハクスラドロップで発見しよう！'}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      out.onclick = null;
    } else if (this.activeMenuTab === 'achievements') {
      const got = g.progress.achievements.size;
      out.innerHTML = `
        <div class="section-heading"><span>🏆 実績トロフィー（達成率：${Math.round((got / ACHIEVEMENTS.length) * 100)}% — ${got}/${ACHIEVEMENTS.length}）</span></div>
        <div class="card-grid">
          ${ACHIEVEMENTS.map((a) => {
            const unlocked = g.progress.achievements.has(a.id);
            return `
              <div class="item-card ${unlocked ? 'rarity-legendary' : ''}" style="opacity:${unlocked ? 1 : 0.55}">
                <div class="item-head">
                  <span class="item-name">${a.icon} ${a.title}</span>
                  <span class="rarity-tag ${unlocked ? 'legendary' : 'common'}">${unlocked ? '達成済' : '未達成'}</span>
                </div>
                <div class="item-meta">${a.desc}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      out.onclick = null;
    } else if (this.activeMenuTab === 'settings') {
      const s = g.settings;
      out.innerHTML = `
        <div class="section-heading"><span>🎛️ iPad タッチUI カスタマイズ</span></div>
        <div class="setting-row">
          <div><div class="setting-label">ボタンサイズ</div><div class="setting-sub">iPadや大画面に合わせてタッチボタンの大きさを変更</div></div>
          <div class="seg-group">
            <button type="button" class="seg-btn ${s.buttonSize === 'standard' ? 'active' : ''}" data-set-size="standard">標準</button>
            <button type="button" class="seg-btn ${s.buttonSize === 'large' ? 'active' : ''}" data-set-size="large">大きめ</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">レイアウト配置（左右反転）</div><div class="setting-sub">スティックとアクションボタンを左右反転します</div></div>
          <div class="seg-group">
            <button type="button" class="seg-btn ${s.handedness === 'right' ? 'active' : ''}" data-set-hand="right">右利き（標準）</button>
            <button type="button" class="seg-btn ${s.handedness === 'left' ? 'active' : ''}" data-set-hand="left">左利き（反転）</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">バーチャルタッチUI表示</div><div class="setting-sub">PCプレイ時に非表示、または常に表示を選択</div></div>
          <div class="seg-group">
            <button type="button" class="seg-btn ${s.touchMode === 'auto' ? 'active' : ''}" data-set-touch="auto">自動</button>
            <button type="button" class="seg-btn ${s.touchMode === 'always' ? 'active' : ''}" data-set-touch="always">常に表示</button>
            <button type="button" class="seg-btn ${s.touchMode === 'hide' ? 'active' : ''}" data-set-touch="hide">非表示</button>
          </div>
        </div>

        <div class="section-heading"><span>🎵 プロシージャル音響設定 (Web Audio API)</span></div>
        <div class="setting-row">
          <div><div class="setting-label">BGM 音量</div><div class="setting-sub">シンセBGMのボリューム</div></div>
          <input id="rng-bgm" type="range" min="0" max="100" value="${Math.round(s.bgmVolume * 100)}" />
        </div>
        <div class="setting-row">
          <div><div class="setting-label">SE（効果音）音量</div><div class="setting-sub">剣撃・魔法・通知音のボリューム</div></div>
          <input id="rng-se" type="range" min="0" max="100" value="${Math.round(s.seVolume * 100)}" />
        </div>

        ${g.progress.gameCleared ? `
          <div class="section-heading"><span>👑 クリア後やり込みモード</span></div>
          <div class="setting-row">
            <div><div class="setting-label">強くてニューゲーム（${g.progress.ngPlus + 1}周目）</div><div class="setting-sub">Lv・装備・図鑑・実績を引き継いで強化された世界を再冒険！</div></div>
            <button type="button" id="btn-menu-ngplus" class="btn-neon btn-accent btn-sm">2周目を開始</button>
          </div>
        ` : ''}
      `;

      out.onclick = (e) => {
        const sz = e.target.closest('[data-set-size]');
        const hd = e.target.closest('[data-set-hand]');
        const tm = e.target.closest('[data-set-touch]');
        if (sz) {
          g.settings.buttonSize = sz.dataset.setSize;
          g.persistSettings();
          this.applySettingsToDOM(g.settings);
          this.renderMenuTab();
        } else if (hd) {
          g.settings.handedness = hd.dataset.setHand;
          g.persistSettings();
          this.applySettingsToDOM(g.settings);
          this.renderMenuTab();
        } else if (tm) {
          g.settings.touchMode = tm.dataset.setTouch;
          g.persistSettings();
          this.applySettingsToDOM(g.settings);
          this.renderMenuTab();
        }
      };

      const rngBgm = document.getElementById('rng-bgm');
      const rngSe = document.getElementById('rng-se');
      if (rngBgm) {
        rngBgm.oninput = () => {
          g.settings.bgmVolume = Number(rngBgm.value) / 100;
          g.audio.setBgmVolume(g.settings.bgmVolume);
          g.persistSettings();
        };
      }
      if (rngSe) {
        rngSe.oninput = () => {
          g.settings.seVolume = Number(rngSe.value) / 100;
          g.audio.setSeVolume(g.settings.seVolume);
          g.persistSettings();
        };
      }
      const btnNg = document.getElementById('btn-menu-ngplus');
      if (btnNg) {
        btnNg.onclick = () => {
          this.closeModals();
          g.startNewGamePlus();
        };
      }
    } else if (this.activeMenuTab === 'save') {
      out.innerHTML = this._buildSaveManagerHtml(false);
      this._bindSaveManagerEvents(out, false);
    }
  }

  _buildSaveManagerHtml(titleMode) {
    const all = listAllSaves();
    const renderCard = (label, key, data, canSave) => {
      if (!data) {
        return `
          <div class="item-card">
            <div class="item-head"><span class="item-name">${label}</span><span class="rarity-tag common">空き</span></div>
            <div class="item-meta">セーブデータはありません。</div>
            <div class="item-actions">
              ${canSave ? `<button class="btn-neon btn-primary btn-sm" data-save-slot="${key}">ここにセーブ</button>` : ''}
            </div>
          </div>
        `;
      }
      const area = getAreaById(data.areaId);
      const job = JOBS[data.player.jobId] || JOBS.knight;
      const dateStr = new Date(data.savedAt || Date.now()).toLocaleString('ja-JP');
      return `
        <div class="item-card rarity-rare">
          <div class="item-head"><span class="item-name">${label}</span><span class="rarity-tag rare">Lv.${data.player.level}</span></div>
          <div class="item-meta">
            <strong>${escHtml(data.player.name)}</strong> (${job.name})<br/>
            場所: ${area.name} / 所持金: ${data.player.gold}G / 時間: ${formatPlayTime(data.progress.stats?.playTime)}<br/>
            日時: ${dateStr}
          </div>
          <div class="item-actions">
            ${canSave ? `<button class="btn-neon btn-primary btn-sm" data-save-slot="${key}">上書きセーブ</button>` : ''}
            <button class="btn-neon btn-cyber btn-sm" data-load-slot="${key}">ロード</button>
            <button class="btn-danger btn-sm" data-del-slot="${key}">削除</button>
          </div>
        </div>
      `;
    };

    return `
      <div class="section-heading"><span>💾 セーブスロット（オートセーブ＋手動3スロット）</span></div>
      <div class="card-grid">
        ${renderCard('オートセーブ (自動保護)', 'auto', all.auto, false)}
        ${all.slots.map((s) => renderCard(`スロット ${s.index}`, String(s.index), s.data, !titleMode)).join('')}
      </div>
      <div class="section-heading"><span>📦 バックアップ書き出し / 読み込み (JSON)</span></div>
      <div class="item-card">
        <div class="item-meta">機種変更やブラウザデータ保護のため、セーブJSONを書き出し・復元できます。</div>
        <textarea id="save-backup-text" rows="3" placeholder="ここにバックアップJSONを貼り付けて復元..."></textarea>
        <div class="item-actions">
          ${!titleMode ? `<button type="button" id="btn-export-save" class="btn-ghost btn-sm">📤 現在のデータをJSON書き出し</button>` : ''}
          <button type="button" id="btn-import-save" class="btn-neon btn-accent btn-sm">📥 JSONから復元して開始</button>
        </div>
      </div>
    `;
  }

  _bindSaveManagerEvents(container, titleMode) {
    const g = this.game;
    container.onclick = (e) => {
      const sv = e.target.closest('[data-save-slot]');
      const ld = e.target.closest('[data-load-slot]');
      const dl = e.target.closest('[data-del-slot]');
      if (sv) {
        saveSlot(Number(sv.dataset.saveSlot), g);
        g.audio.playSe('coin');
        g.addToast(`💾 スロット ${sv.dataset.saveSlot} にセーブしました！`);
        this.renderMenuTab();
      } else if (ld) {
        const key = ld.dataset.loadSlot;
        const data = key === 'auto' ? loadAuto() : loadSlot(Number(key));
        if (data) {
          g.audio.playSe('levelup');
          this.closeModals();
          g.startFromSave(data);
        }
      } else if (dl) {
        const key = dl.dataset.delSlot;
        deleteSlot(key === 'auto' ? 'auto' : Number(key));
        g.audio.playSe('uiClick');
        g.addToast('セーブデータを削除しました');
        if (titleMode) this.openSaveModalFromTitle();
        else this.renderMenuTab();
      }
    };

    const btnExp = container.querySelector('#btn-export-save');
    const btnImp = container.querySelector('#btn-import-save');
    const txt = container.querySelector('#save-backup-text');
    if (btnExp && txt) {
      btnExp.onclick = () => {
        const json = exportSaveJson(g);
        txt.value = json;
        if (navigator.clipboard) navigator.clipboard.writeText(json).catch(() => {});
        g.addToast('📤 バックアップJSONを出力＆コピーしました！');
      };
    }
    if (btnImp && txt) {
      btnImp.onclick = () => {
        const parsed = parseImportedSave(txt.value);
        if (!parsed) {
          g.addToast('⚠ 無効なセーブJSON形式です');
          return;
        }
        g.audio.playSe('levelup');
        this.closeModals();
        g.startFromSave(parsed);
        g.addToast('📥 バックアップから復元しました！');
      };
    }
  }

  // ==========================================================================
  // DEFEAT & ENDING + CLEAR RANK (S / A / B / C)
  // ==========================================================================
  showDefeat(goldLost) {
    this.isModalOpen = true;
    this.el.defeatGoldLoss.textContent = `-${goldLost.toLocaleString()} G (所持金が半分になりました)`;
    this.el.screenDefeat.classList.remove('hidden');
  }

  showEnding() {
    const g = this.game;
    const stats = g.progress.stats;
    const deaths = stats.deaths || 0;
    const secrets = g.progress.brokenWalls.size;
    const maxCombo = stats.maxCombo || 0;
    const bosses = g.progress.defeatedBosses.size;

    // Score Clear Rank S / A / B / C
    let score = 100;
    score -= deaths * 18;
    score += secrets * 10;
    score += Math.min(20, Math.floor(maxCombo / 5));
    score += bosses * 4;

    let rank = 'C';
    if (score >= 112 && deaths <= 1) rank = 'S';
    else if (score >= 88) rank = 'A';
    else if (score >= 60) rank = 'B';

    this.el.endingRankLetter.textContent = rank;
    this.el.endingStats.innerHTML = `
      <div>クリアタイム：<strong>${formatPlayTime(stats.playTime)}</strong></div>
      <div>撃破モンスター：<strong>${stats.totalKills || 0} 体</strong></div>
      <div>最大コンボ：<strong>${maxCombo} HIT</strong></div>
      <div>全滅回数：<strong>${deaths} 回</strong></div>
      <div>隠し部屋発見：<strong>${secrets} 箇所</strong></div>
      <div>達成実績：<strong>${g.progress.achievements.size}/${ACHIEVEMENTS.length}</strong></div>
    `;

    this.isModalOpen = true;
    this.el.screenEnding.classList.remove('hidden');
  }
}
