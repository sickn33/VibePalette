import { describe, it, expect } from "vitest";
import manifest from "../manifest.json";
import pkg from "../package.json";

describe("extension manifest", () => {
  it("declares the permissions used by the popup", () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["activeTab", "storage"]),
    );
  });

  it("stays aligned with package metadata", () => {
    expect(pkg.version).toBe(manifest.version);
    expect(pkg.license).toBe("MIT");
  });
});
