import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import * as THREE from "three";

export function createPostProcessing(renderer, scene, camera, size) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.width, size.height),
    0.7,
    0.55,
    0.72
  );
  composer.addPass(bloomPass);

  return {
    composer,
    setBloom(strength, radius, threshold) {
      bloomPass.strength = strength;
      bloomPass.radius = radius;
      bloomPass.threshold = threshold;
    },
    resize(width, height) {
      composer.setSize(width, height);
      bloomPass.setSize(width, height);
    }
  };
}
