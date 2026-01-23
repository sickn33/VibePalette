import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock chrome API
global.chrome = {
  storage: {
    sync: {
      get: vi.fn(),
    },
    local: {
      get: vi.fn(),
    },
  },
  runtime: {
    lastError: null,
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
  },
};

// Mock ColorThief
global.ColorThief = vi.fn().mockImplementation(() => ({
  getPalette: vi.fn(),
}));

// Mock Navigator Clipboard
Object.defineProperty(global.navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(true),
  },
  configurable: true,
});

// Mock Canvas
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  drawImage: vi.fn(),
  getImageData: vi.fn().mockReturnValue({
    data: new Uint8ClampedArray([255, 0, 0, 255]),
  }),
  putImageData: vi.fn(),
});

// Mock DOM
document.body.innerHTML = `
  <div id="image-container"></div>
  <img id="preview-image" />
  <button id="recapture-button"></button>
  <div id="palette-container"></div>
  <div id="color-grid"></div>
  <button id="export-button"></button>
  <button id="copy-palette-button"></button>
  <button id="share-button"></button>
  <div id="loading"></div>
  <div id="error-state"><p class="error-text"></p></div>
  <div id="toast"><span class="toast-text"></span></div>
  <button id="settings-button"></button>
  <div id="settings-overlay"></div>
  <button id="settings-close"></button>
  <input id="color-count-slider" />
  <span id="color-count-value"></span>
  <input id="show-hex-in-export" type="checkbox" />
`;

// Helper to load popup.js
const loadPopup = async () => {
  // We need to bypass the immediate execution or wrap it
  await import("../popup.js");
};

const {
  loadSettings,
  SETTINGS,
  rgbToHex,
  getColorFamily,
} = require("../popup.js");

describe("VibePalette Core", () => {
  it("rgbToHex should convert correctly", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#FFFFFF");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(255, 0, 0)).toBe("#FF0000");
  });

  it("getColorFamily should identify families correctly", () => {
    // Red: 0-15, 345-360
    expect(getColorFamily({ h: 0, s: 1, l: 0.5 })).toBe("red");
    expect(getColorFamily({ h: 350, s: 1, l: 0.5 })).toBe("red");

    // Teal: 150-200
    expect(getColorFamily({ h: 180, s: 1, l: 0.5 })).toBe("teal");

    // Neutral: low saturation
    expect(getColorFamily({ h: 180, s: 0.05, l: 0.5 })).toBe("neutral");
  });

  it("initEyedropper should NOT create a new canvas on every click (Optimization)", async () => {
    const { initEyedropper } = require("../popup.js");
    initEyedropper();

    // Create a spy on document.createElement
    const spy = vi.spyOn(document, "createElement");

    // Simulate click on image
    const img = document.getElementById("preview-image");
    Object.defineProperty(img, "naturalWidth", {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(img, "naturalHeight", {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    img.src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    img.dispatchEvent(new MouseEvent("click", { clientX: 10, clientY: 10 }));

    // This assertion will FAIL with the current (reverted) code
    expect(spy).not.toHaveBeenCalledWith("canvas");
  });
});
