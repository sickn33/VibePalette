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
    // Lower = better sampling but slower (1 gives best coverage of minority colors)
    EXTRACTION_QUALITY: 1,

    // Toast notification display duration (ms)
    TOAST_DURATION: 2000,

    // Thresholds for filtering out near-white/black colors
    WHITE_THRESHOLD: 240,
    BLACK_THRESHOLD: 20,

    // Maximum colors to request from ColorThief (extract many, then select best)
    // Higher value = better chance of capturing minority accent colors
    MAX_EXTRACTION_COUNT: 60,

    // Minimum saturation to be considered a "colorful" color (0-1)
    // Lowered to include muted tones like Wes Anderson sky colors
    MIN_SATURATION_COLORFUL: 0.08,

    // Bonus weight for saturated colors in selection (1.0 = no bonus)
    // Reduced to avoid penalizing muted accent colors
    SATURATION_BONUS: 1.0,

    // Minimum distance between selected colors (lower = more similar colors allowed)
    MIN_COLOR_DISTANCE: 35,

    // Force hue diversity: ensure at least one color from major hue families if present
    FORCE_HUE_DIVERSITY: true
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
 * Selects a diverse palette with GUARANTEED representation from each hue family.
 * 
 * Critical insight: Grouping by "warm" vs "cool" is too coarse - greens dominate over blues
 * because both are "cool". Instead, we use 8 specific hue buckets and guarantee at least
 * one color from each bucket that contains colors.
 * 
 * Algorithm:
 * 1. Bucket all colors into 8 hue families (red, orange, yellow, green, teal, blue, purple, neutral)
 * 2. FIRST PASS: Pick the single best color from EACH non-empty bucket (guarantees coverage)
 * 3. SECOND PASS: Fill remaining slots by maximizing color distance
 * 4. Sort by hue for visual consistency
 * 
 * This ensures that if ANY blue exists in the image, it WILL be in the final palette,
 * even if greens are 10x more prevalent.
 * 
 * @param {number[][]} colors - Raw palette from ColorThief
 * @param {number} count - Number of colors to select
 * @returns {number[][]} Diverse palette
 */
