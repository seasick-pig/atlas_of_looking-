import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Search,
  Menu,
  X,
  Plus,
  Download,
  Upload,
  LogOut,
  MoveUpRight,
  BookOpen,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { demo, supabase, loadArchives, resolveImage } from "./lib/backend";
import {
  type Archive,
  type Kind,
  kinds,
  numberOf,
  safeURL,
  downloadJSON,
  emptyArchive,
} from "./lib/model";
import { Editor, ImportPanel } from "./components/Editor";

function useRoute() {
  const read = () => {
    try {
      return decodeURI(location.hash.slice(1) || "/");
    } catch {
      return "/not-found";
    }
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
const nav = [
  ["/artists", "艺术家", "Artists"],
  ["/works", "作品", "Works"],
  ["/research", "主题研究", "Research"],
  ["/notes", "札记", "Notes"],
  ["/references", "文献", "Bibliography"],
] as const;

export function Cover({
  record,
  large = false,
}: {
  record: Archive;
  large?: boolean;
}) {
  const [image, setImage] = useState(record.image_url);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    setImage(safeURL(record.image_url));
    const update = () => {
      if (record.image_path)
        resolveImage(record.image_path)
          .then((url) => {
            if (live) setImage(url);
          })
          .catch(() => {
            if (live) setFailed(true);
          });
    };
    update();
    const timer = window.setInterval(update, 8 * 60 * 1000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [record.image_path, record.image_url]);
  const n = record.number % 4;
  return (
    <div className={`cover plate-${n} ${large ? "cover-large" : ""}`}>
      {image && !failed ? (
        <img
          src={image}
          alt={record.image_alt || `${record.name} 档案图像`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <span className="plate-top">
            A STUDY IN LOOKING{" "}
            <span>{String(record.number).padStart(3, "0")}</span>
          </span>
          <div className="plate-art" aria-hidden="true">
            <i />
            <i />
            <span>
              {(record.en || record.name)
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
          </div>
          <span className="plate-bottom">
            {numberOf(record)} <span>档案索引图 · 非作品图像</span>
          </span>
        </>
      )}
    </div>
  );
}
function Card({ a }: { a: Archive }) {
  return (
    <a className="archive-card" href={`#/archive/${a.id}`}>
      <Cover record={a} />
      <div className="card-meta">
        <span>
          {numberOf(a)} / {kinds[a.kind].short}
        </span>
        <span>{a.medium || kinds[a.kind].en}</span>
      </div>
      <div className="card-name">
        <h3>{a.name}</h3>
        <ArrowUpRight size={21} />
      </div>
      <p className="card-en">{a.en}</p>
      <p className="card-intro">{a.intro}</p>
      <div className="card-tags">
        {a.tags.slice(0, 3).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </a>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <BookOpen size={26} strokeWidth={1} />
      <p>{children}</p>
      <span>每一份档案，都从一次认真观看开始。</span>
    </div>
  );
}

function Home({ records }: { records: Archive[] }) {
  const artists = records.filter((a) => a.kind === "artist");
  const tags = [...new Set(records.flatMap((a) => a.tags))];
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> AN INDEPENDENT ART RESEARCH ARCHIVE
          </p>
          <h1>
            观看，
            <br />
            是另一种
            <span className="hero-last">
              抵达<span className="period">。</span>
            </span>
          </h1>
          <p className="hero-description">
            在图像与思想之间，建立一座持续生长的档案馆。
            <br />
            关于艺术，关于观看，以及尚未得到答案的问题。
          </p>
          <a className="text-link" href="#/artists">
            进入档案馆 <ArrowUpRight size={18} />
          </a>
          <div className="hero-index">
            <span>独立研究 · 持续修订</span>
            <span>EST. 2026</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-top">
            <span>FIG. 01 — THE ACT OF LOOKING</span>
            <span>↗</span>
          </div>
          <svg
            viewBox="0 0 600 560"
            role="img"
            aria-label="以圆、弧线与坐标构成的观看研究示意图，非艺术家作品"
          >
            <defs>
              <pattern
                id="grid"
                width="30"
                height="30"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M30 0H0V30"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity=".09"
                  strokeWidth=".7"
                />
              </pattern>
            </defs>
            <rect width="600" height="560" fill="url(#grid)" />
            <circle cx="300" cy="280" r="190" className="orbit" />
            <circle cx="300" cy="280" r="140" className="orbit thin" />
            <path
              d="M110 280Q300 40 490 280Q300 520 110 280Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
            />
            <circle cx="300" cy="280" r="57" fill="currentColor" />
            <circle cx="300" cy="280" r="13" className="pupil" />
            <path d="M55 280H545M300 35V525" className="axis" />
            <path d="M115 456L481 90" stroke="currentColor" strokeWidth=".7" />
            <circle cx="441" cy="153" r="5" fill="currentColor" />
            <text x="450" y="143">
              a.
            </text>
            <text x="320" y="510">
              THE OBSERVER / 观看者
            </text>
            <text x="43" y="264">
              01
            </text>
            <text x="530" y="264">
              ∞
            </text>
          </svg>
          <div className="visual-bottom">
            <span>
              观看不是被动的接收，
              <br />
              而是一种与世界建立关系的方式。
            </span>
            <span className="visual-mark">
              a<span>↗</span>
            </span>
          </div>
          <span className="diagram-label">
            观看研究示意图 / EDITORIAL DIAGRAM
          </span>
        </div>
      </section>
      <section className="archive-stats" aria-label="档案统计">
        <p>
          一个开放的研究过程。
          <br />
          <span>An ongoing inquiry.</span>
        </p>
        <div>
          <strong>{String(artists.length).padStart(2, "0")}</strong>
          <span>艺术家档案 / ARTISTS</span>
        </div>
        <div>
          <strong>{String(tags.length).padStart(2, "0")}</strong>
          <span>关键词 / KEYWORDS</span>
        </div>
        <a href="#/connections">
          沿着关联
          <br />
          继续观看 <ArrowUpRight size={22} />
        </a>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SELECTED FILES / 精选档案</p>
            <h2>
              从一次观看开始<span>Selected entries</span>
            </h2>
          </div>
          <a className="text-link" href="#/artists">
            全部档案 <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="cards">
          {artists.slice(0, 3).map((a) => (
            <Card a={a} key={a.id} />
          ))}
        </div>
        {!artists.length && <Empty>尚无公开艺术家档案</Empty>}
      </section>
      <section className="research-band">
        <div>
          <p className="eyebrow">PATHS OF INQUIRY / 研究路径</p>
          <h2>
            图像之间，
            <br />
            总有另一条路径。
          </h2>
          <p>
            以关键词为线索，穿过媒介、年代与个体。
            <br />
            让问题相遇，让档案彼此照亮。
          </p>
          <a className="text-link" href="#/research">
            探索主题研究 <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="theme-list">
          {["凝视", "身体", "历史", "图像"]
            .filter((t) => tags.includes(t))
            .map((t, i) => (
              <a key={t} href={`#/artists?tag=${encodeURIComponent(t)}`}>
                <span className="mono">0{i + 1}</span>
                <h3>{t}</h3>
                <span>
                  {records.filter((a) => a.tags.includes(t)).length} 份档案
                </span>
                <ArrowUpRight size={23} />
              </a>
            ))}
        </div>
      </section>
      <section className="manifesto">
        <span className="eyebrow">A NOTE ON METHOD</span>
        <p>
          档案不是结论的陈列，
          <br />
          而是<span>观看方式的不断修订。</span>
        </p>
        <a href="#/about" className="text-link">
          关于观看图鉴 <ArrowUpRight size={16} />
        </a>
      </section>
    </>
  );
}

function Index({
  kind,
  records,
  queryString,
}: {
  kind: Kind;
  records: Archive[];
  queryString: string;
}) {
  const params = new URLSearchParams(queryString);
  const [query, setQuery] = useState(params.get("q") || "");
  const [tag, setTag] = useState(params.get("tag") || "全部");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("number");
  const list = records.filter((a) => a.kind === kind);
  const tags = [...new Set(list.flatMap((a) => a.tags))];
  const found = list
    .filter(
      (a) =>
        (tag === "全部" || a.tags.includes(tag)) &&
        [a.name, a.en, a.intro, a.body, a.medium, ...a.tags]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.en.localeCompare(b.en)
        : sort === "updated"
          ? b.updated_at.localeCompare(a.updated_at)
          : a.number - b.number,
    );
  return (
    <section className="index-page">
      <div className="page-title">
        <p className="eyebrow">THE ARCHIVE / {kinds[kind].en.toUpperCase()}</p>
        <h1>
          {kinds[kind].label}
          <em>{kinds[kind].en}</em>
        </h1>
        <p>
          {kind === "artist"
            ? "个体的创作，作为理解世界的不同入口。"
            : kind === "note"
              ? "保留未完成的想法、现场的感受与写作的痕迹。"
              : "在作品、文献与问题之间，展开持续的研究。"}
        </p>
      </div>
      <div className="index-tools">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="搜索档案"
            placeholder="搜索名字、媒介、研究正文或关键词…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="清除搜索" onClick={() => setQuery("")}>
              <X size={16} />
            </button>
          )}
        </label>
        <label className="sort">
          <SlidersHorizontal size={16} />
          <select
            aria-label="档案排序"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="number">按档案编号</option>
            <option value="name">按英文名称</option>
            <option value="updated">最近修订</option>
          </select>
        </label>
      </div>
      {tags.length > 0 && (
        <div className="filter-tags" aria-label="关键词筛选">
          {["全部", ...tags].map((t) => (
            <button
              key={t}
              aria-pressed={tag === t}
              className={tag === t ? "active" : ""}
              onClick={() => setTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="results-bar">
        <span>{String(found.length).padStart(2, "0")} ENTRIES / 份档案</span>
        <div>
          <button
            onClick={() => setLayout("grid")}
            aria-pressed={layout === "grid"}
          >
            图版
          </button>
          <span>/</span>
          <button
            onClick={() => setLayout("list")}
            aria-pressed={layout === "list"}
          >
            列表
          </button>
        </div>
      </div>
      {found.length ? (
        layout === "grid" ? (
          <div className="cards">
            {found.map((a) => (
              <Card a={a} key={a.id} />
            ))}
          </div>
        ) : (
          <div className="archive-list">
            {found.map((a) => (
              <a key={a.id} href={`#/archive/${a.id}`}>
                <span className="mono">{numberOf(a)}</span>
                <div>
                  <h3>{a.name}</h3>
                  <span className="serif">{a.en}</span>
                </div>
                <span>{a.medium}</span>
                <ArrowUpRight size={20} />
              </a>
            ))}
          </div>
        )
      ) : (
        <Empty>
          {query || tag !== "全部" ? (
            <>
              <span>未找到匹配的档案。</span>
              <button
                className="text-link"
                onClick={() => {
                  setQuery("");
                  setTag("全部");
                }}
              >
                清除筛选 <ArrowRight size={15} />
              </button>
            </>
          ) : (
            "这里等待第一份公开档案。"
          )}
        </Empty>
      )}
    </section>
  );
}

function Detail({
  record: a,
  records,
  admin,
  edit,
}: {
  record: Archive;
  records: Archive[];
  admin: boolean;
  edit: (a: Archive) => void;
}) {
  const sections = a.body.split(/\n\s*\n/).filter(Boolean);
  const explicit = records.filter((b) => a.related_ids.includes(b.id));
  const similar = records
    .filter(
      (b) =>
        b.id !== a.id &&
        !a.related_ids.includes(b.id) &&
        b.tags.some((t) => a.tags.includes(t)),
    )
    .slice(0, 3);
  return (
    <article className="detail">
      <a
        href={`#/${a.kind === "artist" ? "artists" : a.kind === "work" ? "works" : a.kind === "note" ? "notes" : a.kind === "theme" ? "research" : "references"}`}
        className="text-link"
      >
        <ArrowLeft size={16} /> 返回{kinds[a.kind].label}
      </a>
      <div className="detail-heading">
        <p className="eyebrow">
          {numberOf(a)} / {kinds[a.kind].en.toUpperCase()} FILE
        </p>
        <h1>{a.name}</h1>
        <div className="detail-sub">
          <em>{a.en}</em>
          <span>{a.years}</span>
        </div>
        <div className="detail-status">
          <span className="status-dot" />
          {a.verification === "pending"
            ? "研究整理稿 · 信息待核实"
            : "已核对资料"}
          {admin && (
            <>
              <span> / {a.status === "draft" ? "未发布草稿" : "已公开"}</span>
              <button className="text-link" onClick={() => edit(a)}>
                编辑档案 <ArrowUpRight size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {(a.image_path || a.image_url) && (
        <figure className="detail-image">
          <Cover record={a} large />
          <figcaption>
            {a.image_caption} {a.image_credit && `／${a.image_credit}`}
          </figcaption>
        </figure>
      )}
      <div className="detail-layout">
        <aside className="detail-aside">
          <dl>
            <dt>档案编号 / INDEX</dt>
            <dd>{numberOf(a)}</dd>
            <dt>媒介 / MEDIUM</dt>
            <dd>{a.medium || "待补充"}</dd>
            <dt>关键词 / KEYWORDS</dt>
            <dd className="detail-tags">
              {a.tags.map((t) => (
                <a href={`#/artists?tag=${encodeURIComponent(t)}`} key={t}>
                  {t}
                  <ArrowUpRight size={12} />
                </a>
              ))}
            </dd>
            <dt>阅读 / READING</dt>
            <dd>约 {Math.max(1, Math.ceil(a.body.length / 400))} 分钟</dd>
          </dl>
          <a
            href="#sources"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("sources")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-link"
          >
            参考资料 <ArrowRight size={14} />
          </a>
        </aside>
        <div className="reading">
          <p className="reading-intro">{a.intro}</p>
          {a.verification === "pending" && (
            <div className="verification">
              <span>RESEARCH NOTE / 核实说明</span>
              <p>
                {a.verification_note ||
                  "本档案尚未独立核实。请区分研究解释与作品事实，引用前请核对原始资料。"}
              </p>
            </div>
          )}
          <div className="prose">
            {sections.map((p, i) => {
              const sep = p.indexOf("｜");
              return (
                <section key={i}>
                  {sep > 0 && sep < 24 ? (
                    <>
                      <h2>{p.slice(0, sep)}</h2>
                      <p>{p.slice(sep + 1)}</p>
                    </>
                  ) : (
                    <p>{p}</p>
                  )}
                </section>
              );
            })}
          </div>
          {a.works.length > 0 && (
            <section className="works-section">
              <h2>代表作品与分析</h2>
              {a.works.map((w, i) => (
                <div key={i}>
                  <h3>
                    {w.title} <small>{w.year}</small>
                  </h3>
                  <p>{w.analysis}</p>
                </div>
              ))}
            </section>
          )}
          <section className="sources" id="sources">
            <p className="eyebrow">SOURCES & REFERENCES</p>
            <h2>参考资料</h2>
            {a.sources.length ? (
              a.sources.map((s, i) => (
                <div className="source" key={i}>
                  <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    {safeURL(s.url) ? (
                      <a
                        href={safeURL(s.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.label || s.url}
                        <ArrowUpRight size={16} />
                      </a>
                    ) : (
                      <strong>{s.label}</strong>
                    )}
                    {s.url && <p className="source-url">{s.url}</p>}
                    {s.note && <p>{s.note}</p>}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">原稿未附参考资料，待补充与核实。</p>
            )}
          </section>
          <p className="revision">
            档案持续修订中 · 保留问题，标明来源。
            {a.updated_at && (
              <span>
                最近修订 {new Date(a.updated_at).toLocaleDateString("zh-CN")}
              </span>
            )}
          </p>
        </div>
      </div>
      {(explicit.length > 0 || similar.length > 0) && (
        <section className="related">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CONTINUE LOOKING</p>
              <h2>继续观看</h2>
            </div>
            <a className="text-link" href="#/connections">
              关联索引 <ArrowUpRight size={16} />
            </a>
          </div>
          {explicit.length > 0 && (
            <>
              <p className="related-label">研究路径 · 编辑关联</p>
              <div className="cards">
                {explicit.map((b) => (
                  <Card a={b} key={b.id} />
                ))}
              </div>
            </>
          )}
          {similar.length > 0 && (
            <>
              <p className="related-label">
                共享关键词 · 自动聚合的阅读路径，不代表艺术史关系
              </p>
              <div className="cards">
                {similar.map((b) => (
                  <Card a={b} key={b.id} />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </article>
  );
}

function Research({ records }: { records: Archive[] }) {
  const themes = records.filter((a) => a.kind === "theme");
  const tags = [...new Set(records.flatMap((a) => a.tags))];
  return (
    <section className="index-page">
      <div className="page-title">
        <p className="eyebrow">PATHS OF INQUIRY</p>
        <h1>
          主题研究<em>Research</em>
        </h1>
        <p>从一个问题出发，在不同的艺术实践之间寻找回声。</p>
      </div>
      {themes.length > 0 && (
        <div className="cards">
          {themes.map((a) => (
            <Card a={a} key={a.id} />
          ))}
        </div>
      )}
      <div className="section-heading">
        <h2>
          关键词路径<span>Keyword index</span>
        </h2>
        <span className="mono">{tags.length} KEYWORDS</span>
      </div>
      <p className="muted small">
        按原稿关键词聚合；独立主题论文将在整理后发布。
      </p>
      <div className="topic-grid">
        {tags.map((t, i) => (
          <a href={`#/artists?tag=${encodeURIComponent(t)}`} key={t}>
            <div className="row">
              <span className="mono">{String(i + 1).padStart(2, "0")}</span>
              <ArrowUpRight size={20} />
            </div>
            <h2>{t}</h2>
            <p>
              {records
                .filter((a) => a.tags.includes(t))
                .map((a) => a.name)
                .join(" / ")}
            </p>
            <span className="mono">
              {records.filter((a) => a.tags.includes(t)).length} FILES
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
function Works({ records }: { records: Archive[] }) {
  const works = records.filter((a) => a.kind === "work");
  const mentions = records
    .filter((a) => a.kind === "artist")
    .map((a) => ({
      a,
      titles: [
        ...new Set([...a.body.matchAll(/《([^》]+)》/g)].map((m) => m[1])),
      ],
    }))
    .filter((m) => m.titles.length);
  return (
    <section className="index-page">
      <div className="page-title">
        <p className="eyebrow">OBJECTS OF INQUIRY</p>
        <h1>
          作品档案<em>Works</em>
        </h1>
        <p>从作品的形式、材料与机制，重新理解观看。</p>
      </div>
      {works.length > 0 ? (
        <div className="cards">
          {works.map((a) => (
            <Card a={a} key={a.id} />
          ))}
        </div>
      ) : (
        <div className="editorial-note">
          <span className="eyebrow">WORK IN PROGRESS</span>
          <p>
            独立作品档案正在编目。
            <br />
            以下线索摘自现有研究正文，作品名称与年代尚待核实。
          </p>
          <span>未附作品图片的使用授权，暂以文字索引呈现。</span>
        </div>
      )}
      <h2 className="subheading">
        原稿中的作品线索 <span>Mentions in the archive</span>
      </h2>
      <div className="work-mentions">
        {mentions.map(({ a, titles }) => (
          <a key={a.id} href={`#/archive/${a.id}`}>
            <span className="mono">{numberOf(a)}</span>
            <div>
              <h3>
                {a.name}
                <em>{a.en}</em>
              </h3>
              <p>{titles.map((t) => `《${t}》`).join("　/　")}</p>
              <span className="small muted">
                返回艺术家正文阅读作品分析 · 待核实
              </span>
            </div>
            <ArrowUpRight size={20} />
          </a>
        ))}
      </div>
    </section>
  );
}
function References({ records }: { records: Archive[] }) {
  const references = records.filter((a) => a.kind === "reference");
  const [q, setQ] = useState("");
  const sources = records
    .flatMap((a) => a.sources.map((s) => ({ ...s, a })))
    .filter((s) =>
      `${s.label} ${s.url} ${s.a.name}`.toLowerCase().includes(q.toLowerCase()),
    );
  return (
    <section className="index-page">
      <div className="page-title">
        <p className="eyebrow">READING & SOURCES</p>
        <h1>
          参考文献<em>Bibliography</em>
        </h1>
        <p>标明知识的来处，也保留需要进一步核实的地方。</p>
      </div>
      {references.length > 0 && (
        <div className="cards">
          {references.map((a) => (
            <Card a={a} key={a.id} />
          ))}
        </div>
      )}
      <label className="search">
        <Search size={18} />
        <input
          aria-label="搜索文献"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索来源、链接或艺术家…"
        />
      </label>
      <p className="muted small">
        下列链接由原稿提供，尚未逐一核实。收录不代表对链接内容与可用性的确认。
      </p>
      <div className="bibliography">
        {sources.map((s, i) => (
          <div className="source" key={`${s.a.id}-${i}`}>
            <span className="mono">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <a href={`#/archive/${s.a.id}`} className="source-artist">
                {s.a.name} / {numberOf(s.a)}
              </a>
              <a
                href={safeURL(s.url) || undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.label || "参考资料"}
                <ArrowUpRight size={16} />
              </a>
              <p className="source-url">{s.url}</p>
              <p>{s.note}</p>
            </div>
          </div>
        ))}
      </div>
      {!sources.length && <Empty>暂无匹配的参考资料</Empty>}
    </section>
  );
}
function Connections({ records }: { records: Archive[] }) {
  return (
    <section className="index-page">
      <div className="page-title">
        <p className="eyebrow">RELATIONAL INDEX</p>
        <h1>
          交叉关联<em>Connections</em>
        </h1>
        <p>关联是一条研究路径，而不是一项既定结论。</p>
      </div>
      <div className="connection-list">
        {records
          .filter((a) =>
            a.related_ids.some((id) => records.some((b) => b.id === id)),
          )
          .map((a) => (
            <div key={a.id}>
              <a href={`#/archive/${a.id}`}>
                <span className="mono">{numberOf(a)}</span>
                <h2>{a.name}</h2>
                <span className="serif">{a.en}</span>
              </a>
              <span className="connection-arrow">→</span>
              <div>
                {records
                  .filter((b) => a.related_ids.includes(b.id))
                  .map((b) => (
                    <a href={`#/archive/${b.id}`} key={b.id}>
                      {b.name}
                      <span className="mono">{numberOf(b)}</span>
                      <ArrowUpRight size={16} />
                    </a>
                  ))}
              </div>
            </div>
          ))}
      </div>
      <div className="editorial-note">
        <p>共享关键词也能形成阅读路径。</p>
        <a href="#/research" className="text-link">
          打开关键词索引 <ArrowUpRight size={18} />
        </a>
      </div>
    </section>
  );
}
function About() {
  return (
    <section className="about-page">
      <p className="eyebrow">ABOUT THE ATLAS</p>
      <h1>
        保持观看。
        <br />
        <em>Stay curious.</em>
      </h1>
      <div className="about-copy">
        <p>ATLAS OF LOOKING｜观看图鉴，是一项独立艺术研究与持续写作计划。</p>
        <p>
          它收集艺术家、作品、文本与个人经验，尝试在不同的观看方式之间建立联系。档案不是固定答案的仓库，而是一个可以回访、修订与重新组织的研究现场。
        </p>
        <h2>关于方法</h2>
        <p>
          保留原始研究文字；区分作品事实与批评性解释；让每一条资料都有可追溯的来源。尚未核实的内容明确标注为待核实，不以补全档案为由虚构信息。
        </p>
        <h2>关于图像</h2>
        <p>
          作品图像须在取得适当使用权限后收录，并标明作品、图注和来源。现有几何图版仅为档案索引的编辑设计，不是艺术家作品或作品复原。
        </p>
        <h2>关于开放与保留</h2>
        <p>
          公开档案供所有访客阅读。未完成的草稿、私人札记与修订记录由管理员保管。内容将在研究、核实与编辑后逐步公开。
        </p>
        <a className="text-link" href="#/artists">
          从档案开始 <ArrowUpRight size={18} />
        </a>
      </div>
    </section>
  );
}

export default function App() {
  const route = useRoute();
  const [path, queryString = ""] = route.split("?");
  const [all, setAll] = useState<Archive[]>([]);
  const [admin, setAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState<Archive | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [importing, setImporting] = useState(false);
  const [adminQuery, setAdminQuery] = useState("");
  const generation = useRef(0);
  const notify = (text: string) => setToast(text);
  async function refresh() {
    const run = ++generation.current;
    setLoading(true);
    setError("");
    try {
      let isAdmin = false,
        loggedIn = false;
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        loggedIn = !!session;
        if (session) {
          const { data, error } = await supabase.rpc("is_site_admin");
          if (error) throw error;
          isAdmin = !!data;
        }
      }
      const records = await loadArchives();
      if (run !== generation.current) return;
      setAdmin(isAdmin);
      setSignedIn(loggedIn);
      setAll(records);
    } catch (e) {
      if (run === generation.current) {
        setAll([]);
        setAdmin(false);
        setError(e instanceof Error ? e.message : "无法连接档案库");
      }
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event !== "INITIAL_SESSION")
        window.setTimeout(() => {
          setAll([]);
          void refresh();
        }, 0);
    });
    return () => {
      generation.current++;
      sub?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    setMenu(false);
    const id = window.setTimeout(
      () => document.querySelector("main")?.focus(),
      0,
    );
    return () => clearTimeout(id);
  }, [path]);
  useEffect(() => {
    document.title = path.startsWith("/archive/")
      ? `${all.find((a) => a.id === path.slice(9))?.name || "档案"}｜观看图鉴`
      : "ATLAS OF LOOKING｜观看图鉴";
  }, [path, all]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(id);
  }, [toast]);
  const records = useMemo(
    () => all.filter((a) => demo || a.status === "published"),
    [all],
  );
  function edit(a: Archive, newRecord = false) {
    setEditing(a);
    setIsNew(newRecord);
    location.hash = "/admin";
  }
  async function logout() {
    if (supabase) {
      setAll([]);
      setAdmin(false);
      setSignedIn(false);
      setEditing(null);
      const { error } = await supabase.auth.signOut();
      if (error) {
        notify(error.message);
        await refresh();
        return;
      }
      await refresh();
      notify("已退出登录");
    }
  }
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const f = new FormData(e.currentTarget);
    const button = e.currentTarget.querySelector("button")!;
    button.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    button.disabled = false;
    if (error) {
      notify("登录失败，请检查邮箱和密码。");
      return;
    }
    await refresh();
  }
  const current = path.startsWith("/archive/")
    ? all.find(
        (a) =>
          a.id === path.slice(9) && (demo || admin || a.status === "published"),
      )
    : undefined;
  let content: React.ReactNode;
  if (loading)
    content = (
      <div className="loading" role="status">
        <span className="live-dot" /> 正在打开档案馆…
      </div>
    );
  else if (error)
    content = (
      <section className="error-page">
        <p className="eyebrow">CONNECTION INTERRUPTED</p>
        <h1>档案暂时无法读取。</h1>
        <p role="alert">{error}</p>
        <button className="button" onClick={() => void refresh()}>
          重新连接 <ArrowRight size={16} />
        </button>
        <p className="muted">
          不会使用本地样本替代云端数据。请检查网络连接与数据库配置。
        </p>
      </section>
    );
  else if (path === "/") content = <Home records={records} />;
  else if (path === "/artists")
    content = (
      <Index
        key={route}
        kind="artist"
        records={records}
        queryString={queryString}
      />
    );
  else if (path === "/works") content = <Works records={records} />;
  else if (path === "/research") content = <Research records={records} />;
  else if (path === "/notes")
    content = (
      <Index
        key={route}
        kind="note"
        records={records}
        queryString={queryString}
      />
    );
  else if (path === "/references") content = <References records={records} />;
  else if (path === "/connections") content = <Connections records={records} />;
  else if (path === "/about") content = <About />;
  else if (current)
    content = (
      <Detail
        key={current.id}
        record={current}
        records={records}
        admin={admin}
        edit={edit}
      />
    );
  else if (path === "/admin")
    content = (
      <section className="admin-page">
        <div className="page-title">
          <p className="eyebrow">PRIVATE EDITOR</p>
          <h1>
            档案工作室<em>Studio</em>
          </h1>
          <p>在这里整理、修订，并决定何时与世界分享。</p>
        </div>
        {demo ? (
          <div className="editorial-note">
            <p>当前为只读本地预览。</p>
            <span>
              13 份原始研究稿已完整保留。连接 Supabase
              并设置管理员后，可在这里编辑、导入与发布；本地预览不模拟登录或保存。
            </span>
          </div>
        ) : !signedIn ? (
          <form className="login-form" onSubmit={login}>
            <h2>管理员登录</h2>
            <label>
              邮箱
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              密码
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="button" type="submit">
              进入工作室 <ArrowRight size={16} />
            </button>
            <p className="small muted">仅限已授权管理员。没有公开注册入口。</p>
          </form>
        ) : !admin ? (
          <div className="editorial-note">
            <p>当前账户未获管理员授权。</p>
            <span>
              请由项目所有者将此用户加入 site_admins。登录本身不授予编辑权。
            </span>
            <button className="text-link" onClick={() => void logout()}>
              退出登录 <LogOut size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="admin-toolbar">
              <button
                className="button"
                onClick={() =>
                  edit(
                    emptyArchive(
                      Math.max(
                        0,
                        ...all
                          .filter((a) => a.kind === "artist")
                          .map((a) => a.number),
                      ) + 1,
                    ),
                    true,
                  )
                }
              >
                <Plus size={17} /> 新建档案
              </button>
              <button
                className="button secondary"
                onClick={() => setImporting(true)}
              >
                <Upload size={17} /> 批量导入
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  downloadJSON(all);
                  notify(
                    `已导出 ${all.length} 份档案。图片二进制与修订历史请使用完整备份脚本保存。`,
                  );
                }}
              >
                <Download size={17} /> 导出全部 JSON
              </button>
              <button className="text-link" onClick={() => void logout()}>
                <LogOut size={16} /> 退出登录
              </button>
            </div>
            <div className="admin-summary">
              <span>{all.length} 份档案</span>
              <span>
                {all.filter((a) => a.status === "draft").length} 份草稿
              </span>
              <span>
                {all.filter((a) => a.status === "published").length} 份已发布
              </span>
              <span>草稿仅管理员可读</span>
            </div>
            <label className="search">
              <Search size={18} />
              <input
                placeholder="按名称、ID 筛选管理清单"
                aria-label="筛选管理清单"
                value={adminQuery}
                onChange={(e) => setAdminQuery(e.target.value)}
              />
            </label>
            {all
              .filter((a) =>
                [a.name, a.id, a.en]
                  .join(" ")
                  .toLowerCase()
                  .includes(adminQuery.toLowerCase()),
              )
              .map((a) => (
                <div className="admin-row" key={a.id}>
                  <span className="mono">{numberOf(a)}</span>
                  <div>
                    <strong>{a.name}</strong>
                    <small>
                      {kinds[a.kind].label} · {a.en}
                    </small>
                  </div>
                  <span className={`badge ${a.status}`}>
                    {a.status === "draft" ? "草稿" : "已发布"}
                  </span>
                  <button className="text-link" onClick={() => edit(a)}>
                    编辑 <ArrowUpRight size={16} />
                  </button>
                </div>
              ))}
            {!all.length && (
              <Empty>
                档案库为空。可批量导入交付包中的
                data/archives.seed.json，默认保留为草稿。
              </Empty>
            )}
          </>
        )}
      </section>
    );
  else
    content = (
      <section className="error-page">
        <p className="eyebrow">404 / NOT IN THE INDEX</p>
        <h1>这一页尚未归档。</h1>
        <p>档案可能未发布、已删除，或链接有误。</p>
        <a className="text-link" href="#/artists">
          返回艺术家索引 <ArrowRight size={17} />
        </a>
      </section>
    );
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.querySelector("main")?.focus();
        }}
      >
        跳至正文
      </a>
      <div className="topbar">
        <span>独立艺术研究档案 / AN INDEPENDENT ART RESEARCH ARCHIVE</span>
        <span>保持观看 · STAY CURIOUS</span>
      </div>
      <header className="site-header">
        <a className="brand" href="#/" aria-label="观看图鉴首页">
          ATLAS OF LOOKING
          <span>
            观看图鉴<span className="brand-divider">/</span>
            <small>ART · IMAGE · INQUIRY</small>
          </span>
        </a>
        <button
          className="menu-toggle"
          aria-label={menu ? "关闭导航" : "打开导航"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav
          className={menu ? "open" : ""}
          aria-label="主导航"
          onClick={() => setMenu(false)}
        >
          {nav.map(([href, zh, en]) => (
            <a
              href={`#${href}`}
              key={href}
              aria-current={path === href ? "page" : undefined}
            >
              <span>{zh}</span>
              <small>{en}</small>
            </a>
          ))}
          <a className="nav-about" href="#/about">
            关于 <ArrowUpRight size={13} />
          </a>
        </nav>
      </header>
      {demo && (
        <div className="demo-banner">
          <span>本地预览</span> 13 份原稿 · 待核实 ·
          只读展示，尚未连接云端或正式发布
        </div>
      )}
      <main id="main" tabIndex={-1}>
        {content}
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <a className="brand" href="#/">
            ATLAS OF LOOKING<span>观看图鉴</span>
          </a>
          <p>
            一座持续生长的独立艺术研究档案馆。
            <br />
            <em>An archive of art, images, and ways of seeing.</em>
          </p>
          <a
            href="#/"
            className="back-top"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            回到起点 <MoveUpRight size={19} />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} ATLAS OF LOOKING</span>
          <div>
            <a href="#/connections">交叉关联</a>
            <a href="#/about">研究方法</a>
            <a href="#/admin">{admin ? "档案工作室" : "管理员入口"}</a>
          </div>
          <span>保持好奇，持续观看。</span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button aria-label="关闭通知" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {editing && admin && (
        <Editor
          record={editing}
          isNew={isNew}
          records={all}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
            notify("档案已保存。");
          }}
          notify={notify}
        />
      )}{" "}
      {importing && admin && (
        <ImportPanel
          records={all}
          onClose={() => setImporting(false)}
          onDone={async (count) => {
            setImporting(false);
            await refresh();
            notify(`已导入 ${count} 份档案，保留为草稿。`);
          }}
        />
      )}
    </>
  );
}
