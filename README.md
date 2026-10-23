# Daylight — Personal Life Planner / 个人生活规划

中文配置和部署说明：[docs/SETUP.zh-CN.md](docs/SETUP.zh-CN.md)。

A working, bilingual, offline-capable React PWA for iPhone, iPad and Mac. Uses **Supabase Auth + PostgreSQL** for account-based cloud synchronization, and **IndexedDB** for durable local editing. No paid AI API, analytics, or third-party font CDN.

**当前交付状态：源码可运行；云同步协议、数据库隔离和本地离线行为有自动化测试。没有连接真实 Supabase 项目或部署公开网址，因此尚未达到“真实 iPhone 新增后 iPad / Mac 可见”的最终验收。** Local mode is explicitly labeled and never pretends to synchronize.

## Run locally / 本地运行

Use Node **24 LTS** (22.12+ also supported).

```sh
npm ci
cp .env.example .env.local
# Optional for a local-only trial; fill in YOUR project's public values for cloud mode.
npm run dev
```

Open the development server shown in the terminal. Without cloud configuration, choose **Try on this device / 在本机体验**. This mode keeps records on that browser only. Cloud mode uses the login form. Local records do not silently migrate into an account; export/import a backup explicitly if desired.

```sh
npm run build       # TypeScript, production assets and versioned offline shell
npm run preview     # Validate the production build locally (including service worker)
npm test            # Sync/backup/date tests + PostgreSQL grants/RLS/CAS tests
npm run test:e2e     # Chromium workflow, responsive sizes, offline reopening and PDFs
npm audit
```

E2E tests default to `/usr/bin/chromium` in this cloud machine. On another machine install Chromium with `npx playwright install chromium`, then set `CHROMIUM_PATH` to its executable, or adapt `playwright.config.ts` to use Playwright's bundled Chromium. This is browser-size testing, not real Safari or device certification. Test PDFs are generated under `test-results/` (ignored by Git).

## Connect Supabase / 数据库及登录配置

1. Create a Supabase project; choose a region appropriate for your personal data. Record that region for your privacy notice. Free plans may pause or change quotas; review the current plan before relying on the app long term.
2. Open SQL Editor and run **[supabase/migrations/001_planner.sql](supabase/migrations/001_planner.sql)** once in a new project. Or use the Supabase CLI migration workflow (`supabase db push`) after linking your project. The migration creates tables, RLS, an atomic write RPC, append-only revision history, and enables Realtime when its publication exists.
3. Under Authentication → Providers enable Email/password. Keep email confirmation enabled. Configure production SMTP before regular use; default development email delivery is rate limited. No OAuth provider or social login is required.
4. Under Authentication → URL Configuration set **Site URL** to your HTTPS app origin. Add the exact same origin to **Redirect URLs**. Add your local development origin only for development. Account confirmation and password recovery return to that origin. Recovery uses PKCE: open the email in the same browser that requested it.
5. Under Project Settings → API copy the project URL and **publishable key** (or legacy public `anon` key) into `.env.local`:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
   ```

   These two values are public client configuration. **Never use `service_role`, an `sb_secret_…` key, a database password, or a management token in any VITE variable.** All VITE values are compiled into browser assets. Never commit `.env.local`.

6. Restart the dev server or rebuild. Register an account, confirm the email, and sign in. Sign in with the **same account** on each device. Realtime should work automatically; 15-second polling plus focus/reconnect provides a fallback.
7. Validate RLS and actual sync using [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md), including a second user. Do this before storing sensitive notes.

Network destinations: `registry.npmjs.org` for install; your **exact** `<project-ref>.supabase.co` over HTTPS/WSS for auth/data; GitHub for source control. The cloud environment's network policy must allow your project host before live validation. The app never needs a Supabase service key.

## Deploy an HTTPS app / 免费部署

The repository includes `vercel.json` with security headers and the Vite build configuration. Deployment is not performed by merely committing this file.

1. In your Vercel account import this GitHub repository. Choose Vite, Node 24, install `npm ci`, build `npm run build`, output `dist`.
2. Set the two **public** Supabase environment values above in the deployment's environment settings. Keep private credentials in each provider's secure settings, never in chat or the repository. Rebuild after changing VITE values.
3. Deploy. Use the resulting **HTTPS** production origin to configure Supabase Site URL and Redirect URLs. Avoid wildcard auth redirects. Keep preview and production data separate if desired.
4. Confirm sign-up email, login, password reset, multi-device sync, offline restart and print behavior using the acceptance checklist. Vercel Hobby/Supabase Free are possible personal-use starting points, subject to provider limits and terms.

Any HTTPS static host can serve `dist/`; copy the security headers from `vercel.json`, make `/sw.js` revalidate, and allow `https://<your-project>.supabase.co` and `wss://<your-project>.supabase.co` in `connect-src`. Custom Supabase domains need a corresponding CSP change. Do not cache API responses. Localhost is for development; it is not a public deployment.

