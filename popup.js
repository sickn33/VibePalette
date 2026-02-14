/* ============================================
   VIBEPALETTE - POPUP SCRIPT (Orchestrator)
   Chrome Extension for Screen Color Extraction
   ============================================ */

/**
 * ============================================
 * CONFIGURATION & CONSTANTS
 * ============================================
 */
const CONFIG = {
  // Number of colors to extract from the screenshot
  COLOR_COUNT: 10,

  // Quality setting for ColorThief (1 = highest, 10 = fastest)
  EXTRACTION_QUALITY: 1,

  // Toast notification display duration (ms)
  TOAST_DURATION: 2000,

  // Thresholds for filtering out near-white/black colors
  WHITE_THRESHOLD: 240,
  BLACK_THRESHOLD: 20,

  // Maximum colors to request from ColorThief (extract many, then select best)
  MAX_EXTRACTION_COUNT: 60,

  // Minimum saturation to be considered a "colorful" color (0-1)
  MIN_SATURATION_COLORFUL: 0.08,

  // Bonus weight for saturated colors in selection (1.0 = no bonus)
  SATURATION_BONUS: 1.0,

  // Minimum distance between selected colors (lower = more similar colors allowed)
  MIN_COLOR_DISTANCE: 35,

  // Force hue diversity: ensure at least one color from major hue families if present
  FORCE_HUE_DIVERSITY: true,

  // Enable debug logging (set to false for production)
  DEBUG: false,

  // Grid sampling configuration
  GRID_COLS: 10,
  GRID_ROWS: 8,
  DARK_PIXEL_THRESHOLD: 25,
  BRIGHT_PIXEL_THRESHOLD: 245,
  DARK_RATIO_CUTOFF: 0.7,

  // Sky sampling configuration
  SKY_START_Y_RATIO: 0.15,
  SKY_END_Y_RATIO: 0.35,
};

/**
 * Debug logger
 */
const logger = {
  log: (...args) => CONFIG.DEBUG && console.log("[VibePalette]", ...args),
  warn: (...args) => CONFIG.DEBUG && console.warn("[VibePalette]", ...args),
  error: (...args) => console.error("[VibePalette]", ...args),
};

/**
 * ============================================
 * DOM ELEMENT REFERENCES
 * ============================================
 */
const DOM = {
  imageContainer: document.getElementById("image-container"),
  previewImage: document.getElementById("preview-image"),
  recaptureButton: document.getElementById("recapture-button"),
  paletteContainer: document.getElementById("palette-container"),
  colorGrid: document.getElementById("color-grid"),
  exportButton: document.getElementById("export-button"),
  copyPaletteButton: document.getElementById("copy-palette-button"),
  shareButton: document.getElementById("share-button"),
  loading: document.getElementById("loading"),
  errorState: document.getElementById("error-state"),
  toast: document.getElementById("toast"),
  // Settings elements
  settingsButton: document.getElementById("settings-button"),
  settingsOverlay: document.getElementById("settings-overlay"),
  settingsClose: document.getElementById("settings-close"),
  colorCountSlider: document.getElementById("color-count-slider"),
  colorCountValue: document.getElementById("color-count-value"),
  showHexInExport: document.getElementById("show-hex-in-export"),
};

/**
 * ============================================
 * SHARED RESOURCES
 * ============================================
 */
const sharedCanvas =
  typeof document !== "undefined" ? document.createElement("canvas") : null;
const sharedCtx = sharedCanvas
  ? sharedCanvas.getContext("2d", { willReadFrequently: true })
  : null;
const colorThief = typeof ColorThief !== "undefined" ? new ColorThief() : null;

/**
 * ============================================
 * STATE - Current extracted palette
 * ============================================
 */
let currentPalette = [];
let cachedFilteredPalette = [];

/**
 * ============================================
 * UI UTILITIES
 * ============================================
 */

