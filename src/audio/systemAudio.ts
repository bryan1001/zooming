/**
 * System audio capture module.
 * Uses getDisplayMedia to capture system/tab audio for visualization.
 */

import { initAudio } from './audioPlayer';
import { initAnalyser, getAnalyserNode } from './audioAnalyser';

let mediaStream: MediaStream | null = null;
let mediaSource: MediaStreamAudioSourceNode | null = null;
let isCapturing = false;

/**
 * Request system audio capture via screen share.
 * User will be prompted to share a tab/window/screen with audio.
 * Returns true if capture started successfully.
 */
export async function startSystemAudioCapture(): Promise<boolean> {
  try {
    // Initialize audio context if needed
    const audioContext = initAudio();
    
    // Initialize analyser
    initAnalyser();
    
    // Request display media with audio
    // Note: audio capture support varies by browser/OS
    // - Chrome on Windows/ChromeOS: full system audio
    // - Chrome on macOS: tab audio only (when sharing a tab)
    // - Firefox: limited support
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: true, // Required, but we'll ignore the video
      audio: {
        // Request system audio
        // @ts-ignore - these are valid but not in all TS definitions
        suppressLocalAudioPlayback: false,
        // @ts-ignore
        systemAudio: 'include',
      },
    });

    // Check if we got an audio track
    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('No audio track in captured stream. User may need to check "Share audio" option.');
      // Don't fail - video track might still be useful, or user might retry
    } else {
      console.log('Audio capture started:', audioTracks[0].label);
    }

    // Create audio source from the stream
    mediaSource = audioContext.createMediaStreamSource(mediaStream);

    // Connect to analyser for visualization
    const analyser = getAnalyserNode();
    if (analyser) {
      mediaSource.connect(analyser);
      // Don't connect analyser to destination - we don't want to play it back
      // (it would cause echo since it's already playing through speakers)
    }

    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    isCapturing = true;

    // Handle stream ending (user stops sharing)
    mediaStream.getTracks().forEach(track => {
      track.onended = () => {
        console.log('System audio capture ended');
        stopSystemAudioCapture();
      };
    });

    return true;
  } catch (error) {
    console.error('Failed to capture system audio:', error);
    return false;
  }
}

/**
 * Stop system audio capture and clean up.
 */
export function stopSystemAudioCapture(): void {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  if (mediaSource) {
    mediaSource.disconnect();
    mediaSource = null;
  }

  isCapturing = false;
}

/**
 * Check if system audio is currently being captured.
 */
export function isSystemAudioCapturing(): boolean {
  return isCapturing;
}

/**
 * Check if the browser supports system audio capture.
 */
export function supportsSystemAudio(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
}
