import * as THREE from 'three';

/**
 * Sets up atmospheric night lighting for the city scene.
 * Creates an immersive dark city vibe with moonlight and fog.
 */
export function setupLighting(scene: THREE.Scene): void {
  // Set dark blue/purple background for night sky
  scene.background = new THREE.Color(0x0a0a1a);

  // Add fog matching background color for depth and atmosphere
  // Fog helps hide chunk loading and creates sense of infinite city
  scene.fog = new THREE.Fog(0x0a0a1a, 100, 800);

  // Ambient light - dim blue-ish for night feel
  // Provides base illumination so buildings aren't completely black
  const ambientLight = new THREE.AmbientLight(0x2a2a4a, 0.5);
  scene.add(ambientLight);

  // Directional light - moonlight from above and slightly behind
  // Creates subtle highlights on building tops
  const moonLight = new THREE.DirectionalLight(0x6a6a8a, 0.8);
  moonLight.position.set(50, 200, -100);
  scene.add(moonLight);

  // Add a subtle hemisphere light for more natural ambient lighting
  // Sky color (top) is dark blue, ground color is even darker
  const hemisphereLight = new THREE.HemisphereLight(0x2a2a5a, 0x1a1a1a, 0.3);
  scene.add(hemisphereLight);
}
