# HabitTracker Web App

正式網址：https://habittracker.beneficiallapwing1.chatgpt.site/

這是 Expo / React Native Web PWA，可從 Safari 或 Chrome 的分享選單加入 iPhone 主畫面。登入同一個 ChatGPT 帳號即可在手機與電腦同步任務、完成紀錄、聊天及消費資料。

## 資料與離線

主要資料保存在遠端 D1 資料庫；字體與 Bright/Night 偏好保存在各裝置。每 10 秒及回到 App 時重新同步。新帳號從空白開始，不載入舊範例與舊網址的本機任務。

App 框架可快取並離線開啟；讀取和修改雲端資料需要網路。無法確認儲存或資料版本衝突時會顯示錯誤，請同步後再操作。清除任務會刪除雲端任務並同步到所有裝置。

## 開發與部署

使用 Node 24，執行 `npm install`、`npm run build:web`、`npm run preview:web`。詳見 [雲端同步架構](CLOUD-SYNC.md)。本機預覽的 SQLite 和固定測試身分與正式環境分離。

Sites 已發布且維持 owner-private。部署 checkout 為 `.sites/slowday-online/.sites-checkout`，沿用原 project_id；目前 URL 與部署資訊在 `.sites/live-deployment.json`。Worker 使用 D1 binding DB 和 ASSETS 靜態資源，不能只上傳 dist/client 就啟用同步。

OpenClaw 依使用者要求保持未安裝、未設定；聊天只保存待處理訊息，可手動記帳。

目前已提供 iPhone PWA 圖示與設定，尚未代使用者完成 iPhone 主畫面實機安裝。
