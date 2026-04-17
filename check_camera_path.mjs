/**
 * Camera path collision checker.
 * Samples the CatmullRom curve at high resolution, tests each sample
 * against every building AABB (x ± w/2, z ± d/2, 0 to h).
 */

const BUILDINGS = [
  { x:  28, z: -28, w: 22, d: 22, h: 220, id: "FC-NE-glass" },
  { x: -28, z: -28, w: 20, d: 20, h: 180, id: "FC-NW-glass" },
  { x:  28, z:  28, w: 20, d: 22, h: 160, id: "FC-SE-glass" },
  { x: -28, z:  28, w: 22, d: 20, h: 140, id: "FC-SW-glass" },
  { x:  50, z:   0, w: 16, d: 36, h: 200, id: "FC-E-spire" },
  { x: -50, z:   0, w: 16, d: 36, h: 195, id: "FC-W-spire" },
  { x:   0, z: -48, w: 36, d: 14, h: 170, id: "FC-N-slab" },
  { x:   0, z:  48, w: 36, d: 14, h: 150, id: "FC-S-neon" },
  { x:  42, z: -48, w: 18, d: 16, h: 130, id: "FC-NE2" },
  { x: -42, z: -48, w: 18, d: 16, h: 125, id: "FC-NW2" },
  { x:  42, z:  48, w: 18, d: 16, h: 120, id: "FC-SE2" },
  { x: -42, z:  48, w: 18, d: 16, h: 115, id: "FC-SW2" },
  { x: 110, z: -25, w: 28, d: 22, h: 110, id: "ENT-NW" },
  { x: 148, z: -25, w: 24, d: 22, h: 95,  id: "ENT-N" },
  { x: 110, z:  25, w: 28, d: 22, h: 105, id: "ENT-SW" },
  { x: 148, z:  25, w: 24, d: 22, h: 90,  id: "ENT-S" },
  { x: 175, z:   0, w: 18, d: 48, h: 80,  id: "ENT-tower" },
  { x: 110, z: -82, w: 26, d: 28, h: 75,  id: "ENT-NW2" },
  { x: 148, z: -82, w: 22, d: 28, h: 85,  id: "ENT-N2" },
  { x: 110, z:  82, w: 26, d: 28, h: 70,  id: "ENT-SW2" },
  { x: 148, z:  82, w: 22, d: 28, h: 80,  id: "ENT-S2" },
  { x: 220, z: -30, w: 22, d: 20, h: 60,  id: "ENT-FarN" },
  { x: 220, z:  30, w: 22, d: 20, h: 65,  id: "ENT-FarS" },
  { x: 175, z: -82, w: 20, d: 26, h: 55,  id: "ENT-MidN" },
  { x: 175, z:  82, w: 20, d: 26, h: 58,  id: "ENT-MidS" },
  { x: 110, z:-155, w: 24, d: 30, h: 65,  id: "ENT-FarNW" },
  { x: 148, z:-155, w: 20, d: 30, h: 60,  id: "ENT-FarN2" },
  { x: 110, z: 155, w: 24, d: 30, h: 62,  id: "ENT-FarSW" },
  { x: 148, z: 155, w: 20, d: 30, h: 58,  id: "ENT-FarS2" },
  { x:-108, z: -25, w: 26, d: 22, h: 55,  id: "RES-NE" },
  { x:-144, z: -25, w: 22, d: 22, h: 50,  id: "RES-N" },
  { x:-108, z:  25, w: 26, d: 22, h: 60,  id: "RES-SE" },
  { x:-144, z:  25, w: 22, d: 22, h: 52,  id: "RES-S" },
  { x:-108, z: -82, w: 24, d: 28, h: 48,  id: "RES-NW" },
  { x:-144, z: -82, w: 20, d: 28, h: 45,  id: "RES-NW2" },
  { x:-108, z:  82, w: 24, d: 28, h: 52,  id: "RES-SW" },
  { x:-144, z:  82, w: 20, d: 28, h: 48,  id: "RES-SW2" },
  { x:-172, z:   0, w: 16, d: 46, h: 58,  id: "RES-W-tower" },
  { x:-218, z: -28, w: 20, d: 20, h: 42,  id: "RES-FarN" },
  { x:-218, z:  28, w: 20, d: 20, h: 44,  id: "RES-FarS" },
  { x:-172, z: -82, w: 18, d: 26, h: 46,  id: "RES-FarNW" },
  { x:-172, z:  82, w: 18, d: 26, h: 44,  id: "RES-FarSW" },
  { x:-108, z:-155, w: 22, d: 28, h: 50,  id: "RES-FarNE" },
  { x:-144, z:-155, w: 18, d: 28, h: 46,  id: "RES-FarN2" },
  { x:-108, z: 155, w: 22, d: 28, h: 48,  id: "RES-FarSE" },
  { x:-144, z: 155, w: 18, d: 28, h: 50,  id: "RES-FarS2" },
  { x:  30, z:-100, w: 44, d: 20, h: 35,  id: "IND-E" },
  { x: -30, z:-100, w: 44, d: 20, h: 32,  id: "IND-W" },
  { x:  30, z:-168, w: 42, d: 22, h: 38,  id: "IND-E2" },
  { x: -30, z:-168, w: 42, d: 22, h: 36,  id: "IND-W2" },
  { x:  30, z:-240, w: 40, d: 24, h: 30,  id: "IND-E3" },
  { x: -30, z:-240, w: 40, d: 24, h: 28,  id: "IND-W3" },
  { x:  30, z: 100, w: 40, d: 20, h: 25,  id: "CIV-E" },
  { x: -30, z: 100, w: 40, d: 20, h: 28,  id: "CIV-W" },
  { x:  30, z: 168, w: 38, d: 22, h: 22,  id: "CIV-E2" },
  { x: -30, z: 168, w: 38, d: 22, h: 20,  id: "CIV-W2" },
  { x:  30, z: 240, w: 36, d: 24, h: 26,  id: "CIV-E3" },
  { x: -30, z: 240, w: 36, d: 24, h: 24,  id: "CIV-W3" },
];

