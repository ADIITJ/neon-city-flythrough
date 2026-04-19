# Neon Dreams: City of Endless Wonder

A real-time 3D cyberpunk city fly-through built with Three.js. A procedurally constructed city with a 300-second cinematic camera tour, PBR materials, dynamic day/night cycle, and post-processing effects — no game engine, no pre-built city mesh, pure WebGL.

**Live demo:** run `npm run dev` and open `http://localhost:5173`

---

## What it is

The camera follows a collision-verified spline path through a fully procedural city: descending from the sky, sweeping rooftops, running streets in the financial core, east/west avenues, industrial north, then circling the central fountain plaza before rising back to the sky. The 300-second loop runs continuously.

Everything visible is generated at runtime from the `BUILDINGS` array and texture sets — no pre-built geometry from the `.glb` city model in `public/assets/`.

---

## Tech stack

| Layer | Detail |
|---|---|
| 3D engine | Three.js r180 |
| Build | Vite 7.1.7 |
| Language | ES6+ modules |
| Rendering | WebGL 2, ACES filmic tone mapping |
| Materials | MeshStandardMaterial (PBR) + custom GLSL post-processing |
| Lighting | Hemisphere + directional (sun/moon) + point accent lights |
| Post-processing | Selective bloom + chromatic aberration + film grain + vignette |
| Particles | Rain (2500), atmosphere dust (380), clouds (40 puffs) |
| Camera | CatmullRom spline, 49 waypoints, collision-verified |

---

## Project structure

```
.
├── index.html                  # Entry: canvas#app, HUD overlay, loads src/main.js
├── src/
│   ├── main.js                 # Scene setup, lighting, day/night cycle, animation loop
│   ├── city.js                 # Building generation, streets, fountain, camera path
│   ├── camera.js               # Spline fly-through animation (DURATION=300s)
│   ├── effects.js              # Post-processing: bloom, chromatic aberration, film grain
│   ├── particles.js            # Rain, atmosphere dust, cloud layer
│   ├── utils.js                # hash2D, valueNoise2D, fbm2D, neonPalette helpers
│   └── style.css               # Full-viewport canvas, HUD styling, scanline overlay
├── public/assets/
│   ├── *.exr                   # HDR environment maps (day: kloppenheim, night: dikhololo)
│   ├── *_1K-JPG/               # PBR texture sets: Color, Normal, Roughness, AO, Metalness
│   └── *.glb                   # 3D models: Car.glb, sci-fi_street_lamp.glb (unused city mesh)
├── check_camera_path.mjs       # Offline collision checker: 5000-sample AABB test
├── vite.config.js              # Three.js vendor split, 700KB chunk limit
└── package.json
```

---

## Source files

### `src/main.js`

Bootstraps everything. Creates the Three.js scene, PerspectiveCamera (FOV 55, far 2400), WebGLRenderer (SRGB, ACES filmic). Loads two EXR environment maps via `EXRLoader` + `PMREMGenerator` and swaps between them on the day/night cycle.

**Day/night cycle:** `mood` oscillates 0→1 over ~300 seconds (0.021 rad/sec sine). At `mood > 0.5` the scene switches to the day environment. All light intensities, fog density/color, exposure, and star opacity are driven by `mood` every frame.

**Lighting setup:**
- `HemisphereLight` (sky `#1a2a4a` / ground `#0a1218`): ambient fill
- Directional moon light (blue-white, intensity 0.6 at night): shadows enabled, PCF 1024×1024, updated every 3 frames
- Directional sun light (warm orange-white): drives day scene
- 4 orbit accent point lights at x=±180, z=±180 (purple/cyan neon glow)

**Adaptive exposure:** Ranges 0.70–1.0. At night (`mood < 0.2`) → 0.95, at high altitude (`y > 200`) → 0.75, else interpolated from `mood`.

**Animation loop:** delta capped at 0.05s to prevent spiral-of-death on tab switch. Pixel ratio capped at 1.5.

---

### `src/city.js`

Two exports: `createCity(scene)` and `getCameraPath()`.

#### Building system

Sixty buildings defined in the top-level `BUILDINGS` array:

```js
{ x, z, w, d, h, mat }
// x, z  — center position in world space
// w, d  — footprint width (x) and depth (z)
// h     — height
// mat   — 0=glass | 1=residential | 2=metal | 3=concrete | 4=neon
```

**Districts:**

| District | Location | Heights | Mat |
|---|---|---|---|
| Financial Core | Center, r < 80 | 100–220 | 0 (glass) + 4 (neon) |
| Entertainment | East, x = 80–240 | 55–110 | 4 (neon) + 2 (metal) |
| Residential | West, x = -80 to -240 | 42–60 | 1 (residential) |
| Industrial | North, z = -80 to -280 | 28–38 | 2 (metal) + 3 (concrete) |
| Civic/Park | South, z = 80–280 | 20–28 | 3 (concrete) |

