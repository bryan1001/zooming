import * as THREE from 'three';
import { FlightPath } from './flightPath';

// Turn animation duration (snappy, 150-200ms)
const TURN_DURATION = 0.175; // 175ms - middle of the range

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
}
