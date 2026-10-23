import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/store";
import { SyncEngine, type SyncStatus } from "../src/sync";
import type { Cloud } from "../src/cloud";
import {
  addDays,
  exportBackup,
  parseBackup,
  plannedMinutes,
  stableId,
  taskSchema,
  valueOf,
  weekDays,
  type LocalRecord,
  type RecordValue,
  type RemoteRecord,
} from "../src/domain";
const id = stableId("test-note");
const note = (text: string): RecordValue => ({
  id,
  kind: "note",
  day: "2026-10-23",
  deleted: false,
  payload: {
    text,
    meaningful: "",
    accomplished: "",
    tomorrow: "",
    complete: "",
    ended: false,
    bedtime: "01:00",
  },
});
// Contract double, NOT a claim of live Supabase/device validation. SQL/RLS have separate tests.
class FakeCloud implements Cloud {
  records = new Map<string, RemoteRecord>();
  fail = false;
  lostResponse = false;
  async pull() {
    if (this.fail) throw new Error("network");
    return [...this.records.values()];
  }
  async push(r: LocalRecord) {
    if (this.fail) throw new Error("network");
    const current = this.records.get(r.id);
    if (current?.last_mutation === r.mutation)
      return { accepted: true, record: current };
    if (current && current.revision !== r.revision)
      return { accepted: false, record: current };
    const remote = {
      ...valueOf(r),
      revision: (current?.revision ?? 0) + 1,
      updated_at: new Date().toISOString(),
      last_mutation: r.mutation,
    } as RemoteRecord;
    this.records.set(r.id, remote);
    if (this.lostResponse) {
      this.lostResponse = false;
      throw new Error("response lost");
    }
    return { accepted: true, record: remote };
  }
}
let a: Store, b: Store, cloud: FakeCloud;
beforeEach(async () => {
  a = new Store("device-a");
  b = new Store("device-b");
  await a.clear();
  await b.clear();
  cloud = new FakeCloud();
});
const engine = (
  store: Store,
  status: (s: SyncStatus) => void = () => {},
  online = () => true,
) => new SyncEngine(store, cloud, status, () => {}, online);
describe("offline and concurrency contract", () => {
  it("adds, edits and deletes across two device stores", async () => {
    await a.edit(note("first"));
    await engine(a).sync();
    await engine(b).sync();
    expect((await b.get(id))?.payload).toMatchObject({ text: "first" });
    await b.edit(note("edited"));
    await engine(b).sync();
    await engine(a).sync();
    expect((await a.get(id))?.payload).toMatchObject({ text: "edited" });
    await a.edit({ ...note("edited"), deleted: true });
    await engine(a).sync();
    await engine(b).sync();
    expect((await b.get(id))?.deleted).toBe(true);
  });
  it("queues offline edits and synchronizes on reconnect", async () => {
    let online = false;
    const statuses: SyncStatus[] = [];
    const e = engine(
      a,
      (s) => statuses.push(s),
      () => online,
    );
    await a.edit(note("offline text"));
    await e.sync();
    expect(statuses.at(-1)).toBe("offline");
    expect(cloud.records.size).toBe(0);
    online = true;
    await e.sync();
    expect(statuses.at(-1)).toBe("saved");
    expect((await a.get(id))?.pending).toBe(false);
  });
  it("preserves both long notes on concurrent edits, including persisted reload", async () => {
    await a.edit(note("base"));
    await engine(a).sync();
    await engine(b).sync();
    const left = "A".repeat(50000),
      right = "中文".repeat(25000);
    await a.edit(note(left));
    await b.edit(note(right));
    await engine(a).sync();
    await engine(b).sync();
    const reloaded = await new Store("device-b").get(id);
    expect(reloaded?.payload).toMatchObject({ text: right });
    expect(reloaded?.conflict?.payload).toMatchObject({ text: left });
    await b.resolve(id, "merge", right + "\n" + left);
    await engine(b).sync();
    await engine(a).sync();
    expect((await a.get(id))?.payload).toMatchObject({
      text: right + "\n" + left,
    });
  });
  it("detects delete versus edit conflicts rather than resurrecting silently", async () => {
    await a.edit(note("base"));
    await engine(a).sync();
    await engine(b).sync();
    await a.edit({ ...note("base"), deleted: true });
    await b.edit(note("precious edit"));
    await engine(a).sync();
    await engine(b).sync();
    expect((await b.get(id))?.conflict?.deleted).toBe(true);
    expect((await b.get(id))?.payload).toMatchObject({ text: "precious edit" });
  });
  it("keeps an edit made while a save request is in flight", async () => {
    await a.edit(note("first"));
    const original = cloud.push.bind(cloud);
    cloud.push = async (r) => {
      await a.edit(note("newer"));
      cloud.push = original;
      return original(r);
    };
    await engine(a).sync();
    expect((await a.get(id))?.payload).toMatchObject({ text: "newer" });
    expect((await a.get(id))?.pending).toBe(true);
    await engine(a).sync();
    expect(cloud.records.get(id)?.payload).toMatchObject({ text: "newer" });
  });
  it("retries a lost acknowledgement without generating another revision", async () => {
    await a.edit(note("once"));
    cloud.lostResponse = true;
    await engine(a).sync();
    expect((await a.get(id))?.pending).toBe(true);
    await engine(a).sync();
    expect(cloud.records.get(id)?.revision).toBe(1);
    expect((await a.get(id))?.pending).toBe(false);
  });
  it("shows an error and keeps pending data on network failure", async () => {
    await a.edit(note("safe"));
    cloud.fail = true;
    let status: SyncStatus = "saved";
    await engine(a, (s) => (status = s)).sync();
    expect(status).toBe("error");
    expect((await a.get(id))?.pending).toBe(true);
  });
  it("partitions device data by account", async () => {
    await a.edit(note("private"));
    expect(await b.all()).toEqual([]);
  });
});
describe("backups and dates", () => {
  it("round trips Chinese and multiline notes, imports idempotently, never replaces existing data", async () => {
    await a.edit(note("中文\nLong notes"));
    const backup = parseBackup(exportBackup(await a.all()));
    expect(await b.importMissing(backup.records)).toEqual({
      added: 1,
      skipped: 0,
      different: 0,
    });
    expect(await b.importMissing(backup.records)).toEqual({
      added: 0,
      skipped: 1,
      different: 0,
    });
    await b.edit(note("newer"));
    expect((await b.importMissing(backup.records)).different).toBe(1);
    expect((await b.get(id))?.payload).toMatchObject({ text: "newer" });
  });
  it("refuses invalid, duplicate and unsupported backups", () => {
    expect(() => parseBackup("{}")).toThrow();
    const records = [note("a"), note("b")];
    expect(() =>
      parseBackup(
        JSON.stringify({
          format: "daylight-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          records,
        }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          format: "daylight-backup",
          version: 2,
          exportedAt: new Date().toISOString(),
          records: [],
        }),
      ),
    ).toThrow();
  });
  it("does not export only half of an unresolved conflict", async () => {
    await a.edit(note("a"));
    await engine(a).sync();
    await engine(b).sync();
    await a.edit(note("b"));
    await b.edit(note("c"));
    await engine(a).sync();
    await engine(b).sync();
    await expect((async () => exportBackup(await b.all()))()).rejects.toThrow(
      "Resolve conflicts",
    );
  });
  it("handles leap days, month boundaries, and DST with local calendar arithmetic", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
      expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
      expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
      expect(weekDays("2026-11-01")).toHaveLength(7);
      expect(weekDays("2026-11-01")[0]).toBe("2026-10-26");
      expect(plannedMinutes("23:30", "01:00")).toBe(90);
    } finally {
      process.env.TZ = previous;
    }
  });
  it("validates real dates and bounded durations", () => {
    expect(() =>
      taskSchema.parse({
        title: "x",
        category: "study",
        dueDate: "2026-02-30",
      }),
    ).toThrow();
    expect(() =>
      taskSchema.parse({ title: "x", category: "exercise", minutes: -1 }),
    ).toThrow();
  });
});