const PTS = [
  // Phase 1 — sky descent
  [   0, 420,  300,   0, 200,    0],   //  0
  [  70, 340,  200,  30, 180,   60],   //  1
  [ 110, 260,   80,  70, 140,    0],   //  2
  [  70, 200,   60,  40, 145,   30],   //  3
  [  70, 150,   55,  40, 110,   25],   //  4
  [  70, 210,   55,  40, 170,   25],   //  5
  // Phase 2 — rooftop sweep
  [  70, 265,   50,  40, 215,   10],   //  6
  [  62, 265,   22,  30, 215,  -40],   //  7
  [  20, 265,  -65,   0, 215, -120],   //  8
  [ -40, 255, -115, -60, 200, -145],   //  9
  [  25, 250, -165,  45, 195, -125],   // 10
  [  70, 238,  -80,  40, 180,  -35],   // 11
  [  67, 238,   22,  15, 200,    5],   // 12
  [  65, 210,   22,  15, 155,    5],   // 13
  [  64, 120,   22,  15,  80,    5],   // 13
  [  64,  40,   22,  15,  15,    5],   // 14
  [  64,  14,   22,  64,   8,   13],   // 15
  [  64,  10,   22,  64,   7,   13],   // 16
  [  64,   9,   22,  64,   6,   13],   // 17
  [  64,   9,   13,  83,   6,   13],   // 18
  // East Avenue south entry
  [  83,   9,   13,  83,   6,    0],   // 17
  [  83,   9,    0,  83,   6,  -22],   // 18
  [  83,   9,  -22,  83,   6,  -63],   // 19
  [  83,   9,  -63,  83,   6,  -88],   // 20
  [  83,   9,  -88,  83,   6, -112],   // 21
  [  83,   9, -112,  83,   6, -130],   // 22
  [  83,   9, -130,  83,   6, -155],   // 23
  // North Street
  [  83,   9,  -63,  83,   6,  -63],   // 24
  [  24,   9,  -63, -40,   6,  -63],   // 25
  [ -40,   9,  -63, -83,   6,  -63],   // 26
  // West Avenue
  [ -83,   9,  -63, -83,   6,    0],   // 27
  [ -83,   9,    0, -83,   6,   63],   // 28
  [ -83,   9,   63, -83,   6,  130],   // 29
  // South Street
  [ -20,   9,   63,  64,   6,   63],   // 30
  [  64,   9,   63,  64,   6,   22],   // 31
  [  64,   9,   22,  64,   6,   13],   // 32
  [  64,   9,   13,  64,   6,   13],   // 33
  [  64,  60,   10,   0, 120,    0],   // 34
  [  64, 230,    0,   0, 200,    0],   // 35
  [   0, 230,    0,   0, 100,    0],   // 36
  [   0,  80,    0,   0,  20,    0],   // 37
  [   0,  30,    0,   0,  10,    0],   // 38
  // Fountain plaza (y=16)
  [   0,  16,   13,   0,  10,    0],   // 39
  [ -12,  16,    6,   0,  10,    0],   // 40
  [ -12,  16,   -6,   0,  10,    0],   // 41
  [   0,  16,  -13,   0,  10,    0],   // 42
  [  12,  16,   -6,   0,  10,    0],   // 43
  [  12,  16,    6,   0,  10,    0],   // 44
  // Rise to sky
  [   0,  25,    0,   0,  20,  -80],   // 45
  [   0, 210,  -20,   0, 180, -140],   // 46
  [  62, 260, -130,   0, 210, -160],   // 47
  [  20, 265,  -60,   0, 210,    0],   // 48
];

