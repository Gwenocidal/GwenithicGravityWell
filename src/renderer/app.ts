import "./styles.css";
import { fitWithinLongEdge, GravityRenderer, type RendererLimits, type Vec2 } from "./engine";
import {
  createUniverseState,
  makeExposureRecipe,
  normalizePath,
  normalizeUniverseState,
  RENDERER_VERSION,
  samplePath,
  UniverseJournal,
  zoomObserverAt,
  type ExposureRecipe,
  type ObserverState,
  type PathPoint,
  type UniverseCommand,
  type UniverseState,
} from "./universe";

window.addEventListener("error", (event) => {
  window.gravityAPI.reportFailure(event.error?.stack ?? event.message ?? "Unknown renderer error");
});

type Settings = {
  sceneWidth: number;
  sceneHeight: number;
  captureScale: number;
  captureFormat: "png" | "jpeg" | "webp";
  captureQuality: number;
  includeCursor: boolean;
  temporalSamples: number;
};

type CaptureOverrides = Partial<{
  width: number;
  height: number;
  scale: number;
  format: "png" | "jpeg" | "webp";
  quality: number;
  includeCursor: boolean;
  tileSize: number;
  tileHeight: number;
  pointer: Vec2;
  motion: Vec2;
  strength: number;
  time: number;
  temporalSamples: number;
  observer: ObserverState;
  radiance: UniverseState["radiance"];
  seed: number;
  path: PathPoint[];
  duration: number;
}>;

type ActiveCapture = {
  jobId: string;
  worker: Worker;
  reject: (reason: Error) => void;
  pointer: Vec2;
  scale: number;
  format: "png" | "jpeg" | "webp";
  quality: number;
  includeCursor: boolean;
  temporalSamples: number;
};

const DEFAULT_SETTINGS: Settings = {
  sceneWidth: 1920,
  sceneHeight: 1080,
  captureScale: 1,
  captureFormat: "png",
  captureQuality: 94,
  includeCursor: false,
  temporalSamples: 1,
};

const SCENE_PRESETS = new Set([
  "1280x720",
  "1920x1080",
  "2560x1440",
  "3440x1440",
  "3840x2160",
  "5120x2880",
  "7680x4320",
  "15360x8640",
]);

const stage = requireElement<HTMLElement>("stage");
const canvas = requireElement<HTMLCanvasElement>("scene");
const menu = requireElement<HTMLElement>("menu");
const statusToast = requireElement<HTMLElement>("status-toast");
const statusText = requireElement<HTMLElement>("status-text");
const statusProgress = requireElement<HTMLElement>("status-progress");
const windowMode = requireElement<HTMLSelectElement>("window-mode");
const scenePreset = requireElement<HTMLSelectElement>("scene-preset");
const sceneCustom = requireElement<HTMLElement>("scene-custom");
const sceneWidthInput = requireElement<HTMLInputElement>("scene-width");
const sceneHeightInput = requireElement<HTMLInputElement>("scene-height");
const applySceneButton = requireElement<HTMLButtonElement>("apply-scene");
const sceneNote = requireElement<HTMLElement>("scene-note");
const captureScaleSelect = requireElement<HTMLSelectElement>("capture-scale");
const scaleCustomRow = requireElement<HTMLElement>("scale-custom-row");
const captureScaleCustom = requireElement<HTMLInputElement>("capture-scale-custom");
const captureDimensions = requireElement<HTMLElement>("capture-dimensions");
const capturePixels = requireElement<HTMLElement>("capture-pixels");
const captureFormat = requireElement<HTMLSelectElement>("capture-format");
const captureQuality = requireElement<HTMLInputElement>("capture-quality");
const qualityRow = requireElement<HTMLElement>("quality-row");
const includeCursor = requireElement<HTMLInputElement>("include-cursor");
const captureNowButton = requireElement<HTMLButtonElement>("capture-now");
const cancelCaptureButton = requireElement<HTMLButtonElement>("cancel-capture");
const captureNote = requireElement<HTMLElement>("capture-note");
const captureDirectory = requireElement<HTMLElement>("capture-directory");
const openCapturesButton = requireElement<HTMLButtonElement>("open-captures");
const quitButton = requireElement<HTMLButtonElement>("quit-app");
const hudMode = requireElement<HTMLElement>("hud-mode");
const hudZoom = requireElement<HTMLElement>("hud-zoom");
const hudCoordinate = requireElement<HTMLElement>("hud-coordinate");
const interactionMode = requireElement<HTMLSelectElement>("interaction-mode");
const observerZoom = requireElement<HTMLElement>("observer-zoom");
const observerCenter = requireElement<HTMLElement>("observer-center");
const observerHome = requireElement<HTMLButtonElement>("observer-home");
const addBookmark = requireElement<HTMLButtonElement>("add-bookmark");
const bookmarkList = requireElement<HTMLElement>("bookmark-list");
const exposureInput = requireElement<HTMLInputElement>("exposure");
const exposureValue = requireElement<HTMLOutputElement>("exposure-value");
const spectralInput = requireElement<HTMLInputElement>("spectral");
const spectralValue = requireElement<HTMLOutputElement>("spectral-value");
const toneMap = requireElement<HTMLSelectElement>("tone-map");
const recordPathButton = requireElement<HTMLButtonElement>("record-path");
const playPathButton = requireElement<HTMLButtonElement>("play-path");
const clearPathButton = requireElement<HTMLButtonElement>("clear-path");
const temporalSamples = requireElement<HTMLSelectElement>("temporal-samples");
const timelineState = requireElement<HTMLElement>("timeline-state");
const timelineDetail = requireElement<HTMLElement>("timeline-detail");
const saveUniverseButton = requireElement<HTMLButtonElement>("save-universe");
const loadUniverseButton = requireElement<HTMLButtonElement>("load-universe");
const journalStatus = requireElement<HTMLElement>("journal-status");
const loadRecipeButton = requireElement<HTMLButtonElement>("load-recipe");
const renderRecipeButton = requireElement<HTMLButtonElement>("render-recipe");
const fatalShell = requireElement<HTMLElement>("fatal-shell");
const fatalSummary = requireElement<HTMLElement>("fatal-summary");
const fatalTechnical = requireElement<HTMLElement>("fatal-technical");
const fatalQuit = requireElement<HTMLButtonElement>("fatal-quit");

