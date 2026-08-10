# Gravity Well to Atelier — First Public Artifact Plan

**Prepared:** 2026-08-09  
**Status:** execution map; not a publication authorization  
**Origin preserved:** Gravity Well v0.3.0 / Continuous Observatory  
**Immediate target:** a stable v0.3.1 stranger body and its first Atelier room

## 1. The outcome

A stranger arriving without an account should be able to:

1. understand enough of the Gravity Well to become curious;
2. touch a small live aperture on the web;
3. download a self-contained Windows body;
4. verify what they received;
5. play, observe, record, and make a reproducible exposure;
6. inspect the source and declared limits;
7. copy or fork it under explicit terms;
8. return an observation, instrument, or fork without surrendering ownership merely by showing it to Gwenithic.

That is sufficient to begin testing the "social field of Artifacts." It does not require a general social network, profiles, comments, ranking, arbitrary uploads, or an account system.

The first social primitive is lineage.

## 2. What already exists

The technical artifact is substantially ahead of its public boundary.

- v0.3.0 is frozen at Git tag `gravity-well-v0.3.0-preservation` and source commit `5962a02`.
- The preserved portable ZIP is content-addressed in `PRESERVATION-v0.3.json` and the workspace manifest.
- The Windows x64 application is self-contained and requires no installation, account, network connection, or separately installed runtime.
- The universe is deterministic, continuous, procedural, and resolution independent within its declared approximation boundaries.
- Live play is separated from tiled offline export.
- Captures already receive `.gravity.json` exposure recipes beside the image.
- Observer state, bookmarks, radiance controls, recorded gravity paths, replay, and temporal calligraphy are present.
- Extreme PNG export has completed at 30,720 by 17,280 without assembling the full image in memory.
- Type checking, runtime-contract tests, WebGL smoke paths, convergence evidence, deep-aperture evidence, and packaged-body validation are recorded in `VALIDATION-v0.3.md`.
- The source repository and the website repository are clean and protected remotely.

The principal missing pieces are public permission, stranger-facing release hygiene, large-blob delivery, a truthful Atelier page, and one bounded return path.

## 3. Preserve the origin; publish a descendant

v0.3.0 should remain untouched. It is the first preserved Continuous Observatory and the clean origin from which later forms depart.

The first public candidate should be **v0.3.1**, constrained to release fitness:

- responsive control-surface corrections;
- clean first-run and failure behavior;
- public quick-start and artifact documents;
- license and third-party notices;
- manifest/checksum generation;
- packaging and distribution corrections;
- tests and evidence needed for those changes.

No Genesis/Core feature work is required for v0.3.1. Multiple gravity bodies, alterable universe laws, the Slice Laboratory, the Atlas, and the Movie Maker remain later descendants. The public origin is allowed to be small.

## 4. Stranger-body hardening

### 4.1 Control surface

Treat the menu as an Instrument surface whose coordinates belong to the actual window, not the live scene or export framebuffer.

- Reproduce and correct any horizontal or vertical overflow at common window sizes and Windows display scales.
- Test at 1280 by 720, 1920 by 1080, 2560 by 1440, and 3840 by 2160 displays where available.
- Test Windowed, Borderless, and Fullscreen transitions.
- Keep every primary action keyboard reachable with visible focus.
- Preserve the clean hidden-cursor scene when the menu is closed.
- Ensure long paths, large dimensions, and warning text wrap without expanding the panel beyond the viewport.

### 4.2 First run and failure

- Detect unavailable WebGL or insufficient GPU viewport limits and show a plain explanation instead of a black or broken surface.
- Keep safe initial live resolution independent of monitor resolution.
- Confirm that settings and captures are written only inside the portable body.
- If the folder is not writable, explain how to move/extract it rather than failing silently.
- Confirm that the application makes no network connection during ordinary use.
- Provide an obvious reset to the preserved home aperture.

### 4.3 Packaging

