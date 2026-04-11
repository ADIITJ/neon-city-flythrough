import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { fbm2D, hash2D, sampleNeon, smoothstep } from "./utils.js";

const ASSETS = {
  asphalt: {
    color: "assets/Asphalt012_1K-JPG/Asphalt012_1K-JPG_Color.jpg",
    normal: "assets/Asphalt012_1K-JPG/Asphalt012_1K-JPG_NormalGL.jpg",
    roughness: "assets/Asphalt012_1K-JPG/Asphalt012_1K-JPG_Roughness.jpg",
  },
  roadLines: {
    color: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_Color.jpg",
    normal: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_NormalGL.jpg",
    roughness: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_Roughness.jpg",
    opacity: "assets/RoadLines004_1K-JPG/RoadLines004_1K-JPG_Opacity.jpg",
  },
  paving: {
    color: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_Color.jpg",
    normal: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_NormalGL.jpg",
    roughness: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_Roughness.jpg",
    ao: "assets/PavingStones070_1K-JPG/PavingStones070_1K-JPG_AmbientOcclusion.jpg",
  },
  concrete: {
    color: "assets/Concrete034_1K-JPG/Concrete034_1K-JPG_Color.jpg",
    normal: "assets/Concrete034_1K-JPG/Concrete034_1K-JPG_NormalGL.jpg",
    roughness: "assets/Concrete034_1K-JPG/Concrete034_1K-JPG_Roughness.jpg",
  },
  facadeGlass: {
    color: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Color.jpg",
    normal: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_NormalGL.jpg",
    roughness: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Roughness.jpg",
    metalness: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Metalness.jpg",
    emission: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_Emission.jpg",
    ao: "assets/Facade018A_1K-JPG/Facade018A_1K-JPG_AmbientOcclusion.jpg",
  },
  facadeRes: {
    color: "assets/Facade001_1K-JPG/Facade001_1K-JPG_Color.jpg",
    normal: "assets/Facade001_1K-JPG/Facade001_1K-JPG_NormalGL.jpg",
    roughness: "assets/Facade001_1K-JPG/Facade001_1K-JPG_Roughness.jpg",
    metalness: "assets/Facade001_1K-JPG/Facade001_1K-JPG_Metalness.jpg",
  },
  metal: {
    color: "assets/Metal032_1K-JPG/Metal032_1K-JPG_Color.jpg",
    normal: "assets/Metal032_1K-JPG/Metal032_1K-JPG_NormalGL.jpg",
    roughness: "assets/Metal032_1K-JPG/Metal032_1K-JPG_Roughness.jpg",
    metalness: "assets/Metal032_1K-JPG/Metal032_1K-JPG_Metalness.jpg",
  },
  car: "assets/Car.glb",
  lamp: "assets/sci-fi_street_lamp.glb",
  cyberpunkCity: "assets/cyberpunk_city.glb",
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

function createWindowTexture() {
  const W = 256, H = 512, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#080c14"; ctx.fillRect(0, 0, W, H);
  const COLS = 8, ROWS = 20, cw = W / COLS, ch = H / ROWS;
  ctx.strokeStyle = "rgba(30,40,55,0.6)"; ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(W, r * ch); ctx.stroke(); }
  ctx.strokeStyle = "rgba(25,35,50,0.4)";
  for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, H); ctx.stroke(); }
  const ww = Math.floor(cw * 0.60), wh = Math.floor(ch * 0.55), px = Math.floor((cw - ww) / 2), py = Math.floor((ch - wh) / 2);
  const warm = ["#ffe9b0", "#ffd88a", "#fff4c0", "#ffcea0", "#ffe0b8"];
  const cool = ["#a8e0ff", "#90d8ff", "#b0eeff", "#d0a8ff", "#ff98e8", "#80f8f0"];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
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
  ctx.fillStyle = "#c8d0d8"; ctx.globalAlpha = 0.55;
  for (let i = 0; i < 8; i++) ctx.fillRect(0, i * 32 + 4, 128, 18);
  ctx.globalAlpha = 1;
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

function createShopSign(label, bg, fg) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, cv.width, 0); g.addColorStop(0, bg); g.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.shadowColor = fg; ctx.shadowBlur = 8; ctx.strokeStyle = fg; ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, cv.width - 12, cv.height - 12);
  ctx.font = "700 42px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = fg; ctx.shadowBlur = 15; ctx.fillText(label, cv.width / 2, cv.height / 2); ctx.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true; return tex;
}

