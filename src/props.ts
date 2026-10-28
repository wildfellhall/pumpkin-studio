import * as THREE from 'three';
import { rng, stemTexture, tissueTexture } from './materials';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
  } else if (['saw', 'drill', 'gouge', 'scraper'].includes(type)) {
    const grip = new THREE.MeshStandardMaterial({
      color: type === 'drill' ? '#30262c' : '#5b2b1d',
      roughness: 0.53,
    });
    mesh(new THREE.CapsuleGeometry(0.075, 0.3, 6, 14), grip, group, [0, -0.24, 0]);
    mesh(new THREE.CylinderGeometry(0.073, 0.073, 0.065, 16), metal, group, [0, -0.035, 0]);
    if (type === 'saw') {
      const outline = new THREE.Shape();
      outline.moveTo(-0.045, 0);
      outline.lineTo(-0.045, 0.52);
      outline.lineTo(0.025, 0.56);
      for (let i = 9; i >= 0; i--) {
        const y = i * 0.05;
        outline.lineTo(0.025, y + 0.025);
        outline.lineTo(0.075, y + 0.012);
        outline.lineTo(0.025, y);
      }
      outline.closePath();
      mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.009, bevelEnabled: false }), metal, group);
    } else if (type === 'drill') {
      mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.48, 12), metal, group, [0, 0.23, 0]);
      const helix = Array.from({ length: 120 }, (_, i) => {
        const t = i / 119;
        return new THREE.Vector3(
          Math.cos(t * Math.PI * 14) * 0.033,
          0.01 + t * 0.43,
          Math.sin(t * Math.PI * 14) * 0.033,
        );
      });
      mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 120, 0.01, 5, false),
        metal,
        group,
      );
      mesh(new THREE.ConeGeometry(0.033, 0.1, 12), metal, group, [0, 0.5, 0]);
      mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 16), metal, group, [0, 0.025, 0]);
    } else if (type === 'gouge') {
      mesh(new THREE.CylinderGeometry(0.026, 0.035, 0.34, 10), metal, group, [0, 0.14, 0]);
      for (const sign of [-1, 1]) {
        const edge = mesh(new THREE.BoxGeometry(0.075, 0.21, 0.008), metal, group, [
          sign * 0.026,
          0.35,
          0,
        ]);
        edge.rotation.y = sign * 0.55;
      }
    } else {
      mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.23, 12), metal, group, [0, 0.1, 0]);
      const blade = new THREE.Shape();
      blade.moveTo(-0.04, 0.16);
      blade.lineTo(-0.17, 0.36);
      blade.lineTo(-0.17, 0.48);
      blade.quadraticCurveTo(0, 0.52, 0.17, 0.48);
      blade.lineTo(0.17, 0.36);
      blade.lineTo(0.04, 0.16);
      blade.closePath();
      mesh(
        new THREE.ExtrudeGeometry(blade, {
          depth: 0.012,
          bevelEnabled: true,
          bevelSize: 0.004,
          bevelThickness: 0.003,
          bevelSegments: 1,
        }),
        metal,
        group,
      );
    }
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

