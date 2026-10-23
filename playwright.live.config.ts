import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
for (const key of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "PLANNER_TEST_EMAIL",
  "PLANNER_TEST_PASSWORD",
  "PLANNER_OTHER_EMAIL",
  "PLANNER_OTHER_PASSWORD",
]) {
  if (!process.env[key])
    throw new Error(
      `Live validation requires ${key} in the secure process environment. Do not put test credentials in source control.`,
    );
}
export default defineConfig({
  ...base,
  testDir: "tests/live",
  timeout: 120000,
  expect: { timeout: 25000 },
  use: { ...base.use, trace: "off", screenshot: "off", video: "off" },
});
