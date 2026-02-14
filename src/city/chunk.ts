import * as THREE from 'three';
import { createInstancedBuildings, generateBuildingData } from './instancedBuildings';
import { createGround } from './ground';

// Chunk size in world units
export const CHUNK_SIZE = 200;

// Street and block layout configuration
const STREET_WIDTH = 18;        // Width of main streets between city blocks
const BUILDING_GAP = 4;         // Gap between buildings within a block (alleys)
const BUILDING_WIDTH = 20;      // Average building footprint width
const BUILDINGS_PER_BLOCK = 3;  // Number of buildings per city block (per axis)

// Calculate derived values
// A city block contains BUILDINGS_PER_BLOCK buildings with gaps between them
const CITY_BLOCK_SIZE = BUILDINGS_PER_BLOCK * BUILDING_WIDTH + (BUILDINGS_PER_BLOCK - 1) * BUILDING_GAP;
// Total size including the street after the block
const BLOCK_WITH_STREET = CITY_BLOCK_SIZE + STREET_WIDTH;

// For backwards compatibility with instancedBuildings.ts grid calculations
export const BLOCK_SIZE = BUILDING_WIDTH + BUILDING_GAP;

/**
 * Simple hash function to generate a seed from world coordinates
 * Ensures the same position always generates the same building
 */
function hashPosition(x: number, z: number): number {
  // Use a simple hash combining the coordinates
  const hash = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453);
  return Math.floor(hash);
}

/**
 * Calculates the world position for a building given its block and position within the block
 */
function calculateBuildingPosition(
  blockIndex: number,
  buildingInBlock: number,
  worldOffset: number
): number {
  // Position of the city block start
  const blockStart = blockIndex * BLOCK_WITH_STREET;
  // Position within the block (building center)
  const posInBlock = buildingInBlock * (BUILDING_WIDTH + BUILDING_GAP) + BUILDING_WIDTH / 2;
  return worldOffset + blockStart + posInBlock;
}

/**
 * Creates a city chunk containing buildings arranged in city blocks with streets
 * Uses InstancedMesh for efficient rendering of multiple buildings
 * @param chunkX - Chunk X coordinate (not world X)
 * @param chunkZ - Chunk Z coordinate (not world Z)
 * @returns A Three.js Group containing all buildings in the chunk
 */
export function createChunk(chunkX: number, chunkZ: number): THREE.Group {
  const chunk = new THREE.Group();

  // Calculate world position offset for this chunk
  const worldOffsetX = chunkX * CHUNK_SIZE;
  const worldOffsetZ = chunkZ * CHUNK_SIZE;

  // Calculate how many city blocks fit in this chunk
  const cityBlocksPerSide = Math.floor(CHUNK_SIZE / BLOCK_WITH_STREET);

  // Collect building positions and seeds
  const positions: Array<{ x: number; z: number; seed: number }> = [];

  // Iterate over city blocks
  for (let blockX = 0; blockX < cityBlocksPerSide; blockX++) {
    for (let blockZ = 0; blockZ < cityBlocksPerSide; blockZ++) {
      // Iterate over buildings within each city block
      for (let bldgX = 0; bldgX < BUILDINGS_PER_BLOCK; bldgX++) {
        for (let bldgZ = 0; bldgZ < BUILDINGS_PER_BLOCK; bldgZ++) {
          // Calculate world position for this building
          const worldX = calculateBuildingPosition(blockX, bldgX, worldOffsetX);
          const worldZ = calculateBuildingPosition(blockZ, bldgZ, worldOffsetZ);

          // Generate a unique seed based on world position
          const seed = hashPosition(worldX, worldZ);

          positions.push({ x: worldX, z: worldZ, seed });
        }
      }
    }
  }

  // Generate building data
  const buildingData = generateBuildingData(positions);

  // Create instanced meshes for buildings (grouped by material)
  const instancedMeshes = createInstancedBuildings(buildingData);

  // Add all instanced meshes to the chunk
  for (const mesh of instancedMeshes) {
    chunk.add(mesh);
  }

  // Add ground plane to the chunk
  const ground = createGround(chunkX, chunkZ);
  chunk.add(ground);

  // Store chunk coordinates for identification
  chunk.userData = { chunkX, chunkZ };

  return chunk;
}
