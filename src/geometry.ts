import * as THREE from 'three';
import polygonClipping, { type MultiPolygon, type Pair } from 'polygon-clipping';
import type { PumpkinShape, Stamp, UV } from './types';

export const LID_V = 0.805;
const TAU = Math.PI * 2;

/** A periodic, softly squared pumpkin profile, with asymmetric ribs and pole dimples. */
export function surfacePoint(shape: PumpkinShape, u: number, v: number, depth = 0): THREE.Vector3 {
  const phi = (u - 0.5) * TAU;
  const theta = (1 - v) * Math.PI;
  const sin = Math.max(0, Math.sin(theta));
  const ribs =
    1 -
    shape.ribDepth *
      Math.pow(0.5 + 0.5 * Math.cos(shape.ribs * phi + 0.15 * Math.sin(theta * 2)), 5);
  const irregular =
    1 + 0.021 * Math.sin(phi * 3 + 0.5) * sin + 0.009 * Math.cos(phi * 7 - theta * 2);
  const r = shape.radius * Math.pow(sin, 0.77) * ribs * irregular * (1 - depth);
  const c = Math.cos(theta);
  const y =
    shape.height * (Math.sign(c) * Math.pow(Math.abs(c), 0.87) * (1 - depth)) -
    0.16 * Math.exp((-theta * theta) / 0.07) +
    0.07 * Math.exp(-Math.pow(theta - Math.PI, 2) / 0.08);
  const sinPhi = Math.abs(Math.sin(phi)) < 1e-14 ? 0 : Math.sin(phi);
  return new THREE.Vector3(r * sinPhi, shape.height + 0.08 + y, r * Math.cos(phi));
}

function surfaceNormal(shape: PumpkinShape, u: number, v: number): THREE.Vector3 {
  const e = 0.0001;
  const tangentU = surfacePoint(shape, u + e, v).sub(surfacePoint(shape, u - e, v));
  const tangentV = surfacePoint(shape, u, Math.min(0.9999, v + e)).sub(
    surfacePoint(shape, u, Math.max(0.0001, v - e)),
  );
  const n = tangentU.cross(tangentV).normalize();
  if (n.lengthSq() < 0.1) n.set(0, v > 0.5 ? 1 : -1, 0);
  return n;
}

function closed(poly: UV[]): Pair[] {
  return [...poly.map((p) => [p[0], p[1]] as Pair), [poly[0][0], poly[0][1]]];
}
export function unionCuts(cuts: UV[][]): MultiPolygon {
  if (!cuts.length) return [];
  const polys: MultiPolygon[] = cuts.flatMap((c) =>
    [-1, 0, 1].map((offset) => [[closed(c.map(([u, v]) => [u + offset, v]))]] as MultiPolygon),
  );
  return polygonClipping.intersection(polygonClipping.union(polys[0], ...polys.slice(1)), [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  ]);
}

