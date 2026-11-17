/* global __dirname */
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const { Buffer } = require("node:buffer");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
function createPreviewRecords() {
  const root = path.resolve(__dirname, "..");
  fs.mkdirSync(path.join(root, ".expo"), { recursive: true });
  const sql = new DatabaseSync(path.join(root, ".expo/preview-records.sqlite"));
  if (
    !sql
      .prepare("SELECT name FROM sqlite_master WHERE name = 'account_records'")
      .get()
  )
    sql.exec(
      fs.readFileSync(
        path.join(root, "drizzle/0000_account_records.sql"),
        "utf8",
      ),
    );
  const database = {
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              return sql.prepare(query).get(...values) || null;
            },
            async run() {
              return {
                meta: {
                  changes: Number(sql.prepare(query).run(...values).changes),
                },
              };
            },
          };
        },
      };
    },
  };
  return async (req, res) => {
    if (!req.url.startsWith("/api/records/")) return false;
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host || "")) {
      res.writeHead(403).end();
      return true;
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 1_000_000) {
        res.writeHead(413).end();
        return true;
      }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const name of ["origin", "content-type"])
      if (req.headers[name]) headers.set(name, req.headers[name]);
    // This fixed identity exists only in this loopback-only development server.
    headers.set("oai-authenticated-user-id", "local-preview");
    const { recordsApi } = await import(
      pathToFileURL(path.join(root, "server/records-api.ts")).href
    );
    const response = await recordsApi(
      new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers,
        ...(req.method === "GET" || req.method === "HEAD"
          ? {}
          : { body: Buffer.concat(chunks) }),
      }),
      database,
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
    return true;
  };
}
module.exports = { createPreviewRecords };
