import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

/**
 * Load the city model and add it to the scene
 */
export async function loadCityModel(scene: THREE.Scene): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(
      '/models/scene.gltf',
      (gltf) => {
        const model = gltf.scene;
        
        // Log model info
        console.log('City model loaded');
        console.log('Children:', model.children.length);
        
        // Get bounding box to understand scale
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        console.log('Model size:', size.x, size.y, size.z);
        console.log('Model center:', center.x, center.y, center.z);
        
        // Add to scene
        scene.add(model);
        
        resolve(model);
      },
      (progress) => {
        const percent = (progress.loaded / progress.total * 100).toFixed(1);
        console.log(`Loading city model: ${percent}%`);
      },
      (error) => {
        console.error('Error loading city model:', error);
        reject(error);
      }
    );
  });
}

/**
 * Extract individual building meshes from the loaded model
 */
export function extractBuildings(model: THREE.Group): THREE.Mesh[] {
  const buildings: THREE.Mesh[] = [];
  
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      buildings.push(child);
    }
  });
  
  console.log(`Extracted ${buildings.length} building meshes`);
  return buildings;
}
