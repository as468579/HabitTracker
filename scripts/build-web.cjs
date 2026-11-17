/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const output = path.resolve(root, "dist");
if (path.dirname(output) !== root) throw new Error("Invalid build output");
fs.rmSync(output, { recursive: true, force: true });
for (const args of [
  ["node_modules/expo/bin/cli", "export", "--platform", "web"],
  ["scripts/build-pwa.cjs"],
  ["scripts/build-cloud.cjs"],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
