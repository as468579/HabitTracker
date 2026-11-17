const { config, interpretExpense } = require("./openclaw.cjs");
const { Buffer } = require("node:buffer");
function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
function createExpenseApi() {
  const inFlight = new Set();
  return async function handle(req, res) {
    const route = new URL(req.url, "http://localhost").pathname;
    if (!route.startsWith("/api/expenses/")) return false;
    const host = req.headers.host || "";
    if (
      !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ||
      (req.headers.origin && req.headers.origin !== `http://${host}`)
    ) {
      json(res, 403, { error: "此記帳介面僅接受本機同來源請求。" });
      return true;
    }
    if (route === "/api/expenses/status" && req.method === "GET") {
      try {
        json(res, 200, { configured: !!config(), provider: "openclaw" });
      } catch {
        json(res, 200, { configured: false, provider: "openclaw" });
      }
      return true;
    }
    if (route !== "/api/expenses/chat" || req.method !== "POST") {
      json(res, 404, { error: "找不到此功能。" });
      return true;
    }
    if (!(req.headers["content-type"] || "").startsWith("application/json")) {
      json(res, 415, { error: "請使用 JSON 格式。" });
      return true;
    }
    if (inFlight.size >= 2) {
      json(res, 429, { error: "正在處理其他訊息，請稍後重試。" });
      return true;
    }
    let requestId;
    let acquired = false;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 32000) {
          json(res, 413, { error: "訊息太長。" });
          return true;
        }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requestId = body.requestId;
      if (
        typeof requestId !== "string" ||
        !/^[a-zA-Z0-9-]{8,100}$/.test(requestId)
      ) {
        json(res, 400, { error: "訊息識別碼不正確。" });
        return true;
      }
      if (inFlight.has(requestId)) {
        json(res, 409, { error: "此訊息正在處理中，請稍候。" });
        return true;
      }
      inFlight.add(requestId);
      acquired = true;
      const result = await interpretExpense(body);
      json(res, 200, result);
    } catch (error) {
      json(res, error.status || 502, {
        error: error.status
          ? error.message
          : "OpenClaw 回應無法驗證，尚未記帳。",
      });
    } finally {
      if (acquired) inFlight.delete(requestId);
    }
    return true;
  };
}
module.exports = { createExpenseApi };
