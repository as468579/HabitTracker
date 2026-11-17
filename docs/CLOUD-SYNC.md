# 雲端同步架構

- 前端：React Native Web / Expo；`src/cloud-store.ts` 負責 HTTP repository 與同步控制器，`src/useCloudStore.ts` 僅負責 React 訂閱與生命週期。
- 後端：`server/records-api.ts` 提供 GET / PUT `/api/records/tasks` 與 `/api/records/expenses`。
- 資料庫：Cloudflare D1，`account_records` 以 `(user_id, kind)` 為主鍵，資料和遞增 revision 共同儲存。
- 身分：正式環境只信任 Sites dispatch 提供的 `oai-authenticated-user-id`，未登入回 401。不能將這個 Worker 放在允許訪客自行偽造身分標頭的代理後方。
- 並行：PUT 必須提供讀取時的 revision，SQL 原子 compare-and-swap。衝突回 409 與最新資料，前端不自動重播覆寫；使用者確認後再操作。
- 儲存：收到資料庫成功回應才更新畫面及顯示成功。網路失敗會停止寫入並重新同步；延遲的舊 GET 不會蓋過新的寫入。
- 輪詢：每 10 秒、重新回到 App 時讀取雲端；這不是 WebSocket 即時推播。
- 起始：新帳號為空白，不預載範例、不自動匯入舊瀏覽器資料。外觀設定仍在本機。
- OpenClaw：正式 Worker 的 status 回 configured=false；未連接 agent，不會自動記帳。

## 建置與部署

使用 Node 24 執行 `npm run build:web`，依序清理 dist、Expo export、產生 service worker、編譯 Worker。

輸出為 `dist/client`（PWA）、`dist/server/index.js`（Worker）及 `dist/.openai`（hosting 與 migrations）。

Sites 來源 manifest 保留既有 project_id，移除 static，設定 `d1: "DB"`、`r2: null`。部署前由 Sites 套用 `drizzle/` 中的 SQL migration；正式 DB 由平台配置。`wrangler.json` 的資料庫 ID 是本機 placeholder，不是正式 ID。

## 本機預覽

`npm run preview:web` 僅監聽 127.0.0.1，使用 `.expo/preview-records.sqlite` 與固定 local-preview 身分。這是隔離的開發資料，與正式 D1 不同步；預覽不接受客戶端指定身分。不得將此 Node 預覽伺服器開放到公網。

## 測試

`npm test` 包含既有 domain / PWA / expenses / appearance 測試，以及 `tests/cloud.test.mjs`。
雲端 unit tests 使用 Node SQLite 真正執行 migration 和 SQL，檢查跨裝置往返、帳號隔離、並行 CAS、重設範圍、失敗與舊回應競爭、API 驗證與登入要求。
