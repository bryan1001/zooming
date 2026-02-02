import * as THREE from 'three';
import { FlightPath } from './flightPath';
import { TurnController } from './turnController';
import type { TurnDirection } from './turnController';

// Re-export TurnDirection for convenience
export type { TurnDirection };

// Default base speed (units per second)
const DEFAULT_BASE_SPEED = 50;

// Perspective modes
export type PerspectiveMode = 'first-person' | 'third-person';

// Third-person camera offset (relative to bullet position)
const THIRD_PERSON_OFFSET = new THREE.Vector3(0, 15, -40); // Behind and above
const TRANSITION_DURATION = 0.8; // Smooth transition time in seconds
const THIRD_PERSON_DURATION = 6; // How long to stay in third-person (seconds)

/**
 * CameraController manages camera movement along a flight path.
 * The camera follows a smooth spline curve through the city.
 * Supports 90-degree turns via TurnController.
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private flightPath: FlightPath;
  private turnController: TurnController;
  private currentZ: number; // Legacy Z tracking (for backward compatibility)
  private currentDistance: number; // Distance traveled along the path
  private baseSpeed: number;
  private currentSpeed: number;

  // Perspective switching state
  private perspectiveMode: PerspectiveMode = 'first-person';
  private perspectiveTransitionProgress: number = 1; // 0 = transitioning, 1 = complete
  private thirdPersonTimer: number = 0;
  private isTransitioning: boolean = false;
  private targetPerspective: PerspectiveMode = 'first-person';

  // Callbacks for perspective changes
  private perspectiveChangeCallbacks: ((mode: PerspectiveMode) => void)[] = [];

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.flightPath = new FlightPath();
    this.turnController = new TurnController(this.flightPath);
    this.currentZ = 0;
    this.currentDistance = 0;
    this.baseSpeed = DEFAULT_BASE_SPEED;
    this.currentSpeed = this.baseSpeed;

    // Set position provider for obstacle detection
    this.turnController.setPositionProvider(() => this.getBulletPosition());

    // Initialize camera position on the path
    this.updateCameraPosition();
  }

  /**
   * Get the current bullet/flight position (not camera position, which may be offset in third-person)
   */
  private getBulletPosition(): THREE.Vector3 {
    return this.flightPath.getPositionAtDistance(this.currentDistance);
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
    // Move forward along the path (constant speed maintained during turns)
    const distanceThisFrame = this.currentSpeed * deltaTime;
    this.currentDistance += distanceThisFrame;
    this.currentZ += distanceThisFrame; // Legacy tracking

    // Extend the path if needed (using distance-based check)
    this.flightPath.extendIfNeededByDistance(this.currentDistance);

    // Update turn animation (if active)
    this.turnController.update(deltaTime);

    // Handle perspective transition animation
    if (this.isTransitioning) {
      this.perspectiveTransitionProgress += deltaTime / TRANSITION_DURATION;
      if (this.perspectiveTransitionProgress >= 1) {
        this.perspectiveTransitionProgress = 1;
        this.isTransitioning = false;
        this.perspectiveMode = this.targetPerspective;
      }
    }

    // Handle third-person auto-return timer
    if (this.perspectiveMode === 'third-person' && !this.isTransitioning) {
      this.thirdPersonTimer += deltaTime;
      if (this.thirdPersonTimer >= THIRD_PERSON_DURATION) {
        this.switchToFirstPerson();
      }
    }

    // Update camera position and orientation
    this.updateCameraPosition();
  }

  /**
   * Update camera position and look direction based on current distance
   */
  private updateCameraPosition(): void {
    // Get position and tangent from the flight path using distance (bullet position)
    const bulletPosition = this.flightPath.getPositionAtDistance(this.currentDistance);
    let tangent = this.flightPath.getTangentAtDistance(this.currentDistance);

    // During a turn, rotate the tangent based on turn animation progress
    // This creates the visual turning effect
    if (this.turnController.isTurning()) {
      const turnDirection = this.turnController.getFlightDirection();
      tangent = turnDirection.clone();
    }

    // Calculate first-person position (directly on bullet)
    const firstPersonPos = bulletPosition.clone();

    // Calculate third-person position (behind and above)
    // Transform offset based on bullet's direction
    const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, tangent).normalize();

    const thirdPersonPos = bulletPosition.clone()
      .add(tangent.clone().multiplyScalar(THIRD_PERSON_OFFSET.z))
      .add(up.clone().multiplyScalar(THIRD_PERSON_OFFSET.y))
      .add(right.clone().multiplyScalar(THIRD_PERSON_OFFSET.x));

    // Calculate interpolation factor based on transition progress
    // Use smoothstep for more natural easing
    const t = this.smoothstep(this.perspectiveTransitionProgress);

    // Determine interpolation direction
    let interpFactor: number;
    if (this.targetPerspective === 'third-person') {
      interpFactor = t;
    } else {
      interpFactor = 1 - t;
    }

    // Interpolate camera position
    this.camera.position.lerpVectors(firstPersonPos, thirdPersonPos, interpFactor);

    // Look at bullet in third-person, look forward in first-person
    const firstPersonLookTarget = bulletPosition.clone().add(tangent.clone().multiplyScalar(100));
    const thirdPersonLookTarget = bulletPosition.clone();

    const lookTarget = new THREE.Vector3().lerpVectors(
      firstPersonLookTarget,
      thirdPersonLookTarget,
      interpFactor
    );

    this.camera.lookAt(lookTarget);

    // Apply banking (Z-axis roll) for dramatic turn effect
    const bankAngle = this.turnController.getBankAngle();
    if (bankAngle !== 0) {
      // Rotate camera around its forward (Z) axis for banking
      this.camera.rotateZ(bankAngle);
    }
  }

  /**
   * Smoothstep function for smooth easing
   */
  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
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

  /**
   * Switch to third-person perspective
   * Starts a smooth transition animation
   */
  public switchToThirdPerson(): void {
    if (this.perspectiveMode === 'third-person' && !this.isTransitioning) {
      // Already in third-person, just reset timer
      this.thirdPersonTimer = 0;
      return;
    }

    this.targetPerspective = 'third-person';
    this.isTransitioning = true;
    this.perspectiveTransitionProgress = 0;
    this.thirdPersonTimer = 0;

    // Notify listeners
    for (const callback of this.perspectiveChangeCallbacks) {
      callback('third-person');
    }
  }

  /**
   * Switch to first-person perspective
   * Starts a smooth transition animation
   */
  public switchToFirstPerson(): void {
    if (this.perspectiveMode === 'first-person' && !this.isTransitioning) {
      return; // Already in first-person
    }

    this.targetPerspective = 'first-person';
    this.isTransitioning = true;
    this.perspectiveTransitionProgress = 0;

    // Notify listeners
    for (const callback of this.perspectiveChangeCallbacks) {
      callback('first-person');
    }
  }

  /**
   * Get current perspective mode
   */
  public getPerspectiveMode(): PerspectiveMode {
    return this.perspectiveMode;
  }

  /**
   * Check if camera is currently in third-person or transitioning to it
   */
  public isThirdPerson(): boolean {
    return this.perspectiveMode === 'third-person' ||
      (this.isTransitioning && this.targetPerspective === 'third-person');
  }

  /**
   * Subscribe to perspective change events
   */
  public onPerspectiveChange(callback: (mode: PerspectiveMode) => void): void {
    this.perspectiveChangeCallbacks.push(callback);
  }

  /**
   * Unsubscribe from perspective change events
   */
  public offPerspectiveChange(callback: (mode: PerspectiveMode) => void): void {
    this.perspectiveChangeCallbacks = this.perspectiveChangeCallbacks.filter(
      cb => cb !== callback
    );
  }

  /**
   * Execute a 90-degree turn in the specified direction.
   * @param direction 'left' or 'right'
   * @returns true if turn was started, false if already turning
   */
  public executeTurn(direction: TurnDirection): boolean {
    return this.turnController.executeTurn(direction);
  }

  /**
   * Check if turning in the given direction is safe (no collisions).
   * @param direction 'left' or 'right'
   * @returns true if the turn is safe, false if buildings are in the way
   */
  public canTurnSafely(direction: TurnDirection): boolean {
    return this.turnController.canTurnSafely(direction);
  }

  /**
   * Check if a turn is currently in progress.
   */
  public isTurning(): boolean {
    return this.turnController.isTurning();
  }

  /**
   * Get the turn controller for advanced access (e.g., subscribing to turn events)
   */
  public getTurnController(): TurnController {
    return this.turnController;
  }
}
