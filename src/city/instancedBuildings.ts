import * as THREE from 'three';
import { createWindowTextures, WINDOW_PATTERNS } from './windowTexture';
import type { WindowPattern } from './windowTexture';

/**
 * Simple seeded random number generator (mulberry32)
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
 * Color palettes for building variety
 * Each palette maintains the nighttime aesthetic with different hues
 */
export type ColorPalette = 'cool-blue' | 'warm-amber' | 'neutral-gray' | 'neon-accent';
export const COLOR_PALETTES: ColorPalette[] = ['cool-blue', 'warm-amber', 'neutral-gray', 'neon-accent'];

interface PaletteColors {
  wall: number;       // Main wall color (dark for nighttime)
  roof: number;       // Roof/base color
  accent: number;     // Window frame accent color
}

/**
 * Returns the colors for a given palette
 * All palettes maintain the dark nighttime aesthetic with subtle hue variations
 */
function getPaletteColors(palette: ColorPalette): PaletteColors {
  switch (palette) {
    case 'cool-blue':
      return {
        wall: 0x151525,    // Dark blue-tinted wall
        roof: 0x1a1a2e,    // Blue-tinted roof
        accent: 0x2a3040,  // Cool accent
      };
    case 'warm-amber':
      return {
        wall: 0x1a1815,    // Dark warm wall
        roof: 0x252018,    // Warm roof
        accent: 0x3a3025,  // Warm accent
      };
    case 'neutral-gray':
      return {
        wall: 0x1a1a1a,    // Pure dark gray wall
        roof: 0x202020,    // Gray roof
        accent: 0x2a2a2a,  // Gray accent
      };
    case 'neon-accent':
      return {
        wall: 0x12151a,    // Very dark wall for contrast
        roof: 0x181c22,    // Dark blue-gray roof
        accent: 0x252a35,  // Slightly lighter accent
      };
  }
}

/**
 * Material property ranges for variation
 * Metalness: 0.1-0.5, Roughness: 0.3-0.8
 */
interface MaterialProperties {
  metalness: number;
  roughness: number;
}

/**
 * Generates material properties based on palette type and random seed
 */
