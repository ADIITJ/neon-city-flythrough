# Neon City — Viva Notes
### Atharva Date & Samay Mehar | Computer Graphics Course Project

---

## 1. Why Three.js + WebGL Instead of Blender + Unity?

**The assignment originally asked for Blender + Unity. We chose Three.js + WebGL deliberately because it demonstrates deeper understanding of CG fundamentals.**

| Aspect | Blender/Unity | Our Approach (Three.js + WebGL) |
|--------|--------------|-------------------------------|
| Scene graph | Built-in editor, drag & drop | We construct the entire scene graph in code — every `Group`, `Mesh`, `InstancedMesh` is manually assembled |
| Materials | Preset shader graphs (Principled BSDF / URP) | We configure `MeshStandardMaterial` and `MeshPhysicalMaterial` by hand — setting roughness, metalness, clearcoat, emissive maps, normal maps individually |
| Lighting | Place lights in editor, adjust via sliders | We create `HemisphereLight`, `DirectionalLight`, `PointLight` programmatically, animate their intensities/colors per frame, and manage shadow maps in code |
| Camera | Timeline animation in editor | We build CatmullRomCurve3 splines with 49 hand-placed waypoints and write the interpolation logic ourselves |
| Post-processing | Add components from dropdown | We write GLSL fragment shaders for chromatic aberration, film grain, vignette; configure bloom pass with dynamic parameters |
| Textures | Import in editor, UV unwrap | We load PBR texture sets (color, normal, roughness, metalness, AO, emission) via TextureLoader, set wrapping/repeat/anisotropy in code |
| Rendering | Press play | We manage the render loop, delta time, shadow map update frequency, tone mapping, color space — all in code |

**Key argument**: In Unity, you click "Add Component → Bloom". In our project, we write `new UnrealBloomPass(resolution, strength, radius, threshold)` and dynamically adjust all parameters per-frame based on day/night cycle. We understand *what* bloom does (bright pixel extraction → gaussian blur → additive composite) because we control it.

**Blender equivalences we implemented in code:**
- Blender's Principled BSDF → our `MeshStandardMaterial` with PBR maps (Cook-Torrance BRDF under the hood)
- Blender's particle system → our `BufferGeometry` + `Points` for rain, atmosphere, fountain spray
- Blender's keyframe animation → our spline curves + `Math.sin`-based oscillations
- Blender's compositor → our `EffectComposer` with render pass, bloom pass, custom shader pass
- Blender's HDRI lighting → our EXR environment maps with `PMREMGenerator`

---

## 2. Computer Graphics Concepts Used

### 2.1 Rendering Pipeline (WebGL 2)
- **Vertex processing**: Vertices transformed by model → view → projection matrices (`projectionMatrix * modelViewMatrix * vec4(position, 1.0)` in our GLSL vertex shader)
- **Fragment processing**: Per-pixel color computation in fragment shaders (our CinematicShader)
- **Rasterization**: WebGL converts triangles to fragments; we control output via `THREE.WebGLRenderer`
- **Depth buffer**: Z-buffer for occlusion; we selectively disable depth writes (`depthWrite: false`) for transparent/additive objects like neon glows, rain, fog

### 2.2 Transformations
- **Model matrix**: Each mesh has position, rotation, scale → combined into `Object3D.matrix`
- **View matrix**: Camera's inverse world matrix — `camera.lookAt(target)` computes this
- **Projection matrix**: `PerspectiveCamera(fov=55, aspect, near=0.8, far=2400)` — 55° FOV gives dramatic perspective compression for a cinematic urban look
- **Instanced transforms**: For InstancedMesh (buildings, trees, bushes, neon panels), each instance has its own 4×4 matrix set via `setMatrixAt()` — the GPU applies per-instance transforms in a single draw call

### 2.3 Lighting Model — Physically Based Rendering (PBR)
Three.js uses the **Cook-Torrance microfacet BRDF** internally:

```
f(l,v) = D(h) * F(v,h) * G(l,v,h) / (4 * (n·l) * (n·v))
```

- **D** (Normal Distribution): GGX/Trowbridge-Reitz — controls highlight shape from `roughness`
- **F** (Fresnel): Schlick approximation — reflectivity at grazing angles from `metalness`
- **G** (Geometry/Shadowing): Smith-GGX — self-shadowing of microfacets

