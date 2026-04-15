import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { sampleNeon, hash2D } from "./utils.js";

// ── Asset paths ──────────────────────────────────────────────────────────────
const ASSETS = {
  asphalt:      { color: "assets/Asphalt012_1K-JPG/Asphalt012_1K-JPG_Color.jpg", normal: "assets/Asphalt012_1K-JPG/Asphalt012_1K-JPG_NormalGL.jpg", roughness: "assets/Asphalt012_1K-JPG/Asphalt012_1K-JPG_Roughness.jpg" },
  asphaltDmg:   { color: "assets/AsphaltDamageSet001_1K-JPG/AsphaltDamageSet001_1K-JPG_Color.jpg", normal: "assets/AsphaltDamageSet001_1K-JPG/AsphaltDamageSet001_1K-JPG_NormalGL.jpg", roughness: "assets/AsphaltDamageSet001_1K-JPG/AsphaltDamageSet001_1K-JPG_Roughness.jpg" },
  roadLines:    { color: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_Color.jpg", normal: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_NormalGL.jpg", roughness: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_Roughness.jpg", opacity: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_Opacity.jpg" },
  roadLines20B: { color: "assets/RoadLines020B_1K-JPG/RoadLines020B_1K-JPG_Color.jpg", normal: "assets/RoadLines020B_1K-JPG/RoadLines020B_1K-JPG_NormalGL.jpg", roughness: "assets/RoadLines020B_1K-JPG/RoadLines020B_1K-JPG_Roughness.jpg", opacity: "assets/RoadLines020B_1K-JPG/RoadLines020B_1K-JPG_Opacity.jpg" },
  paving:       { color: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_Color.jpg", normal: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_NormalGL.jpg", roughness: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_Roughness.jpg", ao: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_AmbientOcclusion.jpg" },
  concrete:     { color: "assets/Concrete034_1K-JPG/Concrete034_1K-JPG_Color.jpg", normal: "assets/Concrete034_1K-JPG/Concrete034_1K-JPG_NormalGL.jpg", roughness: "assets/Concrete034_1K-JPG/Concrete034_1K-JPG_Roughness.jpg" },
  facadeGlass:  { color: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Color.jpg", normal: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_NormalGL.jpg", roughness: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Roughness.jpg", metalness: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Metalness.jpg", emission: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Emission.jpg", ao: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_AmbientOcclusion.jpg" },
  facadeRes:    { color: "assets/Facade001_1K-JPG/Facade001_1K-JPG_Color.jpg", normal: "assets/Facade001_1K-JPG/Facade001_1K-JPG_NormalGL.jpg", roughness: "assets/Facade001_1K-JPG/Facade001_1K-JPG_Roughness.jpg", metalness: "assets/Facade001_1K-JPG/Facade001_1K-JPG_Metalness.jpg" },
  facadeNeon:   { color: "assets/Facade009_1K-JPG/Facade009_1K-JPG_Color.jpg", normal: "assets/Facade009_1K-JPG/Facade009_1K-JPG_NormalGL.jpg", roughness: "assets/Facade009_1K-JPG/Facade009_1K-JPG_Roughness.jpg", metalness: "assets/Facade009_1K-JPG/Facade009_1K-JPG_Metalness.jpg", emission: "assets/Facade009_1K-JPG/Facade009_1K-JPG_Emission.jpg" },
  metal:        { color: "assets/Metal032_1K-JPG/Metal032_1K-JPG_Color.jpg", normal: "assets/Metal032_1K-JPG/Metal032_1K-JPG_NormalGL.jpg", roughness: "assets/Metal032_1K-JPG/Metal032_1K-JPG_Roughness.jpg", metalness: "assets/Metal032_1K-JPG/Metal032_1K-JPG_Metalness.jpg" },
  ground:       { color: "assets/Ground054_1K-JPG/Ground054_1K-JPG_Color.jpg", normal: "assets/Ground054_1K-JPG/Ground054_1K-JPG_NormalGL.jpg", roughness: "assets/Ground054_1K-JPG/Ground054_1K-JPG_Roughness.jpg", ao: "assets/Ground054_1K-JPG/Ground054_1K-JPG_AmbientOcclusion.jpg" },
  car: "assets/Car.glb",
  lamp: "assets/sci-fi_street_lamp.glb",
};

const texLoader = new THREE.TextureLoader();
function loadTex(path, rx = 1, ry = 1) {
  const t = texLoader.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}
function loadPBR(set, rx, ry) {
  const r = { map: loadTex(set.color, rx, ry), normalMap: loadTex(set.normal, rx, ry), roughnessMap: loadTex(set.roughness, rx, ry) };
  if (set.ao) r.aoMap = loadTex(set.ao, rx, ry);
  if (set.metalness) r.metalnessMap = loadTex(set.metalness, rx, ry);
  if (set.emission) r.emissiveMap = loadTex(set.emission, rx, ry);
  if (set.opacity) r.alphaMap = loadTex(set.opacity, rx, ry);
  return r;
}

// ── Canvas textures ──────────────────────────────────────────────────────────
// #13: Varied window textures per material — different column/row counts
function createWindowTexture(cols = 8, rows = 20) {
  const W = 256, H = 512, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#080c14"; ctx.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  ctx.strokeStyle = "rgba(30,40,55,0.6)"; ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(W, r * ch); ctx.stroke(); }
  ctx.strokeStyle = "rgba(25,35,50,0.4)";
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, H); ctx.stroke(); }
  const ww = Math.floor(cw * 0.60), wh = Math.floor(ch * 0.55), px = Math.floor((cw - ww) / 2), py = Math.floor((ch - wh) / 2);
  const warm = ["#ffe9b0", "#ffd88a", "#fff4c0", "#ffcea0", "#ffe0b8"];
  const cool = ["#a8e0ff", "#90d8ff", "#b0eeff", "#d0a8ff", "#ff98e8", "#80f8f0"];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const h1 = Math.abs(Math.sin(c * 127.1 + r * 311.7 + 73.4) * 43758.5) % 1;
    const h2 = Math.abs(Math.sin(c * 43.3 + r * 97.1 + 22.6) * 43758.5) % 1;
    const h3 = Math.abs(Math.sin(c * 17.8 + r * 63.1 + 11.3) * 43758.5) % 1;
    if (h1 < 0.30) continue;
    ctx.fillStyle = (h2 > 0.45 ? cool : warm)[Math.floor(h3 * (h2 > 0.45 ? cool : warm).length)];
    ctx.globalAlpha = 0.50 + h1 * 0.35;
    ctx.fillRect(c * cw + px, r * ch + py, ww, wh);
    ctx.strokeStyle = "rgba(180,200,220,0.12)"; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.8;
    ctx.strokeRect(c * cw + px, r * ch + py, ww, wh);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 2); tex.needsUpdate = true;
  return tex;
}

