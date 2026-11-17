# Google Play / Apple App Store 上架步驟

核對日期：2026-11-08。此專案已準備 EAS 建置設定、商店文案草稿及 App 內隱私頁，但**尚未建立開發者帳號、連結 EAS 專案、產生簽署 AAB/IPA 或提交商店**。Metro 匯出成功代表 JavaScript 打包通過，不等於原生建置成功或通過商店審核。

## 1. 申請帳號

| 服務                                                                    | 要做什麼                                          | 費用                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| [Expo](https://expo.dev/signup)                                         | 建立帳號，供雲端編譯及簽署管理                    | 可先用免費方案；用量、佇列及付費方案依申請當時頁面 |
| [Apple Developer Program](https://developer.apple.com/programs/enroll/) | 使用 Apple 帳號，完成雙重認證、身分核實並加入計畫 | 標準費用 US$99／年；地區幣別及稅額以結帳頁為準     |
| [Google Play Console](https://play.google.com/console/signup)           | 選擇個人或組織帳號，完成身分、聯絡資料及裝置驗證  | US$25 一次性註冊費；以註冊頁為準                   |

以本人／公司持有帳號；個人與組織會影響公開發行者資料。組織帳號可能需要公司驗證及 D-U-N-S 等資料，照官方註冊流程提供。密碼、金鑰及身分證件請直接交給官方介面，不要寫入 Git。

## 2. 決定正式名稱及識別碼

名稱目前為「HabitTracker」，可以再改。設定發行者擁有且不與既有 App 衝突的反向網域識別碼。iOS bundle identifier 與 Android package 名稱在上架後不宜更換。

複製 `.env.example` 成 `.env.local`，填寫所有欄位。`SLOWDAY_APP_ID` 會同時作為兩個平台的識別碼；這裡不預設臨時正式識別碼。

- SLOWDAY_APP_ID：已確認的正式識別碼。
- EXPO_PUBLIC_PUBLISHER_NAME：正式發行者名稱。
- EXPO_PUBLIC_SUPPORT_EMAIL：可公開的客服信箱。
- EXPO_PUBLIC_PRIVACY_URL：公開政策 HTTPS 網址。
- EXPO_PUBLIC_SUPPORT_URL：公開客服／支援 HTTPS 網址。
- EAS_PROJECT_ID：下一步連結後取得的 UUID；若已由 EAS 寫入 app.json 的 extra.eas.projectId 可免填。

所有 `EXPO_PUBLIC_` 值會包進 App，不能放密碼。`npm run release:check` 讀取目前 shell 環境，不會自行載入 .env.local；請將相同設定放到 shell，或在支援 Node 24 的環境以 `node --env-file=.env.local scripts/check-release.cjs` 執行。

## 3. 連結 Expo 專案

安裝 Node 24 LTS，在本專案目錄執行：

```sh
npm install
npx eas-cli@latest login
npx eas-cli@latest init
```

保留 CLI 寫入的專案 ID。如 CLI 無法自動更新動態設定，將回傳的 ID 設為 EAS_PROJECT_ID。`app.config.js` 會保留 app.json 的既有 extra.eas.projectId。

在 Expo 專案的 Environment variables 設定 **preview** 與 **production** 環境，填入上述資料。SLOWDAY_APP_ID 與 EAS_PROJECT_ID 是公開設定，可設為 plain text，讓本機設定解析也能取得；本機 .env.local 仍須保有相同值。勿直接執行會覆寫已準備 eas.json 的設定範本。

## 4. 先完成手機測試

```sh
npm run typecheck
npm run lint
npm test
npm run build:preview:android
```

Android preview 產生可直接安裝的 APK。iOS 建議正式簽署後使用 TestFlight；preview 的 iOS internal distribution 通常需要註冊裝置與對應的簽署設定。

在 Android 真機及 iPhone 測試：首次啟動、範例清除、日／週／月任務、編輯／刪除／搜尋、勾選／取消、跨日跨月、背景返回、離線、關閉重開、資料清除、鍵盤遮擋及字體放大。支援 iPad 時也要測試 iPad。

## 5. 建立商店用安裝包

先完成環境欄位與 EAS 連結，再執行：

```sh
node --env-file=.env.local scripts/check-release.cjs
```

確認通過後，把相同變數載入目前 shell，再執行：

```sh
npm run build:stores
```

或在 Node 24 直接載入檔案啟動 CLI（production 雲端環境也須有同樣設定）：

```sh
node --env-file=.env.local --run build:stores
```

依 EAS 提示處理 Apple 簽章、Android keystore。不要遺失 Android 上傳金鑰；可使用 EAS 憑證管理與 Play App Signing。第一次建置會初始化遠端 build number / version code，之後設定自動遞增。

Android 輸出為 AAB，iOS 為 IPA。可在 Windows 使用 EAS 雲端產生 iOS 版本，無需在這台電腦安裝 Xcode；本機 iOS 模擬器仍需要 Mac。建置額度及費用依 Expo 帳號方案。

## 6. 準備商店內容

使用 `docs/store-listing.zh-TW.md` 作為名稱、副標、完整介紹、關鍵字與審核說明草稿。使用 `docs/privacy-policy-draft.zh-TW.md` 補齊真實聯絡資訊後公開成 HTTPS 網頁；App 內的政策也需與公開版本一致。

準備實際原生 App 的手機／平板截圖與商店宣傳素材。網頁版截圖不是原生實機驗證證明。圖片尺寸、目標 Android API、iOS/Xcode 最低要求，送審當天以各商店最新表單為準；必要時升級 Expo SDK 及 EAS 建置映像。

在兩個平台完成隱私資訊、Data safety、內容分級、受眾及其他適用問卷。目前程式沒有登入、廣告、追蹤與後端；仍須檢查**最終原生產物及其 SDK** 後回答，不可僅依本機儲存就自動勾選「未收集資料」。iOS privacy manifest 與 required-reason API 宣告應查看實際建置與 SDK 合併結果，再處理 Apple 提示。

## 7. Google Play 流程

1. 在 Play Console 建立 App，完成商店資訊與政策表單。
2. **第一次 Android 提交，先手動上傳 AAB 到 Play Console**，建立首次版本，以符合 Google Play API 的首次提交限制。
3. 先做內部測試，再做帳號所需的封閉測試。本專案的 EAS Submit 設定為 internal／draft，送出後仍需到 Console 完成測試發布流程。
4. 新個人帳號若適用目前規則：至少 **12 位測試者持續加入封閉測試 14 天**，之後申請 production access。內部測試不能取代這項要求；是否適用以自己的 Console 為準。
5. 後續可設定 Google service account 權限並將金鑰安全交給 EAS，執行 `npm run submit:android`。CLI 會讓你選擇建置；先核對版本。
6. 取得 production access、完成審核及發布設定後，才會正式公開。

## 8. Apple App Store 流程

1. 在 App Store Connect 建立 App，選擇與正式 bundle identifier 一致的 App ID。
2. 執行 `npm run submit:ios`，依提示選擇建置及設定 Apple 提交憑證／App Store Connect App ID。可交由 EAS 安全管理 API key，勿提交到版本庫。
3. 在 TestFlight 等待處理完成後測試；邀請外部測試者時可能需要 beta review。
4. 到 App Store Connect 補齊截圖、App Privacy、聯絡資訊、分級、出口合規等適用表單，選擇正確 build。
5. 提交 App Review，設定核准後手動或自動發布。上傳到 TestFlight 不代表 App Store 已上架。

## 官方參考

- [Expo Build](https://docs.expo.dev/build/setup/)、[eas.json 設定](https://docs.expo.dev/eas/json/)
- [Expo 提交 Google Play](https://docs.expo.dev/submit/android/)、[提交 Apple](https://docs.expo.dev/submit/ios/)
- [Apple 帳號申請](https://developer.apple.com/programs/enroll/)、[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google 帳號與費用](https://support.google.com/googleplay/android-developer/answer/6112435)、[新個人帳號測試要求](https://support.google.com/googleplay/android-developer/answer/14151465)