let settings = loadSettings();
let appInfo: GravityAppInfo;
let menuOpen = false;
let activeCapture: ActiveCapture | null = null;
let successToastTimer = 0;
let journal = loadLocalUniverse();
let universePersistTimer = 0;
let loadedRecipe: ExposureRecipe | null = null;


function requireElement<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing interface element #${id}.`);
  return element as T;
}


function loadSettings(): Settings {
  try {
    const parsed = JSON.parse(localStorage.getItem("gravity-well-settings") ?? "{}");
    return {
      sceneWidth: finiteInteger(parsed.sceneWidth, DEFAULT_SETTINGS.sceneWidth),
      sceneHeight: finiteInteger(parsed.sceneHeight, DEFAULT_SETTINGS.sceneHeight),
      captureScale: finiteNumber(parsed.captureScale, DEFAULT_SETTINGS.captureScale),
      captureFormat: ["png", "jpeg", "webp"].includes(parsed.captureFormat)
        ? parsed.captureFormat
        : DEFAULT_SETTINGS.captureFormat,
      captureQuality: finiteInteger(parsed.captureQuality, DEFAULT_SETTINGS.captureQuality),
      includeCursor: Boolean(parsed.includeCursor),
      temporalSamples: [1, 4, 8, 16, 32].includes(Number(parsed.temporalSamples))
        ? Number(parsed.temporalSamples)
        : DEFAULT_SETTINGS.temporalSamples,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function loadLocalUniverse() {
  try {
    const text = localStorage.getItem("gravity-well-universe");
    return text ? UniverseJournal.parse(text) : new UniverseJournal();
  } catch (error) {
    console.warn("The local universe journal could not be restored; beginning from the default universe.", error);
    return new UniverseJournal();
  }
}

function persistLocalUniverse() {
  window.clearTimeout(universePersistTimer);
  universePersistTimer = window.setTimeout(() => {
    localStorage.setItem("gravity-well-universe", journal.serialize());
  }, 120);
}

function commitUniverse(command: UniverseCommand) {
  const event = journal.commit(command);
  persistLocalUniverse();
  return event;
}

window.addEventListener("beforeunload", () => {
  window.clearTimeout(universePersistTimer);
  localStorage.setItem("gravity-well-universe", journal.serialize());
});


function saveSettings() {
  localStorage.setItem("gravity-well-settings", JSON.stringify(settings));
}


function finiteInteger(value: unknown, fallback: number) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? number : fallback;
}


function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}


function mixVector(from: Vec2, to: Vec2, amount: number): Vec2 {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}


function clampVector(vector: Vec2, maxLength: number): Vec2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= maxLength || length === 0) return vector;
  const scale = maxLength / length;
  return { x: vector.x * scale, y: vector.y * scale };
}


class LiveGravityWell {
  readonly renderer: GravityRenderer;
  readonly limits: RendererLimits;
  width = settings.sceneWidth;
  height = settings.sceneHeight;

  private currentPointer: Vec2 = { x: 0.5, y: 0.5 };
  private targetPointer: Vec2 = { x: 0.5, y: 0.5 };
  private motion: Vec2 = { x: 0, y: 0 };
  private targetMotion: Vec2 = { x: 0, y: 0 };
  private strength = 1;
  private targetStrength = 1;
  private lastPointerEvent: { x: number; y: number; time: number } | null = null;
  private frameId = 0;
  private lastFrame = performance.now();
  private readonly startedAt = this.lastFrame;
  private observerMode = false;
  private draggingObserver: { clientX: number; clientY: number; observer: ObserverState } | null = null;
  private recordingStarted = 0;
  private recordedPath: PathPoint[] = [];
  private playingStarted = 0;
  private playing = false;

  constructor() {
    this.renderer = new GravityRenderer(canvas);
    this.limits = this.renderer.limits;
    window.addEventListener("resize", () => this.fitDisplay());
    window.addEventListener("pointermove", (event) => this.onPointerMove(event), { passive: true });
    window.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    window.addEventListener("pointerup", () => this.onPointerUp());
    window.addEventListener("pointerleave", () => this.onPointerLeave(), { passive: true });
    canvas.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
    this.setResolution(this.width, this.height);
  }

  setResolution(width: number, height: number) {
    const nextWidth = Math.round(width);
    const nextHeight = Math.round(height);
    if (nextWidth < 320 || nextHeight < 180) throw new Error("The live scene must be at least 320 × 180.");
    if (nextWidth > this.limits.maxViewportWidth || nextHeight > this.limits.maxViewportHeight) {
      throw new Error(
        `This GPU exposes a maximum live viewport of ${this.limits.maxViewportWidth} × ${this.limits.maxViewportHeight}.`,
      );
    }
    this.width = nextWidth;
    this.height = nextHeight;
    // v0.3 evaluates a continuous field; there is no source texture to resize.
    this.fitDisplay();
    this.renderNow();
  }

  fitDisplay() {
    const scale = Math.min(window.innerWidth / this.width, window.innerHeight / this.height);
    canvas.style.width = `${Math.max(1, Math.floor(this.width * scale))}px`;
    canvas.style.height = `${Math.max(1, Math.floor(this.height * scale))}px`;
  }

  snapshot() {
    return {
      pointer: { ...this.currentPointer },
      motion: { ...this.motion },
      strength: this.strength,
      time: (performance.now() - this.startedAt) / 1000,
      observer: structuredClone(journal.state.observer),
      radiance: structuredClone(journal.state.radiance),
      seed: journal.state.scene.seed,
      path: structuredClone(journal.state.timeline.path),
      duration: journal.state.timeline.duration,
    };
  }

  universeSnapshot(): UniverseState {
    const next = structuredClone(journal.state);
    const snapshot = this.snapshot();
    next.well = {
      pointer: snapshot.pointer,
      motion: snapshot.motion,
      strength: snapshot.strength,
    };
    next.scene.time = snapshot.time;
    next.timeline.playhead = this.playing && next.timeline.duration > 0
      ? ((performance.now() - this.playingStarted) / 1000) % next.timeline.duration
      : next.timeline.playhead;
    return next;
  }

