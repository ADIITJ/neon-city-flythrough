import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { createCity } from "./city.js";
import { createFlyThroughCamera } from "./camera.js";
import { createPostProcessing } from "./effects.js";
import { createAtmosphereLayers, createCloudLayer, createRainSystem, createFountainSpray } from "./particles.js";

const canvas = document.querySelector("#app");
const scene  = new THREE.Scene();
scene.background = new THREE.Color("#04080f");
scene.fog = new THREE.FogExp2("#04080f", 0.0006); // Exponential fog — natural depth falloff

// Sky color presets
const daySky   = new THREE.Color("#6ab4dc");
const nightSky = new THREE.Color("#04080f");
const tempColor = new THREE.Color();

// FOV 55 — dramatic perspective compression
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.8, 2400);

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap at 1.5 for perf
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

// Smarter rendering: only update shadow maps when needed
let shadowUpdateCounter = 0;

// ── EXR Environment maps ─────────────────────────────────────────────────────
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
let nightEnv = null, dayEnv = null, envLoaded = 0;
const exrLoader = new EXRLoader();

exrLoader.load("assets/dikhololo_night_1k.exr", tex => {
  tex.mapping = THREE.EquirectangularReflectionMapping;
  nightEnv = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); envLoaded++;
  if (envLoaded >= 2) pmrem.dispose();
  if (!scene.environment) scene.environment = nightEnv;
});
exrLoader.load("assets/kloppenheim_02_1k.exr", tex => {
  tex.mapping = THREE.EquirectangularReflectionMapping;
  dayEnv = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); envLoaded++;
  if (envLoaded >= 2) pmrem.dispose();
});

// ── Stars ─────────────────────────────────────────────────────────────────────
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(4000 * 3);
for (let i = 0; i < 4000; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = 1600 + Math.random() * 300;
  starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 50;
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({
  color: "#e8f0ff", size: 1.6, sizeAttenuation: false,
  transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
});
const starPoints = new THREE.Points(starGeo, starMat);
scene.add(starPoints);

// ── Moon — visible high up when camera starts descent ─────────────────────────
// Positioned NW, at high altitude, visible during opening sky shot
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(16, 32, 32),
  new THREE.MeshBasicMaterial({ color: "#7898b8" })
);
moonMesh.position.set(-300, 280, -600);
scene.add(moonMesh);

