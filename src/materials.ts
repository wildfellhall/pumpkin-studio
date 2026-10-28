import * as THREE from 'three';
import type { Stroke } from './types';

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
      const streak = noise(x / 5, y / 130);
      const freckle = hash(x * 2, y * 2) > 0.993 ? 20 : 0;
      const c = 204 + n * 45 + streak * 7 - freckle;
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
    paintTexture = texture(painted);
  return {
    base,
    painted,
    map: paintTexture,
    bumpMap: texture(bump, false),
    roughnessMap: texture(rough, false),
  };
}

export function renderPaint(
  base: HTMLCanvasElement,
  target: HTMLCanvasElement,
  strokes: Stroke[],
  tint: string,
) {
  const ctx = target.getContext('2d')!,
    w = target.width,
    h = target.height;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(base, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  const layer = canvas(w, h),
    lc = layer.getContext('2d')!;
  for (const s of strokes) {
    const random = rng(s.seed),
      size = s.size * 0.95;
    lc.globalCompositeOperation = s.kind === 'eraser' ? 'destination-out' : 'source-over';
    lc.strokeStyle = s.color;
    lc.fillStyle = s.color;
    lc.lineCap = 'round';
    lc.lineJoin = 'round';
    for (const offset of [-w, 0, w]) {
      if (!s.points.length) continue;
      const drawPath = (dx: number, dy: number) => {
        lc.beginPath();
        s.points.forEach(([u, v], i) => {
          const x = u * w + offset + dx,
            y = (1 - v) * h + dy;
          if (!i) lc.moveTo(x, y);
          else lc.lineTo(x, y);
        });
        if (s.points.length === 1) {
          const [u, v] = s.points[0];
          lc.lineTo(u * w + offset + dx + 0.1, (1 - v) * h + dy);
        }
        lc.stroke();
      };
      lc.globalAlpha = s.kind === 'marker' ? 0.72 : 0.96;
      lc.lineWidth = s.kind === 'marker' ? size * 0.34 : size;
      drawPath(0, 0);
      if (s.kind === 'paint') {
        lc.globalAlpha = 0.16;
        for (let i = 0; i < 20; i++) {
          lc.lineWidth = 0.35 + random() * 1.4;
          lc.strokeStyle = i % 3 ? s.color : '#fff8df';
          drawPath((random() - 0.5) * size * 0.9, (random() - 0.5) * size * 0.6);
        }
      }
    }
  }
  ctx.drawImage(layer, 0, 0);
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
