import * as THREE from 'three';
import { FlightPath } from './flightPath';

// Default base speed (units per second) - arcade fast!
const DEFAULT_BASE_SPEED = 140;

// Perspective modes
export type PerspectiveMode = 'first-person' | 'third-person';

// Third-person camera offset
const THIRD_PERSON_OFFSET = new THREE.Vector3(0, 15, -40);
const TRANSITION_DURATION = 0.8;
const THIRD_PERSON_DURATION = 6;

/**
 * CameraController manages camera movement along a flight path.
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private flightPath: FlightPath;
  private currentZ: number;
  private currentDistance: number;
  private baseSpeed: number;
  private currentSpeed: number;

  // Perspective state
  private perspectiveMode: PerspectiveMode = 'first-person';
  private perspectiveTransitionProgress: number = 1;
  private thirdPersonTimer: number = 0;
  private isTransitioning: boolean = false;
  private targetPerspective: PerspectiveMode = 'first-person';
  private perspectiveChangeCallbacks: ((mode: PerspectiveMode) => void)[] = [];

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.flightPath = new FlightPath();
    this.currentZ = 0;
    this.currentDistance = 0;
    this.baseSpeed = DEFAULT_BASE_SPEED;
    this.currentSpeed = this.baseSpeed;
    this.updateCameraPosition();
  }

  public setSpeed(speed: number): void {
    this.baseSpeed = speed;
    this.currentSpeed = speed;
  }

  public getSpeed(): number {
    return this.currentSpeed;
  }

  public getBaseSpeed(): number {
    return this.baseSpeed;
  }

  public boostSpeed(multiplier: number): void {
    this.currentSpeed = this.baseSpeed * multiplier;
  }

  public easeToBaseSpeed(factor: number): void {
    this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, this.baseSpeed, factor);
  }

  public update(deltaTime: number): void {
    const distanceThisFrame = this.currentSpeed * deltaTime;
    this.currentDistance += distanceThisFrame;
    this.currentZ += distanceThisFrame;

    // Extend path
    this.flightPath.extendIfNeededByDistance(this.currentDistance);

    // Perspective transitions
    if (this.isTransitioning) {
      this.perspectiveTransitionProgress += deltaTime / TRANSITION_DURATION;
      if (this.perspectiveTransitionProgress >= 1) {
        this.perspectiveTransitionProgress = 1;
        this.isTransitioning = false;
        this.perspectiveMode = this.targetPerspective;
      }
    }

    if (this.perspectiveMode === 'third-person' && !this.isTransitioning) {
      this.thirdPersonTimer += deltaTime;
      if (this.thirdPersonTimer >= THIRD_PERSON_DURATION) {
        this.switchToFirstPerson();
      }
    }

    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const bulletPosition = this.flightPath.getPositionAtDistance(this.currentDistance);
    const tangent = this.flightPath.getTangentAtDistance(this.currentDistance);

    const firstPersonPos = bulletPosition.clone();

    const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, tangent).normalize();

    const thirdPersonPos = bulletPosition.clone()
      .add(tangent.clone().multiplyScalar(THIRD_PERSON_OFFSET.z))
      .add(up.clone().multiplyScalar(THIRD_PERSON_OFFSET.y))
      .add(right.clone().multiplyScalar(THIRD_PERSON_OFFSET.x));

    const t = this.smoothstep(this.perspectiveTransitionProgress);
    let interpFactor = this.targetPerspective === 'third-person' ? t : 1 - t;

    this.camera.position.lerpVectors(firstPersonPos, thirdPersonPos, interpFactor);

    const firstPersonLookTarget = bulletPosition.clone().add(tangent.clone().multiplyScalar(100));
    const thirdPersonLookTarget = bulletPosition.clone();
    const lookTarget = new THREE.Vector3().lerpVectors(firstPersonLookTarget, thirdPersonLookTarget, interpFactor);

    this.camera.lookAt(lookTarget);
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  public getCurrentZ(): number {
    return this.currentZ;
  }

  public getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  public getFlightPath(): FlightPath {
    return this.flightPath;
  }

  public switchToThirdPerson(): void {
    if (this.perspectiveMode === 'third-person' && !this.isTransitioning) {
      this.thirdPersonTimer = 0;
      return;
    }
    this.targetPerspective = 'third-person';
    this.isTransitioning = true;
    this.perspectiveTransitionProgress = 0;
    this.thirdPersonTimer = 0;
    for (const callback of this.perspectiveChangeCallbacks) {
      callback('third-person');
    }
  }

  public switchToFirstPerson(): void {
    if (this.perspectiveMode === 'first-person' && !this.isTransitioning) {
      return;
    }
    this.targetPerspective = 'first-person';
    this.isTransitioning = true;
    this.perspectiveTransitionProgress = 0;
    for (const callback of this.perspectiveChangeCallbacks) {
      callback('first-person');
    }
  }

  public getPerspectiveMode(): PerspectiveMode {
    return this.perspectiveMode;
  }

  public isThirdPerson(): boolean {
    return this.perspectiveMode === 'third-person' ||
      (this.isTransitioning && this.targetPerspective === 'third-person');
  }

  public onPerspectiveChange(callback: (mode: PerspectiveMode) => void): void {
    this.perspectiveChangeCallbacks.push(callback);
  }

  public offPerspectiveChange(callback: (mode: PerspectiveMode) => void): void {
    this.perspectiveChangeCallbacks = this.perspectiveChangeCallbacks.filter(cb => cb !== callback);
  }
}
