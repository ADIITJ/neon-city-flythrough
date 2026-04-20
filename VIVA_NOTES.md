# Neon City — Viva Preparation Notes
### Atharva Date & Samay Mehar | Computer Graphics Course Project

---

## Why We Chose to Code Everything From Scratch

The assignment originally expected Blender and Unity. We deliberately chose Three.js (a JavaScript library that talks directly to WebGL, the browser's GPU interface) because it forced us to implement every computer graphics concept by hand in code. In Blender, you place a light in the scene and adjust a slider; in our project, we create the light object, define its color and intensity, compute its position on the fly based on time-of-day math, manage its shadow map resolution, and decide which frames to update that shadow map on. In Unity, you click "Add Component > Bloom"; in our project, we instantiate the bloom pass, set the brightness extraction threshold, the blur radius, and the glow strength — and then we animate all three of those parameters every single frame as the scene transitions between day and night. Every concept the course covers — transformations, lighting models, texturing, shading, shadows, curves, particles — we had to write ourselves. There is no drag-and-drop, no visual editor. The scene graph, the materials, the animation loop, the post-processing pipeline: all of it is authored in ~2400 lines of JavaScript and GLSL.

For reference, here is what we implement in code and what its Blender/Unity equivalent would be:
- Blender's Principled BSDF shader → we configure physically-based materials (PBR) with individual maps for color, normals, roughness, metalness, ambient occlusion, and emission
- Blender's particle system → we build particle systems from raw float arrays, writing the physics (gravity, velocity, air resistance) ourselves
- Blender's keyframe animation → we use mathematical spline curves and sinusoidal functions to drive all motion
- Blender's compositor nodes → we chain render passes: a scene render, then a bloom pass, then a custom GLSL shader for chromatic aberration, film grain, and vignette
- Blender's HDRI environment lighting → we load EXR environment maps and pre-filter them into mipmap chains for roughness-dependent reflections

The point: we understand what these tools do internally because we built the equivalent ourselves.

---

## How the Rendering Works — From GPU to Screen

Everything starts with WebGL 2, the browser's interface to the GPU. Our renderer is configured with several important settings that directly map to CG theory:

**The rendering pipeline** follows the classic stages. Every mesh in our scene is defined by vertices (positions in 3D space). The GPU's vertex stage transforms each vertex through three matrices — the **model matrix** (where is this object in the world?), the **view matrix** (where is the camera looking from?), and the **projection matrix** (how does 3D map onto a 2D screen?). In GLSL, this is the familiar `gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0)`. After vertex processing, the GPU rasterizes triangles into fragments (candidate pixels), and the fragment shader computes the final color of each pixel using material properties, lighting, and textures.

Our camera uses a **perspective projection** with a 55-degree field of view. We chose 55 degrees rather than the more common 60 or 75 because it creates a slight telephoto compression effect — buildings look more imposing, streets feel longer, and the overall framing feels cinematic rather than wide-angle.

For **depth** (determining which objects are in front of others), WebGL uses a Z-buffer. Every fragment writes its depth, and if another fragment at the same pixel is closer, it overwrites it. We selectively disable depth writing for certain transparent objects — neon glows, rain particles, fog volumes — because these objects should layer on top of each other additively rather than occluding one another.

**Tone mapping** is how we handle the fact that our scene has brightness values far exceeding what a monitor can display. A neon sign might have a brightness of 3.0 in our internal HDR representation, but the screen can only show 0.0–1.0. We use ACES Filmic tone mapping — the same S-curve used in Hollywood film post-production — which gracefully compresses bright highlights while preserving shadow detail. We also dynamically adjust the exposure (0.80–1.60) based on camera altitude and time of day, simulating how a real camera or human eye adapts to brightness. At street level at night, exposure is boosted so you can see road detail; high in the sky during the day, it's pulled back to avoid blowout.

The final output is in **sRGB color space** with gamma correction, ensuring colors appear perceptually correct on standard monitors.

---

## Building the World — From Empty Scene to Living City

### The City Layout

The city is organized around a central fountain plaza at the origin (0, 0, 0), with five themed districts radiating outward:

- **Financial Core** (center, within 80 units): 12 glass skyscrapers reaching up to 220 units tall — the most imposing structures
- **Entertainment District** (east): 16 buildings covered in neon facades and shop signs, heights 55–110
- **Residential District** (west): 17 buildings with warm window lighting, heights 42–60, more trees between them
- **Industrial District** (north): 6 wide, low warehouses in metal and concrete, heights 28–38
- **Civic/Park District** (south): 6 low civic buildings with open spaces, heights 20–28

The street grid consists of 7 east-west streets and 5 north-south avenues. The Grand Boulevard (east-west, z=0) is the widest at 36 units; the Grand Avenue (north-south, x=0) is 28 units wide. Side streets are 22 units. Every street and avenue has a name in the code (`BLVD_Z`, `ST_N1`, `AVE_EAST`, etc.), and width functions return the correct size for any given road.

### How Buildings Are Constructed

Each building starts as a box — a `BoxGeometry(width, height, depth)` — positioned so its base sits on the ground (we shift it up by half its height). Every one of the 60 buildings has hand-picked coordinates, dimensions, and a material type. There are five material categories, each using a different set of **physically-based rendering (PBR) textures**:

1. **Glass facades** (Financial Core) — full PBR set: color map, normal map, roughness map, metalness map, emission map, ambient occlusion map
2. **Residential facades** — color, normal, roughness, metalness maps; warmer tones
3. **Metal** (Industrial) — industrial steel look
4. **Concrete** (Civic/Industrial) — matte, rough surfaces
5. **Neon Facade** (Entertainment) — brightest emissive glow, most colorful at night

Now, what are all these texture maps actually doing?

The **color map** (also called albedo) provides the base color of the surface — the "paint" of the material. The **normal map** is more interesting: it encodes tiny surface bumps and grooves as RGB values that represent XYZ normal directions. When the lighting shader reads a normal map, it perturbs the surface normal at each pixel, creating the illusion of detailed surface geometry (brick lines, panel seams, scratches) without adding any actual polygons. The **roughness map** tells the shader how microscopically smooth or rough each pixel is — a smooth pixel creates a tight, bright specular highlight, while a rough pixel creates a wide, dim one. The **metalness map** classifies each pixel as metallic or dielectric (non-metallic), which changes how it reflects light: metals tint their reflections with their base color, while dielectrics reflect white. The **ambient occlusion map** contains pre-baked soft shadows in crevices and corners, darkening those areas to add depth. The **emissive map** marks which pixels glow — for building facades, this is the window texture, making lit windows shine independently of scene lighting.

For every texture, we set it to tile (`RepeatWrapping`) and repeat at appropriate scales — for example, asphalt tiles 3 times across the road width and 80 times along its length. We also enable **anisotropic filtering** at level 8, which prevents textures from becoming blurry when viewed at steep angles — critical for long roads stretching into the distance.

Under the hood, these PBR materials use the **Cook-Torrance microfacet BRDF**, which is the industry-standard physically-based lighting equation:

```
f(l,v) = D(h) * F(v,h) * G(l,v,h) / (4 * (n.l) * (n.v))
```

**D** is the GGX normal distribution function — it describes how microfacets are oriented, controlled by roughness. A low roughness means most microfacets point in the same direction, creating sharp reflections. **F** is the Fresnel term (Schlick's approximation) — it makes surfaces more reflective at grazing angles, which is why you can see reflections on a road at a low angle but not when looking straight down. **G** is the geometry/shadowing function (Smith-GGX) — it accounts for microfacets blocking each other. Together, these three terms produce realistic material appearance from a handful of texture inputs.

### Procedural Textures — Generated at Runtime

Not every texture is loaded from a file. We generate several at runtime by drawing on HTML Canvas elements and uploading the result to the GPU:

- **Window grids**: A 256x512 canvas where we draw a grid of colored rectangles. A hash function (`sin(col * 127.1 + row * 311.7) * 43758.5`) deterministically decides which windows are on or off, and whether they're warm (yellow, amber) or cool (blue, cyan, pink). This canvas becomes the emissive map on building facades, so at night, scattered windows glow in different colors.
- **Shop signs**: We render text labels like "NEXUS", "CYBER BAR", "RAMEN", "DRONE HUB" onto canvas with colored borders and glow effects. These become textures on planes mounted to Entertainment district buildings.
- **Holographic billboards**: Gradient backgrounds with scanline overlays and large text — mounted on the tallest buildings. These pulse in opacity to simulate flickering holograms.
- **Crosswalk stripes**: Simple striped patterns applied semi-transparently at every intersection.
- **Cloud puffs**: 8 overlapping radial-gradient ellipses drawn on a 512x256 canvas, creating a fluffy cloud texture used on billboard planes in the sky.

### Building Decorations

Beyond the basic box shape, each building receives layers of detail:

- **500 neon panels** distributed across building faces at random heights and positions. Each is a thin glowing box with a unique color sampled from our neon palette (cyan, magenta, purple, blue with HSL variance). They use **additive blending** — their color adds to whatever is behind them rather than replacing it, which is physically correct for light emission. Overlapping neon panels produce brighter areas naturally.
- **400 horizontal neon strips** — thin glowing lines that wrap around tall buildings, giving them a "Tron"-like banded appearance.
- **Shop signs with point lights** — text signs on Entertainment and Financial buildings, each with a colored point light nearby that casts actual illumination onto the surroundings.
- **Holographic billboards** on the tallest buildings — large pulsing translucent planes.
- **Rooftop beacons** on the top 10 tallest buildings — pulsing point lights (range 180 units, intensity up to 42) with glowing sphere meshes. These are visible from across the city.
- **Light spill planes** — 200 semi-transparent colored planes on the ground around building bases, simulating the glow that building lights cast onto nearby pavement.

All neon panels, strips, light spills, and puddles use **instanced rendering** — a single draw call handles all 500 neon panels, for example, because they share the same geometry and material but differ only in their per-instance 4x4 transform matrix and color. This is the single biggest performance optimization: instead of the GPU processing 500 separate draw calls (each with CPU overhead for state changes), it processes one call with 500 instances.

---

## Streets, Sidewalks, and Ground Details

Roads use a **MeshPhysicalMaterial** — a more advanced material type that supports a **clearcoat** layer. Clearcoat simulates a thin transparent lacquer on top of the base material. On our roads, this creates the wet-road look you see in film noir: at night, the clearcoat value increases from 0.15 to 0.55, making the road surface shinier, reflecting neon lights and headlights. The underlying asphalt texture (from a PBR set: color, normal, roughness) provides the gritty base, while the clearcoat adds that wet sheen on top.

Center road markings use a separate texture set with an **alpha map** (opacity mask) — the paint lines are opaque where the alpha is white, and transparent everywhere else, so the asphalt shows through between the lines. Main roads also get **neon edge strips** — thin glowing lines along both edges using additive blending.

Sidewalks sit 2.2cm above road level (matching real-world curb height proportionally) with paving stone PBR textures and concrete curbs. Crosswalks at every intersection use the procedurally-generated striped texture.

**50 puddles** are scattered on roads using instanced rendering. Each puddle is a circle with `MeshPhysicalMaterial` set to very low roughness (0.06), moderate metalness (0.25), and full clearcoat — making them highly reflective, mirror-like spots on the road surface.

---

## The Fountain — Water Simulation and Vertex Displacement

At the center of the city sits a two-tiered circular fountain. The lower basin is a disc of radius 9.6 units; the upper tier sits at 1.8 units height with radius 4.5. A central spire rises to 6.5 units with an emissive glow. Six colored lights ring the basin, slowly cycling through the hue spectrum.

The water surface demonstrates **vertex displacement** — one of the most direct applications of manipulating geometry at runtime. Each frame, we iterate through every vertex of the water mesh and modify its Y (height) coordinate:

The water has three overlapping wave patterns:
1. **Expanding concentric rings**: `sin(distance * 0.8 - time * 3.5) * 0.18 * edgeFactor` — these radiate outward from the center. The `edgeFactor` (distance/radius) makes the center calm and the edges active, mimicking how a central fountain jet creates ripples that grow as they travel outward.
2. **Faster secondary ripples**: `sin(distance * 1.6 - time * 5.0 + 1.2) * 0.10` — a higher frequency wave traveling at a different speed, creating realistic interference patterns.
3. **Cross-interference waves**: `sin(x * 0.5 + time * 2.0) * cos(z * 0.5 + time * 1.8) * 0.08` — the product of two perpendicular sine waves creates a choppy, turbulent pattern.

After modifying vertex positions, the lighting needs updated surface normals. We call `computeVertexNormals()` to recalculate normals based on the new geometry — but only every 3rd frame, because this is computationally expensive and the visual difference at 60fps is imperceptible.

The upper tier has its own simpler ripple pattern simulating vigorous splashing from the central jet impact.

Cascade rings (torus shapes) between the tiers simulate water overflow, with pulsing opacity to suggest flowing water.

### Fountain Spray Particles

500 particles simulate the water spray using **Euler integration** — the simplest numerical method for physics simulation:

```
velocity.y -= gravity * deltaTime    // acceleration changes velocity
position   += velocity * deltaTime    // velocity changes position
```

The particles are organized into three subsystems:
- **150 central jet particles**: Launch upward from the spire tip with velocity 3–6 m/s, heavy gravity (16 m/s²), creating a tall narrow column that arcs back down
- **240 ring jet particles**: 8 jets evenly spaced around the upper tier rim, each launching outward and upward in a parabolic arc that lands in the lower basin
- **110 splash mist particles**: Low, wide, slow-moving particles around the basin rim with air resistance (velocity damped by 2% per frame), simulating the fine mist that hangs around the base of any large fountain

Each particle has a lifetime; when it expires or falls below the water surface, it resets to its launch position with fresh random velocity.

---

## Lighting — How the Scene is Illuminated

Lighting is arguably the most complex system in the project because nearly every light in the scene is animated.

### Light Types and Their Roles

**Hemisphere light** provides base ambient illumination — it simulates light coming from the sky (upper hemisphere, blue-tinted) and ground bounce (lower hemisphere, warm-tinted). Its intensity ranges from 0.25 at night to 1.35 during the day, and its hue shifts per frame.

**Two directional lights** represent the sun and moon. Directional lights simulate infinitely distant light sources where all rays are parallel — exactly how sunlight and moonlight behave. The sun ramps from 0 to 5.0 intensity during the day; the moon from 0.12 to 0.72 at night. Both cast **shadow maps**.

Shadow mapping works by rendering the scene from the light's perspective into a depth texture (the shadow map). When rendering the main scene, each pixel checks: "if I project this point into the light's depth map, is something closer blocking it? If yes, this pixel is in shadow." We use **PCF (Percentage-Closer Filtering)** which samples multiple neighboring depth values and averages the result, producing soft shadow edges instead of harsh aliased ones. Each shadow map is 1024x1024 pixels with an orthographic camera covering a 1000x1000 unit area.

**Four orbiting accent lights** (two magenta, two cyan) slowly circle the city at mid-altitude. These are purely aesthetic — they cast colored light onto building facades and streets, creating the cyberpunk color palette. Their intensities surge from 2–3 during the day to 22–28 at night.

**~20 street-level point lights** along the boulevard and grand avenue provide ground-level illumination, ranging from intensity 5 (day) to 40 (night).

**~120 lamp post lights** line every sidewalk. Each lamp post has: a pole mesh (cylinder), a glow sphere (additive blending), and a ground light pool (a flat circle on the pavement, also additive). If a GLTF lamp model loads, it replaces the cylinder; otherwise the simple geometry serves as a fallback.

**6 fountain ring lights** cycle through HSL color space, creating slowly shifting rainbow illumination on the water.

**Per-car headlights**: Each car has a point light with range 12 units, casting a warm pool of light ahead of it.

**Per-sign lights**: Each shop sign has an associated colored point light that illuminates nearby surfaces.

**10 rooftop beacons**: Pulsing aviation-style lights on the tallest buildings, with glowing sphere meshes visible from anywhere in the city.

### Shadow Optimization

Shadow maps are expensive — rendering the entire scene from the light's viewpoint is essentially rendering the scene twice. Since buildings don't move, we only update shadow maps every 3rd frame. The visual cost of a 3-frame-old shadow is negligible, but the performance gain is significant. Only 2 of the 150+ lights cast shadows; the rest contribute illumination without the shadow map cost.

### Image-Based Lighting (IBL)

Beyond direct lights, surfaces also reflect the environment around them. We load two **EXR environment maps** (high dynamic range photographs of real environments): one of a night sky, one of a daytime outdoor scene. These are processed through a **PMREMGenerator** (Pre-filtered Mipmap Radiance Environment Map) — this pre-computes blurred versions of the environment at multiple mip levels. When a shader samples the environment for a reflection, a rough surface (say, concrete at roughness 0.78) samples a heavily blurred mip level and sees only vague color, while a smooth surface (say, a car body at roughness 0.22) samples a sharp mip and sees clear reflections. This is physically accurate: rougher surfaces scatter reflected light more, producing blurry reflections.

The active environment map swaps between day and night when the daylight value crosses 0.5, and the environment intensity interpolates between 0.35 (dim night) and 1.0 (bright day).

---

## The Camera — Spline Fly-Through

The camera follows a predefined path through the city, implemented using a **Catmull-Rom spline** — a type of cubic interpolating spline that passes exactly through its control points (unlike Bezier curves, which are pulled toward control points but don't necessarily touch them).

We define 49 waypoints for the camera position and 49 corresponding waypoints for the look-at target. The Catmull-Rom algorithm generates a smooth, continuous curve through all 49 points. We use the **centripetal** parameterization (tension 0.5), which prevents cusps and overshooting that can occur with uniform parameterization — this is the same method used in film camera path tools.

The curve is **closed** (loops seamlessly), so the camera returns to its starting point after 180 seconds. The parameter `t` advances linearly: `t = (elapsed % 180) / 180`, giving constant speed along the curve. We evaluated whether to use an easing function at the loop seam, but found that the centripetal Catmull-Rom curve is already smooth at the seam point, so linear parameterization produces the smoothest result.

### The Flight Path

The camera takes a dramatic tour:
- Starts at altitude 400, looking down through clouds at the entire city
- Descends in a spiral through the cloud layer (y=400→120)
- Sweeps across the Financial Core rooftops
- Dives to street level on the Grand Avenue, heading toward the Entertainment district
- Weaves between neon-lit buildings
- Turns north along the East Avenue
- Arcs west through the Industrial district
- Circles the central fountain at near-ground level (y=4–8)
- Climbs along the Residential avenue
- Rises back to y=80 to close the loop

Every waypoint was verified against the building layout — the camera never clips through a building. Ground-level waypoints follow road centerlines.

### Altitude-Adaptive Camera Behavior

The camera doesn't just follow the spline blindly. Based on its current altitude, it adds subtle behavioral variations using **smoothstep blending** — a smooth mathematical interpolation function that transitions from 0 to 1 over a defined range without sudden jumps:

```
streetFactor = 1 - smoothstep(altitude, 10, 60)   // 1 at ground, fading to 0 by altitude 60
highFactor   = smoothstep(altitude, 150, 250)       // 0 below 150, fading to 1 by altitude 250
```

At **street level** (streetFactor near 1): the look-at target shifts upward at night (so the camera gazes at neon signs overhead) and slightly downward during the day (to see roads, trees, scenery). There's subtle left-right oscillation to simulate a pedestrian's natural head movement.

At **high altitude** (highFactor near 1): the camera adds gentle banking sway — slow sinusoidal offsets to position and target that simulate a bird gliding over the city, looking around at the panorama.

In the **mid-altitude range** (both factors near 0): the camera follows the spline cleanly with no added motion, preventing any jarring transitions between the two behavioral modes.

The camera also adjusts based on **day vs. night**: at night, it looks more upward toward bright neon signs and beacons; during the day, it looks more outward to appreciate the scenery and geometry.

---

## Day/Night Cycle — The Math Behind Time of Day

The entire scene transitions between day and night over 180 seconds using a single sinusoidal function:

```
cycle = 0.5 + 0.5 * sin(elapsed * 2π/180 + π/2)
```

Breaking this down:
- The `sin` function oscillates between -1 and +1
- `0.5 + 0.5 * sin(...)` maps this to the range [0, 1]
- The `2π/180` factor sets the period to 180 seconds
- The `+π/2` phase offset starts at the peak (cycle=1 = bright day)

The timeline:
- t=0s: sin(π/2) = 1 → cycle = 1.0 (noon, brightest day)
- t=45s: sin(π) = 0 → cycle = 0.5 (sunset)
- t=90s: sin(3π/2) = -1 → cycle = 0.0 (midnight, darkest night)
- t=135s: sin(2π) = 0 → cycle = 0.5 (sunrise)
- t=180s: sin(5π/2) = 1 → cycle = 1.0 (noon again, loop complete)

The raw cycle value is then passed through `smoothstep(cycle, 0.18, 0.82)` to produce `daylight` — this flattens the extremes so that "full day" and "full night" each last longer, while dawn/dusk transitions happen smoothly over a shorter interval. This avoids the unrealistic look of a cycle that's always changing.

`nightFactor = 1 - daylight` gives us the complementary value for night-specific effects.

### The Sun's Orbit

The sun doesn't just appear and disappear — it physically orbits across the sky. Its position is computed from the day/night cycle and the camera's current look direction:

**Elevation**: `sunY = clamp(cycle * 2 - 1, -1, 1) * 500` — at noon (cycle=1), the sun is at altitude 500 (zenith). At cycle=0.5, it's at the horizon (y=0). Below cycle=0.5, it's below the horizon and hidden.

**Horizontal position**: The sun orbits at a horizontal radius of `cos(elevation) * 1200` from the camera position. The clever part is that this orbit is **directed toward where the camera is looking** — so as the sun sets, it sets in the direction the camera faces, making the sunset visible on screen. During sunrise, the sun comes from the perpendicular left, creating an asymmetric and more cinematic motion. The `horizBlend` factor (1 at horizon, 0 at zenith) controls how much the sun's horizontal position is offset toward the camera's forward direction.

**Sunset glow**: A large semi-transparent sphere (radius 200) centered on the sun produces a warm atmospheric glow. Its opacity peaks during the transition period (horizBlend * daylight * (1-daylight) * 4 reaches maximum when daylight is near 0.5 — i.e., dawn/dusk). During these transitions, the sky color and fog color also lerp toward warm orange tints.

### What the Cycle Controls

Nearly every visual property in the scene is driven by the daylight/nightFactor values:

**Sky and atmosphere**: Sky color transitions from dark (#04080f) to blue (#5a9ec8). Fog color does the same. Fog density increases 40% at night for moodier atmosphere. The environment map swaps between night EXR and day EXR.

**Lighting intensities**: Sun light 0→5, moon light 0.72→0.12, ambient 0.25→1.35, accent lights 2→25, street lights 5→40, shop sign lights 1.5→10. Every light in the scene responds to time of day.

**Materials**: Building emissive intensity (window glow) ramps from 18% to 100% of base values. Neon panel opacity goes from 0.12 to 0.70. Road clearcoat (wet look) increases from 0.15 to 0.55. Road color itself shifts between warmer and cooler tones.

**Post-processing**: Bloom strength increases from 0.12 (barely visible) to 0.60 (prominent neon glow). Bloom threshold decreases from 0.85 to 0.70, meaning more of the scene blooms at night. Exposure adjusts for overall brightness balance.

**Celestial objects**: Stars are hidden entirely when nightFactor < 0.05 (full day) by toggling their visibility flag, which completely skips their draw call. Star opacity ramps to 0.96 at night. Moon glow ramps similarly.

### The HUD Timeline Bar

A minimal CSS bar at the bottom of the screen shows cycle progress. The track is a gradient (gold → orange → purple → dark → purple → orange → gold) representing the day-night spectrum. A marker dot moves linearly across it: `left = (elapsed % 180) / 180 * 100%`. The marker changes color — warm gold during day, cool blue during night.

---

## Cars — Motion and Collision Avoidance

~88 cars populate the road network. Each car is constructed as a group of meshes: a body box, a roof box, headlights (with a point light and glow sphere), and taillights. If an external GLTF car model loads, it replaces the box geometry — each clone gets a unique paint color from a 16-color palette of dark jewel tones and neon accents.

Cars move at constant speeds (12–28 units/second) along their lanes, wrapping around the city boundaries (±420 units). The interesting part is **collision avoidance with buildings and the fountain**.

Rather than checking every car against every building every frame (which would be expensive and complex), we **precompute blocked intervals at initialization**. For each lane (defined by which road it's on and a lateral offset for its direction), we:

1. Test every building's axis-aligned bounding box (AABB) against the lane. If the lane's cross-axis coordinate falls within the building's extent on that axis, we record the building's extent along the travel axis as a "blocked interval" — a range of positions the car cannot occupy.
2. Test the fountain circle (radius 26 at origin). If the lane intersects the circle, we compute the chord of intersection and record it as a blocked interval.
3. Merge all overlapping intervals.

At runtime, when a car's position enters a blocked interval, we simply teleport it past: `position = intervalEnd + 0.5`. This is O(1) per car per frame — just a linear scan through the pre-sorted intervals — compared to O(n) building checks otherwise.

---

## Particle Systems — Rain, Atmosphere, Clouds, Fountain

We implement four independent particle systems. Each stores particle positions in a raw `Float32Array`, updates them every frame with simple physics, and uploads the modified buffer to the GPU.

**Rain (2500 particles)**: Each raindrop has a downward velocity (120–280 units/second) and per-particle wind sway. The wind sway is **pre-computed** into arrays at initialization (`windX[i] = sin(i * 12.9898) * 2.5`, `windZ[i] = cos(i * 4.123) * 8`), eliminating 5000 trigonometric function calls per frame. When a drop hits the ground, it respawns at a random position above the camera. The rain system follows the camera so it's always raining around the viewer.

**Atmosphere dust (380 particles)**: Slow-moving colored specks that create a sense of depth and atmosphere. Each particle is colored from the neon palette. The entire system slowly rotates and follows the camera position. Opacity scales with night factor — more visible dust in the neon-lit night.

**Clouds (40 cloud puffs, 80 planes)**: Each cloud puff is two perpendicular billboard planes (forming a cross shape) textured with the procedural cloud canvas. The cross arrangement gives the illusion of volume from any viewing angle. Clouds drift very slowly and their opacity depends on camera proximity — they're most visible when the camera is at cloud altitude (180–280 units), creating the immersive effect of flying through clouds during the descent phase.

**Fountain spray (500 particles)**: Described in detail in the fountain section — three sub-systems with Euler physics integration, gravity, and air resistance.

---

## Post-Processing — The Final Image

After the 3D scene renders, we apply three post-processing passes in sequence:

**Pass 1 — Scene render**: The standard 3D render of the entire scene into a framebuffer.

**Pass 2 — Bloom (UnrealBloomPass)**: This extracts all pixels brighter than a threshold, applies a multi-pass Gaussian blur to them, and composites the blurred result back additively. The result: bright objects (neon signs, lamps, sun) get soft glowing halos. At night, the threshold drops and strength increases, so more objects bloom more intensely — this is what gives the nighttime scene its signature neon glow.

**Pass 3 — Cinematic shader (custom GLSL)**: A fragment shader we wrote that applies three effects:

- **Chromatic aberration**: Splits the RGB channels slightly, with offset proportional to distance² from screen center. The red channel is sampled slightly outward, the blue slightly inward, and the green at the correct position. This simulates the way real camera lenses fail to focus all wavelengths to the same point, creating colored fringing at the edges. The effect is very subtle (0.15% offset) but adds a filmic quality.

- **Film grain**: A per-pixel pseudo-random noise function (`fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453)`) modulated by time produces subtle grain that changes every frame, simulating the analog noise of film stock.

- **Vignette**: A simple darkening toward screen edges (`1.0 - distance * 0.6`) that draws the viewer's eye toward the center and adds a cinematic frame.

---

## Vegetation — Trees and Bushes

Trees and bushes are placed procedurally along sidewalks, around the fountain, and in park/residential areas. The placement algorithm applies multiple constraints to ensure no vegetation ends up in the middle of a road or inside a building:

1. **Building collision check**: Test against every building's bounding box with a 2-unit buffer
2. **Fountain exclusion**: No vegetation within 24 units of the origin
3. **Universal road check** (`onAnyRoad`): Test against all 7 streets and 5 avenues with 1-unit buffer
4. **Cross-road check**: Street-side trees skip positions where avenues cross (and vice versa) — preventing trees in the middle of intersections
5. **Deduplication**: Minimum 8-unit spacing between trees
6. **Hash-based density control**: `hash2D(x, z) > threshold` provides deterministic pseudo-random thinning for a natural distribution

Trees are rendered as three instanced meshes (3 draw calls total): brown cylinders for trunks, green spheres for canopies, and smaller darker spheres for bushes. Each instance has a randomized scale and rotation.

---

## Noise Functions and Procedural Randomness

Deterministic randomness is essential throughout the project — we need "random-looking" values that are the same every time the scene loads (so buildings, windows, trees are consistent). Our core function is:

```
hash2D(x, z) = fract(sin(x * 127.1 + z * 311.7) * 43758.5453)
```

This takes any two coordinates and returns a pseudo-random value in [0, 1). The large prime multipliers and the transcendental sin function create chaotic but deterministic output. This is used everywhere: which windows are lit, tree scales, car starting positions, neon panel heights, bush placement density.

On top of this, `valueNoise2D` provides smooth noise by interpolating hash values at integer grid points with smoothstep blending. And `fbm2D` (Fractal Brownian Motion) layers 4 octaves of value noise at doubling frequencies and halving amplitudes — this produces the organic, natural-looking patterns used for terrain-like variation.

For color, `sampleNeon` picks from a 4-color palette (cyan, magenta, purple, blue) and shifts the HSL values by a variance parameter, ensuring every neon element has a unique but harmonious color.

---

## Offline Video Recording

The animation can be recorded to a video file by adding `?record` to the URL. This activates a hardware-independent fixed-timestep renderer:

Instead of using `requestAnimationFrame` (which ties to the monitor's refresh rate and the GPU's rendering speed), the recorder advances time by exactly 1/30th of a second per frame. On a fast machine, this means the recording finishes quickly. On a slow machine, it takes longer, but the output video is identical — every frame is fully rendered before advancing to the next.

Technically: `canvas.captureStream(0)` creates a video stream from the canvas with manual frame capture. After each frame renders, `stream.getVideoTracks()[0].requestFrame()` signals that a new frame is ready. A `MediaRecorder` with VP9 codec at 10 Mbps collects all frames. After 5400 frames (180s × 30fps), the recorder stops and the browser downloads a `.webm` file.

---

## Performance Strategy

Real-time rendering at 60fps with 60 buildings, 150+ lights, 3500+ particles, and multiple post-processing passes requires careful optimization:

- **Instanced rendering**: The biggest win. 60 buildings become 5 draw calls. 500 neon panels become 1. Trees become 3. Total: ~15 instanced draw calls instead of 1200+ individual ones.
- **Zero per-frame allocation**: All Color objects, Vector3 scratch variables, and math intermediates are created once at initialization and reused via `.copy()` and `.lerp()`. Garbage collection pauses are eliminated.
- **Pre-computed arrays**: Rain wind sway values are calculated once, saving 5000 trigonometric calls per frame.
- **Throttled expensive operations**: Water vertex normals recomputed every 3rd frame. Shadow maps updated every 3rd frame. Visual impact: negligible. Performance impact: significant.
- **Pixel ratio capped at 1.5**: On a 2x or 3x Retina display, rendering at native resolution would mean 4x–9x the pixels. Capping at 1.5x keeps quality high with manageable GPU load.
- **Visibility culling**: Stars are completely hidden during bright day (skipping their draw call), fountain spray particles reset on lifetime expiry rather than being checked every frame.

---

## How to Answer Any Question — Category Guide

**If asked about textures**: Explain PBR texture pipeline — we load 6 types of maps (color, normal, roughness, metalness, AO, emission) from physical material scan sets. Normal maps create surface detail without geometry. Roughness/metalness feed the Cook-Torrance BRDF. We also generate procedural textures at runtime using Canvas2D for windows, signs, billboards. Anisotropic filtering at level 8 keeps textures sharp at oblique angles.

**If asked about reflections**: Two systems. (1) Environment-map reflections via EXR images processed by PMREMGenerator into roughness-dependent mip chains — smooth surfaces get sharp reflections, rough ones get blurry reflections. (2) Clearcoat material on roads and puddles adds a second specular layer for wet-look reflections. Fresnel effect (Schlick approximation) makes surfaces more reflective at grazing angles.

**If asked about motion/animation**: Three motion systems. Camera follows a Catmull-Rom spline (49 waypoints, closed loop, centripetal parameterization). Cars use constant velocity with precomputed blocked intervals for collision avoidance. Sun orbits using trigonometric functions tied to the sinusoidal day/night cycle, positioned relative to camera look direction. Plus: orbiting accent lights, pulsing beacons, water vertex displacement, particle physics, cloud drift — all driven by elapsed time and delta time.

**If asked about camera**: Catmull-Rom spline is a cubic interpolating curve that passes through every control point. Centripetal parameterization prevents cusps. Closed loop means seamless repeat. We use two parallel curves (position + look target) and add altitude-adaptive behavior via smoothstep blending — no hard thresholds, so the camera transitions smoothly between street-level and aerial behavior.

**If asked about lighting**: 9 categories of lights totaling 150+ light sources. PBR materials respond to lighting via Cook-Torrance BRDF. Two shadow-casting directional lights (sun, moon) with PCF shadow maps. IBL from EXR environment maps. Every light's intensity and color is animated by the day/night cycle. Additive blending on glow objects (neon, lamps, fog) produces physically correct light accumulation.

**If asked about the world/scene construction**: Entirely procedural — no scene editor. 5 themed districts with 60 hand-placed buildings. 12-road grid system. Constraint-based vegetation placement. Central fountain with animated water. ~88 cars with collision-free lanes. Everything built from code using 3D primitives (boxes, cylinders, spheres, planes) plus PBR materials plus procedural decorations.

**If asked about shaders**: We wrote a custom GLSL fragment shader for post-processing (chromatic aberration, film grain, vignette). The PBR lighting shader (provided by the framework but we control all its inputs) implements Cook-Torrance with GGX, Schlick Fresnel, and Smith geometry terms. Bloom is a multi-pass Gaussian blur on bright pixels. All shader parameters are animated.

**If asked about CG concepts demonstrated**: Rendering pipeline (vertex/fragment processing, rasterization, depth buffer), affine transformations (model/view/projection matrices), PBR lighting (Cook-Torrance BRDF), texture mapping (UV, normal maps, procedural textures), shadow mapping (PCF), image-based lighting (PMREM), post-processing (bloom, custom GLSL), particle systems (Euler integration), spline interpolation (Catmull-Rom), exponential fog, alpha and additive blending, tone mapping (ACES filmic), color space management (sRGB), instanced rendering.

**If asked about external objects**: We load two GLTF models (car and street lamp) using GLTFLoader. Each is cloned per placement with unique material properties (car paint color, lamp position). Fallback procedural geometry is used if loading fails — the scene works with or without the external assets.

**If asked why not Blender/Unity**: Every CG concept listed above was implemented in code. In an editor, you adjust sliders and get results. In our project, we write the math. We understand what Cook-Torrance BRDF does because we set its parameters. We understand shadow mapping because we configure the shadow camera, resolution, and update frequency. We understand splines because we placed 49 waypoints and tuned the parameterization. The code IS the understanding.