export function createCity(scene) {
  const cityGroup = new THREE.Group(); cityGroup.name = "city"; scene.add(cityGroup);

  const gridSize = 20, spacing = 52, roadWidth = 22, sidewalkWidth = 5, avenueWidth = 32;
  const halfGrid = gridSize / 2, extent = gridSize * spacing + 200, roadLen = extent;
  const halfRoad = roadWidth / 2, halfAve = avenueWidth / 2;

  const windowTexture = createWindowTexture();
  const crosswalkTexture = createCrosswalkTexture();
  const gltfLoader = new GLTFLoader();
  const dummy = new THREE.Object3D();

  // ── PBR textures ───────────────────────────────────────────────────────
  const asphaltPBR = loadPBR(ASSETS.asphalt, 6, 80);
  const pavingPBR = loadPBR(ASSETS.paving, 4, 80);
  const concretePBR = loadPBR(ASSETS.concrete, 3, 6);
  const facadeGlassPBR = loadPBR(ASSETS.facadeGlass, 2, 6);
  const facadeResPBR = loadPBR(ASSETS.facadeRes, 2, 6);
  const metalPBR = loadPBR(ASSETS.metal, 3, 8);

  // ── Building materials — brighter, more emissive, visible at night ─────
  const facadeMaterials = [
    new THREE.MeshStandardMaterial({
      map: facadeGlassPBR.map, normalMap: facadeGlassPBR.normalMap, roughnessMap: facadeGlassPBR.roughnessMap,
      metalnessMap: facadeGlassPBR.metalnessMap, aoMap: facadeGlassPBR.aoMap,
      color: "#d8e0f0", roughness: 0.25, metalness: 0.55,
      emissive: "#ffffff", emissiveMap: facadeGlassPBR.emissiveMap || windowTexture, emissiveIntensity: 1.0,
      normalScale: new THREE.Vector2(1.0, 1.0), envMapIntensity: 1.8,
    }),
    new THREE.MeshStandardMaterial({
      map: facadeResPBR.map, normalMap: facadeResPBR.normalMap, roughnessMap: facadeResPBR.roughnessMap,
      metalnessMap: facadeResPBR.metalnessMap,
      color: "#d0c0b0", roughness: 0.70, metalness: 0.10,
      emissive: "#ffffff", emissiveMap: windowTexture, emissiveIntensity: 0.9,
      normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 0.6,
    }),
    new THREE.MeshStandardMaterial({
      map: metalPBR.map, normalMap: metalPBR.normalMap, roughnessMap: metalPBR.roughnessMap,
      metalnessMap: metalPBR.metalnessMap,
      color: "#b0b8c8", roughness: 0.35, metalness: 0.75,
      emissive: "#ffffff", emissiveMap: windowTexture, emissiveIntensity: 0.9,
      normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 1.4,
    }),
    new THREE.MeshStandardMaterial({
      map: concretePBR.map, normalMap: concretePBR.normalMap, roughnessMap: concretePBR.roughnessMap,
      color: "#b8c0c8", roughness: 0.60, metalness: 0.15,
      emissive: "#ffffff", emissiveMap: windowTexture, emissiveIntensity: 0.9,
      normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.5,
    })
  ];

  // ── Buildings ──────────────────────────────────────────────────────────
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const instanceCount = gridSize * gridSize;
  const buildingMeshes = facadeMaterials.map(mat => {
    const m = new THREE.InstancedMesh(buildingGeometry, mat, instanceCount);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    cityGroup.add(m); return m;
  });
  const buildingIndices = [0, 0, 0, 0];
  const buildingData = [];

  // Store building bounding boxes for car collision avoidance
  const buildingBounds = [];

  for (let gx = -halfGrid; gx < halfGrid; gx++) {
    for (let gz = -halfGrid; gz < halfGrid; gz++) {
      const x = gx * spacing, z = gz * spacing;
      const isAvenue = Math.abs(gx) % 5 === 0 || Math.abs(gz) % 5 === 0;
      const density = fbm2D((gx + 100) * 0.13, (gz - 45) * 0.13, 5);
      const core = 1 - Math.min(Math.sqrt(x * x + z * z) / 420, 1);
      const skyline = smoothstep(0.10, 0.95, density * 0.65 + core * 1.05);
      const maxSize = spacing - roadWidth - sidewalkWidth * 2 - 2;
      const width = 10 + hash2D(gx, gz) * Math.min(maxSize - 10, 18);
      const depth = 10 + hash2D(gx - 4.7, gz + 5.4) * Math.min(maxSize - 10, 16);
      const minH = isAvenue ? 25 : 45;
      const height = minH + skyline * 250 + hash2D(gx + 77.4, gz - 41.3) * 120;

      dummy.position.set(x, height * 0.5, z);
      dummy.scale.set(width, height, depth);
      dummy.rotation.y = hash2D(gx + 9.1, gz + 2.5) * 0.03;
      dummy.updateMatrix();

      const matIdx = Math.floor(hash2D(gx + 3.3, gz + 7.7) * 4) % 4;
      const mesh = buildingMeshes[matIdx];
      const idx = buildingIndices[matIdx];
      mesh.setMatrixAt(idx, dummy.matrix);

      // Brighter instance colors so textures show well
      const facadeColor = new THREE.Color().setHSL(
        0.55 + hash2D(gx + 0.9, gz + 0.2) * 0.18,
        0.12 + hash2D(gx - 3.2, gz + 2.1) * 0.15,
        0.45 + skyline * 0.20
      );
      mesh.setColorAt(idx, facadeColor);
      buildingIndices[matIdx]++;

      buildingData.push({
        index: idx, matIdx, position: new THREE.Vector3(x, height * 0.5, z),
        width, depth, height, skyline, hash: hash2D(gx * 1.37, gz * 1.91)
      });

      // Building footprint for collision — with margin
      buildingBounds.push({ x, z, hw: width / 2 + 1, hd: depth / 2 + 1 });
    }
  }

  buildingMeshes.forEach((m, i) => {
    m.count = buildingIndices[i]; m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere();
  });

  // ── Rooftop details — antennas, water tanks, spires ────────────────────
  const antennaMat = new THREE.MeshStandardMaterial({ color: "#304060", roughness: 0.4, metalness: 0.8 });
  const antennaGeo = new THREE.CylinderGeometry(0.15, 0.15, 1, 6);
  const tankMat = new THREE.MeshStandardMaterial({ color: "#3a4858", roughness: 0.6, metalness: 0.3 });
  const tankGeo = new THREE.CylinderGeometry(1.5, 1.5, 2.5, 8);

  for (let i = 0; i < buildingData.length; i++) {
    const b = buildingData[i];
    if (b.height < 80) continue;
    const h = hash2D(i + 10.1, 3.7);
    if (h < 0.35) {
      // Antenna
      const aH = 5 + h * 20;
      const ant = new THREE.Mesh(antennaGeo, antennaMat);
      ant.scale.set(1, aH, 1);
      ant.position.set(b.position.x, b.height + aH * 0.5, b.position.z);
      cityGroup.add(ant);
      // Blinking light on top
      const blink = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6),
        new THREE.MeshBasicMaterial({ color: "#ff2020", transparent: true, opacity: 0.8 }));
      blink.position.set(b.position.x, b.height + aH, b.position.z);
      cityGroup.add(blink);
    } else if (h < 0.55) {
      // Water tank
      const tank = new THREE.Mesh(tankGeo, tankMat);
      const ox = (hash2D(i + 1.2, 5.5) - 0.5) * b.width * 0.4;
      const oz = (hash2D(i + 2.3, 6.6) - 0.5) * b.depth * 0.4;
      tank.position.set(b.position.x + ox, b.height + 1.25, b.position.z + oz);
      cityGroup.add(tank);
    }
  }

  // ── Ground plane — dark asphalt base ──────────────────────────────────
  const groundAsphalt = loadPBR(ASSETS.asphalt, 20, 20);
  const groundMat = new THREE.MeshPhysicalMaterial({
    map: groundAsphalt.map, normalMap: groundAsphalt.normalMap, roughnessMap: groundAsphalt.roughnessMap,
    color: "#0a0e14", metalness: 0.2, roughness: 0.7,
    clearcoat: 0.2, clearcoatRoughness: 0.4,
    normalScale: new THREE.Vector2(0.3, 0.3),
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(extent, extent), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
  cityGroup.add(ground);

  // ── Roads — asphalt PBR, continuous highway look ──────────────────────
  const makeRoadMat = () => {
    const p = loadPBR(ASSETS.asphalt, 4, roadLen / 16);
    return new THREE.MeshPhysicalMaterial({
      map: p.map, normalMap: p.normalMap, roughnessMap: p.roughnessMap,
      color: "#404850", metalness: 0.05, roughness: 0.55,
      clearcoat: 0.25, clearcoatRoughness: 0.35,
      normalScale: new THREE.Vector2(0.6, 0.6),
    });
  };

  // Lane markings
  const makeLineMat = (ry) => {
    const p = loadPBR(ASSETS.roadLines, 1, ry);
    return new THREE.MeshStandardMaterial({
      map: p.map, normalMap: p.normalMap, alphaMap: p.alphaMap,
      transparent: true, color: "#e0e8f0", roughness: 0.5, metalness: 0.0, depthWrite: false,
    });
  };

  for (let i = -halfGrid; i <= halfGrid; i++) {
    const isAve = Math.abs(i) % 5 === 0;
    const rw = isAve ? avenueWidth : roadWidth;

    // X-roads
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, rw), makeRoadMat());
    rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.01, i * spacing); rx.receiveShadow = true;
    cityGroup.add(rx);
    const lx = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, rw * 0.6), makeLineMat(roadLen / 10));
    lx.rotation.x = -Math.PI / 2; lx.position.set(0, 0.015, i * spacing);
    cityGroup.add(lx);

    // Z-roads
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(rw, roadLen), makeRoadMat());
    rz.rotation.x = -Math.PI / 2; rz.position.set(i * spacing, 0.012, 0); rz.receiveShadow = true;
    cityGroup.add(rz);
    const lz = new THREE.Mesh(new THREE.PlaneGeometry(rw * 0.6, roadLen), makeLineMat(roadLen / 10));
    lz.rotation.x = -Math.PI / 2; lz.position.set(i * spacing, 0.017, 0);
    cityGroup.add(lz);

    // Neon edges on avenues
    if (isAve) {
      const edgeMat = new THREE.MeshBasicMaterial({ color: "#18d8ff", transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
      for (const off of [-rw / 2, rw / 2]) {
        const ex = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 0.4), edgeMat);
        ex.rotation.x = -Math.PI / 2; ex.position.set(0, 0.03, i * spacing + off); cityGroup.add(ex);
        const ez = new THREE.Mesh(new THREE.PlaneGeometry(0.4, roadLen), edgeMat);
        ez.rotation.x = -Math.PI / 2; ez.position.set(i * spacing + off, 0.03, 0); cityGroup.add(ez);
      }
    }
  }

  // ── Crosswalks ────────────────────────────────────────────────────────
  const cwMat = new THREE.MeshBasicMaterial({ map: crosswalkTexture, transparent: true, opacity: 0.45, depthWrite: false });
  for (let gx = -halfGrid; gx <= halfGrid; gx += 3) {
    for (let gz = -halfGrid; gz <= halfGrid; gz += 3) {
      const rw = Math.abs(gx) % 5 === 0 ? avenueWidth : roadWidth;
      const cw = new THREE.Mesh(new THREE.PlaneGeometry(rw, 6), cwMat);
      cw.rotation.x = -Math.PI / 2; cw.position.set(gx * spacing, 0.025, gz * spacing + spacing * 0.5); cityGroup.add(cw);
      const cw2 = new THREE.Mesh(new THREE.PlaneGeometry(6, rw), cwMat);
      cw2.rotation.x = -Math.PI / 2; cw2.position.set(gx * spacing + spacing * 0.5, 0.025, gz * spacing); cityGroup.add(cw2);
    }
  }

  // ── Sidewalks — PBR paving tile, proper tiled look ─────────────────────
  const swPBR = loadPBR(ASSETS.paving, 3, 80);
  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: swPBR.map, normalMap: swPBR.normalMap, roughnessMap: swPBR.roughnessMap, aoMap: swPBR.aoMap,
    color: "#606870", roughness: 0.70, metalness: 0.05,
    normalScale: new THREE.Vector2(0.8, 0.8),
  });
  const curbMat = new THREE.MeshStandardMaterial({ color: "#808890", roughness: 0.7, metalness: 0.1 });
  const curbGeo = new THREE.BoxGeometry(1, 0.15, 0.4);

  for (let i = -halfGrid; i <= halfGrid; i++) {
    const isAve = Math.abs(i) % 5 === 0;
    const rw = isAve ? avenueWidth : roadWidth;
    for (const side of [-1, 1]) {
      const edge = i * spacing + side * rw / 2;

      // Sidewalk surface
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, sidewalkWidth), sidewalkMat);
      sw.rotation.x = -Math.PI / 2; sw.position.set(0, 0.02, edge + side * (sidewalkWidth / 2 + 0.2)); sw.receiveShadow = true;
      cityGroup.add(sw);
      const sw2 = new THREE.Mesh(new THREE.PlaneGeometry(sidewalkWidth, roadLen), sidewalkMat);
      sw2.rotation.x = -Math.PI / 2; sw2.position.set(i * spacing + side * (rw / 2 + sidewalkWidth / 2 + 0.2), 0.02, 0); sw2.receiveShadow = true;
      cityGroup.add(sw2);

      // Raised curb (3D box, thin)
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.scale.set(roadLen, 1, 1);
      curb.position.set(0, 0.075, edge); cityGroup.add(curb);
      const curb2 = new THREE.Mesh(curbGeo, curbMat);
      curb2.scale.set(1, 1, roadLen); curb2.rotation.y = Math.PI / 2;
      curb2.position.set(i * spacing + side * rw / 2, 0.075, 0); cityGroup.add(curb2);
    }
  }

  // ── Light spill ───────────────────────────────────────────────────────
  const spillGeo = new THREE.PlaneGeometry(1, 1);
  const spillInstances = new THREE.InstancedMesh(spillGeo,
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false }), 200);
  spillInstances.frustumCulled = false; cityGroup.add(spillInstances);
  for (let i = 0; i < 200; i++) {
    const src = buildingData[(i * 3) % buildingData.length];
    const face = i % 4;
    const fo = (face % 2 === 0 ? src.width : src.depth) * 0.5 + roadWidth * 0.35;
    const sx = src.position.x + (face % 2 === 0 ? 0 : (face < 2 ? fo : -fo));
    const sz = src.position.z + (face % 2 !== 0 ? 0 : (face < 2 ? fo : -fo));
    const fw = face % 2 === 0 ? src.width : src.depth;
    dummy.position.set(sx, 0.015, sz); dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(fw * 1.2, roadWidth * 0.6, 1); dummy.updateMatrix();
    spillInstances.setMatrixAt(i, dummy.matrix);
    spillInstances.setColorAt(i, sampleNeon(i + 5, hash2D(i, src.index) - 0.3));
  }
  spillInstances.instanceMatrix.needsUpdate = true;
  if (spillInstances.instanceColor) spillInstances.instanceColor.needsUpdate = true;

  // ── Puddles — dark, subtle reflections ─────────────────────────────────
  const puddleMat = new THREE.MeshPhysicalMaterial({
    color: "#040810", metalness: 0.85, roughness: 0.08,
    clearcoat: 1, clearcoatRoughness: 0.05,
    transparent: true, opacity: 0.25, envMapIntensity: 0.8,
  });
  const puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 16), puddleMat, 80);
  cityGroup.add(puddles);
  for (let i = 0; i < 80; i++) {
    const roadIdx = Math.floor(hash2D(i + 2.1, 4.5) * gridSize) - halfGrid;
    const along = (hash2D(i + 7.3, 1.2) - 0.5) * roadLen * 0.6;
    dummy.position.set(i % 2 === 0 ? along : roadIdx * spacing, 0.018, i % 2 === 0 ? roadIdx * spacing : along);
    dummy.rotation.set(-Math.PI / 2, 0, hash2D(i + 1.1, 9.7) * Math.PI);
    const r = 1.5 + hash2D(i + 3.2, 0.4) * 4;
    dummy.scale.set(r * 2, r, 1); dummy.updateMatrix();
    puddles.setMatrixAt(i, dummy.matrix);
  }
  puddles.instanceMatrix.needsUpdate = true;

  // ── Volumetric fog planes at street level ──────────────────────────────
  const fogPlaneMat = new THREE.MeshBasicMaterial({
    color: "#1a2840", transparent: true, opacity: 0.04, depthWrite: false, side: THREE.DoubleSide
  });
  for (let i = 0; i < 8; i++) {
    const fogPlane = new THREE.Mesh(new THREE.PlaneGeometry(roadLen * 0.6, 12), fogPlaneMat);
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.set((hash2D(i, 9.9) - 0.5) * 400, 2 + i * 0.5, (hash2D(i + 3, 1.1) - 0.5) * 400);
    cityGroup.add(fogPlane);
  }

  // ── Cars — follow roads, avoid buildings ───────────────────────────────
  const carColors = [
    "#2a2a4e", "#1e3050", "#1a4570", "#604898",
    "#4a1a3c", "#2b2b4f", "#223060", "#2a5088",
    "#e94560", "#e23e57", "#b03070", "#8060c0"
  ].map(c => new THREE.Color(c));

  const carGroup = new THREE.Group(); cityGroup.add(carGroup);
  const carData = [];
  const carCount = 100;

  function isInsideBuilding(px, pz) {
    for (const b of buildingBounds) {
      if (Math.abs(px - b.x) < b.hw && Math.abs(pz - b.z) < b.hd) return true;
    }
    return false;
  }

  const carPlacements = [];
  for (let i = 0; i < carCount; i++) {
    const roadIdx = Math.floor(hash2D(i + 0.5, 3.7) * gridSize) - halfGrid;
    const along = (hash2D(i + 4.2, 8.1) - 0.5) * roadLen * 0.6;
    const onXRoad = i % 2 === 0;
    const isAve = Math.abs(roadIdx) % 5 === 0;
    const rw = isAve ? avenueWidth : roadWidth;
    const direction = hash2D(i + 6.3, 1.4) > 0.5 ? 1 : -1;
    const laneOffset = direction * (rw * 0.22);
    const px = onXRoad ? along : roadIdx * spacing + laneOffset;
    const pz = onXRoad ? roadIdx * spacing + laneOffset : along;

    // Skip if car would spawn inside a building
    if (isInsideBuilding(px, pz)) continue;

    const speed = 14 + hash2D(i + 1.1, 5.5) * 20;
    carPlacements.push({ x: px, z: pz, onXRoad, direction, laneOffset, speed, roadWidth: rw, roadIdx });
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
        // Headlight glow
        const glowMat = new THREE.MeshBasicMaterial({ color: "#fffae0", transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
        const gl = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 6), glowMat); gl.position.set(0, 0.6, -2.8);
        carMesh.add(body, roof, tl, tr, hl, hr, gl);
      }

      carMesh.position.set(p.x, 0.02, p.z);
      if (p.onXRoad) carMesh.rotation.y = p.direction > 0 ? -Math.PI / 2 : Math.PI / 2;
      else carMesh.rotation.y = p.direction > 0 ? 0 : Math.PI;

      carGroup.add(carMesh);
      carData.push({ mesh: carMesh, ...p });
    }
  }

  gltfLoader.load(ASSETS.car, (gltf) => spawnCars(gltf.scene), undefined, () => spawnCars(null));

  // ── Sci-fi street lamps (GLB) ──────────────────────────────────────────
  const lampPosts = new THREE.Group(); cityGroup.add(lampPosts);
  const lampInstances = [];
  const lampGlowGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: "#aaefff", transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolMat = new THREE.MeshBasicMaterial({ color: "#305878", transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolGeo = new THREE.CircleGeometry(6, 16);

  // Positions for lamps — along sidewalks
  const lampPositions = [];
  for (let i = -halfGrid; i <= halfGrid; i += 2) {
    for (let j = -halfGrid; j <= halfGrid; j += 4) {
      const isAve = Math.abs(i) % 5 === 0;
      const rw = isAve ? avenueWidth : roadWidth;
      lampPositions.push(new THREE.Vector3(i * spacing + rw / 2 + 2, 0, j * spacing));
      lampPositions.push(new THREE.Vector3(j * spacing, 0, i * spacing + rw / 2 + 2));
    }
  }

  // Use fallback procedural lamps immediately, replace with GLB when loaded
  let lampTemplate = null;
  const fallbackPoleMat = new THREE.MeshStandardMaterial({ color: "#1a2540", roughness: 0.4, metalness: 0.6 });
  const fallbackPoleGeo = new THREE.CylinderGeometry(0.12, 0.20, 7, 6);

  function placeLamps(template) {
    // Clear existing
    while (lampPosts.children.length) lampPosts.remove(lampPosts.children[0]);

    for (const pos of lampPositions) {
      if (template) {
        const lamp = template.clone();
        lamp.scale.setScalar(3);
        lamp.position.copy(pos);
        lampPosts.add(lamp);
      } else {
        const pole = new THREE.Mesh(fallbackPoleGeo, fallbackPoleMat);
        pole.position.set(pos.x, 3.5, pos.z);
        lampPosts.add(pole);
      }

      // Glow sphere at lamp top
      const glow = new THREE.Mesh(lampGlowGeo, lampGlowMat.clone());
      glow.position.set(pos.x, 7.2, pos.z);
      lampPosts.add(glow);

      // Light pool on ground
      const pool = new THREE.Mesh(poolGeo, poolMat.clone());
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(pos.x, 0.03, pos.z);
      lampPosts.add(pool);

      lampInstances.push({ glow, pool, phase: hash2D(pos.x, pos.z) * Math.PI * 2 });
    }
  }

  // Place fallback lamps immediately
  placeLamps(null);

  // Load GLB lamp and replace
  gltfLoader.load(ASSETS.lamp,
    (gltf) => {
      lampTemplate = gltf.scene;
      lampTemplate.traverse(child => { if (child.isMesh) child.castShadow = true; });
      placeLamps(lampTemplate);
    },
    undefined,
    () => {} // fallback already placed
  );

  // ── Cyberpunk city GLB background ──────────────────────────────────────
  gltfLoader.load(ASSETS.cyberpunkCity,
    (gltf) => {
      const m = gltf.scene; m.scale.setScalar(0.5); m.position.set(0, -2, -400);
      m.traverse(child => {
        if (child.isMesh) {
          child.receiveShadow = true;
          if (child.material) { child.material = child.material.clone(); child.material.emissiveIntensity = (child.material.emissiveIntensity || 0) * 0.6; }
        }
      });
      cityGroup.add(m);
    },
    undefined, () => {}
  );

  // ── Neon panels ───────────────────────────────────────────────────────
  const panelMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const panelCount = 500;
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.12), panelMaterial, panelCount);
  panels.frustumCulled = false; cityGroup.add(panels);

  for (let i = 0; i < panelCount; i++) {
    const src = buildingData[(i * 13) % buildingData.length];
    if (src.height < 100 || src.skyline < 0.35) { dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); panels.setMatrixAt(i, dummy.matrix); continue; }
    const side = (i % 4) - 1.5, isDF = i % 2 === 0;
    const hb = 0.15 + hash2D(i, src.index) * 0.7;
    const y = THREE.MathUtils.lerp(8, src.height - 8, hb);
    const off = isDF
      ? new THREE.Vector3((src.width * 0.5 + 0.15) * Math.sign(side), y - src.height * 0.5, (hash2D(i + 1, src.index) - 0.5) * src.depth * 0.7)
      : new THREE.Vector3((hash2D(i + 2, src.index) - 0.5) * src.width * 0.7, y - src.height * 0.5, (src.depth * 0.5 + 0.15) * Math.sign(side));
    dummy.position.copy(src.position.clone().add(off));
    dummy.scale.set(1.5 + hash2D(i + 1.7, src.index) * 4, 0.25 + hash2D(i + 3.2, src.index) * 1.5, 0.1);
    dummy.rotation.y = isDF ? Math.PI / 2 : 0; dummy.updateMatrix();
    panels.setMatrixAt(i, dummy.matrix); panels.setColorAt(i, sampleNeon(i, src.hash - 0.5));
  }
  panels.instanceMatrix.needsUpdate = true;
  if (panels.instanceColor) panels.instanceColor.needsUpdate = true;

  // ── Shop signs ────────────────────────────────────────────────────────
  const shopNames = ["RAMEN", "CYBER BAR", "NOODLE", "SYNTH SHOP", "ARCADE", "MECH PARTS", "HOLO CAFÉ", "DRONE HUB", "NEXUS", "PULSE", "BYTE DINER", "GRID TECH", "FLUX", "VOID LOUNGE", "NOVA"];
  const shopColors = [["#0a0020", "#ff3df2"], ["#001020", "#19f9ff"], ["#100010", "#ff6030"], ["#000820", "#2e7bff"], ["#0a0008", "#ff98e8"], ["#001008", "#1cffd5"]];
  const shopSigns = [];
  const awningGeo = new THREE.BoxGeometry(1, 0.08, 1);

  for (let i = 0; i < 50; i++) {
    const src = buildingData[(i * 11 + 3) % buildingData.length];
    if (src.height < 50) continue;
    const colors = shopColors[i % shopColors.length];
    const tex = createShopSign(shopNames[i % shopNames.length], colors[0], colors[1]);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.80, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const face = i % 4, signY = 5.5 + hash2D(i, 3.3) * 3;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.2), mat);
    let signX, signZ;
    if (face % 2 === 0) {
      const fo = src.width * 0.5 + 0.4;
      signX = src.position.x + fo * (face === 0 ? 1 : -1); signZ = src.position.z + (hash2D(i + 5, 2.2) - 0.5) * src.depth * 0.4;
      mesh.rotation.y = face === 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const fo = src.depth * 0.5 + 0.4;
      signX = src.position.x + (hash2D(i + 5, 2.2) - 0.5) * src.width * 0.4; signZ = src.position.z + fo * (face === 1 ? 1 : -1);
      mesh.rotation.y = face === 1 ? 0 : Math.PI;
    }
    mesh.position.set(signX, signY, signZ); cityGroup.add(mesh);
    shopSigns.push({ mesh, phase: hash2D(i + 8, 1.1) * Math.PI * 2 });

    const ac = new THREE.Color(colors[1]).multiplyScalar(0.3);
    const awning = new THREE.Mesh(awningGeo, new THREE.MeshStandardMaterial({ color: ac, roughness: 0.6, metalness: 0.2, emissive: ac, emissiveIntensity: 0.3 }));
    awning.scale.set(face % 2 === 0 ? 3 : 9, 1, face % 2 === 0 ? 9 : 3);
    awning.position.set(signX + (face % 2 === 0 ? (face === 0 ? 1.2 : -1.2) : 0), signY + 1.5, signZ + (face % 2 !== 0 ? (face === 1 ? 1.2 : -1.2) : 0));
    cityGroup.add(awning);
  }

  // ── Billboards ────────────────────────────────────────────────────────
  const billboards = [];
  const bTex = [createHoloTexture("SYN", "#11e9ff", "#883bff"), createHoloTexture("XR", "#ff47d3", "#2d7bff"), createHoloTexture("ION", "#1cffd5", "#5140ff"), createHoloTexture("NEO", "#ff6030", "#ff20c0"), createHoloTexture("GRID", "#20f0ff", "#8840ff")];
  for (let i = 0; i < 18; i++) {
    const src = buildingData[(i * 29) % buildingData.length];
    if (src.height < 120 || src.skyline < 0.5) continue;
    const mat = new THREE.MeshBasicMaterial({ map: bTex[i % bTex.length], color: sampleNeon(i, 0.08), transparent: true, opacity: 0.40, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), mat);
    mesh.position.set(src.position.x + (i % 2 === 0 ? src.width * 0.5 + 2 : -src.width * 0.5 - 2), Math.min(src.height * 0.5, src.height - 16), src.position.z + (hash2D(i, src.index) - 0.5) * src.depth * 0.4);
    mesh.rotation.y = i % 2 === 0 ? -Math.PI / 2 : Math.PI / 2;
    cityGroup.add(mesh); billboards.push({ mesh, pulse: 0.8 + src.hash * 1.2, phase: src.hash * Math.PI * 2 });
  }

  // ── Beacons ───────────────────────────────────────────────────────────
  const beaconLights = [];
  for (let i = 0; i < 10; i++) {
    const src = buildingData[(i * 41) % buildingData.length];
    const color = sampleNeon(i + 1, 0.02);
    const light = new THREE.PointLight(color, 25, 150, 2);
    light.position.set(src.position.x, src.height + 8, src.position.z); cityGroup.add(light);
    const gm = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    gm.position.copy(light.position); cityGroup.add(gm);
    beaconLights.push({ light, glowMesh: gm, phase: src.hash * Math.PI * 2 });
  }

  // ── Neon strips ───────────────────────────────────────────────────────
  const stripMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 0.06), stripMat, 400);
  strips.frustumCulled = false; cityGroup.add(strips);
  for (let i = 0; i < 400; i++) {
    const src = buildingData[(i * 7) % buildingData.length];
    if (src.height < 70 || src.skyline < 0.25) { dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); strips.setMatrixAt(i, dummy.matrix); continue; }
    const face = i % 4;
    const bandY = src.position.y - src.height * 0.5 + (0.1 + hash2D(i, src.index + 3) * 0.85) * src.height;
    const fw = face % 2 === 0 ? src.width : src.depth;
    const fo = (face % 2 === 0 ? src.width : src.depth) * 0.5 + 0.12;
    dummy.position.set(src.position.x + (face % 2 === 0 ? 0 : (face < 2 ? fo : -fo)), bandY, src.position.z + (face % 2 !== 0 ? 0 : (face < 2 ? fo : -fo)));
    dummy.rotation.y = face % 2 === 0 ? Math.PI / 2 : 0; dummy.scale.set(fw * 0.92, 0.08, 0.06); dummy.updateMatrix();
    strips.setMatrixAt(i, dummy.matrix); strips.setColorAt(i, sampleNeon(i + 2, hash2D(i + 4, src.index) - 0.5));
  }
  strips.instanceMatrix.needsUpdate = true;
  if (strips.instanceColor) strips.instanceColor.needsUpdate = true;

  // ── Fountain ──────────────────────────────────────────────────────────
  const waterMat = new THREE.MeshPhysicalMaterial({ color: "#061828", metalness: 0.95, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, transparent: true, opacity: 0.8, emissive: "#0a2040", emissiveIntensity: 0.15 });
  const fountain = new THREE.Mesh(new THREE.CircleGeometry(15, 32), waterMat);
  fountain.rotation.x = -Math.PI / 2; fountain.position.set(0, 0.04, 0); cityGroup.add(fountain);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 0.6, 8, 32), new THREE.MeshStandardMaterial({ color: "#2a3448", roughness: 0.5, metalness: 0.4 }));
  rim.rotation.x = -Math.PI / 2; rim.position.set(0, 0.3, 0); cityGroup.add(rim);

  // ── Animate ───────────────────────────────────────────────────────────
  return {
    group: cityGroup, buildingData,
    update(elapsedTime, mood = 1) {
      const flicker = 0.62 + 0.38 * Math.sin(elapsedTime * 1.7);
      panelMaterial.opacity = 0.03 + mood * 0.55 + 0.04 * flicker * mood;
      stripMat.opacity = 0.03 + mood * 0.50;
      groundMat.clearcoat = 0.2 + mood * 0.3;
      spillInstances.material.opacity = 0.01 + mood * 0.05;

      // Building emissive — stronger at night for visible windows
      facadeMaterials.forEach(m => { m.emissiveIntensity = 0.15 + mood * 0.85; });

      for (const item of billboards) item.mesh.material.opacity = 0.02 + mood * 0.35 + Math.sin(elapsedTime * item.pulse + item.phase) * 0.04 * mood;
      for (const item of shopSigns) item.mesh.material.opacity = 0.05 + mood * 0.65 + Math.sin(elapsedTime * 2.1 + item.phase) * 0.06 * mood;
      for (const item of beaconLights) {
        const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 0.9 + item.phase);
        item.light.intensity = 2 + mood * (20 + 14 * pulse);
        item.glowMesh.material.opacity = 0.04 + mood * (0.55 + pulse * 0.15);
      }
      for (const lamp of lampInstances) {
        const gp = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(elapsedTime * 1.8 + lamp.phase));
        lamp.glow.material.opacity = 0.05 + mood * (0.50 + gp * 0.15);
        lamp.pool.material.opacity = 0.01 + mood * (0.05 + gp * 0.03);
      }

      // Cars — straight along road axis, skip over building zones
      const limit = roadLen * 0.45;
      for (const car of carData) {
        const step = car.speed * 0.016 * car.direction;
        if (car.onXRoad) {
          let nx = car.mesh.position.x + step;
          if (nx > limit) nx = -limit; if (nx < -limit) nx = limit;
          // Skip building intersections
          if (!isInsideBuilding(nx, car.roadIdx * spacing + car.laneOffset)) car.mesh.position.x = nx;
          else car.mesh.position.x += step * 3; // teleport past
          car.mesh.position.z = car.roadIdx * spacing + car.laneOffset;
        } else {
          let nz = car.mesh.position.z + step;
          if (nz > limit) nz = -limit; if (nz < -limit) nz = limit;
          if (!isInsideBuilding(car.roadIdx * spacing + car.laneOffset, nz)) car.mesh.position.z = nz;
          else car.mesh.position.z += step * 3;
          car.mesh.position.x = car.roadIdx * spacing + car.laneOffset;
        }
      }

      waterMat.emissiveIntensity = 0.08 + mood * 0.12 + Math.sin(elapsedTime * 1.2) * 0.04;
    }
  };
}