  setObserverMode(enabled: boolean) {
    this.observerMode = enabled;
    interactionMode.value = enabled ? "observe" : "gravity";
    document.body.classList.toggle("observer-mode", enabled);
    this.draggingObserver = null;
    syncUniverseControls();
  }

  toggleObserverMode() {
    this.setObserverMode(!this.observerMode);
  }

  resetObserver() {
    commitUniverse({ kind: "observer.set", observer: { center: { x: 0.5, y: 0.5 }, zoom: 1 } });
    syncUniverseControls();
    this.renderNow();
  }

  isRecording() {
    return this.recordingStarted > 0;
  }

  isPlaying() {
    return this.playing;
  }

  toggleRecording() {
    if (this.isRecording()) this.stopRecording();
    else this.startRecording();
  }

  startRecording() {
    this.playing = false;
    this.recordingStarted = performance.now();
    this.recordedPath = [{ t: 0, pointer: { ...this.currentPointer }, strength: this.strength }];
    syncTimelineControls();
    this.requestFrame();
  }

  stopRecording() {
    if (!this.isRecording()) return;
    const duration = Math.max(0.001, (performance.now() - this.recordingStarted) / 1000);
    this.recordedPath.push({ t: duration, pointer: { ...this.currentPointer }, strength: this.strength });
    this.recordingStarted = 0;
    const path = normalizePath(this.recordedPath);
    commitUniverse({ kind: "timeline.path", path, duration });
    this.recordedPath = [];
    syncTimelineControls();
  }

  togglePlayback() {
    if (this.playing) {
      this.playing = false;
    } else if (journal.state.timeline.path.length > 1 && journal.state.timeline.duration > 0) {
      this.playing = true;
      this.recordingStarted = 0;
      this.playingStarted = performance.now();
      this.requestFrame();
    }
    syncTimelineControls();
  }

  clearPath() {
    this.playing = false;
    this.recordingStarted = 0;
    commitUniverse({ kind: "timeline.path", path: [], duration: 0 });
    syncTimelineControls();
  }

  refresh() {
    this.renderNow();
    syncHud();
  }

  applyUniverseState() {
    const well = journal.state.well;
    this.currentPointer = { ...well.pointer };
    this.targetPointer = { ...well.pointer };
    this.motion = { ...well.motion };
    this.targetMotion = { ...well.motion };
    this.strength = well.strength;
    this.targetStrength = well.strength;
    this.playing = false;
    this.recordingStarted = 0;
    this.refresh();
  }

  private screenPoint(event: PointerEvent | WheelEvent): Vec2 {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / Math.max(1, bounds.width),
      y: 1 - (event.clientY - bounds.top) / Math.max(1, bounds.height),
    };
  }

  private onPointerMove(event: PointerEvent) {
    if (menuOpen) return;
    if (this.observerMode) {
      if (this.draggingObserver) {
        const bounds = canvas.getBoundingClientRect();
        const dx = (event.clientX - this.draggingObserver.clientX) / Math.max(1, bounds.height);
        const dy = (event.clientY - this.draggingObserver.clientY) / Math.max(1, bounds.height);
        const zoom = this.draggingObserver.observer.zoom;
        commitUniverse({
          kind: "observer.set",
          observer: {
            center: {
              x: this.draggingObserver.observer.center.x - dx / zoom,
              y: this.draggingObserver.observer.center.y + dy / zoom,
            },
            zoom,
          },
        });
        syncUniverseControls();
        this.renderNow();
      }
      return;
    }
    const next = this.screenPoint(event);
    const inside = next.x >= 0 && next.x <= 1 && next.y >= 0 && next.y <= 1;
    const now = performance.now();
    this.targetPointer = next;
    this.targetStrength = inside ? 1 : 0;
    if (inside && this.lastPointerEvent) {
      const elapsed = Math.max(8, now - this.lastPointerEvent.time);
      const scale = 16.67 / elapsed;
      this.targetMotion = clampVector({
        x: (next.x - this.lastPointerEvent.x) * 18 * scale,
        y: (next.y - this.lastPointerEvent.y) * 18 * scale,
      }, 1);
    }
    this.lastPointerEvent = inside ? { ...next, time: now } : null;
    if (inside && this.isRecording()) {
      const t = (now - this.recordingStarted) / 1000;
      const previous = this.recordedPath[this.recordedPath.length - 1];
      if (!previous || t - previous.t >= 1 / 60 || Math.hypot(next.x - previous.pointer.x, next.y - previous.pointer.y) > 0.002) {
        this.recordedPath.push({ t, pointer: { ...next }, strength: 1 });
      }
    }
    this.requestFrame();
  }

  private onPointerDown(event: PointerEvent) {
    if (menuOpen || !this.observerMode || event.button !== 0) return;
    this.draggingObserver = {
      clientX: event.clientX,
      clientY: event.clientY,
      observer: structuredClone(journal.state.observer),
    };
    canvas.setPointerCapture?.(event.pointerId);
  }

  private onPointerUp() {
    this.draggingObserver = null;
  }

  private onWheel(event: WheelEvent) {
    if (menuOpen || !this.observerMode) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0012);
    const observer = zoomObserverAt(journal.state.observer, this.screenPoint(event), factor, this.width / this.height);
    commitUniverse({ kind: "observer.set", observer });
    syncUniverseControls();
    this.renderNow();
  }

  private onPointerLeave() {
    if (menuOpen) return;
    if (this.observerMode) {
      this.draggingObserver = null;
      return;
    }
    this.targetStrength = 0;
    this.lastPointerEvent = null;
    this.targetMotion = { x: 0, y: 0 };
    this.requestFrame();
  }

  private requestFrame() {
    if (!this.frameId) {
      this.lastFrame = performance.now();
      this.frameId = requestAnimationFrame((now) => this.render(now));
    }
  }

  private render(now: number) {
    this.frameId = 0;
    const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    const pointerBlend = 1 - Math.exp(-deltaSeconds * 15);
    const motionBlend = 1 - Math.exp(-deltaSeconds * 11);
    const strengthBlend = 1 - Math.exp(-deltaSeconds * 9);
    if (this.playing && journal.state.timeline.duration > 0) {
      const playhead = ((now - this.playingStarted) / 1000) % journal.state.timeline.duration;
      const point = samplePath(journal.state.timeline.path, playhead);
      if (point) {
        const previous = this.currentPointer;
        this.currentPointer = { ...point.pointer };
        this.targetPointer = { ...point.pointer };
        this.motion = clampVector({ x: (point.pointer.x - previous.x) * 18, y: (point.pointer.y - previous.y) * 18 }, 1);
        this.strength = point.strength;
        journal.state.timeline.playhead = playhead;
      }
    } else {
      this.currentPointer = mixVector(this.currentPointer, this.targetPointer, pointerBlend);
    }
    this.motion = mixVector(this.motion, this.targetMotion, motionBlend);
    this.targetMotion = mixVector(this.targetMotion, { x: 0, y: 0 }, motionBlend);
    this.strength += (this.targetStrength - this.strength) * strengthBlend;
    this.renderNow();

    const unsettled =
      Math.abs(this.strength - this.targetStrength) > 0.0025 ||
      Math.abs(this.motion.x) + Math.abs(this.motion.y) > 0.003 ||
      Math.abs(this.currentPointer.x - this.targetPointer.x) +
        Math.abs(this.currentPointer.y - this.targetPointer.y) > 0.001;
    if (unsettled || this.playing || this.isRecording()) this.requestFrame();
    syncHud();
  }

  private renderNow() {
    this.renderer.render(this.width, this.height, {
      pointer: this.currentPointer,
      motion: this.motion,
      strength: this.strength,
      time: (performance.now() - this.startedAt) / 1000,
      fullWidth: this.width,
      fullHeight: this.height,
      observer: journal.state.observer,
      radiance: journal.state.radiance,
      seed: journal.state.scene.seed,
    });
  }
}