Each building uses `InstancedMesh`. Per-building color is a HSL tint derived from `hash2D(x, z)` — deterministic and reproducible.

Window textures are generated at startup via `makeWindowTex(cols, rows)`: a 256×512 canvas with randomly lit warm/cool windows per floor grid. A separate emissive overlay controls night glow intensity via `.update()`.

**Rooftop details** (procedural per material type):
- `mat=0` tall: pyramid spire (`ConeGeometry`, 4-sided) + blinking beacon
- `mat=0` medium: stepped crown boxes
- `mat=1`: ridge boxes, optional water tower (cylinder + cone)
- `mat=2`: functional caps + 1–2 exhaust stacks
- `mat=4`: flat neon frame ring + vertical sign post
- All `h ≥ 60`: optional antenna

**Street layout:**

| Street | Axis | Width |
|---|---|---|
| Boulevard | z = 0 | 36 |
| Grand Avenue | x = 0 | 28 |
| East Avenue | x = 90 | 28 |
| West Avenue | x = -90 | 28 |
| North Streets | z = -60, -130, -220 | 22 |
| South Streets | z = 60, 130, 220 | 22 |

Road surface = asphalt PBR, lane lines = opacity-masked texture (0.35), cyan neon edge strips on Boulevard and Grand Avenue (additive blend), paving stone sidewalks (4.5 units wide).

**Fountain plaza** at (0, 0, 0): tiered basin (dark metallic, metalness 0.9), water surface (clearcoat + emissive glow), paving stone plaza circle radius 22.

**`.update(elapsed, nightFactor)`:** Updates ground color, per-district emissive intensities, neon edge strip opacity, and road surface tint for day/night transitions.

---

#### Camera path — `getCameraPath()`

Returns `{ positions: Vector3[], targets: Vector3[] }` — two parallel arrays of 49 waypoints fed into `CatmullRomCurve3` in `camera.js`.

Each waypoint: `[px, py, pz, tx, ty, tz]` — camera position + look-at target.

**Phases:**

| Phase | WPs | Description | Key constraint |
|---|---|---|---|
| 1 | 0–5 | Sky descent, y=420→150 | Above all geometry |
| 2 | 6–11 | Rooftop sweep, y ≥ 238 | y > FC-E-spire h=200 |
| 3 | 12–19 | Descent at x=64, z=22→13 | x=64: 3.5 units east of FC-E-spire edge (x=58) |
| 4 | 19–23 | East Avenue northward, x=83 | 13 units west of ENT-NW (x=96) |
| 5 | 24–26 | North Street west, z=-63 | Clears FC-N-slab (x=18), FC-NW2 (x=-33) |
| 6 | 27–29 | West Avenue southward, x=-83 | 12 units east of RES-SE (x=-95) |
| 7 | 30–33 | South Street east to x=64, south to z=13 | x=64 corridor avoids FC ring |
| 8 | 34–38 | Rise to y=230 > FC ring h=220, center over x=0 | y=230 clears all buildings |
| 9 | 39–44 | Fountain circle, y=16, \|x\|≤12, \|z\|≤13 | Inside open courtyard |
| 10 | 45–48 | Rise to y=265, closes loop | — |

**Financial Core ring — critical clearances:**

```
FC-E-spire:   x=[42,58]   z=[-18,18]  h=200   descent runs at x=64 (gap 3.5 units)
FC-SE-glass:  x=[18,38]   z=[17,39]   h=160   path at z=13 passes below south edge z=17
FC-NE-glass:  x=[17,39]   z=[-39,-17] h=220   East Ave at x=83 (gap 44 units)
FC-S-neon:    x=[-18,18]  z=[41,55]   h=150   south street at z=63 (gap 8 units)
FC-SE2:       x=[33,51]   z=[40,56]   h=120   south approach at x=64 (gap 8.5 units)
```

Path validated by `check_camera_path.mjs` — zero collisions, zero underground dips.

---

### `src/camera.js`

```js
export function createFlyThroughCamera(camera)
// Returns: { update(elapsed) }
```

`DURATION = 300` seconds per loop.

Samples both CatmullRom curves at `t = (elapsed % DURATION) / DURATION`, with per-segment quadratic smoothstep easing. Altitude-based sway: `sin(elapsed * 0.8) * lerp(0.2, 2.5, clamp(y/400, 0, 1))` — minimal at street level, strong banking at high altitude.

---

### `src/effects.js`

```js
export function createPostProcessing(renderer, scene, camera, size)
// Returns: { composer, setBloom(s,r,t), updateTime(t), resize(w,h) }
```

Pipeline: `RenderPass` → `UnrealBloomPass` → custom `CinematicShaderPass`.

**CinematicShader:**

