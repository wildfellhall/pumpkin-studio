import * as THREE from 'three';
import { rng, stemTexture } from './materials';
import { stampPolygon, surfacePoint } from './geometry';
import type { PumpkinShape, Stamp, Tool } from './types';

const steel = () =>
  new THREE.MeshStandardMaterial({ color: '#ccd3d1', metalness: 0.96, roughness: 0.23 });
const handle = () => new THREE.MeshStandardMaterial({ color: '#76472c', roughness: 0.61 });
function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parent: THREE.Object3D,
  pos: [number, number, number] = [0, 0, 0],
) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function createStem(shape: PumpkinShape) {
  const group = new THREE.Group(),
    map = stemTexture();
  const material = new THREE.MeshStandardMaterial({
    map,
    bumpMap: map,
    bumpScale: 0.07,
    roughness: 0.91,
  });
  const top = surfacePoint(shape, 0.5, 1).y;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, top - 0.05, 0),
    new THREE.Vector3(0.015, top + 0.1, -0.01),
    new THREE.Vector3(0.055, top + 0.28, -0.03),
    new THREE.Vector3(0.17, top + 0.48, -0.035),
  ]);
  const geo = new THREE.TubeGeometry(curve, 28, 0.1, 14, false);
  const stemUV = geo.attributes.uv;
  for (let i = 0; i < stemUV.count; i++) stemUV.setXY(i, stemUV.getY(i), stemUV.getX(i));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / 15),
      a = ((i % 15) / 14) * Math.PI * 2;
    const center = curve.getPointAt(Math.min(1, ring / 28));
    const p = new THREE.Vector3().fromBufferAttribute(pos, i);
    const scale = (1.25 - (ring / 28) * 0.45) * (1 + 0.18 * Math.cos(a * 7));
    p.sub(center).multiplyScalar(scale).add(center);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  mesh(geo, material, group);
  const end = mesh(new THREE.CircleGeometry(0.075, 14), material, group, [
    0.17,
    top + 0.48,
    -0.035,
  ]);
  end.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, top + 0.02, 0),
      new THREE.Vector3(Math.sin(a) * 0.14, top - 0.015, Math.cos(a) * 0.14),
      new THREE.Vector3(Math.sin(a) * 0.26, top + 0.035, Math.cos(a) * 0.26),
    ]);
    mesh(new THREE.TubeGeometry(c, 10, 0.026, 5, false), material, group);
  }
  return group;
}

export function createTool(type: Tool, color = '#e7cba4', cutter: Stamp = 'triangle') {
  const group = new THREE.Group(),
    metal = steel(),
    wood = handle();
  if (type === 'scoop') {
    const bowl = mesh(
      new THREE.SphereGeometry(0.19, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.75),
      new THREE.MeshPhysicalMaterial({
        color: '#bec6c5',
        metalness: 1,
        roughness: 0.18,
        side: THREE.DoubleSide,
      }),
      group,
      [0, 0.3, 0],
    );
    bowl.scale.set(1, 0.35, 1.4);
    bowl.rotation.x = Math.PI;
    const shaft = mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.48, 12),
      metal,
      group,
      [0, -0.03, 0],
    );
    shaft.rotation.z = 0.03;
    mesh(new THREE.CapsuleGeometry(0.065, 0.31, 6, 12), wood, group, [0, -0.39, 0]);
  } else if (['paint', 'marker', 'eraser'].includes(type)) {
    const isBrush = type === 'paint';
    mesh(
      new THREE.CylinderGeometry(0.045, 0.065, 0.58, 16),
      new THREE.MeshStandardMaterial({ color: isBrush ? '#405a4a' : '#303030', roughness: 0.4 }),
      group,
      [0, -0.19, 0],
    );
    mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.16, 16), metal, group, [0, 0.16, 0]);
    const tip = mesh(
      isBrush ? new THREE.BoxGeometry(0.12, 0.17, 0.045) : new THREE.ConeGeometry(0.037, 0.15, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.94 }),
      group,
      [0, 0.3, 0],
    );
    tip.rotation.z = -0.03;
  } else if (type === 'stamp') {
    const points = stampPolygon(cutter, [0.5, 0.5], 40).map(
      ([u, v]) => new THREE.Vector2((u - 0.5) * 5, (v - 0.5) * 2.5),
    );
    const shape = new THREE.Shape(points);
    shape.closePath();
    const hole = new THREE.Path([...points].reverse().map((p) => p.clone().multiplyScalar(0.9)));
    hole.closePath();
    shape.holes.push(hole);
    const stamp = mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.005,
        bevelSegments: 1,
      }),
      metal,
      group,
    );
    stamp.rotation.y = 0.2;
    mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.27, 16), wood, group, [0, -0.25, 0.04]);
  } else {
    const blade = new THREE.Shape();
    blade.moveTo(-0.045, 0.05);
    blade.lineTo(-0.055, 0.55);
    blade.quadraticCurveTo(0.16, 0.4, 0.085, 0.05);
    blade.closePath();
    mesh(
      new THREE.ExtrudeGeometry(blade, {
        depth: 0.015,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.004,
        bevelSegments: 1,
      }),
      metal,
      group,
    );
    mesh(new THREE.CapsuleGeometry(0.07, 0.32, 6, 12), wood, group, [0, -0.18, 0]);
    mesh(new THREE.BoxGeometry(0.16, 0.035, 0.09), metal, group, [0, 0.045, 0.01]);
    for (const y of [-0.12, -0.26]) {
      const rivet = mesh(new THREE.SphereGeometry(0.018, 10, 8), metal, group, [0, y, 0.065]);
      rivet.scale.z = 0.35;
    }
  }
  return group;
}

