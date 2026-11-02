import { describe, it, expect } from "vitest";
import {
  normalizeRecord,
  parseImport,
  exportJSON,
  safeURL,
} from "../src/lib/model";
import seed from "../data/archives.seed.json";
import original from "../data/original-archives.json";

describe("portable research data", () => {
  it("preserves all 13 original dossiers, including research text, keywords and references", () => {
    const records = parseImport(JSON.stringify(seed));
    expect(records).toHaveLength(13);
    for (const old of original) {
      const a = records.find((a) => a.id === old.id)!;
      for (const key of [
        "body",
        "intro",
        "name",
        "en",
        "years",
        "medium",
        "tags",
      ] as const)
        expect(a[key]).toEqual(old[key]);
      expect(a.sources.map((s) => s.url)).toEqual(
        old.sources.split(/\s+/).filter(Boolean),
      );
      expect(a.verification).toBe("pending");
      expect(a.status).toBe("draft");
    }
  });
  it("round-trips all fields through versioned JSON", () => {
    const a = parseImport(JSON.stringify(seed));
    expect(parseImport(exportJSON(a))).toEqual(a);
  });
  it("supports the legacy upload without automatically publishing it", () => {
    const a = parseImport(JSON.stringify(original));
    expect(a).toHaveLength(13);
    expect(a.every((a) => a.status === "draft")).toBe(true);
  });
  it("rejects malformed source records and duplicate IDs before any write", () => {
    expect(() => parseImport("{}")).toThrow();
    expect(() =>
      parseImport(JSON.stringify([seed.records[0], seed.records[0]])),
    ).toThrow("重复 ID");
    expect(() =>
      normalizeRecord({ ...seed.records[0], sources: [null] }),
    ).toThrow();
    expect(() => normalizeRecord({ ...seed.records[0], number: 0 })).toThrow();
  });
  it("rejects unknown kinds, future versions and unsafe URLs", () => {
    expect(() =>
      normalizeRecord({ ...seed.records[0], kind: "__proto__" }),
    ).toThrow();
    expect(() =>
      parseImport(JSON.stringify({ ...seed, version: 99 })),
    ).toThrow();
    expect(() =>
      normalizeRecord({ ...seed.records[0], image_url: "javascript:alert(1)" }),
    ).toThrow();
    expect(safeURL("data:image/svg+xml,<svg/>")).toBe("");
    expect(safeURL("https://example.org/test")).toBe(
      "https://example.org/test",
    );
  });
});
