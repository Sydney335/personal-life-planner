import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
export default defineConfig(({ mode }) => {
  const config = loadEnv(mode, process.cwd(), "VITE_");
  const key = config.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  let role = "";
  if (key.split(".").length === 3) {
    try {
      role = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      ).role;
    } catch {
      /* Supabase will validate malformed public tokens. */
    }
  }
  if (key.startsWith("sb_secret_") || role === "service_role")
    throw new Error(
      "Refusing a private Supabase key in public frontend configuration. Use a publishable/anon key.",
    );
  const info = {
    version: JSON.parse(readFileSync("package.json", "utf8")).version as string,
    buildId:
      process.env.DAYLIGHT_BUILD_ID ||
      `${(process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 12)}-${randomUUID().slice(0, 8)}`,
    builtAt: new Date().toISOString(),
  };
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(info.buildId))
    throw new Error("Invalid build identifier");
  return {
    define: { __APP_INFO__: JSON.stringify(info) },
    plugins: [
      react(),
      {
        name: "daylight-build-info",
        transformIndexHtml: () => [
          {
            tag: "meta",
            attrs: { name: "daylight-build", content: info.buildId },
            injectTo: "head" as const,
          },
        ],
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "version.json",
            source: JSON.stringify(info),
          });
        },
      },
    ],
    server: { host: "0.0.0.0" },
    build: { sourcemap: false },
  };
});
