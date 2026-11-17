import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { WebAppPanel } from "./WebAppSupport";
import ActivityDashboard from "./ActivityDashboard";
import ExpenseChat from "./ExpenseChat";
import AppearanceSettings from "./AppearanceSettings";
import type { AppTheme, UiStyles } from "./theme";
import { useThemedStyles, ThemeToggle } from "./Appearance";
import { useCloudStore } from "./useCloudStore";
import { httpTransport } from "./cloud-store";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import {
  available,
  categories,
  Category,
  dateKey,
  frequencies,
  Frequency,
  isDone,
  periodStart,
  readStore,
  shiftPeriod,
  stats,
  Store,
  streak,
  Task,
  toggleTask,
} from "./domain";

function getCategoryStyles(theme: AppTheme): Record<
  Category,
  {
    color: string;
    bg: string;
    icon: React.ComponentProps<typeof Feather>["name"];
  }
> {
  return {
    健康: { ...theme.categories.健康, icon: "heart" },
    學習: { ...theme.categories.學習, icon: "book-open" },
    工作: { ...theme.categories.工作, icon: "briefcase" },
    生活: { ...theme.categories.生活, icon: "sun" },
  };
}
const taskTransport = httpTransport<Store>("tasks", readStore);
const emptyTasks: Store = { version: 1, tasks: [], demo: false };
type Tab = "dashboard" | "tasks" | "expenses" | "settings";
function Icon({
  name,
  size = 20,
  color,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
  color?: string;
}) {
  const { theme } = useThemedStyles(createStyles);
  return <Feather name={name} size={size} color={color ?? theme.colors.ink} />;
}
function Button({
  title,
  onPress,
  secondary = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  const { theme, styles: s } = useThemedStyles(createStyles);
  const C = theme.colors;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondaryButton,
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon && (
        <Icon name={icon} size={17} color={secondary ? C.green : C.onPrimary} />
      )}
      <Text style={[s.buttonText, secondary && { color: C.green }]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Ring({ rate, size = 158 }: { rate: number; size?: number }) {
  const { theme, styles: s } = useThemedStyles(createStyles);
  const C = theme.colors;
  const radius = 62;
  const length = 2 * Math.PI * radius;
  return (
    <View
      accessibilityLabel={`完成率 ${rate}%`}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 150 150"
        style={StyleSheet.absoluteFill}
      >
        <Circle
          cx="75"
          cy="75"
          r={radius}
          stroke={theme.colors.line}
          strokeWidth="10"
          fill="none"
        />
        <Circle
          cx="75"
          cy="75"
          r={radius}
          stroke={C.green}
          strokeWidth="10"
          fill="none"
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={length * (1 - rate / 100)}
          strokeLinecap="round"
          transform="rotate(-90 75 75)"
        />
      </Svg>
      <Text style={s.ringNumber}>
        {rate}
        <Text style={{ fontSize: 20 * theme.textScale }}>%</Text>
      </Text>
      <Text style={s.caption}>完成率</Text>
    </View>
  );
}
function periodLabel(date: Date, f: Frequency) {
  if (f === "monthly")
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
  if (f === "weekly") {
    const a = periodStart(date, f);
    const b = new Date(a);
    b.setDate(b.getDate() + 6);
    return `${a.getMonth() + 1}/${a.getDate()} – ${b.getMonth() + 1}/${b.getDate()}`;
  }
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export default function TrackerApp() {
  const { theme, styles: s } = useThemedStyles(createStyles);
  const C = theme.colors;
  const categoryStyle = getCategoryStyles(theme);
  const { width } = useWindowDimensions();
  const desktop = width >= 1000;
  const roomy = width >= 700;
  const cloud = useCloudStore(taskTransport, emptyTasks);
  const { data: store, ready, error: storageError } = cloud;
  const loadFailed = cloud.blocked || cloud.busy;
  const [today, setToday] = useState(new Date());
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab: Tab =
    params.tab === "tasks" ||
    params.tab === "settings" ||
    params.tab === "expenses"
      ? params.tab
      : "dashboard";
  const setTab = (next: Tab) => router.setParams({ tab: next });
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [anchor, setAnchor] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [search, setSearch] = useState("");
  const [editor, setEditorRaw] = useState<Task | "new" | null>(null);
  const editorRevision = useRef(0);
  const setEditor = (next: Task | "new" | null) => {
    if (next !== null) editorRevision.current = cloud.revision;
    setEditorRaw(next);
  };
  const [confirm, setConfirm] = useState<Task | "reset" | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const update = () => setToday(new Date());
    const timer = setInterval(update, 30000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  const previousDay = useRef(dateKey(today));
  useEffect(() => {
    if (previousDay.current !== dateKey(today)) {
      const oldDay = previousDay.current;
      setAnchor((old) => (dateKey(old) === oldDay ? today : old));
      previousDay.current = dateKey(today);
    }
  }, [today]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  const tasks = store.tasks;
  const summary = stats(tasks, anchor, frequency);
  const current =
    periodStart(anchor, frequency).getTime() ===
    periodStart(today, frequency).getTime();
  const list = tasks.filter(
    (t) => t.frequency === frequency && available(t, anchor),
  );
  const shown = list.filter(
    (t) =>
      (filter === "all" || isDone(t, anchor) === (filter === "done")) &&
      `${t.title}${t.note}${t.category}`.includes(search.trim()),
  );
  const history = Array.from({ length: 7 }, (_, i) => {
    const date = shiftPeriod(anchor, frequency, i - 6);
    return { date, ...stats(tasks, date, frequency) };
  });
  const nav: {
    key: Tab;
    name: string;
    icon: React.ComponentProps<typeof Feather>["name"];
  }[] = [
    { key: "dashboard", name: "總覽", icon: "grid" },
    { key: "tasks", name: "我的任務", icon: "check-square" },
    { key: "expenses", name: "記帳室", icon: "message-circle" },
    { key: "settings", name: "設定", icon: "sliders" },
  ];
  const updateTask = async (task: Task, date = anchor) => {
    if (loadFailed) return;
    await cloud.controller.save({
      ...store,
      tasks: store.tasks.map((t) =>
        t.id === task.id ? toggleTask(t, date) : t,
      ),
    });
  };
  if (!ready)
    return (
      <SafeAreaView style={s.loading}>
        <ActivityIndicator color={C.green} />
        <Text style={s.caption}>載入中…</Text>
      </SafeAreaView>
    );
  const openNew = () => setEditor("new");
  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <View style={s.appRow}>
        {desktop && (
          <View style={s.sidebar}>
            <View style={s.logoRow}>
              <View style={s.logo}>
                <Icon name="feather" color={theme.colors.onPrimary} size={24} />
              </View>
              <View>
                <Text style={s.brand}>HabitTracker</Text>
              </View>
            </View>
            {nav.map((n) => (
              <Pressable
                key={n.key}
                onPress={() => setTab(n.key)}
                style={[s.navItem, tab === n.key && s.navActive]}
              >
                <Icon name={n.icon} color={tab === n.key ? C.green : C.muted} />
                <Text
                  style={[
                    s.navText,
                    tab === n.key && { color: C.green, fontWeight: "700" },
                  ]}
                >
                  {n.name}
                </Text>
                {tab === n.key && <View style={s.activeDot} />}
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[
              s.content,
              !desktop && { paddingHorizontal: 20, paddingTop: 20 },
            ]}
          >
            <View style={s.topBar}>
              <View style={s.row}>
                <View style={s.smallLeaf}>
                  <Icon name="feather" size={17} color={C.green} />
                </View>
                <Text style={s.eyebrow}>HabitTracker</Text>
              </View>
              <View style={[s.row, { gap: 10 }]}>
                <ThemeToggle />
                <View style={s.dateChip}>
                  <Icon name="calendar" size={14} color={C.muted} />
                  <Text style={s.caption}>
                    {today.getFullYear()}.
                    {String(today.getMonth() + 1).padStart(2, "0")}.
                    {String(today.getDate()).padStart(2, "0")}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={[
                s.pageHeading,
                !roomy && { alignItems: "flex-start", gap: 18 },
              ]}
            >
              <View>
                <Text
                  style={[
                    s.title,
                    !roomy && { fontSize: 29 * theme.textScale },
                  ]}
                >
                  {tab === "dashboard"
                    ? "總覽"
                    : tab === "tasks"
                      ? "我的任務"
                      : tab === "expenses"
                        ? "記帳室"
                        : "設定"}
                </Text>
              </View>
              {tab !== "settings" && tab !== "expenses" && (
                <Button title="新增任務" icon="plus" onPress={openNew} />
              )}
            </View>
            {storageError ? (
              <View style={s.errorBox}>
                <Text style={{ color: theme.colors.danger, flex: 1 }}>
                  {storageError}
                </Text>
                {!cloud.busy && (
                  <Pressable
                    onPress={() => {
                      void cloud.controller.refresh();
                    }}
                  >
                    <Text style={s.link}>重試</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
            {store.demo && tab !== "expenses" && (
              <View style={s.demoBanner}>
                <Icon name="info" size={15} color={C.green} />
                <Text
                  style={[
                    s.caption,
                    { flex: 1, color: theme.colors.secondary },
                  ]}
                >
                  目前顯示範例資料
                </Text>
                <Pressable onPress={() => setConfirm("reset")}>
                  <Text style={s.link}>
                    開始使用 <Text>↗</Text>
                  </Text>
                </Pressable>
              </View>
            )}
            {tab === "expenses" ? (
              <ExpenseChat />
            ) : tab !== "settings" ? (
              <>
                <View style={[s.controls, !roomy && { gap: 14 }]}>
                  <View style={s.segment}>
                    {frequencies.map((f) => (
                      <Pressable
                        key={f.key}
                        accessibilityRole="button"
                        aria-selected={frequency === f.key}
                        onPress={() => {
                          setFrequency(f.key);
                          setFilter("all");
                        }}
                        style={[
                          s.segmentItem,
                          frequency === f.key && s.segmentActive,
                        ]}
                      >
                        <Text
                          style={[
                            s.segmentText,
                            frequency === f.key && {
                              color: C.green,
                              fontWeight: "700",
                            },
                          ]}
                        >
                          {f.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={s.periodControls}>
                    <Pressable
                      accessibilityLabel="上一個週期"
                      hitSlop={10}
                      onPress={() =>
                        setAnchor(shiftPeriod(anchor, frequency, -1))
                      }
                    >
                      <Icon name="chevron-left" size={18} color={C.muted} />
                    </Pressable>
                    <Text
                      style={[
                        s.bold,
                        {
                          minWidth: 102,
                          textAlign: "center",
                          fontSize: 13 * theme.textScale,
                        },
                      ]}
                    >
                      {periodLabel(anchor, frequency)}
                    </Text>
                    <Pressable
                      accessibilityLabel="下一個週期"
                      disabled={current}
                      hitSlop={10}
                      onPress={() =>
                        setAnchor(shiftPeriod(anchor, frequency, 1))
                      }
                    >
                      <Icon
                        name="chevron-right"
                        size={18}
                        color={current ? theme.colors.disabled : C.ink}
                      />
                    </Pressable>
                    {!current && (
                      <Pressable onPress={() => setAnchor(today)}>
                        <Text style={s.link}>回到本期</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                {tab === "dashboard" && (
                  <>
                    <View style={[s.statsRow, !roomy && { flexWrap: "wrap" }]}>
                      {[
                        {
                          label: "本期任務",
                          value: summary.total,
                          icon: "layers" as const,
                          color: C.green,
                          bg: C.mint,
                        },
                        {
                          label: "已完成",
                          value: summary.done,
                          icon: "check-circle" as const,
                          color: C.green,
                          bg: theme.colors.mint,
                        },
                        {
                          label: "待完成",
                          value: summary.remaining,
                          icon: "clock" as const,
                          color: C.orange,
                          bg: theme.colors.warningBg,
                        },
                        {
                          label: "每日連續達標",
                          value: streak(tasks, today),
                          icon: "zap" as const,
                          color: theme.colors.orange,
                          bg: theme.colors.warningBg,
                        },
                      ].map((metric, i) => (
                        <View
                          key={metric.label}
                          style={[
                            s.metric,
                            !roomy && { flexBasis: "46%", padding: 17 },
                          ]}
                        >
                          <View style={s.between}>
                            <Text style={s.metricLabel}>{metric.label}</Text>
                            <View
                              style={[
                                s.metricIcon,
                                { backgroundColor: metric.bg },
                              ]}
                            >
                              <Icon
                                name={metric.icon}
                                size={16}
                                color={metric.color}
                              />
                            </View>
                          </View>
                          <Text style={s.metricNumber}>
                            {metric.value}
                            <Text style={s.unit}>
                              {i === 3 ? " 天" : " 項"}
                            </Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                    <ActivityDashboard
                      tasks={tasks}
                      today={today}
                      selectedDate={anchor}
                      disabled={loadFailed}
                      onToggleTask={updateTask}
                      onAddDaily={() => {
                        setFrequency("daily");
                        setEditor("new");
                      }}
                      onSelectDay={(date) => {
                        setAnchor(date);
                        setFrequency("daily");
                        setFilter("all");
                        setSearch("");
                      }}
                    />
                    <View
                      style={[
                        s.chartsRow,
                        !roomy && { flexDirection: "column" },
                      ]}
                    >
                      <View style={[s.card, { flex: 1 }]}>
                        <View style={s.between}>
                          <Text style={s.cardTitle}>本期完成進度</Text>
                        </View>
                        <View style={s.progressBody}>
                          <Ring rate={summary.rate} />
                          <View style={{ gap: 10, flex: 1 }}>
                            <View style={s.row}>
                              <View style={s.legendDot} />
                              <Text style={s.caption}>
                                已完成 {summary.done}
                              </Text>
                              <View
                                style={[
                                  s.legendDot,
                                  {
                                    backgroundColor: theme.colors.mint,
                                    marginLeft: 8,
                                  },
                                ]}
                              />
                              <Text style={s.caption}>
                                待完成 {summary.remaining}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={[s.card, { flex: 1.15 }]}>
                        <View style={s.between}>
                          <Text style={s.cardTitle}>完成率趨勢</Text>
                          <View style={s.row}>
                            <View style={s.legendDot} />
                            <Text style={s.caption}>完成率</Text>
                          </View>
                        </View>
                        <Text style={[s.caption, { marginTop: 8 }]}>
                          最近 7{" "}
                          {frequencies.find((f) => f.key === frequency)?.short}{" "}
                          ·{" "}
                          {frequencies.find((f) => f.key === frequency)?.label}
                          任務
                        </Text>
                        <View style={s.chart}>
                          <View style={s.axis}>
                            <Text style={s.axisText}>100%</Text>
                            <Text style={s.axisText}>50%</Text>
                            <Text style={s.axisText}>0%</Text>
                          </View>
                          <View style={s.plot}>
                            <View style={s.gridLines}>
                              {[0, 1, 2].map((n) => (
                                <View style={s.gridLine} key={n} />
                              ))}
                            </View>
                            <View style={s.bars}>
                              {history.map((h, i) => (
                                <View key={dateKey(h.date)} style={s.barColumn}>
                                  <Text
                                    style={[
                                      s.barValue,
                                      i === 6 && { color: C.green },
                                    ]}
                                  >
                                    {h.total ? `${h.rate}%` : "—"}
                                  </Text>
                                  <View style={s.barTrack}>
                                    <View
                                      style={[
                                        s.bar,
                                        {
                                          height: `${h.rate}%`,
                                          backgroundColor:
                                            i === 6
                                              ? C.green
                                              : theme.colors.disabled,
                                        },
                                      ]}
                                    />
                                  </View>
                                  <Text
                                    style={[
                                      s.axisText,
                                      { marginTop: 9 },
                                      i === 6 && {
                                        color: C.green,
                                        fontWeight: "700",
                                      },
                                    ]}
                                  >
                                    {frequency === "monthly"
                                      ? `${h.date.getMonth() + 1}月`
                                      : `${h.date.getMonth() + 1}/${h.date.getDate()}`}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  </>
                )}
                <View style={s.taskSection}>
                  <View style={s.between}>
                    <View style={s.row}>
                      <Text style={s.cardTitle}>任務清單</Text>
                      <View style={s.countPill}>
                        <Text style={s.countText}>{list.length}</Text>
                      </View>
                    </View>
                    <Text style={s.caption}>
                      {summary.done} / {summary.total} 已完成
                    </Text>
                  </View>
                  <View
                    style={[
                      s.taskToolbar,
                      !roomy && {
                        flexDirection: "column",
                        alignItems: "stretch",
                      },
                    ]}
                  >
                    <View style={s.row}>
                      {(
                        [
                          { key: "all", label: "全部" },
                          { key: "open", label: "待完成" },
                          { key: "done", label: "已完成" },
                        ] as const
                      ).map((f) => (
                        <Pressable
                          key={f.key}
                          onPress={() => setFilter(f.key)}
                          style={[
                            s.filterItem,
                            filter === f.key && s.filterActive,
                          ]}
                        >
                          <Text
                            style={[
                              s.caption,
                              filter === f.key && {
                                color: C.green,
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {f.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <View style={s.search}>
                      <Icon name="search" size={15} color={C.muted} />
                      <TextInput
                        accessibilityLabel="搜尋任務"
                        placeholder="搜尋任務"
                        placeholderTextColor={theme.colors.muted}
                        value={search}
                        onChangeText={setSearch}
                        style={s.searchInput}
                      />
                    </View>
                  </View>
                  <View style={s.taskList}>
                    {shown.length === 0 ? (
                      <View style={s.empty}>
                        <View style={s.emptyIcon}>
                          <Icon
                            name="coffee"
                            size={29}
                            color={theme.colors.muted}
                          />
                        </View>
                        <Text style={s.progressHeading}>
                          {list.length === 0
                            ? "尚無任務"
                            : "沒有符合條件的任務"}
                        </Text>
                        {list.length > 0 && (
                          <Text style={s.subtitle}>請調整篩選或搜尋條件。</Text>
                        )}
                        {list.length === 0 && (
                          <Button
                            title="建立第一個任務"
                            icon="plus"
                            onPress={openNew}
                          />
                        )}
                      </View>
                    ) : (
                      shown.map((task) => {
                        const done = isDone(task, anchor);
                        const cat = categoryStyle[task.category];
                        return (
                          <View key={task.id} style={s.taskRow}>
                            <Pressable
                              accessibilityRole="checkbox"
                              aria-checked={done}
                              aria-disabled={loadFailed}
                              hitSlop={12}
                              accessibilityLabel={`完成 ${task.title}`}
                              onPress={() => updateTask(task)}
                              style={[s.checkbox, done && s.checkboxDone]}
                            >
                              {done && (
                                <Icon
                                  name="check"
                                  size={15}
                                  color={theme.colors.onPrimary}
                                />
                              )}
                            </Pressable>
                            <View
                              style={[s.taskIcon, { backgroundColor: cat.bg }]}
                            >
                              <Icon
                                name={cat.icon}
                                size={20}
                                color={cat.color}
                              />
                            </View>
                            <Pressable
                              onPress={() => setEditor(task)}
                              style={{ flex: 1, gap: 6 }}
                            >
                              <Text
                                style={[
                                  s.taskTitle,
                                  done && {
                                    color: theme.colors.muted,
                                    textDecorationLine: "line-through",
                                  },
                                ]}
                              >
                                {task.title}
                              </Text>
                              <View style={s.row}>
                                <Text
                                  style={[
                                    s.categoryTag,
                                    {
                                      color: cat.color,
                                      backgroundColor: cat.bg,
                                    },
                                  ]}
                                >
                                  {task.category}
                                </Text>
                                <Text style={s.taskNote} numberOfLines={1}>
                                  {roomy
                                    ? task.note
                                    : frequencies.find(
                                        (f) => f.key === task.frequency,
                                      )?.label + "重複"}
                                </Text>
                              </View>
                            </Pressable>
                            {roomy && (
                              <Text
                                style={[
                                  s.statusLabel,
                                  done && { color: theme.colors.muted },
                                ]}
                              >
                                {done ? "已完成" : "待完成"}
                              </Text>
                            )}
                            <Pressable
                              accessibilityLabel={`編輯 ${task.title}`}
                              hitSlop={12}
                              onPress={() => setEditor(task)}
                            >
                              <Icon
                                name="more-horizontal"
                                color={theme.colors.muted}
                                size={20}
                              />
                            </Pressable>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              </>
            ) : (
              <View style={{ gap: 20 }}>
                <AppearanceSettings />
                <WebAppPanel />
                <View style={s.card}>
                  <Text style={s.cardTitle}>雲端同步與任務設定</Text>
                  <Text style={[s.subtitle, { marginVertical: 16 }]}>
                    任務、完成紀錄與記帳資料保存在遠端資料庫。同一個 ChatGPT
                    帳號可在手機與電腦同步；連線時每 10 秒及回到 App
                    時重新同步。
                  </Text>
                  <View style={s.settingLine}>
                    <Text style={s.bold}>目前任務</Text>
                    <Text style={s.caption}>
                      {tasks.length} 項{store.demo ? " · 範例資料" : ""}
                    </Text>
                  </View>
                  <View style={s.settingLine}>
                    <Text style={s.bold}>每週起始日</Text>
                    <Text style={s.caption}>星期一</Text>
                  </View>
                  <View style={s.settingLine}>
                    <Text style={s.bold}>完成紀錄</Text>
                    <Text style={s.caption}>每個任務每個週期一次</Text>
                  </View>
                  <Text style={[s.subtitle, { marginVertical: 16 }]}>
                    總覽的每日／每週／每月會統計對應頻率的任務。歷史週期可補登完成紀錄；連續達標僅計算所有每日任務皆完成的天數。
                  </Text>
                </View>
                <View style={s.card}>
                  <Text style={s.cardTitle}>重新開始</Text>
                  <Text style={[s.subtitle, { marginVertical: 16 }]}>
                    從雲端清除所有任務及完成紀錄，會同步到其他裝置，無法復原。
                  </Text>
                  <Button
                    title={
                      store.demo ? "清除範例，開始使用" : "清除所有任務資料"
                    }
                    secondary
                    onPress={() => setConfirm("reset")}
                  />
                </View>
                <View style={s.card}>
                  <Text style={s.cardTitle}>關於 HabitTracker</Text>
                  <Text style={[s.subtitle, { marginVertical: 16 }]}>
                    版本 1.0.0
                  </Text>
                  <Button
                    title="隱私權政策"
                    secondary
                    onPress={() => router.push("/privacy")}
                  />
                </View>
              </View>
            )}
          </ScrollView>
          {!desktop && (
            <SafeAreaView edges={["bottom"]} style={s.bottomNav}>
              <View style={s.bottomNavRow}>
                {nav.map((n) => (
                  <Pressable
                    accessibilityRole="tab"
                    aria-selected={tab === n.key}
                    key={n.key}
                    onPress={() => setTab(n.key)}
                    style={s.bottomNavItem}
                  >
                    <Icon
                      name={n.icon}
                      color={tab === n.key ? C.green : theme.colors.muted}
                    />
                    <Text
                      style={[
                        s.caption,
                        {
                          color: tab === n.key ? C.green : C.muted,
                          fontWeight: tab === n.key ? "700" : "400",
                        },
                      ]}
                    >
                      {n.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </SafeAreaView>
          )}
        </View>
      </View>
      {notice ? (
        <View style={s.toast}>
          <Icon name="check-circle" size={17} color={theme.colors.onPrimary} />
          <Text style={{ color: theme.colors.onPrimary }}>{notice}</Text>
        </View>
      ) : null}
      {editor && (
        <TaskEditor
          task={editor}
          frequency={frequency}
          disabled={loadFailed}
          saveError={storageError}
          onClose={() => setEditor(null)}
          onDelete={(t) => {
            setEditor(null);
            setConfirm(t);
          }}
          onSave={async (task) => {
            const latest = cloud.controller.getSnapshot().data;
            const saved = await cloud.controller.save(
              {
                ...latest,
                demo: false,
                tasks: latest.tasks.some((t) => t.id === task.id)
                  ? latest.tasks.map((t) => (t.id === task.id ? task : t))
                  : [...latest.tasks, task],
              },
              editorRevision.current,
            );
            if (!saved) {
              editorRevision.current = cloud.controller.getSnapshot().revision;
              return;
            }
            setFrequency(task.frequency);
            setAnchor(today);
            setFilter("all");
            setSearch("");
            setEditor(null);
            setNotice("任務已儲存");
          }}
        />
      )}
      <Modal
        transparent
        visible={!!confirm}
        animationType="fade"
        onRequestClose={() => setConfirm(null)}
      >
        <View style={s.overlay}>
          <View style={s.confirmCard}>
            <View style={s.emptyIcon}>
              <Icon name="trash-2" color={C.orange} size={26} />
            </View>
            <Text style={s.cardTitle}>
              {confirm === "reset"
                ? "確定清除所有任務？"
                : "確定刪除這個任務？"}
            </Text>
            <Text style={[s.subtitle, { marginVertical: 16 }]}>
              {confirm === "reset"
                ? "所有裝置的任務與完成紀錄將從雲端清除，無法復原。"
                : "這個任務與它的完成紀錄會一併刪除，無法復原。"}
            </Text>
            <View style={s.row}>
              <Button
                title="先保留"
                secondary
                onPress={() => setConfirm(null)}
              />
              <Button
                title="確認清除"
                onPress={async () => {
                  if (loadFailed) return;
                  const saved = await cloud.controller.save(
                    confirm === "reset"
                      ? emptyTasks
                      : {
                          ...store,
                          tasks: store.tasks.filter(
                            (t) => t.id !== (confirm as Task).id,
                          ),
                        },
                  );
                  if (!saved) return;
                  setConfirm(null);
                  setNotice("任務已清除");
                }}
              />
            </View>
            {loadFailed && (
              <Text style={{ color: theme.colors.danger, marginTop: 12 }}>
                請先重新開啟 App，恢復資料讀取。
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TaskEditor({
  task,
  frequency,
  onClose,
  onSave,
  onDelete,
  disabled,
  saveError,
}: {
  task: Task | "new" | null;
  frequency: Frequency;
  onClose: () => void;
  onSave: (t: Task) => void;
  saveError?: string;
  onDelete: (t: Task) => void;
  disabled: boolean;
}) {
  const { theme, styles: s } = useThemedStyles(createStyles);
  const C = theme.colors;
  const categoryStyle = getCategoryStyles(theme);
  const [title, setTitle] = useState(task && task !== "new" ? task.title : "");
  const [note, setNote] = useState(task && task !== "new" ? task.note : "");
  const [freq, setFreq] = useState(
    task && task !== "new" ? task.frequency : frequency,
  );
  const [category, setCategory] = useState<Category>(
    task && task !== "new" ? task.category : "生活",
  );
  const [error, setError] = useState("");
  const existing = task && task !== "new" ? task : null;
  const [newId] = useState(() => `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  return (
    <Modal
      transparent
      visible={!!task}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.overlay}
      >
        <View style={s.editor}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: theme.spacing.xl }}
          >
            <View style={s.between}>
              <Text style={s.cardTitle}>
                {existing ? "編輯任務" : "新增任務"}
              </Text>
              <Pressable
                accessibilityLabel="關閉任務編輯"
                onPress={onClose}
                hitSlop={12}
              >
                <Icon name="x" color={C.muted} />
              </Pressable>
            </View>
            <Text style={s.fieldLabel}>
              任務名稱 <Text style={{ color: C.orange }}>*</Text>
            </Text>
            <TextInput
              accessibilityLabel="任務名稱"
              placeholder="例如：每天閱讀 20 分鐘"
              maxLength={60}
              value={title}
              onChangeText={setTitle}
              style={s.input}
              placeholderTextColor={theme.colors.muted}
            />
            <Text style={s.fieldLabel}>重複頻率</Text>
            <View style={s.segment}>
              {frequencies.map((f) => (
                <Pressable
                  key={f.key}
                  disabled={!!existing}
                  onPress={() => setFreq(f.key)}
                  style={[
                    s.segmentItem,
                    freq === f.key && s.segmentActive,
                    { flex: 1 },
                  ]}
                >
                  <Text
                    style={[
                      s.segmentText,
                      freq === f.key && { color: C.green },
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {existing && (
              <Text style={[s.caption, { marginTop: 8 }]}>
                為保留紀錄，頻率無法變更。可另建不同頻率的任務。
              </Text>
            )}
            <Text style={s.fieldLabel}>生活分類</Text>
            <View style={s.categoryOptions}>
              {categories.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    s.categoryOption,
                    category === c && {
                      borderColor: C.green,
                      backgroundColor: C.mint,
                    },
                  ]}
                >
                  <Icon
                    name={categoryStyle[c].icon}
                    size={17}
                    color={categoryStyle[c].color}
                  />
                  <Text style={s.bold}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.fieldLabel}>
              備註 <Text style={s.caption}>（選填）</Text>
            </Text>
            <TextInput
              accessibilityLabel="任務備註"
              placeholder="選填"
              placeholderTextColor={theme.colors.muted}
              value={note}
              maxLength={160}
              onChangeText={setNote}
              multiline
              style={[s.input, { minHeight: 90, textAlignVertical: "top" }]}
            />
            {error || saveError ? (
              <Text style={{ color: theme.colors.danger, marginBottom: 15 }}>
                {error || saveError}
              </Text>
            ) : null}
            <Button
              title={existing ? "儲存變更" : "新增任務"}
              icon="plus"
              onPress={() => {
                if (disabled) {
                  setError("資料尚未成功讀取，請重新開啟 App 後再試。");
                  return;
                }
                if (!title.trim()) {
                  setError("請輸入任務名稱。");
                  return;
                }
                onSave({
                  id: existing?.id || newId,
                  title: title.trim(),
                  note: note.trim(),
                  frequency: freq,
                  category,
                  createdAt: existing?.createdAt || dateKey(new Date()),
                  completed: existing?.completed || [],
                });
              }}
            />
            {existing && (
              <Pressable
                onPress={() => onDelete(existing)}
                style={{ alignSelf: "center", padding: 18 }}
              >
                <Text
                  style={{
                    color: theme.colors.danger,
                    fontSize: 13 * theme.textScale,
                  }}
                >
                  刪除此任務
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(theme: AppTheme, ui: UiStyles) {
  const C = theme.colors;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 15,
      backgroundColor: C.bg,
    },
    appRow: { flex: 1, flexDirection: "row" },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    between: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    sidebar: {
      width: 239,
      backgroundColor: theme.colors.surface,
      borderRightWidth: 1,
      borderColor: C.line,
      padding: 24,
      paddingTop: 38,
    },
    logoRow: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
      marginBottom: 32,
    },
    logo: {
      width: 44,
      height: 44,
      backgroundColor: C.green,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    brand: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -1,
      color: C.ink,
    },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      gap: 13,
      borderRadius: 11,
      marginBottom: 9,
    },
    navActive: { backgroundColor: theme.colors.mint },
    navText: { color: C.muted, fontSize: 14 * theme.textScale },
    activeDot: {
      marginLeft: "auto",
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: C.green,
    },
    content: {
      paddingHorizontal: 43,
      paddingTop: 30,
      paddingBottom: 20,
      width: "100%",
      maxWidth: 1420,
      alignSelf: "center",
    },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
      gap: 6,
    },
    smallLeaf: {
      backgroundColor: theme.colors.mint,
      borderRadius: 7,
      padding: 6,
    },
    eyebrow: {
      fontSize: 9 * theme.textScale,
      color: theme.colors.muted,
      letterSpacing: 1.5,
    },
    dateChip: { flexDirection: "row", gap: 7, alignItems: "center" },
    pageHeading: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      marginBottom: 24,
      gap: 16,
    },
    title: { color: C.ink, fontSize: theme.font.title, fontWeight: "700" },
    subtitle: { ...ui.caption, marginTop: 7 },
    button: { ...ui.button, flexDirection: "row", gap: 7 },
    buttonText: { ...ui.buttonText },
    secondaryButton: { backgroundColor: C.mint },
    caption: { ...ui.caption },
    bold: { ...ui.label },
    link: { ...ui.link },
    demoBanner: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      backgroundColor: theme.colors.mint,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 24,
    },
    errorBox: {
      padding: 14,
      borderRadius: 9,
      backgroundColor: theme.colors.dangerBg,
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    controls: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      marginBottom: 22,
    },
    segment: {
      flexDirection: "row",
      backgroundColor: theme.colors.mint,
      padding: 4,
      borderRadius: 10,
    },
    segmentItem: {
      paddingHorizontal: 25,
      paddingVertical: 9,
      borderRadius: 7,
      alignItems: "center",
    },
    segmentActive: {
      backgroundColor: C.white,
      boxShadow: "0px 2px 4px #243D2C08",
    },
    segmentText: { color: theme.colors.muted, fontSize: 12 * theme.textScale },
    periodControls: { flexDirection: "row", alignItems: "center", gap: 14 },
    statsRow: { flexDirection: "row", gap: 16, marginBottom: 21 },
    metric: { ...ui.metric, flex: 1 },
    metricLabel: { color: theme.colors.muted, fontSize: 12 * theme.textScale },
    metricIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    metricNumber: { ...ui.metricNumber, marginTop: 10, marginBottom: 9 },
    unit: {
      fontSize: 11 * theme.textScale,
      color: theme.colors.muted,
      fontWeight: "400",
    },
    chartsRow: { flexDirection: "row", gap: 20, marginBottom: 29 },
    card: { ...ui.card },
    cardTitle: { ...ui.sectionTitle },
    progressBody: {
      flexDirection: "row",
      alignItems: "center",
      gap: 19,
      marginTop: 20,
    },
    ringNumber: {
      fontSize: 36 * theme.textScale,
      fontWeight: "600",
      color: C.ink,
      letterSpacing: -1,
    },
    progressHeading: { ...ui.sectionTitle },
    legendDot: {
      width: 6,
      height: 6,
      borderRadius: 4,
      backgroundColor: C.green,
    },
    chart: { flexDirection: "row", height: 143, marginTop: 24, gap: 12 },
    axis: { justifyContent: "space-between", paddingBottom: 23 },
    axisText: { color: theme.colors.muted, fontSize: 9 * theme.textScale },
    plot: { flex: 1 },
    gridLines: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      paddingBottom: 23,
      justifyContent: "space-between",
    },
    gridLine: { height: 1, backgroundColor: theme.colors.line },
    bars: {
      flex: 1,
      flexDirection: "row",
      gap: 7,
      justifyContent: "space-around",
    },
    barColumn: { alignItems: "center", flex: 1 },
    barValue: {
      height: 18,
      color: theme.colors.muted,
      fontSize: 9 * theme.textScale,
    },
    barTrack: {
      flex: 1,
      width: "65%",
      maxWidth: 27,
      justifyContent: "flex-end",
    },
    bar: { width: "100%", borderTopLeftRadius: 5, borderTopRightRadius: 5 },
    taskSection: { gap: 17 },
    countPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: theme.colors.mint,
      borderRadius: 5,
    },
    countText: {
      color: theme.colors.secondary,
      fontSize: 10 * theme.textScale,
      fontWeight: "600",
    },
    taskToolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
    },
    filterItem: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 7 },
    filterActive: { backgroundColor: theme.colors.mint },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.colors.line,
      borderRadius: theme.radius.control,
      backgroundColor: theme.colors.bg,
    },
    searchInput: {
      fontSize: theme.font.body,
      color: C.ink,
      minWidth: 145,
      padding: 0,
      flex: 1,
    },
    taskList: { ...ui.card, overflow: "hidden", padding: 0 },
    taskRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 19,
      gap: 15,
      borderBottomWidth: 1,
      borderBottomColor: C.line,
    },
    checkbox: { ...ui.checkbox },
    checkboxDone: {
      backgroundColor: theme.colors.green,
      borderColor: theme.colors.green,
    },
    taskIcon: {
      width: 41,
      height: 41,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    taskTitle: {
      color: C.ink,
      fontSize: theme.font.body,
      fontWeight: "500",
      lineHeight: 23 * theme.textScale,
    },
    categoryTag: {
      fontSize: theme.font.small,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: "hidden",
    },
    taskNote: { ...ui.caption, flexShrink: 1 },
    statusLabel: { ...ui.small, marginRight: 11 },
    bottomNav: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderColor: C.line,
    },
    bottomNavRow: { flexDirection: "row", paddingTop: 13, paddingBottom: 9 },
    bottomNavItem: { flex: 1, alignItems: "center", gap: 5 },
    empty: { alignItems: "center", padding: 34, gap: 12 },
    emptyIcon: {
      backgroundColor: theme.colors.mint,
      padding: 15,
      borderRadius: 20,
      alignSelf: "center",
      marginBottom: 12,
    },
    settingLine: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderColor: C.line,
    },
    overlay: { ...ui.overlay },
    editor: { ...ui.dialog, overflow: "hidden", padding: 0 },
    fieldLabel: {
      ...ui.label,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    input: { ...ui.input, marginBottom: 6 },
    categoryOptions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    categoryOption: {
      ...ui.secondaryButton,
      flex: 1,
      minWidth: 64,
      paddingHorizontal: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: theme.colors.line,
    },
    confirmCard: { ...ui.dialog },
    toast: {
      position: "absolute",
      bottom: 100,
      alignSelf: "center",
      backgroundColor: C.green,
      borderRadius: 10,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      boxShadow: "0px 4px 15px #15312520",
    },
  });
}
