import * as THREE from "three";
import { getCameraPath } from "./city.js";

const DURATION = 300; // 5 minutes

export function createFlyThroughCamera(camera) {
  const path = getCameraPath();
  const posCurve = new THREE.CatmullRomCurve3(path.positions, true, "catmullrom", 0.3);
  const tgtCurve = new THREE.CatmullRomCurve3(path.targets, true, "catmullrom", 0.3);

  const _pos = new THREE.Vector3();
  const _tgt = new THREE.Vector3();

  return {
    update(elapsedTime) {
      const t = (elapsedTime % DURATION) / DURATION;

      posCurve.getPoint(t, _pos);
      tgtCurve.getPoint(t, _tgt);

      // Subtle handheld micro-oscillation
      _pos.x += Math.sin(elapsedTime * 0.27) * 0.3;
      _pos.y += Math.sin(elapsedTime * 0.19) * 0.15;
      _pos.z += Math.cos(elapsedTime * 0.27) * 0.3;

      camera.position.copy(_pos);
      camera.lookAt(_tgt);


      return { position: camera.position.clone(), lookTarget: _tgt.clone() };
    },
  };
}
