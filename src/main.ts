import './styles/botw.css';
import { BotWGameEngine } from './core/BotWGameEngine';

async function bootstrap(): Promise<void> {
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