let live!: LiveGravityWell;

function showFatalError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const technical = error instanceof Error ? error.stack ?? error.message : String(error);
  const webglFailure = /webgl|shader|graphics|gpu/i.test(message);
  fatalSummary.textContent = webglFailure
    ? "The application started, but this graphics system could not create the WebGL surface used by the Gravity Well."
    : "The application started, but the instrument could not finish preparing its live field.";
  fatalTechnical.textContent = technical;
  fatalShell.hidden = false;
  document.body.classList.add("fatal-error");
  document.body.classList.remove("menu-closed", "menu-open");
  fatalQuit.addEventListener("click", () => window.gravityAPI.quit(), { once: true });
}

function formatZoom(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(3)}M×`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(3)}k×`;
  return `${value.toFixed(value < 10 ? 3 : value < 100 ? 2 : 1)}×`;
}

function syncHud() {
  const observer = journal.state.observer;
  hudMode.textContent = interactionMode.value === "observe" ? "OBSERVATORY" : live.isRecording() ? "RECORDING" : live.isPlaying() ? "PLAYBACK" : "GRAVITY";
  hudZoom.textContent = formatZoom(observer.zoom);
  hudCoordinate.textContent = `${observer.center.x.toFixed(6)}, ${observer.center.y.toFixed(6)}`;
}

function renderBookmarks() {
  bookmarkList.replaceChildren();
  for (const bookmark of journal.state.bookmarks) {
    const row = document.createElement("div");
    row.className = "bookmark-item";
    const name = document.createElement("strong");
    name.textContent = bookmark.name;
    const detail = document.createElement("small");
    detail.textContent = `${formatZoom(bookmark.observer.zoom)} · ${bookmark.observer.center.x.toFixed(4)}, ${bookmark.observer.center.y.toFixed(4)}`;
    const open = document.createElement("button");
    open.type = "button";
    open.className = "button ghost";
    open.textContent = "Go";
    open.addEventListener("click", () => {
      commitUniverse({ kind: "observer.set", observer: bookmark.observer });
      syncUniverseControls();
      live.setObserverMode(true);
      setMenu(false);
    });
    row.append(name, detail, open);
    bookmarkList.append(row);
  }
}

function syncUniverseControls() {
  const { observer, radiance } = journal.state;
  observerZoom.textContent = formatZoom(observer.zoom);
  observerCenter.textContent = `center ${observer.center.x.toFixed(6)}, ${observer.center.y.toFixed(6)}`;
  exposureInput.value = String(radiance.exposure);
  exposureValue.textContent = `${radiance.exposure >= 0 ? "+" : ""}${radiance.exposure.toFixed(1)} EV`;
  spectralInput.value = String(radiance.spectral);
  spectralValue.textContent = `${radiance.spectral.toFixed(2)}×`;
  toneMap.value = radiance.toneMap;
  renderBookmarks();
  syncHud();
}

function syncTimelineControls() {
  const path = journal.state.timeline.path;
  const duration = journal.state.timeline.duration;
  if (live.isRecording()) {
    timelineState.textContent = "Recording a live gravity path";
    timelineDetail.textContent = "Move through the field; press R again when the gesture is complete.";
    recordPathButton.textContent = "Finish recording";
  } else if (live.isPlaying()) {
    timelineState.textContent = "Playing the recorded path";
    timelineDetail.textContent = `${path.length.toLocaleString()} samples over ${duration.toFixed(2)} seconds.`;
    recordPathButton.textContent = "Record new path";
  } else if (path.length > 1) {
    timelineState.textContent = "Path ready";
    timelineDetail.textContent = `${path.length.toLocaleString()} samples · ${duration.toFixed(2)} seconds · available to long exposure.`;
    recordPathButton.textContent = "Record new path";
  } else {
    timelineState.textContent = "No path recorded";
    timelineDetail.textContent = "Press R in the scene to begin.";
    recordPathButton.textContent = "Record path";
  }
  playPathButton.disabled = path.length < 2 || live.isRecording();
  playPathButton.textContent = live.isPlaying() ? "Stop" : "Play";
  clearPathButton.disabled = path.length < 2 && !live.isRecording();
  syncHud();
}


