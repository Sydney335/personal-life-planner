import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Feather,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Plus,
  Printer,
  Search,
  Settings2,
  Sun,
  X,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import { supabase, configured } from "./cloud";
import {
  addDays,
  categories,
  exportBackup,
  localDay,
  noteDefaults,
  parseBackup,
  parseDay,
  plannedMinutes,
  settingsDefaults,
  stableId,
  taskSchema,
  valueOf,
  weekDays,
  type Lang,
  type LocalRecord,
  type Note,
  type RecordValue,
  type Settings,
  type Task,
} from "./domain";
import {
  EntryControls,
  EntryLegend,
  TypographySettings,
} from "./EntryPresentation";
import {
  combinedNote,
  entryStyle,
  noteParagraphs,
  withParagraphs,
} from "./entryFormatting";
import { tr, type TextKey } from "./i18n";
import { usePlanner } from "./usePlanner";
import { PrintPages, type PrintOptions } from "./PrintPages";
import { UpdateNotice, UpdateAbout } from "./UpdateFeedback";
import { updates } from "./updates";
type View = "today" | "notes" | "calendar" | "weekly" | "settings";
type T = (key: TextKey) => string;
const views = [
  ["today", ListTodo],
  ["notes", Feather],
  ["calendar", CalendarDays],
  ["weekly", LayoutDashboard],
  ["settings", Settings2],
] as const;
const defaultHabits = [
  "alcohol",
  "supplements",
  "medication",
  "phone",
  "movement",
  "sedentary",
] as const;
function readPreference(name: string, fallback: string) {
  try {
    return localStorage.getItem(name) || fallback;
  } catch {
    return fallback;
  }
}
function persistPreference(name: string, value: string) {
  try {
    localStorage.setItem(name, value);
  } catch {
    /* Other functionality can continue without preferences. */
  }
}
export function App() {
  const [lang, setLang] = useState<Lang>(
    readPreference(
      "daylight-lang",
      navigator.language.startsWith("zh") ? "zh" : "en",
    ) as Lang,
  );
  const [theme, setTheme] = useState(
    readPreference(
      "daylight-theme",
      matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    ),
  );
  const [owner, setOwner] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(!!supabase);
  const [recovery, setRecovery] = useState(false);
  const [guest, setGuest] = useState(
    sessionStorage.getItem("daylight-guest") === "yes",
  );
  const t: T = (k) => tr(lang, k);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    persistPreference("daylight-lang", lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    persistPreference("daylight-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setOwner(data.session?.user.id ?? null);
        setInitializing(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        setOwner(session?.user.id ?? null);
        setInitializing(false);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const languageButton = (
    <button
      className="quiet"
      onClick={() => setLang(lang === "en" ? "zh" : "en")}
      aria-label="中文 / English"
    >
      {lang === "en" ? "中文" : "EN"}
    </button>
  );
  if (initializing)
    return (
      <div className="welcome">
        <p>{t("loading")}</p>
      </div>
    );
  if (recovery)
    return (
      <Auth
        t={t}
        languageButton={languageButton}
        onGuest={() => {}}
        recovery
        onRecovered={() => setRecovery(false)}
      />
    );
  if (!owner && !guest)
    return (
      <Auth
        t={t}
        languageButton={languageButton}
        onGuest={() => {
          sessionStorage.setItem("daylight-guest", "yes");
          setGuest(true);
        }}
      />
    );
  return (
    <Workspace
      key={owner || "local-device"}
      owner={owner || "local-device"}
      lang={lang}
      t={t}
      theme={theme}
      setTheme={setTheme}
      languageButton={languageButton}
      onExit={() => {
        sessionStorage.removeItem("daylight-guest");
        setGuest(false);
        setOwner(null);
      }}
    />
  );
}
function Auth({
  t,
  languageButton,
  onGuest,
  recovery = false,
  onRecovered,
}: {
  t: T;
  languageButton: ReactNode;
  onGuest: () => void;
  recovery?: boolean;
  onRecovered?: () => void;
}) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () => updates.setGuard(async () => !busy && !email && !password),
    [busy, email, password],
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        onRecovered?.();
      } else if (mode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin },
        });
        if (error) throw error;
        setMessage(t("authSent"));
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!supabase || !email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin,
    });
    setMessage(error ? error.message : t("resetSent"));
    setBusy(false);
  };
  return (
    <div className="welcome">
      <header>
        <span className="brand">
          <Sun size={27} /> {t("app")}
        </span>
        {languageButton}
      </header>
      <main className="welcome-grid">
        <section>
          <span className="eyebrow">PERSONAL LIFE PLANNER</span>
          <h1>{t("tagline")}</h1>
          <p className="lead">{t("noteHint")}</p>
          <div className="welcome-art">
            <Sun size={84} strokeWidth={1} />
            <span>PLAN · PAUSE · REFLECT</span>
          </div>
        </section>
        <section className="card auth-card">
          <h2>{t(recovery ? "newPassword" : mode)}</h2>
          {configured ? (
            <form onSubmit={submit}>
              {!recovery && (
                <label>
                  {t("email")}
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              <label>
                {t("password")}
                <input
                  type="password"
                  autoComplete={
                    mode === "signIn" && !recovery
                      ? "current-password"
                      : "new-password"
                  }
                  minLength={mode === "signUp" || recovery ? 12 : 1}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                {t(recovery ? "newPassword" : mode)}
              </button>
              {!recovery && (
                <>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() =>
                      setMode(mode === "signIn" ? "signUp" : "signIn")
                    }
                  >
                    {t(mode === "signIn" ? "signUp" : "signIn")}
                  </button>
                  <button
                    type="button"
                    className="quiet"
                    disabled={busy || !email}
                    onClick={() => void reset()}
                  >
                    {t("forgot")}
                  </button>
                </>
              )}
            </form>
          ) : (
            <p className="notice">{t("configure")}</p>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          {!recovery && (
            <>
              <hr />
              <button className="secondary full" onClick={onGuest}>
                {t("demo")}
              </button>
              <small>{t("demoHint")}</small>
            </>
          )}
          <p className="fine-print">{t("privacyText")}</p>
        </section>
      </main>
      <UpdateNotice t={t} />
    </div>
  );
}
function Workspace({
  owner,
  lang,
  t,
  theme,
  setTheme,
  languageButton,
  onExit,
}: {
  owner: string;
  lang: Lang;
  t: T;
  theme: string;
  setTheme: (s: string) => void;
  languageButton: ReactNode;
  onExit: () => void;
}) {
  const planner = usePlanner(owner);
  const { records, edit, status, error, loaded } = planner;
  const updateGuard = useRef(planner.canUpdate);
  updateGuard.current = planner.canUpdate;
  useEffect(
    () =>
      updates.setGuard(
        (automatic) => updateGuard.current(automatic),
        () => planner.pauseSync(),
      ),
    [],
  );
  const [day, setDay] = useState(localDay());
  const [view, setView] = useState<View>("today");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editing, setEditing] = useState<LocalRecord | Task["category"] | null>(
    null,
  );
  const [conflicts, setConflicts] = useState(false);
  const [printOptions, setPrintOptions] = useState<PrintOptions | null>(null);
  const [message, setMessage] = useState("");
  const active = records.filter((r) => !r.deleted);
  const dayRecords = active.filter((r) => r.day === day);
  const settingsRecord = active.find((r) => r.kind === "settings");
  const settings: Settings =
    settingsRecord?.kind === "settings"
      ? { ...settingsDefaults, ...settingsRecord.payload }
      : settingsDefaults;
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-scale", String(settings.fontScale));
    root.style.setProperty("--previous-day-color", settings.previousDayColor);
    root.style.setProperty("--same-day-color", settings.sameDayColor);
    return () => {
      root.style.removeProperty("--font-scale");
      root.style.removeProperty("--previous-day-color");
      root.style.removeProperty("--same-day-color");
    };
  }, [settings.fontScale, settings.previousDayColor, settings.sameDayColor]);
  const saveSettings = (s: Settings) =>
    edit({
      id: stableId("settings"),
      kind: "settings",
      day: "2000-01-01",
      deleted: false,
      payload: s,
    });
  const goDay = (d: string, nextView: View = "today") => {
    setDay(d);
    setView(nextView);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        setView(views[Number(e.key) - 1][0]);
      }
      if (e.key === "Escape") {
        setEditing(null);
        setConflicts(false);
        setMobileMenu(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (printOptions) {
      const id = setTimeout(() => window.print(), 120);
      return () => clearTimeout(id);
    }
  }, [printOptions]);
  const signOut = async () => {
    await planner.flush();
    const all = await planner.store.all();
    if (owner !== "local-device" && all.some((r) => r.pending || r.conflict)) {
      setMessage(t("pendingSignOut"));
      return;
    }
    if (owner !== "local-device" && supabase) {
      const { error: authError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (authError) {
        setMessage(authError.message);
        return;
      }
      await planner.store.clear();
    }
    onExit();
  };
  const nav = (
    <>
      {views.map(([key, Icon]) => (
        <button
          key={key}
          className={`nav-item ${view === key ? "active" : ""}`}
          onClick={() => {
            setView(key);
            setMobileMenu(false);
          }}
        >
          <Icon size={21} />
          <span>{t(key)}</span>
        </button>
      ))}
    </>
  );
  const count = dayRecords.filter((r) => r.kind === "task");
  const completed = count.filter(
    (r) => r.kind === "task" && r.payload.completed,
  ).length;
  return (
    <>
      <UpdateNotice t={t} />
      <div className="app-shell">
        <aside className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
          <div className="brand">
            <Sun size={27} />
            {t("app")}
          </div>
          <p className="sidebar-tagline">{t("tagline")}</p>
          <nav aria-label={lang === "zh" ? "主导航" : "Main navigation"}>
            {nav}
          </nav>
          <div className="sidebar-calendar">
            <MiniCalendar
              day={day}
              lang={lang}
              records={active}
              onSelect={(d) => goDay(d)}
            />
          </div>
          <div className="sidebar-footer">
            <p>{t("shortcut")}</p>
            <button className="quiet" onClick={() => void signOut()}>
              <LogOut size={17} />
              {t(owner === "local-device" ? "signIn" : "signOut")}
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              aria-label="Menu"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              PERSONAL SPACE <span>/</span> {t(view)}
            </span>
            <div className="topbar-actions">
              <button
                className={`sync-status ${status}`}
                aria-live="polite"
                onClick={() =>
                  status === "conflict"
                    ? setConflicts(true)
                    : void planner.sync()
                }
              >
                {status === "offline" || status === "local" ? (
                  <CloudOff size={15} />
                ) : (
                  <Cloud size={15} />
                )}
                <span>{t(status)}</span>
              </button>
              {languageButton}
              <button
                className="icon-button"
                aria-label={t(theme === "light" ? "dark" : "light")}
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>
          </header>
          <main id="main">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en", {
                    weekday: "long",
                  }).format(parseDay(day))}{" "}
                  · {localDay() === day ? t("backToday") : t(view)}
                </div>
                <h1>
                  {new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }).format(parseDay(day))}
                  <span className="heading-dot">.</span>
                </h1>
                <p>{view === "notes" ? t("noteHint") : t("tagline")}</p>
              </div>
              <div className="date-controls">
                <button
                  className="icon-button"
                  aria-label={t("previous")}
                  onClick={() => setDay(addDays(day, -1))}
                >
                  <ChevronLeft size={20} />
                </button>
                <label className="sr-only" htmlFor="selected-day">
                  {t("date")}
                </label>
                <input
                  id="selected-day"
                  type="date"
                  value={day}
                  onChange={(e) => e.target.value && setDay(e.target.value)}
                />
                <button
                  className="icon-button"
                  aria-label={t("next")}
                  onClick={() => setDay(addDays(day, 1))}
                >
                  <ChevronRight size={20} />
                </button>
                <button className="quiet" onClick={() => setDay(localDay())}>
                  {t("backToday")}
                </button>
              </div>
            </div>
            {(view === "today" || view === "notes") && (
              <EntryLegend day={day} lang={lang} settings={settings} t={t} />
            )}
            {owner === "local-device" && (
              <div className="local-banner">
                <CloudOff size={17} />
                <span>{t("demoHint")}</span>
              </div>
            )}
            {error && (
              <p className="error-banner" role="alert">
                {t("saveError")}
              </p>
            )}
            {message && (
              <div className="notice" role="status">
                {message}
                <button
                  className="icon-button"
                  onClick={() => setMessage("")}
                  aria-label={t("cancel")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {records.some((r) => r.conflict) && (
              <button
                className="conflict-banner"
                onClick={() => setConflicts(true)}
              >
                {t("review")} ({records.filter((r) => r.conflict).length}) →
              </button>
            )}
            {!loaded ? (
              <p>{t("loading")}</p>
            ) : (
              <>
                {view === "today" && (
                  <>
                    <div className="summary-strip">
                      <span>
                        <b>
                          {completed} / {count.length}
                        </b>{" "}
                        {t("tasksCompleted")}
                      </span>
                      <span>
                        <b>
                          {dayRecords.reduce(
                            (n, r) =>
                              n +
                              (r.kind === "task" &&
                              r.payload.category === "study"
                                ? r.payload.actualMinutes
                                : 0),
                            0,
                          )}
                        </b>{" "}
                        {t("actual")}
                      </span>
                      <button
                        className="quiet"
                        onClick={() => setView("notes")}
                      >
                        <Feather size={16} />
                        {t("notes")} →
                      </button>
                    </div>
                    <div className="planner-layout">
                      <div className="module-grid">
                        {[
                          ...new Set([...settings.moduleOrder, ...categories]),
                        ].map((category) => (
                          <section
                            className={`card module ${category}`}
                            key={category}
                          >
                            <div className="section-heading">
                              <button
                                className="section-title"
                                onClick={() =>
                                  saveSettings({
                                    ...settings,
                                    collapsed: settings.collapsed.includes(
                                      category,
                                    )
                                      ? settings.collapsed.filter(
                                          (c) => c !== category,
                                        )
                                      : [...settings.collapsed, category],
                                  })
                                }
                              >
                                <span className="module-marker" />
                                <h2>{t(category)}</h2>
                                <ChevronDown
                                  size={16}
                                  className={
                                    settings.collapsed.includes(category)
                                      ? "rotated"
                                      : ""
                                  }
                                />
                              </button>
                              <button
                                className="icon-button add-button"
                                aria-label={`${t("add")} ${t(category)}`}
                                onClick={() => setEditing(category)}
                              >
                                <Plus size={18} />
                              </button>
                            </div>
                            {!settings.collapsed.includes(category) && (
                              <>
                                {category === "meal" && (
                                  <p className="module-hint">
                                    {t("mealsHint")}
                                  </p>
                                )}
                                {category === "todo" && (
                                  <p className="module-hint">
                                    {t("reminderHint")}
                                  </p>
                                )}
                                <TaskList
                                  records={dayRecords.filter(
                                    (r) =>
                                      r.kind === "task" &&
                                      r.payload.category === category,
                                  )}
                                  t={t}
                                  edit={edit}
                                  onEdit={setEditing}
                                />
                              </>
                            )}
                          </section>
                        ))}
                      </div>
                      <div className="right-rail">
                        <HabitPanel
                          day={day}
                          records={dayRecords}
                          t={t}
                          settings={settings}
                          edit={edit}
                        />
                        <section className="card note-teaser">
                          <Feather size={25} />
                          <h2>{t("notes")}</h2>
                          <p>
                            {dayRecords.find((r) => r.kind === "note")?.kind ===
                            "note"
                              ? t("reflection")
                              : t("noteHint")}
                          </p>
                          <button
                            className="secondary full"
                            onClick={() => setView("notes")}
                          >
                            {t("notes")} →
                          </button>
                        </section>
                        <Carry
                          records={active}
                          day={day}
                          t={t}
                          edit={edit}
                          onEdit={setEditing}
                        />
                      </div>
                    </div>
                  </>
                )}
                {view === "notes" && (
                  <Notes
                    key={day}
                    day={day}
                    record={dayRecords.find((r) => r.kind === "note")}
                    t={t}
                    settings={settings}
                    edit={edit}
                  />
                )}
                {view === "calendar" && (
                  <CalendarView
                    day={day}
                    lang={lang}
                    records={active}
                    t={t}
                    onDay={goDay}
                    setDay={setDay}
                  />
                )}
                {view === "weekly" && (
                  <Dashboard
                    day={day}
                    records={active}
                    t={t}
                    settings={settings}
                    lang={lang}
                    setDay={setDay}
                  />
                )}
                {view === "settings" && (
                  <SettingsPanel
                    t={t}
                    lang={lang}
                    settings={settings}
                    saveSettings={saveSettings}
                    planner={planner}
                    onPrint={setPrintOptions}
                    message={setMessage}
                    owner={owner}
                  />
                )}
              </>
            )}
          </main>
          <footer className="workspace-footer">
            <span>DAYLIGHT</span>
            <span>{t("tagline")}</span>
            <button
              className="quiet"
              onClick={() => {
                setView("settings");
                document.getElementById("main")?.scrollIntoView();
              }}
            >
              <Printer size={15} />
              {t("print")}
            </button>
          </footer>
        </div>
        <nav
          className="bottom-nav"
          aria-label={lang === "zh" ? "移动导航" : "Mobile navigation"}
        >
          {nav}
        </nav>
      </div>
      {editing && (
        <TaskDialog
          key={typeof editing === "string" ? `${day}-${editing}` : editing.id}
          initial={typeof editing === "string" ? undefined : editing}
          category={
            typeof editing === "string"
              ? editing
              : editing.kind === "task"
                ? editing.payload.category
                : "todo"
          }
          day={day}
          t={t}
          priorityCount={
            dayRecords.filter(
              (r) => r.kind === "task" && r.payload.category === "priority",
            ).length
          }
          onSave={(r) => {
            edit(r);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {conflicts && (
        <ConflictDialog
          records={records.filter((r) => r.conflict)}
          t={t}
          onResolve={planner.resolve}
          onClose={() => setConflicts(false)}
        />
      )}
      {printOptions && (
        <PrintPages
          day={day}
          records={active}
          lang={lang}
          options={printOptions}
        />
      )}
    </>
  );
}
function MiniCalendar({
  day,
  lang,
  records,
  onSelect,
}: {
  day: string;
  lang: Lang;
  records: LocalRecord[];
  onSelect: (d: string) => void;
}) {
  const first = day.slice(0, 8) + "01";
  const offset = (parseDay(first).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
  return (
    <div className="mini-calendar">
      <div className="mini-heading">
        <button
          className="icon-button"
          aria-label={tr(lang, "previous")}
          onClick={() => onSelect(addDays(first, -1))}
        >
          <ChevronLeft size={16} />
        </button>
        <b>
          {new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en", {
            month: "short",
            year: "numeric",
          }).format(parseDay(day))}
        </b>
        <button
          className="icon-button"
          aria-label={tr(lang, "next")}
          onClick={() => onSelect(addDays(first, 32).slice(0, 8) + "01")}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="mini-grid">
        {(lang === "zh"
          ? ["一", "二", "三", "四", "五", "六", "日"]
          : ["M", "T", "W", "T", "F", "S", "S"]
        ).map((s, i) => (
          <small key={i}>{s}</small>
        ))}
        {days.map((d) => (
          <button
            key={d}
            aria-label={d}
            aria-current={d === day ? "date" : undefined}
            className={`${d === day ? "selected" : ""} ${d.slice(0, 7) !== day.slice(0, 7) ? "muted" : ""} ${records.some((r) => r.day === d) ? "has-data" : ""}`}
            onClick={() => onSelect(d)}
          >
            {Number(d.slice(8))}
          </button>
        ))}
      </div>
    </div>
  );
}
function TaskList({
  records,
  t,
  edit,
  onEdit,
}: {
  records: LocalRecord[];
  t: T;
  edit: (r: RecordValue) => void;
  onEdit: (r: LocalRecord) => void;
}) {
  const sorted = records
    .filter((r) => r.kind === "task")
    .sort((a, b) => a.payload.order - b.payload.order);
  const move = (record: (typeof sorted)[number], index: number) => {
    const target = sorted[index];
    if (!target || target.id === record.id) return;
    const reordered = sorted.filter((r) => r.id !== record.id);
    reordered.splice(index, 0, record);
    reordered.forEach((r, i) => {
      if (r.payload.order !== i)
        edit({
          ...valueOf(r),
          kind: "task",
          payload: { ...r.payload, order: i },
        });
    });
  };
  return sorted.length ? (
    <ul className="task-list">
      {sorted.map((r, index) => (
        <li
          key={r.id}
          className={r.payload.completed ? "completed" : ""}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", r.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const source = sorted.find(
              (item) => item.id === e.dataTransfer.getData("text/plain"),
            );
            if (source) move(source, index);
          }}
        >
          <button
            className="check-button"
            aria-label={`${t("done")}: ${r.payload.title}`}
            aria-pressed={r.payload.completed}
            onClick={() =>
              edit({
                ...valueOf(r),
                kind: "task",
                payload: { ...r.payload, completed: !r.payload.completed },
              })
            }
          >
            {r.payload.completed && <Check size={14} />}
          </button>
          <button
            className="task-content"
            style={entryStyle(r.payload)}
            onClick={() => onEdit(r)}
          >
            <strong>{r.payload.title}</strong>
            {r.payload.notes && (
              <p className="task-description">{r.payload.notes}</p>
            )}
            <span>
              {r.payload.start &&
                `${r.payload.start}${r.payload.end ? " – " + r.payload.end : ""}`}
              {r.payload.actualMinutes > 0 &&
                ` · ${r.payload.actualMinutes} ${t("minutes")}`}
              {r.payload.category === "exercise" &&
                r.payload.minutes > 0 &&
                ` · ${r.payload.minutes} ${t("minutes")}`}
              {r.payload.location && ` · ${r.payload.location}`}
              {r.payload.dueDate && ` · ${t("due")}: ${r.payload.dueDate}`}
              {r.payload.priority === "high" && ` · ${t("high")}`}
              {r.payload.category === "meal" &&
                r.payload.protein !== "none" &&
                ` · ${t(r.payload.protein)}`}
              {r.conflict && ` · ${t("conflict")}`}
            </span>
          </button>
          {r.payload.classification === "previousDay" && (
            <button
              className="icon-button"
              aria-label={`${t("strikethrough")}: ${r.payload.title}`}
              aria-pressed={r.payload.strikethrough}
              onClick={() =>
                edit({
                  ...valueOf(r),
                  kind: "task",
                  payload: {
                    ...r.payload,
                    strikethrough: !r.payload.strikethrough,
                  },
                })
              }
            >
              <span
                aria-hidden="true"
                style={{ textDecoration: "line-through" }}
              >
                S
              </span>
            </button>
          )}
          <div className="reorder">
            <GripVertical size={13} />
            <button
              aria-label={`${t("up")}: ${r.payload.title}`}
              disabled={index === 0}
              onClick={() => move(r, index - 1)}
            >
              ↑
            </button>
            <button
              aria-label={`${t("down")}: ${r.payload.title}`}
              disabled={index === sorted.length - 1}
              onClick={() => move(r, index + 1)}
            >
              ↓
            </button>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p className="empty-state">{t("empty")}</p>
  );
}
function TaskDialog({
  initial,
  category,
  day,
  t,
  onSave,
  onClose,
  priorityCount,
}: {
  initial?: LocalRecord;
  category: Task["category"];
  day: string;
  t: T;
  onSave: (r: RecordValue) => void;
  onClose: () => void;
  priorityCount: number;
}) {
  const [task, setTask] = useState<Task>(
    initial?.kind === "task"
      ? taskSchema.parse(initial.payload)
      : {
          ...taskSchema.parse({ title: "New", category, order: Date.now() }),
          title: "",
        },
  );
  const [taskDay, setTaskDay] = useState(initial?.day ?? day);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const patch = (part: Partial<Task>) =>
    setTask((prev) => ({ ...prev, ...part }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = taskSchema.safeParse(task);
    if (!result.success) {
      setError(result.error.issues.map((i) => i.message).join(", "));
      return;
    }
    if (!initial && category === "priority" && priorityCount >= 3) {
      setError(t("priority") + ": 1–3");
      return;
    }
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      kind: "task",
      day: taskDay,
      deleted: false,
      payload: result.data,
    });
  };
  return (
    <Modal
      title={`${t(initial ? "edit" : "add")} · ${t(category)}`}
      t={t}
      onClose={onClose}
    >
      <form onSubmit={submit} className="task-form">
        <EntryControls
          t={t}
          classification={task.classification}
          strikethrough={task.strikethrough}
          onChange={patch}
        />
        <small>{t("strikeHint")}</small>
        <label>
          {t("title")}
          <input
            ref={input}
            style={entryStyle(task)}
            value={task.title}
            required
            maxLength={500}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <label>
          {t("date")}
          <input
            type="date"
            required
            value={taskDay}
            onChange={(e) => setTaskDay(e.target.value)}
          />
        </label>
        {category === "study" && (
          <label>
            {t("location")}
            <input
              value={task.location}
              onChange={(e) => patch({ location: e.target.value })}
            />
          </label>
        )}
        <div className="form-columns">
          <label>
            {t("start")}
            <input
              type="time"
              value={task.start}
              onChange={(e) => {
                patch({
                  start: e.target.value,
                  minutes: plannedMinutes(e.target.value, task.end),
                });
              }}
            />
          </label>
          <label>
            {t("end")}
            <input
              type="time"
              value={task.end}
              onChange={(e) =>
                patch({
                  end: e.target.value,
                  minutes: plannedMinutes(task.start, e.target.value),
                })
              }
            />
          </label>
        </div>
        <div className="form-columns">
          <label>
            {t(category === "exercise" ? "minutes" : "planned")}
            <input
              type="number"
              min={0}
              max={1440}
              value={task.minutes}
              onChange={(e) => patch({ minutes: Number(e.target.value) })}
            />
          </label>
          {category === "study" && (
            <label>
              {t("actual")}
              <input
                type="number"
                min={0}
                max={1440}
                value={task.actualMinutes}
                onChange={(e) =>
                  patch({ actualMinutes: Number(e.target.value) })
                }
              />
            </label>
          )}
        </div>
        {category === "meal" && (
          <label>
            {t("protein")}
            <select
              value={task.protein}
              onChange={(e) =>
                patch({ protein: e.target.value as Task["protein"] })
              }
            >
              {["none", "red", "white", "fish", "plant"].map((p) => (
                <option key={p} value={p}>
                  {t(p as TextKey)}
                </option>
              ))}
            </select>
          </label>
        )}
        {["exercise", "social", "leisure", "alternative"].includes(
          category,
        ) && (
          <label>
            {t("type")}
            <input
              list="activity-types"
              value={task.activityType}
              onChange={(e) => patch({ activityType: e.target.value })}
            />
            <datalist id="activity-types">
              {(category === "exercise"
                ? [
                    "HIIT",
                    "Cardio",
                    "Strength Training",
                    "Pilates",
                    "Other Activities",
                  ]
                : category === "social"
                  ? [
                      "In-person interaction",
                      "Online conversation",
                      "Language exchange",
                      "Group activities",
                      "Gaming with others",
                    ]
                  : category === "alternative"
                    ? [
                        "Video Editing",
                        "Cleaning / Organizing",
                        "English Practice",
                        "Exercise",
                        "Reading",
                        "Personal Projects",
                      ]
                    : ["Movies", "Gaming", "Videos", "Creating", "Reading"]
              ).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </datalist>
          </label>
        )}
        <div className="form-columns">
          <label>
            {t("due")}
            <input
              type="date"
              value={task.dueDate}
              onChange={(e) => patch({ dueDate: e.target.value })}
            />
          </label>
          <label>
            {t("importance")}
            <select
              value={task.priority}
              onChange={(e) =>
                patch({ priority: e.target.value as Task["priority"] })
              }
            >
              {["low", "normal", "high"].map((p) => (
                <option key={p} value={p}>
                  {t(p as TextKey)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {t("details")}
          <textarea
            aria-label={t("details")}
            rows={3}
            value={task.notes}
            style={entryStyle(task)}
            maxLength={20000}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={(e) => patch({ completed: e.target.checked })}
          />
          {t("done")}
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions">
          {initial && (
            <button
              type="button"
              className="danger quiet"
              onClick={() => {
                if (confirm(t("deleteConfirm")))
                  onSave({ ...valueOf(initial), deleted: true });
              }}
            >
              {t("delete")}
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="primary">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
function HabitPanel({
  day,
  records,
  t,
  settings,
  edit,
}: {
  day: string;
  records: LocalRecord[];
  t: T;
  settings: Settings;
  edit: (r: RecordValue) => void;
}) {
  const habits = [
    ...defaultHabits.map((key) => ({ key, title: t(key) })),
    ...settings.customHabits.map((title) => ({
      key: `custom:${title}`,
      title,
    })),
  ];
  return (
    <section id="daily-habits" className="card habit-panel">
      <span className="eyebrow">DAILY RITUALS</span>
      <h2>{t("habits")}</h2>
      <p className="module-hint">{t("habitHint")}</p>
      {habits.map(({ key, title }) => {
        const id = stableId(`habit:${day}:${key}`);
        const record = records.find((r) => r.id === id);
        const state = record?.kind === "habit" ? record.payload.state : "blank";
        return (
          <div className="habit-row" key={key}>
            <span>{title}</span>
            <select
              aria-label={title}
              value={state}
              onChange={(e) =>
                edit({
                  id,
                  kind: "habit",
                  day,
                  deleted: false,
                  payload: {
                    key,
                    title,
                    state: e.target.value as "done" | "skip" | "blank",
                  },
                })
              }
            >
              {["blank", "done", "skip"].map((s) => (
                <option key={s} value={s}>
                  {t(s as TextKey)}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </section>
  );
}
function Carry({
  records,
  day,
  t,
  edit,
  onEdit,
}: {
  records: LocalRecord[];
  day: string;
  t: T;
  edit: (r: RecordValue) => void;
  onEdit: (r: LocalRecord) => void;
}) {
  const tasks = records.filter(
    (r) =>
      r.kind === "task" &&
      !r.payload.completed &&
      r.day !== day &&
      r.day <= localDay() &&
      ["priority", "todo"].includes(r.payload.category),
  );
  if (!tasks.length) return null;
  return (
    <section className="card carry">
      <h2>{t("carry")}</h2>
      {tasks.map((r) => (
        <div key={r.id}>
          <button
            className="quiet"
            style={r.kind === "task" ? entryStyle(r.payload) : undefined}
            onClick={() => onEdit(r)}
          >
            {r.kind === "task" ? r.payload.title : ""}
          </button>
          <small>{r.day}</small>
          <button
            className="quiet"
            onClick={() => edit({ ...valueOf(r), day })}
          >
            {t("defer")} →
          </button>
        </div>
      ))}
    </section>
  );
}
function ParagraphInput({
  label,
  text,
  style,
  placeholder,
  maxLength,
  onChange,
}: {
  label: string;
  text: string;
  style: ReturnType<typeof entryStyle>;
  placeholder: string;
  maxLength: number;
  onChange: (s: string) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = input.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + 4}px`;
    }
  }, [text]);
  return (
    <textarea
      ref={input}
      aria-label={label}
      className="journal paragraph-input"
      rows={3}
      style={style}
      placeholder={placeholder}
      maxLength={Math.max(0, maxLength)}
      value={text}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
function Notes({
  day,
  record,
  t,
  settings,
  edit,
}: {
  day: string;
  record?: LocalRecord;
  t: T;
  settings: Settings;
  edit: (r: RecordValue) => void;
}) {
  const note: Note =
    record?.kind === "note"
      ? record.payload
      : { ...noteDefaults, bedtime: settings.bedtime };
  const patch = (part: Partial<Note>) =>
    edit({
      id: stableId(`note:${day}`),
      kind: "note",
      day,
      deleted: false,
      payload: { ...note, ...part },
    });
  return (
    <div className="notes-layout">
      <section className="card writing-card">
        <div className="section-heading">
          <h2>
            <Feather size={20} /> {t("notes")}
          </h2>
          <small>{note.text.length.toLocaleString()}</small>
        </div>
        <p className="subtle">{t("notesFormattingHint")}</p>
        {noteParagraphs(note).map((paragraph, index) => (
          <section
            className="note-paragraph"
            key={paragraph.id}
            aria-label={`${t("paragraph")} ${index + 1}`}
          >
            <EntryControls
              t={t}
              classification={paragraph.classification}
              strikethrough={paragraph.strikethrough}
              onChange={(formatting) =>
                patch(
                  withParagraphs(
                    note,
                    noteParagraphs(note).map((p) =>
                      p.id === paragraph.id ? { ...p, ...formatting } : p,
                    ),
                  ),
                )
              }
            />
            <ParagraphInput
              label={
                index === 0 ? t("notes") : `${t("paragraph")} ${index + 1}`
              }
              text={paragraph.text}
              style={entryStyle(paragraph)}
              placeholder={t("noteHint")}
              maxLength={200000 - (note.text.length - paragraph.text.length)}
              onChange={(text) =>
                patch(
                  withParagraphs(
                    note,
                    noteParagraphs(note).map((p) =>
                      p.id === paragraph.id ? { ...p, text } : p,
                    ),
                  ),
                )
              }
            />
          </section>
        ))}
        <button
          className="secondary"
          disabled={
            note.text.length > 199998 || noteParagraphs(note).length >= 10000
          }
          onClick={() =>
            patch(
              withParagraphs(note, [
                ...noteParagraphs(note),
                {
                  id: crypto.randomUUID(),
                  text: "",
                  classification: "unmarked",
                  strikethrough: false,
                },
              ]),
            )
          }
        >
          <Plus size={18} />
          {t("addParagraph")}
        </button>
      </section>
      <aside>
        <section className="card reflection">
          <h2>{t("reflection")}</h2>
          {(
            ["meaningful", "accomplished", "tomorrow", "complete"] as const
          ).map((key) => (
            <label key={key}>
              {t(key)}
              <textarea
                aria-label={t(key)}
                rows={3}
                maxLength={10000}
                value={note[key]}
                onChange={(e) => patch({ [key]: e.target.value })}
              />
            </label>
          ))}
        </section>
        <section className="card wind-down">
          <Moon size={24} />
          <h2>{t("endDay")}</h2>
          <p>{t("windDown")}</p>
          <label>
            {t("bedtime")}
            <input
              type="time"
              value={note.bedtime}
              onChange={(e) => patch({ bedtime: e.target.value })}
            />
          </label>
          <button
            className={note.ended ? "secondary full" : "primary full"}
            onClick={() => patch({ ended: !note.ended })}
          >
            {note.ended ? (
              <>
                <Check size={17} />
                {t("dayEnded")}
              </>
            ) : (
              t("endDay")
            )}
          </button>
        </section>
      </aside>
    </div>
  );
}
function CalendarView({
  day,
  lang,
  records,
  t,
  onDay,
  setDay,
}: {
  day: string;
  lang: Lang;
  records: LocalRecord[];
  t: T;
  onDay: (d: string, v?: View) => void;
  setDay: (d: string) => void;
}) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [query, setQuery] = useState("");
  const first = day.slice(0, 8) + "01";
  const offset = (parseDay(first).getDay() + 6) % 7;
  const days =
    mode === "week"
      ? weekDays(day)
      : Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
  const results = query.trim()
    ? records
        .filter(
          (r) =>
            r.kind !== "settings" &&
            JSON.stringify(r.payload)
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
        )
        .sort((a, b) => b.day.localeCompare(a.day))
    : [];
  return (
    <section className="card calendar-card">
      <div className="section-heading">
        <div className="segmented">
          {(["month", "week"] as const).map((m) => (
            <button
              key={m}
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {t(m)}
            </button>
          ))}
        </div>
        <div>
          <button
            className="icon-button"
            aria-label={t("previous")}
            onClick={() =>
              setDay(
                addDays(
                  mode === "week" ? day : first,
                  mode === "week" ? -7 : -1,
                ),
              )
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={t("next")}
            onClick={() =>
              setDay(
                addDays(
                  mode === "week" ? day : first,
                  mode === "week" ? 7 : 32,
                ),
              )
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <label className="search-input">
        <Search size={18} />
        <input
          type="search"
          placeholder={t("search")}
          aria-label={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {query.trim() ? (
        <div className="search-results">
          {results.length ? (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() =>
                  onDay(r.day, r.kind === "note" ? "notes" : "today")
                }
              >
                <small>{r.day}</small>
                <span
                  style={r.kind === "task" ? entryStyle(r.payload) : undefined}
                >
                  {r.kind === "task"
                    ? r.payload.title
                    : r.kind === "note"
                      ? noteParagraphs(r.payload)
                          .slice(0, 3)
                          .map((p) => (
                            <span key={p.id} style={entryStyle(p)}>
                              {p.text.slice(0, 150)}{" "}
                            </span>
                          ))
                      : r.kind === "habit"
                        ? r.payload.title
                        : ""}
                </span>
              </button>
            ))
          ) : (
            <p>{t("noData")}</p>
          )}
        </div>
      ) : (
        <div className={`calendar-grid ${mode}`}>
          {(lang === "zh"
            ? ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          ).map((s) => (
            <b key={s}>{s}</b>
          ))}
          {days.map((d) => {
            const entries = records.filter((r) => r.day === d);
            const tasks = entries.filter((r) => r.kind === "task");
            return (
              <button
                className={`${d === day ? "selected" : ""} ${d.slice(0, 7) !== day.slice(0, 7) ? "muted" : ""}`}
                key={d}
                onClick={() => onDay(d)}
              >
                <strong>{Number(d.slice(8))}</strong>
                {tasks.length > 0 && (
                  <span className="calendar-count">
                    {
                      tasks.filter(
                        (r) => r.kind === "task" && r.payload.completed,
                      ).length
                    }
                    /{tasks.length} <Check size={11} />
                  </span>
                )}
                {entries.some((r) => r.kind === "note") && (
                  <Feather size={14} />
                )}
                <div className="calendar-task-titles">
                  {tasks.slice(0, 3).map((r) => (
                    <span
                      key={r.id}
                      style={
                        r.kind === "task" ? entryStyle(r.payload) : undefined
                      }
                    >
                      {r.kind === "task" ? r.payload.title : ""}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
function Dashboard({
  day,
  records,
  t,
  settings,
  lang,
  setDay,
}: {
  day: string;
  records: LocalRecord[];
  t: T;
  settings: Settings;
  lang: Lang;
  setDay: (d: string) => void;
}) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const days =
    mode === "week"
      ? weekDays(day)
      : Array.from(
          {
            length: new Date(
              parseDay(day).getFullYear(),
              parseDay(day).getMonth() + 1,
              0,
            ).getDate(),
          },
          (_, i) => `${day.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`,
        );
  const relevant = records.filter(
    (r) => days.includes(r.day) && r.kind !== "settings",
  );
  const tasks = relevant.filter((r) => r.kind === "task");
  const exercise = tasks.filter((r) => r.payload.category === "exercise");
  const habits = relevant.filter((r) => r.kind === "habit");
  const metrics: [TextKey, number][] = [
    [
      "studyHours",
      Math.round(
        tasks.reduce(
          (n, r) =>
            n + (r.payload.category === "study" ? r.payload.actualMinutes : 0),
          0,
        ) / 6,
      ) / 10,
    ],
    [
      "mainDone",
      tasks.filter(
        (r) => r.payload.category === "priority" && r.payload.completed,
      ).length,
    ],
    ["exerciseMins", exercise.reduce((n, r) => n + r.payload.minutes, 0)],
    [
      "exerciseDays",
      new Set(exercise.filter((r) => r.payload.minutes > 0).map((r) => r.day))
        .size,
    ],
    [
      "alcoholDays",
      habits.filter(
        (r) => r.payload.key === "alcohol" && r.payload.state === "done",
      ).length,
    ],
    [
      "socialDays",
      new Set(
        tasks.filter((r) => r.payload.category === "social").map((r) => r.day),
      ).size,
    ],
    ["habitCount", habits.filter((r) => r.payload.state === "done").length],
    [
      "routineDays",
      relevant.filter((r) => r.kind === "note" && r.payload.ended).length,
    ],
  ];
  const max = Math.max(
    60,
    ...days.map((d) =>
      tasks
        .filter((r) => r.day === d && r.payload.category === "study")
        .reduce((n, r) => n + r.payload.actualMinutes, 0),
    ),
  );
  return (
    <>
      <div className="dashboard-controls">
        <div className="segmented">
          {(["week", "month"] as const).map((m) => (
            <button
              className={mode === m ? "active" : ""}
              key={m}
              onClick={() => setMode(m)}
            >
              {t(m)}
            </button>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label={t("previous")}
          onClick={() =>
            setDay(
              addDays(
                mode === "week" ? day : day.slice(0, 8) + "01",
                mode === "week" ? -7 : -1,
              ),
            )
          }
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {days[0]} – {days.at(-1)}
        </span>
        <button
          className="icon-button"
          aria-label={t("next")}
          onClick={() =>
            setDay(
              addDays(
                mode === "week" ? day : day.slice(0, 8) + "01",
                mode === "week" ? 7 : 32,
              ),
            )
          }
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <p className="subtle">{t("overviewHint")}</p>
      <div className="metrics">
        {metrics.map(([key, value]) => (
          <section className="card metric" key={key}>
            <span>{t(key)}</span>
            <strong>{relevant.length ? value : "—"}</strong>
          </section>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <h2>{t("studyHours")}</h2>
          <div className="bar-chart" role="img" aria-label={t("studyHours")}>
            {days.map((d) => {
              const data = tasks.filter(
                (r) => r.day === d && r.payload.category === "study",
              );
              const minutes = data.reduce(
                (n, r) => n + r.payload.actualMinutes,
                0,
              );
              return (
                <div
                  className="bar-column"
                  key={d}
                  title={`${d}: ${data.length ? minutes + " " + t("minutes") : t("noData")}`}
                >
                  <span>{data.length ? minutes : "—"}</span>
                  <div className="bar-track">
                    <i
                      style={{
                        height: `${data.length ? Math.max(2, (minutes / max) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <small>
                    {mode === "week"
                      ? new Intl.DateTimeFormat(
                          lang === "zh" ? "zh-CN" : "en",
                          { weekday: "short" },
                        ).format(parseDay(d))
                      : Number(d.slice(8))}
                  </small>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card">
          <h2>{t("exercise")}</h2>
          <strong className="large-number">
            {exercise.reduce((n, r) => n + r.payload.minutes, 0)}{" "}
            <small>{t("minutes")}</small>
          </strong>
          {mode === "week" && (
            <>
              <p>
                {t("goal")}: {settings.exerciseGoal}
              </p>
              <progress
                max={Math.max(1, settings.exerciseGoal)}
                value={exercise.reduce((n, r) => n + r.payload.minutes, 0)}
              />
            </>
          )}
          <p className="subtle">
            {t("logged")}: {new Set(relevant.map((r) => r.day)).size} /{" "}
            {days.length}
          </p>
        </section>
        <section className="card">
          <h2>{t("meal")}</h2>
          <p className="subtle">{t("mealsHint")}</p>
          {(["red", "white", "fish", "plant"] as const).map((protein) => (
            <div className="stat-row" key={protein}>
              <span>{t(protein)}</span>
              <b>
                {
                  tasks.filter(
                    (r) =>
                      r.payload.category === "meal" &&
                      r.payload.protein === protein,
                  ).length
                }
              </b>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
function SettingsPanel({
  t,
  lang,
  settings,
  saveSettings,
  planner,
  onPrint,
  message,
  owner,
}: {
  t: T;
  lang: Lang;
  settings: Settings;
  saveSettings: (s: Settings) => void;
  planner: ReturnType<typeof usePlanner>;
  onPrint: (o: PrintOptions) => void;
  message: (s: string) => void;
  owner: string;
}) {
  const [habit, setHabit] = useState("");
  const [scope, setScope] = useState<PrintOptions["scope"]>("daily");
  const [blank, setBlank] = useState(false);
  const [printMode, setPrintMode] = useState<"color" | "bw">("color");
  const [printLang, setPrintLang] = useState<Lang>(lang);
  const file = useRef<HTMLInputElement>(null);
  const download = async () => {
    try {
      await planner.flush();
      const json = exportBackup(await planner.store.all());
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `daylight-${localDay()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      message(String(err));
    }
  };
  const upload = async (selected: File) => {
    try {
      if (selected.size > 10 * 1024 * 1024) throw new Error("Maximum 10 MB");
      const backup = parseBackup(await selected.text());
      if (!confirm(`${backup.records.length} · ${t("restoreConfirm")}`)) return;
      await planner.flush();
      const result = await planner.store.importMissing(backup.records);
      await planner.reload();
      await planner.sync();
      message(
        lang === "zh"
          ? `新增 ${result.added}，相同 ${result.skipped}，不同版本跳过 ${result.different}。`
          : `Added ${result.added}; identical ${result.skipped}; different versions skipped ${result.different}.`,
      );
    } catch (err) {
      message(String(err));
    }
  };
  const moveModule = (index: number, delta: number) => {
    const list = [...new Set([...settings.moduleOrder, ...categories])];
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    saveSettings({ ...settings, moduleOrder: list });
  };
  return (
    <div className="settings-grid">
      <UpdateAbout t={t} />
      <TypographySettings
        settings={settings}
        saveSettings={saveSettings}
        t={t}
      />
      <section className="card">
        <h2>{t("account")}</h2>
        <p className="notice">
          {t(owner === "local-device" ? "local" : planner.status)}
        </p>
        {owner === "local-device" && !configured && <p>{t("configure")}</p>}
        <h3>{t("privacy")}</h3>
        <p>{t("privacyText")}</p>
        <p className="subtle">{t("reminderHint")}</p>
        <h3>{t("install")}</h3>
        <p>{t("installText")}</p>
        <button
          className="quiet danger"
          onClick={() =>
            void (async () => {
              await planner.flush();
              if (confirm(t("clearConfirm"))) {
                await planner.store.clear();
                await planner.reload();
                await planner.sync();
              }
            })()
          }
        >
          {t("clearLocal")}
        </button>
      </section>
      <section className="card">
        <h2>{t("modules")}</h2>
        {[...new Set([...settings.moduleOrder, ...categories])].map(
          (category, index) => (
            <div className="module-setting" key={category}>
              <span>{t(category)}</span>
              <button
                className="icon-button"
                aria-label={`${t("up")} ${t(category)}`}
                disabled={index === 0}
                onClick={() => moveModule(index, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={`${t("down")} ${t(category)}`}
                disabled={index === 7}
                onClick={() => moveModule(index, 1)}
              >
                <ArrowDown size={16} />
              </button>
            </div>
          ),
        )}
        <label>
          {t("goal")}
          <input
            type="number"
            min={0}
            max={3000}
            value={settings.exerciseGoal}
            onChange={(e) =>
              saveSettings({
                ...settings,
                exerciseGoal: Math.min(
                  3000,
                  Math.max(0, Number(e.target.value)),
                ),
              })
            }
          />
        </label>
        <label>
          {t("bedtime")}
          <input
            type="time"
            value={settings.bedtime}
            onChange={(e) =>
              e.target.value &&
              saveSettings({ ...settings, bedtime: e.target.value })
            }
          />
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const title = habit.trim();
            if (
              title &&
              !settings.customHabits.includes(title) &&
              settings.customHabits.length < 30
            ) {
              saveSettings({
                ...settings,
                customHabits: [...settings.customHabits, title],
              });
              setHabit("");
            }
          }}
        >
          <label>
            {t("customHabit")}
            <input
              maxLength={100}
              value={habit}
              data-update-draft={!!habit}
              onChange={(e) => setHabit(e.target.value)}
            />
          </label>
          <button className="secondary">{t("add")}</button>
        </form>
        {settings.customHabits.map((title) => (
          <div className="stat-row" key={title}>
            {title}
            <button
              className="quiet danger"
              onClick={() =>
                saveSettings({
                  ...settings,
                  customHabits: settings.customHabits.filter(
                    (s) => s !== title,
                  ),
                })
              }
            >
              {t("delete")}
            </button>
          </div>
        ))}
      </section>
      <section className="card">
        <h2>{t("backup")}</h2>
        <p>{t("backupHint")}</p>
        <div className="button-stack">
          <button className="primary" onClick={() => void download()}>
            {t("export")}
          </button>
          <button className="secondary" onClick={() => file.current?.click()}>
            {t("import")}
          </button>
          <input
            className="sr-only"
            ref={file}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>
      <section className="card">
        <h2>
          <Printer size={20} /> {t("print")}
        </h2>
        <p>{t("printHint")}</p>
        <label>
          {t("print")}
          <select
            aria-label={t("print")}
            value={scope}
            onChange={(e) => setScope(e.target.value as PrintOptions["scope"])}
          >
            {(["daily", "plannerOnly", "notesOnly", "wholeWeek"] as const).map(
              (key) => (
                <option key={key} value={key}>
                  {t(key)}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          {t("language")}
          <select
            aria-label={t("language")}
            value={printLang}
            onChange={(e) => setPrintLang(e.target.value as Lang)}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
        <label>
          {t("printMode")}
          <select
            aria-label={t("printMode")}
            value={printMode}
            onChange={(e) => setPrintMode(e.target.value as "color" | "bw")}
          >
            <option value="color">{t("colorPrint")}</option>
            <option value="bw">{t("bwPrint")}</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={blank}
            onChange={(e) => setBlank(e.target.checked)}
          />
          {t("blankPrint")}
        </label>
        <button
          className="primary"
          onClick={() =>
            onPrint({
              scope,
              blank,
              lang: printLang,
              mode: printMode,
              stamp: Date.now(),
            })
          }
        >
          <Printer size={17} />
          {t("print")}
        </button>
      </section>
    </div>
  );
}
function ConflictDialog({
  records,
  t,
  onResolve,
  onClose,
}: {
  records: LocalRecord[];
  t: T;
  onResolve: (
    id: string,
    choice: "local" | "remote" | "merge",
    text?: string | Note,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Note>>(() =>
    Object.fromEntries(
      records.flatMap((r) =>
        r.kind === "note" && r.conflict?.kind === "note"
          ? [[r.id, combinedNote(r.payload, r.conflict.payload)]]
          : [],
      ),
    ),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resolve = async (
    r: LocalRecord,
    choice: "local" | "remote" | "merge",
  ) => {
    setBusy(true);
    try {
      await onResolve(
        r.id,
        choice,
        choice === "merge" ? drafts[r.id] : undefined,
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={t("review")} t={t} onClose={onClose} wide>
      <p>{t("conflictHelp")}</p>
      {!records.length && <p>{t("saved")}</p>}
      {records.map((r) => (
        <section className="conflict-entry" key={r.id}>
          <h3>
            {r.day} ·{" "}
            {t(
              r.kind === "task"
                ? r.payload.category
                : r.kind === "habit"
                  ? "habits"
                  : r.kind === "settings"
                    ? "settings"
                    : "notes",
            )}
          </h3>
          <div className="conflict-versions">
            <div>
              <h4>
                {t("localVersion")}
                {r.deleted && ` · ${t("deleted")}`}
              </h4>
              <pre>
                {r.kind === "note"
                  ? JSON.stringify(r.payload, null, 2)
                  : JSON.stringify(r.payload, null, 2)}
              </pre>
              <button
                disabled={busy}
                className="secondary"
                onClick={() => void resolve(r, "local")}
              >
                {t("keepLocal")}
              </button>
            </div>
            <div>
              <h4>
                {t("remoteVersion")}
                {r.conflict?.deleted && ` · ${t("deleted")}`}
              </h4>
              <pre>{JSON.stringify(r.conflict?.payload, null, 2)}</pre>
              <button
                disabled={busy}
                className="secondary"
                onClick={() => void resolve(r, "remote")}
              >
                {t("keepRemote")}
              </button>
            </div>
          </div>
          {r.kind === "note" && r.conflict?.kind === "note" && (
            <div>
              <p>{t("mergeFormattingHint")}</p>
              {drafts[r.id]?.paragraphs.map((p, index) => (
                <section
                  className="note-paragraph"
                  key={p.id}
                  aria-label={`${t("merge")} · ${t("paragraph")} ${index + 1}`}
                >
                  <EntryControls
                    t={t}
                    classification={p.classification}
                    strikethrough={p.strikethrough}
                    onChange={(formatting) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [r.id]: withParagraphs(
                          prev[r.id],
                          prev[r.id].paragraphs.map((item) =>
                            item.id === p.id
                              ? { ...item, ...formatting }
                              : item,
                          ),
                        ),
                      }))
                    }
                  />
                  <ParagraphInput
                    label={`${t("merge")} · ${t("paragraph")} ${index + 1}`}
                    text={p.text}
                    style={entryStyle(p)}
                    placeholder={t("noteHint")}
                    maxLength={200000}
                    onChange={(text) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [r.id]: withParagraphs(
                          prev[r.id],
                          prev[r.id].paragraphs.map((item) =>
                            item.id === p.id ? { ...item, text } : item,
                          ),
                        ),
                      }))
                    }
                  />
                </section>
              ))}
              <button
                disabled={busy}
                className="primary"
                onClick={() => void resolve(r, "merge")}
              >
                {t("merge")}
              </button>
            </div>
          )}
        </section>
      ))}
      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
function Modal({
  title,
  t,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  t: T;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      className={`dialog ${wide ? "wide" : ""}`}
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label={t("cancel")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
