import * as THREE from "three";
import { getCameraPath } from "./city.js";

const DURATION = 180;

export function createFlyThroughCamera(camera) {
  const path = getCameraPath();
  const posCurve = new THREE.CatmullRomCurve3(path.positions, true, "catmullrom", 0.5);
  const tgtCurve = new THREE.CatmullRomCurve3(path.targets,   true, "catmullrom", 0.5);

  const _pos = new THREE.Vector3();
  const _tgt = new THREE.Vector3();

  return {
    update(elapsed, daylight) {
      // Linear t — closed CatmullRom curve is already smooth at the seam
      const t = (elapsed % DURATION) / DURATION;

      posCurve.getPoint(t, _pos);
      tgtCurve.getPoint(t, _tgt);

      // Day/night look-at variation: subtle target offset creates different framing
      // Night: camera looks slightly upward at neon signs and beacons
      // Day: camera looks slightly down and outward to see trees, roads, scenery
      const dl = typeof daylight === "number" ? daylight : 0.5;
      const nightShift = 1 - dl;
      const altitude = _pos.y;

      // Smooth altitude blend factors — no hard thresholds
      // streetFactor: 1 at ground, fades to 0 by altitude 60
      const streetFactor = 1 - THREE.MathUtils.smoothstep(altitude, 10, 60);
      // highFactor: 0 below 150, fades to 1 by altitude 250
      const highFactor = THREE.MathUtils.smoothstep(altitude, 150, 250);

      // Street-level offsets (blended)
      _tgt.y += nightShift * 8 * streetFactor;
      _tgt.x += Math.sin(elapsed * 0.3) * nightShift * 6 * streetFactor;
      _tgt.y -= dl * 2 * streetFactor;

      // High-altitude offsets (blended)
      _tgt.x += nightShift * 15 * highFactor;
      _tgt.x += Math.sin(elapsed * 0.08) * dl * 20 * highFactor;
      _tgt.z += Math.cos(elapsed * 0.06) * dl * 15 * highFactor;

      // Altitude-based sway: more at high altitude, minimal at street level
      const swayScale = THREE.MathUtils.clamp(altitude / 400, 0, 1);
      const streetScale = 1 - swayScale;

      // High-altitude: gentle banking sway (bird gliding)
      _pos.x += Math.sin(elapsed * 0.18) * (2.5 * swayScale + 0.2 * streetScale);
      _pos.y += Math.sin(elapsed * 0.12) * (3.0 * swayScale + 0.1 * streetScale);
      _pos.z += Math.cos(elapsed * 0.18) * (2.5 * swayScale + 0.2 * streetScale);

      camera.position.copy(_pos);
      camera.lookAt(_tgt);

      return { position: _pos, lookTarget: _tgt };
    },
  };
}
