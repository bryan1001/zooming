import * as THREE from 'three';

/**
 * Sets up bright lighting for the city scene.
 * Well-lit with lighter sky.
 */
export function setupLighting(scene: THREE.Scene): void {
  // Light blue-gray sky
  scene.background = new THREE.Color(0x667788);

  // Fog pushed way out for longer view distance
  scene.fog = new THREE.Fog(0x667788, 400, 2000);

  // Very strong ambient light for visibility
  const ambientLight = new THREE.AmbientLight(0xaabbcc, 5.0);
  scene.add(ambientLight);

  // Main directional light - bright moonlight
  const moonLight = new THREE.DirectionalLight(0xffffff, 3.0);
  moonLight.position.set(50, 200, -100);
  scene.add(moonLight);

  // Front light for face visibility - very bright
  const frontLight = new THREE.DirectionalLight(0xccccff, 3.0);
  frontLight.position.set(0, 50, 300);
  scene.add(frontLight);

  // Side lights for depth - brighter
  const leftLight = new THREE.DirectionalLight(0x8888cc, 2.0);
  leftLight.position.set(-200, 100, 0);
  scene.add(leftLight);

  const rightLight = new THREE.DirectionalLight(0x8888cc, 2.0);
  rightLight.position.set(200, 100, 0);
  scene.add(rightLight);

  // Hemisphere light for strong fill
  const hemisphereLight = new THREE.HemisphereLight(0x99aacc, 0x445566, 3.0);
  scene.add(hemisphereLight);
}
