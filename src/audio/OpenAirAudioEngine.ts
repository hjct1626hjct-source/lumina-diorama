import type { RegionId, RuneId, WeatherType } from '../types/botw';

export type FootstepSurface = 'grass' | 'stone' | 'snow' | 'sand' | 'water';

export type BgmPriorityState =
  | 'none'
  | 'guardianAlert'
  | 'bloodMoon'
  | 'hyruleCastle'
  | 'boss'
  | 'battle';

export type SettlementBgmStyle =
  | 'kakariko'
  | 'hateno'
  | 'zora'
  | 'rito'
  | 'gerudo'
  | 'goron'
  | 'stable'
  | 'korok'
  | 'lurelin'
  | 'tarrey';

export interface AudioUpdateState {
  regionId: RegionId;
  timeHours: number;
  weather: WeatherType;
  altitude: number;
  speed: number;
  isParagliding: boolean;
  inSettlement: string | null;
  inCombat: boolean;
  guardianLocked: boolean;
  bloodMoon: boolean;
  inHyruleCastle: boolean;
  windStrength?: number;
  inBossFight?: boolean;
}

interface HexInsectCell {
  angleRad: number;
  pan: number;
  distanceAtten: number;
  cooldown: number;
}

const REGION_FOREST_WEIGHT: Record<RegionId, number> = {
  great_plateau: 0.78,
  dueling_peaks: 0.72,
  hateno: 0.8,
  lanayru: 0.65,
  akkala: 0.75,
  eldin: 0.0,
  woodland: 1.0,
  central_hyrule: 0.55,
  ridgeland: 0.62,
  tabantha: 0.35,
  hebra: 0.05,
  gerudo_highlands: 0.02,
  wasteland: 0.0,
  lake: 0.68,
  faron: 0.96,
};

const REGION_BASE_TEMP_C: Record<RegionId, { day: number; night: number }> = {
  great_plateau: { day: 18, night: 7 },
  dueling_peaks: { day: 19, night: 8 },
  hateno: { day: 21, night: 11 },
  lanayru: { day: 15, night: 6 },
  akkala: { day: 17, night: 8 },
  eldin: { day: 68, night: 56 },
  woodland: { day: 16, night: 8 },
  central_hyrule: { day: 20, night: 10 },
  ridgeland: { day: 18, night: 9 },
  tabantha: { day: 6, night: -6 },
  hebra: { day: -14, night: -42 },
  gerudo_highlands: { day: -18, night: -63 },
  wasteland: { day: 48, night: -6 },
  lake: { day: 21, night: 11 },
  faron: { day: 27, night: 20 },
};

// Impressionistic BotW sparse piano pitch collections (MIDI note numbers)
const FIELD_SCALES = {
  // F Lydian / C Maj9 bright open-air daylight palette
  dayTemperate: [69, 71, 72, 74, 76, 78, 79, 81, 83, 84, 86, 88],
  // Reflective A Dorian / D sus2 night palette
  nightTemperate: [62, 64, 67, 69, 71, 74, 76, 79, 81, 83],
  // Crystalline high snowfield voicings
  coldAlpine: [72, 74, 76, 79, 83, 84, 86, 88, 91, 95],
  // Desert Hijaz-tinted sparse high notes
  desertSparse: [64, 65, 68, 69, 71, 72, 76, 77, 80, 81],
  // Volcanic hollow low-mid sparse resonance
  volcanicSparse: [50, 53, 55, 57, 60, 62, 65, 67],
} as const;

// Regional acoustic settlement palettes (MIDI)
const SETTLEMENT_PALETTES: Record<
  SettlementBgmStyle,
  { scale: number[]; chords: number[][]; tempoSec: number; timbre: 'shamisen' | 'harp' | 'flute' | 'celesta' | 'marimba' | 'oud' }
> = {
  kakariko: {
    // Japanese Yo / Insen hybrid pentatonic
    scale: [62, 64, 67, 69, 71, 74, 76, 79, 81],
    chords: [
      [50, 57, 62],
      [55, 62, 67],
      [57, 64, 69],
      [52, 59, 64],
    ],
    tempoSec: 2.3,
    timbre: 'shamisen',
  },
  hateno: {
    // Pastoral G Major / Mixolydian
    scale: [67, 69, 71, 72, 74, 76, 78, 79, 81],
    chords: [
      [55, 59, 62, 67],
      [60, 64, 67, 72],
      [57, 60, 64, 69],
      [50, 57, 62, 66],
    ],
    tempoSec: 2.1,
    timbre: 'flute',
  },
  zora: {
    // Shimmering Eb Lydian aquatic harp + celesta
    scale: [63, 65, 67, 69, 70, 72, 74, 75, 79],
    chords: [
      [51, 58, 63, 67],
      [56, 63, 67, 72],
      [53, 60, 65, 69],
      [58, 62, 65, 70],
    ],
    tempoSec: 2.6,
    timbre: 'celesta',
  },
  rito: {
    // Warm airy A Dorian / C Major waltz-like chords (Dragon Roost nod)
    scale: [69, 71, 72, 74, 76, 79, 81, 83, 84],
    chords: [
      [57, 60, 64, 69],
      [55, 59, 62, 67],
      [53, 57, 60, 65],
      [52, 55, 59, 64],
    ],
    tempoSec: 1.9,
    timbre: 'flute',
  },
  gerudo: {
    // Phrygian dominant warm plucked oud chords
    scale: [64, 65, 68, 69, 71, 72, 74, 76, 77],
    chords: [
      [52, 56, 59, 64],
      [53, 57, 60, 65],
      [50, 53, 57, 62],
      [52, 56, 59, 62],
    ],
    tempoSec: 1.85,
    timbre: 'oud',
  },
  goron: {
    // Cheerful bouncy C pentatonic marimba/brass warmth
    scale: [60, 62, 64, 67, 69, 72, 74, 76],
    chords: [
      [48, 55, 60, 64],
      [53, 57, 60, 65],
      [55, 59, 62, 67],
      [48, 52, 55, 60],
    ],
    tempoSec: 1.65,
    timbre: 'marimba',
  },
  stable: {
    // Cozy acoustic harp & fiddle cadence
    scale: [60, 62, 64, 67, 69, 72, 74, 76, 79],
    chords: [
      [48, 55, 60, 64],
      [57, 60, 64, 69],
      [53, 57, 60, 65],
      [55, 59, 62, 67],
    ],
    tempoSec: 2.2,
    timbre: 'harp',
  },
  korok: {
    scale: [65, 67, 69, 72, 74, 77, 79, 81],
    chords: [
      [53, 57, 60, 65],
      [58, 62, 65, 70],
      [55, 60, 62, 67],
      [53, 57, 60, 64],
    ],
    tempoSec: 2.0,
    timbre: 'marimba',
  },
  lurelin: {
    scale: [62, 64, 66, 69, 71, 74, 76, 78],
    chords: [
      [50, 57, 62, 66],
      [55, 59, 62, 67],
      [57, 61, 64, 69],
      [50, 54, 57, 62],
    ],
    tempoSec: 2.0,
    timbre: 'harp',
  },
  tarrey: {
    scale: [67, 69, 71, 74, 76, 79, 81, 83],
    chords: [
      [55, 59, 62, 67],
      [57, 60, 64, 69],
      [59, 62, 66, 71],
      [60, 64, 67, 72],
    ],
    tempoSec: 1.95,
    timbre: 'harp',
  },
};

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function resolveSettlementStyle(name: string | null): SettlementBgmStyle | null {
  if (!name) return null;
  const s = name.toLowerCase();
  if (s.includes('stable') || s.includes('馬宿')) return 'stable';
  if (s.includes('kakariko') || s.includes('カカリコ')) return 'kakariko';
  if (s.includes('hateno') || s.includes('ハテノ')) return 'hateno';
  if (s.includes('zora') || s.includes('ゾーラ')) return 'zora';
  if (s.includes('rito') || s.includes('リト')) return 'rito';
  if (s.includes('gerudo') || s.includes('ゲルド') || s.includes('bazaar') || s.includes('バザール')) return 'gerudo';
  if (s.includes('goron') || s.includes('ゴロン')) return 'goron';
  if (s.includes('korok') || s.includes('コログ')) return 'korok';
  if (s.includes('lurelin') || s.includes('ウオトリー')) return 'lurelin';
  if (s.includes('tarrey') || s.includes('イチカラ')) return 'tarrey';
  return 'stable';
}

function estimateTemperatureC(regionId: RegionId, timeHours: number, altitude: number): number {
  const base = REGION_BASE_TEMP_C[regionId] ?? { day: 18, night: 8 };
  const normalizedHour = ((timeHours % 24) + 24) % 24;
  // Smooth solar warmth curve peaking around 14:00, coldest around 03:00
  const sunCurve = 0.5 - 0.5 * Math.cos(((normalizedHour - 2) / 24) * Math.PI * 2);
  const altDrop = Math.max(0, altitude - 45) * 0.08;
  return base.night + (base.day - base.night) * sunCurve - altDrop;
}

/**
 * CEDEC 2017 "Breath of the Wild" Open-Air Web Audio API Sound Engine.
 *
 * Implements:
 * - Lazy gesture-safe initialization (never throws in headless/Node/suspended contexts)
 * - 3-band dynamic wind generator + hex-grid spatialized insects + canopy birds + weather/volcano beds
 * - 3-layer dynamic BGM controller (sparse open-air piano / regional settlements / priority combat & alerts)
 * - Full procedural BotW combat, rune, exploration, cooking, and UI SFX suite
 */
