# HabitTracker

以 Expo SDK 58、React Native Web、TypeScript 與 Expo Router 製作的任務追蹤 Web App。支援手機與桌面瀏覽器、加入主畫面與完成首次快取後的離線使用。

主要操作與部署方式見 [Web App 說明](WEB-APP.md)。網站資料保存在目前瀏覽器與網址，未提供雲端同步。

## 啟動

需要 Node.js **22.13+**（建議 Node 24 LTS）。

```sh
npm install
npm start
```

使用相容 SDK 58 的 Expo Go，或 Expo development build 開啟手機版本。`npm run android` 可開啟已設定好的 Android 模擬器；iOS 模擬器需要 macOS。網頁預覽執行 `npm run web`。

正式網頁版執行 `npm run build:web`，再執行 `npm run preview:web` 以 http://localhost:8083 檢視。發佈時將 dist/ 部署至 HTTPS 網站即可。

## 功能與規則

- 繁體中文、手機底部導覽及桌面側邊導覽。
- 新增、編輯、刪除任務，生活／健康／學習／工作分類及文字搜尋。
- 每日、每週、每月各完成一次；週一是每週起點，每月一日是每月起點，依裝置當地日期計算。
- 勾選或取消完成，歷史週期可補登。新增任務僅從建立當期開始計算，不會增加過往分母。
- Dashboard 顯示相同頻率的任務總數、已完成、待完成、完成率與最近七個週期趨勢。例如「每週」統計每週任務，不包含每日任務。
- 年度活躍方格圖：每格一天，依當天每日任務完成比例顯示 4 段綠色，附年度完成數、活躍天數與年度最長連續達標。
- Daily Routine 月曆：顯示全部完成／部分完成／未完成，可點選日期查看與補登每日任務，並同步更新方格圖及統計。未來日期不可勾選；未安排任務的日期不計入月曆達標分母。
- 連續達標計算所有每日任務都完成的連續天數；今天未達標時，從昨天往前算。
- 編輯時保留頻率，避免歷史紀錄與週期產生矛盾。如需不同頻率，另建任務。
- AsyncStorage 本機保存，無帳號、後端與跨裝置同步。讀取失敗時停止寫入以保護既有資料；寫入失敗會提示重試。
- 首次開啟載入有標示的範例資料。按「開始使用」並確認後清空，建立個人任務。

## 驗證

```sh
npm run typecheck
npm run lint
npm test
npm run build:web
```

核心週期與統計邏輯位於 `src/domain.ts`，畫面位於 `src/TrackerApp.tsx`，路由位於 `src/app/`。測試涵蓋跨年週期、閏年、每月月底、重複任務重置、歷史統計、連續天數及資料讀取。

目前為本機 App 初版，未加入推播、登入或雲端同步。已加入 EAS 商店建置設定與隱私頁，但尚未產生簽署安裝包或上架；仍需發行者帳號、正式資料及實機驗證。

## 記帳聊天室

導覽列「記帳室」可進出並保留聊天、保存待處理訊息、手動記帳與管理消費明細。OpenClaw 依需求保持未安裝、連線資料留空；不會將未處理訊息顯示成已記帳。串接說明見 [OpenClaw 記帳室](OPENCLAW-EXPENSES.md)。

## 商店發布準備

完整操作步驟見 [Google Play / Apple App Store 上架說明](STORE-RELEASE.md)，商店文案及隱私權政策草稿也在 `docs/`。正式識別碼與客服資料透過 `.env.example` 列出的環境變數設定；`npm run release:check` 會列出尚未完成的欄位。未填寫完整時，production 建置會停止並提示。

技術參考：[Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)、[Expo Router](https://docs.expo.dev/router/installation/)。
