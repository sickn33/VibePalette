/**
 * VIBEPALETTE - SETTINGS & PERSISTENCE
 * Handles user preferences and palette history
 */

/**
 * ============================================
 * SETTINGS STATE - User preferences
 * ============================================
 */
const SETTINGS = {
  colorCount: 10,
  colorFormat: "hex", // 'hex', 'rgb', or 'hsl'
  exportFormat: "png", // 'png', 'css', or 'json'
  showHexInExport: true,
  theme: "system", // 'system', 'light', or 'dark'
};

const MAX_HISTORY_SIZE = 5;
const MIN_COLOR_COUNT = 5;
const MAX_COLOR_COUNT = 10;
let paletteHistory = [];

function clampSettings() {
  SETTINGS.colorCount = Math.max(
    MIN_COLOR_COUNT,
    Math.min(MAX_COLOR_COUNT, Number(SETTINGS.colorCount) || 10),
  );
}

/**
 * Load settings from Chrome storage
 */
async function loadSettings(logger = console) {
  try {
    const stored = await chrome.storage.sync.get(["vibepaletteSettings"]);
    if (stored && stored.vibepaletteSettings) {
      Object.assign(SETTINGS, stored.vibepaletteSettings);
      clampSettings();
    }
  } catch (error) {
    if (logger.warn)
      logger.warn("Could not load settings - using defaults:", error);
  }
}

/**
 * Save settings to Chrome storage
 */
async function saveSettings(logger = console) {
  try {
    clampSettings();
    await chrome.storage.sync.set({ vibepaletteSettings: SETTINGS });
  } catch (error) {
    if (logger.warn) logger.warn("Could not save settings:", error);
  }
}

/**
 * Apply current settings to UI elements
 */
function applySettingsToUI(DOM) {
  // Color count slider
  if (DOM.colorCountSlider) {
    DOM.colorCountSlider.value = SETTINGS.colorCount;
  }
  if (DOM.colorCountValue) {
    DOM.colorCountValue.textContent = SETTINGS.colorCount;
  }

  // Color format radio buttons
  const formatRadio = document.querySelector(
    `input[name="color-format"][value="${SETTINGS.colorFormat}"]`,
  );
  if (formatRadio) {
    formatRadio.checked = true;
  }

  // Export format radio buttons
  const exportRadio = document.querySelector(
    `input[name="export-format"][value="${SETTINGS.exportFormat}"]`,
  );
  if (exportRadio) {
    exportRadio.checked = true;
  }

  // Update image export options visibility
  const imageExportOptions = document.getElementById("image-export-options");
  if (imageExportOptions) {
    imageExportOptions.style.display =
      SETTINGS.exportFormat === "png" ? "block" : "none";
  }

  // Export options checkbox
  if (DOM.showHexInExport) {
    DOM.showHexInExport.checked = SETTINGS.showHexInExport;
  }

  // Theme radio buttons
  const themeRadio = document.querySelector(
    `input[name="theme"][value="${SETTINGS.theme}"]`,
  );
  if (themeRadio) {
    themeRadio.checked = true;
  }
  applyTheme();
}

/**
 * Apply theme to body
 */
function applyTheme() {
  document.body.classList.remove("theme-light", "theme-dark");
  if (SETTINGS.theme === "light") {
    document.body.classList.add("theme-light");
  } else if (SETTINGS.theme === "dark") {
    document.body.classList.add("theme-dark");
  }
}

/**
 * Load palette history from Chrome storage
 */
async function loadPaletteHistory(logger = console) {
  try {
    const stored = await chrome.storage.local.get(["vibepaletteHistory"]);
    if (stored && stored.vibepaletteHistory) {
      paletteHistory = stored.vibepaletteHistory;
    }
  } catch (error) {
    if (logger.warn)
      logger.warn(
        "Could not load palette history - using empty history:",
        error,
      );
    paletteHistory = [];
  }
}

/**
 * Save current palette to history
 */
async function savePaletteToHistory(currentPalette, logger = console) {
  if (currentPalette.length === 0) return;

  const entry = {
    timestamp: Date.now(),
    colors: currentPalette.slice(0, 5),
  };

  paletteHistory.unshift(entry);
  if (paletteHistory.length > MAX_HISTORY_SIZE) {
    paletteHistory = paletteHistory.slice(0, MAX_HISTORY_SIZE);
  }

  try {
    await chrome.storage.local.set({ vibepaletteHistory: paletteHistory });
  } catch (error) {
    if (logger.warn) logger.warn("Could not save palette history:", error);
  }
}

// Global namespace for extension use
if (typeof window !== "undefined") {
  window.Settings = {
    SETTINGS,
    loadSettings,
    saveSettings,
    applySettingsToUI,
    applyTheme,
    loadPaletteHistory,
    savePaletteToHistory,
    getPaletteHistory: () => paletteHistory,
    clampSettings,
  };
}

// Export for Vitest
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SETTINGS,
    loadSettings,
    saveSettings,
    applySettingsToUI,
    applyTheme,
    loadPaletteHistory,
    savePaletteToHistory,
    getPaletteHistory: () => paletteHistory,
    clampSettings,
  };
}