## Install on Apple devices / 安装到 Apple 设备

- **iPhone / iPad:** visit the deployed HTTPS URL in Safari → Share / 分享 → Add to Home Screen / 添加到主屏幕 → open the new icon → sign in. An already loaded production shell can reopen offline; first visit and first login require a connection.
- **Mac:** use the deployed URL in any modern browser. Safari (macOS Sonoma or newer): File → Add to Dock. Chrome/Edge: use the install app menu when offered. Browser-specific install support varies.
- iPhone uses bottom navigation and single-column cards. iPad uses a sidebar, calendar and split planner layout, with a wider writing workspace in landscape. Mac expands the calendar, modules and dashboard; tasks can be dragged within a module or reordered with buttons. Alt+1–4 switches the main views.
- iOS storage may be evicted under pressure or cleared by the user. Private browsing may restrict storage. Local-only mode and unsynchronized edits are not substitutes for backups. Updates activate after existing app tabs close; cached shell and local records remain separate.

## Implemented / 已实现

- Account creation, email confirmation, password login/recovery/sign-out; cloud account separation.
- Daily task CRUD across eight modules: study, main priorities (up to three via the add UI), alternative activities, meals, exercise, social, leisure and to-dos. Dates, planned times, actual study duration, location, custom activity types, protein-source category, deadline, priority, completion, defer and reordering. Unfinished main tasks/to-dos remain accessible.
- Per-day long Notes, optional reflections, End My Day and configurable 01:00 bedtime default.
- Gentle habits: done / skipped / blank; custom habits; movement and sitting observations.
- Local autosave, offline persistent outbox, automatic authenticated cloud sync, retries, status display, optimistic revision checks, explicit conflict review and cloud revision history.
- Month/week calendar, history search, weekly/monthly summaries, actual study minutes, exercise goal, social/alcohol-free/routine counts, meal-category frequency (not nutrient intake). Missing days are shown as missing, not invented observations.
- English/Chinese, light/dark, collapsible/reorderable modules. Language/theme are device preferences; planner content, habits and module settings sync.
- JSON backup validation, confirmation, duplicate-safe **missing-record-only** import. Existing/tombstoned records are not overwritten; differences are counted and skipped. A backup is not a destructive database restore.
- System print/PDF: daily planner, Notes, combined daily two-page template, whole week, filled/blank, English/Chinese, US Letter. Long content flows onto additional pages rather than being silently clipped. Requires the platform print/share dialog; this is not a one-click binary PDF download API.
- App-only reminders: deadlines are shown with tasks and carried-over unfinished to-dos. **No system/background push notifications**.

## Privacy, backup and limits / 隐私、备份和边界

Read **[docs/SECURITY.md](docs/SECURITY.md)** before storing personal or health-related records. Cloud data is stored in the region selected for YOUR Supabase project; the app cannot infer or guarantee a specific country. Supabase/project administrators can access database contents. **This is not end-to-end encryption.** Database access is authenticated and isolated with RLS; HTTPS protects transport. There is no AI integration or telemetry.

Export JSON regularly via Settings → Backup & restore; store plaintext exports securely outside the device. Import requires confirmation and never deletes or overwrites existing records. If versions differ, retain the file and compare manually; automatic historical rollback/overwrite is intentionally not included. Resolve conflicts before export so neither side is silently omitted. Accepted cloud revisions and tombstones remain in the database; see SECURITY for recovery and permanent deletion. Only current live records are in the regular portable backup, not the server's revision audit history.

**Not yet verified / remaining:** deployed live Auth/Realtime and three actual Apple devices, Safari print output, iOS offline eviction behavior; see [docs/TESTING.md](docs/TESTING.md). Further enhancements include account deletion UI, user-facing revision-history recovery, richer recurring reminders/push, advanced trend charts and a configurable sync pagination strategy for very large multi-year datasets. The current sync fetches the account's complete record set in pages; appropriate for a personal MVP, not unlimited datasets.

No external service is provisioned automatically and no production URL is claimed. Provider account setup, secure project configuration and the real-device acceptance check are required before calling cloud sync complete.

For optional automated **live** validation, use two confirmed, disposable Supabase test accounts and provide `PLANNER_TEST_EMAIL`, `PLANNER_TEST_PASSWORD`, `PLANNER_OTHER_EMAIL`, `PLANNER_OTHER_PASSWORD` plus the two VITE values through a secure process environment. Then run `npm run test:live`. It uses three independent browser contexts plus a second account, writes test data on **2099-12-20**, and leaves those test records for inspection. Do not use personal production accounts. This test is separate from the local suite, requires all six variables, and has not been run without a configured cloud project. No trace/video is recorded for the live suite.
