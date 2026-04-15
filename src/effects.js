import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import * as THREE from "three";

// #19: Chromatic aberration + film grain shader
const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uChromaOffset: { value: 0.0015 },
    uGrainIntensity: { value: 0.04 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uChromaOffset;
    uniform float uGrainIntensity;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;
      float dist = length(dir);

      // Chromatic aberration — stronger at edges
      float aberration = uChromaOffset * dist * dist;
      float r = texture2D(tDiffuse, uv + dir * aberration).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir * aberration).b;

      vec3 color = vec3(r, g, b);

      // Film grain
      float grain = rand(uv * uTime * 0.01) * uGrainIntensity;
      color += grain - uGrainIntensity * 0.5;

      // Subtle vignette
      float vignette = 1.0 - dist * 0.6;
      color *= vignette;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createPostProcessing(renderer, scene, camera, size) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.width, size.height),
    0.7, 0.55, 0.72
  );
  composer.addPass(bloomPass);

  const cinematicPass = new ShaderPass(CinematicShader);
  composer.addPass(cinematicPass);

  return {
    composer,
    setBloom(strength, radius, threshold) {
      bloomPass.strength = strength;
      bloomPass.radius = radius;
      bloomPass.threshold = threshold;
    },
    updateTime(time) {
      cinematicPass.uniforms.uTime.value = time;
    },
    resize(width, height) {
      composer.setSize(width, height);
      bloomPass.setSize(width, height);
    }
  };
}
