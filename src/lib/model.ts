export const kinds = {
  artist: { label: "艺术家档案", short: "艺术家", en: "Artists", prefix: "A" },
  work: { label: "作品档案", short: "作品", en: "Works", prefix: "W" },
  theme: { label: "主题研究", short: "研究", en: "Research", prefix: "R" },
  note: { label: "个人札记", short: "札记", en: "Notes", prefix: "N" },
  reference: {
    label: "参考文献",
    short: "文献",
    en: "Bibliography",
    prefix: "B",
  },
} as const;
export type Kind = keyof typeof kinds;
export type Source = { label: string; url: string; note: string };
export type Work = { title: string; year: string; analysis: string };
export type Archive = {
  id: string;
  number: number;
  kind: Kind;
  name: string;
  en: string;
  years: string;
  medium: string;
  tags: string[];
  intro: string;
  body: string;
  sources: Source[];
  works: Work[];
  related_ids: string[];
  status: "draft" | "published";
  verification: "pending" | "verified";
  verification_note: string;
  image_path: string;
  image_url: string;
  image_caption: string;
  image_credit: string;
  image_alt: string;
  created_at: string;
  updated_at: string;
};
export const numberOf = (a: Archive) =>
  `${kinds[a.kind].prefix}.${String(a.number).padStart(3, "0")}`;
export function safeURL(value: string): string {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}
export function emptyArchive(number: number): Archive {
  return {
    id: "",
    number,
    kind: "artist",
    name: "",
    en: "",
    years: "",
    medium: "",
    tags: [],
    intro: "",
    body: "",
    sources: [],
    works: [],
    related_ids: [],
    status: "draft",
    verification: "pending",
    verification_note: "",
    image_path: "",
    image_url: "",
    image_caption: "",
    image_credit: "",
    image_alt: "",
    created_at: "",
    updated_at: "",
  };
}
const string = (v: unknown, key: string, max = 200000) => {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string" || v.length > max)
    throw new Error(`${key} 必须是文本，且长度不超过 ${max}`);
  return v;
};
const strings = (v: unknown, key: string) => {
  if (v === undefined) return [];
  if (
    !Array.isArray(v) ||
    v.length > 200 ||
    v.some((s) => typeof s !== "string" || s.length > 200)
  )
    throw new Error(`${key} 必须是字符串数组（最多 200 项）`);
  return [...new Set(v)] as string[];
};
export function normalizeRecord(input: unknown): Archive {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("档案必须是对象");
  const v = input as Record<string, unknown>;
  const a = emptyArchive(Number(v.number));
  a.id = string(v.id, "id", 120);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(a.id))
    throw new Error("ID 只允许小写字母、数字和连字符");
  if (!Number.isSafeInteger(a.number) || a.number < 1 || a.number > 1000000)
    throw new Error("编号必须为 1–1000000 的整数");
  a.kind = (v.kind || "artist") as Kind;
  if (!Object.hasOwn(kinds, a.kind)) throw new Error("未知档案类型");
  for (const k of [
    "name",
    "en",
    "years",
    "medium",
    "intro",
    "body",
    "verification_note",
    "image_path",
    "image_url",
    "image_caption",
    "image_credit",
    "image_alt",
  ] as const)
    a[k] = string(v[k], k);
  if (!a.name.trim()) throw new Error("档案名称不能为空");
  a.tags = strings(v.tags, "tags");
  a.related_ids = strings(v.related_ids, "related_ids");
  if (a.related_ids.includes(a.id)) throw new Error("档案不能关联自身");
  a.status = v.status === "published" ? "published" : "draft";
  a.verification = v.verification === "verified" ? "verified" : "pending";
  for (const key of ["image_url"] as const)
    if (a[key] && !safeURL(a[key]))
      throw new Error("图片链接必须是有效的 HTTPS 地址");
  const sources =
    typeof v.sources === "string"
      ? v.sources
          .split(/\s+/)
          .filter(Boolean)
          .map((url, i) => ({
            label: `原稿参考资料 ${i + 1}`,
            url,
            note: "待核实",
          }))
      : v.sources || [];
  if (!Array.isArray(sources) || sources.length > 200)
    throw new Error("参考资料格式错误");
  a.sources = sources.map((s: Source) => {
    if (!s || typeof s !== "object") throw new Error("参考资料格式错误");
    const source = {
      label: string(s.label, "来源名称", 1000),
      url: string(s.url, "来源链接", 3000),
      note: string(s.note, "来源备注"),
    };
    if (source.url && !safeURL(source.url))
      throw new Error("参考链接必须是 HTTPS 地址");
    return source;
  });
  if (
    !Array.isArray(v.works ?? []) ||
    ((v.works as unknown[]) || []).length > 200
  )
    throw new Error("代表作品格式错误");
  a.works = ((v.works || []) as Work[]).map((w) => {
    if (!w || typeof w !== "object") throw new Error("代表作品格式错误");
    return {
      title: string(w.title, "作品名称"),
      year: string(w.year, "作品年代"),
      analysis: string(w.analysis, "作品分析"),
    };
  });
  a.created_at = string(v.created_at, "created_at");
  a.updated_at = string(v.updated_at, "updated_at");
  return a;
}
export type Backup = {
  format: "atlas-of-looking";
  version: 1;
  exported_at?: string;
  records: Archive[];
};
export function parseImport(text: string): Archive[] {
  if (text.length > 10 * 1024 * 1024)
    throw new Error("JSON 文件不可超过 10 MB");
  const data = JSON.parse(text);
  if (
    !Array.isArray(data) &&
    (data?.format !== "atlas-of-looking" || data?.version !== 1)
  )
    throw new Error("不支持的备份格式或版本");
  const records = Array.isArray(data) ? data : data.records;
  if (!Array.isArray(records) || !records.length || records.length > 1000)
    throw new Error("每次导入 1–1000 份档案");
  const normalized = records.map(normalizeRecord);
  if (new Set(normalized.map((a) => a.id)).size !== normalized.length)
    throw new Error("导入文件包含重复 ID");
  if (
    new Set(normalized.map((a) => `${a.kind}:${a.number}`)).size !==
    normalized.length
  )
    throw new Error("同一类型内的编号不能重复");
  return normalized;
}
export function exportJSON(records: Archive[]): string {
  return JSON.stringify(
    {
      format: "atlas-of-looking",
      version: 1,
      exported_at: new Date().toISOString(),
      records,
    },
    null,
    2,
  );
}
export function downloadJSON(records: Archive[]) {
  const url = URL.createObjectURL(
    new Blob([exportJSON(records)], { type: "application/json;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `atlas-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
