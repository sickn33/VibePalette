/* ============================================
   VIBEPALETTE - POPUP SCRIPT
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
    // Lower = better sampling but slower
    EXTRACTION_QUALITY: 3,

    // Toast notification display duration (ms)
    TOAST_DURATION: 2000,

    // Thresholds for filtering out near-white/black colors
    WHITE_THRESHOLD: 240,
    BLACK_THRESHOLD: 20,

    // Maximum colors to request from ColorThief (extract many, then select best)
    MAX_EXTRACTION_COUNT: 40,

    // Minimum saturation to be considered a "colorful" color (0-1)
    MIN_SATURATION_COLORFUL: 0.15,

    // Bonus weight for saturated colors in selection
    SATURATION_BONUS: 1.5
};

/**
 * ============================================
 * DOM ELEMENT REFERENCES
 * ============================================
 */
const DOM = {
    imageContainer: document.getElementById('image-container'),
    previewImage: document.getElementById('preview-image'),
    recaptureButton: document.getElementById('recapture-button'),
    paletteContainer: document.getElementById('palette-container'),
    colorGrid: document.getElementById('color-grid'),
    exportButton: document.getElementById('export-button'),
    copyPaletteButton: document.getElementById('copy-palette-button'),
    shareButton: document.getElementById('share-button'),
    loading: document.getElementById('loading'),
    errorState: document.getElementById('error-state'),
    toast: document.getElementById('toast'),
    // Settings elements
    settingsButton: document.getElementById('settings-button'),
    settingsOverlay: document.getElementById('settings-overlay'),
    settingsClose: document.getElementById('settings-close'),
    colorCountSlider: document.getElementById('color-count-slider'),
    colorCountValue: document.getElementById('color-count-value'),
    showHexInExport: document.getElementById('show-hex-in-export')
};

/**
 * ============================================
 * COLOR THIEF INSTANCE
 * ============================================
 */
const colorThief = new ColorThief();

/**
 * ============================================
 * SETTINGS STATE - User preferences
 * ============================================
 */
const SETTINGS = {
    colorCount: 10,
    colorFormat: 'hex',  // 'hex', 'rgb', or 'hsl'
    exportFormat: 'png', // 'png', 'css', or 'json'
    showHexInExport: true,
    theme: 'system'      // 'system', 'light', or 'dark'
};

/**
 * Load settings from Chrome storage
 */
async function loadSettings() {
    try {
        const stored = await chrome.storage.sync.get(['vibepaletteSettings']);
        if (stored.vibepaletteSettings) {
            Object.assign(SETTINGS, stored.vibepaletteSettings);
        }
    } catch (error) {
        console.log('Could not load settings:', error);
    }
}

/**
 * Save settings to Chrome storage
 */
async function saveSettings() {
    try {
        await chrome.storage.sync.set({ vibepaletteSettings: SETTINGS });
    } catch (error) {
        console.log('Could not save settings:', error);
    }
}

/**
 * Apply current settings to UI elements
 */
function applySettingsToUI() {
    // Color count slider
    if (DOM.colorCountSlider) {
        DOM.colorCountSlider.value = SETTINGS.colorCount;
    }
    if (DOM.colorCountValue) {
        DOM.colorCountValue.textContent = SETTINGS.colorCount;
    }

    // Color format radio buttons
    const formatRadio = document.querySelector(`input[name="color-format"][value="${SETTINGS.colorFormat}"]`);
    if (formatRadio) {
        formatRadio.checked = true;
    }

    // Export format radio buttons
    const exportRadio = document.querySelector(`input[name="export-format"][value="${SETTINGS.exportFormat}"]`);
    if (exportRadio) {
        exportRadio.checked = true;
    }

    // Update image export options visibility
    const imageExportOptions = document.getElementById('image-export-options');
    if (imageExportOptions) {
        imageExportOptions.style.display = SETTINGS.exportFormat === 'png' ? 'block' : 'none';
    }

    // Export options checkbox
    if (DOM.showHexInExport) {
        DOM.showHexInExport.checked = SETTINGS.showHexInExport;
    }

    // Theme radio buttons
    const themeRadio = document.querySelector(`input[name="theme"][value="${SETTINGS.theme}"]`);
    if (themeRadio) {
        themeRadio.checked = true;
    }
    applyTheme();
}

