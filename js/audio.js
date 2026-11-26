// ============================================================================
// LUMINA DIORAMA — Web Audio API Procedural Synthesizer (BGM & SE)
// Zero external audio assets — iPad Safari Auto-Unlock Ready
// 製作者：駿 (Created by Shun)
// ============================================================================

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 6 Melodic Looping Synth Tracks (16th-note step grids, 32 steps per bar loop)
const BGM_TRACKS = {
  title: {
    bpm: 108,
    leadWave: 'triangle',
    arpWave: 'sine',
    bassWave: 'sine',
    drums: false,
    lead: [
      74, 0, 78, 0, 81, 0, 0, 78, 76, 0, 74, 0, 71, 0, 0, 0,
      74, 0, 78, 0, 83, 0, 81, 0, 78, 0, 76, 0, 74, 0, 0, 0,
    ],
    arp: [
      62, 66, 69, 74, 62, 66, 69, 74, 59, 62, 66, 71, 59, 62, 66, 71,
      55, 59, 62, 67, 57, 61, 64, 69, 62, 66, 69, 74, 61, 64, 69, 73,
    ],
    bass: [
      50, 0, 0, 0, 50, 0, 0, 0, 47, 0, 0, 0, 47, 0, 0, 0,
      43, 0, 0, 0, 45, 0, 0, 0, 50, 0, 0, 0, 45, 0, 0, 0,
    ],
  },
  town: {
    bpm: 118,
    leadWave: 'triangle',
    arpWave: 'sine',
    bassWave: 'triangle',
    drums: true,
    drumStyle: 'light',
    lead: [
      72, 0, 76, 79, 84, 0, 79, 0, 81, 0, 79, 76, 74, 0, 0, 0,
      76, 0, 79, 81, 84, 0, 86, 0, 84, 0, 79, 76, 72, 0, 0, 0,
    ],
    arp: [
      60, 64, 67, 72, 60, 64, 67, 72, 65, 69, 72, 77, 62, 67, 71, 74,
      64, 67, 72, 76, 65, 69, 72, 77, 67, 71, 74, 79, 60, 64, 67, 72,
    ],
    bass: [
      48, 0, 0, 48, 52, 0, 55, 0, 53, 0, 0, 53, 55, 0, 43, 0,
      48, 0, 52, 0, 53, 0, 57, 0, 55, 0, 47, 0, 48, 0, 0, 0,
    ],
  },
  field: {
    bpm: 132,
    leadWave: 'sawtooth',
    arpWave: 'triangle',
    bassWave: 'sawtooth',
    drums: true,
    drumStyle: 'drive',
    lead: [
      76, 0, 79, 0, 83, 0, 81, 79, 76, 0, 74, 0, 71, 0, 74, 0,
      76, 0, 79, 83, 86, 0, 83, 0, 81, 0, 79, 78, 76, 0, 0, 0,
    ],
    arp: [
      64, 67, 71, 64, 67, 71, 76, 71, 60, 64, 67, 60, 62, 66, 69, 74,
      64, 67, 71, 64, 67, 71, 76, 71, 62, 66, 69, 74, 64, 67, 71, 76,
    ],
    bass: [
      40, 0, 40, 40, 43, 0, 47, 0, 48, 0, 48, 0, 50, 0, 47, 0,
      40, 0, 40, 43, 47, 0, 45, 0, 43, 0, 45, 0, 47, 0, 40, 0,
    ],
  },
  cave: {
    bpm: 96,
    leadWave: 'sine',
    arpWave: 'sine',
    bassWave: 'triangle',
    drums: false,
    lead: [
      78, 0, 0, 81, 85, 0, 0, 0, 83, 0, 81, 0, 78, 0, 0, 0,
      73, 0, 0, 76, 81, 0, 78, 0, 76, 0, 73, 0, 71, 0, 0, 0,
    ],
    arp: [
      66, 0, 69, 73, 78, 0, 73, 69, 64, 0, 68, 71, 76, 0, 71, 68,
      62, 0, 66, 69, 74, 0, 69, 66, 61, 0, 64, 68, 73, 0, 68, 64,
    ],
    bass: [
      42, 0, 0, 0, 0, 0, 42, 0, 40, 0, 0, 0, 0, 0, 40, 0,
      38, 0, 0, 0, 0, 0, 38, 0, 37, 0, 0, 0, 0, 0, 42, 0,
    ],
  },
  boss: {
    bpm: 152,
    leadWave: 'sawtooth',
    arpWave: 'square',
    bassWave: 'sawtooth',
    drums: true,
    drumStyle: 'intense',
    lead: [
      74, 74, 0, 77, 81, 0, 80, 77, 74, 0, 72, 74, 77, 0, 76, 0,
      74, 74, 0, 77, 86, 0, 84, 81, 79, 0, 77, 76, 74, 0, 81, 0,
    ],
    arp: [
      62, 65, 69, 74, 62, 65, 69, 74, 58, 62, 65, 70, 60, 64, 67, 72,
      62, 65, 69, 74, 55, 58, 62, 67, 57, 61, 64, 69, 62, 65, 69, 74,
    ],
    bass: [
      38, 38, 50, 38, 38, 38, 50, 38, 34, 34, 46, 34, 36, 36, 48, 36,
      38, 38, 50, 38, 43, 43, 55, 43, 45, 45, 57, 45, 38, 50, 45, 41,
    ],
  },
  finalboss: {
    bpm: 164,
    leadWave: 'sawtooth',
    arpWave: 'sawtooth',
    bassWave: 'sawtooth',
    drums: true,
    drumStyle: 'intense',
    lead: [
      72, 75, 79, 0, 84, 0, 83, 79, 80, 0, 79, 75, 74, 0, 79, 0,
      84, 0, 86, 87, 84, 0, 83, 79, 80, 79, 77, 75, 74, 72, 79, 84,
    ],
    arp: [
      60, 63, 67, 72, 60, 63, 67, 72, 56, 60, 63, 68, 55, 59, 62, 67,
      60, 63, 67, 72, 58, 62, 65, 70, 56, 60, 63, 68, 55, 59, 62, 71,
    ],
    bass: [
      36, 36, 48, 36, 36, 48, 36, 43, 32, 32, 44, 32, 31, 31, 43, 31,
      36, 36, 48, 36, 34, 34, 46, 34, 32, 32, 44, 32, 31, 43, 38, 35,
    ],
  },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.seGain = null;
    this.noiseBuffer = null;

    this.bgmVolume = 0.42;
    this.seVolume = 0.65;
    this.muted = false;

    this.currentTrack = null;
    this.stepIndex = 0;
    this.nextNoteTime = 0;
    this.schedulerId = null;
    this.unlocked = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.seGain = this.ctx.createGain();

      this.bgmGain.connect(this.masterGain);
      this.seGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.noiseBuffer = this._createNoiseBuffer();
      this._applyVolumes();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    // iOS silent buffer kick to guarantee Safari WebAudio unlock
    if (!this.unlocked && this.ctx) {
      try {
        const buf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.ctx.destination);
        src.start(0);
        this.unlocked = true;
      } catch (_) {}
    }
    if (this.currentTrack && !this.schedulerId) {
      this._startScheduler();
    }
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 1.0;
    const buffer = this.ctx.createBuffer(1, len, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  _applyVolumes() {
    if (!this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.02);
    this.bgmGain.gain.setTargetAtTime(this.bgmVolume * 0.45, now, 0.03);
    this.seGain.gain.setTargetAtTime(this.seVolume * 0.65, now, 0.02);
  }

  setBgmVolume(val) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    this._applyVolumes();
  }

  setSeVolume(val) {
    this.seVolume = Math.max(0, Math.min(1, val));
    this._applyVolumes();
  }

  toggleMute() {
    this.muted = !this.muted;
    this._applyVolumes();
    return this.muted;
  }

  setMuted(flag) {
    this.muted = Boolean(flag);
    this._applyVolumes();
  }

  playBgm(trackName) {
    if (!BGM_TRACKS[trackName]) return;
    if (this.currentTrack === trackName && this.schedulerId) return;
    this.currentTrack = trackName;
    this.stepIndex = 0;
    if (this.ctx) {
      this.nextNoteTime = this.ctx.currentTime + 0.06;
      this._startScheduler();
    }
  }

  stopBgm() {
    this.currentTrack = null;
    if (this.schedulerId) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  _startScheduler() {
    if (this.schedulerId) clearInterval(this.schedulerId);
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.schedulerId = setInterval(() => this._scheduleLoop(), 45);
  }

  _scheduleLoop() {
    if (!this.ctx || !this.currentTrack || this.ctx.state !== 'running') return;
    const track = BGM_TRACKS[this.currentTrack];
    if (!track) return;
    const stepDur = 60 / track.bpm / 4; // 16th note
    while (this.nextNoteTime < this.ctx.currentTime + 0.14) {
      this._playTrackStep(track, this.stepIndex, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.stepIndex = (this.stepIndex + 1) % 32;
    }
  }

  _playTrackStep(track, step, t, dur) {
    const leadNote = track.lead[step];
    const arpNote = track.arp[step];
    const bassNote = track.bass[step];

    if (leadNote > 0) {
      this._synthNote(midiToFreq(leadNote), t, dur * 1.85, track.leadWave, 0.22, 2600, this.bgmGain);
    }
    if (arpNote > 0) {
      this._synthNote(midiToFreq(arpNote), t, dur * 0.9, track.arpWave, 0.09, 2200, this.bgmGain);
    }
    if (bassNote > 0) {
      this._synthNote(midiToFreq(bassNote), t, dur * 1.4, track.bassWave, 0.24, 620, this.bgmGain);
    }
    if (track.drums) {
      const style = track.drumStyle || 'drive';
      if (step % 4 === 0 || (style === 'intense' && step % 8 === 6)) {
        this._playKick(t, style === 'light' ? 0.14 : 0.28, this.bgmGain);
      }
      if (step % 8 === 4) {
        this._playSnare(t, style === 'light' ? 0.07 : 0.16, this.bgmGain);
      }
      if (step % 2 === 1 && style !== 'light') {
        this._playHihat(t, 0.055, this.bgmGain);
      }
    }
  }

  _synthNote(freq, start, dur, type, peakGain, filterFreq, dest) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(200, filterFreq * 0.45), start + dur);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  _playKick(t, vol, dest) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.11);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  _playSnare(t, vol, dest) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(t);
    src.stop(t + 0.11);
  }

  _playHihat(t, vol, dest) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(t);
    src.stop(t + 0.045);
  }

  // ==========================================================================
  // PROCEDURAL SOUND EFFECTS (18 Distinct Crisp SEs)
  // ==========================================================================
  playSe(name) {
    if (!this.ctx || this.muted || this.seVolume <= 0.001) return;
    if (this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;

    switch (name) {
      case 'slash': {
        this._playNoiseSweep(t, 0.11, 2400, 620, 0.22);
        this._playPitchSweep(t, 0.1, 660, 210, 'triangle', 0.16);
        break;
      }
      case 'slashHeavy': {
        this._playNoiseSweep(t, 0.18, 3200, 420, 0.3);
        this._playPitchSweep(t, 0.16, 820, 140, 'sawtooth', 0.22);
        break;
      }
      case 'fire': {
        this._playNoiseSweep(t, 0.28, 900, 260, 0.34);
        this._playPitchSweep(t, 0.25, 340, 120, 'sawtooth', 0.2);
        break;
      }
      case 'ice': {
        [1046, 1318, 1568, 2093].forEach((f, i) => {
          this._synthNote(f, t + i * 0.03, 0.22, 'sine', 0.18, 6000, this.seGain);
        });
        break;
      }
      case 'lightning': {
        this._playNoiseSweep(t, 0.2, 5200, 1200, 0.32);
        this._playPitchSweep(t, 0.16, 1800, 320, 'square', 0.2);
        break;
      }
      case 'heal': {
        [523, 659, 784, 1046].forEach((f, i) => {
          this._synthNote(f, t + i * 0.055, 0.32, 'triangle', 0.2, 4200, this.seGain);
        });
        break;
      }
      case 'buff': {
        [440, 554, 659, 880, 1108].forEach((f, i) => {
          this._synthNote(f, t + i * 0.04, 0.24, 'sawtooth', 0.14, 3400, this.seGain);
        });
        break;
      }
      case 'hit': {
        this._playPitchSweep(t, 0.08, 240, 72, 'square', 0.22);
        this._playNoiseSweep(t, 0.06, 1800, 500, 0.15);
        break;
      }
      case 'crit': {
        this._playPitchSweep(t, 0.14, 980, 280, 'sawtooth', 0.26);
        this._synthNote(1480, t + 0.02, 0.18, 'triangle', 0.24, 5200, this.seGain);
        this._playKick(t, 0.36, this.seGain);
        break;
      }
      case 'limit': {
        this._playPitchSweep(t, 0.45, 180, 1420, 'sawtooth', 0.28);
        this._playNoiseSweep(t + 0.1, 0.55, 3600, 240, 0.36);
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          this._synthNote(f, t + 0.14 + i * 0.05, 0.42, 'sawtooth', 0.18, 4500, this.seGain);
        });
        break;
      }
      case 'dash': {
        this._playNoiseSweep(t, 0.13, 2800, 900, 0.18);
        this._playPitchSweep(t, 0.11, 520, 880, 'sine', 0.12);
        break;
      }
      case 'step': {
        this._playPitchSweep(t, 0.04, 150, 75, 'triangle', 0.055);
        break;
      }
      case 'coin': {
        this._synthNote(987, t, 0.09, 'sine', 0.17, 5000, this.seGain);
        this._synthNote(1318, t + 0.06, 0.16, 'sine', 0.18, 5000, this.seGain);
        break;
      }
      case 'chest': {
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          this._synthNote(f, t + i * 0.07, 0.3, 'triangle', 0.22, 4800, this.seGain);
        });
        break;
      }
      case 'forge': {
        this._synthNote(1244, t, 0.26, 'triangle', 0.28, 6000, this.seGain);
        this._synthNote(1864, t + 0.02, 0.22, 'sine', 0.22, 6000, this.seGain);
        this._playNoiseSweep(t, 0.12, 4200, 1200, 0.22);
        break;
      }
      case 'levelup': {
        [523, 659, 784, 987, 1046, 1318].forEach((f, i) => {
          this._synthNote(f, t + i * 0.065, 0.34, 'triangle', 0.24, 5200, this.seGain);
        });
        break;
      }
      case 'warning': {
        for (let i = 0; i < 3; i++) {
          this._playPitchSweep(t + i * 0.28, 0.22, 540, 290, 'sawtooth', 0.24);
        }
        break;
      }
      case 'crack': {
        this._playNoiseSweep(t, 0.22, 1600, 180, 0.36);
        this._playPitchSweep(t, 0.18, 210, 55, 'square', 0.26);
        break;
      }
      case 'switch': {
        this._synthNote(660, t, 0.1, 'square', 0.15, 3000, this.seGain);
        this._synthNote(990, t + 0.08, 0.16, 'triangle', 0.18, 4000, this.seGain);
        break;
      }
      case 'chat': {
        this._synthNote(784, t, 0.08, 'sine', 0.15, 4000, this.seGain);
        this._synthNote(1046, t + 0.055, 0.11, 'sine', 0.15, 4000, this.seGain);
        break;
      }
      case 'stamp': {
        this._synthNote(659, t, 0.08, 'triangle', 0.18, 4500, this.seGain);
        this._synthNote(880, t + 0.06, 0.09, 'triangle', 0.18, 4500, this.seGain);
        this._synthNote(1318, t + 0.12, 0.16, 'triangle', 0.2, 4500, this.seGain);
        break;
      }
      case 'trophy': {
        [659, 784, 1046, 1318, 1568].forEach((f, i) => {
          this._synthNote(f, t + i * 0.075, 0.38, 'triangle', 0.22, 5600, this.seGain);
        });
        break;
      }
      case 'hurt': {
        this._playPitchSweep(t, 0.15, 280, 90, 'sawtooth', 0.24);
        break;
      }
      case 'revive': {
        [440, 554, 659, 880, 1108, 1318].forEach((f, i) => {
          this._synthNote(f, t + i * 0.06, 0.32, 'sine', 0.22, 5200, this.seGain);
        });
        break;
      }
      case 'bossDefeat': {
        this._playNoiseSweep(t, 0.65, 2200, 120, 0.38);
        [392, 494, 587, 784, 987, 1175].forEach((f, i) => {
          this._synthNote(f, t + 0.2 + i * 0.09, 0.5, 'triangle', 0.24, 5400, this.seGain);
        });
        break;
      }
      case 'uiClick':
      default: {
        this._synthNote(880, t, 0.055, 'sine', 0.12, 4000, this.seGain);
        break;
      }
    }
  }

  _playPitchSweep(start, dur, f1, f2, type, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), start + dur);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  _playNoiseSweep(start, dur, f1, f2, vol) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(f1, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, f2), start + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.seGain);
    src.start(start);
    src.stop(start + dur + 0.02);
  }
}
