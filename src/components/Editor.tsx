import { useEffect, useRef, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  Upload,
  Download,
  ArrowRight,
} from "lucide-react";
import {
  type Archive,
  type Source,
  type Work,
  kinds,
  normalizeRecord,
  parseImport,
  downloadJSON,
} from "../lib/model";
import { supabase, saveArchive } from "../lib/backend";

function useDialog(close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button,input")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose.current();
      }
      if (e.key === "Tab") {
        const els = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
          ) || []),
        ].filter((el) => el.offsetParent !== null);
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, []);
  return ref;
}
const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "操作失败，请重试。";

export function Editor({
  record,
  isNew,
  records,
  onClose,
  onSaved,
  notify,
}: {
  record: Archive;
  isNew: boolean;
  records: Archive[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [a, setA] = useState<Archive>(structuredClone(record));
  const [tagsText, setTagsText] = useState(record.tags.join("，"));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty =
    JSON.stringify(a) !== JSON.stringify(record) ||
    !!file ||
    tagsText !== record.tags.join("，");
  function close() {
    if (busy) return;
    if (
      !dirty ||
      confirm("还有未保存的内容，确定关闭吗？建议先导出当前编辑稿。")
    )
      onClose();
  }
  const dialog = useDialog(close);
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, [dirty]);
  function patch<K extends keyof Archive>(key: K, value: Archive[K]) {
    setA((prev) => ({ ...prev, [key]: value }));
  }
  function source(i: number, key: keyof Source, value: string) {
    patch(
      "sources",
      a.sources.map((s, j) => (j === i ? { ...s, [key]: value } : s)),
    );
  }
  function work(i: number, key: keyof Work, value: string) {
    patch(
      "works",
      a.works.map((s, j) => (j === i ? { ...s, [key]: value } : s)),
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !supabase) return;
    setBusy(true);
    setError("");
    try {
      let row = normalizeRecord(a);
      if (row.status === "published" && !row.body.trim())
        throw new Error("发布前请填写研究正文。");
      if (
        (file || row.image_path || row.image_url) &&
        (!row.image_credit.trim() || !row.image_alt.trim())
      )
        throw new Error("请为图片填写来源／授权说明与替代文本。");
      if (file) {
        const types: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/avif": "avif",
        };
        if (!types[file.type] || file.size > 10 * 1024 * 1024)
          throw new Error(
            "仅支持不超过 10 MB 的 JPEG、PNG、WebP 或 AVIF 图像。",
          );
        const path = `${row.id}/${crypto.randomUUID()}.${types[file.type]}`;
        const { error } = await supabase.storage
          .from("archive-images")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        row = { ...row, image_path: path, image_url: "" };
        // Keep the uploaded path if a later database write fails, so retry doesn't upload twice.
        setA(row);
        setFile(null);
      }
      await saveArchive(row, isNew);
      await onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !supabase ||
      busy ||
      !confirm(
        `确定删除「${a.name}」？公开页面会立即撤下。修订记录保留在管理员历史中；图片保留在私有备份存储中。`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("archives")
        .delete()
        .eq("id", a.id)
        .eq("updated_at", record.updated_at)
        .select("id");
      if (error) throw error;
      if (!data?.length)
        throw new Error("档案已被其他会话修改。请重新载入后再删除。");
      await onSaved();
      notify("档案已删除，历史与图片保留供备份恢复。");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div
        className="modal editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        ref={dialog}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">ARCHIVE WORKSPACE</p>
            <h2 id="editor-title">
              {isNew ? "新建档案" : `编辑 · ${record.name}`}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭编辑器"
            onClick={close}
            disabled={busy}
          >
            <X />
          </button>
        </div>
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <div className="form-columns">
              <label>
                档案类型
                <select
                  value={a.kind}
                  onChange={(e) => {
                    const kind = e.target.value as Archive["kind"];
                    patch("kind", kind);
                    if (isNew)
                      patch(
                        "number",
                        Math.max(
                          0,
                          ...records
                            .filter((r) => r.kind === kind)
                            .map((r) => r.number),
                        ) + 1,
                      );
                  }}
                >
                  {Object.entries(kinds).map(([key, k]) => (
                    <option value={key} key={key}>
                      {k.label} / {k.en}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                编号
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  required
                  value={a.number}
                  onChange={(e) => patch("number", Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              唯一 ID（创建后固定）
              <input
                pattern="[a-z0-9][a-z0-9-]*"
                maxLength={120}
                required
                readOnly={!isNew}
                placeholder="artist-name 或 research-title"
                value={a.id}
                onChange={(e) => patch("id", e.target.value)}
              />
            </label>
            <div className="form-columns">
              <label>
                中文名／标题
                <input
                  required
                  value={a.name}
                  onChange={(e) => patch("name", e.target.value)}
                />
              </label>
              <label>
                英文名／标题
                <input
                  value={a.en}
                  onChange={(e) => patch("en", e.target.value)}
                />
              </label>
            </div>
            <div className="form-columns">
              <label>
                生卒年／作品年代
                <input
                  value={a.years}
                  onChange={(e) => patch("years", e.target.value)}
                />
              </label>
              <label>
                媒介
                <input
                  value={a.medium}
                  onChange={(e) => patch("medium", e.target.value)}
                />
              </label>
            </div>
            <label>
              关键词（中英文逗号分隔）
              <input
                value={tagsText}
                onChange={(e) => {
                  setTagsText(e.target.value);
                  patch(
                    "tags",
                    e.target.value
                      .split(/[,，]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  );
                }}
              />
            </label>
            <label>
              简介
              <textarea
                rows={3}
                value={a.intro}
                onChange={(e) => patch("intro", e.target.value)}
              />
            </label>
            <label>
              研究正文
              <textarea
                className="body-editor"
                rows={16}
                placeholder="以空行分段，可使用「小节标题｜正文」组织内容。正文以纯文本保存，避免不安全的 HTML。"
                value={a.body}
                onChange={(e) => patch("body", e.target.value)}
              />
            </label>
            <div className="form-section">
              <div className="row">
                <h3>代表作品与分析</h3>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    patch("works", [
                      ...a.works,
                      { title: "", year: "", analysis: "" },
                    ])
                  }
                >
                  <Plus size={16} />
                  添加作品
                </button>
              </div>
              {a.works.map((w, i) => (
                <div className="nested-fields" key={i}>
                  <div className="form-columns">
                    <label>
                      作品名称
                      <input
                        value={w.title}
                        onChange={(e) => work(i, "title", e.target.value)}
                      />
                    </label>
                    <label>
                      年代
                      <input
                        value={w.year}
                        onChange={(e) => work(i, "year", e.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    作品分析
                    <textarea
                      value={w.analysis}
                      onChange={(e) => work(i, "analysis", e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-link danger"
                    onClick={() =>
                      patch(
                        "works",
                        a.works.filter((_, j) => i !== j),
                      )
                    }
                  >
                    移除此作品条目
                  </button>
                </div>
              ))}
            </div>
            <div className="form-section">
              <div className="row">
                <h3>参考资料</h3>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    patch("sources", [
                      ...a.sources,
                      { label: "", url: "", note: "待核实" },
                    ])
                  }
                >
                  <Plus size={16} />
                  添加来源
                </button>
              </div>
              {a.sources.map((s, i) => (
                <div className="nested-fields" key={i}>
                  <label>
                    来源名称
                    <input
                      value={s.label}
                      onChange={(e) => source(i, "label", e.target.value)}
                    />
                  </label>
                  <label>
                    HTTPS 链接
                    <input
                      type="url"
                      placeholder="https://…"
                      value={s.url}
                      onChange={(e) => source(i, "url", e.target.value)}
                    />
                  </label>
                  <label>
                    备注／引用页码／访问日期
                    <input
                      value={s.note}
                      onChange={(e) => source(i, "note", e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-link danger"
                    onClick={() =>
                      patch(
                        "sources",
                        a.sources.filter((_, j) => i !== j),
                      )
                    }
                  >
                    移除此来源
                  </button>
                </div>
              ))}
            </div>
            <div className="form-section">
              <h3>图像与使用权限</h3>
              <p className="small muted">
                上传图片保存在私有存储桶；仅已发布档案引用的图片可供访客获取短期访问链接。本站生成的链接有效期为
                10 分钟；撤回发布不会立即撤销已签发链接。外部 URL
                无法由本站撤销访问。
              </p>
              <label>
                上传图片（最大 10 MB）
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              {a.image_path && (
                <p className="small">
                  已关联图片：{a.image_path}
                  <button
                    type="button"
                    className="text-link danger"
                    onClick={() => patch("image_path", "")}
                  >
                    移除关联
                  </button>
                </p>
              )}
              <label>
                或使用外部 HTTPS 图片链接
                <input
                  type="url"
                  value={a.image_url}
                  onChange={(e) => {
                    patch("image_url", e.target.value);
                    if (e.target.value) patch("image_path", "");
                  }}
                />
              </label>
              <label>
                图注
                <input
                  value={a.image_caption}
                  onChange={(e) => patch("image_caption", e.target.value)}
                />
              </label>
              <label>
                图片来源与授权说明
                <input
                  value={a.image_credit}
                  onChange={(e) => patch("image_credit", e.target.value)}
                />
              </label>
              <label>
                替代文本（描述图像，供屏幕阅读器使用）
                <input
                  value={a.image_alt}
                  onChange={(e) => patch("image_alt", e.target.value)}
                />
              </label>
            </div>
            <div className="form-section">
              <h3>交叉关联</h3>
              <div className="relation-picker">
                {records
                  .filter((r) => r.id !== a.id)
                  .map((r) => (
                    <label className="checkbox" key={r.id}>
                      <input
                        type="checkbox"
                        checked={a.related_ids.includes(r.id)}
                        onChange={(e) =>
                          patch(
                            "related_ids",
                            e.target.checked
                              ? [...a.related_ids, r.id]
                              : a.related_ids.filter((id) => id !== r.id),
                          )
                        }
                      />
                      {r.name}
                      <small>
                        {r.status === "draft"
                          ? "草稿 · 不对访客展示"
                          : kinds[r.kind].short}
                      </small>
                    </label>
                  ))}
              </div>
            </div>
            <div className="form-section">
              <h3>核实与发布</h3>
              <label>
                资料核实状态
                <select
                  value={a.verification}
                  onChange={(e) =>
                    patch(
                      "verification",
                      e.target.value as Archive["verification"],
                    )
                  }
                >
                  <option value="pending">待核实 · 研究整理稿</option>
                  <option value="verified">已人工核对原始资料</option>
                </select>
              </label>
              <label>
                核实说明
                <textarea
                  rows={3}
                  value={a.verification_note}
                  onChange={(e) => patch("verification_note", e.target.value)}
                />
              </label>
              <label>
                可见性
                <select
                  value={a.status}
                  onChange={(e) =>
                    patch("status", e.target.value as Archive["status"])
                  }
                >
                  <option value="draft">保存为草稿 · 仅管理员可读</option>
                  <option value="published">公开发布 · 所有访客可读</option>
                </select>
              </label>
              <p className="small muted">
                发布研究整理稿时，页面仍会显示“待核实”。请先确认正文与图片有适当公开权限。
              </p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="editor-actions">
              <button className="button" type="submit">
                <Save size={16} />
                {busy
                  ? "正在保存…"
                  : a.status === "published"
                    ? "保存并发布"
                    : "保存草稿"}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => downloadJSON([a])}
              >
                <Download size={16} />
                导出当前编辑稿
              </button>
              {!isNew && (
                <button
                  className="text-link danger"
                  type="button"
                  onClick={() => void remove()}
                >
                  <Trash2 size={16} />
                  删除
                </button>
              )}
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}

export function ImportPanel({
  records,
  onClose,
  onDone,
}: {
  records: Archive[];
  onClose: () => void;
  onDone: (count: number) => Promise<void>;
}) {
  const [rows, setRows] = useState<Archive[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const dialog = useDialog(() => {
    if (!busy) onClose();
  });
  const existing = rows.filter((a) => records.some((r) => r.id === a.id));
  async function select(file?: File) {
    setRows([]);
    setError("");
    setBackedUp(false);
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("JSON 文件不可超过 10 MB");
      setRows(
        parseImport(await file.text()).map((a) => ({ ...a, status: "draft" })),
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function run() {
    if (!supabase || !rows.length || busy) return;
    setBusy(true);
    setError("");
    try {
      if (existing.length && !overwrite)
        throw new Error("存在相同 ID。请移除冲突项，或明确启用覆盖。");
      if (existing.length && !backedUp)
        throw new Error("覆盖前请先下载现有档案备份。");
      const expected = Object.fromEntries(
        existing.map((a) => [
          a.id,
          records.find((r) => r.id === a.id)!.updated_at,
        ]),
      );
      const { error } = await supabase.rpc("import_archives", {
        entries: rows,
        overwrite_existing: overwrite,
        expected_versions: expected,
      });
      if (error) throw error;
      await onDone(rows.length);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div
        className="modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        ref={dialog}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">PORTABLE RESEARCH DATA</p>
            <h2 id="import-title">批量导入 JSON</h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭导入"
            onClick={onClose}
            disabled={busy}
          >
            <X />
          </button>
        </div>
        <p>
          支持本站 v1
          备份或原始档案数组。导入前检查格式；所有档案默认存为草稿，整批成功或整批回滚。
        </p>
        <label className="upload-zone">
          <Upload size={24} />
          <strong>选择 JSON 文件</strong>
          <span>最多 10 MB / 每批 1000 份</span>
          <input
            aria-label="选择 JSON 文件"
            type="file"
            accept=".json,application/json"
            onChange={(e) => void select(e.target.files?.[0])}
            disabled={busy}
          />
        </label>
        {rows.length > 0 && (
          <>
            <div className="admin-summary">
              <span>{rows.length} 份有效档案</span>
              <span>{rows.length - existing.length} 份新增</span>
              <span>{existing.length} 份 ID 冲突</span>
            </div>
            <div className="import-preview">
              {rows.map((a) => (
                <div key={a.id}>
                  <strong>{a.name}</strong>
                  <span>{a.id}</span>
                  <span>
                    {records.some((r) => r.id === a.id) ? "将覆盖" : "新增"} ·
                    草稿
                  </span>
                </div>
              ))}
            </div>
            {existing.length > 0 && (
              <div className="editorial-note">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                    disabled={busy}
                  />
                  允许覆盖相同 ID（原公开档案将撤回为草稿）
                </label>
                <button
                  className="text-link"
                  onClick={() => {
                    downloadJSON(records);
                    setBackedUp(true);
                  }}
                  disabled={busy}
                >
                  <Download size={16} />
                  {backedUp ? "已请求下载备份" : "先下载现有档案备份"}
                </button>
              </div>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="editor-actions">
          <button
            className="button"
            disabled={
              !rows.length ||
              busy ||
              (existing.length > 0 && (!overwrite || !backedUp))
            }
            onClick={() => void run()}
          >
            {busy ? "正在导入…" : `导入 ${rows.length || ""} 份草稿`}
            <ArrowRight size={16} />
          </button>
        </div>
        <p className="small muted">
          此操作导入结构化数据。迁移图片文件与历史版本时，请使用完整备份脚本和恢复说明。
        </p>
      </div>
    </div>
  );
}
