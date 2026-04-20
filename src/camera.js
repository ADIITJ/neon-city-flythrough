import * as THREE from "three";
import { getCameraPath } from "./city.js";

const DURATION = 300;

export function createFlyThroughCamera(camera) {
  const path = getCameraPath();
  const posCurve = new THREE.CatmullRomCurve3(path.positions, true, "catmullrom", 0.5);
  const tgtCurve = new THREE.CatmullRomCurve3(path.targets,   true, "catmullrom", 0.5);

  const _pos = new THREE.Vector3();
  const _tgt = new THREE.Vector3();

  // Mild smoothstep — fast enough start, still smooth transitions
  // Avoids the very slow quadratic start of 2*t*t
  function smoothEase(t) {
    return t * t * (3 - 2 * t);
  }

  return {
    update(elapsed, daylight) {
      const raw = (elapsed % DURATION) / DURATION;
      const t = smoothEase(raw);

      posCurve.getPoint(t, _pos);
      tgtCurve.getPoint(t, _tgt);

      // Day/night look-at variation: subtle target offset creates different framing
      // Night: camera looks slightly upward at neon signs and beacons
      // Day: camera looks slightly down and outward to see trees, roads, scenery
      const dl = typeof daylight === "number" ? daylight : 0.5;
      const nightShift = 1 - dl;
      const altitude = _pos.y;
      const isStreetLevel = altitude < 30;

      if (isStreetLevel) {
        // Night at street level: look up at neon, slight tilt to passing signs
        _tgt.y += nightShift * 8;
        _tgt.x += Math.sin(elapsed * 0.3) * nightShift * 6;
        // Day at street level: look more at ground-level details (trees, cars, sidewalks)
        _tgt.y -= dl * 2;
      } else if (altitude > 200) {
        // High altitude night: look toward brightest neon cluster (entertainment east)
        _tgt.x += nightShift * 15;
        // High altitude day: wider panoramic sweep
        _tgt.x += Math.sin(elapsed * 0.08) * dl * 20;
        _tgt.z += Math.cos(elapsed * 0.06) * dl * 15;
      }

      // Altitude-based sway: more at high altitude, minimal at street level
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
