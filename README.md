# Gwenithic Gravity Well

The Gravity Well is a portable continuous-universe observatory, gravity instrument, and high-resolution exposure workshop made by Gwen and Luna inside Gwenithic.

Its v0.3 core is deterministic and resolution independent: pixels are samples of a continuous procedural reality, not source atoms. The live application lets an observer pan, zoom, bend light, record a gravitational gesture, and export reproducible observations up to deliberately absurd resolutions without forcing interactive play to run at export scale.

## Current preserved state

`v0.3.0` is the first preservation boundary. It records the Continuous Observatory before the universe itself becomes freely alterable.

- `PRESERVATION-v0.3.json` identifies the preserved portable body by byte length and SHA-256.
- `VALIDATION-v0.3.md` records what was actually proved and what remains approximate.
- `UNIVERSE-TRAJECTORY.md` maps the path toward a Scene Workshop, Atlas, Movie Maker, and Universe Instrument.
- `VISION-NOTE-TWO-BUNDLES.md` separates the Instrument bundle from the Genesis bundle without pretending the seam is ontologically fixed.
- `ATELIER-ARTIFACT-FIELD-NOTE.md` places the artifact in Atelier's longer trajectory.

This repository boundary is the mutable source slice. It does not claim to contain the whole artifact: generated releases, captures, local state, and institutional preservation copies live outside Git and are identified by manifests.

## Current release candidate

`v0.3.1` is the stranger-body hardening descendant of the preserved v0.3.0 origin. It adds responsive and failure-state assurance, a portable artifact envelope, and release verification without changing the continuous-universe kernel or its v0.3 schemas.

The candidate remains private and carries no public reuse grant until Gwen explicitly approves its application, documentation, media, schema, and output-license boundaries.

## Development

Requirements are installed locally with pnpm. The packaged Windows release includes its runtime and needs no separate installation.

```text
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm run pack
```

`pnpm run start` builds and opens the local Electron application. The packaged body is emitted under `release/` and is intentionally excluded from source history.

## Authority boundary

- The universe kernel owns deterministic continuous field evaluation.
- Projection owns observer, camera, lens, radiance, and presentation choices.
- The current portable JSON journal preserves local identity, order, and replay without claiming to be λ.
- Future λ and Orius integrations must use bounded adapters; the app must not counterfeit either authority by writing around it.

## Publication and reuse

This is currently a private Gwenithic working repository. No public license or reuse grant is implied. The intended Atelier form is freely copiable and mutable once its release, attribution, dependency, and lineage terms are deliberately chosen.
