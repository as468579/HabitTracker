import { readStore, type Store } from "../src/domain.ts";
import { emptyExpenseStore, readExpenseStore } from "../src/expenses.ts";

export interface Database {
  prepare(sql: string): {
    bind(...values: (string | number)[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<{ meta: { changes: number } }>;
    };
  };
}
export const EMPTY_TASKS: Store = { version: 1, demo: false, tasks: [] };
function validate(kind: string, input: unknown) {
  if (kind === "expenses") return readExpenseStore(JSON.stringify(input));
  const store = readStore(JSON.stringify(input));
  if (
    store.demo ||
    store.tasks.length > 2000 ||
    new Set(store.tasks.map((t) => t.id)).size !== store.tasks.length
  )
    throw new Error("無效的任務資料");
  for (const task of store.tasks) {
    if (
      !task.title.trim() ||
      task.title.length > 100 ||
      task.note.length > 160 ||
      task.id.length > 160 ||
      task.completed.length > 20000
    )
      throw new Error("任務超過可儲存長度");
  }
  return store;
}
function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function recordsApi(
  request: Request,
  db?: Database,
): Promise<Response> {
  const url = new URL(request.url);
  const kind = url.pathname.split("/").pop();
  if (kind !== "tasks" && kind !== "expenses")
    return json({ error: "Not found" }, 404);
  const user = request.headers.get("oai-authenticated-user-id");
  if (!user) return json({ error: "請先登入" }, 401);
  if (!db) return json({ error: "遠端資料庫尚未連線" }, 503);
  if (request.method !== "GET" && request.method !== "PUT")
    return json({ error: "Method not allowed" }, 405);
  if (request.method === "PUT") {
    if (request.headers.get("Origin") !== url.origin)
      return json({ error: "Forbidden origin" }, 403);
    if (
      !request.headers
        .get("Content-Type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return json({ error: "Expected JSON" }, 415);
  }
  const read = async () => {
    const row = await db
      .prepare(
        "SELECT revision, data FROM account_records WHERE user_id = ? AND kind = ?",
      )
      .bind(user, kind)
      .first<{ revision: number; data: string }>();
    return row
      ? { revision: row.revision, data: validate(kind, JSON.parse(row.data)) }
      : {
          revision: 0,
          data: kind === "tasks" ? EMPTY_TASKS : emptyExpenseStore(),
        };
  };
  try {
    if (request.method === "GET") return json(await read());
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 1_000_000)
      return json({ error: "資料過大" }, 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (
      !body ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      body.revision >= Number.MAX_SAFE_INTEGER
    )
      return json({ error: "無效版本" }, 400);
    let data;
    try {
      data = validate(kind, body.data);
    } catch {
      return json({ error: "無效資料格式" }, 400);
    }
    const result = await db
      .prepare(
        `INSERT INTO account_records (user_id, kind, revision, data)
      SELECT ?, ?, ?, ? WHERE ? = 0 OR EXISTS (SELECT 1 FROM account_records WHERE user_id = ? AND kind = ?)
      ON CONFLICT(user_id, kind) DO UPDATE SET revision = excluded.revision, data = excluded.data
      WHERE account_records.revision = ?`,
      )
      .bind(
        user,
        kind,
        body.revision + 1,
        JSON.stringify(data),
        body.revision,
        user,
        kind,
        body.revision,
      )
      .run();
    if (!result.meta.changes) return json(await read(), 409);
    return json({ revision: body.revision + 1, data });
  } catch {
    return json({ error: "遠端資料庫暫時無法使用，請稍後重試。" }, 503);
  }
}
