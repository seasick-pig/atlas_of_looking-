# 从 GitHub 到正式网站

## 1. Supabase：数据库与管理员

1. 创建 Supabase 项目，选择适合访客与自己的区域。项目数据库密码由你在平台安全保存。
2. 在 SQL Editor 运行 `supabase/migrations/001_archive.sql`。此迁移面向**新项目**，只运行一次。如果曾部署上传包的旧 `schema.sql`，请先备份并使用新项目迁移，不直接叠加。
3. 在 Authentication → Users 手动创建管理员用户。不要提供公开注册页面；在 Auth 设置关闭 **Allow new users to sign up**。
4. 复制该用户 UUID，由 SQL Editor 执行以下语句，将占位符换成真实 UUID：

```sql
insert into public.site_admins(user_id) values ('实际管理员 UUID');
```

5. 确认 Storage 的 `archive-images` bucket 为 **Private**，最大 10 MB，仅允许 JPEG／PNG／WebP／AVIF。迁移会自动创建。
6. 在项目 API 设置获取 Project URL 和 **publishable key**（旧项目的 anon key 亦可）。这是浏览器公开配置，不是 service_role／secret key。

本地连接可将 `.env.example` 复制为 `.env.local`，填入这两个公开配置后重启开发服务器。不要在聊天中提交管理员密码。

## 2. 第一次内容导入

1. 打开网站页脚的“管理员入口”，使用刚创建的账户登录。
2. 点“批量导入”，选择仓库内的 `data/archives.seed.json`。
3. 确认 13 份有效档案、0 个冲突，执行导入。它们全部是草稿，匿名访客看不到。
4. 检查正文和来源，保留“待核实”或人工核实后变更状态。逐份选择“公开发布”并保存。未核实档案可以作为研究整理稿公开，但页面会继续保留待核实提示。
5. 图像仅在具备适当许可后上传；填写来源、授权说明和替代文本。

## 3. Vercel 部署

1. 在 Vercel 新建项目，通过其 GitHub 集成授权 `seasick-pig/atlas_of_looking-` 仓库。
2. Framework 选择 **Vite**，Root Directory 为仓库根目录；Node.js 24；Install Command 为 `npm ci`，Build Command 为 `npm run build`，Output Directory 为 `dist`。仓库的 `vercel.json` 已提供构建和安全响应头。
3. 本网站已在 `config/public-site.json` 保存默认项目的公开连接配置，无需为同一项目重复填写环境变量。若需覆盖为其他 Supabase 项目，为 Production 与相应 Preview 成对配置：

| 变量                            | 内容                           |
| ------------------------------- | ------------------------------ |
| `VITE_SUPABASE_URL`             | `https://你的项目.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 该项目的 publishable/anon key  |

4. 点击 Deploy。未填写覆盖变量时使用默认公开项目配置；演示模式或不完整／不安全的覆盖配置会使正式构建失败。**更改连接配置后需重新部署。**正式构建不会生成 `demo-data.json`，仓库中的种子文件不作为网站静态文件发布。
5. 将 Vercel 生产 URL 填入 Supabase Authentication → URL Configuration 的 Site URL。若使用后续密码重置／邮件链接，在 Redirect URLs 添加准确生产地址；本版使用邮箱密码登录，不会发起注册或密码重置邮件。忘记密码时由项目所有者在 Supabase 控制台处理。
6. 自定义域名在 Vercel Domains 设置后，更新 Supabase Site URL。默认 CSP 允许 `*.supabase.co`；若改用 Supabase 自定义 API 域名，需同步修改 `vercel.json` 的 `connect-src`。

无需在 Vercel 放入管理员密码、数据库密码或 Supabase service_role。当前无服务端特权 API。

## 4. 正式环境验收（上线前必须执行）

- 管理员可登录；可创建一份草稿、修改正文、上传测试图片；刷新后内容仍在。
- 无痕访客和一个未列入 `site_admins` 的普通账户查询草稿均得不到记录，写入请求失败；不只是界面隐藏。
- 草稿图片匿名请求创建 signed URL 被拒绝。发布后图片可读；撤回后新请求被拒绝。已签发的链接可能继续有效，请等待其过期再测试。
- 发布／撤回／删除均在无痕访客窗口体现。关联只展示可读对象。
- 修改后 `archive_versions` 有新增快照。非管理员不能读取或写入历史。
- JSON 导出可重新导入测试项目；重复 ID 不会被静默覆盖。
- 按 `docs/backup.md` 做完整备份并校验；在独立测试项目演练恢复。
- 检查响应头、手机页面，以及打包文件没有私密密钥或原始演示数据。

本地 PostgreSQL 测试已覆盖 RLS 与事务逻辑；这些真实服务检查不能以本地测试代替。
