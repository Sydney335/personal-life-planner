import {
  stableId,
  type EntryClassification,
  type Note,
  type NoteParagraph,
} from "./domain";

export const palette = [
  ["Lavender", "#9672B8"],
  ["Purple", "#70469C"],
  ["Blue", "#547FB7"],
  ["Deep blue", "#305F9C"],
  ["Teal", "#438B89"],
  ["Deep teal", "#276967"],
  ["Green", "#56845C"],
  ["Sage", "#82976E"],
  ["Pink", "#BB789C"],
  ["Rose", "#AB5F79"],
  ["Red", "#B85252"],
  ["Coral", "#C47969"],
  ["Orange", "#B8773E"],
  ["Terracotta", "#AF6850"],
  ["Brown", "#906B50"],
  ["Cocoa", "#785B51"],
  ["Gray", "#7D8187"],
  ["Slate", "#596D81"],
  ["Light lavender", "#BCA1DA"],
  ["Sky", "#8FB9E2"],
] as const;

export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (/^#?[\da-f]{6}$/i.test(trimmed))
    return `#${trimmed.replace("#", "").toUpperCase()}`;
  if (/^#?[\da-f]{3}$/i.test(trimmed))
    return `#${trimmed
      .replace("#", "")
      .split("")
      .map((c) => c + c)
      .join("")
      .toUpperCase()}`;
  return null;
}
export function contrastRatio(color: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(color),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function entryStyle(entry: {
  classification?: EntryClassification;
  strikethrough?: boolean;
}) {
  return {
    color:
      entry.classification === "previousDay"
        ? "var(--previous-day-color)"
        : entry.classification === "sameDay"
          ? "var(--same-day-color)"
          : "var(--ink)",
    textDecoration:
      entry.classification === "previousDay" && entry.strikethrough
        ? "line-through"
        : "none",
  };
}
/** Lazy legacy conversion: no date, clock, or timezone participates. */
export function noteParagraphs(note: Note): NoteParagraph[] {
  if (note.paragraphs?.length) return note.paragraphs;
  const parts = note.text.split(/\n\n/);
  // Extremely fragmented legacy notes keep all text within the paragraph limit.
  const blocks =
    parts.length > 10000
      ? [...parts.slice(0, 9999), parts.slice(9999).join("\n\n")]
      : parts;
  return blocks.map((text, i) => ({
    id: stableId(`legacy-paragraph:${i}:${text}`),
    text,
    classification: "unmarked",
    strikethrough: false,
  }));
}
export function withParagraphs(note: Note, paragraphs: NoteParagraph[]): Note {
  return {
    ...note,
    paragraphs,
    text: paragraphs.map((p) => p.text).join("\n\n"),
  };
}
/** Keep both versions, including formatting, until the user explicitly edits them. */
export function combinedNote(local: Note, remote: Note): Note {
  const left = noteParagraphs(local);
  const right = noteParagraphs(remote).map((p) => ({
    ...p,
    id: crypto.randomUUID(),
  }));
  return withParagraphs(local, [...left, ...right]);
}
