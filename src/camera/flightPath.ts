import * as THREE from 'three';

// Block size from chunk.ts - buildings are at block centers
const BLOCK_SIZE = 25;

// Flight height (street level, above ground but below most buildings)
const FLIGHT_HEIGHT = 30;

// Distance between path control points
const PATH_SEGMENT_LENGTH = 100;

// How far ahead to extend the path (in world units)
const EXTEND_AHEAD_DISTANCE = 1000;

// Minimum distance from end before extending path
const EXTEND_THRESHOLD = 500;

/**
 * FlightPath generates a smooth CatmullRomCurve3 path through the city streets.
 * Path extends dynamically as the camera approaches the end.
 */
export class FlightPath {
  private curve: THREE.CatmullRomCurve3;
  private controlPoints: THREE.Vector3[];
  private lastZ: number; // Track the furthest Z point added
  private seed: number;

  constructor() {
    this.seed = 12345; // Deterministic seed for reproducible paths
    this.controlPoints = [];
    this.lastZ = 0;

    // Initialize with starting points
    this.addInitialPoints();
    this.curve = new THREE.CatmullRomCurve3(this.controlPoints);
  }

  /**
   * Add initial path points to get started
   */
  private addInitialPoints(): void {
    // Start at origin, at street level
    const startX = 0;

    // Add several initial points going forward
    for (let z = 0; z <= EXTEND_AHEAD_DISTANCE; z += PATH_SEGMENT_LENGTH) {
      const point = this.generateStreetPoint(startX, z);
      this.controlPoints.push(point);
      this.lastZ = z;
    }
  }

  /**
   * Generate a point that lies on streets (not on buildings)
   * Streets run between building blocks
   */
  private generateStreetPoint(hintX: number, z: number): THREE.Vector3 {
    // Streets run along the edges of blocks, not through block centers
    // Block centers are at (n * BLOCK_SIZE + BLOCK_SIZE/2) positions
    // So streets are at (n * BLOCK_SIZE) positions

    // Find nearest street X position (multiple of BLOCK_SIZE)
    const streetX = Math.round(hintX / BLOCK_SIZE) * BLOCK_SIZE;

    // Add some lateral variation to make the path more interesting
    // Occasionally curve to a different parallel street
    const random = this.seededRandom();
    let x = streetX;

    // 30% chance to curve to an adjacent street
    if (random < 0.3) {
      const direction = random < 0.15 ? -1 : 1;
      x += direction * BLOCK_SIZE;
    }

    return new THREE.Vector3(x, FLIGHT_HEIGHT, z);
  }

  /**
   * Simple seeded random number generator (0-1)
   */
  private seededRandom(): number {
    // Mulberry32 PRNG
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Extend the path ahead if needed
   * Call this each frame with current camera Z position
   */
  public extendIfNeeded(cameraZ: number): void {
    // Check if we need to extend
    const distanceToEnd = this.lastZ - cameraZ;

    if (distanceToEnd < EXTEND_THRESHOLD) {
      // Get the last point's X to use as a hint for continuity
      const lastPoint = this.controlPoints[this.controlPoints.length - 1];
      const hintX = lastPoint.x;

      // Add more points
      for (let i = 0; i < 5; i++) {
        const newZ = this.lastZ + PATH_SEGMENT_LENGTH;
        const point = this.generateStreetPoint(hintX, newZ);
        this.controlPoints.push(point);
        this.lastZ = newZ;
      }

      // Recreate curve with new points
      this.curve = new THREE.CatmullRomCurve3(this.controlPoints);
    }
  }

  /**
   * Convert a Z position to a t value along the curve (0-1)
   */
  private zToT(z: number): number {
    // Since our points are roughly evenly spaced along Z,
    // we can approximate t based on Z position
    const startZ = this.controlPoints[0].z;
    const endZ = this.controlPoints[this.controlPoints.length - 1].z;
    const t = (z - startZ) / (endZ - startZ);
    return Math.max(0, Math.min(1, t));
  }

  /**
   * Get position on the path at a given t value (0-1)
   */
  public getPositionAt(t: number): THREE.Vector3 {
    return this.curve.getPointAt(Math.max(0, Math.min(1, t)));
  }

  /**
   * Get tangent (direction) on the path at a given t value (0-1)
   */
  public getTangentAt(t: number): THREE.Vector3 {
    return this.curve.getTangentAt(Math.max(0, Math.min(1, t)));
  }

  /**
   * Get position on the path based on Z coordinate
   * This is more intuitive for the infinite scrolling city
   */
  public getPositionAtZ(z: number): THREE.Vector3 {
    const t = this.zToT(z);
    return this.getPositionAt(t);
  }

  /**
   * Get tangent on the path based on Z coordinate
   */
  public getTangentAtZ(z: number): THREE.Vector3 {
    const t = this.zToT(z);
    return this.getTangentAt(t);
  }

  /**
   * Get the current path length
   */
  public getLength(): number {
    return this.curve.getLength();
  }

  /**
   * Get the curve for debugging/visualization
   */
  public getCurve(): THREE.CatmullRomCurve3 {
    return this.curve;
  }
}
