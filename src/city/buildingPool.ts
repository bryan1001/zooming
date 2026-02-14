import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export interface BuildingTemplate {
  group: THREE.Group;
  boundingBox: THREE.Box3;
  height: number;
  width: number;
  depth: number;
}

let buildingTemplates: BuildingTemplate[] = [];
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

// SciFi City buildings
const SCIFI_BUILDINGS = [
  'SM_Bld_Large_01.fbx',
  'SM_Bld_Large_02.fbx',
  'SM_Bld_Large_03.fbx',
  'SM_Bld_Large_04.fbx',
  'SM_Bld_Large_05.fbx',
  'SM_Bld_Large_06.fbx',
  'SM_Bld_Industrial_01.fbx',
  'SM_Bld_Industrial_02.fbx',
  'SM_Bld_Advanced_01.fbx',
  'SM_Bld_Advanced_02.fbx',
  'SM_Bld_Raised_01.fbx',
  'SM_Bld_Raised_02.fbx',
  'SM_Bld_Power_01.fbx',
  'SM_Bld_Power_02.fbx',
  'SM_Bld_Power_03.fbx',
  'SM_Bld_Bank_01.fbx',
  'SM_Bld_Chopshop_01.fbx',
  'SM_Bld_Warehouse_01.fbx',
  'SM_Bld_Background_Lrg_01.fbx',
  'SM_Bld_Background_Lrg_02.fbx',
  'SM_Bld_Background_Lrg_03.fbx',
  'SM_Bld_Background_Med_01.fbx',
  'SM_Bld_Background_Med_02.fbx',
  'SM_Bld_Background_Med_03.fbx',
];

const SCIFI_PATH = '/models/3d_synty/POLYGON_SciFi_City/';

// Create a loading manager that remaps .psd → .png
function createPsdRemapManager(): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url: string) => {
    if (url.endsWith('.psd')) {
      return url.replace('.psd', '.png');
    }
    return url;
  });
  return manager;
}

/**
 * Enhance FBX materials: convert Phong→Standard, preserve textures,
 * add subtle night-time emissive glow
 */
function enhanceMaterials(group: THREE.Group) {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    const enhanced = mats.map((mat) => {
      const src = mat as any;
      const existingMap = src.map as THREE.Texture | null;
      const existingColor = src.color as THREE.Color | undefined;

      if (existingMap && existingMap.colorSpace !== THREE.SRGBColorSpace) {
        existingMap.colorSpace = THREE.SRGBColorSpace;
        existingMap.needsUpdate = true;
      }

      return new THREE.MeshStandardMaterial({
        map: existingMap || null,
        color: existingColor || new THREE.Color(0xccccdd),
        roughness: 0.7,
        metalness: 0.15,
        emissive: new THREE.Color(0x333344),
        emissiveIntensity: 0.3,
      });
    });

    child.material = enhanced.length === 1 ? enhanced[0] : enhanced;
  });
}

async function loadBuildingSet(
  files: string[],
  basePath: string,
  label: string
): Promise<BuildingTemplate[]> {
  const manager = createPsdRemapManager();
  const loader = new FBXLoader(manager);
  loader.setResourcePath(basePath);

  let loadedCount = 0;

  const promises = files.map(async (filename) => {
    try {
      const fbx = await loader.loadAsync(basePath + filename);
      const buildingGroup = fbx.clone();

      enhanceMaterials(buildingGroup);

      const box = new THREE.Box3().setFromObject(buildingGroup);
      const size = new THREE.Vector3();
      box.getSize(size);

      if (size.y < 2) return null;

      const center = new THREE.Vector3();
      box.getCenter(center);
      buildingGroup.position.set(-center.x, -box.min.y, -center.z);

      const centeredBox = new THREE.Box3().setFromObject(buildingGroup);

      loadedCount++;
      console.log(`[${label}] ${loadedCount}/${files.length}: ${filename} (${size.y.toFixed(1)} tall)`);

      return {
        group: buildingGroup,
        boundingBox: centeredBox,
        height: size.y,
        width: size.x,
        depth: size.z,
      };
    } catch (error) {
      console.warn(`[${label}] Failed to load ${filename}:`, error);
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter((t): t is BuildingTemplate => t !== null);
}

export async function loadBuildingPool(): Promise<void> {
  if (isLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    buildingTemplates = await loadBuildingSet(SCIFI_BUILDINGS, SCIFI_PATH, 'SciFi');
    buildingTemplates.sort((a, b) => a.height - b.height);

    console.log(`Loaded ${buildingTemplates.length} SciFi City buildings`);
    if (buildingTemplates.length > 0) {
      console.log(`Height range: ${buildingTemplates[0]?.height.toFixed(2)} - ${buildingTemplates[buildingTemplates.length - 1]?.height.toFixed(2)}`);
    }

    isLoaded = true;
  })();

  return loadPromise;
}

export function getRandomBuilding(seed: number): BuildingTemplate | null {
  if (!isLoaded || buildingTemplates.length === 0) return null;
  const index = Math.abs(Math.floor(seed * 1000)) % buildingTemplates.length;
  return buildingTemplates[index];
}

export function getBuildingByHeight(heightCategory: number, seed: number): BuildingTemplate | null {
  if (!isLoaded || buildingTemplates.length === 0) return null;

  const rangeStart = Math.floor(heightCategory * 0.5 * buildingTemplates.length);
  const rangeEnd = Math.min(
    rangeStart + Math.floor(buildingTemplates.length * 0.5) + 1,
    buildingTemplates.length
  );

  const range = rangeEnd - rangeStart;
  const index = rangeStart + Math.abs(Math.floor(seed * 1000)) % Math.max(1, range);
  return buildingTemplates[Math.min(index, buildingTemplates.length - 1)];
}

export function createBuildingMesh(template: BuildingTemplate): THREE.Group {
  const clone = template.group.clone();
  enhanceMaterials(clone);
  return clone;
}

export function isBuildingPoolLoaded(): boolean {
  return isLoaded;
}

export function getBuildingCount(): number {
  return buildingTemplates.length;
}

export function getAllTemplates(): BuildingTemplate[] {
  return buildingTemplates;
}
