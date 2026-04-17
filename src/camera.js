import * as THREE from "three";
import { getCameraPath } from "./city.js";

const DURATION = 300;

export function createFlyThroughCamera(camera) {
  const path = getCameraPath();
  const posCurve = new THREE.CatmullRomCurve3(path.positions, true, "catmullrom", 0.5);
  const tgtCurve = new THREE.CatmullRomCurve3(path.targets,   true, "catmullrom", 0.5);

  const _pos = new THREE.Vector3();
  const _tgt = new THREE.Vector3();

  // Smooth easing — slow start and end within each segment feel natural
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  return {
    update(elapsed) {
      const raw = (elapsed % DURATION) / DURATION;
      // Apply easing per-segment for intentional pacing
      const t = easeInOut(raw);

      posCurve.getPoint(t, _pos);
      tgtCurve.getPoint(t, _tgt);

      // Altitude-based sway: more at high altitude, minimal at street level
      const altitude = _pos.y;
      const swayScale = THREE.MathUtils.clamp(altitude / 400, 0, 1);
      const streetScale = 1 - swayScale;

      // High-altitude: gentle banking sway (bird gliding)
      _pos.x += Math.sin(elapsed * 0.18) * (2.5 * swayScale + 0.2 * streetScale);
      _pos.y += Math.sin(elapsed * 0.12) * (3.0 * swayScale + 0.1 * streetScale);
      _pos.z += Math.cos(elapsed * 0.18) * (2.5 * swayScale + 0.2 * streetScale);

      camera.position.copy(_pos);
      camera.lookAt(_tgt);

      return { position: camera.position.clone(), lookTarget: _tgt.clone() };
    },
  };
}
