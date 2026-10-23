import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { stableId } from "../src/domain";
const alice = stableId("alice"),
  bob = stableId("bob"),
  id = stableId("db-record");
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${alice}'),('${bob}');`,
  );
  await db.exec(await readFile("supabase/migrations/001_planner.sql", "utf8"));
});
afterAll(async () => db?.close());
async function asUser<T>(
  user: string,
  fn: (tx: Parameters<Parameters<PGlite["transaction"]>[0]>[0]) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    return fn(tx);
  });
}
const save = (
  actor: string,
  expected: number,
  text: string,
  mutation = crypto.randomUUID(),
  owner = actor,
) =>
  asUser(actor, async (tx) => {
    const res = await tx.query<{
      result: {
        accepted: boolean;
        record: {
          revision: number;
          payload: { text: string };
          user_id: string;
        };
      };
    }>(
      "select public.save_planner_record($1,$2,'note','2026-10-23',$3::jsonb,false,$4,$5) as result",
      [owner, id, JSON.stringify({ text }), expected, mutation],
    );
    return res.rows[0].result;
  });
describe("real PostgreSQL schema, compare-and-set, grants and RLS (PGlite)", () => {
  it("enables RLS on both private tables", async () => {
    const r = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('planner_records','planner_history')",
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows.every((row) => row.relrowsecurity)).toBe(true);
  });
  it("creates own record, rejects stale revisions, preserves history and deduplicates retries", async () => {
    const mutation = crypto.randomUUID();
    expect((await save(alice, 0, "first", mutation)).accepted).toBe(true);
    expect((await save(alice, 0, "first", mutation)).record.revision).toBe(1);
    expect((await save(alice, 1, "second")).record.revision).toBe(2);
    const stale = await save(alice, 1, "do not overwrite");
    expect(stale.accepted).toBe(false);
    expect(stale.record.payload.text).toBe("second");
    const history = await asUser(alice, (tx) =>
      tx.query("select * from public.planner_history"),
    );
    expect(history.rows).toHaveLength(2);
  });
  it("other users cannot read private records or their history", async () => {
    const records = await asUser(bob, (tx) =>
      tx.query("select * from public.planner_records"),
    );
    const history = await asUser(bob, (tx) =>
      tx.query("select * from public.planner_history"),
    );
    expect(records.rows).toHaveLength(0);
    expect(history.rows).toHaveLength(0);
  });
  it("rejects an RPC with another account as the owner", async () => {
    await expect(
      save(bob, 2, "attack", crypto.randomUUID(), alice),
    ).rejects.toThrow("Authentication required");
  });
  it("same record ID in another account cannot modify the first account", async () => {
    const own = await save(bob, 0, "bob note");
    expect(own.record.user_id).toBe(bob);
    const other = await asUser(alice, (tx) =>
      tx.query<{ payload: { text: string } }>(
        "select payload from public.planner_records",
      ),
    );
    expect(other.rows[0].payload.text).toBe("second");
  });
  it("denies direct INSERT, UPDATE, DELETE and history writes to authenticated users", async () => {
    for (const sql of [
      "delete from public.planner_records",
      "update public.planner_records set deleted=true",
      "insert into public.planner_records(user_id,id) values(null,null)",
      "delete from public.planner_history",
    ]) {
      await expect(asUser(alice, (tx) => tx.exec(sql))).rejects.toThrow(
        /permission denied/,
      );
    }
  });
  it("denies anonymous reads and RPC execution", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        await tx.exec("select * from public.planner_records");
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        await tx.query(
          "select public.save_planner_record($1,$2,'note','2026-10-23','{}',false,0,$3)",
          [alice, id, crypto.randomUUID()],
        );
      }),
    ).rejects.toThrow(/permission denied/);
  });
  it("rejects missing identity and invalid payloads", async () => {
    await expect(
      save("", 0, "no identity", crypto.randomUUID(), alice),
    ).rejects.toThrow("Authentication required");
    await expect(
      asUser(alice, (tx) =>
        tx.query(
          "select public.save_planner_record($1,$2,'note','2026-10-23','[]',false,0,$3)",
          [alice, stableId("bad-json"), crypto.randomUUID()],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
