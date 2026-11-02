# 验证记录

验证基于上传的 `atlas_of_looking_v03_deploy_ready.zip`、Node.js 24 与系统 Chromium。用户已提供 Supabase 项目和 Cloudflare Workers 生产地址，并报告完成 SQL 初始化与管理员授权；本环境的 HTTPS 代理仍拦截实际服务请求，因此线上状态尚未独立验收。

## 已通过

- `npm test`：30 项。包括 13 份原稿内容保真与导出／导入往返；危险 URL／不合法数据拒绝；匿名／普通登录用户／管理员的 PostgreSQL RLS；草稿和未引用图片权限；发布／撤回；写入修订历史；原子导入、ID 冲突与并发版本；备份分页、校验和与路径校验；完整数据及修订历史恢复到空数据库；默认连接配置、成对覆盖、私密密钥拒绝及显式演示模式限制。
- `npm run test:e2e`：10 项。1440px 桌面与 iPhone 尺寸分别检查显式本地演示的首页、13 份档案、全文搜索、关键词、排序、列表、长文、研究／作品／文献索引、导航、深链接、浏览器历史、缺失档案与只读后台；主要页面无横向溢出或 JS 错误。
- `npm run test:cloud`：2 项。清空 Supabase 构建变量后，使用 `config/public-site.json` 默认连接配置，**拦截所有 Supabase HTTP 请求为测试响应**，确认没有本地预览横幅、管理员登录表单可见，随后验证登录、新增草稿、保存、发布、JSON 导出、13 份导入、删除、退出，以及网络失败不会暴露演示档案。测试没有登录或修改真实项目。
- `npm run build:cloud`：TypeScript 与 Vite 生产构建。无 Supabase 构建变量时仍使用本站默认公开配置，JS 中包含正确项目地址，产物不含 `demo-data.json` 或原始种子档案。
- 云端模式构建拒绝显式 `VITE_ATLAS_DEMO=true`。浏览器配置在接收到 secret/service_role、半对项目覆盖或不安全 URL 时拒绝构建。
- Workers 的 Wrangler dry-run 和本地模拟器：首页与 JS 可访问，安全响应头生效，云端模式不提供演示数据。

PostgreSQL 测试使用 PGlite（真实 PostgreSQL WASM 引擎），实际执行迁移、RLS、角色、触发器和事务；Auth 与 Storage 的 SQL 接口由测试夹具提供。它不包含 Supabase Auth 服务和 Storage signed URL HTTP 实现。

## 仍需线上验收

- 真实 Supabase 管理员登录、草稿保存、媒体上传与 signed URL。
- 真实服务的匿名／非管理员／管理员三种权限验收。
- 真实云端完整备份、图片恢复和新项目灾备演练。文件与数据库恢复逻辑已本地测试，媒体恢复 API 需真实服务验证。
- Cloudflare 最新 main 部署是否已启用，线上管理员入口是否显示登录表单，而非旧版只读预览。
- 13 份研究稿的事实、年代、参考链接、作品授权的独立核实。

按 `docs/cloudflare-workers.md` 或 `docs/deployment.md` 继续实际部署验收；账户授权和私密值均在平台安全设置中处理。
