import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "tests/updates",
  timeout: 45000,
  outputDir: "pwa-test-results",
  use: { ...base.use, baseURL: "http://127.0.0.1:4174" },
  webServer: {
    command: "npm run check && node scripts/serve-pwa-tests.mjs",
    url: "http://127.0.0.1:4174/version.json",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
