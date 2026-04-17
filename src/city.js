import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { sampleNeon, hash2D } from "./utils.js";

// ─────────────────────────────────────────────────────────────────────────────
// ASSETS
// ─────────────────────────────────────────────────────────────────────────────
const A = {
  asphalt:    { col: "assets/Asphalt012_1K-JPG/Asphalt012_1K-JPG_Color.jpg",    nrm: "assets/Asphalt012_1K-JPG/Asphalt012_1K-JPG_NormalGL.jpg",    rgh: "assets/Asphalt012_1K-JPG/Asphalt012_1K-JPG_Roughness.jpg" },
  asphaltDmg: { col: "assets/AsphaltDamageSet001_1K-JPG/AsphaltDamageSet001_1K-JPG_Color.jpg", nrm: "assets/AsphaltDamageSet001_1K-JPG/AsphaltDamageSet001_1K-JPG_NormalGL.jpg", rgh: "assets/AsphaltDamageSet001_1K-JPG/AsphaltDamageSet001_1K-JPG_Roughness.jpg" },
  rl004:      { col: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_Color.jpg", nrm: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_NormalGL.jpg", rgh: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_Roughness.jpg", opa: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_Opacity.jpg" },
  paving:     { col: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_Color.jpg", nrm: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_NormalGL.jpg", rgh: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_Roughness.jpg", ao: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_AmbientOcclusion.jpg" },
  concrete:   { col: "assets/Concrete034_1K-JPG/Concrete034_1K-JPG_Color.jpg",  nrm: "assets/Concrete034_1K-JPG/Concrete034_1K-JPG_NormalGL.jpg",  rgh: "assets/Concrete034_1K-JPG/Concrete034_1K-JPG_Roughness.jpg" },
  fGlass:     { col: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Color.jpg",    nrm: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_NormalGL.jpg",    rgh: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Roughness.jpg",    mtl: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Metalness.jpg",    emi: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Emission.jpg",     ao:  "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_AmbientOcclusion.jpg" },
  fRes:       { col: "assets/Facade001_1K-JPG/Facade001_1K-JPG_Color.jpg",      nrm: "assets/Facade001_1K-JPG/Facade001_1K-JPG_NormalGL.jpg",      rgh: "assets/Facade001_1K-JPG/Facade001_1K-JPG_Roughness.jpg",      mtl: "assets/Facade001_1K-JPG/Facade001_1K-JPG_Metalness.jpg" },
  fNeon:      { col: "assets/Facade009_1K-JPG/Facade009_1K-JPG_Color.jpg",      nrm: "assets/Facade009_1K-JPG/Facade009_1K-JPG_NormalGL.jpg",      rgh: "assets/Facade009_1K-JPG/Facade009_1K-JPG_Roughness.jpg",      mtl: "assets/Facade009_1K-JPG/Facade009_1K-JPG_Metalness.jpg",      emi: "assets/Facade009_1K-JPG/Facade009_1K-JPG_Emission.jpg" },
  metal:      { col: "assets/Metal032_1K-JPG/Metal032_1K-JPG_Color.jpg",        nrm: "assets/Metal032_1K-JPG/Metal032_1K-JPG_NormalGL.jpg",        rgh: "assets/Metal032_1K-JPG/Metal032_1K-JPG_Roughness.jpg",        mtl: "assets/Metal032_1K-JPG/Metal032_1K-JPG_Metalness.jpg" },
  car: "assets/Car.glb",
  lamp: "assets/sci-fi_street_lamp.glb",
};

const TL = new THREE.TextureLoader();
function tex(path, rx = 1, ry = 1) {
  const t = TL.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry); t.anisotropy = 8; return t;
}
function pbr(s, rx, ry) {
  const o = { map: tex(s.col, rx, ry), normalMap: tex(s.nrm, rx, ry), roughnessMap: tex(s.rgh, rx, ry) };
  if (s.ao)  o.aoMap        = tex(s.ao,  rx, ry);
  if (s.mtl) o.metalnessMap = tex(s.mtl, rx, ry);
  if (s.emi) o.emissiveMap  = tex(s.emi, rx, ry);
  if (s.opa) o.alphaMap     = tex(s.opa, rx, ry);
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS TEXTURES
// ─────────────────────────────────────────────────────────────────────────────
function makeWindowTex(cols, rows) {
  const W = 256, H = 512, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#06080f"; c.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  const warm = ["#ffd88a","#ffe9b0","#ffcea0","#fff4c0","#ffe0b8"];
  const cool = ["#a8e0ff","#90d8ff","#d0a8ff","#ff98e8","#80f8f0","#b0eeff"];
  for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
    const h1 = Math.abs(Math.sin(col * 127.1 + r * 311.7) * 43758.5) % 1;
    const h2 = Math.abs(Math.sin(col * 43.3  + r * 97.1)  * 43758.5) % 1;
    const h3 = Math.abs(Math.sin(col * 17.8  + r * 63.1)  * 43758.5) % 1;
    if (h1 < 0.28) continue;
    c.fillStyle = (h2 > 0.42 ? cool : warm)[Math.floor(h3 * 6)];
    c.globalAlpha = 0.45 + h1 * 0.4;
    c.fillRect(col * cw + 2, r * ch + 2, cw - 4, ch - 4);
  }
  c.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2); t.needsUpdate = true; return t;
}

function makeSign(label, bg, fg) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
  const c = cv.getContext("2d");
  c.fillStyle = bg; c.fillRect(0, 0, 512, 128);
  c.strokeStyle = fg; c.lineWidth = 4; c.strokeRect(6, 6, 500, 116);
  c.font = "700 52px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = fg; c.shadowColor = fg; c.shadowBlur = 20;
  c.fillText(label, 256, 64);
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

function makeHolo(label, cA, cB) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
  const c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 0, 512, 256);
  g.addColorStop(0, cA); g.addColorStop(1, cB);
  c.fillStyle = g; c.fillRect(0, 0, 512, 256);
  c.fillStyle = "rgba(0,0,0,0.1)"; for (let i = 0; i < 256; i += 3) c.fillRect(0, i, 512, 1);
  c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = 4; c.strokeRect(10, 10, 492, 236);
  c.font = "800 80px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = "#fff"; c.shadowColor = cA; c.shadowBlur = 20;
  c.fillText(label, 256, 128);
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENTIONAL CITY LAYOUT
// Five districts arranged around a central fountain plaza at (0, 0, 0)
//
//  FINANCIAL CORE  (center, radius 0–80):   Glass skyscrapers, tallest buildings
//  ENTERTAINMENT   (east,  X: 80–240):       Neon-heavy, mid-rise, dense signage
//  RESIDENTIAL     (west,  X: -80 to -240):  Warm windows, lower height, trees
//  INDUSTRIAL      (north, Z: -80 to -280):  Metal/concrete, warehouses
//  CIVIC/PARK      (south, Z: 80–280):       Open plazas, lower density
//
// Streets are named and intentionally sized.
// ─────────────────────────────────────────────────────────────────────────────