function showToast(message = "Palette Updated") {
  const toastText = DOM.toast.querySelector(".toast-text");
  if (toastText) toastText.textContent = message;

  DOM.toast.classList.remove("hidden");
  DOM.toast.classList.add("show");

  setTimeout(() => {
    DOM.toast.classList.remove("show");
    setTimeout(() => DOM.toast.classList.add("hidden"), 250);
  }, CONFIG.TOAST_DURATION);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    logger.error("Failed to copy to clipboard:", err);
    return false;
  }
}

// Make copyToClipboard global for other modules
window.copyToClipboard = copyToClipboard;

function showLoadingState() {
  DOM.imageContainer.classList.add("hidden");
  DOM.paletteContainer.classList.add("hidden");
  DOM.errorState.classList.add("hidden");
  DOM.loading.classList.remove("hidden");
}

function showResultState() {
  DOM.loading.classList.add("hidden");
  DOM.errorState.classList.add("hidden");
  DOM.imageContainer.classList.remove("hidden");
  DOM.paletteContainer.classList.remove("hidden");
}

function showErrorState(message = "Cannot capture this page") {
  DOM.loading.classList.add("hidden");
  DOM.imageContainer.classList.add("hidden");
  DOM.paletteContainer.classList.add("hidden");
  DOM.errorState.classList.remove("hidden");
  const errorText = DOM.errorState.querySelector(".error-text");
  if (errorText) errorText.textContent = message;
}

/**
 * ============================================
 * PALETTE RENDERING
 * ============================================
 */

function createColorBlock(rgb) {
  const ColorUtils = window.ColorUtils;
  const Settings = window.Settings;
  const hex = ColorUtils.rgbToHex(rgb[0], rgb[1], rgb[2]);
  const displayValue = ColorUtils.formatColor(
    rgb,
    Settings.SETTINGS.colorFormat,
  );
  const colorName = ColorUtils.getColorName(rgb);

  const block = document.createElement("div");
  block.className = "color-block";
  block.setAttribute("data-rgb", JSON.stringify(rgb));
  block.setAttribute("title", `${colorName}\n${displayValue}\nClick to copy`);

  const swatch = document.createElement("div");
  swatch.className = "color-swatch";
  swatch.style.backgroundColor = hex;

  const nameLabel = document.createElement("span");
  nameLabel.className = "color-name";
  nameLabel.textContent = colorName;

  const valueLabel = document.createElement("span");
  valueLabel.className = "color-hex";
  valueLabel.textContent = displayValue;

  block.appendChild(nameLabel);
  block.appendChild(swatch);
  block.appendChild(valueLabel);

  block.addEventListener("click", async () => {
    const ColorUtils = window.ColorUtils;
    const Settings = window.Settings;
    const currentDisplayValue = ColorUtils.formatColor(
      rgb,
      Settings.SETTINGS.colorFormat,
    );
    const success = await copyToClipboard(currentDisplayValue);
    if (success) showToast(`${currentDisplayValue} copied!`);
  });

  return block;
}

function renderPalette(palette) {
  currentPalette = palette;
  DOM.colorGrid.innerHTML = "";
  palette.forEach((color) => {
    const block = createColorBlock(color);
    DOM.colorGrid.appendChild(block);
  });
}

function updateColorLabels() {
  const ColorUtils = window.ColorUtils;
  const Settings = window.Settings;
  const blocks = document.querySelectorAll(".color-block");
  blocks.forEach((block) => {
    const rgbData = block.getAttribute("data-rgb");
    if (rgbData) {
      try {
        const rgb = JSON.parse(rgbData);
        const label = block.querySelector(".color-hex");
        if (label) {
          const displayValue = ColorUtils.formatColor(
            rgb,
            Settings.SETTINGS.colorFormat,
          );
          label.textContent = displayValue;
          block.setAttribute("title", `Click to copy ${displayValue}`);
        }
      } catch (err) {
        logger.error("Failed to parse RGB data:", err);
      }
    }
  });
}

