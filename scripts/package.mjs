import { packager } from "@electron/packager";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const developmentLabel = String(process.env.GW_DEVELOPMENT_BUILD ?? "").trim();
const safeDevelopmentLabel = developmentLabel.replace(/[^0-9A-Za-z._-]+/g, "-");
const developmentBuild = safeDevelopmentLabel.length > 0;
const output = developmentBuild
  ? path.join(root, "release", "development")
  : path.join(root, "release");
const staging = path.join(root, ".packaging-stage");
const packagedName = developmentBuild
  ? `Gwenithic Gravity Well DEV ${safeDevelopmentLabel}`
  : "Gwenithic Gravity Well";
const sourceCommit = String(process.env.GW_SOURCE_COMMIT ?? "").trim();
const commitBuildComponent = /^[0-9a-f]{4}/i.test(sourceCommit)
  ? Number.parseInt(sourceCommit.slice(0, 4), 16)
  : 1;

async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}

await fs.rm(staging, { recursive: true, force: true });
await fs.mkdir(staging, { recursive: true });

const carryingFiles = [
  "ARTIFACT.md",
  "QUICKSTART.txt",
  "PORTABLE README.txt",
  "KNOWN-LIMITS.md",
  "RETURN.md",
  "LICENSE-DOCUMENTATION.md",
  "LICENSE-SCHEMAS.md",
  "OUTPUTS.md",
  "PUBLICATION.md",
  "RELEASE-COORDINATE.md",
  "TRADEMARKS.md",
  "THIRD-PARTY-NOTICES.md",
  "THIRD-PARTY-INVENTORY.json",
  "artifact.json",
  "UNIVERSE-TRAJECTORY.md",
  "MULTISCALE-LIGHT-FIELD-FLIGHT.md",
  "COSMIC-MORPHOLOGY-FLIGHT.md",
  "VALIDATION-v0.3.md",
  "VALIDATION-v0.3.1.md",
];

for (const file of ["main.js", "preload.js", ...carryingFiles, "pnpm-lock.yaml", ".npmrc"]) {
  await fs.copyFile(path.join(root, file), path.join(staging, file));
}
await fs.copyFile(path.join(root, "LICENSE"), path.join(staging, "LICENSE-APPLICATION.txt"));
// The source manifest names development tools that are intentionally absent
// from the portable runtime. Preserve that exact source definition separately,
// then give the staged production tree a truthful runtime-only manifest.
const sourceManifestText = await fs.readFile(path.join(root, "package.json"), "utf8");
const runtimeManifest = JSON.parse(sourceManifestText);
let developmentArtifactText = null;
let developmentArtifactVersion = null;
if (developmentBuild) {
  const sourceVersion = String(runtimeManifest.version ?? "0.0.0").split("-")[0];
  const prerelease = safeDevelopmentLabel.toLowerCase().replace(/[^0-9a-z.-]+/g, "-");
  developmentArtifactVersion = `${sourceVersion}-dev.${prerelease}`;
  runtimeManifest.productName = packagedName;
  const artifact = JSON.parse(await fs.readFile(path.join(root, "artifact.json"), "utf8"));
  artifact.version = developmentArtifactVersion;
  artifact.state = "development-build";
  artifact.development = {
    label: safeDevelopmentLabel,
    source_branch: process.env.GW_SOURCE_BRANCH ?? null,
    source_commit: process.env.GW_SOURCE_COMMIT ?? null,
    replaces_stable_release: false,
  };
  developmentArtifactText = `${JSON.stringify(artifact, null, 2)}\n`;
  await fs.writeFile(path.join(staging, "artifact.json"), developmentArtifactText, "utf8");
}
delete runtimeManifest.devDependencies;
delete runtimeManifest.scripts;
await fs.writeFile(path.join(staging, "package.json"), sourceManifestText, "utf8");
await fs.writeFile(path.join(staging, "SOURCE-package.json"), sourceManifestText, "utf8");
for (const directory of ["assets", "dist-renderer", "examples"]) {
  await fs.cp(path.join(root, directory), path.join(staging, directory), { recursive: true });
}

let appPaths;
try {
  // The temporary production tree is deliberately hoisted. Electron Packager's
  // dependency walker cannot follow Sharp's platform packages through pnpm's
  // ordinary content-addressed links, even though Node itself can.
  const pnpmModule = process.env.npm_execpath;
  if (!pnpmModule) throw new Error("pnpm did not expose npm_execpath to the packaging script.");
  await run(process.execPath, [pnpmModule, "install", "--prod", "--frozen-lockfile", "--shamefully-hoist", "--force"], staging);
  // Installation validates the complete source manifest against the frozen
  // lockfile. Only after that proof do we replace the packaged manifest with
  // the runtime-only declaration that Electron Packager will inspect.
  await fs.writeFile(path.join(staging, "package.json"), `${JSON.stringify(runtimeManifest, null, 2)}\n`, "utf8");

  appPaths = await packager({
    dir: staging,
    out: output,
    name: packagedName,
    executableName: packagedName,
    platform: "win32",
    arch: "x64",
    electronVersion: "43.3.0",
    appVersion: runtimeManifest.version,
    buildVersion: developmentBuild
      ? `${runtimeManifest.version}.${commitBuildComponent}`
      : runtimeManifest.version,
    win32metadata: {
      CompanyName: "Gwenithic",
      FileDescription: packagedName,
      ProductName: packagedName,
      InternalName: packagedName,
      OriginalFilename: `${packagedName}.exe`,
    },
    icon: path.join(root, "assets", "icon.ico"),
    overwrite: true,
    prune: true,
  });
} finally {
  await fs.rm(staging, { recursive: true, force: true });
}

for (const appPath of appPaths) {
  for (const file of carryingFiles) {
    await fs.copyFile(path.join(root, file), path.join(appPath, file));
  }
  // Electron Packager provides its own `LICENSE` beside the executable.
  // Keep Gwenithic's MIT grant explicit instead of overwriting that notice.
  await fs.copyFile(path.join(root, "LICENSE"), path.join(appPath, "LICENSE-APPLICATION.txt"));
  await fs.copyFile(path.join(root, "package.json"), path.join(appPath, "SOURCE-package.json"));
  await fs.copyFile(path.join(root, "pnpm-lock.yaml"), path.join(appPath, "pnpm-lock.yaml"));
  await fs.cp(path.join(root, "examples"), path.join(appPath, "examples"), { recursive: true });
  await fs.mkdir(path.join(appPath, "captures"), { recursive: true });
  await fs.mkdir(path.join(appPath, "data"), { recursive: true });
  if (developmentBuild) {
    const marker = [
      "GWENITHIC GRAVITY WELL - DEVELOPMENT BUILD",
      "",
      `Build label: ${safeDevelopmentLabel}`,
      `Artifact version: ${developmentArtifactVersion}`,
      `Source branch: ${process.env.GW_SOURCE_BRANCH ?? "unknown"}`,
      `Source commit: ${process.env.GW_SOURCE_COMMIT ?? "unknown"}`,
      "",
      "This body is an internal development observation. It does not replace the stable public release.",
      "",
    ].join("\n");
    await fs.writeFile(path.join(appPath, "DEVELOPMENT-BUILD.txt"), marker, "utf8");
    await fs.writeFile(path.join(appPath, "artifact.json"), developmentArtifactText, "utf8");
  }
}

console.log(appPaths.join("\n"));
