# Third-Party Notice Map

This release is packaged with Electron, Chromium, Node.js, Sharp, libvips, and their transitive components.

The packaged application preserves the notices supplied by those bodies, including:

- `LICENSE` and `LICENSES.chromium.html` beside the executable;
- dependency license files inside the packaged application resources where supplied;
- dependency identities and exact versions in `package.json` and `pnpm-lock.yaml` in the source body.
- a normalized, path-free dependency map in `THIRD-PARTY-INVENTORY.json`.

The dependency inventory is generated from the frozen pnpm graph. It records build-time as well as runtime packages because the public source body permits others to reproduce the application. Electron's `LICENSE` and `LICENSES.chromium.html` remain the detailed authority for the large bundled runtime surface.

The win32-x64 Sharp body identifies its combined license expression as `Apache-2.0 AND LGPL-3.0-or-later`; the packaged native component and its supplied notices must remain intact. This file does not replace those terms.

No third-party notice expands or contracts the public terms for Gwenithic-authored source, documentation, schemas, icons, or exemplar media.
