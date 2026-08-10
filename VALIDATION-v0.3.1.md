# Gwenithic Gravity Well v0.3.1 — Public Release Validation

**Date:** 2026-08-09 EDT / 2026-08-10 UTC

**State:** public release; permission envelope approved and publication authorized by Gwen

v0.3.1 descends from the preserved v0.3.0 Continuous Observatory. The continuous-universe and exposure schemas remain at `0.3`. This candidate changes the carrying body, responsive controls, failure behavior, tests, documentation, and release evidence rather than the authored universe kernel.

## Automated source checks

- TypeScript: `tsc --noEmit` passed.
- Static/runtime-contract tests: 6 passed, 0 failed, including the public permission split and release-coordinate apertures.
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
- An ordinary 640 by 360 capture was loaded through the supported exposure schema and independently rerendered. Geometry matched. Repeated candidate runs were not byte-identical, but raw 8-bit channels converged with mean absolute difference from `0.00535` through `0.00564`, maximum difference `8`, and 3,856 through 4,025 differing channels among 921,600. The smoke gate permits mean difference at most `0.05` and maximum difference at most `16`.
- Static inspection found no application `fetch`, WebSocket, EventSource, XMLHttpRequest, HTTP endpoint, Electron network request, or web-request hook. The only URL-shaped runtime source string was the XML namespace in the locally generated cursor SVG. This is static evidence of offline design, not a packet-level network trace.
- Release ZIP hash, byte length, clean source binding, UTC instant, compact time code, semantic version, public/internal ordinal pair, and Gwenithic Release Coordinate are recorded outside the archive so the archive does not attempt to contain its own hash.

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

Gwen approved the split public permission envelope and authorized publication on 2026-08-09. The release carries:

- MIT for Gwenithic-authored application source;
- CC BY 4.0 for Gwenithic-authored documentation and expressly marked exemplars;
- CC0 for schemas and generic fixtures;
- creator control for outputs unless their maker grants more;
- no trademark grant;
- original terms and notices for third-party bodies.

The public source, portable ZIP, checksum, release manifest, and site projection must agree before this record is treated as complete. Hosting through GitHub and OpenAI Sites is an infrastructure fact, not an expansion of the permission envelope.
