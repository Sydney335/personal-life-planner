import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it, vi } from "vitest";

const html = (build = "B") =>
  new Response(`<meta name="daylight-build" content="${build}">`, {
    headers: { "content-type": "text/html" },
  });
function worker(clientBuilds: (string | null)[] = []) {
  const handlers: Record<string, (event: any) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const values = stores.get(name)!;
    return {
      put: async (key: string, response: Response) => {
        values.set(key, response.clone());
      },
      match: async (key: string) => values.get(key)?.clone(),
    };
  };
  const clients = clientBuilds.map((buildId, i) => ({
    id: `${i}`,
    url: "https://daylight.test/",
    postMessage: (_: unknown, ports: MessagePort[]) => {
      if (buildId) ports[0].postMessage({ buildId });
    },
  }));
  const fetch = vi.fn(async (_request?: Request) => html());
  const skipWaiting = vi.fn(async () => {});
  const self = {
    registration: { scope: "https://daylight.test/" },
    location: { origin: "https://daylight.test" },
    clients: {
      matchAll: async () => clients,
      claim: vi.fn(),
      get: async () => clients[0],
    },
    skipWaiting,
    addEventListener: (name: string, fn: (event: any) => void) => {
      handlers[name] = fn;
    },
  };
  // Relative Request URLs in browsers resolve against the worker's origin.
  class WorkerRequest extends Request {
    constructor(input: string | Request, init?: RequestInit) {
      super(
        typeof input === "string"
          ? new URL(input, "https://daylight.test")
          : input,
        init,
      );
    }
  }
  vm.runInNewContext(
    readFileSync("scripts/sw-template.js", "utf8")
      .replace("__BUILD__", '"B"')
      .replace("__FILES__", '["/index.html", "/assets/B.js", "/assets/B.css"]'),
    {
      self,
      fetch,
      caches: {
        open: async (name: string) => cache(name),
        keys: async () => [...stores.keys()],
        delete: async (name: string) => stores.delete(name),
      },
      Request: WorkerRequest,
      Response,
      URL,
      AbortController,
      MessageChannel,
      setTimeout,
      clearTimeout,
    },
  );
  async function dispatch(name: string, extras: object = {}) {
    let done: Promise<unknown> | undefined;
    handlers[name]({
      waitUntil: (p: Promise<unknown>) => {
        done = p;
      },
      respondWith: (p: Promise<unknown>) => {
        done = p;
      },
      ...extras,
    });
    return await done;
  }
  return { dispatch, fetch, stores, cache, skipWaiting };
}
it("installs a complete shell and rejects a failed download without deleting the current cache", async () => {
  const w = worker();
  w.stores.set("daylight-shell-A", new Map());
  w.fetch.mockImplementation(async (request?: any) =>
    request.url.endsWith(".js")
      ? new Response("js", { headers: { "content-type": "text/javascript" } })
      : request.url.endsWith(".css")
        ? new Response("css", { headers: { "content-type": "text/css" } })
        : html(),
  );
  await w.dispatch("install");
  expect(w.stores.get("daylight-shell-B")?.size).toBe(3);
  w.fetch.mockRejectedValueOnce(new Error("offline"));
  await expect(w.dispatch("install")).rejects.toThrow("offline");
  expect(w.stores.has("daylight-shell-A")).toBe(true);
  expect(w.stores.has("daylight-shell-B")).toBe(false);
});
it("uses fresh matching HTML, falls back offline, and holds a different build until ready", async () => {
  const w = worker();
  await w.cache("daylight-shell-B").put("/index.html", html());
  const request = new Request("https://daylight.test/");
  Object.defineProperty(request, "mode", { value: "navigate" });
  const navigate = () => w.dispatch("fetch", { request });
  w.fetch.mockImplementation(async () => html());
  const response = (await navigate()) as Response;
  expect(await response.text()).toContain('content="B"');
  expect(w.fetch).toHaveBeenCalledTimes(1);
  w.fetch.mockRejectedValueOnce(new Error("offline"));
  expect(await ((await navigate()) as Response).text()).toContain(
    'content="B"',
  );
  w.fetch.mockResolvedValueOnce(html("C"));
  expect(await ((await navigate()) as Response).text()).toContain(
    'content="B"',
  );
});
it("serves immutable assets from the correct retained shell and never intercepts sensitive or version requests", async () => {
  const w = worker();
  await w.cache("daylight-shell-A").put("/assets/A.js", new Response("old JS"));
  const result = (await w.dispatch("fetch", {
    request: { url: "https://daylight.test/assets/A.js", method: "GET" },
  })) as Response;
  expect(await result.text()).toBe("old JS");
  for (const url of [
    "https://private.supabase.co/auth/v1/token",
    "https://daylight.test/api/records",
    "https://daylight.test/version.json",
  ]) {
    expect(
      await w.dispatch("fetch", { request: { url, method: "GET" } }),
    ).toBeUndefined();
  }
  expect(w.fetch).not.toHaveBeenCalled();
});
it("cleans only obsolete owned caches and retains assets still used by a page", async () => {
  const w = worker(["A"]);
  for (const name of [
    "daylight-shell-A",
    "daylight-shell-B",
    "daylight-shell-old",
    "daylight-0123456789abcdef",
    "other-app",
  ])
    w.stores.set(name, new Map());
  await w.dispatch("activate");
  expect([...w.stores.keys()].sort()).toEqual([
    "daylight-shell-A",
    "daylight-shell-B",
    "other-app",
  ]);
});
it("retains caches for suspended or legacy pages that do not answer", async () => {
  const w = worker([null]);
  w.stores.set("daylight-shell-A", new Map());
  await w.dispatch("activate");
  expect(w.stores.has("daylight-shell-A")).toBe(true);
});
it("permits requested activation only for the sole requesting window", async () => {
  for (const builds of [["A"], ["A", "A"]]) {
    const w = worker(builds);
    const reply = vi.fn();
    await w.dispatch("message", {
      data: { type: "DAYLIGHT_ACTIVATE" },
      source: { id: "0" },
      ports: [{ postMessage: reply }],
    });
    expect(w.skipWaiting).toHaveBeenCalledTimes(builds.length === 1 ? 1 : 0);
    expect(reply).toHaveBeenCalledWith(
      builds.length === 1 ? { activating: true } : { blocked: "tabs" },
    );
  }
});