- Build from the frozen lockfile in a clean staging body.
- Include the public quick start, artifact manifest, licenses, third-party notices, known limits, validation record, and trajectory note.
- Exclude development caches, source secrets, local Chromium state, prior captures, and Gwenithic private working context.
- Preserve empty writable `captures/` and `data/` directories.
- Generate SHA-256 and byte length after the final ZIP exists.
- Record which source commit and renderer version produced it.

### 4.4 Clean-machine proof

The candidate is not stranger-ready until an extracted copy is tested from a path that has no inherited application state.

Proof should cover:

- launch without installation or administrator rights;
- first interaction and Escape menu;
- all display modes;
- one ordinary PNG capture and sidecar;
- one large tiled capture or bounded automated equivalent;
- saved recipe reload and deterministic rerender;
- clean exit and relaunch;
- useful behavior offline;
- no writes outside the portable folder other than unavoidable operating-system records;
- checksum agreement between the tested ZIP and published body.

The initial release will probably be unsigned and may encounter Windows reputation warnings. Do not disguise that. Either obtain code signing or document the exact unsigned state, checksum, source relationship, and verification procedure plainly.

## 5. Public permission boundary

No current file grants reuse. "Freely copiable and mutable" must become an explicit legal affordance before public release.

Recommended starting split, subject to Gwen's approval:

- **Application source:** MIT License for low-friction copying, mutation, embedding, and redistribution.
- **Bundled Gwenithic documentation and curated exemplar media:** Creative Commons Attribution 4.0, preserving provenance without requiring derivatives to remain alike.
- **Artifact manifest schema and example recipes:** CC0, so lineage machinery can be implemented anywhere without permission friction.
- **User-created captures, recipes, scenes, and forks:** owned by their makers unless they explicitly choose a publication license.
- **Third-party runtimes and dependencies:** retain their original licenses and required notices; they are not relicensed by Gwenithic.

Before approval:

1. inventory icons, fonts, dependencies, bundled runtime notices, and exemplar imagery;
2. confirm that no Auraspace or private reference material enters the public body;
3. scan the repository and packaged files for credentials, personal paths, account identifiers, and private provenance;
4. state attribution expectations in ordinary language beside the legal files;
5. decide whether the current one-commit private repository becomes public or feeds a curated public mirror.

The existing private repository is a promising public source body because its preserved history is narrow. Visibility remains an explicit publication decision, not an implementation detail.

## 6. Artifact envelope v0

The website must not become the only authority for Artifact 0001. A release should carry enough identity and evidence to survive away from the site.

Proposed envelope:

```text
Gravity-Well-v0.3.1/
  ARTIFACT.md
  QUICKSTART.txt
  artifact.json
  CHECKSUMS.txt
  LICENSE
  LICENSE-DOCS
  THIRD-PARTY-NOTICES/
  KNOWN-LIMITS.md
  VALIDATION.md
  recipes/
    home-aperture.gravity.json
    example-observation.gravity.json
  evidence/
    preview.jpg
    example-observation.png
  windows-x64/
    Gwenithic Gravity Well Portable v0.3.1.zip
```

The large Windows ZIP may be stored separately and addressed from the manifest rather than nested inside another ZIP. The semantic envelope and the binary body are joined by hash, length, version, and source coordinate—not by folder proximity alone.

Minimum `artifact.json` shape:

```json
{
  "schema": "gwenithic.artifact/0",
  "artifact_id": "gwenithic.atelier.gravity-well",
  "version": "0.3.1",
  "title": "The Gwenithic Gravity Well",
  "kind": "interactive-generative-instrument",
  "lineage": {
    "relation": "descends-from",
    "parents": ["gwenithic.atelier.gravity-well@0.3.0"]
  },
  "doors": ["observe", "carry", "inspect", "reproduce", "copy", "fork", "return"],
  "bodies": [],
  "recipes": [],
  "evidence": [],
  "licenses": {},
  "known_limits": []
}
```

The public manifest should be generated from verified inputs where possible, schema-validated in both repositories, and treated as artifact metadata—not as the universe itself.

## 7. Website shape

