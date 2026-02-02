/**
 * Audio player module for loading and playing the soundtrack.
 * Uses Web Audio API for precise timing and future audio analysis.
 */

let audioContext: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let sourceNode: AudioBufferSourceNode | null = null;
let isPlaying = false;

const AUDIO_PATH = '/audio/synthwave.mp3';

/**
 * Initialize the audio context (must be called after user interaction due to browser autoplay policies)
 */
export function initAudio(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Get the current audio context (creates one if it doesn't exist)
 */
export function getAudioContext(): AudioContext | null {
  return audioContext;
}

/**
 * Load the audio file into a buffer
 */
export async function loadAudio(): Promise<void> {
  if (!audioContext) {
    initAudio();
  }

  const response = await fetch(AUDIO_PATH);
  const arrayBuffer = await response.arrayBuffer();
  audioBuffer = await audioContext!.decodeAudioData(arrayBuffer);
}

/**
 * Play the loaded audio
 * Returns the source node for potential future use (e.g., connecting to analyser)
 */
export function play(): AudioBufferSourceNode | null {
  if (!audioContext || !audioBuffer) {
    console.error('Audio not initialized or loaded. Call loadAudio() first.');
    return null;
  }

  // Resume context if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  // Stop any currently playing audio
  if (sourceNode && isPlaying) {
    sourceNode.stop();
  }

  // Create and configure source node
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(audioContext.destination);

  // Track playing state
  sourceNode.onended = () => {
    isPlaying = false;
  };

  sourceNode.start(0);
  isPlaying = true;

  return sourceNode;
}

/**
 * Stop the currently playing audio
 */
export function stop(): void {
  if (sourceNode && isPlaying) {
    sourceNode.stop();
    isPlaying = false;
  }
}

/**
 * Check if audio is currently playing
 */
export function getIsPlaying(): boolean {
  return isPlaying;
}

/**
 * Get the current source node (for connecting to analyser)
 */
export function getSourceNode(): AudioBufferSourceNode | null {
  return sourceNode;
}
