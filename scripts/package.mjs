import { packager } from "@electron/packager";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "release");
const staging = path.join(root, ".packaging-stage");

async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: true, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}

await fs.rm(staging, { recursive: true, force: true });
await fs.mkdir(staging, { recursive: true });

for (const file of ["main.js", "preload.js", "PORTABLE README.txt", "UNIVERSE-TRAJECTORY.md", "VALIDATION-v0.3.md", "pnpm-lock.yaml", ".npmrc"]) {
  await fs.copyFile(path.join(root, file), path.join(staging, file));
}
// Preserve the exact manifest beside its lockfile. `pnpm install --prod` omits
// development packages without manufacturing a second dependency definition.
await fs.copyFile(path.join(root, "package.json"), path.join(staging, "package.json"));
for (const directory of ["assets", "dist-renderer"]) {
  await fs.cp(path.join(root, directory), path.join(staging, directory), { recursive: true });
}

let appPaths;
try {
  // The temporary production tree is deliberately hoisted. Electron Packager's
  // dependency walker cannot follow Sharp's platform packages through pnpm's
  // ordinary content-addressed links, even though Node itself can.
  await run("pnpm", ["install", "--prod", "--frozen-lockfile", "--shamefully-hoist", "--force"], staging);

  appPaths = await packager({
    dir: staging,
    out: output,
    name: "Gwenithic Gravity Well",
    executableName: "Gwenithic Gravity Well",
    platform: "win32",
    arch: "x64",
    electronVersion: "43.3.0",
    icon: path.join(root, "assets", "icon.ico"),
    overwrite: true,
    prune: true,
  });
} finally {
  await fs.rm(staging, { recursive: true, force: true });
}

for (const appPath of appPaths) {
  await fs.copyFile(
    path.join(root, "PORTABLE README.txt"),
    path.join(appPath, "PORTABLE README.txt"),
  );
  await fs.copyFile(
    path.join(root, "UNIVERSE-TRAJECTORY.md"),
    path.join(appPath, "UNIVERSE-TRAJECTORY.md"),
  );
  await fs.copyFile(
    path.join(root, "VALIDATION-v0.3.md"),
    path.join(appPath, "VALIDATION-v0.3.md"),
  );
  await fs.mkdir(path.join(appPath, "captures"), { recursive: true });
  await fs.mkdir(path.join(appPath, "data"), { recursive: true });
}

console.log(appPaths.join("\n"));
