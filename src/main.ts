import './style.css';
import * as THREE from 'three';
import { ChunkManager } from './city/chunkManager';
import { setupLighting } from './lighting';
import { CameraController } from './camera/cameraController';
import { initAudio, loadAudio, play } from './audio/audioPlayer';
import { updateBeatDetection, onBeat } from './audio/beatDetector';

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

// Create renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Setup atmospheric night lighting
setupLighting(scene);

// Initialize ChunkManager for infinite city
const chunkManager = new ChunkManager(scene);

// Initialize camera controller for smooth path following
const cameraController = new CameraController(camera);

// Beat detection callback for verification
onBeat((intensity) => {
  console.log(`BEAT! intensity: ${intensity.toFixed(2)}`);
});

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Track time for smooth movement
let lastTime = performance.now();
let started = false;

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Calculate delta time for smooth movement
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  // Only update camera when started
  if (started) {
    // Update camera controller (moves camera along flight path)
    cameraController.update(deltaTime);

    // Update beat detection
    updateBeatDetection();
  }

  // Update chunk manager to load/unload chunks as camera moves
  chunkManager.update(camera.position);

  renderer.render(scene, camera);
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
