# VibePalette 🎨

**VibePalette** is a Chrome Extension that lets you extract beautiful color palettes from any image or website on your screen.

<img src="icons/icon128.png" width="100" align="right" />

## Features

- 📸 **Instant Capture**: Takes a screenshot of your current tab instantly.
- 🎨 **Smart Extraction**: Uses a hue-diversity algorithm to find the most interesting colors, not just the most dominant ones.
- 🖼️ **Cinema-Style Export**: Save your palette as a beautiful image with color blocks (Wes Anderson style).
- 💻 **Dev-Friendly Exports**:
  - Copy as CSS Variables (`:root { --palette-1: #... }`)
  - Export as JSON
- 🔧 **Customizable**:
  - Adjust color count (5-15)
  - Choose formats (HEX, RGB, HSL)
  - Dark/Light mode support
- ⌨️ **Keyboard Shortcuts**:
  - `R`: Recapture
  - `C`: Copy all colors
  - `E`: Export
  - `S`: Settings

## Installation

1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked**.
5. Select the `VibePalette` folder.

## Technologies

- **Vanilla JavaScript** (No heavy frameworks)
- **ColorThief** (for base color extraction)
- **HTML5 Canvas** (for image processing)

## License

MIT