function selectDiversePalette(colors, count) {
    if (colors.length <= count) return colors;

    // Convert to HSL and annotate with hue family
    const annotated = colors.map(rgb => {
        const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        return {
            rgb,
            hsl,
            family: getColorFamily(hsl)
        };
    });

    // Define the 9 hue families in spectrum order (matches getColorFamily)
    const HUE_FAMILIES = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'magenta', 'neutral'];

    // Bucket colors by family
    const buckets = {};
    HUE_FAMILIES.forEach(family => buckets[family] = []);

    annotated.forEach(color => {
        buckets[color.family].push(color);
    });

    // Sort each bucket by "visual quality" score
    // Prefer: medium lightness (0.35-0.55), decent saturation, not too dark/light
    const scoreColor = (c) => {
        const lightnessScore = 1 - Math.pow(Math.abs(c.hsl.l - 0.45) * 2, 1.5);
        const saturationScore = Math.min(c.hsl.s * 1.2, 1); // Cap at 1
        const notTooExtreme = (c.hsl.l > 0.15 && c.hsl.l < 0.85) ? 1 : 0.5;
        return (lightnessScore * 0.4) + (saturationScore * 0.4) + (notTooExtreme * 0.2);
    };

    Object.values(buckets).forEach(bucket => {
        bucket.sort((a, b) => scoreColor(b) - scoreColor(a));
    });

    const selected = [];
    const usedBuckets = [];

    // === PHASE 1: Guarantee one color from each non-empty hue family ===
    // This is the key insight: EVERY hue family gets representation before any family gets a second color

    for (const family of HUE_FAMILIES) {
        if (selected.length >= count) break;

        const bucket = buckets[family];
        if (bucket.length === 0) continue;

        // Find the best color from this bucket that's different enough from already selected
        for (const candidate of bucket) {
            const isDifferentEnough = selected.every(s =>
                colorDistance(s.rgb, candidate.rgb) > CONFIG.MIN_COLOR_DISTANCE
            );

            if (isDifferentEnough) {
                selected.push(candidate);
                usedBuckets.push(family);
                console.log(`✓ ${family}: ${rgbToHex(candidate.rgb[0], candidate.rgb[1], candidate.rgb[2])}`);
                break;
            }
        }
    }

    console.log(`Phase 1: Selected ${selected.length} colors from ${usedBuckets.length} hue families: [${usedBuckets.join(', ')}]`);

    // === PHASE 2: Fill remaining slots by maximizing distance ===
    // Now that each hue family is represented, fill the rest with maximum diversity

    const remaining = annotated.filter(c => !selected.includes(c));

    while (selected.length < count && remaining.length > 0) {
        // Find the color most different from all selected colors
        let bestCandidate = null;
        let bestMinDistance = -1;

        for (let i = 0; i < remaining.length; i++) {
            const candidate = remaining[i];
            const minDistToSelected = Math.min(
                ...selected.map(s => colorDistance(s.rgb, candidate.rgb))
            );

            if (minDistToSelected > bestMinDistance) {
                bestMinDistance = minDistToSelected;
                bestCandidate = { index: i, color: candidate };
            }
        }

        if (bestCandidate && bestMinDistance > CONFIG.MIN_COLOR_DISTANCE * 0.5) {
            selected.push(bestCandidate.color);
            remaining.splice(bestCandidate.index, 1);
        } else {
            // No more sufficiently different colors
            break;
        }
    }

    console.log(`Phase 2: Total ${selected.length} colors after distance-based fill`);

    // === PHASE 3: Sort by hue for visual consistency ===
    selected.sort((a, b) => {
        // Neutrals go to the end
        if (a.family === 'neutral' && b.family !== 'neutral') return 1;
        if (b.family === 'neutral' && a.family !== 'neutral') return -1;
        // Sort by hue
        return a.hsl.h - b.hsl.h;
    });

    return selected.map(item => item.rgb);
}

/**
 * Determines the color family (hue group name) for visualization/debugging.
 * @param {object} hsl - HSL object with h, s, l properties
 * @returns {string} Family name
 */
function getColorFamily(hsl) {
    if (hsl.s < CONFIG.MIN_SATURATION_COLORFUL) return 'neutral';

    const h = hsl.h;
    if (h < 15 || h >= 345) return 'red';
    if (h < 45) return 'orange';
    if (h < 70) return 'yellow';
    if (h < 150) return 'green';
    if (h < 200) return 'teal';    // Split out teal (like Wes Anderson skies)
    if (h < 260) return 'blue';
    if (h < 290) return 'purple';
    if (h < 345) return 'magenta';
    return 'red';
}

/**
 * Determines whether a color is warm, cool, or neutral.
 * @param {object} hsl - HSL object with h, s, l properties
 * @returns {string} 'warm', 'cool', or 'neutral'
 */
