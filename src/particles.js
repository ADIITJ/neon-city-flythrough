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
        pos.array[i * 3]     += Math.sin(i * 12.9898) * delta * 2.5;
        pos.array[i * 3 + 1] -= velocities[i] * delta;
        pos.array[i * 3 + 2] += Math.cos(i * 4.123) * delta * 8;
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
      mat.opacity = 0.004 + mood * 0.014;
    },
  };
}

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

        cl.mesh.material.opacity = cl.baseOpacity * dayBoost * proximity * 1.4;

        // Tint: blueish at night, white/cream in day
        const nightHue = new THREE.Color("#8090a8");
        const dayHue   = new THREE.Color("#d8e8f8");
        cl.mesh.material.color.copy(nightHue).lerp(dayHue, daylight);
      });
    },
  };
}