function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [0, 1, 2].map(i =>
    0.5 * (
      (2 * p1[i]) +
      (-p0[i] + p2[i]) * t +
      (2*p0[i] - 5*p1[i] + 4*p2[i] - p3[i]) * t2 +
      (-p0[i] + 3*p1[i] - 3*p2[i] + p3[i]) * t3
    )
  );
}

function sampleCurve(pts, numSamples) {
  const n = pts.length;
  const out = [];
  for (let s = 0; s < numSamples; s++) {
    const tGlobal = s / numSamples;
    const raw = tGlobal * n;
    const seg = Math.floor(raw);
    const t   = raw - seg;
    const i1  = seg % n;
    const i0  = (i1 - 1 + n) % n;
    const i2  = (i1 + 1) % n;
    const i3  = (i1 + 2) % n;
    out.push({ pt: catmullRomPoint(pts[i0], pts[i1], pts[i2], pts[i3], t), tNorm: tGlobal });
  }
  return out;
}

const CAMERA_RADIUS = 2.5;

function intersectsBuilding(px, py, pz, b) {
  return (
    px >= b.x - b.w/2 - CAMERA_RADIUS && px <= b.x + b.w/2 + CAMERA_RADIUS &&
    pz >= b.z - b.d/2 - CAMERA_RADIUS && pz <= b.z + b.d/2 + CAMERA_RADIUS &&
    py >= 0 && py <= b.h
  );
}

// True 2D Chebyshev signed clearance from point to building AABB.
// Returns the distance to the nearest face (positive=outside, negative=inside).
// Only counts as "close" if the point is within the building's XZ projection slab on BOTH axes
// (i.e., a point far away in Z won't be reported even if it's x-close to the building).
function xzClearance(px, pz, b) {
  const dx = Math.abs(px - b.x) - b.w / 2;
  const dz = Math.abs(pz - b.z) - b.d / 2;
  if (dx < 0 && dz < 0) return Math.max(dx, dz);  // inside — return least penetration
  if (dx < 0) return dz;   // outside in z only
  if (dz < 0) return dx;   // outside in x only
  return Math.min(dx, dz); // outside on both — nearest face
}

// Whether a building is "relevant" to a waypoint — within 30 units on BOTH axes independently
function buildingIsNearby(px, pz, b) {
  const dx = Math.abs(px - b.x) - b.w / 2;
  const dz = Math.abs(pz - b.z) - b.d / 2;
  return dx < 30 && dz < 30;
}