export function createGuts(shape: PumpkinShape) {
  const group = new THREE.Group(),
    random = rng(71);
  const pulpMat = new THREE.MeshPhysicalMaterial({
    color: '#e58d23',
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transmission: 0.16,
    thickness: 0.2,
    ior: 1.37,
  });
  const fiberMat = new THREE.MeshPhysicalMaterial({
    color: '#f7ba49',
    roughness: 0.23,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });
  const seedMat = new THREE.MeshPhysicalMaterial({
    color: '#eddaa2',
    roughness: 0.34,
    clearcoat: 0.6,
  });
  const count = 6;
  for (let k = 0; k < count; k++) {
    const clump = new THREE.Group();
    const a = (k / count) * Math.PI * 2;
    const center = new THREE.Vector3(
      Math.sin(a) * shape.radius * 0.47,
      shape.height + 0.2 + random() * 0.15,
      Math.cos(a) * shape.radius * 0.47,
    );
    clump.position.copy(center);
    for (let i = 0; i < 9; i++) {
      const p = mesh(new THREE.SphereGeometry(0.08 + random() * 0.07, 12, 10), pulpMat, clump, [
        (random() - 0.5) * 0.45,
        (random() - 0.5) * 0.25,
        (random() - 0.5) * 0.45,
      ]);
      p.scale.set(1.5, 0.7, 1);
      p.rotation.set(random(), random(), random());
    }
    for (let i = 0; i < 15; i++) {
      const p = new THREE.Vector3(
        (random() - 0.5) * 0.4,
        (random() - 0.5) * 0.2,
        (random() - 0.5) * 0.4,
      );
      const curve = new THREE.CatmullRomCurve3([
        p,
        p.clone().add(new THREE.Vector3((random() - 0.5) * 0.25, -0.14, (random() - 0.5) * 0.2)),
        p
          .clone()
          .add(
            new THREE.Vector3(
              (random() - 0.5) * 0.35,
              -0.3 - random() * 0.3,
              (random() - 0.5) * 0.3,
            ),
          ),
      ]);
      mesh(new THREE.TubeGeometry(curve, 9, 0.009 + random() * 0.009, 5, false), fiberMat, clump);
    }
    for (let i = 0; i < 8; i++) {
      const seed = mesh(new THREE.SphereGeometry(0.064, 12, 8), seedMat, clump, [
        (random() - 0.5) * 0.42,
        random() * 0.12,
        (random() - 0.5) * 0.42,
      ]);
      seed.scale.set(0.65, 0.17, 1.35);
      seed.rotation.set(random(), random() * 6, random() * 0.4);
    }
    clump.userData.home = center.clone();
    clump.userData.index = k;
    group.add(clump);
  }
  return group;
}

export function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  object.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Sprite) {
      if ('geometry' in o) geometries.add(o.geometry);
      const mm = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mm) {
        materials.add(m);
        for (const value of Object.values(m))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