const moonGlow = new THREE.Mesh(
  new THREE.SphereGeometry(28, 24, 24),
  new THREE.MeshBasicMaterial({ color: "#304878", transparent: true, opacity: 0.07, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
moonGlow.position.copy(moonMesh.position);
scene.add(moonGlow);

// ── Sun — orbits in an arc, sets toward camera look direction ─────────────────
const SUN_ORBIT_R = 1200; // radius of sun orbit
const SUN_PEAK_Y  = 500;  // max altitude at noon

const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(55, 24, 24),
  new THREE.MeshBasicMaterial({ color: "#fff6c0", transparent: true, opacity: 0.0 })
);
scene.add(sunMesh);

const sunHalo = new THREE.Mesh(
  new THREE.SphereGeometry(100, 24, 24),
  new THREE.MeshBasicMaterial({ color: "#ffe060", transparent: true, opacity: 0.0, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
scene.add(sunHalo);

// Sunset glow — large warm disc visible when sun is near horizon
const sunsetGlow = new THREE.Mesh(
  new THREE.SphereGeometry(200, 16, 16),
  new THREE.MeshBasicMaterial({ color: "#ff4020", transparent: true, opacity: 0.0, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
scene.add(sunsetGlow);

// ── Lights ─────────────────────────────────────────────────────────────────────
const ambient = new THREE.HemisphereLight("#a8ccf0", "#080610", 0.9);
scene.add(ambient);

const moonLight = new THREE.DirectionalLight("#8ab0e0", 2.2);
moonLight.position.copy(moonMesh.position);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024); // 1024 not 2048 — faster
moonLight.shadow.camera.near = 1; moonLight.shadow.camera.far = 1600;
moonLight.shadow.camera.left = -500; moonLight.shadow.camera.right = 500;
moonLight.shadow.camera.top  = 500;  moonLight.shadow.camera.bottom = -500;
scene.add(moonLight);

const sunLight = new THREE.DirectionalLight("#fff0c0", 0.0);
sunLight.position.set(0, SUN_PEAK_Y, 0);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 2000;
sunLight.shadow.camera.left = -500; sunLight.shadow.camera.right = 500;
sunLight.shadow.camera.top  = 500;  sunLight.shadow.camera.bottom = -500;
scene.add(sunLight);

// Accent point lights — orbit at mid altitude, colour the cityscape
const rimLight  = new THREE.PointLight("#e040d0", 0, 1000, 2); rimLight.position.set(0, 45, 0); scene.add(rimLight);
const fillLight = new THREE.PointLight("#30b0ff", 0, 1200, 2); fillLight.position.set(0, 38, 200); scene.add(fillLight);
const cyaLight  = new THREE.PointLight("#00e8ff", 0, 1400, 2); cyaLight.position.set(0, 52, 0); scene.add(cyaLight);
const magLight  = new THREE.PointLight("#e040d0", 0, 1400, 2); magLight.position.set(-300, 48, -160); scene.add(magLight);

// ── Scene objects ─────────────────────────────────────────────────────────────
const city       = createCity(scene);
const rain       = createRainSystem(); scene.add(rain.object);
const fountain   = createFountainSpray(scene);
const atmosphere = createAtmosphereLayers(scene);
const clouds     = createCloudLayer(scene);
const flyThrough = createFlyThroughCamera(camera);
const post       = createPostProcessing(renderer, scene, camera, { width: window.innerWidth, height: window.innerHeight });

const clock = new THREE.Clock();
let elapsed = 0;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  post.resize(window.innerWidth, window.innerHeight);
});

// ── Hoisted Color constants (avoid per-frame allocation) ──────────────────────
const _fogNight = new THREE.Color("#04080f");
const _fogDay   = new THREE.Color("#7ab4cc");
const _bgNight  = new THREE.Color("#04080f");
const _bgDay    = new THREE.Color("#5a9ec8");
const _sunsetSky = new THREE.Color("#e06830");
const _sunsetFog = new THREE.Color("#c04820");
// Scratch vectors for sun orbit (avoid per-frame allocation)
const _lookDir  = new THREE.Vector3();
const _perpDir  = new THREE.Vector3();
const _sunDir   = new THREE.Vector3();
const _negPerp  = new THREE.Vector3();

// Day/night cycle bar DOM refs
const cycleMarker = document.getElementById("cycleMarker");

// Cycle period — 180s for full day→night→day
const CYCLE_PERIOD = 180;

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05); // Cap delta — prevents spiral on tab-switch
  elapsed += delta;

  // Day/night cycle — full cycle in CYCLE_PERIOD seconds
  // Phase PI/2 so it starts day, goes night at midpoint, returns to day
  const cycle = 0.5 + 0.5 * Math.sin(elapsed * (2 * Math.PI / CYCLE_PERIOD) + Math.PI / 2);
  const daylight    = THREE.MathUtils.smoothstep(cycle, 0.18, 0.82);
  const nightFactor = 1.0 - daylight;

  // Cycle bar — linear with time, 0%=day start, 50%=midnight, 100%=day again
  const cycleProgress = (elapsed % CYCLE_PERIOD) / CYCLE_PERIOD;
  cycleMarker.style.left = `${cycleProgress * 100}%`;
  // Marker color: warm when day, cool when night
  cycleMarker.style.background = daylight > 0.5 ? "#ffe080" : "#8090c0";
  cycleMarker.style.boxShadow = daylight > 0.5
    ? "0 0 6px rgba(255,220,100,0.6)" : "0 0 6px rgba(100,140,220,0.6)";

  const camState = flyThrough.update(elapsed, daylight);
  const camH = camera.position.y;

  // Smarter fog: exponential, density based on altitude
  // High up → thin fog; street level → denser haze
  const altFactor = THREE.MathUtils.clamp(camH / 300, 0, 1);
  const fogDensity = THREE.MathUtils.lerp(0.0012, 0.0003, altFactor);
  scene.fog.density = fogDensity * (1 + nightFactor * 0.4);
  scene.fog.color.copy(_fogNight).lerp(_fogDay, daylight);
  scene.background.copy(tempColor.copy(_bgNight).lerp(_bgDay, daylight));
  // Sunset tint is applied after sun orbit computes sunsetTint (deferred below)

  // Env map swap — only when daylight crosses threshold
  if (daylight > 0.5 && dayEnv  && scene.environment !== dayEnv)  scene.environment = dayEnv;
  if (daylight < 0.5 && nightEnv && scene.environment !== nightEnv) scene.environment = nightEnv;

  // Environment intensity
  if (scene.environment) scene.environmentIntensity = 0.35 + daylight * 0.65;

  // ── Sun orbit — arcs across sky, sets toward camera look direction ───
  // sunAngle: 0=horizon(rise), PI/2=zenith, PI=horizon(set), beyond=below
  // cycle goes 1→0→1 via sin; map to sun elevation angle
  // At cycle=1 (day peak): sun at zenith. At cycle=0.5: sun at horizon.
  // At cycle<0.5: sun below horizon (night).
  const sunSine = THREE.MathUtils.clamp(cycle * 2 - 1, -1, 1);
  const sunElevation = Math.asin(sunSine);
  const sunY = sunSine * SUN_PEAK_Y;
  // Sun orbits in the horizontal plane toward camera's look target
  _lookDir.copy(camState.lookTarget).sub(camState.position).setY(0).normalize();
  const sunHoriz = Math.cos(sunElevation) * SUN_ORBIT_R;
  // horizBlend: 1 at horizon (sunset/sunrise), 0 at zenith
  const horizBlend = 1 - Math.abs(sunElevation) / (Math.PI / 2);
  _perpDir.set(-_lookDir.z, 0, _lookDir.x).normalize();
  // Rising: sun from the left. Setting: sun swings toward camera forward.
  const rising = cycle > 0.5;
  if (rising) {
    _sunDir.copy(_perpDir).lerp(_lookDir, horizBlend * 0.6);
  } else {
    _negPerp.copy(_perpDir).negate();
    _sunDir.copy(_lookDir).lerp(_negPerp, 1 - horizBlend * 0.7);
  }
  _sunDir.normalize();

  sunMesh.position.set(
    camState.position.x + _sunDir.x * sunHoriz,
    Math.max(sunY, -200),
    camState.position.z + _sunDir.z * sunHoriz
  );
  sunHalo.position.copy(sunMesh.position);
  sunsetGlow.position.copy(sunMesh.position);
  sunLight.position.copy(sunMesh.position);

  // Sun visibility
  const sunVisible = sunY > -50;
  sunMesh.visible = sunVisible;
  sunHalo.visible = sunVisible;
  sunMesh.material.opacity = THREE.MathUtils.clamp(daylight * 1.2, 0, 0.95);
  sunHalo.material.opacity = THREE.MathUtils.clamp(daylight * 0.5, 0, 0.4);

  // Sunset glow — strongest when sun is near horizon (horizBlend close to 1)
  const sunsetIntensity = horizBlend * daylight * (1 - daylight) * 4; // peaks at transition
  sunsetGlow.material.opacity = THREE.MathUtils.clamp(sunsetIntensity * 0.25, 0, 0.18);
  // Tint sky warmer during sunset
  const sunsetTint = THREE.MathUtils.clamp(sunsetIntensity, 0, 1);
  // Blend sunset warmth into sky and fog
  if (sunsetTint > 0.01) {
    scene.background.lerp(_sunsetSky, sunsetTint * 0.35);
    scene.fog.color.lerp(_sunsetFog, sunsetTint * 0.25);
  }

  // Celestial — hide stars entirely during bright day
  starPoints.visible = nightFactor > 0.05;
  starMat.opacity = 0.04 + nightFactor * 0.92;
  moonGlow.material.opacity = 0.02 + nightFactor * 0.07;

  // Exposure — adaptive: brighter when high up in sky, cinematic at street
  // Raised base for overall brighter scene
  const streetExpBoost = THREE.MathUtils.clamp(1 - camH / 30, 0, 1) * 0.3;
  const altExp = THREE.MathUtils.lerp(1.0, 0.80, altFactor);
  renderer.toneMappingExposure = altExp * (0.85 + daylight * 0.45 + nightFactor * 0.20) + streetExpBoost;

  // Bloom — visible glow during day, much stronger neon bloom at night
  post.setBloom(
    0.12 + nightFactor * 0.48,   // 0.12 day → 0.60 night (was 0.32)
    0.20 + nightFactor * 0.30,   // 0.20 day → 0.50 night (was 0.34)
    0.85 - nightFactor * 0.15    // 0.85 day → 0.70 night (lower = more glow)
  );
  post.updateTime(elapsed);

  // Lights
  // Street-level ambient boost: at street level, extra fill from neon spill
  const streetBoost = THREE.MathUtils.clamp(1 - camH / 25, 0, 1) * 0.4;
  ambient.intensity = 0.25 + daylight * 1.1 + streetBoost * nightFactor;
  ambient.color.setHSL(0.76, 0.55 - daylight * 0.25, 0.55 - nightFactor * 0.10);
  moonLight.intensity = 0.12 + nightFactor * 0.6;
  sunLight.intensity  = daylight * 5.0;
  // Accent lights: visible during day (subtle) and strong at night
  rimLight.intensity  = 2.5 + nightFactor * 22;
  fillLight.intensity = 2.0 + nightFactor * 16;
  cyaLight.intensity  = 3.0 + nightFactor * 28;
  magLight.intensity  = 2.5 + nightFactor * 24;

  // Smarter shadow updates: only update every 3 frames when static
  shadowUpdateCounter++;
  const needShadowUpdate = shadowUpdateCounter % 3 === 0;
  renderer.shadowMap.autoUpdate = needShadowUpdate;

  // Orbit accent lights — low altitude
  const et = elapsed;
  rimLight.position.set(Math.sin(et * 0.11) * 280, 42, Math.cos(et * 0.11) * 280);
  fillLight.position.set(Math.cos(et * 0.07) * 200, 36, 200 + Math.sin(et * 0.07) * 150);
  cyaLight.position.set(Math.sin(et * 0.05) * 150, 50, Math.cos(et * 0.05) * 150);
  magLight.position.set(-280 + Math.cos(et * 0.06) * 110, 46, -150 + Math.sin(et * 0.06) * 110);

  // Particles & city
  city.update(elapsed, nightFactor);
  rain.update(delta, camState.position);
  fountain.update(delta, nightFactor);
  atmosphere.update(elapsed, camera.position, nightFactor);
  clouds.update(elapsed, camera.position, daylight);

  // Rain: visible in both day and night, heavier when low altitude
  const rainIntensity = (0.06 + nightFactor * 0.06) * (1 + (1 - altFactor) * 0.5);
  rain.object.material.opacity = rainIntensity;

  post.composer.render();
  requestAnimationFrame(animate);
}

animate();
