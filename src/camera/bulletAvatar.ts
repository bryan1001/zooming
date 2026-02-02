import * as THREE from 'three';
import { FlightPath } from './flightPath';

// Bullet dimensions
const BULLET_LENGTH = 3;
const BULLET_RADIUS = 0.5;

// Glow light configuration
const GLOW_COLOR = 0x00ffff; // Cyan
const GLOW_INTENSITY = 2;
const GLOW_DISTANCE = 50;

/**
 * BulletAvatar creates a glowing bullet/capsule that follows the flight path.
 * Visible during third-person camera shots, hidden during first-person.
 */
export class BulletAvatar {
  private group: THREE.Group;
  private bulletMesh: THREE.Mesh;
  private pointLight: THREE.PointLight;
  private flightPath: FlightPath;
  private currentZ: number;
  private visible: boolean;

  constructor(scene: THREE.Scene, flightPath: FlightPath) {
    this.flightPath = flightPath;
    this.currentZ = 0;
    this.visible = false;

    // Create group to hold bullet and light
    this.group = new THREE.Group();

    // Create elongated capsule/bullet geometry
    // Use a capsule geometry (cylinder with hemispherical caps)
    const capsuleGeometry = new THREE.CapsuleGeometry(
      BULLET_RADIUS,
      BULLET_LENGTH,
      8,
      16
    );
    // Rotate to align with Z-axis (forward direction)
    capsuleGeometry.rotateX(Math.PI / 2);

    // Create glowing emissive material
    const bulletMaterial = new THREE.MeshStandardMaterial({
      color: GLOW_COLOR,
      emissive: GLOW_COLOR,
      emissiveIntensity: 1.5,
      metalness: 0.8,
      roughness: 0.2,
    });

    this.bulletMesh = new THREE.Mesh(capsuleGeometry, bulletMaterial);
    this.group.add(this.bulletMesh);

    // Add point light for glow effect
    this.pointLight = new THREE.PointLight(
      GLOW_COLOR,
      GLOW_INTENSITY,
      GLOW_DISTANCE
    );
    this.pointLight.castShadow = false;
    this.group.add(this.pointLight);

    // Start hidden (first-person mode)
    this.group.visible = false;

    // Add to scene
    scene.add(this.group);

    // Initialize position
    this.updatePosition();
  }

  /**
   * Update the bullet position to follow the flight path
   * @param z The current Z position along the path
   */
  public update(z: number): void {
    this.currentZ = z;
    this.updatePosition();
  }

  /**
   * Update position and orientation based on current Z
   */
  private updatePosition(): void {
    // Get position and tangent from flight path
    const position = this.flightPath.getPositionAtZ(this.currentZ);
    const tangent = this.flightPath.getTangentAtZ(this.currentZ);

    // Set position
    this.group.position.copy(position);

    // Orient bullet to face direction of travel
    // Create a look-at target
    const lookTarget = new THREE.Vector3()
      .copy(position)
      .add(tangent.multiplyScalar(10));
    this.group.lookAt(lookTarget);
  }

  /**
   * Show the bullet avatar (for third-person view)
   */
  public show(): void {
    this.visible = true;
    this.group.visible = true;
  }

  /**
   * Hide the bullet avatar (for first-person view)
   */
  public hide(): void {
    this.visible = false;
    this.group.visible = false;
  }

  /**
   * Check if bullet is currently visible
   */
  public isVisible(): boolean {
    return this.visible;
  }

  /**
   * Get the bullet's current position
   */
  public getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.bulletMesh.geometry.dispose();
    (this.bulletMesh.material as THREE.Material).dispose();
    this.group.parent?.remove(this.group);
  }
}
