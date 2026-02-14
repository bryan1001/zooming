import * as THREE from 'three';
import {
  getBuildingByHeight,
  createBuildingMesh,
  isBuildingPoolLoaded,
} from './buildingPool';

// Street and block layout configuration (MUST match flightPath.ts)
// Scaled 5x for massive buildings with extra wide streets
const STREET_WIDTH = 180; // Extra wide streets for guaranteed clear flight
const BUILDING_GAP = 30;
const BUILDING_WIDTH = 100;
const BUILDINGS_PER_BLOCK = 3;

// Derived values
const CITY_BLOCK_SIZE = BUILDINGS_PER_BLOCK * BUILDING_WIDTH + (BUILDINGS_PER_BLOCK - 1) * BUILDING_GAP;
export const CHUNK_SIZE = CITY_BLOCK_SIZE + STREET_WIDTH; // 86 units

/**
 * Seeded random number generator
 */
function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/**
 * Generate a deterministic hash from chunk coordinates
 */
function chunkHash(chunkX: number, chunkZ: number): number {
  return Math.abs((chunkX * 73856093) ^ (chunkZ * 19349663)) % 2147483647;
}

/**
 * Create a chunk with buildings aligned to the street grid.
 * Each chunk contains one city block (buildings) and the street on its +X and +Z edges.
 */
export function createModelChunk(
  chunkX: number,
  chunkZ: number
): THREE.Group {
  const chunk = new THREE.Group();
  chunk.name = `chunk_${chunkX}_${chunkZ}`;

  if (!isBuildingPoolLoaded()) {
    console.warn('Building pool not loaded yet');
    return chunk;
  }

  const seed = chunkHash(chunkX, chunkZ);
  const random = seededRandom(seed);

  // World position of this chunk's origin (bottom-left corner)
  const worldX = chunkX * CHUNK_SIZE;
  const worldZ = chunkZ * CHUNK_SIZE;

  // Place buildings in a grid within the block portion of the chunk
  // Block is CITY_BLOCK_SIZE x CITY_BLOCK_SIZE, streets are on +X and +Z edges
  for (let bx = 0; bx < BUILDINGS_PER_BLOCK; bx++) {
    for (let bz = 0; bz < BUILDINGS_PER_BLOCK; bz++) {
      // Skip some spots for variety (about 10%)
      if (random() < 0.05) continue;

      // Height category - more variation, taller buildings toward center of each block
      const distFromEdge = Math.min(bx, bz, BUILDINGS_PER_BLOCK - 1 - bx, BUILDINGS_PER_BLOCK - 1 - bz);
      const heightCategory = Math.min(1, 0.3 + random() * 0.5 + distFromEdge * 0.2);

      const template = getBuildingByHeight(heightCategory, random());
      if (!template) continue;

      const building = createBuildingMesh(template);

      // Calculate position within the block
      const localX = bx * (BUILDING_WIDTH + BUILDING_GAP);
      const localZ = bz * (BUILDING_WIDTH + BUILDING_GAP);

      // Scale buildings to fit in slots (slots are already 5x sized)
      // Use 0.7 factor for safety margin from streets
      const maxSlotSize = BUILDING_WIDTH * 0.7;
      const scaleX = maxSlotSize / Math.max(template.width, 1);
      const scaleZ = maxSlotSize / Math.max(template.depth, 1);
      const baseScale = Math.min(scaleX, scaleZ);
      // Scale variation (0.7 - 0.9) - keep buildings well within slots
      const scale = baseScale * (0.7 + random() * 0.2);

      building.scale.set(scale, scale, scale);

      // Position: center the building in its slot
      // Templates are pre-centered at origin with base at y=0
      const slotCenterX = localX + BUILDING_WIDTH / 2;
      const slotCenterZ = localZ + BUILDING_WIDTH / 2;

      building.position.set(
        slotCenterX,
        0, // Base already at y=0
        slotCenterZ
      );

      // Random rotation (90 degree increments)
      const rotationSteps = Math.floor(random() * 4);
      building.rotation.y = rotationSteps * Math.PI / 2;

      chunk.add(building);
    }
  }

  // Position the chunk in world space
  chunk.position.set(worldX, 0, worldZ);

  return chunk;
}
