import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
async function deploy(
  request: APIRequestContext,
  build: string,
  broken = false,
) {
  await request.post(
    `/__test/deploy?build=${build}${broken ? "&broken=1" : ""}`,
  );
}
async function enter(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Try on this device", exact: true })
    .click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
}
async function settings(page: Page, name = "Settings") {
  const nav =
    page.viewportSize()!.width < 768 ? "Mobile navigation" : "Main navigation";
  await page
    .getByRole("navigation", { name: nav })
    .getByRole("button", { name, exact: true })
    .click();
}
async function check(page: Page) {
  await page
    .getByRole("button", { name: "Check for updates", exact: true })
    .click();
}
async function ready(page: Page) {
  await expect(
    page.getByRole("complementary", { name: "Update available" }),
  ).toBeVisible();
  await expect(page.getByTestId("update-status")).toHaveText(
    "A new version of Daylight is ready.",
  );
}
async function rows(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("daylight-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise<object[]>((resolve, reject) => {
      const request = db.transaction("records").objectStore("records").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  });
}
test.beforeEach(async ({ request }) => {
  await deploy(request, "A");
});

for (const [device, width, height] of [
  ["iPhone", 390, 844],
  ["iPad", 834, 1194],
  ["Mac", 1440, 1000],
] as const) {
  test(`${device}: real A → B activation preserves IDB queue, loads matching assets, supports both languages and themes`, async ({
    page,
    request,
    context,
  }) => {
    await page.setViewportSize({ width, height });
    await enter(page);
    await page
      .getByRole("navigation", {
        name: width < 768 ? "Mobile navigation" : "Main navigation",
      })
      .getByRole("button", { name: "Notes", exact: true })
      .click();
    await page
      .getByLabel("Notes", { exact: true })
      .fill("Keep my offline note 离线记录");
    await expect
      .poll(async () => JSON.stringify(await rows(page)))
      .toContain("Keep my offline note");
    const before = await rows(page);
    await settings(page);
    expect(await page.getByTestId("running-build").textContent()).toBe("pwa-A");
    const oldJs = await page.locator("script[type=module]").getAttribute("src");
    const oldCss = await page
      .locator("link[rel=stylesheet]")
      .getAttribute("href");
    await deploy(request, "B");
    await check(page);
    await ready(page);
    expect(
      await page
        .locator(".update-notice")
        .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Later", exact: true }).click();
    await expect(page.locator(".update-notice")).toHaveCount(0);
    await page.reload();
    await settings(page);
    await expect(page.getByTestId("running-build")).toHaveText("pwa-A");
    await expect(page.locator(".update-notice")).toHaveCount(0);
    await check(page);
    await ready(page);
    await page.getByRole("button", { name: "中文 / English" }).click();
    await expect(page.locator(".update-notice")).toContainText(
      "日光的新版本已准备就绪",
    );
    await page.getByRole("button", { name: "中文 / English" }).click();
    await page.screenshot({
      path: test.info().outputPath(`${device}-update-light.png`),
    });
    const toggle = page.getByRole("button", { name: /Dark|Light/ });
    // Existing appearance toggle lives in the top bar.
    await toggle.first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({
      path: test.info().outputPath(`${device}-update-dark.png`),
    });
    await page.getByRole("button", { name: "Update now", exact: true }).click();
    await page.waitForURL("**/");
    await expect
      .poll(() =>
        page.locator("meta[name=daylight-build]").getAttribute("content"),
      )
      .toBe("pwa-B");
    await settings(page);
    await expect(page.getByTestId("running-build")).toHaveText("pwa-B");
    expect(
      await page.locator("script[type=module]").getAttribute("src"),
    ).not.toBe(oldJs);
    expect(
      await page.locator("link[rel=stylesheet]").getAttribute("href"),
    ).not.toBe(oldCss);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--pwa-test-build")
          .trim(),
      ),
    ).toBe("pwa-B");
    expect(await rows(page)).toEqual(before);
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .toEqual(["daylight-shell-pwa-B"]);
    await context.setOffline(true);
    await page.reload();
    await settings(page);
    await expect(page.getByTestId("running-build")).toHaveText("pwa-B");
    expect(await rows(page)).toEqual(before);
  });
}

test("checks on launch, foreground and reconnect; pauses polling while hidden", async ({
  page,
  request,
  context,
}) => {
  await page.clock.install();
  await enter(page);
  await settings(page);
  await expect
    .poll(
      async () => (await (await request.get("/__test/state")).json()).checks,
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = (await (await request.get("/__test/state")).json()).checks;
  await page.clock.fastForward(6 * 60_000);
  expect((await (await request.get("/__test/state")).json()).checks).toBe(
    before,
  );
  await deploy(request, "B");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await ready(page);
  await context.setOffline(true);
  await context.setOffline(false);
  await expect
    .poll(
      async () => (await (await request.get("/__test/state")).json()).checks,
    )
    .toBeGreaterThan(1);
});

test("automatic updates wait for idle and never reload an open task draft", async ({
  page,
  request,
}) => {
  await page.clock.install();
  await enter(page);
  await settings(page);
  await deploy(request, "B");
  await check(page);
  await ready(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Daily planner", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Study sessions", exact: true })
    .click();
  await page
    .getByLabel("What would you like to do?", { exact: true })
    .fill("Unsaved task draft");
  await page.clock.fastForward(70_000);
  await expect(
    page.getByLabel("What would you like to do?", { exact: true }),
  ).toHaveValue("Unsaved task draft");
  expect(
    await page.locator("meta[name=daylight-build]").getAttribute("content"),
  ).toBe("pwa-A");
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .first()
    .click();
  await page.clock.fastForward(70_000);
  await expect
    .poll(() =>
      page.locator("meta[name=daylight-build]").getAttribute("content"),
    )
    .toBe("pwa-B");
});

