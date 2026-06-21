import { describe, it, expect, vi, beforeEach } from "vitest";
const Export = require("../export.js");
const ColorUtils = require("../color-utils.js");

describe("Export helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.ColorUtils = ColorUtils;
    window.copyToClipboard = vi.fn().mockResolvedValue(true);
    Object.defineProperty(document, "fonts", {
      value: { ready: Promise.resolve() },
      configurable: true,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("caps Coolors share URLs at 10 colors", async () => {
    const palette = Array.from({ length: 12 }, (_, i) => [i * 10, 20, 30]);
    const url = await Export.sharePalette(
      palette,
      ColorUtils,
      window.copyToClipboard,
      () => {},
    );

    expect(url.split("/").pop().split("-")).toHaveLength(10);
  });

  it("honors the PNG export color-code toggle", async () => {
    const fillText = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillText,
        measureText: (text) => ({ width: text.length * 8 }),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        drawImage: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        set fillStyle(value) {},
        set strokeStyle(value) {},
        set lineWidth(value) {},
        set textAlign(value) {},
        set font(value) {},
      }),
      toDataURL: () => "data:image/png;base64,AA==",
    };
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) =>
      tag === "canvas" ? canvas : realCreateElement(tag),
    );

    await Export.exportPaletteImage(
      [[255, 0, 0]],
      {
        previewImage: {
          src: "data:image/png;base64,AA==",
          naturalWidth: 400,
          naturalHeight: 300,
        },
      },
      () => {},
      { showHexInExport: false },
    );

    expect(fillText.mock.calls.flat()).not.toContain("#FF0000");
  });
});
