import * as THREE from 'three';

// Street and block layout configuration (must match chunk.ts)
// Scaled 5x for massive buildings with extra wide streets
const STREET_WIDTH = 180; // Extra wide streets for guaranteed clear flight
const BUILDING_GAP = 30;
const BUILDING_WIDTH = 100;
const BUILDINGS_PER_BLOCK = 3;

// Derived values
const CITY_BLOCK_SIZE = BUILDINGS_PER_BLOCK * BUILDING_WIDTH + (BUILDINGS_PER_BLOCK - 1) * BUILDING_GAP;
const BLOCK_WITH_STREET = CITY_BLOCK_SIZE + STREET_WIDTH;

// Flight height (elevated above street furniture and low obstacles)
// Scaled up for massive buildings
const FLIGHT_HEIGHT = 60;

// How far ahead to extend the path (in world units)
const EXTEND_AHEAD_DISTANCE = 1000;

// Minimum distance from end before extending path
const EXTEND_THRESHOLD = 500;

/**
 * Calculate the center position of a street given its index
 */
function getStreetCenter(streetIndex: number): number {
  return streetIndex * BLOCK_WITH_STREET + CITY_BLOCK_SIZE + STREET_WIDTH / 2;
}

/**
 * FlightPath manages camera movement through city streets.
 * Uses straight line segments between intersections.
 */
export class FlightPath {
  private controlPoints: THREE.Vector3[] = [];
  private segmentLengths: number[] = []; // Length of each segment
  private cumulativeDistances: number[] = []; // Cumulative distance to start of each segment
  private totalLength: number = 0;

  // Direction tracking
  private flightAngle: number = 0; // 0 = +Z, PI/2 = +X, PI = -Z, -PI/2 = -X
  private currentStreetX: number = 0;
  private currentStreetZ: number = 0;

  constructor() {
    this.addInitialPoints();
    this.updateDistances();
  }

  private addInitialPoints(): void {
    this.currentStreetX = 0;
    this.currentStreetZ = 0;
    this.flightAngle = 0;

    const startX = getStreetCenter(this.currentStreetX);

    // Add starting point
    this.controlPoints.push(new THREE.Vector3(startX, FLIGHT_HEIGHT, getStreetCenter(this.currentStreetZ)));

    // Add points ahead
    const numPoints = Math.ceil(EXTEND_AHEAD_DISTANCE / BLOCK_WITH_STREET) + 1;
    for (let i = 0; i < numPoints; i++) {
      this.currentStreetZ++;
      this.controlPoints.push(new THREE.Vector3(startX, FLIGHT_HEIGHT, getStreetCenter(this.currentStreetZ)));
    }
  }

  private updateDistances(): void {
    this.segmentLengths = [];
    this.cumulativeDistances = [0];

    for (let i = 1; i < this.controlPoints.length; i++) {
      const len = this.controlPoints[i].distanceTo(this.controlPoints[i - 1]);
      this.segmentLengths.push(len);
      this.cumulativeDistances.push(this.cumulativeDistances[i - 1] + len);
    }

    this.totalLength = this.cumulativeDistances[this.cumulativeDistances.length - 1] || 0;
  }

  /**
   * Get position at a given distance along the path
   */
  public getPositionAtDistance(distance: number): THREE.Vector3 {
    if (distance <= 0) return this.controlPoints[0].clone();
    if (distance >= this.totalLength) return this.controlPoints[this.controlPoints.length - 1].clone();

    // Find which segment we're in
    let segmentIndex = 0;
    for (let i = 1; i < this.cumulativeDistances.length; i++) {
      if (distance < this.cumulativeDistances[i]) {
        segmentIndex = i - 1;
        break;
      }
    }

    // Interpolate within segment
    const segmentStart = this.cumulativeDistances[segmentIndex];
    const segmentLength = this.segmentLengths[segmentIndex];
    const t = (distance - segmentStart) / segmentLength;

    const p1 = this.controlPoints[segmentIndex];
    const p2 = this.controlPoints[segmentIndex + 1];

    return new THREE.Vector3().lerpVectors(p1, p2, t);
  }

  /**
   * Get direction at a given distance along the path
   */
  public getTangentAtDistance(distance: number): THREE.Vector3 {
    if (this.controlPoints.length < 2) return new THREE.Vector3(0, 0, 1);

    // Find which segment we're in
    let segmentIndex = 0;
    for (let i = 1; i < this.cumulativeDistances.length; i++) {
      if (distance < this.cumulativeDistances[i]) {
        segmentIndex = i - 1;
        break;
      }
      segmentIndex = i - 1;
    }

    segmentIndex = Math.min(segmentIndex, this.controlPoints.length - 2);

    const p1 = this.controlPoints[segmentIndex];
    const p2 = this.controlPoints[segmentIndex + 1];

    return new THREE.Vector3().subVectors(p2, p1).normalize();
  }

  /**
   * Get total path length
   */
  public getTotalDistance(): number {
    return this.totalLength;
  }

  /**
   * Extend path if needed
   */
  public extendIfNeededByDistance(currentDistance: number): void {
    const distanceToEnd = this.totalLength - currentDistance;

    if (distanceToEnd < EXTEND_THRESHOLD) {
      for (let i = 0; i < 5; i++) {
        const newPoint = this.generateNextPoint();
        this.controlPoints.push(newPoint);
      }
      this.updateDistances();
    }
  }

  private generateNextPoint(): THREE.Vector3 {
    // Move based on current flight angle
    const angleNorm = ((this.flightAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    if (angleNorm < Math.PI / 4 || angleNorm >= 7 * Math.PI / 4) {
      this.currentStreetZ += 1; // +Z
    } else if (angleNorm < 3 * Math.PI / 4) {
      this.currentStreetX += 1; // +X
    } else if (angleNorm < 5 * Math.PI / 4) {
      this.currentStreetZ -= 1; // -Z
    } else {
      this.currentStreetX -= 1; // -X
    }

    return new THREE.Vector3(
      getStreetCenter(this.currentStreetX),
      FLIGHT_HEIGHT,
      getStreetCenter(this.currentStreetZ)
    );
  }

  // Legacy methods for bulletAvatar compatibility
  public getPositionAtZ(z: number): THREE.Vector3 {
    // Find closest point by Z
    for (let i = 0; i < this.controlPoints.length - 1; i++) {
      const p1 = this.controlPoints[i];
      const p2 = this.controlPoints[i + 1];
      if (z >= Math.min(p1.z, p2.z) && z <= Math.max(p1.z, p2.z)) {
        if (p1.z === p2.z) return p1.clone();
        const t = (z - p1.z) / (p2.z - p1.z);
        return new THREE.Vector3().lerpVectors(p1, p2, t);
      }
    }
    return this.controlPoints[0].clone();
  }

  public getTangentAtZ(z: number): THREE.Vector3 {
    for (let i = 0; i < this.controlPoints.length - 1; i++) {
      const p1 = this.controlPoints[i];
      const p2 = this.controlPoints[i + 1];
      if (z >= Math.min(p1.z, p2.z) && z <= Math.max(p1.z, p2.z)) {
        return new THREE.Vector3().subVectors(p2, p1).normalize();
      }
    }
    return new THREE.Vector3(0, 0, 1);
  }

  public getCurve(): THREE.CatmullRomCurve3 {
    return new THREE.CatmullRomCurve3(this.controlPoints);
  }

  public getLength(): number {
    return this.totalLength;
  }
}
