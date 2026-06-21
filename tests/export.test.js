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

  it("detects a centered image inside a flat border", () => {
    const width = 10;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    for (let y = 2; y < 6; y++) {
      for (let x = 3; x < 8; x++) {
        const offset = (y * width + x) * 4;
        data[offset] = 120;
        data[offset + 1] = 100;
        data[offset + 2] = 80;
      }
    }

    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => ({ data }),
      }),
    };
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) =>
      tag === "canvas" ? canvas : realCreateElement(tag),
    );

    expect(
      Export.getImageDrawRegion({ naturalWidth: width, naturalHeight: height }),
    ).toMatchObject({ sx: 3, sy: 2, sw: 5, sh: 4 });
  });
});
