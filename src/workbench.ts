import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildShell, templateCuts } from './geometry';
import { createFlameMaterial, rng, woodTexture } from './materials';
import { createStem, createTool } from './props';
import { SHAPES, type Tool } from './types';

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  position: [number, number, number],
) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function cord(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  material: THREE.Material,
  radius = 0.008,
) {
  return addMesh(
    parent,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      Math.max(12, points.length * 5),
      radius,
      5,
      false,
    ),
    material,
    [0, 0, 0],
  );
}
function plasterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!,
    data = ctx.createImageData(512, 512),
    random = rng(45);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const n = 140 + random() * 28 + Math.sin(x * 0.024) * Math.cos(y * 0.017) * 7;
      data.data.set([n, n, n, 255], (y * 512 + x) * 4);
    }
  ctx.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}
function batGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.13);
  shape.quadraticCurveTo(-0.12, -0.04, -0.2, -0.19);
  shape.quadraticCurveTo(-0.24, 0.03, -0.39, -0.11);
  shape.quadraticCurveTo(-0.39, 0.1, -0.63, -0.02);
  shape.lineTo(-0.48, 0.32);
  shape.quadraticCurveTo(-0.22, 0.16, -0.1, 0.12);
  shape.lineTo(-0.08, 0.25);
  shape.lineTo(0, 0.18);
  shape.lineTo(0.08, 0.25);
  shape.lineTo(0.1, 0.12);
  shape.quadraticCurveTo(0.22, 0.16, 0.48, 0.32);
  shape.lineTo(0.63, -0.02);
  shape.quadraticCurveTo(0.39, 0.1, 0.39, -0.11);
  shape.quadraticCurveTo(0.24, 0.03, 0.2, -0.19);
  shape.quadraticCurveTo(0.12, -0.04, 0, -0.13);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
}
function leafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.19);
  shape.lineTo(-0.08, -0.09);
  shape.lineTo(-0.2, -0.06);
  shape.lineTo(-0.15, 0.03);
  shape.lineTo(-0.22, 0.13);
  shape.lineTo(-0.09, 0.11);
  shape.lineTo(0, 0.27);
  shape.lineTo(0.08, 0.12);
  shape.lineTo(0.2, 0.16);
  shape.lineTo(0.15, 0.02);
  shape.lineTo(0.2, -0.04);
  shape.lineTo(0.08, -0.1);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 3);
}

/** A modeled room and decorated bench. Everything behind the pumpkin is part of the WebGL scene. */
export class Workbench {
  readonly root = new THREE.Group();
  private backdrop = new THREE.Group();
  private flameMaterial = createFlameMaterial();
  private candleLights: THREE.PointLight[] = [];
  private lanternLight: THREE.PointLight;
  private bulbMaterial = new THREE.MeshStandardMaterial({
    color: '#ffd59a',
    emissive: '#ff9c35',
    emissiveIntensity: 1.5,
    roughness: 0.35,
  });
  private windowMaterial = new THREE.MeshStandardMaterial({
    color: '#afbac1',
    emissive: '#8796a2',
    emissiveIntensity: 0.3,
    roughness: 0.6,
  });
  private night = false;

