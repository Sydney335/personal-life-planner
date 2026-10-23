import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
async function enter(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Try on this device", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add Study sessions", exact: true }),
  ).toBeVisible();
}
async function nav(page: Page, name: string) {
  const navigation = page.getByRole("navigation", {
    name:
      page.viewportSize()!.width < 768
        ? "Mobile navigation"
        : "Main navigation",
    exact: true,
  });
  await navigation.getByRole("button", { name, exact: true }).click();
}
async function saved(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const req = indexedDB.open("daylight-v1");
        const db = await new Promise<IDBDatabase>((resolve) => {
          req.onsuccess = () => resolve(req.result);
        });
        const result = await new Promise<unknown[]>((resolve) => {
          const request = db
            .transaction("records", "readonly")
            .objectStore("records")
            .getAll();
          request.onsuccess = () => resolve(request.result);
        });
        db.close();
        return JSON.stringify(result);
      }),
    )
    .not.toBe("[]");
}

test("manual midnight labels, all categories, editable color, date navigation and reversible strike independent of completion", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-24T02:00:00") });
  await enter(page);
  await page.locator("#selected-day").fill("2026-10-24");
  const categories = [
    "Study sessions",
    "Beyond studying",
    "Alternative activities",
    "Meals today",
    "Exercise & movement",
    "Social connection",
    "Leisure & entertainment",
    "Reminders & to-dos",
  ];
  for (const category of categories) {
    await page
      .getByRole("button", { name: `Add ${category}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("radio", { name: "Unmarked", exact: true }),
    ).toBeChecked();
    await dialog
      .getByLabel("What would you like to do?", { exact: true })
      .fill(`Plan ${category}`);
    await dialog
      .getByRole("radio", { name: "Previous Day", exact: true })
      .check();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    const title = page.getByText(`Plan ${category}`, { exact: true });
    await expect(title).toHaveCSS("color", "rgb(150, 114, 184)");
  }
  const title = page.getByText("Plan Study sessions", { exact: true });
  const strike = page.getByRole("button", {
    name: "Strikethrough: Plan Study sessions",
    exact: true,
  });
  await strike.click();
  await expect(title.locator("..")).toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
  await expect(
    page.getByRole("button", {
      name: "Done: Plan Study sessions",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
  await strike.click();
  await expect(title.locator("..")).toHaveCSS("text-decoration-line", "none");
  await strike.click();
  await title.click();
  await page.getByRole("radio", { name: "Same Day", exact: true }).check();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Strikethrough", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(title).toHaveCSS("color", "rgb(84, 127, 183)");
  await expect(title.locator("..")).toHaveCSS("text-decoration-line", "none");
  await title.click();
  await page.getByRole("radio", { name: "Previous Day", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Strikethrough", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByLabel("What would you like to do?", { exact: true })
    .fill("Reconsidered study");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator("#selected-day").fill("2027-01-01");
  await expect(page.locator(".entry-legend")).toContainText(
    "December 31, 2026",
  );
  await page.locator("#selected-day").fill("2026-10-24");
  await expect(
    page.getByText("Reconsidered study", { exact: true }).locator(".."),
  ).toHaveCSS("text-decoration-line", "line-through");
  await page.clock.setSystemTime(new Date("2026-10-25T10:00:00"));
  await page.reload();
  await page.locator("#selected-day").fill("2026-10-24");
  await expect(page.getByText("Reconsidered study", { exact: true })).toHaveCSS(
    "color",
    "rgb(150, 114, 184)",
  );
  await nav(page, "Settings");
  await page
    .getByRole("button", { name: "Previous Day #70469C", exact: true })
    .click();
  await nav(page, "Daily planner");
  await expect(page.getByText("Reconsidered study", { exact: true })).toHaveCSS(
    "color",
    "rgb(112, 70, 156)",
  );
  await expect(page.getByText("Plan Meals today", { exact: true })).toHaveCSS(
    "color",
    "rgb(112, 70, 156)",
  );
  await expect(page.locator(".entry-legend .legend-item").first()).toHaveCSS(
    "color",
    "rgb(112, 70, 156)",
  );
  await page.getByRole("button", { name: "中文 / English" }).click();
  await expect(page.locator(".entry-legend")).toContainText("前一天填写");
  await expect(page.locator(".entry-legend")).toContainText("参考日期");
  await expect(page.locator(".entry-legend")).toContainText("用户手动标记");
});

test("preset/custom colors, invalid HEX, simultaneous light/dark previews and font persistence offline", async ({
  page,
  context,
}) => {
  await enter(page);
  await nav(page, "Settings");
  await page.getByRole("button", { name: "Extra Large", exact: true }).click();
  await expect(page.locator("html")).toHaveCSS("font-size", "25.6px");
  await expect(page.locator(".font-preview p")).toHaveCSS(
    "font-size",
    "25.6px",
  );
  await expect(page.getByRole("slider", { name: "Font Size" })).toHaveValue(
    "160",
  );
  const palette = page.getByRole("group", {
    name: "Previous Day · Color Palette",
    exact: true,
  });
  await expect(palette.getByRole("button")).toHaveCount(20);
  await page
    .getByRole("button", { name: "Previous Day #70469C", exact: true })
    .click();
  await page.getByLabel("Same Day · HEX Color", { exact: true }).fill("#abc");
  await page.getByLabel("Same Day · HEX Color", { exact: true }).blur();
  await expect(
    page.getByLabel("Same Day · HEX Color", { exact: true }),
  ).toHaveValue("#AABBCC");
  await page.getByLabel("Same Day · HEX Color", { exact: true }).fill("#wrong");
  await expect(page.getByRole("alert")).toContainText("valid HEX");
  await expect(page.locator(".color-preview.light")).toContainText(
    "Previous Day",
  );
  await expect(page.locator(".color-preview.dark")).toContainText("Same Day");
  await page
    .getByLabel("Same Day · HEX Color", { exact: true })
    .fill("#ffffff");
  await expect(
    page.locator(".color-preview.light p").filter({ hasText: "Same Day" }),
  ).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".color-preview.light")).toContainText(
    "Low text contrast",
  );
  // Exercise the built-in custom picker event as well as HEX editing.
  await page
    .getByLabel("Previous Day · Custom Color", { exact: true })
    .fill("#123456");
  await expect(
    page.getByLabel("Previous Day · HEX Color", { exact: true }),
  ).toHaveValue("#123456");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await nav(page, "Settings");
  await expect(page.getByRole("slider", { name: "Font Size" })).toHaveValue(
    "160",
  );
  await expect(
    page.getByLabel("Previous Day · HEX Color", { exact: true }),
  ).toHaveValue("#123456");
  await page.getByRole("slider", { name: "Font Size" }).fill("137");
  await saved(page);
  await page.reload();
  await nav(page, "Settings");
  await expect(page.getByRole("slider", { name: "Font Size" })).toHaveValue(
    "137",
  );
  await context.setOffline(false);
  await page.reload();
  await nav(page, "Settings");
  await expect(page.getByRole("slider", { name: "Font Size" })).toHaveValue(
    "137",
  );
  await page
    .locator(".typography-settings")
    .getByRole("button", { name: "Reset to Default", exact: true })
    .click();
  await expect(page.getByRole("slider", { name: "Font Size" })).toHaveValue(
    "100",
  );
  await page
    .locator(".color-selector")
    .first()
    .getByRole("button", { name: "Reset to Default", exact: true })
    .click();
  await expect(
    page.getByLabel("Previous Day · HEX Color", { exact: true }),
  ).toHaveValue("#9672B8");
});

test("mixed Notes paragraphs preserve independent labels, strike, edits, offline reload and JSON backup", async ({
  page,
  context,
}) => {
  await enter(page);
  await nav(page, "Notes");
  const first = page.getByRole("region", { name: "Paragraph 1", exact: true });
  // Named section elements expose region landmarks.
  await page.getByLabel("Notes", { exact: true }).fill("明天想去图书馆学习。");
  await first.getByRole("radio", { name: "Previous Day", exact: true }).check();
  await first
    .getByRole("button", { name: "Strikethrough", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add paragraph", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Paragraph 2", exact: true })
    .fill("今天在家学习了两个小时。");
  const second = page.getByRole("region", { name: "Paragraph 2", exact: true });
  await expect(
    second.getByRole("radio", { name: "Unmarked", exact: true }),
  ).toBeChecked();
  await second.getByRole("radio", { name: "Same Day", exact: true }).check();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
  await expect(
    page.getByRole("textbox", { name: "Paragraph 2", exact: true }),
  ).toHaveCSS("text-decoration-line", "none");
  await expect(
    page.getByRole("textbox", { name: "Paragraph 2", exact: true }),
  ).toHaveCSS("color", "rgb(84, 127, 183)");
  await page.getByLabel("Notes", { exact: true }).fill("修改后的原计划。");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await nav(page, "Notes");
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "修改后的原计划。",
  );
  await expect(
    first.getByRole("button", { name: "Strikethrough", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    second.getByRole("radio", { name: "Same Day", exact: true }),
  ).toBeChecked();
  await first
    .getByRole("button", { name: "Strikethrough", exact: true })
    .click();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveCSS(
    "text-decoration-line",
    "none",
  );
  await nav(page, "Settings");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export all data (JSON)", exact: true })
    .click();
  const file = await (await downloadPromise).path();
  const { readFile } = await import("node:fs/promises");
  const backup = JSON.parse(await readFile(file!, "utf8"));
  expect(
    backup.records[0].payload.paragraphs.map(
      (p: { classification: string }) => p.classification,
    ),
  ).toEqual(["previousDay", "sameDay"]);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "Remove this device’s local data",
      exact: true,
    })
    .click();
  page.once("dialog", (d) => d.accept());
  await page.locator("input[type=file]").setInputFiles(file!);
  await expect(page.getByRole("status")).toContainText("Added 1");
  await nav(page, "Notes");
  await expect(
    second.getByRole("radio", { name: "Same Day", exact: true }),
  ).toBeChecked();
  await context.setOffline(false);
});

for (const [device, width, height] of [
  ["iPhone", 390, 844],
  ["iPad", 834, 1194],
  ["Mac", 1440, 1000],
] as const) {
  test(`${device}: 160% typography keeps all views and bilingual navigation usable in both themes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await enter(page);
    await nav(page, "Settings");
    await page
      .getByRole("button", { name: "Extra Large", exact: true })
      .click();
    for (const view of [
      "Daily planner",
      "Notes",
      "Calendar",
      "Overview",
      "Settings",
    ]) {
      await nav(page, view);
      await expect(page.getByRole("main")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.getByRole("button", { name: "中文 / English" }).click();
    const navigation = page.getByRole("navigation", {
      name: width < 768 ? "移动导航" : "主导航",
      exact: true,
    });
    for (const name of ["每日计划", "日记", "日历", "统计", "设置"]) {
      await navigation.getByRole("button", { name, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const button = navigation.getByRole("button", { name, exact: true });
      expect(
        await button.evaluate(
          (el) =>
            el.scrollHeight <= el.clientHeight &&
            el.scrollWidth <= el.clientWidth,
        ),
      ).toBe(true);
    }
    await expect(
      page.getByRole("heading", { name: "字体大小", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "填写日期颜色", exact: true }),
    ).toBeVisible();
  });
}

test("filled color/B&W PDFs retain manual labels, legend, paragraph colors and strike; blank has no labels", async ({
  page,
}, testInfo) => {
  await enter(page);
  await page
    .getByRole("button", { name: "Add Study sessions", exact: true })
    .click();
  await page
    .getByLabel("What would you like to do?", { exact: true })
    .fill("学习心血管 Cardiology");
  await page.getByRole("radio", { name: "Previous Day", exact: true }).check();
  await page
    .getByRole("button", { name: "Strikethrough", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await nav(page, "Notes");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("今天没有去图书馆，改为在家学习。");
  await page.getByRole("radio", { name: "Same Day", exact: true }).check();
  await nav(page, "Settings");
  await page.getByRole("button", { name: "Extra Large", exact: true }).click();
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByLabel("Language", { exact: true }).selectOption("zh");
  const print = page
    .getByRole("main")
    .getByRole("button", { name: "Print / PDF", exact: true });
  await print.click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-task b")).toHaveCSS(
    "color",
    "rgb(150, 114, 184)",
  );
  await expect(page.locator(".print-task b").locator("..")).toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
  await expect(page.locator(".print-journal p")).toHaveCSS(
    "color",
    "rgb(84, 127, 183)",
  );
  await expect(page.locator(".print-journal .print-label")).toHaveText(
    "当天填写",
  );
  await expect(page.locator("#print-pages .entry-legend")).toHaveCount(2);
  const color = await page.pdf({
    path: testInfo.outputPath("formatted-color-zh.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect((await PDFDocument.load(color)).getPageCount()).toBeGreaterThanOrEqual(
    2,
  );
  await page.emulateMedia({ media: "screen" });
  await page.getByLabel("Print mode", { exact: true }).selectOption("bw");
  await print.click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-task b")).toHaveCSS(
    "color",
    "rgb(0, 0, 0)",
  );
  await expect(page.locator(".print-task .print-label")).toHaveText(
    "前一天填写",
  );
  const bw = await page.pdf({
    path: testInfo.outputPath("formatted-bw-zh.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect((await PDFDocument.load(bw)).getPageCount()).toBeGreaterThanOrEqual(2);
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("checkbox", { name: "Blank, for handwriting" }).check();
  await print.click();
  await expect(
    page.locator("#print-pages .entry-legend, #print-pages .print-label"),
  ).toHaveCount(0);
});

test("formatted note conflict keeps both versions editable before combining, including strikethrough and manual labels", async ({
  page,
}) => {
  await enter(page);
  await nav(page, "Notes");
  await page.getByLabel("Notes", { exact: true }).fill("Local plan");
  await page.getByRole("radio", { name: "Previous Day", exact: true }).check();
  await page
    .getByRole("button", { name: "Strikethrough", exact: true })
    .click();
  await page.waitForTimeout(200);
  // Emulate the same IDB conflict envelope produced by SyncEngine after a stale write.
  await page.evaluate(async () => {
    const req = indexedDB.open("daylight-v1");
    const db = await new Promise<IDBDatabase>((resolve) => {
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("records", "readwrite"),
        store = tx.objectStore("records");
      const all = store.getAll();
      all.onsuccess = () => {
        const local = all.result.find((r) => r.kind === "note");
        store.put({
          ...local,
          conflict: {
            ...local,
            revision: 1,
            last_mutation: crypto.randomUUID(),
            updated_at: new Date().toISOString(),
            payload: {
              ...local.payload,
              text: "Remote reflection",
              paragraphs: [
                {
                  id: crypto.randomUUID(),
                  text: "Remote reflection",
                  classification: "sameDay",
                  strikethrough: false,
                },
              ],
            },
          },
        });
      };
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.reload();
  await nav(page, "Notes");
  await page.getByRole("button", { name: /Review conflicts/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("textbox", {
      name: "Save combined note · Paragraph 1",
      exact: true,
    }),
  ).toHaveValue("Local plan");
  await expect(
    dialog.getByRole("textbox", {
      name: "Save combined note · Paragraph 1",
      exact: true,
    }),
  ).toHaveCSS("text-decoration-line", "line-through");
  await dialog
    .getByRole("textbox", {
      name: "Save combined note · Paragraph 2",
      exact: true,
    })
    .fill("Edited remote reflection");
  await dialog
    .getByRole("button", { name: "Save combined note", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Local plan",
  );
  await expect(
    page.getByRole("textbox", { name: "Paragraph 2", exact: true }),
  ).toHaveValue("Edited remote reflection");
  await expect(
    page
      .getByRole("region", { name: "Paragraph 1", exact: true })
      .getByRole("radio", { name: "Previous Day", exact: true }),
  ).toBeChecked();
  await expect(
    page
      .getByRole("region", { name: "Paragraph 2", exact: true })
      .getByRole("radio", { name: "Same Day", exact: true }),
  ).toBeChecked();
});

test("long Chinese paragraphs flow onto PDF continuation pages at a larger print scale", async ({
  page,
}, testInfo) => {
  await enter(page);
  await nav(page, "Notes");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("学习计划与回顾。".repeat(600) + "最后一行 END-OF-JOURNAL");
  await page.getByRole("radio", { name: "Previous Day", exact: true }).check();
  await page
    .getByRole("button", { name: "Strikethrough", exact: true })
    .click();
  await nav(page, "Settings");
  await page.getByRole("button", { name: "Extra Large", exact: true }).click();
  await page
    .getByLabel("Print / PDF", { exact: true })
    .selectOption("notesOnly");
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page
    .getByRole("main")
    .getByRole("button", { name: "Print / PDF", exact: true })
    .click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-journal")).toContainText(
    "最后一行 END-OF-JOURNAL",
  );
  expect(
    await page
      .locator(".print-journal")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  const pdf = await page.pdf({
    path: testInfo.outputPath("long-chinese-formatted.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(2);
});

test("classification and strikethrough controls support keyboard actions with visible focus", async ({
  page,
}) => {
  await enter(page);
  await page
    .getByRole("button", { name: "Add Study sessions", exact: true })
    .click();
  const radio = page.getByRole("radio", { name: "Unmarked", exact: true });
  await radio.focus();
  await expect(radio).toBeFocused();
  await radio.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Previous Day", exact: true }),
  ).toBeChecked();
  const strike = page.getByRole("button", {
    name: "Strikethrough",
    exact: true,
  });
  await strike.focus();
  await expect(strike).toHaveCSS("outline-style", "solid");
  await strike.press("Space");
  await expect(strike).toHaveAttribute("aria-pressed", "true");
  await strike.press("Space");
  await expect(strike).toHaveAttribute("aria-pressed", "false");
  await page
    .getByLabel("What would you like to do?", { exact: true })
    .fill("Keyboard plan");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await nav(page, "Settings");
  const swatch = page.getByRole("button", {
    name: "Previous Day #438B89",
    exact: true,
  });
  await swatch.focus();
  await swatch.press("Space");
  await expect(swatch).toHaveAttribute("aria-pressed", "true");
});
