import type { Cloud } from "./cloud";
import type { Store } from "./store";
export type SyncStatus =
  "saved" | "syncing" | "offline" | "error" | "conflict" | "local";
export class SyncEngine {
  private running = false;
  private paused = false;
  private again = false;
  private stopped = false;
  constructor(
    private store: Store,
    private cloud: Cloud | null,
    private notify: (status: SyncStatus) => void,
    private changed: () => void,
    private online = () => navigator.onLine,
  ) {}
  get busy() {
    return this.running;
  }
  pause() {
    this.paused = true;
    return () => {
      this.paused = false;
    };
  }
  stop() {
    this.stopped = true;
  }
  async sync(): Promise<void> {
    if (this.stopped || this.paused) return;
    if (this.running) {
      this.again = true;
      return;
    }
    if (!this.cloud) {
      this.notify("local");
      return;
    }
    if (!this.online()) {
      this.notify("offline");
      return;
    }
    this.running = true;
    this.notify("syncing");
    try {
      do {
        this.again = false;
        for (const r of await this.store.all()) {
          if (this.stopped) return;
          if (r.pending && !r.conflict) {
            const result = await this.cloud.push(r);
            if (this.stopped) return;
            await this.store.accept(r, result.record, result.accepted);
          }
        }
        for (const r of await this.cloud.pull()) {
          if (this.stopped) return;
          await this.store.merge(r);
        }
        this.changed();
      } while (this.again && !this.stopped);
      const records = await this.store.all();
      this.notify(
        records.some((r) => r.conflict)
          ? "conflict"
          : records.some((r) => r.pending)
            ? "syncing"
            : "saved",
      );
    } catch {
      if (!this.stopped) this.notify(this.online() ? "error" : "offline");
    } finally {
      this.running = false;
    }
  }
}
