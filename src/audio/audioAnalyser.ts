/**
 * Audio analyser module for accessing frequency data from the playing audio.
 * Connects an AnalyserNode to the audio source for real-time frequency analysis.
 */

import { getAudioContext } from './audioPlayer';

let analyserNode: AnalyserNode | null = null;
let frequencyData: Uint8Array<ArrayBuffer> | null = null;

const FFT_SIZE = 2048;

/**
 * Initialize the analyser node and connect it to the audio context.
 * Must be called after audio context is created.
 */
export function initAnalyser(): AnalyserNode | null {
  const audioContext = getAudioContext();
  if (!audioContext) {
    console.error('AudioContext not initialized. Call initAudio() first.');
    return null;
  }

  if (!analyserNode) {
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = FFT_SIZE;
    analyserNode.smoothingTimeConstant = 0.8;

    // Initialize frequency data array
    frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
  }

  return analyserNode;
}

/**
 * Get the analyser node for connecting to audio sources.
 */
export function getAnalyserNode(): AnalyserNode | null {
  return analyserNode;
}

/**
 * Get the current frequency data from the audio.
 * Returns a Uint8Array with values 0-255 for each frequency bin.
 */
export function getFrequencyData(): Uint8Array<ArrayBuffer> {
  if (!analyserNode || !frequencyData) {
    // Return empty array if not initialized
    return new Uint8Array(0) as Uint8Array<ArrayBuffer>;
  }

  analyserNode.getByteFrequencyData(frequencyData);
  return frequencyData;
}

/**
 * Get the average frequency value across all bins (0-255).
 * Useful for quick energy/loudness reading.
 */
export function getAverageFrequency(): number {
  if (!analyserNode || !frequencyData) {
    return 0;
  }

  analyserNode.getByteFrequencyData(frequencyData);

  let sum = 0;
  const len = frequencyData.length;
  for (let i = 0; i < len; i++) {
    sum += frequencyData[i];
  }
  return sum / len;
}

/**
 * Get the average frequency for a specific range of bins.
 * Useful for isolating specific frequency bands (e.g., bass, mids, highs).
 * @param startBin - Start bin index (inclusive)
 * @param endBin - End bin index (exclusive)
 */
export function getFrequencyRangeAverage(startBin: number, endBin: number): number {
  if (!analyserNode || !frequencyData) {
    return 0;
  }

  analyserNode.getByteFrequencyData(frequencyData);

  const start = Math.max(0, startBin);
  const end = Math.min(frequencyData.length, endBin);

  if (start >= end) {
    return 0;
  }

  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += frequencyData[i];
  }
  return sum / (end - start);
}

/**
 * Get the FFT size used by the analyser.
 */
export function getFFTSize(): number {
  return FFT_SIZE;
}

/**
 * Get the number of frequency bins (FFT_SIZE / 2).
 */
export function getFrequencyBinCount(): number {
  return analyserNode ? analyserNode.frequencyBinCount : FFT_SIZE / 2;
}
