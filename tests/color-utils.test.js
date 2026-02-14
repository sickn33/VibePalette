import { describe, it, expect } from "vitest";
const {
  rgbToHex,
  rgbToHsl,
  getColorName,
  getColorFamily,
  colorDistance,
  isNearWhite,
  isNearBlack,
  filterExtremeColors,
  deduplicateColors,
  selectDiversePalette,
  generateCSSVarNames,
  formatColor,
} = require("../color-utils.js");

describe("ColorUtils", () => {
  describe("rgbToHex", () => {
    it("converts white", () => expect(rgbToHex(255, 255, 255)).toBe("#FFFFFF"));
    it("converts black", () => expect(rgbToHex(0, 0, 0)).toBe("#000000"));
    it("converts red", () => expect(rgbToHex(255, 0, 0)).toBe("#FF0000"));
    it("pads small numbers", () => expect(rgbToHex(10, 15, 5)).toBe("#0A0F05"));
  });

  describe("getColorName", () => {
    it("identifies Black", () => expect(getColorName([5, 5, 5])).toBe("Black"));
    it("identifies White", () =>
      expect(getColorName([250, 250, 250])).toBe("White"));
    it("identifies Red", () => expect(getColorName([255, 0, 0])).toBe("Red"));
    it("identifies Light Sky Blue", () =>
      expect(getColorName([135, 206, 250])).toBe("Light Sky Blue"));
    it("identifies Muted Green", () =>
      expect(getColorName([80, 100, 80])).toBe("Muted Green"));

    // Perceptual naming tests (Phase 3 TDD)
    it("identifies Pink", () =>
      expect(getColorName([255, 168, 169])).toBe("Pink"));
    it("identifies Salmon", () =>
      expect(getColorName([250, 128, 114])).toBe("Salmon"));
    it("identifies Coral", () =>
      expect(getColorName([255, 127, 80])).toBe("Coral"));
    it("identifies Peach", () =>
      expect(getColorName([255, 218, 185])).toBe("Peach"));
    it("identifies Gold", () =>
      expect(getColorName([255, 215, 0])).toBe("Gold"));
    it("identifies Violet", () =>
      expect(getColorName([238, 130, 238])).toBe("Violet"));
    it("identifies Lavender", () =>
      expect(getColorName([230, 230, 250])).toBe("Lavender"));
    it("identifies Beige", () =>
      expect(getColorName([245, 245, 220])).toBe("Beige"));
    it("identifies Steel Blue", () =>
      expect(getColorName([70, 130, 180])).toBe("Steel Blue"));

    // Brown Family (New Universal Fixes)
    it("identifies Brown (Saddlebrown)", () =>
      expect(getColorName([139, 69, 19])).toBe("Saddle Brown"));
    it("identifies Brown (Sienna)", () =>
      expect(getColorName([160, 82, 45])).toBe("Sienna"));
    it("identifies Dark Brown", () =>
      expect(getColorName([101, 67, 33])).toBe("Dark Brown"));
    it("identifies Tan", () =>
      expect(getColorName([210, 180, 140])).toBe("Tan"));

    // Refined Indigo vs Purple (Fixing overly broad Indigo)
    it("identifies Purple (previously Indigo)", () =>
      expect(getColorName([153, 50, 204])).toBe("Dark Orchid")); // DarkOrchid
    it("identifies Indigo (actual Indigo)", () =>
      expect(getColorName([75, 0, 130])).toBe("Indigo"));

    // Refined Cinematic Tones (Phase 4 TDD)
    it("identifies Mint", () =>
      expect(getColorName([226, 253, 253])).toBe("Mint"));
    it("identifies Sage", () =>
      expect(getColorName([126, 163, 138])).toBe("Sage"));
    it("identifies Terracotta", () =>
      expect(getColorName([139, 93, 79])).toBe("Terracotta"));
    it("identifies Olive", () =>
      expect(getColorName([83, 83, 22])).toBe("Olive"));

    // Expanded Vocabulary (Data-Driven TDD)
    describe("Expanded Vocabulary", () => {
      it("identifies Navy", () =>
        expect(getColorName([0, 0, 128])).toBe("Navy"));
      it("identifies Crimson", () =>
        expect(getColorName([220, 20, 60])).toBe("Crimson"));
      it("identifies Teal", () =>
        expect(getColorName([0, 128, 128])).toBe("Teal"));
      it("identifies Forest Green", () =>
        expect(getColorName([34, 139, 34])).toBe("Forest Green"));
      it("identifies Slate Gray", () =>
        expect(getColorName([112, 128, 144])).toBe("Slate Gray"));
      it("identifies Royal Blue", () =>
        expect(getColorName([65, 105, 225])).toBe("Royal Blue"));
      it("identifies Chocolate", () =>
        expect(getColorName([210, 105, 30])).toBe("Chocolate"));
      it("identifies Gold", () =>
        expect(getColorName([255, 215, 0])).toBe("Gold"));
      it("identifies Lavender", () =>
        expect(getColorName([230, 230, 250])).toBe("Lavender"));
      // Near matches (should verify fuzzy lookup)
      it("identifies near-Navy as Navy", () =>
        expect(getColorName([5, 5, 130])).toBe("Navy"));

      // Post-Palette Image Fixes
      it("identifies Old Mauve (was Terracotta bug)", () =>
        expect(getColorName([124, 79, 96])).toBe("Old Mauve"));
    });
  });

  describe("colorDistance", () => {
    it("is 0 for identical colors", () => {
      expect(colorDistance([100, 100, 100], [100, 100, 100])).toBe(0);
    });
    it("is large for opposite colors", () => {
      expect(colorDistance([0, 0, 0], [255, 255, 255])).toBeGreaterThan(400);
    });
  });

  describe("isNearWhite & isNearBlack", () => {
    it("detects white at threshold", () =>
      expect(isNearWhite([241, 241, 241], 240)).toBe(true));
    it("detects non-white", () =>
      expect(isNearWhite([200, 200, 200], 240)).toBe(false));
    it("detects black at threshold", () =>
      expect(isNearBlack([19, 19, 19], 20)).toBe(true));
  });

  describe("filterExtremeColors", () => {
    it("removes extreme colors", () => {
      const palette = [
        [255, 255, 255],
        [0, 0, 0],
        [128, 128, 128],
      ];
      const filtered = filterExtremeColors(palette, 240, 20);
      expect(filtered).toEqual([[128, 128, 128]]);
    });
  });

  describe("deduplicateColors", () => {
    it("removes near-duplicates", () => {
      const colors = [
        [100, 100, 100],
        [101, 101, 101],
        [200, 200, 200],
      ];
      const deduped = deduplicateColors(colors, 10);
      expect(deduped.length).toBe(2);
    });
  });

  describe("selectDiversePalette", () => {
    it("returns all colors if count is greater than length", () => {
      const colors = [
        [255, 0, 0],
        [0, 255, 0],
      ];
      expect(selectDiversePalette(colors, 5).length).toBe(2);
    });

    it("picks diverse colors from different families", () => {
      const colors = [
        [255, 0, 0], // Red
        [254, 1, 1], // Also Red
        [0, 0, 255], // Blue
        [0, 1, 254], // Also Blue
      ];
      const selected = selectDiversePalette(colors, 2);
      expect(selected.length).toBe(2);
      // Should have one red and one blue
      const families = selected.map((c) =>
        getColorFamily(rgbToHsl(c[0], c[1], c[2])),
      );
      expect(families).toContain("red");
      expect(families).toContain("blue");
    });
  });

  describe("generateCSSVarNames", () => {
    it("handles duplicates with suffixes", () => {
      const palette = [
        [255, 0, 0],
        [254, 0, 0],
        [0, 0, 255],
      ];
      // Both will be named "red" or "deep-red" depending on analysis
      const names = generateCSSVarNames(palette);
      expect(names[0]).toMatch(/red-1/);
      expect(names[1]).toMatch(/red-2/);
    });
  });

  describe("formatColor", () => {
    const rgb = [255, 200, 100];
    it("formats hex", () => expect(formatColor(rgb, "hex")).toBe("#FFC864"));
    it("formats rgb", () =>
      expect(formatColor(rgb, "rgb")).toBe("rgb(255, 200, 100)"));
    it("formats hsl", () =>
      expect(formatColor(rgb, "hsl")).toMatch(/hsl\(39, 100%, 70%\)/));
  });
});
