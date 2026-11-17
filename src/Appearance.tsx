import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import {
  createUi,
  themes,
  withFontSize,
  readFontSize,
  type FontSize,
  type AppTheme,
  type UiStyles,
} from "./theme";

type Mode = "bright" | "night";
const FONT_KEY = "slowday.font-size.v1";
const KEY = "slowday.appearance.v1";
const Context = createContext<{
  mode: Mode;
  setMode: (mode: Mode) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  error: boolean;
  theme: AppTheme;
  ui: UiStyles;
} | null>(null);

function initialMode(): Mode {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.localStorage.getItem(KEY) === "night" ? "night" : "bright";
    }
  } catch {
    /* A blocked store still permits switching for this session. */
  }
  return "bright";
}

function initialFontSize(): FontSize {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined")
      return readFontSize(window.localStorage.getItem(FONT_KEY));
  } catch {
    /* Use the standard size if storage is unavailable. */
  }
  return "standard";
}
export function AppearanceProvider({ children }: PropsWithChildren) {
  const [mode, updateMode] = useState<Mode>(initialMode);
  const [fontSize, updateFontSize] = useState<FontSize>(initialFontSize);
  const fontChanged = useRef(false);
  const [error, setError] = useState(false);
  const changed = useRef(false);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    if (Platform.OS !== "web") {
      AsyncStorage.getItem(FONT_KEY)
        .then((saved) => {
          if (alive && !fontChanged.current)
            updateFontSize(readFontSize(saved));
        })
        .catch(() => {
          if (alive) setError(true);
        });
      AsyncStorage.getItem(KEY)
        .then((saved) => {
          if (alive && !changed.current)
            updateMode(saved === "night" ? "night" : "bright");
        })
        .catch(() => {
          if (alive) setError(true);
        });
    }
    return () => {
      alive = false;
    };
  }, []);
  const theme = useMemo(
    () => withFontSize(themes[mode], fontSize),
    [mode, fontSize],
  );
  const ui = useMemo(() => createUi(theme), [theme]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    document.documentElement.dataset.appearance = mode;
    document.documentElement.style.colorScheme =
      mode === "night" ? "dark" : "light";
    document.documentElement.style.backgroundColor = theme.colors.bg;
    document.body.style.backgroundColor = theme.colors.bg;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme.colors.bg);
  }, [mode, theme]);
  function setMode(next: Mode) {
    changed.current = true;
    updateMode(next);
    queue.current = queue.current.then(async () => {
      try {
        await AsyncStorage.setItem(KEY, next);
        setError(false);
      } catch {
        setError(true);
      }
    });
  }
  function setFontSize(next: FontSize) {
    fontChanged.current = true;
    updateFontSize(next);
    queue.current = queue.current.then(async () => {
      try {
        await AsyncStorage.setItem(FONT_KEY, next);
        setError(false);
      } catch {
        setError(true);
      }
    });
  }
  return (
    <Context.Provider
      value={{ mode, setMode, fontSize, setFontSize, error, theme, ui }}
    >
      {children}
    </Context.Provider>
  );
}

export function useAppearance() {
  const value = useContext(Context);
  if (!value) throw new Error("AppearanceProvider is required");
  return value;
}

export function useThemedStyles<T>(
  factory: (theme: AppTheme, ui: UiStyles) => T,
) {
  const appearance = useAppearance();
  const styles = useMemo(
    () => factory(appearance.theme, appearance.ui),
    [factory, appearance.theme, appearance.ui],
  );
  return { ...appearance, styles };
}

export function ThemeToggle() {
  const { mode, setMode, error, theme, ui } = useAppearance();
  const night = mode === "night";
  return (
    <View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: night }}
        aria-checked={night}
        accessibilityLabel="Night mode"
        accessibilityHint={night ? "切換至 Bright mode" : "切換至 Night mode"}
        onPress={() => setMode(night ? "bright" : "night")}
        style={({ pressed }) => [
          ui.secondaryButton,
          {
            flexDirection: "row",
            gap: 7,
            minHeight: 44,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather
          name={night ? "moon" : "sun"}
          size={16}
          color={theme.colors.green}
        />
        <Text style={ui.link}>{night ? "Night" : "Bright"}</Text>
      </Pressable>
      {error && (
        <Text
          accessibilityRole="alert"
          style={[ui.small, { color: theme.colors.danger }]}
        >
          外觀偏好未儲存
        </Text>
      )}
    </View>
  );
}
