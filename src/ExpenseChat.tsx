import { type ComponentRef, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import type { AppTheme, UiStyles } from "./theme";
import { useThemedStyles } from "./Appearance";
import {
  applyAgentPlan,
  emptyExpenseStore,
  Expense,
  expenseCategories,
  ExpenseCategory,
  ExpenseStore,
  money,
  parseAmount,
  readExpenseStore,
  validateExpense,
} from "./expenses";

const KEY = "slowday.expenses.v1";
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function id() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function Glyph({
  name,
  color,
  size = 19,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  color?: string;
  size?: number;
}) {
  const { theme } = useThemedStyles(createStyles);
  return (
    <Feather name={name} color={color ?? theme.colors.green} size={size} />
  );
}
function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const { theme, styles: s } = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        secondary && s.secondary,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.actionText, secondary && { color: theme.colors.green }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ExpenseChat() {
  const { theme, styles: s } = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const [store, setStore] = useState<ExpenseStore>(emptyExpenseStore);
  const current = useRef(store);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [editor, setEditor] = useState<Expense | "new" | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const alive = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const chatScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    alive.current = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!alive.current) return;
        const data = raw ? readExpenseStore(raw) : emptyExpenseStore();
        current.current = data;
        setStore(data);
      })
      .catch(() => {
        if (alive.current) {
          setLoadFailed(true);
          setError("記帳資料讀取失敗，已停止寫入，請重新開啟頁面後再試。");
        }
      })
      .finally(() => {
        if (alive.current) setReady(true);
      });
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);
  const checkConnection = () => {
    return fetch("/api/expenses/status", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (alive.current) setConnected(body?.configured === true);
      })
      .catch(() => {
        if (alive.current) setConnected(false);
      })
      .finally(() => {
        if (alive.current) setChecking(false);
      });
  };
  useEffect(() => {
    void checkConnection();
  }, []);
  async function persist(next: ExpenseStore) {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    current.current = next;
    if (alive.current) setStore(next);
  }
  async function processMessage(requestId: string) {
    const snapshot = current.current;
    const index = snapshot.messages.findIndex(
      (m) => m.requestId === requestId && m.role === "user",
    );
    if (index < 0) return;
    const message = snapshot.messages[index];
    if (!connected) {
      setError("訊息已保存為待處理；OpenClaw 尚未連線，目前沒有自動記帳。");
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 65000);
    try {
      const response = await fetch("/api/expenses/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          requestId,
          message: message.text,
          today: todayKey(),
          history: snapshot.messages
            .slice(0, index)
            .filter((m) => m.state !== "waiting" && m.state !== "failed")
            .slice(-12)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "OpenClaw 暫時無法處理，尚未記帳。");
      if (!alive.current) return;
      await persist(
        applyAgentPlan(
          current.current,
          requestId,
          result,
          new Date().toISOString(),
        ),
      );
      setError("");
    } catch (cause) {
      if (!alive.current) return;
      const message =
        cause instanceof Error && cause.name !== "AbortError"
          ? cause.message
          : "處理逾時，尚未記帳；可稍後重試同一則訊息。";
      setError(message);
      try {
        await persist({
          ...current.current,
          messages: current.current.messages.map((m) =>
            m.requestId === requestId && m.role === "user"
              ? { ...m, state: "failed" }
              : m,
          ),
        });
      } catch {
        setError("保存失敗，請保留頁面並稍後重試。");
      }
    } finally {
      clearTimeout(timer);
      abort.current = null;
    }
  }
  async function send(retryId?: string) {
    if (lock.current || loadFailed || !ready || (!retryId && !text.trim()))
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const requestId = retryId || id();
      if (!retryId) {
        await persist({
          ...current.current,
          messages: [
            ...current.current.messages,
            {
              id: requestId,
              requestId,
              role: "user",
              text: text.trim(),
              createdAt: new Date().toISOString(),
              state: "waiting",
            },
          ],
        });
        if (alive.current) setText("");
      }
      await processMessage(requestId);
    } catch {
      if (alive.current) setError("訊息保存失敗，尚未送出；請稍後再試。");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function saveExpense(draft: Expense) {
    if (lock.current || loadFailed) return;
    lock.current = true;
    setBusy(true);
    try {
      const entries = current.current.entries.some((e) => e.id === draft.id)
        ? current.current.entries.map((e) => (e.id === draft.id ? draft : e))
        : [...current.current.entries, draft];
      await persist({ ...current.current, entries });
      setEditor(null);
      setError("");
    } catch {
      setError("消費紀錄保存失敗，尚未記帳。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const today = todayKey();
  const month = today.slice(0, 7);
  const entries = [...store.entries].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
  const monthEntries = entries.filter((e) => e.date.startsWith(month));
  const todayTotal = entries
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + e.amountMinor, 0);
  const monthTotal = monthEntries.reduce((sum, e) => sum + e.amountMinor, 0);
  const waiting = store.messages.filter(
    (m) => m.role === "user" && (m.state === "waiting" || m.state === "failed"),
  ).length;
  if (!ready)
    return (
      <View style={s.loading}>
        <ActivityIndicator color={theme.colors.green} />
        <Text style={s.caption}>載入中…</Text>
      </View>
    );
  return (
    <View style={{ gap: 20 }}>
      <View style={s.connection}>
        <View
          style={[
            s.dot,
            {
              backgroundColor: connected
                ? theme.colors.green
                : theme.colors.orange,
            },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.connectionTitle}>
            {checking
              ? "正在檢查連線…"
              : connected
                ? "OpenClaw 已設定"
                : "OpenClaw 待連線"}
          </Text>
          <Text style={s.caption}>
            {connected
              ? "送出訊息後，會交由 OpenClaw agent 辨識並記錄消費。"
              : "未啟用自動記帳，可保存訊息或手動新增。"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="重新檢查 OpenClaw 連線"
          onPress={() => {
            setChecking(true);
            void checkConnection();
          }}
          style={s.iconButton}
        >
          <Glyph name="refresh-cw" size={16} />
        </Pressable>
      </View>
      {error ? (
        <View style={s.error}>
          <Glyph name="info" color={theme.colors.orange} size={16} />
          <Text
            style={{
              color: theme.colors.orange,
              fontSize: 12 * theme.textScale,
              lineHeight: 20 * theme.textScale,
              flex: 1,
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}
      <View style={s.metrics}>
        {[
          { name: "今日支出", value: money(todayTotal), hint: today },
          {
            name: "本月支出",
            value: money(monthTotal),
            hint: `${monthEntries.length} 筆消費 · TWD`,
          },
          { name: "待處理訊息", value: String(waiting), hint: "尚未自動記帳" },
        ].map((item) => (
          <View key={item.name} style={s.metric}>
            <Text style={s.caption}>{item.name}</Text>
            <Text style={s.metricValue}>{item.value}</Text>
            <Text style={s.tiny}>{item.hint}</Text>
          </View>
        ))}
      </View>
      <View style={[s.columns, !wide && { flexDirection: "column" }]}>
        <View style={[s.chatCard, { flex: 1.4 }]}>
          {!inRoom ? (
            <View style={s.lobby}>
              <View style={s.lobbyIcon}>
                <Glyph name="message-circle" size={31} />
              </View>
              <Text style={s.roomTitle}>記帳聊天室</Text>
              <Text style={s.caption}>
                輸入品項與金額，例如：午餐 120，咖啡 65
              </Text>
              <Action
                label={
                  store.messages.length ? "回到記帳聊天室" : "進入記帳聊天室"
                }
                onPress={() => setInRoom(true)}
              />
              <Text style={s.caption}>
                {store.messages.length
                  ? `${store.messages.length} 則訊息`
                  : "預設幣別 TWD"}
              </Text>
            </View>
          ) : (
            <>
              <View style={s.roomHeader}>
                <View style={s.row}>
                  <View style={s.botIcon}>
                    <Glyph name="message-circle" size={18} />
                  </View>
                  <View>
                    <Text style={s.bold}>日常記帳室</Text>
                    <Text style={s.tiny}>
                      {connected
                        ? "由 OpenClaw agent 處理"
                        : "OpenClaw 尚未連線"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="離開記帳聊天室"
                  onPress={() => setInRoom(false)}
                  style={s.iconButton}
                >
                  <Glyph name="log-out" color={theme.colors.muted} size={18} />
                </Pressable>
              </View>
              <ScrollView
                ref={chatScroll}
                style={{ height: 395 }}
                contentContainerStyle={s.messages}
                onContentSizeChange={() =>
                  chatScroll.current?.scrollToEnd({ animated: false })
                }
                keyboardShouldPersistTaps="handled"
              >
                {store.messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      s.messageWrap,
                      message.role === "user"
                        ? { alignItems: "flex-end" }
                        : { alignItems: "flex-start" },
                    ]}
                  >
                    <View
                      style={[
                        s.bubble,
                        message.role === "user" && s.userBubble,
                      ]}
                    >
                      <Text
                        selectable
                        style={[
                          s.messageText,
                          message.role === "user" && {
                            color: theme.colors.onPrimary,
                          },
                        ]}
                      >
                        {message.text}
                      </Text>
                      {message.entryIds?.map((entryId) => {
                        const entry = store.entries.find(
                          (e) => e.id === entryId,
                        );
                        return entry ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`編輯消費 ${entry.item}`}
                            key={entryId}
                            onPress={() => setEditor(entry)}
                            style={s.receipt}
                          >
                            <Text style={s.bold}>{entry.item}</Text>
                            <Text style={s.bold}>
                              {money(entry.amountMinor)}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text key={entryId} style={s.tiny}>
                            此筆紀錄已刪除
                          </Text>
                        );
                      })}
                    </View>
                    <Text style={s.tiny}>
                      {new Date(message.createdAt).toLocaleTimeString("zh-TW", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {message.state === "waiting"
                        ? " · 待處理，尚未記帳"
                        : message.state === "failed"
                          ? " · 未記帳，可重試"
                          : message.state === "recorded"
                            ? " · 已處理"
                            : ""}
                    </Text>
                    {message.role === "user" &&
                      (message.state === "waiting" ||
                        message.state === "failed") && (
                        <Pressable
                          accessibilityRole="button"
                          disabled={!connected || busy}
                          onPress={() => void send(message.requestId)}
                          style={{ padding: 6 }}
                        >
                          <Text
                            style={[
                              s.link,
                              (!connected || busy) && {
                                color: theme.colors.disabled,
                              },
                            ]}
                          >
                            {connected
                              ? "重新交給 OpenClaw 處理"
                              : "連線後可重試"}
                          </Text>
                        </Pressable>
                      )}
                  </View>
                ))}
                {busy && (
                  <View style={s.row}>
                    <ActivityIndicator
                      color={theme.colors.green}
                      size="small"
                    />
                    <Text style={s.caption}>
                      {connected ? "正在交由 OpenClaw 整理…" : "正在保存訊息…"}
                    </Text>
                  </View>
                )}
              </ScrollView>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
              >
                <View style={s.composer}>
                  <TextInput
                    accessibilityLabel="消費聊天訊息"
                    placeholder="例如：午餐 120，咖啡 65"
                    placeholderTextColor={theme.colors.muted}
                    value={text}
                    onChangeText={setText}
                    maxLength={2000}
                    multiline
                    style={s.composeInput}
                    editable={!busy && !loadFailed}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="送出消費訊息"
                    disabled={busy || !text.trim() || loadFailed}
                    onPress={() => void send()}
                    style={[
                      s.send,
                      (busy || !text.trim() || loadFailed) && { opacity: 0.4 },
                    ]}
                  >
                    <Glyph
                      name="arrow-up"
                      color={theme.colors.onPrimary}
                      size={19}
                    />
                  </Pressable>
                </View>
                <Text style={s.composerNote}>
                  {connected
                    ? "預設幣別 TWD"
                    : "尚未連線，訊息只保存為待處理。"}
                </Text>
              </KeyboardAvoidingView>
            </>
          )}
        </View>
        <View style={[s.ledger, { flex: 1 }]}>
          <View style={s.between}>
            <View>
              <Text style={s.bold}>消費明細</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy || loadFailed}
              onPress={() => setEditor("new")}
              style={s.iconButton}
            >
              <Glyph name="plus" />
              <Text style={s.link}>手動新增</Text>
            </Pressable>
          </View>
          {entries.length ? (
            <ScrollView
              style={{ maxHeight: 490 }}
              contentContainerStyle={{ paddingTop: 14 }}
            >
              {entries.map((entry) => (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel={`編輯消費 ${entry.item}`}
                  onPress={() => setEditor(entry)}
                  style={s.ledgerRow}
                >
                  <View style={s.categoryIcon}>
                    <Glyph
                      name={
                        entry.category === "餐飲"
                          ? "coffee"
                          : entry.category === "交通"
                            ? "navigation"
                            : "shopping-bag"
                      }
                      size={17}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={s.bold}>{entry.item}</Text>
                    <Text style={s.tiny}>
                      {entry.date} · {entry.category} ·{" "}
                      {entry.source === "openclaw" ? "OpenClaw" : "手動"}
                    </Text>
                  </View>
                  <Text style={s.amount}>{money(entry.amountMinor)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={s.empty}>
              <Glyph name="book-open" size={29} color={theme.colors.muted} />
              <Text style={s.bold}>還沒有消費紀錄</Text>
            </View>
          )}
          <View style={s.ledgerFoot}>
            <Glyph name="lock" size={12} color={theme.colors.muted} />
            <Text style={s.tiny}>紀錄保存在此瀏覽器，尚無跨裝置同步。</Text>
          </View>
        </View>
      </View>
      {editor && (
        <ExpenseEditor
          entry={editor}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={(entry) => void saveExpense(entry)}
          onDelete={(entry) => {
            setEditor(null);
            setDeleting(entry);
          }}
        />
      )}
      <Modal
        transparent
        visible={!!deleting}
        animationType="fade"
        onRequestClose={() => setDeleting(null)}
      >
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.roomTitle}>刪除這筆消費？</Text>
            <Text style={s.description}>
              {deleting?.item} · {deleting ? money(deleting.amountMinor) : ""}
              {"\n"}將移除明細，聊天文字仍會保留。刪除後無法復原。
            </Text>
            <View style={s.row}>
              <Action
                label="先保留"
                secondary
                onPress={() => setDeleting(null)}
              />
              <Action
                label="確認刪除"
                disabled={busy}
                onPress={() => {
                  if (lock.current || loadFailed || !deleting) return;
                  lock.current = true;
                  setBusy(true);
                  void persist({
                    ...current.current,
                    entries: current.current.entries.filter(
                      (e) => e.id !== deleting.id,
                    ),
                  })
                    .then(() => setDeleting(null))
                    .catch(() => setError("刪除未保存，請稍後再試。"))
                    .finally(() => {
                      lock.current = false;
                      setBusy(false);
                    });
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ExpenseEditor({
  entry,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  entry: Expense | "new";
  busy: boolean;
  onClose: () => void;
  onSave: (entry: Expense) => void;
  onDelete: (entry: Expense) => void;
}) {
  const { theme, styles: s } = useThemedStyles(createStyles);
  const existing = entry === "new" ? null : entry;
  const [item, setItem] = useState(existing?.item || "");
  const [amount, setAmount] = useState(
    existing ? String(existing.amountMinor / 100) : "",
  );
  const [date, setDate] = useState(existing?.date || todayKey());
  const [category, setCategory] = useState<ExpenseCategory>(
    existing?.category || "其他",
  );
  const [error, setError] = useState("");
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.overlay}
      >
        <View style={s.dialog}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={s.between}>
              <Text style={s.roomTitle}>
                {existing ? "編輯消費紀錄" : "手動記下一筆"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="關閉消費編輯"
                onPress={onClose}
              >
                <Glyph name="x" color={theme.colors.muted} />
              </Pressable>
            </View>
            <Text style={s.field}>消費品項</Text>
            <TextInput
              accessibilityLabel="消費品項"
              placeholder="例如：午餐"
              value={item}
              onChangeText={setItem}
              maxLength={100}
              style={s.input}
            />
            <Text style={s.field}>金額 · 新台幣</Text>
            <TextInput
              accessibilityLabel="消費金額"
              placeholder="120"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              style={s.input}
            />
            <Text style={s.field}>消費日期</Text>
            <TextInput
              accessibilityLabel="消費日期"
              placeholder="YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
              style={s.input}
            />
            <Text style={s.field}>分類</Text>
            <View style={s.categories}>
              {expenseCategories.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    s.categoryChoice,
                    category === c && {
                      backgroundColor: theme.colors.mint,
                      borderColor: theme.colors.green,
                    },
                  ]}
                >
                  <Text style={s.link}>{c}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text style={s.errorText}>{error}</Text> : null}
            <Action
              label={busy ? "保存中…" : "儲存消費紀錄"}
              disabled={busy}
              onPress={() => {
                try {
                  const draft = validateExpense({
                    item,
                    amountMinor: parseAmount(amount),
                    currency: "TWD",
                    date,
                    category,
                  });
                  onSave({
                    ...existing,
                    ...draft,
                    id: existing?.id || id(),
                    createdAt: existing?.createdAt || new Date().toISOString(),
                    source: existing?.source || "manual",
                  });
                } catch (cause) {
                  setError(
                    cause instanceof Error ? cause.message : "請確認輸入內容。",
                  );
                }
              }}
            />
            {existing && (
              <Pressable
                disabled={busy}
                onPress={() => onDelete(existing)}
                style={{ padding: 18, alignItems: "center" }}
              >
                <Text
                  style={{
                    color: theme.colors.danger,
                    fontSize: 12 * theme.textScale,
                  }}
                >
                  刪除此筆消費
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
  return StyleSheet.create({
    loading: { padding: 50, alignItems: "center", gap: 15 },
    connection: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.mint,
      padding: 16,
      borderRadius: theme.radius.control,
      gap: 11,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    connectionTitle: {
      fontWeight: "600",
      color: theme.colors.secondary,
      fontSize: theme.font.label,
      marginBottom: 3,
    },
    caption: { ...ui.caption },
    tiny: { ...ui.small },
    iconButton: { ...ui.iconButton, flexDirection: "row", gap: 5 },
    error: {
      flexDirection: "row",
      backgroundColor: theme.colors.warningBg,
      borderRadius: 9,
      padding: 13,
      gap: 8,
    },
    metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    metric: { ...ui.metric, flex: 1, minWidth: 140 },
    metricValue: { ...ui.metricNumber, marginVertical: 9 },
    columns: { flexDirection: "row", gap: theme.spacing.xl },
    chatCard: { ...ui.card, overflow: "hidden", padding: 0 },
    lobby: {
      paddingVertical: 40,
      paddingHorizontal: 24,
      alignItems: "center",
      gap: 17,
    },
    lobbyIcon: {
      width: 67,
      height: 67,
      backgroundColor: theme.colors.mint,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    roomTitle: { ...ui.sectionTitle },
    description: { ...ui.body, textAlign: "center", marginVertical: 6 },
    action: { ...ui.button },
    actionText: { ...ui.buttonText },
    secondary: { backgroundColor: theme.colors.mint },
    roomHeader: {
      padding: theme.spacing.xl,
      borderBottomWidth: 1,
      borderColor: theme.colors.line,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    between: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    botIcon: {
      backgroundColor: theme.colors.mint,
      padding: 10,
      borderRadius: 13,
    },
    bold: { ...ui.label },
    messages: { padding: theme.spacing.xl, gap: theme.spacing.lg },
    messageWrap: { gap: 5 },
    bubble: {
      maxWidth: "92%",
      borderRadius: 13,
      borderTopLeftRadius: 3,
      backgroundColor: theme.colors.mint,
      padding: 14,
      gap: 10,
    },
    userBubble: {
      backgroundColor: theme.colors.green,
      borderTopLeftRadius: 13,
      borderTopRightRadius: 3,
    },
    messageText: { ...ui.body },
    link: { ...ui.link },
    receipt: {
      padding: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      gap: 8,
    },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      padding: 13,
      borderTopWidth: 1,
      borderColor: theme.colors.line,
    },
    composeInput: { ...ui.input, maxHeight: 100, flex: 1 },
    send: {
      width: 44,
      height: 44,
      backgroundColor: theme.colors.green,
      borderRadius: theme.radius.control,
      alignItems: "center",
      justifyContent: "center",
    },
    composerNote: {
      color: theme.colors.muted,
      fontSize: theme.font.small,
      lineHeight: 18 * theme.textScale,
      paddingHorizontal: 17,
      paddingBottom: 11,
    },
    ledger: { ...ui.card },
    empty: {
      minHeight: 300,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
    },
    ledgerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 17,
      borderBottomWidth: 1,
      borderColor: theme.colors.line,
    },
    categoryIcon: {
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.mint,
    },
    amount: {
      color: theme.colors.ink,
      fontSize: 13 * theme.textScale,
      fontWeight: "600",
    },
    ledgerFoot: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      borderTopWidth: 1,
      borderColor: theme.colors.line,
      paddingTop: 15,
      marginTop: 17,
    },
    overlay: { ...ui.overlay },
    dialog: { ...ui.dialog },
    field: {
      ...ui.label,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    input: { ...ui.input },
    categories: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 24,
    },
    categoryChoice: {
      ...ui.secondaryButton,
      borderWidth: 1,
      borderColor: theme.colors.line,
      padding: 9,
    },
    errorText: {
      color: theme.colors.danger,
      lineHeight: 21 * theme.textScale,
      fontSize: 12 * theme.textScale,
      marginBottom: 13,
    },
  });
}