function createCrosswalkTexture() {
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 256;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#1a1e24"; ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = "#c8d0d8"; ctx.globalAlpha = 0.45;
  for (let i = 0; i < 8; i++) ctx.fillRect(0, i * 32 + 4, 128, 18);
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true; return tex;
}

function createShopSign(label, bg, fg) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, cv.width, 0); g.addColorStop(0, bg); g.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.shadowColor = fg; ctx.shadowBlur = 8; ctx.strokeStyle = fg; ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, cv.width - 12, cv.height - 12);
  ctx.font = "700 48px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = fg; ctx.shadowBlur = 18; ctx.fillText(label, cv.width / 2, cv.height / 2); ctx.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true; return tex;
}

function createHoloTexture(label, cA, cB) {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128;
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, cv.width, cv.height); g.addColorStop(0, cA); g.addColorStop(1, cB);
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "rgba(0,0,0,0.12)"; for (let i = 0; i < cv.height; i += 3) ctx.fillRect(0, i, cv.width, 1);
  ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 3; ctx.strokeRect(8, 8, cv.width - 16, cv.height - 16);
  ctx.font = "700 48px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.shadowColor = cA; ctx.shadowBlur = 12;
  ctx.fillText(label, cv.width / 2, cv.height / 2); ctx.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true; return tex;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTENTIONAL CITY LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

const ROAD_W = 18;
const AVE_W = 28;
const SIDEWALK_W = 4;
const CURB_H = 0.18;

const STREETS_Z = [-320, -220, -140, -80, -30, 0, 30, 80, 140, 220, 320];
const AVENUES_X = [-300, -200, -120, -60, 0, 60, 120, 200, 300];

const MAIN_STREETS_Z = new Set([0, -140, 140]);
const MAIN_AVENUES_X = new Set([0, -120, 120]);

function getStreetWidth(z) { return MAIN_STREETS_Z.has(z) ? AVE_W : ROAD_W; }
function getAvenueWidth(x) { return MAIN_AVENUES_X.has(x) ? AVE_W : ROAD_W; }

function generateBlocks() {
  const blocks = [];
  for (let i = 0; i < AVENUES_X.length - 1; i++) {
    for (let j = 0; j < STREETS_Z.length - 1; j++) {
      const x0 = AVENUES_X[i], x1 = AVENUES_X[i + 1];
      const z0 = STREETS_Z[j], z1 = STREETS_Z[j + 1];
      const lAve = getAvenueWidth(x0) / 2 + SIDEWALK_W;
      const rAve = getAvenueWidth(x1) / 2 + SIDEWALK_W;
      const tSt = getStreetWidth(z0) / 2 + SIDEWALK_W;
      const bSt = getStreetWidth(z1) / 2 + SIDEWALK_W;
      const bx0 = x0 + lAve, bx1 = x1 - rAve;
      const bz0 = z0 + tSt, bz1 = z1 - bSt;
      if (bx1 - bx0 < 8 || bz1 - bz0 < 8) continue;
      blocks.push({
        x0: bx0, x1: bx1, z0: bz0, z1: bz1,
        cx: (bx0 + bx1) / 2, cz: (bz0 + bz1) / 2,
        w: bx1 - bx0, d: bz1 - bz0,
        distFromCenter: Math.sqrt(((bx0 + bx1) / 2) ** 2 + ((bz0 + bz1) / 2) ** 2),
      });
    }
  }
  return blocks;
}

function generateBuildingsInBlock(block, seed) {
  const buildings = [];
  const { w, d, distFromCenter } = block;
  const coreFactor = 1 - Math.min(distFromCenter / 300, 1);
  const numX = w > 50 ? 2 : 1;
  const numZ = d > 50 ? 2 : 1;
  const gapX = numX > 1 ? 3 : 0;
  const gapZ = numZ > 1 ? 3 : 0;
  const cellW = (w - gapX * (numX - 1)) / numX;
  const cellD = (d - gapZ * (numZ - 1)) / numZ;

  for (let ix = 0; ix < numX; ix++) {
    for (let iz = 0; iz < numZ; iz++) {
      const s = seed + ix * 17.3 + iz * 31.7;
      const h = hash2D(s, s * 0.7);
      const inset = 1 + h * 3;
      const bw = cellW - inset * 2;
      const bd = cellD - inset * 2;
      if (bw < 6 || bd < 6) continue;
      const baseH = 20 + coreFactor * 80;
      const varH = hash2D(s + 5.5, s - 3.3) * (60 + coreFactor * 200);
      const height = baseH + varH;
      const bx = block.x0 + ix * (cellW + gapX) + cellW / 2;
      const bz = block.z0 + iz * (cellD + gapZ) + cellD / 2;
      let matIdx;
      if (coreFactor > 0.7) matIdx = hash2D(s + 1, 2) > 0.4 ? 0 : 4;
      else if (coreFactor > 0.4) matIdx = Math.floor(hash2D(s + 2, 3) * 5) % 5;
      else matIdx = hash2D(s + 3, 4) > 0.5 ? 1 : 3;
      buildings.push({ x: bx, z: bz, w: bw, d: bd, height, matIdx, coreFactor, hash: h, blockIdx: buildings.length });
    }
  }
  return buildings;
}

