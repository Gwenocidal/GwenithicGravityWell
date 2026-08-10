const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require("electron");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { Transform } = require("node:stream");
const { once } = require("node:events");
const { pipeline } = require("node:stream/promises");
const zlib = require("node:zlib");
const sharp = require("sharp");

sharp.cache({ memory: 512, files: 64, items: 128 });

const WINDOW_MODES = new Set(["windowed", "borderless", "fullscreen"]);
const CAPTURE_FORMATS = new Set(["png", "jpeg", "webp"]);
const MAX_CAPTURE_DIMENSION = 65_535;
const MAX_CAPTURE_PIXELS = 2_147_000_000;
const STREAMING_PNG_THRESHOLD = 240_000_000;
const smokeMode = process.argv.includes("--smoke-test");
const smokeLargeCapture = process.argv.includes("--capture-test-large");
const smokeHugeCapture = process.argv.includes("--capture-test-huge");
const smokeEmptyCapture = process.argv.includes("--capture-test-empty");
const smokeCalligraphy = process.argv.includes("--capture-test-calligraphy");
const smokeZoom = process.argv.includes("--capture-test-zoom");
const smokeCapture = process.argv.includes("--capture-test") || smokeLargeCapture || smokeHugeCapture || smokeEmptyCapture || smokeCalligraphy || smokeZoom;
const keepSmokeCapture = process.argv.includes("--keep-capture");
const menuSnapshot = process.argv.includes("--menu-snapshot");
const layoutTest = process.argv.includes("--layout-test");
const failureSnapshot = process.argv.includes("--failure-snapshot");
const forceRendererFailure = process.argv.includes("--force-renderer-failure");
const recipeReplayTest = process.argv.includes("--recipe-replay-test");
const forceStreamingPng = process.argv.includes("--force-streaming-png");
const smokeWindowArgument = process.argv.find((argument) => argument.startsWith("--smoke-window="));
const smokeWindowMatch = smokeWindowArgument?.slice("--smoke-window=".length).match(/^(\d+)x(\d+)$/i);
const smokeWindow = smokeWindowMatch
  ? { width: Number(smokeWindowMatch[1]), height: Number(smokeWindowMatch[2]) }
  : null;
const smokeDataDirectory = path.join(os.tmpdir(), `gwenithic-gravity-well-smoke-${process.pid}`);

let mainWindow = null;
let currentMode = "windowed";
let appSettings = {
  windowMode: "windowed",
  windowedBounds: { width: 1280, height: 720 },
};
let saveTimer = null;
let smokeStarted = false;
const captureJobs = new Map();


function portableRoot() {
  return app.isPackaged ? path.dirname(process.execPath) : __dirname;
}


function dataRoot() {
  return smokeMode ? smokeDataDirectory : path.join(portableRoot(), "data");
}


function captureRoot() {
  return path.join(portableRoot(), "captures");
}

function universePath() {
  return path.join(dataRoot(), "GravityWell.universe.json");
}

function safeJson(value, label = "record") {
  const text = JSON.stringify(value, null, 2);
  if (Buffer.byteLength(text, "utf8") > 20 * 1024 * 1024) {
    throw new Error(`The ${label} exceeds the 20 MiB portable record ceiling.`);
  }
  return text;
}

async function atomicWriteText(target, text) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, text, "utf8");
  await fs.rename(temporary, target);
}

// Keep Chromium preferences, localStorage, and caches in the portable box too.
fsSync.mkdirSync(dataRoot(), { recursive: true });
app.setPath("userData", dataRoot());


async function loadSettings() {
  try {
    const raw = await fs.readFile(path.join(dataRoot(), "settings.json"), "utf8");
    const parsed = JSON.parse(raw);
    if (WINDOW_MODES.has(parsed.windowMode)) appSettings.windowMode = parsed.windowMode;
    if (
      Number.isFinite(parsed.windowedBounds?.width) &&
      Number.isFinite(parsed.windowedBounds?.height)
    ) {
      appSettings.windowedBounds = {
        width: Math.max(640, Math.round(parsed.windowedBounds.width)),
        height: Math.max(360, Math.round(parsed.windowedBounds.height)),
      };
    }
  } catch {
    // First launch is expected to have no settings file.
  }
}


