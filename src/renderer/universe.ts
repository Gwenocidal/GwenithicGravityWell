import type { Vec2 } from "./engine";

export const UNIVERSE_SCHEMA = "gwenithic-gravity-universe/0.3" as const;
export const RENDERER_VERSION = "continuous-observatory-light-field-0.3.2" as const;

export type ToneMap = "aces" | "reinhard" | "linear";

export type ObserverState = {
  center: Vec2;
  zoom: number;
};

export type RadianceState = {
  exposure: number;
  spectral: number;
  toneMap: ToneMap;
};

export type WellState = {
  pointer: Vec2;
  motion: Vec2;
  strength: number;
};

export type PathPoint = {
  t: number;
  pointer: Vec2;
  strength: number;
};

export type TimelineState = {
  duration: number;
  playhead: number;
  looping: boolean;
  path: PathPoint[];
};

export type ObservatoryBookmark = {
  handle: string;
  name: string;
  observer: ObserverState;
  createdAt: string;
};

export type UniverseState = {
  schema: typeof UNIVERSE_SCHEMA;
  renderer: typeof RENDERER_VERSION;
  scene: {
    handle: string;
    seed: number;
    time: number;
  };
  observer: ObserverState;
  well: WellState;
  radiance: RadianceState;
  timeline: TimelineState;
  bookmarks: ObservatoryBookmark[];
};

export type UniverseCommand =
  | { kind: "observer.set"; observer: ObserverState }
  | { kind: "well.set"; well: Partial<WellState> }
  | { kind: "radiance.set"; radiance: Partial<RadianceState> }
  | { kind: "timeline.set"; timeline: Partial<TimelineState> }
  | { kind: "timeline.path"; path: PathPoint[]; duration: number }
  | { kind: "bookmark.add"; bookmark: ObservatoryBookmark }
  | { kind: "bookmark.remove"; handle: string }
  | { kind: "universe.reset" };

export type JournalEvent = {
  protocol: "gravity-universe-1";
  sequence: number;
  requestId: string;
  actor: string;
  at: string;
  command: UniverseCommand;
};

