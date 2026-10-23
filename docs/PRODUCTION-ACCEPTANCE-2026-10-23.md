# 上线验收 / Production acceptance — 2026-10-23

Target: https://personal-life-planner-omega.vercel.app

Source baseline: `origin/main` at `2fb4a24a19ab679538e0a24692ebf3c2d32cbb56` (merged PR #1). The checked-out tree initially matched that commit. Fixes are on a separate branch, `fix/production-acceptance`; production/main was not overwritten.

## 中文简报

**结论：本地功能验证通过；生产上线验收尚未完成。** 当前不能确认线上页面、登录、同步、线上安全响应头或 Apple 原生安装体验均正常，也不能因为本次访问受阻而判断网站故障。

| 范围                              | 实际结果                          | 证据及边界                                                                                                                                |
| --------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub 当前 main 的构建状态       | 已确认成功                        | GitHub API：`test` check-run success；Vercel commit status `Deployment has completed`。这不证明当前生产网址返回 200 或正确配置了 Supabase |
| 生产网址 HTTP/TLS                 | 环境阻塞，未验收                  | curl 经现有代理发起 CONNECT，得到 403；未到达可验证的站点响应，未验证站点证书                                                             |
| 生产浏览器检查                    | 1 项尝试失败，因环境阻塞          | Chromium 经现有代理报 `ERR_CERT_AUTHORITY_INVALID`；在页面加载前停止。没有关闭 TLS 校验，也没有记录为产品功能失败                         |
| 线上 iPhone / iPad / Mac 布局     | 未测试                            | 生产页面无法加载；本地构建的 390×844、834×1194、1440×1000 布局流程已测试                                                                  |
| 已有自动化测试（修复前基线）      | 21 项逻辑/数据库 + 7 项浏览器通过 | 实际重跑，未以之前报告代替                                                                                                                |
| 修复后的自动化测试                | 24 项逻辑/数据库 + 8 项浏览器通过 | 含新增的旧界面版本与远端刷新竞态、删除竞态和自身保存确认用例                                                                              |
| TypeScript / 生产构建             | 通过                              | 浏览器套件启动前实际构建，包含离线 service worker                                                                                         |
| 依赖审计                          | 0 漏洞                            | 实际运行 `npm audit --audit-level=moderate`                                                                                               |
| PWA / IndexedDB / PDF / 中英文    | 本地构建通过；线上未测试          | 离线重开、断网本地编辑、存储失败恢复、备份、双语；实际 PDF 每日 2 页 / 整周空白 14 页，US Letter。OS 的“安装”按钮未自动验证               |
| Supabase 登录、真实同步与线上 RLS | 未执行                            | 当前环境没有项目公开配置、两个专用测试账号的安全凭证；测试预检明确停止，未伪装通过                                                        |
| 安全配置源码审查                  | 已检查，线上生效未证实            | 源码有 RLS、账号约束、原子版本校验、私钥构建拦截及 Vercel CSP 等响应头；未读取线上数据库策略或部署设置                                    |

**发现并修复的代码问题：** 远端数据刚写入 IndexedDB、React 还显示旧版本时，输入会采用尚未看见的新版本号，导致远端正文可被静默覆盖。已用回归测试在原代码复现失败。修复将编辑与界面实际看到的版本绑定，保留未看见的远端正文/删除标记为显式冲突，并区分同一会话自身的保存确认以避免误报。新增浏览器测试验证界面确实展示两份内容。

另修复了验收工具：原 live 套件固定启动本地服务器，且手工创建的浏览器 context 未明确传入 baseURL。现在可指定真实 HTTPS 生产地址，检查登录请求的 Supabase 项目来源，并单独运行无账号的生产页面/安全头/PWA 检查。该工具修复不等于线上云同步已经通过。

**仍需真人设备验证：** Safari 添加主屏幕、Mac 添加程序坞/安装；iPhone 创建任务后同账号 iPad/Mac 自动出现；iPad 横竖屏与键盘长日记；飞行模式关闭重开后恢复同步；两设备并发编辑/删除冲突；邮箱确认与密码恢复；第二账号的线上私有数据隔离；中文 PDF 在 iOS 打印分享至文件；后台挂起、存储回收、跨时区/夏令时。详细步骤见 [ACCEPTANCE.md](ACCEPTANCE.md)。

**环境阻塞说明：** 自动审批拒绝将环境提供的代理 CA 加入 Chromium 的持久 NSS 信任库，理由是该变更扩大浏览器 TLS 信任范围，未包含在现有明确授权中。信任库未更改。没有使用忽略证书错误、禁用 TLS 或绕过代理的办法。生产域名已加入环境网络设置草稿（保留原 `api.github.com`），保存草稿不代表已应用/发布。完整检查还需允许精确的 Supabase 项目域名。

## English brief

**Result: local verification passed; production acceptance remains incomplete.** A blocked test environment is not evidence that the website is down.

- **Confirmed:** GitHub reports successful CI and Vercel deployment status for main. Baseline rerun: 21 logic/database + 7 browser tests passed. Fix branch: 24 logic/database + 8 browser tests passed. TypeScript/production build passed; dependency audit found zero vulnerabilities. Local checks cover three viewport sizes, bilingual UI, CRUD, Notes, IndexedDB/offline reopening, storage failure recovery, backup and actual 2-page/14-page US Letter PDFs.
- **Issues:** reproduced a stale-editor/remote-refresh race that could silently replace remote note content. Fixed with explicit conflict preservation and regression tests. Fixed live-test targeting so a deployed HTTPS origin and the expected Supabase project can be checked.
- **Blocked / untested:** production HTTP/page layout, deployed security headers/assets, hosted Auth/Realtime/RLS, actual Apple installation and Safari printing. curl hit proxy CONNECT 403; the browser stopped at an untrusted proxy certificate. No TLS checks were disabled. Automatic review rejected adding the environment CA to Chromium's persistent trust store because that expands trusted issuers without explicit authorization.
- **Still required:** network/trust configuration, secure disposable test-account credentials, and real iPhone/iPad/Mac checks using the linked checklist. Source inspection and PGlite RLS tests do not certify the deployed database. Deployment status does not certify application behavior.

## 安全配置下一轮测试 / Securely enable the next run

No Vercel admin token, database password, Supabase service-role key or personal account password is needed. Do not send private values in chat or commit them. Use a trusted local machine, or a protected CI/cloud runtime with credentials securely injected. If this cloud's proxy CA is to be installed persistently, it needs explicit approval; do not bypass certificate verification.

Required environment names (all currently absent in this cloud process):

- `VITE_SUPABASE_URL`: the deployed project's public HTTPS URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: public publishable/anon key, never a service/admin key.
- `PLANNER_TEST_EMAIL`, `PLANNER_TEST_PASSWORD`: confirmed disposable test account A.
- `PLANNER_OTHER_EMAIL`, `PLANNER_OTHER_PASSWORD`: confirmed disposable test account B for isolation checks.
- `PLANNER_BASE_URL=https://personal-life-planner-omega.vercel.app` selects the actual deployed site. The production smoke suite defaults to that URL; the authenticated suite defaults to a local build unless explicitly set.

Inject passwords through protected CI environment secrets or your trusted machine's secure process environment, not committed `.env` files. Proxy substitution placeholders are not raw test passwords: the browser and API client must receive usable test-account credentials through an appropriate secure runtime binding. Use accounts containing only disposable data. The live suite writes test records dated **2099-12-20** and leaves them for inspection.

```sh
# Public page/security headers/PWA assets + isolated guest workflows on production.
npm run test:production

# After securely injecting all six project/account variables above:
PLANNER_BASE_URL=https://personal-life-planner-omega.vercel.app npm run test:live
```

The production suite starts no local server. Authenticated checks verify that the site's sign-in request targets the supplied Supabase project. Existing e2e workflows run as an isolated local guest and do not modify cloud account records. Remote suites disable traces, screenshots and videos; result directories are Git-ignored. If your machine uses a managed proxy, use its supported trust configuration; Node's fetch client may also require the runtime's supported proxy initialization (Node 24: `NODE_USE_ENV_PROXY=1` at process startup). Never remove TLS checks.

After network access is restored, inspect deployed Auth URL configuration (Site URL and exact redirects should match the production origin), confirm Email Auth/SMTP, verify Realtime publication and run the two-user RLS tests. These provider-side settings have not been read or changed during this acceptance pass.
