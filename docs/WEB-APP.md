# HabitTracker Web App

目前主要交付為瀏覽器版 Web App，沿用 React Native Web 與 Expo Router。原生商店設定保留作為未來選項，使用 Web App 不需要 Apple / Google 開發者帳號。

## 本機開發

需要 Node 24 LTS（至少 22.13）。

```sh
npm install
npm run web
```

開發模式不註冊 service worker，以免快取干擾修改。正式 PWA 請先建置：

```sh
npm run build:web
npm run preview:web
```

開啟 http://localhost:8083。預覽指令僅監聽本機，不會對外公開。建置結果在 dist/，任務管理與手動記帳可使用靜態網站主機。若要啟用 OpenClaw 自動記帳，還需要 `server/` 中的同來源 Node API；單獨上傳 dist/ 不會提供這個 API。網址根目錄必須對應 dist/。privacy/index.html 支援直接開啟隱私頁。

## 安裝到主畫面

- iPhone / iPad：以 Safari 或 Chrome 開啟 HTTPS 網址並登入，點「分享」→「加入主畫面」；若有「以網頁 App 開啟」，保持開啟後按「新增」。回到主畫面點圖示使用。
- Android：以 Chrome 開啟，從瀏覽器選單安裝或加入主畫面。
- 電腦：Chrome / Edge 若支援安裝，可使用網址列或瀏覽器選單的安裝選項。
- 設定頁提供操作說明；只有瀏覽器發出安裝提示事件時，才顯示直接安裝按鈕。不同瀏覽器選項可能不同。

## 離線與更新

首次需連線開啟正式網站。設定頁顯示「已備妥離線使用」後，代表此版本的網頁資源已完成快取；快取仍可能被瀏覽器清理，不能保證永久離線可用。主機身分驗證也可能需要網路。

每次建置由檔案內容產生新的快取版本。只快取該版本的 App 靜態檔，不快取第三方網站、API 或登入頁。新版本準備好時會顯示更新提示，由使用者選擇重新載入。更新不會主動刪除任務資料。

## 資料範圍

任務透過 AsyncStorage 的網頁儲存保存在**目前瀏覽器及網址**，尚無雲端同步。localhost:8082、localhost:8083 與正式網站各自獨立。首次開啟新網址會看到自己的範例資料，不會自動搬移其他網址的紀錄。

清除網站資料、無痕模式或瀏覽器自動清理可能移除紀錄。此版本沒有跨分頁即時同步；避免在多個分頁同時修改同一份資料。

## Sites 部署

已部署至 https://slowday-daily-tracker.beneficiallapwing1.chatgpt.site，維持 owner-private。部署來源位於 `.sites/slowday-online/.sites-checkout`，網站身份位於其 `.openai/hosting.json`；目前部署資訊記錄在 `.sites/live-deployment.json`。主要編輯來源仍在工作區根目錄，更新時先開啟並同步既有網站來源，再同步最新程式與 dist/，沿用同一 project_id。

若改用自己的 HTTPS 主機，部署 dist/ 即可；網站使用者是否需登入取決於主機存取設定。改網址會使用另一份瀏覽器資料空間。

技術參考：[Expo PWA](https://docs.expo.dev/guides/progressive-web-apps/)。目前尚未進行 iPhone 主畫面實機安裝驗證。
