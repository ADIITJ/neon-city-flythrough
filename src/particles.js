import * as THREE from "three";
import { sampleNeon } from "./utils.js";

// ── Richer cloud texture with multiple layered puffs ──────────────────────
function makeCloudTex() {
  const W = 512, H = 256, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.clearRect(0, 0, W, H);

  // Multiple overlapping ellipses for a fluffy look
  const puffs = [
    [256, 128, 180, 80, 0.90], [180, 110, 100, 55, 0.70],
    [340, 115, 110, 52, 0.68], [130, 140, 80, 40, 0.55],
    [390, 145, 75, 38, 0.52], [256, 155, 140, 45, 0.45],
    [210, 100, 60, 30, 0.40], [300, 105, 65, 32, 0.40],
  ];
  for (const [cx, cy, rx, ry, alpha] of puffs) {
    const g = c.createRadialGradient(cx, cy, rx * 0.1, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.5, `rgba(240,245,255,${alpha * 0.5})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.save(); c.scale(1, ry / rx); c.beginPath();
    c.arc(cx, cy * (rx / ry), rx, 0, Math.PI * 2); c.fill(); c.restore();
  }

  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

// ── Rain ─────────────────────────────────────────────────────────────────────
export function createRainSystem() {
  const count = 2500;
  const positions  = new Float32Array(count * 3);
  const velocities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 500;
    positions[i * 3 + 1] = Math.random() * 280;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 500;
    velocities[i] = 120 + Math.random() * 160;
  }

  // Precompute per-particle wind sway to avoid Math.sin/cos per frame
  const windX = new Float32Array(count);
  const windZ = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    windX[i] = Math.sin(i * 12.9898) * 2.5;
    windZ[i] = Math.cos(i * 4.123) * 8;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: "#88d4ff", size: 0.22, transparent: true, opacity: 0.1,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;

  return {
    object: pts,
    update(delta, anchor) {
      const pos = geo.attributes.position;
      for (let i = 0; i < count; i++) {
        pos.array[i * 3]     += windX[i] * delta;
        pos.array[i * 3 + 1] -= velocities[i] * delta;
        pos.array[i * 3 + 2] += windZ[i] * delta;
        if (pos.array[i * 3 + 1] < 0) {
          pos.array[i * 3 + 1] = 180 + Math.random() * 100;
          pos.array[i * 3]     = (Math.random() - 0.5) * 280;
          pos.array[i * 3 + 2] = (Math.random() - 0.5) * 280;
        }
      }
      pos.needsUpdate = true;
      pts.position.set(anchor.x, 0, anchor.z);
    },
  };
}

// ── Atmosphere dust ───────────────────────────────────────────────────────────
export function createAtmosphereLayers(scene) {
  const group = new THREE.Group(); scene.add(group);
  const N = 380;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);

  for (let i = 0; i < N; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 500;
    pos[i * 3 + 1] = Math.random() * 80;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 500;
    const c = sampleNeon(i, -0.3);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color",    new THREE.BufferAttribute(col, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.5, vertexColors: true, transparent: true, opacity: 0.012,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });

  const dust = new THREE.Points(geo, mat); dust.frustumCulled = false; group.add(dust);

  return {
    group,
    update(elapsed, camPos, mood) {
      dust.rotation.y = elapsed * 0.018;
      dust.position.set(camPos.x, 15, camPos.z);
      mat.opacity = 0.010 + mood * 0.012;
    },
  };
}

// Hoisted Color constants for cloud tinting
const _cloudNightHue = new THREE.Color("#8090a8");
const _cloudDayHue   = new THREE.Color("#d8e8f8");

// ── Cloud layer ───────────────────────────────────────────────────────────────
// Camera descends from y=400 through clouds (y=180–280) to street (y=6)
// Clouds are fixed in world space so camera flies through them
export function createCloudLayer(scene) {
  const group = new THREE.Group(); scene.add(group);
  const cloudTex = makeCloudTex();
  const clouds = [];

  // Two layers: a high thin layer and a thicker mid layer
  // Camera enters the thick layer around y=260–220 and exits below y=160
  const cloudConfigs = [
    // HIGH LAYER (y = 260–310) — thin cirrus-like, spread wide
    ...Array.from({ length: 12 }, (_, i) => ({ y: 270 + Math.random() * 40, scale: 2.5 + Math.random() * 2.0, opacity: 0.12 + Math.random() * 0.1, size: [220, 90] })),
    // THICK LAYER (y = 180–255) — main cloud bank camera flies through
    ...Array.from({ length: 20 }, (_, i) => ({ y: 190 + Math.random() * 60, scale: 1.5 + Math.random() * 2.5, opacity: 0.28 + Math.random() * 0.18, size: [240, 100] })),
    // LOW WISPS (y = 100–180) — thinning cloud tails after descent
    ...Array.from({ length: 8 }, (_, i) => ({ y: 110 + Math.random() * 60, scale: 1.2 + Math.random() * 1.5, opacity: 0.08 + Math.random() * 0.08, size: [180, 70] })),
  ];

  cloudConfigs.forEach((cfg, i) => {
    // Each cloud puff = 2 cross-planes (X and Z oriented) for volume from all angles
    const cx = (Math.random() - 0.5) * 1400;
    const cy = cfg.y + (Math.random() - 0.5) * 20;
    const cz = (Math.random() - 0.5) * 1400;

    for (let p = 0; p < 2; p++) {
      const mat = new THREE.MeshBasicMaterial({
        map: cloudTex, transparent: true, opacity: cfg.opacity * (0.45 + Math.random() * 0.35),
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.size[0], cfg.size[1]), mat);
      mesh.position.set(cx, cy, cz);
      // p=0: face viewer from front (xz plane, slightly tilted), p=1: cross-plane rotated 90°
      mesh.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.25;
      mesh.rotation.y = p * Math.PI / 2 + Math.random() * 0.4;
      mesh.scale.setScalar(cfg.scale);
      group.add(mesh);
      clouds.push({ mesh, drift: 2 + Math.random() * 6, phase: Math.random() * Math.PI * 2, baseMat: mat, baseOpacity: cfg.opacity });
    }
  });

  return {
    group,
    update(elapsed, camPos, daylight) {
      // Clouds stay mostly world-fixed, drift very slowly
      clouds.forEach(cl => {
        cl.mesh.position.x += Math.sin(elapsed * 0.015 + cl.phase) * cl.drift * 0.01;
        cl.mesh.position.z += Math.cos(elapsed * 0.012 + cl.phase) * cl.drift * 0.008;

        const camDist = Math.abs(camPos.y - cl.mesh.position.y);

        // Only visible when camera is reasonably close to cloud altitude (within 180 units)
        // This prevents ray/slab artifacts when viewed from extreme angles above
        const proximity = 1 - THREE.MathUtils.clamp(camDist / 180, 0, 1);
        const dayBoost = 0.3 + daylight * 0.7;

        cl.mesh.material.opacity = cl.baseOpacity * dayBoost * proximity * 1.8;

        // Tint: blueish at night, white/cream in day
        cl.mesh.material.color.copy(_cloudNightHue).lerp(_cloudDayHue, daylight);
      });
    },
  };
}

// ── Fountain spray ──────────────────────────────────────────────────────────
// Multi-jet water spray: central geyser + 8 arced ring jets + splash mist
export function createFountainSpray(scene) {
  // Central jet: 150 particles, tall and narrow
  // Ring jets: 8 jets × 30 particles each = 240, arcing outward
  // Splash mist: 110 particles, low and wide around basin rim
  const CENTRAL = 150, RING = 240, SPLASH = 110;
  const count = CENTRAL + RING + SPLASH;
  const positions  = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const lifetimes  = new Float32Array(count);
  const sizes      = new Float32Array(count);

  function resetCentral(i) {
    // Gentle central column from spire tip — stays close to fountain
    positions[i * 3]     = (Math.random() - 0.5) * 0.3;
    positions[i * 3 + 1] = 6.5 + Math.random() * 0.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    velocities[i * 3]     = (Math.random() - 0.5) * 0.6;
    velocities[i * 3 + 1] = 3 + Math.random() * 3; // gentle upward, peaks ~2-3 units above spire
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    lifetimes[i] = 0.4 + Math.random() * 0.6;
    sizes[i] = 0.20 + Math.random() * 0.15;
  }

  function resetRing(i, elapsed) {
    // 8 jets evenly spaced around upper tier rim (radius ~4.3)
    const jetIndex = Math.floor((i - CENTRAL) / 30);
    const jetAngle = (jetIndex / 8) * Math.PI * 2 + (elapsed || 0) * 0.15;
    const r = 4.3;
    positions[i * 3]     = Math.cos(jetAngle) * r + (Math.random() - 0.5) * 0.2;
    positions[i * 3 + 1] = 1.9 + Math.random() * 0.15;
    positions[i * 3 + 2] = Math.sin(jetAngle) * r + (Math.random() - 0.5) * 0.2;
    // Low arc outward — peaks ~1.5 units above rim, lands in lower basin
    const outSpeed = 2.0 + Math.random() * 1.5;
    velocities[i * 3]     = Math.cos(jetAngle) * outSpeed;
    velocities[i * 3 + 1] = 2.5 + Math.random() * 2.0;
    velocities[i * 3 + 2] = Math.sin(jetAngle) * outSpeed;
    lifetimes[i] = 0.4 + Math.random() * 0.5;
    sizes[i] = 0.15 + Math.random() * 0.12;
  }

  function resetSplash(i) {
    // Low mist around basin rim where ring jets land
    const a = Math.random() * Math.PI * 2;
    const r = 7 + Math.random() * 3.5;
    positions[i * 3]     = Math.cos(a) * r;
    positions[i * 3 + 1] = 0.8 + Math.random() * 0.2;
    positions[i * 3 + 2] = Math.sin(a) * r;
    velocities[i * 3]     = (Math.random() - 0.5) * 1.0;
    velocities[i * 3 + 1] = 0.3 + Math.random() * 0.8;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.0;
    lifetimes[i] = 0.8 + Math.random() * 1.2;
    sizes[i] = 0.35 + Math.random() * 0.25;
  }

  for (let i = 0; i < count; i++) {
    if (i < CENTRAL) resetCentral(i);
    else if (i < CENTRAL + RING) resetRing(i, 0);
    else resetSplash(i);
    lifetimes[i] = Math.random() * 1.5; // stagger
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    color: "#90e8ff", size: 0.3, transparent: true, opacity: 0.40,
    depthWrite: false, blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  let elapsedTotal = 0;
  return {
    object: pts,
    update(delta, nightFactor) {
      elapsedTotal += delta;
      const pos = geo.attributes.position;
      for (let i = 0; i < count; i++) {
        lifetimes[i] -= delta;
        if (lifetimes[i] <= 0) {
          if (i < CENTRAL) resetCentral(i);
          else if (i < CENTRAL + RING) resetRing(i, elapsedTotal);
          else resetSplash(i);
          continue;
        }
        pos.array[i * 3]     += velocities[i * 3] * delta;
        pos.array[i * 3 + 1] += velocities[i * 3 + 1] * delta;
        pos.array[i * 3 + 2] += velocities[i * 3 + 2] * delta;
        // Gravity — stronger for central jet, lighter for splash mist
        const grav = i < CENTRAL ? 16 : i < CENTRAL + RING ? 14 : 4;
        velocities[i * 3 + 1] -= grav * delta;
        // Air resistance on horizontal for splash mist
        if (i >= CENTRAL + RING) {
          velocities[i * 3]     *= 0.98;
          velocities[i * 3 + 2] *= 0.98;
        }
        // Reset if fallen below water surface
        if (pos.array[i * 3 + 1] < 0.5) {
          if (i < CENTRAL) resetCentral(i);
          else if (i < CENTRAL + RING) resetRing(i, elapsedTotal);
          else resetSplash(i);
        }
      }
      pos.needsUpdate = true;
      mat.opacity = 0.30 + nightFactor * 0.20;
      mat.size = 0.3 + Math.sin(elapsedTotal * 0.5) * 0.05;
    },
  };
}
