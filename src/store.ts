import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import {
  recordSchema,
  sameValue,
  valueOf,
  type LocalRecord,
  type RecordValue,
  type RemoteRecord,
} from "./domain";
interface PlannerDB extends DBSchema {
  records: {
    key: [string, string];
    value: LocalRecord;
    indexes: { owner: string };
  };
}
let database: Promise<IDBPDatabase<PlannerDB>> | undefined;
const dbPromise = () =>
  (database ??= openDB<PlannerDB>("daylight-v1", 1, {
    upgrade(db) {
      const s = db.createObjectStore("records", { keyPath: ["owner", "id"] });
      s.createIndex("owner", "owner");
    },
  }));
export class Store {
  constructor(readonly owner: string) {}
  async all() {
    return (await dbPromise()).getAllFromIndex("records", "owner", this.owner);
  }
  async get(id: string) {
    return (await dbPromise()).get("records", [this.owner, id]);
  }
  async edit(value: RecordValue) {
    const valid = recordSchema.parse(value);
    const db = await dbPromise();
    const tx = db.transaction("records", "readwrite");
    const prev = await tx.store.get([this.owner, value.id]);
    await tx.store.put({
      ...valid,
      owner: this.owner,
      revision: prev?.revision ?? 0,
      mutation: crypto.randomUUID(),
      pending: true,
      conflict: prev?.conflict,
    });
    await tx.done;
  }
  async accept(sent: LocalRecord, remote: RemoteRecord, accepted: boolean) {
    const db = await dbPromise();
    const tx = db.transaction("records", "readwrite");
    const latest = await tx.store.get([this.owner, sent.id]);
    if (latest) {
      if (accepted) {
        // An edit made while the request was in flight remains queued on the acknowledged base.
        await tx.store.put(
          latest.mutation === sent.mutation
            ? {
                ...valueOf(remote),
                owner: this.owner,
                revision: remote.revision,
                mutation: latest.mutation,
                pending: false,
              }
            : { ...latest, revision: remote.revision, conflict: undefined },
        );
      } else await tx.store.put({ ...latest, conflict: remote });
    }
    await tx.done;
  }
  async merge(remote: RemoteRecord) {
    const db = await dbPromise();
    const tx = db.transaction("records", "readwrite");
    const local = await tx.store.get([this.owner, remote.id]);
    if (!local || remote.revision > local.revision) {
      if (local?.pending) {
        // A lost response is safe to acknowledge only when it is the exact mutation.
        if (local.mutation === remote.last_mutation)
          await tx.store.put({
            ...valueOf(remote),
            owner: this.owner,
            revision: remote.revision,
            mutation: local.mutation,
            pending: false,
          });
        else await tx.store.put({ ...local, conflict: remote });
      } else
        await tx.store.put({
          ...valueOf(remote),
          owner: this.owner,
          revision: remote.revision,
          mutation: crypto.randomUUID(),
          pending: false,
        });
    }
    await tx.done;
  }
  async resolve(
    id: string,
    choice: "local" | "remote" | "merge",
    text?: string,
  ) {
    const db = await dbPromise();
    const tx = db.transaction("records", "readwrite");
    const local = await tx.store.get([this.owner, id]);
    if (local?.conflict) {
      const remote = local.conflict;
      if (choice === "remote")
        await tx.store.put({
          ...valueOf(remote),
          owner: this.owner,
          revision: remote.revision,
          mutation: crypto.randomUUID(),
          pending: false,
        });
      else {
        const val = valueOf(local);
        if (choice === "merge" && val.kind === "note" && text !== undefined)
          val.payload.text = text;
        await tx.store.put({
          ...recordSchema.parse(val),
          deleted: choice === "merge" ? false : val.deleted,
          owner: this.owner,
          revision: remote.revision,
          mutation: crypto.randomUUID(),
          pending: true,
        });
      }
    }
    await tx.done;
  }
  async importMissing(values: RecordValue[]) {
    const db = await dbPromise();
    const tx = db.transaction("records", "readwrite");
    let added = 0,
      skipped = 0,
      different = 0;
    for (const val of values) {
      const existing = await tx.store.get([this.owner, val.id]);
      if (existing) {
        if (sameValue(existing, val)) skipped++;
        else different++;
        continue;
      }
      await tx.store.put({
        ...valueOf(val),
        owner: this.owner,
        revision: 0,
        pending: true,
        mutation: crypto.randomUUID(),
      });
      added++;
    }
    await tx.done;
    return { added, skipped, different };
  }
  async clear() {
    const db = await dbPromise();
    const tx = db.transaction("records", "readwrite");
    for (const key of await tx.store.index("owner").getAllKeys(this.owner))
      await tx.store.delete(key);
    await tx.done;
  }
}
