import * as THREE from 'three';
import { FlightPath } from './flightPath';

// Default base speed (units per second)
const DEFAULT_BASE_SPEED = 50;

/**
 * CameraController manages camera movement along a flight path.
 * The camera follows a smooth spline curve through the city.
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private flightPath: FlightPath;
  private currentZ: number;
  private baseSpeed: number;
  private currentSpeed: number;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.flightPath = new FlightPath();
    this.currentZ = 0;
    this.baseSpeed = DEFAULT_BASE_SPEED;
    this.currentSpeed = this.baseSpeed;

    // Initialize camera position on the path
    this.updateCameraPosition();
  }

  /**
   * Set the base movement speed
   * @param speed Speed in units per second
   */
  public setSpeed(speed: number): void {
    this.baseSpeed = speed;
    this.currentSpeed = speed;
  }

  /**
   * Get current speed (for UI or debugging)
   */
  public getSpeed(): number {
    return this.currentSpeed;
  }

  /**
   * Get base speed
   */
  public getBaseSpeed(): number {
    return this.baseSpeed;
  }

  /**
   * Temporarily boost speed (for beat sync)
   * @param multiplier Speed multiplier (e.g., 1.5 for 50% boost)
   */
  public boostSpeed(multiplier: number): void {
    this.currentSpeed = this.baseSpeed * multiplier;
  }

  /**
   * Smoothly interpolate current speed back to base speed
   * @param factor Interpolation factor (0-1, higher = faster return)
   */
  public easeToBaseSpeed(factor: number): void {
    this.currentSpeed = THREE.MathUtils.lerp(
      this.currentSpeed,
      this.baseSpeed,
      factor
    );
  }

  /**
   * Update camera position based on delta time
   * Call this every frame
   * @param deltaTime Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    // Move forward along the path
    this.currentZ += this.currentSpeed * deltaTime;

    // Extend the path if needed
    this.flightPath.extendIfNeeded(this.currentZ);

    // Update camera position and orientation
    this.updateCameraPosition();
  }

  /**
   * Update camera position and look direction based on current Z
   */
  private updateCameraPosition(): void {
    // Get position and tangent from the flight path
    const position = this.flightPath.getPositionAtZ(this.currentZ);
    const tangent = this.flightPath.getTangentAtZ(this.currentZ);

    // Set camera position
    this.camera.position.copy(position);

    // Look in the direction of travel
    // Create a look-at target point ahead of the camera
    const lookTarget = new THREE.Vector3()
      .copy(position)
      .add(tangent.multiplyScalar(100));

    this.camera.lookAt(lookTarget);
  }

  /**
   * Get current Z position (for chunk manager, etc.)
   */
  public getCurrentZ(): number {
    return this.currentZ;
  }

  /**
   * Get the current camera position
   */
  public getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  /**
   * Get the flight path for external access (debugging, visualization)
   */
  public getFlightPath(): FlightPath {
    return this.flightPath;
  }
}
