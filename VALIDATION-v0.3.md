# Gwenithic Gravity Well v0.3 — Validation Record

Date: 2026-08-09

## Automated checks

- TypeScript: `tsc --noEmit` passed.
- Static/runtime-contract tests: 4 passed, 0 failed.
- WebGL initialization and ordinary tiled export: passed.
- Versioned exposure recipe sidecar: written beside the rendered image and schema-checked.
- Eight-sample calligraphy export: passed through the temporal tile path.
- Esc control surface: rendered successfully in the packaged Chromium surface.
- Extreme streaming PNG path: a 30,720 × 17,280 continuous-universe observation completed in 22.2 seconds in the source smoke harness; the full image was never assembled in memory.

## Resolution convergence

The same seed, observer, well, time, and radiance recipe was rendered at:

- 640 × 360
- 2560 × 1440

The larger observation was reconstructed to 640 × 360 with a Lanczos filter and compared in 8-bit RGB:

- Mean absolute error: 1.2557 channel levels out of 255
- Mean squared error: 41.7608
- PSNR: 31.923 dB

This is not asserted to be pixel identity: each direct render integrates a different pixel footprint, and the comparison filter is part of the observation. The result verifies convergence without a fixed source bitmap. The renderer contains no `texImage2D` source-field upload.

Evidence:

- `test-artifacts/resolution-proof-4x-downsample.png`
- `captures/GravityWell_2026-08-09_18-11-15-932_640x360.png`
- `captures/GravityWell_2026-08-09_18-11-17-116_2560x1440.png`

## Deep aperture

A 96× observer aperture at world center `(0.786, 0.558)` rendered a newly evaluated local stellar hierarchy and orbit segment without exposing raster source pixels.

Evidence: `captures/GravityWell_2026-08-09_18-07-42-379_640x360.png`

## Deliberate limits

- Output is currently 8-bit sRGB. Light is authored in a linear working space and tone-mapped before output; half-float buffers, 16-bit PNG, and EXR are not yet implemented.
- v0.3 temporal calligraphy accumulates tone-mapped samples in the browser composition surface. It is a deterministic visual exposure, not yet a physically linear radiance integral.
- The portable JSON journal follows λ identity/order/projection laws but is not λ. Native λ integration requires the bounded adapter described in `UNIVERSE-TRAJECTORY.md`.
- JSON exposure/universe records are not Orius orecs. No `.otium` file is written around Orius’s protected writer.
- The scene workshop currently has one gravity instrument, one observer, one radiance rig, bookmarks, and one recorded path. Multiple bodies, semantic scene residents, curve editing, and frame-sequence/movie export are trajectory milestones.
