import { describe, it, expect } from "vitest";
const fs = require("node:fs");
const path = require("node:path");

describe("theme CSS", () => {
  it("allows dark theme to override light OS preference", () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
    expect(css).toContain(".wes-anderson-mode.theme-dark");
  });
});
