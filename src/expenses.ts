export const expenseCategories = [
  "餐飲",
  "交通",
  "購物",
  "生活",
  "娛樂",
  "其他",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];
export type ExpenseDraft = {
  item: string;
  amountMinor: number;
  currency: "TWD";
  date: string;
  category: ExpenseCategory;
};
export type Expense = ExpenseDraft & {
  id: string;
  source: "manual" | "openclaw";
  createdAt: string;
  requestId?: string;
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  requestId?: string;
  state?: "waiting" | "failed" | "recorded" | "clarification";
  entryIds?: string[];
};
export type ExpenseStore = {
  version: 1;
  messages: ChatMessage[];
  entries: Expense[];
};
export type AgentPlan =
  | { kind: "record"; entries: ExpenseDraft[] }
  | { kind: "clarify"; message: string };
export const emptyExpenseStore = (): ExpenseStore => ({
  version: 1,
  messages: [],
  entries: [],
});
export function validExpenseDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return (
    y >= 2000 &&
    y <= 2100 &&
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}
export function validateExpense(value: unknown): ExpenseDraft {
  if (!value || typeof value !== "object")
    throw new Error("消費資料格式不正確。");
  const v = value as Record<string, unknown>;
  if (
    typeof v.item !== "string" ||
    !v.item.trim() ||
    v.item.length > 100 ||
    !Number.isSafeInteger(v.amountMinor) ||
    Number(v.amountMinor) <= 0 ||
    Number(v.amountMinor) > 999999999 ||
    v.currency !== "TWD" ||
    !validExpenseDate(v.date) ||
    !expenseCategories.includes(v.category as ExpenseCategory)
  )
    throw new Error("品項、金額、日期或分類不完整，尚未記帳。");
  return {
    item: v.item.trim(),
    amountMinor: Number(v.amountMinor),
    currency: "TWD",
    date: v.date,
    category: v.category as ExpenseCategory,
  };
}
export function parseAmount(input: string) {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(input.trim()))
    throw new Error("請輸入有效金額，最多兩位小數。");
  const [whole, fraction = ""] = input.trim().replaceAll(",", "").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 999999999)
    throw new Error("金額必須大於零，且不超過 9,999,999.99。");
  return minor;
}
export function money(amountMinor: number) {
  return (
    "NT$ " +
    (amountMinor / 100).toLocaleString("zh-TW", {
      minimumFractionDigits: amountMinor % 100 ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}
export function validateAgentPlan(value: unknown): AgentPlan {
  if (!value || typeof value !== "object")
    throw new Error("OpenClaw 回傳資料無法辨識，尚未記帳。");
  const v = value as Record<string, unknown>;
  if (
    v.kind === "clarify" &&
    typeof v.message === "string" &&
    v.message.trim() &&
    v.message.length <= 1000
  )
    return { kind: "clarify", message: v.message.trim() };
  if (
    v.kind === "record" &&
    Array.isArray(v.entries) &&
    v.entries.length > 0 &&
    v.entries.length <= 20
  )
    return { kind: "record", entries: v.entries.map(validateExpense) };
  throw new Error("OpenClaw 回傳資料不完整，尚未記帳。");
}
export function applyAgentPlan(
  store: ExpenseStore,
  requestId: string,
  raw: unknown,
  now: string,
): ExpenseStore {
  if (store.messages.some((m) => m.id === `${requestId}:reply`)) return store;
  if (
    !store.messages.some((m) => m.role === "user" && m.requestId === requestId)
  )
    throw new Error("找不到對應的聊天訊息。");
  const plan = validateAgentPlan(raw);
  const entries =
    plan.kind === "record"
      ? plan.entries.map((entry, i): Expense => ({
          ...entry,
          id: `${requestId}:${i}`,
          source: "openclaw",
          createdAt: now,
          requestId,
        }))
      : [];
  const text =
    plan.kind === "record"
      ? `已記錄 ${entries.length} 筆消費，共 ${money(entries.reduce((sum, e) => sum + e.amountMinor, 0))}。`
      : plan.message;
  return {
    ...store,
    entries: [...store.entries, ...entries],
    messages: [
      ...store.messages.map((m) =>
        m.requestId === requestId && m.role === "user"
          ? {
              ...m,
              state:
                plan.kind === "record"
                  ? ("recorded" as const)
                  : ("clarification" as const),
            }
          : m,
      ),
      {
        id: `${requestId}:reply`,
        role: "assistant",
        text,
        createdAt: now,
        entryIds: entries.map((e) => e.id),
      },
    ],
  };
}
export function readExpenseStore(raw: string): ExpenseStore {
  const v = JSON.parse(raw);
  if (
    v?.version !== 1 ||
    !Array.isArray(v.messages) ||
    !Array.isArray(v.entries)
  )
    throw new Error("無法讀取消費資料。");
  for (const e of v.entries) {
    validateExpense(e);
    if (
      typeof e.id !== "string" ||
      typeof e.createdAt !== "string" ||
      !["manual", "openclaw"].includes(e.source)
    )
      throw new Error("消費紀錄格式不正確。");
  }
  for (const m of v.messages)
    if (
      !m ||
      typeof m.id !== "string" ||
      !["user", "assistant"].includes(m.role) ||
      typeof m.text !== "string" ||
      typeof m.createdAt !== "string"
    )
      throw new Error("聊天紀錄格式不正確。");
  return v;
}
