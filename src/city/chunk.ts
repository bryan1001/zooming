import * as THREE from 'three';
import { createBuilding } from './building';
import { createGround } from './ground';

// Chunk size in world units
export const CHUNK_SIZE = 200;

// Grid configuration
// Block size includes building space + street space around it
const BLOCK_SIZE = 25;

/**
 * Creates a city chunk containing buildings in a grid pattern
 * @param chunkX - Chunk X coordinate (not world X)
 * @param chunkZ - Chunk Z coordinate (not world Z)
 * @returns A Three.js Group containing all buildings in the chunk
 */
export function createChunk(chunkX: number, chunkZ: number): THREE.Group {
  const chunk = new THREE.Group();

  // Calculate world position offset for this chunk
  const worldOffsetX = chunkX * CHUNK_SIZE;
  const worldOffsetZ = chunkZ * CHUNK_SIZE;

  // Calculate number of blocks that fit in the chunk
  const blocksPerSide = Math.floor(CHUNK_SIZE / BLOCK_SIZE);

  // Generate buildings in a grid pattern
  for (let gridX = 0; gridX < blocksPerSide; gridX++) {
    for (let gridZ = 0; gridZ < blocksPerSide; gridZ++) {
      // Calculate building center position within the chunk
      // Each block has a building centered with street space around it
      const localX = gridX * BLOCK_SIZE + BLOCK_SIZE / 2;
      const localZ = gridZ * BLOCK_SIZE + BLOCK_SIZE / 2;

      // Convert to world coordinates
      const worldX = worldOffsetX + localX;
      const worldZ = worldOffsetZ + localZ;

      // Generate a unique seed based on world position for reproducible buildings
      const seed = hashPosition(worldX, worldZ);

      // Create building at this position
      const building = createBuilding(worldX, worldZ, seed);
      chunk.add(building);
    }
  }

  // Add ground plane to the chunk
  const ground = createGround(chunkX, chunkZ);
  chunk.add(ground);

  // Store chunk coordinates for identification
  chunk.userData = { chunkX, chunkZ };

  return chunk;
}

/**
 * Simple hash function to generate a seed from world coordinates
 * Ensures the same position always generates the same building
 */
function hashPosition(x: number, z: number): number {
  // Use a simple hash combining the coordinates
  const hash = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453);
  return Math.floor(hash);
}
