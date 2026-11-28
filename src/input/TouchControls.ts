import type { TouchControlsMode } from '../types/botw';

export interface TouchControlsCallbacks {
  onCameraLook: (dx: number, dy: number) => void;
  onAttack: (isChargedSpin: boolean) => void;
  onJumpOrGlide: () => void;
  onDodge: () => void;
  onGuardStart: () => void;
  onToggleZL: () => void;
  onActivateRune: () => void;
  onBowRelease: () => void;
  onInteract: () => void;
  onFirstGesture: () => void;
}

export interface TouchInputSnapshot {
  moveX: number;
  moveY: number;
  sprint: boolean;
  guard: boolean;
  aimBow: boolean;
}

export function isTouchCapableDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    navigator.maxTouchPoints > 0 ||
    'ontouchstart' in window ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
  );
}

/**
 * Full multi-touch iPad / tablet / mobile controller with strict `pointerId` isolation:
 * - Bottom-left floating analog movement stick (`setPointerCapture`)
 * - Full screen right/upper 360° camera drag look zone (zero blind spots)
 * - Ergonomic bottom-right BotW action buttons (Attack/Hold Charge, Jump/Paraglider, Dash/Dodge,
 *   Shield Guard, ZL Lock-on, Sheikah Rune, Bow Aim/Release, Context Interact)
 * - Buttons NEVER cancel on `pointerleave` (strict `setPointerCapture` + `pointerup`/`pointercancel`)
 * - Simultaneous movement + camera rotation + action holds/taps work seamlessly
 */
export class TouchControls {
  private readonly cb: TouchControlsCallbacks;
  private mode: TouchControlsMode = 'auto';
  private blocked = true;
  private audioUnlocked = false;

