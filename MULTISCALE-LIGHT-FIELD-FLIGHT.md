# Multiscale Light Field — Development Flight

Date: 2026-08-10  
Branch: `luna/multiscale-light-field`  
Renderer: `continuous-observatory-light-field-0.3.2`  
State: development body; not a public release

## The bite

This flight advances the marked **Multiscale matter** instrument without prematurely constructing the complete Scene Workshop.

The field is no longer populated by approximately uniform colored points and flat line rings. It now evaluates four related continuous laws:

- a deterministic matter field with inhabited clouds, filaments, and explicit voids;
- clustered stellar populations whose probability follows that field while sparse light remains in the voids;
- HDR stellar emitters with temperature, white-hot cores, aureoles, rare diffraction structure, and resolution-aware energy;
- orbit emitters with physical source widths, hot cores, colored falloff, knots, and broken arc concentrations.

Far, middle, near, and deep-zoom populations retain distinct seeds and scales. The gravity lens still samples them at different depths and along distinct red, green, and blue paths.

## A corrected composition law

During visual validation, the first implementation allowed stellar coverage to modulate unrelated surrounding haze. At low resolution, broadened star footprints therefore made the entire observation brighter than a reconstructed high-resolution observation.

The renderer now observes an opaque black universe. Coverage remains available to the gravitational caustic as evidence of light that can be borrowed, but final radiance is no longer multiplied by unrelated scene coverage.

Orbit sources also separate their physical width from the sampling footprint. A low-resolution pixel integrates a wider, proportionally dimmer estimate of the same narrow emitter rather than silently making the orbit physically thicker.

## Reproduction boundary

The visual law changed, so its renderer coordinate changed from `continuous-observatory-0.3` to `continuous-observatory-light-field-0.3.2`.

An exposure made by the earlier renderer may still contribute its observer state to this development body. The exact-render button remains disabled for that migrated recipe, and the interface states why. A new capture records a new interpretation under the new renderer coordinate. This prevents an old recipe from silently claiming exact replay through different physics.

## Validation

Passed:

- TypeScript typecheck;
- static contract suite: 6 passed, 0 failed;
- production Vite build;
- Electron/WebGL shader initialization;
- stranger-window layout and failure-surface suite;
- exact current-renderer recipe replay gate;
- 96× deep-aperture smoke capture.

Resolution convergence used the same seed, observer, well, time, and radiance state at 640 × 360 and 2560 × 1440. The larger image was reconstructed with Lanczos3 and compared in RGB:

- mean absolute error: 1.9359 channel levels out of 255;
- mean squared error: 54.5119;
- PSNR: 30.7659 dB;
- maximum single-channel difference: 246, localized around subpixel-bright features and the included cursor.

Evidence:

- `captures/GravityWell_2026-08-10_06-31-30-947_640x360.png`
- `captures/GravityWell_2026-08-10_06-31-47-929_2560x1440.png`
- `captures/GravityWell_2026-08-10_06-34-43-298_640x360.png`
- `test-artifacts/multiscale-light-field-convergence-diff.png`

The reusable comparison command is:

```text
pnpm compare:observations <low.png> <high.png> [difference.png]
```

## What this does not claim

- The matter field is not physically cosmological simulation.
- Stars are continuous analytic emitters in an artistic universe, not catalog-backed astronomical bodies.
- The Scene Workshop does not yet expose these Genesis laws as authored parameters.
- The current output remains tone-mapped 8-bit sRGB.
- A maximum-error statistic that includes cursor and subpixel caustics should not be mistaken for field-wide divergence.

## Next seam

The next clean seam is to move these hard-coded Genesis laws into a versioned `MatterState` owned by the universe recipe: cluster scale, void threshold, population density, filament energy, stellar brilliance, orbit population, and palette temperature. That is where the second Tensor Bundle begins becoming an actual instrument surface.