// ── Camera path — street-level only ──────────────────────────────────────────
export function getCameraPath() {
  const EYE = 6;
  return {
    positions: [
      new THREE.Vector3(0, EYE, 310), new THREE.Vector3(0, EYE, 200),
      new THREE.Vector3(0, EYE, 80), new THREE.Vector3(0, EYE, 0),
      new THREE.Vector3(60, EYE, 0), new THREE.Vector3(120, EYE, 0),
      new THREE.Vector3(120, EYE, -30), new THREE.Vector3(120, EYE, -80),
      new THREE.Vector3(120, EYE, -140), new THREE.Vector3(60, EYE, -140),
      new THREE.Vector3(0, EYE, -140), new THREE.Vector3(-60, EYE, -140),
      new THREE.Vector3(-120, EYE, -140), new THREE.Vector3(-120, EYE, -80),
      new THREE.Vector3(-120, EYE, -30), new THREE.Vector3(-120, EYE, 0),
      new THREE.Vector3(-60, EYE, 0), new THREE.Vector3(0, EYE, 0),
      new THREE.Vector3(0, EYE, 80), new THREE.Vector3(0, EYE, 200),
    ],
    targets: [
      new THREE.Vector3(0, EYE - 1, 200), new THREE.Vector3(0, EYE - 1, 80),
      new THREE.Vector3(0, EYE - 1, 0), new THREE.Vector3(30, EYE - 1, 0),
      new THREE.Vector3(120, EYE - 1, 0), new THREE.Vector3(120, EYE - 1, -10),
      new THREE.Vector3(120, EYE - 1, -80), new THREE.Vector3(120, EYE - 1, -140),
      new THREE.Vector3(80, EYE - 1, -140), new THREE.Vector3(0, EYE - 1, -140),
      new THREE.Vector3(-60, EYE - 1, -140), new THREE.Vector3(-120, EYE - 1, -140),
      new THREE.Vector3(-120, EYE - 1, -100), new THREE.Vector3(-120, EYE - 1, -30),
      new THREE.Vector3(-120, EYE - 1, 0), new THREE.Vector3(-80, EYE - 1, 0),
      new THREE.Vector3(0, EYE - 1, 0), new THREE.Vector3(0, EYE - 1, 40),
      new THREE.Vector3(0, EYE - 1, 140), new THREE.Vector3(0, EYE - 1, 310),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE CITY
// ═══════════════════════════════════════════════════════════════════════════════

export function createCity(scene) {
  const cityGroup = new THREE.Group();
  cityGroup.name = "city";
  scene.add(cityGroup);

  const gltfLoader = new GLTFLoader();
  const dummy = new THREE.Object3D();
  const crosswalkTexture = createCrosswalkTexture();

  // #13: Different window textures per material
  const windowTexGlass = createWindowTexture(6, 28);    // tall narrow windows — skyscrapers
  const windowTexRes   = createWindowTexture(10, 16);   // many small windows — residential
  const windowTexMetal = createWindowTexture(5, 24);     // industrial
  const windowTexConc  = createWindowTexture(8, 18);     // brutalist
  const windowTexNeon  = createWindowTexture(7, 22);     // neon facade

  // ── PBR material sets ────────────────────────────────────────────────────
  const facadeGlassPBR = loadPBR(ASSETS.facadeGlass, 2, 6);
  const facadeResPBR = loadPBR(ASSETS.facadeRes, 2, 6);
  const metalPBR = loadPBR(ASSETS.metal, 3, 8);
  const concretePBR = loadPBR(ASSETS.concrete, 3, 6);
  const facadeNeonPBR = loadPBR(ASSETS.facadeNeon, 2, 6);

  const facadeMaterials = [
    new THREE.MeshStandardMaterial({
      ...facadeGlassPBR, color: "#d8e0f0", roughness: 0.25, metalness: 0.55,
      emissive: "#ffffff", emissiveMap: facadeGlassPBR.emissiveMap || windowTexGlass, emissiveIntensity: 1.0,
      normalScale: new THREE.Vector2(1.0, 1.0), envMapIntensity: 1.8,
    }),
    new THREE.MeshStandardMaterial({
      ...facadeResPBR, color: "#d0c0b0", roughness: 0.70, metalness: 0.10,
      emissive: "#ffffff", emissiveMap: windowTexRes, emissiveIntensity: 0.9,
      normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 0.6,
    }),
    new THREE.MeshStandardMaterial({
      ...metalPBR, color: "#b0b8c8", roughness: 0.35, metalness: 0.75,
      emissive: "#ffffff", emissiveMap: windowTexMetal, emissiveIntensity: 0.9,
      normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 1.4,
    }),
    new THREE.MeshStandardMaterial({
      ...concretePBR, color: "#b8c0c8", roughness: 0.60, metalness: 0.15,
      emissive: "#ffffff", emissiveMap: windowTexConc, emissiveIntensity: 0.9,
      normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.5,
    }),
    new THREE.MeshStandardMaterial({
      ...facadeNeonPBR, color: "#c8d0e8", roughness: 0.30, metalness: 0.50,
      emissive: "#ffffff", emissiveMap: facadeNeonPBR.emissiveMap || windowTexNeon, emissiveIntensity: 1.2,
      normalScale: new THREE.Vector2(1.0, 1.0), envMapIntensity: 1.6,
    }),
  ];

  // ── Generate city layout ─────────────────────────────────────────────────
  const blocks = generateBlocks();
  const allBuildings = [];
  blocks.forEach((block, bi) => {
    allBuildings.push(...generateBuildingsInBlock(block, bi * 7.7 + 3.3));
  });

  // ── Place buildings ──────────────────────────────────────────────────────
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const instanceCounts = [0, 0, 0, 0, 0];
  allBuildings.forEach(b => instanceCounts[b.matIdx]++);

  const buildingMeshes = facadeMaterials.map((mat, i) => {
    const count = Math.max(instanceCounts[i], 1);
    const m = new THREE.InstancedMesh(buildingGeometry, mat, count);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    cityGroup.add(m); return m;
  });

  const matCounters = [0, 0, 0, 0, 0];
  const buildingBounds = [];

  for (const b of allBuildings) {
    const idx = matCounters[b.matIdx];
    dummy.position.set(b.x, b.height / 2, b.z);
    dummy.scale.set(b.w, b.height, b.d);
    dummy.rotation.y = 0;
    dummy.updateMatrix();
    buildingMeshes[b.matIdx].setMatrixAt(idx, dummy.matrix);
    const facadeColor = new THREE.Color().setHSL(0.55 + b.hash * 0.18, 0.12 + b.hash * 0.15, 0.45 + b.coreFactor * 0.20);
    buildingMeshes[b.matIdx].setColorAt(idx, facadeColor);
    matCounters[b.matIdx]++;
    buildingBounds.push({ x: b.x, z: b.z, hw: b.w / 2 + 1, hd: b.d / 2 + 1 });
  }

  buildingMeshes.forEach((m, i) => {
    m.count = matCounters[i]; m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere();
  });

  // ── Rooftop details ──────────────────────────────────────────────────────
  const antennaMat = new THREE.MeshStandardMaterial({ color: "#304060", roughness: 0.4, metalness: 0.8 });
  const antennaGeo = new THREE.CylinderGeometry(0.15, 0.15, 1, 6);
  const tankMat = new THREE.MeshStandardMaterial({ color: "#3a4858", roughness: 0.6, metalness: 0.3 });
  const tankGeo = new THREE.CylinderGeometry(1.5, 1.5, 2.5, 8);

  for (let i = 0; i < allBuildings.length; i++) {
    const b = allBuildings[i];
    if (b.height < 60) continue;
    const h = hash2D(i + 10.1, 3.7);
    if (h < 0.35) {
      const aH = 5 + h * 20;
      const ant = new THREE.Mesh(antennaGeo, antennaMat);
      ant.scale.set(1, aH, 1);
      ant.position.set(b.x, b.height + aH * 0.5, b.z);
      cityGroup.add(ant);
      const blink = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6),
        new THREE.MeshBasicMaterial({ color: "#ff2020", transparent: true, opacity: 0.8 }));
      blink.position.set(b.x, b.height + aH, b.z);
      cityGroup.add(blink);
    } else if (h < 0.55) {
      const tank = new THREE.Mesh(tankGeo, tankMat);
      const ox = (hash2D(i + 1.2, 5.5) - 0.5) * b.w * 0.4;
      const oz = (hash2D(i + 2.3, 6.6) - 0.5) * b.d * 0.4;
      tank.position.set(b.x + ox, b.height + 1.25, b.z + oz);
      cityGroup.add(tank);
    }
  }

  // ── Ground plane ─────────────────────────────────────────────────────────
  const EXTENT = 800;
  const groundPBR = loadPBR(ASSETS.asphaltDmg, 20, 20);
  const groundMat = new THREE.MeshPhysicalMaterial({
    ...groundPBR, color: "#0a0e14", metalness: 0.2, roughness: 0.7,
    clearcoat: 0.2, clearcoatRoughness: 0.4,
    normalScale: new THREE.Vector2(0.3, 0.3),
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
  cityGroup.add(ground);

  // ── Roads ────────────────────────────────────────────────────────────────
  const ROAD_LEN = EXTENT * 2;

  // Shared materials — load textures once, reuse for all roads
  const roadPBR = loadPBR(ASSETS.asphalt, 4, ROAD_LEN / 16);
  const roadMat = new THREE.MeshPhysicalMaterial({
    ...roadPBR, color: "#404850", metalness: 0.05, roughness: 0.55,
    clearcoat: 0.25, clearcoatRoughness: 0.35,
    normalScale: new THREE.Vector2(0.6, 0.6),
  });

  const linePBR = loadPBR(ASSETS.roadLines, 1, ROAD_LEN / 10);
  const lineMat = new THREE.MeshStandardMaterial({
    ...linePBR, transparent: true, color: "#b0b8c0", roughness: 0.5, metalness: 0.0, depthWrite: false, opacity: 0.5,
  });

  // #11: Neon edge material — will be modulated by mood
  const neonEdgeMat = new THREE.MeshBasicMaterial({
    color: "#18d8ff", transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  for (const z of STREETS_Z) {
    const rw = getStreetWidth(z);
    const isMain = MAIN_STREETS_Z.has(z);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LEN, rw), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, z); road.receiveShadow = true;
    cityGroup.add(road);

    // #3: Thin center lane marking only
    const lines = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LEN, rw * 0.12), lineMat);
    lines.rotation.x = -Math.PI / 2; lines.position.set(0, 0.015, z);
    cityGroup.add(lines);

    if (isMain) {
      for (const off of [-rw / 2, rw / 2]) {
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LEN, 0.5), neonEdgeMat);
        edge.rotation.x = -Math.PI / 2; edge.position.set(0, 0.03, z + off);
        cityGroup.add(edge);
      }
    }
  }

  for (const x of AVENUES_X) {
    const rw = getAvenueWidth(x);
    const isMain = MAIN_AVENUES_X.has(x);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(rw, ROAD_LEN), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(x, 0.012, 0); road.receiveShadow = true;
    cityGroup.add(road);

    // #3: Thin center lane marking
    const lines = new THREE.Mesh(new THREE.PlaneGeometry(rw * 0.12, ROAD_LEN), lineMat);
    lines.rotation.x = -Math.PI / 2; lines.position.set(x, 0.017, 0);
    cityGroup.add(lines);

    if (isMain) {
      for (const off of [-rw / 2, rw / 2]) {
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.5, ROAD_LEN), neonEdgeMat);
        edge.rotation.x = -Math.PI / 2; edge.position.set(x + off, 0.03, 0);
        cityGroup.add(edge);
      }
    }
  }

  // ── #1: Crosswalks — properly sized and aligned at intersection edges ───
  const cwMat = new THREE.MeshBasicMaterial({ map: crosswalkTexture, transparent: true, opacity: 0.35, depthWrite: false });

  for (const x of AVENUES_X) {
    for (const z of STREETS_Z) {
      const sw = getStreetWidth(z);
      const aw = getAvenueWidth(x);

      // Crosswalk across the street (spans avenue width, at street edge)
      const cw1 = new THREE.Mesh(new THREE.PlaneGeometry(aw * 0.7, 3.5), cwMat);
      cw1.rotation.x = -Math.PI / 2;
      cw1.position.set(x, 0.022, z + sw / 2 + 2);
      cityGroup.add(cw1);

      // Crosswalk across the avenue (spans street width, at avenue edge)
      const cw2 = new THREE.Mesh(new THREE.PlaneGeometry(3.5, sw * 0.7), cwMat);
      cw2.rotation.x = -Math.PI / 2;
      cw2.position.set(x + aw / 2 + 2, 0.022, z);
      cityGroup.add(cw2);
    }
  }

  // ── #4: Sidewalks — darker, proper alignment ───────────────────────────
  const swPBR = loadPBR(ASSETS.paving, 3, 80);
  const sidewalkMat = new THREE.MeshStandardMaterial({
    ...swPBR, color: "#383c42", roughness: 0.75, metalness: 0.05,
    normalScale: new THREE.Vector2(0.8, 0.8),
  });
  const curbMat = new THREE.MeshStandardMaterial({ color: "#505860", roughness: 0.7, metalness: 0.1 });
  const curbGeo = new THREE.BoxGeometry(1, CURB_H, 0.4);

  for (const z of STREETS_Z) {
    const rw = getStreetWidth(z);
    for (const side of [-1, 1]) {
      const edge = z + side * rw / 2;
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LEN, SIDEWALK_W), sidewalkMat);
      sw.rotation.x = -Math.PI / 2;
      sw.position.set(0, 0.02, edge + side * (SIDEWALK_W / 2 + 0.2));
      sw.receiveShadow = true; cityGroup.add(sw);

      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.scale.set(ROAD_LEN, 1, 1);
      curb.position.set(0, CURB_H / 2, edge); cityGroup.add(curb);
    }
  }

  for (const x of AVENUES_X) {
    const rw = getAvenueWidth(x);
    for (const side of [-1, 1]) {
      const edge = x + side * rw / 2;
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(SIDEWALK_W, ROAD_LEN), sidewalkMat);
      sw.rotation.x = -Math.PI / 2;
      sw.position.set(edge + side * (SIDEWALK_W / 2 + 0.2), 0.02, 0);
      sw.receiveShadow = true; cityGroup.add(sw);

      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.scale.set(1, 1, ROAD_LEN); curb.rotation.y = Math.PI / 2;
      curb.position.set(edge, CURB_H / 2, 0); cityGroup.add(curb);
    }
  }

  // ── #2: Puddles — much darker, less reflective ─────────────────────────
  const puddleMat = new THREE.MeshPhysicalMaterial({
    color: "#000000", metalness: 0.3, roughness: 0.05,
    clearcoat: 1, clearcoatRoughness: 0.05,
    transparent: true, opacity: 0.15, envMapIntensity: 0.3,
  });
  const puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 16), puddleMat, 60);
  cityGroup.add(puddles);
  for (let i = 0; i < 60; i++) {
    const onStreet = i % 2 === 0;
    let px, pz;
    if (onStreet) {
      const st = STREETS_Z[Math.floor(hash2D(i, 1.1) * STREETS_Z.length)];
      px = (hash2D(i + 3, 2.2) - 0.5) * 500;
      pz = st + (hash2D(i + 5, 3.3) - 0.5) * getStreetWidth(st) * 0.6;
    } else {
      const av = AVENUES_X[Math.floor(hash2D(i, 4.4) * AVENUES_X.length)];
      px = av + (hash2D(i + 7, 5.5) - 0.5) * getAvenueWidth(av) * 0.6;
      pz = (hash2D(i + 9, 6.6) - 0.5) * 500;
    }
    dummy.position.set(px, 0.018, pz);
    dummy.rotation.set(-Math.PI / 2, 0, hash2D(i + 1.1, 9.7) * Math.PI);
    const r = 1.5 + hash2D(i + 3.2, 0.4) * 4;
    dummy.scale.set(r * 2, r, 1); dummy.updateMatrix();
    puddles.setMatrixAt(i, dummy.matrix);
  }
  puddles.instanceMatrix.needsUpdate = true;

  // ── Light spill ─────────────────────────────────────────────────────────
  const spillCount = Math.min(allBuildings.length * 2, 300);
  const spillInstances = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false }),
    spillCount);
  spillInstances.frustumCulled = false; cityGroup.add(spillInstances);
  for (let i = 0; i < spillCount; i++) {
    const src = allBuildings[i % allBuildings.length];
    const face = i % 4;
    const fo = (face % 2 === 0 ? src.w : src.d) * 0.5 + 8;
    const sx = src.x + (face % 2 === 0 ? 0 : (face < 2 ? fo : -fo));
    const sz = src.z + (face % 2 !== 0 ? 0 : (face < 2 ? fo : -fo));
    const fw = face % 2 === 0 ? src.w : src.d;
    dummy.position.set(sx, 0.015, sz);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(fw * 1.2, 12, 1); dummy.updateMatrix();
    spillInstances.setMatrixAt(i, dummy.matrix);
    spillInstances.setColorAt(i, sampleNeon(i + 5, src.hash - 0.3));
  }
  spillInstances.instanceMatrix.needsUpdate = true;
  if (spillInstances.instanceColor) spillInstances.instanceColor.needsUpdate = true;

  // ── #8: Street-level fog — more planes, positioned on camera path ──────
  const fogPlanes = [];
  const fogPlaneMat = new THREE.MeshBasicMaterial({
    color: "#2a1838", transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide,
  });
  // Place fog along the streets the camera travels
  const fogStreets = [0, -30, 30, -80, 80, -140, 140];
  const fogAvenues = [0, -60, 60, -120, 120];
  for (let i = 0; i < 25; i++) {
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(300, 10 + i * 0.5), fogPlaneMat.clone());
    fog.rotation.x = -Math.PI / 2;
    const useStreet = i < 14;
    const st = useStreet ? fogStreets[i % fogStreets.length] : 0;
    const av = useStreet ? 0 : fogAvenues[i % fogAvenues.length];
    fog.position.set(
      av + (hash2D(i, 9.9) - 0.5) * 200,
      1.5 + hash2D(i + 2, 7.7) * 3,
      st + (hash2D(i + 3, 1.1) - 0.5) * 200
    );
    cityGroup.add(fog);
    fogPlanes.push(fog);
  }

  // ── Cars ──────────────────────────────────────────────────────────────────
  const carColors = [
    "#2a2a4e", "#1e3050", "#1a4570", "#604898",
    "#4a1a3c", "#2b2b4f", "#223060", "#2a5088",
    "#e94560", "#e23e57", "#b03070", "#8060c0",
  ].map(c => new THREE.Color(c));

  const carGroup = new THREE.Group(); cityGroup.add(carGroup);
  const carData = [];

  function isInsideBuilding(px, pz) {
    for (const b of buildingBounds) {
      if (Math.abs(px - b.x) < b.hw && Math.abs(pz - b.z) < b.hd) return true;
    }
    return false;
  }

  const carPlacements = [];
  for (let i = 0; i < 80; i++) {
    const h1 = hash2D(i + 0.5, 3.7);
    const onStreet = i % 2 === 0;
    const direction = hash2D(i + 6.3, 1.4) > 0.5 ? 1 : -1;
    let px, pz, rw, roadCenter;
    if (onStreet) {
      const stIdx = Math.floor(h1 * STREETS_Z.length);
      roadCenter = STREETS_Z[stIdx];
      rw = getStreetWidth(roadCenter);
      const laneOffset = direction * (rw * 0.22);
      px = (hash2D(i + 4.2, 8.1) - 0.5) * 500;
      pz = roadCenter + laneOffset;
      if (isInsideBuilding(px, pz)) continue;
      carPlacements.push({ x: px, z: pz, onXRoad: true, direction, laneOffset, speed: 14 + hash2D(i + 1, 5) * 20, roadCenter, roadWidth: rw });
    } else {
      const avIdx = Math.floor(h1 * AVENUES_X.length);
      roadCenter = AVENUES_X[avIdx];
      rw = getAvenueWidth(roadCenter);
      const laneOffset = direction * (rw * 0.22);
      px = roadCenter + laneOffset;
      pz = (hash2D(i + 4.2, 8.1) - 0.5) * 500;
      if (isInsideBuilding(px, pz)) continue;
      carPlacements.push({ x: px, z: pz, onXRoad: false, direction, laneOffset, speed: 14 + hash2D(i + 1, 5) * 20, roadCenter, roadWidth: rw });
    }
  }

  function spawnCars(template) {
    for (let i = 0; i < carPlacements.length; i++) {
      const p = carPlacements[i];
      const carColor = carColors[i % carColors.length];
      let carMesh;

      if (template) {
        carMesh = template.clone();
        carMesh.traverse(child => {
          if (child.isMesh) {
            child.material = child.material.clone();
            child.material.color = carColor.clone();
            child.material.metalness = 0.7; child.material.roughness = 0.25;
            child.castShadow = true;
          }
        });
        carMesh.scale.setScalar(0.05);
      } else {
        carMesh = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: carColor, roughness: 0.25, metalness: 0.7 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 4.5), bodyMat); body.position.y = 0.6;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2.5),
          new THREE.MeshStandardMaterial({ color: carColor.clone().multiplyScalar(0.7), roughness: 0.3, metalness: 0.6 }));
        roof.position.set(0, 1.4, -0.3);
        const tailMat = new THREE.MeshBasicMaterial({ color: "#ff2020", transparent: true, opacity: 0.9 });
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), tailMat); tl.position.set(-0.8, 0.6, 2.3);
        const tr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), tailMat); tr.position.set(0.8, 0.6, 2.3);
        const headMat = new THREE.MeshBasicMaterial({ color: "#fffae0", transparent: true, opacity: 0.95 });
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), headMat); hl.position.set(-0.8, 0.55, -2.3);
        const hr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), headMat); hr.position.set(0.8, 0.55, -2.3);
        const glowMat = new THREE.MeshBasicMaterial({ color: "#fffae0", transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
        const gl = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 6), glowMat); gl.position.set(0, 0.6, -2.8);
        // #15: Car headlight PointLight
        const headlight = new THREE.PointLight("#fffae0", 5, 15, 2);
        headlight.position.set(0, 0.55, -2.8);
        carMesh.add(body, roof, tl, tr, hl, hr, gl, headlight);
      }

      carMesh.position.set(p.x, 0.02, p.z);
      if (p.onXRoad) carMesh.rotation.y = p.direction > 0 ? -Math.PI / 2 : Math.PI / 2;
      else carMesh.rotation.y = p.direction > 0 ? 0 : Math.PI;

      carGroup.add(carMesh);
      carData.push({ mesh: carMesh, ...p });
    }
  }

  gltfLoader.load(ASSETS.car, (gltf) => spawnCars(gltf.scene), undefined, () => spawnCars(null));

  // ── Street lamps ──────────────────────────────────────────────────────────
  const lampPosts = new THREE.Group(); cityGroup.add(lampPosts);
  const lampInstances = [];
  const lampGlowGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: "#aaefff", transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolMat = new THREE.MeshBasicMaterial({ color: "#305878", transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolGeo = new THREE.CircleGeometry(6, 16);

  const lampPositions = [];
  for (const z of STREETS_Z) {
    const rw = getStreetWidth(z);
    for (let x = -350; x <= 350; x += 60) {
      if (isInsideBuilding(x, z + rw / 2 + 3)) continue;
      lampPositions.push(new THREE.Vector3(x, 0, z + rw / 2 + 3));
    }
  }
  for (const x of AVENUES_X) {
    const rw = getAvenueWidth(x);
    for (let z = -350; z <= 350; z += 60) {
      if (isInsideBuilding(x + rw / 2 + 3, z)) continue;
      lampPositions.push(new THREE.Vector3(x + rw / 2 + 3, 0, z));
    }
  }

  const fallbackPoleMat = new THREE.MeshStandardMaterial({ color: "#1a2540", roughness: 0.4, metalness: 0.6 });
  const fallbackPoleGeo = new THREE.CylinderGeometry(0.12, 0.20, 7, 6);

  function placeLamps(template) {
    while (lampPosts.children.length) lampPosts.remove(lampPosts.children[0]);
    lampInstances.length = 0;
    for (const pos of lampPositions) {
      if (template) {
        const lamp = template.clone();
        lamp.scale.setScalar(3); lamp.position.copy(pos);
        lampPosts.add(lamp);
      } else {
        const pole = new THREE.Mesh(fallbackPoleGeo, fallbackPoleMat);
        pole.position.set(pos.x, 3.5, pos.z);
        lampPosts.add(pole);
      }
      const glow = new THREE.Mesh(lampGlowGeo, lampGlowMat.clone());
      glow.position.set(pos.x, 7.2, pos.z);
      lampPosts.add(glow);
      const pool = new THREE.Mesh(poolGeo, poolMat.clone());
      pool.rotation.x = -Math.PI / 2; pool.position.set(pos.x, 0.03, pos.z);
      lampPosts.add(pool);
      lampInstances.push({ glow, pool, phase: hash2D(pos.x, pos.z) * Math.PI * 2 });
    }
  }

  placeLamps(null);
  gltfLoader.load(ASSETS.lamp, (gltf) => {
    const t = gltf.scene;
    t.traverse(child => { if (child.isMesh) child.castShadow = true; });
    placeLamps(t);
  }, undefined, () => {});


  // ── Neon panels ────────────────────────────────────────────────────────
  const panelMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const panelCount = Math.min(allBuildings.length * 4, 500);
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.12), panelMaterial, panelCount);
  panels.frustumCulled = false; cityGroup.add(panels);

  for (let i = 0; i < panelCount; i++) {
    const src = allBuildings[i % allBuildings.length];
    if (src.height < 40) { dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); panels.setMatrixAt(i, dummy.matrix); continue; }
    const side = (i % 4) - 1.5, isDF = i % 2 === 0;
    const hb = 0.15 + hash2D(i, src.blockIdx + 1) * 0.7;
    const y = THREE.MathUtils.lerp(8, src.height - 8, hb);
    const off = isDF
      ? new THREE.Vector3((src.w * 0.5 + 0.15) * Math.sign(side), y, (hash2D(i + 1, src.blockIdx) - 0.5) * src.d * 0.7)
      : new THREE.Vector3((hash2D(i + 2, src.blockIdx) - 0.5) * src.w * 0.7, y, (src.d * 0.5 + 0.15) * Math.sign(side));
    dummy.position.set(src.x + off.x, off.y, src.z + off.z);
    dummy.scale.set(1.5 + hash2D(i + 1.7, src.blockIdx) * 4, 0.25 + hash2D(i + 3.2, src.blockIdx) * 1.5, 0.1);
    dummy.rotation.y = isDF ? Math.PI / 2 : 0; dummy.updateMatrix();
    panels.setMatrixAt(i, dummy.matrix);
    panels.setColorAt(i, sampleNeon(i, src.hash - 0.5));
  }
  panels.instanceMatrix.needsUpdate = true;
  if (panels.instanceColor) panels.instanceColor.needsUpdate = true;

  // ── Neon strips ────────────────────────────────────────────────────────
  const stripMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const stripCount = Math.min(allBuildings.length * 3, 400);
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 0.06), stripMat, stripCount);
  strips.frustumCulled = false; cityGroup.add(strips);

  for (let i = 0; i < stripCount; i++) {
    const src = allBuildings[i % allBuildings.length];
    if (src.height < 50) { dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); strips.setMatrixAt(i, dummy.matrix); continue; }
    const face = i % 4;
    const bandY = (0.1 + hash2D(i, src.blockIdx + 3) * 0.85) * src.height;
    const fw = face % 2 === 0 ? src.w : src.d;
    const fo = (face % 2 === 0 ? src.w : src.d) * 0.5 + 0.12;
    dummy.position.set(src.x + (face % 2 === 0 ? 0 : (face < 2 ? fo : -fo)), bandY, src.z + (face % 2 !== 0 ? 0 : (face < 2 ? fo : -fo)));
    dummy.rotation.y = face % 2 === 0 ? Math.PI / 2 : 0;
    dummy.scale.set(fw * 0.92, 0.08, 0.06); dummy.updateMatrix();
    strips.setMatrixAt(i, dummy.matrix);
    strips.setColorAt(i, sampleNeon(i + 2, hash2D(i + 4, src.blockIdx) - 0.5));
  }
  strips.instanceMatrix.needsUpdate = true;
  if (strips.instanceColor) strips.instanceColor.needsUpdate = true;

  // ── #8: Shop signs — larger, brighter, with colored point lights (#17) ──
  const shopNames = ["RAMEN", "CYBER BAR", "NOODLE", "SYNTH SHOP", "ARCADE", "MECH PARTS", "HOLO CAFE", "DRONE HUB", "NEXUS", "PULSE", "BYTE DINER", "GRID TECH", "FLUX", "VOID LOUNGE", "NOVA"];
  const shopColorSets = [["#0a0020", "#ff3df2"], ["#001020", "#19f9ff"], ["#100010", "#ff6030"], ["#000820", "#2e7bff"], ["#0a0008", "#ff98e8"], ["#001008", "#1cffd5"]];
  const shopSigns = [];
  const shopLights = []; // #17: colored point lights for signs

  for (let i = 0; i < Math.min(allBuildings.length, 60); i++) {
    const src = allBuildings[i];
    if (src.height < 30) continue;
    const colors = shopColorSets[i % shopColorSets.length];
    const tex = createShopSign(shopNames[i % shopNames.length], colors[0], colors[1]);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const face = i % 4, signY = 5.5 + hash2D(i, 3.3) * 3;
    // #8: Larger signs
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), mat);

    let signX, signZ;
    if (face % 2 === 0) {
      const fo = src.w * 0.5 + 0.4;
      signX = src.x + fo * (face === 0 ? 1 : -1);
      signZ = src.z + (hash2D(i + 5, 2.2) - 0.5) * src.d * 0.4;
      mesh.rotation.y = face === 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const fo = src.d * 0.5 + 0.4;
      signX = src.x + (hash2D(i + 5, 2.2) - 0.5) * src.w * 0.4;
      signZ = src.z + fo * (face === 1 ? 1 : -1);
      mesh.rotation.y = face === 1 ? 0 : Math.PI;
    }
    mesh.position.set(signX, signY, signZ);
    cityGroup.add(mesh);
    shopSigns.push({ mesh, phase: hash2D(i + 8, 1.1) * Math.PI * 2 });

    // #17: Colored point light below each sign
    const signColor = new THREE.Color(colors[1]);
    const signLight = new THREE.PointLight(signColor, 6, 12, 2);
    signLight.position.set(signX, signY - 2, signZ);
    cityGroup.add(signLight);
    shopLights.push(signLight);

    // Awning
    const ac = new THREE.Color(colors[1]).multiplyScalar(0.3);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 1),
      new THREE.MeshStandardMaterial({ color: ac, roughness: 0.6, metalness: 0.2, emissive: ac, emissiveIntensity: 0.3 }));
    awning.scale.set(face % 2 === 0 ? 3 : 11, 1, face % 2 === 0 ? 11 : 3);
    awning.position.set(
      signX + (face % 2 === 0 ? (face === 0 ? 1.2 : -1.2) : 0),
      signY + 2,
      signZ + (face % 2 !== 0 ? (face === 1 ? 1.2 : -1.2) : 0)
    );
    cityGroup.add(awning);
  }

  // ── Billboards ─────────────────────────────────────────────────────────
  const billboards = [];
  const bTex = [
    createHoloTexture("SYN", "#11e9ff", "#883bff"),
    createHoloTexture("XR", "#ff47d3", "#2d7bff"),
    createHoloTexture("ION", "#1cffd5", "#5140ff"),
    createHoloTexture("NEO", "#ff6030", "#ff20c0"),
    createHoloTexture("GRID", "#20f0ff", "#8840ff"),
  ];
  const tallBuildings = allBuildings.filter(b => b.height > 100);
  for (let i = 0; i < Math.min(tallBuildings.length, 18); i++) {
    const src = tallBuildings[i];
    const mat = new THREE.MeshBasicMaterial({
      map: bTex[i % bTex.length], color: sampleNeon(i, 0.08), transparent: true, opacity: 0.40,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), mat);
    mesh.position.set(
      src.x + (i % 2 === 0 ? src.w * 0.5 + 2 : -src.w * 0.5 - 2),
      Math.min(src.height * 0.5, src.height - 16),
      src.z + (hash2D(i, src.blockIdx) - 0.5) * src.d * 0.4
    );
    mesh.rotation.y = i % 2 === 0 ? -Math.PI / 2 : Math.PI / 2;
    cityGroup.add(mesh);
    billboards.push({ mesh, pulse: 0.8 + src.hash * 1.2, phase: src.hash * Math.PI * 2 });
  }

  // ── Beacons ────────────────────────────────────────────────────────────
  const beaconLights = [];
  for (let i = 0; i < Math.min(tallBuildings.length, 10); i++) {
    const src = tallBuildings[i];
    const color = sampleNeon(i + 1, 0.02);
    const light = new THREE.PointLight(color, 25, 150, 2);
    light.position.set(src.x, src.height + 8, src.z); cityGroup.add(light);
    const gm = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    gm.position.copy(light.position); cityGroup.add(gm);
    beaconLights.push({ light, glowMesh: gm, phase: src.hash * Math.PI * 2 });
  }

  // #12: No fountain at center intersection — removed

  // ── Animate ────────────────────────────────────────────────────────────
  return {
    group: cityGroup,
    allBuildings,
    buildingBounds,
    update(elapsedTime, mood = 1) {
      const flicker = 0.62 + 0.38 * Math.sin(elapsedTime * 1.7);
      panelMaterial.opacity = 0.03 + mood * 0.55 + 0.04 * flicker * mood;
      stripMat.opacity = 0.03 + mood * 0.50;
      spillInstances.material.opacity = 0.01 + mood * 0.05;

      // #16: Road clearcoat modulation — wetter at night
      roadMat.clearcoat = 0.15 + mood * 0.35;
      roadMat.color.setStyle(mood > 0.5 ? "#353a40" : "#484e56");
      groundMat.clearcoat = 0.2 + mood * 0.3;

      // #11: Neon edge lines fade during day
      neonEdgeMat.opacity = 0.02 + mood * 0.15;

      // Building emissive
      facadeMaterials.forEach(m => { m.emissiveIntensity = 0.15 + mood * 0.85; });

      for (const item of billboards) item.mesh.material.opacity = 0.02 + mood * 0.35 + Math.sin(elapsedTime * item.pulse + item.phase) * 0.04 * mood;
      for (const item of shopSigns) item.mesh.material.opacity = 0.08 + mood * 0.75 + Math.sin(elapsedTime * 2.1 + item.phase) * 0.06 * mood;

      // #17: Shop sign lights modulated by night
      for (const sl of shopLights) {
        sl.intensity = 0.5 + mood * 6;
      }

      for (const item of beaconLights) {
        const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 0.9 + item.phase);
        item.light.intensity = 2 + mood * (20 + 14 * pulse);
        item.glowMesh.material.opacity = 0.04 + mood * (0.55 + pulse * 0.15);
      }

      // #5: Lamp glow invisible during day, bright at night
      for (const lamp of lampInstances) {
        const gp = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(elapsedTime * 1.8 + lamp.phase));
        lamp.glow.material.opacity = 0.02 + mood * (0.55 + gp * 0.15);
        lamp.pool.material.opacity = 0.005 + mood * (0.05 + gp * 0.03);
      }

      // #18: Fog color shifts — warm purple at night, neutral during day
      const nightColor = new THREE.Color("#2a1838");
      const dayColor = new THREE.Color("#606870");
      const fogColor = nightColor.clone().lerp(dayColor, 1 - mood);
      for (const fp of fogPlanes) {
        fp.material.color.copy(fogColor);
        fp.material.opacity = 0.04 + mood * 0.06;
      }

      // Cars
      const limit = 400;
      for (const car of carData) {
        const step = car.speed * 0.016 * car.direction;
        if (car.onXRoad) {
          let nx = car.mesh.position.x + step;
          if (nx > limit) nx = -limit; if (nx < -limit) nx = limit;
          if (!isInsideBuilding(nx, car.roadCenter + car.laneOffset)) car.mesh.position.x = nx;
          else car.mesh.position.x += step * 3;
          car.mesh.position.z = car.roadCenter + car.laneOffset;
        } else {
          let nz = car.mesh.position.z + step;
          if (nz > limit) nz = -limit; if (nz < -limit) nz = limit;
          if (!isInsideBuilding(car.roadCenter + car.laneOffset, nz)) car.mesh.position.z = nz;
          else car.mesh.position.z += step * 3;
          car.mesh.position.x = car.roadCenter + car.laneOffset;
        }
      }
    },
  };
}
