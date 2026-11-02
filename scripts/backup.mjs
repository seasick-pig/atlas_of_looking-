import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile, rename } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export function safePath(root, key) {
  if (
    !key ||
    key.includes("\\") ||
    key.startsWith("/") ||
    key.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new Error("Unsafe backup path");
  const path = resolve(root, key);
  if (!path.startsWith(resolve(root) + "/"))
    throw new Error("Unsafe backup path");
  return path;
}
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
export async function paginateTable(client, table) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .order("id")
      .range(start, start + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
async function inventory(client, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage
      .from("archive-images")
      .list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw error;
    for (const item of data) {
      const name = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id)
        files.push({
          name,
          id: item.id,
          updated_at: item.updated_at,
          metadata: item.metadata,
        });
      else files.push(...(await inventory(client, name)));
    }
    if (data.length < 100) break;
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}
async function revisionMarker(client) {
  const { data, error, count } = await client
    .from("archive_versions")
    .select("id,recorded_at", { count: "exact" })
    .order("recorded_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw error;
  return JSON.stringify({ data, count });
}
async function main() {
  const url = process.env.ATLAS_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.ATLAS_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.ATLAS_ADMIN_EMAIL,
    password = process.env.ATLAS_ADMIN_PASSWORD;
  if (!url || !key || !email || !password)
    throw new Error(
      "Set project URL, publishable key, ATLAS_ADMIN_EMAIL and ATLAS_ADMIN_PASSWORD securely in your local environment. Do not send them in chat.",
    );
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { error: loginError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (loginError)
    throw new Error("Backup login failed; check your local configuration.");
  try {
    const { data: isAdmin, error } = await client.rpc("is_site_admin");
    if (error || !isAdmin)
      throw new Error("Backup requires an authorized administrator.");
    const output = resolve(
      process.argv[2] ||
        `backups/atlas-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    );
    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    for (const publicRoot of ["public", "dist"])
      if (
        output === join(projectRoot, publicRoot) ||
        output.startsWith(join(projectRoot, publicRoot) + "/")
      )
        throw new Error(
          "Never save private backups inside a website directory.",
        );
    const staging = `${output}.partial`;
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await mkdir(staging, { mode: 0o700 });
    const before = await revisionMarker(client),
      objects = await inventory(client);
    const manifest = {
      format: "atlas-full-backup",
      version: 1,
      created_at: new Date().toISOString(),
      project_url: url,
      files: [],
      object_inventory: objects,
    };
    async function save(name, data) {
      const path = safePath(staging, name);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, data, { mode: 0o600, flag: "wx" });
      manifest.files.push({
        path: name,
        bytes: Buffer.byteLength(data),
        sha256: sha256(data),
      });
    }
    const records = await paginateTable(client, "archives");
    await save(
      "archives.json",
      JSON.stringify(
        {
          format: "atlas-of-looking",
          version: 1,
          exported_at: new Date().toISOString(),
          records,
        },
        null,
        2,
      ),
    );
    await save(
      "archive_versions.json",
      JSON.stringify(await paginateTable(client, "archive_versions"), null, 2),
    );
    // Membership policy permits the current admin's row only. Do not claim a full Auth export.
    const { data: membership, error: membershipError } = await client
      .from("site_admins")
      .select("user_id");
    if (membershipError) throw membershipError;
    await save(
      "current-admin-membership.json",
      JSON.stringify(membership, null, 2),
    );
    await save(
      "schema.sql",
      await readFile(join(projectRoot, "supabase/migrations/001_archive.sql")),
    );
    for (const object of objects) {
      const { data, error } = await client.storage
        .from("archive-images")
        .download(object.name);
      if (error) throw new Error(`Media download failed: ${object.name}`);
      await save(`media/${object.name}`, Buffer.from(await data.arrayBuffer()));
    }
    if (
      before !== (await revisionMarker(client)) ||
      JSON.stringify(objects) !== JSON.stringify(await inventory(client))
    )
      throw new Error(
        "Content changed during backup. Pause editing/uploads and retry with a new output path. Partial files are retained, not a completed backup.",
      );
    await writeFile(
      join(staging, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      { mode: 0o600, flag: "wx" },
    );
    await rename(staging, output);
    console.log(
      `Backup complete: ${output}\n${records.length} records, ${objects.length} media files. Includes full revision history. Keep this directory private.`,
    );
  } finally {
    await client.auth.signOut({ scope: "local" });
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch(() => {
    console.error(
      "Backup failed. Verify credentials, admin permission, output path and connectivity. If editing occurred, pause changes and retry. No secret values are logged.",
    );
    process.exitCode = 1;
  });
