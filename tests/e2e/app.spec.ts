import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
async function enter(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Try on this device", exact: true })
    .click();
  await expect(
    page.getByText("Local only · cloud not connected", { exact: true }),
  ).toBeVisible();
}
async function navigate(page: Page, name: string) {
  const nav =
    page.viewportSize()!.width < 768
      ? page.getByRole("navigation", { name: "Mobile navigation" })
      : page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name, exact: true }).click();
}
async function addTask(page: Page, title: string) {
  await page
    .getByRole("button", { name: "Add Study sessions", exact: true })
    .click();
  await page
    .getByLabel("What would you like to do?", { exact: true })
    .fill(title);
  await page.getByLabel("Actual minutes", { exact: true }).fill("45");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: title, exact: false }).first(),
  ).toBeVisible();
}
for (const [device, width, height] of [
  ["iPhone", 390, 844],
  ["iPad", 834, 1194],
  ["Mac", 1440, 1000],
] as const) {
  test(`${device}: add/edit/delete, notes reload, habits, bilingual UI and responsive layout`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await enter(page);
    await addTask(page, "Read a chapter");
    await page
      .getByRole("button", { name: "Read a chapter", exact: false })
      .filter({ has: page.locator("strong") })
      .click();
    await page
      .getByLabel("What would you like to do?", { exact: true })
      .fill("Read two chapters");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Read two chapters", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Done: Read two chapters", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Done: Read two chapters",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("combobox", { name: "Alcohol-free day", exact: true })
      .selectOption("done");
    await navigate(page, "Notes");
    await page
      .getByLabel("Notes", { exact: true })
      .fill("A calm day.\n今天很开心。");
    await page
      .getByLabel("What should I leave for tomorrow?", { exact: true })
      .fill("Read more");
    await page.getByRole("button", { name: "End my day", exact: true }).click();
    await page.reload();
    await navigate(page, "Notes");
    await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
      "A calm day.\n今天很开心。",
    );
    await expect(
      page.getByLabel("What should I leave for tomorrow?", { exact: true }),
    ).toHaveValue("Read more");
    await page.getByRole("button", { name: "中文 / English" }).click();
    await expect(
      page.getByRole("heading", { name: "日记", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "中文 / English" }).click();
    await navigate(page, "Calendar");
    await page.getByRole("searchbox").fill("今天很开心");
    await expect(
      page.getByRole("button", { name: /A calm day/ }),
    ).toBeVisible();
    await navigate(page, "Daily planner");
    await expect(
      page.getByRole("combobox", { name: "Alcohol-free day", exact: true }),
    ).toHaveValue("done");
    await page
      .getByRole("button", { name: "Read two chapters", exact: false })
      .filter({ has: page.locator("strong") })
      .click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(
      page.getByText("Read two chapters", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
test("installed shell reopens offline and retains edits after reconnect", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await navigate(page, "Notes");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Offline entry 离线记录");
  await page.waitForTimeout(250);
  await page.reload();
  await navigate(page, "Notes");
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Offline entry 离线记录",
  );
  await context.setOffline(false);
  await page.reload();
  await navigate(page, "Notes");
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Offline entry 离线记录",
  );
});
test("exports and restores a real JSON backup without duplicates or data overwrite", async ({
  page,
}) => {
  await enter(page);
  await addTask(page, "Backup task");
  await navigate(page, "Settings");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export all data (JSON)", exact: true })
    .click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  page.once("dialog", (d) => d.accept());
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(page.getByRole("status")).toContainText("identical 1");
  await navigate(page, "Daily planner");
  await expect(page.getByText("Backup task", { exact: true })).toHaveCount(1);
});
test("prints Chinese and English US Letter PDFs with daily/week/blank layouts", async ({
  page,
}, testInfo) => {
  await enter(page);
  await navigate(page, "Notes");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("今天值得记住。\n中文换行测试。");
  await navigate(page, "Settings");
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByLabel("Language", { exact: true }).selectOption("zh");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Print / PDF", exact: true })
    .click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#print-pages .print-page")).toHaveCount(2);
  await expect(page.locator(".print-journal")).toContainText("中文换行测试");
  const dailyPdf = await page.pdf({
    path: testInfo.outputPath("daily-zh.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
  const dailyDoc = await PDFDocument.load(dailyPdf);
  expect(dailyDoc.getPageCount()).toBe(2);
  expect(dailyDoc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  await page.emulateMedia({ media: "screen" });
  await page
    .getByLabel("Print / PDF", { exact: true })
    .selectOption("wholeWeek");
  await page.getByLabel("Language", { exact: true }).selectOption("en");
  await page.getByRole("checkbox", { name: "Blank, for handwriting" }).check();
  await page
    .getByRole("main")
    .getByRole("button", { name: "Print / PDF", exact: true })
    .click();
  await expect(page.locator("#print-pages .print-page")).toHaveCount(14);
  await page.emulateMedia({ media: "print" });
  const weekPdf = await page.pdf({
    path: testInfo.outputPath("week-en-blank.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect((await PDFDocument.load(weekPdf)).getPageCount()).toBe(14);
});

test("a failed device write preserves the visible draft and can recover", async ({
  page,
}) => {
  await enter(page);
  await navigate(page, "Notes");
  await page.evaluate(() => {
    (window as unknown as { originalPut: unknown }).originalPut =
      IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Do not lose this draft");
  await expect(page.getByRole("alert")).toContainText("Could not save locally");
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Do not lose this draft",
  );
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (
      window as unknown as { originalPut: typeof IDBObjectStore.prototype.put }
    ).originalPut;
  });
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Do not lose this draft — recovered");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.reload();
  await navigate(page, "Notes");
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Do not lose this draft — recovered",
  );
});
