import { readdir, readFile, writeFile } from "node:fs/promises";
const info = JSON.parse(await readFile("dist/version.json", "utf8"));
const files = (await readdir("dist", { recursive: true }))
  .filter(
    (file) =>
      /\.(html|js|css|png|webmanifest|woff2?)$/.test(file) && file !== "sw.js",
  )
  .sort()
  .map((file) => "/" + file);
const template = await readFile(
  new URL("./sw-template.js", import.meta.url),
  "utf8",
);
await writeFile(
  "dist/sw.js",
  template
    .replace("__BUILD__", JSON.stringify(info.buildId))
    .replace("__FILES__", JSON.stringify(files)),
);
console.log(
  `Generated offline shell: ${files.length} files, build ${info.buildId}`,
);