function tissueRibbon(curve: THREE.CatmullRomCurve3, width: number, phase: number) {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const rows = 30,
    columns = 5;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows,
      p = curve.getPoint(t),
      tangent = curve.getTangent(t);
    const side = new THREE.Vector3(0.3, 0, 1).cross(tangent).normalize();
    const normal = side.clone().cross(tangent).normalize();
    const taper = Math.pow(Math.sin(Math.PI * (0.035 + t * 0.93)), 0.6);
    for (let j = 0; j <= columns; j++) {
      const w = (j / columns - 0.5) * 2,
        edge = 1 + 0.13 * Math.sin(t * 31 + phase) + 0.07 * Math.sin(t * 77);
      const fold = Math.sin(w * 4 + t * 13 + phase) * width * 0.28;
      const vertex = p
        .clone()
        .addScaledVector(side, w * width * taper * edge)
        .addScaledVector(normal, fold);
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(j / columns, t);
      if (i < rows && j < columns) {
        const a = i * (columns + 1) + j,
          b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createGuts(shape: PumpkinShape) {
  const group = new THREE.Group(),
    random = rng(71),
    tissue = tissueTexture();
  const time = { value: 0 };
  group.userData.time = time;
  const pulpMat = new THREE.MeshPhysicalMaterial({
    color: '#dc871f',
    map: tissue,
    bumpMap: tissue,
    bumpScale: 0.012,
    roughness: 0.38,
    clearcoat: 0.8,
    clearcoatRoughness: 0.17,
    transmission: 0.14,
    thickness: 0.025,
    ior: 1.36,
    side: THREE.DoubleSide,
  });
  const fiberMat = new THREE.MeshPhysicalMaterial({
    color: '#e3a331',
    roughness: 0.38,
    clearcoat: 0.75,
    clearcoatRoughness: 0.19,
  });
  const seedMat = new THREE.MeshPhysicalMaterial({
    color: '#dfc599',
    map: tissue,
    roughness: 0.44,
    clearcoat: 0.38,
    clearcoatRoughness: 0.23,
  });
  const seamMat = new THREE.MeshStandardMaterial({ color: '#c9a974', roughness: 0.6 });
  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: '#d88b29',
    roughness: 0.09,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transmission: 0.42,
    thickness: 0.02,
    ior: 1.34,
  });
  // Slight movement of the thin tissue, rather than rigid glossy spheres.
  for (const mat of [pulpMat, fiberMat]) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.pulpTime = time;
      shader.vertexShader = 'uniform float pulpTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.x += sin(position.y*19.0 + pulpTime*1.5 + position.z*8.0)*0.0025;',
      );
    };
    mat.customProgramCacheKey = () => 'hollow-fibrous-pulp-v2';
  }
  const addMerged = (geos: THREE.BufferGeometry[], mat: THREE.Material, parent: THREE.Group) => {
    const merged = mergeGeometries(geos, false);
    if (merged) mesh(merged, mat, parent);
    geos.forEach((g) => g.dispose());
  };
  for (let k = 0; k < 6; k++) {
    const clump = new THREE.Group(),
      a = (k / 6) * Math.PI * 2;
    const center = new THREE.Vector3(
      Math.sin(a) * shape.radius * 0.43,
      shape.height + 0.16 + random() * 0.12,
      Math.cos(a) * shape.radius * 0.43,
    );
    clump.position.copy(center);
    const ribbons: THREE.BufferGeometry[] = [],
      fibers: THREE.BufferGeometry[] = [],
      seeds: THREE.BufferGeometry[] = [],
      seams: THREE.BufferGeometry[] = [];
    const anchors: THREE.Vector3[] = [];
    for (let i = 0; i < 14; i++) {
      const start = new THREE.Vector3(
        (random() - 0.5) * 0.55,
        (random() - 0.5) * 0.17,
        (random() - 0.5) * 0.48,
      );
      const end = start
        .clone()
        .add(
          new THREE.Vector3(
            (random() - 0.5) * 0.5,
            -0.13 - random() * 0.45,
            (random() - 0.5) * 0.4,
          ),
        );
      anchors.push(start, end);
      const curve = new THREE.CatmullRomCurve3([
        start,
        start
          .clone()
          .add(new THREE.Vector3((random() - 0.5) * 0.32, -0.07, (random() - 0.5) * 0.3)),
        end.clone().add(new THREE.Vector3(0.06, 0.1, -0.08)),
        end,
      ]);
      ribbons.push(tissueRibbon(curve, 0.018 + random() * 0.045, random() * 6));
    }
    for (let i = 0; i < 52; i++) {
      const start = anchors[Math.floor(random() * anchors.length)].clone(),
        end = anchors[Math.floor(random() * anchors.length)].clone();
      if (start.distanceTo(end) < 0.04) end.y -= 0.25;
      const mid = start
        .clone()
        .lerp(end, 0.5)
        .add(
          new THREE.Vector3(
            (random() - 0.5) * 0.13,
            -0.045 - random() * 0.09,
            (random() - 0.5) * 0.12,
          ),
        );
      const curve = new THREE.CatmullRomCurve3([
        start,
        start
          .clone()
          .lerp(mid, 0.6)
          .add(new THREE.Vector3(0.03, 0, -0.02)),
        mid,
        end,
      ]);
      fibers.push(new THREE.TubeGeometry(curve, 14, 0.0028 + random() * 0.004, 5, false));
    }
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 11; i++) {
      const seedGeo = new THREE.SphereGeometry(0.056, 18, 12),
        positions = seedGeo.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        const z = positions.getZ(j),
          taper = 1 - 0.23 * (z / 0.056);
        positions.setXYZ(j, positions.getX(j) * 0.68 * taper, positions.getY(j) * 0.17, z * 1.36);
      }
      seedGeo.computeVertexNormals();
      const location = anchors[(i * 2) % anchors.length].clone();
      location.y += 0.025;
      dummy.position.copy(location);
      dummy.rotation.set((random() - 0.5) * 1.7, random() * 6, (random() - 0.5) * 1.3);
      dummy.scale.setScalar(0.8 + random() * 0.5);
      dummy.updateMatrix();
      seedGeo.applyMatrix4(dummy.matrix);
      seeds.push(seedGeo);
      const outline = Array.from({ length: 33 }, (_, j) => {
        const t = (j / 32) * Math.PI * 2,
          z = Math.cos(t) * 0.056;
        return new THREE.Vector3(
          Math.sin(t) * 0.056 * 0.68 * (1 - (0.23 * z) / 0.056),
          0,
          z * 1.36,
        );
      });
      const seam = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(outline, true),
        32,
        0.0017,
        4,
        true,
      );
      seam.applyMatrix4(dummy.matrix);
      seams.push(seam);
    }
    addMerged(ribbons, pulpMat, clump);
    addMerged(fibers, fiberMat, clump);
    addMerged(seeds, seedMat, clump);
    addMerged(seams, seamMat, clump);
    const drips = new THREE.Group();
    drips.name = 'drips';
    for (let i = 0; i < 5; i++) {
      const drop = mesh(
        new THREE.SphereGeometry(0.015 + random() * 0.008, 10, 8),
        liquidMat,
        drips,
        [(random() - 0.5) * 0.35, -0.15 - random() * 0.3, (random() - 0.5) * 0.25],
      );
      drop.scale.set(0.7, 1.6, 0.7);
      drop.userData.start = drop.position.clone();
      drop.userData.phase = random();
    }
    drips.visible = false;
    clump.add(drips);
    clump.userData.home = center.clone();
    clump.userData.index = k;
    clump.userData.pile = new THREE.Vector3(
      -1.45 + Math.sin(k * 2.5) * 0.26,
      0.3 + Math.floor(k / 3) * 0.07,
      1.1 + Math.cos(k * 2.5) * 0.23,
    );
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
