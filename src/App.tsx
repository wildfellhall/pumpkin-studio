import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Expand,
  Film,
  FolderOpen,
  Hand,
  Lightbulb,
  LoaderCircle,
  Moon,
  Mouse,
  MoveUpRight,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { StudioEngine } from './StudioEngine';
import { templateCuts } from './geometry';
import { PumpkinIcon, PumpkinThumbnail, ToolIllustration } from './illustrations';
import {
  cloneProject,
  DEFAULT_PROJECT,
  DEFAULT_SETTINGS,
  SCOOPS_REQUIRED,
  SHAPES,
  validateProject,
  type LightKind,
  type Project,
  type Stage,
  type StudioSettings,
  type Tool,
} from './types';

const STORAGE_KEY = 'hollow-pumpkin-v1';
const GALLERY_KEY = 'hollow-gallery-v1';
const MODE_KEY = 'hollow-mode-v1';
function loadMode(): StudioSettings['mode'] {
  try {
    return localStorage.getItem(MODE_KEY) === 'freestyle' ? 'freestyle' : 'guided';
  } catch {
    return 'guided';
  }
}
const STAGES: { id: Stage; title: string; short: string }[] = [
  { id: 'pick', title: 'Pick a pumpkin', short: 'Pick' },
  { id: 'prepare', title: 'Prepare', short: 'Prep' },
  { id: 'carve', title: 'Carve & paint', short: 'Carve' },
  { id: 'light', title: 'Lighting', short: 'Light' },
];
const TOOLS: { id: Tool; label: string; tip: string }[] = [
  { id: 'knife', label: 'Lid knife', tip: 'Click your pumpkin to cut and lift the lid.' },
  {
    id: 'scoop',
    label: 'Scoop',
    tip: 'Drag upward from the open pumpkin to pull out the wet pulp.',
  },
  { id: 'cut', label: 'Carve', tip: 'Draw a loop on the skin. Release to cut out the shape.' },
  {
    id: 'stamp',
    label: 'Cutters',
    tip: 'Choose a shape, then click the pumpkin to press it through.',
  },
  { id: 'saw', label: 'Saw', tip: 'Drag an open path to saw a narrow slot through the rind.' },
  { id: 'drill', label: 'Drill', tip: 'Click to bore a circular hole. Adjust diameter below.' },
  {
    id: 'gouge',
    label: 'V-gouge',
    tip: 'Drag to engrave a narrow V-shaped groove without cutting through.',
  },
  {
    id: 'scraper',
    label: 'Scraper',
    tip: 'Drag to shave broad strips of skin and expose the flesh.',
  },
  { id: 'paint', label: 'Paint', tip: 'Drag across the pumpkin to leave textured brushstrokes.' },
  {
    id: 'marker',
    label: 'Marker',
    tip: 'Sketch your idea directly on the skin with permanent ink.',
  },
  { id: 'eraser', label: 'Eraser', tip: 'Rub away paint and marker. Undo restores carved pieces.' },
];
const COLORS = ['#f5e8c8', '#292d28', '#af4931', '#6b7855', '#a48abd', '#d9a538'];
function loadProject() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (validateProject(p)) return p;
  } catch {
    /* A fresh project is safe if storage is disabled or malformed. */
  }
  return cloneProject(DEFAULT_PROJECT);
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function filename(project: Project) {
  return (
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'hollow-pumpkin'
  );
}
interface GalleryItem {
  id: string;
  date: string;
  project: Project;
  image: string;
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => [
      ...(ref.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, select, a[href], [tabindex="0"]',
      ) || []),
    ];
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [project, setProject] = useState<Project>(loadProject);
  const [settings, setSettings] = useState<StudioSettings>(() => ({
    ...DEFAULT_SETTINGS,
    stage: loadProject().stage,
    mode: loadMode(),
    tool: loadMode() === 'freestyle' ? 'cut' : 'orbit',
  }));
  const [freePanel, setFreePanel] = useState<'carve' | 'pick' | 'light'>('carve');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const inspectorTrigger = useRef<HTMLElement | null>(null);
  const settingsToggleRef = useRef<HTMLButtonElement | null>(null);
  const openInspector = () => {
    inspectorTrigger.current = document.activeElement as HTMLElement | null;
    setInspectorOpen(true);
  };
  const closeInspector = useCallback(() => {
    setInspectorOpen(false);
    const trigger = inspectorTrigger.current;
    const canRestore = trigger?.isConnected && !trigger.matches(':disabled') && !trigger.closest('[hidden]');
    (canRestore ? trigger : settingsToggleRef.current)?.focus();
  }, []);
  const freestyle = settings.mode === 'freestyle';
  const panel = freestyle ? freePanel : settings.stage;
  const projectRef = useRef(project),
    settingsRef = useRef(settings);
  projectRef.current = project;
  settingsRef.current = settings;
  const [past, setPast] = useState<Project[]>([]),
    [future, setFuture] = useState<Project[]>([]);
  const historyRef = useRef({ past, future });
  historyRef.current = { past, future };
  const [toast, setToast] = useState(''),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const [modal, setModal] = useState<'help' | 'export' | 'gallery' | 'new' | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>(() => {
    try {
      const g = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
      return Array.isArray(g) ? g.filter((v) => validateProject(v.project)).slice(0, 12) : [];
    } catch {
      return [];
    }
  });
  const [saveStatus, setSaveStatus] = useState('All changes saved');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [exportEnv, setExportEnv] = useState<'day' | 'night'>('night'),
    [duration, setDuration] = useState(8),
    [quality, setQuality] = useState<'720' | '1080'>('1080');
  const [recording, setRecording] = useState(false),
    [progress, setProgress] = useState(0),
    [exportError, setExportError] = useState('');
  const engineRef = useRef<StudioEngine | null>(null),
    hostRef = useRef<HTMLDivElement>(null),
    workspaceRef = useRef<HTMLDivElement>(null),
    importRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 5200);
  }, []);
  const commit = useCallback((next: Project, _label = '') => {
    if (JSON.stringify(next) === JSON.stringify(projectRef.current)) return;
    const previous = cloneProject(projectRef.current);
    setPast((p) => [...p.slice(-39), previous]);
    setFuture([]);
    setProject(next);
  }, []);
  const patch = (value: Partial<Project>, label?: string) =>
    commit({ ...cloneProject(projectRef.current), ...value }, label);
  const configure = (value: Partial<StudioSettings>) => setSettings((s) => ({ ...s, ...value }));
  const undo = useCallback(() => {
    const { past } = historyRef.current;
    if (!past.length) return;
    const current = cloneProject(projectRef.current),
      previous = cloneProject(past[past.length - 1]);
    setFuture((f) => [current, ...f]);
    setProject(previous);
    setPast(past.slice(0, -1));
    if (settingsRef.current.mode === 'guided' && current.stage !== previous.stage)
      setSettings((s) => ({ ...s, stage: previous.stage, tool: 'orbit' }));
    notify('Undid the last change.');
  }, [notify]);
  const redo = useCallback(() => {
    const { future } = historyRef.current;
    if (!future.length) return;
    const current = cloneProject(projectRef.current),
      next = cloneProject(future[0]);
    setPast((p) => [...p, current]);
    setProject(next);
    setFuture(future.slice(1));
    if (settingsRef.current.mode === 'guided' && current.stage !== next.stage)
      setSettings((s) => ({ ...s, stage: next.stage, tool: 'orbit' }));
    notify('Redid the change.');
  }, [notify]);

  useEffect(() => {
    if (!hostRef.current) return;
    let engine: StudioEngine;
    try {
      engine = new StudioEngine(hostRef.current, projectRef.current, {
        change: commit,
        info: notify,
        ready: () => setReady(true),
      });
      engineRef.current = engine;
      engine.setSettings(settingsRef.current);
      window.render_game_to_text = () => JSON.stringify(engine.getState());
      window.advanceTime = (ms) => engine.advance(ms);
    } catch (e) {
      setError(
        `We couldn’t start the 3D workshop. Enable hardware acceleration or try a WebGL2-capable browser. ${e instanceof Error ? e.message : ''}`,
      );
    }
    return () => {
      engine?.dispose();
      engineRef.current = null;
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [commit, notify]);
  useEffect(() => {
    engineRef.current?.setProject(project);
  }, [project]);
  useEffect(() => {
    engineRef.current?.setSettings(settings);
  }, [settings]);
  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, settings.mode);
    } catch {
      /* Mode remains usable without storage. */
    }
  }, [settings.mode]);
  useEffect(() => {
    setSaveStatus('Saving…');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        setSaveStatus('All changes saved');
      } catch {
        setSaveStatus('Save a project file to keep your work');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspectorOpen && !modal) {
        e.preventDefault();
        closeInspector();
        return;
      }
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        modal
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if (e.key.toLowerCase() === 'h') setSettings((s) => ({ ...s, tool: 'orbit' }));
      if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else
          void workspaceRef.current
            ?.requestFullscreen()
            .catch(() => notify('Fullscreen is unavailable in this browser.'));
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [undo, redo, modal, notify, inspectorOpen, closeInspector]);

  const stageIndex = STAGES.findIndex((s) => s.id === settings.stage);
  const shape = SHAPES.find((s) => s.id === project.shape)!;
  const goToStage = (stage: Stage) => {
    if (
      settings.mode === 'guided' &&
      (stage === 'carve' || stage === 'light') &&
      project.scoops < SCOOPS_REQUIRED
    ) {
      notify('First, cut the lid and scoop out the pulp. Freestyle lets you work in any order.');
      return;
    }
    const tool: Tool =
      stage === 'prepare'
        ? project.opened
          ? 'scoop'
          : 'knife'
        : stage === 'carve'
          ? 'cut'
          : 'orbit';
    if (stage === 'carve') setInspectorOpen(false);
    else openInspector();
    configure({ stage, tool, rotating: false });
    setProject((p) => ({ ...p, stage }));
  };
  const chooseTool = (tool: Tool) => {
    const showOptions = !['cut', 'knife'].includes(tool);
    inspectorTrigger.current = document.activeElement as HTMLElement | null;
    if (freestyle) {
      setFreePanel('carve');
      setInspectorOpen(showOptions);
      configure({ tool, rotating: false });
      return;
    }
    if (tool === 'knife' || tool === 'scoop') goToStage('prepare');
    else if (settings.stage !== 'carve') {
      if (settings.mode === 'guided' && project.scoops < SCOOPS_REQUIRED) {
        notify('Prepare your pumpkin first, or choose Freestyle to jump right in.');
        return;
      }
      goToStage('carve');
    }
    setInspectorOpen(showOptions);
    configure({ tool, rotating: false });
  };
  const liftLid = () => {
    patch({ opened: true, lidOpen: !project.lidOpen });
    if (!project.opened && !freestyle) configure({ tool: 'scoop' });
  };
  const scoop = () => {
    if (!project.lidOpen) {
      notify('Lift the lid first.');
      return;
    }
    if (project.scoops < SCOOPS_REQUIRED) patch({ scoops: project.scoops + 1 });
  };
  const applyTemplate = (kind: 'classic' | 'cat' | 'celestial') => {
    if (project.cuts.length > 140) {
      notify('Save this pumpkin and start a new one to add more cuts.');
      return;
    }
    patch({ cuts: [...project.cuts, ...templateCuts(kind)] });
    engineRef.current?.resetView();
    notify('Template added. Undo to remove it.');
  };
  const chooseLight = (light: LightKind) => {
    patch({ light });
  };
  const closeModal = useCallback(() => {
    if (!recording) setModal(null);
  }, [recording]);
  const openExport = () => {
    setExportEnv(settings.environment);
    setExportError('');
    setModal('export');
  };
  const saveToGallery = async () => {
    try {
      const blob = await engineRef.current?.snapshot();
      if (!blob) return;
      const image = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = 420;
      canvas.height = 280;
      canvas.getContext('2d')!.drawImage(image, 0, 0, 420, 280);
      image.close();
      const item: GalleryItem = {
        id: crypto.randomUUID(),
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        project: cloneProject(project),
        image: canvas.toDataURL('image/jpeg', 0.7),
      };
      const items = [item, ...gallery].slice(0, 12);
      localStorage.setItem(GALLERY_KEY, JSON.stringify(items));
      setGallery(items);
      notify('Saved to My pumpkins on this device.');
    } catch {
      notify(
        'Device storage is full or unavailable. Download a project file to keep this pumpkin.',
      );
    }
  };
  const exportVideo = async () => {
    if (!engineRef.current) return;
    setRecording(true);
    setProgress(0);
    setExportError('');
    try {
      const result = await engineRef.current.recordVideo({
        duration,
        quality,
        environment: exportEnv,
        onProgress: setProgress,
      });
      download(result.blob, `${filename(project)}-${exportEnv}.${result.extension}`);
      notify('Your rotating pumpkin video is ready.');
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Video export failed.');
    } finally {
      setRecording(false);
    }
  };
  const exportImage = async () => {
    try {
      const blob = await engineRef.current?.snapshot();
      if (blob) {
        download(blob, `${filename(project)}.png`);
        notify('Snapshot downloaded in the current workshop lighting.');
      }
    } catch {
      notify('The image could not be saved. Please try again.');
    }
  };
  const importProject = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error('File too large');
      const value: unknown = JSON.parse(await file.text());
      if (!validateProject(value)) throw new Error('Invalid project');
      commit(value, 'Imported project');
      configure({ stage: value.stage, tool: 'orbit' });
      setModal(null);
      notify('Project opened.');
    } catch {
      notify(
        'This file isn’t a valid Hollow project. Choose a .hollow.json file exported from the studio.',
      );
    }
    if (importRef.current) importRef.current.value = '';
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="wordmark"
          href="#"
          aria-label="Hollow home"
          onClick={(e) => e.preventDefault()}
        >
          <PumpkinIcon size={34} />
          <span>HOLLOW</span>
          <span className="brand-description">PUMPKIN CARVING</span>
        </a>
        <div className="mode-switch" role="group" aria-label="Carving mode">
          <button
            className={settings.mode === 'guided' ? 'selected' : ''}
            aria-pressed={settings.mode === 'guided'}
            onClick={() => {
              const stage =
                project.scoops < SCOOPS_REQUIRED && ['carve', 'light'].includes(project.stage)
                  ? 'prepare'
                  : project.stage;
              setInspectorOpen(false);
              configure({ mode: 'guided', stage, tool: 'orbit' });
            }}
          >
            <Sparkles size={13} /> Guided
          </button>
          <button
            className={settings.mode === 'freestyle' ? 'selected' : ''}
            aria-pressed={settings.mode === 'freestyle'}
            onClick={() => {
              setToast('');
              setInspectorOpen(false);
              configure({
                mode: 'freestyle',
                tool: settings.tool === 'orbit' ? 'cut' : settings.tool,
              });
              setFreePanel('carve');
            }}
          >
            Freestyle <MoveUpRight size={12} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          <button className="nav-link active" onClick={() => setModal(null)}>
            Studio
          </button>
          <button
            className="nav-link"
            aria-label={`My pumpkins ${gallery.length}`}
            onClick={() => setModal('gallery')}
          >
            <FolderOpen size={15} />
            <span className="nav-caption">My pumpkins</span>{' '}
            <span className="count-badge">{gallery.length}</span>
          </button>
          <button
            className="help-button"
            onClick={() => setModal('help')}
            aria-label="How it works"
          >
            <CircleHelp size={19} />
          </button>
          <button className="primary header-export" onClick={openExport}>
            <Download size={14} /> Export
          </button>
        </nav>
      </header>
      <main>
        <div className={`workspace ${freestyle ? 'freestyle-workspace' : ''}`} ref={workspaceRef}>
          <div className="workshop-bar">
            <h1 className="visually-hidden">Carving bench</h1>
            {!freestyle && (
              <div className="stepper" aria-label="Carving steps">
                {STAGES.map((s, i) => (
                  <button
                    key={s.id}
                    className={`step ${settings.stage === s.id ? 'current' : ''} ${i < stageIndex ? 'done' : ''}`}
                    onClick={() => goToStage(s.id)}
                    aria-label={s.title}
                    aria-current={settings.stage === s.id ? 'step' : undefined}
                  >
                    <span className="step-number">
                      {i < stageIndex ? <Check size={12} /> : `0${i + 1}`}
                    </span>
                    <span className="step-title">{s.title}</span>
                    <span className="step-short">{s.short}</span>
                    {i < 3 && <span className="step-connector" />}
                  </button>
                ))}
              </div>
            )}

            {freestyle && (
              <div className="inspector-tabs" role="tablist" aria-label="Workspace controls">
                {(
                  [
                    { id: 'carve', title: 'Tools' },
                    { id: 'pick', title: 'Pumpkin' },
                    { id: 'light', title: 'Lighting' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={freePanel === tab.id}
                    aria-controls="workspace-inspector"
                    onClick={() => {
                      setFreePanel(tab.id);
                      openInspector();
                    }}
                  >
                    {tab.title}
                  </button>
                ))}
              </div>
            )}

            <button
              className={`settings-toggle ${inspectorOpen ? 'selected' : ''}`}
              ref={settingsToggleRef}
              aria-label="Tool and pumpkin settings"
              aria-expanded={inspectorOpen}
              aria-controls="bench-settings"
              onClick={() => (inspectorOpen ? closeInspector() : openInspector())}
              title="Settings (Escape to close)"
            >
              <SlidersHorizontal size={15} />
              <span>Settings</span>
            </button>
            {!freestyle && (
              <div className="guided-actions">
                {settings.stage === 'pick' ? (
                  <button className="primary" onClick={() => goToStage('prepare')}>
                    Use this pumpkin <ArrowRight size={14} />
                  </button>
                ) : settings.stage === 'prepare' ? (
                  <button
                    className="primary"
                    disabled={project.scoops < SCOOPS_REQUIRED}
                    onClick={() => {
                      goToStage('carve');
                      if (project.lidOpen) patch({ lidOpen: false, stage: 'carve' });
                    }}
                  >
                    Start carving <ArrowRight size={14} />
                  </button>
                ) : settings.stage === 'carve' ? (
                  <button
                    className="primary"
                    onClick={() => {
                      goToStage('light');
                      if (project.light === 'none')
                        patch({ light: 'tealight', lidOpen: false, stage: 'light' });
                    }}
                  >
                    Add lighting <Lightbulb size={14} />
                  </button>
                ) : (
                  <>
                    <button className="primary" onClick={openExport}>
                      Export pumpkin <Download size={14} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={saveToGallery}
                      aria-label="Save to My pumpkins"
                    >
                      <Save size={15} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="left-workspace">
            <div className="scene-card">
              <div className={`viewport ${settings.environment === 'night' ? 'night' : ''}`}>
                <div ref={hostRef} className="canvas-host" />
                {!ready && !error && (
                  <div className="loading-scene">
                    <LoaderCircle className="spin" size={25} />
                    <span>Loading studio…</span>
                  </div>
                )}
                {error && (
                  <div className="scene-error">
                    <PumpkinIcon size={48} />
                    <h3>WebGL unavailable</h3>
                    <p>{error}</p>
                    <button className="primary" onClick={() => window.location.reload()}>
                      Try again
                    </button>
                  </div>
                )}
                <div className="scene-top">
                  <div className="light-switch" role="group" aria-label="Scene lighting">
                    <button
                      className={settings.environment === 'day' ? 'selected' : ''}
                      aria-pressed={settings.environment === 'day'}
                      onClick={() => configure({ environment: 'day' })}
                    >
                      <Sun size={14} /> Daylight
                    </button>
                    <button
                      className={settings.environment === 'night' ? 'selected' : ''}
                      aria-pressed={settings.environment === 'night'}
                      onClick={() => configure({ environment: 'night' })}
                    >
                      <Moon size={13} /> Night
                    </button>
                  </div>
                </div>
                <div className="scene-side">
                  <button
                    className="floating-button"
                    onClick={() => engineRef.current?.zoom(1)}
                    aria-label="Zoom in"
                    title="Zoom in"
                  >
                    <ZoomIn size={17} />
                  </button>
                  <button
                    className="floating-button"
                    onClick={() => engineRef.current?.zoom(-1)}
                    aria-label="Zoom out"
                    title="Zoom out"
                  >
                    <ZoomOut size={17} />
                  </button>
                  <span />
                  <button
                    className="floating-button"
                    onClick={() => engineRef.current?.resetView()}
                    aria-label="Reset view"
                    title="Front view"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    className="floating-button"
                    onClick={() => configure({ rotating: !settings.rotating, tool: 'orbit' })}
                    aria-label={settings.rotating ? 'Pause rotation' : 'Rotate pumpkin'}
                    aria-pressed={settings.rotating}
                  >
                    {settings.rotating ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                </div>
                <div className="scene-bottom">
                  <div className="view-hint">
                    <Mouse size={15} />
                    <span>
                      {settings.tool === 'orbit'
                        ? 'Drag to rotate'
                        : settings.tool === 'scoop'
                          ? 'Drag up to pull out pulp'
                          : settings.tool === 'knife'
                            ? 'Click to cut the lid'
                            : ['stamp', 'drill'].includes(settings.tool)
                              ? 'Click to cut a hole'
                              : settings.tool === 'cut'
                                ? 'Draw a loop, release to cut'
                                : settings.tool === 'saw'
                                  ? 'Drag to saw a slot'
                                  : ['gouge', 'scraper'].includes(settings.tool)
                                    ? 'Drag to shave the rind'
                                    : 'Drag to paint'}
                      <b>·</b>
                      {settings.tool === 'orbit' ? 'Scroll to zoom' : 'Right-drag to rotate'}
                    </span>
                  </div>
                  <div className="scene-history">
                    <button
                      className="floating-button"
                      disabled={!past.length}
                      onClick={undo}
                      aria-label="Undo"
                      title="Undo (⌘/Ctrl Z)"
                    >
                      <Undo2 size={16} />
                    </button>
                    <button
                      className="floating-button"
                      disabled={!future.length}
                      onClick={redo}
                      aria-label="Redo"
                      title="Redo (⌘/Ctrl Shift Z)"
                    >
                      <Redo2 size={16} />
                    </button>
                    <button
                      className={`floating-button ${settings.tool === 'orbit' ? 'active' : ''}`}
                      onClick={() => configure({ tool: 'orbit' })}
                      aria-label="Rotate by hand"
                      title="Rotate by hand (H)"
                    >
                      <Hand size={16} />
                    </button>
                    <button
                      className="floating-button"
                      onClick={() => {
                        if (document.fullscreenElement) void document.exitFullscreen();
                        else
                          void workspaceRef.current
                            ?.requestFullscreen()
                            .catch(() => notify('Fullscreen is unavailable.'));
                      }}
                      aria-label="Fullscreen"
                    >
                      <Expand size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="tool-shelf">
              <div className="shelf-tools">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    className={`shelf-tool ${settings.tool === t.id ? 'selected' : ''}`}
                    onClick={() => chooseTool(t.id)}
                    title={t.tip}
                    aria-label={t.label}
                    aria-pressed={settings.tool === t.id}
                  >
                    <ToolIllustration tool={t.id} />
                    <span>{t.label}</span>
                    {settings.tool === t.id && <span className="tool-dot" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="canvas-footer">
              <span title={saveStatus}>
                <span className="saved-dot" />
                {saveStatus}
              </span>
              <button onClick={() => setModal('new')}>
                <Plus size={13} /> Start fresh
              </button>
              <button onClick={() => setModal('help')}>
                <CircleHelp size={13} /> Controls
              </button>
            </div>
          </div>
          <aside
            className="sidebar"
            id="bench-settings"
            hidden={!inspectorOpen}
            aria-label="Bench settings"
          >
            <div className="inspector-heading">
              <span>{freestyle ? 'SETTINGS' : STAGES[stageIndex].title}</span>
              <button className="icon-button" onClick={closeInspector} aria-label="Close settings">
                <X size={16} />
              </button>
            </div>
            <div
              className="sidebar-content"
              id="workspace-inspector"
              role={freestyle ? 'tabpanel' : undefined}
              aria-labelledby={freestyle ? `tab-${freePanel}` : undefined}
            >
              {!freestyle && (
                <div className="panel-eyebrow">
                  <span>STEP 0{stageIndex + 1}</span>
                  <span>{settings.mode === 'guided' ? 'GUIDED' : 'FREESTYLE'}</span>
                </div>
              )}
              {panel === 'pick' && (
                <>
                  <h2>{freestyle ? 'Pumpkin' : 'Pick your pumpkin'}</h2>
                  <p className="panel-description">Select a shape. Drag to inspect it.</p>
                  <div className="shape-list">
                    {SHAPES.map((s) => (
                      <button
                        key={s.id}
                        className={`shape-option ${project.shape === s.id ? 'selected' : ''}`}
                        onClick={() => patch({ shape: s.id })}
                        aria-pressed={project.shape === s.id}
                      >
                        <PumpkinThumbnail shape={s.id} />
                        <span>
                          <strong>{s.name}</strong>
                          <small>{s.subtitle}</small>
                        </span>
                        <span className="radio-indicator">
                          {project.shape === s.id && <Check size={10} />}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!freestyle && panel === 'prepare' && (
                <>
                  <h2>Gut the pumpkin</h2>
                  <p className="panel-description">Cut the lid, then remove the pulp and seeds.</p>
                  <div className="prep-illustration">
                    <ToolIllustration tool={project.opened ? 'scoop' : 'knife'} />
                    <div>
                      <strong>
                        {!project.opened
                          ? 'Cut the lid'
                          : project.scoops < SCOOPS_REQUIRED
                            ? 'Remove the pulp'
                            : 'Ready to carve'}
                      </strong>
                      <p>
                        {!project.opened
                          ? 'Use the lid knife on your pumpkin, or cut the lid below.'
                          : project.scoops < SCOOPS_REQUIRED
                            ? 'With the scoop selected, drag upward from the open pumpkin.'
                            : 'The cavity is empty. Continue to carving.'}
                      </p>
                    </div>
                  </div>
                  <button className="secondary full" onClick={liftLid}>
                    {project.lidOpen ? <ArrowDownToLine size={16} /> : <Scissors size={16} />}{' '}
                    {project.lidOpen
                      ? 'Replace lid'
                      : project.opened
                        ? 'Lift lid'
                        : 'Cut & lift the lid'}
                  </button>
                  <div className="scoop-progress">
                    <div>
                      <span>PULP REMOVED</span>
                      <strong>
                        {project.scoops} / {SCOOPS_REQUIRED} scoops
                      </strong>
                    </div>
                    <div className="progress-track">
                      <div style={{ width: `${(project.scoops / SCOOPS_REQUIRED) * 100}%` }} />
                    </div>
                    <p>
                      {project.scoops === SCOOPS_REQUIRED
                        ? 'Cavity cleared.'
                        : 'Drag upward with the scoop, or use the button.'}
                    </p>
                  </div>
                  <button
                    className="secondary full"
                    disabled={!project.lidOpen || project.scoops === SCOOPS_REQUIRED}
                    onClick={scoop}
                  >
                    <Hand size={16} />{' '}
                    {project.scoops === SCOOPS_REQUIRED ? 'All scooped out' : 'Pull out a scoop'}
                  </button>
                  <button
                    className="text-action"
                    onClick={() => engineRef.current?.resetView('top')}
                  >
                    View cavity from above <ArrowRight size={12} />
                  </button>
                </>
              )}
              {panel === 'carve' && (
                <>
                  <h2>{freestyle ? 'Tools' : 'Carve & paint'}</h2>
                  {!freestyle && (
                    <p className="panel-description">
                      Select a tool below the canvas. Right-drag to rotate.
                    </p>
                  )}
                  <div className="active-tool-card">
                    <ToolIllustration tool={settings.tool} />
                    <div>
                      <span className="eyebrow">SELECTED TOOL</span>
                      <strong>
                        {TOOLS.find((t) => t.id === settings.tool)?.label || 'Rotate by hand'}
                      </strong>
                      <p>
                        {TOOLS.find((t) => t.id === settings.tool)?.tip ||
                          'Drag to rotate the pumpkin.'}
                      </p>
                    </div>
                  </div>
                  {settings.tool === 'stamp' && (
                    <>
                      <label className="field-label">CHOOSE A CUTTER</label>
                      <div className="stamp-grid">
                        {(
                          ['triangle', 'circle', 'star', 'heart', 'crescent', 'diamond'] as const
                        ).map((s) => (
                          <button
                            key={s}
                            className={settings.stamp === s ? 'selected' : ''}
                            aria-label={`${s} cutter`}
                            aria-pressed={settings.stamp === s}
                            onClick={() => configure({ stamp: s })}
                          >
                            <span>
                              {
                                {
                                  triangle: '△',
                                  circle: '○',
                                  star: '☆',
                                  heart: '♡',
                                  crescent: '☾',
                                  diamond: '◇',
                                }[s]
                              }
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {['paint', 'marker'].includes(settings.tool) && (
                    <>
                      <label className="field-label">PIGMENT</label>
                      <div className="color-palette">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            className={settings.color === c ? 'selected' : ''}
                            style={{ background: c }}
                            aria-label={`Use color ${c}`}
                            aria-pressed={settings.color === c}
                            onClick={() => configure({ color: c })}
                          >
                            {settings.color === c && (
                              <Check size={13} color={c === '#f5e8c8' ? '#333' : '#fff'} />
                            )}
                          </button>
                        ))}
                        <label className="custom-color" title="Custom color">
                          <Plus size={14} />
                          <input
                            type="color"
                            aria-label="Custom color"
                            value={settings.color}
                            onChange={(e) => configure({ color: e.target.value })}
                          />
                        </label>
                      </div>
                    </>
                  )}
                  {[
                    'stamp',
                    'saw',
                    'drill',
                    'gouge',
                    'scraper',
                    'paint',
                    'marker',
                    'eraser',
                  ].includes(settings.tool) && (
                    <div className="range-field">
                      <label htmlFor="tool-size">
                        {settings.tool === 'stamp'
                          ? 'Cutter size'
                          : settings.tool === 'drill'
                            ? 'Hole diameter'
                            : ['gouge', 'scraper', 'saw'].includes(settings.tool)
                              ? 'Cut width'
                              : 'Stroke width'}
                        <span>{settings.size}</span>
                      </label>
                      <input
                        id="tool-size"
                        type="range"
                        min="10"
                        max="70"
                        value={settings.size}
                        onChange={(e) => configure({ size: +e.target.value })}
                      />
                      <div className="range-ends">
                        <span>Fine</span>
                        <span>Broad</span>
                      </div>
                    </div>
                  )}
                  {freestyle && (
                    <div className="free-cavity">
                      <div className="control-section-title">
                        <span>CAVITY</span>
                        <span>
                          {Math.round((1 - project.scoops / SCOOPS_REQUIRED) * 100)}% pulp
                        </span>
                      </div>
                      <div className="cavity-actions">
                        <button className="secondary" onClick={liftLid}>
                          {project.lidOpen
                            ? 'Replace lid'
                            : project.opened
                              ? 'Lift lid'
                              : 'Open lid'}
                        </button>
                        <button
                          className="secondary"
                          onClick={() => engineRef.current?.resetView('top')}
                        >
                          View inside
                        </button>
                        <button
                          className="secondary"
                          disabled={project.scoops === SCOOPS_REQUIRED}
                          onClick={() => patch({ scoops: SCOOPS_REQUIRED })}
                        >
                          Empty cavity
                        </button>
                        <button
                          className="secondary"
                          disabled={project.scoops === 0}
                          onClick={() => patch({ scoops: 0 })}
                        >
                          Refill pulp
                        </button>
                      </div>
                      {settings.tool === 'scoop' && (
                        <button
                          className="secondary full spaced"
                          disabled={!project.lidOpen || project.scoops === SCOOPS_REQUIRED}
                          onClick={scoop}
                        >
                          Pull out a scoop
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    className="template-toggle"
                    onClick={() => setTemplatesOpen(!templatesOpen)}
                    aria-expanded={templatesOpen}
                  >
                    <span>
                      <Sparkles size={14} /> Carving templates
                    </span>
                    <ChevronDown size={14} className={templatesOpen ? 'turned' : ''} />
                  </button>
                  {templatesOpen && (
                    <div className="template-options">
                      <button onClick={() => applyTemplate('classic')}>
                        <span>☻</span>Classic face
                        <Plus size={13} />
                      </button>
                      <button onClick={() => applyTemplate('cat')}>
                        <span>♧</span>Cat face
                        <Plus size={13} />
                      </button>
                      <button onClick={() => applyTemplate('celestial')}>
                        <span>☾</span>Moon & stars
                        <Plus size={13} />
                      </button>
                      <small>Templates add real cuts to the front. Undo any time.</small>
                    </div>
                  )}
                  {!freestyle && (
                    <button
                      className="text-action"
                      onClick={() => {
                        if (project.opened) patch({ lidOpen: !project.lidOpen });
                        else notify('Cut your lid in the Scoop step first.');
                      }}
                    >
                      {project.lidOpen ? 'Replace the lid' : 'Lift the lid'}{' '}
                      <ArrowRight size={13} />
                    </button>
                  )}
                </>
              )}
              {panel === 'light' && (
                <>
                  <h2>{freestyle ? 'Lighting' : 'Light the lantern'}</h2>
                  <p className="panel-description">
                    Choose a light source and adjust its intensity.
                  </p>
                  <label className="field-label">LIGHT SOURCE</label>
                  <div className="light-options">
                    {(
                      [
                        {
                          id: 'tealight',
                          icon: '◉',
                          title: 'Tealight',
                          text: 'Low candle flame',
                        },
                        {
                          id: 'pillar',
                          icon: '▥',
                          title: 'Pillar candle',
                          text: 'Tall wax candle',
                        },
                        {
                          id: 'amber',
                          icon: '✦',
                          title: 'Amber LED',
                          text: 'Steady warm light',
                        },
                        {
                          id: 'violet',
                          icon: '✧',
                          title: 'Violet LED',
                          text: 'Steady violet light',
                        },
                        { id: 'none', icon: '○', title: 'Unlit', text: 'No interior light' },
                      ] as const
                    ).map((l) => (
                      <button
                        key={l.id}
                        className={project.light === l.id ? 'selected' : ''}
                        onClick={() => chooseLight(l.id)}
                        aria-pressed={project.light === l.id}
                      >
                        <span className={`light-icon ${l.id}`}>{l.icon}</span>
                        <span>
                          <strong>{l.title}</strong>
                          <small>{l.text}</small>
                        </span>
                        <span className="radio-indicator">
                          {project.light === l.id && <Check size={10} />}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="range-field">
                    <label htmlFor="brightness">
                      Intensity
                      <span>{Math.round((project.brightness / 3) * 100)}%</span>
                    </label>
                    <input
                      id="brightness"
                      type="range"
                      min=".2"
                      max="3"
                      step=".1"
                      value={project.brightness}
                      onChange={(e) => patch({ brightness: +e.target.value })}
                      disabled={project.light === 'none'}
                    />
                  </div>
                  {['tealight', 'pillar'].includes(project.light) && (
                    <div className="range-field compact">
                      <label htmlFor="flicker">
                        Flame flicker<span>{Math.round(project.flicker * 100)}%</span>
                      </label>
                      <input
                        id="flicker"
                        type="range"
                        min="0"
                        max="1"
                        step=".05"
                        value={project.flicker}
                        onChange={(e) => patch({ flicker: +e.target.value })}
                      />
                    </div>
                  )}
                  <div className="light-bottom-actions">
                    <button
                      className="text-action"
                      onClick={() =>
                        configure({ environment: settings.environment === 'day' ? 'night' : 'day' })
                      }
                    >
                      <Moon size={13} />
                      {settings.environment === 'day' ? 'Night preview' : 'Daylight preview'}
                    </button>
                    {project.opened && (
                      <button
                        className="text-action"
                        onClick={() => patch({ lidOpen: !project.lidOpen })}
                      >
                        {project.lidOpen ? 'Replace lid' : 'Lift lid'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>
      <input
        ref={importRef}
        type="file"
        accept=".json,.hollow.json"
        hidden
        onChange={(e) => void importProject(e.target.files?.[0])}
      />
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={15} />
          </span>
          <p>{toast}</p>
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}

      {modal === 'help' && (
        <Modal title="Studio controls" onClose={closeModal}>
          <p className="modal-intro">Carve, decorate, and export a rotating lantern.</p>
          <div className="help-steps">
            {[
              {
                title: 'Choose a pumpkin',
                text: 'Pick from five shapes and colors. Drag the pumpkin to see every side; scroll to get closer.',
                icon: <PumpkinIcon size={24} />,
              },
              {
                title: 'Prepare the cavity',
                text: 'Cut and lift the lid. Use the scoop and drag upward to pull out six clumps of slippery pulp and seeds.',
                icon: <Scissors size={21} />,
              },
              {
                title: 'Carve and decorate',
                text: 'Draw a loop with Carve and release to make a real opening. Press in cutters, brush on paint, or sketch with a marker. Right-drag to rotate while using a tool.',
                icon: <Sparkles size={22} />,
              },
              {
                title: 'Light and export',
                text: 'Choose a candle or LED, try the night preview, and download a full rotating video or a still image.',
                icon: <Lightbulb size={22} />,
              },
            ].map((s, i) => (
              <div key={s.title}>
                <span>{s.icon}</span>
                <div>
                  <strong>
                    0{i + 1} — {s.title}
                  </strong>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="help-note">
            <strong>Guided or Freestyle</strong>
            <p>
              Guided takes you through each step. Freestyle has no steps: switch tools, change the
              pumpkin or lighting, and empty or refill the cavity whenever you like. Your current
              pumpkin saves on this device. Download a project file to keep an editable copy.
            </p>
          </div>
          <div className="shortcuts">
            <span>
              <kbd>H</kbd> Rotate
            </span>
            <span>
              <kbd>F</kbd> Fullscreen
            </span>
            <span>
              <kbd>⌘ / Ctrl Z</kbd> Undo
            </span>
          </div>
          <button className="primary full" onClick={closeModal}>
            Return to studio <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {modal === 'export' && (
        <Modal title="Export pumpkin." onClose={closeModal}>
          <p className="modal-intro">Download a full rotation in daylight or at night.</p>
          <div className="export-preview">
            <PumpkinThumbnail shape={project.shape} />
            <div>
              <strong>{project.name}</strong>
              <span>
                {shape.name} · {project.cuts.length} cuts · {project.strokes.length} strokes
              </span>
            </div>
            <Film size={21} />
          </div>
          <div className="export-fields">
            <label className="field-label" htmlFor="project-name">
              PROJECT NAME
            </label>
            <input
              className="text-input"
              id="project-name"
              maxLength={120}
              value={project.name}
              disabled={recording}
              onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
            />
            <span className="field-label">LIGHTING</span>
            <div className="export-light">
              <button
                disabled={recording}
                className={exportEnv === 'day' ? 'selected' : ''}
                aria-pressed={exportEnv === 'day'}
                onClick={() => setExportEnv('day')}
              >
                <Sun size={19} />
                <strong>Daylight</strong>
                <small>Neutral work light</small>
              </button>
              <button
                disabled={recording}
                className={exportEnv === 'night' ? 'selected' : ''}
                aria-pressed={exportEnv === 'night'}
                onClick={() => setExportEnv('night')}
              >
                <Moon size={18} />
                <strong>Night</strong>
                <small>Candlelight & shadows</small>
              </button>
            </div>
            <div className="export-selects">
              <label>
                One full rotation
                <select
                  disabled={recording}
                  value={duration}
                  onChange={(e) => setDuration(+e.target.value)}
                >
                  <option value={6}>6 seconds</option>
                  <option value={8}>8 seconds</option>
                  <option value={12}>12 seconds</option>
                </select>
              </label>
              <label>
                Resolution
                <select
                  disabled={recording}
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as '720' | '1080')}
                >
                  <option value="1080">1080p · Full HD</option>
                  <option value="720">720p · Smaller file</option>
                </select>
              </label>
            </div>
          </div>
          {exportError && (
            <p className="export-error" role="alert">
              {exportError}
            </p>
          )}
          {recording ? (
            <div className="recording-progress">
              <div>
                <span>
                  <span className="record-dot" />
                  Recording…
                </span>
                <strong>{Math.round(progress * 100)}%</strong>
              </div>
              <div className="progress-track">
                <div style={{ width: `${progress * 100}%` }} />
              </div>
              <p>Keep this tab visible until recording finishes.</p>
              <button className="text-action" onClick={() => engineRef.current?.cancelExport()}>
                Cancel recording
              </button>
            </div>
          ) : (
            <>
              <button className="primary full" onClick={exportVideo} disabled={!ready}>
                <Download size={16} /> Download rotating video
              </button>
              <p className="export-footnote">
                16:9 · 30 fps target · MP4 or WebM, depending on your browser.
                <br />
                PNG snapshots use the current workshop view and lighting.
              </p>
              <div className="export-other">
                <button onClick={exportImage}>
                  <ArrowDownToLine size={15} /> Save a PNG
                </button>
                <button
                  onClick={() => {
                    download(
                      new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
                      `${filename(project)}.hollow.json`,
                    );
                    notify('Editable project downloaded.');
                  }}
                >
                  <Save size={15} /> Save project
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
      {modal === 'gallery' && (
        <Modal title="Saved pumpkins" onClose={closeModal} wide>
          <p className="modal-intro">
            Your saved projects on this device.
            <br />
            <small>Saved on this device. Keep project files for a lasting copy.</small>
          </p>
          <div className="gallery-actions">
            <button className="secondary" onClick={saveToGallery}>
              <Plus size={15} /> Save current pumpkin
            </button>
            <button className="secondary" onClick={() => importRef.current?.click()}>
              <Upload size={15} /> Open project file
            </button>
          </div>
          {!gallery.length ? (
            <div className="empty-gallery">
              <PumpkinIcon size={60} />
              <h3>No saved pumpkins</h3>
              <p>Save your current pumpkin or open a project file.</p>
            </div>
          ) : (
            <div className="gallery-grid">
              {gallery.map((item) => (
                <button
                  key={item.id}
                  className="gallery-card"
                  onClick={() => {
                    commit(cloneProject(item.project), 'Opened saved pumpkin');
                    configure({ stage: item.project.stage, tool: 'orbit' });
                    setModal(null);
                    notify('Saved pumpkin opened. Undo returns to your previous work.');
                  }}
                >
                  <img src={item.image} alt={item.project.name} />
                  <span>
                    <strong>{item.project.name}</strong>
                    <small>
                      {item.date} · {SHAPES.find((s) => s.id === item.project.shape)?.name}
                    </small>
                  </span>
                  <FolderOpen size={16} />
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
      {modal === 'new' && (
        <Modal title="New pumpkin" onClose={closeModal}>
          <p className="modal-intro">
            Start a new pumpkin. You can undo this action or save the current project first.
          </p>
          <div className="new-pumpkin">
            <PumpkinThumbnail shape="classic" />
          </div>
          <button
            className="primary full"
            onClick={() => {
              commit(cloneProject(DEFAULT_PROJECT), 'Started fresh');
              configure({
                ...DEFAULT_SETTINGS,
                mode: settings.mode,
                tool: freestyle ? 'cut' : 'orbit',
              });
              setFreePanel('carve');
              setInspectorOpen(false);
              engineRef.current?.resetView();
              setModal(null);
              notify('New pumpkin created.');
            }}
          >
            Create new pumpkin <ArrowRight size={16} />
          </button>
          <button
            className="secondary full spaced"
            onClick={async () => {
              await saveToGallery();
              closeModal();
            }}
          >
            <Save size={15} /> Save this pumpkin first
          </button>
        </Modal>
      )}
    </div>
  );
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}
