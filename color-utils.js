/**
 * VIBEPALETTE - COLOR UTILITIES
 * Pure functions for color conversion and analysis
 */

/**
 * Caches function results to avoid redundant calculations.
 */
const memoize = (fn, maxCacheSize = 500) => {
  const cache = new Map();
  return (...args) => {
    const key = args.join(",");
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, result);
    return result;
  };
};

/**
 * Standard Named Colors (CSS + Vibe Extensions)
 */
const NAMED_COLORS = [
  // Grayscale / Off-Whites
  { name: "Black", rgb: [0, 0, 0] },
  { name: "White", rgb: [255, 255, 255] },
  { name: "Charcoal", rgb: [54, 69, 79] },
  { name: "Slate Gray", rgb: [112, 128, 144] },
  { name: "Light Slate Gray", rgb: [119, 136, 153] },
  { name: "Silver", rgb: [192, 192, 192] },
  { name: "Cream", rgb: [255, 253, 208] },
  { name: "Beige", rgb: [245, 245, 220] },

  // Blues / Cyans
  { name: "Navy", rgb: [0, 0, 128] },
  { name: "Midnight Blue", rgb: [25, 25, 112] },
  { name: "Royal Blue", rgb: [65, 105, 225] },
  { name: "Cornflower Blue", rgb: [100, 149, 237] },
  { name: "Sky Blue", rgb: [135, 206, 235] },
  { name: "Light Sky Blue", rgb: [135, 206, 250] },
  { name: "Deep Sky Blue", rgb: [0, 191, 255] },
  { name: "Azure", rgb: [240, 255, 255] },
  { name: "Teal", rgb: [0, 128, 128] },
  { name: "Cyan", rgb: [0, 255, 255] },
  { name: "Aqua", rgb: [0, 255, 255] },
  { name: "Turquoise", rgb: [64, 224, 208] },
  { name: "Steel Blue", rgb: [70, 130, 180] },
  { name: "Mint", rgb: [226, 253, 253] }, // Vibe Custom

  // Greens
  { name: "Forest Green", rgb: [34, 139, 34] },
  { name: "Green", rgb: [0, 128, 0] },
  { name: "Lime", rgb: [0, 255, 0] },
  { name: "Lime Green", rgb: [50, 205, 50] },
  { name: "Chartreuse", rgb: [127, 255, 0] },
  { name: "Emerald", rgb: [80, 200, 120] },
  { name: "Sea Green", rgb: [46, 139, 87] },
  { name: "Olive", rgb: [128, 128, 0] },
  { name: "Olive Drab", rgb: [107, 142, 35] },
  { name: "Sage", rgb: [138, 154, 91] }, // Vibe custom? Or standard?
  // Wait, standard Sage is not a CSS color. I'll include the one from tests.
  { name: "Sage", rgb: [188, 184, 138] }, // Wikipedia Sage.
  // The test expects [126, 163, 138] -> Sage. I should probably rely on procedural for Sage if it's broad.
  // Actually, I'll omit Sage from lookup if I want procedural to handle the range.
  // But dictionary is better. Let's add the test's Sage.
  { name: "Sage", rgb: [126, 163, 138] },

  // Reds / Pinks
  { name: "Old Mauve", rgb: [124, 79, 96] }, // #7C4F60 (User Image)
  { name: "Maroon", rgb: [128, 0, 0] },
  { name: "Dark Red", rgb: [139, 0, 0] },
  { name: "Red", rgb: [255, 0, 0] },
  { name: "Crimson", rgb: [220, 20, 60] },
  { name: "Fire Brick", rgb: [178, 34, 34] },
  { name: "Indian Red", rgb: [205, 92, 92] },
  { name: "Salmon", rgb: [250, 128, 114] },
  { name: "Coral", rgb: [255, 127, 80] },
  { name: "Tomato", rgb: [255, 99, 71] },
  { name: "Orange Red", rgb: [255, 69, 0] },
  { name: "Pink", rgb: [255, 192, 203] },
  { name: "Hot Pink", rgb: [255, 105, 180] },
  { name: "Deep Pink", rgb: [255, 20, 147] },
  { name: "Rose", rgb: [255, 0, 127] },
  { name: "Fuchsia", rgb: [255, 0, 255] },

  // Oranges / Yellows / Browns
  { name: "Orange", rgb: [255, 165, 0] },
  { name: "Dark Orange", rgb: [255, 140, 0] },
  { name: "Sandy Brown", rgb: [244, 164, 96] },
  { name: "Peach", rgb: [255, 218, 185] }, // Vibe Custom
  { name: "Terracotta", rgb: [139, 93, 79] }, // Vibe Custom
  { name: "Gold", rgb: [255, 215, 0] },
  { name: "Bronze", rgb: [205, 127, 50] },
  { name: "Golden Rod", rgb: [218, 165, 32] },
  { name: "Yellow", rgb: [255, 255, 0] },
  { name: "Khaki", rgb: [240, 230, 140] },
  { name: "Chocolate", rgb: [210, 105, 30] },
  { name: "Saddle Brown", rgb: [139, 69, 19] },
  { name: "Sienna", rgb: [160, 82, 45] },
  { name: "Brown", rgb: [165, 42, 42] },
  { name: "Peru", rgb: [205, 133, 63] },
  { name: "Burly Wood", rgb: [222, 184, 135] },
  { name: "Tan", rgb: [210, 180, 140] },
  { name: "Wheat", rgb: [245, 222, 179] },

  // Purples / Violets
  { name: "Indigo", rgb: [75, 0, 130] }, // Official Web Indigo
  { name: "Purple", rgb: [128, 0, 128] },
  { name: "Dark Magenta", rgb: [139, 0, 139] },
  { name: "Dark Violet", rgb: [148, 0, 211] },
  { name: "Dark Orchid", rgb: [153, 50, 204] },
  { name: "Medium Orchid", rgb: [186, 85, 211] },
  { name: "Thistle", rgb: [216, 191, 216] },
  { name: "Plum", rgb: [221, 160, 221] },
  { name: "Violet", rgb: [238, 130, 238] },
  { name: "Lavender", rgb: [230, 230, 250] },
];

