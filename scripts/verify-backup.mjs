import { readFile, lstat, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { safePath, sha256 } from "./backup.mjs";

export async function verifyBackup(directory) {
  const root = await realpath(directory);
  const manifest = JSON.parse(
    await readFile(safePath(root, "manifest.json"), "utf8"),
  );
  if (
    manifest.format !== "atlas-full-backup" ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.files)
  )
    throw new Error("Unsupported backup manifest");
  if (new Set(manifest.files.map((f) => f.path)).size !== manifest.files.length)
    throw new Error("Duplicate manifest entries");
  for (const required of [
    "archives.json",
    "archive_versions.json",
    "schema.sql",
  ])
    if (!manifest.files.some((f) => f.path === required))
      throw new Error(`Missing ${required}`);
  for (const f of manifest.files) {
    const path = safePath(root, f.path);
    const actual = await realpath(path);
    if (!actual.startsWith(root + "/"))
      throw new Error("Symlink escapes backup");
    if (!(await lstat(path)).isFile()) throw new Error("Expected regular file");
    const bytes = await readFile(path);
    if (bytes.length !== f.bytes || sha256(bytes) !== f.sha256)
      throw new Error(`Checksum mismatch: ${f.path}`);
  }
  const records = JSON.parse(
    await readFile(safePath(root, "archives.json"), "utf8"),
  );
  if (
    records.format !== "atlas-of-looking" ||
    records.version !== 1 ||
    !Array.isArray(records.records)
  )
    throw new Error("Invalid archives");
  const media = new Set(
    manifest.files
      .filter((f) => f.path.startsWith("media/"))
      .map((f) => f.path.slice(6)),
  );
  for (const a of records.records)
    if (a.image_path && !media.has(a.image_path))
      throw new Error(`Missing referenced image: ${a.image_path}`);
  return { files: manifest.files.length, records: records.records.length };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  verifyBackup(process.argv[2] || "")
    .then((r) =>
      console.log(`Verified ${r.files} files and ${r.records} records.`),
    )
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
