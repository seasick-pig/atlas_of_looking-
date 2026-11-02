# Cloudflare Pages 部署

Vercel 账户验证无法完成时，可使用 Cloudflare Pages 的静态站点部署。本项目的代码、Supabase 数据、管理员和 JSON 格式保持兼容。

如果已经成功创建 Workers 项目，无需删除或重建，可改按 [Workers 静态站点部署](cloudflare-workers.md) 继续完成配置。

## 创建 Pages 项目

1. 打开 https://dash.cloudflare.com/ ，注册或登录 Cloudflare 账户，并按页面要求完成邮箱验证。
2. 在侧栏找到 **Workers & Pages**，点击 **Create application**。选择 **Pages**，然后选择连接 Git／导入 Git 仓库的方式。界面文字可能调整；请确认最终创建的是 **Pages** 项目，而非要求填写 Worker deploy command 的 Workers 项目。
3. 连接 GitHub，并授权访问 `seasick-pig/atlas_of_looking-`。只需授权这个仓库。
4. 选择该仓库，生产分支选择 `main`。使用以下构建设置：

| 设置                   | 值                                         |
| ---------------------- | ------------------------------------------ |
| Project name           | `atlas-of-looking`，如已占用可加自定义后缀 |
| Framework preset       | Vite；若没有此选项可选择 None 并填写下方值 |
| Build command          | `npm run build`                            |
| Build output directory | `dist`                                     |
| Root directory         | 保持空白，即仓库根目录                     |

Pages 会安装 npm 依赖；仓库提供锁文件，不需要填写 Worker deploy command，也不需要添加 Worker 或 Functions。

## 配置构建环境变量

在首次构建前，为 Production 添加以下变量。如果开启 Preview 部署，也应给 Preview 设置对应变量。更改变量后需要重新构建。

| 变量名                          | 值                                |
| ------------------------------- | --------------------------------- |
| `NODE_VERSION`                  | `24`                              |
| `VITE_SUPABASE_URL`             | 你的 Supabase Project URL         |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 同一个项目的 publishable/anon key |

URL 与 publishable key 是浏览器公开配置。不要添加管理员密码、数据库密码、Supabase secret/service_role 或任何账户 Token。

Cloudflare Pages 构建环境提供 `CF_PAGES`；缺少 Supabase 配置时构建会主动失败，防止将本地演示稿发布为正式资料。已连接的正式构建不包含 `demo-data.json`。

## 发布及连接验证

1. 点击 **Save and Deploy**，构建成功后会得到 `https://你的项目名.pages.dev` 地址。无需购买域名或将已有域名迁入 Cloudflare。
2. 将最终生产地址填入 Supabase **Authentication → URL Configuration → Site URL**。如果以后使用邮件回调，另在 Redirect URLs 中添加所需的准确回调地址。本版使用邮箱密码登录。
3. 打开网站页脚的管理员入口，用你在 Supabase Auth 创建并加入 `site_admins` 的账户登录。
4. 点击“批量导入”，选择 `data/archives.seed.json`。13 份原稿默认导入为草稿，不自动发布。审核后逐份选择公开发布。
5. 按 [部署说明中的正式环境验收](deployment.md) 检查访客／非管理员／管理员权限、图片、JSON 导出和备份。

仓库的 `public/_headers` 会复制到构建输出，让 Pages 设置 CSP、防嵌入与内容类型等安全响应头。若 Supabase 使用自定义 API 域名，请同步更新该文件的 `connect-src`。档案使用 hash 深链接，无需新增重定向或改写规则。

## 当前状态

代码支持 Pages 构建，安全响应头和缺失配置拦截已本地验证。账户创建、GitHub 集成授权、实际部署和线上权限验收仍需要在真实账户下完成；本文件不是部署成功证明。

可从免费 Pages 方案起步，最终额度和账户验证要求以 Cloudflare 当前页面为准。
