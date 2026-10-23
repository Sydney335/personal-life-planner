import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import {
  recordSchema,
  noteSchema,
  type Note,
  sameValue,
  valueOf,
  type LocalRecord,
  type RecordValue,
  type RemoteRecord,
} from "./domain";
import { combinedNote } from "./entryFormatting";
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
  private readonly writer = crypto.randomUUID();
  constructor(readonly owner: string) {}
  async all() {
    const records = await (
      await dbPromise()
    ).getAllFromIndex("records", "owner", this.owner);
    return records.map((r) => ({ ...r, ...valueOf(r) }));
  }
  async get(id: string) {
    return (await dbPromise()).get("records", [this.owner, id]);
  }
  async edit(value: RecordValue, observedRevision?: number) {
    const valid = recordSchema.parse(value);
    const db = await dbPromise();
    const tx = db.transaction("records", "readwrite");
    const prev = await tx.store.get([this.owner, value.id]);
    // The UI may still display an old revision after a pull committed to IDB.
    // Never adopt an unseen remote base. Own acknowledgements are safe because
    // this Store instance already knows the edits that produced them.
    const unseenRemote =
      prev &&
      observedRevision !== undefined &&
      prev.revision > observedRevision &&
      prev.writer !== this.writer &&
      !sameValue(prev, valid);
    const conflict =
      prev?.conflict ??
      (unseenRemote
        ? ({
            ...valueOf(prev),
            revision: prev.revision,
            last_mutation: prev.mutation,
            updated_at: "",
          } as RemoteRecord)
        : undefined);
    await tx.store.put({
      ...valid,
      owner: this.owner,
      writer: this.writer,
      revision: prev?.revision ?? 0,
      mutation: crypto.randomUUID(),
      pending: true,
      conflict,
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
                writer: latest.writer,
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
            writer: local.writer,
            mutation: local.mutation,
            pending: false,
          });
        else await tx.store.put({ ...local, conflict: remote });
      } else
        await tx.store.put({
          ...valueOf(remote),
          owner: this.owner,
          revision: remote.revision,
          mutation: remote.last_mutation,
          pending: false,
        });
    }
    await tx.done;
  }
  async resolve(
    id: string,
    choice: "local" | "remote" | "merge",
    text?: string | Note,
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
          mutation: remote.last_mutation,
          pending: false,
        });
      else {
        const val = valueOf(local);
        if (
          choice === "merge" &&
          val.kind === "note" &&
          remote.kind === "note"
        ) {
          const formatted =
            val.payload.paragraphs.length ||
            (remote.payload.paragraphs?.length ?? 0);
          // The UI merges paragraphs without flattening formatting. Keep the old
          // plain-text API for unformatted clients and existing backups.
          if (typeof text === "object") val.payload = noteSchema.parse(text);
          else if (text !== undefined && !formatted) val.payload.text = text;
          else val.payload = combinedNote(val.payload, remote.payload);
        }
        await tx.store.put({
          ...recordSchema.parse(val),
          deleted: choice === "merge" ? false : val.deleted,
          owner: this.owner,
          revision: remote.revision,
          writer: this.writer,
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
        writer: this.writer,
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
