/**
 * Web Audio API Sound Synthesizer for Lucky Draw Wheel & Interactive Games.
 * Safe for SSR and client side hydration.
 * Provides realistic mechanical wheel ticks, spin whoosh, suspense tension,
 * and rich celebratory victory fanfare with crowds and sparkling chimes.
 */
class SoundManager {
  private audioCtx: AudioContext | null = null;
  private muted = false;
  private soundStyle: 'fanfare' | 'applause' | 'chimes' = 'fanfare';
  private drumInterval: ReturnType<typeof setInterval> | null = null;
  private isSpinningSoundActive = false;

  init() {
    if (typeof window === 'undefined') return;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  setSoundStyle(style: 'fanfare' | 'applause' | 'chimes') {
    this.soundStyle = style;
  }

  // Play a short whoosh / launch sound when wheel is released
  playSpinStart() {
    if (this.muted || typeof window === 'undefined') return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;

      // 1. Air whoosh / acceleration noise sweep
      const bufferSize = Math.floor(this.audioCtx.sampleRate * 0.35);
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + 0.2);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.35);
      filter.Q.value = 2.5;

      const noiseGain = this.audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.01, now);
      noiseGain.gain.linearRampToValueAtTime(0.25, now + 0.1);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.audioCtx.destination);

      noise.start(now);
      noise.stop(now + 0.36);

      // 2. Heavy mechanical release click
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
      oscGain.gain.setValueAtTime(0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(oscGain);
      oscGain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // AudioContext silent catch
    }
  }

  // Start suspenseful rolling ratchet hum during spin
  startSpinDrumroll() {
    if (this.muted || typeof window === 'undefined') return;
    this.init();
    if (!this.audioCtx) return;

    this.stopSpinDrumroll();
    this.isSpinningSoundActive = true;

    let beatCount = 0;
    this.drumInterval = setInterval(() => {
      if (!this.isSpinningSoundActive || !this.audioCtx) return;
      try {
        beatCount++;
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // Alternating low pitch tension pulse
        const baseFreq = 70 + (beatCount % 3) * 18;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.07);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
      } catch {
        // AudioContext silent catch
      }
    }, 95);
  }

  stopSpinDrumroll() {
    this.isSpinningSoundActive = false;
    if (this.drumInterval) {
      clearInterval(this.drumInterval);
      this.drumInterval = null;
    }
  }

  /**
   * Play an authentic tactile click as wheel peg strikes flapper.
   * High velocity = rapid, crisp, high-pitched ticks.
   * Low velocity (slow) = heavy, deep, dramatic suspense clicks.
   */
  playTick(velocityRatio = 1.0) {
    if (this.muted || typeof window === 'undefined') return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const clampedVelocity = Math.max(0.05, Math.min(1.0, velocityRatio));

      // Layer 1: High crisp flapper snap
      const snapOsc = this.audioCtx.createOscillator();
      const snapGain = this.audioCtx.createGain();

      const snapStartFreq = 950 + clampedVelocity * 450 + Math.random() * 80;
      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(snapStartFreq, now);
      snapOsc.frequency.exponentialRampToValueAtTime(320, now + 0.015);

      const snapVol = 0.18 + clampedVelocity * 0.18;
      snapGain.gain.setValueAtTime(snapVol, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

      snapOsc.connect(snapGain);
      snapGain.connect(this.audioCtx.destination);
      snapOsc.start(now);
      snapOsc.stop(now + 0.02);

      // Layer 2: Resonant peg thud (more prominent when slowing down for suspense)
      const thudOsc = this.audioCtx.createOscillator();
      const thudGain = this.audioCtx.createGain();

      const thudFreq = 260 + clampedVelocity * 80;
      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(thudFreq, now);
      thudOsc.frequency.exponentialRampToValueAtTime(80, now + 0.035);

      const thudVol = 0.15 + (1 - clampedVelocity) * 0.15; // Louder body when slow
      thudGain.gain.setValueAtTime(thudVol, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      thudOsc.connect(thudGain);
      thudGain.connect(this.audioCtx.destination);
      thudOsc.start(now);
      thudOsc.stop(now + 0.04);
    } catch {
      // AudioContext silent catch
    }
  }

  // Play victory celebration sound based on preference
  playWinFanfare(customStyle?: 'fanfare' | 'applause' | 'chimes') {
    this.stopSpinDrumroll();
    if (this.muted || typeof window === 'undefined') return;
    this.init();
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    const style = customStyle || this.soundStyle;

    if (style === 'applause') {
      this.playApplauseSound();
    } else if (style === 'chimes') {
      this.playChimesSound();
    } else {
      this.playFanfareSound();
    }
  }

  /**
   * Grand triumphant brass/synth fanfare with harmonic chords + celebratory bells + crowd cheers!
   */
  playFanfareSound() {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    // Chords: G major triad -> C major -> D major -> Grand G major finale
    const chordNotes = [
      // Chord 1 (0.00s): G4, B4, D5
      { freqs: [392.0, 493.88, 587.33], duration: 0.18, time: now + 0.0 },
      // Chord 2 (0.18s): G4, C5, E5
      { freqs: [392.0, 523.25, 659.25], duration: 0.18, time: now + 0.18 },
      // Chord 3 (0.36s): A4, D5, F#5
      { freqs: [440.0, 587.33, 739.99], duration: 0.22, time: now + 0.36 },
      // Finale Chord (0.60s): G4, B4, D5, G5 (long sustain, bright fanfare)
      { freqs: [392.0, 493.88, 587.33, 783.99], duration: 1.4, time: now + 0.6 },
    ];

    chordNotes.forEach(({ freqs, duration, time }) => {
      freqs.forEach((freq, idx) => {
        try {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = idx === 0 ? 'triangle' : 'sawtooth';
          osc.frequency.setValueAtTime(freq, time);

          // Subtle detune for rich brass warmth
          osc.detune.setValueAtTime((idx - 1) * 6, time);

          const vol = idx === freqs.length - 1 ? 0.22 : 0.15;
          gain.gain.setValueAtTime(0.001, time);
          gain.gain.linearRampToValueAtTime(vol, time + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(time);
          osc.stop(time + duration + 0.05);
        } catch {
          // AudioContext silent catch
        }
      });
    });

    // Cascading celebratory sparkles on finale
    const sparkleNotes = [783.99, 987.77, 1174.66, 1567.98];
    sparkleNotes.forEach((f, i) => {
      const sparkleTime = now + 0.65 + i * 0.09;
      try {
        if (!this.audioCtx) return;
        const sOsc = this.audioCtx.createOscillator();
        const sGain = this.audioCtx.createGain();

        sOsc.type = 'sine';
        sOsc.frequency.setValueAtTime(f, sparkleTime);

        sGain.gain.setValueAtTime(0.12, sparkleTime);
        sGain.gain.exponentialRampToValueAtTime(0.001, sparkleTime + 0.4);

        sOsc.connect(sGain);
        sGain.connect(this.audioCtx.destination);
        sOsc.start(sparkleTime);
        sOsc.stop(sparkleTime + 0.42);
      } catch {}
    });

    // Layer with cheering crowd applause
    setTimeout(() => {
      this.playApplauseSound(1.8);
    }, 450);
  }

  playChimesSound() {
    const chimes = [587.33, 739.99, 880.0, 1174.66, 1479.98, 1760.0, 2093.0];
    chimes.forEach((freq, index) => {
      setTimeout(() => {
        try {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

          gain.gain.setValueAtTime(0.28, this.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.8);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.85);
        } catch {
          // AudioContext silent catch
        }
      }, index * 85);
    });
  }

  playApplauseSound(durationSec = 2.2) {
    try {
      if (!this.audioCtx) return;
      const bufferSize = Math.floor(this.audioCtx.sampleRate * durationSec);
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        // Natural clapping envelope noise
        data[i] = (Math.random() * 2 - 1) * 0.9;
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 1.2;

      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime;
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      noise.start(now);
      noise.stop(now + durationSec + 0.05);
    } catch {
      // AudioContext silent catch
    }
  }

  // Subtle clean click for interactive UI buttons
  playClick() {
    if (this.muted || typeof window === 'undefined') return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.025);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }
}

export const soundManager = new SoundManager();
