import * as THREE from 'three';

/**
 * Simple seeded random number generator (mulberry32)
 */
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Window pattern types
export type WindowPattern = 'grid' | 'staggered' | 'vertical-strips' | 'sparse-random';
export const WINDOW_PATTERNS: WindowPattern[] = ['grid', 'staggered', 'vertical-strips', 'sparse-random'];

// Texture cache to avoid recreating textures - keyed by seed and pattern
const textureCache = new Map<string, THREE.CanvasTexture>();
const emissiveCache = new Map<string, THREE.CanvasTexture>();

// Window grid constants
const TEXTURE_SIZE = 256;
const WINDOWS_PER_ROW = 8;
const WINDOWS_PER_COL = 16;
const WINDOW_WIDTH = TEXTURE_SIZE / WINDOWS_PER_ROW;
const WINDOW_HEIGHT = TEXTURE_SIZE / WINDOWS_PER_COL;
const WINDOW_PADDING = 2;

// Colors
const BUILDING_COLOR = '#1a1a2a';
const WINDOW_FRAME_COLOR = '#2a2a3a';
const LIT_WINDOW_COLORS = ['#ffe4a8', '#ffd080', '#ffcc66', '#e6c078'];
const DARK_WINDOW_COLOR = '#0a0a14';

/**
 * Determines if a window should exist at a given position based on pattern
 */
function shouldHaveWindow(
  row: number,
  col: number,
  pattern: WindowPattern,
  random: () => number
): boolean {
  switch (pattern) {
    case 'grid':
      // Regular grid - every position has a window
      return true;

    case 'staggered':
      // Offset every other row by half a column
      // Skip windows in odd rows at even columns (creates staggered effect)
      if (row % 2 === 1) {
        return col % 2 === 1;
      }
      return col % 2 === 0;

    case 'vertical-strips':
      // Windows only in certain columns (creates vertical strip pattern)
      // Windows in columns 0-1, 4-5 (skip 2-3, 6-7)
      return col % 4 < 2;

    case 'sparse-random':
      // Random sparse distribution - only 40% of positions have windows
      return random() < 0.4;

    default:
      return true;
  }
}

/**
 * Creates a canvas-based window grid texture for a building
 * @param seed - Seed for random window lighting pattern
 * @param litProbability - Probability that a window is lit (0-1)
 * @param pattern - Window pattern type (grid, staggered, vertical-strips, sparse-random)
 * @returns Object with color texture and emissive texture
 */
