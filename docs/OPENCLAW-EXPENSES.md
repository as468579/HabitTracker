# OpenClaw 記帳室

依使用者要求，**不安裝、不啟動 OpenClaw，也不填入連線資料**。`.env.openclaw.example` 三個欄位均留空。現在可使用聊天進出、待處理訊息保存、手動記帳、消費編輯／刪除，以及今日／本月 TWD 支出統計。

## 現在的行為

- 導覽列「記帳室」→「進入記帳聊天室」；用離開按鈕回到入口，歷史訊息會保留。
- 例如輸入「午餐 120，咖啡 65」。未設定 OpenClaw 時只保存為待處理，不會猜測或假裝自動記錄。
- 「手動新增」可直接記帳；手動與 OpenClaw 來源分別標示。
- 品項、正數金額、有效日期及分類皆必須完整；目前只支援 TWD。
- 金額內部使用整數分，避免浮點加總誤差。辨識回傳若有任一筆錯誤，整批不記錄。
- agent 成功回傳並保存後才顯示「已記錄」。同一訊息重試有固定 ID，避免重複入帳。新送出的相同文字視為另一筆指令，不會依文字內容自動去重。
- 語意不明由 agent 呼叫 ask_clarification，待使用者補充。預算、退款、修改或查詢不當成新消費；修改與刪除先使用明細介面。

## 架構

`瀏覽器 → 同來源 /api/expenses/chat → server/openclaw.cjs → OpenClaw /v1/responses → 結構化結果驗證 → 瀏覽器保存明細及回覆`

`record_expenses` 和 `ask_clarification` 是此 App 提供的函數工具。OpenClaw 產生函數呼叫結果，App 驗證後負責保存；不依賴 agent 自稱「完成」的自然語言，也不讓它直接修改瀏覽器儲存或執行程式。

伺服器不保存支出帳本與聊天紀錄，資料仍在瀏覽器，因此跨裝置同步尚未實作。Gateway 自身及模型供應商可能保存請求；以使用者配置為準。網站的「清除所有任務資料」不會影響記帳資料。

## 未來連線時再填

這次不需要執行以下設定。安裝 OpenClaw 並選好**專用記帳 agent** 後：

1. 將 `.env.openclaw.example` 複製成 `.env.openclaw.local`。
2. 僅在本機填入 `OPENCLAW_GATEWAY_URL`、`OPENCLAW_GATEWAY_TOKEN`、`OPENCLAW_AGENT_ID`。網址填 Gateway origin，不加 /v1/responses。請勿將 token 放進 EXPO_PUBLIC_ 變數或上傳 Git。
3. 在 OpenClaw 設定中，依已安裝版本啟用 `gateway.http.endpoints.responses.enabled`。此 API 預設停用。專用 agent 應停用檔案、shell、瀏覽器及其他不必要的內建工具；提示文字不是權限邊界。
4. 使用 Node 24 執行 `npm run build:web` 及 `npm run preview:web`。本機伺服器會讀取 .env.openclaw.local；更動設定後須重新啟動。
5. 進入記帳室，按刷新檢查。顯示「OpenClaw 已設定」只代表三個欄位存在；實際送出成功才證明 Gateway、權限與模型正常。
6. 用小額測試消費確認品項、金額、分類、相對日期、多筆輸入與追問流程。確認後再正式使用。

Loopback HTTP 僅限 localhost / 127.0.0.1，遠端 Gateway 必須使用 HTTPS。本機 API 驗證 Host、Origin 與 JSON，無 CORS 開放，限制請求大小與並行數，Gateway token 僅在伺服器端。

## 部署限制

目前 API 僅接受本機同來源請求，**沒有生產環境帳號授權或多使用者隔離**。不能直接把此 Node API 開放到公網。未來如需手機線上自動記帳，須另建有登入驗證的後端，安全連到 OpenClaw，再決定帳本是否雲端同步；現有 Sites 靜態快照不包含這個可運行的後端。

OpenClaw shared-secret API 屬 Gateway operator 權限，瀏覽器不能直接持有 token。不要為了連線移除 Gateway 驗證或直接公開 Gateway。

## 驗證範圍

單元測試以假回傳測試真實 adapter 請求格式、結構化驗證、缺少設定時不呼叫 Gateway、無效批次、金額及重試去重。假回傳僅用在測試檔，不是產品模式。因尚未安裝 OpenClaw，**未做真實 agent 端到端測試**。

官方參考：[OpenClaw OpenResponses API](https://docs.openclaw.ai/gateway/openresponses-http-api)。
