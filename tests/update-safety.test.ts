import { expect, it } from "vitest";
import { canUpdatePlanner, type PlannerSafety } from "../src/updateSafety";
import { taskSchema, type LocalRecord } from "../src/domain";
const clean = (): PlannerSafety => ({
  loaded: true,
  error: false,
  unsaved: 0,
  syncing: false,
  pendingWrites: 0,
  sequence: 1,
  status: "saved",
});
const record = (pending: boolean): LocalRecord => ({
  id: crypto.randomUUID(),
  owner: "account",
  kind: "task",
  day: "2026-10-23",
  deleted: false,
  payload: taskSchema.parse({ title: "Do not lose this", category: "study" }),
  mutation: crypto.randomUUID(),
  revision: 0,
  pending,
});
it("distinguishes durable local writes from cloud acknowledgements", async () => {
  const queued = [record(true)];
  const check = (automatic: boolean, owner: string) =>
    canUpdatePlanner(
      automatic,
      owner,
      clean,
      async () => {},
      async () => queued,
    );
  expect(await check(true, "account")).toBe(false);
  expect(await check(false, "account")).toBe(true);
  expect(await check(true, "local-device")).toBe(true);
  expect(queued[0].pending).toBe(true);
});
it("blocks uncommitted writes, loading, save errors, and cloud work even with no pending records", async () => {
  for (const patch of [
    { loaded: false },
    { error: true },
    { unsaved: 1 },
    { syncing: true },
    { pendingWrites: 1 },
    { status: "error" as const },
    { status: "offline" as const },
  ]) {
    const state = { ...clean(), ...patch };
    expect(
      await canUpdatePlanner(
        true,
        "account",
        () => state,
        async () => {},
        async () => [],
      ),
    ).toBe(false);
  }
});
it("rechecks the storage and editing sequence after async flush/read", async () => {
  for (const patch of [
    { sequence: 2 },
    { unsaved: 1 },
    { syncing: true },
    { pendingWrites: 1 },
    { error: true },
  ]) {
    const state = clean();
    expect(
      await canUpdatePlanner(
        false,
        "account",
        () => state,
        async () => {
          Object.assign(state, patch);
        },
        async () => [],
      ),
    ).toBe(false);
  }
});
it("never interrupts unresolved conflicts, even when explicitly requested", async () => {
  const local = record(true);
  local.conflict = {
    ...local,
    last_mutation: crypto.randomUUID(),
    updated_at: "",
    revision: 2,
  };
  for (const automatic of [false, true])
    expect(
      await canUpdatePlanner(
        automatic,
        "account",
        clean,
        async () => {},
        async () => [local],
      ),
    ).toBe(false);
});
it("allows automatic updates after a successful cloud sync without modifying records", async () => {
  const rows = [record(false)];
  const original = structuredClone(rows);
  expect(
    await canUpdatePlanner(
      true,
      "account",
      clean,
      async () => {},
      async () => rows,
    ),
  ).toBe(true);
  expect(rows).toEqual(original);
});
