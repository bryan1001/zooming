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

// State
let beatCallbacks: ((intensity: number) => void)[] = [];
let energyHistory: number[] = [];
let lastBeatTime = 0;
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
  lastBeatTime = 0;
  currentBeatIntensity = 0;
}
