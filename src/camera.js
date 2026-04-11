import * as THREE from "three";

const DURATION = 300; // 5 minutes

// Simplified camera path — street level → rising → skyline → overhead → descent
// City grid: spacing=52, gridSize=20, extent ~1240. Roads at multiples of 52.
// Street level y=6-10, mid-rise y=40-120, skyline y=200-300.
const PATH_POSITIONS = [
  new THREE.Vector3(   0,   7,  480),   //   0s — start on main avenue, looking ahead
  new THREE.Vector3(   0,   7,  100),   //  30s — rolling down the avenue
  new THREE.Vector3(   0,   8,  -80),   //  60s — passing city center
  new THREE.Vector3(  52,   7, -260),   //  90s — turned onto cross street
  new THREE.Vector3( 200,  50, -260),   // 120s — pulling out, rising
  new THREE.Vector3( 380, 140,    0),   // 150s — wide skyline view
  new THREE.Vector3( 200, 240,  200),   // 180s — high arc
  new THREE.Vector3(   0, 300,    0),   // 210s — zenith overhead
  new THREE.Vector3(-250, 180, -150),   // 240s — descending from other side
  new THREE.Vector3( -52,  10,  300),   // 270s — back at street level, new street
];

const PATH_TARGETS = [
  new THREE.Vector3(   0,   6, -100),   // looking straight down avenue
  new THREE.Vector3(   0,   6, -200),   // still looking ahead
  new THREE.Vector3(  30,   8, -250),   // slight turn toward buildings
  new THREE.Vector3( 150,  20, -100),   // turning to look at skyline
  new THREE.Vector3(   0,  40,    0),   // city center
  new THREE.Vector3(   0,  50,    0),   // full skyline
  new THREE.Vector3(   0,  40,    0),   // looking down at city
  new THREE.Vector3(  50,  20,  100),   // looking down
  new THREE.Vector3(   0,  20,   50),   // approaching from far
  new THREE.Vector3(   0,   6, -100),   // back to street view
];

export function createFlyThroughCamera(camera) {
  const posCurve = new THREE.CatmullRomCurve3(PATH_POSITIONS, true, "catmullrom", 0.5);
  const tgtCurve = new THREE.CatmullRomCurve3(PATH_TARGETS, true, "catmullrom", 0.5);

  const _pos = new THREE.Vector3();
  const _tgt = new THREE.Vector3();

  return {
    update(elapsedTime) {
      const t = (elapsedTime % DURATION) / DURATION;

      posCurve.getPoint(t, _pos);
      tgtCurve.getPoint(t, _tgt);

      // Subtle handheld micro-oscillation
      _pos.x += Math.sin(elapsedTime * 0.27) * 0.5;
      _pos.y += Math.sin(elapsedTime * 0.19) * 0.3;
      _pos.z += Math.cos(elapsedTime * 0.27) * 0.5;

      camera.position.copy(_pos);
      camera.lookAt(_tgt);

      // Very gentle roll
      camera.rotation.z = Math.sin(elapsedTime * 0.038) * 0.003;

      return { position: camera.position.clone(), lookTarget: _tgt.clone() };
    }
  };
}
