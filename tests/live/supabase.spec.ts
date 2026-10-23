// Explicit opt-in: real hosted Supabase + dedicated disposable test accounts.
// This is not included in test:e2e and is not claimed as executed without credentials.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const day = "2099-12-20";
async function login(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password (12+ characters)", { exact: true })
    .fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Saved to cloud", { exact: true })).toBeVisible();
  await page.locator("#selected-day").fill(day);
}
async function notes(page: Page) {
  const nav =
    page.viewportSize()!.width < 768
      ? page.getByRole("navigation", { name: "Mobile navigation" })
      : page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: "Notes", exact: true }).click();
}
test("real hosted cloud: three sessions, offline convergence, conflicts and a second user", async ({
  browser,
}) => {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    for (const [width, height] of [
      [390, 844],
      [834, 1194],
      [1440, 1000],
    ]) {
      const context = await browser.newContext({ viewport: { width, height } });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      await login(
        page,
        process.env.PLANNER_TEST_EMAIL!,
        process.env.PLANNER_TEST_PASSWORD!,
      );
    }
    const [phone, pad, mac] = pages;
    const title = `Live sync ${crypto.randomUUID()}`;
    await phone
      .getByRole("button", { name: "Add Reminders & to-dos", exact: true })
      .click();
    await phone
      .getByLabel("What would you like to do?", { exact: true })
      .fill(title);
    await phone.getByRole("button", { name: "Save", exact: true }).click();
    await expect(pad.getByText(title, { exact: true })).toBeVisible();
    await expect(mac.getByText(title, { exact: true })).toBeVisible();
    for (const page of pages) await notes(page);
    await mac.getByLabel("Notes", { exact: true }).fill("Live test base");
    await expect(
      mac.getByText("Saved to cloud", { exact: true }),
    ).toBeVisible();
    await expect(phone.getByLabel("Notes", { exact: true })).toHaveValue(
      "Live test base",
    );
    await expect(pad.getByLabel("Notes", { exact: true })).toHaveValue(
      "Live test base",
    );
    await contexts[0].setOffline(true);
    await contexts[1].setOffline(true);
    await phone
      .getByLabel("Notes", { exact: true })
      .fill("Phone offline paragraph 中文");
    await pad
      .getByLabel("Notes", { exact: true })
      .fill("iPad offline paragraph");
    await expect(
      phone.getByText("Offline · saved on this device", { exact: true }),
    ).toBeVisible();
    await contexts[0].setOffline(false);
    await expect(
      phone.getByText("Saved to cloud", { exact: true }),
    ).toBeVisible();
    await contexts[1].setOffline(false);
    await expect(
      pad.getByRole("button", { name: /Review conflicts/ }),
    ).toBeVisible();
    await pad.getByRole("button", { name: /Review conflicts/ }).click();
    await expect(
      pad.locator("dialog pre").filter({ hasText: "Phone offline paragraph" }),
    ).toBeVisible();
    await expect(
      pad.locator("dialog pre").filter({ hasText: "iPad offline paragraph" }),
    ).toBeVisible();
    await pad
      .getByRole("button", { name: "Save combined note", exact: true })
      .click();
    await expect(mac.getByLabel("Notes", { exact: true })).toHaveValue(
      /Phone offline paragraph/,
    );
    await expect(mac.getByLabel("Notes", { exact: true })).toHaveValue(
      /iPad offline paragraph/,
    );
    const client = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const first = await client.auth.signInWithPassword({
      email: process.env.PLANNER_TEST_EMAIL!,
      password: process.env.PLANNER_TEST_PASSWORD!,
    });
    if (first.error)
      throw new Error("First test account authentication failed");
    const firstId = first.data.user!.id;
    await client.auth.signOut();
    const second = await client.auth.signInWithPassword({
      email: process.env.PLANNER_OTHER_EMAIL!,
      password: process.env.PLANNER_OTHER_PASSWORD!,
    });
    if (second.error)
      throw new Error("Second test account authentication failed");
    const foreign = await client
      .from("planner_records")
      .select("id")
      .eq("user_id", firstId);
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
    const history = await client
      .from("planner_history")
      .select("id")
      .eq("user_id", firstId);
    expect(history.error).toBeNull();
    expect(history.data).toEqual([]);
    const wrongOwner = await client.rpc("save_planner_record", {
      p_user_id: firstId,
      p_id: crypto.randomUUID(),
      p_kind: "note",
      p_day: day,
      p_payload: { text: "forbidden" },
      p_deleted: false,
      p_expected_revision: 0,
      p_mutation: crypto.randomUUID(),
    });
    expect(wrongOwner.error).toBeTruthy();
    await client.auth.signOut();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
