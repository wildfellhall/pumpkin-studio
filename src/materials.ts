import * as THREE from 'three';
import type { Engraving, Stroke } from './types';

export function rng(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), t | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(x: number, y: number) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return v - Math.floor(v);
}
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), ux),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), ux),
    uy,
  );
}
function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function texture(c: HTMLCanvasElement, color = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createSkinTextures() {
  const base = canvas(1024, 512),
    bump = canvas(1024, 512),
    rough = canvas(1024, 512);
  const ctx = base.getContext('2d')!,
    bctx = bump.getContext('2d')!,
    rctx = rough.getContext('2d')!;
  const colorData = ctx.createImageData(1024, 512),
    bumpData = bctx.createImageData(1024, 512),
    roughData = rctx.createImageData(1024, 512);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 1024; x++) {
      const i = (y * 1024 + x) * 4;
      const n =
        noise(x / 33, y / 39) * 0.48 +
        noise(x / 11, y / 16) * 0.28 +
        noise(x / 3, y / 3) * 0.15 +
        hash(x, y) * 0.09;
      const streak = noise(x / 5, y / 130),
        freckle = hash(x * 2, y * 2) > 0.993 ? 20 : 0;
      const c = 194 + n * 53 + streak * 7 - freckle;
      colorData.data.set([Math.min(255, c + 8), c, c - n * 12, 255], i);
      const b = 80 + n * 110 + hash(x, y) * 30;
      bumpData.data.set([b, b, b, 255], i);
      const r = 140 + n * 55;
      roughData.data.set([r, r, r, 255], i);
    }
  ctx.putImageData(colorData, 0, 0);
  bctx.putImageData(bumpData, 0, 0);
  rctx.putImageData(roughData, 0, 0);
  const painted = canvas(2048, 1024),
    relief = canvas(2048, 1024),
    finish = canvas(2048, 1024),
    depth = canvas(2048, 1024);
  return {
    base,
    baseBump: bump,
    baseRoughness: rough,
    painted,
    relief,
    finish,
    depth,
    map: texture(painted),
    bumpMap: texture(relief, false),
    roughnessMap: texture(finish, false),
    displacementMap: texture(depth, false),
    layers: [canvas(2048, 1024), canvas(2048, 1024), canvas(2048, 1024), canvas(2048, 1024)],
  };
}
export type SurfaceTextures = ReturnType<typeof createSkinTextures>;

/** Flat bristle footprint. Pigment coverage, microrelief and finish share one alpha mask. */
const stampCache = new Map<string, HTMLCanvasElement[]>();
function paintStamp(color: string, seed: number, marker = false) {
  const key = `${color}-${seed}-${marker}`;
  const cached = stampCache.get(key);
  if (cached) return cached;
  const maps = [canvas(96, 96), canvas(96, 96), canvas(96, 96)];
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (let channel = 0; channel < 3; channel++) {
    const ctx = maps[channel].getContext('2d')!,
      data = ctx.createImageData(96, 96);
    for (let y = 0; y < 96; y++)
      for (let x = 0; x < 96; x++) {
        const nx = (x - 47.5) / 48,
          ny = (y - 47.5) / 48;
        const bristle = noise(y * 0.85 + seed, 1),
          grain = hash(x + seed, y),
          edge = 0.87 + noise(y * 0.31, seed) * 0.13;
        const footprint = marker
          ? Math.max(0, 1 - Math.pow(nx * nx + ny * ny, 8))
          : Math.max(
              0,
              Math.min(1, (edge - Math.pow(Math.abs(nx), 4) - Math.pow(Math.abs(ny), 6)) * 7),
            );
        const dryGap = bristle < 0.25 ? 0.17 : 1;
        const alpha =
          footprint *
          (marker ? 0.3 + grain * 0.24 : (0.32 + bristle * 0.56) * dryGap) *
          (grain > 0.96 ? 0.55 : 1);
        const ridge = bristle * 0.65 + grain * 0.35;
        const colorValues =
          channel === 0
            ? rgb.map((v) => Math.max(0, Math.min(255, v * (0.85 + ridge * 0.2))))
            : channel === 1
              ? [152 + ridge * 74, 152 + ridge * 74, 152 + ridge * 74]
              : [115 + grain * 65, 115 + grain * 65, 115 + grain * 65];
        data.data.set([...colorValues, alpha * 255], (y * 96 + x) * 4);
      }
    ctx.putImageData(data, 0, 0);
  }
  if (stampCache.size >= 80) stampCache.delete(stampCache.keys().next().value!);
  stampCache.set(key, maps);
  return maps;
}