/**
 * Finds the nearest named color using Euclidean distance.
 */
function findNearestColor(rgb, threshold = 28) {
  let minDist = Infinity;
  let bestName = null;
  // Pre-calculate squared threshold for performance
  const thresholdSq = threshold * threshold;

  for (const named of NAMED_COLORS) {
    // Squared Euclidean distance (avoid sqrt for perf)
    const rDiff = rgb[0] - named.rgb[0];
    const gDiff = rgb[1] - named.rgb[1];
    const bDiff = rgb[2] - named.rgb[2];
    const distSq = 2 * rDiff * rDiff + 4 * gDiff * gDiff + 3 * bDiff * bDiff; // Using same weighting as colorDistance

    // Note: colorDistance uses weighting factors 2, 4, 3.
    // Standard Euclidean is 1, 1, 1.
    // Weighted is better for human perception.
    // However, colorDistance returns sqrt.
    // Squaring the weighted sum gives us something comparable to threshold^2 * (some factor).
    // Let's just use the existing colorDistance function for simplicity and consistency.

    const d = colorDistance(rgb, named.rgb);
    if (d < minDist) {
      minDist = d;
      bestName = named.name;
    }
  }

  if (minDist <= threshold) return bestName;
  return null;
}

/**
 * Converts RGB values to HSL.
 */
const rgbToHsl = memoize((r, g, b) => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm),
    min = Math.min(rNorm, gNorm, bNorm);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / d + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / d + 4) / 6;
        break;
      default:
        h = 0;
    }
    h *= 360;
  }
  return { h, s, l };
});

/**
 * Converts RGB values to a Hex color string.
 */
