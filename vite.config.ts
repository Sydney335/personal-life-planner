import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
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
  return {
    plugins: [react()],
    server: { host: "0.0.0.0" },
    build: { sourcemap: false },
  };
});
