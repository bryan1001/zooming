import * as THREE from 'three';
import { createModelChunk, CHUNK_SIZE } from './modelChunk';
import { loadBuildingPool } from './buildingPool';

// How far ahead/behind to render chunks
const RENDER_DISTANCE = 12; // chunks in each direction for very long view distance

/**
 * ModelChunkManager handles loading/unloading chunks using the glTF building pool
 */
export class ModelChunkManager {
  private scene: THREE.Scene;
  private loadedChunks: Map<string, THREE.Group> = new Map();
  private isReady: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.init();
  }

  private async init(): Promise<void> {
    console.log('Loading building pool...');
    await loadBuildingPool();
    this.isReady = true;
    console.log('ModelChunkManager ready');
  }

  private getChunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  private getChunkCoords(position: THREE.Vector3): { chunkX: number; chunkZ: number } {
    return {
      chunkX: Math.floor(position.x / CHUNK_SIZE),
      chunkZ: Math.floor(position.z / CHUNK_SIZE),
    };
  }

  private loadChunk(chunkX: number, chunkZ: number): void {
    const key = this.getChunkKey(chunkX, chunkZ);
    if (this.loadedChunks.has(key)) return;

    const chunk = createModelChunk(chunkX, chunkZ);
    this.loadedChunks.set(key, chunk);
    this.scene.add(chunk);
  }

  private unloadChunk(chunkX: number, chunkZ: number): void {
    const key = this.getChunkKey(chunkX, chunkZ);
    const chunk = this.loadedChunks.get(key);
    
    if (chunk) {
      this.scene.remove(chunk);
      
      // Dispose of geometries and materials
      chunk.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Don't dispose shared geometries/materials from the pool
          // They're shared across all chunks
        }
      });
      
      this.loadedChunks.delete(key);
    }
  }

  public update(cameraPosition: THREE.Vector3): void {
    if (!this.isReady) return;

    const { chunkX: camChunkX, chunkZ: camChunkZ } = this.getChunkCoords(cameraPosition);

    // Determine which chunks should be loaded
    const neededChunks = new Set<string>();
    
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const cx = camChunkX + dx;
        const cz = camChunkZ + dz;
        neededChunks.add(this.getChunkKey(cx, cz));
      }
    }

    // Unload chunks that are no longer needed
    for (const [key] of this.loadedChunks) {
      if (!neededChunks.has(key)) {
        const [x, z] = key.split(',').map(Number);
        this.unloadChunk(x, z);
      }
    }

    // Load new chunks
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const cx = camChunkX + dx;
        const cz = camChunkZ + dz;
        this.loadChunk(cx, cz);
      }
    }
  }

  public getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }
}