async function saveSettings() {
  await fs.mkdir(dataRoot(), { recursive: true });
  await fs.writeFile(
    path.join(dataRoot(), "settings.json"),
    JSON.stringify(appSettings, null, 2),
    "utf8",
  );
}


function queueSaveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveSettings().catch(() => {});
  }, 180);
}


function displayForBounds(bounds) {
  if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y)) {
    return screen.getDisplayMatching(bounds);
  }
  return screen.getPrimaryDisplay();
}


async function createMainWindow(mode = appSettings.windowMode) {
  const nextMode = WINDOW_MODES.has(mode) ? mode : "windowed";
  const previous = mainWindow;
  const previousBounds = previous && !previous.isDestroyed() ? previous.getBounds() : null;
  if (previous && !previous.isDestroyed()) {
    if (currentMode === "windowed") {
      appSettings.windowedBounds = {
        width: Math.max(640, previousBounds.width),
        height: Math.max(360, previousBounds.height),
      };
    }
    previous.destroy();
  }

  const display = displayForBounds(previousBounds);
  const isWindowed = nextMode === "windowed";
  const bounds = isWindowed
    ? (() => {
        const width = Math.min(appSettings.windowedBounds.width, display.workArea.width);
        const height = Math.min(appSettings.windowedBounds.height, display.workArea.height);
        return {
          width,
          height,
          x: display.workArea.x + Math.max(0, Math.floor((display.workArea.width - width) / 2)),
          y: display.workArea.y + Math.max(0, Math.floor((display.workArea.height - height) / 2)),
        };
      })()
    : display.bounds;

  currentMode = nextMode;
  appSettings.windowMode = nextMode;
  queueSaveSettings();

  mainWindow = new BrowserWindow({
    ...bounds,
    show: false,
    frame: isWindowed,
    resizable: true,
    movable: true,
    fullscreenable: true,
    autoHideMenuBar: true,
    backgroundColor: "#030309",
    title: "Gwenithic Gravity Well",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  if (smokeMode) {
    mainWindow.webContents.on("console-message", (_event, details) => {
      console.error(`[renderer:${details.level}] ${details.message}`);
    });
  }
  mainWindow.on("resize", () => {
    if (currentMode !== "windowed" || !mainWindow || mainWindow.isDestroyed()) return;
    const nextBounds = mainWindow.getBounds();
    appSettings.windowedBounds = {
      width: Math.max(640, nextBounds.width),
      height: Math.max(360, nextBounds.height),
    };
    queueSaveSettings();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.once("ready-to-show", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (nextMode === "fullscreen") mainWindow.setFullScreen(true);
    if (!smokeMode) mainWindow.show();
  });

  await mainWindow.loadFile(path.join(__dirname, "dist-renderer", "index.html"));
}


function validateCaptureSpec(spec) {
  const width = Math.round(Number(spec?.width));
  const height = Math.round(Number(spec?.height));
  const format = CAPTURE_FORMATS.has(spec?.format) ? spec.format : "png";
  const quality = Math.max(1, Math.min(100, Math.round(Number(spec?.quality) || 92)));
  const expectedTiles = Math.max(1, Math.round(Number(spec?.expectedTiles) || 1));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) {
    throw new Error("Capture dimensions must both be at least 16 pixels.");
  }
  if (width > MAX_CAPTURE_DIMENSION || height > MAX_CAPTURE_DIMENSION) {
    throw new Error(`Capture dimensions cannot exceed ${MAX_CAPTURE_DIMENSION.toLocaleString()} pixels per side.`);
  }
  if (width * height > MAX_CAPTURE_PIXELS) {
    throw new Error("This capture exceeds the 2.147 gigapixel safety ceiling.");
  }
  if (format === "webp" && (width > 16_383 || height > 16_383)) {
    throw new Error("WebP is limited to 16,383 pixels per side. Use PNG for an image this large.");
  }
  if (format !== "png" && width * height > STREAMING_PNG_THRESHOLD) {
    throw new Error("Extreme captures above 240 megapixels require PNG so they can be assembled as a stream.");
  }
  return { width, height, format, quality, expectedTiles };
}


function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
}


async function uniqueCapturePath(job) {
  await fs.mkdir(captureRoot(), { recursive: true });
  const extension = job.format === "jpeg" ? "jpg" : job.format;
  const stem = `GravityWell_${timestampForFilename()}_${job.width}x${job.height}`;
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? "" : `_${index + 1}`;
    const candidate = path.join(captureRoot(), `${stem}${suffix}.${extension}`);
    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
  }
  throw new Error("Could not allocate a unique capture filename.");
}


