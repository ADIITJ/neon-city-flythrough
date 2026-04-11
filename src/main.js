import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { createCity } from "./city.js";
import { createFlyThroughCamera } from "./camera.js";
import { createPostProcessing } from "./effects.js";
import { createAtmosphereLayers, createCloudLayer, createRainSystem } from "./particles.js";

const canvas = document.querySelector("#app");
const scene  = new THREE.Scene();
scene.background = new THREE.Color("#060b18");
scene.fog = new THREE.Fog("#060b18", 120, 1200);

const daySky   = new THREE.Color("#87ceeb");
const nightSky = new THREE.Color("#060b18");
const dayFog   = new THREE.Color("#8cb8d8");
const nightFog = new THREE.Color("#060b18");
const tempColor = new THREE.Color();

const camera = new THREE.PerspectiveCamera(
  62, window.innerWidth / window.innerHeight, 0.5, 2600
);

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

// ── Load BOTH EXR environment maps for day/night IBL ────────────────────
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

let nightEnvMap = null;
let dayEnvMap = null;
let envMapsLoaded = 0;

const exrLoader = new EXRLoader();

exrLoader.load("assets/dikhololo_night_1k.exr", (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  nightEnvMap = pmremGenerator.fromEquirectangular(texture).texture;
  texture.dispose();
  envMapsLoaded++;
  if (envMapsLoaded >= 2) pmremGenerator.dispose();
  if (!scene.environment) scene.environment = nightEnvMap;
});

exrLoader.load("assets/kloppenheim_02_1k.exr", (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  dayEnvMap = pmremGenerator.fromEquirectangular(texture).texture;
  texture.dispose();
  envMapsLoaded++;
  if (envMapsLoaded >= 2) pmremGenerator.dispose();
});

// ── Stars ────────────────────────────────────────────────────────────────
const starCount = 3200;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 1800 + Math.random() * 200;
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 40;
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({
  color: "#ffffff", size: 1.8, sizeAttenuation: false,
  transparent: true, opacity: 0.95, depthWrite: false,
  blending: THREE.AdditiveBlending
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ── Moon ─────────────────────────────────────────────────────────────────
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(26, 32, 32),
  new THREE.MeshStandardMaterial({
    color: "#d8eaff", emissive: "#88b0d8", emissiveIntensity: 1.2,
    roughness: 1.0, metalness: 0.0
  })
);
moonMesh.position.set(-520, 460, -720);
scene.add(moonMesh);

const moonGlow = new THREE.Mesh(
  new THREE.SphereGeometry(44, 32, 32),
  new THREE.MeshBasicMaterial({
    color: "#2858a8", transparent: true, opacity: 0.18,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false
  })
);
moonGlow.position.copy(moonMesh.position);
scene.add(moonGlow);

// ── Sun ──────────────────────────────────────────────────────────────────
const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(52, 32, 32),
  new THREE.MeshBasicMaterial({ color: "#fff8d0", transparent: true, opacity: 0.0 })
);
sunMesh.position.set(820, 310, -1050);
scene.add(sunMesh);

const sunHalo = new THREE.Mesh(
  new THREE.SphereGeometry(94, 32, 32),
  new THREE.MeshBasicMaterial({
    color: "#ffe878", transparent: true, opacity: 0.0,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false
  })
);
sunHalo.position.copy(sunMesh.position);
scene.add(sunHalo);

// ── Lights ───────────────────────────────────────────────────────────────
const ambientLight = new THREE.HemisphereLight("#b0d8ff", "#0a0818", 1.0);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight("#a0c8ff", 2.5);
moonLight.position.copy(moonMesh.position);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 2048;
moonLight.shadow.mapSize.height = 2048;
moonLight.shadow.camera.near = 1;
moonLight.shadow.camera.far = 1800;
moonLight.shadow.camera.left = -600;
moonLight.shadow.camera.right = 600;
moonLight.shadow.camera.top = 600;
moonLight.shadow.camera.bottom = -600;
scene.add(moonLight);

const sunLight = new THREE.DirectionalLight("#fff4d0", 0.0);
sunLight.position.copy(sunMesh.position);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 2000;
sunLight.shadow.camera.left = -600;
sunLight.shadow.camera.right = 600;
sunLight.shadow.camera.top = 600;
sunLight.shadow.camera.bottom = -600;
scene.add(sunLight);

const rimLight = new THREE.PointLight("#ff4fd8", 35, 1200, 2);
rimLight.position.set(0, 130, 0);
scene.add(rimLight);

