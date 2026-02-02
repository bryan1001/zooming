import './style.css';
import * as THREE from 'three';
import { ChunkManager } from './city/chunkManager';
import { setupLighting } from './lighting';

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
// Position camera at street level, looking forward (positive Z)
camera.position.set(0, 30, 0);
camera.lookAt(0, 30, 100);

// Create renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Setup atmospheric night lighting
setupLighting(scene);

// Initialize ChunkManager for infinite city
const chunkManager = new ChunkManager(scene);

// Camera movement speed (units per second)
const cameraSpeed = 50;

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

  // Move camera forward (positive Z direction)
  camera.position.z += cameraSpeed * deltaTime;

  // Keep camera looking forward
  camera.lookAt(camera.position.x, camera.position.y, camera.position.z + 100);

  // Update chunk manager to load/unload chunks as camera moves
  chunkManager.update(camera.position);

  renderer.render(scene, camera);
}

animate();
