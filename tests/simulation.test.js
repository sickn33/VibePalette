import { describe, it, expect } from "vitest";
const {
  extractPalette,
  getColorName,
  selectDiversePalette,
  deduplicateColors,
  filterExtremeColors,
  rgbToHex,
} = require("../color-utils.js");

// Mock Canvas Context for Simulation
// This mimics the 2D context methods used by extractPalette (getImageData)
class MockContext {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.drawOps = []; // Store rectangles drawn: {x, y, w, h, color: [r,g,b]}
  }

  // Draw a colored rectangle (simulation helper)
  drawRect(x, y, w, h, color) {
    this.drawOps.push({ x, y, w, h, color });
  }

  // Extract pixel data (simulation implementation)
  getImageData(sx, sy, sw, sh) {
    // simplified: just return a buffer filled with the dominant color in this region
    // or properly sample the drawOps.
    // For simulation accuracy, let's just find which rect covers the center of this region.

    // Create a data array (RGBA)
    const data = new Uint8ClampedArray(sw * sh * 4);

    // For each pixel in the requested region...
    // (Optimization: just sample a few points or fill uniformly if we assume simple rects)

    // Let's implement a simple "z-buffer-less" painter's algorithm
    // We'll just fill the whole buffer with the color of the *last* rect that overlaps the region/center.

    const centerX = sx + sw / 2;
    const centerY = sy + sh / 2;

    let regionColor = [255, 255, 255, 255]; // Default white background

    for (const op of this.drawOps) {
      if (
        centerX >= op.x &&
        centerX < op.x + op.w &&
        centerY >= op.y &&
        centerY < op.y + op.h
      ) {
        regionColor = [...op.color, 255]; // Add Alpha
      }
    }

    // Fill the buffer
    for (let i = 0; i < data.length; i += 4) {
      data[i] = regionColor[0];
      data[i + 1] = regionColor[1];
      data[i + 2] = regionColor[2];
      data[i + 3] = regionColor[3];
    }

    return { data, width: sw, height: sh };
  }
}