function syncSceneInputs() {
  const key = `${settings.sceneWidth}x${settings.sceneHeight}`;
  scenePreset.value = SCENE_PRESETS.has(key) ? key : "custom";
  sceneWidthInput.value = String(settings.sceneWidth);
  sceneHeightInput.value = String(settings.sceneHeight);
  sceneCustom.hidden = scenePreset.value !== "custom";
  sceneNote.textContent =
    `GPU live limit: ${live.limits.maxViewportWidth.toLocaleString()} × ` +
    `${live.limits.maxViewportHeight.toLocaleString()}. The scene is fit to the window without cropping.`;
}


function syncCaptureInputs() {
  const knownScales = new Set([0.5, 1, 2, 4, 8, 16]);
  captureScaleSelect.value = knownScales.has(settings.captureScale)
    ? String(settings.captureScale)
    : "custom";
  captureScaleCustom.value = String(settings.captureScale);
  scaleCustomRow.hidden = captureScaleSelect.value !== "custom";
  captureFormat.value = settings.captureFormat;
  captureQuality.value = String(settings.captureQuality);
  qualityRow.hidden = settings.captureFormat === "png";
  includeCursor.checked = settings.includeCursor;
  temporalSamples.value = String(settings.temporalSamples);
  updateCaptureReadout();
}


function currentCaptureScale() {
  return captureScaleSelect.value === "custom"
    ? Math.max(0.1, Math.min(16, finiteNumber(captureScaleCustom.value, 1)))
    : finiteNumber(captureScaleSelect.value, 1);
}


function targetCaptureDimensions(scale = currentCaptureScale()) {
  return {
    width: Math.max(16, Math.round(settings.sceneWidth * scale)),
    height: Math.max(16, Math.round(settings.sceneHeight * scale)),
    scale,
  };
}


function formatPixelCount(pixels: number) {
  if (pixels >= 1_000_000_000) return `${(pixels / 1_000_000_000).toFixed(3)} gigapixels`;
  if (pixels >= 1_000_000) return `${(pixels / 1_000_000).toFixed(1)} megapixels`;
  return `${pixels.toLocaleString()} pixels`;
}


function updateCaptureReadout() {
  const target = targetCaptureDimensions();
  const pixels = target.width * target.height;
  const extremeNeedsPng = pixels > 240_000_000 && settings.captureFormat !== "png";
  const webpOverflow = settings.captureFormat === "webp" &&
    (target.width > 16_383 || target.height > 16_383);
  captureDimensions.textContent = `${target.width.toLocaleString()} × ${target.height.toLocaleString()}`;
  capturePixels.textContent = formatPixelCount(pixels);
  captureNowButton.disabled = Boolean(activeCapture) ||
    target.width > appInfo.maxCaptureDimension ||
    target.height > appInfo.maxCaptureDimension ||
    pixels > appInfo.maxCapturePixels ||
    extremeNeedsPng ||
    webpOverflow;

  if (target.width > appInfo.maxCaptureDimension || target.height > appInfo.maxCaptureDimension) {
    captureNote.textContent = `One side exceeds the ${appInfo.maxCaptureDimension.toLocaleString()} pixel ceiling.`;
  } else if (pixels > appInfo.maxCapturePixels) {
    captureNote.textContent = "This exceeds the 2.147 gigapixel safety ceiling.";
  } else if (webpOverflow) {
    captureNote.textContent = "WebP stops at 16,383 pixels per side. Choose PNG for this output.";
  } else if (extremeNeedsPng) {
    captureNote.textContent = "Extreme captures above 240 megapixels use the streaming PNG assembler.";
  } else if (pixels > 1_000_000_000) {
    captureNote.textContent = "Extremely huge. Expect hundreds of tiles, a long encode, and a very large file.";
  } else if (pixels > 250_000_000) {
    captureNote.textContent = "Absurd mode. The scene stays playable; the exporter may work for quite a while.";
  } else {
    const temporal = settings.temporalSamples > 1 && journal.state.timeline.path.length > 1
      ? ` ${settings.temporalSamples} temporal samples will integrate the recorded path.`
      : "";
    captureNote.textContent = `Spacebar renders exactly this output with no menu, toast, or window chrome.${temporal}`;
  }
}


function setMenu(open: boolean) {
  menuOpen = open;
  menu.dataset.open = String(open);
  menu.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("menu-open", open);
  document.body.classList.toggle("menu-closed", !open);
  if (open) windowMode.focus();
}


function setStatus(message: string, progress = 0, autoHide = false) {
  window.clearTimeout(successToastTimer);
  statusToast.hidden = false;
  statusText.textContent = message;
  statusProgress.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  if (autoHide) {
    successToastTimer = window.setTimeout(() => {
      statusToast.hidden = true;
    }, 9000);
  }
}


function setCaptureBusy(busy: boolean) {
  captureNowButton.disabled = busy;
  cancelCaptureButton.hidden = !busy;
  windowMode.disabled = busy;
  applySceneButton.disabled = busy;
  scenePreset.disabled = busy;
  sceneWidthInput.disabled = busy;
  sceneHeightInput.disabled = busy;
}