/**
 * ============================================
 * IMAGE PROCESSING
 * ============================================
 */

function extractAndRenderColors(img) {
  try {
    const ColorUtils = window.ColorUtils;
    const Settings = window.Settings;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    sharedCanvas.width = imgWidth;
    sharedCanvas.height = imgHeight;
    sharedCtx.drawImage(img, 0, 0);

    // DELEGATE EXTRACTION TO COLOR-UTILS
    // This allows simulation testing (without browser).
    const allColors = ColorUtils.extractPalette(
      sharedCtx,
      imgWidth,
      imgHeight,
      CONFIG,
    );

    const deduplicated = ColorUtils.deduplicateColors(allColors, 20);
    let filtered = ColorUtils.filterExtremeColors(
      deduplicated,
      CONFIG.WHITE_THRESHOLD,
      CONFIG.BLACK_THRESHOLD,
    );
    if (filtered.length < Settings.SETTINGS.colorCount) filtered = deduplicated;

    cachedFilteredPalette = filtered;
    const finalPalette = ColorUtils.selectDiversePalette(
      filtered,
      Settings.SETTINGS.colorCount,
      {
        minSaturationColorful: CONFIG.MIN_SATURATION_COLORFUL,
        minColorDistance: CONFIG.MIN_COLOR_DISTANCE,
        logger,
      },
    );

    renderPalette(finalPalette);
    Settings.savePaletteToHistory(finalPalette, logger);
    showResultState();
  } catch (error) {
    logger.error("Error extracting colors:", error);
    showErrorState("Error extracting colors");
  }
}

function reselectFromCache() {
  const ColorUtils = window.ColorUtils;
  const Settings = window.Settings;
  if (cachedFilteredPalette.length === 0) return;
  const finalPalette = ColorUtils.selectDiversePalette(
    cachedFilteredPalette,
    Settings.SETTINGS.colorCount,
    {
      minSaturationColorful: CONFIG.MIN_SATURATION_COLORFUL,
      minColorDistance: CONFIG.MIN_COLOR_DISTANCE,
      logger,
    },
  );
  renderPalette(finalPalette);
}

function captureScreenshot() {
  showLoadingState();
  chrome.runtime.sendMessage({ action: "captureScreen" }, (response) => {
    if (chrome.runtime.lastError) {
      logger.error("Runtime error:", chrome.runtime.lastError.message);
      showErrorState("Cannot capture this page");
      return;
    }
    if (!response || response.error) {
      logger.error(
        "Capture error:",
        response ? response.error : "No response from background",
      );
      showErrorState("Cannot capture this page");
      return;
    }
    DOM.previewImage.src = response.dataUrl;
    DOM.previewImage.onload = () => {
      setTimeout(() => {
        extractAndRenderColors(DOM.previewImage);
      }, 50);
    };
    DOM.previewImage.onerror = () => {
      logger.error("Error loading screenshot");
      showErrorState("Error loading screenshot");
    };
  });
}

/**
 * ============================================
 * ORCHESTRATION & EVENT HANDLERS
 * ============================================
 */

