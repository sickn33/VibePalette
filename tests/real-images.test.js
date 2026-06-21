import { describe, it, expect } from "vitest";
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  extractPalette,
  deduplicateColors,
  filterExtremeColors,
  selectDiversePalette,
  rgbToHex,
  rgbToHsl,
  getColorFamily,
  colorDistance,
} = require("../color-utils.js");

const FIXTURE_DIR = path.join(__dirname, "fixtures", "real-images");
const EXTRACT_CONFIG = {
  GRID_COLS: 12,
  GRID_ROWS: 10,
  SKY_START_Y_RATIO: 0.15,
  SKY_END_Y_RATIO: 0.35,
};

function resolveImageMagickCommand() {
  for (const command of ["magick", "convert"]) {
    try {
      execFileSync(command, ["-version"], { stdio: "ignore" });
      return command;
    } catch {
      // Optional local tool for real-image decoding.
    }
  }
  return null;
}

const IMAGE_MAGICK = resolveImageMagickCommand();
const describeRealImages = IMAGE_MAGICK ? describe : describe.skip;

function decodeImage(file) {
  const size = execFileSync(
    IMAGE_MAGICK,
    [file, "-auto-orient", "-resize", "360x360>", "-format", "%w %h", "info:"],
    { encoding: "utf8" },
  )
    .trim()
    .split(/\s+/)
    .map(Number);
  const [width, height] = size;
  const data = new Uint8ClampedArray(
    execFileSync(IMAGE_MAGICK, [
      file,
      "-auto-orient",
      "-resize",
      "360x360>",
      "-depth",
      "8",
      "rgba:-",
    ]),
  );
  return { width, height, data };
}

function contextFromImage(image) {
  return {
    getImageData(sx, sy, sw, sh) {
      const data = new Uint8ClampedArray(sw * sh * 4);
      for (let y = 0; y < sh; y++) {
        const sourceStart = ((sy + y) * image.width + sx) * 4;
        const sourceEnd = sourceStart + sw * 4;
        data.set(image.data.slice(sourceStart, sourceEnd), y * sw * 4);
      }
      return { data, width: sw, height: sh };
    },
  };
}

function extractRealImagePalette(name) {
  const image = decodeImage(path.join(FIXTURE_DIR, name));
  const raw = extractPalette(
    contextFromImage(image),
    image.width,
    image.height,
    EXTRACT_CONFIG,
  );
  const deduplicated = deduplicateColors(raw, 20);
  let filtered = filterExtremeColors(deduplicated, 246, 12);
  if (filtered.length < 8) filtered = deduplicated;
  const palette = selectDiversePalette(filtered, 8, {
    minSaturationColorful: 0.06,
    minColorDistance: 34,
  });
  return { raw, palette };
}

function familySet(palette) {
  return new Set(
    palette.map((rgb) => getColorFamily(rgbToHsl(rgb[0], rgb[1], rgb[2]), 0.06)),
  );
}

function minimumDistance(palette) {
  let minDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      minDistance = Math.min(minDistance, colorDistance(palette[i], palette[j]));
    }
  }
  return minDistance;
}

describeRealImages("real image palette extraction", () => {
  const cases = [
    {
      file: "coffee.png",
      requiredFamilies: ["red", "orange"],
      forbiddenFamilies: ["blue", "purple", "teal", "green", "magenta"],
    },
    {
      file: "chelsea.png",
      requiredFamilies: ["red", "orange"],
      forbiddenFamilies: ["blue", "purple", "teal", "green", "magenta"],
    },
    {
      file: "astronaut.png",
      requiredFamilies: ["red", "orange", "neutral"],
      forbiddenFamilies: ["green", "teal", "magenta"],
    },
    {
      file: "rocket.jpg",
      requiredFamilies: ["blue", "orange", "neutral"],
      forbiddenFamilies: ["green", "teal", "purple", "magenta"],
    },
  ];

  it("includes the bundled real-image fixtures", () => {
    for (const { file } of cases) {
      expect(fs.existsSync(path.join(FIXTURE_DIR, file))).toBe(true);
    }
  });

  for (const testCase of cases) {
    it(`extracts dominant and accent families from ${testCase.file}`, () => {
      const { raw, palette } = extractRealImagePalette(testCase.file);
      const hexValues = palette.map((rgb) => rgbToHex(rgb[0], rgb[1], rgb[2]));
      const families = familySet(palette);

      expect(raw.length).toBeGreaterThanOrEqual(80);
      expect(palette).toHaveLength(8);
      expect(new Set(hexValues).size).toBe(hexValues.length);
      expect(minimumDistance(palette)).toBeGreaterThan(30);

      for (const family of testCase.requiredFamilies) {
        expect(families.has(family)).toBe(true);
      }
      for (const family of testCase.forbiddenFamilies) {
        expect(families.has(family)).toBe(false);
      }
    });
  }
});
