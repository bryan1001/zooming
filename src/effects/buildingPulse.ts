/**
 * Building pulse effect - makes buildings pulse with the beat.
 * Scales buildings and updates emissive intensity based on beat intensity.
 */

import * as THREE from 'three';
import { getBeatIntensity } from '../audio/beatDetector';

// Configuration - cranked up for visible pulsing
const BASE_EMISSIVE_INTENSITY = 0.2;
const MAX_EMISSIVE_BOOST = 4.0; // Big intensity spike on beats
const PULSE_DECAY_RATE = 5; // Slower decay for more visible pulse

// Scale configuration
const BASE_SCALE = 1.0;
const MAX_SCALE_BOOST = 0.3; // Buildings grow 30% on strong beats

// State
let scene: THREE.Scene | null = null;
let currentPulseIntensity = 0;
let buildingMaterials: THREE.MeshStandardMaterial[] = [];
let buildingGroups: THREE.Group[] = []; // Track building groups for scaling
let buildingBaseScales: Map<string, THREE.Vector3> = new Map(); // Store original scales by uuid
let lastMaterialScanTime = 0;
const MATERIAL_SCAN_INTERVAL = 100; // Rescan very frequently to catch new buildings

/**
 * Initialize building pulse effect.
 */
export function initBuildingPulse(sceneRef: THREE.Scene): void {
  scene = sceneRef;
  scanForBuildingMaterials();
}

/**
 * Scan the scene for building materials and groups.
 * Called every frame to catch newly loaded chunks.
 */
function scanForBuildingMaterials(): void {
  if (!scene) return;
  
  // Clear and rebuild lists each scan
  buildingMaterials = [];
  buildingGroups = [];
  
  // Track which UUIDs we see this scan
  const seenUuids = new Set<string>();
  
  scene.traverse((object) => {
    // Track all Groups that contain meshes (these are buildings)
    if (object instanceof THREE.Group && object.children.length > 0) {
      // Check if this group has mesh children (it's a building)
      const hasMeshes = object.children.some(child => child instanceof THREE.Mesh);
      if (hasMeshes) {
        buildingGroups.push(object);
        seenUuids.add(object.uuid);
        
        // Store original scale if not already stored
        if (!buildingBaseScales.has(object.uuid)) {
          buildingBaseScales.set(object.uuid, object.scale.clone());
        }
      }
    }
    
    if (object instanceof THREE.Mesh && object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      
      for (const mat of materials) {
        if (mat instanceof THREE.MeshStandardMaterial && mat.emissive) {
          buildingMaterials.push(mat);
        }
      }
    }
  });
  
  // Clean up stale entries from unloaded chunks
  for (const uuid of buildingBaseScales.keys()) {
    if (!seenUuids.has(uuid)) {
      buildingBaseScales.delete(uuid);
    }
  }
}

/**
 * Trigger a pulse on beat.
 */
export function triggerBuildingPulse(intensity: number): void {
  currentPulseIntensity = Math.max(currentPulseIntensity, intensity);
}

/**
 * Update building pulse effect. Call every frame.
 */
export function updateBuildingPulse(deltaTime: number): void {
  if (!scene) return;
  
  // Periodically rescan for new materials (chunks load/unload)
  const now = performance.now();
  if (now - lastMaterialScanTime > MATERIAL_SCAN_INTERVAL) {
    scanForBuildingMaterials();
    lastMaterialScanTime = now;
  }
  
  // Get current beat intensity for smooth following
  const beatIntensity = getBeatIntensity();
  
  // Use the stronger of triggered pulse or ongoing beat
  const targetIntensity = Math.max(currentPulseIntensity, beatIntensity);
  
  // Decay pulse intensity
  const decay = 1 - Math.exp(-PULSE_DECAY_RATE * deltaTime);
  currentPulseIntensity = currentPulseIntensity * (1 - decay);
  
  // Calculate emissive intensity - dramatic range from dim to bright
  const emissiveIntensity = BASE_EMISSIVE_INTENSITY + (MAX_EMISSIVE_BOOST * targetIntensity * targetIntensity);
  
  // Calculate scale boost
  const scaleBoost = BASE_SCALE + (MAX_SCALE_BOOST * targetIntensity);
  
  // Update all building materials
  for (const mat of buildingMaterials) {
    mat.emissiveIntensity = emissiveIntensity;
  }
  
  // Update all building scales
  for (const group of buildingGroups) {
    const baseScale = buildingBaseScales.get(group.uuid);
    if (baseScale) {
      group.scale.set(
        baseScale.x * scaleBoost,
        baseScale.y * scaleBoost,
        baseScale.z * scaleBoost
      );
    }
  }
}

/**
 * Get the current pulse intensity (0-1).
 */
export function getPulseIntensity(): number {
  return currentPulseIntensity;
}
