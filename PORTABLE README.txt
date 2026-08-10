GWENITHIC GRAVITY WELL
Portable build 0.3.1 — Continuous Observatory release candidate

This folder is the application. No installation, account, network connection,
or separately installed runtime is required.

This candidate is not yet a public release. Read LICENSE-PENDING.md before
copying or redistributing it.

START
  Double-click "Gwenithic Gravity Well.exe".
  Keep the EXE and the rest of this folder together.

CONTROLS
  Mouse      Move the gravity well through the celestial field.
  O          Toggle Gravity Instrument / Observatory mode.
  Wheel      Zoom around the cursor in Observatory mode.
  Drag       Pan through the continuous field in Observatory mode.
  0          Return the observer to the home aperture.
  R          Begin or finish recording a gravity path.
  P          Play or stop the recorded path.
  Esc        Open or close the control surface.
  Spacebar   Capture the current clean scene when the control surface is closed.
  Alt+F4     Exit.

WINDOW MODES
  Windowed              Ordinary resizable desktop window.
  Borderless            Monitor-sized frameless window.
  Fullscreen            Exclusive-looking Electron fullscreen.

SCENE RESOLUTION VS. CAPTURE RESOLUTION
  Scene resolution controls the continuously interactive canvas. Keep this at
  a comfortable size for immediate play.

  Capture scale controls the separately rendered observation. The source
  universe is a deterministic continuous field, not a bitmap. The exporter
  asks that field for fresh samples in small tiles at the requested output
  resolution; it does not enlarge the live canvas or an 8K source texture.
  A huge export may therefore take time without requiring live play to run at
  that size.

  Presets extend through 16K. Custom scene dimensions and custom capture scale
  are also available. Captures are limited to 65,535 pixels per side and about
  2.147 gigapixels. For reference, 4K at 16x is 61,440 x 34,560 pixels (about
  2.123 gigapixels). That is intentionally absurd. It may take a long time and
  produce a very large file.

  Extreme PNGs are assembled as a continuous scanline stream from shallow
  render tiles. The full image and the full set of decoded tiles never need to
  coexist in memory. Outputs above 240 megapixels therefore require PNG;
  JPEG and WebP remain available for smaller captures. WebP itself cannot
  exceed 16,383 pixels on either side.

CAPTURES
  Choose PNG, JPEG, or WebP in the Esc menu. PNG is the lossless default.
  The optional cursor is composited only after the clean scene is rendered.
  UI, menus, window borders, and progress messages are never part of the file.
  Output appears in this folder's "captures" directory.

  Every finished image also receives a ".gravity.json" exposure recipe. It
  records the exact universe seed, observer, well, time, radiance controls,
  timeline path, and output geometry. Use "Open exposure recipe" and "Render
  loaded recipe" in the Esc menu to reproduce that observation.

OBSERVATORY AND RADIANCE
  Observatory mode travels through one reality by center and magnification.
  Bookmarks preserve exact apertures. Exposure, spectral separation, and tone
  mapping alter the observation rather than the underlying field.

  Radiance is evaluated in linear light and then tone-mapped to the current
  honest 8-bit sRGB output. 16-bit PNG and EXR are trajectory work; this build
  does not manufacture fake precision by stretching 8-bit values.

GRAVITATIONAL CALLIGRAPHY
  Record a gravity gesture with R, play it with P, and choose 4–32 temporal
  samples in the Esc menu. Offline capture integrates those moments while live
  play remains immediate. This path/timeline substrate is the beginning of the
  scene workshop and movie maker.

  The exporter processes one tile at a time and can be cancelled from the Esc
  menu. Please leave ample free disk space for extreme exports.

PORTABILITY
  Settings are written to the local "data" folder beside the application.
  Captures and their recipes are written beside it. An explicitly saved
  universe journal lives in data/GravityWell.universe.json. This JSON is the
  portable local record; native λ/Orius integration is intentionally left to a
  bounded adapter rather than counterfeited by writing .otium files directly.

  UNIVERSE-TRAJECTORY.md describes the authority map and the path from this
  observatory to the scene workshop, atlas, and movie maker.

Made by Gwen and Luna inside Gwenithic. :3