export type ExposureRecipe = {
  schema: "gwenithic-gravity-exposure/0.3";
  renderer: typeof RENDERER_VERSION;
  createdAt: string;
  universe: UniverseState;
  output: {
    width: number;
    height: number;
    format: "png" | "jpeg" | "webp";
    quality: number;
    includeCursor: boolean;
    temporalSamples: number;
  };
  approximation: {
    projection: "continuous-procedural-webgl";
    precision: "highp-if-available";
    outputEncoding: "srgb-8";
    note: string;
  };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function createUniverseState(): UniverseState {
  return {
    schema: UNIVERSE_SCHEMA,
    renderer: RENDERER_VERSION,
    scene: { handle: "gravity_scene_000001", seed: 0x6c756e61, time: 0 },
    observer: { center: { x: 0.5, y: 0.5 }, zoom: 1 },
    well: { pointer: { x: 0.5, y: 0.5 }, motion: { x: 0, y: 0 }, strength: 1 },
    radiance: { exposure: 0, spectral: 1, toneMap: "aces" },
    timeline: { duration: 0, playhead: 0, looping: false, path: [] },
    bookmarks: [],
  };
}

export function normalizeObserver(value: ObserverState): ObserverState {
  return {
    center: {
      x: clamp(finite(value?.center?.x, 0.5), -1_000_000, 1_000_000),
      y: clamp(finite(value?.center?.y, 0.5), -1_000_000, 1_000_000),
    },
    zoom: clamp(finite(value?.zoom, 1), 0.125, 1_048_576),
  };
}

export function normalizePath(path: PathPoint[]): PathPoint[] {
  const ordered = path
    .map((point) => ({
      t: Math.max(0, finite(point.t, 0)),
      pointer: {
        x: clamp(finite(point.pointer?.x, 0.5), -2, 3),
        y: clamp(finite(point.pointer?.y, 0.5), -2, 3),
      },
      strength: clamp(finite(point.strength, 1), 0, 1),
    }))
    .sort((a, b) => a.t - b.t);
  const result: PathPoint[] = [];
  for (const point of ordered) {
    const previous = result[result.length - 1];
    if (!previous || point.t > previous.t + 0.0001) result.push(point);
    else result[result.length - 1] = point;
  }
  return result.slice(0, 8192);
}

export function normalizeUniverseState(value: Partial<UniverseState> | null | undefined): UniverseState {
  const state = createUniverseState();
  const candidate = value as UniverseState | undefined;
  if (!candidate || candidate.schema !== UNIVERSE_SCHEMA) return state;
  state.scene = {
    handle: typeof candidate.scene?.handle === "string" ? candidate.scene.handle.slice(0, 128) : state.scene.handle,
    seed: Math.round(finite(candidate.scene?.seed, state.scene.seed)),
    time: Math.max(0, finite(candidate.scene?.time, 0)),
  };
  state.observer = normalizeObserver(candidate.observer ?? state.observer);
  state.well = {
    pointer: {
      x: clamp(finite(candidate.well?.pointer?.x, 0.5), -2, 3),
      y: clamp(finite(candidate.well?.pointer?.y, 0.5), -2, 3),
    },
    motion: {
      x: clamp(finite(candidate.well?.motion?.x, 0), -1, 1),
      y: clamp(finite(candidate.well?.motion?.y, 0), -1, 1),
    },
    strength: clamp(finite(candidate.well?.strength, 1), 0, 1),
  };
  state.radiance = reduceUniverse(state, { kind: "radiance.set", radiance: candidate.radiance ?? {} }).radiance;
  state.timeline = {
    duration: Math.max(0, finite(candidate.timeline?.duration, 0)),
    playhead: Math.max(0, finite(candidate.timeline?.playhead, 0)),
    looping: Boolean(candidate.timeline?.looping),
    path: normalizePath(candidate.timeline?.path ?? []),
  };
  state.bookmarks = (candidate.bookmarks ?? []).slice(0, 64).map((bookmark, index) => ({
    handle: typeof bookmark.handle === "string" ? bookmark.handle.slice(0, 128) : `aperture_imported_${index}`,
    name: typeof bookmark.name === "string" ? bookmark.name.slice(0, 128) : `Imported aperture ${index + 1}`,
    observer: normalizeObserver(bookmark.observer),
    createdAt: typeof bookmark.createdAt === "string" ? bookmark.createdAt : new Date(0).toISOString(),
  }));
  return state;
}

export function samplePath(path: PathPoint[], time: number): PathPoint | null {
  if (!path.length) return null;
  if (time <= path[0].t) return structuredClone(path[0]);
  const last = path[path.length - 1];
  if (time >= last.t) return structuredClone(last);
  let low = 0;
  let high = path.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (path[middle].t <= time) low = middle;
    else high = middle;
  }
  const from = path[low];
  const to = path[high];
  const mix = (time - from.t) / Math.max(0.000001, to.t - from.t);
  return {
    t: time,
    pointer: {
      x: from.pointer.x + (to.pointer.x - from.pointer.x) * mix,
      y: from.pointer.y + (to.pointer.y - from.pointer.y) * mix,
    },
    strength: from.strength + (to.strength - from.strength) * mix,
  };
}