**Our materials demonstrate this**:
| Material | Roughness | Metalness | Effect |
|----------|-----------|-----------|--------|
| Glass facades | from texture | from texture | Sharp reflections, visible env map |
| Road (wet) | 0.62 | 0.15 | Subtle wetness shimmer |
| Road clearcoat | dynamic 0.15–0.55 | — | Extra specular layer for wet look at night |
| Car body | 0.22 | 0.72 | Highly metallic, sharp reflections |
| Sidewalk paving | 0.78 | 0.04 | Diffuse, matte concrete |
| Lamp poles | 0.45 | 0.70 | Brushed metal appearance |

### 2.4 Texture Mapping
We use **PBR texture sets** from ambientCG (1K resolution):

- **Color/Albedo map** (`map`): Base color of the surface
- **Normal map** (`normalMap`): Encodes surface micro-detail as RGB → XYZ normals. Perturbs the shading normal per-pixel without adding geometry. Our facades use `normalScale: new Vector2(0.8, 0.8)` to control intensity
- **Roughness map** (`roughnessMap`): Per-pixel roughness variation — e.g., worn edges vs smooth centers on concrete
- **Metalness map** (`metalnessMap`): Per-pixel metallic/dielectric classification
- **Ambient Occlusion map** (`aoMap`): Pre-baked soft shadows in crevices — multiplied into diffuse
- **Emissive map** (`emissiveMap`): Pixels that glow (window lights on facades)
- **UV coordinates**: `PlaneGeometry`, `BoxGeometry`, `CylinderGeometry` all generate default UVs. We control tiling via `texture.repeat.set(rx, ry)` — e.g., asphalt repeats 3×80 across the road length
- **Anisotropic filtering**: `texture.anisotropy = 8` — reduces blur when textures are viewed at oblique angles (critical for roads stretching into distance)

### 2.5 Procedural Textures (Canvas API → CanvasTexture)
Instead of using image files for everything, we generate textures at runtime:

- **Window grid texture** (`makeWindowTex`): 256×512 canvas, draws colored rectangles in a grid pattern. Uses hash function for pseudo-random on/off windows and warm/cool color variation. Becomes the `emissiveMap` on building facades → windows glow at night
- **Shop sign texture** (`makeSign`): Renders text labels ("NEXUS", "CYBER BAR", "RAMEN" etc.) with glow effects
- **Holographic billboard texture** (`makeHolo`): Gradient background + scanlines + outlined text — simulates a holographic display
- **Crosswalk texture**: Canvas with striped pattern, applied as semi-transparent overlay on intersections
- **Cloud texture** (`makeCloudTex`): 512×256 canvas, draws 8 overlapping radial-gradient ellipses for fluffy cloud puffs

### 2.6 Shading & Custom Shaders (GLSL)
Our `CinematicShader` is a post-processing fragment shader:

```glsl
// Chromatic aberration — splits RGB channels based on distance from center
float aberration = uChromaOffset * dist * dist;  // quadratic falloff
float r = texture2D(tDiffuse, uv + dir * aberration).r;
float g = texture2D(tDiffuse, uv).g;
float b = texture2D(tDiffuse, uv - dir * aberration).b;

// Film grain — pseudo-random noise
float grain = rand(uv * uTime * 0.01) * uGrainIntensity;

// Vignette — darken edges
float vignette = 1.0 - dist * 0.6;
```

- **Chromatic aberration**: Simulates lens imperfection — red channel shifts outward, blue shifts inward, proportional to `dist²` from center
- **Film grain**: Hash-based noise using `fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453)` — classic GPU random function
- **Vignette**: Linear darkening from center to edges