export class OpenAirAudioEngine {
  private ctx: AudioContext | null = null;
  private initialized = false;
  private unavailable = false;
  private muted = false;
  private gestureListenersBound = false;

  // Core routing buses
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private ambientBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbReturn: GainNode | null = null;

  // Shared noise buffers
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;

  // Continuous ambient generators
  private windLowFilter: BiquadFilterNode | null = null;
  private windLowGain: GainNode | null = null;
  private windMidFilter: BiquadFilterNode | null = null;
  private windMidGain: GainNode | null = null;
  private windHighFilter: BiquadFilterNode | null = null;
  private windHighGain: GainNode | null = null;

  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private volcanoFilter: BiquadFilterNode | null = null;
  private volcanoGain: GainNode | null = null;
  private volcanoSubOsc: OscillatorNode | null = null;
  private volcanoSubGain: GainNode | null = null;

  // 3-Layer Dynamic BGM bus gains
  private layer1Gain: GainNode | null = null; // Field Open-Air sparse piano
  private layer2Gain: GainNode | null = null; // Settlement / Stable acoustic
  private layer3Gain: GainNode | null = null; // Priority states (Guardian, Battle, Blood Moon, Castle/Boss)

  // Persistent ambient & BGM state timers
  private elapsed = 0;
  private gustPhase = 0;
  private hexInsectCells: HexInsectCell[] = [];
  private birdCooldown = 3.5;
  private thunderCooldown = 9.0;
  private rainDropCooldown = 0.25;
  private magmaPopCooldown = 5.0;

  // Layer 1 (Field piano) state
  private fieldPhraseCooldown = 4.5;
  private fieldNotesRemaining = 0;
  private fieldNextNoteTimer = 0;
  private fieldLastMidi = 76;

  // Layer 2 (Settlement) state
  private currentSettlementStyle: SettlementBgmStyle | null = null;
  private settlementStepTimer = 0.6;
  private settlementBarIndex = 0;

  // Layer 3 (Priority dynamic BGM) state
  private activePriority: BgmPriorityState = 'none';
  private priorityStepTimer = 0;
  private priorityStepIndex = 0;
  private bloodMoonDroneGain: GainNode | null = null;
  private bloodMoonOscA: OscillatorNode | null = null;
  private bloodMoonOscB: OscillatorNode | null = null;

  private lastState: AudioUpdateState = {
    regionId: 'great_plateau',
    timeHours: 8,
    weather: 'sunny',
    altitude: 40,
    speed: 0,
    isParagliding: false,
    inSettlement: null,
    inCombat: false,
    guardianLocked: false,
    bloodMoon: false,
    inHyruleCastle: false,
  };

  private readonly handleUserGesture = (): void => {
    this.unlock();
  };

  constructor() {
    this.initHexGrid();
    this.bindGestureListeners();
  }

  private initHexGrid(): void {
    this.hexInsectCells = [];
    for (let i = 0; i < 6; i++) {
      const angleRad = (i * Math.PI) / 3 + Math.PI / 6;
      this.hexInsectCells.push({
        angleRad,
        pan: clamp(Math.sin(angleRad) * 0.88, -0.92, 0.92),
        distanceAtten: 0.65 + (i % 3) * 0.14,
        cooldown: 1.5 + i * 1.15,
      });
    }
  }

  private bindGestureListeners(): void {
    if (this.gestureListenersBound) return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    this.gestureListenersBound = true;
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener('pointerdown', this.handleUserGesture, opts);
    window.addEventListener('keydown', this.handleUserGesture, opts);
    window.addEventListener('touchstart', this.handleUserGesture, opts);
    window.addEventListener('click', this.handleUserGesture, opts);
  }

  private unbindGestureListeners(): void {
    if (!this.gestureListenersBound) return;
    if (typeof window === 'undefined' || typeof window.removeEventListener !== 'function') return;
    this.gestureListenersBound = false;
    window.removeEventListener('pointerdown', this.handleUserGesture);
    window.removeEventListener('keydown', this.handleUserGesture);
    window.removeEventListener('touchstart', this.handleUserGesture);
    window.removeEventListener('click', this.handleUserGesture);
  }

