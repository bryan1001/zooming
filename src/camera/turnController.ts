import * as THREE from 'three';
import { FlightPath } from './flightPath';
import { BLOCK_SIZE } from '../city/chunk';

// Turn animation duration (snappy, 150-200ms)
const TURN_DURATION = 0.175; // 175ms - middle of the range

// Obstacle detection distances
const TURN_CHECK_DISTANCE = 100; // Check 100 units in turn direction
const POST_TURN_CHECK_DISTANCE = 200; // Check 200 units ahead after turn

// Building dimension estimates for collision detection
// Buildings are at block centers with max dimensions
const MAX_BUILDING_WIDTH = 20; // From instancedBuildings.ts MAX_WIDTH
const COLLISION_BUFFER = 5; // Safety margin

// Direction type for turns
export type TurnDirection = 'left' | 'right';

// Turn state
interface TurnState {
  isActive: boolean;
  progress: number; // 0-1
  direction: TurnDirection;
  startAngle: number;
  targetAngle: number;
}

/**
 * TurnController manages sharp 90-degree turns during flight.
 * Turns are snappy (150-200ms) and trigger flight path regeneration.
 */
export class TurnController {
  private flightPath: FlightPath;
  private turnState: TurnState;
  private currentFlightAngle: number; // Current flight direction in radians (0 = +Z)

  // Callbacks for turn events
  private turnCompleteCallbacks: ((direction: TurnDirection) => void)[] = [];

  // Position provider for obstacle detection
  private positionProvider: (() => THREE.Vector3) | null = null;

  constructor(flightPath: FlightPath) {
    this.flightPath = flightPath;
    this.currentFlightAngle = 0; // Start facing +Z direction
    this.turnState = {
      isActive: false,
      progress: 0,
      direction: 'left',
      startAngle: 0,
      targetAngle: 0,
    };
  }

  /**
   * Set the position provider function for obstacle detection.
   * @param provider Function that returns current camera/flight position
   */
  public setPositionProvider(provider: () => THREE.Vector3): void {
    this.positionProvider = provider;
  }

  /**
   * Execute a 90-degree turn in the specified direction.
   * @param direction 'left' or 'right'
   * @returns true if turn was started, false if already turning
   */
  public executeTurn(direction: TurnDirection): boolean {
    // Don't start a new turn if already turning
    if (this.turnState.isActive) {
      return false;
    }

    // Calculate target angle (90 degrees = PI/2 radians)
    const turnAngle = direction === 'left' ? Math.PI / 2 : -Math.PI / 2;
    const targetAngle = this.currentFlightAngle + turnAngle;

    // Start the turn
    this.turnState = {
      isActive: true,
      progress: 0,
      direction,
      startAngle: this.currentFlightAngle,
      targetAngle,
    };

    return true;
  }

  /**
   * Update turn animation. Call each frame.
   * @param deltaTime Time since last frame in seconds
   * @returns true if currently turning, false otherwise
   */
  public update(deltaTime: number): boolean {
    if (!this.turnState.isActive) {
      return false;
    }

    // Progress the turn animation
    this.turnState.progress += deltaTime / TURN_DURATION;

    if (this.turnState.progress >= 1) {
      // Turn complete
      this.turnState.progress = 1;
      this.turnState.isActive = false;
      this.currentFlightAngle = this.turnState.targetAngle;

      // Normalize angle to keep it in reasonable range
      this.currentFlightAngle = this.normalizeAngle(this.currentFlightAngle);

      // Notify callbacks
      for (const callback of this.turnCompleteCallbacks) {
        callback(this.turnState.direction);
      }

      // Trigger flight path regeneration in new direction
      this.flightPath.setFlightDirection(this.currentFlightAngle);

      return false;
    }

    return true;
  }

  /**
   * Get the current interpolated flight angle during a turn.
   * Uses ease-in-out for snappy feel.
   */
  public getCurrentAngle(): number {
    if (!this.turnState.isActive) {
      return this.currentFlightAngle;
    }

    // Use ease-in-out cubic for snappy feel
    const t = this.easeInOutCubic(this.turnState.progress);
    return THREE.MathUtils.lerp(
      this.turnState.startAngle,
      this.turnState.targetAngle,
      t
    );
  }

  /**
   * Get the current flight direction as a normalized vector.
   */
  public getFlightDirection(): THREE.Vector3 {
    const angle = this.getCurrentAngle();
    // Convert angle to direction vector (angle 0 = +Z, increasing angle = counterclockwise when viewed from above)
    return new THREE.Vector3(
      Math.sin(angle),
      0,
      Math.cos(angle)
    ).normalize();
  }

  /**
   * Check if a turn is currently in progress.
   */
  public isTurning(): boolean {
    return this.turnState.isActive;
  }

  /**
   * Get the current turn progress (0-1).
   */
  public getTurnProgress(): number {
    return this.turnState.isActive ? this.turnState.progress : 0;
  }

