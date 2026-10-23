import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import { remoteTarget, remoteProxy } from "./tests/support/remote-target";
const origin = remoteTarget(
  process.env.PLANNER_BASE_URL ||
    "https://personal-life-planner-omega.vercel.app",
);
export default defineConfig({
  ...base,
  testDir: "tests",
  testMatch: ["e2e/**/*.spec.ts", "production/**/*.spec.ts"],
  timeout: 20000,
  outputDir: "production-test-results",
  use: {
    ...base.use,
    baseURL: origin,
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: { ...base.use?.launchOptions, proxy: remoteProxy() },
  },
  webServer: undefined,
});
