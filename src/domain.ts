import { z } from "zod";
import { v5 as uuidv5 } from "uuid";

export type Lang = "en" | "zh";
export const categories = [
  "study",
  "priority",
  "alternative",
  "meal",
  "exercise",
  "social",
  "leisure",
  "todo",
] as const;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
export const validDay = (s: string) =>
  dayPattern.test(s) && localDay(parseDay(s)) === s;
const daySchema = z.string().refine(validDay, "Invalid date");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
// Subjective labels: only explicit user input assigns them. Never derive from dates.
export const entryClassification = z.enum([
  "unmarked",
  "previousDay",
  "sameDay",
]);
export type EntryClassification = z.infer<typeof entryClassification>;
const entryFormatting = {
  classification: entryClassification.default("unmarked"),
  strikethrough: z.boolean().default(false),
};
export const paragraphSchema = z.object({
  id: z.string().uuid(),
  text: z.string().max(200000),
  ...entryFormatting,
});
export type NoteParagraph = z.infer<typeof paragraphSchema>;
export const defaultEntryColors = {
  previousDayColor: "#9672B8",
  sameDayColor: "#547FB7",
};
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const taskSchema = z.object({
  ...entryFormatting,
  title: z.string().trim().min(1).max(500),
  category: z.enum(categories),
  notes: z.string().max(20000).default(""),
  completed: z.boolean().default(false),
  start: z.union([timeSchema, z.literal("")]).default(""),
  end: z.union([timeSchema, z.literal("")]).default(""),
  minutes: z.number().int().min(0).max(1440).default(0),
  actualMinutes: z.number().int().min(0).max(1440).default(0),
  location: z.string().max(500).default(""),
  protein: z.enum(["none", "red", "white", "fish", "plant"]).default("none"),
  dueDate: z.union([daySchema, z.literal("")]).default(""),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  activityType: z.string().max(200).default(""),
  order: z.number().finite().default(0),
});
export const noteSchema = z
  .object({
    paragraphs: z.array(paragraphSchema).max(10000).default([]),
    text: z.string().max(200000).default(""),
    meaningful: z.string().max(10000).default(""),
    accomplished: z.string().max(10000).default(""),
    tomorrow: z.string().max(10000).default(""),
    complete: z.string().max(10000).default(""),
    ended: z.boolean().default(false),
    bedtime: timeSchema.default("01:00"),
  })
  .superRefine((note, ctx) => {
    if (
      note.paragraphs.length &&
      note.paragraphs.reduce(
        (n, p) => n + p.text.length,
        (note.paragraphs.length - 1) * 2,
      ) > 200000
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Note exceeds 200000 characters",
      });
    if (
      new Set(note.paragraphs.map((p) => p.id)).size !== note.paragraphs.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate paragraph IDs",
      });
  });
export const habitSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().max(200),
  state: z.enum(["done", "skip", "blank"]),
});
export const settingsSchema = z.object({
  fontScale: z.number().min(0.8).max(1.6).default(1),
  previousDayColor: hexColorSchema.default(defaultEntryColors.previousDayColor),
  sameDayColor: hexColorSchema.default(defaultEntryColors.sameDayColor),
  exerciseGoal: z.number().int().min(0).max(3000).default(150),
  bedtime: timeSchema.default("01:00"),
  moduleOrder: z
    .array(z.enum(categories))
    .max(8)
    .default([...categories]),
  collapsed: z.array(z.enum(categories)).max(8).default([]),
  customHabits: z.array(z.string().min(1).max(100)).max(30).default([]),
});
const fields = {
  id: z.string().uuid(),
  day: daySchema,
  deleted: z.boolean().default(false),
};
export const recordSchema = z.discriminatedUnion("kind", [
  z.object({ ...fields, kind: z.literal("task"), payload: taskSchema }),
  z.object({ ...fields, kind: z.literal("note"), payload: noteSchema }),
  z.object({ ...fields, kind: z.literal("habit"), payload: habitSchema }),
  z.object({ ...fields, kind: z.literal("settings"), payload: settingsSchema }),
]);
export type Task = z.infer<typeof taskSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type RecordValue = z.infer<typeof recordSchema>;
export type RemoteRecord = RecordValue & {
  revision: number;
  created_at?: string | null;
  updated_at: string;
  last_mutation: string;
};
export type LocalRecord = RecordValue & {
  owner: string;
  /** Local-only save provenance; never used as an authentication boundary. */
  writer?: string;
  revision: number;
  mutation: string;
  pending: boolean;
  conflict?: RemoteRecord;
};
export const settingsDefaults = settingsSchema.parse({});
export const noteDefaults = noteSchema.parse({});
export const stableId = (key: string) =>
  uuidv5(key, "c26698bc-bbf9-4db2-99aa-eaf853cdca41");
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(day: string, amount: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + amount);
  return localDay(d);
}
export function weekDays(day: string): string[] {
  const d = parseDay(day);
  const monday = addDays(day, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function plannedMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return (mins(end) - mins(start) + 1440) % 1440;
}
export function valueOf(r: RecordValue): RecordValue {
  return recordSchema.parse(r);
}
export const sameValue = (a: RecordValue, b: RecordValue) =>
  JSON.stringify(valueOf(a)) === JSON.stringify(valueOf(b));
export const backupSchema = z
  .object({
    format: z.literal("daylight-backup"),
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    records: z.array(recordSchema).max(50000),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.records.map((r) => r.id)).size !== data.records.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate record IDs",
      });
  });
export function parseBackup(text: string) {
  if (new TextEncoder().encode(text).length > 10 * 1024 * 1024)
    throw new Error("Backup exceeds 10 MB");
  return backupSchema.parse(JSON.parse(text));
}
export function exportBackup(records: LocalRecord[]) {
  if (records.some((r) => r.conflict))
    throw new Error("Resolve conflicts before export");
  return JSON.stringify(
    {
      format: "daylight-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      records: records.filter((r) => !r.deleted).map(valueOf),
    },
    null,
    2,
  );
}
