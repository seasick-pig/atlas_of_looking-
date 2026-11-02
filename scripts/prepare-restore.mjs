import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBackup } from "./verify-backup.mjs";
import { safePath } from "./backup.mjs";

export async function prepareRestore(directory, output) {
  await verifyBackup(directory);
  const records = JSON.parse(
    await readFile(safePath(directory, "archives.json"), "utf8"),
  ).records;
  const versions = JSON.parse(
    await readFile(safePath(directory, "archive_versions.json"), "utf8"),
  );
  const literal = (data) =>
    `'${JSON.stringify(data).replace(/'/g, "''")}'::jsonb`;
  const sql = `-- PRIVATE BACKUP. Run as database owner after 001_archive.sql in an EMPTY destination.
begin;
set local standard_conforming_strings = on;
do $$ begin
  if exists(select 1 from public.archives) or exists(select 1 from public.archive_versions) then
    raise exception 'Restore requires empty archive and history tables';
  end if;
end $$;
-- Restoring exact original timestamps and revision IDs, without new audit entries.
alter table public.archives disable trigger user;
insert into public.archives select * from jsonb_populate_recordset(null::public.archives, ${literal(records)});
insert into public.archive_versions select * from jsonb_populate_recordset(null::public.archive_versions, ${literal(versions)});
alter table public.archives enable trigger user;
commit;
`;
  await writeFile(output, sql, { mode: 0o600, flag: "wx" });
  return { records: records.length, versions: versions.length };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.argv[2] || !process.argv[3]) {
    console.error(
      "Usage: node scripts/prepare-restore.mjs <backup-directory> <private-output.sql>",
    );
    process.exitCode = 1;
  } else
    prepareRestore(resolve(process.argv[2]), resolve(process.argv[3]))
      .then((r) =>
        console.log(
          `Prepared ${r.records} records and ${r.versions} history snapshots. Restore media separately before making the destination public.`,
        ),
      )
      .catch((e) => {
        console.error(e.message);
        process.exitCode = 1;
      });
}
