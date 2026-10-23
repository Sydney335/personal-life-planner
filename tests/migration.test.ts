import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("adds immutable server creation timestamps without changing legacy records, RLS or JSON formatting", async () => {
  const db = new PGlite();
  const owner = crypto.randomUUID(),
    legacy = crypto.randomUUID(),
    fresh = crypto.randomUUID();
  try {
    await db.exec(`create schema auth; create role anon; create role authenticated;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      insert into auth.users values('${owner}');`);
    await db.exec(
      await readFile("supabase/migrations/001_planner.sql", "utf8"),
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    const save = async (id: string, revision: number, payload: object) => {
      const r = await db.query<{
        result: {
          record: {
            created_at?: string | null;
            updated_at: string;
            revision: number;
            payload: object;
          };
        };
      }>(
        "select public.save_planner_record($1,$2,'task','2026-10-24',$3::jsonb,false,$4,$5) as result",
        [owner, id, JSON.stringify(payload), revision, crypto.randomUUID()],
      );
      return r.rows[0].result.record;
    };
    const old = await save(legacy, 0, {
      title: "Legacy data",
      category: "study",
    });
    await db.exec(
      await readFile("supabase/migrations/002_entry_presentation.sql", "utf8"),
    );
    const oldRow = await db.query<{ created_at: null; payload: object }>(
      "select created_at,payload from planner_records where id=$1",
      [legacy],
    );
    expect(oldRow.rows[0].created_at).toBeNull();
    expect(oldRow.rows[0].payload).toEqual(old.payload);
    const payload = {
      title: "学习",
      category: "study",
      classification: "previousDay",
      strikethrough: true,
    };
    const created = await save(fresh, 0, payload);
    expect(created.created_at).toBeTruthy();
    const edited = await save(fresh, 1, { ...payload, title: "修改计划" });
    expect(edited.created_at).toEqual(created.created_at);
    expect(edited.payload).toMatchObject({
      classification: "previousDay",
      strikethrough: true,
    });
    expect(edited.revision).toBe(2);
    const longText = "汉".repeat(200000);
    const large = await save(crypto.randomUUID(), 0, {
      text: longText,
      paragraphs: [
        {
          id: crypto.randomUUID(),
          text: longText,
          classification: "previousDay",
          strikethrough: true,
        },
      ],
    });
    expect(large.payload).toMatchObject({ text: longText });
    expect(new Date(edited.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updated_at).getTime(),
    );
    const policies = await db.query(
      "select * from pg_policies where tablename in ('planner_records','planner_history')",
    );
    expect(policies.rows).toHaveLength(2);
  } finally {
    await db.close();
  }
});