The current website already has an Observatory, an institutional Working Record, Gwenithica, and an Inner Entrance. The Atelier should become a distinct room without making those rooms collapse into one register.

### 7.1 Route semantics

Recommended first routes:

- `/atelier` — a small Atelier threshold and catalog; initially one living Artifact.
- `/atelier/gravity-well` — the Gravity Well's public artifact page.
- `/artifacts/record-0001` — preserve the existing stable route for the institutional Working Record.

The duplicate number is acceptable only when the types remain explicit:

- **Gwenithic Working Record 0001** is an institutional trace.
- **Atelier Artifact 0001** is an instrumentable world.

Do not allow a generic `artifact 0001` label to make them look like members of one undifferentiated sequence.

### 7.2 Gravity Well page

The page should offer several depths without requiring every visitor to absorb all of them:

1. **Encounter** — a small live aperture or faithful motion threshold that can be understood by moving the cursor.
2. **What this is** — two plain paragraphs and the declared limits.
3. **Carry it away** — Windows download, size, platform, checksum, unsigned/signed status, no-account/offline statement.
4. **Inspect the body** — source, artifact manifest, licenses, validation, and known limits.
5. **Reproduce an observation** — one exemplar image paired with its recipe.
6. **Make it yours** — copy/fork instructions and the distinction between an observation, instrument, and changed universe.
7. **Return a trace** — the first bounded contribution path.
8. **Lineage** — origin, current version, and later children without declaring one view canonical.

The existing homepage Gravity Well may serve as the first web aperture if it is labeled as a related threshold rather than silently presented as byte-identical to the portable universe. A later pass can extract the v0.3 universe kernel into a shared browser package and make the web body genuinely recipe-compatible.

### 7.3 Distribution storage

The 251 MB portable body should not be committed into the site repository or treated as an ordinary static asset.

Use Sites object storage for large public bodies:

- add one R2 binding for immutable release blobs;
- leave D1 absent for the first release because the catalog can remain checked-in structured data;
- address releases by artifact/version and verify hashes before publication;
- provide stable content type, filename, length, checksum, and cache behavior;
- retain old immutable versions after a new version appears;
- keep searchable metadata and the artifact page in source control.

D1 becomes appropriate only when the public field gains durable profiles, submissions, comments, moderation state, or searchable lineage that should not be managed as reviewed source changes.

## 8. The first social experiment

Do not begin by accepting arbitrary executables from the public internet.

Begin with a bounded, account-free return loop:

1. A person downloads or encounters the Gravity Well.
2. They make one of three returnable bodies:
   - an **observation**: image plus `.gravity.json` recipe;
   - an **instrument**: a declared observer/radiance/path recipe that can be applied to the same core;
   - a **fork**: changed source or universe state with a parent coordinate and chosen license.
3. A plain `RETURN.md` explains how to send it privately and how to specify:
   - desired name or anonymity;
   - whether Gwenithic may inspect it privately;
   - whether it may be published;
   - attribution and license;
   - whether it should be treated as an observation, fork, composition, or uncertain relation.
4. Gwenithic validates the body manually.
5. With explicit permission, the site publishes a small child card in the Atelier showing lineage and a door to the returned body.

This tests the important questions before automating them:

- Do strangers understand what they can change?
- Do recipes actually travel?
- Are the lineage words usable in practice?
- Does the artifact provoke creation rather than only admiration?
- Can Gwenithic present another maker without absorbing them?
- What moderation, identity, and storage needs appear from reality?

The first returned body can come from Joey or another invited stranger, but the invitation should be to play freely—not to produce a predetermined form of feedback.

## 9. Execution flights

### Flight A — Public candidate branch

1. Branch from the preserved v0.3.0 commit.
2. Reproduce the control-surface/window issue across display sizes and correct it.
3. Add first-run and WebGL failure surfaces where validation exposes gaps.
4. Add stranger-facing documentation stubs and release-manifest generation.
5. Keep the universe kernel unchanged unless a release-blocking defect is proved.
6. Run typecheck, tests, packaging, and clean-body smoke validation.

