import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildShell, LID_V, sawCuts, stampPolygon, surfacePoint } from './geometry';
import { createFlameMaterial, createSkinTextures, renderPaint } from './materials';
import { createGuts, createStem, createTool, disposeObject } from './props';
import { Workbench } from './workbench';
import {
  cloneProject,
  DEFAULT_SETTINGS,
  SHAPES,
  SCOOPS_REQUIRED,
  type Project,
  type Engraving,
  type StudioSettings,
  type Stroke,
  type UV,
} from './types';

interface Callbacks {
  change: (project: Project, label: string) => void;
  info: (message: string) => void;
  ready: () => void;
}
const front = new THREE.Vector3(0, 2.75, 6.6);

export class StudioEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 150);
  readonly controls: OrbitControls;
  readonly root = new THREE.Group();
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private body!: THREE.Mesh;
  private lid = new THREE.Group();
  private guts = new THREE.Group();
  private candle = new THREE.Group();
  private tool = new THREE.Group();
  private line = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: '#faf2d6', depthTest: false }),
  );
  private collider!: THREE.Mesh;
  private skinTextures = createSkinTextures();
  private skin = new THREE.MeshPhysicalMaterial({
    roughness: 0.68,
    clearcoat: 0.19,
    clearcoatRoughness: 0.32,
    bumpScale: 0.032,
  });
  private pulp = new THREE.MeshPhysicalMaterial({
    color: '#e5a339',
    roughness: 0.45,
    clearcoat: 0.35,
    side: THREE.DoubleSide,
  });
  private rim = new THREE.MeshPhysicalMaterial({
    color: '#f6bd55',
    roughness: 0.46,
    clearcoat: 0.3,
    side: THREE.DoubleSide,
  });
  private flameMaterial = createFlameMaterial();
  private flame = new THREE.Group();
  private candleLight = new THREE.PointLight('#ffa33e', 0, 9, 2);
  private hemi = new THREE.HemisphereLight('#fffaeb', '#9a8871', 2);
  private key = new THREE.DirectionalLight('#fff4da', 3);
  private fill = new THREE.DirectionalLight('#dce9ff', 1);
  private workbench: Workbench;
  private env: THREE.WebGLRenderTarget;
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private time = 0;
  private lastTime = 0;
  private disposed = false;
  private drawing = false;
  private pointer = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private points: UV[] = [];
  private activeStroke: Stroke | null = null;
  private activeEngraving: Engraving | null = null;
  private previewTimer = 0;
  private scoopStart = -100;
  private scoopIndex = -1;
  private lidPosition = new THREE.Vector3();
  private toolTarget = new THREE.Vector3(2.1, 0.6, 0.5);
  private toolActive = false;
  private currentProject: Project;
  private settings: StudioSettings = { ...DEFAULT_SETTINGS };
  private currentShape = SHAPES[0];
  private exporting = false;
  private exportRecorder: MediaRecorder | null = null;
  private exportAbort = false;
  private environment: 'day' | 'night' = 'day';

  constructor(
    private host: HTMLElement,
    project: Project,
    private callbacks: Callbacks,
  ) {
    this.currentProject = cloneProject(project);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.86;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D pumpkin. Drag to rotate; select a tool to carve or paint.',
    );
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.tabIndex = 0;
    host.appendChild(this.renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.env.texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environmentIntensity = 0.55;
    this.camera.position.set(0.8, 3.0, 7.4);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.96, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 4.3;
    this.controls.maxDistance = 11;
    this.controls.minPolarAngle = 0.16;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.025;
    this.controls.enablePan = false;
    this.controls.update();
    this.scene.add(this.hemi, this.key, this.fill);
    this.key.position.set(-3.7, 6, 4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.left = -5;
    this.key.shadow.camera.right = 5;
    this.key.shadow.camera.top = 6;
    this.key.shadow.camera.bottom = -4;
    this.key.shadow.normalBias = 0.012;
    this.key.shadow.bias = -0.0002;
    this.key.shadow.radius = 4;
    this.fill.position.set(4, 3, -3);
    this.workbench = new Workbench();
    this.scene.add(this.workbench.root, this.root);
    this.root.position.y = -0.13;
    this.root.add(this.line);
    this.line.renderOrder = 10;
    this.skin.map = this.skinTextures.map;
    this.skin.bumpMap = this.skinTextures.bumpMap;
    this.skin.roughnessMap = this.skinTextures.roughnessMap;
    this.skin.displacementMap = this.skinTextures.displacementMap;
    this.skin.displacementScale = 0.09;
    this.skin.displacementBias = -0.045;
    this.pulp.bumpMap = this.skinTextures.bumpMap;
    this.pulp.bumpScale = 0.035;
    // Environment maps cannot know the cavity is enclosed. Reduce only indirect
    // illumination inside the rind; the candle's direct light remains physical.
    this.pulp.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.24;\nreflectedLight.indirectSpecular *= 0.28;',
      );
    };
    this.pulp.customProgramCacheKey = () => 'hollow-cavity-occlusion-v1';
    this.rim.bumpMap = this.skinTextures.bumpMap;
    this.rim.bumpScale = 0.02;
    this.candleLight.castShadow = true;
    this.candleLight.shadow.mapSize.set(512, 512);
    this.candleLight.shadow.bias = -0.001;
    this.candleLight.shadow.normalBias = 0.012;
    this.candleLight.shadow.camera.near = 0.03;
    this.root.add(this.candleLight);
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.45, 1.1);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.makePumpkin();
    this.makeCandle();
    this.makeTool();
    this.setEnvironment('day');
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
    el.addEventListener('pointerleave', this.onPointerLeave);
    el.addEventListener('contextmenu', this.onContext);
    el.addEventListener('webglcontextlost', this.onContextLost);
    el.addEventListener('webglcontextrestored', this.onContextRestored);
    this.frame = requestAnimationFrame(this.animate);
    this.callbacks.ready();
  }

  private resize() {
    if (this.exporting || this.disposed) return;
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  private makePumpkin() {
    this.currentShape = SHAPES.find((s) => s.id === this.currentProject.shape)!;
    if (this.body) {
      this.body.geometry.dispose();
      this.root.remove(this.body);
    }
    if (this.collider) this.collider.geometry.dispose();
    this.root.remove(this.lid, this.guts);
    // Shared rind materials live for the engine's lifetime.
    this.lid.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (
          !Array.isArray(o.material) &&
          o.material !== this.skin &&
          o.material !== this.rim &&
          o.material !== this.pulp
        )
          o.material.dispose();
      }
    });
    disposeObject(this.guts);
    this.body = new THREE.Mesh(buildShell(this.currentShape, this.currentProject.cuts), [
      this.skin,
      this.pulp,
      this.rim,
    ]);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.root.add(this.body);
    this.collider = new THREE.Mesh(buildShell(this.currentShape, [], 0.001, 0.999, 64), this.skin);
    this.collider.matrixWorld.copy(this.root.matrixWorld);
    this.lid = new THREE.Group();
    const cap = new THREE.Mesh(buildShell(this.currentShape, [], LID_V, 0.999, 120), [
      this.skin,
      this.pulp,
      this.rim,
    ]);
    cap.castShadow = true;
    cap.receiveShadow = true;
    this.lid.add(cap, createStem(this.currentShape));
    this.root.add(this.lid);
    this.guts = createGuts(this.currentShape);
    this.root.add(this.guts);
    this.scoopIndex = -1;
    this.updateGuts();
    this.updatePaint();
    this.updateLid(true);
  }

  private updateGeometry() {
    const geometry = buildShell(this.currentShape, this.currentProject.cuts);
    this.body.geometry.dispose();
    this.body.geometry = geometry;
  }
  private updatePaint(extra?: Stroke, engraving?: Engraving) {
    renderPaint(
      this.skinTextures,
      extra ? [...this.currentProject.strokes, extra] : this.currentProject.strokes,
      engraving
        ? [...(this.currentProject.engravings || []), engraving]
        : this.currentProject.engravings || [],
      this.currentShape.color,
    );
    for (const map of [
      this.skinTextures.map,
      this.skinTextures.bumpMap,
      this.skinTextures.roughnessMap,
      this.skinTextures.displacementMap,
    ])
      map.needsUpdate = true;
  }
  private updateGuts() {
    this.guts.children.forEach((clump, i) => {
      const removed = i < this.currentProject.scoops;
      if (i === this.scoopIndex && this.time - this.scoopStart < 2) return;
      clump.visible =
        !removed ||
        (this.settings.mode === 'guided' && this.settings.stage === 'prepare') ||
        this.currentProject.lidOpen;
      clump.position.copy(removed ? clump.userData.pile : clump.userData.home);
      clump.scale.set(removed ? 0.55 : 1, removed ? 0.3 : 1, removed ? 0.55 : 1);
      clump.rotation.z = removed ? -0.2 : 0;
      const drips = clump.getObjectByName('drips');
      if (drips) drips.visible = false;
    });
  }
  private updateLid(immediate = false) {
    const open = this.currentProject.lidOpen;
    this.lidPosition.set(
      open ? -1.75 : 0,
      open ? -this.currentShape.height * 1.65 + 0.13 : 0,
      open ? -0.15 : 0,
    );
    if (immediate) this.lid.position.copy(this.lidPosition);
  }
  private makeTool() {
    this.scene.remove(this.tool);
    disposeObject(this.tool);
    this.tool = createTool(this.settings.tool, this.settings.color, this.settings.stamp);
    this.tool.rotation.set(-Math.PI / 2, 0, -0.55);
    this.tool.position.set(1.88, 0.16, 0.85);
    this.tool.scale.setScalar(0.83);
    this.scene.add(this.tool);
  }

  private makeCandle() {
    this.root.remove(this.candle);
    // The flame shader is shared by both crossed planes.
    this.candle.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (o.material !== this.flameMaterial && !Array.isArray(o.material)) o.material.dispose();
      }
    });
    this.candle = new THREE.Group();
    this.flame = new THREE.Group();
    const kind = this.currentProject.light,
      pillar = kind === 'pillar',
      electric = kind === 'amber' || kind === 'violet';
    const height = pillar ? 0.48 : 0.12,
      radius = pillar ? 0.14 : 0.19;
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.015, radius + 0.015, height, 48),
      new THREE.MeshStandardMaterial({
        color: pillar ? '#ede0bc' : '#b7bab7',
        roughness: pillar ? 0.8 : 0.22,
        metalness: pillar ? 0 : 0.95,
      }),
    );
    cup.position.y = height / 2;
    cup.castShadow = true;
    this.candle.add(cup);
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.025, 48),
      new THREE.MeshPhysicalMaterial({ color: '#fff1ce', roughness: 0.4, clearcoat: 0.5 }),
    );
    wax.position.y = height + 0.003;
    this.candle.add(wax);
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.011, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: '#30211a' }),
    );
    wick.position.y = height + 0.035;
    this.candle.add(wick);
    if (!electric) {
      for (const rotation of [0, Math.PI / 2]) {
        const flame = new THREE.Mesh(
          new THREE.PlaneGeometry(0.22, 0.42, 6, 16),
          this.flameMaterial,
        );
        flame.rotation.y = rotation;
        this.flame.add(flame);
      }
      this.flame.position.y = height + 0.22;
    } else {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 24, 16),
        new THREE.MeshStandardMaterial({
          color: kind === 'violet' ? '#c097ff' : '#ffcf77',
          emissive: kind === 'violet' ? '#af66ff' : '#ffbd56',
          emissiveIntensity: 4,
        }),
      );
      bulb.scale.y = 1.5;
      this.flame.add(bulb);
      this.flame.position.y = height + 0.1;
    }
    this.candle.add(this.flame);
    this.candle.position.set(0, 0.27, 0);
    this.candle.visible = kind !== 'none';
    this.root.add(this.candle);
    this.candleLight.position.set(0, 0.27 + height + 0.24, 0.05);
    this.candleLight.color.set(
      kind === 'violet' ? '#b77cff' : kind === 'amber' ? '#ffc56b' : '#ffab48',
    );
  }

  setProject(project: Project) {
    if (this.disposed) return;
    const previous = this.currentProject;
    this.currentProject = cloneProject(project);
    if (project.shape !== previous.shape) {
      this.makePumpkin();
      this.makeCandle();
    } else {
      if (JSON.stringify(project.cuts) !== JSON.stringify(previous.cuts)) this.updateGeometry();
      if (
        JSON.stringify(project.strokes) !== JSON.stringify(previous.strokes) ||
        JSON.stringify(project.engravings) !== JSON.stringify(previous.engravings)
      )
        this.updatePaint();
      if (project.light !== previous.light) this.makeCandle();
      if (project.scoops !== previous.scoops) {
        if (project.scoops === previous.scoops + 1) {
          this.scoopIndex = previous.scoops;
          this.scoopStart = this.time;
        } else {
          this.scoopIndex = -1;
        }
        this.updateGuts();
      }
      if (project.lidOpen !== previous.lidOpen) {
        this.updateLid();
        this.updateGuts();
      }
    }
  }
  setSettings(settings: StudioSettings) {
    const old = this.settings;
    this.settings = { ...settings };
    if (
      settings.tool !== old.tool ||
      settings.color !== old.color ||
      settings.stamp !== old.stamp
    ) {
      this.makeTool();
      this.clearGesture();
    }
    if (settings.environment !== old.environment) this.setEnvironment(settings.environment);
    this.controls.mouseButtons.LEFT =
      settings.tool === 'orbit' ? THREE.MOUSE.ROTATE : (null as unknown as THREE.MOUSE);
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.controls.touches.ONE =
      settings.tool === 'orbit' ? THREE.TOUCH.ROTATE : (null as unknown as THREE.TOUCH);
    this.renderer.domElement.style.cursor = settings.tool === 'orbit' ? 'grab' : 'crosshair';
    this.tool.visible = settings.toolVisible;
    if (settings.stage !== old.stage || settings.mode !== old.mode) {
      this.updateGuts();
      if (settings.mode === 'guided') {
        if (settings.stage === 'prepare') this.resetView('top');
        if (settings.stage === 'carve' || settings.stage === 'light') this.resetView('front');
      }
    }
  }
  private setEnvironment(environment: 'day' | 'night') {
    this.environment = environment;
    const night = environment === 'night';
    const bg = new THREE.Color(night ? '#151916' : '#3d453e');
    this.scene.background = bg;
    this.scene.fog = null;
    this.workbench.setLighting(environment);
    this.hemi.intensity = night ? 0.22 : 0.75;
    this.key.intensity = night ? 0.2 : 2.1;
    this.key.color.set(night ? '#b4c7e0' : '#fff1dc');
    this.fill.intensity = night ? 0.5 : 0.85;
    this.scene.environmentIntensity = night ? 0.12 : 0.32;
    this.bloom.strength = night ? 0.37 : 0.08;
    this.bloom.threshold = night ? 0.8 : 1.2;
  }
  resetView(view: 'front' | 'top' = 'front') {
    this.root.rotation.y = 0;
    this.camera.position.copy(view === 'top' ? new THREE.Vector3(0, 7.2, 3.8) : front);
    this.controls.target.set(0, this.currentShape.height * 0.8, 0);
    this.controls.update();
  }
  zoom(delta: number) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    dir.multiplyScalar(delta > 0 ? 0.88 : 1.12);
    dir.setLength(THREE.MathUtils.clamp(dir.length(), 4.3, 11));
    this.camera.position.copy(this.controls.target).add(dir);
    this.controls.update();
  }
  private hit(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.root.updateMatrixWorld(true);
    this.collider.matrixWorld.copy(this.root.matrixWorld);
    return this.raycaster.intersectObject(this.collider, false)[0];
  }
  private uvFromHit(e: PointerEvent): UV | null {
    const hit = this.hit(e);
    if (!hit?.uv) return null;
    const uv: UV = [hit.uv.x, hit.uv.y];
    if (this.points.length) {
      const last = this.points[this.points.length - 1][0];
      while (uv[0] - last > 0.5) uv[0] -= 1;
      while (last - uv[0] > 0.5) uv[0] += 1;
    }
    return uv;
  }
  private allowed() {
    if (this.exporting) return false;
    if (
      this.settings.mode === 'guided' &&
      this.settings.stage === 'carve' &&
      this.currentProject.scoops < SCOOPS_REQUIRED
    ) {
      this.callbacks.info('Open the lid and scoop out the pumpkin first, or switch to Freestyle.');
      return false;
    }
    return true;
  }
  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.settings.tool === 'orbit' || !this.allowed()) return;
    const uv = this.uvFromHit(e);
    if (!uv) return;
    if (
      ['cut', 'saw', 'gouge', 'scraper'].includes(this.settings.tool) &&
      (uv[1] > 0.79 || uv[1] < 0.04)
    ) {
      this.callbacks.info('Draw your opening on the side of the pumpkin, below the lid.');
      return;
    }
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.controls.enabled = false;
    this.drawing = true;
    this.points = [uv];
    if (this.settings.tool === 'knife') {
      if (!this.currentProject.opened) {
        const p = cloneProject(this.currentProject);
        p.opened = true;
        p.lidOpen = true;
        this.callbacks.change(p, 'Opened the lid');
        if (this.settings.mode === 'guided')
          this.callbacks.info('Lid lifted. Select the scoop and drag upward to pull out the pulp.');
      } else
        this.callbacks.info('The lid is already cut. Use “Lift lid” or “Replace lid” to move it.');
      this.clearGesture();
      return;
    }
    if (this.settings.tool === 'scoop') {
      if (!this.currentProject.lidOpen) {
        this.callbacks.info('Lift the lid before scooping.');
        this.clearGesture();
        return;
      }
      if (this.currentProject.scoops >= SCOOPS_REQUIRED) {
        this.callbacks.info('The cavity is empty.');
        this.clearGesture();
        return;
      }
      this.scoopIndex = this.currentProject.scoops;
      this.toolActive = true;
    }
    if (this.settings.tool === 'stamp' || this.settings.tool === 'drill') {
      if (uv[1] > 0.76 || uv[1] < 0.1) {
        this.callbacks.info('Place your cutter on the side of the pumpkin.');
        this.clearGesture();
        return;
      }
      if (this.currentProject.cuts.length >= 150) {
        this.callbacks.info(
          'This pumpkin has reached its 150-cut limit. Save it and start a fresh pumpkin.',
        );
        this.clearGesture();
        return;
      }
      const p = cloneProject(this.currentProject);
      p.cuts.push(
        stampPolygon(
          this.settings.tool === 'drill' ? 'circle' : this.settings.stamp,
          uv,
          this.settings.size * (this.settings.tool === 'drill' ? 0.45 : 1),
        ),
      );
      this.callbacks.change(p, 'Pressed a cutter');
      this.clearGesture();
      return;
    }
    if (this.settings.tool === 'gouge' || this.settings.tool === 'scraper') {
      this.activeEngraving = {
        points: [uv],
        size: this.settings.size,
        kind: this.settings.tool,
        seed: Math.floor(Math.random() * 100000),
      };
      this.updatePaint(undefined, this.activeEngraving);
    }
    if (['paint', 'marker', 'eraser'].includes(this.settings.tool)) {
      this.activeStroke = {
        points: [uv],
        color: this.settings.color,
        size: this.settings.size,
        kind: this.settings.tool as Stroke['kind'],
        seed: Math.floor(Math.random() * 100000),
      };
      this.updatePaint(this.activeStroke);
    }
  };
  private onPointerMove = (e: PointerEvent) => {
    if (this.exporting) return;
    const hit = this.hit(e);
    this.toolActive = !!hit && this.settings.tool !== 'orbit';
    if (hit) {
      this.toolTarget.copy(hit.point).add(new THREE.Vector3(0.18, 0.16, 0.2));
      if (this.drawing && this.settings.tool === 'scoop') {
        const clump = this.guts.children[this.currentProject.scoops];
        if (clump) {
          clump.position
            .copy(this.root.worldToLocal(hit.point.clone()))
            .add(new THREE.Vector3(0, 0.5, 0));
          clump.scale.y = 1.25;
        }
      }
    }
    if (!this.drawing || ['knife', 'stamp', 'drill', 'scoop'].includes(this.settings.tool)) return;
    const uv = this.uvFromHit(e);
    if (
      !uv ||
      uv[1] > (['cut', 'saw', 'gouge', 'scraper'].includes(this.settings.tool) ? 0.79 : 0.98) ||
      uv[1] < 0.04
    )
      return;
    const previous = this.points[this.points.length - 1];
    if (Math.hypot(uv[0] - previous[0], uv[1] - previous[1]) < 0.0015) return;
    if (this.points.length >= 900) return;
    this.points.push(uv);
    if (this.activeStroke) {
      this.activeStroke.points = [...this.points];
      if (performance.now() - this.previewTimer > 36) {
        this.updatePaint(this.activeStroke);
        this.previewTimer = performance.now();
      }
    } else if (this.activeEngraving) {
      this.activeEngraving.points = [...this.points];
      if (performance.now() - this.previewTimer > 48) {
        this.updatePaint(undefined, this.activeEngraving);
        this.previewTimer = performance.now();
      }
    } else if (this.settings.tool === 'cut' || this.settings.tool === 'saw') {
      this.line.geometry.dispose();
      this.line.geometry = new THREE.BufferGeometry().setFromPoints(
        this.points.map((p) => surfacePoint(this.currentShape, ...p).multiplyScalar(1.002)),
      );
    }
  };
  private onPointerUp = (e: PointerEvent) => {
    if (!this.drawing) return;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId))
      this.renderer.domElement.releasePointerCapture(e.pointerId);
    const p = cloneProject(this.currentProject);
    if (this.settings.tool === 'scoop' && p.scoops < SCOOPS_REQUIRED && p.lidOpen) {
      p.scoops++;
      this.callbacks.change(p, 'Pulled out a scoop of pulp');
    } else if (this.activeStroke) {
      if (p.strokes.length >= 500)
        this.callbacks.info(
          'This pumpkin has reached its 500-stroke limit. Save your project before starting another.',
        );
      else {
        p.strokes.push(this.activeStroke);
        this.callbacks.change(
          p,
          this.settings.tool === 'eraser' ? 'Erased a mark' : 'Added a stroke',
        );
      }
    } else if (this.activeEngraving) {
      if ((p.engravings?.length || 0) < 500) {
        p.engravings = [...(p.engravings || []), this.activeEngraving];
        this.callbacks.change(p, 'Carved the surface');
      } else
        this.callbacks.info(
          'Surface stroke limit reached. Save the project before starting another.',
        );
    } else if (this.settings.tool === 'saw') {
      const cuts = sawCuts(this.points, this.settings.size);
      if (p.cuts.length + cuts.length <= 150) {
        p.cuts.push(...cuts);
        this.callbacks.change(p, 'Sawed a slot');
      } else this.callbacks.info('Cut limit reached. Save the project before starting another.');
    } else if (this.settings.tool === 'cut') {
      if (this.points.length >= 4 && p.cuts.length < 150) {
        let area = 0;
        for (let i = 0; i < this.points.length; i++) {
          const a = this.points[i],
            b = this.points[(i + 1) % this.points.length];
          area += a[0] * b[1] - b[0] * a[1];
        }
        if (Math.abs(area) > 0.00015) {
          p.cuts.push([...this.points]);
          this.callbacks.change(p, 'Carved a freehand opening');
        } else
          this.callbacks.info(
            'Draw a loop with a little more space inside. Release to cut it out.',
          );
      } else this.callbacks.info('Draw a closed shape on the pumpkin, then release to cut it out.');
    }
    this.clearGesture();
  };
  private clearGesture() {
    this.drawing = false;
    this.points = [];
    this.activeStroke = null;
    this.activeEngraving = null;
    this.controls.enabled = !this.exporting;
    this.line.geometry.dispose();
    this.line.geometry = new THREE.BufferGeometry();
  }
  private onPointerCancel = () => {
    this.clearGesture();
    this.updatePaint();
    this.updateGuts();
  };
  private onPointerLeave = () => {
    if (!this.drawing) this.toolActive = false;
  };
  private onContext = (e: Event) => e.preventDefault();
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.info(
      'The graphics connection paused. Your project is saved; reload to restore the workshop.',
    );
    this.cancelExport();
  };
  private onContextRestored = () => this.callbacks.info('Graphics connection restored.');

  private tick(dt: number) {
    this.time += dt;
    this.workbench.update(this.time, this.camera.position);
    this.guts.visible =
      (this.settings.mode === 'guided' && this.settings.stage === 'prepare') ||
      this.currentProject.lidOpen ||
      (this.currentProject.cuts.length > 0 && this.currentProject.scoops < SCOOPS_REQUIRED);
    if (this.settings.rotating && !this.drawing && !this.exporting)
      this.root.rotation.y += dt * 0.26;
    this.lid.position.lerp(this.lidPosition, Math.min(1, dt * 6));
    this.lid.rotation.z = THREE.MathUtils.lerp(
      this.lid.rotation.z,
      this.currentProject.lidOpen ? -0.12 : 0,
      Math.min(1, dt * 6),
    );
    const lightOn = this.currentProject.light !== 'none';
    this.candleLight.visible = lightOn;
    const isFlame =
      this.currentProject.light === 'pillar' || this.currentProject.light === 'tealight';
    const wave =
      1 +
      this.currentProject.flicker *
        (Math.sin(this.time * 8.1) * 0.1 +
          Math.sin(this.time * 17.7) * 0.055 +
          Math.sin(this.time * 3.9 + 1) * 0.075);
    const intensity = this.currentProject.brightness * (isFlame ? wave : 1);
    this.candleLight.intensity = lightOn ? intensity * 9 : 0;
    this.flameMaterial.uniforms.time.value = this.time;
    this.flameMaterial.uniforms.strength.value = this.currentProject.flicker;
    this.flame.scale.set(1 + (wave - 1) * 0.5, wave, 1);
    this.pulp.emissive.set(lightOn && this.environment === 'night' ? '#b95108' : '#000000');
    this.pulp.emissiveIntensity = 0.09 * intensity;
    this.rim.emissive.set(lightOn && this.environment === 'night' ? '#ed810a' : '#000000');
    this.rim.emissiveIntensity = 0.13 * intensity;
    if (this.scoopIndex >= 0) {
      const age = this.time - this.scoopStart,
        clump = this.guts.children[this.scoopIndex];
      if (clump && age >= 0 && age < 2 && this.scoopIndex < this.currentProject.scoops) {
        const f = age / 2,
          home = clump.userData.home as THREE.Vector3,
          pile = clump.userData.pile as THREE.Vector3;
        const travel = f * f * (3 - 2 * f);
        clump.visible = true;
        clump.position.copy(home).lerp(pile, travel);
        clump.position.y += Math.sin(f * Math.PI) * 1.35;
        const settle = THREE.MathUtils.smoothstep(f, 0.65, 1);
        clump.scale.set(
          1 - settle * 0.45,
          (1 + Math.sin(f * Math.PI) * 0.35) * (1 - settle * 0.7),
          1 - settle * 0.45,
        );
        clump.rotation.z = -0.2 * f;
        const drips = clump.getObjectByName('drips');
        if (drips) {
          drips.visible = f > 0.12 && f < 0.85;
          drips.children.forEach((drop) => {
            const phase = (f * 2.5 + drop.userData.phase) % 1;
            drop.position.copy(drop.userData.start);
            drop.position.y -= phase * phase * 0.6;
            drop.scale.y = 1.4 + phase * 2;
          });
        }
      } else if (age >= 2 && !this.drawing) {
        this.updateGuts();
        this.scoopIndex = -1;
      }
    }
    if (this.toolActive) {
      this.tool.position.lerp(this.toolTarget, 0.3);
      this.tool.rotation.set(
        -0.25,
        0.15,
        -0.5 + (this.drawing ? Math.sin(this.time * 22) * 0.06 : 0),
      );
    } else {
      this.tool.position.lerp(new THREE.Vector3(1.88, 0.16, 0.85), 0.12);
      this.tool.rotation.set(-Math.PI / 2, 0, -0.55);
    }
    this.controls.update();
  }
  private animate = (timestamp: number) => {
    if (this.disposed) return;
    const dt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.05) : 0.016;
    this.lastTime = timestamp;
    this.tick(dt);
    this.composer.render();
    this.frame = requestAnimationFrame(this.animate);
  };
  advance(ms: number) {
    this.tick(ms / 1000);
    this.composer.render();
  }
  getState() {
    return {
      ready: true,
      setting: 'decorated 3D workbench',
      shape: this.currentProject.shape,
      stage: this.settings.stage,
      mode: this.settings.mode,
      tool: this.settings.tool,
      lidOpen: this.currentProject.lidOpen,
      scoops: this.currentProject.scoops,
      cuts: this.currentProject.cuts.length,
      strokes: this.currentProject.strokes.length,
      engravings: this.currentProject.engravings?.length || 0,
      light: this.currentProject.light,
      environment: this.environment,
      rotating: this.settings.rotating,
      rotation: +this.root.rotation.y.toFixed(2),
      camera: this.camera.position.toArray().map((v) => +v.toFixed(3)),
      exporting: this.exporting,
      triangles: this.body.geometry.attributes.position.count / 3,
      coordinates:
        'UV: u wraps around pumpkin (0.5 is front), v goes from bottom 0 to top 1. World: y up, z toward front.',
    };
  }
  async snapshot() {
    this.composer.render();
    return new Promise<Blob>((resolve, reject) =>
      this.renderer.domElement.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not create image.'))),
        'image/png',
      ),
    );
  }

  cancelExport() {
    this.exportAbort = true;
    if (this.exportRecorder?.state === 'recording') this.exportRecorder.stop();
  }
  async recordVideo(options: {
    duration: number;
    quality: '720' | '1080';
    environment: 'day' | 'night';
    onProgress: (p: number) => void;
  }): Promise<{ blob: Blob; extension: string }> {
    if (this.exporting) throw new Error('A video is already recording.');
    if (!window.MediaRecorder || !this.renderer.domElement.captureStream)
      throw new Error(
        'Video recording is unavailable in this browser. Try a current Chrome, Edge, Firefox, or Safari, or save a PNG.',
      );
    const mime = [
      'video/mp4;codecs=avc1.42001E',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/mp4',
      'video/webm',
    ].find((t) => MediaRecorder.isTypeSupported(t));
    if (!mime)
      throw new Error(
        'This browser has no supported video encoder. Save a PNG or try another browser.',
      );
    this.exporting = true;
    this.exportAbort = false;
    this.controls.enabled = false;
    this.clearGesture();
    this.controls.enabled = false;
    const previous = {
      rotation: this.root.rotation.y,
      environment: this.environment,
      camera: this.camera.position.clone(),
      target: this.controls.target.clone(),
      toolVisible: this.tool.visible,
      pixelRatio: this.renderer.getPixelRatio(),
    };
    let stream: MediaStream | undefined;
    try {
      this.resetView();
      this.tool.visible = false;
      this.setEnvironment(options.environment);
      const h = options.quality === '1080' ? 1080 : 720,
        w = Math.round((h * 16) / 9);
      this.renderer.setPixelRatio(1);
      this.composer.setPixelRatio(1);
      this.renderer.setSize(w, h, false);
      this.composer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.composer.render();
      stream = this.renderer.domElement.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: options.quality === '1080' ? 12_000_000 : 7_000_000,
      });
      this.exportRecorder = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      const result = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
        recorder.onerror = () =>
          reject(new Error('The video encoder stopped unexpectedly. Try 720p or another browser.'));
      });
      recorder.start(100);
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          const p = Math.min(1, (performance.now() - start) / (options.duration * 1000));
          this.root.rotation.y = p * Math.PI * 2;
          options.onProgress(p);
          if (p >= 1 || this.exportAbort || this.disposed || recorder.state !== 'recording')
            resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      if (recorder.state === 'recording') recorder.stop();
      const blob = await result;
      if (this.exportAbort) throw new Error('Video export cancelled.');
      if (blob.size < 1000) throw new Error('The video was empty. Try a different browser.');
      return { blob, extension: recorder.mimeType.includes('mp4') ? 'mp4' : 'webm' };
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      this.exportRecorder = null;
      this.exporting = false;
      this.root.rotation.y = previous.rotation;
      this.tool.visible = previous.toolVisible;
      this.camera.position.copy(previous.camera);
      this.controls.target.copy(previous.target);
      this.controls.enabled = true;
      this.renderer.setPixelRatio(previous.pixelRatio);
      this.composer.setPixelRatio(previous.pixelRatio);
      this.setEnvironment(previous.environment);
      this.resize();
      this.controls.update();
    }
  }
  dispose() {
    this.disposed = true;
    this.cancelExport();
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerCancel);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.removeEventListener('contextmenu', this.onContext);
    el.removeEventListener('webglcontextlost', this.onContextLost);
    el.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.collider.geometry.dispose();
    disposeObject(this.scene);
    this.flameMaterial.dispose();
    this.env.dispose();
    this.composer.dispose();
    this.bloom.dispose();
    this.renderer.dispose();
    el.remove();
  }
}