/**
 * Apply theme to body
 */
function applyTheme() {
    document.body.classList.remove('theme-light', 'theme-dark');
    if (SETTINGS.theme === 'light') {
        document.body.classList.add('theme-light');
    } else if (SETTINGS.theme === 'dark') {
        document.body.classList.add('theme-dark');
    }
    // 'system' uses no class, relying on prefers-color-scheme media query
}

/**
 * ============================================
 * STATE - Current extracted palette
 * ============================================
 */
let currentPalette = [];
let cachedFilteredPalette = [];  // Full palette for re-selection when count changes
let paletteHistory = [];         // History of recent palettes (max 5)
const MAX_HISTORY_SIZE = 5;

/**
 * Load palette history from Chrome storage
 */
async function loadPaletteHistory() {
    try {
        const stored = await chrome.storage.local.get(['vibepaletteHistory']);
        if (stored.vibepaletteHistory) {
            paletteHistory = stored.vibepaletteHistory;
        }
    } catch (error) {
        console.log('Could not load palette history:', error);
    }
}

/**
 * Save current palette to history
 */
async function savePaletteToHistory() {
    if (currentPalette.length === 0) return;

    // Create history entry with timestamp and thumbnail colors
    const entry = {
        timestamp: Date.now(),
        colors: currentPalette.slice(0, 5)  // Store first 5 colors as preview
    };

    // Add to beginning of history
    paletteHistory.unshift(entry);

    // Limit history size
    if (paletteHistory.length > MAX_HISTORY_SIZE) {
        paletteHistory = paletteHistory.slice(0, MAX_HISTORY_SIZE);
    }

    // Save to storage
    try {
        await chrome.storage.local.set({ vibepaletteHistory: paletteHistory });
    } catch (error) {
        console.log('Could not save palette history:', error);
    }
}

/**
 * ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

/**
 * Converts RGB values to a Hex color string.
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {string} Hex color string (e.g., "#AABBCC")
 */
