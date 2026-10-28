export type UV = [number, number];
export type Stage = 'pick' | 'prepare' | 'carve' | 'light';
export type Tool = 'orbit' | 'knife' | 'scoop' | 'cut' | 'stamp' | 'paint' | 'marker' | 'eraser';
export type Stamp = 'triangle' | 'circle' | 'star' | 'heart' | 'crescent' | 'diamond';
export type LightKind = 'tealight' | 'pillar' | 'amber' | 'violet' | 'none';
export type ShapeId = 'classic' | 'tall' | 'heirloom' | 'ghost' | 'sage';
export interface PumpkinShape {
  id: ShapeId;
  name: string;
  subtitle: string;
  radius: number;
  height: number;
  ribs: number;
  ribDepth: number;
  color: string;
  label: string;
}
export const SHAPES: PumpkinShape[] = [
  {
    id: 'classic',
    name: 'The Classic',
    subtitle: 'Round & ready for anything',
    radius: 1.31,
    height: 1.2,
    ribs: 10,
    ribDepth: 0.1,
    color: '#d96b14',
    label: 'A patch favorite',
  },
  {
    id: 'tall',
    name: 'The Tall One',
    subtitle: 'A little more personality',
    radius: 1.04,
    height: 1.55,
    ribs: 11,
    ribDepth: 0.075,
    color: '#dc6922',
    label: 'Room to get creative',
  },
  {
    id: 'heirloom',
    name: 'The Heirloom',
    subtitle: 'Low, lovely & deeply ribbed',
    radius: 1.48,
    height: 0.93,
    ribs: 12,
    ribDepth: 0.14,
    color: '#c95a2b',
    label: 'Perfectly imperfect',
  },
  {
    id: 'ghost',
    name: 'The Ghost',
    subtitle: 'A pale canvas for bold ideas',
    radius: 1.26,
    height: 1.14,
    ribs: 9,
    ribDepth: 0.065,
    color: '#e5dfbd',
    label: 'Something a little different',
  },
  {
    id: 'sage',
    name: 'The Sage',
    subtitle: 'Earthy with a wild side',
    radius: 1.38,
    height: 1.01,
    ribs: 11,
    ribDepth: 0.12,
    color: '#9ea88b',
    label: 'An autumn original',
  },
];
export interface Stroke {
  points: UV[];
  color: string;
  size: number;
  kind: 'paint' | 'marker' | 'eraser';
  seed: number;
}
export interface Project {
  version: 1;
  name: string;
  shape: ShapeId;
  cuts: UV[][];
  strokes: Stroke[];
  lidOpen: boolean;
  opened: boolean;
  scoops: number;
  light: LightKind;
  brightness: number;
  flicker: number;
  stage: Stage;
}
export interface StudioSettings {
  tool: Tool;
  stamp: Stamp;
  size: number;
  color: string;
  mode: 'guided' | 'freestyle';
  environment: 'day' | 'night';
  rotating: boolean;
  stage: Stage;
  toolVisible: boolean;
}
export const DEFAULT_PROJECT: Project = {
  version: 1,
  name: 'My little jack-o’-lantern',
  shape: 'classic',
  cuts: [],
  strokes: [],
  lidOpen: false,
  opened: false,
  scoops: 0,
  light: 'none',
  brightness: 1.2,
  flicker: 0.65,
  stage: 'pick',
};
export const DEFAULT_SETTINGS: StudioSettings = {
  tool: 'orbit',
  stamp: 'triangle',
  size: 30,
  color: '#f5e8c8',
  mode: 'guided',
  environment: 'day',
  rotating: false,
  stage: 'pick',
  toolVisible: true,
};
export const SCOOPS_REQUIRED = 6;
export function cloneProject(project: Project): Project {
  return structuredClone(project);
}

export function validateProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false;
  const p = value as Project;
  const uv = (v: unknown): v is UV =>
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -0.5 && n <= 1.5);
  return (
    p.version === 1 &&
    typeof p.name === 'string' &&
    p.name.length <= 120 &&
    SHAPES.some((s) => s.id === p.shape) &&
    Array.isArray(p.cuts) &&
    p.cuts.length <= 150 &&
    p.cuts.every((c) => Array.isArray(c) && c.length >= 3 && c.length <= 1000 && c.every(uv)) &&
    Array.isArray(p.strokes) &&
    p.strokes.length <= 500 &&
    p.strokes.every(
      (s) =>
        ['paint', 'marker', 'eraser'].includes(s.kind) &&
        /^#[0-9a-f]{6}$/i.test(s.color) &&
        Number.isFinite(s.size) &&
        s.size >= 1 &&
        s.size <= 100 &&
        Number.isFinite(s.seed) &&
        Array.isArray(s.points) &&
        s.points.length <= 10000 &&
        s.points.every(uv),
    ) &&
    typeof p.opened === 'boolean' &&
    typeof p.lidOpen === 'boolean' &&
    Number.isInteger(p.scoops) &&
    p.scoops >= 0 &&
    p.scoops <= SCOOPS_REQUIRED &&
    ['tealight', 'pillar', 'amber', 'violet', 'none'].includes(p.light) &&
    Number.isFinite(p.brightness) &&
    p.brightness >= 0.2 &&
    p.brightness <= 3 &&
    Number.isFinite(p.flicker) &&
    p.flicker >= 0 &&
    p.flicker <= 1 &&
    ['pick', 'prepare', 'carve', 'light'].includes(p.stage)
  );
}
