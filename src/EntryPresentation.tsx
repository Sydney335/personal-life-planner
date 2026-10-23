import { useId, useState } from "react";
import { Strikethrough } from "lucide-react";
import {
  addDays,
  defaultEntryColors,
  parseDay,
  type EntryClassification,
  type Lang,
  type Settings,
} from "./domain";
import { contrastRatio, normalizeHex, palette } from "./entryFormatting";
import type { TextKey } from "./i18n";
type T = (key: TextKey) => string;

export function EntryControls({
  classification = "unmarked",
  strikethrough = false,
  onChange,
  t,
}: {
  classification?: EntryClassification;
  strikethrough?: boolean;
  onChange: (value: {
    classification?: EntryClassification;
    strikethrough?: boolean;
  }) => void;
  t: T;
}) {
  const id = useId();
  return (
    <div className="entry-controls">
      <fieldset>
        <legend>{t("entryWritten")}</legend>
        <div className="entry-options">
          {(["previousDay", "sameDay", "unmarked"] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name={id}
                value={value}
                checked={classification === value}
                onChange={() => onChange({ classification: value })}
              />
              {t(value)}
            </label>
          ))}
        </div>
      </fieldset>
      {classification === "previousDay" && (
        <button
          type="button"
          className="secondary strike-toggle"
          aria-label={t("strikethrough")}
          aria-pressed={strikethrough}
          onClick={() => onChange({ strikethrough: !strikethrough })}
        >
          <Strikethrough size={18} />
          {t("strikethrough")}
        </button>
      )}
    </div>
  );
}

export function EntryLegend({
  day,
  lang,
  settings,
  t,
}: {
  day: string;
  lang: Lang;
  settings: Settings;
  t: T;
}) {
  const format = (date: string) =>
    new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(parseDay(date));
  return (
    <aside className="entry-legend" aria-label={t("entryColors")}>
      <div>
        {(["previousDay", "sameDay"] as const).map((category, i) => (
          <span
            key={category}
            className="legend-item"
            style={{ color: settings[`${category}Color`] }}
          >
            <i style={{ background: "currentColor" }} aria-hidden="true" />
            {t(category)} · {t("referenceDate")}:{" "}
            {format(i === 0 ? addDays(day, -1) : day)}
          </span>
        ))}
      </div>
      <small>{t("manualHint")}</small>
    </aside>
  );
}

function ColorSelector({
  category,
  value,
  onChange,
  t,
}: {
  category: "previousDay" | "sameDay";
  value: string;
  onChange: (color: string) => void;
  t: T;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && !normalizeHex(draft);
  const id = useId();
  return (
    <fieldset className="color-selector">
      <legend>{t(category)}</legend>
      <p>{t("colorPalette")}</p>
      <div
        className="color-palette"
        role="group"
        aria-label={`${t(category)} · ${t("colorPalette")}`}
      >
        {palette.map(([name, color]) => (
          <button
            key={color}
            type="button"
            className="color-swatch"
            title={`${name} ${color}`}
            aria-label={`${t(category)} ${color}`}
            aria-pressed={value.toUpperCase() === color.toUpperCase()}
            style={{ backgroundColor: color }}
            onClick={() => {
              setDraft(null);
              onChange(color);
            }}
          >
            {value.toUpperCase() === color.toUpperCase() && (
              <span aria-hidden="true">✓</span>
            )}
          </button>
        ))}
      </div>
      <div className="custom-color-row">
        <label>
          {t("customColor")}
          <input
            type="color"
            value={value}
            aria-label={`${t(category)} · ${t("customColor")}`}
            onChange={(e) => {
              setDraft(null);
              onChange(e.target.value.toUpperCase());
            }}
          />
        </label>
        <label>
          {t("hexColor")}
          <input
            value={draft ?? value}
            spellCheck={false}
            aria-invalid={!!invalid}
            aria-describedby={invalid ? id : undefined}
            aria-label={`${t(category)} · ${t("hexColor")}`}
            onChange={(e) => {
              setDraft(e.target.value);
              const hex = normalizeHex(e.target.value);
              if (hex) onChange(hex);
            }}
            onBlur={() => {
              if (draft !== null && normalizeHex(draft)) setDraft(null);
            }}
          />
        </label>
      </div>
      {invalid && (
        <p id={id} className="danger" role="alert">
          {t("invalidHex")}
        </p>
      )}
      <button
        type="button"
        className="quiet"
        onClick={() => {
          setDraft(null);
          onChange(defaultEntryColors[`${category}Color`]);
        }}
      >
        {t("resetDefault")}
      </button>
    </fieldset>
  );
}

export function TypographySettings({
  settings,
  saveSettings,
  t,
}: {
  settings: Settings;
  saveSettings: (s: Settings) => void;
  t: T;
}) {
  return (
    <>
      <section className="card typography-settings">
        <h2>{t("fontSize")}</h2>
        <div className="font-presets" role="group" aria-label={t("fontSize")}>
          {(
            [
              ["small", 0.8],
              ["medium", 1],
              ["large", 1.2],
              ["extraLarge", 1.6],
            ] as const
          ).map(([label, scale]) => (
            <button
              className="secondary"
              key={label}
              aria-pressed={settings.fontScale === scale}
              onClick={() => saveSettings({ ...settings, fontScale: scale })}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <label>
          {t("fontSize")} · {Math.round(settings.fontScale * 100)}%
          <input
            type="range"
            min="80"
            max="160"
            step="1"
            aria-label={t("fontSize")}
            value={Math.round(settings.fontScale * 100)}
            onChange={(e) =>
              saveSettings({
                ...settings,
                fontScale: Number(e.target.value) / 100,
              })
            }
          />
        </label>
        <div className="font-preview" aria-label={t("preview")}>
          <h3>{t("today")}</h3>
          <p>{t("fontPreview")}</p>
          <small>{t("noteHint")}</small>
        </div>
        <button
          className="quiet"
          onClick={() => saveSettings({ ...settings, fontScale: 1 })}
        >
          {t("resetDefault")}
        </button>
      </section>
      <section className="card entry-color-settings">
        <h2>{t("entryColors")}</h2>
        {(["previousDay", "sameDay"] as const).map((category) => (
          <ColorSelector
            key={category}
            category={category}
            value={settings[`${category}Color`]}
            t={t}
            onChange={(color) =>
              saveSettings({ ...settings, [`${category}Color`]: color })
            }
          />
        ))}
        <h3>{t("preview")}</h3>
        <div className="color-previews">
          {(["light", "dark"] as const).map((mode) => (
            <div key={mode} className={`color-preview ${mode}`}>
              <h4>{t(mode)}</h4>
              {(["previousDay", "sameDay"] as const).map((category) => {
                const color = settings[`${category}Color`];
                const ratio = contrastRatio(
                  color,
                  mode === "light" ? "#FFFFFF" : "#252E28",
                );
                return (
                  <div key={category}>
                    <p style={{ color }}>
                      {t(category)} · {t("fontPreview")}
                    </p>
                    {ratio < 4.5 && (
                      <small className="contrast-warning">
                        {t(category)}: {t("contrastWarning")} (
                        {ratio.toFixed(2)}:1)
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
