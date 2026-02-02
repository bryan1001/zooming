/**
 * Beat detection module for detecting beats from audio frequency data.
 * Analyzes low frequency bands (kick drums ~60-150Hz) and triggers
 * events when energy exceeds a rolling average threshold.
 */

import { getFrequencyData } from './audioAnalyser';
import { getAudioContext } from './audioPlayer';

// Beat detection configuration
const BEAT_THRESHOLD = 1.5; // Energy must exceed rolling average by this factor
const HISTORY_SIZE = 43; // ~1 second of history at 60fps (adjust based on frame rate)
const MIN_BEAT_INTERVAL_MS = 100; // Minimum time between beats to avoid double-triggers

// Transition detection configuration
const TRANSITION_HISTORY_SIZE = 120; // ~2 seconds of history at 60fps
const TRANSITION_THRESHOLD = 2.0; // Energy change must be this factor greater than short-term average
const MIN_TRANSITION_INTERVAL_MS = 8000; // Max 1 transition per 8 seconds (debounce)

// Heavy beat shift detection configuration
const HEAVY_BEAT_THRESHOLD = 2.5; // Energy must exceed rolling average by this factor (vs 1.5x for regular)
const HEAVY_BEAT_PRE_SILENCE_FRAMES = 12; // ~200ms at 60fps to check for silence before spike
const HEAVY_BEAT_LOW_ENERGY_FACTOR = 0.5; // Pre-spike energy must be below this factor of rolling average
const MIN_HEAVY_BEAT_INTERVAL_MS = 2000; // Max 1 heavy beat shift per 2 seconds (debounce)

// State
let beatCallbacks: ((intensity: number) => void)[] = [];
let transitionCallbacks: ((intensity: number) => void)[] = [];
let heavyBeatShiftCallbacks: ((intensity: number) => void)[] = [];
let energyHistory: number[] = [];
let longTermEnergyHistory: number[] = []; // For transition detection (2 second window)
let lastBeatTime = 0;
let lastTransitionTime = 0;
let lastHeavyBeatShiftTime = 0;
let currentBeatIntensity = 0;

/**
 * Calculate the average energy in the kick drum frequency range.
 */
function getKickEnergy(): number {
  const frequencyData = getFrequencyData();
  if (frequencyData.length === 0) {
    return 0;
  }

  // Get sample rate dynamically to calculate correct frequency bins
  const audioContext = getAudioContext();
  const sampleRate = audioContext?.sampleRate || 44100;
  const fftSize = 2048;

  // Calculate bin indices for 60-150Hz range
  const startBin = Math.floor(60 * fftSize / sampleRate);
  const endBin = Math.ceil(150 * fftSize / sampleRate);

  // Clamp to valid range
  const start = Math.max(0, Math.min(startBin, frequencyData.length - 1));
  const end = Math.max(start + 1, Math.min(endBin, frequencyData.length));

  // Calculate average energy in the kick range
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += frequencyData[i];
  }

  return sum / (end - start);
}

/**
 * Get the rolling average of energy history.
 */
function getRollingAverage(): number {
  if (energyHistory.length === 0) {
    return 0;
  }

  const sum = energyHistory.reduce((acc, val) => acc + val, 0);
  return sum / energyHistory.length;
}

/**
 * Get the long-term rolling average for transition detection.
 */
function getLongTermAverage(): number {
  if (longTermEnergyHistory.length === 0) {
    return 0;
  }

  const sum = longTermEnergyHistory.reduce((acc, val) => acc + val, 0);
  return sum / longTermEnergyHistory.length;
}

/**
 * Get recent average (last ~0.5 seconds) to compare against long-term.
 */
function getRecentAverage(): number {
  const recentSize = 30; // ~0.5 seconds at 60fps
  if (longTermEnergyHistory.length < recentSize) {
    return 0;
  }

  const recentSlice = longTermEnergyHistory.slice(-recentSize);
  const sum = recentSlice.reduce((acc, val) => acc + val, 0);
  return sum / recentSlice.length;
}

/**
 * Detect heavy beat shifts - musically significant moments characterized by
 * an energy spike > 2.5x rolling average preceded by silence/low energy.
 * Returns true if a heavy beat shift was detected.
 */
