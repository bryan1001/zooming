/**
 * Beat effects module for visual feedback on beats.
 * Provides FOV pulse and vignette darkening effects that scale with beat intensity.
 */

import * as THREE from 'three';

// Effect configuration
const BASE_FOV = 75; // Base field of view
const MAX_FOV_PULSE = 8; // Maximum FOV increase on beat (degrees)
const FOV_DECAY_RATE = 15; // How fast FOV returns to normal (higher = faster)

const BASE_VIGNETTE_INTENSITY = 0.0; // No vignette when not beating
const MAX_VIGNETTE_INTENSITY = 0.4; // Maximum vignette darkness on beat
const VIGNETTE_DECAY_RATE = 12; // How fast vignette fades (higher = faster)

// State
let camera: THREE.PerspectiveCamera | null = null;
let vignetteElement: HTMLDivElement | null = null;
let currentFovPulse = 0; // Current FOV addition
let currentVignetteIntensity = BASE_VIGNETTE_INTENSITY;

/**
 * Initialize beat effects with required references.
 * @param cam - The perspective camera for FOV effects
 */
export function initBeatEffects(cam: THREE.PerspectiveCamera): void {
  camera = cam;

  // Create vignette overlay element
  createVignetteOverlay();
}

/**
 * Create the vignette overlay element.
 */
function createVignetteOverlay(): void {
  // Check if vignette already exists
  const existing = document.getElementById('vignette-overlay');
  if (existing) {
    vignetteElement = existing as HTMLDivElement;
    return;
  }

  // Create new vignette element
  vignetteElement = document.createElement('div');
  vignetteElement.id = 'vignette-overlay';
  vignetteElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
    background: radial-gradient(ellipse at center,
      transparent 0%,
      transparent 40%,
      rgba(0, 0, 0, 0) 100%);
    opacity: 0;
    transition: none;
  `;

  document.body.appendChild(vignetteElement);
}

/**
 * Trigger a beat pulse effect.
 * @param intensity - Beat intensity from 0 to 1
 */
export function triggerBeatPulse(intensity: number): void {
  // Clamp intensity
  const clampedIntensity = Math.max(0, Math.min(1, intensity));

  // Set FOV pulse based on intensity
  currentFovPulse = MAX_FOV_PULSE * clampedIntensity;

  // Set vignette intensity based on beat intensity
  currentVignetteIntensity = MAX_VIGNETTE_INTENSITY * clampedIntensity;
}

/**
 * Update beat effects. Call this every frame.
 * @param deltaTime - Time since last frame in seconds
 */
export function updateBeatEffects(deltaTime: number): void {
  // Update FOV pulse with exponential decay
  if (camera && currentFovPulse > 0.01) {
    const fovDecay = 1 - Math.exp(-FOV_DECAY_RATE * deltaTime);
    currentFovPulse = currentFovPulse * (1 - fovDecay);
    camera.fov = BASE_FOV + currentFovPulse;
    camera.updateProjectionMatrix();
  } else if (camera && camera.fov !== BASE_FOV) {
    // Reset to base FOV when pulse is negligible
    currentFovPulse = 0;
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
  }

  // Update vignette with exponential decay
  if (currentVignetteIntensity > 0.01) {
    const vignetteDecay = 1 - Math.exp(-VIGNETTE_DECAY_RATE * deltaTime);
    currentVignetteIntensity = currentVignetteIntensity * (1 - vignetteDecay);
    updateVignetteVisual();
  } else if (currentVignetteIntensity > 0) {
    // Reset vignette when intensity is negligible
    currentVignetteIntensity = 0;
    updateVignetteVisual();
  }
}

/**
 * Update the vignette visual based on current intensity.
 */
function updateVignetteVisual(): void {
  if (!vignetteElement) return;

  // Update the gradient to show darkening based on intensity
  // Inner clear area shrinks, outer dark area grows with intensity
  const innerClear = 40 - currentVignetteIntensity * 20; // 40% -> 20% at max
  const darkEdge = currentVignetteIntensity * 0.6; // How dark the edges get

  vignetteElement.style.background = `radial-gradient(ellipse at center,
    transparent 0%,
    transparent ${innerClear}%,
    rgba(0, 0, 0, ${darkEdge}) 100%)`;
  vignetteElement.style.opacity = '1';
}

/**
 * Get the current FOV including any pulse effect.
 */
export function getCurrentFov(): number {
  return BASE_FOV + currentFovPulse;
}

/**
 * Get the current vignette intensity (0-1).
 */
export function getVignetteIntensity(): number {
  return currentVignetteIntensity;
}

/**
 * Clean up beat effects resources.
 */
export function disposeBeatEffects(): void {
  if (vignetteElement && vignetteElement.parentNode) {
    vignetteElement.parentNode.removeChild(vignetteElement);
    vignetteElement = null;
  }
  camera = null;
  currentFovPulse = 0;
  currentVignetteIntensity = 0;
}
