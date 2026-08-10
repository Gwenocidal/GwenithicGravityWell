const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const electron = path.join(root, "node_modules", "electron", "dist", "electron.exe");

function runSmoke(...args) {
  const result = spawnSync(electron, [root, "--smoke-test", ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  assert.equal(result.error, undefined, output);
  assert.equal(result.signal, null, output);
  return { ...result, output };
}

function lastJson(output) {
  const candidates = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("}"));
  assert.ok(candidates.length > 0, `No JSON result found in:\n${output}`);
  return JSON.parse(candidates.at(-1));
}

test("control surface remains inside common stranger-sized windows", { skip: !fs.existsSync(electron) }, () => {
  for (const size of ["640x360", "800x600", "1280x720", "1920x1080", "2560x1440"]) {
    const result = runSmoke("--layout-test", `--smoke-window=${size}`);
    const report = lastJson(result.output);
    assert.equal(result.status, 0, `${size}\n${result.output}`);
    assert.equal(report.layout.ok, true, `${size}\n${JSON.stringify(report.layout, null, 2)}`);
    assert.equal(report.layout.horizontalOverflow, false, size);
    assert.equal(report.layout.outsideViewport, false, size);
    assert.deepEqual(report.layout.escapedControls, [], size);
  }
});

test("renderer failure leaves a plain visible exit surface", { skip: !fs.existsSync(electron) }, () => {
  const result = runSmoke("--failure-snapshot", "--force-renderer-failure", "--smoke-window=800x600");
  const report = lastJson(result.output);
  assert.equal(result.status, 0, result.output);
  assert.match(report.message, /WebGL is unavailable/);
  assert.ok(fs.existsSync(report.failureSnapshot), report.failureSnapshot);
});
