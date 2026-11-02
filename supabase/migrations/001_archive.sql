-- Run once in a new Supabase project's SQL Editor, as the project owner.
-- No passwords or keys belong in this file.
begin;

create table public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from anon, authenticated;
grant select on public.site_admins to authenticated;
create policy "admins read own membership" on public.site_admins
  for select to authenticated using (user_id = (select auth.uid()));

create function public.is_site_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.site_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to anon, authenticated;

create table public.archives (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$' and length(id) <= 120),
  number integer not null check (number between 1 and 1000000),
  kind text not null default 'artist' check (kind in ('artist','work','theme','note','reference')),
  name text not null check (length(trim(name)) > 0),
  en text not null default '', years text not null default '', medium text not null default '',
  tags text[] not null default '{}', intro text not null default '', body text not null default '',
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  works jsonb not null default '[]' check (jsonb_typeof(works) = 'array'),
  related_ids text[] not null default '{}' check (not (id = any(related_ids))),
  status text not null default 'draft' check (status in ('draft','published')),
  verification text not null default 'pending' check (verification in ('pending','verified')),
  verification_note text not null default '',
  image_path text not null default '',
  image_url text not null default '' check (image_url = '' or image_url ~ '^https://'),
  image_caption text not null default '', image_credit text not null default '', image_alt text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (kind, number),
  check (status <> 'published' or length(trim(body)) > 0),
  check ((image_path = '' and image_url = '') or (length(trim(image_credit)) > 0 and length(trim(image_alt)) > 0))
);
create index archives_public_index on public.archives(kind, number) where status = 'published';
create index archives_tags_index on public.archives using gin(tags);
alter table public.archives enable row level security;
revoke all on public.archives from anon, authenticated;
grant select on public.archives to anon, authenticated;
grant insert, update, delete on public.archives to authenticated;
create policy "published or admin read" on public.archives for select to anon, authenticated
  using (status = 'published' or (select public.is_site_admin()));
create policy "admin insert" on public.archives for insert to authenticated
  with check ((select public.is_site_admin()));
create policy "admin update" on public.archives for update to authenticated
  using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "admin delete" on public.archives for delete to authenticated
  using ((select public.is_site_admin()));

-- Full snapshots on every mutation, including deleted records. Private to admins.
create table public.archive_versions (
  id uuid primary key default gen_random_uuid(),
  archive_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  snapshot jsonb not null,
  actor uuid,
  recorded_at timestamptz not null default now()
);
create index archive_versions_archive on public.archive_versions(archive_id, recorded_at desc);
alter table public.archive_versions enable row level security;
revoke all on public.archive_versions from anon, authenticated;
grant select on public.archive_versions to authenticated;
create policy "admin read history" on public.archive_versions for select to authenticated
  using ((select public.is_site_admin()));

create function public.archive_timestamps() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.id <> old.id then raise exception 'Archive IDs are immutable'; end if;
    new.created_at := old.created_at;
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  else
    new.created_at := clock_timestamp(); new.updated_at := new.created_at;
  end if;
  return new;
end;
$$;
create trigger archive_timestamps before insert or update on public.archives
  for each row execute function public.archive_timestamps();

create function public.record_archive_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    insert into public.archive_versions(archive_id, operation, snapshot, actor)
      values(old.id, TG_OP, to_jsonb(old), auth.uid());
    return old;
  end if;
  insert into public.archive_versions(archive_id, operation, snapshot, actor)
    values(new.id, TG_OP, to_jsonb(new), auth.uid());
  return new;
end;
$$;
revoke all on function public.record_archive_version() from public;
create trigger record_archive_version after insert or update or delete on public.archives
  for each row execute function public.record_archive_version();

-- Atomic imports. The default rejects duplicates; replacement requires current versions.
-- SECURITY INVOKER: table RLS remains in force, in addition to the explicit admin check.
create function public.import_archives(entries jsonb, overwrite_existing boolean default false, expected_versions jsonb default '{}')
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  r public.archives; current_version timestamptz; processed integer := 0;
begin
  if not public.is_site_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) < 1 or jsonb_array_length(entries) > 1000
    or octet_length(entries::text) > 10485760 then raise exception 'Expected 1–1000 records, maximum 10 MB'; end if;
  if (select count(*) <> count(distinct value->>'id') from jsonb_array_elements(entries)) then
    raise exception 'Duplicate IDs in import';
  end if;
  for r in select * from jsonb_populate_recordset(null::public.archives, entries) order by id loop
    select updated_at into current_version from public.archives where id = r.id for update;
    if found then
      if not overwrite_existing then raise exception 'Archive already exists: %', r.id; end if;
      if (expected_versions->>r.id) is null or (expected_versions->>r.id)::timestamptz <> current_version then
        raise exception 'Archive changed since preview: %', r.id;
      end if;
      update public.archives set
        number=r.number, kind=r.kind, name=r.name, en=coalesce(r.en,''), years=coalesce(r.years,''), medium=coalesce(r.medium,''),
        tags=coalesce(r.tags,'{}'), intro=coalesce(r.intro,''), body=coalesce(r.body,''), sources=coalesce(r.sources,'[]'), works=coalesce(r.works,'[]'),
        related_ids=coalesce(r.related_ids,'{}'), status='draft', verification=coalesce(r.verification,'pending'), verification_note=coalesce(r.verification_note,''),
        image_path=coalesce(r.image_path,''),image_url=coalesce(r.image_url,''),image_caption=coalesce(r.image_caption,''),image_credit=coalesce(r.image_credit,''),image_alt=coalesce(r.image_alt,'')
        where id=r.id;
    else
      insert into public.archives(id,number,kind,name,en,years,medium,tags,intro,body,sources,works,related_ids,status,verification,verification_note,image_path,image_url,image_caption,image_credit,image_alt)
      values(r.id,r.number,coalesce(r.kind,'artist'),r.name,coalesce(r.en,''),coalesce(r.years,''),coalesce(r.medium,''),coalesce(r.tags,'{}'),coalesce(r.intro,''),coalesce(r.body,''),coalesce(r.sources,'[]'),coalesce(r.works,'[]'),coalesce(r.related_ids,'{}'),'draft',coalesce(r.verification,'pending'),coalesce(r.verification_note,''),coalesce(r.image_path,''),coalesce(r.image_url,''),coalesce(r.image_caption,''),coalesce(r.image_credit,''),coalesce(r.image_alt,''));
    end if;
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;
revoke all on function public.import_archives(jsonb, boolean, jsonb) from public;
grant execute on function public.import_archives(jsonb, boolean, jsonb) to authenticated;

-- Private media. Anonymous signed-URL issuance/download requires a published reference.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('archive-images','archive-images',false,10485760,array['image/jpeg','image/png','image/webp','image/avif']);
create policy "read published archive image or admin" on storage.objects for select to anon, authenticated
  using (bucket_id='archive-images' and (
    (select public.is_site_admin()) or exists(select 1 from public.archives where status='published' and image_path=storage.objects.name)
  ));
create policy "admin upload image" on storage.objects for insert to authenticated
  with check(bucket_id='archive-images' and (select public.is_site_admin()));
create policy "admin update image" on storage.objects for update to authenticated
  using(bucket_id='archive-images' and (select public.is_site_admin()))
  with check(bucket_id='archive-images' and (select public.is_site_admin()));
create policy "admin delete image" on storage.objects for delete to authenticated
  using(bucket_id='archive-images' and (select public.is_site_admin()));
commit;
