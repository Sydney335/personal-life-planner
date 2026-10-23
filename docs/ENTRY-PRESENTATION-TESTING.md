# Entry presentation validation

Executed in the managed development workspace on 2026-10-23. No production database writes, production deployment, or merge was performed.

## Executed checks

- `npm run check`: TypeScript passed.
- `npm test`: **38/38** Vitest logic, IndexedDB/SyncEngine contract, and PGlite PostgreSQL tests passed.
- `npm run build`: production Vite build and generated offline service worker passed.
- `npm run test:e2e`: **18/18 Chromium tests passed**, including the original eight regression flows and ten entry-presentation flows.
- `git diff --check`: passed.
- Exported long Chinese PDF inspected using `pdfinfo` and `pdftotext`: **6 US Letter pages**, with the final `最后一行 END-OF-JOURNAL` text present in extracted PDF text.
- Visually inspected Simplified Chinese Mac settings and the iPhone layout at 160% text scale using local screenshots.

An initial browser run caught ambiguous paragraph test locators and a missing explicit accessible name for the print-mode selector. These were corrected, the two affected flows passed individually, and the final complete browser suite passed.

## Coverage map

| Requirement | Executed coverage |
| --- | --- |
| Typography controls, immediate preview, reset and reload | Browser settings flow; 80–160% schema validation |
| Cross-device font/color preferences | Two IndexedDB device stores and shared fake cloud through the real SyncEngine |
| Unmarked default, no clock inference, after-midnight manual choice | Schema tests with frozen clocks; 02:00 browser flow across all eight task categories |
| Preserve labels after text/date edits and reopening | Task edit, planning-date navigation and next-day reload browser flow; Store sync tests |
| Palette, picker and HEX validation | 20 swatches; preset, custom picker input events, short HEX expansion, invalid input and reset |
| Light/dark preview and contrast warning | Simultaneous background previews; low-contrast color preserved |
| Dynamic legend dates, colors and language | Year-boundary reference dates; category color changes update tasks and legend; Chinese labels |
| Reversible strikethrough, independent completion and reclassification | Real task and paragraph toggles; hidden effect with retained state; completion remains independent |
| Paragraph formatting, edit, backup and restore | Mixed Chinese notes, offline reopen, real JSON download, clear and import |
| Offline/cloud sync and conflicts | Existing offline PWA regression plus real Store/SyncEngine contract doubles; formatted note and settings conflicts |
| Conflict editor | Browser conflict envelope, preserved formatting, editable combined paragraphs and explicit save |
| Backward compatibility | Legacy payload defaults, pre-update IndexedDB record, whitespace round trip and unchanged migration data |
| English/Chinese localization | Existing bilingual regressions; exact requested Chinese concepts; large-text Chinese navigation |
| PDF color/B&W and clean blanks | Actual generated PDFs, CSS colors/strike and textual category labels; original two/14-page regressions |
| Long Chinese PDF | Larger print scale and continuation pages; final text verified in extracted PDF |
| Responsive layouts | 390×844, 834×1194, 1440×1000 Chromium viewports; 160% scale, light/dark, English/Chinese, all views and navigation bounds |
| Keyboard access | Radio arrow navigation, strike toggle and color swatch activation with Space and visible focus |
| Safe migration and large Chinese payloads | PGlite executes both migrations, preserves legacy rows/RLS, keeps creation timestamps stable and accepts expanded formatted payload |

## Limits

These device names describe viewport sizes, not physical Apple devices or Safari. Cross-device synchronization uses a protocol test double, not a live Supabase account; SQL grants, RLS and compare-and-set are tested separately in PGlite. Existing live/production test commands were not run because no authenticated Supabase test account is configured for this environment. Safari/PWA, native picker UI and native print/share behavior still require device acceptance on an approved preview build.

Notes use explicit paragraph blocks; line breaks inside a block share its classification and formatting. Add a separate paragraph for independently formatted sentences. Formatting is plain data, not HTML. Filled print text uses a bounded 90–130% equivalent of screen scaling and can add continuation pages. Refresh every device to the new editor before using the new fields.
