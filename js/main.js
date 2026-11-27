// ============================================================================
// LUMINA DIORAMA — Main Entry, iPad Multi-Touch Floating Stick & PC Input Loop
// 製作者：駿 (Created by Shun)
// ============================================================================

import { Game } from './game.js';

function generateAppleTouchIcon() {
  try {
    const c = document.createElement('canvas');
    c.width = 180;
    c.height = 180;
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 180, 180);
    bg.addColorStop(0, '#071429');
    bg.addColorStop(1, '#141133');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 180, 180);

    // Isometric Diorama Slab
    ctx.fillStyle = '#0e7490';
    ctx.beginPath();
    ctx.moveTo(90, 74);
    ctx.lineTo(148, 102);
    ctx.lineTo(90, 130);
    ctx.lineTo(32, 102);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#38f8d4';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Glowing Star Crystal
    ctx.shadowColor = '#38f8d4';
    ctx.shadowBlur = 14;
    const cg = ctx.createLinearGradient(90, 26, 90, 102);
    cg.addColorStop(0, '#fef08a');
    cg.addColorStop(0.5, '#67e8f9');
    cg.addColorStop(1, '#f472b6');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(90, 24);
    ctx.lineTo(114, 68);
    ctx.lineTo(90, 100);
    ctx.lineTo(66, 68);
    ctx.closePath();
    ctx.fill();

    const link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    link.href = c.toDataURL('image/png');
    document.head.appendChild(link);
  } catch (_) {}
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

