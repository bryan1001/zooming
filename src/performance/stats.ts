import Stats from 'stats.js';

let stats: Stats | null = null;

/**
 * Initializes the stats.js FPS monitor
 * Displays FPS, MS per frame, and MB memory usage panels
 */
export function initStats(): void {
  stats = new Stats();

  // 0: fps, 1: ms, 2: mb (memory)
  stats.showPanel(0); // Show FPS by default

  // Position in top-left corner
  stats.dom.style.position = 'absolute';
  stats.dom.style.left = '0px';
  stats.dom.style.top = '0px';
  stats.dom.style.zIndex = '1000';

  document.body.appendChild(stats.dom);
}

/**
 * Call at the beginning of each frame to track frame timing
 */
export function statsBegin(): void {
  stats?.begin();
}

/**
 * Call at the end of each frame to complete frame timing
 */
export function statsEnd(): void {
  stats?.end();
}

/**
 * Toggles which panel is shown (FPS / MS / MB)
 */
export function toggleStatsPanel(): void {
  if (stats) {
    const currentPanel = parseInt(stats.dom.children[0].id?.slice(-1) || '0');
    stats.showPanel((currentPanel + 1) % 3);
  }
}

/**
 * Removes the stats display
 */
export function disposeStats(): void {
  if (stats) {
    document.body.removeChild(stats.dom);
    stats = null;
  }
}
