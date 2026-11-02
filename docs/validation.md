# 验证记录

本轮验证基于上传的 `atlas_of_looking_v03_deploy_ready.zip` 与 Node.js 24、系统 Chromium。第三方项目尚未创建。

## 已通过

- `npm test`：23 项。包括 13 份原稿内容保真与导出／导入往返；危险 URL／不合法数据拒绝；匿名／普通登录用户／管理员的 PostgreSQL RLS；草稿和未引用图片权限；发布／撤回；写入修订历史；原子导入、ID 冲突与并发版本；备份分页、校验和与路径校验；完整数据及修订历史恢复到空数据库。
- `npm run test:e2e`：10 项。1440px 桌面与 iPhone 尺寸分别检查首页、13 份档案、全文搜索、关键词、排序、列表、长文、研究／作品／文献索引、导航、深链接、浏览器历史、缺失档案与只读后台；主要页面无横向溢出或 JS 错误。
- `npm run test:cloud`：2 项。**模拟 Supabase HTTP API** 下验证后台登录、新增草稿、保存、发布、JSON 导出、13 份导入、删除、退出，以及网络失败不会暴露演示档案。
- `npm run build`：TypeScript 与 Vite 生产构建。
- 使用测试公开配置的生产构建不含 `demo-data.json`，JS／JSON／HTML 中不含原始种子档案。
- 浏览器构建在接收到 secret/service_role 配置时拒绝执行；Vercel 缺少 Supabase 配置时拒绝构建。

PostgreSQL 测试使用 PGlite（真实 PostgreSQL WASM 引擎），实际执行迁移、RLS、角色、触发器和事务；Auth 与 Storage 的 SQL 接口由测试夹具提供。它不包含 Supabase Auth 服务和 Storage signed URL HTTP 实现。

## 尚未执行，不能据此声称已上线

- 真实 Supabase 项目建库、管理员授权、登录、媒体上传与 signed URL。
- 真实服务的匿名／非管理员／管理员三种权限验收。
- 真实云端完整备份、图片恢复和新项目灾备演练。文件与数据库恢复逻辑已本地测试；媒体恢复 API 等待项目。
- Vercel 项目绑定、环境变量、公开 URL／自定义域名及线上烟测。
- 13 份研究稿的事实、年代、参考链接、作品授权的独立核实。

下一步按 `docs/deployment.md` 完成第三方项目配置，再执行其中正式环境验收；账户授权和私密值均在平台安全设置中处理。
