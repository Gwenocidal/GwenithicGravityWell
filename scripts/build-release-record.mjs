import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argumentsByName = new Map(
  process.argv.slice(2).map((argument) => {
    const [name, ...value] = argument.split("=");
    return [name, value.join("=")];
  }),
);

const appDirectory = path.resolve(
  root,
  argumentsByName.get("--app-dir") ?? path.join("release", "Gwenithic Gravity Well-win32-x64"),
);
const archivePath = path.resolve(
  root,
  argumentsByName.get("--archive") ?? path.join("release", "Gwenithic Gravity Well Portable v0.3.1-rc.1.zip"),
);
const outputPath = path.resolve(
  root,
  argumentsByName.get("--output") ?? path.join("test-artifacts", "release-candidate-v0.3.1.json"),
);
const requireClean = process.argv.includes("--require-clean");

const requiredFiles = [
  "Gwenithic Gravity Well.exe",
  "ARTIFACT.md",
  "QUICKSTART.txt",
  "PORTABLE README.txt",
  "KNOWN-LIMITS.md",
  "RETURN.md",
  "LICENSE-PENDING.md",
  "THIRD-PARTY-NOTICES.md",
  "artifact.json",
  "VALIDATION-v0.3.1.md",
  "SOURCE-package.json",
  "pnpm-lock.yaml",
  path.join("examples", "home-aperture.gravity.json"),
  "LICENSE",
  "LICENSES.chromium.html",
];

async function sha256(file) {
  const hash = createHash("sha256");
  const stream = createReadStream(file);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex").toUpperCase();
}

async function measureTree(directory) {
  let files = 0;
  let bytes = 0;
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) {
        const stat = await fs.stat(target);
        files += 1;
        bytes += stat.size;
      }
    }
  }
  return { files, bytes };
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const packageManifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const artifact = JSON.parse(await fs.readFile(path.join(root, "artifact.json"), "utf8"));
if (artifact.version !== packageManifest.version) {
  throw new Error(`artifact.json version ${artifact.version} does not match package.json ${packageManifest.version}.`);
}

const missing = [];
for (const relative of requiredFiles) {
  try {
    await fs.access(path.join(appDirectory, relative));
  } catch {
    missing.push(relative);
  }
}
if (missing.length > 0) throw new Error(`Packaged body is missing: ${missing.join(", ")}`);

const sourceStatus = git("status", "--porcelain", "--untracked-files=all");
if (requireClean && sourceStatus) {
  throw new Error("The source tree is not clean; refusing to bind a release body to an incomplete source coordinate.");
}

const archiveStat = await fs.stat(archivePath);
const tree = await measureTree(appDirectory);
const digest = await sha256(archivePath);
const record = {
  schema: "gwenithic.artifact-release-candidate/0",
  created_at: new Date().toISOString(),
  artifact: {
    artifact_id: artifact.artifact_id,
    version: artifact.version,
    state: artifact.state,
  },
  source: {
    branch: git("branch", "--show-current"),
    commit: git("rev-parse", "HEAD"),
    clean: sourceStatus.length === 0,
  },
  body: {
    platform: "windows-x64",
    archive: path.basename(archivePath),
    byte_length: archiveStat.size,
    sha256: digest,
    unpacked_directory: path.basename(appDirectory),
    unpacked_files: tree.files,
    unpacked_bytes: tree.bytes,
  },
  permissions: artifact.licenses,
  required_files: requiredFiles.map((file) => file.replaceAll("\\", "/")),
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
await fs.writeFile(`${archivePath}.sha256`, `${digest}  ${path.basename(archivePath)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, archivePath, sha256: digest, sourceClean: record.source.clean }));
