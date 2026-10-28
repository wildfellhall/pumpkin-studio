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

/** Thin ragged membranes follow a branching core; fibers and seeds share its attachment points. */
function tissueRibbon(curve: THREE.CatmullRomCurve3, width: number, phase: number) {
  const positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const rows = 36,
    columns = 8;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows,
      p = curve.getPoint(t),
      tangent = curve.getTangent(t);
    const side = new THREE.Vector3(0.3, 0, 1).cross(tangent).normalize();
    const normal = side.clone().cross(tangent).normalize();
    const taper = Math.pow(Math.sin(Math.PI * (0.025 + t * 0.95)), 0.6);
    for (let j = 0; j <= columns; j++) {
      const w = (j / columns - 0.5) * 2;
      const edge = 1 + 0.22 * Math.sin(t * 31 + phase) + 0.12 * Math.sin(t * 73 + phase);
      const fold = Math.sin(w * 3.5 + t * 8 + phase) * width * 0.15;
      const vertex = p
        .clone()
        .addScaledVector(side, w * width * taper * edge)
        .addScaledVector(normal, fold);
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(j / columns, t);
      const shade = 0.92 + 0.06 * Math.sin(t * 12 + phase) + 0.02 * Math.cos(w * 5 + t * 19);
      colors.push(1, shade, 0.52 + shade * 0.35);
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
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
function tissueCord(curve: THREE.CatmullRomCurve3, radius: number, phase: number) {
  const geo = new THREE.TubeGeometry(curve, 24, radius, 7, false),
    positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const t = Math.floor(i / 8) / 24,
      center = curve.getPointAt(t);
    const v = new THREE.Vector3().fromBufferAttribute(positions, i);
    const taper = 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * (0.04 + t * 0.92)), 0.55);
    const uneven = 1 + 0.15 * Math.sin(t * 37 + phase) + 0.1 * Math.sin(i * 1.8 + phase);
    v.sub(center)
      .multiplyScalar(taper * uneven)
      .add(center);
    positions.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createGuts(shape: PumpkinShape) {
  const group = new THREE.Group(),
    random = rng(71),
    tissue = tissueTexture();
  const pulpMat = new THREE.MeshPhysicalMaterial({
    color: '#f29b27',
    map: tissue,
    bumpMap: tissue,
    bumpScale: 0.006,
    roughness: 0.56,
    roughnessMap: tissue,
    clearcoat: 0.75,
    clearcoatRoughness: 0.2,
    transmission: 0.12,
    thickness: 0.035,
    attenuationColor: '#d87912',
    attenuationDistance: 0.3,
    ior: 1.36,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  const fiberMat = new THREE.MeshPhysicalMaterial({
    color: '#e59a2a',
    map: tissue,
    bumpMap: tissue,
    bumpScale: 0.004,
    roughness: 0.4,
    clearcoat: 0.9,
    clearcoatRoughness: 0.19,
  });
  const seedMat = new THREE.MeshPhysicalMaterial({
    color: '#e9d6ab',
    roughness: 0.3,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });
  const seamMat = new THREE.MeshPhysicalMaterial({
    color: '#bda06b',
    roughness: 0.35,
    clearcoat: 0.6,
  });
  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: '#eda22b',
    roughness: 0.07,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    transmission: 0.65,
    thickness: 0.035,
    ior: 1.34,
  });
  const addMerged = (geos: THREE.BufferGeometry[], mat: THREE.Material, parent: THREE.Group) => {
    const merged = mergeGeometries(geos, false);
    if (merged) mesh(merged, mat, parent);
    geos.forEach((g) => g.dispose());
  };
  for (let k = 0; k < 6; k++) {
    const clump = new THREE.Group(),
      u = k / 6;
    const center = surfacePoint(shape, u, 0.53, 0.49);
    clump.position.copy(center);
    const ribbons: THREE.BufferGeometry[] = [],
      fibers: THREE.BufferGeometry[] = [],
      seeds: THREE.BufferGeometry[] = [],
      seams: THREE.BufferGeometry[] = [];
    const branches: THREE.CatmullRomCurve3[] = [];
    const localWall = (du: number, v: number, depth: number) =>
      surfacePoint(shape, u + du, v, depth).sub(center);
    // Broad placental tissue starts against the inner wall and folds inward under its own weight.
    for (let i = 0; i < 18; i++) {
      const du = (random() - 0.5) * 0.12,
        top = 0.49 + random() * 0.23;
      const start = localWall(du, top, 0.14 + random() * 0.035);
      const end = localWall(
        du + (random() - 0.5) * 0.1,
        top - 0.025 - random() * 0.065,
        0.65 + random() * 0.3,
      );
      const curl = new THREE.Vector3(
        (random() - 0.5) * 0.22,
        -0.08 - random() * 0.12,
        (random() - 0.5) * 0.22,
      );
      const mid = start.clone().lerp(end, 0.5).add(curl);
      const curve = new THREE.CatmullRomCurve3([
        start,
        start.clone().lerp(mid, 0.45),
        mid,
        mid
          .clone()
          .lerp(end, 0.6)
          .add(new THREE.Vector3(-curl.x * 0.6, 0.02, -curl.z * 0.6)),
        end,
      ]);
      branches.push(curve);
      const membrane = new THREE.CatmullRomCurve3(
        [0.26, 0.46, 0.66, 0.86, 0.98].map((t) => curve.getPoint(t)),
      );
      ribbons.push(tissueRibbon(membrane, 0.055 + random() * 0.05, random() * 6));
      fibers.push(tissueCord(curve, 0.007 + random() * 0.014, random() * 6));
      // Finer fibers cling to the wet membrane; a few bridge neighboring folds.
      for (let j = 0; j < 3; j++) {
        const t = 0.15 + random() * 0.35,
          a = curve.getPoint(t),
          b = curve.getPoint(0.65 + random() * 0.3);
        const curl = new THREE.Vector3((random() - 0.5) * 0.08, -0.015, (random() - 0.5) * 0.08);
        const fine = new THREE.CatmullRomCurve3([
          a,
          a.clone().lerp(b, 0.35).add(curl),
          a.clone().lerp(b, 0.7).addScaledVector(curl, 0.6),
          b,
        ]);
        fibers.push(tissueCord(fine, 0.002 + random() * 0.0035, random() * 6));
      }
    }
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 15; i++) {
      const branch = branches[(i * 2) % branches.length],
        t = 0.35 + random() * 0.5;
      const location = branch.getPoint(t);
      location.y += 0.055;
      const seedGeo = new THREE.SphereGeometry(0.07, 20, 14),
        positions = seedGeo.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        const z = positions.getZ(j),
          taper = 1 - 0.26 * (z / 0.07);
        positions.setXYZ(j, positions.getX(j) * 0.68 * taper, positions.getY(j) * 0.145, z * 1.4);
      }
      seedGeo.computeVertexNormals();
      dummy.position.copy(location);
      dummy.rotation.set((random() - 0.5) * 1.3, random() * 6, (random() - 0.5) * 1.1);
      dummy.scale.setScalar(0.8 + random() * 0.3);
      dummy.updateMatrix();
      seedGeo.applyMatrix4(dummy.matrix);
      seeds.push(seedGeo);
      const outline = Array.from({ length: 33 }, (_, j) => {
        const theta = (j / 32) * Math.PI * 2,
          z = Math.cos(theta) * 0.07;
        return new THREE.Vector3(
          Math.sin(theta) * 0.07 * 0.68 * (1 - (0.26 * z) / 0.07),
          0,
          z * 1.4,
        );
      });
      const seam = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(outline, true),
        32,
        0.0014,
        4,
        true,
      );
      seam.applyMatrix4(dummy.matrix);
      seams.push(seam);
      // A translucent fleshy sheath partly covers each seed instead of seeds sitting loose on top.
      const wrap = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.024, 0.009, -0.07).applyMatrix4(dummy.matrix),
        new THREE.Vector3(0.008, 0.014, -0.015).applyMatrix4(dummy.matrix),
        new THREE.Vector3(0.022, 0.01, 0.07).applyMatrix4(dummy.matrix),
        branch.getPoint(Math.min(0.98, t + 0.1)),
      ]);
      ribbons.push(tissueRibbon(wrap, 0.004 + random() * 0.006, random() * 6));
    }
    addMerged(ribbons, pulpMat, clump);
    addMerged(fibers, fiberMat, clump);
    addMerged(seeds, seedMat, clump);
    addMerged(seams, seamMat, clump);
    const drips = new THREE.Group();
    drips.name = 'drips';
    for (let i = 0; i < 7; i++) {
      const drop = mesh(
        new THREE.SphereGeometry(0.01 + random() * 0.008, 12, 10),
        liquidMat,
        drips,
        [(random() - 0.5) * 0.3, -0.2 - random() * 0.2, (random() - 0.5) * 0.3],
      );
      drop.scale.set(0.7, 1.4, 0.7);
      drop.userData.start = drop.position.clone();
      drop.userData.phase = random();
    }
    drips.visible = false;
    clump.add(drips);
    clump.userData.home = center.clone();
    clump.userData.index = k;
    clump.userData.pile = new THREE.Vector3(
      -1.45 + Math.sin(k * 2.5) * 0.25,
      0.31 + Math.floor(k / 3) * 0.07,
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
