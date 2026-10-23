import {
  categories,
  noteDefaults,
  settingsDefaults,
  parseDay,
  weekDays,
  type Lang,
  type LocalRecord,
} from "./domain";
import { EntryLegend } from "./EntryPresentation";
import { entryStyle, noteParagraphs } from "./entryFormatting";
import { tr } from "./i18n";
export interface PrintOptions {
  scope: "daily" | "plannerOnly" | "notesOnly" | "wholeWeek";
  blank: boolean;
  lang: Lang;
  stamp: number;
  mode?: "color" | "bw";
}
export function PrintPages({
  day,
  records,
  options,
}: {
  day: string;
  records: LocalRecord[];
  lang: Lang;
  options: PrintOptions;
}) {
  const lang = options.lang;
  const t = (key: Parameters<typeof tr>[1]) => tr(lang, key);
  const settingsRecord = records.find((r) => r.kind === "settings");
  const settings =
    settingsRecord?.kind === "settings"
      ? { ...settingsDefaults, ...settingsRecord.payload }
      : settingsDefaults;
  const printScale = options.blank
    ? 1
    : Math.min(1.3, Math.max(0.9, settings.fontScale));
  const days = options.scope === "wholeWeek" ? weekDays(day) : [day];
  return (
    <div
      id="print-pages"
      className={options.mode === "bw" ? "print-bw" : "print-color"}
      lang={lang === "zh" ? "zh-CN" : "en"}
      style={
        {
          "--print-scale": printScale,
          "--previous-day-color": settings.previousDayColor,
          "--same-day-color": settings.sameDayColor,
        } as import("react").CSSProperties
      }
    >
      {days.map((d) => {
        const daily = options.blank ? [] : records.filter((r) => r.day === d);
        const noteRecord = daily.find((r) => r.kind === "note");
        const note =
          noteRecord?.kind === "note" ? noteRecord.payload : noteDefaults;
        return (
          <div className="print-day" key={d}>
            {options.scope !== "notesOnly" && (
              <article className="print-page planner-page">
                <header>
                  <span>DAYLIGHT · {t("today")}</span>
                  <h1>
                    {new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en", {
                      dateStyle: "full",
                    }).format(parseDay(d))}
                  </h1>
                </header>
                {!options.blank && (
                  <EntryLegend day={d} lang={lang} settings={settings} t={t} />
                )}
                <div className="print-module-grid">
                  {categories.map((category) => (
                    <section key={category}>
                      <h2>{t(category)}</h2>
                      {daily
                        .filter(
                          (r) =>
                            r.kind === "task" &&
                            r.payload.category === category,
                        )
                        .map(
                          (r) =>
                            r.kind === "task" && (
                              <div className="print-task" key={r.id}>
                                <span className="print-label">
                                  {t(r.payload.classification ?? "unmarked")}
                                </span>
                                <div style={entryStyle(r.payload)}>
                                  <b>
                                    {r.payload.completed ? "☑" : "☐"}{" "}
                                    {r.payload.title}
                                  </b>
                                  <small>
                                    {r.payload.start}
                                    {r.payload.end &&
                                      ` – ${r.payload.end}`}{" "}
                                    {r.payload.location}{" "}
                                    {r.payload.minutes > 0 &&
                                      `${r.payload.minutes} ${t("minutes")}`}{" "}
                                    {r.payload.actualMinutes > 0 &&
                                      `${t("actual")}: ${r.payload.actualMinutes}`}{" "}
                                    {r.payload.dueDate &&
                                      `${t("due")}: ${r.payload.dueDate}`}{" "}
                                    {r.payload.category === "meal" &&
                                      t(r.payload.protein)}{" "}
                                    {r.payload.activityType}
                                  </small>
                                  {r.payload.notes && <p>{r.payload.notes}</p>}
                                </div>
                              </div>
                            ),
                        )}
                      <div className="writing-lines" />
                    </section>
                  ))}
                </div>
                <section>
                  <h2>{t("habits")}</h2>
                  <div className="print-habits">
                    {(
                      [
                        "alcohol",
                        "supplements",
                        "medication",
                        "phone",
                        "movement",
                        "sedentary",
                      ] as const
                    ).map((key) => {
                      const record = daily.find(
                        (r) => r.kind === "habit" && r.payload.key === key,
                      );
                      return (
                        <span key={key}>
                          {record?.kind === "habit" &&
                          record.payload.state === "done"
                            ? "☑"
                            : "☐"}{" "}
                          {t(key)}
                          {record?.kind === "habit" &&
                          record.payload.state === "skip"
                            ? ` (${t("skip")})`
                            : ""}
                        </span>
                      );
                    })}
                    {daily
                      .filter(
                        (r) =>
                          r.kind === "habit" &&
                          r.payload.key.startsWith("custom:"),
                      )
                      .map((r) => (
                        <span key={r.id}>
                          {r.kind === "habit"
                            ? (r.payload.state === "done" ? "☑ " : "☐ ") +
                              r.payload.title
                            : ""}
                        </span>
                      ))}
                  </div>
                </section>
              </article>
            )}
            {options.scope !== "plannerOnly" && (
              <article className="print-page notes-page">
                <header>
                  <span>DAYLIGHT · {t("notes")}</span>
                  <h1>{d}</h1>
                </header>
                {!options.blank && (
                  <EntryLegend day={d} lang={lang} settings={settings} t={t} />
                )}
                <section className="print-journal">
                  {note.text ? (
                    noteParagraphs(note).map((p) => (
                      <div key={p.id}>
                        <span className="print-label">
                          {t(p.classification)}
                        </span>
                        <p style={entryStyle(p)}>{p.text}</p>
                      </div>
                    ))
                  ) : (
                    <div className="handwriting-space" />
                  )}
                </section>
                <section className="print-reflection">
                  {(
                    [
                      "meaningful",
                      "accomplished",
                      "tomorrow",
                      "complete",
                    ] as const
                  ).map((key) => (
                    <div key={key}>
                      <h2>{t(key)}</h2>
                      <p>{note[key] || "\u00a0"}</p>
                    </div>
                  ))}
                </section>
                <footer>
                  {t("bedtime")}: {options.blank ? "________" : note.bedtime} ·{" "}
                  {t("endDay")} {note.ended ? "☑" : "☐"}
                </footer>
              </article>
            )}
          </div>
        );
      })}
    </div>
  );
}
