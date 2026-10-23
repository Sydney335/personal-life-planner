# Live acceptance checklist / 真实上线验收

Use a dedicated test account with nonsensitive sample data. Do not enter passwords or private keys in chat. These checks require YOUR deployed HTTPS URL and configured Supabase project. They have not been executed against a live project in this environment.

1. Apply migration, deploy with public project URL/key, configure exact auth redirects, confirm email, then sign in on an iPhone, iPad and Mac using the same account.
2. On iPhone, add a task with a unique title. Keep iPad/Mac online with the app open. Confirm it appears automatically (Realtime normally, polling within about 15 seconds). Edit on iPad, complete on Mac, check iPhone. Close/reopen all apps; history and unfinished tasks must remain.
3. On iPhone write a long Chinese/English note, including reflections. Reopen on Mac and verify full contents, line breaks and selected date. Check Settings and habits also sync.
4. Load the installed app, then disable networking on one device. Write a note/add a task/check a habit. Close and reopen the installed app offline. Reconnect; verify the Offline → Syncing → Saved sequence and actual content on another device.
5. Open the same note on two devices. Put both offline. Write different paragraphs. Reconnect A, wait until Saved; reconnect B. B must show Needs review with **both full versions**. Combine note text, review reflection fields, save. All devices should converge. Repeat with delete versus edit. Check `planner_history` retains accepted revisions.
6. Create a SECOND user. It must see none of the first user's tasks/notes/history. In authenticated API tests try selecting the first user's `user_id`, writing directly to each table, and calling the RPC with the other `p_user_id`: all access must be empty/denied. Anonymous private table reads/RPC calls must fail. Never test with a service-role key.
7. Test password recovery in the same browser requesting the email; set a new password and verify it. Try signing out with pending offline changes; the app must prevent data loss.
8. Test iPhone portrait, iPad portrait/landscape with a keyboard, and Mac at 100% zoom. Check touch targets, bottom nav, sidebar, date selection, long Notes, module reorder, light/dark and both languages.
9. Use Settings → Print/PDF: filled Chinese daily two-page template, Notes-only, blank English whole week. Select US Letter, 100%, no browser header/footer. On iOS share the print preview to Files. Confirm CJK glyphs and wrapping; very long notes should continue rather than clip. Background graphics are needed for faint handwriting rules in some browsers.
10. Export JSON, keep it securely, import into a fresh test account/device, check records. Repeat import: no duplicates. Try an altered backup of an existing record: it should be skipped/count different, never overwrite. Cancel confirmation: no changes.
11. Change timezone, select dates around March/November DST and year boundaries, and verify records retain their chosen calendar date. Actual study/exercise durations are explicitly entered, not inferred from elapsed timezone-aware timestamps.
12. Confirm only documented destinations receive traffic and no `service_role`/secret key is in the built assets. Record your actual Supabase storage region and free-plan backup/availability policy before regular use.

Only after checks 1–6 succeed on the deployed app can the Phase 1 cross-device synchronization acceptance be signed off.
