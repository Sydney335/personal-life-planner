import { createClient } from "@supabase/supabase-js";
import { recordSchema, type LocalRecord, type RemoteRecord } from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured =
  !!url && !!key && !url.includes("YOUR_PROJECT") && !key.startsWith("YOUR_");
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;
export interface Cloud {
  pull(): Promise<RemoteRecord[]>;
  push(
    record: LocalRecord,
  ): Promise<{ accepted: boolean; record: RemoteRecord }>;
}
function remote(value: unknown): RemoteRecord {
  const raw = value as RemoteRecord;
  const parsed = recordSchema.parse(raw);
  if (!Number.isInteger(raw.revision) || raw.revision < 1)
    throw new Error("Invalid server revision");
  return {
    ...parsed,
    revision: raw.revision,
    updated_at: raw.updated_at,
    last_mutation: raw.last_mutation,
  };
}
export function cloudFor(owner: string): Cloud {
  if (!supabase) throw new Error("Cloud not configured");
  const client = supabase;
  return {
    async pull() {
      const result: RemoteRecord[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await client
          .from("planner_records")
          .select("*")
          .eq("user_id", owner)
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        result.push(...data.map(remote));
        if (data.length < 500) break;
        offset += 500;
      }
      return result;
    },
    async push(record) {
      const { data, error } = await client.rpc("save_planner_record", {
        p_user_id: owner,
        p_id: record.id,
        p_kind: record.kind,
        p_day: record.day,
        p_payload: record.payload,
        p_deleted: record.deleted,
        p_expected_revision: record.revision,
        p_mutation: record.mutation,
      });
      if (error) throw error;
      return { accepted: data.accepted, record: remote(data.record) };
    },
  };
}
