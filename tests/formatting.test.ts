import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  noteSchema,
  recordSchema,
  settingsSchema,
  taskSchema,
} from "../src/domain";
import {
  combinedNote,
  contrastRatio,
  entryStyle,
  normalizeHex,
  noteParagraphs,
  palette,
  withParagraphs,
} from "../src/entryFormatting";
import { tr } from "../src/i18n";

afterEach(() => vi.useRealTimers());
describe("manual entry formatting and safe legacy defaults", () => {
  it("defaults all task categories and legacy paragraphs to Unmarked, including after midnight", () => {
    vi.useFakeTimers();
    for (const now of [
      "2026-10-23T23:50:00Z",
      "2026-10-24T02:00:00Z",
      "2026-10-25T05:00:00Z",
    ]) {
      vi.setSystemTime(new Date(now));
      const task = taskSchema.parse({
        title: "Study 心血管",
        category: "study",
      });
      expect(task.classification).toBe("unmarked");
      expect(task.strikethrough).toBe(false);
      expect(
        noteParagraphs(noteSchema.parse({ text: "明日计划\n\n今天回顾" })).map(
          (p) => p.classification,
        ),
      ).toEqual(["unmarked", "unmarked"]);
    }
  });
  it("keeps explicit subjective labels across midnight, edits and planning-date changes", () => {
    vi.useFakeTimers();
    const payload = taskSchema.parse({
      title: "Study",
      category: "study",
      classification: "sameDay",
    });
    for (const day of ["2026-10-23", "2026-10-24", "2026-11-10"]) {
      vi.setSystemTime(new Date(`${day}T02:00:00Z`));
      const entry = recordSchema.parse({
        id: crypto.randomUUID(),
        kind: "task",
        day,
        payload: { ...payload, title: "Edited" },
      });
      expect(entry.payload).toMatchObject({ classification: "sameDay" });
    }
    // A previous-day label is equally valid at 02:00 or before the planning day.
    expect(
      taskSchema.parse({ ...payload, classification: "previousDay" })
        .classification,
    ).toBe("previousDay");
  });
  it("shows reversible strikethrough only for Previous Day and never mutates completion", () => {
    const task = taskSchema.parse({
      title: "Cancelled plan",
      category: "priority",
      classification: "previousDay",
      strikethrough: true,
    });
    expect(entryStyle(task)).toEqual({
      color: "var(--previous-day-color)",
      textDecoration: "line-through",
    });
    expect(task.completed).toBe(false);
    for (const classification of ["sameDay", "unmarked"] as const) {
      const reclassified = { ...task, classification };
      expect(entryStyle(reclassified).textDecoration).toBe("none");
      expect(reclassified.strikethrough).toBe(true);
      expect(
        entryStyle({ ...reclassified, classification: "previousDay" })
          .textDecoration,
      ).toBe("line-through");
    }
    expect(entryStyle({ ...task, strikethrough: false }).textDecoration).toBe(
      "none",
    );
    const completedTask = { ...task, completed: true };
    expect(entryStyle(completedTask)).toEqual(entryStyle(task));
  });
  it("stores independent paragraph labels, editable text and formatting without flattening", () => {
    const legacy = noteSchema.parse({
      text: "明天去图书馆。\n\n今天在家学习。\n\nNo label",
    });
    const paragraphs = noteParagraphs(legacy).map((p, i) => ({
      ...p,
      classification: (["previousDay", "sameDay", "unmarked"] as const)[i],
      strikethrough: i === 0,
    }));
    const saved = noteSchema.parse(withParagraphs(legacy, paragraphs));
    expect(saved.text).toBe(legacy.text);
    expect(noteParagraphs(saved)).toEqual(paragraphs);
    const changed = withParagraphs(
      saved,
      paragraphs.map((p, i) =>
        i === 0 ? { ...p, text: "Updated original plan" } : p,
      ),
    );
    expect(changed.paragraphs[0]).toMatchObject({
      classification: "previousDay",
      strikethrough: true,
    });
    expect(changed.paragraphs[1]).toEqual(paragraphs[1]);
    const merged = combinedNote(saved, changed);
    expect(merged.paragraphs).toHaveLength(6);
    expect(new Set(merged.paragraphs.map((p) => p.id)).size).toBe(6);
    expect(merged.paragraphs[3].strikethrough).toBe(true);
  });
});
it("rejects duplicate paragraph IDs and oversized combined notes while preserving legacy whitespace", () => {
  const paragraph = {
    id: crypto.randomUUID(),
    text: "正文",
    classification: "unmarked",
    strikethrough: false,
  };
  expect(
    noteSchema.safeParse({ paragraphs: [paragraph, paragraph] }).success,
  ).toBe(false);
  expect(
    noteSchema.safeParse({
      paragraphs: [
        { ...paragraph, text: "汉".repeat(200000) },
        { ...paragraph, id: crypto.randomUUID() },
      ],
    }).success,
  ).toBe(false);
  const legacy = noteSchema.parse({
    text: "  原文  \n\n\n\n下一段\n保留换行\n\n",
  });
  expect(withParagraphs(legacy, noteParagraphs(legacy)).text).toBe(legacy.text);
});
describe("preferences, palettes, contrast and localization", () => {
  it("has 20 curated presets and normalizes valid custom HEX without accepting invalid colors", () => {
    expect(palette).toHaveLength(20);
    for (const [, color] of palette) expect(normalizeHex(color)).toBe(color);
    expect(normalizeHex(" abc ")).toBe("#AABBCC");
    expect(normalizeHex("#123abc")).toBe("#123ABC");
    for (const invalid of ["", "#12", "red", "#GGGGGG", "url(x)", "#12345678"])
      expect(normalizeHex(invalid)).toBeNull();
  });
  it("validates scale and safe legacy settings without overriding custom colors for contrast", () => {
    expect(settingsSchema.parse({})).toMatchObject({
      fontScale: 1,
      previousDayColor: "#9672B8",
      sameDayColor: "#547FB7",
    });
    for (const fontScale of [0.8, 1, 1.17, 1.2, 1.6])
      expect(settingsSchema.parse({ fontScale }).fontScale).toBe(fontScale);
    expect(settingsSchema.safeParse({ fontScale: 1.61 }).success).toBe(false);
    expect(settingsSchema.safeParse({ previousDayColor: "bad" }).success).toBe(
      false,
    );
    expect(
      settingsSchema.parse({ previousDayColor: "#FFFFFF" }).previousDayColor,
    ).toBe("#FFFFFF");
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
    expect(contrastRatio("#FFFFFF", "#252E28")).toBeGreaterThan(4.5);
  });
  it("preserves Chinese concepts and computes reference dates through month and year boundaries", () => {
    expect(tr("zh", "previousDay")).toBe("前一天填写");
    expect(tr("zh", "sameDay")).toBe("当天填写");
    expect(tr("zh", "unmarked")).toBe("不标记");
    expect(tr("zh", "entryColors")).toBe("填写日期颜色");
    expect(tr("zh", "strikethrough")).toBe("删除线");
    expect(tr("en", "previousDay")).toBe("Previous Day");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
});
