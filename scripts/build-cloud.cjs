/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const client = path.join(output, "client");
fs.mkdirSync(client, { recursive: true });
for (const name of fs.readdirSync(output)) {
  if (name !== "client")
    fs.renameSync(path.join(output, name), path.join(client, name));
}
const server = path.join(output, "server");
fs.mkdirSync(server, { recursive: true });
for (const [source, name] of [
  ["src/domain.ts", "domain.js"],
  ["src/expenses.ts", "expenses.js"],
  ["server/records-api.ts", "records-api.js"],
]) {
  const code = ts
    .transpileModule(fs.readFileSync(path.join(root, source), "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replaceAll("../src/domain.ts", "./domain.js")
    .replaceAll("../src/expenses.ts", "./expenses.js");
  fs.writeFileSync(path.join(server, name), code);
}
fs.writeFileSync(
  path.join(server, "index.js"),
  fs
    .readFileSync(path.join(root, "worker/index.js"), "utf8")
    .replace("../server/records-api.ts", "./records-api.js"),
);
fs.writeFileSync(
  path.join(server, "wrangler.json"),
  JSON.stringify(
    {
      name: "habittracker",
      main: "index.js",
      compatibility_date: "2026-11-18",
      assets: {
        directory: "../client",
        binding: "ASSETS",
        run_worker_first: true,
      },
      d1_databases: [
        {
          binding: "DB",
          database_name: "habittracker",
          database_id: "00000000-0000-4000-8000-000000000000",
        },
      ],
    },
    null,
    2,
  ),
);
const metadata = path.join(output, ".openai");
fs.mkdirSync(metadata, { recursive: true });
const manifestPath = path.join(root, ".openai/hosting.json");
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : {};
delete manifest.static;
fs.writeFileSync(
  path.join(metadata, "hosting.json"),
  JSON.stringify({ ...manifest, d1: "DB", r2: null }, null, 2),
);
fs.cpSync(path.join(root, "drizzle"), path.join(metadata, "drizzle"), {
  recursive: true,
});
console.log("Cloud build ready: Worker API, D1 migration and PWA assets.");
