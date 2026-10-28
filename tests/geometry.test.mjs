import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildShell,
  stampPolygon,
  surfacePoint,
  templateCuts,
  unionCuts,
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