async function captureScene(overrides: CaptureOverrides = {}) {
  if (activeCapture) throw new Error("A capture is already running.");
  const target = overrides.width && overrides.height
    ? { width: overrides.width, height: overrides.height, scale: overrides.scale ?? 1 }
    : targetCaptureDimensions(overrides.scale ?? currentCaptureScale());
  const width = Math.round(target.width);
  const height = Math.round(target.height);
  const scale = target.scale;
  const format = overrides.format ?? settings.captureFormat;
  const quality = overrides.quality ?? settings.captureQuality;
  const includeCursorValue = overrides.includeCursor ?? settings.includeCursor;
  const requestedTemporalSamples = Math.max(
    1,
    Math.min(32, finiteInteger(overrides.temporalSamples, settings.temporalSamples)),
  );
  const tileSize = Math.max(
    256,
    Math.min(
      Math.round(overrides.tileSize ?? 2048),
      live.limits.maxViewportWidth,
      live.limits.maxViewportHeight,
    ),
  );
  const tileHeight = Math.max(
    128,
    Math.min(
      Math.round(
        overrides.tileHeight ?? (
          format === "png" && width * height > 240_000_000 ? Math.min(512, tileSize) : tileSize
        ),
      ),
      live.limits.maxViewportHeight,
    ),
  );
  const expectedTiles = Math.ceil(width / tileSize) * Math.ceil(height / tileHeight);
  const liveSnapshot = live.snapshot();
  const snapshot = {
    pointer: overrides.pointer ?? liveSnapshot.pointer,
    motion: overrides.motion ?? liveSnapshot.motion,
    strength: overrides.strength ?? liveSnapshot.strength,
    time: overrides.time ?? liveSnapshot.time,
    observer: overrides.observer ?? liveSnapshot.observer,
    radiance: overrides.radiance ?? liveSnapshot.radiance,
    seed: overrides.seed ?? liveSnapshot.seed,
    path: overrides.path ?? liveSnapshot.path,
    duration: overrides.duration ?? liveSnapshot.duration,
  };
  const temporalSampleCount = snapshot.path.length > 1 ? requestedTemporalSamples : 1;
  const exposureUniverse = live.universeSnapshot();
  exposureUniverse.scene.seed = snapshot.seed;
  exposureUniverse.scene.time = snapshot.time;
  exposureUniverse.observer = structuredClone(snapshot.observer);
  exposureUniverse.well.pointer = structuredClone(snapshot.pointer);
  exposureUniverse.well.motion = structuredClone(snapshot.motion);
  exposureUniverse.well.strength = snapshot.strength;
  exposureUniverse.radiance = structuredClone(snapshot.radiance);
  exposureUniverse.timeline.path = structuredClone(snapshot.path);
  exposureUniverse.timeline.duration = snapshot.duration;
  const recipe = makeExposureRecipe(exposureUniverse, {
    width,
    height,
    format,
    quality,
    includeCursor: includeCursorValue,
    temporalSamples: temporalSampleCount,
  });
  const job = await window.gravityAPI.beginCapture({
    width,
    height,
    format,
    quality,
    expectedTiles,
  });
  const worker = new Worker(new URL("./export-worker.ts", import.meta.url), { type: "module" });
  setCaptureBusy(true);
  setStatus(`Preparing ${width.toLocaleString()} × ${height.toLocaleString()} capture…`, 0);

  return new Promise<{ finalPath: string; recipePath?: string; captureDirectory: string }>((resolve, reject) => {
    activeCapture = {
      jobId: job.jobId,
      worker,
      reject,
      pointer: snapshot.pointer,
      scale,
      format,
      quality,
      includeCursor: includeCursorValue,
      temporalSamples: temporalSampleCount,
    };

    const fail = async (error: Error) => {
      if (activeCapture?.jobId !== job.jobId) return;
      worker.terminate();
      activeCapture = null;
      setCaptureBusy(false);
      await window.gravityAPI.cancelCapture(job.jobId).catch(() => false);
      setStatus(`Capture failed: ${error.message}`, 0, true);
      updateCaptureReadout();
      reject(error);
    };

    worker.onerror = (event) => {
      void fail(new Error(event.message || "The export worker stopped unexpectedly."));
    };

    worker.onmessage = async (event) => {
      const message = event.data;
      if (message.jobId !== job.jobId || activeCapture?.jobId !== job.jobId) return;
      try {
        if (message.type === "started") {
          setStatus(
            `Rendering ${message.total} tiles from the continuous universe` +
              `${temporalSampleCount > 1 ? ` across ${temporalSampleCount} moments` : ""}...`,
            0,
          );
          return;
        }
        if (message.type === "tile") {
          await window.gravityAPI.writeCaptureTile({
            jobId: job.jobId,
            index: message.index,
            x: message.x,
            y: message.y,
            width: message.width,
            height: message.height,
            bytes: message.bytes,
          });
          worker.postMessage({ type: "tile-ack", jobId: job.jobId, index: message.index });
          setStatus(
            `Rendered tile ${message.completed.toLocaleString()} of ${message.total.toLocaleString()}…`,
            message.completed / message.total,
          );
          return;
        }
        if (message.type === "render-complete") {
          setStatus("All tiles rendered. Encoding the final image…", 1);
          const result = await window.gravityAPI.finishCapture({
            jobId: job.jobId,
            includeCursor: includeCursorValue,
            pointerX: snapshot.pointer.x,
            pointerY: 1 - snapshot.pointer.y,
            captureScale: scale,
            recipe,
          });
          worker.terminate();
          activeCapture = null;
          setCaptureBusy(false);
          updateCaptureReadout();
          setStatus(`Capture finished: ${result.finalPath}`, 1, true);
          resolve(result);
          return;
        }
        if (message.type === "cancelled") {
          await fail(new Error("Capture cancelled."));
          return;
        }
        if (message.type === "error") {
          await fail(new Error(message.message));
        }
      } catch (error) {
        await fail(error instanceof Error ? error : new Error(String(error)));
      }
    };

    worker.postMessage({
      type: "start",
      jobId: job.jobId,
      width,
      height,
      tileWidth: tileSize,
      tileHeight,
      sourceLongEdge: Math.min(8192, Math.max(width, height)),
      pointer: snapshot.pointer,
      motion: snapshot.motion,
      strength: snapshot.strength,
      time: snapshot.time,
      observer: snapshot.observer,
      radiance: snapshot.radiance,
      seed: snapshot.seed,
      path: snapshot.path,
      duration: snapshot.duration,
      temporalSamples: temporalSampleCount,
    });
  });
}


async function cancelActiveCapture() {
  const capture = activeCapture;
  if (!capture) return;
  capture.worker.postMessage({ type: "cancel", jobId: capture.jobId });
  capture.worker.terminate();
  activeCapture = null;
  await window.gravityAPI.cancelCapture(capture.jobId);
  setCaptureBusy(false);
  updateCaptureReadout();
  setStatus("Capture cancelled.", 0, true);
  capture.reject(new Error("Capture cancelled."));
}


