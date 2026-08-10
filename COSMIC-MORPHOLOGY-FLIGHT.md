# Cosmic Morphology + Lunalisk Flight

Date: 2026-08-10  
Branch: `luna/multiscale-light-field`  
Renderer: `continuous-observatory-lunalisk-field-0.3.3`  
State: development body; not a public release

## Why this flight exists

The first multiscale light field improved individual stars and matter clustering, but its composition still behaved like a designed celestial diagram. Nine large structures shared approximately one center. Pulling away or approaching closely also revealed one attractive procedural texture sampled at different magnifications instead of a universe whose morphology changes with scale.

This flight treats those as one problem: the center and the surrounding universe must become observations of one causal body. The present implementation is a substantial move in that direction, not the completed resident hierarchy.

## The center is an encounter

The former nested orbit system, fixed luminous core, horizontal beam, and ruler-straight trajectories are gone.

The new resident is a phase defect inferred from four kinds of evidence:

- an asymmetric underdensity;
- a broken outer pressure wall;
- two occultation crescents;
- a narrow, internally fractured phase seam.

The crescent pair uses the triple-moon outline as an intentionally constructed but normally withheld symmetry prior, not as a glyph composited over the scene. The resident supplies two unequal crescents. When the movable well reaches the resident anchor, its horizon temporarily occupies the absent central moon. Lensing and independent RGB sample paths fracture that alignment further. Moving away removes the shared geometry; no permanent logo remains.

The result is deliberately not “the true Lunalisk.” It is the clearest projection this observer, scale, and instrument can presently make mutually legible.

## Morphology now changes category

The observer can pull back to `0.015625×`, eight times wider than the prior floor. Smooth logarithmic handoffs now connect four regimes:

| Regime | Governing morphology |
|---|---|
| Ultra-wide | Sparse web filaments, rare nodes, a macroscopic central void, and cluster-scale emitters |
| Projected sky | Heterogeneous galaxy populations: disks, edge-ons, irregular bodies, cores, arms, and occasional tidal tails |
| Regional | Molecular volume, extinction, carved cavities, compressed walls, clustered stars, and torn remnants |
| Deep | A deterministic hierarchy of new matter and stellar octaves, plus the resident’s narrow phase seam |

The regimes overlap instead of popping. The child populations remain analytic world-space laws, so tiled exports, arbitrary apertures, and resolution-independent evaluation still inspect one deterministic reality.

## What the reference field taught us

No external image is embedded in the renderer. Official astronomical imagery and visualization were used as morphological evidence:

- [NASA Webb First Deep Field](https://science.nasa.gov/asset/webb/webbs-first-deep-field-unveiled-nircam-image/) — a projected sky contains multiple source classes and morphologies, not interchangeable colored points.
- [NASA / Hubble cosmic-web mapping](https://science.nasa.gov/mission/hubble/science/science-highlights/mapping-the-cosmic-web/) — bright knots and long filaments occupy little volume; enormous voids are allowed to remain empty.
- [NASA Webb Cosmic Cliffs](https://science.nasa.gov/asset/webb/cosmic-cliffs-in-the-carina-nebula-nircam-and-miri-composite-image/) — illuminated boundaries and pillars are consequences of erosion and radiation, not generic fractal fog.
- [NASA Webb Tarantula Nebula](https://science.nasa.gov/asset/webb/tarantula-nebula-nircam-image/) — fullness and emptiness can be adjacent because energetic stellar populations excavate cavities and compress their walls.
- [NASA Webb Cassiopeia A](https://science.nasa.gov/asset/webb/cassiopeia-a-nircam-image/) — a remnant is a torn shell, knot population, interior cavity, and echo structure rather than a clean ring.
- [NASA Webb Stephan’s Quintet](https://science.nasa.gov/asset/webb/stephans-quintet-nircam-and-miri-composite-image/) — galaxy morphology carries encounter history through tails, shocks, bridges, and disturbed structure.

Those references informed rules, not imitation. This remains an artistic continuous universe, not a cosmological simulation or a catalog-backed sky.

## Color is an observation

Webb composites begin as monochromatic filtered observations whose wavelengths are mapped into visible color. NASA’s [full-color image explainer](https://science.nasa.gov/mission/webb/science-overview/science-explainers/how-are-webbs-full-color-images-made/) is the relevant epistemic boundary.

Accordingly, the default Gravity Well observation is now materially restrained: moon-white and warm-ivory stellar continua, smoke, iron/rust emission, quiet blue-white boundaries, and only residual violet. A strong color event must be caused by material response, a changed observation transform, or the active lens. Chroma permission rises near the well, where independent spectral paths actually disclose separation.

Diffraction structure remains rare because it belongs partly to an instrument, not to the intrinsic anatomy of every star.

## Causal grammar added in this flight

- Mature voids suppress populations instead of receiving a universal decorative star floor.
- Feedback bubbles exist only in a minority of candidate cells; tying eligibility to persistent local sources remains future Genesis work.
- A bubble removes local volume and permits only broken directional wall fragments to emit.
- Dense matter attenuates background and embedded sources differently.
- Remnant shells are angularly torn, radially displaced, knotted, and echoed.
- Stellar and galaxy populations each own stable rotations and translations, preventing a shared lattice from appearing at screen scale.
- Deep matter and stars hand off between adjacent deterministic octaves at power-of-two zoom boundaries.
- Ultra-wide structure is carried by long, domain-warped crossing ridges and an organic survival field; no screen-legible Voronoi scaffold is displayed.
- Zero population permission now produces zero candidates; mature voids no longer inherit a hidden minimum-density sprinkle.
- Unresolved galaxies, feedback walls, occultation crescents, and the phase seam broaden with conserved energy rather than becoming physically brighter at low resolution.
- The seam’s subpixel fracture pattern converges toward mean coverage when an observer cannot resolve it.
- Deep procedural frequency is capped before WebGL1 float coordinates become unable to represent its cells honestly.
- Scale laws compile as seven aperture-specific programs. The home program answers first instead of blocking startup on every scale the observer might someday visit.

## Validation evidence

- TypeScript, static contracts, production build, and Electron control-surface checks pass.
- All seven scale-program combinations compile on the current Windows/WebGL renderer.
- Capture recipe replay is byte-identical: zero differing channels across 921,600 compared channels.
- A 640×360 observation compared with the same 2560×1440 observation reconstructed through Lanczos3 measured mean absolute error `0.6097/255` and PSNR `33.6746 dB`. The comparison intentionally included the raster cursor and high-contrast stellar cores, so maximum single-pixel error is not treated as a physical convergence metric.
- Splitting scale compilation reduced the five-window control-surface run on this machine from roughly 120 seconds to roughly 28 seconds.

## Reproduction boundary

The visual law changed, so exact replay moved from `continuous-observatory-light-field-0.3.2` to `continuous-observatory-lunalisk-field-0.3.3`.

Older exposure recipes may still donate observer state to this body. They may not claim exact rendering through the new physics. A newly captured exposure records the new coordinate.

## What this does not claim

- The scale ladder is causally suggestive, not a unit-calibrated astrophysical model.
- A galaxy seen far away does not yet own persistent descendants that become its exact arms, clouds, and stars under arbitrary approach. That requires the future versioned `MatterState` and persistent resident hierarchy.
- The ultra-wide resident void and the regional phase defect are coordinated nested observations, but do not yet derive from one persistent resident state.
- Extinction remains an artistic screen-space approximation inside an additive radiance model.
- The triple-moon prior is a Gwenithic visual law, not an astronomical assertion.
- The current output remains tone-mapped 8-bit sRGB.
- The first visit to a scale program not yet compiled may still pause on some WebGL drivers. Non-blocking adjacent-regime prewarming is the next performance seam.

## Next clean seam

Move palette/bandpass, void maturity, filament survival, feedback rate, remnant history, and resident definitions into a versioned Genesis `MatterState`. The renderer has now demonstrated that these are distinct alterable laws rather than one inseparable “space background” shader.