function cursorSvg(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">` +
      `<path d="M5 3 L5 50 L17 39 L26 60 L36 55 L27 35 L45 35 Z" ` +
      `fill="#fbf7ec" stroke="#07070b" stroke-width="4" stroke-linejoin="round"/>` +
    `</svg>`,
  );
}


const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_FILTER_NONE = Buffer.from([0]);
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();


function crc32(buffers) {
  let value = 0xffffffff;
  for (const buffer of buffers) {
    for (const byte of buffer) {
      value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}


function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.allocUnsafe(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32([typeBytes, data]), 8 + data.length);
  return chunk;
}


function pngHeader(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", ihdr)]);
}


async function writeWithBackpressure(stream, buffer) {
  if (!stream.write(buffer)) await once(stream, "drain");
}


async function cursorPixels(options, width, height) {
  if (!options?.includeCursor) return null;
  const scale = Math.max(0.1, Number(options.captureScale) || 1);
  const size = Math.max(18, Math.min(512, Math.round(24 * scale)));
  const data = await sharp(cursorSvg(size), { unlimited: true })
    .ensureAlpha()
    .raw()
    .toBuffer();
  return {
    data,
    size,
    left: Math.max(0, Math.min(width - 1, Math.round(Math.max(0, Math.min(1, Number(options.pointerX))) * width))),
    top: Math.max(0, Math.min(height - 1, Math.round(Math.max(0, Math.min(1, Number(options.pointerY))) * height))),
  };
}


function compositeCursorIntoBand(band, bandY, bandHeight, imageWidth, cursor) {
  if (!cursor) return;
  const startY = Math.max(bandY, cursor.top);
  const endY = Math.min(bandY + bandHeight, cursor.top + cursor.size);
  const startX = Math.max(0, cursor.left);
  const endX = Math.min(imageWidth, cursor.left + cursor.size);
  if (startY >= endY || startX >= endX) return;

  for (let y = startY; y < endY; y += 1) {
    const cursorY = y - cursor.top;
    const bandRow = y - bandY;
    for (let x = startX; x < endX; x += 1) {
      const cursorX = x - cursor.left;
      const sourceOffset = (cursorY * cursor.size + cursorX) * 4;
      const alpha = cursor.data[sourceOffset + 3] / 255;
      if (alpha <= 0) continue;
      const destinationOffset = (bandRow * imageWidth + x) * 4;
      const inverse = 1 - alpha;
      band[destinationOffset] = Math.round(cursor.data[sourceOffset] * alpha + band[destinationOffset] * inverse);
      band[destinationOffset + 1] = Math.round(cursor.data[sourceOffset + 1] * alpha + band[destinationOffset + 1] * inverse);
      band[destinationOffset + 2] = Math.round(cursor.data[sourceOffset + 2] * alpha + band[destinationOffset + 2] * inverse);
      band[destinationOffset + 3] = 255;
    }
  }
}


async function finishStreamingPng(job, options, finalPath) {
  const rows = new Map();
  for (const tile of job.tiles.values()) {
    if (!rows.has(tile.y)) rows.set(tile.y, []);
    rows.get(tile.y).push(tile);
  }
  const orderedRows = [...rows.entries()].sort((a, b) => a[0] - b[0]);
  let expectedY = 0;
  for (const [y, tiles] of orderedRows) {
    tiles.sort((a, b) => a.x - b.x);
    if (y !== expectedY) throw new Error(`Capture tile rows are not contiguous at y=${expectedY}.`);
    const rowHeight = tiles[0]?.height;
    let expectedX = 0;
    for (const tile of tiles) {
      if (tile.x !== expectedX || tile.height !== rowHeight) {
        throw new Error(`Capture tiles are not contiguous at x=${expectedX}, y=${y}.`);
      }
      expectedX += tile.width;
    }
    if (expectedX !== job.width) throw new Error(`Capture tile row at y=${y} is incomplete.`);
    expectedY += rowHeight;
  }
  if (expectedY !== job.height) throw new Error("Capture tile rows do not cover the final image.");

  const cursor = await cursorPixels(options, job.width, job.height);
  const output = fsSync.createWriteStream(finalPath, { flags: "wx" });
  output.write(pngHeader(job.width, job.height));
  const deflater = zlib.createDeflate({ level: 9, chunkSize: 1024 * 1024 });
  const chunker = new Transform({
    transform(chunk, _encoding, callback) {
      callback(null, pngChunk("IDAT", chunk));
    },
    flush(callback) {
      this.push(pngChunk("IEND", Buffer.alloc(0)));
      callback();
    },
  });
  const encoding = pipeline(deflater, chunker, output);

  try {
    for (const [y, tiles] of orderedRows) {
      const bandHeight = tiles[0].height;
      const band = Buffer.allocUnsafe(job.width * bandHeight * 4);
      for (const tile of tiles) {
        const { data, info } = await sharp(tile.path, { limitInputPixels: false, unlimited: true })
          .flatten({ background: "#030309" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        if (info.width !== tile.width || info.height !== tile.height || info.channels !== 4) {
          throw new Error(`Decoded tile ${tile.index} has unexpected geometry.`);
        }
        const sourceStride = tile.width * 4;
        const destinationStride = job.width * 4;
        for (let row = 0; row < tile.height; row += 1) {
          data.copy(
            band,
            row * destinationStride + tile.x * 4,
            row * sourceStride,
            (row + 1) * sourceStride,
          );
        }
      }
      compositeCursorIntoBand(band, y, bandHeight, job.width, cursor);
      const stride = job.width * 4;
      for (let row = 0; row < bandHeight; row += 1) {
        await writeWithBackpressure(deflater, PNG_FILTER_NONE);
        await writeWithBackpressure(deflater, band.subarray(row * stride, (row + 1) * stride));
      }
    }
    deflater.end();
    await encoding;
  } catch (error) {
    deflater.destroy(error);
    output.destroy(error);
    await encoding.catch(() => {});
    await fs.rm(finalPath, { force: true }).catch(() => {});
    throw error;
  }
  return finalPath;
}


async function finishCapture(job, options) {
  if (job.tiles.size !== job.expectedTiles) {
    throw new Error(`Expected ${job.expectedTiles} tiles but received ${job.tiles.size}.`);
  }
  const finalPath = await uniqueCapturePath(job);
  if (job.format === "png" && (forceStreamingPng || job.width * job.height > STREAMING_PNG_THRESHOLD)) {
    return finishStreamingPng(job, options, finalPath);
  }
  const overlays = [...job.tiles.values()]
    .sort((a, b) => a.index - b.index)
    .map((tile) => ({ input: tile.path, left: tile.x, top: tile.y }));

  if (options?.includeCursor) {
    const pointerX = Math.round(Math.max(0, Math.min(1, Number(options.pointerX))) * job.width);
    const pointerY = Math.round(Math.max(0, Math.min(1, Number(options.pointerY))) * job.height);
    const scale = Math.max(0.1, Number(options.captureScale) || 1);
    const size = Math.max(18, Math.min(512, Math.round(24 * scale)));
    overlays.push({
      input: cursorSvg(size),
      left: Math.max(0, Math.min(job.width - 1, pointerX)),
      top: Math.max(0, Math.min(job.height - 1, pointerY)),
    });
  }

  let pipeline = sharp({
    create: {
      width: job.width,
      height: job.height,
      channels: 4,
      background: { r: 3, g: 3, b: 9, alpha: 1 },
    },
    limitInputPixels: false,
  }).composite(overlays);

  if (job.format === "jpeg") {
    pipeline = pipeline.flatten({ background: "#030309" }).jpeg({ quality: job.quality, mozjpeg: true });
  } else if (job.format === "webp") {
    pipeline = pipeline.webp({ quality: job.quality, effort: 5 });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  }

  await pipeline.toFile(finalPath);
  return finalPath;
}


ipcMain.handle("app:get-info", async () => {
  await fs.mkdir(captureRoot(), { recursive: true });
  return {
    version: app.getVersion(),
    windowMode: currentMode,
    captureDirectory: captureRoot(),
    maxCaptureDimension: MAX_CAPTURE_DIMENSION,
    maxCapturePixels: MAX_CAPTURE_PIXELS,
    forceRendererFailure,
  };
});

ipcMain.on("window:set-mode", (_event, mode) => {
  if (!WINDOW_MODES.has(mode) || mode === currentMode) return;
  setImmediate(() => createMainWindow(mode).catch((error) => console.error(error)));
});

ipcMain.on("app:quit", () => app.quit());

ipcMain.handle("capture:open-folder", async () => {
  await fs.mkdir(captureRoot(), { recursive: true });
  return shell.openPath(captureRoot());
});

ipcMain.handle("capture:begin", async (_event, rawSpec) => {
  const spec = validateCaptureSpec(rawSpec);
  const jobId = crypto.randomUUID();
  const tempRoot = path.join(os.tmpdir(), "GwenithicGravityWell");
  await fs.mkdir(tempRoot, { recursive: true });
  const directory = await fs.mkdtemp(path.join(tempRoot, `${jobId}-`));
  captureJobs.set(jobId, { ...spec, jobId, directory, tiles: new Map() });
  return { jobId, captureDirectory: captureRoot() };
});

ipcMain.handle("capture:write-tile", async (_event, payload) => {
  const job = captureJobs.get(payload?.jobId);
  if (!job) throw new Error("Capture job no longer exists.");
  const index = Math.round(Number(payload.index));
  const x = Math.round(Number(payload.x));
  const y = Math.round(Number(payload.y));
  const width = Math.round(Number(payload.width));
  const height = Math.round(Number(payload.height));
  if (
    !Number.isFinite(index) || !Number.isFinite(x) || !Number.isFinite(y) ||
    !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1
  ) {
    throw new Error("Invalid capture tile metadata.");
  }
  const tilePath = path.join(job.directory, `tile-${String(index).padStart(6, "0")}.png`);
  await fs.writeFile(tilePath, Buffer.from(payload.bytes));
  job.tiles.set(index, { index, x, y, width, height, path: tilePath });
  return { written: job.tiles.size, expected: job.expectedTiles };
});

ipcMain.handle("capture:finish", async (_event, payload) => {
  const job = captureJobs.get(payload?.jobId);
  if (!job) throw new Error("Capture job no longer exists.");
  try {
    const finalPath = await finishCapture(job, payload);
    let recipePath = null;
    if (payload?.recipe?.schema === "gwenithic-gravity-exposure/0.3") {
      recipePath = `${finalPath}.gravity.json`;
      await atomicWriteText(recipePath, safeJson(payload.recipe, "exposure recipe"));
    }
    return { finalPath, recipePath, captureDirectory: captureRoot() };
  } finally {
    captureJobs.delete(job.jobId);
    await fs.rm(job.directory, { recursive: true, force: true }).catch(() => {});
  }
});

ipcMain.handle("universe:save", async (_event, record) => {
  if (record?.schema !== "gwenithic-gravity-universe/0.3") {
    throw new Error("Refusing to save an unknown universe record schema.");
  }
  const target = universePath();
  await atomicWriteText(target, safeJson(record, "universe journal"));
  return { path: target };
});

ipcMain.handle("universe:load", async () => {
  try {
    const text = await fs.readFile(universePath(), "utf8");
    const parsed = JSON.parse(text);
    if (parsed?.schema !== "gwenithic-gravity-universe/0.3") {
      throw new Error("The saved universe uses an unsupported schema.");
    }
    return { path: universePath(), record: parsed };
  } catch (error) {
    if (error?.code === "ENOENT") return { path: universePath(), record: null };
    throw error;
  }
});

ipcMain.handle("recipe:choose", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: "Open a Gwenithic Gravity Well exposure recipe",
    defaultPath: captureRoot(),
    properties: ["openFile"],
    filters: [
      { name: "Gravity Well exposure recipes", extensions: ["json"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (selection.canceled || !selection.filePaths[0]) return null;
  const selectedPath = selection.filePaths[0];
  const text = await fs.readFile(selectedPath, "utf8");
  const recipe = JSON.parse(text);
  if (recipe?.schema !== "gwenithic-gravity-exposure/0.3") {
    throw new Error("The selected file is not a supported Gravity Well exposure recipe.");
  }
  return { path: selectedPath, recipe };
});

ipcMain.handle("capture:cancel", async (_event, jobId) => {
  const job = captureJobs.get(jobId);
  if (!job) return false;
  captureJobs.delete(jobId);
  await fs.rm(job.directory, { recursive: true, force: true }).catch(() => {});
  return true;
});

ipcMain.on("renderer:ready", async (_event, details) => {
  if (!smokeMode || smokeStarted) return;
  smokeStarted = true;
  try {
    if (recipeReplayTest) {
      const first = await mainWindow.webContents.executeJavaScript("window.__gravityTest.run(true)", true);
      const recipePath = first.recipePath ?? `${first.finalPath}.gravity.json`;
      const recipe = JSON.parse(await fs.readFile(recipePath, "utf8"));
      const second = await mainWindow.webContents.executeJavaScript(
        `window.__gravityTest.replay(${JSON.stringify(recipe)})`,
        true,
      );
      const hashFile = async (file) => crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
      const firstHash = await hashFile(first.finalPath);
      const secondHash = await hashFile(second.finalPath);
      const firstPixels = await sharp(first.finalPath).raw().toBuffer({ resolveWithObject: true });
      const secondPixels = await sharp(second.finalPath).raw().toBuffer({ resolveWithObject: true });
      const sameGeometry =
        firstPixels.info.width === secondPixels.info.width &&
        firstPixels.info.height === secondPixels.info.height &&
        firstPixels.info.channels === secondPixels.info.channels &&
        firstPixels.data.length === secondPixels.data.length;
      let absoluteDifference = 0;
      let maximumDifference = 0;
      let differingChannels = 0;
      if (sameGeometry) {
        for (let index = 0; index < firstPixels.data.length; index += 1) {
          const difference = Math.abs(firstPixels.data[index] - secondPixels.data[index]);
          absoluteDifference += difference;
          maximumDifference = Math.max(maximumDifference, difference);
          if (difference > 0) differingChannels += 1;
        }
      }
      const meanAbsoluteDifference = sameGeometry
        ? absoluteDifference / firstPixels.data.length
        : Number.POSITIVE_INFINITY;
      const ok = sameGeometry && meanAbsoluteDifference <= 0.05 && maximumDifference <= 16;
      console.log(JSON.stringify({
        ready: details,
        recipeReplay: {
          ok,
          firstHash,
          secondHash,
          byteIdentical: firstHash === secondHash,
          sameGeometry,
          meanAbsoluteDifference,
          maximumDifference,
          differingChannels,
          totalChannels: firstPixels.data.length,
          schema: recipe.schema,
        },
      }));
      if (!keepSmokeCapture) {
        for (const file of [first.finalPath, recipePath, second.finalPath, second.recipePath ?? `${second.finalPath}.gravity.json`]) {
          await fs.rm(file, { force: true }).catch(() => {});
        }
      }
      app.exit(ok ? 0 : 1);
      return;
    }
    if (layoutTest) {
      const result = await mainWindow.webContents.executeJavaScript(
        `(() => {
          const menu = document.getElementById("menu");
          const panel = menu.querySelector(".menu-panel");
          menu.style.transition = "none";
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
          document.body.offsetHeight;
          const viewport = { width: window.innerWidth, height: window.innerHeight };
          const panelRect = panel.getBoundingClientRect();
          const horizontalOverflow = panel.scrollWidth > panel.clientWidth + 1;
          const outsideViewport = panelRect.left < -1 || panelRect.right > viewport.width + 1;
          const bodyOverflow = document.documentElement.scrollWidth > viewport.width + 1;
          const primaryControls = [...panel.querySelectorAll("button, select, input")]
            .filter((element) => !element.hidden && element.getClientRects().length > 0);
          const escapedControls = primaryControls
            .map((element) => ({ id: element.id, rect: element.getBoundingClientRect() }))
            .filter(({ rect }) => rect.right > panelRect.right + 1 || rect.left < panelRect.left - 1)
            .map(({ id }) => id || "unnamed-control");
          return {
            ok: !horizontalOverflow && !outsideViewport && !bodyOverflow && escapedControls.length === 0,
            viewport,
            panel: {
              left: panelRect.left,
              right: panelRect.right,
              width: panelRect.width,
              clientWidth: panel.clientWidth,
              scrollWidth: panel.scrollWidth
            },
            horizontalOverflow,
            outsideViewport,
            bodyOverflow,
            escapedControls
          };
        })()`,
        true,
      );
      console.log(JSON.stringify({ ready: details, layout: result }));
      app.exit(result?.ok ? 0 : 1);
      return;
    }
    if (menuSnapshot) {
      await mainWindow.webContents.executeJavaScript(
        `document.getElementById("menu").style.transition = "none";
         window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
         document.body.offsetHeight`,
        true,
      );
      await new Promise((resolve) => setTimeout(resolve, 350));
      const artifactDirectory = path.join(portableRoot(), "test-artifacts");
      const artifactPath = path.join(artifactDirectory, "control-surface.png");
      await fs.mkdir(artifactDirectory, { recursive: true });
      const image = await mainWindow.webContents.capturePage();
      await fs.writeFile(artifactPath, image.toPNG());
      console.log(JSON.stringify({ ready: details, menuSnapshot: artifactPath }));
      app.exit(0);
      return;
    }
    const result = await mainWindow.webContents.executeJavaScript(
      `window.__gravityTest.run(${
         smokeHugeCapture
           ? '"huge"'
           : smokeLargeCapture
             ? '"large"'
             : smokeCalligraphy
               ? '"calligraphy"'
               : smokeZoom
                 ? '"zoom"'
             : smokeEmptyCapture
              ? '"empty"'
              : smokeCapture ? "true" : "false"
      })`,
      true,
    );
    console.log(JSON.stringify({ ready: details, test: result }));
    if (result?.finalPath && !keepSmokeCapture) {
      await fs.rm(result.finalPath, { force: true }).catch(() => {});
      await fs.rm(result.recipePath ?? `${result.finalPath}.gravity.json`, { force: true }).catch(() => {});
    }
    app.exit(result?.ok ? 0 : 1);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});

ipcMain.on("renderer:failure", (_event, message) => {
  console.error(`Renderer initialization failed: ${message}`);
  if (!smokeMode) return;
  if (failureSnapshot && mainWindow && !mainWindow.isDestroyed()) {
    smokeStarted = true;
    setTimeout(async () => {
      try {
        const artifactDirectory = path.join(portableRoot(), "test-artifacts");
        const artifactPath = path.join(artifactDirectory, "failure-surface.png");
        await fs.mkdir(artifactDirectory, { recursive: true });
        const image = await mainWindow.webContents.capturePage();
        await fs.writeFile(artifactPath, image.toPNG());
        console.log(JSON.stringify({ failureSnapshot: artifactPath, message }));
        app.exit(0);
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    }, 180);
    return;
  }
  app.exit(1);
});

app.whenReady().then(async () => {
  await loadSettings();
  if (smokeWindow) {
    appSettings.windowMode = "windowed";
    appSettings.windowedBounds = {
      width: Math.max(640, Math.round(smokeWindow.width)),
      height: Math.max(360, Math.round(smokeWindow.height)),
    };
  }
  await createMainWindow(appSettings.windowMode);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  for (const job of captureJobs.values()) {
    fs.rm(job.directory, { recursive: true, force: true }).catch(() => {});
  }
  if (smokeMode) fs.rm(smokeDataDirectory, { recursive: true, force: true }).catch(() => {});
});
