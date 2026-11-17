/* global __dirname */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createExpenseApi } = require("../server/expense-api.cjs");
const handleExpenseApi = createExpenseApi();
const { createPreviewRecords } = require("../server/preview-records.cjs");
const handleRecords = createPreviewRecords();
const root = path.resolve(__dirname, fs.existsSync(path.join(__dirname, "../dist/client")) ? "../dist/client" : "../dist");
const port = Number(process.env.PORT || 8083);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".css": "text/css",
};
http
  .createServer(async (req, res) => {
    try {
      if (await handleRecords(req, res)) return;
      if (await handleExpenseApi(req, res)) return;
      const requested = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let file = path.resolve(root, "." + requested);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory())
        file = path.join(file, "index.html");
      if (!fs.existsSync(file)) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] || "application/octet-stream",
      );
      res.setHeader(
        "Cache-Control",
        file.endsWith("sw.js") || file.endsWith(".html")
          ? "no-cache"
          : "public, max-age=3600",
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(400).end("Bad request");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Web App preview: http://localhost:${port}`),
  );