// Main boulevard (east-west) — widest, camera travels this
const BLVD_Z = 0;        // The grand boulevard
const BLVD_W = 36;       // Very wide

// Cross avenues (north-south)
const AVE_GRAND  =  0;   // Central grand avenue — widest
const AVE_EAST   =  90;  // East entertainment avenue
const AVE_WEST   = -90;  // West residential avenue
const AVE_FAR_E  =  200; // Far east
const AVE_FAR_W  = -200; // Far west
const AVE_W_SIZE = 28;   // Width of grand avenues
const AVE_N_SIZE = 20;   // Width of normal avenues

// East-west streets
const ST_N1 = -60;   // North street 1
const ST_N2 = -130;  // North street 2
const ST_N3 = -220;  // North street 3
const ST_S1 =  60;   // South street 1
const ST_S2 =  130;  // South street 2
const ST_S3 =  220;  // South street 3
const ST_W  = 22;    // Normal street width

// All streets/avenues for road generation
const STREETS_Z = [BLVD_Z, ST_N1, ST_N2, ST_N3, ST_S1, ST_S2, ST_S3];
const AVENUES_X = [AVE_GRAND, AVE_EAST, AVE_WEST, AVE_FAR_E, AVE_FAR_W];

function streetWidth(z)  { return z === BLVD_Z ? BLVD_W : ST_W; }
function avenueWidth(x)  { return (x === AVE_GRAND || x === AVE_EAST || x === AVE_WEST) ? AVE_W_SIZE : AVE_N_SIZE; }

