import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { recordsApi, EMPTY_TASKS } from "../server/records-api.ts";
import { CloudStore, CloudConflict, httpTransport } from "../src/cloud-store.ts";
import { readStore } from "../src/domain.ts";
import { emptyExpenseStore } from "../src/expenses.ts";

function database() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync("drizzle/0000_account_records.sql", "utf8"));
  return {
    prepare(query) { return { bind(...values) { return {
      async first() { return sql.prepare(query).get(...values) ?? null; },
      async run() { return { meta: { changes: Number(sql.prepare(query).run(...values).changes) } }; },
    }; } }; },
  };
}
const task = (id) => ({ id, title: "閱讀", note: "", frequency: "daily", category: "學習", createdAt: "2026-11-18", completed: [] });
const withTasks = (...tasks) => ({ ...EMPTY_TASKS, tasks });
function request(db, user, method = "GET", body, kind = "tasks", extra = {}) {
  return recordsApi(new Request(`https://habit.test/api/records/${kind}`, {
    method, headers: { ...(user ? { "oai-authenticated-user-id": user } : {}), Origin: "https://habit.test", "Content-Type": "application/json", ...extra },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }), db);
}
function transport(db, user, kind = "tasks") {
  const parse = kind === "tasks" ? readStore : JSON.parse;
  return httpTransport(kind, parse, async (url, init) => recordsApi(new Request(`https://habit.test${url}`, {
    ...init, headers: { ...init.headers, Origin: "https://habit.test", "oai-authenticated-user-id": user },
  }), db));
}

test("new accounts start empty, and phone reads the computer's remote records", async () => {
  const db = database();
  const computer = new CloudStore(transport(db, "alice"), EMPTY_TASKS);
  const phone = new CloudStore(transport(db, "alice"), EMPTY_TASKS);
  await computer.refresh();
  assert.deepEqual(computer.getSnapshot().data, EMPTY_TASKS);
  assert.equal(await computer.save(withTasks(task("reading"))), true);
  await phone.refresh();
  assert.equal(phone.getSnapshot().data.tasks[0].id, "reading");
  const completed = { ...phone.getSnapshot().data.tasks[0], completed: ["daily:2026-11-18"] };
  await phone.save(withTasks(completed));
  await computer.refresh();
  assert.deepEqual(computer.getSnapshot().data.tasks[0].completed, completed.completed);
});

test("database identity isolation and independent task/expense records", async () => {
  const db = database();
  await request(db, "alice", "PUT", { revision: 0, data: withTasks(task("private")) });
  assert.deepEqual((await (await request(db, "bob")).json()).data, EMPTY_TASKS);
  assert.deepEqual((await (await request(db, "alice", "GET", null, "expenses")).json()).data, emptyExpenseStore());
  assert.equal((await request(db, null)).status, 401);
  assert.equal((await request(undefined, "alice")).status, 503);
});

test("stale device cannot overwrite newer edits or clear newer tasks", async () => {
  const db = database();
  const first = new CloudStore(transport(db, "alice"), EMPTY_TASKS);
  const stale = new CloudStore(transport(db, "alice"), EMPTY_TASKS);
  await Promise.all([first.refresh(), stale.refresh()]);
  assert.equal(await first.save(withTasks(task("newer"))), true);
  assert.equal(await stale.save(EMPTY_TASKS), false);
  assert.match(stale.getSnapshot().error, /其他裝置/);
  assert.equal(stale.getSnapshot().data.tasks[0].id, "newer");
  assert.equal((await (await request(db, "alice")).json()).revision, 1);
  // A form opened at revision zero must conflict even after background refresh.
  assert.equal(await stale.save(withTasks(task("stale-form")), 0), false);
});

test("simultaneous initial writes use atomic SQL compare-and-swap", async () => {
  const db = database();
  const responses = await Promise.all([
    request(db, "alice", "PUT", { revision: 0, data: withTasks(task("A")) }),
    request(db, "alice", "PUT", { revision: 0, data: withTasks(task("B")) }),
  ]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await (await request(db, "alice")).json()).data.tasks.length, 1);
});

