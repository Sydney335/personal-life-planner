import type { LocalRecord } from "./domain";
import type { SyncStatus } from "./sync";
export interface PlannerSafety {
  loaded: boolean;
  error: boolean;
  unsaved: number;
  syncing: boolean;
  pendingWrites: number;
  sequence: number;
  status: SyncStatus;
}
export async function canUpdatePlanner(
  automatic: boolean,
  owner: string,
  snapshot: () => PlannerSafety,
  flush: () => Promise<void>,
  records: () => Promise<LocalRecord[]>,
) {
  const before = { ...snapshot() };
  const durable = (s: PlannerSafety) =>
    s.loaded && !s.error && !s.unsaved && !s.syncing && !s.pendingWrites;
  if (!durable(before)) return false;
  await flush();
  const all = await records();
  const after = snapshot();
  if (
    !durable(after) ||
    before.sequence !== after.sequence ||
    all.some((r) => r.conflict)
  )
    return false;
  // Local mode has no cloud acknowledgement. A deliberate manual update may
  // retain a durable offline queue, but automatic updates require cloud success.
  return (
    !automatic ||
    owner === "local-device" ||
    (after.status === "saved" && !all.some((r) => r.pending))
  );
}