export function reduceUniverse(state: UniverseState, command: UniverseCommand): UniverseState {
  if (command.kind === "universe.reset") return createUniverseState();
  const next = structuredClone(state);
  if (command.kind === "observer.set") next.observer = normalizeObserver(command.observer);
  if (command.kind === "well.set") {
    next.well = {
      pointer: command.well.pointer ?? next.well.pointer,
      motion: command.well.motion ?? next.well.motion,
      strength: clamp(finite(command.well.strength, next.well.strength), 0, 1),
    };
  }
  if (command.kind === "radiance.set") {
    next.radiance = {
      exposure: clamp(finite(command.radiance.exposure, next.radiance.exposure), -8, 8),
      spectral: clamp(finite(command.radiance.spectral, next.radiance.spectral), 0, 2.5),
      toneMap: ["aces", "reinhard", "linear"].includes(command.radiance.toneMap ?? "")
        ? command.radiance.toneMap as ToneMap
        : next.radiance.toneMap,
    };
  }
  if (command.kind === "timeline.set") next.timeline = { ...next.timeline, ...command.timeline };
  if (command.kind === "timeline.path") {
    next.timeline.path = normalizePath(command.path);
    next.timeline.duration = Math.max(0, finite(command.duration, 0));
    next.timeline.playhead = 0;
  }
  if (command.kind === "bookmark.add") {
    next.bookmarks = [...next.bookmarks.filter((item) => item.handle !== command.bookmark.handle), {
      ...command.bookmark,
      observer: normalizeObserver(command.bookmark.observer),
    }].slice(-64);
  }
  if (command.kind === "bookmark.remove") {
    next.bookmarks = next.bookmarks.filter((item) => item.handle !== command.handle);
  }
  return next;
}

export class UniverseJournal {
  state: UniverseState;
  events: JournalEvent[];

  constructor(state = createUniverseState(), events: JournalEvent[] = []) {
    this.state = state;
    this.events = events;
  }

  commit(command: UniverseCommand, actor = "gwenithic-local", requestId = crypto.randomUUID()) {
    const duplicate = this.events.find((event) => event.requestId === requestId);
    if (duplicate) return duplicate;
    const event: JournalEvent = {
      protocol: "gravity-universe-1",
      sequence: this.events.length ? this.events[this.events.length - 1].sequence + 1 : 1,
      requestId,
      actor,
      at: new Date().toISOString(),
      command,
    };
    this.state = reduceUniverse(this.state, command);
    this.events.push(event);
    return event;
  }

  serialize() {
    return JSON.stringify({ schema: UNIVERSE_SCHEMA, state: this.state, events: this.events }, null, 2);
  }

  static parse(text: string) {
    const parsed = JSON.parse(text);
    if (parsed?.schema !== UNIVERSE_SCHEMA || parsed?.state?.schema !== UNIVERSE_SCHEMA) {
      throw new Error("This is not a supported Gwenithic Gravity Well universe journal.");
    }
    return new UniverseJournal(normalizeUniverseState(parsed.state), Array.isArray(parsed.events) ? parsed.events : []);
  }
}

export function makeExposureRecipe(
  universe: UniverseState,
  output: ExposureRecipe["output"],
): ExposureRecipe {
  return {
    schema: "gwenithic-gravity-exposure/0.3",
    renderer: RENDERER_VERSION,
    createdAt: new Date().toISOString(),
    universe: structuredClone(universe),
    output,
    approximation: {
      projection: "continuous-procedural-webgl",
      precision: "highp-if-available",
      outputEncoding: "srgb-8",
      note: output.temporalSamples > 1
        ? "The continuous scene is evaluated at every temporal sample. v0.3 calligraphy accumulates tone-mapped samples in the display-referred composition surface; it is not yet a physically linear HDR integral. Final output is 8-bit sRGB."
        : "Linear radiance is tone-mapped into an 8-bit sRGB observation. The scene itself is continuous and resolution independent.",
    },
  };
}

export function screenToWorld(screen: Vec2, observer: ObserverState, aspect: number): Vec2 {
  const apertureHeight = 1 / observer.zoom;
  return {
    x: observer.center.x + (screen.x - 0.5) * apertureHeight * aspect,
    y: observer.center.y + (screen.y - 0.5) * apertureHeight,
  };
}

export function zoomObserverAt(
  observer: ObserverState,
  screen: Vec2,
  factor: number,
  aspect: number,
): ObserverState {
  const before = screenToWorld(screen, observer, aspect);
  const zoom = clamp(observer.zoom * factor, 0.125, 1_048_576);
  const provisional = { center: observer.center, zoom };
  const after = screenToWorld(screen, provisional, aspect);
  return normalizeObserver({
    center: {
      x: observer.center.x + before.x - after.x,
      y: observer.center.y + before.y - after.y,
    },
    zoom,
  });
}
