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
    "你輸入的任務名稱、分類、備註及完成紀錄，僅用來在裝置上顯示任務與統計。此版本無需註冊帳號。",
  ],
  [
    "儲存與傳輸",
    "原生 App 將任務保存在裝置儲存空間；網頁版則保存在目前瀏覽器與網站網址的本機儲存空間。本版本未提供雲端同步，亦未整合廣告、使用者追蹤或分析服務。瀏覽器及作業系統可能依其備份設定保存資料。網站主機可能為提供服務而處理連線及存取紀錄，任務內容不會上傳至我們的後端。",
  ],
  [
    "刪除與保留",
    "你可在設定中清除所有任務與完成紀錄，或單獨刪除任務。清除操作無法復原。清除瀏覽器的網站資料也會移除網頁版紀錄；無痕模式通常不會長期保留資料。移除主畫面圖示不一定會清除瀏覽器紀錄。不同裝置、瀏覽器及網站網址之間不會自動同步資料。",
  ],
  [
    "記帳聊天室與 OpenClaw",
    "聊天訊息與消費明細保存在目前瀏覽器。OpenClaw 尚未設定時，訊息僅保存為待處理，不會自動記帳。連線後送出或重試時，該訊息及最多十二則相關對話會經由本機記帳服務傳送至你設定的 OpenClaw Gateway，並可能交由它使用的模型供應商處理；請依該服務的資料政策使用。任務清除不會清除聊天室；消費明細可單筆刪除，聊天文字仍保留，清除網站資料才會一併移除本機聊天紀錄。",
  ],
  [
    "權限",
    "任務管理功能不需要相機、麥克風、聯絡人或定位權限。此版本不提供通知提醒。",
  ],
  [
    "政策變更",
    "未來如新增登入、同步或分析服務，會同步更新本政策及商店隱私資訊。",
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
          HabitTracker · 版本 1.0 · 更新日期：2026-11-08
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
