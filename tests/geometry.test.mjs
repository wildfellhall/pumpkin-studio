import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildShell,
  stampPolygon,
  surfacePoint,
  templateCuts,
  unionCuts,
  sawCuts,
} from '../src/geometry.ts';
import { SHAPES, DEFAULT_PROJECT, validateProject } from '../src/types.ts';

test('all five pumpkin varieties build finite, shaded shells with inner flesh and cut walls', () => {
  for (const shape of SHAPES) {
    const geometry = buildShell(shape, templateCuts('classic'));
    for (const name of ['position', 'normal', 'uv'])
      assert.ok(geometry.attributes[name].array.every(Number.isFinite), `${shape.id} ${name}`);
    assert.equal(geometry.groups.length, 3);
    assert.ok(geometry.groups.every((g) => g.count > 0));
    assert.ok(geometry.boundingSphere.radius > 1);
    geometry.dispose();
  }
});

test('a cutter removes both shell surfaces, leaving a true view into the cavity', () => {
  const shape = SHAPES[0],
    center = [0.507, 0.55];
  const origin = surfacePoint(shape, ...center).add(new THREE.Vector3(0, 0, 1));
  const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1));
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const intact = new THREE.Mesh(buildShell(shape, []), [material, material, material]);
  const cut = new THREE.Mesh(buildShell(shape, [stampPolygon('circle', center, 40)]), [
    material,
    material,
    material,
  ]);
  const before = ray.intersectObject(intact)[0],
    after = ray.intersectObject(cut)[0];
  assert.ok(before && after);
  assert.ok(before.distance < 1.05, `front surface at ${before.distance}`);
  assert.ok(after.distance > 2.6, `ray passes through cavity to rear at ${after.distance}`);
  intact.geometry.dispose();
  cut.geometry.dispose();
  material.dispose();
});

test('overlapping cuts merge without a residual internal wall, and seam cuts wrap', () => {
  assert.equal(
    unionCuts([stampPolygon('circle', [0.5, 0.55], 40), stampPolygon('circle', [0.52, 0.55], 40)])
      .length,
    1,
  );
  assert.equal(unionCuts([stampPolygon('circle', [0.99, 0.55], 40)]).length, 2);
  const geometry = buildShell(SHAPES[0], [stampPolygon('circle', [0.99, 0.55], 40)]);
  assert.ok(geometry.attributes.position.array.every(Number.isFinite));
  geometry.dispose();
});

test('project validation accepts roundtrips and rejects oversized or malformed input', () => {
  assert.ok(validateProject(JSON.parse(JSON.stringify(DEFAULT_PROJECT))));
  assert.equal(
    validateProject({
      ...DEFAULT_PROJECT,
      cuts: [
        [
          [0, 0],
          [NaN, 1],
          [1, 0],
        ],
      ],
    }),
    false,
  );
  assert.equal(
    validateProject({
      ...DEFAULT_PROJECT,
      cuts: Array(151).fill([
        [0, 0],
        [1, 1],
        [1, 0],
      ]),
    }),
    false,
  );
  assert.equal(validateProject({ ...DEFAULT_PROJECT, scoops: 7 }), false);
  assert.equal(validateProject({ ...DEFAULT_PROJECT, shape: 'unknown' }), false);
  assert.equal(validateProject({ ...DEFAULT_PROJECT, brightness: Infinity }), false);
  assert.equal(
    validateProject({
      ...DEFAULT_PROJECT,
      strokes: [{ kind: 'paint', color: 'url(javascript:1)', points: [], size: 20, seed: 4 }],
    }),
    false,
  );
});

test('the saw creates a continuous through-slot with round joins and respects a changed width', () => {
  const path = [
    [0.46, 0.49],
    [0.507, 0.55],
    [0.56, 0.52],
  ];
  const narrow = sawCuts(path, 15),
    wide = sawCuts(path, 60);
  assert.equal(narrow.length, 1);
  assert.equal(wide.length, 1);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const make = (cuts) =>
    new THREE.Mesh(buildShell(SHAPES[0], cuts), [material, material, material]);
  const n = make(narrow),
    w = make(wide);
  const radialRay = (u, v) => {
    const outer = surfacePoint(SHAPES[0], u, v);
    const direction = surfacePoint(SHAPES[0], u, v, 0.115).sub(outer).normalize();
    return new THREE.Raycaster(outer.clone().addScaledVector(direction, -1), direction);
  };
  for (const [u, v] of path) {
    const ray = radialRay(u, v);
    assert.ok(ray.intersectObject(n)[0].distance > 2.4, 'the saw opens the entire gesture');
  }
  const atEdge = radialRay(0.507, 0.565);
  assert.ok(atEdge.intersectObject(n)[0].distance < 1.1, 'narrow kerf leaves neighboring rind');
  assert.ok(atEdge.intersectObject(w)[0].distance > 2.4, 'wider kerf removes neighboring rind');
  n.geometry.dispose();
  w.geometry.dispose();
  material.dispose();
});

test('surface carving data survives project serialization and older projects still load', () => {
  const project = {
    ...DEFAULT_PROJECT,
    engravings: [
      {
        kind: 'gouge',
        points: [
          [0.45, 0.6],
          [0.55, 0.6],
        ],
        size: 30,
        seed: 123,
      },
      { kind: 'scraper', points: [[0.5, 0.5]], size: 55, seed: 456 },
    ],
  };
  assert.ok(validateProject(JSON.parse(JSON.stringify(project))));
  const legacy = { ...DEFAULT_PROJECT };
  delete legacy.engravings;
  assert.ok(validateProject(legacy));
  assert.equal(
    validateProject({ ...project, engravings: [{ ...project.engravings[0], size: -5 }] }),
    false,
  );
  assert.equal(
    validateProject({
      ...project,
      engravings: [{ ...project.engravings[0], points: [[NaN, 0.5]] }],
    }),
    false,
  );
  assert.equal(
    validateProject({ ...project, engravings: [{ ...project.engravings[0], kind: 'unknown' }] }),
    false,
  );
});
