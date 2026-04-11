import * as THREE from "three";

export function fract(value) {
  return value - Math.floor(value);
}

export function hash2D(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return fract(value);
}

export function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function valueNoise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const mixX1 = THREE.MathUtils.lerp(a, b, ux);
  const mixX2 = THREE.MathUtils.lerp(c, d, ux);
  return THREE.MathUtils.lerp(mixX1, mixX2, uz);
}

export function fbm2D(x, z, octaves = 4) {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let normalization = 0;

  for (let i = 0; i < octaves; i += 1) {
    total += valueNoise2D(x * frequency, z * frequency) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / normalization;
}

export function neonPalette() {
  const colors = [
    new THREE.Color("#19f9ff"),
    new THREE.Color("#ff3df2"),
    new THREE.Color("#7a5cff"),
    new THREE.Color("#2e7bff")
  ];

  return colors;
}

export function sampleNeon(index, variance = 0) {
  const palette = neonPalette();
  const color = palette[index % palette.length].clone();
  const hsl = {};
  color.getHSL(hsl);
  color.setHSL(
    (hsl.h + variance * 0.06 + 1) % 1,
    THREE.MathUtils.clamp(hsl.s + variance * 0.15, 0.55, 1),
    THREE.MathUtils.clamp(hsl.l + variance * 0.1, 0.38, 0.72)
  );
  return color;
}