  constructor() {
    this.root.name = 'Halloween workbench';
    this.backdrop.name = 'Cutaway workshop wall';
    this.root.add(this.backdrop);
    const random = rng(606),
      wood = woodTexture();
    const grain = wood.image as HTMLCanvasElement,
      gc = grain.getContext('2d')!;
    for (let i = 0; i < 1700; i++) {
      const x = random() * grain.width,
        y = random() * grain.height;
      gc.strokeStyle = i % 4 ? 'rgba(58,40,23,.13)' : 'rgba(219,191,142,.13)';
      gc.lineWidth = 0.35 + random() * 0.65;
      gc.beginPath();
      gc.moveTo(x, y);
      gc.lineTo(x + (random() - 0.5) * 5, y + 5 + random() * 100);
      gc.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const x = random() * grain.width,
        y = random() * grain.height;
      gc.strokeStyle = 'rgba(65,41,22,.15)';
      for (let ring = 0; ring < 9; ring++) {
        gc.beginPath();
        gc.ellipse(x, y, 2 + ring * 1.4, 7 + ring * 3.3, -0.12, 0, Math.PI * 2);
        gc.stroke();
      }
    }
    wood.needsUpdate = true;
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    wood.anisotropy = 8;
    const timber = new THREE.MeshStandardMaterial({
      map: wood,
      bumpMap: wood,
      bumpScale: 0.022,
      roughness: 0.85,
      color: '#ab9578',
    });
    const darkTimber = new THREE.MeshStandardMaterial({
      map: wood,
      bumpMap: wood,
      bumpScale: 0.015,
      roughness: 0.8,
      color: '#655342',
    });
    const iron = new THREE.MeshStandardMaterial({
      color: '#292b29',
      metalness: 0.8,
      roughness: 0.5,
    });
    const brass = new THREE.MeshStandardMaterial({
      color: '#a58149',
      metalness: 0.8,
      roughness: 0.34,
    });
    const thread = new THREE.MeshStandardMaterial({ color: '#312f27', roughness: 0.9 });
    const chalk = new THREE.MeshStandardMaterial({ color: '#d0c6ac', roughness: 1 });

    // Individually edged boards, dark seams, end grain, fasteners, and actual thickness.
    for (let i = 0; i < 11; i++) {
      const geometry = new RoundedBoxGeometry(0.91, 0.25, 7.6, 2, 0.025);
      const uv = geometry.attributes.uv;
      for (let j = 0; j < uv.count; j++)
        uv.setXY(j, uv.getX(j) * 0.3 + i * 0.213, uv.getY(j) * 2.4 + i * 0.317);
      const plank = addMesh(this.root, geometry, timber, [(i - 5) * 0.925, -0.245, -0.45]);
      plank.rotation.y = (random() - 0.5) * 0.001;
      for (const z of [-3.95, 3.02]) {
        const nail = addMesh(this.root, new THREE.CylinderGeometry(0.023, 0.023, 0.006, 12), iron, [
          (i - 5) * 0.925,
          -0.116,
          z,
        ]);
        nail.rotation.y = random() * 6;
      }
    }
    addMesh(
      this.root,
      new RoundedBoxGeometry(10.25, 0.58, 0.16, 2, 0.025),
      darkTimber,
      [0, -0.55, 3.3],
    );
    addMesh(
      this.root,
      new RoundedBoxGeometry(10.25, 0.5, 0.16, 2, 0.025),
      darkTimber,
      [0, -0.55, -4.2],
    );
    for (const x of [-4.35, 4.35])
      for (const z of [-3.45, 2.65])
        addMesh(this.root, new THREE.BoxGeometry(0.35, 2.1, 0.35), darkTimber, [x, -1.35, z]);
    const floor = addMesh(
      this.root,
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ color: '#393a32', roughness: 1 }),
      [0, -2.4, 0],
    );
    floor.rotation.x = -Math.PI / 2;

    // A rectangular end-grain board sits directly on the bench.
    const boardMat = new THREE.MeshStandardMaterial({
      map: wood,
      bumpMap: wood,
      bumpScale: 0.013,
      color: '#bfab88',
      roughness: 0.75,
    });
    addMesh(
      this.root,
      new RoundedBoxGeometry(5.05, 0.14, 3.6, 3, 0.09),
      boardMat,
      [0, -0.035, 0.08],
    );
    const scoreMat = new THREE.LineBasicMaterial({
      color: '#735c3d',
      transparent: true,
      opacity: 0.22,
    });
    const marks: THREE.Vector3[] = [];
    for (let i = 0; i < 110; i++) {
      const x = (random() - 0.5) * 4.7,
        z = (random() - 0.5) * 3.2;
      marks.push(
        new THREE.Vector3(x, 0.037, z + 0.08),
        new THREE.Vector3(x + (random() - 0.5) * 0.6, 0.037, z + 0.08 + (random() - 0.5) * 0.6),
      );
    }
    this.root.add(
      new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(marks), scoreMat),
    );
    for (const x of [-2.31, 2.31]) {
      const slot = addMesh(this.root, new THREE.CapsuleGeometry(0.025, 0.44, 3, 8), darkTimber, [
        x,
        0.04,
        0.08,
      ]);
      slot.rotation.x = Math.PI / 2;
    }

    // The wall is a one-sided cutaway, so orbiting the pumpkin never traps the camera behind it.
    const plaster = plasterTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      map: plaster,
      bumpMap: plaster,
      bumpScale: 0.025,
      color: '#596259',
      roughness: 0.98,
    });
    // Distant room walls stay outside the orbit radius, including when the near wall cuts away.
    const rearWall = addMesh(this.root, new THREE.PlaneGeometry(28, 12), wallMat, [0, 3.2, 13]);
    rearWall.rotation.y = Math.PI;
    for (const side of [-1, 1]) {
      const sideWall = addMesh(this.root, new THREE.PlaneGeometry(28, 12), wallMat, [
        side * 13,
        3.2,
        0,
      ]);
      sideWall.rotation.y = (-side * Math.PI) / 2;
    }
    addMesh(this.root, new THREE.BoxGeometry(28, 0.16, 0.1), darkTimber, [0, -1.6, 12.94]);
    addMesh(this.backdrop, new THREE.PlaneGeometry(24, 12), wallMat, [0, 3.2, -5.3]);
    for (let i = 0; i < 14; i++)
      addMesh(this.backdrop, new THREE.BoxGeometry(0.73, 1.5, 0.07), darkTimber, [
        (i - 6.5) * 0.75,
        -0.1,
        -5.24,
      ]);
    addMesh(this.backdrop, new THREE.BoxGeometry(12, 0.12, 0.15), darkTimber, [0, 0.72, -5.16]);

    // Window frame and inset glass are geometry, with separate day and moonlit materials.
    const windowX = -3.4,
      windowY = 2.4;
    addMesh(this.backdrop, new THREE.PlaneGeometry(2.5, 2.75), this.windowMaterial, [
      windowX,
      windowY,
      -5.23,
    ]);
    for (const x of [-1.32, 0, 1.32])
      addMesh(this.backdrop, new THREE.BoxGeometry(0.12, 2.96, 0.2), darkTimber, [
        windowX + x,
        windowY,
        -5.05,
      ]);
    for (const y of [-1.47, 0, 1.47])
      addMesh(this.backdrop, new THREE.BoxGeometry(2.77, 0.12, 0.2), darkTimber, [
        windowX,
        windowY + y,
        -5.05,
      ]);
    addMesh(this.backdrop, new THREE.BoxGeometry(2.97, 0.12, 0.42), darkTimber, [
      windowX,
      windowY - 1.51,
      -4.96,
    ]);
    // Bare branches beyond the pane, cut as dark silhouettes rather than an image backdrop.
    const branchMat = new THREE.MeshStandardMaterial({ color: '#333e36', roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const x = windowX - 0.9 + i * 0.48;
      cord(
        this.backdrop,
        [
          new THREE.Vector3(x, 1.05, -5.16),
          new THREE.Vector3(x + 0.14, 2.15, -5.16),
          new THREE.Vector3(x - 0.12, 3.7, -5.16),
        ],
        branchMat,
        0.02,
      );
      cord(
        this.backdrop,
        [
          new THREE.Vector3(x + 0.1, 2.4, -5.16),
          new THREE.Vector3(x + 0.45, 2.7, -5.16),
          new THREE.Vector3(x + 0.55, 3.25, -5.16),
        ],
        branchMat,
        0.012,
      );
    }

    // Pegboard: real pegs, a shelf, and the same metal carving utensils used in the simulator.
    addMesh(
      this.backdrop,
      new RoundedBoxGeometry(2.8, 1.9, 0.1, 2, 0.04),
      new THREE.MeshStandardMaterial({ color: '#6f6046', roughness: 0.95 }),
      [3.1, 2.1, -5.04],
    );
    const holes = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.018, 6),
      new THREE.MeshBasicMaterial({ color: '#302b21' }),
      13 * 8,
    );
    const matrix = new THREE.Matrix4();
    let n = 0;
    for (let x = 0; x < 13; x++)
      for (let y = 0; y < 8; y++)
        holes.setMatrixAt(n++, matrix.makeTranslation(1.85 + x * 0.205, 1.35 + y * 0.205, -4.98));
    this.backdrop.add(holes);
    (['scoop', 'saw', 'gouge', 'scraper'] as Tool[]).forEach((type, i) => {
      const tool = createTool(type);
      tool.position.set(2.05 + i * 0.65, 2.05, -4.82);
      tool.rotation.z = Math.PI;
      tool.scale.setScalar(0.9);
      this.backdrop.add(tool);
      const hook = addMesh(
        this.backdrop,
        new THREE.TorusGeometry(0.048, 0.008, 5, 16, Math.PI),
        brass,
        [2.05 + i * 0.65, 2.58, -4.86],
      );
      hook.rotation.x = Math.PI / 2;
    });
    addMesh(
      this.backdrop,
      new RoundedBoxGeometry(3.1, 0.12, 0.5, 2, 0.025),
      darkTimber,
      [3.1, 1.08, -4.85],
    );

    // Paper bats on a sagging cord, with warm miniature bulbs between them.
    const garlandPoints = Array.from({ length: 41 }, (_, i) => {
      const t = i / 40;
      return new THREE.Vector3(-4.8 + t * 9.6, 3.85 - Math.sin(t * Math.PI) * 0.63, -4.45);
    });
    cord(this.backdrop, garlandPoints, thread, 0.012);
    const blackPaper = new THREE.MeshStandardMaterial({
      color: '#171b18',
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 7; i++) {
      const t = 0.1 + i * 0.133,
        x = -4.8 + t * 9.6,
        y = 3.85 - Math.sin(t * Math.PI) * 0.63;
      const bat = addMesh(this.backdrop, batGeometry(), blackPaper, [x, y - 0.26, -4.42]);
      bat.rotation.z = (random() - 0.5) * 0.3;
      bat.rotation.y = (random() - 0.5) * 0.45;
      bat.scale.setScalar(0.56 + random() * 0.2);
      cord(
        this.backdrop,
        [new THREE.Vector3(x, y, -4.43), new THREE.Vector3(x, y - 0.15, -4.43)],
        thread,
        0.004,
      );
    }
    for (let i = 0; i < 18; i++) {
      const t = (i + 0.5) / 18,
        x = -4.8 + t * 9.6,
        y = 3.85 - Math.sin(t * Math.PI) * 0.63;
      addMesh(this.backdrop, new THREE.CylinderGeometry(0.024, 0.024, 0.055, 8), iron, [
        x,
        y - 0.045,
        -4.45,
      ]);
      addMesh(this.backdrop, new THREE.SphereGeometry(0.042, 10, 8), this.bulbMaterial, [
        x,
        y - 0.1,
        -4.45,
      ]);
    }

    // Two spun cobwebs have concentric bowed threads, radial supports, and a tiny hanging spider.
    const webMat = new THREE.MeshStandardMaterial({
      color: '#b9b5a3',
      roughness: 0.8,
      transparent: true,
      opacity: 0.62,
    });
    for (const [cx, cy, radius, sign] of [
      [4.65, 3.85, 1.35, -1],
      [-4.8, 3.85, 0.8, 1],
    ]) {
      const point = (r: number, a: number) =>
        new THREE.Vector3(cx + sign * Math.cos(a) * r, cy - Math.sin(a) * r, -4.35);
      for (let ray = 0; ray < 8; ray++)
        cord(
          this.backdrop,
          [point(0.04, ((ray / 7) * Math.PI) / 2), point(radius, ((ray / 7) * Math.PI) / 2)],
          webMat,
          0.003,
        );
      for (let ring = 1; ring < 7; ring++)
        for (let ray = 0; ray < 7; ray++) {
          const r = (radius * ring) / 7,
            a = ((ray / 7) * Math.PI) / 2,
            b = (((ray + 1) / 7) * Math.PI) / 2;
          cord(
            this.backdrop,
            [point(r, a), point(r * 0.91, (a + b) / 2), point(r, b)],
            webMat,
            0.0025,
          );
        }
    }
    cord(
      this.backdrop,
      [new THREE.Vector3(4.1, 3.25, -4.32), new THREE.Vector3(4.1, 2.6, -4.32)],
      webMat,
      0.003,
    );
    addMesh(this.backdrop, new THREE.SphereGeometry(0.055, 12, 8), blackPaper, [4.1, 2.55, -4.32]);
    for (let i = 0; i < 8; i++) {
      const sign = i < 4 ? -1 : 1,
        dy = ((i % 4) - 1.5) * 0.035;
      cord(
        this.backdrop,
        [
          new THREE.Vector3(4.1 + sign * 0.025, 2.55 + dy, -4.32),
          new THREE.Vector3(4.1 + sign * 0.12, 2.6 + dy, -4.32),
          new THREE.Vector3(4.1 + sign * 0.15, 2.5 + dy, -4.32),
        ],
        blackPaper,
        0.005,
      );
    }

    // Small pumpkins stay outside the editing area and cast real contact shadows on the timber.
    const decorativePumpkin = (
      x: number,
      z: number,
      scale: number,
      color: string,
      carved = false,
    ) => {
      const g = new THREE.Group();
      g.position.set(x, -0.18, z);
      g.scale.setScalar(scale);
      const skin = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.63,
        clearcoat: 0.12,
        bumpMap: wood,
        bumpScale: 0.008,
      });
      const flesh = new THREE.MeshStandardMaterial({
        color: '#d8a44d',
        roughness: 0.7,
        side: THREE.DoubleSide,
        emissive: carved ? '#ffad32' : '#000000',
        emissiveIntensity: carved ? 0.45 : 0,
      });
      addMesh(
        g,
        buildShell(SHAPES[0], carved ? templateCuts('classic') : [], 0.001, 0.999, 48),
        [skin, flesh, flesh],
        [0, 0, 0],
      );
      g.add(createStem(SHAPES[0]));
      this.root.add(g);
      return g;
    };
    const lantern = decorativePumpkin(-2.95, -1.8, 0.48, '#c86420', true);
    lantern.rotation.y = 0.26;
    this.lanternLight = new THREE.PointLight('#ff9b38', 1, 3.5, 2);
    this.lanternLight.position.set(-2.95, 0.45, -1.8);
    this.root.add(this.lanternLight);
    decorativePumpkin(3.5, -2.6, 0.34, '#d3ceb4').rotation.y = -0.3;
    decorativePumpkin(4.13, -2.8, 0.24, '#8b9675');

    // A battered enamel bowl, a folded cloth, and utensils make the surface an active workbench.
    const bowlPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.29, 0.015),
      new THREE.Vector2(0.44, 0.13),
      new THREE.Vector2(0.58, 0.43),
      new THREE.Vector2(0.61, 0.49),
      new THREE.Vector2(0.59, 0.51),
      new THREE.Vector2(0.56, 0.45),
      new THREE.Vector2(0.4, 0.15),
      new THREE.Vector2(0.26, 0.055),
      new THREE.Vector2(0, 0.045),
    ];
    const bowlMat = new THREE.MeshPhysicalMaterial({
      color: '#a6b5ac',
      metalness: 0.3,
      roughness: 0.36,
      clearcoat: 0.25,
      side: THREE.DoubleSide,
    });
    addMesh(this.root, new THREE.LatheGeometry(bowlPoints, 48), bowlMat, [-3.1, -0.1, 0.7]);
    const bowlRim = addMesh(
      this.root,
      new THREE.TorusGeometry(0.6, 0.022, 8, 48),
      iron,
      [-3.1, 0.4, 0.7],
    );
    bowlRim.rotation.x = Math.PI / 2;
    const clothMat = new THREE.MeshStandardMaterial({
      color: '#737362',
      roughness: 1,
      side: THREE.DoubleSide,
    });
    const cloth = new THREE.PlaneGeometry(1.2, 1.65, 18, 24),
      cp = cloth.attributes.position;
    for (let i = 0; i < cp.count; i++)
      cp.setZ(i, 0.018 * Math.sin(cp.getX(i) * 26) + 0.012 * Math.sin(cp.getY(i) * 19));
    cloth.computeVertexNormals();
    const rag = addMesh(this.root, cloth, clothMat, [3.12, -0.077, 0.35]);
    rag.rotation.set(-Math.PI / 2, 0, 0.18);
    (['scoop', 'saw', 'gouge'] as Tool[]).forEach((type, i) => {
      const tool = createTool(type);
      tool.rotation.set(-Math.PI / 2, 0, -0.18 + i * 0.15);
      tool.scale.setScalar(0.82);
      tool.position.set(2.85 + i * 0.3, 0.035, 0.37 + (i % 2) * 0.1);
      this.root.add(tool);
    });
    const cup = new THREE.Group();
    cup.position.set(2.65, -0.1, -1.6);
    addMesh(
      cup,
      new THREE.CylinderGeometry(0.23, 0.2, 0.52, 24, 1, true),
      new THREE.MeshStandardMaterial({
        color: '#525747',
        metalness: 0.65,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
      [0, 0.26, 0],
    );
    for (let i = 0; i < 4; i++) {
      const brush = createTool(
        i === 3 ? 'marker' : 'paint',
        ['#d8b66b', '#ad4c2c', '#91965e', '#242b26'][i],
      );
      brush.position.set((random() - 0.5) * 0.23, 0.7, (random() - 0.5) * 0.23);
      brush.rotation.z = (random() - 0.5) * 0.5;
      brush.scale.setScalar(0.72);
      cup.add(brush);
    }
    this.root.add(cup);

    // Dripping pillar candles in a low metal dish; flame planes share the simulator's shader.
    const candleGroup = new THREE.Group();
    candleGroup.position.set(2.68, -0.1, -2.3);
    this.root.add(candleGroup);
    addMesh(candleGroup, new THREE.CylinderGeometry(0.6, 0.58, 0.055, 40), iron, [0, 0.025, 0]);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.32,
        z = i === 1 ? -0.16 : 0.08,
        height = [0.61, 0.92, 0.46][i],
        radius = 0.14;
      const wax = new THREE.MeshPhysicalMaterial({
        color: i === 1 ? '#b7763c' : '#d5c7a2',
        roughness: 0.7,
        clearcoat: 0.1,
      });
      addMesh(candleGroup, new THREE.CylinderGeometry(radius, radius + 0.008, height, 24), wax, [
        x,
        height / 2 + 0.055,
        z,
      ]);
      addMesh(candleGroup, new THREE.CylinderGeometry(0.025, 0.035, 0.012, 12), iron, [
        x,
        height + 0.057,
        z,
      ]);
      for (let drip = 0; drip < 5; drip++) {
        const a = random() * Math.PI * 2,
          len = 0.06 + random() * 0.18;
        const bead = addMesh(candleGroup, new THREE.CapsuleGeometry(0.013, len, 3, 6), wax, [
          x + Math.sin(a) * radius,
          height - len / 2,
          z + Math.cos(a) * radius,
        ]);
        bead.rotation.z = (random() - 0.5) * 0.12;
      }
      for (const angle of [0, Math.PI / 2]) {
        const flame = addMesh(candleGroup, new THREE.PlaneGeometry(0.12, 0.3), this.flameMaterial, [
          x,
          height + 0.2,
          z,
        ]);
        flame.rotation.y = angle;
        flame.castShadow = false;
      }
      const light = new THREE.PointLight('#ffb45f', 0.5, 3.3, 2);
      light.position.set(2.68 + x, height + 0.12, -2.3 + z);
      this.root.add(light);
      this.candleLights.push(light);
    }

    const seedMat = new THREE.MeshStandardMaterial({ color: '#ddd0ac', roughness: 0.75 });
    for (let i = 0; i < 16; i++) {
      const seed = addMesh(this.root, new THREE.SphereGeometry(0.052, 10, 8), seedMat, [
        -1.95 + random() * 0.65,
        0.055,
        0.85 + random() * 0.58,
      ]);
      seed.scale.set(0.65, 0.15, 1.35);
      seed.rotation.y = random() * 6;
    }
    const leafColors = ['#975329', '#824326', '#b27a33'];
    for (let i = 0; i < 14; i++) {
      const x = i < 7 ? -3.7 + random() * 1.2 : 2.6 + random() * 1.6,
        z = -1.2 + random() * 3.2;
      const material = new THREE.MeshStandardMaterial({
        color: leafColors[i % 3],
        roughness: 0.93,
        side: THREE.DoubleSide,
      });
      const leaf = addMesh(this.root, leafGeometry(), material, [x, -0.085, z]);
      leaf.rotation.set(-Math.PI / 2, 0, random() * 6);
      leaf.scale.setScalar(0.8 + random() * 0.6);
    }
    // Metal cutters, their thin walls catching the workshop light.
    for (let i = 0; i < 3; i++) {
      const cutter = createTool(
        'stamp',
        '#e7cba4',
        ['star', 'circle', 'triangle'][i] as 'star' | 'circle' | 'triangle',
      );
      cutter.position.set(-3.7 + i * 0.45, 0.01, 1.65);
      cutter.rotation.set(-Math.PI / 2, 0, i * 0.7);
      cutter.scale.setScalar(0.45);
      this.root.add(cutter);
    }
    // A few chalk ticks on the bench edge, made from geometry.
    for (let i = 0; i < 8; i++)
      addMesh(this.root, new THREE.BoxGeometry(0.008, 0.025 + (i % 2) * 0.02, 0.002), chalk, [
        -1.2 + i * 0.11,
        -0.48,
        3.385,
      ]);
    this.setLighting('day');
  }

  setLighting(environment: 'day' | 'night') {
    this.night = environment === 'night';
    this.windowMaterial.color.set(this.night ? '#465d7b' : '#a4b3b4');
    this.windowMaterial.emissive.set(this.night ? '#334865' : '#a1b1b6');
    this.windowMaterial.emissiveIntensity = this.night ? 0.18 : 0.42;
    this.bulbMaterial.emissiveIntensity = this.night ? 3 : 1.2;
    this.lanternLight.intensity = this.night ? 2.2 : 0.6;
    this.flameMaterial.uniforms.strength.value = 0.45;
  }
  update(time: number, camera: THREE.Vector3) {
    this.backdrop.visible = camera.z > -3.8;
    this.flameMaterial.uniforms.time.value = time;
    this.candleLights.forEach((light, i) => {
      light.intensity =
        (this.night ? 1.15 : 0.35) *
        (1 + Math.sin(time * 7.1 + i * 2) * 0.07 + Math.sin(time * 13.4 + i) * 0.035);
    });
  }
}
