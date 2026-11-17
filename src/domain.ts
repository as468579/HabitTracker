export type Frequency = "daily" | "weekly" | "monthly";
export type Category = "生活" | "健康" | "學習" | "工作";
export type Task = {
  id: string;
  title: string;
  note: string;
  frequency: Frequency;
  category: Category;
  createdAt: string;
  completed: string[];
};
export type Store = { version: 1; tasks: Task[]; demo: boolean };
export const frequencies: { key: Frequency; label: string; short: string }[] = [
  { key: "daily", label: "每日", short: "日" },
  { key: "weekly", label: "每週", short: "週" },
  { key: "monthly", label: "每月", short: "月" },
];
export const categories: Category[] = ["生活", "健康", "學習", "工作"];
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function localDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
export function periodStart(date: Date, f: Frequency): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  if (f === "weekly") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (f === "monthly") d.setDate(1);
  return d;
}
export function shiftPeriod(date: Date, f: Frequency, count: number) {
  const d = periodStart(date, f);
  if (f === "monthly") d.setMonth(d.getMonth() + count);
  else d.setDate(d.getDate() + count * (f === "weekly" ? 7 : 1));
  return d;
}
export function periodKey(date: Date, f: Frequency) {
  return `${f}:${dateKey(periodStart(date, f))}`;
}
export function available(task: Task, date: Date) {
  return (
    periodStart(localDate(task.createdAt), task.frequency).getTime() <=
    periodStart(date, task.frequency).getTime()
  );
}
export function isDone(task: Task, date: Date) {
  return task.completed.includes(periodKey(date, task.frequency));
}
export function toggleTask(task: Task, date: Date): Task {
  const key = periodKey(date, task.frequency);
  return {
    ...task,
    completed: isDone(task, date)
      ? task.completed.filter((k) => k !== key)
      : [...task.completed, key],
  };
}
// Dashboard compares tasks with the same recurrence; one completion per task per period.
export function stats(tasks: Task[], date: Date, f: Frequency) {
  const list = tasks.filter((t) => t.frequency === f && available(t, date));
  const done = list.filter((t) => isDone(t, date)).length;
  return {
    total: list.length,
    done,
    remaining: list.length - done,
    rate: list.length ? Math.round((done / list.length) * 100) : 0,
  };
}
export type DailyStatus =
  "complete" | "partial" | "missed" | "pending" | "unscheduled" | "future";
export function dailyActivity(tasks: Task[], date: Date, today: Date) {
  const key = dateKey(date);
  const future = key > dateKey(today);
  const summary = future
    ? { total: 0, done: 0, remaining: 0, rate: 0 }
    : stats(tasks, date, "daily");
  const status: DailyStatus = future
    ? "future"
    : !summary.total
      ? "unscheduled"
      : summary.done === summary.total
        ? "complete"
        : summary.done > 0
          ? "partial"
          : key === dateKey(today)
            ? "pending"
            : "missed";
  return {
    date,
    key,
    ...summary,
    status,
    level: summary.done ? Math.min(4, Math.ceil(summary.rate / 25)) : 0,
  };
}
export function yearActivity(tasks: Task[], year: number, today: Date) {
  const days: ReturnType<typeof dailyActivity>[] = [];
  let completed = 0,
    activeDays = 0,
    longestStreak = 0,
    run = 0;
  for (
    let date = new Date(year, 0, 1, 12);
    date.getFullYear() === year;
    date = shiftPeriod(date, "daily", 1)
  ) {
    const day = dailyActivity(tasks, date, today);
    days.push(day);
    completed += day.done;
    if (day.done) activeDays++;
    run = day.status === "complete" ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }
  return { days, completed, activeDays, longestStreak };
}
export function monthCells(year: number, month: number): (Date | null)[] {
  const offset = (new Date(year, month, 1, 12).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0, 12).getDate();
  return Array.from(
    { length: Math.ceil((offset + count) / 7) * 7 },
    (_, index) =>
      index < offset || index >= offset + count
        ? null
        : new Date(year, month, index - offset + 1, 12),
  );
}
export function streak(tasks: Task[], today: Date) {
  let count = 0;
  let d = periodStart(today, "daily");
  const first = stats(tasks, d, "daily");
  if (!first.total || first.done !== first.total)
    d = shiftPeriod(d, "daily", -1);
  for (let i = 0; i < 3650; i++) {
    const s = stats(tasks, d, "daily");
    if (!s.total || s.done !== s.total) break;
    count++;
    d = shiftPeriod(d, "daily", -1);
  }
  return count;
}
export function makeDemo(today = new Date()): Store {
  const titles: [string, Category, Frequency, string][] = [
    ["喝足 2,000 ml 的水", "健康", "daily", "讓身體保持水分，從一杯水開始。"],
    ["閱讀 20 分鐘", "學習", "daily", "留一點時間，給書裡的世界。"],
    ["活動身體 30 分鐘", "健康", "daily", "散步、瑜珈，或你喜歡的運動。"],
    ["整理今日待辦", "工作", "daily", "專注在今天最重要的三件事。"],
    ["寫下三件感謝的事", "生活", "daily", "記下今天值得珍惜的小事。"],
    ["睡前放下手機", "生活", "daily", "給自己一個安靜的夜晚。"],
    ["整理房間", "生活", "weekly", "為新的一週留出舒服的空間。"],
    ["回顧本週學習", "學習", "weekly", "整理筆記，記錄新的收穫。"],
    ["和家人好好聊聊", "生活", "weekly", "把時間留給重要的人。"],
    ["每月收支整理", "生活", "monthly", "記錄收入與支出，照顧未來的自己。"],
    ["讀完一本書", "學習", "monthly", "慢慢讀，也是一種前進。"],
  ];
  const tasks = titles.map(([title, category, frequency, note], i): Task => ({
    id: `sample-${i}`,
    title,
    category,
    frequency,
    note,
    createdAt: dateKey(shiftPeriod(today, "monthly", -6)),
    completed: [],
  }));
  for (const [i, task] of tasks.entries()) {
    for (let j = 0; j < (task.frequency === "daily" ? 100 : 7); j++) {
      if ((j === 0 && i < 4) || (j > 0 && (j <= 3 || (j + i * 3) % 5 !== 0)))
        task.completed.push(
          periodKey(shiftPeriod(today, task.frequency, -j), task.frequency),
        );
    }
  }
  return { version: 1, tasks, demo: true };
}
export function readStore(raw: string): Store {
  const s: unknown = JSON.parse(raw);
  if (
    !s ||
    typeof s !== "object" ||
    !("version" in s) ||
    s.version !== 1 ||
    !("tasks" in s) ||
    !Array.isArray(s.tasks) ||
    !("demo" in s) ||
    typeof s.demo !== "boolean"
  )
    throw new Error("無法讀取資料格式");
  for (const t of s.tasks) {
    if (
      !t ||
      typeof t.id !== "string" ||
      typeof t.title !== "string" ||
      typeof t.note !== "string" ||
      !categories.includes(t.category) ||
      !frequencies.some((f) => f.key === t.frequency) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(t.createdAt) ||
      !Array.isArray(t.completed) ||
      !t.completed.every((k: unknown) => typeof k === "string")
    )
      throw new Error("任務資料損壞");
  }
  return s as Store;
}