const fillLight = new THREE.PointLight("#2fbfff", 25, 1400, 2);
fillLight.position.set(0, 180, 240);
scene.add(fillLight);

const skyLight = new THREE.PointLight("#19f9ff", 50, 1800, 2);
skyLight.position.set(0, 300, 0);
scene.add(skyLight);

const magentaLight = new THREE.PointLight("#ff4fd8", 45, 1600, 2);
magentaLight.position.set(-300, 260, -180);
scene.add(magentaLight);

// ── Scene objects ────────────────────────────────────────────────────────
const city = createCity(scene);
const rain = createRainSystem();
scene.add(rain.object);
const atmosphere = createAtmosphereLayers(scene);
const clouds = createCloudLayer(scene);
const flyThrough = createFlyThroughCamera(camera);
const post = createPostProcessing(renderer, scene, camera, {
  width: window.innerWidth, height: window.innerHeight
});

const clock = new THREE.Clock();
let elapsedTime = 0;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  post.resize(window.innerWidth, window.innerHeight);
});

function animate() {
  const delta = clock.getDelta();
  elapsedTime += delta;

  const cycle = 0.5 + 0.5 * Math.sin(elapsedTime * 0.021 - Math.PI / 2);
  const daylight = THREE.MathUtils.smoothstep(cycle, 0.18, 0.82);
  const nightFactor = 1.0 - daylight;

  const cameraState = flyThrough.update(elapsedTime);
  city.update(elapsedTime, nightFactor);
  rain.update(delta, cameraState.position);
  atmosphere.update(elapsedTime, camera.position, nightFactor);
  clouds.update(elapsedTime, camera.position, daylight);

  // Sky & fog — richer daylight colors
  scene.background.copy(tempColor.copy(nightSky).lerp(daySky, daylight));
  scene.fog.color.copy(tempColor.copy(nightFog).lerp(dayFog, daylight));
  scene.fog.near = 120 + daylight * 200;
  scene.fog.far = 1200 + daylight * 600;

  // Swap environment map based on day/night
  if (daylight > 0.5 && dayEnvMap) {
    scene.environment = dayEnvMap;
  } else if (nightEnvMap) {
    scene.environment = nightEnvMap;
  }

  // Celestial
  starMat.opacity = 0.04 + nightFactor * 0.96;
  moonMesh.material.emissiveIntensity = 0.12 + nightFactor * 1.2;
  moonGlow.material.opacity = 0.02 + nightFactor * 0.2;
  sunMesh.material.opacity = daylight * 0.98;
  sunHalo.material.opacity = daylight * 0.42;

  // Exposure — brighter during day
  renderer.toneMappingExposure = 0.55 + daylight * 0.65 + nightFactor * 0.15;

  // Bloom — less during day for realism, more at night for neon glow
  post.setBloom(
    0.04 + nightFactor * 0.34,
    0.20 + nightFactor * 0.20,
    0.80 - nightFactor * 0.20
  );

  // Lights — sun stronger during day, moon at night
  ambientLight.intensity = 0.35 + daylight * 1.2;
  ambientLight.color.setHSL(0.56, 0.7 - daylight * 0.3, 0.72 - nightFactor * 0.18);
  moonLight.intensity = 0.4 + nightFactor * 2.5;
  sunLight.intensity = daylight * 4.0;
  rimLight.intensity = 2 + nightFactor * 30;
  fillLight.intensity = 2 + nightFactor * 22;
  skyLight.intensity = 2 + nightFactor * 42;
  magentaLight.intensity = 2 + nightFactor * 35;

  // Rain intensity — heavier at night
  rain.object.material.opacity = 0.04 + nightFactor * 0.08;

  // Orbit accent lights
  rimLight.position.x = Math.sin(elapsedTime * 0.12) * 300;
  rimLight.position.z = Math.cos(elapsedTime * 0.12) * 300;
  fillLight.position.x = Math.cos(elapsedTime * 0.08) * 220;
  fillLight.position.z = 220 + Math.sin(elapsedTime * 0.08) * 160;
  skyLight.position.x = Math.sin(elapsedTime * 0.05) * 160;
  skyLight.position.z = Math.cos(elapsedTime * 0.05) * 160;
  magentaLight.position.x = -300 + Math.cos(elapsedTime * 0.06) * 120;
  magentaLight.position.z = -180 + Math.sin(elapsedTime * 0.06) * 120;

  // Environment map intensity based on time of day
  if (scene.environment) {
    scene.environmentIntensity = 0.4 + daylight * 0.6;
  }

  post.composer.render();
  requestAnimationFrame(animate);
}

animate();
