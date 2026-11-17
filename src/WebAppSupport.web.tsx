import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AppTheme, UiStyles } from "./theme";
import { useThemedStyles } from "./Appearance";
import { isAppleMobile, isStandalone } from "./pwa";
type IOSNavigator = Navigator & { standalone?: boolean };
function openedFromHome() {
  return isStandalone(
    window.matchMedia("(display-mode: standalone)").matches,
    (navigator as IOSNavigator).standalone,
  );
}
type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
type State = {
  online: boolean;
  offlineReady: boolean;
  installed: boolean;
  install?: () => Promise<void>;
  update?: () => void;
  error: boolean;
};
const Context = createContext<State>({
  online: true,
  offlineReady: false,
  installed: false,
  error: false,
});
export function WebAppProvider({ children }: PropsWithChildren) {
  const { styles } = useThemedStyles(createStyles);
  const [state, setState] = useState<State>({
    online: navigator.onLine,
    offlineReady: false,
    installed: openedFromHome(),
    error: false,
  });
  useEffect(() => {
    let alive = true;
    let reloadForUpdate = false;
    let registration: ServiceWorkerRegistration | undefined;
    const patch = (values: Partial<State>) => {
      if (alive) setState((old) => ({ ...old, ...values }));
    };
    const online = () => patch({ online: navigator.onLine });
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const checkDisplayMode = () => patch({ installed: openedFromHome() });
    displayMode.addEventListener("change", checkDisplayMode);
    window.addEventListener("pageshow", checkDisplayMode);
    const install = (event: Event) => {
      event.preventDefault();
      const prompt = event as InstallPrompt;
      patch({
        install: async () => {
          await prompt.prompt();
          await prompt.userChoice;
          patch({ install: undefined });
        },
      });
    };
    const installed = () => patch({ installed: true, install: undefined });
    const controller = () => {
      if (reloadForUpdate) window.location.reload();
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", installed);
    const checkUpdate = () => {
      if (registration?.waiting)
        patch({
          update: () => {
            reloadForUpdate = true;
            const waiting = registration?.waiting;
            if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
            else window.location.reload();
          },
        });
    };
    const checkOnFocus = () => {
      if (document.visibilityState === "visible")
        void registration?.update().catch(() => {});
    };
    if (!__DEV__ && "serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.addEventListener("controllerchange", controller);
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          if (!alive) return;
          registration = reg;
          checkUpdate();
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed") checkUpdate();
            });
          });
          return navigator.serviceWorker.ready.then(() =>
            patch({ offlineReady: true, error: false }),
          );
        })
        .catch(() => patch({ error: true }));
      document.addEventListener("visibilitychange", checkOnFocus);
    }
    return () => {
      alive = false;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", installed);
      displayMode.removeEventListener("change", checkDisplayMode);
      window.removeEventListener("pageshow", checkDisplayMode);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        controller,
      );
      document.removeEventListener("visibilitychange", checkOnFocus);
    };
  }, []);
  return (
    <Context.Provider value={state}>
      {children}
      {state.update ? (
        <View style={styles.update}>
          <Text style={styles.body}>新版本已準備好，儲存中的任務會保留。</Text>
          <Pressable accessibilityRole="button" onPress={state.update}>
            <Text style={styles.link}>重新載入更新</Text>
          </Pressable>
        </View>
      ) : null}
    </Context.Provider>
  );
}
export function WebAppPanel() {
  const { theme, styles: styles } = useThemedStyles(createStyles);
  const state = useContext(Context);
  const ios = isAppleMobile(
    navigator.userAgent,
    navigator.platform,
    navigator.maxTouchPoints,
  );
  const [help, setHelp] = useState(ios);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>安裝 App 與離線使用</Text>
      {state.installed && <Text style={styles.body}>已從主畫面開啟</Text>}
      <View style={styles.row}>
        <View
          style={[
            styles.dot,
            !state.online && { backgroundColor: theme.colors.orange },
          ]}
        />
        <Text style={styles.caption}>
          {state.online ? "目前已連線" : "目前離線"} ·{" "}
          {state.offlineReady
            ? "已備妥離線使用"
            : state.error
              ? "離線準備未完成，請連線後再試"
              : "請先連線開啟正式網站以準備離線使用"}
        </Text>
      </View>
      {!state.installed && (
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() =>
            state.install
              ? void state.install().catch(() => setHelp(true))
              : setHelp(!help)
          }
        >
          <Text style={styles.link}>
            {state.install
              ? "安裝HabitTracker"
              : help
                ? "收起安裝說明"
                : ios
                  ? "iPhone 安裝步驟"
                  : "如何加入主畫面"}
          </Text>
        </Pressable>
      )}
      {!state.installed && help && (
        <View style={{ gap: 10 }}>
          <Text style={styles.body}>iPhone／iPad 安裝</Text>
          <Text style={styles.body}>
            1. 用 Safari 或 Chrome 開啟正式網站並登入。
          </Text>
          <Text style={styles.body}>2. 按「分享」→「加入主畫面」。</Text>
          <Text style={styles.body}>
            3. 若有「以網頁 App 開啟」，請保持開啟，再按「新增」。
          </Text>
          <Text style={styles.body}>
            4. 回到主畫面，點「HabitTracker」圖示開啟。
          </Text>
          <Text style={styles.caption}>
            請從 Safari 或 Chrome 開啟完整網址；LINE 等 App
            內建瀏覽器可能沒有安裝選項。安裝確認需在手機上完成。
          </Text>
          {!ios && (
            <Text style={styles.body}>
              Android／電腦：用 Chrome 或
              Edge，從瀏覽器選單選擇「安裝」或「加入主畫面」。
            </Text>
          )}
        </View>
      )}
      <Text style={styles.caption}>
        任務與記帳資料保存在遠端資料庫，同一帳號可跨裝置同步。離線可開啟
        App，但讀取與修改雲端資料需要網路。
      </Text>
    </View>
  );
}
function createStyles(theme: AppTheme, ui: UiStyles) {
  return StyleSheet.create({
    card: { ...ui.card, gap: theme.spacing.lg },
    title: { ...ui.sectionTitle },
    body: { ...ui.body },
    caption: { ...ui.caption },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.green,
    },
    button: { ...ui.secondaryButton, alignSelf: "flex-start" },
    link: { ...ui.link },
    update: {
      position: "absolute",
      bottom: 90,
      alignSelf: "center",
      maxWidth: "92%",
      borderWidth: 1,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.bg,
      borderRadius: 12,
      padding: 16,
      gap: 10,
    },
  });
}
