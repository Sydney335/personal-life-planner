// Local test fixture only. Builds two real releases and switches deployment on one origin.
import { spawnSync } from "node:child_process";
import { build as viteBuild } from "vite";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
for (const build of ["A", "B"]) {
  const directory = `.pwa-builds/${build}`;
  await mkdir(directory, { recursive: true });
  process.env.DAYLIGHT_BUILD_ID = `pwa-${build}`;
  process.env.VITE_SUPABASE_URL = "";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "";
  await viteBuild({
    build: { outDir: directory },
    plugins: [
      {
        name: "test-css-release",
        enforce: "pre",
        transform(code, id) {
          if (id.endsWith("/src/styles.css"))
            return code + `\n:root { --pwa-test-build: pwa-${build}; }`;
        },
      },
    ],
  });
  const result = spawnSync(
    process.execPath,
    ["scripts/build-sw.mjs", directory],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
let deployment = "A";
let broken = false;
let checks = 0;
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};
createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/__test/deploy" && request.method === "POST") {
    deployment = url.searchParams.get("build") === "B" ? "B" : "A";
    broken = url.searchParams.has("broken");
    checks = 0;
    response.end("ok");
    return;
  }
  if (url.pathname === "/__test/state") {
    response.end(JSON.stringify({ deployment, checks }));
    return;
  }
  if (url.pathname === "/version.json") checks++;
  if (broken && url.pathname.startsWith("/assets/")) {
    response.writeHead(503);
    response.end("temporary download failure");
    return;
  }
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  const root = resolve(`.pwa-builds/${deployment}`);
  const file = resolve(root, `.${path}`);
  if (!file.startsWith(root + "/")) {
    response.writeHead(403);
    response.end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "Cache-Control": path.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
}).listen(4174, "127.0.0.1");
