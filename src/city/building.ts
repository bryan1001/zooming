import * as THREE from 'three';
import { createWindowTextures, calculateUVRepeat } from './windowTexture';

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

// Building dimension ranges
const MIN_WIDTH = 8;
const MAX_WIDTH = 30;

// Height ranges for different building categories
const HEIGHT_RANGES = {
  short: { min: 15, max: 50 },      // 30% of buildings
  medium: { min: 50, max: 100 },    // 60% of buildings
  tall: { min: 100, max: 150 },     // 10% of buildings (5% tall + 5% skyscraper base)
  skyscraper: { min: 150, max: 250 }, // 5% of buildings (super tall)
};

/**
 * Selects a building height category based on weighted distribution
 * 60% medium, 30% short, 10% tall (includes 5% skyscrapers)
 */
function selectHeightCategory(random: () => number): keyof typeof HEIGHT_RANGES {
  const roll = random();
  if (roll < 0.05) {
    // 5% chance: skyscraper (150-250 units)
    return 'skyscraper';
  } else if (roll < 0.10) {
    // 5% chance: tall (100-150 units)
    return 'tall';
  } else if (roll < 0.40) {
    // 30% chance: short (15-50 units)
    return 'short';
  } else {
    // 60% chance: medium (50-100 units)
    return 'medium';
  }
}

/**
 * Generates a building height based on weighted distribution
 */
function generateBuildingHeight(random: () => number): number {
  const category = selectHeightCategory(random);
  const range = HEIGHT_RANGES[category];
  return range.min + random() * (range.max - range.min);
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
  // Height: uses weighted distribution (60% medium, 30% short, 10% tall + 5% skyscraper)
  const height = generateBuildingHeight(random);
  // Width: 8-30 units
  const width = MIN_WIDTH + random() * (MAX_WIDTH - MIN_WIDTH);
  // Depth: 8-30 units
  const depth = MIN_WIDTH + random() * (MAX_WIDTH - MIN_WIDTH);

  // Create box geometry
  const geometry = new THREE.BoxGeometry(width, height, depth);

  // Create window textures with varying lit probability
  const litProbability = 0.3 + random() * 0.3; // 30-60% lit windows
  const { colorTexture, emissiveTexture } = createWindowTextures(seed, litProbability);

  // Calculate UV repeat based on building dimensions
  const uvRepeat = calculateUVRepeat(width, height, depth);

  // Clone textures for different repeat values on each face direction
  const frontBackColor = colorTexture.clone();
  frontBackColor.repeat.copy(uvRepeat.frontBack);
  frontBackColor.needsUpdate = true;

  const frontBackEmissive = emissiveTexture.clone();
  frontBackEmissive.repeat.copy(uvRepeat.frontBack);
  frontBackEmissive.needsUpdate = true;

  const leftRightColor = colorTexture.clone();
  leftRightColor.repeat.copy(uvRepeat.leftRight);
  leftRightColor.needsUpdate = true;

  const leftRightEmissive = emissiveTexture.clone();
  leftRightEmissive.repeat.copy(uvRepeat.leftRight);
  leftRightEmissive.needsUpdate = true;

  // Create materials for each face
  // BoxGeometry face order: +X (right), -X (left), +Y (top), -Y (bottom), +Z (front), -Z (back)
  const materials: THREE.MeshStandardMaterial[] = [
    // Right face (+X)
    new THREE.MeshStandardMaterial({
      map: leftRightColor,
      emissiveMap: leftRightEmissive,
      emissive: 0xffffff,
      emissiveIntensity: 0.8,
      roughness: 0.7,
      metalness: 0.1,
    }),
    // Left face (-X)
    new THREE.MeshStandardMaterial({
      map: leftRightColor,
      emissiveMap: leftRightEmissive,
      emissive: 0xffffff,
      emissiveIntensity: 0.8,
      roughness: 0.7,
      metalness: 0.1,
    }),
    // Top face (+Y) - roof, no windows
    new THREE.MeshStandardMaterial({
      color: 0x1a1a2a,
      roughness: 0.9,
      metalness: 0.1,
    }),
    // Bottom face (-Y) - base, no windows
    new THREE.MeshStandardMaterial({
      color: 0x1a1a2a,
      roughness: 0.9,
      metalness: 0.1,
    }),
    // Front face (+Z)
    new THREE.MeshStandardMaterial({
      map: frontBackColor,
      emissiveMap: frontBackEmissive,
      emissive: 0xffffff,
      emissiveIntensity: 0.8,
      roughness: 0.7,
      metalness: 0.1,
    }),
    // Back face (-Z)
    new THREE.MeshStandardMaterial({
      map: frontBackColor,
      emissiveMap: frontBackEmissive,
      emissive: 0xffffff,
      emissiveIntensity: 0.8,
      roughness: 0.7,
      metalness: 0.1,
    }),
  ];

  // Create mesh with multi-material
  const building = new THREE.Mesh(geometry, materials);

  // Position building so its base sits on y=0
  building.position.set(x, height / 2, z);

  return building;
}
