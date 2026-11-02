# 已创建 Cloudflare Workers 项目时继续部署

Workers 也支持静态站点，不必为本网站重建 Pages 项目。仓库的 `wrangler.jsonc` 将 `dist` 配置为静态资产目录，不部署服务端特权 API。

## 当前项目的设置

打开 Workers & Pages → atlas-of-looking → **Settings → Build**。找到 **Build variables and secrets**（或 Build variables），添加以下构建变量：

| 名称                            | 内容                            |
| ------------------------------- | ------------------------------- |
| `NODE_VERSION`                  | `24`                            |
| `VITE_SUPABASE_URL`             | Supabase 项目 URL               |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 同一项目的 publishable/anon key |

这些必须是构建变量。只在 Worker 的 Runtime Variables and Secrets 中添加 `VITE_*`，无法改变已经打包的浏览器代码。不要添加管理员密码、数据库密码、service_role 或 secret key。

将构建配置改为：

| 设置              | 值                    |
| ----------------- | --------------------- |
| Build command     | `npm run build:cloud` |
| Deploy command    | `npx wrangler deploy` |
| Root directory    | `/`，仓库根目录       |
| Production branch | `main`                |

`build:cloud` 在缺少公开数据库配置时会停止构建，避免将本地演示档案发布为正式资料。Wrangler 使用锁文件中的版本，配置中的 Worker 名称是 `atlas-of-looking`，对应当前项目名称。如使用其他 Worker 名称，需同步调整配置。

保存后，回到 **Deployments** 对最新 `main` 提交发起构建。GitHub 集成也可能在提交推送后自动触发；需确认构建使用的是最新包含 `wrangler.jsonc` 的提交。若 Retry build 仅重试旧提交，请从项目的 Deployments 页面选择基于最新 `main` 的部署。

## 找到网站地址

构建和部署成功后，在 **Domains** 或 **Settings → Domains & Routes** 找到实际 `*.workers.dev` 地址。不要根据项目名猜测完整域名。打开后应连接 Supabase，不再显示本地预览横幅；尚未发布档案时，公开首页为空是正常的。

将实际生产地址加入 Supabase Authentication → URL Configuration → Site URL。使用管理员邮箱与密码登录网站的管理员入口，导入 `data/archives.seed.json`，审核后逐份发布。

## 验证范围

已通过云端模式构建、Wrangler dry-run 和本地 Workers 模拟器的功能检查：首页与脚本正常返回，CSP 等安全响应头生效，`demo-data.json` 返回 404，缺少数据库配置的云端模式构建被拒绝。Cloudflare 账户中的构建变量、线上部署、真实 Auth／Storage 和 RLS 验收仍需使用实际项目继续验证。既有历史“Build succeeded”状态不表示数据库连接和权限已经验收通过。
