export interface AppInfo {
  version: string;
  buildId: string;
  builtAt: string;
}
declare const __APP_INFO__: AppInfo;
export const appInfo = __APP_INFO__;
export type UpdateStatus =
  | "idle"
  | "checking"
  | "current"
  | "downloading"
  | "available"
  | "updating"
  | "blocked"
  | "tabs"
  | "failed"
  | "offline"
  | "unsupported";
export interface UpdateState {
  status: UpdateStatus;
  buildId?: string;
  lastChecked?: number;
  postponed: boolean;
}
type Guard = (automatic: boolean) => Promise<boolean>;
const INTERVAL = 5 * 60_000;
const IDLE = 60_000;
const SNOOZE = 24 * 60 * 60_000;

export function messageWorker<T>(
  worker: ServiceWorker,
  message: object,
  timeout = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error("Worker did not respond"));
    }, timeout);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data as T);
    };
    try {
      worker.postMessage(message, [channel.port2]);
    } catch (error) {
      clearTimeout(timer);
      channel.port1.close();
      reject(error);
    }
  });
}
function readSnooze(buildId: string) {
  try {
    return (
      Number(localStorage.getItem(`daylight-update-later:${buildId}`)) || 0
    );
  } catch {
    return 0;
  }
}
export class UpdateManager {
  private state: UpdateState = { status: "idle", postponed: false };
  private listeners = new Set<() => void>();
  private registration?: ServiceWorkerRegistration;
  private activeUpdate?: ServiceWorker;
  private guard?: Guard;
  private pause?: () => () => void;
  private checking?: Promise<void>;
  private lastAttempt = 0;
  private activity = Date.now();
  private started = false;
  private applying = false;
  private expectingController = false;
  private snoozeUntil = 0;
  private watched = new WeakSet<ServiceWorker>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;
  private set(patch: Partial<UpdateState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  setGuard(guard: Guard, pause?: () => () => void) {
    this.guard = guard;
    this.pause = pause;
    return () => {
      if (this.guard === guard) {
        this.guard = undefined;
        this.pause = undefined;
      }
    };
  }
  private editing() {
    const focused = document.activeElement;
    return (
      !!document.querySelector(
        'dialog[open], [data-update-draft="true"], [aria-invalid="true"]',
      ) ||
      !!focused?.matches('input, textarea, select, [contenteditable="true"]')
    );
  }
  private async safe(automatic: boolean) {
    if (
      !this.guard ||
      this.editing() ||
      (automatic && Date.now() - this.activity < IDLE)
    )
      return false;
    const activity = this.activity;
    const guard = this.guard;
    return (
      (await guard(automatic)) &&
      guard === this.guard &&
      activity === this.activity &&
      !this.editing()
    );
  }
  private async ready(worker: ServiceWorker) {
    try {
      const { buildId } = await messageWorker<{ buildId: string }>(worker, {
        type: "DAYLIGHT_VERSION",
      });
      if (worker !== this.registration?.waiting || buildId === appInfo.buildId)
        return;
      this.snoozeUntil = Math.max(
        this.state.buildId === buildId ? this.snoozeUntil : 0,
        readSnooze(buildId),
      );
      this.set({
        buildId,
        status: "available",
        postponed: this.snoozeUntil > Date.now(),
      });
    } catch {
      this.set({ status: "failed" });
    }
  }
  private watch(worker: ServiceWorker) {
    if (this.watched.has(worker)) return;
    this.watched.add(worker);
    const changed = () => {
      if (
        worker.state === "installed" &&
        this.registration?.waiting &&
        navigator.serviceWorker.controller
      )
        void this.ready(worker);
      if (worker.state === "redundant" && !this.applying)
        this.set({ status: "failed" });
    };
    worker.addEventListener("statechange", changed);
    changed();
  }
  start() {
    if (this.started || !import.meta.env.PROD) return;
    this.started = true;
    if (!("serviceWorker" in navigator)) {
      this.set({ status: "unsupported" });
      return;
    }
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "DAYLIGHT_BUILD")
        event.ports[0]?.postMessage({ buildId: appInfo.buildId });
      if (event.data?.type === "DAYLIGHT_DEPLOYED") void this.check();
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Other tabs and first installation never trigger an unsolicited reload.
      if (this.expectingController) {
        this.expectingController = false;
        location.reload();
      } else
        navigator.serviceWorker.controller?.postMessage({
          type: "DAYLIGHT_CLEANUP",
        });
    });
    const active = () => {
      this.activity = Date.now();
    };
    for (const name of ["pointerdown", "keydown", "input", "compositionstart"])
      document.addEventListener(name, active, true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.check();
    });
    window.addEventListener("pageshow", () => {
      void this.check();
    });
    window.addEventListener("online", () => {
      void this.check(false, true);
    });
    window.addEventListener("offline", () => {
      if (!this.applying) this.set({ status: "offline" });
    });
    setInterval(() => {
      if (document.visibilityState === "visible") void this.check();
    }, INTERVAL);
    setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        this.applying
      )
        return;
      if (this.state.postponed && Date.now() >= this.snoozeUntil)
        this.set({ postponed: false });
      if (
        (this.registration?.waiting || this.activeUpdate) &&
        !this.state.postponed
      )
        void this.apply(true);
    }, 5000);
    void this.check();
    navigator.serviceWorker.controller?.postMessage({
      type: "DAYLIGHT_CLEANUP",
    });
  }
  check = (manual = false, force = false): Promise<void> => {
    if (this.checking) return this.checking;
    if (!("serviceWorker" in navigator)) {
      this.set({ status: "unsupported" });
      return Promise.resolve();
    }
    if (!navigator.onLine) {
      this.set({ status: "offline" });
      return Promise.resolve();
    }
    if (
      this.applying ||
      (!manual && !force && Date.now() - this.lastAttempt < 30_000)
    )
      return Promise.resolve();
    this.lastAttempt = Date.now();
    this.checking = this.performCheck(manual).finally(() => {
      this.checking = undefined;
    });
    return this.checking;
  };
  private async performCheck(manual: boolean) {
    this.set({ status: "checking" });
    try {
      if (!this.registration) {
        this.registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });
        this.registration.addEventListener("updatefound", () => {
          if (this.registration?.installing) {
            this.set({ status: "downloading" });
            this.watch(this.registration.installing);
          }
        });
      }
      if (this.registration.installing)
        this.watch(this.registration.installing);
      await this.registration.update();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch("/version.json", {
          cache: "no-store",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw new Error("Version check failed");
      const info: AppInfo = await response.json();
      if (typeof info.buildId !== "string") throw new Error("Invalid version");
      this.set({ lastChecked: Date.now() });
      if (this.registration.waiting) {
        await this.ready(this.registration.waiting);
        if (manual) {
          this.snoozeUntil = 0;
          try {
            localStorage.removeItem(
              `daylight-update-later:${this.state.buildId}`,
            );
          } catch {
            /* Memory state remains available. */
          }
          this.set({ postponed: false });
        }
      } else if (
        !this.registration.installing &&
        info.buildId !== appInfo.buildId &&
        this.registration.active
      ) {
        const active = this.registration.active;
        const version = await messageWorker<{ buildId: string }>(active, {
          type: "DAYLIGHT_VERSION",
        });
        if (version.buildId === info.buildId) {
          this.activeUpdate = active;
          this.snoozeUntil = manual ? 0 : readSnooze(version.buildId);
          this.set({
            buildId: version.buildId,
            status: "available",
            postponed: this.snoozeUntil > Date.now(),
          });
        } else this.set({ status: "downloading" });
      } else
        this.set({
          status: this.registration.installing ? "downloading" : "current",
        });
    } catch {
      this.set({ status: navigator.onLine ? "failed" : "offline" });
    }
  }
  later = () => {
    if (!this.state.buildId) return;
    this.snoozeUntil = Date.now() + SNOOZE;
    try {
      localStorage.setItem(
        `daylight-update-later:${this.state.buildId}`,
        String(this.snoozeUntil),
      );
    } catch {
      /* Memory snooze still works. */
    }
    this.set({ postponed: true, status: "available" });
  };
  apply = async (automatic = false): Promise<void> => {
    const worker = this.registration?.waiting || this.activeUpdate;
    if (
      this.applying ||
      !worker ||
      !navigator.onLine ||
      (automatic &&
        (this.state.postponed || document.visibilityState !== "visible"))
    )
      return;
    this.applying = true;
    try {
      if (!(await this.safe(automatic))) {
        if (!automatic) this.set({ status: "blocked" });
        return;
      }
      // The final guard awaits IDB. Freeze interaction during activation so a new edit
      // cannot enter between that successful check and controllerchange.
      const root = document.getElementById("root");
      if (root) root.inert = true;
      const resume = this.pause?.();
      const block = (event: Event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const blockedEvents = [
        "pointerdown",
        "click",
        "keydown",
        "beforeinput",
        "compositionstart",
      ];
      blockedEvents.forEach((name) =>
        document.addEventListener(name, block, true),
      );
      this.set({ status: "updating" });
      this.expectingController = true;
      try {
        // A page restored from bfcache, or opened during activation, can already
        // have the new active worker while still running old JS. Only it reloads.
        if (
          worker === this.activeUpdate &&
          worker === this.registration?.active
        ) {
          this.expectingController = false;
          location.reload();
          return;
        }
        const result = await messageWorker<{
          blocked?: string;
          activating?: boolean;
        }>(worker, { type: "DAYLIGHT_ACTIVATE" });
        if (result.blocked) {
          this.expectingController = false;
          this.set({ status: "tabs" });
        } else if (!result.activating) throw new Error("Activation refused");
        else {
          // Recover visibly if a browser abandons an activation; never spin forever.
          await new Promise<void>((resolve) => setTimeout(resolve, 10_000));
          this.expectingController = false;
          this.set({ status: "failed" });
        }
      } finally {
        if (root) root.inert = false;
        blockedEvents.forEach((name) =>
          document.removeEventListener(name, block, true),
        );
        resume?.();
      }
    } catch {
      this.expectingController = false;
      this.set({ status: "failed" });
    } finally {
      this.applying = false;
    }
  };
}
export const updates = new UpdateManager();