function rgbToHex(r, g, b) {
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Converts RGB values to an RGB string.
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {string} RGB string (e.g., "rgb(170, 187, 204)")
 */
function rgbToRgbString(r, g, b) {
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Converts RGB values to an HSL string.
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {string} HSL string (e.g., "hsl(210, 25%, 73%)")
 */
function rgbToHslString(r, g, b) {
    const hsl = rgbToHsl(r, g, b);
    return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`;
}

/**
 * Formats a color based on current settings.
 * @param {number[]} rgb - Array of [r, g, b] values
 * @returns {string} Formatted color string
 */
function formatColor(rgb) {
    switch (SETTINGS.colorFormat) {
        case 'rgb':
            return rgbToRgbString(rgb[0], rgb[1], rgb[2]);
        case 'hsl':
            return rgbToHslString(rgb[0], rgb[1], rgb[2]);
        case 'hex':
        default:
            return rgbToHex(rgb[0], rgb[1], rgb[2]);
    }
}

/**
 * Gets a human-readable color name based on HSL analysis.
 * @param {number[]} rgb - Array of [r, g, b] values
 * @returns {string} Color name (e.g., "Deep Red", "Light Sky Blue")
 */
function getColorName(rgb) {
    const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    const h = hsl.h;
    const s = hsl.s;
    const l = hsl.l;

    // Handle achromatic colors (very low saturation)
    if (s < 0.1) {
        if (l < 0.15) return 'Black';
        if (l < 0.3) return 'Charcoal';
        if (l < 0.45) return 'Dark Gray';
        if (l < 0.6) return 'Gray';
        if (l < 0.75) return 'Silver';
        if (l < 0.9) return 'Light Gray';
        return 'White';
    }

    // Get base hue name
    let hueName;
    if (h < 15 || h >= 345) hueName = 'Red';
    else if (h < 30) hueName = 'Vermilion';
    else if (h < 45) hueName = 'Orange';
    else if (h < 60) hueName = 'Amber';
    else if (h < 75) hueName = 'Yellow';
    else if (h < 105) hueName = 'Lime';
    else if (h < 135) hueName = 'Green';
    else if (h < 165) hueName = 'Teal';
    else if (h < 195) hueName = 'Cyan';
    else if (h < 225) hueName = 'Sky Blue';
    else if (h < 255) hueName = 'Blue';
    else if (h < 285) hueName = 'Indigo';
    else if (h < 315) hueName = 'Purple';
    else hueName = 'Magenta';

    // Add lightness modifier
    let prefix = '';
    if (l < 0.25) prefix = 'Deep ';
    else if (l < 0.4) prefix = 'Dark ';
    else if (l > 0.75) prefix = 'Light ';
    else if (l > 0.6 && s < 0.4) prefix = 'Pale ';

    // Add saturation modifier for muted colors
    if (s < 0.3 && l >= 0.25 && l <= 0.75) {
        prefix = 'Muted ';
    }

    return prefix + hueName;
}

/**
 * Calculate relative luminance of a color (WCAG 2.1 formula)
 * @param {number[]} rgb - Array of [r, g, b] values
 * @returns {number} Relative luminance (0-1)
 */
function getRelativeLuminance(rgb) {
    const [r, g, b] = rgb.map(val => {
        const sRGB = val / 255;
        return sRGB <= 0.03928
            ? sRGB / 12.92
            : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors (WCAG 2.1)
 * @param {number[]} rgb1 - First color [r, g, b]
 * @param {number[]} rgb2 - Second color [r, g, b]
 * @returns {number} Contrast ratio (1-21)
 */
function getContrastRatio(rgb1, rgb2) {
    const lum1 = getRelativeLuminance(rgb1);
    const lum2 = getRelativeLuminance(rgb2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get WCAG compliance level for contrast ratio
 * @param {number} ratio - Contrast ratio
 * @returns {object} {level: string, passes: boolean}
 */
function getWCAGLevel(ratio) {
    if (ratio >= 7) return { level: 'AAA', passes: true, color: '#22c55e' };
    if (ratio >= 4.5) return { level: 'AA', passes: true, color: '#84cc16' };
    if (ratio >= 3) return { level: 'AA-L', passes: true, color: '#facc15' };  // Large text only
    return { level: 'Fail', passes: false, color: '#ef4444' };
}

/**
 * Converts RGB values to HSL.
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {{h: number, s: number, l: number}} HSL values (h: 0-360, s: 0-1, l: 0-1)
 */
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
        h *= 360;
    }
    return { h, s, l };
}

/**
 * Calculates the color distance between two RGB colors.
 * @param {number[]} c1 - First color [r, g, b]
 * @param {number[]} c2 - Second color [r, g, b]
 * @returns {number} Distance value
 */
function colorDistance(c1, c2) {
    // Weighted Euclidean distance (human eye is more sensitive to green)
    const rDiff = c1[0] - c2[0];
    const gDiff = c1[1] - c2[1];
    const bDiff = c1[2] - c2[2];
    return Math.sqrt(2 * rDiff * rDiff + 4 * gDiff * gDiff + 3 * bDiff * bDiff);
}

/**
 * Checks if a color is too close to white.
 * @param {number[]} rgb - Array of [r, g, b] values
 * @returns {boolean} True if color is near-white
 */
function isNearWhite(rgb) {
    return rgb[0] > CONFIG.WHITE_THRESHOLD &&
        rgb[1] > CONFIG.WHITE_THRESHOLD &&
        rgb[2] > CONFIG.WHITE_THRESHOLD;
}

/**
 * Checks if a color is too close to black.
 * @param {number[]} rgb - Array of [r, g, b] values
 * @returns {boolean} True if color is near-black
 */
function isNearBlack(rgb) {
    return rgb[0] < CONFIG.BLACK_THRESHOLD &&
        rgb[1] < CONFIG.BLACK_THRESHOLD &&
        rgb[2] < CONFIG.BLACK_THRESHOLD;
}

/**
 * Filters out near-white and near-black colors from a palette.
 * @param {number[][]} palette - Array of [r, g, b] color arrays
 * @returns {number[][]} Filtered palette
 */
function filterExtremeColors(palette) {
    return palette.filter(color => !isNearWhite(color) && !isNearBlack(color));
}

/**
 * Selects a diverse palette ensuring representation across hue ranges.
 * This prevents missing accent colors that cover fewer pixels.
 * @param {number[][]} colors - Raw palette from ColorThief
 * @param {number} count - Number of colors to select
 * @returns {number[][]} Diverse palette
 */
function selectDiversePalette(colors, count) {
    if (colors.length <= count) return colors;

    // Convert to HSL and annotate
    const annotated = colors.map(rgb => ({
        rgb,
        hsl: rgbToHsl(rgb[0], rgb[1], rgb[2])
    }));

    // Define hue ranges (in degrees)
    // Reds: 0-30, 330-360 | Oranges: 30-60 | Yellows: 60-90 | Greens: 90-150
    // Cyans: 150-210 | Blues: 210-270 | Purples: 270-330
    const hueRanges = [
        { name: 'red', min: 0, max: 30 },
        { name: 'orange', min: 30, max: 60 },
        { name: 'yellow', min: 60, max: 90 },
        { name: 'green', min: 90, max: 150 },
        { name: 'cyan', min: 150, max: 210 },
        { name: 'blue', min: 210, max: 270 },
        { name: 'purple', min: 270, max: 330 },
        { name: 'red2', min: 330, max: 360 }
    ];

    // Group colors by hue range
    const hueGroups = {};
    hueRanges.forEach(range => hueGroups[range.name] = []);

    annotated.forEach(item => {
        // Skip very desaturated colors (grays) for hue grouping
        if (item.hsl.s < CONFIG.MIN_SATURATION_COLORFUL) {
            // Add to a "neutral" group
            if (!hueGroups['neutral']) hueGroups['neutral'] = [];
            hueGroups['neutral'].push(item);
        } else {
            // Find the right hue range
            for (const range of hueRanges) {
                if (item.hsl.h >= range.min && item.hsl.h < range.max) {
                    hueGroups[range.name].push(item);
                    break;
                }
            }
        }
    });

    // Merge red and red2 (both are reds, just at different ends of spectrum)
    if (hueGroups['red2']) {
        hueGroups['red'] = [...(hueGroups['red'] || []), ...hueGroups['red2']];
        delete hueGroups['red2'];
    }

    // Select best color from each group (prioritize saturation and lightness balance)
    const selected = [];
    const groupNames = Object.keys(hueGroups).filter(g => hueGroups[g].length > 0);

    // Sort groups by the "importance" of their best color (saturation * coverage)
    groupNames.sort((a, b) => {
        const aMax = Math.max(...hueGroups[a].map(c => c.hsl.s));
        const bMax = Math.max(...hueGroups[b].map(c => c.hsl.s));
        return bMax - aMax;
    });

    // First pass: pick one color from each non-empty hue group
    for (const groupName of groupNames) {
        if (selected.length >= count) break;

        const group = hueGroups[groupName];
        if (group.length === 0) continue;

        // Sort by saturation (higher is better for accent colors)
        group.sort((a, b) => {
            const aScore = a.hsl.s * CONFIG.SATURATION_BONUS + (1 - Math.abs(a.hsl.l - 0.5));
            const bScore = b.hsl.s * CONFIG.SATURATION_BONUS + (1 - Math.abs(b.hsl.l - 0.5));
            return bScore - aScore;
        });

        // Pick the best from this group that's different enough from already selected
        for (const candidate of group) {
            const isDifferentEnough = selected.every(s =>
                colorDistance(s.rgb, candidate.rgb) > 50
            );
            if (isDifferentEnough) {
                selected.push(candidate);
                break;
            }
        }
    }

    // Second pass: fill remaining slots with most diverse remaining colors
    const remaining = annotated.filter(c => !selected.includes(c));
    remaining.sort((a, b) => {
        // Calculate minimum distance to any selected color
        const aMinDist = selected.length > 0
            ? Math.min(...selected.map(s => colorDistance(s.rgb, a.rgb)))
            : 0;
        const bMinDist = selected.length > 0
            ? Math.min(...selected.map(s => colorDistance(s.rgb, b.rgb)))
            : 0;
        // Prefer colors most different from what we already have
        return bMinDist - aMinDist;
    });

    while (selected.length < count && remaining.length > 0) {
        selected.push(remaining.shift());
    }

    // Sort final palette by hue for visual consistency
    selected.sort((a, b) => a.hsl.h - b.hsl.h);

    return selected.map(item => item.rgb);
}

/**
 * Shows a toast notification with the given message.
 * @param {string} message - Message to display
 */
function showToast(message = 'Copied!') {
    const toastText = DOM.toast.querySelector('.toast-text');
    if (toastText) {
        toastText.textContent = message;
    }

    DOM.toast.classList.remove('hidden');
    DOM.toast.classList.add('show');

    setTimeout(() => {
        DOM.toast.classList.remove('show');
        setTimeout(() => {
            DOM.toast.classList.add('hidden');
        }, 250);
    }, CONFIG.TOAST_DURATION);
}

/**
 * Copies text to clipboard using the Clipboard API.
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if successful
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        return false;
    }
}

/**
 * ============================================
 * UI STATE MANAGEMENT
 * ============================================
 */

/**
 * Shows the loading state.
 */
function showLoadingState() {
    DOM.imageContainer.classList.add('hidden');
    DOM.paletteContainer.classList.add('hidden');
    DOM.errorState.classList.add('hidden');
    DOM.loading.classList.remove('hidden');
}

/**
 * Shows the result state (screenshot + palette).
 */
function showResultState() {
    DOM.loading.classList.add('hidden');
    DOM.errorState.classList.add('hidden');
    DOM.imageContainer.classList.remove('hidden');
    DOM.paletteContainer.classList.remove('hidden');
}

/**
 * Shows the error state.
 * @param {string} message - Error message to display
 */
function showErrorState(message = 'Cannot capture this page') {
    DOM.loading.classList.add('hidden');
    DOM.imageContainer.classList.add('hidden');
    DOM.paletteContainer.classList.add('hidden');
    DOM.errorState.classList.remove('hidden');

    const errorText = DOM.errorState.querySelector('.error-text');
    if (errorText) {
        errorText.textContent = message;
    }
}

/**
 * ============================================
 * COLOR PALETTE RENDERING
 * ============================================
 */

/**
 * Creates a single color block element.
 * @param {number[]} rgb - Array of [r, g, b] values
 * @returns {HTMLElement} Color block element
 */
function createColorBlock(rgb) {
    const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    const displayValue = formatColor(rgb);
    const colorName = getColorName(rgb);

    const block = document.createElement('div');
    block.className = 'color-block';
    block.setAttribute('data-rgb', JSON.stringify(rgb));
    block.setAttribute('title', `${colorName}\n${displayValue}\nClick to copy`);

    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = hex;

    // Color name label (shown on hover)
    const nameLabel = document.createElement('span');
    nameLabel.className = 'color-name';
    nameLabel.textContent = colorName;

    // Color value label
    const valueLabel = document.createElement('span');
    valueLabel.className = 'color-hex';
    valueLabel.textContent = displayValue;

    block.appendChild(nameLabel);
    block.appendChild(swatch);
    block.appendChild(valueLabel);

    block.addEventListener('click', async () => {
        const currentDisplayValue = formatColor(rgb);
        const success = await copyToClipboard(currentDisplayValue);
        if (success) {
            showToast(`${currentDisplayValue} copied!`);
        } else {
            showToast('Copy failed');
        }
    });

    return block;
}

/**
 * Renders the color palette to the grid.
 * @param {number[][]} palette - Array of [r, g, b] color arrays
 */
function renderPalette(palette) {
    // Store palette for export
    currentPalette = palette;

    DOM.colorGrid.innerHTML = '';
    palette.forEach(color => {
        const block = createColorBlock(color);
        DOM.colorGrid.appendChild(block);
    });
}

/**
 * ============================================
 * EXPORT FUNCTIONALITY
 * ============================================
 */

/**
 * Main export function - dispatches to appropriate format
 */
function exportPalette() {
    if (currentPalette.length === 0) {
        showToast('No palette to export');
        return;
    }

    switch (SETTINGS.exportFormat) {
        case 'css':
            exportAsCSS();
            break;
        case 'json':
            exportAsJSON();
            break;
        case 'png':
        default:
            exportPaletteImage();
            break;
    }
}

/**
 * Generate a shareable URL for the current palette
 */
async function sharePalette() {
    if (currentPalette.length === 0) {
        showToast('No palette to share');
        return;
    }

    // Create Coolors.co compatible URL format
    const hexColors = currentPalette.map(rgb =>
        rgbToHex(rgb[0], rgb[1], rgb[2]).replace('#', '')
    );
    const coolorsUrl = `https://coolors.co/${hexColors.join('-')}`;

    // Also create a simple URL with query param
    const encodedColors = hexColors.join(',');
    const simpleUrl = `https://coolors.co/palette/${encodedColors}`;

    // Copy to clipboard
    const success = await copyToClipboard(coolorsUrl);
    if (success) {
        showToast('Palette URL copied!');
    }

    return coolorsUrl;
}

/**
 * Export palette as CSS custom properties
 */
function exportAsCSS() {
    const lines = [':root {'];
    currentPalette.forEach((rgb, index) => {
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        lines.push(`  --palette-${index + 1}: ${hex};`);
    });
    lines.push('}');

    const css = lines.join('\n');
    downloadTextFile(css, `vibepalette-${Date.now()}.css`, 'text/css');
    showToast('CSS exported!');
}

/**
 * Export palette as JSON
 */
function exportAsJSON() {
    const colors = currentPalette.map((rgb, index) => ({
        index: index + 1,
        hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
        rgb: { r: rgb[0], g: rgb[1], b: rgb[2] },
        hsl: rgbToHsl(rgb[0], rgb[1], rgb[2])
    }));

    const json = JSON.stringify({ colors, exportedAt: new Date().toISOString() }, null, 2);
    downloadTextFile(json, `vibepalette-${Date.now()}.json`, 'application/json');
    showToast('JSON exported!');
}

/**
 * Download a text file
 */
function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a cinema palette image with the screenshot
 * and tall square color blocks at the bottom (like cinema color grading references).
 */
function exportPaletteImage() {
    if (!DOM.previewImage.src || currentPalette.length === 0) {
        showToast('No palette to export');
        return;
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Get the original image dimensions
    const img = DOM.previewImage;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    // Layout settings for Wes Anderson cinema-style palette
    const whiteGap = 4;                    // White separator line width (vertical and horizontal)
    const numColors = currentPalette.length;

    // Calculate block dimensions: width based on image width
    const totalGaps = (numColors - 1) * whiteGap;
    const blockWidth = Math.floor((imgWidth - totalGaps) / numColors);
    const blockHeight = Math.floor(blockWidth * 1.2);  // Tall rectangles

    // Recalculate actual color bar width to ensure it matches image width
    const actualColorBarWidth = (blockWidth * numColors) + totalGaps;
    const xOffset = Math.floor((imgWidth - actualColorBarWidth) / 2);  // Center if slightly off

    // Total canvas size: image + white horizontal gap + color blocks
    const canvasWidth = imgWidth;
    const canvasHeight = imgHeight + whiteGap + blockHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Fill white background (creates the separators)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw the screenshot image at the top
    ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

    // Draw color palette below the white gap
    const colorBarY = imgHeight + whiteGap;

    // Calculate font size based on block width (responsive)
    // Smaller font for RGB/HSL formats which are longer
    const baseFontSize = Math.max(10, Math.floor(blockWidth * 0.12));
    const fontSize = SETTINGS.colorFormat === 'hex' ? baseFontSize : Math.max(8, baseFontSize * 0.75);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    currentPalette.forEach((rgb, index) => {
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        const colorLabel = formatColor(rgb);
        ctx.fillStyle = hex;

        const blockX = xOffset + (index * (blockWidth + whiteGap));
        ctx.fillRect(blockX, colorBarY, blockWidth, blockHeight);

        // Calculate luminance to determine text color (white or black)
        const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        ctx.fillStyle = luminance > 0.5 ? '#000000' : '#FFFFFF';

        // Draw color code at the bottom of the rectangle
        const textX = blockX + (blockWidth / 2);
        const textY = colorBarY + blockHeight - 8;  // 8px padding from bottom edge
        ctx.fillText(colorLabel, textX, textY);
    });

    // Generate download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `vibepalette-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    showToast('Palette exported!');
}

/**
 * ============================================
 * SCREENSHOT CAPTURE & PROCESSING
 * ============================================
 */

/**
 * Extracts colors from an image and renders the palette.
 * Uses hue-diversity algorithm to capture accent colors.
 * @param {HTMLImageElement} img - Image element to extract colors from
 */
function extractAndRenderColors(img) {
    try {
        // Extract a large palette from ColorThief
        let rawPalette = colorThief.getPalette(img, CONFIG.MAX_EXTRACTION_COUNT, CONFIG.EXTRACTION_QUALITY);

        // Filter out pure whites and blacks (often from letterboxing)
        let filteredPalette = filterExtremeColors(rawPalette);

        if (filteredPalette.length < CONFIG.COLOR_COUNT) {
            console.log('Not enough colors after filtering, using original palette');
            filteredPalette = rawPalette;
        }

        // Cache the filtered palette for re-selection when count changes
        cachedFilteredPalette = filteredPalette;

        // Use hue-diversity algorithm to select the most representative colors
        const finalPalette = selectDiversePalette(filteredPalette, SETTINGS.colorCount);

        console.log(`Extracted ${rawPalette.length} colors, selected ${finalPalette.length} diverse colors`);

        renderPalette(finalPalette);
        savePaletteToHistory();
        showResultState();

    } catch (error) {
        console.error('Error extracting colors:', error);
        showErrorState('Error extracting colors');
    }
}

/**
 * Re-select colors from cached palette when count changes.
 * This avoids re-running ColorThief which can give different results.
 */
function reselectFromCache() {
    if (cachedFilteredPalette.length === 0) return;

    const finalPalette = selectDiversePalette(cachedFilteredPalette, SETTINGS.colorCount);
    console.log(`Re-selected ${finalPalette.length} colors from cache`);
    renderPalette(finalPalette);
}

/**
 * Captures a screenshot of the current tab.
 */
function captureScreenshot() {
    showLoadingState();

    // Send message to background script to capture the tab
    chrome.runtime.sendMessage({ action: 'captureScreen' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError.message);
            showErrorState('Cannot capture this page');
            return;
        }

        if (response.error) {
            console.error('Capture error:', response.error);
            showErrorState('Cannot capture this page');
            return;
        }

        // Set the screenshot as the image source
        DOM.previewImage.src = response.dataUrl;

        DOM.previewImage.onload = () => {
            setTimeout(() => {
                extractAndRenderColors(DOM.previewImage);
            }, 50);
        };

        DOM.previewImage.onerror = () => {
            console.error('Error loading screenshot');
            showErrorState('Error loading screenshot');
        };
    });
}

/**
 * ============================================
 * EVENT HANDLERS
 * ============================================
 */

/**
 * Initialize recapture button.
 */
function initRecaptureButton() {
    DOM.recaptureButton.addEventListener('click', (e) => {
        e.stopPropagation();
        captureScreenshot();
    });
}

/**
 * Initialize eyedropper for click-to-sample on preview image.
 */
function initEyedropper() {
    if (!DOM.previewImage) return;

    DOM.previewImage.addEventListener('click', async (e) => {
        if (!DOM.previewImage.src || !DOM.previewImage.complete) return;

        // Get click position relative to image
        const rect = DOM.previewImage.getBoundingClientRect();
        const scaleX = DOM.previewImage.naturalWidth / rect.width;
        const scaleY = DOM.previewImage.naturalHeight / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        // Create canvas to get pixel color
        const canvas = document.createElement('canvas');
        canvas.width = DOM.previewImage.naturalWidth;
        canvas.height = DOM.previewImage.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(DOM.previewImage, 0, 0);

        // Get pixel color
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const rgb = [pixel[0], pixel[1], pixel[2]];
        const colorValue = formatColor(rgb);
        const colorName = getColorName(rgb);

        // Copy to clipboard
        const success = await copyToClipboard(colorValue);
        if (success) {
            showToast(`${colorName}: ${colorValue} copied!`);
        }
    });

    // Change cursor on image to indicate clickable
    DOM.previewImage.style.cursor = 'crosshair';
}

/**
 * Initialize export button.
 */
function initExportButton() {
    DOM.exportButton.addEventListener('click', () => {
        exportPalette();
    });
}

/**
 * Initialize copy palette button.
 */
function initCopyPaletteButton() {
    if (!DOM.copyPaletteButton) return;

    DOM.copyPaletteButton.addEventListener('click', async () => {
        if (currentPalette.length === 0) {
            showToast('No palette to copy');
            return;
        }

        const colors = currentPalette.map(rgb => formatColor(rgb));
        const text = colors.join('\n');

        const success = await copyToClipboard(text);
        if (success) {
            showToast(`${colors.length} colors copied!`);
        } else {
            showToast('Copy failed');
        }
    });
}

/**
 * Initialize share button.
 */
function initShareButton() {
    if (!DOM.shareButton) return;

    DOM.shareButton.addEventListener('click', () => {
        sharePalette();
    });
}

/**
 * Initialize settings panel.
 */
function initSettingsPanel() {
    // Open settings
    if (DOM.settingsButton) {
        DOM.settingsButton.addEventListener('click', () => {
            DOM.settingsOverlay.classList.remove('hidden');
        });
    }

    // Close settings
    if (DOM.settingsClose) {
        DOM.settingsClose.addEventListener('click', () => {
            DOM.settingsOverlay.classList.add('hidden');
        });
    }

    // Close on overlay click (outside panel)
    if (DOM.settingsOverlay) {
        DOM.settingsOverlay.addEventListener('click', (e) => {
            if (e.target === DOM.settingsOverlay) {
                DOM.settingsOverlay.classList.add('hidden');
            }
        });
    }

    // Color count slider
    if (DOM.colorCountSlider) {
        DOM.colorCountSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            SETTINGS.colorCount = value;
            if (DOM.colorCountValue) {
                DOM.colorCountValue.textContent = value;
            }
            saveSettings();

            // Re-select from cached palette (doesn't re-run ColorThief)
            reselectFromCache();
        });
    }

    // Color format selector
    const formatRadios = document.querySelectorAll('input[name="color-format"]');
    formatRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            SETTINGS.colorFormat = e.target.value;
            saveSettings();
            updateColorLabels();
        });
    });

    // Export format selector
    const exportRadios = document.querySelectorAll('input[name="export-format"]');
    exportRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            SETTINGS.exportFormat = e.target.value;
            saveSettings();

            // Toggle image export options visibility
            const imageExportOptions = document.getElementById('image-export-options');
            if (imageExportOptions) {
                imageExportOptions.style.display = e.target.value === 'png' ? 'block' : 'none';
            }
        });
    });

    // Export options checkbox
    if (DOM.showHexInExport) {
        DOM.showHexInExport.addEventListener('change', (e) => {
            SETTINGS.showHexInExport = e.target.checked;
            saveSettings();
        });
    }

    // Theme selector
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            SETTINGS.theme = e.target.value;
            saveSettings();
            applyTheme();
        });
    });
}

