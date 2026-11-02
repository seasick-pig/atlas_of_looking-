# 备份与恢复

## 两种备份

**快速 JSON 导出**：管理员界面可导出全部档案（包括草稿），也可导出尚未保存的编辑稿。用于日常整理、AI 辅助与文件交换。包含结构化内容和图片路径，**不含图片二进制与修订历史**。

**完整应用备份**：`scripts/backup.mjs` 保存档案、全部修订历史、私有 bucket 内所有图片（含暂未引用的图片）、迁移 SQL、当前管理员成员映射、逐文件 SHA-256 校验和。它不导出密码、Auth 会话或平台内部配置；其他管理员映射、Supabase Auth 用户与平台配置需另由项目所有者保存。外部 `image_url` 不属于本项目存储，须另取得原文件与许可后迁入。

## 安全运行

在个人电脑或可信私有任务中设置以下环境变量。可使用密码管理器注入，或本机权限设为 `600` 且不入 Git 的 `.env.backup`；脚本不打印值。不在聊天中传入这些凭据。

```text
ATLAS_SUPABASE_URL
ATLAS_SUPABASE_PUBLISHABLE_KEY
ATLAS_ADMIN_EMAIL
ATLAS_ADMIN_PASSWORD
```

```sh
node --env-file=.env.backup scripts/backup.mjs backups/atlas-2026-11-02
node scripts/verify-backup.mjs backups/atlas-2026-11-02
```

Node 22.12+ 支持 `--env-file`；若已安全注入变量，可省略。一次完整备份期间暂停所有编辑、导入与图片上传／删除。脚本分页读取，避免默认 1000 行导致静默截断；前后检查历史与存储清单。内容变化或请求失败会保留 `.partial`，不会将其标为成功备份。需用新输出路径重试。

备份目录权限为 700、文件为 600，`backups/` 已被 Git 忽略。不要上传到 Vercel 的 public/dist。建议在重要修改前做备份；至少每周运行，保留多个历史版本，并将加密副本复制到另一独立位置。Supabase 自带数据库备份／PITR 取决于套餐，不包含 Storage 对象文件，不能取代此处的媒体备份。

## 恢复到新项目

1. 在**新 Supabase 项目**运行备份的 `schema.sql`，手动创建新管理员并授权。数据库、Storage bucket 均由迁移创建；暂不接公开域名。
2. 先本地校验完整备份。对原输出目录保持只读备份副本。
3. 用目的项目的配置与管理员凭据运行媒体恢复。额外设置 `ATLAS_RESTORE_CONFIRM_URL`，值必须与目的 `ATLAS_SUPABASE_URL` 完全一致。

```sh
node --env-file=.env.restore scripts/restore-media.mjs backups/atlas-2026-11-02
```

媒体恢复不覆盖不同内容的同名对象；重复运行时会对已存在对象比对校验和。此步骤不自动创建或发布档案。

4. 生成**私有**恢复 SQL（输出路径必须不存在，不放入 public/dist）：

```sh
node scripts/prepare-restore.mjs backups/atlas-2026-11-02 backups/restore-private.sql
```

5. 用新项目 SQL Editor（数据库 owner 权限）执行生成 SQL。SQL 仅在档案与历史表均为空时执行，事务性恢复所有原状态、原时间戳、原修订 ID，并在完成后启用触发器。不会删除现有记录，也不会替你创建 Auth 用户。`archive_versions.actor` 保留原 UUID 作为历史证据，不假称对应新管理员。
6. 如要先审稿再公开，由 owner 将 `archives.status` 暂改为 `draft`；注意此为额外编辑，会生成新的历史。更新 Vercel 的两个公开变量后重新部署。
7. 检查 13 份或实际备份条数、草稿权限、图像、修订历史，演练增改删，再切换域名。

在原项目恢复部分误删内容时，优先从历史快照提取单条，审核后通过管理员 JSON 导入作为草稿；不要为方便直接清空生产库。完整项目灾备也需保留 GitHub 源码、Supabase 配置与管理员恢复方式。
