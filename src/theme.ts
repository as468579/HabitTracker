import type { TextStyle, ViewStyle } from "react-native";

const brightTheme = {
  colors: {
    ink: "#203B30",
    secondary: "#5D6F63",
    muted: "#7A877C",
    green: "#377A57",
    mint: "#EAF1E8",
    bg: "#F6F7F2",
    surface: "#FEFFFC",
    line: "#E2E8DF",
    white: "#FFFFFF",
    onPrimary: "#FFFFFF",
    disabled: "#C8D1C8",
    orange: "#A87535",
    warningBg: "#FCF2E2",
    warningBorder: "#E5C58C",
    danger: "#A95147",
    dangerBg: "#F9EDE9",
    overlay: "#19332566",
  },
  categories: {
    健康: { color: "#5C876B", bg: "#EDF3E9" },
    學習: { color: "#8F7BAF", bg: "#F1EDF8" },
    工作: { color: "#698EA2", bg: "#EAF1F5" },
    生活: { color: "#B18C61", bg: "#F8F0E5" },
  },
  radius: { card: 16, control: 10, badge: 6, dialog: 20 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  font: {
    title: 32,
    section: 16,
    body: 14,
    label: 13,
    caption: 12,
    small: 11,
    metric: 32,
  },
  heatmap: ["#E8EDE6", "#BCD9B8", "#8CBF8E", "#5A9D67", "#377A57"],
} as const;

export type AppTheme = Omit<
  typeof brightTheme,
  "colors" | "heatmap" | "categories" | "font"
> & {
  textScale: number;
  font: { [K in keyof typeof brightTheme.font]: number };
  colors: { [K in keyof typeof brightTheme.colors]: string };
  heatmap: readonly string[];
  categories: {
    [K in keyof typeof brightTheme.categories]: { color: string; bg: string };
  };
};
export const themes: Record<"bright" | "night", AppTheme> = {
  bright: { ...brightTheme, textScale: 1 },
  night: {
    ...brightTheme,
    textScale: 1,
    colors: {
      ink: "#E4EEE7",
      secondary: "#B3C4B9",
      muted: "#99AEA0",
      green: "#78C496",
      mint: "#253D30",
      bg: "#121A16",
      surface: "#1B2620",
      line: "#34483B",
      white: "#162019",
      onPrimary: "#10261A",
      disabled: "#556C5D",
      orange: "#DAB16F",
      warningBg: "#392F20",
      warningBorder: "#79613B",
      danger: "#F39F95",
      dangerBg: "#3A2625",
      overlay: "#050C09B8",
    },
    categories: {
      健康: { color: "#8FC79E", bg: "#283E30" },
      學習: { color: "#C0A8E2", bg: "#342E43" },
      工作: { color: "#9DBED3", bg: "#273A45" },
      生活: { color: "#D9B787", bg: "#403627" },
    },
    heatmap: ["#2A382F", "#345A40", "#477B53", "#5CA36D", "#78C496"],
  },
};
export const fontSizes = { standard: 1, large: 1.15, largest: 1.3 } as const;
export type FontSize = keyof typeof fontSizes;
export function readFontSize(value: string | null): FontSize {
  return value === "large" || value === "largest" ? value : "standard";
}
export function withFontSize(theme: AppTheme, size: FontSize): AppTheme {
  const textScale = fontSizes[size];
  return {
    ...theme,
    textScale,
    font: Object.fromEntries(
      Object.entries(theme.font).map(([key, value]) => [
        key,
        value * textScale,
      ]),
    ) as AppTheme["font"],
  };
}

export function createUi(theme: AppTheme) {
  const c = theme.colors;
  return {
    card: {
      padding: theme.spacing.xl,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: theme.radius.card,
    } satisfies ViewStyle,
    metric: {
      padding: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: theme.radius.card,
    } satisfies ViewStyle,
    sectionTitle: {
      color: c.ink,
      fontSize: theme.font.section,
      fontWeight: "600",
      lineHeight: 24 * theme.textScale,
    } satisfies TextStyle,
    body: {
      color: c.secondary,
      fontSize: theme.font.body,
      lineHeight: 23 * theme.textScale,
    } satisfies TextStyle,
    label: {
      color: c.ink,
      fontSize: theme.font.label,
      fontWeight: "600",
      lineHeight: 21 * theme.textScale,
    } satisfies TextStyle,
    caption: {
      color: c.muted,
      fontSize: theme.font.caption,
      lineHeight: 20 * theme.textScale,
    } satisfies TextStyle,
    small: {
      color: c.muted,
      fontSize: theme.font.small,
      lineHeight: 18 * theme.textScale,
    } satisfies TextStyle,
    link: {
      color: c.green,
      fontSize: theme.font.label,
      fontWeight: "600",
      lineHeight: 21 * theme.textScale,
    } satisfies TextStyle,
    metricNumber: {
      color: c.ink,
      fontSize: theme.font.metric,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    } satisfies TextStyle,
    button: {
      backgroundColor: c.green,
      borderRadius: theme.radius.control,
      paddingHorizontal: 18,
      paddingVertical: 11,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    } satisfies ViewStyle,
    buttonText: {
      color: c.onPrimary,
      fontSize: theme.font.label,
      fontWeight: "600",
      lineHeight: 21 * theme.textScale,
    } satisfies TextStyle,
    secondaryButton: {
      backgroundColor: c.mint,
      borderRadius: theme.radius.control,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
    } satisfies ViewStyle,
    iconButton: {
      minWidth: 40,
      minHeight: 40,
      padding: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.control,
    } satisfies ViewStyle,
    input: {
      backgroundColor: c.white,
      color: c.ink,
      fontSize: theme.font.body,
      lineHeight: 22 * theme.textScale,
      minHeight: 44,
      padding: 12,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: theme.radius.control,
    } satisfies TextStyle,
    dialog: {
      backgroundColor: c.surface,
      padding: theme.spacing.xl,
      borderRadius: theme.radius.dialog,
      width: "100%",
      maxWidth: 480,
      maxHeight: "92%",
    } satisfies ViewStyle,
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.xl,
    } satisfies ViewStyle,
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 1,
      borderColor: c.disabled,
      borderRadius: theme.radius.badge,
      alignItems: "center",
      justifyContent: "center",
    } satisfies ViewStyle,
  } as const;
}
export type UiStyles = ReturnType<typeof createUi>;
