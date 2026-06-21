# Changelog

## 2.0.0 - 2026-06-21

- Improved palette extraction with dominance-aware real-image sampling.
- Replaced family-first palette selection with weighted, distance-aware ranking.
- Added settings persistence, export helpers, bundled fonts, and MIT license.
- Added manifest, popup, simulation, and real-image regression coverage.
- Documented scikit-image fixture provenance for public test assets.
- Addressed PR review feedback for optional ImageMagick tests, settings overlay
  timing, PNG code-toggle behavior, dark-theme override, and Coolors share URLs.
- Tightened poster export quality by capping palettes at 10 colors, clamping
  saved color-count settings, filtering near-white artifacts, and cropping
  uniform image borders before rendering the collection.
- Verified with `npm test`, `npm audit --audit-level=moderate`, and an Edge
  unpacked-extension smoke test.

## 1.2.0

- Previous packaged extension version archived under `archives/`.
