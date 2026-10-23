# Daylight — Personal Life Planner

**English** | [简体中文](README.zh-CN.md)

A calm, bilingual planner for daily plans, habits and reflection. Daylight is a responsive Progressive Web App (PWA) for iPhone, iPad and Mac, with account-based cloud sync and local offline editing.

**[Open the app](https://personal-life-planner-omega.vercel.app)**

> A little structure. Room for life.

## What you can do

| Feature               | Details                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily planner         | Study sessions, up to three main priorities through the add interface, alternative activities, meals, exercise, social time, leisure and to-dos |
| Flexible records      | Planned times, actual study minutes, locations, notes, deadlines, priorities, completion, deferral and task ordering                            |
| Habits                | Done, skipped or blank states, custom habits, and gentle movement and bedtime reminders without streak penalties                                |
| Daily Notes           | Long-form writing, optional reflection prompts, an End My Day routine and a configurable bedtime, defaulting to 1:00 AM                         |
| Calendar and overview | Month/week calendar, history search, weekly/monthly summaries, study hours and exercise goals                                                   |
| Cross-device sync     | Supabase login, automatic saving, an offline queue, sync status and explicit conflict review                                                    |
| Personalization       | English/Chinese interface, light/dark mode, collapsible modules and custom module order                                                         |
| Paper planner         | Daily planner, Notes, combined daily or whole-week printing; filled or blank; English or Chinese; US Letter                                     |
| Backups               | JSON export and validated, duplicate-safe import of missing records                                                                             |

Meal statistics show **meal frequency by protein-source category**, not nutrient intake. Missing days remain unrecorded. Leisure is a normal part of the planner, not a reward for finishing work.

## Start using Daylight

1. Open the [app](https://personal-life-planner-omega.vercel.app) and create an account or sign in. Confirm your email if requested.
2. Sign in with the **same account** on each device to synchronize planner data.
3. Choose a date to plan today, edit an earlier day or prepare for tomorrow. Open **Notes** for writing and reflection.
4. Use **Settings** for module order, exercise goals, custom habits, backups and print/PDF options. Switch the interface language and theme from the top bar.

**Try on this device** is a separate, local-only mode. Its records do not sync or automatically move into an account. To transfer them, export a JSON backup and explicitly import it after signing in.

## Install on your devices

| Device        | How to use or install                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| iPhone / iPad | Open the HTTPS app URL in Safari → Share → Add to Home Screen. Launch the new icon and sign in.                               |
| Mac           | Use a modern browser. In Safari on macOS Sonoma or later, choose File → Add to Dock. Chrome/Edge may offer an install option. |

The interface uses bottom navigation on iPhone, a sidebar and split layouts on iPad, and a wider workspace on Mac. Tasks can be dragged within a module or moved with reorder buttons. **Alt+1–4** switches the main views where supported by the browser and keyboard.

Installation depends on browser support. First access and first login require a connection. An already loaded production app can reopen offline, but device storage can be cleared or evicted; keep regular backups.

## How saving and sync work

- Edits save to **IndexedDB** on the device before uploading to the authenticated account.
- Realtime updates, 15-second polling and synchronization on focus/reconnect keep active devices up to date.
- The interface distinguishes cloud-saved, syncing, offline, sync-error and conflict states. A cloud-saved status does not mean every suspended device has already downloaded the change.
- Conflicting edits preserve both versions for review. Notes can combine the main text; reflection fields retain the device version during a merge, so review those fields too. Accepted cloud revisions are retained in server history.
- Mobile operating systems suspend background web apps. Synchronization resumes when the app is opened; guaranteed background sync is not provided.

Reminders appear **inside the app**. System push notifications and reliable background alerts are not implemented.

## Print, export and restore

In **Settings → Print / PDF**, choose daily planner, Notes, a combined daily template or a whole week, then select a language and filled/blank content. Use the system print dialog with **US Letter**, 100% scale and browser headers/footers disabled. On iOS, share the print preview to save it to Files. Long content continues onto additional pages instead of being clipped; PDF saving options vary by platform.

In **Settings → Backup & restore**, export JSON regularly and store it securely outside the device. Backups contain plaintext private records. Normal exports include current live records, not deleted-record markers or all server revision history. Resolve conflicts before export or separately copy both versions first.

Import requires confirmation and adds **missing records only**. Repeated imports do not duplicate entries; existing or previously deleted records are not overwritten, and different versions are skipped and counted. This is a safe merge of missing records, not a destructive rollback. Cloud sync is not an independent backup.

## Technology

- **Frontend:** React, TypeScript and Vite
- **Styling:** responsive CSS and system fonts; Lucide icons
- **Identity and cloud data:** Supabase Auth, PostgreSQL and Realtime
- **Local storage:** IndexedDB through `idb`
- **Offline app shell:** a versioned service worker generated during the production build
- **Hosting:** Vercel, or another HTTPS static host
- **Tests:** Vitest, PGlite and Playwright

No paid AI API, analytics service or external font CDN is required. Supabase Free and Vercel Hobby can be starting points for personal use, subject to their current terms, quotas, availability and backup policies.

## Run locally

Use **Node 24 LTS**; the repository pins it in `.nvmrc` and `.node-version`. Node 22.12+ is also supported by the package requirements.

```sh
git clone https://github.com/Sydney335/personal-life-planner.git
cd personal-life-planner
npm ci
npm run dev
```

Open the development address shown in the terminal. Without Supabase configuration, choose **Try on this device**. To enable account-based cloud mode, follow the next section.

```sh
npm run build       # TypeScript, production assets and offline service worker
npm run preview     # Serve the production build for local validation
npm test            # Sync, backup, date and PostgreSQL/RLS tests
npm run test:e2e     # Local browser workflows, responsive sizes, offline and PDF
npm audit           # Dependency security audit
```

The service worker runs in production builds, not the Vite development server. Browser tests default to `/usr/bin/chromium` in the cloud environment. Elsewhere, install Chromium with `npx playwright install chromium` and set `CHROMIUM_PATH` to its executable, or configure Playwright to use its bundled browser. Test output is Git-ignored.

## Configure your own Supabase project

1. Create a project and choose a suitable data region. Record the region for your users; do not assume a specific country or backup policy.
2. In SQL Editor, run [001_planner.sql](supabase/migrations/001_planner.sql) **once in a new project**. Alternatively, link the project with the Supabase CLI and use `supabase db push`. The migration creates private tables, Row Level Security (RLS), an atomic version-checked write function, revision history and Realtime publication membership when available.
3. Enable **Email/password** authentication and keep email confirmation enabled. Configure production SMTP for regular use; development email delivery is rate limited.
4. Set **Authentication → URL Configuration → Site URL** to your app's HTTPS origin, and add the exact origin to **Redirect URLs**. Add local origins only for development. Password recovery uses PKCE; open the email in the browser that requested it.
5. Copy `.env.example` to `.env.local` and supply your project's public configuration:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
   ```

   These are public browser values. **Never put a service-role key, `sb_secret_…` key, database password or management token into a `VITE_` variable.** Never commit `.env.local`.

6. Restart the development server or rebuild, then register, confirm your email and sign in. Test both synchronization and isolation using a second account before storing sensitive data.

A restricted development network must allow the exact project hostname over HTTPS/WSS, `registry.npmjs.org` for installation and GitHub for source control. The app does not need a Supabase service key.

## Deploy your own copy

1. Import the repository into Vercel and select **Vite**, **Node 24**, install command `npm ci`, build command `npm run build` and output directory `dist`.
2. Set the two public Supabase variables above in the appropriate Vercel environments. Rebuild after changing them. Review whether preview deployments should use a separate test project.
3. Deploy, then update Supabase's Site URL and exact allowed redirects to match your production origin.
4. Follow the [acceptance checklist](docs/ACCEPTANCE.md), including email login/recovery, cross-device updates, offline reconnect, conflicts and two-user isolation.

[vercel.json](vercel.json) provides security headers and build settings. On another HTTPS static host, preserve those headers, make `/sw.js` revalidate and allow your Supabase HTTPS/WSS endpoints in `connect-src`. A custom Supabase domain needs a corresponding Content Security Policy change. Do not cache API responses.

If Vercel blocks a deployment because it cannot identify a commit author, check the author's GitHub identity and the project's connected Git account/access. A Preview deployment does not update the Production URL; merge reviewed changes into the configured production branch, normally `main`.

## Privacy and current limits

Read [the security and data-handling guide](docs/SECURITY.md) before storing sensitive records.

- Cloud records are stored in **your Supabase project's selected region** and cached in each browser. RLS separates authenticated users; HTTPS protects transport.
- This is **not end-to-end encryption**. Project administrators and the provider may access cloud data, and someone with access to an unlocked browser profile may access local data. Notes are not sent to AI or analytics services.
- Deleting an entry creates a synchronized deletion marker; it does not immediately erase server history. Permanent account deletion currently requires the project owner's trusted Supabase administration flow, plus separate removal of device data and exported backups.
- Self-service account deletion, a revision-history recovery interface and background push notifications are not implemented. Sync currently fetches the full account dataset in pages, rather than using incremental synchronization for very large archives.
- Automated viewport tests do not certify actual iPhone/iPad/Mac Safari behavior. Production settings, real-device installation, storage eviction and platform print dialogs need separate validation.

## Verification and documentation

- [Testing scope and original verification record](docs/TESTING.md)
- [Dated production acceptance report, findings and test-access requirements](docs/PRODUCTION-ACCEPTANCE-2026-10-23.md)
- [Live and real-device acceptance checklist](docs/ACCEPTANCE.md)
- [Security, retention, deletion and recovery](docs/SECURITY.md)
- [Chinese setup guide](docs/SETUP.zh-CN.md)

For unauthenticated deployed-site checks, run `npm run test:production`; it defaults to the app URL above. For authenticated tests, securely inject `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `PLANNER_TEST_EMAIL`, `PLANNER_TEST_PASSWORD`, `PLANNER_OTHER_EMAIL` and `PLANNER_OTHER_PASSWORD`, then run:

```sh
PLANNER_BASE_URL=https://personal-life-planner-omega.vercel.app npm run test:live
```

Use two confirmed, disposable accounts and protected runtime secrets, never passwords in chat or committed files. The live suite writes test records on **2099-12-20** and leaves them for inspection. Without `PLANNER_BASE_URL`, it tests a local frontend against Supabase. Remote suites disable traces, screenshots and videos. Historical acceptance reports describe the conditions at their stated date; they are not a live uptime monitor or a claim that every real-device check has passed.
