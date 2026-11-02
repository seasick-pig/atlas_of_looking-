import { it, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error Plain Node scripts are also usable without a TypeScript runtime.
import { safePath, sha256, paginateTable } from "../scripts/backup.mjs";
// @ts-expect-error Plain Node scripts.
import { verifyBackup } from "../scripts/verify-backup.mjs";
it("backs up tables beyond the default API row limit", async () => {
  const ranges: number[] = [];
  const client = {
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (start: number) => {
            ranges.push(start);
            return {
              data: Array.from(
                { length: start === 1000 ? 5 : 500 },
                (_, i) => ({ id: start + i }),
              ),
              error: null,
            };
          },
        }),
      }),
    }),
  };
  const data = await paginateTable(client, "archives");
  expect(data).toHaveLength(1005);
  expect(ranges).toEqual([0, 500, 1000]);
});
it("verifies a complete backup and detects changed or missing files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atlas-backup-test-"));
  try {
    const files = {
      "archives.json": JSON.stringify({
        format: "atlas-of-looking",
        version: 1,
        records: [],
      }),
      "archive_versions.json": "[]",
      "schema.sql": "-- migration",
    };
    const manifest = {
      format: "atlas-full-backup",
      version: 1,
      files: Object.entries(files).map(([path, data]) => ({
        path,
        bytes: Buffer.byteLength(data),
        sha256: sha256(data),
      })),
    };
    for (const [path, data] of Object.entries(files))
      await writeFile(join(dir, path), data);
    await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
    expect((await verifyBackup(dir)).files).toBe(3);
    await writeFile(join(dir, "archive_versions.json"), "[1]");
    await expect(verifyBackup(dir)).rejects.toThrow("Checksum mismatch");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("rejects traversal keys before writing or restoring media", () => {
  for (const key of [
    "../secret",
    "/tmp/secret",
    "a/../../secret",
    "a\\b",
    "a//b",
  ])
    expect(() => safePath("/tmp/atlas-test", key)).toThrow();
});