const GROUND_Y = 2.0; // camera must stay above this (ground is y=0, camera radius 2.5)
const positions = PTS.map(p => [p[0], p[1], p[2]]);
const SAMPLES = 5000;
const sampled = sampleCurve(positions, SAMPLES);

// Collect unique collision spans (deduplicated by building + entry)
const seen = new Set();
const collisions = [];

for (const { pt: [px, py, pz], tNorm } of sampled) {
  for (const b of BUILDINGS) {
    if (intersectsBuilding(px, py, pz, b)) {
      const key = `${b.id}@${(tNorm * 100).toFixed(0)}`;
      const baseKey = b.id;
      if (!seen.has(baseKey)) {
        seen.add(baseKey);
        collisions.push({ tNorm, px, py, pz, b });
      }
    }
  }
  // Reset seen for buildings we've left
  for (const b of BUILDINGS) {
    if (seen.has(b.id) && !intersectsBuilding(px, py, pz, b)) {
      seen.delete(b.id);
    }
  }
}

// ── Waypoint clearance report ────────────────────────────────────────────────
console.log("── Waypoint-level collision report ─────────────────────────────────────────");
PTS.forEach((p, i) => {
  const [px, py, pz] = p;
  let worstGap = Infinity;
  let worstB = null;
  for (const b of BUILDINGS) {
    if (py > b.h + 0.1) continue; // strictly above building
    if (!buildingIsNearby(px, pz, b)) continue; // skip far buildings
    const gap = xzClearance(px, pz, b);
    if (gap < worstGap) { worstGap = gap; worstB = b; }
  }
  const inside = worstGap < 0;
  const tight  = worstGap >= 0 && worstGap < 8;
  if (inside || tight) {
    const tag = inside ? "❌ INSIDE" : "⚠️  TIGHT ";
    const bx1 = (worstB.x - worstB.w/2).toFixed(0), bx2 = (worstB.x + worstB.w/2).toFixed(0);
    const bz1 = (worstB.z - worstB.d/2).toFixed(0), bz2 = (worstB.z + worstB.d/2).toFixed(0);
    console.log(`  WP${String(i).padStart(2,'0')} (${px},${py},${pz})  ${tag}  gap=${worstGap.toFixed(1)}  bldg=${worstB.id}  footprint x=[${bx1},${bx2}] z=[${bz1},${bz2}] h=${worstB.h}`);
  }
});

// ── Underground check ────────────────────────────────────────────────────────
const underground = [];
for (const { pt: [px, py, pz], tNorm } of sampled) {
  if (py < GROUND_Y) underground.push({ tNorm, px, py, pz });
}

// ── Curve sample collisions ──────────────────────────────────────────────────
console.log(`\n── Curve sample collisions (${SAMPLES} samples, radius=${CAMERA_RADIUS}) ─────────────────`);
if (collisions.length === 0) {
  console.log("  ✅ No building collisions");
} else {
  for (const { tNorm, px, py, pz, b } of collisions) {
    console.log(`  t=${tNorm.toFixed(4)}  cam=(${px.toFixed(1)},${py.toFixed(1)},${pz.toFixed(1)})  ❌ ${b.id}  x=[${(b.x-b.w/2).toFixed(0)},${(b.x+b.w/2).toFixed(0)}] z=[${(b.z-b.d/2).toFixed(0)},${(b.z+b.d/2).toFixed(0)}] h=${b.h}`);
  }
}

console.log(`\n── Underground check (y < ${GROUND_Y}) ────────────────────────────────────────`);
if (underground.length === 0) {
  console.log("  ✅ No underground samples");
} else {
  // Deduplicate by grouping into spans
  let prevT = -1;
  for (const { tNorm, px, py, pz } of underground) {
    if (tNorm - prevT > 0.005) console.log(`  t=${tNorm.toFixed(4)}  cam=(${px.toFixed(1)},${py.toFixed(1)},${pz.toFixed(1)})  ⛔ underground`);
    prevT = tNorm;
  }
}