  // Continuous analog/hold state read every frame by BotWGameEngine
  public readonly state: TouchInputSnapshot = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    guard: false,
    aimBow: false,
  };

  // Strict pointerId slots (each finger owns its own independent control!)
  private stickPointerId: number | null = null;
  private stickOriginX = 0;
  private stickOriginY = 0;
  private readonly stickMaxRadius = 52;

  private lookPointerId: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;

  private attackPointerId: number | null = null;
  private attackDownMs = 0;
  private attackChargeTimer: number | null = null;

  private dashPointerId: number | null = null;
  private dashDownMs = 0;

  private guardPointerId: number | null = null;
  private bowPointerId: number | null = null;

  // DOM elements
  private rootEl!: HTMLElement;
  private lookZoneEl!: HTMLElement;
  private stickZoneEl!: HTMLElement;
  private stickBaseEl!: HTMLElement;
  private stickKnobEl!: HTMLElement;
  private btnAttack!: HTMLButtonElement;
  private btnJump!: HTMLButtonElement;
  private btnDash!: HTMLButtonElement;
  private btnGuard!: HTMLButtonElement;
  private btnZL!: HTMLButtonElement;
  private btnRune!: HTMLButtonElement;
  private btnBow!: HTMLButtonElement;
  private btnInteract!: HTMLButtonElement;

  constructor(callbacks: TouchControlsCallbacks) {
    this.cb = callbacks;
    this.mountDom();
    this.bindGestureAudioUnlock();
    this.bindPointerEvents();
    this.syncVisibility();
  }

  private mountDom(): void {
    const host = document.getElementById('ui-root') ?? document.body;
    const layer = document.createElement('div');
    layer.id = 'touch-controls-layer';
    layer.className = 'touch-controls-layer hidden';
    layer.innerHTML = `
      <div id="touch-look-zone" class="touch-look-zone" aria-label="視点操作エリア"></div>

      <div id="touch-stick-zone" class="touch-stick-zone" aria-label="移動スティック">
        <div id="touch-stick-base" class="touch-stick-base">
          <div id="touch-stick-knob" class="touch-stick-knob"></div>
        </div>
      </div>

      <div id="touch-actions-cluster" class="touch-actions-cluster">
        <button id="tbtn-interact" class="touch-interact-pill hidden" type="button">✋ 調べる</button>

        <div class="touch-aux-row">
          <button id="tbtn-zl" class="touch-btn tiny" type="button" aria-label="ZL注目">
            <span class="tbtn-icon">🎯</span><span class="tbtn-label">注目</span>
          </button>
          <button id="tbtn-rune" class="touch-btn small cyan" type="button" aria-label="シーカーストーン発動">
            <span class="tbtn-icon">🔷</span><span class="tbtn-label">ルーン</span>
          </button>
          <button id="tbtn-bow" class="touch-btn small" type="button" aria-label="弓エイム">
            <span class="tbtn-icon">🏹</span><span class="tbtn-label">弓</span>
          </button>
        </div>

        <div class="touch-main-arc">
          <button id="tbtn-guard" class="touch-btn med" type="button" aria-label="盾ガード">
            <span class="tbtn-icon">🛡</span><span class="tbtn-label">盾</span>
          </button>
          <button id="tbtn-dash" class="touch-btn med" type="button" aria-label="ダッシュ・回避">
            <span class="tbtn-icon">💨</span><span class="tbtn-label">走/回避</span>
          </button>
          <button id="tbtn-jump" class="touch-btn med gold" type="button" aria-label="ジャンプ・パラセール">
            <span class="tbtn-icon">🪽</span><span class="tbtn-label">跳/滑空</span>
          </button>
          <button id="tbtn-attack" class="touch-btn primary-atk" type="button" aria-label="攻撃・長押し溜め">
            <span class="tbtn-charge-ring"></span>
            <span class="tbtn-icon">⚔</span><span class="tbtn-label">攻撃</span>
          </button>
        </div>
      </div>
    `;
    host.appendChild(layer);

    this.rootEl = layer;
    this.lookZoneEl = layer.querySelector('#touch-look-zone')!;
    this.stickZoneEl = layer.querySelector('#touch-stick-zone')!;
    this.stickBaseEl = layer.querySelector('#touch-stick-base')!;
    this.stickKnobEl = layer.querySelector('#touch-stick-knob')!;
    this.btnAttack = layer.querySelector('#tbtn-attack')!;
    this.btnJump = layer.querySelector('#tbtn-jump')!;
    this.btnDash = layer.querySelector('#tbtn-dash')!;
    this.btnGuard = layer.querySelector('#tbtn-guard')!;
    this.btnZL = layer.querySelector('#tbtn-zl')!;
    this.btnRune = layer.querySelector('#tbtn-rune')!;
    this.btnBow = layer.querySelector('#tbtn-bow')!;
    this.btnInteract = layer.querySelector('#tbtn-interact')!;
  }

  private bindGestureAudioUnlock(): void {
    const unlockOnce = () => {
      if (this.audioUnlocked) return;
      this.audioUnlocked = true;
      this.cb.onFirstGesture();
    };
    window.addEventListener('pointerdown', unlockOnce, { capture: true, passive: true });
    window.addEventListener('touchstart', unlockOnce, { capture: true, passive: true });
  }

  private bindPointerEvents(): void {
    // 1. Floating Left Analog Movement Stick (strict pointerId capture!)
    this.stickZoneEl.addEventListener('pointerdown', (e) => {
      if (this.blocked || !this.isVisible()) return;
      if (this.stickPointerId !== null) return;
      e.preventDefault();
      e.stopPropagation();

      this.stickPointerId = e.pointerId;
      this.safeSetCapture(this.stickZoneEl, e.pointerId);

      const zoneRect = this.stickZoneEl.getBoundingClientRect();
      const pad = 64;
      const localX = Math.max(pad, Math.min(zoneRect.width - pad, e.clientX - zoneRect.left));
      const localY = Math.max(pad, Math.min(zoneRect.height - pad, e.clientY - zoneRect.top));

      this.stickOriginX = zoneRect.left + localX;
      this.stickOriginY = zoneRect.top + localY;
      this.stickBaseEl.style.left = `${localX}px`;
      this.stickBaseEl.style.top = `${localY}px`;
      this.stickBaseEl.classList.add('active');
      this.updateStickVector(e.clientX, e.clientY);
    });

    this.stickZoneEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      e.preventDefault();
      this.updateStickVector(e.clientX, e.clientY);
    });

    const releaseStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return;
      e.preventDefault();
      this.safeReleaseCapture(this.stickZoneEl, e.pointerId);
      this.resetStick();
    };
    this.stickZoneEl.addEventListener('pointerup', releaseStick);
    this.stickZoneEl.addEventListener('pointercancel', releaseStick);

    // 2. Full-Viewport Right & Upper 360° Camera Look Pad (zero blind spots!)
    this.lookZoneEl.addEventListener('pointerdown', (e) => {
      if (this.blocked || !this.isVisible()) return;
      if (e.pointerType === 'mouse' && this.mode !== 'always') return;
      if (this.lookPointerId !== null) return;
      e.preventDefault();

      this.lookPointerId = e.pointerId;
      this.lookLastX = e.clientX;
      this.lookLastY = e.clientY;
      this.safeSetCapture(this.lookZoneEl, e.pointerId);
    });

    this.lookZoneEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointerId) return;
      e.preventDefault();
      const dx = e.clientX - this.lookLastX;
      const dy = e.clientY - this.lookLastY;
      this.lookLastX = e.clientX;
      this.lookLastY = e.clientY;
      this.cb.onCameraLook(dx, dy);
    });

    const releaseLook = (e: PointerEvent) => {
      if (e.pointerId !== this.lookPointerId) return;
      e.preventDefault();
      this.safeReleaseCapture(this.lookZoneEl, e.pointerId);
      this.lookPointerId = null;
    };
    this.lookZoneEl.addEventListener('pointerup', releaseLook);
    this.lookZoneEl.addEventListener('pointercancel', releaseLook);

    // 3. Attack / Hold-to-Charge Spin Attack (strict setPointerCapture; never breaks on pointerleave!)
    this.btnAttack.addEventListener('pointerdown', (e) => {
      if (this.blocked) return;
      if (this.attackPointerId !== null) return;
      e.preventDefault();
      e.stopPropagation();

      this.attackPointerId = e.pointerId;
      this.attackDownMs = performance.now();
      this.safeSetCapture(this.btnAttack, e.pointerId);
      this.btnAttack.classList.add('pressed');

      this.clearAttackChargeTimer();
      this.attackChargeTimer = window.setTimeout(() => {
        if (this.attackPointerId !== null) {
          this.btnAttack.classList.add('charging');
        }
      }, 170);
    });

    this.btnAttack.addEventListener('pointerup', (e) => {
      if (e.pointerId !== this.attackPointerId) return;
      e.preventDefault();
      e.stopPropagation();
      const heldMs = performance.now() - this.attackDownMs;
      this.safeReleaseCapture(this.btnAttack, e.pointerId);
      this.clearAttackState();
      this.cb.onAttack(heldMs >= 380);
    });

    this.btnAttack.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== this.attackPointerId) return;
      this.safeReleaseCapture(this.btnAttack, e.pointerId);
      this.clearAttackState();
    });

    // 4. Jump / Paraglider button
    this.bindTapButton(this.btnJump, () => this.cb.onJumpOrGlide());

    // 5. Dash / Dodge button (hold = sprint; crisp tap = dodge!)
    this.btnDash.addEventListener('pointerdown', (e) => {
      if (this.blocked) return;
      if (this.dashPointerId !== null) return;
      e.preventDefault();
      e.stopPropagation();

      this.dashPointerId = e.pointerId;
      this.dashDownMs = performance.now();
      this.state.sprint = true;
      this.safeSetCapture(this.btnDash, e.pointerId);
      this.btnDash.classList.add('pressed');
    });

    const releaseDash = (e: PointerEvent, allowTapDodge: boolean) => {
      if (e.pointerId !== this.dashPointerId) return;
      e.preventDefault();
      e.stopPropagation();
      const heldMs = performance.now() - this.dashDownMs;
      this.safeReleaseCapture(this.btnDash, e.pointerId);
      this.dashPointerId = null;
      this.state.sprint = false;
      this.btnDash.classList.remove('pressed');
      if (allowTapDodge && heldMs < 230) {
        this.cb.onDodge();
      }
    };
    this.btnDash.addEventListener('pointerup', (e) => releaseDash(e, true));
    this.btnDash.addEventListener('pointercancel', (e) => releaseDash(e, false));

    // 6. Shield Guard / Perfect Parry button (strict hold capture, never drops on pointerleave!)
    this.btnGuard.addEventListener('pointerdown', (e) => {
      if (this.blocked) return;
      if (this.guardPointerId !== null) return;
      e.preventDefault();
      e.stopPropagation();

      this.guardPointerId = e.pointerId;
      this.state.guard = true;
      this.safeSetCapture(this.btnGuard, e.pointerId);
      this.btnGuard.classList.add('pressed');
      this.cb.onGuardStart();
    });

    const releaseGuard = (e: PointerEvent) => {
      if (e.pointerId !== this.guardPointerId) return;
      e.preventDefault();
      e.stopPropagation();
      this.safeReleaseCapture(this.btnGuard, e.pointerId);
      this.guardPointerId = null;
      this.state.guard = false;
      this.btnGuard.classList.remove('pressed');
    };
    this.btnGuard.addEventListener('pointerup', releaseGuard);
    this.btnGuard.addEventListener('pointercancel', releaseGuard);

    // 7. Bow Aim (Hold) & Release to Fire (strict hold capture!)
    this.btnBow.addEventListener('pointerdown', (e) => {
      if (this.blocked) return;
      if (this.bowPointerId !== null) return;
      e.preventDefault();
      e.stopPropagation();

      this.bowPointerId = e.pointerId;
      this.state.aimBow = true;
      this.safeSetCapture(this.btnBow, e.pointerId);
      this.btnBow.classList.add('pressed');
    });

    this.btnBow.addEventListener('pointerup', (e) => {
      if (e.pointerId !== this.bowPointerId) return;
      e.preventDefault();
      e.stopPropagation();
      this.safeReleaseCapture(this.btnBow, e.pointerId);
      this.bowPointerId = null;
      const wasAiming = this.state.aimBow;
      this.state.aimBow = false;
      this.btnBow.classList.remove('pressed');
      if (wasAiming) {
        this.cb.onBowRelease();
      }
    });

    this.btnBow.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== this.bowPointerId) return;
      this.safeReleaseCapture(this.btnBow, e.pointerId);
      this.bowPointerId = null;
      this.state.aimBow = false;
      this.btnBow.classList.remove('pressed');
    });

    // 8. ZL Lock-on, Sheikah Rune & Context Interact buttons
    this.bindTapButton(this.btnZL, () => this.cb.onToggleZL());
    this.bindTapButton(this.btnRune, () => this.cb.onActivateRune());
    this.bindTapButton(this.btnInteract, () => this.cb.onInteract());
  }

  private bindTapButton(btn: HTMLButtonElement, onPress: () => void): void {
    let activeId: number | null = null;
    btn.addEventListener('pointerdown', (e) => {
      if (this.blocked) return;
      if (activeId !== null) return;
      e.preventDefault();
      e.stopPropagation();
      activeId = e.pointerId;
      this.safeSetCapture(btn, e.pointerId);
      btn.classList.add('pressed');
      onPress();
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      e.preventDefault();
      e.stopPropagation();
      this.safeReleaseCapture(btn, e.pointerId);
      activeId = null;
      btn.classList.remove('pressed');
    };
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
  }

  private updateStickVector(clientX: number, clientY: number): void {
    const dx = clientX - this.stickOriginX;
    const dy = clientY - this.stickOriginY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(this.stickMaxRadius, dist);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 0.001 ? Math.cos(angle) * clampedDist : 0;
    const ky = dist > 0.001 ? Math.sin(angle) * clampedDist : 0;

    this.stickKnobEl.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

    const normMag = clampedDist / this.stickMaxRadius;
    if (normMag < 0.08) {
      this.state.moveX = 0;
      this.state.moveY = 0;
    } else {
      const scaled = (normMag - 0.08) / 0.92;
      this.state.moveX = Math.cos(angle) * scaled;
      this.state.moveY = -Math.sin(angle) * scaled; // +moveY = forward (up on screen)
    }
  }

  private resetStick(): void {
    this.stickPointerId = null;
    this.state.moveX = 0;
    this.state.moveY = 0;
    this.stickBaseEl.classList.remove('active');
    this.stickBaseEl.style.left = '';
    this.stickBaseEl.style.top = '';
    this.stickKnobEl.style.transform = 'translate(-50%, -50%)';
  }

  private clearAttackChargeTimer(): void {
    if (this.attackChargeTimer !== null) {
      window.clearTimeout(this.attackChargeTimer);
      this.attackChargeTimer = null;
    }
  }

  private clearAttackState(): void {
    this.clearAttackChargeTimer();
    this.attackPointerId = null;
    this.btnAttack.classList.remove('pressed', 'charging');
  }

  private safeSetCapture(el: Element, pointerId: number): void {
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // Synthetic pointer events in automated browsers may not have an active native pointer
    }
  }

  private safeReleaseCapture(el: Element, pointerId: number): void {
    try {
      if (el.hasPointerCapture(pointerId)) {
        el.releasePointerCapture(pointerId);
      }
    } catch {
      // Safe no-op
    }
  }

  public setMode(mode: TouchControlsMode): void {
    this.mode = mode;
    this.syncVisibility();
  }

  public getMode(): TouchControlsMode {
    return this.mode;
  }

  public setBlocked(blocked: boolean): void {
    if (this.blocked === blocked) return;
    this.blocked = blocked;
    if (blocked) {
      this.resetAllActiveInputs();
    }
    this.syncVisibility();
  }

  public setInteractLabel(label: string | null): void {
    if (label) {
      this.btnInteract.textContent = `✋ ${label}`;
      this.btnInteract.classList.remove('hidden');
    } else {
      this.btnInteract.classList.add('hidden');
    }
  }

  public setZLLocked(locked: boolean): void {
    this.btnZL.classList.toggle('locked', locked);
  }

  public isVisible(): boolean {
    if (this.blocked) return false;
    if (this.mode === 'always') return true;
    if (this.mode === 'hidden') return false;
    return isTouchCapableDevice();
  }

  private resetAllActiveInputs(): void {
    this.resetStick();
    this.lookPointerId = null;
    this.clearAttackState();
    this.dashPointerId = null;
    this.guardPointerId = null;
    this.bowPointerId = null;
    this.state.sprint = false;
    this.state.guard = false;
    this.state.aimBow = false;
    this.btnDash.classList.remove('pressed');
    this.btnGuard.classList.remove('pressed');
    this.btnBow.classList.remove('pressed');
  }

  private syncVisibility(): void {
    const visible = this.isVisible();
    this.rootEl.classList.toggle('hidden', !visible);
    document.body.classList.toggle('touch-ui-active', visible);
  }
}
