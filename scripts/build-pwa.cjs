/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "../dist");
// Each public route receives a direct-navigation shell and is precached.
for (const route of ["privacy"]) {
  fs.mkdirSync(path.join(root, route), { recursive: true });
  fs.copyFileSync(
    path.join(root, "index.html"),
    path.join(root, route, "index.html"),
  );
}
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    );
}
const template = fs.readFileSync(
  path.join(__dirname, "service-worker.template.js"),
  "utf8",
);
const assets = files(root)
  .filter(
    (file) =>
      /\.(html|js|css|ttf|png|ico|webmanifest)$/.test(file) &&
      !file.endsWith(`${path.sep}sw.js`),
  )
  .sort();
const hash = crypto.createHash("sha256").update(template);
for (const file of assets)
  hash.update(path.relative(root, file)).update(fs.readFileSync(file));
const paths = assets.map(
  (file) => "/" + path.relative(root, file).split(path.sep).join("/"),
);
const code = template
  .replace("__CACHE_NAME__", "slowday-shell-" + hash.digest("hex").slice(0, 16))
  .replace(
    "const PRECACHE = __PRECACHE__;",
    `const PRECACHE = ${JSON.stringify(paths)};`,
  );
fs.writeFileSync(path.join(root, "sw.js"), code);
console.log(
  `PWA ready: ${paths.length} app-shell assets, manifest and direct privacy route.`,
);
