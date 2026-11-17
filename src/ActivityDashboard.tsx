import { type ComponentRef, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { AppTheme, UiStyles } from "./theme";
import { useThemedStyles } from "./Appearance";
import {
  available,
  dailyActivity,
  dateKey,
  isDone,
  localDate,
  monthCells,
  periodStart,
  shiftPeriod,
  Task,
  yearActivity,
} from "./domain";

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
const statusLabels = {
  complete: "全部完成",
  partial: "部分完成",
  missed: "未完成",
  pending: "今日待完成",
  unscheduled: "未安排每日任務",
  future: "尚未開始",
};
type Props = {
  tasks: Task[];
  today: Date;
  selectedDate: Date;
  onSelectDay: (date: Date) => void;
  onToggleTask: (task: Task, date: Date) => void;
  onAddDaily: () => void;
  disabled: boolean;
};

export default function ActivityDashboard({
  tasks,
  today,
  selectedDate,
  onSelectDay,
  onToggleTask,
  onAddDaily,
  disabled,
}: Props) {
  const { theme, styles: styles } = useThemedStyles(createStyles);
  const heatColors = theme.heatmap;
  const [month, setMonth] = useState(() => periodStart(today, "monthly"));
  const [wide, setWide] = useState(false);
  const [gridWidth, setGridWidth] = useState(300);
  const heatScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const todayKey = dateKey(today);
  const selectedKey = dateKey(selectedDate);
  const year = month.getFullYear();
  const model = useMemo(
    () => yearActivity(tasks, year, localDate(todayKey)),
    [tasks, year, todayKey],
  );
  const firstOffset = (new Date(year, 0, 1, 12).getDay() + 6) % 7;
  const columnCount = Math.ceil((firstOffset + model.days.length) / 7);
  const stride = Math.max(
    14,
    Math.min(19, Math.floor((gridWidth - 33) / columnCount)),
  );
  const weeks = Array.from({ length: columnCount }, (_, week) =>
    Array.from(
      { length: 7 },
      (_, weekday) => model.days[week * 7 + weekday - firstOffset],
    ),
  );
  const monthLabels = Array.from({ length: 12 }, (_, m) => ({
    label: `${m + 1}月`,
    column: Math.floor(
      (firstOffset + model.days.findIndex((d) => d.date.getMonth() === m)) / 7,
    ),
  }));
  const earliestYear = tasks.reduce(
    (earliest, task) =>
      Math.min(earliest, localDate(task.createdAt).getFullYear()),
    today.getFullYear(),
  );
  const selected = dailyActivity(tasks, selectedDate, today);
  const dailyTasks = tasks.filter(
    (task) => task.frequency === "daily" && available(task, selectedDate),
  );
  const cells = monthCells(year, month.getMonth());
  const monthSummary = cells
    .filter((day): day is Date => !!day)
    .map((day) => dailyActivity(tasks, day, today));
  const completeDays = monthSummary.filter(
    (day) => day.status === "complete",
  ).length;
  const elapsedDays = monthSummary.filter((day) => day.total > 0).length;
  const chooseDay = (date: Date) => {
    setMonth(periodStart(date, "monthly"));
    onSelectDay(date);
  };
  const icon = (
    name: React.ComponentProps<typeof Feather>["name"],
    color: string = theme.colors.muted,
    size = 16,
  ) => <Feather name={name} size={size} color={color} />;
  const scrollToRelevantDate = () => {
    const focus =
      selectedDate.getFullYear() === year
        ? selectedKey
        : year === today.getFullYear()
          ? todayKey
          : `${year}-12-31`;
    const index = model.days.findIndex((day) => day.key === focus);
    heatScroll.current?.scrollTo({
      x: Math.max(
        0,
        Math.floor((firstOffset + index) / 7) * stride - gridWidth + 90,
      ),
      animated: false,
    });
  };
  return (
    <View
      style={styles.section}
      onLayout={(event) => setWide(event.nativeEvent.layout.width >= 740)}
    >
      <View style={styles.heatCard}>
        <View style={styles.header}>
          <View>
            <Text style={styles.heatTitle}>年度活躍紀錄</Text>
          </View>
          <View style={styles.yearPicker}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="活躍圖上一年"
              disabled={year <= earliestYear}
              onPress={() => setMonth(new Date(year - 1, 11, 1, 12))}
              style={styles.arrow}
            >
              {icon(
                "chevron-left",
                year <= earliestYear
                  ? theme.colors.disabled
                  : theme.colors.muted,
              )}
            </Pressable>
            <Text style={styles.yearText}>{year}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="活躍圖下一年"
              disabled={year >= today.getFullYear()}
              onPress={() =>
                setMonth(
                  new Date(
                    year + 1,
                    year + 1 === today.getFullYear() ? today.getMonth() : 11,
                    1,
                    12,
                  ),
                )
              }
              style={styles.arrow}
            >
              {icon(
                "chevron-right",
                year >= today.getFullYear()
                  ? theme.colors.disabled
                  : theme.colors.muted,
              )}
            </Pressable>
          </View>
        </View>
        <View style={styles.heatStats}>
          {[
            { number: model.completed, unit: "項", label: "完成任務" },
            { number: model.activeDays, unit: "天", label: "活躍天數" },
            {
              number: model.longestStreak,
              unit: "天",
              label: "最長連續達標",
            },
          ].map((item) => (
            <View key={item.label} style={styles.heatMetric}>
              <Text style={styles.heatNumber}>
                {item.number}
                <Text style={styles.heatUnit}> {item.unit}</Text>
              </Text>
              <Text style={styles.heatCaption}>{item.label}</Text>
            </View>
          ))}
        </View>
        <View
          onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
          style={styles.heatChart}
        >
          <View style={{ width: 28, paddingTop: 26, gap: stride - 11 }}>
            {weekdays.map((day, index) => (
              <Text
                key={day}
                style={[
                  styles.weekdayLabel,
                  {
                    height: 11,
                    lineHeight: 11 * theme.textScale,
                    opacity: index % 2 === 0 ? 1 : 0,
                  },
                ]}
              >
                {day}
              </Text>
            ))}
          </View>
          <ScrollView
            horizontal
            ref={heatScroll}
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={scrollToRelevantDate}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <View style={{ width: columnCount * stride + 4 }}>
              <View style={{ height: 26 }}>
                {monthLabels.map((m) => (
                  <Text
                    key={m.label}
                    style={[
                      styles.monthLabel,
                      { position: "absolute", left: m.column * stride },
                    ]}
                  >
                    {m.label}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: "row" }}>
                {weeks.map((week, i) => (
                  <View key={i} style={{ width: stride, gap: stride - 11 }}>
                    {week.map((day, j) =>
                      day ? (
                        <Pressable
                          key={day.key}
                          accessibilityRole="button"
                          accessibilityLabel={`${day.key} 每日任務完成 ${day.done}/${day.total}，${statusLabels[day.status]}`}
                          accessibilityState={{
                            disabled: day.status === "future",
                          }}
                          disabled={day.status === "future"}
                          onPress={() => chooseDay(day.date)}
                          style={[
                            styles.heatCell,
                            {
                              backgroundColor:
                                day.status === "future"
                                  ? theme.colors.bg
                                  : heatColors[day.level],
                            },
                            day.key === selectedKey && styles.heatSelected,
                            day.status === "future" && {
                              borderWidth: 1,
                              borderColor: theme.colors.line,
                            },
                          ]}
                        />
                      ) : (
                        <View key={`blank-${j}`} style={styles.heatCell} />
                      ),
                    )}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
        <View style={styles.heatFooter}>
          <Text style={styles.heatCaption}>
            每格代表一天 · 依每日任務完成比例著色
            {!wide ? " · 可左右滑動" : ""}
          </Text>
          <View style={styles.legend}>
            <Text style={styles.heatCaption}>少</Text>
            {heatColors.map((color) => (
              <View
                key={color}
                style={[styles.heatCell, { backgroundColor: color }]}
              />
            ))}
            <Text style={styles.heatCaption}>多</Text>
          </View>
        </View>
      </View>
      <View style={[styles.calendarRow, !wide && { flexDirection: "column" }]}>
        <View style={[styles.card, { flex: 1.05 }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.cardTitle}>Daily Routine 日曆</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => chooseDay(today)}
              style={styles.todayButton}
            >
              <Text style={styles.link}>今天</Text>
            </Pressable>
          </View>
          <View style={styles.monthHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="日曆上一個月"
              onPress={() => setMonth(shiftPeriod(month, "monthly", -1))}
              style={styles.arrow}
            >
              {icon("chevron-left")}
            </Pressable>
            <Text style={styles.monthTitle}>
              {year} 年 {month.getMonth() + 1} 月
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="日曆下一個月"
              disabled={
                dateKey(month) >= dateKey(periodStart(today, "monthly"))
              }
              onPress={() => setMonth(shiftPeriod(month, "monthly", 1))}
              style={styles.arrow}
            >
              {icon(
                "chevron-right",
                dateKey(month) >= dateKey(periodStart(today, "monthly"))
                  ? theme.colors.disabled
                  : theme.colors.muted,
              )}
            </Pressable>
          </View>
          <View style={styles.calendarGrid}>
            {weekdays.map((day) => (
              <View key={day} style={styles.daySlot}>
                <Text style={styles.weekday}>{day}</Text>
              </View>
            ))}
            {cells.map((date, index) => {
              if (!date)
                return <View key={`blank-${index}`} style={styles.daySlot} />;
              const day = dailyActivity(tasks, date, today);
              return (
                <Pressable
                  key={day.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.key} ${statusLabels[day.status]} ${day.done}/${day.total}`}
                  aria-selected={day.key === selectedKey}
                  disabled={day.status === "future"}
                  onPress={() => chooseDay(date)}
                  style={[
                    styles.daySlot,
                    { paddingVertical: 5 },
                    day.key === selectedKey && styles.selectedSlot,
                  ]}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      day.status === "complete" && styles.completeDay,
                      day.status === "partial" && styles.partialDay,
                      day.status === "missed" && styles.missedDay,
                      day.key === todayKey && styles.todayCircle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        day.status === "complete" && {
                          color: theme.colors.onPrimary,
                          fontWeight: "700",
                        },
                        day.status === "future" && {
                          color: theme.colors.disabled,
                        },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {day.status === "complete" && (
                      <View style={styles.checkMark}>
                        {icon("check", theme.colors.onPrimary, 9)}
                      </View>
                    )}
                    {day.status === "partial" && (
                      <View style={styles.partialDot} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.calendarLegend}>
            {[
              { name: "全部完成", style: styles.completeDay },
              { name: "部分完成", style: styles.partialDay },
              { name: "未完成", style: styles.missedDay },
            ].map((item) => (
              <View style={styles.legend} key={item.name}>
                <View style={[styles.legendCircle, item.style]} />
                <Text style={styles.caption}>{item.name}</Text>
              </View>
            ))}
          </View>
          <View style={styles.monthFoot}>
            <Text style={styles.caption}>
              本月已達標 <Text style={styles.strong}>{completeDays}</Text> /{" "}
              {elapsedDays} 天
            </Text>
            <Text style={styles.caption}>不計未來與無任務日</Text>
          </View>
        </View>
        <View style={[styles.card, { flex: 1 }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.cardTitle}>
                {selectedDate.getMonth() + 1} 月 {selectedDate.getDate()} 日{" "}
                <Text style={styles.caption}>
                  星期{weekdays[(selectedDate.getDay() + 6) % 7]}
                </Text>
              </Text>
            </View>
            <View
              style={[
                styles.statusTag,
                selected.status === "complete" && {
                  backgroundColor: theme.colors.mint,
                },
              ]}
            >
              <Text style={styles.link}>{statusLabels[selected.status]}</Text>
            </View>
          </View>
          <View style={styles.detailProgress}>
            <Text style={styles.detailNumber}>
              {selected.done}
              <Text style={styles.detailUnit}>
                {" "}
                / {selected.total} 項每日任務
              </Text>
            </Text>
            <Text style={styles.detailPercent}>{selected.rate}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${selected.rate}%` }]}
            />
          </View>
          <ScrollView
            style={{ maxHeight: 295 }}
            contentContainerStyle={{ paddingVertical: 12 }}
            nestedScrollEnabled
          >
            {dailyTasks.map((task) => {
              const done = isDone(task, selectedDate);
              return (
                <Pressable
                  key={task.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${selectedKey} 完成 ${task.title}`}
                  aria-checked={done}
                  disabled={disabled || selected.status === "future"}
                  onPress={() => onToggleTask(task, selectedDate)}
                  style={styles.routineRow}
                >
                  <View style={[styles.checkbox, done && styles.checked]}>
                    {done && icon("check", theme.colors.onPrimary, 12)}
                  </View>
                  <Text
                    style={[
                      styles.routineText,
                      done && {
                        color: theme.colors.muted,
                        textDecorationLine: "line-through",
                      },
                    ]}
                  >
                    {task.title}
                  </Text>
                  <Text style={styles.category}>{task.category}</Text>
                </Pressable>
              );
            })}
            {!dailyTasks.length && (
              <View style={styles.empty}>
                {icon("coffee", theme.colors.muted, 27)}
                <Text style={styles.caption}>這一天還沒有安排每日任務。</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onAddDaily}
                  style={styles.todayButton}
                >
                  <Text style={styles.link}>＋ 新增每日任務</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
          <Text style={styles.detailNote}>
            所有每日任務皆完成，才算當天達標。週／月任務不列入本圖統計。
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme, ui: UiStyles) {
  return StyleSheet.create({
    section: { gap: theme.spacing.xl, marginBottom: theme.spacing.xl },
    heatCard: { ...ui.card },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    heatTitle: { ...ui.sectionTitle },
    yearPicker: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.mint,
      borderRadius: theme.radius.control,
    },
    arrow: { padding: 8 },
    yearText: { ...ui.label },
    heatStats: {
      flexDirection: "row",
      marginTop: 24,
      marginBottom: 27,
      gap: 12,
      flexWrap: "wrap",
      width: "100%",
      maxWidth: 430,
    },
    heatMetric: { minWidth: 70, flex: 1 },
    heatNumber: { ...ui.metricNumber },
    heatUnit: { ...ui.caption, fontWeight: "400" },
    heatCaption: { ...ui.caption },
    heatChart: { flexDirection: "row" },
    weekdayLabel: { ...ui.small },
    monthLabel: { ...ui.small },
    heatCell: { width: 11, height: 11, borderRadius: 2 },
    heatSelected: { borderWidth: 1.5, borderColor: theme.colors.ink },
    heatFooter: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 10,
    },
    legend: { flexDirection: "row", alignItems: "center", gap: 5 },
    calendarRow: { flexDirection: "row", gap: theme.spacing.xl },
    card: { ...ui.card },
    cardTitle: { ...ui.sectionTitle },
    caption: { ...ui.caption, marginTop: 2 },
    link: { ...ui.link },
    todayButton: { ...ui.secondaryButton },
    monthHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 22,
      marginBottom: 13,
    },
    monthTitle: { ...ui.label },
    calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
    daySlot: {
      width: "14.285714%",
      minHeight: 28,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 9,
    },
    weekday: { ...ui.small, marginBottom: theme.spacing.sm },
    dayCircle: {
      width: 33,
      height: 33,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 17,
      borderWidth: 1,
      borderColor: "transparent",
    },
    dayNumber: {
      color: theme.colors.secondary,
      fontSize: theme.font.label,
      fontVariant: ["tabular-nums"],
    },
    completeDay: {
      backgroundColor: theme.colors.green,
      borderColor: theme.colors.green,
    },
    partialDay: {
      backgroundColor: theme.colors.warningBg,
      borderColor: theme.colors.warningBorder,
    },
    missedDay: {
      backgroundColor: theme.colors.bg,
      borderColor: theme.colors.line,
    },
    todayCircle: { borderWidth: 2, borderColor: theme.colors.ink },
    selectedSlot: { backgroundColor: theme.colors.mint },
    checkMark: {
      position: "absolute",
      right: 1,
      bottom: 1,
      backgroundColor: theme.colors.green,
      borderRadius: 6,
    },
    partialDot: {
      position: "absolute",
      bottom: 3,
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.colors.orange,
    },
    calendarLegend: {
      flexDirection: "row",
      gap: 14,
      justifyContent: "center",
      marginTop: 20,
      flexWrap: "wrap",
    },
    legendCircle: { width: 9, height: 9, borderRadius: 5, borderWidth: 1 },
    monthFoot: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderColor: theme.colors.line,
      paddingTop: 12,
      marginTop: 16,
      gap: 8,
      flexWrap: "wrap",
    },
    strong: { ...ui.link },
    statusTag: {
      backgroundColor: theme.colors.mint,
      padding: 7,
      borderRadius: 6,
    },
    detailProgress: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginTop: 25,
    },
    detailNumber: { ...ui.metricNumber },
    detailUnit: { ...ui.caption, fontWeight: "400" },
    detailPercent: { ...ui.link },
    progressTrack: {
      height: 5,
      backgroundColor: theme.colors.bg,
      borderRadius: 3,
      marginTop: 11,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.green,
      borderRadius: 3,
    },
    routineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: theme.colors.line,
      minHeight: 44,
    },
    checkbox: { ...ui.checkbox },
    checked: {
      backgroundColor: theme.colors.green,
      borderColor: theme.colors.green,
    },
    routineText: { ...ui.body, flex: 1 },
    category: { ...ui.small },
    detailNote: { ...ui.small, marginTop: 10 },
    empty: { alignItems: "center", paddingVertical: 27, gap: 14 },
  });
}
