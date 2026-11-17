import { useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { CloudStore, type CloudTransport } from "./cloud-store";

export function useCloudStore<T>(transport: CloudTransport<T>, empty: T) {
  const [controller] = useState(() => new CloudStore(transport, empty));
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    void controller.refresh();
    const timer = setInterval(() => {
      void controller.refresh();
    }, 10000);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void controller.refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [controller]);
  return { ...state, controller };
}
