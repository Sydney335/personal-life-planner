# 日光 Daylight — Personal Life Planner

[English](README.md) | **简体中文**

一款帮助你安排日常计划、照顾生活习惯、记录想法与反思的双语生活规划工具。日光采用响应式渐进式网页应用（PWA），支持 iPhone、iPad 和 Mac，提供账号云同步与本地离线编辑。

**[打开应用](https://personal-life-planner-omega.vercel.app)**

> 生活有序，也留有余地。

## 你可以做什么

| 功能       | 内容                                                                               |
| ---------- | ---------------------------------------------------------------------------------- |
| 每日计划   | 学习时段、通过添加界面设置最多三项重要任务、替代活动、正餐、运动、社交、休闲和待办 |
| 灵活记录   | 计划起止时间、实际学习分钟、地点、备注、截止日期、优先级、完成状态、延期与任务排序 |
| 温和习惯   | 完成、跳过或留空，自定义习惯，记录起身活动与睡前习惯，没有连续打卡惩罚             |
| 每日 Notes | 大篇幅日记、可选反思问题、“结束今天”流程，以及默认凌晨 1:00、可调整的目标睡觉时间  |
| 日历与概览 | 月历、周历、历史搜索、周/月统计、学习时长与运动目标                                |
| 跨设备同步 | Supabase 账号登录、自动保存、离线队列、同步状态与显式冲突处理                      |
| 个性化     | 中英文界面、浅色/深色模式、模块折叠和自定义排序                                    |
| 纸质日程   | 每日计划、日记、每日合并或整周打印，支持已填写/空白、中英文、US Letter 纸张        |
| 数据备份   | JSON 导出，以及经过校验、避免重复、仅补充缺失记录的导入                            |

饮食统计表示**不同蛋白质来源类别的用餐频率**，不代表营养摄入量。缺失日期保持未记录。休闲是正常生活的一部分，不是完成工作后才允许获得的奖励。

## 开始使用

1. 打开[应用](https://personal-life-planner-omega.vercel.app)，注册账号或登录；如有提示，请完成邮箱确认。
2. 在各台设备上登录**同一个账号**，同步日程数据。
3. 选择日期，安排今天、修改过去或提前准备明天。打开 **日记 / Notes** 记录想法与反思。
4. 在**设置**中调整模块顺序、运动目标、自定义习惯，进行备份和打印/PDF；顶部工具栏可切换语言与主题。

**“在本机体验”是独立的本地模式。** 其中的记录不会同步，也不会自动进入账号。需要转移时，先导出 JSON 备份，再登录账号并确认导入。

## 安装到设备

| 设备          | 使用或安装方式                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| iPhone / iPad | Safari 打开应用的 HTTPS 地址 → 分享 → 添加到主屏幕，再打开新图标并登录。                                                 |
| Mac           | 直接使用现代浏览器访问；macOS Sonoma 或更新版本的 Safari 可选择“文件 → 添加到程序坞”，Chrome/Edge 在支持时提供安装选项。 |

iPhone 使用底部导航，iPad 使用侧栏和分栏布局，Mac 提供更宽的工作空间。任务可在同一模块内拖动，或通过排序按钮移动。在浏览器和键盘支持时，可使用 **Alt+1–4** 切换主要页面。

安装方式取决于浏览器支持。首次访问和首次登录需要网络。已加载过的生产版可以离线重开，但设备存储仍可能被清理或回收，请定期备份。

## 自动保存与同步方式

- 编辑先写入本机 **IndexedDB**，再上传到当前登录账号。
- Realtime 更新、15 秒轮询，以及重新打开/恢复联网时的同步，让活跃设备逐步获得最新内容。
- 界面区分已保存到云端、同步中、离线、同步失败和冲突状态。“已保存到云端”不代表所有处于挂起状态的设备已经下载更新。
- 并发修改会保留两份版本供你处理。日记正文可以合并；合并时反思字段保留本机版本，请一并对照检查。云端保留已接受的历史版本。
- 移动系统会挂起后台网页，重新打开后恢复同步；不保证持续后台同步。

提醒目前仅在**应用内**显示，尚未实现系统推送或可靠的后台通知。

## 打印、导出与恢复

在**设置 → 打印 / PDF**中选择每日计划、日记、每日合并或整周，再选择语言和已填写/空白内容。使用系统打印对话框，选择 **US Letter**、100% 缩放，并关闭浏览器页眉页脚。iOS 可以分享打印预览并存入“文件”。长内容会继续分页，避免截断；PDF 保存方式取决于平台。

在**设置 → 备份与恢复**中定期导出 JSON，并安全存放在设备之外。备份包含明文私人记录。普通导出包含当前有效记录，不包含删除标记或全部服务器版本历史；存在冲突时，请先处理，或另外复制保存两份内容。

导入需要确认，且**只新增缺失记录**。重复导入不会重复添加；已有记录和已删除记录不会被覆盖，不同版本会被跳过并统计。这是安全地补充缺失数据，不是强制回滚。云同步不能替代独立备份。

## 技术方案

- **前端：** React、TypeScript、Vite
- **样式：** 响应式 CSS、系统字体、Lucide 图标
- **身份与云端数据：** Supabase Auth、PostgreSQL、Realtime
- **本地存储：** 通过 `idb` 使用 IndexedDB
- **离线应用框架：** 生产构建生成的版本化 service worker
- **部署：** Vercel 或其他 HTTPS 静态托管平台
- **测试：** Vitest、PGlite、Playwright

不需要付费 AI API、分析服务或外部字体 CDN。个人使用可从 Supabase Free 和 Vercel Hobby 开始，但具体条款、额度、可用性及备份政策以服务商当前规则为准。

## 本地运行

建议使用 **Node 24 LTS**，仓库已通过 `.nvmrc` 和 `.node-version` 固定主版本；依赖要求也支持 Node 22.12+。

```sh
git clone https://github.com/Sydney335/personal-life-planner.git
cd personal-life-planner
npm ci
npm run dev
```

打开终端显示的开发地址。未配置 Supabase 时，可选择**在本机体验**；需要账号云同步时，请继续配置下一节。

```sh
npm run build       # TypeScript、生产资源和离线 service worker
npm run preview     # 本地检查生产构建
npm test            # 同步、备份、日期和 PostgreSQL/RLS 测试
npm run test:e2e     # 本地浏览器流程、响应式尺寸、离线和 PDF
npm audit           # 依赖安全审计
```

service worker 仅用于生产构建，不在 Vite 开发服务器中运行。云环境浏览器测试默认使用 `/usr/bin/chromium`；其他环境可先运行 `npx playwright install chromium`，再将 `CHROMIUM_PATH` 设为浏览器可执行文件，或配置 Playwright 使用其自带浏览器。测试输出不会提交到 Git。

## 配置自己的 Supabase 项目

1. 创建项目并选择合适的数据区域，为用户记录该区域，不要假设固定的数据保存国家或备份政策。
2. 在 SQL Editor 中对**新项目执行一次** [001_planner.sql](supabase/migrations/001_planner.sql)，或通过 Supabase CLI 关联项目后运行 `supabase db push`。迁移会创建私有数据表、行级安全策略（RLS）、原子版本校验写入函数、历史记录，并在 Realtime publication 可用时加入相应数据表。
3. 启用 **Email/password** 登录并保留邮箱确认；正常使用前配置生产 SMTP，默认开发邮件发送有频率限制。
4. 在 **Authentication → URL Configuration** 中，将 **Site URL** 设为应用的 HTTPS 来源，并在 **Redirect URLs** 中加入精确来源。开发地址仅用于开发。密码恢复使用 PKCE，请在发起请求的同一浏览器打开邮件。
5. 将 `.env.example` 复制为 `.env.local`，填入项目的公开配置：

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
   ```

   这两个值是公开的浏览器配置。**不要将 service-role、`sb_secret_…`、数据库密码或管理 token 放入任何 `VITE_` 变量。** 不要提交 `.env.local`。

6. 重启开发服务器或重新构建，注册、确认邮箱并登录。存储敏感内容前，用第二个账号验证同步及用户隔离。

如开发环境限制联网，需要允许项目的精确域名通过 HTTPS/WSS 访问，允许 `registry.npmjs.org` 安装依赖，以及 GitHub 源码访问。应用不需要 Supabase 管理服务密钥。

## 部署自己的版本

1. 在 Vercel 导入仓库，选择 **Vite**、**Node 24**，安装命令 `npm ci`，构建命令 `npm run build`，输出目录 `dist`。
2. 在相应 Vercel 环境中设置上面两个公开 Supabase 变量，修改后重新构建。按需要为预览部署使用独立的测试项目。
3. 部署后，将 Supabase 的 Site URL 和精确允许的重定向来源更新为生产地址。
4. 按照[验收清单](docs/ACCEPTANCE.md)检查邮箱登录/密码恢复、跨设备更新、离线重连、冲突及两账号隔离。

[vercel.json](vercel.json) 已提供安全响应头与构建设置。使用其他 HTTPS 静态托管平台时，应保留这些响应头，让 `/sw.js` 重新校验缓存，并在 `connect-src` 中允许 Supabase 的 HTTPS/WSS 端点。自定义 Supabase 域名需要对应修改内容安全策略。不要缓存 API 响应。

如果 Vercel 因无法识别提交作者而阻止部署，请核对作者的 GitHub 身份，以及项目连接的 Git 账号和访问权限。Preview 不会更新正式网址；审核后将修改合并到配置的生产分支，通常为 `main`。

## 隐私与当前限制

保存敏感记录前，请阅读[安全与数据管理说明](docs/SECURITY.md)。

- 云端记录保存在**自己的 Supabase 项目所选区域**，并缓存在各浏览器中。RLS 隔离登录用户，HTTPS 保护传输。
- 这**不是端到端加密**。项目管理员和服务商可能访问云端数据，能够使用未锁定浏览器的人也可能访问本地数据。日记不会发送给 AI 或分析服务。
- 删除条目会生成同步删除标记，不会立即清除服务器历史。目前永久删除账号需要项目所有者使用受信任的 Supabase 管理流程，本机数据和导出备份需要另行清理。
- 尚未实现用户自助删除账号、历史版本恢复界面和后台推送。当前同步会分页获取账号的全部记录，尚未为超大历史档案提供增量同步。
- 自动化尺寸测试不能证明真实 iPhone/iPad/Mac 的 Safari 体验。生产配置、真实设备安装、存储回收和平台打印对话框需要分别验证。

## 测试与详细文档

- [测试范围与最初验证记录](docs/TESTING.md)
- [带日期的上线验收报告、问题及测试访问要求](docs/PRODUCTION-ACCEPTANCE-2026-10-23.md)
- [线上与真实设备验收清单](docs/ACCEPTANCE.md)
- [安全、保留、删除与恢复](docs/SECURITY.md)
- [中文配置指南](docs/SETUP.zh-CN.md)

无需登录的生产站点检查使用 `npm run test:production`，默认目标是上面的应用网址。需要登录的测试，请安全注入 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`、`PLANNER_TEST_EMAIL`、`PLANNER_TEST_PASSWORD`、`PLANNER_OTHER_EMAIL` 和 `PLANNER_OTHER_PASSWORD`，然后运行：

```sh
PLANNER_BASE_URL=https://personal-life-planner-omega.vercel.app npm run test:live
```

请使用两个已确认邮箱、只含测试数据的专用账号，并通过受保护的运行环境配置凭证，不要在聊天或已提交文件中存放密码。live 套件会写入 **2099-12-20** 的测试记录，保留供检查。没有设置 `PLANNER_BASE_URL` 时，它测试的是连接 Supabase 的本地前端。远端套件关闭 trace、截图和视频。历史验收报告描述其记录日期当时的情况，不是实时可用性监控，也不表示所有真实设备检查均已通过。