| Uniform | Default | Effect |
|---|---|---|
| `uChromaOffset` | 0.0015 | Chromatic aberration, scales with radial distance² |
| `uGrainIntensity` | 0.04 | Film grain amplitude |
| `uTime` | animated | Grain animation seed |

Vignette: `1.0 - dist * 0.6` (radial from center).

---

### `src/particles.js`

Three independent systems:

**`createRainSystem()`** — 2500 points, cyan (`#88d4ff`), opacity 0.1. Fall velocity 120–280 units/sec, per-particle wind sway (sinusoidal). Anchored to camera XZ position.

**`createAtmosphereLayers(scene)`** — 380 dust particles, neon-palette colors via `sampleNeon()`, opacity 0.012 base scaling with night `mood`. Rotates y-axis 0.018 rad/sec. Follows camera XZ.

**`createCloudLayer(scene)`** — 40 cloud puffs across three altitude zones:
- High (y=270–310): 12 thin cirrus, opacity 0.12–0.22
- Mid (y=190–255): 20 main layer, opacity 0.28–0.46
- Low (y=110–180): 8 wisps, opacity 0.08–0.16

Each puff = two cross-oriented planes with canvas radial-gradient texture. Fades if camera is > 180 units from cloud altitude. Slow sinusoidal per-puff drift. Color shifts blue-grey at night, white-cream in day.

---

### `src/utils.js`

```js
hash2D(x, z)           // deterministic pseudo-random float [0,1) — sine-based
fract(v)               // v - Math.floor(v)
smoothstep(e0, e1, x)  // GLSL smoothstep
valueNoise2D(x, z)     // bilinear interpolated value noise
fbm2D(x, z, octaves)   // fractional Brownian motion, default 4 octaves
neonPalette()          // returns [cyan, magenta, purple, blue]
sampleNeon(index, v)   // palette pick with HSL jitter
```

`hash2D` is the primary source of per-object variation throughout the codebase — building colors, window patterns, rooftop details, particle phases. `sampleNeon` drives atmosphere dust color distribution.

---

## Camera path verification

`check_camera_path.mjs` is an offline Node.js tool that mirrors the camera path and building definitions from `city.js`:

```bash
node check_camera_path.mjs
```

**What it checks:**
1. Samples the CatmullRom curve at 5000 evenly-spaced `t` values
2. Tests each sample against all 60 building AABBs with camera radius 2.5 units
3. Reports collisions (`❌`), tight gaps < 8 units (`⚠️`), and underground dips (y < 2.0)

**When modifying `getCameraPath()` in `city.js`:** update the `PTS` array in `check_camera_path.mjs` to match exactly, then re-run the checker. The `BUILDINGS` array in the checker must also stay in sync with `city.js`.

**Current status:** zero curve collisions, zero underground samples.

---

## Assets

All assets are in `public/assets/`. Vite copies them verbatim to `dist/assets/` at build time.

**Environment maps (EXR, loaded via `EXRLoader` + `PMREMGenerator`):**
- `dikhololo_night_1k.exr` — night sky
- `kloppenheim_02_1k.exr` — day sky

**PBR texture sets** (each has Color, Normal, Roughness + optional AO/Metalness/Emission/Opacity):

| Folder | Used for |
|---|---|
| `Asphalt012_1K-JPG/` | Road surface |
| `Concrete034_1K-JPG/` | Concrete buildings |
| `Facade001_1K-JPG/` | Residential facade |
| `Facade009_1K-JPG/` | Neon entertainment facade (has emission map) |
| `Facade018A_1K-JPG/` | Glass tower facade (has metalness map) |
| `Ground054_1K-JPG/` | Ground plane (grass/earth) |
| `Metal032_1K-JPG/` | Industrial metal |
| `PavingStones070_1K-JPG/` | Sidewalk paving |
| `RoadLines004_1K-JPG/` | Lane markings (has opacity map) |

**3D models (GLB):**
- `sci-fi_street_lamp.glb` — loaded, not yet placed in scene
- `Car.glb` — loaded, not used
- `cyberpunk_city.glb` (95 MB) — pre-built city mesh, loaded but not added to scene; all visible geometry is procedural

---

## Getting started

```bash
npm install
npm run dev       # dev server → http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview production build
```

Node.js 18+ required for `check_camera_path.mjs`.

---

## Key parameters

| Parameter | Value |
|---|---|
| Camera loop duration | 300 s |
| Camera waypoints | 49 |
| Buildings | 60 |
| Camera collision radius | 2.5 units |
| Rain particles | 2500 |
| Atmosphere dust | 380 |
| Cloud puffs | 40 |
| Shadow map resolution | 1024 × 1024 |
| Shadow update rate | Every 3 frames |
| Max pixel ratio | 1.5 |
| Camera FOV | 55° |
| Far plane | 2400 units |
| Ground plane | 1600 × 1600 units |
| Day/night period | ~300 s |
