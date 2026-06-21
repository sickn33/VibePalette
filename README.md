# VibePalette

**VibePalette 2.0.0** is a Chrome/Edge extension for capturing the current tab
and extracting polished, export-ready color palettes.

![VibePalette logo](icons/icon128.png)

## Features

- 📸 **Instant Capture**: Takes a screenshot of your current tab instantly.
- 🎨 **Real-image palette extraction**: Uses dominance-aware RGB bins, cell
  winners, corner sampling, and top-band sampling to avoid tiny saturated noise.
- 🧭 **Balanced palette selection**: Preserves meaningful color diversity without
  forcing irrelevant hue families.
- 🎬 **Cinematic Export**: Save palettes as framed image exports with balanced
  rows, readable labels, and optional color codes.
- 💻 **Dev-Friendly Exports**:
  - Copy palette colors
  - Share as a Coolors URL
  - Export as PNG, CSS custom properties, or JSON
- 🔧 **Customizable**:
  - Adjust color count (5-10)
  - Choose formats (HEX, RGB, HSL)
  - Auto, dark, and light themes
- ⌨️ **Keyboard Shortcuts**:
  - `R`: Recapture
  - `C`: Copy all colors
  - `E`: Export
  - `S`: Settings

## Installation

1. Clone this repository.
2. Open Chrome or Edge and navigate to `chrome://extensions/` or
   `edge://extensions/`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked**.
5. Select the `VibePalette` folder.

## Technologies

- **Vanilla JavaScript** (No heavy frameworks)
- **ColorThief + custom palette heuristics** (candidate extraction and ranking)
- **HTML5 Canvas** (for image processing)
- **Vitest & JSDOM** (for automated testing)
- **ImageMagick** (optional local dependency for real-image regression tests)

## Project Structure

- `background.js`: Extension background logic.
- `popup.*`: Main extension interface and capture flow.
- `settings.js`: Settings persistence and theme state.
- `export.js`: PNG, CSS, JSON, and share export helpers.
- `lib/`: Third-party dependencies.
- `fonts/`: Bundled export/UI fonts.
- `icons/`: Extension assets.
- `tests/`: Automated unit, popup, manifest, simulation, and real-image tests.
- `docs/`: Development logs and planning.

## Development

To run tests:

```bash
npm install
npm test
```

## Release

Current release: **2.0.0**.

See [CHANGELOG.md](CHANGELOG.md) for release notes.

MIT License.
