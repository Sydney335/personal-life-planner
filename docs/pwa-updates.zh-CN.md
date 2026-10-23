# Daylight 自动更新与缓存维护

这项改动沿用现有 React / Vite、自定义 Service Worker、IndexedDB 和 Supabase 同步机制，不需要数据库迁移，也不清除个人记录。

## 检查与提示

- 生产环境在启动、重新进入前台（visibilitychange / pageshow）及联网恢复时检查更新。前台每 5 分钟再检查一次；后台不轮询网络。
- 普通检查至少间隔 30 秒，重叠请求合并；联网恢复和手动检查可跳过间隔限制。
- `/sw.js` 使用 `updateViaCache: none` 注册，`registration.update()` 检查新 Worker；`/version.json` 使用 `no-store` 获取部署标识。
- Vite 给 HTML、JS、version.json 和 Worker 使用同一构建标识。默认采用 Vercel commit 前缀（本地为 local）和随机后缀，同一 commit 重新构建也能区别配置变更。应用版本来自 package.json。
- 新 Worker 完整下载应用外壳后，才显示“有可用更新”。下载失败保留当前外壳，下次检查可重试。
- “稍后”按构建标识推迟 24 小时，保存在 localStorage；存储不可用时仅在当前会话内保留。手动“检查更新”可重新显示提示，联网恢复不会取消推迟。
- 设置 → 关于日光显示正在运行的应用版本、构建标识、本次会话上次成功检查时间、状态和检查按钮。

## 自动更新与手动更新

自动更新需同时满足：

1. 当前页面可见、在线，且 60 秒没有键盘、指针或输入活动。
2. 没有聚焦的输入控件、打开的编辑/冲突对话框、未添加的习惯草稿或无效输入。
3. 初始读取完成，无本地保存错误、内存中待保存内容、IndexedDB 写入或正在运行的同步。
4. 没有未解决冲突；账号模式下还必须已获云端确认、同步状态为 saved，且最新 IndexedDB 记录没有 pending。仅本机模式没有云端同步要求。
5. 同一站点只有当前一个标签页/应用窗口。Worker 会把未受控制及后台窗口也计入；不回答或挂起的窗口不会被当成安全窗口。
6. 用户没有推迟此版本。

“立即更新”可以跳过空闲时间要求，并允许保留已经持久化的离线同步队列；仍不允许未保存输入、写入错误、正在同步或冲突。不会因为点击更新就把 pending 改成 false。用户可先完成同步，也可在同步没有运行时明确更新，后续由现有 SyncEngine 继续推送 IndexedDB 中相同的 mutation。

通过最终安全检查后，会暂停新同步并短暂冻结页面输入，避免检查和 Worker 激活之间产生新编辑。只有发起安全更新的页面会在 controllerchange 时重载；首次安装或意外控制器切换不会重载其他页面。激活失败会解除冻结并恢复同步。如果页面已由新 Worker 控制但还运行旧 JS（例如恢复页面），也会先通过相同检查再重载。

多个窗口同时打开时，本实现保守等待其他窗口关闭，不强制协调它们重载。关闭前请先保存各窗口的编辑。不同设备有独立的 Worker 和缓存，各自按安全状态更新。

## 缓存与离线

- 导航先请求网络，5 秒超时或失败时回退到已完整缓存的 index.html。
- 若服务器 HTML 属于另一构建，在新外壳准备好并安全激活前继续使用当前构建，避免出现“新 HTML + 旧 JS/CSS”。导航完成前不会等待尚未创建好的 resultingClient。
- 安装时只下载构建清单内的公开外壳文件，并校验 HTML 构建标识和 JS/CSS MIME 类型。任意下载失败会取消安装并删除本次不完整缓存。
- 带哈希的 JS/CSS 使用缓存优先；保留中的旧版本资源仍能供旧页面使用。
- 清理仅针对 Daylight 外壳及原有 daylight 哈希缓存；存在安装中/等待中的 Worker 时不清理。已激活后查询各窗口运行版本，保留仍被使用的资源；窗口不响应时保守保留。新页面启动后再次清理。
- 不调用 IndexedDB 删除、不清理 localStorage、不会删除用户记录。Supabase、认证、API、version.json 和任意用户请求不进入应用 Cache Storage。
- Vercel 对 `/`、`/index.html`、`/sw.js`、`/version.json` 使用 no-store，对 `/assets/*` 使用一年 immutable 缓存；现有安全响应头保留。

## 构建与验证

使用 Node 24，保留现有 Supabase 的两个公开 VITE 配置即可，不需要新增生产密钥或数据库迁移：

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm run test:pwa
```

浏览器测试默认使用 `/usr/bin/chromium`。其他机器可以执行 `npx playwright install chromium`，并将 `CHROMIUM_PATH` 指向 Playwright 的浏览器路径。CI 已配置此路径并运行两组浏览器测试。

`npm run test:pwa` 在单一 localhost origin 构建两个真实生产版本 pwa-A / pwa-B（只在测试构建中加入 CSS 标记），通过本地测试服务器切换部署。它验证实际注册、下载、激活、重载、匹配的新 JS/CSS、稍后、语言/主题、不同视口、离线回退、记录/队列保留、多窗口及失败恢复。测试控制端点只存在于 `scripts/serve-pwa-tests.mjs`，不会进入生产输出。

构建标识通常无需设置。特殊构建流水线可用 `DAYLIGHT_BUILD_ID` 指定 1–100 位字母、数字、下划线或连字符；必须保证不同构建使用不同标识，否则会破坏版本识别。`VERCEL_GIT_COMMIT_SHA` 由 Vercel 自动提供。`scripts/build-sw.mjs` 默认读取 dist，也可传入其他输出目录供测试使用。

## 首次上线与 Apple 平台验证

旧版已经运行的 JavaScript 无法凭这次部署获得新的前台检查逻辑。首次迁移仍需浏览器原生 Worker 更新流程：旧页保持正常可用，关闭已有窗口并重新打开后，新逻辑才接管。无需注销 Worker 或清除站点数据。此后部署使用上述主动检查流程。

iOS / iPadOS 可能暂停页面和 Worker，后台更新不保证执行；重新打开或回前台时再检查。浏览器也可能因磁盘压力清理离线存储，应用代码不能保证系统永远保留 IndexedDB。离线外壳首次成功下载前，无法离线启动。

自动化使用 Linux Chromium 和 iPhone / iPad / Mac **视口尺寸**，并非真实 Safari、安装型 Apple PWA 或物理设备测试；同步测试使用 FakeCloud 合约及本地数据库测试，并非真实 Supabase 网络实测。发布前应在真实 Mac Safari/Chrome、iPhone、iPad 的 Safari 与主屏幕 PWA 验证：A → B、长时间后台恢复、离线编辑联网、两个窗口及冲突处理。此任务不会合并 main、部署生产、运行生产迁移或修改线上部署设置。

实际测试结果与 PR 信息见本次任务交付说明。
