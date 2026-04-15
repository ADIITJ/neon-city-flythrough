import * as THREE from "three";
import { sampleNeon } from "./utils.js";

function createCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 64, 18, 128, 64, 62);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 8; i += 1) {
    context.beginPath();
    context.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.08})`;
    context.ellipse(
      40 + Math.random() * 180, 30 + Math.random() * 60,
      20 + Math.random() * 48, 12 + Math.random() * 24,
      Math.random() * Math.PI, 0, Math.PI * 2
    );
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// #9: Rain — more particles, larger, tighter around camera
export function createRainSystem() {
  const count = 3000;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);
  const geometry = new THREE.BufferGeometry();

  for (let i = 0; i < count; i += 1) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 600;
    positions[i * 3 + 1] = Math.random() * 300;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 600;
    velocities[i] = 130 + Math.random() * 160;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: "#87d9ff",
    size: 0.25,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    object: points,
    update(delta, anchor) {
      const position = geometry.attributes.position;
      for (let i = 0; i < count; i += 1) {
        position.array[i * 3 + 0] += Math.sin(i * 12.9898) * delta * 3;
        position.array[i * 3 + 1] -= velocities[i] * delta;
        position.array[i * 3 + 2] += Math.cos(i * 4.123) * delta * 10;

        if (position.array[i * 3 + 1] < 0) {
          position.array[i * 3 + 1] = 200 + Math.random() * 100;
          position.array[i * 3 + 0] = (Math.random() - 0.5) * 300;
          position.array[i * 3 + 2] = (Math.random() - 0.5) * 300;
        }
      }

      position.needsUpdate = true;
      points.position.set(anchor.x, 0, anchor.z);
    }
  };
}

export function createAtmosphereLayers(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const dustCount = 420;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustColors = new Float32Array(dustCount * 3);
  const dustGeometry = new THREE.BufferGeometry();

  for (let i = 0; i < dustCount; i += 1) {
    dustPositions[i * 3 + 0] = (Math.random() - 0.5) * 600;
    dustPositions[i * 3 + 1] = Math.random() * 100;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 600;

    const color = sampleNeon(i, -0.25);
    dustColors[i * 3 + 0] = color.r;
    dustColors[i * 3 + 1] = color.g;
    dustColors[i * 3 + 2] = color.b;
  }

  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute("color", new THREE.BufferAttribute(dustColors, 3));

  const dustMaterial = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    transparent: true,
    opacity: 0.015,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false;
  group.add(dust);

  return {
    group,
    update(elapsedTime, cameraPosition, mood = 0) {
      dust.rotation.y = elapsedTime * 0.02;
      dust.position.set(cameraPosition.x, 20, cameraPosition.z);
      dust.material.opacity = 0.005 + mood * 0.015;
    }
  };
}

// #7: Clouds — lower altitude, more count, higher opacity
export function createCloudLayer(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const texture = createCloudTexture();
  const clouds = [];
  const tempVector = new THREE.Vector3();

  for (let i = 0; i < 28; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color("#ffffff"),
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(180, 80), material);
    cloud.position.set(
      (Math.random() - 0.5) * 1200,
      220 + Math.random() * 180,
      (Math.random() - 0.5) * 1200
    );
    cloud.rotation.z = Math.random() * Math.PI * 2;
    const scale = 0.7 + Math.random() * 2.0;
    cloud.scale.setScalar(scale);
    group.add(cloud);
    clouds.push({
      mesh: cloud,
      drift: 3 + Math.random() * 9,
      phase: Math.random() * Math.PI * 2
    });
  }

  return {
    group,
    update(elapsedTime, cameraPosition, daylight) {
      const sunStrength = THREE.MathUtils.clamp(daylight, 0, 1);
      group.position.set(cameraPosition.x * 0.18, 0, cameraPosition.z * 0.18);

      for (let i = 0; i < clouds.length; i += 1) {
        const item = clouds[i];
        item.mesh.position.x += Math.sin(elapsedTime * 0.02 + item.phase) * item.drift * 0.02;
        item.mesh.position.z += Math.cos(elapsedTime * 0.015 + item.phase) * item.drift * 0.015;
        tempVector.set(cameraPosition.x, item.mesh.position.y - 40, cameraPosition.z);
        item.mesh.lookAt(tempVector);
        item.mesh.material.color.setHSL(0.58, 0.08, 0.72 + sunStrength * 0.18);
        // #7: Higher opacity so clouds are actually visible
        item.mesh.material.opacity = 0.03 + sunStrength * 0.10;
      }
    }
  };
}
