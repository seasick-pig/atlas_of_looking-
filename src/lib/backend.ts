import { createClient } from "@supabase/supabase-js";
import type { Archive } from "./model";
import type { SiteConfig } from "../../config/resolve-site";

declare const __ATLAS_SITE_CONFIG__: SiteConfig;
const site = __ATLAS_SITE_CONFIG__;
export const demo = site.demo;
export const supabase = demo
  ? null
  : createClient(site.supabaseUrl, site.supabasePublishableKey);
export async function loadArchives(): Promise<Archive[]> {
  if (!supabase) {
    const r = await fetch("/demo-data.json");
    if (!r.ok) throw new Error("无法读取本地档案");
    return (await r.json()).records;
  }
  const all: Archive[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("archives")
      .select("*")
      .order("kind")
      .order("number")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    all.push(...(data as Archive[]));
    if (data.length < 500) break;
  }
  return all;
}
export async function saveArchive(record: Archive, isNew: boolean) {
  if (!supabase) throw new Error("当前为只读预览");
  const { created_at: _created, updated_at: _updated, ...row } = record;
  if (isNew) {
    const { error } = await supabase.from("archives").insert(row);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("archives")
      .update(row)
      .eq("id", record.id)
      .eq("updated_at", record.updated_at)
      .select("id");
    if (error) throw error;
    if (!data?.length)
      throw new Error(
        "此档案已在另一处更新或删除。请先导出当前编辑内容，再重新载入。",
      );
  }
}
export async function resolveImage(path: string): Promise<string> {
  if (!supabase || !path) return "";
  const { data, error } = await supabase.storage
    .from("archive-images")
    .createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}