window.addEventListener('DOMContentLoaded', () => {
  generateAppleTouchIcon();

  const canvas = document.getElementById('game-canvas');
  const minimapCanvas = document.getElementById('minimap-canvas');
  const game = new Game(canvas, minimapCanvas);
  window.__game = game;

  // ==========================================================================
  // IPAD SAFARI / TOUCH GESTURE & AUDIO UNLOCK PROTECTION
  // ==========================================================================
  const unlockAudioOnce = () => {
    game.audio.unlock();
    if (game.mode === 'title' && !game.audio.currentTrack) {
      game.audio.playBgm('title');
    }
  };
  window.addEventListener('pointerdown', unlockAudioOnce, { passive: true });
  window.addEventListener('touchstart', unlockAudioOnce, { passive: true });
  window.addEventListener('keydown', unlockAudioOnce, { passive: true });

  // Block iPad pinch zoom, double-tap zoom & long-press context menus
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('contextmenu', (e) => {
    if (!isTypingTarget(e.target)) e.preventDefault();
  });
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest && e.target.closest('.scrollable, .chat-messages, input, textarea')) return;
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  // Responsive Resize & Orientation Change
  const handleResize = () => {
    game.renderer.resize();
  };
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => setTimeout(handleResize, 120));

  // ==========================================================================
  // KEYBOARD & MOUSE INPUT STATE
  // ==========================================================================
  const keys = new Set();
  let attackHeld = false;
  let mouseAimAngle = null;

  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(document.activeElement)) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }

    const code = e.code;
    keys.add(code);

    if (game.mode !== 'playing') return;

    if (code === 'Escape' || code === 'Tab') {
      e.preventDefault();
      if (game.ui.isModalOpen) game.ui.closeModals();
      else game.ui.openMenu('equip');
      return;
    }

    if (game.ui.isModalOpen) {
      if (code === 'Enter' || code === 'Space' || code === 'KeyF') {
        if (!game.ui.el.dialogueBox.classList.contains('hidden')) {
          e.preventDefault();
          game.ui.advanceDialogue();
        }
      }
      return;
    }

    if (code === 'Space' || code === 'KeyJ') {
      e.preventDefault();
      attackHeld = true;
      game.performAttack();
    } else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyK') {
      e.preventDefault();
      game.player.tryDash(getMoveVector(), game);
    } else if (code === 'KeyE' || code === 'KeyL') {
      e.preventDefault();
      game.performMagic();
    } else if (code === 'KeyQ') {
      const sp = game.player.cycleSpell();
      if (sp) {
        game.audio.playSe('uiClick');
        game.addToast(`${sp.icon} ${sp.name} に切替`);
      }
    } else if (code >= 'Digit1' && code <= 'Digit5') {
      const idx = Number(code.replace('Digit', '')) - 1;
      const sp = game.player.selectSpellByIndex(idx);
      if (sp) {
        game.audio.playSe('uiClick');
        game.addToast(`${sp.icon} ${sp.name} に切替`);
      }
    } else if (code === 'KeyR' || code === 'KeyU') {
      game.performLimitBreak();
    } else if (code === 'KeyF' || code === 'Enter') {
      e.preventDefault();
      game.interactHolding = true;
      game.performInteract();
    } else if (code === 'KeyM') {
      game.ui.openWarpModal();
    } else if (code === 'KeyT') {
      e.preventDefault();
      if (!game.ui.chatOpen) game.ui.el.btnChatToggle.click();
      game.ui.el.chatInput.focus();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') attackHeld = false;
    if (e.code === 'KeyF' || e.code === 'Enter') game.interactHolding = false;
  });

  window.addEventListener('blur', () => {
    keys.clear();
    attackHeld = false;
    game.interactHolding = false;
  });

  // Mouse Click Attack / Right-Click Dash on Canvas (PC Comfort)
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (game.mode !== 'playing' || game.ui.isModalOpen) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = mx - game.renderer.width * 0.5 + game.camera.x;
    const worldY = my - game.renderer.height * 0.5 + game.camera.y;
    mouseAimAngle = Math.atan2(worldY - game.player.y, worldX - game.player.x);

    if (e.button === 0) {
      attackHeld = true;
      game.performAttack(mouseAimAngle);
    } else if (e.button === 2) {
      game.player.facing = mouseAimAngle;
      game.player.tryDash({ x: Math.cos(mouseAimAngle), y: Math.sin(mouseAimAngle) }, game);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !attackHeld) return;
    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left) - game.renderer.width * 0.5 + game.camera.x;
    const worldY = (e.clientY - rect.top) - game.renderer.height * 0.5 + game.camera.y;
    mouseAimAngle = Math.atan2(worldY - game.player.y, worldX - game.player.x);
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) {
      attackHeld = false;
      mouseAimAngle = null;
    }
  });

  // ==========================================================================
  // PRO IPAD FLOATING VIRTUAL JOYSTICK & MULTI-TOUCH ACTION BUTTONS
  // ==========================================================================
  const joyZone = document.getElementById('joystick-zone');
  const joyBase = document.getElementById('joystick-base');
  const joyKnob = document.getElementById('joystick-knob');

  let joyPointerId = null;
  let joyOrigin = { x: 0, y: 0 };
  const joyVec = { x: 0, y: 0 };

  function getJoyMaxRadius() {
    return game.settings.buttonSize === 'large' ? 56 : 46;
  }

  joyZone.addEventListener('pointerdown', (e) => {
    if (joyPointerId !== null) return;
    e.preventDefault();
    joyPointerId = e.pointerId;
    try { joyZone.setPointerCapture(e.pointerId); } catch (_) {}

    const rect = joyZone.getBoundingClientRect();
    joyOrigin.x = e.clientX - rect.left;
    joyOrigin.y = e.clientY - rect.top;
    joyVec.x = 0;
    joyVec.y = 0;

    joyBase.style.left = `${joyOrigin.x}px`;
    joyBase.style.top = `${joyOrigin.y}px`;
    joyKnob.style.transform = 'translate(0px, 0px)';
    joyBase.classList.remove('hidden');
  });

  joyZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyPointerId) return;
    e.preventDefault();
    const rect = joyZone.getBoundingClientRect();
    const dx = (e.clientX - rect.left) - joyOrigin.x;
    const dy = (e.clientY - rect.top) - joyOrigin.y;
    const maxR = getJoyMaxRadius();
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxR, dist);
    const ang = Math.atan2(dy, dx);

    const kx = dist > 0.001 ? Math.cos(ang) * clamped : 0;
    const ky = dist > 0.001 ? Math.sin(ang) * clamped : 0;
    joyKnob.style.transform = `translate(${kx}px, ${ky}px)`;

    joyVec.x = kx / maxR;
    joyVec.y = ky / maxR;
  });

  const endJoystick = (e) => {
    if (e.pointerId !== joyPointerId) return;
    joyPointerId = null;
    joyVec.x = 0;
    joyVec.y = 0;
    joyBase.classList.add('hidden');
    joyKnob.style.transform = 'translate(0px, 0px)';
  };
  joyZone.addEventListener('pointerup', endJoystick);
  joyZone.addEventListener('pointercancel', endJoystick);

  // Bind Multi-Touch Action Buttons cleanly without click lag
  function bindTouchBtn(id, onDown, onUp = null) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('pressed');
      unlockAudioOnce();
      onDown(e);
    });
    const release = (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      if (onUp) onUp(e);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', (e) => {
      if (btn.classList.contains('pressed')) {
        btn.classList.remove('pressed');
        if (onUp) onUp(e);
      }
    });
  }

  let touchAttackHeld = false;
  bindTouchBtn('tbtn-attack', () => {
    touchAttackHeld = true;
    game.performAttack();
  }, () => {
    touchAttackHeld = false;
  });

  bindTouchBtn('tbtn-dash', () => {
    game.player.tryDash(getMoveVector(), game);
  });

  bindTouchBtn('tbtn-magic', () => {
    game.performMagic();
  });

  bindTouchBtn('tbtn-cycle', () => {
    const sp = game.player.cycleSpell();
    if (sp) {
      game.audio.playSe('uiClick');
      game.addToast(`${sp.icon} ${sp.name} に切替`);
    }
  });

  bindTouchBtn('tbtn-limit', () => {
    game.performLimitBreak();
  });

  bindTouchBtn('tbtn-interact', () => {
    game.interactHolding = true;
    game.performInteract();
  }, () => {
    game.interactHolding = false;
  });

  function getMoveVector() {
    let x = joyVec.x;
    let y = joyVec.y;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  // ==========================================================================
  // MAIN 60FPS ANIMATION LOOP
  // ==========================================================================
  let lastTime = performance.now();
  function frame(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if ((attackHeld || touchAttackHeld) && game.mode === 'playing' && !game.ui.isModalOpen) {
      game.performAttack(attackHeld ? mouseAimAngle : null);
    }

    game.update(dt, getMoveVector());
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