// ─────────────────────────────────────────────────────────────────────────────
// BUILDING DEFINITIONS — hand-placed for intentional layout
// Each: { x, z, w, d, h, mat, neon }
// mat: 0=glass, 1=residential, 2=metal, 3=concrete, 4=neonFacade
// ─────────────────────────────────────────────────────────────────────────────
const BUILDINGS = [
  // ── FINANCIAL CORE — glass towers around central plaza ──
  { x:  28, z: -28, w: 22, d: 22, h: 220, mat: 0 },  // NE glass tower (landmark)
  { x: -28, z: -28, w: 20, d: 20, h: 180, mat: 0 },  // NW glass tower
  { x:  28, z:  28, w: 20, d: 22, h: 160, mat: 0 },  // SE glass tower
  { x: -28, z:  28, w: 22, d: 20, h: 140, mat: 0 },  // SW glass tower
  { x:  50, z:   0, w: 16, d: 36, h: 200, mat: 0 },  // East landmark spire
  { x: -50, z:   0, w: 16, d: 36, h: 195, mat: 0 },  // West landmark spire
  { x:   0, z: -48, w: 36, d: 14, h: 170, mat: 0 },  // North slab
  { x:   0, z:  48, w: 36, d: 14, h: 150, mat: 4 },  // South neon slab
  { x:  42, z: -48, w: 18, d: 16, h: 130, mat: 0 },
  { x: -42, z: -48, w: 18, d: 16, h: 125, mat: 2 },
  { x:  42, z:  48, w: 18, d: 16, h: 120, mat: 4 },
  { x: -42, z:  48, w: 18, d: 16, h: 115, mat: 0 },

  // ── ENTERTAINMENT DISTRICT (east, X: 80–240) ──
  { x: 110, z: -25, w: 28, d: 22, h: 110, mat: 4 },  // Neon entertainment block
  { x: 148, z: -25, w: 24, d: 22, h: 95,  mat: 4 },
  { x: 110, z:  25, w: 28, d: 22, h: 105, mat: 4 },
  { x: 148, z:  25, w: 24, d: 22, h: 90,  mat: 4 },
  { x: 175, z:   0, w: 18, d: 48, h: 80,  mat: 4 },  // Tall neon tower
  { x: 110, z: -82, w: 26, d: 28, h: 75,  mat: 2 },
  { x: 148, z: -82, w: 22, d: 28, h: 85,  mat: 4 },
  { x: 110, z:  82, w: 26, d: 28, h: 70,  mat: 4 },
  { x: 148, z:  82, w: 22, d: 28, h: 80,  mat: 2 },
  { x: 220, z: -30, w: 22, d: 20, h: 60,  mat: 4 },
  { x: 220, z:  30, w: 22, d: 20, h: 65,  mat: 4 },
  { x: 175, z: -82, w: 20, d: 26, h: 55,  mat: 4 },
  { x: 175, z:  82, w: 20, d: 26, h: 58,  mat: 4 },
  { x: 110, z:-155, w: 24, d: 30, h: 65,  mat: 2 },
  { x: 148, z:-155, w: 20, d: 30, h: 60,  mat: 4 },
  { x: 110, z: 155, w: 24, d: 30, h: 62,  mat: 4 },
  { x: 148, z: 155, w: 20, d: 30, h: 58,  mat: 2 },

  // ── RESIDENTIAL DISTRICT (west, X: -80 to -240) ──
  { x:-108, z: -25, w: 26, d: 22, h: 55,  mat: 1 },
  { x:-144, z: -25, w: 22, d: 22, h: 50,  mat: 1 },
  { x:-108, z:  25, w: 26, d: 22, h: 60,  mat: 1 },
  { x:-144, z:  25, w: 22, d: 22, h: 52,  mat: 1 },
  { x:-108, z: -82, w: 24, d: 28, h: 48,  mat: 1 },
  { x:-144, z: -82, w: 20, d: 28, h: 45,  mat: 3 },
  { x:-108, z:  82, w: 24, d: 28, h: 52,  mat: 1 },
  { x:-144, z:  82, w: 20, d: 28, h: 48,  mat: 1 },
  { x:-172, z:   0, w: 16, d: 46, h: 58,  mat: 1 },
  { x:-218, z: -28, w: 20, d: 20, h: 42,  mat: 1 },
  { x:-218, z:  28, w: 20, d: 20, h: 44,  mat: 3 },
  { x:-172, z: -82, w: 18, d: 26, h: 46,  mat: 1 },
  { x:-172, z:  82, w: 18, d: 26, h: 44,  mat: 1 },
  { x:-108, z:-155, w: 22, d: 28, h: 50,  mat: 1 },
  { x:-144, z:-155, w: 18, d: 28, h: 46,  mat: 1 },
  { x:-108, z: 155, w: 22, d: 28, h: 48,  mat: 1 },
  { x:-144, z: 155, w: 18, d: 28, h: 50,  mat: 3 },

  // ── INDUSTRIAL DISTRICT (north, Z: -80 to -280) ──
  { x:  30, z:-100, w: 44, d: 20, h: 35,  mat: 2 },  // Wide warehouse
  { x: -30, z:-100, w: 44, d: 20, h: 32,  mat: 3 },
  { x:  30, z:-168, w: 42, d: 22, h: 38,  mat: 2 },
  { x: -30, z:-168, w: 42, d: 22, h: 36,  mat: 3 },
  { x:  30, z:-240, w: 40, d: 24, h: 30,  mat: 2 },
  { x: -30, z:-240, w: 40, d: 24, h: 28,  mat: 3 },

  // ── CIVIC/PARK DISTRICT (south, Z: 80–280) ──
  { x:  30, z: 100, w: 40, d: 20, h: 25,  mat: 3 },  // Civic low-rise
  { x: -30, z: 100, w: 40, d: 20, h: 28,  mat: 1 },
  { x:  30, z: 168, w: 38, d: 22, h: 22,  mat: 3 },
  { x: -30, z: 168, w: 38, d: 22, h: 20,  mat: 1 },
  { x:  30, z: 240, w: 36, d: 24, h: 26,  mat: 3 },
  { x: -30, z: 240, w: 36, d: 24, h: 24,  mat: 1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA PATH — intentional bird's-eye tour, no 180° turns
//
// Timeline (300s total):
//   0–20s   High altitude (y=400), looking down, city visible below through clouds
//   20–50s  Descending spiral from sky (400→120), passing through cloud layer
//   50–80s  Rooftop sweep along financial core (y=80), banking left
//   80–120s Dive to street level on grand avenue, heading east toward entertainment
//   120–155s Slow arc through entertainment district, weaving between neon buildings
//   155–185s Turn north, fly low along east avenue, pass street lamps
//   185–215s Arc back west along northern industrial street, low and dramatic
//   215–245s Slow descent over central plaza, circle the fountain (y=8→4)
//   245–270s Climb gently along west residential avenue, warm windows
//   270–300s Rise back to y=80, banking south, closing the loop
// ─────────────────────────────────────────────────────────────────────────────
export function getCameraPath() {
  // Positions and look-at targets — each pair is intentional
  const pts = [
    // [px, py, pz,   tx, ty, tz]           // description
    [   0, 400,  300,   0, 200,    0],       // 0: High sky start — looking down at city
    [  80, 340,  200,  30, 180,   80],       // 1: Begin descent, banking right
    [ 120, 260,   80, 100, 140,    0],       // 2: Mid descent — city expanding below
    [  80, 180,    0,  40, 120,  -40],       // 3: Cloud layer pierce — buildings emerging
    [  40, 120,  -60,  10,  80,  -80],       // 4: Below clouds — rooftop level, financial core
    [   0, 240,  -80, -20, 160, -100],       // 5: Rooftop sweep ABOVE tallest towers (220h), banking left
    [ -40, 220, -100, -60, 150, -120],       // 6: Continue banking above west spires
    [ -30, 180, -130, -10, 120, -150],       // 7: Arc right, descending, heading south
    [   0, 130, -160,  20,  80, -120],       // 8: Turn south, dropping toward boulevard
    [  30,  55,  -80,  20,  30,  -30],       // 9: Descend into grand boulevard
    [  20,  12,  -20,  50,  10,    0],       // 10: Street level entry — boulevard
    [  60,   8,    0,  90,   8,    0],       // 11: East along grand boulevard at eye level
    [  90,   8,    0, 120,   8,  -10],       // 12: Approaching entertainment district
    [ 130,  14,  -10, 148,  12,  -18],       // 13: Into entertainment, on avenue x=90 side (clear of bldg x=110,z=-25)
    [ 148,  16,  -20, 172,  15,  -12],       // 14: Banking right, neon facades close
    [ 170,  18,  -10, 175,  16,   10],       // 15: Arc south through entertainment core
    [ 170,  20,   20, 155,  18,   40],       // 16: Banking left, continue south arc
    [ 145,  15,   45, 120,  12,   50],       // 17: Heading west, low between buildings
    [ 110,  10,   50,  90,   8,   30],       // 18: Back to avenue, heading west
    [  90,   8,   20,  60,   8,    0],       // 19: West along boulevard toward center
    [  50,   6,    0,  20,   5,    0],       // 20: Approaching plaza — very low
    [  15,   4,    0, -10,   4,   10],       // 21: Entering plaza — fountain ahead
    [   0,   5,   10,  -5,   4,    0],       // 22: Arc right around fountain (south)
    [  -8,   5,    0,  -5,   4,  -10],       // 23: North side of fountain
    [   0,   6,  -12,   8,   5,    0],       // 24: Complete fountain arc, heading east
    [  10,   8,  -20,   0,   8,  -40],       // 25: Rise away from plaza
    [   0,  12,  -40, -30,  10,  -60],       // 26: Banking left, heading north-west
    [ -20,  10,  -55, -45,   9,  -70],       // 27: Into residential, shifted east to avoid bldg at x=-42,z=-48
    [ -60,   8,  -65, -90,   8,  -60],       // 28: Along residential street, lamps ahead
    [ -90,   8,  -50, -90,   8,  -20],       // 29: North on west avenue — lamps flanking
    [ -90,   8,  -10, -90,   8,   20],       // 30: Continuing north on west avenue
    [ -90,   8,   30, -70,   8,   50],       // 31: Turning east off avenue
    [ -60,   8,   55, -30,   8,   55],       // 32: East along south street, residential
    [ -20,   8,   55,  20,   8,   55],       // 33: Approaching center from south
    [   5,  10,   45,   0,   8,   20],       // 34: Climbing slightly toward plaza
    [   0,  20,   20,   0,  15,    0],       // 35: Final rise, plaza below
    [   0,  50,    0,   0,  30, -100],       // 36: Climb, financial core in view
    [  40, 100,  -80,  20,  60, -160],       // 37: Rising above towers
    [  80, 180, -160,  40, 100, -200],       // 38: High, industrial district below
    [  40, 280,  -80,   0, 200,    0],       // 39: Back toward sky — loop closing
  ];

  const positions = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const targets   = pts.map(p => new THREE.Vector3(p[3], p[4], p[5]));

  return { positions, targets };
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY BUILD
// ─────────────────────────────────────────────────────────────────────────────
export function createCity(scene) {
  const root = new THREE.Group(); root.name = "city"; scene.add(root);
  const loader = new GLTFLoader();
  const dummy = new THREE.Object3D();

  // Window textures — varied per facade type
  const winGlass = makeWindowTex(6,  28);
  const winRes   = makeWindowTex(10, 16);
  const winMetal = makeWindowTex(5,  24);
  const winConc  = makeWindowTex(8,  18);
  const winNeon  = makeWindowTex(7,  22);

  // ── Facade materials ────────────────────────────────────────────────────
  const glassP = pbr(A.fGlass, 2, 6);
  const resP   = pbr(A.fRes,   2, 6);
  const neonP  = pbr(A.fNeon,  2, 6);
  const metalP = pbr(A.metal,  3, 8);
  const concP  = pbr(A.concrete, 3, 6);

  const facadeMats = [
    // 0: glass tower — cool blue-tinted windows, corporate reflective
    new THREE.MeshStandardMaterial({ ...glassP, color: "#1e2f4a", roughness: 0.15, metalness: 0.7,
      emissive: "#4a90d8", emissiveMap: winGlass, emissiveIntensity: 0.55,
      envMapIntensity: 2.0, normalScale: new THREE.Vector2(1, 1) }),
    // 1: residential — warm amber/orange lit windows
    new THREE.MeshStandardMaterial({ ...resP, color: "#2e2218", roughness: 0.75, metalness: 0.05,
      emissive: "#d07030", emissiveMap: winRes, emissiveIntensity: 0.65,
      envMapIntensity: 0.4, normalScale: new THREE.Vector2(0.7, 0.7) }),
    // 2: metal/industrial — dim cool-blue windows
    new THREE.MeshStandardMaterial({ ...metalP, color: "#18202e", roughness: 0.35, metalness: 0.85,
      emissive: "#2840a0", emissiveMap: winMetal, emissiveIntensity: 0.30,
      envMapIntensity: 1.4, normalScale: new THREE.Vector2(0.9, 0.9) }),
    // 3: concrete/civic — muted, few lit windows
    new THREE.MeshStandardMaterial({ ...concP, color: "#1e2028", roughness: 0.7, metalness: 0.10,
      emissive: "#202840", emissiveMap: winConc, emissiveIntensity: 0.20,
      envMapIntensity: 0.3, normalScale: new THREE.Vector2(0.6, 0.6) }),
    // 4: neon entertainment — vivid magenta/cyan glow
    new THREE.MeshStandardMaterial({ ...neonP, color: "#160e28", roughness: 0.25, metalness: 0.5,
      emissive: "#e030d0", emissiveMap: winNeon, emissiveIntensity: 0.90,
      envMapIntensity: 1.6, normalScale: new THREE.Vector2(1, 1) }),
  ];

  // ── InstancedMesh per material ─────────────────────────────────────────
  const counts = [0, 0, 0, 0, 0];
  BUILDINGS.forEach(b => counts[b.mat]++);
  const buildMeshes = facadeMats.map((mat, i) => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, Math.max(counts[i], 1));
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    root.add(m); return m;
  });
  const mc = [0, 0, 0, 0, 0];
  const bounds = [];

  BUILDINGS.forEach(b => {
    dummy.position.set(b.x, b.h / 2, b.z);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.rotation.y = 0; dummy.updateMatrix();
    buildMeshes[b.mat].setMatrixAt(mc[b.mat], dummy.matrix);
    // District-based color tint
    const dist = Math.sqrt(b.x * b.x + b.z * b.z);
    const hue = b.mat === 0 ? 0.58 : b.mat === 4 ? 0.72 : b.mat === 1 ? 0.08 : 0.55;
    const sat = b.mat === 4 ? 0.25 : 0.12;
    const lit = 0.42 + (1 - Math.min(dist / 250, 1)) * 0.18;
    buildMeshes[b.mat].setColorAt(mc[b.mat], new THREE.Color().setHSL(hue, sat, lit));
    mc[b.mat]++;
    bounds.push({ x: b.x, z: b.z, hw: b.w / 2 + 1.5, hd: b.d / 2 + 1.5 });
  });

  buildMeshes.forEach((m, i) => {
    m.count = mc[i]; m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  });

  // ── Rooftop antennas & tanks ────────────────────────────────────────────
  const antMat  = new THREE.MeshStandardMaterial({ color: "#2a3850", roughness: 0.4, metalness: 0.85 });
  const tankMat = new THREE.MeshStandardMaterial({ color: "#323e4a", roughness: 0.6, metalness: 0.3 });
  BUILDINGS.forEach((b, i) => {
    if (b.h < 50) return;
    const h = hash2D(i * 3.7, i * 1.1);
    if (h < 0.4) {
      const aH = 6 + h * 18;
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, aH, 6), antMat);
      ant.position.set(b.x, b.h + aH * 0.5, b.z); root.add(ant);
      const blink = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6),
        new THREE.MeshBasicMaterial({ color: "#ff1818", transparent: true, opacity: 0.85 }));
      blink.position.set(b.x, b.h + aH + 0.3, b.z); root.add(blink);
    } else if (h < 0.65) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.5, 8), tankMat);
      tank.position.set(b.x + b.w * 0.25, b.h + 1.25, b.z - b.d * 0.2); root.add(tank);
    }
  });

  // ── Ground plane ────────────────────────────────────────────────────────
  const gndPBR = pbr(A.asphaltDmg, 18, 18);
  const groundMat = new THREE.MeshPhysicalMaterial({
    ...gndPBR, color: "#080c12", metalness: 0.15, roughness: 0.72,
    clearcoat: 0.22, clearcoatRoughness: 0.45,
    normalScale: new THREE.Vector2(0.3, 0.3),
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; ground.receiveShadow = true;
  root.add(ground);

  // ── Roads ───────────────────────────────────────────────────────────────
  const RL = 1600;
  const roadPBR = pbr(A.asphalt, 4, RL / 16);
  const roadMat = new THREE.MeshPhysicalMaterial({
    ...roadPBR, color: "#3c4248", metalness: 0.05, roughness: 0.55,
    clearcoat: 0.3, clearcoatRoughness: 0.35,
    normalScale: new THREE.Vector2(0.6, 0.6),
  });
  const linePBR = pbr(A.rl004, 1, RL / 12);
  const lineMat = new THREE.MeshStandardMaterial({
    ...linePBR, transparent: true, color: "#9099a0", roughness: 0.5, metalness: 0.0,
    depthWrite: false, opacity: 0.35,
  });
  const neonEdgeMat = new THREE.MeshBasicMaterial({
    color: "#00d4ff", transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  function addPlane(geo, mat, px, py, pz, rx = -Math.PI / 2, shadow = false) {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = rx; m.position.set(px, py, pz);
    if (shadow) m.receiveShadow = true;
    root.add(m); return m;
  }

  // East-west streets
  for (const z of STREETS_Z) {
    const rw = streetWidth(z);
    const isMain = z === BLVD_Z;
    addPlane(new THREE.PlaneGeometry(RL, rw),        roadMat,    0, 0.010, z, -Math.PI / 2, true);
    addPlane(new THREE.PlaneGeometry(RL, rw * 0.10), lineMat,    0, 0.016, z);
    if (isMain) {
      for (const off of [-rw / 2, rw / 2])
        addPlane(new THREE.PlaneGeometry(RL, 0.6), neonEdgeMat, 0, 0.030, z + off);
    }
  }
  // North-south avenues
  for (const x of AVENUES_X) {
    const rw = avenueWidth(x);
    const isMain = x === AVE_GRAND || x === AVE_EAST || x === AVE_WEST;
    addPlane(new THREE.PlaneGeometry(rw, RL),        roadMat,    x, 0.012, 0, -Math.PI / 2, true);
    addPlane(new THREE.PlaneGeometry(rw * 0.10, RL), lineMat,    x, 0.017, 0);
    if (isMain) {
      for (const off of [-rw / 2, rw / 2])
        addPlane(new THREE.PlaneGeometry(0.6, RL), neonEdgeMat, x + off, 0.030, 0);
    }
  }

  // ── Sidewalks ───────────────────────────────────────────────────────────
  const SW = 4.5, CH = 0.2;
  const swPBR = pbr(A.paving, 3, 80);
  const swMat = new THREE.MeshStandardMaterial({
    ...swPBR, color: "#32363c", roughness: 0.78, metalness: 0.04,
    normalScale: new THREE.Vector2(0.7, 0.7),
  });
  const curbMat = new THREE.MeshStandardMaterial({ color: "#484e56", roughness: 0.72, metalness: 0.08 });

  for (const z of STREETS_Z) {
    const rw = streetWidth(z);
    for (const s of [-1, 1]) {
      const edge = z + s * rw / 2;
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(RL, SW), swMat);
      sw.rotation.x = -Math.PI / 2; sw.position.set(0, 0.022, edge + s * (SW / 2 + 0.2));
      sw.receiveShadow = true; root.add(sw);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(RL, CH, 0.4), curbMat);
      curb.position.set(0, CH / 2, edge); root.add(curb);
    }
  }
  for (const x of AVENUES_X) {
    const rw = avenueWidth(x);
    for (const s of [-1, 1]) {
      const edge = x + s * rw / 2;
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(SW, RL), swMat);
      sw.rotation.x = -Math.PI / 2; sw.position.set(edge + s * (SW / 2 + 0.2), 0.022, 0);
      sw.receiveShadow = true; root.add(sw);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.4, CH, RL), curbMat);
      curb.position.set(edge, CH / 2, 0); root.add(curb);
    }
  }

  // ── Crosswalks ──────────────────────────────────────────────────────────
  const cwTex = (() => {
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 256;
    const c = cv.getContext("2d");
    c.fillStyle = "#18202a"; c.fillRect(0, 0, 128, 256);
    c.fillStyle = "#c0c8d0"; c.globalAlpha = 0.4;
    for (let i = 0; i < 8; i++) c.fillRect(0, i * 32 + 5, 128, 17);
    c.globalAlpha = 1;
    const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
  })();
  const cwMat = new THREE.MeshBasicMaterial({ map: cwTex, transparent: true, opacity: 0.32, depthWrite: false });

  for (const x of AVENUES_X) {
    for (const z of STREETS_Z) {
      const sw = streetWidth(z), aw = avenueWidth(x);
      const c1 = new THREE.Mesh(new THREE.PlaneGeometry(aw * 0.65, 3.2), cwMat);
      c1.rotation.x = -Math.PI / 2; c1.position.set(x, 0.023, z + sw / 2 + 2.0);
      root.add(c1);
      const c2 = new THREE.Mesh(new THREE.PlaneGeometry(3.2, sw * 0.65), cwMat);
      c2.rotation.x = -Math.PI / 2; c2.position.set(x + aw / 2 + 2.0, 0.023, z);
      root.add(c2);
    }
  }

  // ── FOUNTAIN PLAZA at (0, 0, 0) ─────────────────────────────────────────
  // Multi-tiered fountain — centrepiece of the camera path
  const ftnGrp = new THREE.Group(); root.add(ftnGrp);

  const plazaMat = new THREE.MeshStandardMaterial({ ...pbr(A.paving, 6, 6), color: "#2a2e34", roughness: 0.65, metalness: 0.08 });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(22, 48), plazaMat);
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.025; ftnGrp.add(plaza);

  const basinMat = new THREE.MeshStandardMaterial({ color: "#1a2234", roughness: 0.4, metalness: 0.3 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(10, 10.5, 0.8, 32), basinMat);
  basin.position.y = 0.4; ftnGrp.add(basin);

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: "#000810", metalness: 0.9, roughness: 0.02,
    clearcoat: 1.0, clearcoatRoughness: 0.02,
    transparent: true, opacity: 0.82,
    emissive: "#082040", emissiveIntensity: 0.2,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(9.6, 40), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = 0.82; ftnGrp.add(water);

  // Middle tier
  const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.0, 0.6, 24), basinMat);
  tier2.position.y = 1.6; ftnGrp.add(tier2);
  const water2 = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), waterMat);
  water2.rotation.x = -Math.PI / 2; water2.position.y = 1.92; ftnGrp.add(water2);

  // Top spire
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 4, 12), basinMat);
  spire.position.y = 4.0; ftnGrp.add(spire);

  // Neon-lit fountain light — cyan glow
  const ftnLight = new THREE.PointLight("#00d4ff", 18, 40, 2);
  ftnLight.position.set(0, 3, 0); ftnGrp.add(ftnLight);
  const ftnGlow = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12),
    new THREE.MeshBasicMaterial({ color: "#00d4ff", transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  ftnGlow.position.copy(ftnLight.position); ftnGrp.add(ftnGlow);

  // ── Puddles ─────────────────────────────────────────────────────────────
  const pudMat = new THREE.MeshPhysicalMaterial({
    color: "#000000", metalness: 0.25, roughness: 0.06,
    clearcoat: 1, clearcoatRoughness: 0.04,
    transparent: true, opacity: 0.14, envMapIntensity: 0.25,
  });
  const puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), pudMat, 50);
  root.add(puddles);
  // Place puddles only on known road positions
  const roadPositions = [
    ...STREETS_Z.flatMap(z => Array.from({ length: 10 }, (_, i) => [i * 80 - 360, z])),
    ...AVENUES_X.flatMap(x => Array.from({ length: 10 }, (_, i) => [x, i * 80 - 360])),
  ];
  for (let i = 0; i < 50; i++) {
    const rp = roadPositions[i % roadPositions.length];
    const rx = rp[0] + (hash2D(i, 3.3) - 0.5) * 30;
    const rz = rp[1] + (hash2D(i + 1, 5.5) - 0.5) * 10;
    dummy.position.set(rx, 0.019, rz);
    dummy.rotation.set(-Math.PI / 2, 0, hash2D(i, 7.7) * Math.PI);
    const r = 1.5 + hash2D(i + 2, 1.1) * 3.5;
    dummy.scale.set(r * 1.8, r, 1); dummy.updateMatrix();
    puddles.setMatrixAt(i, dummy.matrix);
  }
  puddles.instanceMatrix.needsUpdate = true;

  // ── Neon panels on buildings ─────────────────────────────────────────
  const panMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.1), panMat, 500);
  panels.frustumCulled = false; root.add(panels);
  for (let i = 0; i < 500; i++) {
    const b = BUILDINGS[i % BUILDINGS.length];
    if (b.h < 35) { dummy.position.set(0, -9999, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); panels.setMatrixAt(i, dummy.matrix); continue; }
    const face = i % 4;
    const hb = 0.1 + hash2D(i, b.x + 1) * 0.8;
    const y = hb * b.h;
    const wo = b.w * 0.5 + 0.12, do_ = b.d * 0.5 + 0.12;
    const pos = face === 0 ? [b.x + wo, y, b.z + (hash2D(i + 1, 2) - 0.5) * b.d * 0.6]
              : face === 1 ? [b.x - wo, y, b.z + (hash2D(i + 1, 2) - 0.5) * b.d * 0.6]
              : face === 2 ? [b.x + (hash2D(i + 1, 2) - 0.5) * b.w * 0.6, y, b.z + do_]
                           : [b.x + (hash2D(i + 1, 2) - 0.5) * b.w * 0.6, y, b.z - do_];
    dummy.position.set(...pos);
    dummy.scale.set(2 + hash2D(i + 3, b.z) * 5, 0.3 + hash2D(i + 4, b.x) * 1.8, 0.1);
    dummy.rotation.y = (face < 2) ? Math.PI / 2 : 0; dummy.updateMatrix();
    panels.setMatrixAt(i, dummy.matrix);
    panels.setColorAt(i, sampleNeon(i, hash2D(i + 5, b.h) - 0.5));
  }
  panels.instanceMatrix.needsUpdate = true;
  if (panels.instanceColor) panels.instanceColor.needsUpdate = true;

  // ── Neon horizontal strips ──────────────────────────────────────────────
  const stripMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.07, 0.06), stripMat, 400);
  strips.frustumCulled = false; root.add(strips);
  for (let i = 0; i < 400; i++) {
    const b = BUILDINGS[i % BUILDINGS.length];
    if (b.h < 45) { dummy.position.set(0, -9999, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); strips.setMatrixAt(i, dummy.matrix); continue; }
    const face = i % 4;
    const y = (0.08 + hash2D(i, b.z + 3) * 0.84) * b.h;
    const fw = (face < 2 ? b.d : b.w);
    const fo = (face < 2 ? b.d : b.w) * 0.5 + 0.1;
    dummy.position.set(
      b.x + (face === 0 ? fo : face === 1 ? -fo : (hash2D(i + 1, b.z) - 0.5) * b.w * 0.8),
      y,
      b.z + (face === 2 ? fo : face === 3 ? -fo : (hash2D(i + 1, b.x) - 0.5) * b.d * 0.8)
    );
    dummy.rotation.y = face < 2 ? Math.PI / 2 : 0;
    dummy.scale.set(fw * 0.90, 0.07, 0.06); dummy.updateMatrix();
    strips.setMatrixAt(i, dummy.matrix);
    strips.setColorAt(i, sampleNeon(i + 2, hash2D(i + 6, b.h) - 0.5));
  }
  strips.instanceMatrix.needsUpdate = true;
  if (strips.instanceColor) strips.instanceColor.needsUpdate = true;

  // ── Shop signs — entertainment district + core ─────────────────────────
  const signNames = ["NEXUS","SYNTH","CYBER BAR","HOLO CAFE","NOODLE","ARCADE","PULSE","DRONE HUB","RAMEN","BYTE DINER","ION CLUB","VOID","FLUX BAR","GRID TECH","NEO MARKET"];
  const signPalettes = [["#060010","#ff00e5"],["#000a18","#00e5ff"],["#100008","#ff4020"],["#00081a","#2060ff"],["#080002","#ff6090"],["#001a0a","#00ffd0"]];
  const shopSigns = [], shopLights = [];

  BUILDINGS.forEach((b, i) => {
    if (b.mat !== 4 && b.mat !== 0) return; // signs only on entertainment + glass
    if (b.h < 35) return;
    const pal = signPalettes[i % signPalettes.length];
    const face = i % 4;
    const signH = 4 + hash2D(i, 2.2) * 3;
    const tex = makeSign(signNames[i % signNames.length], pal[0], pal[1]);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.88, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.8), mat);
    const ypos = Math.min(signH, b.h * 0.25);
    let sx, sz;
    if (face < 2) {
      sx = b.x + (face === 0 ? b.w * 0.5 + 0.5 : -b.w * 0.5 - 0.5);
      sz = b.z + (hash2D(i + 1, 3) - 0.5) * b.d * 0.4;
      mesh.rotation.y = face === 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      sx = b.x + (hash2D(i + 1, 3) - 0.5) * b.w * 0.4;
      sz = b.z + (face === 2 ? b.d * 0.5 + 0.5 : -b.d * 0.5 - 0.5);
      mesh.rotation.y = face === 2 ? 0 : Math.PI;
    }
    mesh.position.set(sx, ypos, sz);
    root.add(mesh);
    shopSigns.push({ mesh, phase: hash2D(i, 9.1) * Math.PI * 2 });

    const lc = new THREE.Color(pal[1]);
    const sl = new THREE.PointLight(lc, 6, 14, 2);
    sl.position.set(sx, ypos - 2, sz); root.add(sl);
    shopLights.push(sl);
  });

  // ── Billboards on tall buildings ──────────────────────────────────────
  const holoTextures = [
    makeHolo("SYN",  "#00d4ff", "#8833ff"),
    makeHolo("XR",   "#ff33cc", "#2266ff"),
    makeHolo("NEXO", "#00ffc0", "#4400ff"),
    makeHolo("NOVA", "#ff6000", "#ff0090"),
    makeHolo("GRID", "#00efff", "#7700ff"),
  ];
  const billboards = [];
  const tallBuildings = BUILDINGS.filter(b => b.h > 100);
  tallBuildings.forEach((b, i) => {
    const mat = new THREE.MeshBasicMaterial({
      map: holoTextures[i % holoTextures.length], transparent: true, opacity: 0.42,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      color: sampleNeon(i, 0.05),
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), mat);
    const side = i % 2 === 0 ? 1 : -1;
    mesh.position.set(b.x + side * (b.w * 0.5 + 2), b.h * 0.55, b.z);
    mesh.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    root.add(mesh);
    billboards.push({ mesh, pulse: 0.6 + hash2D(i, b.h) * 1.4, phase: hash2D(i + 3, b.z) * Math.PI * 2 });
  });

  // ── Rooftop beacon lights ──────────────────────────────────────────────
  const beacons = [];
  tallBuildings.slice(0, 10).forEach((b, i) => {
    const col = sampleNeon(i + 1, 0.04);
    const light = new THREE.PointLight(col, 28, 180, 2);
    light.position.set(b.x, b.h + 10, b.z); root.add(light);
    const gm = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    gm.position.copy(light.position); root.add(gm);
    beacons.push({ light, gm, phase: hash2D(i + 7, b.x) * Math.PI * 2 });
  });

  // ── Street lamps ───────────────────────────────────────────────────────
  const lampGroup = new THREE.Group(); root.add(lampGroup);
  const lampData = [];
  const glowMat = new THREE.MeshBasicMaterial({ color: "#c8eeff", transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolMat = new THREE.MeshBasicMaterial({ color: "#2a5870", transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });

  const lampSpots = [];
  for (const z of STREETS_Z) {
    const rw = streetWidth(z);
    for (let x = -380; x <= 380; x += 55) lampSpots.push({ x, z: z + rw / 2 + 3.5, ry: 0 });
  }
  for (const x of AVENUES_X) {
    const rw = avenueWidth(x);
    for (let z = -380; z <= 380; z += 55) lampSpots.push({ x: x + rw / 2 + 3.5, z, ry: Math.PI / 2 });
  }

  const poleMat = new THREE.MeshStandardMaterial({ color: "#18243a", roughness: 0.45, metalness: 0.7 });
  const poleGeo = new THREE.CylinderGeometry(0.10, 0.18, 7.5, 6);
  const glowGeo = new THREE.SphereGeometry(0.45, 8, 8);
  const poolGeo = new THREE.CircleGeometry(5.5, 14);

  function buildLamps(template) {
    lampGroup.clear();
    lampData.length = 0;
    lampSpots.forEach(sp => {
      if (template) {
        const lm = template.clone();
        lm.scale.setScalar(2.8); lm.position.set(sp.x, 0, sp.z); lm.rotation.y = sp.ry;
        lampGroup.add(lm);
      } else {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(sp.x, 3.75, sp.z); lampGroup.add(pole);
      }
      const glow = new THREE.Mesh(glowGeo, glowMat.clone());
      glow.position.set(sp.x, 7.6, sp.z); lampGroup.add(glow);
      const pool = new THREE.Mesh(poolGeo, poolMat.clone());
      pool.rotation.x = -Math.PI / 2; pool.position.set(sp.x, 0.03, sp.z); lampGroup.add(pool);
      lampData.push({ glow, pool, phase: hash2D(sp.x * 0.1, sp.z * 0.1) * Math.PI * 2 });
    });
  }
  buildLamps(null);
  loader.load(A.lamp, gltf => { buildLamps(gltf.scene); }, undefined, () => {});

  // ── Street PointLights — actual illumination along key routes ──────────
  // Sparse grid: ~16 lights along boulevard + grand avenue to light the ground
  const streetLights = [];
  const streetLightPositions = [
    // Boulevard (z=0): every 110 units
    ...([-330,-220,-110,0,110,220,330].map(x => ({ x, y: 7, z: 0 }))),
    // Grand avenue (x=0): every 110 units
    ...([-330,-220,-110,0,110,220,330].map(z => ({ x: 0, y: 7, z }))),
    // Entertainment (x=90): 4 key spots
    ...([  -60,  0,  60].map(z => ({ x: 90, y: 7, z }))),
    // Residential (x=-90): 4 key spots
    ...([ -60,  0,  60].map(z => ({ x: -90, y: 7, z }))),
  ];
  streetLightPositions.forEach(p => {
    const sl = new THREE.PointLight("#b8e0ff", 0, 55, 1.6);
    sl.position.set(p.x, p.y, p.z);
    root.add(sl);
    streetLights.push(sl);
  });

  // ── Light spill from buildings ─────────────────────────────────────────
  const spillMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false });
  const spills = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), spillMat, 200);
  spills.frustumCulled = false; root.add(spills);
  BUILDINGS.slice(0, 200).forEach((b, i) => {
    const face = i % 4;
    const fw = face < 2 ? b.w : b.d;
    const fo = (face < 2 ? b.d : b.w) * 0.5 + 8;
    dummy.position.set(
      b.x + (face === 0 ? fo : face === 1 ? -fo : 0),
      0.016,
      b.z + (face === 2 ? fo : face === 3 ? -fo : 0)
    );
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(fw * 1.3, 14, 1); dummy.updateMatrix();
    spills.setMatrixAt(i, dummy.matrix);
    spills.setColorAt(i, sampleNeon(i + 4, hash2D(i, b.x) - 0.3));
  });
  spills.instanceMatrix.needsUpdate = true;
  if (spills.instanceColor) spills.instanceColor.needsUpdate = true;

  // ── Fog volumes ─────────────────────────────────────────────────────────
  const fogVols = [];
  const fogBaseMat = new THREE.MeshBasicMaterial({ color: "#1e1228", transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 20; i++) {
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(280 + i * 10, 12), fogBaseMat.clone());
    fm.rotation.x = -Math.PI / 2;
    const sz = STREETS_Z[i % STREETS_Z.length];
    fm.position.set((hash2D(i, 9.9) - 0.5) * 300, 1.8 + hash2D(i + 2, 5.5) * 4, sz + (hash2D(i + 3, 1.1) - 0.5) * 150);
    root.add(fm); fogVols.push(fm);
  }

  // ── CARS ───────────────────────────────────────────────────────────────
  // 120 cars, weighted heavily on main boulevard + grand avenue
  // Colour palette: dark jewel tones for main, neon accent for entertainment district
  const carPalette = [
    "#1a2048","#0e1e3c","#1c1430","#2a1040",  // dark blue/purple (main)
    "#3c0a18","#280a28","#0a1a3c","#183060",  // dark reds/navy
    "#e83050","#d0204a","#c83080","#9040c0",  // neon accent
    "#1e3a28","#0a2820","#2a3010","#181818",  // dark green/gray
  ].map(c => new THREE.Color(c));

  const carGroup = new THREE.Group(); root.add(carGroup);
  const carData = [];

  function isBlocked(px, pz) {
    return bounds.some(b => Math.abs(px - b.x) < b.hw && Math.abs(pz - b.z) < b.hd);
  }

  // Intentional car placements: specify road, lane, position, speed
  const carDefs = [];
  // Grand Boulevard (z=0) — most cars, both directions
  for (let i = 0; i < 20; i++) {
    const dir = i < 12 ? 1 : -1;
    carDefs.push({ onZ: true, road: BLVD_Z, roadW: BLVD_W, laneOff: dir * BLVD_W * 0.2, startX: dir > 0 ? -300 + i * 30 : 300 - i * 30, dir, speed: 16 + (i % 5) * 4 });
  }
  // East avenue (x=90)
  for (let i = 0; i < 14; i++) {
    const dir = i < 8 ? 1 : -1;
    carDefs.push({ onZ: false, road: AVE_EAST, roadW: AVE_W_SIZE, laneOff: dir * AVE_W_SIZE * 0.2, startZ: dir > 0 ? -250 + i * 40 : 250 - i * 40, dir, speed: 14 + (i % 5) * 3 });
  }
  // Grand avenue (x=0)
  for (let i = 0; i < 14; i++) {
    const dir = i < 8 ? 1 : -1;
    carDefs.push({ onZ: false, road: AVE_GRAND, roadW: AVE_W_SIZE, laneOff: dir * AVE_W_SIZE * 0.2, startZ: dir > 0 ? -250 + i * 40 : 250 - i * 40, dir, speed: 15 + (i % 5) * 3 });
  }
  // West avenue (x=-90)
  for (let i = 0; i < 10; i++) {
    const dir = i < 6 ? 1 : -1;
    carDefs.push({ onZ: false, road: AVE_WEST, roadW: AVE_W_SIZE, laneOff: dir * AVE_W_SIZE * 0.2, startZ: dir > 0 ? -200 + i * 40 : 200 - i * 40, dir, speed: 12 + (i % 4) * 3 });
  }
  // Side streets — sparse
  for (const z of [ST_N1, ST_S1, ST_N2, ST_S2]) {
    for (let i = 0; i < 6; i++) {
      const dir = i < 3 ? 1 : -1;
      carDefs.push({ onZ: true, road: z, roadW: ST_W, laneOff: dir * ST_W * 0.22, startX: dir > 0 ? -200 + i * 80 : 200 - i * 80, dir, speed: 12 + i * 2 });
    }
  }

  function spawnCars(template) {
    carGroup.clear(); carData.length = 0;
    carDefs.forEach((def, i) => {
      const col = carPalette[i % carPalette.length];
      let mesh;
      if (template) {
        mesh = template.clone();
        mesh.traverse(ch => { if (ch.isMesh) { ch.material = ch.material.clone(); ch.material.color.copy(col); ch.material.metalness = 0.72; ch.material.roughness = 0.22; ch.castShadow = true; } });
        mesh.scale.setScalar(0.05);
      } else {
        mesh = new THREE.Group();
        const bm = new THREE.MeshStandardMaterial({ color: col, roughness: 0.22, metalness: 0.72 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 4.2), bm); body.position.y = 0.58; body.castShadow = true;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 2.2), new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.65), roughness: 0.28, metalness: 0.65 })); roof.position.set(0, 1.32, -0.2);
        const tlMat = new THREE.MeshBasicMaterial({ color: "#ff1010", transparent: true, opacity: 0.9 });
        const hl  = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.08), new THREE.MeshBasicMaterial({ color: "#fffadc", transparent: true, opacity: 0.95 })); hl.position.set(-0.72, 0.52, -2.17);
        const hr  = hl.clone(); hr.position.x =  0.72;
        const tl  = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.08), tlMat); tl.position.set(-0.72, 0.52, 2.17);
        const tr  = tl.clone(); tr.position.x =  0.72;
        const hgl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 6), new THREE.MeshBasicMaterial({ color: "#fffae0", transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })); hgl.position.set(0, 0.52, -2.6);
        // Small headlight point light
        const hlt = new THREE.PointLight("#fffae0", 4, 12, 2); hlt.position.set(0, 0.52, -2.6);
        mesh.add(body, roof, hl, hr, tl, tr, hgl, hlt);
      }

      let px, pz;
      if (def.onZ) {
        px = def.startX; pz = def.road + def.laneOff;
        mesh.rotation.y = def.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        px = def.road + def.laneOff; pz = def.startZ;
        mesh.rotation.y = def.dir > 0 ? 0 : Math.PI;
      }
      if (isBlocked(px, pz)) return;
      mesh.position.set(px, 0.04, pz);
      carGroup.add(mesh);
      carData.push({ mesh, def });
    });
  }
  loader.load(A.car, gltf => spawnCars(gltf.scene), undefined, () => spawnCars(null));

  // ─────────────────────────────────────────────────────────────────────────
  // ANIMATE
  // ─────────────────────────────────────────────────────────────────────────
  return {
    group: root,
    buildingBounds: bounds,

    update(t, mood = 1) {
      // Building emissive — per-district intensities, scale with night mood
      // At night (mood=1): glass=0.55, res=0.65, metal=0.30, concrete=0.20, neon=0.90
      const emissiveBases = [0.55, 0.65, 0.30, 0.20, 0.90];
      facadeMats.forEach((m, i) => {
        m.emissiveIntensity = emissiveBases[i] * (0.08 + mood * 0.92);
      });

      // Neon geometry
      panMat.opacity  = 0.02 + mood * 0.52 + Math.sin(t * 1.7) * 0.03 * mood;
      stripMat.opacity = 0.02 + mood * 0.48;
      neonEdgeMat.opacity = 0.02 + mood * 0.18;
      spillMat.opacity = 0.02 + mood * 0.08;

      // Road wetness at night
      roadMat.clearcoat = 0.15 + mood * 0.40;
      roadMat.color.setStyle(mood > 0.5 ? "#30363c" : "#454e56");
      groundMat.clearcoat = 0.18 + mood * 0.32;

      // Fog tone: warm purple at night, cool gray day
      const fogNight = new THREE.Color("#221030");
      const fogDay   = new THREE.Color("#585e64");
      fogVols.forEach(f => {
        f.material.color.copy(fogNight).lerp(fogDay, 1 - mood);
        f.material.opacity = 0.035 + mood * 0.055;
      });

      // Fountain
      ftnLight.intensity = 6 + mood * 22 + Math.sin(t * 1.3) * 4 * mood;
      ftnGlow.material.opacity = 0.05 + mood * 0.65;
      waterMat.emissiveIntensity = 0.06 + mood * 0.18 + Math.sin(t * 1.1) * 0.05;
      water2.material.emissiveIntensity = waterMat.emissiveIntensity;

      // Beacons
      beacons.forEach(b => {
        const p = 0.5 + 0.5 * Math.sin(t * 0.85 + b.phase);
        b.light.intensity = 2 + mood * (22 + 16 * p);
        b.gm.material.opacity = 0.03 + mood * (0.55 + p * 0.2);
      });

      // Shop signs flicker
      shopSigns.forEach((s, i) => {
        s.mesh.material.opacity = 0.06 + mood * 0.78 + Math.sin(t * 2.0 + s.phase) * 0.05 * mood;
      });
      shopLights.forEach(sl => { sl.intensity = 0.4 + mood * 6.5; });

      // Billboards pulse
      billboards.forEach(b => {
        b.mesh.material.opacity = 0.02 + mood * 0.38 + Math.sin(t * b.pulse + b.phase) * 0.05 * mood;
      });

      // Street PointLights — on at night, off in day
      streetLights.forEach(sl => { sl.intensity = mood * 28; });

      // Lamp glow — invisible day, glowing night
      lampData.forEach(ld => {
        const g = 0.75 + 0.25 * Math.sin(t * 1.6 + ld.phase);
        ld.glow.material.opacity  = 0.0 + mood * (0.70 + g * 0.22);
        ld.pool.material.opacity  = 0.0 + mood * (0.55 + g * 0.25);
      });

      // Cars
      const LIMIT = 420;
      carData.forEach(cd => {
        const { def, mesh } = cd;
        const step = def.speed * 0.016 * def.dir;
        if (def.onZ) {
          let nx = mesh.position.x + step;
          if (nx > LIMIT) nx = -LIMIT; if (nx < -LIMIT) nx = LIMIT;
          mesh.position.x = nx;
          mesh.position.z = def.road + def.laneOff;
        } else {
          let nz = mesh.position.z + step;
          if (nz > LIMIT) nz = -LIMIT; if (nz < -LIMIT) nz = LIMIT;
          mesh.position.z = nz;
          mesh.position.x = def.road + def.laneOff;
        }
      });
    },
  };
}