  /**
   * Get the base flight angle (not including turn animation).
   */
  public getBaseAngle(): number {
    return this.currentFlightAngle;
  }

  /**
   * Subscribe to turn complete events.
   */
  public onTurnComplete(callback: (direction: TurnDirection) => void): void {
    this.turnCompleteCallbacks.push(callback);
  }

  /**
   * Unsubscribe from turn complete events.
   */
  public offTurnComplete(callback: (direction: TurnDirection) => void): void {
    this.turnCompleteCallbacks = this.turnCompleteCallbacks.filter(
      cb => cb !== callback
    );
  }

  /**
   * Ease-in-out cubic function for snappy animation.
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Normalize angle to [-PI, PI] range.
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  /**
   * Check if turning in the given direction is safe (no collisions).
   * Checks both the immediate turn area and the post-turn path.
   * @param direction 'left' or 'right'
   * @returns true if the turn is safe, false if buildings are in the way
   */
  public canTurnSafely(direction: TurnDirection): boolean {
    // If no position provider is set, allow turns (fallback behavior)
    if (!this.positionProvider) {
      return true;
    }

    // Don't allow turns if already turning
    if (this.turnState.isActive) {
      return false;
    }

    const currentPosition = this.positionProvider();

    // Calculate the turn angle (90 degrees = PI/2)
    const turnAngle = direction === 'left' ? Math.PI / 2 : -Math.PI / 2;
    const turnDirection = this.normalizeAngle(this.currentFlightAngle + turnAngle);

    // Calculate the direction vectors
    const turnDirectionVec = new THREE.Vector3(
      Math.sin(turnDirection),
      0,
      Math.cos(turnDirection)
    );

    // Check 1: Raycast in turn direction for TURN_CHECK_DISTANCE (100 units)
    if (!this.checkPathClear(currentPosition, turnDirectionVec, TURN_CHECK_DISTANCE)) {
      return false;
    }

    // Calculate the position after the turn (approximately where we'd be after turning)
    // We check from a point slightly ahead in the turn direction
    const postTurnStartPos = currentPosition.clone().add(
      turnDirectionVec.clone().multiplyScalar(TURN_CHECK_DISTANCE / 2)
    );

    // Check 2: Check the post-turn path for POST_TURN_CHECK_DISTANCE (200 units) ahead
    // After turning, we continue in the new direction
    if (!this.checkPathClear(postTurnStartPos, turnDirectionVec, POST_TURN_CHECK_DISTANCE)) {
      return false;
    }

    return true;
  }

  /**
   * Check if a path from a given position in a given direction is clear of buildings.
   * Uses grid-based collision detection since buildings are at deterministic positions.
   * @param startPos Starting position
   * @param direction Direction vector (normalized)
   * @param distance Distance to check
   * @returns true if path is clear, false if blocked
   */
  private checkPathClear(
    startPos: THREE.Vector3,
    direction: THREE.Vector3,
    distance: number
  ): boolean {
    // Check at intervals along the path
    const checkInterval = BLOCK_SIZE / 2; // Check every half block
    const numChecks = Math.ceil(distance / checkInterval);

    for (let i = 0; i <= numChecks; i++) {
      const checkDistance = Math.min(i * checkInterval, distance);
      const checkPoint = startPos.clone().add(
        direction.clone().multiplyScalar(checkDistance)
      );

      // Check if this point collides with a building
      if (this.isPointNearBuilding(checkPoint)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a point is too close to a building.
   * Buildings are positioned at block centers: (n * BLOCK_SIZE + BLOCK_SIZE/2).
   * Streets run at: (n * BLOCK_SIZE) positions.
   * @param point The point to check
   * @returns true if the point is too close to a building
   */
  private isPointNearBuilding(point: THREE.Vector3): boolean {
    // Calculate the distance from the point to the nearest building center
    // Building centers are at (n * BLOCK_SIZE + BLOCK_SIZE/2, *, m * BLOCK_SIZE + BLOCK_SIZE/2)

    // Find the nearest building center in X
    const buildingCenterX = Math.round((point.x - BLOCK_SIZE / 2) / BLOCK_SIZE) * BLOCK_SIZE + BLOCK_SIZE / 2;
    // Find the nearest building center in Z
    const buildingCenterZ = Math.round((point.z - BLOCK_SIZE / 2) / BLOCK_SIZE) * BLOCK_SIZE + BLOCK_SIZE / 2;

    // Calculate distance from point to building center (in XZ plane)
    const dx = Math.abs(point.x - buildingCenterX);
    const dz = Math.abs(point.z - buildingCenterZ);

    // Buildings have max width/depth of MAX_BUILDING_WIDTH
    // Use axis-aligned box collision with buffer
    const collisionRadius = MAX_BUILDING_WIDTH / 2 + COLLISION_BUFFER;

    // If point is within the building's collision box in both X and Z
    return dx < collisionRadius && dz < collisionRadius;
  }
}