/**
 * Update all color labels with current format.
 */
function updateColorLabels() {
    const blocks = document.querySelectorAll('.color-block');
    blocks.forEach(block => {
        const rgbData = block.getAttribute('data-rgb');
        if (rgbData) {
            const rgb = JSON.parse(rgbData);
            const label = block.querySelector('.color-hex');
            if (label) {
                const displayValue = formatColor(rgb);
                label.textContent = displayValue;
                block.setAttribute('title', `Click to copy ${displayValue}`);
            }
        }
    });
}

/**
 * Initialize keyboard shortcuts.
 */
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key.toLowerCase()) {
            case 'r':
                // Recapture screenshot
                captureScreenshot();
                break;
            case 'c':
                // Copy all colors
                if (DOM.copyPaletteButton) {
                    DOM.copyPaletteButton.click();
                }
                break;
            case 'e':
                // Export palette
                exportPalette();
                break;
            case 's':
                // Toggle settings
                if (DOM.settingsOverlay) {
                    DOM.settingsOverlay.classList.toggle('hidden');
                }
                break;
            case 'escape':
                // Close settings
                if (DOM.settingsOverlay && !DOM.settingsOverlay.classList.contains('hidden')) {
                    DOM.settingsOverlay.classList.add('hidden');
                }
                break;
        }
    });
}

/**
 * ============================================
 * INITIALIZATION
 * ============================================
 */

/**
 * Initialize the extension popup.
 */
async function init() {
    // Load saved settings and history
    await loadSettings();
    await loadPaletteHistory();
    applySettingsToUI();

    // Initialize event handlers
    initRecaptureButton();
    initExportButton();
    initCopyPaletteButton();
    initShareButton();
    initSettingsPanel();
    initKeyboardShortcuts();
    initEyedropper();

    // Automatically capture screenshot when popup opens
    captureScreenshot();

    console.log('VibePalette initialized - capturing screen...');
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