test("API rejects CSRF, unsupported methods, invalid revisions, duplicate IDs and demo data", async () => {
  const db = database();
  const valid = { revision: 0, data: withTasks(task("one")) };
  assert.equal((await request(db, "alice", "PUT", valid, "tasks", { Origin: "https://evil.test" })).status, 403);
  assert.equal((await request(db, "alice", "DELETE")).status, 405);
  assert.equal((await request(db, "alice", "PUT", valid, "tasks", { "Content-Type": "text/plain" })).status, 415);
  for (const invalid of [
    { revision: -1, data: EMPTY_TASKS },
    { revision: "0", data: EMPTY_TASKS },
    { revision: 0, data: { ...EMPTY_TASKS, demo: true } },
    { revision: 0, data: withTasks(task("same"), task("same")) },
    { revision: 0, data: withTasks({ ...task("bad"), title: "" }) },
  ]) assert.equal((await request(db, "alice", "PUT", invalid)).status, 400);
  assert.deepEqual((await (await request(db, "alice")).json()).data, EMPTY_TASKS);
});

test("reset clears task records remotely without modifying the expense document", async () => {
  const db = database();
  await request(db, "alice", "PUT", { revision: 0, data: withTasks(task("old")) });
  await request(db, "alice", "PUT", { revision: 0, data: emptyExpenseStore() }, "expenses");
  assert.equal((await request(db, "alice", "PUT", { revision: 1, data: EMPTY_TASKS })).status, 200);
  assert.deepEqual((await (await request(db, "alice")).json()).data.tasks, []);
  assert.equal((await (await request(db, "alice", "GET", null, "expenses")).json()).revision, 1);
});

test("failed writes never display unsaved data as committed; reconnect restores operation", async () => {
  let failed = true;
  const controller = new CloudStore({ load: async () => ({ revision: 0, data: EMPTY_TASKS }), save: async (s) => {
    if (failed) throw new Error("offline"); return { ...s, revision: s.revision + 1 };
  } }, EMPTY_TASKS);
  await controller.refresh();
  assert.equal(await controller.save(withTasks(task("not-saved"))), false);
  assert.deepEqual(controller.getSnapshot().data, EMPTY_TASKS);
  assert.equal(controller.getSnapshot().blocked, true);
  failed = false;
  await controller.refresh();
  assert.equal(await controller.save(withTasks(task("saved"))), true);
});

test("late background reads cannot replace a successful newer write", async () => {
  let resolveRead;
  let calls = 0;
  const controller = new CloudStore({
    load: async () => ++calls === 1 ? { revision: 0, data: EMPTY_TASKS } : new Promise(resolve => { resolveRead = resolve; }),
    save: async s => ({ ...s, revision: 1 }),
  }, EMPTY_TASKS);
  await controller.refresh();
  const staleRead = controller.refresh();
  await controller.save(withTasks(task("saved")));
  resolveRead({ revision: 0, data: EMPTY_TASKS });
  await staleRead;
  assert.equal(controller.getSnapshot().data.tasks[0].id, "saved");
});

test("unauthorized or malformed server responses cannot masquerade as a synchronized store", async () => {
  const unauth = httpTransport("tasks", readStore, async () => new Response("login", { status: 401 }));
  await assert.rejects(unauth.load(), /登入/);
  const bad = httpTransport("tasks", readStore, async () => Response.json({ revision: "bad", data: EMPTY_TASKS }));
  await assert.rejects(bad.load(), /格式/);
  const conflict = httpTransport("tasks", readStore, async () => Response.json({ revision: 2, data: EMPTY_TASKS }, { status: 409 }));
  await assert.rejects(conflict.save({ revision: 0, data: EMPTY_TASKS }), CloudConflict);
});
