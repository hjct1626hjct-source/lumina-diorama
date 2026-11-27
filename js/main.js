// ============================================================================
// LUMINA CHRONICLES — Main Entry, iPad Multi-Touch Stick + Right Camera Orbit,
// Zelda-Style Z-Targeting, Guard/Parry, Jump & 60FPS Game Loop
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
    bg.addColorStop(0, '#1e3a8a');
    bg.addColorStop(1, '#14532d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 180, 180);

    // Golden Hylian Crest Shield & Star Crystal
    ctx.fillStyle = '#4c943e';
    ctx.beginPath();
    ctx.moveTo(90, 74);
    ctx.lineTo(148, 102);
    ctx.lineTo(90, 130);
    ctx.lineTo(32, 102);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 14;
    const cg = ctx.createLinearGradient(90, 26, 90, 102);
    cg.addColorStop(0, '#fef08a');
    cg.addColorStop(0.5, '#38bdf8');
    cg.addColorStop(1, '#2563eb');
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

  const handleResize = () => {
    game.renderer.resize();
  };
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => setTimeout(handleResize, 120));

  // ==========================================================================
  // KEYBOARD & MOUSE INPUT STATE (CAMERA-RELATIVE ZELDA CONTROLS)
  // ==========================================================================
  const keys = new Set();
  let attackHeld = false;

  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(document.activeElement)) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }

    const code = e.code;
    keys.add(code);

    if (game.mode !== 'playing') return;

    if (code === 'Escape') {
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

    if (code === 'Tab' || code === 'KeyZ') {
      // Z-Target Lock-On!
      e.preventDefault();
      game.toggleLockOn();
    } else if (code === 'KeyV') {
      // Cycle Camera Mode (TPS -> Action TPS -> FPS)
      e.preventDefault();
      game.cycleCameraMode();
    } else if (code === 'Space' || code === 'KeyJ') {
      e.preventDefault();
      attackHeld = true;
      game.performAttack();
    } else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyK') {
      e.preventDefault();
      const worldMove = game.inputToWorldMoveVector(getMoveVector());
      game.player.tryDash(worldMove, game);
    } else if (code === 'KeyC' || code === 'KeyH') {
      // Shield Guard & Perfect Parry!
      e.preventDefault();
      game.player.startGuard(game);
    } else if (code === 'KeyB' || code === 'KeyG') {
      // Jump!
      e.preventDefault();
      game.player.tryJump(game);
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
    if (e.code === 'KeyC' || e.code === 'KeyH') game.player.stopGuard();
    if (e.code === 'KeyF' || e.code === 'Enter') game.interactHolding = false;
  });

  window.addEventListener('blur', () => {
    keys.clear();
    attackHeld = false;
    game.player.stopGuard();
    game.interactHolding = false;
  });

  // PC Mouse Controls: Left-Click Attack, Middle-Click Lock-On, Right-Drag Orbit Camera, Wheel Zoom
  let mouseOrbitDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (game.mode !== 'playing' || game.ui.isModalOpen) return;

    if (e.button === 0) {
      attackHeld = true;
      game.performAttack();
    } else if (e.button === 1) {
      e.preventDefault();
      game.toggleLockOn();
    } else if (e.button === 2) {
      mouseOrbitDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !mouseOrbitDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    game.rotateCamera(dx * 0.0065, dy * 0.0045);
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 0) attackHeld = false;
      if (e.button === 2) mouseOrbitDragging = false;
    }
  });

  window.addEventListener('wheel', (e) => {
    if (game.mode !== 'playing' || game.ui.isModalOpen) return;
    game.zoomCamera(e.deltaY * 0.14);
  }, { passive: true });

  // ==========================================================================
  // PRO IPAD MULTI-TOUCH: LEFT FLOATING STICK + RIGHT 360 CAMERA ORBIT DRAG
  // ==========================================================================
  const joyZone = document.getElementById('joystick-zone');
  const joyBase = document.getElementById('joystick-base');
  const joyKnob = document.getElementById('joystick-knob');
  const camZone = document.getElementById('camera-touch-zone');

  let joyPointerId = null;
  let joyOrigin = { x: 0, y: 0 };
  const joyVec = { x: 0, y: 0 };

  let camPointerId = null;
  let camLastPos = { x: 0, y: 0 };

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

  // Right-Half Screen Touch Drag for 360 TPS Camera Orbit (Strictly isolated by pointerId!)
  if (camZone) {
    camZone.addEventListener('pointerdown', (e) => {
      if (camPointerId !== null || e.pointerId === joyPointerId) return;
      e.preventDefault();
      camPointerId = e.pointerId;
      camLastPos.x = e.clientX;
      camLastPos.y = e.clientY;
      try { camZone.setPointerCapture(e.pointerId); } catch (_) {}
    });

    camZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== camPointerId) return;
      e.preventDefault();
      const dx = e.clientX - camLastPos.x;
      const dy = e.clientY - camLastPos.y;
      camLastPos.x = e.clientX;
      camLastPos.y = e.clientY;
      game.rotateCamera(dx * 0.007, dy * 0.005);
    });

    const endCamDrag = (e) => {
      if (e.pointerId !== camPointerId) return;
      camPointerId = null;
    };
    camZone.addEventListener('pointerup', endCamDrag);
    camZone.addEventListener('pointercancel', endCamDrag);
  }

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
    const worldMove = game.inputToWorldMoveVector(getMoveVector());
    game.player.tryDash(worldMove, game);
  });

  bindTouchBtn('tbtn-guard', () => {
    game.player.startGuard(game);
  }, () => {
    game.player.stopGuard();
  });

  bindTouchBtn('tbtn-jump', () => {
    game.player.tryJump(game);
  });

  bindTouchBtn('tbtn-lock', () => {
    game.toggleLockOn();
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
      game.performAttack();
    }

    game.update(dt, getMoveVector());
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
