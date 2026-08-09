/// <reference lib="webworker" />

import { GravityRenderer, type RenderState, type Vec2 } from "./engine";
import { samplePath, type ObserverState, type PathPoint, type RadianceState } from "./universe";

type StartMessage = {
  type: "start";
  jobId: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  pointer: Vec2;
  motion: Vec2;
  strength: number;
  time: number;
  observer: ObserverState;
  radiance: RadianceState;
  seed: number;
  path: PathPoint[];
  duration: number;
  temporalSamples: number;
};

type ControlMessage =
  | StartMessage
  | { type: "tile-ack"; jobId: string; index: number }
  | { type: "cancel"; jobId: string };

const worker = self as unknown as DedicatedWorkerGlobalScope;
const cancelled = new Set<string>();
const acknowledgements = new Map<string, () => void>();


function acknowledgementKey(jobId: string, index: number) {
  return `${jobId}:${index}`;
}


function waitForAcknowledgement(jobId: string, index: number) {
  return new Promise<void>((resolve) => {
    acknowledgements.set(acknowledgementKey(jobId, index), resolve);
  });
}


async function renderCapture(message: StartMessage) {
  const canvas = new OffscreenCanvas(2, 2);
  const renderer = new GravityRenderer(canvas);
  try {
    const tileWidth = Math.max(
      256,
      Math.min(
        Math.round(message.tileWidth),
        renderer.limits.maxViewportWidth,
      ),
    );
    const tileHeight = Math.max(
      128,
      Math.min(
        Math.round(message.tileHeight),
        renderer.limits.maxViewportHeight,
      ),
    );
    const columns = Math.ceil(message.width / tileWidth);
    const rows = Math.ceil(message.height / tileHeight);
    const total = columns * rows;
    let index = 0;

    worker.postMessage({
      type: "started",
      jobId: message.jobId,
      total,
      tileWidth,
      tileHeight,
      reality: "continuous-procedural",
      limits: renderer.limits,
    });

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (cancelled.has(message.jobId)) {
          worker.postMessage({ type: "cancelled", jobId: message.jobId });
          return;
        }
        const x = column * tileWidth;
        const y = row * tileHeight;
        const width = Math.min(tileWidth, message.width - x);
        const height = Math.min(tileHeight, message.height - y);
        const baseState: RenderState = {
          pointer: message.pointer,
          motion: message.motion,
          strength: message.strength,
          time: message.time,
          fullWidth: message.width,
          fullHeight: message.height,
          observer: message.observer,
          radiance: message.radiance,
          seed: message.seed,
          viewOrigin: { x: x / message.width, y: 1 - (y + height) / message.height },
          viewScale: { x: width / message.width, y: height / message.height },
        };

        const temporalCount = message.path.length > 1
          ? Math.max(1, Math.min(32, Math.round(message.temporalSamples)))
          : 1;
        let outputCanvas: OffscreenCanvas = canvas;
        if (temporalCount > 1) {
          const accumulation = new OffscreenCanvas(width, height);
          const context = accumulation.getContext("2d");
          if (!context) throw new Error("The temporal accumulation surface is unavailable.");
          context.clearRect(0, 0, width, height);
          context.globalCompositeOperation = "lighter";
          context.globalAlpha = 1 / temporalCount;
          let previous = message.pointer;
          for (let temporalIndex = 0; temporalIndex < temporalCount; temporalIndex += 1) {
            const pathTime = message.duration * (temporalIndex + 0.5) / temporalCount;
            const sample = samplePath(message.path, pathTime);
            const pointer = sample?.pointer ?? message.pointer;
            const motion = {
              x: Math.max(-1, Math.min(1, (pointer.x - previous.x) * 18)),
              y: Math.max(-1, Math.min(1, (pointer.y - previous.y) * 18)),
            };
            renderer.render(width, height, {
              ...baseState,
              pointer,
              motion,
              strength: sample?.strength ?? message.strength,
              time: message.time + pathTime,
            });
            context.drawImage(canvas, 0, 0);
            previous = pointer;
          }
          outputCanvas = accumulation;
        } else {
          renderer.render(width, height, baseState);
        }
        const blob = await outputCanvas.convertToBlob({ type: "image/png" });
        const bytes = await blob.arrayBuffer();
        const ack = waitForAcknowledgement(message.jobId, index);
        worker.postMessage(
          {
            type: "tile",
            jobId: message.jobId,
            index,
            x,
            y,
            width,
            height,
            bytes,
            completed: index + 1,
            total,
          },
          [bytes],
        );
        await ack;
        index += 1;
      }
    }
    worker.postMessage({ type: "render-complete", jobId: message.jobId, total });
  } finally {
    cancelled.delete(message.jobId);
    renderer.destroy();
  }
}


worker.onmessage = (event: MessageEvent<ControlMessage>) => {
  const message = event.data;
  if (message.type === "tile-ack") {
    const key = acknowledgementKey(message.jobId, message.index);
    acknowledgements.get(key)?.();
    acknowledgements.delete(key);
    return;
  }
  if (message.type === "cancel") {
    cancelled.add(message.jobId);
    return;
  }
  if (message.type === "start") {
    renderCapture(message).catch((error) => {
      worker.postMessage({
        type: "error",
        jobId: message.jobId,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }
};
