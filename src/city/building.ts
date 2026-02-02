import * as THREE from 'three';

/**
 * Simple seeded random number generator (mulberry32)
 * Returns a function that generates pseudo-random numbers 0-1
 */
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a building mesh at the specified position with randomized dimensions
 * @param x - X position of the building center
 * @param z - Z position of the building center
 * @param seed - Seed for random number generation (ensures reproducible buildings)
 * @returns A Three.js Mesh representing the building
 */
export function createBuilding(x: number, z: number, seed: number): THREE.Mesh {
  const random = seededRandom(seed);

  // Generate random dimensions based on seed
  // Height: 10-100 units
  const height = 10 + random() * 90;
  // Width: 5-20 units
  const width = 5 + random() * 15;
  // Depth: 5-20 units
  const depth = 5 + random() * 15;

  // Create box geometry
  const geometry = new THREE.BoxGeometry(width, height, depth);

  // Create material with a dark building color
  const material = new THREE.MeshStandardMaterial({
    color: 0x2a2a3a,
    roughness: 0.8,
    metalness: 0.2,
  });

  // Create mesh
  const building = new THREE.Mesh(geometry, material);

  // Position building so its base sits on y=0
  building.position.set(x, height / 2, z);

  return building;
}
