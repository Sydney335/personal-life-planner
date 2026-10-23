import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cloudFor, supabase } from "./cloud";
import { Store } from "./store";
import { SyncEngine, type SyncStatus } from "./sync";
import { type LocalRecord, type RecordValue } from "./domain";
export function usePlanner(owner: string) {
  const store = useMemo(() => new Store(owner), [owner]);
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [status, setStatus] = useState<SyncStatus>("syncing");
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);
  const queue = useRef(Promise.resolve());
  const unsaved = useRef(new Map<string, RecordValue>());
  const reload = useCallback(async () => {
    const before = seq.current;
    const all = await store.all();
    if (before === seq.current && unsaved.current.size === 0) {
      setRecords(all);
      setLoaded(true);
    }
  }, [store]);
  const engine = useMemo(
    () =>
      new SyncEngine(
        store,
        owner === "local-device" ? null : cloudFor(owner),
        setStatus,
        () => {
          void reload().catch(() => setError(true));
        },
      ),
    [owner, store, reload],
  );
  useEffect(() => {
    void reload()
      .then(() => engine.sync())
      .catch(() => setError(true));
    const sync = () => void engine.sync();
    const focus = () => {
      if (document.visibilityState === "visible") sync();
    };
    const interval = setInterval(sync, 15000);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", focus);
    const channel =
      owner !== "local-device" && supabase
        ? supabase
            .channel(`planner-${owner}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "planner_records",
                filter: `user_id=eq.${owner}`,
              },
              sync,
            )
            .subscribe()
        : null;
    return () => {
      engine.stop();
      clearInterval(interval);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", focus);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [engine, owner, reload]);
  const edit = useCallback(
    (value: RecordValue) => {
      seq.current++;
      unsaved.current.set(value.id, value);
      setStatus(
        owner === "local-device"
          ? "local"
          : navigator.onLine
            ? "syncing"
            : "offline",
      );
      setRecords((prev) => {
        const existing = prev.find((r) => r.id === value.id);
        const next = {
          ...value,
          owner,
          revision: existing?.revision ?? 0,
          mutation: crypto.randomUUID(),
          pending: true,
          conflict: existing?.conflict,
        } as LocalRecord;
        return [...prev.filter((r) => r.id !== value.id), next];
      });
      queue.current = queue.current
        .then(async () => {
          for (const [id, draft] of unsaved.current) {
            await store.edit(draft);
            if (unsaved.current.get(id) === draft) unsaved.current.delete(id);
          }
          setError(false);
          await reload();
        })
        .catch(() => setError(true));
      void queue.current.then(() => {
        if (unsaved.current.size === 0) return engine.sync();
      });
    },
    [owner, store, reload, engine],
  );
  const resolve = async (
    id: string,
    choice: "local" | "remote" | "merge",
    text?: string,
  ) => {
    await queue.current;
    if (unsaved.current.size)
      throw new Error("Resolve local storage errors before conflict review.");
    await store.resolve(id, choice, text);
    await reload();
    await engine.sync();
  };
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (error || unsaved.current.size) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [error]);
  return {
    records,
    status,
    error,
    loaded,
    edit,
    resolve,
    store,
    reload,
    sync: () => engine.sync(),
    flush: async () => {
      await queue.current;
      if (unsaved.current.size)
        throw new Error(
          "Local save failed; keep this tab open and copy unsaved content.",
        );
    },
  };
}