function init() {
  const Settings = window.Settings;
  const Export = window.Export;

  // 1. Settings listeners
  if (DOM.settingsButton) {
    DOM.settingsButton.addEventListener("click", () => {
      DOM.settingsOverlay.classList.remove("hidden");
      setTimeout(() => DOM.settingsOverlay.classList.add("show"), 10);
    });
  }
  if (DOM.settingsClose) {
    DOM.settingsClose.addEventListener("click", () => {
      DOM.settingsOverlay.classList.remove("show");
      setTimeout(() => DOM.settingsOverlay.classList.add("hidden"), 100);
    });
  }
  if (DOM.colorCountSlider) {
    DOM.colorCountSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      Settings.SETTINGS.colorCount = val;
      if (DOM.colorCountValue) DOM.colorCountValue.textContent = val;
      Settings.saveSettings(logger);
      reselectFromCache();
    });
  }
  document.querySelectorAll('input[name="color-format"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      Settings.SETTINGS.colorFormat = e.target.value;
      Settings.saveSettings(logger);
      updateColorLabels();
    });
  });
  document.querySelectorAll('input[name="export-format"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      Settings.SETTINGS.exportFormat = e.target.value;
      Settings.saveSettings(logger);
      const opt = document.getElementById("image-export-options");
      if (opt) opt.style.display = e.target.value === "png" ? "block" : "none";
    });
  });
  if (DOM.showHexInExport) {
    DOM.showHexInExport.addEventListener("change", (e) => {
      Settings.SETTINGS.showHexInExport = e.target.checked;
      Settings.saveSettings(logger);
    });
  }
  document.querySelectorAll('input[name="theme"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      Settings.SETTINGS.theme = e.target.value;
      Settings.saveSettings(logger);
      Settings.applyTheme();
    });
  });

  // 2. Action buttons
  DOM.recaptureButton.addEventListener("click", (e) => {
    e.stopPropagation();
    captureScreenshot();
  });
  DOM.exportButton.addEventListener("click", () =>
    Export.exportPalette(currentPalette, Settings.SETTINGS, DOM, showToast),
  );
  if (DOM.copyPaletteButton) {
    DOM.copyPaletteButton.addEventListener("click", async () => {
      if (currentPalette.length === 0) {
        showToast("No palette to copy");
        return;
      }
      const ColorUtils = window.ColorUtils;
      const colors = currentPalette.map((rgb) =>
        ColorUtils.formatColor(rgb, Settings.SETTINGS.colorFormat),
      );
      if (await copyToClipboard(colors.join("\n")))
        showToast(`${colors.length} colors copied!`);
    });
  }
  if (DOM.shareButton) {
    DOM.shareButton.addEventListener("click", () => {
      const ColorUtils = window.ColorUtils;
      Export.sharePalette(
        currentPalette,
        ColorUtils,
        copyToClipboard,
        showToast,
      );
    });
  }

  // 3. Eyedropper
  DOM.previewImage.style.cursor = "crosshair";
  DOM.previewImage.addEventListener("click", async (e) => {
    if (
      !DOM.previewImage.src ||
      !DOM.previewImage.complete ||
      !sharedCanvas ||
      sharedCanvas.width === 0
    )
      return;
    const rect = DOM.previewImage.getBoundingClientRect();
    const scaleX = DOM.previewImage.naturalWidth / rect.width;
    const scaleY = DOM.previewImage.naturalHeight / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    const pixel = sharedCtx.getImageData(x, y, 1, 1).data;
    const rgb = [pixel[0], pixel[1], pixel[2]];
    const ColorUtils = window.ColorUtils;
    const val = ColorUtils.formatColor(rgb, Settings.SETTINGS.colorFormat);
    if (await copyToClipboard(val))
      showToast(`${ColorUtils.getColorName(rgb)}: ${val} copied!`);
  });

  // 4. Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    switch (e.key.toLowerCase()) {
      case "r":
        captureScreenshot();
        break;
      case "c":
        if (DOM.copyPaletteButton) DOM.copyPaletteButton.click();
        break;
      case "e":
        DOM.exportButton.click();
        break;
      case "s":
        DOM.settingsOverlay.classList.toggle("hidden");
        break;
      case "escape":
        DOM.settingsOverlay.classList.add("hidden");
        break;
    }
  });

  // 5. Initial Load
  Settings.loadSettings(logger).then(() => {
    Settings.loadPaletteHistory(logger);
    Settings.applySettingsToUI(DOM);
    captureScreenshot();
  });
}

if (typeof document !== "undefined" && typeof process === "undefined") {
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
}

// Export for Vitest
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CONFIG,
    SETTINGS: typeof Settings !== "undefined" ? Settings.SETTINGS : {},
    currentPalette: () => currentPalette,
  };
}
