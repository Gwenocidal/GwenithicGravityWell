# Gravity Well v0.3.1 — Known Limits

This document travels with the candidate so its edges remain as visible as its strongest images.

## Platform and trust

- The packaged candidate targets Windows x64.
- It may be unsigned. Windows reputation or antivirus systems may warn about an unfamiliar executable. Verify the published SHA-256 and source coordinate; do not treat suppression of a warning as verification.
- The portable folder must remain writable for settings, captures, recipes, caches, and saved universe state.
- The live renderer requires WebGL and a compatible graphics driver. A plain failure surface appears when initialization cannot complete.

## Rendering

- Output is currently 8-bit sRGB.
- Light is evaluated in a linear working space and tone-mapped before output, but true half-float framebuffers, 16-bit PNG, and EXR are not implemented.
- Temporal calligraphy accumulates tone-mapped samples. It is deterministic visual integration, not yet a physically linear radiance integral.
- The universe is procedurally continuous and resolution independent within the declared evaluator and numerical precision. No claim of infinite computational precision is made.
- Direct renders at different resolutions integrate different pixel footprints and are expected to converge rather than remain pixel-identical.

## Size and performance

- Live dimensions are limited by the GPU's reported maximum viewport.
- Captures are limited to 65,535 pixels per side and approximately 2.147 gigapixels.
- WebP is limited to 16,383 pixels per side.
- Outputs above 240 megapixels require streaming PNG.
- Extreme exports may take minutes, require substantial free disk space, and produce files that ordinary image software cannot decode or display.
- Tiled export keeps live interaction separate from capture cost, but it cannot make storage bandwidth or PNG compression free.

## Current workshop depth

- There is one gravity instrument, one observer, one radiance rig, bookmarks, and one recorded path.
- Universe/Core parameters are not yet freely alterable through a Scene Workshop.
- Multiple bodies, semantic residents, constraints, curve editing, frame-sequence export, movie construction, the Atlas, and the Slice Laboratory remain trajectory work.
- The local JSON journal follows selected identity/order/projection principles but is not lambda.
- Saved JSON records are not Orius orecs and do not bypass Orius's protected writer.

## Publication

- v0.3.1 is currently a private release candidate.
- No public application, documentation, media, schema, or exemplar license is granted by this file.
- A future public release must replace the pending boundary with explicit approved terms and preserve third-party notices.

