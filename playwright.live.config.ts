import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import { remoteTarget, remoteProxy } from "./tests/support/remote-target";
const external = process.env.PLANNER_BASE_URL
  ? remoteTarget(process.env.PLANNER_BASE_URL)
  : undefined;
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
  use: {
    ...base.use,
    baseURL: external ?? base.use?.baseURL,
    launchOptions: {
      ...base.use?.launchOptions,
      proxy: external ? remoteProxy() : undefined,
    },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: external ? undefined : base.webServer,
  outputDir: "live-test-results",
});