/** Clip tessellated UV triangles before mapping into 3D; holes remain real geometry at every viewing angle. */
export function buildShell(
  shape: PumpkinShape,
  cuts: UV[][],
  fromV = 0.001,
  toV = LID_V,
  resolution = 120,
): THREE.BufferGeometry {
  const polygons = unionCuts(cuts);
  const boxes = polygons.map((p) => {
    const pts = p[0];
    return {
      polygon: p,
      minU: Math.min(...pts.map((v) => v[0])),
      maxU: Math.max(...pts.map((v) => v[0])),
      minV: Math.min(...pts.map((v) => v[1])),
      maxV: Math.max(...pts.map((v) => v[1])),
    };
  });
  const outer: UV[][] = [];
  const rows = Math.ceil(resolution * 0.6 * (toV - fromV));
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < resolution; x++) {
      const u0 = x / resolution,
        u1 = (x + 1) / resolution;
      const v0 = fromV + (y / rows) * (toV - fromV),
        v1 = fromV + ((y + 1) / rows) * (toV - fromV);
      const nearby = boxes.filter(
        (b) => b.maxU >= u0 && b.minU <= u1 && b.maxV >= v0 && b.minV <= v1,
      );
      const triangles: UV[][] = [
        [
          [u0, v0],
          [u1, v0],
          [u1, v1],
        ],
        [
          [u0, v0],
          [u1, v1],
          [u0, v1],
        ],
      ];
      for (const tri of triangles) {
        if (!nearby.length) {
          outer.push(tri);
          continue;
        }
        const result = polygonClipping.difference(
          [[closed(tri)]],
          ...nearby.map((b) => [b.polygon] as MultiPolygon),
        );
        for (const poly of result) {
          const contour = poly[0].slice(0, -1).map((p) => new THREE.Vector2(...p));
          const holes = poly
            .slice(1)
            .map((r) => r.slice(0, -1).map((p) => new THREE.Vector2(...p)));
          const points = [...contour, ...holes.flat()];
          for (const face of THREE.ShapeUtils.triangulateShape(contour, holes))
            outer.push(face.map((i) => [points[i].x, points[i].y]));
        }
      }
    }
  const pos: number[] = [],
    normal: number[] = [],
    uv: number[] = [];
  const add = (p: THREE.Vector3, n: THREE.Vector3, coord: UV) => {
    pos.push(p.x, p.y, p.z);
    normal.push(n.x, n.y, n.z);
    uv.push(...coord);
  };
  for (const tri of outer) {
    // Earcut's output can have either winding after clipping; normalize in UV space.
    if (
      (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) -
        (tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0]) <
      0
    )
      tri.reverse();
    for (const p of tri) add(surfacePoint(shape, ...p), surfaceNormal(shape, ...p), p);
  }
  const skinCount = pos.length / 3;
  for (const tri of outer)
    for (const p of [...tri].reverse())
      add(surfacePoint(shape, ...p, 0.115), surfaceNormal(shape, ...p).negate(), p);
  const innerCount = pos.length / 3 - skinCount;
  const wall = (a: UV, b: UV) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 220));
    for (let i = 0; i < steps; i++) {
      const f = i / steps,
        t = (i + 1) / steps;
      const aa: UV = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      const bb: UV = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const p0 = surfacePoint(shape, ...aa),
        p1 = surfacePoint(shape, ...bb),
        p2 = surfacePoint(shape, ...bb, 0.115),
        p3 = surfacePoint(shape, ...aa, 0.115);
      const n = p1.clone().sub(p0).cross(p3.clone().sub(p0)).normalize();
      add(p0, n, aa);
      add(p1, n, bb);
      add(p2, n, bb);
      add(p0, n, aa);
      add(p2, n, bb);
      add(p3, n, aa);
    }
  };
  for (const polygon of polygons)
    for (const ring of polygon)
      for (let i = 0; i < ring.length - 1; i++) wall(ring[i], ring[i + 1]);
  for (let x = 0; x < resolution; x++) {
    wall([x / resolution, toV], [(x + 1) / resolution, toV]);
    wall([(x + 1) / resolution, fromV], [x / resolution, fromV]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.addGroup(0, skinCount, 0);
  geometry.addGroup(skinCount, innerCount, 1);
  geometry.addGroup(skinCount + innerCount, pos.length / 3 - skinCount - innerCount, 2);
  geometry.computeBoundingSphere();
  return geometry;
}

export function stampPolygon(stamp: Stamp, center: UV, size: number): UV[] {
  const sx = size / 1000,
    sy = sx * 2.2;
  let points: UV[] = [];
  if (stamp === 'triangle')
    points = [
      [0, 1],
      [-0.88, -0.7],
      [0.88, -0.7],
    ];
  else if (stamp === 'diamond')
    points = [
      [0, 1],
      [-0.75, 0],
      [0, -1],
      [0.75, 0],
    ];
  else if (stamp === 'star')
    points = Array.from({ length: 10 }, (_, i) => {
      const t = (i * Math.PI) / 5 + Math.PI / 2,
        r = i % 2 ? 0.43 : 1;
      return [Math.cos(t) * r, Math.sin(t) * r];
    });
  else if (stamp === 'heart')
    points = Array.from({ length: 48 }, (_, i) => {
      const t = (i / 48) * TAU;
      return [
        Math.pow(Math.sin(t), 3),
        (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17,
      ];
    });
  else if (stamp === 'crescent') {
    const outer = Array.from({ length: 28 }, (_, i): UV => {
      const t = Math.PI / 2 + (i / 27) * Math.PI;
      return [Math.cos(t), Math.sin(t)];
    });
    const inner = Array.from({ length: 28 }, (_, i): UV => {
      const t = -Math.PI / 2 - (i / 27) * Math.PI;
      return [Math.cos(t) * 0.5, Math.sin(t)];
    });
    points = [...outer, ...inner];
  } else
    points = Array.from({ length: 40 }, (_, i) => [
      Math.cos((i / 40) * TAU),
      Math.sin((i / 40) * TAU),
    ]);
  return points.map(([x, y]) => [
    center[0] + x * sx,
    THREE.MathUtils.clamp(center[1] + y * sy, 0.08, 0.78),
  ]);
}

export function templateCuts(kind: 'classic' | 'cat' | 'celestial'): UV[][] {
  if (kind === 'celestial')
    return [
      stampPolygon('crescent', [0.49, 0.54], 58),
      ...[
        [0.59, 0.65],
        [0.4, 0.66],
        [0.6, 0.42],
        [0.42, 0.41],
      ].map((p) => stampPolygon('star', p as UV, 20)),
    ];
  if (kind === 'cat')
    return [
      [
        [0.395, 0.65],
        [0.47, 0.6],
        [0.415, 0.55],
      ],
      [
        [0.605, 0.65],
        [0.53, 0.6],
        [0.585, 0.55],
      ],
      [
        [0.48, 0.5],
        [0.52, 0.5],
        [0.5, 0.46],
      ],
      [
        [0.43, 0.43],
        [0.49, 0.4],
        [0.5, 0.43],
        [0.51, 0.4],
        [0.57, 0.43],
        [0.54, 0.36],
        [0.5, 0.38],
        [0.46, 0.36],
      ],
    ];
  return [
    stampPolygon('triangle', [0.43, 0.6], 36),
    stampPolygon('triangle', [0.57, 0.6], 36),
    stampPolygon('triangle', [0.5, 0.49], 19),
    [
      [0.38, 0.43],
      [0.425, 0.405],
      [0.425, 0.375],
      [0.45, 0.375],
      [0.45, 0.395],
      [0.5, 0.385],
      [0.55, 0.395],
      [0.55, 0.375],
      [0.575, 0.375],
      [0.575, 0.405],
      [0.62, 0.43],
      [0.59, 0.34],
      [0.54, 0.3],
      [0.525, 0.3],
      [0.525, 0.335],
      [0.495, 0.335],
      [0.495, 0.3],
      [0.45, 0.31],
      [0.41, 0.35],
    ],
  ];
}