export function renderPaint(
  surface: SurfaceTextures,
  strokes: Stroke[],
  engravings: Engraving[],
  tint: string,
) {
  const { painted, relief, finish, depth } = surface,
    w = painted.width,
    h = painted.height;
  const color = painted.getContext('2d')!,
    bump = relief.getContext('2d')!,
    rough = finish.getContext('2d')!,
    displace = depth.getContext('2d')!;
  color.globalCompositeOperation = 'source-over';
  color.globalAlpha = 1;
  color.fillStyle = tint;
  color.fillRect(0, 0, w, h);
  color.globalCompositeOperation = 'multiply';
  color.drawImage(surface.base, 0, 0, w, h);
  color.globalCompositeOperation = 'source-over';
  bump.globalCompositeOperation = 'source-over';
  bump.drawImage(surface.baseBump, 0, 0, w, h);
  rough.globalCompositeOperation = 'source-over';
  rough.drawImage(surface.baseRoughness, 0, 0, w, h);
  displace.fillStyle = '#808080';
  displace.fillRect(0, 0, w, h);
  // Scraped flesh stays intact. Tapered strokes alter surface depth as well as its color.
  for (const e of engravings) {
    const random = rng(e.seed),
      width = e.size * (e.kind === 'gouge' ? 0.48 : 1.5);
    for (const offset of [-w, 0, w]) {
      const draw = (ctx: CanvasRenderingContext2D, lw: number, c: string, dx = 0) => {
        ctx.beginPath();
        e.points.forEach(([u, v], i) => {
          const x = u * w + offset + dx,
            y = (1 - v) * h;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        if (e.points.length === 1)
          ctx.lineTo(e.points[0][0] * w + offset + 0.1, (1 - e.points[0][1]) * h);
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      };
      draw(color, width, '#a75e24');
      draw(color, width * 0.78, '#e8ac54');
      draw(color, width * 0.28, '#f2c471');
      draw(displace, width, '#707070');
      draw(displace, width * 0.72, '#444444');
      draw(displace, width * 0.32, e.kind === 'gouge' ? '#171717' : '#303030');
      draw(bump, width, '#777777');
      draw(bump, width * 0.72, '#484848');
      draw(bump, width * 0.32, '#202020');
      draw(rough, width, '#b5b5b5');
      if (e.kind === 'scraper')
        for (let i = 0; i < 13; i++) {
          const dx = (random() - 0.5) * width * 0.75;
          draw(color, 0.35 + random() * 0.8, i % 3 ? '#d99843' : '#f8cc86', dx);
          draw(bump, 0.5 + random(), '#696969', dx);
        }
    }
  }
  // Decoration is isolated so erasing restores the original rind or carved flesh beneath it.
  const layers = surface.layers;
  const contexts = layers.map((c) => c.getContext('2d')!);
  contexts.forEach((c) => {
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, w, h);
  });
  for (const s of strokes) {
    const size = s.size * (s.kind === 'marker' ? 0.4 : 1.35),
      stamps = paintStamp(s.color, s.seed, s.kind === 'marker');
    if (s.kind === 'eraser') {
      for (const offset of [-w, 0, w])
        for (const ctx of contexts) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#000';
          ctx.beginPath();
          s.points.forEach(([u, v], i) => {
            if (i) ctx.lineTo(u * w + offset, (1 - v) * h);
            else ctx.moveTo(u * w + offset, (1 - v) * h);
          });
          if (s.points.length === 1)
            ctx.lineTo(s.points[0][0] * w + offset + 0.1, (1 - s.points[0][1]) * h);
          ctx.stroke();
        }
      continue;
    }
    contexts.forEach((c) => (c.globalCompositeOperation = 'source-over'));
    for (let i = 0; i < s.points.length; i++) {
      const prev = s.points[Math.max(0, i - 1)],
        point = s.points[i];
      const dx = (point[0] - prev[0]) * w,
        dy = -(point[1] - prev[1]) * h;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(1.1, size * 0.09))),
        angle = Math.atan2(dy, dx);
      for (let j = 0; j < steps; j++) {
        const t = (j + 1) / steps,
          x = prev[0] * w + dx * t,
          y = (1 - prev[1]) * h + dy * t;
        for (const offset of [-w, 0, w]) {
          if (x + offset < -size || x + offset > w + size) continue;
          contexts.forEach((ctx, k) => {
            // Marker changes color and finish, but does not create a thick paint ridge.
            if (s.kind === 'marker' && (k === 1 || k === 3)) return;
            ctx.save();
            ctx.translate(x + offset, y);
            ctx.rotate(angle);
            ctx.drawImage(stamps[k === 3 ? 1 : k], -size * 0.36, -size * 0.5, size * 0.72, size);
            ctx.restore();
          });
        }
      }
    }
  }
  [color, bump, rough, displace].forEach((ctx, i) => ctx.drawImage(layers[i], 0, 0));
}