**Exit:** a local v0.3.1 release candidate that is safer to hand to a stranger, but not publicly licensed or uploaded.

### Flight B — Permission and envelope

1. Complete dependency/media/license inventory.
2. Present the recommended license split to Gwen for approval.
3. Finalize `artifact.json`, quick start, limits, notices, checksums, exemplar recipes, and evidence.
4. Build and hash the approved portable ZIP.
5. Freeze a new source commit/tag and preservation record without altering v0.3.0.

**Exit:** a self-describing artifact body with explicit rights and reproducible provenance.

### Flight C — Atelier room and distribution

1. Add R2 release storage to the site.
2. Upload the immutable v0.3.1 body and verify it by hash.
3. Build `/atelier` and `/atelier/gravity-well` in the site's existing world.
4. Add a faithful lightweight encounter, clear download door, evidence, lineage, and return instructions.
5. Validate signed-out desktop/mobile behavior, keyboard/touch interaction, build, and production download.
6. Deploy without advertising broadly.

**Exit:** a stranger can encounter, carry, verify, and understand the artifact from `gwenithic.com` without an account.

### Flight D — First returned trace

1. Invite one person without prescribing the desired response.
2. Observe their first-run and return experience separately from their aesthetic reaction.
3. Validate one returned observation, instrument, or fork.
4. Publish it only with explicit words, limits, attribution, and permission.
5. Record what the manual process taught us before designing automated social machinery.

**Exit:** the Atelier shows one real relation produced by another participant, not a mocked social feature.

### Flight E — Shared living web body

1. Extract the continuous universe evaluator into a bounded browser-compatible package.
2. Use the same recipe schema in Electron, offline export, and the web aperture.
3. Add conformance fixtures so the bodies agree within declared projection tolerances.
4. Allow a web observation recipe to open in the portable app and vice versa.

**Exit:** the site is another truthful instrument on the same artifact rather than a visual advertisement for it.

## 10. Acceptance gate for public Artifact 0001

The first release is ready when all are true:

- v0.3.0 remains recoverable and unmodified.
- The v0.3.1 candidate source, binary, manifest, checksum, and evidence agree.
- A clean Windows x64 body launches and produces a reproducible capture offline.
- Common window sizes and display modes keep the control surface usable.
- Unsupported hardware receives a useful explanation.
- No credential, private path, account identity, Auraspace body, or local working context travels.
- Application, documentation, exemplar media, dependencies, and user outputs have legible permission boundaries.
- The unsigned or signed state is stated plainly.
- The site download completes from a signed-out browser and matches its published SHA-256.
- The page distinguishes live encounter, portable body, source, evidence, and lineage.
- No account is required to observe, download, inspect, reproduce, copy, or fork.
- The return path asks permission before inspection or publication.
- One outsider can use it without Gwen or Luna narrating every control.

## 11. What not to build before this release

- General profiles, feeds, likes, recommendation systems, or engagement scores.
- Public executable uploads.
- Automatic claims that two artifacts are continuations or the same Thing.
- A giant cockpit for Genesis parameters.
- Native lambda or Orius integration performed only for branding symmetry.
- A database made canonical before the artifact envelope travels on its own.
- A polished Workshop dialect manufactured to look worked in.
- A replacement of v0.3.0 by a more ambitious descendant.

## 12. Immediate next pass

The next execution pass can begin Flight A without a public-action decision:

1. create the v0.3.1 candidate branch;
2. add automated viewport/control-surface coverage and reproduce the visible edge cases;
3. implement the responsive correction and plain failure states;
4. scaffold the public artifact manifest, quick start, limits, return form, and checksum builder;
5. package and validate a local release candidate;
6. stop before granting a public license, changing repository visibility, provisioning R2, uploading a binary, or deploying the site.

That gives Gwen a concrete body to approve rather than asking her to approve an abstraction.

The Gravity Well does not need to become everything before another person can enter it.

It needs a truthful door, a body that travels, and enough lineage that changing it does not erase where the change began.

