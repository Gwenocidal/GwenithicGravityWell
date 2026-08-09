const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("portable shell exposes the required controls and safety ceilings", () => {
  const main = read("main.js");
  const app = read("src/renderer/app.ts");
  const html = read("src/renderer/index.html");

  assert.match(main, /MAX_CAPTURE_DIMENSION = 65_535/);
  assert.match(main, /MAX_CAPTURE_PIXELS = 2_147_000_000/);
  assert.match(main, /STREAMING_PNG_THRESHOLD = 240_000_000/);
  assert.match(main, /finishStreamingPng/);
  assert.match(main, /createDeflate/);
  assert.match(main, /windowed.*borderless.*fullscreen/);
  assert.match(app, /event\.code === "Space"/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /"15360x8640"/);
  assert.match(html, /16K.*15360 × 8640/s);
});

test("capture renderer uses global tile coordinates and a continuous procedural reality", () => {
  const engine = read("src/renderer/engine.ts");
  const worker = read("src/renderer/export-worker.ts");

  assert.match(engine, /u_view_origin/);
  assert.match(engine, /u_view_scale/);
  assert.match(engine, /borrowed_light/);
  assert.match(engine, /worldFromScreen/);
  assert.match(engine, /starGrid/);
  assert.match(engine, /microHierarchy/);
  assert.match(engine, /red_scene\.r, green_scene\.g, blue_scene\.b/);
  assert.doesNotMatch(engine, /texImage2D/);
  assert.match(worker, /OffscreenCanvas/);
  assert.match(worker, /tileHeight/);
  assert.match(worker, /tile-ack/);
  assert.match(worker, /temporalCount/);
  assert.match(worker, /globalCompositeOperation = "lighter"/);
});

test("observations are journaled, reproducible, and distinct from semantic authority", () => {
  const universe = read("src/renderer/universe.ts");
  const main = read("main.js");
  const trajectory = read("UNIVERSE-TRAJECTORY.md");

  assert.match(universe, /gwenithic-gravity-universe\/0\.3/);
  assert.match(universe, /class UniverseJournal/);
  assert.match(universe, /requestId/);
  assert.match(universe, /makeExposureRecipe/);
  assert.match(main, /\.gravity\.json/);
  assert.match(main, /atomicWriteText/);
  assert.match(trajectory, /The ideal is not absent\. It is inexhaustible\./);
  assert.match(trajectory, /It does \*\*not\*\* claim to be λ/);
});

test("packager includes the field manual and writable portable folders", () => {
  const pack = read("scripts/package.mjs");
  assert.ok(fs.existsSync(path.join(root, "PORTABLE README.txt")));
  assert.match(pack, /PORTABLE README\.txt/);
  assert.match(pack, /UNIVERSE-TRAJECTORY\.md/);
  assert.match(pack, /VALIDATION-v0\.3\.md/);
  assert.match(pack, /pnpm-lock\.yaml/);
  assert.match(pack, /--frozen-lockfile/);
  assert.match(pack, /Preserve the exact manifest beside its lockfile/);
  assert.match(pack, /captures/);
  assert.match(pack, /data/);
});
