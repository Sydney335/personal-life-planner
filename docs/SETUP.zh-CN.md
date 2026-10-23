# 配置、部署与使用

正式网址为 https://personal-life-planner-omega.vercel.app 。用户已完成数据库与部署配置；本次测试环境仍未验证线上登录和三端同步，请查看 [最新上线验收报告](PRODUCTION-ACCEPTANCE-2026-10-23.md)。本机体验模式不会同步数据。

最新字体、填写日期颜色、手动分类、段落删除线及增量 SQL 迁移说明见 [功能与设置指南](ENTRY-PRESENTATION.zh-CN.md)。已有数据库只需执行新增的 `002_entry_presentation.sql`；不要重复运行建表迁移。

## 本机启动

需要 Node 24。在仓库目录运行：

```sh
npm ci
npm run dev
```

浏览器打开终端给出的开发地址，点击“在本机体验”。它支持本地日程、习惯、日记、日历、统计、备份和打印。

```sh
npm test          # 逻辑、同步协议、PostgreSQL RLS 测试
npm run test:e2e # Chromium 流程、三种尺寸、离线、PDF 测试
npm run build    # 生产构建，生成离线缓存
npm run preview  # 检查生产版与离线功能
```

当前云环境已安装 Chromium；其他电脑请参考 README 的浏览器安装说明。

## 连接云数据库和登录

1. 在自己的 Supabase 账号中新建项目。选择合适的数据存储区域，并记录该区域；应用不会替你承诺数据保存在某个国家。
2. 在 SQL Editor 中执行 `supabase/migrations/001_planner.sql`，仅对新项目执行一次。它会创建记录表、版本历史表、RLS、版本校验写入函数和 Realtime 配置。全新项目随后执行 `002_entry_presentation.sql`；已有项目仅执行尚未应用的新增迁移。
3. 在 Authentication 的 Providers 中启用 Email/Password，保留邮箱确认。正常使用前配置自己的 SMTP；默认开发邮件发送有额度限制。
4. 在项目设置的 API 页面取得项目 URL 和 **publishable key / public anon key**。复制 `.env.example` 为 `.env.local`，填入 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`。它们是公开的浏览器配置，不是数据库管理凭证。
5. **不要使用 service_role、sb_secret、数据库密码或管理 token。不要把私人密钥发到聊天或提交 Git。** 构建会拒绝已识别的 Supabase 私钥类型。
6. 重启开发服务器，注册账号，收邮件确认后登录。各设备必须使用同一个账号。本机体验数据不会自动进入账号；需要时先导出，再在账号内确认导入。
7. 在 Supabase 的 URL Configuration 中设置 Site URL 和 Redirect URLs：开发用实际开发来源；正式使用时改为精确的 HTTPS 部署来源。密码重置使用 PKCE，请在发起重置的同一浏览器打开邮件链接。

云环境联网策略还需允许你项目的精确 `<project-ref>.supabase.co` 主机，支持 HTTPS 和 WSS。公开配置值可在环境设置内填写；无需提供私人管理密钥。

## 部署到 Vercel

1. 登录自己的 Vercel 账号，导入本 GitHub 仓库。
2. 使用 Vite、Node 24、安装命令 `npm ci`、构建命令 `npm run build`、输出目录 `dist`。仓库已提供 `vercel.json`。
3. 在部署项目的环境设置中填写上面两个 **公开** Supabase 配置值，然后部署。修改 VITE 配置后要重新构建。
4. 将获得的 HTTPS 生产来源填入 Supabase 的 Site URL 和 Redirect URLs，避免随意使用通配地址。
5. 用专门测试账号完成 [验收清单](ACCEPTANCE.md)，尤其是三端同步、离线重连、并发日记冲突及不同账号数据隔离。

免费个人方案可从 Supabase Free + Vercel Hobby 开始，但服务额度、暂停机制、可用性和备份政策以服务商当前规则为准。

## 安装到设备

- iPhone / iPad：Safari 打开已部署的 HTTPS 地址 → 分享 → 添加到主屏幕。打开新图标并登录。
- Mac：直接用浏览器打开。Safari（macOS Sonoma 或更新版本）可通过“文件 → 添加到程序坞”安装；Chrome/Edge 在支持时提供安装菜单。
- 第一次访问和登录需要网络。已打开过的生产版可离线重开；浏览器清理存储或系统回收空间仍可能影响本地数据，因此请定期备份。
- iOS 会挂起后台网页，不能保证后台实时刷新。回到应用时会自动同步。当前提醒为应用内到期提示，**没有系统推送**。

## 数据与备份

- 编辑先写入 IndexedDB，再通过当前账号同步到 Supabase。界面区分已保存到云端、同步中、离线、同步失败和冲突待处理。
- 同一条记录并发编辑会显示两份内容。日记可合并正文；合并时反思字段保留本机版本，请一并对照检查。云端保存已接受的历史版本。
- 设置 → 备份与恢复 → 导出 JSON。文件是明文，请安全存放在其他设备或加密存储中。普通导出包含当前有效记录，不含删除墓碑或服务器的全部版本历史；未处理的冲突需先处理或另外复制两份内容。
- 导入必须确认，仅新增缺失记录，不覆盖已有或已删除记录；重复导入不会产生重复条目，不同版本会跳过并报告。它不是强制回滚工具。
- 设置 → 打印 / PDF，可选日程、日记、每日合并、整周、空白手写、中英文以及彩色或黑白模式。使用系统打印对话框，选择 US Letter、100% 缩放、关闭页眉页脚。iOS 可分享打印预览并存入“文件”。长内容会续页，避免被截断。
- 云数据库**不是端到端加密**。项目管理员与服务商可能访问数据。RLS 按账号隔离普通用户；HTTPS 保护传输。应用不会将日记发送给 AI 或分析服务。
- 删除条目会同步删除标记，并保留云端历史。需要永久清除账号数据时，由项目所有者通过 Supabase Auth 管理后台删除用户；本地数据和导出的备份也应分别清理。

详细限制见 [SECURITY.md](SECURITY.md)，测试范围见 [TESTING.md](TESTING.md)。真实 Apple 设备、Safari 打印及线上 Auth/Realtime 仍需完成验收。
