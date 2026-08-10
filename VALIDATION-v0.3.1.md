# Gwenithic Gravity Well v0.3.1 — Release Candidate Validation

**Date:** 2026-08-09  
**State:** local stranger-body candidate; public permissions and publication remain unapproved

v0.3.1 descends from the preserved v0.3.0 Continuous Observatory. The continuous-universe and exposure schemas remain at `0.3`. This candidate changes the carrying body, responsive controls, failure behavior, tests, documentation, and release evidence rather than the authored universe kernel.

## Automated source checks

- TypeScript: `tsc --noEmit` passed.
- Static/runtime-contract tests: 5 passed, 0 failed.
- Electron UI smoke tests: 2 passed, 0 failed.
- The control surface remained inside the viewport with no horizontal panel, document, or visible-control overflow at 640 by 360, 800 by 600, 1280 by 720, 1920 by 1080, and 2560 by 1440 requested window sizes.
- A forced WebGL initialization failure produced the plain local failure surface with guidance, expandable technical detail, and an Exit action. The captured surface was inspected at 800 by 600.
- Production Vite renderer build passed.

## Packaged-body checks

- Frozen-lockfile production packaging passed with Electron 43.3.0 and the exact pnpm lockfile.
- Packaging now validates the complete source manifest against the lockfile before replacing it with a runtime-only manifest. This prevents the portable body from claiming absent development tools while preserving the exact source manifest separately as `SOURCE-package.json`.
- The packaged executable reports product/file version `0.3.1`.
- Required artifact-envelope documents, example recipe, exact source manifest, lockfile, Electron license, and Chromium notices were present beside the packaged body.
- Packaged WebGL startup passed from isolated smoke-test user data.
- Packaged control-surface geometry passed at 640 by 360 and 2560 by 1440 requested window sizes.
- Packaged forced renderer failure produced the expected readable failure surface.
- A 2560 by 1440 tiled PNG capture and exposure sidecar completed.
- An eight-sample 640 by 360 calligraphy exposure and sidecar completed.
- An ordinary 640 by 360 capture was loaded through the supported exposure schema and independently rerendered. Geometry matched. The two GPU/PNG passes were not byte-identical, but raw 8-bit channels converged with mean absolute difference `0.00535`, maximum difference `8`, and 3,856 differing channels among 921,600. The smoke gate permits mean difference at most `0.05` and maximum difference at most `16`.
- Static inspection found no application `fetch`, WebSocket, EventSource, XMLHttpRequest, HTTP endpoint, Electron network request, or web-request hook. The only URL-shaped runtime source string was the XML namespace in the locally generated cursor SVG. This is static evidence of offline design, not a packet-level network trace.
- Candidate ZIP hash, byte length, and clean source binding are recorded outside the archive by the release-candidate manifest so the archive does not attempt to contain its own hash.

Smoke teardown occasionally emitted Chromium's `GPU state invalid after WaitForGetOffsetInRange` after the test process had already reported a passing result and requested immediate exit. It did not appear as an application failure or during ordinary interactive use; retain it as a teardown observation rather than suppressing it from the record.

## Inherited v0.3 evidence

The following claims are inherited without being rerun merely because release documents changed:

- continuous procedural rendering with no uploaded source-field texture;
- 640 by 360 versus 2560 by 1440 convergence evidence;
- deep-aperture procedural detail at 96 times observer zoom;
- tiled capture and extreme streaming PNG assembly;
- versioned exposure sidecars;
- deterministic temporal calligraphy path.

The original measurements and deliberate approximation limits remain in `VALIDATION-v0.3.md`.

## Public boundary

Passing this validation does not authorize publication. The release candidate must still receive Gwen's approval for licenses, repository visibility, object storage, public upload, and deployment.
