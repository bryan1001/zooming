import * as THREE from 'three';
import { createWindowTextures } from './windowTexture';

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

// Building dimension ranges
const MIN_HEIGHT = 10;
const MAX_HEIGHT = 100;
const MIN_WIDTH = 5;
const MAX_WIDTH = 20;

// Shared unit box geometry (1x1x1) that will be scaled per-instance
let sharedGeometry: THREE.BoxGeometry | null = null;

// Shared materials - use fewer variants for fewer draw calls
const MATERIAL_VARIANTS = 2;
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
    for (let i = 0; i < MATERIAL_VARIANTS; i++) {
      const seed = i * 12345;
      const litProbability = 0.3 + (i / MATERIAL_VARIANTS) * 0.3;
      const { colorTexture, emissiveTexture } = createWindowTextures(seed, litProbability);

      // Set initial repeat - will be adjusted per building with instance attributes
      colorTexture.repeat.set(2, 8);
      emissiveTexture.repeat.set(2, 8);

      // Create materials for each face
      const materials: THREE.MeshStandardMaterial[] = [
        // Right face (+X)
        new THREE.MeshStandardMaterial({
          map: colorTexture.clone(),
          emissiveMap: emissiveTexture.clone(),
          emissive: 0xffffff,
          emissiveIntensity: 0.8,
          roughness: 0.7,
          metalness: 0.1,
        }),
        // Left face (-X)
        new THREE.MeshStandardMaterial({
          map: colorTexture.clone(),
          emissiveMap: emissiveTexture.clone(),
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
          map: colorTexture.clone(),
          emissiveMap: emissiveTexture.clone(),
          emissive: 0xffffff,
          emissiveIntensity: 0.8,
          roughness: 0.7,
          metalness: 0.1,
        }),
        // Back face (-Z)
        new THREE.MeshStandardMaterial({
          map: colorTexture.clone(),
          emissiveMap: emissiveTexture.clone(),
          emissive: 0xffffff,
          emissiveIntensity: 0.8,
          roughness: 0.7,
          metalness: 0.1,
        }),
      ];

      sharedMaterials.push(materials);
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
}

/**
 * Generates building data for a set of positions
 */
export function generateBuildingData(
  positions: Array<{ x: number; z: number; seed: number }>
): BuildingData[] {
  return positions.map(({ x, z, seed }) => {
    const random = seededRandom(seed);
    const height = MIN_HEIGHT + random() * (MAX_HEIGHT - MIN_HEIGHT);
    const width = MIN_WIDTH + random() * (MAX_WIDTH - MIN_WIDTH);
    const depth = MIN_WIDTH + random() * (MAX_WIDTH - MIN_WIDTH);
    const materialIndex = Math.floor(random() * MATERIAL_VARIANTS);

    return { x, z, width, height, depth, materialIndex };
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
