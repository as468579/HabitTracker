import { router } from "expo-router";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppTheme, UiStyles } from "../theme";
import { useThemedStyles } from "../Appearance";

const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
const publisher = process.env.EXPO_PUBLIC_PUBLISHER_NAME;
const sections = [
  [
    "資料的使用",
    "你輸入的任務、完成紀錄、消費明細及聊天訊息用於任務統計與記帳，透過 ChatGPT 帳號登入。",
  ],
  [
    "儲存與傳輸",
    "任務與記帳資料透過 HTTPS 傳送並保存在遠端 Cloudflare D1 資料庫，依 Sites 提供的登入使用者識別碼隔離。相同帳號在手機與電腦可同步。介面模式與字體偏好仍保存在裝置上。本版本未整合廣告或使用者追蹤服務。",
  ],
  [
    "刪除與保留",
    "在設定清除任務時，會清除雲端任務與完成紀錄，其他裝置也會同步移除。清除任務不會刪除記帳資料；消費明細可單筆刪除。清除網站資料僅移除裝置偏好，不會刪除遠端資料。服務供應商的備份或復原機制可能保留歷史資料，介面不提供使用者自行復原。",
  ],
  [
    "記帳聊天室與 OpenClaw",
    "聊天訊息與消費明細保存在遠端資料庫，依登入帳號同步。OpenClaw 尚未設定時，訊息僅保存為待處理，不會自動記帳。連線後送出或重試時，該訊息及最多十二則相關對話會經由本機記帳服務傳送至你設定的 OpenClaw Gateway，並可能交由它使用的模型供應商處理；請依該服務的資料政策使用。任務清除不會清除聊天室；消費明細可單筆刪除，聊天文字仍保留，清除網站資料不會刪除雲端聊天紀錄。",
  ],
  [
    "權限",
    "任務管理功能不需要相機、麥克風、聯絡人或定位權限。此版本不提供通知提醒。",
  ],
  [
    "政策變更",
    "未來如調整資料用途或新增外部服務，會同步更新本政策及商店隱私資訊。",
  ],
];
export default function Privacy() {
  const { styles } = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/?tab=settings")
          }
          style={styles.back}
        >
          <Text style={styles.link}>‹ 返回設定</Text>
        </Pressable>
        <Text style={styles.title}>隱私權政策</Text>
        <Text style={styles.meta}>
          HabitTracker · 版本 1.0 · 更新日期：2026-11-18
        </Text>
        {publisher ? (
          <Text style={styles.body}>服務提供者：{publisher}</Text>
        ) : null}
        {sections.map(([title, body]) => (
          <View key={title} style={styles.section}>
            <Text style={styles.heading}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}
        {email ? (
          <View style={styles.section}>
            <Text style={styles.heading}>聯絡我們</Text>
            <Text style={styles.body}>
              如對資料處理有疑問，可透過以下信箱聯絡：
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                void Linking.openURL(`mailto:${email}`).catch(() => {});
              }}
            >
              <Text selectable style={styles.link}>
                {email}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
function createStyles(theme: AppTheme, ui: UiStyles) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.colors.bg },
    content: {
      padding: theme.spacing.xl,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
    back: { paddingVertical: 14, alignSelf: "flex-start" },
    link: { ...ui.link },
    title: {
      color: theme.colors.ink,
      fontSize: theme.font.title,
      fontWeight: "700",
      marginTop: 14,
    },
    meta: { ...ui.caption, marginVertical: 14 },
    section: { ...ui.card, marginTop: 22 },
    heading: { ...ui.sectionTitle, marginBottom: 9 },
    body: { ...ui.body },
  });
}