  /**
   * Lazily initializes or resumes the AudioContext on a user gesture.
   * Safe to call repeatedly and never throws in headless/Node environments.
   */
  public unlock(): boolean {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        void ctx.resume().catch(() => {
          // Silently ignore autoplay blocks until next gesture
        });
      } catch {
        // Ignore resume errors in restricted contexts
      }
    }
    if (ctx.state === 'running') {
      this.unbindGestureListeners();
    }
    return true;
  }

  public isInitialized(): boolean {
    return this.initialized && this.ctx !== null;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getCurrentPriorityState(): BgmPriorityState {
    return this.activePriority;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      try {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.82, now, 0.04);
      } catch {
        this.masterGain.gain.value = muted ? 0 : 0.82;
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.unavailable) return null;
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
        try {
          void this.ctx.resume().catch(() => {});
        } catch {
          // Ignore
        }
      }
      return this.ctx;
    }

    if (typeof window === 'undefined') {
      return null;
    }

    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtxCtor) {
      this.unavailable = true;
      return null;
    }

    try {
      const ctx = new AudioCtxCtor();
      this.ctx = ctx;
      this.buildAudioGraph(ctx);
      this.initialized = true;
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        void ctx.resume().catch(() => {});
      }
      return ctx;
    } catch {
      this.unavailable = true;
      this.ctx = null;
      return null;
    }
  }

  private buildAudioGraph(ctx: AudioContext): void {
    const masterGain = ctx.createGain();
    masterGain.gain.value = this.muted ? 0 : 0.82;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.18;

    const ambientBus = ctx.createGain();
    ambientBus.gain.value = 0.72;

    const bgmBus = ctx.createGain();
    bgmBus.gain.value = 0.68;

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.92;

    // Open-air valley reverb impulse response
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.34;
    const reverbNode = this.createOpenAirReverb(ctx);

    ambientBus.connect(compressor);
    bgmBus.connect(compressor);
    sfxBus.connect(compressor);

    if (reverbNode) {
      reverbNode.connect(reverbReturn);
      reverbReturn.connect(compressor);
    }

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    this.masterGain = masterGain;
    this.compressor = compressor;
    this.ambientBus = ambientBus;
    this.bgmBus = bgmBus;
    this.sfxBus = sfxBus;
    this.reverbNode = reverbNode;
    this.reverbReturn = reverbReturn;

    // Pre-generate shared noise buffers (3 seconds each)
    this.whiteNoiseBuffer = this.createNoiseBuffer(ctx, 3.0, false);
    this.pinkNoiseBuffer = this.createNoiseBuffer(ctx, 3.0, true);

    // 3-Layer Dynamic BGM gain buses
    const layer1Gain = ctx.createGain();
    layer1Gain.gain.value = 1.0;
    layer1Gain.connect(bgmBus);

    const layer2Gain = ctx.createGain();
    layer2Gain.gain.value = 0.0;
    layer2Gain.connect(bgmBus);

    const layer3Gain = ctx.createGain();
    layer3Gain.gain.value = 0.0;
    layer3Gain.connect(bgmBus);

    this.layer1Gain = layer1Gain;
    this.layer2Gain = layer2Gain;
    this.layer3Gain = layer3Gain;

    // Start continuous ambient beds silently (gain=0) until update() modulates them
    this.setupContinuousWind(ctx, ambientBus);
    this.setupContinuousWeatherAndVolcano(ctx, ambientBus);
    this.setupBloodMoonDrone(ctx, layer3Gain);
  }

  private createNoiseBuffer(ctx: AudioContext, durationSec: number, pink: boolean): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (!pink) {
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }

    // Paul Kellet's refined pink noise filter
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = clamp((b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11, -1, 1);
      b6 = white * 0.115926;
    }
    return buffer;
  }

  private createOpenAirReverb(ctx: AudioContext): ConvolverNode | null {
    if (typeof ctx.createConvolver !== 'function') return null;
    try {
      const convolver = ctx.createConvolver();
      const duration = 2.4;
      const length = Math.floor(ctx.sampleRate * duration);
      const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const channel = impulse.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < length; i++) {
          const t = i / length;
          const decay = Math.pow(1 - t, 2.75);
          const white = Math.random() * 2 - 1;
          // Soften high frequencies for airy natural valley acoustics
          lp = lp * 0.72 + white * 0.28;
          channel[i] = lp * decay * 0.65;
        }
      }
      convolver.buffer = impulse;
      return convolver;
    } catch {
      return null;
    }
  }

  private createPanner(ctx: AudioContext, pan: number): AudioNode {
    const clamped = clamp(pan, -1, 1);
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamped;
      return panner;
    }
    const fallback = ctx.createGain();
    fallback.gain.value = 1;
    return fallback;
  }

  private setupContinuousWind(ctx: AudioContext, dest: AudioNode): void {
    if (!this.pinkNoiseBuffer) return;

    const createBand = (
      type: BiquadFilterType,
      freq: number,
      q: number,
      offsetSec: number
    ): { filter: BiquadFilterNode; gain: GainNode } => {
      const src = ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;

      const gain = ctx.createGain();
      gain.gain.value = 0.0001;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      src.start(ctx.currentTime, offsetSec);
      return { filter, gain };
    };

    const low = createBand('lowpass', 110, 1.0, 0.0);
    const mid = createBand('bandpass', 420, 0.85, 0.9);
    const high = createBand('bandpass', 1850, 1.5, 1.8);

    this.windLowFilter = low.filter;
    this.windLowGain = low.gain;
    this.windMidFilter = mid.filter;
    this.windMidGain = mid.gain;
    this.windHighFilter = high.filter;
    this.windHighGain = high.gain;
  }

  private setupContinuousWeatherAndVolcano(ctx: AudioContext, dest: AudioNode): void {
    if (!this.whiteNoiseBuffer || !this.pinkNoiseBuffer) return;

    // Rain patter bed
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = this.whiteNoiseBuffer;
    rainSrc.loop = true;

    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 1100;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.value = 5200;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;

    rainSrc.connect(rainHp);
    rainHp.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(dest);
    rainSrc.start();

    this.rainFilter = rainFilter;
    this.rainGain = rainGain;

    // Eldin volcanic low rumble bed
    const volcSrc = ctx.createBufferSource();
    volcSrc.buffer = this.pinkNoiseBuffer;
    volcSrc.loop = true;

    const volcanoFilter = ctx.createBiquadFilter();
    volcanoFilter.type = 'lowpass';
    volcanoFilter.frequency.value = 72;
    volcanoFilter.Q.value = 1.4;

    const volcanoGain = ctx.createGain();
    volcanoGain.gain.value = 0.0;

    volcSrc.connect(volcanoFilter);
    volcanoFilter.connect(volcanoGain);
    volcanoGain.connect(dest);
    volcSrc.start(ctx.currentTime, 0.4);

    // Subtle seismic magma hum oscillator
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 38;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.0;
    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start();

    this.volcanoFilter = volcanoFilter;
    this.volcanoGain = volcanoGain;
    this.volcanoSubOsc = subOsc;
    this.volcanoSubGain = subGain;
  }

  private setupBloodMoonDrone(ctx: AudioContext, layer3Dest: AudioNode): void {
    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 55; // A1

    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 77.78; // D#2 (ominous tritone)

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    lp.Q.value = 3.2;

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.0;

    oscA.connect(lp);
    oscB.connect(lp);
    lp.connect(droneGain);
    droneGain.connect(layer3Dest);

    oscA.start();
    oscB.start();

    this.bloodMoonOscA = oscA;
    this.bloodMoonOscB = oscB;
    this.bloodMoonDroneGain = droneGain;
  }

  /**
   * Per-frame audio update. Modulates spatialized open-air ambience,
   * hex-grid insects, canopy birds, weather/volcano beds, and 3-layer BGM.
   */
  public update(dt: number, state: AudioUpdateState): void {
    const safeDt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.25);
    this.lastState = state;
    this.elapsed += safeDt;
    this.gustPhase += safeDt;

    // Resolve priority BGM state even when context is not yet active
    const priority = this.computePriorityState(state);
    if (priority !== this.activePriority) {
      this.activePriority = priority;
      this.priorityStepTimer = 0.05;
      this.priorityStepIndex = 0;
    }

    const settlementStyle = resolveSettlementStyle(state.inSettlement);
    if (settlementStyle !== this.currentSettlementStyle) {
      this.currentSettlementStyle = settlementStyle;
      this.settlementStepTimer = 0.4;
    }

    // Do not force-create AudioContext outside user gestures; wait until running
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) {
      return;
    }

    const now = this.ctx.currentTime;
    this.updateWindBands(this.ctx, now, state);
    this.updateWeatherAndVolcano(this.ctx, now, safeDt, state);
    this.updateHexInsects(this.ctx, safeDt, state);
    this.updateCanopyBirds(this.ctx, safeDt, state);
    this.updateDynamicBgm(this.ctx, now, safeDt, state);
  }

  private computePriorityState(state: AudioUpdateState): BgmPriorityState {
    if (state.guardianLocked) return 'guardianAlert';
    if (state.bloodMoon) return 'bloodMoon';
    if (state.inBossFight) return 'boss';
    if (state.inHyruleCastle) return 'hyruleCastle';
    if (state.inCombat) return 'battle';
    return 'none';
  }

  private computeWindStrength(state: AudioUpdateState): number {
    if (typeof state.windStrength === 'number' && Number.isFinite(state.windStrength)) {
      return clamp(state.windStrength, 0, 1.5);
    }
    let w = 0.28;
    switch (state.weather) {
      case 'cloudy':
        w = 0.4;
        break;
      case 'rain':
      case 'sunshower':
        w = 0.55;
        break;
      case 'thunderstorm':
        w = 0.88;
        break;
      case 'snow':
        w = 0.62;
        break;
      case 'blizzard':
      case 'sandstorm':
        w = 1.0;
        break;
      case 'volcanic_ash':
        w = 0.48;
        break;
      default:
        w = 0.28;
    }
    const altBoost = clamp((state.altitude - 40) / 180, 0, 0.55);
    return clamp(w + altBoost, 0, 1.35);
  }

  private updateWindBands(ctx: AudioContext, now: number, state: AudioUpdateState): void {
    if (
      !this.windLowFilter ||
      !this.windLowGain ||
      !this.windMidFilter ||
      !this.windMidGain ||
      !this.windHighFilter ||
      !this.windHighGain
    ) {
      return;
    }

    const windStrength = this.computeWindStrength(state);
    const altNorm = clamp((state.altitude - 15) / 210, 0, 1);
    const speedNorm = clamp(state.speed / 22, 0, 1);
    const glideBoost = state.isParagliding ? 0.55 + speedNorm * 0.55 : 0;
    const shelterFactor = state.inSettlement ? 0.48 : 1.0;
    const forestWeight = REGION_FOREST_WEIGHT[state.regionId] ?? 0.5;

    // Multi-harmonic organic gust envelope
    const gust =
      0.55 +
      0.27 * Math.sin(this.gustPhase * 0.41) +
      0.18 * Math.sin(this.gustPhase * 0.93 + 1.4);

    // Band 1: Low gust rumble
    const lowGain =
      clamp(0.03 + windStrength * 0.14 * gust + altNorm * 0.08 + glideBoost * 0.09, 0.005, 0.28) *
      shelterFactor;
    const lowFreq = 82 + windStrength * 55 + glideBoost * 45;

    // Band 2: Mid meadow breeze
    const midGain =
      clamp(0.025 + windStrength * 0.11 * gust + speedNorm * 0.05 + glideBoost * 0.08, 0.004, 0.22) *
      shelterFactor;
    const midFreq = 320 + gust * 180 + speedNorm * 160 + (state.isParagliding ? 180 : 0);

    // Band 3: High foliage rustle / mountain alpine howl / paraglider headwind
    const isAlpineHowl =
      altNorm > 0.55 || state.weather === 'blizzard' || state.weather === 'sandstorm';
    const highBase = forestWeight * 0.045 + altNorm * 0.08 + glideBoost * 0.13;
    const highGain =
      clamp(highBase * (0.45 + windStrength * 0.7) * gust, 0.002, 0.24) * shelterFactor;
    const highFreq = state.isParagliding
      ? 1450 + speedNorm * 1300
      : isAlpineHowl
        ? 980 + altNorm * 1100 + gust * 420
        : 1750 + gust * 900;
    const highQ = isAlpineHowl ? 4.2 : state.isParagliding ? 2.1 : 1.25;

    this.windLowGain.gain.setTargetAtTime(lowGain, now, 0.25);
    this.windLowFilter.frequency.setTargetAtTime(lowFreq, now, 0.25);

    this.windMidGain.gain.setTargetAtTime(midGain, now, 0.22);
    this.windMidFilter.frequency.setTargetAtTime(midFreq, now, 0.22);

    this.windHighGain.gain.setTargetAtTime(highGain, now, 0.18);
    this.windHighFilter.frequency.setTargetAtTime(highFreq, now, 0.18);
    this.windHighFilter.Q.setTargetAtTime(highQ, now, 0.25);
  }

  private updateWeatherAndVolcano(
    ctx: AudioContext,
    now: number,
    dt: number,
    state: AudioUpdateState
  ): void {
    if (!this.rainGain || !this.rainFilter || !this.volcanoGain || !this.volcanoSubGain) return;

    const isRain = state.weather === 'rain';
    const isStorm = state.weather === 'thunderstorm';
    const isSunshower = state.weather === 'sunshower';

    const targetRain = isStorm ? 0.19 : isRain ? 0.13 : isSunshower ? 0.065 : 0.0;
    const targetRainFreq = isStorm ? 6400 : isRain ? 4800 : 3900;
    this.rainGain.gain.setTargetAtTime(targetRain, now, 0.55);
    this.rainFilter.frequency.setTargetAtTime(targetRainFreq, now, 0.55);

    // Individual raindrop plinks
    if (targetRain > 0.02) {
      this.rainDropCooldown -= dt;
      if (this.rainDropCooldown <= 0) {
        this.rainDropCooldown = (isStorm ? 0.12 : 0.24) + Math.random() * 0.28;
        this.triggerRainDrop(ctx, isStorm ? 0.045 : 0.028);
      }
    }

    // Distant thunder rumble during thunderstorms
    if (isStorm) {
      this.thunderCooldown -= dt;
      if (this.thunderCooldown <= 0) {
        this.thunderCooldown = 7.5 + Math.random() * 11.5;
        this.triggerDistantThunder(ctx);
      }
    } else {
      this.thunderCooldown = Math.min(this.thunderCooldown, 4.0);
    }

    // Eldin volcanic low rumble + magma pops
    const isVolcanic = state.regionId === 'eldin' || state.weather === 'volcanic_ash';
    const volcTarget = state.regionId === 'eldin' ? 0.22 : isVolcanic ? 0.11 : 0.0;
    const subTarget = state.regionId === 'eldin' ? 0.065 : isVolcanic ? 0.03 : 0.0;
    this.volcanoGain.gain.setTargetAtTime(volcTarget, now, 0.75);
    this.volcanoSubGain.gain.setTargetAtTime(subTarget, now, 0.75);
    if (this.volcanoSubOsc && isVolcanic) {
      this.volcanoSubOsc.frequency.setTargetAtTime(
        36 + Math.sin(this.elapsed * 0.37) * 4.5,
        now,
        0.3
      );
    }
    if (state.regionId === 'eldin') {
      this.magmaPopCooldown -= dt;
      if (this.magmaPopCooldown <= 0) {
        this.magmaPopCooldown = 4.5 + Math.random() * 6.5;
        this.triggerMagmaRumblePop(ctx);
      }
    }
  }

  private triggerRainDrop(ctx: AudioContext, gainAmp: number): void {
    if (!this.ambientBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const pan = this.createPanner(ctx, Math.random() * 1.8 - 0.9);
    const baseFreq = 1900 + Math.random() * 1600;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.038);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gainAmp, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);

    osc.connect(g);
    g.connect(pan);
    pan.connect(this.ambientBus);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  private triggerDistantThunder(ctx: AudioContext): void {
    if (!this.ambientBus || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const pan = this.createPanner(ctx, Math.random() * 1.6 - 0.8);

    // Distant crack transient
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = this.pinkNoiseBuffer;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.value = 340 + Math.random() * 220;
    crackFilter.Q.value = 0.7;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.0001, now);
    crackGain.gain.linearRampToValueAtTime(0.18, now + 0.06);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    crackSrc.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(pan);

    // Rolling sub-bass thunder body
    const rollSrc = ctx.createBufferSource();
    rollSrc.buffer = this.pinkNoiseBuffer;
    rollSrc.loop = true;
    const rollFilter = ctx.createBiquadFilter();
    rollFilter.type = 'lowpass';
    rollFilter.frequency.setValueAtTime(145, now);
    rollFilter.frequency.exponentialRampToValueAtTime(48, now + 4.4);
    const rollGain = ctx.createGain();
    rollGain.gain.setValueAtTime(0.0001, now);
    rollGain.gain.linearRampToValueAtTime(0.32, now + 0.25);
    rollGain.gain.linearRampToValueAtTime(0.16, now + 1.2);
    rollGain.gain.linearRampToValueAtTime(0.24, now + 1.85);
    rollGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.6);

    rollSrc.connect(rollFilter);
    rollFilter.connect(rollGain);
    rollGain.connect(pan);
    pan.connect(this.ambientBus);

    crackSrc.start(now);
    crackSrc.stop(now + 0.95);
    rollSrc.start(now, Math.random() * 1.5);
    rollSrc.stop(now + 4.7);
  }

  private triggerMagmaRumblePop(ctx: AudioContext): void {
    if (!this.ambientBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const pan = this.createPanner(ctx, Math.random() * 1.4 - 0.7);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(92 + Math.random() * 35, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.45);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(g);
    g.connect(pan);
    pan.connect(this.ambientBus);
    osc.start(now);
    osc.stop(now + 0.52);
  }

  /**
   * CEDEC 2017 Hex-Grid Spatialized Insect Emitter around Link.
   * Cicadas buzz in warm daytime; crickets chirp on mild nights.
   */
  private updateHexInsects(ctx: AudioContext, dt: number, state: AudioUpdateState): void {
    const hostileWeather =
      state.weather === 'rain' ||
      state.weather === 'thunderstorm' ||
      state.weather === 'snow' ||
      state.weather === 'blizzard' ||
      state.weather === 'sandstorm' ||
      state.weather === 'volcanic_ash';

    if (hostileWeather || state.regionId === 'eldin' || state.isParagliding) {
      return;
    }

    const tempC = estimateTemperatureC(state.regionId, state.timeHours, state.altitude);
    if (tempC < 2 || tempC > 44) return;

    const hour = ((state.timeHours % 24) + 24) % 24;
    const isDayCicada = hour >= 8.5 && hour < 17.5 && tempC >= 16;
    const isNightCricket = (hour >= 19.0 || hour < 5.0) && tempC >= 4;
    if (!isDayCicada && !isNightCricket) return;

    const bioDensity = Math.max(0.2, REGION_FOREST_WEIGHT[state.regionId] ?? 0.4);

    for (const cell of this.hexInsectCells) {
      cell.cooldown -= dt * bioDensity;
      if (cell.cooldown <= 0) {
        if (isDayCicada) {
          cell.cooldown = 3.2 + Math.random() * 4.8;
          this.triggerHexCicada(ctx, cell);
        } else {
          cell.cooldown = 2.0 + Math.random() * 3.8;
          this.triggerHexCricket(ctx, cell);
        }
      }
    }
  }

  private triggerHexCicada(ctx: AudioContext, cell: HexInsectCell): void {
    if (!this.ambientBus || !this.whiteNoiseBuffer) return;
    const now = ctx.currentTime;
    const dur = 1.1 + Math.random() * 1.1;

    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4300 + Math.random() * 1100;
    bp.Q.value = 8.5;

    // Rhythmic cicada wing-tremolo amplitude modulation
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 26 + Math.random() * 10;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.012 * cell.distanceAtten;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.022 * cell.distanceAtten, now + 0.28);
    env.gain.setValueAtTime(0.02 * cell.distanceAtten, now + dur - 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const pan = this.createPanner(ctx, cell.pan);

    lfo.connect(lfoGain);
    lfoGain.connect(env.gain);

    src.connect(bp);
    bp.connect(env);
    env.connect(pan);
    pan.connect(this.ambientBus);

    src.start(now, Math.random() * 1.5);
    lfo.start(now);
    src.stop(now + dur + 0.05);
    lfo.stop(now + dur + 0.05);
  }

  private triggerHexCricket(ctx: AudioContext, cell: HexInsectCell): void {
    if (!this.ambientBus) return;
    const now = ctx.currentTime;
    const carrierHz = 3850 + Math.random() * 650;
    const pulses = 3 + Math.floor(Math.random() * 2);
    const pan = this.createPanner(ctx, cell.pan);
    pan.connect(this.ambientBus);

    for (let i = 0; i < pulses; i++) {
      const t0 = now + i * 0.048;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(carrierHz, t0);
      osc.frequency.linearRampToValueAtTime(carrierHz * 0.97, t0 + 0.032);

      const g = ctx.createGain();
      const peak = 0.018 * cell.distanceAtten;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.036);

      osc.connect(g);
      g.connect(pan);
      osc.start(t0);
      osc.stop(t0 + 0.04);
    }
  }

  private updateCanopyBirds(ctx: AudioContext, dt: number, state: AudioUpdateState): void {
    const forestWeight = REGION_FOREST_WEIGHT[state.regionId] ?? 0;
    if (forestWeight < 0.3) return;

    const hour = ((state.timeHours % 24) + 24) % 24;
    if (hour < 5.5 || hour > 17.5) return;

    if (
      state.weather === 'rain' ||
      state.weather === 'thunderstorm' ||
      state.weather === 'blizzard' ||
      state.weather === 'sandstorm' ||
      state.weather === 'volcanic_ash'
    ) {
      return;
    }

    this.birdCooldown -= dt * (0.5 + forestWeight * 0.8);
    if (this.birdCooldown <= 0) {
      this.birdCooldown = 4.2 + Math.random() * 7.5;
      this.triggerCanopyBirdCall(ctx, state.regionId === 'faron');
    }
  }

  private triggerCanopyBirdCall(ctx: AudioContext, tropical: boolean): void {
    if (!this.ambientBus) return;
    const now = ctx.currentTime;
    const pan = this.createPanner(ctx, Math.random() * 1.7 - 0.85);
    pan.connect(this.ambientBus);
    if (this.reverbNode) {
      const send = ctx.createGain();
      send.gain.value = 0.35;
      pan.connect(send);
      send.connect(this.reverbNode);
    }

    const pattern = Math.random();
    if (pattern < 0.45) {
      // Japanese bush warbler / woodland rising whistle + trill
      const base = tropical ? 2450 : 2100 + Math.random() * 450;
      const notes = [
        { t: 0, f0: base * 0.82, f1: base * 0.94, d: 0.24 },
        { t: 0.32, f0: base * 1.18, f1: base * 1.04, d: 0.12 },
        { t: 0.46, f0: base * 1.24, f1: base * 1.0, d: 0.14 },
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f0, now + n.t);
        osc.frequency.exponentialRampToValueAtTime(n.f1, now + n.t + n.d);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now + n.t);
        g.gain.linearRampToValueAtTime(0.028, now + n.t + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);

        osc.connect(g);
        g.connect(pan);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.02);
      }
    } else {
      // Crisp 2-syllable canopy finch chirp
      const f = tropical ? 3100 + Math.random() * 700 : 2600 + Math.random() * 600;
      for (let i = 0; i < 2; i++) {
        const t0 = now + i * 0.15;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * (i === 0 ? 1.0 : 1.12), t0);
        osc.frequency.exponentialRampToValueAtTime(f * 0.72, t0 + 0.1);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.024, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);

        osc.connect(g);
        g.connect(pan);
        osc.start(t0);
        osc.stop(t0 + 0.12);
      }
    }
  }

  /**
   * 3-Layer Dynamic BGM Controller:
   * - Layer 1: Sparse impressionistic solo piano (Field Open-Air)
   * - Layer 2: Settlement / Stable acoustic regional chords
   * - Layer 3: Priority states (Guardian Alert, Blood Moon, Hyrule Castle / Boss, Battle)
   */
  private updateDynamicBgm(
    ctx: AudioContext,
    now: number,
    dt: number,
    state: AudioUpdateState
  ): void {
    if (!this.layer1Gain || !this.layer2Gain || !this.layer3Gain) return;

    const hasPriority = this.activePriority !== 'none';
    const hasSettlement = !hasPriority && this.currentSettlementStyle !== null;
    const isField = !hasPriority && !hasSettlement;

    // Crossfade layer buses smoothly
    const fadeFast = this.activePriority === 'guardianAlert' || this.activePriority === 'battle' ? 0.25 : 0.85;
    this.layer1Gain.gain.setTargetAtTime(isField ? 0.95 : 0.0, now, 1.1);
    this.layer2Gain.gain.setTargetAtTime(hasSettlement ? 0.85 : 0.0, now, 1.25);
    this.layer3Gain.gain.setTargetAtTime(hasPriority ? 0.95 : 0.0, now, fadeFast);

    // Blood Moon eerie continuous tritone drone envelope
    if (this.bloodMoonDroneGain && this.bloodMoonOscA && this.bloodMoonOscB) {
      if (this.activePriority === 'bloodMoon') {
        const swell = 0.045 + 0.035 * Math.pow((Math.sin(this.elapsed * 0.75) + 1) * 0.5, 2);
        this.bloodMoonDroneGain.gain.setTargetAtTime(swell, now, 0.25);
        this.bloodMoonOscB.frequency.setTargetAtTime(
          77.78 + Math.sin(this.elapsed * 0.42) * 1.8,
          now,
          0.2
        );
      } else {
        this.bloodMoonDroneGain.gain.setTargetAtTime(0.0, now, 0.4);
      }
    }

    // Drive the active layer's procedural motif scheduler
    if (isField) {
      this.stepLayer1FieldPiano(ctx, dt, state);
    } else if (hasSettlement && this.currentSettlementStyle) {
      this.stepLayer2Settlement(ctx, dt, this.currentSettlementStyle);
    } else if (hasPriority) {
      this.stepLayer3Priority(ctx, dt, this.activePriority);
    }
  }

  private getFieldScale(state: AudioUpdateState): readonly number[] {
    if (state.regionId === 'hebra' || state.regionId === 'gerudo_highlands') {
      return FIELD_SCALES.coldAlpine;
    }
    if (state.regionId === 'wasteland') {
      return FIELD_SCALES.desertSparse;
    }
    if (state.regionId === 'eldin') {
      return FIELD_SCALES.volcanicSparse;
    }
    const hour = ((state.timeHours % 24) + 24) % 24;
    if (hour < 6 || hour >= 19.5) {
      return FIELD_SCALES.nightTemperate;
    }
    return FIELD_SCALES.dayTemperate;
  }

  private stepLayer1FieldPiano(ctx: AudioContext, dt: number, state: AudioUpdateState): void {
    if (!this.layer1Gain) return;

    if (this.fieldNotesRemaining > 0) {
      this.fieldNextNoteTimer -= dt;
      if (this.fieldNextNoteTimer <= 0) {
        const scale = this.getFieldScale(state);
        // Step gently near previous pitch for natural melodic contour
        let bestIdx = 0;
        let bestDist = 999;
        for (let i = 0; i < scale.length; i++) {
          const d = Math.abs(scale[i] - this.fieldLastMidi);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        const leap = Math.floor(Math.random() * 5) - 2; // -2..+2 scale degrees
        const nextIdx = clamp(bestIdx + leap, 0, scale.length - 1);
        const midi = scale[nextIdx];
        this.fieldLastMidi = midi;

        const velocity = 0.1 + Math.random() * 0.08;
        const duration = 2.4 + Math.random() * 1.9;
        const pan = (nextIdx / Math.max(1, scale.length - 1) - 0.5) * 0.45;
        this.playImpressionisticPianoNote(ctx, midi, velocity, duration, this.layer1Gain, pan);

        // Occasional delicate resonant dyad (perfect 5th or major 2nd)
        if (Math.random() < 0.25 && nextIdx >= 2) {
          this.playImpressionisticPianoNote(
            ctx,
            scale[nextIdx - 2],
            velocity * 0.58,
            duration * 1.1,
            this.layer1Gain,
            pan * -0.5
          );
        }

        this.fieldNotesRemaining--;
        if (this.fieldNotesRemaining > 0) {
          this.fieldNextNoteTimer = 0.55 + Math.random() * 1.15;
        } else {
          // Iconic BotW long open-air breathing silence (7–16 seconds)
          this.fieldPhraseCooldown = 7.0 + Math.random() * 9.0;
        }
      }
      return;
    }

    this.fieldPhraseCooldown -= dt;
    if (this.fieldPhraseCooldown <= 0) {
      this.fieldNotesRemaining = 2 + Math.floor(Math.random() * 4); // 2 to 5 delicate notes
      this.fieldNextNoteTimer = 0.05;
    }
  }

  private playImpressionisticPianoNote(
    ctx: AudioContext,
    midi: number,
    velocity: number,
    duration: number,
    dest: AudioNode,
    panAmount = 0
  ): void {
    const now = ctx.currentTime;
    const freq = midiToHz(midi);
    const pan = this.createPanner(ctx, panAmount);
    pan.connect(dest);

    if (this.reverbNode) {
      const send = ctx.createGain();
      send.gain.value = 0.52;
      pan.connect(send);
      send.connect(this.reverbNode);
    }

    // Fundamental + soft 2nd & 3rd piano overtones
    const partials: Array<{ mult: number; amp: number; decayMul: number; type: OscillatorType }> = [
      { mult: 1.0, amp: 1.0, decayMul: 1.0, type: 'sine' },
      { mult: 2.0, amp: 0.24, decayMul: 0.55, type: 'triangle' },
      { mult: 3.0, amp: 0.08, decayMul: 0.32, type: 'sine' },
    ];

    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.setValueAtTime(freq * p.mult, now);

      const g = ctx.createGain();
      const peak = velocity * p.amp;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration * p.decayMul);

      osc.connect(g);
      g.connect(pan);
      osc.start(now);
      osc.stop(now + duration * p.decayMul + 0.04);
    }
  }

  private stepLayer2Settlement(ctx: AudioContext, dt: number, style: SettlementBgmStyle): void {
    if (!this.layer2Gain) return;
    this.settlementStepTimer -= dt;
    if (this.settlementStepTimer > 0) return;

    const palette = SETTLEMENT_PALETTES[style];
    this.settlementStepTimer = palette.tempoSec * (0.9 + Math.random() * 0.2);

    const chord = palette.chords[this.settlementBarIndex % palette.chords.length];
    this.settlementBarIndex++;

    // Gentle acoustic arpeggiated chord bed
    chord.forEach((midi, idx) => {
      const delay = idx * 0.14;
      this.playSettlementPluck(
        ctx,
        midi,
        delay,
        0.075,
        palette.tempoSec * 1.15,
        palette.timbre,
        this.layer2Gain!,
        (idx - 1.5) * 0.2
      );
    });

    // Delicate regional melodic ornament on alternating bars
    if (Math.random() < 0.72) {
      const melodyNote = palette.scale[Math.floor(Math.random() * palette.scale.length)];
      this.playSettlementMelodyVoice(
        ctx,
        melodyNote,
        0.38,
        0.06,
        palette.tempoSec * 0.9,
        palette.timbre,
        this.layer2Gain
      );
    }
  }

  private playSettlementPluck(
    ctx: AudioContext,
    midi: number,
    delaySec: number,
    amp: number,
    durSec: number,
    timbre: 'shamisen' | 'harp' | 'flute' | 'celesta' | 'marimba' | 'oud',
    dest: AudioNode,
    panAmount: number
  ): void {
    const start = ctx.currentTime + delaySec;
    const freq = midiToHz(midi);

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const pan = this.createPanner(ctx, panAmount);

    if (timbre === 'shamisen' || timbre === 'oud') {
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 4.5, start);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.4, start + 0.35);
    } else if (timbre === 'celesta') {
      osc.type = 'sine';
      filter.type = 'highshelf';
      filter.frequency.value = 1800;
      filter.gain.value = 3;
    } else if (timbre === 'marimba') {
      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.value = freq * 2.5;
    } else {
      // Harp / acoustic guitar warmth
      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 3.8, start);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.3, start + durSec * 0.7);
    }

    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(amp, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + durSec);

    osc.connect(filter);
    filter.connect(g);
    g.connect(pan);
    pan.connect(dest);

    if (this.reverbNode) {
      const send = ctx.createGain();
      send.gain.value = timbre === 'celesta' ? 0.55 : 0.28;
      pan.connect(send);
      send.connect(this.reverbNode);
    }

    osc.start(start);
    osc.stop(start + durSec + 0.05);
  }

  private playSettlementMelodyVoice(
    ctx: AudioContext,
    midi: number,
    delaySec: number,
    amp: number,
    durSec: number,
    timbre: 'shamisen' | 'harp' | 'flute' | 'celesta' | 'marimba' | 'oud',
    dest: AudioNode
  ): void {
    const start = ctx.currentTime + delaySec;
    const freq = midiToHz(midi);

    const osc = ctx.createOscillator();
    osc.type = timbre === 'flute' || timbre === 'shamisen' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    // Gentle acoustic vibrato for flute/woodwind feel
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.8;
    const vibGain = ctx.createGain();
    vibGain.gain.value = timbre === 'flute' ? freq * 0.008 : freq * 0.003;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(amp, start + 0.14);
    g.gain.setValueAtTime(amp * 0.8, start + durSec * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, start + durSec);

    osc.connect(g);
    g.connect(dest);

    if (this.reverbNode) {
      const send = ctx.createGain();
      send.gain.value = 0.42;
      g.connect(send);
      send.connect(this.reverbNode);
    }

    osc.start(start);
    vib.start(start);
    osc.stop(start + durSec + 0.05);
    vib.stop(start + durSec + 0.05);
  }

  private stepLayer3Priority(ctx: AudioContext, dt: number, mode: BgmPriorityState): void {
    if (!this.layer3Gain) return;
    this.priorityStepTimer -= dt;
    if (this.priorityStepTimer > 0) return;

    const step = this.priorityStepIndex++;

    if (mode === 'guardianAlert') {
      // Iconic frantic staccato Guardian piano alarm (~158 BPM 16th-note pulse)
      this.priorityStepTimer = 0.095;
      const ostinato = [88, 87, 88, 91, 88, 87, 85, 87, 88, 94, 91, 88, 87, 84, 87, 88];
      const midi = ostinato[step % ostinato.length];
      this.playStaccatoPianoStab(ctx, midi, 0.13, 0.085, this.layer3Gain, (step % 2 === 0 ? -0.35 : 0.35));

      // Urgent syncopated bass strike + targeting laser beep
      if (step % 4 === 0) {
        this.playStaccatoPianoStab(ctx, step % 8 === 0 ? 40 : 41, 0.18, 0.19, this.layer3Gain, 0);
      }
      if (step % 8 === 0) {
        this.triggerGuardianBeep(ctx, this.layer3Gain);
      }
      return;
    }

    if (mode === 'bloodMoon') {
      // Eerie discordant reversed-feel swells + hollow dissonant chimes
      this.priorityStepTimer = 1.65;
      const eerieNotes = [66, 70, 73, 78, 82, 85];
      const midi = eerieNotes[step % eerieNotes.length];
      this.triggerReversedFeelSwell(ctx, midi, 1.35, 0.085, this.layer3Gain);
      return;
    }

    if (mode === 'hyruleCastle' || mode === 'boss') {
      // Majestic heroic orchestral march (brassy chord + timpani + driving ostinato)
      this.priorityStepTimer = 0.36;
      const motif = [62, 69, 67, 65, 64, 62, 65, 69, 74, 72, 71, 69, 67, 65, 64, 69];
      const bass = [38, 38, 45, 45, 46, 46, 45, 45];
      const leadMidi = motif[step % motif.length];
      const bassMidi = bass[Math.floor(step / 2) % bass.length];

      if (step % 2 === 0) {
        this.playHeroicBrassNote(ctx, leadMidi, 0.11, 0.55, this.layer3Gain);
      }
      if (step % 4 === 0) {
        this.playTimpaniHit(ctx, bassMidi, 0.22, this.layer3Gain);
      } else if (step % 2 === 1) {
        this.playCombatStringHit(ctx, bassMidi + 24, 0.07, 0.18, this.layer3Gain);
      }
      return;
    }

    if (mode === 'battle') {
      // Intense kinetic BotW combat percussion & staccato strings
      this.priorityStepTimer = 0.165;
      const pattern = [57, 60, 62, 64, 63, 62, 60, 55];
      const midi = pattern[step % pattern.length];

      if (step % 4 === 0) {
        this.playTimpaniHit(ctx, 45, 0.2, this.layer3Gain);
      } else if (step % 4 === 2) {
        this.playFrameDrumTick(ctx, 0.12, this.layer3Gain);
      }
      if (step % 2 === 0 || step % 7 === 0) {
        this.playCombatStringHit(ctx, midi, 0.095, 0.14, this.layer3Gain);
      }
      if (step % 8 === 3) {
        this.playStaccatoPianoStab(ctx, midi + 24, 0.085, 0.12, this.layer3Gain, 0.25);
      }
    }
  }

  private playStaccatoPianoStab(
    ctx: AudioContext,
    midi: number,
    amp: number,
    dur: number,
    dest: AudioNode,
    panAmt: number
  ): void {
    const now = ctx.currentTime;
    const freq = midiToHz(midi);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 4.5, now);
    lp.frequency.exponentialRampToValueAtTime(freq * 1.4, now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const pan = this.createPanner(ctx, panAmt);
    osc.connect(lp);
    lp.connect(g);
    g.connect(pan);
    pan.connect(dest);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private triggerGuardianBeep(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, now);
    osc.frequency.setValueAtTime(2093, now + 0.045);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.075, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  private triggerReversedFeelSwell(
    ctx: AudioContext,
    midi: number,
    dur: number,
    amp: number,
    dest: AudioNode
  ): void {
    const now = ctx.currentTime;
    const freq = midiToHz(midi);

    // Slight dissonant cluster with backward exponential swell envelope (crescendo -> abrupt cut)
    const freqs = [freq, freq * 1.05946]; // minor 2nd dissonance
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * 0.992, now);
      osc.frequency.linearRampToValueAtTime(f * 1.008, now + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0002, now);
      g.gain.exponentialRampToValueAtTime(amp, now + dur - 0.04);
      g.gain.linearRampToValueAtTime(0.0001, now + dur);

      osc.connect(g);
      g.connect(dest);
      if (this.reverbNode) {
        const send = ctx.createGain();
        send.gain.value = 0.65;
        g.connect(send);
        send.connect(this.reverbNode);
      }
      osc.start(now);
      osc.stop(now + dur + 0.04);
    }
  }

  private playHeroicBrassNote(
    ctx: AudioContext,
    midi: number,
    amp: number,
    dur: number,
    dest: AudioNode
  ): void {
    const now = ctx.currentTime;
    const freq = midiToHz(midi);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 1.004, now);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 1.6, now);
    lp.frequency.linearRampToValueAtTime(freq * 4.2, now + 0.09);
    lp.frequency.exponentialRampToValueAtTime(freq * 2.0, now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.045);
    g.gain.setValueAtTime(amp * 0.85, now + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc1.connect(lp);
    osc2.connect(lp);
    lp.connect(g);
    g.connect(dest);

    if (this.reverbNode) {
      const send = ctx.createGain();
      send.gain.value = 0.35;
      g.connect(send);
      send.connect(this.reverbNode);
    }

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.04);
    osc2.stop(now + dur + 0.04);
  }

  private playTimpaniHit(ctx: AudioContext, midi: number, amp: number, dest: AudioNode): void {
    const now = ctx.currentTime;
    const freq = midiToHz(midi);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.32, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.08);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    osc.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  private playFrameDrumTick(ctx: AudioContext, amp: number, dest: AudioNode): void {
    if (!this.whiteNoiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 620;
    bp.Q.value = 2.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(now, Math.random());
    src.stop(now + 0.09);
  }

  private playCombatStringHit(
    ctx: AudioContext,
    midi: number,
    amp: number,
    dur: number,
    dest: AudioNode
  ): void {
    const now = ctx.currentTime;
    const freq = midiToHz(midi);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 2.2;
    bp.Q.value = 1.6;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(bp);
    bp.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  // =========================================================================
  // CRISP PROCEDURAL SFX SUITE
  // =========================================================================

  private prepareSfx(): { ctx: AudioContext; bus: GainNode; now: number } | null {
    if (this.muted) return null;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return null;
    return { ctx, bus: this.sfxBus, now: ctx.currentTime };
  }

  public playSwordSwing(): void {
    const s = this.prepareSfx();
    if (!s || !this.whiteNoiseBuffer) return;
    const { ctx, bus, now } = s;

    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.0;
    bp.frequency.setValueAtTime(750, now);
    bp.frequency.exponentialRampToValueAtTime(2400, now + 0.065);
    bp.frequency.exponentialRampToValueAtTime(420, now + 0.17);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    src.connect(bp);
    bp.connect(g);
    g.connect(bus);
    src.start(now, Math.random());
    src.stop(now + 0.19);

    // Subtle metallic blade air shimmer
    const ring = ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(1650 + Math.random() * 250, now);
    ring.frequency.exponentialRampToValueAtTime(980, now + 0.12);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, now);
    rg.gain.linearRampToValueAtTime(0.05, now + 0.015);
    rg.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    ring.connect(rg);
    rg.connect(bus);
    ring.start(now);
    ring.stop(now + 0.14);
  }

  public playHitImpact(crit = false): void {
    const s = this.prepareSfx();
    if (!s || !this.whiteNoiseBuffer) return;
    const { ctx, bus, now } = s;

    // Punchy sub-bass thump
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(crit ? 220 : 155, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + (crit ? 0.18 : 0.11));

    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, now);
    sg.gain.linearRampToValueAtTime(crit ? 0.44 : 0.3, now + 0.005);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + (crit ? 0.2 : 0.12));

    sub.connect(sg);
    sg.connect(bus);
    sub.start(now);
    sub.stop(now + 0.22);

    // Midrange impact crunch
    const noise = ctx.createBufferSource();
    noise.buffer = this.whiteNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = crit ? 1900 : 1100;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(crit ? 0.32 : 0.22, now + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    noise.connect(bp);
    bp.connect(ng);
    ng.connect(bus);
    noise.start(now, Math.random());
    noise.stop(now + 0.1);

    // Critical hit bright crystalline shatter chime
    if (crit) {
      const partials = [1320, 1980, 2790];
      partials.forEach((hz, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(hz, now + idx * 0.012);
        osc.frequency.exponentialRampToValueAtTime(hz * 1.15, now + 0.22);
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.0001, now + idx * 0.012);
        cg.gain.linearRampToValueAtTime(0.14 / (idx + 1), now + idx * 0.012 + 0.008);
        cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc.connect(cg);
        cg.connect(bus);
        osc.start(now + idx * 0.012);
        osc.stop(now + 0.3);
      });
    }
  }

  public playParryClang(): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    // Resonant metallic inharmonic shield clang + heroic ring
    const freqs = [820, 1345, 2170, 3260];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.965, now + 0.52);

      const g = ctx.createGain();
      const peak = 0.22 / (idx * 0.65 + 1);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.56 - idx * 0.07);

      osc.connect(g);
      g.connect(bus);
      if (this.reverbNode && idx <= 1) {
        const send = ctx.createGain();
        send.gain.value = 0.4;
        g.connect(send);
        send.connect(this.reverbNode);
      }
      osc.start(now);
      osc.stop(now + 0.58);
    });
  }

  public playFlurryRushSlowmo(): void {
    const s = this.prepareSfx();
    if (!s || !this.pinkNoiseBuffer) return;
    const { ctx, bus, now } = s;

    // Time-dilation bass drop
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.58);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.36, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    osc.connect(g);
    g.connect(bus);
    osc.start(now);
    osc.stop(now + 0.68);

    // Sweeping air whoosh
    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, now);
    lp.frequency.exponentialRampToValueAtTime(260, now + 0.55);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(0.24, now + 0.08);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(bus);
    src.start(now);
    src.stop(now + 0.62);

    // Ethereal glass harmonic
    const chime = ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(1318.5, now + 0.04);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, now + 0.04);
    cg.gain.linearRampToValueAtTime(0.08, now + 0.12);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    chime.connect(cg);
    cg.connect(bus);
    chime.start(now + 0.04);
    chime.stop(now + 0.65);
  }

  public playBowRelease(): void {
    const s = this.prepareSfx();
    if (!s || !this.whiteNoiseBuffer) return;
    const { ctx, bus, now } = s;

    // Taut string twang
    const twang = ctx.createOscillator();
    twang.type = 'triangle';
    twang.frequency.setValueAtTime(290, now);
    twang.frequency.exponentialRampToValueAtTime(118, now + 0.13);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, now);
    tg.gain.linearRampToValueAtTime(0.24, now + 0.005);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    twang.connect(tg);
    tg.connect(bus);
    twang.start(now);
    twang.stop(now + 0.15);

    // Arrow fletching air whistle
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3.2;
    bp.frequency.setValueAtTime(3200, now + 0.01);
    bp.frequency.exponentialRampToValueAtTime(1250, now + 0.18);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now + 0.01);
    ng.gain.linearRampToValueAtTime(0.18, now + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(bus);
    src.start(now + 0.01, Math.random());
    src.stop(now + 0.2);
  }

  public playBulletTimeEnter(): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    // Deep focus pulse
    const pulse = ctx.createOscillator();
    pulse.type = 'sine';
    pulse.frequency.setValueAtTime(140, now);
    pulse.frequency.exponentialRampToValueAtTime(48, now + 0.42);
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.0001, now);
    pg.gain.linearRampToValueAtTime(0.3, now + 0.02);
    pg.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    pulse.connect(pg);
    pg.connect(bus);
    pulse.start(now);
    pulse.stop(now + 0.48);

    // Suspended crystal fifth (A5 + E6)
    [880, 1318.5].forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, now + idx * 0.03);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + idx * 0.03);
      g.gain.linearRampToValueAtTime(0.09, now + idx * 0.03 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      osc.connect(g);
      g.connect(bus);
      if (this.reverbNode) g.connect(this.reverbNode);
      osc.start(now + idx * 0.03);
      osc.stop(now + 0.58);
    });
  }

  public playRuneActivate(rune: RuneId): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    switch (rune) {
      case 'magnesis': {
        // Metallic magnetic lock hum + cyan sweep
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.24);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 680;
        bp.Q.value = 4.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.18, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
        osc.connect(bp);
        bp.connect(g);
        g.connect(bus);
        osc.start(now);
        osc.stop(now + 0.36);
        this.playSheikahToneCluster(ctx, [659.25, 987.77], 0.05, 0.1, 0.28, bus);
        break;
      }
      case 'bomb_round':
      case 'bomb_square': {
        const notes = rune === 'bomb_round' ? [587.33, 880, 1174.66] : [523.25, 783.99, 1046.5];
        this.playSheikahToneCluster(ctx, notes, 0.0, 0.12, 0.26, bus);
        break;
      }
      case 'stasis': {
        // Golden clockwork freeze chime
        this.playSheikahToneCluster(ctx, [739.99, 1108.73, 1479.98], 0.0, 0.13, 0.36, bus);
        break;
      }
      case 'cryonis': {
        // Frosty high crystalline sparkle
        this.playSheikahToneCluster(ctx, [1046.5, 1318.5, 1567.98, 2093], 0.0, 0.09, 0.34, bus);
        break;
      }
      case 'camera': {
        // Crisp Sheikah shutter click + confirmation beep
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1480, now);
        osc.frequency.setValueAtTime(1975, now + 0.045);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.15, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(g);
        g.connect(bus);
        osc.start(now);
        osc.stop(now + 0.13);
        break;
      }
      case 'master_cycle': {
        // Teleport materialize chime + ancient engine ignition
        this.playSheikahToneCluster(ctx, [523.25, 659.25, 783.99, 1046.5], 0.0, 0.1, 0.32, bus);
        this.playMasterCycleRev();
        break;
      }
    }
  }

  private playSheikahToneCluster(
    ctx: AudioContext,
    freqs: number[],
    baseDelay: number,
    amp: number,
    dur: number,
    dest: AudioNode
  ): void {
    const now = ctx.currentTime + baseDelay;
    freqs.forEach((hz, idx) => {
      const t0 = now + idx * 0.045;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(amp, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(dest);
      if (this.reverbNode) {
        const send = ctx.createGain();
        send.gain.value = 0.38;
        g.connect(send);
        send.connect(this.reverbNode);
      }
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    });
  }

  public playBombExplode(): void {
    const s = this.prepareSfx();
    if (!s || !this.pinkNoiseBuffer) return;
    const { ctx, bus, now } = s;

    // Massive sub-bass shockwave
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(118, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.55);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, now);
    sg.gain.linearRampToValueAtTime(0.5, now + 0.008);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    sub.connect(sg);
    sg.connect(bus);
    sub.start(now);
    sub.stop(now + 0.68);

    // Wideband blast noise + canyon tail
    const noise = ctx.createBufferSource();
    noise.buffer = this.pinkNoiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2800, now);
    lp.frequency.exponentialRampToValueAtTime(190, now + 0.9);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(0.42, now + 0.012);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(bus);
    if (this.reverbNode) {
      const send = ctx.createGain();
      send.gain.value = 0.45;
      ng.connect(send);
      send.connect(this.reverbNode);
    }
    noise.start(now);
    noise.stop(now + 1.0);
  }

  public playStasisTick(hits: number): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    const clampedHits = clamp(Math.floor(Number.isFinite(hits) ? hits : 0), 0, 20);
    // Escalating chromatic/kinetic pitch just like BotW Stasis kinetic charge
    const baseMidi = 69 + clampedHits * 1.15;
    const freq = midiToHz(baseMidi);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2.0, now);

    const g = ctx.createGain();
    const peak = 0.14 + Math.min(0.12, clampedHits * 0.008);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(g);
    overtone.connect(g);
    g.connect(bus);
    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.16);
    overtone.stop(now + 0.16);
  }

  public playCryonisRise(): void {
    const s = this.prepareSfx();
    if (!s || !this.whiteNoiseBuffer) return;
    const { ctx, bus, now } = s;

    // Freezing crackle burst
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(0.18, now + 0.04);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    src.connect(hp);
    hp.connect(ng);
    ng.connect(bus);
    src.start(now);
    src.stop(now + 0.4);

    // Rising crystalline ice-pillar chord glide
    const notes = [523.25, 783.99, 1046.5, 1567.98];
    notes.forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz * 0.72, now + idx * 0.035);
      osc.frequency.exponentialRampToValueAtTime(hz, now + 0.34);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + idx * 0.035);
      g.gain.linearRampToValueAtTime(0.1, now + idx * 0.035 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.56);
      osc.connect(g);
      g.connect(bus);
      if (this.reverbNode) g.connect(this.reverbNode);
      osc.start(now + idx * 0.035);
      osc.stop(now + 0.58);
    });
  }

  public playKorokYahaha(): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    // Iconic playful "Ya-ha-ha!" 3-note ascending woody marimba/flute motif + leaf twinkle
    const phrase = [
      { midi: 74, t: 0.0, d: 0.14 },
      { midi: 79, t: 0.13, d: 0.14 },
      { midi: 86, t: 0.26, d: 0.34 },
      { midi: 91, t: 0.38, d: 0.42 },
    ];
    for (const p of phrase) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const f = midiToHz(p.midi);
      osc.frequency.setValueAtTime(f * 0.96, now + p.t);
      osc.frequency.exponentialRampToValueAtTime(f, now + p.t + 0.025);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + p.t);
      g.gain.linearRampToValueAtTime(0.18, now + p.t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + p.t + p.d);

      osc.connect(g);
      g.connect(bus);
      if (this.reverbNode) {
        const send = ctx.createGain();
        send.gain.value = 0.35;
        g.connect(send);
        send.connect(this.reverbNode);
      }
      osc.start(now + p.t);
      osc.stop(now + p.t + p.d + 0.04);
    }
  }

  public playShrineChime(): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    // Mystic Sheikah pentatonic fifth chimes with ethereal valley tail
    const notes = [69, 76, 81, 88, 93];
    notes.forEach((midi, idx) => {
      const t0 = now + idx * 0.11;
      const f = midiToHz(midi);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);

      const harm = ctx.createOscillator();
      harm.type = 'sine';
      harm.frequency.setValueAtTime(f * 2.0, t0);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.35);

      const hg = ctx.createGain();
      hg.gain.setValueAtTime(0.0001, t0);
      hg.gain.linearRampToValueAtTime(0.045, t0 + 0.01);
      hg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);

      osc.connect(g);
      harm.connect(hg);
      g.connect(bus);
      hg.connect(bus);

      if (this.reverbNode) {
        const send = ctx.createGain();
        send.gain.value = 0.65;
        g.connect(send);
        send.connect(this.reverbNode);
      }

      osc.start(t0);
      harm.start(t0);
      osc.stop(t0 + 1.4);
      harm.stop(t0 + 0.7);
    });
  }

  public playChestFanfare(): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    // Celebratory classic treasure reveal arpeggio -> resonant major chord
    const steps = [
      { midi: 67, t: 0.0, d: 0.16 },
      { midi: 68, t: 0.14, d: 0.16 },
      { midi: 69, t: 0.28, d: 0.16 },
      { midi: 70, t: 0.42, d: 0.2 },
    ];
    for (const st of steps) {
      this.playHeroicBrassNoteAt(ctx, st.midi, now + st.t, 0.11, st.d, bus);
    }
    // Bright resolving major triad
    [72, 76, 79, 84].forEach((m) => {
      this.playHeroicBrassNoteAt(ctx, m, now + 0.62, 0.11, 0.85, bus);
    });
  }

  private playHeroicBrassNoteAt(
    ctx: AudioContext,
    midi: number,
    startTime: number,
    amp: number,
    dur: number,
    dest: AudioNode
  ): void {
    const freq = midiToHz(midi);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(amp, startTime + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    osc.connect(g);
    g.connect(dest);
    if (this.reverbNode) {
      const send = ctx.createGain();
      send.gain.value = 0.35;
      g.connect(send);
      send.connect(this.reverbNode);
    }
    osc.start(startTime);
    osc.stop(startTime + dur + 0.04);
  }

  public playCookingJingle(critical: boolean): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    // Playful bouncy cooking pot marimba melody
    const baseNotes = [
      { midi: 67, t: 0.0, d: 0.12 },
      { midi: 72, t: 0.13, d: 0.12 },
      { midi: 76, t: 0.26, d: 0.12 },
      { midi: 79, t: 0.39, d: 0.26 },
    ];
    const critFlourish = [
      { midi: 81, t: 0.56, d: 0.14 },
      { midi: 83, t: 0.68, d: 0.14 },
      { midi: 84, t: 0.8, d: 0.55 },
      { midi: 88, t: 0.8, d: 0.55 },
    ];

    const sequence = critical ? [...baseNotes, ...critFlourish] : baseNotes;
    for (const n of sequence) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(midiToHz(n.midi), now + n.t);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + n.t);
      g.gain.linearRampToValueAtTime(0.18, now + n.t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);

      osc.connect(g);
      g.connect(bus);
      if (this.reverbNode) {
        const send = ctx.createGain();
        send.gain.value = 0.28;
        g.connect(send);
        send.connect(this.reverbNode);
      }
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.04);
    }
  }

  public playMemoryChime(): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    // Poignant shimmering harp glissando + nostalgic suspended piano chord
    const gliss = [69, 71, 74, 76, 81, 83, 86, 88];
    gliss.forEach((midi, idx) => {
      const t0 = now + idx * 0.085;
      const freq = midiToHz(midi);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);

      const pan = this.createPanner(ctx, (idx / (gliss.length - 1) - 0.5) * 0.7);
      osc.connect(g);
      g.connect(pan);
      pan.connect(bus);
      if (this.reverbNode) {
        const send = ctx.createGain();
        send.gain.value = 0.7;
        pan.connect(send);
        send.connect(this.reverbNode);
      }
      osc.start(t0);
      osc.stop(t0 + 1.85);
    });
  }

  public playFootstep(surface: FootstepSurface): void {
    const s = this.prepareSfx();
    if (!s || !this.whiteNoiseBuffer || !this.pinkNoiseBuffer) return;
    const { ctx, bus, now } = s;
    const jitter = 0.9 + Math.random() * 0.2;

    if (surface === 'grass') {
      const src = ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1350 * jitter;
      bp.Q.value = 1.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
      src.connect(bp);
      bp.connect(g);
      g.connect(bus);
      src.start(now, Math.random());
      src.stop(now + 0.085);
      return;
    }

    if (surface === 'stone') {
      const src = ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2100 * jitter;
      bp.Q.value = 2.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.15, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);
      src.connect(bp);
      bp.connect(g);
      g.connect(bus);
      src.start(now, Math.random());
      src.stop(now + 0.05);
      return;
    }

    if (surface === 'snow') {
      // Textured crunchy double-grain snow step
      for (let i = 0; i < 2; i++) {
        const t0 = now + i * 0.028;
        const src = ctx.createBufferSource();
        src.buffer = this.whiteNoiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = (1150 + i * 650) * jitter;
        bp.Q.value = 1.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.12, t0 + 0.007);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.065);
        src.connect(bp);
        bp.connect(g);
        g.connect(bus);
        src.start(t0, Math.random());
        src.stop(t0 + 0.075);
      }
      return;
    }

    if (surface === 'sand') {
      const src = ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2500 * jitter;
      bp.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.1, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      src.connect(bp);
      bp.connect(g);
      g.connect(bus);
      src.start(now, Math.random());
      src.stop(now + 0.11);
      return;
    }

    // Water splash + resonant droplet bloop
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1750 * jitter;
    bp.Q.value = 1.0;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(0.14, now + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(bus);
    src.start(now, Math.random());
    src.stop(now + 0.14);

    const bloop = ctx.createOscillator();
    bloop.type = 'sine';
    bloop.frequency.setValueAtTime(420 * jitter, now);
    bloop.frequency.exponentialRampToValueAtTime(1050 * jitter, now + 0.08);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, now);
    bg.gain.linearRampToValueAtTime(0.075, now + 0.008);
    bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    bloop.connect(bg);
    bg.connect(bus);
    bloop.start(now);
    bloop.stop(now + 0.1);
  }

  public playUiSelect(): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(940, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.03);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);

    osc.connect(g);
    g.connect(bus);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playUiConfirm(): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    const notes = [880, 1318.5];
    notes.forEach((hz, idx) => {
      const t0 = now + idx * 0.045;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, t0);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);

      osc.connect(g);
      g.connect(bus);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    });
  }

  public playParagliderOpen(): void {
    const s = this.prepareSfx();
    if (!s || !this.pinkNoiseBuffer) return;
    const { ctx, bus, now } = s;

    // Crisp cloth billow snap
    const snap = ctx.createBufferSource();
    snap.buffer = this.pinkNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, now);
    bp.frequency.exponentialRampToValueAtTime(1550, now + 0.07);
    bp.frequency.exponentialRampToValueAtTime(380, now + 0.28);
    bp.Q.value = 1.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.32, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    snap.connect(bp);
    bp.connect(g);
    g.connect(bus);
    snap.start(now, Math.random());
    snap.stop(now + 0.34);
  }

  public playMasterCycleRev(): void {
    const s = this.prepareSfx();
    if (!s) return;
    const { ctx, bus, now } = s;

    // Ancient-tech motorcycle engine rev (throaty dual-oscillator formant sweep)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'square';

    osc1.frequency.setValueAtTime(72, now);
    osc1.frequency.exponentialRampToValueAtTime(210, now + 0.22);
    osc1.frequency.exponentialRampToValueAtTime(118, now + 0.54);

    osc2.frequency.setValueAtTime(144, now);
    osc2.frequency.exponentialRampToValueAtTime(422, now + 0.22);
    osc2.frequency.exponentialRampToValueAtTime(236, now + 0.54);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(360, now);
    filter.frequency.exponentialRampToValueAtTime(1280, now + 0.22);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.54);
    filter.Q.value = 2.0;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.04);
    g.gain.setValueAtTime(0.18, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(g);
    g.connect(bus);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  }

  /**
   * Cleanly closes AudioContext and removes gesture listeners if torn down.
   */
  public dispose(): void {
    this.unbindGestureListeners();
    if (this.ctx) {
      try {
        void this.ctx.close().catch(() => {});
      } catch {
        // Ignore
      }
      this.ctx = null;
    }
    this.initialized = false;
  }
}

export const audioEngine = new OpenAirAudioEngine();