function applySceneResolution() {
  const selected = scenePreset.value;
  let width: number;
  let height: number;
  if (selected === "custom") {
    width = finiteInteger(sceneWidthInput.value, settings.sceneWidth);
    height = finiteInteger(sceneHeightInput.value, settings.sceneHeight);
  } else {
    [width, height] = selected.split("x").map(Number) as [number, number];
  }
  try {
    live.setResolution(width, height);
    settings.sceneWidth = width;
    settings.sceneHeight = height;
    saveSettings();
    syncSceneInputs();
    updateCaptureReadout();
    setStatus(`Live scene set to ${width.toLocaleString()} × ${height.toLocaleString()}.`, 1, true);
  } catch (error) {
    sceneNote.textContent = error instanceof Error ? error.message : String(error);
  }
}


function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}


async function initialize() {
  appInfo = await window.gravityAPI.getAppInfo();
  if (appInfo.forceRendererFailure) throw new Error("WebGL is unavailable on this system (forced smoke-test failure)." );
  live = new LiveGravityWell();
  windowMode.value = appInfo.windowMode;
  captureDirectory.textContent = appInfo.captureDirectory;
  syncSceneInputs();
  syncCaptureInputs();
  syncUniverseControls();
  syncTimelineControls();

  windowMode.addEventListener("change", () => {
    if (activeCapture) return;
    window.gravityAPI.setWindowMode(windowMode.value as WindowMode);
  });
  scenePreset.addEventListener("change", () => {
    sceneCustom.hidden = scenePreset.value !== "custom";
    if (scenePreset.value !== "custom") {
      const [width, height] = scenePreset.value.split("x");
      sceneWidthInput.value = width;
      sceneHeightInput.value = height;
    }
  });
  applySceneButton.addEventListener("click", applySceneResolution);

  captureScaleSelect.addEventListener("change", () => {
    scaleCustomRow.hidden = captureScaleSelect.value !== "custom";
    if (captureScaleSelect.value !== "custom") {
      settings.captureScale = finiteNumber(captureScaleSelect.value, 1);
      captureScaleCustom.value = captureScaleSelect.value;
      saveSettings();
    }
    updateCaptureReadout();
  });
  captureScaleCustom.addEventListener("input", () => {
    settings.captureScale = currentCaptureScale();
    saveSettings();
    updateCaptureReadout();
  });
  captureFormat.addEventListener("change", () => {
    settings.captureFormat = captureFormat.value as Settings["captureFormat"];
    qualityRow.hidden = settings.captureFormat === "png";
    saveSettings();
  });
  captureQuality.addEventListener("change", () => {
    settings.captureQuality = Math.max(1, Math.min(100, finiteInteger(captureQuality.value, 94)));
    captureQuality.value = String(settings.captureQuality);
    saveSettings();
  });
  includeCursor.addEventListener("change", () => {
    settings.includeCursor = includeCursor.checked;
    saveSettings();
  });
  temporalSamples.addEventListener("change", () => {
    settings.temporalSamples = finiteInteger(temporalSamples.value, 1);
    saveSettings();
    updateCaptureReadout();
  });
  interactionMode.addEventListener("change", () => {
    live.setObserverMode(interactionMode.value === "observe");
  });
  observerHome.addEventListener("click", () => live.resetObserver());
  addBookmark.addEventListener("click", () => {
    const index = journal.state.bookmarks.length + 1;
    commitUniverse({
      kind: "bookmark.add",
      bookmark: {
        handle: `aperture_${Date.now().toString(36)}`,
        name: `Aperture ${String(index).padStart(2, "0")}`,
        observer: structuredClone(journal.state.observer),
        createdAt: new Date().toISOString(),
      },
    });
    syncUniverseControls();
  });
  exposureInput.addEventListener("input", () => {
    commitUniverse({ kind: "radiance.set", radiance: { exposure: finiteNumber(exposureInput.value, 0) } });
    syncUniverseControls();
    live.refresh();
  });
  spectralInput.addEventListener("input", () => {
    commitUniverse({ kind: "radiance.set", radiance: { spectral: finiteNumber(spectralInput.value, 1) } });
    syncUniverseControls();
    live.refresh();
  });
  toneMap.addEventListener("change", () => {
    commitUniverse({ kind: "radiance.set", radiance: { toneMap: toneMap.value as UniverseState["radiance"]["toneMap"] } });
    syncUniverseControls();
    live.refresh();
  });
  recordPathButton.addEventListener("click", () => live.toggleRecording());
  playPathButton.addEventListener("click", () => live.togglePlayback());
  clearPathButton.addEventListener("click", () => live.clearPath());
  saveUniverseButton.addEventListener("click", async () => {
    try {
      const record = JSON.parse(journal.serialize());
      const result = await window.gravityAPI.saveUniverse(record);
      journalStatus.textContent = `Saved explicitly: ${result.path}`;
    } catch (error) {
      journalStatus.textContent = `Save failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  });
  loadUniverseButton.addEventListener("click", async () => {
    try {
      const result = await window.gravityAPI.loadUniverse();
      if (!result.record) {
        journalStatus.textContent = `No explicit universe has been saved yet. Expected: ${result.path}`;
        return;
      }
      journal = UniverseJournal.parse(JSON.stringify(result.record));
      persistLocalUniverse();
      syncUniverseControls();
      syncTimelineControls();
      live.applyUniverseState();
      journalStatus.textContent = `Reloaded: ${result.path}`;
    } catch (error) {
      journalStatus.textContent = `Reload failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  });
  loadRecipeButton.addEventListener("click", async () => {
    try {
      const result = await window.gravityAPI.chooseRecipe();
      if (!result) return;
      const candidate = result.recipe as unknown as ExposureRecipe;
      if (candidate.schema !== "gwenithic-gravity-exposure/0.3" || candidate.universe?.schema !== "gwenithic-gravity-universe/0.3") {
        throw new Error("The selected recipe does not contain a supported universe state.");
      }
      const sourceRenderer = String((candidate as { renderer?: unknown }).renderer ?? "unknown renderer");
      const sourceUniverseRenderer = String((candidate.universe as { renderer?: unknown }).renderer ?? "unknown renderer");
      const exactRenderer = sourceRenderer === RENDERER_VERSION && sourceUniverseRenderer === RENDERER_VERSION;
      loadedRecipe = {
        ...candidate,
        universe: normalizeUniverseState(candidate.universe),
      };
      journal = new UniverseJournal(structuredClone(loadedRecipe.universe));
      persistLocalUniverse();
      syncUniverseControls();
      syncTimelineControls();
      live.applyUniverseState();
      renderRecipeButton.disabled = !exactRenderer;
      journalStatus.textContent = exactRenderer
        ? `Loaded exposure: ${result.path}`
        : `Loaded observer state from ${sourceRenderer}. Exact replay is disabled because this body uses ${RENDERER_VERSION}; make a new capture to record the new interpretation.`;
    } catch (error) {
      loadedRecipe = null;
      renderRecipeButton.disabled = true;
      journalStatus.textContent = `Recipe load failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  });
  renderRecipeButton.addEventListener("click", () => {
    if (!loadedRecipe) return;
    const { universe, output } = loadedRecipe;
    void captureScene({
      width: output.width,
      height: output.height,
      scale: 1,
      format: output.format,
      quality: output.quality,
      includeCursor: output.includeCursor,
      temporalSamples: output.temporalSamples,
      pointer: universe.well.pointer,
      motion: universe.well.motion,
      strength: universe.well.strength,
      time: universe.scene.time,
      observer: universe.observer,
      radiance: universe.radiance,
      seed: universe.scene.seed,
      path: universe.timeline.path,
      duration: universe.timeline.duration,
    }).catch(() => {});
  });
  captureNowButton.addEventListener("click", () => {
    void captureScene().catch(() => {});
  });
  cancelCaptureButton.addEventListener("click", () => {
    void cancelActiveCapture();
  });
  openCapturesButton.addEventListener("click", () => {
    void window.gravityAPI.openCaptureFolder();
  });
  quitButton.addEventListener("click", () => window.gravityAPI.quit());
  menu.querySelectorAll<HTMLElement>("[data-close-menu]").forEach((element) => {
    element.addEventListener("click", () => setMenu(false));
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setMenu(!menuOpen);
      return;
    }
    if (menuOpen || isTypingTarget(event.target)) return;
    if (event.key.toLowerCase() === "o") {
      event.preventDefault();
      live.toggleObserverMode();
      return;
    }
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      live.toggleRecording();
      return;
    }
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      live.togglePlayback();
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      live.resetObserver();
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      if (!activeCapture) void captureScene().catch(() => {});
    }
  });

  window.__gravityTest = {
    compileRegimes() {
      return live.renderer.compileScaleRegimesForTest();
    },
    async run(withCapture: boolean | "large" | "huge" | "empty" | "calligraphy" | "zoom" | "far" | "ultra" | "deep") {
      const base = {
        ok: true,
        renderer: "webgl",
        scene: `${live.width}x${live.height}`,
        limits: live.limits,
      };
      if (!withCapture) return base;
      const large = withCapture === "large";
      const huge = withCapture === "huge";
      const empty = withCapture === "empty";
      const calligraphy = withCapture === "calligraphy";
      const zoom = withCapture === "zoom";
      const far = withCapture === "far";
      const ultra = withCapture === "ultra";
      const deep = withCapture === "deep";
      const result = await captureScene({
        width: huge ? 30_720 : large || far || ultra || deep ? 2560 : 640,
        height: huge ? 17_280 : large || far || ultra || deep ? 1440 : 360,
        scale: huge ? 2 : 1,
        format: "png",
        quality: 90,
        includeCursor: !empty,
        tileSize: huge ? 2048 : large || far || ultra || deep ? 1024 : 2048,
        tileHeight: huge || large || far || ultra || deep ? 512 : 2048,
        pointer: empty ? { x: 0.12, y: 0.12 } : { x: 0.5, y: 0.5 },
        motion: empty ? { x: 0.3, y: -0.12 } : { x: 0, y: 0 },
        strength: 1,
        time: 1.25,
        temporalSamples: calligraphy ? 8 : 1,
        duration: calligraphy ? 1 : 0,
        path: calligraphy ? [
          { t: 0, pointer: { x: 0.25, y: 0.35 }, strength: 1 },
          { t: 0.5, pointer: { x: 0.52, y: 0.68 }, strength: 1 },
          { t: 1, pointer: { x: 0.78, y: 0.42 }, strength: 1 },
        ] : [],
        observer: zoom
          ? { center: { x: 0.786, y: 0.558 }, zoom: 96 }
          : far
            ? { center: { x: 0.5, y: 0.5 }, zoom: 0.18 }
            : ultra
              ? { center: { x: 0.5, y: 0.5 }, zoom: 0.03125 }
              : deep
                ? { center: { x: 0.5, y: 0.5 }, zoom: 384 }
                : { center: { x: 0.5, y: 0.5 }, zoom: 1 },
      });
      return { ...base, finalPath: result.finalPath, recipePath: result.recipePath };
    },
    async replay(rawRecipe: unknown) {
      const candidate = rawRecipe as ExposureRecipe;
      if (candidate?.schema !== "gwenithic-gravity-exposure/0.3" || candidate.universe?.schema !== "gwenithic-gravity-universe/0.3") {
        throw new Error("The smoke replay did not receive a supported Gravity Well exposure recipe.");
      }
      const universe = normalizeUniverseState(candidate.universe);
      journal = new UniverseJournal(structuredClone(universe));
      syncUniverseControls();
      syncTimelineControls();
      live.applyUniverseState();
      return captureScene({
        width: candidate.output.width,
        height: candidate.output.height,
        scale: 1,
        format: candidate.output.format,
        quality: candidate.output.quality,
        includeCursor: candidate.output.includeCursor,
        temporalSamples: candidate.output.temporalSamples,
        pointer: universe.well.pointer,
        motion: universe.well.motion,
        strength: universe.well.strength,
        time: universe.scene.time,
        observer: universe.observer,
        radiance: universe.radiance,
        seed: universe.scene.seed,
        path: universe.timeline.path,
        duration: universe.timeline.duration,
      });
    },
  };

  window.gravityAPI.reportReady({
    renderer: "webgl",
    sceneWidth: live.width,
    sceneHeight: live.height,
    limits: live.limits,
  });
}


void initialize().catch((error) => {
  console.error(error);
  showFatalError(error);
  window.gravityAPI.reportFailure(error instanceof Error ? error.stack ?? error.message : String(error));
});