test("another tab blocks activation and never loses its unsaved draft", async ({
  page,
  context,
  request,
}) => {
  await enter(page);
  await settings(page);
  const other = await context.newPage();
  await other.goto("/");
  await other
    .getByRole("button", { name: "Try on this device", exact: true })
    .click();
  await other
    .getByRole("button", { name: "Add Study sessions", exact: true })
    .click();
  await other
    .getByLabel("What would you like to do?", { exact: true })
    .fill("Other tab draft");
  await deploy(request, "B");
  await check(page);
  await ready(page);
  await page.getByRole("button", { name: "Update now", exact: true }).click();
  await expect(page.getByTestId("update-status")).toHaveText(
    "Close other Daylight tabs or app windows, then try again.",
  );
  await expect(
    other.getByLabel("What would you like to do?", { exact: true }),
  ).toHaveValue("Other tab draft");
  await other.close();
  await page.getByRole("button", { name: "Update now", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("meta[name=daylight-build]").getAttribute("content"),
    )
    .toBe("pwa-B");
});

test("failed shell download keeps A working offline and recovers after reconnect", async ({
  page,
  request,
  context,
}) => {
  await enter(page);
  await settings(page);
  await deploy(request, "B", true);
  await check(page);
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await navigator.serviceWorker.getRegistration())?.installing
            ?.state || "none",
      ),
    )
    .toBe("none");
  expect(
    await page.locator("meta[name=daylight-build]").getAttribute("content"),
  ).toBe("pwa-A");
  await context.setOffline(true);
  await page.reload();
  await settings(page);
  await expect(page.getByTestId("running-build")).toHaveText("pwa-A");
  await deploy(request, "B");
  await context.setOffline(false);
  await check(page);
  await ready(page);
  await page.getByRole("button", { name: "Update now", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("meta[name=daylight-build]").getAttribute("content"),
    )
    .toBe("pwa-B");
});

test("an unexpected controller change keeps the draft and its assets; current page can later adopt the active build", async ({
  page,
  request,
}) => {
  await enter(page);
  await settings(page);
  await deploy(request, "B");
  await check(page);
  await ready(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Daily planner", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Study sessions", exact: true })
    .click();
  await page
    .getByLabel("What would you like to do?", { exact: true })
    .fill("Keep this across controllerchange");
  await page.evaluate(async () => {
    const registration = (await navigator.serviceWorker.getRegistration())!;
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => resolve(),
        { once: true },
      );
      registration.waiting!.postMessage({ type: "DAYLIGHT_ACTIVATE" });
    });
  });
  await expect(
    page.getByLabel("What would you like to do?", { exact: true }),
  ).toHaveValue("Keep this across controllerchange");
  expect(
    await page.locator("meta[name=daylight-build]").getAttribute("content"),
  ).toBe("pwa-A");
  expect(await page.evaluate(() => caches.keys())).toContain(
    "daylight-shell-pwa-A",
  );
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .first()
    .click();
  await settings(page);
  await check(page);
  await ready(page);
  await page.getByRole("button", { name: "Update now", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("meta[name=daylight-build]").getAttribute("content"),
    )
    .toBe("pwa-B");
});

test("an unsaved settings draft and a failed local write prevent manual and idle reloads", async ({
  page,
  request,
}) => {
  await page.clock.install();
  await enter(page);
  await settings(page);
  await deploy(request, "B");
  await check(page);
  await ready(page);
  await page
    .getByLabel("Add a custom habit", { exact: true })
    .fill("Not added yet");
  await page.getByRole("button", { name: "Update now", exact: true }).click();
  await expect(page.getByTestId("update-status")).toHaveText(
    "Finish editing, saving or syncing and resolve conflicts, then try again.",
  );
  await page.clock.fastForward(70_000);
  await expect(
    page.getByLabel("Add a custom habit", { exact: true }),
  ).toHaveValue("Not added yet");
  await page.getByLabel("Add a custom habit", { exact: true }).fill("");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Notes", exact: true })
    .click();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Not on disk; must not reload");
  await expect(page.getByRole("alert")).toContainText("Could not save locally");
  await page.getByRole("button", { name: "Update now", exact: true }).click();
  await page.clock.fastForward(70_000);
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Not on disk; must not reload",
  );
  expect(
    await page.locator("meta[name=daylight-build]").getAttribute("content"),
  ).toBe("pwa-A");
});
