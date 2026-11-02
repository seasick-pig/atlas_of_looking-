import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import seed from "../data/archives.seed.json";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error Plain Node restoration script.
import { prepareRestore } from "../scripts/prepare-restore.mjs";
// @ts-expect-error Plain Node checksum helper.
import { sha256 } from "../scripts/backup.mjs";

// Actual PostgreSQL policies/triggers via WASM. auth/storage schemas emulate their
// SQL contracts; Supabase Auth and signed-URL HTTP behavior still need live checks.
let db: PGlite;
const admin = "11111111-1111-4111-8111-111111111111";
const reader = "22222222-2222-4222-8222-222222222222";
async function as(role = "postgres", uid = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec(`set role ${role}`);
}
const count = async (table: string) =>
  Number(
    (await db.query<{ count: number }>(`select count(*) from ${table}`)).rows[0]
      .count,
  );
const imported = async (entries: unknown[], overwrite = false, versions = {}) =>
  db.query<{ n: number }>(
    "select public.import_archives($1::jsonb,$2,$3::jsonb) as n",
    [JSON.stringify(entries), overwrite, JSON.stringify(versions)],
  );
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon noinherit; create role authenticated noinherit;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth,storage to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
  `);
  await db.exec(readFileSync("supabase/migrations/001_archive.sql", "utf8"));
}, 30000);
beforeEach(async () => {
  await as();
  await db.exec(
    "truncate public.archives,public.archive_versions,public.site_admins,storage.objects,auth.users cascade",
  );
  await db.query("insert into auth.users(id) values ($1),($2)", [
    admin,
    reader,
  ]);
  await db.query("insert into public.site_admins(user_id) values ($1)", [
    admin,
  ]);
  await db.exec(`insert into public.archives(id,number,name,body,status,image_path,image_credit,image_alt) values
  ('public-file',90,'Public','Public research','published','public-file/cover.jpg','Licensed','Public image'),
  ('private-file',91,'Private','SECRET DRAFT','draft','private-file/cover.jpg','Licensed','Private image');
  insert into storage.objects(bucket_id,name) values('archive-images','public-file/cover.jpg'),('archive-images','private-file/cover.jpg'),('archive-images','orphan.jpg');`);
});
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL RLS and archive lifecycle", () => {
  it("anonymous visitors read published content only", async () => {
    await as("anon");
    expect((await db.query("select id from public.archives")).rows).toEqual([
      { id: "public-file" },
    ]);
  });
  it("authenticated non-admin visitors also cannot read drafts", async () => {
    await as("authenticated", reader);
    expect(await count("public.archives")).toBe(1);
    expect(
      (await db.query("select public.is_site_admin() as ok")).rows[0],
    ).toEqual({ ok: false });
  });
  it("anonymous users cannot insert or use the import RPC", async () => {
    await as("anon");
    await expect(
      db.exec(
        "insert into public.archives(id,number,name) values('bad',5,'Bad')",
      ),
    ).rejects.toThrow();
    await expect(imported(seed.records)).rejects.toThrow();
  });
  it("non-admin users cannot insert, update, delete or self-promote", async () => {
    await as("authenticated", reader);
    await expect(
      db.exec(
        "insert into public.archives(id,number,name) values('bad',5,'Bad')",
      ),
    ).rejects.toThrow();
    expect(
      (await db.query("update public.archives set name='hacked' returning id"))
        .rows,
    ).toHaveLength(0);
    expect(
      (await db.query("delete from public.archives returning id")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("insert into public.site_admins values ($1)", [reader]),
    ).rejects.toThrow();
    await expect(imported(seed.records)).rejects.toThrow();
  });
  it("admins can create drafts, publish, edit, and delete with private revision snapshots", async () => {
    await as("authenticated", admin);
    expect(await count("public.archives")).toBe(2);
    await db.exec(
      "insert into public.archives(id,number,name,body) values('new-file',5,'New','Research'); update public.archives set status='published' where id='new-file'; update public.archives set body='Edited' where id='new-file'; delete from public.archives where id='new-file';",
    );
    const history = await db.query<{
      operation: string;
      snapshot: { body: string };
    }>(
      "select operation,snapshot from public.archive_versions where archive_id='new-file' order by recorded_at,id",
    );
    expect(history.rows.map((r) => r.operation).sort()).toEqual([
      "DELETE",
      "INSERT",
      "UPDATE",
      "UPDATE",
    ]);
    expect(
      history.rows.some(
        (r) => r.operation === "DELETE" && r.snapshot.body === "Edited",
      ),
    ).toBe(true);
  });
  it("history is inaccessible to visitors and cannot be forged by admins", async () => {
    await as("anon");
    await expect(count("public.archive_versions")).rejects.toThrow();
    await as("authenticated", reader);
    expect(await count("public.archive_versions")).toBe(0);
    await as("authenticated", admin);
    expect(await count("public.archive_versions")).toBe(2);
    await expect(
      db.exec("delete from public.archive_versions"),
    ).rejects.toThrow();
  });
  it("draft and orphan media are private, published referenced media can be read", async () => {
    await as("anon");
    expect((await db.query("select name from storage.objects")).rows).toEqual([
      { name: "public-file/cover.jpg" },
    ]);
    await as("authenticated", reader);
    expect(await count("storage.objects")).toBe(1);
    await as("authenticated", admin);
    expect(await count("storage.objects")).toBe(3);
  });
  it("unpublishing immediately revokes new media read authorization", async () => {
    await as("authenticated", admin);
    await db.exec(
      "update public.archives set status='draft' where id='public-file'",
    );
    await as("anon");
    expect(await count("storage.objects")).toBe(0);
  });
  it("only admins may upload, update or delete media", async () => {
    await as("authenticated", reader);
    await expect(
      db.exec(
        "insert into storage.objects(bucket_id,name) values('archive-images','bad.jpg')",
      ),
    ).rejects.toThrow();
    expect(
      (await db.query("update storage.objects set name='bad' returning id"))
        .rows,
    ).toHaveLength(0);
    expect(
      (await db.query("delete from storage.objects returning id")).rows,
    ).toHaveLength(0);
    await as("authenticated", admin);
    await db.exec(
      "insert into storage.objects(bucket_id,name) values('archive-images','new.jpg')",
    );
    expect(await count("storage.objects")).toBe(4);
  });
  it("imports all 13 seed dossiers as drafts, even if input requests publication", async () => {
    await as("authenticated", admin);
    const result = await imported(
      seed.records.map((a) => ({ ...a, status: "published" })),
    );
    expect(result.rows[0].n).toBe(13);
    const rows = await db.query<{ body: string; status: string }>(
      "select body,status from public.archives where id='michael-wolf'",
    );
    expect(rows.rows[0].body).toBe(seed.records[11].body);
    expect(rows.rows[0].status).toBe("draft");
    await as("anon");
    expect(await count("public.archives")).toBe(1);
  });
  it("rejects duplicate imports without overwriting earlier edits", async () => {
    await as("authenticated", admin);
    await imported([seed.records[0]]);
    await expect(imported([seed.records[0]])).rejects.toThrow("already exists");
  });
  it("rolls back the entire import when a later record has a number collision", async () => {
    await as("authenticated", admin);
    await expect(
      imported([
        { ...seed.records[0], id: "aaa-new" },
        { ...seed.records[1], number: 90 },
      ]),
    ).rejects.toThrow();
    expect(
      (await db.query("select id from public.archives where id='aaa-new'"))
        .rows,
    ).toHaveLength(0);
  });
  it("rejects stale bulk replacements and accepts exact versions, restoring draft status", async () => {
    await as("authenticated", admin);
    const row = { ...seed.records[0], id: "public-file", number: 90 };
    await expect(
      imported([row], true, { "public-file": "2000-01-01T00:00:00Z" }),
    ).rejects.toThrow("changed");
    const current = (
      await db.query<{ updated_at: string }>(
        "select updated_at from public.archives where id='public-file'",
      )
    ).rows[0].updated_at;
    await imported([row], true, { "public-file": current });
    expect(
      (
        await db.query(
          "select status from public.archives where id='public-file'",
        )
      ).rows[0],
    ).toEqual({ status: "draft" });
  });
  it("protects immutable IDs and timestamps, and prevents empty public records", async () => {
    await as("authenticated", admin);
    await expect(
      db.exec("update public.archives set id='renamed' where id='public-file'"),
    ).rejects.toThrow("immutable");
    await db.exec(
      "update public.archives set created_at='1900-01-01',updated_at='1900-01-01' where id='public-file'",
    );
    const r = (
      await db.query<{ created_at: Date; updated_at: Date }>(
        "select created_at,updated_at from public.archives where id='public-file'",
      )
    ).rows[0];
    expect(new Date(r.created_at).getFullYear()).toBeGreaterThan(2020);
    expect(new Date(r.updated_at).getFullYear()).toBeGreaterThan(2020);
    await expect(
      db.exec(
        "insert into public.archives(id,number,name,status) values('empty',50,'Empty','published')",
      ),
    ).rejects.toThrow();
  });
  it("restores exact data and history from a checksummed backup, and refuses nonempty destinations", async () => {
    await as("authenticated", admin);
    await imported(seed.records);
    await db.query(
      "update public.archives set body=$1 where id='nam-june-paik'",
      ["O'Brien — literal SQL text: '); drop table archives; --"],
    );
    await as();
    // Media restore is a separate Storage API operation; no media in this database-only fixture.
    await db.exec("update public.archives set image_path=''");
    const records = (
      await db.query("select * from public.archives order by id")
    ).rows;
    const versions = (
      await db.query("select * from public.archive_versions order by id")
    ).rows;
    const dir = await mkdtemp(join(tmpdir(), "atlas-restore-"));
    try {
      const files = {
        "archives.json": JSON.stringify({
          format: "atlas-of-looking",
          version: 1,
          records,
        }),
        "archive_versions.json": JSON.stringify(versions),
        "schema.sql": readFileSync(
          "supabase/migrations/001_archive.sql",
          "utf8",
        ),
      };
      for (const [path, data] of Object.entries(files))
        await writeFile(join(dir, path), data);
      await writeFile(
        join(dir, "manifest.json"),
        JSON.stringify({
          format: "atlas-full-backup",
          version: 1,
          files: Object.entries(files).map(([path, data]) => ({
            path,
            bytes: Buffer.byteLength(data),
            sha256: sha256(data),
          })),
        }),
      );
      const output = join(dir, "restore.sql");
      await prepareRestore(dir, output);
      const sql = await readFile(output, "utf8");
      await expect(db.exec(sql)).rejects.toThrow("empty");
      await db.exec("rollback");
      await db.exec("truncate public.archives,public.archive_versions");
      await db.exec(sql);
      expect(
        (await db.query("select * from public.archives order by id")).rows,
      ).toEqual(records);
      expect(
        (await db.query("select * from public.archive_versions order by id"))
          .rows,
      ).toEqual(versions);
      await as("anon");
      expect(await count("public.archives")).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
