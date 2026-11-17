import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WebAppProvider } from "../WebAppSupport";
import { AppearanceProvider, useAppearance } from "../Appearance";
function Screens() {
  const { mode, theme } = useAppearance();
  return (
    <WebAppProvider>
      <StatusBar style={mode === "night" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      />
    </WebAppProvider>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <Screens />
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
