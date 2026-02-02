import * as THREE from 'three';
import { createInstancedBuildings, generateBuildingData } from './instancedBuildings';
import { createGround } from './ground';

// Chunk size in world units
export const CHUNK_SIZE = 200;

// Grid configuration
// Block size includes building space + street space around it
export const BLOCK_SIZE = 25;

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
 * Creates a city chunk containing buildings in a grid pattern
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

  // Calculate number of blocks that fit in the chunk
  const blocksPerSide = Math.floor(CHUNK_SIZE / BLOCK_SIZE);

  // Collect building positions and seeds
  const positions: Array<{ x: number; z: number; seed: number }> = [];

  for (let gridX = 0; gridX < blocksPerSide; gridX++) {
    for (let gridZ = 0; gridZ < blocksPerSide; gridZ++) {
      // Calculate building center position within the chunk
      const localX = gridX * BLOCK_SIZE + BLOCK_SIZE / 2;
      const localZ = gridZ * BLOCK_SIZE + BLOCK_SIZE / 2;

      // Convert to world coordinates
      const worldX = worldOffsetX + localX;
      const worldZ = worldOffsetZ + localZ;

      // Generate a unique seed based on world position
      const seed = hashPosition(worldX, worldZ);

      positions.push({ x: worldX, z: worldZ, seed });
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