function getMaterialProperties(palette: ColorPalette, random: () => number): MaterialProperties {
  // Base ranges: metalness 0.1-0.5, roughness 0.3-0.8
  let metalness: number;
  let roughness: number;

  switch (palette) {
    case 'cool-blue':
      // More metallic, less rough (glass/steel buildings)
      metalness = 0.3 + random() * 0.2;   // 0.3-0.5
      roughness = 0.3 + random() * 0.2;   // 0.3-0.5
      break;
    case 'warm-amber':
      // Less metallic, more rough (brick/stone buildings)
      metalness = 0.1 + random() * 0.15;  // 0.1-0.25
      roughness = 0.5 + random() * 0.3;   // 0.5-0.8
      break;
    case 'neutral-gray':
      // Moderate both (concrete buildings)
      metalness = 0.15 + random() * 0.2;  // 0.15-0.35
      roughness = 0.4 + random() * 0.3;   // 0.4-0.7
      break;
    case 'neon-accent':
      // High metalness, low roughness (modern glass/metal)
      metalness = 0.35 + random() * 0.15; // 0.35-0.5
      roughness = 0.3 + random() * 0.15;  // 0.3-0.45
      break;
  }

  return { metalness, roughness };
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

// Shared unit box geometry (1x1x1) that will be scaled per-instance
let sharedGeometry: THREE.BoxGeometry | null = null;

// Shared materials - one variant per window pattern x color palette combination (4 x 4 = 16)
const MATERIAL_VARIANTS = WINDOW_PATTERNS.length * COLOR_PALETTES.length;
// Map from (patternIndex, paletteIndex) to material array index
function getMaterialKey(patternIndex: number, paletteIndex: number): number {
  return patternIndex * COLOR_PALETTES.length + paletteIndex;
}

let sharedMaterials: THREE.MeshStandardMaterial[][] | null = null;

function getSharedGeometry(): THREE.BoxGeometry {
  if (!sharedGeometry) {
    sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
  }
  return sharedGeometry;
}

function getSharedMaterials(): THREE.MeshStandardMaterial[][] {
  if (!sharedMaterials) {
    sharedMaterials = [];

    // Create material set for each pattern x palette combination
    for (let patternIdx = 0; patternIdx < WINDOW_PATTERNS.length; patternIdx++) {
      for (let paletteIdx = 0; paletteIdx < COLOR_PALETTES.length; paletteIdx++) {
        const seed = patternIdx * 12345 + paletteIdx * 1000;
        const pattern: WindowPattern = WINDOW_PATTERNS[patternIdx];
        const palette = COLOR_PALETTES[paletteIdx];
        const paletteColors = getPaletteColors(palette);

        const litProbability = 0.3 + (patternIdx / WINDOW_PATTERNS.length) * 0.3;
        const { colorTexture, emissiveTexture } = createWindowTextures(seed, litProbability, pattern);

        // Set initial repeat - will be adjusted per building with instance attributes
        colorTexture.repeat.set(2, 8);
        emissiveTexture.repeat.set(2, 8);

        // Get material properties for this palette (using seed-based random)
        const matRandom = seededRandom(seed + 5000);
        const matProps = getMaterialProperties(palette, matRandom);

        // Create materials for each face with palette-specific colors
        const materials: THREE.MeshStandardMaterial[] = [
          // Right face (+X)
          new THREE.MeshStandardMaterial({
            color: paletteColors.wall,
            map: colorTexture.clone(),
            emissiveMap: emissiveTexture.clone(),
            emissive: 0xffffff,
            emissiveIntensity: 0.8,
            roughness: matProps.roughness,
            metalness: matProps.metalness,
          }),
          // Left face (-X)
          new THREE.MeshStandardMaterial({
            color: paletteColors.wall,
            map: colorTexture.clone(),
            emissiveMap: emissiveTexture.clone(),
            emissive: 0xffffff,
            emissiveIntensity: 0.8,
            roughness: matProps.roughness,
            metalness: matProps.metalness,
          }),
          // Top face (+Y) - roof, no windows
          new THREE.MeshStandardMaterial({
            color: paletteColors.roof,
            roughness: 0.9,
            metalness: matProps.metalness * 0.5,
          }),
          // Bottom face (-Y) - base, no windows
          new THREE.MeshStandardMaterial({
            color: paletteColors.roof,
            roughness: 0.9,
            metalness: matProps.metalness * 0.5,
          }),
          // Front face (+Z)
          new THREE.MeshStandardMaterial({
            color: paletteColors.wall,
            map: colorTexture.clone(),
            emissiveMap: emissiveTexture.clone(),
            emissive: 0xffffff,
            emissiveIntensity: 0.8,
            roughness: matProps.roughness,
            metalness: matProps.metalness,
          }),
          // Back face (-Z)
          new THREE.MeshStandardMaterial({
            color: paletteColors.wall,
            map: colorTexture.clone(),
            emissiveMap: emissiveTexture.clone(),
            emissive: 0xffffff,
            emissiveIntensity: 0.8,
            roughness: matProps.roughness,
            metalness: matProps.metalness,
          }),
        ];

        sharedMaterials.push(materials);
      }
    }
  }
  return sharedMaterials;
}

export interface BuildingData {
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  materialIndex: number;
  palette: ColorPalette;
  metalness: number;
  roughness: number;
}

// BLOCK_SIZE from chunk.ts - used for grid position calculation
const BLOCK_SIZE = 25;

/**
 * Generates building data for a set of positions
 * Ensures adjacent buildings in the grid have different window patterns AND colors
 */
export function generateBuildingData(
  positions: Array<{ x: number; z: number; seed: number }>
): BuildingData[] {
  return positions.map(({ x, z, seed }) => {
    const random = seededRandom(seed);
    const height = generateBuildingHeight(random);
    const width = MIN_WIDTH + random() * (MAX_WIDTH - MIN_WIDTH);
    const depth = MIN_WIDTH + random() * (MAX_WIDTH - MIN_WIDTH);

    // Calculate grid position (integer grid coordinates)
    // Buildings are centered at (n * BLOCK_SIZE + BLOCK_SIZE/2), so divide and floor
    const gridX = Math.floor(x / BLOCK_SIZE);
    const gridZ = Math.floor(z / BLOCK_SIZE);

    // Use grid position to ensure adjacent buildings get different window patterns
    // With 4 patterns and using (gridX + gridZ * 2) % 4, we get:
    // - Horizontally adjacent buildings differ (gridX changes by 1 -> pattern changes by 1)
    // - Vertically adjacent buildings differ (gridZ changes by 1 -> pattern changes by 2)
    const patternIndex = Math.abs((gridX + gridZ * 2) % WINDOW_PATTERNS.length);

    // Use different offset for palette to ensure color differs from window pattern
    // Using (gridX * 3 + gridZ) % 4 creates a different pattern than window selection
    // This ensures adjacent buildings have different colors even if they might share pattern index
    const paletteIndex = Math.abs((gridX * 3 + gridZ) % COLOR_PALETTES.length);
    const palette = COLOR_PALETTES[paletteIndex];

    // Calculate combined material index for the pattern x palette combination
    const materialIndex = getMaterialKey(patternIndex, paletteIndex);

    // Generate material properties based on palette and seed
    const materialProps = getMaterialProperties(palette, random);

    return {
      x, z, width, height, depth, materialIndex,
      palette,
      metalness: materialProps.metalness,
      roughness: materialProps.roughness,
    };
  });
}

/**
 * Creates an InstancedMesh for a group of buildings with the same material
 */
export function createInstancedBuildingGroup(
  buildings: BuildingData[],
  materialIndex: number
): THREE.InstancedMesh {
  const geometry = getSharedGeometry();
  const materials = getSharedMaterials()[materialIndex];

  const instancedMesh = new THREE.InstancedMesh(geometry, materials, buildings.length);
  instancedMesh.frustumCulled = true;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  buildings.forEach((building, index) => {
    position.set(building.x, building.height / 2, building.z);
    quaternion.identity();
    scale.set(building.width, building.height, building.depth);

    matrix.compose(position, quaternion, scale);
    instancedMesh.setMatrixAt(index, matrix);
  });

  instancedMesh.instanceMatrix.needsUpdate = true;

  return instancedMesh;
}

/**
 * Creates all instanced meshes for a set of building data
 * Groups buildings by material index for efficient batching
 */
export function createInstancedBuildings(
  buildingData: BuildingData[]
): THREE.InstancedMesh[] {
  // Group buildings by material index
  const grouped = new Map<number, BuildingData[]>();

  for (let i = 0; i < MATERIAL_VARIANTS; i++) {
    grouped.set(i, []);
  }

  for (const building of buildingData) {
    grouped.get(building.materialIndex)!.push(building);
  }

  // Create an InstancedMesh for each material group
  const instancedMeshes: THREE.InstancedMesh[] = [];

  for (const [materialIndex, buildings] of grouped) {
    if (buildings.length > 0) {
      const mesh = createInstancedBuildingGroup(buildings, materialIndex);
      instancedMeshes.push(mesh);
    }
  }

  return instancedMeshes;
}

/**
 * Disposes of shared resources (call when app is shutting down)
 */
export function disposeInstancedBuildingResources(): void {
  if (sharedGeometry) {
    sharedGeometry.dispose();
    sharedGeometry = null;
  }

  if (sharedMaterials) {
    for (const materials of sharedMaterials) {
      for (const material of materials) {
        material.dispose();
        if (material.map) material.map.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
      }
    }
    sharedMaterials = null;
  }
}
