import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyBackup } from "./verify-backup.mjs";
import { safePath, sha256 } from "./backup.mjs";

async function main() {
  const dir = resolve(process.argv[2] || "");
  await verifyBackup(dir);
  const url = process.env.ATLAS_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.ATLAS_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (
    !url ||
    !key ||
    !process.env.ATLAS_ADMIN_EMAIL ||
    !process.env.ATLAS_ADMIN_PASSWORD ||
    process.env.ATLAS_RESTORE_CONFIRM_URL !== url
  )
    throw new Error(
      "Set destination URL/key/admin credentials and ATLAS_RESTORE_CONFIRM_URL in your private local environment.",
    );
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: process.env.ATLAS_ADMIN_EMAIL,
    password: process.env.ATLAS_ADMIN_PASSWORD,
  });
  if (error) throw new Error("Administrator login failed.");
  try {
    const { data: admin, error } = await client.rpc("is_site_admin");
    if (error || !admin)
      throw new Error("Administrator authorization required.");
    const manifest = JSON.parse(
      await readFile(safePath(dir, "manifest.json"), "utf8"),
    );
    let count = 0;
    for (const file of manifest.files.filter((f) =>
      f.path.startsWith("media/"),
    )) {
      const name = file.path.slice(6);
      const bytes = await readFile(safePath(dir, file.path));
      const mime = manifest.object_inventory?.find((f) => f.name === name)
        ?.metadata?.mimetype;
      const fallback = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        avif: "image/avif",
      }[name.split(".").pop().toLowerCase()];
      const contentType = mime || fallback;
      if (
        !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
          contentType,
        )
      )
        throw new Error("Unsupported backup media type.");
      const { error: uploadError } = await client.storage
        .from("archive-images")
        .upload(name, bytes, { contentType, upsert: false });
      if (uploadError) {
        const { data: existing, error } = await client.storage
          .from("archive-images")
          .download(name);
        if (
          error ||
          sha256(Buffer.from(await existing.arrayBuffer())) !== file.sha256
        )
          throw new Error(
            "Destination image exists with different content or upload failed. No file overwritten.",
          );
      }
      count++;
    }
    console.log(
      `Restored/verified ${count} media files. Database restoration is a separate owner-only step.`,
    );
  } finally {
    await client.auth.signOut({ scope: "local" });
  }
}
main().catch(() => {
  console.error(
    "Media restore failed. Check backup verification, destination confirmation, permissions and connectivity. No files are overwritten and no credentials are logged.",
  );
  process.exitCode = 1;
});
