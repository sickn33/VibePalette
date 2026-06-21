# Findings - VibePalette

## Research & Discoveries

### Eyedropper Performance

- Currently, `initEyedropper` creates a new canvas and draws the full image on every click.
- _Insight_: We can probably keep a hidden reference canvas or use the existing preview image more effectively.
- _Solution_: Create a persistent helper canvas and update it only when `captureScreenshot` completes. Use this cached canvas for sampling.

### Storage Safety

- `chrome.storage.sync.get` can return empty objects if keys are missing.
- _Best Practice_: Always provide defaults.
- _Status_: Implemented resilience in `loadSettings` and `loadPaletteHistory`.

### Palette Extraction Quality

- The old hue-first sampling could overfit tiny saturated pixels.
- _Solution_: Use quantized RGB bins, global dominance scoring, cell winners,
  corner averages, and top-band sampling.
- _Status_: Covered by simulation tests and real-image fixtures
  (`coffee.png`, `astronaut.png`, `chelsea.png`, `rocket.jpg`).

### Release Hygiene

- Public release assets need explicit provenance and dependency checks.
- _Status_: v2.0.0 includes fixture license notes, `npm audit` verification,
  and an Edge unpacked-extension smoke test.

### Verification Results

- Eyedropper optimization: Verified that `sharedCtx` is reused. Sampling is now a single `getImageData` call per click.
- Storage resilience: Functions now gracefully handle `undefined` or null storage responses.
- v2.0.0 palette extraction: `npm test` passes 96 tests, including real-image
  regression tests.
- v2.0.0 browser smoke: Extension popup loads unpacked in Edge, scripts load,
  settings open, action labels render, and console errors are zero.
