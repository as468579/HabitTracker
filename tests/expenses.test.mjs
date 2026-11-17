import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAgentPlan,
  emptyExpenseStore,
  parseAmount,
  readExpenseStore,
  validateAgentPlan,
  validateExpense,
  validExpenseDate,
} from "../src/expenses.ts";
import openclaw from "../server/openclaw.cjs";
import expenseApi from "../server/expense-api.cjs";
import { Readable } from "node:stream";
test("local expense API rejects foreign origins, host rebinding and malformed requests", async () => {
  const handle = expenseApi.createExpenseApi();
  const invoke = async (request) => {
    let status, data, headers;
    const res = {
      writeHead(code, values) {
        status = code;
        headers = values;
      },
      end(value) {
        data = JSON.parse(value);
      },
    };
    assert.equal(await handle(request, res), true);
    return { status, data, headers };
  };
  assert.equal(
    (
      await invoke({
        url: "/api/expenses/status",
        method: "GET",
        headers: { host: "evil.test" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await invoke({
        url: "/api/expenses/status",
        method: "GET",
        headers: { host: "localhost:8083", origin: "https://evil.test" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await invoke({
        url: "/api/expenses/chat",
        method: "POST",
        headers: { host: "localhost:8083" },
      })
    ).status,
    415,
  );
  const req = Object.assign(
    Readable.from([
      new TextEncoder().encode(JSON.stringify({ requestId: "bad" })),
    ]),
    {
      url: "/api/expenses/chat",
      method: "POST",
      headers: { host: "localhost:8083", "content-type": "application/json" },
    },
  );
  const result = await invoke(req);
  assert.equal(result.status, 400);
  assert.equal(result.headers["Cache-Control"], "no-store");
});
const draft = {
  item: "午餐",
  amountMinor: 12000,
  currency: "TWD",
  date: "2026-11-08",
  category: "餐飲",
};
const waiting = () => ({
  ...emptyExpenseStore(),
  messages: [
    {
      id: "request-123",
      requestId: "request-123",
      role: "user",
      text: "午餐120",
      createdAt: "2026-11-08T08:00:00Z",
      state: "waiting",
    },
  ],
});
test("currency amounts use integer minor units with strict decimal parsing", () => {
  assert.equal(parseAmount("65.5"), 6550);
  assert.equal(parseAmount("1,234.56"), 123456);
  for (const bad of ["0", "-3", "1,23", "10.001", "abc", "Infinity"])
    assert.throws(() => parseAmount(bad));
  assert.equal(validExpenseDate("2024-02-29"), true);
  assert.equal(validExpenseDate("2026-02-30"), false);
});
test("a validated multi-expense agent plan commits once, including retries", () => {
  const original = waiting();
  const result = applyAgentPlan(
    original,
    "request-123",
    {
      kind: "record",
      entries: [draft, { ...draft, item: "咖啡", amountMinor: 6550 }],
    },
    "2026-11-08T08:01:00Z",
  );
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].source, "openclaw");
  assert.equal(
    result.entries.reduce((sum, e) => sum + e.amountMinor, 0),
    18550,
  );
  assert.equal(result.messages[0].state, "recorded");
  assert.equal(
    applyAgentPlan(
      result,
      "request-123",
      { kind: "record", entries: [draft] },
      "later",
    ),
    result,
  );
  assert.equal(original.entries.length, 0);
  assert.deepEqual(readExpenseStore(JSON.stringify(result)), result);
});
test("ambiguous messages create a clarification without recording; invalid batches are atomic", () => {
  const store = waiting();
  const result = applyAgentPlan(
    store,
    "request-123",
    { kind: "clarify", message: "午餐花了多少元？" },
    "now",
  );
  assert.equal(result.entries.length, 0);
  assert.equal(result.messages[0].state, "clarification");
  assert.throws(() =>
    applyAgentPlan(
      store,
      "request-123",
      { kind: "record", entries: [draft, { ...draft, amountMinor: NaN }] },
      "now",
    ),
  );
  assert.equal(store.messages.length, 1);
  assert.equal(store.entries.length, 0);
  assert.throws(() => validateExpense({ ...draft, date: "2026-02-30" }));
  assert.throws(() => validateAgentPlan({ kind: "record", entries: [] }));
});
test("OpenClaw remains unconfigured with blank values and disallows remote plaintext", async () => {
  assert.equal(openclaw.config({}), null);
  await assert.rejects(
    openclaw.interpretExpense(
      {},
      { env: {}, fetchImpl: () => assert.fail("must not call Gateway") },
    ),
    /尚未設定/,
  );
  assert.throws(
    () =>
      openclaw.config({
        OPENCLAW_GATEWAY_URL: "http://remote.test",
        OPENCLAW_GATEWAY_TOKEN: "test-token",
        OPENCLAW_AGENT_ID: "expense",
      }),
    /HTTPS/,
  );
});
test("real adapter targets OpenClaw Responses with function tools and validates output", async () => {
  const env = {
    OPENCLAW_GATEWAY_URL: "http://127.0.0.1:18789",
    OPENCLAW_GATEWAY_TOKEN: "unit-test-token",
    OPENCLAW_AGENT_ID: "expense",
  };
  let request;
  const result = await openclaw.interpretExpense(
    { message: "午餐120", today: "2026-11-08", history: [] },
    {
      env,
      fetchImpl: async (url, options) => {
        request = { url, options, body: JSON.parse(options.body) };
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              status: "completed",
              output: [
                {
                  type: "function_call",
                  name: "record_expenses",
                  arguments: JSON.stringify({ entries: [draft] }),
                },
              ],
            }),
        };
      },
    },
  );
  assert.equal(request.url.pathname, "/v1/responses");
  assert.equal(request.body.model, "openclaw/expense");
  assert.equal(request.body.tool_choice, "required");
  assert.equal(request.options.redirect, "error");
  assert.deepEqual(result, { kind: "record", entries: [draft] });
  assert.throws(() =>
    openclaw.readPlan({
      status: "completed",
      output: [{ type: "message", content: "已記錄" }],
    }),
  );
  assert.throws(() =>
    openclaw.readPlan({
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "record_expenses",
          arguments: JSON.stringify({
            entries: [{ ...draft, amountMinor: -1 }],
          }),
        },
      ],
    }),
  );
});