export function createWindowTextures(
  seed: number,
  litProbability: number = 0.4,
  pattern: WindowPattern = 'grid'
): { colorTexture: THREE.CanvasTexture; emissiveTexture: THREE.CanvasTexture } {
  // Check cache first - key includes both seed and pattern
  const cacheKey = `${seed}_${pattern}`;
  const cachedColor = textureCache.get(cacheKey);
  const cachedEmissive = emissiveCache.get(cacheKey);
  if (cachedColor && cachedEmissive) {
    return { colorTexture: cachedColor, emissiveTexture: cachedEmissive };
  }

  const random = seededRandom(seed);

  // Create canvas for color map
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = TEXTURE_SIZE;
  colorCanvas.height = TEXTURE_SIZE;
  const colorCtx = colorCanvas.getContext('2d')!;

  // Create canvas for emissive map
  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = TEXTURE_SIZE;
  emissiveCanvas.height = TEXTURE_SIZE;
  const emissiveCtx = emissiveCanvas.getContext('2d')!;

  // Fill background (building wall)
  colorCtx.fillStyle = BUILDING_COLOR;
  colorCtx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  // Emissive background is black (no emission)
  emissiveCtx.fillStyle = '#000000';
  emissiveCtx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  // Draw windows based on pattern
  for (let row = 0; row < WINDOWS_PER_COL; row++) {
    for (let col = 0; col < WINDOWS_PER_ROW; col++) {
      // Check if window should exist at this position based on pattern
      if (!shouldHaveWindow(row, col, pattern, random)) {
        continue;
      }

      // Calculate window position (for staggered pattern, offset odd rows)
      let x = col * WINDOW_WIDTH + WINDOW_PADDING;
      const y = row * WINDOW_HEIGHT + WINDOW_PADDING;
      const w = WINDOW_WIDTH - WINDOW_PADDING * 2;
      const h = WINDOW_HEIGHT - WINDOW_PADDING * 2;

      // For staggered pattern, offset the x position of odd rows
      if (pattern === 'staggered' && row % 2 === 1) {
        x += WINDOW_WIDTH / 2;
      }

      const isLit = random() < litProbability;

      // Draw window frame
      colorCtx.fillStyle = WINDOW_FRAME_COLOR;
      colorCtx.fillRect(x - 1, y - 1, w + 2, h + 2);

      if (isLit) {
        // Lit window - warm yellow/orange color
        const litColor = LIT_WINDOW_COLORS[Math.floor(random() * LIT_WINDOW_COLORS.length)];
        colorCtx.fillStyle = litColor;
        colorCtx.fillRect(x, y, w, h);

        // Emissive map - same warm color for glow
        emissiveCtx.fillStyle = litColor;
        emissiveCtx.fillRect(x, y, w, h);
      } else {
        // Dark window
        colorCtx.fillStyle = DARK_WINDOW_COLOR;
        colorCtx.fillRect(x, y, w, h);

        // Add slight reflection variation to dark windows
        if (random() > 0.7) {
          colorCtx.fillStyle = 'rgba(50, 50, 80, 0.3)';
          colorCtx.fillRect(x, y, w * 0.6, h * 0.4);
        }
      }
    }
  }

  // Create Three.js textures from canvases
  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.wrapS = THREE.RepeatWrapping;
  colorTexture.wrapT = THREE.RepeatWrapping;
  colorTexture.magFilter = THREE.LinearFilter;
  colorTexture.minFilter = THREE.LinearMipmapLinearFilter;

  const emissiveTexture = new THREE.CanvasTexture(emissiveCanvas);
  emissiveTexture.wrapS = THREE.RepeatWrapping;
  emissiveTexture.wrapT = THREE.RepeatWrapping;
  emissiveTexture.magFilter = THREE.LinearFilter;
  emissiveTexture.minFilter = THREE.LinearMipmapLinearFilter;

  // Cache the textures
  textureCache.set(cacheKey, colorTexture);
  emissiveCache.set(cacheKey, emissiveTexture);

  return { colorTexture, emissiveTexture };
}

/**
 * Selects a window pattern based on seed, ensuring adjacent buildings get different patterns
 * Uses the seed to pick from available patterns in a way that neighboring seeds differ
 */
export function selectWindowPattern(seed: number, neighborSeeds: number[] = []): WindowPattern {
  // Get patterns used by neighbors
  const neighborPatterns = new Set(
    neighborSeeds.map((s) => WINDOW_PATTERNS[s % WINDOW_PATTERNS.length])
  );

  // Try to pick a pattern that's different from neighbors
  const preferredPattern = WINDOW_PATTERNS[seed % WINDOW_PATTERNS.length];

  if (!neighborPatterns.has(preferredPattern)) {
    return preferredPattern;
  }

  // If preferred pattern is used by neighbor, find an alternative
  for (let i = 1; i < WINDOW_PATTERNS.length; i++) {
    const altPattern = WINDOW_PATTERNS[(seed + i) % WINDOW_PATTERNS.length];
    if (!neighborPatterns.has(altPattern)) {
      return altPattern;
    }
  }

  // Fallback to preferred pattern if all patterns are used by neighbors
  return preferredPattern;
}

/**
 * Calculates UV repeat values based on building dimensions
 * to maintain consistent window sizes across different building sizes
 */
export function calculateUVRepeat(
  width: number,
  height: number,
  depth: number
): { frontBack: THREE.Vector2; leftRight: THREE.Vector2 } {
  // Target approximately 4 windows per 10 units of width, 8 windows per 50 units of height
  const windowsPerUnitX = 0.4;
  const windowsPerUnitY = 0.16;

  return {
    frontBack: new THREE.Vector2(
      width * windowsPerUnitX,
      height * windowsPerUnitY
    ),
    leftRight: new THREE.Vector2(
      depth * windowsPerUnitX,
      height * windowsPerUnitY
    ),
  };
}

/**
 * Clears the texture cache (useful for memory management)
 */
export function clearTextureCache(): void {
  for (const texture of textureCache.values()) {
    texture.dispose();
  }
  for (const texture of emissiveCache.values()) {
    texture.dispose();
  }
  textureCache.clear();
  emissiveCache.clear();
}