function getColorTemperature(hsl) {
    // Very low saturation = neutral (grays)
    if (hsl.s < CONFIG.MIN_SATURATION_COLORFUL) return 'neutral';

    const h = hsl.h;

    // Warm: reds, oranges, yellows, warm purples/magentas (0-70, 320-360)
    if ((h >= 0 && h < 70) || (h >= 320 && h < 360)) return 'warm';

    // Cool: greens through blues to cool purples (70-320)
    return 'cool';
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
 * Converts a color name to a valid CSS variable name.
 * @param {string} name - Human-readable color name (e.g., "Deep Red", "Sky Blue")
 * @returns {string} CSS-safe variable name (e.g., "deep-red", "sky-blue")
 */
function colorNameToVarName(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

/**
 * Generates unique CSS variable names for the palette.
 * If there are duplicate color names, appends a number suffix.
 * @param {number[][]} palette - Array of [r, g, b] colors
 * @returns {string[]} Array of unique CSS variable names
 */
function generateCSSVarNames(palette) {
    const nameCount = {};
    const varNames = [];

    palette.forEach(rgb => {
        const colorName = getColorName(rgb);
        const baseName = colorNameToVarName(colorName);

        // Track occurrences
        if (!nameCount[baseName]) {
            nameCount[baseName] = 0;
        }
        nameCount[baseName]++;
    });

    // Reset for second pass
    const nameUsed = {};

    palette.forEach(rgb => {
        const colorName = getColorName(rgb);
        const baseName = colorNameToVarName(colorName);

        if (!nameUsed[baseName]) {
            nameUsed[baseName] = 0;
        }
        nameUsed[baseName]++;

        // Add suffix only if there are duplicates
        if (nameCount[baseName] > 1) {
            varNames.push(`${baseName}-${nameUsed[baseName]}`);
        } else {
            varNames.push(baseName);
        }
    });

    return varNames;
}

/**
 * Export palette as CSS custom properties with semantic names.
 * Uses color analysis to generate meaningful variable names.
 */
async function exportAsCSS() {
    const varNames = generateCSSVarNames(currentPalette);
    const lines = ['/* VibePalette - Extracted Colors */'];
    lines.push(':root {');

    currentPalette.forEach((rgb, index) => {
        const colorValue = formatColor(rgb);
        const varName = varNames[index];
        lines.push(`  --${varName}: ${colorValue};`);
    });

    lines.push('}');

    // Also add numbered fallbacks for predictable access
    lines.push('');
    lines.push('/* Numbered aliases for programmatic access */');
    lines.push(':root {');
    currentPalette.forEach((rgb, index) => {
        const colorValue = formatColor(rgb);
        lines.push(`  --palette-${index + 1}: ${colorValue};`);
    });
    lines.push('}');

    const css = lines.join('\n');

    // Copy to clipboard for quick use
    const copied = await copyToClipboard(css);

    // Also download as file
    downloadTextFile(css, `vibepalette-${Date.now()}.css`, 'text/css');

    if (copied) {
        showToast('CSS copied & downloaded!');
    } else {
        showToast('CSS exported!');
    }
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
 * Extracts colors using GRID-BASED SEMANTIC SAMPLING.
 * 
 * THE CORE INSIGHT (from the user):
 * Median-cut algorithms mathematically BLEND colors. When orange dress pixels 
 * and blue sky pixels are averaged together, you get muddy olive-green.
 * This destroys the intentional contrast that cinematographers like Wes Anderson create.
 * 
 * THE SOLUTION:
 * Divide the image into small grid cells. Each cell is small enough to contain 
 * mostly ONE color (sky, dress, railing, etc.). Extract the SINGLE dominant color 
 * from each cell. This gives us pure, unblended "spot samples" that preserve 
 * the distinct colors human eyes see.
 * 
 * @param {HTMLImageElement} img - Image element to extract colors from
 */
function extractAndRenderColors(img) {
    try {
        const imgWidth = img.naturalWidth;
        const imgHeight = img.naturalHeight;

        // Create canvas for pixel manipulation
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = imgWidth;
        canvas.height = imgHeight;
        ctx.drawImage(img, 0, 0);

        // === GRID SAMPLING CONFIG ===
        // Smaller cells = more "semantic" separation (each cell is one object)
        const GRID_COLS = 10;
        const GRID_ROWS = 8;
        const cellWidth = Math.floor(imgWidth / GRID_COLS);
        const cellHeight = Math.floor(imgHeight / GRID_ROWS);

        const allColors = [];

        // === PHASE 1: Extract dominant color from each grid cell ===
        console.log(`Grid sampling: ${GRID_COLS}x${GRID_ROWS} = ${GRID_COLS * GRID_ROWS} cells`);

        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const x = col * cellWidth;
                const y = row * cellHeight;

                // Get pixel data for this cell
                const imageData = ctx.getImageData(x, y, cellWidth, cellHeight);
                const pixels = imageData.data;

                // HUE BUCKETING: Find the best (most saturated) pixel for EACH hue family
                // This ensures we get the best red AND the best blue, not just whichever is stronger
                const hueBuckets = {
                    red: { pixel: null, saturation: -1 },      // 0-30, 330-360
                    orange: { pixel: null, saturation: -1 },   // 30-60
                    yellow: { pixel: null, saturation: -1 },   // 60-90
                    green: { pixel: null, saturation: -1 },    // 90-150
                    teal: { pixel: null, saturation: -1 },     // 150-200 (sky colors!)
                    blue: { pixel: null, saturation: -1 },     // 200-260
                    purple: { pixel: null, saturation: -1 },   // 260-330
                    neutral: { pixel: null, saturation: -1 }   // low saturation
                };

                let darkPixelCount = 0;
                const DARK_THRESHOLD = 25;
                const BRIGHT_THRESHOLD = 245;

                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];
                    const a = pixels[i + 3];

                    if (a < 128) continue;

                    const brightness = (r + g + b) / 3;
                    if (brightness < DARK_THRESHOLD) {
                        darkPixelCount++;
                        continue;
                    }
                    if (brightness > BRIGHT_THRESHOLD) continue;

                    // Calculate HSL inline
                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const l = (max + min) / 2 / 255;
                    let saturation = 0;
                    let hue = 0;

                    if (max !== min) {
                        const d = max - min;
                        saturation = l > 0.5 ? d / (255 * 2 - max - min) : d / (max + min);

                        // Calculate hue
                        if (max === r) {
                            hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
                        } else if (max === g) {
                            hue = ((b - r) / d + 2) * 60;
                        } else {
                            hue = ((r - g) / d + 4) * 60;
                        }
                    }

                    // Determine which hue bucket this pixel belongs to
                    let bucketName;
                    if (saturation < 0.1) {
                        bucketName = 'neutral';
                    } else if (hue < 30 || hue >= 330) {
                        bucketName = 'red';
                    } else if (hue < 60) {
                        bucketName = 'orange';
                    } else if (hue < 90) {
                        bucketName = 'yellow';
                    } else if (hue < 150) {
                        bucketName = 'green';
                    } else if (hue < 200) {
                        bucketName = 'teal';
                    } else if (hue < 260) {
                        bucketName = 'blue';
                    } else {
                        bucketName = 'purple';
                    }

                    // Update bucket if this pixel is more saturated than current best
                    const bucket = hueBuckets[bucketName];
                    if (saturation > bucket.saturation) {
                        bucket.saturation = saturation;
                        bucket.pixel = [r, g, b];
                    }
                }

                // Skip cells that are mostly dark (letterbox regions)
                const totalPixels = pixels.length / 4;
                const darkRatio = darkPixelCount / totalPixels;
                if (darkRatio > 0.7) continue;

                // Add the best color from EACH non-empty hue bucket
                for (const bucketName in hueBuckets) {
                    const bucket = hueBuckets[bucketName];
                    if (bucket.pixel && bucket.saturation > 0.02) {
                        allColors.push(bucket.pixel);
                    }
                }
            }
        }

        console.log(`Grid sampling extracted ${allColors.length} cell colors`);

        // === PHASE 2: Also sample corners and edges for accent colors ===
        // Often the most distinctive colors are at the edges (sky at top, ground at bottom)
        const cornerSize = Math.floor(Math.min(imgWidth, imgHeight) * 0.1);
        const corners = [
            { x: 0, y: 0, name: 'top-left' },
            { x: imgWidth - cornerSize, y: 0, name: 'top-right' },
            { x: 0, y: imgHeight - cornerSize, name: 'bottom-left' },
            { x: imgWidth - cornerSize, y: imgHeight - cornerSize, name: 'bottom-right' }
        ];

        for (const corner of corners) {
            const imageData = ctx.getImageData(corner.x, corner.y, cornerSize, cornerSize);
            const pixels = imageData.data;

            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] < 128) continue;
                rSum += pixels[i];
                gSum += pixels[i + 1];
                bSum += pixels[i + 2];
                count++;
            }

            if (count > 0) {
                allColors.push([
                    Math.round(rSum / count),
                    Math.round(gSum / count),
                    Math.round(bSum / count)
                ]);
            }
        }

        // === PHASE 3: Sample the SKY area specifically ===
        // For letterboxed images, sky is typically 15-35% from top (below black bars)
        // Use MAX SATURATION selection to get the purest sky blue, not washed-out clouds
        const skyStartY = Math.floor(imgHeight * 0.15);
        const skyEndY = Math.floor(imgHeight * 0.35);
        const skyStripHeight = skyEndY - skyStartY;
        const skyStripCols = 8;
        const skyCellWidth = Math.floor(imgWidth / skyStripCols);

        console.log(`Sky sampling: rows ${skyStartY}-${skyEndY} (max saturation mode)`);

        for (let col = 0; col < skyStripCols; col++) {
            const x = col * skyCellWidth;
            const imageData = ctx.getImageData(x, skyStartY, skyCellWidth, skyStripHeight);
            const pixels = imageData.data;

            // Find the MOST SATURATED pixel in this sky cell
            let bestPixel = null;
            let bestSaturation = -1;

            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                const a = pixels[i + 3];

                if (a < 128) continue;

                // Skip very dark and very bright pixels
                const brightness = (r + g + b) / 3;
                if (brightness < 30 || brightness > 240) continue;

                // Calculate saturation
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const l = (max + min) / 2 / 255;
                let saturation = 0;
                if (max !== min) {
                    const d = (max - min) / 255;
                    saturation = l > 0.5 ? d / (2 - max / 255 - min / 255) : d / (max / 255 + min / 255);
                }

                if (saturation > bestSaturation) {
                    bestSaturation = saturation;
                    bestPixel = [r, g, b];
                }
            }

            if (bestPixel && bestSaturation > 0.05) {
                // Add sky colors with high priority
                allColors.push(bestPixel);
                allColors.push(bestPixel);
                allColors.push(bestPixel);
                console.log(`Sky cell ${col}: RGB(${bestPixel.join(', ')}) sat=${bestSaturation.toFixed(2)}`);
            }
        }

        console.log(`Total colors after all sampling: ${allColors.length}`);

        // === PHASE 4: Deduplicate and filter ===
        const deduplicatedColors = deduplicateColors(allColors, 20);
        console.log(`After deduplication: ${deduplicatedColors.length} unique colors`);

        let filteredPalette = filterExtremeColors(deduplicatedColors);

        if (filteredPalette.length < SETTINGS.colorCount) {
            console.log('Not enough colors after filtering, using deduplicated palette');
            filteredPalette = deduplicatedColors;
        }

        // Cache for re-selection when count changes
        cachedFilteredPalette = filteredPalette;

        // === PHASE 5: Apply hue-bucket selection for final palette ===
        const finalPalette = selectDiversePalette(filteredPalette, SETTINGS.colorCount);

        console.log(`Final palette: ${finalPalette.length} diverse colors`);

        renderPalette(finalPalette);
        savePaletteToHistory();
        showResultState();

    } catch (error) {
        console.error('Error extracting colors:', error);
        showErrorState('Error extracting colors');
    }
}

/**
 * Removes near-duplicate colors from a palette.
 * @param {number[][]} colors - Array of [r, g, b] colors
 * @param {number} threshold - Minimum distance to consider colors different
 * @returns {number[][]} Deduplicated color array
 */
function deduplicateColors(colors, threshold) {
    const unique = [];

    for (const color of colors) {
        const isDuplicate = unique.some(existing =>
            colorDistance(existing, color) < threshold
        );

        if (!isDuplicate) {
            unique.push(color);
        }
    }

    return unique;
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