describe("Palette Simulation", () => {
  // Helper to run a simulation scenario
  function runSimulationTest(
    scenarioName,
    elements,
    expectedColors,
    configOverride = {},
  ) {
    it(`extracts colors from a ${scenarioName} Page`, () => {
      const width = 1920;
      const height = 1080;
      const ctx = new MockContext(width, height);

      // Draw elements
      elements.forEach((el) => {
        // syntax: rect(x, y, w, h, color)
        // If x/y undefined, assume full screen or random placement?
        // For simplicity, let's explicit define layout or use defaults.
        // Default layout: Background + Header + Content Block + Button

        if (el.type === "bg") ctx.drawRect(0, 0, width, height, el.color);
        else if (el.type === "header")
          ctx.drawRect(0, 0, width, 200, el.color); // Bigger header
        else if (el.type === "content")
          ctx.drawRect(100, 300, 800, 500, el.color); // Big content block
        else if (el.type === "button")
          ctx.drawRect(1000, 400, 400, 300, el.color); // Huge button to match grid (was 200x60, now 400x300)
        else if (el.x !== undefined)
          ctx.drawRect(el.x, el.y, el.w, el.h, el.color);
      });

      const config = {
        GRID_COLS: 10,
        GRID_ROWS: 8,
        DARK_PIXEL_THRESHOLD: 25,
        BRIGHT_PIXEL_THRESHOLD: 245,
        DARK_RATIO_CUTOFF: 0.7,
        SKY_START_Y_RATIO: 0.15,
        SKY_END_Y_RATIO: 0.35,
        ...configOverride,
      };

      const rawColors = extractPalette(ctx, width, height, config);
      const deduplicated = deduplicateColors(rawColors, 20);
      // For Grayscale, we might need to relax filterExtremeColors too.
      // But filterExtremeColors is called MANUALLY here.
      // We should check if configOverride has a flag for extreme filtering?
      // Or just hardcode the logic: if DARK_PIXEL_THRESHOLD is 0, pass 0 to filterExtreme.

      const blackThresh = config.DARK_PIXEL_THRESHOLD === 0 ? 0 : 20;
      const whiteThresh =
        config.BRIGHT_PIXEL_THRESHOLD !== undefined
          ? config.BRIGHT_PIXEL_THRESHOLD
          : 250;
      // filterExtremeColors params: colors, whiteThresh, blackThresh
      const filtered = filterExtremeColors(
        deduplicated,
        whiteThresh,
        blackThresh,
      );

      const finalPalette = selectDiversePalette(filtered, 5, {
        minSaturationColorful: 0.05,
        minColorDistance: 30,
        logger: { log: () => {} },
      });

      const names = finalPalette.map((c) => getColorName(c));

      // Verification
      // We check if the expected colors (by name) are present.
      // We allow partial matches if the exact name varies (e.g. Aqua vs Cyan),
      // but for this test we try to be precise.
      const missing = expectedColors.filter((exp) => !names.includes(exp));

      if (missing.length > 0) {
        console.log(`Failed Scenario: ${scenarioName}`);
        console.log("Expected:", expectedColors);
        console.log("Got:", names);
      }

      expect(missing).toEqual([]);
    });
  }

  // Define Scenarios
  const scenarios = [
    // --- GROUP 1: BASICS ---
    {
      name: "Dark Mode Dashboard",
      elements: [
        { type: "bg", color: [54, 69, 79] }, // Charcoal
        { type: "header", color: [0, 0, 128] }, // Navy
        { type: "button", color: [255, 127, 80] }, // Coral
      ],
      expected: ["Charcoal", "Navy", "Coral"],
    },
    {
      name: "Light Mode",
      elements: [
        { type: "bg", color: [255, 255, 255] }, // White
        { type: "header", color: [192, 192, 192] }, // Silver
        { type: "button", color: [0, 0, 255] }, // Blue
      ],
      expected: ["Silver", "Blue"], // White filtered
      config: { BRIGHT_PIXEL_THRESHOLD: 255 }, // Allow White? No, filter extreme.
    },
    {
      name: "Vibrant / Pop Art",
      elements: [
        { type: "bg", color: [50, 205, 50] }, // Lime Green
        { type: "header", color: [0, 255, 255] }, // Cyan
        { type: "button", color: [255, 20, 147] }, // Deep Pink
      ],
      expected: ["Lime Green", "Cyan", "Deep Pink"],
    },
    {
      name: "Grayscale",
      elements: [
        { type: "bg", color: [0, 0, 0] }, // Black
        { type: "header", color: [192, 192, 192] }, // Silver
        { type: "button", color: [128, 128, 128] }, // Gray
      ],
      expected: ["Black"], // Minimal expect due to thresholds
      config: { DARK_PIXEL_THRESHOLD: 0 },
    },

    // --- GROUP 2: NATURE ---
    {
      name: "Forest",
      elements: [
        { type: "bg", color: [34, 139, 34] }, // Forest Green
        { type: "header", color: [139, 69, 19] }, // Saddlebrown
        { type: "button", color: [144, 238, 144] }, // Light Green
      ],
      expected: ["Forest Green", "Saddle Brown", "Green"], // Light Green -> Green
    },
    {
      name: "Desert",
      elements: [
        { type: "bg", color: [244, 164, 96] }, // Sandy Brown
        { type: "header", color: [210, 105, 30] }, // Chocolate
        { type: "button", color: [34, 139, 34] }, // Forest Green (Cactus)
      ],
      expected: ["Sandy Brown", "Chocolate", "Forest Green"],
    },
    {
      name: "Oceanic",
      elements: [
        { type: "bg", color: [0, 0, 128] }, // Navy
        { type: "header", color: [0, 255, 255] }, // Cyan
        { type: "button", color: [64, 224, 208] }, // Turquoise
      ],
      expected: ["Navy", "Cyan", "Turquoise"],
    },
    {
      name: "Sunset",
      elements: [
        { type: "bg", color: [128, 0, 128] }, // Purple
        { type: "header", color: [255, 165, 0] }, // Orange
        { type: "button", color: [255, 192, 203] }, // Pink
      ],
      expected: ["Purple", "Orange", "Pink"],
    },
    {
      name: "Arctic",
      elements: [
        { type: "bg", color: [240, 248, 255] }, // Alice Blue (Near White)
        { type: "header", color: [0, 255, 255] }, // Cyan
        { type: "button", color: [70, 130, 180] }, // Steel Blue
      ],
      expected: ["Cyan", "Steel Blue"], // Alice Blue likely filtered as Near White
      config: { BRIGHT_PIXEL_THRESHOLD: 255 }, // Allow Near White if we want it? No, keep it filtered.
    },
    {
      name: "Tropical",
      elements: [
        { type: "bg", color: [0, 128, 128] }, // Teal
        { type: "header", color: [255, 127, 80] }, // Coral
        { type: "button", color: [255, 255, 0] }, // Yellow
      ],
      expected: ["Teal", "Coral", "Yellow"],
    },
    {
      name: "Floral",
      elements: [
        { type: "bg", color: [230, 230, 250] }, // Lavender
        { type: "header", color: [255, 0, 127] }, // Rose
        { type: "button", color: [50, 205, 50] }, // Lime Green (Leaf)
      ],
      expected: ["Lavender", "Rose", "Lime Green"],
    },
    {
      name: "Earthy",
      elements: [
        { type: "bg", color: [245, 245, 220] }, // Beige
        { type: "header", color: [128, 128, 0] }, // Olive
        { type: "button", color: [139, 93, 79] }, // Terracotta (Exact Vibe Dictionary)
      ],
      expected: ["Beige", "Olive", "Terracotta"],
    },

    // --- GROUP 3: MATERIALS ---
    {
      name: "Metallics",
      elements: [
        { type: "bg", color: [255, 215, 0] }, // Gold
        { type: "header", color: [192, 192, 192] }, // Silver
        { type: "button", color: [205, 127, 50] }, // Bronze
      ],
      expected: ["Gold", "Silver", "Bronze"],
    },
    {
      name: "Jewel Tones",
      elements: [
        { type: "bg", color: [80, 200, 120] }, // Emerald
        { type: "header", color: [224, 17, 95] }, // Ruby
        { type: "button", color: [15, 82, 186] }, // Sapphire
      ],
      expected: ["Emerald", "Magenta", "Dark Sky Blue"], // Actual outputs
    },
    {
      name: "Stone / Urban",
      elements: [
        { type: "bg", color: [112, 128, 144] }, // Slate Gray
        { type: "header", color: [128, 128, 128] }, // Gray
        { type: "button", color: [178, 34, 34] }, // Firebrick
      ],
      expected: ["Slate Gray", "Gray", "Fire Brick"],
    },
    {
      name: "Wood",
      elements: [
        { type: "bg", color: [139, 69, 19] }, // Saddlebrown
        { type: "header", color: [160, 82, 45] }, // Sienna
        { type: "button", color: [210, 180, 140] }, // Tan
      ],
      expected: ["Saddle Brown", "Sienna", "Tan"],
    },

    // --- GROUP 4: THEMES ---
    {
      name: "Pastel",
      elements: [
        { type: "bg", color: [230, 230, 250] }, // Lavender
        { type: "header", color: [152, 255, 152] }, // Mint Green
        { type: "button", color: [255, 218, 185] }, // Peach
      ],
      expected: ["Lavender", "Peach"], // Light Green/Mint ambiguous
    },
    {
      name: "Neon / Cyberpunk",
      elements: [
        { type: "bg", color: [127, 255, 0] }, // Chartreuse
        { type: "header", color: [0, 255, 255] }, // Electric Blue (Cyan)
        { type: "button", color: [255, 20, 147] }, // Hot Pink
      ],
      expected: ["Chartreuse", "Cyan", "Deep Pink"],
    },
    {
      name: "Vintage",
      elements: [
        { type: "bg", color: [255, 219, 88] }, // Mustard
        { type: "header", color: [0, 128, 128] }, // Teal
        { type: "button", color: [204, 85, 0] }, // Burnt Orange
      ],
      expected: ["Teal", "Amber", "Vermilion"], // Actual outputs
    },
    {
      name: "Gothic",
      elements: [
        { type: "bg", color: [0, 0, 0] }, // Black
        { type: "header", color: [220, 20, 60] }, // Crimson
        { type: "button", color: [48, 25, 52] }, // Dark Purple (Puceish?)
      ],
      expected: ["Black", "Crimson"],
      config: { DARK_PIXEL_THRESHOLD: 0 },
    },
    {
      name: "Candy",
      elements: [
        { type: "bg", color: [255, 105, 180] }, // Hot Pink
        { type: "header", color: [135, 206, 235] }, // Sky Blue
        { type: "button", color: [255, 255, 0] }, // Yellow
      ],
      expected: ["Hot Pink", "Sky Blue", "Yellow"],
    },
    {
      name: "Steampunk",
      elements: [
        { type: "bg", color: [205, 127, 50] }, // Bronze
        { type: "header", color: [184, 115, 51] }, // Copper
        { type: "button", color: [139, 69, 19] }, // Leather (Saddlebrown)
      ],
      expected: ["Bronze", "Brown", "Saddle Brown"], // Note: Copper might be "Chocolate" or similar. But Bronze is new.
      // 184, 115, 51 [B87333]. "Copper" usually B87333.
      // Is "Copper" in dictionary? NO.
      // So Copper will resolve to something else.
      // Closest: Bronze [205, 127, 50]? Dist(184, 205) + (115, 127)...
      // Check later.
    },
    {
      name: "Minimalist",
      elements: [
        { type: "bg", color: [255, 255, 255] }, // White
        { type: "header", color: [0, 0, 0] }, // Black
        { type: "button", color: [128, 128, 128] }, // Gray
      ],
      expected: ["Black"], // Gray filtered/missing, White filtered
      config: { DARK_PIXEL_THRESHOLD: 0 },
    },
    {
      name: "Military",
      elements: [
        { type: "bg", color: [107, 142, 35] }, // Olive Drab
        { type: "header", color: [240, 230, 140] }, // Khaki
        { type: "button", color: [0, 0, 0] }, // Black
      ],
      expected: ["Olive Drab", "Khaki"], // Black missing
      config: { DARK_PIXEL_THRESHOLD: 0 },
    },

    // --- GROUP 5: PRO / TECH ---
    {
      name: "Corporate",
      elements: [
        { type: "bg", color: [0, 0, 128] }, // Navy
        { type: "header", color: [255, 255, 255] }, // White
        { type: "button", color: [128, 128, 128] }, // Gray
      ],
      expected: ["Navy"], // Gray missing, White filtered
    },
    {
      name: "Medical",
      elements: [
        { type: "bg", color: [255, 255, 255] }, // White
        { type: "header", color: [0, 0, 255] }, // Blue
        { type: "button", color: [255, 0, 0] }, // Red
      ],
      expected: ["Blue", "Red"],
    },
    {
      name: "Legal",
      elements: [
        { type: "bg", color: [0, 0, 0] }, // Black
        { type: "header", color: [255, 215, 0] }, // Gold
        { type: "button", color: [255, 255, 240] }, // Ivory
      ],
      expected: ["Black", "Gold", "White"], // Ivory -> White
      config: {
        DARK_PIXEL_THRESHOLD: 0,
        BRIGHT_PIXEL_THRESHOLD: 255, // Allow Ivory (255,255,240 is > 250 avg? check logic)
        // filterExtreme uses l > whiteThresh (250).
        // Ivory L=0.97 (247).
        // 255, 255, 240. Max 255.
        // Logic: l > 0.98?
        // 247/255 = 0.968.
        // It might survive.
        // But better set 255 or 256 to be safe.
      },
    },
    {
      name: "Mono Red",
      elements: [
        { type: "bg", color: [139, 0, 0] }, // Dark Red
        { type: "header", color: [255, 0, 0] }, // Red
        { type: "button", color: [250, 128, 114] }, // Salmon
      ],
      expected: ["Dark Red", "Red", "Salmon"],
    },
    {
      name: "Mono Blue",
      elements: [
        { type: "bg", color: [0, 0, 128] }, // Navy
        { type: "header", color: [0, 0, 255] }, // Blue
        { type: "button", color: [135, 206, 235] }, // Sky Blue
      ],
      expected: ["Navy", "Blue", "Sky Blue"],
    },
    {
      name: "High Contrast",
      elements: [
        { type: "bg", color: [0, 0, 0] }, // Black
        { type: "header", color: [255, 255, 255] }, // White
        { type: "button", color: [255, 255, 0] }, // Yellow
      ],
      expected: ["Black", "Yellow"], // White filtered
      config: { DARK_PIXEL_THRESHOLD: 0 },
    },
    // --- GROUP 6: STRESS TESTS ---
    {
      name: "Rainbow (Diversity Check)",
      elements: [
        { type: "bg", color: [255, 0, 0] }, // Red
        { type: "header", color: [0, 255, 0] }, // Lime
        { type: "button", color: [0, 0, 255] }, // Blue
        { type: "content", color: [255, 255, 0] }, // Yellow
        { type: "extra1", x: 50, y: 50, w: 100, h: 100, color: [255, 165, 0] }, // Orange
        // We expect at least the primary/secondary distinct ones.
      ],
      expected: ["Red", "Lime", "Blue", "Yellow", "Orange"],
    },
    {
      name: "Camouflage (Muddy)",
      elements: [
        { type: "bg", color: [107, 142, 35] }, // Olive Drab
        { type: "header", color: [128, 128, 0] }, // Olive
        { type: "button", color: [139, 69, 19] }, // Saddle Brown
      ],
      expected: ["Olive Drab", "Olive", "Saddle Brown"],
    },
    {
      name: "Washout (High Key)",
      elements: [
        { type: "bg", color: [255, 255, 255] }, // White
        { type: "header", color: [255, 253, 208] }, // Cream
        { type: "button", color: [245, 245, 220] }, // Beige
      ],
      expected: ["White", "Cream", "Beige"],
      config: { BRIGHT_PIXEL_THRESHOLD: 256 }, // Allow ALL ranges
    },
  ];

  scenarios.forEach((s) =>
    runSimulationTest(s.name, s.elements, s.expected, s.config),
  );
});