export function tissueTexture() {
  const c = canvas(256, 256),
    ctx = c.getContext('2d')!,
    img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const fib = noise(x / 2.5 + Math.sin(y * 0.05) * 2, y / 32),
        grain = hash(x, y);
      const n = 140 + fib * 90 + grain * 20;
      img.data.set([n, n * 0.91, n * 0.65, 255], (y * 256 + x) * 4);
    }
  ctx.putImageData(img, 0, 0);
  return texture(c);
}

export function woodTexture() {
  const c = canvas(1024, 1024),
    ctx = c.getContext('2d')!,
    img = ctx.createImageData(1024, 1024);
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1024; x++) {
      const warp = Math.sin(y * 0.006) * 7 + noise(x / 80, y / 180) * 17;
      const grain = Math.sin((x + warp) * 0.19) * 0.5 + Math.sin((x + warp) * 0.67) * 0.18;
      const n = noise(x / 40, y / 200) * 18 + noise(x / 5, y / 50) * 6 + grain * 6;
      const plank = (Math.floor(x / 171) % 3) * 3;
      const seam = x % 171 < 1 ? 15 : 0;
      img.data.set(
        [155 + n - plank - seam, 112 + n - plank - seam, 74 + n * 0.8 - plank - seam, 255],
        (y * 1024 + x) * 4,
      );
    }
  ctx.putImageData(img, 0, 0);
  return texture(c);
}

export function stemTexture() {
  const c = canvas(256, 512),
    ctx = c.getContext('2d')!,
    img = ctx.createImageData(256, 512);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 256; x++) {
      const n = noise(x / 4, y / 35) * 50 + noise(x / 1.4, y / 4) * 26;
      const stripe = Math.pow(Math.sin(x * 0.17 + Math.sin(y * 0.04) * 0.2), 12) * 30;
      img.data.set(
        [66 + n - stripe, 65 + n * 0.9 - stripe, 36 + n * 0.55 - stripe, 255],
        (y * 256 + x) * 4,
      );
    }
  ctx.putImageData(img, 0, 0);
  return texture(c);
}

export function glowTexture() {
  const c = canvas(128, 128),
    ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,200,93,.6)');
  g.addColorStop(0.2, 'rgba(255,134,31,.22)');
  g.addColorStop(0.55, 'rgba(255,96,18,.06)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return texture(c);
}

export function createFlameMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      strength: { value: 0.65 },
      tint: { value: new THREE.Color('#ffaf46') },
    },
    vertexShader: `varying vec2 vUv; uniform float time; uniform float strength;
      void main() { vUv = uv; vec3 p = position; p.x += sin(time*6.7 + p.y*8.)*.035*uv.y*uv.y*strength; p.z += cos(time*8.2 + p.y*4.)*.022*uv.y*strength; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float time; uniform float strength; uniform vec3 tint;
      void main() {
        vec2 p = vec2((vUv.x-.5)*2., vUv.y);
        float wobble = sin(p.y*19.-time*8.)*.055*strength;
        float width = pow(max(0.,sin(p.y*3.14159)),.7) * (.68-.46*p.y);
        float shape = 1.-smoothstep(width-.12, width+.08, abs(p.x+wobble*p.y));
        float base = smoothstep(0., .09, p.y) * (1.-smoothstep(.82,1.,p.y));
        float core = 1.-smoothstep(0.,width*.85,abs(p.x));
        vec3 col = mix(tint, vec3(1.,.94,.65), core*(1.-p.y*.7));
        col = mix(vec3(.22,.35,1.),col,smoothstep(.02,.16,p.y));
        gl_FragColor = vec4(col*2.0, shape*base*.92);
      }`,
  });
}