export function detectHeavyBeatShift(): boolean {
  const currentEnergy = getKickEnergy();
  const rollingAverage = getRollingAverage();

  // Need enough history for comparison
  if (energyHistory.length < HEAVY_BEAT_PRE_SILENCE_FRAMES + 5) {
    return false;
  }

  const now = performance.now();
  const timeSinceLastHeavyBeat = now - lastHeavyBeatShiftTime;

  // Enforce debounce: max 1 heavy beat shift per 2 seconds
  if (timeSinceLastHeavyBeat < MIN_HEAVY_BEAT_INTERVAL_MS) {
    return false;
  }

  // Require minimum rolling average to avoid false positives during silence
  if (rollingAverage < 10) {
    return false;
  }

  // Check if current energy exceeds heavy beat threshold (2.5x rolling average)
  if (currentEnergy <= rollingAverage * HEAVY_BEAT_THRESHOLD) {
    return false;
  }

  // Check for silence or low energy in the 200ms before the spike
  // Look at frames from -HEAVY_BEAT_PRE_SILENCE_FRAMES to -1 (before the current spike)
  const preSilenceStartIndex = Math.max(0, energyHistory.length - HEAVY_BEAT_PRE_SILENCE_FRAMES - 1);
  const preSilenceEndIndex = energyHistory.length - 1; // Don't include the very last frame (spike buildup)

  let preSilenceSum = 0;
  let preSilenceCount = 0;
  for (let i = preSilenceStartIndex; i < preSilenceEndIndex; i++) {
    preSilenceSum += energyHistory[i];
    preSilenceCount++;
  }

  if (preSilenceCount === 0) {
    return false;
  }

  const preSilenceAverage = preSilenceSum / preSilenceCount;
  const lowEnergyThreshold = rollingAverage * HEAVY_BEAT_LOW_ENERGY_FACTOR;

  // Pre-spike period must have low energy (below 0.5x rolling average)
  if (preSilenceAverage >= lowEnergyThreshold) {
    return false;
  }

  // Heavy beat shift detected!
  lastHeavyBeatShiftTime = now;

  // Calculate intensity based on how much we exceeded the threshold
  const rawIntensity = (currentEnergy / (rollingAverage * HEAVY_BEAT_THRESHOLD)) - 1;
  const intensity = Math.min(1, Math.max(0, rawIntensity * 2));

  // Notify all subscribers
  for (const callback of heavyBeatShiftCallbacks) {
    callback(intensity);
  }

  return true;
}

/**
 * Update beat detection. Call this every frame.
 * Returns true if a beat was detected this frame.
 */
export function updateBeatDetection(): boolean {
  const currentEnergy = getKickEnergy();
  const rollingAverage = getRollingAverage();

  // Add current energy to history
  energyHistory.push(currentEnergy);
  if (energyHistory.length > HISTORY_SIZE) {
    energyHistory.shift();
  }

  // Add to long-term history for transition detection
  longTermEnergyHistory.push(currentEnergy);
  if (longTermEnergyHistory.length > TRANSITION_HISTORY_SIZE) {
    longTermEnergyHistory.shift();
  }

  // Check for transitions (significant energy changes over 1-2 second window)
  checkForTransition();

  // Check for heavy beat shifts (for turn triggers)
  detectHeavyBeatShift();

  // Need enough history for comparison
  if (energyHistory.length < HISTORY_SIZE / 2) {
    return false;
  }

  // Check for beat
  const now = performance.now();
  const timeSinceLastBeat = now - lastBeatTime;

  // Beat detected if:
  // 1. Current energy exceeds threshold * rolling average
  // 2. Enough time has passed since last beat
  // 3. Rolling average is not zero (audio is playing)
  if (
    rollingAverage > 10 && // Minimum threshold to avoid false positives during silence
    currentEnergy > rollingAverage * BEAT_THRESHOLD &&
    timeSinceLastBeat > MIN_BEAT_INTERVAL_MS
  ) {
    lastBeatTime = now;

    // Calculate intensity as how much we exceeded the threshold (0-1 scale)
    // intensity = (current / (average * threshold) - 1) normalized
    const rawIntensity = (currentEnergy / (rollingAverage * BEAT_THRESHOLD)) - 1;
    currentBeatIntensity = Math.min(1, Math.max(0, rawIntensity * 2)); // Scale and clamp

    // Notify all subscribers
    for (const callback of beatCallbacks) {
      callback(currentBeatIntensity);
    }

    return true;
  }

  // Decay beat intensity over time
  currentBeatIntensity = Math.max(0, currentBeatIntensity - 0.05);

  return false;
}

