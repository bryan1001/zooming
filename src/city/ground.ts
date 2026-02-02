import * as THREE from 'three';
import { CHUNK_SIZE } from './chunk';

// Street marking colors
const ASPHALT_COLOR = 0x1a1a1a; // Dark asphalt
const STREET_LINE_COLOR = 0x3a3a3a; // Slightly lighter for street markings

// Grid configuration matching chunk.ts
const BLOCK_SIZE = 25;

/**
 * Creates a procedural street texture using canvas
 * Shows grid of streets with line markings between building blocks
 */
function createStreetTexture(): THREE.CanvasTexture {
  const size = 512; // Texture resolution
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Fill with asphalt base color
  ctx.fillStyle = `#${ASPHALT_COLOR.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);

  // Calculate pixel scale: how many pixels per world unit
  const pixelsPerUnit = size / CHUNK_SIZE;
  const blockSizePixels = BLOCK_SIZE * pixelsPerUnit;

  // Draw street lines between blocks
  ctx.strokeStyle = `#${STREET_LINE_COLOR.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 2;

  const blocksPerSide = Math.floor(CHUNK_SIZE / BLOCK_SIZE);

  // Draw grid lines for streets
  for (let i = 0; i <= blocksPerSide; i++) {
    const pos = i * blockSizePixels;

    // Vertical street lines
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();

    // Horizontal street lines
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }

  // Add center dashed lines for roads (yellow-ish for visual interest)
  ctx.strokeStyle = '#2a2820';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 12]);

  for (let i = 0; i < blocksPerSide; i++) {
    const center = i * blockSizePixels + blockSizePixels / 2;

    // Vertical center lines
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, size);
    ctx.stroke();

    // Horizontal center lines
    ctx.beginPath();
    ctx.moveTo(0, center);
    ctx.lineTo(size, center);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return texture;
}

// Cache the street texture so we only create it once
let streetTexture: THREE.CanvasTexture | null = null;

function getStreetTexture(): THREE.CanvasTexture {
  if (!streetTexture) {
    streetTexture = createStreetTexture();
  }
  return streetTexture;
}

/**
 * Creates a ground plane mesh for a chunk
 * The ground extends the full size of the chunk with street texture
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @returns A mesh representing the ground for this chunk
 */
export function createGround(chunkX: number, chunkZ: number): THREE.Mesh {
  // Create plane geometry matching chunk size
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);

  // Rotate to lie flat (PlaneGeometry is vertical by default)
  geometry.rotateX(-Math.PI / 2);

  // Get or create street texture
  const texture = getStreetTexture();

  // Create material with street texture
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff, // Use white so texture shows true colors
    roughness: 0.9,
    metalness: 0.1,
  });

  const ground = new THREE.Mesh(geometry, material);

  // Position ground at center of chunk at y=0
  const worldX = chunkX * CHUNK_SIZE + CHUNK_SIZE / 2;
  const worldZ = chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2;
  ground.position.set(worldX, 0, worldZ);

  // Receive shadows from buildings
  ground.receiveShadow = true;

  return ground;
}
