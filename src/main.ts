import './style.css';
import * as THREE from 'three';
import { ChunkManager } from './city/chunkManager';
import { setupLighting } from './lighting';
import { CameraController } from './camera/cameraController';
import { BulletAvatar } from './camera/bulletAvatar';
import { initAudio, loadAudio, play } from './audio/audioPlayer';
import { updateBeatDetection, onBeat, onTransition, onHeavyBeatShift } from './audio/beatDetector';
import { initBeatEffects, triggerBeatPulse, updateBeatEffects } from './effects/beatEffects';
import { initMotionBlur, updateMotionBlur, renderWithMotionBlur, resizeMotionBlur } from './effects/motionBlur';
import { initStats, statsBegin, statsEnd } from './performance/stats';

// Get canvas element
const canvas = document.getElementById('canvas') as HTMLCanvasElement;

// Create scene
const scene = new THREE.Scene();

// Create camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);

// Create renderer (antialias disabled for performance - post-processing handles smoothing)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
// Limit pixel ratio to 1.5 for better performance on high-DPI displays
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

// Setup atmospheric night lighting
setupLighting(scene);

// Initialize motion blur post-processing
initMotionBlur(renderer, scene, camera);

// Initialize ChunkManager for infinite city
const chunkManager = new ChunkManager(scene);

// Initialize camera controller for smooth path following
const cameraController = new CameraController(camera);

// Initialize bullet avatar for third-person view
const bulletAvatar = new BulletAvatar(scene, cameraController.getFlightPath());

// Initialize beat effects for visual feedback
initBeatEffects(camera);

// Initialize FPS counter for performance monitoring
initStats();

// Listen for perspective changes to show/hide bullet avatar
cameraController.onPerspectiveChange((mode) => {
  if (mode === 'third-person') {
    bulletAvatar.show();
  } else {
    bulletAvatar.hide();
  }
});

// Transition detection callback - switch to third-person on musical transitions
onTransition((intensity) => {
  // Only switch to third-person on transitions with enough intensity
  if (intensity > 0.3) {
    cameraController.switchToThirdPerson();
  }
});

// Track last turn direction for alternation when both directions are safe
let lastTurnDirection: 'left' | 'right' = 'right'; // Start with 'right' so first turn is 'left'

// Heavy beat shift callback - trigger turns on musically significant moments
onHeavyBeatShift(() => {
  // Check which directions are safe
  const leftSafe = cameraController.canTurnSafely('left');
  const rightSafe = cameraController.canTurnSafely('right');

  if (leftSafe && rightSafe) {
    // Both directions are safe - alternate
    const direction = lastTurnDirection === 'left' ? 'right' : 'left';
    if (cameraController.executeTurn(direction)) {
      lastTurnDirection = direction;
    }
  } else if (leftSafe) {
    // Only left is safe
    if (cameraController.executeTurn('left')) {
      lastTurnDirection = 'left';
    }
  } else if (rightSafe) {
    // Only right is safe
    if (cameraController.executeTurn('right')) {
      lastTurnDirection = 'right';
    }
  }
  // If neither is safe, skip the turn (maintain straight flight)
});

// Speed boost configuration for beat sync
const MIN_SPEED_BOOST = 1.5; // 50% boost at minimum intensity
const MAX_SPEED_BOOST = 2.0; // 100% boost at maximum intensity

// Beat detection callback - boost camera speed and trigger visual effects on beat
onBeat((intensity) => {
  // Calculate boost multiplier: lerp between MIN and MAX based on intensity
  const boostMultiplier = MIN_SPEED_BOOST + (MAX_SPEED_BOOST - MIN_SPEED_BOOST) * intensity;
  cameraController.boostSpeed(boostMultiplier);

  // Trigger visual beat effects (FOV pulse, vignette)
  triggerBeatPulse(intensity);
});

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeMotionBlur(window.innerWidth, window.innerHeight, renderer.getPixelRatio());
});

// Keyboard controls for testing turns
window.addEventListener('keydown', (e) => {
  if (!started) return;
  if (e.key === 'ArrowLeft' || e.key === 'a') {
    cameraController.executeTurn('left');
  } else if (e.key === 'ArrowRight' || e.key === 'd') {
    cameraController.executeTurn('right');
  }
});

// Track time for smooth movement
let lastTime = performance.now();
let started = false;

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Start frame timing
  statsBegin();

  // Calculate delta time for smooth movement
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  // Only update camera when started
  if (started) {
    // Smoothly ease camera speed back to base speed
    // Factor based on deltaTime for frame-rate independence
    // ~200ms return time: e^(-3 * deltaTime) gives smooth decay
    const easeFactor = 1 - Math.exp(-15 * deltaTime);
    cameraController.easeToBaseSpeed(easeFactor);

    // Update camera controller (moves camera along flight path)
    cameraController.update(deltaTime);

    // Update bullet avatar position to follow the same path
    bulletAvatar.update(cameraController.getCurrentZ());

    // Update beat detection
    updateBeatDetection();

    // Update beat visual effects (FOV pulse, vignette decay)
    updateBeatEffects(deltaTime);

    // Update motion blur intensity based on current speed
    updateMotionBlur(cameraController.getSpeed());
  }

  // Update chunk manager to load/unload chunks as camera moves
  chunkManager.update(camera.position);

  // Render with motion blur post-processing
  renderWithMotionBlur();

  // End frame timing
  statsEnd();
}

// Handle start overlay click
const startOverlay = document.getElementById('start-overlay');

async function startExperience() {
  if (started) return;

  // Initialize and load audio
  initAudio();
  await loadAudio();

  // Start playing audio
  play();

  // Hide the overlay
  startOverlay?.classList.add('hidden');

  // Start the experience
  started = true;
  lastTime = performance.now(); // Reset time to avoid big deltaTime jump
}

startOverlay?.addEventListener('click', startExperience);

animate();
