import './style.css';
import * as THREE from 'three';
import { ChunkManager } from './city/chunkManager';
import { setupLighting } from './lighting';
import { CameraController } from './camera/cameraController';

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

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Track time for smooth movement
let lastTime = performance.now();

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Calculate delta time for smooth movement
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  // Update camera controller (moves camera along flight path)
  cameraController.update(deltaTime);

  // Update chunk manager to load/unload chunks as camera moves
  chunkManager.update(camera.position);

  renderer.render(scene, camera);
}

animate();
