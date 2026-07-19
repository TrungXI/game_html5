import Phaser from "phaser";
import { MUTE_SAVE_KEY } from "../config/constants";

/**
 * One short synthesized SFX: an oscillator swept from `freq` to `endFreq` over
 * `duration` seconds, shaped by a fast attack / exponential decay gain envelope.
 * `endFreq` defaults to `freq` (a flat tone).
 */
interface Tone {
  freq: number;
  endFreq?: number;
  duration: number; // seconds (<0.2 keeps SFX snappy)
  type: OscillatorType;
  gain: number; // peak gain 0..1 (kept low so tones aren't harsh)
}

/**
 * SFX key → tone. Unknown keys fall through to a soft default blip. Every game
 * scene calls `audio.play("score" | "hit" | …)`; adding a key here makes it audible
 * everywhere immediately — scenes need no change.
 */
const TONES: Record<string, Tone> = {
  score: { freq: 660, endFreq: 990, duration: 0.1, type: "square", gain: 0.15 },
  hit: { freq: 200, endFreq: 90, duration: 0.14, type: "sawtooth", gain: 0.18 },
  jump: { freq: 380, endFreq: 720, duration: 0.12, type: "square", gain: 0.14 },
  merge: { freq: 520, endFreq: 780, duration: 0.11, type: "triangle", gain: 0.16 },
  break: { freq: 440, endFreq: 260, duration: 0.09, type: "square", gain: 0.15 },
  lose: { freq: 300, endFreq: 70, duration: 0.18, type: "sawtooth", gain: 0.18 },
  flip: { freq: 500, endFreq: 360, duration: 0.08, type: "triangle", gain: 0.12 },
  match: { freq: 700, endFreq: 1040, duration: 0.12, type: "triangle", gain: 0.16 },
  click: { freq: 620, duration: 0.05, type: "square", gain: 0.12 },
  levelup: { freq: 520, endFreq: 1040, duration: 0.18, type: "square", gain: 0.16 },
};

const DEFAULT_TONE: Tone = { freq: 480, duration: 0.06, type: "triangle", gain: 0.1 };

/** Lazily-created shared context; `null` until first play, `false` if unsupported. */
let ctx: AudioContext | false | null = null;
let gestureBound = false;

/** Resolve the AudioContext ctor across browsers; undefined if Web Audio is absent. */
function audioCtor(): typeof AudioContext | undefined {
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? w.webkitAudioContext;
}

/** Get (or create) the shared context; returns null when Web Audio is unavailable. */
function getContext(): AudioContext | null {
  if (ctx === false) return null;
  if (ctx) return ctx;
  const Ctor = audioCtor();
  if (!Ctor) {
    ctx = false;
    return null;
  }
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    ctx = false;
    return null;
  }
}

/**
 * Browsers suspend audio until a user gesture. Bind a one-shot resume to the
 * first pointer/key event on the game canvas so scenes stay gesture-agnostic.
 */
function bindGestureResume(scene: Phaser.Scene): void {
  if (gestureBound) return;
  gestureBound = true;
  const resume = (): void => {
    const c = getContext();
    if (c && c.state === "suspended") void c.resume();
  };
  scene.input.once("pointerdown", resume);
  scene.input.keyboard?.once("keydown", resume);
}

/** Corrupt-safe mute flag persisted in localStorage; mirrors SaveSystem's guard style. */
function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_SAVE_KEY) === "1";
  } catch {
    return false;
  }
}

let muted = loadMuted();

/**
 * Synthesizes short SFX at runtime via the Web Audio API — zero audio assets.
 * A single shared AudioContext is resumed on the first gesture. Every `play()`
 * is fully guarded: it can never throw if audio is unavailable, blocked, or muted.
 */
export class AudioManager {
  constructor(scene: Phaser.Scene) {
    bindGestureResume(scene);
  }

  play(key: string): void {
    if (muted) return;
    const c = getContext();
    if (!c || c.state === "closed") return;
    if (c.state === "suspended") return; // no gesture yet — stay silent, never throw

    const tone = TONES[key] ?? DEFAULT_TONE;
    try {
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.freq, now);
      if (tone.endFreq !== undefined && tone.endFreq !== tone.freq) {
        osc.frequency.exponentialRampToValueAtTime(tone.endFreq, now + tone.duration);
      }
      // Fast attack then exponential decay to near-silence — a soft, plucky blip.
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(tone.gain, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
      osc.connect(gain).connect(c.destination);
      osc.start(now);
      osc.stop(now + tone.duration + 0.02);
    } catch {
      /* audio node creation blocked — non-fatal, stay silent */
    }
  }

  /** Whether SFX are currently muted (persisted across sessions). */
  static isMuted(): boolean {
    return muted;
  }

  /** Flip and persist the mute flag; returns the new state. */
  static toggleMute(): boolean {
    muted = !muted;
    try {
      localStorage.setItem(MUTE_SAVE_KEY, muted ? "1" : "0");
    } catch {
      /* storage blocked (private mode) — ignore, non-fatal */
    }
    return muted;
  }
}