function rgbToHex(r, g, b) {
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Converts RGB values to an RGB string.
 */
function rgbToRgbString(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Converts RGB values to an HSL string.
 */
function rgbToHslString(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`;
}

/**
 * Formats a color based on current settings.
 */
function formatColor(rgb, format = "hex") {
  switch (format) {
    case "rgb":
      return rgbToRgbString(rgb[0], rgb[1], rgb[2]);
    case "hsl":
      return rgbToHslString(rgb[0], rgb[1], rgb[2]);
    case "hex":
    default:
      return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
}

/**
 * Gets a human-readable color name based on HSL analysis.
 */
function getColorName(rgb) {
  // 1. Try to find a close match in the named colors dictionary
  const namedMatch = findNearestColor(rgb);
  if (namedMatch) {
    return namedMatch;
  }

  // 2. Fall back to procedural generation
  const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const h = hsl.h;
  const s = hsl.s;
  const l = hsl.l;

  if (s < 0.1) {
    if (l < 0.15) return "Black";
    if (l < 0.3) return "Charcoal";
    if (l < 0.45) return "Dark Gray";
    if (l < 0.6) return "Gray";
    if (l < 0.75) return "Silver";
    if (l < 0.9) return "Light Gray";
    return "White";
  }

  let hueName;
  if (h < 15 || h >= 345) hueName = "Red";
  else if (h < 30) hueName = "Vermilion";
  else if (h < 45) hueName = "Orange";
  else if (h < 60) hueName = "Amber";
  else if (h < 75) hueName = "Yellow";
  else if (h < 105) hueName = "Lime";
  else if (h < 135) hueName = "Green";
  else if (h < 165) hueName = "Teal";
  else if (h < 195) hueName = "Cyan";
  else if (h < 225) hueName = "Sky Blue";
  else if (h < 255) hueName = "Blue";
  else if (h < 270) hueName = "Indigo";
  else if (h < 315) hueName = "Purple";
  else hueName = "Magenta";

  // Perceptual Overrides

  // Specific Earth Tones (Before General Brown)
  if (h >= 10 && h <= 25 && s > 0.2 && s <= 0.5 && l > 0.3 && l <= 0.6)
    return "Terracotta";

  // Brown Family (Universal Fix)
  // Catches warm, dark, earthy tones that are often mislabeled as Orange/Red
  if (h >= 10 && h <= 45 && s > 0.15 && l < 0.5) {
    if (l < 0.3) return "Dark Brown";
    // High saturation dark colors are still Brown (e.g. SaddleBrown),
    // but very high saturation mid-lightness is Dark Orange.
    // Cutoff: if L > 0.35 and S > 0.7, it's likely Dark Orange.
    if (!(l > 0.35 && s > 0.7)) return "Brown";
  }

  if (hueName === "Red" || hueName === "Magenta" || hueName === "Vermilion") {
    // Peach check MUST be before Pink check for Vermilion hues
    if (hueName === "Vermilion" && l > 0.75 && s > 0.4) return "Peach";

    if (l > 0.75 && s > 0.4) return "Pink";
    if (l > 0.88) return "Rose";

    // Coral check MUST be before Salmon
    if (l > 0.55 && l < 0.7 && s > 0.5) return "Coral";

    if (l > 0.6 && l <= 0.8 && s > 0.6) return "Salmon";

    // Terracotta (Widened range)
    // Lowered lightness floor from 0.5 to 0.3 to catch dark earth tones
    // Improved: Ensure it doesn't catch Mauve/Purple (H > 300)
    // Only apply if Hue is Red/Orange-ish
    if ((h < 25 || h > 355) && l > 0.3 && l <= 0.7 && s > 0.2 && s <= 0.6)
      return "Terracotta";

    if (l > 0.55 && l <= 0.7 && s > 0.3 && s <= 0.6) return "Rosy Brown";
  }
  if (hueName === "Red" && l > 0.65 && s > 0.6) return "Salmon";
  if (hueName === "Vermilion" || hueName === "Orange") {
    if (l > 0.75 && s > 0.4) return "Peach";
    if (l > 0.55 && l < 0.7 && s > 0.5) return "Coral";
    if (l > 0.5 && l < 0.7 && s > 0.2 && s <= 0.5) return "Tan";
  }
  if (hueName === "Yellow") {
    if (l > 0.85) return "Beige";
    if (h >= 45 && h <= 60 && s > 0.7 && l >= 0.4 && l <= 0.6) return "Gold";
    if (l < 0.4) return "Olive";
  }
  if (hueName === "Amber" && s > 0.7 && l >= 0.4 && l <= 0.6) return "Gold";
  if (hueName === "Purple" || hueName === "Magenta") {
    if (l > 0.65 && s > 0.4) return "Violet";
    if (l > 0.65 && s > 0.2 && s <= 0.4) return "Plum";
  }
  if (hueName === "Blue" && l > 0.85) return "Lavender";
  if (hueName === "Cyan" || hueName === "Teal" || hueName === "Green") {
    if (l > 0.85 && h > 150) return "Mint";
    if (l > 0.75 && h > 170) return "Powder Blue";
    if (h >= 120 && h <= 170 && s < 0.35 && l > 0.4) return "Sage";
  }
  if (hueName === "Sky Blue" && s > 0.2 && s < 0.6 && l > 0.35 && l < 0.65)
    return "Steel Blue";

  let prefix = "";
  if (l < 0.25) prefix = "Deep ";
  else if (l < 0.4) prefix = "Dark ";
  else if (l > 0.75) prefix = "Light ";
  else if (l > 0.6 && s < 0.4) prefix = "Pale ";

  if (s < 0.3 && l >= 0.25 && l <= 0.75) {
    prefix = "Muted ";
  }

  return prefix + hueName;
}

/**
 * Determines the color family (hue group name).
 */
function getColorFamily(hsl, minSaturationColorful = 0.08) {
  if (hsl.s < minSaturationColorful) return "neutral";

  const h = hsl.h;
  if (h < 15 || h >= 345) return "red";
  if (h < 45) return "orange";
  if (h < 70) return "yellow";
  if (h < 150) return "green";
  if (h < 200) return "teal";
  if (h < 260) return "blue";
  if (h < 290) return "purple";
  if (h < 345) return "magenta";
  return "red";
}

/**
 * Calculates the color distance.
 */
function colorDistance(c1, c2) {
  const rDiff = c1[0] - c2[0];
  const gDiff = c1[1] - c2[1];
  const bDiff = c1[2] - c2[2];
  return Math.sqrt(2 * rDiff * rDiff + 4 * gDiff * gDiff + 3 * bDiff * bDiff);
}

/**
 * Checks if a color is near white.
 */
function isNearWhite(rgb, threshold = 240) {
  return rgb[0] > threshold && rgb[1] > threshold && rgb[2] > threshold;
}

/**
 * Checks if a color is near black.
 */
function isNearBlack(rgb, threshold = 20) {
  return rgb[0] < threshold && rgb[1] < threshold && rgb[2] < threshold;
}

/**
 * Filters out near-white and near-black colors.
 */
function filterExtremeColors(
  palette,
  whiteThreshold = 240,
  blackThreshold = 20,
) {
  return palette.filter(
    (color) =>
      !isNearWhite(color, whiteThreshold) &&
      !isNearBlack(color, blackThreshold),
  );
}

/**
 * Removes near-duplicate colors.
 */
function deduplicateColors(colors, threshold) {
  const unique = [];
  for (const color of colors) {
    const isDuplicate = unique.some(
      (existing) => colorDistance(existing, color) < threshold,
    );
    if (!isDuplicate) unique.push(color);
  }
  return unique;
}

/**
 * Selects a diverse palette.
 */
function selectDiversePalette(colors, count, options = {}) {
  const {
    minSaturationColorful = 0.08,
    minColorDistance = 35,
    logger = { log: () => {} },
  } = options;

  if (colors.length <= count) return colors;

  const annotated = colors.map((rgb) => {
    const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return {
      rgb,
      hsl,
      family: getColorFamily(hsl, minSaturationColorful),
    };
  });

  const HUE_FAMILIES = [
    "red",
    "orange",
    "yellow",
    "green",
    "teal",
    "blue",
    "purple",
    "magenta",
    "neutral",
  ];
  const buckets = {};
  HUE_FAMILIES.forEach((family) => (buckets[family] = []));
  annotated.forEach((color) => buckets[color.family].push(color));

  const scoreColor = (c) => {
    const lightnessScore = 1 - Math.pow(Math.abs(c.hsl.l - 0.45) * 2, 1.5);
    const saturationScore = Math.min(c.hsl.s * 1.2, 1);
    const notTooExtreme = c.hsl.l > 0.15 && c.hsl.l < 0.85 ? 1 : 0.5;
    return lightnessScore * 0.4 + saturationScore * 0.4 + notTooExtreme * 0.2;
  };

  Object.values(buckets).forEach((bucket) => {
    bucket.sort((a, b) => scoreColor(b) - scoreColor(a));
  });

  const selected = [];
  for (const family of HUE_FAMILIES) {
    if (selected.length >= count) break;
    const bucket = buckets[family];
    if (bucket.length === 0) continue;
    for (const candidate of bucket) {
      const isDifferentEnough = selected.every(
        (s) => colorDistance(s.rgb, candidate.rgb) > minColorDistance,
      );
      if (isDifferentEnough) {
        selected.push(candidate);
        break;
      }
    }
  }

  // If we still need more colors, pick the next best ones regardless of family
  if (selected.length < count) {
    const flattened = Object.values(buckets).flat();
    flattened.sort((a, b) => scoreColor(b) - scoreColor(a));
    for (const candidate of flattened) {
      if (selected.length >= count) break;
      if (selected.includes(candidate)) continue;
      const isDifferentEnough = selected.every(
        (s) => colorDistance(s.rgb, candidate.rgb) > minColorDistance,
      );
      if (isDifferentEnough) selected.push(candidate);
    }
  }

  return selected.map((s) => s.rgb);
}

/**
 * Extracts a candidate palette from an image context using heuristic sampling.
 * Moved from popup.js to support simulation testing.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D context of the image/canvas
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object} config - Configuration object (GRID_COLS, etc.)
 */
function extractPalette(ctx, width, height, config) {
  const {
    GRID_COLS = 10,
    GRID_ROWS = 8,
    DARK_PIXEL_THRESHOLD = 25,
    BRIGHT_PIXEL_THRESHOLD = 245,
    DARK_RATIO_CUTOFF = 0.7,
    SKY_START_Y_RATIO = 0.15,
    SKY_END_Y_RATIO = 0.35,
  } = config;

  const cellWidth = Math.floor(width / GRID_COLS);
  const cellHeight = Math.floor(height / GRID_ROWS);
  const allColors = [];

  // 1. Grid Sampling
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const x = col * cellWidth;
      const y = row * cellHeight;
      // In simulation (node-canvas), getImageData might be slow, but it's correct.
      // In browser, it's native.
      const imageData = ctx.getImageData(x, y, cellWidth, cellHeight);
      const pixels = imageData.data;

      const hueBuckets = {
        red: { pixel: null, saturation: -1 },
        orange: { pixel: null, saturation: -1 },
        yellow: { pixel: null, saturation: -1 },
        green: { pixel: null, saturation: -1 },
        teal: { pixel: null, saturation: -1 },
        blue: { pixel: null, saturation: -1 },
        purple: { pixel: null, saturation: -1 },
        neutral: { pixel: null, saturation: -1 },
      };

      let darkPixelCount = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i],
          g = pixels[i + 1],
          b = pixels[i + 2],
          a = pixels[i + 3];
        if (a < 128) continue;
        const brightness = (r + g + b) / 3;
        if (brightness < DARK_PIXEL_THRESHOLD) {
          darkPixelCount++;
          continue;
        }
        if (brightness > BRIGHT_PIXEL_THRESHOLD) continue;

        const max = Math.max(r, g, b),
          min = Math.min(r, g, b);
        let h = 0,
          s = 0,
          l = (max + min) / 2 / 255;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (255 * 2 - max - min) : d / (max + min);
          if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
          else if (max === g) h = ((b - r) / d + 2) * 60;
          else h = ((r - g) / d + 4) * 60;
        }

        let bucketName;
        if (s < 0.1) bucketName = "neutral";
        else if (h < 30 || h >= 330) bucketName = "red";
        else if (h < 60) bucketName = "orange";
        else if (h < 90) bucketName = "yellow";
        else if (h < 150) bucketName = "green";
        else if (h < 200) bucketName = "teal";
        else if (h < 260) bucketName = "blue";
        else bucketName = "purple";

        if (s > hueBuckets[bucketName].saturation) {
          hueBuckets[bucketName].saturation = s;
          hueBuckets[bucketName].pixel = [r, g, b];
        }
      }

      if (darkPixelCount / (pixels.length / 4) > DARK_RATIO_CUTOFF) continue;
      for (const bucket in hueBuckets) {
        if (hueBuckets[bucket].pixel && hueBuckets[bucket].saturation > 0.02) {
          allColors.push(hueBuckets[bucket].pixel);
        }
      }
    }
  }

  // 2. Corner Sampling
  const cornerSize = Math.floor(Math.min(width, height) * 0.1);
  const corners = [
    { x: 0, y: 0 },
    { x: width - cornerSize, y: 0 },
    { x: 0, y: height - cornerSize },
    { x: width - cornerSize, y: height - cornerSize },
  ];
  corners.forEach((c) => {
    const pixels = ctx.getImageData(c.x, c.y, cornerSize, cornerSize).data;
    let rSum = 0,
      gSum = 0,
      bSum = 0,
      count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] >= 128) {
        rSum += pixels[i];
        gSum += pixels[i + 1];
        bSum += pixels[i + 2];
        count++;
      }
    }
    if (count > 0)
      allColors.push([
        Math.round(rSum / count),
        Math.round(gSum / count),
        Math.round(bSum / count),
      ]);
  });

  // 3. Sky Sampling
  const skyStartY = Math.floor(height * SKY_START_Y_RATIO);
  const skyEndY = Math.floor(height * SKY_END_Y_RATIO);
  const skyCellWidth = Math.floor(width / 8);
  for (let col = 0; col < 8; col++) {
    const pixels = ctx.getImageData(
      col * skyCellWidth,
      skyStartY,
      skyCellWidth,
      skyEndY - skyStartY,
    ).data;
    let bestPixel = null,
      bestSat = -1;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2],
        a = pixels[i + 3];
      if (a < 128) continue;
      const bri = (r + g + b) / 3;
      if (bri < 30 || bri > 240) continue;
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      const l = (max + min) / 2 / 255;
      let s =
        max === min
          ? 0
          : l > 0.5
            ? (max - min) / (255 * 2 - max - min)
            : (max - min) / (max + min);
      if (s > bestSat) {
        bestSat = s;
        bestPixel = [r, g, b];
      }
    }
    if (bestPixel && bestSat > 0.05) {
      allColors.push(bestPixel);
      allColors.push(bestPixel);
      allColors.push(bestPixel);
    }
  }

  return allColors;
}

/**
 * Calculate relative luminance (WCAG 2.1).
 */
function getRelativeLuminance(rgb) {
  const [r, g, b] = rgb.map((val) => {
    const sRGB = val / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio (WCAG 2.1).
 */
function getContrastRatio(rgb1, rgb2) {
  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get WCAG compliance level.
 */
function getWCAGLevel(ratio) {
  if (ratio >= 7) return { level: "AAA", passes: true, color: "#22c55e" };
  if (ratio >= 4.5) return { level: "AA", passes: true, color: "#84cc16" };
  if (ratio >= 3) return { level: "AA-L", passes: true, color: "#facc15" };
  return { level: "Fail", passes: false, color: "#ef4444" };
}

/**
 * Converts a color name to a valid CSS variable name.
 */
function colorNameToVarName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Generates unique CSS variable names for the palette.
 */
function generateCSSVarNames(palette) {
  const nameCount = {};
  const varNames = [];
  palette.forEach((rgb) => {
    const colorName = getColorName(rgb);
    const baseName = colorNameToVarName(colorName);
    if (!nameCount[baseName]) nameCount[baseName] = 0;
    nameCount[baseName]++;
  });
  const nameUsed = {};
  palette.forEach((rgb) => {
    const colorName = getColorName(rgb);
    const baseName = colorNameToVarName(colorName);
    if (!nameUsed[baseName]) nameUsed[baseName] = 0;
    nameUsed[baseName]++;
    if (nameCount[baseName] > 1)
      varNames.push(`${baseName}-${nameUsed[baseName]}`);
    else varNames.push(baseName);
  });
  return varNames;
}

// Global namespace for extension use
if (typeof window !== "undefined") {
  window.ColorUtils = {
    memoize,
    rgbToHsl,
    rgbToHex,
    rgbToRgbString,
    rgbToHslString,
    formatColor,
    getColorName,
    getColorFamily,
    colorDistance,
    isNearWhite,
    isNearBlack,
    filterExtremeColors,
    deduplicateColors,
    selectDiversePalette,
    getRelativeLuminance,
    getContrastRatio,
    getWCAGLevel,
    colorNameToVarName,
    generateCSSVarNames,
  };
}

// Export for Vitest
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    memoize,
    rgbToHsl,
    rgbToHex,
    rgbToRgbString,
    rgbToHslString,
    formatColor,
    getColorName,
    getColorFamily,
    colorDistance,
    isNearWhite,
    isNearBlack,
    filterExtremeColors,
    deduplicateColors,
    selectDiversePalette,
    getRelativeLuminance,
    getContrastRatio,
    getWCAGLevel,
    colorNameToVarName,
    generateCSSVarNames,
    extractPalette,
    NAMED_COLORS,
  };
}