/**
 * Check for musical transitions (drops, breakdowns, etc.).
 * Transitions are detected by comparing recent energy to long-term average.
 */
function checkForTransition(): void {
  // Need enough history for comparison
  if (longTermEnergyHistory.length < TRANSITION_HISTORY_SIZE) {
    return;
  }

  const now = performance.now();
  const timeSinceLastTransition = now - lastTransitionTime;

  // Enforce debounce: max 1 transition per 8 seconds
  if (timeSinceLastTransition < MIN_TRANSITION_INTERVAL_MS) {
    return;
  }

  const longTermAverage = getLongTermAverage();
  const recentAverage = getRecentAverage();

  // Require minimum energy to avoid false positives during silence
  if (longTermAverage < 15) {
    return;
  }

  // Calculate the ratio of recent energy to long-term average
  // A drop will show recent >> long-term (energy spike/drop)
  // A breakdown will show recent << long-term (energy decrease)
  const energyRatio = recentAverage / longTermAverage;

  // Detect significant energy increase (like a drop/build-up)
  // Or significant energy decrease (like a breakdown)
  let transitionIntensity = 0;

  if (energyRatio > TRANSITION_THRESHOLD) {
    // Energy spike (drop, build-up climax)
    transitionIntensity = Math.min(1, (energyRatio - TRANSITION_THRESHOLD) / TRANSITION_THRESHOLD);
  } else if (energyRatio < 1 / TRANSITION_THRESHOLD) {
    // Energy dip (breakdown, quiet section)
    transitionIntensity = Math.min(1, ((1 / energyRatio) - TRANSITION_THRESHOLD) / TRANSITION_THRESHOLD);
  }

  // Trigger transition if intensity is significant
  if (transitionIntensity > 0.2) {
    lastTransitionTime = now;

    // Notify all subscribers
    for (const callback of transitionCallbacks) {
      callback(transitionIntensity);
    }
  }
}

/**
 * Subscribe to beat events.
 * Callback receives the beat intensity (0-1).
 */
export function onBeat(callback: (intensity: number) => void): void {
  beatCallbacks.push(callback);
}

/**
 * Unsubscribe from beat events.
 */
export function offBeat(callback: (intensity: number) => void): void {
  beatCallbacks = beatCallbacks.filter(cb => cb !== callback);
}

/**
 * Subscribe to transition events (drops, breakdowns, major musical shifts).
 * Callback receives the transition intensity (0-1).
 * Transitions are debounced to max 1 per 8 seconds.
 */
export function onTransition(callback: (intensity: number) => void): void {
  transitionCallbacks.push(callback);
}

/**
 * Unsubscribe from transition events.
 */
export function offTransition(callback: (intensity: number) => void): void {
  transitionCallbacks = transitionCallbacks.filter(cb => cb !== callback);
}

/**
 * Subscribe to heavy beat shift events.
 * Heavy beat shifts are musically significant moments (energy spike > 2.5x average
 * preceded by silence/low energy). Used to trigger dramatic turns.
 * Callback receives the shift intensity (0-1).
 * Heavy beat shifts are debounced to max 1 per 2 seconds.
 */
export function onHeavyBeatShift(callback: (intensity: number) => void): void {
  heavyBeatShiftCallbacks.push(callback);
}

/**
 * Unsubscribe from heavy beat shift events.
 */
export function offHeavyBeatShift(callback: (intensity: number) => void): void {
  heavyBeatShiftCallbacks = heavyBeatShiftCallbacks.filter(cb => cb !== callback);
}

/**
 * Get the current beat intensity (0-1).
 * This value pulses high on beats and decays between them.
 */
export function getBeatIntensity(): number {
  return currentBeatIntensity;
}

/**
 * Reset beat detection state.
 * Call this when starting a new track or resetting.
 */
export function resetBeatDetection(): void {
  energyHistory = [];
  longTermEnergyHistory = [];
  lastBeatTime = 0;
  lastTransitionTime = 0;
  lastHeavyBeatShiftTime = 0;
  currentBeatIntensity = 0;
}
