const fs = require("node:fs");
const { validateReleaseEnvironment } = require("./release-config.cjs");
// This script expects env vars in the current shell; it does not load .env files.
const problems = validateReleaseEnvironment(process.env);
const app = JSON.parse(fs.readFileSync("app.json", "utf8")).expo;
const project = process.env.EAS_PROJECT_ID || app.extra?.eas?.projectId;
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    project || "",
  )
)
  problems.push(
    "請先執行 eas init 連結 Expo 專案，或設定正確的 EAS_PROJECT_ID。",
  );
for (const file of [
  "assets/icon.png",
  "assets/android-icon-foreground.png",
  "eas.json",
  "docs/store-listing.zh-TW.md",
]) {
  if (!fs.existsSync(file)) problems.push(`缺少檔案：${file}`);
}
if (problems.length) {
  console.error(
    "尚無法啟動正式版發布：\n" + problems.map((p) => `- ${p}`).join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    "本機發布設定已完整。仍須確認帳號、簽署、公開網址內容、實機測試及商店問卷；這項檢查不代表已建置或通過審核。",
  );
