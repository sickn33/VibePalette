import { describe, it, expect } from "vitest";
const Settings = require("../settings.js");

describe("Settings", () => {
  it("clamps saved color count to the supported range", () => {
    Settings.SETTINGS.colorCount = 15;
    Settings.clampSettings();
    expect(Settings.SETTINGS.colorCount).toBe(10);

    Settings.SETTINGS.colorCount = 2;
    Settings.clampSettings();
    expect(Settings.SETTINGS.colorCount).toBe(5);
  });
});
