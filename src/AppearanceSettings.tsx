import { Feather } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useAppearance } from "./Appearance";
import type { FontSize } from "./theme";

const sizes: { value: FontSize; label: string; percent: string }[] = [
  { value: "standard", label: "標準", percent: "100%" },
  { value: "large", label: "較大", percent: "115%" },
  { value: "largest", label: "最大", percent: "130%" },
];

export default function AppearanceSettings() {
  const { mode, setMode, fontSize, setFontSize, error, theme, ui } =
    useAppearance();
  const row = {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 10,
  };
  const option = (selected: boolean) => ({
    ...ui.secondaryButton,
    flex: 1,
    minWidth: 76,
    minHeight: 48,
    gap: 5,
    borderWidth: 1,
    borderColor: selected ? theme.colors.green : theme.colors.line,
    backgroundColor: selected ? theme.colors.mint : theme.colors.bg,
  });
  return (
    <View style={[ui.card, { gap: 20 }]}>
      <Text style={ui.sectionTitle}>外觀設定</Text>
      <View style={{ gap: 10 }}>
        <Text style={ui.label}>顯示模式</Text>
        <View style={row}>
          {(["bright", "night"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`${value === "bright" ? "Bright" : "Night"} 模式`}
              accessibilityState={{ checked: mode === value }}
              aria-checked={mode === value}
              onPress={() => setMode(value)}
              style={[option(mode === value), { flexDirection: "row" }]}
            >
              <Feather
                name={value === "bright" ? "sun" : "moon"}
                size={18}
                color={theme.colors.green}
              />
              <Text style={ui.label}>
                {value === "bright" ? "Bright" : "Night"}
              </Text>
              {mode === value && (
                <Feather name="check" size={15} color={theme.colors.green} />
              )}
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={ui.label}>UI 字體大小</Text>
        <View style={row}>
          {sizes.map(({ value, label, percent }) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`字體大小：${label} ${percent}`}
              accessibilityState={{ checked: fontSize === value }}
              aria-checked={fontSize === value}
              onPress={() => setFontSize(value)}
              style={option(fontSize === value)}
            >
              <Text style={fontSize === value ? ui.link : ui.label}>
                {label}
              </Text>
              <Text style={ui.small}>{percent}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View
        style={{
          padding: 16,
          gap: 8,
          backgroundColor: theme.colors.bg,
          borderRadius: theme.radius.control,
        }}
      >
        <Text style={ui.caption}>文字預覽</Text>
        <Text style={ui.sectionTitle}>每日任務與完成紀錄</Text>
        <Text style={ui.body}>閱讀 20 分鐘 · 已完成 3 / 5 項任務</Text>
      </View>
      <Text style={ui.caption}>立即套用，偏好保存在目前裝置。</Text>
      {error && (
        <Text
          accessibilityRole="alert"
          style={[ui.body, { color: theme.colors.danger }]}
        >
          外觀偏好未儲存，請重新選取以重試。
        </Text>
      )}
    </View>
  );
}
