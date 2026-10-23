import { readdir, readFile, writeFile } from "node:fs/promises";
const directory = process.argv[2] || "dist";
const info = JSON.parse(await readFile(`${directory}/version.json`, "utf8"));
const files = (await readdir(directory, { recursive: true }))
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
  `${directory}/sw.js`,
  template
    .replace("__BUILD__", JSON.stringify(info.buildId))
    .replace("__FILES__", JSON.stringify(files)),
);
console.log(
  `Generated offline shell: ${files.length} files, build ${info.buildId}`,
);
