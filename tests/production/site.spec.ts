import { test, expect } from "@playwright/test";
test("production responds over HTTPS with login UI and security headers", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).protocol).toBe("https:");
  const headers = await response!.allHeaders();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("production manifest, icons and service worker are served", async ({
  page,
}) => {
  await page.goto("/");
  const data = await page.evaluate(async () => {
    const response = await fetch("/manifest.webmanifest");
    const manifest = await response.json();
    const icons = await Promise.all(
      manifest.icons.map(async (icon: { src: string }) => ({
        src: icon.src,
        status: (await fetch(icon.src)).status,
      })),
    );
    const sw = await fetch("/sw.js");
    return {
      status: response.status,
      manifest,
      icons,
      swStatus: sw.status,
      swCache: sw.headers.get("cache-control"),
    };
  });
  expect(data.status).toBe(200);
  expect(data.manifest.display).toBe("standalone");
  expect(data.icons.length).toBeGreaterThanOrEqual(2);
  for (const icon of data.icons) expect(icon.status).toBe(200);
  expect(data.swStatus).toBe(200);
  expect(data.swCache).toContain("no-cache");
  await page.evaluate(() => navigator.serviceWorker.ready);
});