### 2.7 Shadow Mapping
- **Technique**: PCF (Percentage-Closer Filtering) Shadow Map — samples multiple depth texels and averages for soft shadow edges
- **Two shadow casters**: `moonLight` (night) and `sunLight` (day), both `DirectionalLight` with orthographic shadow cameras (500×500 unit coverage, 1024² map resolution)
- **Optimization**: `renderer.shadowMap.autoUpdate` toggled — only recomputes shadow maps every 3rd frame. Shadow geometry is mostly static (buildings don't move), so this saves significant GPU time
- **Shadow receivers**: Ground plane, sidewalks, roads — set via `mesh.receiveShadow = true`
- **Shadow casters**: Buildings, trees, cars — set via `mesh.castShadow = true`

### 2.8 Image-Based Lighting (IBL)
- Two **EXR environment maps**: `dikhololo_night_1k.exr` (night sky) and `kloppenheim_02_1k.exr` (daytime outdoor)
- Processed through `PMREMGenerator` (Pre-filtered Mipmap Radiance Environment Map) — generates mip levels for different roughness values. Rough surfaces sample blurry mips, smooth surfaces sample sharp mips
- `scene.environment` is swapped when `daylight` crosses 0.5 threshold
- `scene.environmentIntensity` interpolates 0.35 (night) → 1.0 (day) for correct ambient contribution

### 2.9 Bloom (HDR Post-Processing)
- **UnrealBloomPass**: Extracts pixels above brightness threshold → applies multi-pass Gaussian blur → composites additively
- Parameters animated by day/night:
  - Night: strength=0.60, radius=0.50, threshold=0.70 (lots of bloom on neon)
  - Day: strength=0.12, radius=0.20, threshold=0.85 (subtle sun bloom)
- Objects with `AdditiveBlending` and high opacity naturally exceed the threshold → bloom halos

### 2.10 Tone Mapping & Color Space
- **ACES Filmic Tone Mapping**: Maps HDR luminance to displayable [0,1] range with an S-curve. Preserves detail in highlights and shadows. Industry standard (used in film/VFX)
- **Exposure**: Dynamically adjusted (0.80–1.60) based on altitude and day/night — simulates eye adaptation
- **sRGB Color Space**: `renderer.outputColorSpace = THREE.SRGBColorSpace` — applies gamma correction for perceptually correct display

### 2.11 Alpha Blending & Transparency
- **Standard alpha blending**: `transparent: true, opacity: value` on materials. Uses `src * alpha + dst * (1 - alpha)` compositing
- **Additive blending**: `blending: THREE.AdditiveBlending` — `src + dst`. Used for all glow effects (neon panels, lamp glows, fog volumes, rain, atmosphere particles, clouds). Additive blending makes overlapping glows brighter, which is physically correct for light emission
- **Depth write disabled** (`depthWrite: false`): For transparent objects, prevents them from occluding other transparent objects behind them. Critical for correct rendering of overlapping neon panels, fog, particles

### 2.12 Fog
- **Exponential fog** (`FogExp2`): `density * e^(-distance*density)` — more natural than linear fog
- Density dynamically adjusted: denser at street level (0.0012), thinner at altitude (0.0003)
- Color interpolated between night purple `#04080f` and day blue `#7ab4cc`
- Additional **volumetric fog planes** (20 semi-transparent planes in city.js) simulate ground-level haze — placed along streets, slowly drifting, color-matched to time of day

### 2.13 Particle Systems
We implement 4 independent particle systems using `BufferGeometry` + `Points`:

| System | Count | Technique | Update |
|--------|-------|-----------|--------|
| Rain | 2500 | Velocity + gravity, pre-computed wind sway arrays | Per-frame position update, reset on ground hit |
| Atmosphere dust | 380 | Slow rotation, follows camera | Color from neon palette, additive blending |
| Fountain spray | 500 | 3 sub-systems: central jet (150), ring jets (240), splash mist (110) | Physics simulation: velocity, gravity (16/14/4 m/s²), air resistance, lifetime reset |
| Clouds | 80 planes | Billboard planes (2 cross-planes per puff for volume), canvas texture | Slow drift, opacity by camera proximity |

**Fountain spray physics**:
```
velocity.y -= gravity * delta;  // gravity integration (Euler method)
position += velocity * delta;   // position integration
// Air resistance on splash mist: velocity *= 0.98 per frame
```

### 2.14 Curves & Splines
- **CatmullRomCurve3**: Centripetal Catmull-Rom spline through 49 waypoints, `closed=true` for seamless loop
- Tension parameter 0.5 (centripetal) — prevents cusps and overshooting
- Two curves: one for camera position, one for look-at target
- `curve.getPoint(t)` returns interpolated Vector3 at parameter t ∈ [0,1]
- Linear parameter mapping: `t = (elapsed % 180) / 180` — constant speed along curve

### 2.15 Instanced Rendering
**The single most important optimization.** Instead of 60 separate draw calls for 60 buildings:

- **5 InstancedMesh objects** (one per facade material) each rendering ~12 buildings = **5 draw calls** total
- Each instance gets a unique 4×4 transform matrix and optional per-instance color
- Same geometry + material, different transforms → GPU processes all instances in one batch
- Also used for: neon panels (500), neon strips (400), puddles (50), light spills (200), trunks/canopies/bushes (3 meshes)

**Total draw call reduction**: ~1200+ individual meshes → ~15 instanced draw calls

---

## 3. Building System

### 3.1 Layout
60 buildings across 5 themed districts, hand-placed with explicit `{x, z, w, d, h, mat}`:
- **Financial Core** (center): 12 glass skyscrapers, h=115–220
- **Entertainment** (east): 16 neon-facade buildings, h=55–110
- **Residential** (west): 17 warm-windowed buildings, h=42–60
- **Industrial** (north): 6 wide warehouses, h=28–38
- **Civic/Park** (south): 6 low civic buildings, h=20–28

### 3.2 Construction
Each building = `BoxGeometry(w, h, d)` positioned at `(x, h/2, z)` (half-height lift so base sits on ground).

5 facade material types, each `MeshStandardMaterial` with full PBR texture set:
1. **Glass** (`Facade018A`): color + normal + roughness + metalness + emission + AO maps. Emissive base 0.70
2. **Residential** (`Facade001`): color + normal + roughness + metalness. Emissive base 0.80
3. **Metal** (`Metal032`): Industrial look. Emissive base 0.45
4. **Concrete** (`Concrete034`): Civic/industrial. Emissive base 0.35
5. **Neon Facade** (`Facade009`): Entertainment district, brightest emissive base 1.10

**Procedural emissive window maps**: A `makeWindowTex(cols, rows)` function generates a 256×512 canvas texture with randomized lit/unlit windows using a hash function. Applied as `emissiveMap` — windows glow based on `emissiveIntensity` which scales with night factor.

### 3.3 Rooftops
Every building gets a flat rooftop with concrete PBR material, slightly inset from building edges.

### 3.4 Building Decorations
- **Neon panels**: 500 instances of `BoxGeometry(1,1,0.1)` placed on building faces at random heights. Each gets a unique neon color via `sampleNeon()`. Additive blending for glow
- **Neon strips**: 400 horizontal glowing lines on tall buildings (h>45)
- **Shop signs**: Text-based canvas textures ("NEXUS", "CYBER BAR", "RAMEN" etc.) on entertainment + glass buildings. Each has an associated PointLight
- **Holographic billboards**: Large 16×8 planes on buildings taller than 100 units, with procedural gradient + scanline textures
- **Rooftop beacons**: Top 10 tallest buildings get pulsing PointLights (intensity 28, range 180) + glowing spheres
- **Light spill**: 200 glowing planes on the ground around building bases, colored by neon palette

---

## 4. Street & Road System

### 4.1 Grid
- 7 east-west streets (including Grand Boulevard at z=0, width 36)
- 5 north-south avenues (including Grand Avenue at x=0, width 28)
- Named constants: `BLVD_Z`, `ST_N1`, `ST_S2`, `AVE_EAST`, etc.

### 4.2 Materials
- **Road surface**: `MeshPhysicalMaterial` with asphalt PBR textures + dynamic clearcoat (0.15 day → 0.55 night) for wet-road reflections
- **Center lines**: Separate road-line PBR textures with alpha map
- **Neon edge strips**: On main boulevard and grand avenues — glowing cyan/magenta edge lines with additive blending
- **Sidewalks**: Paving stone PBR textures, elevated 0.022 units with concrete curbs (BoxGeometry, height 0.2)
- **Crosswalks**: Canvas-generated striped texture, semi-transparent (opacity 0.32) at every intersection

### 4.3 Puddles
50 `InstancedMesh` circles on roads with `MeshPhysicalMaterial`: metalness 0.25, roughness 0.06, clearcoat 1.0, clearcoatRoughness 0.04 — highly reflective wet spots.

---

## 5. Fountain & Water

### 5.1 Structure
Central plaza at origin, radius ~20 units:
- Two-tier circular fountain: lower basin (radius 9.6) + upper tier (radius 4.5, elevated 1.8)
- Central spire (CylinderGeometry, height 6.5) with emissive glow
- Spire halo (SphereGeometry, additive blending)
- 6 ring lights around the basin edge — slow HSL color cycling
- Cascade rings (TorusGeometry) simulating water overflow between tiers

### 5.2 Water Surface Animation (Vertex Displacement)
The water mesh's vertex positions are modified every frame:

```javascript
// Three layered wave patterns on the lower basin
const wave1 = Math.sin(dist * 0.8 - t * 3.5) * 0.18 * edgeFactor;  // expanding rings
const wave2 = Math.sin(dist * 1.6 - t * 5.0 + 1.2) * 0.10;        // faster ripples
const wave3 = Math.sin(bx * 0.5 + t * 2.0) * Math.cos(bz * 0.5 + t * 1.8) * 0.08;  // cross-waves
wPos.array[i * 3 + 1] = baseY + wave1 + wave2 + wave3;
```

- **Concentric waves** (`wave1`): Amplitude scales with `edgeFactor = dist/9.6` — calm center, active edges
- **Faster secondary ripples** (`wave2`): Uniform across surface, phase-offset
- **Cross-interference** (`wave3`): Product of two orthogonal sine waves — creates choppy interference pattern
- **Vertex normals**: `computeVertexNormals()` called every 3rd frame (throttled for performance) — ensures correct lighting on deformed mesh

### 5.3 Fountain Spray Particles
500 particles in 3 sub-systems with physics simulation (see Section 2.13).

---

## 6. Car System

### 6.1 Placement
~88 cars placed on named roads with explicit definitions:
- Grand Boulevard: 20 cars (12 eastbound, 8 westbound)
- Grand Avenue: 14 cars
- East Avenue: 14 cars
- West Avenue: 10 cars
- Side streets: 6 cars each × 4 streets = 24 cars

### 6.2 Car Mesh
Each car is a `THREE.Group` with:
- Body: `BoxGeometry(2.0, 1.1, 4.2)`, metallic PBR material (roughness 0.22, metalness 0.72)
- Roof: Smaller box, darker color
- Headlights: Small boxes with bright emissive material + glow sphere + PointLight (range 12)
- Taillights: Red emissive boxes
- 16-color palette: dark jewel tones (navy, purple, dark red) + neon accents (hot pink, magenta)

If a GLTF car model is available (`Car.glb`), it replaces the box geometry with the detailed model, cloned per car with unique paint color.

### 6.3 Motion
Cars move at constant speed along their lane:
```javascript
travel += speed * 0.016 * direction;
if (travel > 420) travel = -420;  // wrap around
```

### 6.4 Collision Avoidance (Precomputed Blocked Intervals)
Rather than checking collisions per-frame (expensive), we **precompute** static blocked intervals per lane at initialization:

1. For each lane (road + lane offset), test every building AABB:
   - If the lane's cross-coordinate falls within a building's extent, record the building's travel-axis extent as a blocked interval
2. Test fountain circle (radius 26): if lane crosses the circle, compute intersection chord
3. Merge overlapping intervals
4. At runtime: if car enters a blocked interval, teleport past it: `travel = hi + 0.5`

This is O(1) per car per frame (just interval membership test) instead of O(n_buildings) collision checks.

---

## 7. Camera System

### 7.1 Spline Path
- **CatmullRomCurve3** with 49 waypoints, `closed=true`, tension 0.5 (centripetal)
- Two parallel curves: position + look-at target
- Total loop time: 180 seconds (matches day/night cycle period)
- Parameter: `t = (elapsed % 180) / 180` — linear, constant speed

### 7.2 Path Design
The camera follows a cinematic route:
1. **0–20s**: High altitude (y=400), bird's-eye view through clouds
2. **20–50s**: Descending spiral (400→120), passing through cloud layer
3. **50–80s**: Rooftop sweep along Financial Core (y=80)
4. **80–120s**: Dive to street level on Grand Avenue, heading toward Entertainment district
5. **120–155s**: Arc through Entertainment district between neon buildings
6. **155–185s**: North along East Avenue at street level
7. **185–215s**: West along Industrial streets
8. **215–245s**: Circle the fountain plaza (y=4–8)
9. **245–270s**: Climb along Residential avenue
10. **270–300s**: Rise to y=80, banking south to close loop

### 7.3 Altitude-Adaptive Behavior
Rather than hard thresholds, we use **smoothstep blending**:

```javascript
const streetFactor = 1 - smoothstep(altitude, 10, 60);  // 1 at ground, 0 above 60
const highFactor = smoothstep(altitude, 150, 250);       // 0 below 150, 1 above 250
```

- **Street level** (streetFactor=1): Camera target shifts upward at night (look at neon signs), subtle side-to-side motion
- **High altitude** (highFactor=1): Gentle banking sway (bird-gliding effect), look-target offsets for panoramic views
- **Mid altitude**: Both factors near 0 — clean transition, no target jumps

### 7.4 Day/Night Look Variation
```javascript
const nightShift = 1 - daylight;
_tgt.y += nightShift * 8 * streetFactor;  // look up at neon at night
_tgt.y -= daylight * 2 * streetFactor;     // look slightly down in day
```

---

## 8. Day/Night Cycle & Sun System

### 8.1 Cycle Mathematics
```javascript
const cycle = 0.5 + 0.5 * Math.sin(elapsed * (2π / 180) + π/2);
```
- **Period**: 180 seconds = full day → night → day
- **Phase**: `+π/2` starts at cycle=1 (noon/day peak)
- At t=0: `sin(π/2) = 1` → cycle=1 (day)
- At t=45s: `sin(π) = 0` → cycle=0.5 (sunset)
- At t=90s: `sin(3π/2) = -1` → cycle=0 (midnight)
- At t=135s: `sin(2π) = 0` → cycle=0.5 (sunrise)
- At t=180s: `sin(5π/2) = 1` → cycle=1 (day again)

`daylight = smoothstep(cycle, 0.18, 0.82)` — remaps to [0,1] with smooth transition (not instant day/night switch).

### 8.2 Sun Orbit
Sun position is computed relative to the camera's look direction:

1. **Elevation**: `sunSine = clamp(cycle * 2 - 1, -1, 1)` → `sunY = sunSine * 500`
   - At noon (cycle=1): sunY=500 (zenith)
   - At cycle=0.5: sunY=0 (horizon)
   - At cycle<0.5: sun below horizon (night)

2. **Horizontal position**: Sun orbits at `cos(elevation) * 1200` radius from camera
   - Toward camera's forward direction (`_lookDir`) — so sunset is visible in frame
   - Rising sun comes from perpendicular left, setting sun swings toward camera forward
   - `horizBlend = 1 - |elevation| / (π/2)` — maximum horizontal offset at horizon

3. **Sunset glow**: Large sphere (radius 200) with warm red color, opacity peaks at `horizBlend * daylight * (1-daylight) * 4` — maximum during transition. Sky and fog colors lerp toward warm orange tint.

### 8.3 What Changes with Day/Night

| Property | Day (daylight=1) | Night (nightFactor=1) |
|----------|-------------------|----------------------|
| Sky color | `#5a9ec8` (blue) | `#04080f` (dark) |
| Fog color | `#7ab4cc` | `#04080f` |
| Fog density | Base × 1.0 | Base × 1.4 |
| Bloom strength | 0.12 | 0.60 |
| Bloom threshold | 0.85 | 0.70 |
| Building emissive | base × 0.18 | base × 1.0 |
| Neon panel opacity | 0.12 | 0.70 |
| Road clearcoat | 0.15 | 0.55 |
| Street lights | 5 | 40 |
| Accent lights | 2–3 | 22–28 |
| Stars | hidden | visible, opacity 0.96 |
| Sun light | 5.0 | 0.0 |
| Moon light | 0.12 | 0.72 |
| Env map | Day EXR | Night EXR |
| Exposure | ~1.30 | ~1.05 |

### 8.4 HUD Cycle Bar
- Fixed-position bar at bottom of screen
- Track: CSS gradient (gold → orange → purple → dark → purple → orange → gold) representing day/night spectrum
- Marker: Circle positioned at `(elapsed % 180) / 180 * 100%` — moves linearly with time
- Color changes: warm gold during day, cool blue during night

---

## 9. Lighting Architecture

### 9.1 Light Types Used
1. **HemisphereLight**: Sky + ground ambient. Intensity 0.25 (night) → 1.35 (day). HSL-shifted per frame
2. **DirectionalLight × 2**: Sun (intensity 0–5, shadow-casting) and Moon (intensity 0.12–0.72, shadow-casting)
3. **PointLight × 4 (orbiting accents)**: Magenta + cyan lights orbit the city at mid-altitude, coloring the cityscape
4. **PointLight × ~20 (street)**: Along boulevard and grand avenue, intensity 5–40
5. **PointLight × ~120 (lamp posts)**: Along every street/avenue sidewalk, with glow sphere + ground pool
6. **PointLight × 6 (fountain ring)**: Color-cycling HSL lights around fountain basin
7. **PointLight per car**: Headlight illumination, range 12
8. **PointLight per shop sign**: Colored from sign palette, intensity 1.5–10
9. **PointLight × 10 (rooftop beacons)**: On tallest buildings, range 180, pulsing

### 9.2 Shadow Strategy
Only 2 lights cast shadows (sun + moon) — shadow maps are expensive. All other lights contribute illumination without shadows. Shadow maps update every 3rd frame.

---

## 10. Vegetation System

### 10.1 Placement Algorithm
Trees and bushes placed procedurally with multiple constraint checks:
1. **Building collision**: `bounds.some(b => |x - b.x| < b.hw + 2 && |z - b.z| < b.hd + 2)`
2. **Fountain exclusion**: `x² + z² < 24²`
3. **Road collision** (`onAnyRoad`): Check against all streets and avenues with 1-unit buffer
4. **Cross-road check**: Street trees skip where avenues cross, avenue trees skip where streets cross
5. **Deduplication**: Min 8-unit spacing between trees
6. **Hash-based density**: `hash2D(x, z) > threshold` for natural randomness

### 10.2 Rendering
3 `InstancedMesh` objects = **3 draw calls** for all vegetation:
- Trunks: `CylinderGeometry(0.15, 0.2, 3, 6)` — brown
- Canopies: `SphereGeometry(1.8, 8, 6)` — dark green
- Bushes: `SphereGeometry(0.8, 6, 4)` — darker green

---

## 11. Offline Video Recording

Accessible via `?record` URL parameter:
- **Fixed timestep**: Every frame advances exactly `1/30` second regardless of actual rendering time
- **captureStream(0)**: Canvas stream with manual frame capture — `stream.getVideoTracks()[0].requestFrame()`
- **MediaRecorder**: VP9 codec, 10 Mbps bitrate, outputs WebM
- **Total**: 5400 frames (180s × 30fps)
- **Hardware-independent**: Same output on fast or slow machines — each frame renders fully before advancing

---

## 12. Performance Optimizations

1. **InstancedMesh**: 60 buildings → 5 draw calls. 500 neon panels → 1 draw call. Trees → 3 draw calls
2. **Hoisted Color constants**: `_fogNight`, `_fogDay`, etc. created once, `.copy().lerp()` per frame — zero allocation
3. **Scratch vectors**: `_lookDir`, `_perpDir`, `_sunDir`, `_negPerp` reused every frame — zero Vector3 allocation
4. **Pre-computed arrays**: Rain `windX[]`, `windZ[]` — eliminates 2500 × 2 trig calls per frame
5. **Throttled vertex normals**: Water `computeVertexNormals()` every 3rd frame only
6. **Shadow map throttle**: Update every 3rd frame via `shadowMap.autoUpdate` toggle
7. **Pixel ratio cap**: `Math.min(devicePixelRatio, 1.5)` — prevents 2x/3x rendering on high-DPI screens
8. **Star visibility toggle**: `starPoints.visible = false` when nightFactor < 0.05 — skips draw call entirely
9. **frustumCulled = false** on particles: Prevents per-frame bounding sphere recalculation for always-visible effects
10. **Return refs, not clones**: Camera system returns scratch vector references instead of `.clone()` — eliminates 120 allocations/second

---

## 13. Utility Functions (Noise & Procedural)

- **hash2D(x, z)**: `fract(sin(x * 127.1 + z * 311.7) * 43758.5453)` — deterministic pseudo-random from 2D coordinates. Used for building placement variance, window on/off, tree scale, car start positions
- **valueNoise2D**: Bilinear interpolation of hash2D at integer grid points with smoothstep blending
- **fbm2D**: Fractal Brownian Motion — 4 octaves of valueNoise2D at increasing frequency/decreasing amplitude. Produces natural-looking terrain variation
- **neonPalette**: 4 base colors (cyan `#19f9ff`, magenta `#ff3df2`, purple `#7a5cff`, blue `#2e7bff`)
- **sampleNeon**: Selects from palette by index, shifts HSL by variance parameter — ensures every neon element has a unique but harmonious color

---

## 14. Quick-Reference: How to Answer Viva Questions

### "How did you make the buildings?"
60 hand-placed buildings with explicit coordinates across 5 districts. Each is a BoxGeometry with PBR materials (color, normal, roughness, metalness, AO, emission maps). Procedural window emissive textures generated via canvas. InstancedMesh groups buildings by material type for efficient rendering (5 draw calls instead of 60). Decorated with neon panels, strips, shop signs, billboards, and rooftop beacons.

### "How does the sun/moon/timeline work?"
Sinusoidal cycle: `0.5 + 0.5 * sin(t * 2π/180 + π/2)` — starts day, reaches midnight at 90s, returns to day at 180s. Sun position computed from elevation angle + camera look direction so sunset is visible. Moon is fixed at (-300, 280, -600). Sky, fog, lighting, bloom all interpolate between day/night presets. HUD bar shows linear progress.

### "How do the cars move?"
~88 cars on named roads with defined lanes, directions, speeds. Constant velocity with wrap-around at ±420 units. Building/fountain collisions precomputed as blocked intervals per lane at initialization — cars teleport past blocked zones. Zero per-frame collision testing.

### "How does the camera work?"
CatmullRomCurve3 spline with 49 waypoints forming a closed loop. Separate position and look-target curves. 180s loop synced to day/night cycle. Altitude-adaptive behavior via smoothstep: street-level adds subtle head motion and neon-gazing; high altitude adds bird-like banking sway.

### "What textures did you use?"
PBR texture sets from ambientCG: asphalt (roads), paving stone (sidewalks), concrete, 3 facade types, metal. Each set includes color, normal, roughness maps; some include metalness, AO, emission. Plus 4 procedural canvas textures: window grids, shop signs, holographic billboards, crosswalk stripes, cloud puffs.

### "How does reflection work?"
Two mechanisms: (1) EXR environment maps processed by PMREMGenerator — rough surfaces see blurry reflections, smooth surfaces see sharp ones (PBR standard). (2) MeshPhysicalMaterial clearcoat on roads and puddles — adds a second specular layer for wet-surface reflections. Metalness controls Fresnel reflectivity.

### "What lighting effects are there?"
9 light types (hemisphere, 2 directional, 4 orbiting point, ~150 street/lamp/beacon/shop/car point lights). Post-processing: bloom (UnrealBloomPass), chromatic aberration, film grain, vignette. Additive blending on all glow objects. All lights dynamically animated by time and day/night cycle.

### "How did you load external objects?"
GLTFLoader for car model (Car.glb) and street lamp (sci-fi_street_lamp.glb). Fallback box-geometry versions if load fails. Cars: cloned per instance with unique paint color applied to all child meshes. Lamps: cloned per street position.

### "What CG concepts are demonstrated?"
Rendering pipeline (vertex/fragment shaders, rasterization, depth buffer), affine transformations (model/view/projection matrices, instanced transforms), PBR lighting (Cook-Torrance BRDF, GGX distribution, Schlick Fresnel), texture mapping (UV, normal maps, procedural textures), shadow mapping (PCF, orthographic frustum), IBL (EXR → PMREM), post-processing (bloom, custom GLSL shader), particle systems (physics simulation, Euler integration), spline interpolation (Catmull-Rom), fog (exponential), alpha/additive blending, tone mapping (ACES filmic), color space (sRGB gamma).

### "How did you make the world?"
Procedural city generation with 5 themed districts around a central fountain plaza. 7 east-west streets + 5 north-south avenues forming a grid. Buildings placed with explicit coordinates respecting road clearances. Vegetation uses multi-layered constraint checks (building AABB, road collision, cross-road check, fountain exclusion). Everything built from code — no scene editor.

### "What about Blender equivalences?"
We implement in code what Blender provides via GUI: Principled BSDF = our MeshStandardMaterial with PBR maps; Particle System = our BufferGeometry+Points with physics; Keyframe Animation = our spline curves + sinusoidal oscillations; Compositor = our EffectComposer; HDRI Lighting = our EXR+PMREMGenerator. We understand the underlying math because we wrote it.

### "How is motion implemented?"
Three motion systems: (1) Camera: spline interpolation along closed curve at constant speed; (2) Cars: constant velocity on lanes with precomputed collision avoidance; (3) Sun: orbital arc computed from sinusoidal day/night cycle, positioned relative to camera look direction. Plus animated elements: orbiting accent lights, pulsing beacons, drifting fog, rotating fountain mist, water vertex displacement, cloud drift.

### "How did you optimize performance?"
InstancedMesh (5 draw calls for 60 buildings), hoisted Color/Vector3 constants (zero per-frame allocation), pre-computed rain wind arrays (eliminates 5000 trig calls/frame), throttled vertex normals (every 3rd frame), throttled shadow maps (every 3rd frame), pixel ratio cap (1.5), star visibility culling, return refs instead of clones.
