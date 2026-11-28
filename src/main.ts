import './styles/botw.css';
import { BotWGameEngine } from './core/BotWGameEngine';

/**
 * Installs iOS / iPadOS Safari zoom & viewport guards:
 * - Blocks Safari proprietary gesturestart/gesturechange/gestureend pinch zoom
 * - Blocks multi-touch pinch zoom outside modals while preserving independent PointerEvent multi-touch controls
 * - Blocks 300ms double-tap zoom outside form inputs & modals
 * - Keeps visualViewport anchored at (0, 0) on resize / scroll / orientation change
 */
function installSafariTouchZoomGuards(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const isInsideScrollableModal = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return !!target.closest('.slate-modal, .slate-body, .sub-modal-body, .dialogue-box, #botw-trial-selector, #botw-ending-credits');
  };

  const preventGesture = (e: Event): void => {
    e.preventDefault();
  };
  for (const evt of ['gesturestart', 'gesturechange', 'gestureend'] as const) {
    document.addEventListener(evt, preventGesture, { passive: false });
    window.addEventListener(evt, preventGesture, { passive: false });
  }

  document.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (e.touches.length > 1 && !isInsideScrollableModal(e.target)) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  let lastTouchEndMs = 0;
  document.addEventListener(
    'touchend',
    (e: TouchEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (isInsideScrollableModal(target)) return;
      const now = performance.now();
      if (now - lastTouchEndMs <= 300 && e.touches.length === 0) {
        e.preventDefault();
      }
      lastTouchEndMs = now;
    },
    { passive: false }
  );

  const resetViewportScroll = (): void => {
    window.scrollTo(0, 0);
  };
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resetViewportScroll);
    window.visualViewport.addEventListener('scroll', resetViewportScroll);
  }
  window.addEventListener('orientationchange', () => {
    setTimeout(resetViewportScroll, 60);
  });
}

async function bootstrap(): Promise<void> {
  installSafariTouchZoomGuards();
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Missing #game-canvas mount element.');
  }
  const engine = new BotWGameEngine(canvas);
  await engine.init();
}

bootstrap().catch((err) => {
  console.error('[BotW Bootstrap Error]', err);
});
