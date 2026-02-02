import * as THREE from 'three';
import { createChunk, CHUNK_SIZE } from './chunk';

/**
 * ChunkManager handles the dynamic loading and unloading of city chunks
 * as the camera moves through the scene, creating an infinite city effect.
 */
export class ChunkManager {
  private scene: THREE.Scene;
  private loadedChunks: Map<string, THREE.Group> = new Map();

  // How many chunks to load ahead of camera in movement direction
  private chunksAhead = 3;
  // How many chunks to keep behind camera before removing
  private chunksBehind = 2;
  // Lateral chunks (perpendicular to movement)
  private chunksLateral = 2;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Generates a unique key for chunk identification
   */
  private getChunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  /**
   * Converts world position to chunk coordinates
   */
  private worldToChunk(worldX: number, worldZ: number): { chunkX: number; chunkZ: number } {
    return {
      chunkX: Math.floor(worldX / CHUNK_SIZE),
      chunkZ: Math.floor(worldZ / CHUNK_SIZE),
    };
  }

  /**
   * Loads a chunk if not already loaded
   */
  private loadChunk(chunkX: number, chunkZ: number): void {
    const key = this.getChunkKey(chunkX, chunkZ);

    if (this.loadedChunks.has(key)) {
      return; // Already loaded
    }

    const chunk = createChunk(chunkX, chunkZ);
    this.loadedChunks.set(key, chunk);
    this.scene.add(chunk);
  }

  /**
   * Unloads a chunk and removes it from the scene
   */
  private unloadChunk(chunkX: number, chunkZ: number): void {
    const key = this.getChunkKey(chunkX, chunkZ);
    const chunk = this.loadedChunks.get(key);

    if (chunk) {
      this.scene.remove(chunk);
      // Dispose of geometries and materials to free memory
      chunk.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (object.material instanceof THREE.Material) {
            object.material.dispose();
          }
        }
      });
      this.loadedChunks.delete(key);
    }
  }

  /**
   * Updates chunk loading/unloading based on camera position
   * Call this every frame with the camera's current position
   * @param cameraPosition - The camera's current world position
   */
  update(cameraPosition: THREE.Vector3): void {
    const { chunkX: currentChunkX, chunkZ: currentChunkZ } = this.worldToChunk(
      cameraPosition.x,
      cameraPosition.z
    );

    // Determine which chunks should be loaded
    // Load chunks ahead in Z direction (primary movement direction) and laterally
    const chunksToKeep = new Set<string>();

    for (let dx = -this.chunksLateral; dx <= this.chunksLateral; dx++) {
      // Load from behind to ahead in Z direction
      for (let dz = -this.chunksBehind; dz <= this.chunksAhead; dz++) {
        const targetChunkX = currentChunkX + dx;
        const targetChunkZ = currentChunkZ + dz;
        const key = this.getChunkKey(targetChunkX, targetChunkZ);

        chunksToKeep.add(key);
        this.loadChunk(targetChunkX, targetChunkZ);
      }
    }

    // Remove chunks that are no longer needed
    for (const [key, chunk] of this.loadedChunks) {
      if (!chunksToKeep.has(key)) {
        const { chunkX, chunkZ } = chunk.userData as { chunkX: number; chunkZ: number };
        this.unloadChunk(chunkX, chunkZ);
      }
    }
  }

  /**
   * Returns the number of currently loaded chunks
   */
  getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }

  /**
   * Disposes of all loaded chunks and cleans up resources
   */
  dispose(): void {
    for (const [key] of this.loadedChunks) {
      const [chunkX, chunkZ] = key.split(',').map(Number);
      this.unloadChunk(chunkX, chunkZ);
    }
  }
}
