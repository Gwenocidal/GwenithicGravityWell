import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpmModule = process.env.npm_execpath;
if (!pnpmModule) {
  throw new Error("Run this inventory through pnpm so the locked pnpm executable is explicit.");
}

function licenses(args = []) {
  return JSON.parse(
    execFileSync(process.execPath, [pnpmModule, "licenses", "list", ...args, "--json"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    }),
  );
}

function flatten(report) {
  const entries = [];
  for (const [license, packages] of Object.entries(report)) {
    for (const dependency of packages) {
      for (const version of dependency.versions) {
        entries.push({
          name: dependency.name,
          version,
          license,
          homepage: dependency.homepage ?? null,
        });
      }
    }
  }
  return entries;
}

const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const all = flatten(licenses());
const production = new Set(flatten(licenses(["--prod"])).map(({ name, version }) => `${name}@${version}`));
const directRuntime = new Set(Object.keys(manifest.dependencies ?? {}));
const directDevelopment = new Set(Object.keys(manifest.devDependencies ?? {}));

const packages = all
  .map((dependency) => ({
    ...dependency,
    scope: production.has(`${dependency.name}@${dependency.version}`) ? "runtime" : "build",
    direct: directRuntime.has(dependency.name) || directDevelopment.has(dependency.name),
  }))
  .sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));

const inventory = {
  schema: "gwenithic.third-party-inventory/1",
  source: {
    manifest: "package.json",
    lockfile: "pnpm-lock.yaml",
    package_manager: manifest.packageManager ?? "pnpm",
  },
  notes: [
    "This normalized inventory is generated from the frozen pnpm dependency graph and intentionally omits machine-local package paths.",
    "Electron's packaged LICENSE and LICENSES.chromium.html remain the detailed authority for Electron, Chromium, Node.js, and bundled runtime components.",
    "The win32-x64 Sharp package carries Apache-2.0 and LGPL-3.0-or-later terms because its distributed native body includes libvips-related components.",
  ],
  packages,
};

await fs.writeFile(
  path.join(root, "THIRD-PARTY-INVENTORY.json"),
  `${JSON.stringify(inventory, null, 2)}\n`,
  "utf8",
);

console.log(`Recorded ${packages.length} locked third-party package coordinates.`);
