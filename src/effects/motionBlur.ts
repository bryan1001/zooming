import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Radial motion blur shader - creates speed lines effect emanating from center
const RadialBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.0 },
    centerX: { value: 0.5 },
    centerY: { value: 0.5 },
    samples: { value: 16 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float centerX;
    uniform float centerY;
    uniform int samples;

    varying vec2 vUv;

    void main() {
      vec2 center = vec2(centerX, centerY);
      vec2 dir = vUv - center;
      float dist = length(dir);

      // No blur at center, increasing blur toward edges
      float blurAmount = strength * dist;

      vec4 color = vec4(0.0);
      float totalWeight = 0.0;

      // Sample along radial direction
      for (int i = 0; i < 16; i++) {
        if (i >= samples) break;
        float t = float(i) / float(samples - 1) - 0.5;
        vec2 offset = dir * t * blurAmount;
        float weight = 1.0 - abs(t * 2.0); // Higher weight near center
        color += texture2D(tDiffuse, vUv + offset) * weight;
        totalWeight += weight;
      }

      gl_FragColor = color / totalWeight;
    }
  `
};

// Motion blur manager
let composer: EffectComposer | null = null;
let radialBlurPass: ShaderPass | null = null;

// Configuration
const MIN_BLUR_SPEED = 50; // No blur below this speed
const MAX_BLUR_SPEED = 150; // Maximum blur at this speed
const MAX_BLUR_STRENGTH = 0.15; // Maximum blur strength (keep subtle)

/**
 * Initialize motion blur post-processing
 * @param renderer The WebGL renderer
 * @param scene The Three.js scene
 * @param camera The camera
 */
export function initMotionBlur(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): EffectComposer {
  // Create effect composer
  composer = new EffectComposer(renderer);

  // Add render pass (renders the scene)
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Add radial blur pass (motion blur effect)
  radialBlurPass = new ShaderPass(RadialBlurShader);
  radialBlurPass.uniforms.strength.value = 0;
  composer.addPass(radialBlurPass);

  return composer;
}

/**
 * Update motion blur intensity based on current speed
 * @param currentSpeed Current camera speed in units per second
 */
export function updateMotionBlur(currentSpeed: number): void {
  if (!radialBlurPass) return;

  // Calculate blur strength based on speed
  // No blur at base speed, increasing blur as speed increases
  const speedFactor = Math.max(0, (currentSpeed - MIN_BLUR_SPEED) / (MAX_BLUR_SPEED - MIN_BLUR_SPEED));
  const blurStrength = Math.min(speedFactor, 1) * MAX_BLUR_STRENGTH;

  radialBlurPass.uniforms.strength.value = blurStrength;
}

/**
 * Render the scene with motion blur
 */
export function renderWithMotionBlur(): void {
  if (composer) {
    composer.render();
  }
}

/**
 * Handle window resize
 * @param width New width
 * @param height New height
 */
export function resizeMotionBlur(width: number, height: number): void {
  if (composer) {
    composer.setSize(width, height);
  }
}

/**
 * Get the effect composer (for custom modifications)
 */
export function getComposer(): EffectComposer | null {
  return composer;
}
