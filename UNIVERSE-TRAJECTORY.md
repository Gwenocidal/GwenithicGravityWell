# Gwenithic Gravity Well — Universe Instrument Trajectory

## The invariant

The Gravity Well has one deterministic, continuous reality. Pixels are never its atoms.

A display, a camera, a screenshot, a tone map, and a long exposure are observations of that reality. They may omit, combine, distort, or reveal different aspects of it, but increasing the resolution must not expose a larger source bitmap underneath. The practical renderer may approximate an observation, and every approximation must be explicit; the scene itself remains resolution independent.

The ideal is not absent. It is inexhaustible.

## Authority map

| Concern | Authority | Meaning |
| --- | --- | --- |
| Identities, addresses, ordered mutations, provenance, replay | λ | Which continuing thing this is, where it is, and how it changed |
| Explicit saved scenes, exposures, workshops, and indexes | Orius | Human-readable durable records, written through Orius rather than around it |
| Continuous field evaluation | Gravity universe kernel | Deterministic functions evaluated at requested coordinates and times |
| Camera, viewport, lens, tone map, overlays | Projection | How one observer encounters the universe |
| WebGL/Electron | Instrument shell | Fast evaluation, interaction, compositing, and export; never semantic authority |

The portable app begins with a local event journal that follows the same identity/order/projection laws. It does **not** claim to be λ. A bounded adapter will translate universe commands into λ requests when the native runtime is present. Until Orius integration is live, saved recipes remain versioned JSON rather than counterfeit `.otium` files.

## Coordinate model

The authored universe uses continuous world coordinates, deterministic seeds, stable handles, and explicit time. Its evaluators are functions of world position, depth, wavelength, and time. Resolution enters only when an observer asks for samples.

The observer has a center, logarithmic zoom, aspect, and projection. A viewport is a finite aperture over that observer state. A 900-pixel preview and a 61,440-pixel export from the same recipe inspect the same region; the latter takes more samples. Zooming changes the region, not the ontology.

λ integration treats major scene residents, observers, tracks, and instruments as continuing things with stable handles. Integer λ addresses locate those semantic residents in a workspace. Their internal continuous parameters remain exact source owned by the relevant resident; λ’s grid address is not misused as a pixel coordinate.

## The five instruments

### 1. Observatory

Pan and exponential zoom through the live universe. Show world position, magnification, aperture, and time. Allow named bookmarks that restore an observer state exactly. At very deep zoom, more of the continuous procedural field becomes visible rather than enlarged source pixels.

### 2. Multiscale matter

Replace fixed raster star planes with deterministic analytic and procedural evaluators: hierarchical star populations, analytic orbit curves, haze, trajectories, core radiance, and lensing. Details are stable under tiling and independent of output resolution. Future evaluators may include particle catalogs, imported datasets, and λ-resident semantic objects without changing projection law.

**Current development flight:** `continuous-observatory-light-field-0.3.2` adds a deterministic cloud/filament/void population law, clustered HDR stellar emitters, and energy-aware orbit emitters. The implementation and convergence evidence are recorded in `MULTISCALE-LIGHT-FIELD-FLIGHT.md`. The next boundary is a versioned `MatterState` that moves these Genesis laws from shader constants into the alterable core bundle.

### 3. Reproducible exposures

Every capture receives a recipe containing scene version and seed, observer state, well state, time, radiance controls, path/timeline reference, output geometry, renderer version, and approximation notes. Recipes can be reloaded and replayed. A beautiful accident becomes an addressable observation rather than a lost gesture.

### 4. Radiance laboratory

Evaluate light in a linear working space, then apply explicit exposure and tone mapping for display. Bloom and spectral behavior belong to the observation recipe. The first pass remains SDR output with honest linear-light controls; true half-float buffers, 16-bit PNG, and EXR are a later renderer milestone and must not be imitated by inflating 8-bit values.

### 5. Gravitational calligraphy

Record the gravity well, observer, and parameter motion as timestamped tracks. Play, loop, trim, and expose over a selected interval. A long exposure integrates many moments of one deterministic scene. The same timeline is the foundation for stills, frame sequences, and the movie maker.

## Product trajectory

### v0.3 — Continuous Observatory

- Versioned `UniverseState` and append-only local command journal.
- Analytic procedural field with no fixed source-texture ceiling.
- Observer mode: pan, zoom, reset, coordinate/magnification HUD.
- Bookmarks and reproducible JSON exposure recipes.
- Linear exposure, spectral amount, and tone-map controls.
- Record/play a well path and integrate it into long-exposure export.
- Preserve tiled gigapixel PNG export and portable packaging.

Exit proof: downsampling a high-resolution observation converges with the lower-resolution observation within a declared reconstruction-filter tolerance; a deep zoom reveals stable new structure without bitmap stair-stepping; save/reload/replay returns the same state.

### v0.4 — Scene Workshop

- Multiple gravity bodies and scene residents with stable handles.
- Inspector, hierarchy, object transforms, constraints, and named parameter rigs.
- Timeline with keyframes, curves, trimming, looping, and camera tracks.
- Side-by-side observers and linked projections.
- Frame-sequence export with resumable manifests and deterministic distributed tiles.
- Native λ adapter for identity, command order, provenance, and replay.
- Orius adapter for explicit scene/exposure orecs through the protected writer.

Exit proof: move preserves a resident handle, copy creates one; timeline renders are deterministic; native and portable journals replay to an equivalent projection state.

### v0.5 — Atlas

- Google-Earth-like semantic scale ladder, bookmarks, tours, and layers.
- Gigapixel capture navigator with minimap, scale ruler, annotations, and crop export.
- Progressive level-of-detail for large catalogs and imported scientific fields.
- Search by object, event, observation, coordinate, and relation.
- Local collaborative annotations that follow semantic things rather than screen coordinates.

Exit proof: one can travel from universe view to a sub-pixel feature, retain orientation, and return by address or tour.

### v0.6 — Movie Maker

- Shot list, scene/camera cuts, transition grammar, onion skinning, and audio reference tracks.
- Offline supersampling, temporal accumulation, motion blur, and resumable render queue.
- Bundled encoder for portable MP4/WebM plus lossless image sequences.
- Reproducible production manifest containing every recipe and dependency.

Exit proof: a finished film can be regenerated from its workshop and manifests without relying on hidden UI state.

### v1.0 — Universe Instrument

- Pluggable deterministic universe laws and datasets.
- Multi-observer labs, comparison views, experiments, and explanation paths.
- λ as installed semantic/spatial authority; Orius as installed durable institutional memory.
- Portable sealed-workshop mode for travel, publication, and archival replay.
- Progressive assurance surfaces: what is authored, inferred, simulated, observed, verified, and exported remain visibly distinct.

## The restraint

The program should feel like Universe Sandbox, Google Earth, and a small observatory workshop—not like a cockpit made of sliders. Complexity is discovered by approach. A first encounter remains playful: move a little gravity through a luminous field. The larger system reveals itself through zoom, records, tracks, layers, and doors.

No view is the universe. Every good view teaches you how it is partial.
