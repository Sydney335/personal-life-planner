# Verification record

Validated in the Linux cloud development machine on 2026-10-23, using Node 24.19.0 and Chromium 154. These results do not certify Safari, iOS, a published deployment, or a hosted Supabase account.

| Check                                       | Result              | Scope                                                                                                                     |
| ------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                    | Passed              | Frozen lockfile installation, no private registry required                                                                |
| `npm run build` / TypeScript                | Passed              | Production bundle and versioned offline service worker generated                                                          |
| `npm test`                                  | 21 passed, 0 failed | 13 sync/store/backup/calendar tests, 8 actual PostgreSQL schema/grant/RLS/CAS tests                                       |
| `npm run test:e2e`                          | 7 passed, 0 failed  | Chromium browser workflow; sizes 390×844, 834×1194, 1440×1000                                                             |
| `npm audit --audit-level=moderate`          | 0 vulnerabilities   | Production and development dependency tree at delivery                                                                    |
| PDF files                                   | Passed              | Generated Chinese daily PDF is 2 pages; English blank week is 14 pages; US Letter 612×792 pt; CJK text extraction checked |
| Actual hosted Auth/Realtime / three devices | **Not run**         | Requires a configured Supabase project and HTTPS deployment                                                               |
| Real iPhone / iPad / Mac Safari             | **Not run**         | See acceptance checklist                                                                                                  |
| GitHub Actions run                          | **Not run locally** | Workflow is provided; execution requires repository push/CI access                                                        |

Unit/contract coverage includes cross-store task/note creation, editing and tombstones; offline queue/reconnect; 50,000-character concurrent notes; persisted conflict comparison; delete/edit conflicts; edits made during a save request; lost acknowledgements and idempotent retries; network errors with retained outbox; local account partitioning; JSON restore/duplicate/difference handling; invalid backup rejection; invalid dates; leap days; midnight/year boundaries; New York DST transitions.

The sync contract double implements the expected server protocol; it is **not** evidence of a live cloud round trip. Database tests separately apply the actual migration in PGlite's PostgreSQL engine. Tests create an `auth.uid()`/role fixture and validate SQL CAS, retries, history, RLS selection, account spoof rejection, anonymous denial and denial of direct table writes. They do not exercise Supabase's Auth service, SMTP, hosted PostgREST, publication/WAL transport or network JWT validation.

Browser coverage includes task CRUD/completion, Notes/reflection persistence across reload, habit state, English/Chinese labels, history search, no horizontal document overflow at three target widths, production-shell offline reopening, JSON download/import, PDF generation, and a simulated IndexedDB quota failure that preserves the visible draft and recovers after storage works again. Screenshots were also visually inspected for desktop and mobile layout. Browser tests run local mode; they do not pretend that local mode is cross-device sync.

For optional live automation, `npm run test:live` uses three independent browser contexts connected to a real configured Supabase project plus a second test account. It requires all documented secure variables and fails fast if absent; it is not silently skipped or counted as passed. It writes disposable test data on 2099-12-20. Manual real-device testing remains necessary; follow [ACCEPTANCE.md](ACCEPTANCE.md).

Known constraints: first-load offline is unavailable, mobile background suspension delays updates until reopening, browser storage may be evicted, print dialogs differ across Safari/iOS/Chromium, cloud sync fetches the full account dataset in pages, and ordinary JSON backups exclude tombstones and server revision history. None of these are covered by an unqualified claim of full production readiness.
